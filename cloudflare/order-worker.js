const FALLBACK_MENU = Object.freeze({
  items: Object.freeze([
    { id: 'coffee', category: 'coffee', labels: { uk: 'Кава', it: 'Caffè', en: 'Coffee', fr: 'Café' }, icon: 'coffee', sort: 10, priceUah: null, volumeMl: null, descriptionUk: '' },
    { id: 'tea', category: 'tea', labels: { uk: 'Чай', it: 'Tè', en: 'Tea', fr: 'Thé' }, icon: 'tea', sort: 20, priceUah: null, volumeMl: null, descriptionUk: '' },
    { id: 'cappuccino', category: 'coffee', labels: { uk: 'Капучино', it: 'Cappuccino', en: 'Cappuccino', fr: 'Cappuccino' }, icon: 'cappuccino', sort: 30, priceUah: null, volumeMl: null, descriptionUk: '' },
    { id: 'latte', category: 'coffee', labels: { uk: 'Лате', it: 'Latte', en: 'Latte', fr: 'Latte' }, icon: 'latte', sort: 40, priceUah: null, volumeMl: null, descriptionUk: '' }
  ]),
  options: Object.freeze([]),
  source: 'fallback'
});
const MENU_CACHE_MS = 5 * 60 * 1000;
let menuCache = { value: null, expiresAt: 0 };

const ALLOWED_ORIGINS = new Set([
  'https://mafia-cafe.web.app',
  'https://somnit-hub.github.io'
]);

