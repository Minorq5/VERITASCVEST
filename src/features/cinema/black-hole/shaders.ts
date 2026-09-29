/**
 * GLSL for the black hole. Units: the Schwarzschild radius is 1, so the
 * photon sphere sits at r = 1.5 and the innermost stable orbit at r = 3.
 *
 * Rays are traced backwards from the camera along null geodesics. In these
 * units a photon's path obeys  x'' = -1.5 · h² · x / r⁵  with h = |x × x'|
 * conserved: the exact Schwarzschild orbit equation written in Cartesian form.
 * The thin disk emits with the Novikov–Thorne temperature profile; every
 * crossing is Doppler-beamed and gravitationally redshifted, so the side
 * turning toward us is brighter and bluer, the other dimmer and redder.
 * Light that escapes samples a procedural sky, so the stars are lensed too.
 */

export const fullscreenVertex = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const sceneFragment = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uCamBasis;      // columns: right, up, forward
uniform float uTanHalfFov;
uniform vec2 uShift;         // frame shift in screen heights (composition)
uniform float uTime;
uniform float uDisk;         // disk emission scale
uniform float uStars;        // sky brightness
uniform float uSpin;         // +1 / -1: which side comes toward us
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uTemp;         // peak disk temperature, K
uniform int uSamples;        // 1 or 4 (2×2 supersampling)

const int MAX_STEPS = 700;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

/* Colour of a black body (Planckian locus, Krystek's fit), normalised to its brightest channel. */
vec3 blackbody(float t) {
  t = clamp(t, 1000.0, 40000.0);
  float u = (0.860117757 + 1.54118254e-4 * t + 1.28641212e-7 * t * t) / (1.0 + 8.42420235e-4 * t + 7.08145163e-7 * t * t);
  float v = (0.317398726 + 4.22806245e-5 * t + 4.20481691e-8 * t * t) / (1.0 - 2.89741816e-5 * t + 1.61456053e-7 * t * t);
  float x = 3.0 * u / (2.0 * u - 8.0 * v + 4.0);
  float y = 2.0 * v / (2.0 * u - 8.0 * v + 4.0);
  vec3 xyz = vec3(x / y, 1.0, (1.0 - x - y) / y);
  vec3 rgb = mat3(3.2404542, -0.9692660, 0.0556434, -1.5371385, 1.8760108, -0.2040259, -0.4985314, 0.0415560, 1.0572252) * xyz;
  rgb = max(rgb, 0.0);
  return rgb / max(max(rgb.r, rgb.g), rgb.b);
}

/* Three layers of point stars. pix is the angular size of a pixel, so stars stay one pixel sharp. */
vec3 sky(vec3 d, float pix) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float scale = 55.0 * pow(2.2, float(l));
    float threshold = l == 0 ? 0.994 : (l == 1 ? 0.99 : 0.985);
    float gain = l == 0 ? 2.6 : (l == 1 ? 0.7 : 0.22);
    vec3 p = d * scale;
    vec3 base = floor(p - 0.5);
    for (int k = 0; k < 8; k++) {
      vec3 cell = base + vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
      float h = hash13(cell + float(l) * 37.0);
      if (h < threshold) continue;
      vec3 c = cell + 0.5 + (hash33(cell) - 0.5) * 0.7;
      float dist = length(p - c) / scale;
      float size = pix * 0.75;
      float b = gain * (0.35 + 0.65 * (h - threshold) / (1.0 - threshold));
      float temp = mix(3200.0, 11000.0, pow(hash13(cell * 1.7 + 3.0), 1.6));
      col += blackbody(temp) * b * exp(-(dist * dist) / (size * size));
    }
  }
  return col;
}

vec3 accel(vec3 p, float h2) {
  float r2 = dot(p, p);
  return -1.5 * h2 * p / (r2 * r2 * sqrt(r2));
}

/* Emission and opacity of the disk where a ray crosses its plane. */
vec4 disk(vec3 p, vec3 rayDir) {
  float r = length(p.xz);
  if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
  float x = uDiskIn / r;
  // Novikov–Thorne shape, normalised to 1 at its peak (x ≈ 0.735).
  float f = pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) / 0.4875;
  float phi = atan(p.z, p.x);
  float omega = uSpin * pow(r, -1.5);
  float ang = phi - omega * uTime * 4.0;
  // Gas: streaks stretched along the orbit, broken up by finer turbulence.
  vec3 q = vec3(r * 1.3, cos(ang) * 1.6, sin(ang) * 1.6);
  float lanes = fbm(vec3(r * 4.5, cos(ang) * 0.5, sin(ang) * 0.5));
  float gas = smoothstep(0.2, 0.85, fbm(q) * 0.6 + lanes * 0.6);
  float edge = smoothstep(uDiskIn, uDiskIn * 1.12, r) * (1.0 - smoothstep(uDiskOut * 0.55, uDiskOut, r));

  vec3 vdir = uSpin * normalize(vec3(-p.z, 0.0, p.x));
  float beta = min(sqrt(0.5 / max(r - 1.0, 0.05)), 0.75);
  float gamma = inversesqrt(1.0 - beta * beta);
  float cosT = dot(vdir, -rayDir);
  float g = sqrt(max(1.0 - 1.0 / r, 0.0)) / (gamma * (1.0 - beta * cosT));

  float temp = uTemp * pow(f, 0.8) * g;
  float intensity = f * f * pow(g, 3.0) * (0.3 + 0.7 * gas) * edge;
  float alpha = clamp((0.45 + 0.55 * gas) * edge * (0.55 + 0.45 * f) * 1.5, 0.0, 0.98);
  return vec4(blackbody(temp) * intensity * uDisk * 2.0, alpha);
}

