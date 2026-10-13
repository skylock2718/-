import * as THREE from 'three';

/**
 * Real polyhedral dice (d4 d6 d8 d10 d12 d20) with per-face numbers painted
 * into a texture atlas. Results are decided by the game RNG first; the
 * physical tumble is then steered so the die lands showing that value.
 */

export type DieTheme = 'player' | 'enemy' | 'check' | 'gold' | 'ally2' | 'ally3';

const THEMES: Record<DieTheme, { body: string; body2: string; ink: string; edge: number }> = {
  player: { body: '#1d3a8a', body2: '#3a6ad0', ink: '#ffe08a', edge: 0x0a1430 },
  enemy: { body: '#7a0c18', body2: '#c02a3a', ink: '#fff1d0', edge: 0x2a0408 },
  check: { body: '#1a1420', body2: '#3a2a4a', ink: '#ffd36a', edge: 0x000000 },
  gold: { body: '#8a6a10', body2: '#e0b040', ink: '#2a1a00', edge: 0x3a2a00 },
  ally2: { body: '#106a3a', body2: '#30b070', ink: '#f0fff0', edge: 0x032010 },
  ally3: { body: '#8a6a00', body2: '#d0a020', ink: '#1a1000', edge: 0x2a2000 },
};

interface FaceInfo {
  normal: THREE.Vector3;
  up: THREE.Vector3;
  value: number;
}

interface DieModel {
  geometry: THREE.BufferGeometry;
  faces: FaceInfo[];
  radius: number;
}

const modelCache = new Map<string, DieModel>();
const matCache = new Map<string, THREE.Material>();

function trapezohedron(): THREE.BufferGeometry {
  // pentagonal trapezohedron (d10)
  const verts: THREE.Vector3[] = [];
  const h = 0.105;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    verts.push(new THREE.Vector3(Math.cos(a), i % 2 ? h : -h, Math.sin(a)));
  }
  const top = new THREE.Vector3(0, 1, 0);
  const bot = new THREE.Vector3(0, -1, 0);
  const tris: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i += 2) {
    // top kite: top, v(i+1), v(i+2), v(i+3)?? build kites using odd vertices for top
    const a = verts[(i + 1) % 10];
    const b = verts[(i + 2) % 10];
    const c = verts[(i + 3) % 10];
    tris.push(top, c, b, top, b, a);
    const d = verts[i % 10];
    const e = verts[(i + 1) % 10];
    const f = verts[(i + 2) % 10];
    tris.push(bot, d, e, bot, e, f);
  }
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => arr.set([v.x, v.y, v.z], i * 3));
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

function baseGeometry(sides: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (sides) {
    case 4:
      g = new THREE.TetrahedronGeometry(1.15, 0);
      break;
    case 6:
      g = new THREE.BoxGeometry(1.25, 1.25, 1.25);
      break;
    case 8:
      g = new THREE.OctahedronGeometry(1.05, 0);
      break;
    case 10:
      g = trapezohedron();
      break;
    case 12:
      g = new THREE.DodecahedronGeometry(1.0, 0);
      break;
    default:
      g = new THREE.IcosahedronGeometry(1.0, 0);
  }
  return g.index ? g.toNonIndexed() : g;
}

