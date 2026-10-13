import { runAiTurn } from '../core/ai';
import { Battle, type AttackPreview, type BattleSetup, type Unit } from '../core/battle';
import { cheb, posKey } from '../core/board';
import { cardOf, getPotion } from '../core/registry';
import type { CardDef, CardInst, Pos, TargetSpec } from '../core/types';
import { audio } from '../audio/audio';
import { BoardView } from '../render/boardView';
import { Overlay } from '../render/overlay';
import { Presenter } from '../render/presenter';
import { UnitView } from '../render/unitView';
import type { DiceTray } from '../render/dice3d';
import { battleTick, battleUi, resetBattleUi } from './battleUi';
import type { Stage } from './stage';
import { Store, type Settings } from './store';

export type Mode =
  | { kind: 'idle' }
  | { kind: 'unit'; uid: number }
  | { kind: 'card'; iid: number; targets: Pos[] }
  | { kind: 'power'; targets: Pos[] }
  | { kind: 'potion'; slot: number; targets: Pos[] }
  | { kind: 'ability'; uid: number; targets: Pos[] }
  | { kind: 'replace' };

export interface HoverInfo {
  pos: Pos;
  uid: number | null;
  preview: AttackPreview | null;
  /** attacker uid for the preview */
  attacker: number | null;
  /** valid target in current targeting mode */
  valid: boolean;
  screen: { x: number; y: number };
}

export interface ControllerState {
  mode: Mode;
  hover: HoverInfo | null;
  showThreat: boolean;
}

export interface BattleResult {
  winner: number | null;
  battle: Battle;
}

export class BattleController {
  readonly battle: Battle;
  readonly presenter: Presenter;
  readonly board: BoardView;
  readonly units: UnitView;
  readonly overlay: Overlay;
  readonly state = new Store<ControllerState>({ mode: { kind: 'idle' }, hover: null, showThreat: false });
  readonly humans: Set<number>;
  private busy = false;
  private disposed = false;
  private offFrame: (() => void) | null = null;
  private listeners: (() => void)[] = [];
  private lastPointer = { x: 0, y: 0 };
  private drag: { x: number; y: number; button: number; moved: boolean } | null = null;
  ended = false;

  constructor(
    readonly stage: Stage,
    setup: BattleSetup,
    humans: number[],
    private settings: Settings,
    private onEnd: (r: BattleResult) => void,
  ) {
    this.humans = new Set(humans);
    stage.reset();
    resetBattleUi();
    const world = stage.world;
    this.board = new BoardView(world, setup.board, stage.particles);
    this.units = new UnitView(world, this.board);
    const colors = setup.players.map((p) => p.color);
    this.board.playerColors = colors;
    this.units.playerColors = colors;
    this.overlay = new Overlay(world, this.units, world.container);
    this.presenter = new Presenter(world, this.board, this.units, stage.fx, stage.particles, this.overlay, {
      animSpeed: settings.animSpeed,
      diceSpeed: settings.diceSpeed,
      showDice: settings.showDice,
      fatePrompt: settings.fatePrompt,
      shake: settings.shake,
    });
    this.presenter.humans = this.humans;
    this.battle = new Battle({ ...setup, karmic: settings.karmic }, this.presenter);
    this.presenter.battle = this.battle;
    for (const u of this.battle.units.values()) this.units.add(u, false);
    this.overlay.sync(this.battle, colors);
    this.offFrame = world.onFrame((dt, t) => {
      this.board.update(dt, t);
      this.units.update(dt, t);
      this.overlay.update(dt);
    });
    this.bindInput();
  }

  setTrays(small: DiceTray | null, big: () => DiceTray | null): void {
    this.presenter.tray = small;
    this.presenter.bigTray = big;
  }

  updateSettings(s: Settings): void {
    this.settings = s;
    Object.assign(this.presenter.settings, { animSpeed: s.animSpeed, diceSpeed: s.diceSpeed, showDice: s.showDice, fatePrompt: s.fatePrompt, shake: s.shake });
  }

