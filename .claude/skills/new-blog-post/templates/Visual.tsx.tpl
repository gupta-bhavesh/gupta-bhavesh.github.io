import { useEffect, useState } from 'react';
import './<Name>Visual.css';

export default function <Name>Visual() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setStep((s) => s + 1), 800);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className="<kebab>">
      <div className="<kebab>__controls">
        <button className="<kebab>__btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸ pause' : '▶ play'}
        </button>
        <button className="<kebab>__btn" onClick={() => setStep(0)}>↺ reset</button>
      </div>

      <div className="<kebab>__stage">
        {/* Render a single deterministic frame derived from `step`.
            Avoid global state, side effects, or heavy libraries.
            Stick to React + SVG + CSS. */}
      </div>

      <div className="<kebab>__legend">
        {/* Optional legend / explainer. */}
      </div>
    </div>
  );
}
