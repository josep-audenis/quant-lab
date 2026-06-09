import { useEffect, useState } from "react";
import type { BenchmarkPoint, ExperimentSummary, PortfolioSnapshot } from "../../api/experiments";
import { getExperimentChanges } from "../../api/experiments";

const COMPARE_COLORS = ["var(--accent)", "#4cdf88", "#ffb84d", "#ff6f91", "#9f8cff"] as const;

export function ComparisonScreen({
  experiments,
  onBack,
}: {
  experiments: ExperimentSummary[];
  onBack: () => void;
}) {
  const completed = experiments.filter((experiment) => experiment.result).slice(0, 5);
  const [changes, setChanges] = useState<Array<{
    name: string;
    metrics: Array<{ metric: string; base: number; current: number; delta: number }>;
    parameters: Array<{ parameter: string; base: unknown; current: unknown }>;
    assumptions: Array<{ field: string; base: unknown; current: unknown }>;
    decision_delta: { base: string | null; current: string | null };
  }>>([]);
  useEffect(() => {
    if (completed.length < 2) return;
    const base = completed[0];
    void Promise.all(
      completed.slice(1).map((experiment) =>
        getExperimentChanges(experiment.id, base.id).then((res) => ({ name: experiment.name, ...res.changes })),
      ),
    ).then(setChanges).catch(() => setChanges([]));
  }, [completed.map((experiment) => experiment.id).join("|")]);
  if (completed.length < 2) return null;

  return (
    <section className="workbench comparison-screen">
      <div className="workbench-head">
        <button className="iconbtn back-btn" onClick={onBack}>
          Back
        </button>
        <div className="workbench-head-info">
          <p className="eyebrow">Comparison</p>
          <h1>{completed.length} experiment comparison</h1>
        </div>
      </div>

      <div className="comparison-body">
        <ComparisonMetrics experiments={completed} />
        <ComparisonChanges changes={changes} />
        <ComparisonChart experiments={completed} />
      </div>
    </section>
  );
}

