import type { ReactNode } from 'react';
import './BlogHero.css';

interface Props {
  tag: string;
  title: ReactNode;
  subtitle: string;
  meta?: { label: string; value: string }[];
}

export default function BlogHero({ tag, title, subtitle, meta }: Props) {
  return (
    <header className="blog-hero">
      <div className="blog-hero__inner">
        <div className="blog-hero__tag">{tag}</div>
        <h1 className="blog-hero__title">{title}</h1>
        <p className="blog-hero__subtitle">{subtitle}</p>
        {meta && meta.length > 0 && (
          <div className="blog-hero__meta">
            {meta.map((item) => (
              <div key={item.label}>
                {item.label} · <span>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
