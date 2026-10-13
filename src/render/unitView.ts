import * as THREE from 'three';
import type { Battle, Unit } from '../core/battle';
import type { Pos } from '../core/types';
import type { BoardView } from './boardView';
import { canvasTexture, glowTexture, portraitCanvas } from './textures';
import type { World } from './world';

/**
 * Units are cardboard standees on coloured bases — like miniatures on a
 * tabletop. They billboard toward the camera around the Y axis.
 */

interface Anim {
  t: number;
  dur: number;
  fn: (k: number) => void;
  done: () => void;
}

export interface StandeeView {
  uid: number;
  root: THREE.Group;
  /** rotates to face camera */
  bill: THREE.Group;
  card: THREE.Mesh;
  base: THREE.Mesh;
  ring: THREE.Mesh;
  sel: THREE.Mesh;
  glow: THREE.Sprite;
  hidden: boolean;
  scale: number;
  /** extra transform from animations */
  offset: THREE.Vector3;
  tilt: number;
  lean: number;
  bob: number;
  dead: boolean;
  anims: Anim[];
  pos: Pos;
  flash: number;
  flashColor: THREE.Color;
  exhausted: boolean;
}

const CARD_W = 0.7;
const CARD_H = 0.96;
const cardGeom = new THREE.BoxGeometry(CARD_W, CARD_H, 0.03);
cardGeom.translate(0, CARD_H / 2 + 0.07, 0);
const baseGeom = new THREE.CylinderGeometry(0.34, 0.37, 0.07, 28);
baseGeom.translate(0, 0.035, 0);
const ringGeom = new THREE.TorusGeometry(0.36, 0.025, 8, 36).rotateX(Math.PI / 2);
const selGeom = new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2);

export class UnitView {
  readonly group = new THREE.Group();
  readonly views = new Map<number, StandeeView>();
  private texCache = new Map<string, THREE.Texture>();
  selected: number | null = null;
  playerColors: string[] = ['#4aa3ff', '#ff4d5e', '#5fe08a', '#ffc84a'];

  constructor(
    private world: World,
    private board: BoardView,
  ) {
    world.root.add(this.group);
  }

  private portrait(u: Unit): THREE.Texture {
    const key = `${u.cardId}:${u.owner}:${u.isHero}`;
    let t = this.texCache.get(key);
    if (!t) {
      const c = portraitCanvas({ icon: u.icon, colors: u.colors ?? ['#181b22', '#4d5668', '#eef3fb'], name: u.name, hero: u.isHero, team: this.playerColors[u.owner] ?? '#fff', seed: u.uid });
      t = canvasTexture(c);
      this.texCache.set(key, t);
    }
    return t;
  }

