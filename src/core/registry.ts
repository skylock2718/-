import type { CardDef, CardInst, CommanderDef, Effect, TargetSpec } from './types';
import type { Battle, PlayerState, Unit } from './battle';
import type { Mod, DamageType, NodeKind, SaveType } from './types';
import type { RollEvent } from './types';
import type { Tile } from './types';

/**
 * Content registries. Data modules register into these; the engine only
 * looks things up by id, so core never imports data (no cycles).
 */

const cards = new Map<string, CardDef>();
const passives = new Map<string, PassiveDef>();
const potions = new Map<string, PotionDef>();
const commanders = new Map<string, CommanderDef>();

export function registerCards(defs: CardDef[]): void {
  for (const d of defs) {
    if (cards.has(d.id)) throw new Error(`duplicate card id ${d.id}`);
    cards.set(d.id, d);
  }
}

export function getCard(id: string): CardDef {
  const c = cards.get(id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}

export function hasCard(id: string): boolean {
  return cards.has(id);
}

export function allCards(): CardDef[] {
  return [...cards.values()];
}

/** The effective definition of a card instance (upgrades merged). */
export function cardOf(inst: CardInst | { id: string; up: boolean }): CardDef {
  const base = getCard(inst.id);
  if (!inst.up || !base.up) return base;
  return upgradedDef(base);
}

const upCache = new Map<string, CardDef>();
export function upgradedDef(base: CardDef): CardDef {
  const hit = upCache.get(base.id);
  if (hit) return hit;
  const u = base.up ?? {};
  const merged: CardDef = {
    ...base,
    ...u,
    id: base.id,
    name: base.name + '+',
    params: { ...(base.params ?? {}), ...(u.params ?? {}) },
    unit: base.unit ? { ...base.unit, ...(u.unit ?? {}), kw: { ...(base.unit.kw ?? {}), ...(u.unit?.kw ?? {}) } } : undefined,
    equip: base.equip ? { ...base.equip, ...(u.equip ?? {}), kw: { ...(base.equip.kw ?? {}), ...(u.equip?.kw ?? {}) } } : undefined,
  };
  upCache.set(base.id, merged);
  return merged;
}

export function canUpgrade(inst: CardInst): boolean {
  const c = getCard(inst.id);
  return !inst.up && !!c.up && c.type !== 'curse';
}

export function registerPassives(defs: PassiveDef[]): void {
  for (const d of defs) {
    if (passives.has(d.id)) throw new Error(`duplicate passive id ${d.id}`);
    passives.set(d.id, d);
  }
}

export function getPassive(id: string): PassiveDef | undefined {
  return passives.get(id);
}

export function allPassives(): PassiveDef[] {
  return [...passives.values()];
}

export function registerPotions(defs: PotionDef[]): void {
  for (const d of defs) potions.set(d.id, d);
}

export function getPotion(id: string): PotionDef {
  const p = potions.get(id);
  if (!p) throw new Error(`unknown potion ${id}`);
  return p;
}

export function allPotions(): PotionDef[] {
  return [...potions.values()];
}

export function registerCommanders(defs: CommanderDef[]): void {
  for (const d of defs) commanders.set(d.id, d);
}

export function getCommander(id: string): CommanderDef {
  const c = commanders.get(id);
  if (!c) throw new Error(`unknown commander ${id}`);
  return c;
}

// ----------------------------------------------------------------- types

export type PassiveKind = 'relic' | 'feat' | 'boss' | 'hero' | 'curse' | 'modifier';
export type RelicRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'boss' | 'shop' | 'event';

type Maybe<T> = T | Promise<T>;

/** Relics, feats, hero passives and boss traits all share these hooks. */
export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  icon: string;
  kind: PassiveKind;
  rarity?: RelicRarity;
  flavor?: string;
  /** relic only obtainable for this hero */
  hero?: string;

  // static modifiers read at battle setup
  maxFate?: number;
  startFate?: number;
  startMana?: number;
  maxManaCap?: number;
  handSize?: number;
  heroHp?: number;
  heroAc?: number;
  heroAtk?: number;
  heroMove?: number;
  spellDC?: number;
  noReplace?: boolean;
  drawPerTurn?: number;

  // battle hooks
  battleStart?(b: Battle, p: PlayerState): Maybe<void>;
  turnStart?(b: Battle, p: PlayerState): Maybe<void>;
  turnEnd?(b: Battle, p: PlayerState): Maybe<void>;
  /** sync: add to-hit modifiers (used for previews too) */
  attackMods?(b: Battle, att: Unit, tgt: Unit, mods: Mod[], owner: PlayerState): void;
  /** sync: extra damage dice / flat bonus for an attack */
  damageBonus?(b: Battle, att: Unit, tgt: Unit, owner: PlayerState): string | number | null;
  /** sync: lowers crit threshold by returned amount */
  critBonus?(b: Battle, u: Unit, owner: PlayerState): number;
  acBonus?(b: Battle, u: Unit, owner: PlayerState): number;
  saveBonus?(b: Battle, u: Unit, type: SaveType, owner: PlayerState): number;
  /** extra damage to spell/effect damage of a type */
  spellBonus?(b: Battle, dmgType: DamageType, owner: PlayerState): number;
  healBonus?(b: Battle, owner: PlayerState): number;
  cardCost?(b: Battle, p: PlayerState, card: CardDef): number;
  nodeIncome?(b: Battle, p: PlayerState, kind: NodeKind): number;
  lucky?(b: Battle, u: Unit, owner: PlayerState): boolean;
  onSummon?(b: Battle, u: Unit, owner: PlayerState): Maybe<void>;
  onAllyDeath?(b: Battle, u: Unit, owner: PlayerState): Maybe<void>;
  onEnemyDeath?(b: Battle, u: Unit, owner: PlayerState): Maybe<void>;
  onKill?(b: Battle, killer: Unit, victim: Unit, owner: PlayerState): Maybe<void>;
  onNat20?(b: Battle, p: PlayerState, roll: RollEvent): Maybe<void>;
  onNat1?(b: Battle, p: PlayerState, roll: RollEvent): Maybe<void>;
  onCapture?(b: Battle, p: PlayerState, tile: Tile): Maybe<void>;
  onPlayCard?(b: Battle, p: PlayerState, card: CardDef): Maybe<void>;
  /** return true to prevent the hero from dying (handle healing yourself) */
  onHeroLethal?(b: Battle, p: PlayerState, hero: Unit): Maybe<boolean>;
  /** sync: force the first attack roll etc. Return a natural value to override, or null */
  forceNat?(b: Battle, p: PlayerState, kind: 'attack' | 'save' | 'check'): number | null;
  /** an opponent rolled a natural 20: return true to force a reroll (once per turn handled by the hook) */
  opponentNat20?(b: Battle, roller: PlayerState, owner: PlayerState): boolean;
  /** spells of this player never damage friendly units */
  sculpt?: boolean;

  // run-level modifiers (read by the expedition layer)
  afterBattleHeal?: number;
  goldBonus?: number;
  shopDiscount?: number;
  restHealBonus?: number;
  cardChoices?: number;
  potionSlots?: number;
  checkBonus?: number;
  /** gold granted once when picked up */
  pickupGold?: number;
}

export interface PotionDef {
  id: string;
  name: string;
  text: string;
  icon: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare';
  target: TargetSpec;
  effects: Effect[];
  price?: number;
}
