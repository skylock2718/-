import { Rng, type RngState } from '../core/rng';
import { allCards, allPotions, canUpgrade, getCard, getPassive, type PassiveDef } from '../core/registry';
import type { CardDef, CardInst, HeroClass, Rarity } from '../core/types';
import { ENCOUNTERS, type EncounterDef } from '../data/encounters';
import { heroById, type HeroDef } from '../data/heroes';
import type { Outcome } from '../data/events';
import { FEAT_LIST, RELIC_LIST } from '../data/passives';
import type { Ability } from '../core/types';

// ======================================================================
// Types
// ======================================================================

export type NodeKind = 'battle' | 'elite' | 'event' | 'shop' | 'rest' | 'treasure' | 'boss';

export interface RunNode {
  id: number;
  row: number;
  col: number;
  kind: NodeKind;
  next: number[];
  encounter?: string;
  visited?: boolean;
}

export interface ActMap {
  act: number;
  rows: number;
  cols: number;
  nodes: RunNode[];
}

export interface PendingReward {
  source: 'battle' | 'elite' | 'boss' | 'treasure' | 'event';
  gold: number;
  cards: string[][];
  cardsUp: boolean[][];
  potion: string | null;
  relic: string | null;
  bossRelics: string[] | null;
  feats: string[] | null;
  claimed: { gold?: boolean; cards: boolean[]; potion?: boolean; relic?: boolean; boss?: boolean; feat?: boolean };
  text?: string;
}

export interface ShopStock {
  cards: { id: string; up: boolean; price: number; sold?: boolean }[];
  relics: { id: string; price: number; sold?: boolean }[];
  potions: { id: string; price: number; sold?: boolean }[];
  removeUsed: boolean;
}

export interface RunStats {
  battles: number;
  elites: number;
  bosses: number;
  dmgDealt: number;
  dmgTaken: number;
  crits: number;
  nat20: number;
  nat1: number;
  kills: number;
  goldEarned: number;
  cardsAdded: number;
  events: number;
  checksPassed: number;
  checksFailed: number;
  rerolls: number;
  floors: number;
}

export interface CheckRoll {
  kind: 'check' | 'luck' | 'table';
  ability?: Ability;
  dc: number;
  nat: number;
  /** natural 1 rerolled by a lucky hero */
  luckyFrom?: number;
  mods: { label: string; value: number }[];
  total: number;
  success: boolean;
}

/** an event option that has been chosen but not fully resolved (persisted) */
export interface EventView {
  option: number;
  roll: CheckRoll | null;
  outcome: Outcome;
  lines: string[];
  phase: 'rolling' | 'result';
  applied?: boolean;
}

export interface RunState {
  v: 2;
  seed: number;
  heroId: string;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInst[];
  relics: string[];
  feats: string[];
  potions: (string | null)[];
  act: number;
  acts: number;
  map: ActMap;
  pos: number | null;
  ascension: number;
  xp: number;
  level: number;
  removeCost: number;
  deckCap: number;
  stats: RunStats;
  pending: PendingReward | null;
  shop: ShopStock | null;
  eventId: string | null;
  seenEvents: string[];
  usedEncounters: string[];
  rng: RngState;
  nextIid: number;
  over: 'win' | 'lose' | null;
  /** node the player entered but has not finished (battle in progress) */
  entered: number | null;
  startedAt: number;
  log: string[];
  /** level-ups waiting for a feat choice */
  levelUps?: number;
  featChoices?: string[] | null;
  eventView?: EventView | null;
  /** encounter id of a fight started by an event */
  eventFight?: string | null;
  /** the current node's one-time action (rest) was used */
  nodeDone?: boolean;
}

export const XP_LEVELS = [0, 4, 9, 15, 22, 30];
export const DECK_CAP = 20;
export const ACT_NAMES = ['', '翡翠林地', '灰烬荒原', '星穹尖塔'];
export const ACT_BIOME = ['', 'verdant', 'ashen', 'astral'] as const;
export const ACT_SUB = ['', 'The Verdant Wilds', 'The Ashen Wastes', 'The Astral Spire'];

// ======================================================================
// Creation
// ======================================================================

export function rngOf(run: RunState): Rng {
  return Rng.fromState(run.rng);
}

export function saveRng(run: RunState, r: Rng): void {
  run.rng = r.state();
}

export function hero(run: RunState): HeroDef {
  return heroById(run.heroId);
}

