import type { D20Roll, DiceRoll } from './dice';

export type PlayerId = number;
export type Uid = number;

export interface Pos {
  x: number;
  y: number;
}

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'radiant' | 'necrotic' | 'arcane' | 'psychic';
export type SaveType = 'fort' | 'ref' | 'will';
export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Tribe = 'humanoid' | 'beast' | 'undead' | 'construct' | 'elemental' | 'fey' | 'dragon' | 'fiend' | 'celestial' | 'goblinoid' | 'giant' | 'aberration';

// ------------------------------------------------------------------ board

export type TerrainType = 'plain' | 'forest' | 'water' | 'deep' | 'rock' | 'lava' | 'ruins';
export type SurfaceType = 'fire' | 'oil' | 'ice' | 'poison' | 'holy';
export type NodeKind = 'well' | 'shrine' | 'gate' | 'spring' | 'chest' | 'altar' | 'rune' | 'gold';

export interface TileNode {
  kind: NodeKind;
  owner: PlayerId | null;
  used?: boolean;
}

export interface Tile {
  x: number;
  y: number;
  /** height level 0..5 */
  h: number;
  terrain: TerrainType;
  /** stable random 0..1 for visual variety */
  variant: number;
  surface: SurfaceType | null;
  surfaceTurns: number;
  surfaceOwner: PlayerId | null;
  node: TileNode | null;
  /** cosmetic decoration (trees on forest, pebbles...) */
  deco: string | null;
}

export type BiomeId = 'verdant' | 'ashen' | 'astral';

// --------------------------------------------------------------- keywords

export type Keyword =
  | 'haste' // act on the turn it is summoned
  | 'provoke' // adjacent enemies can't move and must attack it
  | 'flying' // ignores height & terrain when moving, can melee any height
  | 'stealth' // enters hidden
  | 'lifesteal' // heals for damage dealt
  | 'ward' // negates the next N damage instances
  | 'regen' // heal N at turn start
  | 'pack' // advantage if an ally is adjacent to the target
  | 'sneak' // +Nd6 when attacking with advantage or ally adjacent to target
  | 'cleave' // also hits one other enemy adjacent to the attacker
  | 'pierce' // ranged/melee hits the unit behind the target as well
  | 'reach' // melee range 2
  | 'riposte' // strikes back when attacked in melee
  | 'sentinel' // free attack on enemies leaving adjacency
  | 'keen' // crit range expanded by N
  | 'lucky' // reroll natural 1s
  | 'charge' // +N damage if moved 3+ tiles this turn before attacking
  | 'fortify' // +N AC if it hasn't moved this turn
  | 'push' // attacks push target N tiles
  | 'frenzy' // +N damage while at or below half HP
  | 'vantage' // high-ground specialist: extra +1 hit & +1 range on high ground
  | 'airdrop' // can be summoned anywhere not adjacent to enemies
  | 'evasion' // successful reflex save negates all damage
  | 'flurry' // attacks twice per action
  | 'auraAC' // adjacent allies +N AC
  | 'auraAtk' // adjacent allies +N to hit
  | 'thorns' // melee attackers take N damage
  | 'unstoppable' // immune to stun/freeze/root/prone
  | 'swim' // water costs 1, can enter deep water
  | 'venom' // hits apply Poisoned N turns
  | 'ignite' // hits apply Burning N turns
  | 'chill' // hits apply Slowed N turns
  | 'blast' // attack also deals half damage to units adjacent to target
  | 'spellward' // advantage on saves vs spells
  | 'immobile' // cannot move (turrets, totems)
  | 'shield' // reduce physical damage by N
  | 'scout' // ignores difficult terrain costs
  | 'climb' // jump +N
  | 'pierceArmor' // ignore N points of AC
  | 'bloodthirst' // +N to hit vs damaged targets
  | 'inspire'; // adjacent allies +N damage

export type KeywordMap = Partial<Record<Keyword, number>>;

export type StatusId =
  | 'burning'
  | 'poisoned'
  | 'stunned'
  | 'frozen'
  | 'rooted'
  | 'prone'
  | 'frightened'
  | 'blessed'
  | 'baned'
  | 'hasted'
  | 'slowed'
  | 'marked'
  | 'regen'
  | 'inspired'
  | 'stoneskin'
  | 'weakened'
  | 'vulnerable'
  | 'shielded'
  | 'hidden'
  | 'doomed'
  | 'charmed';

