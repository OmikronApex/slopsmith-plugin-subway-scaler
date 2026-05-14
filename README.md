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

## Files
- `scales.json`: Scale definitions.
- `services/`: Tabulator, scales, instruments logic.
- `static/game/`: Three.js engine.
- `routes.py`: Plugin entry.
