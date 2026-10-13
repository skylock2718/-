import * as THREE from 'three';
import type { Particles } from './particles';
import { beamTexture, glowTexture, magicCircleTexture, puffTexture, ringTexture, slashTexture } from './textures';
import type { World } from './world';

/**
 * Library of battle visual effects. Every effect returns a promise that
 * resolves at its "impact" moment so the presenter can sync numbers/sounds.
 */

type Live = { t: number; dur: number; update: (k: number, dt: number) => void; end: () => void };

const PALETTE: Record<string, number[]> = {
  fire: [0xff7a1a, 0xffc040, 0xff3a10],
  frost: [0x9ae8ff, 0xffffff, 0x5ab8ff],
  lightning: [0xd0e8ff, 0x8ab8ff, 0xffffff],
  holy: [0xffe9a0, 0xffffff, 0xffc840],
  shadow: [0x9a6aff, 0x3a1a6a, 0xd0a0ff],
  poison: [0x8aff3a, 0x3aa010, 0xd0ff8a],
  arcane: [0xd08aff, 0x8a5aff, 0xffffff],
  blood: [0xff2a3a, 0x8a0010, 0xff8a8a],
  earth: [0xc8a878, 0x8a7050, 0x5a4a3a],
  heal: [0x7affa0, 0xd0ffd0, 0x3aff8a],
  gold: [0xffd36a, 0xfff0b0, 0xffa020],
  physical: [0xffffff, 0xd0d0d0, 0xffe0a0],
};

export function palette(kind: string): number[] {
  return PALETTE[kind] ?? PALETTE.physical;
}

const geo = {
  sphere: new THREE.SphereGeometry(0.1, 12, 8),
  arrowShaft: new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5).rotateX(Math.PI / 2),
  arrowTip: new THREE.ConeGeometry(0.035, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.3),
  plane: new THREE.PlaneGeometry(1, 1),
  flatPlane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  card: new THREE.BoxGeometry(0.16, 0.22, 0.01),
  boulder: new THREE.DodecahedronGeometry(0.22, 0),
  ring: new THREE.RingGeometry(0.3, 0.42, 48).rotateX(-Math.PI / 2),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true),
};

export class Fx {
  private live: Live[] = [];
  private lights: THREE.PointLight[] = [];
  speed = 1;
  shakeEnabled = true;

  constructor(
    private world: World,
    private particles: Particles,
  ) {}

