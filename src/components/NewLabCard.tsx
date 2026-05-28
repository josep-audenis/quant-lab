import { Plus } from "lucide-react";

export function NewLabCard() {
  return (
    <button className="new-card">
      <span className="plus">
        <Plus size={22} />
      </span>
      <div className="new-copy">
        <strong>Start a new lab</strong>
        <span>Blank strategy or pick a template</span>
      </div>
    </button>
  );
}
