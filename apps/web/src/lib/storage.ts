import { useSyncExternalStore } from 'react';
import type { SavedState } from '@arcade/engine';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked or full; the app still works without persistence.
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Favorites: a stable snapshot string keeps useSyncExternalStore from re-rendering needlessly.
const FAV_KEY = 'arcade:favorites';
const getFavSnapshot = () => localStorage.getItem(FAV_KEY) ?? '[]';

export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, safe(getFavSnapshot, '[]'), () => '[]');
  const favs = new Set<string>(JSON.parse(raw) as string[]);
  const toggle = (slug: string) => {
    const next = new Set(favs);
    if (!next.delete(slug)) next.add(slug);
    write(FAV_KEY, [...next]);
    notify();
  };
  return { favs, toggle };
}

function safe(fn: () => string, fallback: string) {
  return () => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
}

// Save states ("Continue playing").
const saveKey = (slug: string) => `arcade:save:${slug}`;
const SAVE_INDEX = 'arcade:saves';

export function getSave(slug: string): SavedState | null {
  return read<SavedState | null>(saveKey(slug), null);
}

export function putSave(slug: string, saved: SavedState): void {
  write(saveKey(slug), saved);
  const index = new Set(read<string[]>(SAVE_INDEX, []));
  index.add(slug);
  write(SAVE_INDEX, [...index]);
  notify();
}

export function useSaves(): SavedState[] {
  const raw = useSyncExternalStore(subscribe, safe(() => localStorage.getItem(SAVE_INDEX) ?? '[]', '[]'), () => '[]');
  return (JSON.parse(raw) as string[])
    .map(getSave)
    .filter((s): s is SavedState => s !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export const getHiScore = (slug: string) => read<number>(`arcade:hi:${slug}`, 0);
export const setHiScore = (slug: string, score: number) => write(`arcade:hi:${slug}`, score);


export function timeAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
