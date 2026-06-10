---
type: reference
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - api
---

# API Reference

Base URL defaults to `http://127.0.0.1:8011`.

## Health

- `GET /health` -> `{ "status": "ok" }`

## Blueprints

- `GET /experiment-blueprints` -> built-in create templates.

## Experiments

- `GET /experiments` -> `{ experiments, count }`
- `GET /experiments/{experiment_id}` -> `{ experiment }`
- `POST /experiments` -> import/create complete experiment JSON.
- `POST /experiments/draft` -> create draft from form payload.
- `PUT /experiments/{experiment_id}` -> replace experiment; body `{ experiment }` or schema wrapper.
- `PUT /experiments/{experiment_id}/draft` -> update existing experiment from draft form payload.
- `DELETE /experiments/{experiment_id}` -> deletes local JSON file.

## Run

- `POST /experiments/{experiment_id}/run` -> synchronous run, saves completed experiment.
- `POST /experiments/{experiment_id}/run/async` -> `{ job_id, status }`
- `GET /experiments/{experiment_id}/run-status/{job_id}` -> running stage, completed experiment, or failure error.

Async stages:

- `starting`
- `fetching_data`
- `simulating`
- `saving`

## Exports

- `GET /experiments/{experiment_id}/export` -> experiment JSON download.
- `GET /experiments/{experiment_id}/tear-sheet` -> markdown tear sheet. Requires completed result.
- `POST /experiments/{experiment_id}/wiki-summary` -> writes `wiki/experiments/{name}.md`. Requires completed result.
- `POST /experiments/{experiment_id}/open-question` -> appends question to wiki open questions. Body `{ "question": "..." }`.

## Analysis

- `POST /experiments/{experiment_id}/variant` -> creates parameter variant. Body `{ "name": "...", "parameters": { ... } }`.
- `POST /experiments/{experiment_id}/sweep` -> runs parameter sweep against cached/fetched market data.
- `GET /experiments/{experiment_id}/robustness` -> cost, start-date, parameter sensitivity, and fragility verdict.
- `GET /experiments/{experiment_id}/changes/{base_experiment_id}` -> metric/parameter/assumption deltas. Both experiments need results.

## Common Errors

- `404` with `Experiment not found`
- `404` with `Job not found`
- `422` with domain validation detail
- `502` with `Market data fetch failed: ...`
