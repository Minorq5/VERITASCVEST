'use client';

import { recipes, soundLength, soundNames, type SoundBus, type SoundChannel, type SoundName, type SoundParams } from './library';
import { encodeWav, toBase64 } from './wav';

/**
 * Veritas sound engine: every sound is synthesised with the Web Audio API
 * from the recipes in library.ts (D major pentatonic, so overlapping sounds
 * never clash), through a shared space reverb and a limiter. The same
 * recipes render offline to WAV (the demo videos mix them in from
 * `window.__soundLog`).
 *
 * Browsers allow audio only after a gesture: the first click or key press
 * wakes the engine; sounds asked for before that are skipped, never queued.
 */

export type { SoundName } from './library';
export { completeSound, NOTE } from './library';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  ui: number;
  fx: number;
  ambient: number;
}

interface LogEntry {
  name: string;
  t: number;
  params?: SoundParams;
}

declare global {
  interface Window {
    /** Set by the demo recorder before the page loads: which sound played when (ms). */
    __soundLog?: LogEntry[];
    /** Present only while recording: renders a logged sound to a base64 WAV. */
    __vtRenderSound?: (name: string, params?: SoundParams) => Promise<string>;
    /** Present only while recording: every sound name. */
    __vtSoundNames?: string[];
    /** Set by the demo recorder: hears every sound the moment it plays (survives page loads). */
    __vtLogSound?: (entry: { name: string; params?: SoundParams }) => void;
  }
}

interface Graph {
  master: GainNode;
  channels: Record<SoundChannel | 'ambient', GainNode>;
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let s = 7741 + ch * 31;
    for (let i = 0; i < length; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = ((s / 4294967296) * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

/** Channels → master → limiter → destination, with a shared "space" reverb on a send. */
function buildGraph(ctx: BaseAudioContext, settings: SoundSettings): Graph {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = settings.enabled ? settings.volume : 0;
  master.connect(limiter);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.4, 3.2);
  const send = ctx.createGain();
  send.gain.value = 0.22;
  send.connect(reverb);
  reverb.connect(master);
  const channel = (level: number, wet = 1) => {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(master);
    if (wet !== 1) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(send);
    } else g.connect(send);
    return g;
  };
  return { master, channels: { ui: channel(settings.ui), fx: channel(settings.fx), ambient: channel(settings.ambient, 3) } };
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private settings: SoundSettings = { enabled: true, volume: 0.8, ui: 0.7, fx: 0.9, ambient: 0.5 };
  private listening = false;
  private ambientStop: (() => void) | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    // Wake on the first gesture so the sound of that very click is heard.
    const wake = () => {
      this.unlock();
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
    };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    this.listening = true;
    // While recording a demo, the page can render any logged sound to WAV.
    if (window.__soundLog) {
      window.__vtRenderSound = async (name, params) => toBase64(encodeWav(await this.render(name as SoundName, params)));
      window.__vtSoundNames = [...soundNames];
    }
  }

  /** Whether sounds may play at all (the person's switch). */
  get enabled() {
    return this.settings.enabled;
  }

  /** Creates or resumes the audio context; call from a gesture. */
  unlock(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.graph = buildGraph(this.ctx, this.settings);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  configure(settings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx || !this.graph) return;
    const now = this.ctx.currentTime;
    this.graph.master.gain.setTargetAtTime(this.settings.enabled ? this.settings.volume : 0, now, 0.02);
    this.graph.channels.ui.gain.setTargetAtTime(this.settings.ui, now, 0.02);
    this.graph.channels.fx.gain.setTargetAtTime(this.settings.fx, now, 0.02);
    this.graph.channels.ambient.gain.setTargetAtTime(this.settings.ambient, now, 0.02);
  }

