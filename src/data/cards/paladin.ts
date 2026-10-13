import type { CardDef } from '../../core/types';
import { B, equip, spell, T, tgtUnit, unit } from '../util';

const P = 'paladin' as const;

export const PALADIN_CARDS: CardDef[] = [
  // ------------------------------------------------------------- units
  unit(
    { id: 'pal-squire', name: '侍从', cost: 1, rarity: 'basic', pool: P, icon: 'light-helm', tags: ['shield'], flavor: '擦亮盔甲，是骑士之路的第一步。', up: { unit: { hp: 8, ac: 13, atk: 3, dmg: '1d6', range: 1, move: 3, kw: { fortify: 2 } } } },
    { hp: 6, ac: 12, atk: 3, dmg: '1d6', range: 1, move: 3, kw: { fortify: 1 }, tribe: ['humanoid'], saves: { fort: 2, ref: 0, will: 1 }, fx: 'slash' },
  ),
  unit(
    { id: 'pal-shieldbearer', name: '持盾卫士', cost: 2, rarity: 'basic', pool: P, icon: 'checked-shield', tags: ['shield'], flavor: '「越过我，才能碰到他。」', up: { unit: { hp: 13, ac: 14, atk: 3, dmg: '1d6+1', range: 1, move: 3, kw: { provoke: 1, shield: 1 } } } },
    { hp: 10, ac: 14, atk: 3, dmg: '1d6+1', range: 1, move: 3, kw: { provoke: 1 }, tribe: ['humanoid'], saves: { fort: 3, ref: 0, will: 1 }, fx: 'smash' },
  ),
  unit(
    { id: 'pal-pikeman', name: '长枪兵', cost: 2, rarity: 'basic', pool: P, icon: 'spears', tags: ['shield'], up: { unit: { hp: 9, ac: 13, atk: 5, dmg: '1d8+2', range: 1, move: 3, kw: { reach: 1, sentinel: 1 } } } },
    { hp: 8, ac: 13, atk: 4, dmg: '1d8+1', range: 1, move: 3, kw: { reach: 1 }, tribe: ['humanoid'], saves: { fort: 2, ref: 1, will: 0 }, fx: 'pierce' },
  ),
  unit(
    { id: 'pal-crossbow', name: '十字弩手', cost: 3, rarity: 'basic', pool: P, icon: 'crossbow', up: { unit: { hp: 10, ac: 12, atk: 5, dmg: '1d8+2', range: 4, move: 3 } } },
    { hp: 9, ac: 12, atk: 4, dmg: '1d8+2', range: 3, move: 3, tribe: ['humanoid'], fx: 'bolt' },
  ),
  unit(
    {
      id: 'pal-cleric',
      name: '战地牧师',
      cost: 3,
      rarity: 'basic',
      pool: P,
      icon: 'sun-priest',
      colors: 'holy',
      tags: ['radiant', 'heal'],
      text: '技能【治愈之言】：为 3 格内一个友方单位回复 1d8+2。',
      up: { text: '技能【治愈之言】：为 3 格内一个友方单位回复 2d6+2。', unit: { hp: 11, ac: 13, atk: 3, dmg: '1d6', dmgType: 'radiant', range: 1, move: 3, ability: { name: '治愈之言', text: '回复 2d6+2', icon: 'healing', target: { kind: 'unit', side: 'ally', range: 3, damaged: true }, effects: [{ op: 'heal', amount: '2d6+2' }], kind: 'heal' } } },
    },
    {
      hp: 10,
      ac: 13,
      atk: 3,
      dmg: '1d6',
      dmgType: 'radiant',
      range: 1,
      move: 3,
      tribe: ['humanoid'],
      saves: { fort: 1, ref: 0, will: 4 },
      fx: 'holy',
      ability: { name: '治愈之言', text: '回复 1d8+2', icon: 'healing', target: { kind: 'unit', side: 'ally', range: 3, damaged: true }, effects: [{ op: 'heal', amount: '1d8+2' }], kind: 'heal' },
    },
  ),
  unit(
    { id: 'pal-oathknight', name: '誓约骑士', cost: 4, rarity: 'common', pool: P, icon: 'black-knight-helm', tags: ['shield'], flavor: '以剑为誓，以血为证。', up: { unit: { hp: 21, ac: 16, atk: 6, dmg: '1d10+3', range: 1, move: 3, kw: { riposte: 1 } } } },
    { hp: 18, ac: 16, atk: 5, dmg: '1d10+3', range: 1, move: 3, kw: { riposte: 1 }, tribe: ['humanoid'], saves: { fort: 3, ref: 0, will: 2 }, fx: 'slash' },
  ),
  unit(
    { id: 'pal-griffin', name: '狮鹫骑士', cost: 5, rarity: 'rare', pool: P, icon: 'griffin-symbol', flavor: '天空就是他们的骑枪冲刺道。', up: { unit: { hp: 18, ac: 14, atk: 6, dmg: '1d10+3', range: 1, move: 5, kw: { flying: 1, charge: 4 } } } },
    { hp: 16, ac: 14, atk: 5, dmg: '1d10+3', range: 1, move: 5, kw: { flying: 1, charge: 3 }, tribe: ['humanoid', 'beast'], saves: { fort: 2, ref: 2, will: 1 }, fx: 'pierce' },
  ),
  unit(
    { id: 'pal-guardian', name: '圣殿守卫', cost: 6, rarity: 'epic', pool: P, icon: 'crenulated-shield', tags: ['shield'], text: '相邻友军 +1 AC。', flavor: '神殿的大门从未失守，因为他就是门。', up: { unit: { hp: 30, ac: 17, atk: 5, dmg: '2d6+3', range: 1, move: 2, kw: { provoke: 1, auraAC: 2, shield: 2 } }, text: '相邻友军 +2 AC。' } },
    { hp: 26, ac: 17, atk: 5, dmg: '2d6+3', range: 1, move: 2, kw: { provoke: 1, auraAC: 1, shield: 2 }, tribe: ['humanoid'], saves: { fort: 5, ref: 0, will: 3 }, fx: 'smash', scale: 1.1 },
  ),
  unit(
    {
      id: 'pal-seraph',
      name: '光耀炽天使',
      cost: 8,
      rarity: 'legendary',
      pool: P,
      icon: 'angel-wings',
      colors: 'holy',
      tags: ['radiant', 'heal'],
      text: '登场：为所有友方单位回复 5 点生命。',
      flavor: '她的翅膀展开时，夜晚便退却了。',
      up: { unit: { hp: 32, ac: 17, atk: 8, dmg: '2d8+4', dmgType: 'radiant', range: 1, move: 4, kw: { flying: 1, ward: 1 }, tribe: ['celestial'], triggers: [{ on: 'summon', label: '天恩', effects: [{ op: 'heal', amount: 7, to: 'allAllies' }] }], fx: 'holy', scale: 1.25 }, text: '登场：为所有友方单位回复 7 点生命。' },
    },
    {
      hp: 28,
      ac: 16,
      atk: 7,
      dmg: '2d8+4',
      dmgType: 'radiant',
      range: 1,
      move: 4,
      kw: { flying: 1, ward: 1 },
      tribe: ['celestial'],
      saves: { fort: 4, ref: 3, will: 6 },
      triggers: [{ on: 'summon', label: '天恩', effects: [{ op: 'heal', amount: 5, to: 'allAllies' }] }],
      fx: 'holy',
      scale: 1.25,
    },
  ),
  unit(
    { id: 'pal-warhorse', name: '圣誓战马', cost: 3, rarity: 'common', pool: P, icon: 'horse-head', text: '冲锋时践踏目标：攻击后击退 1 格。', up: { unit: { hp: 13, ac: 13, atk: 5, dmg: '1d8+2', range: 1, move: 6, kw: { charge: 3, push: 1 } } } },
    { hp: 11, ac: 13, atk: 4, dmg: '1d8+2', range: 1, move: 6, kw: { charge: 2, push: 1 }, tribe: ['beast'], fx: 'smash' },
  ),
  // ------------------------------------------------------------- spells
  spell(
    { id: 'pal-bless', name: '祝福术', cost: 1, rarity: 'basic', pool: P, icon: 'prayer', colors: 'holy', tags: ['radiant'], text: '英雄 4 格内 3×3 区域的友方单位获得【祝福】{turns} 回合（攻击与豁免 +1d4）。', params: { turns: 2 }, up: { params: { turns: 3 } } },
    T.tile(4, 1),
    [{ op: 'fx', kind: 'holy' }, { op: 'status', status: 'blessed', turns: '$turns', to: 'targetAllies' }],
  ),
  spell(
    {
      id: 'pal-smite',
      name: '神圣惩击',
      cost: 2,
      rarity: 'basic',
      pool: P,
      icon: 'sun-spear',
      colors: 'holy',
      tags: ['radiant'],
      text: '对英雄相邻的一个敌人造成 {dmg} 光耀伤害；若目标为亡灵或邪魔，额外 +1d8。',
      params: { dmg: '2d8' },
      up: { params: { dmg: '3d8' } },
    },
    { kind: 'unit', side: 'enemy', range: 1 },
    [
      { op: 'fx', kind: 'smite' },
      { op: 'damage', amount: '$dmg', dmgType: 'radiant' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const t = tgtUnit(ctx);
          const b = B(ctx);
          if (t && (t.tribe.includes('undead') || t.tribe.includes('fiend'))) await b.damage(t, b.rollNumber('1d8'), 'radiant', b.hero(ctx.player), { label: '惩恶' });
        },
      },
    ],
  ),
  spell(
    { id: 'pal-shieldfaith', name: '虔诚护盾', cost: 1, rarity: 'basic', pool: P, icon: 'heart-shield', colors: 'holy', tags: ['shield'], text: '一个友方单位获得【庇护】：+{ac} AC，持续 2 回合。', params: { ac: 2 }, up: { params: { ac: 3 }, text: '一个友方单位获得【庇护】：+3 AC，持续 2 回合，并抽 1 张牌。', effects: [{ op: 'fx', kind: 'shield' }, { op: 'status', status: 'shielded', turns: 2, value: 3 }, { op: 'draw', n: 1 }] } },
    T.ally(),
    [{ op: 'fx', kind: 'shield' }, { op: 'status', status: 'shielded', turns: 2, value: 2 }],
  ),
  spell(
    { id: 'pal-healword', name: '治疗之言', cost: 1, rarity: 'basic', pool: P, icon: 'healing', colors: 'holy', tags: ['heal'], text: '为任意一个友方单位回复 {heal} 点生命。', params: { heal: '1d8+3' }, up: { params: { heal: '2d8+3' } } },
    T.ally(),
    [{ op: 'heal', amount: '$heal' }],
  ),
  spell(
    { id: 'pal-charge', name: '号令冲锋', cost: 2, rarity: 'common', pool: P, icon: 'knight-banner', tags: ['shield'], text: '所有友方单位本回合【加速】（+2 移动）并【激昂】（伤害 +2）。', up: { cost: 1 } },
    T.none,
    [
      { op: 'fx', kind: 'rally' },
      { op: 'status', status: 'hasted', turns: 1, to: 'allAllies' },
      { op: 'status', status: 'inspired', turns: 1, value: 2, to: 'allAllies' },
    ],
  ),
  spell(
    { id: 'pal-judgement', name: '圣光审判', cost: 4, rarity: 'rare', pool: P, icon: 'sunbeams', colors: 'holy', tags: ['radiant'], text: '英雄 5 格内 3×3 区域：敌人受到 {dmg} 光耀伤害（意志豁免减半），并留下【圣光地面】2 回合。', params: { dmg: '3d6' }, up: { params: { dmg: '4d6' } } },
    T.tile(5, 1, true),
    [{ op: 'fx', kind: 'judgement' }, { op: 'damage', amount: '$dmg', dmgType: 'radiant', to: 'targetEnemies', save: { type: 'will', half: true } }, { op: 'surface', surface: 'holy', turns: 2 }],
  ),
  spell(
    { id: 'pal-sanctuary', name: '圣域', cost: 2, rarity: 'common', pool: P, icon: 'holy-symbol', colors: 'holy', tags: ['radiant', 'shield'], text: '一个友方单位获得 1 层【护盾】并清除所有负面状态。', up: { cost: 1 } },
    T.ally(),
    [{ op: 'fx', kind: 'shield' }, { op: 'cleanse' }, { op: 'keyword', kw: 'ward', value: 1 }],
  ),
  spell(
    { id: 'pal-massheal', name: '群体治疗', cost: 4, rarity: 'rare', pool: P, icon: 'healing-shield', colors: 'holy', tags: ['heal'], text: '所有友方单位回复 {heal} 点生命并清除负面状态。', params: { heal: '2d4+2' }, up: { params: { heal: '3d4+3' } } },
    T.none,
    [{ op: 'fx', kind: 'holyNova' }, { op: 'heal', amount: '$heal', to: 'allAllies' }, { op: 'cleanse', to: 'allAllies' }],
  ),
  spell(
    { id: 'pal-celestial', name: '天界号角', cost: 4, rarity: 'rare', pool: P, icon: 'hunting-horn', colors: 'holy', tags: ['radiant'], text: '在英雄身边召唤 2 名【光之卫士】。', up: { text: '在英雄身边召唤 3 名【光之卫士】。', effects: [{ op: 'summon', card: 'tok-lightguard', count: 3, at: 'nearHero' }] } },
    T.none,
    [{ op: 'summon', card: 'tok-lightguard', count: 2, at: 'nearHero' }],
  ),
  spell(
    { id: 'pal-unbreakable', name: '不屈意志', cost: 1, rarity: 'common', pool: P, icon: 'mailed-fist', tags: ['shield'], text: '一个友方单位获得【不屈】与【坚守 2】，直到你的下回合。', up: { cost: 0 } },
    T.ally(),
    [{ op: 'fx', kind: 'shield' }, { op: 'keyword', kw: 'unstoppable', value: 1, turns: 2 }, { op: 'keyword', kw: 'fortify', value: 2, turns: 2 }],
  ),
  // ------------------------------------------------------------- equipment
  equip(
    { id: 'pal-lightsword', name: '光辉之剑', cost: 2, rarity: 'common', pool: P, icon: 'shining-sword', colors: 'holy', tags: ['radiant'], text: '+1 命中，攻击额外造成 1d4 伤害，伤害类型变为光耀。', up: { text: '+2 命中，攻击额外造成 1d6 伤害，伤害类型变为光耀。', equip: { atk: 2, dmg: '1d6', dmgType: 'radiant' } } },
    { atk: 1, dmg: '1d4', dmgType: 'radiant' },
  ),
  equip(
    { id: 'pal-towershield', name: '塔盾', cost: 1, rarity: 'basic', pool: P, icon: 'bordered-shield', tags: ['shield'], text: '+{ac} AC，-1 移动。', up: { text: '+3 AC，-1 移动。', equip: { ac: 3, move: -1 } } },
    { ac: 2, move: -1 },
  ),
  equip(
    { id: 'pal-banner', name: '圣骑战旗', cost: 3, rarity: 'rare', pool: P, icon: 'tattered-banner', tags: ['shield'], text: '装备者获得【守护光环 1】与【战意光环 1】（相邻友军 +1 AC、+1 命中）。', up: { cost: 2 } },
    { kw: { auraAC: 1, auraAtk: 1 } },
  ),
  equip(
    { id: 'pal-oathhammer', name: '誓约战锤', cost: 3, rarity: 'rare', pool: P, icon: 'thor-hammer', text: '伤害 +2，攻击【击退】1 格。', up: { text: '伤害 +3，攻击【击退】2 格。', equip: { dmg: 3, kw: { push: 2 } } } },
    { dmg: 2, kw: { push: 1 } },
  ),
  equip(
    { id: 'pal-aegis', name: '神佑之盾', cost: 4, rarity: 'epic', pool: P, icon: 'griffin-shield', colors: 'holy', tags: ['shield'], text: '+2 AC，+6 生命，获得【反击】与 1 层【护盾】。', up: { cost: 3 } },
    { ac: 2, hp: 6, kw: { riposte: 1, ward: 1 } },
  ),
];
