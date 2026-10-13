import { Board, cheb, DIRS4 } from './board';
import { Rng } from './rng';
import type { BiomeId, NodeKind, Pos, TerrainType, Tile } from './types';

export interface MapGenOpts {
  biome: BiomeId;
  w?: number;
  h?: number;
  players?: number;
  seed: number;
  /** special layouts for elites / bosses */
  layout?: 'open' | 'fortress' | 'graveyard' | 'astral' | 'lair' | 'crossroads';
  /** how many event nodes to place */
  events?: number;
}

export interface GeneratedMap {
  board: Board;
  spawns: Pos[];
}

interface BiomeRules {
  maxH: number;
  forest: number;
  water: number;
  rock: number;
  ruins: number;
  lava: number;
  deep: number;
  roughness: number;
}

const BIOMES: Record<BiomeId, BiomeRules> = {
  verdant: { maxH: 3, forest: 0.2, water: 0.11, rock: 0.04, ruins: 0.02, lava: 0, deep: 0.03, roughness: 0.55 },
  ashen: { maxH: 3, forest: 0.06, water: 0.0, rock: 0.07, ruins: 0.05, lava: 0.09, deep: 0, roughness: 0.6 },
  astral: { maxH: 4, forest: 0.0, water: 0.04, rock: 0.05, ruins: 0.03, lava: 0, deep: 0.09, roughness: 0.75 },
};

function valueNoise(rng: Rng, w: number, h: number, cell: number): number[] {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng.next());
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / cell;
      const fy = y / cell;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const g = (i: number, j: number) => grid[j * gw + i];
      const a = g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx;
      const b = g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx;
      out.push(a * (1 - sy) + b * sy);
    }
  }
  return out;
}

function fbm(rng: Rng, w: number, h: number, rough: number): number[] {
  const a = valueNoise(rng, w, h, 4);
  const b = valueNoise(rng, w, h, 2);
  const c = valueNoise(rng, w, h, 1.3);
  const out = a.map((v, i) => v + b[i] * rough * 0.6 + c[i] * rough * 0.25);
  const min = Math.min(...out);
  const max = Math.max(...out);
  return out.map((v) => (v - min) / (max - min || 1));
}

/** Map position under the symmetry group for n players. */
function mirrors(p: Pos, w: number, h: number, players: number): Pos[] {
  if (players <= 2) return [p, { x: w - 1 - p.x, y: h - 1 - p.y }];
  // 4-fold rotation for square boards
  const n = w;
  return [p, { x: n - 1 - p.y, y: p.x }, { x: n - 1 - p.x, y: n - 1 - p.y }, { x: p.y, y: n - 1 - p.x }];
}

function isCanonical(p: Pos, w: number, h: number, players: number): boolean {
  // the tile that represents its symmetry orbit = lexicographically smallest index
  const ms = mirrors(p, w, h, players);
  const idx = (q: Pos) => q.y * w + q.x;
  const me = idx(p);
  return ms.every((q) => idx(q) >= me);
}

export function spawnPoints(w: number, h: number, players: number): Pos[] {
  if (players <= 2) {
    const cx = Math.floor(w / 2);
    return [
      { x: cx, y: h - 1 },
      { x: w - 1 - cx, y: 0 },
    ].slice(0, Math.max(2, players));
  }
  const c = Math.floor(w / 2);
  const all = [
    { x: c, y: h - 1 },
    { x: 0, y: c },
    { x: w - 1 - c, y: 0 },
    { x: w - 1, y: h - 1 - c },
  ];
  // rotation order: bottom, left, top, right -> matches mirrors() order? we just need distinct fair spots
  return all.slice(0, players);
}

export function generateMap(o: MapGenOpts): GeneratedMap {
  const players = o.players ?? 2;
  const square = players > 2;
  let w = o.w ?? (square ? 11 : 9);
  let h = o.h ?? (square ? 11 : 9);
  if (square) h = w;
  const rng = new Rng(o.seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const g = tryGenerate(o, w, h, players, rng.fork());
    if (g) return g;
  }
  // fallback: flat board
  const board = new Board(w, h, o.biome);
  board.tiles.forEach((t) => (t.variant = rng.next()));
  return { board, spawns: spawnPoints(w, h, players) };
}

