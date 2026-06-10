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
  reason: string;
  target_weight: number | null;
  signal_as_of: string | null;
  execution_timing: string | null;
};

export type SweepPoint = {
  param_value: number;
  metrics: MetricSet | null;
  error?: string;
};

export type SweepGridPoint = {
  param_value: number;
  param_b_value: number;
  metrics: MetricSet | null;
  error?: string;
};

export type SweepResult = {
  param: string;
  param_b?: string;
  values?: number[];
  values_b?: number[];
  sweep: SweepPoint[];
  grid?: SweepGridPoint[];
};

export type RobustnessPoint = {
  label: string;
  value: number;
  param?: string;
  metrics: MetricSet | null;
  error?: string;
};

export type RobustnessReport = {
  base_metrics: MetricSet;
  cost_sensitivity: RobustnessPoint[];
  start_date_sensitivity: RobustnessPoint[];
  parameter_sensitivity: RobustnessPoint[];
  verdict: {
    decision: "robust" | "fragile" | "overfit-risk";
    flags: string[];
    summary: string;
  };
};

export type RollingMetricPoint = {
  as_of: string;
  window: string;
  total_return: number;
  annualized_return: number;
  volatility: number;
  sharpe: number | null;
  max_drawdown: number;
};

export type OosAnalysis = {
  start_date: string;
  in_sample: MetricSet;
  out_of_sample: MetricSet;
  annualized_return_delta: number;
  sharpe_delta: number | null;
  max_drawdown_delta: number;
  verdict: string;
};

export type RegimeResult = {
  name: string;
  start_date: string;
  end_date: string;
  metrics: MetricSet;
};

export type DataReliability = {
  score: number;
  missing_bars: number;
  expected_bars: number;
  stale_symbols: string[];
  source_mismatches: string[];
  issues: string[];
};

export type PortfolioRisk = {
  max_exposure: number;
  average_exposure: number;
  top_traded_symbol: string | null;
  top_traded_share: number;
  average_pairwise_correlation: number | null;
  high_correlation_pairs: string[];
};

export type ReviewFlag = {
  code: string;
  severity: "info" | "caution" | "danger";
  label: string;
  detail: string;
};

export type ChecklistItem = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type QuantReview = {
  credibility_score: number;
  decision: string;
  summary: string;
  flags: ReviewFlag[];
  checklist: ChecklistItem[];
};

export type BootstrapStress = {
  simulations: number;
  horizon_days: number;
  terminal_p05: number;
  terminal_p50: number;
  terminal_p95: number;
  max_drawdown_p05: number;
  max_drawdown_p50: number;
  max_drawdown_p95: number;
  loss_probability: number;
  severe_drawdown_probability: number;
};

export type BacktestConfigSummary = {
  start_date: string;
  end_date: string;
  initial_capital: number;
  benchmark: string;
  frequency: string;
  rebalance_frequency: string;
  use_adjusted: boolean;
  oos_start_date: string | null;
  execution_timing: string;
  cost_model: {
    commission_bps: number;
    slippage_bps: number;
    min_commission: number;
  };
  cash_policy: string;
  risk_free_rate: number;
};

export type BacktestResult = {
  run_id: string;
  generated_at: string;
  config: BacktestConfigSummary;
  provenance: {
    data: Array<{
      symbol: string;
      source: string;
      adjustment: string;
      requested_start: string;
      requested_end: string;
      actual_start: string;
      actual_end: string;
      fetched_at: string;
      bar_count: number;
      expected_bars: number;
      missing_bars: number;
      cache_key: string | null;
      cache_hash: string | null;
    }>;
  };
  metrics: MetricSet;
  equity_curve: PortfolioSnapshot[];
  fills: Fill[];
  warnings: RiskWarning[];
  benchmark_curve: BenchmarkPoint[];
  oos_metrics: MetricSet | null;
  rolling_metrics: RollingMetricPoint[];
  oos_analysis: OosAnalysis | null;
  regime_results: RegimeResult[];
  data_reliability: DataReliability | null;
  portfolio_risk: PortfolioRisk | null;
  quant_review: QuantReview | null;
  bootstrap_stress: BootstrapStress | null;
};

export type ExperimentSummary = {
  id: string;
  name: string;
  status: string;
  hypothesis?: string | null;
  notes?: string | null;
  backtest: BacktestConfigSummary;
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
  execution_timing: string;
};

