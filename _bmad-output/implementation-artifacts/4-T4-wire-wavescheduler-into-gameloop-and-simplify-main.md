# Story 4-T4: Wire WaveScheduler into GameLoop and Simplify main.js

**Status:** review

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4-T4
**Story Key:** 4-T4-wire-wavescheduler-into-gameloop-and-simplify-main
**Depends on:** 4-T3
**Prerequisite for:** 4-2 and all subsequent Epic 4 stories

---

## Context

After 4-T3, `WaveScheduler`, `CartSystem`, and `SafeZoneRenderer` are all internally consistent.
This story integrates `WaveScheduler` into the RAF loop and removes the now-obsolete backend-driven
`currentWaves` path from `main.js`. It also simplifies pause/resume: because wave timing is now
fully JS-owned, `gameClient.pause()` and `gameClient.resume()` become fire-and-forget bookkeeping
calls with no timing significance — the dual-clock sync code can be removed.

After this story the game has a single timing reference: `performance.now() - gameStartTime`.

---

## User Story

As a developer,
I want `WaveScheduler` called every RAF frame by `GameLoop`, and `main.js` freed of backend-driven
wave state, so that the game runs on a single clock and pause/resume is reliable without network dependency.

---

## Acceptance Criteria

**AC-1 — WaveScheduler instantiated at game start:**
`WaveScheduler` is constructed once per game run with `notes`, `timingParams`, `baseFret`, and
`numLanes` from the `/game/start` response. It is passed to `GameLoop` alongside the other
dependencies.

**AC-2 — GameLoop ticks WaveScheduler every frame:**
Inside `GameLoop.runOneTick(timestamp)`, before calling `CartSystem.update()` and
`SceneManager.render()`:
```js
const game_now = timestamp - this._gameStartTime;
this._waveScheduler.tick(game_now, this._gameState.runtime.speedMultiplier);
const waves = this._waveScheduler.waves;
```
`CartSystem.update(game_now, gameState, waves)` and
`SafeZoneRenderer.update(waves, ...)` both receive `waves` from `WaveScheduler`.
`SceneManager.setWaves(waves, timestamp)` is called with the same array.

**AC-3 — main.js has no currentWaves variable:**
`main.js` no longer declares or maintains a `currentWaves` local variable.
The poll callback (`gameClient.startPolling`) no longer reads `pollState.game_state.waves`.
`scene.setWaves()` is no longer called from `main.js`.
`safeZoneRenderer.update()` is no longer called from `main.js`.

**AC-4 — Pause/resume is fire-and-forget:**
`gameClient.pause()` and `gameClient.resume()` are still called on pause/resume, but their
responses are ignored (`catch(() => {})` is sufficient). There is no code in `main.js` that
reads a clock value from the resume response or uses `Date.now()` to re-sync `gameStartTime`.

**AC-5 — Pause timing is JS-local:**
`GameLoop` accumulates paused time using `performance.now()` internally. On resume, `_gameStartTime`
is adjusted by the duration spent paused so that `game_now = timestamp - _gameStartTime` stays
continuous from the player's perspective. No network round-trip is involved.

Specifically: when phase transitions to PAUSED, record `_pausedAt = timestamp`. When phase returns
to PLAYING, `this._gameStartTime += timestamp - this._pausedAt; this._pausedAt = null`.

**AC-6 — Variant accept resets WaveScheduler:**
When `gameClient.acceptVariant()` succeeds, `waveScheduler.reset(resp.notes)` is called before the
next tick. Speed multiplier is reset to `1.0` in `gameState.runtime.speedMultiplier`.

**AC-7 — No regression in observable game behaviour:**
- Carts still appear and move toward the player
- Safe zones are still visible
- Collision still triggers GAME_OVER
- Pause/resume still freezes and unfreezes the scene correctly
- Variant accept still transitions to a new note sequence
- `window.__gameState.scene.waveCount` is updated from `waveScheduler.waves.length`

---

## Tasks / Subtasks