  get isHumanTurn(): boolean {
    return !this.battle.over && this.humans.has(this.battle.active);
  }

  get canInput(): boolean {
    return this.isHumanTurn && !this.busy && !this.ended;
  }

  get human(): number {
    return this.isHumanTurn ? this.battle.active : [...this.humans][0] ?? 0;
  }

  async start(): Promise<void> {
    this.busy = true;
    battleUi.set({ busy: true });
    await this.battle.start();
    this.busy = false;
    battleUi.set({ busy: false });
    await this.afterAction();
  }

  // ================================================================== loop

  private async act(fn: () => Promise<unknown>): Promise<void> {
    if (this.busy || this.ended) return;
    this.busy = true;
    battleUi.set({ busy: true });
    this.clearHighlights();
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
    this.busy = false;
    battleUi.set({ busy: false });
    await this.afterAction();
  }

  private async afterAction(): Promise<void> {
    const b = this.battle;
    if (this.disposed) return;
    if (b.over) return this.finish();
    if (!b.players[b.active].alive) {
      this.busy = true;
      await b.endTurn();
      this.busy = false;
    }
    if (b.over) return this.finish();
    if (!this.humans.has(b.active)) {
      await this.runAis();
      return;
    }
    // keep selection if still useful
    const m = this.state.get().mode;
    if (m.kind === 'unit') {
      const u = b.unit(m.uid);
      if (!u || (!b.canAct(u) && !b.canMove(u))) this.setMode({ kind: 'idle' });
      else this.setMode(m);
    } else if (m.kind !== 'idle') this.setMode({ kind: 'idle' });
    else this.refreshHighlights();
    battleTick.bump();
  }

  private async runAis(): Promise<void> {
    const b = this.battle;
    this.busy = true;
    battleUi.set({ busy: true, aiThinking: true });
    this.setMode({ kind: 'idle' });
    while (!b.over && !this.disposed && !this.humans.has(b.active) && b.players[b.active].alive) {
      await runAiTurn(b, b.active, { pause: (ms) => new Promise((r) => setTimeout(r, ms / Math.max(0.25, this.settings.animSpeed))), cancelled: () => this.disposed });
      if (!b.over && !this.humans.has(b.active) && !b.players[b.active].alive) await b.endTurn();
    }
    this.busy = false;
    battleUi.set({ busy: false, aiThinking: false });
    if (b.over) return this.finish();
    if (!b.players[b.active].alive) await this.afterAction();
    this.refreshHighlights();
    battleTick.bump();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.clearHighlights();
    const b = this.battle;
    const won = b.winner != null && this.humans.has(b.winner);
    audio.play(won ? 'victory' : 'defeat');
    battleTick.bump();
    setTimeout(() => this.onEnd({ winner: b.winner, battle: b }), 900);
  }

  // ================================================================== commands (HUD)

  endTurn(): void {
    if (!this.canInput) return;
    audio.play('click');
    this.setMode({ kind: 'idle' });
    void this.act(() => this.battle.endTurn());
  }

  selectCard(inst: CardInst): void {
    if (!this.canInput) return;
    const b = this.battle;
    const m = this.state.get().mode;
    if (m.kind === 'replace') {
      audio.play('card');
      void this.act(() => b.replace(this.human, inst.iid));
      return;
    }
    if (m.kind === 'card' && m.iid === inst.iid) {
      this.setMode({ kind: 'idle' });
      return;
    }
    const can = b.canPlay(this.human, inst);
    if (!can.ok) {
      audio.play('error');
      this.toast(can.reason ?? '无法打出');
      return;
    }
    const def = cardOf(inst);
    audio.play('click');
    if (!b.needsTarget(def)) {
      void this.act(() => b.playCard(this.human, inst.iid, null));
      return;
    }
    this.setMode({ kind: 'card', iid: inst.iid, targets: b.cardTargets(this.human, inst) });
  }

