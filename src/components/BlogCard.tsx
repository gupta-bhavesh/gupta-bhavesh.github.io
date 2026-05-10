import { Link } from 'react-router-dom';
import type { PostMeta } from '../types';
import './BlogCard.css';

export default function BlogCard({ meta }: { meta: PostMeta }) {
  return (
    <Link to={`/blog/${meta.slug}`} className="blog-card">
      <div className="blog-card__head">
        <span className="blog-card__tag">{meta.tag}</span>
        <span className="blog-card__date">{meta.date}</span>
      </div>
      <h3 className="blog-card__title">{meta.title}</h3>
      <p className="blog-card__subtitle">{meta.subtitle}</p>
      <div className="blog-card__foot">
        <span>{meta.readingMinutes} min read</span>
        <span className="blog-card__cta">read →</span>
      </div>
    </Link>
  );
}
