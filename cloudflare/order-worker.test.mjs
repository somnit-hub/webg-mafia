import test from 'node:test';
import assert from 'node:assert/strict';
import { GameFeedbackStore, handleRequest, orderPayload, parseMenuCsv, telegramOrderText } from './order-worker.js';

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

test('published sheet menu controls availability, options and Telegram total', () => {
  const items = 'id,category,name_uk,name_it,name_en,name_fr,price_uah,volume_ml,icon,available,sort,description_uk\n'
    + 'coffee,coffee,Кава,Caffè,Coffee,Café,45,200,coffee,FALSE,10,\n'
    + 'cocoa,coffee,Какао,Cacao,Cocoa,Cacao,"55,00 ₴",300,cocoa,TRUE,20,Гарячий шоколад';
  const options = 'option_id,item_id,group,name_uk,name_it,name_en,name_fr,price_delta_uah,available,sort\n'
    + 'oat,cocoa,milk,Вівсяне,Avena,Oat,Avoine,20,TRUE,10';
  const menu = parseMenuCsv(items, options);
  assert.deepEqual(menu.items.map(item => item.id), ['cocoa']);
  const order = orderPayload({ item: 'cocoa', options: ['oat'], sender: 'Host' }, menu);
  assert.equal(order.priceUah, 75);
  assert.deepEqual(order.options.map(option => option.label), ['Вівсяне']);
  assert.match(telegramOrderText(order), /75 грн/);
  assert.throws(() => orderPayload({ item: 'coffee' }, menu), /недоступна/);
});

test('public menu endpoint works without Google login and exposes fallback safely', async () => {
  const response = await handleRequest(new Request('https://orders.example/menu', {
    method: 'GET', headers: { Origin: 'https://mafia-cafe.web.app' }
  }), environment());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.items.map(item => item.id), ['coffee', 'tea', 'cappuccino', 'latte']);
  assert.match(response.headers.get('Cache-Control'), /max-age=60/);
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

function activeGame() {
  return {
    id: 'game_test_live',
    communityId: 'enjoy',
    ownerUid: 'host-1',
    hostName: 'Ведучий',
    title: 'Гра в Мафію',
    venue: 'Enjoy',
    startedAt: '2026-08-14T18:00:00.000Z',
    gameUpdatedAt: '2026-08-14T18:01:00.000Z',
    status: 'active',
    phase: 'day',
    subphase: 'speeches',
    day: 1,
    seats: Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      name: `Гравець ${index + 1}`,
      status: 'alive',
      faults: 0,
      eliminatedReason: '',
      noVote: false
    })),
    nominations: [],
    tied: [],
    speakerIndex: 0,
    speakerOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    lastWordSeat: 0,
    nightStep: 0,
    timer: { remaining: 60, running: false, purpose: 'speech', endsAt: 0 },
    schemaVersion: 1
  };
}

test('active game is published through the authenticated Firestore proxy', async () => {
  let writtenDocument;
  let writeAuthorization = '';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    if (options.method === 'PATCH') {
      writtenDocument = JSON.parse(options.body);
      writeAuthorization = options.headers.Authorization;
      return Response.json({ name: 'live-game' });
    }
    return Response.json({}, { status: 404 });
  };
  const response = await handleRequest(request('/live-games', {
    body: { action: 'upsert', game: activeGame() }
  }), environment());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, changed: true, gameId: 'game_test_live' });
  assert.equal(writtenDocument.fields.ownerUid.stringValue, 'host-1');
  assert.equal(writtenDocument.fields.seats.arrayValue.values.length, 10);
  assert.match(writtenDocument.fields.createdAt.timestampValue, /^2026-/);
  assert.equal(writeAuthorization, 'Bearer valid-firebase-token');
});

test('another host cannot overwrite or delete an active game', async () => {
  globalThis.fetch = async url => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    return Response.json({ fields: { ownerUid: { stringValue: 'other-host' } } });
  };
  const overwrite = await handleRequest(request('/live-games', {
    body: { action: 'upsert', game: activeGame() }
  }), environment());
  assert.equal(overwrite.status, 403);
  const deletion = await handleRequest(request('/live-games', {
    body: { action: 'delete', gameId: 'game_test_live' }
  }), environment());
  assert.equal(deletion.status, 403);
});

test('host can remove an active game through the proxy', async () => {
  let deleteCalled = false;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Response.json({ users: [{ localId: 'host-1', email: 'host@example.com', emailVerified: true }] });
    }
    if (options.method === 'DELETE') {
      deleteCalled = true;
      return Response.json({});
    }
    return Response.json({ fields: { ownerUid: { stringValue: 'host-1' } } });
  };
  const response = await handleRequest(request('/live-games', {
    body: { action: 'delete', gameId: 'game_test_live' }
  }), environment());
  assert.equal(response.status, 200);
  assert.equal(deleteCalled, true);
  assert.deepEqual(await response.json(), { ok: true, changed: true, gameId: 'game_test_live' });
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

test('signed-in users can load anonymous summaries for finished games without participant identities', async () => {
  let identityRequests = 0;
  let gameRequests = 0;
  const aggregate = {
    visible: true,
    total: 4,
    sentiment: { up: 3, down: 1 },
    emotions: { brain: 1, oscar: 0, fire: 2, circus: 1, dead: 0 }
  };
  globalThis.fetch = async url => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      identityRequests += 1;
      return Response.json({ users: [{ localId: 'viewer-1', email: 'viewer@example.com', emailVerified: true }] });
    }
    gameRequests += 1;
    return Response.json(firestoreGame('google_someone-else'));
  };
  const response = await handleRequest(
    request('/ratings/summary/batch', { body: { gameIds: ['game-1'] } }),
    environment({ feedbackResult: { summary: aggregate } })
  );
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.summaries['game-1'], aggregate);
  assert.equal(JSON.stringify(result).includes('mine'), false);
  assert.equal(identityRequests, 1);
  assert.equal(gameRequests, 1);
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
  const anonymous = await (await store.fetch(new Request('https://feedback.internal/summary'))).json();
  assert.deepEqual(anonymous.summary, result.summary);
  assert.equal('mine' in anonymous, false);
});
