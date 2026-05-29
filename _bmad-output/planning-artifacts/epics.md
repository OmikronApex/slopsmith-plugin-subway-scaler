---
stepsCompleted: [1, 2, 3, 4]
status: validated
partyModeRefinements:
  - Orientation locked: low E bottom row, high E top row
  - Solid dark backplate: background rgba(12, 12, 18, 0.85), PS1-era 2px border
  - Data contract: fretBox.render({notes, scale_id, root_midi, instrument_id}) — same shape as /game/session-config response
  - Snap rebuild on transition: DOM wipe + rebuild, no morph
  - Variant HUD transition: fade-out 200ms on accept, hidden during breather/promote, rebuild while hidden, fade-in 200ms on active
  - Basic/Full detail toggle in pause menu with telemetry
  - Root note: bright fill + accent yellow center dot, not double-border ring
  - Note boxes: 2-3px border at full string colour, fill at 70-80% opacity with brightness boost
  - Fret range: sliding window 4-5 frets anchored to root, Math.max(0, minFret - 1) padding, empty-notes guard
  - String-row inversion: row = stringCount - 1 - note.string
inputDocuments:
  - prds/prd-subway-scaler.md
  - architecture.md
  - ux-design-specification.md
---

# slopsmith-plugin-subway-scaler - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for slopsmith-plugin-subway-scaler, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories. This is an **amendment** to the existing epics.md — the previously existing Epic 0–7 structure is preserved; this document adds **Epic 8** (in-game HUD overlay).

## Requirements Inventory

### Functional Requirements

**FR-001:** Session Start — Player selects scale, root note, difficulty.
**FR-002:** Note Visualization — Frets appear as colored safe zones on tracks.
**FR-003:** Correct Note Detection — Audio input triggers character movement.
**FR-004:** Score Calculation — Points based on difficulty + timing. Base: 100 × difficulty multiplier. Early/late hits: no penalty.
**FR-005:** Difficulty Scaling — Speed and cart frequency increases with score.
**FR-006:** Collision Detection — Cart collision ends session with game over. Final score displayed.
**FR-007:** Visual Feedback — Sparkle/glow effects on correct notes.
**FR-008:** Variant Switching — Switch root note mid-session.

### Non-Functional Requirements

**NFR-011:** 60 FPS target — render loop at 60fps minimum.
**NFR-012:** Memory usage below 500MB.
**NFR-013:** Error recovery — invalid note: log and ignore; audio disconnect: reconnect or show error.
**NFR-014:** Session state — save to local storage.
**NFR-015:** Audio input options — professional interfaces, USB-MIDI, Slopsmith centralized detection.
**NFR-016:** Settings persistence — save last scale, root note, difficulty, audio device.

### Additional Requirements (Architecture)

- Score display is an HTML overlay positioned above Three.js canvas (top-right corner per UX spec)
- GameLoop.js owns `runtime.phase` management and character position
- CartSystem.js writes `runtime.score` in GameState
- Score increment is frame-synchronised with detection events
- HUD elements (score, pause button) must not intercept mouse/touch events directed at the canvas
- Overlay motion grammar: RGB-shift glitch entry/exit for pause and game-over overlays
- No bundler in stack — plain HTML+CSS+JS, tokens.js as single source of truth for colours

### UX Design Requirements

**UX-DR1:** Score Display — Top-right corner, always visible during gameplay. Peripheral-readability, `color-text-primary`, monospace bold, no background (canvas visible behind). Increment flash (~150ms `color-accent` pulse) on score change. `aria-live="polite"` for screen readers.

**UX-DR2:** Pause Button — Located bottom-right of game shell, persistent during gameplay. Single-action RESUME button is the primary affordance on the pause overlay itself (Epic 4-2). The trigger button to *enter* pause is a separate icon in bottom-right HUD position, but the UX spec does not define a dedicated persistent pause-button icon — this epic defines it.

**UX-DR3:** Fret Box / Finger Pattern — Top-left corner, visual diagram showing strings (horizontal lines or circles) and fret numbers for the current scale position. Must map to the active track's root fret and string layout. Not yet defined in any existing UX or architecture document — this epic originates this requirement.

