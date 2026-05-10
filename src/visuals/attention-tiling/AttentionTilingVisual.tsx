import { useEffect, useMemo, useRef, useState } from 'react';
import './AttentionTilingVisual.css';

type Mode = 'fa1' | 'fa2';

interface Step {
  qIdx: number;
  kIdx: number;
}

function buildSchedule(mode: Mode, blocks: number): Step[] {
  const steps: Step[] = [];
  if (mode === 'fa1') {
    for (let k = 0; k < blocks; k++) {
      for (let q = 0; q < blocks; q++) {
        steps.push({ qIdx: q, kIdx: k });
      }
    }
  } else {
    for (let q = 0; q < blocks; q++) {
      for (let k = 0; k < blocks; k++) {
        steps.push({ qIdx: q, kIdx: k });
      }
    }
  }
  return steps;
}

export default function AttentionTilingVisual() {
  const [mode, setMode] = useState<Mode>('fa2');
  const [blocks, setBlocks] = useState(4);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(700);
  const intervalRef = useRef<number | null>(null);

  const schedule = useMemo(() => buildSchedule(mode, blocks), [mode, blocks]);

  useEffect(() => {
    setStep(0);
  }, [mode, blocks]);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = window.setInterval(() => {
      setStep((s) => (s + 1) % schedule.length);
    }, speed);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [playing, schedule.length, speed]);

  const current = schedule[step] ?? { qIdx: 0, kIdx: 0 };
  const cell = 56;
  const gap = 4;
  const size = blocks * cell + (blocks - 1) * gap;

  // Track stats: how many times each Q has been "loaded" up to this point.
  const qLoads = useMemo(() => {
    const loads = new Array(blocks).fill(0);
    if (mode === 'fa1') {
      // FA1 reloads Q every K iter
      for (let s = 0; s <= step; s++) loads[schedule[s].qIdx] += 1;
    } else {
      // FA2 loads Q once per outer iteration. So count distinct K=0 occurrences for that Q.
      for (let s = 0; s <= step; s++) {
        if (schedule[s].kIdx === 0) loads[schedule[s].qIdx] += 1;
      }
    }
    return loads;
  }, [mode, blocks, step, schedule]);

  const totalQLoads = qLoads.reduce((a, b) => a + b, 0);
  const fa1Equivalent = mode === 'fa2' ? schedule.length : totalQLoads;
  const fa2Equivalent = mode === 'fa1' ? blocks * Math.min(step + 1, blocks) : totalQLoads;

  return (
    <div className="atv">
      <div className="atv__controls">
        <div className="atv__seg">
          {(['fa1', 'fa2'] as Mode[]).map((m) => (
            <button
              key={m}
              className={`atv__seg-btn${mode === m ? ' is-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'fa1' ? 'FA1 (outer K,V)' : 'FA2 (outer Q)'}
            </button>
          ))}
        </div>

        <label className="atv__field">
          <span>Blocks</span>
          <input
            type="range"
            min={2}
            max={8}
            value={blocks}
            onChange={(e) => setBlocks(parseInt(e.target.value))}
          />
          <span className="atv__field-val">{blocks}×{blocks}</span>
        </label>

        <label className="atv__field">
          <span>Speed</span>
          <input
            type="range"
            min={150}
            max={1200}
            step={50}
            value={1350 - speed}
            onChange={(e) => setSpeed(1350 - parseInt(e.target.value))}
          />
        </label>

        <div className="atv__buttons">
          <button className="atv__btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸ pause' : '▶ play'}
          </button>
          <button
            className="atv__btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ◀ step
          </button>
          <button
            className="atv__btn"
            onClick={() => setStep((s) => Math.min(schedule.length - 1, s + 1))}
          >
            step ▶
          </button>
          <button className="atv__btn" onClick={() => setStep(0)}>↺ reset</button>
        </div>
      </div>

      <div className="atv__stage">
        <div className="atv__matrices">
          <Matrix
            label="Q"
            blocks={blocks}
            highlightIdx={current.qIdx}
            cellSize={cell}
            gap={gap}
            size={size}
            orientation="row"
            highlightColor="var(--accent2)"
          />
          <div className="atv__op">×</div>
          <Matrix
            label="Kᵀ"
            blocks={blocks}
            highlightIdx={current.kIdx}
            cellSize={cell}
            gap={gap}
            size={size}
            orientation="col"
            highlightColor="var(--accent3)"
          />
          <div className="atv__op">·</div>
          <Matrix
            label="V"
            blocks={blocks}
            highlightIdx={current.kIdx}
            cellSize={cell}
            gap={gap}
            size={size}
            orientation="row"
            highlightColor="var(--accent4)"
          />
        </div>

        <div className="atv__sram">
          <div className="atv__sram-label">SRAM (live tiles)</div>
          <div className="atv__sram-row">
            <div className="atv__chip" style={{ borderColor: 'var(--accent2)' }}>
              Q<sub>{current.qIdx + 1}</sub>
            </div>
            <div className="atv__chip" style={{ borderColor: 'var(--accent3)' }}>
              K<sub>{current.kIdx + 1}</sub>
            </div>
            <div className="atv__chip" style={{ borderColor: 'var(--accent4)' }}>
              V<sub>{current.kIdx + 1}</sub>
            </div>
            <div className="atv__chip atv__chip--state">m, ℓ, O</div>
          </div>
          <div className="atv__sram-note">
            {mode === 'fa1'
              ? 'FA1: K,V outer, Q reloaded each K iteration → many HBM round trips for Q'
              : 'FA2: Q outer, stays warm in SRAM. Only K,V cycle in/out.'}
          </div>
        </div>

        <div className="atv__stats">
          <Stat label="step" value={`${step + 1} / ${schedule.length}`} />
          <Stat label="Q HBM loads so far" value={`${totalQLoads}`} highlight={mode === 'fa1'} />
          <Stat
            label="if FA1 / if FA2"
            value={`${fa1Equivalent} / ${fa2Equivalent}`}
          />
        </div>

        <div className="atv__legend">
          <span className="atv__dot" style={{ background: 'var(--accent2)' }} /> Q tile
          <span className="atv__dot" style={{ background: 'var(--accent3)' }} /> K tile
          <span className="atv__dot" style={{ background: 'var(--accent4)' }} /> V tile
          <span className="atv__dot atv__dot--ring" /> already processed
        </div>
      </div>
    </div>
  );
}

interface MatrixProps {
  label: string;
  blocks: number;
  highlightIdx: number;
  cellSize: number;
  gap: number;
  size: number;
  orientation: 'row' | 'col';
  highlightColor: string;
}

function Matrix({
  label,
  blocks,
  highlightIdx,
  cellSize,
  gap,
  size,
  orientation,
  highlightColor,
}: MatrixProps) {
  const tiles: { x: number; y: number; idx: number }[] = [];
  for (let i = 0; i < blocks; i++) {
    tiles.push({
      x: orientation === 'row' ? 0 : i * (cellSize + gap),
      y: orientation === 'row' ? i * (cellSize + gap) : 0,
      idx: i,
    });
  }
  const w = orientation === 'row' ? cellSize : size;
  const h = orientation === 'row' ? size : cellSize;

  return (
    <div className="atv__matrix">
      <div className="atv__matrix-label">{label}</div>
      <svg width={w + 2} height={h + 2}>
        {tiles.map((t) => {
          const active = t.idx === highlightIdx;
          return (
            <rect
              key={t.idx}
              x={t.x + 1}
              y={t.y + 1}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={3}
              fill={active ? highlightColor : 'var(--bg3)'}
              stroke={active ? highlightColor : 'var(--border)'}
              opacity={active ? 0.9 : 0.55}
              style={{ transition: 'fill 0.2s ease, opacity 0.2s ease' }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="atv__stat">
      <div className="atv__stat-label">{label}</div>
      <div className={`atv__stat-value${highlight ? ' is-warn' : ''}`}>{value}</div>
    </div>
  );
}
