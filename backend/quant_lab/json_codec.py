from __future__ import annotations

import json
from dataclasses import MISSING, fields, is_dataclass
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from types import UnionType
from typing import Any, get_args, get_origin, get_type_hints

from . import domain
from .domain import DomainError, Experiment, to_primitive


SCHEMA_VERSION = 1


def experiment_to_json(experiment: Experiment, *, indent: int = 2) -> str:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "experiment": to_primitive(experiment),
    }
    return json.dumps(payload, indent=indent, sort_keys=True)


def experiment_from_json(value: str | bytes | Path) -> Experiment:
    if isinstance(value, Path):
        raw = value.read_text(encoding="utf-8")
    elif isinstance(value, bytes):
        raw = value.decode("utf-8")
    else:
        raw = value

    payload = json.loads(raw)
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise DomainError("Unsupported experiment JSON schema_version")
    if "experiment" not in payload:
        raise DomainError("Experiment JSON missing experiment payload")
    return _decode_dataclass(Experiment, payload["experiment"])


def _decode_dataclass(cls: type[Any], payload: dict[str, Any]) -> Any:
    kwargs: dict[str, Any] = {}
    type_hints = get_type_hints(cls)
    for item in fields(cls):
        if item.name not in payload:
            if item.default is not MISSING:
                kwargs[item.name] = item.default
                continue
            if item.default_factory is not MISSING:
                kwargs[item.name] = item.default_factory()
                continue
            raise DomainError(f"Experiment JSON missing field: {item.name}")
        kwargs[item.name] = _decode_value(type_hints[item.name], payload[item.name])
    return cls(**kwargs)


def _decode_value(expected_type: Any, value: Any) -> Any:
    origin = get_origin(expected_type)
    args = get_args(expected_type)

    if origin is UnionType:
        if value is None and type(None) in args:
            return None
        non_null = [arg for arg in args if arg is not type(None)]
        if len(non_null) == 1:
            return _decode_value(non_null[0], value)

    if origin is tuple:
        (inner_type, *_) = args
        return tuple(_decode_value(inner_type, item) for item in value)

    if origin in (dict,):
        key_type, value_type = args
        return {
            _decode_value(key_type, key): _decode_value(value_type, item)
            for key, item in value.items()
        }

    if origin is not None and origin.__name__ == "Mapping":
        key_type, value_type = args
        return {
            _decode_value(key_type, key): _decode_value(value_type, item)
            for key, item in value.items()
        }

    if expected_type is Any:
        return value

    if isinstance(expected_type, type) and issubclass(expected_type, Enum):
        return expected_type(value)

    if expected_type is date:
        return date.fromisoformat(value)

    if expected_type is datetime:
        return datetime.fromisoformat(value)

    if isinstance(expected_type, type) and is_dataclass(expected_type):
        return _decode_dataclass(expected_type, value)

    if expected_type in (str, int, float, bool):
        return expected_type(value)

    if isinstance(expected_type, str):
        return _decode_forward_ref(expected_type, value)

    return value


def _decode_forward_ref(type_name: str, value: Any) -> Any:
    resolved = getattr(domain, type_name, None)
    if resolved is None:
        return value
    return _decode_value(resolved, value)
