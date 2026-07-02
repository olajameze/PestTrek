import { MARKETING_SITE_ORIGIN } from './landing';

export const BLOG_INDEX_TITLE = 'PestTrace Blog — Pest Control Compliance & Operations';
export const BLOG_INDEX_DESCRIPTION =
  'Guides on pest control compliance, audit preparation, digital logbooks, and reducing admin for pest control businesses.';

export function blogPostTitle(postTitle: string): string {
  return `${postTitle} | PestTrace Blog`;
}

export function blogPostCanonical(slug: string): string {
  return `${MARKETING_SITE_ORIGIN}/blog/${slug}`;
}

export function blogIndexCanonical(): string {
  return `${MARKETING_SITE_ORIGIN}/blog`;
}
