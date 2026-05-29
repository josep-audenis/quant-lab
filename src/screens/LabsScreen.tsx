import { useEffect, useState } from "react";
import {
  createDraftExperiment,
  deleteExperiment,
  exportExperiment,
  importExperiment,
  listExperiments,
  updateExperiment,
  type DraftExperimentPayload,
  type ExperimentSummary,
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
  const [screen, setScreen] = useState<"list" | "editor">("list");

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
          onCreate={() => setIsCreating(true)}
          onImport={handleImport}
          onOpen={openEditor}
        />
      ) : selectedExperiment ? (
        <EditorScreen
          experiment={selectedExperiment}
          onBack={() => setScreen("list")}
          onDelete={(experiment) => void handleDelete(experiment)}
          onExport={(experiment) => void handleExport(experiment)}
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
  onCreate,
  onImport,
  onOpen,
}: {
  experiments: ExperimentSummary[];
  onCreate: () => void;
  onImport: () => void;
  onOpen: (experiment: ExperimentSummary) => void;
}) {
  return (
    <section className="experiments-screen">
      <div className="toolbar table-toolbar">
        <button className="btn primary" onClick={onCreate}>
          New
        </button>
        <button className="btn" onClick={onImport}>
          Import JSON
        </button>
      </div>
      <div className="quant-table">
        <div className="table-row table-head">
          <span>Name</span>
          <span>Strategy</span>
          <span>Universe</span>
          <span>Blocks</span>
          <span>Updated</span>
        </div>
        {experiments.map((experiment) => (
          <button className="table-row experiment-record" key={experiment.id} onClick={() => onOpen(experiment)}>
            <span>{experiment.name}</span>
            <span>{experiment.strategy.kind}</span>
            <span>{experiment.strategy.universe.join(", ")}</span>
            <span>{experiment.strategy_program?.blocks.length ?? 0}</span>
            <span>{new Date(experiment.updated_at).toLocaleDateString()}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EditorScreen({
  experiment,
  onBack,
  onDelete,
  onExport,
  onSave,
}: {
  experiment: ExperimentSummary;
  onBack: () => void;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onSave: (experiment: ExperimentSummary) => void;
}) {
  return (
    <section className="editor-screen">
      <RuleWorkbench
        experiment={experiment}
        onClose={onBack}
        onDelete={onDelete}
        onExport={onExport}
        onSave={onSave}
      />
    </section>
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
