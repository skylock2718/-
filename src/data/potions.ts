import type { PotionDef } from '../core/registry';
import { B, tgtUnit } from './util';

export const POTIONS: PotionDef[] = [
  { id: 'pot-heal', name: '治疗药水', text: '一个友方单位回复 2d4+4 生命。', icon: 'health-potion', color: '#ff4d6d', rarity: 'common', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'heal', amount: '2d4+4' }], price: 45 },
  { id: 'pot-greater', name: '强效治疗药水', text: '一个友方单位回复 4d4+6 生命并清除负面状态。', icon: 'round-potion', color: '#ff2a55', rarity: 'uncommon', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'heal', amount: '4d4+6' }, { op: 'cleanse' }], price: 70 },
  {
    id: 'pot-fire',
    name: '炼金之火',
    text: '投掷到 4 格内：目标格单位受到 2d6 火焰伤害并燃烧 2 回合，地面起火。',
    icon: 'fire-bottle',
    color: '#ff8a1f',
    rarity: 'common',
    target: { kind: 'tile', range: 4, radius: 0 },
    effects: [{ op: 'fx', kind: 'fireball' }, { op: 'damage', amount: '2d6', dmgType: 'fire' }, { op: 'status', status: 'burning', turns: 2 }, { op: 'surface', surface: 'fire', turns: 2 }],
    price: 45,
  },
  {
    id: 'pot-explosive',
    name: '爆裂药瓶',
    text: '投掷到 4 格内 3×3 区域：3d6 火焰伤害（反射 DC 14 减半）。',
    icon: 'bubbling-flask',
    color: '#ffb000',
    rarity: 'uncommon',
    target: { kind: 'tile', range: 4, radius: 1 },
    effects: [{ op: 'fx', kind: 'fireball' }, { op: 'damage', amount: '3d6', dmgType: 'fire', save: { type: 'ref', dc: 14, half: true } }],
    price: 65,
  },
  {
    id: 'pot-frost',
    name: '寒霜药瓶',
    text: '投掷到 4 格内 3×3 区域：2d6 冰霜伤害并迟缓，地面结冰。',
    icon: 'ice-bomb',
    color: '#7fe3ff',
    rarity: 'common',
    target: { kind: 'tile', range: 4, radius: 1 },
    effects: [{ op: 'fx', kind: 'icestorm' }, { op: 'damage', amount: '2d6', dmgType: 'cold', to: 'targetEnemies' }, { op: 'status', status: 'slowed', turns: 1, to: 'targetEnemies' }, { op: 'surface', surface: 'ice', turns: 2 }],
    price: 45,
  },
  { id: 'pot-speed', name: '速度药水', text: '一个友方单位【加速】2 回合（+2 移动，立即生效）。', icon: 'standing-potion', color: '#ffe04d', rarity: 'common', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'fx', kind: 'rally' }, { op: 'status', status: 'hasted', turns: 2 }], price: 40 },
  { id: 'pot-strength', name: '巨力药水', text: '一个友方单位 2 回合内命中 +2、伤害 +3。', icon: 'potion-ball', color: '#ff6a00', rarity: 'common', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'buff', stat: 'atk', amount: 2, turns: 2 }, { op: 'status', status: 'inspired', turns: 2, value: 3 }], price: 45 },
  { id: 'pot-invis', name: '隐形药水', text: '一个友方单位进入【潜行】。', icon: 'bottled-shadow', color: '#9a7aff', rarity: 'uncommon', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'fx', kind: 'smoke' }, { op: 'keyword', kw: 'stealth', value: 1 }], price: 55 },
  { id: 'pot-luck', name: '幸运药剂', text: '获得 2 命运点。', icon: 'magic-potion', color: '#5dff9a', rarity: 'common', target: { kind: 'none' }, effects: [{ op: 'fx', kind: 'coin' }, { op: 'fate', n: 2 }], price: 45 },
  { id: 'pot-mana', name: '法力药水', text: '获得 3 点法力。', icon: 'round-bottom-flask', color: '#4da6ff', rarity: 'common', target: { kind: 'none' }, effects: [{ op: 'fx', kind: 'arcaneSelf' }, { op: 'mana', n: 3 }], price: 50 },
  { id: 'pot-stone', name: '石肤药水', text: '一个友方单位获得【石肤】3 回合（物理伤害减半）。', icon: 'stone-sphere', color: '#b0a080', rarity: 'uncommon', target: { kind: 'unit', side: 'ally' }, effects: [{ op: 'fx', kind: 'shield' }, { op: 'status', status: 'stoneskin', turns: 3 }], price: 55 },
  { id: 'pot-elixir', name: '灵感药剂', text: '抽 3 张牌。', icon: 'potion-of-madness', color: '#ff7ae0', rarity: 'uncommon', target: { kind: 'none' }, effects: [{ op: 'draw', n: 3 }], price: 60 },
  {
    id: 'pot-giant',
    name: '巨人化药剂',
    text: '一个友方单位本场战斗最大生命 +8、命中 +1，并回复 8 生命。',
    icon: 'fizzing-flask',
    color: '#c0ff4d',
    rarity: 'uncommon',
    target: { kind: 'unit', side: 'ally' },
    effects: [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (!t) return;
          await b.buff(t, 'maxHp', 8);
          await b.buff(t, 'atk', 1);
        },
      },
    ],
    price: 65,
  },
];
