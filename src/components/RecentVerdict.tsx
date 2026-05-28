import { CheckCircle2, Sparkles } from "lucide-react";

export function RecentVerdict() {
  return (
    <section className="cockpit-preview">
      <div className="panel">
        <div className="panel-h">
          <div>
            <h3>Recent verdict</h3>
            <p className="sub">Momentum Rotation - walk-forward check</p>
          </div>
          <span className="verdict mixed">
            <Sparkles size={15} />
            Mixed
          </span>
        </div>
        <div className="panel-b two-col">
          <div className="rule-block">
            <span className="icn when">
              <CheckCircle2 size={18} />
            </span>
            <div className="body">
              <p className="t">Passes baseline drawdown limit</p>
              <p className="s">Max DD improves 5.5 pts vs buy and hold.</p>
            </div>
            <span className="tag">risk</span>
          </div>
          <div className="rule-block">
            <span className="icn else">
              <Sparkles size={18} />
            </span>
            <div className="body">
              <p className="t">Cost edge fragile</p>
              <p className="s">Performance fades above 44 bps per rebalance.</p>
            </div>
            <span className="tag">ai</span>
          </div>
        </div>
      </div>
    </section>
  );
}
