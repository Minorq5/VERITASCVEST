/**
 * Every Veritas sound as a recipe: a function that schedules Web Audio nodes
 * into any context (the live one, or an OfflineAudioContext that renders the
 * same sound to a WAV for videos). All pitches come from D major pentatonic
 * (D E F♯ A B), so overlapping sounds never clash. Soft attacks, short tails;
 * the shared reverb and limiter live in the bus (see engine.ts).
 *
 * V2 «Горизонт событий»: completing a task is a short deep sound — something
 * absorbed — that grows richer with the priority.
 */

export type SoundChannel = 'ui' | 'fx';

export interface SoundBus {
  ui: AudioNode;
  fx: AudioNode;
}

export interface SoundParams {
  /** 0..1 for progressStep: the step's pitch climbs the scale with the percentage. */
  value?: number;
}

/** D major pentatonic (Hz). */
export const NOTE = {
  D2: 73.42,
  A2: 110,
  D3: 146.83,
  A3: 220,
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
  E6: 1318.51,
  Fs6: 1479.98,
  A6: 1760,
  B6: 1975.53,
  E7: 2637.02,
} as const;

/** The scale the progress ticks climb (0 % → D4, 100 % → D6). */
const LADDER = [NOTE.D4, NOTE.E4, NOTE.Fs4, NOTE.A4, NOTE.B4, NOTE.D5, NOTE.E5, NOTE.Fs5, NOTE.A5, NOTE.B5, NOTE.D6];

interface ToneOptions {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** Glide to this frequency over `glide` seconds (or the whole note). */
  glideTo?: number;
  glide?: number;
  pan?: number;
  detune?: number;
}

function out(ctx: BaseAudioContext, dest: AudioNode, pan?: number): AudioNode {
  if (pan === undefined || pan === 0) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(dest);
  return p;
}

function tone(ctx: BaseAudioContext, dest: AudioNode, o: ToneOptions) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.start + (o.glide ?? o.duration));
  if (o.detune) osc.detune.value = o.detune;
  const attack = o.attack ?? 0.006;
  const peak = o.gain ?? 0.08;
  env.gain.setValueAtTime(0.0001, o.start);
  env.gain.exponentialRampToValueAtTime(peak, o.start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration);
  osc.connect(env).connect(out(ctx, dest, o.pan));
  osc.start(o.start);
  osc.stop(o.start + o.duration + 0.05);
}

/** A soft bell: a few inharmonic partials with their own decays. */
function bell(ctx: BaseAudioContext, dest: AudioNode, freq: number, start: number, duration: number, gain: number, pan?: number) {
  const target = out(ctx, dest, pan);
  for (const [ratio, level, decay] of [
    [1, 1, 1],
    [2.01, 0.32, 0.6],
    [3.02, 0.11, 0.4],
    [4.17, 0.05, 0.25],
  ] as const) {
    tone(ctx, target, { freq: freq * ratio, start, duration: duration * decay, gain: gain * level, attack: 0.004 });
  }
}

/** Something absorbed: a low sine that drops into place. */
function thump(ctx: BaseAudioContext, dest: AudioNode, from: number, to: number, start: number, duration: number, gain: number) {
  tone(ctx, dest, { freq: from, glideTo: to, glide: Math.min(0.09, duration / 3), start, duration, gain, attack: 0.004 });
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of seeded white noise per context (the same sound every time). */
function whiteNoise(ctx: BaseAudioContext) {
  let buffer = noiseCache.get(ctx);
  if (buffer) return buffer;
  buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let s = 20260929;
  for (let i = 0; i < data.length; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 4294967296) * 2 - 1;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

interface NoiseOptions {
  start: number;
  duration: number;
  gain: number;
  type?: BiquadFilterType;
  freq: number;
  sweepTo?: number;
  q?: number;
  pan?: number;
  panTo?: number;
  attack?: number;
}

function noise(ctx: BaseAudioContext, dest: AudioNode, o: NoiseOptions) {
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, o.start);
  if (o.sweepTo) filter.frequency.exponentialRampToValueAtTime(o.sweepTo, o.start + o.duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, o.start);
  env.gain.exponentialRampToValueAtTime(o.gain, o.start + (o.attack ?? o.duration * 0.3));
  env.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration);
  let target: AudioNode = dest;
  if (o.pan !== undefined) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(o.pan, o.start);
    if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(o.panTo, o.start + o.duration);
    p.connect(dest);
    target = p;
  }
  src.connect(filter).connect(env).connect(target);
  src.start(o.start, (o.start * 0.37) % 1.5);
  src.stop(o.start + o.duration + 0.05);
}

