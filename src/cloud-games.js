import { getCommunityFirestore } from './cloud-profiles.js';
import { ACTIVE_GAME_PHASES } from './game-engine.js';
import { getFirebaseIdToken } from './auth.js';
import { activeAuthorizedPlayerUids, authorizedGameParticipantUids } from './game-chat.js';

const COMMUNITY_ID = 'enjoy';
const ACTIVE_PHASES = new Set(ACTIVE_GAME_PHASES);
let stopArchive = null;
let stopHostTransfers = [];
const LIVE_GAMES_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/live-games';

function clean(value, maximum) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function integer(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)));
}

function gamePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'games', gameId);
}

function gameDeletionPath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'gameDeletions', gameId);
}

function activeGameBackupPath(sdk, database, userUid, gameId) {
  return sdk.doc(database, 'privateUsers', userUid, 'activeGames', gameId);
}

function hostTransferPath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'gameHostTransfers', gameId);
}

function liveGamePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'liveGames', gameId);
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: encodeFirestoreFields(value) } };
}

export function encodeFirestoreFields(value) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, firestoreValue(item)]));
}

function firestoreRequestError(status, details = '') {
  const error = new Error(details || 'Не вдалося синхронізувати активну гру');
  error.code = status === 401 ? 'unauthenticated'
    : status === 403 ? 'permission-denied'
      : status === 404 ? 'not-found'
        : status === 429 ? 'resource-exhausted'
          : status >= 500 ? 'unavailable'
            : 'unknown';
  return error;
}

async function liveGameApiRequest(body) {
  const idToken = await getFirebaseIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(LIVE_GAMES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw firestoreRequestError(504, 'Синхронізація активної гри не відповіла вчасно');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    let details = '';
    try { details = (await response.json())?.error || ''; } catch {}
    throw firestoreRequestError(response.status, details);
  }
  return response.json();
}

function sharedSeat(seat) {
  return {
    number: integer(seat.number, 1, 10),
    profileId: clean(seat.profileId, 160),
    name: clean(seat.name, 60) || `Гравець ${integer(seat.number, 1, 10)}`,
    role: ['citizen', 'sheriff', 'mafia', 'don'].includes(seat.role) ? seat.role : 'citizen',
    status: seat.status === 'dead' ? 'dead' : 'alive',
    faults: integer(seat.faults, 0, 4),
    eliminatedReason: clean(seat.eliminatedReason, 160)
  };
}

function liveSeat(seat) {
  return {
    number: integer(seat.number, 1, 10),
    name: clean(seat.name, 60) || `Гравець ${integer(seat.number, 1, 10)}`,
    status: seat.status === 'dead' ? 'dead' : 'alive',
    faults: integer(seat.faults, 0, 4),
    eliminatedReason: clean(seat.eliminatedReason, 160),
    noVote: Boolean(seat.noVote)
  };
}

function sharedEvent(event) {
  return {
    at: clean(event.at, 40),
    time: clean(event.time, 20),
    text: clean(event.text, 500)
  };
}

function sharedBestMove(game) {
  const seat = integer(game?.bestMove?.seat, 0, 10);
  const selected = [...new Set((game?.bestMove?.selected || [])
    .map(Number)
    .filter(number => Number.isInteger(number) && number >= 1 && number <= 10))].slice(0, 3);
  return { seat, selected };
}

function hostName(user, profile, game) {
  return clean(profile?.nickname, 60)
    || clean(profile?.displayName, 60)
    || clean(game?.hostName, 60)
    || clean(user.googleName, 60)
    || 'Ведучий';
}

