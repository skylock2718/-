import { cheb, posKey } from './board';
import { Battle, type Unit } from './battle';
import { diceAvg, parseDice } from './dice';
import { cardOf, getCard, getPotion } from './registry';
import type { CardDef, CardInst, Effect, PlayerId, Pos, Selector, StatusId, TargetSpec, Tile } from './types';

/**
 * Utility-based AI. It does not simulate the (async) engine; instead it
 * estimates the value of every legal option with heuristics and greedily
 * executes the best one, re-evaluating after each action.
 */

export interface AiOptions {
  /** awaited between actions so the presentation can breathe */
  pause?: (ms: number) => Promise<void>;
  cancelled?: () => boolean;
}

const STATUS_VALUE: Partial<Record<StatusId, number>> = {
  stunned: 7,
  frozen: 7,
  rooted: 3,
  frightened: 3.5,
  poisoned: 3,
  burning: 3,
  baned: 2.5,
  slowed: 2,
  prone: 2,
  vulnerable: 4,
  marked: 3,
  doomed: 6,
  blessed: 2.5,
  inspired: 1.2,
  hasted: 1.5,
  shielded: 2.5,
  regen: 2,
  stoneskin: 3,
  hidden: 3,
};
const NEGATIVE: Set<StatusId> = new Set(['stunned', 'frozen', 'rooted', 'frightened', 'poisoned', 'burning', 'baned', 'slowed', 'prone', 'vulnerable', 'marked', 'doomed']);

const KW_VALUE: Record<string, number> = {
  ward: 4,
  stealth: 3,
  flying: 1.5,
  keen: 2,
  unstoppable: 1,
  fortify: 1,
  thorns: 2,
  lifesteal: 2.5,
  haste: 2,
  provoke: 1.5,
  riposte: 2,
  lucky: 1,
  sneak: 3,
  pack: 2,
  reach: 1.5,
  cleave: 2.5,
  push: 1.5,
  venom: 2,
  ignite: 2,
  climb: 0.5,
  inspire: 2,
  auraAC: 2,
  auraAtk: 2,
  spellward: 1,
  shield: 2,
  evasion: 1.5,
  sentinel: 1.5,
  flurry: 4,
};

export async function runAiTurn(b: Battle, pid: PlayerId, o: AiOptions = {}): Promise<void> {
  const brain = new AiBrain(b, pid, o);
  await brain.play();
}

export class AiBrain {
  private threat: Map<string, number> | null = null;
  private readonly noise: number;
  private actions = 0;

  constructor(
    private b: Battle,
    private pid: PlayerId,
    private o: AiOptions,
  ) {
    this.noise = Math.max(0, 1 - b.player(pid).aiLevel);
  }

  private get alive(): boolean {
    return !this.b.over && this.b.active === this.pid && this.b.player(this.pid).alive && !this.o.cancelled?.() && this.actions < 60;
  }

  private async pause(ms: number): Promise<void> {
    if (this.o.pause) await this.o.pause(ms);
  }

  private jitter(v: number): number {
    if (this.noise <= 0) return v;
    return v * (1 + (Math.random() - 0.5) * this.noise * 0.8);
  }

  async play(): Promise<void> {
    const b = this.b;
    if (!this.alive) return;
    await this.pause(400);
    await this.maybeReplace();
    // 1) high-value spells first (finishers, big AoE, control)
    await this.castLoop(true);
    // 2) summon units
    await this.summonLoop();
    // 3) units act
    await this.unitLoop();
    // 4) hero power and remaining cards
    await this.heroPower();
    await this.castLoop(false);
    await this.summonLoop();
    // a second pass in case new options opened (e.g. hasted summons)
    await this.unitLoop();
    await this.potions();
    if (this.alive) {
      await this.pause(300);
      await b.endTurn();
    }
  }

  // ------------------------------------------------------------------ basics

  worth(u: Unit): number {
    if (u.isHero) return 40;
    const dmg = diceAvg(u.dmg) + u.equipDmg.reduce((a, d) => a + diceAvg(d), 0);
    let w = 3 + dmg * 1.3 + u.maxHp * 0.35 + u.atk * 0.3;
    for (const [k, v] of Object.entries(u.kw)) w += (KW_VALUE[k] ?? 0.5) * Math.min(2, v ?? 0);
    if (u.ability) w += 3;
    return w;
  }

