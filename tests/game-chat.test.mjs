import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeAuthorizedPlayerUids, authorizedGameParticipantUids, canJoinActiveGameChat, createGameChatDocument,
  gameChatFromSnapshot, gameChatMessageFromSnapshot, telegramDiscussionLinks
} from '../src/game-chat.js';

function finishedGame() {
  return {
    id: 'game_chat_test',
    title: 'Enjoy · 16 серпня · 20:00',
    venue: 'Enjoy',
    status: 'finished',
    endedAt: '2026-08-16T20:45:00.000Z',
    seats: [
      { number: 1, profileId: 'google_player_one', cloudUid: 'player_one', name: 'Один' },
      { number: 2, profileId: 'google_player_two', name: 'Два' },
      { number: 3, profileId: '', name: 'Гість' },
      { number: 4, profileId: 'google_player_one', name: 'Дублікат' }
    ]
  };
}

function activeGame() {
  const game = finishedGame();
  game.status = 'active';
  game.startedAt = '2026-08-16T20:00:00.000Z';
  game.endedAt = null;
  game.seats[1].status = 'dead';
  game.cloudOwnerUid = 'host_uid';
  return game;
}

test('game chat includes the host and every unique authorized seated player', () => {
  const participantUids = authorizedGameParticipantUids({ uid: 'host_uid' }, finishedGame());
  assert.deepEqual(participantUids, ['host_uid', 'player_one', 'player_two']);
});

test('finished game chat includes every authorized participant and excludes guests', () => {
  const document = createGameChatDocument(
    { uid: 'host_uid', googleName: 'Google Host' },
    { nickname: 'Ведучий' },
    finishedGame()
  );
  assert.equal(document.id, 'game_chat_test');
  assert.equal(document.ownerUid, 'host_uid');
  assert.equal(document.hostName, 'Ведучий');
  assert.deepEqual(document.participantUids, ['host_uid', 'player_one', 'player_two']);
  assert.equal(document.status, 'finished');
  assert.equal(document.schemaVersion, 2);
});

test('active game chat starts with the host while tracking who may join', () => {
  const game = activeGame();
  const document = createGameChatDocument(
    { uid: 'host_uid', googleName: 'Google Host' },
    { nickname: 'Ведучий' },
    game
  );
  assert.deepEqual(document.participantUids, ['host_uid']);
  assert.equal(document.status, 'active');
  assert.equal(document.startedAt, '2026-08-16T20:00:00.000Z');
  assert.equal(document.endedAt, '');
  assert.deepEqual(activeAuthorizedPlayerUids(game), ['player_one']);
  assert.equal(canJoinActiveGameChat({ uid: 'host_uid' }, game), true);
  assert.equal(canJoinActiveGameChat({ uid: 'player_one' }, game), false);
  assert.equal(canJoinActiveGameChat({ uid: 'player_two' }, game), true);
  assert.equal(canJoinActiveGameChat({ uid: 'viewer_uid' }, game), true);
});

test('Telegram discussion exposes native group creation and a prepared share link', () => {
  const links = telegramDiscussionLinks(finishedGame(), 'https://mafia-cafe.web.app/');
  assert.equal(links.createGroup, 'tg://new/group');
  assert.equal(links.gameUrl, 'https://mafia-cafe.web.app/#/game/game_chat_test');
  const shared = new URL(links.share);
  assert.equal(shared.origin, 'https://t.me');
  assert.equal(shared.pathname, '/share/url');
  assert.equal(shared.searchParams.get('url'), links.gameUrl);
  assert.match(shared.searchParams.get('text'), /Enjoy · 16 серпня/);
});

test('chat snapshots normalize timestamps and pending messages', () => {
  const chat = gameChatFromSnapshot({
    id: 'game_chat_test',
    data: () => ({
      gameId: 'game_chat_test', ownerUid: 'host_uid', hostName: 'Ведучий',
      participantUids: ['host_uid', 'player_one'], gameTitle: 'Гра', venue: 'Enjoy',
      status: 'finished', startedAt: '2026-08-16T20:00:00.000Z',
      endedAt: '2026-08-16T20:45:00.000Z', schemaVersion: 2,
      createdAt: { seconds: 100, nanoseconds: 500000000 }
    })
  });
  const message = gameChatMessageFromSnapshot({
    id: 'message_one',
    data: () => ({
      gameId: 'game_chat_test', senderUid: 'player_one', senderName: 'Один', text: 'Гарна гра',
      clientCreatedAt: '2026-08-16T20:46:00.000Z', createdAt: null
    }),
    metadata: { hasPendingWrites: true }
  });
  assert.equal(chat.createdAt, 100500);
  assert.equal(chat.status, 'finished');
  assert.equal(message.createdAt, Date.parse('2026-08-16T20:46:00.000Z'));
  assert.equal(message.pending, true);
});
