import { useParams, Link } from 'react-router-dom';
import { getPostBySlug } from '../posts';
import NotFoundPage from './NotFoundPage';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  if (!post) return <NotFoundPage />;
  const { Component } = post;
  return (
    <>
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto', padding: '32px 40px 0' }}>
        <Link
          to="/blog"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text3)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ← all posts
        </Link>
      </div>
      <Component />
    </>
  );
}
