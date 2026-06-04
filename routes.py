from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

PLUGIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = PLUGIN_DIR / "static"
SPRITES_DIR = STATIC_DIR / "assets"

_SPRITE_MIME = {
    ".gif": "image/gif",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}


def setup(app: FastAPI, context: dict):
    # Static asset mount for game JS modules + vendored Three.js
    if STATIC_DIR.exists():
        app.mount(
            "/plugins/subway-scaler/static",
            StaticFiles(directory=str(STATIC_DIR)),
            name="subway-scaler-static",
        )

    # Dedicated route for in-game sprites (served from static/assets/)
    @app.get("/api/plugins/subway-scaler/sprites/{filename}")
    def get_sprite(filename: str):
        if "/" in filename or "\\" in filename or ".." in filename:
            raise HTTPException(status_code=400, detail="invalid path")
        ext = Path(filename).suffix.lower()
        if ext not in _SPRITE_MIME:
            raise HTTPException(status_code=404, detail="not found")
        target = (SPRITES_DIR / filename).resolve()
        try:
            target.relative_to(SPRITES_DIR)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid path")
        if not target.is_file():
            raise HTTPException(status_code=404, detail="not found")
        return FileResponse(str(target), media_type=_SPRITE_MIME[ext])

    # Initialise settings with config_dir from host context (Story 10-6)
    if "config_dir" in context:
        from services import settings as settings_service
        settings_service.init(Path(context["config_dir"]))

    # Routers added in later phases
    from services.scales_router import router as scales_router
    from services.settings_router import router as settings_router
    from services.instruments_router import router as instruments_router
    from services.game_router import router as game_router

    app.include_router(scales_router)
    app.include_router(settings_router)
    app.include_router(instruments_router)
    app.include_router(game_router)