**UX-DR4:** Overlay Container — Shared wrapper for Pause, Game Over, Audio Disconnect overlays. Full-viewport, `color-bg-void` backdrop (~85% opacity), centered content column. RGB-shift glitch entry (~200ms) and exit (~100ms). Focus trapped when open.

**UX-DR5:** String Color System — Rocksmith convention: Red (lowest) → Yellow → Blue → Orange → Green → Purple → Pink. Defined in `tokens.js` as `STRING_COLORS` hex constants.

**UX-DR6:** Button Hierarchy — Three levels: Primary (solid accent fill), Secondary (outline accent), Tertiary (text-only disabled colour). One primary per screen. Minimum 44px height, focusable, keyboard-reachable.

**UX-DR7:** Responsive Shell — Fixed 16:9 aspect ratio `game-shell`, height-driven, centered horizontally. Overlays anchored to shell (`position: absolute; inset: 0`). Horizontal dead space filled with `color-bg-void`.

**UX-DR8:** Accessibility — WCAG 2.1 AA for HTML surfaces. Focus trapped on overlays. Escape on Pause → RESUME. `role="dialog"`, `aria-modal="true"`. `@media (prefers-reduced-motion: reduce)` replaces glitch with opacity fade.

### FR Coverage Map

| Requirement | Epic | Coverage |
|---|---|---|
| FR-004 (Score Calculation) | Epic 8 | HUD score display reads `runtime.score`, renders in top-right corner |
| FR-006 (Game Over — score display) | Epic 8 | Score display remains visible through pause/game-over states |
| FR-007 (Visual Feedback) | Epic 3, Epic 8 | Sparkle/glow on correct note (E3); score flash on increment (E8) |
| NFR-011 (60 FPS) | Epic 8 | HUD overlay must not impact render loop (non-blocking HTML layer) |
| UX-DR1 (Score Display) | Epic 8 | Top-right score overlay |
| UX-DR2 (Pause Button) | Epic 8 | Bottom-right persistent pause button |
| UX-DR3 (Fret Box) | Epic 8 | Top-left finger-pattern visual diagram |
| UX-DR4 (Overlay Container) | Epic 4 | Pause/game-over overlay shared wrapper |
| UX-DR5 (String Colors) | Epic 7, Epic 8 | Fret box uses STRING_COLORS |
| UX-DR6 (Button Hierarchy) | Epic 4, Epic 8 | Pause button = primary style |
| UX-DR7 (Responsive Shell) | Epic 4, Epic 8 | HUD anchored to game-shell |
| UX-DR8 (Accessibility) | Epic 4, Epic 8 | Focus, keyboard, reduced-motion |

## Epic List

### Epic 0: E2E Testing Infrastructure
*(existing — unchanged)*

### Epic 0.5: E2E Coverage Review
*(existing — unchanged)*

### Epic 1: Session Setup & Core Services
*(existing — unchanged)*

### Epic 2: Game Engine Modules — CartSystem, DifficultyManager, WaveScheduler
*(existing — unchanged)*

### Epic 3: 3D Scene & Core Game Loop
*(existing — unchanged)*

### Epic 4: Session UX & Accessibility
*(existing — unchanged)*

### Epic 5: Variant Track System
*(existing — unchanged)*

### Epic 6: Variant Transition Cinematic & Handoff
*(existing — unchanged)*

### Epic 7: Visual Polish — World Environment & Procedural Scenery
*(existing — unchanged)*

---

## Epic 8: In-Game HUD Overlay — Score, Pause Button & Fret Box

Players see a polished in-game overlay during gameplay with three persistent elements: current score in the top-right corner, a pause button in the bottom-right corner, and a fret-box finger-pattern diagram in the top-left corner — all fitting the Night City PS1 demake aesthetic.

