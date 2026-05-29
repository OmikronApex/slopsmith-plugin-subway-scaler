# Story 8.2: Pause Button — Bottom-Right Persistent Trigger

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-2
**Story Key:** 8-2-pause-button-bottom-right-persistent-trigger
**Depends on:** 8-0 (HudShell), Epic 4-2 (pause overlay exists and is functional)

---

## Context

Epic 4-2 created the pause overlay (`PauseOverlay` in `overlay.js`) — a full-screen dialog with RESUME button and quit link, triggered by keyboard Escape (via Epic 4-4). But there is no **on-screen persistent pause trigger** visible during gameplay.

This story adds a pause button to the HUD: bottom-right corner, always visible during `PLAYING`, that calls the same pause mechanism as keyboard Escape. It registers with `HudShell` so it doesn't block canvas interaction.

---

## User Story

As a **player**,
I want a pause button always visible in the bottom-right corner during gameplay,
so I can pause the game with one click without searching for a keyboard shortcut.

---

## Acceptance Criteria

**AC-1 — Pause button rendered in bottom-right corner:**
Given the game scene is loaded and the HUD container exists,
When gameplay is active (`GameState.runtime.phase === PHASES.PLAYING`),
Then a pause button is rendered in the bottom-right corner of `.game-shell` (positioned by `HudShell.registerChild` at `bottom: 1rem; right: 1rem`),
And the button is a native `<button>` element with `class="hud-pause-btn"` and `aria-label="Pause game"`,
And the button has `pointer-events: auto` (overriding the HUD container's `pointer-events: none`),
And the button meets minimum 44×44px touch target size,
And the button uses the `--color-accent` icon (pause symbol: two vertical bars) on a `--color-bg-stage` background, with `1px solid var(--color-edge)` border — consistent with Night City palette,
And the pause icon is rendered as inline SVG within the button (no image file dependency).

**AC-2 — Click triggers pause:**
Given the player clicks the pause button,
When the click event fires,
Then `GameState.runtime.phase` transitions to `PHASES.PAUSED` (via the established pause mechanism — `GameLoop.pause()` or equivalent),
And the pause overlay (Epic 4-2) appears,
And the pause button remains visible behind the overlay (HudShell is visible during PAUSED per 8-0 AC-4).

**AC-3 — Button resumes interactivity after resume:**
Given the player resumes from the pause overlay,
When `GameState.runtime.phase` transitions to `PHASES.PLAYING`,
Then the pause button is interactive and visible in the HUD.

**AC-4 — Button hidden during game-over:**
Given the game is in `PHASES.GAME_OVER`,
When the HUD is hidden,
Then the pause button is hidden.

**AC-5 — Button hidden during idle:**
Given the session is in `PHASES.IDLE`,
When no game session is active,
Then the pause button is not rendered or is hidden.

**AC-6 — Keyboard focus:**
The pause button is reachable by Tab key (tabindex 0 by default on `<button>`),
And has visible focus ring in `--color-accent` on `:focus-visible`,
And pressing Enter or Space on the focused pause button triggers pause.

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/ui/PauseButton.js` (AC: 1, 2, 3, 4, 5, 6)
  - [x] 1.1 `PauseButton` class wrapping a `<button class="hud-pause-btn">` with `aria-label="Pause game"`
  - [x] 1.2 Inline SVG pause icon (two vertical bars ~24×24) inside button
  - [x] 1.3 Constructor takes `HudShell` instance and `onPause` callback
  - [x] 1.4 Calls `shell.registerChild('pause', this.el)`
  - [x] 1.5 Base styles applied inline or via CSS: `width: 44px; height: 44px; border-radius: 4px; cursor: pointer`
  - [x] 1.6 Click handler that calls `onPause` callback (which triggers the game's pause mechanism)
  - [x] 1.7 `destroy()` removes element

- [x] Task 2: Add pause button styles to `static/game/ui/hud.css` (AC: 1, 6)
  - [x] 2.1 `.hud-pause-btn` base styles — accent icon, stage background, edge border
  - [x] 2.2 `.hud-pause-btn:focus-visible` — accent focus ring
  - [x] 2.3 `.hud-pause-btn:hover` — brightness/opacity change for feedback
  - [x] 2.4 SVG fill uses `var(--color-accent)`, SVG inherits button dimensions

- [x] Task 3: Wire PauseButton into `main.js` (AC: 2)
  - [x] 3.1 Import PauseButton
  - [x] 3.2 Instantiate after HudShell, pass shell and a pause callback (use same mechanism as keyboard Escape handler — `GameLoop.pause()` or equivalent)
  - [x] 3.3 Ensure pause callback sets `GameState.runtime.phase = PHASES.PAUSED` and shows pause overlay

- [x] Task 4: Create unit tests `tests/unit/js/PauseButton.test.js` (AC: 1, 2, 3, 6)
  - [x] 4.1 Button created with correct class and aria-label
  - [x] 4.2 Click triggers onPause callback
  - [x] 4.3 Button has minimum 44px dimensions
  - [x] 4.4 SVG icon is present and uses correct fill colour
  - [x] 4.5 Destroy removes element

- [x] Task 5: Update E2E spec (AC: 1, 2, 4)
  - [x] 5.1 Uncomment pause button position test in `epic8-hud.spec.ts` — bottom-right corner assertion
  - [x] 5.2 Uncomment pause button click → pause overlay visible assertion
  - [x] 5.3 Run and verify passes

---

## Dev Notes

### Architecture Constraints

- **Pause mechanism:** The same function called by keyboard Escape (Epic 4-4 focus management). Look for how `main.js` handles Escape during `PHASES.PLAYING`. Likely a `pauseGame()` or `GameLoop.togglePause()` function. Do NOT duplicate pause logic — reuse the existing path.
- **`pointer-events: auto`:** Set by `HudShell.registerChild()` (8-0) — the `PauseButton` does NOT need to set this explicitly.
- **Z-index:** Button is inside `.hud-shell` (`z-index: 100`) and visible behind overlays (`z-index: 2000`). This is correct per AC-2 — the faint shape behind the overlay is acceptable.

### Pause Icon (Inline SVG)

```svg
<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--color-accent)">
  <rect x="6" y="4" width="4" height="16" rx="1"/>
  <rect x="14" y="4" width="4" height="16" rx="1"/>
