const DEFAULT_PUBLIC_SUPPORT = 'compliance@pesttrace.com';

const nextConfig = {
  env: {
    /** Exposed to the browser for mailto links; falls back to SUPPORT_EMAIL then default. */
    NEXT_PUBLIC_SUPPORT_EMAIL: (
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      DEFAULT_PUBLIC_SUPPORT
    ).trim(),
  },
  turbopack: {},
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jgdev.org',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
