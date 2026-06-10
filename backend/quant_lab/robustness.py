from __future__ import annotations

from dataclasses import replace
from datetime import timedelta
from typing import Any, Mapping

from .domain import BacktestConfig, Bar, CostModel, DomainError, Experiment, MetricSet, to_primitive
from .engine import run_backtest
from .experiment_payloads import strategy_program


def robustness_report(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
    *,
    cost_bps: tuple[float, ...] = (0, 5, 10, 25, 50),
    start_offsets_days: tuple[int, ...] = (0, 63, 126, 252),
) -> dict[str, Any]:
    base_result = experiment.result or run_backtest(experiment, market_data)
    cost_rows = cost_sensitivity(experiment, market_data, cost_bps)
    start_rows = start_date_sensitivity(experiment, market_data, start_offsets_days)
    parameter_rows = parameter_sensitivity(experiment, market_data)
    verdict = fragility_verdict(base_result.metrics, cost_rows, start_rows, parameter_rows)
    return {
        "base_metrics": to_primitive(base_result.metrics),
        "cost_sensitivity": cost_rows,
        "start_date_sensitivity": start_rows,
        "parameter_sensitivity": parameter_rows,
        "verdict": verdict,
    }


def cost_sensitivity(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
    values: tuple[float, ...],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for bps in values:
        config = replace(
            experiment.backtest,
            cost_model=CostModel(
                commission_bps=bps / 2,
                slippage_bps=bps / 2,
                min_commission=experiment.backtest.cost_model.min_commission,
            ),
        )
        rows.append(run_variant(experiment, market_data, config=config, label=f"{bps:g} bps", value=bps))
    return rows


def start_date_sensitivity(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
    offsets_days: tuple[int, ...],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for offset in offsets_days:
        start = experiment.backtest.start_date + timedelta(days=offset)
        if start >= experiment.backtest.end_date:
            continue
        config = replace(experiment.backtest, start_date=start)
        rows.append(run_variant(experiment, market_data, config=config, label=f"+{offset}d", value=offset))
    return rows


def parameter_sensitivity(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
) -> list[dict[str, Any]]:
    params = dict(experiment.strategy.parameters)
    rows: list[dict[str, Any]] = []
    if experiment.strategy.kind.value == "moving_average_filter":
        base = int(params.get("window", 200))
        values = sorted({max(2, int(base * 0.75)), base, int(base * 1.25)})
        for value in values:
            rows.append(run_parameter_variant(experiment, market_data, "window", value))
    elif experiment.strategy.kind.value == "momentum_rotation":
        lookback = int(params.get("lookback_months", 12))
        top_n = int(params.get("top_n", 1))
        for value in sorted({max(1, lookback - 3), lookback, lookback + 3}):
            rows.append(run_parameter_variant(experiment, market_data, "lookback_months", value))
        max_n = len(experiment.strategy.universe)
        for value in sorted({max(1, top_n - 1), top_n, min(max_n, top_n + 1)}):
            rows.append(run_parameter_variant(experiment, market_data, "top_n", value))
    return rows


def run_parameter_variant(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
    param: str,
    value: int,
) -> dict[str, Any]:
    params = dict(experiment.strategy.parameters)
    params[param] = value
    program = strategy_program(experiment.strategy.kind, experiment.strategy.universe, params)
    strategy = replace(experiment.strategy, parameters=params)
    return run_variant(experiment, market_data, strategy=strategy, program=program, label=f"{param}={value}", value=value, param=param)


def run_variant(
    experiment: Experiment,
    market_data: Mapping[str, tuple[Bar, ...]],
    *,
    config: BacktestConfig | None = None,
    strategy: Any | None = None,
    program: Any | None = None,
    label: str,
    value: float | int,
    param: str | None = None,
) -> dict[str, Any]:
    try:
        variant = replace(
            experiment,
            backtest=config or experiment.backtest,
            strategy=strategy or experiment.strategy,
            strategy_program=program or experiment.strategy_program,
            result=None,
        )
        result = run_backtest(variant, market_data)
        row: dict[str, Any] = {
            "label": label,
            "value": value,
            "metrics": to_primitive(result.metrics),
        }
        if param:
            row["param"] = param
        return row
    except DomainError as exc:
        return {"label": label, "value": value, "metrics": None, "error": str(exc), **({"param": param} if param else {})}


def fragility_verdict(
    base: MetricSet,
    cost_rows: list[dict[str, Any]],
    start_rows: list[dict[str, Any]],
    parameter_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    flags: list[str] = []
    cost_valid = [row for row in cost_rows if row.get("metrics")]
    start_valid = [row for row in start_rows if row.get("metrics")]
    param_valid = [row for row in parameter_rows if row.get("metrics")]

    if cost_valid:
        worst_cost = min(row["metrics"]["total_return"] for row in cost_valid)
        if base.total_return - worst_cost > 0.10:
            flags.append("cost_sensitive")
    if start_valid:
        returns = [row["metrics"]["total_return"] for row in start_valid]
        if max(returns) - min(returns) > 0.20:
            flags.append("start_date_sensitive")
    if param_valid:
        returns = [row["metrics"]["total_return"] for row in param_valid]
        if max(returns) - min(returns) > 0.20:
            flags.append("parameter_sensitive")
    if base.max_drawdown < -0.35:
        flags.append("deep_drawdown")
    if base.sharpe is None or base.sharpe < 0.5:
        flags.append("weak_risk_adjusted_return")

    if not flags:
        decision = "robust"
    elif len(flags) <= 2:
        decision = "fragile"
    else:
        decision = "overfit-risk"
    return {
        "decision": decision,
        "flags": flags,
        "summary": summary_for(decision, flags),
    }


def summary_for(decision: str, flags: list[str]) -> str:
    if not flags:
        return "Robustness checks did not find major sensitivity."
    labels = ", ".join(flag.replace("_", " ") for flag in flags[:3])
    return f"{decision}: {labels}."
