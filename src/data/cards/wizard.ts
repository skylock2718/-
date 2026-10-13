import type { CardDef } from '../../core/types';
import { B, equip, spell, T, tgtUnit, terrain, unit } from '../util';

const W = 'wizard' as const;

export const WIZARD_CARDS: CardDef[] = [
  // ------------------------------------------------------------- fire
  spell(
    { id: 'wiz-ray', name: '灼热射线', cost: 2, rarity: 'basic', pool: W, icon: 'fire-ray', colors: 'fire', tags: ['fire'], text: '对 5 格内一个敌人射出 3 道射线，每道进行法术攻击，命中造成 {dmg} 火焰伤害。', params: { dmg: '1d6' }, up: { params: { dmg: '1d6+1' } } },
    T.enemy(5),
    [
      { op: 'damage', amount: '$dmg', dmgType: 'fire', spellAttack: true, fx: 'firebolt' },
      { op: 'damage', amount: '$dmg', dmgType: 'fire', spellAttack: true, fx: 'firebolt' },
      { op: 'damage', amount: '$dmg', dmgType: 'fire', spellAttack: true, fx: 'firebolt' },
    ],
  ),
  spell(
    { id: 'wiz-fireball', name: '火球术', cost: 4, rarity: 'common', pool: W, icon: 'fire-bomb', colors: 'fire', tags: ['fire'], text: '6 格内 3×3 区域：所有单位受到 {dmg} 火焰伤害（反射豁免减半），并燃起【火焰地面】2 回合。小心友军！', flavor: '「我数到三……算了，直接扔吧。」', params: { dmg: '4d6' }, up: { params: { dmg: '5d6' } } },
    T.tile(6, 1, true),
    [{ op: 'fx', kind: 'fireball' }, { op: 'damage', amount: '$dmg', dmgType: 'fire', save: { type: 'ref', half: true } }, { op: 'surface', surface: 'fire', turns: 2 }],
  ),
  terrain(
    { id: 'wiz-grease', name: '油腻术', cost: 1, rarity: 'basic', pool: W, icon: 'oil-drum', colors: 'earth', tags: ['fire'], text: '5 格内 3×3 区域铺满【油脂】3 回合；其中的敌人反射豁免失败则【倒地】。遇火即爆燃！', up: { cost: 0 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'grease' }, { op: 'surface', surface: 'oil', turns: 3 }, { op: 'status', status: 'prone', turns: 1, to: 'targetEnemies', save: { type: 'ref' } }],
  ),
  spell(
    { id: 'wiz-hands', name: '燃烧之手', cost: 2, rarity: 'common', pool: W, icon: 'fire-spell-cast', colors: 'fire', tags: ['fire'], text: '英雄相邻的所有敌人受到 {dmg} 火焰伤害（反射豁免减半）。', params: { dmg: '3d6' }, up: { params: { dmg: '4d6' } } },
    T.none,
    [{ op: 'fx', kind: 'flameNova' }, { op: 'damage', amount: '$dmg', dmgType: 'fire', to: 'adjacentEnemies', save: { type: 'ref', half: true } }],
  ),
  unit(
    { id: 'wiz-fireelem', name: '火元素', cost: 5, rarity: 'rare', pool: W, icon: 'fire-silhouette', colors: 'fire', tags: ['fire'], text: '攻击点燃目标 2 回合；免疫火焰，惧怕冰霜。', up: { unit: { hp: 22, ac: 13, atk: 6, dmg: '2d6+3', dmgType: 'fire', range: 1, move: 4, kw: { ignite: 2, blast: 1 }, tribe: ['elemental'], immune: ['fire', 'poison'], vuln: ['cold'], fx: 'fire' }, text: '攻击点燃目标并溅射相邻敌人；免疫火焰，惧怕冰霜。' } },
    { hp: 18, ac: 13, atk: 5, dmg: '2d6+2', dmgType: 'fire', range: 1, move: 4, kw: { ignite: 2 }, tribe: ['elemental'], immune: ['fire', 'poison'], vuln: ['cold'], saves: { fort: 3, ref: 3, will: 0 }, fx: 'fire' },
  ),
  spell(
    { id: 'wiz-meteor', name: '流星火雨', cost: 8, rarity: 'legendary', pool: W, icon: 'burning-meteor', colors: 'fire', tags: ['fire'], text: '8 格内 5×5 区域：所有单位受到 {dmg} 火焰伤害（反射豁免减半），并燃起【火焰地面】。', flavor: '天空裂开，群星坠落。', params: { dmg: '6d6' }, up: { cost: 7 } },
    { kind: 'tile', range: 8, radius: 2 },
    [{ op: 'fx', kind: 'meteor' }, { op: 'damage', amount: '$dmg', dmgType: 'fire', save: { type: 'ref', half: true } }, { op: 'surface', surface: 'fire', turns: 2 }],
  ),
  spell(
    { id: 'wiz-fireshield', name: '火焰护盾', cost: 2, rarity: 'common', pool: W, icon: 'fire-shield', colors: 'fire', tags: ['fire'], text: '一个友方单位获得【荆棘 {thorns}】并抗性冰霜，持续 3 回合。', params: { thorns: 3 }, up: { params: { thorns: 5 } } },
    T.ally(),
    [{ op: 'fx', kind: 'fireShield' }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); const t = tgtUnit(ctx); if (!t) return; await b.grantKeyword(t, 'thorns', Number(ctx.params.thorns), 3); if (!t.resist.includes('cold')) t.resist.push('cold'); } }],
  ),
  // ------------------------------------------------------------- storm & frost
  spell(
    { id: 'wiz-bolt', name: '闪电束', cost: 3, rarity: 'basic', pool: W, icon: 'lightning-branches', colors: 'storm', tags: ['storm'], text: '英雄朝一个方向释放闪电：直线 5 格内所有单位受到 {dmg} 闪电伤害（反射豁免减半）。水中的单位会感电！', params: { dmg: '3d6' }, up: { params: { dmg: '4d6' } } },
    T.line(5),
    [{ op: 'fx', kind: 'lightningLine' }, { op: 'damage', amount: '$dmg', dmgType: 'lightning', save: { type: 'ref', half: true } }],
  ),
  spell(
    { id: 'wiz-thunder', name: '雷鸣波', cost: 2, rarity: 'common', pool: W, icon: 'sonic-shout', colors: 'storm', tags: ['storm'], text: '英雄周围的所有敌人受到 {dmg} 闪电伤害并被击退 2 格（强韧豁免伤害减半、不被击退）。', params: { dmg: '2d8' }, up: { params: { dmg: '3d8' } } },
    T.none,
    [
      { op: 'fx', kind: 'thunderwave' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const hero = b.hero(ctx.player);
          const dmg = b.rollNumber(String(ctx.params.dmg));
          for (const e of b.adjacentEnemies(hero)) {
            const r = await b.savingThrow(e, 'fort', b.player(ctx.player).spellDC, ctx.player, '雷鸣波');
            await b.damage(e, r.success ? Math.floor(dmg / 2) : dmg, 'lightning', hero, { label: '雷鸣波' });
            if (!r.success && !e.dead) await b.push(e, hero, 2);
          }
        },
      },
    ],
  ),
  spell(
    { id: 'wiz-frost', name: '冰霜射线', cost: 1, rarity: 'basic', pool: W, icon: 'ice-bolt', colors: 'frost', tags: ['frost'], text: '法术攻击 5 格内一个敌人：{dmg} 冰霜伤害并【迟缓】1 回合。脚下的浅水会结冰。', params: { dmg: '1d10+1' }, up: { params: { dmg: '2d8+1' } } },
    T.enemy(5),
    [
      { op: 'damage', amount: '$dmg', dmgType: 'cold', spellAttack: true, fx: 'frostbolt' },
      { op: 'custom', fn: async (ctx) => { const b = B(ctx); const t = tgtUnit(ctx); if (t && !t.dead) await b.addStatus(t, 'slowed', 1); } },
    ],
  ),
  spell(
    { id: 'wiz-icestorm', name: '冰风暴', cost: 4, rarity: 'rare', pool: W, icon: 'snowflake-2', colors: 'frost', tags: ['frost'], text: '6 格内 3×3 区域：所有单位受到 {dmg} 冰霜伤害（强韧豁免减半），地面结成【冰面】3 回合。', params: { dmg: '3d8' }, up: { params: { dmg: '4d8' } } },
    T.tile(6, 1),
    [{ op: 'fx', kind: 'icestorm' }, { op: 'damage', amount: '$dmg', dmgType: 'cold', save: { type: 'fort', half: true } }, { op: 'surface', surface: 'ice', turns: 3 }],
  ),
  spell(
    { id: 'wiz-freeze', name: '急冻', cost: 3, rarity: 'common', pool: W, icon: 'frozen-orb', colors: 'frost', tags: ['frost'], text: '一个非英雄敌人进行强韧豁免，失败则【冻结】2 回合（无法移动与行动，受火焰伤害解冻）。', up: { cost: 2 } },
    T.enemyUnit(6),
    [{ op: 'fx', kind: 'freeze' }, { op: 'status', status: 'frozen', turns: 2, save: { type: 'fort' } }],
  ),
  unit(
    { id: 'wiz-stormspirit', name: '风暴精魂', cost: 4, rarity: 'rare', pool: W, icon: 'spark-spirit', colors: 'storm', tags: ['storm'], text: '闪电攻击会让水中的敌人感电。', up: { unit: { hp: 14, ac: 14, atk: 6, dmg: '1d10+2', dmgType: 'lightning', range: 3, move: 5, kw: { flying: 1 }, tribe: ['elemental'], immune: ['lightning', 'poison'], fx: 'lightning' } } },
    { hp: 12, ac: 14, atk: 5, dmg: '1d10+1', dmgType: 'lightning', range: 3, move: 5, kw: { flying: 1 }, tribe: ['elemental'], immune: ['lightning', 'poison'], saves: { fort: 1, ref: 4, will: 1 }, fx: 'lightning' },
  ),
  equip(
    { id: 'wiz-stormstaff', name: '雷霆法杖', cost: 3, rarity: 'rare', pool: W, icon: 'lightning-helix', colors: 'storm', tags: ['storm'], text: '攻击额外造成 1d6 伤害，伤害类型变为闪电（可引发感电）。', up: { cost: 2 } },
    { dmg: '1d6', dmgType: 'lightning' },
  ),
  // ------------------------------------------------------------- arcane
  unit(
    { id: 'wiz-apprentice', name: '学徒法师', cost: 2, rarity: 'basic', pool: W, icon: 'wizard-face', colors: 'arcane', text: '', up: { text: '登场：抽 1 张牌。', unit: { hp: 6, ac: 11, atk: 4, dmg: '1d6+1', dmgType: 'arcane', range: 3, move: 3, tribe: ['humanoid'], triggers: [{ on: 'summon', effects: [{ op: 'draw', n: 1 }] }], fx: 'magic' } } },
    { hp: 6, ac: 11, atk: 4, dmg: '1d6+1', dmgType: 'arcane', range: 3, move: 3, tribe: ['humanoid'], saves: { fort: 0, ref: 1, will: 3 }, fx: 'magic' },
  ),
  spell(
    { id: 'wiz-missile', name: '魔法飞弹', cost: 1, rarity: 'basic', pool: W, icon: 'orb-direction', colors: 'arcane', tags: ['arcane'], text: '必定命中：对任意一个敌人造成 {dmg} 奥术伤害。', params: { dmg: '3d4+3' }, up: { params: { dmg: '4d4+4' } } },
    T.enemy(),
    [{ op: 'damage', amount: '$dmg', dmgType: 'arcane', fx: 'missile' }],
  ),
  spell(
    { id: 'wiz-misty', name: '迷踪步', cost: 0, rarity: 'common', pool: W, icon: 'magic-portal', colors: 'arcane', tags: ['arcane'], text: '英雄传送到 3 格内的一个空地。', up: { text: '英雄传送到 4 格内的一个空地，抽 1 张牌。', target: { kind: 'tile', range: 4, empty: true }, effects: [{ op: 'fx', kind: 'blink' }, { op: 'teleportSelf' }, { op: 'draw', n: 1 }] } },
    T.empty(3),
    [{ op: 'fx', kind: 'blink' }, { op: 'teleportSelf' }],
  ),
  spell(
    { id: 'wiz-intellect', name: '奥术智慧', cost: 2, rarity: 'basic', pool: W, icon: 'spell-book', colors: 'arcane', tags: ['arcane'], text: '抽 2 张牌。', up: { cost: 1 } },
    T.none,
    [{ op: 'fx', kind: 'arcaneSelf' }, { op: 'draw', n: 2 }],
  ),
  unit(
    { id: 'wiz-golem', name: '石魔像', cost: 5, rarity: 'rare', pool: W, icon: 'rock-golem', colors: 'earth', text: '法术抗性：对法术的豁免检定具有优势。', up: { unit: { hp: 30, ac: 15, atk: 6, dmg: '2d8+3', range: 1, move: 2, kw: { provoke: 1, spellward: 1, shield: 1 }, tribe: ['construct'], fx: 'smash', scale: 1.2 } } },
    { hp: 26, ac: 15, atk: 5, dmg: '2d8+2', range: 1, move: 2, kw: { provoke: 1, spellward: 1 }, tribe: ['construct'], saves: { fort: 5, ref: 0, will: 2 }, fx: 'smash', scale: 1.2 },
  ),
  spell(
    { id: 'wiz-surge', name: '法力涌动', cost: 0, rarity: 'rare', pool: W, icon: 'concentration-orb', colors: 'arcane', tags: ['arcane'], fate: 1, text: '消耗 1 命运点：获得 {mana} 点法力。', params: { mana: 3 }, up: { params: { mana: 4 } } },
    T.none,
    [{ op: 'fx', kind: 'arcaneSelf' }, { op: 'mana', n: '$mana' }],
  ),
  spell(
    { id: 'wiz-levitate', name: '浮空术', cost: 1, rarity: 'common', pool: W, icon: 'feathered-wing', colors: 'arcane', text: '一个友方单位获得【飞行】2 回合并抽 1 张牌。', up: { cost: 0 } },
    T.ally(),
    [{ op: 'fx', kind: 'arcane' }, { op: 'keyword', kw: 'flying', value: 1, turns: 2 }, { op: 'draw', n: 1 }],
  ),
  spell(
    { id: 'wiz-chain', name: '连锁闪电', cost: 5, rarity: 'epic', pool: W, icon: 'chain-lightning', colors: 'storm', tags: ['storm'], text: '对一个敌人造成 {dmg} 闪电伤害，然后弹射到附近最多 3 个其他敌人（各自反射豁免减半）。', params: { dmg: '4d6' }, up: { params: { dmg: '5d6' } } },
    T.enemy(6),
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const first = tgtUnit(ctx);
          if (!first) return;
          const hit = new Set<number>();
          let cur = first;
          const dmg = b.rollNumber(String(ctx.params.dmg));
          const hero = b.hero(ctx.player);
          let from = { x: hero.x, y: hero.y };
          for (let i = 0; i < 4 && cur; i++) {
            hit.add(cur.uid);
            await b.emit({ t: 'fx', kind: 'lightning', from, to: { x: cur.x, y: cur.y } });
            const r = await b.savingThrow(cur, 'ref', b.player(ctx.player).spellDC, ctx.player, '连锁闪电');
            const tile = b.tileOf(cur);
            await b.damage(cur, r.success ? Math.floor(dmg / 2) : dmg, 'lightning', hero, { label: '连锁闪电' });
            await b.elementReact([tile], 'lightning', b.ctxFor(ctx.player, hero, undefined, { x: tile.x, y: tile.y }, null, false, '连锁闪电'));
            from = { x: tile.x, y: tile.y };
            const next = b
              .enemiesOf(ctx.player)
              .filter((e) => !hit.has(e.uid) && Math.max(Math.abs(e.x - from.x), Math.abs(e.y - from.y)) <= 3)
              .sort((a, c) => Math.max(Math.abs(a.x - from.x), Math.abs(a.y - from.y)) - Math.max(Math.abs(c.x - from.x), Math.abs(c.y - from.y)))[0];
            cur = next;
          }
        },
      },
    ],
  ),
  equip(
    { id: 'wiz-robe', name: '大法师长袍', cost: 3, rarity: 'epic', pool: W, icon: 'wizard-staff', colors: 'arcane', tags: ['arcane'], text: '+2 AC，+4 生命，【法术抗性】，并获得 1 层【护盾】。', up: { cost: 2 } },
    { ac: 2, hp: 4, kw: { spellward: 1, ward: 1 } },
  ),
];
