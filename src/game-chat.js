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

function liveGamePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'liveGames', gameId);
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

export function activeAuthorizedPlayerUids(game) {
  const playerUids = [];
  (game?.seats || []).slice(0, 10).forEach(seat => {
    const playerUid = seat?.status === 'dead' ? '' : uidFromSeat(seat);
    if (playerUid && !playerUids.includes(playerUid)) playerUids.push(playerUid);
  });
  return playerUids;
}

export function canJoinActiveGameChat(user, game) {
  const userUid = clean(user?.uid, 128);
  if (!userUid || game?.status !== 'active') return false;
  const ownerUid = clean(game?.ownerUid || game?.cloudOwnerUid, 128);
  if (ownerUid === userUid) return true;
  const activePlayerUids = Array.isArray(game?.activePlayerUids)
    ? game.activePlayerUids.map(value => clean(value, 128)).filter(Boolean)
    : activeAuthorizedPlayerUids(game);
  return !activePlayerUids.includes(userUid);
}

function hostName(user, profile, game) {
  return clean(profile?.nickname, 60)
    || clean(profile?.displayName, 60)
    || clean(game?.cloudHostName || game?.hostName, 60)
    || clean(user?.googleName, 60)
    || 'Ведучий';
}

export function createGameChatDocument(user, profile, game) {
  if (!user?.uid || !['active', 'finished'].includes(game?.status)) throw new Error('Чат можна створити лише для активної або завершеної гри');
  const gameParticipantUids = authorizedGameParticipantUids(user, game);
  if (!gameParticipantUids.includes(user.uid)) throw new Error('Ведучого не вдалося додати до чату');
  const finished = game.status === 'finished';
  return {
    id: clean(game.id, 160),
    gameId: clean(game.id, 160),
    communityId: COMMUNITY_ID,
    ownerUid: user.uid,
    hostName: hostName(user, profile, game),
    participantUids: finished ? gameParticipantUids : [user.uid],
    gameTitle: clean(game.title, 80) || 'Гра в Мафію',
    venue: clean(game.venue, 100),
    status: finished ? 'finished' : 'active',
    startedAt: clean(game.startedAt, 40),
    endedAt: finished ? clean(game.endedAt || game.updatedAt, 40) : '',
    schemaVersion: 2
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
      ? [...new Set(data.participantUids.map(value => clean(value, 128)).filter(Boolean))].slice(0, 200)
      : [],
    gameTitle: clean(data.gameTitle, 80) || 'Гра в Мафію',
    venue: clean(data.venue, 100),
    status: data.status === 'active' ? 'active' : 'finished',
    startedAt: clean(data.startedAt, 40),
    endedAt: clean(data.endedAt, 40),
    createdAt: timestampMillis(data.createdAt),
    schemaVersion: Number(data.schemaVersion) || 1
  };
}

function sameParticipants(left, right) {
  return left.length === right.length && left.every(uid => right.includes(uid));
}

export async function ensureGameChat(user, profile, game) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const fields = createGameChatDocument(user, profile, game);
  const sourceReference = fields.status === 'active'
    ? liveGamePath(sdk, database, fields.gameId)
    : archivePath(sdk, database, fields.gameId);
  const sourceSnapshot = await sdk.getDoc(sourceReference);
  if (!sourceSnapshot.exists()) throw new Error(fields.status === 'active' ? 'Активна гра ще синхронізується' : 'Спочатку збережіть завершену гру в архіві');
  const source = sourceSnapshot.data();
  if (source.ownerUid !== user.uid) throw new Error('Автоматично створити чат може лише поточний ведучий гри');

  const gameParticipantUids = authorizedGameParticipantUids(user, {
    ...source,
    ...game,
    participantUids: [...(source.participantUids || []), ...(game.participantUids || [])],
    seats: game?.seats?.length ? game.seats : source.seats
  });
  if (fields.status === 'finished' && !sameParticipants(gameParticipantUids, Array.isArray(source.participantUids) ? source.participantUids : [])) {
    await sdk.updateDoc(sourceReference, {
      participantUids: gameParticipantUids,
      updatedAt: sdk.serverTimestamp()
    });
  }
  const reference = chatPath(sdk, database, fields.gameId);
  const snapshot = await sdk.getDoc(reference);
  const storedParticipants = snapshot.exists() && Array.isArray(snapshot.data().participantUids)
    ? snapshot.data().participantUids.map(value => clean(value, 128)).filter(Boolean)
    : [];
  const activePlayerUids = fields.status === 'active'
    ? [...new Set([
      ...(Array.isArray(source.activePlayerUids) ? source.activePlayerUids : []),
      ...activeAuthorizedPlayerUids(game)
    ].map(value => clean(value, 128)).filter(uid => uid && uid !== user.uid))]
    : [];
  const participantUids = [...new Set([
    ...storedParticipants.filter(uid => uid === user.uid || !activePlayerUids.includes(uid)),
    ...(fields.status === 'finished' ? gameParticipantUids : []),
    user.uid
  ])].slice(0, 200);
  const next = { ...fields, participantUids };
  if (snapshot.exists()) {
    const current = gameChatFromSnapshot(snapshot);
    const unchanged = current.ownerUid === next.ownerUid
      && current.hostName === next.hostName
      && current.gameTitle === next.gameTitle
      && current.venue === next.venue
      && current.status === next.status
      && current.startedAt === next.startedAt
      && current.endedAt === next.endedAt
      && current.schemaVersion === next.schemaVersion
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

export async function joinGameChat(user, gameId) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const cleanGameId = clean(gameId, 160);
  const reference = chatPath(sdk, database, cleanGameId);
  const liveReference = liveGamePath(sdk, database, cleanGameId);
  return sdk.runTransaction(database, async transaction => {
    const chatSnapshot = await transaction.get(reference);
    if (!chatSnapshot.exists()) throw new Error('Чат гри ще створюється');
    const chat = gameChatFromSnapshot(chatSnapshot);
    if (chat.status === 'active') {
      const liveSnapshot = await transaction.get(liveReference);
      if (!liveSnapshot.exists()) throw new Error('Активна гра вже завершилась. Оновіть список ігор');
      const live = liveSnapshot.data();
      const activePlayerUids = Array.isArray(live.activePlayerUids) ? live.activePlayerUids : [];
      if (live.ownerUid !== user.uid && activePlayerUids.includes(user.uid)) {
        throw new Error('Активні гравці отримають доступ до чату після вибуття або завершення гри');
      }
    } else if (!chat.participantUids.includes(user.uid)) {
      throw new Error('Після завершення гри чат доступний її учасникам і глядачам, які приєдналися раніше');
    }
    if (chat.participantUids.includes(user.uid)) return chat;
    const participantUids = [...chat.participantUids, user.uid].slice(0, 200);
    transaction.update(reference, { participantUids });
    return { ...chat, participantUids };
  });
}

export async function deleteGameChat(user, gameId) {
  if (!user?.uid) return;
  const { database, sdk } = await getCommunityFirestore();
  await sdk.deleteDoc(chatPath(sdk, database, clean(gameId, 160)));
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
      .sort((left, right) => String(right.endedAt || right.startedAt).localeCompare(String(left.endedAt || left.startedAt)))),
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
