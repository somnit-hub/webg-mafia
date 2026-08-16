const ROLE_TEAMS = Object.freeze({
  citizen: 'red',
  sheriff: 'red',
  mafia: 'black',
  don: 'black'
});

export const FIIM_RATING_RULES = Object.freeze({
  win: 1.3,
  loss: 0.3,
  draw: 0,
  bestMoveTwo: 0.5,
  bestMoveThree: 0.7,
  disqualification: -0.8,
  performanceWindow: 100
});

function rounded(value, precision = 1) {
  const scale = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

function playerKey(seat = {}) {
  const profileId = String(seat.profileId || '').trim();
  if (profileId) return profileId;
  return `guest:${String(seat.name || '').trim().toLocaleLowerCase('uk')}`;
}

function structuredBestMove(game = {}) {
  const seat = Number(game.bestMove?.seat);
  const selected = Array.isArray(game.bestMove?.selected)
    ? [...new Set(game.bestMove.selected.map(Number).filter(number => Number.isInteger(number) && number >= 1 && number <= 10))].slice(0, 3)
    : [];
  return Number.isInteger(seat) && seat >= 1 && seat <= 10 ? { seat, selected } : null;
}

function historicBestMove(game = {}) {
  const event = [...(Array.isArray(game.history) ? game.history : [])].reverse().find(item => /Кращий хід №\d+:/u.test(String(item?.text || '')));
  const match = String(event?.text || '').match(/Кращий хід №(\d+):\s*((?:№\d+(?:,\s*)?)+)/u);
  if (!match) return null;
  return {
    seat: Number(match[1]),
    selected: [...match[2].matchAll(/№(\d+)/gu)].map(item => Number(item[1])).slice(0, 3)
  };
}

export function bestMoveScore(game = {}, seat = {}) {
  const move = structuredBestMove(game) || historicBestMove(game);
  if (!move || Number(seat.number) !== move.seat || ROLE_TEAMS[seat.role] !== 'red') return { hits: 0, bonus: 0 };
  const roles = new Map((game.seats || []).map(item => [Number(item.number), ROLE_TEAMS[item.role]]));
  const hits = move.selected.filter(number => roles.get(number) === 'black').length;
  const bonus = hits >= 3 ? FIIM_RATING_RULES.bestMoveThree : hits === 2 ? FIIM_RATING_RULES.bestMoveTwo : 0;
  return { hits, bonus };
}

export function mafiaGamePoints(game = {}, seat = {}) {
  if (game.status !== 'finished' || !['red', 'black', 'draw'].includes(game.winner)) {
    return { points: 0, base: 0, bestMoveBonus: 0, disqualificationPenalty: 0 };
  }
  const team = ROLE_TEAMS[seat.role];
  if (!team) return { points: 0, base: 0, bestMoveBonus: 0, disqualificationPenalty: 0 };
  const base = game.winner === 'draw'
    ? FIIM_RATING_RULES.draw
    : game.winner === team ? FIIM_RATING_RULES.win : FIIM_RATING_RULES.loss;
  const bestMoveBonus = bestMoveScore(game, seat).bonus;
  const disqualificationPenalty = /^4-й фол$/iu.test(String(seat.eliminatedReason || '').trim())
    ? FIIM_RATING_RULES.disqualification
    : 0;
  return {
    points: rounded(base + bestMoveBonus + disqualificationPenalty),
    base,
    bestMoveBonus,
    disqualificationPenalty
  };
}

export function mafiaPlayerRankings(games = [], playerResolver = () => null) {
  const rows = new Map();
  games
    .filter(game => game?.status === 'finished' && ['red', 'black', 'draw'].includes(game.winner))
    .forEach(game => (game.seats || []).forEach(seat => {
      const key = playerKey(seat);
      if (key === 'guest:') return;
      const known = seat.profileId ? playerResolver(seat.profileId) : null;
      const row = rows.get(key) || {
        key,
        player: known || { id: key, name: seat.name, avatar: seat.avatar || '' },
        games: 0,
        wins: 0,
        winRate: 0,
        points: 0,
        coefficient: 0,
        scores: []
      };
      const score = mafiaGamePoints(game, seat).points;
      row.games += 1;
      if (game.winner === ROLE_TEAMS[seat.role]) row.wins += 1;
      row.points = rounded(row.points + score);
      row.scores.push({ score, at: String(game.endedAt || game.updatedAt || '') });
      rows.set(key, row);
    }));

  const ranking = [...rows.values()].map(row => {
    const recentPoints = row.scores
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, FIIM_RATING_RULES.performanceWindow)
      .reduce((sum, item) => sum + item.score, 0);
    return {
      ...row,
      winRate: row.games ? Math.round(row.wins / row.games * 100) : 0,
      coefficient: rounded(recentPoints / FIIM_RATING_RULES.performanceWindow, 3)
    };
  }).sort((left, right) =>
    right.points - left.points
    || right.coefficient - left.coefficient
    || right.wins - left.wins
    || right.games - left.games
    || String(left.player.name || '').localeCompare(String(right.player.name || ''), 'uk')
  );

  ranking.forEach((row, index) => {
    row.rank = index === 0 || row.points !== ranking[index - 1].points
      ? index + 1
      : ranking[index - 1].rank;
  });
  return ranking.map(({ scores, ...row }) => row);
}
