import { FIREBASE_CONFIG, hasFirebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '12.16.0';
const APP_SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const AUTH_SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let sdkPromise = null;
let auth = null;
let firebaseUser = null;
let stopObserver = null;

function publicUser(user) {
  if (!user) return null;
  const googleProfile = user.providerData?.find(item => item.providerId === 'google.com');
  return {
    uid: user.uid,
    email: user.email || googleProfile?.email || '',
    emailVerified: Boolean(user.emailVerified),
    googleName: user.displayName || googleProfile?.displayName || '',
    googlePhotoURL: user.photoURL || googleProfile?.photoURL || '',
    providerId: 'google.com'
  };
}

async function loadFirebase() {
  if (!hasFirebaseConfig()) return null;
  if (!sdkPromise) {
    sdkPromise = Promise.all([import(APP_SDK), import(AUTH_SDK)]).then(([appSdk, authSdk]) => ({ appSdk, authSdk }));
  }
  return sdkPromise;
}

function authError(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Вхід скасовано',
    'auth/popup-blocked': 'Браузер заблокував вікно Google. Дозвольте спливаючі вікна та повторіть дію',
    'auth/cancelled-popup-request': 'Вікно входу вже відкрите',
    'auth/network-request-failed': 'Немає мережі для нового входу Google',
    'auth/unauthorized-domain': 'Цей домен не дозволений для Google-входу',
    'auth/operation-not-allowed': 'Google-вхід ще не увімкнений',
    'auth/user-mismatch': 'Потрібно вибрати той самий Google-акаунт',
    'auth/requires-recent-login': 'Повторно підтвердьте Google-акаунт і спробуйте ще раз'
  };
  return new Error(messages[error?.code] || error?.message || 'Не вдалося виконати Google-вхід');
}

function googleProvider(authSdk, { drive = false } = {}) {
  const provider = new authSdk.GoogleAuthProvider();
  if (drive) provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters(drive
    ? { login_hint: firebaseUser?.email || '', prompt: 'consent' }
    : { prompt: 'select_account' });
  return provider;
}

export function isGoogleAuthConfigured() {
  return hasFirebaseConfig();
}

export function getAuthUser() {
  return publicUser(firebaseUser);
}

export async function getFirebaseIdToken() {
  if (!auth?.currentUser) throw new Error('Спочатку увійдіть через Google');
  return auth.currentUser.getIdToken();
}

export async function initializeGoogleAuth() {
  if (!hasFirebaseConfig()) return { configured: false, user: null };
  try {
    const { appSdk, authSdk } = await loadFirebase();
    const firebaseApp = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
    auth = authSdk.getAuth(firebaseApp);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    await authSdk.getRedirectResult(auth).catch(error => { throw authError(error); });
    firebaseUser = await new Promise((resolve, reject) => {
      let unsubscribe = null;
      unsubscribe = authSdk.onAuthStateChanged(auth, user => {
        unsubscribe?.();
        resolve(user);
      }, reject);
    });
    return { configured: true, user: publicUser(firebaseUser) };
  } catch (error) {
    throw authError(error);
  }
}

export async function signInWithGoogle() {
  if (!auth) await initializeGoogleAuth();
  const { authSdk } = await loadFirebase();
  try {
    const result = await authSdk.signInWithPopup(auth, googleProvider(authSdk));
    firebaseUser = result.user;
    return publicUser(firebaseUser);
  } catch (error) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
      await authSdk.signInWithRedirect(auth, googleProvider(authSdk));
      return null;
    }
    throw authError(error);
  }
}

export async function authorizeGoogleDrive() {
  if (!auth?.currentUser) throw new Error('Спочатку увійдіть через Google');
  const { authSdk } = await loadFirebase();
  try {
    const result = await authSdk.reauthenticateWithPopup(auth.currentUser, googleProvider(authSdk, { drive: true }));
    const credential = authSdk.GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('Google не надав доступ до резервної копії');
    firebaseUser = result.user;
    return credential.accessToken;
  } catch (error) {
    throw authError(error);
  }
}

export async function reauthenticateGoogleAccount() {
  if (!auth?.currentUser) throw new Error('Спочатку увійдіть через Google');
  const { authSdk } = await loadFirebase();
  try {
    const result = await authSdk.reauthenticateWithPopup(auth.currentUser, googleProvider(authSdk));
    firebaseUser = result.user;
    return publicUser(firebaseUser);
  } catch (error) {
    throw authError(error);
  }
}

export async function deleteGoogleAccount() {
  if (!auth?.currentUser) throw new Error('Google-сесію вже завершено');
  const { authSdk } = await loadFirebase();
  try {
    await authSdk.deleteUser(auth.currentUser);
    firebaseUser = null;
  } catch (error) {
    throw authError(error);
  }
}

export async function signOutGoogleAccount() {
  if (!auth) return;
  const { authSdk } = await loadFirebase();
  await authSdk.signOut(auth);
  firebaseUser = null;
}

export async function observeGoogleAuth(callback) {
  if (!auth) return () => {};
  const { authSdk } = await loadFirebase();
  let initialUid = auth.currentUser?.uid || null;
  stopObserver?.();
  stopObserver = authSdk.onAuthStateChanged(auth, user => {
    firebaseUser = user;
    const nextUid = user?.uid || null;
    if (nextUid !== initialUid) {
      initialUid = nextUid;
      callback(publicUser(user));
    }
  });
  return stopObserver;
}
