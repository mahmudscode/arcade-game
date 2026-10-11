import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAT, isFloor, newBody, pathStep, steerToLadder, stepBody, supported, type Body, type Intent, type PlatWorld } from './platformer';

const NONE: Intent = { dir: 0, up: false, down: false, jump: false };
const DT = 1 / 60;

/** Build a world from ASCII: # solid, = one-way platform, H ladder, anything else empty. */
function world(rows: string[]): PlatWorld & { rows: string[] } {
  const at = (tx: number, ty: number) => rows[ty]?.[tx] ?? ' ';
  return {
    rows,
    solid: (tx, ty) => at(tx, ty) === '#' || (ty >= 0 && at(tx, ty) === ' ' && (tx < 0 || tx >= (rows[0]?.length ?? 0)) ? true : at(tx, ty) === '#'),
    platform: (tx, ty) => at(tx, ty) === '=',
    ladder: (tx, ty) => at(tx, ty) === 'H',
  };
}
const run = (b: Body, w: PlatWorld, intent: Intent | ((f: number) => Intent), frames: number) => {
  const out = { landed: 0, bumps: [] as { tx: number; ty: number }[] };
  for (let f = 0; f < frames; f++) {
    const r = stepBody(b, w, typeof intent === 'function' ? intent(f) : intent, DT);
    if (r.landed) out.landed++;
    if (r.bumped) out.bumps.push(r.bumped);
  }
  return out;
};

