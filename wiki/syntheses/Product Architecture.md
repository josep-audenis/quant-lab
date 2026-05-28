---
type: synthesis
status: active
created: 2026-05-28
updated: 2026-05-28
sources:
  - "[[Product Vision Brief]]"
tags:
  - quant-lab
  - architecture
  - backend
  - frontend
---

# Product Architecture

## Summary

Quant Lab should separate three responsibilities:

- Frontend guides research workflow and visualizes results.
- Backend runs deterministic market data, strategy, backtest, analytics, stress test, and report services.
- AI assistant explains, orchestrates, and proposes next tests using structured tools.

## Proposed Repo Shape

```text
frontend/
  React + TypeScript
  charts
  strategy builder
  dashboard
  AI side panel

backend/
  FastAPI
  market_data/
  strategies/
  backtesting/
  analytics/
  agents/
  reports/

data/
  price cache
  experiment database
  user strategies
  generated reports
```

## Backend Modules

```text
market_data/
  fetch_prices.py
  normalize_prices.py
  cache.py

strategies/
  base.py
  buy_hold.py
  moving_average.py
  momentum_rotation.py

backtesting/
  engine.py
  execution.py
  costs.py
  portfolio.py

analytics/
  metrics.py
  drawdowns.py
  risk.py
  regimes.py
  stress_tests.py

agents/
  quant_assistant.py
  tools.py
  prompts.py

reports/
  memo_generator.py
```

## Data Model

```text
Experiment
- id
- name
- asset_universe
- strategy_config
- backtest_config
- results
- created_at

StrategyConfig
- type
- parameters
- rebalance_frequency
- rules

BacktestConfig
- start_date
- end_date
- initial_capital
- transaction_cost
- slippage
- benchmark

BacktestResult
- equity_curve
- drawdown_series
- trades
- positions
- metrics
- warnings
```

## AI Tool Boundary

AI should not calculate performance metrics directly. It should call tools that wrap deterministic backend services:

- `get_strategy_config`
- `get_backtest_results`
- `compare_strategies`
- `calculate_risk_metrics`
- `run_stress_test`
- `explain_drawdown`
- `detect_overfitting`
- `suggest_next_experiment`
- `summarize_results`
- `generate_research_memo`

## Natural Language Strategy Pattern

LLM converts user intent into structured config. Backend executes config deterministically.

Example:

```json
{
  "strategy": "moving_average_filter",
  "asset": "SPY",
  "window": 200,
  "condition": "close_above_ma",
  "else": "cash"
}
```

## Architecture Risks

- Avoid hiding calculations inside AI responses.
- Avoid adding many indicators before testing engine is trustworthy.
- Avoid prediction framing.
- Make data quality, costs, and assumptions visible in every result.

## Links

- [[Product Vision Brief]]
- [[MVP Roadmap]]
- [[Research Cockpit UX]]