**User Outcomes:**
- Score is always visible at a peripheral glance during gameplay — top-right corner, monospace bold, with a brief accent-colour flash on each increment
- Pause is always one tap/click away — bottom-right corner button triggers the pause overlay (Epic 4-2), never interferes with canvas interaction
- Fret-box diagram in the top-left shows the active scale's finger pattern: strings as horizontal lines, fret number labels, and dot indicators marking which frets to play — updated when the scale/root changes (including variant transitions)
- All three HUD elements are HTML overlays anchored to the 16:9 game shell — crisp at any resolution, no Three.js texture overhead for dynamic text
- HUD uses Night City palette tokens from `tokens.js` and the vendored monospace font
- HUD elements do not intercept mouse/touch events intended for the Three.js canvas below (`pointer-events: none` on the HUD container, explicit `pointer-events: auto` on the pause button)
- On `prefers-reduced-motion`, the score increment flash transitions to a simpler approach than animation to respect the user's preferences.

**Depends on:** Epic 4 (pause overlay exists and is functional), Epic 7 (tokens.js has the full Night City palette), the game shell and overlay container pattern established in EPIC 4.

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 8-0 | HUD Shell — Overlay Container & Positioning Foundation | todo | Epic 4, Epic 7 |
| 8-1 | Score Display — Top-Right Corner Overlay | todo | 8-0 |
| 8-2 | Pause Button — Bottom-Right Persistent Trigger | todo | 8-0, Epic 4-2 |
| 8-3 | Fret Box — Top-Left Finger Pattern Diagram | todo | 8-0 |
| 8-4 | HUD Update on Variant Transition | todo | 8-3, Epic 6 |
| 8-5 | HUD Detail Toggle — Basic / Full Mode | todo | 8-3, Epic 4-2 |
| 8-6 | Accessibility Audit — HUD Focus, ARIA & Reduced Motion | todo | 8-1, 8-2, 8-3, 8-5 |

---

### Story 8-0: HUD Shell — Overlay Container & Positioning Foundation

As a **developer**, I want a shared HUD shell positioned over the Three.js canvas and anchored to the 16:9 game shell, so that all HUD elements (score, pause button, fret box) are consistently positioned, do not block canvas interaction, and respond to container resize.

**Acceptance Criteria:**

**Given** the game scene loads and gameplay is active
**When** the HUD container is rendered
**Then** the HUD container is positioned at `position: absolute; inset: 0` inside `.game-shell`
**And** the HUD container has `pointer-events: none` so all canvas interactions pass through
**And** individual interactive HUD children (pause button) set `pointer-events: auto`
**And** the HUD container has CSS `z-index` configured to render above the Three.js canvas but below overlay full-screen containers (pause/game-over)
**And** the HUD container does not have a background or backdrop — the canvas remains fully visible behind all HUD elements
**And** HUD child element positions are defined using per-element absolute positioning within the HUD shell:
  - score: `top: 1rem; right: 1rem`
  - pause button: `bottom: 1rem; right: 1rem`
  - fret box: `top: 1rem; left: 1rem`
**And** during a container `ResizeObserver` callback, HUD element positions adjust proportionally to shell dimensions
**And** the HUD container is visible during `PHASES.PLAYING` and `PHASES.PAUSED` phase states
**And** the HUD container is hidden during `PHASES.IDLE` (setup screen) and `PHASES.GAME_OVER` states (overlay covers it)
**And** the `tests/unit/js/HudShell.test.js` is created with the provided test file
**And** an E2E spec `tests/e2e/specs/epic8-hud.spec.ts` is created with the provided test file
**And** all tests pass

**Implementation Notes:**
- New file: `static/game/ui/HudShell.js` — class managing visibility, phase listening, resize
- Styles in `static/game/ui/overlays.css` or new `static/game/ui/hud.css`
- Phase visibility: subscribe to `GameState.runtime.phase` changes (via polling or event dispatch in GameLoop)
- The existing `OverlayContainer` from Epic 4 manages the full-screen overlays; HudShell is a separate lighter container that lives behind overlays

**Test File — `tests/unit/js/HudShell.test.js`:**

