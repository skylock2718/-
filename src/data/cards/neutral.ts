import type { CardDef } from '../../core/types';
import { B, equip, spell, T, tgtUnit, terrain, unit } from '../util';

const X = 'neutral' as const;

export const NEUTRAL_CARDS: CardDef[] = [
  // ------------------------------------------------------------- units
  unit(
    { id: 'neu-militia', name: '民兵', cost: 1, rarity: 'basic', pool: X, icon: 'pitchfork', flavor: '昨天还在种麦子。', up: { unit: { hp: 7, ac: 12, atk: 4, dmg: '1d6+1', range: 1, move: 3, tribe: ['humanoid'], fx: 'pierce' } } },
    { hp: 6, ac: 11, atk: 3, dmg: '1d6', range: 1, move: 3, tribe: ['humanoid'], fx: 'pierce' },
  ),
  unit(
    { id: 'neu-halfling', name: '半身人游荡者', cost: 1, rarity: 'common', pool: X, icon: 'hobbit-dwelling', text: '【幸运】：重掷天然 1。', up: { unit: { hp: 6, ac: 14, atk: 5, dmg: '1d4+2', range: 2, move: 4, kw: { lucky: 1, sneak: 1 }, tribe: ['humanoid'], fx: 'arrow' } } },
    { hp: 5, ac: 13, atk: 4, dmg: '1d4+2', range: 2, move: 4, kw: { lucky: 1 }, tribe: ['humanoid'], saves: { fort: 0, ref: 3, will: 2 }, fx: 'arrow' },
  ),
  unit(
    { id: 'neu-sellsword', name: '佣兵剑士', cost: 2, rarity: 'basic', pool: X, icon: 'sword-brandish', up: { unit: { hp: 11, ac: 13, atk: 5, dmg: '1d8+2', range: 1, move: 3, tribe: ['humanoid'], fx: 'slash' } } },
    { hp: 9, ac: 13, atk: 4, dmg: '1d8+1', range: 1, move: 3, tribe: ['humanoid'], fx: 'slash' },
  ),
  unit(
    { id: 'neu-merc-archer', name: '佣兵弓手', cost: 2, rarity: 'basic', pool: X, icon: 'bow-arrow', up: { unit: { hp: 8, ac: 12, atk: 5, dmg: '1d8+1', range: 4, move: 3, tribe: ['humanoid'], fx: 'arrow' } } },
    { hp: 7, ac: 12, atk: 4, dmg: '1d8', range: 3, move: 3, tribe: ['humanoid'], fx: 'arrow' },
  ),
  unit(
    { id: 'neu-dwarf', name: '矮人盾卫', cost: 3, rarity: 'common', pool: X, icon: 'dwarf-helmet', text: '矮人韧性：抗性毒素。', up: { unit: { hp: 17, ac: 15, atk: 5, dmg: '1d8+3', range: 1, move: 2, kw: { shield: 1, fortify: 1 }, tribe: ['humanoid'], resist: ['poison'], fx: 'smash' } } },
    { hp: 14, ac: 15, atk: 4, dmg: '1d8+2', range: 1, move: 2, kw: { shield: 1 }, tribe: ['humanoid'], resist: ['poison'], saves: { fort: 4, ref: 0, will: 1 }, fx: 'smash' },
  ),
  unit(
    { id: 'neu-gunner', name: '火药枪手', cost: 3, rarity: 'common', pool: X, icon: 'musket', text: '【破甲 2】：无视 2 点 AC。', up: { unit: { hp: 9, ac: 12, atk: 5, dmg: '1d12+1', range: 4, move: 3, kw: { pierceArmor: 2 }, tribe: ['humanoid'], fx: 'bolt' } } },
    { hp: 8, ac: 12, atk: 4, dmg: '1d12', range: 4, move: 3, kw: { pierceArmor: 2 }, tribe: ['humanoid'], fx: 'bolt' },
  ),
  unit(
    { id: 'neu-barbarian', name: '狂战士', cost: 4, rarity: 'common', pool: X, icon: 'barbarian', colors: 'blood', text: '生命低于一半时伤害 +4。', up: { unit: { hp: 21, ac: 13, atk: 6, dmg: '1d12+3', range: 1, move: 4, kw: { frenzy: 4, haste: 1 }, tribe: ['humanoid'], fx: 'slash' } } },
    { hp: 18, ac: 13, atk: 5, dmg: '1d12+3', range: 1, move: 4, kw: { frenzy: 4, haste: 1 }, tribe: ['humanoid'], saves: { fort: 4, ref: 1, will: 0 }, fx: 'slash' },
  ),
  unit(
    {
      id: 'neu-bard',
      name: '吟游诗人',
      cost: 3,
      rarity: 'rare',
      pool: X,
      icon: 'lyre',
      colors: 'arcane',
      text: '技能【激励之歌】：3 格内一个友方单位获得【祝福】2 回合并本回合伤害 +2。',
      up: { unit: { hp: 11, ac: 13, atk: 4, dmg: '1d6+2', range: 2, move: 4, tribe: ['humanoid'], fx: 'magic', ability: { name: '激励之歌', text: '祝福并激昂', icon: 'music-spell', target: { kind: 'unit', side: 'ally', range: 4 }, effects: [{ op: 'status', status: 'blessed', turns: 2 }, { op: 'status', status: 'inspired', turns: 1, value: 3 }], kind: 'buff' } } },
    },
    { hp: 10, ac: 13, atk: 4, dmg: '1d6+1', range: 2, move: 4, tribe: ['humanoid'], saves: { fort: 0, ref: 2, will: 3 }, fx: 'magic', ability: { name: '激励之歌', text: '祝福并激昂', icon: 'music-spell', target: { kind: 'unit', side: 'ally', range: 3 }, effects: [{ op: 'status', status: 'blessed', turns: 2 }, { op: 'status', status: 'inspired', turns: 1, value: 2 }], kind: 'buff' } },
  ),
  unit(
    { id: 'neu-ogre', name: '食人魔', cost: 5, rarity: 'common', pool: X, icon: 'ogre', colors: 'earth', text: '攻击【击退】1 格。', up: { unit: { hp: 30, ac: 12, atk: 6, dmg: '2d8+4', range: 1, move: 3, kw: { push: 1 }, tribe: ['giant'], fx: 'smash', scale: 1.3 } } },
    { hp: 26, ac: 11, atk: 6, dmg: '2d8+4', range: 1, move: 3, kw: { push: 1 }, tribe: ['giant'], saves: { fort: 5, ref: -1, will: -1 }, fx: 'smash', scale: 1.3 },
  ),
  unit(
    { id: 'neu-gargoyle', name: '石像鬼', cost: 4, rarity: 'common', pool: X, icon: 'gargoyle', colors: 'earth', text: '【截击】：敌人离开它身边时受到一次攻击，命中则停下。抗性物理。', up: { unit: { hp: 18, ac: 15, atk: 6, dmg: '1d8+3', range: 1, move: 4, kw: { flying: 1, sentinel: 1 }, tribe: ['construct'], resist: ['physical'], fx: 'claw' } } },
    { hp: 15, ac: 15, atk: 5, dmg: '1d8+2', range: 1, move: 4, kw: { flying: 1, sentinel: 1 }, tribe: ['construct'], resist: ['physical'], saves: { fort: 3, ref: 1, will: 1 }, fx: 'claw' },
  ),
  unit(
    { id: 'neu-captain', name: '佣兵团长', cost: 5, rarity: 'rare', pool: X, icon: 'warlord-helmet', text: '相邻友军 +1 AC、+1 命中。', up: { unit: { hp: 21, ac: 15, atk: 6, dmg: '1d10+3', range: 1, move: 3, kw: { auraAC: 1, auraAtk: 1, riposte: 1 }, tribe: ['humanoid'], fx: 'slash' } } },
    { hp: 18, ac: 15, atk: 5, dmg: '1d10+3', range: 1, move: 3, kw: { auraAC: 1, auraAtk: 1 }, tribe: ['humanoid'], saves: { fort: 3, ref: 1, will: 2 }, fx: 'slash' },
  ),
  unit(
    { id: 'neu-griffin', name: '狮鹫', cost: 5, rarity: 'rare', pool: X, icon: 'griffin-shield', colors: 'beast', up: { unit: { hp: 19, ac: 14, atk: 6, dmg: '2d6+3', range: 1, move: 7, kw: { flying: 1, charge: 2 }, tribe: ['beast'], fx: 'claw', scale: 1.2 } } },
    { hp: 17, ac: 13, atk: 5, dmg: '2d6+2', range: 1, move: 6, kw: { flying: 1 }, tribe: ['beast'], saves: { fort: 3, ref: 3, will: 0 }, fx: 'claw', scale: 1.2 },
  ),
  unit(
    { id: 'neu-wisp', name: '鬼火', cost: 1, rarity: 'common', pool: X, icon: 'candle-flame', colors: 'storm', text: '闪电攻击，可引发水面感电。', up: { unit: { hp: 4, ac: 16, atk: 5, dmg: '1d6', dmgType: 'lightning', range: 2, move: 5, kw: { flying: 1 }, tribe: ['fey'], fx: 'lightning' } } },
    { hp: 3, ac: 15, atk: 4, dmg: '1d4+1', dmgType: 'lightning', range: 2, move: 5, kw: { flying: 1 }, tribe: ['fey'], fx: 'lightning' },
  ),
  unit(
    { id: 'neu-mimic', name: '宝箱怪', cost: 3, rarity: 'rare', pool: X, icon: 'mimic-chest', colors: 'gold', text: '入场潜行。遗言：抽 1 张牌。', up: { unit: { hp: 14, ac: 13, atk: 6, dmg: '2d6+2', range: 1, move: 3, kw: { stealth: 1 }, tribe: ['aberration'], triggers: [{ on: 'death', effects: [{ op: 'draw', n: 2 }] }], fx: 'bite' }, text: '入场潜行。遗言：抽 2 张牌。' } },
    { hp: 12, ac: 13, atk: 5, dmg: '2d6+1', range: 1, move: 3, kw: { stealth: 1 }, tribe: ['aberration'], triggers: [{ on: 'death', effects: [{ op: 'draw', n: 1 }] }], fx: 'bite' },
  ),
  // ------------------------------------------------------------- spells
  spell(
    { id: 'neu-shove', name: '推撞', cost: 1, rarity: 'basic', pool: X, icon: 'push', colors: 'earth', tags: ['highground'], text: '将英雄 2 格内一个敌人推开 {dist} 格。从 2 层以上高处坠落会受伤并倒地；撞到障碍双方受 1d4。', params: { dist: 2 }, up: { params: { dist: 3 } } },
    { kind: 'unit', side: 'enemy', range: 2 },
    [{ op: 'fx', kind: 'shove' }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); const t = tgtUnit(ctx); if (t) await b.push(t, b.hero(ctx.player), Number(ctx.params.dist)); } }],
  ),
  spell(
    { id: 'neu-scout', name: '侦察', cost: 1, rarity: 'basic', pool: X, icon: 'spyglass', text: '抽 1 张牌，你的所有单位本回合 +1 移动。', up: { cost: 0 } },
    T.none,
    [{ op: 'draw', n: 1 }, { op: 'buff', stat: 'move', amount: 1, turns: 1, to: 'allAllies' }],
  ),
  spell(
    { id: 'neu-healscroll', name: '治疗卷轴', cost: 2, rarity: 'basic', pool: X, icon: 'scroll-unfurled', colors: 'holy', tags: ['heal'], text: '为一个友方单位回复 {heal}。', params: { heal: '2d8+2' }, up: { params: { heal: '3d8+3' } } },
    T.ally(),
    [{ op: 'heal', amount: '$heal' }],
  ),
  spell(
    { id: 'neu-warhorn', name: '战争号角', cost: 2, rarity: 'common', pool: X, icon: 'trumpet-flag', text: '所有友方单位本回合【激昂】：伤害 +{dmg}。', params: { dmg: 2 }, up: { params: { dmg: 3 } } },
    T.none,
    [{ op: 'fx', kind: 'rally' }, { op: 'status', status: 'inspired', turns: 1, value: '$dmg', to: 'allAllies' }],
  ),
  spell(
    { id: 'neu-foresight', name: '先见', cost: 2, rarity: 'rare', pool: X, icon: 'crystal-ball', colors: 'arcane', text: '所有友方单位获得【祝福】2 回合，抽 1 张牌。', up: { cost: 1 } },
    T.none,
    [{ op: 'fx', kind: 'holyNova' }, { op: 'status', status: 'blessed', turns: 2, to: 'allAllies' }, { op: 'draw', n: 1 }],
  ),
  spell(
    { id: 'neu-quake', name: '地震术', cost: 5, rarity: 'epic', pool: X, icon: 'earth-crack', colors: 'earth', tags: ['highground'], text: '5×5 区域地面剧烈起伏（随机 ±1 层），其中的敌人反射豁免失败则受 2d6 伤害并【倒地】。', up: { cost: 4 } },
    { kind: 'tile', range: 6, radius: 2 },
    [
      { op: 'fx', kind: 'quake' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          if (!ctx.targetPos) return;
          const changed: { x: number; y: number; h: number }[] = [];
          for (const t of b.board.area(ctx.targetPos, 2)) {
            if (t.terrain === 'deep' || t.terrain === 'lava' || t.terrain === 'water') continue;
            const d = b.rng.int(-1, 1);
            if (!d) continue;
            t.h = Math.max(0, Math.min(5, t.h + d));
            changed.push({ x: t.x, y: t.y, h: t.h });
          }
          if (changed.length) await b.emit({ t: 'height', tiles: changed });
          for (const e of b.enemiesOf(ctx.player)) {
            if (Math.max(Math.abs(e.x - ctx.targetPos.x), Math.abs(e.y - ctx.targetPos.y)) > 2) continue;
            const r = await b.savingThrow(e, 'ref', b.player(ctx.player).spellDC, ctx.player, '地震');
            if (!r.success) {
              await b.damage(e, b.rollNumber('2d6'), 'physical', null, { label: '地震' });
              if (!e.dead) await b.addStatus(e, 'prone', 1);
            }
          }
        },
      },
    ],
  ),
  spell(
    { id: 'neu-holywater', name: '圣水', cost: 1, rarity: 'common', pool: X, icon: 'holy-water', colors: 'holy', tags: ['radiant'], text: '3×3 区域生成【圣光地面】2 回合；其中的亡灵与邪魔受到 {dmg} 光耀伤害。', params: { dmg: '2d6' }, up: { params: { dmg: '3d6' } } },
    T.tile(5, 1),
    [
      { op: 'fx', kind: 'holy' },
      { op: 'surface', surface: 'holy', turns: 2 },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          if (!ctx.targetPos) return;
          const dmg = b.rollNumber(String(ctx.params.dmg));
          for (const t of b.board.area(ctx.targetPos, 1)) {
            const u = b.unitAt(t.x, t.y);
            if (u && b.hostile(ctx.player, u.owner) && (u.tribe.includes('undead') || u.tribe.includes('fiend'))) await b.damage(u, dmg, 'radiant', b.hero(ctx.player), { label: '圣水' });
          }
        },
      },
    ],
  ),
  // ------------------------------------------------------------- terrain
  terrain(
    { id: 'neu-circle', name: '召唤法阵', cost: 2, rarity: 'rare', pool: X, icon: 'pentagram-rose', colors: 'arcane', text: '在英雄 4 格内的空地上绘制一座属于你的【召唤法阵】：你可以在它周围召唤单位。', up: { cost: 1 } },
    { kind: 'tile', range: 4, empty: true },
    [
      { op: 'fx', kind: 'summonCircle' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          if (!ctx.targetPos) return;
          const t = b.board.get(ctx.targetPos);
          if (t.node) return;
          t.node = { kind: 'gate', owner: ctx.player };
          await b.emit({ t: 'capture', pos: ctx.targetPos, kind: 'gate', owner: ctx.player, prev: null });
        },
      },
    ],
  ),
  terrain(
    { id: 'neu-wellspring', name: '涌泉术', cost: 3, rarity: 'epic', pool: X, icon: 'fountain', colors: 'frost', text: '在英雄 2 格内的空地上召出一座属于你的【法力泉】。', up: { cost: 2 } },
    { kind: 'tile', range: 2, empty: true },
    [
      { op: 'fx', kind: 'arcane' },
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          if (!ctx.targetPos) return;
          const t = b.board.get(ctx.targetPos);
          if (t.node) return;
          t.node = { kind: 'well', owner: ctx.player };
          await b.emit({ t: 'capture', pos: ctx.targetPos, kind: 'well', owner: ctx.player, prev: null });
        },
      },
    ],
  ),
  terrain(
    { id: 'neu-stonewall', name: '石墙术', cost: 2, rarity: 'common', pool: X, icon: 'stone-wall', colors: 'earth', tags: ['highground'], text: '英雄朝一个方向升起 {len} 格石墙（阻挡移动与视线；有单位的格子跳过）。', params: { len: 3 }, up: { params: { len: 4 }, target: { kind: 'tile', line: 4 } } },
    T.line(3),
    [{ op: 'fx', kind: 'quake' }, { op: 'terrain', terrain: 'rock' }],
  ),
  terrain(
    { id: 'neu-firewall', name: '火墙术', cost: 3, rarity: 'common', pool: X, icon: 'fire-wave', colors: 'fire', tags: ['fire'], text: '英雄朝一个方向燃起 4 格【火焰地面】3 回合，路径上的单位受到 {dmg} 火焰伤害（反射减半）。', params: { dmg: '2d6' }, up: { params: { dmg: '3d6' } } },
    T.line(4),
    [{ op: 'fx', kind: 'firewall' }, { op: 'damage', amount: '$dmg', dmgType: 'fire', save: { type: 'ref', half: true } }, { op: 'surface', surface: 'fire', turns: 3 }],
  ),
  terrain(
    { id: 'neu-iceslick', name: '冰面术', cost: 1, rarity: 'common', pool: X, icon: 'ice-cube', colors: 'frost', tags: ['frost'], text: '3×3 区域结成【冰面】3 回合（停在上面需反射 DC 10，失败倒地），浅水冻结可通行。', up: { cost: 0 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'freeze' }, { op: 'surface', surface: 'ice', turns: 3 }],
  ),
  terrain(
    { id: 'neu-spring', name: '治愈之泉', cost: 2, rarity: 'rare', pool: X, icon: 'drink-me', colors: 'poison', tags: ['heal'], text: '在 3 格内的空地上召出【治愈泉】：回合开始时站在上面的单位回复 3 生命。', up: { cost: 1 } },
    { kind: 'tile', range: 3, empty: true },
    [{ op: 'fx', kind: 'heal' }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); if (!ctx.targetPos) return; const t = b.board.get(ctx.targetPos); if (t.node) return; t.node = { kind: 'spring', owner: null }; await b.emit({ t: 'capture', pos: ctx.targetPos, kind: 'spring', owner: null, prev: null }); } }],
  ),
  // ------------------------------------------------------------- equipment
  equip(
    { id: 'neu-longsword', name: '精钢长剑', cost: 1, rarity: 'basic', pool: X, icon: 'broadsword', text: '攻击额外造成 1d4 伤害。', up: { text: '+1 命中，攻击额外造成 1d4 伤害。', equip: { atk: 1, dmg: '1d4' } } },
    { dmg: '1d4' },
  ),
  equip(
    { id: 'neu-chainmail', name: '锁子甲', cost: 2, rarity: 'basic', pool: X, icon: 'chain-mail', text: '+2 AC。', up: { text: '+2 AC，+4 生命。', equip: { ac: 2, hp: 4 } } },
    { ac: 2 },
  ),
  equip(
    { id: 'neu-greatsword', name: '双手巨剑', cost: 3, rarity: 'common', pool: X, icon: 'sword-spin', text: '仅限近战：攻击额外造成 1d8 伤害，获得【横扫】。', up: { cost: 2 } },
    { dmg: '1d8', kw: { cleave: 1 }, onlyMelee: true },
  ),
  equip(
    { id: 'neu-claws', name: '攀爬钩爪', cost: 1, rarity: 'common', pool: X, icon: 'mountain-climbing', tags: ['highground'], text: '攀爬 +2（可以一步爬上更高的悬崖），+1 移动。', up: { cost: 0 } },
    { jump: 2, move: 1 },
  ),
  equip(
    { id: 'neu-mithril', name: '秘银锁甲', cost: 3, rarity: 'rare', pool: X, icon: 'layered-armor', colors: 'frost', text: '+3 AC，获得 1 层【护盾】。', up: { cost: 2 } },
    { ac: 3, kw: { ward: 1 } },
  ),
  equip(
    { id: 'neu-fang', name: '吸血獠牙', cost: 2, rarity: 'rare', pool: X, icon: 'fangs', colors: 'blood', text: '获得【吸血】：造成伤害时回复等量生命。', up: { cost: 1 } },
    { kw: { lifesteal: 1 } },
  ),
  equip(
    { id: 'neu-wings', name: '鹰翼披风', cost: 3, rarity: 'epic', pool: X, icon: 'wing-cloak', colors: 'storm', tags: ['highground'], text: '获得【飞行】与 +1 移动。', up: { cost: 2 } },
    { kw: { flying: 1 }, move: 1 },
  ),
];