type Recipe = (ctx: BaseAudioContext, bus: SoundBus, t: number, p: SoundParams) => void;

function complete(level: 0 | 1 | 2 | 3): Recipe {
  return (ctx, { fx }, t) => {
    // The task falls into the horizon: a deep, short absorb…
    thump(ctx, fx, NOTE.A2, NOTE.D2, t, 0.42, 0.3);
    // …and its light: one warm note, then more with the priority.
    tone(ctx, fx, { freq: NOTE.D4, start: t + 0.01, duration: 0.42, gain: 0.055, attack: 0.012 });
    if (level >= 1) tone(ctx, fx, { freq: NOTE.Fs4, start: t + 0.06, duration: 0.42, gain: 0.045, attack: 0.012, pan: -0.2 });
    if (level >= 2) tone(ctx, fx, { freq: NOTE.A4, start: t + 0.11, duration: 0.46, gain: 0.045, attack: 0.012, pan: 0.2 });
    if (level >= 3) {
      tone(ctx, fx, { freq: NOTE.D5, start: t + 0.16, duration: 0.5, gain: 0.04, attack: 0.012 });
      bell(ctx, fx, NOTE.A5, t + 0.22, 0.7, 0.035, 0.3);
      noise(ctx, fx, { start: t, duration: 0.45, gain: 0.03, type: 'lowpass', freq: 500, sweepTo: 180, attack: 0.15 });
    }
  };
}

