import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGameStatistics, filterGamesByPeriod, gameActivityComparison } from '../src/game-statistics.js';

const NOW = Date.parse('2026-08-16T20:00:00.000Z');

function game({
  id, startedAt, endedAt, durationSeconds, winner = 'red', day = 2, venue = 'Enjoy', seats = [], history = []
}) {
  return { id, status: 'finished', startedAt, endedAt, durationSeconds, winner, day, venue, seats, history };
}

const games = [
  game({
    id: 'august-red',
    startedAt: '2026-08-10T17:00:00.000Z',
    endedAt: '2026-08-10T18:00:00.000Z',
    durationSeconds: 3600,
    winner: 'red',
    day: 3,
    seats: [{ profileId: 'one', name: 'Один', faults: 1 }, { name: 'Гість', faults: 2, eliminatedReason: '4-й фол' }],
    history: [
      { at: '2026-08-10T17:10:00.000Z', text: 'Починається день 1.' },
      { at: '2026-08-10T17:30:00.000Z', text: 'Настає ніч 1.' },
      { at: '2026-08-10T17:40:00.000Z', text: 'Починається день 2.' },
      { at: '2026-08-10T17:55:00.000Z', text: 'Настає ніч 2.' }
    ]
  }),
  game({
    id: 'july-black',
    startedAt: '2026-07-10T17:00:00.000Z',
    endedAt: '2026-07-10T18:30:00.000Z',
    durationSeconds: 5400,
    winner: 'black',
    day: 4,
    seats: [{ profileId: 'one', name: 'Один', faults: 0 }, { profileId: 'two', name: 'Два', faults: 1 }]
  }),
  game({
    id: 'may-draw',
    startedAt: '2026-05-01T12:00:00.000Z',
    endedAt: '2026-05-01T12:30:00.000Z',
    durationSeconds: 1800,
    winner: 'draw',
    day: 1,
    venue: 'Інший клуб',
    seats: [{ profileId: 'three', name: 'Три', faults: 0 }]
  })
];

test('filters finished games by the selected rolling period', () => {
  assert.deepEqual(filterGamesByPeriod(games, '30d', NOW).map(item => item.id), ['august-red']);
  assert.deepEqual(filterGamesByPeriod(games, '90d', NOW).map(item => item.id), ['august-red', 'july-black']);
  assert.equal(filterGamesByPeriod(games, 'all', NOW).length, 3);
});

test('builds result, duration, day, player and discipline summaries', () => {
  const { summary } = buildGameStatistics(games, { now: NOW });
  assert.deepEqual(summary, {
    games: 3,
    redWins: 1,
    blackWins: 1,
    draws: 1,
    redWinRate: 33,
    blackWinRate: 33,
    drawRate: 33,
    totalSeconds: 10800,
    averageSeconds: 3600,
    medianSeconds: 3600,
    shortestSeconds: 1800,
    longestSeconds: 5400,
    durationSampleCount: 3,
    averageDays: 2.7,
    maxDays: 4,
    uniquePlayers: 4,
    uniqueVenues: 2,
    averageFaults: 1.3,
    disqualifications: 1
  });
});

test('derives setup, day and night intervals only from timestamped protocol events', () => {
  const { phases } = buildGameStatistics(games, { now: NOW });
  assert.deepEqual(phases.setup, { averageSeconds: 600, samples: 1 });
  assert.deepEqual(phases.day, { averageSeconds: 1050, samples: 2 });
  assert.deepEqual(phases.night, { averageSeconds: 450, samples: 2 });
});

test('groups venue and six-month trend data and compares recent activity', () => {
  const statistics = buildGameStatistics(games, { now: NOW });
  assert.deepEqual(statistics.months.map(item => item.games), [0, 0, 1, 0, 1, 1]);
  assert.deepEqual(statistics.venues.map(item => ({ name: item.name, games: item.games })), [
    { name: 'Enjoy', games: 2 },
    { name: 'Інший клуб', games: 1 }
  ]);
  assert.deepEqual(gameActivityComparison(games, NOW), {
    current7: 1,
    previous7: 0,
    delta7: 1,
    current30: 1,
    previous30: 1,
    delta30: 0
  });
});
