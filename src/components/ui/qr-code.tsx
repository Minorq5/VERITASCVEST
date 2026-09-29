'use client';

import QRCode from 'qrcode';
import { useMemo } from 'react';
import { MARK_LEFT_ARM, MARK_RIGHT_ARM, MARK_STAR } from '@/components/brand/logo-geometry';
import { cn } from '@/lib/utils/cn';

const QUIET = 3;
const INK = '#060912';
const PAPER = '#e8edfa';

/**
 * QR code in the brand style: rounded modules, soft finder "eyes" and the
 * mark in the centre. Classic polarity (dark on light) so every camera app
 * reads it; error correction H leaves room for the logo.
 */
export function QrCode({ value, size = 200, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const { count, cells } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const n = qr.modules.size;
    const logo = Math.ceil(n * 0.22) | 1;
    const lo = (n - logo) / 2;
    const out: [number, number][] = [];
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (!qr.modules.get(r, c) || inFinder(r, c)) continue;
        if (r >= lo && r < lo + logo && c >= lo && c < lo + logo) continue;
        out.push([r, c]);
      }
    }
    return { count: n, cells: out };
  }, [value]);

  const total = count + QUIET * 2;
  const eyes: [number, number][] = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  const logoBox = count * 0.22;
  const logoAt = QUIET + (count - logoBox) / 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn('shrink-0 rounded-xl', className)}
      shapeRendering="geometricPrecision"
    >
      <rect width={total} height={total} rx={2.4} fill={PAPER} />
      <g fill={INK}>
        {cells.map(([r, c]) => (
          <rect key={`${r}-${c}`} x={QUIET + c + 0.06} y={QUIET + r + 0.06} width={0.88} height={0.88} rx={0.3} />
        ))}
      </g>
      {eyes.map(([r, c]) => (
        <g key={`${r}-${c}`} transform={`translate(${QUIET + c} ${QUIET + r})`}>
          <path
            fillRule="evenodd"
            fill={INK}
            d="M1.9 0h3.2A1.9 1.9 0 0 1 7 1.9v3.2A1.9 1.9 0 0 1 5.1 7H1.9A1.9 1.9 0 0 1 0 5.1V1.9A1.9 1.9 0 0 1 1.9 0Zm.2 1h2.8A1.1 1.1 0 0 1 6 2.1v2.8A1.1 1.1 0 0 1 4.9 6H2.1A1.1 1.1 0 0 1 1 4.9V2.1A1.1 1.1 0 0 1 2.1 1Z"
          />
          <rect x={2} y={2} width={3} height={3} rx={0.9} fill={INK} />
        </g>
      ))}
      <g transform={`translate(${logoAt} ${logoAt})`}>
        <rect width={logoBox} height={logoBox} rx={logoBox * 0.24} fill={INK} />
        <g transform={`translate(${logoBox * 0.14} ${logoBox * 0.1}) scale(${(logoBox * 0.72) / 64})`}>
          <path d={MARK_LEFT_ARM} fill="var(--accent)" />
          <path d={MARK_RIGHT_ARM} fill="var(--accent)" />
          <path d={MARK_STAR} fill="#ffffff" />
        </g>
      </g>
    </svg>
  );
}
