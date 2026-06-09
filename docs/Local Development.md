---
type: guide
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - development
---

# Local Development

## Install

Python dependencies:

```bash
pip install -r requirements.txt
```

Node dependencies:

```bash
pnpm install
```

## Run Backend

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8011
```

## Run Frontend

```bash
pnpm dev -- --host 127.0.0.1 --port 5173
```

## Build

```bash
pnpm build
```

## Test

```bash
pytest
```

## Environment

`.env` is loaded by backend on app creation. Supported backend variable:

- `QUANT_LAB_CORS_ORIGINS` - comma-separated allowed origins. Default includes `http://127.0.0.1:5173` and `http://localhost:5173`.

Frontend variable:

- `VITE_API_BASE_URL` - backend URL. Default: `http://127.0.0.1:8011`.

## Runtime Paths

- Experiments: `data/experiments/`
- Market cache: `data/market_cache/`
