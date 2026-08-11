import { exportDatabase, importDatabase, setSetting } from './db.js';

const BACKUP_NAME = 'mafia-desk-backup.json';

let accessToken = null;

export function setDriveAccessToken(token) {
  accessToken = token || null;
}

function authHeaders(extra = {}) {
  if (!accessToken) throw new Error('Увійдіть через Google');
  return { Authorization: `Bearer ${accessToken}`, ...extra };
}

async function findBackup() {
  const query = encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`, {
    headers: authHeaders()
  });
  if (!response.ok) throw new Error('Google Drive не відповів');
  const data = await response.json();
  return data.files?.[0] || null;
}

export async function pushToDrive() {
  const backup = await exportDatabase();
  const existing = await findBackup();
  const metadata = existing ? { name: BACKUP_NAME } : { name: BACKUP_NAME, parents: ['appDataFolder'] };
  const boundary = `mafia_desk_${Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(backup)}\r\n--${boundary}--`;
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const response = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: authHeaders({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body
  });
  if (!response.ok) throw new Error('Не вдалося записати резервну копію на Google Drive');
  await setSetting('lastCloudSync', new Date().toISOString());
  return response.json();
}

export async function pullFromDrive() {
  const file = await findBackup();
  if (!file) throw new Error('Резервну копію в Google Drive ще не створено');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: authHeaders()
  });
  if (!response.ok) throw new Error('Не вдалося прочитати резервну копію');
  const payload = await response.json();
  await importDatabase(payload, { replace: true });
  await setSetting('lastCloudSync', new Date().toISOString());
  return payload;
}

export function getDriveSession() {
  return { connected: Boolean(accessToken) };
}

export function clearDriveAccess() {
  accessToken = null;
}
