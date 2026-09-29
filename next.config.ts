import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Origins the browser may talk to besides our own. Supabase lives on its own
 * domain (or on 127.0.0.1:54321 for the local stack).
 */
function supabaseOrigins(): { http: string[]; ws: string[] } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: [], ws: [] };
  try {
    const url = new URL(raw);
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return { http: [url.origin], ws: [`${wsProtocol}//${url.host}`] };
  } catch {
    return { http: [], ws: [] };
  }
}

const supabase = supabaseOrigins();
// Only a real HTTPS deployment may force-upgrade requests; the local stack is plain HTTP.
const secureSite = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

/**
 * Static pages cannot carry per-request nonces, so inline scripts that Next.js
 * emits for hydration are allowed. Everything else is locked down: no foreign
 * scripts, no framing, no plugins, network only to ourselves and Supabase.
 */
const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? ` 'unsafe-eval'` : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data: ${supabase.http.join(' ')}`.trim(),
  `media-src 'self' blob: data:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${[...supabase.http, ...supabase.ws].join(' ')}${isDev ? ' ws: http://127.0.0.1:*' : ''}`.trim(),
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  ...(secureSite ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    globalNotFound: true,
    optimizePackageImports: ['lucide-react', 'radix-ui'],
  },
  images: {
    remotePatterns: supabase.http.map((origin) => {
      const url = new URL(origin);
      return {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        port: url.port,
        pathname: '/storage/v1/object/**',
      };
    }),
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
