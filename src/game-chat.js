import { getCommunityFirestore } from './cloud-profiles.js';

const COMMUNITY_ID = 'enjoy';
const GOOGLE_PROFILE_PREFIX = 'google_';
let stopChats = null;
let stopMessages = null;

function clean(value, maximum) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanMessage(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, 1000);
}

function timestampMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return (Number(value.seconds) * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  if (Number.isFinite(value)) return Number(value);
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function chatPath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'gameChats', gameId);
}

function archivePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'games', gameId);
}

function messagesPath(sdk, database, gameId) {
  return sdk.collection(database, 'communities', COMMUNITY_ID, 'gameChats', gameId, 'messages');
}

function uidFromSeat(seat) {
  const cloudUid = clean(seat?.cloudUid, 128);
  if (cloudUid) return cloudUid;
  const profileId = clean(seat?.profileId, 160);
  return profileId.startsWith(GOOGLE_PROFILE_PREFIX)
    ? clean(profileId.slice(GOOGLE_PROFILE_PREFIX.length), 128)
    : '';
}

export function authorizedGameParticipantUids(user, game) {
  const participantUids = [];
  const add = value => {
    const participantUid = clean(value, 128);
    if (participantUid && !participantUids.includes(participantUid) && participantUids.length < 11) participantUids.push(participantUid);
  };
  add(user?.uid || game?.ownerUid || game?.cloudOwnerUid);
  (game?.participantUids || []).forEach(add);
  (game?.seats || []).slice(0, 10).forEach(seat => add(uidFromSeat(seat)));
  return participantUids;
}

function hostName(user, profile, game) {
  return clean(profile?.nickname, 60)
    || clean(profile?.displayName, 60)
    || clean(game?.cloudHostName || game?.hostName, 60)
    || clean(user?.googleName, 60)
    || 'Ведучий';
}

export function createGameChatDocument(user, profile, game) {
  if (!user?.uid || game?.status !== 'finished') throw new Error('Чат можна створити лише для завершеної гри');
  const participantUids = authorizedGameParticipantUids(user, game);
  if (!participantUids.includes(user.uid)) throw new Error('Ведучого не вдалося додати до чату');
  return {
    id: clean(game.id, 160),
    gameId: clean(game.id, 160),
    communityId: COMMUNITY_ID,
    ownerUid: user.uid,
    hostName: hostName(user, profile, game),
    participantUids,
    gameTitle: clean(game.title, 80) || 'Гра в Мафію',
    venue: clean(game.venue, 100),
    endedAt: clean(game.endedAt || game.updatedAt, 40),
    schemaVersion: 1
  };
}

export function gameChatFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    gameId: clean(data.gameId || snapshot.id, 160),
    ownerUid: clean(data.ownerUid, 128),
    hostName: clean(data.hostName, 60),
    participantUids: Array.isArray(data.participantUids)
      ? [...new Set(data.participantUids.map(value => clean(value, 128)).filter(Boolean))].slice(0, 11)
      : [],
    gameTitle: clean(data.gameTitle, 80) || 'Гра в Мафію',
    venue: clean(data.venue, 100),
    endedAt: clean(data.endedAt, 40),
    createdAt: timestampMillis(data.createdAt),
    schemaVersion: 1
  };
}

function sameParticipants(left, right) {
  return left.length === right.length && left.every(uid => right.includes(uid));
}

export async function ensureGameChat(user, profile, game) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const fields = createGameChatDocument(user, profile, game);
  const archiveReference = archivePath(sdk, database, fields.gameId);
  const archiveSnapshot = await sdk.getDoc(archiveReference);
  if (!archiveSnapshot.exists()) throw new Error('Спочатку збережіть завершену гру в архіві');
  const archive = archiveSnapshot.data();
  if (archive.ownerUid !== user.uid) throw new Error('Автоматично створити чат може лише ведучий гри');

  const participantUids = authorizedGameParticipantUids(user, {
    ...archive,
    ...game,
    participantUids: [...(archive.participantUids || []), ...(game.participantUids || [])],
    seats: game?.seats?.length ? game.seats : archive.seats
  });
  if (!sameParticipants(participantUids, Array.isArray(archive.participantUids) ? archive.participantUids : [])) {
    await sdk.updateDoc(archiveReference, {
      participantUids,
      updatedAt: sdk.serverTimestamp()
    });
  }

  const reference = chatPath(sdk, database, fields.gameId);
  const snapshot = await sdk.getDoc(reference);
  if (snapshot.exists() && snapshot.data().ownerUid !== user.uid) {
    throw new Error('Чат цієї гри вже належить іншому ведучому');
  }
  const next = { ...fields, participantUids };
  if (snapshot.exists()) {
    const current = gameChatFromSnapshot(snapshot);
    const unchanged = current.ownerUid === next.ownerUid
      && current.hostName === next.hostName
      && current.gameTitle === next.gameTitle
      && current.venue === next.venue
      && current.endedAt === next.endedAt
      && sameParticipants(current.participantUids, next.participantUids);
    if (unchanged) return current;
  }
  await sdk.setDoc(reference, {
    ...next,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp()
  });
  return {
    ...next,
    createdAt: snapshot.exists() ? timestampMillis(snapshot.data().createdAt) : Date.now()
  };
}

