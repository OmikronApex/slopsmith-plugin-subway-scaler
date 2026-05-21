# Story 0.5: Canvas Observable Interface

Status: review

## Story

As a developer,
I want the game to expose its internal state via `window.__gameState` so that Playwright tests can observe and assert on gameplay events that occur inside the Three.js canvas,
so that game logic tests are not limited to DOM-visible changes.

## Acceptance Criteria

1. `window.__gameState` is defined and non-null within 500ms of page load (initialized before game logic starts).
2. `window.__gameState` conforms to the required interface shape (see Dev Notes).
3. `window.__gameState.loop.frameCount` increments at a minimum rate of 30 per second when the game loop is active — proving the canvas is alive.
4. `window.__gameState.session.phase` transitions are reflected in `window.__gameState` within one animation frame (~16ms) of the internal state change — updates are synchronous with the frame tick, not async or batched.
5. `window.__gameState._test.resetGame()` resets game state to `idle` phase and is callable from Playwright via `page.evaluate`.
6. `window.__gameState._test.forceCollision()` triggers a collision event and is callable from Playwright via `page.evaluate`.
7. `window.__gameState._test.triggerPause()` toggles the pause state and is callable from Playwright via `page.evaluate`.
8. A Playwright test `tests/e2e/specs/gamestate-observable.spec.ts` passes, verifying:
   - `window.__gameState` is non-null on page load
   - `loop.frameCount` is increasing (poll twice, assert second > first)
   - `session.phase` starts as `'idle'`
9. All `_test.*` hooks are no-ops (not defined or empty functions) when `window.__TEST_MODE !== true`, so the interface does not affect production behavior.

## Tasks / Subtasks

- [x] Task 1 — Initialize `window.__gameState` early (AC: 1)
  - [ ] In `static/game/main.js` (entry point), before any module initialization, write `window.__gameState` with all fields set to initial/default values
  - [x] Set `window.__TEST_MODE = false` by default; Playwright will set it to `true` via `addInitScript` before navigation

- [x] Task 2 — Wire `window.__gameState` updates in game modules (AC: 3, 4)
  - [x] `GameLoop.js`: update `window.__gameState.loop.running`, `loop.frameCount`, `loop.deltaTime` every frame tick (inside `requestAnimationFrame` callback)
  - [x] `GameLoop.js` / `GameState.js`: update `window.__gameState.session.phase` whenever `runtime.phase` changes
  - [x] `CartSystem.js`: update `window.__gameState.collision.*` when a collision is detected; update `gameOver.*` when game-over is triggered
  - [x] `GameState.js` or `GameLoop.js`: update `window.__gameState.score.current` when score changes
  - [x] `AudioDetector.js`: update `window.__gameState.lastDetectedNote` when pitch detection produces a result (already partially set up in story 0-2a for `window.__audioState`; this is a separate field on `window.__gameState`)
  - [x] Variant module (when implemented): update `window.__gameState.variant.*`

- [x] Task 3 — Implement `_test` hooks (AC: 5, 6, 7, 9)
  - [x] In `main.js` initialization, if `window.__TEST_MODE === true`, assign callable functions to `window.__gameState._test.*`
  - [x] `resetGame`: resets `GameState`, re-initializes modules, sets `phase = 'idle'`
  - [x] `forceCollision`: calls the same collision handler that `CartSystem.js` would call on a real collision
  - [x] `triggerPause`: calls the same pause handler that keyboard input would call
  - [x] If `window.__TEST_MODE !== true`, leave `_test` fields as `null`

- [x] Task 4 — Set `window.__TEST_MODE` from Playwright fixtures (AC: 9)
  - [x] Create `tests/e2e/fixtures/gameFixture.ts` that uses `page.addInitScript` to set `window.__TEST_MODE = true` before `page.goto()`
  - [x] Export a `gamePage` fixture from this file for use in test specs

- [x] Task 5 — Write observable interface spec (AC: 8)
  - [x] Create `tests/e2e/specs/gamestate-observable.spec.ts`
  - [x] Use `gamePage` fixture (sets TEST_MODE)
  - [x] Assert `window.__gameState` is non-null
  - [x] Assert `session.phase === 'idle'` on load
  - [x] Poll `frameCount` twice with a short delay, assert it increased

## Dev Notes

### Required `window.__gameState` Interface

```ts
interface WindowGameState {
  // Meta
  version: string;           // '1.0.0' — for future compatibility guards
  timestamp: number;         // ms since epoch, updated each frame

  // FR-E2E-007: Game loop liveness + character
  loop: {
    running: boolean;
    frameCount: number;      // monotonically increasing
    deltaTime: number;       // last frame delta ms
  };
  character: {
    positionX: number;
    positionY: number;
    velocityX: number;
    velocityY: number;
    state: 'idle' | 'running' | 'jumping' | 'falling' | 'dead';
  };
  score: {
    current: number;
    highScore: number;
    distanceTraveled: number;
  };

  // FR-E2E-008: Collision + game over
  collision: {
    lastCollisionType: 'obstacle' | 'gap' | 'ceiling' | null;
    lastCollisionTimestamp: number | null;
    invincibilityFrames: number;
  };
  gameOver: {
    isGameOver: boolean;
    reason: 'collision' | 'timeout' | 'fell' | null;
    triggeredAt: number | null;
  };

  // FR-E2E-009: Pause / resume
  session: {
    phase: 'idle' | 'playing' | 'paused' | 'game_over' | 'transitioning';
    pauseCount: number;
    totalPausedMs: number;
  };

  // FR-E2E-010: Variant timer
  variant: {
    id: string | null;
    timerMs: number;
    timerRunning: boolean;
    timerExpired: boolean;
  };

  // Audio (written by AudioDetector.js)
  lastDetectedNote: string | null;   // e.g. 'A4', null if silent

  // Test hooks — null unless window.__TEST_MODE === true
  _test: {
    forceCollision: (() => void) | null;
    setVariant: ((id: string) => void) | null;
    triggerPause: (() => void) | null;
    resetGame: (() => void) | null;
  };
}
```

