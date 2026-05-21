# Story 3.2: Implement TrackSystem and Safe Zone Rendering

Status: review

**Epic:** 3 — Core Gameplay Loop
**Story ID:** 3.2
**Story Key:** 3-2-implement-tracksystem-and-safe-zone-rendering

---

## Story

As a developer,
I want a `TrackSystem.js` that builds the 3D perspective track geometry and positions safe zones per session config,
so that the player can see which string/fret to play as lanes scroll toward them.

---

## Acceptance Criteria

**AC-1 — init populates scene.tracks:**
`TrackSystem.init(sessionConfig, gameState)` populates `gameState.scene.tracks` with lane geometry objects, one per note in `sessionConfig.notes`. Lane count equals `sessionConfig.track_count`. TrackSystem.js is the ONLY module that writes to `gameState.scene.tracks`.

**AC-2 — Lane colors:**
Each lane material colour matches `color-bg-stage` (`#1A1A2E`).

**AC-3 — Safe zone colours:**
Safe zone material colour matches `STRING_COLORS[note.string]` from `tokens.js`. String colours applied ONLY to safe zone geometry — not to lane surfaces or fret labels.

**AC-4 — Fret labels:**
Fret labels rendered at the bottom of each lane in neutral grey (`#666680`) using canvas texture (vendored monospace font).

**AC-5 — VARIANT_DIRECTION constant:**
`TrackSystem.js` exports `VARIANT_DIRECTION = { LOWER_FRET: 'left', HIGHER_FRET: 'right' }`. Documented for Epic 5 use, not yet wired to variant logic.

