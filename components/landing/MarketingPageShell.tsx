import Head from 'next/head';
import type { ReactNode } from 'react';
import LandingFooter from './LandingFooter';
import LandingNav from './LandingNav';
import { MARKETING_SITE_ORIGIN } from '../../lib/seo/landing';

type MarketingPageShellProps = {
  title: string;
  description: string;
  canonicalPath: string;
  children: ReactNode;
};

export default function MarketingPageShell({
  title,
  description,
  canonicalPath,
  children,
}: MarketingPageShellProps) {
  const canonical = `${MARKETING_SITE_ORIGIN}${canonicalPath}`;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${MARKETING_SITE_ORIGIN}/pest-trace.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Head>

      <LandingNav />

      <main>{children}</main>

      <LandingFooter />
    </div>
  );
}
