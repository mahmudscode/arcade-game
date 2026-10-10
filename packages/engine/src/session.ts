import { AudioBus } from './audio';
import { TICK, type GameDefinition, type GameStatus } from './game';
import { InputManager, type Button, type KeyMap } from './input';
import { Recorder } from './recorder';
import { createRng, type Rng } from './rng';

export interface SavedState {
  gameId: string;
  savedAt: number;
  state: unknown;
  rng: number;
  status: GameStatus;
}

export interface SessionOptions {
  seed?: number;
  audio?: AudioBus;
  hiScore?: number;
  keyMap?: KeyMap;
  onStatus?: (status: GameStatus, paused: boolean) => void;
  onHiScore?: (score: number) => void;
}

/** Binds a GameDefinition to a canvas: fixed-timestep loop, input, audio, pause, save/load. */
export class GameSession<S> {
  readonly input = new InputManager();
  readonly audio: AudioBus;
  private readonly ctx2d: CanvasRenderingContext2D;
  private rng!: Rng;
  private state!: S;
  private rafId = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private paused = false;
  private destroyed = false;
  private hiScore: number;
  private lastKey = '';
  private readonly recorder = new Recorder();
  private replayable = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly def: GameDefinition<S>,
    private readonly options: SessionOptions = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx2d = ctx;
    this.audio = options.audio ?? new AudioBus();
    this.hiScore = options.hiScore ?? 0;
    canvas.width = def.size.width;
    canvas.height = def.size.height;
    if (options.keyMap) this.input.setKeyMap(options.keyMap);
    this.reset();
  }

  private reset(): void {
    this.rng = createRng(this.options.seed ?? (Date.now() >>> 0));
    this.state = this.def.init({ rng: this.rng, hiScore: this.hiScore });
    this.time = 0;
    this.acc = 0;
    this.recorder.reset();
    this.replayable = true;
    this.pushStatus(true);
  }

  start(): void {
    this.input.attach();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  restart(): void {
    this.paused = false;
    this.reset();
  }

  pause(): void {
    this.paused = true;
    this.pushStatus(true);
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    this.pushStatus(true);
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** On-screen controller hook. */
  press(button: Button, isDown: boolean): void {
    this.audio.unlock();
    this.input.set(button, isDown);
  }

  save(): SavedState {
    return {
      gameId: this.def.id,
      savedAt: Date.now(),
      state: JSON.parse(JSON.stringify(this.state)),
      rng: this.rng.getState(),
      status: this.def.status(this.state),
    };
  }

  load(saved: SavedState): void {
    if (saved.gameId !== this.def.id) return;
    this.state = JSON.parse(JSON.stringify(saved.state)) as S;
    this.rng.setState(saved.rng);
    this.replayable = false; // a restored state can't be re-simulated from the seed
    this.paused = false;
    this.pushStatus(true);
  }

  /** Base64 replay of this run, or null if it can't be verified (state was loaded, or no seed). */
  getReplay(): { replay: string; frames: number } | null {
    if (!this.replayable || this.options.seed === undefined) return null;
    return { replay: this.recorder.toBase64(), frames: this.recorder.frameCount };
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    this.audio.destroy();
  }

  private onVisibility = () => {
    if (document.hidden && !this.paused) this.pause();
  };

  private frame = (now: number) => {
    if (this.destroyed) return;
    const elapsed = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;

    if (!this.paused) {
      this.acc += elapsed;
      while (this.acc >= TICK) {
        const input = this.input.consume();
        if (input.pressed.pause) {
          this.pause();
          break;
        }
        this.recorder.record(input);
        this.def.update(this.state, input, TICK, { rng: this.rng, emit: (e) => this.audio.play(e) });
        this.time += TICK;
        this.acc -= TICK;
      }
    } else if (this.input.consume().pressed.pause) {
      this.resume();
    }

    this.def.render(this.state, this.ctx2d, this.time);
    this.pushStatus(false);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private pushStatus(force: boolean): void {
    const status = this.def.status(this.state);
    if (status.score > this.hiScore) {
      this.hiScore = status.score;
      this.options.onHiScore?.(this.hiScore);
    }
    const key = `${status.score}|${status.lives}|${status.level}|${status.over}|${this.paused}|${this.hiScore}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.options.onStatus?.({ ...status, hiScore: Math.max(status.hiScore, this.hiScore) }, this.paused);
  }
}
