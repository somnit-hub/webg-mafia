import {
  openDatabase, getAll, getOne, putOne, deleteOne,
  getSetting, setSetting, exportDatabase, importDatabase
} from './db.js';
import {
  configureGoogle, signInGoogle, signOutGoogle, getGoogleSession,
  pushToDrive, pullFromDrive
} from './google-sync.js';

const ROLE_DECK = [
  { key: 'sheriff', label: 'Шериф', team: 'red', symbol: '★', description: 'Щоночі перевіряє одного гравця та дізнається колір його команди.' },
  { key: 'don', label: 'Дон', team: 'black', symbol: '◆', description: 'Очолює чорну команду та щоночі шукає Шерифа.' },
  { key: 'mafia', label: 'Мафія', team: 'black', symbol: '●', description: 'Разом із Доном бере участь у нічній стрільбі.' },
  { key: 'mafia', label: 'Мафія', team: 'black', symbol: '●', description: 'Разом із Доном бере участь у нічній стрільбі.' },
  ...Array.from({ length: 6 }, () => ({ key: 'citizen', label: 'Мирний житель', team: 'red', symbol: '○', description: 'Шукає чорну команду логікою, промовою та голосом.' }))
];

const DEFAULT_SETTINGS = {
  speech: 60,
  tieSpeech: 30,
  lastWord: 60,
  nightCheck: 15,
  sound: true,
  haptics: true,
  theme: 'dark',
  firstDaySingleNoVote: true,
  lastGetsRemainder: true,
  penaltyMode: 'tournament'
};

const THEMES = ['dark', 'light', 'cafe'];
const THEME_COLORS = { dark: '#101012', light: '#f5f2ec', cafe: '#1a110d' };

const CHANNEL_NAME = 'mafia-desk-live';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const $ = selector => document.querySelector(selector);
const appRoot = $('#app');
const modalRoot = $('#modal-root');
const tooltipRoot = $('#tooltip-root');

let app = {
  route: 'home',
  players: [],
  games: [],
  settings: { ...DEFAULT_SETTINGS },
  draft: null,
  game: null,
  modal: null,
  tooltip: null,
  installPrompt: null,
  undo: [],
  timerHandle: null,
  wakeLock: null,
  toastHandle: null,
  search: ''
};

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
  return new Intl.DateTimeFormat('uk-UA', withTime
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
  if (player?.avatar) return `<img class="avatar ${size}" src="${esc(player.avatar)}" alt="Фото ${esc(player.name)}">`;
  return `<span class="avatar avatar-fallback ${size}" aria-hidden="true">${esc(initials(player?.name))}</span>`;
}
function roleOf(seat) { return ROLE_DECK.find(role => role.key === seat?.role) || null; }
function teamOf(seat) { return roleOf(seat)?.team || null; }
function activeGames() { return app.games.filter(game => game.status === 'active').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
function finishedGames() { return app.games.filter(game => game.status === 'finished').sort((a, b) => (b.endedAt || b.updatedAt).localeCompare(a.endedAt || a.updatedAt)); }
function gameById(id) { return app.games.find(game => game.id === id); }
function playerById(id) { return app.players.find(player => player.id === id); }
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

function beep() {
  if (!app.settings.sound) return;
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 740;
    gain.gain.value = .05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .14);
  } catch { /* Audio is an enhancement. */ }
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
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function headerHtml() {
  const session = getGoogleSession();
  const profileLabel = session.profile?.name || (session.signedIn ? 'Google' : 'Локально');
  return `<header class="shell-header">
    <a class="brand" href="#home" aria-label="Mafia Desk — головна">
      <span class="brand-mark">M</span>
      <span class="brand-copy"><b>Mafia Desk</b><span>${app.game?.status === 'active' ? `Гра · день ${app.game.day}` : 'local-first assistant'}</span></span>
    </a>
    <div class="header-actions">
      ${app.installPrompt ? '<button class="btn small ghost" data-action="install">Встановити</button>' : ''}
      <button class="btn small ghost profile-btn" data-nav="settings" aria-label="Налаштування синхронізації"><i class="sync-dot ${session.signedIn ? 'online' : ''}"></i><span>${esc(profileLabel)}</span></button>
    </div>
  </header>`;
}

function bottomNavHtml() {
  if (app.route === 'reveal' || app.route === 'observer') return '';
  const items = [
    ['home', 'Огляд'], ['players', 'Гравці'], ['setup', 'Нова гра'], ['stats', 'Статистика'], ['settings', 'Ще']
  ];
  return `<nav class="bottom-nav" aria-label="Основна навігація">${items.map(([route, label]) => `
    <a class="nav-item ${app.route === route ? 'active' : ''}" href="#${route}">${navIcon(route)}<span>${label}</span></a>`).join('')}</nav>`;
}

function help(label, text) {
  return `<span class="label-with-help"><span>${label}</span><button class="help" type="button" data-tooltip="${esc(text)}" aria-label="Пояснення: ${esc(label)}">?</button></span>`;
}

function homeView() {
  const recent = finishedGames().slice(0, 5);
  const active = activeGames()[0];
  const stats = aggregateStats();
  return `<main class="page stack">
    <section class="card hero">
      <div class="eyebrow">Ведучий · оглядач · гравець</div>
      <h1>Тримайте гру <span>під контролем.</span></h1>
      <p>Ролі, таймер, фоли, голосування, нічні перевірки та протокол — у мобільному інтерфейсі, що працює локально й без постійного інтернету.</p>
      <div class="actions"><button class="btn gold" data-nav="setup">Створити партію</button><button class="btn ghost" data-nav="players">Додати гравців</button></div>
    </section>
    ${active ? `<section class="card continue-card">
      <div><div class="eyebrow">Незавершена партія</div><h3>${esc(active.title)}</h3><div class="continue-meta">${phaseLabel(active)} · ${active.seats.filter(seat => seat.status === 'alive').length}/10 за столом · ${formatDate(active.updatedAt, true)}</div></div>
      <button class="btn primary" data-action="resume-game" data-id="${active.id}">Продовжити</button>
    </section>` : ''}
    <section class="stat-grid">
      <article class="card stat-card"><b>${stats.games}</b><span>завершених партій</span></article>
      <article class="card stat-card"><b>${app.players.length}</b><span>гравців у базі</span></article>
      <article class="card stat-card"><b>${stats.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${formatDuration(stats.totalSeconds)}</b><span>за ігровим столом</span></article>
    </section>
    <section class="card card-pad">
      <div class="section-title"><div><h2>Останні партії</h2><p>Архів зберігається на цьому пристрої</p></div><button class="btn small ghost" data-nav="stats">Усі</button></div>
      ${recent.length ? `<div class="list">${recent.map(gameRow).join('')}</div>` : '<div class="empty">Завершені партії з’являться тут. Створіть першу гру — усі дії потраплять до протоколу.</div>'}
    </section>
  </main>`;
}

function gameRow(game) {
  const winner = game.winner === 'red' ? 'Місто' : game.winner === 'black' ? 'Мафія' : 'Не визначено';
  return `<div class="list-row"><div class="list-main"><b>${esc(game.title)}</b><span>${formatDate(game.endedAt || game.updatedAt, true)} · ${formatDuration(game.durationSeconds)}</span></div><span class="badge ${game.winner === 'red' ? 'red' : ''}">${winner}</span></div>`;
}

function playersView() {
  const query = app.search.trim().toLocaleLowerCase('uk');
  const players = app.players.filter(player => !query || `${player.name} ${player.nickname || ''} ${player.notes || ''}`.toLocaleLowerCase('uk').includes(query));
  return `<main class="page">
    <div class="page-head"><div><h1>Гравці</h1><p>Постійний довідник, фото, нотатки та накопичена статистика.</p></div><button class="btn gold" data-action="new-player">+ Додати</button></div>
    <div class="search-row"><input class="input" type="search" data-input="player-search" value="${esc(app.search)}" placeholder="Пошук за ім’ям або нотаткою"><button class="btn icon" data-action="new-player" aria-label="Додати гравця">+</button></div>
    ${players.length ? `<section class="player-grid">${players.map(playerCard).join('')}</section>` : '<div class="empty">Нікого не знайдено. Додайте профіль із фото — його можна буде швидко посадити за будь-який стіл.</div>'}
  </main>`;
}

function statsForPlayer(playerId) {
  const appearances = finishedGames().flatMap(game => game.seats.map(seat => ({ game, seat }))).filter(item => item.seat.profileId === playerId);
  const wins = appearances.filter(({ game, seat }) => game.winner && game.winner === teamOf(seat)).length;
  return { games: appearances.length, wins, winRate: appearances.length ? Math.round(wins / appearances.length * 100) : 0 };
}

