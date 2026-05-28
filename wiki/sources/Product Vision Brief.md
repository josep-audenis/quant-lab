---
type: source
status: active
created: 2026-05-28
updated: 2026-05-28
sources: []
tags:
  - quant-lab
  - product-vision
  - source
---

# Product Vision Brief

## Source Metadata

- Raw file: conversation brief from user on 2026-05-28
- Author: user
- Ingested: 2026-05-28
- Source type: product vision / requirements brief
- Reliability: primary product direction

## Summary

Quant Lab should be a serious but approachable strategy research environment: Bloomberg Terminal meets clean Vercel dashboard meets strategy game cockpit.

It should not be a stock predictor or trading bot. It should help users build hypotheses, run deterministic backtests, stress-test assumptions, compare strategies, understand risk, and export research memos. AI acts as skeptical quant research assistant, not calculator or trade decision-maker.

## Key Claims

- Claim: Core user journey is `idea -> test -> compare -> stress-test -> understand weaknesses -> memo`.
- Claim: MVP should start with a backtest cockpit, not broad indicator library.
- Claim: AI should orchestrate and explain while deterministic backend performs calculations.
- Claim: Seriousness comes from exposing assumptions: costs, slippage, lookahead, data quality, drawdowns, regime dependence, and overfitting.
- Claim: First strong demo should answer: "Does the 200-day moving average actually protect SPY investors?"

## Product Scope

Core sections:

- Home dashboard with templates and recent labs.
- Asset universe builder with ticker search, groups, CSV import, data coverage, quality warnings, and correlation preview.
- Strategy builder with no-code templates first, code mode later.
- Backtest configuration with explicit assumptions.
- Results cockpit with equity curve, drawdowns, metrics, trade timeline, allocation over time, and AI commentary.
- Strategy comparison mode.
- Stress-test mode.
- Research memo export.

## MVP Sequence

- MVP 1: Backtest cockpit with tickers, date range, three templates, benchmark comparison, equity curve, drawdown, basic metrics, AI summary.
- MVP 2: Strategy comparison, saved experiments, costs, rebalance frequency, benchmark comparison, AI "what changed?" explanation.
- MVP 3: Stress testing with cost sensitivity, start-date sensitivity, regime split, walk-forward tests, overfitting warning.
- MVP 4: Research memo export, history, shareable reports.

## Implications For Quant Lab

- Frontend should feel like lab cockpit, not marketing site.
- Backend must keep analytics deterministic and testable.
- AI assistant should access structured tools and produce skeptical explanations.
- Product copy should avoid "AI finds winners" framing.
- Early technical depth should come from risk and robustness, not many indicators.

## Links

- [[Quant Lab Overview]]
- [[MVP Roadmap]]
- [[Research Cockpit UX]]
- [[Product Architecture]]
- [[Open Questions]]
