from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import date, datetime
from enum import Enum
from typing import Any, Mapping


class DomainError(ValueError):
    """Raised when domain object invariants are violated."""


class StrEnum(str, Enum):
    def __str__(self) -> str:
        return self.value


class AssetClass(StrEnum):
    EQUITY = "equity"
    ETF = "etf"
    CASH = "cash"
    CRYPTO = "crypto"
    FUND = "fund"
    INDEX = "index"


class StrategyKind(StrEnum):
    BUY_AND_HOLD = "buy_and_hold"
    MOVING_AVERAGE_FILTER = "moving_average_filter"
    MOMENTUM_ROTATION = "momentum_rotation"
    CUSTOM_RULES = "custom_rules"


class Frequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class CashPolicy(StrEnum):
    HOLD_CASH = "hold_cash"
    BENCHMARK_ASSET = "benchmark_asset"
    RISK_FREE_PROXY = "risk_free_proxy"


class ExecutionTiming(StrEnum):
    SAME_CLOSE = "same_close"
    NEXT_OPEN = "next_open"


class DataAdjustment(StrEnum):
    RAW = "raw"
    SPLIT_ADJUSTED = "split_adjusted"
    TOTAL_RETURN = "total_return"


class DataQualitySeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class WarningSeverity(StrEnum):
    INFO = "info"
    CAUTION = "caution"
    DANGER = "danger"


class ExperimentStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class OrderSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


@dataclass(frozen=True)
class StrategyProgram:
    version: int
    universe: tuple[str, ...]
    blocks: tuple[Mapping[str, Any], ...]

    def __post_init__(self) -> None:
        if self.version != 1:
            raise DomainError("Strategy program version must be 1")
        if not self.universe:
            raise DomainError("Strategy program universe cannot be empty")
        if any(not symbol.strip() for symbol in self.universe):
            raise DomainError("Strategy program universe symbols cannot be empty")
        if not self.blocks:
            raise DomainError("Strategy program blocks cannot be empty")
        for block in self.blocks:
            if not isinstance(block, Mapping):
                raise DomainError("Strategy program blocks must be objects")
            if not str(block.get("id", "")).strip():
                raise DomainError("Strategy program block id cannot be empty")
            if not str(block.get("type", "")).strip():
                raise DomainError("Strategy program block type cannot be empty")


@dataclass(frozen=True)
class Asset:
    symbol: str
    asset_class: AssetClass
    name: str | None = None
    exchange: str | None = None
    currency: str = "USD"

    def __post_init__(self) -> None:
        if not self.symbol.strip():
            raise DomainError("Asset symbol cannot be empty")
        if not self.currency.strip():
            raise DomainError("Asset currency cannot be empty")


@dataclass(frozen=True)
class CostModel:
    commission_bps: float = 0.0
    slippage_bps: float = 0.0
    min_commission: float = 0.0

    def __post_init__(self) -> None:
        _require_non_negative("commission_bps", self.commission_bps)
        _require_non_negative("slippage_bps", self.slippage_bps)
        _require_non_negative("min_commission", self.min_commission)


@dataclass(frozen=True)
class BacktestConfig:
    start_date: date
    end_date: date
    initial_capital: float
    benchmark: str
    frequency: Frequency = Frequency.DAILY
    rebalance_frequency: Frequency = Frequency.MONTHLY
    cost_model: CostModel = field(default_factory=CostModel)
    cash_policy: CashPolicy = CashPolicy.HOLD_CASH
    risk_free_rate: float = 0.0
    use_adjusted: bool = True
    oos_start_date: date | None = None
    execution_timing: ExecutionTiming = ExecutionTiming.SAME_CLOSE

    def __post_init__(self) -> None:
        if self.start_date >= self.end_date:
            raise DomainError("Backtest start_date must be before end_date")
        if self.initial_capital <= 0:
            raise DomainError("Backtest initial_capital must be positive")
        if not self.benchmark.strip():
            raise DomainError("Backtest benchmark cannot be empty")
        if self.oos_start_date is not None:
            if self.oos_start_date <= self.start_date:
                raise DomainError("oos_start_date must be after start_date")
            if self.oos_start_date >= self.end_date:
                raise DomainError("oos_start_date must be before end_date")


@dataclass(frozen=True)
class StrategyConfig:
    kind: StrategyKind
    universe: tuple[str, ...]
    parameters: Mapping[str, Any] = field(default_factory=dict)
    rules: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.universe:
            raise DomainError("Strategy universe cannot be empty")
        if any(not symbol.strip() for symbol in self.universe):
            raise DomainError("Strategy universe symbols cannot be empty")


