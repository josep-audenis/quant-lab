from datetime import date

import pytest

from backend.quant_lab.domain import Bar, DomainError, StrategyProgram
from backend.quant_lab.programs import (
    buy_and_hold_program,
    interpret_program,
    moving_average_filter_program,
    validate_program,
)


def test_buy_and_hold_program_emits_constant_weights() -> None:
    program = buy_and_hold_program(("SPY", "QQQ"))
    bars = {
        "SPY": (_bar("SPY", 1, 100), _bar("SPY", 2, 101)),
        "QQQ": (_bar("QQQ", 1, 200), _bar("QQQ", 2, 201)),
    }

    targets = interpret_program(program, bars)

    assert targets[0].weights == {"SPY": 0.5, "QQQ": 0.5}
    assert targets[1].weights == {"SPY": 0.5, "QQQ": 0.5}


def test_moving_average_program_switches_between_cash_and_asset() -> None:
    program = moving_average_filter_program("SPY", 3)
    bars = {
        "SPY": (
            _bar("SPY", 1, 10),
            _bar("SPY", 2, 10),
            _bar("SPY", 3, 10),
            _bar("SPY", 4, 12),
            _bar("SPY", 5, 8),
        )
    }

    targets = interpret_program(program, bars)

    assert targets[0].cash == 1.0
    assert targets[3].weights == {"SPY": 1.0}
    assert targets[4].cash == 1.0


def test_program_validation_rejects_unknown_refs() -> None:
    program = StrategyProgram(
        version=1,
        universe=("SPY",),
        blocks=(
            {
                "id": "rule_1",
                "type": "condition",
                "if": {
                    "left": {"ref": "SPY.close"},
                    "operator": ">",
                    "right": {"ref": "missing"},
                },
                "then": [{"action": "set_weight", "symbol": "SPY", "weight": 1.0}],
                "else": [{"action": "set_cash", "weight": 1.0}],
            },
        ),
    )

    with pytest.raises(DomainError, match="Unknown strategy ref"):
        validate_program(program)


def _bar(symbol: str, day: int, close: float) -> Bar:
    return Bar(
        symbol=symbol,
        as_of=date(2024, 1, day),
        open=close,
        high=close,
        low=close,
        close=close,
    )
