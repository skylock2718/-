import type { PassiveDef } from '../core/registry';
import { cheb } from '../core/board';
import { getCard } from '../core/registry';

/**
 * Relics, feats, hero passives and boss traits. All are "passives" that hook
 * into the battle engine; run-level fields are read by the expedition layer.
 */

// ------------------------------------------------------------------ hero
const HERO_PASSIVES: PassiveDef[] = [
  {
    id: 'hero-paladin',
    name: '守护灵光',
    text: '英雄身边的友方单位豁免检定 +2。',
    icon: 'holy-symbol',
    kind: 'hero',
    saveBonus: (b, u, _t, owner) => {
      const h = b.hero(owner.id);
      return !h.dead && u.owner === owner.id && cheb(h, u) <= 1 ? 2 : 0;
    },
  },
  { id: 'hero-ranger', name: '鹰眼', text: '英雄具有高地专精与攀爬 2。', icon: 'eagle-head', kind: 'hero' },
  { id: 'hero-wizard', name: '塑能', text: '你的法术永远不会伤害友方单位。', icon: 'magic-swirl', kind: 'hero', sculpt: true },
  {
    id: 'hero-rogue',
    name: '命运之子',
    text: '命运点上限 +1；每当你掷出天然 20，抽 1 张牌。',
    icon: 'clover',
    kind: 'hero',
    maxFate: 1,
    onNat20: async (b, p) => {
      await b.draw(p.id, 1);
    },
  },
  {
    id: 'hero-necro',
    name: '灵魂收割',
    text: '每回合首次有友方单位阵亡时，获得 1 点法力。',
    icon: 'soul-vessel',
    kind: 'hero',
    onAllyDeath: async (b, _u, owner) => {
      if (owner.flags.harvest === b.turn) return;
      owner.flags.harvest = b.turn;
      if (b.active === owner.id) {
        await b.gainMana(owner.id, 1);
        await b.say('灵魂收割：获得 1 点法力', 'info');
      }
    },
  },
];

