import assert from 'node:assert/strict';
import {
  consumeSeatedPlayers, lineupStatus, normalizeLineup,
  remapLineupPlayers, toggleLineupPlayer
} from '../src/lineup.js';

assert.deepEqual(normalizeLineup(['p1', 'p1', '', null, 'p2']), ['p1', 'p2']);
assert.deepEqual(toggleLineupPlayer(['p1'], 'p2'), ['p1', 'p2']);
assert.deepEqual(toggleLineupPlayer(['p1', 'p2'], 'p1'), ['p2']);

assert.deepEqual(lineupStatus(['p1', 'p2', 'p3']), {
  total: 3, atTable: 3, waiting: 0, temporary: 7
});
assert.deepEqual(lineupStatus(Array.from({ length: 15 }, (_, index) => `p${index + 1}`)), {
  total: 15, atTable: 10, waiting: 5, temporary: 0
});

const queue = Array.from({ length: 15 }, (_, index) => `p${index + 1}`);
const seats = queue.slice(0, 10).map(profileId => ({ profileId }));
assert.deepEqual(consumeSeatedPlayers(queue, seats), ['p11', 'p12', 'p13', 'p14', 'p15']);
assert.deepEqual(consumeSeatedPlayers(['p1', 'p2', 'p3'], [{ profileId: 'p2' }]), ['p1', 'p3']);

assert.deepEqual(remapLineupPlayers(['local', 'google_1'], new Map([
  ['local', 'google_1']
])), ['google_1']);

console.log('lineup tests passed');
