import type { BattleResult } from '../app/battleController';
import { app, closeModal, endBattleScene, goto, openModal, startBattle, toast } from '../app/game';
import { Store } from '../app/store';
import { audio } from '../audio/audio';
import { ABILITY_NAMES, type PlayerStats } from '../core/battle';
import { abilityMod } from '../core/dice';
import { canUpgrade, getCard, getPassive, getPotion } from '../core/registry';
import type { Rng } from '../core/rng';
import type { Ability, BiomeId, CardInst, Rarity } from '../core/types';
import { encounterById, type EncounterDef } from '../data/encounters';
import { EVENTS, eventById, type EventOption, type Outcome } from '../data/events';
import { heroById } from '../data/heroes';
import { loadRun, recordRun, recordSkirmish, saveRun, type RunRecord } from './meta';
import * as R from './run';
import type { CheckRoll, RunNode, RunState } from './run';
import { buildEncounterBattle, buildSkirmish, deckFromIds, type PlayerSide } from './setup';

/**
 * The expedition controller: owns the active RunState, routes between
 * screens and applies every reward, purchase, event outcome and battle
 * result. UI components call these functions and re-render on `flow.rev`.
 */

export type Ending =
  | { kind: 'run'; win: boolean; record: RunRecord; heroId: string; killedBy: string | null; run: RunState }
  | {
      kind: 'skirmish';
      won: boolean;
      hasHuman: boolean;
      winnerTeam: number | null;
      rounds: number;
      players: { name: string; color: string; icon: string; colors?: [string, string, string]; team: number; alive: boolean; human: boolean; stats: PlayerStats }[];
    };

export interface LastBattle {
  name: string;
  kind: 'battle' | 'elite' | 'boss';
  rounds: number;
  dmg: number;
  kills: number;
  nat20: number;
  crits: number;
  hpLost: number;
  xp: number;
  levelUps: number;
}

export interface SkirmishSide {
  heroId: string;
  deck: string[];
  deckName: string;
  ai: boolean;
  aiLevel: number;
}

export type SkirmishMode = '1v1' | 'ffa3' | 'ffa4' | '2v2';

export interface SkirmishConfig {
  mode: SkirmishMode;
  sides: SkirmishSide[];
  biome: BiomeId;
  size: number;
}

interface FlowState {
  run: RunState | null;
  rev: number;
  ending: Ending | null;
  skirmish: SkirmishConfig | null;
  /** show the act title card on the map */
  actIntro: number | null;
  lastBattle: LastBattle | null;
}

export const flow = new Store<FlowState>({ run: null, rev: 0, ending: null, skirmish: null, actIntro: null, lastBattle: null });

export function cur(): RunState {
  const r = flow.get().run;
  if (!r) throw new Error('no active run');
  return r;
}

export function commit(): void {
  const r = flow.get().run;
  if (r && !r.over) saveRun(r);
  flow.set({ rev: flow.get().rev + 1 });
}

let battleEndHandler: ((r: BattleResult) => void) | null = null;
let battleKind: 'run' | 'skirmish' | null = null;

/** what kind of battle is on screen (for the in-battle menu) */
export function battleContext(): 'run' | 'skirmish' | null {
  return app.get().battle ? battleKind : null;
}

// ======================================================================
// Starting / resuming
// ======================================================================

export async function startNewRun(heroId: string, ascension: number): Promise<void> {
  const run = R.newRun(heroId, { ascension });
  flow.set({ run, rev: 0, ending: null, actIntro: 1, lastBattle: null });
  saveRun(run);
  await goto('map');
}

export async function continueRun(): Promise<void> {
  const run = loadRun();
  if (!run) {
    toast('没有可以继续的远征');
    return;
  }
  R.ensurePotionSlots(run);
  flow.set({ run, rev: 0, ending: null, actIntro: null, lastBattle: null });
  if (run.pending) return goto(run.pending.source === 'treasure' ? 'treasure' : 'reward');
  if (run.levelUps) return goto('levelup');
  const node = run.entered != null ? R.nodeById(run, run.entered) : undefined;
  if (node) {
    if (node.kind === 'shop' && run.shop) return goto('shop');
    if (node.kind === 'rest') return goto('rest');
    if (node.kind === 'event' && run.eventId) return goto('event');
  }
  return goto('map');
}

/** leave the current run screen for the title; progress is already saved */
export async function quitToTitle(): Promise<void> {
  battleEndHandler = null;
  await goto('title', () => endBattleScene());
}

export async function abandonRun(): Promise<void> {
  const run = flow.get().run;
  if (!run) return;
  await finishRun(false, '放弃了远征');
}

