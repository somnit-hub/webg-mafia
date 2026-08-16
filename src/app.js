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
  profileWasRecentlyActive, saveSharedManualPlayer, subscribeCommunityProfiles,
  stopCommunityProfiles, touchOwnCommunityProfilePresence
} from './cloud-profiles.js';
import {
  acceptPlayerLink, deleteOwnedPlayerLink, deleteAllOwnedPlayerLinks, findPendingPlayerLinks,
  isValidPlayerEmail, normalizePlayerEmail, subscribeOwnedPlayerLinks,
  stopPlayerLinks, upsertPlayerLink
} from './player-links.js';
import {
  saveActiveCommunityGame, deleteActiveCommunityGame, saveActiveGameBackup, loadActiveGameBackup, deleteActiveGameBackup,
  saveFinishedCommunityGame, deleteFinishedCommunityGame,
  requestGameHostTransfer, acceptGameHostTransfer, resolveGameHostTransfer,
  subscribeCommunityGames, stopCommunityGames, subscribeGameHostTransfers, stopGameHostTransfers
} from './cloud-games.js?v=158';
import { adjustTimerBy, crossedCountdownWarning, timerRemainingAt } from './timer.js';
import {
  canLiftTiedCandidates, createNumberRoleDeal, gameStateErrors, nightTargetIsAllowed, nominationIsAllowed, normalizeGameState, resolveVote,
  secureShuffle, selectNumberRoleCard, takeNumberRoleCard, toggleBestMoveCandidate, victoryForSeats
} from './game-engine.js';
import {
  TABLE_SIZE, consumeSeatedPlayers, lineupStatus, normalizeLineup,
  remapLineupPlayers, toggleLineupPlayer
} from './lineup.js';
import { pickFunnyGuestNames } from './guest-names.js';
import { LANGUAGES, applyLanguage, languageLocale, localizeDom, normalizeLanguage } from './i18n.js';
import { DEFAULT_ORDER_MENU, loadOrderMenu, sendTelegramOrder } from './order-service.js';
import { pwaInstallMode } from './pwa.js';
import { selectHostTransferCandidates, sortDirectoryPlayers } from './player-directory.js';
import {
  GAME_EMOTIONS, loadGameFeedbackBatch, loadGameFeedbackSummaryBatch, personalPlayerStats, saveGameFeedback
} from './game-feedback.js';
import { mafiaPlayerRankings } from './player-ranking.js';
import { buildGameStatistics, filterGamesByPeriod, gameActivityComparison } from './game-statistics.js';
import {
  createCommunityVenueFields, saveCommunityVenue, subscribeCommunityVenues, stopCommunityVenues
} from './cloud-venues.js';
import { filterVenues, gameTitleForVenue, googleMapsVenueSuggestion } from './venue-directory.js';
import {
  BUILTIN_GAME_TRACKS, DEFAULT_GAME_MUSIC, GAME_MUSIC_CUES, GAME_MUSIC_DEFAULTS_VERSION, builtinGameTrack,
  customMusicChoice, migrateGameMusicSettings, musicCueForGame, normalizeGameMusicSettings
} from './game-music.js';
import {
  GAME_CHAT_EMOTIONS, authorizedGameParticipantUids, canJoinActiveGameChat, createGameChatDocument, deleteGameChat, ensureGameChat,
  insertGameChatEmotion,
  joinGameChat, sendGameChatMessage, stopGameChatMessages, stopGameChats,
  subscribeGameChatMessages, subscribeGameChats, telegramDiscussionLinks
} from './game-chat.js?v=3';
import {
  connectPreparedTelegramProfile, normalizeTelegramUsername,
  prepareTelegramProfileConnection, telegramManualProfile
} from './telegram-profile.js?v=2';

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

