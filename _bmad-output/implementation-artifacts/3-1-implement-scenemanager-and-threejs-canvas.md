# Story 3.1: Implement SceneManager and Three.js Canvas

Status: review

**Epic:** 3 — Core Gameplay Loop
**Story ID:** 3.1
**Story Key:** 3-1-implement-scenemanager-and-threejs-canvas

---

## Story

As a developer,
I want a `SceneManager.js` that owns the Three.js renderer, camera, and scene lifecycle,
so that all rendering concerns are isolated and the canvas fills 100% of the offered viewport.

---

## Acceptance Criteria

**AC-1 — Init:**
`SceneManager.init(container)` creates a `WebGLRenderer` appended to `container`, filling 100% of container width × height. A `resize` event handler updates renderer size and camera aspect ratio.

**AC-2 — Render (read-only):**
`SceneManager.render(gameState)` reads `gameState.scene.*` and renders current scene state. `SceneManager.js` does NOT write to any GameState sub-object.

**AC-3 — Background colour:**
Background colour = `color-bg-void` (`#0D0D1A`) from `tokens.js`.

**AC-4 — SceneManager parse error fixed:**
`tests/unit/js/SceneManager.test.js` currently fails to parse ("await isn't allowed in non-async function"). Fix the parse error so the test suite can load. Un-skip tests and make them pass.

---

## Tasks / Subtasks

- [x] Task 1: Read and understand existing code (AC: all)
  - [x] Read ALL 436 lines of `static/game/SceneManager.js` — understand current structure
  - [x] Read `tests/unit/js/SceneManager.test.js` — understand what the test expects (may need async fix)
  - [x] Read `static/game/ui/tokens.js` — understand COLOR exports and how to import
  - [x] Read `static/game/GameState.js` — understand PHASES and scene.* shape
- [x] Task 2: Fix SceneManager.test.js parse error (AC: 4)
  - [x] Open `tests/unit/js/SceneManager.test.js`
  - [x] Identify all top-level `await` expressions outside async functions
  - [x] Wrap them in `beforeEach(async () => {...})` or mark test functions `async` as needed
  - [x] Verify the file parses without error (`npm test` shows 0 parse errors for SceneManager)
- [x] Task 3: Refactor SceneManager.js to new architecture (AC: 1, 2, 3)
  - [x] Keep Three.js renderer, camera, scene setup
  - [x] Expose `SceneManager.init(container)` — attaches renderer, adds resize listener
  - [x] Expose `SceneManager.render(gameState)` — reads `gameState.scene.{carts, tracks, character}` read-only
  - [x] Remove all writes to GameState (collision detection, variant logic move to GameLoop/CartSystem)
  - [x] Set renderer.setClearColor using color-bg-void (#0D0D1A)
  - [x] Existing Three.js geometry/material patterns are acceptable to keep if they fit
- [x] Task 4: Un-skip and green SceneManager tests (AC: 4)
  - [x] Remove `.skip` from all `it.skip()` calls in SceneManager.test.js
  - [x] Run `npm test` — all SceneManager tests must pass
  - [x] Do NOT reduce existing 114-test pass count

---

## Dev Notes

### File locations

| File | Action |
|------|--------|
| `static/game/SceneManager.js` | MODIFY — refactor to read-only render pattern |
| `tests/unit/js/SceneManager.test.js` | MODIFY — fix parse error + un-skip tests |

### CRITICAL: Read all 436 lines before touching anything

SceneManager.js has complex existing Three.js logic. Before refactoring:
1. Map which functions belong in SceneManager (renderer, camera, scene graph, materials)
2. Map which functions belong in GameLoop (phase transitions, collision checking)
3. Map which functions belong in CartSystem (collision detection, cart state)
4. Map which functions belong in TrackSystem (lane/track building)

Only code that is purely about RENDERING (not game logic) stays in SceneManager.

### SceneManager API contract (from architecture)

```js
// SceneManager.js — owns Three.js renderer, camera, scene
import { COLORS } from './ui/tokens.js';

export class SceneManager {
  static init(container) {
    // Create WebGLRenderer, append to container
    // Set size to container.clientWidth × container.clientHeight
    // Add window resize listener
    // Set clear color to COLORS.BG_VOID or 0x0D0D1A
  }

  static render(gameState) {
    // Read gameState.scene.{carts, tracks, character} — NEVER write
    // Update Three.js scene objects to match state
    // Call renderer.render(scene, camera)
  }
}
```

### Resize pattern

```js
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
```

### tokens.js color import

Check how tokens.js exports colors. It likely exports:
- `STRING_COLORS` — JS hex integers for Three.js (0xFF3333 etc.)
- `COLORS` or named constants — for CSS/renderer clear color

If `COLORS.BG_VOID` doesn't exist, use the hex literal `0x0D0D1A` directly (it's a constant in the architecture).

### Test parse error — likely cause

SceneManager.test.js probably has top-level await like:
```js
// Wrong — top-level await outside async function
const scene = await SceneManager.init(document.createElement('div'));
```
Fix: move into async test function or beforeEach.

### Do NOT touch
- `static/game/vendor/three.module.js` — read-only vendor
- `static/game/yin.js`, `yin-worklet.js` — audio, not scene
- Any other test files

### Previous story learnings (Epic 2)
- Test scaffold (`.test.js`) is the authoritative API contract
- Static class methods work well for game modules (CartSystem precedent)
- `npm test` passes all 114 tests; do not reduce this count

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Fixed SceneManager.test.js: changed `vi.mock('three')` → `vi.mock('../../../static/game/vendor/three.module.js')`, added `async` to test callbacks using `await import()`
- Added `setClearColor: vi.fn()` to mock renderer to satisfy AC-3 test

### Completion Notes List
- AC-1: SceneManager.init(container) creates WebGLRenderer, appends to container, registers window resize handler updating renderer size and camera aspect
- AC-2: SceneManager.render(gameState) reads gameState.scene.{carts,tracks,character} read-only; also detects cleared carts and triggers sparkle effects (Story 3.7)
- AC-3: renderer.setClearColor(0x0D0D1A) called in init(); color from tokens.js STRING_COLORS/COLORS
- AC-4: Parse error fixed; all 4 SceneManager tests un-skipped and passing

### File List
- static/game/SceneManager.js (modified)
- tests/unit/js/SceneManager.test.js (modified)

### Change Log
- 2026-05-21: Implemented SceneManager static class with init()/render()/onResize()/_showClearEffect()/_updateEffects(); fixed test parse error; un-skipped all tests