export function newRun(heroId: string, opts: { seed?: number; acts?: number; ascension?: number } = {}): RunState {
  const h = heroById(heroId);
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed);
  let iid = 1;
  const deck = h.starterDeck.map((id) => ({ iid: iid++, id, up: false }));
  const run: RunState = {
    v: 2,
    seed,
    heroId: h.id,
    hp: h.stats.hp,
    maxHp: h.stats.hp,
    gold: 99,
    deck,
    relics: [h.starterRelic],
    feats: [],
    potions: [null, null, null],
    act: 1,
    acts: opts.acts ?? 3,
    map: { act: 1, rows: 0, cols: 0, nodes: [] },
    pos: null,
    ascension: opts.ascension ?? 0,
    xp: 0,
    level: 1,
    removeCost: 75,
    deckCap: DECK_CAP,
    stats: { battles: 0, elites: 0, bosses: 0, dmgDealt: 0, dmgTaken: 0, crits: 0, nat20: 0, nat1: 0, kills: 0, goldEarned: 0, cardsAdded: 0, events: 0, checksPassed: 0, checksFailed: 0, rerolls: 0, floors: 0 },
    pending: null,
    shop: null,
    eventId: null,
    seenEvents: [],
    usedEncounters: [],
    rng: rng.state(),
    nextIid: iid,
    over: null,
    entered: null,
    startedAt: Date.now(),
    log: [],
  };
  if (run.ascension >= 4) run.hp = Math.floor(run.maxHp * 0.9);
  // starting potion
  run.potions[0] = 'pot-heal';
  run.map = generateActMap(run, 1);
  return run;
}

// ======================================================================
// Map generation (Slay the Spire style: crossing-free paths)
// ======================================================================

export function generateActMap(run: RunState, act: number): ActMap {
  const rng = new Rng(run.seed ^ (act * 0x9e3779b1));
  const ROWS = 8; // regular rows; boss at row ROWS
  const COLS = 7;
  const key = (r: number, c: number) => r * COLS + c;
  const present = new Set<number>();
  const edges = new Map<number, Set<number>>();
  const addEdge = (a: number, b: number) => {
    if (!edges.has(a)) edges.set(a, new Set());
    edges.get(a)!.add(b);
  };
  const crosses = (r: number, c: number, c2: number) => {
    // does an edge (r,c)->(r+1,c2) cross an existing edge (r,x)->(r+1,y)?
    for (let x = 0; x < COLS; x++) {
      const set = edges.get(key(r, x));
      if (!set) continue;
      for (const k of set) {
        const y = k % COLS;
        if ((x < c && y > c2) || (x > c && y < c2)) return true;
      }
    }
    return false;
  };
  const starts: number[] = [];
  for (let p = 0; p < 6; p++) {
    let c = rng.int(0, COLS - 1);
    if (p === 1) while (c === starts[0]) c = rng.int(0, COLS - 1);
    starts.push(c);
    present.add(key(0, c));
    for (let r = 0; r < ROWS - 1; r++) {
      const opts = [c - 1, c, c + 1].filter((x) => x >= 0 && x < COLS && !crosses(r, c, x));
      const n = opts.length ? rng.pick(opts) : c;
      addEdge(key(r, c), key(r + 1, n));
      present.add(key(r + 1, n));
      c = n;
    }
  }
  const nodes: RunNode[] = [];
  const idOf = new Map<number, number>();
  for (const k of [...present].sort((a, b) => a - b)) {
    const id = nodes.length;
    idOf.set(k, id);
    nodes.push({ id, row: Math.floor(k / COLS), col: k % COLS, kind: 'battle', next: [] });
  }
  const boss: RunNode = { id: nodes.length, row: ROWS, col: Math.floor(COLS / 2), kind: 'boss', next: [] };
  nodes.push(boss);
  for (const n of nodes) {
    if (n.kind === 'boss') continue;
    const set = edges.get(key(n.row, n.col));
    if (set) n.next = [...set].map((k) => idOf.get(k)!).filter((x) => x !== undefined);
    if (n.row === ROWS - 1) n.next = [boss.id];
  }
  // node types
  const parents = (id: number) => nodes.filter((p) => p.next.includes(id));
  for (const n of nodes) {
    if (n.kind === 'boss') continue;
    if (n.row === 0) n.kind = 'battle';
    else if (n.row === ROWS - 1) n.kind = 'rest';
    else if (n.row === Math.floor(ROWS / 2)) n.kind = 'treasure';
    else {
      for (let attempt = 0; attempt < 10; attempt++) {
        const k = rng.weighted<NodeKind>(['battle', 'event', 'elite', 'shop', 'rest'], (x) =>
          x === 'battle' ? 44 : x === 'event' ? 24 : x === 'elite' ? (n.row >= 2 ? 13 : 0) : x === 'shop' ? (n.row >= 2 ? 9 : 0) : n.row >= 3 && n.row !== ROWS - 2 ? 10 : 0,
        );
        const bad = (k === 'elite' || k === 'rest' || k === 'shop') && parents(n.id).some((p) => p.kind === k);
        if (!bad) {
          n.kind = k;
          break;
        }
      }
    }
  }
  // guarantee at least one shop and one elite per act if possible
  const mids = nodes.filter((n) => n.row >= 2 && n.row <= ROWS - 2 && n.row !== Math.floor(ROWS / 2));
  if (!nodes.some((n) => n.kind === 'shop') && mids.length) rng.pick(mids.filter((n) => n.kind === 'battle') .concat(mids)).kind = 'shop';
  if (!nodes.some((n) => n.kind === 'elite') && mids.length) rng.pick(mids.filter((n) => n.kind === 'battle').concat(mids)).kind = 'elite';
  // encounters
  const pool = (kind: EncounterDef['kind']) => ENCOUNTERS.filter((e) => e.act === act && e.kind === kind);
  const normals = rng.shuffle(pool('normal').map((e) => e.id));
  const elites = rng.shuffle(pool('elite').map((e) => e.id));
  let ni = 0;
  let ei = 0;
  for (const n of nodes) {
    if (n.kind === 'battle') {
      if (act === 1 && n.row === 0) n.encounter = 'a1-scouts';
      else n.encounter = normals[ni++ % normals.length];
    } else if (n.kind === 'elite') n.encounter = elites[ei++ % elites.length];
    else if (n.kind === 'boss') n.encounter = pool('boss')[0]?.id;
  }
  return { act, rows: ROWS, cols: COLS, nodes };
}

