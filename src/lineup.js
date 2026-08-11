export const TABLE_SIZE = 10;

export function normalizeLineup(ids = []) {
  const seen = new Set();
  return (Array.isArray(ids) ? ids : []).reduce((result, value) => {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) return result;
    seen.add(id);
    result.push(id);
    return result;
  }, []);
}

export function toggleLineupPlayer(ids, playerId) {
  const lineup = normalizeLineup(ids);
  const id = String(playerId || '').trim();
  if (!id) return lineup;
  return lineup.includes(id) ? lineup.filter(item => item !== id) : [...lineup, id];
}

export function lineupStatus(ids, tableSize = TABLE_SIZE) {
  const lineup = normalizeLineup(ids);
  const atTable = Math.min(lineup.length, tableSize);
  return {
    total: lineup.length,
    atTable,
    waiting: Math.max(0, lineup.length - tableSize),
    temporary: Math.max(0, tableSize - atTable)
  };
}

export function consumeSeatedPlayers(ids, seats = []) {
  const seated = new Set(seats.map(seat => seat?.profileId).filter(Boolean));
  return normalizeLineup(ids).filter(id => !seated.has(id));
}

export function remapLineupPlayers(ids, replacements) {
  return normalizeLineup(ids).map(id => replacements.get(id) || id).filter((id, index, all) => all.indexOf(id) === index);
}
