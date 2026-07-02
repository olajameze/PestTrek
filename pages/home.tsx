import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import type { GetServerSideProps } from 'next';
import { motion } from 'framer-motion';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import LandingFooter from '../components/landing/LandingFooter';
import SuggestionsSection from '../components/landing/SuggestionsSection';
import LandingFAQ from '../components/landing/LandingFAQ';
import SocialProofSection from '../components/landing/SocialProofSection';
import ProductProofSection from '../components/landing/ProductProofSection';
import IcpSplitSection from '../components/landing/IcpSplitSection';
import {
  featureCards,
  pricingPlans,
  trustMicrocopy,
  regulationUrgency,
  teamRoleHighlights,
  heroCopy,
  bottomCtaCopy,
} from '../components/landing/content';
import {
  buildLandingJsonLd,
  LANDING_KEYWORDS,
  LANDING_META_DESCRIPTION,
  LANDING_PAGE_TITLE,
  MARKETING_SITE_ORIGIN,
} from '../lib/seo/landing';
import { PRICING_TRIAL_FOOTNOTE } from '../lib/marketingPlanFeatures';
import { buildLandingPricingFromRequest, type LandingPricingProps } from '../lib/geoCurrency';

export const getServerSideProps: GetServerSideProps<LandingPricingProps> = async ({ req }) => ({
  props: buildLandingPricingFromRequest(req.headers),
});

// --- Animation Helpers ---
const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay }}
  >
    {children}
  </motion.div>
);

