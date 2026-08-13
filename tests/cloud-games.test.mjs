import assert from 'node:assert/strict';
import test from 'node:test';
import { createActiveGameDocument, createFinishedGameDocument } from '../src/cloud-games.js';

function finishedGame() {
  return {
    id: 'game_test',
    title: 'Тестова гра',
    venue: 'Enjoy',
    notes: 'Приватна нотатка ведучого',
    startedAt: '2026-08-11T17:00:00.000Z',
    endedAt: '2026-08-11T18:00:00.000Z',
    updatedAt: '2026-08-11T18:00:00.000Z',
    status: 'finished',
    winner: 'red',
    durationSeconds: 3600,
    day: 3,
    night: { target: 4, sheriffCheck: 8 },
    settings: { speech: 60 },
    seats: Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      profileId: index === 0 ? 'google_player' : `local_${index}`,
      name: `Гравець ${index + 1}`,
      avatar: 'data:image/webp;base64,private',
      role: index === 0 ? 'sheriff' : index < 3 ? 'mafia' : 'citizen',
      status: 'alive',
      faults: 0,
      eliminatedReason: ''
    })),
    history: [{
      at: '2026-08-11T17:30:00.000Z',
      time: '20:30',
      text: 'Шериф перевіряє №2: чорний.',
      secret: true
    }]
  };
}

test('shared archive publishes only the finished sanitized protocol', () => {
  const document = createFinishedGameDocument(
    { uid: 'host_uid', googleName: 'Google Host' },
    { displayName: 'Ведучий Enjoy', nickname: 'Пан Ведучий' },
    finishedGame()
  );

  assert.equal(document.ownerUid, 'host_uid');
  assert.equal(document.hostName, 'Пан Ведучий');
  assert.equal(document.seats.length, 10);
  assert.equal(document.history.length, 1);
  assert.equal(document.history[0].text, 'Шериф перевіряє №2: чорний.');
  assert.equal('secret' in document.history[0], false);
  assert.equal(document.seats.some(seat => 'avatar' in seat), false);
  assert.equal('notes' in document, false);
  assert.equal('night' in document, false);
  assert.equal('settings' in document, false);
});

test('shared archive falls back to the host display name when nickname is empty', () => {
  const document = createFinishedGameDocument(
    { uid: 'host_uid', googleName: 'Google Host' },
    { displayName: 'Ведучий Enjoy', nickname: '  ' },
    finishedGame()
  );
  assert.equal(document.hostName, 'Ведучий Enjoy');
});

test('active games cannot enter the shared archive', () => {
  const game = finishedGame();
  game.status = 'active';
  assert.throws(
    () => createFinishedGameDocument({ uid: 'host_uid' }, {}, game),
    /лише завершену гру/
  );
});

test('live game projection contains public state without roles or night targets', () => {
  const game = finishedGame();
  game.status = 'active';
  game.phase = 'day';
  game.subphase = 'speeches';
  game.endedAt = null;
  game.nominations = [2, 5];
  game.speakerIndex = 1;
  game.speakerOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  game.lastWordSeat = null;
  game.vote = { tied: [2, 5] };
  game.night = { step: 3, target: 4, donCheck: 7, sheriffCheck: 8 };
  game.timer = { remaining: 42, running: true, purpose: 'speech', endsAt: 1786622000000 };
  game.seats[1].noVote = true;

  const document = createActiveGameDocument(
    { uid: 'host_uid', googleName: 'Google Host' },
    { displayName: 'Ведучий Enjoy', nickname: 'Пан Ведучий' },
    game
  );

  assert.equal(document.status, 'active');
  assert.equal(document.phase, 'day');
  assert.equal(document.hostName, 'Пан Ведучий');
  assert.equal(document.seats.length, 10);
  assert.equal(document.seats[1].noVote, true);
  assert.equal(document.timer.endsAt, 1786622000000);
  const serialized = JSON.stringify(document);
  for (const privateField of ['notes', 'history', 'profileId', 'role', 'avatar', 'target', 'donCheck', 'sheriffCheck', 'settings']) {
    assert.equal(serialized.includes(`"${privateField}"`), false, `${privateField} must stay private`);
  }
});

test('finished games cannot enter the live list', () => {
  assert.throws(
    () => createActiveGameDocument({ uid: 'host_uid' }, {}, finishedGame()),
    /лише активну гру/
  );
});

test('shared archive supports an official draw result', () => {
  const game = finishedGame();
  game.winner = 'draw';
  const document = createFinishedGameDocument({ uid: 'host_uid' }, {}, game);
  assert.equal(document.winner, 'draw');
});
