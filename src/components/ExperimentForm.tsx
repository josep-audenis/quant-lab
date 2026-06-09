import { ArrowLeft, ArrowRight, Check, Info, Play, Plus, Search, Sparkles, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DraftExperimentPayload, ExperimentSummary } from "../api/experiments";
import { RuleBuilder, type Block } from "./RuleBuilder";

type ExperimentFormMode = "create" | "edit";
type Step = "universe" | "strategy" | "config";
type PresetId = "single" | "sectors" | "macro";
type TemplateId = "ma-timing" | "momentum" | "custom";

type ExperimentFormProps = {
  experiment: ExperimentSummary | null;
  mode: ExperimentFormMode;
  onCancel: () => void;
  onSubmit: (payload: DraftExperimentPayload) => void;
  onSubmitCustom: (experiment: ExperimentSummary) => void;
};

const tickers = [
  { t: "SPY", n: "SPDR S&P 500 ETF", cls: "US Equity", cagr: 0.099 },
  { t: "QQQ", n: "Invesco Nasdaq-100", cls: "US Tech", cagr: 0.134 },
  { t: "IWM", n: "iShares Russell 2000", cls: "US Small Cap", cagr: 0.082 },
  { t: "EFA", n: "iShares MSCI EAFE", cls: "Dev. ex-US", cagr: 0.051 },
  { t: "EEM", n: "iShares MSCI EM", cls: "Emerging Mkts", cagr: 0.044 },
  { t: "TLT", n: "iShares 20+ Yr Treasury", cls: "Long Bonds", cagr: 0.038 },
  { t: "GLD", n: "SPDR Gold Shares", cls: "Commodity", cagr: 0.072 },
  { t: "XLK", n: "Tech Select Sector", cls: "Sector", cagr: 0.128 },
  { t: "XLE", n: "Energy Select Sector", cls: "Sector", cagr: 0.061 },
  { t: "XLF", n: "Financials Select Sector", cls: "Sector", cagr: 0.067 },
];

const presets: Array<{ id: PresetId; nm: string; ds: string; set: string[] }> = [
  { id: "single", nm: "Single ticker", ds: "Just SPY - classic test", set: ["SPY"] },
  { id: "sectors", nm: "Sector ETFs", ds: "US sector rotation basket", set: ["XLK", "XLF", "XLE"] },
  { id: "macro", nm: "Macro mix", ds: "Equity, bonds, gold, cash proxy", set: ["SPY", "TLT", "GLD"] },
];

const templates: Array<{ id: TemplateId; nm: string; ds: string }> = [
  { id: "ma-timing", nm: "Trend timing", ds: "Hold when above moving average" },
  { id: "momentum", nm: "Cross-sectional momentum", ds: "Rotate into recent winners" },
  { id: "custom", nm: "Custom rules", ds: "Build your own block logic" },
];

const emptyPayload: DraftExperimentPayload = {
  name: "",
  hypothesis: "",
  universe: "SPY",
  strategy_kind: "moving_average_filter",
  ma_window: 200,
  lookback_months: 12,
  top_n: 1,
  start_date: "1993-01-01",
  end_date: "2025-12-31",
  initial_capital: 10000,
  benchmark: "SPY",
  frequency: "daily",
  rebalance_frequency: "daily",
  commission_bps: 1,
  slippage_bps: 2,
  min_commission: 0,
  cash_policy: "risk_free_proxy",
  risk_free_rate: 0.02,
  notes: "",
  use_adjusted: true,
  oos_start_date: "",
  execution_timing: "next_open",
};

