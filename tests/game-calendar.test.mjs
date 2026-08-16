import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGameCalendarMonth, currentGameCalendarMonth, normalizeGameCalendarMonth, shiftGameCalendarMonth
} from '../src/game-calendar.js';

test('calendar builds a Monday-first month and counts only finished games by start date', () => {
  const calendar = buildGameCalendarMonth([
    { status: 'finished', startedAt: '2026-08-15T18:00:00', endedAt: '2026-08-15T19:00:00' },
    { status: 'finished', startedAt: '2026-08-15T20:00:00', endedAt: '2026-08-16T00:15:00' },
    { status: 'finished', startedAt: '2026-08-16T18:00:00' },
    { status: 'active', startedAt: '2026-08-16T19:00:00' },
    { status: 'finished', startedAt: '2026-09-01T18:00:00' }
  ], { year: 2026, month: 7 });

  assert.equal(calendar.daysInMonth, 31);
  assert.equal(calendar.leadingEmptyDays, 5);
  assert.equal(calendar.cells.length, 42);
  assert.equal(calendar.cells.find(cell => cell?.day === 15).games, 2);
  assert.equal(calendar.cells.find(cell => cell?.day === 16).games, 1);
});

test('calendar month navigation crosses year boundaries and normalizes invalid input', () => {
  assert.deepEqual(shiftGameCalendarMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftGameCalendarMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(currentGameCalendarMonth(new Date(2026, 7, 17)), { year: 2026, month: 7 });
  assert.deepEqual(normalizeGameCalendarMonth({}, new Date(2026, 7, 17)), { year: 2026, month: 7 });
});
