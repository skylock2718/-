import * as THREE from 'three';
import { ICONS } from '../assets/icons.generated';
import type { BiomeId, TerrainType } from '../core/types';

/** Procedural canvas textures: everything is painted at runtime, no image assets. */

function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function tex(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, size = 2): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size * (0.5 + r());
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, rad = 18): void {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const rr = rad * (0.4 + r());
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    const c = colors[Math.floor(r() * colors.length)];
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35 + r() * 0.3;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** subtle bevel/border so tiles read as separate blocks */
function tileEdge(ctx: CanvasRenderingContext2D, w: number, h: number, dark = 'rgba(0,0,0,0.35)', light = 'rgba(255,255,255,0.10)'): void {
  ctx.lineWidth = 6;
  ctx.strokeStyle = dark;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.lineWidth = 2;
  ctx.strokeStyle = light;
  ctx.strokeRect(8, 8, w - 16, h - 16);
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export interface BiomePalette {
  ground: string[];
  ground2: string[];
  cliff: string[];
  forestFloor: string[];
  sky: [string, string];
  fog: string;
  table: string;
  ambient: number;
  key: number;
  water: string;
  deep: string;
}

export const BIOME_PALETTE: Record<BiomeId, BiomePalette> = {
  verdant: {
    ground: ['#5f8f3a', '#6e9e42', '#557f34', '#79a84c'],
    ground2: ['#8db35a', '#4a7430', '#a6c46a'],
    cliff: ['#6b5236', '#5a4430', '#7d6143', '#4b3828'],
    forestFloor: ['#3f6a2a', '#4b7a31', '#355c24'],
    sky: ['#1a2730', '#0b1015'],
    fog: '#14202a',
    table: '#3a2616',
    ambient: 0x9fb7c8,
    key: 0xffe2b8,
    water: '#3f8fb8',
    deep: '#1f4f78',
  },
  ashen: {
    ground: ['#6a5a4e', '#5c4c42', '#76655a', '#4f4038'],
    ground2: ['#8a6a50', '#3f332c', '#9a7a5a'],
    cliff: ['#3d302a', '#2f2420', '#4a3a32', '#5a4438'],
    forestFloor: ['#4a3c32', '#3c3029', '#54443a'],
    sky: ['#2a1410', '#100806'],
    fog: '#2a1610',
    table: '#2a1a12',
    ambient: 0xc8a090,
    key: 0xffc890,
    water: '#4a7a8a',
    deep: '#203840',
  },
  astral: {
    ground: ['#5a5e8a', '#4c5080', '#666a98', '#555a86'],
    ground2: ['#8a7ac8', '#3c3f6a', '#a0b0e8'],
    cliff: ['#2c2c4c', '#24243e', '#34345a', '#1e1e36'],
    forestFloor: ['#4a4a7a', '#3e3e6a', '#56569a'],
    sky: ['#120c26', '#05040c'],
    fog: '#120c22',
    table: '#1a1426',
    ambient: 0xa8a8ff,
    key: 0xe8e0ff,
    water: '#6a8aff',
    deep: '#100820',
  },
};

export function groundTexture(biome: BiomeId, terrain: TerrainType, variant: number): THREE.Texture {
  const v = Math.floor(variant * 4);
  return cached(`g:${biome}:${terrain}:${v}`, () => {
    const pal = BIOME_PALETTE[biome];
    const [c, ctx] = canvas(128, 128);
    const r = rand(1234 + v * 97 + terrain.length * 13 + biome.length * 7);
    const base = terrain === 'forest' ? pal.forestFloor : pal.ground;
    ctx.fillStyle = base[v % base.length];
    ctx.fillRect(0, 0, 128, 128);
    blotches(ctx, 128, 128, 14, [...base, ...pal.ground2], r, 26);
    if (biome === 'verdant') {
      // grass strokes
      for (let i = 0; i < 160; i++) {
        const x = r() * 128;
        const y = r() * 128;
        ctx.strokeStyle = r() < 0.5 ? 'rgba(170,210,110,0.45)' : 'rgba(40,70,20,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4);
        ctx.stroke();
      }
    } else if (biome === 'ashen') {
      // cracks with faint glow
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = r() < 0.4 ? 'rgba(255,120,40,0.35)' : 'rgba(20,10,5,0.5)';
        ctx.lineWidth = 1 + r();
        ctx.beginPath();
        let x = r() * 128;
        let y = r() * 128;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (r() - 0.5) * 30;
          y += (r() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      // astral: rune grid lines
      ctx.strokeStyle = 'rgba(180,190,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(64, 10);
      ctx.lineTo(64, 118);
      ctx.moveTo(10, 64);
      ctx.lineTo(118, 64);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 64, 26 + v * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    speckle(ctx, 128, 128, 220, ['#000000', '#ffffff', ...pal.ground2], r, 1.6);
    tileEdge(ctx, 128, 128);
    return tex(c);
  });
}

export function cliffTexture(biome: BiomeId): THREE.Texture {
  return cached(`cliff:${biome}`, () => {
    const pal = BIOME_PALETTE[biome];
    const [c, ctx] = canvas(64, 128);
    const r = rand(77 + biome.length);
    // strata bands
    let y = 0;
    let i = 0;
    while (y < 128) {
      const hh = 6 + r() * 14;
      ctx.fillStyle = pal.cliff[i++ % pal.cliff.length];
      ctx.fillRect(0, y, 64, hh);
      y += hh;
    }
    blotches(ctx, 64, 128, 10, ['rgba(0,0,0,0.6)', 'rgba(255,255,255,0.2)'], r, 12);
    speckle(ctx, 64, 128, 160, ['#000', '#fff'], r, 1.5);
    // top lip shadow
    const g = ctx.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 14);
    const t = tex(c, true);
    return t;
  });
}

export function waterTexture(color: string): THREE.Texture {
  return cached(`water:${color}`, () => {
    const [c, ctx] = canvas(128, 128);
    const r = rand(42);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.15})`;
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      const x = r() * 128;
      const y = r() * 128;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 3, x + 16 + r() * 10, y);
      ctx.stroke();
    }
    return tex(c, true);
  });
}

export function lavaTexture(): THREE.Texture {
  return cached('lava', () => {
    const [c, ctx] = canvas(128, 128);
    const r = rand(9);
    ctx.fillStyle = '#ff5a00';
    ctx.fillRect(0, 0, 128, 128);
    blotches(ctx, 128, 128, 30, ['#ffd000', '#ff2a00', '#ff8800', '#401000'], r, 22);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(40,10,0,0.7)';
      ctx.beginPath();
      ctx.ellipse(r() * 128, r() * 128, 6 + r() * 12, 4 + r() * 8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c, true);
  });
}

export function woodTexture(color: string): THREE.Texture {
  return cached(`wood:${color}`, () => {
    const [c, ctx] = canvas(512, 512);
    const r = rand(5);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const y = r() * 512;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,180,0.06)';
      ctx.lineWidth = 0.5 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      ctx.stroke();
    }
    // planks
    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, p * 128, 512, 3);
    }
    blotches(ctx, 512, 512, 30, ['rgba(0,0,0,0.5)'], r, 60);
    return tex(c, true);
  });
}

export function glowTexture(): THREE.Texture {
  return cached('glow', () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return tex(c);
  });
}

export function ringTexture(): THREE.Texture {
  return cached('ring', () => {
    const [c, ctx] = canvas(128, 128);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, Math.PI * 2);
    ctx.stroke();
    return tex(c);
  });
}

/** highlight square for tile overlays */
export function tileHighlightTexture(): THREE.Texture {
  return cached('tilehl', () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 90);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.fillStyle = g;
    roundRect(ctx, 6, 6, 116, 116, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 5;
    roundRect(ctx, 6, 6, 116, 116, 16);
    ctx.stroke();
    return tex(c);
  });
}

export function cursorTexture(): THREE.Texture {
  return cached('cursor', () => {
    const [c, ctx] = canvas(128, 128);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 7;
    const L = 34;
    const corners: [number, number, number, number][] = [
      [8, 8, 1, 1],
      [120, 8, -1, 1],
      [8, 120, 1, -1],
      [120, 120, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + dx * L, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * L);
      ctx.stroke();
    }
    return tex(c);
  });
}

/** Magic circle used for summons / gates */
export function magicCircleTexture(color = '#ffd36a'): THREE.Texture {
  return cached(`circle:${color}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.translate(128, 128);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, Math.PI * 2);
    ctx.stroke();
    // star
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = Math.cos(a) * 98;
      const y = Math.sin(a) * 98;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // runes around
    ctx.font = 'bold 16px serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗ';
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillText(runes[i], 0, -104);
      ctx.restore();
    }
    return tex(c);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const pathCache = new Map<string, Path2D>();
export function iconPath(name: string): Path2D | null {
  let p = pathCache.get(name);
  if (p) return p;
  const d = ICONS[name];
  if (!d) return null;
  p = new Path2D(d);
  pathCache.set(name, p);
  return p;
}

/** Paint a game-icon into a canvas area with gradient fill and glow. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, fill: string | CanvasGradient, glow?: string): void {
  const p = iconPath(name);
  if (!p) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 512, size / 512);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 40;
  }
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.restore();
}

/**
 * Portrait art for standees: a framed painted "card" with the unit's icon.
 * Returns canvas so it can be reused for both sides.
 */
export function portraitCanvas(o: { icon: string; colors: [string, string, string]; name: string; hero: boolean; team: string; seed: number }): HTMLCanvasElement {
  const W = 256;
  const H = 352;
  const [c, ctx] = canvas(W, H);
  const r = rand(o.seed + 1);
  // frame
  const frame = ctx.createLinearGradient(0, 0, W, H);
  if (o.hero) {
    frame.addColorStop(0, '#fff2b0');
    frame.addColorStop(0.5, '#c8932e');
    frame.addColorStop(1, '#6a4410');
  } else {
    frame.addColorStop(0, '#d8dde6');
    frame.addColorStop(0.5, '#7a828f');
    frame.addColorStop(1, '#2c313a');
  }
  ctx.fillStyle = frame;
  roundRect(ctx, 0, 0, W, H, 22);
  ctx.fill();
  // inner art
  const ix = 12;
  const iy = 12;
  const iw = W - 24;
  const ih = H - 24;
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, 14);
  ctx.clip();
  const bg = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.45, H * 0.7);
  bg.addColorStop(0, o.colors[1]);
  bg.addColorStop(1, o.colors[0]);
  ctx.fillStyle = bg;
  ctx.fillRect(ix, iy, iw, ih);
  // light rays fanning down from above the frame
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 + (i - 4) * 0.2 + (r() - 0.5) * 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(W / 2, -30);
    ctx.lineTo(W / 2 + Math.cos(a - 0.045) * 700, -30 + Math.sin(a - 0.045) * 700);
    ctx.lineTo(W / 2 + Math.cos(a + 0.045) * 700, -30 + Math.sin(a + 0.045) * 700);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  speckle(ctx, W, H, 400, ['#000000', '#ffffff'], r, 1.5);
  // icon
  const g = ctx.createLinearGradient(0, 40, 0, 260);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, o.colors[2]);
  drawIcon(ctx, o.icon, W / 2 - 92, 44, 184, g, o.colors[2]);
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.restore();
  // name ribbon
  ctx.fillStyle = 'rgba(10,8,6,0.82)';
  roundRect(ctx, 18, H - 78, W - 36, 50, 10);
  ctx.fill();
  ctx.strokeStyle = o.team;
  ctx.lineWidth = 3;
  roundRect(ctx, 18, H - 78, W - 36, 50, 10);
  ctx.stroke();
  ctx.fillStyle = '#f6efe0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = 30;
  ctx.font = `bold ${fs}px "Ma Shan Zheng", "STKaiti", "KaiTi", serif`;
  while (ctx.measureText(o.name).width > W - 56 && fs > 14) {
    fs -= 2;
    ctx.font = `bold ${fs}px "Ma Shan Zheng", "STKaiti", "KaiTi", serif`;
  }
  ctx.fillText(o.name, W / 2, H - 52);
  if (o.hero) {
    drawIcon(ctx, 'crown', W / 2 - 26, 0, 52, '#ffe48a', '#ffb000');
  }
  return c;
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  return tex(c);
}

/** Simple vertical gradient used for light pillars & beams */
export function beamTexture(): THREE.Texture {
  return cached('beam', () => {
    const [c, ctx] = canvas(16, 128);
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 128);
    return tex(c);
  });
}

export function slashTexture(): THREE.Texture {
  return cached('slash', () => {
    const [c, ctx] = canvas(256, 256);
    ctx.translate(128, 128);
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + i * 0.07})`;
      ctx.lineWidth = 2 + i * 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 90 - i * 2, -Math.PI * 0.85 + i * 0.03, -Math.PI * 0.1);
      ctx.stroke();
    }
    return tex(c);
  });
}

/** Fire/smoke soft puff */
export function puffTexture(): THREE.Texture {
  return cached('puff', () => {
    const [c, ctx] = canvas(64, 64);
    const r = rand(3);
    for (let i = 0; i < 6; i++) {
      const x = 32 + (r() - 0.5) * 18;
      const y = 32 + (r() - 0.5) * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return tex(c);
  });
}
