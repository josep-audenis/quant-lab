from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf

from .domain import Bar, DataAdjustment, DataQualityIssue, DataQualitySeverity, DomainError, MarketDataSeries


DEFAULT_CACHE_ROOT = Path("data/market_cache")


class MarketDataFetcher:
    def __init__(self, cache_root: Path | str = DEFAULT_CACHE_ROOT) -> None:
        self.cache_root = Path(cache_root)
        self.cache_root.mkdir(parents=True, exist_ok=True)

    def fetch(
        self,
        symbol: str,
        start: date,
        end: date,
        *,
        force_refresh: bool = False,
    ) -> MarketDataSeries:
        if start >= end:
            raise DomainError("start must be before end")
        cache_path = self._cache_path(symbol, start, end)
        if not force_refresh and cache_path.exists():
            return _load_cache(cache_path)
        series = _download(symbol, start, end)
        _save_cache(cache_path, series)
        return series

    def fetch_many(
        self,
        symbols: tuple[str, ...],
        start: date,
        end: date,
        *,
        force_refresh: bool = False,
    ) -> dict[str, MarketDataSeries]:
        return {symbol: self.fetch(symbol, start, end, force_refresh=force_refresh) for symbol in symbols}

    def _cache_path(self, symbol: str, start: date, end: date) -> Path:
        name = f"{symbol}_{start.isoformat()}_{end.isoformat()}.json"
        return self.cache_root / name


def _download(symbol: str, start: date, end: date) -> MarketDataSeries:
    # yfinance end date is exclusive - add one day to include the end date
    fetch_end = end + timedelta(days=1)
    raw: pd.DataFrame = yf.download(
        symbol,
        start=start.isoformat(),
        end=fetch_end.isoformat(),
        auto_adjust=True,
        progress=False,
    )
    if raw.empty:
        raise DomainError(f"No market data returned for {symbol}")

    # Flatten MultiIndex columns if present (yfinance >= 0.2.x with single ticker)
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    raw.columns = [str(c).lower() for c in raw.columns]
    required = {"open", "high", "low", "close"}
    missing = required - set(raw.columns)
    if missing:
        raise DomainError(f"Market data missing columns for {symbol}: {missing}")

    bars: list[Bar] = []
    issues: list[DataQualityIssue] = []
    for idx, row in raw.iterrows():
        as_of = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
        try:
            bar = Bar(
                symbol=symbol,
                as_of=as_of,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=int(row["volume"]) if "volume" in row and pd.notna(row["volume"]) else None,
            )
            bars.append(bar)
        except (DomainError, ValueError) as exc:
            issues.append(
                DataQualityIssue(
                    code="bad_bar",
                    severity=DataQualitySeverity.WARNING,
                    message=str(exc),
                    affected_symbol=symbol,
                    affected_date=as_of,
                )
            )

    if not bars:
        raise DomainError(f"All bars invalid for {symbol}")

    actual_start = bars[0].as_of
    actual_end = bars[-1].as_of
    return MarketDataSeries(
        symbol=symbol,
        source="yfinance",
        adjustment=DataAdjustment.TOTAL_RETURN,
        start_date=actual_start,
        end_date=actual_end,
        bars=tuple(bars),
        fetched_at=datetime.now(UTC),
        quality_issues=tuple(issues),
    )


def _save_cache(path: Path, series: MarketDataSeries) -> None:
    payload: dict[str, Any] = {
        "symbol": series.symbol,
        "source": series.source,
        "adjustment": series.adjustment.value,
        "start_date": series.start_date.isoformat(),
        "end_date": series.end_date.isoformat(),
        "fetched_at": series.fetched_at.isoformat(),
        "bars": [
            {
                "as_of": bar.as_of.isoformat(),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            for bar in series.bars
        ],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_cache(path: Path) -> MarketDataSeries:
    payload = json.loads(path.read_text(encoding="utf-8"))
    symbol = payload["symbol"]
    bars = tuple(
        Bar(
            symbol=symbol,
            as_of=date.fromisoformat(b["as_of"]),
            open=b["open"],
            high=b["high"],
            low=b["low"],
            close=b["close"],
            volume=b.get("volume"),
        )
        for b in payload["bars"]
    )
    return MarketDataSeries(
        symbol=symbol,
        source=payload["source"],
        adjustment=DataAdjustment(payload["adjustment"]),
        start_date=date.fromisoformat(payload["start_date"]),
        end_date=date.fromisoformat(payload["end_date"]),
        bars=bars,
        fetched_at=datetime.fromisoformat(payload["fetched_at"]),
    )
