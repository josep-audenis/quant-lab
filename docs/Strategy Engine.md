---
type: reference
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - engine
  - strategies
---

# Strategy Engine

Engine converts experiment plus market data into backtest result.

## Run Pipeline

1. `run_backtest` requires `experiment.strategy_program`.
2. `interpret_program` converts strategy blocks into dated target weights.
3. `apply_rebalance_frequency` reduces targets to configured rebalance cadence.
4. `simulate` converts target weights into snapshots and fills.
5. `compute_metrics` calculates return, volatility, Sharpe, drawdown, turnover, exposure.
6. Benchmark, rolling metrics, OOS analysis, regimes, warnings, and risk are added.
7. API calls `enrich_result` for provenance, data reliability, review, bootstrap stress.

## Built-In Programs

- `buy_and_hold_program(universe)`
- `moving_average_filter_program(symbol, window)`
- `momentum_rotation_program(universe, lookback_months, top_n)`

## Strategy Blocks

`allocation` sets target weights directly or ranks by `ranking_ref`.

`indicator` computes reusable values:

- moving average over close price
- trailing momentum return

`condition` compares refs and chooses action branch.

Supported operators: `>`, `<`, `>=`, `<=`.

Supported actions:

- `set_weight`
- `set_cash`

## Known Constraints

- Moving average supports `close` only.
- Allocation total cannot exceed `1`.
- Condition branch actions total plus cash cannot exceed `1`.
- Momentum date logic uses approximate month lookback in current implementation.
- `custom_rules` enum exists, but draft builder does not synthesize custom programs.