- [ ] Task 1: Read before changing (AC: all)
  - [ ] Read `static/game/GameLoop.js` fully — understand the current tick flow and constructor
  - [ ] Read `static/game/main.js` lines 380–620 (`start()` function) — map every reference to `currentWaves`, `gameStartTime`, `_pausedAt`, and the poll callback
  - [ ] Read `_bmad-output/planning-artifacts/architecture.md` "Revised Data Flow" in the amendment section

- [ ] Task 2: Update GameLoop constructor and start() (AC-1, AC-2)
  - [ ] Add `waveScheduler` to `GameLoop` constructor dependencies
  - [ ] Store `this._waveScheduler = waveScheduler` and `this._gameStartTime = 0`
  - [ ] `GameLoop.start(gameStartTime)`: store `this._gameStartTime = gameStartTime`
  - [ ] In `runOneTick`: compute `game_now`, call `this._waveScheduler.tick(game_now, speedMultiplier)`, pass `waves` to `CartSystem`, `SafeZoneRenderer`, `SceneManager`

- [ ] Task 3: Implement JS-local pause timing in GameLoop (AC-5)
  - [ ] Add `this._pausedAt = null` in constructor
  - [ ] On phase → PAUSED: `if (this._pausedAt === null) this._pausedAt = timestamp`
  - [ ] On phase PAUSED → PLAYING (resume detected in tick): `this._gameStartTime += timestamp - this._pausedAt; this._pausedAt = null`

- [ ] Task 4: Update main.js — construct WaveScheduler and pass to GameLoop (AC-1)
  - [ ] After `/game/start` response: `const waveScheduler = new WaveScheduler(notesResp.notes, notesResp.timing_params, notesResp.base_fret, notesResp.num_lanes)`
  - [ ] Pass `waveScheduler` to `new GameLoop({..., waveScheduler})`
  - [ ] Remove the `let currentWaves = notesResp.waves || []` line

- [ ] Task 5: Simplify main.js poll callback (AC-3, AC-4)
  - [ ] Remove `if (pollState.game_state && pollState.game_state.waves)` block
  - [ ] Remove the `scene.setWaves(currentWaves, now)` call from the RAF loop body in `main.js`
  - [ ] Remove the `safeZoneRenderer.update(currentWaves, ...)` call from the RAF loop body in `main.js`
  - [ ] Change `gameClient.pause()` / `gameClient.resume()` calls: drop any response handling, add `.catch(() => {})`
  - [ ] Remove clock-sync code: the `_pausedAt` accumulation in the RAF loop body of `main.js` (replaced by AC-5 in GameLoop)

- [ ] Task 6: Wire variant accept to WaveScheduler reset (AC-6)
  - [ ] In the `acceptVariant` success handler in `main.js`: call `waveScheduler.reset(resp.notes)`
  - [ ] Set `gameState.runtime.speedMultiplier = 1.0` (or equivalent path in gameState)

- [ ] Task 7: Update waveCount observable (AC-7)
  - [ ] In the RAF loop: `window.__gameState.scene.waveCount = waveScheduler.waves.length`

- [ ] Task 8: Run tests and manual smoke check (AC-7)
  - [ ] Run `rtk pytest tests/` — all Python tests pass
  - [ ] Run `npm test` — all JS unit tests pass
  - [ ] Start dev server; load plugin; verify carts move, safe zones show, pause/resume works, variant transitions work

---

## Notes

- `GameLoop` already has `this._lastTime` tracking. The `_pausedAt` logic in AC-5 is additive —
  it adjusts `_gameStartTime` rather than touching `_lastTime`. Keep both.
- The `_pausedAt` accumulation that currently lives in `main.js`'s RAF loop body (`_pausedAt`)
  must be REMOVED from main.js and replaced by GameLoop's version. Do not duplicate it.
- `SceneManager.setWaves()` is still called — now from `GameLoop.runOneTick()` instead of from
  `main.js`'s RAF loop. Check that `SceneManager` is accessible from `GameLoop` (it is already a
  constructor dependency: `this._sceneManager`).
- After this story, `main.js` no longer has a `currentWaves` variable. If `main.js` still has
  the `gameStartTime` variable for the countdown sequence, that's fine — it's the initial value
  passed to `GameLoop.start()`. But all ongoing `gameStartTime` adjustment lives inside `GameLoop`.