export function ComparisonChanges({
  changes,
}: {
  changes: Array<{
    name: string;
    metrics: Array<{ metric: string; base: number; current: number; delta: number }>;
    parameters: Array<{ parameter: string; base: unknown; current: unknown }>;
    assumptions: Array<{ field: string; base: unknown; current: unknown }>;
    decision_delta: { base: string | null; current: string | null };
  }>;
}) {
  if (!changes.length) return null;
  return (
    <div className="comparison-metrics">
      <p className="sect-label metrics-label">What changed vs first selection</p>
      <table className="cmp-table">
        <thead>
          <tr>
            <th>Experiment</th>
            <th>Metric deltas</th>
            <th>Parameters</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.name}>
              <td>{change.name}</td>
              <td>
                {change.metrics.slice(0, 3).map((metric) => (
                  <span key={metric.metric} className={metric.delta >= 0 ? "pos" : "neg"}>
                    {metric.metric}: {metric.delta >= 0 ? "+" : ""}{metric.delta.toFixed(2)}{" "}
                  </span>
                ))}
              </td>
              <td>
                {change.parameters.length
                  ? change.parameters.map((param) => `${param.parameter}: ${String(param.base)} -> ${String(param.current)}`).join(", ")
                  : "No parameter change"}
              </td>
              <td>{change.decision_delta.base ?? "-"} {"->"} {change.decision_delta.current ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComparisonMetrics({ experiments }: { experiments: ExperimentSummary[] }) {
  type Result = NonNullable<ExperimentSummary["result"]>;
  const rows: Array<{ label: string; fmt: (m: Result["metrics"], r: Result) => string }> = [
    { label: "Total return", fmt: (m) => `${m.total_return >= 0 ? "+" : ""}${(m.total_return * 100).toFixed(2)}%` },
    { label: "Ann. return", fmt: (m) => `${m.annualized_return >= 0 ? "+" : ""}${(m.annualized_return * 100).toFixed(2)}%` },
    { label: "Volatility", fmt: (m) => `${(m.volatility * 100).toFixed(2)}%` },
    { label: "Sharpe", fmt: (m) => m.sharpe != null ? m.sharpe.toFixed(2) : "-" },
    { label: "Max drawdown", fmt: (m) => `${(m.max_drawdown * 100).toFixed(2)}%` },
    { label: "Turnover", fmt: (m) => `${m.turnover.toFixed(1)}x` },
    { label: "OOS verdict", fmt: (_m, r) => r.oos_analysis?.verdict ?? "-" },
    { label: "Data score", fmt: (_m, r) => r.data_reliability ? `${r.data_reliability.score.toFixed(1)}/100` : "-" },
  ];
  return (
    <div className="comparison-metrics">
      <table className="cmp-table">
        <thead>
          <tr>
            <th>Metric</th>
            {experiments.map((e, i) => (
              <th key={e.id} style={{ color: COMPARE_COLORS[i] }}>{e.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {experiments.map((e) => (
                <td key={e.id}>{e.result ? row.fmt(e.result.metrics, e.result) : "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComparisonChart({ experiments }: { experiments: ExperimentSummary[] }) {
  const curves = experiments.map((e) => e.result?.equity_curve ?? []);
  const benchCurves = experiments.map((e) => e.result?.benchmark_curve ?? []);
  if (curves[0].length < 2) return null;

  const W = 900;
  const H = 280;
  const PAD = { top: 20, right: 24, bottom: 44, left: 72 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  function indexedValues(curve: PortfolioSnapshot[] | BenchmarkPoint[]): number[] {
    if (curve.length === 0) return [];
    const base = curve[0].equity;
    return base > 0 ? curve.map((s) => (s.equity / base) * 100) : [];
  }

  const allIndexed = curves.map(indexedValues);
  const allVals = allIndexed.flat();
  const minV = Math.min(...allVals) * 0.995;
  const maxV = Math.max(...allVals) * 1.005;
  const range = maxV - minV || 1;

  function xAt(i: number, total: number) {
    return PAD.left + (i / Math.max(total - 1, 1)) * chartW;
  }
  function yAt(v: number) {
    return PAD.top + chartH - ((v - minV) / range) * chartH;
  }

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => minV + (i / (tickCount - 1)) * range);
  const longest = curves.reduce((a, b) => (a.length > b.length ? a : b));
  const xSamples = Array.from({ length: 5 }, (_, i) =>
    Math.round((i / 4) * (longest.length - 1)),
  );

  return (
    <div className="chart-section">
      <div className="chart-header">
        <p className="sect-label metrics-label">Equity curves (indexed, start = 100)</p>
        <div className="chart-legend">
          {experiments.map((e, i) => (
            <span key={e.id} className="legend-item" style={{ color: COMPARE_COLORS[i] }}>
              <span style={{ display: "inline-block", width: 20, height: 2, background: COMPARE_COLORS[i], marginRight: 6, verticalAlign: "middle", borderRadius: 1 }} />
              {e.name}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="equity-svg" preserveAspectRatio="xMidYMid meet">
          <clipPath id="cmpClip">
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
          {ticks.map((tick) => (
            <line key={tick} x1={PAD.left} x2={PAD.left + chartW} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--line)" strokeWidth="1" />
          ))}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={yAt(100)} y2={yAt(100)} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="4 3" />
          {allIndexed.map((vals, idx) =>
            vals.length > 1 ? (
              <path
                key={idx}
                d={vals.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i, vals.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={COMPARE_COLORS[idx]}
                strokeWidth="1.8"
                clipPath="url(#cmpClip)"
              />
            ) : null,
          )}
          {ticks.map((tick) => (
            <text key={tick} x={PAD.left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="chart-tick">
              {tick.toFixed(0)}
            </text>
          ))}
          {xSamples.map((idx) => (
            <text key={idx} x={xAt(idx, longest.length)} y={H - PAD.bottom + 18} textAnchor="middle" className="chart-tick">
              {longest[idx] ? new Date(longest[idx].as_of).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : ""}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

