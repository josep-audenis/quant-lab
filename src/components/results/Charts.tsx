import type { BenchmarkPoint, Fill, PortfolioSnapshot } from "../../api/experiments";
import { fmtDate } from "./formatters";

export function EquityChart({
  curve,
  benchmarkCurve,
  initialCapital,
}: {
  curve: PortfolioSnapshot[];
  benchmarkCurve: BenchmarkPoint[];
  initialCapital: number;
}) {
  if (curve.length < 2) return null;

  const W = 900;
  const H = 280;
  const PAD = { top: 20, right: 24, bottom: 44, left: 72 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Normalise to starting capital = 100 index
  const base = curve[0].equity;
  const indexed = curve.map((s) => (s.equity / base) * 100);

  // Benchmark indexed to same base
  const benchBase = benchmarkCurve.length > 0 ? benchmarkCurve[0].equity : 0;
  const benchIndexed = benchBase > 0 ? benchmarkCurve.map((p) => (p.equity / benchBase) * 100) : [];

  const allValues = [...indexed, ...benchIndexed];
  const minV = Math.min(...allValues) * 0.995;
  const maxV = Math.max(...allValues) * 1.005;
  const range = maxV - minV || 1;

  function xAt(i: number, total: number) {
    return PAD.left + (i / (total - 1)) * chartW;
  }
  function yAt(v: number) {
    return PAD.top + chartH - ((v - minV) / range) * chartH;
  }

  const linePath = indexed
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i, indexed.length).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L${xAt(indexed.length - 1, indexed.length).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  const benchPath =
    benchIndexed.length > 1
      ? benchIndexed
          .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i, benchIndexed.length).toFixed(1)},${yAt(v).toFixed(1)}`)
          .join(" ")
      : null;

  // Y axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => minV + (i / (tickCount - 1)) * range);

  // X axis labels - sample ~5 evenly spaced dates
  const xSampleCount = 5;
  const xSamples = Array.from({ length: xSampleCount }, (_, i) =>
    Math.round((i / (xSampleCount - 1)) * (curve.length - 1)),
  );

  return (
    <div className="chart-section">
      <div className="chart-header">
        <p className="sect-label metrics-label">Equity curve (indexed, start = 100)</p>
        <div className="chart-legend">
          <span className="legend-item legend-strategy">Strategy</span>
          {benchPath && <span className="legend-item legend-benchmark">Benchmark</span>}
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="equity-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={PAD.left}
              x2={PAD.left + chartW}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="var(--line)"
              strokeWidth="1"
            />
          ))}

          {/* Baseline (100) */}
          <line
            x1={PAD.left}
            x2={PAD.left + chartW}
            y1={yAt(100)}
            y2={yAt(100)}
            stroke="var(--line-2)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#equityGrad)" clipPath="url(#chartClip)" />

          {/* Benchmark line */}
          {benchPath && (
            <path
              d={benchPath}
              fill="none"
              stroke="#4cdf88"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              strokeOpacity="0.7"
              clipPath="url(#chartClip)"
            />
          )}

          {/* Strategy line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            clipPath="url(#chartClip)"
          />

          {/* Y axis labels */}
          {ticks.map((tick) => (
            <text
              key={tick}
              x={PAD.left - 8}
              y={yAt(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-tick"
            >
              {tick.toFixed(0)}
            </text>
          ))}

          {/* X axis labels */}
          {xSamples.map((idx) => (
            <text
              key={idx}
              x={xAt(idx, curve.length)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              className="chart-tick"
            >
              {fmtDate(curve[idx].as_of)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// --- OOS panel ---------------------------------------------------------------

export function AttributionChart({ fills }: { fills: Fill[] }) {
  // FIFO realized P&L per symbol
  const bySymbol = new Map<string, { pnl: number; basis: { qty: number; price: number }[] }>();

  for (const fill of [...fills].sort((a, b) => a.as_of.localeCompare(b.as_of))) {
    if (!bySymbol.has(fill.symbol)) bySymbol.set(fill.symbol, { pnl: 0, basis: [] });
    const entry = bySymbol.get(fill.symbol)!;
    if (fill.side === "buy") {
      entry.basis.push({ qty: fill.quantity, price: fill.price });
    } else {
      let remaining = fill.quantity;
      while (remaining > 1e-8 && entry.basis.length > 0) {
        const oldest = entry.basis[0];
        const matched = Math.min(remaining, oldest.qty);
        entry.pnl += matched * (fill.price - oldest.price) - fill.commission * (matched / fill.quantity);
        oldest.qty -= matched;
        remaining -= matched;
        if (oldest.qty < 1e-8) entry.basis.shift();
      }
    }
  }

  const items = [...bySymbol.entries()]
    .map(([symbol, { pnl }]) => ({ symbol, pnl }))
    .sort((a, b) => b.pnl - a.pnl);

  if (items.length === 0) return null;

  const maxAbs = Math.max(...items.map((i) => Math.abs(i.pnl)), 1);
  const BAR_MAX = 320;

  return (
    <div className="attribution-section">
      <p className="sect-label metrics-label">Realized P&L by asset</p>
      <div className="attribution-bars">
        {items.map(({ symbol, pnl }) => {
          const w = (Math.abs(pnl) / maxAbs) * BAR_MAX;
          const pos = pnl >= 0;
          return (
            <div key={symbol} className="attr-row">
              <span className="attr-symbol">{symbol}</span>
              <div className="attr-bar-wrap">
                {pos ? (
                  <>
                    <div className="attr-spacer" style={{ width: BAR_MAX }} />
                    <div className="attr-bar pos" style={{ width: w }} />
                  </>
                ) : (
                  <>
                    <div className="attr-bar neg" style={{ width: w, marginLeft: BAR_MAX - w }} />
                    <div className="attr-spacer" style={{ width: BAR_MAX }} />
                  </>
                )}
              </div>
              <span className={`attr-val ${pos ? "pos" : "neg"}`}>
                {pos ? "+" : ""}${pnl.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Drawdown chart -----------------------------------------------------------

export function DrawdownChart({ curve }: { curve: PortfolioSnapshot[] }) {
  if (curve.length < 2) return null;

  const W = 900;
  const H = 120;
  const PAD = { top: 12, right: 24, bottom: 32, left: 72 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const drawdowns = curve.map((s) => s.drawdown * 100);
  const minV = Math.min(...drawdowns) * 1.05;
  const maxV = 0;
  const range = maxV - minV || 1;

  function xAt(i: number) {
    return PAD.left + (i / (drawdowns.length - 1)) * chartW;
  }
  function yAt(v: number) {
    return PAD.top + chartH - ((v - minV) / range) * chartH;
  }

  const linePath = drawdowns
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L${xAt(drawdowns.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, i) => minV + (i / (tickCount - 1)) * range);

  const xSamples = Array.from({ length: 5 }, (_, i) =>
    Math.round((i / 4) * (curve.length - 1)),
  );

  return (
    <div className="chart-section">
      <p className="sect-label metrics-label">Drawdown</p>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="equity-svg" style={{ height: 120 }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5e5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ff5e5e" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="ddClip">
              <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
            </clipPath>
          </defs>
          {ticks.map((tick) => (
            <line key={tick} x1={PAD.left} x2={PAD.left + chartW} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--line)" strokeWidth="1" />
          ))}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={yAt(0)} y2={yAt(0)} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="4 3" />
          <path d={areaPath} fill="url(#ddGrad)" clipPath="url(#ddClip)" />
          <path d={linePath} fill="none" stroke="#ff5e5e" strokeWidth="1.5" clipPath="url(#ddClip)" />
          {ticks.map((tick) => (
            <text key={tick} x={PAD.left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="chart-tick">
              {tick.toFixed(1)}%
            </text>
          ))}
          {xSamples.map((idx) => (
            <text key={idx} x={xAt(idx)} y={H - PAD.bottom + 16} textAnchor="middle" className="chart-tick">
              {fmtDate(curve[idx].as_of)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// --- Fills table -------------------------------------------------------------