  /** Plays a sound now. Skipped when sound is off or before the first gesture. */
  play(name: SoundName, params: SoundParams = {}) {
    if (!this.settings.enabled || typeof window === 'undefined') return;
    const activated = navigator.userActivation?.hasBeenActive ?? true;
    if (!this.ctx && !activated) return;
    const ctx = this.unlock();
    if (!ctx || !this.graph || (ctx.state !== 'running' && !activated)) return;
    const entry = { name, ...(Object.keys(params).length ? { params } : {}) };
    window.__soundLog?.push({ ...entry, t: Math.round(performance.now()) });
    window.__vtLogSound?.(entry);
    const bus: SoundBus = { ui: this.graph.channels.ui, fx: this.graph.channels.fx };
    recipes[name](ctx, bus, ctx.currentTime + 0.005, params);
  }

  /**
   * Plays a rendered buffer (the intro score) on a channel from `offset`
   * seconds, straight to the master (it carries its own reverb). Returns a
   * function that fades it out.
   */
  playBuffer(buffer: AudioBuffer, channel: SoundChannel = 'fx', offset = 0): () => void {
    if (!this.settings.enabled) return () => undefined;
    const ctx = this.unlock();
    if (!ctx || !this.graph || offset >= buffer.duration) return () => undefined;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = this.settings[channel];
    src.connect(gain).connect(this.graph.master);
    src.start(ctx.currentTime + 0.01, Math.max(0, offset));
    const started = `buffer:${Math.round(offset * 1000)}`;
    window.__soundLog?.push({ name: started, t: Math.round(performance.now()) });
    window.__vtLogSound?.({ name: started });
    return () => {
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(0, now, 0.08);
      src.stop(now + 0.5);
      window.__soundLog?.push({ name: 'buffer:stop', t: Math.round(performance.now()) });
      window.__vtLogSound?.({ name: 'buffer:stop' });
    };
  }

  /**
   * The space ambient: a low drone and rare pentatonic bells in a long
   * reverb, forever (until stopped). Off by default; the landing and, if the
   * person wants, the app.
   */
  startAmbient() {
    if (this.ambientStop || !this.settings.enabled) return;
    const ctx = this.unlock();
    if (!ctx || !this.graph) return;
    const out = this.graph.channels.ambient;
    const t = ctx.currentTime;
    const drone = ctx.createGain();
    drone.gain.setValueAtTime(0.0001, t);
    drone.gain.exponentialRampToValueAtTime(0.05, t + 4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    drone.connect(filter).connect(out);
    const oscs = [73.42, 110, 146.83].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 1 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 4;
      o.connect(drone);
      o.start(t);
      return o;
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(t);
    const bells = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1760];
    let timer = 0;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const ring = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const f = bells[Math.floor(rand() * bells.length)]!;
      const g = this.ctx.createGain();
      const p = this.ctx.createStereoPanner();
      p.pan.value = rand() * 1.6 - 0.8;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.02 + rand() * 0.02, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3);
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g).connect(p).connect(out);
      o.start(now);
      o.stop(now + 3.1);
      timer = window.setTimeout(ring, 4000 + rand() * 5000);
    };
    timer = window.setTimeout(ring, 2500);
    this.ambientStop = () => {
      window.clearTimeout(timer);
      const now = ctx.currentTime;
      drone.gain.setTargetAtTime(0.0001, now, 0.8);
      for (const o of [...oscs, lfo]) o.stop(now + 4);
      this.ambientStop = null;
    };
  }

  stopAmbient() {
    this.ambientStop?.();
  }

  /** Renders one sound offline, through the same bus, to a buffer. */
  async render(name: SoundName, params: SoundParams = {}, sampleRate = 48000): Promise<AudioBuffer> {
    const seconds = (soundLength[name] ?? 0.6) + 2.4;
    const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
    const graph = buildGraph(ctx, { ...this.settings, enabled: true });
    recipes[name](ctx, { ui: graph.channels.ui, fx: graph.channels.fx }, 0.005, params);
    return ctx.startRendering();
  }

  /** For tests: whether the first-gesture listener is set. */
  get waiting() {
    return this.listening && !this.ctx;
  }
}

export const sound = new SoundEngine();
