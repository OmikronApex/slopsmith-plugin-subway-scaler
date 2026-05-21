# Story 4.3: Implement Game Over Overlay

**Status:** ready-for-dev

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4.3
**Story Key:** 4-3-implement-game-over-overlay

---

## User Story

As a player,
I want a game-over overlay that shows my final score and lets me restart immediately or return to settings,
So that I can get back into practice with one tap or adjust settings before my next attempt.

---

## Acceptance Criteria

**AC-1 — Game Over Overlay Appearance:**
- Overlay appears when `GameState.runtime.phase` transitions to `PHASES.GAME_OVER`
- Shows final score in large, prominent display (color: `var(--color-accent)`)
- Shows context line: personal best or delta from last run (via localStorage)
- Contains RESTART primary button (large, accent color)
- Contains MAIN MENU secondary outline button (smaller, neutral color)
- Uses Night City color palette (bg-void, accent, text-primary)

**AC-2 — Animation Timing:**
- Overlay enters with RGB-shift glitch animation (game-over calibration: ~180ms entry, ~100ms exit)
- Reuses animation system from Story 4.1

**AC-3 — RESTART Button Behavior:**
- Player activates RESTART via click, tap, or button focus
- `GameState` is reset to initial state
- `main.js` re-calls `/game/session-config` with SAME settings (scale_id, difficulty, instrument_id) and NEW randomised root MIDI (fret 5–8)
- Game loop restarts
- **CRITICAL:** Character running within **500ms** of the button tap (performance requirement)

**AC-4 — MAIN MENU Button Behavior:**
- Player activates MAIN MENU button
- Game canvas resets
- Setup screen is shown with last-session settings pre-filled (from localStorage)

**AC-5 — Score Context and Progression:**
- Game-over overlay shows current session score (e.g., "1,250")
- Context line shows delta from previous session IF localStorage has a previous score (e.g., "+450 from last")
- On next restart (AC-3), the context line for the NEXT game-over shows delta from THIS run's score
- **localStorage tracking:** After game-over, save final score to localStorage key `subway-scaler-last-score`

**AC-6 — Escape Key Behavior:**
- Escape key press does NOTHING (cannot dismiss game-over via Escape)
- Explicit button action (RESTART or MAIN MENU) is required to exit game-over
- This prevents accidental dismissal after losing

---

## Tasks / Subtasks

- [ ] Task 1: Create GameOverOverlay component (AC: 1, 2)
  - [ ] Export `class GameOverOverlay extends Overlay` or factory function
  - [ ] Constructor accepts `finalScore` and `previousScore` (nullable)
  - [ ] Generate heading (none, or large "GAME OVER" if needed)
  - [ ] Display final score in large text (color: accent)
  - [ ] Generate context line: "Personal Best" if first run, or "+X from last" if delta > 0, or "-X from last" if delta < 0
  - [ ] Create RESTART button (large, primary)
  - [ ] Create MAIN MENU button (smaller, outline style)
  - [ ] Inherit animation from Story 4.1 Overlay base class

- [ ] Task 2: Wire game-over detection in GameLoop (AC: 1)
  - [ ] In `GameLoop.js`, detect when `GameState.runtime.phase` transitions to `PHASES.GAME_OVER`
  - [ ] Call `GameOverOverlay.open(finalScore, previousScore)` at the moment phase changes
  - [ ] Ensure render loop continues (frozen final frame visible behind overlay)

- [ ] Task 3: Implement RESTART button handler (AC: 3, 5)
  - [ ] RESTART click → begin restart sequence
  - [ ] **Save current score to localStorage key `subway-scaler-last-score`**
  - [ ] Reset `GameState` to initial state
  - [ ] Call `main.js` restart handler with SAME session settings
  - [ ] `main.js` re-calls `/game/session-config?scale_id=...&root_midi=<NEW RANDOM>&instrument_id=...`
  - [ ] Game loop starts from next rAF tick
  - [ ] **Measure:** Time from button tap to character visible and moving should be < 500ms

- [ ] Task 4: Implement MAIN MENU button handler (AC: 4)
  - [ ] MAIN MENU click → begin exit sequence
  - [ ] Trigger overlay.close() animation
  - [ ] After animation completes:
    - [ ] Canvas element is hidden/reset
    - [ ] `GameState` is cleared
    - [ ] Setup screen is shown
    - [ ] Setup form pre-filled with stored session settings

- [ ] Task 5: localStorage score tracking (AC: 5)
  - [ ] Read `localStorage` key `subway-scaler-last-score` to determine context line
  - [ ] Calculate delta: `currentScore - lastScore`
  - [ ] Display: "+X from last" (if delta > 0), "Personal Best!" (if first run), "-X from last" (if delta < 0)
  - [ ] After RESTART, new score is saved for next game-over
  - [ ] Verify localStorage is NOT cleared on quit (Story 4.2) or setup (Story 1.6)

- [ ] Task 6: Escape key suppression (AC: 6)
  - [ ] In GameOverOverlay component, intercept Escape key in keydown listener
  - [ ] `event.preventDefault()` on Escape to block default behavior
  - [ ] Do NOT call resume() or close() on Escape

- [ ] Task 7: Test game-over overlay (AC: 1-6)
  - [ ] Unit: GameOverOverlay generates correct score/context displays
  - [ ] Unit: Delta calculation correct for "personal best", "+X", "-X" cases
  - [ ] Integration: CartSystem collision → phase becomes GAME_OVER, overlay opens
  - [ ] Integration: RESTART button → game restarts, score saved, context line updated next run
  - [ ] Integration: RESTART completes within 500ms (use performance.mark/measure)
  - [ ] Integration: MAIN MENU button → canvas resets, setup appears
  - [ ] Integration: Escape key does NOT dismiss overlay
  - [ ] Manual: Glitch animation (180ms entry, 100ms exit) looks correct
  - [ ] Manual: Play session, lose, restart, lose again, verify delta shows on second game-over

