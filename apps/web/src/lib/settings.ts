import { useSyncExternalStore } from 'react';
import { DEFAULT_KEY_MAP, type Button, type KeyMap } from '@arcade/engine';

export interface Settings {
  volume: number;
  reducedMotion: boolean;
  /** Only overrides; anything missing uses DEFAULT_KEY_MAP. Stored as button -> key codes. */
  keys: Partial<Record<Button, string[]>>;
}

const KEY = 'arcade:settings';
const DEFAULTS: Settings = { volume: 0.7, reducedMotion: false, keys: {} };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    // Older builds stored the volume on its own.
    const legacyVolume = Number(localStorage.getItem('arcade:volume'));
    const base = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : legacyVolume ? { volume: legacyVolume } : {}) };
    return base;
  } catch {
    return DEFAULTS;
  }
}

let current: Settings = typeof localStorage === 'undefined' ? DEFAULTS : load();
const listeners = new Set<() => void>();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: settings last for this tab only.
  }
  applyDom();
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), getSettings, () => DEFAULTS);
}

/** Reduced motion applies to the shell via CSS, in addition to the OS preference. */
export function applyDom(): void {
  document.documentElement.toggleAttribute('data-reduced-motion', current.reducedMotion);
}

/** Builds the engine key map: a remapped button loses its default keys and uses the chosen ones. */
export function buildKeyMap(keys: Settings['keys']): KeyMap {
  const map: Record<string, Button> = {};
  const overridden = new Set(Object.keys(keys));
  for (const [code, button] of Object.entries(DEFAULT_KEY_MAP)) if (!overridden.has(button)) map[code] = button;
  for (const [button, codes] of Object.entries(keys)) for (const code of codes ?? []) map[code] = button as Button;
  return map;
}

export const REMAPPABLE: { button: Button; label: string }[] = [
  { button: 'left', label: 'Left' },
  { button: 'right', label: 'Right' },
  { button: 'up', label: 'Up' },
  { button: 'down', label: 'Down' },
  { button: 'a', label: 'Action A' },
  { button: 'b', label: 'Action B' },
  { button: 'start', label: 'Start' },
  { button: 'pause', label: 'Pause' },
];

export function keysFor(button: Button, keys: Settings['keys']): string[] {
  return keys[button] ?? Object.entries(DEFAULT_KEY_MAP).filter(([, b]) => b === button).map(([c]) => c);
}

export function keyLabel(code: string): string {
  return code.replace(/^Key/, '').replace(/^Arrow/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');
}
