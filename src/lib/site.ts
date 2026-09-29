/** Public site URL: used for metadata, share images and auth redirects. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export const isDev = process.env.NODE_ENV === 'development';

/** The design showcase is for development; a flag lets screenshot runs use a production build. */
export const designPageEnabled = isDev || process.env.NEXT_PUBLIC_ENABLE_DESIGN_PAGE === '1';
