import * as THREE from 'three';
import { battleTick, battleUi, nextId } from '../app/battleUi';
import { audio, type Sfx } from '../audio/audio';
import type { Battle } from '../core/battle';
import { STATUS_NAMES } from '../core/battle';
import { cardOf, getCard } from '../core/registry';
import type { BattleEvent, BattleIO, DamageType, Pos, RerollRequest, RollEvent } from '../core/types';
import { DMG_COLOR, iconSvg, STATUS_COLOR, STATUS_ICON } from '../ui/icons';
import type { BoardView } from './boardView';
import type { DiceTray, DieRequest, DieTheme } from './dice3d';
import { ATTACK_KIND, type Fx } from './fx';
import type { Overlay } from './overlay';
import type { Particles } from './particles';
import type { UnitView } from './unitView';
import type { World } from './world';

export interface PresenterSettings {
  animSpeed: number;
  diceSpeed: number;
  showDice: boolean;
  fatePrompt: boolean;
  shake: boolean;
}

const NEG = new Set(['burning', 'poisoned', 'stunned', 'frozen', 'rooted', 'prone', 'frightened', 'baned', 'slowed', 'marked', 'weakened', 'vulnerable', 'doomed', 'charmed']);

const DMG_FX: Record<DamageType, string> = {
  physical: 'physical',
  fire: 'fire',
  cold: 'frost',
  lightning: 'lightning',
  poison: 'poison',
  radiant: 'holy',
  necrotic: 'shadow',
  arcane: 'arcane',
  psychic: 'shadow',
};

/**
 * Turns battle events into choreography. Every await here is what makes the
 * battle readable: dice first, then the swing, then the numbers.
 */
export class Presenter implements BattleIO {
  battle!: Battle;
  tray: DiceTray | null = null;
  bigTray: (() => DiceTray | null) | null = null;
  /** players controlled by a human on this device */
  humans = new Set<number>([0]);
  /** follow AI actions with the camera */
  followCamera = true;
  onEvent: ((ev: BattleEvent) => void) | null = null;

  constructor(
    private world: World,
    private board: BoardView,
    private units: UnitView,
    private fx: Fx,
    private particles: Particles,
    private overlay: Overlay,
    public settings: PresenterSettings,
  ) {}

