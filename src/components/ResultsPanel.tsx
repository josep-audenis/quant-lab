import { AlertTriangle, Info, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { BacktestResult, BenchmarkPoint, Fill, MetricSet, PortfolioSnapshot, RiskWarning } from "../api/experiments";
import { useState } from "react";

type ResultsPanelProps = {
  result: BacktestResult;
  initialCapital: number;
  benchmark: string;
};

export function ResultsPanel({ result, initialCapital, benchmark }: ResultsPanelProps) {
  const { metrics, equity_curve, warnings } = result;

  return (
    <section className="results-panel">
      <MetricsGrid metrics={metrics} benchmark={benchmark} />
      <AssumptionsPanel result={result} />
      {result.provenance.data.length > 0 && <ProvenancePanel result={result} />}
      {result.oos_metrics && <OosPanel isMetrics={metrics} oosMetrics={result.oos_metrics} benchmark={benchmark} />}
      <EquityChart curve={equity_curve} benchmarkCurve={result.benchmark_curve} initialCapital={initialCapital} />
      <DrawdownChart curve={equity_curve} />
      {result.fills.length > 0 && <AttributionChart fills={result.fills} />}
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      {result.fills.length > 0 && <FillsTable fills={result.fills} />}
    </section>
  );
}

// --- Metrics grid ------------------------------------------------------------

function MetricsGrid({ metrics, benchmark }: { metrics: MetricSet; benchmark: string }) {
  const stratColor = metrics.total_return >= 0 ? "pos" : "neg";
  const benchColor =
    metrics.benchmark_total_return == null
      ? ""
      : metrics.benchmark_total_return >= 0
        ? "pos"
        : "neg";

  return (
    <div className="metrics-section">
      <p className="sect-label metrics-label">Performance</p>
      <div className="metrics-grid">
        <MetricCard
          label="Total return"
          value={pct(metrics.total_return)}
          sub={`Ann. ${pct(metrics.annualized_return)}`}
          color={stratColor}
          icon={metrics.total_return >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        />
        <MetricCard
          label={`vs ${benchmark}`}
          value={metrics.benchmark_total_return != null ? pct(metrics.benchmark_total_return) : "-"}
          sub={
            metrics.benchmark_annualized_return != null
              ? `Ann. ${pct(metrics.benchmark_annualized_return)}`
              : "No benchmark data"
          }
          color={benchColor}
        />
        <MetricCard
          label="Max drawdown"
          value={pct(metrics.max_drawdown)}
          sub="Peak-to-trough"
          color="neg"
          icon={<TrendingDown size={16} />}
        />
        <MetricCard
          label="Sharpe ratio"
          value={metrics.sharpe != null ? metrics.sharpe.toFixed(2) : "-"}
          sub="Risk-adjusted return"
          color={metrics.sharpe != null && metrics.sharpe > 0 ? "pos" : "neg"}
        />
        <MetricCard
          label="Volatility"
          value={`${(metrics.volatility * 100).toFixed(2)}%`}
          sub="Annualised std dev"
          color=""
        />
        <MetricCard
          label="Turnover"
          value={`${metrics.turnover.toFixed(1)}x`}
          sub="Annualized capital traded"
          color=""
        />
      </div>
    </div>
  );
}

function AssumptionsPanel({ result }: { result: BacktestResult }) {
  const config = result.config;
  return (
    <div className="assumptions-section">
      <p className="sect-label metrics-label">Run assumptions</p>
      <div className="assumption-grid">
        <AssumptionItem label="Execution" value={executionLabel(config.execution_timing)} />
        <AssumptionItem label="Cash policy" value={cashPolicyLabel(config.cash_policy, config.risk_free_rate)} />
        <AssumptionItem label="Prices" value={config.use_adjusted ? "Adjusted close" : "Raw close"} />
        <AssumptionItem label="Rebalance" value={config.rebalance_frequency} />
        <AssumptionItem
          label="Costs"
          value={`${config.cost_model.commission_bps} bps commission, ${config.cost_model.slippage_bps} bps slippage`}
        />
        <AssumptionItem
          label="Run date"
          value={new Date(result.generated_at).toLocaleString()}
        />
      </div>
    </div>
  );
}

function ProvenancePanel({ result }: { result: BacktestResult }) {
  return (
    <div className="provenance-section">
      <p className="sect-label metrics-label">Data provenance</p>
      <div className="provenance-table-wrap">
        <table className="provenance-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Source</th>
              <th>Adjustment</th>
              <th>Coverage</th>
              <th>Fetched</th>
              <th>Cache</th>
            </tr>
          </thead>
          <tbody>
            {result.provenance.data.map((item) => (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>{item.source}</td>
                <td>{item.adjustment}</td>
                <td>
                  {item.bar_count}/{item.expected_bars}
                  {item.missing_bars > 0 ? ` (${item.missing_bars} missing)` : ""}
                </td>
                <td>{new Date(item.fetched_at).toLocaleDateString()}</td>
                <td>{item.cache_hash ? item.cache_hash.slice(0, 10) : "not cached"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssumptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="assumption-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({
  color,
  icon,
  label,
  sub,
  value,
}: {
  color: string;
  icon?: React.ReactNode;
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <div className={`metric-card${color ? ` metric-${color}` : ""}`}>
      <div className="metric-header">
        <p className="metric-label">{label}</p>
        {icon && <span className={`metric-icon-badge ${color}`}>{icon}</span>}
      </div>
      <div className={`metric-value ${color}`}>{value}</div>
      <p className="metric-sub">{sub}</p>
    </div>
  );
}

// --- Equity chart -------------------------------------------------------------

function EquityChart({
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

function OosPanel({
  isMetrics,
  oosMetrics,
  benchmark,
}: {
  isMetrics: MetricSet;
  oosMetrics: MetricSet;
  benchmark: string;
}) {
  const rows: Array<{ label: string; is: string; oos: string; higherBetter: boolean | null }> = [
    {
      label: "Total return",
      is: pct(isMetrics.total_return),
      oos: pct(oosMetrics.total_return),
      higherBetter: true,
    },
    {
      label: "Ann. return",
      is: pct(isMetrics.annualized_return),
      oos: pct(oosMetrics.annualized_return),
      higherBetter: true,
    },
    {
      label: "Volatility",
      is: `${(isMetrics.volatility * 100).toFixed(2)}%`,
      oos: `${(oosMetrics.volatility * 100).toFixed(2)}%`,
      higherBetter: null,
    },
    {
      label: "Sharpe",
      is: isMetrics.sharpe != null ? isMetrics.sharpe.toFixed(2) : "-",
      oos: oosMetrics.sharpe != null ? oosMetrics.sharpe.toFixed(2) : "-",
      higherBetter: true,
    },
    {
      label: "Max drawdown",
      is: pct(isMetrics.max_drawdown),
      oos: pct(oosMetrics.max_drawdown),
      higherBetter: false,
    },
    {
      label: `${benchmark} total`,
      is: isMetrics.benchmark_total_return != null ? pct(isMetrics.benchmark_total_return) : "-",
      oos: oosMetrics.benchmark_total_return != null ? pct(oosMetrics.benchmark_total_return) : "-",
      higherBetter: null,
    },
  ];

  const oosRetColor =
    oosMetrics.total_return >= isMetrics.total_return * 0.8 ? "pos" : "neg";

  return (
    <div className="oos-section">
      <p className="sect-label metrics-label">
        In-sample vs out-of-sample
        <span className={`oos-badge ${oosRetColor}`}>
          OOS {pct(oosMetrics.total_return)}
        </span>
      </p>
      <div className="oos-table-wrap">
        <table className="oos-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>In-sample</th>
              <th>Out-of-sample</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.is}</td>
                <td>{row.oos}</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Attribution chart -------------------------------------------------------

function AttributionChart({ fills }: { fills: Fill[] }) {
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

function DrawdownChart({ curve }: { curve: PortfolioSnapshot[] }) {
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

function FillsTable({ fills }: { fills: Fill[] }) {
  const sorted = [...fills].sort((a, b) => b.as_of.localeCompare(a.as_of));
  const shown = sorted.slice(0, 200);
  return (
    <div className="fills-section">
      <p className="sect-label metrics-label">Trade log ({fills.length} fills)</p>
      <div className="fills-table-wrap">
        <table className="fills-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Value</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f, i) => (
              <tr key={i} className={f.side === "buy" ? "fill-buy" : "fill-sell"}>
                <td>{f.as_of}</td>
                <td>{f.symbol}</td>
                <td className={f.side === "buy" ? "pos" : "neg"}>{f.side.toUpperCase()}</td>
                <td>{f.quantity.toFixed(4)}</td>
                <td>${f.price.toFixed(2)}</td>
                <td>${(f.quantity * f.price).toFixed(0)}</td>
                <td>{f.commission > 0 ? `$${f.commission.toFixed(2)}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fills.length > 200 && (
          <p className="fills-overflow">Showing 200 of {fills.length} fills</p>
        )}
      </div>
    </div>
  );
}

// --- Warnings ----------------------------------------------------------------

function WarningsList({ warnings }: { warnings: RiskWarning[] }) {
  return (
    <div className="warnings-section">
      <p className="sect-label metrics-label">Risk flags</p>
      <div className="warnings-list">
        {warnings.map((w) => (
          <div key={w.code} className={`warning-chip sev-${w.severity}`}>
            {w.severity === "danger" ? (
              <AlertTriangle size={14} />
            ) : w.severity === "caution" ? (
              <Zap size={14} />
            ) : (
              <Info size={14} />
            )}
            <span>{w.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Helpers -----------------------------------------------------------------

function pct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function executionLabel(value: string) {
  if (value === "next_open") return "Next open";
  return "Same close";
}

function cashPolicyLabel(policy: string, riskFreeRate: number) {
  if (policy === "risk_free_proxy") return `Risk-free proxy (${(riskFreeRate * 100).toFixed(2)}%)`;
  if (policy === "benchmark_asset") return "Benchmark asset";
  return "Hold cash";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
