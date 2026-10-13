import * as THREE from 'three';
import { Fx } from '../render/fx';
import { Particles } from '../render/particles';
import { World } from '../render/world';
import { qualityOf, type Settings } from './store';

/**
 * The persistent 3D stage (one WebGL context for the whole app). Screens
 * borrow it: the title screen shows a slowly turning diorama, battles build
 * a full board.
 */
export class Stage {
  world: World;
  particles: Particles;
  fx: Fx;
  private off: (() => void) | null = null;

  constructor(host: HTMLElement, settings: Settings) {
    this.world = new World(host, qualityOf(settings.quality));
    this.particles = new Particles(5000);
    this.world.scene.add(this.particles.points);
    this.fx = new Fx(this.world, this.particles);
    this.off = this.world.onFrame((dt) => {
      this.particles.setScale(this.world.renderer.getDrawingBufferSize(new THREE.Vector2()).y);
      this.particles.update(dt);
      this.fx.update(dt);
    });
  }

  applySettings(s: Settings): void {
    this.world.setQuality(qualityOf(s.quality));
    this.fx.speed = s.animSpeed;
    this.fx.shakeEnabled = s.shake;
  }

  reset(): void {
    this.world.clearRoot();
    this.particles.clear();
    this.world.cam.autoRotate = 0;
    this.world.cam.reset();
  }

  dispose(): void {
    this.off?.();
    this.world.dispose();
  }
}

let stage: Stage | null = null;

export function getStage(): Stage | null {
  return stage;
}

export function initStage(host: HTMLElement, settings: Settings): Stage {
  if (!stage) stage = new Stage(host, settings);
  return stage;
}