// ======================================================================
// Map
// ======================================================================

export function isFight(kind: R.NodeKind): boolean {
  return kind === 'battle' || kind === 'elite' || kind === 'boss';
}

export async function chooseNode(id: number): Promise<void> {
  const run = cur();
  if (run.entered != null || run.pending) return;
  const node = R.reachableNodes(run).find((n) => n.id === id);
  if (!node) return;
  audio.play('page');
  run.pos = node.id;
  node.visited = true;
  run.stats.floors++;
  run.entered = node.id;
  run.nodeDone = false;
  switch (node.kind) {
    case 'battle':
    case 'elite':
    case 'boss':
      // the map screen shows the encounter card; the player starts the fight from there
      commit();
      return;
    case 'event':
      startEvent(run);
      commit();
      return goto('event');
    case 'shop':
      run.shop = R.makeShop(run);
      commit();
      return goto('shop');
    case 'rest':
      commit();
      return goto('rest');
    case 'treasure':
      run.pending = R.treasureRewards(run);
      commit();
      return goto('treasure');
  }
}

/** the encounter waiting behind the entered battle node */
export function pendingEncounter(run: RunState): EncounterDef | null {
  if (run.entered == null || run.pending || run.eventFight) return null;
  const node = R.nodeById(run, run.entered);
  if (!node || !isFight(node.kind)) return null;
  return R.encounterFor(run, node);
}

// ======================================================================
// Battles
// ======================================================================

export function playerSide(run: RunState): PlayerSide {
  const h = R.hero(run);
  return {
    hero: h,
    name: h.name,
    deck: run.deck.map((c) => ({ ...c })),
    hp: run.hp,
    maxHp: run.maxHp,
    passives: [...run.relics, ...run.feats],
    potions: [...run.potions],
    abilities: h.abilities,
    prof: 2 + Math.floor((run.level - 1) / 2),
    isAI: false,
  };
}

export async function beginBattle(): Promise<void> {
  const run = cur();
  const node = run.entered != null ? R.nodeById(run, run.entered) : undefined;
  if (!node) return;
  const enc = run.eventFight ? encounterById(run.eventFight) : R.encounterFor(run, node);
  const setup = buildEncounterBattle({
    seed: (R.battleSeed(run, node) + (run.eventFight ? 7777 : 0)) >>> 0,
    player: playerSide(run),
    encounter: enc,
    ascension: run.ascension,
    karmic: app.get().settings.karmic,
  });
  battleEndHandler = (r) => void onRunBattleEnd(enc, r);
  battleKind = 'run';
  await startBattle(setup, [0], (r) => battleEndHandler?.(r), enc.kind === 'boss' ? 'boss' : 'battle');
}

async function onRunBattleEnd(enc: EncounterDef, r: BattleResult): Promise<void> {
  battleEndHandler = null;
  const run = cur();
  const b = r.battle;
  const p = b.players[0];
  const s = p.stats;
  run.stats.dmgDealt += s.dmgDealt;
  run.stats.dmgTaken += s.dmgTaken;
  run.stats.kills += s.kills;
  run.stats.crits += s.crits;
  run.stats.nat20 += s.nat20;
  run.stats.nat1 += s.nat1;
  run.stats.rerolls += s.rerolls;
  const won = r.winner != null && b.players[r.winner]?.team === p.team;
  if (!won) {
    run.hp = 0;
    await finishRun(false, enc.commander.name);
    return;
  }
  const heroU = b.units.get(p.heroUid);
  const hpBefore = run.hp;
  run.hp = Math.max(1, Math.min(run.maxHp, heroU?.hp ?? 1));
  run.potions = [...p.potions];
  R.ensurePotionSlots(run);
  if (p.flags.phylactery && run.relics.includes('relic-phylactery')) {
    run.relics = run.relics.map((x) => (x === 'relic-phylactery' ? 'relic-phylactery-used' : x));
  }
  const healAfter = R.runPassives(run).reduce((a, x) => a + (x.afterBattleHeal ?? 0), 0);
  if (healAfter) R.heal(run, healAfter);
  const kind: LastBattle['kind'] = enc.kind === 'boss' ? 'boss' : enc.kind === 'elite' ? 'elite' : 'battle';
  if (kind === 'boss') run.stats.bosses++;
  else if (kind === 'elite') run.stats.elites++;
  else run.stats.battles++;
  run.usedEncounters.push(enc.id);
  const xp = kind === 'boss' ? 3 : kind === 'elite' ? 2 : 1;
  const ups = R.gainXp(run, xp);
  run.levelUps = (run.levelUps ?? 0) + ups;
  flow.set({ lastBattle: { name: enc.name, kind, rounds: b.round, dmg: s.dmgDealt, kills: s.kills, nat20: s.nat20, crits: s.crits, hpLost: Math.max(0, hpBefore - run.hp), xp, levelUps: ups } });
  run.eventFight = null;
  if (kind === 'boss' && run.act >= run.acts) {
    await finishRun(true, null);
    return;
  }
  run.pending = R.battleRewards(run, kind, p.gold);
  commit();
  await goto('reward', () => endBattleScene());
}

