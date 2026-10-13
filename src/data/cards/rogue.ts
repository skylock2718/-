import type { CardDef, Effect } from '../../core/types';
import { B, equip, spell, T, tgtUnit, unit } from '../util';

const G = 'rogue' as const;

function allIn(shift: number): Effect[] {
  return [
    {
      op: 'roll',
      die: 20,
      label: '孤注一掷',
      table: [
        { min: 1, label: '血本无归', effects: [{ op: 'damage', amount: '2d6', to: 'hero' }] },
        { min: 6 - shift, label: '小有斩获', effects: [{ op: 'damage', amount: '3d6', fx: 'cards' }] },
        { min: 15 - shift, label: '大获全胜', effects: [{ op: 'damage', amount: '5d6', fx: 'cards' }] },
        { min: 20, label: '头奖！', effects: [{ op: 'damage', amount: '8d6', fx: 'cards' }, { op: 'fate', n: 2 }] },
      ],
    },
  ];
}

export const ROGUE_CARDS: CardDef[] = [
  // ------------------------------------------------------------- gamble
  unit(
    {
      id: 'rog-gambler',
      name: '双骰赌徒',
      cost: 2,
      rarity: 'basic',
      pool: G,
      icon: 'rolling-dices',
      colors: 'dice',
      tags: ['gamble'],
      text: '登场：掷 1d6，4 点以上获得 1 命运点。【幸运】：重掷天然 1。',
      up: { text: '登场：掷 1d6，3 点以上获得 1 命运点。【幸运】：重掷天然 1。', unit: { hp: 9, ac: 13, atk: 5, dmg: '1d6+2', range: 1, move: 4, kw: { lucky: 1 }, tribe: ['humanoid'], triggers: [{ on: 'summon', effects: [{ op: 'roll', die: 6, label: '小赌一把', table: [{ min: 1, label: '没中', effects: [] }, { min: 3, label: '赢了！', effects: [{ op: 'fate', n: 1 }] }] }] }], fx: 'slash' } },
    },
    { hp: 8, ac: 13, atk: 4, dmg: '1d6+2', range: 1, move: 4, kw: { lucky: 1 }, tribe: ['humanoid'], triggers: [{ on: 'summon', effects: [{ op: 'roll', die: 6, label: '小赌一把', table: [{ min: 1, label: '没中', effects: [] }, { min: 4, label: '赢了！', effects: [{ op: 'fate', n: 1 }] }] }] }], fx: 'slash' },
  ),
  spell(
    { id: 'rog-allin', name: '孤注一掷', cost: 2, rarity: 'basic', pool: G, icon: 'poker-hand', colors: 'dice', tags: ['gamble'], text: '选择 6 格内一个敌人并掷 d20：1~5 你的英雄受到 2d6 伤害；6~14 造成 3d6；15~19 造成 5d6；20 造成 8d6 并获得 2 命运点。', up: { text: '选择 6 格内一个敌人并掷 d20：1~4 你的英雄受到 2d6 伤害；5~13 造成 3d6；14~19 造成 5d6；20 造成 8d6 并获得 2 命运点。', effects: allIn(1) } },
    T.enemy(6),
    allIn(0),
  ),
  spell(
    { id: 'rog-coin', name: '幸运金币', cost: 0, rarity: 'basic', pool: G, icon: 'crown-coin', colors: 'gold', tags: ['gamble'], text: '获得 1 命运点。', up: { text: '获得 1 命运点，抽 1 张牌。', effects: [{ op: 'fx', kind: 'coin' }, { op: 'fate', n: 1 }, { op: 'draw', n: 1 }] } },
    T.none,
    [{ op: 'fx', kind: 'coin' }, { op: 'fate', n: 1 }],
  ),
  spell(
    { id: 'rog-doubledown', name: '加倍下注', cost: 1, rarity: 'common', pool: G, icon: 'card-joker', colors: 'dice', tags: ['gamble'], text: '本回合你的所有单位【敏锐】+1（暴击范围扩大 1），并抽 1 张牌。', up: { text: '本回合你的所有单位【敏锐】+2，并抽 1 张牌。', effects: [{ op: 'fx', kind: 'rally' }, { op: 'keyword', kw: 'keen', value: 2, turns: 1, to: 'allAllies' }, { op: 'draw', n: 1 }] } },
    T.none,
    [{ op: 'fx', kind: 'rally' }, { op: 'keyword', kw: 'keen', value: 1, turns: 1, to: 'allAllies' }, { op: 'draw', n: 1 }],
  ),
  spell(
    {
      id: 'rog-wheel',
      name: '命运之轮',
      cost: 1,
      rarity: 'common',
      pool: G,
      icon: 'tarot-10-wheel-of-fortune',
      colors: 'dice',
      tags: ['gamble'],
      text: '掷 d6：1 英雄失去 2 生命；2~3 抽 1 张；4~5 获得 2 法力；6 抽 2 张并获得 1 命运点。',
      up: { cost: 0 },
    },
    T.none,
    [
      {
        op: 'roll',
        die: 6,
        label: '命运之轮',
        table: [
          { min: 1, label: '厄运', effects: [{ op: 'damage', amount: 2, to: 'hero', dmgType: 'psychic' }] },
          { min: 2, label: '抽牌', effects: [{ op: 'draw', n: 1 }] },
          { min: 4, label: '法力', effects: [{ op: 'mana', n: 2 }] },
          { min: 6, label: '大吉', effects: [{ op: 'draw', n: 2 }, { op: 'fate', n: 1 }] },
        ],
      },
    ],
  ),
  spell(
    { id: 'rog-cheat', name: '出千', cost: 1, rarity: 'rare', pool: G, icon: 'magick-trick', colors: 'dice', tags: ['gamble'], fate: 1, text: '消耗 1 命运点：一个友方单位本回合下一次攻击必定暴击（获得【敏锐 10】1 回合）。', up: { cost: 0 } },
    T.ally(),
    [{ op: 'fx', kind: 'dice' }, { op: 'keyword', kw: 'keen', value: 10, turns: 1 }],
  ),
  unit(
    { id: 'rog-bouncer', name: '赌场打手', cost: 3, rarity: 'common', pool: G, icon: 'fist', colors: 'blood', tags: ['gamble'], text: '【幸运】：重掷天然 1。', up: { unit: { hp: 17, ac: 14, atk: 5, dmg: '1d8+3', range: 1, move: 3, kw: { provoke: 1, lucky: 1 }, tribe: ['humanoid'], fx: 'smash' } } },
    { hp: 14, ac: 13, atk: 4, dmg: '1d8+3', range: 1, move: 3, kw: { provoke: 1, lucky: 1 }, tribe: ['humanoid'], saves: { fort: 3, ref: 1, will: 0 }, fx: 'smash' },
  ),
  unit(
    {
      id: 'rog-house',
      name: '庄家',
      cost: 6,
      rarity: 'epic',
      pool: G,
      icon: 'card-king-diamonds',
      colors: 'gold',
      tags: ['gamble'],
      text: '你的回合开始时：掷 d20，11 以上获得 1 命运点与 1 法力。',
      flavor: '「庄家永远不会输。」',
      up: { text: '你的回合开始时：掷 d20，8 以上获得 1 命运点与 1 法力。', unit: { hp: 24, ac: 15, atk: 6, dmg: '2d6+3', range: 1, move: 3, kw: { lucky: 1 }, tribe: ['humanoid'], triggers: [{ on: 'turnStart', effects: [{ op: 'roll', die: 20, label: '庄家抽水', table: [{ min: 1, label: '落空', effects: [] }, { min: 8, label: '进账', effects: [{ op: 'fate', n: 1 }, { op: 'mana', n: 1 }] }] }] }], fx: 'slash' } },
    },
    { hp: 22, ac: 15, atk: 6, dmg: '2d6+3', range: 1, move: 3, kw: { lucky: 1 }, tribe: ['humanoid'], saves: { fort: 3, ref: 2, will: 4 }, triggers: [{ on: 'turnStart', effects: [{ op: 'roll', die: 20, label: '庄家抽水', table: [{ min: 1, label: '落空', effects: [] }, { min: 11, label: '进账', effects: [{ op: 'fate', n: 1 }, { op: 'mana', n: 1 }] }] }] }], fx: 'slash' },
  ),
  unit(
    { id: 'rog-ladyluck', name: '幸运女神之宠', cost: 7, rarity: 'legendary', pool: G, icon: 'clover-spiked', colors: 'dice', tags: ['gamble'], text: '【连击】【幸运】，天然 18~20 即暴击。每次击杀获得 1 命运点。', flavor: '她从不掷骰子——骰子会自己找上她。', up: { cost: 6 } },
    { hp: 20, ac: 16, atk: 7, dmg: '1d8+4', range: 1, move: 5, kw: { flurry: 1, lucky: 1, keen: 2 }, tribe: ['humanoid'], saves: { fort: 2, ref: 6, will: 4 }, triggers: [{ on: 'kill', label: '赢家通吃', effects: [{ op: 'fate', n: 1 }] }], fx: 'slash' },
  ),
  equip(
    { id: 'rog-loaded', name: '灌铅骰子', cost: 2, rarity: 'rare', pool: G, icon: 'dice-twenty-faces-twenty', colors: 'dice', tags: ['gamble'], text: '获得【敏锐】（19~20 暴击）与【幸运】。', up: { cost: 1 } },
    { kw: { keen: 1, lucky: 1 } },
  ),
  equip(
    { id: 'rog-rabbit', name: '幸运兔脚', cost: 1, rarity: 'basic', pool: G, icon: 'rabbit', colors: 'gold', tags: ['gamble'], text: '+1 AC，获得【幸运】（重掷天然 1）。', up: { text: '+2 AC，获得【幸运】（重掷天然 1）。', equip: { ac: 2, kw: { lucky: 1 } } } },
    { ac: 1, kw: { lucky: 1 } },
  ),
  // ------------------------------------------------------------- shadow
  unit(
    { id: 'rog-assassin', name: '暗影刺客', cost: 3, rarity: 'common', pool: G, icon: 'hooded-assassin', colors: 'shadow', tags: ['shadow'], text: '入场潜行；偷袭额外 2d6。', up: { unit: { hp: 10, ac: 14, atk: 7, dmg: '1d6+3', range: 1, move: 5, kw: { stealth: 1, sneak: 3 }, tribe: ['humanoid'], fx: 'slash' } } },
    { hp: 9, ac: 14, atk: 6, dmg: '1d6+3', range: 1, move: 5, kw: { stealth: 1, sneak: 2 }, tribe: ['humanoid'], saves: { fort: 0, ref: 5, will: 1 }, fx: 'slash' },
  ),
  unit(
    { id: 'rog-cutpurse', name: '扒手', cost: 1, rarity: 'basic', pool: G, icon: 'cloak-dagger', colors: 'shadow', tags: ['shadow'], text: '攻击命中英雄时偷取 1 命运点（若对手有）。', up: { unit: { hp: 6, ac: 13, atk: 5, dmg: '1d4+2', range: 1, move: 5, kw: { sneak: 1 }, tribe: ['humanoid'], triggers: [{ on: 'hit', effects: [{ op: 'custom', fn: async (ctx) => steal(ctx) }] }], fx: 'slash' } } },
    { hp: 5, ac: 13, atk: 4, dmg: '1d4+2', range: 1, move: 5, kw: { sneak: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 4, will: 0 }, triggers: [{ on: 'hit', effects: [{ op: 'custom', fn: async (ctx) => steal(ctx) }] }], fx: 'slash' },
  ),
  unit(
    { id: 'rog-trickster', name: '千面骗徒', cost: 3, rarity: 'rare', pool: G, icon: 'drama-masks', colors: 'shadow', tags: ['shadow', 'gamble'], text: '入场潜行；【闪避】：反射豁免成功时不受伤害。', up: { unit: { hp: 12, ac: 15, atk: 6, dmg: '1d8+2', range: 1, move: 5, kw: { stealth: 1, sneak: 2, evasion: 1 }, tribe: ['humanoid'], fx: 'slash' } } },
    { hp: 10, ac: 14, atk: 5, dmg: '1d8+2', range: 1, move: 5, kw: { stealth: 1, sneak: 1, evasion: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 6, will: 2 }, fx: 'slash' },
  ),
  equip(
    { id: 'rog-poisonblade', name: '淬毒之刃', cost: 1, rarity: 'basic', pool: G, icon: 'dripping-sword', colors: 'poison', tags: ['shadow'], text: '伤害 +1，命中使目标【中毒】2 回合。', up: { text: '伤害 +2，命中使目标【中毒】3 回合。', equip: { dmg: 2, kw: { venom: 3 } } } },
    { dmg: 1, kw: { venom: 2 } },
  ),
  spell(
    { id: 'rog-smoke', name: '烟雾弹', cost: 1, rarity: 'basic', pool: G, icon: 'smoke-bomb', colors: 'shadow', tags: ['shadow'], text: '一个友方单位进入【潜行】（无法被远处的敌人选中，下次攻击获得优势）。', up: { text: '一个友方单位进入【潜行】并本回合【加速】。', effects: [{ op: 'fx', kind: 'smoke' }, { op: 'keyword', kw: 'stealth', value: 1 }, { op: 'status', status: 'hasted', turns: 1 }] } },
    T.ally(),
    [{ op: 'fx', kind: 'smoke' }, { op: 'keyword', kw: 'stealth', value: 1 }],
  ),
  spell(
    {
      id: 'rog-backstab',
      name: '背刺',
      cost: 2,
      rarity: 'common',
      pool: G,
      icon: 'backstab',
      colors: 'shadow',
      tags: ['shadow'],
      text: '对一个与你的单位相邻的敌人造成 {dmg} 伤害；若目标处于中毒、眩晕、定身或倒地状态，伤害翻倍。',
      params: { dmg: '2d8' },
      up: { params: { dmg: '3d8' } },
    },
    T.enemy(),
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (!t) return;
          const near = b.unitsOf(ctx.player).some((u) => Math.max(Math.abs(u.x - t.x), Math.abs(u.y - t.y)) === 1);
          await b.emit({ t: 'fx', kind: 'backstab', to: { x: t.x, y: t.y } });
          if (!near) {
            await b.emit({ t: 'float', uid: t.uid, text: '无人贴身', tone: 'info' });
            return;
          }
          let d = b.rollNumber(String(ctx.params.dmg));
          if (['poisoned', 'stunned', 'rooted', 'prone', 'frozen'].some((s) => b.has(t, s as never))) d *= 2;
          await b.damage(t, d, 'physical', b.hero(ctx.player), { label: '背刺' });
        },
      },
    ],
  ),
  spell(
    { id: 'rog-fan', name: '飞刀乱舞', cost: 2, rarity: 'common', pool: G, icon: 'thrown-daggers', tags: ['shadow'], text: '英雄 2 格内的所有敌人受到 {dmg} 伤害（反射豁免减半）。', params: { dmg: '1d6+2' }, up: { params: { dmg: '2d6+2' } } },
    T.none,
    [
      { op: 'fx', kind: 'knives' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const hero = b.hero(ctx.player);
          const dmg = b.rollNumber(String(ctx.params.dmg));
          for (const e of b.enemiesOf(ctx.player).filter((e) => Math.max(Math.abs(e.x - hero.x), Math.abs(e.y - hero.y)) <= 2)) {
            const r = await b.savingThrow(e, 'ref', b.player(ctx.player).spellDC, ctx.player, '飞刀');
            await b.damage(e, r.success ? Math.floor(dmg / 2) : dmg, 'physical', hero, { label: '飞刀' });
          }
        },
      },
    ],
  ),
  spell(
    { id: 'rog-guild', name: '盗贼公会', cost: 4, rarity: 'rare', pool: G, icon: 'hood', colors: 'shadow', tags: ['shadow'], text: '在英雄身边召唤 2 名潜行的【扒手】。', up: { cost: 3 } },
    T.none,
    [{ op: 'summon', card: 'tok-cutpurse', count: 2, at: 'nearHero' }],
  ),
  spell(
    { id: 'rog-poisoncloud', name: '毒云', cost: 2, rarity: 'common', pool: G, icon: 'poison-cloud', colors: 'poison', tags: ['shadow'], text: '5 格内 3×3 区域生成【毒雾】2 回合；其中的敌人强韧豁免失败则【中毒】2 回合。遇火爆燃。', up: { cost: 1 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'poison' }, { op: 'surface', surface: 'poison', turns: 2 }, { op: 'status', status: 'poisoned', turns: 2, to: 'targetEnemies', save: { type: 'fort' } }],
  ),
  spell(
    { id: 'rog-shadowstep', name: '影步', cost: 1, rarity: 'common', pool: G, icon: 'shadow-follower', colors: 'shadow', tags: ['shadow'], text: '英雄传送到 4 格内的一个空地并进入【潜行】。', up: { cost: 0 } },
    T.empty(4),
    [{ op: 'fx', kind: 'blink' }, { op: 'teleportSelf' }, { op: 'keyword', kw: 'stealth', value: 1, to: 'hero' }],
  ),
  spell(
    { id: 'rog-coup', name: '致命一击', cost: 3, rarity: 'rare', pool: G, icon: 'bloody-sword', colors: 'blood', tags: ['shadow'], text: '对 3 格内一个敌人造成 {dmg} 伤害；若其生命低于一半，伤害翻倍。', params: { dmg: '3d6' }, up: { params: { dmg: '4d6' } } },
    T.enemy(3),
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (!t) return;
          await b.emit({ t: 'fx', kind: 'execute', to: { x: t.x, y: t.y } });
          let d = b.rollNumber(String(ctx.params.dmg));
          if (t.hp * 2 < t.maxHp) d *= 2;
          await b.damage(t, d, 'physical', b.hero(ctx.player), { label: '致命一击' });
        },
      },
    ],
  ),
  spell(
    { id: 'rog-blackmarket', name: '黑市交易', cost: 0, rarity: 'common', pool: G, icon: 'two-coins', colors: 'gold', text: '你的英雄失去 2 点生命，抽 2 张牌。', up: { text: '你的英雄失去 1 点生命，抽 2 张牌。', effects: [{ op: 'damage', amount: 1, to: 'hero', dmgType: 'psychic' }, { op: 'draw', n: 2 }] } },
    T.none,
    [{ op: 'damage', amount: 2, to: 'hero', dmgType: 'psychic' }, { op: 'draw', n: 2 }],
  ),
];

async function steal(ctx: Parameters<Extract<Effect, { op: 'custom' }>['fn']>[0]): Promise<void> {
  const b = B(ctx);
  const t = ctx.other != null ? b.unit(ctx.other) : undefined;
  if (!t || !t.isHero) return;
  const victim = b.player(t.owner);
  if (victim.fate <= 0) return;
  await b.gainFate(t.owner, -1);
  await b.gainFate(ctx.player, 1);
  await b.emit({ t: 'float', uid: t.uid, text: '-1 命运', tone: 'bad' });
}
