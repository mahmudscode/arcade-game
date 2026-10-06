export type SoundName = 'fire' | 'explode' | 'die' | 'pickup' | 'wave' | 'start';

interface Tone {
  type: OscillatorType | 'noise';
  from: number;
  to: number;
  duration: number;
  gain: number;
}

const PRESETS: Record<SoundName, Tone> = {
  fire: { type: 'square', from: 880, to: 330, duration: 0.09, gain: 0.12 },
  explode: { type: 'noise', from: 0, to: 0, duration: 0.28, gain: 0.25 },
  die: { type: 'sawtooth', from: 440, to: 55, duration: 0.6, gain: 0.2 },
  pickup: { type: 'square', from: 660, to: 1320, duration: 0.12, gain: 0.12 },
  wave: { type: 'triangle', from: 330, to: 660, duration: 0.35, gain: 0.18 },
  start: { type: 'square', from: 220, to: 880, duration: 0.3, gain: 0.12 },
};

/** Procedural Web Audio synth: no sound files to download. The context is created lazily after a user gesture. */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private _volume = 0.7;

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.min(1, Math.max(0, value));
    if (this.master) this.master.gain.value = this._volume;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Call from a click/key handler so browsers allow audio. */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  play(name: SoundName): void {
    if (this._volume === 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const tone = PRESETS[name];
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
    gain.connect(this.master);

    if (tone.type === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.connect(gain);
      src.start(now, 0, tone.duration);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, now);
    osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + tone.duration);
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Audio-only randomness: never feeds back into game state.
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
