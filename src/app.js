import {
  openDatabase, getAll, getOne, putOne, deleteOne, clearStore,
  getSetting, setSetting, importDatabase,
  useDatabaseForUser, getLegacyDatabase
} from './db.js';
import {
  initializeGoogleAuth, isGoogleAuthConfigured, signInWithGoogle,
  signOutGoogleAccount, authorizeGoogleDrive, observeGoogleAuth,
  reauthenticateGoogleAccount, deleteGoogleAccount, getFirebaseIdToken
} from './auth.js';
import {
  setDriveAccessToken, clearDriveAccess, getDriveSession, pushToDrive, pullFromDrive
} from './google-sync.js';
import { ENJOY_CAFE } from './enjoy.js';
import {
  reconcileOwnCommunityProfile, saveOwnCommunityProfile, deleteOwnCommunityProfile,
  deleteAllOwnedManualPlayers, deleteSharedManualPlayer, isPersistentManualPlayer,
  saveSharedManualPlayer, subscribeCommunityProfiles, stopCommunityProfiles
} from './cloud-profiles.js';
import {
  acceptPlayerLink, deleteOwnedPlayerLink, deleteAllOwnedPlayerLinks, findPendingPlayerLinks,
  isValidPlayerEmail, normalizePlayerEmail, subscribeOwnedPlayerLinks,
  stopPlayerLinks, upsertPlayerLink
} from './player-links.js';
import {
  saveActiveCommunityGame, deleteActiveCommunityGame,
  saveFinishedCommunityGame, deleteFinishedCommunityGame,
  subscribeCommunityGames, stopCommunityGames
} from './cloud-games.js';
import { adjustTimerBy, crossedCountdownWarning, timerRemainingAt } from './timer.js';
import {
  canLiftTiedCandidates, gameStateErrors, nightTargetIsAllowed, normalizeGameState, resolveVote,
  secureShuffle, toggleBestMoveCandidate, victoryForSeats
} from './game-engine.js';
import {
  TABLE_SIZE, consumeSeatedPlayers, lineupStatus, normalizeLineup,
  remapLineupPlayers, toggleLineupPlayer
} from './lineup.js';
import { pickFunnyGuestNames } from './guest-names.js';
import { LANGUAGES, applyLanguage, languageLocale, localizeDom, normalizeLanguage } from './i18n.js';
import { sendTelegramOrder } from './order-service.js';

const ROLE_DECK = [
  { key: 'sheriff', label: 'Шериф', team: 'red', symbol: '★', description: 'Щоночі перевіряє одного гравця та дізнається колір його команди.' },
  { key: 'don', label: 'Дон', team: 'black', symbol: '◆', description: 'Очолює чорну команду та щоночі шукає Шерифа.' },
  { key: 'mafia', label: 'Мафія', team: 'black', symbol: '●', description: 'Разом із Доном бере участь у нічній стрільбі.' },
  { key: 'mafia', label: 'Мафія', team: 'black', symbol: '●', description: 'Разом із Доном бере участь у нічній стрільбі.' },
  ...Array.from({ length: 6 }, () => ({ key: 'citizen', label: 'Мирний житель', team: 'red', symbol: '○', description: 'Шукає чорну команду логікою, промовою та голосом.' }))
];

const ROLE_SIGNAL_IMAGES = Object.freeze({
  citizen: './assets/signals/citizen.webp',
  mafia: './assets/signals/mafia.webp',
  don: './assets/signals/don.webp',
  sheriff: './assets/signals/sheriff.webp'
});

const CHECK_SIGNAL_IMAGES = Object.freeze({
  sheriffFound: './assets/signals/don-found-sheriff.webp',
  sheriffNotFound: './assets/signals/don-not-sheriff.webp'
});

const ANIMAL_AVATARS = Object.freeze([
  './assets/avatars/raccoon.webp', './assets/avatars/cat.webp',
  './assets/avatars/capybara.webp', './assets/avatars/pug.webp',
  './assets/avatars/fox.webp', './assets/avatars/owl.webp',
  './assets/avatars/hamster.webp', './assets/avatars/lion.webp',
  './assets/avatars/frog.webp', './assets/avatars/boar.webp'
]);

const ANIMAL_AVATAR_LABELS = Object.freeze({
  'raccoon.webp': 'Єнот', 'cat.webp': 'Кішка', 'capybara.webp': 'Капібара',
  'pug.webp': 'Мопс', 'fox.webp': 'Лисиця', 'owl.webp': 'Сова',
  'hamster.webp': 'Хом’як', 'lion.webp': 'Лев', 'frog.webp': 'Жабка',
  'boar.webp': 'Кабанчик'
});

const RULES_LINKS = Object.freeze({
  ukrainian: 'https://www.imafia.org/game-rules',
  international: 'https://fiim.world/fiim-rules'
});

const ORDER_MENU = Object.freeze([
  { key: 'coffee', label: 'Кава' },
  { key: 'tea', label: 'Чай' },
  { key: 'cappuccino', label: 'Капучино' },
  { key: 'latte', label: 'Лате' }
]);

const DEFAULT_SETTINGS = {
  speech: 60,
  tieSpeech: 30,
  lastWord: 60,
  nightCheck: 10,
  mafiaMeet: 60,
  sheriffMark: 10,
  freeSeating: 20,
  bestMove: 20,
  sound: true,
  haptics: true,
  theme: 'dark',
  language: 'uk',
  firstDaySingleNoVote: true,
  lastGetsRemainder: true,
  penaltyMode: 'tournament'
};

const FOUL_SYSTEM_HELP = 'Турнірна: 3 фоли — без промови, 4-й фол — гравець залишає стіл. Клубна: 2 фоли — промова 30 секунд, 3 фоли — без права голосу, 4-й фол — гравець залишає стіл.';

const THEMES = ['dark', 'light', 'cafe'];
const THEME_COLORS = { dark: '#0d0c0b', light: '#e9e2d6', cafe: '#1a100b' };
const ANDROID_BLUETOOTH_SETTINGS_URL = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
const CLIENT_PLATFORM = /Android/i.test(navigator.userAgent)
  ? 'android'
  : /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ? 'ios'
    : 'desktop';
document.documentElement.dataset.platform = CLIENT_PLATFORM;

const CHANNEL_NAME = 'mafia-desk-live';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const $ = selector => document.querySelector(selector);
const appRoot = $('#app');
const modalRoot = $('#modal-root');
const tooltipRoot = $('#tooltip-root');

let app = {
  route: 'home',
  localPlayers: [],
  cloudPlayers: [],
  players: [],
  localGames: [],
  cloudGames: [],
  games: [],
  settings: { ...DEFAULT_SETTINGS },
  draft: null,
  game: null,
  modal: null,
  tooltip: null,
  installPrompt: null,
  undo: [],
  timerHandle: null,
  gameTransitionBusy: false,
  observerTimerHandle: null,
  wakeLock: null,
  toastHandle: null,
  search: '',
  nextGameQueue: [],
  authReady: false,
  authConfigured: false,
  authUser: null,
  authError: '',
  hostProfile: null,
  cloudDirectory: { status: 'idle', error: '', fromCache: false },
  cloudArchive: { status: 'idle', error: '', fromCache: false },
  ownedPlayerLinks: [],
  playerLinkOffers: [],
  playerLinkBusy: false,
  legacyMigration: null,
  authBusy: false,
  accountDeleteBusy: false,
  media: { trackName: '', playing: false, error: '' },
  order: { busy: false, status: 'idle', error: '', lastItem: '' },
  profilePhotoSync: { status: 'idle' },
  bluetooth: {
    supported: 'bluetooth' in navigator,
    available: null,
    deviceName: '',
    busy: false,
    error: ''
  },
  panelExpanded: {
    setupGame: false,
    setupTimers: false,
    setupRules: false,
    setupSeating: true,
    statsRoles: false,
    statsPlayers: true
  }
};
let activationPromise = null;
let activationUid = null;
let cloudDirectoryPromise = null;
let cloudArchivePromise = null;
let cloudArchiveMigrationStarted = false;
let activeGamePublishPromise = null;
const pendingActiveGames = new Map();
const presetAvatarDataUrls = new Map();

const LOCAL_AUTH_TEST = ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).get('auth_test') === '1';

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function applyTheme(value) {
  const theme = THEMES.includes(value) ? value : 'dark';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try { localStorage.setItem('mafia-desk-theme', theme); } catch { /* IndexedDB remains authoritative. */ }
  return theme;
}
function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(languageLocale(app.settings.language), withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function formatDuration(seconds = 0) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} хв`;
  return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
}
function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
function initials(name = '?') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}
function avatar(player, size = '') {
  const source = player?.avatar || player?.avatarPreset || '';
  if (source) return `<img class="avatar ${size}" src="${esc(source)}" alt="Фото ${esc(player.name)}">`;
  return `<span class="avatar avatar-fallback ${size}" aria-hidden="true">${esc(initials(player?.name))}</span>`;
}

function avatarHash(key = '') {
  return [...String(key)].reduce((value, character) => ((value * 31) + character.codePointAt(0)) >>> 0, 2166136261);
}

function setupAvatarKey(seat, player) {
  return String(player?.id || seat?.name || `seat-${seat?.number || 0}`);
}

function setupAnimalAvatarMap() {
  const assigned = new Map();
  const used = new Set();
  app.draft.seats.forEach(seat => {
    const player = seat.profileId ? playerById(seat.profileId) : null;
    const presetIndex = ANIMAL_AVATARS.indexOf(player?.avatarPreset || '');
    if (presetIndex >= 0) used.add(presetIndex);
  });
  app.draft.seats.map(seat => {
    const player = seat.profileId ? playerById(seat.profileId) : null;
    return player?.avatar ? null : setupAvatarKey(seat, player);
  }).filter(Boolean).sort((a, b) => a.localeCompare(b, 'uk')).forEach(key => {
    if (assigned.has(key)) return;
    let index = avatarHash(key) % ANIMAL_AVATARS.length;
    while (used.has(index)) index = (index + 1) % ANIMAL_AVATARS.length;
    assigned.set(key, ANIMAL_AVATARS[index]);
    used.add(index);
  });
  return assigned;
}

function setupSeatAvatar(seat, player) {
  const savedSource = player?.avatar || player?.avatarPreset || '';
  const source = savedSource || setupAnimalAvatarMap().get(setupAvatarKey(seat, player)) || ANIMAL_AVATARS[0];
  const fallback = savedSource ? '' : ' generated-avatar';
  const image = `<img class="seat-inline-avatar${fallback}" src="${esc(source)}" alt="">`;
  if (!editableManualPlayer(player)) return `<span class="seat-avatar-control" aria-hidden="true">${image}</span>`;
  return `<button class="seat-avatar-control editable" type="button" data-action="open-setup-avatar" data-seat="${seat.number}" aria-label="Змінити аватар ${esc(preferredPlayerName(player))}" title="Змінити аватар">${image}<span class="seat-avatar-edit-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 16-1 4 4-1L19 8l-3-3L5 16Zm9-9 3 3"/></svg></span></button>`;
}
function hostAvatar(size = '') {
  const profile = app.hostProfile || {};
  return avatar({ name: profile.displayName || app.authUser?.googleName || 'Google', avatar: profile.avatar || app.authUser?.googlePhotoURL || '' }, size);
}

function profilePhotoSyncHtml(hasPhoto = Boolean(app.hostProfile?.avatar), status = app.profilePhotoSync.status) {
  if (!hasPhoto) return '';
  const copy = {
    synced: ['green', 'Фото синхронізовано'],
    syncing: ['gold', 'Синхронізація фото…'],
    pending: ['', 'Фото ще не синхронізовано'],
    error: ['red', 'Фото очікує синхронізації']
  };
  const [tone, label] = copy[status] || copy.pending;
  return `<span class="badge ${tone} profile-photo-sync-status" data-photo-sync-status="${esc(status || 'pending')}" role="status" aria-live="polite">${esc(label)}</span>`;
}
function roleOf(seat) { return ROLE_DECK.find(role => role.key === seat?.role) || null; }
function teamOf(seat) { return roleOf(seat)?.team || null; }
function roleSignal(roleKey, className = '', alt = '') {
  const role = ROLE_DECK.find(item => item.key === roleKey);
  const label = alt || `Сигнал ведучого: ${role?.label || roleKey}`;
  return `<span class="role-signal ${className}"><img src="${ROLE_SIGNAL_IMAGES[roleKey]}" width="640" height="640" alt="${esc(label)}" decoding="async"></span>`;
}
function checkSignal(signalKey, className = '', alt = '') {
  return `<span class="role-signal check-signal ${className}"><img src="${CHECK_SIGNAL_IMAGES[signalKey]}" width="640" height="640" alt="${esc(alt)}" decoding="async"></span>`;
}
function activeGames() { return app.games.filter(game => game.status === 'active').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
function finishedGames() { return app.games.filter(game => game.status === 'finished').sort((a, b) => (b.endedAt || b.updatedAt).localeCompare(a.endedAt || a.updatedAt)); }
function gameById(id) { return app.games.find(game => game.id === id); }
function playerById(id) { return app.players.find(player => player.id === id); }
function profileIsInActiveGame(profileId) {
  return Boolean(profileId) && activeGames().some(game => game.seats?.some(seat => seat.profileId === profileId));
}
function editableManualPlayer(player) {
  return isPersistentManualPlayer(player) && !profileIsInActiveGame(player.id);
}
function cloudPlayer(member) {
  if (member.kind === 'manual') return {
    id: member.localPlayerId,
    cloudManualId: member.id,
    cloudOwnerUid: member.ownerUid,
    source: 'shared-manual',
    name: member.displayName,
    nickname: member.nickname || '',
    contact: member.club || 'Enjoy',
    notes: member.description || '',
    avatar: member.photoDataURL || '',
    avatarPreset: member.avatarPreset || '',
    updatedAt: member.profileUpdatedAt || ''
  };
  return {
    id: `google_${member.uid}`,
    cloudUid: member.uid,
    source: 'cloud',
    name: member.displayName,
    nickname: member.nickname || '',
    contact: member.club || 'Enjoy',
    notes: member.description || '',
    avatar: member.photoDataURL || member.photoURL || '',
    updatedAt: member.profileUpdatedAt || ''
  };
}
function preferredPlayerName(player) {
  return String(player?.nickname || '').trim() || String(player?.name || '').trim();
}

function preferredGameHostName(game) {
  const ownerUid = game?.cloudOwnerUid || game?.ownerUid || '';
  if (ownerUid && ownerUid === app.authUser?.uid) {
    return String(app.hostProfile?.nickname || '').trim()
      || String(app.hostProfile?.displayName || '').trim()
      || String(app.authUser?.googleName || '').trim();
  }
  const directoryHost = ownerUid ? playerById(`google_${ownerUid}`) : null;
  return preferredPlayerName(directoryHost) || String(game?.cloudHostName || game?.hostName || '').trim();
}

function draftSeatsForPlayers(selectedPlayers = [], previousSeats = []) {
  const manualGuests = new Map(previousSeats
    .filter(seat => !seat.profileId && seat.autoGuestName === false && String(seat.name || '').trim())
    .map(seat => [seat.number, String(seat.name).trim()]));
  const reservedNames = [
    ...selectedPlayers.map(preferredPlayerName),
    ...manualGuests.values()
  ];
  const generatedNames = pickFunnyGuestNames(TABLE_SIZE - selectedPlayers.length, reservedNames);
  let generatedIndex = 0;

  return Array.from({ length: TABLE_SIZE }, (_, index) => {
    const player = selectedPlayers[index];
    if (player) return {
      number: index + 1,
      profileId: player.id,
      name: preferredPlayerName(player),
      autoGuestName: false
    };
    const manualName = manualGuests.get(index + 1);
    return {
      number: index + 1,
      profileId: '',
      name: manualName || generatedNames[generatedIndex++],
      autoGuestName: !manualName
    };
  });
}

function freshGuestName(excludedSeatNumber = 0) {
  const usedNames = app.draft?.seats
    .filter(seat => seat.number !== excludedSeatNumber)
    .map(seat => seat.name) || [];
  return pickFunnyGuestNames(1, usedNames)[0];
}

function queuedPlayers() {
  return normalizeLineup(app.nextGameQueue).map(playerById).filter(Boolean);
}

async function saveNextGameQueue() {
  app.nextGameQueue = normalizeLineup(app.nextGameQueue);
  await setSetting('nextGameQueue', app.nextGameQueue);
}

function fillDraftSeatsFromQueue() {
  if (!app.draft) return;
  const selected = queuedPlayers().slice(0, TABLE_SIZE);
  app.draft.seats = draftSeatsForPlayers(selected, app.draft.seats);
}
function mergePlayerSources() {
  const cloudByUid = new Map(app.cloudPlayers.filter(player => player.cloudUid).map(player => [player.cloudUid, player]));
  const cloudManualPlayers = app.cloudPlayers.filter(player => player.cloudManualId);
  const cloudManualByDocument = new Map(cloudManualPlayers.map(player => [player.cloudManualId, player]));
  const cloudManualByOwnedLocalId = new Map(cloudManualPlayers
    .filter(player => player.cloudOwnerUid === app.authUser?.uid)
    .map(player => [player.id, player]));
  const linkedUids = new Set(app.localPlayers.map(player => player.linkedCloudUid).filter(Boolean));
  const linkedLocalByUid = new Map();
  app.localPlayers.filter(player => player.linkedCloudUid).forEach(player => {
    const current = linkedLocalByUid.get(player.linkedCloudUid);
    if (!current || String(player.updatedAt || '') > String(current.updatedAt || '')) {
      linkedLocalByUid.set(player.linkedCloudUid, player);
    }
  });
  const linked = [...linkedLocalByUid.entries()].map(([linkedCloudUid, local]) => {
    const remote = cloudByUid.get(linkedCloudUid);
    return {
      ...local,
      ...(remote || {}),
      id: `google_${linkedCloudUid}`,
      cloudUid: linkedCloudUid,
      source: remote ? 'local+cloud-profile' : 'linked-profile',
      name: remote?.name || local.name,
      nickname: remote?.nickname || local.nickname || '',
      contact: remote?.contact || local.contact || 'Enjoy',
      notes: local.notes || remote?.notes || '',
      avatar: remote?.avatar || local.avatar || '',
      linkedLocalId: local.id,
      linkAccepted: true
    };
  });
  const mergedLocalPlayers = app.localPlayers.filter(player => !player.linkedCloudUid).map(local => {
    const remote = cloudManualByDocument.get(local.cloudManualId) || cloudManualByOwnedLocalId.get(local.id);
    if (!remote) return local;
    const remoteIsNewer = String(remote.updatedAt || '') >= String(local.updatedAt || '');
    return {
      ...local,
      ...(remoteIsNewer ? {
        name: remote.name,
        nickname: remote.nickname || '',
        contact: remote.contact || 'Enjoy',
        notes: remote.notes || '',
        avatar: remote.avatar || '',
        avatarPreset: remote.avatarPreset || ''
      } : {}),
      cloudManualId: remote.cloudManualId,
      cloudOwnerUid: remote.cloudOwnerUid,
      source: 'local+shared-manual',
      updatedAt: remoteIsNewer ? remote.updatedAt : local.updatedAt
    };
  });
  const mergedManualIds = new Set(mergedLocalPlayers.map(player => player.cloudManualId).filter(Boolean));
  app.players = [
    ...mergedLocalPlayers,
    ...linked,
    ...app.cloudPlayers.filter(player => player.cloudManualId
      ? !mergedManualIds.has(player.cloudManualId)
      : !linkedUids.has(player.cloudUid))
  ]
    .sort((left, right) => left.name.localeCompare(right.name, 'uk'));
}
function mergeGameSources() {
  const cloudById = new Map(app.cloudGames.map(game => [game.id, game]));
  const localIds = new Set(app.localGames.map(game => game.id));
  const local = app.localGames.map(game => {
    const remote = cloudById.get(game.id);
    return remote ? {
      ...game,
      shared: true,
      source: 'local+cloud',
      cloudOwnerUid: remote.cloudOwnerUid,
      cloudHostName: remote.cloudHostName
    } : game;
  });
  app.games = [...local, ...app.cloudGames.filter(game => !localIds.has(game.id))];
}
function canManageGame(game) {
  return Boolean(game) && (!game.cloudOwnerUid || game.cloudOwnerUid === app.authUser?.uid);
}
function seatByNo(number) { return app.game?.seats.find(seat => seat.number === Number(number)); }
function aliveSeats() { return app.game?.seats.filter(seat => seat.status === 'alive') || []; }
function voterCount() { return aliveSeats().filter(seat => !(app.game.settings.penaltyMode === 'club' && seat.noVote)).length; }
function currentSpeaker() {
  const order = app.game?.speakerOrder || [];
  return seatByNo(order[Math.min(app.game?.speakerIndex || 0, Math.max(0, order.length - 1))]);
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(app.toastHandle);
  app.toastHandle = setTimeout(() => element.classList.remove('show'), 2300);
}

function vibrate(pattern = 20) {
  if (app.settings.haptics && navigator.vibrate && (navigator.userActivation?.hasBeenActive ?? true)) navigator.vibrate(pattern);
}

let timerAudioContext = null;
const musicAudio = new Audio();
musicAudio.preload = 'metadata';
let musicObjectUrl = '';

function getTimerAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  timerAudioContext ||= new AudioContextClass();
  return timerAudioContext;
}

function prepareTimerAudio() {
  if (!app.settings.sound) return;
  try { getTimerAudioContext()?.resume?.().catch(() => {}); } catch { /* Audio is an enhancement. */ }
}

function scheduleTimerTone(context, delay, frequency, duration, volume, type = 'triangle') {
  const startsAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, startsAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + .02);
}

async function playTimerSound(kind) {
  if (!app.settings.sound) return;
  try {
    const context = getTimerAudioContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    if (kind === 'warning') {
      scheduleTimerTone(context, 0, 920, .11, .055, 'sine');
      return;
    }
    [[0, 880, .18, .24], [.23, 880, .18, .27], [.46, 660, .42, .34]].forEach(([delay, frequency, duration, volume]) => {
      scheduleTimerTone(context, delay, frequency, duration, volume, 'triangle');
      scheduleTimerTone(context, delay, frequency * 2, duration * .78, volume * .28, 'sine');
    });
  } catch { /* Audio is an enhancement. */ }
}

function setMediaSessionState(state) {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = state; } catch { /* Media Session is an enhancement. */ }
}

function updateMusicMetadata() {
  if (!('mediaSession' in navigator) || !('MediaMetadata' in window) || !app.media.trackName) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: app.media.trackName,
      artist: 'Mafia Enjoy',
      album: 'Музика гри'
    });
  } catch { /* Metadata is an enhancement. */ }
}

async function playMusic() {
  if (!app.media.trackName || !musicAudio.src) return toast('Спочатку оберіть аудіофайл');
  try {
    app.media.error = '';
    await musicAudio.play();
  } catch (error) {
    app.media.playing = false;
    app.media.error = 'Браузер не зміг відтворити цей аудіофайл.';
    setMediaSessionState('paused');
    render();
    toast(error?.message || app.media.error);
  }
}

function pauseMusic() {
  if (!app.media.trackName) return;
  musicAudio.pause();
}

function clearMusicTrack() {
  musicAudio.pause();
  musicAudio.removeAttribute('src');
  musicAudio.load();
  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = '';
  app.media = { trackName: '', playing: false, error: '' };
  setMediaSessionState('none');
}

function selectMusicFile(file) {
  clearMusicTrack();
  musicObjectUrl = URL.createObjectURL(file);
  musicAudio.src = musicObjectUrl;
  app.media.trackName = file.name || 'Локальний аудіофайл';
  updateMusicMetadata();
  render();
  toast('Музику підготовлено');
}

function configureMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.setActionHandler('play', () => { void playMusic(); }); } catch { /* Not supported. */ }
  try { navigator.mediaSession.setActionHandler('pause', pauseMusic); } catch { /* Not supported. */ }
  try { navigator.mediaSession.setActionHandler('stop', pauseMusic); } catch { /* Not supported. */ }
}

async function refreshBluetoothState() {
  if (!app.bluetooth.supported) return;
  try {
    app.bluetooth.available = typeof navigator.bluetooth.getAvailability === 'function'
      ? await navigator.bluetooth.getAvailability()
      : true;
    if (typeof navigator.bluetooth.getDevices === 'function') {
      const devices = await navigator.bluetooth.getDevices();
      const known = devices.find(device => device.name);
      if (known) app.bluetooth.deviceName = known.name;
    }
  } catch (error) {
    app.bluetooth.error = error?.message || 'Не вдалося перевірити Bluetooth.';
  }
  if (app.authUser) render();
}

async function requestBluetoothDevice() {
  if (!app.bluetooth.supported || !navigator.bluetooth?.requestDevice) {
    app.bluetooth.error = 'Цей браузер не підтримує вибір BLE-пристроїв.';
    render();
    return;
  }
  app.bluetooth.busy = true;
  app.bluetooth.error = '';
  render();
  try {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
    app.bluetooth.deviceName = device.name || 'BLE-пристрій';
    app.bluetooth.available = true;
    toast(`Доступ до «${app.bluetooth.deviceName}» надано`);
  } catch (error) {
    if (error?.name !== 'NotFoundError') app.bluetooth.error = error?.message || 'Не вдалося вибрати BLE-пристрій.';
  } finally {
    app.bluetooth.busy = false;
    render();
  }
}

musicAudio.addEventListener('play', () => {
  app.media.playing = true;
  app.media.error = '';
  setMediaSessionState('playing');
  render();
});
musicAudio.addEventListener('pause', () => {
  app.media.playing = false;
  setMediaSessionState(app.media.trackName ? 'paused' : 'none');
  render();
});
musicAudio.addEventListener('ended', () => {
  app.media.playing = false;
  setMediaSessionState('paused');
  render();
});
musicAudio.addEventListener('error', () => {
  if (!app.media.trackName) return;
  app.media.playing = false;
  app.media.error = 'Формат аудіо не підтримується або файл пошкоджений.';
  setMediaSessionState('paused');
  render();
});

function announceTimerEnd() {
  void playTimerSound('end');
  vibrate([90, 55, 90, 55, 150]);
  toast('Час вичерпано');
}

function routeFromHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [route, id] = raw.split('/');
  return { route: ['home', 'players', 'setup', 'game', 'stats', 'settings', 'observer', 'reveal'].includes(route) ? route : 'home', id };
}

function navigate(route) {
  location.hash = route;
}

function navIcon(name) {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
    players: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.3-4 2.1-6 5.5-6s5.2 2 5.5 6"/><path d="M16 7a3 3 0 0 1 0 6m1 2c2.3.4 3.5 2 3.7 5"/>',
    setup: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8"/>',
    stats: '<path d="M4 20V10m6 10V4m6 16v-7m5 7V7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    game: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v3m0 10v3M4 12h3m10 0h3"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function addPlayerIcon() {
  return '<svg class="add-player-fab-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="10" cy="9" r="4"/><path d="M2.5 25c.5-6 3-9 7.5-9 2.5 0 4.4.9 5.7 2.6"/><path class="fab-plus" d="M24 14v14M17 21h14"/></svg>';
}

function dealRolesIcon() {
  return '<svg class="deal-roles-fab-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="4" width="18" height="24" rx="3"/><path d="M9 8H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-1"/><path class="role-card-mark" d="m18 10 4 5-4 5-4-5 4-5Z"/></svg>';
}

function seatingIcon() {
  return '<svg class="seating-fab-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="7"/><circle cx="16" cy="3.8" r="2.4"/><circle cx="28.2" cy="16" r="2.4"/><circle cx="16" cy="28.2" r="2.4"/><circle cx="3.8" cy="16" r="2.4"/></svg>';
}

function cameraIcon() {
  return '<svg class="camera-button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.2a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="3.5"/><path d="M18.5 11.5h.01"/></svg>';
}

function eyeIcon() {
  return '<svg class="button-eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function externalAppIcon(name) {
  if (name === 'instagram') return `<svg class="external-app-icon instagram-app-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="instagram-app-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd600"/><stop offset=".46" stop-color="#ff0169"/><stop offset="1" stop-color="#7638fa"/></linearGradient></defs><rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#instagram-app-gradient)"/><rect x="5.7" y="5.7" width="12.6" height="12.6" rx="4" fill="none" stroke="white" stroke-width="1.8"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="white" stroke-width="1.8"/><circle cx="17.1" cy="6.9" r="1.1" fill="white"/></svg>`;
  return `<svg class="external-app-icon maps-app-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M12 1.5a7.4 7.4 0 0 1 7.4 7.4c0 5.4-7.4 13.6-7.4 13.6S4.6 14.3 4.6 8.9A7.4 7.4 0 0 1 12 1.5Z"/><path fill="#34a853" d="M4.6 8.9c0 3.2 2.7 7.4 4.8 10.2l2.6-4.4-4.1-7.1-3.3 1.3Z"/><path fill="#fbbc04" d="m9.4 19.1 2.6 3.4 2.8-3.7-2.8-4.1-2.6 4.4Z"/><path fill="#ea4335" d="M12 1.5a7.4 7.4 0 0 1 6.4 3.7L12 8.9 8 3.1A7.3 7.3 0 0 1 12 1.5Z"/><circle cx="12" cy="8.9" r="2.8" fill="white"/></svg>`;
}

