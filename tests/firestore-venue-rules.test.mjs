import assert from 'node:assert/strict';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) process.exit(0);

const projectId = 'demo-mafia-venues';
const root = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(uid, email, emailVerified = true) {
  const now = Math.floor(Date.now() / 1000);
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
    aud: projectId,
    auth_time: now,
    email,
    email_verified: emailVerified,
    exp: now + 3600,
    firebase: { identities: { email: [email] }, sign_in_provider: 'google.com' },
    iat: now,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: uid,
    user_id: uid
  })}.`;
}

function value(item) {
  if (typeof item === 'string') return { stringValue: item };
  if (typeof item === 'number') return { integerValue: String(item) };
  if (item?.timestampValue) return item;
  throw new Error(`Unsupported Firestore test value: ${String(item)}`);
}

function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)]));
}

async function request(path, { authorization = 'owner', method = 'GET', data } = {}) {
  return fetch(`${root}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authorization}`,
      ...(data ? { 'Content-Type': 'application/json' } : {})
    },
    ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {})
  });
}

function venue(id, creatorUid = 'creator_uid') {
  const now = { timestampValue: new Date().toISOString() };
  return {
    id,
    communityId: 'enjoy',
    name: `Venue ${id}`,
    googleMapsUrl: '',
    address: 'Київ',
    phone: '',
    website: '',
    createdByUid: creatorUid,
    createdByName: 'Creator',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now
  };
}

const adminToken = token('admin_uid', 'somnit3d@gmail.com');
const unverifiedAdminToken = token('unverified_admin_uid', 'somnit3d@gmail.com', false);
const memberToken = token('member_uid', 'member@example.com');
const creatorToken = token('creator_uid', 'creator@example.com');

const adminVenuePath = 'communities/enjoy/venues/admin_delete';
await request(adminVenuePath, { method: 'PATCH', data: venue('admin_delete') });
assert.equal((await request(adminVenuePath, { method: 'DELETE', authorization: memberToken })).status, 403);
assert.equal((await request(adminVenuePath, { method: 'DELETE', authorization: unverifiedAdminToken })).status, 403);
assert.equal((await request(adminVenuePath, { method: 'DELETE', authorization: adminToken })).status, 200);

const creatorVenuePath = 'communities/enjoy/venues/creator_delete';
await request(creatorVenuePath, { method: 'PATCH', data: venue('creator_delete') });
assert.equal((await request(creatorVenuePath, { method: 'DELETE', authorization: creatorToken })).status, 200);

console.log('Firestore venue administration rules passed.');