  private run(dur: number, update: (k: number, dt: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.live.push({ t: 0, dur: dur / this.speed, update, end: resolve });
    });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      l.update(k, dt);
      if (k >= 1) {
        this.live.splice(i, 1);
        l.end();
      }
    }
  }

  shake(intensity: number, dur = 0.35): void {
    if (this.shakeEnabled) this.world.cam.shake(intensity, dur);
  }

  flashLight(pos: THREE.Vector3, color: number, intensity = 6, dur = 0.5, dist = 6): void {
    if (this.lights.length > 3) return;
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
    this.world.fxRoot.add(l);
    this.lights.push(l);
    void this.run(dur, (k) => {
      l.intensity = intensity * (1 - k) * (1 - k);
    }).then(() => {
      this.world.fxRoot.remove(l);
      this.lights = this.lights.filter((x) => x !== l);
    });
  }

  private sprite(tex: THREE.Texture, color: number, size: number, additive = true): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.scale.setScalar(size);
    this.world.fxRoot.add(s);
    return s;
  }

  private dispose(o: THREE.Object3D): void {
    this.world.fxRoot.remove(o);
    o.traverse((n) => {
      const m = (n as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose?.();
    });
  }

  // ================================================================ primitives

  /** Projectile that travels from a to b; resolves on impact. */
  async projectile(a: THREE.Vector3, b: THREE.Vector3, style: 'arrow' | 'bolt' | 'orb' | 'missile' | 'knife' | 'boulder' | 'card', color = 0xffffff, speedMul = 1): Promise<void> {
    const dist = a.distanceTo(b);
    const dur = Math.max(0.18, Math.min(0.55, dist * (style === 'boulder' ? 0.12 : 0.07))) / speedMul;
    const arcH = style === 'arrow' || style === 'bolt' ? dist * 0.12 : style === 'boulder' ? dist * 0.3 : dist * 0.06;
    let obj: THREE.Object3D;
    if (style === 'arrow' || style === 'bolt' || style === 'knife') {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: style === 'arrow' ? 0x8a6a40 : 0x6a6a7a, metalness: 0.4, roughness: 0.5 });
      g.add(new THREE.Mesh(geo.arrowShaft, m));
      g.add(new THREE.Mesh(geo.arrowTip, new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.8, roughness: 0.3 })));
      if (style === 'knife') g.scale.setScalar(0.6);
      obj = g;
    } else if (style === 'boulder') {
      obj = new THREE.Mesh(geo.boulder, new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 1, flatShading: true }));
    } else if (style === 'card') {
      obj = new THREE.Mesh(geo.card, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.8 }));
    } else {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color })));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(style === 'missile' ? 0.5 : 0.9);
      g.add(glow);
      if (style === 'missile') g.scale.setScalar(0.6);
      obj = g;
    }
    this.world.fxRoot.add(obj);
    const prev = a.clone();
    await this.run(dur, (k) => {
      const p = a.clone().lerp(b, k);
      p.y += Math.sin(k * Math.PI) * arcH;
      obj.position.copy(p);
      const dir = p.clone().sub(prev);
      if (dir.lengthSq() > 1e-6) obj.lookAt(p.clone().add(dir));
      if (style === 'card' || style === 'boulder') obj.rotation.z += 0.4;
      prev.copy(p);
      if (style === 'orb' || style === 'missile') this.particles.burst({ pos: p, count: 2, color, speed: 0.3, life: 0.35, size: 0.16 });
      else if (style === 'bolt' || style === 'arrow') this.particles.burst({ pos: p, count: 1, color: 0xffffff, speed: 0.05, life: 0.15, size: 0.05 });
    });
    this.dispose(obj);
  }

  /** jagged lightning ribbon */
  async lightning(a: THREE.Vector3, b: THREE.Vector3, color = 0xbfdcff, width = 0.08, dur = 0.35): Promise<void> {
    const segs = Math.max(6, Math.floor(a.distanceTo(b) * 5));
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 2 * 3 + 6);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    geom.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    this.world.fxRoot.add(mesh);
    const camDir = new THREE.Vector3();
    const rebuild = () => {
      this.world.camera.getWorldDirection(camDir);
      const dir = b.clone().sub(a);
      const side = dir.clone().cross(camDir).normalize();
      for (let i = 0; i <= segs; i++) {
        const f = i / segs;
        const p = a.clone().lerp(b, f);
        if (i > 0 && i < segs) {
          const j = 0.18 * Math.sin(f * Math.PI);
          p.add(new THREE.Vector3((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j));
        }
        const w = width * (0.6 + Math.random() * 0.6);
        const l = p.clone().addScaledVector(side, w);
        const r = p.clone().addScaledVector(side, -w);
        pos.set([l.x, l.y, l.z, r.x, r.y, r.z], i * 6);
      }
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };
    let acc = 0;
    rebuild();
    this.flashLight(b, color, 5, dur + 0.2);
    await this.run(dur, (k, dt) => {
      acc += dt;
      if (acc > 0.04) {
        acc = 0;
        rebuild();
      }
      mat.opacity = 1 - k * 0.7;
    });
    this.world.fxRoot.remove(mesh);
    geom.dispose();
    mat.dispose();
  }

  async explosion(center: THREE.Vector3, radius: number, kind: string, strength = 1): Promise<void> {
    const cols = palette(kind);
    this.flashLight(center, cols[0], 8 * strength, 0.7, 4 + radius * 3);
    this.shake(0.25 * strength + radius * 0.1, 0.4);
    this.particles.burst({ pos: center.clone().add(new THREE.Vector3(0, 0.3, 0)), count: Math.floor(60 * strength + radius * 40), color: cols, speed: 3.5 + radius * 2, up: 1.5, life: 0.8, size: 0.35, gravity: 1.5, drag: 2.2, radius: 0.2 });
    this.particles.burst({ pos: center.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 25, color: kind === 'fire' ? [0x3a2a20, 0x5a4a40] : cols, speed: 1.2, up: 1.6, life: 1.4, size: 0.6, drag: 1.2, radius: radius * 0.6 });
    // shockwave ring
    const ring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: cols[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.copy(center).add(new THREE.Vector3(0, 0.08, 0));
    this.world.fxRoot.add(ring);
    const flash = this.sprite(glowTexture(), cols[1], 0.5);
    flash.position.copy(center).add(new THREE.Vector3(0, 0.4, 0));
    await this.run(0.12, (k) => flash.scale.setScalar(0.5 + k * (2 + radius * 2)));
    void this.run(0.5, (k) => {
      ring.scale.setScalar(1 + k * (3 + radius * 3));
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      (flash.material as THREE.SpriteMaterial).opacity = 1 - k;
    }).then(() => {
      this.dispose(ring);
      this.dispose(flash);
    });
  }

  impact(pos: THREE.Vector3, kind: string, crit = false): void {
    const cols = palette(kind);
    this.particles.burst({ pos, count: crit ? 46 : 22, color: cols, speed: crit ? 4 : 2.6, up: 0.6, life: 0.5, size: crit ? 0.22 : 0.16, gravity: 3, drag: 2.5 });
    const s = this.sprite(glowTexture(), cols[0], 0.4);
    s.position.copy(pos);
    void this.run(0.25, (k) => {
      s.scale.setScalar(0.4 + k * (crit ? 2.2 : 1.2));
      (s.material as THREE.SpriteMaterial).opacity = 1 - k;
    }).then(() => this.dispose(s));
    if (crit) {
      this.shake(0.45, 0.45);
      this.flashLight(pos, cols[0], 6, 0.4);
    } else this.shake(0.1, 0.2);
  }

  /** weapon arc for melee */
  slash(pos: THREE.Vector3, color = 0xffffff, size = 1.1): void {
    const m = new THREE.MeshBasicMaterial({ map: slashTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const p = new THREE.Mesh(geo.plane, m);
    p.position.copy(pos);
    p.quaternion.copy(this.world.camera.quaternion);
    p.rotateZ(Math.random() * Math.PI * 2);
    p.scale.setScalar(size);
    this.world.fxRoot.add(p);
    void this.run(0.28, (k) => {
      p.rotateZ(0.12);
      p.scale.setScalar(size * (0.8 + k * 0.5));
      m.opacity = 1 - k;
    }).then(() => this.dispose(p));
  }

  claw(pos: THREE.Vector3, color = 0xffffff): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.slash(pos.clone().add(new THREE.Vector3((i - 1) * 0.12, 0, 0)), color, 0.7), (i * 50) / this.speed);
    }
  }

  /** rising sparkles: heal / buff */
  rise(pos: THREE.Vector3, kind: string, count = 26): void {
    const cols = palette(kind);
    this.particles.burst({ pos: pos.clone().add(new THREE.Vector3(0, 0.1, 0)), count, color: cols, speed: 0.4, up: 2.2, life: 1.1, size: 0.14, drag: 0.8, radius: 0.35, flat: true, gravity: -0.4 });
    const ring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: cols[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
    ring.scale.setScalar(0.8);
    this.world.fxRoot.add(ring);
    void this.run(0.8, (k) => {
      ring.position.y = pos.y + 0.05 + k * 1.1;
      ring.scale.setScalar(0.8 + k * 0.3);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }).then(() => this.dispose(ring));
  }

  /** column of light (summon, raise, smite) */
  pillar(pos: THREE.Vector3, color: number, height = 3, dur = 0.8): Promise<void> {
    const m = new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const c = new THREE.Mesh(geo.cyl, m);
    c.position.copy(pos).add(new THREE.Vector3(0, height / 2, 0));
    c.scale.set(0.5, height, 0.5);
    this.world.fxRoot.add(c);
    this.flashLight(pos, color, 4, dur);
    return this.run(dur, (k) => {
      c.scale.set(0.5 * (1 - k * 0.6) + 0.1, height, 0.5 * (1 - k * 0.6) + 0.1);
      m.opacity = Math.sin(k * Math.PI);
    }).then(() => this.dispose(c));
  }

  circle(pos: THREE.Vector3, color: string, dur = 0.9, size = 1.2): Promise<void> {
    const m = new THREE.MeshBasicMaterial({ map: magicCircleTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const p = new THREE.Mesh(geo.flatPlane, m);
    p.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
    this.world.fxRoot.add(p);
    return this.run(dur, (k) => {
      p.rotation.y = k * 2;
      p.scale.setScalar(size * (0.5 + easeOut(k) * 0.6));
      m.opacity = Math.sin(k * Math.PI);
    }).then(() => this.dispose(p));
  }

  smoke(pos: THREE.Vector3, color = 0x8a8a9a, count = 18): void {
    for (let i = 0; i < count; i++) {
      const s = this.sprite(puffTexture(), color, 0.4, false);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.5, (Math.random() - 0.5) * 0.8));
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
      void this.run(1.1 + Math.random() * 0.5, (k, dt) => {
        s.position.addScaledVector(v, dt);
        s.scale.setScalar(0.4 + k * 1.2);
        (s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.7;
      }).then(() => this.dispose(s));
    }
  }

  areaPulse(tiles: THREE.Vector3[], kind: string): void {
    const cols = palette(kind);
    for (const t of tiles) {
      const m = new THREE.MeshBasicMaterial({ map: glowTexture(), color: cols[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const p = new THREE.Mesh(geo.flatPlane, m);
      p.position.copy(t).add(new THREE.Vector3(0, 0.06, 0));
      p.scale.setScalar(1.3);
      this.world.fxRoot.add(p);
      void this.run(0.7, (k) => (m.opacity = Math.sin(k * Math.PI) * 0.9)).then(() => this.dispose(p));
      this.particles.burst({ pos: t.clone().add(new THREE.Vector3(0, 0.1, 0)), count: 8, color: cols, speed: 0.8, up: 1.4, life: 0.8, size: 0.16, radius: 0.4, flat: true });
    }
  }

  shield(pos: THREE.Vector3, color = 0x9ad0ff): void {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), m);
    s.position.copy(pos).add(new THREE.Vector3(0, 0.55, 0));
    this.world.fxRoot.add(s);
    void this.run(0.7, (k) => {
      s.scale.setScalar(0.6 + easeOut(k) * 0.6);
      m.opacity = 0.45 * (1 - k);
    }).then(() => {
      this.world.fxRoot.remove(s);
      s.geometry.dispose();
      m.dispose();
    });
  }

  vortex(pos: THREE.Vector3, color = 0x9a4aff): void {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.6;
      const p = pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.2 + Math.random() * 0.4, Math.sin(a) * r));
      const v = pos.clone().sub(p).multiplyScalar(1.6).add(new THREE.Vector3(-Math.sin(a), 0.2, Math.cos(a)).multiplyScalar(1.2));
      this.particles.spawn(p, v, color, 0.2, 0.7, 0, 0.5);
    }
  }

  coins(pos: THREE.Vector3): void {
    this.particles.burst({ pos: pos.clone().add(new THREE.Vector3(0, 0.6, 0)), count: 30, color: [0xffd36a, 0xfff0b0], speed: 2.2, up: 2.4, gravity: 6, life: 0.9, size: 0.14, drag: 0.5 });
  }

  update2(): void {
    /* reserved */
  }
}

