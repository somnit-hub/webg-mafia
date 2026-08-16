import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bestMoveScore, canonicalRankingGames, FIIM_RATING_RULES, mafiaGamePoints, mafiaPlayerRankings
} from '../src/player-ranking.js';

function game({ id = 'game', winner = 'red', endedAt = '2026-08-16T20:00:00.000Z', bestMove, history = [], seats } = {}) {
  return { id, status: 'finished', winner, endedAt, bestMove, history, seats };
}

const seats = [
  { number: 1, profileId: 'red_1', name: 'Червоний', role: 'citizen', eliminatedReason: 'нічний постріл' },
  { number: 2, profileId: 'black_1', name: 'Чорний 1', role: 'don', eliminatedReason: '' },
  { number: 3, profileId: 'black_2', name: 'Чорний 2', role: 'mafia', eliminatedReason: '' },
  { number: 4, profileId: 'black_3', name: 'Чорний 3', role: 'mafia', eliminatedReason: '' },
  { number: 5, profileId: 'red_5', name: 'Червоний 5', role: 'sheriff', eliminatedReason: '4-й фол' }
];

test('FIIM game points include the official result, Best Move and disqualification values', () => {
  const result = game({ bestMove: { seat: 1, selected: [2, 3, 4] }, seats });
  assert.deepEqual(FIIM_RATING_RULES, {
    win: 1.3, loss: 0.3, draw: 0, bestMoveTwo: 0.5, bestMoveThree: 0.7,
    disqualification: -0.8, performanceWindow: 100
  });
  assert.deepEqual(bestMoveScore(result, seats[0]), { hits: 3, bonus: 0.7 });
  assert.deepEqual(mafiaGamePoints(result, seats[0]), {
    points: 2, base: 1.3, bestMoveBonus: 0.7, disqualificationPenalty: 0
  });
  assert.equal(mafiaGamePoints(result, seats[1]).points, 0.3);
  assert.equal(mafiaGamePoints(result, seats[4]).points, 0.5);
});

test('two correct black players give a 0.5 Best Move bonus and historic protocols remain countable', () => {
  const result = game({ seats, history: [{ text: 'Кращий хід №1: №2, №3, №5.' }] });
  assert.deepEqual(bestMoveScore(result, seats[0]), { hits: 2, bonus: 0.5 });
  assert.equal(mafiaGamePoints(result, seats[0]).points, 1.8);
});

test('a draw gives zero points regardless of role', () => {
  const result = game({ winner: 'draw', seats });
  assert.equal(mafiaGamePoints(result, seats[0]).points, 0);
  assert.equal(mafiaGamePoints(result, seats[1]).points, 0);
});

test('ranking is ordered by points and exposes FIIM performance coefficient for the last 100 games', () => {
  const games = [
    game({ id: 'red-win', winner: 'red', endedAt: '2026-08-16T20:00:00.000Z', seats: seats.slice(0, 2) }),
    game({ id: 'black-win', winner: 'black', endedAt: '2026-08-15T20:00:00.000Z', seats: seats.slice(0, 2) })
  ];
  const ranking = mafiaPlayerRankings(games, id => ({ id, name: id === 'red_1' ? 'Профіль червоного' : 'Профіль чорного' }));
  assert.deepEqual(ranking.map(row => ({ id: row.player.id, rank: row.rank, points: row.points })), [
    { id: 'red_1', rank: 1, points: 1.6 },
    { id: 'black_1', rank: 1, points: 1.6 }
  ]);
  assert.equal(ranking[0].coefficient, 0.016);
  assert.equal(ranking[0].games, 2);
  assert.equal(ranking[0].winRate, 50);
});

test('performance coefficient ignores games older than the latest 100', () => {
  const playerSeat = [{ number: 1, profileId: 'player', name: 'Гравець', role: 'citizen', eliminatedReason: '' }];
  const games = Array.from({ length: 101 }, (_, index) => game({
    id: `game-${index}`,
    winner: index === 100 ? 'black' : 'red',
    endedAt: new Date(Date.UTC(2026, 7, 16, 20, 0, 0) - index * 86_400_000).toISOString(),
    seats: playerSeat
  }));
  const [ranking] = mafiaPlayerRankings(games);
  assert.equal(ranking.games, 101);
  assert.equal(ranking.coefficient, 1.3);
});

test('ranking prefers the canonical shared protocol over a stale local guest copy', () => {
  const local = game({
    id: 'merged-game',
    seats: [{ number: 1, profileId: 'deleted-guest', name: 'Гість', role: 'citizen', eliminatedReason: '' }]
  });
  const shared = game({
    id: 'merged-game',
    seats: [{ number: 1, profileId: 'google-user', name: 'Гість', role: 'citizen', eliminatedReason: '' }]
  });
  const canonical = canonicalRankingGames([local], [shared]);
  const ranking = mafiaPlayerRankings(canonical, id => ({ id, name: id === 'google-user' ? 'Авторизований' : 'Видалений гість' }));

  assert.equal(canonical[0], shared);
  assert.deepEqual(ranking.map(row => row.player.id), ['google-user']);
  assert.equal(ranking[0].games, 1);
});
