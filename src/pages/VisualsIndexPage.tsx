import { Link } from 'react-router-dom';
import { visuals } from '../visuals';
import './VisualsIndexPage.css';

export default function VisualsIndexPage() {
  return (
    <div className="visuals-index">
      <header className="visuals-index__head">
        <div className="visuals-index__label">§ Interactive</div>
        <h1 className="visuals-index__title">Visuals</h1>
        <p className="visuals-index__lede">
          Small interactive explainers — built to make ML systems concepts
          tangible. Play with the parameters, watch the dataflow.
        </p>
      </header>
      <div className="visuals-index__grid">
        {visuals.map((v) => (
          <Link key={v.meta.slug} to={`/visuals/${v.meta.slug}`} className="visual-card">
            <div className="visual-card__label">interactive</div>
            <h3 className="visual-card__title">{v.meta.title}</h3>
            <p className="visual-card__desc">{v.meta.description}</p>
            <span className="visual-card__cta">open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
