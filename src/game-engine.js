import { normalizeGameMusicSettings } from './game-music.js';

export const ACTIVE_GAME_PHASES = Object.freeze([
  'reveal', 'zeroNight', 'day', 'vote', 'tieSpeech', 'tieVote',
  'allTie', 'lastWord', 'bestMove', 'night'
]);

const ACTIVE_PHASE_SET = new Set(ACTIVE_GAME_PHASES);
const ROLE_KEYS = new Set(['citizen', 'sheriff', 'mafia', 'don']);

function integer(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomIndex(maximum, cryptoSource = globalThis.crypto) {
  if (maximum <= 1) return 0;
  if (!cryptoSource?.getRandomValues) return Math.floor(Math.random() * maximum);
  const range = 0x100000000;
  const limit = range - (range % maximum);
  const buffer = new Uint32Array(1);
  do cryptoSource.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % maximum;
}

export function secureShuffle(values, cryptoSource = globalThis.crypto) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const random = randomIndex(index + 1, cryptoSource);
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

export function createNumberRoleDeal(roleKeys, cryptoSource = globalThis.crypto) {
  const roles = Array.isArray(roleKeys) ? roleKeys.filter(role => ROLE_KEYS.has(role)) : [];
  if (roles.length !== roleKeys?.length) throw new Error('Колода містить некоректну роль');
  return { mode: 'number', remainingRoles: secureShuffle(roles, cryptoSource), selectedCard: null };
}

export function selectNumberRoleCard(roleDeal, cardNumber) {
  const remainingRoles = Array.isArray(roleDeal?.remainingRoles) ? [...roleDeal.remainingRoles] : [];
  const selectedCard = Number(cardNumber);
  if (!Number.isInteger(selectedCard) || selectedCard < 1 || selectedCard > remainingRoles.length) {
    throw new Error(`Залишилося ${remainingRoles.length} карт: гравець має обрати число від 1 до ${remainingRoles.length}`);
  }
  return { mode: 'number', remainingRoles, selectedCard };
}

export function takeNumberRoleCard(roleDeal, cardNumber = roleDeal?.selectedCard) {
  const selected = selectNumberRoleCard(roleDeal, cardNumber);
  const remainingRoles = [...selected.remainingRoles];
  const [role] = remainingRoles.splice(selected.selectedCard - 1, 1);
  return {
    role,
    cardNumber: selected.selectedCard,
    roleDeal: { mode: 'number', remainingRoles, selectedCard: null }
  };
}

export function teamForRole(role) {
  return ['don', 'mafia'].includes(role) ? 'black' : ['citizen', 'sheriff'].includes(role) ? 'red' : null;
}

export function victoryForSeats(seats = []) {
  const alive = seats.filter(seat => seat.status === 'alive');
  const black = alive.filter(seat => teamForRole(seat.role) === 'black').length;
  const red = alive.filter(seat => teamForRole(seat.role) === 'red').length;
  if (black === 0 && red > 0) return 'red';
  if (black >= red && black > 0) return 'black';
  return null;
}

export function resolveVote({ candidates = [], counts = {}, voterCount = 0, phase = 'vote', previousTieKey = '' } = {}) {
  const uniqueCandidates = [...new Set(candidates.map(Number).filter(number => Number.isInteger(number) && number >= 1 && number <= 10))];
  if (!uniqueCandidates.length) return { kind: 'invalid', message: 'Немає кандидатів для голосування' };
  const used = uniqueCandidates.reduce((sum, number) => sum + Math.max(0, Number(counts[number]) || 0), 0);
  if (used !== voterCount) return {
    kind: 'invalid',
    message: used > voterCount ? 'Голосів більше, ніж виборців' : `Не зафіксовано ${voterCount - used} голосів`,
    used
  };
  const maximum = Math.max(...uniqueCandidates.map(number => Math.max(0, Number(counts[number]) || 0)));
  const tied = uniqueCandidates.filter(number => (Math.max(0, Number(counts[number]) || 0)) === maximum);
  if (tied.length === 1) return { kind: 'eliminate', number: tied[0], used };
  const tieKey = [...tied].sort((left, right) => left - right).join('-');
  if (phase === 'tieVote' && tieKey === previousTieKey) return { kind: 'allTie', tied, tieKey, used };
  return { kind: 'tieSpeech', tied, tieKey, used };
}

export function canLiftTiedCandidates({ day = 1, aliveCount = 10, tiedCount = 0 } = {}) {
  const alive = integer(aliveCount, 0, 10);
  const tied = integer(tiedCount, 0, 10);
  if (tied < 2 || tied > alive / 2) return false;
  if (Number(day) === 1 && tied > 2) return false;
  if (alive === 9 && tied === 3 && Number(day) < 3) return false;
  if (alive === 10 && tied === 5 && Number(day) < 2) return false;
  return true;
}

export function nominationIsAllowed(game, targetNumber, speakerNumber) {
  const target = Number(targetNumber);
  const speaker = Number(speakerNumber);
  if (!game || game.phase !== 'day' || game.subphase !== 'speeches') return false;
  if (!Number.isInteger(target) || !Number.isInteger(speaker)) return false;
  const targetSeat = game.seats?.find(seat => seat.number === target);
  const speakerSeat = game.seats?.find(seat => seat.number === speaker);
  if (targetSeat?.status !== 'alive' || speakerSeat?.status !== 'alive') return false;
  if ((game.nominations || []).map(Number).includes(target)) return false;
  return !game.seats.some(seat => Number(seat.nominatedBy) === speaker);
}

export function nightTargetIsAllowed(game, number) {
  const seatNumber = Number(number);
  if (!game || game.phase !== 'night' || ![1, 2, 3].includes(game.night?.step)) return false;
  return Boolean(game.seats?.find(seat => seat.number === seatNumber && seat.status === 'alive'));
}

export function toggleBestMoveCandidate(selected = [], number, allowedNumbers = [], maximum = 3) {
  const seatNumber = Number(number);
  const allowed = new Set(allowedNumbers.map(Number));
  const current = [...new Set(selected.map(Number).filter(value => allowed.has(value)))];
  if (!allowed.has(seatNumber)) return current;
  if (current.includes(seatNumber)) return current.filter(value => value !== seatNumber);
  return current.length < maximum ? [...current, seatNumber] : current;
}

export function normalizeGameState(value, defaultSettings = {}, { closeReveal = false, now = Date.now() } = {}) {
  if (!value || typeof value !== 'object') return value;
  const game = clone(value);
  const savedDealMode = ['number', 'automatic'].includes(value.settings?.dealMode) ? value.settings.dealMode : null;
  const storedRoleDealMode = value.roleDeal?.mode === 'number' ? 'number' : null;
  game.settings = { ...defaultSettings, ...(game.settings || {}) };
  game.settings.music = normalizeGameMusicSettings(game.settings.music);
  game.status = game.status === 'finished' ? 'finished' : 'active';
  game.phase = game.status === 'finished'
    ? 'finished'
    : ACTIVE_PHASE_SET.has(game.phase) ? game.phase : 'reveal';
  game.day = integer(game.day || 1, 1, 100);
  game.seats = Array.isArray(game.seats) ? game.seats.slice(0, 10).map((seat, index) => ({
    ...seat,
    number: index + 1,
    role: ROLE_KEYS.has(seat.role) ? seat.role : null,
    status: seat.status === 'dead' ? 'dead' : 'alive',
    faults: integer(seat.faults, 0, 4),
    noVote: Boolean(seat.noVote),
    nominatedBy: Number.isInteger(Number(seat.nominatedBy)) ? Number(seat.nominatedBy) : null,
    eliminatedReason: String(seat.eliminatedReason || '')
  })) : [];
  const allSeatsAlreadyHaveRoles = game.seats.length > 0 && game.seats.every(seat => ROLE_KEYS.has(seat.role));
  game.settings.dealMode = storedRoleDealMode || savedDealMode || (game.phase === 'reveal' && allSeatsAlreadyHaveRoles ? 'automatic' : 'number');
  if (game.phase === 'reveal' && game.settings.dealMode === 'number') {
    const remainingRoles = Array.isArray(game.roleDeal?.remainingRoles)
      ? game.roleDeal.remainingRoles.filter(role => ROLE_KEYS.has(role)).slice(0, 10)
      : [];
    const selectedCard = Number(game.roleDeal?.selectedCard);
    game.roleDeal = {
      mode: 'number',
      remainingRoles,
      selectedCard: closeReveal || !Number.isInteger(selectedCard) || selectedCard < 1 || selectedCard > remainingRoles.length
        ? null
        : selectedCard
    };
  } else {
    delete game.roleDeal;
  }
  const aliveNumbers = new Set(game.seats.filter(seat => seat.status === 'alive').map(seat => seat.number));
  game.revealIndex = integer(game.revealIndex, 0, Math.max(0, game.seats.length - 1));
  game.revealOpen = closeReveal ? false : Boolean(game.revealOpen);
  game.zeroNight = { step: integer(game.zeroNight?.step, 0, 2) };
  game.speakerOrder = Array.isArray(game.speakerOrder)
    ? game.speakerOrder.map(Number).filter(number => aliveNumbers.has(number))
    : [];
  game.speakerIndex = integer(game.speakerIndex, 0, Math.max(0, game.speakerOrder.length - 1));
  game.nominations = [...new Set((game.nominations || []).map(Number).filter(number => aliveNumbers.has(number)))];
  game.vote = {
    counts: game.vote?.counts && typeof game.vote.counts === 'object' ? game.vote.counts : {},
    tied: [...new Set((game.vote?.tied || []).map(Number).filter(number => aliveNumbers.has(number)))],
    tieKey: String(game.vote?.tieKey || ''),
    tieRound: integer(game.vote?.tieRound, 0, 10),
    yes: integer(game.vote?.yes, 0, 10),
    no: integer(game.vote?.no, 0, 10)
  };
  const validNightTarget = target => target === -1 || aliveNumbers.has(Number(target)) ? Number(target) : null;
  game.night = {
    step: integer(game.night?.step, 0, 4),
    target: validNightTarget(game.night?.target),
    donCheck: validNightTarget(game.night?.donCheck),
    sheriffCheck: validNightTarget(game.night?.sheriffCheck),
    resultOpen: false
  };
  const bestMoveSeat = integer(game.bestMove?.seat || game.lastWordSeat, 0, 10);
  game.bestMove = {
    seat: bestMoveSeat || null,
    selected: [...new Set((game.bestMove?.selected || []).map(Number).filter(number => aliveNumbers.has(number)))].slice(0, 3)
  };
  const timerWasRunning = Boolean(game.timer?.running);
  const timerEndsAt = Number(game.timer?.endsAt);
  const recoveredRemaining = timerWasRunning && Number.isFinite(timerEndsAt)
    ? Math.max(0, Math.ceil((timerEndsAt - Number(now)) / 1000))
    : Math.max(0, Math.ceil(Number(game.timer?.remaining) || 0));
  game.timer = {
    remaining: recoveredRemaining,
    running: Boolean(game.timer?.running),
    purpose: String(game.timer?.purpose || 'speech'),
    ...(Number.isFinite(timerEndsAt) ? { endsAt: timerEndsAt } : {})
  };
  if (closeReveal || !game.timer.running) {
    game.timer.running = false;
    delete game.timer.endsAt;
  }
  game.pendingLastWords = Array.isArray(game.pendingLastWords) ? game.pendingLastWords.map(Number).filter(number => number >= 1 && number <= 10) : [];
  game.pendingWinner = ['lastWord', 'bestMove'].includes(game.phase) ? victoryForSeats(game.seats) : null;
  game.history = Array.isArray(game.history) ? game.history : [];
  return game;
}

export function gameStateErrors(game) {
  const errors = [];
  if (!game || typeof game !== 'object') return ['Стан гри відсутній'];
  if (!['active', 'finished'].includes(game.status)) errors.push('Некоректний статус гри');
  if (game.status === 'active' && !ACTIVE_PHASE_SET.has(game.phase)) errors.push('Некоректна фаза гри');
  if (!Array.isArray(game.seats) || game.seats.length !== 10) errors.push('За столом повинно бути 10 місць');
  const numbers = (game.seats || []).map(seat => seat.number);
  if (new Set(numbers).size !== numbers.length || numbers.some((number, index) => number !== index + 1)) errors.push('Номери місць пошкоджено');
  if (!game.publicOnly) {
    const numberDealInProgress = game.phase === 'reveal' && game.settings?.dealMode === 'number';
    const seatRoles = (game.seats || []).map(seat => seat.role).filter(role => ROLE_KEYS.has(role));
    const remainingRoles = numberDealInProgress && Array.isArray(game.roleDeal?.remainingRoles)
      ? game.roleDeal.remainingRoles
      : [];
    const roles = numberDealInProgress ? [...seatRoles, ...remainingRoles] : seatRoles;
    const roleCounts = role => roles.filter(value => value === role).length;
    if (roleCounts('don') !== 1 || roleCounts('sheriff') !== 1 || roleCounts('mafia') !== 2 || roleCounts('citizen') !== 6) {
      errors.push('Склад ролей повинен бути 6+1 червоних і 2+1 чорних');
    }
    if (numberDealInProgress) {
      const emptySeats = (game.seats || []).filter(seat => !ROLE_KEYS.has(seat.role)).length;
      if (emptySeats !== remainingRoles.length) errors.push('Кількість нерозданих карт не відповідає кількості гравців');
      const selectedCard = game.roleDeal?.selectedCard;
      if (selectedCard != null && (!Number.isInteger(selectedCard) || selectedCard < 1 || selectedCard > remainingRoles.length)) {
        errors.push('Обрана карта вже недоступна');
      }
    }
  }
  const determinedWinner = victoryForSeats(game.seats || []);
  if (game.status === 'active' && game.phase !== 'reveal' && determinedWinner && !['lastWord', 'bestMove'].includes(game.phase)) {
    errors.push('Переможця вже визначено, але гра не перейшла до прощальної промови або фіналу');
  }
  if (game.phase === 'night') {
    for (const target of [game.night?.target, game.night?.donCheck, game.night?.sheriffCheck]) {
      if (target != null && target !== -1 && !game.seats?.some(seat => seat.number === Number(target) && seat.status === 'alive')) {
        errors.push('Нічна ціль уже вибула');
        break;
      }
    }
  }
  return errors;
}