  private hostile(u: Unit): boolean {
    return this.b.hostile(this.pid, u.owner);
  }

  private myHero(): Unit {
    return this.b.hero(this.pid);
  }

  private enemyHeroes(): Unit[] {
    return this.b.players.filter((p) => p.alive && this.b.hostile(this.pid, p.id)).map((p) => this.b.hero(p.id));
  }

  /** Expected damage enemies can deal on each tile next turn. */
  private threatMap(): Map<string, number> {
    if (this.threat) return this.threat;
    const b = this.b;
    const m = new Map<string, number>();
    for (const e of b.alive()) {
      if (!this.hostile(e)) continue;
      if (b.isControlled(e) && (b.status(e, 'stunned')?.turns ?? b.status(e, 'frozen')?.turns ?? 0) > 1) continue;
      const reach = b.kw(e, 'immobile') > 0 ? new Map([[b.board.idx(e.x, e.y), { cost: 0, prev: -1 }]]) : b.reachMap(e, b.moveOf(e));
      const range = b.baseRange(e) + (b.isRanged(e) ? 1 : 0);
      const dmg = (diceAvg(e.dmg) + e.equipDmg.reduce((a, d) => a + diceAvg(d), 0)) * (b.kw(e, 'flurry') ? 1.7 : 1) * 0.6;
      const hit = new Set<string>();
      for (const [i] of reach) {
        const p = b.board.pos(i);
        for (const t of b.board.area(p, range)) hit.add(posKey(t));
      }
      for (const k of hit) m.set(k, (m.get(k) ?? 0) + dmg);
    }
    this.threat = m;
    return m;
  }

  private invalidate(): void {
    this.threat = null;
  }

  // ------------------------------------------------------------------ positions

  private positionValue(u: Unit, t: Pos, attacking: boolean): number {
    const b = this.b;
    const tile = b.board.get(t);
    let v = 0;
    const ranged = b.isRanged(u);
    const ratio = u.hp / u.maxHp;
    // pressure rises over time so battles always resolve
    const aggression = Math.min(1.6, 0.6 + b.round * 0.07);
    // nodes (heroes care less: they should not wander off for a chest)
    if (tile.node) {
      const n = tile.node;
      const k = u.isHero ? 0.4 : 1;
      if (n.owner !== this.pid && (n.kind === 'well' || n.kind === 'shrine' || n.kind === 'gate')) v += (n.kind === 'well' ? 6 : n.kind === 'shrine' ? 4.5 : 3) * k;
      if (!n.used && (n.kind === 'chest' || n.kind === 'altar' || n.kind === 'rune' || n.kind === 'gold')) v += 3 * k;
      if (n.kind === 'spring' && u.hp < u.maxHp) v += 2;
    }
    // height
    v += tile.h * (ranged ? 0.9 : 0.3);
    if (ranged && tile.terrain === 'forest') v += 0.6;
    // hazards
    if (!b.isFlying(u)) {
      if (tile.terrain === 'lava' && !u.immune.includes('fire')) v -= 9;
      if (tile.surface === 'fire' && !u.immune.includes('fire')) v -= 4;
      if (tile.surface === 'poison' && !u.immune.includes('poison')) v -= 3;
      if (tile.surface === 'ice') v -= 1;
      if (tile.surface === 'holy' && tile.surfaceOwner != null && this.b.hostile(tile.surfaceOwner, this.pid) && u.tribe.includes('undead')) v -= 3;
    }
    // threat: heroes are careful, minions are expendable
    const threat = this.threatMap().get(posKey(t)) ?? 0;
    let riskW: number;
    if (u.isHero) {
      const bruiser = !ranged && u.maxHp >= 30;
      riskW = ratio < 0.35 ? 1.4 : ratio < 0.6 ? 0.9 : bruiser ? 0.35 : 0.6;
    } else riskW = ranged ? 0.14 : 0.06;
    v -= threat * riskW;
    // approach
    const enemies = b.enemiesOf(this.pid).filter((e) => !b.has(e, 'hidden'));
    if (enemies.length && !attacking) {
      const heroes = this.enemyHeroes();
      const dE = Math.min(...enemies.map((e) => cheb(e, t)));
      const dH = heroes.length ? Math.min(...heroes.map((h) => cheb(h, t))) : 10;
      const want = b.baseRange(u);
      if (u.isHero) {
        if (ranged) v -= Math.abs(dE - want) * 0.3;
        else v -= (dE * 0.25 + dH * 0.15) * aggression * (ratio > 0.5 ? 1 : 0.3);
      } else if (ranged) {
        v -= Math.abs(dE - want) * 0.6;
        v -= dH * 0.12 * aggression;
      } else {
        v -= (dE * 0.5 + dH * 0.4) * aggression;
        if (dE === 1) v += 0.8;
      }
    }
    // bodyguard: stand next to own hero when it is threatened
    if (!u.isHero) {
      const h = this.myHero();
      const ht = this.threatMap().get(posKey(h)) ?? 0;
      if (ht > 6 && cheb(h, t) === 1) v += 1.5;
    }
    return v;
  }

