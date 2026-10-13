import type { Rng } from './rng';

/** A dice expression such as "2d6+3" or "1d8+1d4+2". */
export interface DiceExpr {
  terms: { n: number; s: number }[];
  mod: number;
}

export interface DieResult {
  s: number;
  v: number;
}

export interface DiceRoll {
  expr: DiceExpr;
  dice: DieResult[];
  mod: number;
  total: number;
  crit: boolean;
}

const cache = new Map<string, DiceExpr>();

export function parseDice(src: string | number | DiceExpr): DiceExpr {
  if (typeof src === 'number') return { terms: [], mod: src };
  if (typeof src !== 'string') return src;
  const hit = cache.get(src);
  if (hit) return hit;
  const expr: DiceExpr = { terms: [], mod: 0 };
  const clean = src.replace(/\s+/g, '');
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1;
      const n = m[2] ? parseInt(m[2], 10) : 1;
      // negative dice terms are not supported; treat as flat penalty of average
      if (sign < 0) expr.mod -= Math.round((n * (parseInt(m[3], 10) + 1)) / 2);
      else expr.terms.push({ n, s: parseInt(m[3], 10) });
    } else if (m[5]) {
      const sign = m[4] === '-' ? -1 : 1;
      expr.mod += sign * parseInt(m[5], 10);
    }
  }
  // merge same-sided terms
  const merged: { n: number; s: number }[] = [];
  for (const t of expr.terms) {
    const ex = merged.find((x) => x.s === t.s);
    if (ex) ex.n += t.n;
    else merged.push({ ...t });
  }
  merged.sort((a, b) => b.s - a.s);
  expr.terms = merged;
  cache.set(src, expr);
  return expr;
}

export function addDice(a: string | DiceExpr, b: string | number | DiceExpr): DiceExpr {
  const x = parseDice(a);
  const y = parseDice(b);
  const terms = x.terms.map((t) => ({ ...t }));
  for (const t of y.terms) {
    const ex = terms.find((q) => q.s === t.s);
    if (ex) ex.n += t.n;
    else terms.push({ ...t });
  }
  terms.sort((p, q) => q.s - p.s);
  return { terms, mod: x.mod + y.mod };
}

export function scaleDice(a: string | DiceExpr, factor: number): DiceExpr {
  const x = parseDice(a);
  return { terms: x.terms.map((t) => ({ n: Math.max(1, Math.round(t.n * factor)), s: t.s })), mod: Math.round(x.mod * factor) };
}

export function diceToString(e: DiceExpr | string | number): string {
  const x = parseDice(e);
  const parts = x.terms.map((t) => `${t.n}d${t.s}`);
  let s = parts.join('+');
  if (x.mod > 0) s += (s ? '+' : '') + x.mod;
  else if (x.mod < 0) s += x.mod;
  return s || '0';
}

export function diceMin(e: DiceExpr | string): number {
  const x = parseDice(e);
  return Math.max(0, x.terms.reduce((a, t) => a + t.n, 0) + x.mod);
}

export function diceMax(e: DiceExpr | string, crit = false): number {
  const x = parseDice(e);
  return Math.max(0, x.terms.reduce((a, t) => a + t.n * t.s * (crit ? 2 : 1), 0) + x.mod);
}

export function diceAvg(e: DiceExpr | string, crit = false): number {
  const x = parseDice(e);
  return Math.max(0, x.terms.reduce((a, t) => a + (t.n * (crit ? 2 : 1) * (t.s + 1)) / 2, 0) + x.mod);
}

export function rollDice(rng: Rng, e: DiceExpr | string | number, crit = false): DiceRoll {
  const expr = parseDice(e);
  const dice: DieResult[] = [];
  for (const t of expr.terms) {
    const n = t.n * (crit ? 2 : 1);
    for (let i = 0; i < n; i++) dice.push({ s: t.s, v: rng.int(1, t.s) });
  }
  const total = Math.max(0, dice.reduce((a, d) => a + d.v, 0) + expr.mod);
  return { expr, dice, mod: expr.mod, total, crit };
}

