import * as THREE from 'three';

/**
 * CPU-simulated GPU-rendered particle pool (single draw call, additive).
 */

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor * (1.0 + a * 0.6), a * vAlpha);
}
`;

export interface BurstOpts {
  pos: THREE.Vector3;
  count: number;
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  speed?: number;
  /** extra upward velocity */
  up?: number;
  spread?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  /** spawn radius around pos */
  radius?: number;
  /** spawn within a horizontal disc instead of a sphere */
  flat?: boolean;
  /** velocity direction bias */
  dir?: THREE.Vector3;
  shrink?: boolean;
}

export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private size0: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private shrink: Uint8Array;
  private next = 0;
  private geom: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private tmpColor = new THREE.Color();

  constructor(max = 5000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.life0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.shrink = new Uint8Array(max);
    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geom.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geom.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geom.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geom, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(viewportHeight: number): void {
    // drawing-buffer height / (2 * tan(fov/2)) so particle sizes are in world units
    this.mat.uniforms.uScale.value = viewportHeight * 1.85;
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, color: THREE.ColorRepresentation, size: number, life: number, gravity = 0, drag = 0, shrink = true): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x;
    this.vel[i * 3 + 1] = v.y;
    this.vel[i * 3 + 2] = v.z;
    this.tmpColor.set(color);
    this.col[i * 3] = this.tmpColor.r;
    this.col[i * 3 + 1] = this.tmpColor.g;
    this.col[i * 3 + 2] = this.tmpColor.b;
    this.size[i] = size;
    this.size0[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.life0[i] = life;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.shrink[i] = shrink ? 1 : 0;
  }

  burst(o: BurstOpts): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    const sp = o.speed ?? 2;
    const p = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < o.count; i++) {
      const r = o.radius ?? 0.05;
      if (o.flat) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * r;
        p.set(o.pos.x + Math.cos(a) * rr, o.pos.y, o.pos.z + Math.sin(a) * rr);
      } else {
        p.set(o.pos.x + (Math.random() - 0.5) * 2 * r, o.pos.y + (Math.random() - 0.5) * 2 * r, o.pos.z + (Math.random() - 0.5) * 2 * r);
      }
      // random direction
      const th = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      v.set(Math.cos(th) * s, u, Math.sin(th) * s).multiplyScalar(sp * (0.3 + Math.random() * 0.7) * (o.spread ?? 1));
      if (o.dir) v.add(o.dir.clone().multiplyScalar(sp * (0.5 + Math.random() * 0.5)));
      v.y += (o.up ?? 0) * (0.5 + Math.random() * 0.5);
      this.spawn(p, v, colors[Math.floor(Math.random() * colors.length)], (o.size ?? 0.18) * (0.6 + Math.random() * 0.8), (o.life ?? 0.8) * (0.6 + Math.random() * 0.6), o.gravity ?? 0, o.drag ?? 1.5, o.shrink ?? true);
    }
  }

  update(dt: number): void {
    const n = this.max;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.life0[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, k * 1.6);
      this.size[i] = this.shrink[i] ? this.size0[i] * (0.3 + 0.7 * k) : this.size0[i];
    }
    (this.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
  }
}