@dataclass(frozen=True)
class DataQualityIssue:
    code: str
    severity: DataQualitySeverity
    message: str
    affected_symbol: str | None = None
    affected_date: date | None = None

    def __post_init__(self) -> None:
        if not self.code.strip():
            raise DomainError("Data quality issue code cannot be empty")
        if not self.message.strip():
            raise DomainError("Data quality issue message cannot be empty")


@dataclass(frozen=True)
class Bar:
    symbol: str
    as_of: date
    open: float
    high: float
    low: float
    close: float
    adjusted_close: float | None = None
    volume: int | None = None

    def __post_init__(self) -> None:
        if not self.symbol.strip():
            raise DomainError("Bar symbol cannot be empty")
        for name in ("open", "high", "low", "close"):
            _require_positive(name, getattr(self, name))
        if self.low > self.high:
            raise DomainError("Bar low cannot exceed high")
        if self.volume is not None and self.volume < 0:
            raise DomainError("Bar volume cannot be negative")


@dataclass(frozen=True)
class MarketDataSeries:
    symbol: str
    source: str
    adjustment: DataAdjustment
    start_date: date
    end_date: date
    bars: tuple[Bar, ...]
    fetched_at: datetime
    timezone: str = "UTC"
    quality_issues: tuple[DataQualityIssue, ...] = ()

    def __post_init__(self) -> None:
        if self.start_date > self.end_date:
            raise DomainError("Market data start_date cannot be after end_date")
        if not self.symbol.strip():
            raise DomainError("Market data symbol cannot be empty")
        if not self.source.strip():
            raise DomainError("Market data source cannot be empty")
        for bar in self.bars:
            if bar.symbol != self.symbol:
                raise DomainError("Market data bars must match series symbol")
            if bar.as_of < self.start_date or bar.as_of > self.end_date:
                raise DomainError("Market data bar date outside series range")


@dataclass(frozen=True)
class Fill:
    symbol: str
    as_of: date
    side: OrderSide
    quantity: float
    price: float
    commission: float = 0.0
    slippage: float = 0.0
    reason: str = "rebalance_to_target"
    target_weight: float | None = None
    signal_as_of: date | None = None
    execution_timing: ExecutionTiming | None = None

    def __post_init__(self) -> None:
        if not self.symbol.strip():
            raise DomainError("Fill symbol cannot be empty")
        _require_positive("quantity", self.quantity)
        _require_positive("price", self.price)
        _require_non_negative("commission", self.commission)
        _require_non_negative("slippage", self.slippage)
        if not self.reason.strip():
            raise DomainError("Fill reason cannot be empty")
        if self.target_weight is not None:
            _require_non_negative("target_weight", self.target_weight)


@dataclass(frozen=True)
class PortfolioSnapshot:
    as_of: date
    equity: float
    cash: float
    positions_value: float
    drawdown: float
    exposure: float

    def __post_init__(self) -> None:
        _require_non_negative("equity", self.equity)
        _require_non_negative("exposure", self.exposure)
        if self.drawdown > 0:
            raise DomainError("Portfolio drawdown cannot be positive")


@dataclass(frozen=True)
class MetricSet:
    total_return: float
    annualized_return: float
    volatility: float
    sharpe: float | None
    max_drawdown: float
    turnover: float
    exposure: float
    benchmark_total_return: float | None = None
    benchmark_annualized_return: float | None = None

    def __post_init__(self) -> None:
        _require_non_negative("volatility", self.volatility)
        _require_non_negative("turnover", self.turnover)
        _require_non_negative("exposure", self.exposure)
        if self.max_drawdown > 0:
            raise DomainError("Metric max_drawdown cannot be positive")


@dataclass(frozen=True)
class RiskWarning:
    code: str
    severity: WarningSeverity
    message: str
    evidence: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.code.strip():
            raise DomainError("Risk warning code cannot be empty")
        if not self.message.strip():
            raise DomainError("Risk warning message cannot be empty")


@dataclass(frozen=True)
class BenchmarkPoint:
    as_of: date
    equity: float

    def __post_init__(self) -> None:
        _require_non_negative("equity", self.equity)