  // ------------------------------------------------------------------ attack value

  private attackValue(u: Unit, target: Unit, from: Pos): number {
    const b = this.b;
    const pv = b.previewAttack(u, target, from);
    if (!pv.ok) return -Infinity;
    let v: number;
    if (target.isHero) {
      const ratio = target.hp / target.maxHp;
      v = pv.avg * (1.0 + 2.0 * (1 - ratio));
      v += pv.kill * 600;
    } else {
      const w = this.worth(target);
      v = pv.avg * (w / Math.max(1, target.maxHp)) + pv.kill * w * 0.9;
      if (b.kw(target, 'provoke')) v += 0.5;
    }
    // riposte risk
    if (!b.isRanged(u) && b.kw(target, 'riposte') && pv.kill < 0.9) v -= diceAvg(target.dmg) * 0.5 * (u.isHero ? 1.5 : 0.6);
    if (b.kw(target, 'thorns') && !b.isRanged(u)) v -= b.kw(target, 'thorns') * 0.5;
    return v;
  }

  // ------------------------------------------------------------------ units

  private async unitLoop(): Promise<void> {
    const b = this.b;
    const done = new Set<number>();
    for (let guard = 0; guard < 20 && this.alive; guard++) {
      const units = b
        .unitsOf(this.pid)
        .filter((u) => !done.has(u.uid) && (b.canAct(u) || b.canMove(u)))
        .sort((a, c) => this.unitOrder(a) - this.unitOrder(c));
      const u = units[0];
      if (!u) break;
      done.add(u.uid);
      await this.actUnit(u);
      this.invalidate();
    }
  }

  private unitOrder(u: Unit): number {
    // ranged first, hero last, then units that can attack right now
    const b = this.b;
    let o = 0;
    if (u.isHero) o += 50;
    if (b.isRanged(u)) o -= 10;
    if (b.attackTargets(u).length) o -= 5;
    return o;
  }

