# Story 4.2: Implement Pause Overlay

**Status:** ready-for-dev

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4.2
**Story Key:** 4-2-implement-pause-overlay

---

## User Story

As a player,
I want a pause overlay that appears when the game pauses,
So that I can resume my session or exit cleanly without losing game state.

---

## Acceptance Criteria

**AC-1 — Pause Overlay Appearance:**
- Pause overlay appears when `GameState.runtime.phase` transitions to `PHASES.PAUSED`
- Heading reads "PAUSED" (standard pause) or "Audio disconnected — reconnect to resume" (audio error variant)
- Contains RESUME primary button (large, accent color)
- Contains "Quit to Menu" tertiary text link (smaller, neutral color)
- Uses Night City color palette (bg-void, accent, text-primary)

**AC-2 — Animation:**
- Overlay enters with RGB-shift glitch animation (pause calibration: ~250ms entry, ~150ms exit)
- Reuses animation system from Story 4.1

**AC-3 — Resume Button Behavior:**
- Player activates RESUME via: click, tap, or Escape key
- `GameLoop.resume()` is called → `GameState.runtime.phase` transitions to `PHASES.PLAYING`
- Overlay exits with reverse glitch animation
- Focus returns to game canvas

**AC-4 — Quit to Menu Behavior:**
- Player activates "Quit to Menu" link
- Game canvas resets
- `GameState` is cleared
- Setup screen is shown
- **IMPORTANT:** `{ scale_id, difficulty, instrument_id }` from interrupted session is preserved in `localStorage`

**AC-5 — Audio Disconnect Variant:**
- When `GameLoop.js` catches `AudioDetectorError` and sets `PHASES.PAUSED`
- Overlay heading reads "Audio disconnected — reconnect to resume"
- RESUME button and "Quit to Menu" link are present
- Player can tap RESUME to attempt to resume (AudioDetector may re-initialize on next detection attempt)

---

## Tasks / Subtasks

- [ ] Task 1: Create PauseOverlay component (AC: 1, 2, 4)
  - [ ] Export `class PauseOverlay extends Overlay` or `function createPauseOverlay()`
  - [ ] Constructor accepts `isAudioError` boolean flag
  - [ ] Generate heading text based on flag ("PAUSED" vs "Audio disconnected")
  - [ ] Create RESUME button element with id/aria attributes
  - [ ] Create "Quit to Menu" text link
  - [ ] Inherit animation and focus management from Story 4.1 Overlay base class

- [ ] Task 2: Wire pause detection in GameLoop (AC: 1)
  - [ ] In `GameLoop.js`, detect when `GameState.runtime.phase` transitions to `PHASES.PAUSED`
  - [ ] Call `PauseOverlay.open()` with appropriate flag
  - [ ] Track which overlay is open (avoid stacking multiple overlays)

- [ ] Task 3: Implement RESUME button handler (AC: 3)
  - [ ] RESUME click → call `GameLoop.resume()`
  - [ ] RESUME Escape key → call `GameLoop.resume()`
  - [ ] On resume:
    - [ ] Overlay.close() triggers exit animation
    - [ ] After animation, overlay is removed from DOM
    - [ ] Focus returns to canvas
    - [ ] `GameState.runtime.phase` is now `PHASES.PLAYING`
    - [ ] GameLoop rAF continues from next tick

- [ ] Task 4: Implement Quit to Menu handler (AC: 4)
  - [ ] "Quit to Menu" click → begin exit sequence
  - [ ] Trigger overlay.close() animation
  - [ ] After animation completes:
    - [ ] Canvas element is hidden or reset
    - [ ] `GameState` object is cleared (reset to initial state)
    - [ ] Setup screen is shown
    - [ ] **Verify:** localStorage still contains `{ scale_id, difficulty, instrument_id }`
    - [ ] Setup form is pre-filled with stored values

- [ ] Task 5: Audio disconnect variant wiring (AC: 5)
  - [ ] In GameLoop.js catch block (for AudioDetectorError):
    - [ ] Pass `isAudioError: true` flag to PauseOverlay
    - [ ] Prevent update loop (already handled by PLAYING phase check)
    - [ ] Render loop continues (frozen frame visible behind overlay)

- [ ] Task 6: Test pause overlay (AC: 1-5)
  - [ ] Unit: PauseOverlay generates correct HTML and ARIA attributes
  - [ ] Integration: GameLoop detects PHASES.PAUSED, overlay opens
  - [ ] Integration: RESUME button triggers GameLoop.resume()
  - [ ] Integration: Focus trap works, Escape key handled
  - [ ] Integration: Quit to Menu clears canvas, shows setup screen
  - [ ] Integration: localStorage persists after quit
  - [ ] Manual: Verify heading text for standard pause vs audio error
  - [ ] Manual: Glitch animation plays on open/close

