import { Loader, RefreshCw } from "lucide-react";
import { useState } from "react";
import { getRobustnessReport, type ExperimentSummary, type RobustnessPoint, type RobustnessReport } from "../../api/experiments";
import { pct } from "../results/formatters";

export function RobustnessPanel({ experiment }: { experiment: ExperimentSummary }) {
  const [report, setReport] = useState<RobustnessReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setRunning(true);
    setError(null);
    try {
      setReport(await getRobustnessReport(experiment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load robustness report");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="robustness-panel">
      <div className="robustness-head">
        <div>
          <p className="sect-label metrics-label">Robustness lab</p>
          <h2>{report ? verdictLabel(report.verdict.decision) : "Sensitivity checks"}</h2>
          <p>{report?.verdict.summary ?? "Run cost, start-date, and parameter sensitivity against current experiment."}</p>
        </div>
        <button className="btn primary" disabled={running} onClick={() => void loadReport()}>
          {running ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
          {running ? "Running..." : report ? "Refresh" : "Run robustness"}
        </button>
      </div>

      {error ? <p className="sweep-error">{error}</p> : null}

      {report ? (
        <>
          <div className="robustness-verdict">
            <MetricPill label="Base return" value={pct(report.base_metrics.total_return)} />
            <MetricPill label="Base drawdown" value={pct(report.base_metrics.max_drawdown)} tone="bad" />
            <MetricPill label="Sharpe" value={report.base_metrics.sharpe != null ? report.base_metrics.sharpe.toFixed(2) : "-"} />
            <MetricPill label="Flags" value={report.verdict.flags.length ? report.verdict.flags.join(", ") : "None"} />
          </div>
          <SensitivityStrip title="Cost sensitivity" rows={report.cost_sensitivity} valueLabel="Round-trip bps" />
          <SensitivityStrip title="Start-date sensitivity" rows={report.start_date_sensitivity} valueLabel="Offset" />
          <SensitivityStrip title="Parameter sensitivity" rows={report.parameter_sensitivity} valueLabel="Variant" />
        </>
      ) : null}
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className={`robustness-pill ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SensitivityStrip({ title, rows, valueLabel }: { title: string; rows: RobustnessPoint[]; valueLabel: string }) {
  const valid = rows.filter((row) => row.metrics);
  if (!rows.length) {
    return (
      <section className="robustness-section">
        <p className="sect-label metrics-label">{title}</p>
        <p className="muted-note">No variants available.</p>
      </section>
    );
  }
  const min = valid.length ? Math.min(...valid.map((row) => row.metrics!.total_return)) : 0;
  const max = valid.length ? Math.max(...valid.map((row) => row.metrics!.total_return)) : 0;
  return (
    <section className="robustness-section">
      <p className="sect-label metrics-label">{title}</p>
      <div className="heatmap-row">
        {rows.map((row) => (
          <div key={`${row.param ?? valueLabel}-${row.label}`} className="heatmap-cell" style={{ background: heatColor(row.metrics?.total_return ?? null, min, max) }}>
            <span>{row.param ? `${row.param} ` : ""}{row.label}</span>
            <strong>{row.metrics ? pct(row.metrics.total_return) : "fail"}</strong>
            <small>{row.metrics ? `DD ${pct(row.metrics.max_drawdown)}` : row.error}</small>
          </div>
        ))}
      </div>
      <table className="sweep-table">
        <thead>
          <tr>
            <th>{valueLabel}</th>
            <th>Total return</th>
            <th>Sharpe</th>
            <th>Max DD</th>
            <th>Turnover</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`table-${row.param ?? valueLabel}-${row.label}`}>
              <td>{row.param ? `${row.param}=` : ""}{row.label}</td>
              {row.metrics ? (
                <>
                  <td className={row.metrics.total_return >= 0 ? "pos" : "neg"}>{pct(row.metrics.total_return)}</td>
                  <td>{row.metrics.sharpe != null ? row.metrics.sharpe.toFixed(2) : "-"}</td>
                  <td className="neg">{pct(row.metrics.max_drawdown)}</td>
                  <td>{row.metrics.turnover.toFixed(1)}x</td>
                </>
              ) : (
                <td colSpan={4} className="muted-note">{row.error ?? "failed"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function heatColor(value: number | null, min: number, max: number) {
  if (value == null) return "rgba(255, 94, 94, 0.15)";
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const red = Math.round(180 - t * 110);
  const green = Math.round(80 + t * 150);
  return `rgba(${red}, ${green}, 120, 0.35)`;
}

function verdictLabel(decision: string) {
  if (decision === "overfit-risk") return "Overfit risk";
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}
