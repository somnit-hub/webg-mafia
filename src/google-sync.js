import { exportDatabase, importDatabase, getSetting, setSetting } from './db.js';

const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const BACKUP_NAME = 'mafia-desk-backup.json';

let tokenClient = null;
let accessToken = null;
let profile = null;

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_URL;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Не вдалося завантажити Google Identity Services'));
    document.head.append(script);
  });
}

export async function configureGoogle(clientId) {
  if (!clientId) throw new Error('Спочатку вкажіть Google OAuth Client ID');
  await setSetting('googleClientId', clientId.trim());
  await loadScript();
  return clientId.trim();
}

export async function signInGoogle() {
  const clientId = await getSetting('googleClientId', '');
  if (!clientId) throw new Error('Google OAuth Client ID не налаштовано');
  await loadScript();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: async response => {
        if (response.error) return reject(new Error(response.error_description || response.error));
        accessToken = response.access_token;
        try {
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!userResponse.ok) throw new Error('Не вдалося отримати профіль Google');
          profile = await userResponse.json();
          resolve(profile);
        } catch (error) { reject(error); }
      },
      error_callback: error => reject(new Error(error.message || 'Авторизацію скасовано'))
    });
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
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

export function getGoogleSession() {
  return { signedIn: Boolean(accessToken), profile };
}

export function signOutGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  profile = null;
}