  private async actUnit(u: Unit): Promise<void> {
    const b = this.b;
    type Plan = { to: Pos | null; path: Pos[] | null; target: Unit | null; ability: Pos | null | 'self'; score: number };
    const plans: Plan[] = [];
    const here = { x: u.x, y: u.y };
    const spots: { pos: Pos; path: Pos[] | null }[] = [{ pos: here, path: null }];
    if (b.canMove(u)) for (const [, r] of b.reachable(u)) spots.push({ pos: r.path[r.path.length - 1], path: r.path });

    const canAct = b.canAct(u);
    for (const s of spots) {
      const base = this.positionValue(u, s.pos, false);
      plans.push({ to: s.path ? s.pos : null, path: s.path, target: null, ability: null, score: this.jitter(base) });
      if (!canAct) continue;
      for (const t of b.enemiesOf(this.pid)) {
        if (!b.canAttack(u, t, s.pos).ok) continue;
        const av = this.attackValue(u, t, s.pos);
        if (av === -Infinity) continue;
        const pos = this.positionValue(u, s.pos, true);
        plans.push({ to: s.path ? s.pos : null, path: s.path, target: t, ability: null, score: this.jitter(av + pos * 0.6) });
      }
      if (u.ability && u.abilityCd <= 0) {
        const ab = u.ability;
        if (ab.target.kind === 'none') {
          const fake = { ...u, x: s.pos.x, y: s.pos.y } as Unit;
          const av = this.effectsValue(ab.effects, { source: fake, target: null, area: null, spell: false, spec: ab.target });
          if (av > 1.5) plans.push({ to: s.path ? s.pos : null, path: s.path, target: null, ability: 'self', score: this.jitter(av + this.positionValue(u, s.pos, true) * 0.6) });
        } else if (s.pos.x === u.x && s.pos.y === u.y) {
          // abilities with targets: evaluate from current position only (cheap)
          for (const tp of b.abilityTargets(u)) {
            const tgt = b.unitAt(tp.x, tp.y) ?? null;
            const area = b.areaOf(ab.target, u, tp);
            const av = this.effectsValue(ab.effects, { source: u, target: tgt, area, spell: false, spec: ab.target, pos: tp });
            if (av > 1.5) plans.push({ to: null, path: null, target: null, ability: tp, score: this.jitter(av + this.positionValue(u, s.pos, true) * 0.6) });
          }
        }
      }
    }
    plans.sort((a, c) => c.score - a.score);
    const best = plans[0];
    if (!best) return;
    // execute
    if (best.to && best.path) {
      await b.move(u.uid, best.to);
      this.actions++;
      await this.pause(150);
      if (u.dead || !this.alive) return;
    }
    if (best.target && !best.target.dead && b.canAct(u)) {
      if (b.canAttack(u, best.target).ok) {
        await b.attack(u.uid, best.target.uid);
        this.actions++;
        await this.pause(200);
      }
    } else if (best.ability && b.canAct(u)) {
      await b.useAbility(u.uid, best.ability === 'self' ? null : best.ability);
      this.actions++;
      await this.pause(200);
    }
    // retreat with leftover movement (hit and run) for ranged units and heroes
    if (!u.dead && this.alive && b.canMove(u) && (b.isRanged(u) || u.isHero) && u.actions === 0) {
      this.invalidate();
      const curV = this.positionValue(u, u, true);
      let bestR: { pos: Pos; v: number } | null = null;
      for (const [, r] of b.reachable(u)) {
        const p = r.path[r.path.length - 1];
        const v = this.positionValue(u, p, true);
        if (v > curV + 1 && (!bestR || v > bestR.v)) bestR = { pos: p, v };
      }
      if (bestR) {
        await b.move(u.uid, bestR.pos);
        this.actions++;
      }
    }
  }

  // ------------------------------------------------------------------ cards

  private playable(): CardInst[] {
    const p = this.b.player(this.pid);
    return p.hand.filter((c) => this.b.canPlay(this.pid, c).ok);
  }

  private async summonLoop(): Promise<void> {
    const b = this.b;
    for (let guard = 0; guard < 8 && this.alive; guard++) {
      const units = this.playable().filter((c) => cardOf(c).type === 'unit');
      if (!units.length) return;
      // most expensive first (better use of mana), ties by value
      units.sort((a, c) => b.costOf(b.player(this.pid), c) - b.costOf(b.player(this.pid), a));
      const inst = units[0];
      const def = cardOf(inst);
      const spot = this.bestSummonTile(def, b.cardTargets(this.pid, inst));
      if (!spot) return;
      await b.playCard(this.pid, inst.iid, spot);
      this.actions++;
      this.invalidate();
      await this.pause(250);
    }
  }

  private bestSummonTile(def: CardDef, tiles: Pos[]): Pos | null {
    if (!tiles.length) return null;
    const b = this.b;
    const s = def.unit!;
    const ranged = s.range > 1;
    const enemies = b.enemiesOf(this.pid).filter((e) => !b.has(e, 'hidden'));
    let best: { p: Pos; v: number } | null = null;
    for (const p of tiles) {
      const tile = b.board.get(p);
      let v = 0;
      const dE = enemies.length ? Math.min(...enemies.map((e) => cheb(e, p))) : 6;
      if (ranged) v += tile.h * 0.8 - Math.abs(dE - s.range) * 0.4;
      else v -= dE * 0.5;
      if (s.kw?.provoke) {
        const h = this.myHero();
        // tanks go between the hero and the enemy
        const dHeroEnemy = enemies.length ? Math.min(...enemies.map((e) => cheb(e, h))) : 6;
        if (dE < dHeroEnemy) v += 1.5;
      }
      const threat = this.threatMap().get(posKey(p)) ?? 0;
      v -= threat * (ranged ? 0.25 : 0.08);
      if (tile.node && tile.node.owner !== this.pid && ['well', 'shrine', 'gate'].includes(tile.node.kind)) v += 5;
      if (tile.node && !tile.node.used && ['chest', 'altar', 'rune', 'gold'].includes(tile.node.kind)) v += 2;
      if (tile.terrain === 'lava' || tile.surface === 'fire') v -= 6;
      v = this.jitter(v);
      if (!best || v > best.v) best = { p, v };
    }
    return best?.p ?? null;
  }

