import { BUTTONS, type Input } from './input';

/**
 * Replay envelope (base64), shared with the API: u32 LE total frame count, then runs of
 * (u32 LE input word, u32 LE run length). The input word packs `held` in bits 0-8 and
 * `pressed` in bits 9-17, in BUTTONS order. Identical consecutive frames collapse into one run.
 */
const pack = (input: Input): number => {
  let w = 0;
  BUTTONS.forEach((b, i) => {
    if (input.held[b]) w |= 1 << i;
    if (input.pressed[b]) w |= 1 << (i + BUTTONS.length);
  });
  return w >>> 0;
};

export function unpackInput(word: number): Input {
  const held: Record<string, boolean> = {};
  const pressed: Record<string, boolean> = {};
  BUTTONS.forEach((b, i) => {
    held[b] = (word & (1 << i)) !== 0;
    pressed[b] = (word & (1 << (i + BUTTONS.length))) !== 0;
  });
  return { held, pressed } as unknown as Input;
}

export class Recorder {
  private words: number[] = [];
  private runs: number[] = [];
  private frames = 0;

  record(input: Input): void {
    const w = pack(input);
    const last = this.words.length - 1;
    if (last >= 0 && this.words[last] === w) this.runs[last]!++;
    else {
      this.words.push(w);
      this.runs.push(1);
    }
    this.frames++;
  }

  get frameCount(): number {
    return this.frames;
  }

  reset(): void {
    this.words = [];
    this.runs = [];
    this.frames = 0;
  }

  /** Bytes in the envelope format above. */
  toBytes(): Uint8Array {
    const buf = new DataView(new ArrayBuffer(4 + this.words.length * 8));
    buf.setUint32(0, this.frames, true);
    this.words.forEach((w, i) => {
      buf.setUint32(4 + i * 8, w, true);
      buf.setUint32(8 + i * 8, this.runs[i]!, true);
    });
    return new Uint8Array(buf.buffer);
  }

  toBase64(): string {
    let bin = '';
    for (const b of this.toBytes()) bin += String.fromCharCode(b);
    return btoa(bin);
  }
}

/** Expands an envelope back into one Input per frame (used by the verifier and tests). */
export function decodeReplay(bytes: Uint8Array): Input[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = v.getUint32(0, true);
  const out: Input[] = [];
  for (let o = 4; o + 8 <= bytes.byteLength && out.length < total; o += 8) {
    const input = unpackInput(v.getUint32(o, true));
    const run = v.getUint32(o + 4, true);
    for (let i = 0; i < run && out.length < total; i++) out.push(input);
  }
  return out;
}
