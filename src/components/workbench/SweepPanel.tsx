import { Loader } from "lucide-react";
import { Fragment, useState } from "react";
import type { ExperimentSummary, SweepResult } from "../../api/experiments";
import { sweepExperiment } from "../../api/experiments";

const SWEEP_PARAMS: Record<string, Array<{ key: string; label: string; defaultValues: string }>> = {
  moving_average_filter: [{ key: "window", label: "MA window", defaultValues: "50,100,150,200,250,300" }],
  momentum_rotation: [
    { key: "lookback_months", label: "Lookback months", defaultValues: "3,6,9,12,18" },
    { key: "top_n", label: "Top N", defaultValues: "1,2,3,4" },
  ],
  buy_and_hold: [],
};

export function SweepPanel({
  experiment,
  result,
  onResult,
  onSaveVariant,
}: {
  experiment: ExperimentSummary;
  result: SweepResult | null;
  onResult: (r: SweepResult) => void;
  onSaveVariant: (experiment: ExperimentSummary, parameters: Record<string, number>) => Promise<void>;
}) {
  const kind = experiment.strategy.kind;
  const params = SWEEP_PARAMS[kind] ?? [];
  const [paramKey, setParamKey] = useState(params[0]?.key ?? "");
  const [valuesStr, setValuesStr] = useState(params[0]?.defaultValues ?? "");
  const [useGrid, setUseGrid] = useState(params.length > 1);
  const [paramBKey, setParamBKey] = useState(params[1]?.key ?? "");
  const [valuesBStr, setValuesBStr] = useState(params[1]?.defaultValues ?? "");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSweep() {
    const values = valuesStr
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v) && v > 0);
    if (!values.length || !paramKey) return;
    const valuesB = valuesBStr
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v) && v > 0);
    setRunning(true);
    setError(null);
    try {
      const res = await sweepExperiment(
        experiment.id,
        paramKey,
        values,
        useGrid && paramBKey ? paramBKey : undefined,
        useGrid && paramBKey ? valuesB : undefined,
      );
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
              const nextSecond = params.find((x) => x.key !== e.target.value);
              if (nextSecond) {
                setParamBKey(nextSecond.key);
                setValuesBStr(nextSecond.defaultValues);
              }
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
        {params.length > 1 && (
          <>
            <label className="field checkbox-field">
              <span>Heatmap grid</span>
              <input type="checkbox" checked={useGrid} onChange={(e) => setUseGrid(e.target.checked)} />
            </label>
            {useGrid && (
              <>
                <label className="field">
                  <span>Second parameter</span>
                  <select
                    value={paramBKey}
                    onChange={(e) => {
                      setParamBKey(e.target.value);
                      const p = params.find((x) => x.key === e.target.value);
                      if (p) setValuesBStr(p.defaultValues);
                    }}
                  >
                    {params.filter((p) => p.key !== paramKey).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Second values</span>
                  <input value={valuesBStr} onChange={(e) => setValuesBStr(e.target.value)} />
                </label>
              </>
            )}
          </>
        )}
        <button className="btn primary" disabled={running} onClick={() => void handleSweep()}>
          {running ? <Loader size={14} className="spin" /> : null}
          {running ? "Running sweep..." : "Run sweep"}
        </button>
        {error && <p className="sweep-error">{error}</p>}
      </div>

      {result && (
        <div className="sweep-results">
          <p className="sect-label metrics-label">
            Sweep: {result.param}{result.param_b ? ` x ${result.param_b}` : ""} - {result.grid?.length ?? result.sweep.length} runs
          </p>
          {result.grid && result.param_b ? (
            <SweepHeatmap result={result} experiment={experiment} onSaveVariant={onSaveVariant} />
          ) : (
            <SingleParamHeatmap result={result} experiment={experiment} onSaveVariant={onSaveVariant} />
          )}
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

export function SingleParamHeatmap({
  result,
  experiment,
  onSaveVariant,
}: {
  result: SweepResult;
  experiment: ExperimentSummary;
  onSaveVariant: (experiment: ExperimentSummary, parameters: Record<string, number>) => Promise<void>;
}) {
  const valid = result.sweep.filter((point) => point.metrics);
  if (!valid.length) return null;
  const min = Math.min(...valid.map((point) => point.metrics!.total_return));
  const max = Math.max(...valid.map((point) => point.metrics!.total_return));
  return (
    <div className="heatmap-row">
      {result.sweep.map((point) => (
        <div
          key={point.param_value}
          className="heatmap-cell"
          style={{ background: heatColor(point.metrics?.total_return ?? null, min, max) }}
          title={`${result.param} ${point.param_value}`}
        >
          <span>{point.param_value}</span>
          <strong>{point.metrics ? `${(point.metrics.total_return * 100).toFixed(1)}%` : "fail"}</strong>
          {point.metrics && (
            <button className="mini-save" onClick={() => void onSaveVariant(experiment, { [result.param]: point.param_value })}>
              Save
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function SweepHeatmap({
  result,
  experiment,
  onSaveVariant,
}: {
  result: SweepResult;
  experiment: ExperimentSummary;
  onSaveVariant: (experiment: ExperimentSummary, parameters: Record<string, number>) => Promise<void>;
}) {
  const grid = result.grid ?? [];
  const xs = [...new Set(grid.map((point) => point.param_value))];
  const ys = [...new Set(grid.map((point) => point.param_b_value))];
  const valid = grid.filter((point) => point.metrics);
  if (!valid.length) return null;
  const min = Math.min(...valid.map((point) => point.metrics!.total_return));
  const max = Math.max(...valid.map((point) => point.metrics!.total_return));
  const lookup = new Map(grid.map((point) => [`${point.param_value}:${point.param_b_value}`, point]));
  return (
    <div className="heatmap-grid" style={{ gridTemplateColumns: `90px repeat(${xs.length}, minmax(70px, 1fr))` }}>
      <div className="heatmap-axis">{result.param_b}</div>
      {xs.map((x) => <div className="heatmap-axis" key={x}>{result.param} {x}</div>)}
      {ys.map((y) => (
        <Fragment key={y}>
          <div className="heatmap-axis" key={`y-${y}`}>{y}</div>
          {xs.map((x) => {
            const point = lookup.get(`${x}:${y}`);
            return (
              <div
                className="heatmap-cell"
                key={`${x}-${y}`}
                style={{ background: heatColor(point?.metrics?.total_return ?? null, min, max) }}
              >
                <strong>{point?.metrics ? `${(point.metrics.total_return * 100).toFixed(1)}%` : "fail"}</strong>
                {point?.metrics && result.param_b && (
                  <button
                    className="mini-save"
                    onClick={() => void onSaveVariant(experiment, {
                      [result.param]: point.param_value,
                      [result.param_b!]: point.param_b_value,
                    })}
                  >
                    Save
                  </button>
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function heatColor(value: number | null, min: number, max: number) {
  if (value == null) return "rgba(255, 94, 94, 0.15)";
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const red = Math.round(180 - t * 110);
  const green = Math.round(80 + t * 150);
  return `rgba(${red}, ${green}, 120, 0.35)`;
}

