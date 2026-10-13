import * as THREE from 'three';
import type { Board } from '../core/board';
import type { BiomeId, NodeKind, Pos, SurfaceType, TerrainType, Tile } from '../core/types';
import type { Particles } from './particles';
import {
  BIOME_PALETTE,
  cliffTexture,
  cursorTexture,
  glowTexture,
  groundTexture,
  lavaTexture,
  magicCircleTexture,
  ringTexture,
  tileHighlightTexture,
  waterTexture,
  woodTexture,
} from './textures';
import { LEVEL_H, type World } from './world';

const BOTTOM = -0.9;

export type HighlightStyle = 'move' | 'attack' | 'summon' | 'spell' | 'ally' | 'threat' | 'path' | 'target' | 'blocked';

const HL_COLORS: Record<HighlightStyle, number> = {
  move: 0x4aa3ff,
  attack: 0xff4d5e,
  summon: 0xffd36a,
  spell: 0xff9a3d,
  ally: 0x5fe08a,
  threat: 0xff2a3a,
  path: 0xffffff,
  target: 0xffe36a,
  blocked: 0x666666,
};

interface TileView {
  group: THREE.Group;
  column: THREE.Mesh;
  deco: THREE.Group;
  node: THREE.Group | null;
  nodeAnim: THREE.Object3D | null;
  ownerRing: THREE.Mesh | null;
  water: THREE.Mesh | null;
  surface: THREE.Mesh | null;
  hl: THREE.Mesh;
  topY: number;
  animFrom: number;
  animTo: number;
  animT: number;
}

// shared geometries
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  cone: new THREE.ConeGeometry(0.22, 0.5, 7),
  cyl: new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6),
  ico: new THREE.IcosahedronGeometry(0.22, 0),
  dodeca: new THREE.DodecahedronGeometry(0.35, 0),
  octa: new THREE.OctahedronGeometry(0.16, 0),
  sphere: new THREE.SphereGeometry(0.04, 6, 4),
  torus: new THREE.TorusGeometry(0.36, 0.035, 6, 32).rotateX(Math.PI / 2),
};

export class BoardView {
  readonly group = new THREE.Group();
  private tiles: TileView[] = [];
  private mats = new Map<string, THREE.Material>();
  private cursor: THREE.Mesh;
  private pathGroup = new THREE.Group();
  private pal;
  private ambientT = 0;
  playerColors: string[] = ['#4aa3ff', '#ff4d5e', '#5fe08a', '#ffc84a'];

