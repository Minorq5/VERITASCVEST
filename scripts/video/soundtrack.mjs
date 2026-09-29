/**
 * The film's sound: the app reports every sound it plays (window.__vtLogSound,
 * bound here); after recording, each one is rendered offline by the app's own
 * recipes (window.__vtRenderSound) and laid on the timeline exactly where it
 * played. The intro score comes from its rendered WAV. Then ffmpeg puts the
 * track under the picture.
 */
import { spawnSync } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { findFfmpeg } from './recorder.mjs';

const RATE = 48000;

function decodeWav(buffer) {
  // 16-bit PCM, stereo, 48 kHz (what the app renders); find the data chunk.
  let offset = 12;
  while (offset < buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'data') {
      const pcm = new Int16Array(buffer.buffer, buffer.byteOffset + offset + 8, size / 2);
      const out = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i += 1) out[i] = pcm[i] / 32768;
      return out;
    }
    offset += 8 + size;
  }
  throw new Error('no data chunk');
}

function encodeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    // A soft knee above -3 dBFS instead of hard clipping.
    let v = samples[i];
    const a = Math.abs(v);
    if (a > 0.7) v = Math.sign(v) * (0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export class Soundtrack {
  constructor(context) {
    this.context = context;
    this.events = [];
  }

  /** Before the first page opens: hear every sound the app plays. */
  async attach() {
    await this.context.addInitScript(() => {
      window.__soundLog = [];
    });
    await this.context.exposeBinding('__vtLogSound', (_source, entry) => this.events.push({ ...entry, wall: Date.now() }));
  }

  /**
   * Renders the logged sounds through `page` (any app page), lays them on the
   * film's timeline and muxes the track into `video` in place.
   */
  async mix(page, recorder, video, { score = 'docs/review/v2/intro/intro-score.wav', gain = 1 } = {}) {
    if (!(await page.evaluate(() => typeof window.__vtRenderSound === 'function').catch(() => false))) {
      await page.goto(new URL('/ru/login', page.url()).toString());
      await page.waitForFunction(() => typeof window.__vtRenderSound === 'function', null, { timeout: 60_000 });
    }
    const frames = Math.ceil(recorder.seconds * RATE);
    const mix = new Float32Array(frames * 2);
    const cache = new Map();
    const scoreData = decodeWav(await readFile(score));
    const add = (samples, at, from = 0, until = samples.length / 2, fadeOut = 0) => {
      const start = Math.round(at * RATE);
      for (let i = from; i < until; i += 1) {
        const j = start + (i - from);
        if (j < 0) continue;
        if (j >= frames) break;
        const fade = fadeOut && until - i < fadeOut ? (until - i) / fadeOut : 1;
        mix[j * 2] += samples[i * 2] * gain * fade;
        mix[j * 2 + 1] += samples[i * 2 + 1] * gain * fade;
      }
    };
    let placed = 0;
    for (const [n, e] of this.events.entries()) {
      const at = recorder.videoTime(e.wall);
      if (at === null) continue;
      if (e.name === 'buffer:stop') continue;
      if (e.name.startsWith('buffer:')) {
        const offset = Number(e.name.slice(7)) / 1000;
        const stop = this.events.slice(n + 1).find((x) => x.name === 'buffer:stop');
        const stopAt = stop ? recorder.videoTime(stop.wall) : null;
        const from = Math.round(offset * RATE);
        const until = stopAt === null ? scoreData.length / 2 : Math.min(scoreData.length / 2, from + Math.round((stopAt - at) * RATE));
        add(scoreData, at, from, until, stopAt === null ? 0 : Math.round(0.3 * RATE));
        placed += 1;
        continue;
      }
      const key = JSON.stringify([e.name, e.params ?? null]);
      if (!cache.has(key)) {
        const b64 = await page.evaluate(({ name, params }) => window.__vtRenderSound(name, params), { name: e.name, params: e.params });
        cache.set(key, decodeWav(Buffer.from(b64, 'base64')));
      }
      add(cache.get(key), at);
      placed += 1;
    }
    const wav = video.replace(/\.mp4$/, '.wav');
    await writeFile(wav, encodeWav(mix));
    const tmp = video.replace(/\.mp4$/, '.with-sound.mp4');
    const result = spawnSync(
      findFfmpeg(),
      ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) throw new Error('ffmpeg could not add the sound');
    await rename(tmp, video);
    return { sounds: placed, kinds: cache.size, wav };
  }
}