function buildModel(sides: number, theme: DieTheme): { model: DieModel; atlas: THREE.CanvasTexture } {
  const g = baseGeometry(sides);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const triCount = pos.count / 3;
  // group triangles into faces by normal
  const groups: { normal: THREE.Vector3; tris: number[] }[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    let grp = groups.find((x) => x.normal.dot(n) > 0.995);
    if (!grp) {
      grp = { normal: n.clone(), tris: [] };
      groups.push(grp);
    }
    grp.tris.push(t);
  }
  // face geometry info
  const faces = groups.map((grp) => {
    const verts: THREE.Vector3[] = [];
    for (const t of grp.tris) for (let k = 0; k < 3; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, t * 3 + k);
      if (!verts.some((x) => x.distanceToSquared(v) < 1e-8)) verts.push(v);
    }
    const centroid = verts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / verts.length);
    let upRef: THREE.Vector3;
    if (sides === 6) {
      // towards the midpoint of an edge
      const sorted = verts.slice().sort((p, q) => p.distanceTo(verts[0]) - q.distanceTo(verts[0]));
      upRef = sorted[0].clone().add(sorted[1]).multiplyScalar(0.5);
    } else {
      upRef = verts.slice().sort((p, q) => q.distanceTo(centroid) - p.distanceTo(centroid))[0];
      if (sides === 10) {
        // the apex of each kite is the farthest vertex (top/bottom poles)
        upRef = verts.slice().sort((p, q) => Math.abs(q.y) - Math.abs(p.y))[0];
      }
    }
    const n = grp.normal;
    const up = upRef.clone().sub(centroid);
    up.sub(n.clone().multiplyScalar(up.dot(n))).normalize();
    const maxR = Math.max(...verts.map((v) => v.distanceTo(centroid)));
    return { grp, centroid, normal: n, up, maxR };
  });
  // values: opposite faces sum to sides+1
  const values = new Array(faces.length).fill(0);
  if (sides === 4) faces.forEach((_, i) => (values[i] = i + 1));
  else {
    const used = new Set<number>();
    let next = 1;
    for (let i = 0; i < faces.length; i++) {
      if (used.has(i)) continue;
      let opp = -1;
      let best = 1;
      for (let j = 0; j < faces.length; j++) {
        if (j === i || used.has(j)) continue;
        const d = faces[i].normal.dot(faces[j].normal);
        if (d < best) {
          best = d;
          opp = j;
        }
      }
      values[i] = next;
      used.add(i);
      if (opp >= 0) {
        values[opp] = sides + 1 - next;
        used.add(opp);
      }
      next++;
    }
  }
  // atlas
  const th = THEMES[theme];
  const N = faces.length;
  const cols = Math.ceil(Math.sqrt(N));
  const S = 1024;
  const cell = S / cols;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, th.body2);
  grad.addColorStop(1, th.body);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  // marble veins
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2;
    const v = values[i];
    const fs = cell * (sides === 20 ? 0.36 : sides === 12 || sides === 10 ? 0.34 : 0.44) * (v >= 10 ? 0.85 : 1);
    ctx.font = `900 ${fs}px "Cinzel", Georgia, serif`;
    ctx.lineWidth = fs * 0.12;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const ty = sides === 4 || sides === 20 || sides === 8 ? cy + cell * 0.04 : cy;
    ctx.strokeText(String(v), cx, ty);
    ctx.fillStyle = th.ink;
    ctx.shadowColor = th.ink;
    ctx.shadowBlur = 6;
    ctx.fillText(String(v), cx, ty);
    ctx.shadowBlur = 0;
    if ((v === 6 || v === 9) && sides > 6) {
      ctx.fillRect(cx - fs * 0.22, ty + fs * 0.42, fs * 0.44, fs * 0.08);
    }
  }
  const atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  // UVs
  const uv = new Float32Array(pos.count * 2);
  faces.forEach((f, i) => {
    const right = new THREE.Vector3().crossVectors(f.up, f.normal).normalize();
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2;
    const s = ((cell / 2) * 0.96) / f.maxR;
    for (const t of f.grp.tris) {
      for (let k = 0; k < 3; k++) {
        const vi = t * 3 + k;
        const v = new THREE.Vector3().fromBufferAttribute(pos, vi).sub(f.centroid);
        const px = cx + v.dot(right) * s;
        const py = cy - v.dot(f.up) * s;
        uv[vi * 2] = px / S;
        uv[vi * 2 + 1] = 1 - py / S;
      }
    }
  });
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return {
    model: { geometry: g, faces: faces.map((f, i) => ({ normal: f.normal.clone(), up: f.up.clone(), value: values[i] })), radius: g.boundingSphere!.radius },
    atlas,
  };
}