  private async castLoop(highOnly: boolean): Promise<void> {
    const b = this.b;
    for (let guard = 0; guard < 8 && this.alive; guard++) {
      const p = b.player(this.pid);
      let best: { inst: CardInst; target: Pos | null; v: number } | null = null;
      for (const inst of this.playable()) {
        const def = cardOf(inst);
        if (def.type === 'unit') continue;
        const cost = b.costOf(p, inst);
        const opt = this.bestCardTarget(inst, def);
        if (!opt) continue;
        const ratio = opt.v / Math.max(1, cost);
        const threshold = highOnly ? 4.5 : 1.6;
        if (opt.v < 2 || ratio < threshold) continue;
        const score = this.jitter(opt.v + ratio);
        if (!best || score > best.v) best = { inst, target: opt.target, v: score };
      }
      if (!best) return;
      const ok = await b.playCard(this.pid, best.inst.iid, best.target);
      if (!ok) return;
      this.actions++;
      this.invalidate();
      await this.pause(300);
    }
  }

  private bestCardTarget(inst: CardInst, def: CardDef): { target: Pos | null; v: number } | null {
    const b = this.b;
    const hero = this.myHero();
    if (def.type === 'equip') {
      let best: { target: Pos; v: number } | null = null;
      for (const p of b.cardTargets(this.pid, inst)) {
        const u = b.unitAt(p.x, p.y)!;
        const v = this.equipValue(def, u);
        if (!best || v > best.v) best = { target: p, v };
      }
      return best;
    }
    const spec = def.target ?? { kind: 'none' };
    const effects = def.effects ?? [];
    if (spec.kind === 'none') {
      return { target: null, v: this.effectsValue(effects, { source: hero, target: null, area: null, spell: true, spec, card: def }) + (def.ai?.value ?? 0) };
    }
    const targets = b.cardTargets(this.pid, inst);
    let best: { target: Pos; v: number } | null = null;
    // limit candidate tiles for big tile lists
    const cands = spec.kind === 'tile' && targets.length > 40 ? this.prefilterTiles(targets, spec) : targets;
    for (const t of cands) {
      const tgt = spec.kind === 'unit' ? b.unitAt(t.x, t.y) ?? null : b.unitAt(t.x, t.y) ?? null;
      const area = b.areaOf(spec, hero, t);
      const v = this.effectsValue(effects, { source: hero, target: spec.kind === 'unit' ? tgt : null, area, spell: true, spec, card: def, pos: t }) + (def.ai?.value ?? 0);
      if (!best || v > best.v) best = { target: t, v };
    }
    return best;
  }

  /** keep only tiles near units (where AoE could matter) */
  private prefilterTiles(tiles: Pos[], spec: TargetSpec): Pos[] {
    const b = this.b;
    const r = (spec.radius ?? 0) + 1;
    const units = b.alive();
    const out = tiles.filter((t) => units.some((u) => cheb(u, t) <= r));
    return out.length ? out : tiles.slice(0, 20);
  }

  private equipValue(def: CardDef, u: Unit): number {
    const e = def.equip!;
    let v = 0;
    v += (e.ac ?? 0) * 1.5;
    v += (e.atk ?? 0) * 1.4;
    v += (e.hp ?? 0) * 0.5;
    v += (e.move ?? 0) * 0.7;
    v += (e.range ?? 0) * 1.2;
    v += (e.jump ?? 0) * 0.3;
    if (e.dmg) v += diceAvg(String(e.dmg)) * 1.3;
    for (const [k, val] of Object.entries(e.kw ?? {})) v += (KW_VALUE[k] ?? 1) * Math.min(2, val ?? 1);
    if (e.triggers) v += 2;
    // prefer healthy, valuable units
    const longevity = u.hp / u.maxHp;
    const scale = (u.isHero ? 1.2 : 0.6 + this.worth(u) / 25) * (0.5 + longevity * 0.5);
    return v * scale;
  }

