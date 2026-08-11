import { getCommunityFirestore } from './cloud-profiles.js';

const COMMUNITY_ID = 'enjoy';
let stopOwnedLinks = null;

function clean(value, maximum) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

export function normalizePlayerEmail(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US');
}

export function isValidPlayerEmail(value) {
  const email = normalizePlayerEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function playerLinkId(user, playerId) {
  const owner = clean(user?.uid, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  const local = clean(playerId, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!owner || !local) throw new Error('Не вдалося створити ідентифікатор прив’язки');
  return `${owner}_${local}`;
}

export function createPlayerLinkFields(user, hostProfile, player) {
  const email = normalizePlayerEmail(player?.email);
  if (!user?.uid || !user?.emailVerified) throw new Error('Потрібен підтверджений Google-акаунт ведучого');
  if (!isValidPlayerEmail(email)) throw new Error('Перевірте email гравця');
  return {
    id: playerLinkId(user, player.id),
    communityId: COMMUNITY_ID,
    ownerUid: clean(user.uid, 128),
    ownerName: clean(hostProfile?.displayName || user.googleName || 'Ведучий', 60),
    localPlayerId: clean(player.id, 128),
    email,
    playerName: clean(player.name, 60),
    nickname: clean(player.nickname, 40),
    status: 'pending',
    claimedUid: '',
    schemaVersion: 1
  };
}

function linkPath(sdk, database, id) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'playerLinks', id);
}

function linkFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    communityId: COMMUNITY_ID,
    ownerUid: clean(data.ownerUid, 128),
    ownerName: clean(data.ownerName, 60),
    localPlayerId: clean(data.localPlayerId, 128),
    email: normalizePlayerEmail(data.email),
    playerName: clean(data.playerName, 60),
    nickname: clean(data.nickname, 40),
    status: data.status === 'accepted' ? 'accepted' : 'pending',
    claimedUid: clean(data.claimedUid, 128)
  };
}

export async function upsertPlayerLink(user, hostProfile, player) {
  const fields = createPlayerLinkFields(user, hostProfile, player);
  const { database, sdk } = await getCommunityFirestore();
  const reference = linkPath(sdk, database, fields.id);
  const snapshot = await sdk.getDoc(reference);
  if (snapshot.exists() && snapshot.data().status === 'accepted') return linkFromSnapshot(snapshot);
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp(),
    acceptedAt: null
  });
  return fields;
}

export async function deleteOwnedPlayerLink(user, localPlayerId) {
  if (!user?.uid || !localPlayerId) return;
  const { database, sdk } = await getCommunityFirestore();
  await sdk.deleteDoc(linkPath(sdk, database, playerLinkId(user, localPlayerId)));
}

export async function deleteAllOwnedPlayerLinks(user) {
  if (!user?.uid) return;
  const { database, sdk } = await getCommunityFirestore();
  const request = sdk.query(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'playerLinks'),
    sdk.where('ownerUid', '==', user.uid)
  );
  const snapshot = await sdk.getDocs(request);
  await Promise.all(snapshot.docs.map(document => sdk.deleteDoc(document.ref)));
}

export async function findPendingPlayerLinks(user) {
  const email = normalizePlayerEmail(user?.email);
  if (!user?.emailVerified || !isValidPlayerEmail(email)) return [];
  const { database, sdk } = await getCommunityFirestore();
  const request = sdk.query(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'playerLinks'),
    sdk.where('email', '==', email)
  );
  const snapshot = await sdk.getDocs(request);
  return snapshot.docs.map(linkFromSnapshot).filter(link => link.status === 'pending');
}

export async function acceptPlayerLink(user, linkId) {
  const email = normalizePlayerEmail(user?.email);
  if (!user?.uid || !user?.emailVerified || !isValidPlayerEmail(email)) {
    throw new Error('Для об’єднання потрібен підтверджений Google-email');
  }
  const { database, sdk } = await getCommunityFirestore();
  const reference = linkPath(sdk, database, clean(linkId, 260));
  return sdk.runTransaction(database, async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Запрошення вже недоступне');
    const data = snapshot.data();
    if (normalizePlayerEmail(data.email) !== email) throw new Error('Email запрошення не збігається з Google-акаунтом');
    if (data.status === 'accepted' && data.claimedUid === user.uid) return linkFromSnapshot(snapshot);
    if (data.status !== 'pending') throw new Error('Запрошення вже оброблено');
    transaction.update(reference, {
      status: 'accepted',
      claimedUid: user.uid,
      acceptedAt: sdk.serverTimestamp(),
      updatedAt: sdk.serverTimestamp()
    });
    return { ...linkFromSnapshot(snapshot), status: 'accepted', claimedUid: user.uid };
  });
}

export async function subscribeOwnedPlayerLinks(user, onLinks, onError) {
  if (!user?.uid) return () => {};
  const { database, sdk } = await getCommunityFirestore();
  stopOwnedLinks?.();
  const request = sdk.query(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'playerLinks'),
    sdk.where('ownerUid', '==', user.uid)
  );
  stopOwnedLinks = sdk.onSnapshot(request, { includeMetadataChanges: true }, snapshot => {
    onLinks(snapshot.docs.map(linkFromSnapshot), { fromCache: snapshot.metadata.fromCache });
  }, error => onError?.(error));
  return () => {
    stopOwnedLinks?.();
    stopOwnedLinks = null;
  };
}

export function stopPlayerLinks() {
  stopOwnedLinks?.();
  stopOwnedLinks = null;
}
