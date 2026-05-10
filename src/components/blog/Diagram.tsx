import type { ReactNode } from 'react';
import './Diagram.css';

interface Props {
  title?: string;
  children: ReactNode;
}

export default function Diagram({ title, children }: Props) {
  return (
    <div className="diagram">
      {title && <div className="diagram__title">{title}</div>}
      <div className="diagram__body">{children}</div>
    </div>
  );
}
