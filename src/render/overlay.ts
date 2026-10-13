import * as THREE from 'three';
import type { Battle, Unit } from '../core/battle';
import type { StatusId } from '../core/types';
import { iconSvg, STATUS_COLOR, STATUS_ICON } from '../ui/icons';
import type { UnitView } from './unitView';
import type { World } from './world';

/**
 * DOM layer over the canvas: unit HP plates and floating combat text.
 * HP shown here is "display HP" updated by presentation events, so numbers
 * change exactly when the hit lands on screen.
 */

interface Plate {
  el: HTMLDivElement;
  hpFill: HTMLDivElement;
  hpLag: HTMLDivElement;
  hpText: HTMLSpanElement;
  acText: HTMLSpanElement;
  statusEl: HTMLDivElement;
  wardEl: HTMLSpanElement;
  hp: number;
  maxHp: number;
  statusKey: string;
  hidden: boolean;
}

export class Overlay {
  readonly root: HTMLDivElement;
  private plates = new Map<number, Plate>();
  private floats: { el: HTMLDivElement; pos: THREE.Vector3; t: number; dur: number; drift: number }[] = [];
  visible = true;

  constructor(
    private world: World,
    private units: UnitView,
    host: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'world-overlay';
    host.appendChild(this.root);
  }

  private plate(u: Unit, colors: string[]): Plate {
    let p = this.plates.get(u.uid);
    if (p) return p;
    const el = document.createElement('div');
    el.className = `unit-plate ${u.isHero ? 'hero' : ''}`;
    el.style.setProperty('--team', colors[u.owner] ?? '#fff');
    el.innerHTML = `<div class="plate-row"><span class="plate-ac">${iconSvg('shield', 11)}<b></b></span><div class="plate-hp"><div class="hp-lag"></div><div class="hp-fill"></div><span class="hp-text"></span></div><span class="plate-ward"></span></div><div class="plate-status"></div>`;
    this.root.appendChild(el);
    p = {
      el,
      hpFill: el.querySelector('.hp-fill') as HTMLDivElement,
      hpLag: el.querySelector('.hp-lag') as HTMLDivElement,
      hpText: el.querySelector('.hp-text') as HTMLSpanElement,
      acText: el.querySelector('.plate-ac b') as HTMLSpanElement,
      statusEl: el.querySelector('.plate-status') as HTMLDivElement,
      wardEl: el.querySelector('.plate-ward') as HTMLSpanElement,
      hp: u.hp,
      maxHp: u.maxHp,
      statusKey: '',
      hidden: false,
    };
    this.plates.set(u.uid, p);
    this.renderHp(p);
    return p;
  }

  private renderHp(p: Plate): void {
    const pct = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp))) * 100;
    p.hpFill.style.width = `${pct}%`;
    p.hpLag.style.width = `${pct}%`;
    p.hpText.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
    p.el.classList.toggle('low', pct <= 34);
  }

  /** create/refresh plates from battle state (statuses, AC, ward). HP is event-driven. */
  sync(b: Battle, colors: string[]): void {
    for (const u of b.units.values()) {
      if (u.dead) continue;
      const p = this.plate(u, colors);
      p.acText.textContent = String(b.acOf(u));
      const key = u.statuses.map((s) => `${s.id}${s.turns}`).join(',') + `|${u.ward}`;
      if (key !== p.statusKey) {
        p.statusKey = key;
        p.statusEl.innerHTML = u.statuses
          .filter((s) => s.id !== 'hidden')
          .map((s) => `<span class="st" style="--c:${STATUS_COLOR[s.id]}" title="">${iconSvg(STATUS_ICON[s.id as StatusId], 12, STATUS_COLOR[s.id])}${s.turns < 99 ? `<i>${s.turns}</i>` : ''}</span>`)
          .join('');
        p.wardEl.innerHTML = u.ward > 0 ? `${iconSvg('magic-shield', 13, '#9ad0ff')}${u.ward > 1 ? `<i>${u.ward}</i>` : ''}` : '';
      }
      p.el.classList.toggle('stealthed', b.has(u, 'hidden'));
      if (p.maxHp !== u.maxHp && p.hp === u.hp) {
        p.maxHp = u.maxHp;
        this.renderHp(p);
      }
    }
  }

  setHp(uid: number, hp: number, maxHp: number): void {
    const p = this.plates.get(uid);
    if (!p) return;
    const dropped = hp < p.hp;
    p.hp = hp;
    p.maxHp = maxHp;
    p.hpFill.style.width = `${Math.max(0, Math.min(1, hp / Math.max(1, maxHp))) * 100}%`;
    p.hpText.textContent = `${Math.max(0, hp)}/${maxHp}`;
    p.el.classList.toggle('low', hp / maxHp <= 0.34);
    if (dropped) {
      p.el.classList.remove('shake');
      void p.el.offsetWidth;
      p.el.classList.add('shake');
      setTimeout(() => (p.hpLag.style.width = p.hpFill.style.width), 450);
    } else p.hpLag.style.width = p.hpFill.style.width;
  }

  remove(uid: number): void {
    const p = this.plates.get(uid);
    if (!p) return;
    p.el.classList.add('gone');
    setTimeout(() => p.el.remove(), 400);
    this.plates.delete(uid);
  }

  clear(): void {
    for (const p of this.plates.values()) p.el.remove();
    this.plates.clear();
    for (const f of this.floats) f.el.remove();
    this.floats = [];
  }

  /** floating text above a world position */
  float(pos: THREE.Vector3, html: string, cls: string, dur = 1.25, drift = 0.9): void {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.innerHTML = html;
    this.root.appendChild(el);
    this.floats.push({ el, pos: pos.clone(), t: 0, dur, drift });
  }

  floatUnit(uid: number, html: string, cls: string, dur = 1.25): void {
    const pos = this.units.worldPos(uid, 1.35);
    // spread simultaneous floats a bit
    const same = this.floats.filter((f) => f.t < 0.25 && f.pos.distanceTo(pos) < 0.5).length;
    pos.y += same * 0.32;
    this.float(pos, html, cls, dur);
  }

  update(dt: number): void {
    if (!this.visible) return;
    for (const [uid, p] of this.plates) {
      const v = this.units.get(uid);
      if (!v) {
        p.el.style.display = 'none';
        continue;
      }
      const wp = this.units.worldPos(uid, 1.28);
      const s = this.world.project(wp);
      if (!s.visible) {
        p.el.style.display = 'none';
        continue;
      }
      p.el.style.display = '';
      p.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      const k = f.t / f.dur;
      const p = f.pos.clone();
      p.y += k * f.drift;
      const s = this.world.project(p);
      f.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25);
      if (k >= 1) {
        f.el.remove();
        this.floats.splice(i, 1);
      }
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
  }

  dispose(): void {
    this.clear();
    this.root.remove();
  }
}