// ------------------------------------------------------------- tokens
export const TOKEN_CARDS: CardDef[] = [
  unit({ id: 'tok-skeleton', name: '骷髅兵', cost: 1, rarity: 'token', pool: 'token', icon: 'skeleton', colors: 'undead' }, { hp: 6, ac: 13, atk: 4, dmg: '1d6+1', range: 1, move: 3, tribe: ['undead'], vuln: ['radiant'], fx: 'slash' }),
  unit({ id: 'tok-wolfpup', name: '幼狼', cost: 1, rarity: 'token', pool: 'token', icon: 'wolf-head', colors: 'beast' }, { hp: 5, ac: 12, atk: 3, dmg: '1d4+2', range: 1, move: 5, kw: { pack: 1 }, tribe: ['beast'], fx: 'bite', scale: 0.85 }),
  unit({ id: 'tok-wolfpup-haste', name: '幼狼', cost: 1, rarity: 'token', pool: 'token', icon: 'wolf-head', colors: 'beast' }, { hp: 5, ac: 12, atk: 3, dmg: '1d4+2', range: 1, move: 5, kw: { pack: 1, haste: 1 }, tribe: ['beast'], fx: 'bite', scale: 0.85 }),
  unit({ id: 'tok-cutpurse', name: '扒手', cost: 1, rarity: 'token', pool: 'token', icon: 'cloak-dagger', colors: 'shadow' }, { hp: 5, ac: 13, atk: 4, dmg: '1d4+2', range: 1, move: 5, kw: { stealth: 1, sneak: 1 }, tribe: ['humanoid'], fx: 'slash' }),
  unit({ id: 'tok-crawler', name: '爬行残躯', cost: 0, rarity: 'token', pool: 'token', icon: 'crossed-bones', colors: 'undead' }, { hp: 3, ac: 10, atk: 2, dmg: '1d4', range: 1, move: 2, tribe: ['undead'], fx: 'claw', scale: 0.75 }),
  unit({ id: 'tok-lightguard', name: '光之卫士', cost: 1, rarity: 'token', pool: 'token', icon: 'spiked-halo', colors: 'holy' }, { hp: 6, ac: 13, atk: 4, dmg: '1d6+1', dmgType: 'radiant', range: 1, move: 4, kw: { ward: 1 }, tribe: ['celestial'], fx: 'holy', scale: 0.9 }),
  unit({ id: 'tok-goblin', name: '哥布林喽啰', cost: 1, rarity: 'token', pool: 'token', icon: 'goblin-head', colors: 'goblin' }, { hp: 4, ac: 12, atk: 3, dmg: '1d6', range: 1, move: 4, tribe: ['goblinoid'], fx: 'slash', scale: 0.8 }),
  unit({ id: 'tok-imp', name: '小恶魔', cost: 1, rarity: 'token', pool: 'token', icon: 'imp', colors: 'fire' }, { hp: 4, ac: 13, atk: 4, dmg: '1d4+1', dmgType: 'fire', range: 2, move: 5, kw: { flying: 1 }, tribe: ['fiend'], immune: ['fire'], fx: 'fire', scale: 0.8 }),
  unit({ id: 'tok-tentacle', name: '虚空触手', cost: 1, rarity: 'token', pool: 'token', icon: 'tentacle-strike', colors: 'void' }, { hp: 8, ac: 12, atk: 5, dmg: '1d8', dmgType: 'psychic', range: 1, move: 0, kw: { immobile: 1, reach: 1 }, tribe: ['aberration'], triggers: [{ on: 'hit', effects: [{ op: 'status', status: 'rooted', turns: 1, to: 'target' }] }], fx: 'shadow' }),
  unit({ id: 'tok-die', name: '活化骰子', cost: 1, rarity: 'token', pool: 'token', icon: 'perspective-dice-six', colors: 'dice' }, { hp: 6, ac: 14, atk: 5, dmg: '1d6+1', range: 1, move: 4, kw: { lucky: 1 }, tribe: ['construct'], fx: 'smash', scale: 0.8 }),
];

