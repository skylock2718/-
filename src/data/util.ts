import type { Battle, Unit } from '../core/battle';
import type { CardDef, CardPool, EffectCtx, Rarity, TargetSpec, Effect, UnitStats, EquipDef } from '../core/types';

/** Art palettes [background-dark, background-light, glyph] */
export const PAL = {
  paladin: ['#2e2108', '#9a7a2c', '#fff1c4'],
  ranger: ['#0c2416', '#2f7a44', '#d9ffc8'],
  wizard: ['#0e1638', '#3f4bb0', '#cfe8ff'],
  rogue: ['#24080f', '#8a2234', '#ffd98a'],
  necro: ['#0a1718', '#2c5b56', '#c6fff0'],
  neutral: ['#181b22', '#4d5668', '#eef3fb'],
  fire: ['#2a0802', '#c2410c', '#ffe1a8'],
  frost: ['#062030', '#2f8fb8', '#e2fbff'],
  storm: ['#0d1030', '#5b4fd6', '#f2edff'],
  holy: ['#2a2208', '#e0b84a', '#fffbe6'],
  shadow: ['#08060e', '#3c2a58', '#e8d8ff'],
  poison: ['#0c1a06', '#5c8a1c', '#efffc8'],
  earth: ['#1c1408', '#7a5a2a', '#ffeccc'],
  beast: ['#1a1206', '#7a5228', '#ffe8c8'],
  blood: ['#1a0406', '#8a1020', '#ffd0d0'],
  arcane: ['#160828', '#7a32b0', '#f6dcff'],
  gold: ['#241806', '#b8862a', '#fff4cf'],
  goblin: ['#121a06', '#5a7a22', '#f0ffc8'],
  undead: ['#0c1012', '#46585e', '#e8fff8'],
  void: ['#06040e', '#3a1a66', '#ffd6ff'],
  construct: ['#14100a', '#8a6a3a', '#dff6ff'],
  curse: ['#0a0a0a', '#3a1a1a', '#ff9a9a'],
  dice: ['#1a0c26', '#6a2aa0', '#ffe28a'],
} as const satisfies Record<string, readonly [string, string, string]>;

export type PalKey = keyof typeof PAL;

export function pal(k: PalKey): [string, string, string] {
  const p = PAL[k];
  return [p[0], p[1], p[2]];
}

type Base = { id: string; name: string; cost: number; rarity: Rarity; pool: CardPool; icon: string; colors?: PalKey | [string, string, string] };

function colors(c: Base['colors'], pool: CardPool): [string, string, string] {
  if (Array.isArray(c)) return c as [string, string, string];
  if (typeof c === 'string') return pal(c as PalKey);
  if (pool in PAL) return pal(pool as PalKey);
  return pal('neutral');
}

export function unit(b: Base & { text?: string; flavor?: string; tags?: string[]; up?: CardDef['up']; ai?: CardDef['ai'] }, stats: UnitStats): CardDef {
  return {
    id: b.id,
    name: b.name,
    type: 'unit',
    cost: b.cost,
    rarity: b.rarity,
    pool: b.pool,
    icon: b.icon,
    colors: colors(b.colors, b.pool),
    text: b.text ?? '',
    flavor: b.flavor,
    unit: stats,
    tags: b.tags,
    up: b.up,
    ai: b.ai,
  };
}

export function spell(
  b: Base & { text: string; flavor?: string; tags?: string[]; up?: CardDef['up']; ai?: CardDef['ai']; params?: Record<string, string | number>; exhaust?: boolean; fate?: number },
  target: TargetSpec,
  effects: Effect[],
  type: 'spell' | 'terrain' = 'spell',
): CardDef {
  return {
    id: b.id,
    name: b.name,
    type,
    cost: b.cost,
    rarity: b.rarity,
    pool: b.pool,
    icon: b.icon,
    colors: colors(b.colors, b.pool),
    text: b.text,
    flavor: b.flavor,
    target,
    effects,
    tags: b.tags,
    up: b.up,
    ai: b.ai,
    params: b.params,
    exhaust: b.exhaust,
    fate: b.fate,
  };
}

export function terrain(b: Parameters<typeof spell>[0], target: TargetSpec, effects: Effect[]): CardDef {
  return spell(b, target, effects, 'terrain');
}

export function equip(b: Base & { text: string; flavor?: string; tags?: string[]; up?: CardDef['up']; ai?: CardDef['ai']; notHero?: boolean }, e: EquipDef): CardDef {
  return {
    id: b.id,
    name: b.name,
    type: 'equip',
    cost: b.cost,
    rarity: b.rarity,
    pool: b.pool,
    icon: b.icon,
    colors: colors(b.colors, b.pool),
    text: b.text,
    flavor: b.flavor,
    equip: e,
    tags: b.tags,
    up: b.up,
    ai: b.ai,
    target: b.notHero ? { kind: 'unit', notHero: true } : undefined,
  };
}

/** typed access to the battle from custom effects */
export function B(ctx: EffectCtx): Battle {
  return ctx.battle as Battle;
}

export function srcUnit(ctx: EffectCtx): Unit | undefined {
  return B(ctx).unit(ctx.source);
}

export function tgtUnit(ctx: EffectCtx): Unit | undefined {
  const b = B(ctx);
  if (ctx.targetUnit != null) return b.unit(ctx.targetUnit);
  if (ctx.targetPos) return b.unitAt(ctx.targetPos.x, ctx.targetPos.y);
  return undefined;
}

// common target specs
export const T = {
  none: { kind: 'none' } as TargetSpec,
  enemy: (range?: number, los = true): TargetSpec => ({ kind: 'unit', side: 'enemy', range, los: range !== undefined && los }),
  enemyUnit: (range?: number): TargetSpec => ({ kind: 'unit', side: 'enemy', range, notHero: true, los: range !== undefined }),
  ally: (range?: number): TargetSpec => ({ kind: 'unit', side: 'ally', range }),
  allyUnit: (range?: number): TargetSpec => ({ kind: 'unit', side: 'ally', range, notHero: true }),
  any: (range?: number): TargetSpec => ({ kind: 'unit', side: 'any', range }),
  tile: (range?: number, radius = 0, los = false): TargetSpec => ({ kind: 'tile', range, radius, los }),
  empty: (range?: number): TargetSpec => ({ kind: 'tile', range, empty: true, radius: 0 }),
  line: (len: number): TargetSpec => ({ kind: 'tile', line: len }),
};
