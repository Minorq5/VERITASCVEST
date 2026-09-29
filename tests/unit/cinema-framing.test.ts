import { describe, expect, it } from 'vitest';
import { coverView } from '@/features/cinema/black-hole/framing';
import { defaultView } from '@/features/cinema/black-hole/renderer';

/** Ray direction (before the camera basis) of a pixel, as the shader computes it. */
function ray(view: typeof defaultView, res: { width: number; height: number }, x: number, y: number) {
  const u = (x - res.width / 2) / (res.height / 2) + view.shift[0] * 2;
  const v = (y - res.height / 2) / (res.height / 2) + view.shift[1] * 2;
  const t = Math.tan((view.fov * Math.PI) / 360);
  return [u * t, v * t];
}

describe('coverView', () => {
  const poster = { width: 1600, height: 1000 };
  const view = { ...defaultView, fov: 40, shift: [0.03, -0.05] as [number, number], portraitFit: 1 };

  it('is the identity when the box has the poster’s shape', () => {
    const v = coverView(view, poster, { width: 800, height: 500 });
    expect(v.fov).toBeCloseTo(40, 6);
    expect(v.shift[0]).toBeCloseTo(0.03, 6);
    expect(v.shift[1]).toBeCloseTo(-0.05, 6);
  });

  for (const [box, position] of [
    [{ width: 400, height: 700 }, [0.5, 0.5]],
    [{ width: 400, height: 700 }, [0.2, 0.5]],
    [{ width: 1400, height: 500 }, [0.5, 0.3]],
    [{ width: 393, height: 240 }, [0.5, 0.5]],
  ] as const) {
    it(`sends every box pixel along the poster's ray (${box.width}×${box.height} at ${position.join(',')})`, () => {
      const v = coverView(view, poster, box, position);
      const s = Math.max(box.width / poster.width, box.height / poster.height);
      const ox = (box.width - poster.width * s) * position[0];
      const oy = (box.height - poster.height * s) * position[1];
      for (const [bx, by] of [
        [0, 0],
        [box.width, box.height],
        [box.width * 0.3, box.height * 0.8],
      ] as const) {
        // Box pixel (y down) → poster pixel (y down); the shader works y up.
        const px = (bx - ox) / s;
        const py = (by - oy) / s;
        const a = ray(v, box, bx, box.height - by);
        const b = ray(view, poster, px, poster.height - py);
        expect(a[0]).toBeCloseTo(b[0]!, 6);
        expect(a[1]).toBeCloseTo(b[1]!, 6);
      }
    });
  }
});
