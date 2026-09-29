import { cn } from '@/lib/utils/cn';

/**
 * Flat drifting astronaut for empty states. The 3D version (stage 7) replaces
 * it when graphics are on; this one is the fallback and the first paint.
 */
export function AstronautArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 170" className={cn('overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.9 }} />
          <stop offset="0.55" style={{ stopColor: 'var(--accent-lo)', stopOpacity: 0.45 }} />
          <stop offset="1" stopColor="#03050a" />
        </linearGradient>
        <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3550" />
          <stop offset="1" stopColor="#161f34" />
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.25 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {/* far stars */}
      {[
        [26, 30, 1.2],
        [190, 22, 1],
        [200, 118, 1.4],
        [40, 128, 0.9],
        [150, 150, 1],
      ].map(([cx, cy, r]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="#e8edfa"
          opacity={0.6}
          className="motion-ok:animate-twinkle"
        />
      ))}
      <path
        d="M176 42c.5 4.2 2.3 6 6.5 6.5-4.2.5-6 2.3-6.5 6.5-.5-4.2-2.3-6-6.5-6.5 4.2-.5 6-2.3 6.5-6.5Z"
        fill="var(--accent)"
        className="motion-ok:animate-twinkle"
      />

      <circle cx="118" cy="82" r="70" fill="url(#halo)" />

      {/* tether */}
      <path
        d="M8 152c30-6 40-40 70-44s28 10 40 2"
        fill="none"
        stroke="var(--color-line-bright)"
        strokeWidth={1.5}
        strokeDasharray="3 5"
        strokeLinecap="round"
      />

      <g
        className="motion-ok:animate-drift"
        style={{ transformOrigin: '118px 82px', transformBox: 'view-box' }}
      >
        <g transform="rotate(-14 118 82)">
          {/* backpack */}
          <rect
            x="86"
            y="60"
            width="30"
            height="46"
            rx="10"
            fill="#1d2842"
            stroke="var(--color-line-bright)"
          />
          {/* legs */}
          <rect
            x="104"
            y="100"
            width="15"
            height="30"
            rx="7.5"
            fill="url(#suit)"
            stroke="var(--color-line-bright)"
            transform="rotate(8 111 100)"
          />
          <rect
            x="122"
            y="100"
            width="15"
            height="30"
            rx="7.5"
            fill="url(#suit)"
            stroke="var(--color-line-bright)"
            transform="rotate(-10 129 100)"
          />
          {/* torso */}
          <rect
            x="98"
            y="62"
            width="44"
            height="48"
            rx="17"
            fill="url(#suit)"
            stroke="var(--color-line-bright)"
          />
          <rect
            x="110"
            y="78"
            width="20"
            height="12"
            rx="3"
            fill="#0e1422"
            stroke="var(--color-line-strong)"
          />
          <circle cx="115" cy="84" r="1.8" fill="var(--accent)" />
          <circle cx="121" cy="84" r="1.8" fill="var(--color-warning)" />
          {/* arms */}
          <rect
            x="80"
            y="70"
            width="14"
            height="30"
            rx="7"
            fill="url(#suit)"
            stroke="var(--color-line-bright)"
            transform="rotate(38 87 70)"
          />
          <rect
            x="140"
            y="66"
            width="14"
            height="30"
            rx="7"
            fill="url(#suit)"
            stroke="var(--color-line-bright)"
            transform="rotate(-52 147 66)"
          />
          {/* helmet */}
          <circle cx="121" cy="46" r="25" fill="#1a2338" stroke="var(--color-line-bright)" />
          <path
            d="M103 46c0-9 8-15 19-15s18 6 18 14c0 9-8 15-19 15s-18-5-18-14Z"
            fill="url(#visor)"
          />
          <path
            d="M110 38c3-3 8-4 12-4"
            stroke="#ffffff"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>
    </svg>
  );
}
