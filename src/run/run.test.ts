import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCard } from '../core/registry';
import { HEROES } from '../data/heroes';
import { registerContent } from '../data/index';
import { battleRewards, generateActMap, makeShop, newRun, reachableNodes, type ActMap } from './run';

registerContent();

function edgesCross(map: ActMap): boolean {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const edges: { r: number; a: number; b: number }[] = [];
  for (const n of map.nodes) for (const id of n.next) {
    const m = byId.get(id)!;
    if (m.kind === 'boss') continue;
    edges.push({ r: n.row, a: n.col, b: m.col });
  }
  for (const e of edges) for (const f of edges) {
    if (e.r !== f.r) continue;
    if ((e.a < f.a && e.b > f.b) || (e.a > f.a && e.b < f.b)) return true;
  }
  return false;
}

test('act maps are connected, crossing-free and end in a boss', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = newRun(HEROES[seed % HEROES.length].id, { seed });
    for (const act of [1, 2, 3]) {
      const map = generateActMap(run, act);
      const boss = map.nodes.filter((n) => n.kind === 'boss');
      assert.equal(boss.length, 1);
      assert.ok(boss[0].encounter, `act ${act} boss has an encounter`);
      assert.equal(edgesCross(map), false, `seed ${seed} act ${act} has crossing edges`);
      // every node reachable from row 0 and every node leads to the boss
      const seen = new Set<number>();
      const stack = map.nodes.filter((n) => n.row === 0).map((n) => n.id);
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...map.nodes[id].next);
      }
      assert.equal(seen.size, map.nodes.length, `seed ${seed} act ${act}: unreachable nodes`);
      for (const n of map.nodes) if (n.kind !== 'boss') assert.ok(n.next.length > 0, `dead end at ${n.id}`);
      for (const n of map.nodes) if (n.kind === 'battle' || n.kind === 'elite') assert.ok(n.encounter, `fight node ${n.id} without encounter`);
      assert.ok(map.nodes.some((n) => n.kind === 'rest'));
    }
  }
});

test('a new run starts at the bottom of act 1 with a starter deck', () => {
  for (const h of HEROES) {
    const run = newRun(h.id, { seed: 7 });
    assert.equal(run.deck.length, h.starterDeck.length);
    assert.equal(run.hp, h.stats.hp);
    assert.ok(reachableNodes(run).length >= 2);
    assert.ok(reachableNodes(run).every((n) => n.row === 0));
  }
});

test('rewards and shops roll valid content', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = newRun(HEROES[seed % HEROES.length].id, { seed });
    for (const kind of ['battle', 'elite', 'boss'] as const) {
      const r = battleRewards(run, kind, 0);
      assert.equal(r.cards[0].length, 3);
      for (const id of r.cards[0]) assert.ok(hasCard(id));
      assert.equal(new Set(r.cards[0]).size, 3, 'card choices are distinct');
      if (kind === 'elite') assert.ok(r.relic);
      if (kind === 'boss') assert.equal(r.bossRelics?.length, 3);
    }
    const shop = makeShop(run);
    assert.equal(shop.cards.length, 5);
    assert.ok(shop.relics.length >= 1);
    for (const c of shop.cards) assert.ok(c.price > 0);
  }
});
