from __future__ import annotations

import math
from datetime import UTC, date, datetime
from typing import Any, Mapping
from uuid import uuid4

from .domain import (
    BacktestConfig,
    BacktestResult,
    Bar,
    BenchmarkPoint,
    CostModel,
    DomainError,
    Experiment,
    ExperimentStatus,
    Fill,
    Frequency,
    MetricSet,
    OrderSide,
    PortfolioSnapshot,
    RiskWarning,
    StrategyConfig,
    StrategyProgram,
    WarningSeverity,
)
from .programs import TargetWeights, interpret_program


def run_backtest(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> BacktestResult:
    program = experiment.strategy_program
    if program is None:
        raise DomainError("Experiment has no strategy_program")

    config = experiment.backtest
    targets = _apply_rebalance_frequency(
        interpret_program(program, market_data),
        config.rebalance_frequency,
    )
    if not targets:
        raise DomainError("Strategy produced no target weights")

    portfolio = _simulate(targets, market_data, config)
    metrics = _compute_metrics(portfolio["snapshots"], portfolio["fills"], config, market_data)
    warnings = (
        _risk_warnings(metrics, config, portfolio["snapshots"])
        + _data_gap_warnings(market_data, config)
    )
    benchmark_curve = _benchmark_curve(portfolio["snapshots"], market_data, config)

    oos_metrics: MetricSet | None = None
    if config.oos_start_date:
        oos_snaps = [s for s in portfolio["snapshots"] if s.as_of >= config.oos_start_date]
        oos_fills = [f for f in portfolio["fills"] if f.as_of >= config.oos_start_date]
        if len(oos_snaps) > 1:
            oos_metrics = _compute_metrics(oos_snaps, oos_fills, config, market_data)

    return BacktestResult(
        run_id=f"run_{uuid4().hex[:12]}",
        generated_at=datetime.now(UTC),
        config=config,
        strategy=experiment.strategy,
        metrics=metrics,
        equity_curve=tuple(portfolio["snapshots"]),
        fills=tuple(portfolio["fills"]),
        warnings=tuple(warnings),
        benchmark_curve=benchmark_curve,
        oos_metrics=oos_metrics,
    )


def _apply_rebalance_frequency(
    targets: list[TargetWeights],
    frequency: Frequency,
) -> list[TargetWeights]:
    if frequency == Frequency.DAILY:
        return targets
    filtered: list[TargetWeights] = []
    last_key: tuple[int, int] | int | None = None
    for tw in targets:
        if frequency == Frequency.WEEKLY:
            key: Any = tw.as_of.isocalendar()[:2]  # (year, week)
        elif frequency == Frequency.MONTHLY:
            key = (tw.as_of.year, tw.as_of.month)
        elif frequency == Frequency.QUARTERLY:
            key = (tw.as_of.year, (tw.as_of.month - 1) // 3)
        else:
            key = tw.as_of
        if key != last_key:
            filtered.append(tw)
            last_key = key
    return filtered


def _simulate(
    targets: list[TargetWeights],
    market_data: Mapping[str, tuple[Bar, ...]],
    config: BacktestConfig,
) -> dict[str, Any]:
    prices: dict[str, dict[date, float]] = {
        symbol: {
            bar.as_of: (
                bar.adjusted_close
                if config.use_adjusted and bar.adjusted_close is not None
                else bar.close
            )
            for bar in bars
        }
        for symbol, bars in market_data.items()
    }
    all_dates = sorted(
        {d for price_map in prices.values() for d in price_map}
    )

    cash = config.initial_capital
    positions: dict[str, float] = {}  # symbol → shares
    snapshots: list[PortfolioSnapshot] = []
    fills: list[Fill] = []
    peak_equity = config.initial_capital

    target_map = {tw.as_of: tw for tw in targets}
    current_target: TargetWeights | None = None
    current_weights: dict[str, float] = {}  # last known target weights for cash yield

    for as_of in all_dates:
        if as_of < config.start_date or as_of > config.end_date:
            continue

        is_rebalance_day = as_of in target_map
        if is_rebalance_day:
            current_target = target_map[as_of]

        if current_target is None:
            # Before first signal — stay in cash
            equity = cash + _positions_value(positions, prices, as_of)
            peak_equity = max(peak_equity, equity)
            snapshots.append(_snapshot(as_of, cash, positions, prices, peak_equity))
            continue

        equity = cash + _positions_value(positions, prices, as_of)

        # Only rebalance on signal days — eliminates noise fills between rebalances
        if is_rebalance_day:
            current_weights = dict(current_target.weights)

            for symbol, target_weight in current_weights.items():
                price = prices.get(symbol, {}).get(as_of)
                if price is None:
                    continue
                target_value = equity * target_weight
                current_shares = positions.get(symbol, 0.0)
                current_value = current_shares * price
                delta_value = target_value - current_value
                if abs(delta_value) < max(1.0, equity * 0.001):
                    continue
                shares_delta = delta_value / price
                cost = _trade_cost(abs(delta_value), config.cost_model)
                if shares_delta > 0:
                    fills.append(Fill(symbol=symbol, as_of=as_of, side=OrderSide.BUY, quantity=shares_delta, price=price, commission=cost))
                    positions[symbol] = current_shares + shares_delta
                    cash -= delta_value + cost
                else:
                    fills.append(Fill(symbol=symbol, as_of=as_of, side=OrderSide.SELL, quantity=abs(shares_delta), price=price, commission=cost))
                    positions[symbol] = current_shares + shares_delta
                    cash -= delta_value - cost

            # Liquidate positions not in current target
            if current_target.cash > 0:
                for symbol in list(positions):
                    if symbol not in current_weights or current_weights[symbol] == 0:
                        price = prices.get(symbol, {}).get(as_of)
                        if price and positions.get(symbol, 0) > 0:
                            qty = positions[symbol]
                            value = qty * price
                            cost = _trade_cost(value, config.cost_model)
                            fills.append(Fill(symbol=symbol, as_of=as_of, side=OrderSide.SELL, quantity=qty, price=price, commission=cost))
                            cash += value - cost
                            positions[symbol] = 0.0

        # Cash yield (daily accrual on true cash balance)
        if config.risk_free_rate > 0:
            daily_rate = (1 + config.risk_free_rate) ** (1 / 252) - 1
            invested = sum(
                positions.get(s, 0) * (prices.get(s, {}).get(as_of) or 0)
                for s in current_weights
                if current_weights.get(s, 0) > 0
            )
            true_cash = max(0.0, equity - invested)
            cash += true_cash * daily_rate

        equity = cash + _positions_value(positions, prices, as_of)
        peak_equity = max(peak_equity, equity)
        snapshots.append(_snapshot(as_of, cash, positions, prices, peak_equity))

    return {"snapshots": snapshots, "fills": fills}


def _positions_value(positions: dict[str, float], prices: dict[str, dict[date, float]], as_of: date) -> float:
    total = 0.0
    for symbol, shares in positions.items():
        price = prices.get(symbol, {}).get(as_of)
        if price:
            total += shares * price
    return total


def _trade_cost(value: float, cost_model: CostModel) -> float:
    bps_cost = value * (cost_model.commission_bps + cost_model.slippage_bps) / 10_000
    return max(bps_cost, cost_model.min_commission)


def _snapshot(
    as_of: date,
    cash: float,
    positions: dict[str, float],
    prices: dict[str, dict[date, float]],
    peak_equity: float,
) -> PortfolioSnapshot:
    positions_value = _positions_value(positions, prices, as_of)
    equity = cash + positions_value
    drawdown = (equity - peak_equity) / peak_equity if peak_equity > 0 else 0.0
    exposure = positions_value / equity if equity > 0 else 0.0
    return PortfolioSnapshot(
        as_of=as_of,
        equity=max(equity, 0.0),
        cash=max(cash, 0.0),
        positions_value=max(positions_value, 0.0),
        drawdown=min(drawdown, 0.0),
        exposure=min(max(exposure, 0.0), 1.0),
    )


def _compute_metrics(
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
    vol = _std(daily_returns) * math.sqrt(252) if len(daily_returns) > 1 else 0.0
    excess = [r - config.risk_free_rate / 252 for r in daily_returns]
    sharpe = (_mean(excess) / _std(excess) * math.sqrt(252)) if _std(excess) > 0 else None
    max_dd = min((s.drawdown for s in snapshots), default=0.0)

    total_traded = sum(f.quantity * f.price for f in fills)
    avg_equity = _mean(equities) if equities else 1.0
    turnover = total_traded / avg_equity if avg_equity > 0 else 0.0

    avg_exposure = _mean([s.exposure for s in snapshots])

    # Benchmark metrics
    benchmark_total = None
    benchmark_ann = None
    bench_symbol = config.benchmark
    bench_bars = market_data.get(bench_symbol)
    if bench_bars:
        bench_prices = {bar.as_of: bar.close for bar in bench_bars}
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


def _risk_warnings(
    metrics: MetricSet,
    config: BacktestConfig,
    snapshots: list[PortfolioSnapshot],
) -> list[RiskWarning]:
    warnings: list[RiskWarning] = []
    n_years = (snapshots[-1].as_of - snapshots[0].as_of).days / 365.25 if snapshots else 0
    if n_years < 3:
        warnings.append(RiskWarning(
            code="short_window",
            severity=WarningSeverity.CAUTION,
            message=f"Backtest window is {n_years:.1f} years — too short for statistical confidence.",
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
    return warnings


def _benchmark_curve(
    snapshots: list[PortfolioSnapshot],
    market_data: Mapping[str, tuple[Bar, ...]],
    config: BacktestConfig,
) -> tuple[BenchmarkPoint, ...]:
    bench_bars = market_data.get(config.benchmark)
    if not bench_bars or not snapshots:
        return ()
    bench_prices = {bar.as_of: bar.close for bar in bench_bars}
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


def _data_gap_warnings(
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
                message=f"{symbol} has only {actual} of ~{expected} expected bars — possible data gap.",
                evidence={"symbol": symbol, "bars": actual, "expected": expected},
            ))
    return warnings


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    variance = sum((v - m) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)
