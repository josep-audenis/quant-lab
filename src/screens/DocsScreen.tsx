import { BookOpen, CheckCircle2, FileText, GitBranch, LineChart, ShieldCheck, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";

const featureRows = [
  ["Experiment cockpit", "Create, import, run, save, compare, and export local strategy experiments."],
  ["Strategy templates", "Buy and Hold, Moving Average Filter, Momentum Rotation, plus executable block editing."],
  ["Backtest engine", "Target-weight interpreter, rebalance simulation, costs, slippage, fills, equity, drawdown, benchmark curve."],
  ["Diagnostics", "OOS split, rolling metrics, regimes, data reliability, provenance, quant review, bootstrap stress."],
  ["Robustness Lab", "Cost sensitivity, start-date sensitivity, parameter sensitivity, and fragility verdict."],
  ["Research exports", "JSON export, Markdown tear sheet, wiki experiment summary, and open-question capture."],
];

const workflowRows = [
  ["1", "Define hypothesis", "Name the question, universe, benchmark, date window, cash policy, and costs."],
  ["2", "Run deterministic backtest", "Backend fetches cached market data, executes strategy blocks, and stores result."],
  ["3", "Inspect risk", "Review drawdowns, fills, warnings, data reliability, regimes, and bootstrap stress."],
  ["4", "Stress assumptions", "Use sweeps and Robustness Lab before treating any strategy as credible."],
  ["5", "Export research", "Save JSON, tear sheet, wiki summary, or open question for next review."],
];

const limits = [
  "Local-first app: no auth, multi-user storage, or hosted deployment model.",
  "Market data uses yfinance cache, so data-quality and survivorship limits remain visible assumptions.",
  "Execution model excludes taxes, borrow fees, liquidity constraints, partial fills, and broker routing.",
  "Custom rules are editable as blocks, but natural-language strategy creation is not productized.",
  "Memo export is Markdown, not polished PDF/share page.",
];

export function DocsScreen() {
  return (
    <div className="wrap docs-wrap">
      <section className="docs-hero">
        <div>
          <p className="eyebrow">Project docs</p>
          <h1>Quant Lab reviewer guide</h1>
          <p>
            Local-first quant research cockpit for testing strategy hypotheses, exposing fragile assumptions, and producing
            auditable research artifacts.
          </p>
        </div>
        <div className="docs-score">
          <span>Portfolio state</span>
          <strong>Ready for refinement</strong>
          <small>Core flow, robustness, docs, and verification are in place.</small>
        </div>
      </section>

      <section className="docs-grid">
        <DocCard icon={<LineChart size={18} />} title="What to review first">
          <ol className="docs-steps">
            <li>Open or create an experiment.</li>
            <li>Run backtest and inspect Results.</li>
            <li>Open Robustness and run sensitivity checks.</li>
            <li>Export tear sheet or write wiki summary.</li>
          </ol>
        </DocCard>

        <DocCard icon={<ShieldCheck size={18} />} title="Product stance">
          <p>
            Quant Lab is not a predictor, bot, or broker. It keeps calculations deterministic and makes uncertainty,
            overfitting risk, data gaps, transaction costs, and regime dependence visible.
          </p>
        </DocCard>

        <DocCard icon={<TerminalSquare size={18} />} title="Verification">
          <pre>{`python -m pytest
pnpm.cmd build
pnpm.cmd smoke:frontend`}</pre>
        </DocCard>
      </section>

      <section className="docs-section">
        <div className="docs-section-head">
          <BookOpen size={18} />
          <div>
            <p className="sect-label metrics-label">Feature map</p>
            <h2>What exists now</h2>
          </div>
        </div>
        <div className="docs-table">
          {featureRows.map(([area, detail]) => (
            <div className="docs-row" key={area}>
              <strong>{area}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-head">
          <GitBranch size={18} />
          <div>
            <p className="sect-label metrics-label">Runtime shape</p>
            <h2>Architecture</h2>
          </div>
        </div>
        <div className="architecture-flow">
          {["React UI", "API client", "FastAPI", "JSON store", "Market cache", "Backtest engine", "Robustness + exports"].map((item) => (
            <div className="arch-node" key={item}>{item}</div>
          ))}
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-head">
          <CheckCircle2 size={18} />
          <div>
            <p className="sect-label metrics-label">Research workflow</p>
            <h2>End-to-end path</h2>
          </div>
        </div>
        <div className="workflow-list">
          {workflowRows.map(([step, title, detail]) => (
            <div className="workflow-item" key={step}>
              <span>{step}</span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="docs-section">
        <div className="docs-section-head">
          <FileText size={18} />
          <div>
            <p className="sect-label metrics-label">Honest limits</p>
            <h2>Known boundaries</h2>
          </div>
        </div>
        <ul className="limit-list">
          {limits.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}

function DocCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="doc-card">
      <div className="doc-card-title">
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
}