---

## Developer Context

### What This Story Is

This is the **game-over overlay UX** — the final overlay in Epic 4. Like Story 4.2, it reuses the container and animation from Story 4.1. The unique aspect is **score tracking and progression**: the overlay must display delta from previous runs, and RESTART must be blazingly fast (< 500ms).

### Architecture Compliance

**File Locations:**
- `static/game/ui/game-over-overlay.js` — GameOverOverlay component
- Imported by `main.js` and called from `GameLoop.js`

**Phase Transition:**
- Triggered by: `GameState.runtime.phase === PHASES.GAME_OVER` (set by CartSystem collision detection)
- RESTART: resets phase to `PHASES.IDLE` and restarts game loop
- MAIN MENU: clears GameState, shows setup screen

**localStorage Keys Used:**
- `subway-scaler-settings` (already used by Story 1.6): stores `{ scale_id, difficulty, instrument_id }`
- `subway-scaler-last-score` (NEW): stores final score from previous session

### Previous Story Intelligence (from Epic 2 & 3)

**CartSystem Collision Detection (Story 2.2):**
When a cart collides with character:
```js
GameState.runtime.phase = PHASES.GAME_OVER;
```
Your game-over overlay should detect this transition and open immediately.

**GameLoop Phase Check (Story 3.4):**
When phase is GAME_OVER, render loop continues but update loop stops:
```js
if (phase === PHASES.GAME_OVER) {
  this._sceneManager.render(this._gameState);
  return;
}
```
Final frame remains visible behind your overlay.

**Score Increment (Story 2.2):**
Score is incremented by CartSystem.update():
```js
GameState.runtime.score += 100 * difficultyMultiplier;
```
Your overlay receives this final score value from GameState.

### Critical Implementation Notes

**Performance: 500ms Constraint**
The game must be "running" (character moving) within 500ms of RESTART tap. This means:
- Overlay animation + closedown: ~150ms max
- GameState reset: ~10ms
- /game/session-config API call: ~100-200ms (network dependent)
- GameLoop re-initialization: ~20ms
- First rAF frame rendered: ~10ms

If the backend is slow, consider **optimistic restart** (reset GameState immediately, then call API in parallel).

**Score Delta Calculation:**
```js
const lastScore = parseInt(localStorage.getItem('subway-scaler-last-score')) || 0;
const delta = currentScore - lastScore;
let contextLine;
if (lastScore === 0) {
  contextLine = 'Personal Best!';
} else if (delta > 0) {
  contextLine = `+${delta} from last`;
} else if (delta < 0) {
  contextLine = `${delta} from last`; // Already negative
} else {
  contextLine = 'Tied with last';
}
```

**Restart Sequence:**
1. Button tap
2. Save currentScore to localStorage
3. Overlay.close() animation begins (~100ms)
4. During/after animation: reset GameState
5. Call `/game/session-config` with new root MIDI
6. On response: initialize TrackSystem, CartSystem, DifficultyManager with new config
7. GameLoop starts rAF from next frame
8. Character should be visible and moving < 500ms from step 1

---

## Testing Requirements

**Unit Tests:**
- [ ] GameOverOverlay displays final score correctly
- [ ] GameOverOverlay calculates context line: "Personal Best" (first run)
- [ ] GameOverOverlay calculates context line: "+X from last" (improvement)
- [ ] GameOverOverlay calculates context line: "-X from last" (decline)
- [ ] Escape key does NOT trigger close

**Integration Tests:**
- [ ] CartSystem collision → phase becomes GAME_OVER
- [ ] GameLoop detects phase → GameOverOverlay.open() called
- [ ] RESTART button → GameState reset, score saved, session-config called
- [ ] RESTART completes within 500ms (performance marker check)
- [ ] Next game-over shows correct delta from previous score
- [ ] MAIN MENU button → canvas reset, setup appears
- [ ] localStorage persists after MAIN MENU quit

**Manual Tests:**
- [ ] Play session to loss, overlay appears with correct score
- [ ] Restart game within 500ms (visual check: character moving)
- [ ] Play second session, lose again, context line shows delta from first session
- [ ] Try pressing Escape on game-over overlay → nothing happens
- [ ] Quit to menu, start new session with different settings, lose, restart → score delta tracked correctly

**Performance:**
- [ ] Measure time from RESTART tap to first GameLoop.render() call: must be < 500ms
- [ ] Use `performance.mark('restart-start')` and `performance.measure()` in tests

---

## Definition of Done

- [ ] `game-over-overlay.js` created with GameOverOverlay component
- [ ] GameOverOverlay extends Overlay base class
- [ ] Final score displayed prominently in accent color
- [ ] Context line calculated and displayed (Personal Best / +X / -X)
- [ ] RESTART button wired to: save score, reset GameState, call /game/session-config
- [ ] RESTART completes within 500ms
- [ ] MAIN MENU button wired to canvas reset + setup show
- [ ] Escape key suppressed (overlay cannot be dismissed via Escape)
- [ ] localStorage `subway-scaler-last-score` tracked and displayed
- [ ] Animation timing verified (180ms entry, 100ms exit)
- [ ] All integration tests pass
- [ ] Performance measured and < 500ms verified
- [ ] PR reviewed

---

## Change Log

- 2026-05-21: Story created. Game-over overlay with score tracking and 500ms restart target planned per UX-DR11.
