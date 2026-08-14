export function isIosDevice(navigatorLike = {}) {
  const userAgent = String(navigatorLike.userAgent || '');
  return /iPhone|iPad|iPod/i.test(userAgent)
    || (navigatorLike.platform === 'MacIntel' && Number(navigatorLike.maxTouchPoints) > 1);
}

export function isStandalonePwa({ navigatorLike = {}, matchMediaLike = null } = {}) {
  if (navigatorLike.standalone === true) return true;
  if (typeof matchMediaLike !== 'function') return false;
  return Boolean(
    matchMediaLike('(display-mode: standalone)')?.matches
    || matchMediaLike('(display-mode: fullscreen)')?.matches
  );
}

export function pwaInstallMode({ deferredPrompt = null, navigatorLike = {}, matchMediaLike = null } = {}) {
  if (isStandalonePwa({ navigatorLike, matchMediaLike })) return 'installed';
  if (deferredPrompt) return 'native';
  if (isIosDevice(navigatorLike)) return 'ios-guide';
  return 'unavailable';
}

export function shouldUseMobileAuthRedirect({ navigatorLike = {}, authDomain = '', locationLike = {} } = {}) {
  const mobile = isIosDevice(navigatorLike) || /Android/i.test(String(navigatorLike.userAgent || ''));
  const sameAuthOrigin = Boolean(authDomain) && String(locationLike.hostname || '').toLowerCase() === String(authDomain).toLowerCase();
  return mobile && sameAuthOrigin;
}
