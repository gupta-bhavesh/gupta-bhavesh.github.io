import { useMemo, useState } from 'react';
import './MxVsNvVisual.css';

const FP4_VALUES = [-6, -4, -3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4, 6];

function nearestFp4(v: number): number {
  let best = FP4_VALUES[0];
  let bestErr = Math.abs(v - best);
  for (const c of FP4_VALUES) {
    const e = Math.abs(v - c);
    if (e < bestErr) {
      bestErr = e;
      best = c;
    }
  }
  return best;
}

function fp8Round(v: number): number {
  if (Math.abs(v) > 448) return Math.sign(v) * 448;
  if (v === 0) return 0;
  const sign = Math.sign(v);
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log2(abs));
  const mantSteps = 8;
  const stepsAbove = (abs / Math.pow(2, exp) - 1) * mantSteps;
  const rounded = Math.round(stepsAbove);
  return sign * Math.pow(2, exp) * (1 + rounded / mantSteps);
}

const PRESETS: { name: string; weights: number[] }[] = [
  { name: 'tame', weights: [0.42, -0.81, 0.05, 1.23] },
  { name: 'wide', weights: [120, 85.5, -96, 110] },
  { name: 'tiny', weights: [0.001, -0.004, 0.002, 0.0008] },
  { name: 'outlier', weights: [0.3, -0.4, 0.2, 12.0] },
];

export default function MxVsNvVisual() {
  const [weights, setWeights] = useState<number[]>(PRESETS[0].weights);

  const setW = (idx: number, val: number) => {
    setWeights((ws) => ws.map((w, i) => (i === idx ? val : w)));
  };

  const maxAbs = Math.max(...weights.map((w) => Math.abs(w)), 1e-9);

  const mxScalePow = Math.ceil(Math.log2(maxAbs));
  const mxScale = Math.pow(2, mxScalePow);
  const mxResult = useMemo(
    () =>
      weights.map((w) => {
        const norm = w / mxScale;
        const stored = fp8Round(norm);
        const recovered = stored * mxScale;
        return { norm, stored, recovered, error: Math.abs(w - recovered) };
      }),
    [weights, mxScale],
  );

  const fp4Max = 6;
  const nvScaleRaw = maxAbs / fp4Max;
  const nvScale = fp8Round(nvScaleRaw);
  const nvResult = useMemo(
    () =>
      weights.map((w) => {
        const norm = w / nvScale;
        const stored = nearestFp4(norm);
        const recovered = stored * nvScale;
        return { norm, stored, recovered, error: Math.abs(w - recovered) };
      }),
    [weights, nvScale],
  );

  const mxAvgErr = mxResult.reduce((s, r) => s + r.error, 0) / mxResult.length;
  const nvAvgErr = nvResult.reduce((s, r) => s + r.error, 0) / nvResult.length;
  const mxBpw = (4 * 8 + 8) / 4;
  const nvBpw = (4 * 4 + 8) / 4;

  return (
    <div className="mxv">
      <div className="mxv__presets">
        <span className="mxv__presets-label">presets</span>
        {PRESETS.map((p) => (
          <button key={p.name} className="mxv__preset-btn" onClick={() => setWeights(p.weights)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="mxv__inputs">
        <div className="mxv__inputs-head">block of 4 weights — drag to change</div>
        <div className="mxv__weights">
          {weights.map((w, i) => (
            <div key={i} className="mxv__weight">
              <label>w<sub>{i}</sub></label>
              <input
                type="number"
                step="0.01"
                value={w}
                onChange={(e) => setW(i, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
        <div className="mxv__shared">
          <span>max |w| = </span>
          <strong>{maxAbs.toFixed(4)}</strong>
        </div>
      </div>

      <div className="mxv__compare">
        <div className="mxv__panel mxv__panel--mx">
          <div className="mxv__panel-head">
            <div className="mxv__panel-title">MXFP8</div>
            <div className="mxv__panel-sub">FP8 weights · E8M0 (power-of-2) scale</div>
          </div>

          <div className="mxv__scale-line">
            scale = 2<sup>{mxScalePow}</sup> ={' '}
            <strong>{mxScale.toFixed(4)}</strong>
            <span className="mxv__pill">power-of-2 only</span>
          </div>

          <table className="mxv__table">
            <thead>
              <tr>
                <th>w</th>
                <th>÷ scale</th>
                <th>FP8 stored</th>
                <th>recovered</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              {mxResult.map((r, i) => (
                <tr key={i}>
                  <td>{weights[i].toFixed(3)}</td>
                  <td>{r.norm.toFixed(4)}</td>
                  <td className="mxv__hi">{r.stored.toFixed(4)}</td>
                  <td>{r.recovered.toFixed(4)}</td>
                  <td className="mxv__err">{r.error.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mxv__panel-stats">
            <div>
              <span>avg error</span>
              <strong>{mxAvgErr.toFixed(4)}</strong>
            </div>
            <div>
              <span>bits/weight</span>
              <strong>{mxBpw.toFixed(2)}</strong>
            </div>
            <div>
              <span>scale apply</span>
              <strong className="mxv__good">bit-shift</strong>
            </div>
          </div>
        </div>

        <div className="mxv__panel mxv__panel--nv">
          <div className="mxv__panel-head">
            <div className="mxv__panel-title">NVFP4</div>
            <div className="mxv__panel-sub">FP4 weights · FP8 (E4M3) scale</div>
          </div>

          <div className="mxv__scale-line">
            scale ≈ <strong>{nvScale.toFixed(4)}</strong>
            <span className="mxv__pill">any FP8 value</span>
          </div>

          <table className="mxv__table">
            <thead>
              <tr>
                <th>w</th>
                <th>÷ scale</th>
                <th>FP4 stored</th>
                <th>recovered</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              {nvResult.map((r, i) => (
                <tr key={i}>
                  <td>{weights[i].toFixed(3)}</td>
                  <td>{r.norm.toFixed(4)}</td>
                  <td className="mxv__hi">{r.stored}</td>
                  <td>{r.recovered.toFixed(4)}</td>
                  <td className="mxv__err">{r.error.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mxv__panel-stats">
            <div>
              <span>avg error</span>
              <strong>{nvAvgErr.toFixed(4)}</strong>
            </div>
            <div>
              <span>bits/weight</span>
              <strong>{nvBpw.toFixed(2)}</strong>
            </div>
            <div>
              <span>scale apply</span>
              <strong className="mxv__warn">FP8 multiply</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mxv__hint">
        try preset <em>outlier</em> — one big weight forces both formats to widen the scale,
        crushing precision on the small ones. <em>tiny</em> shows MXFP8 still resolves
        millionths while NVFP4's 16 slots collapse them all to zero. <em>wide</em> is the
        canonical large-magnitude block.
      </div>
    </div>
  );
}
