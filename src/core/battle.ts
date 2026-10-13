import { Board, cheb, DIRS8, posKey } from './board';
import { advSign, checkOdds, diceAvg, diceMax, diceMin, diceToString, parseDice, addDice, rollD20, rollDice, type DiceRoll, abilityMod } from './dice';
import { Rng } from './rng';
import { cardOf, getCard, getPassive, getPotion, type PassiveDef } from './registry';
import type {
  Ability,
  AbilityDef,
  BattleEvent,
  BattleIO,
  BuffStat,
  CardDef,
  CardInst,
  CommanderDef,
  DamageType,
  Effect,
  EffectCtx,
  Keyword,
  KeywordMap,
  Mod,
  Num,
  PlayerId,
  Pos,
  RollEvent,
  SaveType,
  Selector,
  Status,
  StatusId,
  SurfaceType,
  TargetSpec,
  Tile,
  TriggerDef,
  TriggerOn,
  Tribe,
  Uid,
  UnitStats,
} from './types';

// ======================================================================
// Types
// ======================================================================

export interface Unit {
  uid: Uid;
  owner: PlayerId;
  cardId: string;
  up: boolean;
  name: string;
  icon: string;
  colors?: [string, string, string];
  isHero: boolean;
  cardIid: number | null;
  token: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ac: number;
  atk: number;
  dmg: string;
  dmgType: DamageType;
  range: number;
  move: number;
  jump: number;
  saves: Record<SaveType, number>;
  kw: KeywordMap;
  tempKw: { kw: Keyword; value: number; turns: number }[];
  buffs: { stat: BuffStat; amount: number; turns: number }[];
  statuses: Status[];
  tribe: Tribe[];
  resist: DamageType[];
  vuln: DamageType[];
  immune: DamageType[];
  equipment: { id: string; up: boolean; iid: number | null }[];
  equipDmg: string[];
  triggers: TriggerDef[];
  ability: AbilityDef | null;
  abilityCd: number;
  mp: number;
  actions: number;
  reaction: boolean;
  moved: number;
  sick: boolean;
  ward: number;
  dead: boolean;
  summonedTurn: number;
  fx: string;
  scale: number;
  kills: number;
}

export interface PlayerSetup {
  name: string;
  isAI: boolean;
  team: number;
  color: string;
  commander: CommanderDef;
  heroHp?: number;
  heroMaxHp?: number;
  deck: CardInst[];
  passives: string[];
  potions?: (string | null)[];
  abilities?: Record<Ability, number>;
  prof?: number;
  /** 0 (random-ish) .. 1 (sharp) */
  aiLevel?: number;
}

export interface BattleSetup {
  board: Board;
  players: PlayerSetup[];
  spawns: Pos[];
  seed: number;
  firstPlayer?: number;
  karmic?: boolean;
  /** extra rule hooks for special encounters */
  rules?: string[];
}

export interface PlayerStats {
  dmgDealt: number;
  dmgTaken: number;
  kills: number;
  crits: number;
  nat20: number;
  nat1: number;
  cardsPlayed: number;
  rerolls: number;
  summons: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  isAI: boolean;
  team: number;
  color: string;
  commander: CommanderDef;
  heroUid: Uid;
  deck: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  exhausted: CardInst[];
  mana: number;
  maxMana: number;
  manaCap: number;
  fate: number;
  maxFate: number;
  replaced: boolean;
  powerUsed: boolean;
  alive: boolean;
  passives: string[];
  potions: (string | null)[];
  abilities: Record<Ability, number>;
  prof: number;
  spellDC: number;
  spellAtk: number;
  handMax: number;
  drawPerTurn: number;
  noReplace: boolean;
  failStreak: number;
  aiLevel: number;
  stats: PlayerStats;
  /** per-battle scratch flags for passives */
  flags: Record<string, number>;
  gold: number;
}

export interface Ctx {
  player: PlayerId;
  source: Unit | null;
  targetUnit: Unit | null;
  targetPos: Pos | null;
  area: Tile[] | null;
  card: CardDef | null;
  upgraded: boolean;
  params: Record<string, string | number>;
  other: Unit | null;
  isSpell: boolean;
  /** damage rolled once per effect list for AoE */
  label: string;
}

export interface AttackPreview {
  ok: boolean;
  reason?: string;
  ranged: boolean;
  mods: Mod[];
  adv: -1 | 0 | 1;
  ac: number;
  hit: number;
  crit: number;
  critMin: number;
  dmg: string;
  extras: { label: string; dice: string }[];
  min: number;
  max: number;
  avg: number;
  /** probability estimate of killing the target with this single attack */
  kill: number;
}

const HAND_MAX = 7;
export const DOOM_ROUND = 15;
/** max non-hero units per player on the board */
export const UNIT_CAP = 7;
const MANA_CAP = 9;
const DEFAULT_ABILITIES: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

export const STATUS_NAMES: Record<StatusId, string> = {
  burning: '燃烧',
  poisoned: '中毒',
  stunned: '眩晕',
  frozen: '冻结',
  rooted: '定身',
  prone: '倒地',
  frightened: '恐惧',
  blessed: '祝福',
  baned: '灾祸',
  hasted: '加速',
  slowed: '迟缓',
  marked: '印记',
  regen: '再生',
  inspired: '激昂',
  stoneskin: '石肤',
  weakened: '虚弱',
  vulnerable: '易伤',
  shielded: '庇护',
  hidden: '潜行',
  doomed: '厄运',
  charmed: '魅惑',
};

const NEGATIVE_STATUS = new Set<StatusId>(['burning', 'poisoned', 'stunned', 'frozen', 'rooted', 'prone', 'frightened', 'baned', 'slowed', 'marked', 'weakened', 'vulnerable', 'doomed', 'charmed']);
const CONTROL_STATUS = new Set<StatusId>(['stunned', 'frozen', 'rooted', 'prone']);

export const DMG_NAMES: Record<DamageType, string> = {
  physical: '物理',
  fire: '火焰',
  cold: '冰霜',
  lightning: '闪电',
  poison: '毒素',
  radiant: '光耀',
  necrotic: '暗蚀',
  arcane: '奥术',
  psychic: '心灵',
};

export const SAVE_NAMES: Record<SaveType, string> = { fort: '强韧', ref: '反射', will: '意志' };
export const ABILITY_NAMES: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

export const headlessIO: BattleIO = {
  emit: () => {},
  askReroll: async () => false,
};

// ======================================================================
// Battle
// ======================================================================

export class Battle {
  readonly board: Board;
  readonly rng: Rng;
  readonly players: PlayerState[] = [];
  readonly units = new Map<Uid, Unit>();
  readonly karmic: boolean;
  readonly rules: Set<string>;
  io: BattleIO;
  active: PlayerId = 0;
  turn = 0;
  round = 1;
  over = false;
  winner: PlayerId | null = null;
  winnerTeam: number | null = null;
  firstPlayer: PlayerId;
  private nextUid = 1;
  private nextIid = 100000;
  readonly spawns: Pos[];
  /** tiles where units died this battle (for raise dead) */
  graves: Pos[] = [];
  log: { text: string; tone?: string }[] = [];
  /** depth guard for nested triggers */
  private depth = 0;

  constructor(setup: BattleSetup, io: BattleIO = headlessIO) {
    this.board = setup.board;
    this.rng = new Rng(setup.seed);
    this.io = io;
    this.karmic = setup.karmic ?? true;
    this.rules = new Set(setup.rules ?? []);
    this.spawns = setup.spawns;
    this.firstPlayer = setup.firstPlayer ?? 0;
    setup.players.forEach((ps, i) => this.players.push(this.makePlayer(ps, i)));
    // heroes
    setup.players.forEach((ps, i) => {
      const p = this.players[i];
      const hero = this.makeUnit(i, ps.commander.stats, {
        cardId: ps.commander.id,
        name: ps.commander.name,
        icon: ps.commander.icon,
        colors: ps.commander.colors,
        isHero: true,
        up: false,
        cardIid: null,
        token: false,
      });
      const pas = this.passivesOf(p);
      for (const pa of pas) {
        hero.maxHp += pa.heroHp ?? 0;
        hero.ac += pa.heroAc ?? 0;
        hero.atk += pa.heroAtk ?? 0;
        hero.move += pa.heroMove ?? 0;
      }
      if (ps.heroMaxHp) hero.maxHp = ps.heroMaxHp;
      hero.hp = Math.min(hero.maxHp, ps.heroHp ?? hero.maxHp);
      const sp = setup.spawns[i];
      hero.x = sp.x;
      hero.y = sp.y;
      this.units.set(hero.uid, hero);
      p.heroUid = hero.uid;
    });
  }

  private makePlayer(ps: PlayerSetup, id: PlayerId): PlayerState {
    const abilities = ps.abilities ?? ps.commander.abilities ?? DEFAULT_ABILITIES;
    const prof = ps.prof ?? 2;
    const cast = abilityMod(abilities[ps.commander.castAbility] ?? 10);
    const p: PlayerState = {
      id,
      name: ps.name,
      isAI: ps.isAI,
      team: ps.team,
      color: ps.color,
      commander: ps.commander,
      heroUid: 0,
      deck: ps.deck.map((c) => ({ ...c })),
      hand: [],
      discard: [],
      exhausted: [],
      mana: 0,
      maxMana: 0,
      manaCap: MANA_CAP,
      fate: 0,
      maxFate: 3,
      replaced: false,
      powerUsed: false,
      alive: true,
      passives: [...(ps.commander.passives ?? []), ...ps.passives],
      potions: ps.potions ? [...ps.potions] : [],
      abilities,
      prof,
      spellDC: 8 + prof + cast,
      spellAtk: prof + cast,
      handMax: HAND_MAX,
      drawPerTurn: 2,
      noReplace: false,
      failStreak: 0,
      aiLevel: ps.aiLevel ?? 0.8,
      stats: { dmgDealt: 0, dmgTaken: 0, kills: 0, crits: 0, nat20: 0, nat1: 0, cardsPlayed: 0, rerolls: 0, summons: 0 },
      flags: {},
      gold: 0,
    };
    let startFate = 1;
    for (const pa of this.passivesOf(p)) {
      p.maxFate += pa.maxFate ?? 0;
      startFate += pa.startFate ?? 0;
      p.manaCap += pa.maxManaCap ?? 0;
      p.spellDC += pa.spellDC ?? 0;
      p.drawPerTurn += pa.drawPerTurn ?? 0;
      if (pa.noReplace) p.noReplace = true;
    }
    p.fate = Math.min(p.maxFate, startFate);
    return p;
  }

  makeUnit(
    owner: PlayerId,
    s: UnitStats,
    meta: { cardId: string; name: string; icon: string; colors?: [string, string, string]; isHero: boolean; up: boolean; cardIid: number | null; token: boolean },
  ): Unit {
    const saves: Record<SaveType, number> = { fort: 1, ref: 1, will: 1, ...(s.saves ?? {}) };
    const u: Unit = {
      uid: this.nextUid++,
      owner,
      cardId: meta.cardId,
      up: meta.up,
      name: meta.name,
      icon: meta.icon,
      colors: meta.colors,
      isHero: meta.isHero,
      cardIid: meta.cardIid,
      token: meta.token,
      x: 0,
      y: 0,
      hp: s.hp,
      maxHp: s.hp,
      ac: s.ac,
      atk: s.atk,
      dmg: s.dmg,
      dmgType: s.dmgType ?? 'physical',
      range: s.range,
      move: s.move,
      jump: s.jump ?? 1,
      saves,
      kw: { ...(s.kw ?? {}) },
      tempKw: [],
      buffs: [],
      statuses: [],
      tribe: [...(s.tribe ?? [])],
      resist: [...(s.resist ?? [])],
      vuln: [...(s.vuln ?? [])],
      immune: [...(s.immune ?? [])],
      equipment: [],
      equipDmg: [],
      triggers: [...(s.triggers ?? [])],
      ability: s.ability ?? null,
      abilityCd: 0,
      mp: 0,
      actions: 0,
      reaction: true,
      moved: 0,
      sick: true,
      ward: s.kw?.ward ?? 0,
      dead: false,
      summonedTurn: this.turn,
      fx: s.fx ?? (s.range > 1 ? 'arrow' : 'slash'),
      scale: s.scale ?? (meta.isHero ? 1.2 : 1),
      kills: 0,
    };
    if (u.tribe.includes('undead') || u.tribe.includes('construct')) {
      if (!u.immune.includes('poison')) u.immune.push('poison');
    }
    if (s.kw?.stealth) u.statuses.push({ id: 'hidden', turns: 99 });
    return u;
  }

  // ====================================================================
  // Basic queries
  // ====================================================================

  get activePlayer(): PlayerState {
    return this.players[this.active];
  }

  player(id: PlayerId): PlayerState {
    return this.players[id];
  }

  hero(p: PlayerId): Unit {
    return this.units.get(this.players[p].heroUid)!;
  }

  unit(uid: Uid | null | undefined): Unit | undefined {
    if (uid == null) return undefined;
    const u = this.units.get(uid);
    return u && !u.dead ? u : undefined;
  }

  alive(): Unit[] {
    const out: Unit[] = [];
    for (const u of this.units.values()) if (!u.dead) out.push(u);
    return out;
  }

  unitAt(x: number, y: number): Unit | undefined {
    for (const u of this.units.values()) if (!u.dead && u.x === x && u.y === y) return u;
    return undefined;
  }

  unitsOf(p: PlayerId): Unit[] {
    return this.alive().filter((u) => u.owner === p);
  }

  hostile(a: PlayerId, b: PlayerId): boolean {
    return this.players[a].team !== this.players[b].team;
  }

  enemiesOf(p: PlayerId): Unit[] {
    return this.alive().filter((u) => this.hostile(p, u.owner));
  }

  alliesOf(p: PlayerId): Unit[] {
    return this.alive().filter((u) => !this.hostile(p, u.owner));
  }

  tileOf(u: Pos): Tile {
    return this.board.get(u);
  }

  passivesOf(p: PlayerState): PassiveDef[] {
    const out: PassiveDef[] = [];
    for (const id of p.passives) {
      const d = getPassive(id);
      if (d) out.push(d);
    }
    return out;
  }

  hasPassive(p: PlayerId, id: string): boolean {
    return this.players[p].passives.includes(id);
  }

