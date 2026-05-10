import { useEffect, useState } from 'react';
import './MiniViz.css';

const FLOAT_FORMATS = [
  { name: 'FP32', exp: 8, man: 23, total: 32, note: 'training reference' },
  { name: 'FP16', exp: 5, man: 10, total: 16, note: 'half-precision · ~65k values' },
  { name: 'BF16', exp: 8, man: 7, total: 16, note: 'FP32 range, half precision' },
  { name: 'FP8 (E4M3)', exp: 4, man: 3, total: 8, note: '~256 values · MXFP8 storage' },
  { name: 'FP4 (E2M1)', exp: 2, man: 1, total: 4, note: '16 values · NVFP4 weights' },
];

export function BitStripMini() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % FLOAT_FORMATS.length), 2200);
    return () => clearInterval(id);
  }, []);
  const f = FLOAT_FORMATS[idx];
  const cells: string[] = ['s'];
  for (let i = 0; i < f.exp; i++) cells.push('e');
  for (let i = 0; i < f.man; i++) cells.push('m');
  const pad = 32 - cells.length;

  return (
    <div className="mvz mvz--bits">
      <div className="mvz__head">
        <span className="mvz__title">{f.name}</span>
        <span className="mvz__meta">
          {f.total} bits · 1 sign / {f.exp} exp / {f.man} man
        </span>
      </div>
      <div className="mvz__bits-row">
        {cells.map((c, i) => (
          <div key={i} className={`mvz__bit mvz__bit--${c}`} />
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`p-${i}`} className="mvz__bit mvz__bit--empty" />
        ))}
      </div>
      <div className="mvz__legend">
        <span className="mvz__lg mvz__lg--s">sign</span>
        <span className="mvz__lg mvz__lg--e">exponent (range)</span>
        <span className="mvz__lg mvz__lg--m">mantissa (precision)</span>
        <span className="mvz__caption">{f.note}</span>
      </div>
    </div>
  );
}

export function RulerSnapMini() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  const phaseLen = 120;
  const bitsCycle = [4, 3, 2];
  const phase = Math.floor(tick / phaseLen) % bitsCycle.length;
  const bits = bitsCycle[phase];
  const subTick = tick % phaseLen;

  const slots = 1 << bits;
  const halfSlots = slots / 2;
  const scale = 1 / (halfSlots - 1 || 1);

  const value = Math.sin((subTick / phaseLen) * Math.PI * 2) * 0.95;
  const slotInt = Math.max(-(halfSlots - 1), Math.min(halfSlots - 1, Math.round(value / scale)));
  const recovered = slotInt * scale;
  const error = Math.abs(value - recovered);

  const slotPositions: number[] = [];
  for (let i = -(halfSlots - 1); i <= halfSlots - 1; i++) slotPositions.push(i * scale);

  const pct = (v: number) => ((v + 1) / 2) * 100;

  return (
    <div className="mvz mvz--ruler">
      <div className="mvz__head">
        <span className="mvz__title">{bits}-bit symmetric · {slots} slots</span>
        <span className="mvz__meta">error {error.toFixed(3)}</span>
      </div>
      <div className="mvz__ruler">
        <div className="mvz__ruler-track" />
        {slotPositions.map((p, i) => {
          const isActive = Math.abs(p - recovered) < 1e-6;
          return (
            <div
              key={i}
              className={`mvz__ruler-tick${isActive ? ' is-active' : ''}`}
              style={{ left: `${pct(p)}%` }}
            />
          );
        })}
        <div className="mvz__ruler-orig" style={{ left: `${pct(value)}%` }} />
        <div className="mvz__ruler-snap" style={{ left: `${pct(recovered)}%` }} />
      </div>
      <div className="mvz__caption">
        bit depth cycles 4 → 3 → 2. watch slot count drop, error grow.
      </div>
    </div>
  );
}

export function SuperBlockMini() {
  return (
    <div className="mvz mvz--super">
      <div className="mvz__head">
        <span className="mvz__title">K-quant super-block (256 weights)</span>
        <span className="mvz__meta">FP16 super-scale → 6-bit sub-scales → 4-bit weights</span>
      </div>
      <div className="mvz__super-stack">
        <div className="mvz__super-scale">
          <span>super_scale</span>
          <em>FP16</em>
        </div>
        <div className="mvz__super-arrows">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mvz__super-arrow" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
        <div className="mvz__super-subs">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mvz__super-sub" style={{ animationDelay: `${i * 0.18}s` }}>
              <div className="mvz__super-sub-scale">sub {i}</div>
              <div className="mvz__super-sub-cells">
                {Array.from({ length: 32 }).map((_, j) => (
                  <div key={j} className="mvz__super-sub-cell" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mvz__caption">
        one FP16 number calibrates eight 6-bit sub-scales. each sub-scale governs 32 weights.
      </div>
    </div>
  );
}

export function PipelinesMini() {
  return (
    <div className="mvz mvz--pipes">
      <div className="mvz__pipe">
        <div className="mvz__pipe-label">Q4_K_M · storage quant</div>
        <div className="mvz__pipe-track">
          <div className="mvz__station">load Q4</div>
          <div className="mvz__step">→</div>
          <div className="mvz__station mvz__station--warn">dequant FP16</div>
          <div className="mvz__step">→</div>
          <div className="mvz__station">tensor core (FP16)</div>
          <div className="mvz__step">→</div>
          <div className="mvz__station">out</div>
          <div className="mvz__pipe-dot mvz__pipe-dot--slow" />
        </div>
      </div>
      <div className="mvz__pipe">
        <div className="mvz__pipe-label">MXFP8 · compute quant</div>
        <div className="mvz__pipe-track">
          <div className="mvz__station">load FP8</div>
          <div className="mvz__step">→</div>
          <div className="mvz__station mvz__station--good">tensor core (FP8)</div>
          <div className="mvz__step">→</div>
          <div className="mvz__station">out</div>
          <div className="mvz__pipe-dot mvz__pipe-dot--fast" />
        </div>
      </div>
      <div className="mvz__caption">
        storage path pays a dequant step before tensor-core math runs at FP16. compute path
        skips it — math runs at FP8 directly.
      </div>
    </div>
  );
}