export interface Status {
  id: StatusId;
  turns: number;
  /** generic magnitude (regen amount, shield amount...) */
  value?: number;
  /** player who applied it (marked, holy...) */
  by?: PlayerId;
}

// ---------------------------------------------------------------- effects

/** Numbers in effects may be literal, dice strings, or "$param" references. */
export type Num = number | string;

export type Selector =
  | 'target' // the chosen unit (or every unit in an area)
  | 'targetEnemies' // units in area hostile to the caster
  | 'targetAllies' // units in area friendly to the caster
  | 'self' // the source unit (ability user / summoned unit / hero for spells)
  | 'hero' // the caster's hero
  | 'enemyHero' // nearest enemy hero
  | 'allAllies'
  | 'allEnemies'
  | 'allUnits'
  | 'adjacentEnemies' // enemies adjacent to self
  | 'adjacentAllies' // allies adjacent to self
  | 'adjacentToTarget' // all units adjacent to target
  | 'nearestEnemy'
  | 'randomEnemy'
  | 'lowestAlly'
  | 'killer' // in death triggers: unit that killed self
  | 'attacker'; // in damaged triggers

export interface SaveSpec {
  type: SaveType;
  /** fixed DC; defaults to the caster's spell DC */
  dc?: number;
  /** on success take half (for damage) */
  half?: boolean;
}

export type Effect =
  | { op: 'damage'; amount: Num; dmgType?: DamageType; to?: Selector; save?: SaveSpec; spellAttack?: boolean; fx?: string }
  | { op: 'heal'; amount: Num; to?: Selector; fx?: string }
  | { op: 'status'; status: StatusId; turns: Num; value?: Num; to?: Selector; save?: SaveSpec }
  | { op: 'cleanse'; to?: Selector }
  | { op: 'buff'; stat: BuffStat; amount: Num; turns?: number; to?: Selector }
  | { op: 'keyword'; kw: Keyword; value?: number; turns?: number; to?: Selector }
  | { op: 'summon'; card: string; count?: number; at?: 'target' | 'nearTarget' | 'nearSelf' | 'nearHero' }
  | { op: 'draw'; n: Num }
  | { op: 'mana'; n: Num }
  | { op: 'fate'; n: Num }
  | { op: 'surface'; surface: SurfaceType | null; turns?: number; radius?: number }
  | { op: 'raise'; amount: number; radius?: number }
  | { op: 'terrain'; terrain: TerrainType; radius?: number }
  | { op: 'push'; dist: number; to?: Selector; from?: 'self' | 'center' }
  | { op: 'pull'; dist: number; to?: Selector }
  | { op: 'teleportSelf' }
  | { op: 'destroy'; to?: Selector }
  | { op: 'addCard'; card: string; n?: number; where?: 'hand' | 'deck' }
  | { op: 'refresh'; to?: Selector }
  | { op: 'fx'; kind: string; color?: string }
  | { op: 'chance'; p: number; then: Effect[]; else?: Effect[] }
  | { op: 'roll'; die: number; table: { min: number; effects: Effect[]; label: string }[]; label?: string }
  | { op: 'custom'; fn: (ctx: EffectCtx) => Promise<void> | void };

export type BuffStat = 'atk' | 'ac' | 'maxHp' | 'move' | 'range' | 'dmg';

/** Opaque to data files; implemented by the battle engine. */
export interface EffectCtx {
  readonly battle: unknown;
  readonly player: PlayerId;
  readonly source: Uid | null;
  readonly targetUnit: Uid | null;
  readonly targetPos: Pos | null;
  readonly card: CardDef | null;
  readonly upgraded: boolean;
  readonly params: Record<string, string | number>;
  /** for death/damage triggers */
  readonly other: Uid | null;
}

export interface TargetSpec {
  kind: 'none' | 'unit' | 'tile';
  side?: 'enemy' | 'ally' | 'any';
  /** Chebyshev range, measured from the hero (spells) or the unit (abilities). undefined = anywhere */
  range?: number;
  /** AoE radius (Chebyshev) for tile targets */
  radius?: number;
  /** line AoE: affects tiles from caster in a straight line of this length */
  line?: number;
  los?: boolean;
  /** tile must be empty & passable */
  empty?: boolean;
  /** filters for unit targets */
  notHero?: boolean;
  onlyHero?: boolean;
  tribe?: Tribe;
  notSelf?: boolean;
  damaged?: boolean;
  /** tile must be a grave (a unit died there) or adjacent to the origin */
  grave?: boolean;
}

