import Image from 'next/image';
import { testimonials } from './content';
import { marketingStats, trustHighlights } from '../../lib/marketing/socialProof';

export default function SocialProofSection() {
  const visibleStats = marketingStats.filter((stat) => stat.enabled && stat.value);

  return (
    <section className="py-24 px-6">
      <div className="text-center mb-12">
        <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest">
          Trusted by pest control professionals
        </h2>
      </div>

      {visibleStats.length > 0 ? (
        <div className="mx-auto mb-12 grid max-w-4xl gap-4 sm:grid-cols-3">
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

      <div className="max-w-3xl mx-auto bg-slate-900 rounded-[2.5rem] p-10 md:p-14 text-center text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
        <blockquote className="text-base md:text-lg font-normal mb-8 leading-relaxed italic text-slate-300">
          &ldquo;{testimonials[0].quote}&rdquo;
        </blockquote>
        <div className="flex flex-col items-center justify-center gap-6">
          <a
            href="https://weatherspestsolutions.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-transform bg-white p-3 rounded-2xl shadow-lg"
          >
            <Image
              src={testimonials[0].logo}
              alt={testimonials[0].company}
              width={140}
              height={50}
              className="h-10 w-auto object-contain"
            />
          </a>
          <div className="text-center space-y-1">
            <div className="font-semibold text-white tracking-tight">{testimonials[0].author}</div>
            <div className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em]">
              {testimonials[0].role}
            </div>
          </div>
        </div>
      </div>

      <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
        {trustHighlights.map((item) => (
          <li key={item} className="flex items-center gap-1.5">
            <span className="text-emerald-500">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
