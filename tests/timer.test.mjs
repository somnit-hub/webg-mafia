import assert from 'node:assert/strict';
import { adjustTimerBy, crossedCountdownWarning, timerRemainingAt } from '../src/timer.js';

const now = 1_000_000;
const running = { remaining: 60, running: true, purpose: 'speech', endsAt: now + 60_000 };

assert.equal(timerRemainingAt(running, now + 20_400), 40);

const plusFive = adjustTimerBy(running, 5, now + 20_400);
assert.equal(plusFive.previous, 40);
assert.equal(plusFive.remaining, 45);
assert.equal(plusFive.timer.endsAt, now + 20_400 + 45_000);
assert.equal(timerRemainingAt(plusFive.timer, now + 21_500), 44);

const minusFive = adjustTimerBy(running, -5, now + 20_400);
assert.equal(minusFive.remaining, 35);
assert.equal(minusFive.timer.endsAt, now + 20_400 + 35_000);

const crossesTen = adjustTimerBy({ ...running, endsAt: now + 14_000 }, -5, now);
assert.equal(crossesTen.remaining, 9);
assert.equal(crossesTen.crossedWarning, true);
assert.equal(crossedCountdownWarning(11, 10), true);
assert.equal(crossedCountdownWarning(10, 9), false);

const reachesZero = adjustTimerBy({ ...running, remaining: 3, endsAt: now + 3_000 }, -5, now);
assert.equal(reachesZero.remaining, 0);
assert.equal(reachesZero.timer.endsAt, now);
assert.equal(reachesZero.completed, true);

const paused = adjustTimerBy({ remaining: 30, running: false, purpose: 'speech', endsAt: now + 99_000 }, 5, now);
assert.equal(paused.remaining, 35);
assert.equal('endsAt' in paused.timer, false);
