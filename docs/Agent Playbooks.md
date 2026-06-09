---
type: guide
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - agent
  - playbook
---

# Agent Playbooks

Common tasks and likely files.

## Add API Endpoint

Read:

- [[Backend]]
- [[API Reference]]

Edit:

- `backend/quant_lab/api.py`
- `src/api/experiments.ts`
- `src/api/types.ts` if shape changes
- tests under `tests/`
- this docs folder if behavior changes

## Add Strategy Template

Edit:

- `backend/quant_lab/domain.py` for enum if needed
- `backend/quant_lab/programs.py` for executable program
- `backend/quant_lab/experiment_payloads.py` for draft payload/template support
- `src/components/ExperimentForm.tsx` and `src/components/experiment-form/`
- `tests/test_programs.py`, `tests/test_engine.py`

## Change Metrics Or Risk

Edit:

- `backend/quant_lab/engine_metrics.py`
- `backend/quant_lab/engine_risk.py`
- `backend/quant_lab/result_enrichment.py`
- `src/api/types.ts`
- `src/components/results/`
- `tests/test_engine.py`

## Change Experiment Form

Edit:

- `src/components/ExperimentForm.tsx`
- `src/components/experiment-form/`
- `src/api/types.ts`
- `backend/quant_lab/experiment_payloads.py` if payload changes

## Change Result UI

Edit:

- `src/components/ResultsPanel.tsx`
- `src/components/results/`
- `src/styles/results.css`
- `src/styles/tables-and-sweeps.css`

## Change Persistence

Edit:

- `backend/quant_lab/storage.py`
- `backend/quant_lab/json_codec.py`
- `backend/quant_lab/domain.py`
- route tests and json codec/storage tests

## Change Wiki Export

Edit:

- `backend/quant_lab/wiki_exports.py`
- `wiki/` templates if output structure changes
- [[Knowledge Base]]