const FEEDBACK_EMOTIONS = new Set(['brain', 'oscar', 'fire', 'circus', 'dead']);
const EMPTY_EMOTIONS = Object.freeze({ brain: 0, oscar: 0, fire: 0, circus: 0, dead: 0 });
const ACTIVE_GAME_PHASES = new Set([
  'reveal', 'zeroNight', 'day', 'vote', 'tieSpeech', 'tieVote',
  'allTie', 'lastWord', 'bestMove', 'night'
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function clean(value, maximum = 80) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[a-zA-Z0-9+/]*={0,2}$/.test(`${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`)) {
    throw new HttpError(400, 'Некоректні дані Telegram');
  }
  const binary = atob(`${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function telegramClientId(env) {
  const configured = clean(env?.TELEGRAM_CLIENT_ID, 32);
  const fromBotToken = clean(env?.TELEGRAM_BOT_TOKEN, 160).split(':')[0];
  const clientId = configured || fromBotToken;
  if (!/^\d{5,32}$/.test(clientId)) throw new HttpError(503, 'Telegram Login ще не налаштовано');
  return clientId;
}

async function telegramNonceKey(env) {
  const secret = clean(env?.TELEGRAM_LOGIN_NONCE_SECRET || env?.TELEGRAM_BOT_TOKEN, 512);
  if (!secret) throw new HttpError(503, 'Telegram Login ще не налаштовано');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createTelegramProfileNonce(uid, env, now = Date.now()) {
  const random = new Uint8Array(18);
  crypto.getRandomValues(random);
  const payload = new TextEncoder().encode(JSON.stringify({
    uid: clean(uid, 128),
    issuedAt: Number(now),
    random: base64UrlEncode(random)
  }));
  const signature = await crypto.subtle.sign('HMAC', await telegramNonceKey(env), payload);
  return `${base64UrlEncode(payload)}.${base64UrlEncode(signature)}`;
}

export async function verifyTelegramProfileNonce(nonce, uid, env, now = Date.now()) {
  const [payloadPart, signaturePart, extra] = String(nonce || '').split('.');
  if (!payloadPart || !signaturePart || extra) throw new HttpError(401, 'Сеанс Telegram недійсний');
  const payload = base64UrlDecode(payloadPart);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify('HMAC', await telegramNonceKey(env), signature, payload);
  if (!valid) throw new HttpError(401, 'Сеанс Telegram недійсний');
  let data;
  try { data = JSON.parse(new TextDecoder().decode(payload)); }
  catch { throw new HttpError(401, 'Сеанс Telegram недійсний'); }
  const age = Number(now) - Number(data.issuedAt);
  if (clean(data.uid, 128) !== clean(uid, 128) || !Number.isFinite(age) || age < -30000 || age > 10 * 60 * 1000) {
    throw new HttpError(401, 'Сеанс Telegram прострочено');
  }
  return true;
}

function telegramUsername(value) {
  const username = clean(value, 32).replace(/^@+/, '');
  return /^[a-zA-Z0-9_]{5,32}$/.test(username) ? username.toLowerCase() : '';
}

function telegramPhotoUrl(value) {
  const photo = clean(value, 2048);
  if (!photo) return '';
  try { return new URL(photo).protocol === 'https:' ? photo : ''; }
  catch { return ''; }
}

export function telegramProfileFromClaims(claims, now = Date.now()) {
  const telegramUserId = clean(claims?.sub || claims?.id, 32);
  if (!/^\d{1,32}$/.test(telegramUserId)) throw new HttpError(401, 'Telegram-профіль не містить коректного ID');
  return {
    telegramUsername: telegramUsername(claims?.preferred_username),
    telegramUserId,
    telegramDisplayName: clean(claims?.name, 80),
    telegramPhotoURL: telegramPhotoUrl(claims?.picture),
    telegramVerified: true,
    telegramLinkedAt: new Date(now).toISOString()
  };
}

function decodeTelegramJwtPart(part) {
  try { return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))); }
  catch { throw new HttpError(401, 'Некоректний токен Telegram'); }
}

async function verifyTelegramIdToken(idToken, env, now = Date.now()) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw new HttpError(401, 'Некоректний токен Telegram');
  const header = decodeTelegramJwtPart(parts[0]);
  const claims = decodeTelegramJwtPart(parts[1]);
  if (header.alg !== 'RS256' || !clean(header.kid, 160)) throw new HttpError(401, 'Непідтримуваний підпис Telegram');
  const response = await fetch('https://oauth.telegram.org/.well-known/jwks.json', {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 3600 }
  });
  const jwks = await response.json().catch(() => ({}));
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA') : null;
  if (!response.ok || !jwk) throw new HttpError(502, 'Не вдалося перевірити підпис Telegram');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  const nowSeconds = Math.floor(Number(now) / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud || '')];
  if (!valid
    || claims.iss !== 'https://oauth.telegram.org'
    || !audience.includes(telegramClientId(env))
    || !Number.isFinite(Number(claims.exp))
    || Number(claims.exp) <= nowSeconds
    || Number(claims.iat || 0) > nowSeconds + 300) {
    throw new HttpError(401, 'Токен Telegram недійсний або прострочений');
  }
  return { claims, profile: telegramProfileFromClaims(claims, now) };
}

function integer(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function csvRows(source = '') {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(value); value = ''; }
    else if (character === '\n') { row.push(value); rows.push(row); row = []; value = ''; }
    else if (character !== '\r') value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function recordsFromCsv(source) {
  const rows = csvRows(source);
  const headers = (rows.shift() || []).map(value => clean(value, 40));
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function sheetNumber(value, minimum = 0, maximum = 100000) {
  let normalized = String(value || '').replace(/[\s\u00a0₴грн]/gi, '');
  if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replaceAll('.', '').replace(',', '.');
  else normalized = normalized.replace(',', '.');
  normalized = normalized.replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function enabled(value) {
  return ['true', '1', 'yes', 'так'].includes(clean(value, 12).toLowerCase());
}

function labelsFromRow(row) {
  const uk = clean(row.name_uk, 80);
  if (!uk) return null;
  return {
    uk,
    it: clean(row.name_it || uk, 80),
    en: clean(row.name_en || uk, 80),
    fr: clean(row.name_fr || uk, 80)
  };
}

export function parseMenuCsv(itemsCsv, optionsCsv = '') {
  const ids = new Set();
  const items = recordsFromCsv(itemsCsv).map(row => {
    const id = clean(row.id, 48).toLowerCase();
    const labels = labelsFromRow(row);
    if (!enabled(row.available) || !/^[a-z0-9][a-z0-9_-]*$/.test(id) || ids.has(id) || !labels) return null;
    ids.add(id);
    return {
      id,
      category: clean(row.category, 32).toLowerCase() || 'other',
      labels,
      priceUah: sheetNumber(row.price_uah),
      volumeMl: sheetNumber(row.volume_ml, 1, 5000),
      icon: clean(row.icon, 32).toLowerCase() || 'coffee',
      sort: sheetNumber(row.sort, -100000, 100000) ?? 0,
      descriptionUk: clean(row.description_uk, 240)
    };
  }).filter(Boolean).sort((left, right) => left.sort - right.sort || left.labels.uk.localeCompare(right.labels.uk, 'uk'));
  if (!items.length) throw new Error('Published menu has no available items');

  const optionIds = new Set();
  const options = recordsFromCsv(optionsCsv).map(row => {
    const id = clean(row.option_id, 48).toLowerCase();
    const itemId = clean(row.item_id, 48).toLowerCase();
    const labels = labelsFromRow(row);
    if (!enabled(row.available) || !/^[a-z0-9][a-z0-9_-]*$/.test(id) || optionIds.has(id) || !ids.has(itemId) || !labels) return null;
    optionIds.add(id);
    return {
      id,
      itemId,
      group: clean(row.group, 32).toLowerCase() || 'extra',
      labels,
      priceDeltaUah: sheetNumber(row.price_delta_uah, -100000, 100000) ?? 0,
      sort: sheetNumber(row.sort, -100000, 100000) ?? 0
    };
  }).filter(Boolean).sort((left, right) => left.sort - right.sort || left.labels.uk.localeCompare(right.labels.uk, 'uk'));
  return { items, options, source: 'sheet', updatedAt: new Date().toISOString() };
}

function sheetCsvUrl(spreadsheetId, sheet) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
}

async function fetchSheetCsv(spreadsheetId, sheet) {
  const response = await fetch(sheetCsvUrl(spreadsheetId, sheet), {
    headers: { Accept: 'text/csv' },
    cf: { cacheEverything: true, cacheTtl: 300 }
  });
  if (!response.ok) throw new Error(`Menu sheet ${sheet} returned ${response.status}`);
  return response.text();
}

export async function loadMenu(env, now = Date.now()) {
  if (menuCache.value && menuCache.expiresAt > now) return menuCache.value;
  const spreadsheetId = clean(env?.MENU_SHEET_ID, 160);
  if (!spreadsheetId) return FALLBACK_MENU;
  try {
    const [itemsCsv, optionsCsv] = await Promise.all([
      fetchSheetCsv(spreadsheetId, 'menu_items'),
      fetchSheetCsv(spreadsheetId, 'options')
    ]);
    const value = parseMenuCsv(itemsCsv, optionsCsv);
    menuCache = { value, expiresAt: now + MENU_CACHE_MS };
    return value;
  } catch (error) {
    console.error('Menu refresh failed', { name: error?.name || 'Error' });
    if (menuCache.value) return { ...menuCache.value, stale: true };
    return FALLBACK_MENU;
  }
}

export function orderPayload(body = {}, menu = FALLBACK_MENU) {
  const item = clean(body.item, 24).toLowerCase();
  const selectedItem = menu.items.find(option => option.id === item);
  if (!selectedItem) throw new HttpError(400, 'Невідома позиція меню або вона недоступна');
  const requestedOptionIds = Array.isArray(body.options)
    ? [...new Set(body.options.map(option => clean(option, 48).toLowerCase()).filter(Boolean))]
    : [];
  if (requestedOptionIds.length > 8) throw new HttpError(400, 'Забагато додатків до замовлення');
  const selectedOptions = requestedOptionIds.map(id => menu.options.find(option => option.id === id && option.itemId === item));
  if (selectedOptions.some(option => !option)) throw new HttpError(400, 'Невідомий або недоступний варіант напою');
  const singleGroups = selectedOptions.filter(option => option.group !== 'extra').map(option => option.group);
  if (new Set(singleGroups).size !== singleGroups.length) throw new HttpError(400, 'Для однієї групи можна вибрати лише один варіант');
  const priceUah = selectedItem.priceUah === null
    ? null
    : selectedItem.priceUah + selectedOptions.reduce((sum, option) => sum + option.priceDeltaUah, 0);
  return {
    item,
    label: selectedItem.labels.uk,
    options: selectedOptions.map(option => ({ id: option.id, label: option.labels.uk, priceDeltaUah: option.priceDeltaUah })),
    priceUah,
    volumeMl: selectedItem.volumeMl,
    sender: clean(body.sender, 60) || 'Гість Enjoy',
    game: clean(body.game, 80)
  };
}

export function telegramOrderText(order) {
  const lines = [
    '☕ <b>Нове замовлення · Enjoy Mafia</b>',
    `Напій: <b>${escapeHtml(order.label)}</b>`,
    `Від: ${escapeHtml(order.sender)}`
  ];
  if (order.volumeMl) lines.splice(2, 0, `Об’єм: ${escapeHtml(order.volumeMl)} мл`);
  if (order.options?.length) lines.splice(order.volumeMl ? 3 : 2, 0, `Додатково: ${order.options.map(option => escapeHtml(option.label)).join(', ')}`);
  if (order.priceUah !== null && order.priceUah !== undefined) lines.splice(-1, 0, `Сума: <b>${escapeHtml(order.priceUah)} грн</b>`);
  if (order.game) lines.push(`Гра: ${escapeHtml(order.game)}`);
  return lines.join('\n');
}

function localOrigin(origin) {
  return /^http:\/\/(?:localhost|127[.]0[.]0[.]1):\d+$/.test(origin);
}

function originAllowed(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin) || localOrigin(origin);
}

function corsHeaders(origin = '') {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  });
  if (originAllowed(origin) && origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(origin, status, body, cacheControl = 'no-store') {
  const headers = corsHeaders(origin);
  headers.set('Cache-Control', cacheControl);
  return new Response(JSON.stringify(body), { status, headers });
}

async function firebaseIdentity(idToken, env) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const result = await response.json().catch(() => ({}));
  const identity = result.users?.[0];
  if (!response.ok || !identity?.localId || identity.disabled) throw new HttpError(401, 'Потрібен повторний Google-вхід');
  if (!identity.emailVerified) throw new HttpError(403, 'Email Google-акаунта не підтверджено');
  return { uid: identity.localId, email: clean(identity.email, 120) };
}

function firestoreValue(field) {
  if (!field || typeof field !== 'object') return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('booleanValue' in field) return Boolean(field.booleanValue);
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in field) {
    return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  }
  return null;
}

function firestoreEncodedValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreEncodedValue) } };
  return { mapValue: { fields: firestoreEncodedFields(value) } };
}

function firestoreEncodedFields(value) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, firestoreEncodedValue(item)]));
}

function liveGameUrl(gameId, env) {
  const projectId = clean(env.FIREBASE_PROJECT_ID, 120);
  if (!projectId) throw new Error('Firebase project is not configured');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/communities/enjoy/liveGames/${encodeURIComponent(gameId)}`;
}

function liveGamePayload(source, identity) {
  const game = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const id = clean(game.id, 160);
  const phase = clean(game.phase, 40);
  if (!id || id.includes('/') || game.status !== 'active' || !ACTIVE_GAME_PHASES.has(phase)) {
    throw new HttpError(400, 'Некоректні дані активної гри');
  }
  if (!Array.isArray(game.seats) || game.seats.length !== 10) {
    throw new HttpError(400, 'Активна гра повинна містити 10 місць');
  }
  const seats = game.seats.map((sourceSeat, index) => {
    const seat = sourceSeat && typeof sourceSeat === 'object' ? sourceSeat : {};
    const name = clean(seat.name, 60);
    if (!name || Number(seat.number) !== index + 1) throw new HttpError(400, 'Некоректна розсадка активної гри');
    return {
      number: index + 1,
      name,
      status: seat.status === 'dead' ? 'dead' : 'alive',
      faults: integer(seat.faults, 0, 4),
      eliminatedReason: clean(seat.eliminatedReason, 160),
      noVote: Boolean(seat.noVote)
    };
  });
  const seatNumbers = value => Array.isArray(value)
    ? value.slice(0, 10).map(number => integer(number, 1, 10))
    : [];
  const timer = game.timer && typeof game.timer === 'object' ? game.timer : {};
  const startedAt = clean(game.startedAt, 40);
  const gameUpdatedAt = clean(game.gameUpdatedAt, 40);
  if (!startedAt || !gameUpdatedAt) throw new HttpError(400, 'Активна гра не має часу початку або оновлення');
  return {
    id,
    communityId: 'enjoy',
    ownerUid: identity.uid,
    hostName: clean(game.hostName, 60) || 'Ведучий',
    title: clean(game.title, 80) || 'Гра в Мафію',
    venue: clean(game.venue, 100),
    startedAt,
    gameUpdatedAt,
    status: 'active',
    phase,
    subphase: clean(game.subphase, 40),
    day: integer(game.day, 1, 100),
    seats,
    nominations: seatNumbers(game.nominations),
    tied: seatNumbers(game.tied),
    speakerIndex: integer(game.speakerIndex, 0, 9),
    speakerOrder: seatNumbers(game.speakerOrder),
    lastWordSeat: integer(game.lastWordSeat, 0, 10),
    nightStep: integer(game.nightStep, 0, 4),
    timer: {
      remaining: integer(timer.remaining, 0, 3600),
      running: Boolean(timer.running),
      purpose: clean(timer.purpose, 24),
      endsAt: timer.running ? integer(timer.endsAt, 0, 9999999999999) : 0
    },
    schemaVersion: 1
  };
}

async function firestoreLiveGame(gameId, idToken, env) {
  const response = await fetch(liveGameUrl(gameId, env), { headers: { Authorization: `Bearer ${idToken}` } });
  if (response.status === 404) return null;
  const document = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = clean(document?.error?.message, 240) || 'Не вдалося прочитати активну гру';
    throw new HttpError(response.status === 401 || response.status === 403 ? response.status : 502, message);
  }
  return document;
}

