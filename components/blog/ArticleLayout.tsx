import Head from 'next/head';
import Link from 'next/link';
import type { BlogPost } from '../../lib/blog/types';
import { blogPostCanonical, blogPostTitle } from '../../lib/seo/blog';
import LandingFooter from '../landing/LandingFooter';

type ArticleLayoutProps = {
  post: BlogPost;
};

export default function ArticleLayout({ post }: ArticleLayoutProps) {
  const canonical = blogPostCanonical(post.slug);

  return (
    <>
      <Head>
        <title>{blogPostTitle(post.title)}</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:url" content={canonical} />
      </Head>

      <div className="min-h-screen bg-white font-sans text-slate-900">
        <header className="border-b border-slate-100 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
            <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              ← PestTrace home
            </Link>
            <Link href="/blog" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              All articles
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <article>
            <time dateTime={post.publishedAt} className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {new Date(post.publishedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{post.description}</p>
            <p className="mt-2 text-sm text-slate-500">By {post.author}</p>

            <div className="prose prose-slate mt-10 max-w-none">
              {post.body.map((paragraph, index) => (
                <p key={index} className="mb-5 text-base leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="font-semibold text-slate-900">Ready to simplify compliance?</p>
              <p className="mt-2 text-sm text-slate-600">
                Start a 7-day free trial or{' '}
                <Link href="/#pricing" className="font-semibold text-emerald-600 hover:text-emerald-700">
                  compare plans
                </Link>
                .
              </p>
              <Link
                href="/auth/signup"
                className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                Start Free Trial
              </Link>
            </div>
          </article>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
