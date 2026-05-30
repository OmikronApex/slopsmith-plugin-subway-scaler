# Story 10.2: SDK Lifecycle — Hub Container with Own Setup Screen

Status: review

## Story

As a **player**,
I want to click Subway Scaler's tile in the hub, see a brief launch confirm, then choose scale/root/instrument/difficulty in the game's own setup,
So that difficulty selection stays exactly where it is — no separate SDK picker step.

## Acceptance Criteria

1. **SDK modifier picker** — Tile click shows title + "Start" button only (no modifier rows, no modifiers in `plugin.json`). Click Start to proceed.

2. **`start()` contract** — SDK calls `start({container, modifiers, sdk})`: `container` is `<div class="mg-game-root">` inside SDK stage; `modifiers` is `{}` (empty). Game mounts full setup (scale, root, instrument, difficulty) inside container. Difficulty selector present (Easy default, Medium, Hard).

3. **Game start** — Player selects options, clicks START → `GameState.session.difficulty` set from setup control → game loop begins. No regression from Epic 1/3.

4. **Quit** — SDK Quit button clicked → `GameState.runtime.phase` → `GAME_OVER` → `SdkBridge.end()` called with best score + `meta: { reason: 'quit' }`.

5. **`stop()`** — Hub navigates away → SDK calls `stop()` → existing `cleanup()` runs (audio stop, GameState reset, timers cleared).

6. **Inert without SDK** — No `start()` call ever arrives → no setup screen or game code executes.

## Tasks / Subtasks

- [x] Implement `start({container, modifiers, sdk})` in `SdkBridge.js` (AC: #2)
  - [x] Mount setup screen DOM into `container` div instead of plugin's own page
  - [x] Store `sdk` reference for `end()` and `createContinuous()` calls
  - [x] Wire difficulty selector from setup screen → `GameState.session.difficulty`
- [x] Implement `stop()` in `SdkBridge.js` (AC: #5)
  - [x] Call existing `cleanup()` flow
- [x] Override SDK Quit button onclick (SDK hardcodes score: 0) (AC: #4)
  - [x] Replace `document.getElementById('mg-stage-quit').onclick` handler within `start()`
- [x] Tests (AC: #1-#6)

## Dev Notes

### Architecture Compliance

- This is the **only** entry point — no standalone mode. Setup screen must work mounted inside a div of unknown size (SDK stage provides the constraint).
- `start()` is called by the SDK's modifier picker callback after user clicks Start. The picker shows title+Start only because `plugin.json` has no `modifiers`.
- Setup screen in hub mode: render into `container` (a `<div>` that already exists). In earlier standalone mode it rendered into the plugin's own page — that path is gone.
- `stop()` must handle cleanup idempotently — SDK may call it after `end()` triggers its own cleanup.

### SDK Quit Button Override

SDK hardcodes Quit as `end({score: 0, ...})`. Within `start()`, replace onclick:
```js
document.getElementById('mg-stage-quit').onclick = () => {
  GameState.runtime.phase = PHASES.GAME_OVER;
  SdkBridge.end({ score: SdkBridge.bestScore, durationMs: ..., modifiers, meta: { reason: 'quit' } });
};
```

### Files to Touch

| File | Action |
|---|---|
| `static/game/SdkBridge.js` | UPDATE — add `start()`, `stop()`, Quit handler |
| `static/game/main.js` | UPDATE — export setup-screen rendering as mountable function |
| `static/game/GameState.js` | NO CHANGE — difficulty field exists |

### Testing

- Vitest with mock `start({container, modifiers, sdk})`: verify setup screen mounts into container, `GameState.session.difficulty` set correctly
- Vitest: verify `stop()` calls cleanup, no orphaned timers
- E2E: full hub flow — picker → setup → play → quit → summary

### References

- [Source: epics.md § Epic 10 — Story 10-2]
- [Source: slopsmith-plugin-minigames/screen.js lines 539-628 (start/stop lifecycle)]
- [Source: slopsmith-plugin-minigames/screen.js lines 604-612 (Quit button hardcoded onclick)]
- [Source: Architecture doc § Phase Transitions ownership table]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- SdkBridge.start() calls bootstrap(container) so game mounts into SDK hub container
- Stores sdk, modifiers references for createContinuous and end() calls
- Quit button override in start() calls SdkBridge.end() with best score instead of SDK's hardcoded score:0
- stop() calls end() (with reentry guard) then stopPitchDetection()
- main.js checks window.__slopsmithSdkBridge for audio handle to skip startAudio in hub mode

### File List
- static/game/SdkBridge.js
- static/game/main.js

### Change Log
- 2026-05-30: Implemented SDK lifecycle start/stop/quit override (Story 10-2)