async function saveLiveGame(body, identity, idToken, env) {
  const game = liveGamePayload(body.game, identity);
  const existing = await firestoreLiveGame(game.id, idToken, env);
  const existingOwnerUid = firestoreValue(existing?.fields?.ownerUid);
  if (existingOwnerUid && existingOwnerUid !== identity.uid) throw new HttpError(403, 'Ця активна гра належить іншому ведучому');
  if (existingOwnerUid === identity.uid && firestoreValue(existing?.fields?.gameUpdatedAt) === game.gameUpdatedAt) {
    return { ok: true, changed: false, gameId: game.id };
  }
  const now = new Date().toISOString();
  const fields = firestoreEncodedFields(game);
  fields.createdAt = existing?.fields?.createdAt?.timestampValue
    ? { timestampValue: existing.fields.createdAt.timestampValue }
    : { timestampValue: now };
  fields.updatedAt = { timestampValue: now };
  const response = await fetch(liveGameUrl(game.id, env), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = clean(result?.error?.message, 240) || 'База відхилила активну гру';
    throw new HttpError(response.status === 401 || response.status === 403 ? response.status : 502, message);
  }
  return { ok: true, changed: true, gameId: game.id };
}

async function deleteLiveGame(body, identity, idToken, env) {
  const gameId = clean(body.gameId, 160);
  if (!gameId || gameId.includes('/')) throw new HttpError(400, 'Некоректний ідентифікатор гри');
  const existing = await firestoreLiveGame(gameId, idToken, env);
  if (!existing) return { ok: true, changed: false, gameId };
  if (firestoreValue(existing.fields?.ownerUid) !== identity.uid) {
    throw new HttpError(403, 'Скасувати гру може лише її ведучий');
  }
  const response = await fetch(liveGameUrl(gameId, env), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (!response.ok && response.status !== 404) {
    const result = await response.json().catch(() => ({}));
    const message = clean(result?.error?.message, 240) || 'Не вдалося видалити активну гру';
    throw new HttpError(response.status === 401 || response.status === 403 ? response.status : 502, message);
  }
  return { ok: true, changed: response.status !== 404, gameId };
}

async function requireFinishedGame(gameId, idToken, env) {
  const cleanGameId = clean(gameId, 160);
  if (!cleanGameId) throw new HttpError(400, 'Гру не знайдено');
  const projectId = clean(env.FIREBASE_PROJECT_ID, 120);
  if (!projectId) throw new Error('Firebase project is not configured');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/communities/enjoy/games/${encodeURIComponent(cleanGameId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  const document = await response.json().catch(() => ({}));
  if (response.status === 404) throw new HttpError(404, 'Завершену гру не знайдено');
  if (!response.ok) throw new HttpError(response.status === 403 ? 403 : 502, 'Не вдалося перевірити участь у грі');
  const game = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  if (game.status !== 'finished') throw new HttpError(409, 'Оцінити можна лише завершену гру');
  return { gameId: cleanGameId, game };
}

async function requireFinishedGameParticipant(gameId, idToken, identity, env) {
  const finished = await requireFinishedGame(gameId, idToken, env);
  const profileId = `google_${identity.uid}`;
  if (!(finished.game.seats || []).some(seat => seat?.profileId === profileId)) {
    throw new HttpError(403, 'Оцінювати гру можуть лише її учасники');
  }
  return finished.gameId;
}

function feedbackVote(body = {}) {
  const sentiment = ['up', 'down'].includes(body.sentiment) ? body.sentiment : '';
  const emotion = FEEDBACK_EMOTIONS.has(body.emotion) ? body.emotion : '';
  if (!sentiment && !emotion) throw new HttpError(400, 'Оберіть оцінку або емоцію');
  return { sentiment, emotion };
}

async function feedbackStore(gameId, identity, env, vote = null) {
  const id = env.GAME_FEEDBACK.idFromName(gameId);
  const url = `https://game-feedback.internal/rating?uid=${encodeURIComponent(identity.uid)}`;
  const response = await env.GAME_FEEDBACK.get(id).fetch(url, vote ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: identity.uid, vote })
  } : { method: 'GET' });
  if (!response.ok) throw new Error('Feedback store unavailable');
  return response.json();
}

