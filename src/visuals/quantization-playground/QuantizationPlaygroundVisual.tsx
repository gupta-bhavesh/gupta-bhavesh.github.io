import { useMemo, useState } from 'react';
import './QuantizationPlaygroundVisual.css';

type Mode = 'symmetric' | 'asymmetric';

export default function QuantizationPlaygroundVisual() {
  const [bits, setBits] = useState(4);
  const [value, setValue] = useState(0.42);
  const [blockMax, setBlockMax] = useState(1.5);
  const [mode, setMode] = useState<Mode>('symmetric');

  const slotsCount = 1 << bits;
  const minV = mode === 'symmetric' ? -blockMax : -blockMax * 0.3;
  const maxV = blockMax;
  const range = maxV - minV;

  const scale = mode === 'symmetric' ? maxV / ((slotsCount >> 1) - 1 || 1) : range / (slotsCount - 1);

  const slots = useMemo(() => {
    const arr: number[] = [];
    if (mode === 'symmetric') {
      const half = slotsCount >> 1;
      for (let i = -(half - 1); i <= half - 1; i++) arr.push(i * scale);
    } else {
      for (let i = 0; i < slotsCount; i++) arr.push(minV + i * scale);
    }
    return arr;
  }, [slotsCount, scale, mode, minV]);

  const quantInt = useMemo(() => {
    if (mode === 'symmetric') {
      const half = slotsCount >> 1;
      const raw = Math.round(value / scale);
      return Math.max(-(half - 1), Math.min(half - 1, raw));
    }
    const raw = Math.round((value - minV) / scale);
    return Math.max(0, Math.min(slotsCount - 1, raw));
  }, [value, scale, slotsCount, mode, minV]);

  const dequant = mode === 'symmetric' ? quantInt * scale : minV + quantInt * scale;
  const error = Math.abs(value - dequant);
  const maxErr = scale / 2;
  const errPct = Math.min(100, (error / maxErr) * 100 || 0);

  const visMin = Math.min(minV, value, slots[0] ?? minV);
  const visMax = Math.max(maxV, value, slots[slots.length - 1] ?? maxV);
  const visRange = visMax - visMin || 1;
  const pct = (v: number) => ((v - visMin) / visRange) * 100;

  const sevenBSize = ((7e9 * (bits / 8) + (7e9 / 32) * 2) / 1e9).toFixed(1);
  const fp32Ratio = (28 / Number(sevenBSize)).toFixed(1);

  return (
    <div className="qpv">
      <div className="qpv__controls">
        <div className="qpv__seg">
          {(['symmetric', 'asymmetric'] as Mode[]).map((m) => (
            <button
              key={m}
              className={`qpv__seg-btn${mode === m ? ' is-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="qpv__stat">
          <span>{slotsCount}</span> slots · scale{' '}
          <span>{scale.toFixed(4)}</span>
        </div>
      </div>

      <div className="qpv__sliders">
        <div className="qpv__slider">
          <label>
            bit depth <span className="qpv__val">{bits}</span>
          </label>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={bits}
            onChange={(e) => setBits(Number(e.target.value))}
          />
          <div className="qpv__slider-meta">{slotsCount} possible values</div>
        </div>

        <div className="qpv__slider">
          <label>
            original value <span className="qpv__val">{value.toFixed(3)}</span>
          </label>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.01}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
          <div className="qpv__slider-meta">drag to pick a weight</div>
        </div>

        <div className="qpv__slider">
          <label>
            block max <span className="qpv__val">{blockMax.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={blockMax}
            onChange={(e) => setBlockMax(Number(e.target.value))}
          />
          <div className="qpv__slider-meta">range covered by the block</div>
        </div>
      </div>

      <div className="qpv__ruler">
        <div className="qpv__ruler-track" />
        {slots.map((s, i) => {
          const isActive = i === (mode === 'symmetric' ? quantInt + ((slotsCount >> 1) - 1) : quantInt);
          return (
            <div
              key={i}
              className={`qpv__tick${isActive ? ' is-active' : ''}`}
              style={{ left: `${pct(s)}%` }}
            >
              <div className="qpv__tick-line" />
              {(slotsCount <= 16 || i % Math.max(1, Math.floor(slotsCount / 8)) === 0) && (
                <div className="qpv__tick-lab">{s.toFixed(2)}</div>
              )}
            </div>
          );
        })}

        <div className="qpv__marker qpv__marker--orig" style={{ left: `${pct(value)}%` }}>
          <div className="qpv__flag qpv__flag--orig">orig: {value.toFixed(3)}</div>
        </div>
        <div className="qpv__marker qpv__marker--quant" style={{ left: `${pct(dequant)}%` }}>
          <div className="qpv__flag qpv__flag--quant">
            slot {quantInt} → {dequant.toFixed(3)}
          </div>
        </div>
      </div>

      <div className="qpv__readout">
        <div className="qpv__card">
          <div className="qpv__card-label">stored integer</div>
          <div className="qpv__card-val">{quantInt}</div>
          <div className="qpv__card-sub">{bits}-bit slot index</div>
        </div>
        <div className="qpv__card">
          <div className="qpv__card-label">recovered float</div>
          <div className="qpv__card-val">{dequant.toFixed(4)}</div>
          <div className="qpv__card-sub">int × scale {mode === 'asymmetric' ? '+ min' : ''}</div>
        </div>
        <div className="qpv__card">
          <div className="qpv__card-label">rounding error</div>
          <div className="qpv__card-val" style={{ color: errPct < 33 ? 'var(--accent3)' : errPct < 66 ? 'var(--yellow)' : 'var(--red)' }}>
            {error.toFixed(4)}
          </div>
          <div className="qpv__card-sub">
            <div className="qpv__bar">
              <div
                className="qpv__bar-fill"
                style={{
                  width: `${errPct}%`,
                  background:
                    errPct < 33 ? 'var(--accent3)' : errPct < 66 ? 'var(--yellow)' : 'var(--red)',
                }}
              />
            </div>
            {errPct.toFixed(0)}% of max possible
          </div>
        </div>
        <div className="qpv__card">
          <div className="qpv__card-label">7B model size</div>
          <div className="qpv__card-val">{sevenBSize} GB</div>
          <div className="qpv__card-sub">{fp32Ratio}× smaller than FP32</div>
        </div>
      </div>

      <div className="qpv__hint">
        drop bits → fewer slots → bigger gaps → bigger error. push to 2-bit and watch the error
        bar saturate. flip to asymmetric to see how the slot range shifts off-zero (useful for
        post-ReLU activations).
      </div>
    </div>
  );
}
