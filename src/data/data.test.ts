import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ICONS } from '../assets/icons.generated';
import { allCards, allPassives, allPotions, getPassive, hasCard } from '../core/registry';
import { PRESET_DECKS, validateDeck } from './decks';
import { ENCOUNTERS } from './encounters';
import { EVENTS, type Outcome } from './events';
import { HEROES } from './heroes';
import { registerContent } from './index';

registerContent();

test('every card, passive and potion has a resolvable icon', () => {
  const missing: string[] = [];
  for (const c of allCards()) if (!ICONS[c.icon]) missing.push(`card ${c.id}: ${c.icon}`);
  for (const p of allPassives()) if (!ICONS[p.icon]) missing.push(`passive ${p.id}: ${p.icon}`);
  for (const p of allPotions()) if (!ICONS[p.icon]) missing.push(`potion ${p.id}: ${p.icon}`);
  for (const h of HEROES) if (!ICONS[h.icon]) missing.push(`hero ${h.id}: ${h.icon}`);
  assert.deepEqual(missing, []);
});

test('preset decks are legal 20-card decks', () => {
  for (const d of PRESET_DECKS) assert.deepEqual(validateDeck(d.cards, d.hero), [], d.id);
  for (const h of HEROES) assert.equal(PRESET_DECKS.filter((d) => d.hero === h.cls).length >= 2, true, `${h.id} needs two presets`);
});

test('heroes reference existing cards and relics', () => {
  for (const h of HEROES) {
    for (const id of h.starterDeck) assert.ok(hasCard(id), `${h.id} starter card ${id}`);
    assert.ok(getPassive(h.starterRelic), `${h.id} starter relic ${h.starterRelic}`);
    for (const p of h.passives ?? []) assert.ok(getPassive(p), `${h.id} passive ${p}`);
    assert.ok(h.starterDeck.length <= 20);
  }
});

test('encounters reference existing cards and traits', () => {
  for (const e of ENCOUNTERS) {
    for (const id of e.deck) assert.ok(hasCard(id), `${e.id} deck card ${id}`);
    for (const t of e.traits ?? []) assert.ok(getPassive(t), `${e.id} trait ${t}`);
    assert.ok(ICONS[e.commander.icon], `${e.id} commander icon ${e.commander.icon}`);
  }
  for (const act of [1, 2, 3]) {
    for (const kind of ['normal', 'elite', 'boss'] as const) {
      assert.ok(
        ENCOUNTERS.some((e) => e.act === act && e.kind === kind),
        `act ${act} has a ${kind} encounter`,
      );
    }
  }
});

test('events reference existing content', () => {
  const outcomes: Outcome[] = [];
  for (const ev of EVENTS) {
    assert.ok(ICONS[ev.icon], `${ev.id} icon ${ev.icon}`);
    assert.ok(ev.acts.length > 0, `${ev.id} acts`);
    for (const o of ev.options) {
      outcomes.push(o.success);
      if (o.fail) outcomes.push(o.fail);
      for (const t of o.table ?? []) outcomes.push(t.outcome);
    }
  }
  for (const o of outcomes) {
    for (const c of o.cards ?? []) assert.ok(hasCard(c.id), `event card ${c.id}`);
    for (const c of o.curse ?? []) assert.ok(hasCard(c), `event curse ${c}`);
    if (o.relic && !['random', 'rare', 'boss'].includes(o.relic)) assert.ok(getPassive(o.relic), `event relic ${o.relic}`);
    if (typeof o.potion === 'string') assert.ok(allPotions().some((p) => p.id === o.potion), `event potion ${o.potion}`);
    if (o.fight) assert.ok(ENCOUNTERS.some((e) => e.id === o.fight), `event fight ${o.fight}`);
  }
  for (const act of [1, 2, 3]) assert.ok(EVENTS.filter((e) => e.acts.includes(act)).length >= 5, `act ${act} has enough events`);
});
