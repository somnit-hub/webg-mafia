import assert from 'node:assert/strict';
import {
  createSharedManualPlayerFields,
  isPersistentManualPlayer,
  manualPlayerDocumentId,
  updateSharedManualPlayerFields
} from '../src/cloud-profiles.js';

const user = { uid: 'host:one', googleName: 'Ведучий' };
const host = { nickname: 'Капучино' };
const player = {
  id: 'player_7',
  name: 'Марія',
  nickname: 'Мері',
  email: 'private@example.com',
  contact: 'Enjoy',
  notes: 'Любить грати шерифом',
  avatar: 'data:image/webp;base64,AAAA',
  updatedAt: '2026-08-12T10:00:00.000Z'
};

assert.equal(manualPlayerDocumentId(user, player.id), 'host_one_player_7');
assert.equal(isPersistentManualPlayer(player), true);
assert.equal(isPersistentManualPlayer({ ...player, autoGuestName: true }), false);
assert.equal(isPersistentManualPlayer({ ...player, source: 'temporary' }), false);
assert.equal(isPersistentManualPlayer({ ...player, linkedCloudUid: 'google-user' }), false);

const shared = createSharedManualPlayerFields(user, host, player);
assert.deepEqual(shared, {
  id: 'host_one_player_7',
  communityId: 'enjoy',
  ownerUid: 'host:one',
  ownerName: 'Капучино',
  localPlayerId: 'player_7',
  displayName: 'Марія',
  nickname: 'Мері',
  club: 'Enjoy',
  description: 'Любить грати шерифом',
  photoDataURL: 'data:image/webp;base64,AAAA',
  profileUpdatedAt: '2026-08-12T10:00:00.000Z',
  schemaVersion: 1
});
assert.equal('email' in shared, false);

const legacyEmailContact = createSharedManualPlayerFields(user, host, {
  ...player,
  contact: 'legacy.private@example.com'
});
assert.equal(legacyEmailContact.club, 'Enjoy');

const tooLargeAvatar = createSharedManualPlayerFields(user, host, {
  ...player,
  avatar: `data:image/webp;base64,${'A'.repeat(350000)}`
});
assert.equal(tooLargeAvatar.photoDataURL, '');

const editedByAnotherHost = updateSharedManualPlayerFields(shared, {
  name: 'Марія Оновлена',
  nickname: 'Еспресо',
  contact: 'Enjoy',
  notes: 'Оновлено іншим ведучим',
  avatar: 'data:image/webp;base64,BBBB',
  updatedAt: '2026-08-13T12:00:00.000Z'
});
assert.equal(editedByAnotherHost.id, shared.id);
assert.equal(editedByAnotherHost.ownerUid, shared.ownerUid);
assert.equal(editedByAnotherHost.ownerName, shared.ownerName);
assert.equal(editedByAnotherHost.localPlayerId, shared.localPlayerId);
assert.equal(editedByAnotherHost.displayName, 'Марія Оновлена');
assert.equal(editedByAnotherHost.nickname, 'Еспресо');
assert.equal(editedByAnotherHost.photoDataURL, 'data:image/webp;base64,BBBB');

console.log('Shared manual profile model passed.');
