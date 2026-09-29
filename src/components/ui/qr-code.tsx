'use client';

import QRCode from 'qrcode';
import { useId, useMemo } from 'react';
import { HORIZON_COMPACT } from '@/components/brand/logo-geometry';
import { cn } from '@/lib/utils/cn';

const QUIET = 3;
const INK = '#050506';
const PAPER = '#f2ede4';

/**
 * QR code in the brand style: square modules, finder "eyes" and the mark in
 * the centre. Classic polarity (dark on light) so every camera app reads it;
 * error correction H leaves room for the logo.
 */
export function QrCode({ value, size = 200, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const cutId = useId().replace(/:/g, '');
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
      className={cn('shrink-0 rounded-lg', className)}
      shapeRendering="geometricPrecision"
    >
      <rect width={total} height={total} rx={1.2} fill={PAPER} />
      <g fill={INK}>
        {cells.map(([r, c]) => (
          <rect key={`${r}-${c}`} x={QUIET + c + 0.05} y={QUIET + r + 0.05} width={0.9} height={0.9} rx={0.12} />
        ))}
      </g>
      {eyes.map(([r, c]) => (
        <g key={`${r}-${c}`} transform={`translate(${QUIET + c} ${QUIET + r})`}>
          <path
            fillRule="evenodd"
            fill={INK}
            d="M0 0h7v7H0Zm1 1v5h5V1Z"
          />
          <rect x={2} y={2} width={3} height={3} fill={INK} />
        </g>
      ))}
      <g transform={`translate(${logoAt} ${logoAt})`}>
        <rect width={logoBox} height={logoBox} rx={logoBox * 0.12} fill={INK} />
        <g transform={`translate(${logoBox * 0.1} ${logoBox * 0.1}) scale(${(logoBox * 0.8) / 64})`} fill="none">
          <defs>
            <mask id={cutId}>
              <rect width="64" height="64" fill="white" />
              <path d={HORIZON_COMPACT.cut} stroke="black" strokeWidth={HORIZON_COMPACT.cutStroke} />
            </mask>
          </defs>
          <g mask={`url(#${cutId})`}>
            <path d={HORIZON_COMPACT.over} stroke="#ff8a2a" strokeWidth={HORIZON_COMPACT.overStroke} />
            <circle
              cx={HORIZON_COMPACT.ring.cx}
              cy={HORIZON_COMPACT.ring.cy}
              r={HORIZON_COMPACT.ring.r}
              stroke="#ffa65c"
              strokeWidth={HORIZON_COMPACT.ring.stroke}
            />
          </g>
          <path d={HORIZON_COMPACT.diskNear} stroke="#ffa65c" strokeWidth={HORIZON_COMPACT.diskStroke} />
          <path d={HORIZON_COMPACT.diskFar} stroke="#ff8a2a" strokeWidth={HORIZON_COMPACT.diskStroke} />
        </g>
      </g>
    </svg>
  );
}
