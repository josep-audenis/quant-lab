import type { DraftExperimentPayload, ExperimentBlueprint, ExperimentsResponse, ExperimentSummary, RobustnessReport, SweepResult } from "./types";
export type * from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8011";

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
  paramB?: string,
  valuesB?: number[],
): Promise<SweepResult> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ param, values, param_b: paramB, values_b: valuesB }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Sweep failed"));
  }
  return response.json();
}

export async function exportTearSheet(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/tear-sheet`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to export tear sheet"));
  }
  return response.blob();
}

export async function createExperimentVariant(
  id: string,
  name: string,
  parameters: Record<string, number>,
): Promise<ExperimentSummary> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/variant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parameters }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to save variant"));
  }
  const data = await response.json();
  return data.experiment;
}

export async function writeExperimentWikiSummary(id: string): Promise<{ path: string; page: string }> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/wiki-summary`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to write wiki summary"));
  }
  return response.json();
}

export async function captureOpenQuestion(id: string, question: string): Promise<{ path: string }> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/open-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to capture question"));
  }
  return response.json();
}

export async function getExperimentChanges(id: string, baseId: string): Promise<{
  changes: {
    metrics: Array<{ metric: string; base: number; current: number; delta: number }>;
    parameters: Array<{ parameter: string; base: unknown; current: unknown }>;
    assumptions: Array<{ field: string; base: unknown; current: unknown }>;
    decision_delta: { base: string | null; current: string | null };
  };
}> {
  const response = await fetch(
    `${API_BASE_URL}/experiments/${encodeURIComponent(id)}/changes/${encodeURIComponent(baseId)}`,
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to load changes"));
  }
  return response.json();
}

export async function getRobustnessReport(id: string): Promise<RobustnessReport> {
  const response = await fetch(`${API_BASE_URL}/experiments/${encodeURIComponent(id)}/robustness`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to load robustness report"));
  }
  const data = await response.json();
  return data.robustness;
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.detail ? `${fallback}: ${data.detail}` : `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}