  // ---- effective stats

  status(u: Unit, id: StatusId): Status | undefined {
    return u.statuses.find((s) => s.id === id);
  }

  has(u: Unit, id: StatusId): boolean {
    return u.statuses.some((s) => s.id === id);
  }

  kw(u: Unit, k: Keyword): number {
    let v = u.kw[k] ?? 0;
    for (const t of u.tempKw) if (t.kw === k) v += t.value;
    return v;
  }

  buffSum(u: Unit, stat: BuffStat): number {
    let v = 0;
    for (const b of u.buffs) if (b.stat === stat) v += b.amount;
    return v;
  }

  adjacentAllies(u: Pos & { owner: PlayerId }, excludeUid?: Uid): Unit[] {
    return this.alive().filter((o) => o.uid !== excludeUid && !this.hostile(u.owner, o.owner) && cheb(o, u) === 1);
  }

  adjacentEnemies(u: Pos & { owner: PlayerId }): Unit[] {
    return this.alive().filter((o) => this.hostile(u.owner, o.owner) && cheb(o, u) === 1);
  }

  acOf(u: Unit, at: Pos = u): number {
    let ac = u.ac + this.buffSum(u, 'ac');
    let aura = 0;
    for (const a of this.alive()) {
      if (a.uid === u.uid || this.hostile(a.owner, u.owner) || cheb(a, at) !== 1) continue;
      aura = Math.max(aura, this.kw(a, 'auraAC'));
    }
    ac += aura;
    if (u.moved === 0) ac += this.kw(u, 'fortify');
    const sh = this.status(u, 'shielded');
    if (sh) ac += sh.value ?? 2;
    if (this.has(u, 'slowed')) ac -= 1;
    const owner = this.players[u.owner];
    for (const pa of this.passivesOf(owner)) ac += pa.acBonus?.(this, u, owner) ?? 0;
    return ac;
  }

  atkOf(u: Unit, at: Pos = u): number {
    let a = u.atk + this.buffSum(u, 'atk');
    let aura = 0;
    for (const o of this.alive()) {
      if (o.uid === u.uid || this.hostile(o.owner, u.owner) || cheb(o, at) !== 1) continue;
      aura = Math.max(aura, this.kw(o, 'auraAtk'));
    }
    return a + aura;
  }

  moveOf(u: Unit): number {
    let m = u.move + this.buffSum(u, 'move');
    if (this.has(u, 'hasted')) m += 2;
    if (this.has(u, 'slowed')) m -= 2;
    return Math.max(0, m);
  }

  jumpOf(u: Unit): number {
    return u.jump + this.kw(u, 'climb');
  }

  baseRange(u: Unit): number {
    if (u.range > 1) return u.range + this.buffSum(u, 'range');
    return this.kw(u, 'reach') > 0 ? 2 : 1;
  }

  isRanged(u: Unit): boolean {
    return u.range > 1;
  }

  isFlying(u: Unit): boolean {
    return this.kw(u, 'flying') > 0;
  }

  critMin(u: Unit): number {
    let c = 20 - this.kw(u, 'keen');
    const owner = this.players[u.owner];
    for (const pa of this.passivesOf(owner)) c -= pa.critBonus?.(this, u, owner) ?? 0;
    return Math.max(15, c);
  }

  isLucky(u: Unit): boolean {
    if (this.kw(u, 'lucky') > 0) return true;
    const owner = this.players[u.owner];
    return this.passivesOf(owner).some((pa) => pa.lucky?.(this, u, owner));
  }

  isControlled(u: Unit): boolean {
    return this.has(u, 'stunned') || this.has(u, 'frozen');
  }

  canMove(u: Unit): boolean {
    if (u.dead || u.owner !== this.active || this.over) return false;
    if (u.sick || this.isControlled(u) || this.has(u, 'rooted')) return false;
    if (this.kw(u, 'immobile') > 0) return false;
    if (u.mp <= 0) return false;
    if (this.provokedBy(u, u).length > 0) return false;
    return true;
  }

  canAct(u: Unit): boolean {
    return !u.dead && u.owner === this.active && !this.over && !u.sick && u.actions > 0 && !this.isControlled(u);
  }

  /** enemy provokers adjacent to position */
  provokedBy(u: Unit, at: Pos): Unit[] {
    return this.alive().filter((o) => this.hostile(o.owner, u.owner) && this.kw(o, 'provoke') > 0 && cheb(o, at) === 1 && !this.isControlled(o));
  }

  // ====================================================================
  // Movement
  // ====================================================================

  reachMap(u: Unit, mp = u.mp) {
    const flying = this.isFlying(u);
    return this.board.reach(u, mp, {
      flying,
      jump: this.jumpOf(u),
      swim: this.kw(u, 'swim') > 0,
      scout: this.kw(u, 'scout') > 0,
      occ: (x, y) => {
        const o = this.unitAt(x, y);
        if (!o || o.uid === u.uid) return null;
        // hidden enemies don't block knowledge-wise, but physically they do: treat as enemy
        return this.hostile(o.owner, u.owner) ? 'enemy' : 'ally';
      },
      stopAt: (x, y) => this.provokedBy(u, { x, y }).length > 0,
    });
  }

  /** Tiles the unit can end a move on, with path cost. */
  reachable(u: Unit): Map<string, { cost: number; path: Pos[] }> {
    const out = new Map<string, { cost: number; path: Pos[] }>();
    if (!this.canMove(u)) return out;
    const r = this.reachMap(u);
    const flying = this.isFlying(u);
    for (const [i, info] of r) {
      const p = this.board.pos(i);
      if (p.x === u.x && p.y === u.y) continue;
      const t = this.board.tiles[i];
      if (!this.board.standable(t, flying, this.kw(u, 'swim') > 0)) continue;
      if (this.unitAt(p.x, p.y)) continue;
      out.set(posKey(p), { cost: info.cost, path: this.board.pathTo(r, p)! });
    }
    return out;
  }

  // ====================================================================
  // Attack queries
  // ====================================================================

  attackRange(u: Unit, from: Pos, target: Pos): number {
    let r = this.baseRange(u);
    if (this.isRanged(u)) {
      const dh = this.tileOf(from).h - this.tileOf(target).h;
      if (dh >= 2) r += 1;
      if (dh >= 1 && this.kw(u, 'vantage') > 0) r += 1;
    }
    return r;
  }

  canTarget(viewer: PlayerId, target: Unit, from: Pos): boolean {
    if (this.has(target, 'hidden') && this.hostile(viewer, target.owner) && cheb(from, target) > 1) return false;
    return true;
  }

  canAttack(u: Unit, target: Unit, from: Pos = u): { ok: boolean; reason?: string } {
    if (target.dead || u.dead) return { ok: false, reason: '目标无效' };
    if (!this.hostile(u.owner, target.owner)) return { ok: false, reason: '不能攻击友军' };
    if (!this.canTarget(u.owner, target, from)) return { ok: false, reason: '目标处于潜行' };
    const d = cheb(from, target);
    const ft = this.tileOf(from);
    const tt = this.tileOf(target);
    const range = this.attackRange(u, from, target);
    if (d > range) return { ok: false, reason: '超出射程' };
    if (!this.isRanged(u)) {
      const dh = Math.abs(ft.h - tt.h);
      const maxDh = this.kw(u, 'reach') > 0 ? 2 : 1;
      if (dh > maxDh && !this.isFlying(u) && !this.isFlying(target)) return { ok: false, reason: '高度差过大，近战够不着' };
    } else if (d >= 2 && !this.board.los(from, target)) {
      return { ok: false, reason: '视线受阻' };
    }
    const prov = this.provokedBy(u, from);
    if (prov.length && !prov.some((p) => p.uid === target.uid)) return { ok: false, reason: '被嘲讽：必须先攻击嘲讽单位' };
    return { ok: true };
  }

  attackTargets(u: Unit, from: Pos = u): Unit[] {
    return this.enemiesOf(u.owner).filter((t) => this.canAttack(u, t, from).ok);
  }

  /** Is `ally` flanking `target` relative to an attacker at `from`? */
  private flanking(owner: PlayerId, from: Pos, target: Unit, attackerUid: Uid): boolean {
    if (cheb(from, target) !== 1) return false;
    const ox = target.x * 2 - from.x;
    const oy = target.y * 2 - from.y;
    const o = this.unitAt(ox, oy);
    return !!o && o.uid !== attackerUid && !this.hostile(owner, o.owner) && !this.isControlled(o);
  }

  attackMods(u: Unit, target: Unit, from: Pos = u): Mod[] {
    const mods: Mod[] = [];
    const ranged = this.isRanged(u);
    mods.push({ label: '命中加值', value: this.atkOf(u, from) });
    const dh = this.tileOf(from).h - this.tileOf(target).h;
    if (dh >= 1) {
      mods.push({ label: '高地优势', value: 2 });
      if (this.kw(u, 'vantage') > 0) mods.push({ label: '高地专精', value: 1 });
    } else if (dh <= -1) {
      mods.push({ label: '低地劣势', value: -2 });
    }
    if (ranged && this.tileOf(target).terrain === 'forest') mods.push({ label: '森林掩体', value: -2 });
    const pa = this.kw(u, 'pierceArmor');
    if (pa) mods.push({ label: '破甲', value: pa });
    const bt = this.kw(u, 'bloodthirst');
    if (bt && target.hp < target.maxHp) mods.push({ label: '嗜血', value: bt });
    if (this.has(u, 'blessed')) mods.push({ label: '祝福', dice: '1d4' });
    if (this.has(u, 'baned')) mods.push({ label: '灾祸', dice: '-1d4' });
    // advantage sources
    if (this.has(u, 'hidden')) mods.push({ label: '潜行突袭', adv: 1 });
    if (this.has(target, 'stunned') || this.has(target, 'frozen')) mods.push({ label: '目标失能', adv: 1 });
    if (this.has(target, 'rooted')) mods.push({ label: '目标被束缚', adv: 1 });
    if (this.has(target, 'prone')) mods.push(ranged ? { label: '目标倒地(远程)', adv: -1 } : { label: '目标倒地', adv: 1 });
    if (!ranged && this.flanking(u.owner, from, target, u.uid)) mods.push({ label: '夹击', adv: 1 });
    if (this.kw(u, 'pack') > 0 && this.adjacentAllies({ x: target.x, y: target.y, owner: u.owner }, u.uid).length > 0) mods.push({ label: '群狼战术', adv: 1 });
    // disadvantage sources
    if (this.has(u, 'poisoned')) mods.push({ label: '中毒', adv: -1 });
    if (this.has(u, 'frightened')) mods.push({ label: '恐惧', adv: -1 });
    if (this.has(u, 'rooted')) mods.push({ label: '被束缚', adv: -1 });
    if (ranged && this.adjacentEnemies({ x: from.x, y: from.y, owner: u.owner }).length > 0) mods.push({ label: '近身干扰', adv: -1 });
    const owner = this.players[u.owner];
    if ((owner.flags.nextAttackAdv ?? 0) > 0 && owner.id === this.active) mods.push({ label: '灌铅骰', adv: 1 });
    const curse = owner.hand.filter((c) => c.id === 'curse-misfortune').length;
    if (curse) mods.push({ label: '厄运诅咒', value: -curse });
    for (const p of this.passivesOf(owner)) p.attackMods?.(this, u, target, mods, owner);
    return mods;
  }

  static advOf(mods: Mod[]): -1 | 0 | 1 {
    const a = mods.some((m) => m.adv === 1) ? 1 : 0;
    const d = mods.some((m) => m.adv === -1) ? 1 : 0;
    return advSign(a - d);
  }

  /** Damage parts for an attack (base + extras). */
  damageParts(u: Unit, target: Unit, adv: number, from: Pos = u): { base: string; extras: { label: string; dice: string }[] } {
    const extras: { label: string; dice: string }[] = [];
    let base = u.dmg;
    const flat = this.buffSum(u, 'dmg');
    if (flat) extras.push({ label: '增益', dice: String(flat) });
    for (const e of u.equipDmg) extras.push({ label: '装备', dice: e });
    const sneak = this.kw(u, 'sneak');
    if (sneak && adv >= 0 && (adv > 0 || this.adjacentAllies({ x: target.x, y: target.y, owner: u.owner }, u.uid).length > 0)) extras.push({ label: '偷袭', dice: `${sneak}d6` });
    const mark = this.status(target, 'marked');
    if (mark && mark.by === u.owner) extras.push({ label: '猎人印记', dice: `${mark.value ?? 1}d6` });
    const charge = this.kw(u, 'charge');
    if (charge && u.moved >= 3) extras.push({ label: '冲锋', dice: String(charge) });
    const frenzy = this.kw(u, 'frenzy');
    if (frenzy && u.hp * 2 <= u.maxHp) extras.push({ label: '狂暴', dice: String(frenzy) });
    const ins = this.status(u, 'inspired');
    if (ins) extras.push({ label: '激昂', dice: String(ins.value ?? 2) });
    let auraDmg = 0;
    for (const o of this.alive()) {
      if (o.uid === u.uid || this.hostile(o.owner, u.owner) || cheb(o, from) !== 1) continue;
      auraDmg = Math.max(auraDmg, this.kw(o, 'inspire'));
    }
    if (auraDmg) extras.push({ label: '鼓舞', dice: String(auraDmg) });
    if (this.has(u, 'weakened')) extras.push({ label: '虚弱', dice: '-2' });
    const owner = this.players[u.owner];
    for (const p of this.passivesOf(owner)) {
      const b = p.damageBonus?.(this, u, target, owner);
      if (b) extras.push({ label: p.name, dice: String(b) });
    }
    return { base, extras };
  }

  /** Expected final damage after resistances. */
  private mitigate(target: Unit, amount: number, type: DamageType): number {
    if (target.immune.includes(type)) return 0;
    let a = amount;
    const resist = target.resist.includes(type) || (type === 'physical' && this.has(target, 'stoneskin'));
    if (resist) a = Math.floor(a / 2);
    if (target.vuln.includes(type)) a *= 2;
    if (this.has(target, 'vulnerable')) a = Math.ceil(a * 1.5);
    if (type === 'physical') a -= this.kw(target, 'shield');
    return Math.max(0, a);
  }

