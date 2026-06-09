from __future__ import annotations

import hashlib
import os
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any
from uuid import uuid4
from datetime import UTC, date, datetime

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .domain import (
    BacktestConfig,
    CashPolicy,
    CostModel,
    DomainError,
    Experiment,
    ExperimentStatus,
    ExecutionTiming,
    Frequency,
    RunProvenance,
    SymbolDataProvenance,
    StrategyConfig,
    StrategyKind,
    to_primitive,
)
from .engine import run_backtest
from .json_codec import experiment_from_json, experiment_to_json
from .market_data import MarketDataFetcher
from .programs import (
    buy_and_hold_program,
    momentum_rotation_program,
    moving_average_filter_program,
    validate_program,
)
from .storage import ExperimentJsonStore, ExperimentNotFoundError


DEFAULT_EXPERIMENT_ROOT = Path("data/experiments")
DEFAULT_MARKET_CACHE_ROOT = Path("data/market_cache")
DEFAULT_ALLOWED_ORIGINS = ("http://127.0.0.1:5173", "http://localhost:5173")


def create_app(
    store: ExperimentJsonStore | None = None,
    fetcher: MarketDataFetcher | None = None,
) -> FastAPI:
    _load_env_file(Path(".env"))
    app = FastAPI(title="QuantLab API", version="0.1.0")
    app.state.store = store or ExperimentJsonStore(DEFAULT_EXPERIMENT_ROOT)
    app.state.fetcher = fetcher or MarketDataFetcher(DEFAULT_MARKET_CACHE_ROOT)
    app.state.run_jobs: dict[str, dict[str, Any]] = {}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/experiment-blueprints")
    def experiment_blueprints() -> dict[str, Any]:
        return {"blueprints": _experiment_blueprints()}

    @app.get("/experiments")
    def list_experiments() -> dict[str, Any]:
        experiments = [_ensure_strategy_program(experiment) for experiment in app.state.store.list()]
        return {
            "experiments": [to_primitive(experiment) for experiment in experiments],
            "count": len(experiments),
        }

    @app.get("/experiments/{experiment_id}")
    def get_experiment(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = _ensure_strategy_program(app.state.store.get(experiment_id))
            return {"experiment": to_primitive(experiment)}
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

    @app.get("/experiments/{experiment_id}/export")
    def export_experiment(experiment_id: str) -> Response:
        try:
            experiment = _ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        return Response(
            content=experiment_to_json(experiment),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{experiment.id}.json"'},
        )

    @app.put("/experiments/{experiment_id}", status_code=status.HTTP_200_OK)
    def put_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        experiment = _parse_experiment_payload(payload)
        if experiment.id != experiment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Experiment id must match URL id",
            )
        experiment = _ensure_strategy_program(experiment)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.put("/experiments/{experiment_id}/draft", status_code=status.HTTP_200_OK)
    def put_draft_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            existing = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        experiment = _build_draft_experiment(payload, existing=existing)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments", status_code=status.HTTP_201_CREATED)
    def post_experiment(payload: dict[str, Any]) -> dict[str, Any]:
        experiment = _parse_experiment_payload(payload)
        experiment = _ensure_strategy_program(experiment)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments/draft", status_code=status.HTTP_201_CREATED)
    def post_draft_experiment(payload: dict[str, Any]) -> dict[str, Any]:
        experiment = _build_draft_experiment(payload)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.delete("/experiments/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_experiment(experiment_id: str) -> Response:
        try:
            app.state.store.delete(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.post("/experiments/{experiment_id}/run", status_code=status.HTTP_200_OK)
    def run_experiment(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

        experiment = _ensure_strategy_program(experiment)
        program = experiment.strategy_program
        assert program is not None

        all_symbols = list(program.universe)
        if experiment.backtest.benchmark not in all_symbols:
            all_symbols.append(experiment.backtest.benchmark)

        try:
            market_data_series = app.state.fetcher.fetch_many(
                tuple(all_symbols),
                experiment.backtest.start_date,
                experiment.backtest.end_date,
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data fetch failed: {exc}") from exc

        market_data = {symbol: series.bars for symbol, series in market_data_series.items()}

        try:
            result = replace(
                run_backtest(experiment, market_data),
                provenance=_run_provenance(app.state.fetcher, market_data_series, experiment.backtest),
            )
        except DomainError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

        now = datetime.now(UTC)
        updated = replace(
            experiment,
            status=ExperimentStatus.COMPLETED,
            result=result,
            updated_at=now,
        )
        saved = app.state.store.save(updated)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments/{experiment_id}/run/async", status_code=status.HTTP_202_ACCEPTED)
    def run_experiment_async(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

        experiment = _ensure_strategy_program(experiment)
        program = experiment.strategy_program
        assert program is not None

        job_id = f"job_{uuid4().hex[:8]}"
        app.state.run_jobs[job_id] = {"status": "running", "stage": "starting"}

        def _run() -> None:
            try:
                all_symbols = list(program.universe)
                if experiment.backtest.benchmark not in all_symbols:
                    all_symbols.append(experiment.backtest.benchmark)

                app.state.run_jobs[job_id]["stage"] = "fetching_data"
                market_data_series = app.state.fetcher.fetch_many(
                    tuple(all_symbols),
                    experiment.backtest.start_date,
                    experiment.backtest.end_date,
                )
                market_data = {sym: series.bars for sym, series in market_data_series.items()}

                app.state.run_jobs[job_id]["stage"] = "simulating"
                result = replace(
                    run_backtest(experiment, market_data),
                    provenance=_run_provenance(app.state.fetcher, market_data_series, experiment.backtest),
                )

                app.state.run_jobs[job_id]["stage"] = "saving"
                now = datetime.now(UTC)
                updated = replace(
                    experiment,
                    status=ExperimentStatus.COMPLETED,
                    result=result,
                    updated_at=now,
                )
                saved = app.state.store.save(updated)
                app.state.run_jobs[job_id] = {"status": "completed", "experiment": to_primitive(saved)}
            except Exception as exc:
                app.state.run_jobs[job_id] = {"status": "failed", "error": str(exc)}

        threading.Thread(target=_run, daemon=True).start()
        return {"job_id": job_id, "status": "running"}

    @app.get("/experiments/{experiment_id}/run-status/{job_id}")
    def run_job_status(experiment_id: str, job_id: str) -> dict[str, Any]:
        job = app.state.run_jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    @app.post("/experiments/{experiment_id}/sweep", status_code=status.HTTP_200_OK)
    def sweep_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            experiment = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

        param = payload.get("param")
        values = payload.get("values", [])
        if not param or not values:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="param and values are required")

        experiment = _ensure_strategy_program(experiment)
        all_symbols = list(experiment.strategy.universe)
        if experiment.backtest.benchmark not in all_symbols:
            all_symbols.append(experiment.backtest.benchmark)

        try:
            market_data_series = app.state.fetcher.fetch_many(
                tuple(all_symbols),
                experiment.backtest.start_date,
                experiment.backtest.end_date,
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data fetch failed: {exc}") from exc

        market_data = {sym: series.bars for sym, series in market_data_series.items()}

        sweep_results: list[dict[str, Any]] = []
        for val in values:
            try:
                new_params = dict(experiment.strategy.parameters)
                new_params[param] = val
                new_program = _strategy_program(experiment.strategy.kind, experiment.strategy.universe, new_params)
                new_experiment = replace(
                    experiment,
                    strategy=replace(experiment.strategy, parameters=new_params),
                    strategy_program=new_program,
                )
                result = run_backtest(new_experiment, market_data)
                sweep_results.append({"param_value": val, "metrics": to_primitive(result.metrics)})
            except (DomainError, Exception):
                sweep_results.append({"param_value": val, "metrics": None, "error": f"Failed for {param}={val}"})

        return {"param": param, "sweep": sweep_results}

    return app


def _build_draft_experiment(payload: dict[str, Any], existing: Experiment | None = None) -> Experiment:
    try:
        now = datetime.now(UTC)
        strategy_kind = StrategyKind(_required_str(payload, "strategy_kind"))
        universe = tuple(_split_symbols(payload.get("universe")))
        parameters = _strategy_parameters(strategy_kind, payload)
        program = _strategy_program(strategy_kind, universe, parameters)
        validate_program(program)
        return Experiment(
            id=existing.id if existing else f"exp_{uuid4().hex[:12]}",
            name=_required_str(payload, "name"),
            status=existing.status if existing else ExperimentStatus.DRAFT,
            strategy=StrategyConfig(
                kind=strategy_kind,
                universe=universe,
                parameters=parameters,
                rules=tuple(_rules(strategy_kind, universe, parameters, payload)),
            ),
            backtest=BacktestConfig(
                start_date=_required_date(payload, "start_date"),
                end_date=_required_date(payload, "end_date"),
                initial_capital=_required_float(payload, "initial_capital"),
                benchmark=_required_str(payload, "benchmark"),
                frequency=Frequency(payload.get("frequency", Frequency.DAILY.value)),
                rebalance_frequency=Frequency(payload.get("rebalance_frequency", Frequency.MONTHLY.value)),
                cost_model=CostModel(
                    commission_bps=_float(payload.get("commission_bps", 0.0)),
                    slippage_bps=_float(payload.get("slippage_bps", 0.0)),
                    min_commission=_float(payload.get("min_commission", 0.0)),
                ),
                cash_policy=CashPolicy(payload.get("cash_policy", CashPolicy.HOLD_CASH.value)),
                risk_free_rate=_float(payload.get("risk_free_rate", 0.0)),
                use_adjusted=bool(payload.get("use_adjusted", True)),
                oos_start_date=date.fromisoformat(payload["oos_start_date"]) if payload.get("oos_start_date") else None,
                execution_timing=ExecutionTiming(payload.get("execution_timing", ExecutionTiming.SAME_CLOSE.value)),
            ),
            created_at=existing.created_at if existing else now,
            updated_at=now,
            result=existing.result if existing else None,
            strategy_program=program,
            hypothesis=_required_str(payload, "hypothesis"),
            notes=_optional_str(payload.get("notes")),
        )
    except DomainError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


def _experiment_blueprints() -> list[dict[str, Any]]:
    return [
        {
            "id": "buy_and_hold",
            "name": "Core ETF hold",
            "description": "Single or basket buy-and-hold baseline.",
            "strategy_kind": StrategyKind.BUY_AND_HOLD.value,
            "universe": "SPY",
            "benchmark": "SPY",
            "ma_window": 200,
            "lookback_months": 12,
            "top_n": 1,
            "risk_note": "Baseline only; no timing edge claimed.",
        },
        {
            "id": "moving_average_filter",
            "name": "Trend filter",
            "description": "Hold asset above moving average, otherwise cash.",
            "strategy_kind": StrategyKind.MOVING_AVERAGE_FILTER.value,
            "universe": "SPY",
            "benchmark": "SPY",
            "ma_window": 200,
            "lookback_months": 12,
            "top_n": 1,
            "risk_note": "Sensitive to whipsaw and chosen window.",
        },
        {
            "id": "momentum_rotation",
            "name": "Momentum rotation",
            "description": "Rank liquid ETFs by trailing return and hold top assets.",
            "strategy_kind": StrategyKind.MOMENTUM_ROTATION.value,
            "universe": "SPY, QQQ, IWM, TLT, GLD",
            "benchmark": "SPY",
            "ma_window": 200,
            "lookback_months": 12,
            "top_n": 2,
            "risk_note": "Check regime dependence and turnover costs.",
        },
    ]


def _parse_experiment_payload(payload: dict[str, Any]) -> Experiment:
    try:
        return experiment_from_json(_normalize_payload(payload))
    except DomainError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


def _normalize_payload(payload: dict[str, Any]) -> str:
    if "schema_version" in payload and "experiment" in payload:
        import json

        return json.dumps(payload)
    if "experiment" in payload:
        import json

        return json.dumps({"schema_version": 1, "experiment": payload["experiment"]})
    import json

    return json.dumps({"schema_version": 1, "experiment": payload})


def _required_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise DomainError(f"{key} is required")
    return value.strip()


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise DomainError("notes must be text")
    stripped = value.strip()
    return stripped or None


def _required_date(payload: dict[str, Any], key: str) -> date:
    return date.fromisoformat(_required_str(payload, key))


def _required_float(payload: dict[str, Any], key: str) -> float:
    if key not in payload:
        raise DomainError(f"{key} is required")
    return _float(payload[key])


def _float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise DomainError("numeric field is invalid") from exc


def _int(value: Any, key: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise DomainError(f"{key} must be an integer") from exc
    if parsed <= 0:
        raise DomainError(f"{key} must be positive")
    return parsed


def _split_symbols(value: Any) -> list[str]:
    if isinstance(value, str):
        symbols = [item.strip().upper() for item in value.replace("\n", ",").split(",")]
    elif isinstance(value, list):
        symbols = [str(item).strip().upper() for item in value]
    else:
        raise DomainError("universe is required")
    return [symbol for symbol in symbols if symbol]


def _strategy_parameters(strategy_kind: StrategyKind, payload: dict[str, Any]) -> dict[str, Any]:
    if strategy_kind is StrategyKind.BUY_AND_HOLD:
        return {}
    if strategy_kind is StrategyKind.MOVING_AVERAGE_FILTER:
        return {
            "window": _int(payload.get("ma_window", 200), "ma_window"),
            "price_field": payload.get("price_field", "close"),
            "condition": "close_above_ma",
            "cash_when_below": bool(payload.get("cash_when_below", True)),
        }
    if strategy_kind is StrategyKind.MOMENTUM_ROTATION:
        return {
            "lookback_months": _int(payload.get("lookback_months", 12), "lookback_months"),
            "top_n": _int(payload.get("top_n", 1), "top_n"),
            "ranking_metric": payload.get("ranking_metric", "total_return"),
        }
    return dict(payload.get("strategy_parameters", {}))


def _strategy_program(
    strategy_kind: StrategyKind,
    universe: tuple[str, ...],
    parameters: dict[str, Any],
):
    if strategy_kind is StrategyKind.BUY_AND_HOLD:
        return buy_and_hold_program(universe)
    if strategy_kind is StrategyKind.MOVING_AVERAGE_FILTER:
        return moving_average_filter_program(universe[0], int(parameters["window"]))
    if strategy_kind is StrategyKind.MOMENTUM_ROTATION:
        return momentum_rotation_program(
            universe,
            int(parameters["lookback_months"]),
            int(parameters["top_n"]),
        )
    raise DomainError("Custom rules require a strategy_program")


def _ensure_strategy_program(experiment: Experiment) -> Experiment:
    if experiment.strategy_program is not None:
        validate_program(experiment.strategy_program)
        return experiment
    program = _strategy_program(
        experiment.strategy.kind,
        experiment.strategy.universe,
        dict(experiment.strategy.parameters),
    )
    validate_program(program)
    return replace(experiment, strategy_program=program)


def _rules(
    strategy_kind: StrategyKind,
    universe: tuple[str, ...],
    parameters: dict[str, Any],
    payload: dict[str, Any],
) -> list[str]:
    custom_rules = payload.get("rules")
    if isinstance(custom_rules, str) and custom_rules.strip():
        return [line.strip() for line in custom_rules.splitlines() if line.strip()]
    if strategy_kind is StrategyKind.BUY_AND_HOLD:
        return [f"Buy and hold {', '.join(universe)} for the configured backtest window."]
    if strategy_kind is StrategyKind.MOVING_AVERAGE_FILTER:
        return [
            f"Hold {universe[0]} when close is above its {parameters['window']}-day moving average.",
            "Hold cash when close is below the moving average.",
        ]
    if strategy_kind is StrategyKind.MOMENTUM_ROTATION:
        return [
            f"Rank {', '.join(universe)} by {parameters['lookback_months']}-month momentum.",
            f"Hold top {parameters['top_n']} assets at each rebalance.",
        ]
    return ["Run custom deterministic strategy rules."]


def _allowed_origins() -> list[str]:
    raw = os.getenv("QUANT_LAB_CORS_ORIGINS")
    if not raw:
        return list(DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def _run_provenance(
    fetcher: MarketDataFetcher,
    market_data_series: dict[str, Any],
    config: BacktestConfig,
) -> RunProvenance:
    return RunProvenance(
        data=tuple(
            _symbol_provenance(fetcher, series, config)
            for series in market_data_series.values()
        )
    )


def _symbol_provenance(
    fetcher: MarketDataFetcher,
    series: Any,
    config: BacktestConfig,
) -> SymbolDataProvenance:
    expected = _expected_bars(config.start_date, config.end_date)
    actual = sum(1 for bar in series.bars if config.start_date <= bar.as_of <= config.end_date)
    cache_path = fetcher._cache_path(series.symbol, config.start_date, config.end_date)
    cache_key = str(cache_path)
    cache_hash = _file_sha256(cache_path) if cache_path.exists() else None
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


def _expected_bars(start: date, end: date) -> int:
    return max(1, (end - start).days * 252 // 365)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
