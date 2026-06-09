---
type: guide
status: active
created: 2026-06-09
updated: 2026-06-09
tags:
  - quant-lab
  - knowledge-base
  - wiki
---

# Knowledge Base

Repo has agent-maintained knowledge base modeled as wiki.

## Layers

- `raw/` - immutable user-curated sources.
- `raw/assets/` - local source assets.
- `wiki/` - generated Obsidian-compatible knowledge pages.
- `docs/` - codebase docs for agents and maintainers.

## Wiki Index

Read `wiki/index.md` first for knowledge queries. It links sources, topics, syntheses, experiments, questions, and templates.

## Required Wiki Frontmatter

Most wiki pages use:

```yaml
---
type: source|topic|entity|experiment|synthesis|question|index|log
status: draft|active|stale|archived
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources:
  - "[[Source Page]]"
tags:
  - quant-lab
---
```

## Source Claim Style

- `Claim:` sourced statement.
- `Inference:` synthesis from multiple sources.
- `Uncertainty:` missing, stale, or disputed point.

## Backend Wiki Hooks

- `GET /experiments/{id}/tear-sheet` exports markdown.
- `POST /experiments/{id}/wiki-summary` writes experiment summary.
- `POST /experiments/{id}/open-question` appends research backlog item.

## Agent Rule

Do not change `raw/` source content unless user explicitly asks. Update `wiki/index.md` and `wiki/log.md` after ingests or major wiki edits.