export function createActiveGameDocument(user, profile, game) {
  if (game?.status !== 'active' || !ACTIVE_PHASES.has(game.phase)) {
    throw new Error('До live-переліку можна додати лише активну гру');
  }
  const timer = game.timer || {};
  const participantUids = authorizedGameParticipantUids(user, game);
  const activePlayerUids = activeAuthorizedPlayerUids(game).filter(uid => uid !== user.uid);
  return {
    id: clean(game.id, 160),
    communityId: COMMUNITY_ID,
    ownerUid: user.uid,
    hostName: hostName(user, profile, game),
    title: clean(game.title, 80) || 'Гра в Мафію',
    venue: clean(game.venue, 100),
    startedAt: clean(game.startedAt, 40),
    gameUpdatedAt: clean(game.updatedAt || game.startedAt, 40),
    status: 'active',
    participantUids,
    activePlayerUids,
    phase: game.phase,
    subphase: clean(game.subphase, 40),
    day: integer(game.day, 1, 100),
    seats: (game.seats || []).slice(0, 10).map(liveSeat),
    nominations: (game.nominations || []).slice(0, 10).map(number => integer(number, 1, 10)),
    tied: (game.vote?.tied || []).slice(0, 10).map(number => integer(number, 1, 10)),
    speakerIndex: integer(game.speakerIndex, 0, 9),
    speakerOrder: (game.speakerOrder || []).slice(0, 10).map(number => integer(number, 1, 10)),
    lastWordSeat: integer(game.lastWordSeat, 0, 10),
    nightStep: integer(game.night?.step, 0, 4),
    timer: {
      remaining: integer(timer.remaining, 0, 3600),
      running: Boolean(timer.running),
      purpose: clean(timer.purpose, 24),
      endsAt: timer.running ? integer(timer.endsAt, 0, 9999999999999) : 0
    },
    schemaVersion: 1
  };
}

export function createActiveGameBackupDocument(user, game) {
  if (!user?.uid || game?.status !== 'active' || !ACTIVE_PHASES.has(game.phase)) {
    throw new Error('До приватної копії можна додати лише активну гру ведучого');
  }
  const state = JSON.parse(JSON.stringify(game));
  state.ownerUid = user.uid;
  delete state.publicOnly;
  delete state.shared;
  delete state.source;
  delete state.cloudOwnerUid;
  delete state.cloudHostName;
  state.seats = (state.seats || []).map(seat => ({
    ...seat,
    avatar: String(seat.avatar || '').startsWith('data:image/') ? '' : String(seat.avatar || '')
  }));
  let stateJson = JSON.stringify(state);
  if (stateJson.length > 700000 && Array.isArray(state.history)) {
    state.history = state.history.slice(0, 100);
    stateJson = JSON.stringify(state);
  }
  if (stateJson.length > 700000) throw new Error('Приватна копія активної гри завелика');
  return {
    id: clean(game.id, 160),
    ownerUid: user.uid,
    gameUpdatedAt: clean(game.updatedAt || game.startedAt, 40),
    stateJson,
    schemaVersion: 1
  };
}

function hostTransferTimestamp(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return (Number(value.seconds) * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  return Number(value) || 0;
}

function hostTransferFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    gameId: clean(data.gameId, 160),
    gameTitle: clean(data.gameTitle, 80),
    fromUid: clean(data.fromUid, 128),
    fromName: clean(data.fromName, 60),
    toUid: clean(data.toUid, 128),
    toName: clean(data.toName, 60),
    status: data.status === 'accepted' ? 'accepted' : 'pending',
    gameUpdatedAt: clean(data.gameUpdatedAt, 40),
    stateJson: String(data.stateJson || ''),
    createdAt: hostTransferTimestamp(data.createdAt),
    updatedAt: hostTransferTimestamp(data.updatedAt),
    acceptedAt: hostTransferTimestamp(data.acceptedAt)
  };
}

export function createHostTransferDocument(user, profile, game, recipient) {
  if (!recipient?.uid || recipient.uid === user?.uid) throw new Error('Оберіть іншого авторизованого гравця');
  const backup = createActiveGameBackupDocument(user, game);
  return {
    gameId: backup.id,
    communityId: COMMUNITY_ID,
    fromUid: clean(user.uid, 128),
    fromName: hostName(user, profile, game),
    toUid: clean(recipient.uid, 128),
    toName: clean(recipient.name, 60) || 'Новий ведучий',
    gameTitle: clean(game.title, 80) || 'Гра в Мафію',
    status: 'pending',
    gameUpdatedAt: backup.gameUpdatedAt,
    stateJson: backup.stateJson,
    schemaVersion: 1,
    acceptedAt: null
  };
}

