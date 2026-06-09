---
type: reference
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - data-model
---

# Data Model

Canonical backend model lives in `backend/quant_lab/domain.py`. Frontend mirror lives in `src/api/types.ts`.

## Experiment

`Experiment` is top-level persisted object.

Key fields:

- `id`
- `name`
- `status`
- `strategy`
- `backtest`
- `created_at`
- `updated_at`
- `result`
- `strategy_program`
- `hypothesis`
- `notes`

Invariant: if `result` exists, `result.config == backtest` and `result.strategy == strategy`.

## BacktestConfig

Config fields:

- `start_date`, `end_date`
- `initial_capital`
- `benchmark`
- `frequency`
- `rebalance_frequency`
- `cost_model`
- `cash_policy`
- `risk_free_rate`
- `use_adjusted`
- `oos_start_date`
- `execution_timing`

Important invariants: start before end, capital positive, benchmark non-empty, OOS date inside range.

## StrategyConfig

Human/UI-facing strategy metadata:

- `kind`
- `universe`
- `parameters`
- `rules`

## StrategyProgram

Executable strategy representation:

- `version`: currently `1`
- `universe`
- `blocks`

Supported block types:

- `allocation`
- `indicator`
- `condition`

Supported indicators:

- `moving_average`
- `momentum_return`

## BacktestResult

Run output:

- `metrics`
- `equity_curve`
- `fills`
- `warnings`
- `benchmark_curve`
- `oos_metrics`
- `provenance`
- `rolling_metrics`
- `oos_analysis`
- `regime_results`
- `data_reliability`
- `portfolio_risk`
- `quant_review`
- `bootstrap_stress`

## Serialization

Backend uses `to_primitive` for API JSON. Dates/datetimes become ISO strings. Enums become string values. Dataclasses become nested objects.
