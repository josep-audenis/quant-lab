import { ChevronRight } from "lucide-react";
import type { Lab } from "../data/labs";
import { Sparkline } from "./Sparkline";

type LabCardProps = {
  lab: Lab;
};

export function LabCard({ lab }: LabCardProps) {
  return (
    <article className="lab-card">
      <div className="card-head">
        <div>
          <h2 className="q">{lab.name}</h2>
          <div className="meta">
            <span className={`badge ${lab.tone}`}>{lab.badge}</span>
            {lab.meta}
          </div>
        </div>
        <ChevronRight size={18} />
      </div>
      <Sparkline path={lab.path} />
      <div className="row">
        {lab.stats.map(([label, value, tone]) => (
          <div className="stat" key={label}>
            <span className="lab">{label}</span>
            <span className={`val ${tone}`}>{value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