</svg>
```

Use `fill="var(--color-accent, #FFB800)"` so it works even if the CSS variable isn't injected in test environments.

### Files to Create

- `static/game/ui/PauseButton.js` — NEW
- `tests/unit/js/PauseButton.test.js` — NEW

### Files to Modify

- `static/game/ui/hud.css` — add pause button styles
- `static/game/main.js` — wire PauseButton
- `tests/e2e/specs/epic8-hud.spec.ts` — uncomment pause button assertions
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Existing Patterns

- `overlay.js:PauseOverlay` — the dialog that appears when pause is triggered. It has its own RESUME button. The HUD pause button is the TRIGGER; the overlay is the UI shown after.
- Escape key handling in `main.js` (or wherever keyboard listeners are attached) — the pause button's `onPause` callback should call the same function that Escape does.
- `GameLoop.js` likely has `pause()`/`resume()` methods — check `GameLoop` for the canonical phase transition.

### Out of Scope

- Custom pause icon images (use inline SVG)
- Pause button position configuration
- Touch-and-hold or double-tap gestures
- Any behavior inside the pause overlay itself

---

### References

- Pause button ACs — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-2]
- Pause overlay (Epic 4-2) — [Source: `static/game/ui/overlay.js` — `PauseOverlay`]
- Escape key pause handling — [Source: `static/game/main.js` — keyboard event listener]
- Button hierarchy (UX-DR6) — [Source: UX spec, Button Hierarchy section]
- Touch target minimum 44×44px — [Source: UX spec, WCAG 2.5.5]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- PauseButton.js created with inline SVG icon, aria-label, click callback. Wired to pauseGame() in main.js. 8 unit tests pass.

### File List

- `static/game/ui/PauseButton.js` (NEW)
- `static/game/ui/hud.css` (UPDATE)
- `tests/unit/js/PauseButton.test.js` (NEW)
- `static/game/main.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)