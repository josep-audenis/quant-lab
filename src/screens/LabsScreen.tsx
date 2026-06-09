import { useEffect, useState } from "react";
import {
  captureOpenQuestion,
  createDraftExperiment,
  createExperimentVariant,
  deleteExperiment,
  exportExperiment,
  exportTearSheet,
  importExperiment,
  listExperiments,
  runExperimentAsync,
  updateExperiment,
  writeExperimentWikiSummary,
  type DraftExperimentPayload,
  type ExperimentSummary,
} from "../api/experiments";
import { ExperimentForm } from "../components/ExperimentForm";
import { Hero } from "../components/Hero";
import { NewLabCard } from "../components/NewLabCard";
import { RuleWorkbench } from "../components/RuleWorkbench";
import { ComparisonScreen } from "./labs/ComparisonScreen";
import { EditorScreen } from "./labs/EditorScreen";
import { ExperimentListScreen } from "./labs/ExperimentListScreen";
import { statusLabel } from "./labs/screenHelpers";

export function LabsScreen() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<"list" | "editor" | "compare">("list");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");

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

  async function handleExportTearSheet(experiment: ExperimentSummary) {
    try {
      const blob = await exportTearSheet(experiment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experiment.id}_tear_sheet.md`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported tear sheet ${experiment.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to export tear sheet");
    }
  }

  async function handleSaveVariant(experiment: ExperimentSummary, parameters: Record<string, number>) {
    try {
      const label = Object.entries(parameters).map(([key, value]) => `${key} ${value}`).join(", ");
      const saved = await createExperimentVariant(experiment.id, `${experiment.name} - ${label}`, parameters);
      setMessage(`Saved variant ${saved.name}`);
      await refreshExperiments(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save variant");
    }
  }

  async function handleWriteWiki(experiment: ExperimentSummary) {
    try {
      const result = await writeExperimentWikiSummary(experiment.id);
      setMessage(`Wrote wiki summary ${result.page}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to write wiki summary");
    }
  }

  async function handleCaptureQuestion(experiment: ExperimentSummary, question: string) {
    try {
      await captureOpenQuestion(experiment.id, question);
      setMessage("Filed open question");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to file question");
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
          reviewFilter={reviewFilter}
          onReviewFilter={setReviewFilter}
          compareIds={compareIds}
          onCreate={() => setIsCreating(true)}
          onImport={handleImport}
          onOpen={openEditor}
          onRun={handleRunExperiment}
          onToggleCompare={(id) =>
            setCompareIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev,
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
          onExportTearSheet={(experiment) => void handleExportTearSheet(experiment)}
          onRun={handleRunExperiment}
          onSave={(experiment) => void handleSaveExperiment(experiment)}
          onSaveVariant={(experiment, parameters) => handleSaveVariant(experiment, parameters)}
          onWriteWiki={(experiment) => handleWriteWiki(experiment)}
          onCaptureQuestion={(experiment, question) => handleCaptureQuestion(experiment, question)}
        />
      ) : (
        <NewLabCard onCreate={() => setIsCreating(true)} onImport={handleImport} status={status} />
      )}
    </div>
  );
}

