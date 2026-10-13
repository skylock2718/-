import type { CommanderDef, HeroClass } from '../core/types';
import { B } from './util';

export interface HeroDef extends CommanderDef {
  cls: HeroClass;
  role: string;
  desc: string;
  starterDeck: string[];
  starterRelic: string;
  /** archetype names for the hero select screen */
  styles: { name: string; text: string }[];
  passiveText: { name: string; text: string };
  color: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'hero-paladin',
    cls: 'paladin',
    name: '奥德里克',
    title: '圣骑士',
    role: '前排指挥 · 坚守与圣光',
    desc: '曾是王都的守护骑士，在天命之骰被盗的那一夜，他发誓要把它夺回来。坚不可摧的前排，用盾墙护住部下，用圣光惩戒邪恶。',
    icon: 'black-knight-helm',
    colors: ['#2e2108', '#b8902e', '#fff1c4'],
    color: '#e8c25a',
    stats: { hp: 34, ac: 16, atk: 6, dmg: '1d10+3', range: 1, move: 4, kw: { cleave: 1 }, saves: { fort: 4, ref: 0, will: 3 }, tribe: ['humanoid'], fx: 'slash' },
    abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 15 },
    castAbility: 'cha',
    power: { name: '圣疗', text: '为英雄身边（含自身）一个友方单位回复 6 点生命。', icon: 'healing', cost: 2, target: { kind: 'unit', side: 'ally', range: 1 }, effects: [{ op: 'heal', amount: 6 }], fx: 'heal' },
    passives: ['hero-paladin'],
    passiveText: { name: '守护灵光', text: '英雄身边的友方单位豁免检定 +2。' },
    starterDeck: ['pal-squire', 'pal-squire', 'pal-shieldbearer', 'pal-shieldbearer', 'pal-pikeman', 'pal-crossbow', 'pal-cleric', 'pal-bless', 'pal-smite', 'pal-healword', 'pal-shieldfaith', 'pal-towershield'],
    starterRelic: 'relic-holysymbol',
    styles: [
      { name: '盾墙', text: '嘲讽、坚守、反击、守护光环——让敌人撞碎在你的阵线上。' },
      { name: '圣光审判', text: '惩击、祝福、圣光地面、护盾——对亡灵与邪魔尤其致命。' },
    ],
  },
  {
    id: 'hero-ranger',
    cls: 'ranger',
    name: '希尔瓦',
    title: '游侠',
    role: '高地射手 · 狙击与兽群',
    desc: '翡翠林地的守林人，箭无虚发。她能抬升大地、占据制高点，也能召唤林中的野兽为她而战。',
    icon: 'bow-arrow',
    colors: ['#0c2416', '#3a8a50', '#d9ffc8'],
    color: '#6fd27f',
    stats: { hp: 28, ac: 14, atk: 5, dmg: '1d8+2', range: 3, move: 4, jump: 2, kw: { vantage: 1 }, saves: { fort: 2, ref: 5, will: 2 }, tribe: ['humanoid'], fx: 'arrow' },
    abilities: { str: 10, dex: 17, con: 12, int: 10, wis: 15, cha: 10 },
    castAbility: 'wis',
    power: { name: '猎人印记', text: '标记 6 格内一个敌人 2 回合：你的所有单位攻击它时额外造成 1d6 伤害。', icon: 'crosshair-arrow', cost: 1, target: { kind: 'unit', side: 'enemy', range: 6 }, effects: [{ op: 'status', status: 'marked', turns: 2, value: 1 }], fx: 'mark' },
    passives: ['hero-ranger'],
    passiveText: { name: '鹰眼', text: '英雄具有【高地专精】：站在高处时命中 +1、射程 +1；攀爬 2。' },
    starterDeck: ['rng-scout', 'rng-scout', 'rng-archer', 'rng-archer', 'rng-wolf', 'rng-wolf', 'rng-falcon', 'rng-raise', 'rng-raise', 'rng-pierce', 'rng-entangle', 'rng-boots'],
    starterRelic: 'relic-spyglass',
    styles: [
      { name: '高地狙击', text: '抬升地形、占据高点，用远程单位在居高临下的位置倾泻箭雨。' },
      { name: '兽群', text: '群狼战术、猎鹰与巨熊——用数量与包围撕碎敌人。' },
    ],
  },
  {
    id: 'hero-wizard',
    cls: 'wizard',
    name: '莫温',
    title: '元素法师',
    role: '后排法核 · 焚烬与风暴',
    desc: '星穹学院最年轻的大法师，研究元素之间的反应。油与火、水与雷、冰与水——战场就是她的实验台。',
    icon: 'wizard-staff',
    colors: ['#0e1638', '#4a5ad0', '#cfe8ff'],
    color: '#7f9dff',
    stats: { hp: 24, ac: 12, atk: 4, dmg: '1d6+1', dmgType: 'arcane', range: 2, move: 3, saves: { fort: 1, ref: 2, will: 5 }, tribe: ['humanoid'], fx: 'magic' },
    abilities: { str: 8, dex: 14, con: 12, int: 17, wis: 13, cha: 10 },
    castAbility: 'int',
    power: { name: '火焰箭', text: '对 5 格内一个敌人进行法术攻击，命中造成 1d10 火焰伤害。', icon: 'fire-dash', cost: 1, target: { kind: 'unit', side: 'enemy', range: 5, los: true }, effects: [{ op: 'damage', amount: '1d10', dmgType: 'fire', spellAttack: true, fx: 'firebolt' }] },
    passives: ['hero-wizard'],
    passiveText: { name: '塑能', text: '你的法术永远不会伤害友方单位。' },
    starterDeck: ['wiz-apprentice', 'wiz-apprentice', 'neu-militia', 'neu-militia', 'wiz-ray', 'wiz-frost', 'wiz-frost', 'wiz-missile', 'wiz-grease', 'wiz-bolt', 'wiz-intellect', 'neu-sellsword'],
    starterRelic: 'relic-catalyst',
    styles: [
      { name: '焚烬', text: '油腻术铺路、火球点燃——爆燃连锁一次清场。' },
      { name: '风暴寒霜', text: '闪电导电水面、冰霜冻结湖泊与敌人——控制整片战场。' },
    ],
  },
  {
    id: 'hero-rogue',
    cls: 'rogue',
    name: '洛克',
    title: '命运赌徒',
    role: '骰子操纵 · 赌命与暗影',
    desc: '传说他曾和骰主赌过一局——并且赢了。他相信运气是一种可以被锻炼的肌肉。',
    icon: 'rolling-dices',
    colors: ['#24080f', '#9a2a3e', '#ffd98a'],
    color: '#ff6f7f',
    stats: { hp: 26, ac: 14, atk: 6, dmg: '1d6+3', range: 1, move: 4, kw: { sneak: 2, lucky: 1 }, saves: { fort: 1, ref: 5, will: 2 }, tribe: ['humanoid'], fx: 'slash' },
    abilities: { str: 10, dex: 17, con: 12, int: 13, wis: 10, cha: 16 },
    castAbility: 'cha',
    power: { name: '灌铅骰', text: '获得 1 命运点；本回合你的下一次攻击检定获得优势。', icon: 'dice-twenty-faces-twenty', cost: 1, target: { kind: 'none' }, effects: [{ op: 'fate', n: 1 }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); b.player(ctx.player).flags.nextAttackAdv = 1; } }], fx: 'dice' },
    passives: ['hero-rogue'],
    passiveText: { name: '命运之子', text: '命运点上限 +1；每当你掷出天然 20，抽 1 张牌。英雄具有【偷袭 2d6】与【幸运】。' },
    starterDeck: ['rog-gambler', 'rog-gambler', 'rog-cutpurse', 'rog-cutpurse', 'neu-sellsword', 'rog-assassin', 'rog-allin', 'rog-coin', 'rog-wheel', 'rog-smoke', 'rog-poisonblade', 'rog-rabbit'],
    starterRelic: 'relic-luckycoin',
    styles: [
      { name: '赌命', text: '积攒命运点、扩大暴击范围、孤注一掷——天然 20 就是你的引擎。' },
      { name: '暗影', text: '潜行、偷袭、毒刃——在敌人看不见的地方结束战斗。' },
    ],
  },
  {
    id: 'hero-necro',
    cls: 'necro',
    name: '莫尔萨',
    title: '死灵术士',
    role: '召唤海 · 亡灵与献祭',
    desc: '被学院驱逐的天才。她说死亡只是另一种雇佣关系。',
    icon: 'skull-staff',
    colors: ['#0a1718', '#2f6a64', '#c6fff0'],
    color: '#5fe0c0',
    stats: { hp: 26, ac: 12, atk: 5, dmg: '1d8+1', dmgType: 'necrotic', range: 3, move: 3, saves: { fort: 2, ref: 1, will: 5 }, tribe: ['humanoid'], fx: 'shadow' },
    abilities: { str: 8, dex: 12, con: 14, int: 16, wis: 14, cha: 12 },
    castAbility: 'int',
    power: { name: '亡者复苏', text: '在一处墓地（单位阵亡过的格子）或英雄身边召唤一名【骷髅兵】。', icon: 'raise-skeleton', cost: 2, target: { kind: 'tile', empty: true, grave: true }, effects: [{ op: 'summon', card: 'tok-skeleton', at: 'target' }] },
    passives: ['hero-necro'],
    passiveText: { name: '灵魂收割', text: '每回合首次有友方单位阵亡时，获得 1 点法力。' },
    starterDeck: ['nec-skeleton', 'nec-skeleton', 'nec-skeleton', 'nec-skelarcher', 'nec-skelarcher', 'nec-zombie', 'nec-ghoul', 'nec-drain', 'nec-pact', 'nec-corpseboom', 'nec-fear', 'nec-bonearmor'],
    starterRelic: 'relic-boneflute',
    styles: [
      { name: '亡灵大军', text: '源源不断的骷髅与腐尸，用数量压垮敌人。' },
      { name: '献祭', text: '牺牲部下换取法力、抽牌与爆炸——每一次死亡都是资源。' },
    ],
  },
];

export function heroById(id: string): HeroDef {
  const h = HEROES.find((x) => x.id === id || x.cls === id);
  if (!h) throw new Error(`unknown hero ${id}`);
  return h;
}
