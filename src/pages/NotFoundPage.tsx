import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div
      style={{
        maxWidth: 'var(--container)',
        margin: '0 auto',
        padding: '120px 40px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          marginBottom: 18,
        }}
      >
        404
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(40px, 7vw, 72px)',
          lineHeight: 1.05,
          color: 'var(--text)',
          margin: '0 0 24px',
        }}
      >
        Nothing here.
      </h1>
      <Link
        to="/"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        ← go home
      </Link>
    </div>
  );
}
