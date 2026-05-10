import { Link } from 'react-router-dom';
import { getSortedPosts } from '../posts';
import BlogCard from '../components/BlogCard';
import './HomePage.css';

export default function HomePage() {
  const recent = getSortedPosts().slice(0, 3);
  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__tag">AI Engineer · ML · Agentic AI</div>
          <h1 className="home-hero__title">
            Bhavesh <em>Gupta</em>
          </h1>
          <p className="home-hero__lede">
            Notes, deep dives, and visual explainers on the systems behind modern
            AI — transformers, GPUs, retrieval, agents.
          </p>
          <div className="home-hero__actions">
            <Link to="/blog" className="btn btn--primary">
              read the blog
            </Link>
            <Link to="/visuals" className="btn">
              explore visuals
            </Link>
          </div>
        </div>
      </section>

      <section className="home-recent">
        <div className="home-recent__head">
          <span className="home-recent__label">§ Recent writing</span>
          <Link to="/blog" className="home-recent__all">
            all posts →
          </Link>
        </div>
        <div className="home-recent__grid">
          {recent.map((p) => (
            <BlogCard key={p.meta.slug} meta={p.meta} />
          ))}
        </div>
      </section>
    </div>
  );
}
