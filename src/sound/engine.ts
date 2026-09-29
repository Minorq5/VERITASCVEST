'use client';

/**
 * Veritas sound engine: every sound is synthesised with the Web Audio API.
 * All pitches come from D major pentatonic (D E F# A B), so overlapping
 * sounds never clash. Stage 8 adds the full library; the engine, channels and
 * the first interface sounds live here from the start.
 */

export type SoundChannel = 'ui' | 'fx' | 'ambient';
export type SoundName = 'click' | 'toggleOn' | 'toggleOff' | 'chime' | 'error' | 'success';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  ui: number;
  fx: number;
  ambient: number;
}

/** D major pentatonic, octaves 4–6 (Hz). */
export const NOTE = {
  D4: 293.66,
  E4: 329.63,
  Fs4: 369.99,
  A4: 440,
  B4: 493.88,
  D5: 587.33,
  E5: 659.25,
  Fs5: 739.99,
  A5: 880,
  B5: 987.77,
  D6: 1174.66,
  A6: 1760,
} as const;

interface Voice {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  detune?: number;
}

declare global {
  interface Window {
    /** Filled only in demo-recording mode: which sound played when (ms). */
    __soundLog?: { name: string; t: number }[];
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Partial<Record<SoundChannel, GainNode>> = {};
  private reverbSend: GainNode | null = null;
  private settings: SoundSettings = { enabled: true, volume: 0.8, ui: 0.7, fx: 0.9, ambient: 0.5 };

  /** Browsers allow audio only after a gesture: call from a click/keydown handler. */
  unlock(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  configure(settings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.applyGains();
  }

  play(name: SoundName) {
    if (!this.settings.enabled) return;
    const ctx = this.unlock();
    if (!ctx || !this.master) return;
    if (typeof window !== 'undefined' && window.__soundLog) {
      window.__soundLog.push({ name, t: Math.round(performance.now()) });
    }
    const t = ctx.currentTime + 0.005;
    const ui = this.channels.ui!;
    const fx = this.channels.fx!;
    switch (name) {
      case 'click':
        this.voice(ctx, ui, { freq: NOTE.A6, start: t, duration: 0.05, type: 'sine', gain: 0.07, attack: 0.002 });
        this.noise(ctx, ui, t, 0.02, 0.03, 5200);
        break;
      case 'toggleOn':
        this.voice(ctx, ui, { freq: NOTE.A5, start: t, duration: 0.09, type: 'triangle', gain: 0.1 });
        this.voice(ctx, ui, { freq: NOTE.D6, start: t + 0.06, duration: 0.12, type: 'triangle', gain: 0.1 });
        break;
      case 'toggleOff':
        this.voice(ctx, ui, { freq: NOTE.D6, start: t, duration: 0.09, type: 'triangle', gain: 0.08 });
        this.voice(ctx, ui, { freq: NOTE.A5, start: t + 0.06, duration: 0.12, type: 'triangle', gain: 0.08 });
        break;
      case 'chime':
        this.bell(ctx, fx, NOTE.A5, t, 0.9, 0.12);
        this.bell(ctx, fx, NOTE.D6, t + 0.12, 1.1, 0.1);
        break;
      case 'success':
        this.bell(ctx, fx, NOTE.D5, t, 0.8, 0.1);
        this.bell(ctx, fx, NOTE.Fs5, t + 0.08, 0.8, 0.09);
        this.bell(ctx, fx, NOTE.A5, t + 0.16, 1, 0.09);
        break;
      case 'error':
        this.voice(ctx, ui, { freq: NOTE.D4, start: t, duration: 0.12, type: 'sine', gain: 0.14 });
        this.voice(ctx, ui, { freq: NOTE.D4 * 0.94, start: t + 0.11, duration: 0.16, type: 'sine', gain: 0.12 });
        break;
    }
  }

  private build(ctx: AudioContext) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(limiter);

    // Shared "space" reverb: a procedural impulse, soft and long.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(ctx, 2.4, 3.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.22;
    this.reverbSend.connect(convolver);
    convolver.connect(this.master);

    for (const channel of ['ui', 'fx', 'ambient'] as const) {
      const g = ctx.createGain();
      g.connect(this.master);
      g.connect(this.reverbSend);
      this.channels[channel] = g;
    }
    this.applyGains();
  }

  private applyGains() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.enabled ? this.settings.volume : 0, now, 0.02);
    this.channels.ui?.gain.setTargetAtTime(this.settings.ui, now, 0.02);
    this.channels.fx?.gain.setTargetAtTime(this.settings.fx, now, 0.02);
    this.channels.ambient?.gain.setTargetAtTime(this.settings.ambient, now, 0.02);
  }

  private voice(ctx: AudioContext, dest: AudioNode, v: Voice) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = v.type ?? 'sine';
    osc.frequency.value = v.freq;
    if (v.detune) osc.detune.value = v.detune;
    const attack = v.attack ?? 0.006;
    const peak = v.gain ?? 0.1;
    env.gain.setValueAtTime(0.0001, v.start);
    env.gain.exponentialRampToValueAtTime(peak, v.start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, v.start + v.duration);
    osc.connect(env).connect(dest);
    osc.start(v.start);
    osc.stop(v.start + v.duration + 0.05);
  }

  /** Soft bell: a few inharmonic partials with independent decays. */
  private bell(ctx: AudioContext, dest: AudioNode, freq: number, start: number, duration: number, gain: number) {
    const partials: [number, number, number][] = [
      [1, 1, 1],
      [2.01, 0.35, 0.6],
      [3.02, 0.12, 0.4],
    ];
    for (const [ratio, level, decay] of partials) {
      this.voice(ctx, dest, { freq: freq * ratio, start, duration: duration * decay, type: 'sine', gain: gain * level, attack: 0.004 });
    }
  }

  private noise(ctx: AudioContext, dest: AudioNode, start: number, duration: number, gain: number, cutoff: number) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(dest);
    src.start(start);
  }

  private impulse(ctx: AudioContext, seconds: number, decay: number) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
      }
    }
    return buffer;
  }
}

export const sound = new SoundEngine();