export function experimentToForm(experiment: ExperimentSummary | null): DraftExperimentPayload {
  if (!experiment) {
    return emptyPayload;
  }

  const parameters = experiment.strategy.parameters;
  return {
    name: experiment.name,
    hypothesis: experiment.hypothesis ?? "",
    universe: experiment.strategy.universe.join(", "),
    strategy_kind: experiment.strategy.kind,
    ma_window: Number(parameters.window ?? 200),
    lookback_months: Number(parameters.lookback_months ?? 12),
    top_n: Number(parameters.top_n ?? 1),
    start_date: experiment.backtest.start_date,
    end_date: experiment.backtest.end_date,
    initial_capital: experiment.backtest.initial_capital,
    benchmark: experiment.backtest.benchmark,
    frequency: experiment.backtest.frequency,
    rebalance_frequency: experiment.backtest.rebalance_frequency,
    commission_bps: experiment.backtest.cost_model.commission_bps,
    slippage_bps: experiment.backtest.cost_model.slippage_bps,
    min_commission: experiment.backtest.cost_model.min_commission,
    cash_policy: experiment.backtest.cash_policy,
    risk_free_rate: experiment.backtest.risk_free_rate,
    notes: experiment.notes ?? "",
    use_adjusted: experiment.backtest.use_adjusted ?? true,
    oos_start_date: experiment.backtest.oos_start_date ?? "",
    execution_timing: experiment.backtest.execution_timing ?? "same_close",
  };
}