/** give up the current battle (counts as a defeat) */
export function concede(): void {
  const ctl = app.get().battle;
  if (!ctl || ctl.ended) return;
  ctl.ended = true;
  closeModal();
  const b = ctl.battle;
  const humans = [...ctl.humans];
  for (const h of humans) b.players[h].alive = false;
  const other = b.players.find((p) => !humans.includes(p.id));
  const r: BattleResult = { winner: other ? other.id : null, battle: b };
  if (battleEndHandler) battleEndHandler(r);
}

/** debug / automated tests: resolve the current battle immediately */
export function debugEndBattle(win: boolean): void {
  const ctl = app.get().battle;
  if (!ctl || ctl.ended) return;
  ctl.ended = true;
  const b = ctl.battle;
  const me = [...ctl.humans][0] ?? 0;
  const other = b.players.find((p) => p.id !== me)!;
  if (win) other.alive = false;
  else b.players[me].alive = false;
  battleEndHandler?.({ winner: win ? me : other.id, battle: b });
}

// ======================================================================
// Rewards
// ======================================================================

export function claimGold(): void {
  const run = cur();
  const pr = run.pending;
  if (!pr || pr.claimed.gold || !pr.gold) return;
  R.gainGold(run, pr.gold);
  pr.claimed.gold = true;
  audio.play('gold');
  commit();
}

export function claimPotion(): void {
  const run = cur();
  const pr = run.pending;
  if (!pr?.potion || pr.claimed.potion) return;
  if (!R.addPotion(run, pr.potion)) {
    audio.play('error');
    toast('药水栏已满——先在顶栏丢弃一瓶药水');
    return;
  }
  pr.claimed.potion = true;
  audio.play('buff');
  commit();
}

export function claimRelic(): void {
  const run = cur();
  const pr = run.pending;
  if (!pr?.relic || pr.claimed.relic) return;
  R.addRelic(run, pr.relic);
  pr.claimed.relic = true;
  audio.play('fate');
  commit();
}

export function claimBossRelic(id: string): void {
  const run = cur();
  const pr = run.pending;
  if (!pr?.bossRelics || pr.claimed.boss || !pr.bossRelics.includes(id)) return;
  R.addRelic(run, id);
  pr.claimed.boss = true;
  audio.play('fate');
  commit();
}

export async function claimCard(row: number, idx: number): Promise<void> {
  const run = cur();
  const pr = run.pending;
  if (!pr || pr.claimed.cards[row]) return;
  const id = pr.cards[row]?.[idx];
  if (!id) return;
  const ok = await offerCard(id, !!pr.cardsUp[row]?.[idx]);
  if (!ok) return;
  pr.claimed.cards[row] = true;
  commit();
}

export function skipCards(row: number): void {
  const run = cur();
  const pr = run.pending;
  if (!pr) return;
  pr.claimed.cards[row] = true;
  audio.play('page');
  commit();
}

export async function finishRewards(): Promise<void> {
  const run = cur();
  const pr = run.pending;
  if (pr && pr.gold && !pr.claimed.gold) R.gainGold(run, pr.gold);
  run.pending = null;
  commit();
  await afterNode();
}

// ======================================================================
// Node completion & acts
// ======================================================================

export async function afterNode(): Promise<void> {
  const run = cur();
  if (run.over === 'lose' || run.hp <= 0) return finishRun(false, '伤重不治');
  if (run.pending) return goto(run.pending.source === 'treasure' ? 'treasure' : 'reward', () => endBattleScene());
  if (run.levelUps) {
    ensureFeatChoices(run);
    commit();
    return goto('levelup', () => endBattleScene());
  }
  const node = run.pos != null ? R.nodeById(run, run.pos) : undefined;
  run.entered = null;
  run.eventId = null;
  run.eventView = null;
  run.eventFight = null;
  run.shop = null;
  run.nodeDone = false;
  if (node?.kind === 'boss') return nextAct();
  commit();
  await goto('map', () => endBattleScene());
}

