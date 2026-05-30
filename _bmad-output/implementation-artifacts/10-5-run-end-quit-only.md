# Story 10.5: Run end() — Auto-Submit via SDK on Quit Only

Status: review

## Story

As the **game engine**,
I want to call `window.slopsmithMinigames.end()` only when the player quits the game session,
So that Subway Scaler's own game-over overlay and Play Again flow remain intact across replay attempts, with only the best score of the session submitted to the leaderboard.

## Acceptance Criteria

1. **Game-over → no end()** — Player dies → own game-over overlay (Epic 4) shown. `end()` NOT called. `SdkBridge.bestScore` records score if > previous best.

2. **Play Again** — Game-over overlay → "Play Again" → scene/score/wave reset (Epic 3). `createContinuous()` continues running. `bestScore` persists.

3. **Quit → end() with best score** — Player clicks SDK Quit → `end()` called once with:
   ```js
   { score: bestScore, durationMs: ..., modifiers: { difficulty }, meta: { scale_id, root_midi, instrument_id, notes_played, accuracy_pct, attempts } }
   ```
   Fire-and-forget.

4. **SDK summary** — After `end()`, SDK shows runSummary modal with best score, XP gained, best. Profile strip updates. `bestScore` resets to 0.

5. **stop() → end() + reentry guard** — Hub navigates away → `stop()` calls `end()` with best score first. Reentry guard prevents `end()` → `stop()` → `end()` loop:
   ```js
   let _ended = false;
   function stop() {
     if (_ended) return;
     _ended = true;
     window.slopsmithMinigames.end({...});
   }
   ```

6. **SDK unavailable** — No `end()` call attempted. Own game-over overlay works normally.

## Tasks / Subtasks

- [x] Add best-score tracking to `SdkBridge.js` (AC: #1-2)
  - [x] `bestScore = 0`, updated on game-over via `onGameOver(score)`
  - [x] `sessionStartTime = performance.now()` set in `start()`
  - [x] `attempts` counter incremented each game-over
- [x] Implement `SdkBridge.end(result)` method (AC: #3)
  - [x] Compute duration, modifiers, meta
  - [x] Call `window.slopsmithMinigames.end({...})`
  - [x] Reset `bestScore` to 0 after successful submission
- [x] Override SDK Quit button (AC: #3, #4)
  - [x] Replace `document.getElementById('mg-stage-quit').onclick`
- [x] Implement `stop()` reentry guard (AC: #5)
- [x] Add `meta.attempts` and accuracy to end payload (AC: #3)
- [x] Tests (AC: #1-6)

## Dev Notes

### Architecture Compliance

- SDK's `end()` internally calls: `submitRun()` → `getLeaderboard()` → `runSummary()` — all async, non-blocking
- SDK summary renders in `mg-summary` modal with "Play Again" that calls fresh `start()`
- Game-over overlay (Epic 4) must be hidden when SDK summary is active (check `mg-summary` visibility)
- `durationMs` = `Math.round(performance.now() - sessionStartTime)` — total time across all replays, matching JS-owned timing per Architecture amendment
- `summaryHtml` rendered in `mg-summary-extra` via innerHTML (trusted, same-origin content)

### SDK Quit Override Details

SDK code (screen.js line 607) hardcodes score: 0. Override:
```js
const quitBtn = document.getElementById('mg-stage-quit');
if (quitBtn) {
  quitBtn.onclick = () => {
    if (SdkBridge._ended) return;
    SdkBridge.end();
  };
}
```

### Reentry Guard

Two paths trigger `end()`:
1. Quit button click (user-initiated)
2. `stop()` called by SDK (hub navigates away)

Both share the `_ended` flag. If user clicks Quit first → `end()` called → SDK calls `stop()` → guard prevents double-submit. If hub navigates without Quit → `stop()` calls `end()`.

```js
// SdkBridge.js
let _ended = false;

async function end() {
  if (_ended) return;
  _ended = true;
  // ... compute payload ...
  await window.slopsmithMinigames.end(payload).catch(e => console.warn(e));
  bestScore = 0;
}

async function stop() {
  await end();
  cleanup();
}
```

### Files to Touch

| File | Action |
|---|---|
| `static/game/SdkBridge.js` | UPDATE — add `bestScore`, `end()`, `stop()`, reentry guard, Quit override |
| `static/game/main.js` | UPDATE — wire game-over handler to update `bestScore` instead of calling `end()` |

### Testing

- Vitest with mock SDK: multiple game-overs (scores [200, 500, 300]) → verify `bestScore` = 500
- Vitest: `end()` called once with correct payload shape
- Vitest: `stop()` → `end()` reentry guard prevents double-call
- Vitest: SDK unavailable → no call, no crash
- E2E: full hub → play → die → Play Again → die → Quit → SDK summary shows best score

### References

- [Source: epics.md § Epic 10 — Story 10-5]
- [Source: slopsmith-plugin-minigames/screen.js lines 631-693 (end() implementation)]
- [Source: slopsmith-plugin-minigames/screen.js lines 322-373 (runSummary)]
- [Source: Architecture doc § JS-owned timing amendment]
- [Source: Epic 4 — game-over overlay]
- [Source: Epic 3 — game loop restart]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- SdkBridge._ended flag prevents double-submit; stays true after end() until new start()
- main.js calls window.__slopsmithSdkBridge.onGameOver(finalScore) before showing game-over overlay
- onGameOver() tracks bestScore via Math.max, increments attempts
- end() submits {score: bestScore, durationMs, modifiers: {difficulty}, meta: {notes_played, accuracy_pct, attempts}}
- stop() calls end() then stopPitchDetection() — reentry guard prevents double-call

### File List
- static/game/SdkBridge.js
- static/game/main.js
- tests/unit/js/SdkBridge.test.js

### Change Log
- 2026-05-30: Implemented run end() quit-only with best-score tracking and reentry guard (Story 10-5)