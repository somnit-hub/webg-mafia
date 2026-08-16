function clean(value, maximum = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function httpUrl(value, label, maximum = 2048) {
  const source = clean(value, maximum);
  if (!source) return '';
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString().slice(0, maximum);
  } catch {
    throw new Error(`Перевірте поле «${label}»`);
  }
}

function isGoogleMapsHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'maps.app.goo.gl'
    || host === 'goo.gl'
    || host === 'maps.google.com'
    || /(^|[.])google[.](?:com|[a-z]{2,3}|(?:com|co)[.][a-z]{2})$/.test(host);
}

function readableMapValue(value) {
  return clean(String(value || '').replace(/\+/g, ' '), 500);
}

export function googleMapsVenueSuggestion(value) {
  const source = clean(value, 2048);
  if (!source) return { valid: false, url: '', name: '', address: '', short: false };
  let url;
  try {
    url = new URL(source);
  } catch {
    return { valid: false, url: source, name: '', address: '', short: false };
  }
  if (url.protocol !== 'https:' || !isGoogleMapsHost(url.hostname)) {
    return { valid: false, url: source, name: '', address: '', short: false };
  }

  const short = ['maps.app.goo.gl', 'goo.gl'].includes(url.hostname.toLowerCase());
  const parts = url.pathname.split('/').filter(Boolean);
  const placeIndex = parts.findIndex(part => part.toLowerCase() === 'place');
  let placeName = '';
  if (placeIndex >= 0) {
    try { placeName = decodeURIComponent(parts[placeIndex + 1] || ''); }
    catch { placeName = parts[placeIndex + 1] || ''; }
  }
  const name = readableMapValue(placeName);
  const query = readableMapValue(
    url.searchParams.get('query')
      || url.searchParams.get('q')
      || url.searchParams.get('destination')
      || ''
  );
  const coordinatesOnly = /^-?\d+(?:[.]\d+)?\s*,\s*-?\d+(?:[.]\d+)?$/.test(query);
  let address = coordinatesOnly ? '' : query;
  if (name && address.toLocaleLowerCase('uk').startsWith(`${name.toLocaleLowerCase('uk')},`)) {
    address = clean(address.slice(name.length + 1), 300);
  }
  return { valid: true, url: url.toString(), name, address, short };
}

export function normalizeVenueInput(value = {}) {
  const name = clean(value.name, 60);
  if (!name) throw new Error('Вкажіть назву місця або клубу');
  const googleMapsUrl = httpUrl(value.googleMapsUrl, 'Google Maps');
  if (googleMapsUrl && !googleMapsVenueSuggestion(googleMapsUrl).valid) {
    throw new Error('Вкажіть коректне посилання Google Maps');
  }
  return {
    name,
    googleMapsUrl,
    address: clean(value.address, 300),
    phone: clean(value.phone, 40),
    website: httpUrl(value.website, 'Сайт')
  };
}

export function filterVenues(venues = [], search = '') {
  const terms = clean(search, 200).toLocaleLowerCase('uk').split(/\s+/).filter(Boolean);
  return venues
    .filter(venue => {
      const haystack = [venue?.name, venue?.address, venue?.phone].join(' ').toLocaleLowerCase('uk');
      return terms.every(term => haystack.includes(term));
    })
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'uk', { sensitivity: 'base' }));
}

export function venuePickerOptions(venues = [], search = '', selection = {}) {
  const query = clean(search, 200);
  const selectedName = clean(selection.selectedName, 60);
  const selectedQuery = Boolean(selection.open && selection.selectedId)
    && query.toLocaleLowerCase('uk') === selectedName.toLocaleLowerCase('uk');
  return filterVenues(venues, selectedQuery ? '' : query);
}

export function gameTitleForVenue(venueName, date = new Date()) {
  const name = clean(venueName, 60) || 'Мафія';
  const gameDate = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(date);
  const gameTime = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${name} · ${gameDate} · ${gameTime}`;
}
