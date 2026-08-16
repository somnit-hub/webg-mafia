import assert from 'node:assert/strict';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) process.exit(0);

const projectId = 'demo-mafia-chat';
const root = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const gameId = 'rules_game_chat';

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
    aud: projectId,
    auth_time: now,
    exp: now + 3600,
    firebase: { identities: {}, sign_in_provider: 'custom' },
    iat: now,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: uid,
    user_id: uid
  })}.`;
}

function value(item) {
  if (typeof item === 'string') return { stringValue: item };
  if (typeof item === 'number') return { integerValue: String(item) };
  if (typeof item === 'boolean') return { booleanValue: item };
  if (Array.isArray(item)) return { arrayValue: { values: item.map(value) } };
  if (item?.timestampValue) return item;
  return { mapValue: { fields: fields(item) } };
}

function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)]));
}

async function request(path, { uid = 'owner', method = 'GET', data } = {}) {
  return fetch(`${root}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${uid === 'owner' ? 'owner' : token(uid)}`,
      ...(data ? { 'Content-Type': 'application/json' } : {})
    },
    ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {})
  });
}

async function queryChats(uid) {
  return fetch(`${root}/communities/enjoy:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'gameChats' }],
        where: { fieldFilter: { field: { fieldPath: 'participantUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } } }
      }
    })
  });
}

async function queryMessages(uid) {
  return fetch(`${root}/communities/enjoy/gameChats/${gameId}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'messages' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
        limit: 200
      }
    })
  });
}

const now = { timestampValue: new Date().toISOString() };
const livePath = `communities/enjoy/liveGames/${gameId}`;
const chatPath = `communities/enjoy/gameChats/${gameId}`;
const archivePath = `communities/enjoy/games/${gameId}`;
const messagePath = `${chatPath}/messages/message_one`;

const liveGame = {
  id: gameId, communityId: 'enjoy', ownerUid: 'host_uid', hostName: 'Host', title: 'Live game', venue: 'Enjoy',
  startedAt: '2026-08-16T18:00:00.000Z', gameUpdatedAt: '2026-08-16T18:01:00.000Z', status: 'active',
  participantUids: ['host_uid', 'active_uid'], activePlayerUids: ['active_uid'], phase: 'day', subphase: 'speeches', day: 1,
  seats: Array.from({ length: 10 }, (_, index) => ({ number: index + 1, name: `Player ${index + 1}`, status: 'alive', faults: 0, eliminatedReason: '', noVote: false })),
  nominations: [], tied: [], speakerIndex: 0, speakerOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], lastWordSeat: 0, nightStep: 0,
  timer: { remaining: 60, running: false, purpose: 'speech', endsAt: 0 }, schemaVersion: 1, createdAt: now, updatedAt: now
};
await request(livePath, { method: 'PATCH', data: liveGame });

const activeChat = {
  id: gameId, gameId, communityId: 'enjoy', ownerUid: 'host_uid', hostName: 'Host', participantUids: ['host_uid'],
  gameTitle: 'Live game', venue: 'Enjoy', status: 'active', startedAt: '2026-08-16T18:00:00.000Z', endedAt: '', schemaVersion: 2, createdAt: now
};
assert.equal((await request(chatPath, { uid: 'host_uid', method: 'PATCH', data: activeChat })).status, 200);
assert.equal((await request(chatPath, { uid: 'viewer_uid' })).status, 200);
assert.equal((await request(chatPath, { uid: 'active_uid' })).status, 403);

assert.equal((await request(chatPath, {
  uid: 'viewer_uid', method: 'PATCH', data: { ...activeChat, participantUids: ['host_uid', 'viewer_uid'] }
})).status, 200);
assert.equal((await queryChats('viewer_uid')).status, 200);
const viewerMessage = {
  id: 'message_one', gameId, senderUid: 'viewer_uid', senderName: 'Viewer', text: 'Watching live',
  clientCreatedAt: '2026-08-16T18:02:00.000Z', schemaVersion: 1, createdAt: now
};
assert.equal((await request(messagePath, { uid: 'viewer_uid', method: 'PATCH', data: viewerMessage })).status, 200);
assert.equal((await queryMessages('host_uid')).status, 200);
assert.equal((await queryMessages('viewer_uid')).status, 200);
assert.equal((await queryMessages('active_uid')).status, 403);

await request(livePath, { method: 'DELETE' });
assert.equal((await request(chatPath, { uid: 'host_uid' })).status, 200);
assert.equal((await request(chatPath, { uid: 'viewer_uid' })).status, 200);
assert.equal((await queryMessages('host_uid')).status, 200);
assert.equal((await queryMessages('viewer_uid')).status, 200);
assert.equal((await queryMessages('active_uid')).status, 403);
await request(livePath, { method: 'PATCH', data: liveGame });

assert.equal((await request(chatPath, {
  uid: 'host_uid', method: 'PATCH', data: { ...activeChat, participantUids: ['host_uid', 'viewer_uid', 'active_uid'] }
})).status, 403);
assert.equal((await request(chatPath, { uid: 'active_uid' })).status, 403);
assert.equal((await queryChats('active_uid')).status, 200);
assert.equal((await request(`${chatPath}/messages/active_message`, {
  uid: 'active_uid', method: 'PATCH', data: { ...viewerMessage, id: 'active_message', senderUid: 'active_uid' }
})).status, 403);

await request(livePath, { method: 'PATCH', data: { ...liveGame, activePlayerUids: [] } });
assert.equal((await request(chatPath, { uid: 'active_uid' })).status, 200);
assert.equal((await request(chatPath, {
  uid: 'active_uid', method: 'PATCH', data: { ...activeChat, participantUids: ['host_uid', 'viewer_uid', 'active_uid'] }
})).status, 200);
assert.equal((await request(`${chatPath}/messages/eliminated_message`, {
  uid: 'active_uid', method: 'PATCH', data: { ...viewerMessage, id: 'eliminated_message', senderUid: 'active_uid' }
})).status, 200);
assert.equal((await request(livePath, { uid: 'host_uid', method: 'PATCH', data: liveGame })).status, 403);
assert.equal((await request(chatPath, {
  uid: 'host_uid', method: 'PATCH', data: { ...activeChat, participantUids: ['host_uid', 'viewer_uid'] }
})).status, 200);
assert.equal((await request(livePath, { uid: 'host_uid', method: 'PATCH', data: liveGame })).status, 200);

await request(livePath, { method: 'DELETE' });
await request(archivePath, {
  method: 'PATCH',
  data: { ownerUid: 'host_uid', participantUids: ['host_uid', 'active_uid'] }
});
assert.equal((await request(chatPath, {
  uid: 'host_uid', method: 'PATCH', data: {
    ...activeChat, participantUids: ['host_uid', 'viewer_uid', 'active_uid'], status: 'finished', endedAt: '2026-08-16T19:00:00.000Z'
  }
})).status, 200);
assert.equal((await request(chatPath, { uid: 'active_uid' })).status, 200);
assert.equal((await queryChats('active_uid')).status, 200);
assert.equal((await request(`${chatPath}/messages/finished_message`, {
  uid: 'active_uid', method: 'PATCH', data: { ...viewerMessage, id: 'finished_message', senderUid: 'active_uid' }
})).status, 200);

console.log('Firestore game-chat access rules passed.');