describe('platformer physics', () => {
  const flat = world(['#          #', '#          #', '#          #', '#          #', '############']);

  it('falls under gravity and lands exactly on a floor', () => {
    const b = newBody(5.5, 1);
    const r = run(b, flat, NONE, 120);
    expect(b.y).toBe(4);
    expect(b.onGround).toBe(true);
    expect(b.vy).toBe(0);
    expect(r.landed).toBe(1);
  });

  it('walks at a fixed speed, and walls stop it', () => {
    const b = newBody(5.5, 4);
    run(b, flat, { ...NONE, dir: 1 }, 30);
    expect(b.x).toBeCloseTo(5.5 + DEFAULT_PLAT.walk * 0.5, 1);
    run(b, flat, { ...NONE, dir: 1 }, 300);
    expect(b.x).toBeLessThan(10.8); // the wall is at x = 11, minus half the body
    expect(b.x).toBeGreaterThan(10.6);
    expect(b.face).toBe(1);
  });

  it('jumps to the height gravity predicts, then lands again', () => {
    const b = newBody(5.5, 4);
    let top = b.y;
    for (let f = 0; f < 90; f++) {
      stepBody(b, flat, { ...NONE, jump: f === 0 }, DT);
      top = Math.min(top, b.y);
    }
    const expected = (DEFAULT_PLAT.jump * DEFAULT_PLAT.jump) / (2 * DEFAULT_PLAT.gravity);
    expect(4 - top).toBeGreaterThan(expected * 0.9);
    expect(4 - top).toBeLessThan(expected * 1.1);
    expect(b.y).toBe(4);
    expect(b.onGround).toBe(true);
  });

  it('walking off an edge makes it fall to the floor below', () => {
    const w = world(['#          #', '#   ####   #', '#          #', '############']);
    const b = newBody(5.5, 1);
    b.onGround = true;
    run(b, w, { ...NONE, dir: 1 }, 60);
    expect(b.y).toBe(3);
  });

  it('bonks its head on a ceiling and reports which tile it hit', () => {
    const w = world(['############', '#    #     #', '#          #', '#          #', '############']);
    const b = newBody(5.5, 4);
    const r = run(b, w, (f) => ({ ...NONE, jump: f === 0 }), 60);
    expect(r.bumps).toEqual([{ tx: 5, ty: 1 }]);
    expect(b.y).toBe(4);
  });

  it('one-way platforms can be jumped up through but not fallen through', () => {
    const w = world(['#          #', '#          #', '#          #', '#          #', '#    ===   #', '############']);
    const up = newBody(5.5, 5);
    run(up, w, (f) => ({ ...NONE, jump: f === 0 }), 5);
    // Rising through the platform: no head bump.
    expect(up.vy).toBeLessThan(0);
    const b = newBody(5.5, 5);
    // A jump rises past the platform (no head bump) and lands on top of it.
    let landedOn: number | null = null;
    for (let f = 0; f < 200; f++) {
      const r = stepBody(b, w, { ...NONE, jump: f === 0 }, DT);
      expect(r.bumped).toBeUndefined();
      if (r.landed && b.y === 4 && landedOn === null) landedOn = f;
    }
    expect(landedOn).not.toBeNull();
    expect(b.y).toBe(4);
  });

  it('pressing down drops through a one-way platform', () => {
    const w = world(['#          #', '#    ===   #', '#          #', '#          #', '############']);
    const b = newBody(5.5, 1);
    b.onGround = true;
    expect(supported(b, w)).toBe(true);
    run(b, w, { ...NONE, down: true }, 120);
    expect(b.y).toBe(4);
  });

  it('climbs a ladder up and down, and stands on top of it', () => {
    const w = world(['#          #', '#   H      #', '#   H      #', '#   H      #', '############']);
    const b = newBody(4.5, 4);
    b.onGround = true;
    run(b, w, { ...NONE, up: true }, 20);
    expect(b.climbing).toBe(true);
    expect(b.y).toBeLessThan(4);
    run(b, w, { ...NONE, up: true }, 120);
    expect(b.climbing).toBe(false);
    expect(b.y).toBe(1);
    expect(b.onGround).toBe(true);
    // And back down.
    run(b, w, { ...NONE, down: true }, 120);
    expect(b.y).toBe(4);
    expect(b.onGround).toBe(true);
  });

  it('snaps onto the ladder column, and only climbs where there is a ladder', () => {
    const w = world(['#          #', '#   H      #', '#   H      #', '#   H      #', '############']);
    const b = newBody(4.8, 4);
    b.onGround = true;
    run(b, w, { ...NONE, up: true }, 10);
    expect(b.x).toBe(4.5);
    const other = newBody(8.5, 4);
    other.onGround = true;
    run(other, w, { ...NONE, up: true }, 30);
    expect(other.climbing).toBe(false);
    expect(other.y).toBe(4);
  });

  it('can step off a ladder onto a platform beside it', () => {
    const w = world(['#          #', '#   H      #', '#   H#######', '#   H      #', '############']);
    const b = newBody(4.5, 4);
    b.onGround = true;
    run(b, w, { ...NONE, up: true }, 20);
    expect(b.climbing).toBe(true);
    // Hold up until level with the platform (feet at y = 2), then step right onto it.
    for (let f = 0; f < 200 && b.y > 2.05; f++) stepBody(b, w, { ...NONE, up: true }, DT);
    run(b, w, { ...NONE, dir: 1 }, 40);
    expect(b.climbing).toBe(false);
    expect(b.y).toBe(2);
    expect(b.x).toBeGreaterThan(5.3);
  });

  it('is deterministic and keeps finite numbers', () => {
    const play = () => {
      const b = newBody(3.5, 1);
      run(b, flat, (f) => ({ dir: f % 90 < 45 ? 1 : -1, up: f % 7 === 0, down: f % 11 === 0, jump: f % 40 === 0 }), 2000);
      return JSON.stringify(b);
    };
    expect(play()).toBe(play());
    expect(play()).not.toMatch(/NaN|null|Infinity/);
  });

  it('isFloor treats a ladder top as standable but not its middle', () => {
    const w = world(['    ', ' H  ', ' H  ', '####']);
    expect(isFloor(w, 1, 1)).toBe(true);
    expect(isFloor(w, 1, 2)).toBe(false);
  });

  describe('pathStep', () => {
    // Body cells are (x, row of the body); the feet are one row lower, on the floor.
    it('walks toward a target on the same floor', () => {
      const w = world(['            ', '            ', '############']);
      expect(pathStep(w, 12, 3, { x: 8, y: 1 }, { x: 2, y: 1 })).toEqual({ dir: -1, up: false, down: false });
      expect(pathStep(w, 12, 3, { x: 2, y: 1 }, { x: 9, y: 1 })).toEqual({ dir: 1, up: false, down: false });
    });

    it('heads for the ladder to change floors, then climbs', () => {
      // Upper floor (feet y = 2) over a lower one (feet y = 5), joined by a ladder at x = 4.
      const w = world(['            ', '            ', '####H#######', '    H       ', '    H       ', '############']);
      const rows = 6;
      expect(pathStep(w, 12, rows, { x: 9, y: 4 }, { x: 8, y: 1 })).toEqual({ dir: -1, up: false, down: false });
      expect(pathStep(w, 12, rows, { x: 4, y: 4 }, { x: 8, y: 1 })).toEqual({ dir: 0, up: true, down: false });
      // Back down again: from the upper floor the ladder leads down.
      expect(pathStep(w, 12, rows, { x: 4, y: 1 }, { x: 8, y: 4 })).toEqual({ dir: 0, up: false, down: true });
    });

    it('returns null when the target is unreachable, and when already there', () => {
      const split = world(['    #       ', '    #       ', '############']);
      expect(pathStep(split, 12, 3, { x: 2, y: 1 }, { x: 8, y: 1 })).toBeNull();
      const open = world(['            ', '            ', '############']);
      expect(pathStep(open, 12, 3, { x: 3, y: 1 }, { x: 3, y: 1 })).toBeNull();
    });

    it('routes through a drop: walking off a ledge is an edge', () => {
      // A platform (feet y = 1) over the ground (feet y = 3): from the platform the way to the ground is leftward off the edge.
      const w = world(['          ', '      ####', '          ', '##########']);
      expect(pathStep(w, 10, 4, { x: 8, y: 0 }, { x: 2, y: 2 })).toEqual({ dir: -1, up: false, down: false });
    });
  });

  describe('steerToLadder', () => {
    it('eases toward the middle of the tile before a climb, then lets the climb through', () => {
      const edge = newBody(10.05, 5);
      const steer = steerToLadder(edge, { dir: 0, up: true, down: false });
      expect(steer.up).toBe(false);
      expect(steer.dir).toBeGreaterThan(0);
      expect(steer.dir).toBeLessThanOrEqual(1);
      const centred = newBody(10.45, 5);
      expect(steerToLadder(centred, { dir: 0, up: true, down: false })).toEqual({ dir: 0, up: true, down: false });
    });

    it('leaves walking alone, and slows down near the centre so it cannot overshoot', () => {
      const b = newBody(10.1, 5);
      expect(steerToLadder(b, { dir: 1, up: false, down: false })).toEqual({ dir: 1, up: false, down: false });
      const far = steerToLadder(newBody(10.0, 5), { dir: 0, up: true, down: false }).dir;
      const near = steerToLadder(newBody(10.28, 5), { dir: 0, up: true, down: false }).dir;
      expect(near).toBeLessThan(far);
    });

    it('does nothing to a body that is already climbing', () => {
      const b = newBody(10.0, 5);
      b.climbing = true;
      expect(steerToLadder(b, { dir: 0, up: true, down: false })).toEqual({ dir: 0, up: true, down: false });
    });
  });

  it('jumping off a ladder while holding Up does not re-grab it straight away', () => {
    const w = world(['#          #', '#   H      #', '#   H      #', '#   H      #', '#   H      #', '############']);
    const b = newBody(4.5, 5);
    b.onGround = true;
    run(b, w, { ...NONE, up: true }, 25);
    expect(b.climbing).toBe(true);
    stepBody(b, w, { dir: 1, up: true, down: false, jump: true }, DT);
    expect(b.climbing).toBe(false);
    for (let f = 0; f < 6; f++) stepBody(b, w, { dir: 0, up: true, down: false, jump: false }, DT);
    expect(b.climbing).toBe(false); // still in the air, not yanked back
    expect(b.vy).not.toBe(0);
  });

  it('never leaves -0 in a body, even landing on a floor at height zero from above', () => {
    const w = world(['##########']);
    const c = newBody(5.5, -2.5);
    for (let f = 0; f < 80; f++) stepBody(c, w, NONE, DT);
    expect(c.y).toBe(0);
    expect(Object.is(c.y, -0)).toBe(false);
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });
});
