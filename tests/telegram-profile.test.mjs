import assert from 'node:assert/strict';
import { normalizeTelegramUsername, telegramManualProfile } from '../src/telegram-profile.js';

assert.equal(normalizeTelegramUsername('@Maria_Enjoy'), 'maria_enjoy');
assert.equal(normalizeTelegramUsername('https://t.me/Maria_Enjoy?start=profile'), 'maria_enjoy');
assert.equal(normalizeTelegramUsername('t.me/Maria_Enjoy'), 'maria_enjoy');
assert.equal(normalizeTelegramUsername('bad-name'), '');
assert.equal(normalizeTelegramUsername('abcd'), '');

assert.deepEqual(telegramManualProfile('@Manual_User'), {
  telegramUsername: 'manual_user',
  telegramUserId: '',
  telegramDisplayName: '',
  telegramPhotoURL: '',
  telegramVerified: false,
  telegramLinkedAt: ''
});

console.log('Telegram profile helpers passed.');
