---
type: synthesis
status: active
created: 2026-05-28
updated: 2026-06-09
sources:
  - "[[Product Vision Brief]]"
tags:
  - quant-lab
  - roadmap
  - mvp
---

# MVP Roadmap

## Short Answer

Quant Lab has passed the core portfolio-project threshold: backtest cockpit, strategy comparison, robustness lab, diagnostics, and Markdown research exports are implemented. Next work should refine presentation and reliability instead of expanding scope.

## Current Portfolio Status

Implemented:

- Backtest cockpit.
- Strategy comparison and variants.
- Parameter sweeps and heatmaps.
- [[Robustness Lab]] for cost, start-date, and parameter sensitivity.
- Deterministic quant review, OOS, rolling metrics, regimes, data reliability, provenance, and bootstrap stress.
- Markdown tear sheet, wiki summary, and open question capture.
- README screenshot, feature matrix, known limits, and smoke verification.

Recommended next phase:

- Polish UI copy and spacing.
- Add 2-3 curated demo experiments.
- Improve README narrative and screenshots.
- Keep tests green with `python -m pytest`, `pnpm.cmd build`, and `pnpm.cmd smoke:frontend`.

## MVP 1: Backtest Cockpit

Goal: answer one research question end to end.

Required:

- Choose tickers.
- Choose date range.
- Choose one of three strategy templates:
  - Buy and Hold.
  - Moving Average Crossover.
  - Momentum Rotation.
- Configure initial capital, transaction cost, slippage, rebalance frequency, benchmark.
- Run backtest.
- Show equity curve vs benchmark.
- Show drawdown chart.
- Show core metrics: total return, annualized return, volatility, Sharpe, max drawdown, turnover, exposure.
- Show AI summary that explains return source, risk, fragility, and next test.

Killer demo:

- "Does the 200-day moving average actually protect SPY investors?"
- Compare buy-and-hold SPY vs SPY 200DMA filter.
- Include transaction costs and drawdown comparison.

## MVP 2: Strategy Comparison

Required:

- Save experiments.
- Compare multiple strategies side by side.
- Add benchmark comparison.
- Add transaction cost and rebalance controls.
- Add AI "what changed?" explanation.

Example comparison:

- Buy & Hold SPY.
- 200DMA SPY filter.
- 60/40 portfolio.
- Momentum ETF rotation.

## MVP 3: Stress Testing

Status: partially implemented through [[Robustness Lab]] and diagnostics.

Required:

- Cost sensitivity.
- Start-date sensitivity.
- Regime split.
- Walk-forward testing.
- Overfitting warning.
- Robustness score.

Risk checks:

- Performance collapse out of sample.
- Edge disappears after higher costs.
- Results depend on narrow parameter choice.
- Returns concentrated in one period.
- High turnover destroys net performance.

## MVP 4: Research Memos

Status: partially implemented through Markdown tear sheets and wiki experiment summaries.

Required:

- Markdown/PDF export.
- AI-generated research memo.
- Experiment history.
- Shareable public report pages.

Memo structure:

- Strategy Name.
- Hypothesis.
- Universe.
- Rules.
- Backtest Assumptions.
- Performance Summary.
- Risk Summary.
- Stress Tests.
- Failure Modes.
- Conclusion.
- Next Experiments.

## Build Principle

Prefer one honest backtest workflow over many half-supported indicators. Product credibility comes from assumptions, stress tests, and clear failure modes.

## Links

- [[Product Vision Brief]]
- [[Research Cockpit UX]]
- [[Product Architecture]]
- [[Robustness Lab]]
