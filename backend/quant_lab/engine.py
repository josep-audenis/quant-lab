from __future__ import annotations

from datetime import UTC, datetime
from typing import Mapping
from uuid import uuid4

from .domain import (
    BacktestResult,
    Bar,
    DomainError,
    Experiment,
    MetricSet,
    OosAnalysis,
)
from .engine_metrics import benchmark_curve, compute_metrics, oos_analysis as build_oos_analysis, regime_results, rolling_metrics
from .engine_risk import data_gap_warnings, portfolio_risk, risk_warnings
from .engine_simulation import apply_rebalance_frequency, simulate
from .programs import interpret_program

def run_backtest(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> BacktestResult:
    program = experiment.strategy_program
    if program is None:
        raise DomainError("Experiment has no strategy_program")

    config = experiment.backtest
    targets = apply_rebalance_frequency(
        interpret_program(program, market_data),
        config.rebalance_frequency,
    )
    if not targets:
        raise DomainError("Strategy produced no target weights")

    portfolio = simulate(targets, market_data, config)
    metrics = compute_metrics(portfolio["snapshots"], portfolio["fills"], config, market_data)
    benchmark_points = benchmark_curve(portfolio["snapshots"], market_data, config)
    rolling_points = rolling_metrics(portfolio["snapshots"], config, market_data)

    oos_metrics: MetricSet | None = None
    oos_analysis: OosAnalysis | None = None
    if config.oos_start_date:
        is_snaps = [s for s in portfolio["snapshots"] if s.as_of < config.oos_start_date]
        is_fills = [f for f in portfolio["fills"] if f.as_of < config.oos_start_date]
        oos_snaps = [s for s in portfolio["snapshots"] if s.as_of >= config.oos_start_date]
        oos_fills = [f for f in portfolio["fills"] if f.as_of >= config.oos_start_date]
        if len(is_snaps) > 1 and len(oos_snaps) > 1:
            is_metrics = compute_metrics(is_snaps, is_fills, config, market_data)
            oos_metrics = compute_metrics(oos_snaps, oos_fills, config, market_data)
            oos_analysis = build_oos_analysis(config.oos_start_date, is_metrics, oos_metrics)

    regimes = regime_results(portfolio["snapshots"], portfolio["fills"], config, market_data)
    risk = portfolio_risk(portfolio["snapshots"], portfolio["fills"], experiment.strategy.universe, market_data)
    warnings = (
        risk_warnings(metrics, config, portfolio["snapshots"], oos_analysis)
        + data_gap_warnings(market_data, config)
    )

    return BacktestResult(
        run_id=f"run_{uuid4().hex[:12]}",
        generated_at=datetime.now(UTC),
        config=config,
        strategy=experiment.strategy,
        metrics=metrics,
        equity_curve=tuple(portfolio["snapshots"]),
        fills=tuple(portfolio["fills"]),
        warnings=tuple(warnings),
        benchmark_curve=benchmark_points,
        oos_metrics=oos_metrics,
        rolling_metrics=rolling_points,
        oos_analysis=oos_analysis,
        regime_results=regimes,
        portfolio_risk=risk,
    )