function playerCard(player) {
  const stats = statsForPlayer(player.id);
  return `<article class="card player-card">
    ${avatar(player)}
    <div><h3>${esc(player.name)}</h3><p>${esc(player.nickname ? `«${player.nickname}» · ${player.notes || 'без нотаток'}` : player.notes || 'Без додаткового опису')}</p><div class="player-stats"><span>${stats.games} ігор</span><span>${stats.winRate}% перемог</span></div></div>
    <button class="icon-btn" data-action="edit-player" data-id="${player.id}" aria-label="Редагувати ${esc(player.name)}">•••</button>
  </article>`;
}

function createDraft() {
  return {
    title: `Мафія · ${new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(new Date())}`,
    venue: '', notes: '',
    settings: { ...app.settings },
    seats: Array.from({ length: 10 }, (_, index) => ({ number: index + 1, profileId: '', name: `Гравець ${index + 1}` }))
  };
}

function setupView() {
  if (!app.draft) app.draft = createDraft();
  return `<main class="page">
    <div class="page-head"><div><h1>Нова партія</h1><p>Спортивний стіл: 10 гравців, 7 червоних і 3 чорних.</p></div></div>
    <div class="setup-grid">
      <section class="card card-pad stack">
        <div class="section-title"><div><h2>Партія</h2><p>Назва потрапить до архіву</p></div></div>
        <div class="field"><label for="game-title">Назва</label><input id="game-title" class="input" data-draft="title" value="${esc(app.draft.title)}" maxlength="80"></div>
        <div class="field"><label for="game-venue">Місце / клуб</label><input id="game-venue" class="input" data-draft="venue" value="${esc(app.draft.venue)}" maxlength="100" placeholder="Необов’язково"></div>
        <div class="field"><label for="game-notes">Нотатка ведучого</label><textarea id="game-notes" class="textarea" data-draft="notes" maxlength="500" placeholder="Турнір, номер столу, особливі умови…">${esc(app.draft.notes)}</textarea></div>
      </section>
      <section class="card card-pad">
        <div class="section-title"><div><h2>Правила й таймери</h2><p>Можна змінити і під час гри</p></div></div>
        <div class="setup-options">
          ${numberField('Промова, сек', 'speech', app.draft.settings.speech, 'Основний час промови гравця.')}
          ${numberField('Автокатастрофа, сек', 'tieSpeech', app.draft.settings.tieSpeech, 'Додаткова промова кандидатів після нічиєї.')}
          ${numberField('Останнє слово, сек', 'lastWord', app.draft.settings.lastWord, 'Час гравця, який залишає стіл.')}
          ${numberField('Нічна дія, сек', 'nightCheck', app.draft.settings.nightCheck, 'Орієнтир для пострілу або перевірки.')}
        </div>
        <div class="divider"></div>
        <div class="field"><label>Система фолів</label><select class="select" data-draft-setting="penaltyMode"><option value="tournament" ${app.draft.settings.penaltyMode === 'tournament' ? 'selected' : ''}>Турнірна</option><option value="club" ${app.draft.settings.penaltyMode === 'club' ? 'selected' : ''}>Клубна</option></select></div>
      </section>
    </div>
    <section class="card card-pad" style="margin-top:14px">
      <div class="section-title"><div><h2>Розсадка</h2><p>Оберіть профіль або залиште тимчасове ім’я</p></div><button class="btn small ghost" data-action="shuffle-seats">Перемішати</button></div>
      <div class="seat-setup">${app.draft.seats.map(setupSeat).join('')}</div>
      <div class="actions" style="margin-top:14px"><button class="btn ghost" data-action="new-player">+ Новий профіль</button><button class="btn gold" data-action="start-game">Роздати ролі</button></div>
    </section>
  </main>`;
}

function numberField(label, key, value, tooltip) {
  return `<div class="field"><label>${help(label, tooltip)}</label><input class="input" type="number" min="5" max="180" step="5" data-draft-setting="${key}" value="${value}"></div>`;
}

function setupSeat(seat) {
  const options = app.players.map(player => `<option value="${player.id}" ${seat.profileId === player.id ? 'selected' : ''}>${esc(player.name)}${player.nickname ? ` · ${esc(player.nickname)}` : ''}</option>`).join('');
  return `<div class="seat-setup-row"><span class="seat-no">${seat.number}</span><div class="grid" style="gap:6px"><select class="select" data-seat-profile="${seat.number}"><option value="">Тимчасовий гравець</option>${options}</select>${seat.profileId ? '' : `<input class="input" data-seat-name="${seat.number}" value="${esc(seat.name)}" maxlength="60" aria-label="Ім’я гравця на місці ${seat.number}">`}</div></div>`;
}

function aggregateStats() {
  const games = finishedGames();
  const totalSeconds = games.reduce((sum, game) => sum + (game.durationSeconds || 0), 0);
  const redWins = games.filter(game => game.winner === 'red').length;
  return { games: games.length, totalSeconds, redWinRate: games.length ? Math.round(redWins / games.length * 100) : 0 };
}

