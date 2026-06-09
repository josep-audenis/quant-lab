import { TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import type { BacktestResult, MetricSet } from "../../api/experiments";
import { cashPolicyLabel, executionLabel, pct } from "./formatters";

export function MetricsGrid({ metrics, benchmark }: { metrics: MetricSet; benchmark: string }) {
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

export function AssumptionsPanel({ result }: { result: BacktestResult }) {
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

export function ProvenancePanel({ result }: { result: BacktestResult }) {
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

export function AssumptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="assumption-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function MetricCard({
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