async function nextAct(): Promise<void> {
  const run = cur();
  run.act++;
  const missing = run.maxHp - run.hp;
  R.heal(run, run.ascension >= 5 ? Math.ceil(missing / 2) : missing);
  run.map = R.generateActMap(run, run.act);
  run.pos = null;
  run.entered = null;
  commit();
  flow.set({ actIntro: run.act });
  await goto('map', () => endBattleScene());
}

async function finishRun(win: boolean, killedBy: string | null): Promise<void> {
  const run = cur();
  run.over = win ? 'win' : 'lose';
  const record = recordRun(run, win, killedBy);
  saveRun(null);
  battleEndHandler = null;
  flow.set({ ending: { kind: 'run', win, record, heroId: run.heroId, killedBy, run } });
  await goto('end', () => endBattleScene());
}

// ======================================================================
// Level up
// ======================================================================

function ensureFeatChoices(run: RunState): void {
  if (run.featChoices?.length) return;
  const rng = R.rngOf(run);
  run.featChoices = R.rollFeats(run, rng, 3);
  R.saveRng(run, rng);
}

export async function chooseFeat(id: string): Promise<void> {
  const run = cur();
  if (!run.featChoices?.includes(id)) return;
  R.addFeat(run, id);
  run.levelUps = Math.max(0, (run.levelUps ?? 1) - 1);
  run.featChoices = null;
  audio.play('buff');
  if (run.levelUps > 0) {
    ensureFeatChoices(run);
    commit();
    return;
  }
  commit();
  await afterNode();
}

// ======================================================================
// Deck helpers (deck cap 20 → replace)
// ======================================================================

/** let the player pick a card from the deck; resolves null on cancel */
export function pickCard(o: { title: string; sub?: string; pick: 'upgrade' | 'remove' | 'transform' | 'duplicate'; filter?: (c: CardInst) => boolean; cancelLabel?: string }): Promise<number | null> {
  const run = cur();
  const cands = run.deck.filter((c) => !o.filter || o.filter(c));
  if (!cands.length) {
    toast('没有可以选择的牌');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    openModal({
      kind: 'deck',
      title: o.title,
      sub: o.sub,
      pick: o.pick,
      filter: o.filter ? (iid) => !!run.deck.find((c) => c.iid === iid && o.filter!(c)) : undefined,
      onPick: (iid) => {
        closeModal();
        resolve(iid);
      },
      onCancel: () => resolve(null),
      cancelLabel: o.cancelLabel ?? '取消',
    });
  });
}

/** add a card to the deck; when the deck is full the player chooses a card to replace (or declines) */
export function offerCard(id: string, up: boolean): Promise<boolean> {
  const run = cur();
  if (!R.deckFull(run)) {
    R.addCard(run, id, up);
    audio.play('card');
    commit();
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    openModal({
      kind: 'deck',
      title: `牌组已满（${run.deckCap} 张）`,
      sub: `选择一张牌替换为【${getCard(id).name}${up ? '+' : ''}】，或者放弃这张新牌。`,
      pick: 'replace',
      incoming: { id, up },
      onPick: (iid) => {
        R.removeCard(run, iid);
        R.addCard(run, id, up);
        audio.play('card');
        commit();
        closeModal();
        resolve(true);
      },
      onCancel: () => resolve(false),
      cancelLabel: '放弃新牌',
    });
  });
}

export function discardPotion(slot: number): void {
  const run = cur();
  if (!run.potions[slot]) return;
  run.potions[slot] = null;
  audio.play('page');
  commit();
}

// ======================================================================
// Shop
// ======================================================================

export async function buyCard(i: number): Promise<void> {
  const run = cur();
  const it = run.shop?.cards[i];
  if (!it || it.sold) return;
  if (run.gold < it.price) {
    audio.play('error');
    toast('金币不足');
    return;
  }
  const ok = await offerCard(it.id, it.up);
  if (!ok) return;
  run.gold -= it.price;
  it.sold = true;
  audio.play('coin');
  commit();
}

export function buyRelic(i: number): void {
  const run = cur();
  const it = run.shop?.relics[i];
  if (!it || it.sold) return;
  if (run.gold < it.price) {
    audio.play('error');
    toast('金币不足');
    return;
  }
  run.gold -= it.price;
  it.sold = true;
  R.addRelic(run, it.id);
  audio.play('coin');
  commit();
}

export function buyPotion(i: number): void {
  const run = cur();
  const it = run.shop?.potions[i];
  if (!it || it.sold) return;
  if (run.gold < it.price) {
    audio.play('error');
    toast('金币不足');
    return;
  }
  if (!R.addPotion(run, it.id)) {
    audio.play('error');
    toast('药水栏已满');
    return;
  }
  run.gold -= it.price;
  it.sold = true;
  audio.play('coin');
  commit();
}

