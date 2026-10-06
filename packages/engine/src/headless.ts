import { TICK, type GameDefinition } from './game';
import { NO_INPUT, type Input } from './input';
import { createRng } from './rng';

export interface HeadlessOptions {
  seed: number;
  frames: number;
  /** Input for a given frame; defaults to no input. */
  inputAt?: (frame: number) => Input;
}

/** Runs a game without a canvas. Used by tests now and by server-side score verification later. */
export function runHeadless<S>(def: GameDefinition<S>, { seed, frames, inputAt }: HeadlessOptions) {
  const rng = createRng(seed);
  const state = def.init({ rng, hiScore: 0 });
  const events: string[] = [];
  for (let frame = 0; frame < frames; frame++) {
    def.update(state, inputAt?.(frame) ?? NO_INPUT, TICK, { rng, emit: (e) => events.push(e) });
  }
  return { state, status: def.status(state), events };
}
