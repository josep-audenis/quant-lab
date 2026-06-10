from __future__ import annotations

import threading
from dataclasses import replace
from pathlib import Path
from typing import Any
from uuid import uuid4
from datetime import UTC, date, datetime

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .api_config import DEFAULT_EXPERIMENT_ROOT, DEFAULT_MARKET_CACHE_ROOT, allowed_origins, load_env_file
from .experiment_payloads import (
    build_draft_experiment,
    ensure_strategy_program,
    experiment_blueprints as build_experiment_blueprints,
    optional_str,
    parse_experiment_payload,
    required_str,
    strategy_program,
)
from .result_enrichment import enrich_result, experiment_changes
from .robustness import robustness_report
from .wiki_exports import append_open_question, tear_sheet_markdown, write_wiki_experiment_summary
from .domain import (
    BacktestConfig,
    BootstrapStress,
    CashPolicy,
    CostModel,
    DataReliability,
    DomainError,
    Experiment,
    ExperimentStatus,
    ExecutionTiming,
    Frequency,
    ChecklistItem,
    QuantReview,
    ReviewFlag,
    RunProvenance,
    SymbolDataProvenance,
    StrategyConfig,
    StrategyKind,
    WarningSeverity,
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



def create_app(
    store: ExperimentJsonStore | None = None,
    fetcher: MarketDataFetcher | None = None,
) -> FastAPI:
    load_env_file(Path(".env"))
    app = FastAPI(title="QuantLab API", version="0.1.0")
    app.state.store = store or ExperimentJsonStore(DEFAULT_EXPERIMENT_ROOT)
    app.state.fetcher = fetcher or MarketDataFetcher(DEFAULT_MARKET_CACHE_ROOT)
    app.state.run_jobs: dict[str, dict[str, Any]] = {}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/experiment-blueprints")
    def experiment_blueprints() -> dict[str, Any]:
        return {"blueprints": build_experiment_blueprints()}

    @app.get("/experiments")
    def list_experiments() -> dict[str, Any]:
        experiments = [ensure_strategy_program(experiment) for experiment in app.state.store.list()]
        return {
            "experiments": [to_primitive(experiment) for experiment in experiments],
            "count": len(experiments),
        }

    @app.get("/experiments/{experiment_id}")
    def get_experiment(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
            return {"experiment": to_primitive(experiment)}
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

    @app.get("/experiments/{experiment_id}/export")
    def export_experiment(experiment_id: str) -> Response:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        return Response(
            content=experiment_to_json(experiment),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{experiment.id}.json"'},
        )

    @app.get("/experiments/{experiment_id}/tear-sheet")
    def export_tear_sheet(experiment_id: str) -> Response:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        if experiment.result is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Experiment has no result")
        content = tear_sheet_markdown(experiment)
        return Response(
            content=content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{experiment.id}_tear_sheet.md"'},
        )

    @app.put("/experiments/{experiment_id}", status_code=status.HTTP_200_OK)
    def put_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        experiment = parse_experiment_payload(payload)
        if experiment.id != experiment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Experiment id must match URL id",
            )
        experiment = ensure_strategy_program(experiment)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.put("/experiments/{experiment_id}/draft", status_code=status.HTTP_200_OK)
    def put_draft_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            existing = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        experiment = build_draft_experiment(payload, existing=existing)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments", status_code=status.HTTP_201_CREATED)
    def post_experiment(payload: dict[str, Any]) -> dict[str, Any]:
        experiment = parse_experiment_payload(payload)
        experiment = ensure_strategy_program(experiment)
        saved = app.state.store.save(experiment)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments/draft", status_code=status.HTTP_201_CREATED)
    def post_draft_experiment(payload: dict[str, Any]) -> dict[str, Any]:
        experiment = build_draft_experiment(payload)
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

        experiment = ensure_strategy_program(experiment)
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
            result = enrich_result(
                run_backtest(experiment, market_data),
                app.state.fetcher,
                market_data_series,
                experiment.backtest,
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

        experiment = ensure_strategy_program(experiment)
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
                result = enrich_result(
                    run_backtest(experiment, market_data),
                    app.state.fetcher,
                    market_data_series,
                    experiment.backtest,
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

    @app.post("/experiments/{experiment_id}/variant", status_code=status.HTTP_201_CREATED)
    def create_experiment_variant(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

        params = dict(experiment.strategy.parameters)
        for key, value in dict(payload.get("parameters", {})).items():
            params[str(key)] = value
        try:
            program = strategy_program(experiment.strategy.kind, experiment.strategy.universe, params)
            validate_program(program)
            now = datetime.now(UTC)
            variant = replace(
                experiment,
                id=f"exp_{uuid4().hex[:12]}",
                name=str(payload.get("name") or f"{experiment.name} variant"),
                status=ExperimentStatus.DRAFT,
                strategy=replace(experiment.strategy, parameters=params),
                strategy_program=program,
                result=None,
                created_at=now,
                updated_at=now,
                notes=optional_str(payload.get("notes")) or experiment.notes,
            )
        except DomainError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        saved = app.state.store.save(variant)
        return {"experiment": to_primitive(saved)}

    @app.post("/experiments/{experiment_id}/wiki-summary", status_code=status.HTTP_201_CREATED)
    def write_experiment_wiki_summary(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        if experiment.result is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Experiment has no result")
        path = write_wiki_experiment_summary(experiment)
        return {"path": str(path), "page": path.stem}

    @app.get("/experiments/{experiment_id}/changes/{base_experiment_id}")
    def compareexperiment_changes(experiment_id: str, base_experiment_id: str) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
            base = ensure_strategy_program(app.state.store.get(base_experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        if experiment.result is None or base.result is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Both experiments need results")
        return {"changes": experiment_changes(base, experiment)}

    @app.post("/experiments/{experiment_id}/open-question", status_code=status.HTTP_201_CREATED)
    def capture_open_question(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc
        question = required_str(payload, "question")
        path = append_open_question(experiment, question)
        return {"path": str(path)}

    @app.post("/experiments/{experiment_id}/sweep", status_code=status.HTTP_200_OK)
    def sweep_experiment(experiment_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            experiment = app.state.store.get(experiment_id)
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

        param = payload.get("param")
        values = payload.get("values", [])
        param_b = payload.get("param_b")
        values_b = payload.get("values_b", [])
        if not param or not values:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="param and values are required")
        if param_b and not values_b:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="values_b is required when param_b is set")

        experiment = ensure_strategy_program(experiment)
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
        grid_results: list[dict[str, Any]] = []
        secondary_values = values_b if param_b else [None]
        for val in values:
            for val_b in secondary_values:
                try:
                    new_params = dict(experiment.strategy.parameters)
                    new_params[param] = val
                    if param_b:
                        new_params[param_b] = val_b
                    new_program = strategy_program(experiment.strategy.kind, experiment.strategy.universe, new_params)
                    new_experiment = replace(
                        experiment,
                        status=ExperimentStatus.DRAFT,
                        strategy=replace(experiment.strategy, parameters=new_params),
                        strategy_program=new_program,
                        result=None,
                    )
                    result = run_backtest(new_experiment, market_data)
                    if param_b:
                        grid_results.append({
                            "param_value": val,
                            "param_b_value": val_b,
                            "metrics": to_primitive(result.metrics),
                        })
                    elif val_b is None:
                        sweep_results.append({"param_value": val, "metrics": to_primitive(result.metrics)})
                except (DomainError, Exception):
                    if param_b:
                        grid_results.append({
                            "param_value": val,
                            "param_b_value": val_b,
                            "metrics": None,
                            "error": f"Failed for {param}={val}, {param_b}={val_b}",
                        })
                    else:
                        sweep_results.append({"param_value": val, "metrics": None, "error": f"Failed for {param}={val}"})

        if param_b:
            return {
                "param": param,
                "param_b": param_b,
                "values": values,
                "values_b": values_b,
                "sweep": sweep_results,
                "grid": grid_results,
            }

        return {"param": param, "sweep": sweep_results}

    @app.get("/experiments/{experiment_id}/robustness", status_code=status.HTTP_200_OK)
    def experiment_robustness(experiment_id: str) -> dict[str, Any]:
        try:
            experiment = ensure_strategy_program(app.state.store.get(experiment_id))
        except ExperimentNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found") from exc

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

        market_data = {sym: series.bars for sym, series in market_data_series.items()}
        try:
            report = robustness_report(experiment, market_data)
        except DomainError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        return {"robustness": report}

    return app


