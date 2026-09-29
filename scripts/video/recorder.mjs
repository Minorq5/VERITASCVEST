/**
 * Records a Playwright page to MP4 (H.264): Chrome's screencast frames go
 * straight into ffmpeg, re-timed to a constant frame rate by repeating the
 * last frame, so a slow software renderer still gives a video in real time.
 *
 *   const rec = new Recorder(page, { out: 'video.mp4', width: 1920, height: 1080 });
 *   await rec.start(); …; await rec.stop();
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';

/** A full ffmpeg: FFMPEG env, the one from the imageio-ffmpeg wheel, or PATH. */
export function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const wheel = '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
  return existsSync(wheel) ? wheel : 'ffmpeg';
}

export class Recorder {
  constructor(page, { out, width, height, fps = 30, crf = 18 }) {
    Object.assign(this, { page, out, width, height, fps, crf });
    this.last = null;
    this.slots = 0;
    this.origin = 0;
    this.paused = 0;
    this.pausedAt = 0;
    this.queue = Promise.resolve();
  }

  async start() {
    this.ff = spawn(findFfmpeg(), [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(this.fps), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${this.width}:${this.height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(this.crf), '-tune', 'animation',
      '-movflags', '+faststart', this.out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (frame) => {
      this.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
      if (this.pausedAt) return;
      const now = Date.now();
      if (!this.origin) this.origin = now;
      this.fill(now);
      this.last = Buffer.from(frame.data, 'base64');
    });
    // A cross-site navigation can swap the renderer; start the screencast again after each one.
    this.onNavigate = (frame) => {
      if (frame === this.page.mainFrame()) void this.screencast();
    };
    this.page.on('framenavigated', this.onNavigate);
    await this.screencast();
    this.timer = setInterval(() => this.fill(Date.now()), 40);
  }

  async screencast() {
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: this.width,
      maxHeight: this.height,
      everyNthFrame: 1,
    }).catch(() => {});
  }

  /** Repeats the last frame for every frame slot that has passed. */
  fill(now) {
    if (!this.last || this.pausedAt) return;
    const due = Math.floor(((now - this.origin - this.paused) / 1000) * this.fps);
    while (this.slots < due) {
      this.write(this.last);
      this.slots += 1;
    }
  }

  write(buffer) {
    this.queue = this.queue.then(
      () => new Promise((resolve) => (this.ff.stdin.write(buffer) ? resolve() : this.ff.stdin.once('drain', resolve))),
    );
  }

  /** Freezes the timeline (e.g. while waiting for something off screen). */
  pause() {
    if (!this.pausedAt) {
      this.fill(Date.now());
      this.pausedAt = Date.now();
    }
  }

  resume() {
    if (this.pausedAt) {
      this.paused += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
  }

  get seconds() {
    return this.slots / this.fps;
  }

  async stop() {
    clearInterval(this.timer);
    this.page.off('framenavigated', this.onNavigate);
    this.resume();
    this.fill(Date.now());
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.queue;
    this.ff.stdin.end();
    const [code] = await once(this.ff, 'close');
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  }
}
