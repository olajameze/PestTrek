import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
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
        <header className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
          <div>
            <p className="mb-4 text-sm font-semibold text-emerald-600">Compliance logbook for pest control</p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              {heroCopy.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">{heroCopy.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/signup"
                className="inline-flex justify-center rounded-xl bg-emerald-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-600"
              >
                {heroCopy.primaryCta}
              </Link>
              <Link
                href="/product"
                className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {heroCopy.secondaryCta}
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              {heroCopy.priceHint}. Cancel anytime.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
              {trustMicrocopy.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
              <Image
                src="/marketing/treatment-logbook.png"
                alt="PestTrace treatment logbook on a job record"
                width={720}
                height={540}
                priority
                className="h-auto w-full rounded-xl"
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">Real product screen from a live logbook export.</p>
          </div>
        </header>
      </FadeIn>

      <RegulationUrgencySection />

      <ProductProofSection />

      <MarketingExploreGrid />

      <section className="px-6 pb-4">
        <FadeIn>
          <div className="mx-auto max-w-6xl rounded-2xl bg-slate-900 px-8 py-10 text-white sm:px-12 sm:py-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">What goes into an audit pack?</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                Rodenticide stewardship and professional standards expect consistent records. Our compliance guide walks
                through what PestTrace captures on each job and what lands in an export.
              </p>
              <Link
                href="/compliance"
                className="mt-6 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Read the compliance guide
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      <SocialProofSection />

      <section className="px-6 py-16 sm:py-20">
        <FadeIn>
          <div className="mx-auto max-w-6xl border-y border-slate-200 py-12 sm:py-16">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">{bottomCtaCopy.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-600">{bottomCtaCopy.subtitle}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link
                  href="/auth/signup"
                  className="inline-flex justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-600"
                >
                  {bottomCtaCopy.primaryCta}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex justify-center rounded-xl border border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  {bottomCtaCopy.secondaryCta}
                </Link>
              </div>
            </div>
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
