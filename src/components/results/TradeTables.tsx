import type { Fill } from "../../api/experiments";
import { fillReason } from "./formatters";

export function FillsTable({ fills }: { fills: Fill[] }) {
  const sorted = [...fills].sort((a, b) => b.as_of.localeCompare(a.as_of));
  const shown = sorted.slice(0, 200);
  return (
    <div className="fills-section">
      <p className="sect-label metrics-label">Trade log ({fills.length} fills)</p>
      <div className="fills-table-wrap">
        <table className="fills-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Value</th>
              <th>Commission</th>
              <th>Reason</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f, i) => (
              <tr key={i} className={f.side === "buy" ? "fill-buy" : "fill-sell"}>
                <td>{f.as_of}</td>
                <td>{f.symbol}</td>
                <td className={f.side === "buy" ? "pos" : "neg"}>{f.side.toUpperCase()}</td>
                <td>{f.quantity.toFixed(4)}</td>
                <td>${f.price.toFixed(2)}</td>
                <td>${(f.quantity * f.price).toFixed(0)}</td>
                <td>{f.commission > 0 ? `$${f.commission.toFixed(2)}` : "-"}</td>
                <td>{fillReason(f.reason, f.signal_as_of, f.execution_timing)}</td>
                <td>{f.target_weight != null ? `${(f.target_weight * 100).toFixed(1)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fills.length > 200 && (
          <p className="fills-overflow">Showing 200 of {fills.length} fills</p>
        )}
      </div>
    </div>
  );
}

// --- Warnings ----------------------------------------------------------------

