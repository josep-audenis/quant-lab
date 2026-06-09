---
type: guide
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - testing
---

# Testing

## Test Commands

Python:

```bash
pytest
```

Frontend build/type check:

```bash
pnpm build
```

## Current Test Files

- `tests/test_domain.py` - dataclass invariants and domain validation.
- `tests/test_engine.py` - backtest engine behavior.
- `tests/test_market_data.py` - market data cache/fetch behavior.
- `tests/test_programs.py` - strategy program validation/interpreter.
- `tests/test_run_endpoint.py` - API run endpoint behavior.

## Test Strategy

- Use app dependency injection: pass custom store/fetcher into `create_app`.
- Prefer deterministic market data fixtures over live yfinance calls.
- Test domain errors at source, then API translation at route level.
- Add frontend type coverage through `pnpm build` until dedicated UI tests exist.

## When To Broaden Tests

- Strategy program changes: add `test_programs.py` cases.
- Simulation/metrics changes: add `test_engine.py` cases with known prices and expected values.
- API payload changes: add route tests plus frontend type updates.
- Persistence changes: add storage/json codec tests.