// ------------------------------------------------------------------ relics
const RELICS: PassiveDef[] = [
  // ---- starters
  {
    id: 'relic-holysymbol',
    name: '圣徽',
    text: '每场战斗开始时，你的英雄获得 1 层【护盾】。',
    icon: 'holy-symbol',
    kind: 'relic',
    rarity: 'starter',
    hero: 'paladin',
    battleStart: async (b, p) => {
      await b.grantKeyword(b.hero(p.id), 'ward', 1, 99);
    },
  },
  {
    id: 'relic-spyglass',
    name: '鹰眼望远镜',
    text: '你的单位从高处攻击低处目标时，伤害 +1。',
    icon: 'spyglass',
    kind: 'relic',
    rarity: 'starter',
    hero: 'ranger',
    damageBonus: (b, att, tgt) => (b.tileOf(att).h > b.tileOf(tgt).h ? 1 : null),
  },
  {
    id: 'relic-catalyst',
    name: '元素催化剂',
    text: '你的火焰、冰霜、闪电法术伤害 +1。',
    icon: 'fizzing-flask',
    kind: 'relic',
    rarity: 'starter',
    hero: 'wizard',
    spellBonus: (_b, t) => (t === 'fire' || t === 'cold' || t === 'lightning' ? 1 : 0),
  },
  { id: 'relic-luckycoin', name: '幸运金币', text: '每场战斗开始时额外获得 1 命运点。', icon: 'crown-coin', kind: 'relic', rarity: 'starter', hero: 'rogue', startFate: 1 },
  {
    id: 'relic-boneflute',
    name: '骨笛',
    text: '每场战斗开始时，在英雄身边召唤一名【骷髅兵】。',
    icon: 'flute',
    kind: 'relic',
    rarity: 'starter',
    hero: 'necro',
    battleStart: async (b, p) => {
      const h = b.hero(p.id);
      const spot = b.board.neighbors8(h).find((t) => b.board.standable(t) && !b.unitAt(t.x, t.y));
      if (spot) await b.summon(p.id, getCard('tok-skeleton'), spot, null, { token: true, silent: true });
    },
  },
  // ---- common
  {
    id: 'relic-loadeddie',
    name: '灌铅骰子',
    text: '每场战斗中你的第一次攻击检定必定掷出天然 20。',
    icon: 'dice-twenty-faces-twenty',
    kind: 'relic',
    rarity: 'common',
    forceNat: (_b, p, kind) => {
      if (kind !== 'attack' || p.flags.loaded) return null;
      p.flags.loaded = 1;
      return 20;
    },
  },
  { id: 'relic-rabbitfoot', name: '兔子脚', text: '你的英雄具有【幸运】：重掷天然 1。', icon: 'rabbit-head', kind: 'relic', rarity: 'common', lucky: (_b, u) => u.isHero },
  { id: 'relic-manaprism', name: '法力棱镜', text: '每场战斗开始时法力上限 +1。', icon: 'crystal-growth', kind: 'relic', rarity: 'common', startMana: 1 },
  { id: 'relic-anvil', name: '矮人铁砧', text: '你的装备牌费用 -1。', icon: 'anvil', kind: 'relic', rarity: 'common', cardCost: (_b, _p, c) => (c.type === 'equip' ? -1 : 0) },
  {
    id: 'relic-banner',
    name: '褪色军旗',
    text: '你召唤的单位 +2 生命上限。',
    icon: 'vertical-banner',
    kind: 'relic',
    rarity: 'common',
    onSummon: async (b, u) => {
      u.maxHp += 2;
      u.hp += 2;
      await b.emit({ t: 'heal', uid: u.uid, amount: 2, hp: u.hp, maxHp: u.maxHp });
    },
  },
  { id: 'relic-whetstone', name: '磨刀石', text: '你的英雄攻击伤害 +1。', icon: 'stone-sphere', kind: 'relic', rarity: 'common', damageBonus: (_b, att) => (att.isHero ? 1 : null) },
  { id: 'relic-pack', name: '旅行者背包', text: '每场战斗起始手牌 +1。', icon: 'backpack', kind: 'relic', rarity: 'common', handSize: 1 },
  { id: 'relic-herbs', name: '治疗草药', text: '每场战斗胜利后回复 5 点生命。', icon: 'herbs-bundle', kind: 'relic', rarity: 'common', afterBattleHeal: 5 },
  { id: 'relic-clover', name: '四叶草', text: '命运点上限 +1。', icon: 'clover', kind: 'relic', rarity: 'common', maxFate: 1 },
  {
    id: 'relic-pick',
    name: '登山镐',
    text: '你的所有单位攀爬 +1。',
    icon: 'mountain-climbing',
    kind: 'relic',
    rarity: 'common',
    battleStart: (b, p) => {
      b.hero(p.id).kw.climb = (b.hero(p.id).kw.climb ?? 0) + 1;
    },
    onSummon: (_b, u) => {
      u.kw.climb = (u.kw.climb ?? 0) + 1;
    },
  },
  {
    id: 'relic-hawkamulet',
    name: '鹰眼护符',
    text: '你的远程攻击无视森林掩体。',
    icon: 'feather-necklace',
    kind: 'relic',
    rarity: 'common',
    attackMods: (b, att, tgt, mods) => {
      if (b.isRanged(att) && b.tileOf(tgt).terrain === 'forest') mods.push({ label: '鹰眼护符', value: 2 });
    },
  },
  {
    id: 'relic-map',
    name: '寻宝图',
    text: '每占领一个资源点，获得 6 金币。',
    icon: 'treasure-map',
    kind: 'relic',
    rarity: 'common',
    onCapture: async (b, p) => {
      p.gold += 6;
      await b.emit({ t: 'gold', player: p.id, amount: 6 });
    },
  },
  { id: 'relic-boots', name: '迅捷长靴', text: '你的英雄 +1 移动。', icon: 'boots', kind: 'relic', rarity: 'common', heroMove: 1 },
  { id: 'relic-helm', name: '守护头盔', text: '你的英雄 +1 AC。', icon: 'crested-helmet', kind: 'relic', rarity: 'common', heroAc: 1 },
  {
    id: 'relic-warpaint',
    name: '战纹颜料',
    text: '你召唤的单位 +1 命中。',
    icon: 'paint-brush',
    kind: 'relic',
    rarity: 'common',
    onSummon: (_b, u) => {
      u.atk += 1;
    },
  },
  { id: 'relic-thieftools', name: '盗贼工具', text: '所有技能检定（事件与战场宝箱）+3。', icon: 'lockpicks', kind: 'relic', rarity: 'common', checkBonus: 3 },
  { id: 'relic-purse', name: '鼓胀钱袋', text: '拾取时获得 60 金币；战斗金币 +15%。', icon: 'swap-bag', kind: 'relic', rarity: 'common', pickupGold: 60, goldBonus: 15 },
  // ---- uncommon
  { id: 'relic-icosa', name: '二十面神像', text: '你的所有单位暴击范围 +1（天然 19~20 暴击）。', icon: 'dice-twenty-faces-one', kind: 'relic', rarity: 'uncommon', critBonus: () => 1 },
  {
    id: 'relic-twindice',
    name: '双生骰',
    text: '你的英雄从高处攻击时获得优势。',
    icon: 'dice-six-faces-six',
    kind: 'relic',
    rarity: 'uncommon',
    attackMods: (b, att, tgt, mods) => {
      if (att.isHero && b.tileOf(att).h > b.tileOf(tgt).h) mods.push({ label: '双生骰', adv: 1 });
    },
  },
  {
    id: 'relic-chalice',
    name: '血之圣杯',
    text: '你的单位每击杀一个敌人，你的英雄回复 2 生命。',
    icon: 'jeweled-chalice',
    kind: 'relic',
    rarity: 'uncommon',
    onKill: async (b, _k, _v, owner) => {
      await b.heal(b.hero(owner.id), 2);
    },
  },
  {
    id: 'relic-ember',
    name: '炽焰之心',
    text: '你造成的火焰伤害 +2。',
    icon: 'fire-gem',
    kind: 'relic',
    rarity: 'uncommon',
    spellBonus: (_b, t) => (t === 'fire' ? 2 : 0),
    damageBonus: (_b, att) => (att.dmgType === 'fire' ? 2 : null),
  },
  {
    id: 'relic-thunderhorn',
    name: '雷霆之角',
    text: '你造成的闪电伤害 +2。',
    icon: 'lightning-trio',
    kind: 'relic',
    rarity: 'uncommon',
    spellBonus: (_b, t) => (t === 'lightning' ? 2 : 0),
    damageBonus: (_b, att) => (att.dmgType === 'lightning' ? 2 : null),
  },
  {
    id: 'relic-frostgem',
    name: '霜心宝石',
    text: '你造成的冰霜伤害 +2。',
    icon: 'crystal-cluster',
    kind: 'relic',
    rarity: 'uncommon',
    spellBonus: (_b, t) => (t === 'cold' ? 2 : 0),
    damageBonus: (_b, att) => (att.dmgType === 'cold' ? 2 : null),
  },
  {
    id: 'relic-deadbook',
    name: '亡者之书',
    text: '每当你的非衍生单位阵亡，有 35% 几率在原地召唤一名【骷髅兵】。',
    icon: 'evil-book',
    kind: 'relic',
    rarity: 'uncommon',
    onAllyDeath: async (b, u, owner) => {
      if (u.token || !b.rng.chance(0.35)) return;
      await b.emit({ t: 'fx', kind: 'raise', to: { x: u.x, y: u.y } });
      await b.summon(owner.id, getCard('tok-skeleton'), { x: u.x, y: u.y }, null, { token: true, silent: true });
    },
  },
  {
    id: 'relic-packtotem',
    name: '狼群图腾',
    text: '你的野兽获得【群狼战术】与 +1 移动。',
    icon: 'totem',
    kind: 'relic',
    rarity: 'uncommon',
    onSummon: (_b, u) => {
      if (u.tribe.includes('beast')) {
        u.kw.pack = 1;
        u.move += 1;
      }
    },
  },
  { id: 'relic-spindle', name: '命运纺锤', text: '命运点上限 +2。', icon: 'sewing-needle', kind: 'relic', rarity: 'uncommon', maxFate: 2 },
  { id: 'relic-wellheart', name: '泉源之心', text: '每座法力泉额外提供 1 点法力。', icon: 'water-drop', kind: 'relic', rarity: 'uncommon', nodeIncome: (_b, _p, k) => (k === 'well' ? 1 : 0) },
  { id: 'relic-shrinebell', name: '神龛铜铃', text: '每座命运神龛额外提供 1 命运点。', icon: 'ringing-bell', kind: 'relic', rarity: 'uncommon', nodeIncome: (_b, _p, k) => (k === 'shrine' ? 1 : 0) },
  { id: 'relic-torc', name: '狂战士项圈', text: '你的英雄生命不高于一半时，攻击伤害 +3。', icon: 'gem-necklace', kind: 'relic', rarity: 'uncommon', damageBonus: (_b, att) => (att.isHero && att.hp * 2 <= att.maxHp ? 3 : null) },
  { id: 'relic-mithril', name: '秘银内衬', text: '英雄 +1 AC，最大生命 +5。', icon: 'chain-mail', kind: 'relic', rarity: 'uncommon', heroAc: 1, heroHp: 5 },
  {
    id: 'relic-warhorn',
    name: '先锋号角',
    text: '你每回合召唤的第一个单位获得【疾驰】。',
    icon: 'french-horn',
    kind: 'relic',
    rarity: 'uncommon',
    onSummon: async (b, u, owner) => {
      if (owner.flags.horn === b.turn || b.active !== owner.id) return;
      owner.flags.horn = b.turn;
      await b.grantKeyword(u, 'haste', 1);
    },
  },
  { id: 'relic-runestone', name: '刻文石板', text: '你的法术豁免 DC +1。', icon: 'stone-tablet', kind: 'relic', rarity: 'uncommon', spellDC: 1 },
  { id: 'relic-quiver', name: '无尽箭袋', text: '你的远程单位伤害 +1。', icon: 'quiver', kind: 'relic', rarity: 'uncommon', damageBonus: (b, att) => (b.isRanged(att) ? 1 : null) },
  { id: 'relic-lifecrystal', name: '生命水晶', text: '你的回合开始时，英雄回复 1 生命。', icon: 'heart-bottle', kind: 'relic', rarity: 'uncommon', turnStart: async (b, p) => void (await b.heal(b.hero(p.id), 1)) },
  { id: 'relic-merchantcard', name: '商会徽章', text: '商店价格 -20%。', icon: 'scales', kind: 'relic', rarity: 'uncommon', shopDiscount: 20 },
  { id: 'relic-mapcase', name: '制图师书匣', text: '战斗卡牌奖励多一个选项。', icon: 'scroll-quill', kind: 'relic', rarity: 'uncommon', cardChoices: 1 },
  // ---- rare
  {
    id: 'relic-eye',
    name: '骰主之眼',
    text: '你的回合开始时掷 d20：15 以上获得 1 点法力。',
    icon: 'eye-of-horus',
    kind: 'relic',
    rarity: 'rare',
    turnStart: async (b, p) => {
      const v = b.rollNumber('1d20');
      if (v >= 15) {
        await b.gainMana(p.id, 1);
        await b.say(`骰主之眼：${v}，获得 1 点法力`, 'fate');
      }
    },
  },
  {
    id: 'relic-chaosdie',
    name: '混沌骰',
    text: '每回合开始时获得 1 点法力，然后掷 d6 触发一次狂野魔法（可好可坏）。',
    icon: 'dice-fire',
    kind: 'relic',
    rarity: 'boss',
    turnStart: async (b, p) => {
      await b.gainMana(p.id, 1);
      const v = b.rollNumber('1d6');
      const hero = b.hero(p.id);
      const enemies = b.enemiesOf(p.id);
      const allies = b.unitsOf(p.id);
      await b.emit({ t: 'float', uid: hero.uid, text: `混沌 ${v}`, tone: 'gold' });
      if (v === 1) await b.damage(hero, b.rollNumber('1d6'), 'arcane', null, { label: '狂野魔法' });
      else if (v === 2 && enemies.length) {
        const e = b.rng.pick(enemies);
        await b.emit({ t: 'fx', kind: 'lightning', from: { x: hero.x, y: hero.y }, to: { x: e.x, y: e.y } });
        await b.damage(e, b.rollNumber('2d6'), 'lightning', hero, { label: '狂野魔法' });
      } else if (v === 3 && allies.length) await b.addStatus(b.rng.pick(allies), 'blessed', 2);
      else if (v === 4 && enemies.length) await b.addStatus(b.rng.pick(enemies), 'baned', 2);
      else if (v === 5) await b.draw(p.id, 1);
      else if (v === 6) await b.gainFate(p.id, 1);
    },
  },
  { id: 'relic-hourglass', name: '时之沙漏', text: '每回合多抽 1 张牌；起始手牌 -1。', icon: 'hourglass', kind: 'relic', rarity: 'boss', drawPerTurn: 1, handSize: -1 },
  { id: 'relic-crown', name: '统御王冠', text: '法力上限 +1（最高可到 10）；但你无法换牌。', icon: 'crown', kind: 'relic', rarity: 'boss', startMana: 1, maxManaCap: 1, noReplace: true },
  { id: 'relic-thread', name: '命运之线', text: '每场战斗开始时额外获得 2 命运点。', icon: 'spinning-wheel', kind: 'relic', rarity: 'rare', startFate: 2, maxFate: 1 },
  {
    id: 'relic-phylactery',
    name: '命匣',
    text: '每次远征一次：英雄受到致命伤害时，以一半生命复活。',
    icon: 'soul-vessel',
    kind: 'relic',
    rarity: 'boss',
    onHeroLethal: async (b, p, hero) => {
      if (p.flags.phylactery) return false;
      p.flags.phylactery = 1;
      hero.hp = Math.ceil(hero.maxHp / 2);
      await b.emit({ t: 'banner', text: '命匣碎裂', sub: '灵魂被拉回了肉体', tone: 'good' });
      await b.emit({ t: 'heal', uid: hero.uid, amount: hero.hp, hp: hero.hp, maxHp: hero.maxHp });
      return true;
    },
  },
  { id: 'relic-phylactery-used', name: '碎裂的命匣', text: '它已经救过你一次了。', icon: 'broken-heart', kind: 'relic', rarity: 'event' },
  {
    id: 'relic-shard',
    name: '天命之骰碎片',
    text: '每当你掷出天然 20：获得 1 点法力并抽 1 张牌。',
    icon: 'crystal-shine',
    kind: 'relic',
    rarity: 'boss',
    onNat20: async (b, p) => {
      await b.gainMana(p.id, 1);
      await b.draw(p.id, 1);
    },
  },
  { id: 'relic-giantbelt', name: '巨人腰带', text: '英雄最大生命 +8，命中 +1。', icon: 'belt', kind: 'relic', rarity: 'boss', heroHp: 8, heroAtk: 1 },
  {
    id: 'relic-quickcast',
    name: '速咒戒指',
    text: '每场战斗中你打出的第一张法术牌费用为 0。',
    icon: 'ring',
    kind: 'relic',
    rarity: 'rare',
    cardCost: (_b, p, c) => (c.type === 'spell' && !p.flags.quickcast ? -99 : 0),
    onPlayCard: (_b, p, c) => {
      if (c.type === 'spell') p.flags.quickcast = 1;
    },
  },
  {
    id: 'relic-goblincrown',
    name: '哥布林王冠',
    text: '你的回合开始时，若你的非英雄单位不超过 2 个，召唤一名【哥布林喽啰】。',
    icon: 'crowned-skull',
    kind: 'relic',
    rarity: 'boss',
    turnStart: async (b, p) => {
      if (b.unitsOf(p.id).filter((u) => !u.isHero).length > 2) return;
      const h = b.hero(p.id);
      const spot = b.board.neighbors8(h).find((t) => b.board.standable(t) && !b.unitAt(t.x, t.y));
      if (spot) await b.summon(p.id, getCard('tok-goblin'), spot, null, { token: true, silent: true });
    },
  },
  // ---- event / cursed
  { id: 'relic-cursedidol', name: '诅咒神像', text: '英雄命中 +2；命运点上限 -1。', icon: 'totem-head', kind: 'relic', rarity: 'event', heroAtk: 2, maxFate: -1 },
  { id: 'relic-dragonhoard', name: '龙之宝藏', text: '拾取时获得 150 金币。', icon: 'gold-stack', kind: 'relic', rarity: 'event', pickupGold: 150 },
  { id: 'relic-witchbrew', name: '女巫的酿造', text: '药水栏位 +1。', icon: 'cauldron', kind: 'relic', rarity: 'event', potionSlots: 1 },
];

