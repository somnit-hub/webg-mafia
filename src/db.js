const DB_NAME = 'mafia-desk';
const DB_VERSION = 1;

let dbPromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('players')) {
        const players = db.createObjectStore('players', { keyPath: 'id' });
        players.createIndex('name', 'name');
        players.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('games')) {
        const games = db.createObjectStore('games', { keyPath: 'id' });
        games.createIndex('status', 'status');
        games.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function store(name, mode = 'readonly') {
  const db = await openDatabase();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll(name) {
  return requestResult((await store(name)).getAll());
}

export async function getOne(name, key) {
  return requestResult((await store(name)).get(key));
}

export async function putOne(name, value) {
  return requestResult((await store(name, 'readwrite')).put(value));
}

export async function deleteOne(name, key) {
  return requestResult((await store(name, 'readwrite')).delete(key));
}

export async function clearStore(name) {
  return requestResult((await store(name, 'readwrite')).clear());
}

export async function getSetting(key, fallback = null) {
  const row = await getOne('settings', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  return putOne('settings', { key, value });
}

export async function exportDatabase() {
  const [players, games, settings] = await Promise.all([
    getAll('players'), getAll('games'), getAll('settings')
  ]);
  return { schema: 1, exportedAt: new Date().toISOString(), players, games, settings };
}

export async function importDatabase(payload, { replace = false } = {}) {
  if (!payload || payload.schema !== 1 || !Array.isArray(payload.players) || !Array.isArray(payload.games)) {
    throw new Error('Непідтримуваний формат резервної копії');
  }
  if (replace) await Promise.all(['players', 'games', 'settings'].map(clearStore));
  for (const player of payload.players) await putOne('players', player);
  for (const game of payload.games) await putOne('games', game);
  for (const setting of payload.settings || []) await putOne('settings', setting);
}
