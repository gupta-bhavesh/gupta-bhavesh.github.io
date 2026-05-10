import type { ReactNode } from 'react';
import './Improvement.css';

interface Props {
  variant?: 1 | 2 | 3;
  number: string;
  title: string;
  children: ReactNode;
}

export default function Improvement({ variant = 1, number, title, children }: Props) {
  return (
    <div className={`improvement improvement--v${variant}`}>
      <div className="improvement__number">{number}</div>
      <div className="improvement__title">{title}</div>
      <div className="improvement__body">{children}</div>
    </div>
  );
}