@dataclass(frozen=True)
class SymbolDataProvenance:
    symbol: str
    source: str
    adjustment: DataAdjustment
    requested_start: date
    requested_end: date
    actual_start: date
    actual_end: date
    fetched_at: datetime
    bar_count: int
    expected_bars: int
    missing_bars: int
    cache_key: str | None = None
    cache_hash: str | None = None

    def __post_init__(self) -> None:
        if not self.symbol.strip():
            raise DomainError("Symbol data provenance symbol cannot be empty")
        if not self.source.strip():
            raise DomainError("Symbol data provenance source cannot be empty")
        _require_non_negative("bar_count", self.bar_count)
        _require_non_negative("expected_bars", self.expected_bars)
        _require_non_negative("missing_bars", self.missing_bars)


@dataclass(frozen=True)
class RunProvenance:
    data: tuple[SymbolDataProvenance, ...] = ()


@dataclass(frozen=True)
class RollingMetricPoint:
    as_of: date
    window: str
    total_return: float
    annualized_return: float
    volatility: float
    sharpe: float | None
    max_drawdown: float

    def __post_init__(self) -> None:
        if not self.window.strip():
            raise DomainError("Rolling metric window cannot be empty")
        _require_non_negative("volatility", self.volatility)
        if self.max_drawdown > 0:
            raise DomainError("Rolling metric max_drawdown cannot be positive")


@dataclass(frozen=True)
class OosAnalysis:
    start_date: date
    in_sample: MetricSet
    out_of_sample: MetricSet
    annualized_return_delta: float
    sharpe_delta: float | None
    max_drawdown_delta: float
    verdict: str

    def __post_init__(self) -> None:
        if not self.verdict.strip():
            raise DomainError("OOS verdict cannot be empty")


@dataclass(frozen=True)
class RegimeResult:
    name: str
    start_date: date
    end_date: date
    metrics: MetricSet

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise DomainError("Regime name cannot be empty")
        if self.start_date > self.end_date:
            raise DomainError("Regime start_date cannot be after end_date")


@dataclass(frozen=True)
class BacktestResult:
    run_id: str
    generated_at: datetime
    config: BacktestConfig
    strategy: StrategyConfig
    metrics: MetricSet
    equity_curve: tuple[PortfolioSnapshot, ...]
    fills: tuple[Fill, ...] = ()
    warnings: tuple[RiskWarning, ...] = ()
    benchmark_curve: tuple[BenchmarkPoint, ...] = ()
    oos_metrics: MetricSet | None = None
    provenance: RunProvenance = field(default_factory=RunProvenance)
    rolling_metrics: tuple[RollingMetricPoint, ...] = ()
    oos_analysis: OosAnalysis | None = None
    regime_results: tuple[RegimeResult, ...] = ()

    def __post_init__(self) -> None:
        if not self.run_id.strip():
            raise DomainError("Backtest run_id cannot be empty")
        if not self.equity_curve:
            raise DomainError("Backtest equity_curve cannot be empty")
        for snapshot in self.equity_curve:
            if snapshot.as_of < self.config.start_date or snapshot.as_of > self.config.end_date:
                raise DomainError("Backtest equity snapshot outside config range")


@dataclass(frozen=True)
class Experiment:
    id: str
    name: str
    status: ExperimentStatus
    strategy: StrategyConfig
    backtest: BacktestConfig
    created_at: datetime
    updated_at: datetime
    result: BacktestResult | None = None
    strategy_program: StrategyProgram | None = None
    hypothesis: str | None = None
    notes: str | None = None

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise DomainError("Experiment id cannot be empty")
        if not self.name.strip():
            raise DomainError("Experiment name cannot be empty")
        if self.hypothesis is not None and not self.hypothesis.strip():
            raise DomainError("Experiment hypothesis cannot be empty")
        if self.updated_at < self.created_at:
            raise DomainError("Experiment updated_at cannot be before created_at")
        if self.result and self.result.config != self.backtest:
            raise DomainError("Experiment result config must match experiment backtest config")
        if self.result and self.result.strategy != self.strategy:
            raise DomainError("Experiment result strategy must match experiment strategy")


def to_primitive(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if is_dataclass(value):
        return {key: to_primitive(item) for key, item in asdict(value).items()}
    if isinstance(value, Mapping):
        return {str(key): to_primitive(item) for key, item in value.items()}
    if isinstance(value, tuple | list):
        return [to_primitive(item) for item in value]
    return value


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise DomainError(f"{name} must be positive")


def _require_non_negative(name: str, value: float) -> None:
    if value < 0:
        raise DomainError(f"{name} cannot be negative")
