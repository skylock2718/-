/**
 * Procedural audio: every sound effect and the background music are
 * synthesised with WebAudio at runtime — no audio files.
 */

export type Sfx =
  | 'click'
  | 'hover'
  | 'card'
  | 'cardPlay'
  | 'dice'
  | 'diceLand'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'slash'
  | 'arrow'
  | 'fire'
  | 'explosion'
  | 'lightning'
  | 'frost'
  | 'heal'
  | 'buff'
  | 'summon'
  | 'death'
  | 'coin'
  | 'fate'
  | 'turn'
  | 'victory'
  | 'defeat'
  | 'quake'
  | 'step'
  | 'error'
  | 'page'
  | 'capture'
  | 'shield'
  | 'magic'
  | 'curse'
  | 'nat20'
  | 'nat1'
  | 'gold';

export type Track = 'title' | 'map' | 'battle' | 'boss' | 'camp' | null;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private vol = { master: 0.8, music: 0.45, sfx: 0.8 };
  private track: Track = null;
  private wantTrack: Track = null;
  private sched: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private musicGain!: GainNode;
  private last: Record<string, number> = {};

  /** must be called from a user gesture */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(comp);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(comp);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.musicBus);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4, 2.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(comp);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.wantTrack) this.music(this.wantTrack);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.musicBus.gain.value = this.vol.music;
    this.sfxBus.gain.value = this.vol.sfx;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ------------------------------------------------------------------ building blocks

  private env(g: GainNode, t: number, a: number, peak: number, d: number, sustain = 0.0001): void {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  }

  private tone(o: { type?: OscillatorType; freq: number; to?: number; t?: number; a?: number; d?: number; vol?: number; bus?: AudioNode; reverb?: number; detune?: number; glide?: number }): void {
    const ctx = this.ctx!;
    const t = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide ?? (o.a ?? 0.005) + (o.d ?? 0.2)));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    this.env(g, t, o.a ?? 0.005, o.vol ?? 0.3, o.d ?? 0.2);
    osc.connect(g);
    g.connect(o.bus ?? this.sfxBus);
    if (o.reverb) {
      const s = ctx.createGain();
      s.gain.value = o.reverb;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    osc.start(t);
    osc.stop(t + (o.a ?? 0.005) + (o.d ?? 0.2) + 0.05);
  }

  private noise(o: { t?: number; a?: number; d?: number; vol?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; bus?: AudioNode; reverb?: number }): void {
    const ctx = this.ctx!;
    const t = o.t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.a ?? 0.005) + (o.d ?? 0.2));
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    this.env(g, t, o.a ?? 0.005, o.vol ?? 0.3, o.d ?? 0.2);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus ?? this.sfxBus);
    if (o.reverb) {
      const s = ctx.createGain();
      s.gain.value = o.reverb;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    src.start(t, Math.random() * 0.5);
    src.stop(t + (o.a ?? 0.005) + (o.d ?? 0.2) + 0.05);
  }

  // ------------------------------------------------------------------ sfx

  play(name: Sfx, opts: { vol?: number; pitch?: number; count?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.vol.sfx <= 0) return;
    // throttle identical sounds
    const now = ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    const v = opts.vol ?? 1;
    const p = opts.pitch ?? 1;
    const t = now + 0.01;
    switch (name) {
      case 'click':
        this.tone({ freq: 1200 * p, to: 700, d: 0.06, vol: 0.12 * v, type: 'triangle' });
        break;
      case 'hover':
        this.tone({ freq: 1800 * p, d: 0.03, vol: 0.03 * v, type: 'sine' });
        break;
      case 'page':
        this.noise({ freq: 3000, to: 1200, d: 0.18, vol: 0.12 * v, q: 0.6 });
        break;
      case 'card':
        this.noise({ freq: 2500 * p, to: 5000, d: 0.12, vol: 0.14 * v, q: 0.8 });
        break;
      case 'cardPlay':
        this.noise({ freq: 1800, to: 600, d: 0.25, vol: 0.2 * v, q: 0.7 });
        this.tone({ freq: 160, to: 70, d: 0.25, vol: 0.25 * v });
        this.tone({ freq: 880 * p, d: 0.4, vol: 0.06 * v, type: 'triangle', reverb: 0.6, t: t + 0.05 });
        break;
      case 'dice': {
        const n = opts.count ?? 6;
        for (let i = 0; i < n; i++) {
          const tt = t + i * (0.06 + Math.random() * 0.07);
          this.noise({ t: tt, freq: 3000 + Math.random() * 2500, d: 0.03, vol: 0.18 * v * (1 - i / (n + 2)), q: 3 });
          this.tone({ t: tt, freq: 900 + Math.random() * 900, d: 0.03, vol: 0.05 * v, type: 'triangle' });
        }
        break;
      }
      case 'diceLand':
        this.noise({ freq: 2200, d: 0.05, vol: 0.25 * v, q: 2 });
        this.tone({ freq: 300, to: 180, d: 0.08, vol: 0.15 * v });
        break;
      case 'hit':
        this.tone({ freq: 140 * p, to: 45, d: 0.22, vol: 0.45 * v });
        this.noise({ freq: 1200, to: 300, d: 0.12, vol: 0.3 * v, q: 0.8 });
        break;
      case 'crit':
        this.tone({ freq: 110, to: 35, d: 0.45, vol: 0.6 * v });
        this.noise({ freq: 2500, to: 200, d: 0.35, vol: 0.4 * v, q: 0.5, reverb: 0.4 });
        this.tone({ freq: 1320, d: 0.6, vol: 0.12 * v, type: 'triangle', reverb: 0.8, t: t + 0.05 });
        this.tone({ freq: 1980, d: 0.7, vol: 0.08 * v, type: 'triangle', reverb: 0.8, t: t + 0.1 });
        break;
      case 'miss':
        this.noise({ freq: 600, to: 2400, d: 0.22, vol: 0.18 * v, q: 1.2 });
        break;
      case 'slash':
        this.noise({ freq: 900, to: 4000, d: 0.16, vol: 0.22 * v, q: 1.5 });
        this.tone({ freq: 2400 * p, d: 0.15, vol: 0.05 * v, type: 'sine', t: t + 0.08 });
        break;
      case 'arrow':
        this.tone({ freq: 220 * p, to: 180, d: 0.12, vol: 0.2 * v, type: 'sawtooth' });
        this.noise({ freq: 3000, to: 1500, d: 0.25, vol: 0.1 * v, q: 2, t: t + 0.03 });
        break;
      case 'fire':
        this.noise({ type: 'lowpass', freq: 600, to: 2400, d: 0.5, vol: 0.35 * v, q: 0.7, reverb: 0.3 });
        for (let i = 0; i < 5; i++) this.noise({ t: t + Math.random() * 0.4, freq: 4000, d: 0.02, vol: 0.12 * v, q: 4 });
        break;
      case 'explosion':
        this.noise({ type: 'lowpass', freq: 2200, to: 120, a: 0.01, d: 1.1, vol: 0.7 * v, q: 0.5, reverb: 0.6 });
        this.tone({ freq: 90, to: 25, d: 0.9, vol: 0.6 * v });
        break;
      case 'lightning':
        this.noise({ type: 'highpass', freq: 1800, d: 0.35, vol: 0.4 * v, q: 0.6, reverb: 0.4 });
        this.tone({ freq: 70, d: 0.3, vol: 0.18 * v, type: 'square' });
        for (let i = 0; i < 6; i++) this.noise({ t: t + i * 0.04, freq: 5000, d: 0.02, vol: 0.2 * v, q: 3 });
        break;
      case 'frost':
        for (let i = 0; i < 5; i++) this.tone({ t: t + i * 0.04, freq: 1800 + i * 330, d: 0.5, vol: 0.05 * v, type: 'sine', reverb: 0.9 });
        this.noise({ type: 'highpass', freq: 3000, d: 0.4, vol: 0.12 * v, reverb: 0.5 });
        break;
      case 'heal':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ t: t + i * 0.07, freq: f, d: 0.6, vol: 0.09 * v, type: 'sine', reverb: 1 }));
        break;
      case 'buff':
        this.tone({ freq: 660, d: 0.35, vol: 0.1 * v, type: 'triangle', reverb: 0.8 });
        this.tone({ t: t + 0.08, freq: 990, d: 0.45, vol: 0.08 * v, type: 'triangle', reverb: 0.8 });
        break;
      case 'shield':
        this.tone({ freq: 440, to: 880, d: 0.3, vol: 0.1 * v, type: 'triangle', reverb: 0.6 });
        this.noise({ type: 'highpass', freq: 4000, d: 0.3, vol: 0.06 * v });
        break;
      case 'magic':
        this.tone({ freq: 400, to: 1200, d: 0.35, vol: 0.12 * v, type: 'sine', reverb: 0.8 });
        this.tone({ freq: 600, to: 1800, d: 0.35, vol: 0.06 * v, type: 'triangle', reverb: 0.8, t: t + 0.04 });
        break;
      case 'curse':
        this.tone({ freq: 300, to: 120, d: 0.6, vol: 0.14 * v, type: 'sawtooth', reverb: 0.6 });
        this.tone({ freq: 317, to: 127, d: 0.6, vol: 0.1 * v, type: 'sawtooth', reverb: 0.6 });
        break;
      case 'summon':
        this.tone({ freq: 180, to: 720, d: 0.6, vol: 0.14 * v, type: 'sine', reverb: 0.9, glide: 0.5 });
        this.noise({ freq: 800, to: 5000, d: 0.6, vol: 0.08 * v, q: 0.8, reverb: 0.8 });
        break;
      case 'death':
        this.tone({ freq: 220, to: 60, d: 0.7, vol: 0.25 * v, type: 'triangle', reverb: 0.5 });
        this.noise({ type: 'lowpass', freq: 800, to: 150, d: 0.3, vol: 0.25 * v, t: t + 0.35 });
        break;
      case 'coin':
      case 'gold':
        this.tone({ freq: 1568, d: 0.12, vol: 0.1 * v, type: 'square' });
        this.tone({ t: t + 0.08, freq: 2093, d: 0.3, vol: 0.08 * v, type: 'square', reverb: 0.4 });
        break;
      case 'fate':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ t: t + i * 0.05, freq: f, d: 0.5, vol: 0.06 * v, type: 'triangle', reverb: 1 }));
        break;
      case 'nat20':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ t: t + i * 0.06, freq: f, d: 0.9, vol: 0.1 * v, type: 'triangle', reverb: 1 }));
        this.tone({ t: t + 0.3, freq: 261, d: 1.2, vol: 0.12 * v, type: 'sine', reverb: 1 });
        break;
      case 'nat1':
        this.tone({ freq: 196, to: 98, d: 0.8, vol: 0.18 * v, type: 'sawtooth', reverb: 0.5 });
        this.tone({ t: t + 0.25, freq: 185, to: 92, d: 0.8, vol: 0.14 * v, type: 'sawtooth', reverb: 0.5 });
        break;
      case 'turn':
        this.tone({ freq: 196, d: 1.6, vol: 0.18 * v, type: 'sine', reverb: 1 });
        this.tone({ freq: 392, d: 1.2, vol: 0.06 * v, type: 'sine', reverb: 1 });
        this.tone({ freq: 587, d: 0.9, vol: 0.04 * v, type: 'sine', reverb: 1 });
        break;
      case 'victory':
        [392, 523, 659, 784].forEach((f, i) => this.tone({ t: t + i * 0.14, freq: f, d: 0.5, vol: 0.14 * v, type: 'triangle', reverb: 0.8 }));
        [523, 659, 784, 1047].forEach((f) => this.tone({ t: t + 0.6, freq: f, d: 1.8, vol: 0.08 * v, type: 'triangle', reverb: 1 }));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone({ t: t + i * 0.25, freq: f, d: 0.8, vol: 0.13 * v, type: 'triangle', reverb: 0.9 }));
        break;
      case 'quake':
        this.noise({ type: 'lowpass', freq: 300, d: 0.8, vol: 0.45 * v, q: 0.4 });
        this.tone({ freq: 55, d: 0.7, vol: 0.3 * v });
        break;
      case 'step':
        this.noise({ type: 'lowpass', freq: 500 * p, d: 0.05, vol: 0.08 * v, q: 0.5 });
        break;
      case 'error':
        this.tone({ freq: 140, d: 0.18, vol: 0.12 * v, type: 'square' });
        break;
      case 'capture':
        this.tone({ freq: 523, d: 0.3, vol: 0.1 * v, type: 'triangle', reverb: 0.8 });
        this.tone({ t: t + 0.1, freq: 784, d: 0.5, vol: 0.1 * v, type: 'triangle', reverb: 0.8 });
        break;
    }
  }

  // ------------------------------------------------------------------ music

  music(track: Track): void {
    this.wantTrack = track;
    if (!this.ctx) return;
    if (track === this.track) return;
    const ctx = this.ctx;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(0, ctx.currentTime, 0.4);
    const start = () => {
      this.track = track;
      this.beat = 0;
      this.nextBeat = ctx.currentTime + 0.1;
      if (track) g.setTargetAtTime(1, ctx.currentTime, 1.2);
    };
    if (this.sched == null) {
      this.sched = window.setInterval(() => this.schedule(), 90);
    }
    setTimeout(start, this.track ? 900 : 0);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const spec = TRACKS[this.track];
    const spb = 60 / spec.bpm / 2; // eighth notes
    while (this.nextBeat < ctx.currentTime + 0.25) {
      this.playStep(spec, this.beat, this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private playStep(spec: TrackSpec, step: number, t: number, spb: number): void {
    const bar = Math.floor(step / 8);
    const inBar = step % 8;
    const chord = spec.chords[bar % spec.chords.length];
    const root = spec.root;
    const freq = (semi: number, oct = 0) => root * Math.pow(2, (semi + oct * 12) / 12);
    const bus = this.musicGain;
    // pad at bar start
    if (inBar === 0) {
      for (const n of chord) {
        this.tone({ t, freq: freq(n, 0), d: spb * 8 * 1.1, a: spb * 2, vol: spec.pad, type: 'sawtooth', bus, reverb: 0.5, detune: (Math.random() - 0.5) * 12 });
      }
      this.tone({ t, freq: freq(chord[0], -1), d: spb * 7, a: 0.05, vol: spec.bass, type: 'sine', bus });
    }
    // arpeggio / pluck
    if (spec.arp && spec.arpPattern[inBar] >= 0 && Math.random() < spec.arpDensity) {
      const n = chord[spec.arpPattern[inBar] % chord.length] + (spec.arpPattern[inBar] >= chord.length ? 12 : 0);
      this.tone({ t, freq: freq(n, 1), d: spb * 2.5, a: 0.004, vol: spec.arp, type: 'triangle', bus, reverb: 0.6 });
    }
    // melody fragments
    if (spec.lead && inBar % 2 === 0 && Math.random() < spec.leadDensity) {
      const scale = spec.scale;
      const n = scale[Math.floor(Math.random() * scale.length)];
      this.tone({ t, freq: freq(n, 1), d: spb * 3, a: 0.02, vol: spec.lead, type: 'sine', bus, reverb: 0.8 });
    }
    // drums
    if (spec.drums) {
      if (spec.kick[inBar]) this.tone({ t, freq: 110, to: 40, d: 0.25, vol: spec.drums, bus });
      if (spec.snare[inBar]) this.noise({ t, freq: 1800, d: 0.12, vol: spec.drums * 0.5, q: 0.7, bus });
      if (spec.hat && inBar % 2 === 1) this.noise({ t, type: 'highpass', freq: 7000, d: 0.03, vol: spec.hat, bus });
    }
  }
}

interface TrackSpec {
  bpm: number;
  root: number;
  chords: number[][];
  scale: number[];
  pad: number;
  bass: number;
  arp: number;
  arpDensity: number;
  arpPattern: number[];
  lead: number;
  leadDensity: number;
  drums: number;
  kick: number[];
  snare: number[];
  hat: number;
}

// semitone offsets relative to root
const TRACKS: Record<Exclude<Track, null>, TrackSpec> = {
  title: {
    bpm: 66,
    root: 146.83, // D3
    chords: [
      [0, 3, 7, 10],
      [-2, 2, 5, 9],
      [-4, 0, 3, 7],
      [-5, -1, 2, 7],
    ],
    scale: [0, 2, 3, 5, 7, 9, 10],
    pad: 0.018,
    bass: 0.05,
    arp: 0.035,
    arpDensity: 0.75,
    arpPattern: [0, -1, 2, 1, 3, -1, 2, 1],
    lead: 0.025,
    leadDensity: 0.25,
    drums: 0,
    kick: [],
    snare: [],
    hat: 0,
  },
  map: {
    bpm: 84,
    root: 220,
    chords: [
      [0, 3, 7],
      [-4, 0, 3],
      [-7, -3, 0],
      [-5, -1, 2],
    ],
    scale: [0, 2, 3, 5, 7, 8, 10],
    pad: 0.012,
    bass: 0.04,
    arp: 0.045,
    arpDensity: 0.9,
    arpPattern: [0, 1, 2, 1, 3, 2, 1, 2],
    lead: 0.02,
    leadDensity: 0.15,
    drums: 0,
    kick: [],
    snare: [],
    hat: 0,
  },
  camp: {
    bpm: 72,
    root: 196,
    chords: [
      [0, 4, 7],
      [5, 9, 12],
      [-3, 0, 4],
      [-5, -1, 2],
    ],
    scale: [0, 2, 4, 7, 9],
    pad: 0.014,
    bass: 0.04,
    arp: 0.04,
    arpDensity: 0.8,
    arpPattern: [0, -1, 1, -1, 2, -1, 1, -1],
    lead: 0.02,
    leadDensity: 0.2,
    drums: 0,
    kick: [],
    snare: [],
    hat: 0,
  },
  battle: {
    bpm: 104,
    root: 146.83,
    chords: [
      [0, 3, 7],
      [0, 3, 7],
      [-2, 1, 5],
      [-4, 0, 3],
    ],
    scale: [0, 2, 3, 5, 7, 8, 10],
    pad: 0.012,
    bass: 0.07,
    arp: 0.03,
    arpDensity: 0.85,
    arpPattern: [0, 0, 2, 0, 1, 0, 2, 3],
    lead: 0.015,
    leadDensity: 0.2,
    drums: 0.12,
    kick: [1, 0, 0, 1, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hat: 0.025,
  },
  boss: {
    bpm: 116,
    root: 130.81,
    chords: [
      [0, 3, 7],
      [1, 5, 8],
      [0, 3, 7],
      [-1, 3, 6],
    ],
    scale: [0, 1, 3, 5, 7, 8, 11],
    pad: 0.016,
    bass: 0.08,
    arp: 0.035,
    arpDensity: 0.95,
    arpPattern: [0, 1, 2, 1, 0, 1, 2, 3],
    lead: 0.02,
    leadDensity: 0.3,
    drums: 0.15,
    kick: [1, 0, 1, 0, 1, 0, 1, 1],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hat: 0.03,
  },
};

export const audio = new AudioEngine();
