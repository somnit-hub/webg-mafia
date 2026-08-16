const TELEGRAM_PROFILE_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/telegram-profile';
const TELEGRAM_LOGIN_SDK = 'https://oauth.telegram.org/js/telegram-login.js?6';

let sdkPromise = null;

export function normalizeTelegramUsername(value) {
  let username = String(value || '').trim();
  username = username.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, '');
  username = username.split(/[/?#]/, 1)[0].replace(/^@+/, '').trim();
  return /^[a-zA-Z0-9_]{5,32}$/.test(username) ? username.toLowerCase() : '';
}

export function telegramManualProfile(value) {
  return {
    telegramUsername: normalizeTelegramUsername(value),
    telegramUserId: '',
    telegramDisplayName: '',
    telegramPhotoURL: '',
    telegramVerified: false,
    telegramLinkedAt: ''
  };
}

export function telegramLoginAuth(login, options, callback, { page = globalThis } = {}) {
  if (!login?.auth) throw new Error('Telegram Login не завантажився');
  const originalOpen = page?.open;
  const pageOrigin = String(page?.location?.origin || '').trim();
  const pagePathname = String(page?.location?.pathname || '/').trim();
  if (typeof originalOpen !== 'function' || !/^https?:\/\//i.test(pageOrigin)) {
    return login.auth(options, callback);
  }

  page.open = function openTelegramLogin(url, target, features) {
    let nextUrl = url;
    try {
      const requestUrl = new URL(String(url), pageOrigin);
      if (requestUrl.origin === 'https://oauth.telegram.org' && requestUrl.pathname === '/auth') {
        const redirectUrl = new URL(pageOrigin);
        redirectUrl.pathname = pagePathname || '/';
        requestUrl.searchParams.set('origin', pageOrigin);
        requestUrl.searchParams.set('redirect_uri', redirectUrl.toString());
        nextUrl = requestUrl.toString();
      }
    } catch {
      // Let the browser handle an unexpected URL exactly as the Telegram SDK supplied it.
    }
    return originalOpen.call(page, nextUrl, target, features);
  };

  try {
    return login.auth(options, callback);
  } finally {
    page.open = originalOpen;
  }
}

function loadTelegramLoginSdk() {
  if (globalThis.Telegram?.Login?.auth) return Promise.resolve(globalThis.Telegram.Login);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${TELEGRAM_LOGIN_SDK.split('?')[0]}"]`);
    const script = existing || document.createElement('script');
    const onReady = () => globalThis.Telegram?.Login?.auth
      ? resolve(globalThis.Telegram.Login)
      : reject(new Error('Telegram Login не завантажився'));
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => reject(new Error('Не вдалося завантажити Telegram Login')), { once: true });
    if (!existing) {
      script.src = TELEGRAM_LOGIN_SDK;
      script.async = true;
      document.head.append(script);
    } else if (globalThis.Telegram?.Login?.auth) onReady();
  }).catch(error => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

async function telegramRequest(path, idToken, options = {}) {
  const response = await fetch(`${TELEGRAM_PROFILE_ENDPOINT}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не вдалося підключити Telegram');
  return result;
}

export async function prepareTelegramProfileConnection({ idToken, testMode = false } = {}) {
  if (testMode) throw new Error('Автоматичне підключення Telegram недоступне в тестовому режимі');
  if (!idToken) throw new Error('Потрібен повторний Google-вхід');
  const [config] = await Promise.all([
    telegramRequest('/config', idToken),
    loadTelegramLoginSdk()
  ]);
  if (!config.clientId || !config.nonce) throw new Error('Telegram Login ще не налаштовано');
  return { clientId: String(config.clientId), nonce: String(config.nonce), idToken };
}

export function connectPreparedTelegramProfile(prepared, { language = 'uk', timeoutMs = 120000 } = {}) {
  const login = globalThis.Telegram?.Login;
  if (!login?.auth || !prepared?.clientId || !prepared?.nonce || !prepared?.idToken) {
    return Promise.reject(new Error('Підключення Telegram ще готується'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Час підключення Telegram вичерпано')), timeoutMs);
    try {
      telegramLoginAuth(login, {
        client_id: Number(prepared.clientId),
        scope: ['profile'],
        lang: ['uk', 'en', 'it', 'fr'].includes(language) ? language : 'uk',
        nonce: prepared.nonce
      }, async result => {
        if (result?.error) return finish(reject, new Error(String(result.error)));
        if (!result?.id_token) return finish(reject, new Error('Підключення Telegram скасовано'));
        try {
          const profile = await telegramRequest('/verify', prepared.idToken, {
            method: 'POST',
            body: { idToken: result.id_token }
          });
          finish(resolve, profile);
        } catch (error) {
          finish(reject, error);
        }
      });
    } catch (error) {
      finish(reject, error);
    }
  });
}