export function nodeById(run: RunState, id: number): RunNode | undefined {
  return run.map.nodes.find((n) => n.id === id);
}

/** nodes the player may step onto next */
export function reachableNodes(run: RunState): RunNode[] {
  if (run.pos == null) return run.map.nodes.filter((n) => n.row === 0);
  const cur = nodeById(run, run.pos);
  if (!cur) return [];
  return cur.next.map((id) => nodeById(run, id)!).filter(Boolean);
}

// ======================================================================
// Passives on the run
// ======================================================================

export function runPassives(run: RunState): PassiveDef[] {
  return [...hero(run).passives ?? [], ...run.relics, ...run.feats].map((id) => getPassive(id)).filter((x): x is PassiveDef => !!x);
}

export function potionSlots(run: RunState): number {
  return 3 + runPassives(run).reduce((a, p) => a + (p.potionSlots ?? 0), 0);
}

export function ensurePotionSlots(run: RunState): void {
  const n = potionSlots(run);
  while (run.potions.length < n) run.potions.push(null);
}

export function addRelic(run: RunState, id: string): void {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  const p = getPassive(id);
  if (p?.heroHp) {
    run.maxHp += p.heroHp;
    run.hp += p.heroHp;
  }
  if (p?.pickupGold) gainGold(run, p.pickupGold);
  ensurePotionSlots(run);
}

export function addFeat(run: RunState, id: string): void {
  if (run.feats.includes(id)) return;
  run.feats.push(id);
  const p = getPassive(id);
  if (p?.heroHp) {
    run.maxHp += p.heroHp;
    run.hp += p.heroHp;
  }
}

export function gainGold(run: RunState, n: number): void {
  run.gold = Math.max(0, run.gold + n);
  if (n > 0) run.stats.goldEarned += n;
}

export function heal(run: RunState, n: number): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.max(0, n));
  return run.hp - before;
}

export function damage(run: RunState, n: number): void {
  run.hp = Math.max(0, run.hp - n);
  if (run.hp <= 0) run.over = 'lose';
}

export function addPotion(run: RunState, id: string): boolean {
  ensurePotionSlots(run);
  const i = run.potions.indexOf(null);
  if (i < 0) return false;
  run.potions[i] = id;
  return true;
}

export function addCard(run: RunState, id: string, up = false): CardInst {
  const inst = { iid: run.nextIid++, id, up };
  run.deck.push(inst);
  run.stats.cardsAdded++;
  return inst;
}

export function removeCard(run: RunState, iid: number): void {
  run.deck = run.deck.filter((c) => c.iid !== iid);
}

