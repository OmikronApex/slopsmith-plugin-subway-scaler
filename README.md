# Subway Scaler

A guitar/bass scale trainer plugin for [Slopsmith](https://github.com/byrongamatos/slopsmith).
Play correct scale notes to keep your character running and avoid the carts — Subway Surfers style.

## What It Is

Subway Scaler displays a scrolling 3D track whose lanes map directly to the strings of your instrument. Safe zones appear in sequence, colour-coded by string. Play the matching note in time and your character moves onto that lane; miss and you collide with a cart and the session ends. Speed increases with every correct note.

## Requirements

- [Slopsmith](https://github.com/byrongamatos/slopsmith)
- [Slopsmith Minigames SDK](https://github.com/slopsmith/slopsmith-plugin-minigames) — Subway Scaler is launched from the Minigames Hub and will not run without this plugin installed alongside it

## Installation

### For players

Place both plugins in your Slopsmith plugins folder — either by unpacking release archives or by cloning the repositories directly:

```bash
# Option A — release archives
# Download the latest releases of both plugins and unpack them into your Slopsmith plugins folder.

# Option B — git clone
cd /path/to/slopsmith/plugins
git clone https://github.com/slopsmith/slopsmith-plugin-minigames minigames
git clone https://github.com/OmikronApex/slopsmith-plugin-subway-scaler subway-scaler
```

Slopsmith picks up both plugins automatically on next start. No further setup required.

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

## Tests

The test suite has three layers:

- **Contract & unit tests (Python)** — fast, no server required. Cover the backend API contracts, scale/instrument data, and game engine logic.
- **Unit tests (JavaScript)** — fast, no server required. Cover frontend modules (wave scheduler, cart system, note acceptance, etc.).
- **End-to-end tests (Playwright)** — require a clean Slopsmith instance running on `http://localhost:8000` with both the **minigames** plugin and **subway-scaler** installed. These test full user flows through the browser.

```bash
# Python contract + unit tests
python -m pytest

# JavaScript unit tests
npm test

# E2E tests
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed
```

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
- Mobile / phone-width viewports are not supported (desktop and tablet only)
- No in-game tutorial screen — the first detected note teaches the loop
