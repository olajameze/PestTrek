import Image from 'next/image';
import { testimonials } from './content';
import { marketingStats, trustHighlights } from '../../lib/marketing/socialProof';
import { FadeIn } from './ProductVisual';

export default function SocialProofSection() {
  const visibleStats = marketingStats.filter((stat) => stat.enabled && stat.value);
  const testimonial = testimonials[0];

  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {visibleStats.length > 0 ? (
          <div className="mb-14 grid gap-4 sm:grid-cols-3">
            {visibleStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm"
              >
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <FadeIn>
          <figure className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14">
            <a
              href="https://weatherspestsolutions.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200"
            >
              <Image
                src={testimonial.logo}
                alt={testimonial.company}
                width={140}
                height={50}
                className="h-12 w-auto object-contain"
              />
            </a>
            <div>
              <blockquote className="text-xl font-medium leading-relaxed text-slate-800 sm:text-2xl">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{testimonial.author}</span>
                <span className="mx-2 text-slate-300">·</span>
                {testimonial.role}
              </figcaption>
            </div>
          </figure>
        </FadeIn>

        <ul className="mx-auto mt-12 flex max-w-3xl flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
          {trustHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
