---
stepsCompleted: [1, 2, 3, 4]
status: validated
epic9Amendment: true
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

---

## Epic 9 Amendment — Correctness Fixes & Architecture Refactor

### Extracted Requirements

#### Bug Functional Requirements

**FR-B01:** Wide-span scale note sync — On scales whose notes span > 5 lanes (`num_lanes > 5`), the safe zone highlight for the next expected note appears on the wrong track at arrival time. Root area: `WaveScheduler._nextWaveNoteIndex` advances on every spawn tick independently of `Run.cursor`; with a longer ascending sequence (more lanes = more notes) the mismatch between pre-spawned waves and the backend/frontend current expected note becomes visible. Confirmed files: `static/game/WaveScheduler.js`, `static/game/GameState.js`, `static/game/main.js` detection handler.

**FR-B02:** Difficulty escalation missing — `session.speed_multiplier *= 1.05` is computed correctly in `services/game_engine.py:219` on every correct note, but `speed_multiplier` is absent from all API responses (not in `play_note` return dict, not in poll state). Frontend hardcodes `const speedMultiplier = 1.0` with a `// TODO: wire run.speedMultiplier when available` comment at `static/game/main.js:837`. WaveScheduler always runs at base speed; difficulty never escalates during play.

#### Refactoring Functional Requirements

**FR-R01:** `main.js` decomposition — `main.js` is ~1 300 lines containing game-loop RAF, audio detection callback, variant state machine (propose → accept → ride → promote), poll handler, and session lifecycle. Decompose into one focused module per concern with clear ownership boundaries. One story per extracted module.

**FR-R02:** `speed_multiplier` backend contract — Add `speed_multiplier` to the `play_note` response dict and to the poll-state response so the frontend can read the current multiplier after each correct note without a separate endpoint.

**FR-R03:** String-palette index conversion duplication — `paletteIdx = stringCount - string` conversion exists independently in `SceneManager.js` (~line 388) and `SafeZoneRenderer.js` (~line 109). Extract to a shared utility function in `tokens.js` or a new `utils.js`.

**FR-R04:** `CartSystem.js` carts alias latent bug — `const carts = gameState.scene.carts` is aliased before `.filter()` reassigns `gameState.scene.carts` to a new array. The alias then points to the stale pre-filter array, making any post-filter code using the alias operate on wrong data. Fix the reference split.

**FR-R05:** Deferred work items resolution — Promote the highest-severity deferred items from `_bmad-output/implementation-artifacts/deferred-work.md` into a single story. Each promoted item must have concrete acceptance criteria; output is either fixed code or a named decision-log entry per item. Items that are cosmetic-only or purely theoretical are explicitly out of scope.

#### Non-Functional Requirements

**NFR-R01:** All bug fixes and refactoring changes must not regress any existing unit tests (`tests/unit/js/`) or E2E specs (`tests/e2e/specs/`).

**NFR-R02:** Extracted modules must not require new mocks for behavior not already tested. Dependency injection that correctly isolates an extracted module is acceptable even if it changes call signatures; what is not acceptable is mocks that paper over real coupling.

---

### Epic 9 Approved Story List

#### Epic 9: Gameplay Correctness & Code Health

Players experience accurate note guidance and properly escalating difficulty; developers work with a focused, maintainable codebase.

| Story | FR | Title | Notes |
|---|---|---|---|
| 9-1 | FR-B01 | Fix wide-span scale note sync | Mandatory ACs: parameterised Vitest tests at `num_lanes` 5, 6, 7, 8 |
| 9-2 | FR-R04 | Fix `CartSystem.js` carts alias | Mandatory ACs: post-filter state assertion |
| 9-3 | FR-R03 | Extract `stringToLaneIndex` shared utility | Mandatory ACs: direct unit tests on new utility |
| 9-4 | FR-R01a | Extract `VariantController.js` | Mandatory ACs: `<script>`/import-map registration; VariantController before NoteAcceptor (NoteAcceptor depends on variant state) |
| 9-5 | FR-R01b | Extract `NoteAcceptor.js` | Mandatory ACs: `<script>`/import-map registration |
| 9-6 | FR-R01c | Extract `GamePoller.js` | Mandatory ACs: `<script>`/import-map registration; last extraction — integration boundary |
| 9-7 | FR-B02 + FR-R02 | Wire `speed_multiplier` backend → `GamePoller` → `WaveScheduler` | Mandatory ACs: assert frontend consumes backend value not hardcoded 1.0; wired into clean GamePoller |
| 9-8 | FR-R05 | Deferred work resolution | Each item: fixed code or named decision-log entry; no open-ended triage |

#### FR Coverage Map

