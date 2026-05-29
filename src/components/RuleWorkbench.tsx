import { ArrowLeft, Download, Pencil, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExperimentSummary } from "../api/experiments";

type RuleWorkbenchProps = {
  experiment: ExperimentSummary;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onClose: () => void;
  onSave: (experiment: ExperimentSummary) => void;
};

export function RuleWorkbench({ experiment, onClose, onDelete, onExport, onSave }: RuleWorkbenchProps) {
  const [draft, setDraft] = useState(experiment);
  const [mode, setMode] = useState<"view" | "setup" | "rules">("view");

  useEffect(() => {
    setDraft(experiment);
    setMode("view");
  }, [experiment]);

  const blocks = draft.strategy_program?.blocks ?? [];
  const jsonPreview = useMemo(() => JSON.stringify(draft.strategy_program, null, 2), [draft]);

  function updateBlock(index: number, patch: Record<string, unknown>) {
    setDraft((current) => {
      const currentProgram = current.strategy_program ?? {
        version: 1,
        universe: current.strategy.universe,
        blocks: [],
      };
      const nextBlocks = currentProgram.blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      );
      return {
        ...current,
        strategy_program: {
          ...currentProgram,
          blocks: nextBlocks,
        },
      };
    });
  }

  return (
    <section className="workbench">
      <div className="workbench-head">
        <button className="iconbtn back-btn" onClick={onClose} title="Back to experiments">
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="eyebrow">Rule editor</p>
          <h1>{draft.name}</h1>
          <p>{draft.hypothesis}</p>
        </div>
        <div className="row-actions">
          <button className="btn" onClick={() => onExport(draft)}>
            <Download size={15} />
            Export
          </button>
          {mode === "view" ? (
            <>
              <button className="btn" onClick={() => setMode("setup")}>
                <Pencil size={15} />
                Edit setup
              </button>
              <button className="btn primary" onClick={() => setMode("rules")}>
                <Pencil size={15} />
                Edit rules
              </button>
            </>
          ) : (
          <button
            className="btn primary"
            onClick={() => {
              onSave(draft);
              setMode("view");
            }}
          >
            <Save size={15} />
            Save
          </button>
          )}
          <button className="btn danger" onClick={() => onDelete(draft)}>
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>

      {mode === "view" ? (
        <ExperimentDetail experiment={draft} />
      ) : (
      <div className={`workbench-grid ${mode === "rules" ? "rules-focus" : "setup-focus"}`}>
        {mode === "setup" ? <section className="setup-panel">
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
        </section> : null}

        {mode === "rules" ? <section className="rules-panel">
          <div className="panel-title">
            <span>Executable blocks</span>
            <strong>{blocks.length}</strong>
          </div>
          <div className="rule-flow">
            {blocks.map((block, index) => (
              <RuleBlockEditor
                block={block}
                index={index}
                key={String(block.id)}
                universe={draft.strategy_program?.universe ?? draft.strategy.universe}
                onChange={(patch) => updateBlock(index, patch)}
              />
            ))}
          </div>
        </section> : null}

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

function ExperimentDetail({ experiment }: { experiment: ExperimentSummary }) {
  const blocks = experiment.strategy_program?.blocks ?? [];
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
                {experiment.backtest.start_date} to {experiment.backtest.end_date}
              </dd>
            </div>
            <div>
              <dt>Capital</dt>
              <dd>{experiment.backtest.initial_capital.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Benchmark</dt>
              <dd>{experiment.backtest.benchmark}</dd>
            </div>
          </dl>
        </div>
      </div>
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
    </section>
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

function RuleBlockEditor({
  block,
  index,
  onChange,
  universe,
}: {
  block: Record<string, unknown>;
  index: number;
  onChange: (patch: Record<string, unknown>) => void;
  universe: string[];
}) {
  if (block.type === "indicator") {
    return (
      <article className="rule-node">
        <div className="node-index">{index + 1}</div>
        <div className="node-body">
          <div className="node-title">
            <span>Indicator</span>
            <strong>{String(block.indicator)}</strong>
          </div>
          {block.indicator === "moving_average" ? (
            <div className="node-grid">
              <label className="field">
                <span>Symbol</span>
                <select value={String(block.symbol)} onChange={(event) => onChange({ symbol: event.target.value })}>
                  {universe.map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Window</span>
                <input
                  min="1"
                  type="number"
                  value={Number(block.window ?? 1)}
                  onChange={(event) => onChange({ window: Number(event.target.value) })}
                />
              </label>
            </div>
          ) : (
            <div className="node-grid">
              <label className="field">
                <span>Lookback months</span>
                <input
                  min="1"
                  type="number"
                  value={Number(block.lookback_months ?? 1)}
                  onChange={(event) => onChange({ lookback_months: Number(event.target.value) })}
                />
              </label>
            </div>
          )}
        </div>
      </article>
    );
  }

  if (block.type === "condition") {
    const condition = block.if as {
      left: { ref: string };
      operator: string;
      right: { ref: string };
    };
    const thenAction = Array.isArray(block.then) ? (block.then[0] as Record<string, unknown>) : {};
    const elseAction = Array.isArray(block.else) ? (block.else[0] as Record<string, unknown>) : {};
    return (
      <article className="rule-node condition-node">
        <div className="node-index">{index + 1}</div>
        <div className="node-body">
          <div className="node-title">
            <span>Condition</span>
            <strong>if / then / else</strong>
          </div>
          <div className="condition-line">
            <code>{condition.left.ref}</code>
            <select
              value={condition.operator}
              onChange={(event) =>
                onChange({ if: { ...condition, operator: event.target.value } })
              }
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>
            <code>{condition.right.ref}</code>
          </div>
          <div className="node-grid">
            <label className="field">
              <span>Then symbol</span>
              <select
                value={String(thenAction.symbol ?? universe[0] ?? "")}
                onChange={(event) =>
                  onChange({
                    then: [{ ...thenAction, action: "set_weight", symbol: event.target.value }],
                  })
                }
              >
                {universe.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Then weight</span>
              <input
                max="1"
                min="0"
                step="0.05"
                type="number"
                value={Number(thenAction.weight ?? 1)}
                onChange={(event) =>
                  onChange({
                    then: [{ ...thenAction, action: "set_weight", weight: Number(event.target.value) }],
                  })
                }
              />
            </label>
            <label className="field">
              <span>Else cash</span>
              <input
                max="1"
                min="0"
                step="0.05"
                type="number"
                value={Number(elseAction.weight ?? 1)}
                onChange={(event) =>
                  onChange({
                    else: [{ action: "set_cash", weight: Number(event.target.value) }],
                  })
                }
              />
            </label>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rule-node">
      <div className="node-index">{index + 1}</div>
      <div className="node-body">
        <div className="node-title">
          <span>Allocation</span>
          <strong>target weights</strong>
        </div>
        <div className="node-grid">
          {universe.map((symbol) => {
            const weights = (block.weights as Record<string, number>) ?? {};
            return (
              <label className="field" key={symbol}>
                <span>{symbol} weight</span>
                <input
                  max="1"
                  min="0"
                  step="0.05"
                  type="number"
                  value={Number(weights[symbol] ?? 0)}
                  onChange={(event) =>
                    onChange({ weights: { ...weights, [symbol]: Number(event.target.value) } })
                  }
                />
              </label>
            );
          })}
        </div>
      </div>
    </article>
  );
}