**AC-6 — Tests pass:**
All 12 tests in `tests/unit/js/TrackSystem.test.js` pass (currently `.skip()`'d). Tests cover: init populates tracks, lane/safe-zone colors, VARIANT_DIRECTION constants, showVariant/hideVariant scaffolds.

---

## Tasks / Subtasks

- [x] Task 1: Read existing code and test scaffold (AC: all)
  - [x] Read ALL 57 lines of `static/game/TrackSystem.js` — understand existing geometry helpers
  - [x] Read ALL 170 lines of `tests/unit/js/TrackSystem.test.js` — defines the API contract
  - [x] Read `static/game/ui/tokens.js` — STRING_COLORS export pattern
  - [x] Read `static/game/GameState.js` — scene.tracks shape
- [x] Task 2: Add VARIANT_DIRECTION export (AC: 5)
  - [x] Export `VARIANT_DIRECTION = { LOWER_FRET: 'left', HIGHER_FRET: 'right' }` from TrackSystem.js
- [x] Task 3: Implement TrackSystem.init() (AC: 1, 2, 3, 4)
  - [x] `init(sessionConfig, gameState)` — reads `sessionConfig.notes` and `sessionConfig.track_count`
  - [x] Build lane geometry object for each note (Three.js PlaneGeometry or BoxGeometry)
  - [x] Lane material: `color-bg-stage` (#1A1A2E) — import from tokens.js
  - [x] Build safe zone geometry per note — material: `STRING_COLORS[note.string]` (hex integer from tokens.js)
  - [x] Build fret label via CanvasTexture (canvas 2D text in grey #666680, vendored font)
  - [x] Push track objects to `gameState.scene.tracks`
  - [x] `TrackSystem.js` is sole writer to `gameState.scene.tracks`
- [x] Task 4: Scaffold showVariant/hideVariant (AC: 6)
  - [x] `TrackSystem.showVariant(variantConfig, gameState)` — stub returning without error (Epic 5 implements)
  - [x] `TrackSystem.hideVariant(gameState)` — stub returning without error (Epic 5 implements)
  - [x] Check test expectations — do not implement more than tests require
- [x] Task 5: Un-skip and green all TrackSystem tests (AC: 6)
  - [x] Remove `.skip` from all `it.skip()` in `tests/unit/js/TrackSystem.test.js`
  - [x] Run `npm test` — all 12 TrackSystem tests must pass
  - [x] Do NOT reduce existing 114-test pass count

---

## Dev Notes

### File locations

| File | Action |
|------|--------|
| `static/game/TrackSystem.js` | MODIFY — add init(), VARIANT_DIRECTION, showVariant/hideVariant |
| `tests/unit/js/TrackSystem.test.js` | MODIFY — un-skip all tests |

### Existing TrackSystem.js geometry helpers

Current file exports utility functions only:
- `LANE_X_SCALE = 1.6` — horizontal spacing
- `SPAWN_Z = -100` — spawn depth
- `laneX(index)` — X position for a lane
- `rowZ(row)` — Z position for a row
- `queueZ(index, speed)` — Z position in queue
- `cameraForPitch(pitch)` — camera position based on pitch
- `windowedLanes(lanes, centerIndex, windowSize)` — visible lane window

KEEP all existing helpers. Only ADD new init() and variant scaffold.

### Track object shape for GameState.scene.tracks

The tests define what track objects look like. Check the test scaffold carefully. Likely:
```js
{
  mesh: THREE.Mesh,       // lane geometry
  safeZone: THREE.Mesh,  // safe zone overlay
  label: THREE.Mesh,     // fret label (canvas texture)
  note: { midi, string, fret },  // from sessionConfig
  lane: Number,          // lane index
}
```

Read the test to confirm exact shape.

### STRING_COLORS import

tokens.js exports `STRING_COLORS` as JS hex integers for Three.js:
```js
import { STRING_COLORS } from './ui/tokens.js';
// STRING_COLORS[1] = 0xFF3333 (1-indexed by string number)
```

Use `new THREE.MeshBasicMaterial({ color: STRING_COLORS[note.string] })` for safe zones.

### sessionConfig shape (from /game/session-config endpoint)

```json
{
  "scale_id": "major",
  "root_midi": 60,
  "instrument_id": "guitar-standard",
  "notes": [{ "midi": 60, "name": "C4", "string": 2, "fret": 8 }],
  "track_count": 6
}
```

Field names are snake_case (API boundary).

### Fret label via canvas texture

```js
function makeFretLabel(fret, font) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#666680';
  ctx.font = `14px "${font}"`;
  ctx.fillText(`${fret}`, 4, 14);
  return new THREE.CanvasTexture(canvas);
}
```

Font: use the vendored monospace font name. If unsure, use `'monospace'` as fallback.

### VARIANT_DIRECTION

```js
export const VARIANT_DIRECTION = {
  LOWER_FRET: 'left',
  HIGHER_FRET: 'right',
};
```

This is just a constant export — no logic attached yet.

### Architecture sole-writer contract

Only TrackSystem.js writes to `gameState.scene.tracks`. SceneManager reads it (read-only). CartSystem never touches it.

### Do NOT touch
- `static/game/CartSystem.js`, `DifficultyManager.js` — different modules
- `tests/unit/js/CartSystem.test.js`, `DifficultyManager.test.js` — must keep passing

### Previous story learnings (Epic 2)
- Test scaffold defines the authoritative API — read it fully before implementing
- 114 tests must remain passing after changes

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- TrackSystem.test.js had all tests `.skip()`'d; un-skipped all 12

### Completion Notes List
- AC-1: TrackSystem.init(sessionConfig, gameState) populates gameState.scene.tracks, one entry per note; lane count = sessionConfig.track_count
- AC-2: Lane color = #1A1A2E (color-bg-stage)
- AC-3: Safe zone color = STRING_COLORS[note.string] hex integer from tokens.js
- AC-4: Fret label rendered as canvas texture in grey #666680
- AC-5: VARIANT_DIRECTION = { LOWER_FRET: 'left', HIGHER_FRET: 'right' } exported
- AC-6: All 12 TrackSystem tests un-skipped and passing

### File List
- static/game/TrackSystem.js (modified)
- tests/unit/js/TrackSystem.test.js (modified — un-skipped)

### Change Log
- 2026-05-21: Added TrackSystem static class with init(), showVariant(), hideVariant(); exported VARIANT_DIRECTION; un-skipped all 12 tests