// ------------------------------------------------------------------ feats
const FEATS: PassiveDef[] = [
  { id: 'feat-lucky', name: '幸运儿', text: '命运点上限 +1，每场战斗开始额外获得 1 命运点。', icon: 'clover', kind: 'feat', maxFate: 1, startFate: 1 },
  {
    id: 'feat-sharpshooter',
    name: '神射手',
    text: '你的远程攻击无视低地劣势与森林掩体。',
    icon: 'arrow-scope',
    kind: 'feat',
    attackMods: (b, att, tgt, mods) => {
      if (!b.isRanged(att)) return;
      for (const m of mods) if ((m.label === '低地劣势' || m.label === '森林掩体') && m.value) m.value = 0;
      void tgt;
    },
  },
  { id: 'feat-gwm', name: '巨武器大师', text: '英雄近战攻击 19~20 暴击，伤害 +2。', icon: 'battle-axe', kind: 'feat', critBonus: (b, u) => (u.isHero && !b.isRanged(u) ? 1 : 0), damageBonus: (b, att) => (att.isHero && !b.isRanged(att) ? 2 : null) },
  { id: 'feat-tough', name: '坚韧', text: '最大生命 +10。', icon: 'muscle-up', kind: 'feat', heroHp: 10 },
  { id: 'feat-alert', name: '警觉', text: '起始手牌 +1，英雄 AC +1。', icon: 'sight-disabled', kind: 'feat', handSize: 1, heroAc: 1 },
  { id: 'feat-warcaster', name: '战争施法者', text: '你的法术伤害 +1，法术 DC +1。', icon: 'spell-book', kind: 'feat', spellBonus: () => 1, spellDC: 1 },
  {
    id: 'feat-commander',
    name: '指挥官',
    text: '你召唤的单位 +1 命中、+1 AC。',
    icon: 'knight-banner',
    kind: 'feat',
    onSummon: (_b, u) => {
      u.atk += 1;
      u.ac += 1;
    },
  },
  { id: 'feat-mobile', name: '机动', text: '英雄 +2 移动。', icon: 'run', kind: 'feat', heroMove: 2 },
  { id: 'feat-healer', name: '医者', text: '你的所有治疗效果 +2。', icon: 'health-increase', kind: 'feat', healBonus: () => 2 },
  {
    id: 'feat-elemental',
    name: '元素专精',
    text: '你造成的火焰、冰霜、闪电伤害 +2。',
    icon: 'triorb',
    kind: 'feat',
    spellBonus: (_b, t) => (t === 'fire' || t === 'cold' || t === 'lightning' ? 2 : 0),
    damageBonus: (_b, att) => (att.dmgType === 'fire' || att.dmgType === 'cold' || att.dmgType === 'lightning' ? 2 : null),
  },
  { id: 'feat-beastfriend', name: '驯兽师', text: '你的野兽人物牌费用 -1。', icon: 'paw-heart', kind: 'feat', cardCost: (_b, _p, c) => (c.type === 'unit' && c.unit?.tribe?.includes('beast') ? -1 : 0) },
  {
    id: 'feat-necromancy',
    name: '亡灵学者',
    text: '你的亡灵单位 +1 命中、+3 生命。',
    icon: 'skull-staff',
    kind: 'feat',
    onSummon: (_b, u) => {
      if (!u.tribe.includes('undead')) return;
      u.atk += 1;
      u.maxHp += 3;
      u.hp += 3;
    },
  },
  { id: 'feat-shieldmaster', name: '盾牌大师', text: '英雄 +2 AC。', icon: 'shield-reflect', kind: 'feat', heroAc: 2 },
  {
    id: 'feat-sentinel',
    name: '哨兵',
    text: '英雄获得【截击】：敌人离开英雄身边时受到一次攻击。',
    icon: 'guards',
    kind: 'feat',
    battleStart: (b, p) => {
      b.hero(p.id).kw.sentinel = 1;
    },
  },
  { id: 'feat-asi', name: '属性提升', text: '法术 DC +1，所有技能检定 +2。', icon: 'upgrade', kind: 'feat', spellDC: 1, checkBonus: 2 },
  { id: 'feat-gambler', name: '赌徒本色', text: '每当你掷出天然 1，获得 1 命运点。', icon: 'perspective-dice-one', kind: 'feat', onNat1: async (b, p) => void (await b.gainFate(p.id, 1)) },
  { id: 'feat-highground', name: '居高临下', text: '你的单位站在 2 层或更高处时 +1 AC。', icon: 'mountaintop', kind: 'feat', acBonus: (b, u) => (b.tileOf(u).h >= 2 ? 1 : 0) },
  { id: 'feat-inspiring', name: '激励领袖', text: '你的英雄获得【鼓舞 2】：相邻友军伤害 +2。', icon: 'trumpet-flag', kind: 'feat', battleStart: (b, p) => void (b.hero(p.id).kw.inspire = 2) },
];

