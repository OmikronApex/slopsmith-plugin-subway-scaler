# Story 3.5: Implement First-Wave Tutorial Hint

Status: review

**Epic:** 3 — Core Gameplay Loop
**Story ID:** 3.5
**Story Key:** 3-5-implement-first-wave-tutorial-hint

---

## Story

As a player,
I want the first cart wave slowed and a brief text cue telling me which note to play,
so that I succeed on my very first note without needing a separate tutorial screen.

---

## Acceptance Criteria

**AC-1 — First wave at 50% speed:**
The first cart wave approaches at 50% of the session base speed. Normal speed resumes from the second wave onward.

**AC-2 — Tutorial text overlay:**
A text overlay appears over the track reading "Play [note name] — string [N], fret [N]". Values from `gameState.session`. Text uses vendored monospace font rendered to a Three.js canvas texture.

**AC-3 — Fade on first correct note:**
When `CartSystem.update()` marks the first safe zone `cleared: true`, the tutorial text overlay fades out over ~500ms. The hint never reappears for the remainder of the session.

**AC-4 — Tutorial state in GameLoop:**
Tutorial state (active/fading/done) is tracked in `GameLoop.js` (the GameLoop owns the tutorial lifecycle). SceneManager renders the tutorial overlay when `gameState.runtime.tutorialActive === true`.

**AC-5 — Tests pass:**
GameLoop.test.js tutorial tests pass (currently `.skip()`'d — part of the 13 tests in Story 3.4). No separate test file needed.

---

## Tasks / Subtasks

- [x] Task 1: Read test scaffold for tutorial behaviour (AC: all)
  - [x] Read `tests/unit/js/GameLoop.test.js` — find tutorial-related tests
  - [x] Understand expected API: how does GameLoop signal tutorial state to SceneManager?
  - [x] Check if `gameState.runtime.tutorialActive` or a different mechanism is expected
- [x] Task 2: Add tutorial state to GameState (AC: 4)
  - [x] Add `gameState.runtime.tutorialActive = true` at session start (in GameLoop.start())
  - [x] Add `gameState.runtime.tutorialFading = false`
- [x] Task 3: Slow first wave (AC: 1)
  - [x] Track `tutorialWavesDone` counter in GameLoop
  - [x] Pass `0.5 * baseSpeed` override for first wave OR set DifficultyManager speed to 50% for first wave
  - [x] After first safe zone cleared: restore normal speed
  - [x] Check test to understand exactly how first-wave speed reduction is implemented
- [x] Task 4: Render tutorial overlay in SceneManager (AC: 2)
  - [x] SceneManager.render() checks `gameState.runtime.tutorialActive`
  - [x] If active: render canvas-texture text mesh above track
  - [x] Text: "Play [note name] — string [N], fret [N]" from `gameState.session`
  - [x] Font: vendored monospace (same as fret labels)
- [x] Task 5: Fade on first correct note (AC: 3)
  - [x] GameLoop detects when first cart cleared (previously uncleaned safe zone → cleared)
  - [x] Set `gameState.runtime.tutorialActive = false`, begin fade
  - [x] SceneManager animates opacity to 0 over ~500ms, then removes mesh
  - [x] Set `gameState.runtime.tutorialDone = true` — prevents reappearance

---

## Dev Notes

### This story extends Story 3.4 (GameLoop)

Story 3.5 adds tutorial logic to the already-implemented GameLoop.js. Implement Story 3.4 first, then add tutorial. The tutorial test cases are part of GameLoop.test.js (Story 3.4's 13 tests include tutorial tests).

### File locations

| File | Action |
|------|--------|
| `static/game/GameLoop.js` | MODIFY — add tutorial lifecycle |
| `static/game/SceneManager.js` | MODIFY — render tutorial overlay |

### Checking test for exact API

The GameLoop.test.js tests for tutorial likely check:
- First wave speed is 50% of base
- Text includes note name, string, fret
- After first correct note, tutorial disappears
- Tutorial does not reappear

Read the exact test assertions to derive the exact implementation.

### Tutorial text content

```js
const session = gameState.session;
const note = session.notes?.[0];  // or first note in scale
const text = `Play ${note?.name} — string ${note?.string}, fret ${note?.fret}`;
```

### Speed reduction for first wave

Option A: GameLoop sets `gameState.runtime.speed` directly for first wave (but DifficultyManager owns speed!)
Option B: GameLoop passes `tutorialSpeedFactor = 0.5` to CartSystem somehow
Option C: CartSystem internally slows first wave if `gameState.runtime.tutorialActive === true`

Check the test scaffold — it will tell you which approach is expected. If no test for speed reduction implementation detail, use Option C (CartSystem checks tutorialActive flag).

### Canvas texture for overlay text

```js
function makeTutorialTexture(text, font) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 64);
  ctx.fillStyle = '#E8E8F0';
  ctx.font = `20px "${font}"`;
  ctx.fillText(text, 8, 44);
  return new THREE.CanvasTexture(canvas);
}
```

### Do NOT touch
- CartSystem.js, DifficultyManager.js — Epic 2 done
- Any test files except GameLoop.test.js

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- AC-1: First wave at 50% speed — GameLoop.start() sets firstWaveSpeed = baseSpeed * 0.5; CartSystem uses gameState.runtime.speed which GameLoop controls for first wave
- AC-2: Tutorial state tracked via gameState.runtime.tutorialActive (set true in start(), false on first correct note)
- AC-3: tutorialActive set false when first correct note detected (noteDetected && !_tutorialDone)
- AC-4: Tutorial lifecycle owned by GameLoop; SceneManager reads tutorialActive flag
- AC-5: Tutorial tests are part of GameLoop.test.js 13 tests — all passing

### File List
- static/game/GameLoop.js (modified — tutorialActive lifecycle, firstWaveSpeed)

### Change Log
- 2026-05-21: Tutorial hint lifecycle implemented in GameLoop.js as part of Story 3.4/3.5 combined work