function cafeIconLinks(className = '') {
  return `<div class="cafe-icon-links ${className}"><a class="cafe-icon-link" href="${esc(ENJOY_CAFE.instagramUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram Enjoy" title="Instagram Enjoy">${externalAppIcon('instagram')}</a><a class="cafe-icon-link" href="${esc(ENJOY_CAFE.mapsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps" title="Google Maps">${externalAppIcon('maps')}</a></div>`;
}

function headerControlIcon(name) {
  const paths = {
    bluetooth: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/><path d="m4 8 8 8m-8 0 8-8"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<path d="M8 5v14m8-14v14"/>',
    order: '<path d="M4 16h16M6 16a6 6 0 0 1 12 0M3 20h18M12 6v2"/><circle cx="12" cy="4" r="1"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function headerHtml() {
  const profileLabel = app.hostProfile?.displayName || app.authUser?.googleName || app.authUser?.email || 'Google';
  const hasTrack = Boolean(app.media.trackName);
  const bluetoothLabel = CLIENT_PLATFORM === 'ios' ? 'Підключити колонку на iPhone' : 'Bluetooth і музика';
  return `<header class="shell-header ${app.installPrompt && !['game', 'reveal'].includes(app.route) ? 'has-install' : ''}">
    <a class="brand" href="#home" aria-label="Mafia — головна">
      <img class="brand-mark" src="./assets/logo-mafia.webp" alt="" width="44" height="44" aria-hidden="true">
    </a>
    <div class="header-actions">
      ${app.installPrompt && !['game', 'reveal'].includes(app.route) ? '<button class="icon-btn install-btn" data-action="install" aria-label="Встановити застосунок" title="Встановити застосунок"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4"/></svg></button>' : ''}
      <button class="icon-btn order-btn" type="button" data-action="open-order-panel" aria-label="Замовити напій" title="Замовити напій" aria-haspopup="dialog">${headerControlIcon('order')}</button>
      <div class="header-media-controls" role="group" aria-label="Bluetooth і музика">
        <button class="icon-btn header-media-btn play-btn ${app.media.playing ? 'active' : ''}" data-action="media-play" aria-label="Відтворити музику" title="Відтворити музику" ${!hasTrack || app.media.playing ? 'disabled' : ''}>${headerControlIcon('play')}</button>
        <button class="icon-btn header-media-btn pause-btn" data-action="media-pause" aria-label="Призупинити музику" title="Призупинити музику" ${!hasTrack || !app.media.playing ? 'disabled' : ''}>${headerControlIcon('pause')}</button>
      </div>
      <div class="header-profile-actions">
        <button class="icon-btn header-media-btn bluetooth-btn browser-bluetooth-btn ${app.bluetooth.deviceName ? 'connected' : ''}" data-action="open-media-panel" aria-label="${bluetoothLabel}" title="${bluetoothLabel}" aria-haspopup="dialog">${headerControlIcon('bluetooth')}</button>
        <a class="icon-btn header-media-btn bluetooth-btn android-bluetooth-link" href="${ANDROID_BLUETOOTH_SETTINGS_URL}" aria-label="Відкрити системні налаштування Bluetooth" title="Системні налаштування Bluetooth" rel="external">${headerControlIcon('bluetooth')}</a>
        <button class="btn small secondary profile-btn" data-action="edit-host-profile" aria-label="Профіль ведучого">${hostAvatar('tiny')}<span>${esc(profileLabel)}</span></button>
      </div>
    </div>
  </header>`;
}

function bottomNavHtml() {
  if (app.route === 'observer') return '';
  if (['game', 'reveal'].includes(app.route)) {
    const currentRoute = app.route;
    const items = [
      ['home', 'Огляд'], ['players', 'Гравці'], [currentRoute, 'Активна гра', 'game'], ['stats', 'Статистика'], ['settings', 'Ще']
    ];
    return `<nav class="bottom-nav game-nav" aria-label="Навігація активної гри">${items.map(([route, label, icon = route]) => `
      <a class="nav-item ${route === currentRoute ? 'active' : ''}" href="#${route}" aria-label="${label}" title="${label}" ${route === currentRoute ? 'aria-current="page"' : ''}>${navIcon(icon)}<span>${label}</span></a>`).join('')}</nav>`;
  }
  const items = [
    ['home', 'Огляд'], ['players', 'Гравці'], ['setup', 'Нова гра'], ['stats', 'Статистика'], ['settings', 'Ще']
  ];
  return `<nav class="bottom-nav" aria-label="Основна навігація">${items.map(([route, label]) => `
    <a class="nav-item ${app.route === route ? 'active' : ''}" href="#${route}" ${app.route === route ? 'aria-current="page"' : ''}>${navIcon(route)}<span>${label}</span></a>`).join('')}</nav>`;
}

function helpIcon(text, label = 'Відкрити пояснення') {
  return `<button class="help" type="button" data-tooltip="${esc(text)}" aria-label="${esc(label)}" title="Пояснення">?</button>`;
}

function help(label, text) {
  return `<span class="label-with-help"><span>${label}</span>${helpIcon(text, `Пояснення: ${label}`)}</span>`;
}

function titleHelp(level, title, text) {
  return `<div class="title-with-help"><${level}>${title}</${level}>${helpIcon(text, `Пояснення: ${title.replace(/<[^>]*>/g, '')}`)}</div>`;
}

function pageHeader(title, explanation, action = '') {
  return `<div class="page-head">${titleHelp('h1', title, explanation)}${action}</div>`;
}

function languagePickerHtml() {
  const flags = {
    uk: '<svg viewBox="0 0 36 24"><rect width="36" height="12" fill="#0057b7"/><rect y="12" width="36" height="12" fill="#ffd700"/></svg>',
    ru: '<svg class="language-flag-neutral" viewBox="0 0 36 24"><path d="M7 3v19" stroke="#aaa096" stroke-width="2"/><path class="neutral-flag-field" d="M8 4c8-3 13 3 21 0v11c-8 3-13-3-21 0Z" fill="#111111" stroke="#736b63"/><circle cx="7" cy="3" r="1.5" fill="#aaa096"/></svg>',
    en: '<svg viewBox="0 0 36 24"><rect width="36" height="24" fill="#012169"/><path d="M0 0 36 24M36 0 0 24" stroke="#fff" stroke-width="5"/><path d="M0 0 36 24M36 0 0 24" stroke="#c8102e" stroke-width="2"/><path d="M18 0v24M0 12h36" stroke="#fff" stroke-width="8"/><path d="M18 0v24M0 12h36" stroke="#c8102e" stroke-width="4"/></svg>',
    fr: '<svg viewBox="0 0 36 24"><rect width="12" height="24" fill="#0055a4"/><rect x="12" width="12" height="24" fill="#fff"/><rect x="24" width="12" height="24" fill="#ef4135"/></svg>'
  };
  return `<div class="language-picker" role="radiogroup" aria-label="Мова застосунку">${LANGUAGES.map(language => {
    const selected = app.settings.language === language.code;
    return `<button class="language-choice ${selected ? 'selected' : ''}" type="button" role="radio" aria-checked="${selected}" aria-label="${esc(language.label)}" title="${esc(language.label)}" data-action="set-language" data-language="${language.code}" data-no-i18n><span class="language-flag" aria-hidden="true">${flags[language.code]}</span></button>`;
  }).join('')}</div>`;
}

function statusStrip(status, label, error, explanation, action = '') {
  const kind = status === 'online' ? 'success' : status === 'offline' ? 'offline' : status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'idle';
  return `<div class="ui-state ui-state-compact directory-status state-${kind}" role="status" aria-live="polite">${stateIcon(kind)}<div class="state-copy"><b>${esc(label)}</b>${error ? `<small>${esc(error)}</small>` : ''}</div>${helpIcon(explanation, 'Докладніше про синхронізацію')}${action}</div>`;
}

function stateIcon(kind = 'empty') {
  const paths = {
    empty: '<path d="M5 7h14v11H5z"/><path d="M8 4h8m-7 8h6"/>',
    idle: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    loading: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M17 3v4h4"/>',
    offline: '<path d="M4 4l16 16M8.5 8.5A7 7 0 0 1 19 10m-14 0a7 7 0 0 1 1.2-1.9M8 14a5.5 5.5 0 0 1 8 0m-5.5 3.5a2.2 2.2 0 0 1 3 0"/>',
    error: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>'
  };
  return `<span class="state-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[kind] || paths.empty}</svg></span>`;
}

function statePanel(kind, title, detail = '', action = '', compact = false) {
  return `<div class="ui-state state-${esc(kind)} ${compact ? 'ui-state-inline' : 'ui-state-panel'}" role="status">${stateIcon(kind)}<div class="state-copy"><b>${esc(title)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</div>${action}</div>`;
}

function collapsiblePanel(id, title, explanation, content, className = '') {
  const expanded = Boolean(app.panelExpanded[id]);
  const contentId = `panel-${id}`;
  return `<section class="card card-pad collapsible-panel ${expanded ? 'expanded' : 'collapsed'} ${className}" data-panel="${id}">
    <div class="collapsible-head section-heading">
      <button class="collapsible-toggle" type="button" data-action="toggle-panel" data-panel="${id}" aria-expanded="${expanded}" aria-controls="${contentId}">
        <span class="panel-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span><h2>${title}</h2>
      </button>
      ${helpIcon(explanation, `Пояснення: ${title}`)}
    </div>
    <div id="${contentId}" class="collapsible-content" ${expanded ? '' : 'hidden'}>${content}</div>
  </section>`;
}

function authLoadingView() {
  return `<main class="access-page"><section class="card access-card"><img class="brand-mark access-logo" src="./assets/logo-mafia.webp" alt="" width="60" height="60" aria-hidden="true"><div class="eyebrow">Mafia · Enjoy</div><h1>Перевіряємо Google-сесію…</h1><p>Зачекайте кілька секунд. Збережений вхід працюватиме й після повторного запуску.</p><span class="auth-spinner" aria-label="Завантаження"></span></section></main>`;
}

function firebaseSetupView() {
  return `<main class="access-page"><section class="card access-card"><img class="brand-mark access-logo" src="./assets/logo-mafia.webp" alt="" width="60" height="60" aria-hidden="true"><div class="eyebrow">Mafia</div><h1>Google-вхід готується</h1><p>Сервіс входу власника ще не підключений до цієї збірки. Після одноразового налаштування користувачі бачитимуть тут лише кнопку входу Google.</p><div class="privacy-note"><b>Для власника:</b> перевірте публічну конфігурацію входу та дозвольте домен <code>somnit-hub.github.io</code>.</div>${app.authError ? `<p class="danger-text">${esc(app.authError)}</p>` : ''}<button class="btn primary wide" data-action="retry-auth">Перевірити ще раз</button></section></main>`;
}

function loginView() {
  const explanation = 'Оберіть Google-акаунт. Ім’я та Google-фото створять редагований профіль у закритому каталозі Enjoy. Email не публікується. Активні і завершені ігри синхронізуються; для глядачів активна гра передається без ролей, нічних цілей і приватного протоколу.';
  return `<main class="access-page"><section class="card access-card"><img class="brand-mark access-logo" src="./assets/logo-mafia.webp" alt="" width="60" height="60" aria-hidden="true"><div class="eyebrow">Мафія у кав’ярні Enjoy</div>${titleHelp('h1', 'Увійдіть у Mafia', explanation)}<button class="btn primary google-btn wide" data-action="auth-signin" ${app.authBusy ? 'disabled' : ''}><span class="google-mark" aria-hidden="true">G</span>${app.authBusy ? 'Відкриваємо Google…' : 'Увійти через Google'}</button>${app.authError ? `<p class="danger-text">${esc(app.authError)}</p>` : ''}</section></main>`;
}

function archiveStatusText() {
  if (app.cloudArchive.status === 'online') return 'Спільні ігри Enjoy · синхронізовано';
  if (app.cloudArchive.status === 'offline') return 'Спільні ігри Enjoy · показано офлайн-копію';
  if (app.cloudArchive.status === 'loading') return 'Спільні ігри Enjoy · синхронізація…';
  if (app.cloudArchive.status === 'error') return app.cloudArchive.error || 'Спільні ігри тимчасово недоступні';
  return 'Активні й завершені ігри Enjoy';
}

function homeView() {
  const recent = finishedGames().slice(0, 5);
  const active = activeGames();
  const stats = aggregateStats();
  return `<main class="page tab-page home-page">
    <section class="card hero">
      <div class="hero-masthead"><div class="enjoy-kicker"><span>coffee · community · mafia</span></div></div>
      <div class="hero-title-row"><h1>Мафія <span>enjoy</span><svg class="hero-cup" viewBox="0 0 48 48" aria-hidden="true"><path d="M9 17h25v10a10 10 0 0 1-10 10h-5A10 10 0 0 1 9 27V17Z"/><path d="M34 20h3a5 5 0 0 1 0 10h-4"/><path d="M7 41h32M16 13c-3-3 3-5 0-8m9 8c-3-3 3-5 0-8"/></svg></h1></div>
      <div class="actions"><button class="btn primary" data-nav="setup">Створити гру</button><button class="btn secondary" data-nav="players">Додати гравців</button></div>
    </section>
    ${active.length ? `<section class="card card-pad active-games-panel"><div class="section-title section-heading">${titleHelp('h2', 'Активні ігри', 'Ведучий продовжує власну гру на цьому пристрої. Інші авторизовані користувачі можуть безпечно спостерігати без доступу до ролей і нічних перевірок.')}</div><div class="active-game-list">${active.map(activeGameRow).join('')}</div></section>` : ''}
    <section class="stat-grid home-stat-grid">
      <article class="card stat-card"><b>${stats.games}</b><span>завершених ігор</span></article>
      <article class="card stat-card"><b>${app.players.length}</b><span>гравців у базі</span></article>
      <article class="card stat-card"><b>${stats.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${formatDuration(stats.totalSeconds)}</b><span>за ігровим столом</span></article>
    </section>
    <section class="card card-pad">
      <div class="section-title section-heading">${titleHelp('h2', 'Останні ігри', archiveStatusText())}<button class="btn small secondary" data-nav="stats">Усі</button></div>
      ${recent.length ? `<div class="list">${recent.map(gameRow).join('')}</div>` : statePanel('empty', 'Ігор ще немає', 'Створіть першу гру — усі дії потраплять до протоколу.')}
    </section>
    <div class="home-fab-group" role="group" aria-label="Швидкі дії"><button class="mobile-fab primary-fab" type="button" data-action="new-player" aria-label="Додати гравця" title="Додати гравця">${addPlayerIcon()}</button><button class="mobile-fab danger-fab" type="button" data-nav="setup" aria-label="Створити гру" title="Створити гру">${navIcon('setup')}</button></div>
  </main>`;
}

function gameRow(game) {
  const winner = game.winner === 'red' ? 'Місто' : game.winner === 'black' ? 'Мафія' : game.winner === 'draw' ? 'Нічия' : 'Не визначено';
  const host = preferredGameHostName(game);
  return `<div class="list-row"><div class="list-main"><b>${esc(game.title)}</b><span>${formatDate(game.endedAt || game.updatedAt, true)} · ${formatDuration(game.durationSeconds)}${host ? ` · ведучий ${esc(host)}` : ''}</span></div><span class="badge ${game.winner === 'red' ? 'red' : ''}">${winner}</span></div>`;
}

function activeGameRow(game) {
  const resumable = canManageGame(game) && !game.publicOnly;
  const host = preferredGameHostName(game);
  const alive = game.seats.filter(seat => seat.status === 'alive').length;
  const gameId = esc(game.id);
  const action = resumable
    ? `<button class="btn danger active-game-action" data-action="resume-game" data-id="${gameId}">Продовжити</button>`
    : `<button class="btn secondary active-game-action watch-game-action" data-action="watch-game" data-id="${gameId}">${eyeIcon()}<span>Спостерігати</span></button>`;
  return `<article class="active-game-row"><div class="active-game-copy"><div class="eyebrow">Триває зараз</div><h3>${esc(game.title)}</h3><div class="continue-meta">${phaseLabel(game)} · ${alive}/10 за столом${host ? ` · ведучий ${esc(host)}` : ''} · оновлено ${formatDate(game.updatedAt, true)}</div></div>${action}</article>`;
}

function playersView() {
  const query = app.search.trim().toLocaleLowerCase('uk');
  const players = app.players.filter(player => !query || `${player.name} ${player.nickname || ''} ${player.email || ''} ${player.contact || ''} ${player.notes || ''}`.toLocaleLowerCase('uk').includes(query));
  const cloudLabel = app.cloudDirectory.status === 'online'
    ? `${app.cloudPlayers.length} у каталозі`
    : app.cloudDirectory.status === 'offline'
      ? `${app.cloudPlayers.length} з офлайн-кешу`
      : app.cloudDirectory.status === 'loading' ? 'Синхронізація…' : 'Каталог недоступний';
  return `<main class="page tab-page players-page">
    ${pageHeader('Гравці', 'Google-профілі доступні всій спільноті, але змінюються лише власниками. Ручні профілі може редагувати й видаляти будь-який авторизований користувач. Профілі учасників активної гри заблоковані до її завершення.', '<div class="actions"><button class="btn primary" data-action="new-player">+ Додати гравця</button></div>')}
    ${statusStrip(app.cloudDirectory.status, cloudLabel, app.cloudDirectory.error, 'Ручні профілі синхронізуються для всіх користувачів. Автоматично згенеровані тимчасові прізвиська до каталогу не додаються.', '<button class="btn small secondary" data-action="cloud-refresh">Оновити</button>')}
    ${nextGameQueueView()}
    <div class="search-row"><input class="input" type="search" data-input="player-search" value="${esc(app.search)}" placeholder="Пошук за ім’ям, ніком, клубом або описом"><button class="btn secondary icon" data-action="new-player" aria-label="Додати гравця">+</button></div>
    ${players.length ? `<section class="player-grid">${players.map(playerCard).join('')}</section>` : statePanel('empty', 'Нікого не знайдено', 'Змініть запит або додайте гравця.')}
    <div class="players-fab-group" role="group" aria-label="Швидкі дії гравців"><button class="mobile-fab primary-fab" type="button" data-action="new-player" aria-label="Додати гравця" title="Додати гравця">${addPlayerIcon()}</button><button class="mobile-fab danger-fab" type="button" data-action="prepare-next-game" aria-label="До розсадки" title="До розсадки">${seatingIcon()}</button></div>
  </main>`;
}

function nextGameQueueView() {
  const status = lineupStatus(app.nextGameQueue);
  const players = queuedPlayers();
  const statusText = status.waiting
    ? `${status.atTable}/10 · черга ${status.waiting}`
    : status.temporary
      ? `${status.atTable}/10 · тимчасових ${status.temporary}`
      : '10/10 · стіл готовий';
  return `<section class="card next-game-lineup" aria-label="Склад наступної гри">
    <div class="lineup-head"><div><span class="eyebrow">Наступна гра</span><b>${statusText}</b></div>${helpIcon('Перші 10 обраних гравців сідають за наступний стіл. Решта зберігаються в черзі й переходять у наступну гру першими.', 'Як працює склад і черга')}</div>
    ${players.length ? `<div class="lineup-strip">${players.map((player, index) => `<span class="lineup-chip ${index >= TABLE_SIZE ? 'waiting' : ''}"><i>${index + 1}</i>${esc(preferredPlayerName(player))}</span>`).join('')}</div>` : ''}
    <div class="lineup-actions"><button class="btn small primary" data-action="prepare-next-game">До розсадки</button>${status.total ? '<button class="btn small secondary" data-action="clear-next-game">Очистити</button>' : ''}</div>
  </section>`;
}

function statsForPlayer(playerId) {
  const appearances = finishedGames().flatMap(game => game.seats.map(seat => ({ game, seat }))).filter(item => item.seat.profileId === playerId);
  const wins = appearances.filter(({ game, seat }) => game.winner && game.winner === teamOf(seat)).length;
  return { games: appearances.length, wins, winRate: appearances.length ? Math.round(wins / appearances.length * 100) : 0 };
}

function playerCard(player) {
  const stats = statsForPlayer(player.id);
  const isGoogleProfile = Boolean(player.cloudUid);
  const isSharedManual = Boolean(player.cloudManualId);
  const isCloud = isGoogleProfile || isSharedManual;
  const ownCloudProfile = isGoogleProfile && player.cloudUid === app.authUser?.uid;
  const queueIndex = normalizeLineup(app.nextGameQueue).indexOf(player.id);
  const queued = queueIndex >= 0;
  const profileLocked = profileIsInActiveGame(player.id);
  const lockedButton = '<button class="icon-btn player-edit" type="button" aria-label="Профіль заблоковано до завершення гри" title="Профіль зараз у грі" disabled>🔒</button>';
  const editButton = profileLocked
    ? lockedButton
    : isGoogleProfile
      ? (ownCloudProfile ? '<button class="icon-btn player-edit" data-action="edit-host-profile" aria-label="Редагувати власний профіль">•••</button>' : '')
      : `<button class="icon-btn player-edit" data-action="edit-player" data-id="${player.id}" aria-label="Редагувати ${esc(player.name)}">•••</button>`;
  return `<article class="card player-card ${isCloud ? 'cloud' : 'local'}">
    ${avatar(player)}
    <div><h3>${esc(player.name)}</h3><p>${esc(player.nickname ? `«${player.nickname}» · ${player.notes || player.contact || 'без опису'}` : player.notes || player.contact || 'Без додаткового опису')}</p><div class="player-stats"><span class="badge ${isCloud ? 'green' : ''}">${player.linkAccepted ? 'Google · об’єднано' : isGoogleProfile ? 'Google · Enjoy' : 'Додано ведучим'}</span>${!isGoogleProfile && player.email ? '<span class="badge gold">Очікує Google</span>' : ''}<span>${stats.games} ігор</span><span>${stats.winRate}% перемог</span></div></div>
    <div class="player-card-actions"><button class="queue-player-btn ${queued ? 'selected' : ''}" data-action="toggle-next-player" data-id="${esc(player.id)}" aria-label="${queued ? `Прибрати ${esc(preferredPlayerName(player))} зі складу наступної гри` : `Додати ${esc(preferredPlayerName(player))} до наступної гри`}" aria-pressed="${queued}"><span aria-hidden="true">${queued ? '✓' : '+'}</span>${queued ? `<small>${queueIndex + 1}</small>` : ''}</button>${editButton}</div>
  </article>`;
}

function createDraft() {
  const selectedPlayers = app.nextGameQueue.length
    ? queuedPlayers().slice(0, TABLE_SIZE)
    : app.players.length >= TABLE_SIZE ? shuffled(app.players).slice(0, TABLE_SIZE) : [];
  return {
    title: `Мафія в Enjoy · ${new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(new Date())}`,
    venue: ENJOY_CAFE.venue, notes: '',
    settings: { ...app.settings },
    seats: draftSeatsForPlayers(selectedPlayers)
  };
}

function setupView() {
  if (!app.draft) app.draft = createDraft();
  const lineup = lineupStatus(app.nextGameQueue);
  const seatingSummary = lineup.total
    ? `${lineup.atTable} обрано зі списку. ${lineup.temporary ? `Ще ${lineup.temporary} місць залишено для тимчасових гравців.` : 'Основний стіл заповнено.'}${lineup.waiting ? ` У черзі на наступну гру: ${lineup.waiting}.` : ''}`
    : app.players.length >= TABLE_SIZE ? 'Випадкові 10 уже обрані з бази Enjoy.' : 'Додайте щонайменше 10 профілів для автоматичного вибору.';
  const seatingHelp = `${seatingSummary} Тимчасові місця отримують випадкові кумедні нікнейми; будь-який із них можна замінити вручну. Кнопка зі стрілками біля гравця переміщує його на обране місце та міняє двох гравців місцями.`;
  return `<main class="page tab-page setup-page">
    ${pageHeader('Нова гра', 'Спортивний стіл: 10 гравців, 7 червоних і 3 чорних.')}
    <div class="setup-grid">
      ${collapsiblePanel('setupGame', 'Гра', 'Назва гри потрапить до спільного архіву після завершення.', `<div class="stack">
        <div class="field"><label for="game-title">Назва</label><input id="game-title" class="input" data-draft="title" value="${esc(app.draft.title)}" maxlength="80"></div>
        <div class="field"><label for="game-venue">Місце / клуб</label><input id="game-venue" class="input" data-draft="venue" value="${esc(app.draft.venue)}" maxlength="100" placeholder="Необов’язково"></div>
        <div class="field"><label for="game-notes">Нотатка ведучого</label><textarea id="game-notes" class="textarea" data-draft="notes" maxlength="500" placeholder="Турнір, номер столу, особливі умови…">${esc(app.draft.notes)}</textarea></div>
      </div>`)}
      ${collapsiblePanel('setupTimers', 'Правила й таймери', 'Ці значення можна змінити й під час гри.', `
        <div class="setup-options">
          ${numberField('Промова, сек', 'speech', app.draft.settings.speech, 'Основний час промови гравця.')}
          ${numberField('Автокатастрофа, сек', 'tieSpeech', app.draft.settings.tieSpeech, 'Додаткова промова кандидатів після нічиєї.')}
          ${numberField('Останнє слово, сек', 'lastWord', app.draft.settings.lastWord, 'Час гравця, який залишає стіл.')}
          ${numberField('Нічна дія, сек', 'nightCheck', app.draft.settings.nightCheck, 'Час на постріл або одну перевірку Дона чи Шерифа.')}
          ${numberField('Знайомство мафії, сек', 'mafiaMeet', app.draft.settings.mafiaMeet, 'У нульову ніч Дон представляється команді та задає порядок відстрілу.')}
          ${numberField('Позначення Шерифа, сек', 'sheriffMark', app.draft.settings.sheriffMark, 'Після знайомства мафії Шериф жестом позначає себе ведучому, не знімаючи маску.')}
          ${numberField('Вільна посадка, сек', 'freeSeating', app.draft.settings.freeSeating, 'Усі залишаються в масках, але можуть зайняти зручну позу перед початком дня.')}
          ${numberField('Кращий хід, сек', 'bestMove', app.draft.settings.bestMove, 'Після першого нічного вбивства гравець називає трійку чорних до протоколу.')}
        </div>
        <div class="divider"></div>
        <div class="field"><label>${help('Система фолів', FOUL_SYSTEM_HELP)}</label><select class="select" data-draft-setting="penaltyMode"><option value="tournament" ${app.draft.settings.penaltyMode === 'tournament' ? 'selected' : ''}>Турнірна</option><option value="club" ${app.draft.settings.penaltyMode === 'club' ? 'selected' : ''}>Клубна</option></select></div>
      `)}
    </div>
    ${collapsiblePanel('setupSeating', 'Розсадка', seatingHelp, `<div class="actions panel-actions"><button class="btn small secondary" data-action="random-table" ${app.players.length >= TABLE_SIZE ? '' : 'disabled'}>Інші випадкові 10</button><button class="btn small secondary" data-action="shuffle-seats">Перемішати місця</button></div><div class="seat-setup">${app.draft.seats.map(setupSeat).join('')}</div><div class="actions panel-footer-actions"><button class="btn secondary" data-action="new-player">+ Новий профіль</button><button class="btn danger" data-action="start-game">Роздати ролі</button></div>`, 'setup-seating-panel')}
    ${collapsiblePanel('setupRules', 'Правила спортивної «Мафії»', 'Регламент, жести ведучого та турнірні процедури. Перед турніром звіряйте редакцію з регламентом організатора.', `<div class="actions rules-links"><a class="btn primary" href="${RULES_LINKS.ukrainian}" target="_blank" rel="noopener noreferrer">Правила iMafia українською</a><a class="btn secondary" href="${RULES_LINKS.international}" target="_blank" rel="noopener noreferrer">Міжнародний регламент ФІІМ</a></div>`, 'setup-rules-panel')}
    <div class="setup-fab-group" role="group" aria-label="Дії нової гри"><button class="mobile-fab primary-fab" type="button" data-action="new-player" aria-label="Додати гравця" title="Додати гравця">${addPlayerIcon()}</button><button class="mobile-fab danger-fab" type="button" data-action="start-game" aria-label="Роздати ролі" title="Роздати ролі">${dealRolesIcon()}</button></div>
  </main>`;
}

function numberField(label, key, value, tooltip) {
  return `<div class="field"><label>${help(label, tooltip)}</label><input class="input" type="number" min="5" max="180" step="5" data-draft-setting="${key}" value="${value}"></div>`;
}

function setupSeat(seat) {
  const selectedPlayer = seat.profileId ? playerById(seat.profileId) : null;
  const occupiedByOtherSeats = new Set(app.draft.seats
    .filter(otherSeat => otherSeat.number !== seat.number && otherSeat.profileId)
    .map(otherSeat => otherSeat.profileId));
  const options = app.players.filter(player => !occupiedByOtherSeats.has(player.id)).map(player => {
    const preferred = preferredPlayerName(player);
    const secondary = player.nickname && player.name !== preferred ? ` · ${player.name}` : '';
    return `<option value="${player.id}" ${seat.profileId === player.id ? 'selected' : ''}>${esc(preferred)}${esc(secondary)}</option>`;
  }).join('');
  const pickerLabel = seat.profileId ? `Змінити профіль гравця на місці ${seat.number}` : `Обрати профіль гравця для місця ${seat.number}`;
  return `<div class="seat-setup-row"><span class="seat-no">${seat.number}</span><label class="seat-player-picker ${seat.profileId ? 'has-profile' : ''}" title="${pickerLabel}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.7-4 3-6 7-6 1.6 0 3 .3 4.1 1M19 14v6m-3-3h6"/></svg><select class="select seat-profile-select" data-seat-profile="${seat.number}" aria-label="${pickerLabel}"><option value="">Тимчасовий гравець</option>${options}</select></label>${setupSeatAvatar(seat, selectedPlayer)}<input class="input seat-name-input" data-seat-name="${seat.number}" value="${esc(seat.name)}" maxlength="60" aria-label="Ім’я або нікнейм гравця на місці ${seat.number}"><button class="seat-move-btn" type="button" data-action="move-setup-seat" data-seat="${seat.number}" aria-label="Перемістити гравця з місця ${seat.number}" title="Перемістити на інше місце"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3-3m-3 3 3 3"/></svg></button></div>`;
}

function draftSeatLabel(seat) {
  return preferredPlayerName(playerById(seat?.profileId)) || String(seat?.name || '').trim() || 'Тимчасовий гравець';
}

function aggregateStats() {
  const games = finishedGames();
  const totalSeconds = games.reduce((sum, game) => sum + (game.durationSeconds || 0), 0);
  const redWins = games.filter(game => game.winner === 'red').length;
  const blackWins = games.filter(game => game.winner === 'black').length;
  const redWinRate = games.length ? Math.round(redWins / games.length * 100) : 0;
  return { games: games.length, totalSeconds, redWinRate, blackWinRate: games.length ? Math.round(blackWins / games.length * 100) : 0 };
}

function sharedLeaderboard(games) {
  const rows = new Map();
  games.forEach(game => game.seats.forEach(seat => {
    const key = seat.profileId || `guest:${seat.name.toLocaleLowerCase('uk')}`;
    const known = seat.profileId ? playerById(seat.profileId) : null;
    const row = rows.get(key) || {
      player: known || { id: key, name: seat.name, avatar: seat.avatar || '' },
      games: 0,
      wins: 0,
      winRate: 0
    };
    row.games += 1;
    if (game.winner && game.winner === teamOf(seat)) row.wins += 1;
    row.winRate = Math.round(row.wins / row.games * 100);
    rows.set(key, row);
  }));
  return [...rows.values()].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.games - a.games).slice(0, 10);
}

