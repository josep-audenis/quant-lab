from __future__ import annotations

from datetime import date
from pathlib import Path

from .domain import DomainError, Experiment

def write_wiki_experiment_summary(experiment: Experiment) -> Path:
    result = experiment.result
    if result is None:
        raise DomainError("Experiment has no result")
    wiki_root = Path("wiki")
    experiments_dir = wiki_root / "experiments"
    experiments_dir.mkdir(parents=True, exist_ok=True)
    page_name = wiki_page_name(experiment.name)
    path = experiments_dir / f"{page_name}.md"
    today = date.today().isoformat()
    warnings = "\n".join(f"- {warning.severity.value}: {warning.message}" for warning in result.warnings) or "- None"
    regimes = "\n".join(
        f"- {regime.name}: {regime.metrics.total_return:.2%} return, {regime.metrics.max_drawdown:.2%} max drawdown"
        for regime in result.regime_results
    ) or "- No named regime overlap"
    average_exposure = f"{result.portfolio_risk.average_exposure:.2%}" if result.portfolio_risk else "unknown"
    review = result.quant_review
    content = f"""---
type: experiment
status: active
created: {today}
updated: {today}
sources: []
tags:
  - quant-lab
  - experiment
---

# {experiment.name}

## Summary

Claim: `{experiment.id}` ran `{experiment.strategy.kind.value}` from {experiment.backtest.start_date} to {experiment.backtest.end_date}.
Claim: Total return was {result.metrics.total_return:.2%}, max drawdown was {result.metrics.max_drawdown:.2%}, and turnover was {result.metrics.turnover:.1f}x.

## Hypothesis

{experiment.hypothesis or "No hypothesis recorded."}

## Assumptions

- Universe: {", ".join(experiment.strategy.universe)}
- Benchmark: {experiment.backtest.benchmark}
- Execution: {experiment.backtest.execution_timing.value}
- Cash policy: {experiment.backtest.cash_policy.value}
- Costs: {experiment.backtest.cost_model.commission_bps} bps commission, {experiment.backtest.cost_model.slippage_bps} bps slippage

## Robustness

- OOS verdict: {result.oos_analysis.verdict if result.oos_analysis else "not configured"}
- Data score: {result.data_reliability.score if result.data_reliability else "unknown"}
- Average exposure: {average_exposure}
- Credibility: {review.credibility_score if review else "unknown"}
- Decision: {review.decision if review else "unknown"}

## Regimes

{regimes}

## Risk Flags

{warnings}

## Links

- [[Open Questions]]
"""
    path.write_text(content, encoding="utf-8")
    ensure_index_link(wiki_root / "index.md", page_name)
    append_wiki_log(wiki_root / "log.md", today, experiment.name)
    return path


def wiki_page_name(name: str) -> str:
    safe = "".join(char if char.isalnum() or char in (" ", "-", "_") else "" for char in name).strip()
    return safe or "Experiment"


def ensure_index_link(index_path: Path, page_name: str) -> None:
    if not index_path.exists():
        return
    text = index_path.read_text(encoding="utf-8")
    link = f"- [[{page_name}]] - Generated experiment summary."
    if link in text:
        return
    text = text.replace("- No experiment pages yet.", link)
    if link not in text:
        text = text.replace("## Experiments\n", f"## Experiments\n\n{link}\n")
    index_path.write_text(text, encoding="utf-8")


def append_wiki_log(log_path: Path, today: str, title: str) -> None:
    if not log_path.exists():
        return
    entry = f"\n## [{today}] query | Experiment Summary: {title}\n\n- Wrote generated experiment summary page.\n- Updated wiki index.\n"
    text = log_path.read_text(encoding="utf-8")
    if entry.strip() not in text:
        log_path.write_text(text.rstrip() + "\n" + entry, encoding="utf-8")


def append_open_question(experiment: Experiment, question: str) -> Path:
    path = Path("wiki") / "questions" / "Open Questions.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    entry = f"\n## {today} | {experiment.name}\n\n- Question: {question}\n- Experiment: `{experiment.id}`\n"
    if path.exists():
        text = path.read_text(encoding="utf-8")
    else:
        text = """---
type: question
status: active
created: {today}
updated: {today}
sources: []
tags:
  - quant-lab
---

# Open Questions
""".format(today=today)
    if question not in text:
        path.write_text(text.rstrip() + "\n" + entry, encoding="utf-8")
    return path


def tear_sheet_markdown(experiment: Experiment) -> str:
    result = experiment.result
    if result is None:
        raise DomainError("Experiment has no result")
    stress = result.bootstrap_stress
    review = result.quant_review
    warnings = "\n".join(f"- {warning.severity.value}: {warning.message}" for warning in result.warnings) or "- None"
    regimes = "\n".join(
        f"- {regime.name}: return {regime.metrics.total_return:.2%}, max drawdown {regime.metrics.max_drawdown:.2%}"
        for regime in result.regime_results
    ) or "- No named regime overlap"
    stress_text = "- Not enough return history for bootstrap stress."
    if stress:
        stress_text = "\n".join([
            f"- Simulations: {stress.simulations}",
            f"- Horizon days: {stress.horizon_days}",
            f"- Terminal return p05/p50/p95: {stress.terminal_p05:.2%} / {stress.terminal_p50:.2%} / {stress.terminal_p95:.2%}",
            f"- Max drawdown p05/p50/p95: {stress.max_drawdown_p05:.2%} / {stress.max_drawdown_p50:.2%} / {stress.max_drawdown_p95:.2%}",
            f"- Loss probability: {stress.loss_probability:.2%}",
            f"- Severe drawdown probability: {stress.severe_drawdown_probability:.2%}",
        ])
    return f"""# {experiment.name} Tear Sheet

## Hypothesis

{experiment.hypothesis or "No hypothesis recorded."}

## Setup

- Strategy: {experiment.strategy.kind.value}
- Universe: {", ".join(experiment.strategy.universe)}
- Window: {experiment.backtest.start_date} to {experiment.backtest.end_date}
- Benchmark: {experiment.backtest.benchmark}
- Execution: {experiment.backtest.execution_timing.value}
- Cash policy: {experiment.backtest.cash_policy.value}
- Costs: {experiment.backtest.cost_model.commission_bps} bps commission, {experiment.backtest.cost_model.slippage_bps} bps slippage

## Performance

- Total return: {result.metrics.total_return:.2%}
- Annualized return: {result.metrics.annualized_return:.2%}
- Volatility: {result.metrics.volatility:.2%}
- Sharpe: {result.metrics.sharpe if result.metrics.sharpe is not None else "n/a"}
- Max drawdown: {result.metrics.max_drawdown:.2%}
- Turnover: {result.metrics.turnover:.1f}x

## Deterministic Review

- Decision: {review.decision if review else "unknown"}
- Credibility: {review.credibility_score if review else "unknown"}/100
- Summary: {review.summary if review else "unknown"}

## Bootstrap Stress

{stress_text}

## Regime Windows

{regimes}

## Risk Flags

{warnings}

## Data

- Data score: {result.data_reliability.score if result.data_reliability else "unknown"}
- Provenance rows: {len(result.provenance.data)}
"""
