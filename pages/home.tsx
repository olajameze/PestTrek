import Head from 'next/head';
import Link from 'next/link';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import LandingFooter from '../components/landing/LandingFooter';
import LandingNav from '../components/landing/LandingNav';
import SuggestionsSection from '../components/landing/SuggestionsSection';
import SocialProofSection from '../components/landing/SocialProofSection';
import ProductProofSection from '../components/landing/ProductProofSection';
import IcpSplitSection from '../components/landing/IcpSplitSection';
import ImpactCalculatorTeaser from '../components/landing/ImpactCalculatorTeaser';
import MarketingExploreGrid from '../components/landing/MarketingExploreGrid';
import RegulationUrgencySection from '../components/landing/RegulationUrgencySection';
import { heroCopy, bottomCtaCopy, trustMicrocopy } from '../components/landing/content';
import {
  buildLandingJsonLd,
  LANDING_KEYWORDS,
  LANDING_META_DESCRIPTION,
  LANDING_PAGE_TITLE,
  MARKETING_SITE_ORIGIN,
} from '../lib/seo/landing';
import { FadeIn } from '../components/landing/ProductVisual';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Head>
        <title>{LANDING_PAGE_TITLE}</title>
        <meta name="description" content={LANDING_META_DESCRIPTION} />
        <meta name="keywords" content={LANDING_KEYWORDS} />
        <link rel="canonical" href={MARKETING_SITE_ORIGIN} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={MARKETING_SITE_ORIGIN} />
        <meta property="og:title" content={LANDING_PAGE_TITLE} />
        <meta property="og:description" content={LANDING_META_DESCRIPTION} />
        <meta property="og:image" content={`${MARKETING_SITE_ORIGIN}/pest-trace.png`} />
        <meta property="og:site_name" content="PestTrace" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={LANDING_PAGE_TITLE} />
        <meta name="twitter:description" content={LANDING_META_DESCRIPTION} />
        <meta name="twitter:image" content={`${MARKETING_SITE_ORIGIN}/pest-trace.png`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildLandingJsonLd()),
          }}
        />
      </Head>

      <PWAInstallPrompt />
      <LandingNav />

      <FadeIn>
        <header className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <h1 className="mb-8 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl">
            {heroCopy.title}
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl md:text-2xl">
            {heroCopy.subtitle}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-emerald-200 transition-all hover:-translate-y-1 hover:bg-emerald-600 sm:px-10 sm:py-5 sm:text-xl"
            >
              {heroCopy.primaryCta}
            </Link>
            <Link
              href="/product"
              className="rounded-2xl bg-slate-50 px-6 py-4 text-lg font-bold text-slate-900 transition hover:bg-slate-100 sm:px-10 sm:py-5 sm:text-xl"
            >
              {heroCopy.secondaryCta}
            </Link>
          </div>
          <div className="mt-6 text-sm font-medium text-slate-500">
            ✔ 7-day free trial • ✔ No contracts • ✔ {heroCopy.priceHint}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-400 sm:gap-6">
            {trustMicrocopy.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span> {item}
              </span>
            ))}
          </div>
        </header>
      </FadeIn>

      <RegulationUrgencySection />

      <ProductProofSection />

      <MarketingExploreGrid />

      <section className="px-6 pb-8">
        <FadeIn>
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center sm:p-12">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              From stewardship rules to client-ready evidence
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
              Rodenticide stewardship and professional standards expect consistent, verifiable records. See exactly what
              PestTrace captures on each job and what goes into an audit pack export.
            </p>
            <Link
              href="/compliance"
              className="mt-8 inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Read compliance guide →
            </Link>
          </div>
        </FadeIn>
      </section>

      <SocialProofSection />

      <section className="px-6 py-24">
        <FadeIn>
          <div className="mx-auto max-w-5xl rounded-3xl bg-slate-900 p-8 text-center text-white sm:p-12">
            <h2 className="text-3xl font-extrabold sm:text-5xl">{bottomCtaCopy.title}</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">{bottomCtaCopy.subtitle}</p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/signup"
                className="rounded-2xl bg-emerald-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-emerald-600"
              >
                {bottomCtaCopy.primaryCta}
              </Link>
              <Link
                href="/contact"
                className="rounded-2xl bg-slate-100 px-8 py-4 text-lg font-bold text-slate-900 transition hover:bg-white"
              >
                {bottomCtaCopy.secondaryCta}
              </Link>
            </div>
            <p className="mt-8 text-xs font-bold tracking-[0.35em] text-emerald-300">VERIFY. RECORD. COMPLY.</p>
          </div>
        </FadeIn>
      </section>

      <IcpSplitSection />
      <ImpactCalculatorTeaser />
      <SuggestionsSection />
      <LandingFooter />
    </div>
  );
}
