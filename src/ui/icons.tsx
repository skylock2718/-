import { ICONS } from '../assets/icons.generated';
import type { Keyword, NodeKind, StatusId, SurfaceType, TerrainType, DamageType } from '../core/types';

/** identity helper so scripts/gen-icons.mjs can find icon names used in UI code */
export function ic(name: string): string {
  return name;
}

export function Icon(props: { name: string; size?: number | string; color?: string; class?: string; style?: Record<string, string | number> }) {
  const d = ICONS[props.name];
  const size = props.size ?? '1em';
  return (
    <svg class={`gi ${props.class ?? ''}`} viewBox="0 0 512 512" width={size} height={size} style={props.style} aria-hidden="true">
      {d ? <path d={d} fill={props.color ?? 'currentColor'} /> : <circle cx="256" cy="256" r="200" fill={props.color ?? 'currentColor'} />}
    </svg>
  );
}

export function iconSvg(name: string, size = 16, color = 'currentColor'): string {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="gi" viewBox="0 0 512 512" width="${size}" height="${size}"><path d="${d}" fill="${color}"/></svg>`;
}

export const STATUS_ICON: Record<StatusId, string> = {
  burning: ic('flame'),
  poisoned: ic('poison-bottle'),
  stunned: ic('knocked-out-stars'),
  frozen: ic('frozen-orb'),
  rooted: ic('curling-vines'),
  prone: ic('falling'),
  frightened: ic('screaming'),
  blessed: ic('prayer'),
  baned: ic('cursed-star'),
  hasted: ic('run'),
  slowed: ic('snail'),
  marked: ic('crosshair-arrow'),
  regen: ic('health-increase'),
  inspired: ic('trumpet-flag'),
  stoneskin: ic('stone-sphere'),
  weakened: ic('broken-shield'),
  vulnerable: ic('cracked-shield'),
  shielded: ic('heart-shield'),
  hidden: ic('hood'),
  doomed: ic('death-skull'),
  charmed: ic('heart-key'),
};

export const STATUS_COLOR: Record<StatusId, string> = {
  burning: '#ff8a2a',
  poisoned: '#8aff3a',
  stunned: '#ffe36a',
  frozen: '#9ae8ff',
  rooted: '#6ad04a',
  prone: '#c8a878',
  frightened: '#c08aff',
  blessed: '#ffe9a0',
  baned: '#b04aff',
  hasted: '#7affd0',
  slowed: '#7aa8ff',
  marked: '#ff4d5e',
  regen: '#7affa0',
  inspired: '#ffb04a',
  stoneskin: '#c8b898',
  weakened: '#a0a0a0',
  vulnerable: '#ff6a6a',
  shielded: '#9ad0ff',
  hidden: '#9a9aff',
  doomed: '#ff2a2a',
  charmed: '#ff7ab0',
};

export const STATUS_DESC: Record<StatusId, string> = {
  burning: '回合开始时受到 1d4 火焰伤害。',
  poisoned: '攻击检定劣势；回合开始时受到 1d4 毒素伤害。',
  stunned: '无法移动和行动；对它的攻击具有优势；反射豁免大幅降低。',
  frozen: '无法移动和行动；对它的攻击具有优势；受到火焰伤害时解冻。',
  rooted: '无法移动；攻击劣势；对它的攻击具有优势。',
  prone: '近战攻击它有优势、远程攻击它有劣势；下回合起身消耗 2 移动。',
  frightened: '攻击检定劣势，意志豁免劣势。',
  blessed: '攻击检定与豁免 +1d4。',
  baned: '攻击检定与豁免 -1d4。',
  hasted: '+2 移动。',
  slowed: '-2 移动，-1 AC。',
  marked: '被猎人印记标记：施加者的单位攻击它额外造成伤害。',
  regen: '回合开始时回复生命。',
  inspired: '攻击伤害提高。',
  stoneskin: '物理伤害减半。',
  weakened: '攻击伤害 -2。',
  vulnerable: '受到的伤害 +50%。',
  shielded: 'AC 提高。',
  hidden: '潜行：远处的敌人无法选中它；下一次攻击具有优势。攻击或受伤后现身。',
  doomed: '厄运倒计时结束时受到 3d6 暗蚀伤害。',
  charmed: '被魅惑。',
};

export const KEYWORD_ICON: Partial<Record<Keyword, string>> = {
  haste: ic('fast-arrow'),
  provoke: ic('shouting'),
  flying: ic('feathered-wing'),
  stealth: ic('hood'),
  lifesteal: ic('fangs'),
  ward: ic('magic-shield'),
  regen: ic('health-increase'),
  pack: ic('paw-print'),
  sneak: ic('backstab'),
  cleave: ic('sword-spin'),
  reach: ic('spears'),
  riposte: ic('crossed-swords'),
  sentinel: ic('guards'),
  keen: ic('dice-twenty-faces-twenty'),
  lucky: ic('clover'),
  charge: ic('horse-head'),
  fortify: ic('crenulated-shield'),
  push: ic('push'),
  frenzy: ic('barbarian'),
  vantage: ic('mountaintop'),
};

export const NODE_ICON: Record<NodeKind, string> = {
  well: ic('crystal-growth'),
  shrine: ic('dice-twenty-faces-twenty'),
  gate: ic('pentagram-rose'),
  spring: ic('drink-me'),
  chest: ic('locked-chest'),
  altar: ic('star-altar'),
  rune: ic('rune-stone'),
  gold: ic('coins-pile'),
};

export const NODE_NAME: Record<NodeKind, string> = {
  well: '法力泉',
  shrine: '命运神龛',
  gate: '召唤法阵',
  spring: '治愈泉',
  chest: '宝箱',
  altar: '古老祭坛',
  rune: '符文石',
  gold: '金币堆',
};

export const NODE_DESC: Record<NodeKind, string> = {
  well: '控制方回合开始时 +1 法力。单位停在上面即可占领。',
  shrine: '控制方回合开始时 +1 命运点。单位停在上面即可占领。',
  gate: '控制方可以在它周围召唤单位。单位停在上面即可占领。',
  spring: '回合开始时站在上面的单位回复 3 生命。',
  chest: '事件：首个踏上的单位进行【敏捷 DC 12】检定。成功抽 2 张牌，失败受到陷阱伤害并抽 1 张。',
  altar: '事件：【感知 DC 13】检定。成功获得祝福并回复，失败受到灾祸。',
  rune: '事件：【智力 DC 14】检定。成功获得 1 命运点与 1 法力。',
  gold: '拾取获得远征金币。',
};

export const TERRAIN_NAME: Record<TerrainType, string> = {
  plain: '平地',
  forest: '森林',
  water: '浅水',
  deep: '深水',
  rock: '岩柱',
  lava: '熔岩',
  ruins: '废墟',
};

export const TERRAIN_DESC: Record<TerrainType, string> = {
  plain: '普通地形。',
  forest: '移动消耗 2；站在其中对远程攻击 +2 AC（掩体）。',
  water: '移动消耗 2；受到闪电伤害时相连水域一起感电；冰霜可将其冻结。',
  deep: '不可通行（飞行与水栖单位除外）。',
  rock: '不可通行，遮挡视线。',
  lava: '进入或回合开始时受到 2d6 火焰伤害。',
  ruins: '不可通行，遮挡视线。',
};

export const SURFACE_NAME: Record<SurfaceType, string> = { fire: '火焰地面', oil: '油脂', ice: '冰面', poison: '毒雾', holy: '圣光地面' };
export const SURFACE_DESC: Record<SurfaceType, string> = {
  fire: '回合开始或停留时受 1d4 火焰伤害并燃烧。会引爆油脂和毒雾。',
  oil: '移动消耗 +1。遇火爆燃（2d6 火焰）。',
  ice: '停在上面需反射 DC 10，失败倒地。火焰会融化冰面。',
  poison: '回合开始时受到 1d4 毒素伤害并中毒。遇火爆燃。',
  holy: '施放者的友军回合开始回复 2；亡灵与邪魔受伤。',
};

export const DMG_COLOR: Record<DamageType, string> = {
  physical: '#ffffff',
  fire: '#ff8a2a',
  cold: '#9ae8ff',
  lightning: '#c8d8ff',
  poison: '#8aff3a',
  radiant: '#ffe9a0',
  necrotic: '#b08aff',
  arcane: '#e08aff',
  psychic: '#ff7ae0',
};

export const UI_ICONS = {
  mana: ic('crystal-growth'),
  fate: ic('dice-twenty-faces-twenty'),
  deck: ic('card-pickup'),
  discard: ic('card-discard'),
  hp: ic('hearts'),
  ac: ic('shield'),
  atk: ic('crossed-swords'),
  move: ic('boot-prints'),
  range: ic('high-shot'),
  gold: ic('two-coins'),
  replace: ic('card-exchange'),
  endTurn: ic('hourglass'),
  settings: ic('cog'),
  map: ic('treasure-map'),
  potion: ic('round-potion'),
  relic: ic('gem-pendant'),
  log: ic('scroll-unfurled'),
  rotateL: ic('anticlockwise-rotation'),
  rotateR: ic('clockwise-rotation'),
  threat: ic('all-seeing-eye'),
  skull: ic('skull-crossed-bones'),
  sword: ic('broadsword'),
  boss: ic('crowned-skull'),
  elite: ic('horned-skull'),
  event: ic('perspective-dice-six-faces-random'),
  shop: ic('shop'),
  rest: ic('campfire'),
  treasure: ic('open-treasure-chest'),
  battle: ic('crossed-swords'),
  question: ic('uncertainty'),
  book: ic('spell-book'),
  check: ic('check-mark'),
  close: ic('cancel'),
  heal: ic('healing'),
  upgrade: ic('upgrade'),
  remove: ic('trash-can'),
  lock: ic('padlock'),
  star: ic('star-formation'),
  crown: ic('crown'),
  dice: ic('rolling-dices'),
  flee: ic('exit-door'),
  info: ic('info'),
  play: ic('play-button'),
  music: ic('musical-notes'),
  sound: ic('speaker'),
  mute: ic('speaker-off'),
};
