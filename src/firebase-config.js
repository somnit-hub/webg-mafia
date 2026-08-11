/*
 * Public Firebase web configuration for Mafia.
 * Fill this object from Firebase Console → Project settings → Your apps → Web app.
 * Firebase web API keys identify the project; they are not service-account secrets.
 */
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyCTn_hp0SkDibKJ3IP6OZENOpQATahFYQM',
  authDomain: 'mafia-cafe.web.app',
  projectId: 'somnit-mafia-desk',
  appId: '1:116889481212:web:e4ba574345d7c8e7f70c79'
});

export function hasFirebaseConfig() {
  return ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => Boolean(FIREBASE_CONFIG[key]));
}
