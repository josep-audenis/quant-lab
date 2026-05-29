from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from backend.quant_lab.api import create_app
from backend.quant_lab.domain import (
    BacktestConfig,
    Experiment,
    ExperimentStatus,
    Frequency,
    StrategyConfig,
    StrategyKind,
    to_primitive,
)
from backend.quant_lab.storage import ExperimentJsonStore


def test_health(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_experiment_blueprints(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.get("/experiment-blueprints")

    assert response.status_code == 200
    blueprints = response.json()["blueprints"]
    assert [blueprint["id"] for blueprint in blueprints] == [
        "buy_and_hold",
        "moving_average_filter",
        "momentum_rotation",
    ]
    assert blueprints[2]["universe"] == "SPY, QQQ, IWM, TLT, GLD"


def test_experiment_crud(tmp_path) -> None:
    client = _client(tmp_path)
    experiment = _experiment()

    create_response = client.post("/experiments", json={"experiment": to_primitive(experiment)})
    assert create_response.status_code == 201
    assert create_response.json()["experiment"]["id"] == "exp_api_001"

    list_response = client.get("/experiments")
    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1

    get_response = client.get("/experiments/exp_api_001")
    assert get_response.status_code == 200
    assert get_response.json()["experiment"]["strategy"]["kind"] == "buy_and_hold"

    export_response = client.get("/experiments/exp_api_001/export")
    assert export_response.status_code == 200
    assert export_response.headers["content-type"].startswith("application/json")
    assert export_response.json()["schema_version"] == 1
    assert export_response.json()["experiment"]["id"] == "exp_api_001"

    delete_response = client.delete("/experiments/exp_api_001")
    assert delete_response.status_code == 204

    missing_response = client.get("/experiments/exp_api_001")
    assert missing_response.status_code == 404


def test_create_edit_export_draft_experiment(tmp_path) -> None:
    client = _client(tmp_path)
    payload = {
        "name": "SPY trend filter",
        "hypothesis": "A trend filter reduces drawdown.",
        "universe": "SPY",
        "strategy_kind": "moving_average_filter",
        "ma_window": 200,
        "start_date": "2020-01-01",
        "end_date": "2024-12-31",
        "initial_capital": 25000,
        "benchmark": "SPY",
        "frequency": "daily",
        "rebalance_frequency": "monthly",
        "commission_bps": 1,
        "slippage_bps": 2,
        "min_commission": 0,
        "cash_policy": "hold_cash",
        "risk_free_rate": 0.01,
        "notes": "Initial draft.",
    }

    create_response = client.post("/experiments/draft", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()["experiment"]
    assert created["id"].startswith("exp_")
    assert created["hypothesis"] == "A trend filter reduces drawdown."
    assert created["strategy"]["parameters"]["window"] == 200
    assert created["strategy_program"]["blocks"][0]["type"] == "indicator"

    payload["name"] = "SPY trend filter edited"
    payload["hypothesis"] = "Edited hypothesis."
    payload["ma_window"] = 100
    update_response = client.put(f"/experiments/{created['id']}/draft", json=payload)
    assert update_response.status_code == 200
    assert update_response.json()["experiment"]["name"] == "SPY trend filter edited"
    assert update_response.json()["experiment"]["hypothesis"] == "Edited hypothesis."
    assert update_response.json()["experiment"]["strategy"]["parameters"]["window"] == 100
    assert update_response.json()["experiment"]["strategy_program"]["blocks"][0]["window"] == 100

    export_response = client.get(f"/experiments/{created['id']}/export")
    assert export_response.status_code == 200
    exported = export_response.json()
    assert exported["schema_version"] == 1
    assert exported["experiment"]["name"] == "SPY trend filter edited"
    assert exported["experiment"]["hypothesis"] == "Edited hypothesis."
    assert exported["experiment"]["strategy_program"]["version"] == 1


def test_imported_experiment_can_be_edited_and_exported(tmp_path) -> None:
    client = _client(tmp_path)
    imported = _experiment()

    import_response = client.post("/experiments", json={"experiment": to_primitive(imported)})
    assert import_response.status_code == 201

    edit_payload = {
        "name": "Imported experiment edited",
        "hypothesis": "Imported JSON remains editable.",
        "universe": "SPY, QQQ",
        "strategy_kind": "buy_and_hold",
        "ma_window": 200,
        "lookback_months": 12,
        "top_n": 1,
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "initial_capital": 10000,
        "benchmark": "SPY",
        "frequency": "daily",
        "rebalance_frequency": "monthly",
        "commission_bps": 0,
        "slippage_bps": 0,
        "min_commission": 0,
        "cash_policy": "hold_cash",
        "risk_free_rate": 0,
        "notes": "Edited after import.",
    }
    update_response = client.put("/experiments/exp_api_001/draft", json=edit_payload)
    assert update_response.status_code == 200

    export_response = client.get("/experiments/exp_api_001/export")
    assert export_response.status_code == 200
    exported = export_response.json()["experiment"]
    assert exported["name"] == "Imported experiment edited"
    assert exported["hypothesis"] == "Imported JSON remains editable."
    assert exported["strategy"]["universe"] == ["SPY", "QQQ"]
    assert exported["strategy_program"]["blocks"][0]["type"] == "allocation"


def test_imported_legacy_experiment_exports_generated_strategy_program(tmp_path) -> None:
    client = _client(tmp_path)
    legacy = to_primitive(_experiment())
    legacy["strategy_program"] = None

    import_response = client.post("/experiments", json={"experiment": legacy})
    assert import_response.status_code == 201

    export_response = client.get("/experiments/exp_api_001/export")
    assert export_response.status_code == 200
    exported = export_response.json()["experiment"]
    assert exported["strategy_program"]["version"] == 1
    assert exported["strategy_program"]["blocks"][0]["type"] == "allocation"


def test_put_rejects_url_id_mismatch(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.put("/experiments/wrong", json={"experiment": to_primitive(_experiment())})

    assert response.status_code == 400
    assert response.json()["detail"] == "Experiment id must match URL id"


def _client(tmp_path) -> TestClient:
    store = ExperimentJsonStore(tmp_path / "experiments")
    return TestClient(create_app(store))


def _experiment() -> Experiment:
    return Experiment(
        id="exp_api_001",
        name="API contract smoke test",
        status=ExperimentStatus.DRAFT,
        strategy=StrategyConfig(
            kind=StrategyKind.BUY_AND_HOLD,
            universe=("SPY",),
            parameters={},
            rules=("Hold SPY for configured backtest window.",),
        ),
        backtest=BacktestConfig(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            initial_capital=10_000,
            benchmark="SPY",
            frequency=Frequency.DAILY,
            rebalance_frequency=Frequency.MONTHLY,
        ),
        created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        hypothesis="API test hypothesis.",
    )