function statsView() {
  const games = finishedGames();
  const active = activeGames();
  const aggregate = aggregateStats();
  const leaderboard = sharedLeaderboard(games);
  const roles = ['citizen', 'sheriff', 'mafia', 'don'].map(key => {
    const appearances = games.flatMap(game => game.seats.map(seat => ({ game, seat }))).filter(item => item.seat.role === key);
    const wins = appearances.filter(item => item.game.winner === teamOf(item.seat)).length;
    return { label: ROLE_DECK.find(role => role.key === key)?.label || key, games: appearances.length, rate: appearances.length ? Math.round(wins / appearances.length * 100) : 0 };
  });
  return `<main class="page tab-page">
    ${pageHeader('Статистика', 'Активні ігри та спільні результати завершених ігор усіх ведучих.', '<button class="btn small secondary" data-action="cloud-games-refresh">Оновити</button>')}
    ${statusStrip(app.cloudArchive.status, archiveStatusText(), app.cloudArchive.error, `${active.length} активних і ${games.length} завершених ігор доступно всім авторизованим учасникам.`)}
    ${active.length ? `<section class="card card-pad active-games-panel"><div class="section-title section-heading">${titleHelp('h2', 'Активні ігри', 'Приєднайтеся до безпечного публічного перегляду. Ролі, нічні цілі та приватний протокол не передаються глядачам.')}</div><div class="active-game-list">${active.map(activeGameRow).join('')}</div></section>` : ''}
    <section class="stat-grid stats-summary-grid">
      <article class="card stat-card"><b>${aggregate.games}</b><span>ігор</span></article>
      <article class="card stat-card"><b>${aggregate.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${aggregate.blackWinRate}%</b><span>перемог мафії</span></article>
      <article class="card stat-card"><b>${formatDuration(aggregate.totalSeconds)}</b><span>загальний час</span></article>
    </section>
    <div class="grid two stats-panels">
      ${collapsiblePanel('statsRoles', 'Результативність ролей', 'Показано частку перемог команди гравця для кожної ролі.', `<div class="bar-chart">${roles.map(role => `<div class="bar-row"><span>${esc(role.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${role.rate}%"></div></div><span class="bar-value">${role.rate}%</span></div>`).join('')}</div>`)}
      ${collapsiblePanel('statsPlayers', 'Гравці', 'Рейтинг упорядковано за кількістю перемог.', leaderboard.length ? `<div class="list">${leaderboard.map((row, index) => `<div class="list-row"><div style="display:flex;align-items:center;gap:9px"><b class="muted">${index + 1}</b>${avatar(row.player, 'small')}<div class="list-main"><b>${esc(row.player.name)}</b><span>${row.games} ігор · ${row.winRate}% перемог</span></div></div><b>${row.wins}</b></div>`).join('')}</div>` : statePanel('empty', 'Рейтинг ще порожній', 'Завершіть першу гру, щоб побачити результати.'))}
    </div>
    <section class="card card-pad"><div class="section-title section-heading">${titleHelp('h2', 'Спільний архів ігор', 'Протоколи синхронізуються між пристроями та кешуються для офлайн-перегляду.')}</div>${games.length ? `<div class="list">${games.map(game => `${gameRow(game)}<div class="actions archive-game-actions"><button class="btn small secondary" data-action="view-protocol" data-id="${game.id}">Протокол</button>${canManageGame(game) ? `<button class="btn small danger" data-action="delete-game" data-id="${game.id}">Видалити</button>` : ''}</div>`).join('')}</div>` : statePanel('empty', 'Архів ігор порожній', 'Завершені ігри з’являться тут автоматично.')}</section>
  </main>`;
}

function settingsView() {
  const drive = getDriveSession();
  const lastSync = app.cloudSync ? formatDate(app.cloudSync, true) : 'ще не виконувалась';
  const directoryStatus = app.cloudDirectory.status === 'online' ? 'Синхронізовано'
    : app.cloudDirectory.status === 'offline' ? 'Офлайн-кеш'
      : app.cloudDirectory.status === 'loading' ? 'Синхронізація…' : 'Помилка';
  return `<main class="page tab-page">
    ${pageHeader('Налаштування', 'Спільнота, оформлення, синхронізація та резервні копії. Профілі, активні й завершені ігри доступні після Google-входу. Публічний стан активної гри не містить ролей, нічних цілей або приватного протоколу. Нотатка ведучого ніколи не додається до профілю в каталозі.')}
    <section class="card card-pad enjoy-info-card">
      <div class="enjoy-info-copy"><div class="enjoy-brand-tools">${cafeIconLinks('settings-cafe-links')}</div><div><div class="eyebrow">coffee · community · mafia</div><h2>Домівка нашого мафія-клубу</h2></div></div>
    </section>
    <div class="grid two">
      <section class="card card-pad">
        <div class="section-title section-heading">${titleHelp('h2', 'Профіль Enjoy', 'Google-акаунт і спільний каталог гравців. Email приватний. Email ручного профілю використовується лише для запрошення на об’єднання і доступний цьому ведучому та відповідному підтвердженому Google-акаунту. Ім’я, нікнейм, клуб, опис і вибраний аватар синхронізуються у каталозі.')}<span class="badge ${app.cloudDirectory.status === 'online' ? 'green' : ''}">${esc(directoryStatus)}</span></div>
        <div class="host-profile-summary">${hostAvatar('large')}<div><h3>${esc(app.hostProfile?.displayName || app.authUser?.googleName || 'Ведучий')}</h3><p>${esc(app.authUser?.email || '')}</p><div class="host-profile-badges">${app.hostProfile?.club ? `<span class="badge gold">${esc(app.hostProfile.club)}</span>` : ''}${profilePhotoSyncHtml()}</div></div></div>
        <div class="actions profile-actions"><button class="btn secondary" data-action="edit-host-profile">Редагувати профіль</button><button class="btn secondary" data-action="auth-signout">Вийти</button><button class="icon-btn account-delete-btn" type="button" data-action="delete-account" aria-label="Видалити профіль Mafia" title="Видалити профіль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg></button></div>
      </section>
      <section class="card card-pad">
        <div class="section-title section-heading">${titleHelp('h2', 'На цьому пристрої', 'Активна гра та приватні дані працюють офлайн.')}</div>
        <div class="stack">
          <div class="field">
            <span class="field-label">${help('Мова застосунку', 'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.')}</span>
            ${languagePickerHtml()}
          </div>
          <div class="field">
            <span class="field-label">${help('Тема оформлення', 'Темна тема призначена для приглушеного світла, світла — для денного освітлення, а «Кав’ярня» використовує теплі кавові відтінки.')}</span>
            <div class="theme-picker" role="group" aria-label="Тема оформлення">
              ${themeChoice('dark', 'Темна')}
              ${themeChoice('light', 'Світла')}
              ${themeChoice('cafe', 'Кав’ярня')}
            </div>
          </div>
          ${toggleRow('setting-sound', 'Звукові сигнали таймера', app.settings.sound)}
          ${toggleRow('setting-haptics', 'Вібрація важливих дій', app.settings.haptics)}
        </div>
      </section>
    </div>
    <section class="card card-pad">
      <div class="section-title section-heading">${titleHelp('h2', 'Резервна копія Google Drive', `Остання синхронізація: ${lastSync}. Окремий дозвіл drive.appdata надається лише після команди підключення; застосунок не бачить звичайні файли користувача.`)}<span class="badge ${drive.connected ? 'green' : ''}">${drive.connected ? 'Підключено' : 'Не підключено'}</span></div>
      <div class="actions drive-actions">${drive.connected ? '<button class="btn primary" data-action="cloud-push">Зберегти у Drive</button><button class="btn secondary" data-action="cloud-pull">Відновити з Drive</button><button class="btn secondary" data-action="drive-disconnect">Відключити Drive</button>' : '<button class="btn primary" data-action="drive-connect">Увімкнути резервну копію</button>'}</div>
    </section>
    <section class="card card-pad"><div class="section-title section-heading">${titleHelp('h2', 'Режим оглядача', 'Публічний екран не показує ролі, нічні цілі та приватний протокол. Авторизовані користувачі бачать перебіг гри на своїх пристроях, а друга вкладка ведучого оновлюється так само.')}</div><div class="actions observer-actions"><button class="btn secondary" data-action="open-observer" ${app.game?.status === 'active' ? '' : 'disabled'}>Відкрити публічний екран</button></div></section>
    <section class="card card-pad"><div class="section-title section-heading">${titleHelp('h2', 'Про застосунок', 'Версія 3.1 · Enjoy Editorial. Створено для мафія-спільноти кав’ярні Enjoy. PWA працює на GitHub Pages і кешує оболонку, Google-сесію, профілі та спільний архів для офлайн-запуску після першого входу.')}</div><div class="divider"></div><div class="section-title section-heading rules-title">${titleHelp('h3', 'Правила спортивної «Мафії»', 'Тут доступні регламент, жести ведучого та турнірні процедури. Основне посилання веде на актуальні правила iMafia українською; перед турніром звіряйте редакцію з регламентом організатора.')}</div><div class="actions rules-links"><a class="btn primary" href="${RULES_LINKS.ukrainian}" target="_blank" rel="noopener noreferrer">Правила iMafia українською</a><a class="btn secondary" href="${RULES_LINKS.international}" target="_blank" rel="noopener noreferrer">Міжнародний регламент ФІІМ</a></div></section>
  </main>`;
}

function themeChoice(value, label) {
  const selected = app.settings.theme === value;
  return `<button class="theme-choice ${selected ? 'selected' : ''}" type="button" data-action="set-theme" data-theme-choice="${value}" aria-pressed="${selected}"><span class="theme-preview" aria-hidden="true"><i></i><i></i><i></i></span><b>${label}</b></button>`;
}

function toggleRow(action, label, enabled) {
  return `<div class="toggle-row"><span>${label}</span><button class="switch ${enabled ? 'on' : ''}" data-action="${action}" role="switch" aria-checked="${enabled}" aria-label="${esc(label)}"></button></div>`;
}

function revealView() {
  const game = app.game;
  if (!game) return missingGameView();
  const seat = game.seats[game.revealIndex];
  const role = roleOf(seat);
  return `<main class="page reveal-page"><section class="card reveal-card ${game.revealOpen ? 'role-open' : 'role-ready'}">
    <div class="reveal-progress"><span class="eyebrow">Роздача ролей</span><div><b>${game.revealIndex + 1}</b><span> / ${game.seats.length}</span>${helpIcon('Браузер не може гарантовано заблокувати скриншоти. Показуйте роль так, щоб екран бачив лише відповідний гравець.', 'Безпека показу ролі')}</div></div>
    <div class="reveal-player"><div class="reveal-seat"><span>Місце</span><strong>${seat.number}</strong></div>${avatar(seat, 'reveal-avatar')}<div class="reveal-player-copy"><div class="eyebrow">Передайте телефон особисто</div><h1>${esc(seat.name)}</h1></div></div>
    <div class="reveal-content">${game.revealOpen
      ? `<div class="role-reveal ${role.team === 'black' ? 'black' : 'red-team'}">${roleSignal(role.key, 'reveal-signal', `Ваша роль: ${role.label}`)}<div class="role-name">${role.label}</div><div class="badge ${role.team === 'red' ? 'green' : ''}">${role.team === 'red' ? 'Червона команда' : 'Чорна команда'}</div><p>${role.description}</p></div>`
      : `<div class="reveal-privacy"><div class="reveal-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg></div><h2>Екран бачить лише гравець №${seat.number}</h2><p>Після перегляду роль автоматично сховається перед передачею телефона наступному гравцеві.</p></div>`}
    </div>
    <div class="reveal-actions"><button class="btn primary wide game-lead-action" data-action="${game.revealOpen ? 'reveal-next' : 'reveal-role'}">${game.revealOpen ? 'Сховати й передати далі' : 'Показати мою роль'}</button></div>
  </section></main>`;
}

function missingGameView() {
  return `<main class="page">${statePanel('error', 'Активну гру не знайдено', 'Створіть нову гру або поверніться на огляд.', '<button class="btn primary small" data-nav="setup">Створити гру</button>')}</main>`;
}

function phaseLabel(game = app.game) {
  if (!game) return 'Немає гри';
  const labels = {
    reveal: 'Роздача ролей', zeroNight: 'Нульова ніч', day: `День ${game.day}`,
    vote: `Голосування · день ${game.day}`, tieSpeech: 'Автокатастрофа · промови', tieVote: 'Автокатастрофа · голосування',
    allTie: 'Вихід усіх кандидатів', lastWord: 'Останнє слово', bestMove: 'Кращий хід', night: `Ніч ${game.day}`, finished: 'Гру завершено'
  };
  return labels[game.phase] || game.phase;
}

function phaseDescription(game) {
  if (game.phase === 'day') return game.subphase === 'speeches' ? `Промова гравця №${currentSpeaker()?.number || '—'}` : 'Номінації сформовано';
  if (game.phase === 'night') return ['Місто засинає', 'Мафія стріляє', 'Дон шукає Шерифа', 'Шериф перевіряє місто', 'Результат відстрілу'][game.night.step] || '';
  if (game.phase === 'zeroNight') return ['Чорна команда знайомиться', 'Шериф позначає себе ведучому', 'Гравці займають вільну посадку'][game.zeroNight?.step || 0];
  if (game.phase === 'lastWord') return `Гравець №${game.lastWordSeat}`;
  if (game.phase === 'bestMove') return `Гравець №${game.bestMove?.seat || game.lastWordSeat}`;
  if (game.phase === 'tieSpeech') return `Промова гравця №${game.vote.tied[game.speakerIndex] || '—'}`;
  return `${aliveSeats().length} гравців за столом`;
}

function gameView(observer = false) {
  const game = app.game;
  if (!game) return missingGameView();
  if (game.phase === 'finished') return winnerView(observer);
  const focused = ['zeroNight', 'bestMove'].includes(game.phase)
    || (game.phase === 'night' && game.night?.resultOpen);
  return `<main class="page game-page ${focused ? 'game-focus-phase' : ''}" aria-live="polite"><div class="game-workspace">
    <section class="card phase-strip game-top"><div class="phase-copy"><i class="phase-dot ${['night', 'zeroNight'].includes(game.phase) ? 'night' : ''}"></i><div><h1>${phaseLabel(game)}</h1><p>${phaseDescription(game)}</p></div></div><div class="phase-stats"><b>${aliveSeats().length}</b>/10 живих</div></section>
    <div class="game-body">${focused ? '' : tableHtml(observer)}${phaseControlHtml(observer)}</div>
    <aside class="game-side">${observer ? observerSideHtml() : moderatorSideHtml()}</aside>
  </div></main>`;
}

function tableHtml(observer = false) {
  return `<section class="card table-card"><div class="seat-grid">${app.game.seats.map(seat => gameSeatHtml(seat, observer)).join('')}</div></section>`;
}

function gameSeatHtml(seat, observer) {
  const current = (app.game.phase === 'day' && currentSpeaker()?.number === seat.number) || (app.game.phase === 'tieSpeech' && app.game.vote.tied[app.game.speakerIndex] === seat.number);
  const nominated = app.game.nominations.includes(seat.number) || app.game.vote.tied.includes(seat.number);
  const profile = seat.profileId ? (playerById(seat.profileId) || seat) : seat;
  const tags = seat.status === 'dead' ? 'вибув' : nominated ? 'кандидат' : seat.noVote ? 'без голосу' : '';
  return `<button class="game-seat ${seat.status === 'alive' ? 'alive' : 'dead'} ${current ? 'current' : ''} ${nominated ? 'nominated' : ''}" ${observer ? '' : `data-action="seat-menu" data-seat="${seat.number}"`} aria-label="Гравець ${seat.number}, ${esc(seat.name)}${tags ? `, ${tags}` : ''}">
    <span class="seat-top"><span class="num">${seat.number}</span><span class="fault-mini">${'●'.repeat(seat.faults)}${'○'.repeat(Math.max(0, 4 - seat.faults))}</span></span>
    ${avatar({ ...profile, name: seat.name }, '')}<span class="seat-name">${esc(seat.name)}</span><span class="seat-tag ${nominated ? 'alert' : ''}">${tags}</span>
  </button>`;
}

function phaseControlHtml(observer) {
  const game = app.game;
  if (observer) return `<section class="card phase-panel"><div class="eyebrow">Публічний екран</div><h2>${phaseDescription(game)}</h2>${['zeroNight', 'day', 'tieSpeech', 'lastWord', 'bestMove'].includes(game.phase) ? `<div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div>` : '<p>Ведучий керує поточною фазою на своєму екрані.</p>'}</section>`;
  if (game.phase === 'zeroNight') return zeroNightHtml();
  if (game.phase === 'day') return dayControlHtml();
  if (game.phase === 'vote' || game.phase === 'tieVote') return voteControlHtml();
  if (game.phase === 'tieSpeech') return tieSpeechHtml();
  if (game.phase === 'allTie') return allTieHtml();
  if (game.phase === 'lastWord') return lastWordHtml();
  if (game.phase === 'bestMove') return bestMoveHtml();
  if (game.phase === 'night') return nightHtml();
  return '';
}

function timerControls(nextAction, nextLabel) {
  const game = app.game;
  const prominentNext = ['zero-night-sheriff', 'zero-night-free-seating', 'zero-to-day', 'finish-best-move'].includes(nextAction) ? 'game-lead-action' : '';
  return `<div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div>
    <div class="timer-controls"><button class="btn secondary icon" data-action="timer-minus" aria-label="Мінус 5 секунд">−5</button><button class="btn secondary icon" data-action="timer-plus" aria-label="Плюс 5 секунд">+5</button></div>
    <div class="primary-game-actions"><button class="btn primary game-lead-action" data-action="timer-toggle">${game.timer.running ? 'Пауза' : 'Старт'}</button><button class="btn secondary" data-action="timer-reset">Скинути</button><button class="btn primary ${prominentNext}" data-action="${nextAction}">${nextLabel}</button></div>`;
}

function phaseStepsHtml(labels, current) {
  return `<ol class="phase-stepper" style="--phase-step-count:${labels.length}" aria-label="Послідовність фази">${labels.map((label, index) => `<li class="${index < current ? 'done' : index === current ? 'current' : ''}" ${index === current ? 'aria-current="step"' : ''}><span>${index + 1}</span><b>${esc(label)}</b></li>`).join('')}</ol>`;
}

function moderatorCue(text) {
  return `<div class="moderator-cue"><span>Скажіть</span><b>«${esc(text)}»</b></div>`;
}

function zeroNightHtml() {
  const step = app.game.zeroNight?.step || 0;
  if (step === 0) return `<section class="card phase-panel zero-night-panel phase-enter">
    ${phaseStepsHtml(['Знайомство мафії', 'Позначення Шерифа', 'Вільна посадка'], step)}
    <div class="signal-stack" aria-label="Прокидаються Дон і Мафія">${roleSignal('don', 'phase-signal', 'Дон')}${roleSignal('mafia', 'phase-signal', 'Мафія')}</div>
    <div class="eyebrow">Нульова ніч · 1 із 3</div><h2>Мафія прокидається</h2>
    ${moderatorCue('Прокидається Мафія. Дон позначає себе та задає порядок відстрілу')}
    <p>Усі інші гравці залишаються в масках. Дон представляється команді та без слів задає порядок пострілів.</p>
    ${timerControls('zero-night-sheriff', 'Мафія засинає')}
  </section>`;
  if (step === 1) return `<section class="card phase-panel zero-night-panel phase-enter">
    ${phaseStepsHtml(['Знайомство мафії', 'Позначення Шерифа', 'Вільна посадка'], step)}
    ${roleSignal('sheriff', 'phase-signal', 'Шериф')}
    <div class="eyebrow">Нульова ніч · 2 із 3</div><h2>Шериф позначає себе</h2>
    ${moderatorCue('Шериф має можливість позначити себе')}
    <p>Шериф не прокидається: лише показує ведучому встановлений жест, залишаючись у нічній посадці.</p>
    ${timerControls('zero-night-free-seating', 'Вільна посадка')}
  </section>`;
  return `<section class="card phase-panel zero-night-panel phase-enter">
    ${phaseStepsHtml(['Знайомство мафії', 'Позначення Шерифа', 'Вільна посадка'], step)}
    <div class="night-symbol">◌</div>
    <div class="eyebrow">Нульова ніч · 3 із 3</div><h2>Вільна посадка</h2>
    ${moderatorCue('Фаза вільної посадки')}
    <p>Усі залишаються в масках і дотримуються нічної тиші, але можуть зайняти зручну позу.</p>
    ${timerControls('zero-to-day', 'Почати день 1')}
  </section>`;
}

function syncObserverTimer() {
  clearInterval(app.observerTimerHandle);
  app.observerTimerHandle = null;
  if (!app.authUser || app.route !== 'observer' || !app.game?.timer?.running || !app.game.timer.endsAt) return;
  let shown = app.game.timer.remaining;
  app.observerTimerHandle = setInterval(() => {
    if (app.route !== 'observer' || !app.game?.timer?.running) {
      clearInterval(app.observerTimerHandle);
      app.observerTimerHandle = null;
      return;
    }
    const remaining = timerRemainingAt(app.game.timer);
    if (remaining === shown) return;
    shown = remaining;
    app.game.timer.remaining = remaining;
    const timer = document.querySelector('.game-page .phase-panel .timer');
    if (timer) {
      timer.textContent = formatTimer(remaining);
      timer.classList.toggle('danger', remaining <= 10);
    }
    if (remaining === 0) {
      app.game.timer.running = false;
      clearInterval(app.observerTimerHandle);
      app.observerTimerHandle = null;
    }
  }, 250);
}

function dayControlHtml() {
  const game = app.game;
  if (game.subphase === 'dayEnd') return `<section class="card control-card"><div class="section-title section-heading"><div><h2>Коло завершено</h2><p>${game.nominations.length ? `Кандидатів: ${game.nominations.length}` : 'Кандидатур немає'}</p></div></div>${nominationChips()}<div class="actions" style="margin-top:13px"><button class="btn secondary" data-action="back-to-speeches">Назад</button><button class="btn primary" data-action="start-vote">${game.nominations.length ? 'До голосування' : 'Перейти до ночі'}</button></div></section>`;
  const speaker = currentSpeaker();
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Поточна промова</div><h2>№${speaker?.number || '—'} · ${esc(speaker?.name || '—')}</h2></div><span class="badge gold">${game.speakerIndex + 1}/${game.speakerOrder.length}</span></div>${timerControls('next-speaker', game.speakerIndex >= game.speakerOrder.length - 1 ? 'Завершити коло' : 'Наступний →')}${game.nominations.length ? `<div class="divider"></div>${nominationChips()}` : ''}</section>`;
}

