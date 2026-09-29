import { blurFragment, compositeFragment, downsampleFragment, fullscreenVertex, sceneFragment } from './shaders';

/** Where the camera is and what the scene emits. Distances in Schwarzschild radii. */
export interface BlackHoleView {
  distance: number;
  /** Degrees above the disk plane. */
  elevation: number;
  /** Degrees around the vertical axis. */
  azimuth: number;
  /** Vertical field of view, degrees. */
  fov: number;
  /** Degrees of camera roll. */
  roll: number;
  /** Moves the frame so the hole sits off-centre: fractions of the screen height. */
  shift: [number, number];
  disk: number;
  stars: number;
  exposure: number;
  bloom: number;
  /** -1: the left side of the disk turns toward the camera (brighter, bluer); +1: the right. */
  spin: number;
  temperature: number;
  diskInner: number;
  diskOuter: number;
  /** Seconds; turns the gas in the disk. */
  time: number;
  /** 0 = black frame, 1 = full. */
  fade: number;
  /** How much wider a portrait screen looks (1 = same vertical angle as on desktop). */
  portraitFit: number;
}

export const defaultView: BlackHoleView = {
  distance: 24,
  elevation: 6,
  azimuth: 0,
  fov: 40,
  roll: 0,
  shift: [0, 0],
  disk: 1,
  stars: 1,
  exposure: 1,
  bloom: 0.6,
  spin: -1,
  temperature: 4500,
  diskInner: 3,
  diskOuter: 15,
  time: 0,
  fade: 1,
  portraitFit: 1.6,
};

type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader: ${log}`);
  }
  return shader;
}

function program(gl: WebGL2RenderingContext, fragment: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, fullscreenVertex));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program: ${gl.getProgramInfoLog(p)}`);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    p,
    u: (name: string) => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
      return uniforms.get(name)!;
    },
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Camera basis (right, up, forward) looking at the hole from the given orbit position. */
export function cameraFor(view: BlackHoleView) {
  const el = rad(view.elevation);
  const az = rad(view.azimuth);
  const pos: [number, number, number] = [
    view.distance * Math.cos(el) * Math.sin(az),
    view.distance * Math.sin(el),
    -view.distance * Math.cos(el) * Math.cos(az),
  ];
  const len = Math.hypot(...pos);
  const f = pos.map((c) => -c / len) as [number, number, number];
  // right = normalize(forward × worldUp), up = right × forward: right × up = -forward, so the view is not mirrored.
  const rl = Math.hypot(f[2], f[0]) || 1;
  const r: [number, number, number] = [-f[2] / rl, 0, f[0] / rl];
  let u: [number, number, number] = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  // roll around the forward axis
  const c = Math.cos(rad(view.roll));
  const s = Math.sin(rad(view.roll));
  const r2 = r.map((ri, i) => ri * c + u[i]! * s) as [number, number, number];
  u = u.map((ui, i) => ui * c - r[i]! * s) as [number, number, number];
  // column-major mat3: right, up, forward
  return { pos, basis: new Float32Array([...r2, ...u, ...f]) };
}

/**
 * Renders the black hole into a canvas: the geodesic pass into a float
 * buffer, a two-level bloom from what actually shines, then the filmic
 * composite. `renderStill` draws the expensive pass in tiles so software GL
 * (and slow GPUs) never stall; `renderFrame` is the real-time path.
 */
