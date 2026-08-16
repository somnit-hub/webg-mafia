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
  location: { origin: 'https://mafia-cafe.web.app', pathname: '/' },
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
assert.equal(new URL(openedTelegramUrl).searchParams.get('redirect_uri'), 'https://mafia-cafe.web.app/');
assert.equal(fakePage.open, originalOpen);

openedTelegramUrl = '';
const githubPage = {
  location: { origin: 'https://somnit-hub.github.io', pathname: '/webg-mafia/' },
  open(url) {
    openedTelegramUrl = String(url);
    return { focus() {} };
  }
};
telegramLoginAuth({
  auth(_options, _callback) {
    githubPage.open('https://oauth.telegram.org/auth?response_type=post_message&client_id=123456789&redirect_uri=https%3A%2F%2Fstale.example%2F', 'telegram_oidc_login', 'popup');
  }
}, { client_id: 123456789 }, () => {}, { page: githubPage });
assert.equal(new URL(openedTelegramUrl).searchParams.get('origin'), 'https://somnit-hub.github.io');
assert.equal(new URL(openedTelegramUrl).searchParams.get('redirect_uri'), 'https://somnit-hub.github.io/webg-mafia/');

console.log('Telegram profile helpers passed.');