function tryGenerate(o: MapGenOpts, w: number, h: number, players: number, rng: Rng): GeneratedMap | null {
  const rules = BIOMES[o.biome];
  const board = new Board(w, h, o.biome);
  const hn = fbm(rng, w, h, rules.roughness);
  const tn = fbm(rng, w, h, 0.8);
  const fn = fbm(rng, w, h, 1.0);
  const spawns = spawnPoints(w, h, players);

  // heights & base terrain for canonical tiles, then copy to mirrors
  for (const t of board.tiles) {
    if (!isCanonical(t, w, h, players)) continue;
    const i = t.y * w + t.x;
    const v = hn[i];
    let lvl = Math.floor(v * (rules.maxH + 0.999));
    // plateau-ify: push mid values a bit for more distinct terraces
    lvl = Math.max(0, Math.min(rules.maxH, lvl));
    let terrain: TerrainType = 'plain';
    const low = v < 0.2;
    if (low && rules.water > 0 && tn[i] > 1 - rules.water * 4) terrain = 'water';
    if (low && rules.lava > 0 && tn[i] > 1 - rules.lava * 4) terrain = 'lava';
    if (terrain === 'plain' && rules.deep > 0 && v < 0.12 && fn[i] > 0.55) terrain = 'deep';
    if (terrain === 'plain' && fn[i] > 1 - rules.forest * 2.2 && lvl > 0) terrain = 'forest';
    if (terrain === 'plain' && rng.chance(rules.rock)) terrain = 'rock';
    else if (terrain === 'plain' && rng.chance(rules.ruins)) terrain = 'ruins';
    if (terrain === 'water' || terrain === 'lava' || terrain === 'deep') lvl = 0;
    for (const m of mirrors(t, w, h, players)) {
      const mt = board.get(m);
      mt.h = lvl;
      mt.terrain = terrain;
    }
  }
  for (const t of board.tiles) t.variant = rng.next();

  // layouts
  applyLayout(o.layout ?? 'open', board, rng, spawns, players);

  // flatten spawn areas
  for (const s of spawns) {
    const base = board.get(s).h;
    const lvl = Math.min(base, 2);
    for (const t of board.area(s, 1)) {
      if (cheb(t, s) <= 1) {
        t.terrain = 'plain';
        t.h = Math.max(0, Math.min(rules.maxH, cheb(t, s) === 0 ? lvl : Math.round((t.h + lvl) / 2)));
        if (Math.abs(t.h - lvl) > 1) t.h = lvl;
      }
    }
  }

  // nodes
  const used = new Set<string>();
  const key = (p: Pos) => `${p.x},${p.y}`;
  for (const s of spawns) for (const t of board.area(s, 1)) used.add(key(t));
  const placeSym = (kind: NodeKind, filter: (t: Tile) => boolean): boolean => {
    const cands = board.tiles.filter((t) => isCanonical(t, w, h, players) && !used.has(key(t)) && nodeOk(board, t) && filter(t));
    if (!cands.length) return false;
    const c = rng.pick(cands);
    const ms = mirrors(c, w, h, players);
    const uniq = ms.filter((m, i) => ms.findIndex((q) => q.x === m.x && q.y === m.y) === i);
    for (const m of uniq) {
      const mt = board.get(m);
      if (!nodeOk(board, mt) || used.has(key(mt))) return false;
    }
    for (const m of uniq) {
      const mt = board.get(m);
      mt.node = { kind, owner: null };
      if (mt.terrain === 'forest') mt.terrain = 'plain';
      used.add(key(mt));
      for (const n of board.neighbors8(mt)) used.add(key(n));
    }
    return true;
  };
  const midBand = (t: Tile) => {
    if (players > 2) {
      const c = (w - 1) / 2;
      const d = Math.max(Math.abs(t.x - c), Math.abs(t.y - c));
      return d <= w * 0.3 && d >= 1;
    }
    return t.y >= Math.floor(h * 0.3) && t.y <= Math.ceil(h * 0.7) - 1;
  };
  const nearSides = (t: Tile) => {
    if (players > 2) return true;
    return t.y >= Math.floor(h * 0.25) && t.y <= Math.ceil(h * 0.75) && (t.x <= 1 || t.x >= w - 2);
  };

  // shrine at the exact centre when possible
  const centre = { x: Math.floor((w - 1) / 2), y: Math.floor((h - 1) / 2) };
  const ct = board.get(centre);
  if ((w % 2 === 1 && h % 2 === 1) || players > 2) {
    if (ct.terrain !== 'plain' && ct.terrain !== 'forest') {
      ct.terrain = 'plain';
      ct.h = Math.max(1, ct.h);
    }
    ct.terrain = 'plain';
    ct.node = { kind: 'shrine', owner: null };
    used.add(key(ct));
    for (const n of board.neighbors8(ct)) used.add(key(n));
  } else {
    placeSym('shrine', midBand);
  }
  placeSym('well', midBand) || placeSym('well', () => true);
  if (rng.chance(0.6)) placeSym('gate', nearSides) || placeSym('gate', midBand);
  if (rng.chance(0.5)) placeSym('spring', () => true);
  const eventKinds: NodeKind[] = ['chest', 'altar', 'rune', 'gold'];
  const nEvents = o.events ?? 2;
  for (let i = 0; i < nEvents; i++) placeSym(rng.pick(eventKinds), () => true);

  // decorations
  for (const t of board.tiles) {
    if (t.terrain === 'forest') t.deco = 'trees';
    else if (t.terrain === 'plain' && !t.node && t.variant < 0.18) t.deco = o.biome === 'verdant' ? (t.variant < 0.06 ? 'flowers' : 'grass') : o.biome === 'ashen' ? (t.variant < 0.06 ? 'bones' : 'embers') : t.variant < 0.06 ? 'shards' : 'motes';
  }

  if (!connected(board, spawns)) return null;
  return { board, spawns };
}

