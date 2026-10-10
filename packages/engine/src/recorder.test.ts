import { describe, expect, it } from 'vitest';
import { NO_INPUT, type Input } from './input';
import { Recorder, decodeReplay } from './recorder';

const held = (...b: string[]): Input => ({ held: { ...NO_INPUT.held, ...Object.fromEntries(b.map((k) => [k, true])) }, pressed: { ...NO_INPUT.pressed } });

describe('Recorder', () => {
  it('round-trips frames and collapses identical runs', () => {
    const r = new Recorder();
    const seq = [NO_INPUT, NO_INPUT, NO_INPUT, held('left'), held('left'), { ...held('a'), pressed: { ...NO_INPUT.pressed, a: true } }];
    seq.forEach((i) => r.record(i));
    const bytes = r.toBytes();
    expect(bytes.length).toBe(4 + 3 * 8);
    const out = decodeReplay(bytes);
    expect(out).toHaveLength(6);
    out.forEach((o, i) => expect(o).toEqual(seq[i]));
  });

  it('writes the frame count the API checks, and base64 decodes to the same bytes', () => {
    const r = new Recorder();
    for (let i = 0; i < 600; i++) r.record(NO_INPUT);
    const raw = Uint8Array.from(atob(r.toBase64()), (c) => c.charCodeAt(0));
    expect(new DataView(raw.buffer).getUint32(0, true)).toBe(600);
  });
});
