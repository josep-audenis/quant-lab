import { AlertTriangle, Info, Zap } from "lucide-react";
import type { BacktestResult, MetricSet, RegimeResult, RiskWarning, RollingMetricPoint } from "../../api/experiments";
import { AssumptionItem, MetricCard } from "./MetricsSections";
import { pct, signedNumber } from "./formatters";

export function OosPanel({
  result,
  isMetrics,
  oosMetrics,
  benchmark,
}: {
  result: BacktestResult;
  isMetrics: MetricSet;
  oosMetrics: MetricSet;
  benchmark: string;
}) {
  const analysis = result.oos_analysis;
  const rows: Array<{ label: string; is: string; oos: string; delta: string }> = [
    {
      label: "Total return",
      is: pct(isMetrics.total_return),
      oos: pct(oosMetrics.total_return),
      delta: pct(oosMetrics.total_return - isMetrics.total_return),
    },
    {
      label: "Ann. return",
      is: pct(isMetrics.annualized_return),
      oos: pct(oosMetrics.annualized_return),
      delta: analysis ? pct(analysis.annualized_return_delta) : pct(oosMetrics.annualized_return - isMetrics.annualized_return),
    },
    {
      label: "Volatility",
      is: `${(isMetrics.volatility * 100).toFixed(2)}%`,
      oos: `${(oosMetrics.volatility * 100).toFixed(2)}%`,
      delta: pct(oosMetrics.volatility - isMetrics.volatility),
    },
    {
      label: "Sharpe",
      is: isMetrics.sharpe != null ? isMetrics.sharpe.toFixed(2) : "-",
      oos: oosMetrics.sharpe != null ? oosMetrics.sharpe.toFixed(2) : "-",
      delta: analysis?.sharpe_delta != null ? signedNumber(analysis.sharpe_delta) : "-",
    },
    {
      label: "Max drawdown",
      is: pct(isMetrics.max_drawdown),
      oos: pct(oosMetrics.max_drawdown),
      delta: analysis ? pct(analysis.max_drawdown_delta) : pct(oosMetrics.max_drawdown - isMetrics.max_drawdown),
    },
    {
      label: `${benchmark} total`,
      is: isMetrics.benchmark_total_return != null ? pct(isMetrics.benchmark_total_return) : "-",
      oos: oosMetrics.benchmark_total_return != null ? pct(oosMetrics.benchmark_total_return) : "-",
      delta:
        isMetrics.benchmark_total_return != null && oosMetrics.benchmark_total_return != null
          ? pct(oosMetrics.benchmark_total_return - isMetrics.benchmark_total_return)
          : "-",
    },
  ];

  const oosRetColor = analysis?.verdict === "degraded" ? "neg" : "pos";

  return (
    <div className="oos-section">
      <p className="sect-label metrics-label">
        In-sample vs out-of-sample
        <span className={`oos-badge ${oosRetColor}`}>
          {analysis ? analysis.verdict : `OOS ${pct(oosMetrics.total_return)}`}
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
                <td>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BootstrapStressPanel({ result }: { result: BacktestResult }) {
  const stress = result.bootstrap_stress;
  if (!stress) return null;
  return (
    <div className="stress-section">
      <p className="sect-label metrics-label">Bootstrap stress</p>
      <div className="stress-grid">
        <MetricCard label="Loss probability" value={pct(stress.loss_probability)} sub={`${stress.simulations} resamples`} color={stress.loss_probability > 0.35 ? "neg" : "pos"} />
        <MetricCard label="Severe drawdown" value={pct(stress.severe_drawdown_probability)} sub={`Drawdown below -25%`} color={stress.severe_drawdown_probability > 0.25 ? "neg" : "pos"} />
        <MetricCard label="Terminal p05" value={pct(stress.terminal_p05)} sub={`${stress.horizon_days} trading days`} color={stress.terminal_p05 < 0 ? "neg" : "pos"} />
        <MetricCard label="Terminal p50" value={pct(stress.terminal_p50)} sub="Median path" color={stress.terminal_p50 < 0 ? "neg" : "pos"} />
        <MetricCard label="Terminal p95" value={pct(stress.terminal_p95)} sub="Upside path" color={stress.terminal_p95 < 0 ? "neg" : "pos"} />
        <MetricCard label="DD p50" value={pct(stress.max_drawdown_p50)} sub="Median max drawdown" color="neg" />
      </div>
    </div>
  );
}

export function QuantReviewPanel({ result }: { result: BacktestResult }) {
  const review = result.quant_review;
  if (!review) return null;
  return (
    <div className="review-section">
      <p className="sect-label metrics-label">
        Deterministic review
        <span className={`oos-badge ${review.decision === "promising" ? "pos" : "neg"}`}>
          {review.decision} - {review.credibility_score.toFixed(0)}/100
        </span>
      </p>
      <p className="review-summary">{review.summary}</p>
      <div className="review-grid">
        <div>
          <strong>Credibility checklist</strong>
          {review.checklist.map((item) => (
            <div className={`check-row ${item.passed ? "passed" : "failed"}`} key={item.code}>
              <span>{item.passed ? "Pass" : "Fail"}</span>
              <p>{item.label}</p>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <div>
          <strong>Review flags</strong>
          {review.flags.length === 0 ? (
            <p className="muted-note">No deterministic flags.</p>
          ) : review.flags.map((flag) => (
            <div className={`warning-chip sev-${flag.severity}`} key={flag.code}>
              <span>{flag.label}: {flag.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DataReliabilityPanel({ result }: { result: BacktestResult }) {
  const data = result.data_reliability;
  if (!data) return null;
  const color = data.score >= 90 ? "pos" : data.score >= 75 ? "" : "neg";
  return (
    <div className="assumptions-section">
      <p className="sect-label metrics-label">Data reliability</p>
      <div className="assumption-grid">
        <AssumptionItem label="Score" value={`${data.score.toFixed(1)}/100`} />
        <AssumptionItem label="Coverage gap" value={`${data.missing_bars}/${data.expected_bars} bars`} />
        <AssumptionItem label="Stale cache" value={data.stale_symbols.length ? data.stale_symbols.join(", ") : "None"} />
        <AssumptionItem label="Source mismatch" value={data.source_mismatches.length ? data.source_mismatches.join(", ") : "None"} />
      </div>
      <p className={`metric-sub ${color}`}>Data score drives trust in every downstream metric.</p>
    </div>
  );
}

export function PortfolioRiskPanel({ result }: { result: BacktestResult }) {
  const risk = result.portfolio_risk;
  if (!risk) return null;
  return (
    <div className="assumptions-section">
      <p className="sect-label metrics-label">Portfolio risk</p>
      <div className="assumption-grid">
        <AssumptionItem label="Max exposure" value={pct(risk.max_exposure)} />
        <AssumptionItem label="Avg exposure" value={pct(risk.average_exposure)} />
        <AssumptionItem
          label="Top traded"
          value={risk.top_traded_symbol ? `${risk.top_traded_symbol} (${pct(risk.top_traded_share)})` : "-"}
        />
        <AssumptionItem
          label="Avg correlation"
          value={risk.average_pairwise_correlation != null ? risk.average_pairwise_correlation.toFixed(2) : "-"}
        />
        <AssumptionItem
          label="Crowded pairs"
          value={risk.high_correlation_pairs.length ? risk.high_correlation_pairs.join(", ") : "None"}
        />
      </div>
    </div>
  );
}

export function RollingMetricsPanel({ points }: { points: RollingMetricPoint[] }) {
  const latest = [...points]
    .sort((a, b) => b.as_of.localeCompare(a.as_of))
    .filter((point, index, list) => list.findIndex((item) => item.window === point.window) === index);
  return (
    <div className="oos-section">
      <p className="sect-label metrics-label">Rolling stability</p>
      <div className="oos-table-wrap">
        <table className="oos-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>As of</th>
              <th>Total</th>
              <th>Ann.</th>
              <th>Sharpe</th>
              <th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((point) => (
              <tr key={point.window}>
                <td>{point.window}</td>
                <td>{point.as_of}</td>
                <td className={point.total_return >= 0 ? "pos" : "neg"}>{pct(point.total_return)}</td>
                <td>{pct(point.annualized_return)}</td>
                <td>{point.sharpe != null ? point.sharpe.toFixed(2) : "-"}</td>
                <td className="neg">{pct(point.max_drawdown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RegimePanel({ regimes }: { regimes: RegimeResult[] }) {
  return (
    <div className="oos-section">
      <p className="sect-label metrics-label">Regime windows</p>
      <div className="oos-table-wrap">
        <table className="oos-table">
          <thead>
            <tr>
              <th>Regime</th>
              <th>Window</th>
              <th>Total</th>
              <th>Sharpe</th>
              <th>Max DD</th>
              <th>Vs benchmark</th>
            </tr>
          </thead>
          <tbody>
            {regimes.map((regime) => (
              <tr key={regime.name}>
                <td>{regime.name}</td>
                <td>{regime.start_date} to {regime.end_date}</td>
                <td className={regime.metrics.total_return >= 0 ? "pos" : "neg"}>{pct(regime.metrics.total_return)}</td>
                <td>{regime.metrics.sharpe != null ? regime.metrics.sharpe.toFixed(2) : "-"}</td>
                <td className="neg">{pct(regime.metrics.max_drawdown)}</td>
                <td>{regime.metrics.benchmark_total_return != null ? pct(regime.metrics.benchmark_total_return) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Attribution chart -------------------------------------------------------

export function WarningsList({ warnings }: { warnings: RiskWarning[] }) {
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