| FR | Story | Coverage |
|---|---|---|
| FR-B01 | 9-1 | `WaveScheduler` / `Run.cursor` sync for `num_lanes > 5` |
| FR-B02 | 9-7 | `speed_multiplier` wired from `play_note` + poll response → `WaveScheduler` |
| FR-R01 | 9-4, 9-5, 9-6 | `main.js` decomposed into `VariantController`, `NoteAcceptor`, `GamePoller` |
| FR-R02 | 9-7 | `speed_multiplier` added to backend responses |
| FR-R03 | 9-3 | `stringToLaneIndex` extracted to shared utility |
| FR-R04 | 9-2 | `CartSystem.js` carts alias fixed |
| FR-R05 | 9-8 | Deferred work items resolved with concrete ACs |
| NFR-R01 | All | No test regression on unit + E2E |
| NFR-R02 | 9-4, 9-5, 9-6 | No new mocks for behavior not already tested |
- Test: extend the tone test from Story 0-3 baseline to include HUD-specific ARIA and keyboard checks
---

## Epic 9: Gameplay Correctness & Code Health

Players experience accurate note guidance and properly escalating difficulty; developers work with focused, maintainable modules.

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 9-1 | Fix Wide-Span Scale Note Sync | todo | — |
| 9-2 | Fix CartSystem.js Carts Alias | todo | — |
| 9-3 | Extract `stringToLaneIndex` Shared Utility | todo | — |
| 9-4 | Extract `VariantController.js` | todo | 9-3 |
| 9-5 | Extract `NoteAcceptor.js` | todo | 9-4 |
| 9-6 | Extract `GamePoller.js` | todo | 9-5 |
| 9-7 | Wire `speed_multiplier` Backend to `GamePoller` to `WaveScheduler` | todo | 9-6 |
| 9-8 | Deferred Work Resolution | todo | 9-7 |

---

### Story 9-1: Fix Wide-Span Scale Note Sync

As a **player**, I want the correct note safe zone highlighted when my turn arrives, so that on scales spanning more than 5 lanes the game visual guidance matches what I am expected to play.

**Acceptance Criteria:**

**Given** a game session where `num_lanes > 5`
**When** a safe zone wave arrives at the character position
**Then** the primary safe zone is rendered on the track corresponding to `notes[Run.cursor]`
**And** the `safe_midi` of the arriving primary wave matches `run.sequence[run.cursor].midi`

**Given** the player correctly plays the expected note while its safe zone is in the arrival window
**When** `Run.onDetection()` returns `accepted` and `run.cursor` advances
**Then** the next primary safe zone corresponds to `run.sequence[run.cursor]` (the new cursor position)
**And** no stale wave from a prior cursor position is treated as the current primary

**Given** a scale session where `num_lanes <= 5`
**When** notes are played in sequence
**Then** behaviour is identical to pre-fix (no regression)

**Given** the Vitest unit test suite for `WaveScheduler.js` and `GameState.js`
**When** run after the fix
**Then** parameterised tests covering `num_lanes` values of 5, 6, 7, and 8 all pass
**And** each test asserts that after N correct-note acceptances, the primary wave's `note_index` equals `Run.cursor`

**Implementation Notes:**
- Root area: `static/game/WaveScheduler.js` (`_buildWave`, `tick`), `static/game/GameState.js` (`Run.onDetection`, `Run.cursor`), `static/game/ui/SafeZoneRenderer.js` (`isAnyPrimarySafeZoneAdjacent`)
- The fix must decide: does `SafeZoneRenderer` determine primary by comparing wave `note_index` against `Run.cursor` at render time, or does `_buildWave` capture the cursor at spawn time? Document the chosen approach in a code comment.
- Do not change the `WaveScheduler` pre-spawn lookahead logic — only the primary-wave selection criterion

---

### Story 9-2: Fix CartSystem.js Carts Alias

As a **developer**, I want the CartSystem to always operate on the live cart array after filtering, so that stale references cannot cause incorrect collision detection or cart-count state.

**Acceptance Criteria:**

**Given** `CartSystem.js` update logic that filters `gameState.scene.carts`
**When** the filter is applied
**Then** all subsequent operations in the same call use the post-filter array, not the pre-filter reference
**And** `gameState.scene.carts` and any local alias both refer to the same filtered array

**Given** the Vitest unit tests for `CartSystem.js`
**When** run after the fix
**Then** all existing tests pass
**And** a new test asserts that after a cart-removal filter, `gameState.scene.carts.length` equals the expected post-removal count

**Implementation Notes:**
- Location: `static/game/CartSystem.js`
- The fix is a one-line reference correction: eliminate the alias or reassign it after the filter expression
- New test: set up N carts, trigger removal of M, assert `gameState.scene.carts.length === N - M`

---

### Story 9-3: Extract `stringToLaneIndex` Shared Utility

As a **developer**, I want the string-to-lane-index conversion in a single canonical place, so that any change to the string indexing convention requires exactly one edit.

