# Subway Scaler
Guitar/Bass scale trainer. Subway Surfers style.

## Stack
- Backend: Python 3.10+, FastAPI.
- Frontend: Three.js, JavaScript.
- Data: JSON.

## Features
- Dynamic tabulator. Box patterns.
- Multiple instruments. Guitar. Bass.
- 3D gameplay. Linear tracks. Fret labels.
- Track-switching game mode: Avoid carts by playing correct scale notes.

## Setup
```bash
pip install -r requirements-dev.txt
npm install
```

## Test
```bash
# Python
python -m pytest

# JavaScript
npm test
```

## Development

Run the plugin inside a live Slopsmith container with hot-reload.

**Prerequisites:** [Docker Desktop](https://docs.docker.com/get-docker/) installed and running.

```bash
# 1. Build the Slopsmith image (one-time, ~5 minutes)
docker buildx build https://github.com/byrongamatos/slopsmith.git -t slopsmith-dev

# 2. Start the container
npm run dev

# 2. Verify the plugin loads
#    Open http://localhost:8000 — "Subway Scaler" should appear in the nav.
#    Or check via curl:
curl http://localhost:8000

# 3. Stop the container
npm run dev:down
```

**Hot-reload behaviour:**
- Static files (`static/`, `screen.html`, `screen.js`) — volume-mounted; browser refresh is sufficient.
- Python files (`routes.py`, `services/`) — reload depends on Slopsmith's FastAPI `--reload` flag; restart the container if changes don't apply.

## Files
- `scales.json`: Scale definitions.
- `services/`: Tabulator, scales, instruments logic.
- `static/game/`: Three.js engine.
- `routes.py`: Plugin entry.
