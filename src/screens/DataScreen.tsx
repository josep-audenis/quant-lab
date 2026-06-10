import { Database, Server, ShieldAlert } from "lucide-react";

export function DataScreen() {
  return (
    <div className="wrap docs-wrap">
      <section className="docs-hero compact">
        <div>
          <p className="eyebrow">Data</p>
          <h1>Local data layer</h1>
          <p>
            Experiments and market data live on disk. This tab documents current storage behavior until a richer data
            browser is needed.
          </p>
        </div>
      </section>
      <section className="docs-grid">
        <article className="doc-card">
          <div className="doc-card-title">
            <span><Database size={18} /></span>
            <h2>Experiment store</h2>
          </div>
          <p>`data/experiments/` stores one JSON file per experiment.</p>
        </article>
        <article className="doc-card">
          <div className="doc-card-title">
            <span><Server size={18} /></span>
            <h2>Market cache</h2>
          </div>
          <p>`data/market_cache/` stores yfinance OHLCV responses by symbol and date range.</p>
        </article>
        <article className="doc-card">
          <div className="doc-card-title">
            <span><ShieldAlert size={18} /></span>
            <h2>Assumptions</h2>
          </div>
          <p>Data quality, adjustment, cache age, and missing bars are reported inside completed backtest results.</p>
        </article>
      </section>
    </div>
  );
}
