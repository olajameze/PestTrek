import type { BlogPost } from './types';

export const blogPosts: BlogPost[] = [
  {
    slug: 'prepare-for-pest-control-compliance-audit',
    title: 'How to prepare for a pest control compliance audit',
    description:
      'A practical checklist for pest control businesses getting audit-ready — from job records and photo evidence to certification tracking.',
    publishedAt: '2026-03-15',
    author: 'PestTrace Team',
    tags: ['compliance', 'audits', 'record-keeping'],
    body: [
      'Regulatory audits and client tenders increasingly expect verifiable, consistent records for every treatment visit. Paper logbooks and ad-hoc spreadsheets make that hard to prove under pressure.',
      'Start by mapping what an auditor typically asks for: job history by site, treatment details, follow-up actions, technician proof, and chemical usage where applicable. If any of those live in different places, you already have a compliance gap.',
      'Digital logbooks like PestTrace keep field records, photos, e-signatures, and exports in one system. Technicians log on site; owners can filter and export audit packs without rebuilding folders the night before an inspection.',
      'Before your next audit window, run a dry run: pick three recent jobs and produce a complete evidence pack in under 30 minutes. If you cannot, your process — not your team — needs fixing.',
      'PestTrace offers a 7-day free trial so you can test audit exports with your real workflow before committing.',
    ],
  },
  {
    slug: 'digital-logbooks-vs-paper-rodenticide-stewardship',
    title: 'Digital logbooks vs paper records for rodenticide stewardship',
    description:
      'Why scattered paper records create compliance risk — and how structured digital logs help pest control businesses meet stewardship expectations.',
    publishedAt: '2026-03-01',
    author: 'PestTrace Team',
    tags: ['rodenticide stewardship', 'compliance', 'operations'],
    body: [
      'Rodenticide stewardship regimes expect pest control professionals to maintain accurate, retrievable records of bait use, site assessments, and follow-ups. Paper logs are easy to lose, hard to search, and painful to assemble for a spot check.',
      'The operational cost shows up in admin hours: office staff chasing technicians for missing entries, retyping notes into reports, and duplicating data across spreadsheets and email threads.',
      'A digital compliance logbook standardises what gets captured in the field — treatments, photos, signatures, room-level notes — and makes it visible to owners immediately. That reduces both compliance risk and technician admin time.',
      'For owner-operators, the win is speed: one record system from van to client report. For growing teams, the win is visibility: every job logged, every gap flagged, every export ready for audit or tender.',
      'Moving from paper does not require a long rollout. Most PestTrace customers start with one technician and one job type, then expand once the field workflow is proven.',
    ],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((post) => post.slug);
}
