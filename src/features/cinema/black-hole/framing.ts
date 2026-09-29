import type { BlackHoleView } from './renderer';

export interface Size {
  width: number;
  height: number;
}

/**
 * The live scene must show exactly what its poster shows under
 * `object-fit: cover` (so the switch from picture to 3D is invisible) while
 * rendering only the visible part. The poster covers the box and is placed
 * at `position` (0..1 on each axis, like `object-position`); the box then sees
 * a window of the poster: a narrower field of view, shifted off the centre.
 *
 * In the shader a pixel's ray is (uv + 2·shift)·tan(fov/2) with uv in units of
 * half the screen height. For the box, uv_poster = k·uv_box + d, where k is
 * the box height in poster heights and d the offset of the box centre; so the
 * box renders with tan' = k·tan and shift' = (d + 2·shift) / 2k.
 */
export function coverView(view: BlackHoleView, poster: Size, box: Size, position: readonly [number, number] = [0.5, 0.5]): BlackHoleView {
  const s = Math.max(box.width / poster.width, box.height / poster.height);
  const shown = { width: poster.width * s, height: poster.height * s };
  // Poster centre relative to the box centre, in box pixels (y up).
  const dx = (box.width - shown.width) * position[0] + shown.width / 2 - box.width / 2;
  const dy = -((box.height - shown.height) * position[1] + shown.height / 2 - box.height / 2);
  const half = shown.height / 2;
  const k = box.height / shown.height;
  // Box centre in the poster's uv.
  const d: [number, number] = [-dx / half, -dy / half];
  const tan = Math.tan((view.fov * Math.PI) / 360) * k;
  return {
    ...view,
    fov: (Math.atan(tan) * 360) / Math.PI,
    shift: [(d[0] + 2 * view.shift[0]) / (2 * k), (d[1] + 2 * view.shift[1]) / (2 * k)],
    portraitFit: 1,
  };
}