vec3 trace(vec2 frag) {
  vec2 uv = (frag - 0.5 * uRes) / (0.5 * uRes.y) + uShift * 2.0;
  vec3 rd = normalize(uCamBasis * vec3(uv * uTanHalfFov, 1.0));
  vec3 pos = uCamPos;
  vec3 vel = rd;
  float h2 = dot(cross(pos, vel), cross(pos, vel));
  float escape = max(40.0, length(uCamPos) * 1.05);
  float pix = 2.0 * uTanHalfFov / uRes.y;

  vec3 col = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    float r = length(pos);
    if (r < 1.0) return col; // swallowed: the shadow
    if (r > escape && dot(pos, vel) > 0.0) break;
    float dt = clamp(mix(0.025, 0.075, smoothstep(2.0, 14.0, r)) * r, 0.02, 12.0);
    vec3 a1 = accel(pos, h2);
    vec3 midPos = pos + vel * dt * 0.5;
    vec3 midVel = vel + a1 * dt * 0.5;
    vec3 next = pos + midVel * dt;
    vec3 nextVel = vel + accel(midPos, h2) * dt;
    if (pos.y * next.y < 0.0 && uDisk > 0.0) {
      float t = pos.y / (pos.y - next.y);
      vec4 e = disk(mix(pos, next, t), normalize(mix(vel, nextVel, t)));
      col += trans * e.rgb * e.a;
      trans *= 1.0 - e.a;
      if (trans < 0.01) return col;
    }
    pos = next;
    vel = nextVel;
  }
  return col + trans * sky(normalize(vel), pix) * uStars;
}

void main() {
  vec3 c = vec3(0.0);
  if (uSamples > 1) {
    c += trace(gl_FragCoord.xy + vec2(-0.25, -0.25));
    c += trace(gl_FragCoord.xy + vec2(0.25, -0.25));
    c += trace(gl_FragCoord.xy + vec2(-0.25, 0.25));
    c += trace(gl_FragCoord.xy + vec2(0.25, 0.25));
    c *= 0.25;
  } else {
    c = trace(gl_FragCoord.xy);
  }
  fragColor = vec4(c, 1.0);
}
`;

/* Bright-pass and 2× downsample (13-tap box, soft knee) for the bloom chain. */
export const downsampleFragment = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;       // source texel size
uniform float uThreshold;  // < 0: plain downsample
void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * uTexel;
  vec3 c = texture(uSrc, uv).rgb * 0.5;
  c += texture(uSrc, uv + uTexel * vec2(-1.0, -1.0)).rgb * 0.125;
  c += texture(uSrc, uv + uTexel * vec2(1.0, -1.0)).rgb * 0.125;
  c += texture(uSrc, uv + uTexel * vec2(-1.0, 1.0)).rgb * 0.125;
  c += texture(uSrc, uv + uTexel * vec2(1.0, 1.0)).rgb * 0.125;
  if (uThreshold >= 0.0) {
    float br = max(max(c.r, c.g), c.b);
    float knee = uThreshold * 0.5;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-5);
    c *= max(soft, br - uThreshold) / max(br, 1e-5);
  }
  fragColor = vec4(c, 1.0);
}
`;

export const blurFragment = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uDir;         // texel step along the blur axis
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSrc, 0));
  const float w[5] = float[5](0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162);
  vec3 c = texture(uSrc, uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uSrc, uv + uDir * float(i)).rgb * w[i];
    c += texture(uSrc, uv - uDir * float(i)).rgb * w[i];
  }
  fragColor = vec4(c, 1.0);
}
`;

/* HDR → screen: bloom from the real light sources, filmic curve, a dark lens edge, dither. */
export const compositeFragment = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uHdr;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform vec2 uRes;
uniform float uExposure;
uniform float uBloom;
uniform float uFade;       // 0 = black, 1 = full frame

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uHdr, uv).rgb;
  c += (texture(uBloomA, uv).rgb * 0.6 + texture(uBloomB, uv).rgb * 0.9) * uBloom;
  c *= uExposure;
  vec2 v = uv - 0.5;
  c *= 1.0 - 0.35 * dot(v, v) * 1.6;
  c = aces(c);
  c = pow(c, vec3(1.0 / 2.2));
  c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(c * uFade, 1.0);
}
`;
