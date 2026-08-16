import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canLiftTiedCandidates, createNumberRoleDeal, gameStateErrors, nightTargetIsAllowed, nominationIsAllowed, normalizeGameState, resolveVote,
  secureShuffle, selectNumberRoleCard, takeNumberRoleCard, toggleBestMoveCandidate, victoryForSeats
} from '../src/game-engine.js';

function seats() {
  const roles = ['don', 'mafia', 'mafia', 'sheriff', ...Array(6).fill('citizen')];
  return roles.map((role, index) => ({
    number: index + 1,
    name: `Гравець ${index + 1}`,
    role,
    status: 'alive',
    faults: 0,
    noVote: false,
    eliminatedReason: ''
  }));
}

function game(overrides = {}) {
  return {
    id: 'game_test', status: 'active', phase: 'night', day: 1,
    settings: { speech: 60, nightCheck: 10 }, seats: seats(),
    nominations: [], speakerOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], speakerIndex: 0,
    vote: { counts: {}, tied: [], tieKey: '', yes: 0, no: 0 },
    night: { step: 1, target: null, donCheck: null, sheriffCheck: null, resultOpen: false },
    timer: { remaining: 10, running: false, purpose: 'night' }, history: [],
    ...overrides
  };
}

test('secure role shuffle preserves every card', () => {
  const deck = ['sheriff', 'don', 'mafia', 'mafia', ...Array(6).fill('citizen')];
  const shuffled = secureShuffle(deck);
  assert.equal(shuffled.length, 10);
  assert.deepEqual([...shuffled].sort(), [...deck].sort());
});

test('number role deal removes the selected card and renumbers the remaining deck', () => {
  const deck = ['sheriff', 'don', 'mafia', 'mafia', ...Array(6).fill('citizen')];
  const predictableCrypto = { getRandomValues(buffer) { buffer[0] = 0; return buffer; } };
  const roleDeal = createNumberRoleDeal(deck, predictableCrypto);
  assert.equal(roleDeal.remainingRoles.length, 10);
  const selected = selectNumberRoleCard(roleDeal, 4);
  assert.equal(selected.selectedCard, 4);
  const dealt = takeNumberRoleCard(selected);
  assert.equal(dealt.cardNumber, 4);
  assert.equal(dealt.role, roleDeal.remainingRoles[3]);
  assert.equal(dealt.roleDeal.remainingRoles.length, 9);
  assert.deepEqual(dealt.roleDeal.remainingRoles, roleDeal.remainingRoles.filter((_, index) => index !== 3));
  assert.equal(dealt.roleDeal.selectedCard, null);
});

test('number role deal rejects a gesture beyond the cards that remain', () => {
  const roleDeal = { mode: 'number', remainingRoles: ['don', 'citizen', 'sheriff'], selectedCard: null };
  assert.throws(() => selectNumberRoleCard(roleDeal, 4), /від 1 до 3/);
  assert.throws(() => selectNumberRoleCard(roleDeal, 0), /від 1 до 3/);
  const last = takeNumberRoleCard({ mode: 'number', remainingRoles: ['don'], selectedCard: null }, 1);
  assert.equal(last.role, 'don');
  assert.deepEqual(last.roleDeal.remainingRoles, []);
});

test('victory is detected only at city clear or black parity', () => {
  const table = seats();
  assert.equal(victoryForSeats(table), null);
  table.filter(seat => ['don', 'mafia'].includes(seat.role)).forEach(seat => { seat.status = 'dead'; });
  assert.equal(victoryForSeats(table), 'red');

  const parity = seats();
  parity.filter(seat => seat.number > 6).forEach(seat => { seat.status = 'dead'; });
  assert.equal(victoryForSeats(parity), 'black');
});

test('vote resolver covers elimination, first tie and repeated tie', () => {
  assert.deepEqual(resolveVote({ candidates: [2, 5], counts: { 2: 6, 5: 4 }, voterCount: 10 }), {
    kind: 'eliminate', number: 2, used: 10
  });
  assert.deepEqual(resolveVote({ candidates: [2, 5], counts: { 2: 5, 5: 5 }, voterCount: 10 }), {
    kind: 'tieSpeech', tied: [2, 5], tieKey: '2-5', used: 10
  });
  assert.deepEqual(resolveVote({ candidates: [2, 5], counts: { 2: 5, 5: 5 }, voterCount: 10, phase: 'tieVote', previousTieKey: '2-5' }), {
    kind: 'allTie', tied: [2, 5], tieKey: '2-5', used: 10
  });
  assert.match(resolveVote({ candidates: [2, 5], counts: { 2: 4, 5: 4 }, voterCount: 10 }).message, /2 голосів/);
});

test('all-candidate lift follows first-day and critical-table restrictions', () => {
  assert.equal(canLiftTiedCandidates({ day: 1, aliveCount: 10, tiedCount: 2 }), true);
  assert.equal(canLiftTiedCandidates({ day: 1, aliveCount: 10, tiedCount: 5 }), false);
  assert.equal(canLiftTiedCandidates({ day: 2, aliveCount: 10, tiedCount: 5 }), true);
  assert.equal(canLiftTiedCandidates({ day: 2, aliveCount: 9, tiedCount: 3 }), false);
  assert.equal(canLiftTiedCandidates({ day: 3, aliveCount: 9, tiedCount: 3 }), true);
  assert.equal(canLiftTiedCandidates({ day: 3, aliveCount: 6, tiedCount: 4 }), false);
});