export const recipes = {
  click: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.A6, start: t, duration: 0.045, gain: 0.13, attack: 0.002 });
    noise(ctx, ui, { start: t, duration: 0.025, gain: 0.05, type: 'highpass', freq: 5200, attack: 0.002 });
  },
  toggleOn: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.A5, start: t, duration: 0.09, type: 'triangle', gain: 0.1 });
    tone(ctx, ui, { freq: NOTE.D6, start: t + 0.06, duration: 0.12, type: 'triangle', gain: 0.1 });
  },
  toggleOff: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.D6, start: t, duration: 0.09, type: 'triangle', gain: 0.09 });
    tone(ctx, ui, { freq: NOTE.A5, start: t + 0.06, duration: 0.12, type: 'triangle', gain: 0.09 });
  },
  panelOpen: (ctx, { ui }, t) => {
    noise(ctx, ui, { start: t, duration: 0.24, gain: 0.07, freq: 700, sweepTo: 2300, q: 1.3 });
    tone(ctx, ui, { freq: NOTE.A5, start: t + 0.08, duration: 0.2, gain: 0.06, attack: 0.02 });
  },
  panelClose: (ctx, { ui }, t) => {
    noise(ctx, ui, { start: t, duration: 0.22, gain: 0.06, freq: 2100, sweepTo: 650, q: 1.3 });
    tone(ctx, ui, { freq: NOTE.D5, start: t + 0.06, duration: 0.18, gain: 0.055, attack: 0.02 });
  },
  paletteOpen: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.B6, start: t, duration: 0.07, gain: 0.11, attack: 0.002 });
    tone(ctx, ui, { freq: NOTE.E7, start: t + 0.01, duration: 0.05, gain: 0.035, attack: 0.002 });
  },
  taskCreate: (ctx, { fx }, t) => {
    // A star is born: a rising pluck and a faint glint.
    tone(ctx, fx, { freq: NOTE.D5, glideTo: NOTE.A5, glide: 0.12, start: t, duration: 0.3, type: 'triangle', gain: 0.17, attack: 0.004 });
    tone(ctx, fx, { freq: NOTE.A6, start: t + 0.09, duration: 0.24, gain: 0.035, attack: 0.03 });
  },
  completeLow: complete(0),
  completeMedium: complete(1),
  completeHigh: complete(2),
  completeCritical: complete(3),
  subtaskComplete: (ctx, { fx }, t) => {
    thump(ctx, fx, NOTE.A3, NOTE.D3, t, 0.14, 0.18);
    tone(ctx, fx, { freq: NOTE.A5, start: t, duration: 0.15, type: 'triangle', gain: 0.12, attack: 0.003 });
  },
  progressStep: (ctx, { fx }, t, p) => {
    const note = LADDER[Math.round(Math.min(1, Math.max(0, p.value ?? 0)) * (LADDER.length - 1))]!;
    tone(ctx, fx, { freq: note, start: t, duration: 0.09, type: 'triangle', gain: 0.16, attack: 0.003 });
    noise(ctx, fx, { start: t, duration: 0.02, gain: 0.03, type: 'highpass', freq: 4500, attack: 0.002 });
  },
  counterUp: (ctx, { fx }, t) => {
    tone(ctx, fx, { freq: NOTE.A4, glideTo: NOTE.D5, glide: 0.06, start: t, duration: 0.11, gain: 0.2, attack: 0.004 });
  },
  counterDown: (ctx, { fx }, t) => {
    tone(ctx, fx, { freq: NOTE.D5, glideTo: NOTE.A4, glide: 0.06, start: t, duration: 0.11, gain: 0.18, attack: 0.004 });
  },
  timerStart: (ctx, { fx }, t) => bell(ctx, fx, NOTE.A5, t, 0.7, 0.11),
  timerPause: (ctx, { fx }, t) => bell(ctx, fx, NOTE.D5, t, 0.45, 0.12),
  pomodoroEnd: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.D5, t, 1, 0.06, -0.2);
    bell(ctx, fx, NOTE.Fs5, t + 0.16, 1, 0.055);
    bell(ctx, fx, NOTE.A5, t + 0.32, 1.2, 0.055, 0.2);
  },
  breakEnd: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.A5, t, 0.8, 0.055);
    bell(ctx, fx, NOTE.D6, t + 0.18, 1, 0.05);
  },
  levelUp: (ctx, { fx }, t) => {
    for (const [i, f] of [NOTE.D4, NOTE.Fs4, NOTE.A4, NOTE.D5].entries()) {
      tone(ctx, fx, { freq: f, start: t, duration: 2.3, type: 'triangle', gain: 0.022, attack: 0.5, pan: (i - 1.5) / 3 });
    }
    [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.D6].forEach((f, i) => bell(ctx, fx, f, t + 0.5 + i * 0.12, 1.4, 0.045, (i - 1.5) / 3));
    tone(ctx, fx, { freq: NOTE.A6, start: t + 1, duration: 1.4, gain: 0.012, attack: 0.3 });
  },
  achievement: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.D6, t, 1.2, 0.05, -0.25);
    bell(ctx, fx, NOTE.Fs6, t + 0.05, 1.1, 0.04, 0.25);
    bell(ctx, fx, NOTE.A6, t + 0.1, 1, 0.035);
    noise(ctx, fx, { start: t + 0.05, duration: 0.45, gain: 0.01, type: 'highpass', freq: 6500, attack: 0.05 });
  },
  notification: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.A5, start: t, duration: 0.16, gain: 0.09, attack: 0.008 });
    tone(ctx, ui, { freq: NOTE.D6, start: t + 0.12, duration: 0.2, gain: 0.09, attack: 0.008 });
  },
  friendRequest: (ctx, { fx }, t) => {
    for (const d of [0, 0.16, 0.32]) tone(ctx, fx, { freq: NOTE.A5, start: t + d, duration: 0.09, gain: 0.05, attack: 0.004 });
    tone(ctx, fx, { freq: NOTE.D3, start: t, duration: 0.5, gain: 0.04, attack: 0.05 });
  },
  questStar: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.B6, t, 0.45, 0.11);
    tone(ctx, fx, { freq: NOTE.E7, start: t + 0.02, duration: 0.2, gain: 0.025 });
  },
  questComplete: (ctx, { fx }, t) => {
    [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.D6].forEach((f, i) => bell(ctx, fx, f, t + i * 0.12, 1.3, 0.05, (i - 1.5) / 3));
    for (const f of [NOTE.D4, NOTE.A4]) tone(ctx, fx, { freq: f, start: t + 0.3, duration: 1.7, type: 'triangle', gain: 0.025, attack: 0.3 });
  },
  challengeWin: (ctx, { fx }, t) => {
    [NOTE.D5, NOTE.A5, NOTE.D6, NOTE.Fs6, NOTE.A6].forEach((f, i) => bell(ctx, fx, f, t + i * 0.08, 1, 0.045, (i - 2) / 4));
  },
  error: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.D4, start: t, duration: 0.12, gain: 0.1 });
    tone(ctx, ui, { freq: NOTE.D4 * 0.94, start: t + 0.11, duration: 0.16, gain: 0.09 });
  },
  swipeLeft: (ctx, { ui }, t) => noise(ctx, ui, { start: t, duration: 0.2, gain: 0.17, freq: 1200, sweepTo: 2800, q: 1.4, pan: 0.7, panTo: -0.7 }),
  swipeRight: (ctx, { ui }, t) => noise(ctx, ui, { start: t, duration: 0.2, gain: 0.17, freq: 1200, sweepTo: 2800, q: 1.4, pan: -0.7, panTo: 0.7 }),
  dragPickup: (ctx, { ui }, t) => tone(ctx, ui, { freq: NOTE.E5, glideTo: NOTE.A5, start: t, duration: 0.07, gain: 0.17, attack: 0.004 }),
  dragDrop: (ctx, { ui }, t) => {
    thump(ctx, ui, NOTE.A3 * 0.8, NOTE.A2, t, 0.14, 0.2);
    tone(ctx, ui, { freq: NOTE.D5, start: t, duration: 0.1, gain: 0.05, attack: 0.004 });
  },
  dragOver: (ctx, { ui }, t) => tone(ctx, ui, { freq: NOTE.B6, start: t, duration: 0.03, gain: 0.07, attack: 0.002 }),
  trash: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.A5, glideTo: NOTE.D5, start: t, duration: 0.25, gain: 0.19, attack: 0.006 });
    noise(ctx, ui, { start: t, duration: 0.22, gain: 0.06, freq: 2000, sweepTo: 600, q: 1 });
  },
  undo: (ctx, { ui }, t) => {
    tone(ctx, ui, { freq: NOTE.D5, glideTo: NOTE.A5, start: t, duration: 0.25, gain: 0.19, attack: 0.006 });
    noise(ctx, ui, { start: t, duration: 0.22, gain: 0.06, freq: 600, sweepTo: 2000, q: 1 });
  },
  hyperjump: (ctx, { fx }, t) => {
    // A rising rush toward the horizon, then a low boom as the app opens.
    tone(ctx, fx, { freq: 180, glideTo: 1600, glide: 0.9, start: t, duration: 0.95, gain: 0.035, attack: 0.3 });
    noise(ctx, fx, { start: t, duration: 0.95, gain: 0.03, type: 'bandpass', freq: 400, sweepTo: 4200, q: 0.8, attack: 0.7 });
    thump(ctx, fx, NOTE.D3, NOTE.D2 * 0.75, t + 0.95, 0.6, 0.21);
  },
  chime: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.A5, t, 0.9, 0.08);
    bell(ctx, fx, NOTE.D6, t + 0.12, 1.1, 0.07);
  },
  success: (ctx, { fx }, t) => {
    bell(ctx, fx, NOTE.D5, t, 0.8, 0.07);
    bell(ctx, fx, NOTE.Fs5, t + 0.08, 0.8, 0.065);
    bell(ctx, fx, NOTE.A5, t + 0.16, 1, 0.065);
  },
} satisfies Record<string, Recipe>;

export type SoundName = keyof typeof recipes;
export const soundNames = Object.keys(recipes) as SoundName[];

/** Completion sound for a priority key. */
export function completeSound(priority: string | null | undefined): SoundName {
  if (priority === 'critical') return 'completeCritical';
  if (priority === 'high') return 'completeHigh';
  if (priority === 'medium') return 'completeMedium';
  return 'completeLow';
}

/** Seconds each sound lasts, with its tail (for rendering it offline). */
export const soundLength: Partial<Record<SoundName, number>> = {
  levelUp: 2.6,
  questComplete: 2.2,
  achievement: 1.4,
  pomodoroEnd: 1.8,
  challengeWin: 1.6,
  hyperjump: 1.7,
  completeCritical: 1,
};