// ------------------------------------------------------------- curses
export const CURSE_CARDS: CardDef[] = [
  { id: 'curse-misfortune', name: '厄运', type: 'curse', cost: 0, rarity: 'curse', pool: 'curse', icon: 'cursed-star', colors: ['#0a0a0a', '#3a1a1a', '#ff9a9a'], text: '无法打出。在手牌中时，你的所有 d20 检定 -1。', unplayable: true },
  { id: 'curse-exhaustion', name: '疲惫', type: 'curse', cost: 0, rarity: 'curse', pool: 'curse', icon: 'tired-eye', colors: ['#0a0a0a', '#2a2a3a', '#c8c8ff'], text: '无法打出。回合结束时若在手牌中，你的英雄失去 1 点生命。', unplayable: true },
  { id: 'curse-shame', name: '羞耻', type: 'curse', cost: 1, rarity: 'curse', pool: 'curse', icon: 'despair', colors: ['#0a0a0a', '#3a2a1a', '#ffd0a0'], text: '支付 1 点法力：移除本卡直到战斗结束。', exhaust: true, effects: [], target: { kind: 'none' } },
  { id: 'curse-debt', name: '赌债', type: 'curse', cost: 0, rarity: 'curse', pool: 'curse', icon: 'receive-money', colors: ['#0a0a0a', '#3a321a', '#ffe08a'], text: '无法打出。占据手牌位置。商店可以花钱移除。', unplayable: true },
];
