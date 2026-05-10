import type { ReactNode } from 'react';
import './StatCard.css';

interface StatCardProps {
  value: ReactNode;
  label: ReactNode;
  color?: string;
}

export function StatCard({ value, label, color }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}
