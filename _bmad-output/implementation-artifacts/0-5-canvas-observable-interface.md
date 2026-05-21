# Story 0.5: Canvas Observable Interface

Status: ready-for-dev

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

- [ ] Task 1 — Initialize `window.__gameState` early (AC: 1)
  - [ ] In `static/game/main.js` (entry point), before any module initialization, write `window.__gameState` with all fields set to initial/default values
  - [ ] Set `window.__TEST_MODE = false` by default; Playwright will set it to `true` via `addInitScript` before navigation

- [ ] Task 2 — Wire `window.__gameState` updates in game modules (AC: 3, 4)
  - [ ] `GameLoop.js`: update `window.__gameState.loop.running`, `loop.frameCount`, `loop.deltaTime` every frame tick (inside `requestAnimationFrame` callback)
  - [ ] `GameLoop.js` / `GameState.js`: update `window.__gameState.session.phase` whenever `runtime.phase` changes
  - [ ] `CartSystem.js`: update `window.__gameState.collision.*` when a collision is detected; update `gameOver.*` when game-over is triggered
  - [ ] `GameState.js` or `GameLoop.js`: update `window.__gameState.score.current` when score changes
  - [ ] `AudioDetector.js`: update `window.__gameState.lastDetectedNote` when pitch detection produces a result (already partially set up in story 0-2a for `window.__audioState`; this is a separate field on `window.__gameState`)
  - [ ] Variant module (when implemented): update `window.__gameState.variant.*`

- [ ] Task 3 — Implement `_test` hooks (AC: 5, 6, 7, 9)
  - [ ] In `main.js` initialization, if `window.__TEST_MODE === true`, assign callable functions to `window.__gameState._test.*`
  - [ ] `resetGame`: resets `GameState`, re-initializes modules, sets `phase = 'idle'`
  - [ ] `forceCollision`: calls the same collision handler that `CartSystem.js` would call on a real collision
  - [ ] `triggerPause`: calls the same pause handler that keyboard input would call
  - [ ] If `window.__TEST_MODE !== true`, leave `_test` fields as `null`

- [ ] Task 4 — Set `window.__TEST_MODE` from Playwright fixtures (AC: 9)
  - [ ] Create `tests/e2e/fixtures/gameFixture.ts` that uses `page.addInitScript` to set `window.__TEST_MODE = true` before `page.goto()`
  - [ ] Export a `gamePage` fixture from this file for use in test specs

- [ ] Task 5 — Write observable interface spec (AC: 8)
  - [ ] Create `tests/e2e/specs/gamestate-observable.spec.ts`
  - [ ] Use `gamePage` fixture (sets TEST_MODE)
  - [ ] Assert `window.__gameState` is non-null
  - [ ] Assert `session.phase === 'idle'` on load
  - [ ] Poll `frameCount` twice with a short delay, assert it increased

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

### Completion Notes List

### File List

- `static/game/main.js` — UPDATE (init window.__gameState + _test hooks)
- `static/game/GameLoop.js` — UPDATE (sync loop.*, session.phase, score.*)
- `static/game/CartSystem.js` — UPDATE (sync collision.*, gameOver.*)
- `static/game/AudioDetector.js` — UPDATE (sync lastDetectedNote)
- `tests/e2e/fixtures/gameFixture.ts` — NEW
- `tests/e2e/specs/gamestate-observable.spec.ts` — NEW
