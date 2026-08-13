const DRINKS = Object.freeze({
  coffee: 'Кава',
  tea: 'Чай',
  cappuccino: 'Капучино',
  latte: 'Лате'
});

const ALLOWED_ORIGINS = new Set([
  'https://mafia-cafe.web.app',
  'https://somnit-hub.github.io'
]);

const FEEDBACK_EMOTIONS = new Set(['brain', 'oscar', 'fire', 'circus', 'dead']);
const EMPTY_EMOTIONS = Object.freeze({ brain: 0, oscar: 0, fire: 0, circus: 0, dead: 0 });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function clean(value, maximum = 80) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function orderPayload(body = {}) {
  const item = clean(body.item, 24).toLowerCase();
  if (!DRINKS[item]) throw new HttpError(400, 'Невідома позиція меню');
  return {
    item,
    label: DRINKS[item],
    sender: clean(body.sender, 60) || 'Гість Enjoy',
    game: clean(body.game, 80)
  };
}

export function telegramOrderText(order, email = '') {
  const lines = [
    '☕ <b>Нове замовлення · Enjoy Mafia</b>',
    `Напій: <b>${escapeHtml(order.label)}</b>`,
    `Від: ${escapeHtml(order.sender)}`
  ];
  if (order.game) lines.push(`Гра: ${escapeHtml(order.game)}`);
  if (email) lines.push(`Акаунт: ${escapeHtml(clean(email, 120))}`);
  return lines.join('\n');
}

function localOrigin(origin) {
  return /^http:\/\/(?:localhost|127[.]0[.]0[.]1):\d+$/.test(origin);
}

function originAllowed(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin) || localOrigin(origin);
}

function corsHeaders(origin = '') {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  });
  if (originAllowed(origin) && origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(origin, status, body) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

async function firebaseIdentity(idToken, env) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const result = await response.json().catch(() => ({}));
  const identity = result.users?.[0];
  if (!response.ok || !identity?.localId || identity.disabled) throw new HttpError(401, 'Потрібен повторний Google-вхід');
  if (!identity.emailVerified) throw new HttpError(403, 'Email Google-акаунта не підтверджено');
  return { uid: identity.localId, email: clean(identity.email, 120) };
}

function firestoreValue(field) {
  if (!field || typeof field !== 'object') return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('booleanValue' in field) return Boolean(field.booleanValue);
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in field) {
    return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  }
  return null;
}

async function requireFinishedGameParticipant(gameId, idToken, identity, env) {
  const cleanGameId = clean(gameId, 160);
  if (!cleanGameId) throw new HttpError(400, 'Гру не знайдено');
  const projectId = clean(env.FIREBASE_PROJECT_ID, 120);
  if (!projectId) throw new Error('Firebase project is not configured');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/communities/enjoy/games/${encodeURIComponent(cleanGameId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  const document = await response.json().catch(() => ({}));
  if (response.status === 404) throw new HttpError(404, 'Завершену гру не знайдено');
  if (!response.ok) throw new HttpError(response.status === 403 ? 403 : 502, 'Не вдалося перевірити участь у грі');
  const game = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  if (game.status !== 'finished') throw new HttpError(409, 'Оцінити можна лише завершену гру');
  const profileId = `google_${identity.uid}`;
  if (!(game.seats || []).some(seat => seat?.profileId === profileId)) {
    throw new HttpError(403, 'Оцінювати гру можуть лише її учасники');
  }
  return cleanGameId;
}

function feedbackVote(body = {}) {
  const sentiment = ['up', 'down'].includes(body.sentiment) ? body.sentiment : '';
  const emotion = FEEDBACK_EMOTIONS.has(body.emotion) ? body.emotion : '';
  if (!sentiment && !emotion) throw new HttpError(400, 'Оберіть оцінку або емоцію');
  return { sentiment, emotion };
}

async function feedbackStore(gameId, identity, env, vote = null) {
  const id = env.GAME_FEEDBACK.idFromName(gameId);
  const url = `https://game-feedback.internal/rating?uid=${encodeURIComponent(identity.uid)}`;
  const response = await env.GAME_FEEDBACK.get(id).fetch(url, vote ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: identity.uid, vote })
  } : { method: 'GET' });
  if (!response.ok) throw new Error('Feedback store unavailable');
  return response.json();
}

async function checkRateLimit(identity, env) {
  const id = env.ORDER_LIMITER.idFromName('enjoy-orders-v1');
  const response = await env.ORDER_LIMITER.get(id).fetch('https://order-limiter.internal/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: identity.uid })
  });
  if (response.status === 429) throw new HttpError(429, 'Зачекайте кілька секунд перед наступним замовленням');
  if (!response.ok) throw new Error('Rate limiter unavailable');
}

