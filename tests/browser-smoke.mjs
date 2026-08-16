/*
 * Minimal dependency-free browser smoke test.
 * Start Chrome with --remote-debugging-port=PORT and the app open, then run:
 * node tests/browser-smoke.mjs http://127.0.0.1:PORT
 */
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Передайте адресу Chrome DevTools, наприклад http://127.0.0.1:9224');

const targets = await fetch(`${endpoint}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1'));
if (!target) throw new Error('Вкладку застосунку не знайдено');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const browserErrors = [];
let requestId = 0;

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') browserErrors.push(message.params.entry.text);
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  return new Promise(resolve => {
    const id = ++requestId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function click(selector) {
  await evaluate(`(element => { if (!element) throw new Error('Не знайдено ${selector}'); element.click(); return true; })(document.querySelector(${JSON.stringify(selector)}))`);
  await wait(100);
}

async function captureScreenshot(path) {
  if (!path) return;
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path, Buffer.from(capture.result.data, 'base64'));
}

async function inspectModalFrame() {
  return evaluate(`(() => {
    const dialog = document.querySelector('.modal');
    const backdrop = dialog?.closest('.modal-backdrop');
    if (!dialog || !backdrop) return { exists: false };
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);
    const actions = dialog.querySelector('.modal-actions');
    return {
      exists: true,
      focused: document.activeElement === dialog,
      scrollTop: dialog.scrollTop,
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      rightGap: Math.round(innerWidth - rect.right),
      bottomWithinViewport: rect.bottom <= innerHeight - 6,
      backdropAlign: getComputedStyle(backdrop).alignItems,
      bordered: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].every(property => parseFloat(style[property]) >= 1),
      scrollable: ['auto', 'scroll'].includes(style.overflowY),
      stickyActions: !actions || getComputedStyle(actions).position === 'sticky'
    };
  })()`);
}

function isUnifiedModal(frame) {
  return frame.exists && frame.focused && frame.scrollTop === 0 && frame.top >= 6 && frame.top <= 8 && frame.left === 6 && frame.rightGap === 6 && frame.bottomWithinViewport && frame.backdropAlign === 'start' && frame.bordered && frame.scrollable && frame.stickyActions;
}

async function inspectAppChrome() {
  return evaluate(`(() => {
    const header = document.querySelector('.shell-header');
    const navigation = document.querySelector('.bottom-nav');
    const tabPage = document.querySelector('main.tab-page');
    const items = [...(navigation?.querySelectorAll('.nav-item') || [])];
    const widths = items.map(item => item.getBoundingClientRect().width);
    return {
      route: location.hash,
      headerHeight: Math.round(header?.getBoundingClientRect().height || 0),
      headerWidth: Math.round(header?.getBoundingClientRect().width || 0),
      logoSize: Math.round(header?.querySelector('.brand-mark')?.getBoundingClientRect().width || 0),
      profileSize: Math.round(header?.querySelector('.profile-btn')?.getBoundingClientRect().height || 0),
      installVisible: Boolean(header?.querySelector('[data-action="install"]')),
      tabPage: Boolean(tabPage),
      pageGap: parseFloat(getComputedStyle(tabPage).rowGap),
      navHeight: Math.round(navigation?.getBoundingClientRect().height || 0),
      navItems: items.length,
      labels: items.map(item => item.textContent.trim()),
      activeLabel: navigation?.querySelector('[aria-current="page"]')?.textContent.trim(),
      activeCount: navigation?.querySelectorAll('[aria-current="page"]').length || 0,
      smallestIcon: Math.round(Math.min(...items.map(item => item.querySelector('svg').getBoundingClientRect().width))),
      widthSpread: widths.length ? Math.round(Math.max(...widths) - Math.min(...widths)) : 0
    };
  })()`);
}

function isUnifiedAppChrome(frame, baseline) {
  return frame.headerHeight === baseline.headerHeight && frame.headerWidth === baseline.headerWidth && frame.logoSize === baseline.logoSize && frame.profileSize === baseline.profileSize && frame.installVisible === baseline.installVisible && frame.tabPage && frame.pageGap <= 8 && frame.navHeight === 72 && frame.navItems === 5 && frame.activeCount === 1 && frame.smallestIcon >= 26 && frame.widthSpread <= 1 && JSON.stringify(frame.labels) === JSON.stringify(baseline.labels);
}

await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(400);

const authenticatedHost = await evaluate(`({
  name: document.querySelector('.profile-btn > span:last-child')?.textContent,
  avatar: Boolean(document.querySelector('.profile-btn .avatar'))
})`);
const enjoyBrand = await evaluate(`({
  headerBrandAbsent: !document.querySelector('.brand-copy'),
  documentTitle: document.title,
  heroWordmarkAbsent: !document.querySelector('.hero .enjoy-wordmark'),
  heroTitle: document.querySelector('.hero h1')?.textContent.trim().replace(/\\s+/g, ' '),
  coffeeIcon: Boolean(document.querySelector('.hero-cup')),
  sheriffBadge: document.querySelector('.brand-mark')?.tagName === 'IMG' && document.querySelector('.brand-mark')?.src.endsWith('/assets/logo-mafia.webp'),
  favicon: document.querySelector('link[rel="icon"]')?.href,
  brandMarkSize: Math.round(document.querySelector('.brand-mark')?.getBoundingClientRect().width || 0),
  brandArtworkSize: getComputedStyle(document.querySelector('.brand-mark')).objectFit,
  heroIndexAbsent: !document.querySelector('.hero-index'),
  addressAbsent: !document.querySelector('.hero')?.textContent.includes('Юлії Здановської'),
  instagramAbsent: !document.querySelector('.hero .cafe-icon-link[href*="instagram.com"]'),
  mapsAbsent: !document.querySelector('.hero .cafe-icon-link[href*="google.com/maps"]'),
  socialIcons: document.querySelectorAll('.hero-title-row .cafe-icon-link').length,
  externalArrowsAbsent: ![...document.querySelectorAll('a, button')].some(element => element.textContent.includes('↗')),
  sharedArchive: [...document.querySelectorAll('.section-title')].find(section => section.querySelector('h2')?.textContent.includes('Останні ігри'))?.querySelector('.help')?.dataset.tooltip,
  redundantDescription: Boolean(document.querySelector('.hero > p')),
  redundantAudienceLabel: Boolean(document.querySelector('.hero > .eyebrow'))
})`);
const initialActiveGames = await evaluate(`({
  panel: Boolean(document.querySelector('.active-games-panel')),
  rows: document.querySelectorAll('.active-games-panel .active-game-row').length,
  state: document.querySelector('.active-games-panel .ui-state .state-copy')?.textContent,
  refresh: Boolean(document.querySelector('.active-games-panel [data-action="cloud-games-refresh"]')),
  observerHint: document.querySelector('.active-games-panel .ui-state')?.textContent.includes('Спостерігати'),
  toggle: Boolean(document.querySelector('[data-action="toggle-panel"][data-panel="homeActiveGames"]')),
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="homeActiveGames"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-homeActiveGames')?.hidden
})`);
const homeAverageGameTime = await evaluate(`({
  value: document.querySelector('.home-stat-grid .stat-card:last-child b')?.textContent.trim(),
  label: document.querySelector('.home-stat-grid .stat-card:last-child span')?.textContent.trim()
})`);
await click('[data-action="toggle-panel"][data-panel="homeActiveGames"]');
const homeActiveGamesCollapsed = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="homeActiveGames"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-homeActiveGames')?.hidden
})`);
await click('[data-action="toggle-panel"][data-panel="homeActiveGames"]');
const homeActiveGamesExpanded = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="homeActiveGames"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-homeActiveGames')?.hidden
})`);
const homeChrome = await inspectAppChrome();
await captureScreenshot(process.env.SMOKE_HOME_SCREENSHOT);
const mobileLayout = await evaluate(`(() => {
  const homeActions = [...document.querySelectorAll('.home-fab-group .mobile-fab')];
  const homeGroup = document.querySelector('.home-fab-group').getBoundingClientRect();
  const navigation = document.querySelector('.bottom-nav').getBoundingClientRect();
  return ({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  pagePadding: parseFloat(getComputedStyle(document.querySelector('.page')).paddingLeft),
  stackGap: parseFloat(getComputedStyle(document.querySelector('.tab-page')).rowGap),
  numericFont: getComputedStyle(document.querySelector('.stat-card b')).fontFamily,
  homeStatsCentered: [...document.querySelectorAll('.home-stat-grid .stat-card')].every(card => getComputedStyle(card).textAlign === 'center' && getComputedStyle(card).alignItems === 'center'),
  homeStatsBackground: getComputedStyle(document.querySelector('.home-stat-grid .stat-card')).backgroundColor,
  navHeight: Math.round(document.querySelector('.bottom-nav').getBoundingClientRect().height),
  smallestNavIcon: Math.round(Math.min(...[...document.querySelectorAll('.bottom-nav .nav-item svg')].map(icon => icon.getBoundingClientRect().width))),
  newGameNavEmphasized: (() => {
    const item = document.querySelector('.bottom-nav .nav-new-game');
    const icon = item?.querySelector('svg');
    const label = item?.querySelector('span');
    return Boolean(item && icon && label
      && icon.getBoundingClientRect().width >= 30
      && parseFloat(getComputedStyle(icon).strokeWidth) >= 2
      && Number(getComputedStyle(label).fontWeight) >= 800
      && getComputedStyle(item).backgroundColor !== 'rgba(0, 0, 0, 0)');
  })(),
  headerAvatarVisible: getComputedStyle(document.querySelector('.profile-btn .avatar')).display !== 'none',
  headerAvatarFills: (() => {
    const button = document.querySelector('.profile-btn').getBoundingClientRect();
    const avatar = document.querySelector('.profile-btn .avatar').getBoundingClientRect();
    return button.width - avatar.width <= 2 && button.height - avatar.height <= 2;
  })(),
  shortestPrimaryAction: Math.min(...homeActions.map(button => button.getBoundingClientRect().height)),
  smallestHomeActionFont: Math.min(...[...document.querySelectorAll('.hero .actions .btn')].map(button => parseFloat(getComputedStyle(button).fontSize))),
  smallestTextButtonFont: Math.min(...[...document.querySelectorAll('.btn')].filter(button => button.textContent.trim()).map(button => parseFloat(getComputedStyle(button).fontSize))),
  installIconOnly: Boolean(document.querySelector('[data-action="install"] svg')) && !document.querySelector('[data-action="install"]')?.textContent.trim(),
  installLabel: document.querySelector('[data-action="install"]')?.getAttribute('aria-label'),
  installSize: document.querySelector('[data-action="install"]')?.getBoundingClientRect().width,
  heroActionsHidden: getComputedStyle(document.querySelector('.hero .actions')).display === 'none',
  homeQuickActionCount: homeActions.length,
  homeQuickActionsSquare: homeActions.every(button => Math.round(button.getBoundingClientRect().width) === 68 && Math.round(button.getBoundingClientRect().height) === 68),
  homeQuickActionsCentered: Math.abs((homeGroup.left + homeGroup.width / 2) - innerWidth / 2) <= 1,
  homeQuickActionsAboveNavigation: homeGroup.bottom <= navigation.top - 10,
  addPlayerFirst: Boolean(homeActions[0]?.querySelector('.add-player-fab-icon .fab-plus')) && homeActions[0]?.getAttribute('aria-label') === 'Додати гравця',
  createGameSecond: Boolean(homeActions[1]?.querySelector('svg')) && homeActions[1]?.getAttribute('aria-label') === 'Створити гру',
  addPlayerGold: homeActions[0]?.classList.contains('primary-fab') && getComputedStyle(homeActions[0]).backgroundColor === 'rgb(216, 170, 88)',
  createGameRed: homeActions[1]?.classList.contains('danger-fab') && getComputedStyle(homeActions[1]).backgroundColor === 'rgb(141, 49, 52)'
  });
})()`);
const headerMediaControls = await evaluate(`({
  bluetooth: Boolean(document.querySelector('[data-action="open-media-panel"] svg')),
  bluetoothMenuTrigger: document.querySelector('[data-action="open-media-panel"]')?.getAttribute('aria-haspopup') === 'dialog',
  play: Boolean(document.querySelector('[data-action="media-play"] svg')),
  pause: Boolean(document.querySelector('[data-action="media-pause"] svg')),
  playInitiallyDisabled: document.querySelector('[data-action="media-play"]')?.disabled,
  pauseInitiallyDisabled: document.querySelector('[data-action="media-pause"]')?.disabled,
  controls: [...document.querySelectorAll('.header-media-controls .header-media-btn')].filter(button => button.getBoundingClientRect().width > 0).length,
  compactlyHidden: getComputedStyle(document.querySelector('.header-media-controls')).display === 'none',
  smallest: Math.round(Math.min(...[...document.querySelectorAll('.header-media-btn')].filter(button => button.getBoundingClientRect().width > 0).map(button => button.getBoundingClientRect().width))),
  centerOffset: (() => { const box = document.querySelector('.header-media-controls').getBoundingClientRect(); return Math.abs((box.left + box.right) / 2 - innerWidth / 2); })(),
  bluetoothBesideProfile: (() => { const bluetooth = document.querySelector('.browser-bluetooth-btn').getBoundingClientRect(); const profile = document.querySelector('.profile-btn').getBoundingClientRect(); return bluetooth.right <= profile.left && profile.left - bluetooth.right <= 6; })(),
  profileGroupRightGap: (() => { const box = document.querySelector('.header-profile-actions').getBoundingClientRect(); return Math.round(innerWidth - box.right); })(),
  cancelAbsentWithoutGame: !document.querySelector('.cancel-game-btn')
})`);
const headerOrderControl = await evaluate(`(() => {
  const order = document.querySelector('[data-action="open-order-panel"]');
  const share = document.querySelector('[data-action="share-app"]');
  const orderBox = order.getBoundingClientRect();
  const shareBox = share?.getBoundingClientRect();
  const orderColor = getComputedStyle(order).backgroundColor.match(/\\d+/g)?.map(Number) || [];
  return {
    icon: Boolean(order.querySelector('svg')),
    label: order.getAttribute('aria-label'),
    size: Math.round(orderBox.width),
    red: orderColor.length >= 3 && orderColor[0] > orderColor[1] * 1.5 && orderColor[0] > orderColor[2] * 1.4,
    besideShare: Boolean(shareBox && shareBox.right <= orderBox.left && orderBox.left - shareBox.right <= 6),
    insideViewport: orderBox.left >= 0 && orderBox.right <= innerWidth
  };
})()`);
await evaluate(`Object.defineProperty(navigator, 'share', { configurable: true, value: data => { window.__sharePayload = data; return Promise.resolve(); } })`);
await click('[data-action="share-app"]');
await wait(50);
const headerShareControl = await evaluate(`(() => {
  const install = document.querySelector('[data-action="install"]');
  const share = document.querySelector('[data-action="share-app"]');
  const order = document.querySelector('[data-action="open-order-panel"]');
  const controls = [...document.querySelector('.header-actions').children];
  const shareBox = share.getBoundingClientRect();
  const installBox = install?.getBoundingClientRect();
  return {
    icon: Boolean(share.querySelector('svg')),
    label: share.getAttribute('aria-label'),
    size: Math.round(shareBox.width),
    betweenInstallAndOrder: controls.indexOf(install) < controls.indexOf(share) && controls.indexOf(share) < controls.indexOf(order),
    besideInstall: Boolean(installBox && installBox.right <= shareBox.left && shareBox.left - installBox.right <= 6),
    insideViewport: shareBox.left >= 0 && shareBox.right <= innerWidth,
    title: window.__sharePayload?.title,
    text: window.__sharePayload?.text,
    url: window.__sharePayload?.url,
    canonicalUrl: new URL('./', document.baseURI).href
  };
})()`);
await click('[data-action="open-media-panel"]');
const mediaModalFrame = await inspectModalFrame();
const mediaPanel = await evaluate(`({
  platform: document.documentElement.dataset.platform,
  title: document.querySelector('#media-panel-title')?.textContent,
  prompt: document.querySelector('#media-panel-title + p')?.textContent,
  audioInput: document.querySelector('#music-file')?.accept,
  choices: [...document.querySelectorAll('.media-choice b')].map(item => item.textContent.trim()),
  choiceCount: document.querySelectorAll('.media-choice').length,
  choiceIcons: document.querySelectorAll('.media-choice > svg').length,
  musicPickerLabel: document.querySelector('.music-choice')?.getAttribute('for'),
  androidSystemLink: document.querySelector('.android-bluetooth-menu-link')?.getAttribute('href'),
  detailsInitiallyCollapsed: !document.querySelector('.bluetooth-detail-panel'),
  smallestChoice: Math.round(Math.min(...[...document.querySelectorAll('.media-choice')].map(item => item.getBoundingClientRect().height))),
  closeCentered: (() => { const button = document.querySelector('.media-modal [data-action="close-modal"]'); const glyph = getComputedStyle(button, '::before'); return glyph.position === 'absolute' && Math.abs(parseFloat(glyph.left) - button.clientWidth / 2) <= 1 && Math.abs(parseFloat(glyph.top) - button.clientHeight / 2) <= 1 && getComputedStyle(button).paddingTop === '0px'; })()
})`);
if (mediaPanel.platform === 'ios') {
  await click('[data-action="show-bluetooth-guide"]');
  mediaPanel.iosGuide = await evaluate(`({
    expanded: Boolean(document.querySelector('.bluetooth-detail-panel')),
    controlCenter: document.querySelector('.ios-bluetooth-guide')?.textContent.includes('Центр керування'),
    settings: document.querySelector('.ios-bluetooth-guide')?.textContent.includes('Параметри → Bluetooth')
  })`);
}
await evaluate(`(() => {
  const sampleRate = 8000;
  const samples = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
  const transfer = new DataTransfer();
  transfer.items.add(new File([buffer], 'Enjoy smoke.wav', { type: 'audio/wav' }));
  const input = document.querySelector('#music-file');
  Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await wait(150);
const preparedMedia = await evaluate(`({
  track: document.querySelector('.prepared-media-panel .state-copy b')?.textContent,
  localOnly: document.querySelector('.media-note')?.textContent.includes('не завантажується'),
  playEnabled: !document.querySelector('.media-modal [data-action="media-play"]')?.disabled,
  clearButton: Boolean(document.querySelector('[data-action="media-clear"]')),
  externalControlWarning: [...document.querySelectorAll('.prepared-media-panel .help')].some(button => button.dataset.tooltip?.includes('Spotify') && button.dataset.tooltip.includes('керувати не може')),
  menuStillVisible: document.querySelectorAll('.media-choice').length === 2
})`);
await click('.media-modal [data-action="media-play"]');
await wait(120);
preparedMedia.activeHeaderPause = await evaluate(`(() => {
  const pause = document.querySelector('.header-media-btn.pause-btn');
  const order = document.querySelector('.order-btn');
  return {
    active: pause?.classList.contains('pause-active'),
    enabled: pause && !pause.disabled,
    red: pause && order && getComputedStyle(pause).backgroundColor === getComputedStyle(order).backgroundColor
  };
})()`);
await click('.media-modal [data-action="media-pause"]');
await wait(60);
preparedMedia.pauseStopsPlayback = await evaluate(`(() => {
  const pause = document.querySelector('.header-media-btn.pause-btn');
  return Boolean(pause?.disabled && !pause.classList.contains('pause-active'));
})()`);
await captureScreenshot(process.env.SMOKE_MEDIA_SCREENSHOT);
await click('.media-modal [data-action="close-modal"]');
await click('[data-action="open-order-panel"]');
const orderModalFrame = await inspectModalFrame();
const orderPanel = await evaluate(`({
  title: document.querySelector('#order-panel-title')?.textContent,
  categories: [...document.querySelectorAll('.order-category-item b')].map(item => item.textContent),
  categoryCount: document.querySelectorAll('.order-category-item').length,
  smallestCategory: Math.round(Math.min(...[...document.querySelectorAll('.order-category-item')].map(item => item.getBoundingClientRect().height))),
  recipient: document.querySelector('.order-recipient-note')?.textContent,
  categoryPrompt: document.querySelector('.order-intro')?.textContent.includes('Оберіть категорію')
})`);
await click('.order-category-item[data-category="coffee"]');
const orderCategory = await evaluate(`({
  title: document.querySelector('.order-category-heading h3')?.textContent,
  choices: [...document.querySelectorAll('.order-menu-item b')].map(item => item.textContent),
  count: document.querySelectorAll('.order-menu-item').length,
  back: document.querySelector('[data-action="back-order-categories"]')?.getAttribute('aria-label'),
  immediate: document.querySelector('.order-intro')?.textContent.includes('відразу піде в Telegram')
})`);
await click('[data-action="back-order-categories"]');
const orderBack = await evaluate(`document.querySelectorAll('.order-category-item').length`);
await click('.order-category-item[data-category="coffee"]');
await click('.order-menu-item[data-item="cappuccino"]');
await wait(150);
const orderResult = await evaluate(`({
  success: Boolean(document.querySelector('.order-modal .state-success')),
  text: document.querySelector('.order-modal .state-copy')?.textContent,
  modalOpen: Boolean(document.querySelector('.order-modal'))
})`);
await click('.order-modal [data-action="close-modal"]');
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
await wait(100);
const compactLayout = await evaluate(`({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, headerWidth: document.querySelector('.shell-header').getBoundingClientRect().width, actionsRight: Math.round(document.querySelector('.header-actions').getBoundingClientRect().right) })`);
await captureScreenshot(process.env.SMOKE_COMPACT_SCREENSHOT);
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true });
await wait(100);
const tabletLayout = await evaluate(`({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  headerHeight: Math.round(document.querySelector('.shell-header').getBoundingClientRect().height),
  navHeight: Math.round(document.querySelector('.bottom-nav').getBoundingClientRect().height),
  navItems: document.querySelectorAll('.bottom-nav .nav-item').length,
  smallestNavIcon: Math.round(Math.min(...[...document.querySelectorAll('.bottom-nav .nav-item svg')].map(icon => icon.getBoundingClientRect().width))),
  smallestNavLabel: Math.min(...[...document.querySelectorAll('.bottom-nav .nav-item span')].map(label => parseFloat(getComputedStyle(label).fontSize)))
})`);
await captureScreenshot(process.env.SMOKE_TABLET_SCREENSHOT);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await wait(100);
const desktopLayout = await evaluate(`(() => {
  const header = document.querySelector('.shell-header').getBoundingClientRect();
  const navElement = document.querySelector('.bottom-nav');
  const navigation = navElement.getBoundingClientRect();
  const navStyle = getComputedStyle(navElement);
  const items = [...navElement.querySelectorAll('.nav-item')].map(item => item.getBoundingClientRect());
  return {
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    headerTop: Math.round(header.top),
    headerBottom: Math.round(header.bottom),
    navTop: Math.round(navigation.top),
    navHeight: Math.round(navigation.height),
    smallestNavIcon: Math.round(Math.min(...[...navElement.querySelectorAll('.nav-item svg')].map(icon => icon.getBoundingClientRect().width))),
    smallestNavLabel: Math.min(...[...navElement.querySelectorAll('.nav-item span')].map(label => parseFloat(getComputedStyle(label).fontSize))),
    itemWidthSpread: Math.round(Math.max(...items.map(item => item.width)) - Math.min(...items.map(item => item.width))),
    navRightGap: Math.round(navigation.right - parseFloat(navStyle.paddingRight) - items.at(-1).right)
  };
})()`);
await captureScreenshot(process.env.SMOKE_DESKTOP_SCREENSHOT);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(100);
const ownerDatabases = await evaluate(`indexedDB.databases().then(rows => rows.map(row => row.name))`);
await click('[data-action="edit-host-profile"]');
const hostProfileModalFrame = await inspectModalFrame();
const hostProfileControls = await evaluate(`({
  email: document.querySelector('.identity-field span')?.textContent,
  camera: document.querySelector('#host-avatar-camera')?.getAttribute('capture'),
  cameraIcon: Boolean(document.querySelector('label[for="host-avatar-camera"] .camera-button-icon')),
  cameraEmojiAbsent: !document.querySelector('label[for="host-avatar-camera"]')?.textContent.includes('📷'),
  gallery: Boolean(document.querySelector('#host-avatar-gallery')),
  deleteButton: Boolean(document.querySelector('.host-profile-modal .account-delete-btn[data-action="delete-account"]')),
  deleteIconOnly: Boolean(document.querySelector('.host-profile-modal .account-delete-btn svg')) && !document.querySelector('.host-profile-modal .account-delete-btn')?.textContent.trim(),
  deleteInIdentity: Boolean(document.querySelector('.host-profile-modal .identity-field .account-delete-btn')),
  deleteAbsentFromHeader: !document.querySelector('.host-profile-modal .section-title .account-delete-btn'),
  languageCount: document.querySelectorAll('.host-profile-modal [data-language]').length,
  languageOrder: [...document.querySelectorAll('.host-profile-modal [data-language]')].map(button => button.dataset.language),
  languageLabels: [...document.querySelectorAll('.host-profile-modal [data-language]')].map(button => button.getAttribute('aria-label')),
  languageFlags: document.querySelectorAll('.host-profile-modal .language-flag svg').length,
  languageNamesHidden: [...document.querySelectorAll('.host-profile-modal [data-language]')].every(button => !button.textContent.trim()),
  italianFlagStripes: document.querySelectorAll('.host-profile-modal [data-language="it"] svg rect').length,
  discoverable: document.querySelector('[name="discoverable"]')?.checked,
  clubSearchable: document.querySelector('#host-club')?.type === 'search' && document.querySelector('#host-club')?.getAttribute('role') === 'combobox',
  clubAddButton: Boolean(document.querySelector('.host-profile-modal [data-action="open-profile-club-create"]')),
  displayNameLabel: document.querySelector('label[for="host-display-name"]')?.textContent.trim(),
  displayNameRequired: document.querySelector('#host-display-name')?.required,
  nicknameLabel: document.querySelector('label[for="host-nickname"]')?.textContent.trim(),
  nicknameRequired: document.querySelector('#host-nickname')?.required,
  nicknameHint: document.querySelector('#host-nickname-hint')?.textContent.trim(),
  nicknameDescribedBy: document.querySelector('#host-nickname')?.getAttribute('aria-describedby'),
  inputFontSize: parseFloat(getComputedStyle(document.querySelector('#host-display-name')).fontSize),
  inputAutofocus: document.querySelector('#host-display-name').hasAttribute('autofocus'),
  descriptionPlaceholder: document.querySelector('#host-description')?.placeholder,
  dialogFocused: document.activeElement === document.querySelector('.host-profile-modal'),
  dialogScrollTop: document.querySelector('.host-profile-modal').scrollTop,
  sheetTop: Math.round(document.querySelector('.modal').getBoundingClientRect().top),
  sheetLeft: Math.round(document.querySelector('.modal').getBoundingClientRect().left),
  sheetBottom: Math.round(document.querySelector('.modal').getBoundingClientRect().bottom),
  sheetRightGap: Math.round(innerWidth - document.querySelector('.modal').getBoundingClientRect().right),
  viewportBottom: innerHeight
})`);
await captureScreenshot(process.env.SMOKE_PROFILE_SCREENSHOT);
await evaluate(`document.querySelector('#host-club').focus()`);
await wait(100);
const hostClubPicker = await evaluate(`({
  expanded: document.querySelector('#host-club')?.getAttribute('aria-expanded'),
  focused: document.activeElement?.id === 'host-club',
  builtinEnjoy: Boolean(document.querySelector('[data-action="select-profile-club"][data-id="builtin_enjoy"]'))
})`);
await click('[data-action="select-profile-club"][data-id="builtin_enjoy"]');
await click('[data-action="open-profile-club-create"]');
const profileVenueCreate = await evaluate(`({
  venueModal: document.querySelector('.venue-modal h2')?.textContent.trim(),
  nameInitiallyBlank: document.querySelector('.venue-modal [name="name"]')?.value === ''
})`);
await evaluate(`document.querySelector('.venue-modal [name="name"]').value = 'Smoke Profile Club'`);
await click('.venue-modal button[type="submit"]');
const profileVenueReturn = await evaluate(`({
  profileRestored: Boolean(document.querySelector('.host-profile-modal')),
  club: document.querySelector('#host-club')?.value
})`);
await evaluate(`document.querySelector('#host-display-name').value = 'Ведучий Smoke'`);
await evaluate(`document.querySelector('#host-nickname').value = 'Smoke Нік'`);
await evaluate(`(async () => {
  const image = await fetch('./assets/favicon-64.png').then(response => response.blob());
  const transfer = new DataTransfer();
  transfer.items.add(new File([image], 'profile.png', { type: image.type }));
  const input = document.querySelector('#host-avatar-gallery');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await wait(500);
const hostAvatarDraft = await evaluate(`({
  namePreserved: document.querySelector('#host-display-name')?.value,
  nicknamePreserved: document.querySelector('#host-nickname')?.value,
  customPreview: document.querySelector('.host-profile-modal .avatar-editor img')?.src.startsWith('data:image/')
})`);
await click('[data-form="host-profile"] button[type="submit"]');
const editedHostName = await evaluate(`document.querySelector('.profile-btn > span:last-child')?.textContent`);
const savedHostAvatar = await evaluate(`new Promise((resolve, reject) => {
  const request = indexedDB.open('mafia-desk-local-smoke-test');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const row = request.result.transaction('settings').objectStore('settings').get('hostProfile');
    row.onerror = () => reject(row.error);
    row.onsuccess = () => resolve({
      header: document.querySelector('.profile-btn .avatar')?.src.startsWith('data:image/'),
      stored: row.result?.value?.avatar?.startsWith('data:image/'),
      club: row.result?.value?.club
    });
  };
})`);
await click('[href="#settings"]');
const settingsChrome = await inspectAppChrome();
const profilePhotoSyncStatus = await evaluate(`({
  label: document.querySelector('.host-profile-summary [data-photo-sync-status]')?.textContent,
  status: document.querySelector('.host-profile-summary [data-photo-sync-status]')?.dataset.photoSyncStatus,
  visible: Boolean(document.querySelector('.host-profile-summary [data-photo-sync-status]')?.getBoundingClientRect().width)
})`);
const settingsActionLayout = await evaluate(`(() => {
  const measure = selector => {
    const row = document.querySelector(selector);
    const buttons = [...row.querySelectorAll(':scope > .btn')].filter(button => button.offsetParent !== null);
    const rowRect = row.getBoundingClientRect();
    const firstRect = buttons[0].getBoundingClientRect();
    const lastRect = buttons.at(-1).getBoundingClientRect();
    return {
      count: buttons.length,
      fillsWidth: Math.abs((lastRect.right - firstRect.left) - rowRect.width) <= 2,
      singleButtonFills: buttons.length !== 1 || Math.abs(firstRect.width - rowRect.width) <= 2
    };
  };
  return { drive: measure('.drive-actions'), observer: measure('.observer-actions') };
})()`);
const themeOptions = await evaluate(`document.querySelectorAll('[data-theme-choice]').length`);
const languageOptions = await evaluate(`({
  count: document.querySelectorAll('main [data-language]').length,
  order: [...document.querySelectorAll('main [data-language]')].map(button => button.dataset.language),
  labels: [...document.querySelectorAll('main [data-language]')].map(button => button.getAttribute('aria-label')),
  flags: document.querySelectorAll('main .language-flag svg').length,
  namesHidden: [...document.querySelectorAll('main [data-language]')].every(button => !button.textContent.trim()),
  italianFlagStripes: document.querySelectorAll('main [data-language="it"] svg rect').length,
  selected: document.querySelector('main [data-language][aria-checked="true"]')?.dataset.language
})`);
await click('main [data-language="en"]');
const englishLanguage = await evaluate(`({
  lang: document.documentElement.lang,
  stored: localStorage.getItem('mafia-desk-language'),
  title: document.querySelector('.page-head h1')?.textContent,
  nav: [...document.querySelectorAll('.bottom-nav .nav-item')].map(item => item.textContent.trim()),
  field: [...document.querySelectorAll('.field-label')].find(item => item.textContent.includes('App language'))?.textContent.trim(),
  selected: document.querySelector('main [data-language][aria-checked="true"]')?.dataset.language
})`);
await click('main [data-language="fr"]');
const frenchLanguage = await evaluate(`({ lang: document.documentElement.lang, title: document.querySelector('.page-head h1')?.textContent, more: document.querySelector('.bottom-nav [aria-current="page"]')?.textContent.trim(), selected: document.querySelector('main [data-language][aria-checked="true"]')?.dataset.language })`);
await click('main [data-language="it"]');
const italianLanguage = await evaluate(`({ lang: document.documentElement.lang, title: document.querySelector('.page-head h1')?.textContent, more: document.querySelector('.bottom-nav [aria-current="page"]')?.textContent.trim(), selected: document.querySelector('main [data-language][aria-checked="true"]')?.dataset.language })`);
await click('main [data-language="uk"]');
const restoredUkrainianLanguage = await evaluate(`({ lang: document.documentElement.lang, stored: localStorage.getItem('mafia-desk-language'), title: document.querySelector('.page-head h1')?.textContent, selected: document.querySelector('main [data-language][aria-checked="true"]')?.dataset.language })`);
const settingsHeaderBrandAbsent = await evaluate(`!document.querySelector('.brand-copy') && !document.querySelector('.shell-header')?.textContent.includes('ENJOY /')`);
const enjoyInfo = await evaluate(`({
  descriptionAbsent: !document.querySelector('.enjoy-info-copy p'),
  instagramIcon: Boolean(document.querySelector('.enjoy-info-card a[href*="instagram.com"] .instagram-app-icon')),
  mapsIcon: Boolean(document.querySelector('.enjoy-info-card a[href*="google.com/maps"] .maps-app-icon')),
  iconOnly: [...document.querySelectorAll('.enjoy-info-card .cafe-icon-link')].every(link => !link.textContent.trim() && link.querySelector('svg')),
  wordmarkAbsent: !document.querySelector('.enjoy-info-card .enjoy-wordmark'),
  smallestLink: Math.round(Math.min(...[...document.querySelectorAll('.enjoy-info-card .cafe-icon-link')].map(link => link.getBoundingClientRect().width))),
  cardHeight: Math.round(document.querySelector('.enjoy-info-card')?.getBoundingClientRect().height || 0)
})`);
const manualJsonTransferAbsent = await evaluate(`!document.querySelector('[data-action="export-data"], [data-action="import-data"], #import-file')`);
const settingsTechnicalTermsAbsent = await evaluate(`!/(?:firestore|firebase)/i.test(document.querySelector('#app').textContent) && [...document.querySelectorAll('#app [data-tooltip]')].every(element => !/(?:firestore|firebase)/i.test(element.dataset.tooltip))`);
const darkPalette = await evaluate(`({ active: document.documentElement.dataset.theme, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), art: getComputedStyle(document.documentElement).getPropertyValue('--body-art').trim(), artSize: getComputedStyle(document.documentElement).getPropertyValue('--body-art-size').trim(), artLayerSize: getComputedStyle(document.body, '::before').backgroundSize, card: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() })`);
await click('[data-theme-choice="light"]');
const lightPalette = await evaluate(`({ active: document.documentElement.dataset.theme, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), art: getComputedStyle(document.documentElement).getPropertyValue('--body-art').trim(), card: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() })`);
await captureScreenshot(process.env.SMOKE_LIGHT_SCREENSHOT);
await click('[data-theme-choice="cafe"]');
const cafeTheme = await evaluate(`({
  active: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
  art: getComputedStyle(document.documentElement).getPropertyValue('--body-art').trim(),
  card: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim(),
  cached: localStorage.getItem('mafia-desk-theme'),
  pressed: document.querySelector('[data-theme-choice="cafe"]')?.getAttribute('aria-pressed'),
  themeColor: document.querySelector('meta[name="theme-color"]')?.content
})`);
const rulesLinks = await evaluate(`({
  count: document.querySelectorAll('.rules-links a').length,
  ukrainian: document.querySelector('.rules-links a[href*="imafia.org/game-rules"]')?.href,
  international: document.querySelector('.rules-links a[href*="fiim.world/fiim-rules"]')?.href,
  externalSafety: [...document.querySelectorAll('.rules-links a')].every(link => link.target === '_blank' && link.rel.includes('noopener')),
  arrowsAbsent: ![...document.querySelectorAll('a, button')].some(element => element.textContent.includes('↗'))
})`);
const compactHelp = await evaluate(`({
  count: document.querySelectorAll('.help[data-tooltip]').length,
  visiblePageDescriptions: document.querySelectorAll('.page-head p').length,
  visibleSectionDescriptions: document.querySelectorAll('.section-title p').length,
  visibleFieldHints: document.querySelectorAll('.field-hint').length,
  circular: (() => {
    const button = document.querySelector('.page-head .help');
    const style = getComputedStyle(button);
    return Math.abs(button.getBoundingClientRect().width - button.getBoundingClientRect().height) < 1 && style.borderRadius === '50%';
  })()
})`);
await click('.page-head .help');
const helpPopover = await evaluate(`(() => {
  const pop = document.querySelector('.tooltip-pop');
  const rect = pop?.getBoundingClientRect();
  return {
    visible: Boolean(pop),
    role: pop?.getAttribute('role'),
    text: pop?.textContent,
    insideViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight)
  };
})()`);
await click('[data-action="delete-account"]');
const accountDeleteModalFrame = await inspectModalFrame();
const accountDeletion = await evaluate(`({
  trashIconOnly: Boolean(document.querySelector('.account-delete-btn svg')) && !document.querySelector('.account-delete-btn')?.textContent.trim(),
  trashButtonSize: document.querySelector('.account-delete-btn')?.getBoundingClientRect().height,
  dialog: Boolean(document.querySelector('.account-delete-modal[role="alertdialog"]')),
  title: document.querySelector('#delete-account-title')?.textContent,
  retentionCopyAbsent: !document.querySelector('.account-delete-modal')?.textContent.includes('Залишаться без змін') && !document.querySelector('.account-delete-modal')?.textContent.includes('резервна копія у Google Drive'),
  confirm: document.querySelector('[data-action="confirm-delete-account"]')?.textContent,
  focused: document.activeElement === document.querySelector('.account-delete-modal'),
  scrollTop: document.querySelector('.account-delete-modal')?.scrollTop,
  top: Math.round(document.querySelector('.account-delete-modal')?.getBoundingClientRect().top || 0),
  left: Math.round(document.querySelector('.account-delete-modal')?.getBoundingClientRect().left || 0),
  rightGap: Math.round(innerWidth - (document.querySelector('.account-delete-modal')?.getBoundingClientRect().right || innerWidth)),
  bottomWithinViewport: document.querySelector('.account-delete-modal')?.getBoundingClientRect().bottom <= innerHeight - 6,
  backdropAlign: getComputedStyle(document.querySelector('.account-delete-backdrop')).alignItems,
  bordered: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].every(property => parseFloat(getComputedStyle(document.querySelector('.account-delete-modal'))[property]) >= 1)
})`);
await captureScreenshot(process.env.SMOKE_DELETE_ACCOUNT_SCREENSHOT);
await click('.account-delete-modal [data-action="close-modal"]');
await click('.page-head h1');
if (process.env.SMOKE_THEME_SCREENSHOT) {
  await captureScreenshot(process.env.SMOKE_THEME_SCREENSHOT);
}
await click('[data-theme-choice="dark"]');

await click('[href="#stats"]');
const statsChrome = await inspectAppChrome();
const statsPanelDefault = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="statsRoles"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-statsRoles')?.hidden,
  graphPresent: Boolean(document.querySelector('#panel-statsRoles .bar-chart'))
})`);
await click('[data-action="toggle-panel"][data-panel="statsRoles"]');
const statsPanelExpanded = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="statsRoles"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-statsRoles')?.hidden,
  focused: document.activeElement?.dataset.panel
})`);
await click('[data-action="toggle-panel"][data-panel="statsRoles"]');
const statsPlayersDefault = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="statsPlayers"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-statsPlayers')?.hidden,
  emptyState: Boolean(document.querySelector('#panel-statsPlayers .ui-state.state-empty'))
})`);
await click('[data-action="toggle-panel"][data-panel="statsPlayers"]');
const statsPlayersExpanded = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="statsPlayers"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-statsPlayers')?.hidden,
  focused: document.activeElement?.dataset.panel,
  panelHeight: Math.round(document.querySelector('[data-panel="statsPlayers"]')?.getBoundingClientRect().height || 0)
})`);
await click('[data-action="toggle-panel"][data-panel="statsPlayers"]');
const emptySharedStats = await evaluate(`({
  title: document.querySelector('.page-head h1')?.textContent,
  description: document.querySelector('.page-head .help')?.dataset.tooltip,
  archiveTitle: [...document.querySelectorAll('.section-title h2')].find(element => element.textContent.includes('архів'))?.textContent,
  blackRate: document.querySelectorAll('.stat-card b')[2]?.textContent,
  summaryCentered: [...document.querySelectorAll('.stats-summary-grid .stat-card')].length === 4 && [...document.querySelectorAll('.stats-summary-grid .stat-card')].every(card => getComputedStyle(card).textAlign === 'center' && getComputedStyle(card).alignItems === 'center'),
  technicalTermsAbsent: !/(?:firestore|firebase)/i.test(document.querySelector('#app').textContent) && [...document.querySelectorAll('#app [data-tooltip]')].every(element => !/(?:firestore|firebase)/i.test(element.dataset.tooltip)),
  unifiedStates: document.querySelectorAll('.ui-state').length >= 3 && [...document.querySelectorAll('.ui-state')].every(state => state.querySelector('.state-icon svg') && state.querySelector('.state-copy')),
  emptyStates: document.querySelectorAll('.ui-state.state-empty').length >= 2
})`);
await captureScreenshot(process.env.SMOKE_STATS_SCREENSHOT);

await click('[href="#players"]');
const playersChrome = await inspectAppChrome();
const telegramImportAbsent = await evaluate(`({
  input: !document.querySelector('#telegram-import-file'),
  action: !document.querySelector('[data-action="import-telegram"]'),
  modal: !document.querySelector('[data-form="telegram-import"]')
})`);
await evaluate(`(async () => {
  const timestamp = new Date().toISOString();
  const payload = {
    schema: 1,
    players: Array.from({ length: 12 }, (_, index) => ({
      id: 'fixture-player-' + (index + 1),
      name: 'Гравець ' + (index + 1),
      nickname: '',
      contact: 'Enjoy',
      notes: '',
      avatar: index === 0 ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Cpath fill='%23c33' d='M0 0h1v1H0z'/%3E%3C/svg%3E" : '',
      linkedCloudUid: index === 0 ? 'online-google-fixture' : index === 1 ? 'offline-google-fixture' : '',
      lastSeenAt: index === 0 ? Date.now() : index === 1 ? Date.now() - 600000 : 0,
      createdAt: timestamp,
      updatedAt: timestamp
    })),
    games: [],
    settings: []
  };
  const { importDatabase } = await import('./src/db.js');
  await importDatabase(payload, { replace: false });
  return true;
})()`);
await evaluate(`location.reload()`);
await wait(700);
const presenceStatuses = await evaluate(`(() => {
  const root = document.documentElement;
  const originalTheme = root.dataset.theme;
  root.dataset.theme = 'light';
  const onlineStyle = getComputedStyle(document.querySelector('[data-presence="online"]'));
  const offlineStyle = getComputedStyle(document.querySelector('[data-presence="offline"]'));
  const result = {
    googleCards: document.querySelectorAll('.player-card.google-profile').length,
    online: document.querySelectorAll('.player-card.google-profile [data-presence="online"]').length,
    offline: document.querySelectorAll('.player-card.google-profile [data-presence="offline"]').length,
    manualPresenceAbsent: [...document.querySelectorAll('.player-card:not(.google-profile)')].every(card => !card.querySelector('[data-presence]')),
    labels: [...document.querySelectorAll('.player-card.google-profile [data-presence]')].map(badge => badge.textContent.trim()),
    dots: document.querySelectorAll('.player-card.google-profile .presence-badge i').length,
    lightOnlineColor: onlineStyle.color,
    lightOnlineBackground: onlineStyle.backgroundColor,
    lightOfflineColor: offlineStyle.color,
    lightOfflineBackground: offlineStyle.backgroundColor
  };
  root.dataset.theme = originalTheme;
  return result;
})()`);
await click('.players-fab-group [data-action="new-player"]');
const playerModalFrame = await inspectModalFrame();
await captureScreenshot(process.env.SMOKE_PLAYER_MODAL_SCREENSHOT);
const cameraControl = await evaluate(`({
  cameraInput: Boolean(document.querySelector('#avatar-camera')),
  captureMode: document.querySelector('#avatar-camera')?.getAttribute('capture'),
  vectorIcon: Boolean(document.querySelector('label[for="avatar-camera"] .camera-button-icon')),
  emojiAbsent: !document.querySelector('label[for="avatar-camera"]')?.textContent.includes('📷'),
  galleryInput: Boolean(document.querySelector('#avatar-gallery')),
  emailInputType: document.querySelector('#player-email')?.type,
  emailHelp: document.querySelector('label[for="player-email"] .help')?.dataset.tooltip
})`);
await evaluate(`document.querySelector('#player-name').value = 'Тестова Гравчиня'`);
await evaluate(`document.querySelector('#player-nickname').value = 'Тестовий Нік'`);
await evaluate(`document.querySelector('#player-email').value = 'PLAYER.TEST@EXAMPLE.COM'`);
await click('.modal button[type="submit"]');
await wait(200);
const profile = await evaluate(`({ cards: document.querySelectorAll('.player-card').length, modalOpen: Boolean(document.querySelector('.modal')), pendingGoogleLink: [...document.querySelectorAll('.player-card')].some(card => card.textContent.includes('Очікує Google')) })`);
if (await evaluate(`Boolean(document.querySelector('[data-action="clear-next-game"]'))`)) await click('[data-action="clear-next-game"]');
const lineupIds = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[data-action="toggle-next-player"]')];
  const preferred = buttons.find(button => button.closest('.player-card')?.textContent.includes('Тестовий Нік'));
  return [preferred, ...buttons.filter(button => button !== preferred)].slice(0, 12).map(button => button.dataset.id);
})()`);
for (const id of lineupIds) {
  await evaluate(`(id => [...document.querySelectorAll('[data-action="toggle-next-player"]')].find(button => button.dataset.id === id)?.click())(${JSON.stringify(id)})`);
  await wait(40);
}
const lineupSelection = await evaluate(`({
  selected: document.querySelectorAll('.queue-player-btn.selected').length,
  status: document.querySelector('.lineup-head b')?.textContent,
  chips: document.querySelectorAll('.lineup-chip').length,
  waitingChips: document.querySelectorAll('.lineup-chip.waiting').length,
  positions: [...document.querySelectorAll('.queue-player-btn.selected small')].map(item => Number(item.textContent))
})`);
const playersLayout = await evaluate(`(() => {
  const group = document.querySelector('.players-fab-group');
  const actions = [...group.querySelectorAll('.mobile-fab')];
  const rect = group.getBoundingClientRect();
  const navigation = document.querySelector('.bottom-nav').getBoundingClientRect();
  const manualCard = [...document.querySelectorAll('.player-card')].find(card => card.textContent.includes('Тестовий Нік'));
  const cardActions = [...(manualCard?.querySelectorAll('.player-card-actions > button') || [])];
  return {
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    topActionHidden: getComputedStyle(document.querySelector('.page-head > .actions')).display === 'none',
    searchActionHidden: getComputedStyle(document.querySelector('.search-row > .btn')).display === 'none',
    textSeatingHidden: getComputedStyle(document.querySelector('.lineup-actions [data-action="prepare-next-game"]')).display === 'none',
    fabVisible: getComputedStyle(group).display !== 'none',
    actionCount: actions.length,
    fabSquare: actions.every(button => Math.round(button.getBoundingClientRect().width) === 68 && Math.round(button.getBoundingClientRect().height) === 68),
    addPlayerIcon: Boolean(actions[0]?.querySelector('.add-player-fab-icon .fab-plus')),
    seatingIcon: Boolean(actions[1]?.querySelector('.seating-fab-icon')),
    addPlayerGold: actions[0]?.classList.contains('primary-fab'),
    seatingRed: actions[1]?.classList.contains('danger-fab'),
    fabCentered: Math.abs((rect.left + rect.width / 2) - innerWidth / 2) <= 1,
    fabAboveNavigation: rect.bottom <= navigation.top - 10,
    labels: actions.map(button => button.getAttribute('aria-label')),
    preferredName: manualCard?.querySelector('.player-name-line h3')?.textContent,
    clubInline: [...document.querySelectorAll('.player-name-line')].some(line => line.querySelector('h3') && line.querySelector('.player-club')),
    guestPlainText: manualCard?.querySelector('.guest-label')?.textContent === 'Гість' && ![...manualCard.querySelectorAll('.badge')].some(badge => badge.textContent.includes('Додано ведучим')),
    cardActionCount: cardActions.length,
    cardActionsSameRow: new Set(cardActions.map(button => Math.round(button.getBoundingClientRect().top))).size === 1,
    queueActionLast: cardActions.at(-1)?.matches('[data-action="toggle-next-player"]'),
    playerGap: parseFloat(getComputedStyle(document.querySelector('.player-grid')).rowGap)
  };
})()`);
await captureScreenshot(process.env.SMOKE_PLAYERS_SCREENSHOT);
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
await wait(100);
const playersCompactLayout = await evaluate(`({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  statusRight: Math.round(document.querySelector('.directory-status').getBoundingClientRect().right),
  refreshWidth: Math.round(document.querySelector('.directory-status .btn').getBoundingClientRect().width),
  smallestQueueButton: Math.round(Math.min(...[...document.querySelectorAll('.queue-player-btn')].map(button => button.getBoundingClientRect().height))),
  cardsInsideViewport: [...document.querySelectorAll('.player-card')].every(card => card.getBoundingClientRect().right <= innerWidth),
  actionRowsHorizontal: [...document.querySelectorAll('.player-card-actions')].every(group => new Set([...group.children].map(button => Math.round(button.getBoundingClientRect().top))).size <= 1),
  queueActionsLast: [...document.querySelectorAll('.player-card-actions')].every(group => group.lastElementChild?.matches('[data-action="toggle-next-player"]')),
  fabRight: Math.round(document.querySelector('.players-fab-group').getBoundingClientRect().right),
  fabLeft: Math.round(document.querySelector('.players-fab-group').getBoundingClientRect().left)
})`);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(100);