---

## Developer Context

### What This Story Is

This is the **pause overlay UX** — one of three overlays in Epic 4. It reuses the container and animation system from Story 4.1, so implementation is primarily connecting button handlers to existing game state transitions.

The story includes a special case: **audio disconnect** variant. When the audio system fails, the overlay heading changes but buttons remain the same. This is handled by passing a flag to the component.

### Architecture Compliance

**File Locations:**
- `static/game/ui/pause-overlay.js` — PauseOverlay component (alongside overlay.js, overlay-manager.js)
- Imported by `static/game/main.js` and called from `GameLoop.js`

**Phases and State:**
- Triggered by: `GameState.runtime.phase === PHASES.PAUSED`
- RESUME sets phase back to: `PHASES.PLAYING`
- Quit to Menu resets: `GameState` + shows setup screen

**No Additional Imports Required:**
- Uses `Overlay` base class from Story 4.1
- Does NOT import GameState directly (receive state updates via phase transitions)
- Uses `GameLoop.resume()` public method

### Previous Story Intelligence (from Epic 3)

**GameLoop Error Handling Pattern (Story 3.4):**
```js
catch (err) {
  if (err.constructor?.name === 'AudioDetectorError') {
    this._gameState.runtime.phase = PHASES.PAUSED;
  } else {
    console.error('Unexpected error in game loop:', err);
  }
}
```
When audio error occurs, phase is set to PAUSED. Your pause overlay should detect this and show the "Audio disconnected" heading.

**Canvas Lifecycle (Story 3.1):**
When quitting to menu, the canvas must be reset/hidden. Coordinate with `main.js` to handle canvas teardown before setup screen re-appears.

### Critical Implementation Notes

**Focus Management After Resume:**
After overlay closes and focus returns to canvas, the canvas element should receive focus programmatically (if it's an HTMLCanvasElement, focus may not work as expected). Consider:
```js
const gameContainer = document.getElementById('game-container');
if (gameContainer) gameContainer.focus();
```
Or use `document.body.focus()` as fallback.

**localStorage Preservation:**
When quitting to menu, `localStorage` is already populated by Story 1.6 (setup.js). Verify that quit flow does NOT clear or overwrite it. The setup screen will read the same values and re-populate the form.

**Escape Key Handling:**
Escape should resume the game. This must be handled in PauseOverlay component's event listener (not globally, to avoid interfering with other overlays in future stories).

---

## Testing Requirements

**Unit Tests:**
- [ ] PauseOverlay generates correct heading for standard pause
- [ ] PauseOverlay generates correct heading for audio error (`isAudioError: true`)
- [ ] RESUME button has correct aria attributes
- [ ] "Quit to Menu" link has correct aria attributes

**Integration Tests:**
- [ ] GameLoop detects `PHASES.PAUSED` → PauseOverlay.open() called
- [ ] RESUME button click → `GameLoop.resume()` → phase becomes `PHASES.PLAYING`
- [ ] RESUME Escape key → `GameLoop.resume()`
- [ ] Overlay animation completes before removal
- [ ] Focus returns to canvas after resume
- [ ] "Quit to Menu" click → canvas resets, setup screen appears
- [ ] After quit, `localStorage` still contains settings
- [ ] Setup form pre-filled after quit (Story 1.6 integration)

**Manual Tests:**
- [ ] Play game, pause mid-session, resume → game continues from same state
- [ ] Pause, press Escape → overlay closes, game resumes
- [ ] Pause, click "Quit to Menu" → setup screen appears with last settings
- [ ] Trigger audio error (disconnect mic), pause overlay shows "Audio disconnected" heading
- [ ] Audio error pause, click RESUME → game tries to resume (audio still may fail, but phase changes)

---

## Definition of Done

- [ ] `pause-overlay.js` created with PauseOverlay component
- [ ] PauseOverlay extends Overlay base class, inherits animation
- [ ] Audio disconnect variant handled (isAudioError flag)
- [ ] RESUME button handler wired to GameLoop.resume()
- [ ] Escape key triggers RESUME
- [ ] "Quit to Menu" handler wired to canvas reset + setup screen show
- [ ] localStorage verified to persist after quit
- [ ] Focus trap and restoration tested
- [ ] Animation timing verified (250ms entry, 150ms exit)
- [ ] All integration tests pass
- [ ] PR reviewed

---

## Change Log

- 2026-05-21: Story created. Pause overlay and audio disconnect variant planned per UX-DR10.
