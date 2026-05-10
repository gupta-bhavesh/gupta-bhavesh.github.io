import type { ReactNode } from 'react';
import './MathBlock.css';

export default function MathBlock({ children }: { children: ReactNode }) {
  return <div className="math-block">{children}</div>;
}