await click('.players-fab-group [data-action="prepare-next-game"]');
const setupChrome = await inspectAppChrome();
const setupPanelsDefault = await evaluate(`Object.fromEntries(['setupGame', 'setupTimers', 'setupMusic', 'setupRules', 'setupSeating'].map(panel => {
  const toggle = document.querySelector('[data-action="toggle-panel"][data-panel="' + panel + '"]');
  return [panel, { expanded: toggle?.getAttribute('aria-expanded'), hidden: document.querySelector('#panel-' + panel)?.hidden }];
}))`);
const setupPanelSpacing = await evaluate(`(() => {
  const panels = ['setupGame', 'setupTimers', 'setupMusic', 'setupSeating', 'setupRules']
    .map(name => document.querySelector('[data-panel="' + name + '"]').getBoundingClientRect());
  const gaps = panels.slice(1).map((panel, index) => Math.round(panel.top - panels[index].bottom));
  return { gaps, spread: Math.max(...gaps) - Math.min(...gaps) };
})()`);
const setupPanelOrder = await evaluate(`[...document.querySelectorAll('main > .collapsible-panel')].map(panel => panel.dataset.panel)`);
await click('[data-action="toggle-panel"][data-panel="setupRules"]');
const setupRulesLinks = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="setupRules"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-setupRules')?.hidden,
  count: document.querySelectorAll('#panel-setupRules .rules-links a').length,
  ukrainian: document.querySelector('#panel-setupRules a[href*="imafia.org/game-rules"]')?.href,
  international: document.querySelector('#panel-setupRules a[href*="fiim.world/fiim-rules"]')?.href,
  externalSafety: [...document.querySelectorAll('#panel-setupRules .rules-links a')].every(link => link.target === '_blank' && link.rel.includes('noopener')),
  arrowsAbsent: ![...document.querySelectorAll('a, button')].some(element => element.textContent.includes('↗'))
})`);
const setupTypography = await evaluate(`({
  heading: getComputedStyle(document.querySelector('.page-head h1')).fontFamily,
  panel: getComputedStyle(document.querySelector('.collapsible-toggle h2')).fontFamily,
  field: getComputedStyle(document.querySelector('.input')).fontFamily,
  foulHelp: [...document.querySelectorAll('.field .help')].find(button => button.getAttribute('aria-label')?.includes('Система фолів'))?.dataset.tooltip
})`);
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
await wait(100);
const setupCompactLayout = await evaluate(`({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  moveButtons: document.querySelectorAll('.seat-move-btn').length,
  smallestMoveButton: Math.round(Math.min(...[...document.querySelectorAll('.seat-move-btn')].map(button => button.getBoundingClientRect().height))),
  playerPickers: document.querySelectorAll('.seat-player-picker').length,
  smallestPlayerPicker: Math.round(Math.min(...[...document.querySelectorAll('.seat-player-picker')].map(picker => picker.getBoundingClientRect().height))),
  pickerIcons: document.querySelectorAll('.seat-player-picker > svg').length,
  seatAvatars: document.querySelectorAll('.seat-inline-avatar').length,
  avatarControls: document.querySelectorAll('.seat-avatar-control').length,
  editableAvatarControls: document.querySelectorAll('[data-action="open-setup-avatar"]').length,
  generatedAvatars: document.querySelectorAll('.seat-inline-avatar.generated-avatar').length,
  profileAvatars: document.querySelectorAll('.seat-inline-avatar:not(.generated-avatar)').length,
  avatarSources: [...document.querySelectorAll('.seat-inline-avatar')].map(image => image.getAttribute('src')),
  uniqueGeneratedAvatars: (() => {
    const sources = [...document.querySelectorAll('.seat-inline-avatar.generated-avatar')].map(image => image.getAttribute('src'));
    return new Set(sources).size === sources.length;
  })(),
  avatarsFill: [...document.querySelectorAll('.seat-inline-avatar')].every(image => {
    const imageRect = image.getBoundingClientRect();
    return getComputedStyle(image).objectFit === 'cover' && Math.abs(imageRect.width - imageRect.height) <= 1 && Math.round(imageRect.width) === 40;
  }),
  avatarBetweenPickerAndName: [...document.querySelectorAll('.seat-setup-row')].every(row => row.children[1]?.classList.contains('seat-player-picker') && row.children[2]?.classList.contains('seat-avatar-control') && row.children[2]?.querySelector('.seat-inline-avatar') && row.children[3]?.classList.contains('seat-name-input')),
  nameInputs: document.querySelectorAll('.seat-name-input').length,
  collapsedPanelMaxHeight: Math.round(Math.max(...[...document.querySelectorAll('.collapsible-panel[data-panel^="setup"]:not(.expanded)')].map(panel => panel.getBoundingClientRect().height))),
  collapsedToggleMinHeight: Math.round(Math.min(...[...document.querySelectorAll('.collapsible-panel[data-panel^="setup"]:not(.expanded) .collapsible-toggle')].map(toggle => toggle.getBoundingClientRect().height))),
  maxRowHeight: Math.round(Math.max(...[...document.querySelectorAll('.seat-setup-row')].map(row => row.getBoundingClientRect().height))),
  rowBordersAbsent: [...document.querySelectorAll('.seat-setup-row')].every(row => getComputedStyle(row).borderTopWidth === '0px'),
  rowBackgroundsTransparent: [...document.querySelectorAll('.seat-setup-row')].every(row => getComputedStyle(row).backgroundColor === 'rgba(0, 0, 0, 0)'),
  rowGap: Math.round(parseFloat(getComputedStyle(document.querySelector('.seat-setup')).rowGap)),
  nativeSelectsCompact: [...document.querySelectorAll('.seat-profile-select')].every(select => getComputedStyle(select).opacity === '0' && getComputedStyle(select).position === 'absolute'),
  footerActionsHidden: getComputedStyle(document.querySelector('.panel-footer-actions')).display === 'none',
  seatingActionsEqualWidth: (() => {
    const dealRect = document.querySelector('.setup-deal-action')?.getBoundingClientRect();
    const shuffleRect = document.querySelector('[data-action="shuffle-seats"]')?.getBoundingClientRect();
    return Boolean(dealRect && shuffleRect && Math.abs(dealRect.width - shuffleRect.width) <= 1);
  })(),
  clearSeatingControl: (() => {
    const button = document.querySelector('[data-action="clear-setup-seats"]');
    const rect = button?.getBoundingClientRect();
    const shuffleRect = document.querySelector('[data-action="shuffle-seats"]')?.getBoundingClientRect();
    const dealRect = document.querySelector('.setup-deal-action')?.getBoundingClientRect();
    return {
      visible: Boolean(button && getComputedStyle(button).display !== 'none'),
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
      square: Boolean(rect && Math.abs(rect.width - rect.height) <= 1),
      matchesShuffle: Boolean(rect && shuffleRect && Math.abs(rect.height - shuffleRect.height) <= 1),
      matchesDeal: Boolean(rect && dealRect && Math.abs(rect.height - dealRect.height) <= 1),
      insideViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth)
    };
  })(),
  floatingActions: (() => {
    const group = document.querySelector('.setup-fab-group');
    const actions = [...group.querySelectorAll('.mobile-fab')];
    const rects = actions.map(button => button.getBoundingClientRect());
    const groupRect = group.getBoundingClientRect();
    const navigation = document.querySelector('.bottom-nav').getBoundingClientRect();
    return {
      visible: getComputedStyle(group).display !== 'none',
      count: actions.length,
      square: rects.every(rect => Math.round(rect.width) === 68 && Math.round(rect.height) === 68),
      centered: Math.abs((groupRect.left + groupRect.width / 2) - innerWidth / 2) <= 2,
      aboveNavigation: groupRect.bottom <= navigation.top,
      addPlayerIcon: Boolean(actions[0]?.querySelector('.add-player-fab-icon .fab-plus')),
      dealRolesIcon: Boolean(actions[1]?.querySelector('.deal-roles-fab-icon .role-card-mark')),
      addLabel: actions[0]?.getAttribute('aria-label'),
      dealLabel: actions[1]?.getAttribute('aria-label'),
      addPlayerGold: actions[0]?.classList.contains('primary-fab') && getComputedStyle(actions[0]).backgroundColor === 'rgb(216, 170, 88)',
      dangerColor: getComputedStyle(actions[1]).backgroundColor
    };
  })()
})`);
await click('[data-action="toggle-panel"][data-panel="setupTimers"]');
const setupTimersMobileLayout = await evaluate(`(() => {
  const panel = document.querySelector('[data-panel="setupTimers"]');
  const fields = [...panel.querySelectorAll('.setup-options .field')];
  const rects = fields.map(field => field.getBoundingClientRect());
  const lefts = [...new Set(rects.map(rect => Math.round(rect.left)))];
  const tops = [...new Set(rects.map(rect => Math.round(rect.top)))];
  const foulField = panel.querySelector('.divider + .field')?.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  return {
    fields: fields.length,
    columns: lefts.length,
    rows: tops.length,
    equalWidths: Math.max(...rects.map(rect => rect.width)) - Math.min(...rects.map(rect => rect.width)) <= 1,
    inputsInsideColumns: [...panel.querySelectorAll('.setup-options .input')].every(input => { const rect = input.getBoundingClientRect(); return rect.left >= panelRect.left && rect.right <= panelRect.right; }),
    foulFullWidth: Boolean(foulField && foulField.width >= panelRect.width - 26),
    scrollWidth: document.documentElement.scrollWidth,
    expanded: panel.classList.contains('expanded') && !document.querySelector('#panel-setupTimers')?.hidden
  };
})()`);
await click('[data-action="toggle-panel"][data-panel="setupTimers"]');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(100);
await click('[data-action="toggle-panel"][data-panel="setupMusic"]');
const setupMusic = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="setupMusic"]')?.getAttribute('aria-expanded'),
  switchState: document.querySelector('#panel-setupMusic [data-action="toggle-draft-music"]')?.getAttribute('aria-checked'),
  cues: [...document.querySelectorAll('#panel-setupMusic [data-music-cue-card]')].map(card => card.dataset.musicCueCard),
  choices: document.querySelectorAll('#panel-setupMusic [data-input="setup-music-choice"]').length,
  builtinsPerChoice: [...document.querySelectorAll('#panel-setupMusic [data-input="setup-music-choice"]')].map(select => [...select.options].filter(option => !option.value.startsWith('custom:')).length),
  customChoices: [...document.querySelectorAll('#panel-setupMusic [data-input="setup-music-choice"]')].every(select => [...select.options].some(option => option.value === 'custom:' + select.dataset.musicCue)),
  fileInputs: document.querySelectorAll('#panel-setupMusic [data-input="setup-music-file"][accept="audio/*"]').length,
  previews: document.querySelectorAll('#panel-setupMusic [data-action="preview-setup-music"]').length,
  pauses: document.querySelectorAll('#panel-setupMusic [data-action="pause-setup-music"]').length,
  pauseIconsOnly: [...document.querySelectorAll('#panel-setupMusic [data-action="pause-setup-music"]')].every(button => Boolean(button.querySelector('svg')) && !button.textContent.trim()),
  pauseLabels: [...document.querySelectorAll('#panel-setupMusic [data-action="pause-setup-music"]')].every(button => button.getAttribute('aria-label') === 'Призупинити музику'),
  pauseSquares: [...document.querySelectorAll('#panel-setupMusic [data-action="pause-setup-music"]')].every(button => {
    const rect = button.getBoundingClientRect();
    return Math.abs(rect.width - rect.height) <= 1;
  }),
  pauseBetween: [...document.querySelectorAll('#panel-setupMusic .setup-music-actions')].every(actions => actions.children[0]?.matches('[data-action="preview-setup-music"]') && actions.children[1]?.matches('[data-action="pause-setup-music"]') && actions.children[2]?.matches('.setup-music-file-button')),
  localOnly: document.querySelector('#panel-setupMusic .setup-music-note')?.textContent.includes('не завантажуються в мережу'),
  scrollWidth: document.documentElement.scrollWidth
})`);
await click('#panel-setupMusic [data-action="toggle-draft-music"]');
const setupMusicEnabled = await evaluate(`({
  checked: document.querySelector('#panel-setupMusic [data-action="toggle-draft-music"]')?.getAttribute('aria-checked'),
  badge: document.querySelector('[data-panel="setupMusic"] .badge')?.textContent.trim()
})`);
await click('#panel-setupMusic [data-action="toggle-draft-music"]');
await click('[data-action="toggle-panel"][data-panel="setupMusic"]');
await evaluate('scrollTo(0, 0)');
await wait(50);
await captureScreenshot(process.env.SMOKE_SETUP_SCREENSHOT);
await click('[data-action="toggle-panel"][data-panel="setupGame"]');
const setupGameExpanded = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="setupGame"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-setupGame')?.hidden,
  focused: document.activeElement?.dataset.panel
})`);
await evaluate(`document.querySelector('#game-venue').focus()`);
await wait(100);
const venuePicker = await evaluate(`({
  searchable: document.querySelector('#game-venue')?.type === 'search' && document.querySelector('#game-venue')?.getAttribute('role') === 'combobox',
  expanded: document.querySelector('#game-venue')?.getAttribute('aria-expanded'),
  focused: document.activeElement?.id === 'game-venue',
  addButton: Boolean(document.querySelector('[data-action="open-venue-create"]')),
  builtinEnjoy: [...document.querySelectorAll('[data-action="select-game-venue"] b')].some(item => item.textContent.trim() === 'Enjoy'),
  venue: document.querySelector('#game-venue')?.value,
  title: document.querySelector('#game-title')?.value,
  titleUsesVenueDateTime: /^Enjoy · \\d{2}\\.\\d{2} · \\d{2}:\\d{2}$/.test(document.querySelector('#game-title')?.value || '')
})`);
await click('[data-action="open-venue-create"]');
const venueModalFrame = await inspectModalFrame();
const venueModal = await evaluate(`({
  title: document.querySelector('.venue-modal h2')?.textContent.trim(),
  form: document.querySelector('.venue-modal')?.dataset.form,
  fields: [...document.querySelectorAll('.venue-modal [name]')].map(input => input.name),
  googleFill: Boolean(document.querySelector('.venue-modal [data-action="fill-venue-from-google"]')),
  sharedCopy: document.querySelector('.venue-modal')?.textContent.includes('всі авторизовані користувачі')
})`);
await click('.venue-modal [data-action="close-modal"]');
await click('[data-action="toggle-panel"][data-panel="setupGame"]');
const setupTimersCollapsed = setupPanelsDefault.setupTimers;
await click('[data-action="toggle-panel"][data-panel="setupSeating"]');
const setupSeatingCollapsed = await evaluate(`({
  expanded: document.querySelector('[data-action="toggle-panel"][data-panel="setupSeating"]')?.getAttribute('aria-expanded'),
  hidden: document.querySelector('#panel-setupSeating')?.hidden
})`);
await click('[data-action="toggle-panel"][data-panel="setupSeating"]');
const randomTable = await evaluate(`({
  selected: [...document.querySelectorAll('[data-seat-profile]')].filter(select => select.value).length,
  unique: new Set([...document.querySelectorAll('[data-seat-profile]')].map(select => select.value).filter(Boolean)).size,
  venue: document.querySelector('#game-venue')?.value,
  title: document.querySelector('#game-title')?.value,
  titleHasTime: / · \\d{2}:\\d{2}$/.test(document.querySelector('#game-title')?.value || ''),
  rerollAbsent: !document.querySelector('[data-action="random-table"]'),
  dealModeControls: document.querySelectorAll('[data-draft-setting="dealMode"]').length,
  dealModeInSeating: Boolean(document.querySelector('#panel-setupSeating [data-draft-setting="dealMode"]')),
  dealModeOutsideSeating: [...document.querySelectorAll('[data-draft-setting="dealMode"]')].some(control => !control.closest('#panel-setupSeating')),
  dealModeLabel: document.querySelector('.setup-deal-caption > span')?.textContent.trim(),
  dealModeHelp: document.querySelector('.setup-deal-caption .help')?.dataset.tooltip,
  dealModeValue: document.querySelector('[data-draft-setting="dealMode"]')?.value,
  dealModeOptions: [...(document.querySelector('[data-draft-setting="dealMode"]')?.options || [])].map(option => option.textContent.trim()),
  dealModeOptionContrast: (() => {
    const option = document.querySelector('[data-draft-setting="dealMode"] option');
    if (!option) return false;
    const style = getComputedStyle(option);
    return style.color !== style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
  })(),
  shuffleIcon: Boolean(document.querySelector('[data-action="shuffle-seats"] .button-shuffle-icon')),
  clearIcon: Boolean(document.querySelector('[data-action="clear-setup-seats"] .button-clear-seating-icon')),
  clearBroomIcon: Boolean(document.querySelector('[data-action="clear-setup-seats"] .button-broom-icon')),
  clearIconOnly: Boolean(document.querySelector('[data-action="clear-setup-seats"] svg')) && !document.querySelector('[data-action="clear-setup-seats"]')?.textContent.trim(),
  clearLabel: document.querySelector('[data-action="clear-setup-seats"]')?.getAttribute('aria-label'),
  clearAfterShuffle: document.querySelector('[data-action="shuffle-seats"]')?.nextElementSibling?.matches('[data-action="clear-setup-seats"]'),
  iconsDecorative: [...document.querySelectorAll('.setup-random-action .button-random-icon')].every(icon => icon.getAttribute('aria-hidden') === 'true'),
  nicknameFirstOption: [...document.querySelectorAll('[data-seat-profile] option')].find(option => option.textContent.startsWith('Тестовий Нік'))?.textContent
})`);
const queuedTable = await evaluate(`({
  profileIds: [...document.querySelectorAll('[data-seat-profile]')].map(select => select.value),
  followsSelection: [...document.querySelectorAll('[data-seat-profile]')].every((select, index) => select.value === ${JSON.stringify(lineupIds)}[index])
})`);
const seatingOptionFilter = await evaluate(`(() => {
  const selects = [...document.querySelectorAll('[data-seat-profile]')];
  const assigned = selects.map(select => select.value).filter(Boolean);
  const occurrences = new Map();
  selects.forEach(select => [...select.options].filter(option => option.value).forEach(option => occurrences.set(option.value, (occurrences.get(option.value) || 0) + 1)));
  return {
    currentPlayerPreserved: selects.every(select => !select.value || [...select.options].some(option => option.value === select.value && option.selected)),
    occupiedHiddenElsewhere: selects.every(select => [...select.options].every(option => !option.value || option.value === select.value || !assigned.includes(option.value))),
    eachAssignedShownOnce: assigned.every(profileId => occurrences.get(profileId) === 1),
    unassignedRemainAvailable: [...occurrences.entries()].some(([profileId, count]) => !assigned.includes(profileId) && count === selects.length)
  };
})()`);
await click('[data-action="clear-setup-seats"]');
const clearedSeating = await evaluate(`(() => {
  const selects = [...document.querySelectorAll('[data-seat-profile]')];
  const inputs = [...document.querySelectorAll('[data-seat-name]')];
  return {
    seats: selects.length,
    profilesEmpty: selects.every(select => select.value === ''),
    namesEmpty: inputs.every(input => input.value === ''),
    toast: document.querySelector('#toast')?.textContent.trim()
  };
})()`);
await evaluate(`(() => {
  const input = document.querySelector('[data-seat-name="1"]');
  input.value = 'Ручний гравець';
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
clearedSeating.manualEntry = await evaluate(`document.querySelector('[data-seat-name="1"]')?.value`);
await evaluate(`location.hash = '#players'`);
await wait(180);
await click('.players-fab-group [data-action="prepare-next-game"]');
await wait(180);
const setupAvatarTarget = await evaluate(`(() => {
  const select = [...document.querySelectorAll('[data-seat-profile]')].find(item => item.selectedOptions[0]?.textContent.startsWith('Тестовий Нік'));
  return { seat: Number(select?.dataset.seatProfile || 0), playerId: select?.value || '' };
})()`);
await click(`[data-action="open-setup-avatar"][data-seat="${setupAvatarTarget.seat}"]`);
const setupAvatarModalFrame = await inspectModalFrame();
const setupAvatarPickerBefore = await evaluate(`({
  title: document.querySelector('.setup-avatar-modal h2')?.textContent,
  choices: document.querySelectorAll('[data-action="choose-setup-avatar"]').length,
  imageChoices: document.querySelectorAll('[data-action="choose-setup-avatar"] img').length,
  profile: document.querySelector('.setup-avatar-modal .section-heading p')?.textContent,
  manualHelp: document.querySelector('.setup-avatar-help')?.textContent,
  lionEnabled: !document.querySelector('[data-action="choose-setup-avatar"][data-avatar="./assets/avatars/lion.webp"]')?.disabled
})`);
await click('[data-action="choose-setup-avatar"][data-avatar="./assets/avatars/lion.webp"]');
await wait(250);
const setupAvatarSaved = await evaluate(`(async ({ seat, playerId }) => {
  const stored = await new Promise((resolve, reject) => {
    const request = indexedDB.open('mafia-desk-local-smoke-test');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('players', 'readonly');
      const read = transaction.objectStore('players').get(playerId);
      read.onsuccess = () => resolve(read.result || null);
      read.onerror = () => reject(read.error);
    };
  });
  const control = document.querySelector('[data-action="open-setup-avatar"][data-seat="' + seat + '"]');
  return {
    modalClosed: !document.querySelector('.setup-avatar-modal'),
    editable: Boolean(control),
    rowAvatar: control?.querySelector('img')?.getAttribute('src') || '',
    storedAvatar: stored?.avatar || '',
    storedPreset: stored?.avatarPreset || ''
  };
})(${JSON.stringify(setupAvatarTarget)})`);
const setupAvatarPicker = { ...setupAvatarPickerBefore, ...setupAvatarSaved };
const temporaryOriginalProfile = await evaluate(`document.querySelector('[data-seat-profile="10"]').value`);
await evaluate(`(() => {
  const select = document.querySelector('[data-seat-profile="10"]');
  select.value = '';
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await wait(100);
const generatedGuestName = await evaluate(`document.querySelector('[data-seat-name="10"]')?.value`);
const temporaryAvatarLocked = await evaluate(`!document.querySelector('[data-action="open-setup-avatar"][data-seat="10"]')`);
await evaluate(`(() => {
  const input = document.querySelector('[data-seat-name="10"]');
  input.value = 'Ручний Гість';
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await click('[data-action="move-setup-seat"][data-seat="10"]');
await click('[data-action="move-setup-to"][data-to="9"]');
const manualGuestAfterMove = await evaluate(`document.querySelector('[data-seat-name="9"]')?.value`);
await click('[data-action="move-setup-seat"][data-seat="9"]');
await click('[data-action="move-setup-to"][data-to="10"]');
await evaluate(`(profileId => {
  const select = document.querySelector('[data-seat-profile="10"]');
  select.value = profileId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
})(${JSON.stringify(temporaryOriginalProfile)})`);
await wait(100);
const temporaryGuestNames = {
  generated: generatedGuestName,
  replacesNumberedPlaceholder: Boolean(generatedGuestName) && !/^Гравець \d+$/.test(generatedGuestName),
  singleWord: Boolean(generatedGuestName) && /^\S+$/u.test(generatedGuestName),
  manualNameSurvivesMove: manualGuestAfterMove === 'Ручний Гість'
};
const moveBefore = await evaluate(`[document.querySelector('[data-seat-profile="1"]').value, document.querySelector('[data-seat-profile="5"]').value]`);
await click('[data-action="move-setup-seat"][data-seat="1"]');
const setupMoveModalFrame = await inspectModalFrame();
const moveDialog = await evaluate(`({
  title: document.querySelector('.setup-move-modal h2')?.textContent,
  targets: document.querySelectorAll('[data-action="move-setup-to"]').length,
  currentDisabled: document.querySelector('[data-action="move-setup-to"][data-to="1"]')?.disabled
})`);
await click('[data-action="move-setup-to"][data-to="5"]');
const moveAfter = await evaluate(`[document.querySelector('[data-seat-profile="1"]').value, document.querySelector('[data-seat-profile="5"]').value]`);
await click('[data-action="move-setup-seat"][data-seat="5"]');
await click('[data-action="move-setup-to"][data-to="1"]');
const moveRestored = await evaluate(`[document.querySelector('[data-seat-profile="1"]').value, document.querySelector('[data-seat-profile="5"]').value]`);
const seatMove = {
  dialog: moveDialog,
  swapped: moveAfter[0] === moveBefore[1] && moveAfter[1] === moveBefore[0],
  restored: moveRestored[0] === moveBefore[0] && moveRestored[1] === moveBefore[1]
};
const nicknameSeat = await evaluate(`(() => {
  const selects = [...document.querySelectorAll('[data-seat-profile]')];
  const targetOption = selects.flatMap(select => [...select.options]).find(option => option.textContent.startsWith('Тестовий Нік'));
  const current = selects.find(select => select.value === targetOption.value);
  return { currentSeat: Number(current?.dataset.seatProfile || 0) };
})()`);
if (nicknameSeat.currentSeat && nicknameSeat.currentSeat !== 1) {
  await click(`[data-action="move-setup-seat"][data-seat="${nicknameSeat.currentSeat}"]`);
  await click('[data-action="move-setup-to"][data-to="1"]');
}
const roleDealButton = await evaluate(`({
  label: document.querySelector('.panel-footer-actions [data-action="start-game"]')?.textContent.trim(),
  danger: document.querySelector('.panel-footer-actions [data-action="start-game"]')?.classList.contains('danger'),
  backgroundImage: getComputedStyle(document.querySelector('.panel-footer-actions [data-action="start-game"]')).backgroundImage,
  backgroundColor: getComputedStyle(document.querySelector('.panel-footer-actions [data-action="start-game"]')).backgroundColor,
  legacyButtons: document.querySelectorAll('.btn.gold, .btn.ghost').length,
  primaryBackground: getComputedStyle(document.querySelector('.setup-rules-panel .btn.primary')).backgroundColor,
  secondaryBackground: getComputedStyle(document.querySelector('[data-action="shuffle-seats"]')).backgroundColor
})`);
const preferredSeatAvatar = await evaluate(`document.querySelector('[data-seat-name="1"]')?.previousElementSibling?.querySelector('img')?.getAttribute('src')`);
await click('.setup-fab-group [data-action="start-game"]');
await wait(250);
const preferredSeatName = await evaluate(`document.querySelector('.reveal-card h1')?.textContent`);
const roleReadyLayout = await evaluate(`(() => {
  const card = document.querySelector('.reveal-card');
  const moderatorPanel = document.querySelector('.reveal-host-panel .moderator-panel');
  const progress = card.querySelector('.reveal-progress').getBoundingClientRect();
  const player = card.querySelector('.reveal-player').getBoundingClientRect();
  const avatar = card.querySelector('.reveal-avatar');
  const avatarRect = avatar?.getBoundingClientRect();
  const actionButton = card.querySelector('.reveal-actions .btn');
  const actions = card.querySelector('.reveal-actions').getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  return {
    ready: card.classList.contains('role-ready'),
    moderatorVisible: Boolean(moderatorPanel && getComputedStyle(moderatorPanel).display !== 'none' && moderatorPanel.getBoundingClientRect().height > 0),
    moderatorCollapsed: moderatorPanel?.querySelector('[data-action="toggle-panel"]')?.getAttribute('aria-expanded') === 'false' && moderatorPanel?.querySelector('.collapsible-content')?.hidden,
    moderatorAfterRole: moderatorPanel?.getBoundingClientRect().top >= rect.bottom,
    moderatorOrder: moderatorPanel ? getComputedStyle(moderatorPanel.closest('.reveal-host-panel')).order : '',
    roleCardOrder: getComputedStyle(card).order,
    progressFirst: progress.top < player.top,
    progressLabelSize: parseFloat(getComputedStyle(card.querySelector('.reveal-progress .eyebrow')).fontSize),
    progressCountSize: parseFloat(getComputedStyle(card.querySelector('.reveal-progress b')).fontSize),
    actionsLast: actions.top > player.bottom,
    seat: card.querySelector('.reveal-seat strong')?.textContent,
    avatar: avatar?.getAttribute('src'),
    avatarVisible: Boolean(avatar && avatarRect.width >= 48 && avatarRect.height >= 48),
    avatarBetweenSeatAndName: card.querySelector('.reveal-player')?.children[1]?.classList.contains('reveal-avatar'),
    avatarFills: avatar ? getComputedStyle(avatar).objectFit === 'cover' : false,
    playerNameSize: parseFloat(getComputedStyle(card.querySelector('.reveal-player h1')).fontSize),
    instructionTitleSize: parseFloat(getComputedStyle(card.querySelector('.number-role-instruction h2')).fontSize),
    instructionSize: parseFloat(getComputedStyle(card.querySelector('.number-role-instruction p')).fontSize),
    numberCards: card.querySelectorAll('[data-action="select-role-card"]').length,
    numberInstruction: card.querySelector('.number-role-instruction p')?.textContent,
    actionDisabled: actionButton?.disabled,
    action: actionButton?.textContent.trim(),
    actionHeight: Math.round(actionButton?.getBoundingClientRect().height || 0),
    actionFontSize: Math.round(parseFloat(getComputedStyle(actionButton).fontSize)),
    actionFontWeight: Number(getComputedStyle(actionButton).fontWeight),
    height: Math.round(rect.height),
    insideViewport: rect.top >= 0 && rect.bottom <= innerHeight,
    scrollWidth: document.documentElement.scrollWidth
  };
})()`);
await captureScreenshot(process.env.SMOKE_ROLE_READY_SCREENSHOT);

const roleAssignments = [];
const roleDealCardCounts = [];
let roleOpenLayout;
for (let index = 0; index < 10; index += 1) {
  roleDealCardCounts.push(await evaluate(`document.querySelectorAll('[data-action="select-role-card"]').length || 1`));
  if (index < 9) await click('[data-action="select-role-card"][data-card="1"]');
  await click('[data-action="confirm-number-role"]');
  if (index === 0) {
    roleOpenLayout = await evaluate(`(() => {
      const card = document.querySelector('.reveal-card');
      const rect = card.getBoundingClientRect();
      const avatar = card.querySelector('.reveal-avatar');
      const actionButton = card.querySelector('.reveal-actions .btn');
      return {
        open: card.classList.contains('role-open'),
        progressVisible: Boolean(card.querySelector('.reveal-progress')),
        playerVisible: Boolean(card.querySelector('.reveal-player h1')),
        avatar: avatar?.getAttribute('src'),
        avatarVisible: Boolean(avatar && avatar.getBoundingClientRect().width >= 48),
        signal: Boolean(card.querySelector('.role-reveal .reveal-signal img')),
        team: card.querySelector('.role-reveal .role-team-badge')?.textContent,
        action: actionButton?.textContent.trim(),
        actionHeight: Math.round(actionButton?.getBoundingClientRect().height || 0),
        actionFontSize: Math.round(parseFloat(getComputedStyle(actionButton).fontSize)),
        height: Math.round(rect.height),
        insideViewport: rect.top >= 0 && rect.bottom <= innerHeight,
        scrollWidth: document.documentElement.scrollWidth
      };
    })()`);
    await captureScreenshot(process.env.SMOKE_ROLE_OPEN_SCREENSHOT);
  }
  const assignment = await evaluate(`(() => {
    const reveal = document.querySelector('.role-reveal');
    const teamBadge = reveal?.querySelector('.role-team-badge');
    const style = reveal ? getComputedStyle(reveal) : null;
    return {
      source: document.querySelector('.reveal-signal img')?.getAttribute('src'),
      avatar: document.querySelector('.reveal-avatar')?.getAttribute('src'),
      redTeam: reveal?.classList.contains('red-team'),
      blackTeam: reveal?.classList.contains('black'),
      team: teamBadge?.textContent,
      teamBadgeHeight: Math.round(teamBadge?.getBoundingClientRect().height || 0),
      backgroundColor: style?.backgroundColor,
      textColor: style?.color
    };
  })()`);
  roleAssignments.push({ seat: index + 1, ...assignment });
  await click('[data-action="reveal-next"]');
}

const redTeamRoleCards = roleAssignments.filter(item => /\/(?:citizen|sheriff)\.webp$/.test(item.source));
const blackTeamRoleCards = roleAssignments.filter(item => /\/(?:mafia|don)\.webp$/.test(item.source));

const zeroNightSignals = await evaluate(`({
  count: document.querySelectorAll('.signal-stack .phase-signal img').length,
  sources: [...document.querySelectorAll('.signal-stack img')].map(image => image.getAttribute('src')),
  steps: document.querySelectorAll('.phase-stepper li').length,
  current: document.querySelector('.phase-stepper [aria-current="step"] b')?.textContent,
  cue: document.querySelector('.moderator-cue b')?.textContent,
  cueFontSize: Math.round(parseFloat(getComputedStyle(document.querySelector('.moderator-cue b')).fontSize)),
  actionHeight: Math.round(document.querySelector('[data-action="zero-night-sheriff"]')?.getBoundingClientRect().height || 0),
  actionFontSize: Math.round(parseFloat(getComputedStyle(document.querySelector('[data-action="zero-night-sheriff"]')).fontSize)),
  insideViewport: document.querySelector('.phase-panel')?.getBoundingClientRect().bottom <= document.querySelector('.game-nav')?.getBoundingClientRect().top
})`);
await click('[data-action="zero-night-sheriff"]');
const zeroNightSheriff = await evaluate(`({
  signal: document.querySelector('.phase-signal img')?.getAttribute('src'),
  current: document.querySelector('.phase-stepper [aria-current="step"] b')?.textContent,
  cue: document.querySelector('.moderator-cue b')?.textContent,
  timer: document.querySelector('.timer')?.textContent,
  action: document.querySelector('[data-action="zero-night-free-seating"]')?.textContent.trim(),
  actionHeight: Math.round(document.querySelector('[data-action="zero-night-free-seating"]')?.getBoundingClientRect().height || 0)
})`);
await click('[data-action="zero-night-free-seating"]');
const zeroNightFreeSeating = await evaluate(`({
  current: document.querySelector('.phase-stepper [aria-current="step"] b')?.textContent,
  cue: document.querySelector('.moderator-cue b')?.textContent,
  timer: document.querySelector('.timer')?.textContent,
  action: document.querySelector('[data-action="zero-to-day"]')?.textContent.trim()
})`);
await click('[data-action="zero-to-day"]');
const firstDay = await evaluate(`({
  hash: location.hash,
  seats: document.querySelectorAll('.game-seat').length,
  seatColumns: getComputedStyle(document.querySelector('.seat-grid')).gridTemplateColumns.split(' ').length,
  seatRows: new Set([...document.querySelectorAll('.game-seat')].map(seat => Math.round(seat.getBoundingClientRect().top))).size,
  maxSeatHeight: Math.round(Math.max(...[...document.querySelectorAll('.game-seat')].map(seat => seat.getBoundingClientRect().height))),
  aliveSeats: document.querySelectorAll('.game-seat.alive').length,
  deadSeats: document.querySelectorAll('.game-seat.dead').length,
  allSeatsVisible: [...document.querySelectorAll('.game-seat')].every(seat => {
    const rect = seat.getBoundingClientRect();
    const navTop = document.querySelector('.game-nav')?.getBoundingClientRect().top || innerHeight;
    return rect.top >= 0 && rect.bottom <= navTop;
  }),
  numberSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .num')].map(number => parseFloat(getComputedStyle(number).fontSize)))),
  numberWeight: Math.min(...[...document.querySelectorAll('.game-seat .num')].map(number => Number(getComputedStyle(number).fontWeight))),
  seatAvatarCount: document.querySelectorAll('.game-seat img.avatar').length,
  minSeatAvatarSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .avatar')].map(avatar => avatar.getBoundingClientRect().width))),
  faultDots: document.querySelectorAll('.game-seat .fault-dot').length,
  minFaultDotSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .fault-dot')].map(dot => dot.getBoundingClientRect().width))),
  faultsRightOfPlayers: [...document.querySelectorAll('.game-seat')].every(seat => seat.querySelector('.fault-mini').getBoundingClientRect().left >= seat.querySelector('.seat-name').getBoundingClientRect().right),
  minSeatNameSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .seat-name')].map(name => parseFloat(getComputedStyle(name).fontSize)))),
  currentSpeakerHighlight: (() => {
    const currentSeat = document.querySelector('.game-seat.current');
    const regularSeat = document.querySelector('.game-seat:not(.current)');
    const number = currentSeat?.querySelector('.num');
    return Boolean(currentSeat && regularSeat && number
      && getComputedStyle(currentSeat).backgroundImage !== getComputedStyle(regularSeat).backgroundImage
      && getComputedStyle(currentSeat).boxShadow !== getComputedStyle(regularSeat).boxShadow
      && getComputedStyle(number).backgroundColor !== 'rgba(0, 0, 0, 0)');
  })(),
  aliveGreenAccent: [...document.querySelectorAll('.game-seat.alive')].every(seat => getComputedStyle(seat).boxShadow !== 'none' && getComputedStyle(seat).backgroundImage !== 'none'),
  phase: document.querySelector('.phase-copy h1')?.textContent,
  timer: document.querySelector('.timer')?.textContent,
  timerActionHeight: Math.round(document.querySelector('[data-action="timer-toggle"]')?.getBoundingClientRect().height || 0),
  timerActionFontSize: Math.round(parseFloat(getComputedStyle(document.querySelector('[data-action="timer-toggle"]')).fontSize)),
  timerActionFontWeight: Number(getComputedStyle(document.querySelector('[data-action="timer-toggle"]')).fontWeight),
  timerAdjustments: document.querySelectorAll('.timer-adjust-row > .btn').length,
  timerAdjustmentsBesideTime: (() => {
    const row = document.querySelector('.timer-adjust-row');
    const timer = row?.querySelector('.timer')?.getBoundingClientRect();
    const minus = row?.querySelector('[data-action="timer-minus"]')?.getBoundingClientRect();
    const plus = row?.querySelector('[data-action="timer-plus"]')?.getBoundingClientRect();
    return Boolean(timer && minus && plus && Math.abs(minus.top - plus.top) <= 1 && minus.right <= timer.left && plus.left >= timer.right);
  })(),
  primaryActions: [...document.querySelectorAll('.primary-game-actions .btn')].map(button => button.textContent.trim()),
  primaryActionsSameRow: (() => {
    const buttons = [...document.querySelectorAll('.primary-game-actions .btn')];
    return new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top))).size === 1;
  })(),
  primaryActionsVisible: [...document.querySelectorAll('.primary-game-actions .btn')].every(button => {
    const rect = button.getBoundingClientRect();
    const navTop = document.querySelector('.game-nav')?.getBoundingClientRect().top || innerHeight;
    return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= navTop;
  }),
  speaker: document.querySelector('.speaker-row h2')?.textContent,
  bottomNav: Boolean(document.querySelector('.bottom-nav.game-nav')),
  navItems: document.querySelectorAll('.game-nav .nav-item').length,
  activeLabel: document.querySelector('.game-nav .nav-item.active span')?.textContent,
  navHeight: Math.round(document.querySelector('.game-nav')?.getBoundingClientRect().height || 0),
  iconOnly: [...document.querySelectorAll('.game-nav .nav-item')].every(item => item.querySelector('svg') && item.querySelector('span') && item.querySelector('span').getBoundingClientRect().width <= 1),
  moderatorPanelVisible: (() => { const panel = document.querySelector('.moderator-panel'); return Boolean(panel && getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().height > 0); })(),
  moderatorPanelCollapsed: document.querySelector('.moderator-panel [data-action="toggle-panel"]')?.getAttribute('aria-expanded') === 'false' && document.querySelector('.moderator-panel .collapsible-content')?.hidden,
  moderatorUnusedActionsAbsent: !document.querySelector('.moderator-panel [data-action="copy-protocol"], .moderator-panel [data-action="open-observer"]'),
  finishGameInsideCollapsedPanel: Boolean(document.querySelector('.moderator-panel [data-action="end-game-manual"]')) && document.querySelector('.moderator-panel .collapsible-content')?.hidden && !document.querySelector('.game-side > [data-action="end-game-manual"], .game-end-actions'),
  mobileProtocolHidden: getComputedStyle(document.querySelector('.moderator-protocol-panel')).display === 'none',
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth
})`);
await captureScreenshot(process.env.SMOKE_GAME_SCREENSHOT);

await click('.moderator-panel [data-action="toggle-panel"]');
const moderatorPanelExpanded = await evaluate(`({
  expanded: document.querySelector('.moderator-panel [data-action="toggle-panel"]')?.getAttribute('aria-expanded') === 'true',
  contentVisible: !document.querySelector('.moderator-panel .collapsible-content')?.hidden,
  controls: [...document.querySelectorAll('.moderator-panel .moderator-actions .btn')].map(button => button.textContent.trim()),
  finishGameVisible: Boolean(document.querySelector('.moderator-panel .moderator-finish-game')) && document.querySelector('.moderator-panel .moderator-finish-game')?.getBoundingClientRect().height >= 44
})`);
await click('[data-action="open-host-transfer"]');
const hostTransferInitial = await evaluate(`({
  search: Boolean(document.querySelector('[data-input="host-transfer-search"]')),
  candidates: document.querySelectorAll('.host-transfer-candidate').length,
  names: [...document.querySelectorAll('.host-transfer-candidate b')].map(item => item.textContent.trim()),
  seatNumbersAbsent: !document.querySelector('.host-transfer-seat'),
  anyUserCopy: document.querySelector('.host-transfer-modal .game-dialog-copy')?.textContent.includes('Участь у поточній грі не обов’язкова')
})`);
await evaluate(`(() => {
  const input = document.querySelector('[data-input="host-transfer-search"]');
  input.value = 'Гравець 2';
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await wait(100);
const hostTransferFiltered = await evaluate(`({
  value: document.querySelector('[data-input="host-transfer-search"]')?.value,
  focused: document.activeElement === document.querySelector('[data-input="host-transfer-search"]'),
  names: [...document.querySelectorAll('.host-transfer-candidate b')].map(item => item.textContent.trim())
})`);
await click('.host-transfer-modal [data-action="close-modal"]');
await click('[data-action="game-settings"]');
const gameSettingsModalFrame = await inspectModalFrame();
const gameSettingsAppearance = await evaluate(`({
  gameModal: document.querySelector('[data-form="game-settings"]')?.classList.contains('game-modal'),
  context: document.querySelector('[data-form="game-settings"] .game-dialog-head .eyebrow')?.textContent,
  closeLabel: document.querySelector('[data-form="game-settings"] .icon-btn')?.getAttribute('aria-label'),
  accent: getComputedStyle(document.querySelector('[data-form="game-settings"]')).borderTopColor
})`);
await captureScreenshot(process.env.SMOKE_GAME_SETTINGS_SCREENSHOT);
await click('[data-form="game-settings"] [data-action="close-modal"]');

const readTimerSeconds = () => evaluate(`(() => {
  const [minutes, seconds] = document.querySelector('.timer').textContent.trim().split(':').map(Number);
  return minutes * 60 + seconds;
})()`);
await click('[data-action="timer-toggle"]');
await evaluate(`(() => {
  window.__gameRootMutationCount = 0;
  window.__gameRootObserver?.disconnect();
  window.__gameRootObserver = new MutationObserver(records => {
    window.__gameRootMutationCount += records.filter(record => record.type === 'childList').length;
  });
  window.__gameRootObserver.observe(document.querySelector('#app'), { childList: true });
})()`);
await wait(1250);
const runningTimerStability = await evaluate(`(() => {
  window.__gameRootObserver?.disconnect();
  return { rootReplacements: window.__gameRootMutationCount, timer: document.querySelector('.timer')?.textContent };
})()`);
const beforeMinusFive = await readTimerSeconds();
await click('[data-action="timer-minus"]');
const afterMinusFive = await readTimerSeconds();
await wait(650);
const afterMinusTick = await readTimerSeconds();
await click('[data-action="timer-plus"]');
const afterPlusFive = await readTimerSeconds();
await click('[data-action="timer-toggle"]');
const runningTimerAdjustment = { beforeMinusFive, afterMinusFive, afterMinusTick, afterPlusFive };

await click('[data-action="timer-toggle"]');
await wait(250);
await click('.game-nav [href="#players"]');
const timerNavigationAway = await evaluate(`location.hash`);
const activeProfileLocks = await evaluate(`({
  locked: document.querySelectorAll('.player-card .player-edit[disabled][title="Профіль зараз у грі"]').length,
  editable: document.querySelectorAll('.player-card .player-edit[data-action]').length,
  lockedButtonsDisabled: [...document.querySelectorAll('.player-card .player-edit[title="Профіль зараз у грі"]')].every(button => button.disabled)
})`);
await evaluate(`location.hash = '#home'`);
await wait(180);
const activeGameHome = await evaluate(`({
  rows: document.querySelectorAll('.active-games-panel .active-game-row').length,
  resume: document.querySelectorAll('.active-games-panel [data-action="resume-game"]').length,
  inlineCancel: document.querySelectorAll('.active-games-panel [data-action="cancel-active-game"]').length,
  headerCancel: document.querySelectorAll('.shell-header .cancel-game-btn').length,
  cancelIconOnly: Boolean(document.querySelector('.cancel-game-btn svg')) && !document.querySelector('.cancel-game-btn')?.textContent.trim(),
  cancelLabel: document.querySelector('.cancel-game-btn')?.getAttribute('aria-label'),
  cancelRed: (() => { const color = getComputedStyle(document.querySelector('.cancel-game-btn')).backgroundColor.match(/[\\d.]+/g)?.map(Number) || []; return color.length >= 3 && color[0] > color[1] * 1.5 && color[0] > color[2] * 1.5; })(),
  cancelBesideBluetooth: (() => { const cancel = document.querySelector('.cancel-game-btn')?.getBoundingClientRect(); const bluetooth = document.querySelector('.browser-bluetooth-btn')?.getBoundingClientRect(); return Boolean(cancel && bluetooth && cancel.right <= bluetooth.left && bluetooth.left - cancel.right <= 6); })(),
  watch: document.querySelectorAll('.active-games-panel [data-action="watch-game"]').length,
  title: document.querySelector('.active-games-panel h2')?.textContent,
  phase: document.querySelector('.active-game-row .continue-meta')?.textContent
})`);
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
await wait(100);
const activeGameCompactHeader = await evaluate(`(() => {
  const header = document.querySelector('.shell-header').getBoundingClientRect();
  const share = document.querySelector('.share-btn').getBoundingClientRect();
  const order = document.querySelector('.order-btn').getBoundingClientRect();
  const media = document.querySelector('.header-media-controls');
  const cancel = document.querySelector('.cancel-game-btn').getBoundingClientRect();
  const bluetooth = document.querySelector('.browser-bluetooth-btn').getBoundingClientRect();
  return {
    scrollWidth: document.documentElement.scrollWidth,
    headerInsideViewport: header.left >= 0 && header.right <= innerWidth,
    shareBeforeOrder: share.right <= order.left,
    orderBeforeCancel: order.right <= cancel.left,
    mediaHidden: getComputedStyle(media).display === 'none',
    cancelBeforeBluetooth: cancel.right <= bluetooth.left,
    cancelSize: Math.round(cancel.width)
  };
})()`);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(100);
await evaluate(`location.hash = '#stats'`);
await wait(180);
const activeGameStats = await evaluate(`({
  rows: document.querySelectorAll('.active-games-panel .active-game-row').length,
  resume: document.querySelectorAll('.active-games-panel [data-action="resume-game"]').length,
  inlineCancel: document.querySelectorAll('.active-games-panel [data-action="cancel-active-game"]').length,
  headerCancel: document.querySelectorAll('.shell-header .cancel-game-btn').length,
  status: document.querySelector('.directory-status')?.textContent
})`);
await evaluate(`location.hash = '#game'`);
await wait(180);
const timerNavigation = await evaluate(`({
  away: ${JSON.stringify(timerNavigationAway)},
  returned: location.hash,
  stopped: document.querySelector('[data-action="timer-toggle"]')?.textContent.trim() === 'Старт',
  navRestored: Boolean(document.querySelector('.game-nav'))
})`);

await click('.game-seat[data-seat="2"]');
const seatModalFrame = await inspectModalFrame();
const seatModalAppearance = await evaluate(`(() => {
  const number = document.querySelector('.seat-sheet-number strong');
  const header = document.querySelector('.seat-sheet-head');
  return {
    number: number?.textContent.trim(),
    numberSize: Math.round(parseFloat(getComputedStyle(number).fontSize)),
    numberWeight: Number(getComputedStyle(number).fontWeight),
    player: document.querySelector('.seat-sheet-copy h2')?.textContent,
    alive: header?.classList.contains('alive'),
    status: document.querySelector('.seat-sheet-copy .badge')?.textContent,
    gameModal: document.querySelector('.seat-control-modal')?.classList.contains('game-modal'),
    closeLabel: document.querySelector('.seat-control-modal .modal-close')?.getAttribute('aria-label')
  };
})()`);
await captureScreenshot(process.env.SMOKE_SEAT_SCREENSHOT);
await click('[data-action="nominate"]');
const nomination = await evaluate(`(() => {
  const candidate = document.querySelector('.game-seat.nominated');
  const stripe = candidate ? getComputedStyle(candidate, '::after') : null;
  return {
    candidates: [...document.querySelectorAll('.nom-chip')].map(element => element.textContent),
    modalOpen: Boolean(document.querySelector('.modal')),
    latestLog: document.querySelector('.quick-log')?.innerText.split('\\n').slice(0, 2),
    candidateStripe: Boolean(stripe && stripe.content !== 'none' && parseFloat(stripe.width) >= 8 && stripe.right === '0px' && stripe.backgroundColor !== 'rgba(0, 0, 0, 0)')
  };
})()`);
const offlineShell = await evaluate(`navigator.serviceWorker.ready.then(async () => {
  const cacheName = (await caches.keys()).find(name => name.startsWith('mafia-desk-v'));
  const cache = await caches.open(cacheName);
  const keys = (await cache.keys()).map(request => request.url);
  return {
    authModule: keys.some(url => url.endsWith('/src/auth.js')),
    cloudProfilesModule: keys.some(url => url.endsWith('/src/cloud-profiles.js')),
    cloudGamesModule: keys.some(url => new URL(url).pathname.endsWith('/src/cloud-games.js')),
    cloudVenuesModule: keys.some(url => url.endsWith('/src/cloud-venues.js')),
    venueDirectoryModule: keys.some(url => url.endsWith('/src/venue-directory.js')),
    gameMusicModule: keys.some(url => url.endsWith('/src/game-music.js')),
    gameFeedbackModule: keys.some(url => url.endsWith('/src/game-feedback.js')),
    gameEngineModule: keys.some(url => url.endsWith('/src/game-engine.js')),
    orderServiceModule: keys.some(url => url.endsWith('/src/order-service.js')),
    playerLinksModule: keys.some(url => url.endsWith('/src/player-links.js')),
    timerModule: keys.some(url => url.endsWith('/src/timer.js')),
    lineupModule: keys.some(url => url.endsWith('/src/lineup.js')),
    guestNamesModule: keys.some(url => url.endsWith('/src/guest-names.js')),
    playerDirectoryModule: keys.some(url => url.endsWith('/src/player-directory.js')),
    i18nModule: keys.some(url => url.endsWith('/src/i18n.js')),
    enjoyModule: keys.some(url => url.endsWith('/src/enjoy.js')),
    firebaseApp: keys.some(url => url.includes('/firebasejs/12.16.0/firebase-app.js')),
    firebaseAuth: keys.some(url => url.includes('/firebasejs/12.16.0/firebase-auth.js')),
    firebaseFirestore: keys.some(url => url.includes('/firebasejs/12.16.0/firebase-firestore.js')),
    roleSignals: keys.filter(url => url.includes('/assets/signals/')).length,
    themeBackgrounds: keys.filter(url => url.includes('/assets/theme-')).length,
    musicTracks: keys.filter(url => url.includes('/assets/audio/') && url.endsWith('.mp3')).length
  };
})`);
await send('Network.enable');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await send('Page.reload');
await wait(900);
const offlineReload = await evaluate(`({ hash: location.hash, phase: document.querySelector('.phase-copy h1')?.textContent, signedIn: Boolean(document.querySelector('.profile-btn')) })`);
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

await click('[data-action="remove-nomination"]');
await click('.game-seat[data-seat="1"]');
const selfNominationControl = await evaluate(`(() => {
  const button = document.querySelector('[data-action="nominate"][data-seat="1"]');
  return { visible: Boolean(button), enabled: Boolean(button && !button.disabled) };
})()`);
await click('[data-action="nominate"][data-seat="1"]');
const selfNomination = {
  ...selfNominationControl,
  ...(await evaluate(`({
    candidate: document.querySelector('.game-seat.nominated')?.dataset.seat,
    candidates: [...document.querySelectorAll('.nom-chip')].map(element => element.textContent),
    log: document.querySelector('.quick-log')?.innerText
  })`))
};
await click('[data-action="remove-nomination"]');
await click('.game-seat[data-seat="10"]');
await click('[data-action="manual-eliminate"]');
const deadSeatAppearance = await evaluate(`(() => {
  const seat = document.querySelector('.game-seat[data-seat="10"]');
  const style = getComputedStyle(seat);
  return { dead: seat.classList.contains('dead'), alive: seat.classList.contains('alive'), opacity: Number(style.opacity), grayscale: style.filter !== 'none', tag: seat.querySelector('.seat-tag')?.textContent };
})()`);
await click('.game-seat[data-seat="10"]');
const deadSeatModalAppearance = await evaluate(`({
  number: document.querySelector('.seat-sheet-number strong')?.textContent.trim(),
  dead: document.querySelector('.seat-sheet-head')?.classList.contains('dead'),
  status: document.querySelector('.seat-sheet-copy .badge')?.textContent
})`);
await click('.seat-control-modal [data-action="close-modal"]');
await click('[data-action="undo"]');
const restoredSeatAppearance = await evaluate(`({ alive: document.querySelector('.game-seat[data-seat="10"]')?.classList.contains('alive'), dead: document.querySelector('.game-seat[data-seat="10"]')?.classList.contains('dead') })`);
const seatVisualStates = { seatModalAppearance, deadSeatAppearance, deadSeatModalAppearance, restoredSeatAppearance };
for (let index = 0; index < 10; index += 1) await click('[data-action="next-speaker"]');
await click('[data-action="start-vote"]');
await click('[data-action="night-next"]');
await click('[data-action="night-target"][data-seat="1"]');
await click('[data-action="night-shot-done"]');

const sheriffSeat = roleAssignments.find(item => item.source.endsWith('/sheriff.webp')).seat;
const donSeat = roleAssignments.find(item => item.source.endsWith('/don.webp')).seat;
const citizenSeat = roleAssignments.find(item => item.source.endsWith('/citizen.webp')).seat;

await click(`[data-action="night-target"][data-seat="${citizenSeat}"]`);
await click('[data-action="night-show-result"]');
const donMissSignal = await evaluate(`({ source: document.querySelector('.night-result-signal img')?.getAttribute('src'), label: document.querySelector('.night-result-panel h2')?.textContent, instruction: document.querySelector('.night-result-panel p')?.textContent })`);
await click('[data-action="night-hide-result"]');
await click(`[data-action="night-target"][data-seat="${sheriffSeat}"]`);
await click('[data-action="night-show-result"]');
const donHitSignal = await evaluate(`({ source: document.querySelector('.night-result-signal img')?.getAttribute('src'), label: document.querySelector('.night-result-panel h2')?.textContent, instruction: document.querySelector('.night-result-panel p')?.textContent })`);
await click('[data-action="night-check-done"]');

await click(`[data-action="night-target"][data-seat="${donSeat}"]`);
await click('[data-action="night-show-result"]');
const sheriffBlackSignal = await evaluate(`({ source: document.querySelector('.night-result-signal img')?.getAttribute('src'), label: document.querySelector('.night-result-panel h2')?.textContent, instruction: document.querySelector('.night-result-panel p')?.textContent })`);
await click('[data-action="night-hide-result"]');
await click(`[data-action="night-target"][data-seat="${citizenSeat}"]`);
await click('[data-action="night-show-result"]');
const sheriffRedSignal = await evaluate(`({ source: document.querySelector('.night-result-signal img')?.getAttribute('src'), label: document.querySelector('.night-result-panel h2')?.textContent, instruction: document.querySelector('.night-result-panel p')?.textContent })`);
await click('[data-action="night-check-done"]');
const nightResultAnnouncement = await evaluate(`({
  title: document.querySelector('.phase-panel h2')?.textContent,
  cue: document.querySelector('.moderator-cue b')?.textContent,
  action: document.querySelector('[data-action="wake-city"]')?.textContent.trim()
})`);
await click('[data-action="wake-city"]');
const bestMoveLayout = await evaluate(`(() => {
  const panel = document.querySelector('.best-move-panel');
  const nav = document.querySelector('.game-nav');
  return {
    phase: document.querySelector('.phase-copy h1')?.textContent,
    timer: panel?.querySelector('.timer')?.textContent,
    candidates: panel?.querySelectorAll('[data-action="best-move-target"]').length,
    unavailable: panel?.querySelectorAll('[data-action="best-move-target"]:disabled').length,
    selected: panel?.querySelectorAll('[data-action="best-move-target"].selected').length,
    cue: panel?.querySelector('.moderator-cue b')?.textContent,
    insideViewport: Boolean(panel && nav && panel.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top),
    scrollWidth: document.documentElement.scrollWidth
  };
})()`);
const bestMoveTargets = await evaluate(`[...document.querySelectorAll('[data-action="best-move-target"]:not(:disabled)')].slice(0, 3).map(button => button.dataset.seat)`);
for (const target of bestMoveTargets) await click(`[data-action="best-move-target"][data-seat="${target}"]`);
await click('[data-action="finish-best-move"]');
const bestMoveFarewell = await evaluate(`({ phase: document.querySelector('.phase-copy h1')?.textContent, timer: document.querySelector('.timer')?.textContent, player: document.querySelector('.speaker-row h2')?.textContent, cue: document.querySelector('.moderator-cue b')?.textContent })`);
await click('[data-action="finish-last-word"]');
const afterBestMove = await evaluate(`({ phase: document.querySelector('.phase-copy h1')?.textContent, logged: [...document.querySelectorAll('.log-item')].some(item => item.textContent.includes('Кращий хід')) })`);

await click('[data-action="end-game-manual"]');
const confirmModalFrame = await inspectModalFrame();
const confirmModalAppearance = await evaluate(`({
  gameModal: document.querySelector('.danger-modal')?.classList.contains('game-modal'),
  context: document.querySelector('.danger-modal .eyebrow')?.textContent,
  closeLabel: document.querySelector('.danger-modal .icon-btn')?.getAttribute('aria-label'),
  dangerousAccent: getComputedStyle(document.querySelector('.danger-modal')).borderTopColor
})`);
await captureScreenshot(process.env.SMOKE_CONFIRM_SCREENSHOT);
await click('[data-action="confirm-action"]');
const winnerModalFrame = await inspectModalFrame();
const winnerModalAppearance = await evaluate(`({
  gameModal: document.querySelector('.decision-modal')?.classList.contains('game-modal'),
  context: document.querySelector('.decision-modal .eyebrow')?.textContent,
  choices: document.querySelectorAll('.winner-choice').length,
  labels: [...document.querySelectorAll('.winner-choice strong')].map(item => item.textContent),
  descriptions: [...document.querySelectorAll('.winner-choice small')].map(item => item.textContent),
  closeLabel: document.querySelector('.decision-modal .icon-btn')?.getAttribute('aria-label')
})`);
await captureScreenshot(process.env.SMOKE_WINNER_SCREENSHOT);
await click('[data-action="finish-red"]');
await evaluate(`location.hash = '#stats'`);
await wait(150);
const finishedSharedStats = await evaluate(`({
  games: document.querySelector('.stat-card b')?.textContent,
  archivedGames: document.querySelectorAll('[data-action="view-protocol"]').length,
  feedbackCards: document.querySelectorAll('[data-archive-feedback]').length,
  anonymousFeedback: document.querySelector('[data-archive-feedback]')?.textContent,
  feedbackContainsIdentity: /test\.host@example\.com|Smoke Нік/.test(document.querySelector('[data-archive-feedback]')?.textContent || ''),
  manageableGames: document.querySelectorAll('[data-action="delete-game"]').length,
  protocolActionsFill: (() => {
    const row = document.querySelector('.archive-game-actions');
    const buttons = [...row.querySelectorAll(':scope > .btn')];
    const rowRect = row.getBoundingClientRect();
    const firstRect = buttons[0].getBoundingClientRect();
    const lastRect = buttons.at(-1).getBoundingClientRect();
    return Math.abs((lastRect.right - firstRect.left) - rowRect.width) <= 2;
  })(),
  leaderboardRows: document.querySelectorAll('.grid.two .list-row').length,
  status: document.querySelector('.directory-status b')?.textContent,
  hostUsesNickname: [...document.querySelectorAll('.list-main span')].some(item => item.textContent.includes('ведучий Smoke Нік')),
  hostDisplayNameHidden: ![...document.querySelectorAll('.list-main span')].some(item => item.textContent.includes('ведучий Ведучий Smoke'))
})`);
await click('[data-action="view-protocol"]');
const protocolModalFrame = await inspectModalFrame();
const protocolModal = await evaluate(`(() => {
  const dialog = document.querySelector('.protocol-modal');
  const backdrop = document.querySelector('.protocol-backdrop');
  const rect = dialog.getBoundingClientRect();
  const style = getComputedStyle(dialog);
  return {
    focused: document.activeElement === dialog,
    scrollTop: dialog.scrollTop,
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    rightGap: Math.round(innerWidth - rect.right),
    bottomWithinViewport: rect.bottom <= innerHeight - 6,
    borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
    backdropAlign: getComputedStyle(backdrop).alignItems,
    logScrollable: ['auto', 'scroll'].includes(getComputedStyle(document.querySelector('.protocol-log')).overflowY)
  };
})()`);
await captureScreenshot(process.env.SMOKE_PROTOCOL_SCREENSHOT);
await click('.protocol-modal [data-action="close-modal"]');
await evaluate(`location.hash = '#players'`);
await wait(150);
const queueAfterGame = await evaluate(`({
  selected: document.querySelectorAll('.queue-player-btn.selected').length,
  status: document.querySelector('.lineup-head b')?.textContent,
  positions: [...document.querySelectorAll('.queue-player-btn.selected small')].map(item => Number(item.textContent)).sort((a, b) => a - b)
})`);

await evaluate(`(async () => {
  const { getAll, putOne } = await import('./src/db.js');
  const games = await getAll('games');
  const game = games.find(item => item.status === 'finished');
  if (!game) throw new Error('Finished game fixture not found');
  game.seats[0].profileId = 'google_local-smoke-test';
  game.updatedAt = new Date().toISOString();
  await putOne('games', game);
  location.hash = '#settings';
  location.reload();
})()`);
await wait(750);
const playerStatsShortcut = await evaluate(`({
  settingsIcon: Boolean(document.querySelector('.profile-actions [data-action="open-player-stats"] .player-stats-icon')),
  playerIcons: document.querySelectorAll('[data-action="open-player-stats"] .player-stats-icon').length
})`);
await click('.profile-actions [data-action="open-player-stats"]');
await wait(180);
const personalStatsModalFrame = await inspectModalFrame();
const personalStats = await evaluate(`({
  title: document.querySelector('.player-stats-modal h2')?.textContent,
  games: document.querySelector('.personal-stat-grid .stat-card b')?.textContent,
  history: document.querySelectorAll('.personal-game-card').length,
  sentimentChoices: document.querySelectorAll('.sentiment-picker .feedback-choice').length,
  emotions: [...document.querySelectorAll('.emotion-choice')].map(button => button.getAttribute('aria-label')),
  privacy: document.querySelector('.feedback-privacy-note')?.textContent,
  threshold: document.querySelector('.feedback-threshold')?.textContent,
  scrollWidth: document.documentElement.scrollWidth
})`);
await captureScreenshot(process.env.SMOKE_PLAYER_STATS_SCREENSHOT);
await click('[data-action="rate-game-sentiment"][data-value="up"]');
await click('[data-action="rate-game-emotion"][data-value="circus"]');
const personalFeedback = await evaluate(`({
  sentiment: document.querySelector('[data-action="rate-game-sentiment"][data-value="up"]')?.getAttribute('aria-pressed'),
  emotion: document.querySelector('[data-action="rate-game-emotion"][data-value="circus"]')?.getAttribute('aria-pressed'),
  saved: document.querySelector('.feedback-status')?.textContent,
  selected: document.querySelectorAll('.game-feedback .selected').length
})`);
await click('.player-stats-modal [data-action="close-modal"]');

await evaluate(`location.hash = '#setup'`);
await wait(180);
await click('[data-action="start-game"]');
const cancellationFromReveal = await evaluate(`({
  hash: location.hash,
  headerCancelVisible: Boolean(document.querySelector('.shell-header .cancel-game-btn[data-action="cancel-active-game"]')),
  inlineCancelAbsent: !document.querySelector('.reveal-actions [data-action="cancel-active-game"], .game-end-actions [data-action="cancel-active-game"], .active-game-row [data-action="cancel-active-game"]'),
  roleHidden: !document.querySelector('.role-reveal')
})`);
await click('.shell-header .cancel-game-btn[data-action="cancel-active-game"]');
const cancellationModal = await evaluate(`({
  title: document.querySelector('.danger-modal h2')?.textContent,
  explainsNoStats: document.querySelector('.danger-modal .game-dialog-copy')?.textContent.includes('не потрапить до статистики'),
  confirm: document.querySelector('.danger-modal [data-action="confirm-action"]')?.textContent.trim()
})`);
await click('.danger-modal [data-action="confirm-action"]');
await wait(180);
const cancelledGame = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('mafia-desk-local-smoke-test');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('settings', 'readonly');
      const lookup = transaction.objectStore('settings').get('nextGameQueue');
      lookup.onsuccess = () => resolve({
        hash: location.hash,
        activeGames: document.querySelectorAll('.active-games-panel .active-game-row').length,
        finishedGames: document.querySelectorAll('.list .list-row').length,
        headerCancelAbsent: !document.querySelector('.shell-header .cancel-game-btn'),
        toast: document.querySelector('#toast')?.textContent,
        queuedPlayers: Array.isArray(lookup.result?.value) ? lookup.result.value.length : 0
      });
      lookup.onerror = () => reject(lookup.error);
    };
  })`);

await evaluate(`(async () => {
  const timestamp = new Date().toISOString();
  const publicGame = {
    id: 'foreign-live-smoke', title: 'Гра іншого ведучого', venue: 'Enjoy', startedAt: timestamp,
    updatedAt: timestamp, endedAt: null, status: 'active', phase: 'day', subphase: 'speeches',
    winner: null, durationSeconds: 0, day: 1, publicOnly: true, shared: true, source: 'cloud-live',
    cloudOwnerUid: 'another-host', cloudHostName: 'Пані Оглядачка',
    seats: Array.from({ length: 10 }, (_, index) => ({ number: index + 1, name: 'Гість ' + (index + 1), status: 'alive', faults: 0, eliminatedReason: '', noVote: false })),
    nominations: [], speakerIndex: 0, speakerOrder: [1,2,3,4,5,6,7,8,9,10], lastWordSeat: null,
    vote: { counts: {}, tied: [], yes: 0, no: 0 }, night: { step: 0, target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    timer: { remaining: 60, running: false, purpose: 'speech', endsAt: 0 }, history: []
  };
  const { importDatabase } = await import('./src/db.js');
  await importDatabase({ schema: 1, players: [], games: [publicGame], settings: [] }, { replace: false });
  location.hash = '#home';
})()`);
await evaluate(`location.reload()`);
await wait(700);
const foreignLiveHome = await evaluate(`({
  row: [...document.querySelectorAll('.active-game-row')].some(row => row.textContent.includes('Гра іншого ведучого')),
  resume: Boolean(document.querySelector('.active-game-row [data-action="resume-game"][data-id="foreign-live-smoke"]')),
  watch: Boolean(document.querySelector('.active-game-row [data-action="watch-game"][data-id="foreign-live-smoke"]')),
  cancel: Boolean(document.querySelector('.active-game-row [data-action="cancel-active-game"][data-id="foreign-live-smoke"]')),
  headerCancel: Boolean(document.querySelector('.shell-header .cancel-game-btn')),
  eye: Boolean(document.querySelector('.active-game-row [data-id="foreign-live-smoke"] .button-eye-icon')),
  label: document.querySelector('.active-game-row [data-id="foreign-live-smoke"]')?.textContent.trim()
})`);
await click('[data-action="watch-game"][data-id="foreign-live-smoke"]');
const foreignObserver = await evaluate(`({
  hash: location.hash,
  seats: document.querySelectorAll('.game-seat').length,
  seatAvatarCount: document.querySelectorAll('.game-seat img.avatar').length,
  minSeatAvatarSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .avatar')].map(avatar => avatar.getBoundingClientRect().width))),
  faultDots: document.querySelectorAll('.game-seat .fault-dot').length,
  minFaultDotSize: Math.round(Math.min(...[...document.querySelectorAll('.game-seat .fault-dot')].map(dot => dot.getBoundingClientRect().width))),
  seatControls: document.querySelectorAll('.game-seat[data-action="seat-menu"]').length,
  moderatorPanel: Boolean(document.querySelector('[data-action="toggle-secret"]')),
  publicPanel: document.querySelector('.game-side')?.textContent.includes('Публічна інформація'),
  bottomNavAbsent: !document.querySelector('.bottom-nav')
})`);

const nightSignals = { donMissSignal, donHitSignal, sheriffBlackSignal, sheriffRedSignal, nightResultAnnouncement };
const chromeByTab = { home: homeChrome, players: playersChrome, setup: setupChrome, stats: statsChrome, settings: settingsChrome };
const unifiedModalFrames = { mediaModalFrame, orderModalFrame, hostProfileModalFrame, accountDeleteModalFrame, playerModalFrame, venueModalFrame, setupMoveModalFrame, setupAvatarModalFrame, gameSettingsModalFrame, seatModalFrame, confirmModalFrame, winnerModalFrame, protocolModalFrame, personalStatsModalFrame };
const languageSupport = { languageOptions, englishLanguage, frenchLanguage, italianLanguage, restoredUkrainianLanguage };
const gameCardSystem = { roleReadyLayout, roleOpenLayout, gameSettingsAppearance, confirmModalAppearance, winnerModalAppearance, zeroNightSheriff, zeroNightFreeSeating, bestMoveLayout, bestMoveFarewell, afterBestMove };
const result = { authenticatedHost, enjoyBrand, initialActiveGames, homeAverageGameTime, homeActiveGamesCollapsed, homeActiveGamesExpanded, chromeByTab, mobileLayout, headerMediaControls, headerOrderControl, headerShareControl, mediaPanel, preparedMedia, orderPanel, orderCategory, orderBack, orderResult, compactLayout, tabletLayout, desktopLayout, ownerDatabases, hostProfileControls, hostClubPicker, profileVenueCreate, profileVenueReturn, hostAvatarDraft, savedHostAvatar, editedHostName, profilePhotoSyncStatus, languageSupport, settingsHeaderBrandAbsent, settingsActionLayout, settingsTechnicalTermsAbsent, enjoyInfo, manualJsonTransferAbsent, themeOptions, darkPalette, lightPalette, cafeTheme, rulesLinks, compactHelp, helpPopover, accountDeletion, unifiedModalFrames, statsPanelDefault, statsPanelExpanded, statsPlayersDefault, statsPlayersExpanded, emptySharedStats, telegramImportAbsent, cameraControl, profile, presenceStatuses, lineupSelection, playersLayout, playersCompactLayout, setupPanelsDefault, setupPanelSpacing, setupPanelOrder, setupRulesLinks, setupTypography, setupCompactLayout, setupTimersMobileLayout, setupMusic, setupMusicEnabled, setupGameExpanded, venuePicker, venueModal, setupTimersCollapsed, setupSeatingCollapsed, randomTable, queuedTable, seatingOptionFilter, clearedSeating, setupAvatarPicker, temporaryAvatarLocked, temporaryGuestNames, seatMove, roleDealButton, preferredSeatName, playerStatsShortcut, personalStats, personalFeedback, gameCardSystem, roleSignals: [...new Set(roleAssignments.map(item => item.source))], zeroNightSignals, firstDay, hostTransferInitial, hostTransferFiltered, runningTimerStability, runningTimerAdjustment, timerNavigation, activeProfileLocks, activeGameHome, activeGameCompactHeader, activeGameStats, cancellationFromReveal, cancellationModal, cancelledGame, foreignLiveHome, foreignObserver, nomination, selfNomination, seatVisualStates, offlineShell, offlineReload, nightSignals, finishedSharedStats, protocolModal, queueAfterGame, browserErrors };
console.log(JSON.stringify(result, null, 2));

if (process.env.SMOKE_SCREENSHOT) {
  await captureScreenshot(process.env.SMOKE_SCREENSHOT);
}

function verify(condition, label) {
  if (condition) return;
  console.error(`Smoke assertion failed: ${label}`);
  process.exitCode = 1;
}

verify(firstDay.hash === '#game' && firstDay.seats === 10 && firstDay.phase === 'День 1' && firstDay.timer === '01:00' && firstDay.bottomNav && firstDay.navItems === 5 && firstDay.activeLabel === 'Активна гра' && firstDay.navHeight <= 52 && firstDay.iconOnly && firstDay.scrollWidth <= firstDay.viewport, 'first day timer, layout and compact game navigation');
verify(roleReadyLayout.moderatorVisible && roleReadyLayout.moderatorCollapsed && roleReadyLayout.moderatorAfterRole && roleReadyLayout.roleCardOrder === '1' && roleReadyLayout.moderatorOrder === '2', 'host panel is explicitly ordered below the role-dealing card and safely collapsed as soon as role dealing starts');
verify(firstDay.moderatorPanelVisible && firstDay.moderatorPanelCollapsed && firstDay.moderatorUnusedActionsAbsent && firstDay.finishGameInsideCollapsedPanel && firstDay.mobileProtocolHidden && moderatorPanelExpanded.expanded && moderatorPanelExpanded.contentVisible && moderatorPanelExpanded.finishGameVisible && JSON.stringify(moderatorPanelExpanded.controls) === JSON.stringify(['Ролі', '↶ Скасувати', '⚙ Таймери', 'Передати ведення']), 'mobile host panel is collapsed by default and contains host transfer and the protected finish-game action');
verify(hostTransferInitial.search && hostTransferInitial.candidates === 2 && hostTransferInitial.names.includes('Гравець 1') && hostTransferInitial.names.includes('Гравець 2') && hostTransferInitial.seatNumbersAbsent && hostTransferInitial.anyUserCopy && hostTransferFiltered.value === 'Гравець 2' && hostTransferFiltered.focused && JSON.stringify(hostTransferFiltered.names) === JSON.stringify(['Гравець 2']), 'host transfer lists all authorized profiles and filters them with a focused search field');
verify(runningTimerStability.rootReplacements === 0 && /^\d{2}:\d{2}$/.test(runningTimerStability.timer || ''), 'running timer updates without replacing the mobile game screen');
verify(runningTimerAdjustment.afterMinusFive === Math.max(0, runningTimerAdjustment.beforeMinusFive - 5) && runningTimerAdjustment.afterMinusTick <= runningTimerAdjustment.afterMinusFive && runningTimerAdjustment.afterMinusTick >= runningTimerAdjustment.afterMinusFive - 2 && runningTimerAdjustment.afterPlusFive === runningTimerAdjustment.afterMinusTick + 5, 'running timer +/- 5 seconds');
verify(timerNavigation.away === '#players' && timerNavigation.returned === '#game' && timerNavigation.stopped && timerNavigation.navRestored, 'timer pauses and persists when leaving active game');
verify(activeProfileLocks.locked === 10 && activeProfileLocks.editable >= 3 && activeProfileLocks.lockedButtonsDisabled, 'profiles seated in active game are locked');
verify(activeGameHome.rows === 1 && activeGameHome.resume === 1 && activeGameHome.inlineCancel === 0 && activeGameHome.headerCancel === 1 && activeGameHome.cancelIconOnly && activeGameHome.cancelLabel === 'Скасувати активну гру' && activeGameHome.cancelRed && activeGameHome.cancelBesideBluetooth && activeGameHome.watch === 0 && activeGameHome.title === 'Активні ігри' && activeGameHome.phase.includes('День 1') && activeGameStats.rows === 1 && activeGameStats.resume === 1 && activeGameStats.inlineCancel === 0 && activeGameStats.headerCancel === 1 && activeGameStats.status.toLocaleLowerCase('uk').includes('активн'), 'active game is visible on overview and statistics with a single red host-only header cancel icon');
verify(activeGameCompactHeader.scrollWidth <= 320 && activeGameCompactHeader.headerInsideViewport && activeGameCompactHeader.shareBeforeOrder && activeGameCompactHeader.orderBeforeCancel && activeGameCompactHeader.mediaHidden && activeGameCompactHeader.cancelBeforeBluetooth && activeGameCompactHeader.cancelSize >= 36, 'share, order and host controls fit the compact 320px header');
verify(cancellationFromReveal.hash === '#reveal' && cancellationFromReveal.headerCancelVisible && cancellationFromReveal.inlineCancelAbsent && cancellationFromReveal.roleHidden && cancellationModal.title === 'Скасувати гру?' && cancellationModal.explainsNoStats && cancellationModal.confirm === 'Скасувати гру' && cancelledGame.hash === '#home' && cancelledGame.activeGames === 0 && cancelledGame.finishedGames === 1 && cancelledGame.headerCancelAbsent && cancelledGame.toast === 'Гру скасовано' && cancelledGame.queuedPlayers === queueAfterGame.selected, 'host cancels an active game from the header without archive result and restores selected players');
verify(foreignLiveHome.row && !foreignLiveHome.resume && foreignLiveHome.watch && !foreignLiveHome.cancel && !foreignLiveHome.headerCancel && foreignLiveHome.eye && foreignLiveHome.label === 'Спостерігати' && foreignObserver.hash === '#observer/foreign-live-smoke' && foreignObserver.seats === 10 && foreignObserver.seatAvatarCount === 10 && foreignObserver.minSeatAvatarSize >= 40 && foreignObserver.faultDots === 40 && foreignObserver.minFaultDotSize >= 6 && foreignObserver.seatControls === 0 && !foreignObserver.moderatorPanel && foreignObserver.publicPanel && foreignObserver.bottomNavAbsent, 'foreign live game uses readable player avatars and fouls without host controls');
verify(authenticatedHost.name === 'Тестовий ведучий' && authenticatedHost.avatar, 'authenticated host');
verify(enjoyBrand.headerBrandAbsent && enjoyBrand.documentTitle === 'Mafia Enjoy' && enjoyBrand.heroWordmarkAbsent && enjoyBrand.heroTitle === 'Мафія enjoy' && enjoyBrand.coffeeIcon && enjoyBrand.sheriffBadge && enjoyBrand.favicon.endsWith('/assets/favicon-32.png') && enjoyBrand.brandMarkSize >= 44 && enjoyBrand.brandArtworkSize === 'contain' && enjoyBrand.heroIndexAbsent && enjoyBrand.addressAbsent && enjoyBrand.instagramAbsent && enjoyBrand.mapsAbsent && enjoyBrand.socialIcons === 0 && enjoyBrand.sharedArchive.includes('Активні й завершені') && enjoyBrand.externalArrowsAbsent && !enjoyBrand.redundantDescription && !enjoyBrand.redundantAudienceLabel, 'Enjoy brand');
verify(initialActiveGames.panel && initialActiveGames.rows === 0 && initialActiveGames.refresh && initialActiveGames.observerHint && initialActiveGames.state && initialActiveGames.toggle && initialActiveGames.expanded === 'true' && !initialActiveGames.hidden && homeActiveGamesCollapsed.expanded === 'false' && homeActiveGamesCollapsed.hidden && homeActiveGamesExpanded.expanded === 'true' && !homeActiveGamesExpanded.hidden, 'overview active games are expanded by default and can be collapsed and expanded');
verify(homeAverageGameTime.value === '0 хв' && homeAverageGameTime.label === 'середній час гри', 'overview shows average game duration instead of total time at the table');
verify(Object.entries(chromeByTab).every(([route, frame]) => isUnifiedAppChrome(frame, homeChrome) && (route === 'home' ? ['', '#home'].includes(frame.route) : frame.route === `#${route}`) && frame.activeLabel === ({ home: 'Огляд', players: 'Гравці', setup: 'Нова гра', stats: 'Статистика', settings: 'Ще' })[route]), 'unified chrome across tabs');
verify(mobileLayout.heroActionsHidden && mobileLayout.homeQuickActionCount === 2 && mobileLayout.homeQuickActionsSquare && mobileLayout.homeQuickActionsCentered && mobileLayout.homeQuickActionsAboveNavigation && mobileLayout.addPlayerFirst && mobileLayout.createGameSecond && mobileLayout.createGameRed && mobileLayout.addPlayerGold, 'mobile home floating quick actions, order and colors');
verify(settingsHeaderBrandAbsent, 'header brand copy absent on secondary tabs');
verify(settingsActionLayout.drive.count === 1 && settingsActionLayout.drive.fillsWidth && settingsActionLayout.drive.singleButtonFills && settingsActionLayout.observer.count === 1 && settingsActionLayout.observer.fillsWidth && settingsActionLayout.observer.singleButtonFills, 'full-width standalone settings actions');
verify(mobileLayout.scrollWidth <= mobileLayout.viewport && mobileLayout.pagePadding <= 8 && mobileLayout.stackGap <= 8 && mobileLayout.numericFont.includes('Arial') && mobileLayout.homeStatsCentered && mobileLayout.homeStatsBackground.includes('0.86') && mobileLayout.navHeight === 72 && mobileLayout.smallestNavIcon >= 26 && mobileLayout.newGameNavEmphasized && mobileLayout.headerAvatarVisible && mobileLayout.headerAvatarFills && mobileLayout.shortestPrimaryAction >= 44 && mobileLayout.smallestHomeActionFont >= 15 && mobileLayout.smallestTextButtonFont >= 15 && mobileLayout.installIconOnly && mobileLayout.installLabel === 'Встановити застосунок' && mobileLayout.installSize >= 40 && compactLayout.scrollWidth <= compactLayout.viewport && compactLayout.headerWidth <= compactLayout.viewport, 'mobile layout with emphasized new-game navigation');
verify(headerMediaControls.bluetooth && headerMediaControls.bluetoothMenuTrigger && headerMediaControls.play && headerMediaControls.pause && headerMediaControls.playInitiallyDisabled && headerMediaControls.pauseInitiallyDisabled && headerMediaControls.controls === 0 && headerMediaControls.compactlyHidden && headerMediaControls.bluetoothBesideProfile && headerMediaControls.profileGroupRightGap <= 10 && headerMediaControls.cancelAbsentWithoutGame && compactLayout.actionsRight <= compactLayout.viewport - 10, 'compact media controls move into the Bluetooth menu beside the profile');
verify(mediaPanel.title === 'Bluetooth і музика' && mediaPanel.prompt === 'Оберіть дію' && mediaPanel.audioInput === 'audio/*' && mediaPanel.choiceCount === 2 && JSON.stringify(mediaPanel.choices) === JSON.stringify(['Підключити Bluetooth-пристрій', 'Відкрити музику з пристрою']) && mediaPanel.choiceIcons === 2 && mediaPanel.musicPickerLabel === 'music-file' && mediaPanel.detailsInitiallyCollapsed && mediaPanel.smallestChoice >= 120 && mediaPanel.closeCentered && (mediaPanel.platform !== 'android' || mediaPanel.androidSystemLink === 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end') && (mediaPanel.platform !== 'ios' || (mediaPanel.iosGuide?.expanded && mediaPanel.iosGuide.controlCenter && mediaPanel.iosGuide.settings)) && preparedMedia.track === 'Enjoy smoke.wav' && preparedMedia.localOnly && preparedMedia.playEnabled && preparedMedia.clearButton && preparedMedia.externalControlWarning && preparedMedia.menuStillVisible && preparedMedia.activeHeaderPause.active && preparedMedia.activeHeaderPause.enabled && preparedMedia.activeHeaderPause.red && preparedMedia.pauseStopsPlayback, 'two-choice Bluetooth and local music menu with a visible red header pause control');
verify(headerOrderControl.icon && headerOrderControl.label === 'Замовити напій' && headerOrderControl.size >= 40 && headerOrderControl.red && headerOrderControl.besideShare && headerOrderControl.insideViewport, 'compact red order control beside share');
verify(headerShareControl.icon && headerShareControl.label === 'Поділитися застосунком' && headerShareControl.size >= 40 && headerShareControl.betweenInstallAndOrder && headerShareControl.besideInstall && headerShareControl.insideViewport && headerShareControl.title === 'Mafia Enjoy' && headerShareControl.text?.includes('Mafia Enjoy') && headerShareControl.url === headerShareControl.canonicalUrl && !headerShareControl.url.includes('#'), 'header share control between install and order with native share payload');
verify(orderPanel.title === 'Замовлення' && orderPanel.categoryCount === 2 && JSON.stringify(orderPanel.categories) === JSON.stringify(['Кава', 'Чай']) && orderPanel.smallestCategory >= 100 && !orderPanel.recipient && orderPanel.categoryPrompt && orderCategory.title === 'Кава' && orderCategory.count === 3 && JSON.stringify(orderCategory.choices) === JSON.stringify(['Кава', 'Капучино', 'Лате']) && orderCategory.back === 'До категорій' && orderCategory.immediate && orderBack === 2 && orderResult.success && orderResult.text.includes('Telegram') && orderResult.modalOpen, 'two-level Telegram order menu with category navigation and local delivery result');
verify(tabletLayout.scrollWidth <= tabletLayout.viewport && tabletLayout.headerHeight === 62 && tabletLayout.navHeight === 72 && tabletLayout.navItems === 5 && tabletLayout.smallestNavIcon >= 28 && tabletLayout.smallestNavLabel >= 12, 'tablet app chrome with larger navigation icons and labels');
verify(desktopLayout.scrollWidth <= desktopLayout.viewport && desktopLayout.headerTop === 0 && desktopLayout.navTop === desktopLayout.headerBottom && desktopLayout.navHeight >= 58 && desktopLayout.smallestNavIcon >= 26 && desktopLayout.smallestNavLabel >= 14 && desktopLayout.itemWidthSpread <= 1 && desktopLayout.navRightGap <= 1, 'desktop layout with larger top navigation icons and labels');
verify(ownerDatabases.includes('mafia-desk-local-smoke-test') && hostProfileControls.email === 'test.host@example.com' && hostProfileControls.camera === 'environment' && hostProfileControls.cameraIcon && hostProfileControls.cameraEmojiAbsent && hostProfileControls.gallery && hostProfileControls.deleteButton && hostProfileControls.deleteIconOnly && hostProfileControls.deleteInIdentity && hostProfileControls.deleteAbsentFromHeader && hostProfileControls.languageCount === 4 && JSON.stringify(hostProfileControls.languageOrder) === JSON.stringify(['uk', 'en', 'fr', 'it']) && JSON.stringify(hostProfileControls.languageLabels) === JSON.stringify(['Українська', 'English', 'Français', 'Italiano']) && hostProfileControls.languageFlags === 4 && hostProfileControls.languageNamesHidden && hostProfileControls.italianFlagStripes === 3 && hostProfileControls.discoverable && hostProfileControls.clubSearchable && hostProfileControls.clubAddButton && hostProfileControls.displayNameLabel === 'Ім’я *' && hostProfileControls.displayNameRequired && hostProfileControls.nicknameLabel === 'Нікнейм' && !hostProfileControls.nicknameRequired && hostProfileControls.nicknameHint.startsWith('Якщо заповнений') && hostProfileControls.nicknameHint.includes('основне ім’я') && hostProfileControls.nicknameDescribedBy === 'host-nickname-hint' && hostClubPicker.expanded === 'true' && hostClubPicker.focused && hostClubPicker.builtinEnjoy && profileVenueCreate.venueModal === 'Нове місце / клуб' && profileVenueCreate.nameInitiallyBlank && profileVenueReturn.profileRestored && profileVenueReturn.club === 'Smoke Profile Club' && hostProfileControls.inputFontSize >= 16 && !hostProfileControls.inputAutofocus && hostProfileControls.descriptionPlaceholder === 'Досвід ведення, улюблена кава…' && hostProfileControls.dialogFocused && hostProfileControls.dialogScrollTop === 0 && hostProfileControls.sheetTop >= 6 && hostProfileControls.sheetTop <= 8 && hostProfileControls.sheetLeft === 6 && hostProfileControls.sheetRightGap === 6 && hostProfileControls.sheetBottom <= hostProfileControls.viewportBottom - 6 && hostAvatarDraft.namePreserved === 'Ведучий Smoke' && hostAvatarDraft.nicknamePreserved === 'Smoke Нік' && hostAvatarDraft.customPreview && savedHostAvatar.header && savedHostAvatar.stored && savedHostAvatar.club === 'Smoke Profile Club' && editedHostName === 'Ведучий Smoke', 'host profile requires the Google-backed name, keeps the gameplay nickname optional, and preserves profile media');
verify(profilePhotoSyncStatus.label === 'Фото синхронізовано' && profilePhotoSyncStatus.status === 'synced' && profilePhotoSyncStatus.visible, 'explicit synced profile photo status');
verify(languageOptions.count === 4 && JSON.stringify(languageOptions.order) === JSON.stringify(['uk', 'en', 'fr', 'it']) && JSON.stringify(languageOptions.labels) === JSON.stringify(['Українська', 'English', 'Français', 'Italiano']) && languageOptions.flags === 4 && languageOptions.namesHidden && languageOptions.italianFlagStripes === 3 && languageOptions.selected === 'uk' && englishLanguage.lang === 'en' && englishLanguage.stored === 'en' && englishLanguage.title === 'Settings' && JSON.stringify(englishLanguage.nav) === JSON.stringify(['Overview', 'Players', 'New game', 'Statistics', 'More']) && englishLanguage.field === 'App language?' && englishLanguage.selected === 'en' && frenchLanguage.lang === 'fr' && frenchLanguage.title === 'Paramètres' && frenchLanguage.more === 'Plus' && frenchLanguage.selected === 'fr' && italianLanguage.lang === 'it' && italianLanguage.title === 'Impostazioni' && italianLanguage.more === 'Altro' && italianLanguage.selected === 'it' && restoredUkrainianLanguage.lang === 'uk' && restoredUkrainianLanguage.stored === 'uk' && restoredUkrainianLanguage.title === 'Налаштування' && restoredUkrainianLanguage.selected === 'uk', 'flag-only language switching');
verify(themeOptions === 3 && darkPalette.active === 'dark' && lightPalette.active === 'light' && cafeTheme.active === 'cafe' && new Set([darkPalette.bg, lightPalette.bg, cafeTheme.bg]).size === 3 && new Set([darkPalette.text, lightPalette.text, cafeTheme.text]).size === 3 && new Set([darkPalette.art, lightPalette.art, cafeTheme.art]).size === 3 && darkPalette.card.includes('/ 86%') && lightPalette.card.includes('/ 87%') && cafeTheme.card.includes('/ 86%') && darkPalette.art.includes('theme-dark-mafioso.jpg') && lightPalette.art.includes('theme-light-sheriff.jpg') && cafeTheme.art.includes('theme-cafe-bar.jpg') && darkPalette.artSize === 'cover' && darkPalette.artLayerSize.split(',').at(-1).trim() === 'cover' && cafeTheme.cached === 'cafe' && cafeTheme.pressed === 'true' && cafeTheme.themeColor === '#1a100b', 'themes and full-viewport mobile background');
verify(enjoyInfo.descriptionAbsent && enjoyInfo.instagramIcon && enjoyInfo.mapsIcon && enjoyInfo.iconOnly && enjoyInfo.wordmarkAbsent && enjoyInfo.smallestLink >= 44 && enjoyInfo.cardHeight <= 210, 'compact café card without Enjoy wordmark');
verify(manualJsonTransferAbsent, 'manual JSON import and export controls removed');
verify(settingsTechnicalTermsAbsent, 'technical storage terms absent from settings');
verify(rulesLinks.count === 2 && rulesLinks.ukrainian?.includes('imafia.org/game-rules') && rulesLinks.international?.includes('fiim.world/fiim-rules') && rulesLinks.externalSafety && rulesLinks.arrowsAbsent, 'rules links');
verify(compactHelp.count >= 8 && compactHelp.visiblePageDescriptions === 0 && compactHelp.visibleSectionDescriptions === 0 && compactHelp.visibleFieldHints === 0 && compactHelp.circular && helpPopover.visible && helpPopover.role === 'tooltip' && helpPopover.text.includes('Спільнота') && helpPopover.insideViewport, 'compact help tooltips');
verify(accountDeletion.trashIconOnly && accountDeletion.trashButtonSize >= 40 && accountDeletion.dialog && accountDeletion.title === 'Видалити профіль Mafia?' && accountDeletion.retentionCopyAbsent && accountDeletion.confirm === 'Видалити профіль' && accountDeletion.focused && accountDeletion.scrollTop === 0 && accountDeletion.top >= 6 && accountDeletion.top <= 8 && accountDeletion.left === 6 && accountDeletion.rightGap === 6 && accountDeletion.bottomWithinViewport && accountDeletion.backdropAlign === 'start' && accountDeletion.bordered, 'account deletion controls');
verify(Object.values(unifiedModalFrames).length === 14 && Object.values(unifiedModalFrames).every(isUnifiedModal), 'unified mobile modal frames');
verify(statsPanelDefault.expanded === 'false' && statsPanelDefault.hidden && statsPanelDefault.graphPresent && statsPanelExpanded.expanded === 'true' && !statsPanelExpanded.hidden && statsPanelExpanded.focused === 'statsRoles', 'collapsible statistics graph');
verify(statsPlayersDefault.expanded === 'false' && statsPlayersDefault.hidden && statsPlayersDefault.emptyState && statsPlayersExpanded.expanded === 'true' && !statsPlayersExpanded.hidden && statsPlayersExpanded.focused === 'statsPlayers', 'statistics players section is collapsed by default');
verify(emptySharedStats.title === 'Статистика' && emptySharedStats.description.includes('усіх ведучих') && emptySharedStats.archiveTitle === 'Спільний архів ігор' && emptySharedStats.blackRate === '0%' && emptySharedStats.summaryCentered && emptySharedStats.technicalTermsAbsent && emptySharedStats.unifiedStates && emptySharedStats.emptyStates, 'empty shared statistics and unified states');
verify(cameraControl.cameraInput && cameraControl.captureMode === 'environment' && cameraControl.vectorIcon && cameraControl.emojiAbsent && cameraControl.galleryInput && cameraControl.emailInputType === 'email' && cameraControl.emailHelp.includes('Google'), 'camera and player email controls');
verify(presenceStatuses.googleCards === 2 && presenceStatuses.online === 1 && presenceStatuses.offline === 1 && presenceStatuses.manualPresenceAbsent && presenceStatuses.labels.includes('Онлайн') && presenceStatuses.labels.includes('Офлайн') && presenceStatuses.dots === 2 && presenceStatuses.lightOnlineColor === 'rgb(28, 90, 55)' && presenceStatuses.lightOnlineBackground === 'rgb(224, 240, 229)' && presenceStatuses.lightOfflineColor === 'rgb(79, 72, 65)' && presenceStatuses.lightOfflineBackground === 'rgb(238, 233, 227)', 'high-contrast Google presence badges in the light theme');
verify(telegramImportAbsent.input && telegramImportAbsent.action && telegramImportAbsent.modal, 'Telegram import removed');
verify(profile.cards === 13 && !profile.modalOpen && profile.pendingGoogleLink && lineupSelection.selected === 12 && lineupSelection.chips === 12 && lineupSelection.waitingChips === 2 && lineupSelection.status.includes('черга 2') && lineupSelection.positions.length === 12 && playersLayout.scrollWidth <= playersLayout.viewport && playersLayout.topActionHidden && playersLayout.searchActionHidden && playersLayout.textSeatingHidden && playersLayout.fabVisible && playersLayout.actionCount === 2 && playersLayout.fabSquare && playersLayout.addPlayerIcon && playersLayout.seatingIcon && playersLayout.addPlayerGold && playersLayout.seatingRed && playersLayout.fabCentered && playersLayout.fabAboveNavigation && JSON.stringify(playersLayout.labels) === JSON.stringify(['Додати гравця', 'До розсадки']) && playersLayout.preferredName === 'Тестовий Нік' && playersLayout.clubInline && playersLayout.guestPlainText && playersLayout.cardActionCount === 3 && playersLayout.cardActionsSameRow && playersLayout.queueActionLast && playersLayout.playerGap <= 4 && playersCompactLayout.scrollWidth <= playersCompactLayout.viewport && playersCompactLayout.statusRight <= playersCompactLayout.viewport && playersCompactLayout.refreshWidth > 0 && playersCompactLayout.smallestQueueButton >= 44 && playersCompactLayout.cardsInsideViewport && playersCompactLayout.actionRowsHorizontal && playersCompactLayout.queueActionsLast && playersCompactLayout.fabLeft >= 0 && playersCompactLayout.fabRight <= playersCompactLayout.viewport, 'compact player identity, tight card spacing, horizontal actions with queue last, floating actions, and next-game queue');
verify(playerStatsShortcut.settingsIcon && playerStatsShortcut.playerIcons >= 1 && personalStats.title === 'Smoke Нік' && personalStats.games === '1' && personalStats.history === 1 && personalStats.sentimentChoices === 2 && personalStats.emotions.length === 5 && personalStats.emotions.includes('Мозок закипів') && personalStats.emotions.includes('Цирк Enjoy') && personalStats.privacy.includes('тільки ви') && personalStats.threshold.includes('3 оцінок') && personalStats.scrollWidth <= 390 && personalFeedback.sentiment === 'true' && personalFeedback.emotion === 'true' && personalFeedback.saved.includes('анонімно') && personalFeedback.selected === 2, 'personal player history and anonymous two-part feedback');
verify(setupPanelsDefault.setupGame.expanded === 'false' && setupPanelsDefault.setupGame.hidden && setupPanelsDefault.setupTimers.expanded === 'false' && setupPanelsDefault.setupTimers.hidden && setupPanelsDefault.setupMusic.expanded === 'false' && setupPanelsDefault.setupMusic.hidden && setupPanelsDefault.setupRules.expanded === 'false' && setupPanelsDefault.setupRules.hidden && setupPanelsDefault.setupSeating.expanded === 'true' && !setupPanelsDefault.setupSeating.hidden && setupRulesLinks.expanded === 'true' && !setupRulesLinks.hidden && setupRulesLinks.count === 2 && setupRulesLinks.ukrainian?.includes('imafia.org/game-rules') && setupRulesLinks.international?.includes('fiim.world/fiim-rules') && setupRulesLinks.externalSafety && setupRulesLinks.arrowsAbsent && setupGameExpanded.expanded === 'true' && !setupGameExpanded.hidden && setupGameExpanded.focused === 'setupGame' && setupTimersCollapsed.expanded === 'false' && setupTimersCollapsed.hidden && setupSeatingCollapsed.expanded === 'false' && setupSeatingCollapsed.hidden, 'collapsible game setup panels');
verify(setupPanelSpacing.gaps.length === 4 && setupPanelSpacing.gaps.every(gap => gap >= 7 && gap <= 8) && setupPanelSpacing.spread <= 1, 'uniform spacing between new-game panels');
verify(setupMusic.expanded === 'true' && setupMusic.switchState === 'false' && JSON.stringify(setupMusic.cues) === JSON.stringify(['roleDeal', 'zeroNight', 'nightActions', 'nightResult']) && setupMusic.choices === 4 && setupMusic.builtinsPerChoice.every(count => count === 4) && setupMusic.customChoices && setupMusic.fileInputs === 4 && setupMusic.previews === 4 && setupMusic.pauses === 4 && setupMusic.pauseIconsOnly && setupMusic.pauseLabels && setupMusic.pauseSquares && setupMusic.pauseBetween && setupMusic.localOnly && setupMusic.scrollWidth <= 390 && setupMusicEnabled.checked === 'true' && setupMusicEnabled.badge === 'Увімкнено', 'automatic game music settings with preview, icon-only pause and local-file controls');
verify(venuePicker.searchable && venuePicker.expanded === 'true' && venuePicker.focused && venuePicker.addButton && venuePicker.builtinEnjoy && venuePicker.venue === 'Enjoy' && venuePicker.titleUsesVenueDateTime && venueModal.title === 'Нове місце / клуб' && venueModal.form === 'venue' && JSON.stringify(venueModal.fields) === JSON.stringify(['name', 'googleMapsUrl', 'address', 'phone', 'website']) && venueModal.googleFill && venueModal.sharedCopy, 'searchable shared venue selector, exact-name game title and venue creation form');
verify(JSON.stringify(setupPanelOrder) === JSON.stringify(['setupMusic', 'setupSeating', 'setupRules']), 'music, seating and rules panel order');
verify(Object.values(setupTypography).every(font => !/(Iowan|Palatino|Book Antiqua|Georgia|ui-serif)/i.test(font)), 'readable sans-serif typography');
verify(setupTypography.foulHelp?.includes('Турнірна') && setupTypography.foulHelp?.includes('Клубна') && setupTypography.foulHelp?.includes('4-й фол'), 'foul system help');
verify(setupCompactLayout.scrollWidth <= setupCompactLayout.viewport && setupCompactLayout.moveButtons === 10 && setupCompactLayout.smallestMoveButton >= 44 && setupCompactLayout.playerPickers === 10 && setupCompactLayout.smallestPlayerPicker >= 44 && setupCompactLayout.pickerIcons === 10 && setupCompactLayout.seatAvatars === 10 && setupCompactLayout.avatarControls === 10 && setupCompactLayout.editableAvatarControls > 0 && setupCompactLayout.generatedAvatars > 0 && setupCompactLayout.profileAvatars > 0 && setupCompactLayout.uniqueGeneratedAvatars && setupCompactLayout.avatarSources.every(source => /(?:assets\/avatars\/|data:image|^https?:)/.test(source)) && setupCompactLayout.avatarsFill && setupCompactLayout.avatarBetweenPickerAndName && setupCompactLayout.nameInputs === 10 && setupCompactLayout.collapsedPanelMaxHeight <= 54 && setupCompactLayout.collapsedToggleMinHeight >= 44 && setupCompactLayout.maxRowHeight <= 50 && setupCompactLayout.rowBordersAbsent && setupCompactLayout.rowBackgroundsTransparent && setupCompactLayout.rowGap <= 4 && setupCompactLayout.nativeSelectsCompact && setupCompactLayout.footerActionsHidden && setupCompactLayout.seatingActionsEqualWidth && setupCompactLayout.clearSeatingControl.visible && setupCompactLayout.clearSeatingControl.width >= 50 && setupCompactLayout.clearSeatingControl.height >= 50 && setupCompactLayout.clearSeatingControl.square && setupCompactLayout.clearSeatingControl.matchesShuffle && setupCompactLayout.clearSeatingControl.matchesDeal && setupCompactLayout.clearSeatingControl.insideViewport && setupCompactLayout.floatingActions.visible && setupCompactLayout.floatingActions.count === 2 && setupCompactLayout.floatingActions.square && setupCompactLayout.floatingActions.centered && setupCompactLayout.floatingActions.aboveNavigation && setupCompactLayout.floatingActions.addPlayerIcon && setupCompactLayout.floatingActions.dealRolesIcon && setupCompactLayout.floatingActions.addLabel === 'Додати гравця' && setupCompactLayout.floatingActions.dealLabel === 'Роздати ролі' && setupCompactLayout.floatingActions.addPlayerGold && setupCompactLayout.floatingActions.dangerColor !== 'rgba(0, 0, 0, 0)', 'compact setup panels, equal-width seating actions, equal-height square clear control, player picker, avatars and floating actions');
verify(setupTimersMobileLayout.expanded && setupTimersMobileLayout.fields === 8 && setupTimersMobileLayout.columns === 2 && setupTimersMobileLayout.rows === 4 && setupTimersMobileLayout.equalWidths && setupTimersMobileLayout.inputsInsideColumns && setupTimersMobileLayout.foulFullWidth && setupTimersMobileLayout.scrollWidth <= 320, 'mobile game timers use two equal columns while the foul system remains full width');
verify(setupAvatarTarget.seat > 0 && setupAvatarTarget.playerId && setupAvatarPicker.title === 'Аватар гравця' && setupAvatarPicker.profile === 'Тестовий Нік' && setupAvatarPicker.choices === 10 && setupAvatarPicker.imageChoices === 10 && setupAvatarPicker.manualHelp.includes('ручному профілі') && setupAvatarPicker.lionEnabled && setupAvatarPicker.modalClosed && setupAvatarPicker.editable && setupAvatarPicker.rowAvatar.startsWith('data:image/webp;base64,') && setupAvatarPicker.storedAvatar === setupAvatarPicker.rowAvatar && setupAvatarPicker.storedPreset === './assets/avatars/lion.webp' && temporaryAvatarLocked, 'manual-profile setup avatar picker, persistence and temporary-profile restriction');
verify(randomTable.selected === 10 && randomTable.unique === 10 && randomTable.venue === 'Enjoy' && randomTable.title.startsWith('Enjoy · ') && randomTable.titleHasTime && randomTable.rerollAbsent && randomTable.dealModeControls === 1 && randomTable.dealModeInSeating && !randomTable.dealModeOutsideSeating && randomTable.dealModeLabel === 'Спосіб роздачі ролей' && randomTable.dealModeHelp?.includes('гравці по черзі') && randomTable.dealModeValue === 'number' && JSON.stringify(randomTable.dealModeOptions) === JSON.stringify(['За обраною цифрою', 'Автоматично']) && randomTable.dealModeOptionContrast && randomTable.shuffleIcon && randomTable.clearIcon && randomTable.clearBroomIcon && randomTable.clearIconOnly && randomTable.clearLabel === 'Очистити розсадку' && randomTable.clearAfterShuffle && randomTable.iconsDecorative && randomTable.nicknameFirstOption === 'Тестовий Нік · Тестова Гравчиня' && queuedTable.followsSelection && preferredSeatName === 'Тестовий Нік', 'nickname-first queued table with role-deal selector, shuffle and icon-only broom clear action');
verify(seatingOptionFilter.currentPlayerPreserved && seatingOptionFilter.occupiedHiddenElsewhere && seatingOptionFilter.eachAssignedShownOnce && seatingOptionFilter.unassignedRemainAvailable, 'already seated players hidden from other seat pickers');
verify(clearedSeating.seats === 10 && clearedSeating.profilesEmpty && clearedSeating.namesEmpty && clearedSeating.toast === 'Розсадку очищено' && clearedSeating.manualEntry === 'Ручний гравець', 'clear seating leaves ten empty seats ready for manual entry');
verify(temporaryGuestNames.replacesNumberedPlaceholder && temporaryGuestNames.singleWord && temporaryGuestNames.manualNameSurvivesMove, 'single-word funny temporary guest names and manual override');
verify(seatMove.dialog.title === 'Перемістити з місця 1' && seatMove.dialog.targets === 10 && seatMove.dialog.currentDisabled && seatMove.swapped && seatMove.restored, 'move player to a specific seat');
verify(roleDealButton.label === 'Роздати ролі' && roleDealButton.danger && roleDealButton.legacyButtons === 0 && (roleDealButton.backgroundImage !== 'none' || roleDealButton.backgroundColor !== 'rgba(0, 0, 0, 0)') && roleDealButton.primaryBackground !== roleDealButton.secondaryBackground, 'unified gold, red and neutral button system');
verify(new Set(roleAssignments.map(item => item.source)).size === 4 && zeroNightSignals.count === 2 && zeroNightSignals.sources.some(source => source.endsWith('/don.webp')) && zeroNightSignals.sources.some(source => source.endsWith('/mafia.webp')) && zeroNightSignals.steps === 3 && zeroNightSignals.current === 'Знайомство мафії' && zeroNightSignals.cue.includes('Дон') && zeroNightSignals.cueFontSize >= 22 && zeroNightSignals.actionHeight >= 60 && zeroNightSignals.actionFontSize >= 18 && zeroNightSignals.insideViewport && zeroNightSheriff.signal.endsWith('/sheriff.webp') && zeroNightSheriff.current === 'Позначення Шерифа' && zeroNightSheriff.cue.includes('Шериф') && zeroNightSheriff.timer === '00:10' && zeroNightSheriff.action === 'Вільна посадка' && zeroNightSheriff.actionHeight >= 60 && zeroNightFreeSeating.current === 'Вільна посадка' && zeroNightFreeSeating.cue.includes('вільної посадки') && zeroNightFreeSeating.timer === '00:20' && zeroNightFreeSeating.action === 'Почати день 1', 'guided zero night with large spoken moderator cues, Mafia meeting, Sheriff identification and free seating');
verify(roleReadyLayout.ready && roleReadyLayout.progressFirst && roleReadyLayout.progressLabelSize >= 14 && roleReadyLayout.progressCountSize >= 32 && roleReadyLayout.actionsLast && roleReadyLayout.seat === '1' && roleReadyLayout.avatar === preferredSeatAvatar && roleReadyLayout.avatarVisible && roleReadyLayout.avatarBetweenSeatAndName && roleReadyLayout.avatarFills && roleReadyLayout.playerNameSize >= 26 && roleReadyLayout.instructionTitleSize >= 22 && roleReadyLayout.instructionSize >= 14 && roleReadyLayout.numberCards === 10 && roleReadyLayout.numberInstruction.includes('від 1 до 10') && roleReadyLayout.action === 'Спочатку оберіть цифру' && roleReadyLayout.actionDisabled && roleReadyLayout.actionHeight >= 120 && roleReadyLayout.actionFontSize >= 34 && roleReadyLayout.actionFontWeight >= 900 && roleReadyLayout.insideViewport && roleReadyLayout.scrollWidth <= 390 && JSON.stringify(roleDealCardCounts) === JSON.stringify([10,9,8,7,6,5,4,3,2,1]) && roleOpenLayout.open && roleOpenLayout.progressVisible && roleOpenLayout.playerVisible && roleOpenLayout.avatar === roleReadyLayout.avatar && roleOpenLayout.avatarVisible && roleOpenLayout.signal && roleOpenLayout.action === 'Сховати й перейти до наступного' && roleOpenLayout.actionHeight >= 120 && roleOpenLayout.actionFontSize >= 34 && roleOpenLayout.insideViewport && roleOpenLayout.scrollWidth <= 390 && Math.abs(roleOpenLayout.height - roleReadyLayout.height) <= 2 && roleAssignments.every(item => item.avatar) && new Set(roleAssignments.map(item => item.avatar)).size === 10, 'double-size role-deal actions, stable reveal cards and unique avatars');
verify(redTeamRoleCards.length === 7 && redTeamRoleCards.every(item => item.redTeam && !item.blackTeam && item.team === 'Червона команда' && item.backgroundColor === 'rgb(143, 20, 34)' && item.textColor === 'rgb(255, 255, 255)' && item.teamBadgeHeight >= 38) && blackTeamRoleCards.length === 3 && blackTeamRoleCards.every(item => item.blackTeam && !item.redTeam && item.team === 'Чорна команда' && item.backgroundColor === 'rgb(7, 7, 9)' && item.textColor === 'rgb(255, 255, 255)' && item.teamBadgeHeight >= 38), 'high-contrast red and black team role presentation');
verify(gameSettingsAppearance.gameModal && gameSettingsAppearance.context === 'Активна гра' && gameSettingsAppearance.closeLabel === 'Закрити' && seatVisualStates.seatModalAppearance.gameModal && seatVisualStates.seatModalAppearance.closeLabel === 'Закрити' && confirmModalAppearance.gameModal && confirmModalAppearance.context === 'Потрібне підтвердження' && confirmModalAppearance.closeLabel === 'Закрити' && confirmModalAppearance.dangerousAccent !== gameSettingsAppearance.accent && winnerModalAppearance.gameModal && winnerModalAppearance.context === 'Завершення гри' && winnerModalAppearance.choices === 3 && JSON.stringify(winnerModalAppearance.labels) === JSON.stringify(['Мирне місто', 'Мафія', 'Нічия']) && winnerModalAppearance.descriptions.length === 3 && winnerModalAppearance.closeLabel === 'Закрити', 'unified contextual game dialogs');
verify(firstDay.seats === 10 && firstDay.seatColumns === 2 && firstDay.seatRows === 5 && firstDay.maxSeatHeight <= 66 && firstDay.aliveSeats === 10 && firstDay.deadSeats === 0 && firstDay.allSeatsVisible && firstDay.numberSize >= 27 && firstDay.numberWeight >= 900 && firstDay.seatAvatarCount === 10 && firstDay.minSeatAvatarSize >= 40 && firstDay.faultDots === 40 && firstDay.minFaultDotSize >= 8 && firstDay.faultsRightOfPlayers && firstDay.minSeatNameSize >= 11 && firstDay.currentSpeakerHighlight && firstDay.aliveGreenAccent && firstDay.timerActionHeight >= 60 && firstDay.timerActionFontSize >= 18 && firstDay.timerActionFontWeight >= 900 && firstDay.timerAdjustments === 2 && firstDay.timerAdjustmentsBesideTime && JSON.stringify(firstDay.primaryActions) === JSON.stringify(['Старт', 'Скинути', 'Наступний →']) && firstDay.primaryActionsSameRow && firstDay.primaryActionsVisible, 'two-column table with large numbers, right-aligned fouls, current-speaker highlight and one-row controls');
verify(seatVisualStates.seatModalAppearance.number === '2' && seatVisualStates.seatModalAppearance.numberSize >= 58 && seatVisualStates.seatModalAppearance.numberWeight >= 900 && seatVisualStates.seatModalAppearance.alive && seatVisualStates.seatModalAppearance.status === 'За столом' && seatVisualStates.deadSeatAppearance.dead && !seatVisualStates.deadSeatAppearance.alive && seatVisualStates.deadSeatAppearance.opacity < 0.8 && seatVisualStates.deadSeatAppearance.grayscale && seatVisualStates.deadSeatAppearance.tag === 'вибув' && seatVisualStates.deadSeatModalAppearance.number === '10' && seatVisualStates.deadSeatModalAppearance.dead && seatVisualStates.deadSeatModalAppearance.status === 'Вибув' && seatVisualStates.restoredSeatAppearance.alive && !seatVisualStates.restoredSeatAppearance.dead, 'alive, eliminated and restored seat visuals');
verify(nomination.candidates.length === 1 && nomination.candidateStripe && !nomination.modalOpen && !browserErrors.length, 'nomination uses a wide right-edge candidate stripe without browser errors');
verify(selfNomination.visible && selfNomination.enabled && selfNomination.candidate === '1' && selfNomination.candidates.length === 1 && selfNomination.candidates[0].includes('№1') && selfNomination.log.includes('№1 виставляє №1'), 'the current speaker may nominate themselves');
verify(offlineShell.authModule && offlineShell.cloudProfilesModule && offlineShell.cloudGamesModule && offlineShell.cloudVenuesModule && offlineShell.venueDirectoryModule && offlineShell.gameMusicModule && offlineShell.gameFeedbackModule && offlineShell.gameEngineModule && offlineShell.orderServiceModule && offlineShell.playerDirectoryModule && offlineShell.playerLinksModule && offlineShell.timerModule && offlineShell.lineupModule && offlineShell.guestNamesModule && offlineShell.i18nModule && offlineShell.enjoyModule && offlineShell.firebaseApp && offlineShell.firebaseAuth && offlineShell.firebaseFirestore && offlineShell.roleSignals === 6 && offlineShell.themeBackgrounds === 3 && offlineShell.musicTracks === 4 && offlineReload.hash === '#game' && offlineReload.phase === 'День 1' && offlineReload.signedIn, 'offline shell');
verify(donMissSignal.source.endsWith('/don-not-sheriff.webp') && donMissSignal.label === 'НЕ ШЕРИФ' && donMissSignal.instruction.includes('схрестіть руки'), 'Don miss signal');
verify(donHitSignal.source.endsWith('/don-found-sheriff.webp') && donHitSignal.label === 'ЦЕ ШЕРИФ' && donHitSignal.instruction.includes('однією рукою'), 'Don hit signal');
verify(sheriffBlackSignal.source.endsWith('/mafia.webp') && sheriffBlackSignal.label === 'ЧОРНИЙ' && sheriffBlackSignal.instruction.includes('палець униз'), 'Sheriff black signal');
verify(sheriffRedSignal.source.endsWith('/citizen.webp') && sheriffRedSignal.label === 'ЧЕРВОНИЙ' && sheriffRedSignal.instruction.includes('палець угору'), 'Sheriff red signal');
verify(nightResultAnnouncement.title === 'У місті триває ніч' && nightResultAnnouncement.cue.includes('У місті триває ніч') && !nightResultAnnouncement.cue.includes('ранок') && nightResultAnnouncement.action === 'Зафіксувати вибуття', 'night result is announced before morning');
verify(bestMoveLayout.phase === 'Кращий хід' && bestMoveLayout.timer === '00:20' && bestMoveLayout.candidates === 10 && bestMoveLayout.unavailable === 1 && bestMoveLayout.selected === 0 && bestMoveLayout.cue.includes('трійку чорних') && bestMoveLayout.insideViewport && bestMoveLayout.scrollWidth <= 390 && bestMoveFarewell.phase === 'Останнє слово' && bestMoveFarewell.timer === '01:00' && bestMoveFarewell.player.includes('№1') && bestMoveFarewell.cue.includes('У місті ранок') && afterBestMove.phase === 'День 2' && afterBestMove.logged, 'first-night Best Move, morning and farewell flow');
verify(finishedSharedStats.games === '1' && finishedSharedStats.archivedGames === 1 && finishedSharedStats.feedbackCards === finishedSharedStats.archivedGames && finishedSharedStats.anonymousFeedback.includes('Анонімна оцінка') && finishedSharedStats.anonymousFeedback.includes('3') && !finishedSharedStats.feedbackContainsIdentity && finishedSharedStats.manageableGames === 1 && finishedSharedStats.protocolActionsFill && finishedSharedStats.leaderboardRows > 0 && finishedSharedStats.status.includes('Активні й завершені') && finishedSharedStats.hostUsesNickname && finishedSharedStats.hostDisplayNameHidden, 'finished shared statistics, anonymous feedback, archive actions and host nickname');
verify(protocolModal.focused && protocolModal.scrollTop === 0 && protocolModal.top >= 6 && protocolModal.top <= 8 && protocolModal.left === 6 && protocolModal.rightGap === 6 && protocolModal.bottomWithinViewport && protocolModal.borders.every(width => parseFloat(width) >= 1) && protocolModal.backdropAlign === 'start' && protocolModal.logScrollable, 'top-anchored bounded protocol modal');
verify(queueAfterGame.selected === 2 && queueAfterGame.status.includes('2/10') && queueAfterGame.positions.join(',') === '1,2', 'waiting players carry into the next game');
socket.close();
