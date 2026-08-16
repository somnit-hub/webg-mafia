export const BUILTIN_GAME_TRACKS = Object.freeze([
  Object.freeze({
    id: 'mafia-ambient',
    label: 'Мафія · атмосфера',
    src: './assets/audio/mafia-ambient.mp3'
  }),
  Object.freeze({
    id: 'mafia-2-theme',
    label: 'Mafia II · тема',
    src: './assets/audio/mafia-2-theme.mp3'
  }),
  Object.freeze({
    id: 'pink-panther-night',
    label: 'Рожева пантера · ніч',
    src: './assets/audio/pink-panther-night.mp3'
  }),
  Object.freeze({
    id: 'night-intro',
    label: 'Ніч · заставка',
    src: './assets/audio/night-intro.mp3'
  })
]);

export const GAME_MUSIC_CUES = Object.freeze([
  Object.freeze({
    id: 'roleDeal',
    label: 'Роздача ролей',
    description: 'Грає, поки гравці по черзі відкривають свої ролі.'
  }),
  Object.freeze({
    id: 'zeroNight',
    label: 'Нульова ніч',
    description: 'Знайомство мафії, позначення Шерифа та вільна посадка.'
  }),
  Object.freeze({
    id: 'nightActions',
    label: 'Нічні дії',
    description: 'Засинання столу, постріл і перевірки Дона та Шерифа.'
  }),
  Object.freeze({
    id: 'nightResult',
    label: 'Результат ночі',
    description: 'Грає, поки ведучий готується оголосити постріл або промах.'
  })
]);

export const DEFAULT_GAME_MUSIC = Object.freeze({
  enabled: false,
  roleDeal: 'mafia-2-theme',
  zeroNight: 'night-intro',
  nightActions: 'mafia-ambient',
  nightResult: 'mafia-ambient'
});

export const GAME_MUSIC_DEFAULTS_VERSION = 2;

const TRACK_IDS = new Set(BUILTIN_GAME_TRACKS.map(track => track.id));
const CUE_IDS = new Set(GAME_MUSIC_CUES.map(cue => cue.id));

export function customMusicChoice(cue) {
  return CUE_IDS.has(cue) ? `custom:${cue}` : '';
}

export function normalizeGameMusicSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = { enabled: Boolean(source.enabled) };
  for (const cue of GAME_MUSIC_CUES) {
    const choice = String(source[cue.id] || '');
    normalized[cue.id] = TRACK_IDS.has(choice) || choice === customMusicChoice(cue.id)
      ? choice
      : DEFAULT_GAME_MUSIC[cue.id];
  }
  return normalized;
}

export function migrateGameMusicSettings(value = {}, storedVersion = 0) {
  const normalized = normalizeGameMusicSettings(value);
  if (Number(storedVersion) < GAME_MUSIC_DEFAULTS_VERSION && normalized.nightActions === 'pink-panther-night') {
    normalized.nightActions = DEFAULT_GAME_MUSIC.nightActions;
  }
  return normalized;
}

export function builtinGameTrack(trackId) {
  return BUILTIN_GAME_TRACKS.find(track => track.id === trackId) || null;
}

export function musicCueForGame(game) {
  if (!game || game.status !== 'active') return null;
  if (game.phase === 'reveal') return 'roleDeal';
  if (game.phase === 'zeroNight') return 'zeroNight';
  if (game.phase === 'night') return Number(game.night?.step) >= 4 ? 'nightResult' : 'nightActions';
  return null;
}
