import test from 'node:test';
import assert from 'node:assert/strict';
import { GameFeedbackStore, handleRequest, orderPayload, telegramOrderText } from './order-worker.js';

const originalFetch = globalThis.fetch;

function environment({ limiterStatus = 204, feedbackResult } = {}) {
  return {
    FIREBASE_WEB_API_KEY: 'public-test-key',
    FIREBASE_PROJECT_ID: 'test-project',
    TELEGRAM_BOT_TOKEN: 'secret-token',
    ORDER_TELEGRAM_CHAT_ID: '123456',
    ORDER_LIMITER: {
      idFromName: value => value,
      get: () => ({ fetch: async () => new Response(null, { status: limiterStatus }) })
    },
    GAME_FEEDBACK: {
      idFromName: value => value,
      get: () => ({ fetch: async () => Response.json(feedbackResult || {
        mine: { sentiment: 'up', emotion: 'fire' },
        summary: { visible: false, total: 1, sentiment: { up: 0, down: 0 }, emotions: {} }
      }) })
    }
  };
}

function request(path = '/orders', options = {}) {
  return new Request(`https://orders.example${path}`, {
    method: 'POST',
    headers: {
      Origin: 'https://mafia-cafe.web.app',
      Authorization: 'Bearer valid-firebase-token',
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(options.body || { item: 'latte', sender: 'Ведучий', game: 'Гра 1' })
  });
}

test.afterEach(() => { globalThis.fetch = originalFetch; });

test('order model accepts only menu drinks and escapes Telegram HTML', () => {
  const order = orderPayload({ item: 'cappuccino', sender: '<Host>', game: 'Гра & кава' });
  assert.equal(order.label, 'Капучино');
  assert.match(telegramOrderText(order, 'host@example.com'), /&lt;Host&gt;/);
  assert.match(telegramOrderText(order, 'host@example.com'), /Гра &amp; кава/);
  assert.throws(() => orderPayload({ item: 'unknown' }), /Невідома позиція/);
});

test('CORS preflight allows Firebase Hosting and rejects other sites', async () => {
  const allowed = await handleRequest(new Request('https://orders.example/orders', {
    method: 'OPTIONS', headers: { Origin: 'https://mafia-cafe.web.app' }
  }), environment());
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://mafia-cafe.web.app');

  const denied = await handleRequest(new Request('https://orders.example/orders', {
    method: 'OPTIONS', headers: { Origin: 'https://example.com' }
  }), environment());
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('authorized Firebase user can send a Telegram order', async () => {
  let telegramBody;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    telegramBody = JSON.parse(options.body);
    return Response.json({ ok: true });
  };
  const response = await handleRequest(request(), environment());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, item: 'latte', label: 'Лате' });
  assert.equal(telegramBody.chat_id, '123456');
  assert.match(telegramBody.text, /host@example.com/);
});

test('missing login and repeated order are rejected', async () => {
  const missingLogin = request('/orders', { headers: { Authorization: '' } });
  assert.equal((await handleRequest(missingLogin, environment())).status, 401);

  globalThis.fetch = async url => String(url).includes('identitytoolkit.googleapis.com')
    ? Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] })
    : Response.json({ ok: true });
  const limited = await handleRequest(request(), environment({ limiterStatus: 429 }));
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error, /Зачекайте/);
});

function firestoreGame(profileId = 'google_host-1') {
  return {
    fields: {
      status: { stringValue: 'finished' },
      seats: {
        arrayValue: {
          values: [{ mapValue: { fields: { profileId: { stringValue: profileId } } } }]
        }
      }
    }
  };
}

test('a verified participant can save anonymous game feedback', async () => {
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    if (String(url).includes('firestore.googleapis.com')) return Response.json(firestoreGame());
    throw new Error(`Unexpected request: ${url}`);
  };
  const response = await handleRequest(request('/ratings', {
    body: { gameId: 'game-1', sentiment: 'up', emotion: 'fire' }
  }), environment());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).mine, { sentiment: 'up', emotion: 'fire' });
  assert.equal(requested.some(url => url.includes('/communities/enjoy/games/game-1')), true);
});

test('a signed-in non-participant cannot rate the game', async () => {
  globalThis.fetch = async url => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    return Response.json(firestoreGame('google_someone-else'));
  };
  const response = await handleRequest(request('/ratings', {
    body: { gameId: 'game-1', sentiment: 'down', emotion: 'circus' }
  }), environment());
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /лише її учасники/);
});

test('feedback history loads in one authenticated batch', async () => {
  let identityRequests = 0;
  let gameRequests = 0;
  globalThis.fetch = async url => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      identityRequests += 1;
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    gameRequests += 1;
    return Response.json(firestoreGame());
  };
  const response = await handleRequest(request('/ratings/batch', { body: { gameIds: ['game-1', 'game-2'] } }), environment());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(result.ratings), ['game-1', 'game-2']);
  assert.equal(identityRequests, 1);
  assert.equal(gameRequests, 2);
});

test('feedback aggregate stays hidden until three private votes', async () => {
  const values = new Map();
  const store = new GameFeedbackStore({
    storage: {
      get: key => values.get(key),
      put: (key, value) => values.set(key, value),
      list: ({ prefix }) => new Map([...values].filter(([key]) => key.startsWith(prefix)))
    }
  });
  const rate = (uid, sentiment, emotion) => store.fetch(new Request('https://feedback.internal/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, vote: { sentiment, emotion } })
  }));
  let result = await (await rate('u1', 'up', 'fire')).json();
  assert.equal(result.summary.visible, false);
  assert.deepEqual(result.summary.sentiment, { up: 0, down: 0 });
  await rate('u2', 'down', 'circus');
  result = await (await rate('u3', 'up', 'fire')).json();
  assert.equal(result.summary.visible, true);
  assert.deepEqual(result.summary.sentiment, { up: 2, down: 1 });
  assert.equal(result.summary.emotions.fire, 2);
  assert.equal(result.summary.emotions.circus, 1);
  assert.equal([...values.keys()].some(key => key.includes('u1')), false);
});
