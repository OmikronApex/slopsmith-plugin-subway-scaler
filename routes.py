from fastapi import FastAPI

def setup(app: FastAPI, context: dict):
    @app.get("/api/plugins/subway_scaler/status")
    def get_status():
        return {"status": "ok", "message": "Subway Scaler is ready"}
