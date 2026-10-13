import { getCard } from '../core/registry';
import type { CardDef, HeroClass } from '../core/types';

/**
 * Pre-built 20-card archetype decks. They power skirmish opponents, give new
 * players a sensible starting point in the deck builder, and double as a
 * showcase of the two play styles every hero supports.
 */

export interface PresetDeck {
  id: string;
  hero: HeroClass;
  name: string;
  text: string;
  cards: string[];
}

export const DECK_SIZE = 20;

const x = (id: string, n: number): string[] => new Array(n).fill(id);

export const PRESET_DECKS: PresetDeck[] = [
  {
    id: 'deck-pal-wall',
    hero: 'paladin',
    name: '盾墙',
    text: '嘲讽、坚守与守护光环：稳住阵线，让敌人撞碎在你的盾上。',
    cards: [
      ...x('pal-squire', 2), ...x('pal-shieldbearer', 2), ...x('pal-pikeman', 2), ...x('neu-dwarf', 2), ...x('pal-oathknight', 2),
      'pal-guardian', 'pal-cleric', ...x('pal-towershield', 2), 'pal-shieldfaith', 'pal-unbreakable', 'pal-sanctuary', 'pal-banner', 'pal-aegis', 'pal-healword',
    ],
  },
  {
    id: 'deck-pal-judgement',
    hero: 'paladin',
    name: '圣光审判',
    text: '祝福、惩击、天界号角：用圣光一次性审判整片战场。',
    cards: [
      ...x('pal-squire', 2), ...x('pal-crossbow', 2), ...x('pal-cleric', 2), 'pal-warhorse', 'pal-oathknight', 'pal-griffin', 'pal-seraph',
      ...x('pal-bless', 2), ...x('pal-smite', 2), 'pal-judgement', 'pal-celestial', 'pal-massheal', 'pal-lightsword', 'pal-oathhammer', 'neu-holywater',
    ],
  },
  {
    id: 'deck-rng-highground',
    hero: 'ranger',
    name: '高地狙击',
    text: '隆起大地、占据制高点，射手在高处享受命中与射程加成。',
    cards: [
      ...x('rng-scout', 2), ...x('rng-archer', 2), ...x('rng-ranger', 2), ...x('rng-sniper', 2), 'neu-merc-archer',
      ...x('rng-raise', 2), 'rng-bastion', 'rng-sinkhole', ...x('rng-pierce', 2), 'rng-volley', 'rng-mark', 'rng-longbow', 'rng-stormquiver', 'neu-claws',
    ],
  },
  {
    id: 'deck-rng-pack',
    hero: 'ranger',
    name: '兽群',
    text: '群狼、猎豹与巨熊：包围目标，用群体战术撕碎敌人。',
    cards: [
      ...x('rng-falcon', 2), ...x('rng-wolf', 2), ...x('rng-panther', 2), ...x('rng-bear', 2), 'rng-alpha', 'rng-treant', 'rng-roc',
      ...x('rng-callwild', 2), ...x('rng-fury', 2), 'rng-gift', 'rng-entangle', 'rng-horn', 'rng-boots', 'rng-mark',
    ],
  },
  {
    id: 'deck-wiz-inferno',
    hero: 'wizard',
    name: '焚烬',
    text: '油腻术铺路，火球点燃——让爆燃的连锁反应替你清场。',
    cards: [
      ...x('wiz-apprentice', 2), 'neu-militia', 'neu-dwarf', 'wiz-fireelem', 'wiz-golem',
      ...x('wiz-grease', 2), ...x('wiz-ray', 2), ...x('wiz-hands', 2), ...x('wiz-fireball', 2), 'wiz-fireshield', 'wiz-meteor', 'neu-firewall', 'wiz-intellect', 'wiz-robe', 'wiz-misty',
    ],
  },
  {
    id: 'deck-wiz-storm',
    hero: 'wizard',
    name: '风暴寒霜',
    text: '冰冻湖面与敌人，再用闪电沿着水面一路导电。',
    cards: [
      ...x('wiz-apprentice', 2), ...x('wiz-stormspirit', 2), 'wiz-golem', 'neu-sellsword',
      ...x('wiz-frost', 2), 'wiz-freeze', 'wiz-icestorm', ...x('wiz-bolt', 2), 'wiz-thunder', 'wiz-chain', 'wiz-stormstaff', ...x('wiz-missile', 2), 'neu-iceslick', 'wiz-surge', 'wiz-levitate',
    ],
  },
  {
    id: 'deck-rog-gamble',
    hero: 'rogue',
    name: '赌命',
    text: '积攒命运点、扩大暴击范围——天然 20 就是你的引擎。',
    cards: [
      ...x('rog-gambler', 2), ...x('rog-bouncer', 2), 'rog-house', 'rog-ladyluck', ...x('neu-halfling', 2), 'neu-sellsword',
      ...x('rog-allin', 2), ...x('rog-coin', 2), 'rog-doubledown', 'rog-wheel', 'rog-cheat', 'rog-loaded', 'rog-rabbit', 'neu-foresight', 'rog-blackmarket',
    ],
  },
  {
    id: 'deck-rog-shadow',
    hero: 'rogue',
    name: '暗影',
    text: '潜行、背刺与毒刃——在敌人看不见的地方结束战斗。',
    cards: [
      ...x('rog-cutpurse', 2), ...x('rog-assassin', 2), ...x('rog-trickster', 2), 'neu-halfling',
      ...x('rog-smoke', 2), ...x('rog-backstab', 2), 'rog-shadowstep', 'rog-poisoncloud', 'rog-fan', 'rog-coup', 'rog-guild', ...x('rog-poisonblade', 2), 'neu-fang', 'rog-coin',
    ],
  },
  {
    id: 'deck-nec-horde',
    hero: 'necro',
    name: '亡灵大军',
    text: '源源不断的骷髅与腐尸，用数量压垮敌人。',
    cards: [
      ...x('nec-skeleton', 2), ...x('nec-skelarcher', 2), ...x('nec-zombie', 2), ...x('nec-ghoul', 2), 'nec-wraith', 'nec-deathknight', 'nec-colossus',
      'nec-army', 'nec-animate', 'nec-desecrate', 'nec-tome', 'nec-bonearmor', 'nec-pact', 'nec-fear', 'neu-warhorn', 'nec-drain',
    ],
  },
  {
    id: 'deck-nec-sacrifice',
    hero: 'necro',
    name: '献祭',
    text: '牺牲部下换取法力与爆炸——每一次死亡都是资源。',
    cards: [
      ...x('nec-skeleton', 2), ...x('nec-zombie', 2), 'nec-ghoul', ...x('nec-reaper', 2), 'nec-wraith', 'nec-bonedragon',
      ...x('nec-corpseboom', 2), ...x('nec-pact', 2), ...x('nec-drain', 2), 'nec-blight', 'nec-fear', 'nec-scythe', 'nec-animate', 'neu-wisp',
    ],
  },
];

export function presetsFor(hero: HeroClass): PresetDeck[] {
  return PRESET_DECKS.filter((d) => d.hero === hero);
}

/** copies of one card allowed in a constructed deck */
export function copyLimit(def: CardDef): number {
  return def.rarity === 'legendary' ? 1 : 2;
}

/** cards a hero may put in a constructed deck */
export function deckLegal(def: CardDef, hero: HeroClass): boolean {
  return (def.pool === hero || def.pool === 'neutral') && def.rarity !== 'token' && def.type !== 'curse';
}

/** returns a list of problems (empty when the deck is legal) */
export function validateDeck(cards: string[], hero: HeroClass): string[] {
  const problems: string[] = [];
  if (cards.length !== DECK_SIZE) problems.push(`牌组需要正好 ${DECK_SIZE} 张牌（当前 ${cards.length}）`);
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    let def: CardDef;
    try {
      def = getCard(id);
    } catch {
      problems.push(`未知卡牌 ${id}`);
      continue;
    }
    if (!deckLegal(def, hero)) problems.push(`【${def.name}】不能放入该英雄的牌组`);
    if (n > copyLimit(def)) problems.push(`【${def.name}】最多 ${copyLimit(def)} 张`);
  }
  return problems;
}
