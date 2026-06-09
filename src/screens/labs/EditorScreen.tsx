import type { DraftExperimentPayload, ExperimentSummary } from "../../api/experiments";
import { ExperimentForm } from "../../components/ExperimentForm";
import { RuleWorkbench } from "../../components/RuleWorkbench";

export function EditorScreen({
  experiment,
  onBack,
  onDelete,
  onExport,
  onExportTearSheet,
  onRun,
  onSave,
  onSaveVariant,
  onWriteWiki,
  onCaptureQuestion,
}: {
  experiment: ExperimentSummary;
  onBack: () => void;
  onDelete: (experiment: ExperimentSummary) => void;
  onExport: (experiment: ExperimentSummary) => void;
  onExportTearSheet: (experiment: ExperimentSummary) => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onSave: (experiment: ExperimentSummary) => void;
  onSaveVariant: (experiment: ExperimentSummary, parameters: Record<string, number>) => Promise<void>;
  onWriteWiki: (experiment: ExperimentSummary) => Promise<void>;
  onCaptureQuestion: (experiment: ExperimentSummary, question: string) => Promise<void>;
}) {
  return (
    <section className="editor-screen">
      <RuleWorkbench
        experiment={experiment}
        onClose={onBack}
        onDelete={onDelete}
        onExport={onExport}
        onExportTearSheet={onExportTearSheet}
        onRun={onRun}
        onSave={onSave}
        onSaveVariant={onSaveVariant}
        onWriteWiki={onWriteWiki}
        onCaptureQuestion={onCaptureQuestion}
      />
    </section>
  );
}

// --- Comparison screen --------------------------------------------------------

