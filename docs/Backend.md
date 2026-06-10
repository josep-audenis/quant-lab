---
type: reference
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - backend
---

# Backend

Backend is FastAPI app under `backend/quant_lab/`.

## Entry Points

- `backend/main.py` creates `app = create_app()`.
- `backend/quant_lab/api.py` defines routes and app dependencies.
- `backend/quant_lab/api_config.py` loads `.env`, default paths, CORS origins.

## Core Modules

- `domain.py` - frozen dataclasses, enums, invariants, primitive serialization.
- `experiment_payloads.py` - draft payload parsing, templates, strategy program construction.
- `json_codec.py` - experiment JSON import/export.
- `storage.py` - file-backed experiment store.
- `market_data.py` - yfinance downloader and JSON cache.
- `programs.py` - strategy block validation/interpreter and template builders.
- `engine.py` - high-level backtest orchestration.
- `engine_simulation.py` - portfolio simulation and rebalance execution.
- `engine_metrics.py` - metrics, benchmark, rolling, OOS, regimes.
- `engine_risk.py` - risk warnings and portfolio risk.
- `result_enrichment.py` - provenance, reliability, review, bootstrap stress.
- `robustness.py` - cost, start-date, and parameter sensitivity plus fragility verdict.
- `wiki_exports.py` - tear sheets, experiment wiki summary, open questions.

## Dependency Injection

`create_app(store=None, fetcher=None)` allows tests to pass custom store/fetcher. Keep this pattern for testable route changes.

## Error Style

Domain validation raises `DomainError`. API routes translate domain/value errors into HTTP 422. Missing experiments become 404. Market data fetch failures become 502.

## Storage Rules

`ExperimentJsonStore` accepts experiment IDs only without `/`, `\`, `:`, or `..`. Save writes complete JSON replacement to `data/experiments/{id}.json`.

## Market Data

`MarketDataFetcher` uses yfinance with `auto_adjust=True`. Cache file name: `{symbol}_{start}_{end}.json`. End date passed to yfinance is exclusive, so fetch adds one day.
