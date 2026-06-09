from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from .domain import (
    BacktestConfig,
    BootstrapStress,
    ChecklistItem,
    DataReliability,
    Experiment,
    QuantReview,
    ReviewFlag,
    RunProvenance,
    SymbolDataProvenance,
    WarningSeverity,
    to_primitive,
)
from .market_data import MarketDataFetcher

def run_provenance(
    fetcher: MarketDataFetcher,
    market_data_series: dict[str, Any],
    config: BacktestConfig,
) -> RunProvenance:
    return RunProvenance(
        data=tuple(
            symbol_provenance(fetcher, series, config)
            for series in market_data_series.values()
        )
    )


def enrich_result(
    result: Any,
    fetcher: MarketDataFetcher,
    market_data_series: dict[str, Any],
    config: BacktestConfig,
) -> Any:
    provenance = run_provenance(fetcher, market_data_series, config)
    reliability = data_reliability(provenance, market_data_series)
    enriched = replace(
        result,
        provenance=provenance,
        data_reliability=reliability,
    )
    enriched = replace(enriched, bootstrap_stress=bootstrap_stress(enriched))
    return replace(
        enriched,
        quant_review=quant_review(enriched),
    )


def data_reliability(
    provenance: RunProvenance,
    market_data_series: dict[str, Any],
) -> DataReliability:
    expected = sum(item.expected_bars for item in provenance.data)
    missing = sum(item.missing_bars for item in provenance.data)
    stale_symbols: list[str] = []
    source_mismatches: list[str] = []
    issues: list[str] = []
    sources = {item.source for item in provenance.data}
    adjustments = {item.adjustment for item in provenance.data}
    if len(sources) > 1:
        source_mismatches.append("mixed_sources")
    if len(adjustments) > 1:
        source_mismatches.append("mixed_adjustments")
    now = datetime.now(UTC)
    for item in provenance.data:
        if (now - item.fetched_at).days > 30:
            stale_symbols.append(item.symbol)
        series = market_data_series.get(item.symbol)
        if series:
            issues.extend(f"{item.symbol}:{issue.code}" for issue in series.quality_issues)
    missing_penalty = (missing / expected) * 60 if expected > 0 else 0.0
    stale_penalty = min(20.0, len(stale_symbols) * 5.0)
    mismatch_penalty = min(20.0, len(source_mismatches) * 10.0)
    issue_penalty = min(20.0, len(issues) * 5.0)
    score = max(0.0, 100.0 - missing_penalty - stale_penalty - mismatch_penalty - issue_penalty)
    return DataReliability(
        score=round(score, 1),
        missing_bars=missing,
        expected_bars=expected,
        stale_symbols=tuple(stale_symbols),
        source_mismatches=tuple(source_mismatches),
        issues=tuple(issues),
    )