export async function requestGameHostTransfer(user, profile, game, recipient) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const fields = createHostTransferDocument(user, profile, game, recipient);
  const reference = hostTransferPath(sdk, database, fields.gameId);
  const existing = await sdk.getDoc(reference);
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: existing.exists() ? existing.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return fields;
}

export async function resolveGameHostTransfer(user, gameId) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const reference = hostTransferPath(sdk, database, clean(gameId, 160));
  const snapshot = await sdk.getDoc(reference);
  if (!snapshot.exists()) return;
  const transfer = hostTransferFromSnapshot(snapshot);
  if (![transfer.fromUid, transfer.toUid].includes(user.uid)) throw new Error('Цей запит вам недоступний');
  await sdk.deleteDoc(reference);
}

export async function acceptGameHostTransfer(user, profile, transfer) {
  if (!user?.uid || transfer?.toUid !== user.uid) throw new Error('Цей запит адресовано іншому користувачу');
  const { database, sdk } = await getCommunityFirestore();
  const gameId = clean(transfer.gameId, 160);
  const transferReference = hostTransferPath(sdk, database, gameId);
  const liveReference = liveGamePath(sdk, database, gameId);
  const [transferSnapshot, liveSnapshot] = await Promise.all([
    sdk.getDoc(transferReference),
    sdk.getDoc(liveReference)
  ]);
  if (!transferSnapshot.exists() || !liveSnapshot.exists()) throw new Error('Запит або активна гра вже недоступні');
  const currentTransfer = hostTransferFromSnapshot(transferSnapshot);
  if (currentTransfer.status !== 'pending' || currentTransfer.toUid !== user.uid) throw new Error('Запит уже оброблено');
  if (liveSnapshot.data().ownerUid !== currentTransfer.fromUid) throw new Error('Ведучий гри вже змінився');
  let game;
  try { game = JSON.parse(currentTransfer.stateJson); }
  catch { throw new Error('Не вдалося прочитати стан гри'); }
  if (game?.id !== gameId || game?.status !== 'active') throw new Error('Переданий стан гри пошкоджено');
  const acceptedAt = new Date().toISOString();
  game.ownerUid = user.uid;
  game.hostName = hostName(user, profile, game);
  game.updatedAt = acceptedAt;
  delete game.publicOnly;
  delete game.shared;
  delete game.source;
  delete game.cloudOwnerUid;
  delete game.cloudHostName;
  const publicFields = createActiveGameDocument(user, profile, game);
  const privateFields = createActiveGameBackupDocument(user, game);
  const batch = sdk.writeBatch(database);
  batch.set(activeGameBackupPath(sdk, database, user.uid, gameId), {
    ...privateFields,
    updatedAt: sdk.serverTimestamp()
  });
  batch.set(liveReference, {
    ...publicFields,
    createdAt: liveSnapshot.data().createdAt,
    updatedAt: sdk.serverTimestamp()
  });
  batch.update(transferReference, {
    status: 'accepted',
    acceptedAt: sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  await batch.commit();
  return game;
}

export async function subscribeGameHostTransfers(user, onTransfers, onError) {
  if (!user?.uid) return () => {};
  const { database, sdk } = await getCommunityFirestore();
  stopHostTransfers.forEach(stop => stop());
  stopHostTransfers = [];
  let incoming = [];
  let outgoing = [];
  const emit = () => onTransfers({
    incoming: [...incoming].sort((left, right) => right.updatedAt - left.updatedAt),
    outgoing: [...outgoing].sort((left, right) => right.updatedAt - left.updatedAt)
  });
  const collectionReference = sdk.collection(database, 'communities', COMMUNITY_ID, 'gameHostTransfers');
  stopHostTransfers.push(sdk.onSnapshot(
    sdk.query(collectionReference, sdk.where('toUid', '==', user.uid)),
    snapshot => { incoming = snapshot.docs.map(hostTransferFromSnapshot); emit(); },
    error => onError?.(error)
  ));
  stopHostTransfers.push(sdk.onSnapshot(
    sdk.query(collectionReference, sdk.where('fromUid', '==', user.uid)),
    snapshot => { outgoing = snapshot.docs.map(hostTransferFromSnapshot); emit(); },
    error => onError?.(error)
  ));
  return () => {
    stopHostTransfers.forEach(stop => stop());
    stopHostTransfers = [];
  };
}

export function stopGameHostTransfers() {
  stopHostTransfers.forEach(stop => stop());
  stopHostTransfers = [];
}

export function createFinishedGameDocument(user, profile, game) {
  if (game?.status !== 'finished' || !['red', 'black', 'draw'].includes(game.winner)) {
    throw new Error('До спільного архіву можна додати лише завершену гру');
  }
  return {
    id: clean(game.id, 160),
    communityId: COMMUNITY_ID,
    ownerUid: user.uid,
    hostName: hostName(user, profile, game),
    title: clean(game.title, 80) || 'Гра в Мафію',
    venue: clean(game.venue, 100),
    startedAt: clean(game.startedAt, 40),
    endedAt: clean(game.endedAt, 40),
    gameUpdatedAt: clean(game.updatedAt || game.endedAt, 40),
    status: 'finished',
    winner: game.winner,
    durationSeconds: integer(game.durationSeconds, 0, 31536000),
    day: integer(game.day, 1, 100),
    participantUids: authorizedGameParticipantUids(user, game),
    seats: (game.seats || []).slice(0, 10).map(sharedSeat),
    bestMove: sharedBestMove(game),
    history: (game.history || []).slice(0, 500).map(sharedEvent),
    schemaVersion: 1
  };
}

function finishedGameFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: clean(data.title, 80) || 'Гра в Мафію',
    venue: clean(data.venue, 100),
    startedAt: clean(data.startedAt, 40),
    endedAt: clean(data.endedAt, 40),
    updatedAt: clean(data.gameUpdatedAt || data.endedAt, 40),
    status: 'finished',
    phase: 'finished',
    winner: ['red', 'black', 'draw'].includes(data.winner) ? data.winner : null,
    durationSeconds: integer(data.durationSeconds, 0, 31536000),
    day: integer(data.day, 1, 100),
    participantUids: Array.isArray(data.participantUids)
      ? [...new Set(data.participantUids.map(value => clean(value, 128)).filter(Boolean))].slice(0, 11)
      : [],
    seats: Array.isArray(data.seats) ? data.seats.slice(0, 10).map(sharedSeat) : [],
    bestMove: sharedBestMove(data),
    history: Array.isArray(data.history) ? data.history.slice(0, 500).map(sharedEvent) : [],
    cloudOwnerUid: clean(data.ownerUid, 160),
    cloudHostName: clean(data.hostName, 60),
    shared: true,
    source: 'cloud'
  };
}

