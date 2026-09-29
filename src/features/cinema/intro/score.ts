/**
 * The intro score (DESIGN_V2 §8.1), synthesised with Web Audio in D major
 * pentatonic like every other sound. It is built into any audio context, so
 * the same code plays live and renders offline (for the video and the WAV):
 *
 *   0.0–1.2  silence
 *   1.2–3.0  a deep low hum
 *   3.0–5.5  the noise of the disk, rising
 *   5.5–8.0  stretched tones: the pitch sinks as time slows near the horizon
 *   8.0–8.6  sudden silence
 *   8.6–     one clean, bright tone as the light opens
 */

export const SCORE_LENGTH = 11.5;

const D1 = 36.71;
const D2 = 73.42;
const A1 = 55;
const D3 = 146.83;
const D4 = 293.66;
const A4 = 440;
const Fs5 = 739.99;
const D5 = 587.33;
const A5 = 880;
const D6 = 1174.66;
const A6 = 1760;

/** Seeded noise so the score is the same every time. */
function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number, brown = false) {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    let s = (seed + ch * 7919) >>> 0;
    let last = 0;
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const white = (s / 4294967296) * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else data[i] = white;
    }
  }
  return buffer;
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    let s = 20260929 + ch;
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = ((s / 4294967296) * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

/** A gain envelope from [time, value] points (linear ramps; the first point is set). */
function envelope(param: AudioParam, at: number, points: [number, number][]) {
  const [first, ...rest] = points;
  param.setValueAtTime(first![1], at + first![0]);
  for (const [t, v] of rest) param.linearRampToValueAtTime(v, at + t);
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, at: number, from: number, to: number, out: AudioNode, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(out);
  o.start(at + from);
  o.stop(at + to);
  return o;
}

/**
 * Schedules the whole score into `ctx`, starting at `at` (context seconds).
 * `dry` receives the direct sound, `wet` the reverb send.
 */
export function scheduleIntroScore(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at: number) {
  // ── The hum (1.2–8.0): D1 and D2 with a slow beating, through a low-pass. ──
  const hum = ctx.createGain();
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 220;
  hum.connect(humFilter).connect(dry);
  envelope(hum.gain, at, [
    [0, 0],
    [1.2, 0],
    [3, 0.34],
    [5.5, 0.42],
    [7.95, 0.5],
    [8, 0],
  ]);
  const humOscs = [
    osc(ctx, 'sine', D1, at, 1.1, 8.05, hum),
    osc(ctx, 'sine', D2, at, 1.1, 8.05, hum),
    osc(ctx, 'sine', D2, at, 1.1, 8.05, hum, 11),
    osc(ctx, 'triangle', A1, at, 1.1, 8.05, hum),
  ];
  // The whole hum sinks a little as the camera falls in.
  for (const o of humOscs) {
    o.detune.setValueAtTime(o.detune.value, at + 5.5);
    o.detune.linearRampToValueAtTime(o.detune.value - 180, at + 8);
  }
  // Pressure: brown noise under the hum.
  const rumble = ctx.createBufferSource();
  rumble.buffer = noiseBuffer(ctx, 7, 7, true);
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 120;
  const rumbleGain = ctx.createGain();
  envelope(rumbleGain.gain, at, [
    [0, 0],
    [1.2, 0],
    [3, 0.25],
    [7.95, 0.45],
    [8, 0],
  ]);
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(dry);
  rumble.start(at + 1.1);
  rumble.stop(at + 8.05);

  // ── The disk (3.0–8.0): band-passed noise that swells and climbs, with a slow flutter. ──
  const disk = ctx.createBufferSource();
  disk.buffer = noiseBuffer(ctx, 5.2, 42);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(180, at + 3);
  band.frequency.exponentialRampToValueAtTime(900, at + 5.5);
  band.frequency.exponentialRampToValueAtTime(2600, at + 8);
  const diskGain = ctx.createGain();
  envelope(diskGain.gain, at, [
    [0, 0],
    [3, 0],
    [5.5, 0.2],
    [7.95, 0.34],
    [8, 0],
  ]);
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 3.2;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.18;
  lfo.connect(lfoDepth).connect(flutter.gain);
  lfo.start(at + 3);
  lfo.stop(at + 8.05);
  disk.connect(band).connect(diskGain).connect(flutter);
  flutter.connect(dry);
  flutter.connect(wet);
  disk.start(at + 3);
  disk.stop(at + 8.05);

  // ── Stretched tones (5.5–8.0): D, A, F♯ held and sinking a minor third, spread in stereo. ──
  const tones: [number, number][] = [
    [D4, -0.5],
    [A4, 0.5],
    [Fs5, 0],
  ];
  tones.forEach(([freq, pan], i) => {
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    envelope(g.gain, at, [
      [0, 0],
      [5.5 + i * 0.25, 0],
      [6.6 + i * 0.25, 0.07 - i * 0.015],
      [7.95, 0.09 - i * 0.015],
      [8, 0],
    ]);
    g.connect(p);
    p.connect(dry);
    p.connect(wet);
    for (const [type, detune] of [
      ['sine', 0],
      ['triangle', 6],
    ] as const) {
      const o = osc(ctx, type, freq, at, 5.4 + i * 0.25, 8.05, g, detune);
      o.detune.setValueAtTime(detune, at + 5.8);
      o.detune.linearRampToValueAtTime(detune - 300, at + 8);
    }
  });

  // ── The light (8.6–): a clean bell chord with a soft body under it and a rising glint. ──
  const bell = (freq: number, start: number, decay: number, level: number, pan: number) => {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dry);
    p.connect(wet);
    for (const [ratio, amount, length] of [
      [1, 1, 1],
      [2.01, 0.3, 0.55],
      [3.02, 0.1, 0.35],
    ] as const) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at + start);
      g.gain.exponentialRampToValueAtTime(level * amount, at + start + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, at + start + decay * length);
      g.connect(p);
      osc(ctx, 'sine', freq * ratio, at, start, start + decay * length + 0.05, g);
    }
  };
  bell(D5, 8.6, 2.8, 0.16, -0.2);
  bell(A5, 8.68, 2.6, 0.12, 0.25);
  bell(D6, 8.78, 2.4, 0.08, 0);

  const body = ctx.createGain();
  envelope(body.gain, at, [
    [0, 0],
    [8.6, 0],
    [9.2, 0.12],
    [11.2, 0],
  ]);
  body.connect(dry);
  osc(ctx, 'sine', D3, at, 8.6, 11.3, body);

  const glint = ctx.createGain();
  envelope(glint.gain, at, [
    [0, 0],
    [8.8, 0],
    [9.4, 0.025],
    [10.4, 0],
  ]);
  glint.connect(wet);
  const g = osc(ctx, 'sine', A6, at, 8.8, 10.5, glint);
  g.frequency.setValueAtTime(A6, at + 8.8);
  g.frequency.exponentialRampToValueAtTime(D6 * 2, at + 9.8);
}

/** A reverb and a limiter around the score; returns the input nodes. */
function mixBus(ctx: BaseAudioContext, out: AudioNode) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 10;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;
  limiter.connect(out);
  const dry = ctx.createGain();
  dry.connect(limiter);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  wet.connect(reverb).connect(limiter);
  return { dry, wet };
}

/** Renders the score into a buffer (the same sound every time). */
export async function renderIntroScore(sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * SCORE_LENGTH), sampleRate);
  const { dry, wet } = mixBus(ctx, ctx.destination);
  scheduleIntroScore(ctx, dry, wet, 0);
  return ctx.startRendering();
}
