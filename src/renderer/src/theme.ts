import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ht-theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* localStorage unavailable */
    console.debug('[theme] localStorage unavailable when reading theme');
  }
  return 'dark';
}

function readDom(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

let current: Theme = readDom();
const listeners = new Set<(t: Theme) => void>();

function applyDom(t: Theme) {
  const el = document.documentElement;
  if (t === 'dark') el.classList.add('dark');
  else el.classList.remove('dark');
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(t: Theme) {
  if (t === current) return;
  current = t;
  applyDom(t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
    console.debug('[theme] localStorage unavailable when saving theme');
  }
  listeners.forEach((l) => l(t));
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function subscribe(listener: (t: Theme) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
}

/** Initialise the DOM theme class from persisted preference. Called once on startup. */
export function initTheme() {
  const t = readStored();
  current = t;
  applyDom(t);
}