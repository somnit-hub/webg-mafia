const DAY_MS = 86_400_000;

export const STAT_PERIODS = Object.freeze({
  all: 0,
  '30d': 30,
  '90d': 90,
  '365d': 365
});

function timestamp(value) {
  const result = Date.parse(value || '');
  return Number.isFinite(result) ? result : null;
}

function endedTimestamp(game) {
  return timestamp(game?.endedAt || game?.updatedAt || game?.startedAt);
}

function roundedAverage(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function durationSeconds(game) {
  const stored = Number(game?.durationSeconds);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  const started = timestamp(game?.startedAt);
  const ended = timestamp(game?.endedAt);
  return started !== null && ended !== null && ended > started ? Math.round((ended - started) / 1000) : 0;
}

function eventTimeline(game) {
  return (Array.isArray(game?.history) ? game.history : [])
    .map(event => ({ at: timestamp(event?.at), text: String(event?.text || '').trim() }))
    .filter(event => event.at !== null && event.text)
    .sort((left, right) => left.at - right.at);
}

function validSegment(start, end) {
  return start !== null && end !== null && end > start ? Math.round((end - start) / 1000) : 0;
}

function phaseSegments(game) {
  const timeline = eventTimeline(game);
  const days = new Map();
  const nights = new Map();
  timeline.forEach(event => {
    const dayMatch = event.text.match(/^Починається день\s+(\d+)\./i);
    const nightMatch = event.text.match(/^Настає ніч\s+(\d+)\./i);
    if (dayMatch && !days.has(Number(dayMatch[1]))) days.set(Number(dayMatch[1]), event.at);
    if (nightMatch && !nights.has(Number(nightMatch[1]))) nights.set(Number(nightMatch[1]), event.at);
  });

  const firstDay = days.size ? Math.min(...days.values()) : null;
  const setup = validSegment(timestamp(game?.startedAt), firstDay);
  const day = [];
  const night = [];
  days.forEach((start, number) => {
    const length = validSegment(start, nights.get(number) ?? null);
    if (length) day.push(length);
  });
  nights.forEach((start, number) => {
    const length = validSegment(start, days.get(number + 1) ?? timestamp(game?.endedAt));
    if (length) night.push(length);
  });
  return { setup: setup ? [setup] : [], day, night };
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthBuckets(games, now, count = 6) {
  const current = new Date(now);
  const buckets = Array.from({ length: count }, (_, reverseIndex) => {
    const index = count - reverseIndex - 1;
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    return { key: dateKey(date), year: date.getFullYear(), month: date.getMonth(), games: 0, durations: [] };
  });
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
  games.forEach(game => {
    const at = endedTimestamp(game);
    if (at === null) return;
    const bucket = byKey.get(dateKey(new Date(at)));
    if (!bucket) return;
    bucket.games += 1;
    const duration = durationSeconds(game);
    if (duration) bucket.durations.push(duration);
  });
  return buckets.map(bucket => ({
    key: bucket.key,
    year: bucket.year,
    month: bucket.month,
    games: bucket.games,
    averageSeconds: roundedAverage(bucket.durations)
  }));
}

function venueRows(games) {
  const venues = new Map();
  games.forEach(game => {
    const name = String(game?.venue || '').trim() || 'Без зазначеного місця';
    const key = name.toLocaleLowerCase('uk');
    if (!venues.has(key)) venues.set(key, { name, games: 0, redWins: 0, blackWins: 0, draws: 0, durations: [] });
    const row = venues.get(key);
    row.games += 1;
    if (game.winner === 'red') row.redWins += 1;
    else if (game.winner === 'black') row.blackWins += 1;
    else if (game.winner === 'draw') row.draws += 1;
    const duration = durationSeconds(game);
    if (duration) row.durations.push(duration);
  });
  return [...venues.values()]
    .map(row => ({
      name: row.name,
      games: row.games,
      redWinRate: Math.round(row.redWins / row.games * 100),
      blackWinRate: Math.round(row.blackWins / row.games * 100),
      draws: row.draws,
      averageSeconds: roundedAverage(row.durations)
    }))
    .sort((left, right) => right.games - left.games || left.name.localeCompare(right.name, 'uk'));
}

function playerIdentity(seat) {
  const profileId = String(seat?.profileId || '').trim();
  if (profileId) return `profile:${profileId}`;
  const name = String(seat?.name || '').trim().toLocaleLowerCase('uk');
  return name ? `name:${name}` : '';
}

function peakValue(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0] || [null, 0];
}

export function filterGamesByPeriod(games, period = 'all', now = Date.now()) {
  const days = STAT_PERIODS[period] ?? 0;
  const cutoff = days ? now - days * DAY_MS : null;
  return (Array.isArray(games) ? games : []).filter(game => {
    if (game?.status && game.status !== 'finished') return false;
    if (cutoff === null) return true;
    const at = endedTimestamp(game);
    return at !== null && at >= cutoff && at <= now;
  });
}

export function gameActivityComparison(games, now = Date.now()) {
  const source = Array.isArray(games) ? games : [];
  const countWindow = (fromDays, toDays) => source.filter(game => {
    const at = endedTimestamp(game);
    return at !== null && at >= now - toDays * DAY_MS && at < now - fromDays * DAY_MS;
  }).length;
  const current7 = countWindow(0, 7);
  const previous7 = countWindow(7, 14);
  const current30 = countWindow(0, 30);
  const previous30 = countWindow(30, 60);
  return {
    current7,
    previous7,
    delta7: current7 - previous7,
    current30,
    previous30,
    delta30: current30 - previous30
  };
}

export function buildGameStatistics(games, { now = Date.now(), monthCount = 6 } = {}) {
  const source = (Array.isArray(games) ? games : []).filter(game => !game?.status || game.status === 'finished');
  const durations = source.map(durationSeconds).filter(Boolean);
  const days = source.map(game => Number(game?.day)).filter(value => Number.isFinite(value) && value >= 1);
  const winners = {
    red: source.filter(game => game?.winner === 'red').length,
    black: source.filter(game => game?.winner === 'black').length,
    draw: source.filter(game => game?.winner === 'draw').length
  };
  const identities = new Set(source.flatMap(game => Array.isArray(game?.seats) ? game.seats.map(playerIdentity) : []).filter(Boolean));
  const faults = source.flatMap(game => Array.isArray(game?.seats) ? game.seats.map(seat => Number(seat?.faults) || 0) : []);
  const disqualifications = source.flatMap(game => Array.isArray(game?.seats) ? game.seats : [])
    .filter(seatIsDisqualified).length;

  const phaseSamples = { setup: [], day: [], night: [] };
  source.forEach(game => {
    const segments = phaseSegments(game);
    phaseSamples.setup.push(...segments.setup);
    phaseSamples.day.push(...segments.day);
    phaseSamples.night.push(...segments.night);
  });

  const starts = source.map(game => timestamp(game?.startedAt)).filter(value => value !== null).sort((left, right) => left - right);
  const startGaps = starts.slice(1).map((value, index) => Math.round((value - starts[index]) / 1000)).filter(value => value > 0);
  const startedDates = starts.map(value => new Date(value));
  const [peakWeekday, peakWeekdayGames] = peakValue(startedDates.map(date => date.getDay()));
  const [peakStartWindow, peakStartWindowGames] = peakValue(startedDates.map(date => Math.floor(date.getHours() / 6)));
  const gameCount = source.length;

  return {
    summary: {
      games: gameCount,
      redWins: winners.red,
      blackWins: winners.black,
      draws: winners.draw,
      redWinRate: gameCount ? Math.round(winners.red / gameCount * 100) : 0,
      blackWinRate: gameCount ? Math.round(winners.black / gameCount * 100) : 0,
      drawRate: gameCount ? Math.round(winners.draw / gameCount * 100) : 0,
      totalSeconds: durations.reduce((sum, value) => sum + value, 0),
      averageSeconds: roundedAverage(durations),
      medianSeconds: median(durations),
      shortestSeconds: durations.length ? Math.min(...durations) : 0,
      longestSeconds: durations.length ? Math.max(...durations) : 0,
      durationSampleCount: durations.length,
      averageDays: days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length * 10) / 10 : 0,
      maxDays: days.length ? Math.max(...days) : 0,
      uniquePlayers: identities.size,
      uniqueVenues: new Set(source.map(game => String(game?.venue || '').trim()).filter(Boolean).map(name => name.toLocaleLowerCase('uk'))).size,
      averageFaults: source.length ? Math.round(faults.reduce((sum, value) => sum + value, 0) / source.length * 10) / 10 : 0,
      disqualifications
    },
    phases: {
      setup: { averageSeconds: roundedAverage(phaseSamples.setup), samples: phaseSamples.setup.length },
      day: { averageSeconds: roundedAverage(phaseSamples.day), samples: phaseSamples.day.length },
      night: { averageSeconds: roundedAverage(phaseSamples.night), samples: phaseSamples.night.length }
    },
    cadence: {
      averageGapSeconds: roundedAverage(startGaps),
      maxGapSeconds: startGaps.length ? Math.max(...startGaps) : 0,
      gapSamples: startGaps.length,
      peakWeekday,
      peakWeekdayGames,
      peakStartWindow,
      peakStartWindowGames
    },
    months: monthBuckets(source, now, monthCount),
    venues: venueRows(source)
  };
}
import { seatIsDisqualified } from './player-ranking.js';