  heroPower(): void {
    if (!this.canInput) return;
    const b = this.battle;
    const can = b.canHeroPower(this.human);
    if (!can.ok) {
      audio.play('error');
      this.toast(can.reason ?? '无法使用');
      return;
    }
    const pw = b.player(this.human).commander.power!;
    audio.play('click');
    if (pw.target.kind === 'none') {
      void this.act(() => b.heroPower(this.human, null));
      return;
    }
    const m = this.state.get().mode;
    if (m.kind === 'power') return this.setMode({ kind: 'idle' });
    this.setMode({ kind: 'power', targets: b.heroPowerTargets(this.human) });
  }

  usePotion(slot: number): void {
    if (!this.canInput) return;
    const b = this.battle;
    const id = b.player(this.human).potions[slot];
    if (!id) return;
    const def = getPotion(id);
    audio.play('click');
    if (def.target.kind === 'none') {
      void this.act(() => b.usePotion(this.human, slot, null));
      return;
    }
    this.setMode({ kind: 'potion', slot, targets: b.potionTargets(this.human, slot) });
  }

  useAbility(uid: number): void {
    if (!this.canInput) return;
    const b = this.battle;
    const u = b.unit(uid);
    if (!u || !u.ability || !b.canAct(u) || u.abilityCd > 0) {
      audio.play('error');
      return;
    }
    audio.play('click');
    if (u.ability.target.kind === 'none') {
      void this.act(() => b.useAbility(uid, null));
      return;
    }
    this.setMode({ kind: 'ability', uid, targets: b.abilityTargets(u) });
  }

  toggleReplace(): void {
    if (!this.canInput) return;
    const p = this.battle.player(this.human);
    if (p.replaced || p.noReplace) {
      this.toast(p.noReplace ? '统御王冠：无法换牌' : '本回合已换过牌');
      return;
    }
    audio.play('click');
    const m = this.state.get().mode;
    this.setMode(m.kind === 'replace' ? { kind: 'idle' } : { kind: 'replace' });
  }

  cancel(): void {
    this.setMode({ kind: 'idle' });
  }

  selectUnit(uid: number): void {
    const u = this.battle.unit(uid);
    if (!u) return;
    if (this.canInput && u.owner === this.human) this.setMode({ kind: 'unit', uid });
    else this.setMode({ kind: 'idle' });
    this.world.cam.focus(this.units.worldPos(uid, 0), 0.25);
  }

  cycleUnit(): void {
    if (!this.canInput) return;
    const b = this.battle;
    const mine = b.unitsOf(this.human).filter((u) => b.canAct(u) || b.canMove(u));
    if (!mine.length) return;
    const m = this.state.get().mode;
    const idx = m.kind === 'unit' ? mine.findIndex((u) => u.uid === m.uid) : -1;
    const next = mine[(idx + 1) % mine.length];
    this.selectUnit(next.uid);
  }

  toggleThreat(): void {
    this.state.set({ showThreat: !this.state.get().showThreat });
    this.refreshHighlights();
  }

  concede(): void {
    if (this.ended) return;
    void this.act(() => this.battle.concede(this.human));
  }

  toast(text: string): void {
    battleUi.update((s) => ({ log: [...s.log.slice(-60), { id: Date.now(), text, tone: 'warn' }] }));
    window.dispatchEvent(new CustomEvent('toast', { detail: text }));
  }

  private get world() {
    return this.stage.world;
  }

  // ================================================================== mode & highlights

  setMode(mode: Mode): void {
    this.state.set({ mode });
    this.units.setSelected(mode.kind === 'unit' || mode.kind === 'ability' ? mode.uid : null);
    this.refreshHighlights();
    battleTick.bump();
  }

  private clearHighlights(): void {
    this.board.clearHighlights();
    this.board.showPath(null);
    this.board.setCursor(null);
  }

