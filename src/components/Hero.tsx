import { Plus } from "lucide-react";

export function Hero() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Research labs</p>
        <h1>Test an investment thesis before you bet on it.</h1>
        <p>
          Define a universe, codify a rule, and run it across 30+ years of market
          history - then let the Quant Assistant try to talk you out of it.
        </p>
      </div>
      <button className="btn primary lg">
        <Plus size={17} />
        New backtest
      </button>
    </section>
  );
}
