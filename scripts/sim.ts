/* Headless AI-vs-AI simulation for balance checks.
 * Usage: npm run sim -- [battlesPerPair] [encounterFilter]
 */
import { Battle } from '../src/core/battle';
import { runAiTurn } from '../src/core/ai';
import { registerContent } from '../src/data/index';
import { HEROES } from '../src/data/heroes';
import { ENCOUNTERS } from '../src/data/encounters';
import { buildEncounterBattle, deckFromIds } from '../src/run/setup';

registerContent();

const N = Number(process.argv[2] ?? 6);
const filter = process.argv[3] ?? 'a1-';

async function runOne(heroIdx: number, encId: string, seed: number) {
  const hero = HEROES[heroIdx];
  const enc = ENCOUNTERS.find((e) => e.id === encId);
  if (!enc) throw new Error(encId);
  const setup = buildEncounterBattle({
    seed,
    encounter: enc,
    player: { hero, deck: deckFromIds(hero.starterDeck), passives: [hero.starterRelic], isAI: true, aiLevel: 0.85, abilities: hero.abilities },
  });
  const b = new Battle(setup);
  await b.start();
  let guard = 0;
  while (!b.over && guard++ < 120) {
    await runAiTurn(b, b.active);
  }
  return { winner: b.winner, turns: b.turn, heroHp: b.hero(0)?.hp ?? 0, maxHp: b.hero(0).maxHp, stats: b.players[0].stats, timeout: !b.over };
}

(async () => {
  const encs = ENCOUNTERS.filter((e) => e.id.startsWith(filter));
  const t0 = Date.now();
  for (const enc of encs) {
    const rows: string[] = [];
    for (let h = 0; h < HEROES.length; h++) {
      let wins = 0;
      let turns = 0;
      let hp = 0;
      let timeouts = 0;
      let crits = 0;
      for (let i = 0; i < N; i++) {
        const r = await runOne(h, enc.id, 1000 + i * 7919 + h * 31);
        if (r.winner === 0) {
          wins++;
          hp += r.heroHp / r.maxHp;
        }
        if (r.timeout) timeouts++;
        turns += r.turns;
        crits += r.stats.crits;
      }
      rows.push(`  ${(HEROES[h].title ?? '').padEnd(6, '　')} win ${String(wins).padStart(2)}/${N}  avgTurns ${(turns / N).toFixed(1).padStart(5)}  hpLeft ${(wins ? (hp / wins) * 100 : 0).toFixed(0).padStart(3)}%  crits ${(crits / N).toFixed(1)}${timeouts ? `  TIMEOUT ${timeouts}` : ''}`);
    }
    console.log(`${enc.id} ${enc.name} [${enc.kind}]`);
    console.log(rows.join('\n'));
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
