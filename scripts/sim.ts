/* Headless AI-vs-AI simulation for balance checks.
 *
 * Usage: npm run sim -- [battlesPerHero] [encounterFilter] [profile]
 *   profile = "run" (default): the player side is a plausible mid-run hero for
 *             the encounter's act — deck grown through real reward rolls,
 *             relics, levels and upgrades, starting at ~85% HP.
 *   profile = "starter": level-1 hero with the 12-card starter deck.
 */
import { Battle } from '../src/core/battle';
import { runAiTurn } from '../src/core/ai';
import { Rng } from '../src/core/rng';
import { canUpgrade } from '../src/core/registry';
import { registerContent } from '../src/data/index';
import { HEROES } from '../src/data/heroes';
import { ENCOUNTERS, type EncounterDef } from '../src/data/encounters';
import { buildEncounterBattle, deckFromIds } from '../src/run/setup';
import { addCard, addFeat, addRelic, gainXp, newRun, rollCards, rollFeats, rollRelic, type RunState } from '../src/run/run';

registerContent();

const N = Number(process.argv[2] ?? 6);
const filter = process.argv[3] ?? 'a1-';
const profile = process.argv[4] ?? 'run';

/** grow a run the way a player roughly would by the time they meet `enc` */
function progressedRun(heroId: string, enc: EncounterDef, seed: number): RunState {
  const run = newRun(heroId, { seed });
  const rng = new Rng(seed * 31 + 7);
  const act = enc.act;
  const stage = (act - 1) * 3 + (enc.kind === 'boss' ? 3 : enc.kind === 'elite' ? 2 : 1); // 1..9
  // cards: ~1.6 picks per battle-ish node; prefer higher rarity like a player would
  const picks = Math.round(stage * 1.6);
  const order = ['legendary', 'epic', 'rare', 'common'];
  for (let i = 0; i < picks && run.deck.length < 20; i++) {
    const choices = rollCards(run, rng, 3, i % 4 === 3 ? 'elite' : 'battle');
    const best = choices.slice().sort((a, b) => order.indexOf(rarityOf(a)) - order.indexOf(rarityOf(b)))[0];
    if (best) addCard(run, best, rng.chance(0.1 * act));
  }
  // relics: one per elite / treasure-ish
  for (let i = 0; i < Math.floor(stage * 0.7); i++) {
    const r = rollRelic(run, rng);
    if (r) addRelic(run, r);
  }
  if (act >= 2) {
    const boss = rollRelic(run, rng, ['boss']);
    if (boss) addRelic(run, boss);
  }
  // levels & feats
  const ups = gainXp(run, stage * 3);
  for (let i = 0; i < ups; i++) {
    const f = rollFeats(run, rng, 1)[0];
    if (f) addFeat(run, f);
  }
  // upgrades from rest sites / events
  const ups2 = rng.sample(run.deck.filter((c) => canUpgrade(c)), Math.floor(stage * 0.8));
  for (const c of ups2) c.up = true;
  run.hp = Math.ceil(run.maxHp * 0.85);
  return run;
}

import { getCard } from '../src/core/registry';
function rarityOf(id: string): string {
  return getCard(id).rarity;
}

async function runOne(heroIdx: number, enc: EncounterDef, seed: number) {
  const hero = HEROES[heroIdx];
  let player;
  if (profile === 'starter') {
    player = { hero, deck: deckFromIds(hero.starterDeck), passives: [hero.starterRelic], isAI: true, aiLevel: 0.85, abilities: hero.abilities };
  } else {
    const run = progressedRun(hero.id, enc, seed);
    player = { hero, deck: run.deck.map((c) => ({ ...c })), hp: run.hp, maxHp: run.maxHp, passives: [...run.relics, ...run.feats], potions: ['pot-heal', null, null], isAI: true, aiLevel: 0.85, abilities: hero.abilities, prof: 2 + Math.floor((run.level - 1) / 2) };
  }
  const setup = buildEncounterBattle({ seed, encounter: enc, player });
  const b = new Battle(setup);
  await b.start();
  let guard = 0;
  while (!b.over && guard++ < 160) {
    await runAiTurn(b, b.active);
  }
  return { winner: b.winner, turns: b.turn, heroHp: b.hero(0)?.hp ?? 0, maxHp: b.hero(0).maxHp, stats: b.players[0].stats, timeout: !b.over };
}

(async () => {
  const encs = ENCOUNTERS.filter((e) => e.id.startsWith(filter));
  const t0 = Date.now();
  console.log(`profile: ${profile}, ${N} battles per hero`);
  for (const enc of encs) {
    const rows: string[] = [];
    let total = 0;
    for (let h = 0; h < HEROES.length; h++) {
      let wins = 0;
      let turns = 0;
      let hp = 0;
      let timeouts = 0;
      for (let i = 0; i < N; i++) {
        const r = await runOne(h, enc, 1000 + i * 7919 + h * 31);
        if (r.winner === 0) {
          wins++;
          hp += r.heroHp / r.maxHp;
        }
        if (r.timeout) timeouts++;
        turns += r.turns;
      }
      total += wins;
      rows.push(`  ${(HEROES[h].title ?? '').padEnd(6, '　')} win ${String(wins).padStart(2)}/${N}  avgTurns ${(turns / N).toFixed(1).padStart(5)}  hpLeft ${(wins ? (hp / wins) * 100 : 0).toFixed(0).padStart(3)}%${timeouts ? `  TIMEOUT ${timeouts}` : ''}`);
    }
    console.log(`${enc.id} ${enc.name} [${enc.kind}]  overall ${Math.round((total / (N * HEROES.length)) * 100)}%`);
    console.log(rows.join('\n'));
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
