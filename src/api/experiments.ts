const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

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
  result?: unknown;
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

export async function deleteExperiment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to delete experiment"));
  }
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.detail ? `${fallback}: ${data.detail}` : `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}
