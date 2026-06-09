import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Coins,
  GitBranch,
  PieChart,
  Plus,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";

export type Block = Record<string, unknown>;
type BlockType = "indicator" | "condition" | "allocation";
type Action = Record<string, unknown>;

type RuleBuilderProps = {
  universe: string[];
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
};

const OPERATORS: Array<{ value: string; label: string }> = [
  { value: ">", label: "is above" },
  { value: ">=", label: "is at or above" },
  { value: "<", label: "is below" },
  { value: "<=", label: "is at or below" },
];

export function RuleBuilder({ universe, blocks, onChange }: RuleBuilderProps) {
  const [adding, setAdding] = useState(false);

  function patchBlock(index: number, patch: Block) {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addBlock(type: BlockType) {
    const ids = new Set(blocks.map((block) => String(block.id)));
    onChange([...blocks, defaultBlock(type, universe, ids)]);
    setAdding(false);
  }

  return (
    <div className="rule-builder">
      {blocks.length === 0 ? (
        <div className="builder-empty">
          <GitBranch size={22} />
          <p>No rules yet. Add an indicator, a condition, or a target allocation to define how the strategy trades.</p>
        </div>
      ) : (
        <div className="builder-flow">
          {blocks.map((block, index) => (
            <div className="builder-step" key={String(block.id)}>
              <BlockCard
                block={block}
                canMoveDown={index < blocks.length - 1}
                canMoveUp={index > 0}
                index={index}
                priorIndicators={priorIndicators(blocks, index)}
                universe={universe}
                onChange={(patch) => patchBlock(index, patch)}
                onMove={(direction) => moveBlock(index, direction)}
                onRemove={() => removeBlock(index)}
              />
              {index < blocks.length - 1 ? <div className="builder-link" /> : null}
            </div>
          ))}
        </div>
      )}

      <div className="builder-add">
        {adding ? (
          <div className="add-menu">
            <button className="add-opt" onClick={() => addBlock("indicator")} type="button">
              <span className="icn ind"><TrendingUp size={16} /></span>
              <span><strong>Indicator</strong><small>Moving average or momentum signal</small></span>
            </button>
            <button className="add-opt" onClick={() => addBlock("condition")} type="button">
              <span className="icn cond"><GitBranch size={16} /></span>
              <span><strong>Condition</strong><small>If / then / else branching logic</small></span>
            </button>
            <button className="add-opt" onClick={() => addBlock("allocation")} type="button">
              <span className="icn alloc"><PieChart size={16} /></span>
              <span><strong>Allocation</strong><small>Fixed target weights</small></span>
            </button>
            <button className="add-cancel" onClick={() => setAdding(false)} type="button">Cancel</button>
          </div>
        ) : (
          <button className="add-trigger" onClick={() => setAdding(true)} type="button">
            <Plus size={16} /> Add rule block
          </button>
        )}
      </div>
    </div>
  );
}

function BlockCard({
  block,
  canMoveDown,
  canMoveUp,
  index,
  onChange,
  onMove,
  onRemove,
  priorIndicators,
  universe,
}: {
  block: Block;
  canMoveDown: boolean;
  canMoveUp: boolean;
  index: number;
  onChange: (patch: Block) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  priorIndicators: Block[];
  universe: string[];
}) {
  const type = String(block.type) as BlockType;
  const meta = BLOCK_META[type] ?? BLOCK_META.allocation;

  return (
    <article className={`builder-node ${type}`}>
      <div className="node-rail">
        <span className={`node-badge ${type}`}>{meta.icon}</span>
        <span className="node-step">{index + 1}</span>
      </div>
      <div className="node-main">
        <header className="node-head">
          <span className="node-kind">{meta.label}</span>
          <div className="node-tools">
            <button disabled={!canMoveUp} onClick={() => onMove(-1)} title="Move up" type="button">
              <ArrowUp size={14} />
            </button>
            <button disabled={!canMoveDown} onClick={() => onMove(1)} title="Move down" type="button">
              <ArrowDown size={14} />
            </button>
            <button className="del" onClick={onRemove} title="Remove block" type="button">
              <Trash2 size={14} />
            </button>
          </div>
        </header>
        {type === "indicator" ? (
          <IndicatorBody block={block} onChange={onChange} universe={universe} />
        ) : type === "condition" ? (
          <ConditionBody block={block} onChange={onChange} priorIndicators={priorIndicators} universe={universe} />
        ) : (
          <AllocationBody block={block} onChange={onChange} universe={universe} />
        )}
      </div>
    </article>
  );
}

function IndicatorBody({ block, onChange, universe }: { block: Block; onChange: (patch: Block) => void; universe: string[] }) {
  const indicator = String(block.indicator ?? "moving_average");
  const symbols = Array.isArray(block.symbols) ? (block.symbols as string[]) : [];

  return (
    <div className="node-stack">
      <div className="rule-line">
        <span className="lead">Compute</span>
        <select
          className="pill-select"
          value={indicator}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "moving_average") {
              onChange({ indicator: next, symbol: universe[0] ?? "SPY", window: 200, price: "close", symbols: undefined, lookback_months: undefined });
            } else {
              onChange({ indicator: next, symbols: universe, lookback_months: 12, symbol: undefined, window: undefined, price: undefined });
            }
          }}
        >
          <option value="moving_average">moving average</option>
          <option value="momentum_return">momentum return</option>
        </select>
      </div>
      {indicator === "moving_average" ? (
        <div className="rule-line line-wrap">
          <span className="lead">of</span>
          <select className="pill-select" value={String(block.symbol ?? universe[0] ?? "")} onChange={(event) => onChange({ symbol: event.target.value })}>
            {universe.map((symbol) => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          <span className="lead">over</span>
          <input
            className="num-input"
            min={1}
            onChange={(event) => onChange({ window: Number(event.target.value) })}
            type="number"
            value={Number(block.window ?? 200)}
          />
          <span className="lead">days</span>
        </div>
      ) : (
        <>
          <div className="sym-toggles">
            {universe.map((symbol) => {
              const on = symbols.includes(symbol);
              return (
                <button
                  className={`sym-chip ${on ? "on" : ""}`}
                  key={symbol}
                  onClick={() => onChange({ symbols: on ? symbols.filter((item) => item !== symbol) : [...symbols, symbol] })}
                  type="button"
                >
                  {on ? <Check size={12} /> : null}{symbol}
                </button>
              );
            })}
          </div>
          <div className="rule-line">
            <span className="lead">trailing</span>
            <input
              className="num-input"
              min={1}
              onChange={(event) => onChange({ lookback_months: Number(event.target.value) })}
              type="number"
              value={Number(block.lookback_months ?? 12)}
            />
            <span className="lead">months</span>
          </div>
        </>
      )}
      <p className="node-ref">Reference: <code>{String(block.id)}</code></p>
    </div>
  );
}