def quant_review(result: Any) -> QuantReview:
    flags: list[ReviewFlag] = []
    checklist = [
        ChecklistItem(
            code="adjusted_prices",
            label="Adjusted/total-return prices",
            passed=result.config.use_adjusted,
            detail="Raw prices ignore splits/dividends." if not result.config.use_adjusted else "Adjusted prices enabled.",
        ),
        ChecklistItem(
            code="oos_split",
            label="Out-of-sample split",
            passed=result.oos_analysis is not None,
            detail="No OOS split configured." if result.oos_analysis is None else f"OOS verdict: {result.oos_analysis.verdict}.",
        ),
        ChecklistItem(
            code="enough_history",
            label="Enough history",
            passed=(result.config.end_date - result.config.start_date).days >= 365 * 3,
            detail="Backtest window under 3 years." if (result.config.end_date - result.config.start_date).days < 365 * 3 else "Backtest window >= 3 years.",
        ),
        ChecklistItem(
            code="explicit_costs",
            label="Trading costs included",
            passed=(result.config.cost_model.commission_bps + result.config.cost_model.slippage_bps) > 0,
            detail="No explicit commission/slippage." if (result.config.cost_model.commission_bps + result.config.cost_model.slippage_bps) <= 0 else "Costs configured.",
        ),
        ChecklistItem(
            code="data_score",
            label="Data reliability >= 90",
            passed=result.data_reliability is not None and result.data_reliability.score >= 90,
            detail=f"Data score {result.data_reliability.score:.1f}." if result.data_reliability else "No data score.",
        ),
    ]

    if result.oos_analysis is None:
        flags.append(review_flag("no_oos_split", WarningSeverity.DANGER, "Not credible", "No out-of-sample split configured."))
    elif result.oos_analysis.verdict == "degraded":
        flags.append(review_flag("oos_degradation", WarningSeverity.CAUTION, "Overfit risk", "Out-of-sample performance degraded."))
    if result.data_reliability and result.data_reliability.score < 90:
        flags.append(review_flag("data_risk", WarningSeverity.CAUTION, "Data risk", f"Data score is {result.data_reliability.score:.1f}/100."))
    if result.metrics.turnover > 10:
        flags.append(review_flag("cost_fragile", WarningSeverity.CAUTION, "Cost fragile", f"Annualized turnover is {result.metrics.turnover:.1f}x."))
    if result.metrics.max_drawdown < -0.4:
        flags.append(review_flag("severe_drawdown", WarningSeverity.DANGER, "Severe drawdown", f"Max drawdown is {result.metrics.max_drawdown:.1%}."))
    if result.metrics.benchmark_total_return is not None and result.metrics.total_return < result.metrics.benchmark_total_return:
        flags.append(review_flag("benchmark_lag", WarningSeverity.CAUTION, "Benchmark lag", "Strategy underperformed benchmark total return."))
    weak_regimes = [regime.name for regime in result.regime_results if regime.metrics.max_drawdown < -0.2 or regime.metrics.total_return < -0.15]
    if weak_regimes:
        flags.append(review_flag("regime_fragile", WarningSeverity.CAUTION, "Regime fragile", f"Weak regimes: {', '.join(weak_regimes)}."))

    score = 100.0
    for item in checklist:
        if not item.passed:
            score -= 15
    for flag in flags:
        score -= 20 if flag.severity is WarningSeverity.DANGER else 10
    score = max(0.0, min(100.0, score))
    if score >= 85 and not any(flag.severity is WarningSeverity.DANGER for flag in flags):
        decision = "promising"
    elif score >= 65:
        decision = "fragile"
    elif score >= 45:
        decision = "overfit-risk"
    else:
        decision = "reject"
    summary = review_summary(decision, flags)
    return QuantReview(
        credibility_score=round(score, 1),
        decision=decision,
        summary=summary,
        flags=tuple(flags),
        checklist=tuple(checklist),
    )


def bootstrap_stress(result: Any, simulations: int = 500) -> BootstrapStress | None:
    equities = [snapshot.equity for snapshot in result.equity_curve]
    returns = [
        (equities[index] - equities[index - 1]) / equities[index - 1]
        for index in range(1, len(equities))
        if equities[index - 1] > 0
    ]
    if len(returns) < 20:
        return None
    horizon = min(252, len(returns))
    terminal_returns: list[float] = []
    max_drawdowns: list[float] = []
    seed = stable_seed(result.run_id)
    for sim in range(simulations):
        equity = 1.0
        peak = 1.0
        max_dd = 0.0
        state = seed + sim * 7919
        for _ in range(horizon):
            state = (1103515245 * state + 12345) % (2 ** 31)
            sampled = returns[state % len(returns)]
            equity *= max(0.0, 1 + sampled)
            peak = max(peak, equity)
            if peak > 0:
                max_dd = min(max_dd, (equity - peak) / peak)
        terminal_returns.append(equity - 1)
        max_drawdowns.append(max_dd)
    terminal_sorted = sorted(terminal_returns)
    drawdown_sorted = sorted(max_drawdowns)
    return BootstrapStress(
        simulations=simulations,
        horizon_days=horizon,
        terminal_p05=percentile(terminal_sorted, 0.05),
        terminal_p50=percentile(terminal_sorted, 0.50),
        terminal_p95=percentile(terminal_sorted, 0.95),
        max_drawdown_p05=percentile(drawdown_sorted, 0.05),
        max_drawdown_p50=percentile(drawdown_sorted, 0.50),
        max_drawdown_p95=percentile(drawdown_sorted, 0.95),
        loss_probability=sum(1 for value in terminal_returns if value < 0) / simulations,
        severe_drawdown_probability=sum(1 for value in max_drawdowns if value < -0.25) / simulations,
    )


