export function pct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function signedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function fillReason(reason: string, signalAsOf: string | null, timing: string | null) {
  const label = reason === "liquidate_removed_target" ? "Liquidate stale target" : "Rebalance";
  if (!signalAsOf) return label;
  return `${label} (${executionLabel(timing ?? "same_close")}, signal ${signalAsOf})`;
}

export function executionLabel(value: string) {
  if (value === "next_open") return "Next open";
  return "Same close";
}

export function cashPolicyLabel(policy: string, riskFreeRate: number) {
  if (policy === "risk_free_proxy") return `Risk-free proxy (${(riskFreeRate * 100).toFixed(2)}%)`;
  if (policy === "benchmark_asset") return "Benchmark asset";
  return "Hold cash";
}

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
