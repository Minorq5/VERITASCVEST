/**
 * The login scene's 2D fallback (and first paint before the 3D scene):
 * a distant black hole in thin lines. The accretion disk is drawn as rings,
 * its far side lensed into an arc over the shadow; the approaching side (left)
 * is brighter and bluer, the receding side dimmer and warmer (Doppler). This is
 * scene light, so it lives in src/features/cinema, outside the UI bans.
 */
const R = 60;
const RINGS = [1.45, 1.8, 2.2, 2.65, 3.1];

export function DistantHorizon({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className ?? 'pointer-events-none fixed inset-0 -z-10 overflow-hidden'}>
      <svg
        viewBox="-240 -120 480 240"
        className="absolute top-[64%] left-1/2 w-[min(1100px,170vw)] opacity-90 sm:top-[60%] sm:left-[74%] sm:w-[min(1000px,78vw)]"
        style={{ transform: 'translate(-50%, -50%) rotate(-8deg)' }}
      >
        <g fill="none" strokeWidth={0.7} vectorEffect="non-scaling-stroke">
          {/* far side of the disk, bent over the top of the shadow by the lens */}
          {RINGS.map((k, i) => (
            <path
              key={`arc-${k}`}
              d={`M ${-R * k} 0 A ${R * k} ${R * (1.1 + i * 0.14)} 0 0 1 ${R * k} 0`}
              stroke="#ffa65c"
              strokeOpacity={0.5 - i * 0.08}
            />
          ))}
          {/* ...and a thinner image of it under the shadow */}
          {[1.1, 1.2].map((k, i) => (
            <path key={`under-${k}`} d={`M ${-R * k} 0 A ${R * k} ${R * k} 0 0 0 ${R * k} 0`} stroke="#ff8a2a" strokeOpacity={0.35 - i * 0.12} />
          ))}
          {/* near side: flat rings, brighter on the approaching (left) half */}
          {RINGS.map((k, i) => (
            <g key={`ring-${k}`}>
              <path d={`M ${-R * k} 0 A ${R * k} ${R * k * 0.16} 0 0 0 0 ${R * k * 0.16}`} stroke="#ffd2a6" strokeOpacity={0.85 - i * 0.13} />
              <path d={`M 0 ${R * k * 0.16} A ${R * k} ${R * k * 0.16} 0 0 0 ${R * k} 0`} stroke="#ff8a2a" strokeOpacity={0.45 - i * 0.07} />
            </g>
          ))}
        </g>
        {/* the shadow and the photon ring */}
        <circle r={R} fill="#020203" />
        <circle r={R * 1.035} fill="none" stroke="#ffd2a6" strokeOpacity={0.75} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        {/* the front of the disk passes in front of the shadow */}
        <g fill="none" strokeWidth={0.7} vectorEffect="non-scaling-stroke">
          {RINGS.slice(0, 3).map((k, i) => (
            <path
              key={`front-${k}`}
              d={`M ${-R * k} 0 A ${R * k} ${R * k * 0.16} 0 0 0 ${R * k} 0`}
              stroke="#ffb67a"
              strokeOpacity={0.55 - i * 0.12}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
