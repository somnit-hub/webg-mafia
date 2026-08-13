const FEEDBACK_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/ratings';

export const GAME_EMOTIONS = Object.freeze([
  { key: 'brain', icon: '🤯', label: 'Мозок закипів' },
  { key: 'oscar', icon: '🎭', label: 'Оскар за брехню' },
  { key: 'fire', icon: '🔥', label: 'Стіл палав' },
  { key: 'circus', icon: '🤡', label: 'Цирк Enjoy' },
  { key: 'dead', icon: '💀', label: 'Винесли красиво' }
]);

const ROLE_TEAMS = Object.freeze({ citizen: 'red', sheriff: 'red', mafia: 'black', don: 'black' });
const localFeedback = new Map();

function feedbackKey(gameId) {
  return String(gameId || '').trim().slice(0, 160);
}

function normalizedVote(value = {}) {
  return {
    sentiment: ['up', 'down'].includes(value.sentiment) ? value.sentiment : '',
    emotion: GAME_EMOTIONS.some(item => item.key === value.emotion) ? value.emotion : ''
  };
}

function localResult(gameId, nextVote) {
  const key = feedbackKey(gameId);
  if (nextVote) localFeedback.set(key, normalizedVote(nextVote));
  const mine = localFeedback.get(key) || normalizedVote();
  return {
    mine,
    summary: {
      visible: false,
      total: mine.sentiment || mine.emotion ? 1 : 0,
      sentiment: { up: 0, down: 0 },
      emotions: Object.fromEntries(GAME_EMOTIONS.map(item => [item.key, 0]))
    }
  };
}

async function feedbackRequest({ idToken, gameId, method = 'GET', vote, testMode = false }) {
  const cleanGameId = feedbackKey(gameId);
  if (!cleanGameId) throw new Error('Гру не знайдено');
  if (testMode) return localResult(cleanGameId, method === 'POST' ? vote : null);
  if (!idToken) throw new Error('Для оцінки потрібен Google-вхід');

  const url = method === 'GET'
    ? `${FEEDBACK_ENDPOINT}?gameId=${encodeURIComponent(cleanGameId)}`
    : FEEDBACK_ENDPOINT;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
    },
    ...(method === 'POST' ? { body: JSON.stringify({ gameId: cleanGameId, ...normalizedVote(vote) }) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не вдалося завантажити оцінку гри');
  return result;
}

export function playerGameHistory(games = [], playerId = '') {
  return games
    .filter(game => game?.status === 'finished')
    .map(game => ({ game, seat: (game.seats || []).find(item => item.profileId === playerId) }))
    .filter(item => item.seat)
    .map(({ game, seat }) => ({
      game,
      seat,
      won: Boolean(game.winner && game.winner === ROLE_TEAMS[seat.role]),
      team: ROLE_TEAMS[seat.role] || ''
    }))
    .sort((left, right) => String(right.game.endedAt || right.game.updatedAt || '').localeCompare(String(left.game.endedAt || left.game.updatedAt || '')));
}

export function personalPlayerStats(games = [], playerId = '') {
  const history = playerGameHistory(games, playerId);
  const wins = history.filter(item => item.won).length;
  const roles = history.reduce((totals, item) => {
    totals[item.seat.role] = (totals[item.seat.role] || 0) + 1;
    return totals;
  }, {});
  const favoriteRole = Object.entries(roles).sort((left, right) => right[1] - left[1])[0]?.[0] || '';
  return {
    history,
    games: history.length,
    wins,
    winRate: history.length ? Math.round((wins / history.length) * 100) : 0,
    favoriteRole
  };
}

export function loadGameFeedback(options) {
  return feedbackRequest(options);
}

export async function loadGameFeedbackBatch({ idToken, gameIds = [], testMode = false }) {
  const ids = [...new Set(gameIds.map(feedbackKey).filter(Boolean))].slice(0, 25);
  if (testMode) return Object.fromEntries(ids.map(gameId => [gameId, localResult(gameId)]));
  if (!idToken) throw new Error('Для оцінки потрібен Google-вхід');
  const response = await fetch(`${FEEDBACK_ENDPOINT}/batch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameIds: ids })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не вдалося завантажити оцінки ігор');
  return result.ratings || {};
}

export function saveGameFeedback(options) {
  return feedbackRequest({ ...options, method: 'POST' });
}
