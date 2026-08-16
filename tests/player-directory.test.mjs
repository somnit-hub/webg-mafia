import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHostTransferCandidates, sortDirectoryPlayers } from '../src/player-directory.js';

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

test('host transfer offers every authorized directory user, not only seated players', () => {
  const players = [
    { id: 'host', cloudUid: 'host-uid', name: 'Поточний ведучий' },
    { id: 'seated', cloudUid: 'seated-uid', name: 'Учасниця', contact: 'Enjoy' },
    { id: 'not-seated', cloudUid: 'remote-uid', name: 'Олександр', nickname: 'Саша', contact: 'Інший клуб' },
    { id: 'manual', name: 'Ручний профіль' }
  ];

  const candidates = selectHostTransferCandidates(players, 'host-uid');

  assert.deepEqual(candidates.map(candidate => candidate.uid), ['remote-uid', 'seated-uid']);
  assert.equal(candidates[0].name, 'Саша');
});

test('host transfer search matches name, nickname and club case-insensitively', () => {
  const players = [
    { cloudUid: 'anna-uid', name: 'Анна Коваль', nickname: 'Лисиця', contact: 'Enjoy' },
    { cloudUid: 'bohdan-uid', name: 'Богдан Мельник', nickname: 'Шериф', contact: 'Kyiv Mafia' }
  ];

  assert.deepEqual(selectHostTransferCandidates(players, '', 'АННА').map(item => item.uid), ['anna-uid']);
  assert.deepEqual(selectHostTransferCandidates(players, '', 'шериф').map(item => item.uid), ['bohdan-uid']);
  assert.deepEqual(selectHostTransferCandidates(players, '', 'kyiv mafia').map(item => item.uid), ['bohdan-uid']);
  assert.deepEqual(selectHostTransferCandidates(players, '', 'невідомий').map(item => item.uid), []);
});
