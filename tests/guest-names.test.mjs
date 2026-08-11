import assert from 'node:assert/strict';
import { FUNNY_GUEST_NAMES, pickFunnyGuestNames } from '../src/guest-names.js';

const tenGuests = pickFunnyGuestNames(10, [], () => 0.42);
assert.equal(tenGuests.length, 10);
assert.equal(new Set(tenGuests).size, 10);
assert.ok(tenGuests.every(name => FUNNY_GUEST_NAMES.includes(name)));
assert.ok(tenGuests.every(name => !/^Гравець \d+$/.test(name)));

const realGivenNames = [
  'Богдан', 'Галя', 'Тарас', 'Марічка', 'Василь', 'Люба', 'Славко', 'Петро',
  'Оксана', 'Ігор', 'Леся', 'Роман', 'Зіна', 'Гриць', 'Назар', 'Павло', 'Марта',
  'Семен', 'Ярема', 'Віра', 'Степан', 'Катя', 'Антон', 'Ліда', 'Дмитро', 'Соня',
  'Федір', 'Уляна', 'Максим', 'Борис', 'Михась', 'Оля', 'Денис', 'Соломія'
];
assert.equal(FUNNY_GUEST_NAMES.length, 60);
assert.equal(new Set(FUNNY_GUEST_NAMES).size, FUNNY_GUEST_NAMES.length);
assert.ok(FUNNY_GUEST_NAMES.every(nickname => /^\S+$/u.test(nickname)));
assert.ok(FUNNY_GUEST_NAMES.every(nickname => realGivenNames.every(name => !new RegExp(`(^|\\s)${name}(\\s|$)`, 'u').test(nickname))));

const excluded = FUNNY_GUEST_NAMES.slice(0, 5);
const withoutExcluded = pickFunnyGuestNames(10, excluded, () => 0.13);
assert.ok(withoutExcluded.every(name => !excluded.includes(name)));

assert.deepEqual(pickFunnyGuestNames(0), []);
assert.ok(pickFunnyGuestNames(65, [], () => 0.5).every(nickname => /^\S+$/u.test(nickname)));
console.log('Funny guest name generator passed.');
