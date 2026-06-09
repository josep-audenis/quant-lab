import type { BacktestResult } from "../api/experiments";
import { AttributionChart, DrawdownChart, EquityChart } from "./results/Charts";
import { BootstrapStressPanel, DataReliabilityPanel, OosPanel, PortfolioRiskPanel, QuantReviewPanel, RegimePanel, RollingMetricsPanel, WarningsList } from "./results/DiagnosticsSections";
import { AssumptionsPanel, MetricsGrid, ProvenancePanel } from "./results/MetricsSections";
import { FillsTable } from "./results/TradeTables";

type ResultsPanelProps = {
  result: BacktestResult;
  initialCapital: number;
  benchmark: string;
};

export function ResultsPanel({ result, initialCapital, benchmark }: ResultsPanelProps) {
  const { metrics, equity_curve, warnings } = result;

  return (
    <section className="results-panel">
      <MetricsGrid metrics={metrics} benchmark={benchmark} />
      <AssumptionsPanel result={result} />
      {result.quant_review && <QuantReviewPanel result={result} />}
      {result.bootstrap_stress && <BootstrapStressPanel result={result} />}
      {result.provenance.data.length > 0 && <ProvenancePanel result={result} />}
      {result.data_reliability && <DataReliabilityPanel result={result} />}
      {result.portfolio_risk && <PortfolioRiskPanel result={result} />}
      {result.oos_metrics && (
        <OosPanel result={result} isMetrics={metrics} oosMetrics={result.oos_metrics} benchmark={benchmark} />
      )}
      {result.rolling_metrics.length > 0 && <RollingMetricsPanel points={result.rolling_metrics} />}
      {result.regime_results.length > 0 && <RegimePanel regimes={result.regime_results} />}
      <EquityChart curve={equity_curve} benchmarkCurve={result.benchmark_curve} initialCapital={initialCapital} />
      <DrawdownChart curve={equity_curve} />
      {result.fills.length > 0 && <AttributionChart fills={result.fills} />}
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      {result.fills.length > 0 && <FillsTable fills={result.fills} />}
    </section>
  );
}
