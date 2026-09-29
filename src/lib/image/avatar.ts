/** Pixel rectangle chosen in the cropper (source image coordinates). */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const AVATAR_SIZE = 512;
export const AVATAR_MAX_INPUT = 10 * 1024 * 1024;
export const AVATAR_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarInputProblem = 'wrongType' | 'tooBig';

/** Checks a picked file before it is even decoded. */
export function checkAvatarInput(file: { type: string; size: number }): AvatarInputProblem | null {
  if (!(AVATAR_INPUT_TYPES as readonly string[]).includes(file.type)) return 'wrongType';
  if (file.size > AVATAR_MAX_INPUT) return 'tooBig';
  return null;
}

/** Unique, cache-friendly storage path inside the person's own folder. */
export function avatarPath(userId: string, mime: string, now = Date.now()): string {
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  return `${userId}/${now.toString(36)}.${ext}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode_failed'));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Crops and scales to a 512×512 WebP (JPEG where the browser cannot encode
 * WebP, e.g. older Safari). A 10 MB photo becomes ~40 KB.
 */
export async function renderAvatar(src: string, area: CropArea, size = AVATAR_SIZE): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  const webp = await toBlob(canvas, 'image/webp', 0.86);
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.9);
  if (!jpeg) throw new Error('encode_failed');
  return jpeg;
}
