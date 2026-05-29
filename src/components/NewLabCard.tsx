import { FileUp, Plus } from "lucide-react";

type NewLabCardProps = {
  onCreate: () => void;
  onImport: () => void;
  status: "loading" | "ready" | "error";
};

export function NewLabCard({ onCreate, onImport, status }: NewLabCardProps) {
  const copy =
    status === "error"
      ? "Start the FastAPI backend, then create or import experiment JSON."
      : "Create a new experiment or import an experiment JSON exported from QuantLab.";

  return (
    <section className="empty-state">
      <div className="empty-copy">
        <h2>No experiments loaded</h2>
        <p>{copy}</p>
      </div>
      <div className="empty-actions">
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          New experiment
        </button>
        <button className="btn" onClick={onImport}>
          <FileUp size={16} />
          Import JSON
        </button>
      </div>
    </section>
  );
}
