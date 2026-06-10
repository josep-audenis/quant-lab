import { ArrowLeft, Download, Loader, Pencil, Play, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExperimentSummary, SweepResult } from "../api/experiments";
import { RuleBuilder, type Block } from "./RuleBuilder";
import { ResultsPanel } from "./ResultsPanel";
import { ExperimentDetail } from "./workbench/ExperimentDetail";
import { RobustnessPanel } from "./workbench/RobustnessPanel";
import { SweepPanel } from "./workbench/SweepPanel";

type RuleWorkbenchMode = "view" | "setup" | "rules" | "results" | "sweep" | "robustness";

type RuleWorkbenchProps = {
  experiment: ExperimentSummary;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onExportTearSheet: (experiment: ExperimentSummary) => void;
  onClose: () => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onSave: (experiment: ExperimentSummary) => void;
  onSaveVariant: (experiment: ExperimentSummary, parameters: Record<string, number>) => Promise<void>;
  onWriteWiki: (experiment: ExperimentSummary) => Promise<void>;
  onCaptureQuestion: (experiment: ExperimentSummary, question: string) => Promise<void>;
};

export function RuleWorkbench({ experiment, onClose, onDelete, onExport, onExportTearSheet, onRun, onSave, onSaveVariant, onWriteWiki, onCaptureQuestion }: RuleWorkbenchProps) {
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
          {draft.result && (
            <button className="btn" onClick={() => onExportTearSheet(draft)}>
              <Download size={15} />
              Tear sheet
            </button>
          )}
          {draft.result && (
            <button className="btn" onClick={() => void onWriteWiki(draft)}>
              Research memo
            </button>
          )}
          {draft.result && (
            <button
              className="btn"
              onClick={() => {
                const question = window.prompt("Open question to file");
                if (question?.trim()) void onCaptureQuestion(draft, question.trim());
              }}
            >
              File question
            </button>
          )}

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

          <button
            className={`btn ${mode === "robustness" ? "active-tab" : ""}`}
            onClick={() => setMode("robustness")}
          >
            Robustness
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

      {mode === "robustness" ? (
        <RobustnessPanel experiment={draft} />
      ) : mode === "sweep" ? (
        <SweepPanel experiment={draft} result={sweepResult} onResult={setSweepResult} onSaveVariant={onSaveVariant} />
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

