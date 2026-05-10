import type { ReactNode } from 'react';
import './PostShell.css';

export default function PostShell({ children }: { children: ReactNode }) {
  return (
    <article className="post-shell">
      <div className="post-shell__container">{children}</div>
    </article>
  );
}