function nominationChips() {
  return app.game.nominations.length ? `<div class="nom-list">${app.game.nominations.map(number => `<button class="nom-chip" data-action="remove-nomination" data-seat="${number}">№${number} · ${esc(seatByNo(number)?.name)} ×</button>`).join('')}</div>` : statePanel('empty', 'Номінацій ще немає', 'Натисніть картку гравця під час промови.', '', true);
}

function voteCandidates() {
  return app.game.phase === 'tieVote' ? app.game.vote.tied : app.game.nominations;
}

function voteControlHtml() {
  const candidates = voteCandidates();
  const total = candidates.reduce((sum, number) => sum + (app.game.vote.counts[number] || 0), 0);
  return `<section class="card control-card"><div class="section-title section-heading"><div><h2>${app.game.phase === 'tieVote' ? 'Повторне голосування' : 'Голосування'}</h2><p>Зафіксовано ${total} із ${voterCount()} голосів</p></div><button class="btn small secondary" data-action="fill-remainder">Залишок останньому</button></div><div class="vote-grid">${candidates.map(number => `<div class="vote-card"><h3>№${number} · ${esc(seatByNo(number)?.name)}</h3><div class="vote-count">${app.game.vote.counts[number] || 0}</div><div class="stepper"><button class="btn secondary" data-action="vote-minus" data-seat="${number}">−</button><button class="btn secondary" data-action="vote-plus" data-seat="${number}">+</button></div></div>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="btn secondary" data-action="cancel-vote">Назад</button><button class="btn primary" data-action="finish-vote">Підсумувати</button></div></section>`;
}

function tieSpeechHtml() {
  const number = app.game.vote.tied[app.game.speakerIndex];
  const seat = seatByNo(number);
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Автокатастрофа · додаткова промова</div><h2>№${number} · ${esc(seat?.name)}</h2></div><span class="badge gold">${app.game.speakerIndex + 1}/${app.game.vote.tied.length}</span></div>${timerControls('next-tie-speaker', app.game.speakerIndex >= app.game.vote.tied.length - 1 ? 'Голосувати' : 'Наступний →')}</section>`;
}

function allTieHtml() {
  const total = app.game.vote.yes + app.game.vote.no;
  return `<section class="card control-card"><div class="section-title section-heading"><div><h2>Вивести всіх кандидатів?</h2><p>Повторна нічия між ${app.game.vote.tied.map(number => `№${number}`).join(', ')}</p></div></div><div class="vote-grid"><div class="vote-card"><h3>ЗА вихід усіх</h3><div class="vote-count success-text">${app.game.vote.yes}</div><div class="stepper"><button class="btn secondary" data-action="all-minus" data-kind="yes">−</button><button class="btn secondary" data-action="all-plus" data-kind="yes">+</button></div></div><div class="vote-card"><h3>ПРОТИ</h3><div class="vote-count danger-text">${app.game.vote.no}</div><div class="stepper"><button class="btn secondary" data-action="all-minus" data-kind="no">−</button><button class="btn secondary" data-action="all-plus" data-kind="no">+</button></div></div></div><p class="muted" style="text-align:center">Зафіксовано ${total} із ${voterCount()} голосів</p><button class="btn danger wide" data-action="finish-all-tie">Підсумувати</button></section>`;
}

function lastWordHtml() {
  const seat = seatByNo(app.game.lastWordSeat);
  const hasMore = app.game.pendingLastWords?.length;
  const next = hasMore ? 'Наступне слово →' : app.game.pendingWinner ? 'Оголосити результат' : app.game.afterNightKill ? 'Наступний день →' : 'Перейти до ночі →';
  const cue = app.game.afterNightKill
    ? `У місті ранок. Гравець номер ${seat?.number || '—'} залишає ігровий стіл`
    : `Гравець номер ${seat?.number || '—'}, у вас одна хвилина на останнє слово`;
  return `<section class="card control-card phase-enter"><div class="speaker-row"><div><div class="eyebrow">${app.game.afterNightKill ? 'Ранок · прощальна хвилина' : 'Останнє слово'}</div><h2>№${seat?.number || '—'} · ${esc(seat?.name || '—')}</h2></div></div>${moderatorCue(cue)}${timerControls('finish-last-word', next)}</section>`;
}

function bestMoveHtml() {
  const game = app.game;
  const seat = seatByNo(game.bestMove?.seat || game.lastWordSeat);
  const selected = game.bestMove?.selected || [];
  return `<section class="card control-card best-move-panel phase-enter">
    ${phaseStepsHtml(['Гравця вбито', 'Трійка чорних', 'До протоколу'], 1)}
    <div class="speaker-row"><div><div class="eyebrow">Кращий хід · перше нічне вбивство</div><h2>№${seat?.number || '—'} · ${esc(seat?.name || '—')}</h2></div><span class="badge gold">${selected.length}/3</span></div>
    ${moderatorCue(`Гравець номер ${seat?.number || '—'}, у вас 20 секунд і право назвати трійку чорних`)}
    <p class="best-move-help">Позначте три номери в тому порядку, в якому їх називає гравець.</p>
    ${targetsHtml(null, { action: 'best-move-target', selectedMany: selected })}
    ${timerControls('finish-best-move', 'Записати КХ')}
    <button class="btn secondary wide best-move-skip" data-action="skip-best-move">Без КХ</button>
  </section>`;
}

function nightHtml() {
  const game = app.game;
  const step = game.night.step;
  const steps = phaseStepsHtml(['Тиша', 'Постріл', 'Дон', 'Шериф', 'Ранок'], step);
  if (step === 0) return `<section class="card phase-panel phase-enter">${steps}<div class="night-symbol">☾</div><div class="eyebrow">Ніч ${game.day}</div><h2>Місто засинає</h2>${moderatorCue('У місті настає ніч. Усі сплять міцно та правильно')}<p>Усі живі гравці надягають маски. Перевірте тишу, руки й правильну нічну посадку.</p><button class="btn primary game-lead-action" data-action="night-next">Почати відстріл</button></section>`;
  if (step === 1) return nightTargetPanel('mafia', 'Мафія стріляє', 'Називайте місця від 1 до 10 з рівними паузами. Зафіксуйте ціль лише якщо всі живі чорні зробили постріл узгоджено.', game.night.target, `<button class="btn secondary" data-action="night-miss">Промах</button><button class="btn danger" data-action="night-shot-done" ${game.night.target == null ? 'disabled' : ''}>Зафіксувати постріл</button>`, steps, 'Не спить тільки Мафія, яка проходить повз гравців за номерами');
  if (step === 2) return nightCheckPanel('don');
  if (step === 3) return nightCheckPanel('sheriff');
  const target = game.night.target === -1 ? null : seatByNo(game.night.target);
  return `<section class="card phase-panel phase-enter">${steps}<div class="night-symbol">☾</div><div class="eyebrow">Результат відстрілу</div><h2>У місті триває ніч</h2>${moderatorCue(target ? `У місті триває ніч. Було вбито гравця номер ${target.number}` : 'У місті триває ніч, у місті промах. У місті ранок')}<p>${target ? `Після оголошення результату гравець №${target.number} · ${esc(target.name)} отримає Кращий хід або прощальну хвилину.` : 'Мафія промахнулася. Усі залишаються за столом.'}</p><button class="btn ${target ? 'danger' : 'primary'} game-lead-action" data-action="wake-city">${target ? 'Зафіксувати вибуття' : 'Почати наступний день'}</button></section>`;
}

function targetsHtml(selected, { action = 'night-target', selectedMany = [] } = {}) {
  return `<div class="target-grid">${app.game.seats.map(seat => {
    const unavailable = seat.status === 'dead';
    const isSelected = selected === seat.number || selectedMany.includes(seat.number);
    return `<button class="target ${unavailable ? 'dead' : ''} ${isSelected ? 'selected' : ''}" data-action="${action}" data-seat="${seat.number}" ${unavailable ? 'disabled aria-disabled="true"' : ''}><b>${seat.number}</b>${esc(seat.name)}</button>`;
  }).join('')}</div>`;
}

function compactTimerControls() {
  const game = app.game;
  return `<div class="compact-timer"><div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div><div class="compact-timer-actions"><button class="btn secondary" data-action="timer-minus" aria-label="Мінус 5 секунд">−5</button><button class="btn primary" data-action="timer-toggle">${game.timer.running ? 'Пауза' : 'Старт'}</button><button class="btn secondary" data-action="timer-plus" aria-label="Плюс 5 секунд">+5</button><button class="btn secondary" data-action="timer-reset">Скинути</button></div></div>`;
}

function nightTargetPanel(roleKey, title, text, selected, actions, steps = '', cue = '') {
  return `<section class="card phase-panel night-action-panel phase-enter">${steps}${roleSignal(roleKey, 'phase-signal', title)}<div class="eyebrow">Ніч ${app.game.day}</div><h2>${title}</h2>${cue ? moderatorCue(cue) : ''}<p>${text}</p>${compactTimerControls()}${targetsHtml(selected)}<div class="actions night-action-buttons">${actions}</div></section>`;
}

function nightCheckPanel(kind) {
  const isDon = kind === 'don';
  const game = app.game;
  const roleAlive = aliveSeats().some(seat => seat.role === (isDon ? 'don' : 'sheriff'));
  const selected = isDon ? game.night.donCheck : game.night.sheriffCheck;
  const actorRole = isDon ? 'don' : 'sheriff';
  const title = isDon ? 'Дон шукає Шерифа' : 'Шериф перевіряє місто';
  const steps = phaseStepsHtml(['Тиша', 'Постріл', 'Дон', 'Шериф', 'Ранок'], game.night.step);
  const cue = isDon ? 'Прокидається Дон гри' : 'Прокидається Шериф гри';
  if (!roleAlive) return `<section class="card phase-panel night-action-panel phase-enter">${steps}${roleSignal(actorRole, 'phase-signal', title)}<div class="eyebrow">Ніч ${game.day}</div><h2>${title}</h2>${moderatorCue(cue)}<p>Роль уже вибула. Оголосіть фазу та витримайте повну паузу, щоб не розкрити це столу.</p>${compactTimerControls()}<button class="btn primary game-lead-action" data-action="night-skip-check">Завершити паузу</button></section>`;
  if (selected && game.night.resultOpen) {
    const seat = seatByNo(selected);
    const hit = isDon ? seat.role === 'sheriff' : teamOf(seat) === 'black';
    const resultLabel = isDon ? (hit ? 'ЦЕ ШЕРИФ' : 'НЕ ШЕРИФ') : (hit ? 'ЧОРНИЙ' : 'ЧЕРВОНИЙ');
    const instruction = isDon
      ? (hit ? 'Кивніть і однією рукою покажіть «бублик / OK».' : 'Похитайте головою, схрестіть руки в X та обома покажіть «бублик / OK».')
      : (hit ? 'Кивніть і покажіть великий палець униз — Мафія або Дон.' : 'Похитайте головою й покажіть великий палець угору — Мирний або Шериф.');
    const image = isDon
      ? checkSignal(hit ? 'sheriffFound' : 'sheriffNotFound', 'night-result-signal', resultLabel)
      : roleSignal(hit ? 'mafia' : 'citizen', 'night-result-signal', resultLabel);
    return `<section class="card phase-panel night-result-panel phase-enter" role="status">${steps}<div class="eyebrow">Результат перевірки · гравець №${seat.number}</div>${image}<h2>${resultLabel}</h2><p><b>${instruction}</b><br>Сховайте екран одразу після сигналу.</p><div class="night-result-actions"><button class="btn secondary" data-action="night-hide-result">Змінити ціль</button><button class="btn primary game-lead-action" data-action="night-check-done">Сховати й далі</button></div></section>`;
  }
  return nightTargetPanel(actorRole, title, isDon ? 'Дон показує номер одного живого гравця.' : 'Шериф показує номер одного живого гравця.', selected, `<button class="btn danger wide game-lead-action" data-action="night-show-result" ${selected ? '' : 'disabled'}>Показати сигнал ведучого</button>`, steps, cue);
}

function moderatorSideHtml() {
  const game = app.game;
  const black = game.seats.filter(seat => teamOf(seat) === 'black');
  return `<section class="card card-pad"><div class="section-title section-heading">${titleHelp('h3', 'Панель ведучого', 'Ця панель містить приватну інформацію. Ролі початково приховані від випадкового погляду.')}<button class="btn small secondary" data-action="toggle-secret">${game.showSecrets ? 'Сховати' : 'Ролі'}</button></div>${game.showSecrets ? `<div class="nom-list">${black.map(seat => `<span class="badge">${roleOf(seat).symbol} №${seat.number} ${esc(seat.name)}</span>`).join('')}</div>` : ''}<div class="divider"></div><div class="actions"><button class="btn small secondary" data-action="undo" ${app.undo.length ? '' : 'disabled'}>↶ Скасувати</button><button class="btn small secondary" data-action="game-settings">⚙ Таймери</button><button class="btn small secondary" data-action="copy-protocol">Копіювати протокол</button><button class="btn small secondary" data-action="open-observer">Оглядач</button></div></section>
    <section class="card card-pad"><div class="section-title section-heading"><div><h3>Протокол</h3><p>${game.history.length} подій</p></div></div><div class="quick-log">${game.history.slice(0, 25).map(event => `<div class="log-item"><time>${esc(event.time)}</time>${esc(event.text)}</div>`).join('') || statePanel('empty', 'Подій ще немає', '', '', true)}</div></section>
    <button class="btn danger wide" data-action="end-game-manual">Завершити гру</button>`;
}

function observerSideHtml() {
  return `<section class="card card-pad"><div class="section-title section-heading">${titleHelp('h3', 'Публічна інформація', 'Тут не показуються ролі й нічні результати. Вкладка синхронізується з екраном ведучого в межах одного браузера.')}</div>${nominationChipsObserver()}</section>`;
}

function nominationChipsObserver() {
  return app.game.nominations.length ? `<div class="nom-list">${app.game.nominations.map(number => `<span class="badge red">№${number} ${esc(seatByNo(number)?.name)}</span>`).join('')}</div>` : '<span class="muted">Немає кандидатів</span>';
}

function winnerView(observer = false) {
  const red = app.game.winner === 'red';
  const draw = app.game.winner === 'draw';
  const title = draw ? 'Гру завершено нічиєю' : red ? 'Перемога мирного міста' : 'Перемога чорної команди';
  const detail = draw ? 'Результат зафіксовано без переможця.' : red ? 'Усі гравці чорної команди вибули.' : 'Чорна команда досягла паритету з містом.';
  return `<main class="page"><section class="card winner">${draw ? '<div class="winner-draw-mark" aria-hidden="true">＝</div>' : roleSignal(red ? 'citizen' : 'mafia', 'winner-signal', title)}<div class="eyebrow">Фінал гри</div><h1>${title}</h1><p class="muted">${detail}</p>${observer ? '' : `<div class="actions" style="justify-content:center">${app.undo.length ? '<button class="btn secondary" data-action="undo">↶ Скасувати результат</button>' : ''}<button class="btn secondary" data-action="copy-protocol">Копіювати протокол</button><button class="btn primary" data-action="rematch">Реванш</button><button class="btn secondary" data-nav="home">На головну</button></div>`}</section></main>`;
}

function playerModalHtml() {
  const player = app.modal.player;
  const editing = Boolean(player.id);
  const sharedProfile = Boolean(player.cloudManualId);
  const email = player.email || (isValidPlayerEmail(player.contact) ? normalizePlayerEmail(player.contact) : '');
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal" data-form="player" aria-modal="true" role="dialog">
    <div class="section-title section-heading">${titleHelp('h2', editing ? 'Профіль гравця' : 'Новий гравець', 'Ручні профілі та аватари зберігаються у спільному каталозі. Будь-який авторизований користувач може їх редагувати або видаляти. Google-профіль змінює лише його власник.')}<button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div>
    <div class="avatar-editor">${avatar(player, 'large')}<div><div class="avatar-source-actions"><label class="btn primary" for="avatar-camera">${cameraIcon()}<span>Зробити фото</span></label><input id="avatar-camera" class="visually-hidden" type="file" accept="image/*" capture="environment" data-input="avatar-camera"><label class="btn secondary" for="avatar-gallery">Обрати з галереї</label><input id="avatar-gallery" class="visually-hidden" type="file" accept="image/*" data-input="avatar-gallery"></div></div></div>
    <div class="stack">
      <div class="field"><label for="player-name">Ім’я *</label><input id="player-name" class="input" name="name" value="${esc(player.name || '')}" maxlength="60" required autofocus></div>
      <div class="field"><label for="player-nickname">Нік / позивний</label><input id="player-nickname" class="input" name="nickname" value="${esc(player.nickname || '')}" maxlength="40"></div>
      ${sharedProfile ? '' : `<div class="field"><label for="player-email">${help('Email для синхронізації', 'Коли власник цього email увійде через Google, застосунок запропонує йому об’єднати ручний запис із підтвердженим профілем. Email не показується в каталозі.')}</label><input id="player-email" class="input" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" name="email" value="${esc(email)}" maxlength="254" placeholder="player@gmail.com"></div>`}
      <div class="field"><label for="player-contact">Контакт або клуб</label><input id="player-contact" class="input" name="contact" value="${esc(player.contact || '')}" maxlength="100" placeholder="Необов’язково"></div>
      <div class="field"><label for="player-notes">Опис і нотатки</label><textarea id="player-notes" class="textarea" name="notes" maxlength="600" placeholder="Стиль гри, організаційні деталі…">${esc(player.notes || '')}</textarea></div>
    </div>
    <div class="modal-actions">${editing ? '<button class="btn danger" type="button" data-action="delete-player">Видалити</button>' : ''}<button class="btn secondary" type="button" data-action="close-modal">Скасувати</button><button class="btn primary" type="submit">Зберегти</button></div>
  </form></div>`;
}

function hostProfileModalHtml() {
  const profile = { ...(app.hostProfile || {}), ...(app.modal?.profileDraft || {}) };
  const photo = profile.avatar || app.authUser?.googlePhotoURL || '';
  const photoDraftChanged = Boolean(app.modal?.profileDraft && Object.hasOwn(app.modal.profileDraft, 'avatar') && profile.avatar !== app.hostProfile?.avatar);
  const photoSyncStatus = photoDraftChanged ? 'pending' : app.profilePhotoSync.status;
  return `<div class="modal-backdrop host-profile-backdrop" data-action="close-modal"><form class="card modal host-profile-modal" data-form="host-profile" aria-modal="true" role="dialog" tabindex="-1">
    <div class="section-title section-heading">${titleHelp('h2', 'Мій профіль Enjoy', 'Ці дані допоможуть ведучим знайти вас і додати на стіл. Власний аватар стискається локально; видалення власного фото повертає фотографію Google.')}<div class="profile-modal-title-actions"><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div></div>
    <div class="avatar-editor">${avatar({ name: profile.displayName || app.authUser?.googleName, avatar: photo }, 'large')}<div><div class="avatar-source-actions"><label class="btn primary" for="host-avatar-camera">${cameraIcon()}<span>Зробити фото</span></label><input id="host-avatar-camera" class="visually-hidden" type="file" accept="image/*" capture="environment" data-input="host-avatar-camera"><label class="btn secondary" for="host-avatar-gallery">Обрати з галереї</label><input id="host-avatar-gallery" class="visually-hidden" type="file" accept="image/*" data-input="host-avatar-gallery">${app.authUser?.googlePhotoURL && profile.avatar ? '<button class="btn secondary" type="button" data-action="host-use-google-photo">Фото Google</button>' : ''}</div>${profilePhotoSyncHtml(Boolean(profile.avatar), photoSyncStatus)}</div></div>
    <div class="stack">
      <div class="field"><label for="host-display-name">Ім’я для відображення *</label><input id="host-display-name" class="input" name="displayName" value="${esc(profile.displayName || app.authUser?.googleName || '')}" maxlength="60" required></div>
      <div class="field"><label for="host-nickname">Нікнейм</label><input id="host-nickname" class="input" name="nickname" value="${esc(profile.nickname || '')}" maxlength="40"></div>
      <div class="field"><label for="host-club">Клуб або організація</label><input id="host-club" class="input" name="club" value="${esc(profile.club || '')}" maxlength="100"></div>
      <div class="field"><label for="host-description">Про себе</label><textarea id="host-description" class="textarea" name="description" maxlength="600" placeholder="Досвід ведення, улюблена кава…">${esc(profile.description || '')}</textarea></div>
      <label class="toggle-row profile-visibility"><span>${help('Показувати мене в каталозі Enjoy', 'Ім’я, нік, клуб, опис і вибраний аватар бачитимуть лише авторизовані користувачі.')}</span><input type="checkbox" name="discoverable" ${profile.discoverable !== false ? 'checked' : ''}></label>
      <div class="field"><span class="field-label">${help('Мова застосунку', 'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.')}</span>${languagePickerHtml()}</div>
      <div class="field"><span class="field-label">Google-акаунт</span><div class="identity-field"><span>${esc(app.authUser?.email || '')}</span><div class="identity-actions"><span class="badge green">Підтверджено</span><button class="icon-btn account-delete-btn" type="button" data-action="delete-account" aria-label="Видалити профіль" title="Видалити профіль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg></button></div></div></div>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Скасувати</button><button class="btn primary" type="submit">Зберегти профіль</button></div>
  </form></div>`;
}

function migrationModalHtml() {
  const summary = app.legacyMigration;
  return `<div class="modal-backdrop"><div class="card modal" role="dialog" aria-modal="true"><div class="eyebrow">Одноразове перенесення</div>${titleHelp('h2', 'Знайдено дані попередньої версії', 'Початкова база не видаляється. Не переносіть її, якщо цей пристрій раніше належав іншому ведучому.')}<p>Прив’язати локальні дані цього браузера до Google-профілю <b>${esc(app.authUser?.email || '')}</b>?</p><div class="stat-grid migration-stats"><article class="stat-card"><b>${summary.players}</b><span>профілів гравців</span></article><article class="stat-card"><b>${summary.games}</b><span>ігор</span></article></div><div class="modal-actions"><button class="btn secondary" data-action="skip-legacy-migration">Не зараз</button><button class="btn primary" data-action="migrate-legacy-data">Перенести</button></div></div></div>`;
}

function playerLinkOfferModalHtml() {
  const offer = app.playerLinkOffers[0];
  if (!offer) return '';
  const googleName = app.hostProfile?.displayName || app.authUser?.googleName || app.authUser?.email || 'Google-профіль';
  return `<div class="modal-backdrop"><div class="card modal player-link-modal" role="dialog" aria-modal="true" aria-labelledby="player-link-title">
    <div class="section-title section-heading">${titleHelp('h2', 'Об’єднати профілі?', `Ведучий ${offer.ownerName} раніше додав цей email до ручного профілю. Після підтвердження ведучий бачитиме один Google-профіль, а пов’язана історія ігор буде збережена. Email доступний лише вам і цьому ведучому.`)}</div>
    <div class="profile-merge-preview">
      <article><span class="merge-source">Ручний запис</span><b>${esc(offer.nickname || offer.playerName)}</b><small>${offer.nickname ? esc(offer.playerName) : `Ведучий: ${esc(offer.ownerName)}`}</small></article>
      <span class="merge-arrow" aria-hidden="true">→</span>
      <article>${hostAvatar('small')}<span class="merge-source">Google-профіль</span><b>${esc(googleName)}</b><small>${esc(app.authUser?.email || '')}</small></article>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="skip-player-link" ${app.playerLinkBusy ? 'disabled' : ''}>Не зараз</button><button class="btn primary" type="button" data-action="accept-player-link" ${app.playerLinkBusy ? 'disabled' : ''}>${app.playerLinkBusy ? 'Об’єднуємо…' : 'Об’єднати'}</button></div>
  </div></div>`;
}

function seatModalHtml() {
  const seat = seatByNo(app.modal.seat);
  const role = roleOf(seat);
  const canNominate = app.game.phase === 'day' && app.game.subphase === 'speeches' && seat.status === 'alive' && currentSpeaker()?.number !== seat.number && !app.game.nominations.includes(seat.number);
  return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal game-modal seat-control-modal ${seat.status === 'alive' ? 'seat-alive-modal' : 'seat-dead-modal'}" aria-modal="true" role="dialog" aria-label="Керування гравцем на місці ${seat.number}">
    <button class="icon-btn modal-close" type="button" data-action="close-modal" aria-label="Закрити">×</button>
    <div class="seat-sheet-head ${seat.status === 'alive' ? 'alive' : 'dead'}"><div class="seat-sheet-number"><span>Місце</span><strong>${seat.number}</strong></div><div class="seat-sheet-player">${avatar({ ...(seat.profileId ? playerById(seat.profileId) : {}), name: seat.name }, '')}<div class="seat-sheet-copy"><h2>${esc(seat.name)}</h2><span class="badge ${seat.status === 'alive' ? 'green' : ''}">${seat.status === 'alive' ? 'За столом' : 'Вибув'}</span></div></div></div>
    <div class="divider"></div>
    <div class="list"><div class="list-row"><span class="muted">Фоли</span><b>${seat.faults} / 4</b></div>${app.game.showSecrets ? `<div class="list-row"><span class="muted">Роль</span><b>${role?.symbol} ${role?.label}</b></div>` : ''}${seat.eliminatedReason ? `<div class="list-row"><span class="muted">Причина вибуття</span><b>${esc(seat.eliminatedReason)}</b></div>` : ''}</div>
    <div class="divider"></div>
    <div class="seat-action-grid"><button class="btn" data-action="add-fault" data-seat="${seat.number}" ${seat.status === 'alive' && seat.faults < 4 ? '' : 'disabled'}>+ Фол</button><button class="btn" data-action="remove-fault" data-seat="${seat.number}" ${seat.faults ? '' : 'disabled'}>− Фол</button><button class="btn primary" data-action="nominate" data-seat="${seat.number}" ${canNominate ? '' : 'disabled'}>Виставити</button>${seat.status === 'alive' ? `<button class="btn danger" data-action="manual-eliminate" data-seat="${seat.number}">Вивести</button>` : '<button class="btn" data-action="restore-seat">Повернути</button>'}</div>
    <div class="modal-actions"><button class="btn primary" data-action="close-modal">Готово</button></div>
  </div></div>`;
}

