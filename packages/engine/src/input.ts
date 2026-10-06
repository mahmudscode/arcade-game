export type Button = 'left' | 'right' | 'up' | 'down' | 'a' | 'b' | 'start' | 'select' | 'pause';

export const BUTTONS: readonly Button[] = ['left', 'right', 'up', 'down', 'a', 'b', 'start', 'select', 'pause'];

export type ButtonMap = Readonly<Record<Button, boolean>>;

/** What a game sees each tick: buttons held now, and buttons that went down since the last tick. */
export interface Input {
  held: ButtonMap;
  pressed: ButtonMap;
}

const KEY_MAP: Record<string, Button> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'a',
  KeyZ: 'a',
  KeyX: 'b',
  ShiftLeft: 'b',
  Enter: 'start',
  Tab: 'select',
  KeyP: 'pause',
  Escape: 'pause',
};

const PREVENT_DEFAULT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

function emptyMap(): Record<Button, boolean> {
  return { left: false, right: false, up: false, down: false, a: false, b: false, start: false, select: false, pause: false };
}

export const NO_INPUT: Input = { held: emptyMap(), pressed: emptyMap() };

/** Keyboard + virtual (touch) input. The only place in the engine that owns event listeners. */
export class InputManager {
  private held = emptyMap();
  private pressed = emptyMap();
  private target: Window | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const button = KEY_MAP[e.code];
    if (!button) return;
    if (e.code === 'Tab') return; // never trap Tab: keyboard users need it to leave the game
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (!e.repeat) this.set(button, true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const button = KEY_MAP[e.code];
    if (button) this.set(button, false);
  };

  private onBlur = () => this.reset();

  attach(target: Window = window): void {
    this.detach();
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target = null;
    this.reset();
  }

  /** Used by on-screen controls. */
  set(button: Button, isDown: boolean): void {
    if (isDown && !this.held[button]) this.pressed[button] = true;
    this.held[button] = isDown;
  }

  reset(): void {
    this.held = emptyMap();
    this.pressed = emptyMap();
  }

  /** Returns the current input and clears press edges. Call once per simulation tick. */
  consume(): Input {
    const input: Input = { held: { ...this.held }, pressed: { ...this.pressed } };
    this.pressed = emptyMap();
    return input;
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