  constructor(
    private world: World,
    private board: Board,
    private particles: Particles,
  ) {
    this.pal = BIOME_PALETTE[board.biome];
    this.group.name = 'board';
    world.root.add(this.group);
    this.buildEnvironment();
    for (const t of board.tiles) this.tiles.push(this.buildTile(t));
    this.cursor = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: cursorTexture(), transparent: true, depthWrite: false, color: 0xffffff }));
    this.cursor.visible = false;
    this.cursor.renderOrder = 5;
    this.group.add(this.cursor);
    this.group.add(this.pathGroup);
    world.cam.bounds = Math.max(board.w, board.h) / 2;
    world.cam.goalDistance = 13 + Math.max(board.w, board.h) * 0.95;
    world.cam.distance = world.cam.goalDistance + 6;
  }

  // ------------------------------------------------------------------ coordinates

  wx(x: number): number {
    return x - (this.board.w - 1) / 2;
  }

  wz(y: number): number {
    return y - (this.board.h - 1) / 2;
  }

  surfaceY(t: Tile): number {
    if (t.terrain === 'water') return -0.12;
    if (t.terrain === 'deep') return -0.16;
    if (t.terrain === 'lava') return -0.1;
    return t.h * LEVEL_H;
  }

  /** world position of the top centre of tile (x,y) where units stand */
  top(x: number, y: number): THREE.Vector3 {
    const tv = this.tiles[y * this.board.w + x];
    return new THREE.Vector3(this.wx(x), tv ? tv.topY : 0, this.wz(y));
  }

  // ------------------------------------------------------------------ environment

  private buildEnvironment(): void {
    const pal = this.pal;
    this.world.scene.background = new THREE.Color(pal.sky[1]);
    (this.world.scene.fog as THREE.Fog).color.set(pal.sky[1]);
    this.world.hemi.color.set(pal.ambient);
    this.world.key.color.set(pal.key);
    // wooden table
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: woodTexture(pal.table), roughness: 0.85, metalness: 0.05 }));
    (table.material as THREE.MeshStandardMaterial).map!.repeat.set(6, 6);
    table.position.y = BOTTOM - 0.25;
    table.receiveShadow = true;
    this.group.add(table);
    // diorama plinth
    const w = this.board.w + 0.7;
    const h = this.board.h + 0.7;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, h), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 0.7, metalness: 0.1 }));
    plinth.position.y = BOTTOM - 0.1;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    this.group.add(plinth);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, h + 0.08), new THREE.MeshStandardMaterial({ color: 0xb8862a, roughness: 0.35, metalness: 0.8 }));
    trim.position.y = BOTTOM + 0.04;
    this.group.add(trim);
  }

  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) {
      m = make();
      this.mats.set(key, m);
    }
    return m;
  }

  private topMaterial(t: Tile): THREE.Material {
    const biome: BiomeId = this.board.biome;
    if (t.terrain === 'lava') {
      return this.mat('lava', () => {
        const tx = lavaTexture();
        return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xff5a10, emissiveIntensity: 1.4, roughness: 0.6 });
      });
    }
    const terr: TerrainType = t.terrain === 'water' || t.terrain === 'deep' ? 'plain' : t.terrain === 'rock' || t.terrain === 'ruins' ? 'plain' : t.terrain;
    const v = Math.floor(t.variant * 4);
    return this.mat(`top:${terr}:${v}`, () => {
      const m = new THREE.MeshStandardMaterial({ map: groundTexture(biome, terr, t.variant), roughness: 0.95, metalness: 0 });
      if (t.terrain === 'water' || t.terrain === 'deep') m.color.set(0x8a7a60);
      return m;
    });
  }

  private sideMaterial(): THREE.Material {
    return this.mat('side', () => new THREE.MeshStandardMaterial({ map: cliffTexture(this.board.biome), roughness: 1 }));
  }

  private columnGeometry(top: number): THREE.BufferGeometry {
    const hgt = top - BOTTOM;
    const g = new THREE.BoxGeometry(0.985, hgt, 0.985);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // faces px,nx,py,ny,pz,nz -> 4 verts each; scale side v by height so strata don't stretch
    for (const f of [0, 1, 4, 5]) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setY(i, uv.getY(i) * hgt * 0.9);
      }
    }
    uv.needsUpdate = true;
    g.translate(0, hgt / 2 + BOTTOM, 0);
    return g;
  }

  private buildTile(t: Tile): TileView {
    const group = new THREE.Group();
    group.position.set(this.wx(t.x), 0, this.wz(t.y));
    const topY = this.surfaceY(t);
    const colTop = t.terrain === 'water' ? -0.3 : t.terrain === 'deep' ? -0.62 : topY;
    const column = new THREE.Mesh(this.columnGeometry(colTop), [this.sideMaterial(), this.sideMaterial(), this.topMaterial(t), this.sideMaterial(), this.sideMaterial(), this.sideMaterial()]);
    column.castShadow = true;
    column.receiveShadow = true;
    column.userData.pick = { kind: 'tile', x: t.x, y: t.y };
    group.add(column);
    this.world.pickables.push(column);
    const deco = new THREE.Group();
    group.add(deco);
    const hl = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: tileHighlightTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xffffff }));
    hl.visible = false;
    hl.renderOrder = 4;
    hl.scale.setScalar(0.94);
    group.add(hl);
    const tv: TileView = { group, column, deco, node: null, nodeAnim: null, ownerRing: null, water: null, surface: null, hl, topY, animFrom: topY, animTo: topY, animT: 1 };
    this.group.add(group);
    this.decorate(t, tv);
    this.buildWater(t, tv);
    this.buildNode(t, tv);
    this.buildSurface(t, tv);
    this.placeOverlays(tv);
    return tv;
  }

  private placeOverlays(tv: TileView): void {
    tv.hl.position.y = tv.topY + 0.03;
    if (tv.surface) tv.surface.position.y = tv.topY + 0.02;
    tv.deco.position.y = tv.topY;
    if (tv.node) tv.node.position.y = tv.topY;
  }

  // ------------------------------------------------------------------ water

  private buildWater(t: Tile, tv: TileView): void {
    if (tv.water) {
      tv.group.remove(tv.water);
      tv.water = null;
    }
    if (t.terrain !== 'water' && t.terrain !== 'deep') return;
    const deep = t.terrain === 'deep';
    const voidy = this.board.biome === 'astral' && deep;
    const color = voidy ? '#2a1050' : deep ? this.pal.deep : this.pal.water;
    const m = this.mat(`water:${color}`, () => {
      const tx = waterTexture(color);
      return new THREE.MeshStandardMaterial({
        map: tx,
        color: 0xffffff,
        transparent: true,
        opacity: voidy ? 0.95 : deep ? 0.9 : 0.78,
        roughness: 0.12,
        metalness: 0.15,
        emissive: voidy ? 0x3a1080 : 0x0a2030,
        emissiveIntensity: voidy ? 0.9 : 0.4,
      });
    });
    const water = new THREE.Mesh(G.plane, m);
    water.position.y = tv.topY - 0.02;
    water.receiveShadow = true;
    tv.water = water;
    tv.group.add(water);
  }

  // ------------------------------------------------------------------ decorations

  private decorate(t: Tile, tv: TileView): void {
    for (const c of [...tv.deco.children]) tv.deco.remove(c);
    const biome = this.board.biome;
    const r = mulberry(Math.floor(t.variant * 1e6) + t.x * 31 + t.y * 17);
    if (t.terrain === 'forest') {
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const tree = this.makeTree(biome, r);
        tree.position.set((r() - 0.5) * 0.55, 0, (r() - 0.5) * 0.55);
        tree.rotation.y = r() * Math.PI * 2;
        const s = 0.75 + r() * 0.4;
        tree.scale.setScalar(s);
        tv.deco.add(tree);
      }
    } else if (t.terrain === 'rock') {
      const rockMat = this.mat(`rock:${biome}`, () => new THREE.MeshStandardMaterial({ color: biome === 'astral' ? 0x5a5a8a : biome === 'ashen' ? 0x3a302a : 0x7a7a72, roughness: 0.9, flatShading: true }));
      const boulder = new THREE.Mesh(G.dodeca, rockMat);
      boulder.scale.set(1.25 + r() * 0.3, 1.5 + r() * 0.8, 1.2 + r() * 0.3);
      boulder.position.y = 0.42;
      boulder.rotation.set(r(), r() * 3, r());
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      tv.deco.add(boulder);
      if (biome === 'astral') {
        const crystal = new THREE.Mesh(G.octa, this.mat('crystal', () => new THREE.MeshStandardMaterial({ color: 0xb08aff, emissive: 0x7a4aff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })));
        crystal.scale.set(1, 3, 1);
        crystal.position.set(0.15, 1.05, 0.05);
        tv.deco.add(crystal);
      }
    } else if (t.terrain === 'ruins') {
      const stone = this.mat(`ruin:${biome}`, () => new THREE.MeshStandardMaterial({ color: biome === 'astral' ? 0x8a8ab8 : 0xa09a88, roughness: 0.8 }));
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.9 + r() * 0.6, 8), stone);
      pillar.position.set((r() - 0.5) * 0.2, 0.5, (r() - 0.5) * 0.2);
      pillar.rotation.z = (r() - 0.5) * 0.25;
      pillar.castShadow = true;
      tv.deco.add(pillar);
      const cap = new THREE.Mesh(G.box, stone);
      cap.scale.set(0.5, 0.12, 0.5);
      cap.position.set(pillar.position.x, pillar.position.y + 0.5 + r() * 0.2, pillar.position.z);
      cap.rotation.y = r();
      cap.castShadow = true;
      tv.deco.add(cap);
      for (let i = 0; i < 3; i++) {
        const rub = new THREE.Mesh(G.box, stone);
        rub.scale.set(0.15 + r() * 0.1, 0.1, 0.15);
        rub.position.set((r() - 0.5) * 0.7, 0.05, (r() - 0.5) * 0.7);
        rub.rotation.y = r() * 3;
        tv.deco.add(rub);
      }
    } else if (t.deco === 'grass' || t.deco === 'flowers') {
      const gm = this.mat('grass', () => new THREE.MeshStandardMaterial({ color: 0x7fb24a, roughness: 1 }));
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(G.cone, gm);
        blade.scale.set(0.25, 0.35, 0.25);
        blade.position.set((r() - 0.5) * 0.8, 0.08, (r() - 0.5) * 0.8);
        tv.deco.add(blade);
      }
      if (t.deco === 'flowers') {
        const colors = [0xffe36a, 0xff7ab0, 0xffffff, 0x9ad0ff];
        for (let i = 0; i < 5; i++) {
          const f = new THREE.Mesh(G.sphere, this.mat(`flower:${i % 4}`, () => new THREE.MeshStandardMaterial({ color: colors[i % 4], emissive: colors[i % 4], emissiveIntensity: 0.3 })));
          f.position.set((r() - 0.5) * 0.8, 0.06, (r() - 0.5) * 0.8);
          tv.deco.add(f);
        }
      }
    } else if (t.deco === 'bones') {
      const bm = this.mat('bone', () => new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 }));
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(G.cyl, bm);
        b.scale.set(0.5, 0.7, 0.5);
        b.rotation.z = Math.PI / 2;
        b.rotation.y = r() * 3;
        b.position.set((r() - 0.5) * 0.7, 0.03, (r() - 0.5) * 0.7);
        tv.deco.add(b);
      }
    } else if (t.deco === 'embers') {
      const em = this.mat('ember', () => new THREE.MeshStandardMaterial({ color: 0xff6a20, emissive: 0xff4a10, emissiveIntensity: 2.2 }));
      for (let i = 0; i < 4; i++) {
        const e = new THREE.Mesh(G.sphere, em);
        e.scale.setScalar(0.6 + r());
        e.position.set((r() - 0.5) * 0.8, 0.02, (r() - 0.5) * 0.8);
        tv.deco.add(e);
      }
    } else if (t.deco === 'shards' || t.deco === 'motes') {
      const cm = this.mat('shard', () => new THREE.MeshStandardMaterial({ color: 0x9ad0ff, emissive: 0x6a8aff, emissiveIntensity: 1.5, roughness: 0.2, flatShading: true }));
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(G.octa, cm);
        s.scale.set(0.5, 1 + r(), 0.5);
        s.position.set((r() - 0.5) * 0.7, 0.12, (r() - 0.5) * 0.7);
        s.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
        tv.deco.add(s);
      }
    }
  }

  private makeTree(biome: BiomeId, r: () => number): THREE.Group {
    const g = new THREE.Group();
    if (biome === 'verdant') {
      const trunk = new THREE.Mesh(G.cyl, this.mat('trunk', () => new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1 })));
      trunk.position.y = 0.15;
      trunk.castShadow = true;
      g.add(trunk);
      const leafColors = [0x2f6b2a, 0x3c7a30, 0x2a5a2a, 0x4a8a3a];
      const lm = this.mat(`leaf:${Math.floor(r() * 4)}`, () => new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(r() * 4)], roughness: 0.9, flatShading: true }));
      if (r() < 0.6) {
        for (let i = 0; i < 3; i++) {
          const c = new THREE.Mesh(G.cone, lm);
          c.position.y = 0.35 + i * 0.2;
          c.scale.setScalar(1.15 - i * 0.25);
          c.castShadow = true;
          g.add(c);
        }
      } else {
        const c = new THREE.Mesh(G.ico, lm);
        c.position.y = 0.5;
        c.scale.set(1.1, 1.2, 1.1);
        c.castShadow = true;
        g.add(c);
      }
    } else if (biome === 'ashen') {
      const dm = this.mat('deadwood', () => new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1 }));
      const trunk = new THREE.Mesh(G.cyl, dm);
      trunk.scale.set(1, 2.2, 1);
      trunk.position.y = 0.33;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const br = new THREE.Mesh(G.cyl, dm);
        br.scale.set(0.5, 1, 0.5);
        br.position.set(0, 0.45 + i * 0.12, 0);
        br.rotation.z = (r() - 0.5) * 2;
        br.rotation.y = r() * 3;
        br.castShadow = true;
        g.add(br);
      }
    } else {
      const cm = this.mat('crystaltree', () => new THREE.MeshStandardMaterial({ color: 0xc8a0ff, emissive: 0x8a5aff, emissiveIntensity: 1.1, roughness: 0.25, flatShading: true }));
      const c = new THREE.Mesh(G.octa, cm);
      c.scale.set(1.3, 3.2, 1.3);
      c.position.y = 0.5;
      c.castShadow = true;
      g.add(c);
    }
    return g;
  }

  // ------------------------------------------------------------------ nodes

  private buildNode(t: Tile, tv: TileView): void {
    if (tv.node) {
      tv.group.remove(tv.node);
      tv.node = null;
      tv.nodeAnim = null;
      tv.ownerRing = null;
    }
    if (!t.node) return;
    const g = new THREE.Group();
    const kind = t.node.kind;
    const stone = this.mat('nodestone', () => new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.8 }));
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 });
    const addRing = () => {
      const ring = new THREE.Mesh(G.torus, ringMat);
      ring.position.y = 0.03;
      g.add(ring);
      tv.ownerRing = ring;
    };
    if (kind === 'well') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 12), stone);
      base.position.y = 0.07;
      base.castShadow = true;
      g.add(base);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4ab0ff, emissive: 0x2a80ff, emissiveIntensity: 1.2 }));
      pool.position.y = 0.145;
      g.add(pool);
      const crystal = new THREE.Mesh(G.octa, new THREE.MeshStandardMaterial({ color: 0x8ad0ff, emissive: 0x3aa0ff, emissiveIntensity: 2.2, roughness: 0.15, flatShading: true }));
      crystal.scale.set(1.2, 1.9, 1.2);
      crystal.position.y = 0.72;
      g.add(crystal);
      tv.nodeAnim = crystal;
      addRing();
    } else if (kind === 'shrine') {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.42, 8), stone);
      ped.position.y = 0.21;
      ped.castShadow = true;
      g.add(ped);
      const d20 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xb8862a, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25, flatShading: true }));
      d20.position.y = 0.82;
      d20.castShadow = true;
      g.add(d20);
      tv.nodeAnim = d20;
      addRing();
    } else if (kind === 'gate') {
      const circle = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: magicCircleTexture('#ffffff'), transparent: true, depthWrite: false, color: 0xd0b0ff, blending: THREE.AdditiveBlending }));
      circle.scale.setScalar(0.95);
      circle.position.y = 0.025;
      g.add(circle);
      tv.nodeAnim = circle;
      for (const sx of [-0.36, 0.36]) {
        const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 6), stone);
        ob.position.set(sx, 0.27, -0.36);
        ob.castShadow = true;
        g.add(ob);
        const gem = new THREE.Mesh(G.octa, new THREE.MeshStandardMaterial({ color: 0xd0b0ff, emissive: 0x9a6aff, emissiveIntensity: 2 }));
        gem.scale.setScalar(0.5);
        gem.position.set(sx, 0.62, -0.36);
        g.add(gem);
      }
      tv.ownerRing = circle;
    } else if (kind === 'spring') {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 6, 20).rotateX(Math.PI / 2), stone);
      rim.position.y = 0.05;
      g.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7affc8, emissive: 0x2aff9a, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.1 }));
      water.position.y = 0.04;
      g.add(water);
      tv.nodeAnim = water;
    } else if (kind === 'chest') {
      const wood = this.mat('chestwood', () => new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 }));
      const goldm = this.mat('gold', () => new THREE.MeshStandardMaterial({ color: 0xffc84a, metalness: 0.9, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.4 }));
      const body = new THREE.Mesh(G.box, wood);
      body.scale.set(0.5, 0.28, 0.34);
      body.position.y = 0.14;
      body.castShadow = true;
      g.add(body);
      const lid = new THREE.Group();
      const lidMesh = new THREE.Mesh(G.box, wood);
      lidMesh.scale.set(0.52, 0.12, 0.36);
      lidMesh.position.set(0, 0.06, 0.17);
      lid.add(lidMesh);
      const band = new THREE.Mesh(G.box, goldm);
      band.scale.set(0.06, 0.13, 0.37);
      band.position.set(0, 0.06, 0.17);
      lid.add(band);
      lid.position.set(0, 0.28, -0.17);
      g.add(lid);
      tv.nodeAnim = lid;
      const lock = new THREE.Mesh(G.box, goldm);
      lock.scale.set(0.08, 0.08, 0.02);
      lock.position.set(0, 0.22, 0.175);
      g.add(lock);
      g.rotation.y = 0.3;
    } else if (kind === 'altar') {
      const slab = new THREE.Mesh(G.box, stone);
      slab.scale.set(0.62, 0.3, 0.4);
      slab.position.y = 0.15;
      slab.castShadow = true;
      g.add(slab);
      const top = new THREE.Mesh(G.box, this.mat('altartop', () => new THREE.MeshStandardMaterial({ color: 0x5a3a6a, emissive: 0x6a2a8a, emissiveIntensity: 0.6 })));
      top.scale.set(0.5, 0.02, 0.28);
      top.position.y = 0.31;
      g.add(top);
      for (const sx of [-0.22, 0.22]) {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), this.mat('candle', () => new THREE.MeshStandardMaterial({ color: 0xf0e8d0 })));
        candle.position.set(sx, 0.38, 0);
        g.add(candle);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb040, blending: THREE.AdditiveBlending, depthWrite: false }));
        flame.scale.setScalar(0.18);
        flame.position.set(sx, 0.49, 0);
        g.add(flame);
      }
      tv.nodeAnim = top;
    } else if (kind === 'rune') {
      const mono = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.16), stone);
      mono.position.y = 0.45;
      mono.castShadow = true;
      g.add(mono);
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.5), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#7fe3ff'), transparent: true, color: 0x7fe3ff, blending: THREE.AdditiveBlending, depthWrite: false }));
      rune.position.set(0, 0.5, 0.085);
      g.add(rune);
      tv.nodeAnim = rune;
      g.rotation.y = 0.5;
    } else if (kind === 'gold') {
      const goldm = this.mat('gold', () => new THREE.MeshStandardMaterial({ color: 0xffc84a, metalness: 0.9, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.4 }));
      const r = mulberry(t.x * 13 + t.y * 7);
      for (let i = 0; i < 9; i++) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), goldm);
        coin.position.set((r() - 0.5) * 0.35, 0.02 + i * 0.022, (r() - 0.5) * 0.35);
        coin.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
        g.add(coin);
      }
      tv.nodeAnim = g;
    }
    tv.node = g;
    tv.group.add(g);
    g.position.y = tv.topY;
    this.applyNodeState(t, tv);
  }

  private applyNodeState(t: Tile, tv: TileView): void {
    if (!t.node) return;
    if (tv.ownerRing) {
      const owner = t.node.owner;
      const col = new THREE.Color(owner == null ? '#9a9a9a' : this.playerColors[owner] ?? '#ffffff');
      const m = tv.ownerRing.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      m.color.copy(col);
      if ('emissive' in m) {
        m.emissive.copy(col);
        m.emissiveIntensity = owner == null ? 0.2 : 1.4;
      }
    }
    if (t.node.used && tv.node) {
      if (t.node.kind === 'chest' && tv.nodeAnim) tv.nodeAnim.rotation.x = -1.9;
      if (t.node.kind === 'gold') tv.node.visible = false;
      tv.node.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && 'emissiveIntensity' in m && t.node!.kind !== 'chest') m.emissiveIntensity = 0.05;
      });
    }
  }

  updateNode(p: Pos): void {
    const t = this.board.get(p);
    const tv = this.tiles[p.y * this.board.w + p.x];
    if (!tv.node && t.node) this.buildNode(t, tv);
    else this.applyNodeState(t, tv);
  }

  // ------------------------------------------------------------------ surfaces

  private buildSurface(t: Tile, tv: TileView): void {
    if (tv.surface) {
      tv.group.remove(tv.surface);
      tv.surface = null;
    }
    if (!t.surface) return;
    const s: SurfaceType = t.surface;
    const conf: Record<SurfaceType, { color: number; emissive: number; opacity: number; ei: number }> = {
      fire: { color: 0xff6a10, emissive: 0xff4a00, opacity: 0.55, ei: 2.2 },
      oil: { color: 0x1a120a, emissive: 0x000000, opacity: 0.85, ei: 0 },
      ice: { color: 0xc8f0ff, emissive: 0x5ab8ff, opacity: 0.7, ei: 0.35 },
      poison: { color: 0x7aff3a, emissive: 0x3aa010, opacity: 0.45, ei: 0.9 },
      holy: { color: 0xffe08a, emissive: 0xffc040, opacity: 0.45, ei: 1.3 },
    };
    const c = conf[s];
    const m = this.mat(`surf:${s}`, () => new THREE.MeshStandardMaterial({ color: c.color, emissive: c.emissive, emissiveIntensity: c.ei, transparent: true, opacity: c.opacity, roughness: s === 'oil' || s === 'ice' ? 0.05 : 0.6, metalness: s === 'oil' ? 0.4 : 0, map: s === 'holy' ? ringTexture() : null, depthWrite: false }));
    const mesh = new THREE.Mesh(G.plane, m);
    mesh.scale.setScalar(0.96);
    mesh.position.y = tv.topY + 0.02;
    mesh.renderOrder = 3;
    tv.surface = mesh;
    tv.group.add(mesh);
  }

  setSurface(tiles: Pos[]): void {
    for (const p of tiles) {
      const t = this.board.get(p);
      const tv = this.tiles[p.y * this.board.w + p.x];
      this.buildSurface(t, tv);
    }
  }

  // ------------------------------------------------------------------ heights & terrain

  animateHeights(tiles: { x: number; y: number }[]): void {
    for (const p of tiles) {
      const t = this.board.get(p);
      const tv = this.tiles[p.y * this.board.w + p.x];
      tv.animFrom = tv.topY;
      tv.animTo = this.surfaceY(t);
      tv.animT = 0;
      if (t.terrain !== 'water' && tv.water) this.buildWater(t, tv);
      this.particles.burst({ pos: this.top(p.x, p.y).add(new THREE.Vector3(0, 0.05, 0)), count: 18, color: ['#c8a878', '#8a7050'], speed: 1.6, up: 1.5, gravity: 4, life: 0.8, size: 0.16, radius: 0.4, flat: true });
    }
  }

  setTerrain(tiles: { x: number; y: number }[]): void {
    for (const p of tiles) {
      const t = this.board.get(p);
      const tv = this.tiles[p.y * this.board.w + p.x];
      tv.topY = this.surfaceY(t);
      (tv.column.geometry as THREE.BufferGeometry).dispose();
      tv.column.geometry = this.columnGeometry(t.terrain === 'water' ? -0.3 : t.terrain === 'deep' ? -0.62 : tv.topY);
      (tv.column.material as THREE.Material[])[2] = this.topMaterial(t);
      this.decorate(t, tv);
      this.buildWater(t, tv);
      this.placeOverlays(tv);
      this.particles.burst({ pos: this.top(p.x, p.y), count: 14, color: ['#7fb24a', '#c8a878'], speed: 1.2, up: 1.2, gravity: 3, life: 0.7, size: 0.14, radius: 0.4, flat: true });
    }
  }

  // ------------------------------------------------------------------ highlights

  clearHighlights(): void {
    for (const tv of this.tiles) tv.hl.visible = false;
  }

  highlight(tiles: Pos[], style: HighlightStyle, opacity = 0.55): void {
    for (const p of tiles) {
      const tv = this.tiles[p.y * this.board.w + p.x];
      if (!tv) continue;
      tv.hl.visible = true;
      const m = tv.hl.material as THREE.MeshBasicMaterial;
      m.color.setHex(HL_COLORS[style]);
      m.opacity = opacity;
    }
  }

  setCursor(p: Pos | null, color = 0xffffff): void {
    if (!p) {
      this.cursor.visible = false;
      return;
    }
    const v = this.top(p.x, p.y);
    this.cursor.position.set(v.x, v.y + 0.05, v.z);
    (this.cursor.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.cursor.visible = true;
  }

  showPath(path: Pos[] | null): void {
    for (const c of [...this.pathGroup.children]) {
      this.pathGroup.remove(c);
      (c as THREE.Mesh).geometry?.dispose?.();
    }
    if (!path || path.length < 2) return;
    const mat = this.mat('pathdot', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    const pts: THREE.Vector3[] = path.map((p) => this.top(p.x, p.y).add(new THREE.Vector3(0, 0.12, 0)));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      for (let k = 0; k < 4; k++) {
        const f = k / 4;
        const dot = new THREE.Mesh(G.sphere, mat);
        dot.position.lerpVectors(a, b, f);
        dot.position.y += Math.sin(f * Math.PI) * 0.15 * Math.abs(b.y - a.y > 0.01 ? 2 : 1);
        dot.scale.setScalar(k === 0 ? 1.4 : 0.9);
        this.pathGroup.add(dot);
      }
    }
    const end = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), mat);
    end.position.copy(pts[pts.length - 1]).add(new THREE.Vector3(0, 0.2, 0));
    end.rotation.x = Math.PI;
    this.pathGroup.add(end);
  }

  // ------------------------------------------------------------------ per-frame

  update(dt: number, t: number): void {
    this.ambientT += dt;
    for (let i = 0; i < this.tiles.length; i++) {
      const tv = this.tiles[i];
      if (tv.animT < 1) {
        tv.animT = Math.min(1, tv.animT + dt * 2.2);
        const e = 1 - Math.pow(1 - tv.animT, 3);
        tv.topY = tv.animFrom + (tv.animTo - tv.animFrom) * e;
        (tv.column.geometry as THREE.BufferGeometry).dispose();
        const tile = this.board.tiles[i];
        tv.column.geometry = this.columnGeometry(tile.terrain === 'water' ? -0.3 : tile.terrain === 'deep' ? -0.62 : tv.topY);
        this.placeOverlays(tv);
      }
      if (tv.nodeAnim) {
        const tile = this.board.tiles[i];
        const kind = tile.node?.kind;
        if (kind === 'well' || kind === 'shrine') {
          tv.nodeAnim.rotation.y += dt * (kind === 'shrine' ? 0.9 : 0.6);
          if (kind === 'shrine') tv.nodeAnim.rotation.x += dt * 0.4;
          tv.nodeAnim.position.y = (kind === 'well' ? 0.72 : 0.82) + Math.sin(t * 2 + i) * 0.06;
        } else if (kind === 'gate') {
          tv.nodeAnim.rotation.y += dt * 0.5;
        } else if (kind === 'rune') {
          const m = (tv.nodeAnim as THREE.Mesh).material as THREE.MeshBasicMaterial;
          m.opacity = tile.node?.used ? 0.15 : 0.6 + Math.sin(t * 2.5 + i) * 0.35;
        }
      }
    }
    // ambient particles: surfaces, springs, wells
    if (this.ambientT > 0.08) {
      this.ambientT = 0;
      for (const tile of this.board.tiles) {
        if (tile.surface === 'fire' && Math.random() < 0.7) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.05, (Math.random() - 0.5) * 0.7));
          this.particles.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.2), Math.random() < 0.5 ? 0xff8a20 : 0xffd040, 0.22, 0.7, -0.5, 0.5);
        } else if (tile.surface === 'poison' && Math.random() < 0.35) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.15, (Math.random() - 0.5) * 0.7));
          this.particles.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.15, (Math.random() - 0.5) * 0.15), 0x5aff2a, 0.45, 1.6, 0, 0.3, false);
        } else if (tile.surface === 'holy' && Math.random() < 0.3) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.05, (Math.random() - 0.5) * 0.7));
          this.particles.spawn(p, new THREE.Vector3(0, 0.6, 0), 0xffe08a, 0.12, 1.2, 0, 0.2);
        } else if (tile.terrain === 'lava' && Math.random() < 0.2) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.05, (Math.random() - 0.5) * 0.8));
          this.particles.spawn(p, new THREE.Vector3(0, 0.7 + Math.random(), 0), 0xff7a20, 0.12, 1.2, 0.3, 0.2);
        } else if (tile.node?.kind === 'spring' && Math.random() < 0.25) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4));
          this.particles.spawn(p, new THREE.Vector3(0, 0.5, 0), 0x7affc8, 0.1, 1.0, 0, 0.2);
        } else if (tile.node?.kind === 'well' && tile.node.owner != null && Math.random() < 0.2) {
          const p = this.top(tile.x, tile.y).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5));
          this.particles.spawn(p, new THREE.Vector3(0, 0.6, 0), 0x6ac0ff, 0.1, 1.0, 0, 0.2);
        }
      }
      // biome ambience: fireflies / embers / stars drifting over the board
      if (Math.random() < 0.6) {
        const w = this.board.w;
        const h = this.board.h;
        const p = new THREE.Vector3((Math.random() - 0.5) * (w + 2), 0.3 + Math.random() * 2.5, (Math.random() - 0.5) * (h + 2));
        const color = this.board.biome === 'verdant' ? 0xd8ff8a : this.board.biome === 'ashen' ? 0xff8a3a : 0xb8a8ff;
        this.particles.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 0.2, this.board.biome === 'ashen' ? 0.35 : 0.05, (Math.random() - 0.5) * 0.2), color, 0.07, 3.5, 0, 0.1, false);
      }
    }
  }

  dispose(): void {
    this.world.root.remove(this.group);
    for (const m of this.mats.values()) m.dispose();
  }
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type { NodeKind };
