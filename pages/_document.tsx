import { Html, Head, Main, NextScript } from 'next/document';
import { getWebManifestLinkHref } from '../lib/siteOrigin';

const UMAMI_SCRIPT_URL = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? 'fa32c121-cb14-4b86-a3bd-0ab1bfd6bfca';

export default function Document() {
  return (
    <Html lang="en" data-scroll-behavior="smooth">
      <Head>
        {/* PWA & App Meta Tags */}
        <meta name="description" content="Digital compliance logbook for pest control businesses" />
        <meta name="theme-color" content="#2563EB" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Web App Manifest: canonical origin avoids 401 on Vercel preview (Deployment Protection). */}
        <link rel="manifest" href={getWebManifestLinkHref()} />
        <link rel="canonical" href="https://www.pesttrace.com" />
        <meta property="og:url" content="https://www.pesttrace.com" />
        <meta property="og:site_name" content="PestTrace" />
        <meta name="twitter:url" content="https://www.pesttrace.com" />

        {/* Apple iOS PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pest Trace" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Standard Favicons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* PWA Icons */}
        <link rel="icon" type="image/png" sizes="192x192 512x512" href="/pest-trace.png" />

        {/* Fonts - handled by next/font/google in _app.tsx */}

        {/* Umami Analytics (privacy-friendly page views) */}
        {process.env.NODE_ENV === 'production' && UMAMI_WEBSITE_ID ? (
          <script defer src={UMAMI_SCRIPT_URL} data-website-id={UMAMI_WEBSITE_ID} />
        ) : null}

        {/* Keep startup assets minimal to avoid broken links in production */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

