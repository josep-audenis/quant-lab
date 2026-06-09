import type { ExperimentSummary } from "../../api/experiments";
import { Hero } from "../../components/Hero";
import { NewLabCard } from "../../components/NewLabCard";
import { statusLabel } from "./screenHelpers";

export function ExperimentListScreen({
  experiments,
  search,
  onSearch,
  reviewFilter,
  onReviewFilter,
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
  reviewFilter: string;
  onReviewFilter: (value: string) => void;
  compareIds: string[];
  onCreate: () => void;
  onImport: () => void;
  onOpen: (experiment: ExperimentSummary) => void;
  onRun: (experiment: ExperimentSummary) => Promise<ExperimentSummary>;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
}) {
  const q = search.toLowerCase().trim();
  const searched = q
    ? experiments.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.strategy.kind.toLowerCase().includes(q) ||
          e.strategy.universe.some((s) => s.toLowerCase().includes(q)),
      )
    : experiments;
  const visible = reviewFilter === "all"
    ? searched
    : searched.filter((experiment) => experiment.result?.quant_review?.decision === reviewFilter);

  const canCompare = compareIds.length >= 2 && compareIds.length <= 5 && compareIds.every(
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
        <select className="search-input" value={reviewFilter} onChange={(e) => onReviewFilter(e.target.value)}>
          <option value="all">All reviews</option>
          <option value="promising">Promising</option>
          <option value="fragile">Fragile</option>
          <option value="overfit-risk">Overfit-risk</option>
          <option value="reject">Reject</option>
        </select>
        {compareIds.length > 0 && (
          <button className="btn" disabled={!canCompare} onClick={onCompare}>
            Compare {compareIds.length}
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