export function ExperimentForm({ experiment, mode, onCancel, onSubmit, onSubmitCustom }: ExperimentFormProps) {
  const initial = experimentToForm(experiment);
  const [step, setStep] = useState<Step>("universe");
  const [universe, setUniverse] = useState(() => splitSymbols(initial.universe));
  const [preset, setPreset] = useState<PresetId | null>("single");
  const [template, setTemplate] = useState<TemplateId>(
    initial.strategy_kind === "momentum_rotation" ? "momentum" : "ma-timing",
  );
  const [condition, setCondition] = useState<"closes below" | "closes above">("closes below");
  const [maWindow, setMaWindow] = useState(initial.ma_window);
  const [action, setAction] = useState("cash");
  const [capital, setCapital] = useState(initial.initial_capital);
  const [rebalance, setRebalance] = useState("Daily signal");
  const [benchmark, setBenchmark] = useState("SPY buy & hold");
  const [commission, setCommission] = useState(initial.commission_bps);
  const [slippage, setSlippage] = useState(initial.slippage_bps);
  const [cashYield, setCashYield] = useState(initial.risk_free_rate * 100);
  const [cashPolicy, setCashPolicy] = useState(initial.cash_policy);
  const [executionTiming, setExecutionTiming] = useState(initial.execution_timing);
  const [useAdjusted, setUseAdjusted] = useState(initial.use_adjusted);
  const [oosStartDate, setOosStartDate] = useState(initial.oos_start_date);
  const [query, setQuery] = useState("");
  const [customBlocks, setCustomBlocks] = useState<Block[]>(() => seedCustomBlocks(splitSymbols(initial.universe)));

  const selectedRows = universe.map((symbol) => tickers.find((ticker) => ticker.t === symbol) ?? fallbackTicker(symbol));
  const searchResults = useMemo(() => {
    const q = query.trim().toUpperCase();
    return tickers
      .filter((ticker) => !universe.includes(ticker.t))
      .filter((ticker) => q === "" || ticker.t.includes(q) || ticker.n.toUpperCase().includes(q))
      .slice(0, 6);
  }, [query, universe]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (template === "custom") {
      onSubmitCustom(toCustomExperiment());
      return;
    }
    onSubmit(toPayload());
  }

  function toCustomExperiment(): ExperimentSummary {
    const now = new Date().toISOString();
    const benchmarkSymbol = benchmark === "Cash" ? "BIL" : "SPY";
    const rebalanceFreq = rebalance === "Weekly" ? "weekly" : rebalance === "Monthly" ? "monthly" : "daily";
    return {
      id: `exp_${Math.random().toString(16).slice(2, 14)}`,
      name: `Custom rules: ${universe.join(", ")}`,
      status: "draft",
      hypothesis: "Custom block logic tested against the chosen benchmark after trading frictions.",
      notes: "Authored with the visual rule builder.",
      backtest: {
        start_date: initial.start_date,
        end_date: initial.end_date,
        initial_capital: capital,
        benchmark: benchmarkSymbol,
        frequency: "daily",
        rebalance_frequency: rebalanceFreq,
        cost_model: { commission_bps: commission, slippage_bps: slippage, min_commission: 0 },
        cash_policy: cashPolicy,
        risk_free_rate: cashYield / 100,
        use_adjusted: useAdjusted,
        oos_start_date: oosStartDate || null,
        execution_timing: executionTiming,
      },
      created_at: now,
      updated_at: now,
      strategy: {
        kind: "custom_rules",
        universe,
        parameters: {},
        rules: [],
      },
      strategy_program: {
        version: 1,
        universe,
        blocks: customBlocks,
      },
    };
  }

  function toPayload(): DraftExperimentPayload {
    const strategyKind = template === "momentum" ? "momentum_rotation" : "moving_average_filter";
    const first = universe[0] ?? "SPY";
    const hypothesis =
      template === "momentum"
        ? "Recent winners continue outperforming across the selected universe after trading frictions."
        : `${first} avoids major drawdowns when price ${condition} its ${maWindow}-day simple moving average.`;

    return {
      ...emptyPayload,
      name:
        template === "momentum"
          ? `Momentum rotation: ${universe.join(", ")}`
          : `${first} ${maWindow}-day trend filter`,
      hypothesis,
      universe: universe.join(", "),
      strategy_kind: strategyKind,
      ma_window: maWindow,
      lookback_months: 12,
      top_n: Math.min(2, Math.max(1, universe.length)),
      initial_capital: capital,
      benchmark: benchmark === "Cash" ? "BIL" : "SPY",
      rebalance_frequency: rebalance === "Weekly" ? "weekly" : rebalance === "Monthly" ? "monthly" : "daily",
      commission_bps: commission,
      slippage_bps: slippage,
      cash_policy: cashPolicy,
      risk_free_rate: cashYield / 100,
      use_adjusted: useAdjusted,
      oos_start_date: oosStartDate,
      execution_timing: executionTiming,
      notes: `Template: ${template}. Out-of-market action: ${action}. Benchmark view: ${benchmark}.`,
    };
  }

  function addSymbol(symbol: string) {
    setUniverse((current) => (current.includes(symbol) ? current : [...current, symbol]));
    setPreset(null);
    setQuery("");
  }

  function removeSymbol(symbol: string) {
    setUniverse((current) => current.filter((item) => item !== symbol));
    setPreset(null);
  }

  return (
    <form className="experiment-form wizard-form" onSubmit={submit}>
      <header className="form-head compact">
        <div>
          <p className="eyebrow">{mode === "create" ? "New backtest" : "Edit backtest"}</p>
          <h2>{titleForStep(step)}</h2>
        </div>
        <button className="iconbtn" onClick={onCancel} title="Close" type="button">
          <X size={17} />
        </button>
      </header>

      <Stepper active={step} />

      {step === "universe" ? (
        <section className="wizard-page">
          <div className="wizard-head">
            <p className="eyebrow">Step 1 - Universe</p>
            <h2>What can strategy trade?</h2>
            <p>Pick instruments rules can hold. For classic 200-day test, single index ETF is enough.</p>
          </div>

          <div className="universe-grid">
            <div>
              <p className="sect-label block-label">Quick presets</p>
              <div className="preset-grid vertical">
                {presets.map((item) => (
                  <button
                    className={`preset ${preset === item.id ? "sel" : ""}`}
                    key={item.id}
                    onClick={() => {
                      setPreset(item.id);
                      setUniverse(item.set);
                    }}
                    type="button"
                  >
                    <span className="nm">{item.nm}</span>
                    <span className="ds">{item.ds}</span>
                  </button>
                ))}
              </div>

              <div className="divider" />
              <p className="sect-label block-label">Or add tickers</p>
              <div className="search">
                <Search size={16} />
                <input
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search SPY, QQQ, TLT..."
                  value={query}
                />
              </div>
              <div className="ticker-results">
                {searchResults.map((ticker) => (
                  <button className="preset ticker-hit" key={ticker.t} onClick={() => addSymbol(ticker.t)} type="button">
                    <span>
                      <strong className="tkr">{ticker.t}</strong> <span className="tkr-name">{ticker.n}</span>
                    </span>
                    <span className="muted mono">{pct(ticker.cagr)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-h split">
                <h3>Selected universe</h3>
                <span className="pill">{universe.length} instrument{universe.length === 1 ? "" : "s"}</span>
              </div>
              <div className="chip-row">
                {universe.map((symbol) => (
                  <span className="chip" key={symbol}>
                    {symbol}
                    <button onClick={() => removeSymbol(symbol)} type="button">x</button>
                  </span>
                ))}
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>Ticker</th><th>Class</th><th className="r">Hist. CAGR</th></tr>
                </thead>
                <tbody>
                  {selectedRows.map((ticker) => (
                    <tr key={ticker.t}>
                      <td><span className="tkr">{ticker.t}</span> <span className="tkr-name">{ticker.n}</span></td>
                      <td className="muted">{ticker.cls}</td>
                      <td className="r">{pct(ticker.cagr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {step === "strategy" ? (
        <section className="wizard-page">
          <div className="wizard-head">
            <p className="eyebrow">Step 2 - Strategy</p>
            <h2>Codify rule.</h2>
            <p>Strategy is if-this-then-that logic on selected universe. Timing rule starts skeptical and explicit.</p>
          </div>

          <p className="sect-label block-label">Template</p>
          <div className="template-row">
            {templates.map((item) => (
              <button
                className={`template ${template === item.id ? "sel" : ""}`}
                key={item.id}
                onClick={() => setTemplate(item.id)}
                type="button"
              >
                <span className="nm">{item.nm}</span>
                <span className="ds">{item.ds}</span>
              </button>
            ))}
          </div>

          {template === "ma-timing" ? (
            <div className="panel">
              <div className="panel-h"><h3>Rule logic</h3><span className="sub">Applied to {universe.join(", ")}</span></div>
              <div className="panel-b">
                <div className="rule-flow">
                  <div className="rule-block">
                    <span className="icn when"><Zap size={17} /></span>
                    <div className="body">
                      <span className="tag">When</span>
                      <div className="t rule-sentence">
                        {universe[0] ?? "SPY"} closing price
                        <span className="inline-field">
                          <select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}>
                            <option>closes below</option>
                            <option>closes above</option>
                          </select>
                        </span>
                        its
                        <span className="inline-field">
                          <select value={maWindow} onChange={(event) => setMaWindow(Number(event.target.value))}>
                            {[50, 100, 150, 200, 250].map((window) => <option key={window} value={window}>{window}-day</option>)}
                          </select>
                        </span>
                        simple moving average
                      </div>
                      <div className="s">Signal uses prior close to avoid look-ahead bias.</div>
                    </div>
                  </div>
                  <div className="rule-connector" />
                  <div className="rule-block">
                    <span className="icn then"><ArrowRight size={17} /></span>
                    <div className="body">
                      <span className="tag">Then</span>
                      <div className="t rule-sentence">
                        Move 100% to
                        <span className="inline-field">
                          <select value={action} onChange={(event) => setAction(event.target.value)}>
                            <option>cash</option>
                            <option>TLT (bonds)</option>
                            <option>GLD (gold)</option>
                          </select>
                        </span>
                        at next open
                      </div>
                      <div className="s">Earn configured cash yield while out of equities.</div>
                    </div>
                  </div>
                  <div className="rule-connector" />
                  <div className="rule-block">
                    <span className="icn else"><Check size={17} /></span>
                    <div className="body">
                      <span className="tag">Otherwise</span>
                      <div className="t">Hold 100% {universe[0] ?? "SPY"}</div>
                      <div className="s">Fully invested whenever price is above average.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : template === "momentum" ? (
            <div className="panel">
              <div className="panel-h"><h3>Rule logic</h3><span className="sub">Applied monthly to {universe.join(", ")}</span></div>
              <div className="panel-b">
                <div className="rule-flow">
                  <div className="rule-block">
                    <span className="icn when"><Zap size={17} /></span>
                    <div className="body">
                      <span className="tag">When</span>
                      <div className="t">Rank universe by trailing 12-month total return</div>
                      <div className="s">Ranking excludes current month to reduce look-ahead risk.</div>
                    </div>
                  </div>
                  <div className="rule-connector" />
                  <div className="rule-block">
                    <span className="icn then"><ArrowRight size={17} /></span>
                    <div className="body">
                      <span className="tag">Then</span>
                      <div className="t">Hold top {Math.min(2, Math.max(1, universe.length))} instruments equal-weight</div>
                      <div className="s">Rebalance using configured frequency and costs.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-h split">
                <h3>Custom rule logic</h3>
                <span className="sub">Applied to {universe.join(", ")}</span>
              </div>
              <div className="panel-b">
                <RuleBuilder blocks={customBlocks} universe={universe} onChange={setCustomBlocks} />
              </div>
            </div>
          )}

          {template === "custom" ? (
            <div className="panel info-panel">
              <Sparkles size={18} />
              <p><strong>Free-form builder:</strong> chain indicators, branch on conditions, and set target weights. The compiled program is validated when you run the backtest.</p>
            </div>
          ) : (
            <div className="panel info-panel">
              <Info size={18} />
              <p><strong>Why this rule matters:</strong> it may not beat buy-and-hold on raw return, but can cut worst drawdowns. Question is whether investor could hold buy-and-hold through deep losses.</p>
            </div>
          )}
        </section>
      ) : null}

      {step === "config" ? (
        <section className="wizard-page">
          <div className="wizard-head">
            <p className="eyebrow">Step 3 - Backtest</p>
            <h2>Set simulation rules.</h2>
            <p>Friction is where strategies die. Costs, lag, cash yield, and benchmark stay explicit.</p>
          </div>

          <div className="cfg-grid">
            <div className="panel"><div className="panel-b">
              <div className="field roomy">
                <label>Backtest window</label>
                <div className="slider-row">
                  <span className="mono muted">1993</span>
                  <div className="range-rail"><span /></div>
                  <span className="mono muted">2025</span>
                </div>
                <div className="hint">Full available history: Jan 1993 - Dec 2025, including major bear markets.</div>
              </div>
              <label className="field">
                <span>Starting capital</span>
                <input value={`$${capital.toLocaleString()}`} onChange={(event) => setCapital(parseMoney(event.target.value))} />
              </label>
            </div></div>

            <div className="panel"><div className="panel-b">
              <div className="field roomy">
                <label>Rebalance / signal frequency</label>
                <div className="seg">
                  {["Daily signal", "Weekly", "Monthly"].map((item) => (
                    <button className={rebalance === item ? "on" : ""} key={item} onClick={() => setRebalance(item)} type="button">{item}</button>
                  ))}
                </div>
                <div className="hint">Daily reacts fastest but trades most. Monthly cuts whipsaw at cost of lag.</div>
              </div>
              <div className="field">
                <label>Benchmark</label>
                <div className="seg">
                  {["SPY buy & hold", "60/40", "Cash"].map((item) => (
                    <button className={benchmark === item ? "on" : ""} key={item} onClick={() => setBenchmark(item)} type="button">{item}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Execution timing</label>
                <div className="seg">
                  <button className={executionTiming === "next_open" ? "on" : ""} type="button" onClick={() => setExecutionTiming("next_open")}>Next open</button>
                  <button className={executionTiming === "same_close" ? "on" : ""} type="button" onClick={() => setExecutionTiming("same_close")}>Same close</button>
                </div>
                <div className="hint">Next open avoids same-close signal/fill bias. Same close preserves legacy runs.</div>
              </div>
            </div></div>
          </div>

          <div className="panel friction-panel">
            <div className="panel-h"><h3>Trading frictions</h3><span className="sub">Part most backtests cheat on</span></div>
            <div className="panel-b cfg-grid">
              <RangeField label="Commission" max={10} step={0.5} unit="bps / trade" value={commission} onChange={setCommission} />
              <RangeField label="Slippage" max={15} step={0.5} unit="bps / trade" value={slippage} onChange={setSlippage} />
              <RangeField label="Cash yield (when out)" max={6} step={0.25} unit="% annual" value={cashYield} onChange={setCashYield} />
              <div className="field">
                <label>Cash policy</label>
                <div className="seg">
                  <button className={cashPolicy === "risk_free_proxy" ? "on" : ""} type="button" onClick={() => setCashPolicy("risk_free_proxy")}>Risk-free</button>
                  <button className={cashPolicy === "hold_cash" ? "on" : ""} type="button" onClick={() => setCashPolicy("hold_cash")}>Idle cash</button>
                  <button className={cashPolicy === "benchmark_asset" ? "on" : ""} type="button" onClick={() => setCashPolicy("benchmark_asset")}>Benchmark</button>
                </div>
                <div className="hint">Risk-free earns configured cash yield; idle cash earns zero; benchmark invests idle sleeve in benchmark.</div>
              </div>
              <div className="field">
                <label>Adjusted prices</label>
                <div className="seg">
                  <button className={useAdjusted ? "on" : ""} type="button" onClick={() => setUseAdjusted(true)}>Adjusted</button>
                  <button className={!useAdjusted ? "on" : ""} type="button" onClick={() => setUseAdjusted(false)}>Raw close</button>
                </div>
                <div className="hint">Adjusted accounts for splits and dividends.</div>
              </div>
              <div className="field">
                <label>OOS split date <span className="hint">(optional)</span></label>
                <input
                  type="date"
                  value={typeof oosStartDate === "string" ? oosStartDate : ""}
                  onChange={(e) => setOosStartDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
                <div className="hint">Dates after this are out-of-sample. Leave blank to skip.</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="form-actions wizard-foot">
        {step === "universe" ? (
          <button className="btn ghost" onClick={onCancel} type="button"><ArrowLeft size={15} /> Cancel</button>
        ) : (
          <button className="btn ghost" onClick={() => setStep(step === "config" ? "strategy" : "universe")} type="button">
            <ArrowLeft size={15} /> {step === "config" ? "Strategy" : "Universe"}
          </button>
        )}
        {step === "config" ? (
          <button className="btn primary lg" type="submit"><Play size={15} /> Run backtest</button>
        ) : (
          <button
            className="btn primary"
            disabled={universe.length === 0}
            onClick={() => setStep(step === "universe" ? "strategy" : "config")}
            type="button"
          >
            {step === "universe" ? "Define strategy" : "Configure backtest"} <ArrowRight size={15} />
          </button>
        )}
      </footer>
    </form>
  );
}

function Stepper({ active }: { active: Step }) {
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

function RangeField({
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

function titleForStep(step: Step) {
  if (step === "universe") return "What can strategy trade?";
  if (step === "strategy") return "Codify rule";
  return "Set simulation rules";
}

function splitSymbols(value: string) {
  return value.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
}

function seedCustomBlocks(universe: string[]): Block[] {
  const first = universe[0] ?? "SPY";
  return [
    { id: "ma_1", type: "indicator", indicator: "moving_average", symbol: first, window: 200, price: "close" },
    {
      id: "rule_1",
      type: "condition",
      if: { left: { ref: `${first}.close` }, operator: ">", right: { ref: "ma_1" } },
      then: [{ action: "set_weight", symbol: first, weight: 1 }],
      else: [{ action: "set_cash", weight: 1 }],
    },
  ];
}

function fallbackTicker(symbol: string) {
  return { t: symbol, n: "-", cls: "-", cagr: 0 };
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function parseMoney(value: string) {
  return Number.parseInt(value.replace(/[^0-9]/g, ""), 10) || 10000;
}