export class BlackHoleRenderer {
  private gl: WebGL2RenderingContext;
  private scene;
  private down;
  private blur;
  private composite;
  private hdr: Target | null = null;
  private bloom: Target[] = [];
  private vao: WebGLVertexArrayObject;
  private scale = 1;
  /** Longer geodesic steps trade a little accuracy near the ring for speed (real time on weak GPUs). */
  step = 1;
  /** Pixel size (radians) of the poster this frame must match; 0 draws stars one pixel sharp at any size. */
  starRef = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
      throw new Error('float render targets unavailable');
    }
    this.gl = gl;
    this.scene = program(gl, sceneFragment);
    this.down = program(gl, downsampleFragment);
    this.blur = program(gl, blurFragment);
    this.composite = program(gl, compositeFragment);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  private free(t: Target | null) {
    if (!t) return;
    this.gl.deleteFramebuffer(t.fbo);
    this.gl.deleteTexture(t.tex);
  }

  /** Sizes the buffers; `scale` < 1 renders the geodesics at a lower resolution (real time on weak GPUs). */
  resize(width: number, height: number, scale = 1) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = scale;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (this.hdr && this.hdr.w === w && this.hdr.h === h) return;
    this.free(this.hdr);
    this.bloom.forEach((t) => this.free(t));
    this.hdr = this.target(w, h);
    // half → quarter → eighth, each with a ping-pong partner for the blur
    const sizes = [2, 4, 8].map((d) => [Math.max(1, Math.ceil(w / d)), Math.max(1, Math.ceil(h / d))] as const);
    this.bloom = sizes.flatMap(([bw, bh]) => [this.target(bw, bh), this.target(bw, bh)]);
  }

  private sceneUniforms(view: BlackHoleView, samples: number) {
    const gl = this.gl;
    const s = this.scene;
    const { pos, basis } = cameraFor(view);
    gl.useProgram(s.p);
    gl.uniform2f(s.u('uRes'), this.hdr!.w, this.hdr!.h);
    gl.uniform3f(s.u('uCamPos'), pos[0], pos[1], pos[2]);
    gl.uniformMatrix3fv(s.u('uCamBasis'), false, basis);
    // Portrait screens see more of the scene vertically, so the disk is not cut to a sliver.
    const aspect = this.hdr!.w / this.hdr!.h;
    const fit = aspect < 1 ? Math.min(view.portraitFit, 0.75 / aspect) : 1;
    gl.uniform1f(s.u('uTanHalfFov'), Math.tan(rad(view.fov) / 2) * Math.max(1, fit));
    gl.uniform2f(s.u('uShift'), view.shift[0], view.shift[1]);
    gl.uniform1f(s.u('uTime'), view.time);
    gl.uniform1f(s.u('uDisk'), view.disk);
    gl.uniform1f(s.u('uStars'), view.stars);
    gl.uniform1f(s.u('uSpin'), view.spin);
    gl.uniform1f(s.u('uDiskIn'), view.diskInner);
    gl.uniform1f(s.u('uDiskOut'), view.diskOuter);
    gl.uniform1f(s.u('uTemp'), view.temperature);
    gl.uniform1i(s.u('uSamples'), samples);
    gl.uniform1f(s.u('uStep'), this.step);
    gl.uniform1f(s.u('uStarRef'), this.starRef);
  }

  private post(view: BlackHoleView) {
    const gl = this.gl;
    const hdr = this.hdr!;
    gl.disable(gl.SCISSOR_TEST);
    // bright pass + downsample chain
    let src = hdr;
    gl.useProgram(this.down.p);
    for (let level = 0; level < 3; level++) {
      const dst = this.bloom[level * 2]!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.down.u('uSrc'), 0);
      gl.uniform2f(this.down.u('uTexel'), 1 / src.w, 1 / src.h);
      gl.uniform1f(this.down.u('uThreshold'), level === 0 ? 0.85 : -1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    // blur the quarter and eighth levels
    gl.useProgram(this.blur.p);
    for (const level of [1, 2]) {
      const a = this.bloom[level * 2]!;
      const b = this.bloom[level * 2 + 1]!;
      for (let pass = 0; pass < 2; pass++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
        gl.viewport(0, 0, b.w, b.h);
        gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.uniform1i(this.blur.u('uSrc'), 0);
        gl.uniform2f(this.blur.u('uDir'), (1.5 + pass) / a.w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
        gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.uniform2f(this.blur.u('uDir'), 0, (1.5 + pass) / b.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    // composite to the canvas
    const c = this.composite;
    gl.useProgram(c.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hdr.tex);
    gl.uniform1i(c.u('uHdr'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[2]!.tex);
    gl.uniform1i(c.u('uBloomA'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[4]!.tex);
    gl.uniform1i(c.u('uBloomB'), 2);
    gl.uniform2f(c.u('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(c.u('uExposure'), view.exposure);
    gl.uniform1f(c.u('uBloom'), view.bloom);
    gl.uniform1f(c.u('uFade'), view.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** One real-time frame. */
  renderFrame(view: BlackHoleView) {
    const gl = this.gl;
    const hdr = this.hdr!;
    this.sceneUniforms(view, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.fbo);
    gl.viewport(0, 0, hdr.w, hdr.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.post(view);
  }

  /** A still, drawn tile by tile with a pause between tiles; resolves when the frame is on the canvas. */
  async renderStill(view: BlackHoleView, { samples = 4, tile = 128 } = {}) {
    const gl = this.gl;
    const hdr = this.hdr!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.fbo);
    gl.viewport(0, 0, hdr.w, hdr.h);
    gl.enable(gl.SCISSOR_TEST);
    for (let y = 0; y < hdr.h; y += tile) {
      for (let x = 0; x < hdr.w; x += tile) {
        if (gl.isContextLost()) return;
        this.sceneUniforms(view, samples);
        gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.fbo);
        gl.viewport(0, 0, hdr.w, hdr.h);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x, y, tile, tile);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        // Wait for the tile so a long frame never trips the GPU watchdog.
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
        gl.flush();
        while (!gl.isContextLost() && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) await new Promise((r) => setTimeout(r, 4));
        gl.deleteSync(sync);
      }
    }
    this.post(view);
  }

  get renderScale() {
    return this.scale;
  }

  /** The GPU's name as the driver reports it (to spot software rendering). */
  get gpu() {
    const info = this.gl.getExtension('WEBGL_debug_renderer_info');
    return String(this.gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : this.gl.RENDERER) ?? '');
  }

  dispose() {
    this.free(this.hdr);
    this.bloom.forEach((t) => this.free(t));
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
