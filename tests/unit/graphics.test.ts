import { describe, expect, it } from 'vitest';
import { scoreQuality } from '@/lib/graphics/detect';

const base = { cores: 8, memory: 8, mobile: false, webgl: true };

describe('graphics quality detection', () => {
  it('no WebGL → off; software rendering → low', () => {
    expect(scoreQuality({ ...base, renderer: '', webgl: false })).toBe('off');
    expect(scoreQuality({ ...base, renderer: 'Google SwiftShader' })).toBe('low');
    expect(scoreQuality({ ...base, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })).toBe('low');
  });
  it('strong desktop GPUs → ultra', () => {
    expect(scoreQuality({ ...base, renderer: 'ANGLE (NVIDIA GeForce RTX 3070)' })).toBe('ultra');
    expect(scoreQuality({ ...base, renderer: 'Apple M2' })).toBe('ultra');
  });
  it('integrated laptop → high; old phone → low; flagship phone → high', () => {
    // Weak integrated GPU on a budget laptop; the FPS monitor adapts further at runtime.
    expect(scoreQuality({ ...base, cores: 4, memory: 4, renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620)' })).toBe('low');
    expect(scoreQuality({ ...base, renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)' })).toBe('high');
    expect(scoreQuality({ cores: 4, memory: 2, mobile: true, webgl: true, renderer: 'Mali-T830' })).toBe('low');
    expect(scoreQuality({ cores: 8, memory: 8, mobile: true, webgl: true, renderer: 'Adreno (TM) 740' })).toBe('high');
    expect(scoreQuality({ cores: 6, memory: 4, mobile: true, webgl: true, renderer: 'Apple GPU' })).toBe('high');
  });
});
