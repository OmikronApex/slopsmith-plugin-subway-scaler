from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

PLUGIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = PLUGIN_DIR / "static"


def setup(app: FastAPI, context: dict):
    # Static asset mount for game JS modules + vendored Three.js
    if STATIC_DIR.exists():
        app.mount(
            "/plugins/subway-scaler/static",
            StaticFiles(directory=str(STATIC_DIR)),
            name="subway-scaler-static",
        )

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
