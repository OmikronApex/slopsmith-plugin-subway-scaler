# Subway Scaler

A guitar/bass scale trainer plugin for [Slopsmith](https://github.com/byrongamatos/slopsmith).
Play correct scale notes to keep your character running and avoid the carts — Subway Surfers style.

## What It Is

Subway Scaler displays a scrolling 3D track whose lanes map directly to the strings of your instrument. Safe zones appear in sequence, colour-coded by string. Play the matching note in time and your character moves onto that lane; miss and you collide with a cart and the session ends. Speed increases with every correct note.

## Prerequisites

- Python 3.12+
- Node.js 18+ (for JS tests and dev tooling)
- [Docker Desktop](https://docs.docker.com/get-docker/) (for running inside Slopsmith)

## Installation

```bash
pip install -r requirements-dev.txt
npm install
```

## Running

### With Slopsmith (recommended)

The plugin runs as part of a live Slopsmith container with hot-reload.

> **Note:** Slopsmith does not yet publish a Docker Hub image. The command below builds it from source (~5 minutes, one-time). Pin to a specific commit SHA for stability — replace `main` with `477d22068cbc81fa5bf7485b04e24d60bdb5d735` (latest verified) or any later SHA from the [slopsmith repo](https://github.com/byrongamatos/slopsmith).

```bash
# 1. Build the Slopsmith image (one-time, ~5 minutes)
docker buildx build https://github.com/byrongamatos/slopsmith.git#477d22068cbc81fa5bf7485b04e24d60bdb5d735 -t slopsmith-dev

# 2. Start the container
npm run dev

# 3. Open http://localhost:8000 and navigate to Subway Scaler

# 4. Stop the container
npm run dev:down
```

**Hot-reload behaviour:**
- Static files (`static/`, `screen.html`, `screen.js`) — volume-mounted; browser refresh is sufficient.
- Python files (`routes.py`, `services/`) — reload depends on Slopsmith's FastAPI `--reload` flag; restart the container if changes don't apply.

## How to Play

1. **Select a scale** from the dropdown (Major, Minor Pentatonic, Blues, etc.)
2. **Choose your instrument** (Guitar or Bass) and **number of strings**
3. **Choose difficulty** — Easy, Medium, or Hard (affects game speed and score multiplier)
4. Click **START** — the root note is randomised to fret 5–8 of the lowest string
5. **Play the notes** shown on the colour-coded track lanes — your character moves to the matching lane
6. **Avoid the carts** by staying in the correct lane; a collision ends the session
7. The game speeds up with every correct note — see how long you can last

### Variant switching

Every few octave loops a parallel track appears beside the current one, offering a new root position (higher or lower on the neck). Play the new root note during the window to accept — the game switches to the new position and resets speed as a reward. Let the window expire and the variant track peels away; the session continues unchanged with no penalty.

## Instruments

| Instrument | Strings | Standard tuning (low → high) |
|---|---|---|
| Guitar (6-string) | 6 | E2 A2 D3 G3 B3 E4 |
| Guitar (7-string) | 7 | B1 E2 A2 D3 G3 B3 E4 |
| Guitar (8-string) | 8 | F#1 B1 E2 A2 D3 G3 B3 E4 |
| Bass (4-string)   | 4 | E1 A1 D2 G2 |
| Bass (5-string)   | 5 | B0 E1 A1 D2 G2 |

## String Colours (Rocksmith convention)

Track lanes are colour-coded from lowest to highest pitch, matching Rocksmith's string palette:

| String (low → high) | Colour |
|---|---|
| 1st (lowest) | Red |
| 2nd | Yellow |
| 3rd | Blue |
| 4th | Orange |
| 5th | Green |
| 6th | Purple |
| 7th | Magenta |
| 8th | Teal |

## Testing

```bash
# Python unit and contract tests
python -m pytest

# JavaScript unit tests
npm test

# E2E tests (requires Slopsmith container running)
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed
```

Playwright E2E tests live in `tests/e2e/specs/`. Use the `gamePage` fixture from `tests/e2e/fixtures/gameFixture.ts` when you need `window.__gameState`. Use `injectAudioFile` from `tests/e2e/helpers/audioHelper.ts` for WAV-based pitch detection tests (Chromium-only).

**CI:** GitHub Actions (`.github/workflows/e2e.yml`) runs on every push/PR to `main`.

## Project Structure

```
services/          Python backend — scales, instruments, game engine, settings
static/game/       Three.js frontend — game loop, scene, audio detection, UI
tests/             Python contract + integration + unit tests
tests/e2e/         Playwright end-to-end tests
scales.json        Scale definitions (intervals)
routes.py          Slopsmith plugin entry point
```

## Known Limitations (v1.0)

- No sound effects
- Screen reader support for gameplay canvas is not available — the game is inherently audio-driven
- Mobile / phone-width viewports are not supported (desktop and tablet only)
- No in-game tutorial screen — the first detected note teaches the loop
