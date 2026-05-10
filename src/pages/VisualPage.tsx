import { useParams, Link } from 'react-router-dom';
import { getVisualBySlug } from '../visuals';
import NotFoundPage from './NotFoundPage';
import './VisualPage.css';

export default function VisualPage() {
  const { slug } = useParams<{ slug: string }>();
  const visual = slug ? getVisualBySlug(slug) : undefined;
  if (!visual) return <NotFoundPage />;
  const { Component, meta } = visual;
  return (
    <div className="visual-page">
      <div className="visual-page__head">
        <Link to="/visuals" className="visual-page__back">
          ← all visuals
        </Link>
        <div className="visual-page__label">interactive</div>
        <h1 className="visual-page__title">{meta.title}</h1>
        <p className="visual-page__desc">{meta.description}</p>
        {meta.relatedPostSlug && (
          <Link to={`/blog/${meta.relatedPostSlug}`} className="visual-page__related">
            ↳ from the blog post
          </Link>
        )}
      </div>
      <div className="visual-page__stage">
        <Component />
      </div>
    </div>
  );
}
