"""Player settings persistence via Slopsmith config_dir (Story 10-6)."""
from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path

from pydantic import ValidationError

from services.schemas import PlayerSettings
from services import scales as scales_service
from services import instruments as instruments_service

_LOG = logging.getLogger(__name__)

PLUGIN_DIR = Path(__file__).resolve().parent.parent

_config_dir: Path | None = None


class InvalidSettings(Exception):
    def __init__(self, fields: dict[str, str]):
        super().__init__("invalid settings")
        self.fields = fields


def init(config_dir: Path | str) -> None:
    global _config_dir
    _config_dir = Path(config_dir)
    _migrate_legacy()


def _config_path() -> Path:
    if _config_dir is not None:
        return _config_dir / "subway_scaler.json"
    return PLUGIN_DIR / "data" / "subway_scaler.json"


def _migrate_legacy() -> None:
    legacy = PLUGIN_DIR / "data" / "settings.json"
    target = _config_path()
    if legacy.exists() and not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(legacy.read_text(encoding="utf-8"), encoding="utf-8")
        os.replace(str(legacy), str(legacy.with_suffix(".json.bak")))
        _LOG.info("Migrated settings from %s to %s", legacy, target)


def _defaults() -> PlayerSettings:
    return PlayerSettings()


def load() -> PlayerSettings:
    path = _config_path()
    if not path.exists():
        return _defaults()
    try:
        with path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return PlayerSettings.model_validate(raw)
    except (json.JSONDecodeError, ValidationError) as e:
        _LOG.warning("Corrupt settings file at %s (%s); returning defaults.", path, e)
        return _defaults()


def save(settings: PlayerSettings) -> PlayerSettings:
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".settings-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(settings.model_dump_json(indent=2))
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    os.replace(tmp, path)
    return settings


def validate_and_save(raw: dict) -> PlayerSettings:
    """Validate a payload and save it. Raises InvalidSettings with per-field messages on failure."""
    fields: dict[str, str] = {}
    try:
        s = PlayerSettings.model_validate(raw)
    except ValidationError as e:
        for err in e.errors():
            loc = ".".join(str(x) for x in err.get("loc", []))
            fields[loc or "(root)"] = err.get("msg", "invalid")
        raise InvalidSettings(fields)

    if s.lastScaleId not in scales_service.SCALES:
        raise InvalidSettings({"lastScaleId": f"unknown scale id: {s.lastScaleId}"})

    if s.instrumentId not in instruments_service.INSTRUMENTS:
        raise InvalidSettings({"instrumentId": f"unknown instrument id: {s.instrumentId}"})

    return save(s)
