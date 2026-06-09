# quant-lab
An interactive strategy research environment for retail investors to understand risk, overfitting, and regime dependence.

## Product vision

Quant Lab is a web-based quant research lab for building, backtesting, stress-testing, and explaining investment strategies with deterministic analytics and an AI research assistant.

It is not a stock predictor or trading bot. It helps users build hypotheses, compare strategies, inspect drawdowns, test assumptions, and generate research memos.

Initial MVP: backtest cockpit with Buy and Hold, Moving Average Crossover, and Momentum Rotation templates.

## Knowledge base

This repo includes an LLM-maintained wiki pattern:

- `raw/` stores immutable source files.
- `wiki/` stores generated markdown pages.
- `wiki/index.md` is the content catalog.
- `wiki/log.md` is the append-only activity timeline.
- `AGENTS.md` defines ingest, query, and lint workflows for future agent sessions.

## Agent docs

Agent-readable technical documentation lives in `docs/`.

- `docs/index.md` is the docs catalog.
- `docs/llms.txt` is the compact agent manifest.

## Local development

Edit `.env` if you want custom ports.

Backend:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8011
```

Frontend:

```bash
pnpm dev -- --host 127.0.0.1 --port 5173
```
