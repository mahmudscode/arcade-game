import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Hard rule 1 (CLAUDE.md): game code must be deterministic. This scans every non-test source file for
 * banned globals, ignoring comments, so replay verification on the server can never drift.
 */
const BANNED = [/\bMath\.random\b/, /\bDate\.now\b/, /\bperformance\.now\b/, /\bnew Date\b/, /\bwindow\b/, /\bdocument\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/, /\blocalStorage\b/, /\baddEventListener\b/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('determinism guard', () => {
  const sources = files(__dirname);
  it('scans the game sources', () => {
    expect(sources.length).toBeGreaterThan(100);
  });
  for (const rule of BANNED) {
    it(`no ${rule.source} in game code`, () => {
      const offenders = sources.filter((f) => rule.test(stripComments(readFileSync(f, 'utf8'))));
      expect(offenders).toEqual([]);
    });
  }
});
