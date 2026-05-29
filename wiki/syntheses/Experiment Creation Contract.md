---
type: synthesis
status: active
created: 2026-05-29
updated: 2026-05-29
sources:
  - "[[Product Vision Brief]]"
  - "[[Product Architecture]]"
  - "[[MVP Roadmap]]"
tags:
  - quant-lab
  - experiments
  - product-contract
---

# Experiment Creation Contract

## Summary

Experiment creation should capture a research question, strategy configuration, and backtest assumptions in a JSON-exportable object. Storage remains file-backed JSON for now; no database is required.

## Required Creation Inputs

- `name` - short experiment label.
- `hypothesis` - research claim being tested.
- `universe` - one or more ticker symbols.
- `strategy_kind` - `buy_and_hold`, `moving_average_filter`, or `momentum_rotation`.
- `strategy_parameters` - template-specific deterministic parameters.
- `rules` - generated or edited human-readable strategy rules.
- `start_date` and `end_date` - backtest window.
- `initial_capital` - starting cash amount.
- `benchmark` - comparison ticker or benchmark identifier.
- `frequency` - data/backtest frequency, default `daily`.
- `rebalance_frequency` - rebalance cadence, default `monthly`.
- `commission_bps`, `slippage_bps`, and `min_commission` - cost assumptions.
- `cash_policy` - how idle capital is handled.
- `risk_free_rate` - input for risk-adjusted metrics.
- `notes` - optional research notes.

## Backend Generated Fields

- `id`
- `status = draft`
- `created_at`
- `updated_at`
- `result = null`

## Import And Export

Claim: Experiments should remain importable and exportable as JSON files.

Implementation contract:

- Import accepts the existing JSON wrapper: `schema_version` plus `experiment`.
- Create accepts form params and writes the same JSON wrapper.
- Edit updates the experiment JSON and keeps it exportable through `/experiments/{id}/export`.
- Export returns the JSON wrapper, not only the inner experiment object.

## Executable Strategy Program

Experiments store executable rule logic in `strategy_program`, separate from human-readable `rules`.

Current program shape:

```json
{
  "version": 1,
  "universe": ["SPY"],
  "blocks": [
    {
      "id": "ma_1",
      "type": "indicator",
      "indicator": "moving_average",
      "symbol": "SPY",
      "window": 200,
      "price": "close"
    },
    {
      "id": "rule_1",
      "type": "condition",
      "if": {
        "left": { "ref": "SPY.close" },
        "operator": ">",
        "right": { "ref": "ma_1" }
      },
      "then": [{ "action": "set_weight", "symbol": "SPY", "weight": 1.0 }],
      "else": [{ "action": "set_cash", "weight": 1.0 }]
    }
  ]
}
```

Supported executable blocks now:

- `allocation` - fixed target weights for buy-and-hold style programs.
- `indicator` - `moving_average` and `momentum_return` definitions.
- `condition` - comparison rule with `then` and `else` action branches.

Validation checks:

- block ids are unique
- referenced blocks and symbols exist
- symbols belong to universe
- indicator windows are positive
- action/allocation weights are non-negative and do not exceed 1

Interpreter output:

- dated target weights
- cash allocation

Backtest engine should consume this target-weight stream next.

## Links

- [[Product Vision Brief]]
- [[Product Architecture]]
- [[MVP Roadmap]]
