import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_EMOTIONS, loadGameFeedback, loadGameFeedbackBatch, loadGameFeedbackSummaryBatch, personalPlayerStats, saveGameFeedback } from '../src/game-feedback.js';

const games = [{
  id: 'g2', status: 'finished', winner: 'black', endedAt: '2026-08-13T20:00:00.000Z',
  seats: [{ profileId: 'google_me', role: 'mafia' }]
}, {
  id: 'g1', status: 'finished', winner: 'red', endedAt: '2026-08-12T20:00:00.000Z',
  seats: [{ profileId: 'google_me', role: 'sheriff' }]
}, {
  id: 'other', status: 'finished', winner: 'red', endedAt: '2026-08-11T20:00:00.000Z',
  seats: [{ profileId: 'google_other', role: 'citizen' }]
}];

test('personal statistics include only the selected player history', () => {
  const stats = personalPlayerStats(games, 'google_me');
  assert.equal(stats.games, 2);
  assert.equal(stats.wins, 2);
  assert.equal(stats.winRate, 100);
  assert.equal(stats.favoriteRole, 'mafia');
  assert.deepEqual(stats.history.map(item => item.game.id), ['g2', 'g1']);
});

test('the five playful emotions have stable unique keys', () => {
  assert.equal(GAME_EMOTIONS.length, 5);
  assert.equal(new Set(GAME_EMOTIONS.map(item => item.key)).size, 5);
  assert.deepEqual(GAME_EMOTIONS.map(item => item.icon), ['🤯', '🎭', '🔥', '🤡', '💀']);
});

test('local feedback mode preserves the current private choice', async () => {
  const saved = await saveGameFeedback({ gameId: 'g1', vote: { sentiment: 'up', emotion: 'oscar' }, testMode: true });
  assert.deepEqual(saved.mine, { sentiment: 'up', emotion: 'oscar' });
  const loaded = await loadGameFeedback({ gameId: 'g1', testMode: true });
  assert.deepEqual(loaded.mine, saved.mine);
  assert.equal(loaded.summary.visible, false);
  const batch = await loadGameFeedbackBatch({ gameIds: ['g1', 'g2'], testMode: true });
  assert.deepEqual(batch.g1.mine, saved.mine);
  assert.deepEqual(batch.g2.mine, { sentiment: '', emotion: '' });
  const summaries = await loadGameFeedbackSummaryBatch({ gameIds: ['g1', 'g2'], testMode: true });
  assert.equal(summaries.g1.total, 1);
  assert.equal(summaries.g1.visible, false);
  assert.equal('mine' in summaries.g1, false);
});