export async function buyRemoval(): Promise<void> {
  const run = cur();
  const shop = run.shop;
  if (!shop || shop.removeUsed) return;
  const price = R.removePrice(run);
  if (run.gold < price) {
    audio.play('error');
    toast('金币不足');
    return;
  }
  const iid = await pickCard({ title: '移除一张牌', sub: `花费 ${price} 金币，将一张牌永久移出牌组。`, pick: 'remove' });
  if (iid == null) return;
  R.removeCard(run, iid);
  run.gold -= price;
  shop.removeUsed = true;
  run.removeCost += 25;
  audio.play('curse');
  commit();
}

export async function leaveNode(): Promise<void> {
  await afterNode();
}

// ======================================================================
// Rest site
// ======================================================================

export function restHealAmount(run: RunState): number {
  const bonus = R.runPassives(run).reduce((a, p) => a + (p.restHealBonus ?? 0), 0);
  return Math.round(run.maxHp * (run.ascension >= 5 ? 0.2 : 0.3)) + bonus;
}

export function hasCurse(run: RunState): boolean {
  return run.deck.some((c) => getCard(c.id).type === 'curse');
}

export async function restAction(kind: 'heal' | 'smith' | 'train' | 'purify'): Promise<string | null> {
  const run = cur();
  if (run.nodeDone) return null;
  let msg: string | null = null;
  if (kind === 'heal') {
    const n = R.heal(run, restHealAmount(run));
    audio.play('heal');
    msg = `你在篝火旁沉沉睡去。回复了 ${n} 点生命。`;
  } else if (kind === 'smith') {
    const iid = await pickCard({ title: '锻造：升级一张牌', pick: 'upgrade', filter: (c) => canUpgrade(c) });
    if (iid == null) return null;
    const c = run.deck.find((x) => x.iid === iid)!;
    R.upgradeCard(run, iid);
    audio.play('buff');
    msg = `火星四溅。【${getCard(c.id).name}】升级了。`;
  } else if (kind === 'train') {
    const ups = R.gainXp(run, 2);
    run.levelUps = (run.levelUps ?? 0) + ups;
    audio.play('buff');
    msg = ups ? '你挥汗如雨地练到深夜——你升级了！' : '你挥汗如雨地练到深夜。获得 2 点经验。';
  } else {
    const iid = await pickCard({ title: '净化：移除一张诅咒', pick: 'remove', filter: (c) => getCard(c.id).type === 'curse' });
    if (iid == null) return null;
    const c = run.deck.find((x) => x.iid === iid)!;
    R.removeCard(run, iid);
    audio.play('heal');
    msg = `篝火吞没了【${getCard(c.id).name}】。你感到轻松了许多。`;
  }
  run.nodeDone = true;
  commit();
  return msg;
}

// ======================================================================
// Events
// ======================================================================

function startEvent(run: RunState): void {
  const rng = R.rngOf(run);
  let cands = EVENTS.filter((e) => e.acts.includes(run.act) && !run.seenEvents.includes(e.id));
  if (!cands.length) cands = EVENTS.filter((e) => e.acts.includes(run.act));
  const ev = rng.pick(cands);
  R.saveRng(run, rng);
  run.eventId = ev.id;
  run.eventView = null;
  run.seenEvents.push(ev.id);
  run.stats.events++;
}

export function checkMods(run: RunState, ability?: Ability): { label: string; value: number }[] {
  if (!ability) return [];
  const h = R.hero(run);
  const mods = [{ label: ABILITY_NAMES[ability], value: abilityMod(h.abilities?.[ability] ?? 10) }];
  const lv = Math.floor((run.level - 1) / 2);
  if (lv) mods.push({ label: '等级', value: lv });
  const bonus = R.runPassives(run).reduce((a, p) => a + (p.checkBonus ?? 0), 0);
  if (bonus) mods.push({ label: '遗物·专长', value: bonus });
  return mods;
}

function heroLucky(run: RunState): boolean {
  return !!R.hero(run).stats.kw?.lucky;
}

/** probability that a check succeeds (nat 20 always succeeds, nat 1 always fails) */
export function checkChance(run: RunState, ability: Ability | undefined, dc: number): number {
  const m = checkMods(run, ability).reduce((a, x) => a + x.value, 0);
  let n = 0;
  for (let v = 1; v <= 20; v++) if (v === 20 || (v !== 1 && v + m >= dc)) n++;
  let p = n / 20;
  if (heroLucky(run)) p += (1 / 20) * p;
  return p;
}

