import { ArrowLeft, Download, Loader, Pencil, Play, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExperimentSummary, SweepResult } from "../api/experiments";
import { sweepExperiment } from "../api/experiments";
import { RuleBuilder, type Block } from "./RuleBuilder";
import { ResultsPanel } from "./ResultsPanel";

type RuleWorkbenchMode = "view" | "setup" | "rules" | "results" | "sweep";

type RuleWorkbenchProps = {
  experiment: ExperimentSummary;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onClose: () => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onSave: (experiment: ExperimentSummary) => void;
};

export function RuleWorkbench({ experiment, onClose, onDelete, onExport, onRun, onSave }: RuleWorkbenchProps) {
  const [draft, setDraft] = useState(experiment);
  const [mode, setMode] = useState<RuleWorkbenchMode>("view");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runStage, setRunStage] = useState("");
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDraft(experiment);
    // If experiment just completed (has result), jump straight to results
    if (experiment.result) {
      setMode("results");
    } else {
      setMode("view");
    }
    setRunError(null);
  }, [experiment]);

  const blocks = draft.strategy_program?.blocks ?? [];
  const jsonPreview = useMemo(() => JSON.stringify(draft.strategy_program, null, 2), [draft]);

  function setBlocks(nextBlocks: Block[]) {
    setDraft((current) => {
      const universe = current.strategy_program?.universe ?? current.strategy.universe;
      return {
        ...current,
        strategy_program: {
          version: current.strategy_program?.version ?? 1,
          universe,
          blocks: nextBlocks,
        },
      };
    });
  }

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => +(e + 0.1).toFixed(1)), 100);
    try {
      const updated = await onRun(draft);
      setDraft(updated);
      setMode("results");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Run failed");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
    }
  }

  const hasResult = !!draft.result;

  return (
    <section className="workbench">
      <div className="workbench-head">
        <button className="iconbtn back-btn" onClick={onClose} title="Back to experiments">
          <ArrowLeft size={17} />
        </button>
        <div className="workbench-head-info">
          <p className="eyebrow">Rule editor</p>
          <h1>{draft.name}</h1>
          <p>{draft.hypothesis}</p>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => onExport(draft)}>
            <Download size={15} />
            Export
          </button>

          {mode === "view" || mode === "results" ? (
            <>
              <button className="btn" onClick={() => setMode("setup")}>
                <Pencil size={15} />
                Edit setup
              </button>
              <button className="btn" onClick={() => setMode("rules")}>
                <Pencil size={15} />
                Edit rules
              </button>
            </>
          ) : (
            <button
              className="btn"
              onClick={() => {
                onSave({ ...draft, result: null, status: "draft" });
                setMode("view");
              }}
            >
              <Save size={15} />
              Save
            </button>
          )}

          <div className="action-sep" />

          <button
            className="btn primary"
            disabled={running}
            onClick={() => void handleRun()}
          >
            {running ? <Loader size={15} className="spin" /> : <Play size={15} />}
            {running ? `${runStage || "Running..."} ${elapsed.toFixed(1)}s` : "Run backtest"}
          </button>

          {hasResult && (
            <button
              className={`btn ${mode === "results" ? "active-tab" : ""}`}
              onClick={() => setMode("results")}
            >
              Results
            </button>
          )}

          <button
            className={`btn ${mode === "sweep" ? "active-tab" : ""}`}
            onClick={() => setMode("sweep")}
          >
            Sweep
          </button>

          <div className="action-sep" />

          <button className="btn danger" onClick={() => onDelete(draft)}>
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>

      {runError && (
        <div className="run-error">
          <span>{runError}</span>
        </div>
      )}

      {mode === "sweep" ? (
        <SweepPanel experiment={draft} result={sweepResult} onResult={setSweepResult} />
      ) : mode === "results" && draft.result ? (
        <ResultsPanel
          result={draft.result}
          initialCapital={draft.backtest.initial_capital}
          benchmark={draft.backtest.benchmark}
        />
      ) : mode === "view" ? (
        <ExperimentDetail experiment={draft} onRun={() => void handleRun()} running={running} />
      ) : (
        <div className={`workbench-grid ${mode === "rules" ? "rules-focus" : "setup-focus"}`}>
          {mode === "setup" ? (
            <section className="setup-panel">
              <div className="panel-title">
                <span>Experiment setup</span>
                <strong>{draft.status}</strong>
              </div>
              <label className="field">
                <span>Name</span>
                <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <label className="field">
                <span>Hypothesis</span>
                <textarea
                  rows={4}
                  value={draft.hypothesis ?? ""}
                  onChange={(event) => setDraft({ ...draft, hypothesis: event.target.value })}
                />
              </label>
              <div className="setup-grid">
                <label className="field">
                  <span>Universe</span>
                  <input
                    value={draft.strategy.universe.join(", ")}
                    onChange={(event) => {
                      const universe = event.target.value
                        .split(",")
                        .map((symbol) => symbol.trim().toUpperCase())
                        .filter(Boolean);
                      setDraft({
                        ...draft,
                        strategy: { ...draft.strategy, universe },
                        strategy_program: draft.strategy_program
                          ? { ...draft.strategy_program, universe }
                          : draft.strategy_program,
                      });
                    }}
                  />
                </label>
                <label className="field">
                  <span>Benchmark</span>
                  <input
                    value={draft.backtest.benchmark}
                    onChange={(event) =>
                      setDraft({ ...draft, backtest: { ...draft.backtest, benchmark: event.target.value } })
                    }
                  />
                </label>
                <label className="field">
                  <span>Start</span>
                  <input
                    type="date"
                    value={draft.backtest.start_date}
                    onChange={(event) =>
                      setDraft({ ...draft, backtest: { ...draft.backtest, start_date: event.target.value } })
                    }
                  />
                </label>
                <label className="field">
                  <span>End</span>
                  <input
                    type="date"
                    value={draft.backtest.end_date}
                    onChange={(event) =>
                      setDraft({ ...draft, backtest: { ...draft.backtest, end_date: event.target.value } })
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {mode === "rules" ? (
            <section className="rules-panel">
              <div className="panel-title">
                <span>Executable blocks</span>
                <strong>{blocks.length}</strong>
              </div>
              <RuleBuilder
                blocks={blocks as Block[]}
                universe={draft.strategy_program?.universe ?? draft.strategy.universe}
                onChange={setBlocks}
              />
            </section>
          ) : null}

          <section className="program-panel">
            <div className="panel-title">
              <span>Compiled JSON</span>
              <strong>v{draft.strategy_program?.version ?? 1}</strong>
            </div>
            <pre>{jsonPreview}</pre>
          </section>
        </div>
      )}
    </section>
  );
}

function ExperimentDetail({
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

const SWEEP_PARAMS: Record<string, Array<{ key: string; label: string; defaultValues: string }>> = {
  moving_average_filter: [{ key: "window", label: "MA window", defaultValues: "50,100,150,200,250,300" }],
  momentum_rotation: [
    { key: "lookback_months", label: "Lookback months", defaultValues: "3,6,9,12,18" },
    { key: "top_n", label: "Top N", defaultValues: "1,2,3,4" },
  ],
  buy_and_hold: [],
};

function SweepPanel({
  experiment,
  result,
  onResult,
}: {
  experiment: ExperimentSummary;
  result: SweepResult | null;
  onResult: (r: SweepResult) => void;
}) {
  const kind = experiment.strategy.kind;
  const params = SWEEP_PARAMS[kind] ?? [];
  const [paramKey, setParamKey] = useState(params[0]?.key ?? "");
  const [valuesStr, setValuesStr] = useState(params[0]?.defaultValues ?? "");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSweep() {
    const values = valuesStr
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v) && v > 0);
    if (!values.length || !paramKey) return;
    setRunning(true);
    setError(null);
    try {
      const res = await sweepExperiment(experiment.id, paramKey, values);
      onResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setRunning(false);
    }
  }

  if (params.length === 0) {
    return (
      <div className="sweep-panel">
        <p className="muted-note">No sweep parameters available for {kind}.</p>
      </div>
    );
  }

  const maxReturn = result
    ? Math.max(...result.sweep.filter((p) => p.metrics).map((p) => p.metrics!.total_return))
    : 0;

  return (
    <div className="sweep-panel">
      <div className="sweep-form">
        <label className="field">
          <span>Parameter</span>
          <select
            value={paramKey}
            onChange={(e) => {
              setParamKey(e.target.value);
              const p = params.find((x) => x.key === e.target.value);
              if (p) setValuesStr(p.defaultValues);
            }}
          >
            {params.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Values (comma-separated)</span>
          <input value={valuesStr} onChange={(e) => setValuesStr(e.target.value)} />
        </label>
        <button className="btn primary" disabled={running} onClick={() => void handleSweep()}>
          {running ? <Loader size={14} className="spin" /> : null}
          {running ? "Running sweep..." : "Run sweep"}
        </button>
        {error && <p className="sweep-error">{error}</p>}
      </div>

      {result && (
        <div className="sweep-results">
          <p className="sect-label metrics-label">
            Sweep: {result.param} - {result.sweep.length} runs
          </p>
          <table className="sweep-table">
            <thead>
              <tr>
                <th>{result.param}</th>
                <th>Total return</th>
                <th>Ann. return</th>
                <th>Sharpe</th>
                <th>Max DD</th>
                <th>Turnover</th>
              </tr>
            </thead>
            <tbody>
              {result.sweep.map((pt) => {
                const m = pt.metrics;
                const best = m && m.total_return === maxReturn;
                return (
                  <tr key={pt.param_value} className={best ? "sweep-best" : ""}>
                    <td>{pt.param_value}</td>
                    {m ? (
                      <>
                        <td className={m.total_return >= 0 ? "pos" : "neg"}>
                          {m.total_return >= 0 ? "+" : ""}{(m.total_return * 100).toFixed(2)}%
                        </td>
                        <td>{(m.annualized_return * 100).toFixed(2)}%</td>
                        <td>{m.sharpe != null ? m.sharpe.toFixed(2) : "-"}</td>
                        <td className="neg">{(m.max_drawdown * 100).toFixed(2)}%</td>
                        <td>{m.turnover.toFixed(1)}x</td>
                      </>
                    ) : (
                      <td colSpan={5} className="muted-note">{pt.error ?? "failed"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
