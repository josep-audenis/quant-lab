import { Plus } from "lucide-react";

type HeroProps = {
  onCreate: () => void;
};

export function Hero({ onCreate }: HeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Research workspace</p>
        <h1>Build, run, and archive strategy experiments.</h1>
        <p>
          Experiments import and export as JSON. Results stay tied to strategy,
          backtest assumptions, data provenance, and run metadata.
        </p>
      </div>
      <button className="btn primary lg" onClick={onCreate}>
        <Plus size={17} />
        New experiment
      </button>
    </section>
  );
}