  previewAttack(u: Unit, target: Unit, from: Pos = u): AttackPreview {
    const can = this.canAttack(u, target, from);
    const mods = this.attackMods(u, target, from);
    const adv = Battle.advOf(mods);
    const ac = this.acOf(target);
    const flat = mods.reduce((a, m) => a + (m.value ?? 0), 0);
    const bonus = mods
      .filter((m) => m.dice)
      .map((m) => {
        const neg = m.dice!.startsWith('-');
        const d = parseDice(m.dice!.replace('-', ''));
        return { n: d.terms[0]?.n ?? 1, s: d.terms[0]?.s ?? 4, sign: (neg ? -1 : 1) as 1 | -1 };
      });
    const critMin = this.critMin(u);
    const odds = checkOdds({ mod: flat, target: ac, adv, lucky: this.isLucky(u), critMin, bonus });
    const { base, extras } = this.damageParts(u, target, adv, from);
    let expr = parseDice(base);
    for (const e of extras) expr = addDice(expr, e.dice);
    const dmgStr = diceToString(expr);
    const min = this.mitigate(target, diceMin(expr), u.dmgType);
    const max = this.mitigate(target, diceMax(expr), u.dmgType);
    const avgN = this.mitigate(target, Math.round(diceAvg(expr)), u.dmgType);
    const avgC = this.mitigate(target, Math.round(diceAvg(expr, true)), u.dmgType);
    const flurry = this.kw(u, 'flurry') > 0 ? 2 : 1;
    // kill estimate (rough): chance that hit (non-crit) roll >= hp, plus crit chance
    const hp = target.hp + (target.ward > 0 ? 999 : 0);
    const pNormKill = hp <= min ? 1 : hp > max ? 0 : Math.max(0, Math.min(1, (max - hp + 1) / Math.max(1, max - min + 1)));
    const maxC = this.mitigate(target, diceMax(expr, true), u.dmgType);
    const pCritKill = hp <= min ? 1 : hp > maxC ? 0 : Math.max(0, Math.min(1, (maxC - hp + 1) / Math.max(1, maxC - min + 1)));
    let kill = (odds.success - odds.crit) * pNormKill + odds.crit * pCritKill;
    if (flurry > 1) kill = 1 - (1 - kill) * (1 - kill * 0.6);
    return {
      ok: can.ok,
      reason: can.reason,
      ranged: this.isRanged(u),
      mods,
      adv,
      ac,
      hit: odds.success,
      crit: odds.crit,
      critMin,
      dmg: dmgStr,
      extras,
      min,
      max,
      avg: ((odds.success - odds.crit) * avgN + odds.crit * avgC) * flurry,
      kill: Math.min(1, kill),
    };
  }

  // ====================================================================
  // Card queries
  // ====================================================================

  costOf(p: PlayerState, inst: CardInst): number {
    const def = cardOf(inst);
    let c = def.cost + (inst.costMod ?? 0);
    for (const pa of this.passivesOf(p)) c += pa.cardCost?.(this, p, def) ?? 0;
    return Math.max(0, c);
  }

  summonTiles(p: PlayerId, card?: CardDef): Pos[] {
    const out: Pos[] = [];
    const seen = new Set<string>();
    const airdrop = !!card?.unit?.kw?.airdrop;
    const flying = !!card?.unit?.kw?.flying;
    const swim = !!card?.unit?.kw?.swim;
    const add = (t: Tile) => {
      const k = posKey(t);
      if (seen.has(k)) return;
      seen.add(k);
      if (!this.board.standable(t, flying, swim)) return;
      if (this.unitAt(t.x, t.y)) return;
      out.push({ x: t.x, y: t.y });
    };
    if (airdrop) {
      const enemies = this.enemiesOf(p);
      for (const t of this.board.tiles) if (!enemies.some((e) => cheb(e, t) <= 1)) add(t);
      return out;
    }
    const hero = this.hero(p);
    if (!hero.dead) for (const t of this.board.neighbors8(hero)) add(t);
    for (const t of this.board.nodes('gate')) if (t.node!.owner === p) for (const n of this.board.neighbors8(t)) add(n);
    return out;
  }

  /** Valid target positions for a target spec cast from `origin`. */
  targetsFor(p: PlayerId, spec: TargetSpec, origin: Unit | null): Pos[] {
    if (spec.kind === 'none') return [];
    const out: Pos[] = [];
    const inRange = (t: Pos) => spec.range === undefined || !origin || cheb(origin, t) <= spec.range;
    const losOk = (t: Pos) => !spec.los || !origin || this.board.los(origin, t);
    if (spec.kind === 'unit') {
      for (const u of this.alive()) {
        if (spec.side === 'enemy' && !this.hostile(p, u.owner)) continue;
        if (spec.side === 'ally' && this.hostile(p, u.owner)) continue;
        if (spec.notHero && u.isHero) continue;
        if (spec.onlyHero && !u.isHero) continue;
        if (spec.tribe && !u.tribe.includes(spec.tribe)) continue;
        if (spec.notSelf && origin && u.uid === origin.uid) continue;
        if (spec.damaged && u.hp >= u.maxHp) continue;
        if (this.hostile(p, u.owner) && !this.canTarget(p, u, origin ?? u)) continue;
        if (!inRange(u) || !losOk(u)) continue;
        out.push({ x: u.x, y: u.y });
      }
      return out;
    }
    // tile
    if (spec.line && origin) {
      for (const d of DIRS8) {
        for (let i = 1; i <= spec.line; i++) {
          const t = this.board.at(origin.x + d.x * i, origin.y + d.y * i);
          if (!t) break;
          out.push({ x: t.x, y: t.y });
        }
      }
      return out;
    }
    for (const t of this.board.tiles) {
      if (!inRange(t) || !losOk(t)) continue;
      if (spec.empty && (this.unitAt(t.x, t.y) || !this.board.standable(t))) continue;
      if (spec.grave && !(this.graves.some((g) => g.x === t.x && g.y === t.y) || (origin && cheb(origin, t) === 1))) continue;
      out.push({ x: t.x, y: t.y });
    }
    return out;
  }

  cardTargets(p: PlayerId, inst: CardInst): Pos[] {
    const def = cardOf(inst);
    if (def.type === 'unit') return this.summonTiles(p, def);
    if (def.type === 'equip') {
      return this.alliesOf(p)
        .filter((u) => u.owner === p)
        .filter((u) => (def.equip?.onlyRanged ? this.isRanged(u) : true) && (def.equip?.onlyMelee ? !this.isRanged(u) : true))
        .filter((u) => (def.target?.notHero ? !u.isHero : true))
        .map((u) => ({ x: u.x, y: u.y }));
    }
    if (!def.target || def.target.kind === 'none') return [];
    return this.targetsFor(p, def.target, this.hero(p));
  }

  needsTarget(def: CardDef): boolean {
    if (def.type === 'unit' || def.type === 'equip') return true;
    return !!def.target && def.target.kind !== 'none';
  }

  canPlay(p: PlayerId, inst: CardInst): { ok: boolean; reason?: string } {
    if (this.over) return { ok: false, reason: '战斗已结束' };
    if (this.active !== p) return { ok: false, reason: '不是你的回合' };
    const ps = this.players[p];
    const def = cardOf(inst);
    if (def.unplayable) return { ok: false, reason: '无法打出' };
    if (this.costOf(ps, inst) > ps.mana) return { ok: false, reason: '法力不足' };
    if ((def.fate ?? 0) > ps.fate) return { ok: false, reason: '命运点不足' };
    if (def.type === 'unit' && this.unitCount(p) >= UNIT_CAP) return { ok: false, reason: `场上单位已满（${UNIT_CAP}）` };
    if (this.needsTarget(def) && this.cardTargets(p, inst).length === 0) return { ok: false, reason: '没有合法目标' };
    return { ok: true };
  }

  /** tiles affected by an AoE spec at a target point */
  areaOf(spec: TargetSpec | undefined, origin: Pos | null, target: Pos | null): Tile[] | null {
    if (!spec || !target) return null;
    if (spec.line && origin) return this.board.line(origin, target, spec.line);
    if (spec.radius !== undefined && spec.kind === 'tile') return this.board.area(target, spec.radius);
    return null;
  }

  // ====================================================================
  // Event helpers
  // ====================================================================

  async emit(ev: BattleEvent): Promise<void> {
    if (ev.t === 'log') this.log.push({ text: ev.text, tone: ev.tone });
    const r = this.io.emit(ev);
    if (r) await r;
  }

  async say(text: string, tone?: 'good' | 'bad' | 'info' | 'crit' | 'fate'): Promise<void> {
    await this.emit({ t: 'log', text, tone });
  }

  newIid(): number {
    return this.nextIid++;
  }

  uname(u: Unit): string {
    return `${u.name}`;
  }

  // ====================================================================
  // Battle flow
  // ====================================================================

  async start(): Promise<void> {
    await this.emit({ t: 'battleStart' });
    for (const p of this.players) {
      this.rng.shuffle(p.deck);
      p.maxMana = p.id === this.firstPlayer ? 1 : 2;
      for (const pa of this.passivesOf(p)) p.maxMana += pa.startMana ?? 0;
    }
    for (const p of this.players) {
      let n = p.id === this.firstPlayer ? 4 : 5;
      for (const pa of this.passivesOf(p)) n += pa.handSize ?? 0;
      await this.draw(p.id, n, true);
    }
    for (const p of this.players) for (const pa of this.passivesOf(p)) await pa.battleStart?.(this, p);
    this.active = this.firstPlayer;
    this.turn = 1;
    await this.beginTurn(this.active);
  }

