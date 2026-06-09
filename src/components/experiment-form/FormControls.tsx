import { Check } from "lucide-react";
import type { Step } from "./model";

export function Stepper({ active }: { active: Step }) {
  const steps: Array<{ id: Step | "results"; label: string }> = [
    { id: "universe", label: "Universe" },
    { id: "strategy", label: "Strategy" },
    { id: "config", label: "Backtest" },
    { id: "results", label: "Results" },
  ];
  const activeIndex = steps.findIndex((step) => step.id === active);
  return (
    <div className="stepper true-stepper">
      {steps.map((item, index) => (
        <div className="step-wrap" key={item.id}>
          <div className={`step ${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}`}>
            <span className="num">{index < activeIndex ? <Check size={13} /> : index + 1}</span>
            <span className="nm">{item.label}</span>
          </div>
          {index < steps.length - 1 ? <div className={`step-line ${index < activeIndex ? "done" : ""}`} /> : null}
        </div>
      ))}
    </div>
  );
}

export function RangeField({
  label,
  max,
  onChange,
  step,
  unit,
  value,
}: {
  label: string;
  max: number;
  onChange: (value: number) => void;
  step: number;
  unit: string;
  value: number;
}) {
  return (
    <div className="field">
      <label>{label} <span className="muted mono">{value} {unit}</span></label>
      <input max={max} min={0} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </div>
  );
}

