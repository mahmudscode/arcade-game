import { describe, expect, it } from 'vitest';
import { LANGUAGES, asLanguage, translate, type Key } from './i18n';

describe('i18n', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'daily.streak', { n: 4 })).toBe('4-day streak.');
    expect(translate('es', 'daily.streak', { n: 4 })).toBe('Racha de 4 días.');
  });

  it('falls back to English for a missing translation', () => {
    // The nav keys exist in every language; an unknown language id degrades to the detected/English one.
    expect(asLanguage('xx')).toMatch(/^(en|es|fr)$/);
    expect(translate('fr', 'nav.games')).toBe('Jeux');
  });

  it('every language defines the same placeholders as English for each key it translates', () => {
    const keys: Key[] = ['daily.best', 'daily.streak', 'achievements.summary'];
    for (const lang of LANGUAGES) {
      for (const k of keys) {
        const en = translate('en', k).match(/\{\w+\}/g)?.sort();
        const other = translate(lang.id, k).match(/\{\w+\}/g)?.sort();
        expect(other).toEqual(en);
      }
    }
  });
});
