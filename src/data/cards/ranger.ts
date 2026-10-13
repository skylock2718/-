import type { CardDef } from '../../core/types';
import { B, equip, spell, T, terrain, tgtUnit, unit } from '../util';

const R = 'ranger' as const;

export const RANGER_CARDS: CardDef[] = [
  // ------------------------------------------------------------- high-ground snipers
  unit(
    { id: 'rng-scout', name: '林地斥候', cost: 1, rarity: 'basic', pool: R, icon: 'hood', tags: ['highground'], flavor: '她走过的地方，连露水都不会落。', up: { unit: { hp: 6, ac: 13, atk: 5, dmg: '1d6+1', range: 3, move: 5, kw: { scout: 1 } } } },
    { hp: 5, ac: 13, atk: 4, dmg: '1d6+1', range: 3, move: 4, kw: { scout: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 3, will: 1 }, fx: 'arrow' },
  ),
  unit(
    { id: 'rng-archer', name: '精灵弓手', cost: 2, rarity: 'basic', pool: R, icon: 'archer', tags: ['highground'], text: '站在高处时命中额外 +1、射程额外 +1。', up: { unit: { hp: 8, ac: 13, atk: 6, dmg: '1d8+2', range: 4, move: 3, kw: { vantage: 1 } } } },
    { hp: 7, ac: 13, atk: 5, dmg: '1d8+1', range: 4, move: 3, kw: { vantage: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 3, will: 1 }, fx: 'arrow' },
  ),
  unit(
    { id: 'rng-sniper', name: '鹰眼狙击手', cost: 4, rarity: 'rare', pool: R, icon: 'arrow-scope', tags: ['highground'], text: '天然 19~20 即暴击。', flavor: '「风速，三。高度，二。……放。」', up: { unit: { hp: 11, ac: 13, atk: 7, dmg: '1d10+4', range: 5, move: 3, kw: { vantage: 1, keen: 1, climb: 1 } } } },
    { hp: 10, ac: 13, atk: 6, dmg: '1d10+3', range: 5, move: 3, kw: { vantage: 1, keen: 1, climb: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 4, will: 2 }, fx: 'arrow' },
  ),
  unit(
    { id: 'rng-ranger', name: '巡林客', cost: 3, rarity: 'common', pool: R, icon: 'bowman', tags: ['highground'], text: '【连击】：每次行动射击两次。', up: { unit: { hp: 10, ac: 14, atk: 5, dmg: '1d6+2', range: 3, move: 4, kw: { flurry: 1, scout: 1 } } } },
    { hp: 9, ac: 13, atk: 5, dmg: '1d6+1', range: 3, move: 4, kw: { flurry: 1, scout: 1 }, tribe: ['humanoid'], saves: { fort: 1, ref: 3, will: 1 }, fx: 'arrow' },
  ),
  // ------------------------------------------------------------- beasts
  unit(
    { id: 'rng-wolf', name: '灰狼', cost: 2, rarity: 'basic', pool: R, icon: 'wolf-head', colors: 'beast', tags: ['beast'], text: '【群狼战术】：目标身边有其他友军时，攻击获得优势。', up: { unit: { hp: 10, ac: 13, atk: 5, dmg: '1d6+2', range: 1, move: 5, kw: { pack: 1 }, tribe: ['beast'] } } },
    { hp: 8, ac: 12, atk: 4, dmg: '1d6+2', range: 1, move: 5, kw: { pack: 1 }, tribe: ['beast'], saves: { fort: 2, ref: 2, will: 0 }, fx: 'bite' },
  ),
  unit(
    { id: 'rng-falcon', name: '猎鹰', cost: 1, rarity: 'basic', pool: R, icon: 'eagle-head', colors: 'beast', tags: ['beast'], up: { unit: { hp: 5, ac: 14, atk: 5, dmg: '1d4+2', range: 1, move: 6, kw: { flying: 1, haste: 1 }, tribe: ['beast'] } } },
    { hp: 4, ac: 14, atk: 4, dmg: '1d4+1', range: 1, move: 6, kw: { flying: 1, haste: 1 }, tribe: ['beast'], saves: { fort: 0, ref: 4, will: 0 }, fx: 'claw' },
  ),
  unit(
    { id: 'rng-bear', name: '林地巨熊', cost: 4, rarity: 'common', pool: R, icon: 'bear-head', colors: 'beast', tags: ['beast'], text: '生命低于一半时伤害 +3。', up: { unit: { hp: 24, ac: 13, atk: 6, dmg: '2d6+2', range: 1, move: 4, kw: { provoke: 1, frenzy: 3 }, tribe: ['beast'] } } },
    { hp: 20, ac: 13, atk: 5, dmg: '2d6+2', range: 1, move: 4, kw: { provoke: 1, frenzy: 3 }, tribe: ['beast'], saves: { fort: 4, ref: 1, will: 0 }, fx: 'claw', scale: 1.1 },
  ),
  unit(
    {
      id: 'rng-alpha',
      name: '头狼',
      cost: 5,
      rarity: 'rare',
      pool: R,
      icon: 'wolf-howl',
      colors: 'beast',
      tags: ['beast'],
      text: '登场：召唤 2 只【幼狼】。相邻友军 +1 命中。',
      up: { text: '登场：召唤 3 只【幼狼】。相邻友军 +1 命中。', unit: { hp: 18, ac: 13, atk: 6, dmg: '1d10+3', range: 1, move: 5, kw: { pack: 1, auraAtk: 1 }, tribe: ['beast'], triggers: [{ on: 'summon', label: '嚎叫', effects: [{ op: 'summon', card: 'tok-wolfpup', count: 3, at: 'nearSelf' }] }], fx: 'bite' } },
    },
    { hp: 16, ac: 13, atk: 6, dmg: '1d10+3', range: 1, move: 5, kw: { pack: 1, auraAtk: 1 }, tribe: ['beast'], triggers: [{ on: 'summon', label: '嚎叫', effects: [{ op: 'summon', card: 'tok-wolfpup', count: 2, at: 'nearSelf' }] }], fx: 'bite' },
  ),
  unit(
    { id: 'rng-panther', name: '影豹', cost: 3, rarity: 'rare', pool: R, icon: 'lion', colors: 'shadow', tags: ['beast'], text: '入场即潜行；偷袭额外 1d6。', up: { unit: { hp: 12, ac: 14, atk: 6, dmg: '1d8+3', range: 1, move: 6, kw: { stealth: 1, sneak: 2 }, tribe: ['beast'] } } },
    { hp: 10, ac: 14, atk: 5, dmg: '1d8+3', range: 1, move: 6, kw: { stealth: 1, sneak: 1 }, tribe: ['beast'], saves: { fort: 1, ref: 4, will: 1 }, fx: 'claw' },
  ),
  unit(
    {
      id: 'rng-treant',
      name: '古树守护者',
      cost: 6,
      rarity: 'epic',
      pool: R,
      icon: 'tree-face',
      colors: 'earth',
      tags: ['beast'],
      text: '登场：周围一圈变为森林。每回合再生 2。',
      flavor: '它在此地站了三千年，今天它决定挪一挪。',
      up: { unit: { hp: 34, ac: 15, atk: 6, dmg: '2d8+3', range: 1, move: 2, kw: { provoke: 1, regen: 3 }, tribe: ['elemental'], triggers: [{ on: 'summon', label: '林木苏醒', effects: [{ op: 'terrain', terrain: 'forest', radius: 1 }] }], vuln: ['fire'], scale: 1.3 } },
    },
    { hp: 30, ac: 15, atk: 5, dmg: '2d8+3', range: 1, move: 2, kw: { provoke: 1, regen: 2 }, tribe: ['elemental'], triggers: [{ on: 'summon', label: '林木苏醒', effects: [{ op: 'custom', fn: async (ctx) => { const b = B(ctx); const s = b.unit(ctx.source); if (!s) return; const tiles = b.board.area(s, 1).filter((t) => t.terrain === 'plain' && !t.node && !(t.x === s.x && t.y === s.y)); for (const t of tiles) t.terrain = 'forest'; if (tiles.length) await b.emit({ t: 'terrain', tiles: tiles.map((t) => ({ x: t.x, y: t.y, terrain: 'forest' as const })) }); } }] }], vuln: ['fire'], saves: { fort: 5, ref: 0, will: 3 }, fx: 'smash', scale: 1.3 },
  ),
  unit(
    { id: 'rng-roc', name: '远古巨鹰', cost: 7, rarity: 'legendary', pool: R, icon: 'eagle-emblem', colors: 'beast', tags: ['beast'], text: '攻击击退目标 2 格——把敌人从悬崖上丢下去吧。', flavor: '它的影子掠过山谷，羊群便四散奔逃。', up: { unit: { hp: 30, ac: 15, atk: 8, dmg: '2d8+4', range: 1, move: 7, kw: { flying: 1, push: 2 }, tribe: ['beast'], fx: 'claw', scale: 1.35 } } },
    { hp: 26, ac: 14, atk: 7, dmg: '2d8+4', range: 1, move: 6, kw: { flying: 1, push: 2 }, tribe: ['beast'], saves: { fort: 4, ref: 4, will: 2 }, fx: 'claw', scale: 1.35 },
  ),
  // ------------------------------------------------------------- spells & terrain
  terrain(
    { id: 'rng-raise', name: '隆起之地', cost: 1, rarity: 'basic', pool: R, icon: 'stone-stack', colors: 'earth', tags: ['highground'], text: '将英雄 5 格内的一格地面抬升 {h} 层（站在上面的单位一起被抬高）。', params: { h: 1 }, up: { params: { h: 2 } } },
    T.tile(5, 0),
    [{ op: 'fx', kind: 'quake' }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); const t = ctx.targetPos ? b.board.get(ctx.targetPos) : null; if (!t || t.terrain === 'deep' || t.terrain === 'lava') return; t.h = Math.min(5, t.h + Number(ctx.params.h)); if (t.terrain === 'water') t.terrain = 'plain'; await b.emit({ t: 'height', tiles: [{ x: t.x, y: t.y, h: t.h }] }); } }],
  ),
  terrain(
    { id: 'rng-bastion', name: '山岩堡垒', cost: 3, rarity: 'rare', pool: R, icon: 'mountains', colors: 'earth', tags: ['highground'], text: '将 3×3 区域整体抬升 1 层。', up: { cost: 2 } },
    T.tile(4, 1),
    [{ op: 'fx', kind: 'quake' }, { op: 'raise', amount: 1 }],
  ),
  terrain(
    {
      id: 'rng-sinkhole',
      name: '地陷',
      cost: 2,
      rarity: 'common',
      pool: R,
      icon: 'sinking-trap',
      colors: 'earth',
      tags: ['highground'],
      text: '将一格地面下沉 2 层；站在上面的单位坠落，受到 1d6 伤害并【倒地】。',
      up: { text: '将一格地面下沉 2 层；站在上面的单位坠落，受到 2d6 伤害并【倒地】。', params: { dmg: '2d6' } },
      params: { dmg: '1d6' },
    },
    T.tile(5, 0),
    [
      { op: 'fx', kind: 'quake' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          if (!ctx.targetPos) return;
          const t = b.board.get(ctx.targetPos);
          if (t.terrain === 'deep' || t.terrain === 'lava') return;
          const before = t.h;
          t.h = Math.max(0, t.h - 2);
          if (t.h === before) return;
          await b.emit({ t: 'height', tiles: [{ x: t.x, y: t.y, h: t.h }] });
          const u = b.unitAt(t.x, t.y);
          if (u && !b.isFlying(u)) {
            await b.damage(u, b.rollNumber(String(ctx.params.dmg)), 'physical', null, { label: '坠落' });
            if (!u.dead) await b.addStatus(u, 'prone', 1);
          }
        },
      },
    ],
  ),
  spell(
    { id: 'rng-pierce', name: '穿云箭', cost: 2, rarity: 'basic', pool: R, icon: 'fast-arrow', tags: ['highground'], text: '英雄朝一个方向射出一箭：直线 5 格内所有敌人受到 {dmg} 穿刺伤害（反射豁免减半）。', params: { dmg: '2d6+1' }, up: { params: { dmg: '3d6+1' } } },
    T.line(5),
    [{ op: 'fx', kind: 'arrowLine' }, { op: 'damage', amount: '$dmg', to: 'targetEnemies', save: { type: 'ref', half: true } }],
  ),
  spell(
    { id: 'rng-volley', name: '箭雨', cost: 3, rarity: 'common', pool: R, icon: 'arrow-cluster', tags: ['highground'], text: '英雄 6 格内 3×3 区域：所有敌人受到 {dmg} 伤害（反射豁免减半）。', params: { dmg: '2d6+1' }, up: { params: { dmg: '3d6+1' } } },
    T.tile(6, 1),
    [{ op: 'fx', kind: 'volley' }, { op: 'damage', amount: '$dmg', to: 'targetEnemies', save: { type: 'ref', half: true } }],
  ),
  spell(
    { id: 'rng-entangle', name: '纠缠藤蔓', cost: 2, rarity: 'basic', pool: R, icon: 'curling-vines', colors: 'earth', text: '3×3 区域内的敌人进行强韧豁免，失败则【定身】1 回合；该区域的空地长成森林。', up: { cost: 1 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'vines' }, { op: 'status', status: 'rooted', turns: 1, to: 'targetEnemies', save: { type: 'fort' } }, { op: 'terrain', terrain: 'forest' }],
  ),
  spell(
    { id: 'rng-callwild', name: '荒野召唤', cost: 3, rarity: 'common', pool: R, icon: 'paw-print', colors: 'beast', tags: ['beast'], text: '在英雄身边召唤 2 只【幼狼】。', up: { text: '在英雄身边召唤 2 只【幼狼】，它们获得【疾驰】。', effects: [{ op: 'summon', card: 'tok-wolfpup-haste', count: 2, at: 'nearHero' }] } },
    T.none,
    [{ op: 'summon', card: 'tok-wolfpup', count: 2, at: 'nearHero' }],
  ),
  spell(
    { id: 'rng-fury', name: '原始狂怒', cost: 2, rarity: 'common', pool: R, icon: 'beast-eye', colors: 'beast', tags: ['beast'], text: '所有友方野兽本回合【激昂】（伤害 +{dmg}）并【加速】。', params: { dmg: 2 }, up: { params: { dmg: 3 } } },
    T.none,
    [
      { op: 'fx', kind: 'rally' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          for (const u of b.unitsOf(ctx.player)) {
            if (!u.tribe.includes('beast')) continue;
            await b.addStatus(u, 'inspired', 1, Number(ctx.params.dmg), ctx.player);
            await b.addStatus(u, 'hasted', 1);
          }
        },
      },
    ],
  ),
  spell(
    { id: 'rng-gift', name: '自然恩赐', cost: 1, rarity: 'common', pool: R, icon: 'oak-leaf', colors: 'earth', tags: ['beast', 'heal'], text: '为一个友方单位回复 {heal}；若它是野兽，永久 +1 命中与 +2 生命上限。', params: { heal: '2d4+2' }, up: { params: { heal: '3d4+3' } } },
    T.ally(),
    [
      { op: 'heal', amount: '$heal' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (t && t.tribe.includes('beast')) {
            await b.buff(t, 'atk', 1);
            await b.buff(t, 'maxHp', 2);
          }
        },
      },
    ],
  ),
  spell(
    { id: 'rng-mark', name: '猎物标记', cost: 0, rarity: 'common', pool: R, icon: 'crosshair-arrow', text: '标记一个敌人 3 回合：你的所有单位攻击它时额外造成 1d6 伤害。抽 1 张牌。', up: { text: '标记一个敌人 3 回合：你的所有单位攻击它时额外造成 2d6 伤害。抽 1 张牌。', effects: [{ op: 'fx', kind: 'mark' }, { op: 'status', status: 'marked', turns: 3, value: 2 }, { op: 'draw', n: 1 }] } },
    T.enemy(),
    [{ op: 'fx', kind: 'mark' }, { op: 'status', status: 'marked', turns: 3, value: 1 }, { op: 'draw', n: 1 }],
  ),
  // ------------------------------------------------------------- equipment
  equip(
    { id: 'rng-boots', name: '大步之靴', cost: 1, rarity: 'basic', pool: R, icon: 'leather-boot', text: '+2 移动，攀爬 +1。', up: { cost: 0 } },
    { move: 2, jump: 1 },
  ),
  equip(
    { id: 'rng-longbow', name: '精灵长弓', cost: 2, rarity: 'common', pool: R, icon: 'pocket-bow', tags: ['highground'], text: '仅限远程单位：+1 射程，+1 命中。', up: { text: '仅限远程单位：+1 射程，+2 命中，伤害 +1。', equip: { range: 1, atk: 2, dmg: 1, onlyRanged: true } } },
    { range: 1, atk: 1, onlyRanged: true },
  ),
  equip(
    { id: 'rng-stormquiver', name: '风暴箭袋', cost: 3, rarity: 'rare', pool: R, icon: 'lightning-bow', colors: 'storm', tags: ['highground'], text: '仅限远程单位：【敏锐】（19~20 暴击），攻击额外 1d4 闪电伤害并变为闪电属性。', up: { cost: 2 } },
    { kw: { keen: 1 }, dmg: '1d4', dmgType: 'lightning', onlyRanged: true },
  ),
  equip(
    { id: 'rng-horn', name: '兽王号角', cost: 2, rarity: 'rare', pool: R, icon: 'hunting-horn', colors: 'beast', tags: ['beast'], text: '装备者获得【鼓舞 2】（相邻友军伤害 +2）与 +1 移动。', up: { cost: 1 } },
    { kw: { inspire: 2 }, move: 1 },
  ),
];
