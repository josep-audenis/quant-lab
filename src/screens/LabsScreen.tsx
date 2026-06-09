import { useEffect, useState } from "react";
import {
  createDraftExperiment,
  deleteExperiment,
  exportExperiment,
  importExperiment,
  listExperiments,
  runExperimentAsync,
  updateExperiment,
  type BenchmarkPoint,
  type DraftExperimentPayload,
  type ExperimentSummary,
  type PortfolioSnapshot,
} from "../api/experiments";
import { ExperimentForm } from "../components/ExperimentForm";
import { Hero } from "../components/Hero";
import { NewLabCard } from "../components/NewLabCard";
import { RuleWorkbench } from "../components/RuleWorkbench";

export function LabsScreen() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<"list" | "editor" | "compare">("list");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  async function refreshExperiments(nextSelectedId?: string | null) {
    setStatus("loading");
    try {
      const response = await listExperiments();
      setExperiments(response.experiments);
      setSelectedId((current) => nextSelectedId ?? current ?? response.experiments[0]?.id ?? null);
      setStatus("ready");
      setMessage(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to load experiments");
    }
  }

  useEffect(() => {
    void refreshExperiments();
  }, []);

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        const payload = JSON.parse(await file.text());
        const experiment = await importExperiment(payload);
        setMessage(`Imported ${experiment.name}`);
        await refreshExperiments(experiment.id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to import experiment");
      }
    };
    input.click();
  }

  async function handleCreate(payload: DraftExperimentPayload) {
    try {
      const experiment = await createDraftExperiment(payload);
      setMessage(`Created ${experiment.name}`);
      setIsCreating(false);
      await refreshExperiments(experiment.id);
      setScreen("editor");
      void handleRunExperiment(experiment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save experiment");
    }
  }

  async function handleCreateCustom(draft: ExperimentSummary) {
    try {
      const experiment = await importExperiment({ experiment: draft });
      setMessage(`Created ${experiment.name}`);
      setIsCreating(false);
      await refreshExperiments(experiment.id);
      setScreen("editor");
      void handleRunExperiment(experiment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save experiment");
    }
  }

  async function handleExport(experiment: ExperimentSummary) {
    try {
      const blob = await exportExperiment(experiment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experiment.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${experiment.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to export experiment");
    }
  }

  async function handleDelete(experiment: ExperimentSummary) {
    const confirmed = window.confirm(
      `Delete "${experiment.name}"? This removes the local JSON file and cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteExperiment(experiment.id);
      setMessage(`Deleted ${experiment.name}`);
      setScreen("list");
      await refreshExperiments(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete experiment");
    }
  }

  async function handleSaveExperiment(experiment: ExperimentSummary) {
    try {
      const saved = await updateExperiment(experiment);
      setMessage(`Saved ${saved.name}`);
      await refreshExperiments(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save experiment");
    }
  }

  const STAGE_LABELS: Record<string, string> = {
    starting: "Starting...",
    fetching_data: "Fetching data...",
    simulating: "Simulating...",
    saving: "Saving...",
  };

  async function handleRunExperiment(experiment: ExperimentSummary): Promise<ExperimentSummary> {
    const result = await runExperimentAsync(experiment.id, (stage) => {
      setMessage(STAGE_LABELS[stage] ?? stage);
    });
    setExperiments((prev) => prev.map((e) => (e.id === result.id ? result : e)));
    setMessage(`Backtest complete - ${result.name}`);
    return result;
  }

  const selectedExperiment =
    experiments.find((experiment) => experiment.id === selectedId) ?? experiments[0] ?? null;

  function openEditor(experiment: ExperimentSummary) {
    setSelectedId(experiment.id);
    setScreen("editor");
  }

  if (isCreating) {
    return (
      <div className="wrap workspace-wrap create-wrap">
        {message ? <div className="notice">{message}</div> : null}
        <ExperimentForm
          experiment={null}
          mode="create"
          onCancel={() => setIsCreating(false)}
          onSubmit={(payload) => void handleCreate(payload)}
          onSubmitCustom={(draft) => void handleCreateCustom(draft)}
        />
      </div>
    );
  }

  return (
    <div className="wrap workspace-wrap">
      {screen === "list" ? (
        <>
          <Hero onCreate={() => setIsCreating(true)} />
          <div className="labs-bar">
            <div className="sect-label">Experiments - {experiments.length}</div>
            <div className="sect-label faint">{statusLabel(status)}</div>
          </div>
        </>
      ) : null}

      {message ? <div className="notice">{message}</div> : null}

      {experiments.length === 0 ? (
        <NewLabCard onCreate={() => setIsCreating(true)} onImport={handleImport} status={status} />
      ) : screen === "list" ? (
        <ExperimentListScreen
          experiments={experiments}
          search={search}
          onSearch={setSearch}
          compareIds={compareIds}
          onCreate={() => setIsCreating(true)}
          onImport={handleImport}
          onOpen={openEditor}
          onRun={handleRunExperiment}
          onToggleCompare={(id) =>
            setCompareIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onCompare={() => setScreen("compare")}
        />
      ) : screen === "compare" ? (
        <ComparisonScreen
          experiments={experiments.filter((e) => compareIds.includes(e.id))}
          onBack={() => setScreen("list")}
        />
      ) : selectedExperiment ? (
        <EditorScreen
          experiment={selectedExperiment}
          onBack={() => setScreen("list")}
          onDelete={(experiment) => void handleDelete(experiment)}
          onExport={(experiment) => void handleExport(experiment)}
          onRun={handleRunExperiment}
          onSave={(experiment) => void handleSaveExperiment(experiment)}
        />
      ) : (
        <NewLabCard onCreate={() => setIsCreating(true)} onImport={handleImport} status={status} />
      )}
    </div>
  );
}

function ExperimentListScreen({
  experiments,
  search,
  onSearch,
  compareIds,
  onCreate,
  onImport,
  onOpen,
  onRun,
  onToggleCompare,
  onCompare,
}: {
  experiments: ExperimentSummary[];
  search: string;
  onSearch: (s: string) => void;
  compareIds: string[];
  onCreate: () => void;
  onImport: () => void;
  onOpen: (experiment: ExperimentSummary) => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
}) {
  const q = search.toLowerCase().trim();
  const visible = q
    ? experiments.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.strategy.kind.toLowerCase().includes(q) ||
          e.strategy.universe.some((s) => s.toLowerCase().includes(q)),
      )
    : experiments;

  const canCompare = compareIds.length === 2 && compareIds.every(
    (id) => experiments.find((e) => e.id === id)?.result != null,
  );
  return (
    <section className="experiments-screen">
      <div className="toolbar table-toolbar">
        <button className="btn primary" onClick={onCreate}>
          New
        </button>
        <button className="btn" onClick={onImport}>
          Import JSON
        </button>
        <input
          className="search-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {compareIds.length > 0 && (
          <button className="btn" disabled={!canCompare} onClick={onCompare}>
            Compare {compareIds.length === 2 ? "2" : `(${compareIds.length}/2)`}
          </button>
        )}
      </div>
      <div className="quant-table">
        <div className="table-row table-head">
          <span style={{ width: 28 }}></span>
          <span>Name</span>
          <span>Strategy</span>
          <span>Universe</span>
          <span>Return</span>
          <span>Status</span>
          <span>Updated</span>
          <span></span>
        </div>
        {visible.map((experiment) => {
          const ret = experiment.result?.metrics.total_return ?? null;
          const checked = compareIds.includes(experiment.id);
          return (
            <div className="table-row experiment-record" key={experiment.id}>
              <span style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!experiment.result && !checked}
                  onChange={() => onToggleCompare(experiment.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "pointer" }}
                />
              </span>
              <span style={{ cursor: "pointer" }} onClick={() => onOpen(experiment)}>
                {experiment.name}
              </span>
              <span onClick={() => onOpen(experiment)} style={{ cursor: "pointer" }}>
                {experiment.strategy.kind}
              </span>
              <span onClick={() => onOpen(experiment)} style={{ cursor: "pointer" }}>
                {experiment.strategy.universe.join(", ")}
              </span>
              <span className={ret == null ? "" : ret >= 0 ? "pos" : "neg"}>
                {ret == null ? "-" : `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%`}
              </span>
              <span onClick={() => onOpen(experiment)} style={{ cursor: "pointer" }}>
                <span className={`status-chip status-${experiment.status}`}>{experiment.status}</span>
              </span>
              <span onClick={() => onOpen(experiment)} style={{ cursor: "pointer" }}>
                {new Date(experiment.updated_at).toLocaleDateString()}
              </span>
              <span>
                <button
                  className="btn"
                  style={{ padding: "3px 10px", fontSize: "12px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onRun(experiment);
                  }}
                >
                  Run
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EditorScreen({
  experiment,
  onBack,
  onDelete,
  onExport,
  onRun,
  onSave,
}: {
  experiment: ExperimentSummary;
  onBack: () => void;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onSave: (experiment: ExperimentSummary) => void;
}) {
  return (
    <section className="editor-screen">
      <RuleWorkbench
        experiment={experiment}
        onClose={onBack}
        onDelete={onDelete}
        onExport={onExport}
        onRun={onRun}
        onSave={onSave}
      />
    </section>
  );
}

// --- Comparison screen --------------------------------------------------------

const COMPARE_COLORS = ["var(--accent)", "#4cdf88"] as const;

function ComparisonScreen({
  experiments,
  onBack,
}: {
  experiments: ExperimentSummary[];
  onBack: () => void;
}) {
  const [a, b] = experiments;
  if (!a?.result || !b?.result) return null;

  return (
    <section className="workbench comparison-screen">
      <div className="workbench-head">
        <button className="iconbtn back-btn" onClick={onBack}>
          Back
        </button>
        <div className="workbench-head-info">
          <p className="eyebrow">Comparison</p>
          <h1>{a.name} vs {b.name}</h1>
        </div>
      </div>

      <div className="comparison-body">
        <ComparisonMetrics experiments={experiments} />
        <ComparisonChart experiments={experiments} />
      </div>
    </section>
  );
}

function ComparisonMetrics({ experiments }: { experiments: ExperimentSummary[] }) {
  const rows: Array<{ label: string; fmt: (m: NonNullable<ExperimentSummary["result"]>["metrics"]) => string }> = [
    { label: "Total return", fmt: (m) => `${m.total_return >= 0 ? "+" : ""}${(m.total_return * 100).toFixed(2)}%` },
    { label: "Ann. return", fmt: (m) => `${m.annualized_return >= 0 ? "+" : ""}${(m.annualized_return * 100).toFixed(2)}%` },
    { label: "Volatility", fmt: (m) => `${(m.volatility * 100).toFixed(2)}%` },
    { label: "Sharpe", fmt: (m) => m.sharpe != null ? m.sharpe.toFixed(2) : "-" },
    { label: "Max drawdown", fmt: (m) => `${(m.max_drawdown * 100).toFixed(2)}%` },
    { label: "Turnover", fmt: (m) => `${m.turnover.toFixed(1)}x` },
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
                <td key={e.id}>{e.result ? row.fmt(e.result.metrics) : "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonChart({ experiments }: { experiments: ExperimentSummary[] }) {
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

function statusLabel(status: "loading" | "ready" | "error") {
  if (status === "loading") {
    return "Loading API";
  }
  if (status === "error") {
    return "API offline";
  }
  return "API connected";
}
