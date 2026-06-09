from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Mapping

from .domain import Bar, DomainError, StrategyProgram


@dataclass(frozen=True)
class TargetWeights:
    as_of: date
    weights: Mapping[str, float]
    cash: float = 0.0


def validate_program(program: StrategyProgram) -> None:
    ids: set[str] = set()
    for block in program.blocks:
        block_id = str(block["id"])
        if block_id in ids:
            raise DomainError(f"Duplicate strategy block id: {block_id}")
        ids.add(block_id)

        block_type = block["type"]
        if block_type == "allocation":
            _validate_weights(block.get("weights"), program.universe)
        elif block_type == "indicator":
            _validate_indicator(block, program.universe)
        elif block_type == "condition":
            _validate_condition(block, ids, program.universe)
        else:
            raise DomainError(f"Unsupported strategy block type: {block_type}")


def interpret_program(
    program: StrategyProgram,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> list[TargetWeights]:
    validate_program(program)
    dates = _common_dates(program.universe, market_data)
    if not dates:
        raise DomainError("No common market data dates for strategy program")

    indicator_values = _compute_indicators(program, market_data)

    targets: list[TargetWeights] = []
    for as_of in dates:
        tw = _execute_blocks(program, as_of, market_data, indicator_values)
        if tw is not None:
            targets.append(tw)
    return targets


def _execute_blocks(
    program: StrategyProgram,
    as_of: date,
    market_data: Mapping[str, tuple[Bar, ...]],
    indicator_values: Mapping[str, Mapping[date, float]],
) -> TargetWeights | None:
    for block in program.blocks:
        btype = block["type"]
        if btype == "allocation":
            # If ranking_ref is present this is a dynamic momentum allocation
            ranking_ref = block.get("ranking_ref")
            if ranking_ref and ranking_ref in indicator_values:
                ranked = indicator_values[ranking_ref]
                top_n = int(block.get("top_n", 1))
                symbols = [s for s in program.universe if ranked.get(as_of) is not None]
                # ranked stores per-symbol returns keyed by (symbol, date) - see _compute_indicators
                per_symbol = indicator_values.get(f"{ranking_ref}__per_symbol", {})
                if per_symbol:
                    scores = {s: per_symbol.get(s, {}).get(as_of) for s in program.universe}
                    valid = {s: v for s, v in scores.items() if v is not None}
                    if valid:
                        top = sorted(valid, key=lambda s: valid[s], reverse=True)[:top_n]
                        w = 1.0 / len(top)
                        return TargetWeights(as_of=as_of, weights={s: w for s in top}, cash=0.0)
            return TargetWeights(as_of=as_of, weights=dict(block["weights"]), cash=0.0)
        if btype == "condition":
            cond_val = _evaluate_condition(block["if"], as_of, market_data, indicator_values)
            branch = block["then"] if cond_val else block["else"]
            return _actions_to_target(as_of, branch)
    return None


def buy_and_hold_program(universe: tuple[str, ...]) -> StrategyProgram:
    weight = 1 / len(universe)
    return StrategyProgram(
        version=1,
        universe=universe,
        blocks=(
            {
                "id": "allocation_1",
                "type": "allocation",
                "weights": {symbol: weight for symbol in universe},
            },
        ),
    )


def moving_average_filter_program(symbol: str, window: int) -> StrategyProgram:
    return StrategyProgram(
        version=1,
        universe=(symbol,),
        blocks=(
            {
                "id": "ma_1",
                "type": "indicator",
                "indicator": "moving_average",
                "symbol": symbol,
                "window": window,
                "price": "close",
            },
            {
                "id": "rule_1",
                "type": "condition",
                "if": {
                    "left": {"ref": f"{symbol}.close"},
                    "operator": ">",
                    "right": {"ref": "ma_1"},
                },
                "then": [{"action": "set_weight", "symbol": symbol, "weight": 1.0}],
                "else": [{"action": "set_cash", "weight": 1.0}],
            },
        ),
    )


def momentum_rotation_program(universe: tuple[str, ...], lookback_months: int, top_n: int) -> StrategyProgram:
    return StrategyProgram(
        version=1,
        universe=universe,
        blocks=(
            {
                "id": "momentum_1",
                "type": "indicator",
                "indicator": "momentum_return",
                "symbols": list(universe),
                "lookback_months": lookback_months,
            },
            {
                "id": "rank_1",
                "type": "allocation",
                "weights": {symbol: (1 / min(top_n, len(universe))) if index < top_n else 0.0 for index, symbol in enumerate(universe)},
                "ranking_ref": "momentum_1",
                "top_n": top_n,
            },
        ),
    )


def _validate_weights(weights: Any, universe: tuple[str, ...]) -> None:
    if not isinstance(weights, Mapping) or not weights:
        raise DomainError("Allocation block weights must be a non-empty object")
    total = 0.0
    for symbol, weight in weights.items():
        if symbol not in universe:
            raise DomainError(f"Allocation symbol not in universe: {symbol}")
        parsed = float(weight)
        if parsed < 0:
            raise DomainError("Allocation weights cannot be negative")
        total += parsed
    if total > 1.0000001:
        raise DomainError("Allocation weights cannot exceed 1")


def _validate_indicator(block: Mapping[str, Any], universe: tuple[str, ...]) -> None:
    indicator = block.get("indicator")
    if indicator == "moving_average":
        if block.get("symbol") not in universe:
            raise DomainError("Moving average symbol must be in universe")
        if int(block.get("window", 0)) <= 0:
            raise DomainError("Moving average window must be positive")
        if block.get("price", "close") != "close":
            raise DomainError("Only close price is supported for moving average")
        return
    if indicator == "momentum_return":
        symbols = block.get("symbols")
        if not isinstance(symbols, list) or any(symbol not in universe for symbol in symbols):
            raise DomainError("Momentum symbols must be in universe")
        if int(block.get("lookback_months", 0)) <= 0:
            raise DomainError("Momentum lookback_months must be positive")
        return
    raise DomainError(f"Unsupported indicator: {indicator}")


def _validate_condition(block: Mapping[str, Any], ids_so_far: set[str], universe: tuple[str, ...]) -> None:
    condition = block.get("if")
    if not isinstance(condition, Mapping):
        raise DomainError("Condition block requires if object")
    _validate_ref(condition.get("left"), ids_so_far, universe)
    _validate_ref(condition.get("right"), ids_so_far, universe)
    if condition.get("operator") not in (">", "<", ">=", "<="):
        raise DomainError("Unsupported condition operator")
    _validate_actions(block.get("then"), universe)
    _validate_actions(block.get("else"), universe)


def _validate_ref(value: Any, ids_so_far: set[str], universe: tuple[str, ...]) -> None:
    if not isinstance(value, Mapping) or "ref" not in value:
        raise DomainError("Condition operands must be refs")
    ref = str(value["ref"])
    if ref in ids_so_far:
        return
    if "." in ref and ref.split(".", 1)[0] in universe:
        return
    raise DomainError(f"Unknown strategy ref: {ref}")


def _validate_actions(actions: Any, universe: tuple[str, ...]) -> None:
    if not isinstance(actions, list) or not actions:
        raise DomainError("Condition branch actions must be non-empty")
    total = 0.0
    cash = 0.0
    for action in actions:
        if action.get("action") == "set_weight":
            if action.get("symbol") not in universe:
                raise DomainError("Action symbol must be in universe")
            weight = float(action.get("weight", 0))
            if weight < 0:
                raise DomainError("Action weight cannot be negative")
            total += weight
        elif action.get("action") == "set_cash":
            cash += float(action.get("weight", 0))
        else:
            raise DomainError("Unsupported action")
    if total + cash > 1.0000001:
        raise DomainError("Action weights cannot exceed 1")


def _common_dates(universe: tuple[str, ...], market_data: Mapping[str, tuple[Bar, ...]]) -> list[date]:
    date_sets = []
    for symbol in universe:
        bars = market_data.get(symbol)
        if not bars:
            raise DomainError(f"Missing market data for {symbol}")
        date_sets.append({bar.as_of for bar in bars})
    return sorted(set.intersection(*date_sets))


def _compute_indicators(
    program: StrategyProgram,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> dict[str, dict[date, float]]:
    output: dict[str, dict[date, float]] = {}
    for block in program.blocks:
        if block["type"] != "indicator":
            continue
        block_id = str(block["id"])
        if block["indicator"] == "moving_average":
            symbol = str(block["symbol"])
            window = int(block["window"])
            values: dict[date, float] = {}
            bars = sorted(market_data[symbol], key=lambda bar: bar.as_of)
            for index, bar in enumerate(bars):
                if index + 1 < window:
                    continue
                sample = bars[index + 1 - window : index + 1]
                values[bar.as_of] = sum(item.close for item in sample) / window
            output[block_id] = values
        elif block["indicator"] == "momentum_return":
            symbols = [str(s) for s in block.get("symbols", [])]
            lookback_months = int(block.get("lookback_months", 12))
            # Compute trailing return per symbol per date
            per_symbol: dict[str, dict[date, float]] = {}
            for sym in symbols:
                bars_sym = sorted(market_data.get(sym, ()), key=lambda b: b.as_of)
                price_map = {b.as_of: b.close for b in bars_sym}
                sym_values: dict[date, float] = {}
                for bar in bars_sym:
                    lookback_date = date(
                        bar.as_of.year - (lookback_months // 12),
                        ((bar.as_of.month - 1 - lookback_months % 12) % 12) + 1,
                        1,
                    ) if lookback_months >= 12 else bar.as_of.replace(day=1) - timedelta(days=lookback_months * 30)
                    # Find closest available price at or before lookback_date
                    past_price = None
                    for candidate in reversed(bars_sym):
                        if candidate.as_of <= lookback_date:
                            past_price = candidate.close
                            break
                    if past_price and past_price > 0:
                        sym_values[bar.as_of] = (price_map[bar.as_of] - past_price) / past_price
                per_symbol[sym] = sym_values
            # Aggregate: store average return as the indicator value (for reference)
            all_dates_set: set[date] = set()
            for sv in per_symbol.values():
                all_dates_set |= sv.keys()
            agg: dict[date, float] = {}
            for d in all_dates_set:
                vals = [per_symbol[s][d] for s in symbols if d in per_symbol.get(s, {})]
                if vals:
                    agg[d] = sum(vals) / len(vals)
            output[block_id] = agg
            output[f"{block_id}__per_symbol"] = per_symbol  # type: ignore[assignment]
    return output


def _evaluate_condition(
    condition: Mapping[str, Any],
    as_of: date,
    market_data: Mapping[str, tuple[Bar, ...]],
    indicator_values: Mapping[str, Mapping[date, float]],
) -> bool:
    left = _resolve(condition["left"]["ref"], as_of, market_data, indicator_values)
    right = _resolve(condition["right"]["ref"], as_of, market_data, indicator_values)
    if left is None or right is None:
        return False
    operator = condition["operator"]
    if operator == ">":
        return left > right
    if operator == "<":
        return left < right
    if operator == ">=":
        return left >= right
    if operator == "<=":
        return left <= right
    raise DomainError("Unsupported condition operator")


def _resolve(
    ref: str,
    as_of: date,
    market_data: Mapping[str, tuple[Bar, ...]],
    indicator_values: Mapping[str, Mapping[date, float]],
) -> float | None:
    if ref in indicator_values:
        return indicator_values[ref].get(as_of)
    symbol, field = ref.split(".", 1)
    for bar in market_data[symbol]:
        if bar.as_of == as_of:
            return float(getattr(bar, field))
    return None


def _actions_to_target(as_of: date, actions: list[Mapping[str, Any]]) -> TargetWeights:
    weights: dict[str, float] = {}
    cash = 0.0
    for action in actions:
        if action["action"] == "set_weight":
            weights[str(action["symbol"])] = float(action["weight"])
        elif action["action"] == "set_cash":
            cash = float(action["weight"])
    return TargetWeights(as_of=as_of, weights=weights, cash=cash)
