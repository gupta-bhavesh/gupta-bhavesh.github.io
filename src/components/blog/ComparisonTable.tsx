import type { ReactNode } from 'react';
import './ComparisonTable.css';

type Cell = ReactNode | { value: ReactNode; tone?: 'good' | 'bad' | 'neutral' };

interface Props {
  headers: string[];
  rows: Cell[][];
}

function renderCell(cell: Cell, key: number) {
  if (cell !== null && typeof cell === 'object' && !Array.isArray(cell) && 'value' in (cell as Record<string, unknown>)) {
    const c = cell as { value: ReactNode; tone?: 'good' | 'bad' | 'neutral' };
    const cls = c.tone && c.tone !== 'neutral' ? `cell--${c.tone}` : '';
    return (
      <td key={key} className={cls}>
        {c.value}
      </td>
    );
  }
  return <td key={key}>{cell as ReactNode}</td>;
}

export default function ComparisonTable({ headers, rows }: Props) {
  return (
    <div className="table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => renderCell(cell, ci))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
