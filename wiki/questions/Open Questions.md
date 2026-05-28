---
type: question
status: active
created: 2026-05-28
updated: 2026-05-28
sources:
  - "[[Quant Lab Overview]]"
  - "[[Product Vision Brief]]"
tags:
  - quant-lab
  - questions
---

# Open Questions

## Product Scope

- Should MVP 1 support only US ETFs/equities plus `BTC-USD`, or keep crypto out until later?
- Should app ship under `QuantLab`, `ThesisLab`, or another product name?
- Should first workflow be template-driven only, or include freeform natural-language strategy creation?

## Research Method

- Which exact metrics belong in MVP 1 vs advanced collapsible sections?
- What minimum overfitting warnings should appear before full stress-test engine exists?
- How should regime labels be derived for first demo: simple date windows, market drawdown states, or external macro data?

## Data

- Which market data provider should power MVP: yfinance, Stooq, Polygon, Tiingo, Alpha Vantage, or uploaded CSV?
- How should data quality and provenance be shown to users?
- What minimum metadata must every cached price series carry?

## Implementation

- Should frontend and backend be scaffolded as separate apps now, or start with a single full-stack framework?
- Which charting library best fits dense finance cockpit: Recharts, ECharts, Lightweight Charts, Plotly, or Visx?
- Should experiments persist in SQLite for MVP?

## Wiki Maintenance

- Which external source should be ingested first: backtesting methodology paper, transaction cost reference, or data provider docs?
- Should major implementation decisions become `wiki/syntheses/` pages automatically?