async function feedbackSummaryStore(gameId, env) {
  const id = env.GAME_FEEDBACK.idFromName(gameId);
  const response = await env.GAME_FEEDBACK.get(id).fetch('https://game-feedback.internal/summary');
  if (!response.ok) throw new Error('Feedback store unavailable');
  return response.json();
}

async function checkRateLimit(identity, env) {
  const id = env.ORDER_LIMITER.idFromName('enjoy-orders-v1');
  const response = await env.ORDER_LIMITER.get(id).fetch('https://order-limiter.internal/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: identity.uid })
  });
  if (response.status === 429) throw new HttpError(429, 'Зачекайте кілька секунд перед наступним замовленням');
  if (!response.ok) throw new Error('Rate limiter unavailable');
}

async function sendTelegram(order, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ORDER_TELEGRAM_CHAT_ID) throw new HttpError(503, 'Telegram-одержувача ще не підключено');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.ORDER_TELEGRAM_CHAT_ID,
      text: telegramOrderText(order),
      parse_mode: 'HTML',
      disable_notification: false
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    console.error('Telegram sendMessage failed', { status: response.status });
    throw new HttpError(502, 'Telegram не прийняв замовлення');
  }
}

export async function handleRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin)) return json(origin, 403, { error: 'Недозволений сайт' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json(origin, 200, { ok: true, service: 'enjoy-mafia-orders' });
  if (url.pathname === '/menu') {
    if (request.method !== 'GET') return json(origin, 405, { error: 'Потрібен GET-запит' });
    return json(origin, 200, await loadMenu(env), 'public,max-age=60,s-maxage=300,stale-while-revalidate=3600');
  }
  if (!['/orders', '/ratings', '/ratings/batch', '/ratings/summary/batch', '/live-games', '/telegram-profile/config', '/telegram-profile/verify'].includes(url.pathname)) return json(origin, 404, { error: 'Маршрут не знайдено' });
  if (url.pathname === '/orders' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (url.pathname === '/live-games' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (url.pathname === '/telegram-profile/config' && request.method !== 'GET') return json(origin, 405, { error: 'Потрібен GET-запит' });
  if (url.pathname === '/telegram-profile/verify' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (url.pathname === '/ratings' && !['GET', 'POST'].includes(request.method)) return json(origin, 405, { error: 'Метод не підтримується' });
  if (url.pathname === '/ratings/batch' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (url.pathname === '/ratings/summary/batch' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  const bodyLimit = ['/live-games', '/telegram-profile/verify'].includes(url.pathname) ? 16384 : 4096;
  if (Number(request.headers.get('Content-Length') || 0) > bodyLimit) return json(origin, 413, { error: 'Запит завеликий' });

  try {
    const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, 'Потрібен Google-вхід');
    const identity = await firebaseIdentity(match[1], env);
    if (url.pathname === '/telegram-profile/config') {
      return json(origin, 200, {
        clientId: telegramClientId(env),
        nonce: await createTelegramProfileNonce(identity.uid, env)
      });
    }
    if (url.pathname === '/telegram-profile/verify') {
      const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
      const verified = await verifyTelegramIdToken(clean(body.idToken, 12000), env);
      await verifyTelegramProfileNonce(verified.claims.nonce, identity.uid, env);
      return json(origin, 200, verified.profile);
    }
    if (url.pathname === '/live-games') {
      const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
      if (body.action === 'upsert') return json(origin, 200, await saveLiveGame(body, identity, match[1], env));
      if (body.action === 'delete') return json(origin, 200, await deleteLiveGame(body, identity, match[1], env));
      throw new HttpError(400, 'Невідома дія з активною грою');
    }
    if (url.pathname === '/ratings/summary/batch') {
      const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
      const requestedIds = Array.isArray(body.gameIds) ? [...new Set(body.gameIds.map(value => clean(value, 160)).filter(Boolean))] : [];
      if (!requestedIds.length || requestedIds.length > 25) throw new HttpError(400, 'За один раз можна перевірити від 1 до 25 ігор');
      const games = await Promise.all(requestedIds.map(gameId => requireFinishedGame(gameId, match[1], env)));
      const results = await Promise.all(games.map(({ gameId }) => feedbackSummaryStore(gameId, env)));
      return json(origin, 200, { summaries: Object.fromEntries(games.map(({ gameId }, index) => [gameId, results[index].summary])) });
    }
    if (url.pathname === '/ratings/batch') {
      const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
      const requestedIds = Array.isArray(body.gameIds) ? [...new Set(body.gameIds.map(value => clean(value, 160)).filter(Boolean))] : [];
      if (!requestedIds.length || requestedIds.length > 25) throw new HttpError(400, 'За один раз можна перевірити від 1 до 25 ігор');
      const gameIds = await Promise.all(requestedIds.map(gameId => requireFinishedGameParticipant(gameId, match[1], identity, env)));
      const results = await Promise.all(gameIds.map(gameId => feedbackStore(gameId, identity, env)));
      return json(origin, 200, { ratings: Object.fromEntries(gameIds.map((gameId, index) => [gameId, results[index]])) });
    }
    if (url.pathname === '/ratings') {
      const body = request.method === 'POST'
        ? await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); })
        : {};
      const gameId = await requireFinishedGameParticipant(
        request.method === 'GET' ? url.searchParams.get('gameId') : body.gameId,
        match[1],
        identity,
        env
      );
      const result = await feedbackStore(gameId, identity, env, request.method === 'POST' ? feedbackVote(body) : null);
      return json(origin, 200, result);
    }
    const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
    const order = orderPayload(body, await loadMenu(env));
    await checkRateLimit(identity, env);
    await sendTelegram(order, env);
    return json(origin, 200, { ok: true, item: order.item, label: order.label });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const telegramProfileRoute = url.pathname.startsWith('/telegram-profile/');
    if (status >= 500) console.error(url.pathname === '/live-games' ? 'Live game sync failed' : telegramProfileRoute ? 'Telegram profile link failed' : 'Order delivery failed', { name: error?.name || 'Error', status });
    const fallback = url.pathname === '/live-games'
      ? 'Не вдалося синхронізувати активну гру'
      : telegramProfileRoute
        ? 'Не вдалося підключити Telegram'
        : 'Не вдалося надіслати замовлення';
    return json(origin, status, { error: status < 500 || error instanceof HttpError ? error.message : fallback });
  }
}

export class OrderRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const { uid } = await request.json().catch(() => ({}));
    if (!uid) return new Response(null, { status: 400 });
    const key = `user:${clean(uid, 128)}`;
    const now = Date.now();
    const lastOrderAt = Number(await this.state.storage.get(key) || 0);
    if (now - lastOrderAt < 5000) return new Response(null, { status: 429 });
    await this.state.storage.put(key, now);
    return new Response(null, { status: 204 });
  }
}

