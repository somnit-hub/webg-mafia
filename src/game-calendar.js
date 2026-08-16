function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function currentGameCalendarMonth(now = new Date()) {
  const date = validDate(now) || new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function normalizeGameCalendarMonth(value, now = new Date()) {
  const year = Number(value?.year);
  const month = Number(value?.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1970 || year > 2200 || month < 0 || month > 11) {
    return currentGameCalendarMonth(now);
  }
  return { year, month };
}

export function shiftGameCalendarMonth(value, offset, now = new Date()) {
  const month = normalizeGameCalendarMonth(value, now);
  const date = new Date(month.year, month.month + Math.trunc(Number(offset) || 0), 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function gameDate(game) {
  return validDate(game?.startedAt || game?.endedAt || game?.updatedAt || '');
}

export function buildGameCalendarMonth(games = [], value, now = new Date()) {
  const { year, month } = normalizeGameCalendarMonth(value, now);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const counts = Array(daysInMonth + 1).fill(0);
  (Array.isArray(games) ? games : []).forEach(game => {
    if (game?.status && game.status !== 'finished') return;
    const date = gameDate(game);
    if (!date || date.getFullYear() !== year || date.getMonth() !== month) return;
    counts[date.getDate()] += 1;
  });

  const leadingEmptyDays = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, games: counts[index + 1] }))
  ];
  while (cells.length % 7) cells.push(null);

  return { year, month, daysInMonth, leadingEmptyDays, cells };
}
