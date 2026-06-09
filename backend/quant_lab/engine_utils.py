from __future__ import annotations

import math

from .domain import BacktestConfig, Bar

def correlation(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    xmean = mean(xs)
    ymean = mean(ys)
    numerator = sum((x - xmean) * (y - ymean) for x, y in zip(xs, ys))
    x_var = sum((x - xmean) ** 2 for x in xs)
    y_var = sum((y - ymean) ** 2 for y in ys)
    denom = math.sqrt(x_var * y_var)
    if denom == 0:
        return None
    return numerator / denom


def bar_price(bar: Bar, config: BacktestConfig) -> float:
    if config.use_adjusted and bar.adjusted_close is not None:
        return bar.adjusted_close
    return bar.close


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = mean(values)
    variance = sum((v - m) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)