  // ------------------------------------------------------------------ effect evaluation

  effectsValue(effects: Effect[], c: { source: Unit; target: Unit | null; area: Tile[] | null; spell: boolean; spec: TargetSpec; card?: CardDef; pos?: Pos }): number {
    let v = 0;
    for (const e of effects) v += this.effectValue(e, c);
    return v;
  }

  private sel(sel: Selector | undefined, c: { source: Unit; target: Unit | null; area: Tile[] | null; pos?: Pos }): Unit[] {
    const b = this.b;
    const s = sel ?? 'target';
    switch (s) {
      case 'target':
        if (c.area) return c.area.map((t) => b.unitAt(t.x, t.y)).filter((u): u is Unit => !!u);
        if (c.target) return [c.target];
        if (c.pos) {
          const u = b.unitAt(c.pos.x, c.pos.y);
          return u ? [u] : [];
        }
        return [];
      case 'targetEnemies':
        return this.sel('target', c).filter((u) => this.hostile(u));
      case 'targetAllies':
        return this.sel('target', c).filter((u) => !this.hostile(u));
      case 'self':
        return [c.source];
      case 'hero':
        return [this.myHero()];
      case 'enemyHero':
        return this.enemyHeroes().slice(0, 1);
      case 'allAllies':
        return b.alliesOf(this.pid);
      case 'allEnemies':
        return b.enemiesOf(this.pid);
      case 'allUnits':
        return b.alive();
      case 'adjacentEnemies':
        return b.adjacentEnemies(c.source);
      case 'adjacentAllies':
        return b.adjacentAllies(c.source, c.source.uid);
      case 'adjacentToTarget': {
        const p = c.target ?? c.pos;
        return p ? b.alive().filter((u) => cheb(u, p) === 1) : [];
      }
      case 'nearestEnemy':
      case 'randomEnemy': {
        const es = b.enemiesOf(this.pid);
        return es.length ? [es.sort((a, d) => cheb(a, c.source) - cheb(d, c.source))[0]] : [];
      }
      case 'lowestAlly': {
        const as = b.alliesOf(this.pid).filter((a) => a.hp < a.maxHp);
        return as.sort((a, d) => a.hp / a.maxHp - d.hp / d.maxHp).slice(0, 1);
      }
      default:
        return [];
    }
  }

  private num(n: unknown, card?: CardDef): number {
    let v: unknown = n;
    if (typeof v === 'string' && v.startsWith('$')) v = card?.params?.[v.slice(1)];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return /d/.test(v) ? diceAvg(parseDice(v)) : parseFloat(v) || 0;
    return 0;
  }

