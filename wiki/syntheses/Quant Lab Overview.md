---
type: synthesis
status: active
created: 2026-05-28
updated: 2026-06-09
sources:
  - "[[Product Vision Brief]]"
tags:
  - quant-lab
  - overview
  - product
---

# Quant Lab Overview

## Summary

`quant-lab` is a web-based quant research lab for building, backtesting, stress-testing, and explaining investment strategies with deterministic analytics and an AI research assistant.

It is not a stock predictor or trading bot. It helps users build hypotheses, compare strategies, inspect drawdowns, test assumptions, understand failure modes, and generate research memos.

## Core Thesis

Claim: Retail strategy research tools should make uncertainty visible instead of presenting backtest output as final truth.

Claim: AI should act as skeptical quant research assistant, not calculation engine or trade decision-maker.

Inference: Useful product surface should emphasize assumptions, sensitivity analysis, robustness checks, regime splits, data quality, and drawdowns alongside headline returns.

## Product Shape

Main workflow:

1. User starts from dashboard or guided template.
2. User defines asset universe.
3. User chooses or builds strategy logic.
4. User sets backtest assumptions.
5. Backend runs deterministic analytics.
6. Results cockpit shows performance, drawdown, trades, allocations, warnings, and AI commentary.
7. User compares strategies, runs stress tests, and exports research memo.

## Current Direction

- Current app implements the backtest cockpit, experiment persistence, comparison, sweeps, diagnostics, research exports, and [[Robustness Lab]].
- Supported strategy templates are Buy and Hold, Moving Average Filter, and Momentum Rotation.
- Portfolio-project strength now comes from risk honesty: assumptions, drawdowns, OOS, regimes, data provenance, deterministic review, bootstrap stress, and robustness checks.
- Next direction should be refinement: demo data, README narrative, UI polish, screenshots, and smoke-test reliability.

## Focus Areas

- Strategy design and hypothesis tracking.
- Backtest quality, leakage prevention, and reproducibility.
- Risk metrics beyond average return.
- Regime dependence and robustness across market conditions.
- Retail usability: clear explanations, defaults, warnings, and visual diagnostics.
- Source provenance for data, assumptions, and research claims.

## Current Gaps

- No auth, multi-user storage, or hosted deployment model.
- Execution model is simplified: no taxes, borrow fees, liquidity constraints, partial fills, or broker routing.
- Robustness checks are deterministic heuristics; walk-forward optimization remains open.
- Custom rule builder exists at executable-block level, but natural-language strategy creation is not productized.
- Research memo export is Markdown, not polished PDF/share page.

## Links

- [[Product Vision Brief]]
- [[MVP Roadmap]]
- [[Product Architecture]]
- [[Research Cockpit UX]]
- [[Robustness Lab]]
- [[Open Questions]]
