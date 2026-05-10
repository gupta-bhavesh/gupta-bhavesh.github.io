import { getSortedPosts } from '../posts';
import BlogCard from '../components/BlogCard';
import './BlogIndexPage.css';

export default function BlogIndexPage() {
  const posts = getSortedPosts();
  return (
    <div className="blog-index">
      <header className="blog-index__head">
        <div className="blog-index__label">§ The Blog</div>
        <h1 className="blog-index__title">Writing</h1>
        <p className="blog-index__lede">
          Long-form notes on ML systems, transformer internals, and the hardware
          that makes them go.
        </p>
      </header>
      <div className="blog-index__list">
        {posts.map((p) => (
          <BlogCard key={p.meta.slug} meta={p.meta} />
        ))}
      </div>
    </div>
  );
}
