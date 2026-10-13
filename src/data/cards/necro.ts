import type { CardDef } from '../../core/types';
import { getCard } from '../../core/registry';
import { B, equip, spell, T, tgtUnit, terrain, unit } from '../util';

const N = 'necro' as const;

export const NECRO_CARDS: CardDef[] = [
  unit(
    { id: 'nec-skeleton', name: '骷髅兵', cost: 1, rarity: 'basic', pool: N, icon: 'skeleton', colors: 'undead', tags: ['undead'], flavor: '咔哒，咔哒。', up: { unit: { hp: 7, ac: 13, atk: 4, dmg: '1d6+2', range: 1, move: 3, tribe: ['undead'], vuln: ['radiant'], fx: 'slash' } } },
    { hp: 6, ac: 13, atk: 4, dmg: '1d6+1', range: 1, move: 3, tribe: ['undead'], vuln: ['radiant'], saves: { fort: 1, ref: 1, will: 0 }, fx: 'slash' },
  ),
  unit(
    { id: 'nec-skelarcher', name: '骷髅弓手', cost: 2, rarity: 'basic', pool: N, icon: 'skull-crossed-bones', colors: 'undead', tags: ['undead'], up: { unit: { hp: 7, ac: 12, atk: 5, dmg: '1d8+1', range: 4, move: 3, tribe: ['undead'], vuln: ['radiant'], fx: 'arrow' } } },
    { hp: 6, ac: 12, atk: 4, dmg: '1d8', range: 3, move: 3, tribe: ['undead'], vuln: ['radiant'], fx: 'arrow' },
  ),
  unit(
    { id: 'nec-ghoul', name: '食尸鬼', cost: 2, rarity: 'common', pool: N, icon: 'shambling-zombie', colors: 'undead', tags: ['undead', 'sacrifice'], text: '击杀单位后：永久 +1 命中、+3 生命上限。', up: { unit: { hp: 11, ac: 12, atk: 5, dmg: '1d6+2', range: 1, move: 4, tribe: ['undead'], kw: { venom: 1 }, triggers: [{ on: 'kill', label: '饱餐', effects: [{ op: 'buff', stat: 'atk', amount: 1, to: 'self' }, { op: 'buff', stat: 'maxHp', amount: 3, to: 'self' }] }], fx: 'claw' } } },
    { hp: 9, ac: 12, atk: 4, dmg: '1d6+2', range: 1, move: 4, tribe: ['undead'], triggers: [{ on: 'kill', label: '饱餐', effects: [{ op: 'buff', stat: 'atk', amount: 1, to: 'self' }, { op: 'buff', stat: 'maxHp', amount: 3, to: 'self' }] }], fx: 'claw' },
  ),
  unit(
    { id: 'nec-zombie', name: '腐尸', cost: 2, rarity: 'basic', pool: N, icon: 'raise-zombie', colors: 'undead', tags: ['undead', 'sacrifice'], text: '遗言：召唤一只【爬行残躯】。', up: { unit: { hp: 16, ac: 10, atk: 4, dmg: '1d6+2', range: 1, move: 2, kw: { provoke: 1 }, tribe: ['undead'], triggers: [{ on: 'death', label: '残躯', effects: [{ op: 'summon', card: 'tok-crawler', count: 2, at: 'nearSelf' }] }], fx: 'smash' }, text: '遗言：召唤两只【爬行残躯】。' } },
    { hp: 14, ac: 9, atk: 3, dmg: '1d6+1', range: 1, move: 2, kw: { provoke: 1 }, tribe: ['undead'], triggers: [{ on: 'death', label: '残躯', effects: [{ op: 'summon', card: 'tok-crawler', count: 1, at: 'nearSelf' }] }], saves: { fort: 3, ref: -1, will: 0 }, fx: 'smash' },
  ),
  unit(
    { id: 'nec-wraith', name: '怨灵', cost: 3, rarity: 'common', pool: N, icon: 'floating-ghost', colors: 'void', tags: ['undead'], text: '攻击吸取生命（【吸血】）。', up: { unit: { hp: 11, ac: 13, atk: 6, dmg: '1d8+2', dmgType: 'necrotic', range: 1, move: 5, kw: { flying: 1, lifesteal: 1 }, tribe: ['undead'], resist: ['physical'], vuln: ['radiant'], fx: 'shadow' } } },
    { hp: 9, ac: 13, atk: 5, dmg: '1d8+2', dmgType: 'necrotic', range: 1, move: 5, kw: { flying: 1, lifesteal: 1 }, tribe: ['undead'], resist: ['physical'], vuln: ['radiant'], saves: { fort: 1, ref: 3, will: 3 }, fx: 'shadow' },
  ),
  unit(
    { id: 'nec-deathknight', name: '死亡骑士', cost: 5, rarity: 'rare', pool: N, icon: 'overlord-helm', colors: 'undead', tags: ['undead'], text: '【吸血】【反击】。', flavor: '他曾发誓守护王国。如今他仍在守护——守护它的坟墓。', up: { unit: { hp: 24, ac: 17, atk: 7, dmg: '1d10+4', dmgType: 'necrotic', range: 1, move: 3, kw: { lifesteal: 1, riposte: 1 }, tribe: ['undead'], vuln: ['radiant'], fx: 'shadow' } } },
    { hp: 20, ac: 17, atk: 6, dmg: '1d10+4', dmgType: 'necrotic', range: 1, move: 3, kw: { lifesteal: 1, riposte: 1 }, tribe: ['undead'], vuln: ['radiant'], saves: { fort: 4, ref: 0, will: 4 }, fx: 'shadow', scale: 1.1 },
  ),
  unit(
    { id: 'nec-reaper', name: '灵魂收割者', cost: 4, rarity: 'rare', pool: N, icon: 'grim-reaper', colors: 'void', tags: ['undead', 'sacrifice'], text: '每当另一个友方单位阵亡：+1 命中并回复 3 生命。', up: { unit: { hp: 16, ac: 14, atk: 6, dmg: '1d10+3', dmgType: 'necrotic', range: 1, move: 4, kw: { flying: 1, reach: 1 }, tribe: ['undead'], vuln: ['radiant'], triggers: [{ on: 'allyDeath', label: '收割', effects: [{ op: 'buff', stat: 'atk', amount: 1, to: 'self' }, { op: 'heal', amount: 3, to: 'self' }] }], fx: 'shadow' } } },
    { hp: 14, ac: 14, atk: 5, dmg: '1d10+2', dmgType: 'necrotic', range: 1, move: 4, kw: { flying: 1, reach: 1 }, tribe: ['undead'], vuln: ['radiant'], triggers: [{ on: 'allyDeath', label: '收割', effects: [{ op: 'buff', stat: 'atk', amount: 1, to: 'self' }, { op: 'heal', amount: 3, to: 'self' }] }], fx: 'shadow' },
  ),
  unit(
    { id: 'nec-colossus', name: '骸骨巨像', cost: 7, rarity: 'epic', pool: N, icon: 'dinosaur-bones', colors: 'undead', tags: ['undead', 'sacrifice'], text: '【横扫】【不屈】。登场：本场战斗每阵亡过一个单位，永久 +1 伤害（最多 +6）。', up: { cost: 6 } },
    {
      hp: 32,
      ac: 15,
      atk: 6,
      dmg: '2d10+3',
      range: 1,
      move: 3,
      kw: { cleave: 1, unstoppable: 1 },
      tribe: ['undead'],
      vuln: ['radiant'],
      saves: { fort: 6, ref: 0, will: 3 },
      triggers: [{ on: 'summon', label: '白骨聚合', effects: [{ op: 'custom', fn: async (ctx) => { const b = B(ctx); const s = b.unit(ctx.source); if (s) { const n = Math.min(6, b.graves.length); if (n) await b.buff(s, 'dmg', n); } } }] }],
      fx: 'smash',
      scale: 1.35,
    },
  ),
  unit(
    { id: 'nec-bonedragon', name: '骨龙', cost: 8, rarity: 'legendary', pool: N, icon: 'spiked-dragon-head', colors: 'undead', tags: ['undead'], text: '登场：所有敌人进行意志豁免，失败则【恐惧】2 回合。', flavor: '巨龙死后，依然是龙。', up: { cost: 7 } },
    {
      hp: 30,
      ac: 16,
      atk: 7,
      dmg: '2d10+3',
      dmgType: 'necrotic',
      range: 1,
      move: 5,
      kw: { flying: 1, blast: 1 },
      tribe: ['undead', 'dragon'],
      vuln: ['radiant'],
      saves: { fort: 5, ref: 2, will: 5 },
      triggers: [{ on: 'summon', label: '骨龙咆哮', effects: [{ op: 'fx', kind: 'fear' }, { op: 'status', status: 'frightened', turns: 2, to: 'allEnemies', save: { type: 'will', dc: 14 } }] }],
      fx: 'shadow',
      scale: 1.4,
    },
  ),
  // ------------------------------------------------------------- spells
  spell(
    { id: 'nec-army', name: '亡者大军', cost: 5, rarity: 'rare', pool: N, icon: 'raise-skeleton', colors: 'undead', tags: ['undead'], text: '在英雄身边召唤 3 名【骷髅兵】。', up: { cost: 4 } },
    T.none,
    [{ op: 'summon', card: 'tok-skeleton', count: 3, at: 'nearHero' }],
  ),
  spell(
    { id: 'nec-corpseboom', name: '尸爆术', cost: 1, rarity: 'common', pool: N, icon: 'gooey-impact', colors: 'blood', tags: ['sacrifice'], text: '消灭一个友方非英雄单位：其相邻的所有敌人受到 {dmg} 暗蚀伤害（反射豁免减半）。', params: { dmg: '3d6' }, up: { params: { dmg: '4d6' } } },
    T.allyUnit(),
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (!t) return;
          const pos = { x: t.x, y: t.y };
          await b.emit({ t: 'fx', kind: 'corpseExplosion', to: pos });
          await b.kill(t, null);
          const dmg = b.rollNumber(String(ctx.params.dmg));
          for (const e of b.enemiesOf(ctx.player).filter((e) => Math.max(Math.abs(e.x - pos.x), Math.abs(e.y - pos.y)) === 1)) {
            const r = await b.savingThrow(e, 'ref', b.player(ctx.player).spellDC, ctx.player, '尸爆');
            await b.damage(e, r.success ? Math.floor(dmg / 2) : dmg, 'necrotic', b.hero(ctx.player), { label: '尸爆' });
          }
        },
      },
    ],
  ),
  spell(
    { id: 'nec-drain', name: '吸取生命', cost: 2, rarity: 'basic', pool: N, icon: 'bleeding-heart', colors: 'blood', text: '法术攻击 4 格内一个敌人：{dmg} 暗蚀伤害，英雄回复等量生命。', params: { dmg: '2d6' }, up: { params: { dmg: '3d6' } } },
    T.enemy(4),
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const t = tgtUnit(ctx);
          if (!t) return;
          const hero = b.hero(ctx.player);
          const p = b.player(ctx.player);
          const r = await b.d20({ kind: 'attack', player: ctx.player, uid: hero.uid, vs: t.uid, label: `吸取生命 → ${t.name}`, mods: [{ label: '法术攻击', value: p.spellAtk }], target: b.acOf(t), importance: 0.5 });
          await b.emit({ t: 'strike', attacker: hero.uid, target: t.uid, hit: r.success, crit: r.crit, ranged: true, fx: 'drain' });
          if (!r.success) return;
          const d = b.rollNumber(String(ctx.params.dmg)) * (r.crit ? 2 : 1);
          const dealt = await b.damage(t, d, 'necrotic', hero, { crit: r.crit, label: '吸取生命' });
          if (dealt > 0) await b.heal(hero, dealt);
        },
      },
    ],
  ),
  spell(
    { id: 'nec-pact', name: '黑暗契约', cost: 0, rarity: 'basic', pool: N, icon: 'sacrificial-dagger', colors: 'blood', tags: ['sacrifice'], text: '献祭一个友方非英雄单位：抽 2 张牌并获得 1 点法力。', up: { text: '献祭一个友方非英雄单位：抽 2 张牌并获得 2 点法力。', effects: [{ op: 'fx', kind: 'sacrifice' }, { op: 'destroy' }, { op: 'draw', n: 2 }, { op: 'mana', n: 2 }] } },
    T.allyUnit(),
    [{ op: 'fx', kind: 'sacrifice' }, { op: 'destroy' }, { op: 'draw', n: 2 }, { op: 'mana', n: 1 }],
  ),
  spell(
    { id: 'nec-fear', name: '恐惧术', cost: 2, rarity: 'common', pool: N, icon: 'screaming', colors: 'void', text: '5 格内 3×3 区域的敌人进行意志豁免，失败则【恐惧】2 回合（攻击劣势）。', up: { cost: 1 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'fear' }, { op: 'status', status: 'frightened', turns: 2, to: 'targetEnemies', save: { type: 'will' } }],
  ),
  spell(
    { id: 'nec-blight', name: '枯萎术', cost: 3, rarity: 'common', pool: N, icon: 'dead-wood', colors: 'necro', text: '对 5 格内一个单位造成 {dmg} 暗蚀伤害（强韧豁免减半）。', params: { dmg: '4d8' }, up: { params: { dmg: '5d8' } } },
    T.enemy(5),
    [{ op: 'fx', kind: 'blight' }, { op: 'damage', amount: '$dmg', dmgType: 'necrotic', save: { type: 'fort', half: true } }],
  ),
  spell(
    {
      id: 'nec-animate',
      name: '死者复苏',
      cost: 3,
      rarity: 'rare',
      pool: N,
      icon: 'tombstone',
      colors: 'undead',
      tags: ['undead', 'sacrifice'],
      text: '在本场战斗的墓地（单位阵亡处）上召唤【骷髅兵】，最多 {n} 个。',
      params: { n: 3 },
      up: { params: { n: 4 } },
    },
    T.none,
    [
      {
        op: 'custom',
        fn: async (ctx) => {
          const b = B(ctx);
          const seen = new Set<string>();
          let n = Number(ctx.params.n);
          for (const g of [...b.graves].reverse()) {
            if (n <= 0) break;
            const k = `${g.x},${g.y}`;
            if (seen.has(k) || b.unitAt(g.x, g.y)) continue;
            seen.add(k);
            await b.emit({ t: 'fx', kind: 'raise', to: g });
            await b.summon(ctx.player, getCard('tok-skeleton'), g, null, { token: true, silent: true });
            n--;
          }
        },
      },
    ],
  ),
  terrain(
    { id: 'nec-desecrate', name: '亵渎之地', cost: 2, rarity: 'common', pool: N, icon: 'graveyard', colors: 'poison', text: '5 格内 3×3 区域生成【毒雾】3 回合；其中你的亡灵回复 4 生命。', up: { cost: 1 } },
    T.tile(5, 1),
    [{ op: 'fx', kind: 'poison' }, { op: 'surface', surface: 'poison', turns: 3 }, { op: 'custom', fn: async (ctx) => { const b = B(ctx); if (!ctx.targetPos) return; for (const t of b.board.area(ctx.targetPos, 1)) { const u = b.unitAt(t.x, t.y); if (u && u.owner === ctx.player && u.tribe.includes('undead')) await b.heal(u, 4); } } }],
  ),
  // ------------------------------------------------------------- equipment
  equip(
    { id: 'nec-bonearmor', name: '白骨护甲', cost: 1, rarity: 'basic', pool: N, icon: 'ribcage', colors: 'undead', text: '+2 AC，【格挡 1】（物理伤害 -1）。', up: { text: '+3 AC，【格挡 1】。', equip: { ac: 3, kw: { shield: 1 } } } },
    { ac: 2, kw: { shield: 1 } },
  ),
  equip(
    { id: 'nec-tome', name: '死灵之书', cost: 3, rarity: 'rare', pool: N, icon: 'evil-book', colors: 'necro', tags: ['undead'], text: '装备者每击杀一个单位，就在其尸体处召唤一名【骷髅兵】。', up: { cost: 2 } },
    { triggers: [{ on: 'kill', label: '亡者为奴', effects: [{ op: 'summon', card: 'tok-skeleton', count: 1, at: 'nearTarget' }] }] },
  ),
  equip(
    { id: 'nec-scythe', name: '收魂镰刀', cost: 2, rarity: 'common', pool: N, icon: 'reaper-scythe', colors: 'void', text: '伤害 +1d6 并变为暗蚀属性，获得【吸血】。', up: { text: '伤害 +1d8 并变为暗蚀属性，获得【吸血】。', equip: { dmg: '1d8', dmgType: 'necrotic', kw: { lifesteal: 1 } } } },
    { dmg: '1d6', dmgType: 'necrotic', kw: { lifesteal: 1 } },
  ),
];
