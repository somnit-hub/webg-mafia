import assert from 'node:assert/strict';
import {
  createOwnCommunityProfileFields, profileLastSeenMillis, profileWasRecentlyActive,
  resolveOwnProfilePhotoDataURL
} from '../src/cloud-profiles.js';

const user = {
  uid: 'google-user',
  email: 'player@example.com',
  googleName: 'Google Name',
  googlePhotoURL: 'https://lh3.googleusercontent.com/photo'
};

const customAvatar = 'data:image/webp;base64,AAAA';
const fields = createOwnCommunityProfileFields(user, {
  displayName: 'Марія',
  nickname: 'Кава',
  club: 'Enjoy',
  description: 'Капучино',
  avatar: customAvatar,
  telegramUsername: '@Maria_Enjoy',
  telegramUserId: '987654321',
  telegramDisplayName: 'Марія Enjoy',
  telegramPhotoURL: 'https://cdn4.telesco.pe/file/photo',
  telegramVerified: true,
  telegramLinkedAt: '2026-08-16T12:00:00.000Z',
  discoverable: true,
  updatedAt: '2026-08-13T12:00:00.000Z'
});

assert.equal(fields.photoDataURL, customAvatar);
assert.equal(fields.photoURL, user.googlePhotoURL);
assert.equal(fields.displayName, 'Марія');
assert.equal(fields.telegramUsername, 'maria_enjoy');
assert.equal(fields.telegramVerified, true);
assert.equal(fields.telegramUserId, '987654321');

const manualTelegram = createOwnCommunityProfileFields(user, {
  displayName: 'Марія',
  telegramUsername: 'manual_user',
  telegramUserId: 'forged',
  telegramVerified: true
});
assert.equal(manualTelegram.telegramUsername, 'manual_user');
assert.equal(manualTelegram.telegramVerified, false);
assert.equal(manualTelegram.telegramUserId, '');

const oversized = createOwnCommunityProfileFields(user, {
  displayName: 'Марія',
  avatar: `data:image/webp;base64,${'A'.repeat(350000)}`
});
assert.equal(oversized.photoDataURL, '');

const externalImage = createOwnCommunityProfileFields(user, {
  displayName: 'Марія',
  avatar: 'https://example.com/not-allowed.jpg'
});
assert.equal(externalImage.photoDataURL, '');

const olderLocalAvatar = 'data:image/webp;base64,LOCAL';
assert.equal(resolveOwnProfilePhotoDataURL(olderLocalAvatar, ''), olderLocalAvatar);
assert.equal(
  resolveOwnProfilePhotoDataURL(olderLocalAvatar, 'data:image/webp;base64,REMOTE'),
  'data:image/webp;base64,REMOTE'
);

const now = Date.parse('2026-08-13T12:00:00.000Z');
assert.equal(profileLastSeenMillis({ seconds: now / 1000, nanoseconds: 0 }), now);
assert.equal(profileWasRecentlyActive(now - 120000, now), true);
assert.equal(profileWasRecentlyActive(now - 180000, now), false);
assert.equal(profileWasRecentlyActive(0, now), false);

console.log('Member profile avatar model passed.');