function nodeOk(board: Board, t: Tile): boolean {
  return (t.terrain === 'plain' || t.terrain === 'forest') && !t.node;
}

function applyLayout(layout: NonNullable<MapGenOpts['layout']>, board: Board, rng: Rng, spawns: Pos[], players: number): void {
  const { w, h } = board;
  if (layout === 'fortress') {
    // walls of ruins around the enemy (top) commander with two gates, high ground inside
    const s = spawns[1];
    for (const t of board.tiles) {
      const d = cheb(t, s);
      if (d === 2 && t.y <= s.y + 2) {
        const gap = t.y === s.y + 2 && Math.abs(t.x - s.x) === 1;
        t.terrain = gap ? 'plain' : rng.chance(0.85) ? 'ruins' : 'plain';
        t.h = Math.max(t.h, 1);
      } else if (d <= 1) {
        t.h = Math.max(1, Math.min(2, t.h + 1));
        t.terrain = 'plain';
      }
    }
  } else if (layout === 'graveyard') {
    for (const t of board.tiles) {
      if (t.terrain === 'plain' && rng.chance(0.09) && cheb(t, spawns[0]) > 2 && cheb(t, spawns[1]) > 1) t.terrain = 'ruins';
    }
  } else if (layout === 'astral') {
    // chasms of void around the middle, floating platforms
    for (const t of board.tiles) {
      const ex = Math.abs(t.x - (w - 1) / 2);
      const ey = Math.abs(t.y - (h - 1) / 2);
      if (ey < 1 && ex > 1.5 && ex < 3.5 && rng.chance(0.7)) {
        t.terrain = 'deep';
        t.h = 0;
      }
      if (t.terrain === 'plain' && (t.x + t.y) % 2 === 0 && rng.chance(0.2)) t.h = Math.min(4, t.h + 1);
    }
  } else if (layout === 'lair') {
    // a big raised plateau in the middle with ramps
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (const t of board.tiles) {
      const d = Math.max(Math.abs(t.x - cx), Math.abs(t.y - cy));
      if (d <= 1.5) {
        t.h = 3;
        if (t.terrain !== 'plain' && !t.node) t.terrain = 'plain';
      } else if (d <= 2.5 && t.h < 2) t.h = 2;
    }
  } else if (layout === 'crossroads') {
    for (const t of board.tiles) {
      if (t.x === Math.floor(w / 2) || t.y === Math.floor(h / 2)) {
        if (t.terrain !== 'plain') t.terrain = 'plain';
        t.h = Math.min(t.h, 1);
      }
    }
  }
  void players;
}

/** Walkers with jump 1 must be able to reach every spawn and every node. */
function connected(board: Board, spawns: Pos[]): boolean {
  const start = spawns[0];
  const seen = new Set<number>([board.idx(start.x, start.y)]);
  const q: Pos[] = [start];
  while (q.length) {
    const p = q.pop()!;
    const ct = board.get(p);
    for (const d of DIRS4) {
      const nt = board.at(p.x + d.x, p.y + d.y);
      if (!nt) continue;
      const i = board.idx(nt.x, nt.y);
      if (seen.has(i)) continue;
      if (!isFinite(board.stepCost(ct, nt, { jump: 1 }))) continue;
      // must also be able to come back (up-climb limits)
      if (!isFinite(board.stepCost(nt, ct, { jump: 1 }))) continue;
      seen.add(i);
      q.push(nt);
    }
  }
  for (const s of spawns) if (!seen.has(board.idx(s.x, s.y))) return false;
  for (const t of board.nodes()) if (!seen.has(board.idx(t.x, t.y))) return false;
  // at least 60% of standable tiles should be reachable (no isolated mesas everywhere)
  const standable = board.tiles.filter((t) => board.standable(t)).length;
  return seen.size >= standable * 0.6;
}