function rollCheck(run: RunState, rng: Rng, ability: Ability | undefined, dc: number): CheckRoll {
  const mods = checkMods(run, ability);
  const m = mods.reduce((a, x) => a + x.value, 0);
  let nat = rng.int(1, 20);
  let luckyFrom: number | undefined;
  if (nat === 1 && heroLucky(run)) {
    luckyFrom = 1;
    nat = rng.int(1, 20);
  }
  const total = nat + m;
  const success = nat === 20 || (nat !== 1 && total >= dc);
  return { kind: ability ? 'check' : 'luck', ability, dc, nat, luckyFrom, mods, total, success };
}

export function optionState(run: RunState, opt: EventOption): { ok: boolean; reason?: string } {
  const q = opt.requires;
  if (q?.gold && run.gold < q.gold) return { ok: false, reason: `需要 ${q.gold} 金币` };
  if (q?.potion && !run.potions.some(Boolean)) return { ok: false, reason: '需要一瓶药水' };
  if (q?.deckSpace && R.deckFull(run)) return { ok: false, reason: '牌组已满' };
  if (q?.curse && !hasCurse(run)) return { ok: false, reason: '牌组中没有诅咒' };
  if (q?.act && !q.act.includes(run.act)) return { ok: false, reason: '现在不行' };
  if (opt.cost?.hp && run.hp <= opt.cost.hp) return { ok: false, reason: '生命不足' };
  if (opt.cost?.gold && run.gold < opt.cost.gold) return { ok: false, reason: `需要 ${opt.cost.gold} 金币` };
  return { ok: true };
}

export async function chooseEventOption(i: number): Promise<void> {
  const run = cur();
  if (run.eventView || !run.eventId) return;
  const ev = eventById(run.eventId);
  const opt = ev.options[i];
  if (!opt || !optionState(run, opt).ok) {
    audio.play('error');
    return;
  }
  audio.play('click');
  if (opt.cost?.gold) run.gold = Math.max(0, run.gold - opt.cost.gold);
  if (opt.cost?.hp) run.hp = Math.max(1, run.hp - opt.cost.hp);
  if (opt.cost?.potion) {
    const k = run.potions.findIndex(Boolean);
    if (k >= 0) run.potions[k] = null;
  }
  const rng = R.rngOf(run);
  let roll: CheckRoll | null = null;
  let outcome: Outcome;
  if (opt.table?.length) {
    const nat = rng.int(1, 20);
    roll = { kind: 'table', dc: 0, nat, mods: [], total: nat, success: true };
    outcome = [...opt.table].sort((a, b) => b.min - a.min).find((t) => nat >= t.min)?.outcome ?? opt.table[0].outcome;
  } else if (opt.check) {
    roll = rollCheck(run, rng, opt.check.ability, opt.check.dc);
    outcome = roll.success ? opt.success : opt.fail ?? { text: '什么也没有发生。' };
    if (roll.success) run.stats.checksPassed++;
    else run.stats.checksFailed++;
  } else outcome = opt.success;
  if (roll?.nat === 20) run.stats.nat20++;
  if (roll?.nat === 1) run.stats.nat1++;
  R.saveRng(run, rng);
  run.eventView = { option: i, roll, outcome, lines: [], phase: roll ? 'rolling' : 'result' };
  commit();
  if (!roll) await resolveEventOutcome();
}

/** called by the event screen once the dice animation finished */
export async function resolveEventOutcome(): Promise<void> {
  const run = cur();
  const v = run.eventView;
  if (!v || v.applied) return;
  v.applied = true;
  v.phase = 'result';
  commit();
  v.lines = await applyOutcome(run, v.outcome);
  commit();
}

const RARITY_PICK: Partial<Record<Rarity, number>> = { common: 50, rare: 32, epic: 13, legendary: 4 };

