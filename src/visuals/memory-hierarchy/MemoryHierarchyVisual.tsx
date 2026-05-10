import { useEffect, useMemo, useState } from 'react';
import './MemoryHierarchyVisual.css';

interface Level {
  id: string;
  name: string;
  speed: string;
  capacity: string;
  bandwidth: number;
  color: string;
  note: string;
}

const levels: Level[] = [
  {
    id: 'reg',
    name: 'Registers',
    speed: 'fastest',
    capacity: 'bytes',
    bandwidth: 100,
    color: '#a594ff',
    note: 'Per-thread scratch. Single values in flight.',
  },
  {
    id: 'sram',
    name: 'SM SRAM',
    speed: '~19 TB/s',
    capacity: '~164 KB / SM',
    bandwidth: 90,
    color: '#7c6af7',
    note: 'On-chip scratchpad. Where FlashAttention keeps tiles.',
  },
  {
    id: 'l2',
    name: 'L2 Cache',
    speed: '~6 TB/s',
    capacity: '40 – 80 MB',
    bandwidth: 70,
    color: '#6ab4f7',
    note: 'Shared across all SMs. Smooths VRAM access.',
  },
  {
    id: 'hbm',
    name: 'GPU VRAM (HBM)',
    speed: '2 – 3 TB/s',
    capacity: '40 – 80 GB',
    bandwidth: 50,
    color: '#4adeaa',
    note: 'Holds model weights and the KV cache.',
  },
  {
    id: 'ram',
    name: 'CPU RAM (DRAM)',
    speed: '50 – 100 GB/s',
    capacity: '32 – 256 GB',
    bandwidth: 18,
    color: '#f7d96a',
    note: 'Tokenization, sampling, kernel launch state.',
  },
  {
    id: 'disk',
    name: 'SSD / Disk',
    speed: '1 – 7 GB/s',
    capacity: 'TB',
    bandwidth: 5,
    color: '#f7a06a',
    note: 'Cold model storage. Touched only at load.',
  },
];

type Mode = 'standard' | 'flash';

const modePaths: Record<Mode, string[]> = {
  standard: ['hbm', 'sram', 'hbm', 'sram', 'hbm', 'sram', 'hbm'],
  flash: ['hbm', 'sram', 'sram', 'sram', 'sram', 'hbm'],
};

const modeLabels: Record<Mode, string[]> = {
  standard: [
    'load Q,K from HBM',
    'compute QKᵀ in SRAM',
    'write S to HBM',
    'read S, softmax in SRAM',
    'write P to HBM',
    'read P, V; multiply in SRAM',
    'write O to HBM',
  ],
  flash: [
    'load Q tile from HBM',
    'sweep K,V tiles in SRAM',
    'update m, ℓ, O in SRAM',
    'no HBM writes for P',
    'continue sweeping',
    'write O once to HBM',
  ],
};

export default function MemoryHierarchyVisual() {
  const [mode, setMode] = useState<Mode>('flash');
  const [step, setStep] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  const path = modePaths[mode];
  const labels = modeLabels[mode];

  useEffect(() => {
    setStep(0);
  }, [mode]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % path.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [path.length]);

  const activeLevelId = path[step];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    path.forEach((l) => {
      c[l] = (c[l] ?? 0) + 1;
    });
    return c;
  }, [path]);

  return (
    <div className="mhv">
      <div className="mhv__controls">
        <div className="mhv__seg">
          {(['standard', 'flash'] as Mode[]).map((m) => (
            <button
              key={m}
              className={`mhv__seg-btn${mode === m ? ' is-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'standard' ? 'standard attention' : 'flashattention'}
            </button>
          ))}
        </div>
        <div className="mhv__round">
          HBM round trips: <strong>{counts.hbm ?? 0}</strong>
        </div>
      </div>

      <div className="mhv__layout">
        <div className="mhv__tower">
          {levels.map((lvl) => {
            const isActive = activeLevelId === lvl.id;
            const isHovered = hover === lvl.id;
            return (
              <div
                key={lvl.id}
                className={`mhv__level${isActive ? ' is-active' : ''}`}
                onMouseEnter={() => setHover(lvl.id)}
                onMouseLeave={() => setHover(null)}
                style={{
                  borderColor: isActive ? lvl.color : 'var(--border)',
                  background: isActive
                    ? `linear-gradient(90deg, ${lvl.color}22, transparent 80%)`
                    : undefined,
                }}
              >
                <div className="mhv__level-bar" style={{ width: `${lvl.bandwidth}%`, background: lvl.color }} />
                <div className="mhv__level-content">
                  <div className="mhv__level-head">
                    <span className="mhv__level-name" style={{ color: isActive || isHovered ? lvl.color : undefined }}>
                      {lvl.name}
                    </span>
                    <span className="mhv__level-speed">{lvl.speed}</span>
                  </div>
                  <div className="mhv__level-meta">
                    <span>{lvl.capacity}</span>
                    {(isActive || isHovered) && <span className="mhv__level-note">{lvl.note}</span>}
                  </div>
                </div>
                {isActive && (
                  <div className="mhv__packet" style={{ background: lvl.color }}>
                    data
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <aside className="mhv__sidebar">
          <div className="mhv__step-label">step {step + 1} / {path.length}</div>
          <div className="mhv__step-text">{labels[step]}</div>
          <ol className="mhv__steps">
            {labels.map((l, i) => (
              <li key={i} className={i === step ? 'is-active' : ''}>
                <span>{i + 1}.</span> {l}
              </li>
            ))}
          </ol>
          <div className="mhv__hint">
            Hover any level to see what it does in an LLM run. The bar length is rough relative
            bandwidth.
          </div>
        </aside>
      </div>
    </div>
  );
}