def stable_seed(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    index = min(len(values) - 1, max(0, round((len(values) - 1) * percentile)))
    return values[index]


def review_flag(code: str, severity: WarningSeverity, label: str, detail: str) -> ReviewFlag:
    return ReviewFlag(code=code, severity=severity, label=label, detail=detail)


def review_summary(decision: str, flags: list[ReviewFlag]) -> str:
    if not flags:
        return f"Decision: {decision}. Core credibility checks passed."
    top = "; ".join(f"{flag.label}: {flag.detail}" for flag in flags[:3])
    return f"Decision: {decision}. {top}"


def experiment_changes(base: Experiment, experiment: Experiment) -> dict[str, Any]:
    assert base.result is not None
    assert experiment.result is not None
    metric_rows = []
    for key in ("total_return", "annualized_return", "volatility", "max_drawdown", "turnover"):
        old = getattr(base.result.metrics, key)
        new = getattr(experiment.result.metrics, key)
        metric_rows.append({"metric": key, "base": old, "current": new, "delta": new - old})
    if base.result.metrics.sharpe is not None and experiment.result.metrics.sharpe is not None:
        metric_rows.append({
            "metric": "sharpe",
            "base": base.result.metrics.sharpe,
            "current": experiment.result.metrics.sharpe,
            "delta": experiment.result.metrics.sharpe - base.result.metrics.sharpe,
        })
    param_changes = [
        {"parameter": key, "base": base.strategy.parameters.get(key), "current": experiment.strategy.parameters.get(key)}
        for key in sorted(set(base.strategy.parameters) | set(experiment.strategy.parameters))
        if base.strategy.parameters.get(key) != experiment.strategy.parameters.get(key)
    ]
    assumption_changes = [
        {"field": key, "base": getattr(base.backtest, key), "current": getattr(experiment.backtest, key)}
        for key in ("start_date", "end_date", "benchmark", "cash_policy", "execution_timing", "use_adjusted")
        if getattr(base.backtest, key) != getattr(experiment.backtest, key)
    ]
    return {
        "base_id": base.id,
        "current_id": experiment.id,
        "metrics": metric_rows,
        "parameters": to_primitive(param_changes),
        "assumptions": to_primitive(assumption_changes),
        "decision_delta": {
            "base": base.result.quant_review.decision if base.result.quant_review else None,
            "current": experiment.result.quant_review.decision if experiment.result.quant_review else None,
        },
    }


def symbol_provenance(
    fetcher: MarketDataFetcher,
    series: Any,
    config: BacktestConfig,
) -> SymbolDataProvenance:
    expected = expected_bars(config.start_date, config.end_date)
    actual = sum(1 for bar in series.bars if config.start_date <= bar.as_of <= config.end_date)
    cache_path = fetcher._cache_path(series.symbol, config.start_date, config.end_date)
    cache_key = str(cache_path)
    cache_hash = file_sha256(cache_path) if cache_path.exists() else None
    return SymbolDataProvenance(
        symbol=series.symbol,
        source=series.source,
        adjustment=series.adjustment,
        requested_start=config.start_date,
        requested_end=config.end_date,
        actual_start=series.start_date,
        actual_end=series.end_date,
        fetched_at=series.fetched_at,
        bar_count=actual,
        expected_bars=expected,
        missing_bars=max(0, expected - actual),
        cache_key=cache_key,
        cache_hash=cache_hash,
    )


def expected_bars(start: date, end: date) -> int:
    return max(1, (end - start).days * 252 // 365)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