  private get k(): number {
    return 1 / Math.max(0.25, this.settings.animSpeed);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms * this.k));
  }

  private sfx(s: Sfx, opts?: { vol?: number; pitch?: number; count?: number }): void {
    audio.play(s, opts);
  }

  private colors(): string[] {
    return this.battle.players.map((p) => p.color);
  }

  private tilePos(p: Pos, h = 0): THREE.Vector3 {
    return this.board.top(p.x, p.y).add(new THREE.Vector3(0, h, 0));
  }

  private unitPos(uid: number, h = 0.55): THREE.Vector3 {
    return this.units.worldPos(uid, h);
  }

  private isHumanTurn(): boolean {
    return this.humans.has(this.battle.active);
  }

  private focus(p: THREE.Vector3, blend = 0.45): void {
    if (this.followCamera && !this.isHumanTurn()) this.world.cam.focus(p, blend);
  }

  private dieTheme(owner: number): DieTheme {
    if (this.humans.has(owner)) return 'player';
    const b = this.battle;
    if (b.players.length > 2 && owner >= 2) return owner === 2 ? 'ally2' : 'ally3';
    return 'enemy';
  }

  // ================================================================ BattleIO

  async askReroll(req: RerollRequest): Promise<boolean> {
    if (!this.settings.fatePrompt) return false;
    return new Promise<boolean>((resolve) => {
      battleUi.set({
        reroll: {
          roll: req.roll,
          fate: req.fate,
          resolve: (yes: boolean) => {
            battleUi.set({ reroll: null });
            resolve(yes);
          },
        },
      });
    });
  }

  async emit(ev: BattleEvent): Promise<void> {
    try {
      await this.handle(ev);
    } catch (e) {
      console.error('presenter error', ev, e);
    }
    this.onEvent?.(ev);
  }

  private refresh(): void {
    this.units.sync(this.battle);
    this.overlay.sync(this.battle, this.colors());
    battleTick.bump();
  }

  private log(text: string, tone?: string): void {
    battleUi.update((s) => ({ log: [...s.log.slice(-60), { id: nextId(), text, tone }] }));
  }

  private banner(text: string, sub?: string, tone?: string): void {
    const id = nextId();
    battleUi.set({ banner: { id, text, sub, tone } });
    setTimeout(() => {
      if (battleUi.get().banner?.id === id) battleUi.set({ banner: null });
    }, 1700 * this.k);
  }

  private async handle(ev: BattleEvent): Promise<void> {
    const b = this.battle;
    switch (ev.t) {
      case 'battleStart': {
        this.refresh();
        this.world.cam.goalDistance = this.world.cam.goalDistance;
        this.banner('战斗开始', '掷骰决定命运', 'info');
        this.sfx('turn');
        await this.wait(700);
        return;
      }
      case 'turnStart': {
        const p = b.player(ev.player);
        const human = this.humans.has(ev.player);
        this.refresh();
        const hero = b.hero(ev.player);
        if (!hero.dead) this.focus(this.unitPos(hero.uid, 0), human ? 0 : 0.35);
        this.banner(human ? '你的回合' : `${p.name} 的回合`, `第 ${ev.round} 轮`, human ? 'good' : 'bad');
        this.sfx('turn', { vol: human ? 1 : 0.6 });
        this.log(`—— 第 ${ev.round} 轮 · ${p.name} ——`, 'turn');
        await this.wait(human ? 650 : 750);
        return;
      }
      case 'turnEnd':
        this.refresh();
        return;
      case 'draw': {
        if (this.humans.has(ev.player)) {
          this.sfx('card', { pitch: 0.9 + Math.random() * 0.2 });
          battleTick.bump();
          await this.wait(110);
        } else battleTick.bump();
        return;
      }
      case 'burn': {
        const c = getCard(ev.id);
        this.log(`${b.player(ev.player).name} 手牌已满，【${c.name}】被弃置`, 'bad');
        battleTick.bump();
        return;
      }
      case 'discard':
      case 'shuffle':
        this.sfx('page');
        battleTick.bump();
        return;
      case 'mana':
        battleTick.bump();
        return;
      case 'fate': {
        battleTick.bump();
        if (ev.delta > 0) {
          this.sfx('fate');
          const h = b.hero(ev.player);
          if (!h.dead) this.overlay.floatUnit(h.uid, `${iconSvg('dice-twenty-faces-twenty', 16, '#ffd36a')} +${ev.delta} 命运`, 'fate');
        }
        return;
      }
      case 'cardPlayed': {
        const def = cardOf({ id: ev.id, up: ev.up });
        const human = this.humans.has(ev.player);
        battleUi.set({ played: { id: nextId(), card: def, up: ev.up, owner: ev.player } });
        this.sfx('cardPlay');
        battleTick.bump();
        if (ev.target) this.focus(this.tilePos(ev.target), 0.3);
        await this.wait(human ? 350 : 1000);
        battleUi.set({ played: null });
        return;
      }
      case 'heroPower': {
        const hero = b.hero(ev.player);
        this.sfx('magic');
        this.fx.rise(this.unitPos(hero.uid, 0), 'arcane', 16);
        this.overlay.floatUnit(hero.uid, `${iconSvg(b.player(ev.player).commander.power?.icon ?? 'magic-swirl', 16, '#d0b0ff')} ${b.player(ev.player).commander.power?.name ?? ''}`, 'info');
        await this.wait(300);
        return;
      }
      case 'potion': {
        this.sfx('magic', { pitch: 1.3 });
        await this.wait(200);
        return;
      }
      case 'summon': {
        const u = b.units.get(ev.uid)!;
        const pos = this.tilePos(ev.at);
        this.focus(pos, 0.3);
        void this.fx.circle(pos, b.player(ev.owner).color, 0.9 * this.k, 1.3);
        void this.fx.pillar(pos, new THREE.Color(b.player(ev.owner).color).getHex(), 2.5, 0.7 * this.k);
        this.particles.burst({ pos: pos.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 30, color: [b.player(ev.owner).color, '#ffffff'], speed: 1.5, up: 2, life: 0.8, size: 0.14, radius: 0.3, flat: true });
        this.sfx('summon');
        await this.wait(200);
        this.units.add(u, true);
        this.overlay.sync(b, this.colors());
        this.overlay.setHp(u.uid, u.hp, u.maxHp);
        await this.wait(380);
        battleTick.bump();
        return;
      }
      case 'move': {
        const end = ev.path[ev.path.length - 1];
        this.focus(this.tilePos(end), 0.35);
        const steps = ev.path.length - 1;
        let i = 0;
        const stepTimer = setInterval(() => {
          if (i++ >= steps) return clearInterval(stepTimer);
          this.sfx('step', { pitch: 0.8 + Math.random() * 0.4 });
        }, 200 * this.k);
        await this.units.moveAlong(ev.uid, ev.path, this.settings.animSpeed);
        clearInterval(stepTimer);
        battleTick.bump();
        return;
      }
      case 'teleport': {
        this.fx.smoke(this.tilePos(ev.from), 0xb08aff, 10);
        this.sfx('magic', { pitch: 1.4 });
        await this.units.teleport(ev.uid, ev.to);
        this.fx.rise(this.tilePos(ev.to), 'arcane', 18);
        return;
      }
      case 'attack': {
        const a = this.unitPos(ev.attacker, 0);
        const t = this.unitPos(ev.target, 0);
        this.focus(a.clone().lerp(t, 0.5), 0.45);
        await this.wait(120);
        return;
      }
      case 'roll':
        await this.showRoll(ev);
        return;
      case 'strike':
        await this.strike(ev.attacker, ev.target, ev.hit, ev.crit, ev.ranged, ev.fx);
        return;
      case 'damageRoll': {
        const r = battleUi.get().roll;
        const total = Math.max(0, ev.roll.total + ev.extra.reduce((a, e) => a + e.roll.total, 0));
        if (r && ev.uid != null && r.roll.uid === ev.uid) {
          battleUi.set({ roll: { ...r, damage: { roll: ev.roll, extra: ev.extra, label: ev.label, total } } });
        } else {
          // standalone (spell damage / gamble) roll
          const owner = ev.uid != null ? b.units.get(ev.uid)?.owner ?? b.active : b.active;
          battleUi.set({
            roll: {
              id: nextId(),
              owner,
              phase: 'done',
              roll: { t: 'roll', kind: 'check', player: owner, uid: ev.uid, vs: null, label: ev.label, d20: { rolls: [], nat: 0, adv: 0 }, mods: [], bonusRolls: [], total, target: 0, success: true, crit: false, fumble: false },
              damage: { roll: ev.roll, extra: ev.extra, label: ev.label, total },
            },
          });
        }
        if (this.settings.showDice && this.tray) {
          const reqs: DieRequest[] = [];
          const theme = this.dieTheme(ev.uid != null ? b.units.get(ev.uid)?.owner ?? 0 : b.active);
          for (const d of ev.roll.dice) reqs.push({ sides: d.s, value: d.v, theme });
          for (const e of ev.extra) for (const d of e.roll.dice) reqs.push({ sides: d.s, value: d.v, theme: 'gold' });
          if (reqs.length && reqs.length <= 8) {
            this.tray.speed = this.settings.diceSpeed * 1.4;
            this.sfx('dice', { count: Math.min(8, 3 + reqs.length) });
            await this.tray.roll(reqs);
            this.sfx('diceLand');
            await this.wait(200);
          }
        }
        return;
      }
      case 'damage': {
        const u = b.units.get(ev.uid);
        if (!u) return;
        this.overlay.setHp(ev.uid, ev.hp, ev.maxHp);
        const pos = this.unitPos(ev.uid, 0.6);
        if (ev.blocked === 'ward') {
          this.overlay.floatUnit(ev.uid, `${iconSvg('magic-shield', 18, '#9ad0ff')} 护盾抵挡`, 'info');
          this.fx.shield(this.unitPos(ev.uid, 0), 0x9ad0ff);
          this.sfx('shield');
          await this.wait(300);
          return;
        }
        if (ev.blocked === 'immune') {
          this.overlay.floatUnit(ev.uid, '免疫', 'info');
          await this.wait(200);
          return;
        }
        const col = DMG_COLOR[ev.dmgType];
        const big = ev.crit || ev.amount >= 12;
        this.overlay.floatUnit(ev.uid, `<b style="color:${col}">-${ev.amount}</b>${ev.crit ? '<em>暴击!</em>' : ''}${ev.resisted ? '<small>抗性</small>' : ''}${ev.vulnerable ? '<small>易伤</small>' : ''}`, `dmg ${big ? 'big' : ''} ${ev.crit ? 'crit' : ''}`, ev.crit ? 1.5 : 1.2);
        this.units.hit(ev.uid, ev.source != null ? this.unitPos(ev.source, 0) : null, ev.crit ? 1.6 : 1, ev.dmgType === 'physical' ? 0xff3030 : new THREE.Color(col).getHex());
        this.fx.impact(pos, DMG_FX[ev.dmgType], ev.crit);
        this.sfx(ev.crit ? 'crit' : 'hit', { vol: Math.min(1.2, 0.6 + ev.amount / 15) });
        if (ev.amount >= 10 && this.settings.shake) this.world.cam.shake(Math.min(0.5, ev.amount / 40), 0.3);
        battleTick.bump();
        await this.wait(ev.crit ? 420 : 260);
        return;
      }
      case 'heal': {
        this.overlay.setHp(ev.uid, ev.hp, ev.maxHp);
        this.overlay.floatUnit(ev.uid, `<b>+${ev.amount}</b>`, 'heal');
        this.fx.rise(this.unitPos(ev.uid, 0), 'heal', 18);
        this.units.pulse(ev.uid, 0x6aff9a);
        this.sfx('heal');
        battleTick.bump();
        await this.wait(260);
        return;
      }
      case 'status': {
        const u = b.units.get(ev.uid);
        if (!u || u.dead) return;
        if (ev.added) {
          const neg = NEG.has(ev.status);
          this.overlay.floatUnit(ev.uid, `${iconSvg(STATUS_ICON[ev.status], 16, STATUS_COLOR[ev.status])} ${STATUS_NAMES[ev.status]}`, neg ? 'status bad' : 'status good');
          this.sfx(neg ? 'curse' : 'buff', { vol: 0.6 });
          if (ev.status === 'frozen') this.particles.burst({ pos: this.unitPos(ev.uid, 0.5), count: 30, color: [0x9ae8ff, 0xffffff], speed: 1.2, life: 0.8, size: 0.14 });
          if (ev.status === 'stunned') this.particles.burst({ pos: this.unitPos(ev.uid, 1.2), count: 14, color: 0xffe36a, speed: 0.8, life: 0.8, size: 0.12 });
          if (ev.status === 'blessed' || ev.status === 'inspired') this.fx.rise(this.unitPos(ev.uid, 0), 'holy', 12);
        }
        this.overlay.sync(b, this.colors());
        battleTick.bump();
        await this.wait(ev.added ? 180 : 40);
        return;
      }
      case 'float': {
        const u = b.units.get(ev.uid);
        if (!u) return;
        this.overlay.floatUnit(ev.uid, ev.text, ev.tone);
        await this.wait(120);
        return;
      }
      case 'death': {
        const u = b.units.get(ev.uid);
        const pos = this.unitPos(ev.uid, 0.4);
        this.sfx('death');
        this.particles.burst({ pos, count: 26, color: [0xd0c8b8, 0x8a8070], speed: 1.4, up: 0.8, life: 0.9, size: 0.2, gravity: 2 });
        this.particles.burst({ pos: pos.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 10, color: 0xb8e8ff, speed: 0.3, up: 1.6, life: 1.4, size: 0.18, drag: 0.5 });
        this.overlay.remove(ev.uid);
        await this.units.die(ev.uid);
        if (u?.isHero) await this.wait(300);
        battleTick.bump();
        return;
      }
      case 'push': {
        this.sfx(ev.bump ? 'hit' : 'quake', { vol: 0.6 });
        if (ev.from.x !== ev.to.x || ev.from.y !== ev.to.y) await this.units.slide(ev.uid, ev.to, 0.32 * this.k, ev.fall > 0 ? 0.35 : 0.15);
        if (ev.bump) this.fx.impact(this.unitPos(ev.uid, 0.4), 'earth');
        if (ev.fall >= 2) {
          this.particles.burst({ pos: this.unitPos(ev.uid, 0), count: 24, color: [0xc8a878, 0x8a7050], speed: 1.8, up: 1, gravity: 4, life: 0.8, size: 0.18, radius: 0.3, flat: true });
          if (this.settings.shake) this.world.cam.shake(0.3, 0.3);
        }
        return;
      }
      case 'surface': {
        this.board.setSurface(ev.tiles);
        if (ev.surface === 'fire') this.sfx('fire', { vol: 0.6 });
        else if (ev.surface === 'ice') this.sfx('frost', { vol: 0.5 });
        else if (ev.surface === 'poison') this.sfx('curse', { vol: 0.4 });
        await this.wait(120);
        return;
      }
      case 'height': {
        this.board.animateHeights(ev.tiles);
        this.sfx('quake');
        if (this.settings.shake) this.world.cam.shake(0.18, 0.4);
        await this.wait(480);
        battleTick.bump();
        return;
      }
      case 'terrain': {
        this.board.setTerrain(ev.tiles);
        this.sfx('quake', { vol: 0.5 });
        await this.wait(260);
        return;
      }
      case 'capture': {
        this.board.updateNode(ev.pos);
        const col = ev.owner != null ? new THREE.Color(b.player(ev.owner).color).getHex() : 0xffffff;
        void this.fx.pillar(this.tilePos(ev.pos), col, 2, 0.6 * this.k);
        this.sfx('capture');
        await this.wait(250);
        battleTick.bump();
        return;
      }
      case 'nodeUsed': {
        this.board.updateNode(ev.pos);
        if (ev.kind === 'chest' || ev.kind === 'gold') this.fx.coins(this.tilePos(ev.pos));
        else this.fx.rise(this.tilePos(ev.pos), ev.kind === 'altar' ? 'holy' : 'arcane', 20);
        this.sfx(ev.kind === 'gold' ? 'coin' : 'magic');
        await this.wait(250);
        return;
      }
      case 'fx':
        await this.playFx(ev.kind, ev.from, ev.to, ev.area, ev.color);
        return;
      case 'equip': {
        const def = getCard(ev.id);
        this.overlay.floatUnit(ev.uid, `${iconSvg(def.icon, 16, '#ffe9a0')} ${def.name}`, 'status good');
        this.fx.rise(this.unitPos(ev.uid, 0), 'gold', 16);
        this.sfx('shield');
        this.overlay.sync(b, this.colors());
        await this.wait(300);
        return;
      }
      case 'stealth': {
        const v = this.units.get(ev.uid);
        if (v) this.units.setHidden(v, ev.hidden);
        this.fx.smoke(this.unitPos(ev.uid, 0), 0x6a6a8a, ev.hidden ? 12 : 6);
        this.overlay.sync(b, this.colors());
        await this.wait(150);
        return;
      }
      case 'log':
        this.log(ev.text, ev.tone);
        return;
      case 'banner':
        this.banner(ev.text, ev.sub, ev.tone);
        if (ev.tone === 'boss') this.sfx('curse');
        await this.wait(900);
        return;
      case 'eliminated': {
        this.banner(`${b.player(ev.player).name} 出局`, undefined, 'bad');
        await this.wait(600);
        return;
      }
      case 'battleEnd': {
        this.refresh();
        return;
      }
      case 'gold': {
        const h = b.hero(ev.player);
        if (!h.dead) this.fx.coins(this.unitPos(h.uid, 0));
        this.sfx('gold');
        return;
      }
      case 'refresh':
        this.refresh();
        return;
    }
  }

  // ================================================================ dice

  private async showRoll(ev: RollEvent): Promise<void> {
    const b = this.battle;
    if (ev.big) {
      await this.showCheck(ev);
      return;
    }
    const owner = ev.player;
    const view = { id: nextId(), roll: ev, owner, phase: 'rolling' as const, damage: null };
    battleUi.set({ roll: view });
    if (this.settings.showDice && this.tray) {
      const theme = this.dieTheme(owner);
      const reqs: DieRequest[] = ev.d20.rolls.map((v, i) => ({
        sides: 20,
        value: v,
        theme,
        dropped: ev.d20.rolls.length > 1 && (ev.d20.adv > 0 ? v < ev.d20.nat || (v === ev.d20.nat && i === 1 && ev.d20.rolls[0] === v) : v > ev.d20.nat || (v === ev.d20.nat && i === 1 && ev.d20.rolls[0] === v)),
        glow: ev.crit || ev.d20.nat === 20 ? 'crit' : ev.fumble ? 'fumble' : null,
      }));
      this.tray.speed = this.settings.diceSpeed;
      this.sfx('dice', { count: 5 + reqs.length * 2 });
      await this.tray.roll(reqs);
      this.sfx('diceLand');
    } else {
      await this.wait(150);
    }
    battleUi.set({ roll: { ...view, phase: 'done' } });
    if (ev.d20.nat === 20) this.sfx('nat20');
    else if (ev.fumble) this.sfx('nat1');
    if (ev.d20.nat === 20 || ev.fumble) {
      const who = ev.uid != null ? b.units.get(ev.uid) : null;
      if (who && !who.dead) this.overlay.floatUnit(who.uid, ev.d20.nat === 20 ? '天然 20!' : '天然 1…', ev.d20.nat === 20 ? 'nat20' : 'nat1', 1.4);
    }
    await this.wait(ev.kind === 'save' ? 380 : 320);
  }

  private async showCheck(ev: RollEvent): Promise<void> {
    const human = this.humans.has(ev.player);
    await new Promise<void>((resolve) => {
      battleUi.set({ check: { roll: ev, phase: 'ready', human, resolve } });
      if (!human) setTimeout(resolve, 500 * this.k);
    });
    battleUi.set({ check: { roll: ev, phase: 'rolling', human, resolve: null } });
    const tray = this.bigTray?.();
    if (tray) {
      tray.speed = this.settings.diceSpeed;
      this.sfx('dice', { count: 9 });
      await tray.roll(ev.d20.rolls.map((v) => ({ sides: 20, value: v, theme: 'check' as DieTheme, glow: v === 20 ? 'crit' : v === 1 ? 'fumble' : null, dropped: ev.d20.rolls.length > 1 && v !== ev.d20.nat })));
      this.sfx('diceLand');
    } else await this.wait(600);
    this.sfx(ev.success ? (ev.d20.nat === 20 ? 'nat20' : 'buff') : ev.fumble ? 'nat1' : 'curse');
    await new Promise<void>((resolve) => {
      battleUi.set({ check: { roll: ev, phase: 'done', human, resolve } });
      setTimeout(resolve, (human ? 2600 : 1200) * this.k);
    });
    battleUi.set({ check: null });
  }

  // ================================================================ attacks

  private async strike(attacker: number, target: number, hit: boolean, crit: boolean, ranged: boolean, fxKind: string): Promise<void> {
    const kind = ATTACK_KIND[fxKind] ?? (ranged ? ATTACK_KIND.arrow : ATTACK_KIND.slash);
    const a = this.unitPos(attacker, 0.55);
    let t = this.unitPos(target, 0.55);
    if (!hit) t = t.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2, (Math.random() - 0.5) * 1.2));
    const aUnit = this.battle.units.get(attacker);
    if (ranged || kind.proj) {
      const style = kind.proj ?? 'arrow';
      this.sfx(style === 'arrow' || style === 'bolt' ? 'arrow' : style === 'card' ? 'card' : 'magic', { vol: 0.8 });
      // small recoil on shooter
      this.units.pulse(attacker, 0xffffff);
      await this.fx.projectile(a, t, style, kind.color, this.settings.animSpeed);
      if (hit) {
        if (kind.elem === 'fire') this.sfx('fire', { vol: 0.5 });
        if (kind.elem === 'lightning') void this.fx.lightning(a, t, 0xbfdcff, 0.05, 0.2);
      } else {
        this.units.dodge(target);
        this.sfx('miss');
      }
      return;
    }
    // melee
    let impact = false;
    await this.units.lunge(attacker, this.unitPos(target, 0), () => {
      impact = true;
      const tp = this.unitPos(target, 0.55);
      if (hit) {
        if (fxKind === 'claw' || fxKind === 'bite') this.fx.claw(tp, crit ? 0xffd36a : 0xffffff);
        else this.fx.slash(tp, crit ? 0xffd36a : kind.elem === 'holy' ? 0xffe9a0 : kind.elem === 'shadow' ? 0xb08aff : 0xffffff, crit ? 1.5 : 1.1);
        this.sfx('slash');
      } else {
        this.units.dodge(target);
        this.sfx('miss');
      }
    });
    if (!impact) await this.wait(100);
    void aUnit;
  }

  // ================================================================ spell fx

  private async playFx(kind: string, from?: Pos, to?: Pos, area?: Pos[], color?: string): Promise<void> {
    const b = this.battle;
    const fromV = from ? this.tilePos(from, 0.7) : null;
    const toV = to ? this.tilePos(to, 0.4) : null;
    const areaV = area?.map((p) => this.tilePos(p, 0)) ?? [];
    const center = toV ?? (areaV.length ? areaV.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / areaV.length) : fromV);
    if (center) this.focus(center, 0.3);
    const radius = area ? Math.max(0, Math.sqrt(area.length) / 2 - 0.5) : 0;
    switch (kind) {
      case 'fireball':
      case 'meteor': {
        if (kind === 'meteor' && center) {
          const sky = center.clone().add(new THREE.Vector3(-3, 7, -2));
          this.sfx('fire');
          await this.fx.projectile(sky, center, 'orb', 0xff7a1a, 0.6);
        } else if (fromV && center) {
          this.sfx('fire', { vol: 0.6 });
          await this.fx.projectile(fromV, center, 'orb', 0xff7a1a, 0.8);
        }
        if (center) {
          this.sfx('explosion');
          await this.fx.explosion(center, Math.max(1, radius), 'fire', kind === 'meteor' ? 2 : 1.2);
          if (areaV.length) this.fx.areaPulse(areaV, 'fire');
        }
        await this.wait(200);
        return;
      }
      case 'explosion':
      case 'corpseExplosion': {
        if (center) {
          this.sfx('explosion');
          await this.fx.explosion(center, Math.max(0.6, radius), kind === 'corpseExplosion' ? 'blood' : 'fire', 1);
        }
        return;
      }
      case 'flamePillar':
      case 'flameNova':
      case 'firewall': {
        const pts = areaV.length ? areaV : center ? [center] : [];
        this.sfx('fire');
        if (kind === 'flameNova' && fromV) await this.fx.explosion(fromV.clone().setY(fromV.y - 0.7), 1, 'fire', 0.9);
        for (const p of pts) void this.fx.pillar(p, 0xff6a10, 1.6, 0.6 * this.k);
        this.fx.areaPulse(pts, 'fire');
        await this.wait(350);
        return;
      }
      case 'lightningLine':
      case 'lightning': {
        this.sfx('lightning');
        if (fromV && (areaV.length || toV)) {
          const end = areaV.length ? areaV[areaV.length - 1].clone().setY(areaV[areaV.length - 1].y + 0.4) : toV!;
          await this.fx.lightning(fromV, end, 0xbfdcff, 0.09, 0.4 * this.k);
        }
        if (this.settings.shake) this.world.cam.shake(0.2, 0.25);
        return;
      }
      case 'shock': {
        this.sfx('lightning');
        for (let i = 0; i + 1 < areaV.length; i++) void this.fx.lightning(areaV[i].clone().setY(areaV[i].y + 0.1), areaV[i + 1].clone().setY(areaV[i + 1].y + 0.1), 0x9ad0ff, 0.06, 0.4);
        this.fx.areaPulse(areaV, 'lightning');
        await this.wait(350);
        return;
      }
      case 'arrowLine':
      case 'volley':
      case 'arrowShot':
      case 'knives':
      case 'knife': {
        if (kind === 'volley' && areaV.length) {
          this.sfx('arrow');
          const sky = (center ?? areaV[0]).clone().add(new THREE.Vector3(0, 5, 0));
          await Promise.all(areaV.map((p, i) => new Promise<void>((r) => setTimeout(() => void this.fx.projectile(sky.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), p.clone().setY(p.y + 0.1), 'arrow', 0xffffff, 1.5).then(r), i * 40))));
          return;
        }
        if (kind === 'knives' && fromV) {
          this.sfx('slash');
          const targets = b.enemiesOf(b.active).filter((e) => Math.max(Math.abs(e.x - from!.x), Math.abs(e.y - from!.y)) <= 2);
          await Promise.all(targets.map((e) => this.fx.projectile(fromV, this.unitPos(e.uid, 0.5), 'knife', 0xffffff, 1.4)));
          return;
        }
        if (fromV) {
          const end = areaV.length ? areaV[areaV.length - 1].clone().setY(areaV[areaV.length - 1].y + 0.5) : toV;
          if (end) {
            this.sfx('arrow');
            await this.fx.projectile(fromV, end, kind === 'knife' ? 'knife' : 'arrow', 0xffffff, 1.3);
          }
        }
        return;
      }
      case 'holy':
      case 'judgement':
      case 'holyNova':
      case 'smite':
      case 'holybolt': {
        this.sfx('heal', { pitch: 0.8 });
        if (kind === 'holybolt' && fromV && toV) {
          await this.fx.projectile(fromV, toV, 'orb', 0xffe9a0, 1);
          return;
        }
        if (kind === 'holyNova') {
          for (const u of b.alliesOf(b.active)) this.fx.rise(this.unitPos(u.uid, 0), 'holy', 14);
          await this.wait(400);
          return;
        }
        const pts = areaV.length ? areaV : center ? [center] : [];
        for (const p of pts.slice(0, 9)) void this.fx.pillar(p, 0xffe08a, 3, 0.7 * this.k);
        if (kind === 'smite' && toV && this.settings.shake) this.world.cam.shake(0.25, 0.3);
        this.fx.areaPulse(pts, 'holy');
        await this.wait(380);
        return;
      }
      case 'heal':
        if (center) this.fx.rise(center, 'heal', 20);
        this.sfx('heal');
        await this.wait(200);
        return;
      case 'shield':
      case 'fireShield':
        if (toV) this.fx.shield(toV.clone().setY(toV.y - 0.4), kind === 'fireShield' ? 0xff7a1a : 0x9ad0ff);
        this.sfx('shield');
        await this.wait(250);
        return;
      case 'rally':
        for (const u of b.unitsOf(b.active)) this.fx.rise(this.unitPos(u.uid, 0), 'gold', 10);
        this.sfx('buff');
        await this.wait(350);
        return;
      case 'quake':
      case 'shove': {
        this.sfx('quake');
        if (this.settings.shake) this.world.cam.shake(0.3, 0.45);
        const pts = areaV.length ? areaV : center ? [center] : [];
        this.fx.areaPulse(pts, 'earth');
        await this.wait(260);
        return;
      }
      case 'vines':
        this.fx.areaPulse(areaV.length ? areaV : center ? [center] : [], 'poison');
        this.sfx('curse', { vol: 0.5, pitch: 1.5 });
        await this.wait(300);
        return;
      case 'mark':
        if (toV) {
          void this.fx.circle(toV.clone().setY(toV.y - 0.35), '#ff4d5e', 0.8, 0.9);
          this.particles.burst({ pos: toV, count: 16, color: 0xff4d5e, speed: 1, life: 0.6, size: 0.12 });
        }
        this.sfx('buff', { pitch: 0.7 });
        await this.wait(250);
        return;
      case 'firebolt':
      case 'frostbolt':
      case 'missile':
      case 'drain':
      case 'eyeRay':
      case 'boulder':
      case 'arcane': {
        if (fromV && toV) {
          const map: Record<string, [string, number]> = { firebolt: ['orb', 0xff7a1a], frostbolt: ['orb', 0x9ae8ff], missile: ['missile', 0xd08aff], drain: ['orb', 0x9a2a3a], eyeRay: ['orb', 0xff6aff], boulder: ['boulder', 0xffffff], arcane: ['orb', 0xd08aff] };
          const [style, c] = map[kind];
          this.sfx(kind === 'boulder' ? 'quake' : 'magic');
          await this.fx.projectile(fromV, toV, style as 'orb', c, 1);
        } else if (center) {
          this.fx.rise(center, 'arcane', 18);
          this.sfx('magic');
        }
        return;
      }
      case 'grease':
        this.fx.areaPulse(areaV, 'earth');
        this.sfx('page', { vol: 0.6 });
        return;
      case 'thunderwave':
        if (fromV) await this.fx.explosion(fromV.clone().setY(fromV.y - 0.6), 1.2, 'lightning', 0.9);
        this.sfx('explosion', { vol: 0.6 });
        return;
      case 'icestorm':
      case 'freeze': {
        this.sfx('frost');
        const pts = areaV.length ? areaV : center ? [center] : [];
        for (const p of pts) this.particles.burst({ pos: p.clone().add(new THREE.Vector3(0, 2.5, 0)), count: 14, color: [0xffffff, 0x9ae8ff], speed: 0.4, dir: new THREE.Vector3(0, -2.5, 0), life: 0.9, size: 0.14, radius: 0.4 });
        await this.wait(500);
        this.fx.areaPulse(pts, 'frost');
        return;
      }
      case 'blink':
        if (fromV) this.fx.smoke(fromV.clone().setY(fromV.y - 0.6), 0xb08aff, 10);
        this.sfx('magic', { pitch: 1.4 });
        return;
      case 'arcaneSelf':
        if (fromV) this.fx.rise(fromV.clone().setY(fromV.y - 0.7), 'arcane', 22);
        this.sfx('magic');
        await this.wait(200);
        return;
      case 'cards':
      case 'coin':
      case 'dice':
        if (center) this.fx.coins(center.clone().setY(center.y - 0.4));
        this.sfx('coin');
        await this.wait(250);
        return;
      case 'smoke':
        if (center) this.fx.smoke(center.clone().setY(center.y - 0.4));
        this.sfx('page');
        await this.wait(250);
        return;
      case 'backstab':
      case 'execute':
      case 'cleave':
      case 'claw':
        if (toV) {
          if (kind === 'claw') this.fx.claw(toV);
          else this.fx.slash(toV, kind === 'execute' ? 0xff2a3a : 0xffffff, 1.3);
        }
        this.sfx('slash');
        await this.wait(200);
        return;
      case 'poison':
        this.fx.areaPulse(areaV.length ? areaV : center ? [center] : [], 'poison');
        if (center) this.fx.smoke(center.clone().setY(center.y - 0.3), 0x5aaa2a, 12);
        this.sfx('curse', { vol: 0.5 });
        await this.wait(300);
        return;
      case 'sacrifice':
      case 'blight':
      case 'fear':
      case 'curse':
      case 'psychic':
      case 'vortex': {
        const p = center ?? fromV;
        if (p) {
          if (kind === 'vortex') this.fx.vortex(p.clone().setY(p.y - 0.2), 0x9a4aff);
          else this.particles.burst({ pos: p, count: 30, color: [0x9a6aff, 0x3a1a6a, 0xff6aff], speed: 1.6, life: 0.9, size: 0.18 });
        }
        if (areaV.length) this.fx.areaPulse(areaV, 'shadow');
        this.sfx('curse');
        await this.wait(350);
        return;
      }
      case 'raise':
      case 'summon':
      case 'summonCircle':
        if (center) {
          void this.fx.circle(center.clone().setY(center.y - 0.35), kind === 'raise' ? '#7affd0' : color ?? '#ffd36a', 0.8, 1.2);
          void this.fx.pillar(center.clone().setY(center.y - 0.4), kind === 'raise' ? 0x7affd0 : 0xffd36a, 2, 0.6);
        }
        this.sfx('summon', { vol: 0.6 });
        await this.wait(260);
        return;
      case 'breath': {
        this.sfx('fire');
        if (fromV && areaV.length) {
          for (const p of areaV) {
            void this.fx.projectile(fromV, p.clone().setY(p.y + 0.3), 'orb', 0xffa040, 1.4);
            await this.wait(50);
          }
          await this.wait(200);
          this.fx.areaPulse(areaV, 'fire');
        }
        return;
      }
      default:
        if (center) this.fx.rise(center, 'arcane', 12);
        await this.wait(150);
    }
  }
}