function ConditionBody({
  block,
  onChange,
  priorIndicators,
  universe,
}: {
  block: Block;
  onChange: (patch: Block) => void;
  priorIndicators: Block[];
  universe: string[];
}) {
  const condition = (block.if as { left?: { ref?: string }; operator?: string; right?: { ref?: string } }) ?? {};
  const refs = availableRefs(universe, priorIndicators);
  const thenActions = Array.isArray(block.then) ? (block.then as Action[]) : [];
  const elseActions = Array.isArray(block.else) ? (block.else as Action[]) : [];

  return (
    <div className="node-stack">
      <div className="cond-sentence">
        <span className="tag when"><Zap size={12} /> If</span>
        <RefSelect options={refs} value={condition.left?.ref ?? ""} onChange={(ref) => onChange({ if: { ...condition, left: { ref } } })} />
        <select
          className="op-select"
          value={condition.operator ?? ">"}
          onChange={(event) => onChange({ if: { ...condition, operator: event.target.value } })}
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
        <RefSelect options={refs} value={condition.right?.ref ?? ""} onChange={(ref) => onChange({ if: { ...condition, right: { ref } } })} />
      </div>

      <Branch
        actions={thenActions}
        kind="then"
        universe={universe}
        onChange={(actions) => onChange({ then: actions })}
      />
      <Branch
        actions={elseActions}
        kind="else"
        universe={universe}
        onChange={(actions) => onChange({ else: actions })}
      />
    </div>
  );
}