  async draw(pid: PlayerId, n: number, silentShuffle = false): Promise<void> {
    const p = this.players[pid];
    for (let i = 0; i < n; i++) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) return;
        p.deck = this.rng.shuffle(p.discard.splice(0));
        if (!silentShuffle) await this.emit({ t: 'shuffle', player: pid });
      }
      const c = p.deck.shift()!;
      if (p.hand.length >= p.handMax) {
        p.discard.push(c);
        await this.emit({ t: 'burn', player: pid, id: c.id });
        continue;
      }
      p.hand.push(c);
      await this.emit({ t: 'draw', player: pid, iid: c.iid, id: c.id });
    }
  }

  async gainMana(pid: PlayerId, n: number): Promise<void> {
    const p = this.players[pid];
    p.mana = Math.max(0, p.mana + n);
    await this.emit({ t: 'mana', player: pid, mana: p.mana, max: p.maxMana, delta: n });
  }

  async gainFate(pid: PlayerId, n: number): Promise<void> {
    const p = this.players[pid];
    const before = p.fate;
    p.fate = Math.max(0, Math.min(p.maxFate, p.fate + n));
    if (p.fate !== before) await this.emit({ t: 'fate', player: pid, fate: p.fate, delta: p.fate - before });
  }

  async beginTurn(pid: PlayerId): Promise<void> {
    const p = this.players[pid];
    p.maxMana = Math.min(p.manaCap, p.maxMana + 1);
    p.mana = p.maxMana;
    p.replaced = false;
    p.powerUsed = false;
    await this.emit({ t: 'turnStart', player: pid, turn: this.turn, round: this.round });
    // node income
    let manaBonus = 0;
    let fateBonus = 0;
    for (const t of this.board.nodes()) {
      if (t.node!.owner !== pid) continue;
      if (t.node!.kind === 'well') {
        let inc = 1;
        for (const pa of this.passivesOf(p)) inc += pa.nodeIncome?.(this, p, 'well') ?? 0;
        manaBonus += inc;
      } else if (t.node!.kind === 'shrine') {
        let inc = 1;
        for (const pa of this.passivesOf(p)) inc += pa.nodeIncome?.(this, p, 'shrine') ?? 0;
        fateBonus += inc;
      }
    }
    p.mana += manaBonus;
    await this.emit({ t: 'mana', player: pid, mana: p.mana, max: p.maxMana, delta: p.maxMana + manaBonus });
    if (manaBonus) await this.say(`${p.name} 从法力泉获得 ${manaBonus} 点额外法力`, 'info');
    if (fateBonus) {
      await this.gainFate(pid, fateBonus);
      await this.say(`${p.name} 从命运神龛获得 ${fateBonus} 点命运`, 'fate');
    }
    // units refresh & start-of-turn effects
    for (const u of this.unitsOf(pid)) {
      u.mp = this.moveOf(u);
      u.actions = 1;
      u.reaction = true;
      u.moved = 0;
      if (u.summonedTurn !== this.turn || u.isHero) u.sick = false;
      if (u.abilityCd > 0) u.abilityCd--;
    }
    // reactions of all units reset at the start of their owner's turn: done above
    for (const u of this.unitsOf(pid)) {
      if (u.dead) continue;
      await this.startOfTurnHazards(u);
      if (u.dead || this.over) continue;
      if (this.isControlled(u)) {
        u.mp = 0;
        u.actions = 0;
        await this.emit({ t: 'float', uid: u.uid, text: this.has(u, 'frozen') ? '冻结中' : '眩晕中', tone: 'bad' });
      }
      if (this.has(u, 'rooted')) u.mp = 0;
      if (this.has(u, 'prone')) {
        u.mp = Math.max(0, u.mp - 2);
        u.statuses = u.statuses.filter((s) => s.id !== 'prone');
        await this.emit({ t: 'status', uid: u.uid, status: 'prone', turns: 0, added: false });
      }
      await this.fireTriggers(u, 'turnStart', null);
    }
    if (this.over) return;
    for (const pa of this.passivesOf(p)) await pa.turnStart?.(this, p);
    if (this.over) return;
    // sudden death: the Dicemaster's patience runs out on very long battles
    if (this.round >= DOOM_ROUND && !this.rules.has('noDoom')) {
      const dmg = this.round - DOOM_ROUND + 1;
      const hero = this.hero(pid);
      await this.emit({ t: 'banner', text: '命运之潮', sub: `战斗拖得太久——英雄受到 ${dmg} 点伤害`, tone: 'bad' });
      await this.damage(hero, dmg, 'psychic', null, { label: '命运之潮' });
      if (this.over || !p.alive) return;
    }
    if (!(this.turn === 1 && pid === this.firstPlayer)) await this.draw(pid, p.drawPerTurn);
    await this.emit({ t: 'refresh' });
  }

  private async startOfTurnHazards(u: Unit): Promise<void> {
    const t = this.tileOf(u);
    const fly = this.isFlying(u);
    const burning = this.status(u, 'burning');
    if (burning) await this.damage(u, this.rollAmount(`1d4`, 'fire'), 'fire', null, { label: '燃烧' });
    if (u.dead) return;
    const poison = this.status(u, 'poisoned');
    if (poison) await this.damage(u, this.rollAmount('1d4', 'poison'), 'poison', null, { label: '中毒' });
    if (u.dead) return;
    if (t.terrain === 'lava' && !fly) await this.damage(u, this.rollAmount('2d6', 'fire'), 'fire', null, { label: '熔岩' });
    if (u.dead) return;
    if (!fly && t.surface) {
      if (t.surface === 'fire') {
        await this.damage(u, this.rollAmount('1d4', 'fire'), 'fire', null, { label: '火焰地面' });
        if (!u.dead) await this.addStatus(u, 'burning', 1);
      } else if (t.surface === 'poison') {
        await this.damage(u, this.rollAmount('1d4', 'poison'), 'poison', null, { label: '毒雾' });
        if (!u.dead) await this.addStatus(u, 'poisoned', 1);
      } else if (t.surface === 'holy') {
        if (t.surfaceOwner != null && !this.hostile(t.surfaceOwner, u.owner)) await this.heal(u, 2);
        else if (u.tribe.includes('undead') || u.tribe.includes('fiend')) await this.damage(u, this.rollAmount('1d4', 'radiant'), 'radiant', null, { label: '圣光地面' });
      }
    }
    if (u.dead) return;
    if (t.node?.kind === 'spring' && u.hp < u.maxHp) {
      await this.emit({ t: 'fx', kind: 'heal', to: t });
      await this.heal(u, 3);
    }
    const regen = this.kw(u, 'regen') + (this.status(u, 'regen')?.value ?? 0);
    if (regen && u.hp < u.maxHp) await this.heal(u, regen);
    if (this.status(u, 'doomed') && this.status(u, 'doomed')!.turns <= 1) {
      await this.emit({ t: 'float', uid: u.uid, text: '厄运降临', tone: 'bad' });
      await this.damage(u, this.rollAmount('3d6', 'necrotic'), 'necrotic', null, { label: '厄运' });
    }
  }

  private rollAmount(dice: string, _type: DamageType): number {
    return rollDice(this.rng, dice).total;
  }

  /** Roll a dice expression with the battle RNG (for custom effects). */
  rollNumber(expr: string | number): number {
    return rollDice(this.rng, expr).total;
  }

  async endTurn(): Promise<void> {
    if (this.over) return;
    const pid = this.active;
    const p = this.players[pid];
    for (const u of this.unitsOf(pid)) await this.fireTriggers(u, 'turnEnd', null);
    if (this.over) return;
    for (const pa of this.passivesOf(p)) await pa.turnEnd?.(this, p);
    if (this.over) return;
    const fatigue = p.hand.filter((c) => c.id === 'curse-exhaustion').length;
    if (fatigue) {
      await this.say(`${p.name} 被【疲惫】拖累`, 'bad');
      await this.damage(this.hero(pid), fatigue, 'psychic', null, { label: '疲惫' });
      if (this.over) return;
    }
    // tick statuses for this player's units
    for (const u of this.unitsOf(pid)) {
      const expired: StatusId[] = [];
      u.statuses = u.statuses.filter((s) => {
        if (s.turns >= 99) return true;
        s.turns -= 1;
        if (s.turns <= 0) {
          expired.push(s.id);
          return false;
        }
        return true;
      });
      for (const id of expired) await this.emit({ t: 'status', uid: u.uid, status: id, turns: 0, added: false });
      u.tempKw = u.tempKw.filter((k) => --k.turns > 0);
      u.buffs = u.buffs.filter((b) => b.turns >= 99 || --b.turns > 0);
    }
    // surfaces owned by this player age
    const cleared: Pos[] = [];
    for (const t of this.board.tiles) {
      if (t.surface && t.surfaceOwner === pid && t.surfaceTurns < 99) {
        t.surfaceTurns--;
        if (t.surfaceTurns <= 0) {
          this.board.setSurface(t, null, 0, null);
          cleared.push({ x: t.x, y: t.y });
        }
      }
    }
    if (cleared.length) await this.emit({ t: 'surface', tiles: cleared, surface: null });
    await this.emit({ t: 'turnEnd', player: pid });
    // advance to the next living player (a player may die during their own turn start)
    let next = pid;
    for (let guard = 0; guard < this.players.length * 2 && !this.over; guard++) {
      next = (next + 1) % this.players.length;
      if (next === this.firstPlayer) this.round++;
      if (!this.players[next].alive) continue;
      this.active = next;
      this.turn++;
      await this.beginTurn(next);
      if (this.players[next].alive || this.over) break;
    }
  }

  // ====================================================================
  // Player actions
  // ====================================================================

  async move(uid: Uid, to: Pos): Promise<boolean> {
    const u = this.unit(uid);
    if (!u || !this.canMove(u)) return false;
    const r = this.reachable(u).get(posKey(to));
    if (!r) return false;
    return this.walk(u, r.path, r.cost);
  }

  private async walk(u: Unit, path: Pos[], cost: number): Promise<boolean> {
    // split the path at sentinel interrupts
    let seg: Pos[] = [path[0]];
    let stopped = false;
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      seg.push(to);
      if (this.has(u, 'hidden')) continue;
      const sentinels = this.alive().filter(
        (o) => this.hostile(o.owner, u.owner) && o.reaction && this.kw(o, 'sentinel') > 0 && !this.isControlled(o) && cheb(o, from) === 1 && cheb(o, to) > 1,
      );
      if (sentinels.length) {
        // move up to `from` first (the sentinel strikes as the unit leaves)
        const before = seg.slice(0, -1);
        if (before.length > 1) await this.emit({ t: 'move', uid: u.uid, path: before });
        u.x = from.x;
        u.y = from.y;
        for (const s of sentinels) {
          if (u.dead || this.over) break;
          s.reaction = false;
          await this.say(`${s.name} 发动截击！`, 'info');
          const hit = await this.resolveAttack(s, u, { free: true, noRiposte: true });
          if (hit && !u.dead) {
            stopped = true;
            await this.emit({ t: 'float', uid: u.uid, text: '被截停', tone: 'bad' });
          }
        }
        if (u.dead || this.over) return true;
        if (stopped) {
          u.moved += i - 1;
          u.mp = 0;
          await this.arrive(u, 'move');
          return true;
        }
        seg = [from, to];
      }
    }
    if (seg.length > 1) await this.emit({ t: 'move', uid: u.uid, path: seg });
    const end = path[path.length - 1];
    u.x = end.x;
    u.y = end.y;
    u.moved += path.length - 1;
    u.mp = Math.max(0, u.mp - cost);
    await this.arrive(u, 'move');
    return true;
  }

  /** Called whenever a unit lands on a tile. */
  async arrive(u: Unit, how: 'move' | 'summon' | 'push' | 'teleport'): Promise<void> {
    if (u.dead) return;
    const t = this.tileOf(u);
    const fly = this.isFlying(u);
    // nodes
    if (t.node) {
      const k = t.node.kind;
      if ((k === 'well' || k === 'shrine' || k === 'gate') && t.node.owner !== u.owner) {
        const prev = t.node.owner;
        t.node.owner = u.owner;
        await this.emit({ t: 'capture', pos: { x: t.x, y: t.y }, kind: k, owner: u.owner, prev });
        const names = { well: '法力泉', shrine: '命运神龛', gate: '召唤法阵' } as const;
        await this.say(`${this.players[u.owner].name} 占领了${names[k]}`, 'info');
        const p = this.players[u.owner];
        for (const pa of this.passivesOf(p)) await pa.onCapture?.(this, p, t);
      } else if ((k === 'chest' || k === 'altar' || k === 'rune' || k === 'gold') && !t.node.used) {
        t.node.used = true;
        await this.emit({ t: 'nodeUsed', pos: { x: t.x, y: t.y }, kind: k });
        await this.resolveEventNode(u, t);
      }
    }
    if (u.dead || this.over) return;
    if (how === 'summon') return;
    // hazards when ending on tile
    if (!fly) {
      if (t.terrain === 'lava') await this.damage(u, this.rollAmount('2d6', 'fire'), 'fire', null, { label: '熔岩' });
      if (u.dead) return;
      if (t.surface === 'fire') {
        await this.damage(u, this.rollAmount('1d4', 'fire'), 'fire', null, { label: '火焰地面' });
        if (!u.dead) await this.addStatus(u, 'burning', 1);
      } else if (t.surface === 'poison') {
        await this.addStatus(u, 'poisoned', 1);
      } else if (t.surface === 'ice' && how === 'move' && this.kw(u, 'unstoppable') === 0) {
        const r = await this.savingThrow(u, 'ref', 10, null, '冰面滑倒');
        if (!r.success) {
          await this.addStatus(u, 'prone', 1);
          u.mp = 0;
        }
      }
    }
  }

  private async resolveEventNode(u: Unit, t: Tile): Promise<void> {
    const pid = u.owner;
    const k = t.node!.kind;
    if (k === 'gold') {
      const amt = this.rng.int(12, 22);
      this.players[pid].gold += amt;
      await this.emit({ t: 'gold', player: pid, amount: amt });
      await this.emit({ t: 'float', uid: u.uid, text: `+${amt} 金币`, tone: 'gold' });
      await this.say(`${u.name} 拾得 ${amt} 枚金币`, 'good');
      return;
    }
    if (k === 'chest') {
      const r = await this.skillCheck(pid, 'dex', 12, '撬开宝箱（巧手）', u.uid);
      if (r.success) {
        await this.say(`${u.name} 熟练地打开了宝箱！`, 'good');
        await this.draw(pid, 2);
      } else {
        await this.say(`宝箱机关触发！`, 'bad');
        await this.emit({ t: 'fx', kind: 'explosion', to: { x: u.x, y: u.y }, color: '#ffaa33' });
        await this.damage(u, this.rollAmount('1d6', 'physical'), 'physical', null, { label: '陷阱' });
        await this.draw(pid, 1);
      }
      return;
    }
    if (k === 'altar') {
      const r = await this.skillCheck(pid, 'wis', 13, '向古老祭坛祈祷（宗教）', u.uid);
      if (r.success) {
        await this.say(`祭坛回应了 ${u.name} 的祈祷`, 'good');
        await this.emit({ t: 'fx', kind: 'holy', to: { x: u.x, y: u.y } });
        await this.heal(u, 5);
        await this.addStatus(u, 'blessed', 3);
      } else {
        await this.say(`祭坛中传出低语……${u.name} 受到诅咒`, 'bad');
        await this.emit({ t: 'fx', kind: 'curse', to: { x: u.x, y: u.y } });
        await this.addStatus(u, 'baned', 2);
      }
      return;
    }
    if (k === 'rune') {
      const r = await this.skillCheck(pid, 'int', 14, '解读符文石（奥秘）', u.uid);
      if (r.success) {
        await this.say(`符文亮起，奥术之力涌入 ${this.players[pid].name}`, 'good');
        await this.emit({ t: 'fx', kind: 'arcane', to: { x: u.x, y: u.y } });
        await this.gainFate(pid, 1);
        await this.gainMana(pid, 1);
      } else {
        await this.say(`符文沉寂无声`, 'info');
      }
    }
  }

  async attack(uid: Uid, targetUid: Uid): Promise<boolean> {
    const u = this.unit(uid);
    const t = this.unit(targetUid);
    if (!u || !t || !this.canAct(u)) return false;
    if (!this.canAttack(u, t).ok) return false;
    u.actions--;
    const swings = this.kw(u, 'flurry') > 0 ? 2 : 1;
    for (let i = 0; i < swings; i++) {
      if (u.dead || t.dead || this.over) break;
      await this.resolveAttack(u, t, {});
    }
    if (!u.dead && !this.over) await this.fireTriggers(u, 'attack', t);
    await this.emit({ t: 'refresh' });
    return true;
  }

  /** Find a tile from which u can attack target (cheapest move). */
  attackPosition(u: Unit, target: Unit): { pos: Pos; path: Pos[] | null; cost: number } | null {
    if (this.canAttack(u, target).ok) return { pos: { x: u.x, y: u.y }, path: null, cost: 0 };
    if (!this.canMove(u)) return null;
    let best: { pos: Pos; path: Pos[]; cost: number; score: number } | null = null;
    for (const [, r] of this.reachable(u)) {
      const end = r.path[r.path.length - 1];
      if (!this.canAttack(u, target, end).ok) continue;
      const prev = this.previewAttack(u, target, end);
      const score = prev.hit * 10 - r.cost * 0.1 + this.tileOf(end).h * 0.05;
      if (!best || score > best.score) best = { pos: end, path: r.path, cost: r.cost, score };
    }
    return best;
  }

  async moveAndAttack(uid: Uid, targetUid: Uid): Promise<boolean> {
    const u = this.unit(uid);
    const t = this.unit(targetUid);
    if (!u || !t || !this.canAct(u)) return false;
    const ap = this.attackPosition(u, t);
    if (!ap) return false;
    if (ap.path) {
      await this.move(uid, ap.pos);
      if (u.dead || t.dead || this.over) return true;
      if (!this.canAttack(u, t).ok) return true;
    }
    return this.attack(uid, targetUid);
  }

  async useAbility(uid: Uid, target: Pos | null): Promise<boolean> {
    const u = this.unit(uid);
    if (!u || !u.ability || !this.canAct(u) || u.abilityCd > 0) return false;
    const ab = u.ability;
    if (ab.target.kind !== 'none') {
      if (!target) return false;
      const valid = this.targetsFor(u.owner, ab.target, u);
      if (!valid.some((p) => p.x === target.x && p.y === target.y)) return false;
    }
    u.actions--;
    u.abilityCd = ab.cooldown ?? 0;
    if (this.has(u, 'hidden') && ab.kind === 'damage') await this.reveal(u);
    await this.say(`${u.name} 使用了【${ab.name}】`, 'info');
    const ctx = this.ctxFor(u.owner, u, ab.target, target, null, false, ab.name);
    if (ab.fx) await this.emit({ t: 'fx', kind: ab.fx, from: { x: u.x, y: u.y }, to: target ?? { x: u.x, y: u.y }, area: ctx.area?.map((t) => ({ x: t.x, y: t.y })) });
    await this.runEffects(ab.effects, ctx);
    await this.emit({ t: 'refresh' });
    return true;
  }

  abilityTargets(u: Unit): Pos[] {
    if (!u.ability) return [];
    return this.targetsFor(u.owner, u.ability.target, u);
  }

  async playCard(pid: PlayerId, iid: number, target: Pos | null): Promise<boolean> {
    const p = this.players[pid];
    const idx = p.hand.findIndex((c) => c.iid === iid);
    if (idx < 0) return false;
    const inst = p.hand[idx];
    const can = this.canPlay(pid, inst);
    if (!can.ok) return false;
    const def = cardOf(inst);
    if (this.needsTarget(def)) {
      if (!target) return false;
      const valid = this.cardTargets(pid, inst);
      if (!valid.some((q) => q.x === target.x && q.y === target.y)) return false;
    }
    const cost = this.costOf(p, inst);
    p.mana -= cost;
    if (def.fate) await this.gainFate(pid, -def.fate);
    p.hand.splice(idx, 1);
    p.stats.cardsPlayed++;
    await this.emit({ t: 'mana', player: pid, mana: p.mana, max: p.maxMana, delta: -cost });
    await this.emit({ t: 'cardPlayed', player: pid, iid, id: inst.id, up: inst.up, target });
    for (const pa of this.passivesOf(p)) await pa.onPlayCard?.(this, p, def);
    if (def.type === 'unit') {
      await this.summon(pid, def, target!, inst);
    } else if (def.type === 'equip') {
      const u = this.unitAt(target!.x, target!.y)!;
      await this.equip(u, def, inst);
    } else {
      const hero = this.hero(pid);
      const ctx = this.ctxFor(pid, hero, def.target, target, def, inst.up, def.name);
      ctx.isSpell = true;
      await this.say(`${p.name} 施放了【${def.name}】`, 'info');
      await this.runEffects(def.effects ?? [], ctx);
      if (def.exhaust) p.exhausted.push(inst);
      else p.discard.push(inst);
    }
    await this.emit({ t: 'refresh' });
    return true;
  }

  heroPowerTargets(pid: PlayerId): Pos[] {
    const pw = this.players[pid].commander.power;
    if (!pw) return [];
    return this.targetsFor(pid, pw.target, this.hero(pid));
  }

  canHeroPower(pid: PlayerId): { ok: boolean; reason?: string } {
    const p = this.players[pid];
    const pw = p.commander.power;
    if (!pw) return { ok: false, reason: '没有英雄技能' };
    if (this.active !== pid || this.over) return { ok: false, reason: '不是你的回合' };
    if (p.powerUsed) return { ok: false, reason: '本回合已使用' };
    if (p.mana < pw.cost) return { ok: false, reason: '法力不足' };
    const hero = this.hero(pid);
    if (hero.dead || this.isControlled(hero)) return { ok: false, reason: '英雄无法行动' };
    if (pw.target.kind !== 'none' && this.heroPowerTargets(pid).length === 0) return { ok: false, reason: '没有合法目标' };
    return { ok: true };
  }

  async heroPower(pid: PlayerId, target: Pos | null): Promise<boolean> {
    const p = this.players[pid];
    const pw = p.commander.power;
    if (!pw || !this.canHeroPower(pid).ok) return false;
    if (pw.target.kind !== 'none') {
      if (!target || !this.heroPowerTargets(pid).some((q) => q.x === target.x && q.y === target.y)) return false;
    }
    p.mana -= pw.cost;
    p.powerUsed = true;
    await this.emit({ t: 'mana', player: pid, mana: p.mana, max: p.maxMana, delta: -pw.cost });
    await this.emit({ t: 'heroPower', player: pid, target });
    await this.say(`${p.name} 使用英雄技能【${pw.name}】`, 'info');
    const hero = this.hero(pid);
    const ctx = this.ctxFor(pid, hero, pw.target, target, null, false, pw.name);
    ctx.isSpell = true;
    if (pw.fx) await this.emit({ t: 'fx', kind: pw.fx, from: { x: hero.x, y: hero.y }, to: target ?? { x: hero.x, y: hero.y } });
    await this.runEffects(pw.effects, ctx);
    await this.emit({ t: 'refresh' });
    return true;
  }

  potionTargets(pid: PlayerId, slot: number): Pos[] {
    const id = this.players[pid].potions[slot];
    if (!id) return [];
    const def = getPotion(id);
    return this.targetsFor(pid, def.target, this.hero(pid));
  }

  async usePotion(pid: PlayerId, slot: number, target: Pos | null): Promise<boolean> {
    const p = this.players[pid];
    const id = p.potions[slot];
    if (!id || this.active !== pid || this.over) return false;
    const def = getPotion(id);
    if (def.target.kind !== 'none') {
      if (!target || !this.potionTargets(pid, slot).some((q) => q.x === target.x && q.y === target.y)) return false;
    }
    p.potions[slot] = null;
    await this.emit({ t: 'potion', player: pid, id, target });
    await this.say(`${p.name} 使用了【${def.name}】`, 'info');
    const ctx = this.ctxFor(pid, this.hero(pid), def.target, target, null, false, def.name);
    ctx.isSpell = true;
    await this.runEffects(def.effects, ctx);
    await this.emit({ t: 'refresh' });
    return true;
  }

  async replace(pid: PlayerId, iid: number): Promise<boolean> {
    const p = this.players[pid];
    if (this.active !== pid || p.replaced || p.noReplace || this.over) return false;
    const idx = p.hand.findIndex((c) => c.iid === iid);
    if (idx < 0) return false;
    if (p.deck.length === 0 && p.discard.length === 0) return false;
    const [c] = p.hand.splice(idx, 1);
    p.replaced = true;
    await this.emit({ t: 'discard', player: pid, iid: c.iid, id: c.id });
    // put it somewhere random in the deck, then draw
    const pos = this.rng.int(Math.min(1, p.deck.length), p.deck.length);
    p.deck.splice(pos, 0, c);
    await this.draw(pid, 1);
    await this.emit({ t: 'refresh' });
    return true;
  }

  async concede(pid: PlayerId): Promise<void> {
    const hero = this.hero(pid);
    if (!hero.dead) await this.kill(hero, null);
  }

  // ====================================================================
  // Summon / equip
  // ====================================================================

  unitCount(pid: PlayerId): number {
    let n = 0;
    for (const u of this.units.values()) if (!u.dead && u.owner === pid && !u.isHero) n++;
    return n;
  }

  async summon(pid: PlayerId, def: CardDef, at: Pos, inst: CardInst | null, opts: { token?: boolean; silent?: boolean } = {}): Promise<Unit | null> {
    if (!def.unit) return null;
    if (this.unitAt(at.x, at.y)) return null;
    if (this.unitCount(pid) >= UNIT_CAP) {
      if (inst) this.players[pid].discard.push(inst);
      return null;
    }
    const u = this.makeUnit(pid, def.unit, {
      cardId: def.id,
      name: def.name,
      icon: def.icon,
      colors: def.colors,
      isHero: false,
      up: inst?.up ?? false,
      cardIid: inst?.iid ?? null,
      token: opts.token ?? !inst,
    });
    u.x = at.x;
    u.y = at.y;
    u.summonedTurn = this.turn;
    u.sick = !(this.kw(u, 'haste') > 0);
    u.mp = u.sick ? 0 : this.moveOf(u);
    u.actions = u.sick ? 0 : 1;
    this.units.set(u.uid, u);
    const p = this.players[pid];
    p.stats.summons++;
    await this.emit({ t: 'summon', uid: u.uid, at, id: def.id, owner: pid });
    if (!opts.silent) await this.say(`${p.name} 召唤了【${def.name}】`, 'info');
    for (const pa of this.passivesOf(p)) await pa.onSummon?.(this, u, p);
    await this.arrive(u, 'summon');
    if (u.dead || this.over) return u;
    await this.fireTriggers(u, 'summon', null);
    for (const a of this.unitsOf(pid)) if (a.uid !== u.uid) await this.fireTriggers(a, 'allySummon', u);
    return u;
  }

  async equip(u: Unit, def: CardDef, inst: CardInst | null): Promise<void> {
    const e = def.equip;
    if (!e) return;
    u.equipment.push({ id: def.id, up: inst?.up ?? false, iid: inst?.iid ?? null });
    u.ac += e.ac ?? 0;
    u.atk += e.atk ?? 0;
    if (e.hp) {
      u.maxHp += e.hp;
      u.hp += e.hp;
    }
    u.move += e.move ?? 0;
    u.mp += e.move ?? 0;
    if (e.range && u.range > 1) u.range += e.range;
    u.jump += e.jump ?? 0;
    if (e.dmg) u.equipDmg.push(String(e.dmg));
    if (e.dmgType) u.dmgType = e.dmgType;
    for (const [k, v] of Object.entries(e.kw ?? {})) {
      const kk = k as Keyword;
      u.kw[kk] = (u.kw[kk] ?? 0) + (v ?? 0);
      if (kk === 'ward') u.ward += v ?? 0;
      if (kk === 'stealth' && !this.has(u, 'hidden')) {
        u.statuses.push({ id: 'hidden', turns: 99 });
        await this.emit({ t: 'stealth', uid: u.uid, hidden: true });
      }
    }
    if (e.triggers) u.triggers.push(...e.triggers);
    await this.emit({ t: 'equip', uid: u.uid, id: def.id });
    await this.say(`${u.name} 装备了【${def.name}】`, 'info');
  }

  // ====================================================================
  // Rolls
  // ====================================================================

  /** Generic d20 roll with modifiers, karmic dice and fate rerolls. */
  async d20(o: {
    kind: 'attack' | 'save' | 'check';
    player: PlayerId;
    uid: Uid | null;
    vs: Uid | null;
    label: string;
    mods: Mod[];
    target: number;
    critMin?: number;
    lucky?: boolean;
    big?: boolean;
    ability?: Ability;
    importance?: number;
  }): Promise<RollEvent> {
    const p = this.players[o.player];
    const adv = Battle.advOf(o.mods);
    const flat = o.mods.reduce((a, m) => a + (m.value ?? 0), 0);
    const critMin = o.critMin ?? 20;
    const oddsParams = {
      mod: flat,
      target: o.target,
      adv,
      lucky: o.lucky,
      critMin,
      bonus: o.mods
        .filter((m) => m.dice)
        .map((m) => {
          const neg = m.dice!.startsWith('-');
          const d = parseDice(m.dice!.replace('-', ''));
          return { n: d.terms[0]?.n ?? 1, s: d.terms[0]?.s ?? 4, sign: (neg ? -1 : 1) as 1 | -1 };
        }),
    };
    const odds = checkOdds(oddsParams).success;

    const once = (forced: number | null): RollEvent => {
      const d20 = forced != null ? { rolls: [forced], nat: forced, adv: 0 as const } : rollD20(this.rng, adv, o.lucky);
      const bonusRolls: RollEvent['bonusRolls'] = [];
      let bonus = 0;
      for (const m of o.mods) {
        if (!m.dice) continue;
        const neg = m.dice.startsWith('-');
        const r = rollDice(this.rng, m.dice.replace('-', ''));
        const v = neg ? -r.total : r.total;
        bonus += v;
        bonusRolls.push({ label: m.label, value: v, dice: m.dice });
      }
      const total = d20.nat + flat + bonus;
      const success = d20.nat === 20 || (d20.nat !== 1 && total >= o.target) || (o.kind === 'attack' && d20.nat >= critMin);
      return {
        t: 'roll',
        kind: o.kind,
        player: o.player,
        uid: o.uid,
        vs: o.vs,
        label: o.label,
        d20,
        mods: o.mods,
        bonusRolls,
        total,
        target: o.target,
        success,
        crit: o.kind === 'attack' && d20.nat >= critMin,
        fumble: d20.nat === 1,
        big: o.big,
        ability: o.ability,
      };
    };

    let forced: number | null = null;
    for (const pa of this.passivesOf(p)) {
      const f = pa.forceNat?.(this, p, o.kind);
      if (f != null) {
        forced = f;
        break;
      }
    }
    let ev = once(forced);
    if (ev.d20.nat === 20 && forced == null) {
      for (const other of this.players) {
        if (!other.alive || !this.hostile(other.id, o.player)) continue;
        if (this.passivesOf(other).some((pa) => pa.opponentNat20?.(this, p, other))) {
          await this.emit(ev);
          await this.emit({ t: 'banner', text: '骰主出千！', sub: `${other.name} 让你的天然 20 重掷`, tone: 'boss' });
          await this.say(`${other.name} 偷换了骰子——天然 20 被强制重掷！`, 'bad');
          ev = once(null);
          ev.reroll = true;
          break;
        }
      }
    }
    // karmic dice: protects humans from long failure streaks
    if (!ev.success && !p.isAI && this.karmic && p.failStreak >= 2 && odds >= 0.25 && forced == null) {
      const again = once(null);
      if (again.success || again.total > ev.total) {
        ev = again;
        ev.karmic = true;
      }
    }
    if (odds >= 0.2) p.failStreak = ev.success ? 0 : p.failStreak + 1;
    await this.emit(ev);

    if (!ev.success && p.fate > 0) {
      let want = false;
      if (!p.isAI) {
        want = await this.io.askReroll({ player: o.player, roll: ev, fate: p.fate });
      } else {
        const imp = o.importance ?? 0.5;
        want = imp >= 0.6 || (imp >= 0.4 && p.fate >= 2) || p.fate >= p.maxFate;
        if (odds < 0.15) want = false;
      }
      if (want && p.fate > 0) {
        p.fate--;
        p.stats.rerolls++;
        await this.emit({ t: 'fate', player: o.player, fate: p.fate, delta: -1 });
        await this.say(`${p.name} 消耗 1 点命运重掷！`, 'fate');
        ev = once(null);
        ev.reroll = true;
        await this.emit(ev);
      }
    }
    if (ev.d20.nat === 20) {
      p.stats.nat20++;
      await this.gainFate(o.player, 1);
      for (const pa of this.passivesOf(p)) await pa.onNat20?.(this, p, ev);
    } else if (ev.d20.nat === 1) {
      p.stats.nat1++;
      for (const pa of this.passivesOf(p)) await pa.onNat1?.(this, p, ev);
    }
    return ev;
  }

  saveMods(u: Unit, type: SaveType, fromSpell: boolean): Mod[] {
    const mods: Mod[] = [{ label: `${SAVE_NAMES[type]}豁免`, value: u.saves[type] }];
    if (this.has(u, 'blessed')) mods.push({ label: '祝福', dice: '1d4' });
    if (this.has(u, 'baned')) mods.push({ label: '灾祸', dice: '-1d4' });
    if (fromSpell && this.kw(u, 'spellward') > 0) mods.push({ label: '法术抗性', adv: 1 });
    if (type === 'ref' && (this.has(u, 'stunned') || this.has(u, 'frozen'))) mods.push({ label: '失能', value: -10 });
    if (this.has(u, 'frightened') && type === 'will') mods.push({ label: '恐惧', adv: -1 });
    const owner = this.players[u.owner];
    const curse = owner.hand.filter((c) => c.id === 'curse-misfortune').length;
    if (curse) mods.push({ label: '厄运诅咒', value: -curse });
    for (const pa of this.passivesOf(owner)) {
      const b = pa.saveBonus?.(this, u, type, owner) ?? 0;
      if (b) mods.push({ label: pa.name, value: b });
    }
    // aura of protection style: allied hero passives handled by passives
    return mods;
  }

  async savingThrow(u: Unit, type: SaveType, dc: number, caster: PlayerId | null, label: string, importance = 0.5): Promise<RollEvent> {
    return this.d20({
      kind: 'save',
      player: u.owner,
      uid: u.uid,
      vs: null,
      label: `${label}（${SAVE_NAMES[type]} DC ${dc}）`,
      mods: this.saveMods(u, type, caster != null),
      target: dc,
      lucky: this.isLucky(u),
      importance,
    });
  }

  async skillCheck(pid: PlayerId, ability: Ability, dc: number, label: string, uid: Uid | null = null): Promise<RollEvent> {
    const p = this.players[pid];
    const mods: Mod[] = [
      { label: ABILITY_NAMES[ability], value: abilityMod(p.abilities[ability]) },
      { label: '熟练', value: p.prof },
    ];
    for (const pa of this.passivesOf(p)) if (pa.checkBonus) mods.push({ label: pa.name, value: pa.checkBonus });
    return this.d20({ kind: 'check', player: pid, uid, vs: null, label: `${label} DC ${dc}`, mods, target: dc, big: true, ability, importance: 0.7 });
  }

  // ====================================================================
  // Attacks
  // ====================================================================

  async resolveAttack(u: Unit, target: Unit, o: { free?: boolean; noRiposte?: boolean }): Promise<boolean> {
    if (u.dead || target.dead || this.over) return false;
    this.depth++;
    try {
      const ranged = this.isRanged(u);
      await this.emit({ t: 'attack', attacker: u.uid, target: target.uid, ranged, fx: u.fx });
      const mods = this.attackMods(u, target);
      const ac = this.acOf(target);
      const importance = target.isHero ? 0.8 : target.hp <= diceAvg(u.dmg) ? 0.6 : 0.35;
      const roll = await this.d20({
        kind: 'attack',
        player: u.owner,
        uid: u.uid,
        vs: target.uid,
        label: `${u.name} → ${target.name}`,
        mods,
        target: ac,
        critMin: this.critMin(u),
        lucky: this.isLucky(u),
        importance,
      });
      const owner = this.players[u.owner];
      if ((owner.flags.nextAttackAdv ?? 0) > 0 && owner.id === this.active) owner.flags.nextAttackAdv--;
      if (this.has(u, 'hidden')) await this.reveal(u);
      await this.emit({ t: 'strike', attacker: u.uid, target: target.uid, hit: roll.success, crit: roll.crit, ranged, fx: u.fx });
      if (!roll.success) {
        await this.emit({ t: 'float', uid: target.uid, text: roll.fumble ? '大失败!' : '未命中', tone: 'info' });
        await this.say(`${u.name} 攻击 ${target.name}：${roll.total} vs AC ${ac}，未命中${roll.fumble ? '（大失败）' : ''}`, 'info');
      } else {
        if (roll.crit) this.players[u.owner].stats.crits++;
        const adv = Battle.advOf(mods);
        const { base, extras } = this.damageParts(u, target, adv);
        const baseRoll = rollDice(this.rng, base, roll.crit);
        const extraRolls = extras.map((e) => {
          const neg = e.dice.startsWith('-');
          const r = rollDice(this.rng, e.dice.replace(/^-/, ''), roll.crit);
          if (neg) r.total = -r.total;
          return { label: e.label, roll: r };
        });
        const total = Math.max(0, baseRoll.total + extraRolls.reduce((a, e) => a + e.roll.total, 0));
        await this.emit({ t: 'damageRoll', uid: u.uid, roll: baseRoll, label: '伤害', extra: extraRolls });
        await this.say(`${u.name} ${roll.crit ? '暴击' : '命中'} ${target.name}（${roll.total} vs AC ${ac}）`, roll.crit ? 'crit' : 'good');
        const targetTile = this.tileOf(target);
        const dealt = await this.damage(target, total, u.dmgType, u, { crit: roll.crit, label: '攻击' });
        if (u.dmgType === 'fire' || u.dmgType === 'cold' || u.dmgType === 'lightning') {
          await this.elementReact([targetTile], u.dmgType, this.ctxFor(u.owner, u, undefined, { x: targetTile.x, y: targetTile.y }, null, false, u.name));
        }
        if (dealt > 0 && this.kw(u, 'lifesteal') > 0 && !u.dead) await this.heal(u, dealt);
        // on-hit keywords
        if (!target.dead) {
          const venom = this.kw(u, 'venom');
          if (venom) await this.addStatus(target, 'poisoned', venom);
          const ign = this.kw(u, 'ignite');
          if (ign) await this.addStatus(target, 'burning', ign);
          const chill = this.kw(u, 'chill');
          if (chill) await this.addStatus(target, 'slowed', chill);
          const push = this.kw(u, 'push');
          if (push && !target.dead) await this.push(target, u, push);
        }
        const blast = this.kw(u, 'blast');
        if (blast) {
          for (const o2 of this.alive()) {
            if (o2.uid === target.uid || o2.uid === u.uid || cheb(o2, target) !== 1 || !this.hostile(u.owner, o2.owner)) continue;
            await this.damage(o2, Math.floor(total / 2), u.dmgType, u, { label: '溅射' });
          }
        }
        if (this.kw(u, 'cleave') > 0 && !ranged) {
          const other = this.adjacentEnemies(u).find((e) => e.uid !== target.uid && !e.dead);
          if (other) {
            await this.emit({ t: 'fx', kind: 'cleave', from: { x: u.x, y: u.y }, to: { x: other.x, y: other.y } });
            await this.damage(other, Math.max(1, Math.floor(total / 2)), u.dmgType, u, { label: '横扫' });
          }
        }
        if (this.kw(u, 'pierce') > 0) {
          const dx = Math.sign(target.x - u.x);
          const dy = Math.sign(target.y - u.y);
          const behind = this.unitAt(target.x + dx, target.y + dy);
          if (behind && this.hostile(u.owner, behind.owner)) await this.damage(behind, Math.max(1, Math.floor(total / 2)), u.dmgType, u, { label: '贯穿' });
        }
        if (!u.dead) await this.fireTriggers(u, 'hit', target);
      }
      // riposte / thorns
      if (!target.dead && !u.dead && !ranged && cheb(u, target) === 1) {
        const thorns = this.kw(target, 'thorns');
        if (thorns) await this.damage(u, thorns, 'physical', target, { label: '荆棘' });
        if (!o.noRiposte && this.kw(target, 'riposte') > 0 && !this.isControlled(target) && !u.dead && !this.over) {
          await this.say(`${target.name} 发动反击！`, 'info');
          await this.resolveAttack(target, u, { free: true, noRiposte: true });
        }
      }
      return roll.success;
    } finally {
      this.depth--;
    }
  }

  async reveal(u: Unit): Promise<void> {
    if (!this.has(u, 'hidden')) return;
    u.statuses = u.statuses.filter((s) => s.id !== 'hidden');
    await this.emit({ t: 'stealth', uid: u.uid, hidden: false });
  }

  // ====================================================================
  // Damage, healing, statuses
  // ====================================================================

  async damage(u: Unit, amount: number, type: DamageType, source: Unit | null, o: { crit?: boolean; label?: string } = {}): Promise<number> {
    if (u.dead || this.over) return 0;
    if (u.immune.includes(type)) {
      await this.emit({ t: 'damage', uid: u.uid, amount: 0, dmgType: type, crit: false, hp: u.hp, maxHp: u.maxHp, blocked: 'immune', source: source?.uid ?? null });
      return 0;
    }
    if (amount > 0 && u.ward > 0) {
      u.ward--;
      await this.emit({ t: 'damage', uid: u.uid, amount: 0, dmgType: type, crit: false, hp: u.hp, maxHp: u.maxHp, blocked: 'ward', source: source?.uid ?? null });
      await this.say(`${u.name} 的护盾抵挡了伤害`, 'info');
      return 0;
    }
    const resisted = u.resist.includes(type) || (type === 'physical' && this.has(u, 'stoneskin'));
    const vulnerable = u.vuln.includes(type) || this.has(u, 'vulnerable');
    const final = this.mitigate(u, amount, type);
    u.hp -= final;
    if (source) this.players[source.owner].stats.dmgDealt += final;
    this.players[u.owner].stats.dmgTaken += final;
    await this.emit({ t: 'damage', uid: u.uid, amount: final, dmgType: type, crit: !!o.crit, hp: Math.max(0, u.hp), maxHp: u.maxHp, resisted, vulnerable, source: source?.uid ?? null });
    if (final > 0 && this.has(u, 'hidden')) await this.reveal(u);
    if (final > 0 && type === 'fire' && this.has(u, 'frozen')) await this.removeStatus(u, 'frozen');
    if (u.hp <= 0) {
      if (u.isHero) {
        const p = this.players[u.owner];
        for (const pa of this.passivesOf(p)) {
          if (await pa.onHeroLethal?.(this, p, u)) {
            if (u.hp > 0) return final;
          }
        }
      }
      await this.kill(u, source);
    } else if (final > 0) {
      await this.fireTriggers(u, 'damaged', source);
    }
    return final;
  }

  async heal(u: Unit, amount: number): Promise<number> {
    if (u.dead || amount <= 0) return 0;
    const owner = this.players[u.owner];
    let bonus = 0;
    for (const pa of this.passivesOf(owner)) bonus += pa.healBonus?.(this, owner) ?? 0;
    const real = Math.min(u.maxHp - u.hp, amount + bonus);
    if (real <= 0) return 0;
    u.hp += real;
    await this.emit({ t: 'heal', uid: u.uid, amount: real, hp: u.hp, maxHp: u.maxHp });
    return real;
  }

  async addStatus(u: Unit, id: StatusId, turns: number, value?: number, by?: PlayerId): Promise<void> {
    if (u.dead) return;
    if (CONTROL_STATUS.has(id) && this.kw(u, 'unstoppable') > 0) {
      await this.emit({ t: 'float', uid: u.uid, text: '免疫', tone: 'info' });
      return;
    }
    if (id === 'poisoned' && u.immune.includes('poison')) return;
    if (id === 'burning' && u.immune.includes('fire')) return;
    if (id === 'frozen' && u.immune.includes('cold')) return;
    if (id === 'burning' && this.has(u, 'frozen')) {
      await this.removeStatus(u, 'frozen');
      return;
    }
    const ex = this.status(u, id);
    if (u.owner === this.active && !ex) {
      if (id === 'hasted') u.mp += 2;
      if (id === 'slowed') u.mp = Math.max(0, u.mp - 2);
    }
    if (ex) {
      ex.turns = Math.max(ex.turns, turns);
      if (value !== undefined) ex.value = Math.max(ex.value ?? 0, value);
      if (by !== undefined) ex.by = by;
    } else {
      u.statuses.push({ id, turns, value, by });
    }
    if (id === 'stunned' || id === 'frozen') {
      if (u.owner === this.active) {
        u.mp = 0;
        u.actions = 0;
      }
    }
    if (id === 'rooted' && u.owner === this.active) u.mp = 0;
    await this.emit({ t: 'status', uid: u.uid, status: id, turns, added: true });
  }

  async removeStatus(u: Unit, id: StatusId): Promise<void> {
    if (!this.has(u, id)) return;
    u.statuses = u.statuses.filter((s) => s.id !== id);
    await this.emit({ t: 'status', uid: u.uid, status: id, turns: 0, added: false });
  }

  async cleanse(u: Unit): Promise<void> {
    for (const s of [...u.statuses]) if (NEGATIVE_STATUS.has(s.id)) await this.removeStatus(u, s.id);
  }

  async kill(u: Unit, killer: Unit | null): Promise<void> {
    if (u.dead) return;
    u.dead = true;
    u.hp = 0;
    this.graves.push({ x: u.x, y: u.y });
    await this.emit({ t: 'death', uid: u.uid, killer: killer?.uid ?? null });
    await this.say(`${u.name} 倒下了`, u.owner === 0 ? 'bad' : 'good');
    const owner = this.players[u.owner];
    // cards return to discard
    if (u.cardIid != null && !u.token) owner.discard.push({ iid: u.cardIid, id: u.cardId, up: u.up });
    for (const e of u.equipment) if (e.iid != null) owner.discard.push({ iid: e.iid, id: e.id, up: e.up });
    if (killer && !killer.dead) {
      killer.kills++;
      this.players[killer.owner].stats.kills++;
    }
    if (u.isHero) {
      await this.eliminate(u.owner);
      return;
    }
    await this.fireTriggers(u, 'death', killer, true);
    for (const a of this.unitsOf(u.owner)) await this.fireTriggers(a, 'allyDeath', u);
    for (const pa of this.passivesOf(owner)) await pa.onAllyDeath?.(this, u, owner);
    if (killer) {
      const kp = this.players[killer.owner];
      for (const pa of this.passivesOf(kp)) await pa.onKill?.(this, killer, u, kp);
      if (!killer.dead) await this.fireTriggers(killer, 'kill', u);
    }
    for (const p of this.players) {
      if (p.id === u.owner || !this.hostile(p.id, u.owner)) continue;
      for (const pa of this.passivesOf(p)) await pa.onEnemyDeath?.(this, u, p);
    }
  }

  async eliminate(pid: PlayerId): Promise<void> {
    const p = this.players[pid];
    if (!p.alive) return;
    p.alive = false;
    await this.emit({ t: 'eliminated', player: pid });
    for (const u of this.unitsOf(pid)) {
      u.dead = true;
      await this.emit({ t: 'death', uid: u.uid, killer: null });
    }
    for (const t of this.board.nodes()) if (t.node!.owner === pid) t.node!.owner = null;
    this.checkWin();
    if (this.over) await this.emit({ t: 'battleEnd', winner: this.winner, winnerTeam: this.winnerTeam });
  }

  checkWin(): void {
    const teams = new Set(this.players.filter((p) => p.alive).map((p) => p.team));
    if (teams.size <= 1) {
      this.over = true;
      const t = [...teams][0];
      this.winnerTeam = t ?? null;
      this.winner = t === undefined ? null : this.players.find((p) => p.alive && p.team === t)!.id;
    }
  }

  // ====================================================================
  // Forced movement
  // ====================================================================

  async push(u: Unit, from: Pos, dist: number, pull = false): Promise<void> {
    if (u.dead) return;
    if (this.kw(u, 'unstoppable') > 0 || this.kw(u, 'immobile') > 0) {
      await this.emit({ t: 'float', uid: u.uid, text: '纹丝不动', tone: 'info' });
      return;
    }
    let dx = Math.sign(u.x - from.x);
    let dy = Math.sign(u.y - from.y);
    if (pull) {
      dx = -dx;
      dy = -dy;
    }
    if (dx === 0 && dy === 0) return;
    const start = { x: u.x, y: u.y };
    let cur = { ...start };
    let bump = false;
    let bumpUnit: Unit | undefined;
    for (let i = 0; i < dist; i++) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nt = this.board.at(nx, ny);
      const ct = this.board.get(cur);
      if (pull && from.x === nx && from.y === ny) break;
      if (!nt || !this.board.standable(nt, this.isFlying(u), this.kw(u, 'swim') > 0) || nt.h - ct.h > 1) {
        bump = true;
        break;
      }
      const occ = this.unitAt(nx, ny);
      if (occ) {
        bump = true;
        bumpUnit = occ;
        break;
      }
      cur = { x: nx, y: ny };
    }
    const fall = this.isFlying(u) ? 0 : Math.max(0, this.board.get(start).h - this.board.get(cur).h);
    await this.emit({ t: 'push', uid: u.uid, from: start, to: cur, fall, bump });
    u.x = cur.x;
    u.y = cur.y;
    if (bump && !pull) {
      await this.damage(u, rollDice(this.rng, '1d4').total, 'physical', null, { label: '撞击' });
      if (bumpUnit && !bumpUnit.dead) await this.damage(bumpUnit, rollDice(this.rng, '1d4').total, 'physical', null, { label: '撞击' });
    }
    if (u.dead) return;
    if (fall >= 2) {
      await this.emit({ t: 'float', uid: u.uid, text: `坠落 ${fall} 层`, tone: 'bad' });
      await this.damage(u, rollDice(this.rng, `${fall - 1}d6`).total, 'physical', null, { label: '坠落' });
      if (!u.dead) await this.addStatus(u, 'prone', 1);
    }
    if (!u.dead && (cur.x !== start.x || cur.y !== start.y)) await this.arrive(u, 'push');
  }

  async teleport(u: Unit, to: Pos): Promise<void> {
    if (u.dead || this.unitAt(to.x, to.y)) return;
    const from = { x: u.x, y: u.y };
    await this.emit({ t: 'teleport', uid: u.uid, from, to });
    u.x = to.x;
    u.y = to.y;
    await this.arrive(u, 'teleport');
  }

  // ====================================================================
  // Effects interpreter
  // ====================================================================

  ctxFor(pid: PlayerId, source: Unit | null, spec: TargetSpec | undefined, target: Pos | null, card: CardDef | null, upgraded: boolean, label: string): Ctx {
    const tu = target && spec?.kind === 'unit' ? this.unitAt(target.x, target.y) ?? null : null;
    return {
      player: pid,
      source,
      targetUnit: tu,
      targetPos: target,
      area: this.areaOf(spec, source, target),
      card,
      upgraded,
      params: card?.params ?? {},
      other: null,
      isSpell: false,
      label,
    };
  }

  private param(v: Num, ctx: Ctx): Num {
    if (typeof v === 'string' && v.startsWith('$')) {
      const key = v.slice(1);
      const pv = ctx.params[key];
      if (pv === undefined) throw new Error(`missing param ${key} in ${ctx.card?.id ?? ctx.label}`);
      return pv;
    }
    return v;
  }

  numOf(v: Num, ctx: Ctx): number {
    const p = this.param(v, ctx);
    if (typeof p === 'number') return p;
    if (/d/.test(p)) return rollDice(this.rng, p).total;
    return parseInt(p, 10) || 0;
  }

  private async rollEffect(v: Num, ctx: Ctx, label: string, crit = false): Promise<number> {
    const p = this.param(v, ctx);
    if (typeof p === 'number') return p;
    if (!/d/.test(p)) return parseInt(p, 10) || 0;
    const r: DiceRoll = rollDice(this.rng, p, crit);
    await this.emit({ t: 'damageRoll', uid: ctx.source?.uid ?? null, roll: r, label, extra: [] });
    return r.total;
  }

  select(sel: Selector | undefined, ctx: Ctx): Unit[] {
    const s = sel ?? 'target';
    const pid = ctx.player;
    const self = ctx.source && !ctx.source.dead ? ctx.source : null;
    // positional reference: a dead source (last words) still has a position
    const ref = ctx.source ?? null;
    switch (s) {
      case 'target': {
        if (ctx.area) return ctx.area.map((t) => this.unitAt(t.x, t.y)).filter((u): u is Unit => !!u);
        if (ctx.targetUnit) return ctx.targetUnit.dead ? [] : [ctx.targetUnit];
        if (ctx.targetPos) {
          const u = this.unitAt(ctx.targetPos.x, ctx.targetPos.y);
          return u ? [u] : [];
        }
        return [];
      }
      case 'targetEnemies':
        return this.select('target', ctx).filter((u) => this.hostile(pid, u.owner));
      case 'targetAllies':
        return this.select('target', ctx).filter((u) => !this.hostile(pid, u.owner));
      case 'self':
        return self ? [self] : [];
      case 'hero': {
        const h = this.hero(pid);
        return h.dead ? [] : [h];
      }
      case 'enemyHero': {
        const hs = this.players.filter((p) => p.alive && this.hostile(pid, p.id)).map((p) => this.hero(p.id));
        const r = ref ?? this.hero(pid);
        hs.sort((a, b) => cheb(a, r) - cheb(b, r));
        return hs.slice(0, 1);
      }
      case 'allAllies':
        return this.alliesOf(pid);
      case 'allEnemies':
        return this.enemiesOf(pid);
      case 'allUnits':
        return this.alive();
      case 'adjacentEnemies':
        return ref ? this.adjacentEnemies(ref) : [];
      case 'adjacentAllies':
        return ref ? this.adjacentAllies(ref, ref.uid) : [];
      case 'adjacentToTarget': {
        const c = ctx.targetUnit ?? ctx.targetPos;
        if (!c) return [];
        return this.alive().filter((u) => cheb(u, c) === 1);
      }
      case 'nearestEnemy': {
        const r = ref ?? this.hero(pid);
        const es = this.enemiesOf(pid).filter((e) => !this.has(e, 'hidden'));
        es.sort((a, b) => cheb(a, r) - cheb(b, r) || a.hp - b.hp);
        return es.slice(0, 1);
      }
      case 'randomEnemy': {
        const es = this.enemiesOf(pid).filter((e) => !this.has(e, 'hidden'));
        return es.length ? [this.rng.pick(es)] : [];
      }
      case 'lowestAlly': {
        const as = this.alliesOf(pid).filter((a) => a.hp < a.maxHp);
        as.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        return as.slice(0, 1);
      }
      case 'killer':
      case 'attacker':
        return ctx.other && !ctx.other.dead ? [ctx.other] : [];
    }
    return [];
  }

  async runEffects(effects: Effect[], ctx: Ctx): Promise<void> {
    for (const e of effects) {
      if (this.over) return;
      await this.runEffect(e, ctx);
    }
  }

  private dcFor(ctx: Ctx, save: { dc?: number }): number {
    if (save.dc) return save.dc;
    return this.players[ctx.player].spellDC;
  }

  private spellBonus(ctx: Ctx, type: DamageType): number {
    const p = this.players[ctx.player];
    let b = 0;
    for (const pa of this.passivesOf(p)) b += pa.spellBonus?.(this, type, p) ?? 0;
    return b;
  }

  async runEffect(e: Effect, ctx: Ctx): Promise<void> {
    switch (e.op) {
      case 'damage': {
        const targets = this.select(e.to, ctx);
        const type = e.dmgType ?? 'physical';
        // element reactions on the targeted tiles
        const tiles = ctx.area ?? (ctx.targetPos ? [this.board.get(ctx.targetPos)] : targets.map((t) => this.tileOf(t)));
        if (e.fx) {
          for (const t of targets) await this.emit({ t: 'fx', kind: e.fx, from: ctx.source ? { x: ctx.source.x, y: ctx.source.y } : undefined, to: { x: t.x, y: t.y } });
        }
        if (e.spellAttack) {
          for (const t of targets) {
            if (t.dead) continue;
            const p = this.players[ctx.player];
            const mods: Mod[] = [{ label: '法术攻击', value: p.spellAtk }];
            if (ctx.source) {
              const dh = this.tileOf(ctx.source).h - this.tileOf(t).h;
              if (dh >= 1) mods.push({ label: '高地优势', value: 2 });
              else if (dh <= -1) mods.push({ label: '低地劣势', value: -2 });
            }
            const r = await this.d20({ kind: 'attack', player: ctx.player, uid: ctx.source?.uid ?? null, vs: t.uid, label: `${ctx.label} → ${t.name}`, mods, target: this.acOf(t), importance: t.isHero ? 0.7 : 0.4 });
            if (ctx.source) await this.emit({ t: 'strike', attacker: ctx.source.uid, target: t.uid, hit: r.success, crit: r.crit, ranged: true, fx: e.fx ?? 'magic' });
            if (!r.success) {
              await this.emit({ t: 'float', uid: t.uid, text: '未命中', tone: 'info' });
              continue;
            }
            const amt = (await this.rollEffect(e.amount, ctx, ctx.label, r.crit)) + this.spellBonus(ctx, type);
            await this.damage(t, amt, type, ctx.source, { crit: r.crit, label: ctx.label });
          }
          await this.elementReact(tiles, type, ctx);
          return;
        }
        const amount = (await this.rollEffect(e.amount, ctx, ctx.label)) + (ctx.isSpell ? this.spellBonus(ctx, type) : 0);
        const sculpt = ctx.isSpell && this.passivesOf(this.players[ctx.player]).some((pa) => pa.sculpt);
        for (const t of targets) {
          if (t.dead) continue;
          if (sculpt && !this.hostile(ctx.player, t.owner)) continue;
          let amt = amount;
          if (e.save) {
            const r = await this.savingThrow(t, e.save.type, this.dcFor(ctx, e.save), ctx.player, ctx.label, t.isHero ? 0.7 : 0.4);
            const evasion = e.save.type === 'ref' && this.kw(t, 'evasion') > 0;
            if (r.success) amt = e.save.half && !evasion ? Math.floor(amt / 2) : 0;
            else if (evasion && e.save.half) amt = Math.floor(amt / 2);
            if (amt === 0) {
              await this.emit({ t: 'float', uid: t.uid, text: '豁免成功', tone: 'info' });
              continue;
            }
          }
          await this.damage(t, amt, type, ctx.source, { label: ctx.label });
        }
        await this.elementReact(tiles, type, ctx);
        return;
      }
      case 'heal': {
        const targets = this.select(e.to, ctx);
        const amt = await this.rollEffect(e.amount, ctx, '治疗');
        for (const t of targets) {
          await this.emit({ t: 'fx', kind: e.fx ?? 'heal', to: { x: t.x, y: t.y } });
          await this.heal(t, amt);
        }
        return;
      }
      case 'status': {
        for (const t of this.select(e.to, ctx)) {
          if (e.save) {
            const r = await this.savingThrow(t, e.save.type, this.dcFor(ctx, e.save), ctx.player, ctx.label, 0.5);
            if (r.success) {
              await this.emit({ t: 'float', uid: t.uid, text: '豁免成功', tone: 'info' });
              continue;
            }
          }
          await this.addStatus(t, e.status, this.numOf(e.turns, ctx), e.value !== undefined ? this.numOf(e.value, ctx) : undefined, ctx.player);
        }
        return;
      }
      case 'cleanse': {
        for (const t of this.select(e.to, ctx)) await this.cleanse(t);
        return;
      }
      case 'buff': {
        const amt = this.numOf(e.amount, ctx);
        for (const t of this.select(e.to, ctx)) await this.buff(t, e.stat, amt, e.turns);
        return;
      }
      case 'keyword': {
        for (const t of this.select(e.to, ctx)) await this.grantKeyword(t, e.kw, e.value ?? 1, e.turns);
        return;
      }
      case 'summon': {
        const def = getCard(e.card);
        const n = e.count ?? 1;
        const anchor: Pos | null =
          e.at === 'target' ? ctx.targetPos : e.at === 'nearTarget' ? ctx.targetPos ?? ctx.targetUnit : e.at === 'nearHero' ? this.hero(ctx.player) : ctx.source ?? this.hero(ctx.player);
        if (!anchor) return;
        for (let i = 0; i < n; i++) {
          let spot: Pos | null = null;
          if (e.at === 'target' && i === 0 && !this.unitAt(anchor.x, anchor.y) && this.board.standable(this.board.get(anchor))) spot = anchor;
          if (!spot) {
            const cands = this.board
              .area(anchor, 1)
              .filter((t) => !this.unitAt(t.x, t.y) && this.board.standable(t, !!def.unit?.kw?.flying));
            if (cands.length) spot = this.rng.pick(cands);
          }
          if (!spot) break;
          await this.emit({ t: 'fx', kind: 'summon', to: spot });
          await this.summon(ctx.player, def, spot, null, { token: true, silent: true });
        }
        return;
      }
      case 'draw':
        await this.draw(ctx.player, this.numOf(e.n, ctx));
        return;
      case 'mana':
        await this.gainMana(ctx.player, this.numOf(e.n, ctx));
        return;
      case 'fate':
        await this.gainFate(ctx.player, this.numOf(e.n, ctx));
        return;
      case 'surface': {
        const tiles = ctx.area ?? (ctx.targetPos ? this.board.area(ctx.targetPos, e.radius ?? 0) : []);
        await this.setSurfaces(tiles, e.surface, e.turns ?? 2, ctx.player);
        return;
      }
      case 'raise': {
        const tiles = ctx.area ?? (ctx.targetPos ? this.board.area(ctx.targetPos, e.radius ?? 0) : []);
        const changed: { x: number; y: number; h: number }[] = [];
        for (const t of tiles) {
          if (t.terrain === 'deep' || t.terrain === 'lava') continue;
          const nh = Math.max(0, Math.min(5, t.h + e.amount));
          if (nh === t.h) continue;
          t.h = nh;
          if (t.terrain === 'water' && e.amount > 0) t.terrain = 'plain';
          changed.push({ x: t.x, y: t.y, h: nh });
        }
        if (changed.length) await this.emit({ t: 'height', tiles: changed });
        return;
      }
      case 'terrain': {
        const tiles = ctx.area ?? (ctx.targetPos ? this.board.area(ctx.targetPos, e.radius ?? 0) : []);
        const changed: { x: number; y: number; terrain: typeof e.terrain }[] = [];
        for (const t of tiles) {
          if (t.terrain === e.terrain || t.node) continue;
          if ((e.terrain === 'rock' || e.terrain === 'ruins') && this.unitAt(t.x, t.y)) continue;
          if (t.terrain === 'deep' || t.terrain === 'lava') continue;
          t.terrain = e.terrain;
          changed.push({ x: t.x, y: t.y, terrain: e.terrain });
        }
        if (changed.length) await this.emit({ t: 'terrain', tiles: changed });
        return;
      }
      case 'push':
      case 'pull': {
        const origin: Pos | null = e.op === 'push' && e.from === 'center' ? ctx.targetPos : ctx.source ?? this.hero(ctx.player);
        if (!origin) return;
        const targets = this.select(e.to, ctx).filter((t) => !(t.x === origin.x && t.y === origin.y));
        // push farthest first so chains resolve sensibly
        targets.sort((a, b) => cheb(b, origin) - cheb(a, origin));
        for (const t of targets) await this.push(t, origin, e.dist, e.op === 'pull');
        return;
      }
      case 'teleportSelf': {
        if (!ctx.source || !ctx.targetPos) return;
        await this.teleport(ctx.source, ctx.targetPos);
        return;
      }
      case 'destroy': {
        for (const t of this.select(e.to, ctx)) await this.kill(t, ctx.source);
        return;
      }
      case 'addCard': {
        const p = this.players[ctx.player];
        for (let i = 0; i < (e.n ?? 1); i++) {
          const inst: CardInst = { iid: this.newIid(), id: e.card, up: false };
          if ((e.where ?? 'hand') === 'hand' && p.hand.length < p.handMax) {
            p.hand.push(inst);
            await this.emit({ t: 'draw', player: ctx.player, iid: inst.iid, id: inst.id });
          } else {
            p.deck.splice(this.rng.int(0, p.deck.length), 0, inst);
          }
        }
        return;
      }
      case 'refresh': {
        for (const t of this.select(e.to, ctx)) {
          t.actions = Math.max(t.actions, 1);
          t.mp = Math.max(t.mp, this.moveOf(t));
          t.sick = false;
          await this.emit({ t: 'float', uid: t.uid, text: '再动', tone: 'good' });
        }
        return;
      }
      case 'fx': {
        await this.emit({
          t: 'fx',
          kind: e.kind,
          from: ctx.source ? { x: ctx.source.x, y: ctx.source.y } : undefined,
          to: ctx.targetPos ?? (ctx.targetUnit ? { x: ctx.targetUnit.x, y: ctx.targetUnit.y } : undefined),
          area: ctx.area?.map((t) => ({ x: t.x, y: t.y })),
          color: e.color,
        });
        return;
      }
      case 'chance': {
        if (this.rng.chance(e.p)) await this.runEffects(e.then, ctx);
        else if (e.else) await this.runEffects(e.else, ctx);
        return;
      }
      case 'roll': {
        const r = rollDice(this.rng, `1d${e.die}`);
        await this.emit({ t: 'damageRoll', uid: ctx.source?.uid ?? null, roll: r, label: e.label ?? '命运之骰', extra: [] });
        const rows = [...e.table].sort((a, b) => b.min - a.min);
        const row = rows.find((x) => r.total >= x.min);
        if (row) {
          await this.say(`🎲 ${r.total}：${row.label}`, 'fate');
          if (ctx.source) await this.emit({ t: 'float', uid: ctx.source.uid, text: `${r.total}·${row.label}`, tone: 'gold' });
          await this.runEffects(row.effects, ctx);
        }
        return;
      }
      case 'custom': {
        const ectx: EffectCtx = {
          battle: this,
          player: ctx.player,
          source: ctx.source?.uid ?? null,
          targetUnit: ctx.targetUnit?.uid ?? null,
          targetPos: ctx.targetPos,
          card: ctx.card,
          upgraded: ctx.upgraded,
          params: ctx.params,
          other: ctx.other?.uid ?? null,
        };
        await e.fn(ectx);
        return;
      }
    }
  }

  async buff(t: Unit, stat: BuffStat, amt: number, turns?: number): Promise<void> {
    if (t.dead) return;
    if (turns === undefined || turns >= 99) {
      // permanent
      if (stat === 'maxHp') {
        t.maxHp += amt;
        t.hp += Math.max(0, amt);
        t.hp = Math.min(t.hp, t.maxHp);
      } else if (stat === 'atk') t.atk += amt;
      else if (stat === 'ac') t.ac += amt;
      else if (stat === 'move') {
        t.move += amt;
        if (t.owner === this.active) t.mp = Math.max(0, t.mp + amt);
      } else if (stat === 'range') {
        if (t.range > 1) t.range += amt;
      } else if (stat === 'dmg') t.buffs.push({ stat: 'dmg', amount: amt, turns: 99 });
    } else {
      t.buffs.push({ stat, amount: amt, turns });
      if (stat === 'move' && t.owner === this.active) t.mp = Math.max(0, t.mp + amt);
    }
    const names: Record<BuffStat, string> = { atk: '命中', ac: 'AC', maxHp: '生命', move: '移动', range: '射程', dmg: '伤害' };
    await this.emit({ t: 'float', uid: t.uid, text: `${amt >= 0 ? '+' : ''}${amt} ${names[stat]}`, tone: amt >= 0 ? 'good' : 'bad' });
  }

  async grantKeyword(t: Unit, kw: Keyword, value: number, turns?: number): Promise<void> {
    if (t.dead) return;
    if (turns === undefined) {
      t.kw[kw] = (t.kw[kw] ?? 0) + value;
    } else {
      t.tempKw.push({ kw, value, turns });
    }
    if (kw === 'ward') t.ward += value;
    if (kw === 'stealth' && !this.has(t, 'hidden')) {
      t.statuses.push({ id: 'hidden', turns: turns ?? 99 });
      await this.emit({ t: 'stealth', uid: t.uid, hidden: true });
    }
    if (kw === 'haste' && t.sick) {
      t.sick = false;
      if (t.owner === this.active) {
        t.mp = this.moveOf(t);
        t.actions = Math.max(1, t.actions);
      }
    }
    await this.emit({ t: 'float', uid: t.uid, text: `获得【${KEYWORD_NAMES[kw]}】`, tone: 'good' });
  }

  async setSurfaces(tiles: Tile[], s: SurfaceType | null, turns: number, owner: PlayerId | null): Promise<void> {
    const changed: Pos[] = [];
    const explode: Tile[] = [];
    for (const t of tiles) {
      if (t.terrain === 'rock' || t.terrain === 'ruins') continue;
      if (s === 'fire' && (t.terrain === 'water' || t.terrain === 'deep')) continue;
      if (s === 'fire' && t.surface === 'ice') {
        this.board.setSurface(t, null, 0, null);
        changed.push(t);
        continue;
      }
      if (s === 'fire' && (t.surface === 'oil' || t.surface === 'poison')) explode.push(t);
      if (s === 'ice' && t.surface === 'fire') {
        this.board.setSurface(t, null, 0, null);
        changed.push(t);
        continue;
      }
      if ((s === 'oil' || s === 'poison') && t.surface === 'fire') {
        explode.push(t);
        continue;
      }
      this.board.setSurface(t, s, turns, owner);
      changed.push({ x: t.x, y: t.y });
    }
    if (changed.length) await this.emit({ t: 'surface', tiles: changed.map((t) => ({ x: t.x, y: t.y })), surface: s });
    if (explode.length) await this.explode(explode, owner);
  }

  /** oil/poison + fire */
  async explode(tiles: Tile[], owner: PlayerId | null): Promise<void> {
    await this.emit({ t: 'fx', kind: 'explosion', area: tiles.map((t) => ({ x: t.x, y: t.y })), to: { x: tiles[0].x, y: tiles[0].y } });
    await this.say('💥 爆燃！', 'crit');
    for (const t of tiles) {
      this.board.setSurface(t, 'fire', 2, owner);
      const u = this.unitAt(t.x, t.y);
      if (u) {
        await this.damage(u, rollDice(this.rng, '2d6').total, 'fire', null, { label: '爆燃' });
        if (!u.dead) await this.addStatus(u, 'burning', 2);
      }
    }
    await this.emit({ t: 'surface', tiles: tiles.map((t) => ({ x: t.x, y: t.y })), surface: 'fire' });
  }

  /** Elemental interactions after damage of a type hits tiles. */
  async elementReact(tiles: Tile[], type: DamageType, ctx: Ctx): Promise<void> {
    if (type === 'fire') {
      const oily = tiles.filter((t) => t.surface === 'oil' || t.surface === 'poison');
      if (oily.length) await this.explode(oily, ctx.player);
      const icy = tiles.filter((t) => t.surface === 'ice');
      if (icy.length) await this.setSurfaces(icy, null, 0, null);
    } else if (type === 'cold') {
      const water = tiles.filter((t) => t.terrain === 'water' && t.surface !== 'ice');
      if (water.length) {
        await this.setSurfaces(water, 'ice', 3, ctx.player);
        for (const t of water) {
          const u = this.unitAt(t.x, t.y);
          if (u && !this.isFlying(u)) await this.addStatus(u, 'rooted', 1);
        }
      }
      const fire = tiles.filter((t) => t.surface === 'fire');
      if (fire.length) await this.setSurfaces(fire, null, 0, null);
    } else if (type === 'lightning') {
      const seen = new Set<string>();
      const shocked = new Set<Uid>();
      for (const t of tiles) {
        if (t.terrain !== 'water' && t.terrain !== 'deep') continue;
        if (seen.has(posKey(t))) continue;
        const body = this.board.waterBody(t);
        body.forEach((b) => seen.add(posKey(b)));
        const victims = body.map((b) => this.unitAt(b.x, b.y)).filter((u): u is Unit => !!u && !this.isFlying(u));
        if (victims.length) {
          await this.emit({ t: 'fx', kind: 'shock', area: body.map((b) => ({ x: b.x, y: b.y })) });
          await this.say('⚡ 水面导电！', 'crit');
        }
        for (const v of victims) {
          if (shocked.has(v.uid)) continue;
          shocked.add(v.uid);
          await this.damage(v, rollDice(this.rng, '1d6').total, 'lightning', null, { label: '感电' });
          if (!v.dead) await this.addStatus(v, 'stunned', 1);
        }
      }
    }
  }

  // ====================================================================
  // Triggers
  // ====================================================================

  async fireTriggers(u: Unit, on: TriggerOn, other: Unit | null, evenIfDead = false): Promise<void> {
    if ((u.dead && !evenIfDead) || this.over) return;
    if (this.depth > 12) return;
    const list = u.triggers.filter((t) => t.on === on);
    if (!list.length) return;
    this.depth++;
    try {
      for (const tr of list) {
        if (this.over) return;
        if (tr.label) await this.emit({ t: 'float', uid: u.uid, text: tr.label, tone: 'info' });
        const ctx: Ctx = {
          player: u.owner,
          source: u,
          targetUnit: other,
          targetPos: other ? { x: other.x, y: other.y } : { x: u.x, y: u.y },
          area: null,
          card: null,
          upgraded: u.up,
          params: {},
          other,
          isSpell: false,
          label: tr.label ?? u.name,
        };
        // death triggers act from the corpse position
        await this.runEffects(tr.effects, ctx);
      }
    } finally {
      this.depth--;
    }
  }
}