function protocolModalHtml() {
  const game = gameById(app.modal.gameId) || app.game;
  return `<div class="modal-backdrop protocol-backdrop" data-action="close-modal"><div class="card modal game-modal protocol-modal" aria-modal="true" role="dialog" tabindex="-1"><div class="section-title section-heading game-dialog-head"><div><span class="eyebrow">Історія подій</span><h2>Протокол гри</h2><p>${esc(game.title)} · ${formatDate(game.startedAt, true)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Закрити">×</button></div><div class="quick-log protocol-log">${game.history.slice().reverse().map(event => `<div class="log-item"><time>${esc(event.time)}</time>${esc(event.text)}</div>`).join('')}</div><div class="modal-actions"><button class="btn secondary" data-action="copy-protocol" data-id="${game.id}">Копіювати</button><button class="btn primary" data-action="close-modal">Закрити</button></div></div></div>`;
}

function confirmModalHtml() {
  return `<div class="modal-backdrop"><div class="card modal game-modal danger-modal" aria-modal="true" role="alertdialog"><div class="game-dialog-head"><div><span class="eyebrow">Потрібне підтвердження</span><h2>${esc(app.modal.title)}</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div><p class="game-dialog-copy">${esc(app.modal.text)}</p><div class="modal-actions"><button class="btn secondary" data-action="close-modal">Скасувати</button><button class="btn danger" data-action="confirm-action">${esc(app.modal.confirmLabel || 'Підтвердити')}</button></div></div></div>`;
}

function gameSettingsModalHtml() {
  const settings = app.game.settings;
  const labels = {
    speech: 'Промова, сек', tieSpeech: 'Автокатастрофа, сек', lastWord: 'Останнє слово, сек',
    nightCheck: 'Нічна дія, сек', mafiaMeet: 'Знайомство мафії, сек',
    sheriffMark: 'Позначення Шерифа, сек', freeSeating: 'Вільна посадка, сек', bestMove: 'Кращий хід, сек'
  };
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal game-modal game-settings-modal" data-form="game-settings" role="dialog" aria-modal="true"><div class="section-title section-heading game-dialog-head"><div><span class="eyebrow">Активна гра</span>${titleHelp('h2', 'Налаштування гри', 'Нові значення діятимуть із наступної відповідної фази.')}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div><div class="setup-options">${Object.keys(labels).map(key => `<div class="field"><label>${labels[key]}</label><input class="input" type="number" name="${key}" min="5" max="180" step="5" value="${settings[key]}"></div>`).join('')}</div><div class="divider"></div><div class="field"><label>${help('Система фолів', FOUL_SYSTEM_HELP)}</label><select class="select" name="penaltyMode"><option value="tournament" ${settings.penaltyMode === 'tournament' ? 'selected' : ''}>Турнірна</option><option value="club" ${settings.penaltyMode === 'club' ? 'selected' : ''}>Клубна</option></select></div><div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Скасувати</button><button class="btn primary" type="submit">Застосувати</button></div></form></div>`;
}

function setupMoveModalHtml() {
  const source = app.draft?.seats.find(seat => seat.number === Number(app.modal.seat));
  if (!source) return '';
  return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal setup-move-modal" role="dialog" aria-modal="true" aria-labelledby="setup-move-title">
    <div class="section-title section-heading"><div><h2 id="setup-move-title">Перемістити з місця ${source.number}</h2><p>${esc(draftSeatLabel(source))}</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div>
    <div class="setup-move-grid">${app.draft.seats.map(target => `<button class="setup-move-target ${target.number === source.number ? 'current' : ''}" type="button" data-action="move-setup-to" data-from="${source.number}" data-to="${target.number}" ${target.number === source.number ? 'disabled' : ''}><b>№${target.number}</b><span>${esc(draftSeatLabel(target))}</span></button>`).join('')}</div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Скасувати</button></div>
  </div></div>`;
}

function setupAvatarModalHtml() {
  const seat = app.draft?.seats.find(item => item.number === Number(app.modal.seat));
  const player = seat?.profileId ? playerById(seat.profileId) : null;
  if (!seat || !editableManualPlayer(player)) return '';
  const busy = Boolean(app.modal.busy);
  const occupiedPresets = new Set(app.draft.seats
    .filter(item => item.number !== seat.number && item.profileId)
    .map(item => playerById(item.profileId)?.avatarPreset)
    .filter(Boolean));
  const choices = ANIMAL_AVATARS.map(source => {
    const fileName = source.split('/').at(-1);
    const label = ANIMAL_AVATAR_LABELS[fileName] || 'Аватар';
    const occupied = occupiedPresets.has(source);
    return `<button class="setup-avatar-choice ${player.avatarPreset === source ? 'selected' : ''}" type="button" data-action="choose-setup-avatar" data-seat="${seat.number}" data-avatar="${esc(source)}" aria-label="${esc(label)}${occupied ? ' · уже використовується' : ''}" title="${esc(label)}" ${busy || occupied ? 'disabled' : ''}><img src="${esc(source)}" alt=""></button>`;
  }).join('');
  return `<div class="modal-backdrop" ${busy ? '' : 'data-action="close-modal"'}><div class="card modal setup-avatar-modal" role="dialog" aria-modal="true" aria-labelledby="setup-avatar-title" aria-busy="${busy}">
    <div class="section-title section-heading"><div><span class="eyebrow">Місце ${seat.number}</span><h2 id="setup-avatar-title">Аватар гравця</h2><p>${esc(preferredPlayerName(player))}</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити" ${busy ? 'disabled' : ''}>×</button></div>
    <p class="setup-avatar-help">Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.</p>
    <div class="setup-avatar-grid">${choices}</div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal" ${busy ? 'disabled' : ''}>Скасувати</button></div>
  </div></div>`;
}

function deleteAccountModalHtml() {
  return `<div class="modal-backdrop account-delete-backdrop" ${app.accountDeleteBusy ? '' : 'data-action="close-modal"'}><div class="card modal account-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" tabindex="-1">
    <div class="account-delete-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg></div>
    <h2 id="delete-account-title">Видалити профіль Mafia?</h2>
    <p>Профіль зникне з каталогу Enjoy, а локальні профілі, активні ігри та налаштування цього акаунта на цьому пристрої буде видалено.</p>
    <p class="danger-text"><b>Цю дію неможливо скасувати.</b> Google попросить повторно підтвердити акаунт.</p>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal" ${app.accountDeleteBusy ? 'disabled' : ''}>Скасувати</button><button class="btn danger" type="button" data-action="confirm-delete-account" ${app.accountDeleteBusy ? 'disabled' : ''}>${app.accountDeleteBusy ? 'Видаляємо…' : 'Видалити профіль'}</button></div>
  </div></div>`;
}

function mediaModalHtml() {
  const bluetoothKind = CLIENT_PLATFORM === 'ios'
    ? 'idle'
    : app.bluetooth.error
    ? 'error'
    : app.bluetooth.deviceName
      ? 'success'
      : app.bluetooth.supported && app.bluetooth.available !== false
        ? 'idle'
        : 'offline';
  const bluetoothTitle = CLIENT_PLATFORM === 'ios'
    ? 'Підключення через iPhone'
    : app.bluetooth.error
    ? 'Bluetooth недоступний'
    : app.bluetooth.deviceName
      ? `Доступ до «${app.bluetooth.deviceName}» надано`
      : app.bluetooth.supported && app.bluetooth.available !== false
        ? 'Можна вибрати BLE-пристрій'
        : 'Web Bluetooth не підтримується';
  const bluetoothDetail = CLIENT_PLATFORM === 'ios'
    ? 'Safari не може самостійно відкрити системний список Bluetooth. Скористайтеся Центром керування або Параметрами iPhone.'
    : app.bluetooth.error
    || (app.bluetooth.deviceName
      ? 'Це дозвіл сайту на роботу з BLE, а не підключення аудіоколонки.'
      : 'Аудіоколонку або навушники підключайте у системних налаштуваннях телефона.');
  const mediaKind = app.media.error ? 'error' : app.media.playing ? 'success' : app.media.trackName ? 'idle' : 'empty';
  const mediaTitle = app.media.error || (app.media.trackName ? app.media.trackName : 'Аудіофайл не обрано');
  const mediaDetail = app.media.error
    ? 'Оберіть інший файл.'
    : app.media.playing
      ? 'Відтворюється через поточний аудіовихід телефона.'
      : app.media.trackName
        ? 'Готово до відтворення.'
        : 'MP3, M4A, WAV або інший формат, який підтримує браузер.';
  return `<div class="modal-backdrop media-backdrop" data-action="close-modal"><div id="media-panel" class="card modal media-modal" role="dialog" aria-modal="true" aria-labelledby="media-panel-title" tabindex="-1">
    <div class="section-title section-heading"><div><h2 id="media-panel-title">Bluetooth і музика</h2><p>Керування звуком для гри</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
    <div class="media-panel-stack">
      <section class="media-panel-section">
        <div class="compact-help-row"><b>Bluetooth</b>${helpIcon('На Android кнопка Bluetooth у мобільній шапці відкриває системні налаштування, якщо браузер і виробник телефона дозволяють системний перехід. На iPhone вебсторінка не має доступу до системної Bluetooth-панелі. Web Bluetooth працює лише з BLE-пристроями, а не з аудіопрофілем колонки.', 'Як працює Bluetooth')}</div>
        ${statePanel(bluetoothKind, bluetoothTitle, bluetoothDetail, '', true)}
        <div class="ios-bluetooth-guide" role="note">
          <b>Швидко на iPhone</b>
          <ol><li>Змахніть униз від правого верхнього кута, щоб відкрити Центр керування.</li><li>Для вже спареної колонки торкніть кнопку вибору аудіовиходу у блоці відтворення та виберіть колонку.</li><li>Для нової колонки відкрийте Параметри → Bluetooth і торкніть її назву.</li></ol>
        </div>
        ${app.bluetooth.supported ? `<button class="btn secondary wide" type="button" data-action="bluetooth-request" ${app.bluetooth.busy || app.bluetooth.available === false ? 'disabled' : ''}>${app.bluetooth.busy ? 'Відкриваємо список…' : 'Вибрати BLE-пристрій'}</button>` : ''}
      </section>
      <section class="media-panel-section">
        <div class="compact-help-row"><b>Музика в Mafia</b>${helpIcon('Play і Pause керують лише аудіо, відкритим у Mafia. Іншими мобільними застосунками — Spotify, YouTube Music тощо — вебсторінка керувати не може.', 'Як працює керування музикою')}</div>
        ${statePanel(mediaKind, mediaTitle, mediaDetail, '', true)}
        <div class="media-file-actions"><label class="btn primary" for="music-file">Обрати аудіофайл</label><input id="music-file" class="visually-hidden" type="file" accept="audio/*" data-input="music-file">${app.media.trackName ? '<button class="btn secondary" type="button" data-action="media-clear">Прибрати</button>' : ''}</div>
        <div class="media-transport-actions"><button class="btn primary" type="button" data-action="media-play" ${!app.media.trackName || app.media.playing ? 'disabled' : ''}>${headerControlIcon('play')}<span>Play</span></button><button class="btn secondary" type="button" data-action="media-pause" ${!app.media.playing ? 'disabled' : ''}>${headerControlIcon('pause')}<span>Pause</span></button></div>
        <p class="privacy-note media-note">Файл відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.</p>
      </section>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Закрити</button></div>
  </div></div>`;
}

function orderDrinkIcon(key) {
  const paths = {
    coffee: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15M9 3c-1 1-.8 2 0 3m4-3c-1 1-.8 2 0 3"/>',
    tea: '<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15M11 8c0-3 2-5 5-5 0 3-2 5-5 5Z"/>',
    cappuccino: '<path d="M5 10h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15"/><path d="M7 9c0-2 2-3 3.5-1C12 6 14 7 14 9"/>',
    latte: '<path d="M7 4h10l-1 16H8L7 4Zm1 5h8M8 14h8M5 21h14M10 2h4"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key]}</svg>`;
}

function orderModalHtml() {
  const order = app.order;
  const lastLabel = ORDER_MENU.find(item => item.key === order.lastItem)?.label || '';
  const status = order.status === 'success'
    ? statePanel('success', `«${lastLabel}» — замовлення надіслано`, 'Повідомлення передано тестовому одержувачу в Telegram.', '', true)
    : order.status === 'error'
      ? statePanel('error', 'Замовлення не надіслано', order.error, '', true)
      : '';
  return `<div class="modal-backdrop order-backdrop" ${order.busy ? '' : 'data-action="close-modal"'}><div class="card modal order-modal" role="dialog" aria-modal="true" aria-labelledby="order-panel-title" aria-busy="${order.busy}">
    <div class="section-title section-heading"><div><span class="eyebrow">Кав’ярня Enjoy</span><h2 id="order-panel-title">Замовлення напою</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити" ${order.busy ? 'disabled' : ''}>×</button></div>
    <p class="order-intro">Оберіть напій — повідомлення відразу піде в Telegram.</p>
    ${status}
    <div class="order-menu-grid">${ORDER_MENU.map(item => `<button class="order-menu-item" type="button" data-action="place-order" data-item="${item.key}" ${order.busy ? 'disabled' : ''}>${orderDrinkIcon(item.key)}<b>${item.label}</b></button>`).join('')}</div>
    <p class="privacy-note order-recipient-note">Тестовий одержувач: @Chemelev</p>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal" ${order.busy ? 'disabled' : ''}>Закрити</button></div>
  </div></div>`;
}

function modalHtml() {
  if (!app.modal) return '';
  if (app.modal.type === 'player') return playerModalHtml();
  if (app.modal.type === 'host-profile') return hostProfileModalHtml();
  if (app.modal.type === 'legacy-migration') return migrationModalHtml();
  if (app.modal.type === 'player-link-offer') return playerLinkOfferModalHtml();
  if (app.modal.type === 'seat') return seatModalHtml();
  if (app.modal.type === 'protocol') return protocolModalHtml();
  if (app.modal.type === 'confirm') return confirmModalHtml();
  if (app.modal.type === 'game-settings') return gameSettingsModalHtml();
  if (app.modal.type === 'setup-move') return setupMoveModalHtml();
  if (app.modal.type === 'setup-avatar') return setupAvatarModalHtml();
  if (app.modal.type === 'delete-account') return deleteAccountModalHtml();
  if (app.modal.type === 'media') return mediaModalHtml();
  if (app.modal.type === 'order') return orderModalHtml();
  if (app.modal.type === 'winner') return `<div class="modal-backdrop"><div class="card modal game-modal decision-modal" role="dialog" aria-modal="true"><div class="game-dialog-head"><div><span class="eyebrow">Завершення гри</span>${titleHelp('h2', 'Результат гри', 'Ручне завершення потрібне для нестандартної ситуації, нічиєї або рішення судді.')}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div><p class="game-dialog-copy">Оберіть результат. Він одразу потрапить до протоколу та статистики.</p><div class="winner-choice-grid"><button class="btn primary winner-choice" data-action="finish-red"><span>●</span><strong>Мирне місто</strong><small>Червона команда</small></button><button class="btn danger winner-choice" data-action="finish-black"><span>◆</span><strong>Мафія</strong><small>Чорна команда</small></button><button class="btn secondary winner-choice winner-draw-choice" data-action="finish-draw"><span>＝</span><strong>Нічия</strong><small>Без переможця</small></button></div><div class="modal-actions"><button class="btn secondary" data-action="close-modal">Скасувати</button></div></div></div>`;
  return '';
}

function render() {
  if (app.route !== 'observer') syncObserverTimer();
  if (!app.authReady) {
    appRoot.innerHTML = authLoadingView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'true');
    return;
  }
  if (!app.authConfigured) {
    appRoot.innerHTML = firebaseSetupView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'false');
    return;
  }
  if (!app.authUser) {
    appRoot.innerHTML = loginView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'false');
    return;
  }
  showPlayerLinkOffer();
  const observer = app.route === 'observer' || Boolean(app.game?.publicOnly) || (app.route === 'game' && !canManageGame(app.game));
  let content = '';
  if (app.route === 'home') content = homeView();
  else if (app.route === 'players') content = playersView();
  else if (app.route === 'setup') content = setupView();
  else if (app.route === 'stats') content = statsView();
  else if (app.route === 'settings') content = settingsView();
  else if (app.route === 'reveal') content = revealView();
  else if (app.route === 'game' || observer) content = gameView(observer);
  appRoot.innerHTML = `${headerHtml()}${bottomNavHtml()}${content}`;
  modalRoot.innerHTML = modalHtml();
  localizeDom(appRoot, app.settings.language);
  localizeDom(modalRoot, app.settings.language);
  const activeDialog = modalRoot.querySelector('.modal');
  if (activeDialog) {
    if (!activeDialog.hasAttribute('tabindex')) activeDialog.setAttribute('tabindex', '-1');
    activeDialog.scrollTop = 0;
    activeDialog.focus({ preventScroll: true });
  }
  appRoot.setAttribute('aria-busy', 'false');
  syncObserverTimer();
  if (['game', 'reveal'].includes(app.route)) requestAnimationFrame(requestGameWakeLock);
}

function showTooltip(button) {
  const text = button.dataset.tooltip;
  const rect = button.getBoundingClientRect();
  tooltipRoot.innerHTML = `<div class="tooltip-pop" role="tooltip">${esc(text)}</div>`;
  const pop = tooltipRoot.firstElementChild;
  const left = Math.min(window.innerWidth - pop.offsetWidth - 14, Math.max(14, rect.left - pop.offsetWidth / 2 + rect.width / 2));
  const below = rect.bottom + 8;
  const top = below + pop.offsetHeight < window.innerHeight ? below : Math.max(14, rect.top - pop.offsetHeight - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  app.tooltip = text;
}

function closeOverlays() {
  tooltipRoot.innerHTML = '';
  app.tooltip = null;
}

async function refreshData() {
  const [players, games] = await Promise.all([getAll('players'), getAll('games')]);
  app.localPlayers = players;
  app.localGames = games.map(game => normalizeGameState(game, DEFAULT_SETTINGS));
  mergePlayerSources();
  mergeGameSources();
  const active = activeGames()[0];
  if (active && (!app.game || app.game.id === active.id)) app.game = active;
}

function shuffled(values) {
  return secureShuffle(values);
}

function createGameFromDraft() {
  const roles = shuffled(ROLE_DECK.map(role => role.key));
  const fallbackAvatars = setupAnimalAvatarMap();
  const missingGuestNames = pickFunnyGuestNames(
    app.draft.seats.filter(seat => !seat.profileId && !String(seat.name || '').trim()).length,
    app.draft.seats.map(seat => seat.name)
  );
  const seats = app.draft.seats.map((draftSeat, index) => {
    const profile = draftSeat.profileId ? playerById(draftSeat.profileId) : null;
    return {
      number: index + 1,
      profileId: profile?.id || null,
      name: preferredPlayerName(profile) || draftSeat.name.trim() || missingGuestNames.shift(),
      avatar: profile?.avatar || profile?.avatarPreset || fallbackAvatars.get(setupAvatarKey(draftSeat, profile)) || ANIMAL_AVATARS[index % ANIMAL_AVATARS.length],
      role: roles[index],
      status: 'alive', faults: 0, nominatedBy: null, noVote: false,
      restrictionDay: null, shortSpeechDay: null, eliminatedReason: ''
    };
  });
  const timestamp = nowIso();
  return {
    id: uid('game'), title: app.draft.title.trim() || 'Гра в Мафію', venue: app.draft.venue.trim(), notes: app.draft.notes.trim(),
    ownerUid: app.authUser?.uid || '', hostName: String(app.hostProfile?.nickname || '').trim() || app.hostProfile?.displayName || app.authUser?.googleName || 'Ведучий',
    createdAt: timestamp, startedAt: timestamp, updatedAt: timestamp, endedAt: null,
    status: 'active', phase: 'reveal', subphase: '', day: 1, winner: null, durationSeconds: 0,
    settings: { ...app.draft.settings }, seats, revealIndex: 0, revealOpen: false,
    zeroNight: { step: 0 },
    speakerIndex: 0, speakerOrder: seats.map(seat => seat.number), nominations: [],
    vote: { counts: {}, tied: [], tieKey: '', tieRound: 0, yes: 0, no: 0 },
    night: { step: 0, target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    bestMove: { seat: null, selected: [] },
    timer: { remaining: app.draft.settings.speech, running: false, purpose: 'speech' },
    lastWordSeat: null, pendingLastWords: [], pendingWinner: null, afterNightKill: false, showSecrets: false,
    history: [{ at: timestamp, time: new Date(timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }), text: 'Створено нову гру та випадково розподілено ролі.', secret: true }]
  };
}

function publicGame(game) {
  if (!game) return null;
  const clean = clone(game);
  clean.seats.forEach(seat => { delete seat.role; delete seat.profileId; });
  clean.history = clean.history.filter(event => !event.secret);
  clean.night = { step: clean.night.step, target: clean.night.step >= 4 ? clean.night.target : null };
  delete clean.pendingWinner;
  clean.showSecrets = false;
  return clean;
}

function queueActiveGamePublish(game) {
  if (!app.authUser || LOCAL_AUTH_TEST || game?.status !== 'active' || game.publicOnly) return;
  if (game.ownerUid && game.ownerUid !== app.authUser.uid) return;
  pendingActiveGames.set(game.id, clone(game));
  if (activeGamePublishPromise) return;
  activeGamePublishPromise = (async () => {
    while (pendingActiveGames.size) {
      const [gameId, pending] = pendingActiveGames.entries().next().value;
      pendingActiveGames.delete(gameId);
      try {
        await saveActiveCommunityGame(app.authUser, app.hostProfile, pending);
      } catch (error) {
        app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
      }
    }
  })().finally(() => {
    activeGamePublishPromise = null;
    if (pendingActiveGames.size) queueActiveGamePublish(pendingActiveGames.values().next().value);
  });
}

async function flushActiveGamePublish(gameId) {
  pendingActiveGames.delete(gameId);
  while (activeGamePublishPromise) await activeGamePublishPromise;
  pendingActiveGames.delete(gameId);
}

async function saveGame({ broadcast = true } = {}) {
  if (!app.game || app.game.publicOnly || !canManageGame(app.game)) return;
  const stateErrors = gameStateErrors(app.game);
  if (stateErrors.length) throw new Error(`Гру не збережено: ${stateErrors[0]}`);
  app.game.updatedAt = nowIso();
  app.game.timer.running = Boolean(app.game.timer.running);
  await putOne('games', app.game);
  const index = app.localGames.findIndex(game => game.id === app.game.id);
  if (index >= 0) app.localGames[index] = clone(app.game); else app.localGames.push(clone(app.game));
  mergeGameSources();
  if (broadcast) channel?.postMessage({ type: 'game', game: publicGame(app.game) });
  if (app.game.status === 'active') queueActiveGamePublish(app.game);
}

function addLog(text, secret = false) {
  const at = nowIso();
  app.game.history.unshift({ at, time: new Date(at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }), text, secret });
  if (app.game.history.length > 500) app.game.history.length = 500;
}

