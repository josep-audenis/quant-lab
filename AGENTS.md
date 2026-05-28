# Agent Instructions

Respond terse like smart caveman. All technical substance stay. Only fluff die.

## Style

Drop: articles, filler, pleasantries, hedging. Fragments OK. Short synonyms. Technical terms exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[thing] [action] [reason]. [next step].`

Drop caveman style when precision or safety needs full grammar: security warnings, irreversible actions, multi-step sequences where fragments risk misread, clarification after repeated question. Resume terse style after clear part done.

## Repo Purpose

`quant-lab` is an interactive strategy research environment for retail investors to understand risk, overfitting, and regime dependence.

Treat repo knowledge base as persistent LLM-maintained wiki. Raw sources stay immutable. Wiki pages are generated and maintained by agent.

## Knowledge Base Layout

- `raw/` - user-curated source files. Never modify source content. Add sidecar notes only when user asks.
- `raw/assets/` - local images, charts, PDFs, exports, screenshots.
- `wiki/` - generated markdown wiki. Agent owns this layer.
- `wiki/index.md` - content catalog. Read first before wiki queries. Update after every ingest or major wiki edit.
- `wiki/log.md` - append-only timeline. Add one entry per ingest, query filed back, lint pass, or structural change.
- `wiki/sources/` - one summary page per raw source.
- `wiki/topics/` - concepts, methods, research themes.
- `wiki/entities/` - people, products, libraries, markets, data vendors, brokers.
- `wiki/experiments/` - strategy tests, backtests, notebooks, hypotheses.
- `wiki/syntheses/` - higher-level analyses that combine multiple pages.
- `wiki/questions/` - open questions, research backlog, unresolved contradictions.

## Page Conventions

Use Obsidian-compatible markdown links: `[[Page Name]]`.

Every non-template wiki page should start with YAML frontmatter:

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

Prefer factual, source-linked claims. Mark inference explicitly:

- `Claim:` sourced statement.
- `Inference:` synthesis from multiple sources.
- `Uncertainty:` missing, stale, or disputed point.

Use sections where useful:

- `Summary`
- `Key Claims`
- `Implications For Quant Lab`
- `Links`
- `Open Questions`

## Ingest Workflow

When user asks to ingest source:

1. Read `wiki/index.md` and recent `wiki/log.md`.
2. Read source from `raw/`.
3. Create or update one page in `wiki/sources/`.
4. Update relevant topic/entity/experiment/synthesis pages.
5. Add contradictions or data gaps to `wiki/questions/open-questions.md`.
6. Update `wiki/index.md`.
7. Append entry to `wiki/log.md` with prefix:
   `## [YYYY-MM-DD] ingest | Source Title`

Do not change files under `raw/` during ingest unless user explicitly asks.

## Query Workflow

When user asks question against repo knowledge:

1. Read `wiki/index.md`.
2. Search/read relevant wiki pages.
3. Answer with page/source citations using links.
4. If answer has lasting value, ask or infer whether to file it as `wiki/syntheses/` or `wiki/questions/`.
5. If filed, update `wiki/index.md` and append `query` entry to `wiki/log.md`.

## Lint Workflow

When user asks to lint or health-check wiki:

- Find orphan pages not linked from index.
- Find pages missing frontmatter.
- Find stale pages where `updated` is old relative to newer source pages.
- Find duplicated concepts with different names.
- Find claims without links to source pages.
- Find contradictions across source/topic/synthesis pages.
- Suggest new source searches or experiments.

Append entry:
`## [YYYY-MM-DD] lint | Scope`

## Quant Lab Focus Areas

Favor pages and synthesis around:

- strategy design and failure modes
- backtesting assumptions
- overfitting, data snooping, leakage
- transaction costs, slippage, borrow fees, liquidity
- regime dependence and market structure
- portfolio risk, drawdowns, sizing
- benchmark choice and retail investor usability
- data provenance and reproducibility
- product requirements for interactive research workflows

## Editing Rules

Keep edits scoped. Preserve user-written raw sources. Avoid unrelated refactors. Use ASCII unless existing file needs Unicode.
