import { forwardRef, type SVGProps } from 'react';

/**
 * Brand icons drawn on Lucide's grid (24px, 1.75 stroke, round joins) so they
 * sit next to Lucide icons without looking foreign. Only concepts that Lucide
 * does not express with the right meaning live here.
 */
export interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  strokeWidth?: number | string;
  title?: string;
}

function createBrandIcon(displayName: string, children: React.ReactNode) {
  const Icon = forwardRef<SVGSVGElement, BrandIconProps>(function BrandIcon(
    { size = 24, strokeWidth = 1.75, title, className, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        aria-label={title}
        {...rest}
      >
        {children}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

/** Four-point star: a task, a moment of completion. */
export const StarGlintIcon = createBrandIcon(
  'StarGlintIcon',
  <path d="M12 2.5c.7 5.9 3.6 8.8 9.5 9.5-5.9.7-8.8 3.6-9.5 9.5-.7-5.9-3.6-8.8-9.5-9.5 5.9-.7 8.8-3.6 9.5-9.5Z" />,
);

/** Planet with a ring: a project. */
export const PlanetIcon = createBrandIcon(
  'PlanetIcon',
  <>
    <circle cx="12" cy="12" r="5" />
    <path d="M7.3 14.4C3.9 16.2 1.9 18.1 2.5 19.2c.9 1.5 6.6-.3 12.8-4s10.4-7.9 9.5-9.4c-.6-1-3.3-.7-6.8.6" />
  </>,
);

/** Stars joined by lines: a quest. */
export const ConstellationIcon = createBrandIcon(
  'ConstellationIcon',
  <>
    <path d="m5 18.5 4.2-8.2 5.9 3.4 4.4-8.2" strokeOpacity={0.6} />
    <circle cx="5" cy="18.5" r="1.6" fill="currentColor" />
    <circle cx="9.2" cy="10.3" r="1.6" fill="currentColor" />
    <circle cx="15.1" cy="13.7" r="1.6" fill="currentColor" />
    <circle cx="19.5" cy="5.5" r="1.9" fill="currentColor" />
  </>,
);

/** Comet with a tail: a streak of days. */
export const CometIcon = createBrandIcon(
  'CometIcon',
  <>
    <circle cx="16.5" cy="7.5" r="3.2" />
    <path d="M14 10 4 20" />
    <path d="M12 7.7 7 12.7" strokeOpacity={0.6} />
    <path d="m16.3 12-5 5" strokeOpacity={0.6} />
  </>,
);

/** Two-armed spiral: the galaxy view. */
export const GalaxyIcon = createBrandIcon(
  'GalaxyIcon',
  <>
    <path d="M13.5 12a1.5 1.5 0 1 1-1.5-1.5c2.5 0 4 2 4 4.2 0 3-2.7 5.3-6 5.3A7.5 7.5 0 0 1 2.5 12" />
    <path d="M10.5 12a1.5 1.5 0 1 1 1.5 1.5c-2.5 0-4-2-4-4.2 0-3 2.7-5.3 6-5.3a7.5 7.5 0 0 1 7.5 7.5" />
  </>,
);

/** Radiating burst: a new level, a supernova. */
export const SupernovaIcon = createBrandIcon(
  'SupernovaIcon',
  <>
    <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    <path d="m5.6 5.6 2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" strokeOpacity={0.6} />
  </>,
);

/** Helmet with a visor: the person, onboarding. */
export const AstronautIcon = createBrandIcon(
  'AstronautIcon',
  <>
    <circle cx="12" cy="10.5" r="7.5" />
    <path d="M7.6 10.6c0-2.2 2-3.6 4.4-3.6s4.4 1.4 4.4 3.6-2 3.2-4.4 3.2-4.4-1-4.4-3.2Z" />
    <path d="M8 17.5v3h8v-3" />
  </>,
);

/** Hexagonal badge with a star: rank and achievements. */
export const RankIcon = createBrandIcon(
  'RankIcon',
  <>
    <path d="M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3Z" />
    <path d="M12 7.8c.35 2.6 1.6 3.85 4.2 4.2-2.6.35-3.85 1.6-4.2 4.2-.35-2.6-1.6-3.85-4.2-4.2 2.6-.35 3.85-1.6 4.2-4.2Z" />
  </>,
);

/** Small ship on an orbit arc: a friend nearby. */
export const ShipIcon = createBrandIcon(
  'ShipIcon',
  <>
    <path d="M2.5 15.5c3.2 3.6 9.2 4.8 14.3 2.4" strokeOpacity={0.6} />
    <path d="m13.2 12.6 7.8-7.6-2.6 9.9-2.8-2.1Z" />
    <path d="m13.2 12.6 2.4-.2" />
  </>,
);