function pushUndo() {
  const snapshot = clone(app.game);
  snapshot.timer.running = false;
  app.undo.push(snapshot);
  if (app.undo.length > 30) app.undo.shift();
}

function stopTimer() {
  if (!app.game) return;
  if (app.game.timer.running) app.game.timer.remaining = timerRemainingAt(app.game.timer);
  app.game.timer.running = false;
  delete app.game.timer.endsAt;
  clearInterval(app.timerHandle);
  app.timerHandle = null;
  app.wakeLock?.release?.().catch(() => {});
  app.wakeLock = null;
}

function requestGameWakeLock() {
  if (!['game', 'reveal'].includes(app.route) || document.hidden || app.wakeLock) return;
  navigator.wakeLock?.request('screen').then(lock => {
    app.wakeLock = lock;
    lock.addEventListener?.('release', () => { if (app.wakeLock === lock) app.wakeLock = null; });
  }).catch(() => {});
}

function timerBase() {
  const purpose = app.game.timer.purpose;
  if (purpose === 'tie') return app.game.settings.tieSpeech;
  if (purpose === 'lastWord') return app.game.settings.lastWord;
  if (purpose === 'night') return app.game.settings.nightCheck;
  if (purpose === 'mafiaMeet') return app.game.settings.mafiaMeet;
  if (purpose === 'sheriffMark') return app.game.settings.sheriffMark;
  if (purpose === 'freeSeating') return app.game.settings.freeSeating;
  if (purpose === 'bestMove') return app.game.settings.bestMove;
  return speechTimerBase();
}

function speechTimerBase() {
  const speaker = currentSpeaker();
  if (speaker?.shortSpeechDay && app.game.day >= speaker.shortSpeechDay) return 30;
  if (speaker?.restrictionDay && app.game.day >= speaker.restrictionDay) return aliveSeats().length <= 4 ? 30 : 0;
  return app.game.settings.speech;
}

function setTimer(seconds, purpose = 'speech') {
  stopTimer();
  app.game.timer = { remaining: Math.max(0, Number(seconds) || 0), running: false, purpose };
}

function startTimer() {
  if (!app.game || app.game.timer.running || app.game.timer.remaining <= 0) return;
  prepareTimerAudio();
  app.game.timer.running = true;
  app.game.timer.endsAt = Date.now() + app.game.timer.remaining * 1000;
  requestGameWakeLock();
  clearInterval(app.timerHandle);
  let lastSecond = app.game.timer.remaining;
  app.timerHandle = setInterval(async () => {
    if (!app.game?.timer.running) return;
    app.game.timer.remaining = timerRemainingAt(app.game.timer);
    if (app.game.timer.remaining === lastSecond) return;
    const previousSecond = lastSecond;
    lastSecond = app.game.timer.remaining;
    if (crossedCountdownWarning(previousSecond, app.game.timer.remaining)) void playTimerSound('warning');
    if (app.game.timer.remaining === 0) {
      stopTimer();
      announceTimerEnd();
    }
    if (app.game.timer.remaining % 5 === 0) await saveGame();
    render();
  }, 250);
}

function buildSpeakerOrder() {
  const alive = aliveSeats().map(seat => seat.number);
  const start = (app.game.day - 1) % 10 + 1;
  return Array.from({ length: 10 }, (_, index) => ((start - 1 + index) % 10) + 1).filter(number => alive.includes(number));
}

function consumeSpeechPenalty(seat) {
  if (!seat) return;
  if (seat.restrictionDay && app.game.day >= seat.restrictionDay) seat.restrictionDay = null;
  if (seat.shortSpeechDay && app.game.day >= seat.shortSpeechDay) seat.shortSpeechDay = null;
}

async function beginDay(increment = false) {
  if (increment) app.game.day += 1;
  app.game.phase = 'day';
  app.game.subphase = 'speeches';
  app.game.speakerIndex = 0;
  app.game.speakerOrder = buildSpeakerOrder();
  app.game.nominations = [];
  app.game.seats.forEach(seat => { seat.nominatedBy = null; });
  app.game.vote = { counts: {}, tied: [], tieKey: '', tieRound: 0, yes: 0, no: 0 };
  setTimer(speechTimerBase(), 'speech');
  addLog(`Починається день ${app.game.day}.`);
  await saveGame();
  render();
}

async function nextSpeaker() {
  pushUndo();
  consumeSpeechPenalty(currentSpeaker());
  if (app.game.speakerIndex < app.game.speakerOrder.length - 1) {
    app.game.speakerIndex += 1;
    setTimer(timerBase(), 'speech');
  } else {
    stopTimer();
    app.game.subphase = 'dayEnd';
    addLog(`Коло промов дня ${app.game.day} завершено.`);
  }
  await saveGame();
  render();
}

async function nominate(number) {
  const target = seatByNo(number);
  const speaker = currentSpeaker();
  if (!target || target.status !== 'alive' || !speaker) return;
  if (target.number === speaker.number) return toast('Себе виставляти не можна');
  if (app.game.nominations.includes(number)) return toast('Гравця вже виставлено');
  if (app.game.seats.some(seat => seat.nominatedBy === speaker.number)) return toast('Поточний гравець уже зробив номінацію');
  pushUndo();
  app.game.nominations.push(number);
  target.nominatedBy = speaker.number;
  addLog(`№${speaker.number} виставляє №${number} на голосування.`);
  app.modal = null;
  vibrate();
  await saveGame();
  render();
}

async function removeNomination(number) {
  pushUndo();
  const seat = seatByNo(number);
  if (seat) seat.nominatedBy = null;
  app.game.nominations = app.game.nominations.filter(value => value !== number);
  addLog(`Кандидатуру №${number} знято ведучим.`);
  await saveGame(); render();
}

async function startVote() {
  pushUndo();
  if (!app.game.nominations.length) return goNight();
  if (app.game.day === 1 && app.game.nominations.length === 1 && app.game.settings.firstDaySingleNoVote) {
    addLog('День 1: одна кандидатура — голосування не проводиться.');
    return goNight();
  }
  if (app.game.nominations.length === 1) {
    addLog(`Єдина кандидатура №${app.game.nominations[0]} отримує голоси столу.`);
    return eliminate(app.game.nominations[0], 'денне голосування', true);
  }
  app.game.phase = 'vote';
  app.game.vote.counts = {};
  stopTimer();
  await saveGame(); render();
}

function adjustVote(number, delta) {
  const candidates = voteCandidates();
  if (!candidates.includes(number)) return;
  const total = candidates.reduce((sum, item) => sum + (app.game.vote.counts[item] || 0), 0);
  if (delta > 0 && total >= voterCount()) return;
  app.game.vote.counts[number] = Math.max(0, (app.game.vote.counts[number] || 0) + delta);
}

function fillRemainder() {
  const candidates = voteCandidates();
  const last = candidates.at(-1);
  const other = candidates.slice(0, -1).reduce((sum, number) => sum + (app.game.vote.counts[number] || 0), 0);
  if (last) app.game.vote.counts[last] = Math.max(0, voterCount() - other);
}

async function finishVote() {
  const candidates = voteCandidates();
  let used = candidates.reduce((sum, number) => sum + (app.game.vote.counts[number] || 0), 0);
  if (app.game.settings.lastGetsRemainder && used < voterCount()) {
    const last = candidates.at(-1);
    app.game.vote.counts[last] = (app.game.vote.counts[last] || 0) + voterCount() - used;
    used = voterCount();
  }
  const resolution = resolveVote({
    candidates,
    counts: app.game.vote.counts,
    voterCount: voterCount(),
    phase: app.game.phase,
    previousTieKey: app.game.vote.tieKey
  });
  if (resolution.kind === 'invalid') return toast(resolution.message);
  pushUndo();
  addLog(`Голосування: ${candidates.map(number => `№${number} — ${app.game.vote.counts[number] || 0}`).join(', ')}.`);
  if (resolution.kind === 'eliminate') return eliminate(resolution.number, 'денне голосування', true);
  if (resolution.kind === 'allTie') {
    if (!canLiftTiedCandidates({ day: app.game.day, aliveCount: aliveSeats().length, tiedCount: resolution.tied.length })) {
      addLog(`Підйом ${resolution.tied.length} кандидатів у цій ігровій ситуації не проводиться.`);
      return goNight();
    }
    app.game.phase = 'allTie';
    app.game.vote.tied = resolution.tied;
    app.game.vote.yes = 0;
    app.game.vote.no = 0;
    addLog(`Повторна нічия між ${resolution.tied.map(number => `№${number}`).join(', ')}.`);
  } else {
    app.game.vote.tieKey = resolution.tieKey;
    app.game.vote.tied = resolution.tied;
    app.game.vote.counts = {};
    app.game.phase = 'tieSpeech';
    app.game.speakerIndex = 0;
    setTimer(app.game.settings.tieSpeech, 'tie');
    addLog(`Автокатастрофа: ${resolution.tied.map(number => `№${number}`).join(', ')}.`);
  }
  await saveGame(); render();
}

async function nextTieSpeaker() {
  pushUndo();
  if (app.game.speakerIndex < app.game.vote.tied.length - 1) {
    app.game.speakerIndex += 1;
    setTimer(app.game.settings.tieSpeech, 'tie');
  } else {
    app.game.phase = 'tieVote';
    app.game.vote.counts = {};
    stopTimer();
  }
  await saveGame(); render();
}

async function finishAllTie() {
  const used = app.game.vote.yes + app.game.vote.no;
  if (used !== voterCount()) return toast(`Потрібно зафіксувати ${voterCount()} голосів`);
  pushUndo();
  if (app.game.vote.yes > app.game.vote.no) {
    const numbers = [...app.game.vote.tied];
    addLog(`Більшість за вихід усіх: ${numbers.map(number => `№${number}`).join(', ')}.`);
    numbers.forEach(number => eliminateSeatOnly(number, 'автокатастрофа'));
    app.game.pendingWinner = victoryForSeats(app.game.seats);
    app.game.phase = 'lastWord';
    app.game.lastWordSeat = numbers.shift();
    app.game.pendingLastWords = numbers;
    app.game.afterNightKill = false;
    setTimer(app.game.settings.lastWord, 'lastWord');
    await saveGame(); render();
  } else {
    addLog('Більшість не підтримала вихід усіх кандидатів.');
    await goNight();
  }
}

function eliminateSeatOnly(number, reason) {
  const seat = seatByNo(number);
  if (!seat || seat.status !== 'alive') return;
  const currentNumber = currentSpeaker()?.number;
  const removedSpeakerIndex = app.game.phase === 'day' && app.game.subphase === 'speeches'
    ? app.game.speakerOrder.indexOf(number)
    : -1;
  seat.status = 'dead';
  seat.eliminatedReason = reason;
  seat.nominatedBy = null;
  app.game.nominations = app.game.nominations.filter(value => value !== number);
  if (removedSpeakerIndex >= 0) {
    app.game.speakerOrder.splice(removedSpeakerIndex, 1);
    if (removedSpeakerIndex < app.game.speakerIndex) app.game.speakerIndex -= 1;
    if (!app.game.speakerOrder.length) {
      app.game.speakerIndex = 0;
      app.game.subphase = 'dayEnd';
      stopTimer();
    } else if (currentNumber === number) {
      app.game.speakerIndex = Math.min(removedSpeakerIndex, app.game.speakerOrder.length - 1);
      setTimer(timerBase(), 'speech');
    }
  }
  addLog(`№${number} ${seat.name} вибуває (${reason}).`);
}

async function eliminate(number, reason, lastWord = true) {
  eliminateSeatOnly(number, reason);
  const winner = victoryForSeats(app.game.seats);
  if (winner && !lastWord) return finishGame(winner);
  if (lastWord) {
    app.game.pendingWinner = winner;
    app.game.phase = 'lastWord';
    app.game.lastWordSeat = number;
    app.game.pendingLastWords = [];
    app.game.afterNightKill = false;
    setTimer(app.game.settings.lastWord, 'lastWord');
    await saveGame(); render();
  } else await goNight();
}

async function finishLastWord() {
  pushUndo();
  if (app.game.pendingLastWords.length) {
    app.game.lastWordSeat = app.game.pendingLastWords.shift();
    setTimer(app.game.settings.lastWord, 'lastWord');
    await saveGame(); render(); return;
  }
  if (app.game.pendingWinner) {
    const winner = app.game.pendingWinner;
    app.game.pendingWinner = null;
    return finishGame(winner);
  }
  if (app.game.afterNightKill) return beginDay(true);
  return goNight();
}

async function finishBestMove(skip = false) {
  const selected = app.game.bestMove?.selected || [];
  if (!skip && selected.length !== 3) return toast(`Оберіть ще ${3 - selected.length} ${selected.length === 2 ? 'номер' : 'номери'} або натисніть «Без КХ»`);
  pushUndo();
  stopTimer();
  const seatNumber = app.game.bestMove?.seat || app.game.lastWordSeat;
  addLog(skip
    ? `Кращий хід №${seatNumber}: без трійки.`
    : `Кращий хід №${seatNumber}: ${selected.map(number => `№${number}`).join(', ')}.`);
  app.game.phase = 'lastWord';
  app.game.lastWordSeat = seatNumber;
  app.game.pendingLastWords = [];
  app.game.afterNightKill = true;
  setTimer(app.game.settings.lastWord, 'lastWord');
  await saveGame(); render();
}

async function goNight() {
  app.game.phase = 'night';
  app.game.subphase = '';
  app.game.nominations = [];
  app.game.seats.forEach(seat => { seat.nominatedBy = null; });
  app.game.night = { step: 0, target: null, donCheck: null, sheriffCheck: null, resultOpen: false };
  setTimer(app.game.settings.nightCheck, 'night');
  addLog(`Настає ніч ${app.game.day}.`);
  await saveGame(); render();
}

async function finishNightCheck() {
  const isDon = app.game.night.step === 2;
  const number = isDon ? app.game.night.donCheck : app.game.night.sheriffCheck;
  if (!number) return;
  if (!app.game.night.resultOpen) return toast('Спочатку покажіть гравцеві сигнал результату');
  const seat = seatByNo(number);
  if (!seat || seat.status !== 'alive') return toast('Цей гравець уже вибув — оберіть іншу ціль');
  pushUndo();
  const hit = isDon ? seat.role === 'sheriff' : teamOf(seat) === 'black';
  addLog(`${isDon ? 'Дон' : 'Шериф'} перевіряє №${number}: ${isDon ? (hit ? 'Шериф' : 'не Шериф') : (hit ? 'чорний' : 'червоний')}.`, true);
  app.game.night.resultOpen = false;
  app.game.night.step += 1;
  if (app.game.night.step < 4) setTimer(app.game.settings.nightCheck, 'night');
  else stopTimer();
  await saveGame(); render();
}

async function wakeCity() {
  pushUndo();
  const number = app.game.night.target;
  if (number == null || number === -1) return beginDay(true);
  const target = seatByNo(number);
  if (!target || target.status !== 'alive') return toast('Нічна ціль уже вибула — виправте постріл');
  const departedBeforeShot = app.game.seats.filter(seat => seat.status === 'dead').length;
  const firstNightKill = app.game.day === 1 && departedBeforeShot < 2 && !app.game.seats.some(seat => seat.eliminatedReason === 'нічний постріл');
  eliminateSeatOnly(number, 'нічний постріл');
  app.game.pendingWinner = victoryForSeats(app.game.seats);
  if (firstNightKill) {
    app.game.phase = 'bestMove';
    app.game.lastWordSeat = number;
    app.game.bestMove = { seat: number, selected: [] };
    app.game.pendingLastWords = [];
    app.game.afterNightKill = true;
    setTimer(app.game.settings.bestMove, 'bestMove');
    addLog(`Гравець №${number} отримує право на Кращий хід.`);
    await saveGame(); render(); return;
  }
  app.game.phase = 'lastWord';
  app.game.lastWordSeat = number;
  app.game.pendingLastWords = [];
  app.game.afterNightKill = true;
  setTimer(app.game.settings.lastWord, 'lastWord');
  await saveGame(); render();
}

async function checkVictory() {
  const winner = victoryForSeats(app.game.seats);
  if (winner) return finishGame(winner);
  return false;
}

async function finishGame(winner) {
  if (!['red', 'black', 'draw'].includes(winner)) return false;
  stopTimer();
  app.game.phase = 'finished';
  app.game.status = 'finished';
  app.game.winner = winner;
  app.game.pendingWinner = null;
  app.game.endedAt = nowIso();
  app.game.durationSeconds = Math.max(0, Math.round((new Date(app.game.endedAt) - new Date(app.game.startedAt)) / 1000));
  addLog(winner === 'red' ? 'Перемога мирного міста.' : winner === 'black' ? 'Перемога чорної команди.' : 'Гру завершено нічиєю.');
  await saveGame();
  try {
    await publishFinishedGame(app.game);
  } catch (error) {
    app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
  }
  vibrate([80, 40, 80]);
  render();
  return true;
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Оберіть файл зображення');
  if (file.size > 12 * 1024 * 1024) throw new Error('Фото завелике (максимум 12 МБ)');
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  canvas.getContext('2d').drawImage(bitmap, sx, sy, size, size, 0, 0, 384, 384);
  bitmap.close?.();
  const type = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  for (const quality of [.8, .7, .6, .5]) {
    const encoded = canvas.toDataURL(type, quality);
    if (encoded.length <= 350000) return encoded;
  }
  throw new Error('Не вдалося достатньо стиснути фото');
}

async function presetAvatarDataUrl(source) {
  if (!ANIMAL_AVATARS.includes(source)) throw new Error('Невідомий базовий аватар');
  if (presetAvatarDataUrls.has(source)) return presetAvatarDataUrls.get(source);
  const response = await fetch(source);
  if (!response.ok) throw new Error('Не вдалося завантажити базовий аватар');
  const blob = await response.blob();
  const encoded = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Не вдалося прочитати аватар'));
    reader.readAsDataURL(blob);
  });
  if (!/^data:image\/(?:webp|jpeg|png);base64,/i.test(encoded) || encoded.length > 350000) throw new Error('Базовий аватар має некоректний формат');
  presetAvatarDataUrls.set(source, encoded);
  return encoded;
}

async function saveSetupPlayerAvatar(seatNumber, source) {
  const seat = app.draft?.seats.find(item => item.number === Number(seatNumber));
  const current = seat?.profileId ? playerById(seat.profileId) : null;
  if (!seat || !editableManualPlayer(current)) throw new Error('Аватар можна змінювати лише для ручного профілю поза активною грою');
  const avatarDataUrl = await presetAvatarDataUrl(source);
  const locallyStored = app.localPlayers.some(item => item.id === current.id);
  const player = { ...current, avatar: avatarDataUrl, avatarPreset: source, updatedAt: nowIso() };
  if (locallyStored) await putOne('players', player);
  let directorySynced = LOCAL_AUTH_TEST;
  if (!LOCAL_AUTH_TEST && app.authUser) {
    try {
      const shared = await saveSharedManualPlayer(app.authUser, app.hostProfile, player, { force: true });
      player.cloudManualId = shared.id;
      player.cloudOwnerUid = shared.ownerUid;
      player.source = locallyStored ? 'local+shared-manual' : 'shared-manual';
      if (locallyStored) await putOne('players', player);
      directorySynced = true;
    } catch (error) {
      if (!locallyStored) throw error;
    }
  }
  if (locallyStored) {
    const localIndex = app.localPlayers.findIndex(item => item.id === player.id);
    if (localIndex >= 0) app.localPlayers[localIndex] = clone(player);
  }
  const cloudIndex = app.cloudPlayers.findIndex(item => player.cloudManualId && item.cloudManualId === player.cloudManualId);
  if (cloudIndex >= 0) app.cloudPlayers[cloudIndex] = { ...app.cloudPlayers[cloudIndex], avatar: avatarDataUrl, avatarPreset: source, updatedAt: player.updatedAt };
  mergePlayerSources();
  return directorySynced;
}

function captureHostProfileDraft() {
  const form = document.querySelector('[data-form="host-profile"]');
  if (!form || app.modal?.type !== 'host-profile') return;
  const data = new FormData(form);
  app.modal.profileDraft = {
    ...(app.modal.profileDraft || {}),
    displayName: String(data.get('displayName') || ''),
    nickname: String(data.get('nickname') || ''),
    club: String(data.get('club') || ''),
    description: String(data.get('description') || ''),
    discoverable: data.get('discoverable') === 'on'
  };
}

async function savePlayer(form) {
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (!name) return toast('Вкажіть ім’я гравця');
  const email = normalizePlayerEmail(data.get('email'));
  if (email && !isValidPlayerEmail(email)) return toast('Перевірте email гравця');
  const timestamp = nowIso();
  const current = app.modal.player;
  if (current.id && profileIsInActiveGame(current.id)) return toast('Завершіть поточну гру перед редагуванням профілю');
  const sharedProfile = Boolean(current.cloudManualId);
  const locallyStored = app.localPlayers.some(item => item.id === current.id);
  const player = {
    id: current.id || uid('player'),
    name,
    nickname: String(data.get('nickname') || '').trim(),
    email: sharedProfile ? current.email || '' : email,
    contact: String(data.get('contact') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
    avatar: current.avatar || '',
    avatarPreset: current.avatarPreset || '',
    cloudManualId: current.cloudManualId || '',
    cloudOwnerUid: current.cloudOwnerUid || '',
    source: current.source || '',
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!sharedProfile || locallyStored) await putOne('players', player);
  let directorySynced = LOCAL_AUTH_TEST;
  let linkSynced = !email || LOCAL_AUTH_TEST;
  if (!LOCAL_AUTH_TEST && app.authUser) {
    try {
      const shared = await saveSharedManualPlayer(app.authUser, app.hostProfile, player, { force: true });
      if (!sharedProfile || locallyStored) {
        player.cloudManualId = shared.id;
        player.cloudOwnerUid = shared.ownerUid;
        player.source = 'local+shared-manual';
        await putOne('players', player);
      }
      directorySynced = true;
    } catch {
      directorySynced = false;
    }
    try {
      if (!sharedProfile && email) await upsertPlayerLink(app.authUser, app.hostProfile, player);
      else if (!sharedProfile && current.email) await deleteOwnedPlayerLink(app.authUser, player.id);
      linkSynced = true;
    } catch {
      linkSynced = false;
    }
  }
  if (sharedProfile && !directorySynced) {
    render();
    return toast('Не вдалося оновити спільний профіль');
  }
  app.modal = null;
  await refreshData();
  render();
  toast(directorySynced && linkSynced
    ? (email ? 'Профіль у спільному каталозі · очікуємо Google-вхід' : 'Профіль додано до спільного каталогу')
    : 'Профіль збережено на пристрої · синхронізуємо пізніше');
}

async function loadHostProfile() {
  const stored = await getSetting('hostProfile', null);
  const timestamp = nowIso();
  app.hostProfile = {
    uid: app.authUser.uid,
    email: app.authUser.email,
    googleName: app.authUser.googleName,
    googlePhotoURL: app.authUser.googlePhotoURL,
    displayName: stored?.displayName || app.authUser.googleName || app.authUser.email.split('@')[0],
    nickname: stored?.nickname || '',
    club: stored?.club || '',
    description: stored?.description || '',
    avatar: stored?.avatar || '',
    discoverable: stored?.discoverable !== false,
    createdAt: stored?.createdAt || timestamp,
    updatedAt: stored?.updatedAt || timestamp
  };
  app.profilePhotoSync = { status: app.hostProfile.avatar ? 'pending' : 'idle' };
  if (!stored || stored.email !== app.authUser.email || stored.googleName !== app.authUser.googleName || stored.googlePhotoURL !== app.authUser.googlePhotoURL) {
    await setSetting('hostProfile', app.hostProfile);
  }
  return Boolean(stored);
}

function cloudDirectoryError(error) {
  if (error?.code === 'permission-denied') return 'Немає доступу до каталогу. Перевірте Google-вхід.';
  if (!navigator.onLine || error?.code === 'unavailable') return 'Немає мережі: показано збережені локальні профілі.';
  return 'Не вдалося синхронізувати каталог Enjoy.';
}

async function connectCloudDirectory({ hasLocalProfile = true } = {}) {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  if (cloudDirectoryPromise) return cloudDirectoryPromise;
  app.cloudDirectory = { status: 'loading', error: '', fromCache: false };
  if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'syncing' };
  render();
  cloudDirectoryPromise = (async () => {
    const remote = await reconcileOwnCommunityProfile(app.authUser, app.hostProfile, { hasLocalProfile });
    if (remote && (!hasLocalProfile || String(remote.profileUpdatedAt || '') > String(app.hostProfile.updatedAt || ''))) {
      app.hostProfile = {
        ...app.hostProfile,
        displayName: remote.displayName || app.hostProfile.displayName,
        nickname: remote.nickname || '',
        club: remote.club || '',
        description: remote.description || '',
        avatar: remote.photoDataURL || '',
        discoverable: remote.discoverable !== false,
        updatedAt: remote.profileUpdatedAt || app.hostProfile.updatedAt
      };
      await setSetting('hostProfile', app.hostProfile);
    }
    app.profilePhotoSync = {
      status: app.hostProfile?.avatar && remote?.photoDataURL === app.hostProfile.avatar
        ? 'synced'
        : app.hostProfile?.avatar ? 'pending' : 'idle'
    };
    await subscribeCommunityProfiles((members, metadata) => {
      const ownMember = members.find(member => member.uid === app.authUser?.uid);
      if (app.hostProfile?.avatar && ownMember?.photoDataURL === app.hostProfile.avatar) {
        app.profilePhotoSync = { status: 'synced' };
      }
      app.cloudPlayers = members.map(cloudPlayer);
      mergePlayerSources();
      app.cloudDirectory = {
        status: metadata.fromCache && !navigator.onLine ? 'offline' : 'online',
        error: '',
        fromCache: metadata.fromCache
      };
      render();
    }, error => {
      if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'error' };
      app.cloudDirectory = { status: 'error', error: cloudDirectoryError(error), fromCache: false };
      render();
    });
    syncSharedManualPlayers().catch(() => {});
  })();
  try {
    await cloudDirectoryPromise;
  } catch (error) {
    if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'error' };
    app.cloudDirectory = { status: 'error', error: cloudDirectoryError(error), fromCache: false };
    render();
  } finally {
    cloudDirectoryPromise = null;
  }
}

