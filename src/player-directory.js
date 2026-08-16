function numericGameCount(gameCounts, playerId) {
  const value = gameCounts instanceof Map ? gameCounts.get(playerId) : gameCounts?.[playerId];
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function preferredName(player) {
  return String(player?.nickname || player?.name || '').trim();
}

export function selectHostTransferCandidates(players = [], currentUid = '', search = '') {
  const normalizedSearch = String(search || '').trim().toLocaleLowerCase('uk');
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
  const candidates = new Map();

  players.forEach(player => {
    const uid = String(player?.cloudUid || '').trim();
    if (!uid || uid === currentUid || candidates.has(uid)) return;

    const displayName = String(player?.name || '').trim();
    const nickname = String(player?.nickname || '').trim();
    const club = String(player?.contact || '').trim();
    const description = String(player?.notes || '').trim();
    const haystack = [displayName, nickname, club, description].join(' ').toLocaleLowerCase('uk');
    if (searchTerms.some(term => !haystack.includes(term))) return;

    candidates.set(uid, {
      uid,
      name: nickname || displayName || 'Користувач',
      displayName,
      nickname,
      club,
      avatar: player?.avatar || player?.avatarPreset || ''
    });
  });

  return [...candidates.values()].sort((left, right) => left.name.localeCompare(right.name, 'uk', { sensitivity: 'base' }));
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