```js
import { HudShell } from '../../../static/game/ui/HudShell.js';
import { PHASES } from '../../../static/game/GameState.js';

describe('HudShell', () => {
  let shell;
  let container;

  beforeEach(() => {
    document.body.innerHTML = `<div class="game-shell" style="width: 800px; height: 450px; position: relative;"></div>`;
    container = document.querySelector('.game-shell');
    shell = new HudShell(container);
  });

  afterEach(() => {
    shell.destroy();
  });

  test('creates a HUD container element inside game-shell', () => {
    const hud = container.querySelector('.hud-shell');
    expect(hud).not.toBeNull();
  });

  test('HUD container has pointer-events: none', () => {
    const hud = container.querySelector('.hud-shell');
    expect(getComputedStyle(hud).pointerEvents).toBe('none');
  });

  test('registerChild adds element and sets pointer-events: auto', () => {
    const el = document.createElement('button');
    shell.registerChild('pause', el);
    const hud = container.querySelector('.hud-shell');
    expect(hud.contains(el)).toBe(true);
    expect(getComputedStyle(el).pointerEvents).toBe('auto');
  });

  test('show and hide toggle visibility', () => {
    shell.hide();
    const hud = container.querySelector('.hud-shell');
    expect(getComputedStyle(hud).display).toBe('none');
    shell.show();
    expect(getComputedStyle(hud).display).not.toBe('none');
  });

  test.each([
    PHASES.IDLE, PHASES.GAME_OVER
  ])('is hidden during %s phase', (phase) => {
    shell.onPhaseChange(phase);
    const hud = container.querySelector('.hud-shell');
    expect(getComputedStyle(hud).display).toBe('none');
  });

  test.each([
    PHASES.PLAYING, PHASES.PAUSED
  ])('is visible during %s phase', (phase) => {
    shell.onPhaseChange(phase);
    const hud = container.querySelector('.hud-shell');
    expect(getComputedStyle(hud).display).not.toBe('none');
  });

  test('destroy removes container element', () => {
    shell.destroy();
    expect(container.querySelector('.hud-shell')).toBeNull();
  });
});
```

**Test File — `tests/e2e/specs/epic8-hud.spec.ts`:**

```ts
import { test, expect } from '@playwright/test';

test.describe('Epic 8 — HUD Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/subway-scaler');
    // Set up and start a game session
    await page.click('button:has-text("START")');
    // Wait for game loop to begin
    await page.waitForSelector('.hud-shell', { state: 'visible', timeout: 5000 });
  });

  test('HUD shell container is present and visible during gameplay', async ({ page }) => {
    const hud = page.locator('.hud-shell');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveCSS('pointer-events', 'none');
  });

  test('score element is positioned in top-right corner', async ({ page }) => {
    const score = page.locator('.hud-score');
    await expect(score).toBeVisible();
    const box = await score.boundingBox();
    const shellBox = await page.locator('.game-shell').boundingBox();
    expect(box.x + box.width).toBeCloseTo(shellBox.x + shellBox.width, -1);
    expect(box.y).toBeCloseTo(shellBox.y, -1);
  });

  test('pause button is positioned in bottom-right corner', async ({ page }) => {
    const pauseBtn = page.locator('.hud-pause-btn');
    await expect(pauseBtn).toBeVisible();
    const box = await pauseBtn.boundingBox();
    const shellBox = await page.locator('.game-shell').boundingBox();
    expect(box.x + box.width).toBeCloseTo(shellBox.x + shellBox.width, -1);
    expect(box.y + box.height).toBeCloseTo(shellBox.y + shellBox.height, -1);
  });

  test('pause button triggers pause overlay', async ({ page }) => {
    const pauseBtn = page.locator('.hud-pause-btn');
    await pauseBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('fret box is positioned in top-left corner', async ({ page }) => {
    const fretBox = page.locator('.hud-fret-box');
    await expect(fretBox).toBeVisible();
    const box = await fretBox.boundingBox();
    const shellBox = await page.locator('.game-shell').boundingBox();
    expect(box.x).toBeCloseTo(shellBox.x, -1);
    expect(box.y).toBeCloseTo(shellBox.y, -1);
  });

  test('HUD is hidden during game-over overlay', async ({ page }) => {
    // Trigger game over by colliding (via test hook or timeout)
    // This is a structural assertion — actual collision trigger varies
    await page.waitForSelector('[role="dialog"]', { timeout: 60000 });
    const hud = page.locator('.hud-shell');
    await expect(hud).not.toBeVisible();
  });
});
```

---

### Story 8-1: Score Display — Top-Right Corner Overlay

As a **player**, I want my current score visible in the top-right corner during gameplay, so I can track my progress at a peripheral glance without taking my hands off the instrument.