async function syncSharedManualPlayers() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  const profiles = app.localPlayers.filter(isPersistentManualPlayer);
  const linkedProfiles = app.localPlayers.filter(player => player.id && player.linkedCloudUid);
  await Promise.all([
    ...profiles.map(player => saveSharedManualPlayer(app.authUser, app.hostProfile, player)),
    ...linkedProfiles.map(player => deleteSharedManualPlayer(app.authUser, player.id))
  ]);
}

async function syncLocalPlayerLinks() {
  if (!app.authUser || LOCAL_AUTH_TEST || !navigator.onLine) return;
  const candidates = app.localPlayers.filter(player => player.email && !player.linkedCloudUid);
  await Promise.allSettled(candidates.map(player => upsertPlayerLink(app.authUser, app.hostProfile, player)));
}

async function applyAcceptedPlayerLinks(links) {
  const accepted = new Map(links
    .filter(link => link.status === 'accepted' && link.claimedUid)
    .map(link => [link.localPlayerId, link.claimedUid]));
  if (!accepted.size) return false;

  const replacements = new Map();
  const timestamp = nowIso();
  let playersChanged = false;
  for (const local of app.localPlayers) {
    const claimedUid = accepted.get(local.id);
    if (!claimedUid) continue;
    replacements.set(local.id, `google_${claimedUid}`);
    if (local.linkedCloudUid !== claimedUid) {
      playersChanged = true;
      await putOne('players', {
        ...local,
        linkedCloudUid: claimedUid,
        linkStatus: 'accepted',
        linkedAt: timestamp,
        updatedAt: timestamp
      });
      try { await deleteSharedManualPlayer(app.authUser, local.id); } catch { /* Retry is available when the owner reconnects. */ }
    }
  }
  if (!replacements.size) return false;

  let gamesChanged = false;
  for (const game of app.localGames) {
    let changed = false;
    const seats = game.seats.map(seat => {
      const profileId = replacements.get(seat.profileId);
      if (!profileId) return seat;
      changed = true;
      return { ...seat, profileId };
    });
    if (!changed) continue;
    gamesChanged = true;
    await putOne('games', { ...game, seats, updatedAt: timestamp });
  }
  let draftChanged = false;
  if (app.draft) {
    app.draft.seats.forEach(seat => {
      if (replacements.has(seat.profileId)) {
        seat.profileId = replacements.get(seat.profileId);
        draftChanged = true;
      }
    });
  }
  const remappedQueue = remapLineupPlayers(app.nextGameQueue, replacements);
  const queueChanged = remappedQueue.join('\u0000') !== app.nextGameQueue.join('\u0000');
  if (queueChanged) {
    app.nextGameQueue = remappedQueue;
    await saveNextGameQueue();
  }

  if (!playersChanged && !gamesChanged && !draftChanged && !queueChanged) return false;
  await refreshData();
  if (gamesChanged) await syncLocalFinishedGames();
  return true;
}

function showPlayerLinkOffer() {
  if (!app.modal && app.playerLinkOffers.length) app.modal = { type: 'player-link-offer' };
}

async function connectPlayerLinks() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  await syncLocalPlayerLinks();
  await subscribeOwnedPlayerLinks(app.authUser, (links) => {
    app.ownedPlayerLinks = links;
    applyAcceptedPlayerLinks(links).then(changed => {
      if (changed) {
        render();
        toast('Ручний профіль об’єднано з Google-профілем');
      }
    }).catch(() => {});
  }, () => {});
  app.playerLinkOffers = await findPendingPlayerLinks(app.authUser);
  showPlayerLinkOffer();
  render();
}

function cloudArchiveError(error) {
  if (error?.code === 'permission-denied') return 'Немає доступу до спільних ігор. Перевірте Google-вхід.';
  if (!navigator.onLine || error?.code === 'unavailable') return 'Немає мережі: показано збережену офлайн-копію ігор.';
  return 'Не вдалося синхронізувати ігри Enjoy.';
}

async function publishFinishedGame(game) {
  if (!app.authUser || LOCAL_AUTH_TEST || game?.status !== 'finished') return false;
  await flushActiveGamePublish(game.id);
  const saved = await saveFinishedCommunityGame(app.authUser, app.hostProfile, game);
  await deleteActiveCommunityGame(app.authUser, game.id);
  return saved;
}

function syncLocalActiveGames() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  app.localGames
    .filter(game => game.status === 'active' && (!game.ownerUid || game.ownerUid === app.authUser.uid))
    .forEach(queueActiveGamePublish);
}

async function syncLocalFinishedGames(remoteGames = app.cloudGames) {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  const remoteById = new Map(remoteGames.map(game => [game.id, game]));
  const pending = app.localGames.filter(game => {
    if (game.status !== 'finished') return false;
    const remote = remoteById.get(game.id);
    return !remote || remote.cloudOwnerUid === app.authUser.uid && String(remote.updatedAt || '') < String(game.updatedAt || game.endedAt || '');
  });
  for (const game of pending) await publishFinishedGame(game);
  for (const game of app.localGames.filter(game => game.status === 'finished' && (!game.ownerUid || game.ownerUid === app.authUser.uid))) {
    await flushActiveGamePublish(game.id);
    await deleteActiveCommunityGame(app.authUser, game.id);
  }
}

async function connectCloudArchive() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  if (cloudArchivePromise) return cloudArchivePromise;
  app.cloudArchive = { status: 'loading', error: '', fromCache: false };
  render();
  cloudArchiveMigrationStarted = false;
  cloudArchivePromise = subscribeCommunityGames((games, metadata) => {
    app.cloudGames = games;
    mergeGameSources();
    const routed = routeFromHash();
    if (routed.id && ['observer', 'game'].includes(routed.route)) {
      const routedGame = gameById(routed.id);
      if (routedGame) app.game = routedGame;
    }
    app.cloudArchive = {
      status: metadata.fromCache && !navigator.onLine ? 'offline' : 'online',
      error: '',
      fromCache: metadata.fromCache
    };
    render();
    if (!cloudArchiveMigrationStarted) {
      cloudArchiveMigrationStarted = true;
      syncLocalActiveGames();
      syncLocalFinishedGames(games).catch(error => {
        app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: metadata.fromCache };
        render();
      });
    }
  }, error => {
    app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
    render();
  });
  try {
    await cloudArchivePromise;
  } catch (error) {
    app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
    render();
  } finally {
    cloudArchivePromise = null;
  }
}

async function deleteGameEverywhere(game) {
  if (!canManageGame(game)) throw new Error('Цю гру може видалити лише її ведучий');
  const remote = app.cloudGames.find(item => item.id === game.id);
  if (!LOCAL_AUTH_TEST && game.status === 'active') {
    await flushActiveGamePublish(game.id);
    await deleteActiveCommunityGame(app.authUser, game.id);
  }
  if ((remote || game.shared || game.status === 'finished') && game.status === 'finished' && !LOCAL_AUTH_TEST) await deleteFinishedCommunityGame(app.authUser, game.id);
  if (app.localGames.some(item => item.id === game.id)) await deleteOne('games', game.id);
  app.cloudGames = app.cloudGames.filter(item => item.id !== game.id);
  if (app.game?.id === game.id) app.game = null;
  await refreshData();
}

async function rememberFinishedGameDelete(gameId) {
  const pending = [...new Set([...(await getSetting('pendingFinishedGameDeletes', [])), gameId])];
  await setSetting('pendingFinishedGameDeletes', pending);
}

async function flushPendingFinishedGameDeletes() {
  if (!app.authUser || LOCAL_AUTH_TEST || !navigator.onLine) return;
  const pending = await getSetting('pendingFinishedGameDeletes', []);
  const remaining = [];
  for (const gameId of pending) {
    try { await deleteFinishedCommunityGame(app.authUser, gameId); }
    catch { remaining.push(gameId); }
  }
  await setSetting('pendingFinishedGameDeletes', remaining);
}

async function removeFinishedResultForReopen(gameId) {
  app.cloudGames = app.cloudGames.filter(game => !(game.id === gameId && game.status === 'finished'));
  if (LOCAL_AUTH_TEST) return;
  try { await deleteFinishedCommunityGame(app.authUser, gameId); }
  catch { await rememberFinishedGameDelete(gameId); }
}

async function deleteCurrentAppAccount() {
  if (profileIsInActiveGame(`google_${app.authUser?.uid || ''}`)) {
    throw new Error('Завершіть поточну гру перед видаленням профілю');
  }
  if (LOCAL_AUTH_TEST) throw new Error('Видалення тестового акаунта вимкнено');
  if (!navigator.onLine) throw new Error('Для видалення профілю потрібне інтернет-з’єднання');
  if (!app.authUser) throw new Error('Google-сесію вже завершено');
  const user = { ...app.authUser };

  await reauthenticateGoogleAccount();
  await deleteAllOwnedPlayerLinks(user);
  await deleteAllOwnedManualPlayers(user);
  await deleteOwnCommunityProfile(user);
  stopCommunityProfiles();
  stopCommunityGames();
  stopPlayerLinks();
  await deleteGoogleAccount();
  await Promise.allSettled(['players', 'games', 'settings'].map(clearStore));
  clearAuthenticatedState();
  app.authReady = true;
  app.authConfigured = true;
  render();
  toast('Профіль Mafia видалено');
}

async function saveHostProfile(form) {
  if (profileIsInActiveGame(`google_${app.authUser?.uid || ''}`)) {
    return toast('Завершіть поточну гру перед редагуванням профілю');
  }
  const data = new FormData(form);
  const displayName = String(data.get('displayName') || '').trim();
  if (!displayName) return toast('Вкажіть ім’я ведучого');
  app.hostProfile = {
    ...app.hostProfile,
    uid: app.authUser.uid,
    email: app.authUser.email,
    displayName,
    nickname: String(data.get('nickname') || '').trim(),
    club: String(data.get('club') || '').trim(),
    description: String(data.get('description') || '').trim(),
    avatar: app.modal?.profileDraft && Object.hasOwn(app.modal.profileDraft, 'avatar')
      ? app.modal.profileDraft.avatar
      : app.hostProfile.avatar || '',
    discoverable: data.get('discoverable') === 'on',
    updatedAt: nowIso()
  };
  await setSetting('hostProfile', app.hostProfile);
  app.profilePhotoSync = { status: app.hostProfile.avatar ? 'syncing' : 'idle' };
  let cloudSaved = true;
  if (!LOCAL_AUTH_TEST) {
    try {
      await saveOwnCommunityProfile(app.authUser, app.hostProfile);
    } catch (error) {
      cloudSaved = false;
      app.cloudDirectory = { status: 'error', error: cloudDirectoryError(error), fromCache: false };
    }
  }
  app.profilePhotoSync = {
    status: app.hostProfile.avatar ? (cloudSaved ? 'synced' : 'error') : 'idle'
  };
  app.modal = null;
  render();
  toast(cloudSaved ? 'Профіль Enjoy синхронізовано' : 'Збережено локально; хмарна синхронізація не вдалася');
}

function protocolText(game = app.game) {
  if (!game) return '';
  const winner = game.winner === 'red' ? 'Мирне місто' : game.winner === 'black' ? 'Чорна команда' : game.winner === 'draw' ? 'Нічия' : 'не визначено';
  return [
    'MAFIA DESK — ПРОТОКОЛ',
    `Гра: ${game.title}`,
    `Початок: ${formatDate(game.startedAt, true)}`,
    `Переможець: ${winner}`,
    '',
    ...game.seats.map(seat => `№${seat.number} ${seat.name} — ${roleOf(seat)?.label || '—'} — ${seat.status === 'alive' ? 'за столом' : `вибув (${seat.eliminatedReason || '—'})`}`),
    '', 'ПОДІЇ:',
    ...game.history.slice().reverse().map(event => `${event.time} — ${event.text}`)
  ].join('\n');
}

async function copyText(text, success = 'Скопійовано') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(success);
}

const GUARDED_GAME_ACTIONS = new Set([
  'start-game', 'reveal-next', 'zero-night-sheriff', 'zero-night-free-seating', 'zero-to-day',
  'timer-toggle', 'next-speaker', 'back-to-speeches', 'start-vote', 'finish-vote',
  'next-tie-speaker', 'finish-all-tie', 'finish-last-word', 'finish-best-move', 'skip-best-move',
  'night-next', 'night-miss', 'night-shot-done', 'night-check-done', 'night-skip-check', 'wake-city',
  'add-fault', 'remove-fault', 'nominate', 'remove-nomination', 'manual-eliminate', 'restore-seat',
  'undo', 'finish-red', 'finish-black', 'finish-draw'
]);

