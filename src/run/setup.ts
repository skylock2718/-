import type { BattleSetup, PlayerSetup } from '../core/battle';
import { generateMap } from '../core/mapgen';
import type { CardInst, CommanderDef } from '../core/types';
import type { EncounterDef } from '../data/encounters';
import type { HeroDef } from '../data/heroes';

export const TEAM_COLORS = ['#4aa3ff', '#ff4d5e', '#5fe08a', '#ffc84a'];

let iidSeq = 1;
export function makeInst(id: string, up = false): CardInst {
  return { iid: iidSeq++, id, up };
}

export function deckFromIds(ids: string[]): CardInst[] {
  return ids.map((id) => makeInst(id));
}

export interface PlayerSide {
  hero: HeroDef | CommanderDef;
  name?: string;
  deck: CardInst[];
  hp?: number;
  maxHp?: number;
  passives: string[];
  potions?: (string | null)[];
  isAI?: boolean;
  aiLevel?: number;
  abilities?: HeroDef['abilities'];
  prof?: number;
}

/** Ascension (天命等级) traits applied to enemies. */
export function ascensionTraits(level: number, kind: EncounterDef['kind']): string[] {
  const t: string[] = [];
  if (level >= 1 && kind !== 'first') t.push('trait-asc-hp');
  if (level >= 2) t.push('trait-asc-atk');
  if (level >= 3 && (kind === 'elite' || kind === 'boss')) t.push('trait-asc-mana');
  return t;
}

export function buildEncounterBattle(o: { seed: number; player: PlayerSide; encounter: EncounterDef; ascension?: number; karmic?: boolean; firstPlayer?: number }): BattleSetup {
  const enc = o.encounter;
  const size = enc.size ?? (enc.kind === 'elite' ? 9 : enc.kind === 'boss' ? 10 : 9);
  const map = generateMap({ biome: enc.biome, w: size, h: size, players: 2, seed: o.seed, layout: enc.layout, events: enc.kind === 'boss' ? 1 : 2 });
  const p = o.player;
  const player: PlayerSetup = {
    name: p.name ?? p.hero.name,
    isAI: !!p.isAI,
    team: 0,
    color: TEAM_COLORS[0],
    commander: p.hero,
    heroHp: p.hp,
    heroMaxHp: p.maxHp,
    deck: p.deck,
    passives: p.passives,
    potions: p.potions,
    abilities: p.abilities,
    prof: p.prof,
    aiLevel: p.aiLevel ?? 0.8,
  };
  const enemy: PlayerSetup = {
    name: enc.commander.name,
    isAI: true,
    team: 1,
    color: TEAM_COLORS[1],
    commander: enc.commander,
    deck: deckFromIds(enc.deck),
    passives: [...(enc.traits ?? []), ...ascensionTraits(o.ascension ?? 0, enc.kind)],
    aiLevel: enc.aiLevel,
    prof: enc.act + 1,
  };
  return {
    board: map.board,
    spawns: map.spawns,
    players: [player, enemy],
    seed: o.seed ^ 0x5bd1e995,
    karmic: o.karmic ?? true,
    firstPlayer: o.firstPlayer ?? 0,
  };
}

export function buildSkirmish(o: { seed: number; sides: PlayerSide[]; biome: 'verdant' | 'ashen' | 'astral'; size?: number; ffa?: boolean; teams?: number[]; karmic?: boolean }): BattleSetup {
  const n = o.sides.length;
  const size = o.size ?? (n > 2 ? 11 : 9);
  const map = generateMap({ biome: o.biome, w: size, h: size, players: n, seed: o.seed, events: n > 2 ? 2 : 2 });
  const players: PlayerSetup[] = o.sides.map((s, i) => ({
    name: s.name ?? s.hero.name,
    isAI: !!s.isAI,
    team: o.teams?.[i] ?? (o.ffa || n === 2 ? i : i === 0 ? 0 : 1),
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    commander: s.hero,
    heroHp: s.hp,
    heroMaxHp: s.maxHp,
    deck: s.deck,
    passives: s.passives,
    potions: s.potions,
    abilities: s.abilities,
    prof: s.prof,
    aiLevel: s.aiLevel ?? 0.8,
  }));
  return { board: map.board, spawns: map.spawns, players, seed: o.seed ^ 0x2c1b3c6d, karmic: o.karmic ?? true, firstPlayer: 0 };
}
