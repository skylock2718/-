import { registerCards, registerPassives, registerPotions, registerCommanders } from '../core/registry';
import { PALADIN_CARDS } from './cards/paladin';
import { RANGER_CARDS } from './cards/ranger';
import { WIZARD_CARDS } from './cards/wizard';
import { ROGUE_CARDS } from './cards/rogue';
import { NECRO_CARDS } from './cards/necro';
import { NEUTRAL_CARDS, TOKEN_CARDS, CURSE_CARDS } from './cards/neutral';
import { ENEMY_CARDS } from './cards/enemies';
import { PASSIVES } from './passives';
import { POTIONS } from './potions';
import { HEROES } from './heroes';
import { ENCOUNTERS } from './encounters';

let done = false;

/** Register all game content. Idempotent. */
export function registerContent(): void {
  if (done) return;
  done = true;
  registerCards([...PALADIN_CARDS, ...RANGER_CARDS, ...WIZARD_CARDS, ...ROGUE_CARDS, ...NECRO_CARDS, ...NEUTRAL_CARDS, ...TOKEN_CARDS, ...CURSE_CARDS, ...ENEMY_CARDS]);
  registerPassives(PASSIVES);
  registerPotions(POTIONS);
  registerCommanders([...HEROES, ...ENCOUNTERS.map((e) => e.commander)]);
}

export const PLAYER_CARD_POOLS = { paladin: PALADIN_CARDS, ranger: RANGER_CARDS, wizard: WIZARD_CARDS, rogue: ROGUE_CARDS, necro: NECRO_CARDS, neutral: NEUTRAL_CARDS };
