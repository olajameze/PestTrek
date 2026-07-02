import Link from 'next/link';
import type { BlogPost } from '../../lib/blog/types';

type BlogPostCardProps = {
  post: BlogPost;
};

export default function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200">
      <time dateTime={post.publishedAt} className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {new Date(post.publishedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </time>
      <h2 className="mt-3 text-xl font-bold text-slate-900">
        <Link href={`/blog/${post.slug}`} className="hover:text-emerald-600">
          {post.title}
        </Link>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{post.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href={`/blog/${post.slug}`}
        className="mt-5 inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
      >
        Read article →
      </Link>
    </article>
  );
}
