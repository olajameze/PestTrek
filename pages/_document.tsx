import { Html, Head, Main, NextScript } from 'next/document';
import { getWebManifestLinkHref } from '../lib/siteOrigin';

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? 'xekb1rp4c9';

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

        {/* Microsoft Clarity (session recordings & heatmaps) */}
        {process.env.NODE_ENV === 'production' && CLARITY_PROJECT_ID ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_PROJECT_ID}");`,
            }}
          />
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

