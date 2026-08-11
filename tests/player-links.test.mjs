import assert from 'node:assert/strict';
import {
  createPlayerLinkFields, isValidPlayerEmail, normalizePlayerEmail, playerLinkId
} from '../src/player-links.js';

assert.equal(normalizePlayerEmail('  Player.Name@Example.COM '), 'player.name@example.com');
assert.equal(isValidPlayerEmail('player@example.com'), true);
assert.equal(isValidPlayerEmail('not-an-email'), false);
assert.equal(playerLinkId({ uid: 'host:one' }, 'player:7'), 'host_one_player_7');

const fields = createPlayerLinkFields(
  { uid: 'host-one', emailVerified: true, googleName: 'Ведучий' },
  { displayName: 'Антон' },
  {
    id: 'player-7',
    name: '  Марія  ',
    nickname: '  Мері  ',
    email: ' MARIA@EXAMPLE.COM ',
    notes: 'Приватна нотатка',
    avatar: 'data:image/webp;base64,private'
  }
);

assert.deepEqual(fields, {
  id: 'host-one_player-7',
  communityId: 'enjoy',
  ownerUid: 'host-one',
  ownerName: 'Антон',
  localPlayerId: 'player-7',
  email: 'maria@example.com',
  playerName: 'Марія',
  nickname: 'Мері',
  status: 'pending',
  claimedUid: '',
  schemaVersion: 1
});
assert.equal('notes' in fields, false);
assert.equal('avatar' in fields, false);
assert.throws(() => createPlayerLinkFields(
  { uid: 'host', emailVerified: false }, {}, { id: 'p', name: 'A', email: 'a@example.com' }
), /підтверджений Google/);

console.log('Player email link model passed.');
