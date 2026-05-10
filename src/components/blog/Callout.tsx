import type { ReactNode } from 'react';
import './Callout.css';

type Variant = 'insight' | 'warning' | 'success';

interface Props {
  variant?: Variant;
  label: string;
  children: ReactNode;
}

export default function Callout({ variant = 'insight', label, children }: Props) {
  return (
    <div className={`callout callout--${variant}`}>
      <div className="callout__label">{label}</div>
      <div className="callout__body">{children}</div>
    </div>
  );
}