  private specOf(): { spec: TargetSpec | undefined; origin: Unit | null; def: CardDef | null } {
    const m = this.state.get().mode;
    const b = this.battle;
    if (m.kind === 'card') {
      const inst = b.player(this.human).hand.find((c) => c.iid === m.iid);
      if (!inst) return { spec: undefined, origin: null, def: null };
      const def = cardOf(inst);
      return { spec: def.target, origin: b.hero(this.human), def };
    }
    if (m.kind === 'power') return { spec: b.player(this.human).commander.power?.target, origin: b.hero(this.human), def: null };
    if (m.kind === 'potion') {
      const id = b.player(this.human).potions[m.slot];
      return { spec: id ? getPotion(id).target : undefined, origin: b.hero(this.human), def: null };
    }
    if (m.kind === 'ability') {
      const u = b.unit(m.uid);
      return { spec: u?.ability?.target, origin: u ?? null, def: null };
    }
    return { spec: undefined, origin: null, def: null };
  }

  refreshHighlights(): void {
    if (this.disposed) return;
    const b = this.battle;
    this.board.clearHighlights();
    this.board.showPath(null);
    const m = this.state.get().mode;
    const hover = this.state.get().hover;
    if (this.state.get().showThreat) this.highlightThreat(null);
    if (m.kind === 'unit') {
      const u = b.unit(m.uid);
      if (!u) return;
      const reach = b.reachable(u);
      this.board.highlight([...reach.values()].map((r) => r.path[r.path.length - 1]), 'move', 0.45);
      // attackable: from current pos (strong), from reachable tiles (faint)
      if (b.canAct(u)) {
        const direct = b.attackTargets(u);
        const fromMove = new Set<number>();
        for (const [, r] of reach) for (const t of b.attackTargets(u, r.path[r.path.length - 1])) fromMove.add(t.uid);
        const faint = [...fromMove].filter((id) => !direct.some((d) => d.uid === id)).map((id) => b.unit(id)!).filter(Boolean);
        this.board.highlight(faint.map((t) => ({ x: t.x, y: t.y })), 'attack', 0.35);
        this.board.highlight(direct.map((t) => ({ x: t.x, y: t.y })), 'attack', 0.75);
      }
      if (hover) {
        const r = reach.get(posKey(hover.pos));
        if (r) this.board.showPath(r.path);
        const t = hover.uid != null ? b.unit(hover.uid) : null;
        if (t && b.hostile(u.owner, t.owner) && b.canAct(u)) {
          const ap = b.attackPosition(u, t);
          if (ap?.path) {
            this.board.showPath(ap.path);
            this.board.highlight([ap.pos], 'target', 0.7);
          }
        }
      }
      return;
    }
    if (m.kind === 'card' || m.kind === 'power' || m.kind === 'potion' || m.kind === 'ability') {
      const { spec, origin, def } = this.specOf();
      const style = def?.type === 'unit' ? 'summon' : spec?.kind === 'unit' && spec.side === 'ally' ? 'ally' : def?.type === 'equip' ? 'ally' : 'spell';
      this.board.highlight(m.targets, style, 0.55);
      if (hover && hover.valid && spec) {
        const area = b.areaOf(spec, origin, hover.pos);
        if (area && area.length > 1) this.board.highlight(area, 'attack', 0.6);
        else this.board.highlight([hover.pos], 'target', 0.85);
      }
      return;
    }
    if (m.kind === 'idle' && hover?.uid != null) {
      const u = b.unit(hover.uid);
      if (u && b.hostile(this.human, u.owner)) this.highlightThreat(u);
      else if (u && u.owner === this.human && b.canMove(u)) {
        const reach = b.reachable(u);
        this.board.highlight([...reach.values()].map((r) => r.path[r.path.length - 1]), 'move', 0.3);
      }
    }
  }