export function makeDie(sides: number, theme: DieTheme): { mesh: THREE.Mesh; model: DieModel } {
  const key = `${sides}:${theme}`;
  let model = modelCache.get(key);
  let mat = matCache.get(key);
  if (!model || !mat) {
    const built = buildModel(sides, theme);
    model = built.model;
    mat = new THREE.MeshStandardMaterial({ map: built.atlas, roughness: 0.32, metalness: 0.12, flatShading: true, emissive: 0x000000 });
    modelCache.set(key, model);
    matCache.set(key, mat);
  }
  const mesh = new THREE.Mesh(model.geometry, (mat as THREE.MeshStandardMaterial).clone());
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(model.geometry, 10), new THREE.LineBasicMaterial({ color: THEMES[theme].edge, transparent: true, opacity: 0.6 }));
  mesh.add(edges);
  mesh.castShadow = true;
  return { mesh, model };
}

/** Quaternion that puts the face with `value` on top, its number upright for a camera looking from +Z/+Y */
export function restingQuaternion(model: DieModel, value: number, twist = 0): THREE.Quaternion {
  const f = model.faces.find((x) => x.value === value) ?? model.faces[0];
  const q1 = new THREE.Quaternion().setFromUnitVectors(f.normal.clone().normalize(), new THREE.Vector3(0, 1, 0));
  const u1 = f.up.clone().applyQuaternion(q1);
  const heading = Math.atan2(u1.x, u1.z);
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - heading + twist);
  return q2.multiply(q1);
}

// ======================================================================
// Tray
// ======================================================================

export interface DieRequest {
  sides: number;
  value: number;
  theme: DieTheme;
  /** dropped die of an advantage/disadvantage pair */
  dropped?: boolean;
  /** natural 20 / crit glow */
  glow?: 'crit' | 'fumble' | null;
}

interface LiveDie {
  mesh: THREE.Mesh;
  model: DieModel;
  req: DieRequest;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  quat: THREE.Quaternion;
  target: THREE.Vector3;
  targetQ: THREE.Quaternion;
  settleFrom: THREE.Quaternion | null;
  settlePos: THREE.Vector3 | null;
  size: number;
}

export class DiceTray {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private dice: LiveDie[] = [];
  private raf = 0;
  private t = 0;
  private dur = 1;
  private resolveRoll: (() => void) | null = null;
  private last = 0;
  private fade = 1;
  private fading = false;
  speed = 1;
  visible = false;
  onLand: (() => void) | null = null;
  onBounce: ((strength: number) => void) | null = null;

