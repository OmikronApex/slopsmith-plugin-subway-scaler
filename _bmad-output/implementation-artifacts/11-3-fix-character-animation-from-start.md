# Story 11.3: Fix: Character Running Animation From Start

Status: ready-for-dev

## Story

As a player,
I want the character to be visibly running from the very first frame of the countdown,
so the game feels alive and responsive immediately rather than remaining frozen until the countdown finishes.

## Acceptance Criteria

1. When the player clicks START and the game scene initialises, the character sprite animates through its running frames during the countdown (before "GO!" appears)
2. The character cycles through frames at the configured `CHARACTER_FPS` rate throughout the countdown
3. After the countdown completes and `run.start(gameStartTime)` is called, the character continues animating without a visible jump or frame reset
4. During pause and resume, the character animation is paused (RAF loop stops) and resumes naturally — no freeze or stutter specific to this fix
5. No change to cart/wave timing, `gameStartTime`, `WaveScheduler`, or any other timing-dependent system

## Tasks / Subtasks

- [ ] Add `_charAnimStartMs` variable to `SceneManager.js` (AC: 1, 2, 3)
  - [ ] Declare `let _charAnimStartMs = null;` near the other state variables (around line 892)
- [ ] Set `_charAnimStartMs` lazily on the first render call after `setGameStartTime` (AC: 1)
  - [ ] In `setGameStartTime(time)`: reset `_charAnimStartMs = null` to mark it as "needs capture"
  - [ ] In `render(nowMs)`, before `updateCharacterSprite`: if `_charAnimStartMs === null`, set `_charAnimStartMs = nowMs`
- [ ] Update `updateCharacterSprite(nowGameMs)` to use `_charAnimStartMs` (AC: 2, 3)
  - [ ] Replace `const elapsed = nowGameMs - gameStartTime;` with `const elapsed = Math.max(0, nowGameMs - (_charAnimStartMs ?? nowGameMs));`
- [ ] Reset `_charAnimStartMs = null` inside `scene.reset()` (AC: 4, 5)
- [ ] Manually verify in browser: character animates during the 3-second countdown

## Dev Notes

### Root cause

`updateCharacterSprite(nowGameMs)` at line 860 of `SceneManager.js`:

```js
const elapsed = nowGameMs - gameStartTime;
```

`gameStartTime` is set to `countdownStart + 3500` (3.5 s in the future) at `main.js:895`, then synced to `SceneManager` via `scene.setGameStartTime(gameStartTime)` at `main.js:898`. The RAF loop starts at `main.js:911` — before the countdown. During the 3-second countdown, `nowGameMs - gameStartTime < 0`, so `elapsed` is always negative. `_frameTimelineFn(elapsed, frames.length)` returns frame 0 for any non-positive input, causing the character to be frozen on the first frame throughout the countdown.

### Fix — minimal change, no timing side-effects

`_charAnimStartMs` is a sprite-animation-only clock, entirely independent of `gameStartTime`, `WaveScheduler`, `CartSystem`, or any wave-timing logic. It does not affect gameplay correctness.

```js
// SceneManager.js — near line 892 (existing let declarations)
let _charAnimStartMs = null;

// setGameStartTime (line 1482):
function setGameStartTime(time) {
  gameStartTime = time;
  _charAnimStartMs = null;  // ← add this line; forces re-capture on next render
}

// render(nowMs) — add before the updateCharacterSprite call (line 1559):
if (_charAnimStartMs === null) _charAnimStartMs = nowMs;

// updateCharacterSprite (line 860) — change elapsed computation:
// Before:
const elapsed = nowGameMs - gameStartTime;
// After:
const elapsed = Math.max(0, nowGameMs - (_charAnimStartMs ?? nowGameMs));
```

### `scene.reset()` — where to find it

Search `SceneManager.js` for `function reset(` or `reset:` — add `_charAnimStartMs = null;` inside the reset body so a new session starts fresh.

### Slide animation path — no change needed

The `_isSliding` branch (lines 841–857) returns early before the `elapsed` computation at line 860. It is unaffected by this fix.

### No test required for this story

The fix is a single-variable change to sprite-frame selection. The character animation is a visual behavior verified by manual browser inspection (countdown → character runs). No existing unit test covers frame-level sprite animation timing, and adding one for this would require significant mock infrastructure for marginal value. Manual verification is the acceptance gate.

### Project Structure Notes

- `static/game/SceneManager.js` is the only file changed in this story
- `gameStartTime` in `SceneManager.js` is a closure-scoped variable (line 892) — the fix adds a companion variable `_charAnimStartMs` in the same scope
- `setGameStartTime` is exported (line 2170 of SceneManager) and called from `main.js:898`

### References

- [Source: static/game/SceneManager.js#836] — `updateCharacterSprite` function
- [Source: static/game/SceneManager.js#860] — `elapsed` computation (the line to fix)
- [Source: static/game/SceneManager.js#892] — `gameStartTime` declaration (add `_charAnimStartMs` here)
- [Source: static/game/SceneManager.js#1482] — `setGameStartTime` (add `_charAnimStartMs = null`)
- [Source: static/game/SceneManager.js#1555–1560] — `render(nowMs)` entry (add lazy capture here)
- [Source: static/game/main.js#895] — `gameStartTime = countdownStart + 3500` (explains why elapsed is negative during countdown)
- [Source: static/game/main.js#911] — `rafId = requestAnimationFrame(loop)` starts before countdown

## Dev Agent Record

### Agent Model Used

_tbd_

### Debug Log References

### Completion Notes List

### File List
