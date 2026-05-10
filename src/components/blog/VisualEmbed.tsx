import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import './VisualEmbed.css';

interface Props {
  to: string;
  label?: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export default function VisualEmbed({
  to,
  label = 'Interactive Visual',
  title,
  description,
  children,
}: Props) {
  return (
    <aside className="visual-embed">
      <div className="visual-embed__head">
        <span className="visual-embed__label">{label}</span>
        <Link className="visual-embed__open" to={to}>
          open full screen ↗
        </Link>
      </div>
      <h4 className="visual-embed__title">{title}</h4>
      <p className="visual-embed__desc">{description}</p>
      {children && <div className="visual-embed__inline">{children}</div>}
    </aside>
  );
}
