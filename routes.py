from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

PLUGIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = PLUGIN_DIR / "static"


def setup(app: FastAPI, context: dict):
    @app.get("/api/plugins/subway_scaler/status")
    def get_status():
        return {"status": "ok", "message": "Subway Scaler is ready"}

    # Static asset mount for game JS modules + vendored Three.js
    if STATIC_DIR.exists():
        app.mount(
            "/plugins/subway_scaler/static",
            StaticFiles(directory=str(STATIC_DIR)),
            name="subway_scaler_static",
        )

    # Routers added in later phases
    from services.scales_router import router as scales_router
    from services.settings_router import router as settings_router

    app.include_router(scales_router)
    app.include_router(settings_router)
