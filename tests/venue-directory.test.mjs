import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommunityVenueFields, isCommunityVenueAdmin } from '../src/cloud-venues.js';
import { filterVenues, gameTitleForVenue, googleMapsVenueSuggestion, normalizeVenueInput, venuePickerOptions } from '../src/venue-directory.js';

test('venue model stores the requested public contact fields for an authorized user', () => {
  const fields = createCommunityVenueFields(
    { uid: 'user-1', emailVerified: true, googleName: 'Анна' },
    { nickname: 'Лисиця' },
    {
      name: ' Mafia Club Kyiv ',
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mafia+Club%2C+Kyiv',
      address: ' Київ, Хрещатик, 1 ',
      phone: '+380 00 000 00 00',
      website: 'https://example.com/club'
    },
    'venue-1'
  );

  assert.equal(fields.name, 'Mafia Club Kyiv');
  assert.equal(fields.address, 'Київ, Хрещатик, 1');
  assert.equal(fields.createdByUid, 'user-1');
  assert.equal(fields.createdByName, 'Лисиця');
  assert.equal(fields.schemaVersion, 1);
});

test('Google Maps search URL suggests its encoded address and place URL suggests its name', () => {
  const search = googleMapsVenueSuggestion('https://www.google.com/maps/search/?api=1&query=Enjoy%2C+Kyiv%2C+48+Street');
  const place = googleMapsVenueSuggestion('https://www.google.com/maps/place/Mafia+Club/data=!4m2!3m1!1s0x0:0x1');

  assert.equal(search.valid, true);
  assert.equal(search.address, 'Enjoy, Kyiv, 48 Street');
  assert.equal(place.name, 'Mafia Club');
  assert.equal(googleMapsVenueSuggestion('https://example.com/maps').valid, false);
  assert.equal(googleMapsVenueSuggestion('https://google.evil.com/maps').valid, false);
});

test('venue search matches names and addresses and auto-title uses selected venue', () => {
  const venues = [
    { id: '1', name: 'Enjoy', address: 'Київ, Здановської 48' },
    { id: '2', name: 'Mafia Club', address: 'Львів, Центр' }
  ];
  assert.deepEqual(filterVenues(venues, 'львів').map(venue => venue.id), ['2']);
  assert.equal(gameTitleForVenue('Mafia Club', new Date(2026, 7, 16, 19, 30)), 'Mafia Club · 16.08 · 19:30');
});

test('opening a selected venue shows the full directory while typed search still filters it', () => {
  const venues = [
    { id: 'enjoy', name: 'Enjoy', address: 'Київ' },
    { id: 'mafia', name: 'Mafia Club', address: 'Львів' }
  ];
  assert.deepEqual(
    venuePickerOptions(venues, 'Enjoy', { open: true, selectedId: 'enjoy', selectedName: 'Enjoy' }).map(venue => venue.id),
    ['enjoy', 'mafia']
  );
  assert.deepEqual(
    venuePickerOptions(venues, 'львів', { open: true, selectedId: '', selectedName: 'Enjoy' }).map(venue => venue.id),
    ['mafia']
  );
});

test('venue validation rejects non-Google map links and unsafe website protocols', () => {
  assert.throws(() => normalizeVenueInput({ name: 'Club', googleMapsUrl: 'https://example.com/not-google' }), /Google Maps/);
  assert.throws(() => normalizeVenueInput({ name: 'Club', website: 'javascript:alert(1)' }), /Сайт/);
  assert.throws(() => createCommunityVenueFields({ uid: 'user-1', emailVerified: false }, {}, { name: 'Club' }, 'venue-2'), /підтверджений/);
});

test('venue administration is limited to the verified community administrator', () => {
  assert.equal(isCommunityVenueAdmin({ email: 'somnit3d@gmail.com', emailVerified: true }), true);
  assert.equal(isCommunityVenueAdmin({ email: 'SOMNIT3D@GMAIL.COM', emailVerified: true }), true);
  assert.equal(isCommunityVenueAdmin({ email: 'somnit3d@gmail.com', emailVerified: false }), false);
  assert.equal(isCommunityVenueAdmin({ email: 'member@example.com', emailVerified: true }), false);
});