**Acceptance Criteria:**

**Given** the duplicated `paletteIdx = stringCount - string` calculation in `SceneManager.js` and `SafeZoneRenderer.js`
**When** the utility is extracted
**Then** both files import and call the shared function instead of computing inline
**And** no other call sites in the codebase perform the same calculation inline

**Given** the new shared utility
**When** unit tested directly
**Then** `stringToLaneIndex(string, stringCount)` returns `stringCount - string` for valid inputs
**And** edge cases are tested: `string = 0`, `string = stringCount - 1`, and `string = stringCount`

**Given** all existing Vitest and Playwright tests
**When** run after the extraction
**Then** all pass without modification

**Implementation Notes:**
- Preferred location: append to `static/game/ui/tokens.js` as a named export (already imported everywhere)
- If added to a new `utils.js`, it must be registered in the HTML module chain or import map
- Function signature: `export function stringToLaneIndex(string, stringCount) { return stringCount - string; }`

---

### Story 9-4: Extract `VariantController.js`

As a **developer**, I want the variant propose/accept/ride/promote state machine in its own module, so that `main.js` is smaller and variant logic can be read, tested, and modified without navigating 1300 lines.

**Acceptance Criteria:**

**Given** variant state logic currently embedded in `static/game/main.js`
**When** `VariantController.js` is extracted
**Then** `main.js` no longer contains inline variant proposal, acceptance, ride, promote, or dismiss logic
**And** `main.js` delegates to `VariantController` via a clear public API
**And** all variant-related state variables (`activeVariant`, `activeWindow`, `shownVariantId`, `variantPendingSpawn`, `variantSpawnedForWave`, `proposePending`) are owned by `VariantController`

**Given** the new `static/game/VariantController.js` file
**When** the game HTML is loaded
**Then** the module is registered via `<script type="module">` or import map entry — no 404

**Given** all existing Vitest unit tests and Playwright E2E specs including variant transition specs
**When** run after the extraction
**Then** all pass without modification and without new mocks for behavior not already tested

**Given** `VariantController` uses string-to-lane conversion
**When** variant track geometry is computed
**Then** it imports `stringToLaneIndex` from Story 9-3 — no inline duplication

**Implementation Notes:**
- Depends on: Story 9-3
- Constructor arguments: `gameClient`, `scene`, `waveScheduler`, `run`, `pushGameEvent` — no global reads inside the module
- `setTransitionPhase`, `currentTransitionPhase`, and `_queueVariantSpawn` move entirely into `VariantController`

---

### Story 9-5: Extract `NoteAcceptor.js`

As a **developer**, I want audio detection callback logic and note acceptance handling in their own module, so that the path from sound input to score update is readable and independently testable.

**Acceptance Criteria:**

**Given** the `detectionHandler` async function currently defined inside `startGame()` in `main.js`
**When** `NoteAcceptor.js` is extracted
**Then** `main.js` instantiates `NoteAcceptor` and wires `audio.onDetection(acceptor.handle)`
**And** no inline detection callback remains in `main.js`
**And** `NoteAcceptor` owns: safe-zone adjacency check, `run.onDetection()` call, `gameClient.playNote()` call, feedback element update, and delegation to `VariantController` for post-note variant proposal

**Given** the new `static/game/NoteAcceptor.js` file
**When** the game HTML is loaded
**Then** the module is registered via `<script type="module">` or import map — no 404

**Given** all existing Vitest unit tests and Playwright E2E specs
**When** run after the extraction
**Then** all pass without modification and without new mocks for behavior not already tested

**Implementation Notes:**
- Depends on: Story 9-4 (`VariantController` exists so `NoteAcceptor` delegates variant proposal)
- Constructor arguments: `run`, `safeZoneRenderer`, `gameClient`, `scene`, `variantController`, `feedbackEl`, `pushGameEvent`
- Public API: `acceptor.handle(det)` — same signature as the current `detectionHandler`
- `setExpected()` helper: moves into `NoteAcceptor` or is passed as a callback; implementer must document the choice

---

### Story 9-6: Extract `GamePoller.js`

As a **developer**, I want the backend poll handler in its own module, so that the integration boundary between backend state and frontend game state has a single, auditable home.

**Acceptance Criteria:**

**Given** the `gameClient.startPolling(callback)` callback currently defined inline in `main.js`
**When** `GamePoller.js` is extracted
**Then** `main.js` instantiates `GamePoller` and calls `poller.start()`
**And** no inline poll callback remains in `main.js`
**And** `GamePoller` owns: score update, `window.__gameState.score` sync, collision/game-over detection from poll, `activeVariant` sync, and `variantController.onPollUpdate()` delegation

**Given** the new `static/game/GamePoller.js` file
**When** the game HTML is loaded
**Then** the module is registered via `<script type="module">` or import map — no 404