// --- Visual Mockup Components ---
const ProductVisual = ({ type }: { type: string }) => {
  if (type === 'mobile-app-ui') {
    return (
      <div className="relative w-64 h-[450px] bg-slate-900 rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-10" />
        <div className="p-4 pt-10 bg-white h-full">
          <div className="h-3 w-20 bg-slate-100 rounded mb-4" />
          {[1, 2, 3].map(i => (
            <div key={i} className="p-3 border border-slate-100 rounded-xl mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-600 rounded-full" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full bg-slate-100 rounded" />
                <div className="h-1.5 w-2/3 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
          <div className="absolute bottom-4 left-4 right-4 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">
            Capture Job Details
          </div>
        </div>
      </div>
    );
  }

  if (type === 'dashboard-view') {
    return (
      <div className="w-full aspect-video bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex">
        <div className="w-16 bg-slate-50 border-r border-slate-100 p-2 space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="w-full aspect-square bg-slate-200 rounded-lg" />)}
        </div>
        <div className="flex-1 p-4">
          <div className="flex justify-between mb-6">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-emerald-100 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 border border-slate-100 rounded-lg" />)}
          </div>
          <div className="h-32 bg-slate-50 border border-slate-100 rounded-lg relative overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-emerald-500/10 flex items-end px-2 gap-1">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-emerald-500 rounded-t-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'report-preview') {
    return (
      <div className="w-full aspect-[1/1.2] bg-white rounded-lg border border-slate-200 shadow-lg p-8 max-w-sm mx-auto">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-center">
          <div className="font-bold text-xs uppercase tracking-widest text-slate-400">Compliance Report</div>
          <div className="h-6 w-6 bg-emerald-500 rounded" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-2 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
          </div>
          <div className="h-24 w-full border border-dashed border-slate-200 rounded-lg flex items-center justify-center italic text-slate-300 text-xs">Photo Evidence</div>
          <div className="pt-8 border-t border-slate-100">
            <div className="h-10 w-32 bg-slate-50 rounded border border-slate-100 flex items-end p-2">
               <div className="w-full h-px bg-slate-300" />
            </div>
            <div className="text-[10px] text-slate-400 mt-2">Technician Signature</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function Home({ pricingGbpLabels, pricingApproxLabels, pricingFxNote }: LandingPricingProps) {
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

      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="/pest-trace.png" 
            alt="PestTrace Logo" 
            width={40} 
            height={40} 
            priority
            className="w-10 h-10 object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Pest<span className="text-emerald-600">Trace</span>
          </span>
        </Link>
        <div className="hidden md:flex space-x-10 font-medium text-slate-500">
          <a href="#features" className="hover:text-slate-900 transition">Features</a>
          <a href="#product-proof" className="hover:text-slate-900 transition">Product</a>
          <a href="#teams" className="hover:text-slate-900 transition">For your team</a>
          <Link href="/blog" className="hover:text-slate-900 transition">Blog</Link>
          <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
          <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
        </div>
        <div className="ml-auto flex w-full max-w-full flex-col items-stretch gap-1.5 sm:w-auto sm:max-w-none sm:items-end">
          <div className="flex w-full flex-wrap justify-end gap-2 sm:flex-nowrap">
            <Link
              href="/auth/signin?role=admin"
              title="Company owners and admins: sign in with email and password to manage the full dashboard."
              className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
            >
              Business Login
            </Link>
            <Link
              href="/auth/signin?role=technician"
              title="Field technicians: sign in with a one-time code emailed to you (no shared company password)."
              className="bg-slate-100 text-slate-900 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-200 transition"
            >
              Technician Login
            </Link>
          </div>
          <p className="hidden max-w-[min(100%,20rem)] text-balance text-right text-[11px] leading-snug text-slate-500 sm:block">
            <span className="font-semibold text-slate-600">Business</span> — owner or office admin, email + password.
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="font-semibold text-slate-600">Technician</span> — invited field staff, one-time email code.
          </p>
          <p className="w-full max-w-[min(100%,20rem)] self-center px-1 text-center text-[11px] leading-snug text-balance text-slate-500 break-words sm:hidden">
            <span className="font-semibold text-slate-600">Business</span>: email + password.
            {' '}
            <span className="font-semibold text-slate-600">Technician</span>: one-time email code.
          </p>
        </div>
      </nav>

      {/* Hero Section */}
      <FadeIn>
        <header className="mx-auto max-w-5xl px-4 pb-24 pt-20 text-center sm:px-6">
          <h1 className="mb-8 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl xl:text-8xl">
            {heroCopy.title}
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl md:text-2xl">
            {heroCopy.subtitle}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/auth/signup" className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-emerald-200 transition-all hover:-translate-y-1 hover:bg-emerald-600 sm:px-10 sm:py-5 sm:text-xl">
              {heroCopy.primaryCta}
            </Link>
            <a href="#product-proof" className="rounded-2xl bg-slate-50 px-6 py-4 text-lg font-bold text-slate-900 transition hover:bg-slate-100 sm:px-10 sm:py-5 sm:text-xl">
              {heroCopy.secondaryCta}
            </a>
          </div>
          <div className="mt-6 text-sm font-medium text-slate-500">
            ✔ 7-day free trial • ✔ No contracts • ✔ {heroCopy.priceHint}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-400 sm:gap-6">
            {trustMicrocopy.map(item => <span key={item} className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {item}</span>)}
          </div>
        </header>
      </FadeIn>

      {/* Urgency Section */}
      <section className="bg-amber-50 border-y border-amber-100 py-16 px-6">
        <FadeIn>
          <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-extrabold text-amber-900 mb-4">{regulationUrgency.title}</h2>
              {regulationUrgency.body.split('\n\n').map((paragraph) => (
                <p key={paragraph} className="mb-4 text-lg text-amber-800 leading-relaxed opacity-90">
                  {paragraph}
                </p>
              ))}
          </div>
        </FadeIn>
      </section>

      <ProductProofSection />

      {/* Business vs technician */}
      <section id="teams" className="border-y border-slate-100 bg-slate-50 py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-3xl font-extrabold sm:text-5xl">Built for owners and field teams</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-500">
                One platform with the right access for each role — secure sign-in, guided technician onboarding, and a
                single source of truth for compliance.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {teamRoleHighlights.map((block) => (
                <article
                  key={block.role}
                  className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{block.audience}</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{block.role}</h3>
                  <ul className="mt-6 space-y-3 text-slate-600">
                    {block.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span className="text-emerald-500">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={block.cta.href}
                    className="mt-8 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {block.cta.label}
                  </Link>
                </article>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features (Alternating Layout) */}
      <section id="features" className="py-32 px-6 space-y-40 max-w-7xl mx-auto">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-extrabold sm:text-5xl">Everything you need to stay compliant and in control</h2>
        </div>
        {featureCards.map((feature, idx) => (
          <div key={feature.title} className={`flex flex-col md:flex-row items-center gap-16 ${idx % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1">
              <FadeIn>
                <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{feature.title}</h2>
                <p className="text-lg leading-relaxed text-slate-500 sm:text-xl">{feature.body}</p>
              </FadeIn>
            </div>
            <div className="flex-1 w-full">
              <FadeIn delay={0.2}>
                {'screenshots' in feature && feature.screenshots?.length ? (
                  <div className="space-y-4">
                    {feature.screenshots.map((shot) => (
                      <Image
                        key={shot.src}
                        src={shot.src}
                        alt={shot.alt}
                        width={1200}
                        height={750}
                        className="w-full rounded-xl border border-slate-200 shadow-xl"
                      />
                    ))}
                  </div>
                ) : (
                  <ProductVisual type={feature.visual} />
                )}
              </FadeIn>
            </div>
          </div>
        ))}
      </section>

      <section className="px-6 pb-24">
        <FadeIn>
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center sm:p-12">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">From stewardship rules to client-ready evidence</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
              Rodenticide stewardship and professional standards expect consistent, verifiable records. PestTrace keeps treatments, proof, and qualifications aligned — so you are organised in the van and credible in the audit or tender.
            </p>
          </div>
        </FadeIn>
      </section>

      <SocialProofSection />

      <section className="px-6 py-24">
        <FadeIn>
          <div className="mx-auto max-w-5xl rounded-3xl bg-slate-900 p-8 text-center text-white sm:p-12">
            <h2 className="text-3xl font-extrabold sm:text-5xl">{bottomCtaCopy.title}</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">
              {bottomCtaCopy.subtitle}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/auth/signup" className="rounded-2xl bg-emerald-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-emerald-600">
                {bottomCtaCopy.primaryCta}
              </Link>
              <Link href="/contact" className="rounded-2xl bg-slate-100 px-8 py-4 text-lg font-bold text-slate-900 transition hover:bg-white">
                {bottomCtaCopy.secondaryCta}
              </Link>
            </div>
            <p className="mt-8 text-xs font-bold tracking-[0.35em] text-emerald-300">VERIFY. RECORD. COMPLY.</p>
          </div>
        </FadeIn>
      </section>

      <IcpSplitSection />

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="mb-4 text-3xl font-extrabold sm:text-5xl">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-500 sm:text-xl">Choose a plan that fits your business and scale as you grow. All plans include a 7-day free trial — no contracts, no risk.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, idx) => (
              <FadeIn key={plan.name} delay={plan.isPopular ? 0.1 : 0}>
                <div className={`h-full rounded-[2rem] border bg-white p-6 sm:p-10 ${plan.isPopular ? 'relative border-emerald-500 ring-4 ring-emerald-500/5' : 'border-slate-200'}`}>
                  {plan.isPopular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide">MOST POPULAR</span>}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="mb-4 text-sm font-medium leading-relaxed text-slate-500">{plan.bestFor}</p>
                  <div className="mb-6">
                    <div>
                      <span className="text-4xl font-black sm:text-5xl">
                        {pricingGbpLabels[idx] ?? `£${plan.price}`}
                      </span>
                      <span className="text-slate-400 text-sm">{plan.cadence}</span>
                    </div>
                    {pricingApproxLabels[idx] ? (
                      <p className="mt-1 text-sm font-medium text-slate-400">{pricingApproxLabels[idx]}</p>
                    ) : null}
                  </div>
                  <Link
                    href={plan.href}
                    className={`block text-center py-4 rounded-xl font-bold mb-8 transition ${plan.isPopular ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                  >
                    {plan.cta}
                  </Link>
                  <ul className="space-y-3 text-slate-600 text-sm font-medium">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-3 items-start">
                        <span className="text-emerald-500 text-base shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
          <p className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-slate-500">
            {PRICING_TRIAL_FOOTNOTE}
            {pricingFxNote ? ` ${pricingFxNote}` : ''}
          </p>
        </div>
      </section>

      <LandingFAQ />

      <SuggestionsSection />

      <LandingFooter />
    </div>
  );
}