async function sendTelegram(order, identity, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ORDER_TELEGRAM_CHAT_ID) throw new HttpError(503, 'Telegram-одержувача ще не підключено');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.ORDER_TELEGRAM_CHAT_ID,
      text: telegramOrderText(order, identity.email),
      parse_mode: 'HTML',
      disable_notification: false
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    console.error('Telegram sendMessage failed', { status: response.status });
    throw new HttpError(502, 'Telegram не прийняв замовлення');
  }
}

export async function handleRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin)) return json(origin, 403, { error: 'Недозволений сайт' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json(origin, 200, { ok: true, service: 'enjoy-mafia-orders' });
  if (!['/orders', '/ratings', '/ratings/batch'].includes(url.pathname)) return json(origin, 404, { error: 'Маршрут не знайдено' });
  if (url.pathname === '/orders' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (url.pathname === '/ratings' && !['GET', 'POST'].includes(request.method)) return json(origin, 405, { error: 'Метод не підтримується' });
  if (url.pathname === '/ratings/batch' && request.method !== 'POST') return json(origin, 405, { error: 'Потрібен POST-запит' });
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return json(origin, 413, { error: 'Запит завеликий' });

  try {
    const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, 'Потрібен Google-вхід');
    const identity = await firebaseIdentity(match[1], env);
    if (url.pathname === '/ratings/batch') {
      const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
      const requestedIds = Array.isArray(body.gameIds) ? [...new Set(body.gameIds.map(value => clean(value, 160)).filter(Boolean))] : [];
      if (!requestedIds.length || requestedIds.length > 25) throw new HttpError(400, 'За один раз можна перевірити від 1 до 25 ігор');
      const gameIds = await Promise.all(requestedIds.map(gameId => requireFinishedGameParticipant(gameId, match[1], identity, env)));
      const results = await Promise.all(gameIds.map(gameId => feedbackStore(gameId, identity, env)));
      return json(origin, 200, { ratings: Object.fromEntries(gameIds.map((gameId, index) => [gameId, results[index]])) });
    }
    if (url.pathname === '/ratings') {
      const body = request.method === 'POST'
        ? await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); })
        : {};
      const gameId = await requireFinishedGameParticipant(
        request.method === 'GET' ? url.searchParams.get('gameId') : body.gameId,
        match[1],
        identity,
        env
      );
      const result = await feedbackStore(gameId, identity, env, request.method === 'POST' ? feedbackVote(body) : null);
      return json(origin, 200, result);
    }
    const body = await request.json().catch(() => { throw new HttpError(400, 'Некоректний запит'); });
    const order = orderPayload(body);
    await checkRateLimit(identity, env);
    await sendTelegram(order, identity, env);
    return json(origin, 200, { ok: true, item: order.item, label: order.label });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('Order delivery failed', { name: error?.name || 'Error', status });
    return json(origin, status, { error: status < 500 || error instanceof HttpError ? error.message : 'Не вдалося надіслати замовлення' });
  }
}

export class OrderRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const { uid } = await request.json().catch(() => ({}));
    if (!uid) return new Response(null, { status: 400 });
    const key = `user:${clean(uid, 128)}`;
    const now = Date.now();
    const lastOrderAt = Number(await this.state.storage.get(key) || 0);
    if (now - lastOrderAt < 5000) return new Response(null, { status: 429 });
    await this.state.storage.put(key, now);
    return new Response(null, { status: 204 });
  }
}

async function privateFeedbackKey(uid) {
  const bytes = new TextEncoder().encode(String(uid));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `vote:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export class GameFeedbackStore {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405 });
    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const uid = payload.uid || new URL(request.url).searchParams.get('uid');
    const vote = payload.vote;
    if (!uid) return new Response(null, { status: 400 });
    const key = await privateFeedbackKey(uid);
    if (request.method === 'POST') {
      await this.state.storage.put(key, {
        sentiment: ['up', 'down'].includes(vote?.sentiment) ? vote.sentiment : '',
        emotion: FEEDBACK_EMOTIONS.has(vote?.emotion) ? vote.emotion : '',
        updatedAt: new Date().toISOString()
      });
    }
    const mine = await this.state.storage.get(key) || { sentiment: '', emotion: '' };
    const stored = await this.state.storage.list({ prefix: 'vote:' });
    const votes = [...stored.values()];
    const sentiment = { up: 0, down: 0 };
    const emotions = { ...EMPTY_EMOTIONS };
    votes.forEach(item => {
      if (item?.sentiment in sentiment) sentiment[item.sentiment] += 1;
      if (item?.emotion in emotions) emotions[item.emotion] += 1;
    });
    const total = votes.filter(item => item?.sentiment || item?.emotion).length;
    return Response.json({
      mine: { sentiment: mine.sentiment || '', emotion: mine.emotion || '' },
      summary: {
        visible: total >= 3,
        total,
        sentiment: total >= 3 ? sentiment : { up: 0, down: 0 },
        emotions: total >= 3 ? emotions : { ...EMPTY_EMOTIONS }
      }
    });
  }
}

export default { fetch: handleRequest };
