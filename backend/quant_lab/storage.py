from __future__ import annotations

from pathlib import Path

from .domain import DomainError, Experiment
from .json_codec import experiment_from_json, experiment_to_json


class ExperimentNotFoundError(KeyError):
    pass


class ExperimentJsonStore:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def list(self) -> list[Experiment]:
        experiments: list[Experiment] = []
        for path in sorted(self.root.glob("*.json")):
            experiments.append(experiment_from_json(path))
        return experiments

    def get(self, experiment_id: str) -> Experiment:
        path = self._path_for(experiment_id)
        if not path.exists():
            raise ExperimentNotFoundError(experiment_id)
        return experiment_from_json(path)

    def save(self, experiment: Experiment) -> Experiment:
        path = self._path_for(experiment.id)
        path.write_text(experiment_to_json(experiment), encoding="utf-8")
        return experiment

    def delete(self, experiment_id: str) -> None:
        path = self._path_for(experiment_id)
        if not path.exists():
            raise ExperimentNotFoundError(experiment_id)
        path.unlink()

    def _path_for(self, experiment_id: str) -> Path:
        if not experiment_id.strip():
            raise DomainError("Experiment id cannot be empty")
        if any(char in experiment_id for char in ("/", "\\", ":", "..")):
            raise DomainError("Experiment id contains invalid path characters")
        return self.root / f"{experiment_id}.json"
