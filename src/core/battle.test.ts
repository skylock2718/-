import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEROES } from '../data/heroes';
import { ENCOUNTERS } from '../data/encounters';
import { PRESET_DECKS } from '../data/decks';
import { registerContent } from '../data/index';
import { buildEncounterBattle, buildSkirmish, deckFromIds } from '../run/setup';
import { runAiTurn } from './ai';
import { Battle } from './battle';
import { rollD20 } from './dice';
import { Rng } from './rng';

registerContent();

async function play(b: Battle, maxTurns = 160): Promise<void> {
  await b.start();
  let guard = 0;
  while (!b.over && guard++ < maxTurns) await runAiTurn(b, b.active);
}

test('rng is deterministic from a seed', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.int(1, 20), b.int(1, 20));
  const s = a.state();
  const c = Rng.fromState(s);
  assert.equal(a.next(), c.next());
});

test('advantage keeps the higher d20, disadvantage the lower', () => {
  const rng = new Rng(9);
  for (let i = 0; i < 200; i++) {
    const adv = rollD20(rng, 1);
    assert.equal(adv.nat, Math.max(...adv.rolls));
    const dis = rollD20(rng, -1);
    assert.equal(dis.nat, Math.min(...dis.rolls));
  }
});

test('AI vs AI encounter battles finish with a winner', async () => {
  const encs = ['a1-scouts', 'a1-goblins', 'a2-undead', 'a3-wyrm'].map((id) => ENCOUNTERS.find((e) => e.id === id)!).filter(Boolean);
  let i = 0;
  for (const enc of encs) {
    const hero = HEROES[i++ % HEROES.length];
    const setup = buildEncounterBattle({
      seed: 1234 + i,
      encounter: enc,
      player: { hero, deck: deckFromIds(hero.starterDeck), passives: [hero.starterRelic], isAI: true, aiLevel: 0.8, abilities: hero.abilities },
    });
    const b = new Battle(setup);
    await play(b);
    assert.ok(b.over, `${enc.id} did not finish (round ${b.round})`);
  }
});

test('four-player free-for-all and 2v2 skirmishes resolve', async () => {
  for (const teams of [[0, 1, 2, 3], [0, 0, 1, 1]]) {
    const sides = [0, 1, 2, 3].map((k) => {
      const hero = HEROES[(k + teams[3]) % HEROES.length];
      const deck = PRESET_DECKS.find((d) => d.hero === hero.cls)!;
      return { hero, deck: deckFromIds(deck.cards), passives: [hero.starterRelic], isAI: true, aiLevel: 0.7, abilities: hero.abilities };
    });
    const b = new Battle(buildSkirmish({ seed: 77 + teams[3], sides, biome: 'ashen', size: 11, teams }));
    await play(b, 260);
    assert.ok(b.over, `skirmish ${teams.join('')} did not finish`);
    assert.notEqual(b.winnerTeam, undefined);
  }
});
