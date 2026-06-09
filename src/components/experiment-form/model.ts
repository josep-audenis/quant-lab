import type { DraftExperimentPayload, ExperimentSummary } from "../../api/experiments";
import type { Block } from "../RuleBuilder";

export type ExperimentFormMode = "create" | "edit";
export type Step = "universe" | "strategy" | "config";
export type PresetId = "single" | "sectors" | "macro";
export type TemplateId = "ma-timing" | "momentum" | "custom";

export type ExperimentFormProps = {
  experiment: ExperimentSummary | null;
  mode: ExperimentFormMode;
  onCancel: () => void;
  onSubmit: (payload: DraftExperimentPayload) => void;
  onSubmitCustom: (experiment: ExperimentSummary) => void;
};

export const tickers = [
  { t: "SPY", n: "SPDR S&P 500 ETF", cls: "US Equity", cagr: 0.099 },
  { t: "QQQ", n: "Invesco Nasdaq-100", cls: "US Tech", cagr: 0.134 },
  { t: "IWM", n: "iShares Russell 2000", cls: "US Small Cap", cagr: 0.082 },
  { t: "EFA", n: "iShares MSCI EAFE", cls: "Dev. ex-US", cagr: 0.051 },
  { t: "EEM", n: "iShares MSCI EM", cls: "Emerging Mkts", cagr: 0.044 },
  { t: "TLT", n: "iShares 20+ Yr Treasury", cls: "Long Bonds", cagr: 0.038 },
  { t: "GLD", n: "SPDR Gold Shares", cls: "Commodity", cagr: 0.072 },
  { t: "XLK", n: "Tech Select Sector", cls: "Sector", cagr: 0.128 },
  { t: "XLE", n: "Energy Select Sector", cls: "Sector", cagr: 0.061 },
  { t: "XLF", n: "Financials Select Sector", cls: "Sector", cagr: 0.067 },
];

export const presets: Array<{ id: PresetId; nm: string; ds: string; set: string[] }> = [
  { id: "single", nm: "Single ticker", ds: "Just SPY - classic test", set: ["SPY"] },
  { id: "sectors", nm: "Sector ETFs", ds: "US sector rotation basket", set: ["XLK", "XLF", "XLE"] },
  { id: "macro", nm: "Macro mix", ds: "Equity, bonds, gold, cash proxy", set: ["SPY", "TLT", "GLD"] },
];

export const templates: Array<{ id: TemplateId; nm: string; ds: string }> = [
  { id: "ma-timing", nm: "Trend timing", ds: "Hold when above moving average" },
  { id: "momentum", nm: "Cross-sectional momentum", ds: "Rotate into recent winners" },
  { id: "custom", nm: "Custom rules", ds: "Build your own block logic" },
];

export const emptyPayload: DraftExperimentPayload = {
  name: "",
  hypothesis: "",
  universe: "SPY",
  strategy_kind: "moving_average_filter",
  ma_window: 200,
  lookback_months: 12,
  top_n: 1,
  start_date: "1993-01-01",
  end_date: "2025-12-31",
  initial_capital: 10000,
  benchmark: "SPY",
  frequency: "daily",
  rebalance_frequency: "daily",
  commission_bps: 1,
  slippage_bps: 2,
  min_commission: 0,
  cash_policy: "risk_free_proxy",
  risk_free_rate: 0.02,
  notes: "",
  use_adjusted: true,
  oos_start_date: "",
  execution_timing: "next_open",
};

export function experimentToForm(experiment: ExperimentSummary | null): DraftExperimentPayload {
  if (!experiment) {
    return emptyPayload;
  }

  const parameters = experiment.strategy.parameters;
  return {
    name: experiment.name,
    hypothesis: experiment.hypothesis ?? "",
    universe: experiment.strategy.universe.join(", "),
    strategy_kind: experiment.strategy.kind,
    ma_window: Number(parameters.window ?? 200),
    lookback_months: Number(parameters.lookback_months ?? 12),
    top_n: Number(parameters.top_n ?? 1),
    start_date: experiment.backtest.start_date,
    end_date: experiment.backtest.end_date,
    initial_capital: experiment.backtest.initial_capital,
    benchmark: experiment.backtest.benchmark,
    frequency: experiment.backtest.frequency,
    rebalance_frequency: experiment.backtest.rebalance_frequency,
    commission_bps: experiment.backtest.cost_model.commission_bps,
    slippage_bps: experiment.backtest.cost_model.slippage_bps,
    min_commission: experiment.backtest.cost_model.min_commission,
    cash_policy: experiment.backtest.cash_policy,
    risk_free_rate: experiment.backtest.risk_free_rate,
    notes: experiment.notes ?? "",
    use_adjusted: experiment.backtest.use_adjusted ?? true,
    oos_start_date: experiment.backtest.oos_start_date ?? "",
    execution_timing: experiment.backtest.execution_timing ?? "same_close",
  };
}

export function titleForStep(step: Step) {
  if (step === "universe") return "What can strategy trade?";
  if (step === "strategy") return "Codify rule";
  return "Set simulation rules";
}

export function splitSymbols(value: string) {
  return value.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
}

export function seedCustomBlocks(universe: string[]): Block[] {
  const first = universe[0] ?? "SPY";
  return [
    { id: "ma_1", type: "indicator", indicator: "moving_average", symbol: first, window: 200, price: "close" },
    {
      id: "rule_1",
      type: "condition",
      if: { left: { ref: `${first}.close` }, operator: ">", right: { ref: "ma_1" } },
      then: [{ action: "set_weight", symbol: first, weight: 1 }],
      else: [{ action: "set_cash", weight: 1 }],
    },
  ];
}

export function fallbackTicker(symbol: string) {
  return { t: symbol, n: "-", cls: "-", cagr: 0 };
}

export function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function parseMoney(value: string) {
  return Number.parseInt(value.replace(/[^0-9]/g, ""), 10) || 10000;
}