**Acceptance Criteria:**

**Given** the game scene is loaded and the HUD container exists
**When** a game session starts and `runtime.score > 0`
**Then** the score display renders in the top-right corner of `.game-shell` (positioned by `HudShell` at `top: 1rem; right: 1rem`)
**And** the score text uses the vendored monospace font at a size readable at peripheral glance (min 1.2rem)
**And** the score text colour is `var(--color-text-primary)`
**And** the score element has no background — canvas visible behind it
**And** the score element has `aria-live="polite"` for screen reader announcements

**Given** `runtime.score` increments during gameplay
**When** the score value changes
**Then** the displayed number updates immediately (same frame as score write)
**And** a brief `color-accent` (#FFB800) text colour pulse occurs for ~150ms
**And** for `prefers-reduced-motion: reduce`, the pulse is replaced by a static colour change to `color-accent` with no animation duration

**Given** a game-over or pause state
**When** the HUD becomes hidden (per HudShell phase management)
**Then** the score display is hidden

**Given** a session restart (same settings)
**When** the score resets to 0
**Then** the score display immediately shows 0

**Implementation Notes:**
- New file: `static/game/ui/ScoreDisplay.js` — class wrapping a `<span>` or `<div>`, subscribes to score changes
- Score value read from `GameState.runtime.score` — updated by CartSystem (per ownership table)
- Increment flash: a CSS class `.score-increment` toggled on for 150ms then removed; `@media (prefers-reduced-motion: reduce)` block overrides with a non-animated style
- The display integer's content is set via `textContent` (no string concatenation per frame)
- The score display can be extended to show more digits as score increases; this story only requires that it displays the current score accurately.

**Out of scope:** Score context line (personal best / delta — Epic 4-3 game-over overlay).

---

### Story 8-2: Pause Button — Bottom-Right Persistent Trigger

As a **player**, I want a pause button always visible in the bottom-right corner during gameplay, so I can pause the game with one click without searching for a keyboard shortcut.

**Acceptance Criteria:**

**Given** the game scene is loaded and the HUD container exists
**When** gameplay is active (`GameState.runtime.phase === PHASES.PLAYING`)
**Then** a pause button is rendered in the bottom-right corner of `.game-shell` (positioned by `HudShell` at `bottom: 1rem; right: 1rem`)
**And** the button is a native `<button>` element with `aria-label="Pause game"`
**And** the button has `pointer-events: auto` (overriding the HUD container's `pointer-events: none`)
**And** the button meets minimum 44×44px touch target size
**And** the button uses the `color-accent` icon (pause symbol: two vertical bars) on a `color-bg-stage` background, with `color-edge` border — consistent with Night City palette
**And** the pause icon is rendered as a pure CSS element or inline SVG (no image file dependency)

**Given** the player clicks the pause button
**When** the click event fires
**Then** `GameState.runtime.phase` transitions to `PHASES.PAUSED` (via GameLoop's established pause mechanism)
**And** the pause overlay (Epic 4-2) appears
**And** the pause button remains visible behind the overlay (HudShell is visible during PAUSED per 8-0)

**Given** the player resumes from the pause overlay
**When** `GameState.runtime.phase` transitions to `PHASES.PLAYING`
**Then** the pause button is again interactive and visible in the HUD

**Given** the game is in `PHASES.GAME_OVER`
**When** the HUD is hidden
**Then** the pause button is hidden

**Given** the session is in `PHASES.IDLE`
**When** no game session is active
**Then** the pause button is not rendered or is hidden

**Implementation Notes:**
- New file: `static/game/ui/PauseButton.js` — class wrapping a `<button>`, registers click handler that calls `GameLoop.pause()`
- Pause icon: CSS-only using `::before` / `::after` pseudo-elements rendering two vertical bars, or a minimal inline SVG (~24×24 viewBox)
- `registerChild('pause', button)` called on the HudShell instance
- The pause function called on click is the same as the established keyboard Escape handler from Epic 4-4 (no separate pause logic)

---

### Story 8-3: Fret Box — Top-Left Finger Pattern Diagram

As a **player**, I want a visual fret-box diagram in the top-left corner showing the current scale's string/fret pattern, so I can see where my fingers should be on the neck without looking away from the game.

**Acceptance Criteria:**

**Given** the game scene is loaded and the HUD container exists
**When** a game session starts with a valid scale, root, and instrument
**Then** a fret-box diagram is rendered in the top-left corner of `.game-shell` (positioned by `HudShell` at `top: 1rem; left: 1rem`)
**And** the diagram sits on a **solid dark panel** with background `rgba(12, 12, 18, 0.85)` and a PS1-era restrained border (2px dark stroke + inner lighter highlight line, like a memory card screen border)
**And** the diagram shows:
  - **Strings run horizontally** (rows). **Bottom row = lowest-pitch string** (Red, `color-string-1`). **Top row = highest-pitch string**. This orientation is locked — not configurable.
  - **Row index formula:** `row = stringCount - 1 - note.string` — string 0 (lowest pitch) maps to the bottom row
  - **Frets run vertically** (columns), divided by vertical fret-bar lines
  - **Fret number labels** at the top of each fret column in `color-text-primary`
  - **Note boxes:** For each note, a coloured rectangular box fills the cell at its string×fret intersection:
    - Box border: 2-3px at full string colour, full opacity
    - Box fill: string colour at 70-80% opacity with a brightness boost (CSS `filter: brightness(1.2)`)
    - The border carries colour identity; the fill carries occupancy
  - **Root note emphasis:** Brighter fill (opacity 0.85, `filter: brightness(1.3)`) with a small accent-yellow dot (#FFB800, ~6px) centred inside the cell — not a double-border ring
  - **Empty cells:** Transparent — no border, no fill. Grid lines visible as separators
**And** the diagram is sized as a 6-string × 4-fret grid at ~168×144px maximum, using `grid-template-columns: repeat(N_frets, 1fr)` and `grid-template-rows: repeat(N_strings, 1fr)`

**Given** the session's fret span is determined
**When** the fret-box is initialised
**Then** it displays only the frets within the active fret span (min fret to max fret across all notes)
**And** the fret range starts from `Math.max(0, minFret - 1)` to provide at least one column of positional context
**And** if all notes share a single fret, a minimum of 4 columns is displayed centred on that fret
**And** fret 0 (open strings) is never shown — only fretted positions
**And** if the notes array is empty, a placeholder is rendered ("no session" text or empty grid) with no errors

**Given** the fetch of `/game/session-config` fails
**When** no notes data is available
**Then** the fret-box shows a placeholder state (empty grid or "no data" text) without crashing

**Given** a variant transition occurs (Epic 6)
**When** the scale root changes after a variant accept
**Then** the fret-box diagram updates to show the new finger pattern for the new root note within the new fret span (handled by Story 8-4)

**Given** the HUD is hidden during game-over or idle
**When** HUD visibility changes
**Then** the fret-box follows HudShell visibility

**Implementation Notes:**
- New file: `static/game/ui/FretBox.js` — class that renders the diagram as an HTML CSS Grid
- **Public API:** `fretBox.render({notes, scale_id, root_midi, instrument_id})` — single method taking the full session-config response shape. Constructor takes only the mount container element.
- **Data contract:** The payload is identical to the `/game/session-config` response and the `/variant/promote` response. Fret box is a pure renderer — no separate model.
- Grid layout: rows = `instrument.stringCount`, columns = fret span width. Use `grid-template-columns: repeat(N, 1fr)` and `grid-template-rows: repeat(N, 1fr)`
- Row inversion: `row = stringCount - 1 - note.string` (index 0 = lowest pitch = bottom row)
- String colours: `var(--color-string-N)` where N = string index + 1. Slice STRING_COLORS to instrument stringCount.
- Cell for a note: wrapper approach — outer div with `border: 2px solid var(--color-string-N)`, inner div with `background: var(--color-string-N); opacity: 0.75; filter: brightness(1.2)` so border stays full opacity
- Root note cell: additional CSS class `.fret-cell-root` with opacity 0.85, brightness 1.3, and a `::after` pseudo-element rendering a ~6px `color-accent` dot (border-radius: 50%) centred in the cell
- Empty cells: no border, no background
- Fret numbers: `<span>` elements above the grid, one per column, centred, in `color-text-primary`
- Fret range: `Math.max(0, Math.min(...notes.map(n => n.fret)) - 1)` to `Math.max(...notes.map(n => n.fret))`. Minimum 4 columns. Guard: early return on `notes.length === 0`
- Panel background: `background: rgba(12, 12, 18, 0.85); border: 2px solid #0a0a10; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)` for the PS1-era panel look
- **Scale name label:** The container also shows the scale name and root note (e.g., "A Minor Pentatonic") as a `<span>` above or beside the grid in `color-text-primary` — only if the detail toggle (Story 8-5) is set to "Full"
- **Unit test coverage:**
  - Empty notes → placeholder, no errors
  - Single note → 1 cell filled, correct position
  - Root note → `.fret-cell-root` class present, yellow dot rendered
  - String inversion → low E at bottom row, high E at top row (4 and 6 string variants)
  - Fret range → columns match min-max with padding
  - `render()` → DOM rebuild, no stale nodes
  - Panel background → computed style matches `rgba(12, 12, 18, 0.85)`
  - Empty notes session → errors handled gracefully, no crash

---

### Story 8-4: HUD Update on Variant Transition

As a **player**, I want the fret-box diagram (and score display) to update correctly when a variant transition completes, so the HUD reflects the new scale root without manual intervention or visual glitch.

**Acceptance Criteria:**

**Given** a variant transition is in progress (Epic 6 state machine: `accepted → riding → breather → promoting → active`)
**When** the variant accept-gate fires (Epic 6-1, `accepted` state entered)
**Then** the fret-box container begins a CSS opacity fade-out (200ms, `transition: opacity 200ms ease-in-out`)
**And** once opacity reaches 0, the fret box remains hidden during the `riding`, `breather`, and `promoting` states

**Given** the variant is accepted and the breather phase is active
**When** the `/variant/promote` response arrives with the new session data
**Then** `fretBox.render()` is called with the payload `{notes, scale_id, root_midi, instrument_id}` from the promote response
**And** the DOM is rebuilt with the new finger pattern while the fret box is still hidden (opacity 0)
**And** no visual flicker or partial render occurs during the rebuild

**Given** the promote is confirmed and `PHASES.ACTIVE` is entered (Epic 6 state machine)
**When** new-scale waves begin spawning
**Then** the fret-box container begins a CSS opacity fade-in (200ms, `transition: opacity 200ms ease-in-out`) to full opacity
**And** the total visual transition from accept to arrival is ~400ms (200ms fade-out + 200ms fade-in), with a clean hidden-window for rebuild

**Given** a variant is proposed but ignored
**When** the variant window expires and the variant track peels away
**Then** the fret-box diagram remains unchanged (still showing the original scale pattern)
**And** the score display is unaffected
**And** no fade-out/in animation plays

**Given** a variant is accepted
**When** the score data is unaffected by the transition
**Then** the score display continues to show the accumulated score (score is not reset on variant accept)
**And** the score display does not participate in the fret-box fade-out/in animation

**Implementation Notes:**
- `fretBox.render(payload)` called from `main.js` with the same data shape as `/game/session-config` and `/variant/promote` responses: `{notes, scale_id, root_midi, instrument_id}`
- The promote response carries the new session data inline — no re-fetch of `/game/session-config` needed
- Fade animation: CSS `transition: opacity 200ms ease-in-out` on the fret-box container element. Triggered by adding/removing a `.fretbox-hidden` class that sets `opacity: 0`
- Rebuild window: between promote response received and `PHASES.ACTIVE` entered. The breather phase provides ~3s of safe rebuild time — DOM rebuild of ~24 cells is sub-millisecond
- `ScoreDisplay` is unaffected — reads `GameState.runtime.score` continuously and does not reset on variant
- This story depends on Epic 6 being complete (variant transition state machine and promote endpoint)
- Extends `FretBox.js` — no new files

---

### Story 8-6: HUD Detail Toggle — Basic / Full Mode

As a **player**, I want to choose between a basic and full HUD detail level, so learners get note names and scale labels while skilled players see a clean minimal pattern reference.

**Acceptance Criteria:**

**Given** the game is paused (pause overlay visible, Epic 4-2)
**When** the pause overlay is rendered
**Then** a "HUD Detail" toggle control is present on the pause overlay with two options: "Basic" and "Full"
**And** the toggle is rendered as a toggle group (consistent with the Setup screen's toggle group pattern — `role="radiogroup"`, arrow-key navigable)
**And** the current selection reflects the stored preference

**Given** the HUD detail is set to "Full"
**When** a game session is active
**Then** the fret-box panel displays the scale name and root note label (e.g., "A Minor Pentatonic — Root A") above the grid in `color-text-primary`
**And** the fret-box fret numbers are at full contrast (`color-text-primary`)
**And** a thin string-colour strip is visible along the left edge of the fret box, one per row, mapping string colour ↔ row

**Given** the HUD detail is set to "Basic"
**When** a game session is active
**Then** the scale name and root note label are hidden (only the grid and fret numbers visible)
**And** fret numbers are rendered at reduced contrast (`color-text-disabled`)
**And** the thin string-colour strip along the left edge is hidden
**And** the fret-box remains at the same size and position — only content density changes

**Given** the HUD detail preference is changed
**When** the player toggles between Basic and Full in the pause menu
**Then** the preference is persisted to `localStorage` under key `subway-scaler-hud-detail`
**And** on the next session start, the persisted preference is applied

**Given** no preference has been stored
**When** a new session starts
**Then** the HUD detail defaults to "Full" (learner-friendly default)

**Implementation Notes:**
- Persistence key: `subway-scaler-hud-detail` — separate from session settings to allow independent toggling
- Default: `"full"` — learners benefit from labels, skilled players can opt down
- The toggle is rendered inside the pause overlay HTML (modify Epic 4-2's overlay component)
- FretBox.js reads the preference via `localStorage.getItem('subway-scaler-hud-detail')` on `render()` calls
- CSS class toggle on the fret-box container: `.hud-detail-basic` / `.hud-detail-full` — styles controlled via CSS
- Telemetry (future): log each toggle event + session count in each mode to validate John's "70% retention" test

---

### Story 8-6: Accessibility Audit — HUD Focus, ARIA & Reduced Motion

As a **developer**, I want the HUD overlay audited for accessibility compliance (WCAG 2.1 AA), so the pause button is keyboard-reachable, screen readers can announce score changes, and motion-sensitive users see safe alternatives.

**Acceptance Criteria:**

**Given** the HUD is visible during gameplay
**When** a keyboard user presses Tab repeatedly
**Then** the pause button receives keyboard focus after the expected number of Tab presses (Tab order: setup screen → canvas (no focus) → pause button → browser chrome)
**And** the pause button has visible focus ring in `color-accent` on `:focus-visible`
**And** pressing Enter or Space on the focused pause button triggers pause

**Given** the score display is present
**When** the score value changes
**Then** `aria-live="polite"` region announces the new score value

**Given** the fret box is rendered
**When** inspected by an accessibility tool
**Then** the fret-box container has `role="img"` with `aria-label` describing the scale and root (e.g., "Finger pattern for C Major, root fret 5")

**Given** the system has `prefers-reduced-motion: reduce` set
**When** the score increments
**Then** the increment flash is a static colour change (no animation duration), implemented as a `@media (prefers-reduced-motion: reduce)` override in CSS

**Given** the pause button is the only interactive HUD element
**When** a keyboard-only user navigates the plugin
**Then** no other HUD element (score, fret box) is reachable by Tab — only the pause button

**Given** axe DevTools or Lighthouse accessibility audit
**When** run on the HUD elements during gameplay
**Then** no critical or serious violations are reported for `.hud-shell`, `.hud-score`, `.hud-pause-btn`, or `.hud-fret-box`

**Implementation Notes:**
- Focus management: `tabindex` management in HudShell — only pause button gets `tabindex="0"`, other children get `tabindex="-1"`
- Score `aria-live`: set on the score element in HTML markup, not injected by JS
- Fret-box `role="img"` + `aria-label`: set in `FretBox.js` constructor/update
- Reduced-motion override: single `@media` block in `hud.css` (same pattern as `overlays.css`)
- Test: extend the tone test from Story 0-3 baseline to include HUD-specific ARIA and keyboard checks