export function upgradeCard(run: RunState, iid: number): boolean {
  const c = run.deck.find((x) => x.iid === iid);
  if (!c || !canUpgrade(c)) return false;
  c.up = true;
  return true;
}

export function deckFull(run: RunState): boolean {
  return run.deck.length >= run.deckCap;
}

// ======================================================================
// Card pools & rewards
// ======================================================================

export function classOf(run: RunState): HeroClass {
  return hero(run).cls;
}

export function rewardPool(cls: HeroClass): CardDef[] {
  return allCards().filter((c) => (c.pool === cls || c.pool === 'neutral') && c.rarity !== 'basic' && c.rarity !== 'token' && c.type !== 'curse');
}

const RARITY_W: Record<string, Partial<Record<Rarity, number>>> = {
  battle: { common: 62, rare: 30, epic: 7, legendary: 1 },
  elite: { common: 38, rare: 40, epic: 18, legendary: 4 },
  boss: { rare: 50, epic: 38, legendary: 12 },
  shop: { common: 50, rare: 34, epic: 13, legendary: 3 },
  event: { common: 45, rare: 38, epic: 14, legendary: 3 },
};

export function rollCards(run: RunState, rng: Rng, n: number, source: keyof typeof RARITY_W, exclude: string[] = []): string[] {
  const cls = classOf(run);
  const pool = rewardPool(cls);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = RARITY_W[source];
    const rarity = rng.weighted(Object.keys(w) as Rarity[], (r) => w[r] ?? 0);
    const classBias = rng.chance(0.68);
    let cands = pool.filter((c) => c.rarity === rarity && !out.includes(c.id) && !exclude.includes(c.id) && (classBias ? c.pool === cls : c.pool === 'neutral'));
    if (!cands.length) cands = pool.filter((c) => c.rarity === rarity && !out.includes(c.id));
    if (!cands.length) cands = pool.filter((c) => !out.includes(c.id));
    if (!cands.length) break;
    out.push(rng.pick(cands).id);
  }
  return out;
}

export function rollRelic(run: RunState, rng: Rng, tiers: ('common' | 'uncommon' | 'rare' | 'boss')[] = ['common', 'uncommon', 'rare']): string | null {
  const cls = classOf(run);
  const owned = new Set(run.relics);
  const weights: Record<string, number> = { common: 50, uncommon: 35, rare: 15, boss: 100 };
  const tier = rng.weighted(tiers, (t) => weights[t]);
  let cands = RELIC_LIST.filter((r) => r.rarity === tier && !owned.has(r.id) && (!r.hero || r.hero === cls));
  if (!cands.length) cands = RELIC_LIST.filter((r) => tiers.includes(r.rarity as never) && !owned.has(r.id) && (!r.hero || r.hero === cls));
  if (!cands.length) return null;
  return rng.pick(cands).id;
}

export function rollPotion(rng: Rng): string {
  const all = allPotions();
  return rng.weighted(all, (p) => (p.rarity === 'common' ? 3 : p.rarity === 'uncommon' ? 1.6 : 0.6)).id;
}

export function rollFeats(run: RunState, rng: Rng, n = 3): string[] {
  const cands = FEAT_LIST.filter((f) => !run.feats.includes(f.id));
  return rng.sample(cands, n).map((f) => f.id);
}

/** XP needed for next level (or null at cap) */
export function xpForNext(run: RunState): number | null {
  return XP_LEVELS[run.level] ?? null;
}

export function gainXp(run: RunState, n: number): number {
  run.xp += n;
  let ups = 0;
  while (XP_LEVELS[run.level] !== undefined && run.xp >= XP_LEVELS[run.level]) {
    run.level++;
    run.maxHp += 3;
    run.hp += 3;
    ups++;
  }
  return ups;
}

