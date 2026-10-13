import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface Quality {
  bloom: boolean;
  shadows: boolean;
  pixelRatio: number;
}

export type FrameFn = (dt: number, t: number) => void;

export interface PickHit {
  kind: 'tile' | 'unit';
  x: number;
  y: number;
  uid?: number;
}

/** Height of one terrain level in world units. */
export const LEVEL_H = 0.42;

/**
 * Owns the WebGL renderer, scene, camera rig, post-processing and the frame
 * loop. Other render modules attach objects into `root` and register frame
 * callbacks.
 */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  readonly fxRoot = new THREE.Group();
  readonly hemi: THREE.HemisphereLight;
  readonly key: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private frameFns = new Set<FrameFn>();
  private clock = new THREE.Clock();
  private raf = 0;
  private quality: Quality;
  readonly raycaster = new THREE.Raycaster();
  pickables: THREE.Object3D[] = [];
  readonly cam = new CameraRig();
  time = 0;

  constructor(
    readonly container: HTMLElement,
    quality: Quality,
  ) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.scene.add(this.root);
    this.scene.add(this.fxRoot);
    this.scene.background = new THREE.Color('#0c1014');
    this.scene.fog = new THREE.Fog('#0c1014', 30, 70);

    this.hemi = new THREE.HemisphereLight(0x9fb7c8, 0x2a1c12, 0.9);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffe2b8, 2.1);
    this.key.position.set(-7, 14, 8);
    this.key.castShadow = true;
    const sm = quality.pixelRatio > 1 ? 2048 : 1024;
    this.key.shadow.mapSize.set(sm, sm);
    const sc = this.key.shadow.camera;
    sc.left = -10;
    sc.right = 10;
    sc.top = 10;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 40;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key);
    this.scene.add(this.key.target);
    this.fill = new THREE.DirectionalLight(0x8aa8ff, 0.55);
    this.fill.position.set(8, 6, -6);
    this.scene.add(this.fill);

    this.setupPost();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  private setupPost(): void {
    if (!this.quality.bloom) {
      this.composer = null;
      this.bloom = null;
      return;
    }
    const size = this.renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.45, 0.82);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  setQuality(q: Quality): void {
    const bloomChanged = q.bloom !== this.quality.bloom;
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.key.castShadow = q.shadows;
    if (bloomChanged) this.setupPost();
    this.resize();
  }

  resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w, h);
  };

  onFrame(fn: FrameFn): () => void {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.cam.update(dt, this.camera);
    for (const fn of this.frameFns) fn(dt, this.time);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  };

  /** Convert a world position into CSS pixel coordinates of the container. */
  project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && p.z > -1 };
  }

  pick(clientX: number, clientY: number): PickHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o?.userData.pick) return o.userData.pick as PickHit;
    }
    return null;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  clearRoot(): void {
    for (const c of [...this.root.children]) {
      this.root.remove(c);
      disposeTree(c);
    }
    for (const c of [...this.fxRoot.children]) {
      this.fxRoot.remove(c);
      disposeTree(c);
    }
    this.pickables = [];
  }
}

export function disposeTree(o: THREE.Object3D): void {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/**
 * Orbit camera around a target with smoothing, 90° snap rotation, zoom, pan
 * and screen shake.
 */
export class CameraRig {
  target = new THREE.Vector3(0, 0, 0);
  goalTarget = new THREE.Vector3(0, 0, 0);
  azimuth = Math.PI * 0.12;
  goalAzimuth = Math.PI * 0.12;
  elevation = 0.92;
  goalElevation = 0.92;
  distance = 21;
  goalDistance = 21;
  minDist = 9;
  maxDist = 34;
  bounds = 6;
  private shakeT = 0;
  private shakeI = 0;
  autoRotate = 0;

  update(dt: number, cam: THREE.PerspectiveCamera): void {
    const k = 1 - Math.pow(0.0015, dt);
    this.goalAzimuth += this.autoRotate * dt;
    this.azimuth += (this.goalAzimuth - this.azimuth) * k;
    this.elevation += (this.goalElevation - this.elevation) * k;
    this.distance += (this.goalDistance - this.distance) * k;
    this.target.lerp(this.goalTarget, k);
    const ce = Math.cos(this.elevation);
    const pos = new THREE.Vector3(Math.sin(this.azimuth) * ce * this.distance, Math.sin(this.elevation) * this.distance, Math.cos(this.azimuth) * ce * this.distance).add(this.target);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeI * Math.max(0, this.shakeT) * 4;
      pos.x += (Math.random() - 0.5) * s;
      pos.y += (Math.random() - 0.5) * s;
      pos.z += (Math.random() - 0.5) * s;
    }
    cam.position.copy(pos);
    cam.lookAt(this.target);
  }

  rotate(steps: number): void {
    this.goalAzimuth += (steps * Math.PI) / 2;
  }

  orbit(dAz: number, dEl: number): void {
    this.goalAzimuth += dAz;
    this.goalElevation = Math.max(0.45, Math.min(1.35, this.goalElevation + dEl));
  }

  zoom(f: number): void {
    this.goalDistance = Math.max(this.minDist, Math.min(this.maxDist, this.goalDistance * f));
  }

  pan(dx: number, dz: number): void {
    // pan relative to view direction
    const s = Math.sin(this.azimuth);
    const c = Math.cos(this.azimuth);
    this.goalTarget.x += dx * c + dz * s;
    this.goalTarget.z += -dx * s + dz * c;
    this.clamp();
  }

  focus(p: THREE.Vector3, blend = 0.5): void {
    this.goalTarget.lerp(new THREE.Vector3(p.x, 0, p.z), blend);
    this.clamp();
  }

  reset(): void {
    this.goalTarget.set(0, 0, 0);
  }

  private clamp(): void {
    const b = this.bounds;
    this.goalTarget.x = Math.max(-b, Math.min(b, this.goalTarget.x));
    this.goalTarget.z = Math.max(-b, Math.min(b, this.goalTarget.z));
  }

  shake(intensity: number, duration = 0.35): void {
    this.shakeI = Math.max(this.shakeI * (this.shakeT > 0 ? 1 : 0), intensity);
    this.shakeT = Math.max(this.shakeT, duration);
  }

  /** world-space direction the camera looks from (for billboarding) */
  get yaw(): number {
    return this.azimuth;
  }
}