test('a player may nominate themselves but may nominate only once per day', () => {
  const state = game({ phase: 'day', subphase: 'speeches' });
  assert.equal(nominationIsAllowed(state, 1, 1), true);
  assert.equal(nominationIsAllowed(state, 2, 1), true);
  state.nominations = [1];
  state.seats[0].nominatedBy = 1;
  assert.equal(nominationIsAllowed(state, 1, 1), false);
  assert.equal(nominationIsAllowed(state, 2, 1), false);
});

test('night actions reject eliminated targets', () => {
  const state = game();
  state.seats[4].status = 'dead';
  assert.equal(nightTargetIsAllowed(state, 4), true);
  assert.equal(nightTargetIsAllowed(state, 5), false);
  state.night.step = 4;
  assert.equal(nightTargetIsAllowed(state, 4), false);
});

test('mafia shooting may target a living black teammate', () => {
  const state = game();
  assert.equal(state.seats[0].role, 'don');
  assert.equal(state.seats[1].role, 'mafia');
  assert.equal(nightTargetIsAllowed(state, 1), true);
  assert.equal(nightTargetIsAllowed(state, 2), true);
});

test('best move keeps three unique living candidates in spoken order', () => {
  const allowed = [1, 2, 3, 4, 5];
  let selected = toggleBestMoveCandidate([], 3, allowed);
  selected = toggleBestMoveCandidate(selected, 1, allowed);
  selected = toggleBestMoveCandidate(selected, 5, allowed);
  selected = toggleBestMoveCandidate(selected, 4, allowed);
  assert.deepEqual(selected, [3, 1, 5]);
  assert.deepEqual(toggleBestMoveCandidate(selected, 1, allowed), [3, 5]);
  assert.deepEqual(toggleBestMoveCandidate(selected, 8, allowed), selected);
});

test('persisted game recovery closes role and check results and removes dead targets', () => {
  const state = game({
    phase: 'reveal', revealOpen: true,
    night: { step: 3, target: 5, donCheck: 5, sheriffCheck: 5, resultOpen: true },
    timer: { remaining: 7, running: true, purpose: 'night', endsAt: Date.now() + 7000 }
  });
  state.seats[4].status = 'dead';
  const normalized = normalizeGameState(state, { bestMove: 20 }, { closeReveal: true });
  assert.equal(normalized.revealOpen, false);
  assert.equal(normalized.night.resultOpen, false);
  assert.equal(normalized.night.target, null);
  assert.equal(normalized.night.donCheck, null);
  assert.equal(normalized.night.sheriffCheck, null);
  assert.equal(normalized.timer.running, false);
  assert.equal(normalized.settings.bestMove, 20);
});

test('persisted number deal keeps progress but closes the role and clears a pending tap', () => {
  const state = game({
    phase: 'reveal',
    settings: { speech: 60, nightCheck: 10, dealMode: 'number' },
    seats: seats().map((seat, index) => ({ ...seat, role: index < 2 ? seat.role : null })),
    revealIndex: 2,
    revealOpen: true,
    roleDeal: { mode: 'number', remainingRoles: seats().slice(2).map(seat => seat.role), selectedCard: 5 }
  });
  const recovered = normalizeGameState(state, {}, { closeReveal: true });
  assert.equal(recovered.revealIndex, 2);
  assert.equal(recovered.revealOpen, false);
  assert.equal(recovered.roleDeal.selectedCard, null);
  assert.equal(recovered.roleDeal.remainingRoles.length, 8);
  assert.deepEqual(gameStateErrors(recovered), []);
});

test('persisted running timer is paused at its real remaining time after recovery', () => {
  const state = game();
  state.timer = { remaining: 60, running: true, purpose: 'speech', endsAt: 130_000 };
  const recovered = normalizeGameState(state, {}, { closeReveal: true, now: 100_000 });
  assert.deepEqual(recovered.timer, { remaining: 30, running: false, purpose: 'speech' });
});

test('a decisive departure defers the result only through the farewell phase', () => {
  const state = game({ phase: 'lastWord' });
  state.seats.filter(seat => seat.role === 'citizen' || seat.role === 'sheriff').slice(0, 4)
    .forEach(seat => { seat.status = 'dead'; });
  const recovered = normalizeGameState(state);
  assert.equal(victoryForSeats(recovered.seats), 'black');
  assert.equal(recovered.pendingWinner, 'black');
  assert.deepEqual(gameStateErrors(recovered), []);

  recovered.phase = 'day';
  assert.match(gameStateErrors(recovered).join(' '), /Переможця вже визначено/);
});

test('valid private game state has an exact sports role deck', () => {
  assert.deepEqual(gameStateErrors(game()), []);
  const broken = game();
  broken.seats[0].role = 'citizen';
  assert.match(gameStateErrors(broken).join(' '), /Склад ролей/);
});
