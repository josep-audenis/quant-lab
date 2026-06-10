---
type: synthesis
status: active
created: 2026-06-09
updated: 2026-06-09
sources:
  - "[[Robustness Lab]]"
  - "[[MVP Roadmap]]"
tags:
  - quant-lab
  - frontend
  - docs
---

# In-App Docs Tab

## Summary

Claim: Quant Lab now has a working in-app Docs tab.

Claim: The tab gives reviewers a compact product guide: review path, feature map, architecture, workflow, verification commands, and known limits.

Inference: This improves portfolio readability because reviewers can understand the product thesis without leaving the app.

## Implemented Surface

- `AppShell` nav now has clickable top-level tabs.
- `App` owns active tab state.
- `DocsScreen` renders project documentation inside the app.
- `DataScreen` gives the existing Data tab a coherent local data-layer placeholder.
- `docs.css` styles the docs/data surfaces.

## Docs Content

- What to review first.
- Product stance: not predictor, bot, or broker.
- Verification commands.
- Feature map.
- Runtime architecture.
- End-to-end research workflow.
- Honest limits.

## Links

- [[Robustness Lab]]
- [[MVP Roadmap]]
- [[Quant Lab Overview]]
