---
type: synthesis
status: active
created: 2026-05-28
updated: 2026-05-28
sources:
  - "[[Product Vision Brief]]"
tags:
  - quant-lab
  - ux
  - frontend
  - dashboard
---

# Research Cockpit UX

## Summary

Quant Lab UI should feel like a modern finance command center: dark-mode first, dense but readable, serious but approachable. It should guide users from hypothesis to backtest to stress test to research memo.

## Product Vibe

Target feel:

- Bloomberg Terminal discipline.
- Clean Vercel dashboard restraint.
- Strategy game cockpit sense of control.

Avoid:

- Stock predictor UI.
- Crypto casino energy.
- Generic AI chatbot center stage.
- Empty builder screen as first experience.

## Main Layout

```text
Left sidebar:
- Dashboard
- New Lab
- Strategies
- Portfolios
- Data
- Reports

Top bar:
- Current experiment
- Date range
- Run Backtest
- Export

Main area:
- charts
- metrics
- tables
- timelines

Right panel:
- AI Quant Assistant
```

## Home Dashboard

Home asks: "What do you want to research today?"

Template cards:

- Momentum Strategy Lab.
- Portfolio Optimizer.
- Drawdown Explorer.
- Regime Comparison.
- Risk Stress Test.
- Strategy Comparison.
- ETF Rotation Lab.

Recent labs:

- SPY Moving Average Crossover.
- ETF Momentum Rotation.
- 60/40 Portfolio Stress Test.

## Workspace Sections

Each lab workspace contains:

1. Assets.
2. Strategy logic.
3. Backtest settings.
4. Results.
5. Risk analysis.
6. AI commentary.
7. Experiment history.

## Results Cockpit

Required views:

- Equity curve vs benchmark.
- Drawdown chart.
- Metrics panel with collapsible groups: Performance, Risk, Trading Behavior, Benchmark Comparison.
- Trade timeline.
- Allocation over time for portfolio strategies.
- Warning strip for assumptions and data quality.

## AI Assistant Personality

Assistant should be skeptical quant researcher.

Good tone:

> "The result is promising, but fragile. Most outperformance comes from 2020-2021. When transaction costs increase to 0.25%, the edge nearly disappears. Test monthly rebalancing and compare against a simpler benchmark before trusting this."

It should explain:

- what strategy is doing
- where returns come from
- hidden risk
- overfit risk
- dangerous assumptions
- next experiments

## Visual Style

- Dark navy / charcoal background.
- Soft white text.
- Muted green for positive performance.
- Muted red for drawdowns.
- Amber for warnings.
- Blue/purple accent for AI insights.
- Dense dashboard layout, not hero page.
- Charts and tables first; decorative visuals last.

## Links

- [[Product Vision Brief]]
- [[MVP Roadmap]]
- [[Product Architecture]]