function statsView() {
  const games = finishedGames();
  const aggregate = aggregateStats();
  const leaderboard = app.players.map(player => ({ player, ...statsForPlayer(player.id) })).filter(row => row.games).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate).slice(0, 10);
  const roles = ['citizen', 'sheriff', 'mafia', 'don'].map(key => {
    const appearances = games.flatMap(game => game.seats.map(seat => ({ game, seat }))).filter(item => item.seat.role === key);
    const wins = appearances.filter(item => item.game.winner === teamOf(item.seat)).length;
    return { label: ROLE_DECK.find(role => role.key === key)?.label || key, games: appearances.length, rate: appearances.length ? Math.round(wins / appearances.length * 100) : 0 };
  });
  return `<main class="page stack">
    <div class="page-head"><div><h1>Статистика</h1><p>Результати всіх завершених партій на цьому пристрої.</p></div></div>
    <section class="stat-grid">
      <article class="card stat-card"><b>${aggregate.games}</b><span>партій</span></article>
      <article class="card stat-card"><b>${aggregate.redWinRate}%</b><span>перемог міста</span></article>
      <article class="card stat-card"><b>${100 - aggregate.redWinRate}%</b><span>перемог мафії</span></article>
      <article class="card stat-card"><b>${formatDuration(aggregate.totalSeconds)}</b><span>загальний час</span></article>
    </section>
    <div class="grid two">
      <section class="card card-pad"><div class="section-title"><div><h2>Результативність ролей</h2><p>Частка перемог команди гравця</p></div></div><div class="bar-chart">${roles.map(role => `<div class="bar-row"><span>${esc(role.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${role.rate}%"></div></div><span class="bar-value">${role.rate}%</span></div>`).join('')}</div></section>
      <section class="card card-pad"><div class="section-title"><div><h2>Гравці</h2><p>За кількістю перемог</p></div></div>${leaderboard.length ? `<div class="list">${leaderboard.map((row, index) => `<div class="list-row"><div style="display:flex;align-items:center;gap:9px"><b class="muted">${index + 1}</b>${avatar(row.player, 'small')}<div class="list-main"><b>${esc(row.player.name)}</b><span>${row.games} ігор · ${row.winRate}% перемог</span></div></div><b>${row.wins}</b></div>`).join('')}</div>` : '<div class="empty">Рейтинг з’явиться після першої завершеної партії.</div>'}</section>
    </div>
    <section class="card card-pad"><div class="section-title"><div><h2>Архів партій</h2><p>Протоколи залишаються доступними офлайн</p></div></div>${games.length ? `<div class="list">${games.map(game => `${gameRow(game)}<div class="actions"><button class="btn small ghost" data-action="view-protocol" data-id="${game.id}">Протокол</button><button class="btn small danger" data-action="delete-game" data-id="${game.id}">Видалити</button></div>`).join('')}</div>` : '<div class="empty">Архів поки порожній.</div>'}</section>
  </main>`;
}

function settingsView() {
  const session = getGoogleSession();
  const lastSync = app.cloudSync ? formatDate(app.cloudSync, true) : 'ще не виконувалась';
  return `<main class="page stack">
    <div class="page-head"><div><h1>Налаштування</h1><p>Оформлення, офлайн-робота, резервні копії та Google Drive.</p></div></div>
    <div class="grid two">
      <section class="card card-pad">
        <div class="section-title"><div><h2>На цьому пристрої</h2><p>Основна база працює без сервера</p></div></div>
        <div class="stack">
          <div class="field">
            <span class="field-label">Тема оформлення</span>
            <div class="theme-picker" role="group" aria-label="Тема оформлення">
              ${themeChoice('dark', 'Темна', 'Для приглушеного світла')}
              ${themeChoice('light', 'Світла', 'Для денного освітлення')}
              ${themeChoice('cafe', 'Кав’ярня', 'Теплі кавові відтінки')}
            </div>
          </div>
          ${toggleRow('setting-sound', 'Звуковий сигнал таймера', app.settings.sound)}
          ${toggleRow('setting-haptics', 'Вібрація важливих дій', app.settings.haptics)}
        </div>
        <div class="divider"></div>
        <div class="actions"><button class="btn" data-action="export-data">Експорт JSON</button><button class="btn" data-action="import-data">Імпорт</button></div>
        <p class="field-hint">JSON містить профілі, стиснені фото, архів і налаштування. Зберігайте файл приватно: протоколи можуть містити ролі.</p>
      </section>
      <section class="card card-pad">
        <div class="section-title"><div><h2>Google OAuth + Drive</h2><p>Опційна приватна резервна копія</p></div><span class="badge ${session.signedIn ? 'green' : ''}">${session.signedIn ? 'Підключено' : 'Вимкнено'}</span></div>
        <div class="field"><label>${help('OAuth Client ID', 'Публічний ідентифікатор Web application із Google Cloud Console. Client secret для статичної сторінки не потрібен і не повинен потрапляти в код.')}</label><input class="input" data-input="google-client-id" value="${esc(app.googleClientId || '')}" placeholder="000000000000-….apps.googleusercontent.com" autocomplete="off"></div>
        <div class="actions" style="margin-top:10px">
          ${session.signedIn ? '<button class="btn" data-action="cloud-push">Зберегти у Drive</button><button class="btn" data-action="cloud-pull">Відновити з Drive</button><button class="btn ghost" data-action="google-signout">Вийти</button>' : '<button class="btn primary" data-action="google-signin">Увійти через Google</button>'}
        </div>
        <p class="field-hint">Остання синхронізація: ${lastSync}. Копія лежить у прихованій папці застосунку; сайт не бачить інші файли Drive.</p>
      </section>
    </div>
    <section class="privacy-note"><b>Local-first:</b> авторизація не потрібна для гри. Без Google усі дані залишаються лише у браузері. Очищення даних сайту або приватний режим можуть їх видалити, тому періодично робіть експорт.</section>
    <section class="card card-pad"><div class="section-title"><div><h2>Режим оглядача</h2><p>Публічний екран без ролей і нічних результатів</p></div></div><p class="muted">Відкрийте його у другій вкладці або на під’єднаному дисплеї. Оновлення передаються через BroadcastChannel у межах цього браузера.</p><button class="btn" data-action="open-observer" ${app.game?.status === 'active' ? '' : 'disabled'}>Відкрити публічний екран</button></section>
    <section class="card card-pad"><div class="section-title"><div><h2>Про застосунок</h2><p>Версія 1.1 · без збірки та залежностей</p></div></div><p class="muted">Встановлюється як PWA, працює на GitHub Pages і кешує оболонку для офлайн-запуску.</p></section>
  </main>`;
}

function themeChoice(value, label, description) {
  const selected = app.settings.theme === value;
  return `<button class="theme-choice ${selected ? 'selected' : ''}" type="button" data-action="set-theme" data-theme-choice="${value}" aria-pressed="${selected}"><span class="theme-preview" aria-hidden="true"><i></i><i></i><i></i></span><b>${label}</b><small>${description}</small></button>`;
}

function toggleRow(action, label, enabled) {
  return `<div class="toggle-row"><span>${label}</span><button class="switch ${enabled ? 'on' : ''}" data-action="${action}" role="switch" aria-checked="${enabled}" aria-label="${esc(label)}"></button></div>`;
}

function revealView() {
  const game = app.game;
  if (!game) return missingGameView();
  const seat = game.seats[game.revealIndex];
  const role = roleOf(seat);
  return `<main class="page reveal-page"><section class="card reveal-card">
    <div class="eyebrow">Передайте телефон особисто</div><div class="reveal-seat">${seat.number}</div><h1>${esc(seat.name)}</h1>
    ${game.revealOpen ? `<div class="role-reveal ${role.team === 'black' ? 'black' : ''}"><div class="role-symbol">${role.symbol}</div><div class="role-name">${role.label}</div><div class="badge ${role.team === 'red' ? 'red' : ''}">${role.team === 'red' ? 'Червона команда' : 'Чорна команда'}</div><p>${role.description}</p></div><button class="btn primary wide" data-action="reveal-next">Сховати й передати далі</button>` : `<p>Переконайтеся, що екран бачить лише гравець №${seat.number}. Після перегляду роль буде знову прихована.</p><button class="btn gold wide" data-action="reveal-role">Показати мою роль</button>`}
    <p class="field-hint">${game.revealIndex + 1} із ${game.seats.length} · скриншоти технічно неможливо гарантовано заблокувати у браузері</p>
  </section></main>`;
}

function missingGameView() {
  return `<main class="page"><div class="empty">Активну партію не знайдено. <button class="btn small" data-nav="setup">Створити гру</button></div></main>`;
}

function phaseLabel(game = app.game) {
  if (!game) return 'Немає гри';
  const labels = {
    reveal: 'Роздача ролей', zeroNight: 'Нульова ніч', day: `День ${game.day}`,
    vote: `Голосування · день ${game.day}`, tieSpeech: 'Автокатастрофа · промови', tieVote: 'Автокатастрофа · голосування',
    allTie: 'Вихід усіх кандидатів', lastWord: 'Останнє слово', night: `Ніч ${game.day}`, finished: 'Гру завершено'
  };
  return labels[game.phase] || game.phase;
}

function phaseDescription(game) {
  if (game.phase === 'day') return game.subphase === 'speeches' ? `Промова гравця №${currentSpeaker()?.number || '—'}` : 'Номінації сформовано';
  if (game.phase === 'night') return ['Місто засинає', 'Мафія стріляє', 'Дон шукає Шерифа', 'Шериф перевіряє місто', 'Місто прокидається'][game.night.step] || '';
  if (game.phase === 'zeroNight') return 'Чорна команда знайомиться';
  if (game.phase === 'lastWord') return `Гравець №${game.lastWordSeat}`;
  if (game.phase === 'tieSpeech') return `Промова гравця №${game.vote.tied[game.speakerIndex] || '—'}`;
  return `${aliveSeats().length} гравців за столом`;
}

function gameView(observer = false) {
  const game = app.game;
  if (!game) return missingGameView();
  if (game.phase === 'finished') return winnerView(observer);
  return `<main class="page game-page"><div class="game-workspace">
    <section class="card phase-strip game-top"><div class="phase-copy"><i class="phase-dot ${['night', 'zeroNight'].includes(game.phase) ? 'night' : ''}"></i><div><h1>${phaseLabel(game)}</h1><p>${phaseDescription(game)}</p></div></div><div class="phase-stats"><b>${aliveSeats().length}</b>/10 живих</div></section>
    <div class="game-body">${tableHtml(observer)}${phaseControlHtml(observer)}</div>
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
  return `<button class="game-seat ${current ? 'current' : ''} ${nominated ? 'nominated' : ''} ${seat.status === 'dead' ? 'dead' : ''}" ${observer ? '' : `data-action="seat-menu" data-seat="${seat.number}"`} aria-label="Гравець ${seat.number}, ${esc(seat.name)}${tags ? `, ${tags}` : ''}">
    <span class="seat-top"><span class="num">${seat.number}</span><span class="fault-mini">${'●'.repeat(seat.faults)}${'○'.repeat(Math.max(0, 4 - seat.faults))}</span></span>
    ${avatar({ ...profile, name: seat.name }, '')}<span class="seat-name">${esc(seat.name)}</span><span class="seat-tag ${nominated ? 'alert' : ''}">${tags}</span>
  </button>`;
}

function phaseControlHtml(observer) {
  const game = app.game;
  if (observer) return `<section class="card phase-panel"><div class="eyebrow">Публічний екран</div><h2>${phaseDescription(game)}</h2>${['day', 'tieSpeech', 'lastWord'].includes(game.phase) ? `<div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div>` : '<p>Ведучий керує поточною фазою на своєму екрані.</p>'}</section>`;
  if (game.phase === 'zeroNight') return `<section class="card phase-panel"><div class="night-symbol">◐</div><div class="eyebrow">Нульова ніч</div><h2>Мафія прокидається</h2><p>Дон і двоє гравців Мафії знайомляться та без слів узгоджують порядок відстрілу.</p><button class="btn gold" data-action="zero-to-day">Почати день 1</button></section>`;
  if (game.phase === 'day') return dayControlHtml();
  if (game.phase === 'vote' || game.phase === 'tieVote') return voteControlHtml();
  if (game.phase === 'tieSpeech') return tieSpeechHtml();
  if (game.phase === 'allTie') return allTieHtml();
  if (game.phase === 'lastWord') return lastWordHtml();
  if (game.phase === 'night') return nightHtml();
  return '';
}

function timerControls(nextAction, nextLabel) {
  const game = app.game;
  return `<div class="timer ${game.timer.remaining <= 10 ? 'danger' : ''}">${formatTimer(game.timer.remaining)}</div>
    <div class="timer-controls"><button class="btn icon" data-action="timer-minus" aria-label="Мінус 5 секунд">−5</button><button class="btn primary" data-action="timer-toggle">${game.timer.running ? 'Пауза' : 'Старт'}</button><button class="btn icon" data-action="timer-plus" aria-label="Плюс 5 секунд">+5</button></div>
    <div class="primary-game-actions"><button class="btn ghost" data-action="timer-reset">Скинути</button><button class="btn gold" data-action="${nextAction}">${nextLabel}</button></div>`;
}

function dayControlHtml() {
  const game = app.game;
  if (game.subphase === 'dayEnd') return `<section class="card control-card"><div class="section-title"><div><h2>Коло завершено</h2><p>${game.nominations.length ? `Кандидатів: ${game.nominations.length}` : 'Кандидатур немає'}</p></div></div>${nominationChips()}<div class="actions" style="margin-top:13px"><button class="btn ghost" data-action="back-to-speeches">Назад</button><button class="btn gold" data-action="start-vote">${game.nominations.length ? 'До голосування' : 'Перейти до ночі'}</button></div></section>`;
  const speaker = currentSpeaker();
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Поточна промова</div><h2>№${speaker?.number || '—'} · ${esc(speaker?.name || '—')}</h2></div><span class="badge gold">${game.speakerIndex + 1}/${game.speakerOrder.length}</span></div>${timerControls('next-speaker', game.speakerIndex >= game.speakerOrder.length - 1 ? 'Завершити коло' : 'Наступний →')}${game.nominations.length ? `<div class="divider"></div>${nominationChips()}` : ''}</section>`;
}

function nominationChips() {
  return app.game.nominations.length ? `<div class="nom-list">${app.game.nominations.map(number => `<button class="nom-chip" data-action="remove-nomination" data-seat="${number}">№${number} · ${esc(seatByNo(number)?.name)} ×</button>`).join('')}</div>` : '<div class="empty">Номінацій ще немає. Натисніть картку гравця під час промови.</div>';
}

function voteCandidates() {
  return app.game.phase === 'tieVote' ? app.game.vote.tied : app.game.nominations;
}

function voteControlHtml() {
  const candidates = voteCandidates();
  const total = candidates.reduce((sum, number) => sum + (app.game.vote.counts[number] || 0), 0);
  return `<section class="card control-card"><div class="section-title"><div><h2>${app.game.phase === 'tieVote' ? 'Повторне голосування' : 'Голосування'}</h2><p>Зафіксовано ${total} із ${voterCount()} голосів</p></div><button class="btn small ghost" data-action="fill-remainder">Залишок останньому</button></div><div class="vote-grid">${candidates.map(number => `<div class="vote-card"><h3>№${number} · ${esc(seatByNo(number)?.name)}</h3><div class="vote-count">${app.game.vote.counts[number] || 0}</div><div class="stepper"><button class="btn" data-action="vote-minus" data-seat="${number}">−</button><button class="btn" data-action="vote-plus" data-seat="${number}">+</button></div></div>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="btn ghost" data-action="cancel-vote">Назад</button><button class="btn gold" data-action="finish-vote">Підсумувати</button></div></section>`;
}

function tieSpeechHtml() {
  const number = app.game.vote.tied[app.game.speakerIndex];
  const seat = seatByNo(number);
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Автокатастрофа · додаткова промова</div><h2>№${number} · ${esc(seat?.name)}</h2></div><span class="badge gold">${app.game.speakerIndex + 1}/${app.game.vote.tied.length}</span></div>${timerControls('next-tie-speaker', app.game.speakerIndex >= app.game.vote.tied.length - 1 ? 'Голосувати' : 'Наступний →')}</section>`;
}

function allTieHtml() {
  const total = app.game.vote.yes + app.game.vote.no;
  return `<section class="card control-card"><div class="section-title"><div><h2>Вивести всіх кандидатів?</h2><p>Повторна нічия між ${app.game.vote.tied.map(number => `№${number}`).join(', ')}</p></div></div><div class="vote-grid"><div class="vote-card"><h3>ЗА вихід усіх</h3><div class="vote-count success-text">${app.game.vote.yes}</div><div class="stepper"><button class="btn" data-action="all-minus" data-kind="yes">−</button><button class="btn" data-action="all-plus" data-kind="yes">+</button></div></div><div class="vote-card"><h3>ПРОТИ</h3><div class="vote-count danger-text">${app.game.vote.no}</div><div class="stepper"><button class="btn" data-action="all-minus" data-kind="no">−</button><button class="btn" data-action="all-plus" data-kind="no">+</button></div></div></div><p class="muted" style="text-align:center">Зафіксовано ${total} із ${voterCount()} голосів</p><button class="btn gold wide" data-action="finish-all-tie">Підсумувати</button></section>`;
}

function lastWordHtml() {
  const seat = seatByNo(app.game.lastWordSeat);
  const hasMore = app.game.pendingLastWords?.length;
  const next = hasMore ? 'Наступне слово →' : app.game.afterNightKill ? 'Наступний день →' : 'Перейти до ночі →';
  return `<section class="card control-card"><div class="speaker-row"><div><div class="eyebrow">Останнє слово</div><h2>№${seat?.number || '—'} · ${esc(seat?.name || '—')}</h2></div></div>${timerControls('finish-last-word', next)}</section>`;
}

function nightHtml() {
  const game = app.game;
  const step = game.night.step;
  if (step === 0) return `<section class="card phase-panel"><div class="night-symbol">☾</div><div class="eyebrow">Ніч ${game.day}</div><h2>Місто засинає</h2><p>Усі живі гравці надягають маски. Перевірте тишу та посадку.</p><button class="btn gold" data-action="night-next">Далі: стрільба мафії</button></section>`;
  if (step === 1) return nightTargetPanel('⌁', 'Мафія стріляє', 'Зафіксуйте узгоджену ціль або промах.', game.night.target, `<button class="btn ghost" data-action="night-miss">Промах</button><button class="btn gold" data-action="night-shot-done" ${game.night.target == null ? 'disabled' : ''}>Зафіксувати</button>`);
  if (step === 2) return nightCheckPanel('don');
  if (step === 3) return nightCheckPanel('sheriff');
  const target = game.night.target === -1 ? null : seatByNo(game.night.target);
  return `<section class="card phase-panel"><div class="night-symbol">☀</div><div class="eyebrow">Ранок</div><h2>Місто прокидається</h2><p>${target ? `Вночі вибуває гравець №${target.number} · ${esc(target.name)}.` : 'Мафія промахнулася. Усі залишаються за столом.'}</p><button class="btn gold" data-action="wake-city">${target ? 'Оголосити вибуття' : 'Почати наступний день'}</button></section>`;
}

function targetsHtml(selected) {
  return `<div class="target-grid">${app.game.seats.map(seat => `<button class="target ${seat.status === 'dead' ? 'dead' : ''} ${selected === seat.number ? 'selected' : ''}" data-action="night-target" data-seat="${seat.number}"><b>${seat.number}</b>${esc(seat.name)}</button>`).join('')}</div>`;
}

function nightTargetPanel(symbol, title, text, selected, actions) {
  return `<section class="card phase-panel"><div class="night-symbol">${symbol}</div><div class="eyebrow">Ніч ${app.game.day}</div><h2>${title}</h2><p>${text}</p>${targetsHtml(selected)}<div class="actions">${actions}</div></section>`;
}

function nightCheckPanel(kind) {
  const isDon = kind === 'don';
  const game = app.game;
  const roleAlive = aliveSeats().some(seat => seat.role === (isDon ? 'don' : 'sheriff'));
  const selected = isDon ? game.night.donCheck : game.night.sheriffCheck;
  if (!roleAlive) return `<section class="card phase-panel"><div class="night-symbol">${isDon ? '◆' : '★'}</div><div class="eyebrow">Ніч ${game.day}</div><h2>${isDon ? 'Дон шукає Шерифа' : 'Шериф перевіряє місто'}</h2><p>Роль уже вибула. Оголосіть фазу та витримайте паузу, щоб не розкрити це столу.</p><button class="btn gold" data-action="night-skip-check">Продовжити</button></section>`;
  let result = '';
  if (selected && game.night.resultOpen) {
    const seat = seatByNo(selected);
    const hit = isDon ? seat.role === 'sheriff' : teamOf(seat) === 'black';
    result = `<div class="privacy-note"><b>Результат: ${isDon ? (hit ? 'ЦЕ ШЕРИФ' : 'НЕ ШЕРИФ') : (hit ? 'ЧОРНИЙ' : 'ЧЕРВОНИЙ')}</b><br>Сховайте результат після сигналу гравцеві.</div>`;
  }
  return nightTargetPanel(isDon ? '◆' : '★', isDon ? 'Дон шукає Шерифа' : 'Шериф перевіряє місто', isDon ? 'Дон показує номер одного гравця.' : 'Шериф показує номер одного гравця.', selected, `${result}${selected && !game.night.resultOpen ? '<button class="btn primary" data-action="night-show-result">Показати результат</button>' : ''}<button class="btn gold" data-action="night-check-done" ${selected ? '' : 'disabled'}>Далі</button>`);
}

function moderatorSideHtml() {
  const game = app.game;
  const black = game.seats.filter(seat => teamOf(seat) === 'black');
  return `<section class="card card-pad"><div class="section-title"><div><h3>Панель ведучого</h3><p>Приватна інформація</p></div><button class="btn small ghost" data-action="toggle-secret">${game.showSecrets ? 'Сховати' : 'Ролі'}</button></div>${game.showSecrets ? `<div class="nom-list">${black.map(seat => `<span class="badge">${roleOf(seat).symbol} №${seat.number} ${esc(seat.name)}</span>`).join('')}</div>` : '<div class="privacy-note">Ролі приховані від випадкового погляду.</div>'}<div class="divider"></div><div class="actions"><button class="btn small ghost" data-action="undo" ${app.undo.length ? '' : 'disabled'}>↶ Скасувати</button><button class="btn small ghost" data-action="game-settings">⚙ Таймери</button><button class="btn small ghost" data-action="copy-protocol">Копіювати протокол</button><button class="btn small ghost" data-action="open-observer">Оглядач</button></div></section>
    <section class="card card-pad"><div class="section-title"><div><h3>Протокол</h3><p>${game.history.length} подій</p></div></div><div class="quick-log">${game.history.slice(0, 25).map(event => `<div class="log-item"><time>${esc(event.time)}</time>${esc(event.text)}</div>`).join('') || '<div class="empty">Подій ще немає</div>'}</div></section>
    <button class="btn danger wide" data-action="end-game-manual">Завершити партію</button>`;
}

function observerSideHtml() {
  return `<section class="card card-pad"><div class="section-title"><div><h3>Публічна інформація</h3><p>Без ролей і нічних результатів</p></div></div>${nominationChipsObserver()}<div class="divider"></div><p class="field-hint">Ця вкладка синхронізується з екраном ведучого в межах одного браузера.</p></section>`;
}

function nominationChipsObserver() {
  return app.game.nominations.length ? `<div class="nom-list">${app.game.nominations.map(number => `<span class="badge red">№${number} ${esc(seatByNo(number)?.name)}</span>`).join('')}</div>` : '<span class="muted">Немає кандидатів</span>';
}

function winnerView(observer = false) {
  const red = app.game.winner === 'red';
  return `<main class="page"><section class="card winner"><div class="winner-symbol ${red ? 'danger-text' : ''}">${red ? '★' : '◆'}</div><div class="eyebrow">Фінал партії</div><h1>${red ? 'Перемога мирного міста' : 'Перемога чорної команди'}</h1><p class="muted">${red ? 'Усі гравці чорної команди вибули.' : 'Чорна команда досягла паритету з містом.'}</p>${observer ? '' : `<div class="actions" style="justify-content:center"><button class="btn" data-action="copy-protocol">Копіювати протокол</button><button class="btn gold" data-action="rematch">Реванш</button><button class="btn ghost" data-nav="home">На головну</button></div>`}</section></main>`;
}

function playerModalHtml() {
  const player = app.modal.player;
  const editing = Boolean(player.id);
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal" data-form="player" aria-modal="true" role="dialog">
    <div class="section-title"><div><h2>${editing ? 'Профіль гравця' : 'Новий гравець'}</h2><p>Фото стискається локально перед збереженням</p></div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Закрити">×</button></div>
    <div class="avatar-editor">${avatar(player, 'large')}<div><div class="avatar-source-actions"><label class="btn primary" for="avatar-camera">📷 Зробити фото</label><input id="avatar-camera" class="visually-hidden" type="file" accept="image/*" capture="environment" data-input="avatar-camera"><label class="btn" for="avatar-gallery">Обрати з галереї</label><input id="avatar-gallery" class="visually-hidden" type="file" accept="image/*" data-input="avatar-gallery"></div><p class="field-hint">Камера може запросити дозвіл. Знімок обрізається до квадрата, стискається до 512×512 px і не відправляється в мережу.</p></div></div>
    <div class="stack">
      <div class="field"><label for="player-name">Ім’я *</label><input id="player-name" class="input" name="name" value="${esc(player.name || '')}" maxlength="60" required autofocus></div>
      <div class="field"><label for="player-nickname">Нік / позивний</label><input id="player-nickname" class="input" name="nickname" value="${esc(player.nickname || '')}" maxlength="40"></div>
      <div class="field"><label for="player-contact">Контакт або клуб</label><input id="player-contact" class="input" name="contact" value="${esc(player.contact || '')}" maxlength="100" placeholder="Необов’язково"></div>
      <div class="field"><label for="player-notes">Опис і нотатки</label><textarea id="player-notes" class="textarea" name="notes" maxlength="600" placeholder="Стиль гри, організаційні деталі…">${esc(player.notes || '')}</textarea></div>
    </div>
    <div class="modal-actions">${editing ? '<button class="btn danger" type="button" data-action="delete-player">Видалити</button>' : ''}<button class="btn ghost" type="button" data-action="close-modal">Скасувати</button><button class="btn gold" type="submit">Зберегти</button></div>
  </form></div>`;
}

function seatModalHtml() {
  const seat = seatByNo(app.modal.seat);
  const role = roleOf(seat);
  const canNominate = app.game.phase === 'day' && app.game.subphase === 'speeches' && seat.status === 'alive' && currentSpeaker()?.number !== seat.number && !app.game.nominations.includes(seat.number);
  return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal" aria-modal="true" role="dialog">
    <div class="seat-sheet-head">${avatar({ ...(seat.profileId ? playerById(seat.profileId) : {}), name: seat.name }, 'large')}<div><div class="eyebrow">Місце №${seat.number}</div><h2>${esc(seat.name)}</h2><span class="badge">${seat.status === 'alive' ? 'За столом' : 'Вибув'}</span></div></div>
    <div class="divider"></div>
    <div class="list"><div class="list-row"><span class="muted">Фоли</span><b>${seat.faults} / 4</b></div>${app.game.showSecrets ? `<div class="list-row"><span class="muted">Роль</span><b>${role?.symbol} ${role?.label}</b></div>` : ''}${seat.eliminatedReason ? `<div class="list-row"><span class="muted">Причина вибуття</span><b>${esc(seat.eliminatedReason)}</b></div>` : ''}</div>
    <div class="divider"></div>
    <div class="seat-action-grid"><button class="btn" data-action="add-fault" data-seat="${seat.number}" ${seat.status === 'alive' && seat.faults < 4 ? '' : 'disabled'}>+ Фол</button><button class="btn" data-action="remove-fault" data-seat="${seat.number}" ${seat.faults ? '' : 'disabled'}>− Фол</button><button class="btn primary" data-action="nominate" data-seat="${seat.number}" ${canNominate ? '' : 'disabled'}>Виставити</button>${seat.status === 'alive' ? `<button class="btn danger" data-action="manual-eliminate" data-seat="${seat.number}">Вивести</button>` : '<button class="btn" data-action="restore-seat">Повернути</button>'}</div>
    <div class="modal-actions"><button class="btn gold" data-action="close-modal">Готово</button></div>
  </div></div>`;
}

function protocolModalHtml() {
  const game = gameById(app.modal.gameId) || app.game;
  return `<div class="modal-backdrop" data-action="close-modal"><div class="card modal" aria-modal="true" role="dialog"><div class="section-title"><div><h2>Протокол партії</h2><p>${esc(game.title)} · ${formatDate(game.startedAt, true)}</p></div><button class="icon-btn" data-action="close-modal">×</button></div><div class="quick-log" style="max-height:55vh">${game.history.slice().reverse().map(event => `<div class="log-item"><time>${esc(event.time)}</time>${esc(event.text)}</div>`).join('')}</div><div class="modal-actions"><button class="btn" data-action="copy-protocol" data-id="${game.id}">Копіювати</button><button class="btn gold" data-action="close-modal">Закрити</button></div></div></div>`;
}

function confirmModalHtml() {
  return `<div class="modal-backdrop"><div class="card modal" aria-modal="true" role="alertdialog"><h2>${esc(app.modal.title)}</h2><p>${esc(app.modal.text)}</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Скасувати</button><button class="btn danger" data-action="confirm-action">${esc(app.modal.confirmLabel || 'Підтвердити')}</button></div></div></div>`;
}

function gameSettingsModalHtml() {
  const settings = app.game.settings;
  const labels = { speech: 'Промова, сек', tieSpeech: 'Автокатастрофа, сек', lastWord: 'Останнє слово, сек', nightCheck: 'Нічна дія, сек' };
  return `<div class="modal-backdrop" data-action="close-modal"><form class="card modal" data-form="game-settings" role="dialog" aria-modal="true"><div class="section-title"><div><h2>Налаштування партії</h2><p>Нові значення діятимуть із наступної відповідної фази</p></div><button class="icon-btn" type="button" data-action="close-modal">×</button></div><div class="setup-options">${['speech', 'tieSpeech', 'lastWord', 'nightCheck'].map(key => `<div class="field"><label>${labels[key]}</label><input class="input" type="number" name="${key}" min="5" max="180" step="5" value="${settings[key]}"></div>`).join('')}</div><div class="divider"></div><div class="field"><label>Система фолів</label><select class="select" name="penaltyMode"><option value="tournament" ${settings.penaltyMode === 'tournament' ? 'selected' : ''}>Турнірна</option><option value="club" ${settings.penaltyMode === 'club' ? 'selected' : ''}>Клубна</option></select></div><div class="modal-actions"><button class="btn ghost" type="button" data-action="close-modal">Скасувати</button><button class="btn gold" type="submit">Застосувати</button></div></form></div>`;
}

function modalHtml() {
  if (!app.modal) return '';
  if (app.modal.type === 'player') return playerModalHtml();
  if (app.modal.type === 'seat') return seatModalHtml();
  if (app.modal.type === 'protocol') return protocolModalHtml();
  if (app.modal.type === 'confirm') return confirmModalHtml();
  if (app.modal.type === 'game-settings') return gameSettingsModalHtml();
  if (app.modal.type === 'winner') return `<div class="modal-backdrop"><div class="card modal" role="dialog" aria-modal="true"><h2>Хто переміг?</h2><p>Ручне завершення потрібне для нестандартної ситуації або рішення судді.</p><div class="grid two"><button class="btn primary" data-action="finish-red">★ Мирне місто</button><button class="btn" data-action="finish-black">◆ Чорна команда</button></div><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Скасувати</button></div></div></div>`;
  return '';
}

function render() {
  const observer = app.route === 'observer';
  let content = '';
  if (app.route === 'home') content = homeView();
  else if (app.route === 'players') content = playersView();
  else if (app.route === 'setup') content = setupView();
  else if (app.route === 'stats') content = statsView();
  else if (app.route === 'settings') content = settingsView();
  else if (app.route === 'reveal') content = revealView();
  else if (app.route === 'game' || observer) content = gameView(observer);
  appRoot.innerHTML = `${headerHtml()}${content}${bottomNavHtml()}`;
  modalRoot.innerHTML = modalHtml();
  appRoot.setAttribute('aria-busy', 'false');
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
  [app.players, app.games] = await Promise.all([getAll('players'), getAll('games')]);
  app.players.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  const active = activeGames()[0];
  if (active && (!app.game || app.game.id === active.id)) app.game = active;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function createGameFromDraft() {
  const roles = shuffled(ROLE_DECK.map(role => role.key));
  const seats = app.draft.seats.map((draftSeat, index) => {
    const profile = draftSeat.profileId ? playerById(draftSeat.profileId) : null;
    return {
      number: index + 1,
      profileId: profile?.id || null,
      name: profile?.name || draftSeat.name.trim() || `Гравець ${index + 1}`,
      avatar: profile?.avatar || '',
      role: roles[index],
      status: 'alive', faults: 0, nominatedBy: null, noVote: false,
      restrictionDay: null, shortSpeechDay: null, eliminatedReason: ''
    };
  });
  const timestamp = nowIso();
  return {
    id: uid('game'), title: app.draft.title.trim() || 'Партія Мафії', venue: app.draft.venue.trim(), notes: app.draft.notes.trim(),
    createdAt: timestamp, startedAt: timestamp, updatedAt: timestamp, endedAt: null,
    status: 'active', phase: 'reveal', subphase: '', day: 1, winner: null, durationSeconds: 0,
    settings: { ...app.draft.settings }, seats, revealIndex: 0, revealOpen: false,
    speakerIndex: 0, speakerOrder: seats.map(seat => seat.number), nominations: [],
    vote: { counts: {}, tied: [], tieKey: '', tieRound: 0, yes: 0, no: 0 },
    night: { step: 0, target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    timer: { remaining: app.draft.settings.speech, running: false, purpose: 'speech' },
    lastWordSeat: null, pendingLastWords: [], afterNightKill: false, showSecrets: false,
    history: [{ at: timestamp, time: new Date(timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }), text: 'Створено нову партію та випадково розподілено ролі.', secret: true }]
  };
}

function publicGame(game) {
  if (!game) return null;
  const clean = clone(game);
  clean.seats.forEach(seat => { delete seat.role; delete seat.profileId; });
  clean.history = clean.history.filter(event => !event.secret);
  clean.night = { step: clean.night.step, target: clean.night.step >= 4 ? clean.night.target : null };
  clean.showSecrets = false;
  return clean;
}

async function saveGame({ broadcast = true } = {}) {
  if (!app.game) return;
  app.game.updatedAt = nowIso();
  app.game.timer.running = Boolean(app.game.timer.running);
  await putOne('games', app.game);
  const index = app.games.findIndex(game => game.id === app.game.id);
  if (index >= 0) app.games[index] = clone(app.game); else app.games.push(clone(app.game));
  if (broadcast) channel?.postMessage({ type: 'game', game: publicGame(app.game) });
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
  if (app.game.timer.running && app.game.timer.endsAt) {
    app.game.timer.remaining = Math.max(0, Math.ceil((app.game.timer.endsAt - Date.now()) / 1000));
  }
  app.game.timer.running = false;
  delete app.game.timer.endsAt;
  clearInterval(app.timerHandle);
  app.timerHandle = null;
  app.wakeLock?.release?.().catch(() => {});
  app.wakeLock = null;
}

function timerBase() {
  const purpose = app.game.timer.purpose;
  if (purpose === 'tie') return app.game.settings.tieSpeech;
  if (purpose === 'lastWord') return app.game.settings.lastWord;
  if (purpose === 'night') return app.game.settings.nightCheck;
  const speaker = currentSpeaker();
  if (speaker?.shortSpeechDay && app.game.day >= speaker.shortSpeechDay) return 30;
  if (speaker?.restrictionDay && app.game.day >= speaker.restrictionDay) return 0;
  return app.game.settings.speech;
}

function setTimer(seconds, purpose = 'speech') {
  stopTimer();
  app.game.timer = { remaining: Math.max(0, Number(seconds) || 0), running: false, purpose };
}

function startTimer() {
  if (!app.game || app.game.timer.running) return;
  app.game.timer.running = true;
  app.game.timer.endsAt = Date.now() + app.game.timer.remaining * 1000;
  navigator.wakeLock?.request('screen').then(lock => { app.wakeLock = lock; }).catch(() => {});
  clearInterval(app.timerHandle);
  let lastSecond = app.game.timer.remaining;
  app.timerHandle = setInterval(async () => {
    if (!app.game?.timer.running) return;
    app.game.timer.remaining = Math.max(0, Math.ceil((app.game.timer.endsAt - Date.now()) / 1000));
    if (app.game.timer.remaining === lastSecond) return;
    lastSecond = app.game.timer.remaining;
    if (app.game.timer.remaining === 0) {
      stopTimer();
      beep(); vibrate([60, 40, 60]); toast('Час вичерпано');
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
  setTimer(app.game.settings.speech, 'speech');
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
  if (used !== voterCount()) return toast(used > voterCount() ? 'Голосів більше, ніж виборців' : `Не зафіксовано ${voterCount() - used} голосів`);
  pushUndo();
  const max = Math.max(...candidates.map(number => app.game.vote.counts[number] || 0));
  const top = candidates.filter(number => (app.game.vote.counts[number] || 0) === max);
  addLog(`Голосування: ${candidates.map(number => `№${number} — ${app.game.vote.counts[number] || 0}`).join(', ')}.`);
  if (top.length === 1) return eliminate(top[0], 'денне голосування', true);
  const key = [...top].sort((a, b) => a - b).join('-');
  if (app.game.phase === 'tieVote' && key === app.game.vote.tieKey) {
    app.game.phase = 'allTie';
    app.game.vote.tied = top;
    app.game.vote.yes = 0;
    app.game.vote.no = 0;
    addLog(`Повторна нічия між ${top.map(number => `№${number}`).join(', ')}.`);
  } else {
    app.game.vote.tieKey = key;
    app.game.vote.tied = top;
    app.game.vote.counts = {};
    app.game.phase = 'tieSpeech';
    app.game.speakerIndex = 0;
    setTimer(app.game.settings.tieSpeech, 'tie');
    addLog(`Автокатастрофа: ${top.map(number => `№${number}`).join(', ')}.`);
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
    if (await checkVictory()) return;
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
  seat.status = 'dead';
  seat.eliminatedReason = reason;
  seat.nominatedBy = null;
  app.game.nominations = app.game.nominations.filter(value => value !== number);
  addLog(`№${number} ${seat.name} вибуває (${reason}).`);
}

async function eliminate(number, reason, lastWord = true) {
  eliminateSeatOnly(number, reason);
  if (await checkVictory()) return;
  if (lastWord) {
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
  if (app.game.afterNightKill) return beginDay(true);
  return goNight();
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
  const seat = seatByNo(number);
  const hit = isDon ? seat.role === 'sheriff' : teamOf(seat) === 'black';
  addLog(`${isDon ? 'Дон' : 'Шериф'} перевіряє №${number}: ${isDon ? (hit ? 'Шериф' : 'не Шериф') : (hit ? 'чорний' : 'червоний')}.`, true);
  app.game.night.resultOpen = false;
  app.game.night.step += 1;
  await saveGame(); render();
}

async function wakeCity() {
  pushUndo();
  const number = app.game.night.target;
  if (number == null || number === -1) return beginDay(true);
  eliminateSeatOnly(number, 'нічний постріл');
  if (await checkVictory()) return;
  app.game.phase = 'lastWord';
  app.game.lastWordSeat = number;
  app.game.pendingLastWords = [];
  app.game.afterNightKill = true;
  setTimer(app.game.settings.lastWord, 'lastWord');
  await saveGame(); render();
}

async function checkVictory() {
  const alive = aliveSeats();
  const black = alive.filter(seat => teamOf(seat) === 'black').length;
  const red = alive.length - black;
  if (black === 0) return finishGame('red');
  if (black >= red) return finishGame('black');
  return false;
}

async function finishGame(winner) {
  stopTimer();
  app.game.phase = 'finished';
  app.game.status = 'finished';
  app.game.winner = winner;
  app.game.endedAt = nowIso();
  app.game.durationSeconds = Math.max(0, Math.round((new Date(app.game.endedAt) - new Date(app.game.startedAt)) / 1000));
  addLog(winner === 'red' ? 'Перемога мирного міста.' : 'Перемога чорної команди.');
  await saveGame();
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
  canvas.width = 512;
  canvas.height = 512;
  canvas.getContext('2d').drawImage(bitmap, sx, sy, size, size, 0, 0, 512, 512);
  bitmap.close?.();
  const type = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  return canvas.toDataURL(type, .82);
}

async function savePlayer(form) {
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (!name) return toast('Вкажіть ім’я гравця');
  const timestamp = nowIso();
  const current = app.modal.player;
  const player = {
    id: current.id || uid('player'),
    name,
    nickname: String(data.get('nickname') || '').trim(),
    contact: String(data.get('contact') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
    avatar: current.avatar || '',
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp
  };
  await putOne('players', player);
  app.modal = null;
  await refreshData();
  render();
  toast('Профіль збережено');
}

function protocolText(game = app.game) {
  if (!game) return '';
  const winner = game.winner === 'red' ? 'Мирне місто' : game.winner === 'black' ? 'Чорна команда' : 'не визначено';
  return [
    'MAFIA DESK — ПРОТОКОЛ',
    `Партія: ${game.title}`,
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

function downloadJson(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mafia-desk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleAction(action, element, sourceEvent) {
  const number = Number(element.dataset.seat);
  if (action === 'install') {
    app.installPrompt?.prompt();
    await app.installPrompt?.userChoice;
    app.installPrompt = null; render();
  } else if (action === 'new-player') {
    app.modal = { type: 'player', player: { name: '', nickname: '', contact: '', notes: '', avatar: '' } }; render();
  } else if (action === 'edit-player') {
    app.modal = { type: 'player', player: clone(playerById(element.dataset.id)) }; render();
  } else if (action === 'delete-player') {
    const player = app.modal.player;
    app.modal = { type: 'confirm', title: 'Видалити профіль?', text: `${player.name} зникне з довідника. Історичні партії залишаться без змін.`, confirmLabel: 'Видалити', confirm: { kind: 'player', id: player.id } }; render();
  } else if (action === 'delete-game') {
    const game = gameById(element.dataset.id);
    app.modal = { type: 'confirm', title: 'Видалити партію?', text: `Протокол «${game.title}» і пов’язана статистика будуть видалені безповоротно.`, confirmLabel: 'Видалити', confirm: { kind: 'game', id: game.id } }; render();
  } else if (action === 'confirm-action') {
    const confirm = app.modal.confirm;
    if (confirm.kind === 'player') await deleteOne('players', confirm.id);
    if (confirm.kind === 'game') await deleteOne('games', confirm.id);
    if (confirm.kind === 'finish') { app.modal = { type: 'winner' }; render(); return; }
    app.modal = null; await refreshData(); render(); toast('Видалено');
  } else if (action === 'close-modal') {
    if (element.classList.contains('modal-backdrop') && element !== sourceEvent?.target) return;
    app.modal = null; render();
  } else if (action === 'game-settings') {
    app.modal = { type: 'game-settings' }; render();
  } else if (action === 'shuffle-seats') {
    const shuffledSeats = shuffled(app.draft.seats.map(seat => ({ profileId: seat.profileId, name: seat.name })));
    app.draft.seats.forEach((seat, index) => Object.assign(seat, shuffledSeats[index])); render();
  } else if (action === 'start-game') {
    const selected = app.draft.seats.map(seat => seat.profileId).filter(Boolean);
    if (new Set(selected).size !== selected.length) return toast('Один профіль не можна посадити двічі');
    const devicePreferences = { theme: app.settings.theme, sound: app.settings.sound, haptics: app.settings.haptics };
    app.game = createGameFromDraft(); app.settings = { ...app.game.settings, ...devicePreferences }; app.undo = [];
    await setSetting('appSettings', app.settings); await saveGame(); navigate('reveal');
  } else if (action === 'resume-game') {
    app.game = gameById(element.dataset.id); app.undo = []; navigate(app.game.phase === 'reveal' ? 'reveal' : 'game');
  } else if (action === 'reveal-role') {
    app.game.revealOpen = true; await saveGame({ broadcast: false }); render();
  } else if (action === 'reveal-next') {
    app.game.revealOpen = false;
    if (app.game.revealIndex < app.game.seats.length - 1) app.game.revealIndex += 1;
    else { app.game.phase = 'zeroNight'; setTimer(app.game.settings.nightCheck, 'night'); addLog('Нульова ніч: чорна команда знайомиться.'); }
    await saveGame();
    if (app.game.phase === 'zeroNight') navigate('game'); else render();
  } else if (action === 'zero-to-day') {
    pushUndo(); await beginDay(false);
  } else if (action === 'timer-toggle') {
    app.game.timer.running ? stopTimer() : startTimer(); await saveGame(); render();
  } else if (action === 'timer-minus' || action === 'timer-plus') {
    app.game.timer.remaining = Math.max(0, app.game.timer.remaining + (action === 'timer-plus' ? 5 : -5)); await saveGame(); render();
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
  else if (action === 'night-next') { pushUndo(); app.game.night.step += 1; setTimer(app.game.settings.nightCheck, 'night'); await saveGame(); render(); }
  else if (action === 'night-target') { if (app.game.night.step === 1) app.game.night.target = number; if (app.game.night.step === 2) app.game.night.donCheck = number; if (app.game.night.step === 3) app.game.night.sheriffCheck = number; app.game.night.resultOpen = false; await saveGame(); render(); }
  else if (action === 'night-miss') { pushUndo(); app.game.night.target = -1; app.game.night.step = 2; addLog(`Ніч ${app.game.day}: мафія промахнулася.`); await saveGame(); render(); }
  else if (action === 'night-shot-done') { pushUndo(); addLog(`Ніч ${app.game.day}: постріл у №${app.game.night.target}.`, true); app.game.night.step = 2; await saveGame(); render(); }
  else if (action === 'night-show-result') { app.game.night.resultOpen = true; render(); }
  else if (action === 'night-check-done') await finishNightCheck();
  else if (action === 'night-skip-check') { app.game.night.step += 1; app.game.night.resultOpen = false; await saveGame(); render(); }
  else if (action === 'wake-city') await wakeCity();
  else if (action === 'toggle-secret') { app.game.showSecrets = !app.game.showSecrets; await saveGame({ broadcast: false }); render(); }
  else if (action === 'undo') {
    if (!app.undo.length) return toast('Немає дії для скасування');
    stopTimer(); app.game = app.undo.pop(); app.game.timer.running = false; await saveGame(); render(); toast('Останню дію скасовано');
  } else if (action === 'copy-protocol') await copyText(protocolText(element.dataset.id ? gameById(element.dataset.id) : app.game), 'Протокол скопійовано');
  else if (action === 'view-protocol') { app.modal = { type: 'protocol', gameId: element.dataset.id }; render(); }
  else if (action === 'open-observer') window.open(`${location.pathname}${location.search}#observer/${app.game?.id || ''}`, '_blank', 'noopener');
  else if (action === 'end-game-manual') { app.modal = { type: 'confirm', title: 'Завершити партію?', text: 'Оберіть переможця після підтвердження: поточна версія зафіксує результат за співвідношенням живих команд.', confirmLabel: 'Завершити', confirm: { kind: 'finish' } }; render(); }
  else if (action === 'finish-red' || action === 'finish-black') { app.modal = null; await finishGame(action === 'finish-red' ? 'red' : 'black'); }
  else if (action === 'rematch') {
    const previous = app.game; app.draft = createDraft(); app.draft.title = `${previous.title} · реванш`; app.draft.venue = previous.venue; app.draft.seats = previous.seats.map(seat => ({ number: seat.number, profileId: seat.profileId || '', name: seat.name })); navigate('setup');
  } else if (action === 'setting-sound' || action === 'setting-haptics') {
    const key = action === 'setting-sound' ? 'sound' : 'haptics'; app.settings[key] = !app.settings[key]; await setSetting('appSettings', app.settings); render();
  } else if (action === 'set-theme') {
    app.settings.theme = applyTheme(element.dataset.themeChoice);
    await setSetting('appSettings', app.settings);
    render();
    toast(`Тема «${app.settings.theme === 'dark' ? 'Темна' : app.settings.theme === 'light' ? 'Світла' : 'Кав’ярня'}» увімкнена`);
  } else if (action === 'export-data') downloadJson(await exportDatabase());
  else if (action === 'import-data') $('#import-file').click();
  else if (action === 'google-signin') {
    try { await configureGoogle(app.googleClientId); const profile = await signInGoogle(); render(); toast(`Вітаємо, ${profile.name}`); } catch (error) { toast(error.message); }
  } else if (action === 'google-signout') { signOutGoogle(); render(); toast('Google-сесію завершено'); }
  else if (action === 'cloud-push') { try { toast('Створюю резервну копію…'); await pushToDrive(); app.cloudSync = await getSetting('lastCloudSync'); render(); toast('Збережено у Google Drive'); } catch (error) { toast(error.message); } }
  else if (action === 'cloud-pull') { try { toast('Відновлюю дані…'); await pullFromDrive(); await loadAppData(); render(); toast('Дані відновлено'); } catch (error) { toast(error.message); } }
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
    if (seat) seat.name = element.value;
  } else if (element.dataset.input === 'google-client-id') {
    app.googleClientId = element.value.trim();
  }
}

async function handleChange(element) {
  if (element.dataset.seatProfile) {
    const seat = app.draft.seats.find(item => item.number === Number(element.dataset.seatProfile));
    seat.profileId = element.value;
    const profile = playerById(element.value);
    if (profile) seat.name = profile.name;
    render();
  } else if (['avatar-camera', 'avatar-gallery'].includes(element.dataset.input) && element.files?.[0]) {
    try {
      toast(element.dataset.input === 'avatar-camera' ? 'Обробляю знімок…' : 'Обробляю фото…');
      app.modal.player.avatar = await compressImage(element.files[0]);
      render();
      toast('Фото готове');
    } catch (error) { toast(error.message); }
  } else if (element.dataset.input === 'google-client-id') {
    app.googleClientId = element.value.trim();
    await setSetting('googleClientId', app.googleClientId);
    toast('Client ID збережено локально');
  }
}

async function loadImportedFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    await importDatabase(payload, { replace: false });
    await loadAppData();
    render();
    toast('Резервну копію імпортовано');
  } catch (error) { toast(error.message || 'Не вдалося імпортувати файл'); }
  $('#import-file').value = '';
}

