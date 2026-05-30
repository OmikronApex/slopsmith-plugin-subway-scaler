# Story 10.6: Migrate Settings to Slopsmith Standard Config

Status: review

## Story

As the **plugin system**,
I want Subway Scaler to persist settings via `context["config_dir"]` like other Slopsmith plugins,
So that settings survive restarts and work in Docker.

## Acceptance Criteria

1. **config_dir path** — `routes.py` `setup(app, context)` uses `Path(context["config_dir"])` as settings root. File path = `config_dir / "subway_scaler.json"`.

2. **GET /settings** — Reads from `config_dir / "subway_scaler.json"`. File missing → returns defaults (`PlayerSettings()`). Corrupt JSON → log warning, return defaults.

3. **PUT /settings** — Writes to `config_dir / "subway_scaler.json"` using atomic temp+rename (mkstemp → write → fsync → os.replace). Prevent partial writes.

4. **Legacy migration** — `data/settings.json` exists AND config target doesn't → copy to target, rename old to `data/settings.json.bak`. One-time only.

5. **No schema change** — `PlayerSettings`, endpoint contracts, response shapes unchanged.

## Tasks / Subtasks

- [x] Add `init(config_dir)` to `services/settings.py` (AC: #1)
  - [x] Remove hardcoded `SETTINGS_PATH = PLUGIN_DIR / "data" / "settings.json"`
  - [x] Store config path as module variable set by `init()`
  - [x] Keep `_defaults()` returning `PlayerSettings()` unchanged
- [x] Update `load()` and `save()` in `settings.py` (AC: #2, #3)
  - [x] Use stored config path instead of hardcoded SETTINGS_PATH
  - [x] Atomic write: `tempfile.mkstemp` → write → `os.fsync` → `os.replace`
- [x] Add one-time migration in `init()` (AC: #4)
  - [x] Check: `data/settings.json` exists AND config target doesn't
  - [x] Copy file content, rename old to `.bak` (os.replace for Windows compat)
- [x] Update `routes.py` to pass config_dir (AC: #1)
  - [x] In `setup()`, extract `context["config_dir"]`, call `settings_service.init(Path(context["config_dir"]))`
- [x] Tests (AC: #1-5)

## Dev Notes

### Architecture Compliance

- Use exact same pattern as tuner plugin (`slopsmith-plugin-tuner/routes.py`):
  ```python
  config_dir = Path(context["config_dir"])
  config_file = config_dir / "subway_scaler.json"

  def _read() -> dict:
      if not config_file.exists():
          return defaults
      try:
          data = json.loads(config_file.read_text(encoding="utf-8"))
          ...
      except Exception:
          return defaults

  def _write(data: dict) -> None:
      config_dir.mkdir(parents=True, exist_ok=True)
      fd, tmp = tempfile.mkstemp(prefix=".settings-", dir=str(config_dir))
      with os.fdopen(fd, "w") as f:
          json.dump(data, f, indent=2)
          f.flush()
          os.fsync(f.fileno())
      os.replace(tmp, config_file)
  ```
- `PlayerSettings` schema from `schemas.py` stays unchanged — only the file path changes
- `validate_and_save()` logic unchanged — validation rules stay the same
- Existing endpoints (`GET /settings`, `PUT /settings`) keep same response/request shapes

### Tuner Reference

The tuner plugin stores its config file at `config_dir / "tuner.json"`. Subway Scaler's file is `config_dir / "subway_scaler.json"`. The `init()` pattern:
```python
_config_dir: Path | None = None

def init(config_dir: Path) -> None:
    global _config_dir
    _config_dir = config_dir
    _migrate_legacy()

def _migrate_legacy() -> None:
    legacy = PLUGIN_DIR / "data" / "settings.json"
    target = _config_dir / "subway_scaler.json"
    if legacy.exists() and not target.exists():
        target.write_text(legacy.read_text(encoding="utf-8"))
        legacy.rename(legacy.with_suffix(".json.bak"))

def load() -> PlayerSettings:
    path = (_config_dir or PLUGIN_DIR / "data") / "subway_scaler.json"
    ...
```

### Files to Touch

| File | Action |
|---|---|
| `services/settings.py` | UPDATE — add `init()`, remove hardcoded SETTINGS_PATH, atomic writes |
| `routes.py` | UPDATE — pass `context["config_dir"]` to `settings_service.init()` |

### Files NOT to Touch

- `services/settings_router.py` — no changes needed, endpoints stay same
- `services/schemas.py` — `PlayerSettings` unchanged
- `data/settings.json` — may be removed after migration, but leave `.bak`

### Testing

- Integration test: mock `config_dir` temp dir, call `init()`, verify GET returns defaults, PUT persists and GET returns saved
- Integration test: create `data/settings.json` with known values, call `init()`, verify migrated to new path, old file renamed to `.bak`
- Integration test: corrupt JSON in config file → verify defaults returned + warning logged
- Existing contract tests for `GET /settings` and `PUT /settings` pass unchanged

### References

- [Source: epics.md § Epic 10 — Story 10-6]
- [Source: slopsmith-plugin-tuner/routes.py — config_dir pattern]
- [Source: services/settings.py — current implementation]
- [Source: services/settings_router.py — endpoints (no change needed)]
- [Source: services/schemas.py PlayerSettings — schema (no change needed)]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Replaced hardcoded SETTINGS_PATH with _config_dir module var; _config_path() returns dynamic path
- init(config_dir) accepts str or Path; calls _migrate_legacy() for one-time migration
- Atomic save: mkstemp → write → fsync → os.replace; no partial writes
- Legacy migration uses os.replace (not rename) for Windows compatibility
- routes.py calls settings_service.init() when config_dir in context; conftest updated to use init()

### File List
- services/settings.py
- routes.py
- tests/conftest.py
- tests/integration/test_settings_config_dir.py

### Change Log
- 2026-05-30: Migrated settings to Slopsmith standard config_dir (Story 10-6)