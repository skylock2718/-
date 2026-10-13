import type { RunState, RunStats } from './run';

/**
 * Persistence: the active expedition plus meta progression (ascension
 * unlocks, run history, lifetime records). Everything lives in localStorage
 * and every access is guarded — private windows can throw on storage.
 */

const RUN_KEY = 'dicebound.run';
const META_KEY = 'dicebound.meta';
const DECKS_KEY = 'dicebound.decks';

export const MAX_ASCENSION = 5;

export const ASCENSION_TEXT: string[] = [
  '标准难度。',
  '敌方单位 +15% 生命。',
  '敌方单位 +1 命中；战斗金币 -15%。',
  '精英与首领起始法力 +1。',
  '以 90% 生命开始远征。',
  '篝火休息只回复 20%；进入下一幕时只回复一半已损失生命。',
];

export interface RunRecord {
  heroId: string;
  win: boolean;
  ascension: number;
  act: number;
  floors: number;
  level: number;
  deckSize: number;
  relics: number;
  gold: number;
  killedBy: string | null;
  at: number;
  ms: number;
  stats: RunStats;
  score: number;
}

export interface MetaState {
  v: 1;
  runs: number;
  wins: number;
  /** highest unlocked ascension per hero */
  ascension: Record<string, number>;
  history: RunRecord[];
  nat20: number;
  nat1: number;
  bestScore: number;
  skirmishes: number;
  skirmishWins: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown): void {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: progress lives only in memory */
  }
}

// ---------------------------------------------------------------- run

export function saveRun(run: RunState | null): void {
  write(RUN_KEY, run);
}

export function loadRun(): RunState | null {
  const r = read<RunState>(RUN_KEY);
  if (!r || r.v !== 2 || r.over) return null;
  return r;
}

export function hasSavedRun(): boolean {
  return loadRun() != null;
}

// ---------------------------------------------------------------- meta

const EMPTY: MetaState = { v: 1, runs: 0, wins: 0, ascension: {}, history: [], nat20: 0, nat1: 0, bestScore: 0, skirmishes: 0, skirmishWins: 0 };

let cache: MetaState | null = null;

export function loadMeta(): MetaState {
  if (cache) return cache;
  const m = read<MetaState>(META_KEY);
  cache = m && m.v === 1 ? { ...EMPTY, ...m } : { ...EMPTY, ascension: {}, history: [] };
  return cache;
}

export function saveMeta(m: MetaState): void {
  cache = m;
  write(META_KEY, m);
}

export function unlockedAscension(heroId: string): number {
  return Math.min(MAX_ASCENSION, loadMeta().ascension[heroId] ?? 0);
}

export function runScore(run: RunState, win: boolean): number {
  const s = run.stats;
  return Math.round(s.floors * 5 + s.elites * 25 + s.bosses * 60 + s.kills * 2 + s.nat20 * 3 + run.gold / 10 + (win ? 300 : 0) + run.ascension * 80);
}

export function recordRun(run: RunState, win: boolean, killedBy: string | null): RunRecord {
  const m = loadMeta();
  const rec: RunRecord = {
    heroId: run.heroId,
    win,
    ascension: run.ascension,
    act: run.act,
    floors: run.stats.floors,
    level: run.level,
    deckSize: run.deck.length,
    relics: run.relics.length,
    gold: run.gold,
    killedBy,
    at: Date.now(),
    ms: Date.now() - run.startedAt,
    stats: { ...run.stats },
    score: runScore(run, win),
  };
  const next: MetaState = {
    ...m,
    runs: m.runs + 1,
    wins: m.wins + (win ? 1 : 0),
    nat20: m.nat20 + run.stats.nat20,
    nat1: m.nat1 + run.stats.nat1,
    bestScore: Math.max(m.bestScore, rec.score),
    history: [rec, ...m.history].slice(0, 30),
    ascension: { ...m.ascension },
  };
  if (win) {
    const cur = next.ascension[run.heroId] ?? 0;
    if (run.ascension >= cur) next.ascension[run.heroId] = Math.min(MAX_ASCENSION, run.ascension + 1);
  }
  saveMeta(next);
  return rec;
}

export function recordSkirmish(won: boolean): void {
  const m = loadMeta();
  saveMeta({ ...m, skirmishes: m.skirmishes + 1, skirmishWins: m.skirmishWins + (won ? 1 : 0) });
}

// ---------------------------------------------------------------- custom decks

export interface SavedDeck {
  id: string;
  name: string;
  heroId: string;
  cards: string[];
  updated: number;
}

export function loadDecks(): SavedDeck[] {
  return read<SavedDeck[]>(DECKS_KEY) ?? [];
}

export function saveDecks(d: SavedDeck[]): void {
  write(DECKS_KEY, d);
}
