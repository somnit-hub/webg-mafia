import { FIREBASE_CONFIG, hasFirebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '12.16.0';
const APP_SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIRESTORE_SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
const COMMUNITY_ID = 'enjoy';
const MANUAL_AVATAR_PRESETS = new Set([
  './assets/avatars/raccoon.webp', './assets/avatars/cat.webp', './assets/avatars/capybara.webp',
  './assets/avatars/pug.webp', './assets/avatars/fox.webp', './assets/avatars/owl.webp',
  './assets/avatars/hamster.webp', './assets/avatars/lion.webp', './assets/avatars/frog.webp',
  './assets/avatars/boar.webp'
]);

let sdkPromise = null;
let databasePromise = null;
let stopDirectory = [];

function clean(value, maximum) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function profilePath(sdk, database, uid) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'members', uid);
}

export function manualPlayerDocumentId(user, localPlayerId) {
  const owner = clean(user?.uid, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  const player = clean(localPlayerId, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${owner}_${player}`.slice(0, 260);
}

function manualPlayerPath(sdk, database, user, localPlayerId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'manualPlayers', manualPlayerDocumentId(user, localPlayerId));
}

function manualPlayerPathById(sdk, database, documentId) {
  return sdk.doc(database, 'communities', COMMUNITY_ID, 'manualPlayers', clean(documentId, 260));
}

export function isPersistentManualPlayer(player) {
  return Boolean(
    clean(player?.id, 128)
    && clean(player?.name, 60)
    && !player?.cloudUid
    && !player?.linkedCloudUid
    && player?.autoGuestName !== true
    && player?.source !== 'temporary'
  );
}

function sharedAvatar(value) {
  const avatar = String(value || '').trim();
  if (!/^data:image\/(?:webp|jpeg|png);base64,/i.test(avatar)) return '';
  return avatar.length <= 350000 ? avatar : '';
}

export function resolveOwnProfilePhotoDataURL(localAvatar, remotePhotoDataURL) {
  return sharedAvatar(remotePhotoDataURL) || sharedAvatar(localAvatar);
}

function sharedAvatarPreset(value) {
  const preset = clean(value, 80);
  return MANUAL_AVATAR_PRESETS.has(preset) ? preset : '';
}

export function createSharedManualPlayerFields(user, hostProfile, player) {
  if (!user?.uid || !isPersistentManualPlayer(player)) throw new Error('Профіль гравця не готовий до синхронізації');
  const contact = clean(player.contact, 100);
  const publicClub = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) ? 'Enjoy' : contact || 'Enjoy';
  return {
    id: manualPlayerDocumentId(user, player.id),
    communityId: COMMUNITY_ID,
    ownerUid: clean(user.uid, 128),
    ownerName: clean(hostProfile?.nickname || hostProfile?.displayName || user.googleName || 'Ведучий', 60),
    localPlayerId: clean(player.id, 128),
    displayName: clean(player.name, 60),
    nickname: clean(player.nickname, 40),
    club: publicClub,
    description: clean(player.notes, 600),
    photoDataURL: sharedAvatar(player.avatar),
    avatarPreset: sharedAvatarPreset(player.avatarPreset),
    profileUpdatedAt: player.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

export function updateSharedManualPlayerFields(existing, player) {
  return {
    id: clean(existing.id, 260),
    communityId: COMMUNITY_ID,
    ownerUid: clean(existing.ownerUid, 128),
    ownerName: clean(existing.ownerName, 60),
    localPlayerId: clean(existing.localPlayerId, 128),
    displayName: clean(player.name, 60),
    nickname: clean(player.nickname, 40),
    club: clean(player.contact || existing.club || 'Enjoy', 100),
    description: clean(player.notes, 600),
    photoDataURL: sharedAvatar(player.avatar),
    avatarPreset: sharedAvatarPreset(player.avatarPreset),
    profileUpdatedAt: player.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

export function createOwnCommunityProfileFields(user, profile) {
  return {
    uid: user.uid,
    communityId: COMMUNITY_ID,
    displayName: clean(profile.displayName || user.googleName || user.email?.split('@')[0], 60),
    nickname: clean(profile.nickname, 40),
    club: clean(profile.club || 'Enjoy', 100),
    description: clean(profile.description, 600),
    photoURL: clean(user.googlePhotoURL, 2048),
    photoDataURL: sharedAvatar(profile.avatar),
    discoverable: profile.discoverable !== false,
    profileUpdatedAt: profile.updatedAt || new Date().toISOString(),
    schemaVersion: 1
  };
}

function memberFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    uid: snapshot.id,
    displayName: clean(data.displayName, 60),
    nickname: clean(data.nickname, 40),
    club: clean(data.club, 100),
    description: clean(data.description, 600),
    photoURL: clean(data.photoURL, 2048),
    photoDataURL: sharedAvatar(data.photoDataURL),
    discoverable: data.discoverable !== false,
    profileUpdatedAt: clean(data.profileUpdatedAt, 40)
  };
}

function manualPlayerFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    kind: 'manual',
    id: snapshot.id,
    ownerUid: clean(data.ownerUid, 128),
    ownerName: clean(data.ownerName, 60),
    localPlayerId: clean(data.localPlayerId, 128),
    displayName: clean(data.displayName, 60),
    nickname: clean(data.nickname, 40),
    club: clean(data.club, 100),
    description: clean(data.description, 600),
    photoDataURL: sharedAvatar(data.photoDataURL),
    avatarPreset: sharedAvatarPreset(data.avatarPreset),
    profileUpdatedAt: clean(data.profileUpdatedAt, 40)
  };
}

async function loadDatabase() {
  if (!hasFirebaseConfig()) throw new Error('Спільне сховище не налаштоване');
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    if (!sdkPromise) {
      sdkPromise = Promise.all([import(APP_SDK), import(FIRESTORE_SDK)]).then(([appSdk, firestoreSdk]) => ({ appSdk, firestoreSdk }));
    }
    const { appSdk, firestoreSdk } = await sdkPromise;
    const firebaseApp = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
    let database;
    try {
      database = firestoreSdk.initializeFirestore(firebaseApp, {
        localCache: firestoreSdk.persistentLocalCache({
          tabManager: firestoreSdk.persistentMultipleTabManager()
        })
      });
    } catch {
      database = firestoreSdk.getFirestore(firebaseApp);
    }
    return { database, sdk: firestoreSdk };
  })();
  return databasePromise;
}

export async function getCommunityFirestore() {
  return loadDatabase();
}

async function writeOwnProfile(user, profile, existingCreatedAt = null) {
  const { database, sdk } = await loadDatabase();
  const reference = profilePath(sdk, database, user.uid);
  await sdk.setDoc(reference, {
    ...createOwnCommunityProfileFields(user, profile),
    createdAt: existingCreatedAt || sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp(),
    lastSeenAt: sdk.serverTimestamp()
  }, { merge: true });
}

export async function reconcileOwnCommunityProfile(user, profile, { hasLocalProfile = false } = {}) {
  const { database, sdk } = await loadDatabase();
  const reference = profilePath(sdk, database, user.uid);
  const snapshot = await sdk.getDoc(reference);
  if (!snapshot.exists()) {
    await writeOwnProfile(user, profile);
    return { ...createOwnCommunityProfileFields(user, profile), uid: user.uid };
  }

  const remote = memberFromSnapshot(snapshot);
  const localIsNewer = hasLocalProfile && String(profile.updatedAt || '') > String(remote.profileUpdatedAt || '');
  if (localIsNewer) {
    await writeOwnProfile(user, profile, snapshot.data().createdAt);
    return { ...createOwnCommunityProfileFields(user, profile), uid: user.uid };
  }

  // A local custom photo must not be lost merely because another profile field has a newer timestamp.
  // Existing shared photos still win; this only fills an empty shared photo.
  const resolvedPhotoDataURL = resolveOwnProfilePhotoDataURL(profile.avatar, remote.photoDataURL);
  await sdk.updateDoc(reference, {
    photoURL: clean(user.googlePhotoURL, 2048),
    photoDataURL: resolvedPhotoDataURL,
    lastSeenAt: sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return { ...remote, photoDataURL: resolvedPhotoDataURL };
}

export async function saveOwnCommunityProfile(user, profile) {
  const { database, sdk } = await loadDatabase();
  const reference = profilePath(sdk, database, user.uid);
  const snapshot = await sdk.getDoc(reference);
  await writeOwnProfile(user, profile, snapshot.exists() ? snapshot.data().createdAt : null);
}

export async function deleteOwnCommunityProfile(user) {
  if (!user?.uid) throw new Error('Профіль користувача не знайдено');
  const { database, sdk } = await loadDatabase();
  await sdk.deleteDoc(profilePath(sdk, database, user.uid));
}

export async function saveSharedManualPlayer(user, hostProfile, player, { force = false } = {}) {
  const { database, sdk } = await loadDatabase();
  const sharedDocumentId = clean(player.cloudManualId, 260);
  const reference = sharedDocumentId
    ? manualPlayerPathById(sdk, database, sharedDocumentId)
    : manualPlayerPath(sdk, database, user, player.id);
  const snapshot = await sdk.getDoc(reference);
  const existing = snapshot.exists() ? manualPlayerFromSnapshot(snapshot) : null;
  if (existing && !force && String(existing.profileUpdatedAt || '') > String(player.updatedAt || '')) {
    return existing;
  }
  const fields = existing
    ? updateSharedManualPlayerFields(existing, player)
    : createSharedManualPlayerFields(user, hostProfile, player);
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: snapshot.exists() ? snapshot.data().createdAt : sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return fields;
}

export async function deleteSharedManualPlayer(user, localPlayerId, cloudManualId = '') {
  if (!user?.uid || (!localPlayerId && !cloudManualId)) return;
  const { database, sdk } = await loadDatabase();
  const reference = cloudManualId
    ? manualPlayerPathById(sdk, database, cloudManualId)
    : manualPlayerPath(sdk, database, user, localPlayerId);
  await sdk.deleteDoc(reference);
}

export async function deleteAllOwnedManualPlayers(user) {
  if (!user?.uid) return;
  const { database, sdk } = await loadDatabase();
  const request = sdk.query(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'manualPlayers'),
    sdk.where('ownerUid', '==', user.uid)
  );
  const snapshot = await sdk.getDocs(request);
  await Promise.all(snapshot.docs.map(document => sdk.deleteDoc(document.ref)));
}

export async function subscribeCommunityProfiles(onProfiles, onError) {
  const { database, sdk } = await loadDatabase();
  stopCommunityProfiles();
  const memberRequest = sdk.query(
    sdk.collection(database, 'communities', COMMUNITY_ID, 'members'),
    sdk.where('discoverable', '==', true)
  );
  const manualRequest = sdk.collection(database, 'communities', COMMUNITY_ID, 'manualPlayers');
  let members = [];
  let manualPlayers = [];
  let membersReady = false;
  let manualReady = false;
  let membersFromCache = false;
  let manualFromCache = false;
  const emit = () => {
    if (!membersReady || !manualReady) return;
    onProfiles([...members, ...manualPlayers]
      .sort((left, right) => (left.nickname || left.displayName).localeCompare(right.nickname || right.displayName, 'uk')), {
      fromCache: membersFromCache || manualFromCache
    });
  };
  stopDirectory = [
    sdk.onSnapshot(memberRequest, { includeMetadataChanges: true }, snapshot => {
      members = snapshot.docs.map(memberFromSnapshot);
      membersReady = true;
      membersFromCache = snapshot.metadata.fromCache;
      emit();
    }, error => onError?.(error)),
    sdk.onSnapshot(manualRequest, { includeMetadataChanges: true }, snapshot => {
      manualPlayers = snapshot.docs.map(manualPlayerFromSnapshot);
      manualReady = true;
      manualFromCache = snapshot.metadata.fromCache;
      emit();
    }, error => onError?.(error))
  ];
  return () => {
    stopCommunityProfiles();
  };
}

export function stopCommunityProfiles() {
  stopDirectory.forEach(stop => stop?.());
  stopDirectory = [];
}