export const KEYWORD_NAMES: Record<Keyword, string> = {
  haste: '疾驰',
  provoke: '嘲讽',
  flying: '飞行',
  stealth: '潜行',
  lifesteal: '吸血',
  ward: '护盾',
  regen: '再生',
  pack: '群狼战术',
  sneak: '偷袭',
  cleave: '横扫',
  pierce: '贯穿',
  reach: '长柄',
  riposte: '反击',
  sentinel: '截击',
  keen: '敏锐',
  lucky: '幸运',
  charge: '冲锋',
  fortify: '坚守',
  push: '击退',
  frenzy: '狂暴',
  vantage: '高地专精',
  airdrop: '空降',
  evasion: '闪避',
  flurry: '连击',
  auraAC: '守护光环',
  auraAtk: '战意光环',
  thorns: '荆棘',
  unstoppable: '不屈',
  swim: '水栖',
  venom: '剧毒',
  ignite: '点燃',
  chill: '寒霜',
  blast: '溅射',
  spellward: '法术抗性',
  immobile: '固定',
  shield: '格挡',
  scout: '斥候',
  climb: '攀爬',
  pierceArmor: '破甲',
  bloodthirst: '嗜血',
  inspire: '鼓舞',
};

export function describeDamage(expr: string): string {
  return diceToString(parseDice(expr));
}
