import Link from 'next/link';
import Image from 'next/image';
import MarketingPageShell from '../components/landing/MarketingPageShell';
import {
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_TITLE,
  aboutCredentials,
  aboutCta,
  aboutHero,
  aboutStory,
  aboutValues,
} from '../lib/marketing/aboutCopy';
import { getClientSupportEmail } from '../lib/supportEmail';

export default function AboutPage() {
  const supportEmail = getClientSupportEmail();

  return (
    <MarketingPageShell
      title={`${ABOUT_PAGE_TITLE} — PestTrace`}
      description={ABOUT_PAGE_DESCRIPTION}
      canonicalPath="/about"
    >
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{aboutHero.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl">{aboutHero.subtitle}</p>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">{aboutStory.title}</h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600">
            {aboutStory.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {aboutValues.map((value) => (
            <article key={value.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">{value.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{value.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900">{aboutCredentials.title}</h2>
          <dl className="mt-6 space-y-4">
            {aboutCredentials.items.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <dt className="text-xs font-bold uppercase tracking-widest text-emerald-600">{item.label}</dt>
                <dd className="mt-2 text-sm font-medium text-slate-800">
                  {'href' in item && item.href ? (
                    <Link href={item.href} className="text-emerald-700 hover:text-emerald-800">
                      {item.value}
                    </Link>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-slate-500">
            Questions? Email{' '}
            <a href={`mailto:${supportEmail}`} className="font-semibold text-emerald-700">
              {supportEmail}
            </a>
            .
          </p>
        </section>

        <section className="mt-16 rounded-3xl bg-slate-900 p-8 text-center text-white sm:p-10">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{aboutCta.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">{aboutCta.body}</p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              {aboutCta.primary}
            </Link>
            <Link
              href={aboutCta.secondaryHref}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              {aboutCta.secondary}
            </Link>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6">
          <Image src="/weathers-logo.png" alt="Weathers' Pest Solutions" width={120} height={44} className="h-10 w-auto object-contain" />
          <p className="max-w-md text-sm text-slate-600">
            Early operator feedback from Weathers&apos; Pest Solutions helped shape field workflows and export formats.
          </p>
        </div>
      </div>
    </MarketingPageShell>
  );
}
