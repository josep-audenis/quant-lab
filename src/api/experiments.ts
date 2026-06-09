const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type PortfolioSnapshot = {
  as_of: string;
  equity: number;
  cash: number;
  positions_value: number;
  drawdown: number;
  exposure: number;
};

export type MetricSet = {
  total_return: number;
  annualized_return: number;
  volatility: number;
  sharpe: number | null;
  max_drawdown: number;
  turnover: number;
  exposure: number;
  benchmark_total_return: number | null;
  benchmark_annualized_return: number | null;
};

export type RiskWarning = {
  code: string;
  severity: "info" | "caution" | "danger";
  message: string;
  evidence: Record<string, unknown>;
};

export type BenchmarkPoint = {
  as_of: string;
  equity: number;
};

export type Fill = {
  symbol: string;
  as_of: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  commission: number;
  slippage: number;
};

export type SweepPoint = {
  param_value: number;
  metrics: MetricSet | null;
  error?: string;
};

export type SweepResult = {
  param: string;
  sweep: SweepPoint[];
};

export type BacktestResult = {
  run_id: string;
  generated_at: string;
  metrics: MetricSet;
  equity_curve: PortfolioSnapshot[];
  fills: Fill[];
  warnings: RiskWarning[];
  benchmark_curve: BenchmarkPoint[];
  oos_metrics: MetricSet | null;
};

export type ExperimentSummary = {
  id: string;
  name: string;
  status: string;
  hypothesis?: string | null;
  notes?: string | null;
  backtest: {
    start_date: string;
    end_date: string;
    initial_capital: number;
    benchmark: string;
    frequency: string;
    rebalance_frequency: string;
    use_adjusted: boolean;
    oos_start_date: string | null;
    cost_model: {
      commission_bps: number;
      slippage_bps: number;
      min_commission: number;
    };
    cash_policy: string;
    risk_free_rate: number;
  };
  created_at: string;
  updated_at: string;
  strategy: {
    kind: string;
    universe: string[];
    parameters: Record<string, unknown>;
    rules: string[];
  };
  strategy_program?: {
    version: number;
    universe: string[];
    blocks: Array<Record<string, unknown>>;
  } | null;
  result?: BacktestResult | null;
};

export type ExperimentsResponse = {
  experiments: ExperimentSummary[];
  count: number;
};

export type ExperimentBlueprint = {
  id: string;
  name: string;
  description: string;
  strategy_kind: string;
  universe: string;
  benchmark: string;
  ma_window: number;
  lookback_months: number;
  top_n: number;
  risk_note: string;
};

export type DraftExperimentPayload = {
  name: string;
  hypothesis: string;
  universe: string;
  strategy_kind: string;
  ma_window: number;
  lookback_months: number;
  top_n: number;
  start_date: string;
  end_date: string;
  initial_capital: number;
  benchmark: string;
  frequency: string;
  rebalance_frequency: string;
  commission_bps: number;
  slippage_bps: number;
  min_commission: number;
  cash_policy: string;
  risk_free_rate: number;
  notes: string;
  use_adjusted: boolean;
  oos_start_date: string;
};

export async function createDraftExperiment(
  payload: DraftExperimentPayload,
): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to create experiment"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function listExperimentBlueprints(): Promise<ExperimentBlueprint[]> {
  const response = await fetch(`${API_BASE_URL}/experiment-blueprints`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to load blueprints"));
  }
  const data = await response.json();
  return data.blueprints;
}

export async function importExperiment(payload: unknown): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to import experiment"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function updateExperiment(experiment: ExperimentSummary): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(experiment.id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ experiment }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to update experiment"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function updateDraftExperiment(
  id: string,
  payload: DraftExperimentPayload,
): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/draft`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to update experiment"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function listExperiments(): Promise<ExperimentsResponse> {
  const response = await fetch(`${API_BASE_URL}/experiments`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to load experiments"));
  }
  return response.json();
}

export async function exportExperiment(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/export`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to export experiment"));
  }
  return response.blob();
}

export async function runExperiment(id: string): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to run backtest"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function deleteExperiment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to delete experiment"));
  }
}

export async function runExperimentAsync(
  id: string,
  onStage?: (stage: string) => void,
): Promise<ExperimentSummary> {
  const startRes = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/run/async`, {
    method: "POST",
  });
  if (!startRes.ok) {
    throw new Error(await errorMessage(startRes, "Failed to start run"));
  }
  const { job_id } = (await startRes.json()) as { job_id: string };

  for (;;) {
    await new Promise<void>((r) => setTimeout(r, 600));
    const statusRes = await fetch(
      `${API_BASE_URL}/experiments/${encodeURIComponent(id)}/run-status/${encodeURIComponent(job_id)}`,
    );
    if (!statusRes.ok) throw new Error("Failed to poll job status");
    const job = (await statusRes.json()) as {
      status: string;
      stage?: string;
      experiment?: ExperimentSummary;
      error?: string;
    };
    if (job.stage) onStage?.(job.stage);
    if (job.status === "completed" && job.experiment) return job.experiment;
    if (job.status === "failed") throw new Error(job.error ?? "Run failed");
  }
}

export async function sweepExperiment(
  id: string,
  param: string,
  values: number[],
): Promise<SweepResult> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ param, values }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Sweep failed"));
  }
  return response.json();
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.detail ? `${fallback}: ${data.detail}` : `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}