// ------------------------------------------------------------------ boss / encounter traits
const BOSS: PassiveDef[] = [
  {
    id: 'boss-goblinking',
    name: '王之战鼓',
    text: '哥布林王每回合开始时召唤一名哥布林喽啰。',
    icon: 'drum',
    kind: 'boss',
    turnStart: async (b, p) => {
      if (b.unitsOf(p.id).length >= 8) return;
      const h = b.hero(p.id);
      const spot = b.board.area(h, 2).find((t) => b.board.standable(t) && !b.unitAt(t.x, t.y));
      if (spot) {
        await b.emit({ t: 'fx', kind: 'summon', to: spot });
        await b.summon(p.id, getCard('tok-goblin'), spot, null, { token: true, silent: true });
      }
    },
  },
  {
    id: 'boss-lich',
    name: '命匣',
    text: '巫妖第一次被击败时会以 25 生命复活；每两回合在墓地唤起骷髅。',
    icon: 'soul-vessel',
    kind: 'boss',
    onHeroLethal: async (b, p, hero) => {
      if (p.flags.phylactery) return false;
      p.flags.phylactery = 1;
      hero.hp = 25;
      await b.emit({ t: 'banner', text: '巫妖从命匣中重生！', sub: '它的灵魂并不在这具躯壳里', tone: 'boss' });
      await b.emit({ t: 'heal', uid: hero.uid, amount: 25, hp: hero.hp, maxHp: hero.maxHp });
      await b.cleanse(hero);
      return true;
    },
    turnStart: async (b, p) => {
      if (b.round % 2 !== 0) return;
      let n = 2;
      for (const g of [...b.graves].reverse()) {
        if (n <= 0) break;
        if (b.unitAt(g.x, g.y) || !b.board.standable(b.board.get(g))) continue;
        await b.emit({ t: 'fx', kind: 'raise', to: g });
        await b.summon(p.id, getCard('tok-skeleton'), g, null, { token: true, silent: true });
        n--;
      }
    },
  },
  {
    id: 'boss-dicemaster',
    name: '出千',
    text: '骰主每回合一次：强制重掷对手的天然 20。',
    icon: 'card-joker',
    kind: 'boss',
    opponentNat20: (b, _roller, owner) => {
      if (owner.flags.cheat === b.round) return false;
      owner.flags.cheat = b.round;
      return true;
    },
  },
  {
    id: 'boss-dicearena',
    name: '命运棋盘',
    text: '骰主回合开始时，棋盘上随机四块地面按 d4 重新升降。',
    icon: 'rolling-dices',
    kind: 'boss',
    turnStart: async (b) => {
      const cands = b.board.tiles.filter((t) => t.terrain === 'plain' && !t.node && !b.unitAt(t.x, t.y));
      const pick = b.rng.sample(cands, 4);
      const changed = pick.map((t) => {
        t.h = b.rng.int(0, 3);
        return { x: t.x, y: t.y, h: t.h };
      });
      if (changed.length) {
        await b.emit({ t: 'fx', kind: 'dice', area: changed.map((c) => ({ x: c.x, y: c.y })) });
        await b.emit({ t: 'height', tiles: changed });
      }
    },
  },
  {
    id: 'boss-gazer',
    name: '百眼射线',
    text: '回合开始时，向 5 格内两个随机敌人射出魔眼射线。',
    icon: 'all-seeing-eye',
    kind: 'boss',
    turnStart: async (b, p) => {
      const h = b.hero(p.id);
      const targets = b.rng.sample(
        b.enemiesOf(p.id).filter((e) => cheb(e, h) <= 5 && !b.has(e, 'hidden')),
        2,
      );
      for (const t of targets) {
        const v = b.rollNumber('1d4');
        await b.emit({ t: 'fx', kind: 'eyeRay', from: { x: h.x, y: h.y }, to: { x: t.x, y: t.y } });
        const r = await b.savingThrow(t, v === 1 ? 'fort' : v === 2 ? 'will' : 'ref', 14, p.id, '魔眼射线');
        if (r.success) continue;
        if (v === 1) await b.addStatus(t, 'slowed', 2);
        else if (v === 2) await b.addStatus(t, 'frightened', 2);
        else if (v === 3) await b.damage(t, b.rollNumber('2d8'), 'psychic', h, { label: '解离射线' });
        else await b.addStatus(t, 'stunned', 1);
      }
    },
  },
  { id: 'trait-elite', name: '精英', text: '指挥官 +1 命中。', icon: 'skull-crack', kind: 'modifier', heroAtk: 1 },
  { id: 'trait-asc-hp', name: '天命·坚韧', text: '敌方单位 +15% 生命。', icon: 'heart-plus', kind: 'modifier', onSummon: (_b, u) => void ((u.maxHp = Math.ceil(u.maxHp * 1.15)), (u.hp = u.maxHp)) },
  { id: 'trait-asc-atk', name: '天命·凶猛', text: '敌方单位 +1 命中。', icon: 'sword-wound', kind: 'modifier', onSummon: (_b, u) => void (u.atk += 1), heroAtk: 1 },
  { id: 'trait-asc-mana', name: '天命·狡诈', text: '敌方起始法力 +1。', icon: 'crystal-growth', kind: 'modifier', startMana: 1 },
];

export const PASSIVES: PassiveDef[] = [...HERO_PASSIVES, ...RELICS, ...FEATS, ...BOSS];
export const RELIC_LIST = RELICS;
export const FEAT_LIST = FEATS;