/** Maximized roll (e.g. for "loaded" effects). */
export function maxRoll(e: DiceExpr | string, crit = false): DiceRoll {
  const expr = parseDice(e);
  const dice: DieResult[] = [];
  for (const t of expr.terms) for (let i = 0; i < t.n * (crit ? 2 : 1); i++) dice.push({ s: t.s, v: t.s });
  return { expr, dice, mod: expr.mod, total: Math.max(0, dice.reduce((a, d) => a + d.v, 0) + expr.mod), crit };
}

// ---------------------------------------------------------------- d20 ---

export interface D20Roll {
  /** all physical d20s thrown (1 or 2) */
  rolls: number[];
  /** the die that counts */
  nat: number;
  adv: -1 | 0 | 1;
  /** a natural 1 was rerolled by "lucky" */
  luckyReroll?: number;
}

export function advSign(adv: number): -1 | 0 | 1 {
  return adv > 0 ? 1 : adv < 0 ? -1 : 0;
}

export function rollD20(rng: Rng, adv: number, lucky = false): D20Roll {
  const a = advSign(adv);
  const one = () => {
    let v = rng.int(1, 20);
    let rr: number | undefined;
    if (lucky && v === 1) {
      rr = v;
      v = rng.int(1, 20);
    }
    return { v, rr };
  };
  if (a === 0) {
    const r = one();
    return { rolls: [r.v], nat: r.v, adv: 0, luckyReroll: r.rr };
  }
  const r1 = one();
  const r2 = one();
  const nat = a > 0 ? Math.max(r1.v, r2.v) : Math.min(r1.v, r2.v);
  return { rolls: [r1.v, r2.v], nat, adv: a, luckyReroll: r1.rr ?? r2.rr };
}

/** Probability distribution of the kept natural d20 value. index 1..20 */
export function d20Dist(adv: number, lucky = false): number[] {
  const single = new Array(21).fill(0);
  for (let v = 1; v <= 20; v++) single[v] = 1 / 20;
  if (lucky) {
    // natural 1 rerolled once
    for (let v = 1; v <= 20; v++) single[v] = 1 / 20 + (1 / 20) * (1 / 20);
    single[1] = (1 / 20) * (1 / 20);
  }
  const a = advSign(adv);
  if (a === 0) return single;
  const cdf = new Array(21).fill(0);
  for (let v = 1; v <= 20; v++) cdf[v] = cdf[v - 1] + single[v];
  const out = new Array(21).fill(0);
  for (let v = 1; v <= 20; v++) {
    if (a > 0) out[v] = cdf[v] ** 2 - cdf[v - 1] ** 2;
    else out[v] = (1 - cdf[v - 1]) ** 2 - (1 - cdf[v]) ** 2;
  }
  return out;
}

/** Distribution of the sum of extra dice like bless (+1d4) or bane (-1d4). */
export function bonusDist(terms: { n: number; s: number; sign: 1 | -1 }[]): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]]);
  for (const t of terms) {
    for (let i = 0; i < t.n; i++) {
      const next = new Map<number, number>();
      for (const [k, p] of dist) {
        for (let f = 1; f <= t.s; f++) {
          const key = k + t.sign * f;
          next.set(key, (next.get(key) ?? 0) + p / t.s);
        }
      }
      dist = next;
    }
  }
  return dist;
}

export interface CheckOdds {
  success: number;
  crit: number;
  fumble: number;
}

/**
 * Odds that d20 + mod (+ bonus dice) >= target.
 * autoNat: natural 20 always succeeds and natural 1 always fails.
 */
export function checkOdds(opts: {
  mod: number;
  target: number;
  adv?: number;
  lucky?: boolean;
  critMin?: number;
  bonus?: { n: number; s: number; sign: 1 | -1 }[];
}): CheckOdds {
  const dist = d20Dist(opts.adv ?? 0, opts.lucky);
  const critMin = opts.critMin ?? 20;
  const bonus = bonusDist(opts.bonus ?? []);
  let success = 0;
  let crit = 0;
  for (let v = 1; v <= 20; v++) {
    const p = dist[v];
    if (p === 0) continue;
    if (v === 1) continue;
    if (v >= critMin) {
      crit += p;
      success += p;
      continue;
    }
    if (v === 20) {
      success += p;
      continue;
    }
    for (const [b, pb] of bonus) if (v + opts.mod + b >= opts.target) success += p * pb;
  }
  return { success, crit, fumble: dist[1] };
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}