async function privateFeedbackKey(uid) {
  const bytes = new TextEncoder().encode(String(uid));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `vote:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export class GameFeedbackStore {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405 });
    const summaryOnly = new URL(request.url).pathname === '/summary';
    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const uid = payload.uid || new URL(request.url).searchParams.get('uid');
    const vote = payload.vote;
    if (!uid && !summaryOnly) return new Response(null, { status: 400 });
    if (summaryOnly && request.method !== 'GET') return new Response(null, { status: 405 });
    const key = uid ? await privateFeedbackKey(uid) : '';
    if (request.method === 'POST') {
      await this.state.storage.put(key, {
        sentiment: ['up', 'down'].includes(vote?.sentiment) ? vote.sentiment : '',
        emotion: FEEDBACK_EMOTIONS.has(vote?.emotion) ? vote.emotion : '',
        updatedAt: new Date().toISOString()
      });
    }
    const mine = key ? await this.state.storage.get(key) || { sentiment: '', emotion: '' } : null;
    const stored = await this.state.storage.list({ prefix: 'vote:' });
    const votes = [...stored.values()];
    const sentiment = { up: 0, down: 0 };
    const emotions = { ...EMPTY_EMOTIONS };
    votes.forEach(item => {
      if (item?.sentiment in sentiment) sentiment[item.sentiment] += 1;
      if (item?.emotion in emotions) emotions[item.emotion] += 1;
    });
    const total = votes.filter(item => item?.sentiment || item?.emotion).length;
    const summary = {
        visible: total >= 3,
        total,
        sentiment: total >= 3 ? sentiment : { up: 0, down: 0 },
        emotions: total >= 3 ? emotions : { ...EMPTY_EMOTIONS }
    };
    return Response.json(summaryOnly ? { summary } : {
      mine: { sentiment: mine.sentiment || '', emotion: mine.emotion || '' },
      summary
    });
  }
}

export default { fetch: handleRequest };
