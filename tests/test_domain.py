from datetime import date, datetime, timezone
import json

import pytest

from backend.quant_lab.domain import (
    BacktestConfig,
    BacktestResult,
    Bar,
    CostModel,
    DataAdjustment,
    DomainError,
    Experiment,
    ExperimentStatus,
    Frequency,
    MarketDataSeries,
    MetricSet,
    PortfolioSnapshot,
    StrategyConfig,
    StrategyKind,
    WarningSeverity,
    RiskWarning,
    to_primitive,
)
from backend.quant_lab.json_codec import experiment_from_json, experiment_to_json


def test_backtest_config_requires_valid_window() -> None:
    with pytest.raises(DomainError, match="start_date must be before end_date"):
        BacktestConfig(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
            initial_capital=10_000,
            benchmark="SPY",
        )


def test_strategy_config_requires_universe() -> None:
    with pytest.raises(DomainError, match="universe cannot be empty"):
        StrategyConfig(kind=StrategyKind.BUY_AND_HOLD, universe=())


def test_market_data_rejects_mismatched_bars() -> None:
    with pytest.raises(DomainError, match="bars must match series symbol"):
        MarketDataSeries(
            symbol="SPY",
            source="fixture",
            adjustment=DataAdjustment.TOTAL_RETURN,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
            fetched_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
            bars=(
                Bar(
                    symbol="QQQ",
                    as_of=date(2024, 1, 2),
                    open=1,
                    high=1,
                    low=1,
                    close=1,
                ),
            ),
        )


def test_experiment_accepts_matching_result_and_serializes() -> None:
    experiment = _example_experiment()

    payload = to_primitive(experiment)

    assert payload["status"] == "completed"
    assert payload["strategy"]["kind"] == "moving_average_filter"
    assert payload["backtest"]["start_date"] == "2024-01-01"
    assert payload["result"]["warnings"][0]["severity"] == "caution"


def test_experiment_json_round_trip() -> None:
    experiment = _example_experiment()

    raw = experiment_to_json(experiment)
    loaded = experiment_from_json(raw)

    assert loaded == experiment
    assert json.loads(experiment_to_json(loaded)) == json.loads(raw)


def _example_experiment() -> Experiment:
    config = BacktestConfig(
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        initial_capital=10_000,
        benchmark="SPY",
        rebalance_frequency=Frequency.MONTHLY,
        cost_model=CostModel(commission_bps=1.0, slippage_bps=2.0),
    )
    strategy = StrategyConfig(
        kind=StrategyKind.MOVING_AVERAGE_FILTER,
        universe=("SPY",),
        parameters={"window": 200, "cash_when_below": True},
        rules=("Hold SPY when close is above 200-day moving average.",),
    )
    metrics = MetricSet(
        total_return=0.05,
        annualized_return=0.12,
        volatility=0.18,
        sharpe=0.7,
        max_drawdown=-0.08,
        turnover=0.3,
        exposure=0.8,
        benchmark_total_return=0.04,
    )
    result = BacktestResult(
        run_id="run_001",
        generated_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        config=config,
        strategy=strategy,
        metrics=metrics,
        equity_curve=(
            PortfolioSnapshot(
                as_of=date(2024, 1, 31),
                equity=10_500,
                cash=1_000,
                positions_value=9_500,
                drawdown=-0.02,
                exposure=0.9,
            ),
        ),
        warnings=(
            RiskWarning(
                code="short_window",
                severity=WarningSeverity.CAUTION,
                message="Backtest window is too short for confidence.",
            ),
        ),
    )
    experiment = Experiment(
        id="exp_001",
        name="SPY 200DMA",
        status=ExperimentStatus.COMPLETED,
        strategy=strategy,
        backtest=config,
        created_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        updated_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        result=result,
    )
    return experiment