function activeGameFromSnapshot(snapshot) {
  const data = snapshot.data();
  const timer = data.timer || {};
  return {
    id: snapshot.id,
    title: clean(data.title, 80) || 'Гра в Мафію',
    venue: clean(data.venue, 100),
    startedAt: clean(data.startedAt, 40),
    endedAt: null,
    updatedAt: clean(data.gameUpdatedAt || data.startedAt, 40),
    status: 'active',
    participantUids: Array.isArray(data.participantUids)
      ? [...new Set(data.participantUids.map(value => clean(value, 128)).filter(Boolean))].slice(0, 11)
      : [],
    activePlayerUids: Array.isArray(data.activePlayerUids)
      ? [...new Set(data.activePlayerUids.map(value => clean(value, 128)).filter(Boolean))].slice(0, 10)
      : [],
    phase: ACTIVE_PHASES.has(data.phase) ? data.phase : 'day',
    subphase: clean(data.subphase, 40),
    winner: null,
    durationSeconds: 0,
    day: integer(data.day, 1, 100),
    seats: Array.isArray(data.seats) ? data.seats.slice(0, 10).map(liveSeat) : [],
    nominations: Array.isArray(data.nominations) ? data.nominations.slice(0, 10).map(number => integer(number, 1, 10)) : [],
    speakerIndex: integer(data.speakerIndex, 0, 9),
    speakerOrder: Array.isArray(data.speakerOrder) ? data.speakerOrder.slice(0, 10).map(number => integer(number, 1, 10)) : [],
    lastWordSeat: integer(data.lastWordSeat, 0, 10) || null,
    vote: { counts: {}, tied: Array.isArray(data.tied) ? data.tied.slice(0, 10).map(number => integer(number, 1, 10)) : [], yes: 0, no: 0 },
    night: { step: integer(data.nightStep, 0, 4), target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    timer: {
      remaining: integer(timer.remaining, 0, 3600),
      running: Boolean(timer.running),
      purpose: clean(timer.purpose, 24),
      endsAt: timer.running ? integer(timer.endsAt, 0, 9999999999999) : 0
    },
    history: [],
    cloudOwnerUid: clean(data.ownerUid, 160),
    cloudHostName: clean(data.hostName, 60),
    shared: true,
    publicOnly: true,
    source: 'cloud-live'
  };
}

export async function saveActiveCommunityGame(user, profile, game) {
  const result = await liveGameApiRequest({
    action: 'upsert',
    game: createActiveGameDocument(user, profile, game)
  });
  return result.changed !== false;
}

export async function saveActiveGameBackup(user, game) {
  const { database, sdk } = await getCommunityFirestore();
  const fields = createActiveGameBackupDocument(user, game);
  await sdk.setDoc(activeGameBackupPath(sdk, database, user.uid, fields.id), {
    ...fields,
    updatedAt: sdk.serverTimestamp()
  });
  return true;
}

export async function loadActiveGameBackup(user, gameId) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  const { database, sdk } = await getCommunityFirestore();
  const cleanGameId = clean(gameId, 160);
  const snapshot = await sdk.getDoc(activeGameBackupPath(sdk, database, user.uid, cleanGameId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (data.ownerUid !== user.uid || data.id !== cleanGameId || data.schemaVersion !== 1) return null;
  try {
    const game = JSON.parse(data.stateJson);
    return game?.id === data.id && game?.status === 'active' ? game : null;
  } catch {
    return null;
  }
}

export async function deleteActiveGameBackup(user, gameId) {
  if (!user?.uid) return;
  const { database, sdk } = await getCommunityFirestore();
  await sdk.deleteDoc(activeGameBackupPath(sdk, database, user.uid, clean(gameId, 160)));
}

export async function deleteActiveCommunityGame(user, gameId) {
  if (!user?.uid) throw new Error('Спочатку увійдіть через Google');
  await liveGameApiRequest({ action: 'delete', gameId: clean(gameId, 160) });
}

export async function saveFinishedCommunityGame(user, profile, game) {
  const { database, sdk } = await getCommunityFirestore();
  const fields = createFinishedGameDocument(user, profile, game);
  const reference = gamePath(sdk, database, fields.id);
  const snapshot = await sdk.getDoc(reference);
  const storedParticipants = snapshot.exists() && Array.isArray(snapshot.data().participantUids)
    ? snapshot.data().participantUids
    : [];
  fields.participantUids = [...new Set([
    ...storedParticipants.map(value => clean(value, 128)).filter(Boolean),
    ...fields.participantUids
  ])].slice(0, 11);
  const sameParticipants = storedParticipants.length === fields.participantUids.length
    && storedParticipants.every(uid => fields.participantUids.includes(uid));
  if (snapshot.exists()
    && snapshot.data().ownerUid === user.uid
    && snapshot.data().gameUpdatedAt === fields.gameUpdatedAt
    && sameParticipants) return false;
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return true;
}

export async function deleteFinishedCommunityGame(user, gameId, { tombstone = true } = {}) {
  const { database, sdk } = await getCommunityFirestore();
  const cleanGameId = clean(gameId, 160);
  const reference = gamePath(sdk, database, cleanGameId);
  const snapshot = await sdk.getDoc(reference);
  if (!snapshot.exists()) return;
  if (snapshot.data().ownerUid !== user.uid) throw new Error('Цю гру може видалити лише її ведучий');
  if (tombstone) {
    await sdk.setDoc(gameDeletionPath(sdk, database, cleanGameId), {
      id: cleanGameId,
      communityId: COMMUNITY_ID,
      ownerUid: user.uid,
      deletedAt: sdk.serverTimestamp(),
      schemaVersion: 1
    });
  }
  await sdk.deleteDoc(reference);
}

export function excludeDeletedGames(games, deletedGameIds) {
  const deleted = deletedGameIds instanceof Set ? deletedGameIds : new Set(deletedGameIds || []);
  return (games || []).filter(game => !deleted.has(game.id));
}

export async function subscribeCommunityGames(onGames, onError) {
  const { database, sdk } = await getCommunityFirestore();
  stopArchive?.();
  let finished = [];
  let active = [];
  let deletedGameIds = new Set();
  let finishedReady = false;
  let activeReady = false;
  let deletionsReady = false;
  let finishedError = null;
  let activeError = null;
  let deletionsError = null;
  let finishedMetadata = { fromCache: true, hasPendingWrites: false };
  let activeMetadata = { fromCache: true, hasPendingWrites: false };
  let deletionsMetadata = { fromCache: true, hasPendingWrites: false };
  const emit = () => onGames(
    [...active, ...excludeDeletedGames(finished, deletedGameIds)].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
    {
      ready: finishedReady && activeReady && deletionsReady,
      error: activeError || finishedError || deletionsError,
      fromCache: finishedMetadata.fromCache && activeMetadata.fromCache && deletionsMetadata.fromCache,
      hasPendingWrites: finishedMetadata.hasPendingWrites || activeMetadata.hasPendingWrites || deletionsMetadata.hasPendingWrites,
      deletedGameIds: [...deletedGameIds]
    }
  );
  const stopFinished = sdk.onSnapshot(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'games'),
    { includeMetadataChanges: true },
    snapshot => {
      finished = snapshot.docs.map(finishedGameFromSnapshot);
      finishedReady = true;
      finishedError = null;
      finishedMetadata = snapshot.metadata;
      emit();
    },
    error => {
      finishedReady = true;
      finishedError = error;
      onError?.(error);
      emit();
    }
  );
  const stopActive = sdk.onSnapshot(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'liveGames'),
    { includeMetadataChanges: true },
    snapshot => {
      active = snapshot.docs.map(activeGameFromSnapshot);
      activeReady = true;
      activeError = null;
      activeMetadata = snapshot.metadata;
      emit();
    },
    error => {
      activeReady = true;
      activeError = error;
      onError?.(error);
      emit();
    }
  );
  const stopDeletions = sdk.onSnapshot(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'gameDeletions'),
    { includeMetadataChanges: true },
    snapshot => {
      deletedGameIds = new Set(snapshot.docs.map(document => document.id));
      deletionsReady = true;
      deletionsError = null;
      deletionsMetadata = snapshot.metadata;
      emit();
    },
    error => {
      deletionsReady = true;
      deletionsError = error;
      onError?.(error);
      emit();
    }
  );
  stopArchive = () => {
    stopFinished();
    stopActive();
    stopDeletions();
  };
  return () => {
    stopArchive?.();
    stopArchive = null;
  };
}

export function stopCommunityGames() {
  stopArchive?.();
  stopArchive = null;
}
