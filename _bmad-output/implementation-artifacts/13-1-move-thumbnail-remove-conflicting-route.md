# Story 13.1: Move Thumbnail to `assets/` and Remove Conflicting Route

Status: done

## Story

As the **Slopsmith plugin system**,
I want `mg_thumbnail.png` located in `plugin-root/assets/` and the conflicting custom assets route removed,
so that the Minigames Hub finds the tile thumbnail via the Slopsmith core route without a route registration error on Slopsmith ≥ V0.2.9-alpha.7.

## Acceptance Criteria

1. `GET /api/plugins/subway-scaler/assets/mg_thumbnail.png` returns 200 with `Content-Type: image/png` (served by Slopsmith core — no custom handler needed)
2. `plugin-root/assets/mg_thumbnail.png` exists as a file
3. `static/assets/mg_thumbnail.png` is absent — thumbnail lives only in `assets/`
4. `routes.py` contains no `@app.get("/api/plugins/subway-scaler/assets/...")` handler
5. `routes.py` contains no `ASSETS_DIR`, `_ALLOWED_EXTENSIONS`, or `_MIME_MAP` constants (unless they're still required by Story 13-2's sprite route — if writing both stories sequentially, 13-2 will reintroduce a narrower `SPRITES_DIR` variant)
6. The StaticFiles mount at `/plugins/subway-scaler/static` is unchanged
7. `plugin.json` `minigame.thumbnail` value remains `"mg_thumbnail.png"` — no change
8. `SdkBridge.js` `thumbnail: 'mg_thumbnail.png'` is unchanged — no change
9. All existing Playwright E2E specs pass

## Tasks / Subtasks

- [x] Create `assets/` directory at plugin root with `mg_thumbnail.png` (AC: 1, 2, 3)
  - [x] Create directory `<plugin-root>/assets/`
  - [x] Copy `static/assets/mg_thumbnail.png` → `assets/mg_thumbnail.png`
  - [x] Delete `static/assets/mg_thumbnail.png`
- [x] Clean `routes.py` — remove conflicting custom handler (AC: 4, 5)
  - [x] Delete line 9: `ASSETS_DIR = STATIC_DIR / "assets"`
  - [x] Delete lines 11–15: `_ALLOWED_EXTENSIONS` and `_MIME_MAP` dicts
  - [x] Delete lines 27–42: the comment, `@app.get` decorator, and `get_asset` function body
  - [x] Verify no other code in `routes.py` references the deleted symbols
- [x] Verify StaticFiles mount is intact (AC: 6)
- [x] Confirm `plugin.json` and `SdkBridge.js` unchanged (AC: 7, 8)
- [x] Run E2E suite (AC: 9)

## Dev Notes

### What to change in `routes.py`

Current `routes.py` (lines 1–43 shown):

```python
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

PLUGIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = PLUGIN_DIR / "static"
ASSETS_DIR = STATIC_DIR / "assets"             # ← DELETE this line

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}  # ← DELETE
_MIME_MAP = {                                   # ← DELETE entire dict
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
}


def setup(app: FastAPI, context: dict):
    # Static asset mount for game JS modules + vendored Three.js
    if STATIC_DIR.exists():
        app.mount(
            "/plugins/subway-scaler/static",
            StaticFiles(directory=str(STATIC_DIR)),
            name="subway-scaler-static",
        )

    # Asset route for minigame hub thumbnail (SDK fetches /api/plugins/{id}/assets/{file})
    @app.get("/api/plugins/subway-scaler/assets/{filename}")   # ← DELETE from here…
    def get_asset(filename: str):
        if "/" in filename or "\\" in filename or ".." in filename:
            raise HTTPException(status_code=400, detail="invalid path")
        ext = Path(filename).suffix.lower()
        if ext not in _ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=404, detail="not found")
        target = (ASSETS_DIR / filename).resolve()
        try:
            target.relative_to(ASSETS_DIR)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid path")
        if not target.is_file():
            raise HTTPException(status_code=404, detail="not found")
        return FileResponse(str(target), media_type=_MIME_MAP[ext])  # ← …to here
```

