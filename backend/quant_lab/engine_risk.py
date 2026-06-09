from __future__ import annotations

import math
from datetime import date
from typing import Mapping

from .domain import (
    BacktestConfig,
    Bar,
    Fill,
    MetricSet,
    OosAnalysis,
    PortfolioRisk,
    PortfolioSnapshot,
    RiskWarning,
    WarningSeverity,
)
from .engine_utils import mean

def portfolio_risk(
    snapshots: list[PortfolioSnapshot],
    fills: list[Fill],
    universe: tuple[str, ...],
    market_data: Mapping[str, tuple[Bar, ...]],
) -> PortfolioRisk:
    traded_by_symbol: dict[str, float] = {}
    for fill in fills:
        traded_by_symbol[fill.symbol] = traded_by_symbol.get(fill.symbol, 0.0) + fill.quantity * fill.price
    total_traded = sum(traded_by_symbol.values())
    top_symbol = None
    top_share = 0.0
    if total_traded > 0 and traded_by_symbol:
        top_symbol, top_value = max(traded_by_symbol.items(), key=lambda item: item[1])
        top_share = top_value / total_traded

    correlations = pairwise_correlations(universe, market_data)
    avg_corr = mean([value for _, value in correlations]) if correlations else None
    high_pairs = tuple(pair for pair, value in correlations if value >= 0.85)

    return PortfolioRisk(
        max_exposure=max((snapshot.exposure for snapshot in snapshots), default=0.0),
        average_exposure=mean([snapshot.exposure for snapshot in snapshots]),
        top_traded_symbol=top_symbol,
        top_traded_share=top_share,
        average_pairwise_correlation=avg_corr,
        high_correlation_pairs=high_pairs,
    )


def pairwise_correlations(
    universe: tuple[str, ...],
    market_data: Mapping[str, tuple[Bar, ...]],
) -> list[tuple[str, float]]:
    returns_by_symbol: dict[str, dict[date, float]] = {}
    for symbol in universe:
        bars = sorted(market_data.get(symbol, ()), key=lambda bar: bar.as_of)
        returns: dict[date, float] = {}
        for index in range(1, len(bars)):
            previous = bars[index - 1].close
            if previous > 0:
                returns[bars[index].as_of] = (bars[index].close - previous) / previous
        returns_by_symbol[symbol] = returns

    correlations: list[tuple[str, float]] = []
    symbols = list(universe)
    for i, left in enumerate(symbols):
        for right in symbols[i + 1:]:
            common = sorted(set(returns_by_symbol[left]) & set(returns_by_symbol[right]))
            if len(common) < 3:
                continue
            xs = [returns_by_symbol[left][day] for day in common]
            ys = [returns_by_symbol[right][day] for day in common]
            corr = correlation(xs, ys)
            if corr is not None:
                correlations.append((f"{left}/{right}", corr))
    return correlations


def correlation(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    xmean = mean(xs)
    ymean = mean(ys)
    numerator = sum((x - xmean) * (y - ymean) for x, y in zip(xs, ys))
    x_var = sum((x - xmean) ** 2 for x in xs)
    y_var = sum((y - ymean) ** 2 for y in ys)
    denom = math.sqrt(x_var * y_var)
    if denom == 0:
        return None
    return numerator / denom


def risk_warnings(
    metrics: MetricSet,
    config: BacktestConfig,
    snapshots: list[PortfolioSnapshot],
    oos_analysis: OosAnalysis | None = None,
) -> list[RiskWarning]:
    warnings: list[RiskWarning] = []
    n_years = (snapshots[-1].as_of - snapshots[0].as_of).days / 365.25 if snapshots else 0
    if n_years < 3:
        warnings.append(RiskWarning(
            code="short_window",
            severity=WarningSeverity.CAUTION,
            message=f"Backtest window is {n_years:.1f} years - too short for statistical confidence.",
            evidence={"years": round(n_years, 2)},
        ))
    if metrics.max_drawdown < -0.4:
        warnings.append(RiskWarning(
            code="deep_drawdown",
            severity=WarningSeverity.DANGER,
            message=f"Max drawdown of {metrics.max_drawdown:.1%} is severe.",
            evidence={"max_drawdown": round(metrics.max_drawdown, 4)},
        ))
    if metrics.turnover > 10:
        warnings.append(RiskWarning(
            code="high_turnover",
            severity=WarningSeverity.CAUTION,
            message=f"Annualised turnover ratio {metrics.turnover:.1f}x is high.",
            evidence={"turnover": round(metrics.turnover, 2)},
        ))
    if config.oos_start_date is None:
        warnings.append(RiskWarning(
            code="no_oos_split",
            severity=WarningSeverity.CAUTION,
            message="No out-of-sample split configured.",
            evidence={},
        ))
    elif oos_analysis and oos_analysis.verdict == "degraded":
        warnings.append(RiskWarning(
            code="oos_degradation",
            severity=WarningSeverity.CAUTION,
            message="Out-of-sample performance degraded versus in-sample.",
            evidence={
                "annualized_return_delta": round(oos_analysis.annualized_return_delta, 4),
                "sharpe_delta": None if oos_analysis.sharpe_delta is None else round(oos_analysis.sharpe_delta, 4),
            },
        ))
    total_cost_bps = config.cost_model.commission_bps + config.cost_model.slippage_bps
    if total_cost_bps >= 10:
        warnings.append(RiskWarning(
            code="high_cost_assumption",
            severity=WarningSeverity.CAUTION,
            message=f"Trading friction assumption is {total_cost_bps:.1f} bps per trade.",
            evidence={"cost_bps": round(total_cost_bps, 2)},
        ))
    if not config.use_adjusted:
        warnings.append(RiskWarning(
            code="raw_prices",
            severity=WarningSeverity.DANGER,
            message="Raw close ignores splits and dividends.",
            evidence={},
        ))
    warnings.append(RiskWarning(
        code="survivorship_user_universe",
        severity=WarningSeverity.INFO,
        message="Universe is user-selected, not point-in-time survivorship-safe.",
        evidence={},
    ))
    return warnings


def data_gap_warnings(
    market_data: Mapping[str, tuple[Bar, ...]],
    config: BacktestConfig,
) -> list[RiskWarning]:
    warnings: list[RiskWarning] = []
    expected = max(1, (config.end_date - config.start_date).days * 252 // 365)
    for symbol, bars in market_data.items():
        actual = sum(1 for b in bars if config.start_date <= b.as_of <= config.end_date)
        if actual / expected < 0.5:
            warnings.append(RiskWarning(
                code=f"sparse_data_{symbol.lower()}",
                severity=WarningSeverity.CAUTION,
                message=f"{symbol} has only {actual} of ~{expected} expected bars - possible data gap.",
                evidence={"symbol": symbol, "bars": actual, "expected": expected},
            ))
    return warnings


