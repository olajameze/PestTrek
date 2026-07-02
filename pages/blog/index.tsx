import Head from 'next/head';
import Link from 'next/link';
import BlogPostCard from '../../components/blog/BlogPostCard';
import LandingFooter from '../../components/landing/LandingFooter';
import { blogPosts } from '../../lib/blog/posts';
import { BLOG_INDEX_DESCRIPTION, BLOG_INDEX_TITLE, blogIndexCanonical } from '../../lib/seo/blog';

export default function BlogIndexPage() {
  const sorted = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <>
      <Head>
        <title>{BLOG_INDEX_TITLE}</title>
        <meta name="description" content={BLOG_INDEX_DESCRIPTION} />
        <link rel="canonical" href={blogIndexCanonical()} />
        <meta property="og:title" content={BLOG_INDEX_TITLE} />
        <meta property="og:description" content={BLOG_INDEX_DESCRIPTION} />
        <meta property="og:url" content={blogIndexCanonical()} />
      </Head>

      <div className="min-h-screen bg-white font-sans text-slate-900">
        <header className="border-b border-slate-100">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
            <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              ← PestTrace home
            </Link>
            <Link href="/auth/signup" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Start Free Trial
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">PestTrace Blog</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">{BLOG_INDEX_DESCRIPTION}</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {sorted.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
