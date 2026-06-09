from __future__ import annotations

import os
from pathlib import Path

DEFAULT_EXPERIMENT_ROOT = Path("data/experiments")
DEFAULT_MARKET_CACHE_ROOT = Path("data/market_cache")
DEFAULT_ALLOWED_ORIGINS = ("http://127.0.0.1:5173", "http://localhost:5173")

def allowed_origins() -> list[str]:
    raw = os.getenv("QUANT_LAB_CORS_ORIGINS")
    if not raw:
        return list(DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