After this story `routes.py` header should look like:

```python
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

PLUGIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = PLUGIN_DIR / "static"
```

Note: `HTTPException` and `FileResponse` imports can be removed only if Story 13-2 hasn't already added its sprite route. Since this story runs first, and Story 13-2 re-adds them, the safest approach is to leave unused imports in place for now — or remove them if you are confident 13-2 will add them back. Either is acceptable; the E2E suite will catch any import errors.

### File operations

- `PLUGIN_DIR` = `C:\Users\rkasp\PycharmProjects\slopsmith-plugin-subway-scaler` (the repo root; same directory as `routes.py`)
- Source: `static/assets/mg_thumbnail.png` (exists — confirmed in codebase)
- Destination: `assets/mg_thumbnail.png` (new directory)
- Do NOT touch `static/assets/Character_running_north.gif` or `static/assets/Character_powerslide_north.gif` — those are the story 13-2 target

### Why Slopsmith core handles the route now

Since V0.2.9-alpha.7, Slopsmith registers `/api/plugins/{plugin_id}/assets/` before mounting plugin routes. The path is served directly from `plugin-root/assets/` by the core. Our custom `get_asset` handler either never fires (shadowed by the core route) or causes a route registration conflict. Either way: delete it.

`plugin.json` `minigame.thumbnail: "mg_thumbnail.png"` is resolved by the hub relative to the core assets route — no plugin-side change needed.

### What must NOT break

- The `StaticFiles` mount at `/plugins/subway-scaler/static` (lines 20–25 in `routes.py`) must remain exactly as-is. It serves all JS modules, CSS, fonts, and currently the sprite GIFs. Story 13-2 adds a dedicated sprite API route; this story does not touch sprite paths.
- Settings, scale, instrument, and game endpoints in `routes.py` (lines 44+) are untouched by this story.
- `SdkBridge.js` `register()` call uses `thumbnail: 'mg_thumbnail.png'` — Slopsmith hub resolves this via its own assets route. No JS change needed.

### Testing notes

- No new tests required. The custom route being removed has no dedicated test (it was an implicit integration via the hub thumbnail flow).
- Run existing Playwright E2E specs to confirm no regression: `npm run test:e2e` or `.venv/Scripts/python.exe -m pytest tests/` as applicable.
- The thumbnail being accessible is an integration concern handled by Slopsmith core — not testable in our suite without a full Slopsmith host.

### Project Structure Notes

```
subway-scaler/
├── assets/                      ← NEW directory
│   └── mg_thumbnail.png         ← MOVED from static/assets/
├── static/
│   ├── assets/
│   │   ├── Character_running_north.gif   ← UNCHANGED
│   │   └── Character_powerslide_north.gif ← UNCHANGED
│   └── game/
│       └── ...
├── routes.py                    ← MODIFIED (handler removed)
├── plugin.json                  ← UNCHANGED
└── ...
```

### References

- [Epic 13 story spec]: `_bmad-output/planning-artifacts/epics.md` — Epic 13, Story 13-1
- [routes.py current state]: `routes.py` lines 1–43
- [plugin.json]: `plugin.json` line 12 — `"thumbnail": "mg_thumbnail.png"`
- [SdkBridge.js thumbnail ref]: `static/game/SdkBridge.js` line 221

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `assets/` at plugin root; moved `mg_thumbnail.png` from `static/assets/` (now only in `assets/`)
- Removed `ASSETS_DIR`, `_ALLOWED_EXTENSIONS`, `_MIME_MAP`, and `get_asset` endpoint from `routes.py`; also removed now-unused `HTTPException` and `FileResponse` imports
- StaticFiles mount at `/plugins/subway-scaler/static` unchanged
- `plugin.json` and `SdkBridge.js` unchanged
- 95 pytest tests pass, no regressions

### File List

- `assets/mg_thumbnail.png` (new)
- `static/assets/mg_thumbnail.png` (deleted)
- `routes.py` (modified — handler and dead constants removed)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/13-1-move-thumbnail-remove-conflicting-route.md` (this file)