  private effectValue(e: Effect, c: { source: Unit; target: Unit | null; area: Tile[] | null; spell: boolean; spec: TargetSpec; card?: CardDef; pos?: Pos }): number {
    const b = this.b;
    const sculpt = c.spell && b.passivesOf(b.player(this.pid)).some((p) => p.sculpt);
    switch (e.op) {
      case 'damage': {
        let amt = this.num(e.amount, c.card);
        if (e.save) amt *= e.save.half ? 0.7 : 0.5;
        if (e.spellAttack) amt *= 0.65;
        let v = 0;
        for (const u of this.sel(e.to, c)) {
          const real = u.immune.includes(e.dmgType ?? 'physical') ? 0 : u.resist.includes(e.dmgType ?? 'physical') ? amt / 2 : u.vuln.includes(e.dmgType ?? 'physical') ? amt * 2 : amt;
          if (this.hostile(u)) {
            const kill = real >= u.hp ? 1 : real >= u.hp * 0.7 ? 0.35 : 0;
            v += u.isHero ? real * 1.4 + kill * 500 : real * (this.worth(u) / Math.max(1, u.maxHp)) + kill * this.worth(u) * 0.9;
          } else if (!sculpt) {
            v -= u.isHero ? real * 2.5 : real * (this.worth(u) / Math.max(1, u.maxHp)) * 1.2;
          }
        }
        return v;
      }
      case 'heal': {
        const amt = this.num(e.amount, c.card);
        let v = 0;
        for (const u of this.sel(e.to, c)) {
          if (this.hostile(u)) {
            v -= Math.min(amt, u.maxHp - u.hp) * 0.8;
            continue;
          }
          const missing = u.maxHp - u.hp;
          v += Math.min(amt, missing) * (u.isHero ? 1.1 : this.worth(u) / Math.max(1, u.maxHp));
        }
        return v;
      }
      case 'status': {
        const base = STATUS_VALUE[e.status] ?? 1;
        const neg = NEGATIVE.has(e.status);
        let v = 0;
        for (const u of this.sel(e.to, c)) {
          if (b.has(u, e.status)) continue;
          if ((e.status === 'stunned' || e.status === 'frozen' || e.status === 'rooted' || e.status === 'prone') && b.kw(u, 'unstoppable')) continue;
          const w = u.isHero ? 1.6 : 0.5 + this.worth(u) / 20;
          if (neg === this.hostile(u)) v += base * w * (e.save ? 0.55 : 1);
          else v -= base * w * 0.8;
        }
        return v;
      }
      case 'cleanse': {
        let v = 0;
        for (const u of this.sel(e.to, c)) if (!this.hostile(u)) v += u.statuses.filter((s) => NEGATIVE.has(s.id)).length * 2.5;
        return v;
      }
      case 'buff': {
        const amt = this.num(e.amount, c.card);
        const per = { atk: 1.5, ac: 1.4, maxHp: 0.5, move: 0.6, range: 1.2, dmg: 1.3 }[e.stat];
        let v = 0;
        for (const u of this.sel(e.to, c)) v += (this.hostile(u) ? -1 : 1) * amt * per * (e.turns && e.turns < 99 ? 0.6 : 1.3);
        return v;
      }
      case 'keyword': {
        let v = 0;
        for (const u of this.sel(e.to, c)) {
          if (this.hostile(u)) continue;
          if (e.kw === 'keen' && (e.value ?? 1) >= 5) v += b.canAct(u) && b.attackTargets(u).length ? 7 : 0.5;
          else v += (KW_VALUE[e.kw] ?? 1) * (e.turns ? 0.6 : 1) * (u.isHero ? 1.3 : 1);
        }
        return v;
      }
      case 'summon': {
        let w = 4;
        try {
          const d = getCard(e.card);
          w = 2 + d.cost * 2.2;
        } catch {
          /* ignore */
        }
        return w * (e.count ?? 1);
      }
      case 'draw':
        return this.num(e.n, c.card) * 3 * (b.player(this.pid).hand.length >= 6 ? 0.3 : 1);
      case 'mana':
        return this.num(e.n, c.card) * 1.6;
      case 'fate':
        return this.num(e.n, c.card) * 2;
      case 'surface': {
        const tiles = c.area ?? (c.pos ? [b.board.get(c.pos)] : []);
        let v = 0;
        for (const t of tiles) {
          const u = b.unitAt(t.x, t.y);
          if (!u) continue;
          const sign = this.hostile(u) ? 1 : -1;
          if (e.surface === 'fire' || e.surface === 'poison') v += sign * 2.5;
          if (e.surface === 'holy') v -= sign * 1.5;
          if (e.surface === 'ice' || e.surface === 'oil') v += sign * 1;
        }
        return v + 0.5;
      }
      case 'raise': {
        const tiles = c.area ?? (c.pos ? [b.board.get(c.pos)] : []);
        let v = 0;
        for (const t of tiles) {
          const u = b.unitAt(t.x, t.y);
          if (u && !this.hostile(u) && b.isRanged(u)) v += 2.5 * e.amount;
          if (u && this.hostile(u) && b.isRanged(u)) v -= 2;
        }
        return v;
      }
      case 'terrain':
        return 0.5;
      case 'push':
      case 'pull': {
        let v = 0;
        for (const u of this.sel(e.to, c)) if (this.hostile(u)) v += 1.5 + (u.isHero ? 1 : 0);
        return v;
      }
      case 'teleportSelf':
        return 0;
      case 'destroy': {
        let v = 0;
        for (const u of this.sel(e.to, c)) v += this.hostile(u) ? this.worth(u) : -this.worth(u) * 0.6;
        return v;
      }
      case 'addCard':
        return (e.n ?? 1) * 2;
      case 'refresh':
        return this.sel(e.to, c).filter((u) => !this.hostile(u)).length * 4;
      case 'fx':
        return 0;
      case 'chance':
        return e.p * this.effectsValue(e.then, c) + (1 - e.p) * (e.else ? this.effectsValue(e.else, c) : 0);
      case 'roll': {
        const rows = [...e.table].sort((a, d) => a.min - d.min);
        let v = 0;
        for (let i = 0; i < rows.length; i++) {
          const lo = Math.max(1, rows[i].min);
          const hi = i + 1 < rows.length ? rows[i + 1].min - 1 : e.die;
          const p = Math.max(0, hi - lo + 1) / e.die;
          v += p * this.effectsValue(rows[i].effects, c);
        }
        return v;
      }
      case 'custom': {
        // unknown: assume it does roughly what its cost suggests when aimed at a sensible target
        const cost = c.card?.cost ?? 2;
        const t = c.target ?? (c.pos ? b.unitAt(c.pos.x, c.pos.y) ?? null : null);
        const spec = c.spec;
        if (spec.kind === 'unit') {
          if (!t) return 0;
          const enemyTarget = this.hostile(t);
          if (spec.side === 'enemy' && !enemyTarget) return -5;
          if (spec.side === 'ally' && enemyTarget) return -5;
          if (enemyTarget) return cost * 3 + (t.isHero ? 2 : this.worth(t) / 6) + (t.hp < t.maxHp / 2 ? 2 : 0);
          return cost * 2.2;
        }
        if (spec.kind === 'tile') {
          const area = c.area ?? (c.pos ? b.board.area(c.pos, 1) : []);
          const es = area.map((x) => b.unitAt(x.x, x.y)).filter((u): u is Unit => !!u && this.hostile(u)).length;
          return es ? cost * 2 * es : cost * 0.8;
        }
        return cost * 2.2;
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------ power, potions, replace

  private async heroPower(): Promise<void> {
    const b = this.b;
    if (!this.alive || !b.canHeroPower(this.pid).ok) return;
    const pw = b.player(this.pid).commander.power!;
    const hero = this.myHero();
    let best: { t: Pos | null; v: number } | null = null;
    if (pw.target.kind === 'none') {
      best = { t: null, v: this.effectsValue(pw.effects, { source: hero, target: null, area: null, spell: true, spec: pw.target }) };
    } else {
      for (const t of b.heroPowerTargets(this.pid)) {
        const tgt = b.unitAt(t.x, t.y) ?? null;
        const area = b.areaOf(pw.target, hero, t);
        const v = this.effectsValue(pw.effects, { source: hero, target: pw.target.kind === 'unit' ? tgt : null, area, spell: true, spec: pw.target, pos: t });
        if (!best || v > best.v) best = { t, v };
      }
    }
    if (best && best.v >= Math.max(2, pw.cost * 1.3)) {
      await b.heroPower(this.pid, best.t);
      this.actions++;
      this.invalidate();
      await this.pause(300);
    }
  }

  private async potions(): Promise<void> {
    const b = this.b;
    const p = b.player(this.pid);
    for (let i = 0; i < p.potions.length && this.alive; i++) {
      const id = p.potions[i];
      if (!id) continue;
      const def = getPotion(id);
      const hero = this.myHero();
      if (def.target.kind === 'none') {
        const v = this.effectsValue(def.effects, { source: hero, target: null, area: null, spell: true, spec: def.target });
        if (v > 5) await b.usePotion(this.pid, i, null);
        continue;
      }
      let best: { t: Pos; v: number } | null = null;
      for (const t of b.potionTargets(this.pid, i)) {
        const tgt = b.unitAt(t.x, t.y) ?? null;
        const v = this.effectsValue(def.effects, { source: hero, target: tgt, area: b.areaOf(def.target, hero, t), spell: true, spec: def.target, pos: t });
        if (!best || v > best.v) best = { t, v };
      }
      if (best && best.v > 6) await b.usePotion(this.pid, i, best.t);
    }
  }

  private async maybeReplace(): Promise<void> {
    const b = this.b;
    const p = b.player(this.pid);
    if (p.replaced || p.noReplace || !p.hand.length) return;
    const curses = p.hand.filter((c) => getCard(c.id).type === 'curse');
    let worst = curses[0];
    if (!worst) {
      const heavy = p.hand.filter((c) => b.costOf(p, c) > p.maxMana + 2);
      heavy.sort((a, c) => b.costOf(p, c) - b.costOf(p, a));
      worst = heavy[0];
    }
    if (worst) await b.replace(this.pid, worst.iid);
  }
}

export { Battle };
