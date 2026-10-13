/**
 * Small, fast, serializable seeded RNG (sfc32). All gameplay randomness flows
 * through an Rng so battles and runs are reproducible from a seed.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string = Date.now()) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = s ^ 0xdeadbeef;
    for (let i = 0; i < 15; i++) this.nextU32();
  }

  static fromState(state: RngState): Rng {
    const r = new Rng(0);
    r.a = state[0];
    r.b = state[1];
    r.c = state[2];
    r.d = state[3];
    return r;
  }

  state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  nextU32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** float in [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick; weights must be >= 0 and not all zero. */
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Pick n distinct items. */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr.slice()).slice(0, Math.min(n, arr.length));
  }

  /** Derive an independent child generator. */
  fork(): Rng {
    return new Rng(this.nextU32());
  }
}

export type RngState = [number, number, number, number];

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
