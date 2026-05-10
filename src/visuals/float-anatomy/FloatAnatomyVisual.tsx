import { useMemo, useState } from 'react';
import './FloatAnatomyVisual.css';

interface Format {
  id: string;
  name: string;
  expBits: number;
  manBits: number;
  signBit: 0 | 1;
  bias: number;
  maxNormal: number;
  minPositive: number;
  approxSlots: string;
  note: string;
  color: string;
}

const formats: Format[] = [
  {
    id: 'fp32',
    name: 'FP32 (E8M23)',
    expBits: 8,
    manBits: 23,
    signBit: 1,
    bias: 127,
    maxNormal: 3.4e38,
    minPositive: 1.18e-38,
    approxSlots: '~4 billion',
    note: 'Training reference. 4 bytes per number.',
    color: '#7c6af7',
  },
  {
    id: 'fp16',
    name: 'FP16 (E5M10)',
    expBits: 5,
    manBits: 10,
    signBit: 1,
    bias: 15,
    maxNormal: 65504,
    minPositive: 6.1e-5,
    approxSlots: '~65,000',
    note: 'Half-precision. Standard inference / mixed-precision training.',
    color: '#a594ff',
  },
  {
    id: 'bf16',
    name: 'BF16 (E8M7)',
    expBits: 8,
    manBits: 7,
    signBit: 1,
    bias: 127,
    maxNormal: 3.4e38,
    minPositive: 1.18e-38,
    approxSlots: '~32,000',
    note: 'FP32 range, half the precision. Loved for stable training.',
    color: '#6ab4f7',
  },
  {
    id: 'fp8',
    name: 'FP8 (E4M3)',
    expBits: 4,
    manBits: 3,
    signBit: 1,
    bias: 7,
    maxNormal: 448,
    minPositive: 0.0156,
    approxSlots: '~256',
    note: 'Hopper / MI300 / Blackwell tensor cores. MXFP8 storage format.',
    color: '#4adeaa',
  },
  {
    id: 'fp4',
    name: 'FP4 (E2M1)',
    expBits: 2,
    manBits: 1,
    signBit: 1,
    bias: 1,
    maxNormal: 6,
    minPositive: 0.5,
    approxSlots: '16',
    note: 'NVFP4 weight format. Only 16 distinct values total.',
    color: '#f7d96a',
  },
  {
    id: 'e8m0',
    name: 'E8M0 (8 exp, 0 mantissa)',
    expBits: 8,
    manBits: 0,
    signBit: 0,
    bias: 127,
    maxNormal: 1.7e38,
    minPositive: 5.9e-39,
    approxSlots: '256 (powers of 2)',
    note: 'MXFP8 scale format. Multiplying by it = bit shift.',
    color: '#f7a06a',
  },
];

