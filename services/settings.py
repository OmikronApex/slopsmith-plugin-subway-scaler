"""Player settings persistence in data/settings.json."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from pydantic import ValidationError

from services.schemas import PlayerSettings
from services import scales as scales_service

_LOG = logging.getLogger(__name__)

PLUGIN_DIR = Path(__file__).resolve().parent.parent
SETTINGS_PATH: Path = PLUGIN_DIR / "data" / "settings.json"


class InvalidSettings(Exception):
    def __init__(self, fields: dict[str, str]):
        super().__init__("invalid settings")
        self.fields = fields


def _defaults() -> PlayerSettings:
    return PlayerSettings()


def load() -> PlayerSettings:
    if not SETTINGS_PATH.exists():
        return _defaults()
    try:
        with SETTINGS_PATH.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return PlayerSettings.model_validate(raw)
    except (json.JSONDecodeError, ValidationError) as e:
        _LOG.warning("Corrupt settings file at %s (%s); overwriting with defaults.", SETTINGS_PATH, e)
        s = _defaults()
        save(s)
        return s


def save(settings: PlayerSettings) -> PlayerSettings:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
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

    return save(s)
