import type { ReactNode } from 'react';
import './CodeBlock.css';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'plain';
}

export default function CodeBlock({ children, variant = 'default' }: Props) {
  return <pre className={`code-block code-block--${variant}`}>{children}</pre>;
}

export const Tok = {
  c: (t: ReactNode) => <span className="tok-c">{t}</span>,
  k: (t: ReactNode) => <span className="tok-k">{t}</span>,
  v: (t: ReactNode) => <span className="tok-v">{t}</span>,
  n: (t: ReactNode) => <span className="tok-n">{t}</span>,
  h: (t: ReactNode) => <span className="tok-h">{t}</span>,
  r: (t: ReactNode) => <span className="tok-r">{t}</span>,
  b: (t: ReactNode) => <span className="tok-b">{t}</span>,
};
