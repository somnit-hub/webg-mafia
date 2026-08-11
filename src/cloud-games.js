import { getCommunityFirestore } from './cloud-profiles.js';

const COMMUNITY_ID = 'enjoy';
const ACTIVE_PHASES = new Set(['reveal', 'zeroNight', 'day', 'vote', 'tieSpeech', 'tieVote', 'allTie', 'lastWord', 'night']);
let stopArchive = null;

function clean(value, maximum) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function integer(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)));
}

function gamePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'games', gameId);
}

function liveGamePath(sdk, database, gameId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'liveGames', gameId);
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

export function createFinishedGameDocument(user, profile, game) {
  if (game?.status !== 'finished' || !['red', 'black'].includes(game.winner)) {
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
    seats: (game.seats || []).slice(0, 10).map(sharedSeat),
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
    winner: ['red', 'black'].includes(data.winner) ? data.winner : null,
    durationSeconds: integer(data.durationSeconds, 0, 31536000),
    day: integer(data.day, 1, 100),
    seats: Array.isArray(data.seats) ? data.seats.slice(0, 10).map(sharedSeat) : [],
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
  const { database, sdk } = await getCommunityFirestore();
  const fields = createActiveGameDocument(user, profile, game);
  const reference = liveGamePath(sdk, database, fields.id);
  const snapshot = await sdk.getDoc(reference);
  if (snapshot.exists()
    && snapshot.data().ownerUid === user.uid
    && snapshot.data().gameUpdatedAt === fields.gameUpdatedAt) return false;
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return true;
}

export async function deleteActiveCommunityGame(user, gameId) {
  const { database, sdk } = await getCommunityFirestore();
  const reference = liveGamePath(sdk, database, clean(gameId, 160));
  const snapshot = await sdk.getDoc(reference);
  if (!snapshot.exists()) return;
  if (snapshot.data().ownerUid !== user.uid) throw new Error('Цю гру може змінювати лише її ведучий');
  await sdk.deleteDoc(reference);
}

export async function saveFinishedCommunityGame(user, profile, game) {
  const { database, sdk } = await getCommunityFirestore();
  const fields = createFinishedGameDocument(user, profile, game);
  const reference = gamePath(sdk, database, fields.id);
  const snapshot = await sdk.getDoc(reference);
  if (snapshot.exists()
    && snapshot.data().ownerUid === user.uid
    && snapshot.data().gameUpdatedAt === fields.gameUpdatedAt) return false;
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return true;
}

export async function deleteFinishedCommunityGame(user, gameId) {
  const { database, sdk } = await getCommunityFirestore();
  const reference = gamePath(sdk, database, clean(gameId, 160));
  const snapshot = await sdk.getDoc(reference);
  if (!snapshot.exists()) return;
  if (snapshot.data().ownerUid !== user.uid) throw new Error('Цю гру може видалити лише її ведучий');
  await sdk.deleteDoc(reference);
}

export async function subscribeCommunityGames(onGames, onError) {
  const { database, sdk } = await getCommunityFirestore();
  stopArchive?.();
  let finished = [];
  let active = [];
  let finishedMetadata = { fromCache: true, hasPendingWrites: false };
  let activeMetadata = { fromCache: true, hasPendingWrites: false };
  const emit = () => onGames(
    [...active, ...finished].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
    {
      fromCache: finishedMetadata.fromCache && activeMetadata.fromCache,
      hasPendingWrites: finishedMetadata.hasPendingWrites || activeMetadata.hasPendingWrites
    }
  );
  const stopFinished = sdk.onSnapshot(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'games'),
    { includeMetadataChanges: true },
    snapshot => {
      finished = snapshot.docs.map(finishedGameFromSnapshot);
      finishedMetadata = snapshot.metadata;
      emit();
    },
    error => onError?.(error)
  );
  const stopActive = sdk.onSnapshot(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'liveGames'),
    { includeMetadataChanges: true },
    snapshot => {
      active = snapshot.docs.map(activeGameFromSnapshot);
      activeMetadata = snapshot.metadata;
      emit();
    },
    error => onError?.(error)
  );
  stopArchive = () => {
    stopFinished();
    stopActive();
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
