---
type: synthesis
status: active
created: 2026-06-09
updated: 2026-06-09
sources:
  - "[[Product Vision Brief]]"
  - "[[MVP Roadmap]]"
tags:
  - quant-lab
  - robustness
  - portfolio-project
---

# Robustness Lab

## Summary

Claim: Quant Lab now includes a working Robustness Lab that runs deterministic sensitivity checks for cost assumptions, start dates, and key strategy parameters.

Claim: The implementation adds backend robustness analysis, a frontend workbench tab, README portfolio polish, a screenshot, and smoke verification.

Inference: This moves the project from basic backtest cockpit toward a stronger portfolio project because it demonstrates the central product thesis: a strategy result is not credible until fragility is visible.

## Implemented Feature

- Backend endpoint: `GET /experiments/{experiment_id}/robustness`.
- Backend module: `backend/quant_lab/robustness.py`.
- Frontend component: `src/components/workbench/RobustnessPanel.tsx`.
- API typing: `RobustnessReport`, `RobustnessPoint`.
- Workbench mode: `Robustness`.
- README screenshot: `docs/assets/robustness-lab.png`.
- Smoke script: `pnpm.cmd smoke:frontend`.

## Checks

Cost sensitivity:

- Runs variants over round-trip cost bps.
- Reports return, Sharpe, drawdown, and turnover deltas.

Start-date sensitivity:

- Runs variants with shifted start dates.
- Reveals timing dependence.

Parameter sensitivity:

- Moving average filter varies `window`.
- Momentum rotation varies `lookback_months` and `top_n`.

Fragility verdict:

- Returns `robust`, `fragile`, or `overfit-risk`.
- Flags cost sensitivity, start-date sensitivity, parameter sensitivity, deep drawdown, and weak risk-adjusted return.

## Portfolio Implication

Inference: Best next step is refinement, not major feature expansion. Project now has enough depth for portfolio review: full-stack architecture, deterministic engine, robust diagnostics, readable UI, docs, screenshot, and tests.

## Remaining Limits

- Robustness checks are deterministic heuristics, not full statistical validation.
- Walk-forward optimization is still not implemented.
- Custom rule builder remains technical rather than natural-language driven.
- Memo export is Markdown, not PDF/share page.

## Links

- [[Quant Lab Overview]]
- [[MVP Roadmap]]
- [[Product Architecture]]
- [[Research Cockpit UX]]
