import test from 'node:test';
import assert from 'node:assert/strict';
import { isIosDevice, isStandalonePwa, pwaInstallMode, shouldUseMobileAuthRedirect } from '../src/pwa.js';

const iphone = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5
};

test('detects iPhone and touch-based iPadOS', () => {
  assert.equal(isIosDevice(iphone), true);
  assert.equal(isIosDevice({ userAgent: 'Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

test('recognizes standalone mode on iOS and through display-mode', () => {
  assert.equal(isStandalonePwa({ navigatorLike: { standalone: true } }), true);
  assert.equal(isStandalonePwa({ navigatorLike: {}, matchMediaLike: query => ({ matches: query === '(display-mode: standalone)' }) }), true);
  assert.equal(isStandalonePwa({ navigatorLike: {}, matchMediaLike: () => ({ matches: false }) }), false);
});

test('offers an iOS guide when beforeinstallprompt is unavailable', () => {
  assert.equal(pwaInstallMode({ navigatorLike: iphone, matchMediaLike: () => ({ matches: false }) }), 'ios-guide');
  assert.equal(pwaInstallMode({ deferredPrompt: { prompt() {} }, navigatorLike: {}, matchMediaLike: () => ({ matches: false }) }), 'native');
  assert.equal(pwaInstallMode({ navigatorLike: { ...iphone, standalone: true } }), 'installed');
});

test('prefers redirect authentication only for mobile users on the Firebase host', () => {
  assert.equal(shouldUseMobileAuthRedirect({ navigatorLike: iphone, authDomain: 'mafia-cafe.web.app', locationLike: { hostname: 'mafia-cafe.web.app' } }), true);
  assert.equal(shouldUseMobileAuthRedirect({ navigatorLike: iphone, authDomain: 'mafia-cafe.web.app', locationLike: { hostname: 'somnit-hub.github.io' } }), false);
  assert.equal(shouldUseMobileAuthRedirect({ navigatorLike: { userAgent: 'Desktop Chrome' }, authDomain: 'mafia-cafe.web.app', locationLike: { hostname: 'mafia-cafe.web.app' } }), false);
});
