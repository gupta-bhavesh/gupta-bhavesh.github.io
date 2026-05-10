import type { ReactNode } from 'react';
import './Section.css';

interface Props {
  label: string;
  title: ReactNode;
  children: ReactNode;
}

export default function Section({ label, title, children }: Props) {
  return (
    <section className="blog-section">
      <div className="blog-section__label">{label}</div>
      <h2 className="blog-section__title">{title}</h2>
      {children}
    </section>
  );
}