async function handleAction(action, element, sourceEvent) {
  const number = Number(element.dataset.seat);
  const guardedGameAction = GUARDED_GAME_ACTIONS.has(action);
  if (guardedGameAction && app.gameTransitionBusy) return;
  if (guardedGameAction) {
    app.gameTransitionBusy = true;
    element.disabled = true;
    element.setAttribute('aria-busy', 'true');
  }
  try {
  if (action === 'auth-signin') {
    app.authBusy = true; app.authError = ''; render();
    try {
      const user = await signInWithGoogle();
      if (user) await activateAuthenticatedUser(user);
    } catch (error) {
      app.authBusy = false; app.authError = error.message; render();
    }
  } else if (action === 'auth-signout') {
    await signOutGoogleAccount();
    clearAuthenticatedState();
    render();
  } else if (action === 'delete-account') {
    app.modal = { type: 'delete-account' };
    render();
  } else if (action === 'confirm-delete-account') {
    if (app.accountDeleteBusy) return;
    app.accountDeleteBusy = true;
    render();
    try {
      await deleteCurrentAppAccount();
    } catch (error) {
      app.accountDeleteBusy = false;
      if (app.authUser) app.modal = { type: 'delete-account' };
      render();
      toast(error.message || 'Не вдалося видалити профіль');
    }
  } else if (action === 'retry-auth') {
    location.reload();
  } else if (action === 'edit-host-profile') {
    app.modal = { type: 'host-profile' }; render();
  } else if (action === 'open-order-panel') {
    app.order = { busy: false, status: 'idle', error: '', lastItem: '' };
    app.modal = { type: 'order' };
    render();
  } else if (action === 'place-order') {
    if (app.modal?.type !== 'order' || app.order.busy) return;
    const item = element.dataset.item;
    if (!ORDER_MENU.some(option => option.key === item)) return toast('Невідома позиція меню');
    app.order = { busy: true, status: 'loading', error: '', lastItem: item };
    render();
    try {
      const idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
      const activeGame = app.game?.status === 'active' && canManageGame(app.game)
        ? app.game
        : activeGames().find(game => canManageGame(game));
      await sendTelegramOrder({
        idToken,
        item,
        sender: app.hostProfile?.nickname || app.hostProfile?.displayName || app.authUser?.googleName || 'Гість Enjoy',
        game: activeGame?.title || '',
        testMode: LOCAL_AUTH_TEST
      });
      app.order = { busy: false, status: 'success', error: '', lastItem: item };
      render();
      vibrate([40, 30, 70]);
      toast('Замовлення надіслано');
    } catch (error) {
      app.order = { busy: false, status: 'error', error: error?.message || 'Не вдалося надіслати замовлення', lastItem: item };
      render();
    }
  } else if (action === 'open-media-panel') {
    app.modal = { type: 'media' }; render();
  } else if (action === 'media-play') {
    await playMusic();
  } else if (action === 'media-pause') {
    pauseMusic();
  } else if (action === 'media-clear') {
    clearMusicTrack();
    render();
    toast('Аудіофайл прибрано');
  } else if (action === 'bluetooth-request') {
    await requestBluetoothDevice();
  } else if (action === 'cloud-refresh') {
    stopCommunityProfiles();
    await connectCloudDirectory({ hasLocalProfile: true });
  } else if (action === 'cloud-games-refresh') {
    stopCommunityGames();
    await connectCloudArchive();
  } else if (action === 'host-use-google-photo') {
    captureHostProfileDraft();
    app.modal.profileDraft = { ...(app.modal.profileDraft || {}), avatar: '' };
    render();
  } else if (action === 'migrate-legacy-data') {
    const legacy = await getLegacyDatabase();
    if (legacy) await importDatabase(legacy, { replace: false });
    await setSetting('legacyMigrationCompleted', true);
    app.legacyMigration = null; app.modal = null;
    await loadAppData();
    await Promise.all([syncLocalFinishedGames(), syncSharedManualPlayers(), syncLocalPlayerLinks()]);
    showPlayerLinkOffer(); render(); toast('Попередні дані перенесено й завершені ігри додано до спільного архіву');
  } else if (action === 'skip-legacy-migration') {
    app.modal = null; showPlayerLinkOffer(); render();
  } else if (action === 'accept-player-link') {
    const offer = app.playerLinkOffers[0];
    if (!offer || app.playerLinkBusy) return;
    app.playerLinkBusy = true; render();
    try {
      await acceptPlayerLink(app.authUser, offer.id);
      if (!app.hostProfile.nickname && offer.nickname) {
        app.hostProfile = { ...app.hostProfile, nickname: offer.nickname, updatedAt: nowIso() };
        await setSetting('hostProfile', app.hostProfile);
        try { await saveOwnCommunityProfile(app.authUser, app.hostProfile); } catch { /* The link itself is already confirmed. */ }
      }
      app.playerLinkOffers.shift();
      app.playerLinkBusy = false;
      app.modal = null;
      showPlayerLinkOffer();
      render();
      toast('Профілі об’єднано');
    } catch (error) {
      app.playerLinkBusy = false;
      render();
      toast(error.message || 'Не вдалося об’єднати профілі');
    }
  } else if (action === 'skip-player-link') {
    app.playerLinkOffers = [];
    app.playerLinkBusy = false;
    app.modal = null;
    render();
  } else if (action === 'install') {
    app.installPrompt?.prompt();
    await app.installPrompt?.userChoice;
    app.installPrompt = null; render();
  } else if (action === 'toggle-next-player') {
    const player = playerById(element.dataset.id);
    if (!player) return;
    const wasQueued = app.nextGameQueue.includes(player.id);
    app.nextGameQueue = toggleLineupPlayer(app.nextGameQueue, player.id);
    if (app.draft) fillDraftSeatsFromQueue();
    await saveNextGameQueue();
    render();
    const status = lineupStatus(app.nextGameQueue);
    toast(wasQueued ? `${preferredPlayerName(player)} прибрано` : status.total <= TABLE_SIZE ? `${preferredPlayerName(player)} · місце ${status.total}` : `${preferredPlayerName(player)} · у черзі ${status.waiting}`);
  } else if (action === 'clear-next-game') {
    app.nextGameQueue = [];
    if (app.draft) fillDraftSeatsFromQueue();
    await saveNextGameQueue();
    render(); toast('Склад наступної гри очищено');
  } else if (action === 'prepare-next-game') {
    if (!app.draft) app.draft = createDraft();
    else fillDraftSeatsFromQueue();
    navigate('setup');
  } else if (action === 'new-player') {
    app.modal = { type: 'player', player: { name: '', nickname: '', contact: '', notes: '', avatar: '' } }; render();
  } else if (action === 'edit-player') {
    const selectedPlayer = playerById(element.dataset.id);
    if (!selectedPlayer || selectedPlayer.cloudUid) return;
    if (profileIsInActiveGame(selectedPlayer.id)) return toast('Профіль заблоковано до завершення гри');
    app.modal = { type: 'player', player: clone(selectedPlayer) }; render();
  } else if (action === 'delete-player') {
    const player = app.modal.player;
    if (profileIsInActiveGame(player.id)) return toast('Профіль не можна видалити до завершення гри');
    app.modal = { type: 'confirm', title: 'Видалити профіль?', text: `${player.name} зникне зі спільного каталогу. Історичні ігри залишаться без змін.`, confirmLabel: 'Видалити', confirm: { kind: 'player', id: player.id, cloudManualId: player.cloudManualId || '', locallyStored: app.localPlayers.some(item => item.id === player.id) } }; render();
  } else if (action === 'delete-game') {
    const game = gameById(element.dataset.id);
    if (!canManageGame(game)) return toast('Цю гру може видалити лише її ведучий');
    app.modal = { type: 'confirm', title: 'Видалити гру?', text: `Протокол «${game.title}» і пов’язана статистика будуть видалені безповоротно.`, confirmLabel: 'Видалити', confirm: { kind: 'game', id: game.id } }; render();
  } else if (action === 'confirm-action') {
    const confirm = app.modal.confirm;
    if (confirm.kind === 'player') {
      if (profileIsInActiveGame(confirm.id)) { app.modal = null; render(); return toast('Профіль не можна видалити до завершення гри'); }
      if (!LOCAL_AUTH_TEST && app.authUser) {
        try { if (confirm.locallyStored) await deleteOwnedPlayerLink(app.authUser, confirm.id); } catch { /* Local deletion remains available offline. */ }
        try { await deleteSharedManualPlayer(app.authUser, confirm.id, confirm.cloudManualId); }
        catch (error) { app.modal = null; render(); return toast(error.message || 'Не вдалося видалити спільний профіль'); }
      }
      if (confirm.locallyStored) await deleteOne('players', confirm.id);
      if (confirm.cloudManualId) app.cloudPlayers = app.cloudPlayers.filter(player => player.cloudManualId !== confirm.cloudManualId);
      if (app.nextGameQueue.includes(confirm.id)) {
        app.nextGameQueue = app.nextGameQueue.filter(id => id !== confirm.id);
        await saveNextGameQueue();
      }
    }
    if (confirm.kind === 'game') {
      try { await deleteGameEverywhere(gameById(confirm.id)); }
      catch (error) { app.modal = null; render(); return toast(error.message || 'Не вдалося видалити гру'); }
    }
    if (confirm.kind === 'finish') { app.modal = { type: 'winner' }; render(); return; }
    app.modal = null; await refreshData(); render(); toast('Видалено');
  } else if (action === 'close-modal') {
    if (element.classList.contains('modal-backdrop') && element !== sourceEvent?.target) return;
    app.modal = null; render();
  } else if (action === 'game-settings') {
    app.modal = { type: 'game-settings' }; render();
  } else if (action === 'toggle-panel') {
    const panel = element.dataset.panel;
    if (Object.hasOwn(app.panelExpanded, panel)) {
      app.panelExpanded[panel] = !app.panelExpanded[panel];
      render();
      requestAnimationFrame(() => document.querySelector(`[data-action="toggle-panel"][data-panel="${panel}"]`)?.focus());
    }
  } else if (action === 'move-setup-seat') {
    if (!app.draft?.seats.some(seat => seat.number === number)) return;
    app.modal = { type: 'setup-move', seat: number };
    render();
  } else if (action === 'open-setup-avatar') {
    const seat = app.draft?.seats.find(item => item.number === number);
    const player = seat?.profileId ? playerById(seat.profileId) : null;
    if (!editableManualPlayer(player)) return toast('Базовий аватар можна змінити лише для ручного профілю');
    app.modal = { type: 'setup-avatar', seat: number, busy: false };
    render();
  } else if (action === 'choose-setup-avatar') {
    if (app.modal?.type !== 'setup-avatar' || app.modal.busy) return;
    app.modal.busy = true;
    render();
    try {
      const synced = await saveSetupPlayerAvatar(number, element.dataset.avatar);
      app.modal = null;
      render();
      toast(synced ? 'Аватар профілю оновлено' : 'Аватар збережено на пристрої · синхронізуємо пізніше');
    } catch (error) {
      if (app.modal?.type === 'setup-avatar') app.modal.busy = false;
      render();
      toast(error?.message || 'Не вдалося змінити аватар');
    }
  } else if (action === 'move-setup-to') {
    const source = app.draft?.seats.find(seat => seat.number === Number(element.dataset.from));
    const target = app.draft?.seats.find(seat => seat.number === Number(element.dataset.to));
    if (!source || !target || source === target) return;
    const movedName = draftSeatLabel(source);
    const sourceAssignment = { profileId: source.profileId, name: source.name, autoGuestName: source.autoGuestName };
    source.profileId = target.profileId;
    source.name = target.name;
    source.autoGuestName = target.autoGuestName;
    target.profileId = sourceAssignment.profileId;
    target.name = sourceAssignment.name;
    target.autoGuestName = sourceAssignment.autoGuestName;
    app.modal = null;
    render(); toast(`${movedName} → місце ${target.number}`);
  } else if (action === 'shuffle-seats') {
    const shuffledSeats = shuffled(app.draft.seats.map(seat => ({ profileId: seat.profileId, name: seat.name, autoGuestName: seat.autoGuestName })));
    app.draft.seats.forEach((seat, index) => Object.assign(seat, shuffledSeats[index])); render();
  } else if (action === 'random-table') {
    if (app.players.length < 10) return toast('Для випадкового столу потрібно щонайменше 10 профілів');
    const selectedPlayers = shuffled(app.players).slice(0, 10);
    app.draft.seats.forEach((seat, index) => Object.assign(seat, { profileId: selectedPlayers[index].id, name: preferredPlayerName(selectedPlayers[index]), autoGuestName: false }));
    render(); toast('Обрано інших випадкових 10 гравців');
  } else if (action === 'start-game') {
    const existingActiveGame = activeGames().find(game => !game.publicOnly && canManageGame(game));
    if (existingActiveGame) return toast(`Спочатку завершіть активну гру «${existingActiveGame.title}»`);
    prepareTimerAudio();
    const selected = app.draft.seats.map(seat => seat.profileId).filter(Boolean);
    if (new Set(selected).size !== selected.length) return toast('Один профіль не можна посадити двічі');
    const devicePreferences = { theme: app.settings.theme, sound: app.settings.sound, haptics: app.settings.haptics };
    app.game = createGameFromDraft(); app.settings = { ...app.game.settings, ...devicePreferences }; app.undo = [];
    await setSetting('appSettings', app.settings); await saveGame();
    app.nextGameQueue = consumeSeatedPlayers(app.nextGameQueue, app.game.seats);
    await saveNextGameQueue();
    app.draft = null;
    navigate('reveal');
  } else if (action === 'resume-game') {
    const game = gameById(element.dataset.id);
    if (!game || game.publicOnly || !canManageGame(game)) return toast('Цю гру може продовжити лише її ведучий на пристрої, де її створено');
    app.game = normalizeGameState(game, DEFAULT_SETTINGS, { closeReveal: true }); app.undo = []; navigate(app.game.phase === 'reveal' ? 'reveal' : 'game');
  } else if (action === 'watch-game') {
    const game = gameById(element.dataset.id);
    if (!game || game.status !== 'active') return toast('Ця гра вже завершена або недоступна');
    app.game = game; app.undo = []; navigate(`observer/${game.id}`);
  } else if (action === 'reveal-role') {
    app.game.revealOpen = true; render();
  } else if (action === 'reveal-next') {
    app.game.revealOpen = false;
    if (app.game.revealIndex < app.game.seats.length - 1) app.game.revealIndex += 1;
    else {
      app.game.phase = 'zeroNight';
      app.game.zeroNight = { step: 0 };
      setTimer(app.game.settings.mafiaMeet, 'mafiaMeet');
      addLog('Нульова ніч: чорна команда знайомиться, Дон задає порядок відстрілу.');
    }
    await saveGame();
    if (app.game.phase === 'zeroNight') navigate('game'); else render();
  } else if (action === 'zero-night-sheriff') {
    if (app.game.phase !== 'zeroNight' || app.game.zeroNight?.step !== 0) return;
    pushUndo();
    app.game.zeroNight.step = 1;
    setTimer(app.game.settings.sheriffMark, 'sheriffMark');
    addLog('Нульова ніч: Мафія засинає, Шериф позначає себе ведучому.', true);
    await saveGame(); render();
  } else if (action === 'zero-night-free-seating') {
    if (app.game.phase !== 'zeroNight' || app.game.zeroNight?.step !== 1) return;
    pushUndo();
    app.game.zeroNight.step = 2;
    setTimer(app.game.settings.freeSeating, 'freeSeating');
    addLog('Нульова ніч: починається фаза вільної посадки.');
    await saveGame(); render();
  } else if (action === 'zero-to-day') {
    if (app.game.phase !== 'zeroNight' || app.game.zeroNight?.step !== 2) return toast('Спочатку завершіть усі кроки нульової ночі');
    pushUndo(); await beginDay(false);
  } else if (action === 'timer-toggle') {
    app.game.timer.running ? stopTimer() : startTimer(); await saveGame(); render();
  } else if (action === 'timer-minus' || action === 'timer-plus') {
    const adjustment = adjustTimerBy(app.game.timer, action === 'timer-plus' ? 5 : -5);
    app.game.timer = adjustment.timer;
    if (adjustment.completed) { stopTimer(); announceTimerEnd(); }
    await saveGame(); render();
  } else if (action === 'timer-reset') {
    setTimer(timerBase(), app.game.timer.purpose); await saveGame(); render();
  } else if (action === 'next-speaker') await nextSpeaker();
  else if (action === 'back-to-speeches') { app.game.subphase = 'speeches'; app.game.speakerIndex = Math.max(0, app.game.speakerOrder.length - 1); setTimer(timerBase(), 'speech'); await saveGame(); render(); }
  else if (action === 'seat-menu') { app.modal = { type: 'seat', seat: number }; render(); }
  else if (action === 'add-fault') {
    const seat = seatByNo(number); pushUndo(); seat.faults = Math.min(4, seat.faults + 1); addLog(`№${number} отримує ${seat.faults}-й фол.`);
    const speaking = app.game.phase === 'day' && app.game.subphase === 'speeches' && currentSpeaker()?.number === number;
    if (app.game.settings.penaltyMode === 'club' && seat.faults === 2) seat.shortSpeechDay = app.game.day + (speaking ? 1 : 0);
    if (app.game.settings.penaltyMode === 'club' && seat.faults === 3) seat.noVote = true;
    if (app.game.settings.penaltyMode === 'tournament' && seat.faults === 3) seat.restrictionDay = app.game.day + (speaking ? 1 : 0);
    if (seat.faults === 4) { eliminateSeatOnly(number, '4-й фол'); app.modal = null; await checkVictory(); }
    await saveGame(); vibrate(); render();
  } else if (action === 'remove-fault') {
    const seat = seatByNo(number); pushUndo(); seat.faults = Math.max(0, seat.faults - 1); if (seat.faults < 3) { seat.noVote = false; seat.restrictionDay = null; } if (seat.faults < 2) seat.shortSpeechDay = null; addLog(`Фол №${number} скориговано: ${seat.faults}.`); await saveGame(); render();
  } else if (action === 'nominate') await nominate(number);
  else if (action === 'remove-nomination') await removeNomination(number);
  else if (action === 'manual-eliminate') { pushUndo(); app.modal = null; await eliminate(number, 'рішення ведучого', false); }
  else if (action === 'restore-seat') { const seat = seatByNo(app.modal.seat); pushUndo(); seat.status = 'alive'; seat.eliminatedReason = ''; addLog(`№${seat.number} повернуто за стіл ведучим.`); app.modal = null; await saveGame(); render(); }
  else if (action === 'start-vote') await startVote();
  else if (action === 'vote-plus' || action === 'vote-minus') { adjustVote(number, action === 'vote-plus' ? 1 : -1); await saveGame(); render(); }
  else if (action === 'fill-remainder') { fillRemainder(); await saveGame(); render(); }
  else if (action === 'cancel-vote') { app.game.phase = 'day'; app.game.subphase = 'dayEnd'; app.game.vote.counts = {}; await saveGame(); render(); }
  else if (action === 'finish-vote') await finishVote();
  else if (action === 'next-tie-speaker') await nextTieSpeaker();
  else if (action === 'all-plus' || action === 'all-minus') { const kind = element.dataset.kind; const delta = action === 'all-plus' ? 1 : -1; const used = app.game.vote.yes + app.game.vote.no; if (!(delta > 0 && used >= voterCount())) app.game.vote[kind] = Math.max(0, app.game.vote[kind] + delta); await saveGame(); render(); }
  else if (action === 'finish-all-tie') await finishAllTie();
  else if (action === 'finish-last-word') await finishLastWord();
  else if (action === 'best-move-target') {
    const allowed = aliveSeats().map(seat => seat.number);
    app.game.bestMove.selected = toggleBestMoveCandidate(app.game.bestMove?.selected, number, allowed);
    render();
  }
  else if (action === 'finish-best-move') await finishBestMove(false);
  else if (action === 'skip-best-move') await finishBestMove(true);
  else if (action === 'night-next') {
    if (app.game.phase !== 'night' || app.game.night.step !== 0) return;
    pushUndo(); app.game.night.step = 1; setTimer(app.game.settings.nightCheck, 'night'); await saveGame(); render();
  }
  else if (action === 'night-target') {
    if (!nightTargetIsAllowed(app.game, number)) return toast('Можна обрати лише живого гравця');
    if (app.game.night.step === 1) app.game.night.target = number;
    if (app.game.night.step === 2) app.game.night.donCheck = number;
    if (app.game.night.step === 3) app.game.night.sheriffCheck = number;
    app.game.night.resultOpen = false; await saveGame(); render();
  }
  else if (action === 'night-miss') {
    if (app.game.night.step !== 1) return;
    pushUndo(); app.game.night.target = -1; app.game.night.step = 2; setTimer(app.game.settings.nightCheck, 'night'); addLog(`Ніч ${app.game.day}: мафія промахнулася.`); await saveGame(); render();
  }
  else if (action === 'night-shot-done') {
    if (!nightTargetIsAllowed(app.game, app.game.night.target)) return toast('Оберіть живу ціль пострілу');
    pushUndo(); addLog(`Ніч ${app.game.day}: постріл у №${app.game.night.target}.`, true); app.game.night.step = 2; setTimer(app.game.settings.nightCheck, 'night'); await saveGame(); render();
  }
  else if (action === 'night-show-result') {
    const target = app.game.night.step === 2 ? app.game.night.donCheck : app.game.night.sheriffCheck;
    if (!nightTargetIsAllowed(app.game, target)) return toast('Оберіть живого гравця для перевірки');
    stopTimer(); app.game.night.resultOpen = true; render();
  }
  else if (action === 'night-hide-result') { app.game.night.resultOpen = false; setTimer(app.game.settings.nightCheck, 'night'); render(); }
  else if (action === 'night-check-done') await finishNightCheck();
  else if (action === 'night-skip-check') {
    pushUndo(); app.game.night.step += 1; app.game.night.resultOpen = false;
    if (app.game.night.step < 4) setTimer(app.game.settings.nightCheck, 'night'); else stopTimer();
    await saveGame(); render();
  }
  else if (action === 'wake-city') await wakeCity();
  else if (action === 'toggle-secret') { app.game.showSecrets = !app.game.showSecrets; await saveGame({ broadcast: false }); render(); }
  else if (action === 'undo') {
    if (!app.undo.length) return toast('Немає дії для скасування');
    const finishedGameId = app.game?.status === 'finished' ? app.game.id : '';
    stopTimer();
    app.game = normalizeGameState(app.undo.pop(), DEFAULT_SETTINGS, { closeReveal: true });
    if (finishedGameId) await removeFinishedResultForReopen(finishedGameId);
    await saveGame(); render(); toast(finishedGameId ? 'Результат скасовано · гру відновлено' : 'Останню дію скасовано');
  } else if (action === 'copy-protocol') await copyText(protocolText(element.dataset.id ? gameById(element.dataset.id) : app.game), 'Протокол скопійовано');
  else if (action === 'view-protocol') { app.modal = { type: 'protocol', gameId: element.dataset.id }; render(); }
  else if (action === 'open-observer') window.open(`${location.pathname}${location.search}#observer/${app.game?.id || ''}`, '_blank', 'noopener');
  else if (action === 'end-game-manual') { app.modal = { type: 'confirm', title: 'Завершити гру?', text: 'Оберіть переможця після підтвердження: поточна версія зафіксує результат за співвідношенням живих команд.', confirmLabel: 'Завершити', confirm: { kind: 'finish' } }; render(); }
  else if (action === 'finish-red' || action === 'finish-black' || action === 'finish-draw') {
    pushUndo();
    app.modal = null;
    await finishGame(action === 'finish-red' ? 'red' : action === 'finish-black' ? 'black' : 'draw');
  }
  else if (action === 'rematch') {
    const previous = app.game; app.draft = createDraft(); app.draft.title = `${previous.title} · реванш`; app.draft.venue = previous.venue; app.draft.seats = previous.seats.map(seat => ({ number: seat.number, profileId: seat.profileId || '', name: seat.name, autoGuestName: false })); navigate('setup');
  } else if (action === 'setting-sound' || action === 'setting-haptics') {
    const key = action === 'setting-sound' ? 'sound' : 'haptics'; app.settings[key] = !app.settings[key]; await setSetting('appSettings', app.settings); render();
  } else if (action === 'set-theme') {
    app.settings.theme = applyTheme(element.dataset.themeChoice);
    await setSetting('appSettings', app.settings);
    render();
    toast(`Тема «${app.settings.theme === 'dark' ? 'Темна' : app.settings.theme === 'light' ? 'Світла' : 'Кав’ярня'}» увімкнена`);
  } else if (action === 'set-language') {
    const language = normalizeLanguage(element.dataset.language);
    captureHostProfileDraft();
    app.settings.language = applyLanguage(language);
    await setSetting('appSettings', app.settings);
    render();
  } else if (action === 'drive-connect') {
    try {
      const token = await authorizeGoogleDrive();
      setDriveAccessToken(token); render(); toast('Резервну копію Google Drive підключено');
    } catch (error) { toast(error.message); }
  } else if (action === 'drive-disconnect') { clearDriveAccess(); render(); toast('Google Drive відключено'); }
  else if (action === 'cloud-push') { try { toast('Створюю резервну копію…'); await pushToDrive(); app.cloudSync = await getSetting('lastCloudSync'); render(); toast('Збережено у Google Drive'); } catch (error) { toast(error.message); } }
  else if (action === 'cloud-pull') { try { toast('Відновлюю дані…'); await pullFromDrive(); await loadAppData(); await syncLocalFinishedGames(); render(); toast('Дані відновлено й архів синхронізовано'); } catch (error) { toast(error.message); } }
  } finally {
    if (guardedGameAction) {
      app.gameTransitionBusy = false;
      requestGameWakeLock();
      if (element.isConnected) {
        element.disabled = false;
        element.removeAttribute('aria-busy');
      }
    }
  }
}

async function handleInput(element) {
  if (element.dataset.input === 'player-search') {
    app.search = element.value;
    render();
    const search = $('[data-input="player-search"]');
    search?.focus();
    search?.setSelectionRange(app.search.length, app.search.length);
  } else if (element.dataset.draft) {
    app.draft[element.dataset.draft] = element.value;
  } else if (element.dataset.draftSetting) {
    const key = element.dataset.draftSetting;
    app.draft.settings[key] = key === 'penaltyMode' ? element.value : Math.max(5, Math.min(180, Number(element.value) || DEFAULT_SETTINGS[key]));
  } else if (element.dataset.seatName) {
    const seat = app.draft.seats.find(item => item.number === Number(element.dataset.seatName));
    if (seat) {
      seat.name = element.value;
      seat.autoGuestName = false;
    }
  }
}

async function handleChange(element) {
  if (element.dataset.seatProfile) {
    const seat = app.draft.seats.find(item => item.number === Number(element.dataset.seatProfile));
    if (!seat) return;
    const alreadySeated = element.value && app.draft.seats.some(item => item.number !== seat.number && item.profileId === element.value);
    if (alreadySeated) {
      render();
      toast('Цей гравець уже має місце за столом');
      return;
    }
    seat.profileId = element.value;
    const profile = playerById(element.value);
    if (profile) {
      seat.name = preferredPlayerName(profile);
      seat.autoGuestName = false;
    } else {
      seat.name = freshGuestName(seat.number);
      seat.autoGuestName = true;
    }
    render();
  } else if (['avatar-camera', 'avatar-gallery'].includes(element.dataset.input) && element.files?.[0]) {
    try {
      toast(element.dataset.input === 'avatar-camera' ? 'Обробляю знімок…' : 'Обробляю фото…');
      app.modal.player.avatar = await compressImage(element.files[0]);
      app.modal.player.avatarPreset = '';
      render();
      toast('Фото готове');
    } catch (error) { toast(error.message); }
  } else if (['host-avatar-camera', 'host-avatar-gallery'].includes(element.dataset.input) && element.files?.[0]) {
    try {
      toast(element.dataset.input === 'host-avatar-camera' ? 'Обробляю знімок…' : 'Обробляю фото…');
      captureHostProfileDraft();
      app.modal.profileDraft = {
        ...(app.modal.profileDraft || {}),
        avatar: await compressImage(element.files[0])
      };
      render();
      toast('Фото готове · збережіть профіль');
    } catch (error) { toast(error.message); }
  } else if (element.dataset.input === 'music-file' && element.files?.[0]) {
    selectMusicFile(element.files[0]);
  }
}

async function checkLegacyMigration() {
  if (await getSetting('legacyMigrationCompleted', false)) return;
  const legacy = await getLegacyDatabase();
  if (!legacy || (!legacy.players.length && !legacy.games.length)) {
    await setSetting('legacyMigrationCompleted', true);
    return;
  }
  app.legacyMigration = { players: legacy.players.length, games: legacy.games.length };
  app.modal = { type: 'legacy-migration' };
}

async function activateAuthenticatedUser(user) {
  if (!user) return;
  if (activationUid === user.uid && activationPromise) return activationPromise;
  activationUid = user.uid;
  activationPromise = (async () => {
    app.authUser = user;
    app.authError = '';
    app.authBusy = false;
    useDatabaseForUser(user.uid);
    await openDatabase();
    const hasLocalProfile = await loadAppData();
    await checkLegacyMigration();
    render();
    await Promise.all([
      connectCloudDirectory({ hasLocalProfile }),
      connectCloudArchive(),
      connectPlayerLinks()
    ]);
    await flushPendingFinishedGameDeletes();
  })();
  try { await activationPromise; }
  catch (error) {
    activationPromise = null;
    activationUid = null;
    throw error;
  }
}

function clearAuthenticatedState() {
  stopTimer();
  clearInterval(app.observerTimerHandle);
  app.observerTimerHandle = null;
  clearMusicTrack();
  clearDriveAccess();
  stopCommunityProfiles();
  stopCommunityGames();
  stopPlayerLinks();
  cloudDirectoryPromise = null;
  cloudArchivePromise = null;
  cloudArchiveMigrationStarted = false;
  pendingActiveGames.clear();
  activationPromise = null;
  activationUid = null;
  app.authUser = null;
  app.hostProfile = null;
  app.profilePhotoSync = { status: 'idle' };
  app.localPlayers = [];
  app.cloudPlayers = [];
  app.players = [];
  app.localGames = [];
  app.cloudGames = [];
  app.ownedPlayerLinks = [];
  app.playerLinkOffers = [];
  app.playerLinkBusy = false;
  app.accountDeleteBusy = false;
  app.games = [];
  app.nextGameQueue = [];
  app.game = null;
  app.draft = null;
  app.modal = null;
  app.legacyMigration = null;
  app.authBusy = false;
  app.cloudDirectory = { status: 'idle', error: '', fromCache: false };
  app.cloudArchive = { status: 'idle', error: '', fromCache: false };
}

async function loadAppData() {
  const hasLocalProfile = Boolean(await getSetting('hostProfile', null));
  app.players = [];
  app.localPlayers = [];
  app.localGames = [];
  app.games = [];
  app.game = null;
  app.draft = null;
  app.settings = { ...DEFAULT_SETTINGS, ...(await getSetting('appSettings', {})) };
  app.settings.theme = applyTheme(app.settings.theme);
  app.settings.language = applyLanguage(app.settings.language);
  app.nextGameQueue = normalizeLineup(await getSetting('nextGameQueue', []));
  app.cloudSync = await getSetting('lastCloudSync', '');
  await loadHostProfile();
  await refreshData();
  const route = routeFromHash();
  app.route = route.route;
  if (route.id) app.game = await getOne('games', route.id) || app.game;
  if (!app.game) app.game = activeGames()[0] || null;
  if (app.game) app.game = normalizeGameState(app.game, DEFAULT_SETTINGS, { closeReveal: true });
  return hasLocalProfile;
}

async function onRouteChange() {
  if (app.route === 'reveal' && app.game?.revealOpen) app.game.revealOpen = false;
  const moderatorTimerWasRunning = Boolean(app.route !== 'observer' && app.game?.timer?.running && !app.game.publicOnly && canManageGame(app.game));
  if (moderatorTimerWasRunning) {
    stopTimer();
    if (app.game?.status === 'active') await saveGame({ broadcast: false });
  } else {
    clearInterval(app.observerTimerHandle);
    app.observerTimerHandle = null;
  }
  const route = routeFromHash();
  app.route = route.route;
  if (!app.authUser) { render(); return; }
  if (route.id) app.game = await getOne('games', route.id) || gameById(route.id) || (app.game?.id === route.id ? app.game : null);
  if (app.route === 'game' && !app.game) app.game = activeGames()[0] || null;
  app.modal = null;
  closeOverlays();
  render();
  if (['game', 'reveal'].includes(app.route)) requestGameWakeLock();
  else if (app.wakeLock) { app.wakeLock.release?.().catch(() => {}); app.wakeLock = null; }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.addEventListener('click', async event => {
  const tooltip = event.target.closest('[data-tooltip]');
  if (tooltip) { event.preventDefault(); showTooltip(tooltip); return; }
  if (app.tooltip) closeOverlays();
  const nav = event.target.closest('[data-nav]');
  if (nav) { event.preventDefault(); navigate(nav.dataset.nav); return; }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.classList.contains('modal-backdrop') && target !== event.target) return;
  event.preventDefault();
  try {
    await handleAction(target.dataset.action, target, event);
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не вдалося виконати дію. Стан гри не змінено.');
  }
});

document.addEventListener('input', event => handleInput(event.target));
document.addEventListener('change', event => handleChange(event.target));
document.addEventListener('submit', async event => {
  if (event.target.dataset.form === 'player') {
    event.preventDefault();
    await savePlayer(event.target);
  } else if (event.target.dataset.form === 'host-profile') {
    event.preventDefault();
    await saveHostProfile(event.target);
  } else if (event.target.dataset.form === 'game-settings') {
    event.preventDefault();
    const data = new FormData(event.target);
    for (const key of ['speech', 'tieSpeech', 'lastWord', 'nightCheck', 'mafiaMeet', 'sheriffMark', 'freeSeating', 'bestMove']) {
      app.game.settings[key] = Math.max(5, Math.min(180, Number(data.get(key)) || DEFAULT_SETTINGS[key]));
    }
    app.game.settings.penaltyMode = data.get('penaltyMode') === 'club' ? 'club' : 'tournament';
    app.modal = null;
    addLog('Ведучий оновив налаштування таймерів і фолів.');
    await saveGame();
    render();
    toast('Налаштування гри оновлено');
  }
});
document.addEventListener('keydown', async event => {
  if (event.key === 'Escape' && (app.modal || app.tooltip) && !app.accountDeleteBusy) { app.modal = null; closeOverlays(); render(); }
  if (app.route === 'game' && !app.modal && event.code === 'Space' && ['day', 'tieSpeech', 'lastWord'].includes(app.game?.phase)) {
    event.preventDefault();
    app.game.timer.running ? stopTimer() : startTimer();
    await saveGame(); render();
  }
});
window.addEventListener('hashchange', onRouteChange);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); app.installPrompt = event; render(); });
window.addEventListener('online', () => {
  toast('Інтернет-з’єднання відновлено');
  if (app.authUser && app.cloudDirectory.status === 'error') connectCloudDirectory({ hasLocalProfile: true });
  if (app.authUser && ['error', 'offline'].includes(app.cloudArchive.status)) connectCloudArchive();
  if (app.authUser) syncSharedManualPlayers().catch(() => {});
  if (app.authUser) connectPlayerLinks().catch(() => {});
  if (app.authUser) flushPendingFinishedGameDeletes().catch(() => {});
});
window.addEventListener('offline', () => toast('Офлайн-режим: локальна гра продовжується'));
window.addEventListener('pagehide', () => {
  if (app.game?.phase === 'reveal') app.game.revealOpen = false;
  if (app.route === 'game' && app.game?.timer.running) { stopTimer(); saveGame().catch(() => {}); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.game?.phase === 'reveal' && app.game.revealOpen) {
    app.game.revealOpen = false;
    saveGame({ broadcast: false }).catch(() => {});
  }
  if (!document.hidden) requestGameWakeLock();
});

channel?.addEventListener('message', event => {
  if (event.data?.type !== 'game' || app.route !== 'observer') return;
  const routedId = routeFromHash().id;
  if (routedId && event.data.game?.id !== routedId) return;
  app.game = event.data.game;
  render();
});

async function init() {
  render();
  configureMediaSession();
  void refreshBluetoothState();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  try {
    if (LOCAL_AUTH_TEST) {
      app.authConfigured = true;
      app.authReady = true;
      await activateAuthenticatedUser({
        uid: 'local-smoke-test',
        email: 'test.host@example.com',
        emailVerified: true,
        googleName: 'Тестовий ведучий',
        googlePhotoURL: '',
        providerId: 'google.com'
      });
      return;
    }
    app.authConfigured = isGoogleAuthConfigured();
    const authState = await initializeGoogleAuth();
    app.authConfigured = authState.configured;
    app.authReady = true;
    if (authState.user) await activateAuthenticatedUser(authState.user);
    else render();
    await observeGoogleAuth(async user => {
      try {
        if (user) await activateAuthenticatedUser(user);
        else { clearAuthenticatedState(); render(); }
      } catch (error) {
        app.authError = error.message;
        clearAuthenticatedState();
        render();
      }
    });
  } catch (error) {
    app.authReady = true;
    app.authConfigured = isGoogleAuthConfigured();
    app.authError = error.message;
    render();
  }
}

init();
