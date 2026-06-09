---
type: guide
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - agent
  - orientation
---

# Agent Orientation

Use this as first stop for coding work.

## What This Repo Is

Quant Lab is interactive strategy research environment. It helps retail investors build, backtest, stress-test, compare, and explain strategies. It is not trading bot or stock predictor.

## First Files To Read

1. [[index]] - docs catalog.
2. [[../AGENTS|AGENTS.md]] - response style, wiki rules, raw-source constraints.
3. [[Architecture]] - system map.
4. Relevant area doc: [[Backend]], [[Frontend]], [[Strategy Engine]], or [[Knowledge Base]].

## Main Commands

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8011
pnpm dev -- --host 127.0.0.1 --port 5173
pytest
pnpm build
```

## Edit Boundaries

- `raw/` is user-curated source storage. Do not modify raw source content unless user asks.
- `wiki/` is generated knowledge base owned by agents.
- `docs/` is codebase documentation for agents and maintainers.
- `data/experiments/` stores local experiment JSON files.
- `data/market_cache/` stores yfinance cache JSON files.

## High-Value Entry Points

- Backend app factory: [[../backend/quant_lab/api|backend/quant_lab/api.py]]
- Domain model: [[../backend/quant_lab/domain|backend/quant_lab/domain.py]]
- Backtest orchestration: [[../backend/quant_lab/engine|backend/quant_lab/engine.py]]
- Strategy programs: [[../backend/quant_lab/programs|backend/quant_lab/programs.py]]
- Frontend app: [[../src/App|src/App.tsx]]
- Main screen controller: [[../src/screens/LabsScreen|src/screens/LabsScreen.tsx]]
- API client/types: [[../src/api/experiments|src/api/experiments.ts]], [[../src/api/types|src/api/types.ts]]

## Current Shape

- Python backend: FastAPI, dataclass domain, JSON persistence, yfinance market data.
- Frontend: Vite + React + TypeScript.
- Strategy templates: buy-and-hold, moving-average filter, momentum rotation.
- Research outputs: tear sheet export, wiki experiment summary, open-question capture.

## Agent Rule

Prefer existing patterns. Keep edits narrow. Update docs when behavior changes.
