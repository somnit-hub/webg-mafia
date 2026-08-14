import assert from 'node:assert/strict';
import test from 'node:test';
import { sortDirectoryPlayers } from '../src/player-directory.js';

test('directory orders online Google profiles, offline Google profiles, then guests by game count', () => {
  const players = [
    { id: 'guest-regular', name: 'Гість постійний' },
    { id: 'offline-new', cloudUid: 'uid-offline-new', name: 'Офлайн новий' },
    { id: 'online-new', cloudUid: 'uid-online-new', name: 'Онлайн новий' },
    { id: 'guest-new', name: 'Гість новий' },
    { id: 'offline-regular', cloudUid: 'uid-offline-regular', name: 'Офлайн постійний' },
    { id: 'online-regular', cloudUid: 'uid-online-regular', name: 'Онлайн постійний' }
  ];
  const sorted = sortDirectoryPlayers(players, {
    onlinePlayerIds: new Set(['online-new', 'online-regular']),
    gameCounts: new Map([
      ['online-new', 1], ['online-regular', 8],
      ['offline-new', 2], ['offline-regular', 6],
      ['guest-new', 0], ['guest-regular', 10]
    ])
  });

  assert.deepEqual(sorted.map(player => player.id), [
    'online-regular', 'online-new',
    'offline-regular', 'offline-new',
    'guest-regular', 'guest-new'
  ]);
});

test('directory uses nickname and stable source order to resolve ties', () => {
  const players = [
    { id: 'second', cloudUid: 'uid-2', name: 'Ярема', nickname: 'Бета' },
    { id: 'first', cloudUid: 'uid-1', name: 'Антон', nickname: 'Альфа' },
    { id: 'same-a', name: 'Однаково' },
    { id: 'same-b', name: 'Однаково' }
  ];
  const sorted = sortDirectoryPlayers(players, { gameCounts: new Map(players.map(player => [player.id, 3])) });

  assert.deepEqual(sorted.map(player => player.id), ['first', 'second', 'same-a', 'same-b']);
});