export async function subscribeGameChats(user, onChats, onError) {
  if (!user?.uid) return () => {};
  const { database, sdk } = await getCommunityFirestore();
  stopChats?.();
  const reference = sdk.collection(database, 'communities', COMMUNITY_ID, 'gameChats');
  stopChats = sdk.onSnapshot(
    sdk.query(reference, sdk.where('participantUids', 'array-contains', user.uid)),
    snapshot => onChats(snapshot.docs
      .map(gameChatFromSnapshot)
      .sort((left, right) => String(right.endedAt).localeCompare(String(left.endedAt)))),
    error => onError?.(error)
  );
  return stopChats;
}

export function stopGameChats() {
  stopChats?.();
  stopChats = null;
}

export function gameChatMessageFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    gameId: clean(data.gameId, 160),
    senderUid: clean(data.senderUid, 128),
    senderName: clean(data.senderName, 60) || 'Гравець',
    text: cleanMessage(data.text),
    clientCreatedAt: clean(data.clientCreatedAt, 40),
    createdAt: timestampMillis(data.createdAt) || timestampMillis(data.clientCreatedAt),
    pending: snapshot.metadata?.hasPendingWrites === true
  };
}

export async function subscribeGameChatMessages(user, gameId, onMessages, onError) {
  if (!user?.uid) return () => {};
  const { database, sdk } = await getCommunityFirestore();
  stopMessages?.();
  const reference = messagesPath(sdk, database, clean(gameId, 160));
  stopMessages = sdk.onSnapshot(
    sdk.query(reference, sdk.orderBy('createdAt', 'asc'), sdk.limit(200)),
    { includeMetadataChanges: true },
    snapshot => onMessages(snapshot.docs.map(gameChatMessageFromSnapshot)),
    error => onError?.(error)
  );
  return stopMessages;
}

export function stopGameChatMessages() {
  stopMessages?.();
  stopMessages = null;
}

export async function sendGameChatMessage(user, profile, gameId, text) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const message = cleanMessage(text);
  if (!message) throw new Error('Напишіть повідомлення');
  const { database, sdk } = await getCommunityFirestore();
  const cleanGameId = clean(gameId, 160);
  const reference = sdk.doc(messagesPath(sdk, database, cleanGameId));
  const clientCreatedAt = new Date().toISOString();
  const fields = {
    id: reference.id,
    gameId: cleanGameId,
    senderUid: user.uid,
    senderName: hostName(user, profile, null),
    text: message,
    clientCreatedAt,
    schemaVersion: 1,
    createdAt: sdk.serverTimestamp()
  };
  await sdk.setDoc(reference, fields);
  return { ...fields, createdAt: Date.parse(clientCreatedAt), pending: true };
}

export function telegramDiscussionLinks(game, appUrl) {
  const target = new URL(appUrl || (typeof location !== 'undefined' ? location.href : 'https://example.invalid/'));
  target.hash = `/game/${encodeURIComponent(clean(game?.id, 160))}`;
  const title = clean(game?.title, 80) || 'Гра в Мафію';
  const text = `Обговорення гри «${title}» у Mafia Enjoy`;
  const share = new URL('https://t.me/share/url');
  share.searchParams.set('url', target.href);
  share.searchParams.set('text', text);
  return {
    createGroup: 'tg://new/group',
    share: share.href,
    gameUrl: target.href,
    text
  };
}