function randomCardOf(run: RunState, rng: Rng, kind: NonNullable<Outcome['randomCard']>): string | null {
  let pool = R.rewardPool(R.classOf(run));
  if (kind === 'rare') pool = pool.filter((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary');
  if (kind === 'equip') pool = pool.filter((c) => c.type === 'equip');
  if (kind === 'unit') pool = pool.filter((c) => c.type === 'unit');
  if (!pool.length) return null;
  return rng.weighted(pool, (c) => RARITY_PICK[c.rarity] ?? 10).id;
}

function resolveRelic(run: RunState, rng: Rng, spec: string): string | null {
  if (spec === 'random') return R.rollRelic(run, rng);
  if (spec === 'rare') return R.rollRelic(run, rng, ['rare']);
  if (spec === 'boss') return R.rollRelic(run, rng, ['boss']);
  return run.relics.includes(spec) ? null : spec;
}

async function applyOutcome(run: RunState, o: Outcome): Promise<string[]> {
  const lines: string[] = [];
  const rng = R.rngOf(run);
  // ---- immediate, deterministic effects first (all RNG use happens here)
  if (o.gold) {
    if (o.gold > 0) R.gainGold(run, o.gold);
    else run.gold = Math.max(0, run.gold + o.gold);
    lines.push(`${o.gold > 0 ? '+' : ''}${o.gold} 金币`);
    audio.play('gold');
  }
  if (o.maxHp) {
    run.maxHp = Math.max(1, run.maxHp + o.maxHp);
    run.hp = Math.min(run.hp, run.maxHp);
    lines.push(`最大生命 ${o.maxHp > 0 ? '+' : ''}${o.maxHp}`);
  }
  if (o.hp) {
    if (o.hp > 0) lines.push(`回复 ${R.heal(run, o.hp)} 点生命`);
    else {
      const before = run.hp;
      run.hp = Math.max(1, run.hp + o.hp);
      lines.push(`失去 ${before - run.hp} 点生命`);
      audio.play('hit');
    }
  }
  if (o.healPct) lines.push(`回复 ${R.heal(run, Math.ceil((run.maxHp * o.healPct) / 100))} 点生命`);
  if (o.xp) {
    const ups = R.gainXp(run, o.xp);
    run.levelUps = (run.levelUps ?? 0) + ups;
    lines.push(`+${o.xp} 经验${ups ? '（升级！）' : ''}`);
  }
  if (o.relic) {
    const id = resolveRelic(run, rng, o.relic);
    if (id) {
      R.addRelic(run, id);
      lines.push(`获得遗物【${getPassive(id)?.name ?? id}】`);
      audio.play('fate');
    } else {
      R.gainGold(run, 50);
      lines.push('（遗物已拥有，改为获得 50 金币）');
    }
  }
  if (o.potion) {
    const ids = typeof o.potion === 'number' ? Array.from({ length: o.potion }, () => R.rollPotion(rng)) : [o.potion];
    for (const id of ids) {
      if (R.addPotion(run, id)) lines.push(`获得药水【${getPotion(id).name}】`);
      else lines.push(`药水栏已满，【${getPotion(id).name}】只能留在原地`);
    }
  }
  if (o.losePotion) {
    const have = run.potions.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    if (have.length) {
      const k = rng.pick(have);
      lines.push(`失去药水【${getPotion(run.potions[k]!).name}】`);
      run.potions[k] = null;
    }
  }
  if (o.curse) {
    for (const c of o.curse) {
      R.addCard(run, c);
      lines.push(`牌组加入诅咒【${R.cardName(c)}】`);
    }
    audio.play('curse');
  }
  if (o.removeCurse) {
    const c = run.deck.find((x) => getCard(x.id).type === 'curse');
    if (c) {
      R.removeCard(run, c.iid);
      lines.push(`移除了诅咒【${R.cardName(c.id)}】`);
    }
  }
  if (o.upgradeRandom) {
    const cands = rng.sample(run.deck.filter((c) => canUpgrade(c)), o.upgradeRandom);
    for (const c of cands) {
      c.up = true;
      lines.push(`【${R.cardName(c.id)}】升级了`);
    }
  }
  const gained: { id: string; up: boolean }[] = (o.cards ?? []).map((c) => ({ id: c.id, up: !!c.up }));
  if (o.randomCard) {
    const id = randomCardOf(run, rng, o.randomCard);
    if (id) gained.push({ id, up: false });
  }
  if (o.cardChoice) {
    const cards = R.rollCards(run, rng, 3, o.cardChoice === 'rare' ? 'boss' : 'event');
    run.pending = { source: 'event', gold: 0, cards: [cards], cardsUp: [cards.map(() => false)], potion: null, relic: null, bossRelics: null, feats: null, claimed: { cards: [false], gold: true } };
    lines.push('可以从 3 张牌中选择 1 张');
  }
  if (o.fight) {
    run.eventFight = o.fight;
    lines.push(`遭遇战：${encounterById(o.fight).name}`);
  }
  R.saveRng(run, rng);
  commit();
  // ---- interactive effects
  for (const g of gained) {
    const ok = await offerCard(g.id, g.up);
    lines.push(ok ? `获得卡牌【${R.cardName(g.id)}${g.up ? '+' : ''}】` : `放弃了【${R.cardName(g.id)}】`);
  }
  if (o.choose) {
    const r = await chooseCardAction(run, o.choose);
    if (r) lines.push(r);
  }
  return lines;
}

async function chooseCardAction(run: RunState, kind: NonNullable<Outcome['choose']>): Promise<string | null> {
  if (kind === 'upgrade') {
    const iid = await pickCard({ title: '选择一张牌升级', pick: 'upgrade', filter: (c) => canUpgrade(c), cancelLabel: '放弃' });
    if (iid == null) return null;
    const c = run.deck.find((x) => x.iid === iid)!;
    R.upgradeCard(run, iid);
    commit();
    return `【${R.cardName(c.id)}】升级了`;
  }
  if (kind === 'remove') {
    const iid = await pickCard({ title: '选择一张牌移除', pick: 'remove', cancelLabel: '放弃' });
    if (iid == null) return null;
    const c = run.deck.find((x) => x.iid === iid)!;
    R.removeCard(run, iid);
    commit();
    return `移除了【${R.cardName(c.id)}】`;
  }
  if (kind === 'transform') {
    const iid = await pickCard({ title: '选择一张牌变化', pick: 'transform', cancelLabel: '放弃' });
    if (iid == null) return null;
    const c = run.deck.find((x) => x.iid === iid)!;
    const rng = R.rngOf(run);
    const id = randomCardOf(run, rng, 'any');
    R.saveRng(run, rng);
    R.removeCard(run, iid);
    if (id) R.addCard(run, id);
    commit();
    return id ? `【${R.cardName(c.id)}】变成了【${R.cardName(id)}】` : `【${R.cardName(c.id)}】消失了`;
  }
  const iid = await pickCard({ title: '选择一张牌复制', pick: 'duplicate', filter: (c) => getCard(c.id).type !== 'curse', cancelLabel: '放弃' });
  if (iid == null) return null;
  const c = run.deck.find((x) => x.iid === iid)!;
  const ok = await offerCard(c.id, c.up);
  return ok ? `复制了【${R.cardName(c.id)}】` : null;
}

export async function finishEvent(): Promise<void> {
  const run = cur();
  const v = run.eventView;
  if (v && !v.applied) return;
  if (run.eventFight) {
    commit();
    await beginBattle();
    return;
  }
  await afterNode();
}

// ======================================================================
// Skirmish (free battles, 1v1 / FFA / 2v2, hot-seat capable)
// ======================================================================

export function skirmishTeams(mode: SkirmishMode): number[] {
  if (mode === '2v2') return [0, 0, 1, 1];
  if (mode === 'ffa4') return [0, 1, 2, 3];
  if (mode === 'ffa3') return [0, 1, 2];
  return [0, 1];
}

export async function startSkirmish(cfg: SkirmishConfig): Promise<void> {
  flow.set({ skirmish: cfg, ending: null });
  const teams = skirmishTeams(cfg.mode);
  const sides: PlayerSide[] = cfg.sides.map((s) => {
    const h = heroById(s.heroId);
    return {
      hero: h,
      name: s.ai ? h.name : `${h.name}（玩家）`,
      deck: deckFromIds(s.deck),
      passives: [h.starterRelic],
      potions: ['pot-heal', null],
      isAI: s.ai,
      aiLevel: s.aiLevel,
      abilities: h.abilities,
      prof: 3,
    };
  });
  const setup = buildSkirmish({ seed: Math.floor(Math.random() * 2 ** 31), sides, biome: cfg.biome as 'verdant' | 'ashen' | 'astral', size: cfg.size, teams, karmic: app.get().settings.karmic });
  const humans = cfg.sides.map((s, i) => (s.ai ? -1 : i)).filter((i) => i >= 0);
  battleEndHandler = (r) => void onSkirmishEnd(r, humans);
  battleKind = 'skirmish';
  await startBattle(setup, humans, (r) => battleEndHandler?.(r), 'battle');
}

async function onSkirmishEnd(r: BattleResult, humans: number[]): Promise<void> {
  battleEndHandler = null;
  const b = r.battle;
  const winnerTeam = r.winner != null ? b.players[r.winner].team : null;
  const won = winnerTeam != null && humans.some((h) => b.players[h].team === winnerTeam);
  if (humans.length) recordSkirmish(won);
  flow.set({
    ending: {
      kind: 'skirmish',
      won,
      hasHuman: humans.length > 0,
      winnerTeam,
      rounds: b.round,
      players: b.players.map((p) => ({ name: p.name, color: p.color, icon: p.commander.icon, colors: p.commander.colors, team: p.team, alive: p.alive, human: humans.includes(p.id), stats: { ...p.stats } })),
    },
  });
  await goto('end', () => endBattleScene());
}

export async function rematch(): Promise<void> {
  const cfg = flow.get().skirmish;
  if (cfg) await startSkirmish(cfg);
}

export type { RunNode };
