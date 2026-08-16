import assert from 'node:assert/strict';
import { normalizeTelegramUsername, telegramLoginAuth, telegramManualProfile } from '../src/telegram-profile.js';

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

let openedTelegramUrl = '';
const fakePage = {
  location: { origin: 'https://mafia-cafe.web.app' },
  open(url) {
    openedTelegramUrl = String(url);
    return { focus() {} };
  }
};
const originalOpen = fakePage.open;
telegramLoginAuth({
  auth(_options, _callback) {
    fakePage.open('https://oauth.telegram.org/auth?response_type=post_message&client_id=123456789', 'telegram_oidc_login', 'popup');
  }
}, { client_id: 123456789 }, () => {}, { page: fakePage });
assert.equal(new URL(openedTelegramUrl).searchParams.get('origin'), 'https://mafia-cafe.web.app');
assert.equal(fakePage.open, originalOpen);

console.log('Telegram profile helpers passed.');