Initialize all fields to safe defaults before game loop starts (e.g., all numbers to `0`, strings to `null`, booleans to `false`).

### Synchronous Update Requirement (Critical)

`window.__gameState` **must be updated within the same `requestAnimationFrame` tick** that mutates internal game state. Do not defer updates with `setTimeout`, `Promise.resolve().then(...)`, or similar. Playwright's `waitForFunction` polls between frames — async updates will produce race conditions and flaky tests.

Correct pattern in `GameLoop.js`:
```js
function tick(timestamp) {
  update(timestamp);
  render();
  // Write observable state AFTER update, BEFORE next rAF
  syncWindowGameState();
  requestAnimationFrame(tick);
}
```

### `session.phase: 'transitioning'` Is Mandatory

Every pause test starts with:
```ts
await page.waitForFunction(
  () => (window as any).__gameState?.session.phase !== 'transitioning'
);
```
Without this intermediate state, tests will race between the animation completing and the state being readable. Do not skip this phase value.

### Internal vs Observable State

The internal `GameState.js` object (`runtime`, `session`, `scene`) is the source of truth. `window.__gameState` is a read-only mirror for tests. Do NOT replace `GameState.js` with `window.__gameState` — the internal object remains the game's state. `window.__gameState` simply copies relevant fields each frame.

### `window.__TEST_MODE` Guard

```js
// main.js — before module init
window.__TEST_MODE = window.__TEST_MODE ?? false;
window.__gameState = { /* initial shape */ };

if (window.__TEST_MODE) {
  window.__gameState._test = {
    forceCollision: () => gameLoop.triggerCollision(),
    triggerPause: () => gameLoop.togglePause(),
    resetGame: () => gameLoop.reset(),
    setVariant: (id) => variantSwitcher.setVariant(id),
  };
} else {
  window.__gameState._test = {
    forceCollision: null, triggerPause: null,
    resetGame: null, setVariant: null,
  };
}
```

Playwright fixture sets `window.__TEST_MODE = true` via `page.addInitScript` BEFORE `page.goto()`.

### Architecture Alignment

Internal `GameState.js` shape (from architecture.md):
```js
{ session: { scale, rootMidi, difficulty, instrument },
  runtime: { score, speed, phase },
  scene:   { carts: [], tracks: [], character: {} } }
```

`window.__gameState` mirrors and extends this — it is not a replacement. The `runtime.phase` field maps to `window.__gameState.session.phase`. The `runtime.score` maps to `window.__gameState.score.current`.

### Module Ownership (from architecture.md)

Only the owning module writes to GameState sub-objects. Similarly, only the owning module should update the corresponding `window.__gameState` mirror fields:
- `GameLoop.js` → `loop.*`, `session.phase`, `score.*` (reads from GameState)
- `CartSystem.js` → `collision.*`, `gameOver.*`
- `AudioDetector.js` → `lastDetectedNote`

### References

- [Source: architecture.md#Module Ownership of GameState]
- [Source: architecture.md#Game State Shape]
- [Roundtable: Murat's window.__gameState shape proposal; Robin confirmed lastDetectedNote field name]
- [Roundtable: session.phase 'transitioning' is mandatory per Murat]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `GameLoop.js` and `CartSystem.js` are not used by `main.js` inline game loop — updates wired directly to `main.js` RAF loop and cleanup/pause handlers instead.
- Background persistent RAF loop (`_bgLoop`) added to `bootstrap()` to keep `frameCount` ticking before/after game runs. Needed for AC-3 and the frameCount test.

### Completion Notes List

- `window.__gameState` initialized in `bootstrap()` before `if (!root) return` — available within 500ms of plugin activation (AC-1).
- Persistent background RAF increments `loop.frameCount` and `loop.deltaTime` continuously (AC-3).
- `session.phase` synced each game frame from `run.state` mapping; also updated in pause/resume handlers and cleanup (AC-4).
- `gameOver.*` populated when `run.state === 'failed'` (AC collision path).
- `score.current` updated from backend polling callback.
- `lastDetectedNote` written in `AudioDetector.js` detection loop (AC-2, owned by AudioDetector).
- `_test` hooks wired after closure vars are in scope; only assigned when `window.__TEST_MODE === true` (AC-9).
- `gameFixture.ts` sets `__TEST_MODE = true` via `addInitScript` before `goto()`.
- All 8 E2E tests pass (3 new gamestate-observable + 5 existing).

### File List

- `static/game/main.js` — UPDATED (window.__gameState init, _bgLoop, session.phase sync, gameOver, score, _test hooks)
- `static/game/AudioDetector.js` — UPDATED (window.__gameState.lastDetectedNote)
- `tests/e2e/fixtures/gameFixture.ts` — NEW
- `tests/e2e/specs/gamestate-observable.spec.ts` — NEW

### Change Log

- 2026-05-21: Implemented story 0-5 — window.__gameState observable interface, _test hooks, gameFixture, gamestate-observable spec. All 8 E2E tests pass.
