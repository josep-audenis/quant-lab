from __future__ import annotations

import math
from datetime import date
from typing import Mapping

from .domain import (
    BacktestConfig,
    Bar,
    BenchmarkPoint,
    DomainError,
    Fill,
    MetricSet,
    OosAnalysis,
    PortfolioSnapshot,
    RegimeResult,
    RollingMetricPoint,
)
from .engine_utils import bar_price, mean, std

def compute_metrics(
    snapshots: list[PortfolioSnapshot],
    fills: list[Fill],
    config: BacktestConfig,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> MetricSet:
    if not snapshots:
        raise DomainError("No portfolio snapshots to compute metrics")

    equities = [s.equity for s in snapshots]
    total_return = (equities[-1] - equities[0]) / equities[0] if equities[0] > 0 else 0.0
    n_days = (snapshots[-1].as_of - snapshots[0].as_of).days or 1
    years = n_days / 365.25
    annualized = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0.0

    daily_returns = [
        (equities[i] - equities[i - 1]) / equities[i - 1]
        for i in range(1, len(equities))
        if equities[i - 1] > 0
    ]
    vol = std(daily_returns) * math.sqrt(252) if len(daily_returns) > 1 else 0.0
    excess = [r - config.risk_free_rate / 252 for r in daily_returns]
    sharpe = (mean(excess) / std(excess) * math.sqrt(252)) if std(excess) > 0 else None
    max_dd = min((s.drawdown for s in snapshots), default=0.0)

    total_traded = sum(f.quantity * f.price for f in fills)
    avg_equity = mean(equities) if equities else 1.0
    lifetime_turnover = total_traded / avg_equity if avg_equity > 0 else 0.0
    turnover = lifetime_turnover / years if years > 0 else 0.0

    avg_exposure = mean([s.exposure for s in snapshots])

    # Benchmark metrics
    benchmark_total = None
    benchmark_ann = None
    bench_symbol = config.benchmark
    bench_bars = market_data.get(bench_symbol)
    if bench_bars:
        bench_prices = {bar.as_of: bar_price(bar, config) for bar in bench_bars}
        start_dates = [s.as_of for s in snapshots]
        if start_dates:
            b_start = bench_prices.get(start_dates[0])
            b_end = bench_prices.get(start_dates[-1])
            if b_start and b_end and b_start > 0:
                benchmark_total = (b_end - b_start) / b_start
                benchmark_ann = (1 + benchmark_total) ** (1 / years) - 1 if years > 0 else 0.0

    return MetricSet(
        total_return=total_return,
        annualized_return=annualized,
        volatility=vol,
        sharpe=sharpe,
        max_drawdown=max_dd,
        turnover=turnover,
        exposure=avg_exposure,
        benchmark_total_return=benchmark_total,
        benchmark_annualized_return=benchmark_ann,
    )


def rolling_metrics(
    snapshots: list[PortfolioSnapshot],
    config: BacktestConfig,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> tuple[RollingMetricPoint, ...]:
    windows = (("1y", 252), ("3y", 756))
    points: list[RollingMetricPoint] = []
    for label, size in windows:
        if len(snapshots) < size + 1:
            continue
        step = max(1, size // 12)
        indexes = list(range(size, len(snapshots), step))
        if indexes[-1] != len(snapshots) - 1:
            indexes.append(len(snapshots) - 1)
        for idx in indexes:
            window_snaps = snapshots[idx - size: idx + 1]
            metrics = compute_metrics(window_snaps, [], config, market_data)
            points.append(RollingMetricPoint(
                as_of=snapshots[idx].as_of,
                window=label,
                total_return=metrics.total_return,
                annualized_return=metrics.annualized_return,
                volatility=metrics.volatility,
                sharpe=metrics.sharpe,
                max_drawdown=metrics.max_drawdown,
            ))
    return tuple(points)


def oos_analysis(start_date: date, is_metrics: MetricSet, oos_metrics: MetricSet) -> OosAnalysis:
    ann_delta = oos_metrics.annualized_return - is_metrics.annualized_return
    sharpe_delta = None
    if is_metrics.sharpe is not None and oos_metrics.sharpe is not None:
        sharpe_delta = oos_metrics.sharpe - is_metrics.sharpe
    max_dd_delta = oos_metrics.max_drawdown - is_metrics.max_drawdown
    verdict = "stable"
    if ann_delta < -0.05 or (sharpe_delta is not None and sharpe_delta < -0.5):
        verdict = "degraded"
    elif ann_delta > 0.05 and (sharpe_delta is None or sharpe_delta >= 0):
        verdict = "improved"
    return OosAnalysis(
        start_date=start_date,
        in_sample=is_metrics,
        out_of_sample=oos_metrics,
        annualized_return_delta=ann_delta,
        sharpe_delta=sharpe_delta,
        max_drawdown_delta=max_dd_delta,
        verdict=verdict,
    )


def regime_results(
    snapshots: list[PortfolioSnapshot],
    fills: list[Fill],
    config: BacktestConfig,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> tuple[RegimeResult, ...]:
    regimes = (
        ("Dot-com bust", date(2000, 3, 24), date(2002, 10, 9)),
        ("Global financial crisis", date(2007, 10, 9), date(2009, 3, 9)),
        ("COVID crash", date(2020, 2, 19), date(2020, 3, 23)),
        ("Rate shock", date(2022, 1, 3), date(2022, 10, 12)),
    )
    results: list[RegimeResult] = []
    for name, start, end in regimes:
        regime_snaps = [s for s in snapshots if start <= s.as_of <= end]
        if len(regime_snaps) < 2:
            continue
        regime_fills = [f for f in fills if start <= f.as_of <= end]
        results.append(RegimeResult(
            name=name,
            start_date=regime_snaps[0].as_of,
            end_date=regime_snaps[-1].as_of,
            metrics=compute_metrics(regime_snaps, regime_fills, config, market_data),
        ))
    return tuple(results)


def benchmark_curve(
    snapshots: list[PortfolioSnapshot],
    market_data: Mapping[str, tuple[Bar, ...]],
    config: BacktestConfig,
) -> tuple[BenchmarkPoint, ...]:
    bench_bars = market_data.get(config.benchmark)
    if not bench_bars or not snapshots:
        return ()
    bench_prices = {bar.as_of: bar_price(bar, config) for bar in bench_bars}
    snap_dates = [s.as_of for s in snapshots]
    b_start = bench_prices.get(snap_dates[0])
    if not b_start or b_start <= 0:
        return ()
    # Forward-fill missing benchmark prices so curve length matches equity_curve
    last_price = b_start
    points: list[BenchmarkPoint] = []
    for d in snap_dates:
        p = bench_prices.get(d)
        if p:
            last_price = p
        points.append(BenchmarkPoint(as_of=d, equity=config.initial_capital * last_price / b_start))
    return tuple(points)