export function battleRewards(run: RunState, kind: 'battle' | 'elite' | 'boss', goldFromBattle: number): PendingReward {
  const rng = rngOf(run);
  const actMul = 1 + (run.act - 1) * 0.2;
  const passives = runPassives(run);
  const goldBonus = passives.reduce((a, p) => a + (p.goldBonus ?? 0), 0);
  const base = kind === 'battle' ? rng.int(15, 25) : kind === 'elite' ? rng.int(32, 45) : rng.int(75, 95);
  const asc = run.ascension >= 2 ? 0.85 : 1;
  const gold = Math.round(base * actMul * asc * (1 + goldBonus / 100)) + goldFromBattle;
  const choices = 3 + passives.reduce((a, p) => a + (p.cardChoices ?? 0), 0);
  const upChance = run.act === 1 ? 0.05 : run.act === 2 ? 0.15 : 0.3;
  const cards = [rollCards(run, rng, choices, kind)];
  const cardsUp = cards.map((row) => row.map(() => rng.chance(upChance)));
  const potion = rng.chance(kind === 'battle' ? 0.4 : 0.6) ? rollPotion(rng) : null;
  const relic = kind === 'elite' ? rollRelic(run, rng) : null;
  const bossRelics: string[] | null = kind === 'boss' && run.act < run.acts ? [] : null;
  if (bossRelics) {
    for (let i = 0; i < 3; i++) {
      const r = rollRelic({ ...run, relics: [...run.relics, ...bossRelics] }, rng, ['boss']);
      if (r) bossRelics.push(r);
    }
  }
  saveRng(run, rng);
  return { source: kind, gold, cards, cardsUp, potion, relic, bossRelics, feats: null, claimed: { cards: cards.map(() => false) } };
}

export function treasureRewards(run: RunState): PendingReward {
  const rng = rngOf(run);
  const relic = rollRelic(run, rng);
  const gold = rng.int(25, 50);
  saveRng(run, rng);
  return { source: 'treasure', gold, cards: [], cardsUp: [], potion: null, relic, bossRelics: null, feats: null, claimed: { cards: [] } };
}

// ======================================================================
// Shop
// ======================================================================

const CARD_PRICE: Partial<Record<Rarity, number>> = { common: 50, rare: 78, epic: 115, legendary: 165, basic: 40 };
const RELIC_PRICE: Record<string, number> = { common: 145, uncommon: 195, rare: 255, shop: 160, boss: 300, starter: 100, event: 150 };

export function shopDiscount(run: RunState): number {
  return runPassives(run).reduce((a, p) => a + (p.shopDiscount ?? 0), 0);
}

export function makeShop(run: RunState): ShopStock {
  const rng = rngOf(run);
  const disc = 1 - shopDiscount(run) / 100;
  const cls = classOf(run);
  const pool = rewardPool(cls);
  const pickCards = (n: number, classOnly: boolean) => {
    const out: CardDef[] = [];
    for (let i = 0; i < n; i++) {
      const w = RARITY_W.shop;
      const rarity = rng.weighted(Object.keys(w) as Rarity[], (r) => w[r] ?? 0);
      let c = pool.filter((x) => x.rarity === rarity && (classOnly ? x.pool === cls : x.pool === 'neutral') && !out.includes(x));
      if (!c.length) c = pool.filter((x) => !out.includes(x));
      out.push(rng.pick(c));
    }
    return out;
  };
  const cards = [...pickCards(3, true), ...pickCards(2, false)].map((c) => ({ id: c.id, up: rng.chance(0.12 * run.act), price: Math.round((CARD_PRICE[c.rarity] ?? 60) * (0.9 + rng.next() * 0.2) * disc) }));
  const sale = rng.int(0, cards.length - 1);
  cards[sale].price = Math.round(cards[sale].price / 2);
  const relics: ShopStock['relics'] = [];
  for (let i = 0; i < 3; i++) {
    const id = rollRelic({ ...run, relics: [...run.relics, ...relics.map((r) => r.id)] }, rng, i === 2 ? ['uncommon', 'rare'] : ['common', 'uncommon', 'rare']);
    if (!id) continue;
    const r = getPassive(id)!;
    relics.push({ id, price: Math.round((RELIC_PRICE[r.rarity ?? 'common'] ?? 150) * (0.92 + rng.next() * 0.16) * disc) });
  }
  const potions = [0, 1, 2].map(() => {
    const id = rollPotion(rng);
    return { id, price: Math.round((allPotions().find((p) => p.id === id)?.price ?? 50) * (0.9 + rng.next() * 0.2) * disc) };
  });
  saveRng(run, rng);
  return { cards, relics, potions, removeUsed: false };
}

export function removePrice(run: RunState): number {
  return Math.round(run.removeCost * (1 - shopDiscount(run) / 100));
}

// ======================================================================
// Battles
// ======================================================================

export function encounterFor(run: RunState, node: RunNode): EncounterDef {
  const id = node.encounter ?? 'a1-goblins';
  return ENCOUNTERS.find((e) => e.id === id) ?? ENCOUNTERS[1];
}

export function battleSeed(run: RunState, node: RunNode): number {
  return (run.seed ^ (run.act * 7919) ^ (node.id * 104729)) >>> 0;
}

export function cardName(id: string): string {
  return getCard(id).name;
}
