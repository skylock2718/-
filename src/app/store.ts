import { useEffect, useReducer, useRef } from 'preact/hooks';

/** Tiny observable store with selector hooks. */
export class Store<T extends object> {
  private listeners = new Set<() => void>();
  constructor(public state: T) {}

  get(): T {
    return this.state;
  }

  set(patch: Partial<T>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  update(fn: (s: T) => Partial<T> | void): void {
    const r = fn(this.state);
    if (r) this.state = { ...this.state, ...r };
    else this.state = { ...this.state };
    this.emit();
  }

  emit(): void {
    for (const l of [...this.listeners]) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

export function useStore<T extends object, S>(store: Store<T>, sel: (s: T) => S): S {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const selRef = useRef(sel);
  selRef.current = sel;
  const val = sel(store.state);
  const valRef = useRef(val);
  valRef.current = val;
  useEffect(() => {
    return store.subscribe(() => {
      const next = selRef.current(store.state);
      if (!shallowEqual(next, valRef.current)) force(0);
    });
  }, [store]);
  return val;
}

/** A counter that components can subscribe to for "something changed" ticks. */
export class Ticker {
  private listeners = new Set<() => void>();
  n = 0;
  private scheduled = false;

  bump(): void {
    this.n++;
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      for (const l of [...this.listeners]) l();
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function useTicker(t: Ticker): number {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => t.subscribe(() => force(0)), [t]);
  return t.n;
}

// ----------------------------------------------------------------- settings

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  animSpeed: number;
  diceSpeed: number;
  karmic: boolean;
  fatePrompt: boolean;
  shake: boolean;
  quality: 'high' | 'medium' | 'low';
  showDice: boolean;
  tips: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.45,
  sfx: 0.8,
  animSpeed: 1,
  diceSpeed: 1,
  karmic: true,
  fatePrompt: true,
  shake: true,
  quality: 'high',
  showDice: true,
  tips: true,
};

const SETTINGS_KEY = 'dicebound.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  // lower quality defaults on small / touch devices
  const small = typeof window !== 'undefined' && (window.innerWidth < 900 || matchMedia?.('(pointer: coarse)').matches);
  return { ...DEFAULT_SETTINGS, quality: small ? 'medium' : 'high' };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function qualityOf(q: Settings['quality']): { bloom: boolean; shadows: boolean; pixelRatio: number } {
  if (q === 'low') return { bloom: false, shadows: false, pixelRatio: 1 };
  if (q === 'medium') return { bloom: true, shadows: true, pixelRatio: 1.25 };
  return { bloom: true, shadows: true, pixelRatio: 2 };
}
