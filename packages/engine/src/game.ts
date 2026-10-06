import type { Input } from './input';
import type { Rng } from './rng';
import type { SoundName } from './audio';

/** Fixed simulation step. Games always receive dt = 1 / TICK_RATE. */
export const TICK_RATE = 60;
export const TICK = 1 / TICK_RATE;

export interface GameStatus {
  score: number;
  hiScore: number;
  lives: number;
  level: number;
  over: boolean;
}

export interface InitContext {
  rng: Rng;
  hiScore: number;
}

export interface UpdateContext {
  rng: Rng;
  /** Fire-and-forget sound / effect event. Games never touch audio directly. */
  emit(event: SoundName): void;
}

/**
 * The contract every game implements. Games are deterministic: no Math.random, Date.now,
 * window or document. State must stay plain JSON data so it can be saved and replayed.
 */
export interface GameDefinition<S = unknown> {
  id: string;
  size: { width: number; height: number };
  init(ctx: InitContext): S;
  update(state: S, input: Input, dt: number, ctx: UpdateContext): void;
  render(state: S, g: CanvasRenderingContext2D, time: number): void;
  status(state: S): GameStatus;
}
