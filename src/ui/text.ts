import { KEYWORD_NAMES } from '../core/battle';
import type { CardDef, Keyword, KeywordMap, Rarity, Tribe, CardType } from '../core/types';

export const KEYWORD_DESC: Record<Keyword, string> = {
  haste: '召唤的回合即可移动和行动。',
  provoke: '相邻的敌人无法移动，且只能攻击嘲讽单位；敌人进入它身边会停下。',
  flying: '移动无视地形与高度，可越过单位；近战不受高度差限制。',
  stealth: '入场时潜行：远处的敌人无法选中它，下一次攻击获得优势。攻击或受伤后现身。',
  lifesteal: '造成伤害时回复等量生命。',
  ward: '抵挡下一次受到的伤害（可叠加层数）。',
  regen: '回合开始时回复 N 点生命。',
  pack: '若目标身边有其他友军，攻击获得优势。',
  sneak: '具有优势或目标身边有友军时，攻击额外造成 Nd6 伤害。',
  cleave: '近战攻击命中时，对身边另一个敌人造成一半伤害。',
  pierce: '攻击命中时，对目标身后的敌人造成一半伤害。',
  reach: '近战攻击距离 2，可以攻击高 2 层的目标。',
  riposte: '受到近战攻击后若存活，立刻反击。',
  sentinel: '敌人离开它身边时，对其进行一次攻击；命中则其停止移动。',
  keen: '暴击范围扩大 N（如 19~20 暴击）。',
  lucky: '掷出天然 1 时重掷一次。',
  charge: '本回合移动 3 格以上后攻击，伤害 +N。',
  fortify: '本回合未移动时 +N AC。',
  push: '攻击命中时将目标击退 N 格，可能撞墙或坠落。',
  frenzy: '生命不高于一半时伤害 +N。',
  vantage: '站在高处时命中额外 +1、射程额外 +1。',
  airdrop: '可以召唤在任何不与敌人相邻的空地上。',
  evasion: '反射豁免成功时完全不受伤害，失败时只受一半。',
  flurry: '每次攻击行动打出两次攻击。',
  auraAC: '相邻友军 +N AC。',
  auraAtk: '相邻友军命中 +N。',
  thorns: '近战攻击它的敌人受到 N 点伤害。',
  unstoppable: '免疫眩晕、冻结、定身、倒地与击退。',
  swim: '在水中移动消耗 1，可以进入深水。',
  venom: '命中使目标中毒 N 回合。',
  ignite: '命中使目标燃烧 N 回合。',
  chill: '命中使目标迟缓 N 回合。',
  blast: '攻击命中时，目标身边的其他敌人受到一半伤害。',
  spellward: '对法术的豁免检定具有优势。',
  immobile: '无法移动。',
  shield: '受到的物理伤害 -N。',
  scout: '无视森林、浅水、油脂带来的额外移动消耗。',
  climb: '攀爬 +N：一步可以爬上更高的悬崖。',
  pierceArmor: '攻击无视 N 点 AC。',
  bloodthirst: '攻击受伤目标时命中 +N。',
  inspire: '相邻友军伤害 +N。',
};

/** keywords whose value is meaningful to show */
const VALUED: Set<Keyword> = new Set(['ward', 'regen', 'sneak', 'keen', 'charge', 'fortify', 'push', 'frenzy', 'auraAC', 'auraAtk', 'thorns', 'venom', 'ignite', 'chill', 'shield', 'climb', 'pierceArmor', 'bloodthirst', 'inspire']);

export function keywordLabel(k: Keyword, v: number): string {
  const n = KEYWORD_NAMES[k];
  if (k === 'sneak') return `${n} ${v}d6`;
  if (VALUED.has(k) && v > 0 && !(k === 'ward' && v === 1) && !(k === 'keen' && v === 1)) return `${n} ${v}`;
  return n;
}

export function keywordList(kw: KeywordMap | undefined): { k: Keyword; label: string }[] {
  if (!kw) return [];
  return (Object.entries(kw) as [Keyword, number][]).filter(([, v]) => v).map(([k, v]) => ({ k, label: keywordLabel(k, v) }));
}

export const TRIBE_NAMES: Record<Tribe, string> = {
  humanoid: '人形',
  beast: '野兽',
  undead: '亡灵',
  construct: '构装',
  elemental: '元素',
  fey: '精类',
  dragon: '龙',
  fiend: '邪魔',
  celestial: '天界',
  goblinoid: '哥布林',
  giant: '巨人',
  aberration: '异怪',
};

export const TYPE_NAMES: Record<CardType, string> = { unit: '人物', spell: '法术', equip: '装备', terrain: '地形', curse: '诅咒' };
export const RARITY_NAMES: Record<Rarity, string> = { basic: '基础', common: '普通', rare: '稀有', epic: '史诗', legendary: '传说', token: '衍生', curse: '诅咒' };
export const POOL_NAMES: Record<string, string> = { paladin: '圣骑士', ranger: '游侠', wizard: '元素法师', rogue: '命运赌徒', necro: '死灵术士', neutral: '中立', enemy: '敌方', curse: '诅咒', token: '衍生' };

export function typeLine(c: CardDef): string {
  if (c.type === 'unit') {
    const tr = (c.unit?.tribe ?? []).map((t) => TRIBE_NAMES[t]).join('·');
    return tr ? `人物 · ${tr}` : '人物';
  }
  return TYPE_NAMES[c.type];
}

export function cardText(c: CardDef): string {
  let t = c.text ?? '';
  if (c.params) for (const [k, v] of Object.entries(c.params)) t = t.split(`{${k}}`).join(String(v));
  return t;
}

/** split text into plain and 【keyword】 parts */
export function richParts(t: string): { text: string; kw: boolean }[] {
  const out: { text: string; kw: boolean }[] = [];
  const re = /【([^】]+)】/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push({ text: t.slice(last, m.index), kw: false });
    out.push({ text: m[1], kw: true });
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push({ text: t.slice(last), kw: false });
  return out;
}

const NAME_TO_KW = new Map<string, Keyword>(Object.entries(KEYWORD_NAMES).map(([k, n]) => [n, k as Keyword]));
export function keywordByName(name: string): Keyword | undefined {
  return NAME_TO_KW.get(name.replace(/\s.*$/, ''));
}
