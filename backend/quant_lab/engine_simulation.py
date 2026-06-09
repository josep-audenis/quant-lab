from __future__ import annotations

from datetime import date
from typing import Any, Mapping

from .domain import (
    BacktestConfig,
    Bar,
    CashPolicy,
    CostModel,
    DomainError,
    ExecutionTiming,
    Fill,
    Frequency,
    OrderSide,
    PortfolioSnapshot,
)
from .engine_utils import bar_price
from .programs import TargetWeights

def apply_rebalance_frequency(
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


def simulate(
    targets: list[TargetWeights],
    market_data: Mapping[str, tuple[Bar, ...]],
    config: BacktestConfig,
) -> dict[str, Any]:
    prices: dict[str, dict[date, float]] = {
        symbol: {
            bar.as_of: bar_price(bar, config)
            for bar in bars
        }
        for symbol, bars in market_data.items()
    }
    trade_prices: dict[str, dict[date, float]] = {
        symbol: {
            bar.as_of: (bar.open if config.execution_timing is ExecutionTiming.NEXT_OPEN else bar_price(bar, config))
            for bar in bars
        }
        for symbol, bars in market_data.items()
    }
    all_dates = sorted(
        {d for price_map in prices.values() for d in price_map}
    )

    cash = config.initial_capital
    positions: dict[str, float] = {}  # symbol -> shares
    snapshots: list[PortfolioSnapshot] = []
    fills: list[Fill] = []
    peak_equity = config.initial_capital

    target_map = execution_target_map(targets, all_dates, config)
    current_target: TargetWeights | None = None
    current_weights: dict[str, float] = {}  # last known target weights for cash yield

    for as_of in all_dates:
        if as_of < config.start_date or as_of > config.end_date:
            continue

        is_rebalance_day = as_of in target_map
        if is_rebalance_day:
            current_target = target_map[as_of]

        if current_target is None:
            # Before first signal - stay in cash
            equity = cash + positions_value(positions, prices, as_of)
            peak_equity = max(peak_equity, equity)
            snapshots.append(snapshot(as_of, cash, positions, prices, peak_equity))
            continue

        equity = cash + positions_value(positions, prices, as_of)

        # Only rebalance on signal days - eliminates noise fills between rebalances
        if is_rebalance_day:
            current_weights = effective_weights(current_target, config, trade_prices, as_of)

            for symbol, target_weight in current_weights.items():
                price = trade_prices.get(symbol, {}).get(as_of)
                if price is None:
                    continue
                target_value = equity * target_weight
                current_shares = positions.get(symbol, 0.0)
                current_value = current_shares * price
                delta_value = target_value - current_value
                if abs(delta_value) < max(1.0, equity * 0.001):
                    continue
                side = OrderSide.BUY if delta_value > 0 else OrderSide.SELL
                execution_price = fill_price(price, side, config.cost_model)
                shares_delta = delta_value / execution_price
                cost = trade_cost(abs(delta_value), config.cost_model)
                if shares_delta > 0:
                    fills.append(Fill(
                        symbol=symbol,
                        as_of=as_of,
                        side=OrderSide.BUY,
                        quantity=shares_delta,
                        price=execution_price,
                        commission=cost,
                        slippage=abs(execution_price - price) * shares_delta,
                        reason="rebalance_to_target",
                        target_weight=target_weight,
                        signal_as_of=current_target.as_of,
                        execution_timing=config.execution_timing,
                    ))
                    positions[symbol] = current_shares + shares_delta
                    cash -= shares_delta * execution_price + cost
                else:
                    fills.append(Fill(
                        symbol=symbol,
                        as_of=as_of,
                        side=OrderSide.SELL,
                        quantity=abs(shares_delta),
                        price=execution_price,
                        commission=cost,
                        slippage=abs(execution_price - price) * abs(shares_delta),
                        reason="rebalance_to_target",
                        target_weight=target_weight,
                        signal_as_of=current_target.as_of,
                        execution_timing=config.execution_timing,
                    ))
                    positions[symbol] = current_shares + shares_delta
                    cash += abs(shares_delta) * execution_price - cost

            # Liquidate positions no longer in target.
            for symbol in list(positions):
                if symbol not in current_weights or current_weights[symbol] == 0:
                    price = prices.get(symbol, {}).get(as_of)
                    trade_price = trade_prices.get(symbol, {}).get(as_of)
                    if price and trade_price and positions.get(symbol, 0) > 0:
                        qty = positions[symbol]
                        execution_price = fill_price(trade_price, OrderSide.SELL, config.cost_model)
                        value = qty * execution_price
                        cost = trade_cost(value, config.cost_model)
                        fills.append(Fill(
                            symbol=symbol,
                            as_of=as_of,
                            side=OrderSide.SELL,
                            quantity=qty,
                            price=execution_price,
                            commission=cost,
                            slippage=abs(execution_price - trade_price) * qty,
                            reason="liquidate_removed_target",
                            target_weight=0.0,
                            signal_as_of=current_target.as_of,
                            execution_timing=config.execution_timing,
                        ))
                        cash += value - cost
                        positions[symbol] = 0.0

        # Cash yield (daily accrual on true cash balance)
        if config.cash_policy is CashPolicy.RISK_FREE_PROXY and config.risk_free_rate > 0:
            daily_rate = (1 + config.risk_free_rate) ** (1 / 252) - 1
            invested = sum(
                positions.get(s, 0) * (prices.get(s, {}).get(as_of) or 0)
                for s in current_weights
                if current_weights.get(s, 0) > 0
            )
            true_cash = max(0.0, equity - invested)
            cash += true_cash * daily_rate

        equity = cash + positions_value(positions, prices, as_of)
        peak_equity = max(peak_equity, equity)
        snapshots.append(snapshot(as_of, cash, positions, prices, peak_equity))

    return {"snapshots": snapshots, "fills": fills}


def effective_weights(
    target: TargetWeights,
    config: BacktestConfig,
    prices: dict[str, dict[date, float]],
    as_of: date,
) -> dict[str, float]:
    weights = dict(target.weights)
    if target.cash <= 0:
        return weights
    if config.cash_policy is CashPolicy.BENCHMARK_ASSET:
        if prices.get(config.benchmark, {}).get(as_of) is None:
            raise DomainError("Benchmark asset cash policy requires benchmark market data")
        weights[config.benchmark] = weights.get(config.benchmark, 0.0) + target.cash
    return weights


def execution_target_map(
    targets: list[TargetWeights],
    all_dates: list[date],
    config: BacktestConfig,
) -> dict[date, TargetWeights]:
    if config.execution_timing is ExecutionTiming.SAME_CLOSE:
        return {tw.as_of: tw for tw in targets}

    target_map: dict[date, TargetWeights] = {}
    date_index = {as_of: index for index, as_of in enumerate(all_dates)}
    for target in targets:
        index = date_index.get(target.as_of)
        if index is None or index + 1 >= len(all_dates):
            continue
        target_map[all_dates[index + 1]] = target
    return target_map


def positions_value(positions: dict[str, float], prices: dict[str, dict[date, float]], as_of: date) -> float:
    total = 0.0
    for symbol, shares in positions.items():
        price = prices.get(symbol, {}).get(as_of)
        if price:
            total += shares * price
    return total


def trade_cost(value: float, cost_model: CostModel) -> float:
    bps_cost = value * cost_model.commission_bps / 10_000
    return max(bps_cost, cost_model.min_commission)


def fill_price(mid_price: float, side: OrderSide, cost_model: CostModel) -> float:
    slippage = cost_model.slippage_bps / 10_000
    if side is OrderSide.BUY:
        return mid_price * (1 + slippage)
    return mid_price * (1 - slippage)


def snapshot(
    as_of: date,
    cash: float,
    positions: dict[str, float],
    prices: dict[str, dict[date, float]],
    peak_equity: float,
) -> PortfolioSnapshot:
    invested_value = positions_value(positions, prices, as_of)
    equity = cash + invested_value
    drawdown = (equity - peak_equity) / peak_equity if peak_equity > 0 else 0.0
    exposure = invested_value / equity if equity > 0 else 0.0
    return PortfolioSnapshot(
        as_of=as_of,
        equity=max(equity, 0.0),
        cash=max(cash, 0.0),
        positions_value=max(invested_value, 0.0),
        drawdown=min(drawdown, 0.0),
        exposure=min(max(exposure, 0.0), 1.0),
    )


