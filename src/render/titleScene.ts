import * as THREE from 'three';
import type { Stage } from '../app/stage';
import { generateMap } from '../core/mapgen';
import type { BiomeId } from '../core/types';
import { BoardView } from './boardView';
import { makeDie } from './dice3d';
import { canvasTexture, glowTexture, portraitCanvas } from './textures';

/**
 * Slowly turning diorama behind the menus: a small generated board, a few
 * hero standees and the giant Fate Die hovering above it.
 */
export class TitleScene {
  private board: BoardView;
  private die: THREE.Mesh;
  private halo: THREE.Sprite;
  private standees: THREE.Group[] = [];
  private owned: THREE.Object3D[] = [];
  private off: () => void;
  private t = 0;
  private dieShown = true;

  constructor(
    private stage: Stage,
    biome: BiomeId = 'verdant',
    heroes: { icon: string; colors: [string, string, string]; name: string; team: string }[] = [],
    showDie = true,
  ) {
    stage.reset();
    const world = stage.world;
    const map = generateMap({ biome, w: 9, h: 9, players: 2, seed: 7 + biome.length * 13, events: 2 });
    this.board = new BoardView(world, map.board, stage.particles);
    world.cam.autoRotate = 0.06;
    world.cam.goalDistance = 19;
    world.cam.distance = 26;
    world.cam.goalElevation = 0.62;
    world.cam.elevation = 0.75;
    world.cam.goalTarget.set(0, 0.6, 0);
    // the Fate Die
    const { mesh } = makeDie(20, 'check');
    mesh.scale.setScalar(1.25);
    mesh.position.set(0, 4.2, 0);
    world.fxRoot.add(mesh);
    this.owned.push(mesh);
    this.die = mesh;
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false }));
    this.halo.scale.setScalar(6);
    this.halo.position.copy(mesh.position);
    world.fxRoot.add(this.halo);
    const light = new THREE.PointLight(0xffc860, 8, 12, 2);
    light.position.set(0, 4.2, 0);
    world.fxRoot.add(light);
    this.owned.push(this.halo, light);
    this.dieShown = showDie;
    mesh.visible = showDie;
    this.halo.visible = showDie;
    light.visible = showDie;
    // standees around the centre
    const spots = [
      { x: 3, y: 5 },
      { x: 5, y: 3 },
      { x: 2, y: 3 },
      { x: 6, y: 5 },
      { x: 4, y: 6 },
    ];
    heroes.slice(0, spots.length).forEach((h, i) => {
      const s = spots[i];
      const g = new THREE.Group();
      const tex = canvasTexture(portraitCanvas({ icon: h.icon, colors: h.colors, name: h.name, hero: true, team: h.team, seed: i + 1 }));
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.96, 0.03).translate(0, 0.55, 0), [
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }),
        new THREE.MeshStandardMaterial({ map: tex, color: 0xb0a898 }),
      ]);
      card.castShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.07, 28).translate(0, 0.035, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(h.team).multiplyScalar(0.55), metalness: 0.6, roughness: 0.35 }));
      g.add(base, card);
      const p = this.board.top(s.x, s.y);
      g.position.copy(p);
      g.scale.setScalar(1.25);
      world.root.add(g);
      this.owned.push(g);
      this.standees.push(g);
    });
    this.off = world.onFrame((dt, t) => this.update(dt, t));
  }

  private update(dt: number, t: number): void {
    this.t += dt;
    this.board.update(dt, t);
    this.die.rotation.x += dt * 0.35;
    this.die.rotation.y += dt * 0.5;
    this.die.position.y = 4.2 + Math.sin(t * 0.8) * 0.25;
    this.halo.position.y = this.die.position.y;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(t * 1.3) * 0.12;
    const yaw = this.stage.world.cam.yaw;
    for (const s of this.standees) s.children[1].rotation.y = yaw;
    // golden motes drifting down from the die
    if (this.dieShown && Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.2;
      this.stage.particles.spawn(new THREE.Vector3(Math.cos(a) * r, this.die.position.y - 0.5, Math.sin(a) * r), new THREE.Vector3(0, -0.6 - Math.random() * 0.6, 0), 0xffd36a, 0.09, 3, 0, 0.1, false);
    }
  }

  dispose(): void {
    this.off();
    this.board.dispose();
    for (const o of this.owned) o.parent?.remove(o);
    this.stage.world.cam.autoRotate = 0;
  }
}