async function loadAppData() {
  app.settings = { ...DEFAULT_SETTINGS, ...(await getSetting('appSettings', {})) };
  app.settings.theme = applyTheme(app.settings.theme);
  app.googleClientId = await getSetting('googleClientId', '');
  app.cloudSync = await getSetting('lastCloudSync', '');
  await refreshData();
  const route = routeFromHash();
  app.route = route.route;
  if (route.id) app.game = await getOne('games', route.id) || app.game;
  if (!app.game) app.game = activeGames()[0] || null;
  if (app.game?.timer) app.game.timer.running = false;
  if (app.game?.timer) delete app.game.timer.endsAt;
}

async function onRouteChange() {
  stopTimer();
  const route = routeFromHash();
  app.route = route.route;
  if (route.id) app.game = await getOne('games', route.id) || app.game;
  if (app.route === 'game' && !app.game) app.game = activeGames()[0] || null;
  app.modal = null;
  closeOverlays();
  render();
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
  await handleAction(target.dataset.action, target, event);
});

document.addEventListener('input', event => handleInput(event.target));
document.addEventListener('change', event => handleChange(event.target));
document.addEventListener('submit', async event => {
  if (event.target.dataset.form === 'player') {
    event.preventDefault();
    await savePlayer(event.target);
  } else if (event.target.dataset.form === 'game-settings') {
    event.preventDefault();
    const data = new FormData(event.target);
    for (const key of ['speech', 'tieSpeech', 'lastWord', 'nightCheck']) {
      app.game.settings[key] = Math.max(5, Math.min(180, Number(data.get(key)) || DEFAULT_SETTINGS[key]));
    }
    app.game.settings.penaltyMode = data.get('penaltyMode') === 'club' ? 'club' : 'tournament';
    app.modal = null;
    addLog('Ведучий оновив налаштування таймерів і фолів.');
    await saveGame();
    render();
    toast('Налаштування партії оновлено');
  }
});
document.addEventListener('keydown', async event => {
  if (event.key === 'Escape' && (app.modal || app.tooltip)) { app.modal = null; closeOverlays(); render(); }
  if (app.route === 'game' && !app.modal && event.code === 'Space' && ['day', 'tieSpeech', 'lastWord'].includes(app.game?.phase)) {
    event.preventDefault();
    app.game.timer.running ? stopTimer() : startTimer();
    await saveGame(); render();
  }
});
$('#import-file').addEventListener('change', event => loadImportedFile(event.target.files?.[0]));
window.addEventListener('hashchange', onRouteChange);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); app.installPrompt = event; render(); });
window.addEventListener('online', () => toast('Інтернет-з’єднання відновлено'));
window.addEventListener('offline', () => toast('Офлайн-режим: локальна гра продовжується'));
window.addEventListener('pagehide', () => { if (app.route === 'game' && app.game?.timer.running) { stopTimer(); saveGame(); } });

channel?.addEventListener('message', event => {
  if (event.data?.type !== 'game' || app.route !== 'observer') return;
  app.game = event.data.game;
  render();
});

async function init() {
  try {
    await openDatabase();
    await loadAppData();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  } catch (error) {
    appRoot.innerHTML = `<main class="page"><section class="card card-pad"><h1>Не вдалося відкрити локальну базу</h1><p class="muted">${esc(error.message)}</p><p>Перевірте, чи не заборонене сховище сайту або приватний режим браузера.</p></section></main>`;
  }
}

init();
