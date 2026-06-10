---
type: reference
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - frontend
---

# Frontend

Frontend is Vite + React + TypeScript.

## Entry Points

- `src/main.tsx` mounts app.
- `src/App.tsx` owns top-level tab state and wraps screens in `AppShell`.
- `src/screens/LabsScreen.tsx` owns top-level experiment state, screen mode, backend calls.
- `src/screens/DocsScreen.tsx` renders in-app reviewer documentation.
- `src/screens/DataScreen.tsx` renders current local data-layer notes.

## API Layer

- `src/api/experiments.ts` contains all HTTP calls.
- `src/api/types.ts` mirrors backend JSON shapes.
- `VITE_API_BASE_URL` controls backend URL. Default: `http://127.0.0.1:8011`.

## Screens

- `src/screens/LabsScreen.tsx` - state controller for list, create, editor, compare.
- `src/screens/labs/ExperimentListScreen.tsx` - experiment catalog and compare selection.
- `src/screens/labs/EditorScreen.tsx` - experiment editor shell.
- `src/screens/labs/ComparisonScreen.tsx` - multi-experiment comparison.
- `src/screens/labs/screenHelpers.ts` - labels/helpers.
- `src/screens/DocsScreen.tsx` - docs tab with review path, feature map, architecture, workflow, verification, and limits.
- `src/screens/DataScreen.tsx` - data tab placeholder documenting JSON store, market cache, and data assumptions.

## Components

- `AppShell.tsx` - app layout.
- `Hero.tsx` - top list screen entry.
- `NewLabCard.tsx` - empty state and import/create actions.
- `ExperimentForm.tsx` plus `components/experiment-form/` - creation/edit controls.
- `RuleBuilder.tsx`, `RuleWorkbench.tsx`, `components/workbench/` - strategy/rule editing, sweeps, and robustness.
- `components/workbench/RobustnessPanel.tsx` - cost, start-date, and parameter sensitivity UI.
- `ResultsPanel.tsx`, `components/results/` - metrics, charts, diagnostics, trade tables.

## Styles

- `src/styles.css` imports/holds global styles.
- `src/styles/` splits base, forms, builder, experiments, results, tables/sweeps, docs.

## Async Run Pattern

`runExperimentAsync` starts `POST /experiments/{id}/run/async`, then polls `/experiments/{id}/run-status/{job_id}` every 600 ms until completed or failed. UI displays backend stage labels.
