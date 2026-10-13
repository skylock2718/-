import type { BiomeId, NodeKind, Pos, SurfaceType, TerrainType, Tile } from './types';

export const DIRS4: Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const DIRS8: Pos[] = [
  ...DIRS4,
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

export function cheb(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function samePos(a: Pos | null | undefined, b: Pos | null | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

/** How tall impassable obstacles stand above their tile, for line of sight. */
const OBSTACLE_HEIGHT: Partial<Record<TerrainType, number>> = { rock: 2.2, ruins: 1.6 };

export interface MoveOpts {
  flying?: boolean;
  jump: number;
  swim?: boolean;
  scout?: boolean;
  /** returns 'enemy' if an enemy occupies the tile, 'ally' if friendly, null if empty */
  occ: (x: number, y: number) => 'enemy' | 'ally' | null;
  /** tiles where movement must stop (zone of control) */
  stopAt?: (x: number, y: number) => boolean;
}

export interface ReachInfo {
  cost: number;
  prev: number;
}

export class Board {
  readonly w: number;
  readonly h: number;
  readonly biome: BiomeId;
  tiles: Tile[];

  constructor(w: number, h: number, biome: BiomeId, tiles?: Tile[]) {
    this.w = w;
    this.h = h;
    this.biome = biome;
    this.tiles =
      tiles ??
      Array.from({ length: w * h }, (_, i) => ({
        x: i % w,
        y: Math.floor(i / w),
        h: 0,
        terrain: 'plain' as TerrainType,
        variant: 0,
        surface: null,
        surfaceTurns: 0,
        surfaceOwner: null,
        node: null,
        deco: null,
      }));
  }

  clone(): Board {
    return new Board(
      this.w,
      this.h,
      this.biome,
      this.tiles.map((t) => ({ ...t, node: t.node ? { ...t.node } : null })),
    );
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  pos(i: number): Pos {
    return { x: i % this.w, y: Math.floor(i / this.w) };
  }

  at(x: number, y: number): Tile | undefined {
    return this.inBounds(x, y) ? this.tiles[y * this.w + x] : undefined;
  }

  get(p: Pos): Tile {
    const t = this.at(p.x, p.y);
    if (!t) throw new Error(`tile out of bounds ${p.x},${p.y}`);
    return t;
  }

  neighbors4(p: Pos): Tile[] {
    const out: Tile[] = [];
    for (const d of DIRS4) {
      const t = this.at(p.x + d.x, p.y + d.y);
      if (t) out.push(t);
    }
    return out;
  }

  neighbors8(p: Pos): Tile[] {
    const out: Tile[] = [];
    for (const d of DIRS8) {
      const t = this.at(p.x + d.x, p.y + d.y);
      if (t) out.push(t);
    }
    return out;
  }

  /** All tiles within Chebyshev radius r of center. */
  area(center: Pos, r: number): Tile[] {
    const out: Tile[] = [];
    for (let y = center.y - r; y <= center.y + r; y++)
      for (let x = center.x - r; x <= center.x + r; x++) {
        const t = this.at(x, y);
        if (t) out.push(t);
      }
    return out;
  }

  /** Straight line of tiles starting next to `from` heading towards `toward`. */
  line(from: Pos, toward: Pos, len: number): Tile[] {
    const dx = Math.sign(toward.x - from.x);
    const dy = Math.sign(toward.y - from.y);
    const out: Tile[] = [];
    if (dx === 0 && dy === 0) return out;
    for (let i = 1; i <= len; i++) {
      const t = this.at(from.x + dx * i, from.y + dy * i);
      if (!t) break;
      out.push(t);
    }
    return out;
  }

  nodes(kind?: NodeKind): Tile[] {
    return this.tiles.filter((t) => t.node && (!kind || t.node.kind === kind));
  }

  /** Can a unit stand on this tile at all (ignoring occupancy)? */
  standable(t: Tile, flying = false, swim = false): boolean {
    if (t.terrain === 'rock' || t.terrain === 'ruins') return false;
    if (t.terrain === 'deep') return flying || swim;
    return true;
  }

  /** Base movement cost to enter tile t from tile f. Infinity if impossible. */
  stepCost(f: Tile, t: Tile, o: Pick<MoveOpts, 'flying' | 'jump' | 'swim' | 'scout'>): number {
    if (o.flying) {
      if (t.terrain === 'rock') return Infinity;
      return 1;
    }
    if (t.terrain === 'rock' || t.terrain === 'ruins') return Infinity;
    if (t.terrain === 'deep' && !o.swim) return Infinity;
    const dh = t.h - f.h;
    if (dh > o.jump) return Infinity;
    if (-dh > o.jump + 1) return Infinity;
    let c = 1;
    if (!o.scout) {
      if (t.terrain === 'forest') c = 2;
      else if (t.terrain === 'water') c = o.swim ? 1 : 2;
      else if (t.terrain === 'deep') c = 2;
      if (t.surface === 'oil') c += 1;
    }
    if (dh > 0) c += dh;
    return c;
  }

  /**
   * Dijkstra over 4-neighbours. Returns map tileIndex -> {cost, prev}.
   * Includes tiles that are passable but occupied by allies (cannot end there:
   * caller must filter with canEnd).
   */
  reach(start: Pos, mp: number, o: MoveOpts): Map<number, ReachInfo> {
    const out = new Map<number, ReachInfo>();
    const startI = this.idx(start.x, start.y);
    out.set(startI, { cost: 0, prev: -1 });
    // tiny binary-heap-free Dijkstra: boards are small (<= 15x15)
    const open: number[] = [startI];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (out.get(open[i])!.cost < out.get(open[bi])!.cost) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ci = out.get(cur)!;
      const cp = this.pos(cur);
      if (cur !== startI && o.stopAt?.(cp.x, cp.y)) continue;
      const ct = this.tiles[cur];
      for (const d of DIRS4) {
        const nx = cp.x + d.x;
        const ny = cp.y + d.y;
        const nt = this.at(nx, ny);
        if (!nt) continue;
        const occ = o.occ(nx, ny);
        if (occ === 'enemy' && !o.flying) continue;
        const sc = this.stepCost(ct, nt, o);
        if (!isFinite(sc)) continue;
        const nc = ci.cost + sc;
        if (nc > mp) continue;
        const ni = this.idx(nx, ny);
        const ex = out.get(ni);
        if (!ex || ex.cost > nc) {
          out.set(ni, { cost: nc, prev: cur });
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return out;
  }

  pathTo(reach: Map<number, ReachInfo>, target: Pos): Pos[] | null {
    let i = this.idx(target.x, target.y);
    if (!reach.has(i)) return null;
    const path: Pos[] = [];
    while (i !== -1) {
      path.push(this.pos(i));
      i = reach.get(i)!.prev;
    }
    return path.reverse();
  }

  /**
   * Line of sight between two tiles, accounting for terrain height and tall
   * obstacles. Eye height ~1 level above the tile; visible if any of a few
   * points on the target's body can be seen.
   */
  los(a: Pos, b: Pos, eyeA = 1.0): boolean {
    if (cheb(a, b) <= 1) return true;
    const ta = this.get(a);
    const tb = this.get(b);
    const ax = a.x + 0.5;
    const ay = a.y + 0.5;
    const bx = b.x + 0.5;
    const by = b.y + 0.5;
    const az = ta.h + eyeA;
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(dist * 10);
    for (const bodyZ of [0.35, 0.75, 1.1]) {
      const bz = tb.h + bodyZ;
      let blocked = false;
      for (let s = 1; s < steps; s++) {
        const f = s / steps;
        const px = ax + (bx - ax) * f;
        const py = ay + (by - ay) * f;
        const tx = Math.floor(px);
        const ty = Math.floor(py);
        if ((tx === a.x && ty === a.y) || (tx === b.x && ty === b.y)) continue;
        const t = this.at(tx, ty);
        if (!t) continue;
        const top = t.h + (OBSTACLE_HEIGHT[t.terrain] ?? 0);
        const z = az + (bz - az) * f;
        if (z < top - 0.05) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
    return false;
  }

  /** Contiguous water tiles connected to p (4-neighbour). */
  waterBody(p: Pos): Tile[] {
    const start = this.get(p);
    if (start.terrain !== 'water' && start.terrain !== 'deep') return [];
    const seen = new Set<number>([this.idx(p.x, p.y)]);
    const q: Tile[] = [start];
    const out: Tile[] = [];
    while (q.length) {
      const t = q.pop()!;
      out.push(t);
      for (const n of this.neighbors4(t)) {
        const i = this.idx(n.x, n.y);
        if (seen.has(i)) continue;
        if ((n.terrain === 'water' || n.terrain === 'deep') && n.surface !== 'ice') {
          seen.add(i);
          q.push(n);
        }
      }
    }
    return out;
  }

  setSurface(t: Tile, s: SurfaceType | null, turns: number, owner: number | null): void {
    t.surface = s;
    t.surfaceTurns = s ? turns : 0;
    t.surfaceOwner = s ? owner : null;
  }
}