  add(u: Unit, appear = true): StandeeView {
    const existing = this.views.get(u.uid);
    if (existing) return existing;
    const root = new THREE.Group();
    const bill = new THREE.Group();
    root.add(bill);
    const team = new THREE.Color(this.playerColors[u.owner] ?? '#ffffff');
    const tx = this.portrait(u);
    const front = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.55, metalness: 0.05 });
    const back = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6, color: 0xb0a898 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    const card = new THREE.Mesh(cardGeom, [edge, edge, edge, edge, front, back]);
    card.castShadow = true;
    bill.add(card);
    const base = new THREE.Mesh(baseGeom, new THREE.MeshStandardMaterial({ color: team.clone().multiplyScalar(0.55), metalness: 0.6, roughness: 0.35 }));
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);
    const ring = new THREE.Mesh(ringGeom, new THREE.MeshStandardMaterial({ color: team, emissive: team, emissiveIntensity: 1.2 }));
    ring.position.y = 0.07;
    root.add(ring);
    const sel = new THREE.Mesh(selGeom, new THREE.MeshBasicMaterial({ color: 0xffe36a, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
    sel.position.y = 0.02;
    root.add(sel);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: team, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.6, 1.6, 1);
    glow.position.y = 0.6;
    bill.add(glow);
    const scale = u.scale;
    root.scale.setScalar(scale);
    root.userData.pick = { kind: 'unit', x: u.x, y: u.y, uid: u.uid };
    this.world.pickables.push(card, base);
    card.userData.pickRoot = true;
    const v: StandeeView = {
      uid: u.uid,
      root,
      bill,
      card,
      base,
      ring,
      sel,
      glow,
      hidden: false,
      scale,
      offset: new THREE.Vector3(),
      tilt: 0,
      lean: 0,
      bob: Math.random() * 10,
      dead: false,
      anims: [],
      pos: { x: u.x, y: u.y },
      flash: 0,
      flashColor: new THREE.Color(0xffffff),
      exhausted: false,
    };
    this.views.set(u.uid, v);
    this.group.add(root);
    this.place(v);
    if (appear) {
      root.scale.setScalar(0.01);
      this.animate(v, 0.45, (k) => {
        const e = easeOutBack(k);
        root.scale.setScalar(Math.max(0.01, scale * e));
        v.offset.y = (1 - k) * 0.6;
      });
    }
    return v;
  }

  private place(v: StandeeView): void {
    const p = this.board.top(v.pos.x, v.pos.y);
    v.root.position.set(p.x + v.offset.x, p.y + v.offset.y, p.z + v.offset.z);
    v.root.userData.pick = { kind: 'unit', x: v.pos.x, y: v.pos.y, uid: v.uid };
  }

  sync(b: Battle): void {
    for (const u of b.units.values()) {
      const v = this.views.get(u.uid);
      if (!u.dead && !v) this.add(u, false);
      if (v && !v.anims.length && !u.dead) {
        v.pos = { x: u.x, y: u.y };
      }
      if (v && !u.dead) {
        v.exhausted = u.owner === b.active && !b.canAct(u) && !b.canMove(u);
        this.setHidden(v, b.has(u, 'hidden'));
      }
    }
  }

  setHidden(v: StandeeView, hidden: boolean): void {
    if (v.hidden === hidden) return;
    v.hidden = hidden;
    const mats = v.card.material as THREE.MeshStandardMaterial[];
    for (const m of mats) {
      m.transparent = hidden;
      m.opacity = hidden ? 0.45 : 1;
      m.needsUpdate = true;
    }
  }

  get(uid: number): StandeeView | undefined {
    return this.views.get(uid);
  }

  worldPos(uid: number, height = 0.6): THREE.Vector3 {
    const v = this.views.get(uid);
    if (!v) return new THREE.Vector3();
    return v.root.position.clone().add(new THREE.Vector3(0, height * v.scale, 0));
  }

  setSelected(uid: number | null): void {
    this.selected = uid;
  }

  // ------------------------------------------------------------------ animation core

  animate(v: StandeeView, dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      v.anims.push({ t: 0, dur: Math.max(0.01, dur), fn, done: resolve });
    });
  }

  /** hop tile-to-tile along a path */
  async moveAlong(uid: number, path: Pos[], speed = 1): Promise<void> {
    const v = this.views.get(uid);
    if (!v || path.length < 2) return;
    for (let i = 1; i < path.length; i++) {
      const a = this.board.top(path[i - 1].x, path[i - 1].y);
      const b = this.board.top(path[i].x, path[i].y);
      const dh = b.y - a.y;
      const hop = 0.25 + Math.max(0, dh) * 0.9;
      v.pos = path[i];
      const dur = (0.2 + Math.abs(dh) * 0.12) / speed;
      await this.animate(v, dur, (k) => {
        // offset relative to destination
        const x = a.x + (b.x - a.x) * k;
        const z = a.z + (b.z - a.z) * k;
        const y = a.y + dh * k + Math.sin(k * Math.PI) * hop;
        v.offset.set(x - b.x, y - b.y, z - b.z);
        v.lean = Math.sin(k * Math.PI) * 0.12;
        const sq = 1 + Math.sin(k * Math.PI) * 0.06;
        v.root.scale.set(v.scale / Math.sqrt(sq), v.scale * sq, v.scale / Math.sqrt(sq));
      });
      v.offset.set(0, 0, 0);
      v.root.scale.setScalar(v.scale);
      v.lean = 0;
    }
  }

  async slide(uid: number, to: Pos, dur = 0.3, arc = 0): Promise<void> {
    const v = this.views.get(uid);
    if (!v) return;
    const a = this.board.top(v.pos.x, v.pos.y);
    const b = this.board.top(to.x, to.y);
    v.pos = to;
    await this.animate(v, dur, (k) => {
      const e = easeOutCubic(k);
      v.offset.set((a.x - b.x) * (1 - e), (a.y - b.y) * (1 - e) + Math.sin(k * Math.PI) * arc, (a.z - b.z) * (1 - e));
    });
    v.offset.set(0, 0, 0);
  }

  async teleport(uid: number, to: Pos): Promise<void> {
    const v = this.views.get(uid);
    if (!v) return;
    await this.animate(v, 0.18, (k) => v.root.scale.set(v.scale * (1 - k * 0.95), v.scale * (1 + k * 1.2), v.scale * (1 - k * 0.95)));
    v.pos = to;
    await this.animate(v, 0.22, (k) => v.root.scale.set(v.scale * (0.05 + k * 0.95), v.scale * (2.2 - k * 1.2), v.scale * (0.05 + k * 0.95)));
    v.root.scale.setScalar(v.scale);
  }

  /** lunge towards a target and back; resolves at the impact moment */
  async lunge(uid: number, toward: THREE.Vector3, onImpact?: () => void): Promise<void> {
    const v = this.views.get(uid);
    if (!v) return;
    const from = v.root.position.clone().sub(v.offset);
    const dir = toward.clone().sub(from).setY(0).normalize();
    await this.animate(v, 0.12, (k) => {
      v.offset.copy(dir.clone().multiplyScalar(-0.12 * k));
      v.lean = -0.15 * k;
    });
    await this.animate(v, 0.1, (k) => {
      v.offset.copy(dir.clone().multiplyScalar(-0.12 + 0.55 * k));
      v.offset.y = Math.sin(k * Math.PI) * 0.12;
      v.lean = 0.3 * k;
    });
    onImpact?.();
    this.animate(v, 0.22, (k) => {
      v.offset.copy(dir.clone().multiplyScalar(0.43 * (1 - k)));
      v.lean = 0.3 * (1 - k);
    }).then(() => {
      v.offset.set(0, 0, 0);
      v.lean = 0;
    });
  }

  /** recoil + flash when hit */
  hit(uid: number, from: THREE.Vector3 | null, strength = 1, color = 0xff4040): void {
    const v = this.views.get(uid);
    if (!v) return;
    const dir = from ? v.root.position.clone().sub(from).setY(0).normalize() : new THREE.Vector3(0, 0, 1);
    v.flash = 1;
    v.flashColor.setHex(color);
    void this.animate(v, 0.35, (k) => {
      const s = Math.sin(k * Math.PI) * (1 - k);
      v.offset.copy(dir.clone().multiplyScalar(0.18 * s * strength));
      v.tilt = Math.sin(k * 30) * 0.12 * (1 - k) * strength;
    }).then(() => {
      v.offset.set(0, 0, 0);
      v.tilt = 0;
    });
  }

  dodge(uid: number): void {
    const v = this.views.get(uid);
    if (!v) return;
    void this.animate(v, 0.35, (k) => {
      v.offset.x = Math.sin(k * Math.PI) * 0.25;
      v.lean = Math.sin(k * Math.PI) * -0.2;
    }).then(() => {
      v.offset.set(0, 0, 0);
      v.lean = 0;
    });
  }

  pulse(uid: number, color: number): void {
    const v = this.views.get(uid);
    if (!v) return;
    v.flash = 0.8;
    v.flashColor.setHex(color);
  }

  /** the standee falls backwards and fades out */
  async die(uid: number): Promise<void> {
    const v = this.views.get(uid);
    if (!v || v.dead) return;
    v.dead = true;
    await this.animate(v, 0.55, (k) => {
      v.lean = -easeInCubic(k) * (Math.PI / 2 - 0.1);
    });
    const mats = [...(v.card.material as THREE.Material[]), v.base.material as THREE.Material, v.ring.material as THREE.Material];
    for (const m of mats) m.transparent = true;
    await this.animate(v, 0.6, (k) => {
      for (const m of mats) (m as THREE.MeshStandardMaterial).opacity = 1 - k;
      v.offset.y = -k * 0.2;
    });
    this.remove(uid);
  }

  remove(uid: number): void {
    const v = this.views.get(uid);
    if (!v) return;
    this.group.remove(v.root);
    this.world.pickables = this.world.pickables.filter((o) => o !== v.card && o !== v.base);
    this.views.delete(uid);
  }

  update(dt: number, t: number): void {
    const yaw = this.world.cam.yaw;
    for (const v of this.views.values()) {
      // run animations (sequential per unit)
      if (v.anims.length) {
        const a = v.anims[0];
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        a.fn(k);
        if (k >= 1) {
          v.anims.shift();
          a.done();
        }
      }
      this.place(v);
      // idle breathing
      v.bob += dt;
      const breathe = v.dead ? 0 : Math.sin(v.bob * 2.2) * 0.012;
      v.bill.rotation.set(v.lean, yaw, v.tilt);
      v.bill.position.y = breathe;
      // selection ring
      const selMat = v.sel.material as THREE.MeshBasicMaterial;
      const target = this.selected === v.uid ? 0.9 : 0;
      selMat.opacity += (target - selMat.opacity) * Math.min(1, dt * 10);
      v.sel.rotation.y += dt * 1.5;
      v.sel.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
      // hit flash
      const front = (v.card.material as THREE.MeshStandardMaterial[])[4];
      if (v.flash > 0) {
        v.flash = Math.max(0, v.flash - dt * 3.5);
        front.emissive.copy(v.flashColor);
        front.emissiveIntensity = v.flash * 1.6;
      } else if (front.emissiveIntensity !== 0) {
        front.emissiveIntensity = 0;
      }
      // exhausted units are slightly dimmed
      const dim = v.exhausted ? 0.6 : 1;
      front.color.setScalar(dim);
      const gm = v.glow.material as THREE.SpriteMaterial;
      gm.opacity = this.selected === v.uid ? 0.35 + Math.sin(t * 3) * 0.1 : 0;
    }
  }

  clear(): void {
    for (const uid of [...this.views.keys()]) this.remove(uid);
  }

  dispose(): void {
    this.clear();
    this.world.root.remove(this.group);
    for (const t of this.texCache.values()) t.dispose();
  }
}

export function easeOutBack(k: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

export function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

export function easeInCubic(k: number): number {
  return k * k * k;
}
