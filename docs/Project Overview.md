---
type: overview
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - product
---

# Project Overview

Quant Lab is web-based quant research lab for strategy hypotheses.

## Purpose

Users create experiments, run backtests, inspect risk, compare variants, and export research artifacts. Main educational goal: reveal risk, overfitting, leakage, regime dependence, transaction costs, and weak assumptions.

## Non-Goals

- No automated trading.
- No price prediction promises.
- No brokerage execution.
- No black-box AI strategy generation as source of truth.

## MVP Workflow

1. Create experiment from template or JSON import.
2. Configure universe, dates, capital, benchmark, costs, cash policy, rebalance cadence.
3. Run async backtest.
4. Inspect metrics, equity curve, drawdowns, warnings, fills, data reliability, risk review.
5. Save variants or sweep parameters.
6. Export JSON, tear sheet, wiki summary, or open question.

## Supported Strategy Kinds

- `buy_and_hold`
- `moving_average_filter`
- `momentum_rotation`
- `custom_rules` exists in domain enum, but payload builder currently requires explicit `strategy_program`.

## Persistence

- Experiments persist as JSON files under `data/experiments/`.
- Market data caches under `data/market_cache/`.
- Wiki outputs write into `wiki/experiments/` and `wiki/questions/Open Questions.md`.