  constructor(
    private host: HTMLElement,
    private big = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'dice-canvas';
    host.appendChild(this.canvas);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 13, 7.5);
    this.camera.lookAt(0, 0, 0.3);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.2));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    key.position.set(-3, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 6;
    sc.bottom = -6;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ab0ff, 1.0);
    rim.position.set(4, 3, -5);
    this.scene.add(rim);
    // invisible shadow-catching floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  resize = (): void => {
    const w = this.host.clientWidth || 400;
    const h = this.host.clientHeight || 240;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  clear(): void {
    for (const d of this.dice) this.scene.remove(d.mesh);
    this.dice = [];
  }

  /** fade the current dice away */
  hide(): void {
    if (!this.dice.length) return;
    this.fading = true;
  }

  /** Throw dice; resolves when they have settled. */
  roll(reqs: DieRequest[]): Promise<void> {
    this.clear();
    this.fading = false;
    this.fade = 1;
    this.resize();
    const n = reqs.length;
    const aspect = this.camera.aspect;
    const span = Math.min(9.5 * aspect * 0.55, 2.4 * n);
    const size = this.big ? 1.6 : n > 4 ? 0.85 : n > 2 ? 1.0 : 1.15;
    reqs.forEach((req, i) => {
      const { mesh, model } = makeDie(req.sides, req.theme);
      mesh.scale.setScalar(size);
      const target = new THREE.Vector3(n === 1 ? 0 : -span / 2 + (span * i) / (n - 1), model.radius * size * 0.82, 0.4);
      const start = new THREE.Vector3(6 + Math.random() * 2, 3 + Math.random() * 2, -1 + Math.random() * 2);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      mesh.quaternion.copy(quat);
      mesh.position.copy(start);
      this.scene.add(mesh);
      const d: LiveDie = {
        mesh,
        model,
        req,
        pos: start.clone(),
        vel: new THREE.Vector3((target.x - start.x) * 1.6, 2 + Math.random() * 2, (target.z - start.z) * 1.6),
        ang: new THREE.Vector3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22),
        quat,
        target,
        targetQ: restingQuaternion(model, req.value, (Math.random() - 0.5) * 0.4),
        settleFrom: null,
        settlePos: null,
        size,
      };
      this.dice.push(d);
    });
    this.t = 0;
    this.dur = (this.big ? 1.5 : 0.95) / this.speed;
    this.visible = true;
    this.start();
    return new Promise((r) => {
      this.resolveRoll = r;
    });
  }

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.renderer.render(this.scene, this.camera);
      if (!this.dice.length && !this.resolveRoll) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    };
    loop();
  }

  private step(dt: number): void {
    this.t += dt;
    const settleStart = this.dur * 0.62;
    for (const d of this.dice) {
      if (this.t < settleStart) {
        d.vel.y -= 32 * dt;
        d.pos.addScaledVector(d.vel, dt);
        const floorY = d.model.radius * d.size * 0.82;
        if (d.pos.y < floorY) {
          d.pos.y = floorY;
          const impact = Math.abs(d.vel.y);
          d.vel.y = impact * 0.42;
          d.vel.x *= 0.7;
          d.vel.z *= 0.7;
          d.ang.multiplyScalar(0.75);
          if (impact > 3) this.onBounce?.(Math.min(1, impact / 14));
        }
        // pull toward slot horizontally
        d.vel.x += (d.target.x - d.pos.x) * 6 * dt;
        d.vel.z += (d.target.z - d.pos.z) * 6 * dt;
        const w = d.ang;
        const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.x * dt, w.y * dt, w.z * dt));
        d.quat.premultiply(dq);
        d.mesh.position.copy(d.pos);
        d.mesh.quaternion.copy(d.quat);
      } else {
        if (!d.settleFrom) {
          d.settleFrom = d.mesh.quaternion.clone();
          d.settlePos = d.mesh.position.clone();
        }
        const k = Math.min(1, (this.t - settleStart) / (this.dur - settleStart));
        const e = 1 - Math.pow(1 - k, 3);
        d.mesh.quaternion.slerpQuaternions(d.settleFrom, d.targetQ, e);
        d.mesh.position.lerpVectors(d.settlePos!, d.target, e);
        d.mesh.position.y = d.target.y + Math.sin(e * Math.PI) * 0.25;
      }
      // dropped dice fade, crit glow
      const m = d.mesh.material as THREE.MeshStandardMaterial;
      if (this.t >= this.dur) {
        if (d.req.dropped) {
          m.transparent = true;
          m.opacity = 0.35 * this.fade;
        }
        if (d.req.glow === 'crit') {
          m.emissive.setHex(0xffb020);
          m.emissiveIntensity = 0.35 + Math.sin(this.t * 8) * 0.2;
        } else if (d.req.glow === 'fumble') {
          m.emissive.setHex(0xff0000);
          m.emissiveIntensity = 0.3 + Math.sin(this.t * 8) * 0.15;
        }
      }
      if (this.fading) {
        m.transparent = true;
        m.opacity = (d.req.dropped ? 0.35 : 1) * this.fade;
        d.mesh.children.forEach((c) => (((c as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = 0.6 * this.fade));
      }
    }
    if (this.fading) {
      this.fade -= dt * 3;
      if (this.fade <= 0) {
        this.clear();
        this.fading = false;
        this.visible = false;
      }
    }
    if (this.resolveRoll && this.t >= this.dur) {
      const r = this.resolveRoll;
      this.resolveRoll = null;
      this.onLand?.();
      r();
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
