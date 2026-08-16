import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_GAME_TRACKS, DEFAULT_GAME_MUSIC, GAME_MUSIC_CUES, GAME_MUSIC_DEFAULTS_VERSION, builtinGameTrack,
  customMusicChoice, migrateGameMusicSettings, musicCueForGame, normalizeGameMusicSettings
} from '../src/game-music.js';

test('built-in music catalog exposes four local MP3 tracks', () => {
  assert.equal(BUILTIN_GAME_TRACKS.length, 4);
  assert.equal(GAME_MUSIC_CUES.length, 4);
  assert.deepEqual(new Set(BUILTIN_GAME_TRACKS.map(track => track.id)), new Set([
    'mafia-ambient', 'mafia-2-theme', 'pink-panther-night', 'night-intro'
  ]));
  for (const track of BUILTIN_GAME_TRACKS) {
    assert.match(track.src, /^\.\/assets\/audio\/.+\.mp3$/);
    assert.equal(builtinGameTrack(track.id), track);
  }
});

test('music settings normalize invalid values and preserve valid custom choices', () => {
  assert.equal(DEFAULT_GAME_MUSIC.nightActions, 'mafia-ambient');
  assert.equal(DEFAULT_GAME_MUSIC.nightResult, 'mafia-ambient');
  assert.deepEqual(normalizeGameMusicSettings(), DEFAULT_GAME_MUSIC);
  assert.deepEqual(normalizeGameMusicSettings({
    enabled: 1,
    roleDeal: 'mafia-ambient',
    zeroNight: customMusicChoice('zeroNight'),
    nightActions: 'missing-track',
    nightResult: null
  }), {
    enabled: true,
    roleDeal: 'mafia-ambient',
    zeroNight: 'custom:zeroNight',
    nightActions: DEFAULT_GAME_MUSIC.nightActions,
    nightResult: DEFAULT_GAME_MUSIC.nightResult
  });
  assert.equal(customMusicChoice('unknown'), '');
});

test('legacy night-action default migrates to Mafia atmosphere without replacing a custom choice', () => {
  assert.equal(GAME_MUSIC_DEFAULTS_VERSION, 2);
  assert.equal(migrateGameMusicSettings({ nightActions: 'pink-panther-night' }, 0).nightActions, 'mafia-ambient');
  assert.equal(migrateGameMusicSettings({ nightActions: 'mafia-2-theme' }, 0).nightActions, 'mafia-2-theme');
  assert.equal(migrateGameMusicSettings({ nightActions: 'pink-panther-night' }, 2).nightActions, 'pink-panther-night');
});

test('game phases map to the intended automatic music cue', () => {
  const game = { status: 'active', phase: 'reveal', night: { step: 0 } };
  assert.equal(musicCueForGame(game), 'roleDeal');
  game.phase = 'zeroNight';
  assert.equal(musicCueForGame(game), 'zeroNight');
  game.phase = 'night';
  for (const step of [0, 1, 2, 3]) {
    game.night.step = step;
    assert.equal(musicCueForGame(game), 'nightActions');
  }
  game.night.step = 4;
  assert.equal(musicCueForGame(game), 'nightResult');
  for (const phase of ['day', 'vote', 'tieSpeech', 'lastWord', 'bestMove']) {
    game.phase = phase;
    assert.equal(musicCueForGame(game), null);
  }
  game.status = 'finished';
  game.phase = 'night';
  assert.equal(musicCueForGame(game), null);
});