export type TriggerOn =
  | 'summon' // battlecry
  | 'death' // last words
  | 'turnStart'
  | 'turnEnd'
  | 'attack' // after this unit attacks (hit or miss)
  | 'hit' // this unit hits with an attack
  | 'kill' // this unit kills a unit
  | 'damaged' // this unit took damage and survived
  | 'allyDeath' // another friendly unit died
  | 'allySummon'; // another friendly unit was summoned

export interface TriggerDef {
  on: TriggerOn;
  effects: Effect[];
  /** text shown in log when fired */
  label?: string;
}

export interface AbilityDef {
  name: string;
  text: string;
  icon: string;
  target: TargetSpec;
  effects: Effect[];
  /** turns between uses (0 = every turn) */
  cooldown?: number;
  fx?: string;
  /** AI value hint: 'heal' | 'buff' | 'damage' | 'control' */
  kind?: 'heal' | 'buff' | 'damage' | 'control' | 'summon';
}

export interface UnitStats {
  hp: number;
  ac: number;
  /** to-hit bonus */
  atk: number;
  /** damage dice expression */
  dmg: string;
  dmgType?: DamageType;
  range: number;
  move: number;
  jump?: number;
  saves?: Partial<Record<SaveType, number>>;
  kw?: KeywordMap;
  tribe?: Tribe[];
  resist?: DamageType[];
  vuln?: DamageType[];
  immune?: DamageType[];
  ability?: AbilityDef;
  triggers?: TriggerDef[];
  /** attack visual: slash | pierce | arrow | bolt | fire | frost | lightning | claw | bite | smash | magic | holy | shadow | poison */
  fx?: string;
  /** standee scale */
  scale?: number;
}

// ------------------------------------------------------------------ cards

export type CardType = 'unit' | 'spell' | 'equip' | 'terrain' | 'curse';
export type Rarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary' | 'token' | 'curse';
export type HeroClass = 'paladin' | 'ranger' | 'wizard' | 'rogue' | 'necro';
export type CardPool = HeroClass | 'neutral' | 'enemy' | 'curse' | 'token';

export interface EquipDef {
  atk?: number;
  ac?: number;
  hp?: number;
  move?: number;
  range?: number;
  jump?: number;
  /** extra damage dice/flat added to attacks, e.g. "1d4" or 2 */
  dmg?: string | number;
  dmgType?: DamageType;
  kw?: KeywordMap;
  triggers?: TriggerDef[];
  /** only for units with this property */
  onlyRanged?: boolean;
  onlyMelee?: boolean;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  rarity: Rarity;
  pool: CardPool;
  icon: string;
  /** art palette [bg1, bg2, glyph] */
  colors?: [string, string, string];
  text: string;
  flavor?: string;
  unit?: UnitStats;
  target?: TargetSpec;
  effects?: Effect[];
  equip?: EquipDef;
  /** additional fate-point cost */
  fate?: number;
  /** archetype tags used for reward weighting and AI */
  tags?: string[];
  params?: Record<string, string | number>;
  /** overrides applied when the card is upgraded */
  up?: Partial<Omit<CardDef, 'id' | 'up'>>;
  /** removed for the rest of the battle after being played */
  exhaust?: boolean;
  unplayable?: boolean;
  /** AI hints */
  ai?: { value?: number; when?: 'early' | 'late' | 'defensive' | 'aggressive'; prefer?: 'enemyHero' | 'cluster' | 'strongest' | 'weakest' };
  /** this card is a token (not collectible) */
  token?: boolean;
}

export interface CardInst {
  iid: number;
  id: string;
  up: boolean;
  /** temporary cost modifier for this battle */
  costMod?: number;
}

// ------------------------------------------------------------- passives

export interface Mod {
  label: string;
  value?: number;
  adv?: 1 | -1;
  dice?: string;
}

export interface CommanderDef {
  id: string;
  name: string;
  title?: string;
  icon: string;
  colors?: [string, string, string];
  stats: UnitStats;
  abilities: Record<Ability, number>;
  castAbility: Ability;
  power?: HeroPowerDef;
  /** id of passive (relic-like) granted to this commander */
  passives?: string[];
}

export interface HeroPowerDef {
  name: string;
  text: string;
  icon: string;
  cost: number;
  target: TargetSpec;
  effects: Effect[];
  fx?: string;
}

// ------------------------------------------------------------------ events

