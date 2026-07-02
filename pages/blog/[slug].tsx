import type { GetStaticPaths, GetStaticProps } from 'next';
import ArticleLayout from '../../components/blog/ArticleLayout';
import { getAllBlogSlugs, getBlogPostBySlug } from '../../lib/blog/posts';
import type { BlogPost } from '../../lib/blog/types';

type BlogPostPageProps = {
  post: BlogPost;
};

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getAllBlogSlugs().map((slug) => ({ params: { slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<BlogPostPageProps> = async ({ params }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const post = getBlogPostBySlug(slug);
  if (!post) {
    return { notFound: true };
  }
  return { props: { post } };
};

export default function BlogPostPage({ post }: BlogPostPageProps) {
  return <ArticleLayout post={post} />;
}
