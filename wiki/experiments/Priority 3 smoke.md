---
type: experiment
status: active
created: 2026-06-10
updated: 2026-06-10
sources: []
tags:
  - quant-lab
  - experiment
---

# Priority 3 smoke

## Summary

Claim: `exp_523ec68b7f74` ran `momentum_rotation` from 2020-01-01 to 2025-12-31.
Claim: Total return was 146.22%, max drawdown was -33.72%, and turnover was 6.0x.

## Hypothesis

Smoke test priority 3 diagnostics.

## Assumptions

- Universe: SPY, QQQ
- Benchmark: SPY
- Execution: same_close
- Cash policy: hold_cash
- Costs: 1.0 bps commission, 1.0 bps slippage

## Robustness

- OOS verdict: improved
- Data score: 99.8
- Average exposure: 100.00%
- Credibility: unknown
- Decision: unknown

## Regimes

- COVID crash: -33.72% return, -33.72% max drawdown
- Rate shock: -29.55% return, -29.86% max drawdown

## Risk Flags

- info: Universe is user-selected, not point-in-time survivorship-safe.

## Links

- [[Open Questions]]