function fp4Values(): number[] {
  const out: number[] = [];
  for (const sign of [1, -1]) {
    for (const exp of [0, 1, 2, 3]) {
      for (const man of [0, 1]) {
        let v: number;
        if (exp === 0) v = man * 0.5;
        else v = Math.pow(2, exp - 1) * (1 + man * 0.5);
        out.push(sign * v);
      }
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

function fp8Values(): number[] {
  const out: number[] = [];
  for (const sign of [1, -1]) {
    for (let exp = 0; exp < 16; exp++) {
      for (let man = 0; man < 8; man++) {
        let v: number;
        if (exp === 0) v = (man / 8) * Math.pow(2, -6);
        else v = Math.pow(2, exp - 7) * (1 + man / 8);
        if (v > 448) continue;
        out.push(sign * v);
      }
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

function fp16Round(v: number): number {
  if (Math.abs(v) > 65504) return Math.sign(v) * 65504;
  if (v === 0) return 0;
  const sign = Math.sign(v);
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log2(abs));
  const mantSteps = 1024;
  const stepsAbove = (abs / Math.pow(2, exp) - 1) * mantSteps;
  const rounded = Math.round(stepsAbove);
  return sign * Math.pow(2, exp) * (1 + rounded / mantSteps);
}

function bf16Round(v: number): number {
  if (v === 0) return 0;
  const sign = Math.sign(v);
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log2(abs));
  const mantSteps = 128;
  const stepsAbove = (abs / Math.pow(2, exp) - 1) * mantSteps;
  const rounded = Math.round(stepsAbove);
  return sign * Math.pow(2, exp) * (1 + rounded / mantSteps);
}

function nearestFromSet(v: number, set: number[]): number {
  let best = set[0];
  let bestErr = Math.abs(v - best);
  for (const s of set) {
    const e = Math.abs(v - s);
    if (e < bestErr) {
      bestErr = e;
      best = s;
    }
  }
  return best;
}

function e8m0Round(v: number): number {
  if (v <= 0) return 0;
  const exp = Math.round(Math.log2(v));
  return Math.pow(2, Math.max(-127, Math.min(127, exp)));
}

export default function FloatAnatomyVisual() {
  const [value, setValue] = useState(0.42);
  const [active, setActive] = useState<string>('fp4');

  const fp4Set = useMemo(() => fp4Values(), []);
  const fp8Set = useMemo(() => fp8Values(), []);

  const rounded = useMemo<Record<string, number>>(
    () => ({
      fp32: value,
      fp16: fp16Round(value),
      bf16: bf16Round(value),
      fp8: nearestFromSet(value, fp8Set),
      fp4: nearestFromSet(value, fp4Set),
      e8m0: Math.sign(value) * e8m0Round(Math.abs(value)),
    }),
    [value, fp4Set, fp8Set],
  );

  const errors = useMemo<Record<string, number>>(() => {
    const r: Record<string, number> = {};
    for (const f of formats) r[f.id] = Math.abs(value - rounded[f.id]);
    return r;
  }, [rounded, value]);

  const activeFormat = formats.find((f) => f.id === active)!;

  return (
    <div className="fav">
      <div className="fav__controls">
        <label className="fav__value-input">
          <span>test value</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.01}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
          <span className="fav__value-num">{value.toFixed(3)}</span>
        </label>
      </div>

      <div className="fav__grid">
        {formats.map((f) => {
          const r = rounded[f.id];
          const err = errors[f.id];
          const isActive = active === f.id;
          const totalBits = f.signBit + f.expBits + f.manBits;
          const cells: { label: string; cls: string }[] = [];
          if (f.signBit) cells.push({ label: 'S', cls: 'sign' });
          for (let i = 0; i < f.expBits; i++) cells.push({ label: 'E', cls: 'exp' });
          for (let i = 0; i < f.manBits; i++) cells.push({ label: 'M', cls: 'man' });

          return (
            <div
              key={f.id}
              className={`fav__row${isActive ? ' is-active' : ''}`}
              onClick={() => setActive(f.id)}
              style={{ borderColor: isActive ? f.color : undefined }}
            >
              <div className="fav__row-head">
                <div className="fav__row-name" style={{ color: isActive ? f.color : undefined }}>
                  {f.name}
                </div>
                <div className="fav__row-meta">
                  {totalBits} bits · {f.approxSlots} values
                </div>
              </div>

              <div className="fav__bits">
                {cells.map((c, i) => (
                  <div key={i} className={`fav__bit fav__bit--${c.cls}`}>
                    {c.label}
                  </div>
                ))}
              </div>

              <div className="fav__row-readout">
                <div className="fav__readout-line">
                  <span className="fav__readout-label">rounds to</span>
                  <span className="fav__readout-val" style={{ color: f.color }}>
                    {Number.isFinite(r) ? r.toFixed(4) : '—'}
                  </span>
                </div>
                <div className="fav__readout-line">
                  <span className="fav__readout-label">error</span>
                  <span
                    className="fav__readout-val"
                    style={{
                      color: err === 0 ? 'var(--accent3)' : err < 0.05 ? 'var(--yellow)' : 'var(--red)',
                    }}
                  >
                    {err.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fav__detail" style={{ borderColor: activeFormat.color }}>
        <div className="fav__detail-head" style={{ color: activeFormat.color }}>
          {activeFormat.name}
        </div>
        <div className="fav__detail-grid">
          <div>
            <div className="fav__detail-label">layout</div>
            <div className="fav__detail-val">
              {activeFormat.signBit ? '1 sign · ' : ''}
              {activeFormat.expBits} exp · {activeFormat.manBits} mantissa
            </div>
          </div>
          <div>
            <div className="fav__detail-label">max value</div>
            <div className="fav__detail-val">{activeFormat.maxNormal.toExponential(2)}</div>
          </div>
          <div>
            <div className="fav__detail-label">min positive</div>
            <div className="fav__detail-val">{activeFormat.minPositive.toExponential(2)}</div>
          </div>
          <div>
            <div className="fav__detail-label">distinct values</div>
            <div className="fav__detail-val">{activeFormat.approxSlots}</div>
          </div>
        </div>
        <div className="fav__detail-note">{activeFormat.note}</div>
      </div>

      <div className="fav__hint">
        click any row to inspect it. drag the slider — small numbers like 0.04 round well in
        FP16/BF16 but get crushed by FP4 (which has no slot near small fractions). large numbers
        like 2.7 expose how few mantissa bits BF16 has compared to FP16.
      </div>
    </div>
  );
}