  /** red overlay of where an enemy (or all enemies) can strike next turn */
  private highlightThreat(only: Unit | null): void {
    const b = this.battle;
    const tiles = new Set<string>();
    const enemies = only ? [only] : b.enemiesOf(this.human);
    for (const e of enemies) {
      const reach = b.kw(e, 'immobile') ? new Map([[b.board.idx(e.x, e.y), { cost: 0, prev: -1 }]]) : b.reachMap(e, b.moveOf(e));
      const range = b.baseRange(e);
      for (const [i] of reach) {
        const p = b.board.pos(i);
        for (const t of b.board.area(p, range)) tiles.add(posKey(t));
      }
    }
    this.board.highlight(
      [...tiles].map((k) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
      }),
      'threat',
      only ? 0.32 : 0.22,
    );
  }

  // ================================================================== pointer

  private bindInput(): void {
    const el = this.world.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.listeners.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(el, 'pointerdown', (e: PointerEvent) => {
      this.drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    on(el, 'pointermove', (e: PointerEvent) => {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (this.drag) {
        if (Math.abs(e.clientX - this.drag.x) + Math.abs(e.clientY - this.drag.y) > 6) this.drag.moved = true;
        if (this.drag.moved) {
          if (this.drag.button === 2 || this.drag.button === 1 || e.shiftKey) this.world.cam.orbit(-dx * 0.008, dy * 0.005);
          else this.world.cam.pan(-dx * 0.018, -dy * 0.018);
          return;
        }
      }
      this.onHover(e.clientX, e.clientY);
    });
    on(el, 'pointerup', (e: PointerEvent) => {
      const d = this.drag;
      this.drag = null;
      if (d && !d.moved) {
        if (d.button === 2) this.cancel();
        else if (d.button === 0) this.onClick(e.clientX, e.clientY);
      }
    });
    on(el, 'contextmenu', (e: Event) => e.preventDefault());
    on(el, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.world.cam.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    on(el, 'pointerleave', () => {
      this.state.set({ hover: null });
      this.board.setCursor(null);
      this.refreshHighlights();
    });
    on(window, 'keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    // a modal (menu, settings) is open: keys belong to it
    if (document.querySelector('.modal-back')) return;
    const cam = this.world.cam;
    switch (e.key.toLowerCase()) {
      case 'q':
        cam.rotate(-1);
        break;
      case 'e':
        cam.rotate(1);
        break;
      case 'w':
      case 'arrowup':
        cam.pan(0, -1);
        break;
      case 's':
      case 'arrowdown':
        cam.pan(0, 1);
        break;
      case 'a':
      case 'arrowleft':
        cam.pan(-1, 0);
        break;
      case 'd':
      case 'arrowright':
        cam.pan(1, 0);
        break;
      case 'escape':
        if (this.state.get().mode.kind === 'idle') window.dispatchEvent(new CustomEvent('battle-menu'));
        else this.cancel();
        break;
      case ' ':
      case 'enter':
        if (battleUi.get().check?.resolve && battleUi.get().check?.human) {
          battleUi.get().check!.resolve!();
          break;
        }
        if (e.key === ' ') {
          e.preventDefault();
          this.endTurn();
        }
        break;
      case 'tab':
        e.preventDefault();
        this.cycleUnit();
        break;
      case 't':
        this.toggleThreat();
        break;
      case 'h': {
        const h = this.battle.hero(this.human);
        if (!h.dead) this.selectUnit(h.uid);
        break;
      }
      default:
        if (/^[1-9]$/.test(e.key)) {
          const hand = this.battle.player(this.human).hand;
          const c = hand[Number(e.key) - 1];
          if (c) this.selectCard(c);
        }
    }
  }

  private onHover(cx: number, cy: number): void {
    const b = this.battle;
    const hit = this.world.pick(cx, cy);
    if (!hit) {
      if (this.state.get().hover) {
        this.state.set({ hover: null });
        this.board.setCursor(null);
        this.refreshHighlights();
      }
      return;
    }
    const pos = { x: hit.x, y: hit.y };
    const unit = b.unitAt(pos.x, pos.y);
    const visibleUnit = unit && (!b.has(unit, 'hidden') || !b.hostile(this.human, unit.owner)) ? unit : undefined;
    const m = this.state.get().mode;
    let preview: AttackPreview | null = null;
    let attacker: number | null = null;
    let valid = false;
    if (m.kind === 'unit' && visibleUnit && b.hostile(this.human, visibleUnit.owner)) {
      const u = b.unit(m.uid);
      if (u && b.canAct(u)) {
        const ap = b.attackPosition(u, visibleUnit);
        if (ap) {
          preview = b.previewAttack(u, visibleUnit, ap.pos);
          attacker = u.uid;
          valid = true;
        } else {
          preview = b.previewAttack(u, visibleUnit);
          attacker = u.uid;
        }
      }
    } else if (m.kind === 'card' || m.kind === 'power' || m.kind === 'potion' || m.kind === 'ability') {
      valid = m.targets.some((t) => t.x === pos.x && t.y === pos.y);
    } else if (m.kind === 'unit') {
      const u = b.unit(m.uid);
      valid = !!u && b.reachable(u).has(posKey(pos));
    }
    const prev = this.state.get().hover;
    const changed = !prev || prev.pos.x !== pos.x || prev.pos.y !== pos.y || prev.uid !== (visibleUnit?.uid ?? null) || prev.valid !== valid;
    this.state.set({ hover: { pos, uid: visibleUnit?.uid ?? null, preview, attacker, valid, screen: { x: cx, y: cy } } });
    if (changed) {
      this.board.setCursor(pos, valid ? 0xffe36a : 0xffffff);
      this.refreshHighlights();
      if (valid) audio.play('hover');
    }
  }

  private onClick(cx: number, cy: number): void {
    audio.init();
    const b = this.battle;
    const hit = this.world.pick(cx, cy);
    if (!hit) {
      this.cancel();
      return;
    }
    const pos = { x: hit.x, y: hit.y };
    const unit = b.unitAt(pos.x, pos.y);
    const m = this.state.get().mode;
    if (!this.canInput) {
      // allow inspecting units while waiting
      return;
    }
    switch (m.kind) {
      case 'card': {
        if (!m.targets.some((t) => t.x === pos.x && t.y === pos.y)) return this.cancel();
        const iid = m.iid;
        this.setMode({ kind: 'idle' });
        void this.act(() => b.playCard(this.human, iid, pos));
        return;
      }
      case 'power': {
        if (!m.targets.some((t) => t.x === pos.x && t.y === pos.y)) return this.cancel();
        this.setMode({ kind: 'idle' });
        void this.act(() => b.heroPower(this.human, pos));
        return;
      }
      case 'potion': {
        if (!m.targets.some((t) => t.x === pos.x && t.y === pos.y)) return this.cancel();
        const slot = m.slot;
        this.setMode({ kind: 'idle' });
        void this.act(() => b.usePotion(this.human, slot, pos));
        return;
      }
      case 'ability': {
        if (!m.targets.some((t) => t.x === pos.x && t.y === pos.y)) return this.cancel();
        const uid = m.uid;
        this.setMode({ kind: 'unit', uid });
        void this.act(() => b.useAbility(uid, pos));
        return;
      }
      case 'replace':
        this.cancel();
        return;
      case 'unit': {
        const sel = b.unit(m.uid);
        if (!sel) return this.cancel();
        if (unit && unit.uid === sel.uid) return this.cancel();
        if (unit && unit.owner === this.human) return this.selectUnit(unit.uid);
        if (unit && b.hostile(this.human, unit.owner) && (!b.has(unit, 'hidden') || cheb(unit, sel) <= 1)) {
          if (!b.canAct(sel)) {
            this.toast('该单位本回合已经行动过了');
            audio.play('error');
            return;
          }
          const ap = b.attackPosition(sel, unit);
          if (!ap) {
            const why = b.canAttack(sel, unit).reason;
            this.toast(why ?? '够不着目标');
            audio.play('error');
            return;
          }
          void this.act(() => b.moveAndAttack(sel.uid, unit.uid));
          return;
        }
        if (b.reachable(sel).has(posKey(pos))) {
          void this.act(() => b.move(sel.uid, pos));
          return;
        }
        this.cancel();
        return;
      }
      case 'idle': {
        if (unit && unit.owner === this.human) this.selectUnit(unit.uid);
        return;
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.offFrame?.();
    for (const off of this.listeners) off();
    this.listeners = [];
    this.overlay.dispose();
    this.units.dispose();
    this.board.dispose();
    this.stage.reset();
    resetBattleUi();
  }
}
