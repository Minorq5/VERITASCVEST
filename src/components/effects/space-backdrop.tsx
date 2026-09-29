import { cn } from '@/lib/utils/cn';

/** Deterministic pseudo-random numbers so the server and client draw the same sky. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starTile(seed: number, count: number, size: number, maxRadius: number, alpha: number) {
  const rand = rng(seed);
  let circles = '';
  for (let i = 0; i < count; i += 1) {
    const x = (rand() * size).toFixed(1);
    const y = (rand() * size).toFixed(1);
    const r = (0.3 + rand() * maxRadius).toFixed(2);
    const a = (alpha * (0.35 + rand() * 0.65)).toFixed(2);
    const tint = rand() > 0.82 ? '#bfe9ff' : rand() > 0.9 ? '#ffe7c4' : '#e8edfa';
    circles += `<circle cx='${x}' cy='${y}' r='${r}' fill='${tint}' fill-opacity='${a}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${circles}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const FAR = starTile(7, 120, 420, 0.7, 0.7);
const MID = starTile(19, 40, 560, 1.05, 0.85);
const NEAR = starTile(31, 12, 780, 1.5, 1);

/**
 * The static sky behind the interface: nebula light, three star layers and
 * film grain. It is also the fallback when 3D is off or unavailable; the WebGL
 * starfield (stage 7) renders on top of it when enabled.
 */
export function SpaceBackdrop({
  className,
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void', className)}
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: intensity,
          backgroundImage: [
            'radial-gradient(1200px 700px at 78% -10%, color-mix(in oklab, var(--accent) 11%, transparent), transparent 60%)',
            'radial-gradient(900px 600px at -5% 105%, rgb(120 90 220 / 0.10), transparent 60%)',
            'radial-gradient(700px 500px at 50% 50%, rgb(20 30 60 / 0.35), transparent 70%)',
            'linear-gradient(180deg, #060912 0%, #04070e 100%)',
          ].join(','),
        }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: FAR, opacity: 0.8 * intensity }}
      />
      <div
        className="absolute inset-0 motion-ok:animate-twinkle"
        style={{ backgroundImage: MID, opacity: 0.9 * intensity, animationDuration: '7s' }}
      />
      <div
        className="absolute inset-0 motion-ok:animate-twinkle"
        style={{
          backgroundImage: NEAR,
          opacity: intensity,
          animationDuration: '11s',
          animationDelay: '-3s',
        }}
      />
      <Grain />
    </div>
  );
}

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n' x='0' y='0' width='220' height='220' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/** Film grain for a cinematic finish. Static: animated grain costs battery. */
export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 mix-blend-overlay', className)}
      style={{ backgroundImage: GRAIN, opacity: 'var(--grain-opacity)' }}
    />
  );
}
