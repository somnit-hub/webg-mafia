import { getCommunityFirestore } from './cloud-profiles.js';
import { normalizeVenueInput } from './venue-directory.js';

const COMMUNITY_ID = 'enjoy';
let stopVenues = null;

function clean(value, maximum = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function venueFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: clean(data.name, 60),
    googleMapsUrl: clean(data.googleMapsUrl, 2048),
    address: clean(data.address, 300),
    phone: clean(data.phone, 40),
    website: clean(data.website, 2048),
    createdByUid: clean(data.createdByUid, 128),
    createdByName: clean(data.createdByName, 60)
  };
}

export function createCommunityVenueFields(user, profile, venue, id) {
  if (!user?.uid || !user?.emailVerified) throw new Error('Потрібен підтверджений Google-акаунт');
  const normalized = normalizeVenueInput(venue);
  const venueId = clean(id, 160);
  if (!venueId) throw new Error('Не вдалося створити місце');
  return {
    id: venueId,
    communityId: COMMUNITY_ID,
    ...normalized,
    createdByUid: clean(user.uid, 128),
    createdByName: clean(profile?.nickname || profile?.displayName || user.googleName || 'Користувач', 60),
    schemaVersion: 1
  };
}

export async function saveCommunityVenue(user, profile, venue) {
  const { database, sdk } = await getCommunityFirestore();
  const reference = sdk.doc(sdk.collection(database, 'communities', COMMUNITY_ID, 'venues'));
  const fields = createCommunityVenueFields(user, profile, venue, reference.id);
  await sdk.setDoc(reference, {
    ...fields,
    createdAt: sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  });
  return fields;
}

export async function subscribeCommunityVenues(onVenues, onError) {
  const { database, sdk } = await getCommunityFirestore();
  stopCommunityVenues();
  const request = sdk.collection(database, 'communities', COMMUNITY_ID, 'venues');
  stopVenues = sdk.onSnapshot(request, { includeMetadataChanges: true }, snapshot => {
    onVenues(snapshot.docs.map(venueFromSnapshot).filter(venue => venue.name), {
      fromCache: snapshot.metadata.fromCache
    });
  }, error => onError?.(error));
  return stopVenues;
}

export function stopCommunityVenues() {
  stopVenues?.();
  stopVenues = null;
}