function Branch({
  actions,
  kind,
  onChange,
  universe,
}: {
  actions: Action[];
  kind: "then" | "else";
  onChange: (actions: Action[]) => void;
  universe: string[];
}) {
  function patch(index: number, next: Action) {
    onChange(actions.map((action, i) => (i === index ? next : action)));
  }
  return (
    <div className={`branch ${kind}`}>
      <span className={`tag ${kind}`}>
        {kind === "then" ? <><ArrowRight size={12} /> Then</> : <><Check size={12} /> Otherwise</>}
      </span>
      <div className="branch-actions">
        {actions.map((action, index) => (
          <div className="action-row" key={index}>
            <select
              className="pill-select"
              value={String(action.action ?? "set_weight")}
              onChange={(event) =>
                patch(index, event.target.value === "set_cash"
                  ? { action: "set_cash", weight: Number(action.weight ?? 1) }
                  : { action: "set_weight", symbol: universe[0] ?? "", weight: Number(action.weight ?? 1) })
              }
            >
              <option value="set_weight">hold</option>
              <option value="set_cash">go to cash</option>
            </select>
            {String(action.action) === "set_cash" ? null : (
              <select className="pill-select" value={String(action.symbol ?? universe[0] ?? "")} onChange={(event) => patch(index, { ...action, symbol: event.target.value })}>
                {universe.map((symbol) => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            )}
            <span className="lead">at</span>
            <input
              className="num-input"
              max={1}
              min={0}
              onChange={(event) => patch(index, { ...action, weight: Number(event.target.value) })}
              step={0.05}
              type="number"
              value={Number(action.weight ?? 1)}
            />
            <span className="lead">weight</span>
            {actions.length > 1 ? (
              <button className="row-del" onClick={() => onChange(actions.filter((_, i) => i !== index))} title="Remove action" type="button">
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        ))}
        <button
          className="action-add"
          onClick={() => onChange([...actions, { action: "set_weight", symbol: universe[0] ?? "", weight: 0 }])}
          type="button"
        >
          <Plus size={13} /> Add action
        </button>
      </div>
    </div>
  );
}

function AllocationBody({ block, onChange, universe }: { block: Block; onChange: (patch: Block) => void; universe: string[] }) {
  const weights = (block.weights as Record<string, number>) ?? {};
  const total = universe.reduce((sum, symbol) => sum + Number(weights[symbol] ?? 0), 0);
  const over = total > 1.0000001;

  return (
    <div className="node-stack">
      <div className="alloc-grid">
        {universe.map((symbol) => (
          <label className="alloc-row" key={symbol}>
            <span className="alloc-sym">{symbol}</span>
            <input
              max={1}
              min={0}
              onChange={(event) => onChange({ weights: { ...weights, [symbol]: Number(event.target.value) } })}
              step={0.05}
              type="range"
              value={Number(weights[symbol] ?? 0)}
            />
            <input
              className="num-input"
              max={1}
              min={0}
              onChange={(event) => onChange({ weights: { ...weights, [symbol]: Number(event.target.value) } })}
              step={0.05}
              type="number"
              value={Number(weights[symbol] ?? 0)}
            />
          </label>
        ))}
      </div>
      <div className={`weight-total ${over ? "over" : ""}`}>
        <span>Total allocated</span>
        <strong>{(total * 100).toFixed(0)}%</strong>
        <span className="rest">{over ? "exceeds 100%" : `${((1 - total) * 100).toFixed(0)}% cash`}</span>
      </div>
    </div>
  );
}

function RefSelect({ options, onChange, value }: { options: Array<{ value: string; label: string }>; onChange: (value: string) => void; value: string }) {
  return (
    <select className="ref-select" value={value} onChange={(event) => onChange(event.target.value)}>
      <option disabled value="">choose…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

const BLOCK_META: Record<BlockType, { label: string; icon: JSX.Element }> = {
  indicator: { label: "Indicator", icon: <TrendingUp size={15} /> },
  condition: { label: "Condition", icon: <GitBranch size={15} /> },
  allocation: { label: "Allocation", icon: <Coins size={15} /> },
};

function priorIndicators(blocks: Block[], index: number): Block[] {
  return blocks.slice(0, index).filter((block) => block.type === "indicator");
}

function availableRefs(universe: string[], indicators: Block[]): Array<{ value: string; label: string }> {
  const priceRefs = universe.map((symbol) => ({ value: `${symbol}.close`, label: `${symbol} close` }));
  const indicatorRefs = indicators.map((block) => ({ value: String(block.id), label: describeIndicator(block) }));
  return [...priceRefs, ...indicatorRefs];
}

function describeIndicator(block: Block): string {
  if (block.indicator === "moving_average") {
    return `${block.symbol} ${block.window}-day MA`;
  }
  return `${block.lookback_months}-mo momentum`;
}

function defaultBlock(type: BlockType, universe: string[], existingIds: Set<string>): Block {
  const first = universe[0] ?? "SPY";
  if (type === "indicator") {
    return { id: uniqueId("ma", existingIds), type: "indicator", indicator: "moving_average", symbol: first, window: 200, price: "close" };
  }
  if (type === "condition") {
    return {
      id: uniqueId("rule", existingIds),
      type: "condition",
      if: { left: { ref: `${first}.close` }, operator: ">", right: { ref: `${first}.close` } },
      then: [{ action: "set_weight", symbol: first, weight: 1 }],
      else: [{ action: "set_cash", weight: 1 }],
    };
  }
  return {
    id: uniqueId("allocation", existingIds),
    type: "allocation",
    weights: { [first]: 1 },
  };
}

function uniqueId(prefix: string, existing: Set<string>): string {
  let n = 1;
  let candidate = `${prefix}_${n}`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `${prefix}_${n}`;
  }
  return candidate;
}
