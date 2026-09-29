/**
 * The planet under the sign-in forms: a vast sphere whose rim catches the
 * light, turning slowly. CSS only — the WebGL planet (stage 7) replaces it
 * when graphics are on, and this stays as the fallback.
 */
export function PlanetHorizon() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      <div className="absolute left-1/2 top-[64dvh] aspect-square w-[max(190vw,1400px)] -translate-x-1/2 sm:top-[62dvh] lg:w-[150vw]">
        {/* atmosphere halo */}
        <div
          className="absolute -inset-[3%] rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, transparent 93%, color-mix(in oklab, var(--accent) 26%, transparent) 96.5%, transparent 100%)',
            filter: 'blur(18px)',
          }}
        />
        {/* body */}
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, #1c2946 0%, #111a2f 22%, #0a1020 42%, #060912 70%)',
            boxShadow:
              'inset 0 2px 0 color-mix(in oklab, var(--accent) 70%, white), inset 0 24px 60px -18px color-mix(in oklab, var(--accent) 45%, transparent), 0 -12px 60px -20px color-mix(in oklab, var(--accent) 50%, transparent)',
          }}
        >
          {/* slowly drifting surface texture */}
          <div
            className="motion-ok:animate-[planet-drift_140s_linear_infinite] absolute inset-0 opacity-[0.16] mix-blend-screen"
            style={{
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='t' x='0' y='0' width='600' height='600' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.02' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.75  0 0 0 0 1  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(#t)'/></svg>",
              )}")`,
              backgroundSize: '600px 600px',
            }}
          />
          {/* terminator: the far side falls into night */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% -8%, transparent 30%, rgb(3 5 10 / 0.85) 62%)' }}
          />
        </div>
      </div>
    </div>
  );
}
