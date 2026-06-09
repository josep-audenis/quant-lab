import { Loader, Play } from "lucide-react";
import type { ExperimentSummary } from "../../api/experiments";

export function ExperimentDetail({
  experiment,
  onRun,
  running,
}: {
  experiment: ExperimentSummary;
  onRun: () => void;
  running: boolean;
}) {
  const blocks = experiment.strategy_program?.blocks ?? [];
  const healthFlags = preRunHealthFlags(experiment);
  return (
    <section className="detail-screen">
      <div className="detail-grid">
        <div className="detail-card">
          <p className="eyebrow">Hypothesis</p>
          <h2>{experiment.hypothesis}</h2>
        </div>
        <div className="detail-card">
          <p className="eyebrow">Strategy</p>
          <dl>
            <div>
              <dt>Kind</dt>
              <dd>{experiment.strategy.kind}</dd>
            </div>
            <div>
              <dt>Universe</dt>
              <dd>{experiment.strategy.universe.join(", ")}</dd>
            </div>
            <div>
              <dt>Blocks</dt>
              <dd>{blocks.length}</dd>
            </div>
          </dl>
        </div>
        <div className="detail-card">
          <p className="eyebrow">Backtest</p>
          <dl>
            <div>
              <dt>Window</dt>
              <dd>
                {experiment.backtest.start_date} {"->"} {experiment.backtest.end_date}
              </dd>
            </div>
            <div>
              <dt>Capital</dt>
              <dd>${experiment.backtest.initial_capital.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Benchmark</dt>
              <dd>{experiment.backtest.benchmark}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>{executionLabel(experiment.backtest.execution_timing)}</dd>
            </div>
            <div>
              <dt>Cash</dt>
              <dd>{cashPolicyLabel(experiment.backtest.cash_policy, experiment.backtest.risk_free_rate)}</dd>
            </div>
            <div>
              <dt>Turnover</dt>
              <dd>Annualized</dd>
            </div>
          </dl>
        </div>
      </div>
      {healthFlags.length > 0 && (
        <section className="detail-card">
          <p className="eyebrow">Pre-run data health</p>
          <div className="warnings-list">
            {healthFlags.map((flag) => (
              <div className={`warning-chip sev-${flag.severity}`} key={flag.code}>
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="detail-card">
        <p className="eyebrow">Rule blocks</p>
        <div className="block-list">
          {blocks.map((block) => (
            <div className="rule-chip" key={String(block.id)}>
              <span>{String(block.type)}</span>
              <code>{describeReadableBlock(block)}</code>
            </div>
          ))}
        </div>
      </section>
      {!experiment.result && (
        <div className="run-cta">
          <p>No results yet. Run the backtest to simulate this strategy against historical data.</p>
          <button className="btn primary lg" disabled={running} onClick={onRun}>
            {running ? <Loader size={15} className="spin" /> : <Play size={15} />}
            {running ? "Running..." : "Run backtest"}
          </button>
        </div>
      )}
    </section>
  );
}

// --- Sweep panel -------------------------------------------------------------

function describeReadableBlock(block: Record<string, unknown>) {
  if (block.type === "allocation") {
    const weights = block.weights as Record<string, number> | undefined;
    if (weights) {
      return Object.entries(weights)
        .map(([symbol, weight]) => `${symbol}: ${(weight * 100).toFixed(0)}%`)
        .join(", ");
    }
    return `Hold top ${block.top_n} ranked by ${block.ranking_ref}`;
  }
  if (block.type === "indicator") {
    if (block.indicator === "moving_average") {
      return `${block.symbol} close ${block.window}-period moving average`;
    }
    return `${block.lookback_months}-month momentum on ${(block.symbols as string[]).join(", ")}`;
  }
  if (block.type === "condition") {
    const condition = block.if as {
      left: { ref: string };
      operator: string;
      right: { ref: string };
    };
    const thenAction = Array.isArray(block.then) ? (block.then[0] as Record<string, unknown>) : {};
    const elseAction = Array.isArray(block.else) ? (block.else[0] as Record<string, unknown>) : {};
    return `If ${condition.left.ref} ${condition.operator} ${condition.right.ref}, set ${thenAction.symbol} to ${thenAction.weight}; otherwise cash ${elseAction.weight}.`;
  }
  return String(block.id);
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

function preRunHealthFlags(experiment: ExperimentSummary) {
  const flags: Array<{ code: string; severity: "info" | "caution" | "danger"; message: string }> = [];
  const start = new Date(experiment.backtest.start_date);
  const end = new Date(experiment.backtest.end_date);
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 3) {
    flags.push({ code: "short_window", severity: "caution", message: "Backtest window is under 3 years." });
  }
  if (!experiment.backtest.oos_start_date) {
    flags.push({ code: "no_oos", severity: "caution", message: "No out-of-sample split configured." });
  }
  if (!experiment.backtest.use_adjusted) {
    flags.push({ code: "raw_prices", severity: "danger", message: "Raw close ignores splits and dividends." });
  }
  const costs = experiment.backtest.cost_model.commission_bps + experiment.backtest.cost_model.slippage_bps;
  if (costs >= 10) {
    flags.push({ code: "high_costs", severity: "caution", message: `${costs} bps round-trip friction sensitivity risk.` });
  }
  if (experiment.strategy.universe.length < 5 && experiment.strategy.kind === "momentum_rotation") {
    flags.push({ code: "small_universe", severity: "caution", message: "Small hand-picked universe can overstate rotation results." });
  }
  flags.push({
    code: "survivorship",
    severity: "info",
    message: "ETF universe is user-selected, not point-in-time survivorship-safe.",
  });
  return flags;
}
