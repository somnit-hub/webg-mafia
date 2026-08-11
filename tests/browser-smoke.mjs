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

await send('Runtime.enable');
await send('Log.enable');
await wait(400);

await click('[data-nav="players"]');
await click('[data-action="new-player"]');
await evaluate(`document.querySelector('#player-name').value = 'Тестова Гравчиня'`);
await click('.modal button[type="submit"]');
await wait(200);
const profile = await evaluate(`({ cards: document.querySelectorAll('.player-card').length, modalOpen: Boolean(document.querySelector('.modal')) })`);

await click('[href="#setup"]');
await click('[data-action="start-game"]');
await wait(250);

for (let index = 0; index < 10; index += 1) {
  await click('[data-action="reveal-role"]');
  await click('[data-action="reveal-next"]');
}

await click('[data-action="zero-to-day"]');
const firstDay = await evaluate(`({
  hash: location.hash,
  seats: document.querySelectorAll('.game-seat').length,
  phase: document.querySelector('.phase-copy h1')?.textContent,
  timer: document.querySelector('.timer')?.textContent,
  speaker: document.querySelector('.speaker-row h2')?.textContent
})`);

await click('.game-seat[data-seat="2"]');
await click('[data-action="nominate"]');
const nomination = await evaluate(`({
  candidates: [...document.querySelectorAll('.nom-chip')].map(element => element.textContent),
  modalOpen: Boolean(document.querySelector('.modal')),
  latestLog: document.querySelector('.quick-log')?.innerText.split('\\n').slice(0, 2)
})`);

const result = { profile, firstDay, nomination, browserErrors };
console.log(JSON.stringify(result, null, 2));

if (process.env.SMOKE_SCREENSHOT) {
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.SMOKE_SCREENSHOT, Buffer.from(capture.result.data, 'base64'));
}

if (firstDay.hash !== '#game' || firstDay.seats !== 10 || firstDay.phase !== 'День 1') process.exitCode = 1;
if (profile.cards !== 1 || profile.modalOpen) process.exitCode = 1;
if (nomination.candidates.length !== 1 || nomination.modalOpen || browserErrors.length) process.exitCode = 1;
socket.close();