function easeOut(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

export const ATTACK_KIND: Record<string, { proj?: 'arrow' | 'bolt' | 'orb' | 'missile' | 'knife' | 'boulder' | 'card'; elem: string; color: number }> = {
  slash: { elem: 'physical', color: 0xffffff },
  pierce: { elem: 'physical', color: 0xffffff },
  smash: { elem: 'earth', color: 0xffe0a0 },
  claw: { elem: 'blood', color: 0xffffff },
  bite: { elem: 'blood', color: 0xffffff },
  arrow: { proj: 'arrow', elem: 'physical', color: 0xffffff },
  bolt: { proj: 'bolt', elem: 'physical', color: 0xffffff },
  fire: { proj: 'orb', elem: 'fire', color: 0xff7a1a },
  frost: { proj: 'orb', elem: 'frost', color: 0x9ae8ff },
  lightning: { proj: 'orb', elem: 'lightning', color: 0xbfdcff },
  magic: { proj: 'orb', elem: 'arcane', color: 0xd08aff },
  holy: { proj: 'orb', elem: 'holy', color: 0xffe9a0 },
  shadow: { proj: 'orb', elem: 'shadow', color: 0x9a6aff },
  poison: { proj: 'orb', elem: 'poison', color: 0x8aff3a },
  cards: { proj: 'card', elem: 'gold', color: 0xffd36a },
  eyeRay: { proj: 'orb', elem: 'shadow', color: 0xff6aff },
};

export { ringTexture };
