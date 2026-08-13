import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, languageLocale, normalizeLanguage } from '../src/i18n.js';

test('Italian replaces Russian in the language picker', () => {
  assert.deepEqual(LANGUAGES.map(language => language.code), ['uk', 'it', 'en', 'fr']);
  assert.deepEqual(LANGUAGES.map(language => language.label), ['Українська', 'Italiano', 'English', 'Français']);
  assert.equal(languageLocale('it'), 'it-IT');
});

test('legacy Russian setting migrates to Italian', () => {
  assert.equal(normalizeLanguage('ru'), 'it');
  assert.equal(languageLocale('ru'), 'it-IT');
});