**Given** `speed_multiplier` will arrive in poll responses (Story 9-7)
**When** `GamePoller` is instantiated
**Then** it exposes `poller.speedMultiplier` getter returning `1.0` until Story 9-7 wires the real value

**Given** all existing Vitest unit tests and Playwright E2E specs
**When** run after the extraction
**Then** all pass without modification and without new mocks for behavior not already tested

**Implementation Notes:**
- Depends on: Story 9-5
- Constructor arguments: `gameClient`, `scoreDisplay`, `variantController`, `scene`, `window.__gameState` ref, `onGameOver` callback
- `poller.speedMultiplier` returning `1.0` is intentional stub — filled by Story 9-7

---

### Story 9-7: Wire `speed_multiplier` Backend to `GamePoller` to `WaveScheduler`

As a **player**, I want the game to actually get faster as I play correctly, so that difficulty escalates and the learning curve stays engaging throughout a session.

**Acceptance Criteria:**

**Given** a game session where the player plays correct notes
**When** `game_engine.py` computes `session.speed_multiplier *= 1.05` on each correct note
**Then** the updated `speed_multiplier` is included in the `play_note` response dict as `"speed_multiplier": <float>`
**And** the updated value is also included in the poll-state response

**Given** the frontend receives a response containing `speed_multiplier`
**When** `GamePoller` processes the response
**Then** `poller.speedMultiplier` returns the backend-provided value
**And** the render loop passes `poller.speedMultiplier` to `waveScheduler.tick(game_now, poller.speedMultiplier)`
**And** the hardcoded `const speedMultiplier = 1.0` line is removed from `main.js:837`

**Given** a session where the player has played 10 correct notes
**When** `waveScheduler.tick()` is called
**Then** `speedMultiplier` passed to it is approximately `1.05^10 ≈ 1.629` within float precision
**And** wave `duration_ms` values decrease accordingly

**Given** a session reset or game-over
**When** a new session starts
**Then** `speed_multiplier` resets to `1.0` in both backend and `GamePoller`

**Given** all existing unit tests and E2E specs
**When** run after the change
**Then** all pass
**And** at minimum one integration assertion verifies `waveScheduler.tick()` receives a value greater than `1.0` after correct notes are played

**Implementation Notes:**
- Depends on: Story 9-6 (`GamePoller` exists with `speedMultiplier` getter stub)
- Backend: add `"speed_multiplier": session.speed_multiplier` to `play_note` return dict and poll-state dict in `services/game_engine.py`
- Frontend: `GamePoller` reads `pollState.speed_multiplier` and exposes via getter
- Render loop: replace `const speedMultiplier = 1.0` with `poller.speedMultiplier`
- Do not change `WaveScheduler` internals — multiplier is consumed correctly once passed in

---

### Story 9-8: Deferred Work Resolution

As a **developer**, I want the highest-severity latent items from `deferred-work.md` addressed with concrete outcomes, so that known correctness and stability risks do not accumulate into future bugs.

**Acceptance Criteria:**

**Given** the following promoted items from `_bmad-output/implementation-artifacts/deferred-work.md`:

**Item D1: `window.__audioState` not reset on cleanup**
**When** `audio.stop()` or `cleanup()` is called at session end or game-over
**Then** `window.__audioState.micActive` is set to `false` and `window.__audioState.pipelineReady` is set to `false`
**And** a Vitest or integration test asserts the fields are `false` after teardown

**Item D2: Poll loop clobbers `__gameState.variant.id` set by `setVariant` test hook**
**When** the backend poll fires within 200ms of `setVariant` being called in a Playwright test
**Then** the `variant.id` value written by `setVariant` is not overwritten before `waitForFunction` resolves
**And** acceptable resolution is either: (a) a guard in the poll callback that skips overwriting `variant.id` if `setVariant` wrote it within the current tick, OR (b) a decision-log entry in `deferred-work.md` explaining why the risk is bounded

**Item D3: Timing constants duplicated between `CartSystem.js` and `DifficultyManager.js`**
**When** the duplication is confirmed to still exist after Epic 9 extractions land
**Then** constants are extracted to a shared location and both files import from it
**And** if resolved already by the extractions, a decision-log note closes the item

**Given** all remaining items in `deferred-work.md` not promoted above
**When** this story closes
**Then** each item has a one-line triage note added inline: `[PUNTED: Epic N — rationale]` or `[COSMETIC/THEORETICAL — no action]`

**Given** all existing unit tests and E2E specs
**When** run after changes
**Then** all pass

**Implementation Notes:**
- Depends on: Story 9-7 (all extractions complete so D3 verification is accurate)
- D2 is explicitly allowed to resolve as a decision-log entry if the race window is judged bounded
- D3 requires verifying the post-extraction state before acting
