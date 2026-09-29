import type { GraphicsQuality } from '@/lib/device';

export type ConcreteQuality = Exclude<GraphicsQuality, 'auto'>;

interface Probe {
  renderer: string;
  cores: number;
  memory: number;
  mobile: boolean;
  webgl: boolean;
}

/** Pure scoring, unit-tested: renderer string + hardware hints → quality. */
export function scoreQuality({ renderer, cores, memory, mobile, webgl }: Probe): ConcreteQuality {
  if (!webgl) return 'off';
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(r)) return 'low';
  let score = 0;
  if (/apple m\d|apple gpu/.test(r)) score += 3;
  if (/nvidia|geforce|rtx|quadro|radeon rx|radeon pro|intel.*arc/.test(r)) score += 3;
  if (/intel.*(iris|uhd|hd graphics)/.test(r)) score += 1;
  if (/adreno.*(7|8)\d\d|mali-g7\d|mali-g6[89]|immortalis/.test(r)) score += 2;
  if (/adreno.*[3-5]\d\d|mali-[t4]|mali-g[35]\d|powervr/.test(r)) score -= 2;
  score += cores >= 8 ? 1 : cores <= 4 ? -1 : 0;
  score += memory >= 8 ? 1 : memory <= 2 ? -2 : 0;
  if (mobile) score -= 1;
  return score >= 4 ? 'ultra' : score >= 1 ? 'high' : 'low';
}

/** Probes this browser once. WebGL context is released immediately. */
export function detectGraphicsQuality(): ConcreteQuality {
  if (typeof window === 'undefined') return 'high';
  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
  let renderer = '';
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return scoreQuality({
    renderer,
    webgl: Boolean(gl),
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory ?? 4,
    mobile: /android|iphone|ipad|mobile/i.test(nav.userAgent) || matchMedia('(pointer: coarse)').matches,
  });
}
