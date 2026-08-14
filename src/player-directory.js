function numericGameCount(gameCounts, playerId) {
  const value = gameCounts instanceof Map ? gameCounts.get(playerId) : gameCounts?.[playerId];
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function preferredName(player) {
  return String(player?.nickname || player?.name || '').trim();
}

export function sortDirectoryPlayers(players = [], { onlinePlayerIds = new Set(), gameCounts = new Map() } = {}) {
  const onlineIds = onlinePlayerIds instanceof Set ? onlinePlayerIds : new Set(onlinePlayerIds || []);
  return players
    .map((player, index) => ({
      player,
      index,
      games: numericGameCount(gameCounts, player?.id),
      group: player?.cloudUid ? (onlineIds.has(player.id) ? 0 : 1) : 2
    }))
    .sort((left, right) => left.group - right.group
      || right.games - left.games
      || preferredName(left.player).localeCompare(preferredName(right.player), 'uk', { sensitivity: 'base' })
      || left.index - right.index)
    .map(item => item.player);
}