const ORDER_CATEGORIES = Object.freeze([
  { id: 'coffee', icon: 'coffee', labels: { uk: 'Кава', it: 'Caffè', en: 'Coffee', fr: 'Café' } },
  { id: 'tea', icon: 'tea', labels: { uk: 'Чай', it: 'Tè', en: 'Tea', fr: 'Thé' } },
  { id: 'treats', icon: 'dessert', labels: { uk: 'Смаколики', it: 'Dolci', en: 'Treats', fr: 'Gourmandises' } }
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
  dealMode: 'number',
  penaltyMode: 'tournament',
  musicDefaultsVersion: GAME_MUSIC_DEFAULTS_VERSION,
  music: DEFAULT_GAME_MUSIC
};

const FOUL_SYSTEM_HELP = 'Турнірна: 3 фоли — без промови, 4-й фол — гравець залишає стіл. Клубна: 2 фоли — промова 30 секунд, 3 фоли — без права голосу, 4-й фол — гравець залишає стіл.';

const BUILTIN_ENJOY_VENUE = Object.freeze({
  id: 'builtin_enjoy',
  name: ENJOY_CAFE.name,
  googleMapsUrl: ENJOY_CAFE.mapsUrl,
  address: ENJOY_CAFE.address,
  phone: '',
  website: ENJOY_CAFE.instagramUrl,
  builtin: true
});

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
const PROFILE_PRESENCE_HEARTBEAT_MS = 60000;
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
  deletedGameIds: [],
  games: [],
  settings: { ...DEFAULT_SETTINGS, music: normalizeGameMusicSettings(DEFAULT_SETTINGS.music) },
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
  statsPeriod: 'all',
  nextGameQueue: [],
  authReady: false,
  authConfigured: false,
  authUser: null,
  authError: '',
  hostProfile: null,
  cloudDirectory: { status: 'idle', error: '', fromCache: false },
  cloudArchive: { status: 'idle', error: '', fromCache: false },
  venues: [],
  venueDirectory: { status: 'idle', error: '', fromCache: false },
  venueBusy: false,
  ownedPlayerLinks: [],
  playerLinkOffers: [],
  playerLinkBusy: false,
  legacyMigration: null,
  authBusy: false,
  accountDeleteBusy: false,
  media: { trackName: '', playing: false, error: '', sourceKey: '', automatic: false, cue: '' },
  order: { busy: false, status: 'idle', error: '', lastItem: '', category: '', selectedItem: '', selectedOptions: [] },
  orderMenu: DEFAULT_ORDER_MENU,
  profilePhotoSync: { status: 'idle' },
  telegramLink: { status: 'idle', error: '', prepared: null },
  gameFeedback: {},
  gameFeedbackSummaries: {},
  pendingActiveGameDeletes: [],
  hostTransfers: { incoming: [], outgoing: [], busy: false, error: '' },
  gameChats: [],
  gameChatsState: { status: 'idle', error: '' },
  chatMessages: [],
  chatMessagesState: { status: 'idle', error: '' },
  chatDraft: '',
  chatBusy: false,
  bluetooth: {
    supported: 'bluetooth' in navigator,
    available: null,
    deviceName: '',
    busy: false,
    error: ''
  },
  panelExpanded: {
    homeActiveGames: true,
    homeGameChats: true,
    homeRecentGames: false,
    moderatorPanel: false,
    setupGame: false,
    setupTimers: false,
    setupMusic: false,
    setupRules: false,
    setupSeating: true,
    statsActiveGames: false,
    statsSummary: true,
    statsTime: false,
    statsActivity: false,
    statsVenues: false,
    statsRoles: false,
    statsPlayers: false,
    statsArchiveGames: false
  }
};
let activationPromise = null;
let activationUid = null;
let cloudDirectoryPromise = null;
let cloudArchivePromise = null;
let venueDirectoryPromise = null;
let gameChatsPromise = null;
let cloudArchiveMigrationStarted = false;
let activeGamePublishPromise = null;
let activeGamePublishRetryHandle = null;
let profilePresenceHandle = null;
let renderedRoute = '';
let renderedModalKey = '';
let renderRevision = 0;
let passiveRenderPending = false;
const pendingActiveGames = new Map();
const activeGameRecoveryAttempts = new Set();
const ensuredActiveGameChats = new Set();
const activeGameChatMembershipSyncs = new Set();
const handledHostTransfers = new Set();
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
function formatRatingPoints(value = 0) {
  return new Intl.NumberFormat(languageLocale(app.settings.language), { maximumFractionDigits: 1 }).format(Number(value) || 0);
}
function formatRatingCoefficient(value = 0) {
  return new Intl.NumberFormat(languageLocale(app.settings.language), { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(value) || 0);
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
function gameChatById(id) { return app.gameChats.find(chat => chat.id === id || chat.gameId === id); }
function gameChatForGame(gameId) { return app.gameChats.find(chat => chat.gameId === gameId); }
function authorizedSeatUid(seat) {
  if (seat?.cloudUid) return String(seat.cloudUid);
  return String(seat?.profileId || '').startsWith('google_') ? String(seat.profileId).slice('google_'.length) : '';
}
function authorizedGameSeats(game) { return (game?.seats || []).filter(seat => authorizedSeatUid(seat)); }
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
    telegramUsername: member.telegramUsername || '',
    telegramUserId: member.telegramUserId || '',
    telegramDisplayName: member.telegramDisplayName || '',
    telegramPhotoURL: member.telegramPhotoURL || '',
    telegramVerified: member.telegramVerified === true,
    telegramLinkedAt: member.telegramLinkedAt || '',
    updatedAt: member.profileUpdatedAt || '',
    lastSeenAt: member.lastSeenAt || 0
  };
}
function ownProfilePlayer() {
  const id = `google_${app.authUser?.uid || ''}`;
  return playerById(id) || {
    id,
    cloudUid: app.authUser?.uid || '',
    source: 'cloud-own',
    name: app.hostProfile?.displayName || app.authUser?.googleName || 'Мій профіль',
    nickname: app.hostProfile?.nickname || '',
    contact: app.hostProfile?.club || 'Enjoy',
    notes: app.hostProfile?.description || '',
    avatar: app.hostProfile?.avatar || app.authUser?.googlePhotoURL || '',
    telegramUsername: app.hostProfile?.telegramUsername || '',
    telegramUserId: app.hostProfile?.telegramUserId || '',
    telegramDisplayName: app.hostProfile?.telegramDisplayName || '',
    telegramPhotoURL: app.hostProfile?.telegramPhotoURL || '',
    telegramVerified: app.hostProfile?.telegramVerified === true,
    telegramLinkedAt: app.hostProfile?.telegramLinkedAt || ''
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
  const pendingDeletes = new Set(app.pendingActiveGameDeletes);
  const visibleCloudGames = app.cloudGames.filter(game => !(game.status === 'active' && pendingDeletes.has(game.id)));
  const cloudById = new Map(visibleCloudGames.map(game => [game.id, game]));
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
  app.games = [...local, ...visibleCloudGames.filter(game => !localIds.has(game.id))];
}
function canManageGame(game) {
  const remote = game?.id ? app.cloudGames.find(item => item.id === game.id && item.status === 'active') : null;
  if (remote?.cloudOwnerUid && remote.cloudOwnerUid !== app.authUser?.uid) return false;
  const storedForCurrentAccount = Boolean(game && !game.publicOnly && app.localGames.some(item => item.id === game.id));
  if (storedForCurrentAccount) return true;
  const ownerUid = game?.cloudOwnerUid || game?.ownerUid || '';
  return Boolean(game) && (!ownerUid || ownerUid === app.authUser?.uid);
}
function ownsCloudGame(game) {
  const ownerUid = game?.cloudOwnerUid || game?.ownerUid || '';
  return Boolean(app.authUser?.uid && ownerUid === app.authUser.uid);
}
function pendingIncomingHostTransfer() {
  return app.hostTransfers.incoming.find(transfer => transfer.status === 'pending' && transfer.toUid === app.authUser?.uid) || null;
}
function outgoingHostTransfer(gameId = app.game?.id) {
  return app.hostTransfers.outgoing.find(transfer => transfer.gameId === gameId && transfer.status === 'pending') || null;
}
function hostTransferCandidates(search = '') {
  return selectHostTransferCandidates(app.players, app.authUser?.uid || '', search);
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
let manualMusicObjectUrl = '';
const setupMusicFiles = new Map();
let automaticMusicCue = '';
let automaticMusicPaused = false;
let automaticMusicBlockedCue = '';
let automaticMusicPlayPendingCue = '';
let automaticMusicSyncQueued = false;
let missingCustomMusicNotice = '';

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

async function playMusic({ automatic = false } = {}) {
  if (!app.media.trackName || !musicAudio.src) return toast('Спочатку оберіть аудіофайл');
  const sourceKey = app.media.sourceKey;
  const cue = app.media.cue;
  try {
    app.media.error = '';
    await musicAudio.play();
  } catch (error) {
    if (app.media.sourceKey !== sourceKey) return;
    app.media.playing = false;
    app.media.error = 'Браузер не зміг відтворити цей аудіофайл.';
    if (automatic && cue) automaticMusicBlockedCue = cue;
    setMediaSessionState('paused');
    render();
    toast(automatic ? 'Торкніться Play, щоб дозволити автоматичну музику' : (error?.message || app.media.error));
  }
}

function pauseMusic({ manual = true } = {}) {
  if (!app.media.trackName) return;
  if (manual && app.media.automatic) automaticMusicPaused = true;
  musicAudio.pause();
}

function clearMusicTrack({ revokeManual = true } = {}) {
  pauseMusic({ manual: false });
  musicAudio.removeAttribute('src');
  musicAudio.load();
  musicAudio.loop = false;
  if (revokeManual && manualMusicObjectUrl) URL.revokeObjectURL(manualMusicObjectUrl);
  if (revokeManual) manualMusicObjectUrl = '';
  app.media = { trackName: '', playing: false, error: '', sourceKey: '', automatic: false, cue: '' };
  setMediaSessionState('none');
}

function loadMusicTrack({ key, name, src, automatic = false, cue = '', loop = false }) {
  if (!key || !src) return false;
  if (app.media.sourceKey === key && musicAudio.src) {
    app.media.automatic = automatic;
    app.media.cue = cue;
    app.media.error = '';
    musicAudio.loop = loop;
    updateMusicMetadata();
    return true;
  }
  clearMusicTrack();
  musicAudio.src = src;
  musicAudio.loop = loop;
  app.media = { trackName: name || 'Аудіофайл', playing: false, error: '', sourceKey: key, automatic, cue };
  updateMusicMetadata();
  return true;
}

function selectMusicFile(file) {
  clearMusicTrack();
  const objectUrl = URL.createObjectURL(file);
  loadMusicTrack({
    key: `manual:${file.name || 'audio'}:${file.size || 0}:${file.lastModified || 0}`,
    name: file.name || 'Локальний аудіофайл',
    src: objectUrl
  });
  manualMusicObjectUrl = objectUrl;
  render();
  toast('Музику підготовлено');
}

function setupMusicFile(cue, file) {
  const customChoice = customMusicChoice(cue);
  if (!customChoice || !file) return;
  const previous = setupMusicFiles.get(cue);
  if (previous && app.media.sourceKey === previous.key) clearMusicTrack();
  if (previous?.url) URL.revokeObjectURL(previous.url);
  const entry = {
    key: `setup:${cue}:${file.name || 'audio'}:${file.size || 0}:${file.lastModified || 0}`,
    name: file.name || 'Власний аудіофайл',
    url: URL.createObjectURL(file)
  };
  setupMusicFiles.set(cue, entry);
  app.draft.settings.music = normalizeGameMusicSettings(app.draft.settings.music);
  app.draft.settings.music[cue] = customChoice;
  missingCustomMusicNotice = '';
  render();
  toast(`Файл для «${GAME_MUSIC_CUES.find(item => item.id === cue)?.label || 'сцени'}» обрано`);
}

function clearSetupMusicFiles() {
  for (const entry of setupMusicFiles.values()) {
    if (app.media.sourceKey === entry.key) clearMusicTrack();
    URL.revokeObjectURL(entry.url);
  }
  setupMusicFiles.clear();
}

function configuredMusicTrack(cue, choice) {
  if (choice === customMusicChoice(cue)) {
    const custom = setupMusicFiles.get(cue);
    if (custom) return { key: custom.key, name: custom.name, src: custom.url };
  }
  const fallbackId = choice === customMusicChoice(cue) ? DEFAULT_GAME_MUSIC[cue] : choice;
  const builtin = builtinGameTrack(fallbackId) || builtinGameTrack(DEFAULT_GAME_MUSIC[cue]);
  return builtin ? { key: `builtin:${builtin.id}`, name: builtin.label, src: builtin.src } : null;
}

async function previewSetupMusic(cue) {
  if (!app.draft) return;
  const settings = normalizeGameMusicSettings(app.draft.settings.music);
  const choice = settings[cue];
  if (choice === customMusicChoice(cue) && !setupMusicFiles.has(cue)) {
    document.querySelector(`[data-input="setup-music-file"][data-music-cue="${cue}"]`)?.click();
    return;
  }
  const track = configuredMusicTrack(cue, choice);
  if (!track) return toast('Не вдалося підготувати цю мелодію');
  automaticMusicCue = '';
  automaticMusicPaused = false;
  automaticMusicBlockedCue = '';
  automaticMusicPlayPendingCue = '';
  loadMusicTrack({ ...track, cue, loop: false });
  await playMusic();
}

async function syncAutomaticMusic() {
  const settings = normalizeGameMusicSettings(app.game?.settings?.music);
  const canPlayAutomatically = Boolean(
    app.authUser && app.game?.status === 'active' && !app.game.publicOnly
    && canManageGame(app.game) && settings.enabled
  );
  const cue = canPlayAutomatically ? musicCueForGame(app.game) : null;
  if (!cue) {
    automaticMusicCue = '';
    automaticMusicPaused = false;
    automaticMusicBlockedCue = '';
    automaticMusicPlayPendingCue = '';
    missingCustomMusicNotice = '';
    if (app.media.automatic) clearMusicTrack();
    return;
  }

  if (cue !== automaticMusicCue) {
    automaticMusicCue = cue;
    automaticMusicPaused = false;
    automaticMusicBlockedCue = '';
    automaticMusicPlayPendingCue = '';
  }
  const choice = settings[cue];
  if (choice === customMusicChoice(cue) && !setupMusicFiles.has(cue)) {
    const noticeKey = `${app.game.id}:${cue}`;
    if (missingCustomMusicNotice !== noticeKey) {
      missingCustomMusicNotice = noticeKey;
      toast('Власний файл недоступний після перезавантаження · грає вбудована мелодія');
    }
  }
  const track = configuredMusicTrack(cue, choice);
  if (!track) return;
  if (app.media.sourceKey !== track.key || !app.media.automatic || app.media.cue !== cue) {
    loadMusicTrack({ ...track, automatic: true, cue, loop: true });
  }
  if (!automaticMusicPaused && automaticMusicBlockedCue !== cue && automaticMusicPlayPendingCue !== cue && !app.media.playing) {
    automaticMusicPlayPendingCue = cue;
    try { await playMusic({ automatic: true }); }
    finally {
      if (automaticMusicPlayPendingCue === cue) automaticMusicPlayPendingCue = '';
    }
  }
}

function queueAutomaticMusicSync() {
  if (automaticMusicSyncQueued) return;
  automaticMusicSyncQueued = true;
  queueMicrotask(() => {
    automaticMusicSyncQueued = false;
    void syncAutomaticMusic();
  });
}

function configureMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.setActionHandler('play', () => { automaticMusicPaused = false; automaticMusicBlockedCue = ''; void playMusic({ automatic: app.media.automatic }); }); } catch { /* Not supported. */ }
  try { navigator.mediaSession.setActionHandler('pause', () => pauseMusic()); } catch { /* Not supported. */ }
  try { navigator.mediaSession.setActionHandler('stop', () => pauseMusic()); } catch { /* Not supported. */ }
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
  return `<svg class="nav-icon nav-icon-${name}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
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

function playerStatsIcon() {
  return '<svg class="player-stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-7M12 20V5m7 15V9"/><path d="M3 20h18"/></svg>';
}

function backChevronIcon() {
  return '<svg class="back-chevron-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15.5 4.5-7.5 7.5 7.5 7.5"/></svg>';
}

function randomActionIcon(kind) {
  if (kind === 'dice') return '<svg class="button-random-icon button-dice-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="10" height="10" rx="2"/><circle cx="6.5" cy="11.5" r=".8"/><circle cx="9.5" cy="14.5" r=".8"/><rect x="11" y="4" width="10" height="10" rx="2"/><circle cx="14.5" cy="7.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/></svg>';
  return '<svg class="button-random-icon button-shuffle-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h2.5c4.5 0 6.5 12 11 12H21"/><path d="m18 15 3 3-3 3"/><path d="M4 18h2.5c1.8 0 3.1-2 4.3-4.4M13.2 9.8C14.4 7.7 15.7 6 17.5 6H21"/><path d="m18 3 3 3-3 3"/></svg>';
}

function clearSeatingIcon() {
  return '<svg class="button-clear-seating-icon button-broom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 3.5-9.8 9.8"/><path d="m9 11.5 3.5 3.5-3.2 5.5H3.5L9 11.5Z"/><path d="m7.5 14-3.2 5.3m5.3-3.1-2.5 4.3"/></svg>';
}

function discussionIcon() {
  return '<svg class="discussion-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 10h8M8 13h5"/></svg>';
}

function telegramIcon() {
  return '<svg class="discussion-icon telegram-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 17-7-4.2 16-5.2-4.2-3 2.8.5-5.2L17 7.2l-10.5 5Z"/><path d="m8.1 13.4 7.7-5.2"/></svg>';
}

function telegramProfileBadge(profile, { compact = false } = {}) {
  const username = normalizeTelegramUsername(profile?.telegramUsername);
  if (!username) return profile?.telegramVerified
    ? `<span class="badge telegram-profile-badge ${profile.telegramVerified ? 'green' : 'gold'}">${compact ? 'Telegram' : 'Telegram підключено'}</span>`
    : '';
  const label = compact ? `@${username}` : `${profile.telegramVerified ? 'Telegram' : 'Telegram вручну'} · @${username}`;
  return `<a class="badge telegram-profile-badge ${profile.telegramVerified ? 'green' : 'gold'}" href="https://t.me/${esc(username)}" target="_blank" rel="noopener noreferrer" title="Відкрити @${esc(username)} у Telegram">${telegramIcon()}<span>${esc(label)}</span></a>`;
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
    file: '<path d="M4 5h6l2 2h8v12H4V5Z"/><path d="M12 16v-6m-3 3 3-3 3 3"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    order: '<path d="M4 16h16M6 16a6 6 0 0 1 12 0M3 20h18M12 6v2"/><circle cx="12" cy="4" r="1"/>',
    cancelGame: '<circle cx="12" cy="12" r="8"/><path d="m9 9 6 6m0-6-6 6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function mediaChoiceIcon(name) {
  if (name === 'bluetooth') return headerControlIcon('bluetooth');
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M4 5h5M6.5 2.5v5"/></svg>';
}

function currentPwaInstallMode() {
  return pwaInstallMode({
    deferredPrompt: app.installPrompt,
    navigatorLike: navigator,
    matchMediaLike: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null
  });
}

function pwaInstallIcon(mode = currentPwaInstallMode()) {
  if (mode === 'ios-guide') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M7 10H5v10h14V10h-2"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4"/></svg>';
}

function pwaInstallButtonHtml({ access = false } = {}) {
  const mode = currentPwaInstallMode();
  if (!['native', 'ios-guide'].includes(mode)) return '';
  if (access) {
    const label = mode === 'ios-guide' ? 'Встановити на iPhone' : 'Встановити застосунок';
    return `<button class="btn secondary wide access-install-btn" type="button" data-action="install">${pwaInstallIcon(mode)}<span>${label}</span></button>`;
  }
  return `<button class="icon-btn install-btn" type="button" data-action="install" aria-label="Встановити застосунок" title="Встановити застосунок">${pwaInstallIcon(mode)}</button>`;
}

function headerHtml() {
  const profileLabel = app.hostProfile?.displayName || app.authUser?.googleName || app.authUser?.email || 'Google';
  const hasTrack = Boolean(app.media.trackName);
  const bluetoothLabel = 'Bluetooth і музика';
  const canInstall = ['native', 'ios-guide'].includes(currentPwaInstallMode());
  const showHeaderShare = !['game', 'reveal'].includes(app.route);
  const cancelableGame = app.game?.status === 'active' && canManageGame(app.game)
    ? app.game
    : activeGames().find(game => canManageGame(game));
  const cancelGameButton = cancelableGame
    ? `<button class="icon-btn header-media-btn cancel-game-btn" type="button" data-action="cancel-active-game" data-id="${esc(cancelableGame.id)}" aria-label="Скасувати активну гру" title="Скасувати активну гру" aria-haspopup="dialog">${headerControlIcon('cancelGame')}</button>`
    : '';
  return `<header class="shell-header ${canInstall && showHeaderShare ? 'has-install' : ''} ${showHeaderShare ? 'has-share' : ''} ${cancelableGame ? 'has-cancel-game' : ''}">
    <a class="brand" href="#home" aria-label="Mafia — головна">
      <img class="brand-mark" src="./assets/logo-mafia.webp" alt="" width="44" height="44" aria-hidden="true">
    </a>
    <div class="header-actions">
      ${canInstall && showHeaderShare ? pwaInstallButtonHtml() : ''}
      ${showHeaderShare ? `<button class="icon-btn share-btn" type="button" data-action="share-app" aria-label="Поділитися застосунком" title="Поділитися застосунком">${headerControlIcon('share')}</button>` : ''}
      <button class="icon-btn order-btn" type="button" data-action="open-order-panel" aria-label="Замовити напій" title="Замовити напій" aria-haspopup="dialog">${headerControlIcon('order')}</button>
      <div class="header-media-controls" role="group" aria-label="Bluetooth і музика">
        <button class="icon-btn header-media-btn play-btn ${app.media.playing ? 'active' : ''}" data-action="media-play" aria-label="Відтворити музику" title="Відтворити музику" ${!hasTrack || app.media.playing ? 'disabled' : ''}>${headerControlIcon('play')}</button>
        <button class="icon-btn header-media-btn pause-btn ${app.media.playing ? 'pause-active' : ''}" data-action="media-pause" aria-label="Призупинити музику" title="Призупинити музику" ${!hasTrack || !app.media.playing ? 'disabled' : ''}>${headerControlIcon('pause')}</button>
      </div>
      <div class="header-profile-actions">
        ${cancelGameButton}
        <button class="icon-btn header-media-btn bluetooth-btn browser-bluetooth-btn ${app.bluetooth.deviceName ? 'connected' : ''}" data-action="open-media-panel" aria-label="${bluetoothLabel}" title="${bluetoothLabel}" aria-haspopup="dialog">${headerControlIcon('bluetooth')}</button>
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
    <a class="nav-item ${route === 'setup' ? 'nav-new-game' : ''} ${app.route === route ? 'active' : ''}" href="#${route}" ${app.route === route ? 'aria-current="page"' : ''}>${navIcon(route)}<span>${label}</span></a>`).join('')}</nav>`;
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
    it: '<svg viewBox="0 0 36 24"><rect width="12" height="24" fill="#009246"/><rect x="12" width="12" height="24" fill="#fff"/><rect x="24" width="12" height="24" fill="#ce2b37"/></svg>',
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

function collapsiblePanel(id, title, explanation, content, className = '', headerAction = '') {
  const expanded = Boolean(app.panelExpanded[id]);
  const contentId = `panel-${id}`;
  return `<section class="card card-pad collapsible-panel ${expanded ? 'expanded' : 'collapsed'} ${className}" data-panel="${id}">
    <div class="collapsible-head section-heading">
      <button class="collapsible-toggle" type="button" data-action="toggle-panel" data-panel="${id}" aria-expanded="${expanded}" aria-controls="${contentId}">
        <span class="panel-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span><h2>${title}</h2>
      </button>
      <div class="collapsible-head-tools">${helpIcon(explanation, `Пояснення: ${title}`)}${headerAction}</div>
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
  return `<main class="access-page"><section class="card access-card"><img class="brand-mark access-logo" src="./assets/logo-mafia.webp" alt="" width="60" height="60" aria-hidden="true"><div class="eyebrow">Мафія у кав’ярні Enjoy</div>${titleHelp('h1', 'Увійдіть у Mafia', explanation)}<div class="access-actions"><button class="btn primary google-btn wide" data-action="auth-signin" ${app.authBusy ? 'disabled' : ''}><span class="google-mark" aria-hidden="true">G</span>${app.authBusy ? 'Відкриваємо Google…' : 'Увійти через Google'}</button>${pwaInstallButtonHtml({ access: true })}</div>${app.authError ? `<p class="danger-text">${esc(app.authError)}</p>` : ''}</section></main>`;
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
    ${activeGamesPanel(active, true, 'homeActiveGames')}
    ${gameChatsPanel()}
    <section class="stat-grid home-stat-grid">
      <article class="card stat-card"><b>${stats.games}</b><span>завершених ігор</span></article>
      <article class="card stat-card"><b>${app.players.length}</b><span>гравців у базі</span></article>
      <article class="card stat-card"><b>${stats.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${formatDuration(stats.averageSeconds)}</b><span>середній час гри</span></article>
    </section>
    ${collapsiblePanel(
      'homeRecentGames',
      'Останні ігри',
      archiveStatusText(),
      recent.length ? `<div class="list">${recent.map(gameRow).join('')}</div>` : statePanel('empty', 'Ігор ще немає', 'Створіть першу гру — усі дії потраплять до протоколу.'),
      '',
      '<button class="btn small secondary" data-nav="stats">Усі</button>'
    )}
    <div class="home-fab-group" role="group" aria-label="Швидкі дії"><button class="mobile-fab primary-fab" type="button" data-action="new-player" aria-label="Додати гравця" title="Додати гравця">${addPlayerIcon()}</button><button class="mobile-fab danger-fab" type="button" data-nav="setup" aria-label="Створити гру" title="Створити гру">${navIcon('setup')}</button></div>
  </main>`;
}

function gameRow(game) {
  const winner = game.winner === 'red' ? 'Місто' : game.winner === 'black' ? 'Мафія' : game.winner === 'draw' ? 'Нічия' : 'Не визначено';
  const host = preferredGameHostName(game);
  return `<div class="list-row"><div class="list-main"><b>${esc(game.title)}</b><span>${formatDate(game.endedAt || game.updatedAt, true)} · ${formatDuration(game.durationSeconds)}${host ? ` · ведучий ${esc(host)}` : ''}</span></div><span class="badge ${game.winner === 'red' ? 'red' : ''}">${winner}</span></div>`;
}

function discussionButtonForGame(game, className = 'secondary') {
  if (game?.status !== 'finished' || (!canManageGame(game) && !gameChatForGame(game.id))) return '';
  return `<button class="btn ${className}" type="button" data-action="open-game-discussion" data-id="${esc(game.id)}">${discussionIcon()}<span>Обговорити гру</span></button>`;
}

function activeGamesPanel(active, refreshAction = false, collapsibleId = '') {
  const explanation = 'Ведучий продовжує власну гру на цьому пристрої. Інші авторизовані користувачі можуть безпечно спостерігати без доступу до ролей і нічних перевірок.';
  const refresh = refreshAction ? '<button class="btn small secondary" data-action="cloud-games-refresh">Оновити</button>' : '';
  let content = `<div class="active-game-list">${active.map(activeGameRow).join('')}</div>`;
  if (!active.length) {
    const status = app.cloudArchive.status;
    const kind = status === 'error' ? 'error' : status === 'loading' || status === 'idle' ? 'loading' : status === 'offline' ? 'offline' : 'empty';
    const title = status === 'error' ? 'Активні ігри недоступні' : status === 'loading' || status === 'idle' ? 'Шукаємо активні ігри…' : status === 'offline' ? 'Немає з’єднання' : 'Активних ігор зараз немає';
    const detail = status === 'error' ? app.cloudArchive.error : status === 'offline' ? 'Підключіться до інтернету та оновіть список.' : 'Коли ведучий почне гру, тут з’явиться кнопка «Спостерігати».';
    content = statePanel(kind, title, detail, '', true);
  }
  if (collapsibleId) {
    return collapsiblePanel(collapsibleId, 'Активні ігри', explanation, content, 'active-games-panel', refresh);
  }
  return `<section class="card card-pad active-games-panel"><div class="section-title section-heading">${titleHelp('h2', 'Активні ігри', explanation)}${refresh}</div>${content}</section>`;
}

function gameChatsPanel() {
  const status = app.gameChatsState.status;
  let content = app.gameChats.length
    ? `<div class="game-chat-list">${app.gameChats.map(chat => `<article class="game-chat-row"><div class="game-chat-row-icon" aria-hidden="true">${discussionIcon()}</div><div class="game-chat-row-copy"><b>${esc(chat.gameTitle)}</b><span>${chat.status === 'active' ? 'Гра триває' : formatDate(chat.endedAt, true)}${chat.venue ? ` · ${esc(chat.venue)}` : ''} · ${chat.participantUids.length} учасн.</span></div>${chat.status === 'active' ? '<span class="badge green">Наживо</span>' : ''}<button class="btn small secondary" type="button" data-action="open-game-chat" data-id="${esc(chat.id)}">Відкрити</button></article>`).join('')}</div>`
    : status === 'loading' || status === 'idle'
      ? statePanel('loading', 'Завантажуємо чати…', 'Тут з’являться доступні обговорення активних і завершених ігор.', '', true)
      : status === 'error'
        ? statePanel('error', 'Чати тимчасово недоступні', app.gameChatsState.error, '<button class="btn small secondary" data-action="game-chats-refresh">Повторити</button>', true)
        : statePanel('empty', 'Обговорень ще немає', 'Чат створиться автоматично разом із наступною грою.', '', true);
  return collapsiblePanel(
    'homeGameChats',
    'Обговорення ігор',
    'Чат створюється разом із грою. Під час гри він доступний ведучому, глядачам і гравцям, які вже вибули.',
    content,
    'game-chats-panel',
    status === 'online' ? '<span class="badge green">Онлайн</span>' : ''
  );
}

function activeGameRow(game) {
  const resumable = canManageGame(game) && (!game.publicOnly || ownsCloudGame(game));
  const host = preferredGameHostName(game);
  const alive = game.seats.filter(seat => seat.status === 'alive').length;
  const gameId = esc(game.id);
  const primaryAction = resumable
    ? `<button class="btn danger active-game-action" data-action="resume-game" data-id="${gameId}">Продовжити</button>`
    : `<button class="btn secondary active-game-action watch-game-action" data-action="watch-game" data-id="${gameId}">${eyeIcon()}<span>Спостерігати</span></button>`;
  const actions = `<div class="active-game-actions">${primaryAction}</div>`;
  return `<article class="active-game-row"><div class="active-game-copy"><div class="eyebrow">Триває зараз</div><h3>${esc(game.title)}</h3><div class="continue-meta">${phaseLabel(game)} · ${alive}/10 за столом${host ? ` · ведучий ${esc(host)}` : ''} · оновлено ${formatDate(game.updatedAt, true)}</div></div>${actions}</article>`;
}

function playersView() {
  const query = app.search.trim().toLocaleLowerCase('uk');
  const filteredPlayers = app.players.filter(player => !query || `${player.name} ${player.nickname || ''} ${player.email || ''} ${player.contact || ''} ${player.notes || ''} ${player.telegramUsername || ''} ${player.telegramDisplayName || ''}`.toLocaleLowerCase('uk').includes(query));
  const gameCounts = new Map(filteredPlayers.map(player => [player.id, statsForPlayer(player.id).games]));
  const onlinePlayerIds = new Set(filteredPlayers.filter(playerIsOnline).map(player => player.id));
  const players = sortDirectoryPlayers(filteredPlayers, { onlinePlayerIds, gameCounts });
  const cloudLabel = app.cloudDirectory.status === 'online'
    ? `${app.cloudPlayers.length} у каталозі`
    : app.cloudDirectory.status === 'offline'
      ? `${app.cloudPlayers.length} з офлайн-кешу`
      : app.cloudDirectory.status === 'loading' ? 'Синхронізація…' : 'Каталог недоступний';
  return `<main class="page tab-page players-page">
    ${pageHeader('Гравці', 'Спочатку показано авторизованих гравців онлайн за кількістю ігор, потім авторизованих офлайн, після них — гостей. Google-профілі доступні всій спільноті, але змінюються лише власниками. Статус «Онлайн» означає активність у застосунку протягом останніх двох хвилин. Ручні профілі може редагувати й видаляти будь-який авторизований користувач. Профілі учасників активної гри заблоковані до її завершення.', '<div class="actions"><button class="btn primary" data-action="new-player">+ Додати гравця</button></div>')}
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
  return personalPlayerStats(finishedGames(), playerId);
}

function playerIsOnline(player) {
  if (!player?.cloudUid) return false;
  return player.cloudUid === app.authUser?.uid
    ? navigator.onLine && !document.hidden
    : profileWasRecentlyActive(player.lastSeenAt);
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
  const online = playerIsOnline(player);
  const presence = isGoogleProfile
    ? `<span class="badge presence-badge ${online ? 'online' : 'offline'}" data-presence="${online ? 'online' : 'offline'}" title="${online ? 'Активність протягом останніх двох хвилин' : 'Активності не було понад дві хвилини'}"><i aria-hidden="true"></i>${online ? 'Онлайн' : 'Офлайн'}</span>`
    : '';
  const lockedButton = '<button class="icon-btn player-edit" type="button" aria-label="Профіль заблоковано до завершення гри" title="Профіль зараз у грі" disabled>🔒</button>';
  const editButton = profileLocked
    ? lockedButton
    : isGoogleProfile
      ? (ownCloudProfile ? '<button class="icon-btn player-edit" data-action="edit-host-profile" aria-label="Редагувати власний профіль">•••</button>' : '')
      : `<button class="icon-btn player-edit" data-action="edit-player" data-id="${player.id}" aria-label="Редагувати ${esc(player.name)}">•••</button>`;
  const club = String(player.contact || '').trim();
  const description = String(player.notes || '').trim();
  const profileKind = player.linkAccepted
    ? '<span class="badge green">Google · об’єднано</span>'
    : isGoogleProfile
      ? '<span class="badge green">Google · Enjoy</span>'
      : '<span class="guest-label">Гість</span>';
  return `<article class="card player-card ${isCloud ? 'cloud' : 'local'} ${isGoogleProfile ? 'google-profile' : ''}">
    <button class="player-avatar-button" type="button" data-action="open-player-avatar" data-id="${esc(player.id)}" aria-label="Відкрити велике фото ${esc(preferredPlayerName(player))}" title="Відкрити фото">${avatar(player)}</button>
    <div class="player-card-copy"><div class="player-name-line"><h3>${esc(preferredPlayerName(player))}</h3>${club ? `<span class="player-club">${esc(club)}</span>` : ''}</div>${description ? `<p>${esc(description)}</p>` : ''}<div class="player-stats">${profileKind}${presence}${telegramProfileBadge(player, { compact: true })}${!isGoogleProfile && player.email ? '<span class="badge gold">Очікує Google</span>' : ''}<span>${stats.games} ігор</span><span>${stats.winRate}% перемог</span></div></div>
    <div class="player-card-actions">${editButton}<button class="icon-btn player-stats-button" type="button" data-action="open-player-stats" data-id="${esc(player.id)}" aria-label="Статистика ${esc(preferredPlayerName(player))}" title="Персональна статистика">${playerStatsIcon()}</button><button class="queue-player-btn ${queued ? 'selected' : ''}" data-action="toggle-next-player" data-id="${esc(player.id)}" aria-label="${queued ? `Прибрати ${esc(preferredPlayerName(player))} зі складу наступної гри` : `Додати ${esc(preferredPlayerName(player))} до наступної гри`}" aria-pressed="${queued}"><span aria-hidden="true">${queued ? '✓' : '+'}</span>${queued ? `<small>${queueIndex + 1}</small>` : ''}</button></div>
  </article>`;
}

function playerAvatarModalHtml() {
  const player = playerById(app.modal.playerId);
  if (!player) return '';
  const name = preferredPlayerName(player);
  const source = player.avatar || player.avatarPreset || '';
  const preview = source
    ? `<img class="player-avatar-full" src="${esc(source)}" alt="Фото ${esc(name)}">`
    : `<div class="player-avatar-full player-avatar-full-fallback" aria-label="Аватар ${esc(name)}">${esc(initials(name))}</div>`;
  return `<div class="modal-backdrop player-avatar-backdrop" data-action="close-modal"><div class="card modal player-avatar-modal" role="dialog" aria-modal="true" aria-labelledby="player-avatar-title" tabindex="-1">
    <div class="section-title section-heading"><div><span class="eyebrow">Фото гравця</span><h2 id="player-avatar-title">${esc(name)}</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
    <div class="player-avatar-viewer">${preview}</div>
  </div></div>`;
}

function availableVenues() {
  const seen = new Set();
  const venues = [BUILTIN_ENJOY_VENUE, ...app.venues].filter(venue => {
    const name = String(venue?.name || '').trim().toLocaleLowerCase('uk');
    const address = String(venue?.address || '').trim().toLocaleLowerCase('uk');
    const key = `${name}|${address}`;
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return filterVenues(venues);
}

function defaultGameTitle(date = new Date(), venueName = BUILTIN_ENJOY_VENUE.name) {
  return gameTitleForVenue(venueName, date);
}

function setDraftVenue(venue) {
  if (!app.draft) return;
  const name = String(venue?.name || '').trim();
  app.draft.venueId = String(venue?.id || '');
  app.draft.venue = name;
  app.draft.venueSearch = name;
  app.draft.venuePickerOpen = false;
  if (app.draft.autoTitle !== false) app.draft.title = defaultGameTitle(new Date(), name);
}

function focusVenueSearch() {
  requestAnimationFrame(() => {
    const search = $('[data-input="venue-search"]');
    search?.focus();
    search?.setSelectionRange(search.value.length, search.value.length);
  });
}

function venuePickerHtml() {
  const query = String(app.draft.venueSearch ?? app.draft.venue ?? '');
  const venues = filterVenues(availableVenues(), query);
  const exact = availableVenues().some(venue => venue.name.toLocaleLowerCase('uk') === query.trim().toLocaleLowerCase('uk'));
  const open = Boolean(app.draft.venuePickerOpen);
  const options = venues.map(venue => `<button class="venue-option" type="button" role="option" data-action="select-game-venue" data-id="${esc(venue.id)}" aria-selected="${app.draft.venueId === venue.id}"><span><b>${esc(venue.name)}</b>${venue.address ? `<small>${esc(venue.address)}</small>` : ''}</span><span aria-hidden="true">›</span></button>`).join('');
  const custom = query.trim() && !exact
    ? `<button class="venue-option venue-option-custom" type="button" role="option" data-action="use-custom-game-venue"><span><b>Використати «${esc(query.trim())}»</b><small>Лише для цієї гри, без збереження в каталозі</small></span><span aria-hidden="true">+</span></button>`
    : '';
  const directoryStatus = app.venueDirectory.status === 'error'
    ? `<small class="venue-directory-status error">${esc(app.venueDirectory.error)}</small>`
    : '';
  return `<div class="field venue-field"><label for="game-venue">Місце / клуб</label><div class="venue-picker"><div class="venue-picker-row"><input id="game-venue" class="input" type="search" data-input="venue-search" value="${esc(query)}" maxlength="60" placeholder="Пошук місця або клубу" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="venue-options" aria-expanded="${open}"><button class="btn small secondary venue-add-button" type="button" data-action="open-venue-create">+ Додати</button></div>${open ? `<div id="venue-options" class="venue-options" role="listbox">${options}${custom}${!options && !custom ? '<p class="venue-empty">Місць не знайдено</p>' : ''}</div>` : ''}</div>${directoryStatus}</div>`;
}

function focusProfileClubSearch() {
  requestAnimationFrame(() => {
    const search = $('[data-input="profile-club-search"]');
    search?.focus();
    search?.setSelectionRange(search.value.length, search.value.length);
  });
}

function profileClubPickerHtml(profile) {
  const query = String(app.modal?.profileDraft?.clubSearch ?? profile.club ?? '');
  const venues = filterVenues(availableVenues(), query);
  const exact = availableVenues().some(venue => venue.name.toLocaleLowerCase('uk') === query.trim().toLocaleLowerCase('uk'));
  const open = Boolean(app.modal?.profileDraft?.clubPickerOpen);
  const options = venues.map(venue => `<button class="venue-option" type="button" role="option" data-action="select-profile-club" data-id="${esc(venue.id)}" aria-selected="${String(profile.club || '').trim().toLocaleLowerCase('uk') === venue.name.toLocaleLowerCase('uk')}"><span><b>${esc(venue.name)}</b>${venue.address ? `<small>${esc(venue.address)}</small>` : ''}</span><span aria-hidden="true">›</span></button>`).join('');
  const custom = query.trim() && !exact
    ? `<button class="venue-option venue-option-custom" type="button" role="option" data-action="use-custom-profile-club"><span><b>Використати «${esc(query.trim())}»</b><small>Зберегти назву лише у профілі</small></span><span aria-hidden="true">+</span></button>`
    : '';
  const directoryStatus = app.venueDirectory.status === 'error'
    ? `<small class="venue-directory-status error">${esc(app.venueDirectory.error)}</small>`
    : '';
  return `<div class="field venue-field profile-club-field"><label for="host-club">Клуб або організація</label><div class="venue-picker"><div class="venue-picker-row"><input id="host-club" class="input" type="search" name="club" data-input="profile-club-search" value="${esc(query)}" maxlength="60" placeholder="Пошук місця або клубу" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="profile-club-options" aria-expanded="${open}"><button class="btn small secondary venue-add-button" type="button" data-action="open-profile-club-create">+ Додати</button></div>${open ? `<div id="profile-club-options" class="venue-options" role="listbox">${options}${custom}${!options && !custom ? '<p class="venue-empty">Місць не знайдено</p>' : ''}</div>` : ''}</div>${directoryStatus}</div>`;
}

function createDraft() {
  const selectedPlayers = app.nextGameQueue.length
    ? queuedPlayers().slice(0, TABLE_SIZE)
    : app.players.length >= TABLE_SIZE ? shuffled(app.players).slice(0, TABLE_SIZE) : [];
  return {
    title: defaultGameTitle(), autoTitle: true,
    venue: BUILTIN_ENJOY_VENUE.name,
    venueId: BUILTIN_ENJOY_VENUE.id,
    venueSearch: BUILTIN_ENJOY_VENUE.name,
    venuePickerOpen: false,
    notes: '',
    settings: { ...app.settings, music: normalizeGameMusicSettings(app.settings.music) },
    seats: draftSeatsForPlayers(selectedPlayers)
  };
}

function setupMusicCueHtml(cue, settings) {
  const choice = settings[cue.id];
  const custom = setupMusicFiles.get(cue.id);
  const customValue = customMusicChoice(cue.id);
  const options = BUILTIN_GAME_TRACKS.map(track => `<option value="${track.id}" ${choice === track.id ? 'selected' : ''}>${esc(track.label)}</option>`).join('');
  const customLabel = custom ? `Власний файл · ${custom.name}` : 'Власний файл із пристрою';
  const customMissing = choice === customValue && !custom;
  const inputId = `setup-music-file-${cue.id}`;
  const previewPlaying = app.media.playing && app.media.cue === cue.id;
  return `<article class="setup-music-cue" data-music-cue-card="${cue.id}">
    <div class="setup-music-cue-copy"><b>${esc(cue.label)}</b><small>${esc(cue.description)}</small></div>
    <div class="field"><label for="setup-music-choice-${cue.id}">Мелодія</label><select id="setup-music-choice-${cue.id}" class="select" data-input="setup-music-choice" data-music-cue="${cue.id}">${options}<option value="${customValue}" ${choice === customValue ? 'selected' : ''}>${esc(customLabel)}</option></select></div>
    <div class="setup-music-actions" role="group" aria-label="Керування мелодією ${esc(cue.label)}"><button class="btn small secondary" type="button" data-action="preview-setup-music" data-music-cue="${cue.id}" aria-label="Прослухати" title="Прослухати">${headerControlIcon('play')}</button><button class="btn small secondary setup-music-pause-action" type="button" data-action="pause-setup-music" data-music-cue="${cue.id}" aria-label="Пауза" title="Пауза" ${previewPlaying ? '' : 'disabled'}>${headerControlIcon('pause')}</button><button class="btn small secondary setup-music-file-button" type="button" data-action="choose-setup-music-file" data-music-cue="${cue.id}" aria-label="Файл з пристрою" title="Файл з пристрою">${headerControlIcon('file')}</button></div>
    <input id="${inputId}" class="visually-hidden" type="file" accept="audio/*" data-input="setup-music-file" data-music-cue="${cue.id}">
    ${customMissing ? '<small class="setup-music-warning">Після перезавантаження виберіть файл повторно. До цього гратиме вбудована мелодія.</small>' : custom ? `<small class="setup-music-local">${esc(custom.name)} · лише на цьому пристрої</small>` : ''}
  </article>`;
}

function setupMusicHtml() {
  const settings = normalizeGameMusicSettings(app.draft.settings.music);
  app.draft.settings.music = settings;
  return `<div class="setup-music-stack">
    <div class="toggle-row setup-music-toggle"><span><b>Автоматична музика</b><small>Вмикає потрібну мелодію на відповідному етапі гри та вимикає її вдень.</small></span><button class="switch ${settings.enabled ? 'on' : ''}" type="button" data-action="toggle-draft-music" role="switch" aria-checked="${settings.enabled}" aria-label="Автоматична музика"></button></div>
    <div class="setup-music-device-controls">
      <div class="toggle-row setup-music-toggle"><span><b>Звукові сигнали таймера</b><small>Попереджають про завершення часу промови або іншої дії.</small></span><button class="switch ${app.settings.sound ? 'on' : ''}" type="button" data-action="setting-sound" role="switch" aria-checked="${app.settings.sound}" aria-label="Звукові сигнали таймера"></button></div>
      <div class="toggle-row setup-music-toggle"><span><b>Вібрація важливих дій</b><small>Підтверджує ключові натискання та важливі події під час гри.</small></span><button class="switch ${app.settings.haptics ? 'on' : ''}" type="button" data-action="setting-haptics" role="switch" aria-checked="${app.settings.haptics}" aria-label="Вібрація важливих дій"></button></div>
    </div>
    <div class="setup-music-grid">${GAME_MUSIC_CUES.map(cue => setupMusicCueHtml(cue, settings)).join('')}</div>
    <p class="privacy-note setup-music-note">Власні файли не завантажуються в мережу й доступні до закриття вкладки. Після перезавантаження застосунок тимчасово використає вбудовану мелодію, доки ви знову не оберете файл.</p>
  </div>`;
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
        ${venuePickerHtml()}
        <div class="field"><label for="game-notes">Нотатка ведучого</label><textarea id="game-notes" class="textarea" data-draft="notes" maxlength="500" placeholder="Турнір, номер столу, особливі умови…">${esc(app.draft.notes)}</textarea></div>
      </div>`)}
      ${collapsiblePanel('setupTimers', 'Правила й таймери', 'Ці значення можна змінити й під час гри.', `
        <div class="setup-options">
          ${numberField('Промова, сек', 'speech', app.draft.settings.speech, 'Основний час промови гравця.')}
          ${numberField('Попіл, сек', 'tieSpeech', app.draft.settings.tieSpeech, 'Додаткова промова кандидатів після нічиєї.')}
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
    ${collapsiblePanel('setupMusic', 'Музика гри', 'Автоматизація фонової музики під час роздачі ролей, нульової ночі, нічних дій та оголошення результату.', setupMusicHtml(), 'setup-music-panel', `<span class="badge ${app.draft.settings.music.enabled ? 'green' : ''}">${app.draft.settings.music.enabled ? 'Увімкнено' : 'Вимкнено'}</span>`)}
    ${collapsiblePanel('setupSeating', 'Розсадка', seatingHelp, `<div class="actions panel-actions"><div class="setup-deal-action"><div class="setup-deal-caption"><span>Спосіб роздачі ролей</span>${helpIcon('За обраною цифрою: гравці по черзі жестом показують число в межах карт, що залишилися, а суддя відкриває відповідну карту. Якщо число завелике — гравець обирає повторно; остання карта видається автоматично.', 'Пояснення: Спосіб роздачі ролей')}</div><select class="select" data-draft-setting="dealMode" aria-label="Спосіб роздачі ролей"><option value="number" ${app.draft.settings.dealMode !== 'automatic' ? 'selected' : ''}>За обраною цифрою</option><option value="automatic" ${app.draft.settings.dealMode === 'automatic' ? 'selected' : ''}>Автоматично</option></select></div><div class="setup-seating-actions"><button class="btn small secondary setup-random-action" data-action="shuffle-seats">${randomActionIcon('shuffle')}<span>Перемішати місця</span></button><button class="icon-btn setup-clear-seating-action" type="button" data-action="clear-setup-seats" aria-label="Очистити розсадку" title="Очистити розсадку">${clearSeatingIcon()}</button></div></div><div class="seat-setup">${app.draft.seats.map(setupSeat).join('')}</div><div class="actions panel-footer-actions"><button class="btn secondary" data-action="new-player">+ Новий профіль</button><button class="btn danger" data-action="start-game">Роздати ролі</button></div>`, 'setup-seating-panel')}
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

function sharedLeaderboard(games) {
  return mafiaPlayerRankings(games, playerById);
}

function statisticsPeriodPicker() {
  const periods = [
    { key: 'all', label: 'Увесь час' },
    { key: '30d', label: '30 днів' },
    { key: '90d', label: '90 днів' },
    { key: '365d', label: '12 місяців' }
  ];
  return `<section class="card stats-period-bar"><div><span class="eyebrow">Період аналізу</span><b>${esc(periods.find(period => period.key === app.statsPeriod)?.label || periods[0].label)}</b></div><div class="stats-period-options" role="group" aria-label="Період статистики">${periods.map(period => `<button class="btn small ${app.statsPeriod === period.key ? 'primary' : 'secondary'}" type="button" data-action="set-stats-period" data-stats-period="${period.key}" aria-pressed="${app.statsPeriod === period.key}">${period.label}</button>`).join('')}</div></section>`;
}

function formatStatisticsDuration(seconds) {
  return seconds > 0 ? formatDuration(seconds) : '—';
}

function formatStatisticsGap(seconds) {
  if (!(seconds > 0)) return '—';
  const hours = Math.round(seconds / 3600);
  if (hours < 48) return formatDuration(seconds);
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return `${days} дн${remainder ? ` ${remainder} год` : ''}`;
}

function statisticsDelta(value) {
  if (!value) return '<span class="stats-delta neutral">без змін</span>';
  return `<span class="stats-delta ${value > 0 ? 'positive' : 'negative'}">${value > 0 ? '+' : '−'}${Math.abs(value)}</span>`;
}

function statisticsMonthLabel(item) {
  return new Intl.DateTimeFormat(languageLocale(app.settings.language), { month: 'short', year: '2-digit' })
    .format(new Date(item.year, item.month, 1));
}

function statisticsWeekdayLabel(index) {
  if (!Number.isInteger(index)) return '—';
  const referenceSunday = new Date(2026, 7, 16);
  referenceSunday.setDate(referenceSunday.getDate() + index);
  return new Intl.DateTimeFormat(languageLocale(app.settings.language), { weekday: 'long' }).format(referenceSunday);
}

function statisticsStartWindowLabel(index) {
  return ['00:00–05:59', '06:00–11:59', '12:00–17:59', '18:00–23:59'][index] || '—';
}

function statisticsMetric(value, label) {
  return `<article class="stats-mini-card"><b>${value}</b><span>${label}</span></article>`;
}

function statisticsPhaseRow(label, detail, phase) {
  return `<div class="stats-phase-row"><div><b>${label}</b><span>${detail}</span></div><strong>${formatStatisticsDuration(phase.averageSeconds)}</strong><small>${phase.samples ? `${phase.samples} вимір.` : 'немає міток'}</small></div>`;
}

function statsView() {
  const allGames = finishedGames();
  const games = filterGamesByPeriod(allGames, app.statsPeriod);
  const active = activeGames();
  const statistics = buildGameStatistics(games);
  const aggregate = statistics.summary;
  const activity = gameActivityComparison(allGames);
  const leaderboard = sharedLeaderboard(games);
  const roles = ['citizen', 'sheriff', 'mafia', 'don'].map(key => {
    const appearances = games.flatMap(game => game.seats.map(seat => ({ game, seat }))).filter(item => item.seat.role === key);
    const wins = appearances.filter(item => item.game.winner === teamOf(item.seat)).length;
    return { label: ROLE_DECK.find(role => role.key === key)?.label || key, games: appearances.length, rate: appearances.length ? Math.round(wins / appearances.length * 100) : 0 };
  });
  const maximumMonthGames = Math.max(1, ...statistics.months.map(month => month.games));
  const timePanel = `<div class="stats-detail-grid">
    ${statisticsMetric(formatStatisticsDuration(aggregate.medianSeconds), 'медіанний час')}
    ${statisticsMetric(formatStatisticsDuration(aggregate.shortestSeconds), 'найкоротша гра')}
    ${statisticsMetric(formatStatisticsDuration(aggregate.longestSeconds), 'найдовша гра')}
    ${statisticsMetric(formatStatisticsGap(statistics.cadence.averageGapSeconds), 'середній інтервал між стартами')}
  </div><div class="stats-subheading"><b>Фази за протоколом</b><span>Ураховано лише відрізки з повними часовими мітками</span></div><div class="stats-phase-list">
    ${statisticsPhaseRow('Підготовка столу', 'від створення гри до першого дня', statistics.phases.setup)}
    ${statisticsPhaseRow('Ігровий день', 'від початку дня до оголошення ночі', statistics.phases.day)}
    ${statisticsPhaseRow('Ніч', 'від оголошення ночі до наступного дня або фінішу', statistics.phases.night)}
  </div>`;
  const activityPanel = `<div class="stats-compare-grid">
    <article><span>Останні 7 днів</span><b>${activity.current7} ігор</b>${statisticsDelta(activity.delta7)}<small>попередні 7: ${activity.previous7}</small></article>
    <article><span>Останні 30 днів</span><b>${activity.current30} ігор</b>${statisticsDelta(activity.delta30)}<small>попередні 30: ${activity.previous30}</small></article>
    <article><span>Середній фінальний день</span><b>${aggregate.averageDays || '—'}</b><small>максимальний: ${aggregate.maxDays || '—'}</small></article>
    <article><span>Найдовша пауза між стартами</span><b>${formatStatisticsGap(statistics.cadence.maxGapSeconds)}</b><small>${statistics.cadence.gapSamples} інтерв.</small></article>
  </div><div class="stats-subheading"><b>Динаміка за 6 місяців</b><span>кількість завершених ігор</span></div><div class="bar-chart stats-month-chart">${statistics.months.map(month => `<div class="bar-row"><span>${esc(statisticsMonthLabel(month))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(month.games / maximumMonthGames * 100)}%"></div></div><span class="bar-value">${month.games}</span></div>`).join('')}</div>`;
  const venuesPanel = `<div class="stats-detail-grid stats-schedule-grid">
    ${statisticsMetric(statisticsWeekdayLabel(statistics.cadence.peakWeekday), 'найактивніший день тижня')}
    ${statisticsMetric(statisticsStartWindowLabel(statistics.cadence.peakStartWindow), 'найчастіший час старту')}
    ${statisticsMetric(aggregate.uniqueVenues, 'місць / клубів')}
    ${statisticsMetric(aggregate.averageFaults, 'фолів у середньому за гру')}
    ${statisticsMetric(aggregate.disqualifications, 'дискваліфікацій за 4-й фол')}
  </div><div class="stats-subheading"><b>Результати за місцями</b><span>перші 5 за кількістю ігор</span></div>${statistics.venues.length ? `<div class="list stats-venue-list">${statistics.venues.slice(0, 5).map(venue => `<div class="list-row"><div class="list-main"><b>${esc(venue.name)}</b><span>${venue.games} ігор · ${formatStatisticsDuration(venue.averageSeconds)} у середньому${venue.draws ? ` · нічиї: ${venue.draws}` : ''}</span></div><div class="stats-venue-results"><span class="badge red">Місто ${venue.redWinRate}%</span><span class="badge">Мафія ${venue.blackWinRate}%</span></div></div>`).join('')}</div>` : statePanel('empty', 'Місця ще не вказували', 'Оберіть місце або клуб у налаштуваннях нової гри.', '', true)}`;
  return `<main class="page tab-page">
    ${pageHeader('Статистика', 'Результати, темп, фази, активність, місця та рейтинг завершених ігор усіх ведучих.', '<button class="btn small secondary" data-action="cloud-games-refresh">Оновити</button>')}
    ${statusStrip(app.cloudArchive.status, archiveStatusText(), app.cloudArchive.error, `${active.length} активних і ${allGames.length} завершених ігор доступно всім авторизованим учасникам.`)}
    ${activeGamesPanel(active, false, 'statsActiveGames')}
    ${statisticsPeriodPicker()}
    ${collapsiblePanel('statsSummary', 'Ключові показники', 'Числовий підсумок за вибраний період можна сховати або розгорнути цією кнопкою.', `<section class="stat-grid stats-summary-grid">
      <article class="card stat-card"><b>${aggregate.games}</b><span>ігор</span></article>
      <article class="card stat-card"><b>${aggregate.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${aggregate.blackWinRate}%</b><span>перемог мафії</span></article>
      <article class="card stat-card"><b>${aggregate.drawRate}%</b><span>нічиїх</span></article>
      <article class="card stat-card"><b>${formatStatisticsDuration(aggregate.averageSeconds)}</b><span>середній час гри</span></article>
      <article class="card stat-card"><b>${formatDuration(aggregate.totalSeconds)}</b><span>загальний час</span></article>
      <article class="card stat-card"><b>${aggregate.maxDays || '—'}</b><span>максимальний ігровий день</span></article>
      <article class="card stat-card"><b>${aggregate.uniquePlayers}</b><span>унікальних гравців</span></article>
    </section>`, 'stats-summary-panel')}
    <div class="grid two stats-analysis-panels">
      ${collapsiblePanel('statsTime', 'Час і темп гри', 'Тривалість і фазові відрізки обчислюються з фактичних часових міток протоколу. Старі ігри без міток не спотворюють середні значення.', timePanel)}
      ${collapsiblePanel('statsActivity', 'Активність і динаміка', 'Порівняння останніх періодів, ігрові дні та частота проведення столів.', activityPanel)}
    </div>
    ${collapsiblePanel('statsVenues', 'Місця, розклад і дисципліна', 'Зріз за клубами, типовим часом старту та зафіксованими фолами у вибраному періоді.', venuesPanel)}
    <div class="grid two stats-panels">
      ${collapsiblePanel('statsRoles', 'Результативність ролей', 'Показано частку перемог команди гравця для кожної ролі.', `<div class="bar-chart">${roles.map(role => `<div class="bar-row"><span>${esc(role.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${role.rate}%"></div></div><span class="bar-value">${role.rate}%</span></div>`).join('')}</div>`)}
      ${collapsiblePanel('statsPlayers', 'Рейтинг гравців', 'Автоматична частина системи FIIM/MWT: 1,3 бала за перемогу, 0,3 за поразку, 0 за нічию; +0,5/+0,7 за Кращий хід 2/3 або 3/3; −0,8 за дискваліфікацію через 4-й фол. КР — сума балів останніх 100 ігор, поділена на 100.', leaderboard.length ? `<div class="list player-ranking-list">${leaderboard.map(row => `<div class="list-row player-ranking-row"><div class="player-ranking-person"><b class="ranking-place" aria-label="Ранг ${row.rank}">#${row.rank}</b>${avatar(row.player, 'small')}<div class="list-main"><b>${esc(row.player.name)}</b><span>${row.games} ігор · ${row.winRate}% перемог · КР ${formatRatingCoefficient(row.coefficient)}</span></div></div><div class="ranking-score"><b>${formatRatingPoints(row.points)}</b><span>балів</span></div></div>`).join('')}</div><a class="ranking-method-link" href="https://fiim.world/scoring" target="_blank" rel="noopener noreferrer">Методика FIIM/MWT ↗</a>` : statePanel('empty', 'Рейтинг ще порожній', 'Завершіть першу гру, щоб побачити результати.'))}
    </div>
    ${collapsiblePanel('statsArchiveGames', 'Спільний архів ігор', 'Протоколи, чати та анонімні оцінки синхронізуються між пристроями. Архів також враховує вибраний період; розподіл відповідей відкривається після трьох оцінок.', games.length ? `<div class="list archive-games-list">${games.map(game => `<article class="archive-game-entry">${gameRow(game)}${archiveGameFeedbackHtml(game)}<div class="actions archive-game-actions"><button class="btn small secondary" data-action="view-protocol" data-id="${game.id}">Протокол</button>${discussionButtonForGame(game, 'small secondary')}${canManageGame(game) ? `<button class="btn small danger" data-action="delete-game" data-id="${game.id}">Видалити</button>` : ''}</div></article>`).join('')}</div>` : statePanel('empty', 'За цей період ігор немає', 'Оберіть довший період або завершіть нову гру.'))}
  </main>`;
}

function archiveGameFeedbackHtml(game) {
  const state = app.gameFeedbackSummaries[game.id];
  if (!state || state.status === 'loading') {
    return `<div class="archive-feedback is-loading" data-archive-feedback="${esc(game.id)}"><span class="archive-feedback-icon" aria-hidden="true">◌</span><span>Завантажуємо анонімні оцінки…</span></div>`;
  }
  if (state.status === 'error') {
    return `<div class="archive-feedback is-error" data-archive-feedback="${esc(game.id)}"><span class="archive-feedback-icon" aria-hidden="true">!</span><span>Оцінки тимчасово недоступні</span></div>`;
  }
  const summary = state.summary || {};
  const total = Number(summary.total || 0);
  if (!summary.visible) {
    return `<div class="archive-feedback is-private" data-archive-feedback="${esc(game.id)}"><span class="archive-feedback-icon" aria-hidden="true">🔒</span><span><b>Анонімна оцінка</b><small>Зведення відкриється після 3 оцінок · ${Math.min(total, 3)}/3</small></span></div>`;
  }
  const emotions = GAME_EMOTIONS.map(item => ({ ...item, count: Number(summary.emotions?.[item.key] || 0) }));
  return `<div class="archive-feedback is-visible" data-archive-feedback="${esc(game.id)}">
    <div class="archive-feedback-heading"><span><b>Анонімна оцінка</b><small>${total} оцінок</small></span><div class="archive-sentiments" aria-label="Сподобалась або не сподобалась"><span class="positive">👍 <b>${Number(summary.sentiment?.up || 0)}</b><small>сподобалась</small></span><span class="negative">👎 <b>${Number(summary.sentiment?.down || 0)}</b><small>не сподобалась</small></span></div></div>
    <div class="archive-emotions" aria-label="Емоції гри">${emotions.map(item => `<span class="${item.count ? '' : 'is-zero'}" title="${esc(item.label)}"><i aria-hidden="true">${item.icon}</i><b>${item.count}</b><small>${esc(item.label)}</small></span>`).join('')}</div>
  </div>`;
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
      <div class="enjoy-info-copy"><div class="enjoy-brand-tools">${cafeIconLinks('settings-cafe-links')}</div><div><div class="eyebrow">coffee · community · mafia</div><h2>Домівка мафія-клубу</h2></div></div>
    </section>
    <div class="grid two">
      <section class="card card-pad">
        <div class="section-title section-heading">${titleHelp('h2', 'Профіль Enjoy', 'Google-акаунт і спільний каталог гравців. Email приватний. Email ручного профілю використовується лише для запрошення на об’єднання і доступний цьому ведучому та відповідному підтвердженому Google-акаунту. Ім’я, нікнейм, клуб, опис і вибраний аватар синхронізуються у каталозі.')}<span class="badge ${app.cloudDirectory.status === 'online' ? 'green' : ''}">${esc(directoryStatus)}</span></div>
        <div class="settings-profile-layout">
          <div class="host-profile-summary">${hostAvatar('large')}<div><h3>${esc(app.hostProfile?.displayName || app.authUser?.googleName || 'Ведучий')}</h3><p>${esc(app.authUser?.email || '')}</p><div class="host-profile-badges">${app.hostProfile?.club ? `<span class="badge gold">${esc(app.hostProfile.club)}</span>` : ''}${telegramProfileBadge(app.hostProfile, { compact: true })}${profilePhotoSyncHtml()}</div></div></div>
          <div class="actions profile-actions"><button class="btn secondary" data-action="edit-host-profile">Редагувати</button><button class="icon-btn profile-stats-shortcut" type="button" data-action="open-player-stats" data-id="google_${esc(app.authUser?.uid || '')}" aria-label="Моя статистика" title="Моя статистика">${playerStatsIcon()}</button><button class="btn secondary" data-action="auth-signout">Вийти</button><button class="icon-btn account-delete-btn" type="button" data-action="delete-account" aria-label="Видалити профіль Mafia" title="Видалити профіль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg></button></div>
        </div>
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
  const numberDeal = game.settings?.dealMode === 'number' && game.roleDeal?.mode === 'number';
  const remaining = numberDeal ? game.roleDeal.remainingRoles.length : 0;
  const selectedCard = numberDeal ? game.roleDeal.selectedCard : null;
  let content;
  let actions;
  if (game.revealOpen && role) {
    content = `<div class="role-reveal ${role.team === 'black' ? 'black' : 'red-team'}">${roleSignal(role.key, 'reveal-signal', `Ваша роль: ${role.label}`)}<div class="role-name">${role.label}</div><div class="role-team-badge ${role.team === 'red' ? 'red' : 'black'}">${role.team === 'red' ? 'Червона команда' : 'Чорна команда'}</div><p>${role.description}</p></div>`;
    actions = '<button class="btn primary wide game-lead-action" data-action="reveal-next">Сховати й перейти до наступного</button>';
  } else if (numberDeal && !role) {
    const isLastCard = remaining === 1;
    content = isLastCard
      ? `<div class="reveal-privacy number-deal-last"><div class="reveal-privacy-icon role-card-back" aria-hidden="true"><b>1</b></div><h2>Остання карта — гравець №${seat.number}</h2><p class="reveal-spoken-cue">Скажіть: «${esc(seat.name)}, ви отримуєте останню карту». Перед показом переконайтеся, що екран бачить лише цей гравець.</p></div>`
      : `<div class="number-role-deal"><div class="number-role-instruction"><h2>Гравець №${seat.number} · ${esc(seat.name)} обирає цифру</h2><p class="reveal-spoken-cue">Скажіть: «Гравець номер ${seat.number}, покажіть число від <b>1</b> до <b>${remaining}</b>». Якщо число більше ${remaining} — попросіть обрати повторно.</p></div><div class="number-role-grid" role="group" aria-label="Оберіть карту від 1 до ${remaining}">${Array.from({ length: remaining }, (_, index) => {
        const card = index + 1;
        return `<button class="number-role-card ${selectedCard === card ? 'selected' : ''}" type="button" data-action="select-role-card" data-card="${card}" aria-pressed="${selectedCard === card}" aria-label="Карта ${card}"><span>${card}</span></button>`;
      }).join('')}</div>${selectedCard ? `<div class="number-role-confirm">Обрано карту <b>№${selectedCard}</b>. Суддя показує її лише цьому гравцеві.</div>` : '<div class="number-role-confirm muted">Торкніться цифри, яку показав гравець.</div>'}</div>`;
    const confirmButton = `<button class="btn primary wide game-lead-action" data-action="confirm-number-role" ${!isLastCard && !selectedCard ? 'disabled' : ''}>${isLastCard ? 'Показати останню роль' : selectedCard ? `Показати роль за картою №${selectedCard}` : 'Спочатку оберіть цифру'}</button>`;
    actions = selectedCard ? `<div class="number-deal-main-actions"><button class="btn secondary" data-action="change-role-card">Змінити цифру</button>${confirmButton}</div>` : confirmButton;
  } else {
    content = `<div class="reveal-privacy"><div class="reveal-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg></div><h2>Екран бачить лише №${seat.number} · ${esc(seat.name)}</h2><p class="reveal-spoken-cue">Скажіть: «${esc(seat.name)}, візьміть телефон, подивіться свою роль і натисніть кнопку нижче».</p></div>`;
    actions = '<button class="btn primary wide game-lead-action" data-action="reveal-role">Показати мою роль</button>';
  }
  return `<main class="page reveal-page"><div class="reveal-workspace">
    <section class="card reveal-card ${numberDeal ? 'number-deal' : ''} ${game.revealOpen ? 'role-open' : 'role-ready'}">
    <div class="reveal-progress"><span class="eyebrow">Роздача ролей</span><div><b>${game.revealIndex + 1}</b><span> / ${game.seats.length}</span>${helpIcon('Браузер не може гарантовано заблокувати скриншоти. Показуйте роль так, щоб екран бачив лише відповідний гравець.', 'Безпека показу ролі')}</div></div>
    <div class="reveal-player"><div class="reveal-seat"><span>Місце</span><strong>${seat.number}</strong></div>${avatar(seat, 'reveal-avatar')}<div class="reveal-player-copy"><div class="eyebrow">${numberDeal ? 'Суддя працює з колодою' : 'Передайте телефон особисто'}</div><h1>${esc(seat.name)}</h1></div></div>
    <div class="reveal-content">${content}</div>
    <div class="reveal-actions">${actions}</div>
    </section>
    <aside class="reveal-host-panel">${moderatorSideHtml({ includeProtocol: false })}</aside>
  </div></main>`;
}

function missingGameView() {
  return `<main class="page">${statePanel('error', 'Активну гру не знайдено', 'Створіть нову гру або поверніться на огляд.', '<button class="btn primary small" data-nav="setup">Створити гру</button>')}</main>`;
}

function phaseLabel(game = app.game) {
  if (!game) return 'Немає гри';
  const labels = {
    reveal: 'Роздача ролей', zeroNight: 'Нульова ніч', day: `День ${game.day}`,
    vote: `Голосування · день ${game.day}`, tieSpeech: 'Попіл · промови', tieVote: 'Попіл · голосування',
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
  const seatNameKey = String(seat.name || '').trim().toLocaleLowerCase('uk');
  const directoryProfile = seat.profileId
    ? playerById(seat.profileId)
    : app.players.find(player => preferredPlayerName(player).trim().toLocaleLowerCase('uk') === seatNameKey);
  const seatAvatar = directoryProfile?.avatar || directoryProfile?.avatarPreset || seat.avatar || seat.avatarPreset || ANIMAL_AVATARS[(seat.number - 1) % ANIMAL_AVATARS.length];
  const faultDots = Array.from({ length: 4 }, (_, index) => `<i class="fault-dot ${index < seat.faults ? 'active' : ''}" aria-hidden="true"></i>`).join('');
  const tags = seat.status === 'dead' ? 'вибув' : nominated ? 'кандидат' : seat.noVote ? 'без голосу' : '';
  return `<button class="game-seat ${seat.status === 'alive' ? 'alive' : 'dead'} ${current ? 'current' : ''} ${nominated ? 'nominated' : ''}" ${observer ? '' : `data-action="seat-menu" data-seat="${seat.number}"`} aria-label="Гравець ${seat.number}, ${esc(seat.name)}, фолів ${seat.faults} з 4${tags ? `, ${tags}` : ''}">
    <span class="seat-top"><span class="num">${seat.number}</span><span class="fault-mini" aria-label="Фоли: ${seat.faults} з 4">${faultDots}</span></span>
    ${avatar({ name: seat.name, avatar: seatAvatar }, '')}<span class="seat-name">${esc(seat.name)}</span><span class="seat-tag ${nominated ? 'alert' : ''}">${tags}</span>
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
  return `<div class="timer-adjust-row"><button class="btn secondary icon" data-action="timer-minus" aria-label="Мінус 5 секунд">−5</button><div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div><button class="btn secondary icon" data-action="timer-plus" aria-label="Плюс 5 секунд">+5</button></div>
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
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Попіл · додаткова промова</div><h2>№${number} · ${esc(seat?.name)}</h2></div><span class="badge gold">${app.game.speakerIndex + 1}/${app.game.vote.tied.length}</span></div>${timerControls('next-tie-speaker', app.game.speakerIndex >= app.game.vote.tied.length - 1 ? 'Голосувати' : 'Наступний →')}</section>`;
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
  return `<div class="compact-timer"><div class="timer-adjust-row"><button class="btn secondary icon" data-action="timer-minus" aria-label="Мінус 5 секунд">−5</button><div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div><button class="btn secondary icon" data-action="timer-plus" aria-label="Плюс 5 секунд">+5</button></div><div class="compact-timer-actions"><button class="btn primary" data-action="timer-toggle">${game.timer.running ? 'Пауза' : 'Старт'}</button><button class="btn secondary" data-action="timer-reset">Скинути</button></div></div>`;
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

function moderatorSideHtml({ includeProtocol = true } = {}) {
  const game = app.game;
  const black = game.seats.filter(seat => teamOf(seat) === 'black');
  const pendingTransfer = outgoingHostTransfer(game.id);
  const transferLabel = pendingTransfer ? `Очікує: ${pendingTransfer.toName}` : 'Передати ведення';
  const moderatorControls = `<div class="actions moderator-actions"><button class="btn small secondary" data-action="toggle-secret">${game.showSecrets ? 'Сховати ролі' : 'Ролі'}</button><button class="btn small secondary" data-action="undo" ${app.undo.length ? '' : 'disabled'}>↶ Скасувати</button><button class="btn small secondary" data-action="game-settings">⚙ Таймери</button><button class="btn small secondary" data-action="open-app-game-chat" data-id="${esc(game.id)}">${discussionIcon()} Чат гри</button><button class="btn small ${pendingTransfer ? 'primary' : 'secondary'} host-transfer-button" data-action="open-host-transfer">${esc(transferLabel)}</button></div>${game.showSecrets ? `<div class="divider"></div><div class="nom-list">${black.map(seat => `<span class="badge">${roleOf(seat).symbol} №${seat.number} ${esc(seat.name)}</span>`).join('')}</div>` : ''}<div class="divider"></div><button class="btn danger wide moderator-finish-game" data-action="end-game-manual">Завершити гру</button>`;
  const protocol = includeProtocol
    ? `<section class="card card-pad moderator-protocol-panel"><div class="section-title section-heading"><div><h3>Протокол</h3><p>${game.history.length} подій</p></div></div><div class="quick-log">${game.history.slice(0, 25).map(event => `<div class="log-item"><time>${esc(event.time)}</time>${esc(event.text)}</div>`).join('') || statePanel('empty', 'Подій ще немає', '', '', true)}</div></section>`
    : '';
  return `${collapsiblePanel('moderatorPanel', 'Панель ведучого', 'Ця панель містить приватну інформацію. Ролі початково приховані від випадкового погляду.', moderatorControls, 'moderator-panel')}${protocol}`;
}

function observerSideHtml() {
  const game = app.game;
  const chat = gameChatForGame(game.id);
  const joined = Boolean(chat?.participantUids.includes(app.authUser?.uid));
  const allowed = canJoinActiveGameChat(app.authUser, game);
  const chatAction = allowed
    ? `<button class="btn ${joined ? 'secondary' : 'primary'} wide" type="button" data-action="open-app-game-chat" data-id="${esc(game.id)}" ${app.chatBusy ? 'disabled' : ''}>${discussionIcon()} ${app.chatBusy ? 'Підключаємо…' : joined ? 'Відкрити чат гри' : 'Приєднатися до чату'}</button>`
    : '<button class="btn secondary wide" type="button" disabled>Чат недоступний під час гри</button>';
  const chatCopy = allowed
    ? 'Авторизовані глядачі та гравці, які вже вибули, можуть обговорювати гру наживо.'
    : 'Ви ще активний гравець за столом. Доступ відкриється після вибуття або завершення гри.';
  return `<section class="card card-pad"><div class="section-title section-heading">${titleHelp('h3', 'Публічна інформація', 'Тут не показуються ролі й нічні результати. Вкладка синхронізується з екраном ведучого в межах одного браузера.')}</div>${nominationChipsObserver()}</section><section class="card card-pad observer-chat-card"><div class="section-title section-heading"><div><span class="eyebrow">Наживо</span><h3>Чат гри</h3><p>${chatCopy}</p></div>${joined ? '<span class="badge green">Приєднано</span>' : ''}</div>${chatAction}</section>`;
}

function nominationChipsObserver() {
  return app.game.nominations.length ? `<div class="nom-list">${app.game.nominations.map(number => `<span class="badge red">№${number} ${esc(seatByNo(number)?.name)}</span>`).join('')}</div>` : '<span class="muted">Немає кандидатів</span>';
}

function winnerView(observer = false) {
  const red = app.game.winner === 'red';
  const draw = app.game.winner === 'draw';
  const title = draw ? 'Гру завершено нічиєю' : red ? 'Перемога мирного міста' : 'Перемога чорної команди';
  const detail = draw ? 'Результат зафіксовано без переможця.' : red ? 'Усі гравці чорної команди вибули.' : 'Чорна команда досягла паритету з містом.';
  const discuss = discussionButtonForGame(app.game, 'primary');
  const actions = observer
    ? discuss
      ? `<div class="actions winner-actions" style="justify-content:center">${discuss}<button class="btn secondary" data-nav="home">На головну</button></div>`
      : ''
    : `<div class="actions winner-actions" style="justify-content:center">${app.undo.length ? '<button class="btn secondary" data-action="undo">↶ Скасувати результат</button>' : ''}<button class="btn secondary" data-action="copy-protocol">Копіювати протокол</button>${discuss}<button class="btn primary" data-action="rematch">Реванш</button><button class="btn secondary" data-nav="home">На головну</button></div>`;
  return `<main class="page"><section class="card winner">${draw ? '<div class="winner-draw-mark" aria-hidden="true">＝</div>' : roleSignal(red ? 'citizen' : 'mafia', 'winner-signal', title)}<div class="eyebrow">Фінал гри</div><h1>${title}</h1><p class="muted">${detail}</p>${actions}</section></main>`;
}

function playerModalHtml() {
  const player = app.modal.player;
  const editing = Boolean(player.id);
  const sharedProfile = Boolean(player.cloudManualId);
  const email = player.email || (isValidPlayerEmail(player.contact) ? normalizePlayerEmail(player.contact) : '');
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal" data-form="player" aria-modal="true" role="dialog">
    <div class="section-title section-heading">${titleHelp('h2', editing ? 'Профіль гравця' : 'Новий гравець', 'Ручні профілі та аватари зберігаються у спільному каталозі. Будь-який авторизований користувач може їх редагувати або видаляти. Google-профіль змінює лише його власник.')}<div class="profile-modal-title-actions">${editing ? `<button class="icon-btn profile-stats-shortcut" type="button" data-action="open-player-stats" data-id="${esc(player.id)}" aria-label="Статистика гравця" title="Персональна статистика">${playerStatsIcon()}</button>` : ''}<button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div></div>
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

function telegramProfileEditorHtml(profile) {
  const username = normalizeTelegramUsername(profile.telegramUsername);
  const verified = profile.telegramVerified === true && Boolean(profile.telegramUserId) && Boolean(profile.telegramLinkedAt);
  const busy = ['loading', 'connecting'].includes(app.telegramLink.status);
  const automaticReady = app.telegramLink.status === 'ready';
  const automaticTitle = app.telegramLink.status === 'loading'
    ? 'Готуємо Telegram Login…'
    : app.telegramLink.status === 'connecting'
      ? 'Підключаємо Telegram…'
      : automaticReady
        ? 'Синхронізувати з Telegram'
        : 'Підготувати підключення Telegram';
  const linkedIdentity = verified
    ? `<div class="telegram-linked-identity">${profile.telegramPhotoURL
      ? `<img src="${esc(profile.telegramPhotoURL)}" alt="Фото Telegram" referrerpolicy="no-referrer">`
      : `<span class="telegram-linked-avatar">${telegramIcon()}</span>`}<div><b>${esc(profile.telegramDisplayName || (username ? `@${username}` : 'Telegram'))}</b>${username ? `<a href="https://t.me/${esc(username)}" target="_blank" rel="noopener noreferrer">@${esc(username)}</a>` : '<span>Username не вказано в Telegram</span>'}</div><span class="badge green">Підтверджено</span></div>`
    : username
      ? `<div class="telegram-manual-status"><span class="badge gold">Введено вручну</span><a href="https://t.me/${esc(username)}" target="_blank" rel="noopener noreferrer">t.me/${esc(username)}</a></div>`
      : '';
  const status = app.telegramLink.error
    ? `<p class="telegram-link-status danger-text" role="status">${esc(app.telegramLink.error)} · username можна ввести вручну.</p>`
    : app.telegramLink.status === 'loading'
      ? '<p class="telegram-link-status" role="status">Готуємо безпечне підключення…</p>'
      : app.telegramLink.status === 'ready'
        ? '<p class="telegram-link-status" role="status">Натисніть іконку Telegram, щоб підтвердити профіль.</p>'
        : '';
  return `<div class="field telegram-profile-field"><label for="host-telegram-username">${help('Telegram', 'Підключення через Telegram підтверджує профіль. Введений вручну @username зберігається як контакт без підтвердження.')}</label><div class="telegram-profile-input-row"><input id="host-telegram-username" class="input" name="telegramUsername" data-input="telegram-username" value="${esc(username)}" maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="@username або t.me/username"><button class="icon-btn telegram-connect-btn ${verified ? 'connected' : ''}" type="button" data-action="connect-telegram-profile" aria-label="${esc(automaticTitle)}" title="${esc(automaticTitle)}" ${busy ? 'disabled' : ''}>${telegramIcon()}</button>${verified || username ? `<button class="icon-btn telegram-disconnect-btn" type="button" data-action="disconnect-telegram-profile" aria-label="Від’єднати Telegram" title="Очистити Telegram">×</button>` : ''}</div>${linkedIdentity}${status}</div>`;
}

function hostProfileModalHtml() {
  const profile = { ...(app.hostProfile || {}), ...(app.modal?.profileDraft || {}) };
  const photo = profile.avatar || app.authUser?.googlePhotoURL || '';
  const photoDraftChanged = Boolean(app.modal?.profileDraft && Object.hasOwn(app.modal.profileDraft, 'avatar') && profile.avatar !== app.hostProfile?.avatar);
  const photoSyncStatus = photoDraftChanged ? 'pending' : app.profilePhotoSync.status;
  return `<div class="modal-backdrop host-profile-backdrop" data-action="close-modal"><form class="card modal host-profile-modal" data-form="host-profile" aria-modal="true" role="dialog" tabindex="-1">
    <div class="section-title section-heading">${titleHelp('h2', 'Мій профіль Enjoy', 'Ці дані допоможуть ведучим знайти вас і додати на стіл. Власний аватар стискається локально; видалення власного фото повертає фотографію Google.')}<div class="profile-modal-title-actions"><button class="icon-btn profile-stats-shortcut" type="button" data-action="open-player-stats" data-id="google_${esc(app.authUser?.uid || '')}" aria-label="Моя статистика" title="Моя статистика">${playerStatsIcon()}</button><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div></div>
    <div class="avatar-editor">${avatar({ name: profile.displayName || app.authUser?.googleName, avatar: photo }, 'large')}<div><div class="avatar-source-actions"><label class="btn primary" for="host-avatar-camera">${cameraIcon()}<span>Зробити фото</span></label><input id="host-avatar-camera" class="visually-hidden" type="file" accept="image/*" capture="environment" data-input="host-avatar-camera"><label class="btn secondary" for="host-avatar-gallery">Обрати з галереї</label><input id="host-avatar-gallery" class="visually-hidden" type="file" accept="image/*" data-input="host-avatar-gallery">${app.authUser?.googlePhotoURL && profile.avatar ? '<button class="btn secondary" type="button" data-action="host-use-google-photo">Фото Google</button>' : ''}</div>${profilePhotoSyncHtml(Boolean(profile.avatar), photoSyncStatus)}</div></div>
    <div class="stack">
      <div class="field"><label for="host-display-name">Ім’я *</label><input id="host-display-name" class="input" name="displayName" value="${esc(profile.displayName || app.authUser?.googleName || '')}" maxlength="60" autocomplete="name" required></div>
      <div class="field"><label for="host-nickname">Нікнейм</label><input id="host-nickname" class="input" name="nickname" value="${esc(profile.nickname || '')}" maxlength="40" autocomplete="nickname" aria-describedby="host-nickname-hint"><small id="host-nickname-hint" class="field-hint">Якщо заповнений, використовуватиметься як основне ім’я гравця під час гри.</small></div>
      ${profileClubPickerHtml(profile)}
      <div class="field"><label for="host-description">Про себе</label><textarea id="host-description" class="textarea" name="description" maxlength="600" placeholder="Досвід ведення, улюблена кава…">${esc(profile.description || '')}</textarea></div>
      <label class="toggle-row profile-visibility"><span>${help('Показувати мене в каталозі Enjoy', 'Ім’я, нік, клуб, опис і вибраний аватар бачитимуть лише авторизовані користувачі.')}</span><input type="checkbox" name="discoverable" ${profile.discoverable !== false ? 'checked' : ''}></label>
      <div class="field"><span class="field-label">${help('Мова застосунку', 'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.')}</span>${languagePickerHtml()}</div>
      ${telegramProfileEditorHtml(profile)}
      <div class="field"><span class="field-label">Google-акаунт</span><div class="identity-field"><span>${esc(app.authUser?.email || '')}</span><div class="identity-actions"><span class="badge green">Підтверджено</span><button class="icon-btn account-delete-btn" type="button" data-action="delete-account" aria-label="Видалити профіль" title="Видалити профіль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg></button></div></div></div>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Скасувати</button><button class="btn primary" type="submit">Зберегти профіль</button></div>
  </form></div>`;
}

function roleLabel(roleKey) {
  return ROLE_DECK.find(role => role.key === roleKey)?.label || 'Роль не вказана';
}

function feedbackSummaryHtml(feedback) {
  if (!feedback?.summary) return '';
  const summary = feedback.summary;
  if (!summary.visible) {
    return `<p class="feedback-threshold">🔒 Анонімне зведення відкриється після 3 оцінок · ${Math.min(summary.total || 0, 3)}/3</p>`;
  }
  const emotions = GAME_EMOTIONS.map(item => ({ ...item, count: Number(summary.emotions?.[item.key] || 0) }));
  return `<div class="feedback-summary" aria-label="Анонімне зведення оцінок"><span>👍 ${Number(summary.sentiment?.up || 0)}</span><span>👎 ${Number(summary.sentiment?.down || 0)}</span>${emotions.filter(item => item.count).map(item => `<span title="${esc(item.label)}">${item.icon} ${item.count}</span>`).join('')}</div>`;
}

function gameFeedbackControls(game, state) {
  const busy = ['loading', 'saving'].includes(state?.status);
  const mine = state?.data?.mine || { sentiment: '', emotion: '' };
  const status = state?.status === 'error'
    ? `<p class="feedback-status danger-text">${esc(state.error || 'Не вдалося завантажити оцінку')}</p>`
    : state?.status === 'saving'
      ? '<p class="feedback-status">Зберігаємо анонімно…</p>'
      : state?.status === 'saved'
        ? '<p class="feedback-status success-text">Оцінку збережено анонімно</p>'
        : '';
  return `<div class="game-feedback" data-feedback-game="${esc(game.id)}">
    <div class="sentiment-picker" role="group" aria-label="Чи сподобалась гра">
      <button class="feedback-choice ${mine.sentiment === 'up' ? 'selected' : ''}" type="button" data-action="rate-game-sentiment" data-id="${esc(game.id)}" data-value="up" aria-pressed="${mine.sentiment === 'up'}" ${busy ? 'disabled' : ''}><span aria-hidden="true">👍</span><b>Зайшла</b></button>
      <button class="feedback-choice ${mine.sentiment === 'down' ? 'selected' : ''}" type="button" data-action="rate-game-sentiment" data-id="${esc(game.id)}" data-value="down" aria-pressed="${mine.sentiment === 'down'}" ${busy ? 'disabled' : ''}><span aria-hidden="true">👎</span><b>Гірчить</b></button>
    </div>
    <div class="emotion-picker" role="group" aria-label="Емоція від гри">${GAME_EMOTIONS.map(item => `<button class="emotion-choice ${mine.emotion === item.key ? 'selected' : ''}" type="button" data-action="rate-game-emotion" data-id="${esc(game.id)}" data-value="${item.key}" aria-label="${esc(item.label)}" title="${esc(item.label)}" aria-pressed="${mine.emotion === item.key}" ${busy ? 'disabled' : ''}><span aria-hidden="true">${item.icon}</span></button>`).join('')}</div>
    ${status}${feedbackSummaryHtml(state?.data)}
  </div>`;
}

function playerStatsModalHtml() {
  const playerId = app.modal.playerId;
  const player = playerId === `google_${app.authUser?.uid || ''}` ? ownProfilePlayer() : playerById(playerId);
  if (!player) return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal player-stats-modal" role="dialog" aria-modal="true"><div class="section-title"><h2>Профіль не знайдено</h2><button class="icon-btn" data-action="close-modal" aria-label="Закрити">×</button></div></div></div>`;
  const stats = personalPlayerStats(finishedGames(), player.id);
  const canRate = Boolean(player.cloudUid && player.cloudUid === app.authUser?.uid);
  const backAction = app.modal.returnModal ? 'back-to-profile' : 'close-modal';
  const history = stats.history.length
    ? `<div class="personal-game-list">${stats.history.map(({ game, seat, won }) => {
      const result = game.winner === 'draw' ? 'Нічия' : won ? 'Перемога' : 'Поразка';
      return `<article class="personal-game-card"><div class="personal-game-head"><div><h3>${esc(game.title)}</h3><p>${formatDate(game.endedAt || game.updatedAt, true)} · місце ${seat.number} · ${esc(roleLabel(seat.role))}</p></div><span class="badge ${won ? 'green' : game.winner === 'draw' ? 'gold' : 'red'}">${result}</span></div>${canRate ? gameFeedbackControls(game, app.gameFeedback[game.id]) : ''}<button class="btn small secondary personal-protocol-button" type="button" data-action="view-protocol" data-id="${esc(game.id)}">Протокол</button></article>`;
    }).join('')}</div>`
    : statePanel('empty', 'Ігор у профілі ще немає', 'Історія з’явиться, коли цей профіль буде додано до завершеної гри.');
  return `<div class="modal-backdrop player-stats-backdrop" data-action="close-modal"><div class="card modal player-stats-modal" role="dialog" aria-modal="true" aria-labelledby="player-stats-title" tabindex="-1">
    <div class="section-title section-heading"><div class="player-stats-title">${avatar(player, 'large')}<div><span class="eyebrow">Персональна статистика</span><h2 id="player-stats-title">${esc(preferredPlayerName(player))}</h2></div></div><button class="icon-btn" type="button" data-action="${backAction}" aria-label="${app.modal.returnModal ? 'Повернутися до профілю' : 'Закрити'}">${app.modal.returnModal ? backChevronIcon() : '×'}</button></div>
    <section class="stat-grid personal-stat-grid"><article class="stat-card"><b>${stats.games}</b><span>ігор</span></article><article class="stat-card"><b>${stats.wins}</b><span>перемог</span></article><article class="stat-card"><b>${stats.winRate}%</b><span>результативність</span></article><article class="stat-card"><b>${esc(stats.favoriteRole ? roleLabel(stats.favoriteRole) : '—')}</b><span>часта роль</span></article></section>
    ${canRate ? `<p class="privacy-note feedback-privacy-note">Ваш вибір бачите тільки ви. Іншим учасникам доступне лише спільне зведення після трьох оцінок.</p>` : ''}
    <div class="personal-history-title"><h3>Історія ігор</h3><span>${stats.games}</span></div>
    ${history}
  </div></div>`;
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
  const canNominate = nominationIsAllowed(app.game, seat.number, currentSpeaker()?.number);
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
  const settings = { ...app.game.settings, ...(app.modal.settingsDraft || {}) };
  const labels = {
    speech: 'Промова, сек', tieSpeech: 'Попіл, сек', lastWord: 'Останнє слово, сек',
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
  const bluetoothExpanded = app.modal?.view === 'bluetooth';
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
  const bluetoothChoiceDetail = CLIENT_PLATFORM === 'android'
    ? 'Відкрити системний список пристроїв'
    : CLIENT_PLATFORM === 'ios'
      ? 'Показати інструкцію для iPhone'
      : app.bluetooth.supported
        ? 'Вибрати доступний BLE-пристрій'
        : 'Показати системну інструкцію';
  const bluetoothChoice = CLIENT_PLATFORM === 'android'
    ? `<a class="media-choice bluetooth-choice android-bluetooth-menu-link" href="${ANDROID_BLUETOOTH_SETTINGS_URL}" rel="external">${mediaChoiceIcon('bluetooth')}<span><b>Підключити Bluetooth-пристрій</b><small>${bluetoothChoiceDetail}</small></span></a>`
    : `<button class="media-choice bluetooth-choice" type="button" data-action="${CLIENT_PLATFORM === 'ios' || !app.bluetooth.supported ? 'show-bluetooth-guide' : 'bluetooth-request'}" ${app.bluetooth.busy ? 'disabled' : ''}>${mediaChoiceIcon('bluetooth')}<span><b>Підключити Bluetooth-пристрій</b><small>${app.bluetooth.busy ? 'Відкриваємо список…' : bluetoothChoiceDetail}</small></span></button>`;
  const bluetoothPanel = bluetoothExpanded ? `<section class="media-panel-section bluetooth-detail-panel">
    <div class="compact-help-row"><b>Підключення Bluetooth</b>${helpIcon('На Android відкривається системний список Bluetooth. На iPhone вебсторінка не може відкрити цю системну панель, тому використовуйте Центр керування або Параметри. На ПК Web Bluetooth працює з BLE-пристроями, але не перемикає системний аудіовихід.', 'Як працює Bluetooth')}</div>
    ${statePanel(bluetoothKind, bluetoothTitle, bluetoothDetail, '', true)}
    <div class="ios-bluetooth-guide" role="note"><b>Швидко на iPhone</b><ol><li>Змахніть униз від правого верхнього кута, щоб відкрити Центр керування.</li><li>Для вже спареної колонки торкніть кнопку вибору аудіовиходу у блоці відтворення.</li><li>Для нової колонки відкрийте Параметри → Bluetooth і виберіть її назву.</li></ol></div>
    ${CLIENT_PLATFORM === 'android' ? `<a class="btn primary wide android-bluetooth-menu-link" href="${ANDROID_BLUETOOTH_SETTINGS_URL}" rel="external">Відкрити Bluetooth</a>` : app.bluetooth.supported ? `<button class="btn secondary wide" type="button" data-action="bluetooth-request" ${app.bluetooth.busy || app.bluetooth.available === false ? 'disabled' : ''}>${app.bluetooth.busy ? 'Відкриваємо список…' : 'Вибрати BLE-пристрій'}</button>` : ''}
  </section>` : '';
  const preparedTrack = app.media.trackName ? `<section class="media-panel-section prepared-media-panel">
    <div class="compact-help-row"><b>Музика в Mafia</b>${helpIcon('Play і Pause керують лише аудіофайлом, відкритим у Mafia. Іншими застосунками — Spotify, YouTube Music тощо — вебсторінка керувати не може.', 'Як працює керування музикою')}</div>
    ${statePanel(mediaKind, mediaTitle, mediaDetail, '', true)}
    <div class="media-transport-actions"><button class="btn primary" type="button" data-action="media-play" ${app.media.playing ? 'disabled' : ''}>${headerControlIcon('play')}<span>Play</span></button><button class="btn secondary" type="button" data-action="media-pause" ${!app.media.playing ? 'disabled' : ''}>${headerControlIcon('pause')}<span>Pause</span></button><button class="btn secondary" type="button" data-action="media-clear">Прибрати</button></div>
  </section>` : '';
  return `<div class="modal-backdrop media-backdrop" data-action="close-modal"><div id="media-panel" class="card modal media-modal" role="dialog" aria-modal="true" aria-labelledby="media-panel-title" tabindex="-1">
    <div class="section-title section-heading"><div><h2 id="media-panel-title">Bluetooth і музика</h2><p>Оберіть дію</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
    <div class="media-panel-stack">
      <div class="media-choice-grid">${bluetoothChoice}<label class="media-choice music-choice" for="music-file">${mediaChoiceIcon('music')}<span><b>Відкрити музику з пристрою</b><small>MP3, M4A, WAV та інші аудіофайли</small></span></label></div>
      <input id="music-file" class="visually-hidden" type="file" accept="audio/*" data-input="music-file">
      ${bluetoothPanel}
      ${preparedTrack}
      <p class="privacy-note media-note">Музика відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.</p>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Закрити</button></div>
  </div></div>`;
}

function orderDrinkIcon(key) {
  const paths = {
    coffee: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15M9 3c-1 1-.8 2 0 3m4-3c-1 1-.8 2 0 3"/>',
    tea: '<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15M11 8c0-3 2-5 5-5 0 3-2 5-5 5Z"/>',
    cappuccino: '<path d="M5 10h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15"/><path d="M7 9c0-2 2-3 3.5-1C12 6 14 7 14 9"/>',
    latte: '<path d="M7 4h10l-1 16H8L7 4Zm1 5h8M8 14h8M5 21h14M10 2h4"/>',
    espresso: '<path d="M6 10h10v3a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-3Zm10 1h2a2 2 0 0 1 0 4h-3M5 20h14M9 5c-1 1-.7 2 0 3m4-3c-1 1-.7 2 0 3"/>',
    cocoa: '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Zm11 2h2a2 2 0 0 1 0 4h-2M4 21h15M8 5c1-2 2-2 3 0 1-2 2-2 3 0"/>',
    cold_drink: '<path d="M7 3h10l-1 18H8L7 3Zm1 6h8M9 13h6M12 3l4-2"/>',
    dessert: '<path d="M5 18h14M7 18l1-8h8l1 8M9 10c0-3 6-3 6 0M12 6V3m-2 1h4"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.coffee}</svg>`;
}

function orderCategoryId(item) {
  const category = String(item?.category || '').toLowerCase();
  if (category === 'tea') return 'tea';
  if (['treats', 'dessert', 'food', 'other'].includes(category)) return 'treats';
  return 'coffee';
}

function orderCategoryLabel(category) {
  return category?.labels?.[app.settings.language] || category?.labels?.uk || category?.id || '';
}

function orderCategories(menu) {
  return ORDER_CATEGORIES.map(category => ({
    ...category,
    items: menu.filter(item => orderCategoryId(item) === category.id)
  })).filter(category => category.items.length);
}

function orderMenuLabel(item) {
  return item?.labels?.[app.settings.language] || item?.labels?.uk || item?.label || item?.id || '';
}

function orderMenuMeta(item, includePrice = true) {
  const parts = [];
  if (item?.volumeMl) parts.push(`${item.volumeMl} мл`);
  if (includePrice && item?.priceUah !== null && item?.priceUah !== undefined) parts.push(`${item.priceUah} грн`);
  return parts.join(' · ');
}

function orderOptionsHtml(item) {
  if (!item) return '';
  const options = app.orderMenu.options.filter(option => option.itemId === item.id);
  if (!options.length) return '';
  const groups = new Map();
  options.forEach(option => groups.set(option.group, [...(groups.get(option.group) || []), option]));
  const groupLabels = { size: 'Розмір', milk: 'Молоко', sugar: 'Цукор', extra: 'Додатково' };
  return `<div class="order-options"><div class="section-heading"><div><h3>${esc(orderMenuLabel(item))}</h3><p>Оберіть потрібні варіанти</p></div></div>${[...groups].map(([group, values]) => `<fieldset class="order-option-group"><legend>${esc(groupLabels[group] || group)}</legend><div class="order-option-list">${values.map(option => {
    const selected = app.order.selectedOptions?.includes(option.id);
    const price = option.priceDeltaUah ? `+${option.priceDeltaUah} грн` : '';
    return `<button class="order-option ${selected ? 'selected' : ''}" type="button" data-action="choose-order-option" data-group="${esc(group)}" data-option="${esc(option.id)}" aria-pressed="${selected}"><b>${esc(orderMenuLabel(option))}</b>${price ? `<small>${price}</small>` : ''}</button>`;
  }).join('')}</div></fieldset>`).join('')}<button class="btn primary wide order-confirm" type="button" data-action="place-order" data-item="${esc(item.id)}">Надіслати замовлення</button></div>`;
}

function orderModalHtml() {
  const order = app.order;
  const menu = app.orderMenu.items;
  const categories = orderCategories(menu);
  const selectedCategory = categories.find(category => category.id === order.category);
  const visibleItems = selectedCategory?.items || [];
  const selectedItem = menu.find(item => item.id === order.selectedItem);
  const lastLabel = orderMenuLabel(menu.find(item => item.id === order.lastItem));
  const status = order.status === 'success'
    ? statePanel('success', `«${lastLabel}» — замовлення надіслано`, 'Повідомлення передано в Telegram.', '', true)
    : order.status === 'error'
      ? statePanel('error', 'Замовлення не надіслано', order.error, '', true)
      : '';
  return `<div class="modal-backdrop order-backdrop" ${order.busy ? '' : 'data-action="close-modal"'}><div class="card modal order-modal" role="dialog" aria-modal="true" aria-labelledby="order-panel-title" aria-busy="${order.busy}">
    <div class="section-title section-heading"><div><span class="eyebrow">Кав’ярня Enjoy</span><h2 id="order-panel-title">Замовлення</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити" ${order.busy ? 'disabled' : ''}>×</button></div>
    <p class="order-intro">${selectedCategory ? 'Оберіть позицію — повідомлення відразу піде в Telegram.' : 'Оберіть категорію — потім потрібну позицію.'}</p>
    ${status}
    ${selectedCategory ? `<div class="order-category-heading"><button class="icon-btn order-category-back" type="button" data-action="back-order-categories" aria-label="До категорій" ${order.busy ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div>${orderDrinkIcon(selectedCategory.icon)}<h3>${esc(orderCategoryLabel(selectedCategory))}</h3></div></div>
    <div class="order-menu-grid">${visibleItems.map(item => {
      const hasOptions = app.orderMenu.options.some(option => option.itemId === item.id);
      const meta = orderMenuMeta(item);
      return `<button class="order-menu-item ${selectedItem?.id === item.id ? 'selected' : ''}" type="button" data-action="${hasOptions ? 'select-order-item' : 'place-order'}" data-item="${esc(item.id)}" ${order.busy ? 'disabled' : ''}>${orderDrinkIcon(item.icon)}<b>${esc(orderMenuLabel(item))}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</button>`;
    }).join('')}</div>
    ${orderOptionsHtml(selectedItem)}` : `<div class="order-category-grid">${categories.map(category => `<button class="order-category-item" type="button" data-action="select-order-category" data-category="${esc(category.id)}" ${order.busy ? 'disabled' : ''}>${orderDrinkIcon(category.icon)}<b>${esc(orderCategoryLabel(category))}</b></button>`).join('')}</div>`}
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal" ${order.busy ? 'disabled' : ''}>Закрити</button></div>
  </div></div>`;
}

function iosInstallModalHtml() {
  const primaryHost = 'mafia-cafe.web.app';
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const readyToInstall = location.hostname === primaryHost || localHost;
  const shareIcon = pwaInstallIcon('ios-guide');
  const homeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>';
  const addIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/></svg>';
  const guide = readyToInstall ? `<div class="ios-install-steps">
    <article><span class="ios-install-step-icon">${shareIcon}</span><span class="ios-install-step-number">1</span><div><b>Натисніть «Поділитися»</b><p>У Safari це квадрат зі стрілкою вгору.</p></div></article>
    <article><span class="ios-install-step-icon">${homeIcon}</span><span class="ios-install-step-number">2</span><div><b>Оберіть «На екран “Домівка”»</b><p>Якщо пункту немає, відкрийте цю сторінку в Safari.</p></div></article>
    <article><span class="ios-install-step-icon">${addIcon}</span><span class="ios-install-step-number">3</span><div><b>Натисніть «Додати»</b><p>Після цього запускайте Mafia Enjoy з нової іконки на екрані iPhone.</p></div></article>
  </div>` : `<div class="ios-install-origin">${stateIcon('idle')}<div><b>Відкрийте основну адресу</b><p>Для надійного Google-входу на iPhone встановлюйте застосунок із ${primaryHost}.</p></div></div><a class="btn primary wide" href="https://${primaryHost}/">Відкрити адресу для iPhone</a>`;
  return `<div class="modal-backdrop ios-install-backdrop" data-action="close-modal"><div class="card modal ios-install-modal" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" tabindex="-1">
    <div class="section-title section-heading"><div><span class="eyebrow">PWA · iPhone</span><h2 id="ios-install-title">Встановлення на iPhone</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
    <p class="ios-install-lead">Додайте Mafia Enjoy на головний екран — застосунок відкриватиметься без панелей браузера.</p>
    ${guide}
    <div class="modal-actions"><button class="btn primary" type="button" data-action="close-modal">Готово</button></div>
  </div></div>`;
}

function hostTransferModalHtml() {
  if (app.modal.type === 'host-transfer-incoming') {
    const transfer = app.hostTransfers.incoming.find(item => item.gameId === app.modal.gameId && item.status === 'pending');
    if (!transfer) return '';
    return `<div class="modal-backdrop host-transfer-backdrop"><div class="card modal host-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="host-transfer-title" tabindex="-1">
      <div class="game-dialog-head"><div><span class="eyebrow">Запит на передачу</span><h2 id="host-transfer-title">Стати ведучим гри?</h2></div></div>
      <div class="host-transfer-callout"><span class="host-transfer-symbol" aria-hidden="true">⇄</span><div><b>${esc(transfer.fromName)} передає вам ведення</b><p>${esc(transfer.gameTitle)}</p></div></div>
      <p class="game-dialog-copy">Після підтвердження ви отримаєте повний стан гри, ролі та панель ведучого. Попередній ведучий перейде в режим оглядача.</p>
      <div class="modal-actions"><button class="btn secondary" type="button" data-action="decline-host-transfer" ${app.hostTransfers.busy ? 'disabled' : ''}>Відхилити</button><button class="btn primary" type="button" data-action="accept-host-transfer" ${app.hostTransfers.busy ? 'disabled' : ''}>${app.hostTransfers.busy ? 'Приймаємо…' : 'Прийняти ведення'}</button></div>
    </div></div>`;
  }
  const pending = outgoingHostTransfer(app.game?.id);
  if (app.modal.type === 'host-transfer-waiting' || pending) {
    const transfer = pending || app.modal.transfer;
    return `<div class="modal-backdrop host-transfer-backdrop" data-action="close-modal"><div class="card modal host-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="host-transfer-title" tabindex="-1">
      <div class="game-dialog-head"><div><span class="eyebrow">Передача ведення</span><h2 id="host-transfer-title">Очікуємо підтвердження</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
      <div class="host-transfer-callout waiting"><span class="host-transfer-symbol" aria-hidden="true">…</span><div><b>${esc(transfer?.toName || 'Новий ведучий')}</b><p>Гра поставлена на паузу до відповіді.</p></div></div>
      <p class="game-dialog-copy">На пристрої обраного гравця вже з’явився запит. Після прийняття ви автоматично перейдете до перегляду гри.</p>
      <div class="modal-actions"><button class="btn danger" type="button" data-action="cancel-host-transfer" ${app.hostTransfers.busy ? 'disabled' : ''}>Скасувати передачу</button><button class="btn secondary" type="button" data-action="close-modal">Закрити</button></div>
    </div></div>`;
  }
  const search = String(app.modal.search || '');
  const allCandidates = hostTransferCandidates();
  const candidates = search ? hostTransferCandidates(search) : allCandidates;
  return `<div class="modal-backdrop host-transfer-backdrop" data-action="close-modal"><div class="card modal host-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="host-transfer-title" tabindex="-1">
    <div class="game-dialog-head"><div><span class="eyebrow">Панель ведучого</span><h2 id="host-transfer-title">Передати ведення</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити це вікно">×</button></div>
    <p class="game-dialog-copy">Оберіть будь-якого авторизованого користувача. Участь у поточній грі не обов’язкова; користувач має підтвердити запит на своєму пристрої.</p>
    <div class="host-transfer-search"><input class="input" type="search" data-input="host-transfer-search" value="${esc(search)}" placeholder="Пошук за ім’ям, ніком або клубом" aria-label="Пошук користувача" autocomplete="off"></div>
    ${candidates.length ? `<div class="host-transfer-candidates">${candidates.map(candidate => `<button class="host-transfer-candidate" type="button" data-action="request-host-transfer" data-uid="${esc(candidate.uid)}">${avatar({ name: candidate.name, avatar: candidate.avatar }, 'small')}<span><b>${esc(candidate.name)}</b><small>${esc(candidate.nickname && candidate.displayName ? candidate.displayName : candidate.club || 'Авторизований користувач')}</small></span><span class="host-transfer-chevron" aria-hidden="true">›</span></button>`).join('')}</div>` : allCandidates.length ? statePanel('empty', 'Нікого не знайдено', 'Спробуйте змінити пошуковий запит.') : statePanel('empty', 'Немає доступного нового ведучого', 'У каталозі немає іншого авторизованого користувача.')}
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Закрити</button></div>
  </div></div>`;
}

function venueModalHtml() {
  const venue = app.modal?.venue || {};
  const status = app.modal?.googleStatus
    ? `<p class="venue-google-status ${app.modal.googleStatusTone === 'error' ? 'error' : ''}" role="status">${esc(app.modal.googleStatus)}</p>`
    : '<p class="venue-google-status">Повне посилання Google Maps може підставити назву або адресу, якщо вони містяться в самому посиланні.</p>';
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal venue-modal" data-form="venue" role="dialog" aria-modal="true" aria-labelledby="venue-modal-title">
    <div class="section-title section-heading"><div><span class="eyebrow">Спільний каталог</span><h2 id="venue-modal-title">Нове місце / клуб</h2></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити" ${app.venueBusy ? 'disabled' : ''}>×</button></div>
    <p>Після збереження місце зможуть знайти й обрати всі авторизовані користувачі.</p>
    <div class="stack venue-form-fields">
      <div class="field"><label for="venue-name">Назва *</label><input id="venue-name" class="input" name="name" data-venue-field="name" value="${esc(venue.name)}" maxlength="60" required autocomplete="organization"></div>
      <div class="field"><label for="venue-google-url">Google Maps</label><div class="venue-map-row"><input id="venue-google-url" class="input" type="url" name="googleMapsUrl" data-venue-field="googleMapsUrl" data-input="venue-google-maps-url" value="${esc(venue.googleMapsUrl)}" maxlength="2048" placeholder="https://maps.app.goo.gl/…" inputmode="url"><button class="btn small secondary" type="button" data-action="fill-venue-from-google">Підставити</button></div>${status}</div>
      <div class="field"><label for="venue-address">Адреса</label><input id="venue-address" class="input" name="address" data-venue-field="address" value="${esc(venue.address)}" maxlength="300" autocomplete="street-address" placeholder="Можна ввести вручну"></div>
      <div class="field"><label for="venue-phone">Телефон</label><input id="venue-phone" class="input" type="tel" name="phone" data-venue-field="phone" value="${esc(venue.phone)}" maxlength="40" autocomplete="tel" placeholder="+380…"></div>
      <div class="field"><label for="venue-website">Сайт</label><input id="venue-website" class="input" type="url" name="website" data-venue-field="website" value="${esc(venue.website)}" maxlength="2048" inputmode="url" placeholder="https://…"></div>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal" ${app.venueBusy ? 'disabled' : ''}>Скасувати</button><button class="btn primary" type="submit" ${app.venueBusy ? 'disabled' : ''}>${app.venueBusy ? 'Зберігаємо…' : 'Зберегти місце'}</button></div>
  </form></div>`;
}

function discussionModalHtml() {
  const game = gameById(app.modal.gameId) || (app.game?.id === app.modal.gameId ? app.game : null);
  if (!game) return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal game-dialog-modal" role="dialog" aria-modal="true"><div class="section-title"><h2>Гру не знайдено</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div></div></div>`;
  const chat = gameChatForGame(game.id);
  const participants = authorizedGameParticipantUids(app.authUser, game);
  const authorizedSeats = authorizedGameSeats(game).length;
  const guests = Math.max(0, (game.seats || []).length - authorizedSeats);
  const telegram = telegramDiscussionLinks(game, appShareUrl());
  const appChatStatus = chat
    ? `<span class="badge green">Готовий · ${chat.participantUids.length} учасн.</span>`
    : app.gameChatsState.status === 'error'
      ? '<span class="badge red">Потрібне повторення</span>'
      : '<span class="badge gold">Створюється…</span>';
  return `<div class="modal-backdrop discussion-backdrop" data-action="close-modal"><div class="card modal discussion-modal" role="dialog" aria-modal="true" aria-labelledby="discussion-title" tabindex="-1">
    <div class="section-title section-heading"><div><span class="eyebrow">Гру завершено</span><h2 id="discussion-title">Де обговорити гру?</h2><p>${esc(game.title)} · ${formatDate(game.endedAt || game.updatedAt, true)}</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div>
    <div class="discussion-choice-grid">
      <article class="discussion-choice app-chat-choice"><div class="discussion-choice-head"><span class="discussion-choice-icon">${discussionIcon()}</span><div><h3>Чат у Mafia Enjoy</h3>${appChatStatus}</div></div><p>Створений разом із грою. Після фіналу всі авторизовані учасники столу вже мають доступ; приєднані глядачі залишаються в чаті.</p><div class="discussion-participant-note"><b>${participants.length}</b> авторизованих профілів${guests ? ` · ${guests} гостей без доступу` : ''}</div><button class="btn primary wide" type="button" data-action="open-app-game-chat" data-id="${esc(game.id)}" ${app.chatBusy ? 'disabled' : ''}>${app.chatBusy ? 'Готуємо чат…' : chat ? 'Відкрити чат' : 'Спробувати ще раз'}</button></article>
      <article class="discussion-choice telegram-choice"><div class="discussion-choice-head"><span class="discussion-choice-icon">${telegramIcon()}</span><div><h3>Група в Telegram</h3><span class="badge">Окремий чат</span></div></div><p>Telegram відкриє створення нової групи. З міркувань приватності застосунок не може сам додати Google-профілі як Telegram-контакти — ведучий обирає їх у Telegram.</p><div class="discussion-telegram-actions"><a class="btn primary wide" href="${esc(telegram.createGroup)}">Створити групу в Telegram</a><a class="btn secondary wide" href="${esc(telegram.share)}" target="_blank" rel="noopener noreferrer">Надіслати посилання через Telegram</a></div></article>
    </div>
    <div class="modal-actions"><button class="btn secondary" type="button" data-action="close-modal">Закрити</button></div>
  </div></div>`;
}

function formatChatMessageTime(value) {
  const date = new Date(Number(value) || 0);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(languageLocale(app.settings.language), sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function gameChatModalHtml() {
  const chat = gameChatById(app.modal.chatId);
  if (!chat) return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal game-chat-modal" role="dialog" aria-modal="true"><div class="section-title"><h2>Чат недоступний</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div><p>Оновіть список обговорень і спробуйте ще раз.</p></div></div>`;
  let messages;
  if (app.chatMessagesState.status === 'loading' || app.chatMessagesState.status === 'idle') {
    messages = statePanel('loading', 'Відкриваємо розмову…', '', '', true);
  } else if (app.chatMessagesState.status === 'error') {
    messages = statePanel('error', 'Повідомлення недоступні', app.chatMessagesState.error, '<button class="btn small secondary" data-action="retry-game-chat-messages">Повторити</button>', true);
  } else if (!app.chatMessages.length) {
    messages = statePanel('empty', 'Розмова ще порожня', 'Напишіть перше повідомлення про цю гру.', '', true);
  } else {
    messages = app.chatMessages.map(message => {
      const own = message.senderUid === app.authUser?.uid;
      return `<article class="chat-message ${own ? 'own' : ''} ${message.pending ? 'pending' : ''}"><div class="chat-message-meta"><b>${esc(message.senderName)}</b><time>${esc(formatChatMessageTime(message.createdAt))}${message.pending ? ' · надсилається' : ''}</time></div><p>${esc(message.text)}</p></article>`;
    }).join('');
  }
  return `<div class="modal-backdrop game-chat-backdrop" data-action="close-modal"><div class="card modal game-chat-modal" role="dialog" aria-modal="true" aria-labelledby="game-chat-title" tabindex="-1">
    <div class="section-title section-heading game-chat-head"><div><span class="eyebrow">${chat.status === 'active' ? 'Чат гри · наживо' : 'Обговорення гри'}</span><h2 id="game-chat-title">${esc(chat.gameTitle)}</h2><p>${chat.status === 'active' ? `Розпочато ${formatDate(chat.startedAt, true)}` : formatDate(chat.endedAt, true)}${chat.venue ? ` · ${esc(chat.venue)}` : ''} · ${chat.participantUids.length} учасн.</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div>
    <div class="game-chat-messages" data-chat-messages role="log" aria-live="polite">${messages}</div>
    <form class="game-chat-composer" data-form="game-chat-message"><div class="game-chat-emotion-bar" role="group" aria-label="Емоції для повідомлення">${GAME_CHAT_EMOTIONS.map(item => `<button class="game-chat-emotion-btn" type="button" data-action="insert-chat-emotion" data-value="${item.key}" aria-label="${esc(item.label)}" title="${esc(item.label)}" ${app.chatBusy ? 'disabled' : ''}><span aria-hidden="true">${item.icon}</span></button>`).join('')}</div><label class="sr-only" for="game-chat-message">Повідомлення</label><textarea id="game-chat-message" class="textarea" data-input="game-chat-message" maxlength="1000" rows="2" placeholder="Напишіть повідомлення…" ${app.chatBusy ? 'disabled' : ''}>${esc(app.chatDraft)}</textarea><button class="btn primary" type="submit" ${app.chatBusy || !app.chatDraft.trim() ? 'disabled' : ''}>${app.chatBusy ? 'Надсилаємо…' : 'Надіслати'}</button></form>
  </div></div>`;
}

function modalHtml() {
  if (!app.modal) return '';
  if (app.modal.type === 'player') return playerModalHtml();
  if (app.modal.type === 'player-avatar') return playerAvatarModalHtml();
  if (app.modal.type === 'host-profile') return hostProfileModalHtml();
  if (app.modal.type === 'player-stats') return playerStatsModalHtml();
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
  if (app.modal.type === 'venue') return venueModalHtml();
  if (app.modal.type === 'discussion') return discussionModalHtml();
  if (app.modal.type === 'game-chat') return gameChatModalHtml();
  if (app.modal.type === 'ios-install') return iosInstallModalHtml();
  if (app.modal.type.startsWith('host-transfer')) return hostTransferModalHtml();
  if (app.modal.type === 'winner') return `<div class="modal-backdrop"><div class="card modal game-modal decision-modal" role="dialog" aria-modal="true"><div class="game-dialog-head"><div><span class="eyebrow">Завершення гри</span>${titleHelp('h2', 'Результат гри', 'Ручне завершення потрібне для нестандартної ситуації, нічиєї або рішення судді.')}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div><p class="game-dialog-copy">Оберіть результат. Він одразу потрапить до протоколу та статистики.</p><div class="winner-choice-grid"><button class="btn primary winner-choice" data-action="finish-red"><span>●</span><strong>Мирне місто</strong><small>Червона команда</small></button><button class="btn danger winner-choice" data-action="finish-black"><span>◆</span><strong>Мафія</strong><small>Чорна команда</small></button><button class="btn secondary winner-choice winner-draw-choice" data-action="finish-draw"><span>＝</span><strong>Нічия</strong><small>Без переможця</small></button></div><div class="modal-actions"><button class="btn secondary" data-action="close-modal">Скасувати</button></div></div></div>`;
  return '';
}

const RENDER_FOCUS_ATTRIBUTES = Object.freeze([
  'id', 'name', 'data-input', 'data-action', 'data-draft', 'data-draft-setting',
  'data-seat-name', 'data-seat-profile', 'data-id', 'data-seat', 'data-panel',
  'data-value', 'data-music-cue', 'data-theme-choice', 'data-language'
]);

function modalRenderKey(modal = app.modal) {
  if (!modal?.type) return '';
  const identity = modal.chatId || modal.gameId || modal.playerId || modal.player?.id || modal.seat || '';
  return `${modal.type}:${identity || 'current'}`;
}

function renderFocusSelector(element) {
  if (!(element instanceof Element)) return '';
  const attributes = RENDER_FOCUS_ATTRIBUTES
    .filter(attribute => element.hasAttribute(attribute))
    .map(attribute => `[${attribute}="${String(element.getAttribute(attribute)).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    .join('');
  return attributes ? `${element.localName}${attributes}` : '';
}

function captureRenderUiState(nextModalKey) {
  const sameRoute = renderedRoute === app.route;
  const sameModal = renderedModalKey === nextModalKey;
  const activeElement = document.activeElement;
  const activeRoot = modalRoot.contains(activeElement) ? 'modal' : appRoot.contains(activeElement) ? 'app' : '';
  const canRestoreFocus = activeRoot === 'modal' ? sameModal && Boolean(nextModalKey) : activeRoot === 'app' ? sameRoute && !nextModalKey : false;
  const focusedControl = canRestoreFocus ? {
    root: activeRoot,
    selector: renderFocusSelector(activeElement),
    value: 'value' in activeElement ? activeElement.value : undefined,
    checked: 'checked' in activeElement ? activeElement.checked : undefined,
    selectionStart: typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : null,
    selectionEnd: typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : null
  } : null;
  const dialog = sameModal && nextModalKey ? modalRoot.querySelector('.modal') : null;
  const chatMessages = sameModal && nextModalKey ? modalRoot.querySelector('[data-chat-messages]') : null;
  return {
    sameRoute,
    sameModal,
    pageX: sameRoute ? window.scrollX : 0,
    pageY: sameRoute ? window.scrollY : 0,
    dialogScrollLeft: dialog?.scrollLeft || 0,
    dialogScrollTop: dialog?.scrollTop || 0,
    chatScroll: chatMessages ? {
      top: chatMessages.scrollTop,
      nearBottom: chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 48
    } : null,
    focusedControl
  };
}

function restoreRenderUiState(state, revision, nextModalKey) {
  const activeDialog = modalRoot.querySelector('.modal');
  if (activeDialog) {
    if (!activeDialog.hasAttribute('tabindex')) activeDialog.setAttribute('tabindex', '-1');
    if (state.sameModal) {
      activeDialog.scrollLeft = state.dialogScrollLeft;
      activeDialog.scrollTop = state.dialogScrollTop;
    } else {
      activeDialog.scrollTop = 0;
    }
  }

  const focusState = state.focusedControl;
  const focusRoot = focusState?.root === 'modal' ? modalRoot : appRoot;
  const focusTarget = focusState?.selector ? focusRoot.querySelector(focusState.selector) : null;
  if (focusTarget) {
    if (focusState.value !== undefined && 'value' in focusTarget) focusTarget.value = focusState.value;
    if (focusState.checked !== undefined && 'checked' in focusTarget) focusTarget.checked = focusState.checked;
    focusTarget.focus({ preventScroll: true });
    if (focusState.selectionStart !== null && typeof focusTarget.setSelectionRange === 'function') {
      focusTarget.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  } else if (activeDialog && (!state.sameModal || !focusState?.selector)) {
    activeDialog.focus({ preventScroll: true });
  }

  if (activeDialog && state.sameModal) activeDialog.scrollTop = state.dialogScrollTop;
  requestAnimationFrame(() => {
    if (revision !== renderRevision) return;
    if (state.sameRoute) window.scrollTo({ left: state.pageX, top: state.pageY, behavior: 'instant' });
    const messages = modalRoot.querySelector('[data-chat-messages]');
    if (!messages || modalRenderKey() !== nextModalKey) return;
    if (!state.sameModal || !state.chatScroll?.nearBottom) {
      messages.scrollTop = state.sameModal && state.chatScroll ? state.chatScroll.top : messages.scrollHeight;
    } else {
      messages.scrollTop = messages.scrollHeight;
    }
  });
}

function render() {
  passiveRenderPending = false;
  const revision = ++renderRevision;
  if (app.route !== 'observer') syncObserverTimer();
  if (!app.authReady) {
    appRoot.innerHTML = authLoadingView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'true');
    renderedRoute = app.route;
    renderedModalKey = '';
    return;
  }
  if (!app.authConfigured) {
    appRoot.innerHTML = firebaseSetupView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'false');
    renderedRoute = app.route;
    renderedModalKey = '';
    return;
  }
  if (!app.authUser) {
    appRoot.innerHTML = loginView();
    modalRoot.innerHTML = '';
    localizeDom(appRoot, app.settings.language);
    appRoot.setAttribute('aria-busy', 'false');
    renderedRoute = app.route;
    renderedModalKey = '';
    return;
  }
  showIncomingHostTransfer();
  showPlayerLinkOffer();
  const nextModalKey = modalRenderKey();
  const uiState = captureRenderUiState(nextModalKey);
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
  restoreRenderUiState(uiState, revision, nextModalKey);
  renderedRoute = app.route;
  renderedModalKey = nextModalKey;
  appRoot.setAttribute('aria-busy', 'false');
  syncObserverTimer();
  if (['game', 'reveal'].includes(app.route)) requestAnimationFrame(requestGameWakeLock);
  queueAutomaticMusicSync();
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
  const dealMode = app.draft.settings.dealMode === 'automatic' ? 'automatic' : 'number';
  const roleKeys = ROLE_DECK.map(role => role.key);
  const roles = dealMode === 'automatic' ? shuffled(roleKeys) : [];
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
      cloudUid: profile?.cloudUid || null,
      name: preferredPlayerName(profile) || draftSeat.name.trim() || missingGuestNames.shift(),
      avatar: profile?.avatar || profile?.avatarPreset || fallbackAvatars.get(setupAvatarKey(draftSeat, profile)) || ANIMAL_AVATARS[index % ANIMAL_AVATARS.length],
      role: dealMode === 'automatic' ? roles[index] : null,
      status: 'alive', faults: 0, nominatedBy: null, noVote: false,
      restrictionDay: null, shortSpeechDay: null, eliminatedReason: ''
    };
  });
  const startedAt = new Date();
  const timestamp = startedAt.toISOString();
  const title = app.draft.autoTitle !== false
    ? defaultGameTitle(startedAt, app.draft.venue)
    : app.draft.title.trim() || 'Гра в Мафію';
  return {
    id: uid('game'), title, venue: app.draft.venue.trim(), notes: app.draft.notes.trim(),
    ownerUid: app.authUser?.uid || '', hostName: String(app.hostProfile?.nickname || '').trim() || app.hostProfile?.displayName || app.authUser?.googleName || 'Ведучий',
    createdAt: timestamp, startedAt: timestamp, updatedAt: timestamp, endedAt: null,
    status: 'active', phase: 'reveal', subphase: '', day: 1, winner: null, durationSeconds: 0,
    settings: { ...app.draft.settings, dealMode, music: normalizeGameMusicSettings(app.draft.settings.music) }, seats, revealIndex: 0, revealOpen: false,
    ...(dealMode === 'number' ? { roleDeal: createNumberRoleDeal(roleKeys) } : {}),
    zeroNight: { step: 0 },
    speakerIndex: 0, speakerOrder: seats.map(seat => seat.number), nominations: [],
    vote: { counts: {}, tied: [], tieKey: '', tieRound: 0, yes: 0, no: 0 },
    night: { step: 0, target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    bestMove: { seat: null, selected: [] },
    timer: { remaining: app.draft.settings.speech, running: false, purpose: 'speech' },
    lastWordSeat: null, pendingLastWords: [], pendingWinner: null, afterNightKill: false, showSecrets: false,
    history: [{ at: timestamp, time: new Date(timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }), text: dealMode === 'number' ? 'Створено нову гру. Ролі роздаються за цифрами, які по черзі обирають гравці.' : 'Створено нову гру та автоматично розподілено ролі.', secret: true }]
  };
}

function publicGame(game) {
  if (!game) return null;
  const clean = clone(game);
  clean.seats.forEach(seat => { delete seat.role; delete seat.profileId; delete seat.cloudUid; });
  delete clean.roleDeal;
  clean.history = clean.history.filter(event => !event.secret);
  clean.night = { step: clean.night.step, target: clean.night.step >= 4 ? clean.night.target : null };
  delete clean.pendingWinner;
  clean.showSecrets = false;
  return clean;
}

function queueActiveGamePublish(game) {
  if (!app.authUser || LOCAL_AUTH_TEST || game?.status !== 'active' || game.publicOnly) return null;
  if (app.pendingActiveGameDeletes.includes(game.id)) return null;
  pendingActiveGames.set(game.id, { ...clone(game), ownerUid: app.authUser.uid });
  if (activeGamePublishPromise) return activeGamePublishPromise;
  if (activeGamePublishRetryHandle) {
    clearTimeout(activeGamePublishRetryHandle);
    activeGamePublishRetryHandle = null;
  }
  activeGamePublishPromise = (async () => {
    while (pendingActiveGames.size) {
      const [gameId, pending] = pendingActiveGames.entries().next().value;
      pendingActiveGames.delete(gameId);
      try {
        if (activeGameChatMembershipSyncs.has(gameId)) {
          await ensureActiveGameChat(pending);
          activeGameChatMembershipSyncs.delete(gameId);
          ensuredActiveGameChats.add(gameId);
        }
        await Promise.all([
          saveActiveCommunityGame(app.authUser, app.hostProfile, pending),
          saveActiveGameBackup(app.authUser, pending)
        ]);
        if (!ensuredActiveGameChats.has(gameId)) {
          try {
            await ensureActiveGameChat(pending);
            ensuredActiveGameChats.add(gameId);
          } catch (error) {
            app.gameChatsState = { status: 'error', error: error?.message || 'Не вдалося автоматично створити чат гри' };
            console.error(error);
          }
        }
      } catch (error) {
        pendingActiveGames.set(gameId, pending);
        app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
        activeGamePublishRetryHandle = setTimeout(() => {
          activeGamePublishRetryHandle = null;
          const next = pendingActiveGames.values().next().value;
          if (next && navigator.onLine) queueActiveGamePublish(next);
        }, 5000);
        renderPassiveCloudUpdate();
        break;
      }
    }
  })().finally(() => {
    activeGamePublishPromise = null;
    if (pendingActiveGames.size && !activeGamePublishRetryHandle) queueActiveGamePublish(pendingActiveGames.values().next().value);
  });
  return activeGamePublishPromise;
}

async function waitForActiveGamePublish(gameId, timeoutMs = 8000) {
  const publish = activeGamePublishPromise;
  if (!publish) return !pendingActiveGames.has(gameId);
  let timeoutHandle;
  await Promise.race([
    publish,
    new Promise(resolve => { timeoutHandle = setTimeout(resolve, timeoutMs); })
  ]);
  clearTimeout(timeoutHandle);
  return !pendingActiveGames.has(gameId);
}

async function flushActiveGamePublish(gameId) {
  pendingActiveGames.delete(gameId);
  while (activeGamePublishPromise) await activeGamePublishPromise;
  pendingActiveGames.delete(gameId);
  if (!pendingActiveGames.size && activeGamePublishRetryHandle) {
    clearTimeout(activeGamePublishRetryHandle);
    activeGamePublishRetryHandle = null;
  }
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

async function recoverOwnedActiveGame(publicGame, { force = false } = {}) {
  if (!publicGame?.publicOnly || !ownsCloudGame(publicGame) || !app.authUser) return publicGame;
  const existing = app.localGames.find(game => game.id === publicGame.id && !game.publicOnly);
  if (existing) return existing;
  const recoveryKey = `${publicGame.id}:${publicGame.updatedAt || ''}`;
  if (!force && activeGameRecoveryAttempts.has(recoveryKey)) return null;
  activeGameRecoveryAttempts.add(recoveryKey);
  const backup = await loadActiveGameBackup(app.authUser, publicGame.id);
  if (!backup) return null;
  const recovered = normalizeGameState({
    ...backup,
    ownerUid: app.authUser.uid,
    cloudOwnerUid: app.authUser.uid,
    cloudHostName: publicGame.cloudHostName || backup.hostName || '',
    shared: true,
    source: 'private-backup'
  }, DEFAULT_SETTINGS, { closeReveal: true });
  delete recovered.publicOnly;
  recovered.seats.forEach(seat => {
    if (seat.avatar) return;
    const player = seat.profileId ? playerById(seat.profileId) : null;
    seat.avatar = player?.avatar || player?.avatarPreset || '';
  });
  const errors = gameStateErrors(recovered);
  if (errors.length) throw new Error(`Приватну копію гри пошкоджено: ${errors[0]}`);
  await putOne('games', recovered);
  app.localGames = [...app.localGames.filter(game => game.id !== recovered.id), clone(recovered)];
  mergeGameSources();
  if (!app.game || app.game.id === recovered.id) app.game = recovered;
  renderPassiveCloudUpdate();
  return recovered;
}

function restoreOwnedActiveGames(games = app.cloudGames) {
  games
    .filter(game => game.status === 'active' && game.publicOnly && ownsCloudGame(game))
    .forEach(game => { void recoverOwnedActiveGame(game).catch(() => {}); });
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

function updateGameTimerDisplay() {
  if (!app.game || !['game', 'observer'].includes(app.route)) return;
  document.querySelectorAll('.game-page .timer').forEach(timer => {
    timer.textContent = formatTimer(app.game.timer.remaining);
    timer.classList.toggle('danger', app.game.timer.remaining <= 10);
  });
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
    const completed = app.game.timer.remaining === 0;
    if (completed) {
      stopTimer();
      announceTimerEnd();
    }
    if (app.game.timer.remaining % 5 === 0) await saveGame();
    if (completed) render();
    else updateGameTimerDisplay();
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
  if (app.game.nominations.includes(number)) return toast('Гравця вже виставлено');
  if (app.game.seats.some(seat => seat.nominatedBy === speaker.number)) return toast('Поточний гравець уже зробив номінацію');
  if (!nominationIsAllowed(app.game, number, speaker.number)) return;
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
    addLog(`Попіл: ${resolution.tied.map(number => `№${number}`).join(', ')}.`);
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
    numbers.forEach(number => eliminateSeatOnly(number, 'попіл'));
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

function captureManualPlayerDraft() {
  const form = document.querySelector('[data-form="player"]');
  if (!form || app.modal?.type !== 'player') return;
  const data = new FormData(form);
  app.modal.player = {
    ...app.modal.player,
    name: String(data.get('name') || ''),
    nickname: String(data.get('nickname') || ''),
    email: String(data.get('email') || ''),
    contact: String(data.get('contact') || ''),
    notes: String(data.get('notes') || '')
  };
}

function captureHostProfileDraft() {
  const form = document.querySelector('[data-form="host-profile"]');
  if (!form || app.modal?.type !== 'host-profile') return;
  const data = new FormData(form);
  const current = { ...(app.hostProfile || {}), ...(app.modal.profileDraft || {}) };
  const enteredTelegram = normalizeTelegramUsername(data.get('telegramUsername'));
  const telegram = enteredTelegram === normalizeTelegramUsername(current.telegramUsername)
    ? {
      telegramUsername: current.telegramUsername || '',
      telegramUserId: current.telegramUserId || '',
      telegramDisplayName: current.telegramDisplayName || '',
      telegramPhotoURL: current.telegramPhotoURL || '',
      telegramVerified: current.telegramVerified === true && Boolean(current.telegramUserId) && Boolean(current.telegramLinkedAt),
      telegramLinkedAt: current.telegramLinkedAt || ''
    }
    : telegramManualProfile(enteredTelegram);
  app.modal.profileDraft = {
    ...(app.modal.profileDraft || {}),
    displayName: String(data.get('displayName') || ''),
    nickname: String(data.get('nickname') || ''),
    club: String(data.get('club') || ''),
    description: String(data.get('description') || ''),
    discoverable: data.get('discoverable') === 'on',
    ...telegram
  };
}

function captureGameSettingsDraft() {
  const form = document.querySelector('[data-form="game-settings"]');
  if (!form || app.modal?.type !== 'game-settings') return;
  const data = new FormData(form);
  app.modal.settingsDraft = {
    ...(app.modal.settingsDraft || {}),
    ...Object.fromEntries(['speech', 'tieSpeech', 'lastWord', 'nightCheck', 'mafiaMeet', 'sheriffMark', 'freeSeating', 'bestMove']
      .map(key => [key, Math.max(5, Math.min(180, Number(data.get(key)) || DEFAULT_SETTINGS[key]))])),
    penaltyMode: data.get('penaltyMode') === 'club' ? 'club' : 'tournament'
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
    telegramUsername: normalizeTelegramUsername(stored?.telegramUsername),
    telegramUserId: stored?.telegramVerified === true ? String(stored?.telegramUserId || '') : '',
    telegramDisplayName: stored?.telegramVerified === true ? String(stored?.telegramDisplayName || '') : '',
    telegramPhotoURL: stored?.telegramVerified === true ? String(stored?.telegramPhotoURL || '') : '',
    telegramVerified: stored?.telegramVerified === true && Boolean(stored?.telegramUserId) && Boolean(stored?.telegramLinkedAt),
    telegramLinkedAt: stored?.telegramVerified === true ? String(stored?.telegramLinkedAt || '') : '',
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

function venueDirectoryError(error) {
  if (error?.code === 'permission-denied') return 'Немає доступу до каталогу місць. Перевірте Google-вхід.';
  if (!navigator.onLine || error?.code === 'unavailable') return 'Немає мережі: нові місця тимчасово недоступні.';
  return 'Не вдалося синхронізувати каталог місць.';
}

async function connectVenueDirectory() {
  if (!app.authUser) return;
  if (LOCAL_AUTH_TEST) {
    app.venueDirectory = { status: 'online', error: '', fromCache: false };
    return;
  }
  if (venueDirectoryPromise) return venueDirectoryPromise;
  app.venueDirectory = { status: 'loading', error: '', fromCache: false };
  renderPassiveCloudUpdate();
  venueDirectoryPromise = subscribeCommunityVenues((venues, metadata) => {
    app.venues = venues;
    app.venueDirectory = {
      status: metadata.fromCache && !navigator.onLine ? 'offline' : 'online',
      error: '',
      fromCache: metadata.fromCache
    };
    renderPassiveCloudUpdate();
  }, error => {
    venueDirectoryPromise = null;
    app.venueDirectory = { status: 'error', error: venueDirectoryError(error), fromCache: false };
    renderPassiveCloudUpdate();
  });
  try { await venueDirectoryPromise; }
  catch (error) {
    venueDirectoryPromise = null;
    app.venueDirectory = { status: 'error', error: venueDirectoryError(error), fromCache: false };
    renderPassiveCloudUpdate();
  }
}

function stopProfilePresence() {
  clearInterval(profilePresenceHandle);
  profilePresenceHandle = null;
}

async function publishProfilePresence() {
  if (!app.authUser || LOCAL_AUTH_TEST || !navigator.onLine || document.hidden) return;
  try {
    await touchOwnCommunityProfilePresence(app.authUser);
  } catch {
    // Presence is best-effort and must never interrupt local gameplay.
  }
}

function startProfilePresence() {
  stopProfilePresence();
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  profilePresenceHandle = setInterval(() => {
    void publishProfilePresence();
    if (app.route === 'players') render();
  }, PROFILE_PRESENCE_HEARTBEAT_MS);
}

async function connectCloudDirectory({ hasLocalProfile = true } = {}) {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  if (cloudDirectoryPromise) return cloudDirectoryPromise;
  app.cloudDirectory = { status: 'loading', error: '', fromCache: false };
  if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'syncing' };
  renderPassiveCloudUpdate();
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
        telegramUsername: remote.telegramUsername || '',
        telegramUserId: remote.telegramUserId || '',
        telegramDisplayName: remote.telegramDisplayName || '',
        telegramPhotoURL: remote.telegramPhotoURL || '',
        telegramVerified: remote.telegramVerified === true,
        telegramLinkedAt: remote.telegramLinkedAt || '',
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
      renderPassiveCloudUpdate();
    }, error => {
      if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'error' };
      app.cloudDirectory = { status: 'error', error: cloudDirectoryError(error), fromCache: false };
      renderPassiveCloudUpdate();
    });
    startProfilePresence();
    syncSharedManualPlayers().catch(() => {});
  })();
  try {
    await cloudDirectoryPromise;
  } catch (error) {
    if (app.hostProfile?.avatar) app.profilePhotoSync = { status: 'error' };
    app.cloudDirectory = { status: 'error', error: cloudDirectoryError(error), fromCache: false };
    renderPassiveCloudUpdate();
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

function showIncomingHostTransfer() {
  const transfer = pendingIncomingHostTransfer();
  if (!app.modal && transfer) app.modal = { type: 'host-transfer-incoming', gameId: transfer.gameId };
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

async function handleAcceptedOutgoingHostTransfer(transfer) {
  const key = `${transfer.gameId}:${transfer.toUid}:${transfer.acceptedAt || transfer.updatedAt}`;
  if (handledHostTransfers.has(key)) return;
  handledHostTransfers.add(key);
  const localGame = app.localGames.find(game => game.id === transfer.gameId);
  const currentGame = app.game?.id === transfer.gameId ? app.game : localGame;
  if (currentGame && !currentGame.publicOnly) {
    if (app.game?.id === transfer.gameId) stopTimer();
    pendingActiveGames.delete(transfer.gameId);
    await deleteOne('games', transfer.gameId);
    app.localGames = app.localGames.filter(game => game.id !== transfer.gameId);
  }
  try { await deleteActiveGameBackup(app.authUser, transfer.gameId); } catch { /* The old private copy is inaccessible to everyone else. */ }
  app.cloudGames = app.cloudGames.map(game => game.id === transfer.gameId ? {
    ...game,
    cloudOwnerUid: transfer.toUid,
    cloudHostName: transfer.toName
  } : game);
  mergeGameSources();
  let observerGame = gameById(transfer.gameId);
  if (!observerGame && currentGame) observerGame = {
    ...publicGame(currentGame),
    cloudOwnerUid: transfer.toUid,
    cloudHostName: transfer.toName,
    shared: true,
    publicOnly: true,
    source: 'cloud-live'
  };
  if (observerGame) {
    observerGame = { ...observerGame, cloudOwnerUid: transfer.toUid, cloudHostName: transfer.toName, publicOnly: true };
    app.game = observerGame;
  }
  app.undo = [];
  app.modal = null;
  try { await resolveGameHostTransfer(app.authUser, transfer.gameId); } catch { /* Cleanup will retry on the next session. */ }
  if (observerGame) navigate(`observer/${transfer.gameId}`);
  else navigate('home');
  render();
  toast(`Ведення передано · ${transfer.toName}`);
}

async function connectHostTransfers() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  await subscribeGameHostTransfers(app.authUser, transfers => {
    app.hostTransfers = { ...app.hostTransfers, ...transfers, error: '' };
    if (app.modal?.type === 'host-transfer-incoming' && !pendingIncomingHostTransfer()) app.modal = null;
    if (app.modal?.type === 'host-transfer-waiting' && !outgoingHostTransfer(app.game?.id) && !app.hostTransfers.busy) {
      app.modal = null;
      toast('Запит на передачу більше не активний');
    }
    transfers.outgoing
      .filter(transfer => transfer.status === 'accepted')
      .forEach(transfer => { void handleAcceptedOutgoingHostTransfer(transfer).catch(() => {}); });
    showIncomingHostTransfer();
    if (pendingIncomingHostTransfer() || outgoingHostTransfer(app.game?.id)) render();
    else renderPassiveCloudUpdate();
  }, error => {
    app.hostTransfers = { ...app.hostTransfers, error: error?.message || 'Не вдалося синхронізувати передачу ведення' };
    renderPassiveCloudUpdate();
  });
}

function cloudArchiveError(error) {
  if (error?.code === 'permission-denied') return 'Немає доступу до спільних ігор. Перевірте Google-вхід.';
  if (!navigator.onLine || error?.code === 'unavailable') return 'Немає мережі: показано збережену офлайн-копію ігор.';
  return 'Не вдалося синхронізувати ігри Enjoy.';
}

function renderPassiveCloudUpdate() {
  const hostingOwnGame = ['game', 'reveal'].includes(app.route)
    && app.game
    && !app.game.publicOnly
    && canManageGame(app.game);
  if (hostingOwnGame) return;
  const activeElement = document.activeElement;
  const editing = activeElement instanceof Element
    && (activeElement.matches('input, textarea, select, [contenteditable="true"]') || activeElement.isContentEditable)
    && (appRoot.contains(activeElement) || modalRoot.contains(activeElement));
  if (editing) {
    passiveRenderPending = true;
    return;
  }
  render();
}

async function publishFinishedGame(game) {
  if (!app.authUser || game?.status !== 'finished') return false;
  if (LOCAL_AUTH_TEST) {
    await ensureFinishedGameChat(game);
    return false;
  }
  await flushActiveGamePublish(game.id);
  const saved = await saveFinishedCommunityGame(app.authUser, app.hostProfile, game);
  try {
    await ensureFinishedGameChat(game);
  } catch (error) {
    app.gameChatsState = { status: 'error', error: error?.message || 'Не вдалося автоматично створити чат гри' };
    console.error(error);
  }
  await deleteActiveCommunityGame(app.authUser, game.id);
  await deleteActiveGameBackup(app.authUser, game.id);
  return saved;
}

function upsertGameChat(chat) {
  app.gameChats = [chat, ...app.gameChats.filter(item => item.id !== chat.id)]
    .sort((left, right) => String(right.endedAt || right.startedAt).localeCompare(String(left.endedAt || left.startedAt)));
}

async function ensureActiveGameChat(game) {
  if (!app.authUser || game?.status !== 'active') return null;
  const chat = LOCAL_AUTH_TEST
    ? { ...createGameChatDocument(app.authUser, app.hostProfile, game), createdAt: Date.now() }
    : await ensureGameChat(app.authUser, app.hostProfile, game);
  upsertGameChat(chat);
  app.gameChatsState = { status: 'online', error: '' };
  return chat;
}

async function ensureFinishedGameChat(game) {
  if (!app.authUser || game?.status !== 'finished') return null;
  const chat = LOCAL_AUTH_TEST
    ? { ...createGameChatDocument(app.authUser, app.hostProfile, game), createdAt: Date.now() }
    : await ensureGameChat(app.authUser, app.hostProfile, game);
  upsertGameChat(chat);
  ensuredActiveGameChats.delete(game.id);
  activeGameChatMembershipSyncs.delete(game.id);
  app.gameChatsState = { status: 'online', error: '' };
  return chat;
}

async function connectGameChats() {
  if (!app.authUser) return;
  if (LOCAL_AUTH_TEST) {
    app.gameChatsState = { status: 'online', error: '' };
    return;
  }
  if (gameChatsPromise) return gameChatsPromise;
  app.gameChatsState = { status: 'loading', error: '' };
  renderPassiveCloudUpdate();
  gameChatsPromise = subscribeGameChats(app.authUser, chats => {
    app.gameChats = chats;
    app.gameChatsState = { status: 'online', error: '' };
    renderPassiveCloudUpdate();
  }, error => {
    gameChatsPromise = null;
    app.gameChatsState = { status: 'error', error: error?.message || 'Не вдалося завантажити обговорення ігор' };
    renderPassiveCloudUpdate();
  });
  return gameChatsPromise;
}

function reconnectGameChats() {
  stopGameChats();
  gameChatsPromise = null;
  return connectGameChats();
}

async function connectGameChatMessages(chatId) {
  app.chatMessages = [];
  app.chatMessagesState = { status: 'loading', error: '' };
  render();
  if (LOCAL_AUTH_TEST) {
    app.chatMessagesState = { status: 'online', error: '' };
    render();
    return;
  }
  await subscribeGameChatMessages(app.authUser, chatId, messages => {
    app.chatMessages = messages;
    app.chatMessagesState = { status: 'online', error: '' };
    if (app.modal?.type === 'game-chat' && app.modal.chatId === chatId) render();
  }, error => {
    app.chatMessagesState = { status: 'error', error: error?.message || 'Не вдалося завантажити повідомлення' };
    if (app.modal?.type === 'game-chat' && app.modal.chatId === chatId) render();
  });
}

async function openGameChat(chat) {
  if (!chat || !chat.participantUids.includes(app.authUser?.uid)) return toast('Цей чат доступний лише учасникам гри');
  stopGameChatMessages();
  app.chatDraft = '';
  app.chatMessages = [];
  app.chatMessagesState = { status: 'loading', error: '' };
  app.modal = { type: 'game-chat', chatId: chat.id };
  render();
  await connectGameChatMessages(chat.id);
}

async function openAppGameChat(gameId) {
  let chat = gameChatForGame(gameId);
  const game = gameById(gameId) || (app.game?.id === gameId ? app.game : null);
  if (!game) return toast('Гру не знайдено');
  if (game.status === 'active' && !canJoinActiveGameChat(app.authUser, game)) {
    return toast('Активні гравці отримають доступ до чату після вибуття або завершення гри');
  }
  if (!chat || !chat.participantUids.includes(app.authUser?.uid)) {
    app.chatBusy = true;
    render();
    try {
      if (canManageGame(game)) {
        chat = game.status === 'active' ? await ensureActiveGameChat(game) : await ensureFinishedGameChat(game);
      } else if (LOCAL_AUTH_TEST) {
        chat = { ...createGameChatDocument(app.authUser, app.hostProfile, game), participantUids: [app.authUser.uid], createdAt: Date.now() };
        upsertGameChat(chat);
      } else {
        chat = await joinGameChat(app.authUser, game.id);
        upsertGameChat(chat);
      }
    } catch (error) {
      toast(error?.message || 'Не вдалося приєднатися до чату гри');
    } finally {
      app.chatBusy = false;
      render();
    }
  }
  if (chat) await openGameChat(chat);
}

async function sendCurrentGameChatMessage() {
  const chat = app.modal?.type === 'game-chat' ? gameChatById(app.modal.chatId) : null;
  const text = app.chatDraft.trim();
  if (!chat || !text || app.chatBusy) return;
  app.chatBusy = true;
  render();
  try {
    if (LOCAL_AUTH_TEST) {
      app.chatMessages.push({
        id: uid('message'), gameId: chat.gameId, senderUid: app.authUser.uid,
        senderName: String(app.hostProfile?.nickname || app.hostProfile?.displayName || app.authUser.googleName || 'Гравець'),
        text: text.slice(0, 1000), createdAt: Date.now(), pending: false
      });
      app.chatMessagesState = { status: 'online', error: '' };
    } else {
      await sendGameChatMessage(app.authUser, app.hostProfile, chat.id, text);
    }
    app.chatDraft = '';
  } catch (error) {
    toast(error?.message || 'Не вдалося надіслати повідомлення');
  } finally {
    app.chatBusy = false;
    render();
  }
}

function localActiveGameCandidates({ includePendingDeletes = false } = {}) {
  const candidates = new Map(
    app.localGames
      .filter(game => game?.status === 'active' && !game.publicOnly)
      .map(game => [game.id, game])
  );
  if (app.game?.status === 'active' && !app.game.publicOnly) candidates.set(app.game.id, app.game);
  return [...candidates.values()].filter(game => includePendingDeletes || !app.pendingActiveGameDeletes.includes(game.id));
}

function syncLocalActiveGames() {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  localActiveGameCandidates().forEach(queueActiveGamePublish);
}

async function publishLocalActiveGamesNow() {
  if (!app.authUser || LOCAL_AUTH_TEST) return 0;
  const candidates = localActiveGameCandidates({ includePendingDeletes: true });
  if (!candidates.length) return 0;
  const candidateIds = new Set(candidates.map(game => game.id));
  const retainedDeletes = app.pendingActiveGameDeletes.filter(gameId => !candidateIds.has(gameId));
  if (retainedDeletes.length !== app.pendingActiveGameDeletes.length) {
    app.pendingActiveGameDeletes = retainedDeletes;
    await setSetting('pendingActiveGameDeletes', retainedDeletes);
  }
  for (const game of candidates) {
    await flushActiveGamePublish(game.id);
    const state = { ...clone(game), ownerUid: app.authUser.uid };
    await Promise.all([
      saveActiveCommunityGame(app.authUser, app.hostProfile, state),
      saveActiveGameBackup(app.authUser, state)
    ]);
  }
  return candidates.length;
}

async function syncLocalFinishedGames(remoteGames = app.cloudGames, deletedGameIds = app.deletedGameIds) {
  if (!app.authUser || LOCAL_AUTH_TEST) return;
  const deleted = new Set(deletedGameIds || []);
  const remoteById = new Map(remoteGames.map(game => [game.id, game]));
  const pending = app.localGames.filter(game => {
    if (game.status !== 'finished') return false;
    if (deleted.has(game.id)) return false;
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
  renderPassiveCloudUpdate();
  cloudArchiveMigrationStarted = false;
  cloudArchivePromise = subscribeCommunityGames((games, metadata) => {
    app.deletedGameIds = metadata.deletedGameIds || [];
    const deleted = new Set(app.deletedGameIds);
    const removedLocalIds = app.localGames
      .filter(game => game.status === 'finished' && deleted.has(game.id))
      .map(game => game.id);
    if (removedLocalIds.length) {
      app.localGames = app.localGames.filter(game => !removedLocalIds.includes(game.id));
      if (app.game?.status === 'finished' && deleted.has(app.game.id)) app.game = null;
      void Promise.all(removedLocalIds.map(gameId => deleteOne('games', gameId))).catch(() => {});
    }
    const transferredAwayIds = app.localGames
      .filter(localGame => localGame.status === 'active'
        && games.some(remoteGame => remoteGame.id === localGame.id
          && remoteGame.status === 'active'
          && remoteGame.cloudOwnerUid
          && remoteGame.cloudOwnerUid !== app.authUser?.uid))
      .map(game => game.id);
    if (transferredAwayIds.length) {
      transferredAwayIds.forEach(gameId => pendingActiveGames.delete(gameId));
      app.localGames = app.localGames.filter(game => !transferredAwayIds.includes(game.id));
      void Promise.all(transferredAwayIds.map(gameId => deleteOne('games', gameId))).catch(() => {});
    }
    app.cloudGames = games;
    mergeGameSources();
    if (app.game && transferredAwayIds.includes(app.game.id)) app.game = gameById(app.game.id) || null;
    restoreOwnedActiveGames(games);
    const routed = routeFromHash();
    if (routed.id && ['observer', 'game'].includes(routed.route)) {
      const routedGame = gameById(routed.id);
      if (routedGame) app.game = routedGame;
    }
    app.cloudArchive = {
      status: metadata.error ? 'error' : !metadata.ready ? 'loading' : metadata.fromCache && !navigator.onLine ? 'offline' : 'online',
      error: metadata.error ? cloudArchiveError(metadata.error) : '',
      fromCache: metadata.fromCache
    };
    renderPassiveCloudUpdate();
    if (app.route === 'stats') void loadStatsGameFeedback(games.filter(game => game.status === 'finished'));
    if (metadata.ready && !cloudArchiveMigrationStarted) {
      cloudArchiveMigrationStarted = true;
      syncLocalActiveGames();
      syncLocalFinishedGames(games, app.deletedGameIds).catch(error => {
        app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: metadata.fromCache };
        renderPassiveCloudUpdate();
      });
    }
  }, error => {
    app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
    renderPassiveCloudUpdate();
  });
  try {
    await cloudArchivePromise;
  } catch (error) {
    app.cloudArchive = { status: 'error', error: cloudArchiveError(error), fromCache: false };
    renderPassiveCloudUpdate();
  } finally {
    cloudArchivePromise = null;
  }
}

async function reconnectCloudArchive() {
  stopCommunityGames();
  cloudArchivePromise = null;
  cloudArchiveMigrationStarted = false;
  return connectCloudArchive();
}

async function loadPersonalGameFeedback(playerId) {
  if (playerId !== `google_${app.authUser?.uid || ''}`) return;
  const history = personalPlayerStats(finishedGames(), playerId).history.slice(0, 25);
  const pending = history.filter(({ game }) => !app.gameFeedback[game.id]?.data);
  if (!pending.length) return;
  pending.forEach(({ game }) => { app.gameFeedback[game.id] = { status: 'loading', data: null, error: '' }; });
  render();
  let idToken = '';
  try {
    idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
  } catch (error) {
    pending.forEach(({ game }) => { app.gameFeedback[game.id] = { status: 'error', data: null, error: error.message }; });
    render();
    return;
  }
  try {
    const ratings = await loadGameFeedbackBatch({ idToken, gameIds: pending.map(({ game }) => game.id), testMode: LOCAL_AUTH_TEST });
    pending.forEach(({ game }) => {
      app.gameFeedback[game.id] = ratings[game.id]
        ? { status: 'ready', data: ratings[game.id], error: '' }
        : { status: 'error', data: null, error: 'Оцінка недоступна' };
    });
  } catch (error) {
    pending.forEach(({ game }) => { app.gameFeedback[game.id] = { status: 'error', data: null, error: error.message || 'Оцінка недоступна' }; });
  }
  if (app.modal?.type === 'player-stats' && app.modal.playerId === playerId) render();
}

async function loadStatsGameFeedback(games = finishedGames()) {
  if (!app.authUser || app.route !== 'stats') return;
  const pendingGames = games.filter(game => !app.gameFeedbackSummaries[game.id]);
  if (!pendingGames.length) return;
  pendingGames.forEach(game => { app.gameFeedbackSummaries[game.id] = { status: 'loading', summary: null, error: '' }; });
  render();
  let idToken = '';
  try {
    idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
  } catch (error) {
    pendingGames.forEach(game => { app.gameFeedbackSummaries[game.id] = { status: 'error', summary: null, error: error.message }; });
    if (app.route === 'stats') render();
    return;
  }
  for (let index = 0; index < pendingGames.length; index += 25) {
    const batch = pendingGames.slice(index, index + 25);
    try {
      const summaries = await loadGameFeedbackSummaryBatch({ idToken, gameIds: batch.map(game => game.id), testMode: LOCAL_AUTH_TEST });
      batch.forEach(game => {
        app.gameFeedbackSummaries[game.id] = summaries[game.id]
          ? { status: 'ready', summary: summaries[game.id], error: '' }
          : { status: 'error', summary: null, error: 'Оцінки недоступні' };
      });
    } catch (error) {
      batch.forEach(game => { app.gameFeedbackSummaries[game.id] = { status: 'error', summary: null, error: error.message || 'Оцінки недоступні' }; });
    }
  }
  if (app.route === 'stats') render();
}

async function updatePersonalGameFeedback(gameId, field, value) {
  const game = gameById(gameId);
  const playerId = `google_${app.authUser?.uid || ''}`;
  const participated = game?.status === 'finished' && game.seats?.some(seat => seat.profileId === playerId);
  if (!participated) throw new Error('Оцінювати гру можуть лише її учасники');
  const previous = app.gameFeedback[gameId]?.data || {
    mine: { sentiment: '', emotion: '' },
    summary: { visible: false, total: 0, sentiment: { up: 0, down: 0 }, emotions: {} }
  };
  const vote = { ...previous.mine, [field]: value };
  app.gameFeedback[gameId] = { status: 'saving', data: { ...previous, mine: vote }, error: '' };
  render();
  try {
    const idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
    const data = await saveGameFeedback({ idToken, gameId, vote, testMode: LOCAL_AUTH_TEST });
    app.gameFeedback[gameId] = { status: 'saved', data, error: '' };
    delete app.gameFeedbackSummaries[gameId];
    vibrate(35);
    render();
  } catch (error) {
    app.gameFeedback[gameId] = { status: 'error', data: previous, error: error.message || 'Не вдалося зберегти оцінку' };
    render();
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

function retryableCloudDeleteError(error) {
  return !navigator.onLine || ['aborted', 'deadline-exceeded', 'internal', 'network-request-failed', 'unavailable'].includes(error?.code);
}

async function savePendingActiveGameDeletes() {
  app.pendingActiveGameDeletes = [...new Set(app.pendingActiveGameDeletes.filter(Boolean))];
  await setSetting('pendingActiveGameDeletes', app.pendingActiveGameDeletes);
}

async function rememberActiveGameDelete(gameId) {
  app.pendingActiveGameDeletes.push(gameId);
  await savePendingActiveGameDeletes();
}

async function forgetActiveGameDelete(gameId) {
  app.pendingActiveGameDeletes = app.pendingActiveGameDeletes.filter(id => id !== gameId);
  await savePendingActiveGameDeletes();
}

async function flushPendingActiveGameDeletes() {
  if (!app.authUser || LOCAL_AUTH_TEST || !navigator.onLine || !app.pendingActiveGameDeletes.length) return;
  const remaining = [];
  for (const gameId of app.pendingActiveGameDeletes) {
    try {
      try { await deleteGameChat(app.authUser, gameId); } catch { /* Older games might not have a chat. */ }
      await deleteActiveCommunityGame(app.authUser, gameId);
      app.cloudGames = app.cloudGames.filter(game => !(game.id === gameId && game.status === 'active'));
    } catch (error) {
      if (retryableCloudDeleteError(error)) remaining.push(gameId);
    }
  }
  app.pendingActiveGameDeletes = remaining;
  await savePendingActiveGameDeletes();
  mergeGameSources();
  render();
}

async function cleanUpCanceledActiveGame(user, gameId) {
  try {
    await flushActiveGamePublish(gameId);
    if (!navigator.onLine) return;
    try { await deleteGameChat(user, gameId); } catch { /* The live game still has to be canceled. */ }
    await deleteActiveCommunityGame(user, gameId);
    await deleteActiveGameBackup(user, gameId);
    await forgetActiveGameDelete(gameId);
  } catch (error) {
    if (!retryableCloudDeleteError(error)) await forgetActiveGameDelete(gameId);
  }
}

async function cancelActiveGame(game) {
  if (!game || game.status !== 'active') throw new Error('Ця гра вже завершена або недоступна');
  if (!canManageGame(game)) throw new Error('Скасувати гру може лише її ведучий');
  if (app.game?.id === game.id) stopTimer();
  pendingActiveGames.delete(game.id);
  ensuredActiveGameChats.delete(game.id);
  activeGameChatMembershipSyncs.delete(game.id);
  const cleanupUser = app.authUser;
  if (!LOCAL_AUTH_TEST) await rememberActiveGameDelete(game.id);

  const restoredPlayers = (game.seats || []).map(seat => seat.profileId).filter(Boolean);
  if (restoredPlayers.length) {
    app.nextGameQueue = normalizeLineup([...restoredPlayers, ...app.nextGameQueue]);
    await saveNextGameQueue();
  }
  if (app.localGames.some(item => item.id === game.id)) await deleteOne('games', game.id);
  app.localGames = app.localGames.filter(item => item.id !== game.id);
  app.cloudGames = app.cloudGames.filter(item => item.id !== game.id);
  app.gameChats = app.gameChats.filter(chat => chat.gameId !== game.id);
  if (app.modal?.type === 'game-chat' && app.modal.chatId === game.id) app.modal = null;
  if (app.game?.id === game.id) app.game = null;
  app.undo = [];
  mergeGameSources();
  if (!LOCAL_AUTH_TEST) void cleanUpCanceledActiveGame(cleanupUser, game.id);
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
    try { await deleteFinishedCommunityGame(app.authUser, gameId, { tombstone: false }); }
    catch { remaining.push(gameId); }
  }
  await setSetting('pendingFinishedGameDeletes', remaining);
}

async function removeFinishedResultForReopen(gameId) {
  app.cloudGames = app.cloudGames.filter(game => !(game.id === gameId && game.status === 'finished'));
  if (LOCAL_AUTH_TEST) return;
  try { await deleteFinishedCommunityGame(app.authUser, gameId, { tombstone: false }); }
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

async function prepareTelegramProfileLink() {
  if (app.modal?.type !== 'host-profile' || ['loading', 'connecting'].includes(app.telegramLink.status)) return;
  app.telegramLink = { status: 'loading', error: '', prepared: null };
  render();
  try {
    const idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
    const prepared = await prepareTelegramProfileConnection({ idToken, testMode: LOCAL_AUTH_TEST });
    if (app.modal?.type !== 'host-profile') return;
    app.telegramLink = { status: 'ready', error: '', prepared };
    render();
  } catch (error) {
    if (app.modal?.type !== 'host-profile') return;
    app.telegramLink = { status: 'error', error: error?.message || 'Не вдалося підготувати Telegram Login', prepared: null };
    render();
  }
}

async function connectTelegramProfile() {
  if (app.modal?.type !== 'host-profile' || app.telegramLink.status === 'connecting') return;
  if (app.telegramLink.status !== 'ready' || !app.telegramLink.prepared) {
    await prepareTelegramProfileLink();
    if (app.telegramLink.status === 'ready') toast('Telegram Login готовий · натисніть іконку ще раз');
    return;
  }
  captureHostProfileDraft();
  const pending = connectPreparedTelegramProfile(app.telegramLink.prepared, { language: app.settings.language });
  app.telegramLink = { ...app.telegramLink, status: 'connecting', error: '' };
  render();
  try {
    const profile = await pending;
    if (app.modal?.type !== 'host-profile') return;
    app.modal.profileDraft = { ...(app.modal.profileDraft || {}), ...profile };
    app.telegramLink = { status: 'connected', error: '', prepared: null };
    render();
    toast('Telegram-акаунт підтверджено · збережіть профіль');
  } catch (error) {
    if (app.modal?.type !== 'host-profile') return;
    app.telegramLink = { status: 'error', error: error?.message || 'Не вдалося підключити Telegram', prepared: null };
    render();
  }
}

async function saveHostProfile(form) {
  if (profileIsInActiveGame(`google_${app.authUser?.uid || ''}`)) {
    return toast('Завершіть поточну гру перед редагуванням профілю');
  }
  const data = new FormData(form);
  const displayName = String(data.get('displayName') || '').trim();
  if (!displayName) return toast('Вкажіть ім’я');
  const nickname = String(data.get('nickname') || '').trim();
  const telegramInput = String(data.get('telegramUsername') || '').trim();
  const normalizedTelegramUsername = normalizeTelegramUsername(telegramInput);
  if (telegramInput && !normalizedTelegramUsername) return toast('Вкажіть коректний Telegram username: від 5 до 32 літер, цифр або _');
  const currentTelegram = { ...(app.hostProfile || {}), ...(app.modal?.profileDraft || {}) };
  const telegram = normalizedTelegramUsername === normalizeTelegramUsername(currentTelegram.telegramUsername)
    ? {
      telegramUsername: normalizedTelegramUsername,
      telegramUserId: currentTelegram.telegramVerified ? String(currentTelegram.telegramUserId || '') : '',
      telegramDisplayName: currentTelegram.telegramVerified ? String(currentTelegram.telegramDisplayName || '') : '',
      telegramPhotoURL: currentTelegram.telegramVerified ? String(currentTelegram.telegramPhotoURL || '') : '',
      telegramVerified: currentTelegram.telegramVerified === true && Boolean(currentTelegram.telegramUserId) && Boolean(currentTelegram.telegramLinkedAt),
      telegramLinkedAt: currentTelegram.telegramVerified ? String(currentTelegram.telegramLinkedAt || '') : ''
    }
    : telegramManualProfile(normalizedTelegramUsername);
  app.hostProfile = {
    ...app.hostProfile,
    uid: app.authUser.uid,
    email: app.authUser.email,
    displayName,
    nickname,
    club: String(data.get('club') || '').trim(),
    description: String(data.get('description') || '').trim(),
    ...telegram,
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
  app.telegramLink = { status: 'idle', error: '', prepared: null };
  app.modal = null;
  render();
  toast(cloudSaved ? 'Профіль Enjoy синхронізовано' : 'Збережено локально; хмарна синхронізація не вдалася');
}

function applyGoogleMapsSuggestion() {
  if (app.modal?.type !== 'venue') return;
  const venue = app.modal.venue || {};
  const suggestion = googleMapsVenueSuggestion(venue.googleMapsUrl);
  if (!suggestion.valid) {
    app.modal.googleStatus = venue.googleMapsUrl
      ? 'Перевірте посилання: потрібна HTTPS-адреса Google Maps.'
      : 'Спочатку вставте посилання Google Maps.';
    app.modal.googleStatusTone = 'error';
    render();
    return;
  }
  app.modal.venue = {
    ...venue,
    googleMapsUrl: suggestion.url,
    name: venue.name || suggestion.name,
    address: venue.address || suggestion.address
  };
  app.modal.googleStatusTone = '';
  if (suggestion.name || suggestion.address) {
    app.modal.googleStatus = 'Дані з посилання підставлено. Перевірте їх перед збереженням.';
  } else if (suggestion.short) {
    app.modal.googleStatus = 'Коротке посилання збережеться, але адресу з нього без Google Places API прочитати неможливо — введіть її вручну.';
  } else {
    app.modal.googleStatus = 'Посилання збережеться. Назва й адреса в ньому не закодовані, тому введіть їх вручну.';
  }
  render();
}

async function saveVenueForm(form) {
  if (app.venueBusy || app.modal?.type !== 'venue') return;
  const returnModal = app.modal.returnModal ? clone(app.modal.returnModal) : null;
  const data = new FormData(form);
  const venue = {
    name: data.get('name'),
    googleMapsUrl: data.get('googleMapsUrl'),
    address: data.get('address'),
    phone: data.get('phone'),
    website: data.get('website')
  };
  app.venueBusy = true;
  app.modal.venue = venue;
  render();
  try {
    const saved = LOCAL_AUTH_TEST
      ? createCommunityVenueFields(app.authUser, app.hostProfile, venue, uid('venue'))
      : await saveCommunityVenue(app.authUser, app.hostProfile, venue);
    app.venues = [saved, ...app.venues.filter(item => item.id !== saved.id)];
    app.venueBusy = false;
    if (returnModal?.type === 'host-profile') {
      app.modal = returnModal;
      app.modal.profileDraft = {
        ...(app.modal.profileDraft || {}),
        club: saved.name,
        clubSearch: saved.name,
        clubPickerOpen: false
      };
    } else {
      app.modal = null;
      setDraftVenue(saved);
    }
    render();
    toast(`Місце «${saved.name}» додано`);
  } catch (error) {
    app.venueBusy = false;
    render();
    toast(error?.message || 'Не вдалося зберегти місце');
  }
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

function appShareUrl() {
  const url = new URL('./', document.baseURI);
  url.search = '';
  url.hash = '';
  return url.href;
}

async function shareApp() {
  const shareData = {
    title: document.title || 'Mafia Enjoy',
    text: 'Mafia Enjoy — застосунок для ведення гри в спортивну «Мафію».',
    url: appShareUrl()
  };
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(shareData.url, 'Посилання на Mafia Enjoy скопійовано');
}

const GUARDED_GAME_ACTIONS = new Set([
  'start-game', 'confirm-number-role', 'reveal-next', 'zero-night-sheriff', 'zero-night-free-seating', 'zero-to-day',
  'timer-toggle', 'next-speaker', 'back-to-speeches', 'start-vote', 'finish-vote',
  'next-tie-speaker', 'finish-all-tie', 'finish-last-word', 'finish-best-move', 'skip-best-move',
  'night-next', 'night-miss', 'night-shot-done', 'night-check-done', 'night-skip-check', 'wake-city',
  'add-fault', 'remove-fault', 'nominate', 'remove-nomination', 'manual-eliminate', 'restore-seat',
  'undo', 'finish-red', 'finish-black', 'finish-draw'
]);

const HOST_TRANSFER_BLOCKED_ACTIONS = new Set([
  ...GUARDED_GAME_ACTIONS,
  'reveal-role', 'select-role-card', 'change-role-card',
  'timer-minus', 'timer-plus', 'timer-reset', 'seat-menu',
  'game-settings', 'end-game-manual', 'cancel-active-game'
]);

async function handleAction(action, element, sourceEvent) {
  const number = Number(element.dataset.seat);
  if (outgoingHostTransfer(app.game?.id) && HOST_TRANSFER_BLOCKED_ACTIONS.has(action)) {
    return toast('Гра на паузі · дочекайтеся відповіді або скасуйте передачу');
  }
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
    app.telegramLink = { status: 'idle', error: '', prepared: null };
    app.modal = { type: 'host-profile' };
    render();
    void prepareTelegramProfileLink();
  } else if (action === 'connect-telegram-profile') {
    await connectTelegramProfile();
  } else if (action === 'disconnect-telegram-profile') {
    if (app.modal?.type !== 'host-profile') return;
    captureHostProfileDraft();
    app.modal.profileDraft = { ...(app.modal.profileDraft || {}), ...telegramManualProfile('') };
    render();
    toast('Telegram від’єднано · збережіть профіль');
  } else if (action === 'open-player-avatar') {
    const playerId = element.dataset.id;
    if (!playerById(playerId)) return toast('Профіль не знайдено');
    app.modal = { type: 'player-avatar', playerId };
    render();
  } else if (action === 'open-player-stats') {
    if (app.modal?.type === 'host-profile') captureHostProfileDraft();
    if (app.modal?.type === 'player') captureManualPlayerDraft();
    const returnModal = ['host-profile', 'player'].includes(app.modal?.type) ? clone(app.modal) : null;
    const playerId = element.dataset.id || `google_${app.authUser?.uid || ''}`;
    if (playerId !== `google_${app.authUser?.uid || ''}` && !playerById(playerId)) return toast('Профіль не знайдено');
    app.modal = { type: 'player-stats', playerId, returnModal };
    render();
    void loadPersonalGameFeedback(playerId);
  } else if (action === 'back-to-profile') {
    const returnModal = app.modal?.returnModal;
    app.modal = returnModal || null;
    render();
  } else if (action === 'rate-game-sentiment') {
    await updatePersonalGameFeedback(element.dataset.id, 'sentiment', element.dataset.value);
  } else if (action === 'rate-game-emotion') {
    await updatePersonalGameFeedback(element.dataset.id, 'emotion', element.dataset.value);
  } else if (action === 'open-order-panel') {
    app.order = { busy: false, status: 'idle', error: '', lastItem: '', category: '', selectedItem: '', selectedOptions: [] };
    app.modal = { type: 'order' };
    render();
  } else if (action === 'select-order-category') {
    const category = element.dataset.category;
    if (!orderCategories(app.orderMenu.items).some(option => option.id === category)) return toast('Категорія меню недоступна');
    app.order = { ...app.order, category, status: 'idle', error: '', selectedItem: '', selectedOptions: [] };
    render();
  } else if (action === 'back-order-categories') {
    if (app.modal?.type !== 'order' || app.order.busy) return;
    app.order = { ...app.order, category: '', status: 'idle', error: '', selectedItem: '', selectedOptions: [] };
    render();
  } else if (action === 'select-order-item') {
    const item = element.dataset.item;
    if (!app.orderMenu.items.some(option => option.id === item)) return toast('Невідома позиція меню');
    app.order = { ...app.order, status: 'idle', error: '', selectedItem: item, selectedOptions: [] };
    render();
  } else if (action === 'choose-order-option') {
    if (app.modal?.type !== 'order' || app.order.busy || !app.order.selectedItem) return;
    const group = element.dataset.group;
    const optionId = element.dataset.option;
    const selectedOption = app.orderMenu.options.find(option => option.id === optionId && option.itemId === app.order.selectedItem && option.group === group);
    if (!selectedOption) return toast('Цей варіант меню недоступний');
    const selectedOptions = [...(app.order.selectedOptions || [])];
    const alreadySelected = selectedOptions.includes(optionId);
    const filtered = selectedOption.group === 'extra'
      ? selectedOptions.filter(id => id !== optionId)
      : selectedOptions.filter(id => !app.orderMenu.options.some(option => option.id === id && option.group === selectedOption.group));
    if (!alreadySelected) filtered.push(optionId);
    app.order = { ...app.order, status: 'idle', error: '', selectedOptions: filtered };
    render();
  } else if (action === 'place-order') {
    if (app.modal?.type !== 'order' || app.order.busy) return;
    const item = element.dataset.item;
    if (!app.orderMenu.items.some(option => option.id === item)) return toast('Невідома позиція меню');
    const options = app.order.selectedItem === item ? [...(app.order.selectedOptions || [])] : [];
    app.order = { ...app.order, busy: true, status: 'loading', error: '', lastItem: item };
    render();
    try {
      const idToken = LOCAL_AUTH_TEST ? '' : await getFirebaseIdToken();
      const activeGame = app.game?.status === 'active' && canManageGame(app.game)
        ? app.game
        : activeGames().find(game => canManageGame(game));
      await sendTelegramOrder({
        idToken,
        item,
        options,
        sender: app.hostProfile?.nickname || app.hostProfile?.displayName || app.authUser?.googleName || 'Гість Enjoy',
        game: activeGame?.title || '',
        testMode: LOCAL_AUTH_TEST
      });
      app.order = { ...app.order, busy: false, status: 'success', error: '', lastItem: item };
      render();
      vibrate([40, 30, 70]);
      toast('Замовлення надіслано');
    } catch (error) {
      app.order = { ...app.order, busy: false, status: 'error', error: error?.message || 'Не вдалося надіслати замовлення', lastItem: item };
      render();
    }
  } else if (action === 'open-media-panel') {
    app.modal = { type: 'media', view: '' }; render();
  } else if (action === 'show-bluetooth-guide') {
    if (app.modal?.type === 'media') app.modal.view = 'bluetooth';
    render();
  } else if (action === 'media-play') {
    automaticMusicPaused = false;
    automaticMusicBlockedCue = '';
    await playMusic({ automatic: app.media.automatic });
  } else if (action === 'media-pause') {
    pauseMusic();
  } else if (action === 'media-clear') {
    const wasAutomatic = app.media.automatic;
    if (wasAutomatic) pauseMusic();
    else clearMusicTrack();
    render();
    toast(wasAutomatic ? 'Музику призупинено до наступної сцени' : 'Аудіофайл прибрано');
  } else if (action === 'bluetooth-request') {
    if (app.modal?.type === 'media') app.modal.view = 'bluetooth';
    await requestBluetoothDevice();
  } else if (action === 'cloud-refresh') {
    stopCommunityProfiles();
    await connectCloudDirectory({ hasLocalProfile: true });
  } else if (action === 'cloud-games-refresh') {
    app.gameFeedbackSummaries = {};
    const published = await publishLocalActiveGamesNow();
    await reconnectCloudArchive();
    toast(published ? `Активну гру опубліковано · ${published}` : 'Список ігор оновлено');
  } else if (action === 'game-chats-refresh') {
    await reconnectGameChats();
    await syncLocalFinishedGames();
  } else if (action === 'open-game-discussion') {
    const game = gameById(element.dataset.id) || (app.game?.id === element.dataset.id ? app.game : null);
    if (!game || game.status !== 'finished') return toast('Обговорення доступне після завершення гри');
    if (!canManageGame(game) && !gameChatForGame(game.id)) return toast('Обговорення доступне лише учасникам цієї гри');
    app.modal = { type: 'discussion', gameId: game.id };
    render();
    if (!gameChatForGame(game.id) && canManageGame(game)) {
      app.chatBusy = true;
      render();
      try {
        await ensureFinishedGameChat(game);
      } catch (error) {
        app.gameChatsState = { status: 'error', error: error?.message || 'Не вдалося створити чат гри' };
      } finally {
        app.chatBusy = false;
        render();
      }
    }
  } else if (action === 'open-app-game-chat') {
    await openAppGameChat(element.dataset.id);
  } else if (action === 'open-game-chat') {
    const chat = gameChatById(element.dataset.id);
    if (!chat) return toast('Чат не знайдено');
    await openGameChat(chat);
  } else if (action === 'retry-game-chat-messages') {
    if (app.modal?.type === 'game-chat') await connectGameChatMessages(app.modal.chatId);
  } else if (action === 'insert-chat-emotion') {
    if (app.modal?.type !== 'game-chat' || app.chatBusy) return;
    const composer = modalRoot.querySelector('[data-input="game-chat-message"]');
    if (!composer) return;
    const result = insertGameChatEmotion(
      app.chatDraft,
      element.dataset.value,
      composer.selectionStart,
      composer.selectionEnd,
      composer.maxLength
    );
    if (!result.inserted) return;
    app.chatDraft = result.text;
    composer.value = result.text;
    const submit = composer.closest('form')?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !app.chatDraft.trim();
    composer.focus({ preventScroll: true });
    composer.setSelectionRange(result.caret, result.caret);
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
  } else if (action === 'share-app') {
    await shareApp();
  } else if (action === 'install') {
    const mode = currentPwaInstallMode();
    if (mode === 'ios-guide') {
      app.modal = { type: 'ios-install' };
      render();
      return;
    }
    if (mode !== 'native' || !app.installPrompt) return;
    app.installPrompt.prompt();
    await app.installPrompt.userChoice;
    app.installPrompt = null;
    render();
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
  } else if (action === 'select-game-venue') {
    const venue = availableVenues().find(item => item.id === element.dataset.id);
    if (!venue) return toast('Місце не знайдено');
    setDraftVenue(venue);
    render();
  } else if (action === 'use-custom-game-venue') {
    const name = String(app.draft?.venueSearch || '').trim();
    if (!name) return;
    setDraftVenue({ id: '', name });
    render();
  } else if (action === 'open-venue-create') {
    const query = String(app.draft?.venueSearch || '').trim();
    const exact = availableVenues().some(venue => venue.name.toLocaleLowerCase('uk') === query.toLocaleLowerCase('uk'));
    app.modal = {
      type: 'venue',
      venue: { name: exact ? '' : query, googleMapsUrl: '', address: '', phone: '', website: '' },
      googleStatus: '',
      googleStatusTone: ''
    };
    render();
  } else if (action === 'select-profile-club') {
    if (app.modal?.type !== 'host-profile') return;
    const venue = availableVenues().find(item => item.id === element.dataset.id);
    if (!venue) return toast('Місце не знайдено');
    captureHostProfileDraft();
    app.modal.profileDraft = {
      ...(app.modal.profileDraft || {}),
      club: venue.name,
      clubSearch: venue.name,
      clubPickerOpen: false
    };
    render();
  } else if (action === 'use-custom-profile-club') {
    if (app.modal?.type !== 'host-profile') return;
    captureHostProfileDraft();
    const name = String(app.modal.profileDraft?.clubSearch || app.modal.profileDraft?.club || '').trim();
    if (!name) return;
    app.modal.profileDraft = {
      ...(app.modal.profileDraft || {}),
      club: name,
      clubSearch: name,
      clubPickerOpen: false
    };
    render();
  } else if (action === 'open-profile-club-create') {
    if (app.modal?.type !== 'host-profile') return;
    captureHostProfileDraft();
    const query = String(app.modal.profileDraft?.clubSearch || app.modal.profileDraft?.club || '').trim();
    const exact = availableVenues().some(venue => venue.name.toLocaleLowerCase('uk') === query.toLocaleLowerCase('uk'));
    const returnModal = clone(app.modal);
    returnModal.profileDraft = { ...(returnModal.profileDraft || {}), clubPickerOpen: false };
    app.modal = {
      type: 'venue',
      venue: { name: exact ? '' : query, googleMapsUrl: '', address: '', phone: '', website: '' },
      googleStatus: '',
      googleStatusTone: '',
      returnModal
    };
    render();
  } else if (action === 'fill-venue-from-google') {
    applyGoogleMapsSuggestion();
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
  } else if (action === 'cancel-active-game') {
    const game = gameById(element.dataset.id) || app.game;
    if (!game || game.status !== 'active') return toast('Ця гра вже завершена або недоступна');
    if (!canManageGame(game)) return toast('Скасувати гру може лише її ведучий');
    app.modal = {
      type: 'confirm',
      title: 'Скасувати гру?',
      text: 'Активну гру буде видалено без переможця. Вона не потрапить до статистики й протоколів. Якщо склад збережений на цьому пристрої, його гравці повернуться до наступної гри.',
      confirmLabel: 'Скасувати гру',
      confirm: { kind: 'cancel-active-game', id: game.id }
    };
    render();
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
    if (confirm.kind === 'cancel-active-game') {
      try { await cancelActiveGame(gameById(confirm.id) || (app.game?.id === confirm.id ? app.game : null)); }
      catch (error) { app.modal = null; render(); return toast(error.message || 'Не вдалося скасувати гру'); }
      app.modal = null;
      app.route = 'home';
      if (location.hash !== '#home') navigate('home'); else render();
      toast('Гру скасовано');
      return;
    }
    if (confirm.kind === 'finish') { app.modal = { type: 'winner' }; render(); return; }
    app.modal = null; await refreshData(); render(); toast('Видалено');
  } else if (action === 'close-modal') {
    if (element.classList.contains('modal-backdrop') && element !== sourceEvent?.target) return;
    if (app.modal?.type === 'venue' && app.venueBusy) return;
    if (app.modal?.type === 'game-chat') {
      stopGameChatMessages();
      app.chatMessages = [];
      app.chatMessagesState = { status: 'idle', error: '' };
      app.chatDraft = '';
    }
    const closingHostProfile = app.modal?.type === 'host-profile';
    const returnModal = app.modal?.type === 'venue' ? app.modal.returnModal : null;
    app.modal = returnModal || null;
    if (closingHostProfile) app.telegramLink = { status: 'idle', error: '', prepared: null };
    render();
  } else if (action === 'open-host-transfer') {
    if (!app.game || app.game.status !== 'active' || !canManageGame(app.game)) return toast('Передача доступна лише поточному ведучому');
    app.modal = { type: outgoingHostTransfer(app.game.id) ? 'host-transfer-waiting' : 'host-transfer-select', search: '' };
    render();
  } else if (action === 'request-host-transfer') {
    if (!app.game || !canManageGame(app.game) || app.hostTransfers.busy) return;
    if (LOCAL_AUTH_TEST) return toast('Для передачі потрібні два авторизовані пристрої');
    const recipient = hostTransferCandidates().find(candidate => candidate.uid === element.dataset.uid);
    if (!recipient) return toast('Цей користувач недоступний для передачі');
    app.hostTransfers.busy = true;
    render();
    try {
      stopTimer();
      await saveGame();
      const published = await waitForActiveGamePublish(app.game.id);
      if (!published) throw new Error('Не вдалося зафіксувати актуальний стан гри');
      const transfer = await requestGameHostTransfer(app.authUser, app.hostProfile, app.game, recipient);
      app.hostTransfers.outgoing = [transfer, ...app.hostTransfers.outgoing.filter(item => item.gameId !== transfer.gameId)];
      app.hostTransfers.busy = false;
      app.modal = { type: 'host-transfer-waiting', transfer };
      render();
      toast(`Запит надіслано · ${recipient.name}`);
    } catch (error) {
      app.hostTransfers.busy = false;
      render();
      toast(error?.message || 'Не вдалося передати ведення');
    }
  } else if (action === 'cancel-host-transfer') {
    const transfer = outgoingHostTransfer(app.game?.id);
    if (!transfer || app.hostTransfers.busy) return;
    app.hostTransfers.busy = true;
    render();
    try {
      await resolveGameHostTransfer(app.authUser, transfer.gameId);
      app.hostTransfers.outgoing = app.hostTransfers.outgoing.filter(item => item.gameId !== transfer.gameId);
      app.hostTransfers.busy = false;
      app.modal = null;
      render();
      toast('Передачу скасовано · гру можна продовжити');
    } catch (error) {
      app.hostTransfers.busy = false;
      render();
      toast(error?.message || 'Не вдалося скасувати передачу');
    }
  } else if (action === 'decline-host-transfer') {
    const transfer = pendingIncomingHostTransfer();
    if (!transfer || app.hostTransfers.busy) return;
    app.hostTransfers.busy = true;
    render();
    try {
      await resolveGameHostTransfer(app.authUser, transfer.gameId);
      app.hostTransfers.incoming = app.hostTransfers.incoming.filter(item => item.gameId !== transfer.gameId);
      app.hostTransfers.busy = false;
      app.modal = null;
      render();
      toast('Запит відхилено');
    } catch (error) {
      app.hostTransfers.busy = false;
      render();
      toast(error?.message || 'Не вдалося відхилити запит');
    }
  } else if (action === 'accept-host-transfer') {
    const transfer = pendingIncomingHostTransfer();
    if (!transfer || app.hostTransfers.busy) return;
    const otherHostedGame = activeGames().find(game => game.id !== transfer.gameId && canManageGame(game));
    if (otherHostedGame) return toast('Спочатку завершіть або скасуйте іншу гру, яку ви ведете');
    app.hostTransfers.busy = true;
    render();
    try {
      const received = await acceptGameHostTransfer(app.authUser, app.hostProfile, transfer);
      const game = normalizeGameState({
        ...received,
        ownerUid: app.authUser.uid,
        cloudOwnerUid: app.authUser.uid,
        cloudHostName: app.hostProfile?.nickname || app.hostProfile?.displayName || app.authUser.googleName || transfer.toName,
        shared: true,
        source: 'host-transfer'
      }, DEFAULT_SETTINGS, { closeReveal: true });
      delete game.publicOnly;
      game.seats.forEach(seat => {
        if (seat.avatar) return;
        const player = seat.profileId ? playerById(seat.profileId) : null;
        seat.avatar = player?.avatar || player?.avatarPreset || '';
      });
      const errors = gameStateErrors(game);
      if (errors.length) throw new Error(`Переданий стан гри пошкоджено: ${errors[0]}`);
      const at = nowIso();
      game.history.unshift({ at, time: new Date(at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }), text: `Ведення гри передано: ${transfer.fromName} → ${transfer.toName}.`, secret: false });
      await putOne('games', game);
      app.localGames = [...app.localGames.filter(item => item.id !== game.id), clone(game)];
      app.cloudGames = app.cloudGames.map(item => item.id === game.id ? { ...item, cloudOwnerUid: app.authUser.uid, cloudHostName: transfer.toName } : item);
      app.hostTransfers.incoming = app.hostTransfers.incoming.filter(item => item.gameId !== transfer.gameId);
      app.hostTransfers.busy = false;
      app.game = game;
      app.undo = [];
      app.modal = null;
      mergeGameSources();
      queueActiveGamePublish(game);
      navigate(`${game.phase === 'reveal' ? 'reveal' : 'game'}/${game.id}`);
      render();
      toast('Ви тепер ведучий цієї гри');
    } catch (error) {
      app.hostTransfers.busy = false;
      render();
      toast(error?.message || 'Не вдалося прийняти ведення');
    }
  } else if (action === 'game-settings') {
    app.modal = { type: 'game-settings', settingsDraft: { ...app.game.settings } }; render();
  } else if (action === 'toggle-draft-music') {
    if (!app.draft) return;
    app.draft.settings.music = normalizeGameMusicSettings(app.draft.settings.music);
    app.draft.settings.music.enabled = !app.draft.settings.music.enabled;
    render();
  } else if (action === 'preview-setup-music') {
    await previewSetupMusic(element.dataset.musicCue);
  } else if (action === 'pause-setup-music') {
    if (app.media.playing && app.media.cue === element.dataset.musicCue) pauseMusic();
  } else if (action === 'choose-setup-music-file') {
    const cue = element.dataset.musicCue;
    if (!GAME_MUSIC_CUES.some(item => item.id === cue)) return;
    document.querySelector(`[data-input="setup-music-file"][data-music-cue="${cue}"]`)?.click();
  } else if (action === 'set-stats-period') {
    const period = element.dataset.statsPeriod;
    if (!['all', '30d', '90d', '365d'].includes(period) || app.statsPeriod === period) return;
    app.statsPeriod = period;
    render();
    requestAnimationFrame(() => document.querySelector(`[data-stats-period="${period}"]`)?.focus());
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
  } else if (action === 'clear-setup-seats') {
    if (!app.draft) return;
    app.draft.seats = app.draft.seats.map(seat => ({
      number: seat.number,
      profileId: '',
      name: '',
      autoGuestName: false
    }));
    render();
    toast('Розсадку очищено');
  } else if (action === 'start-game') {
    const existingActiveGame = activeGames().find(game => !game.publicOnly && canManageGame(game));
    if (existingActiveGame) return toast(`Спочатку завершіть активну гру «${existingActiveGame.title}»`);
    prepareTimerAudio();
    const selected = app.draft.seats.map(seat => seat.profileId).filter(Boolean);
    if (new Set(selected).size !== selected.length) return toast('Один профіль не можна посадити двічі');
    const devicePreferences = { theme: app.settings.theme, sound: app.settings.sound, haptics: app.settings.haptics };
    app.game = createGameFromDraft(); app.settings = { ...app.game.settings, music: normalizeGameMusicSettings(app.game.settings.music), ...devicePreferences }; app.undo = [];
    app.panelExpanded.moderatorPanel = false;
    void syncAutomaticMusic();
    await setSetting('appSettings', app.settings); await saveGame();
    const gameId = app.game.id;
    app.nextGameQueue = consumeSeatedPlayers(app.nextGameQueue, app.game.seats);
    await saveNextGameQueue();
    app.draft = null;
    navigate('reveal');
    void waitForActiveGamePublish(gameId).then(shared => {
      if (!shared) toast('Гру створено локально · спільний перегляд з’явиться після відновлення синхронізації');
    });
  } else if (action === 'resume-game') {
    let game = gameById(element.dataset.id);
    if (game?.publicOnly && ownsCloudGame(game)) {
      toast('Відновлюю приватний стан гри…');
      game = await recoverOwnedActiveGame(game, { force: true });
    }
    if (!game || game.publicOnly || !canManageGame(game)) return toast('Приватну копію цієї гри не знайдено. Її можна скасувати й створити нову');
    app.game = normalizeGameState(game, DEFAULT_SETTINGS, { closeReveal: true }); app.undo = []; navigate(app.game.phase === 'reveal' ? 'reveal' : 'game');
  } else if (action === 'watch-game') {
    const game = gameById(element.dataset.id);
    if (!game || game.status !== 'active') return toast('Ця гра вже завершена або недоступна');
    app.game = game; app.undo = []; navigate(`observer/${game.id}`);
  } else if (action === 'select-role-card') {
    if (app.game?.phase !== 'reveal' || app.game.settings?.dealMode !== 'number' || app.game.revealOpen) return;
    app.game.roleDeal = selectNumberRoleCard(app.game.roleDeal, Number(element.dataset.card));
    await saveGame();
    render();
  } else if (action === 'change-role-card') {
    if (app.game?.phase !== 'reveal' || app.game.settings?.dealMode !== 'number' || app.game.revealOpen) return;
    app.game.roleDeal.selectedCard = null;
    await saveGame();
    render();
  } else if (action === 'confirm-number-role') {
    if (app.game?.phase !== 'reveal' || app.game.settings?.dealMode !== 'number' || app.game.revealOpen) return;
    const seat = app.game.seats[app.game.revealIndex];
    if (!seat || seat.role) return;
    const remaining = app.game.roleDeal?.remainingRoles?.length || 0;
    const chosenCard = remaining === 1 ? 1 : app.game.roleDeal?.selectedCard;
    if (!chosenCard) return toast(`Попросіть гравця обрати число від 1 до ${remaining}`);
    const dealt = takeNumberRoleCard(app.game.roleDeal, chosenCard);
    seat.role = dealt.role;
    app.game.roleDeal = dealt.roleDeal;
    app.panelExpanded.moderatorPanel = false;
    app.game.revealOpen = true;
    addLog(`Гравець №${seat.number} отримав карту №${dealt.cardNumber}: ${roleOf(seat)?.label}.`, true);
    await saveGame();
    render();
  } else if (action === 'reveal-role') {
    if (!roleOf(app.game?.seats?.[app.game.revealIndex])) return toast('Спочатку оберіть карту гравця');
    app.panelExpanded.moderatorPanel = false;
    app.game.revealOpen = true; render();
  } else if (action === 'reveal-next') {
    if (!roleOf(app.game?.seats?.[app.game.revealIndex])) return toast('Роль цього гравця ще не визначена');
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
  else if (action === 'restore-seat') { const seat = seatByNo(app.modal.seat); pushUndo(); seat.status = 'alive'; seat.eliminatedReason = ''; addLog(`№${seat.number} повернуто за стіл ведучим.`); app.modal = null; ensuredActiveGameChats.delete(app.game.id); activeGameChatMembershipSyncs.add(app.game.id); await saveGame(); render(); }
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
    ensuredActiveGameChats.delete(app.game.id);
    if (!finishedGameId) activeGameChatMembershipSyncs.add(app.game.id);
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
    const previous = app.game;
    const previousVenue = availableVenues().find(venue => venue.name.toLocaleLowerCase('uk') === String(previous.venue || '').trim().toLocaleLowerCase('uk'));
    app.draft = createDraft();
    app.draft.title = `${previous.title} · реванш`;
    app.draft.autoTitle = false;
    app.draft.venue = previous.venue;
    app.draft.venueId = previousVenue?.id || '';
    app.draft.venueSearch = previous.venue;
    app.draft.venuePickerOpen = false;
    app.draft.seats = previous.seats.map(seat => ({ number: seat.number, profileId: seat.profileId || '', name: seat.name, autoGuestName: false }));
    navigate('setup');
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
  if (element.dataset.input === 'game-chat-message') {
    app.chatDraft = element.value.slice(0, 1000);
    const submit = element.closest('form')?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !app.chatDraft.trim() || app.chatBusy;
  } else if (element.dataset.input === 'player-search') {
    app.search = element.value;
    render();
    const search = $('[data-input="player-search"]');
    search?.focus();
    search?.setSelectionRange(app.search.length, app.search.length);
  } else if (element.dataset.input === 'host-transfer-search') {
    if (app.modal?.type !== 'host-transfer-select') return;
    app.modal.search = element.value;
    render();
    const search = $('[data-input="host-transfer-search"]');
    search?.focus();
    search?.setSelectionRange(app.modal.search.length, app.modal.search.length);
  } else if (element.dataset.input === 'venue-search') {
    if (!app.draft) return;
    app.draft.venueSearch = element.value;
    app.draft.venue = element.value.trim();
    app.draft.venueId = '';
    app.draft.venuePickerOpen = true;
    if (app.draft.autoTitle !== false) app.draft.title = defaultGameTitle(new Date(), app.draft.venue);
    render();
    focusVenueSearch();
  } else if (element.dataset.input === 'profile-club-search') {
    if (app.modal?.type !== 'host-profile') return;
    const query = element.value;
    captureHostProfileDraft();
    app.modal.profileDraft = {
      ...(app.modal.profileDraft || {}),
      club: query.trim(),
      clubSearch: query,
      clubPickerOpen: true
    };
    render();
    focusProfileClubSearch();
  } else if (element.dataset.input === 'telegram-username' && app.modal?.type === 'host-profile') {
    const current = { ...(app.hostProfile || {}), ...(app.modal.profileDraft || {}) };
    const username = normalizeTelegramUsername(element.value);
    if (username !== normalizeTelegramUsername(current.telegramUsername)) {
      app.modal.profileDraft = { ...(app.modal.profileDraft || {}), ...telegramManualProfile(element.value) };
      element.closest('.telegram-profile-field')?.querySelector('.telegram-linked-identity')?.remove();
      element.closest('.telegram-profile-field')?.querySelector('.telegram-connect-btn')?.classList.remove('connected');
    }
  } else if (element.dataset.venueField && app.modal?.type === 'venue') {
    app.modal.venue = { ...(app.modal.venue || {}), [element.dataset.venueField]: element.value };
  } else if (element.dataset.draft) {
    app.draft[element.dataset.draft] = element.value;
    if (element.dataset.draft === 'title') app.draft.autoTitle = false;
  } else if (element.dataset.draftSetting) {
    const key = element.dataset.draftSetting;
    if (key === 'penaltyMode') app.draft.settings[key] = element.value === 'club' ? 'club' : 'tournament';
    else if (key === 'dealMode') app.draft.settings[key] = element.value === 'automatic' ? 'automatic' : 'number';
    else app.draft.settings[key] = Math.max(5, Math.min(180, Number(element.value) || DEFAULT_SETTINGS[key]));
  } else if (element.dataset.seatName) {
    const seat = app.draft.seats.find(item => item.number === Number(element.dataset.seatName));
    if (seat) {
      seat.name = element.value;
      seat.autoGuestName = false;
    }
  }
  const formType = element.closest?.('[data-form]')?.dataset.form;
  if (formType === 'host-profile') captureHostProfileDraft();
  else if (formType === 'player') captureManualPlayerDraft();
  else if (formType === 'game-settings') captureGameSettingsDraft();
}

async function handleChange(element) {
  if (element.dataset.input === 'venue-google-maps-url' && app.modal?.type === 'venue') {
    applyGoogleMapsSuggestion();
  } else if (element.dataset.input === 'setup-music-choice' && app.draft) {
    const cue = element.dataset.musicCue;
    if (!GAME_MUSIC_CUES.some(item => item.id === cue)) return;
    app.draft.settings.music = normalizeGameMusicSettings({
      ...app.draft.settings.music,
      [cue]: element.value
    });
    if (app.draft.settings.music[cue] === customMusicChoice(cue) && !setupMusicFiles.has(cue)) {
      element.closest('[data-music-cue-card]')?.querySelector('[data-input="setup-music-file"]')?.click();
      return;
    }
    render();
  } else if (element.dataset.seatProfile) {
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
      captureManualPlayerDraft();
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
  } else if (element.dataset.input === 'setup-music-file' && element.files?.[0] && app.draft) {
    setupMusicFile(element.dataset.musicCue, element.files[0]);
  }
  const formType = element.closest?.('[data-form]')?.dataset.form;
  if (formType === 'host-profile') captureHostProfileDraft();
  else if (formType === 'player') captureManualPlayerDraft();
  else if (formType === 'game-settings') captureGameSettingsDraft();
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
    app.gameFeedback = {};
    app.gameFeedbackSummaries = {};
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
      connectGameChats(),
      connectVenueDirectory(),
      connectPlayerLinks(),
      connectHostTransfers()
    ]);
    await flushPendingActiveGameDeletes();
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
  clearSetupMusicFiles();
  automaticMusicCue = '';
  automaticMusicPaused = false;
  automaticMusicBlockedCue = '';
  automaticMusicPlayPendingCue = '';
  clearDriveAccess();
  stopCommunityProfiles();
  stopCommunityGames();
  stopCommunityVenues();
  stopGameHostTransfers();
  stopGameChatMessages();
  stopGameChats();
  stopPlayerLinks();
  stopProfilePresence();
  cloudDirectoryPromise = null;
  cloudArchivePromise = null;
  venueDirectoryPromise = null;
  gameChatsPromise = null;
  cloudArchiveMigrationStarted = false;
  pendingActiveGames.clear();
  activeGameRecoveryAttempts.clear();
  ensuredActiveGameChats.clear();
  activeGameChatMembershipSyncs.clear();
  handledHostTransfers.clear();
  if (activeGamePublishRetryHandle) clearTimeout(activeGamePublishRetryHandle);
  activeGamePublishRetryHandle = null;
  activationPromise = null;
  activationUid = null;
  app.authUser = null;
  app.hostProfile = null;
  app.profilePhotoSync = { status: 'idle' };
  app.telegramLink = { status: 'idle', error: '', prepared: null };
  app.gameFeedback = {};
  app.gameFeedbackSummaries = {};
  app.localPlayers = [];
  app.cloudPlayers = [];
  app.players = [];
  app.localGames = [];
  app.cloudGames = [];
  app.deletedGameIds = [];
  app.ownedPlayerLinks = [];
  app.playerLinkOffers = [];
  app.playerLinkBusy = false;
  app.accountDeleteBusy = false;
  app.pendingActiveGameDeletes = [];
  app.hostTransfers = { incoming: [], outgoing: [], busy: false, error: '' };
  app.gameChats = [];
  app.gameChatsState = { status: 'idle', error: '' };
  app.chatMessages = [];
  app.chatMessagesState = { status: 'idle', error: '' };
  app.chatDraft = '';
  app.chatBusy = false;
  app.games = [];
  app.nextGameQueue = [];
  app.game = null;
  app.draft = null;
  app.modal = null;
  app.legacyMigration = null;
  app.authBusy = false;
  app.cloudDirectory = { status: 'idle', error: '', fromCache: false };
  app.cloudArchive = { status: 'idle', error: '', fromCache: false };
  app.venues = [];
  app.venueDirectory = { status: 'idle', error: '', fromCache: false };
  app.venueBusy = false;
}

async function loadAppData() {
  const hasLocalProfile = Boolean(await getSetting('hostProfile', null));
  app.players = [];
  app.localPlayers = [];
  app.localGames = [];
  app.deletedGameIds = [];
  app.games = [];
  app.gameChats = [];
  app.gameChatsState = { status: 'idle', error: '' };
  app.chatMessages = [];
  app.chatMessagesState = { status: 'idle', error: '' };
  app.chatDraft = '';
  app.chatBusy = false;
  app.game = null;
  app.draft = null;
  const storedSettings = await getSetting('appSettings', {});
  app.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
  app.settings.music = migrateGameMusicSettings(app.settings.music, storedSettings.musicDefaultsVersion);
  app.settings.musicDefaultsVersion = GAME_MUSIC_DEFAULTS_VERSION;
  if (Number(storedSettings.musicDefaultsVersion || 0) < GAME_MUSIC_DEFAULTS_VERSION) {
    await setSetting('appSettings', app.settings);
  }
  app.settings.theme = applyTheme(app.settings.theme);
  app.settings.language = applyLanguage(app.settings.language);
  app.nextGameQueue = normalizeLineup(await getSetting('nextGameQueue', []));
  const pendingActiveDeletes = await getSetting('pendingActiveGameDeletes', []);
  app.pendingActiveGameDeletes = Array.isArray(pendingActiveDeletes) ? [...new Set(pendingActiveDeletes.filter(Boolean))] : [];
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
  if (app.modal?.type === 'game-chat') {
    stopGameChatMessages();
    app.chatMessages = [];
    app.chatMessagesState = { status: 'idle', error: '' };
    app.chatDraft = '';
  }
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
  if (app.route === 'stats') void loadStatsGameFeedback();
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
document.addEventListener('focusout', () => {
  if (!passiveRenderPending) return;
  setTimeout(() => {
    if (!passiveRenderPending) return;
    const activeElement = document.activeElement;
    const stillEditing = activeElement instanceof Element
      && (activeElement.matches('input, textarea, select, [contenteditable="true"]') || activeElement.isContentEditable)
      && (appRoot.contains(activeElement) || modalRoot.contains(activeElement));
    if (!stillEditing) renderPassiveCloudUpdate();
  }, 0);
});
document.addEventListener('focusin', event => {
  if (event.target.dataset.input === 'venue-search' && app.draft && !app.draft.venuePickerOpen) {
    app.draft.venuePickerOpen = true;
    render();
    focusVenueSearch();
  } else if (event.target.dataset.input === 'profile-club-search' && app.modal?.type === 'host-profile' && !app.modal.profileDraft?.clubPickerOpen) {
    captureHostProfileDraft();
    app.modal.profileDraft = { ...(app.modal.profileDraft || {}), clubPickerOpen: true };
    render();
    focusProfileClubSearch();
  }
});
document.addEventListener('submit', async event => {
  if (event.target.dataset.form === 'game-chat-message') {
    event.preventDefault();
    await sendCurrentGameChatMessage();
  } else if (event.target.dataset.form === 'player') {
    event.preventDefault();
    await savePlayer(event.target);
  } else if (event.target.dataset.form === 'host-profile') {
    event.preventDefault();
    await saveHostProfile(event.target);
  } else if (event.target.dataset.form === 'venue') {
    event.preventDefault();
    await saveVenueForm(event.target);
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
  if (event.key === 'Escape' && (app.modal || app.tooltip) && !app.accountDeleteBusy) {
    const closingHostProfile = app.modal?.type === 'host-profile';
    if (app.modal?.type === 'game-chat') {
      stopGameChatMessages();
      app.chatMessages = [];
      app.chatMessagesState = { status: 'idle', error: '' };
      app.chatDraft = '';
    }
    app.modal = app.modal?.type === 'venue' && app.modal.returnModal ? app.modal.returnModal : null;
    if (closingHostProfile) app.telegramLink = { status: 'idle', error: '', prepared: null };
    closeOverlays();
    render();
  }
  if (app.route === 'game' && !app.modal && event.code === 'Space' && ['day', 'tieSpeech', 'lastWord'].includes(app.game?.phase)) {
    event.preventDefault();
    app.game.timer.running ? stopTimer() : startTimer();
    await saveGame(); render();
  }
});
window.addEventListener('hashchange', onRouteChange);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); app.installPrompt = event; render(); });
window.addEventListener('appinstalled', () => {
  app.installPrompt = null;
  if (app.modal?.type === 'ios-install') app.modal = null;
  render();
  toast('Mafia Enjoy встановлено');
});
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => render());
window.addEventListener('online', () => {
  toast('Інтернет-з’єднання відновлено');
  if (app.authUser && app.cloudDirectory.status === 'error') connectCloudDirectory({ hasLocalProfile: true });
  if (app.authUser && ['error', 'offline'].includes(app.cloudArchive.status)) reconnectCloudArchive();
  if (app.authUser && app.gameChatsState.status === 'error') reconnectGameChats();
  if (app.authUser && ['error', 'offline'].includes(app.venueDirectory.status)) connectVenueDirectory();
  if (app.authUser) syncLocalActiveGames();
  if (app.authUser) syncSharedManualPlayers().catch(() => {});
  if (app.authUser) connectPlayerLinks().catch(() => {});
  if (app.authUser) flushPendingActiveGameDeletes().catch(() => {});
  if (app.authUser) flushPendingFinishedGameDeletes().catch(() => {});
  if (app.authUser) publishProfilePresence();
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
  if (!document.hidden) {
    requestGameWakeLock();
    publishProfilePresence();
    syncLocalActiveGames();
    if (app.route === 'players') render();
  }
});

channel?.addEventListener('message', event => {
  if (event.data?.type !== 'game' || app.route !== 'observer') return;
  const routedId = routeFromHash().id;
  if (routedId && event.data.game?.id !== routedId) return;
  app.game = event.data.game;
  render();
});

async function refreshOrderMenu() {
  app.orderMenu = await loadOrderMenu({ testMode: LOCAL_AUTH_TEST });
  if (app.modal?.type === 'order') render();
}

async function init() {
  render();
  configureMediaSession();
  void refreshBluetoothState();
  void refreshOrderMenu();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js?v=176', { updateViaCache: 'none' }).catch(() => {});
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