export interface RollEvent {
  t: 'roll';
  kind: 'attack' | 'save' | 'check';
  player: PlayerId;
  /** unit making the roll (attacker / saver), null for checks made by the "party" */
  uid: Uid | null;
  /** opposing unit (target of attack, or caster for saves) */
  vs: Uid | null;
  label: string;
  d20: D20Roll;
  mods: Mod[];
  bonusRolls: { label: string; value: number; dice: string }[];
  total: number;
  target: number;
  success: boolean;
  crit: boolean;
  fumble: boolean;
  karmic?: boolean;
  reroll?: boolean;
  /** show the big BG3-style check overlay */
  big?: boolean;
  ability?: Ability;
}

export type BattleEvent =
  | { t: 'battleStart' }
  | { t: 'turnStart'; player: PlayerId; turn: number; round: number }
  | { t: 'turnEnd'; player: PlayerId }
  | { t: 'draw'; player: PlayerId; iid: number; id: string }
  | { t: 'burn'; player: PlayerId; id: string }
  | { t: 'discard'; player: PlayerId; iid: number; id: string }
  | { t: 'shuffle'; player: PlayerId }
  | { t: 'mana'; player: PlayerId; mana: number; max: number; delta: number }
  | { t: 'fate'; player: PlayerId; fate: number; delta: number }
  | { t: 'cardPlayed'; player: PlayerId; iid: number; id: string; up: boolean; target: Pos | null }
  | { t: 'heroPower'; player: PlayerId; target: Pos | null }
  | { t: 'potion'; player: PlayerId; id: string; target: Pos | null }
  | { t: 'summon'; uid: Uid; at: Pos; id: string; owner: PlayerId }
  | { t: 'move'; uid: Uid; path: Pos[] }
  | { t: 'teleport'; uid: Uid; from: Pos; to: Pos }
  | { t: 'attack'; attacker: Uid; target: Uid; ranged: boolean; fx: string }
  | RollEvent
  | { t: 'strike'; attacker: Uid; target: Uid; hit: boolean; crit: boolean; ranged: boolean; fx: string }
  | { t: 'damageRoll'; uid: Uid | null; roll: DiceRoll; label: string; extra: { label: string; roll: DiceRoll }[] }
  | {
      t: 'damage';
      uid: Uid;
      amount: number;
      dmgType: DamageType;
      crit: boolean;
      hp: number;
      maxHp: number;
      blocked?: 'ward' | 'immune';
      resisted?: boolean;
      vulnerable?: boolean;
      source: Uid | null;
    }
  | { t: 'heal'; uid: Uid; amount: number; hp: number; maxHp: number }
  | { t: 'status'; uid: Uid; status: StatusId; turns: number; added: boolean }
  | { t: 'float'; uid: Uid; text: string; tone: 'good' | 'bad' | 'info' | 'gold' }
  | { t: 'death'; uid: Uid; killer: Uid | null }
  | { t: 'push'; uid: Uid; from: Pos; to: Pos; fall: number; bump: boolean }
  | { t: 'surface'; tiles: Pos[]; surface: SurfaceType | null }
  | { t: 'height'; tiles: { x: number; y: number; h: number }[] }
  | { t: 'terrain'; tiles: { x: number; y: number; terrain: TerrainType }[] }
  | { t: 'capture'; pos: Pos; kind: NodeKind; owner: PlayerId | null; prev: PlayerId | null }
  | { t: 'nodeUsed'; pos: Pos; kind: NodeKind }
  | { t: 'fx'; kind: string; from?: Pos; to?: Pos; area?: Pos[]; uid?: Uid; color?: string }
  | { t: 'equip'; uid: Uid; id: string }
  | { t: 'stealth'; uid: Uid; hidden: boolean }
  | { t: 'log'; text: string; tone?: 'good' | 'bad' | 'info' | 'crit' | 'fate' }
  | { t: 'banner'; text: string; sub?: string; tone?: 'good' | 'bad' | 'info' | 'boss' }
  | { t: 'eliminated'; player: PlayerId }
  | { t: 'battleEnd'; winner: PlayerId | null; winnerTeam: number | null }
  | { t: 'gold'; player: PlayerId; amount: number }
  | { t: 'refresh' };

export interface RerollRequest {
  player: PlayerId;
  roll: RollEvent;
  fate: number;
}

/** Presentation & input bridge. In headless mode emit resolves immediately. */
export interface BattleIO {
  emit(ev: BattleEvent): Promise<void> | void;
  askReroll(req: RerollRequest): Promise<boolean>;
}
