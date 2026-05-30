---
stepsCompleted: [1, 2, 3, 4]
epic12Amendment: true
epic11Amendment: true
epic10Amendment: true
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
  - slopsmith-plugin-minigames (github.com/slopsmith/slopsmith-plugin-minigames)
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

**Gaming SDK Integration:**
**FR-GSDK-01:** Minigame Registration — Plugin declares `minigame` block in `plugin.json` and calls `window.slopsmithMinigames.register(spec)` with matching ID, `start`/`stop` lifecycle
**FR-GSDK-02:** Own Setup Screen — When launched via hub, game mounts its own setup (scale, root, instrument, difficulty) inside SDK container; difficulty picker skipped
**FR-GSDK-03:** Lifecycle Contract — `start({container, modifiers, sdk})`: game ignores empty modifiers, uses own UI; `stop()`: clean teardown
**FR-GSDK-04:** SDK Audio Detection — Use `sdk.scoring.createContinuous()` for pitch tracking when available; fall back to own `YinDetector` when SDK absent
**FR-GSDK-05:** Difficulty Scoring Multiplier — Easy x1.0, Medium x2.0, Hard x3.0 applied to base score per correct note
**FR-GSDK-06:** Quit-Only Run Submission — `end()` called once on Quit with best score across replay attempts; own game-over overlay remains intact
**FR-GSDK-07:** Settings Config Migration — Persist via `context["config_dir"]` like other Slopsmith plugins, with atomic writes and one-time migration from legacy `data/settings.json`

### Non-Functional Requirements

**NFR-011:** 60 FPS target — render loop at 60fps minimum.
**NFR-012:** Memory usage below 500MB.
**NFR-013:** Error recovery — invalid note: log and ignore; audio disconnect: reconnect or show error.
**NFR-014:** Session state — save to local storage.
**NFR-015:** Audio input options — professional interfaces, USB-MIDI, Slopsmith centralized detection.
**NFR-016:** Settings persistence — save last scale, root note, difficulty, audio device.

**SDK Compliance:**
**NFR-GSDK-01:** Minigame spec `id` must match `plugin.json` `id` for hub discovery and server-side registry
**NFR-GSDK-02:** `end()` call must not block game UI (fire-and-forget)
**NFR-GSDK-03:** Plugin is inert without SDK — no crash, no UI, no errors

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
| FR-GSDK-01 (Registration) | Epic 10 | `plugin.json` minigame block + `SdkBridge.register()` |
| FR-GSDK-02 (Own Setup Screen) | Epic 10 | Game mounts own setup in hub container; no modifier picker |
| FR-GSDK-03 (Lifecycle start/stop) | Epic 10 | `start({container, modifiers, sdk})` with empty modifiers; `stop()` triggers end |
| FR-GSDK-04 (SDK Audio Detection) | Epic 10 | `SdkDetector` wrapping `sdk.scoring.createContinuous()` |
| FR-GSDK-05 (Diff Multiplier) | Epic 10 | `DIFFICULTY_MULTIPLIERS` in CartSystem scoring |
| FR-GSDK-06 (Quit-Only end) | Epic 10 | `end()` once on Quit; best-score tracking across replays |
| FR-GSDK-07 (Config Migration) | Epic 10 | Settings via `context["config_dir"]`; atomic writes; legacy migration |
| NFR-GSDK-01 (plugin.json match) | Epic 10 | Registration spec id check vs plugin.json |
| NFR-GSDK-02 (Non-blocking end) | Epic 10 | Fire-and-forget on game-over |
| NFR-GSDK-03 (Inert without SDK) | Epic 10 | Plugin silent when SDK absent |
| FR-E12-01 (B0 detection) | Epic 12 | windowSize 4096, halfSize 2048, B0 detectable |
| FR-E12-02 (Bounded tau search) | Epic 12 | tauMin/tauMax from fMin/fMax config |
| FR-E12-03 (FFT difference fn) | Epic 12 | Hand-rolled Cooley-Tukey, O(n log n) |
| NFR-E12-01 (< 5ms processing) | Epic 12 | Per-hop budget verified by smoke test |

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

### Epic 9: Gameplay Correctness & Code Health
*(existing — detailed above)*

### Epic 10: Slopsmith Gaming SDK Integration
Register Subway Scaler as a minigame via SDK (plugin.json + register()), own setup in hub container, SDK audio detection (createContinuous()), start/stop lifecycle, difficulty-based scoring multiplier, and Quit-only end() with best-score tracking.

### Epic 12: YIN Pitch Detector Correctness & Performance
Fix silent B0 detection bug (windowSize 2048→4096), bound tau search to playable frequency range, and replace O(n²) difference function with FFT-based O(n log n) implementation — keeping pitch detection within the 5ms real-time budget.

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

---

## Epic 10: Slopsmith Gaming SDK Integration

Subway Scaler becomes a **hub-only minigame** — playable exclusively from the Minigames Hub. `plugin.json` drops `nav` + `screen` (no standalone entry); the plugin registers via `window.slopsmithMinigames.register(spec)` and mounts into the SDK's container. Without the SDK present, the plugin is inert.

Difficulty selection stays in Subway Scaler's own setup screen (no SDK modifier picker). The SDK's `scoring.createContinuous()` replaces the game's own YIN pitch detection. The game calls `end()` only on **Quit**, tracking the best score across replay attempts — the internal game-over overlay (Epic 4) and Play Again loop remain intact.

Key SDK contract (from `slopsmith-plugin-minigames/screen.js`):
- **`register({id, start, stop, title, tagline, thumbnail, availableTracks})`** — called on init; hub uses `plugin.json` `minigame` fields for display. No `modifiers` field — SDK shows empty picker (title + Start button only, no modifier rows)
- **`start({container, modifiers, sdk})`** — SDK calls this after picker; `container` is a `<div>` the game mounts into; `modifiers` is `{}` (empty)
- **`end({score, durationMs, modifiers, meta, summaryHtml})`** — game calls on **Quit only**; SDK auto-submits run, shows `runSummary()`, updates profile
- **`scoring.createContinuous(opts)`** — built-in YIN pitch tracker emitting `{freqHz, midiFloat, cents, confidence, tMs}` at ~60Hz. **Replaces** Subway Scaler's own `yin.js`. Expected base freq derivable from root MIDI note.
- **`sdk.submitRun()` / `sdk.getLeaderboard()` / `sdk.getProfile()`** — backend persist + retrieval (used internally by `end()`)
- No modifier picker: `plugin.json` has no `minigame.modifiers` → SDK shows picker with just title/tagline + Start → user clicks through → `start()` called with `modifiers: {}`
- Game calls `end()` only on **Quit** — not on game-over. Internal game-over overlay handles replay loop. `SdkBridge` tracks best score across replay attempts.

**User Outcomes:**
- Subway Scaler is discoverable only from the Minigames Hub — no standalone "Plugins → Subway Scaler" nav entry
- Tile click → SDK shows brief launch screen (title + Start) → Subway Scaler's own setup shows scale, root, instrument, and difficulty controls
- Difficulty (Easy x1.0, Medium x2.0, Hard x3.0) is chosen in the game's own setup screen
- Pitch detection uses the SDK's built-in YIN; fallback to the game's own YIN if SDK's tracker fails
- Completed runs auto-submit to the shared leaderboard; XP and profile update automatically
- Post-run summary shows score, XP gained, best score, and custom game stats — all rendered by the SDK
- Without SDK installed, the plugin does nothing (inert — no crash, no UI)

**Depends on:** Epic 1 (session setup), Epic 3 (game loop), Epic 4 (game-over flow), Epic 8 (HUD shell)

| Story | Title | Status | Depends on |
|---|---|---|---|
| 10-1 | Minigame Manifest + SDK Registration | todo | — |
| 10-2 | SDK Lifecycle — Hub Container with Own Setup Screen | todo | 10-1 |
| 10-3 | SDK Audio Detection via createContinuous() | todo | 10-1 |
| 10-4 | Difficulty-Based Scoring Multiplier | todo | 10-2 |
| 10-5 | Run end() — Auto-Submit via SDK on Quit | todo | 10-2, Epic 4 |
| 10-6 | Migrate Settings to Slopsmith Standard Config | todo | 10-1 |

---

### Story 10-1: Minigame Manifest + SDK Registration

As the **Slopsmith plugin system**,
I want Subway Scaler to declare its minigame metadata in `plugin.json` and register with the SDK,
So that the Minigames Hub discovers it as a playable tile — and it has no standalone entry point.

**Acceptance Criteria:**

**Given** Subway Scaler is installed alongside the minigames SDK
**When** the Slopsmith plugin loader scans plugin directories
**Then** `plugin.json` contains:
  - Same `id`, `script`, `routes` as before
  - **No** `nav` field — no direct nav link in the Slopsmith main menu
  - **No** `screen` field — no standalone screen entry point
  - A `minigame` block with:
    - `title`: "Subway Scaler"
    - `tagline`: descriptive one-liner
    - `type`: `"chart-free"`
    - `scoring`: `"pitch-continuous"`
    - `thumbnail`: path to a tile image
    - No `modifiers` array

**Given** the frontend initializes and the SDK is loaded
**When** the plugin's `script` runs
**Then** `SdkBridge.js` calls `window.slopsmithMinigames.register()` with an `id` matching `plugin.json`'s `id`
**And** the registration spec includes `start` and `stop` lifecycle functions
**And** the hub tile renders with the correct title, tagline, and thumbnail image
**And** the server-side `/api/plugins/minigames/registry` endpoint returns Subway Scaler's `minigame` manifest

**Given** `window.slopsmithMinigames` is undefined (SDK not installed)
**When** the plugin script runs
**Then** registration fails silently and is logged
**And** the plugin is **inert** — no UI, no crash, no errors visible to the user

**Given** `window.slopsmithMinigames` is undefined
**When** a user navigates to any Subway Scaler URL
**Then** no route or screen handler responds (no standalone view)

**Implementation Notes:**
- Update `plugin.json`: remove `"nav"` and `"screen"` entries. Add `"minigame"` block. Keep `"script"` and `"routes"` unchanged.
- New file: `static/game/SdkBridge.js` — wraps all SDK interactions
- Registration call: `window.slopsmithMinigames.register({ id: 'subway-scaler', start, stop, title: 'Subway Scaler', tagline: '...', thumbnail: '...' })`
- Registration guard: `if (typeof window.slopsmithMinigames?.register === 'function')` — else log warning and return (no further init)
- The plugin's `script` does nothing besides registering — no game logic runs until `start()` is called by the SDK
- Tests: Vitest with mock SDK verifying register called with correct spec shape; E2E verifying hub tile presence; E2E verifying no standalone nav entry exists

---

### Story 10-2: SDK Lifecycle — Hub Container with Own Setup Screen

As a **player**,
I want to click Subway Scaler's tile in the hub, see a brief launch confirm, then choose scale/root/instrument/difficulty in the game's own setup,
So that difficulty selection stays exactly where it is — no separate SDK picker step.

**Acceptance Criteria:**

**Given** the player clicks Subway Scaler's tile in the Minigames Hub
**When** the SDK's modifier picker opens
**Then** only the game title and a "Start" button are shown (no modifier rows — no modifiers in `plugin.json`)
**And** the player clicks "Start" to proceed immediately

**Given** the player clicks Start in the SDK picker
**When** the SDK calls `start({container, modifiers, sdk})`
**Then** `container` is a `<div class="mg-game-root">` inside the SDK's stage area
**And** `modifiers` is `{}` (empty — no SDK modifiers)
**And** the game mounts its full setup screen (scale selector, root note, instrument, difficulty) inside the container div
**And** the difficulty selector is present with Easy (default), Medium, Hard options

**Given** the setup screen renders inside the hub container
**When** the player selects difficulty, scale, root, instrument and clicks START
**Then** `GameState.session.difficulty` is set from the setup screen's difficulty control
**And** the game loop begins normally (no regression from Epic 1/3)
**And** `GameState.session.difficulty` reads `'easy'`, `'medium'`, or `'hard'`

**Given** the player clicks the Quit button in the SDK stage chrome
**When** the game session is active
**Then** `GameState.runtime.phase` transitions to `GAME_OVER`
**And** `SdkBridge.end()` is called with the current best score and `meta: { reason: 'quit' }`

**Given** the hub navigates away from Subway Scaler
**When** the SDK calls `stop()`
**Then** any active session is torn down via the existing `cleanup()` flow
**And** no orphaned timers or event listeners remain

**Given** the plugin is loaded without the SDK (inert mode, Story 10-1)
**When** no `start()` call ever arrives
**Then** no setup screen or game code executes

**Implementation Notes:**
- This is the **only** entry point — no standalone mode exists
- `start({container, modifiers, sdk})`: mount setup screen DOM into the provided `container` div
- `stop()`: call existing `cleanup()` which stops audio, resets GameState, clears timers
- `sdk` reference stored in `SdkBridge` for later `end()` and `createContinuous()` calls
- Test: Vitest with mock `start({container, modifiers, sdk})` verifying setup screen mounts into container; E2E verifying full hub flow

---

### Story 10-3: SDK Audio Detection via createContinuous()

As the **game engine**,
I want to use the SDK's built-in YIN pitch tracker (`scoring.createContinuous()`) as the primary audio source,
So that pitch detection comes from a shared SDK component rather than the game's own `yin.js`.

**Acceptance Criteria:**

**Given** Subway Scaler is launched via the hub
**When** `start({container, modifiers, sdk})` is called and the game session begins
**Then** `SdkBridge` calls `sdk.scoring.createContinuous({ expectedBaseFreqHz, smoothingMs })`
**And** `expectedBaseFreqHz` is derived from the root MIDI note: `440 * 2^((rootMidi - 69) / 12)`
**And** `smoothingMs` defaults to 30 (SDK default)

**Given** the SDK pitch tracker is running
**When** a `'pitch'` event fires with `{freqHz, midiFloat, cents, confidence, tMs}`
**Then** `SdkBridge` converts the pitch event into the existing `AudioDetector.detect()` interface shape:
  - `midi`: `Math.round(midiFloat)` — validated to [21, 108]
  - `confidence`: from the SDK event
  - `cents`: from the SDK event
  - `tMs`: from the SDK event
**And** the pitch data is passed into `GameLoop.js` via the existing detection pipeline (`runtime.currentNote`)

**Given** the SDK pitch tracker fails to start (mic denied, AudioContext error)
**When** `createContinuous()` rejects or throws
**Then** `SdkBridge` catches the error and logs a warning
**And** the game falls back to the existing `YinDetector` (wrapping `yin.js` / `yin-worklet.js`) for that session
**And** gameplay continues without interruption

**Given** the SDK pitch tracker is running but emits low confidence (`confidence < 0.3`)
**When** a pitch event arrives
**Then** the event is treated as silence (same energy-gate behavior as existing `YinDetector`)
**And** no note detection fires

**Given** a player quits the session or the hub navigates away
**When** `stop()` is called on the continuous handle
**Then** the `getUserMedia` stream is released by the SDK (`handle.stop()`)
**And** the AudioContext is closed

**Given** the SDK is not loaded at all (inert mode)
**When** no game session ever starts
**Then** no audio detection is initialized — plugin remains silent

**Implementation Notes:**
- Extends `SdkBridge.js` with `startPitchDetection(rootMidi)` and `stopPitchDetection()` methods
- Wraps `sdk.scoring.createContinuous()` in an `SdkDetector` class implementing the `AudioDetector` interface (adapter pattern from Architecture doc)
- Existing `AudioDetector` interface: `async detect()` returning `{midi, confidence, cents, tMs}` or `null`. SDK emits events asynchronously — `SdkDetector` buffers the latest event and `detect()` returns it synchronously (same pattern as existing audio callback → `run.onDetection()` flow)
- `expectedBaseFreqHz` computation: `440 * Math.pow(2, (rootMidi - 69) / 12)`
- Fallback chain: try `SdkDetector` first; if unavailable → use `YinDetector`
- The SDK's `createContinuous` handles its own `getUserMedia` + AudioContext lifecycle — no double-initialization
- Test: Vitest with mock SDK's `scoring.createContinuous()` verifying pitch events are converted to correct `{midi, confidence, cents, tMs}` shape; test fallback to `YinDetector` when SDK tracker fails

---

### Story 10-4: Difficulty-Based Scoring Multiplier

As a **player**,
I want higher difficulty levels to award more points per correct note,
So that challenging settings are properly rewarded.

**Acceptance Criteria:**

**Given** difficulty is set to **Easy** via the setup screen
**When** `GameState.session.difficulty` is `'easy'`
**Then** `CartSystem.js` uses multiplier **x1.0** → each correct note awards `BASE_SCORE × 1.0`

**Given** difficulty is set to **Medium**
**When** difficulty is `'medium'`
**Then** multiplier is **x2.0**

**Given** difficulty is set to **Hard**
**When** difficulty is `'hard'`
**Then** multiplier is **x3.0**

**Given** a session is in progress
**When** `CartSystem.js` computes score for a correct note
**Then** `increment = BASE_SCORE × DIFFICULTY_MULTIPLIERS[GameState.session.difficulty]`
**And** the multiplier is immutable for the run duration

**Given** the base score is 100 (FR-004)
**When** a Hard-mode correct note is scored
**Then** the displayed increment is 300
**And** a "x3.0" badge is shown next to the score in the HUD (color-accent text, Epic 8)

**Given** `window.slopsmithMinigames.end()` is called on Quit (Story 10-5)
**When** the modifiers payload includes `difficulty`
**Then** the SDK's leaderboard stores the difficulty level for filtering

**Implementation Notes:**
- Multiplier constants: `DIFFICULTY_MULTIPLIERS = { easy: 1.0, medium: 2.0, hard: 3.0 }` in `GameState.js`
- `BASE_SCORE = 100` constant
- Score increment in `CartSystem.js`: `increment = Math.round(BASE_SCORE * DIFFICULTY_MULTIPLIERS[difficulty])`
- Multiplier badge: extend `ScoreDisplay.js` to show `x1.0` / `x2.0` / `x3.0` — use `color-accent` text
- Test: parameterised Vitest asserting correct increment for each difficulty level

---

### Story 10-5: Run end() — Auto-Submit via SDK on Quit Only

As the **game engine**,
I want to call `window.slopsmithMinigames.end()` only when the player quits the game session,
So that Subway Scaler's own game-over overlay and Play Again flow remain intact across replay attempts, with only the best score of the session submitted to the leaderboard.

**Acceptance Criteria:**

**Given** a game-over occurs (`GameState.runtime.phase === PHASES.GAME_OVER`) during a play attempt
**When** the player dies
**Then** Subway Scaler's own game-over overlay (Epic 4) is shown
**And** `end()` is NOT called — the SDK summary does not appear
**And** `SdkBridge` records the current session score as `bestScore` if it exceeds the previous best

**Given** the player clicks "Play Again" on the game-over overlay
**When** the game restarts internally
**Then** the scene, score, and wave state are reset (existing Epic 3 flow)
**And** the SDK's `createContinuous()` pitch tracker continues running (no stop/restart needed)
**And** `SdkBridge.bestScore` persists across replays within this hub session

**Given** the player completes multiple replay attempts with scores [200, 500, 300]
**When** the player clicks the SDK Quit button (or hub navigates away)
**Then** `SdkBridge.end()` calls `window.slopsmithMinigames.end()` once with:
```js
{
  score: 500,  // best across all attempts
  durationMs: Math.round(performance.now() - sessionStartTime),
  modifiers: { difficulty: 'easy' },
  meta: { scale_id, root_midi, instrument_id, notes_played, accuracy_pct, attempts: 3 },
  summaryHtml: '<div>...custom stats...<div>'
}
```
**And** the call is fire-and-forget

**Given** the Quit button is clicked
**When** `end()` is called
**Then** the SDK shows the runSummary modal once with the best score and XP gained
**And** the profile strip updates
**And** `SdkBridge` resets `bestScore` to 0 for the next `start()` cycle

**Given** the hub navigates away from Subway Scaler
**When** the SDK calls `stop()`
**Then** `stop()` first calls `end()` with the best score (same payload as Quit)
**And** a reentry guard prevents `end()` → `stop()` → `end()` loops:
```js
let _ending = false;
function stop() {
  if (_ending) return;
  _ending = true;
  if (!_ended) { _ended = true; window.slopsmithMinigames.end({...}); }
}
```

**Given** submission fails (SDK unavailable, network error)
**When** `end()` throws or rejects
**Then** the SDK summary still shows (SDK's `end()` swallows errors internally)
**And** a warning is logged to console

**Given** Subway Scaler is only available through the hub
**When** game-over occurs
**Then** the same game-over overlay (Epic 4) and Play Again flow work
**And** no SDK call is attempted

**Implementation Notes:**
- `SdkBridge.bestScore = 0` tracked across replays; updated on each game-over: `bestScore = Math.max(bestScore, GameState.runtime.score)`
- `SdkBridge.sessionStartTime = performance.now()` set in `start()` — total time across all replay attempts
- Override SDK's Quit button onclick (SDK hardcodes `score: 0`): within `start()`, replace `document.getElementById('mg-stage-quit').onclick` handler
- Reentry guard: `_ended` flag prevents double-submission if both Quit button and `stop()` fire
- The SDK's internal `end()` handles `submitRun()` + `runSummary()` + profile update — game just passes the payload
- Test: Vitest with mock SDK verifying `end()` is called once with best score; verifying `stop()` → `end()` reentry guard; verifying multiple game-overs only update `bestScore` without calling `end()`

---

### Story 10-6: Migrate Settings to Slopsmith Standard Config

As the **plugin system**,
I want Subway Scaler to persist settings via `context["config_dir"]` like other Slopsmith plugins,
So that settings survive restarts and work in Docker.

**Acceptance Criteria:**

**Given** Subway Scaler's `routes.py` `setup(app, context)` is called by the Slopsmith plugin loader
**When** the function begins
**Then** `config_dir = Path(context["config_dir"])` is used as the settings root
**And** the settings file path is `config_dir / "subway_scaler.json"`

**Given** settings are persisted via the plugin's REST endpoints
**When** `GET /api/plugins/subway-scaler/settings` is called
**Then** settings are read from `config_dir / "subway_scaler.json"`
**And** if the file doesn't exist, defaults are returned (existing `PlayerSettings` defaults)

**Given** settings are saved via `PUT /api/plugins/subway-scaler/settings`
**When** a valid payload is submitted
**Then** the full settings object is written to `config_dir / "subway_scaler.json"`
**And** writing uses atomic temp+rename to prevent partial writes

**Given** the `data/settings.json` file exists from a previous version
**When** the plugin starts for the first time after migration
**Then** settings are migrated from `data/settings.json` to `config_dir / "subway_scaler.json"`
**And** the old file is renamed to `data/settings.json.bak`

**Given** the settings file contains corrupt JSON
**When** `_read()` attempts to parse it
**Then** the error is logged and defaults are returned

**Given** all existing tests in `tests/`
**When** run after the migration
**Then** existing contract tests for `GET /settings` and `PUT /settings` pass (response shape unchanged)

**Implementation Notes:**
- Modify `services/settings.py`: remove hardcoded `SETTINGS_PATH`; add `init(config_dir)` called from `routes.py setup()`
- Modify `routes.py`: pass `Path(context["config_dir"])` to `settings_service.init()` in `setup()`
- Atomic write pattern: `tempfile.mkstemp` → write → `os.fsync` → `os.replace`
- One-time migration: if `data/settings.json` exists and config target doesn't, copy then rename old to `.bak`
- No change to `PlayerSettings` schema or endpoint contracts — paths only

---

## Epic 11: Multi-String Support & v1.0 Release Preparation

Players can select 5-string bass, 7-string guitar, and 8-string guitar from the setup screen via a new "Number of Strings" control; the character runs from the very first frame of every session; the legacy bottom-left HUD is gone; and the README accurately documents the released game. Together these changes clear the v1.0 release gate.

**User Outcomes:**
- Bass players can choose 4 or 5 strings; guitar players can choose 6, 7, or 8 strings from the setup screen — the correct instrument with the correct standard tuning is selected automatically
- String count is persisted alongside instrument type and restored on next session
- The character starts its running animation on the very first frame of the countdown, not after it ends
- The old bottom-left score/note readout is gone — the Epic 8 HUD is the sole source of game feedback
- The README accurately describes Subway Scaler v1.0: what it is, how to install and run it, and how to play

**Depends on:** Epic 1 (session setup and instrument API), Epic 8 (HUD overlay — canonical score/note display replacing the legacy HUD)

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 11-1 | Expand Instrument Registry — 5-String Bass, 7-String & 8-String Guitar | todo | — |
| 11-2 | Number of Strings Selector in Setup UI | todo | 11-1 |
| 11-3 | Fix: Character Running Animation From Start | todo | — |
| 11-4 | Remove Legacy Score/Note HUD | todo | — |
| 11-5 | README Update for v1.0 | todo | — |

### FR Coverage Map (Epic 11)

| FR | Story | Coverage |
|---|---|---|
| FR-E11-01 (Strings selector UI) | 11-2 | Number of Strings control in setup — 4–5 for Bass, 6–8 for Guitar |
| FR-E11-02 (Compound instrument_id) | 11-2 | (Kind × string count) → instrument_id lookup |
| FR-E11-03 (New instrument definitions) | 11-1 | `bass-5-standard`, `guitar-7-standard`, `guitar-8-standard` added to registry |
| FR-E11-04 (String count persistence) | 11-2 | String count stored in localStorage via instrumentId |
| FR-E11-05 (Remove legacy HUD) | 11-4 | Bottom-left `.hud` div and driving code removed |
| FR-E11-06 (Character animation from start) | 11-3 | Running animation plays from frame 1 of the countdown |
| FR-E11-07 (README update) | 11-5 | README reflects v1.0 state |

---

### Story 11-1: Expand Instrument Registry — 5-String Bass, 7-String & 8-String Guitar

As a **developer**, I want the instrument registry to define 5-string bass, 7-string guitar, and 8-string guitar with correct standard tunings, so that the game engine can compute accurate fret/string positions for these instruments and the setup UI can offer them as selections.

**Acceptance Criteria:**

**Given** the plugin loads
**When** `GET /api/plugins/subway-scaler/instruments` is called
**Then** the response includes all five instruments:
  - `guitar-standard` (existing — unchanged)
  - `bass-4-standard` (existing — unchanged)
  - `bass-5-standard`: `kind="bass"`, `stringCount=5`, `tuning=[23, 28, 33, 38, 43]` (B0, E1, A1, D2, G2), `maxFret=24`
  - `guitar-7-standard`: `kind="guitar"`, `stringCount=7`, `tuning=[35, 40, 45, 50, 55, 59, 64]` (B1, E2, A2, D3, G3, B3, E4), `maxFret=24`
  - `guitar-8-standard`: `kind="guitar"`, `stringCount=8`, `tuning=[30, 35, 40, 45, 50, 55, 59, 64]` (F#1, B1, E2, A2, D3, G3, B3, E4), `maxFret=24`

**Given** a `GET /api/plugins/subway-scaler/instruments` response
**When** each new instrument is inspected
**Then** `tuning` is strictly increasing
**And** all tuning MIDI values are in [21, 108]
**And** `stringCount` equals `len(tuning)`

**Given** `GET /api/plugins/subway-scaler/settings` is called with `instrument_id = "guitar-7-standard"`
**When** the settings endpoint validates the instrument
**Then** the validation passes (instrument exists in registry)

**Given** `PUT /api/plugins/subway-scaler/settings` with `instrument_id = "guitar-8-standard"`
**When** the request is processed
**Then** the settings are saved successfully (response 200)

**Given** all existing contract tests in `tests/contract/`
**When** run after this change
**Then** all pass without modification

**Given** new contract tests for the expanded registry
**When** run
**Then** `test_instruments.py` asserts all five instrument IDs are present in the response
**And** asserts each new instrument's `stringCount`, `tuning` length, and `tuning` values are correct

**Implementation Notes:**
- `services/instruments.py`: Add three new `Instrument(...)` entries to `_RAW`
- `services/schemas.py`: Update `Instrument` validators:
  - `stringCount: int = Field(..., ge=4, le=8)` (was `le=6`)
  - `_validate_tuning`: accept `len(v) in (4, 5, 6, 7, 8)` (was `(4, 6)`)
  - `StringFretPair.string: int = Field(..., ge=1, le=8)` (was `le=6`)
  - `VariantTrackSet.base_string: int = Field(1, ge=1, le=8)` (was `le=6`)
- No changes to `settings.py`, `game_routes.py`, or `tabulator.py` needed in this story — those consume the instrument object and will work with any valid instrument once the schema allows it

---

### Story 11-2: Number of Strings Selector in Setup UI

As a **player**, I want a "Number of Strings" control in the setup screen that adjusts based on my instrument choice, so I can select my specific guitar or bass configuration and the game uses the correct tuning.

**Acceptance Criteria:**

**Given** the setup screen renders
**When** the Instrument toggle shows "Guitar" selected (derived from current `instrumentId`)
**Then** a "Number of Strings" control appears below the Instrument toggle
**And** the control offers values 6, 7, 8 for Guitar
**And** the current string count for the active instrument is pre-selected (e.g., `guitar-7-standard` → 7 selected)

**Given** the setup screen renders with "Bass" selected
**When** the Number of Strings control renders
**Then** the control offers values 4, 5 for Bass
**And** the current string count is pre-selected (e.g., `bass-5-standard` → 5 selected)

**Given** the player changes the Instrument toggle from Guitar to Bass
**When** the toggle fires its `onSelect` callback
**Then** the Number of Strings control updates to show Bass values (4, 5)
**And** the selected count resets to the default for Bass (4)
**And** `currentInstrumentId` updates to `bass-4-standard`

**Given** the player changes the Instrument toggle from Bass to Guitar
**When** the toggle fires its `onSelect` callback
**Then** the Number of Strings control updates to show Guitar values (6, 7, 8)
**And** the selected count resets to the default for Guitar (6)
**And** `currentInstrumentId` updates to `guitar-standard`

**Given** the player selects 7 on the Guitar Number of Strings control
**When** the control's selection changes
**Then** `currentInstrumentId` becomes `"guitar-7-standard"`

**Given** the player clicks START with `currentInstrumentId = "guitar-8-standard"`
**When** the session config request is made
**Then** `instrument_id = "guitar-8-standard"` is sent to `/api/plugins/subway-scaler/game/start`

**Given** the player starts a session
**When** settings are saved to `localStorage`
**Then** the `instrument_id` stored includes the string count (e.g., `"guitar-7-standard"`)
**And** on the next page load, the setup screen pre-selects Guitar + 7 strings

**Given** the Instrument toggle shows Guitar and Number of Strings shows 6
**When** the player opens the setup screen
**Then** the instrument toggle shows two options: "Guitar" and "Bass" (not individual instrument names)
**And** the Number of Strings control is a toggle group (consistent with the existing Difficulty and Instrument toggle group pattern)

**Implementation Notes:**
- Modify `static/game/ui/setup.js`:
  - Change instrument toggle from listing all instrument objects by name to two options: `{ id: 'guitar', name: 'Guitar' }` and `{ id: 'bass', name: 'Bass' }`
  - Add `createStringCountToggle(kind, currentCount, instruments, onChange)` helper that renders the correct values for the given kind
  - Add `resolveInstrumentId(kind, stringCount)` pure function: `{ guitar: { 6: 'guitar-standard', 7: 'guitar-7-standard', 8: 'guitar-8-standard' }, bass: { 4: 'bass-4-standard', 5: 'bass-5-standard' } }`
  - On instrument-kind change: rebuild string-count toggle; reset to default count; call `resolveInstrumentId` to update `currentInstrumentId`
  - On string-count change: call `resolveInstrumentId` to update `currentInstrumentId`
  - Derive initial kind and count from `stored.instrument_id` using `instruments` list
- The `instruments` list (from `GET /instruments`) is passed in and used only to derive initial state — `resolveInstrumentId` uses a hardcoded map for reliability
- `setup.css`: no new styles needed if existing `.toggle-group` / `.toggle-button` classes are reused

---

### Story 11-3: Fix: Character Running Animation From Start

As a **player**, I want the character to be visibly running from the very first frame of the countdown, so the game feels alive and responsive immediately rather than waiting for the countdown to finish.

**Acceptance Criteria:**

**Given** the player clicks START and the game scene initialises
**When** the first animation frame renders (before the countdown ends)
**Then** the character sprite is animating through its running frames — not frozen on frame 0

**Given** the 3-second countdown is running (`showOverlay("3")`, `showOverlay("2")`, `showOverlay("1")`)
**When** each RAF tick fires during the countdown
**Then** `updateCharacterSprite` advances through the sprite sheet frames at the configured `CHARACTER_FPS` rate
**And** the character visibly cycles through frames while the countdown overlays are shown

**Given** the countdown completes and `run.start(gameStartTime)` is called
**When** the game is fully active
**Then** the character continues animating without any jump or reset in the frame cycle

**Given** the game is paused and then resumed
**When** the RAF loop resumes
**Then** the character animation continues from where it left off — no freeze or reset

**Given** the game-over state is entered
**When** the session ends
**Then** the character animation stops (scene is no longer rendered)

**Implementation Notes:**
- Root cause: `updateCharacterSprite(nowGameMs)` computes `elapsed = nowGameMs - gameStartTime` where `gameStartTime = countdownStart + 3500` (3.5 s in the future). During the countdown, `elapsed < 0`, causing `_frameTimelineFn` to always return frame 0.
- Fix: introduce a `_charAnimStartMs` variable in `SceneManager.js`, set to `performance.now()` when the first render frame fires after `setGameStartTime()` is called. In `updateCharacterSprite`, use `elapsed = Math.max(0, nowGameMs - _charAnimStartMs)` for frame computation — independent of the game clock that the wave scheduler uses.
- `_charAnimStartMs` is reset to `null` on `scene.reset()` and set lazily on the first `render()` call after a `setGameStartTime()` call.
- No changes needed in `main.js` or `GameLoop.js` — the fix is internal to `SceneManager.js`
- Verify: sprite frame advances during countdown period in manual browser test

---

### Story 11-4: Remove Legacy Score/Note HUD

As a **player**, I want the game screen to be clean with only the Epic 8 HUD overlay showing score and feedback, so there is no redundant or confusing readout in the bottom-left corner.

**Acceptance Criteria:**

**Given** the game is running
**When** the player looks at the game screen
**Then** there is no score or note-name readout in the bottom-left corner of the game shell
**And** the Epic 8 HUD overlay (top-right score, bottom-right pause button, top-left fret box) remains fully functional

**Given** a correct note is played
**When** audio detection fires
**Then** feedback is shown only via the Epic 8 HUD elements (score flash, fret box)
**And** no legacy `<div class="hud">` content appears or updates

**Given** the DOM is inspected during active gameplay
**When** queried for `.hud` (the legacy container)
**Then** the element is absent — not hidden, not empty, but removed from the DOM entirely

**Given** all existing unit tests and E2E specs
**When** run after the removal
**Then** all pass — no test references the removed legacy HUD elements

**Implementation Notes:**
- `static/game/main.js`: Remove the `const hud = el('div', { class: 'hud' })` block (around lines 295–300), the `expectedEl` and `feedbackEl` element creation, and the `hud.appendChild(expectedEl)` / `hud.appendChild(feedbackEl)` calls
- Also remove `hud` from the `gameWrap` children: `el('div', { class: 'game-wrap', ... }, canvas, overlay, hud)` → remove `hud`
- Trace all references to `expectedEl` and `feedbackEl` throughout `main.js` and any imported modules (`GamePoller.js`, `NoteAcceptor.js`) — replace with no-ops or remove entirely
- `static/game/ui/overlays.css` or `hud.css`: remove any `.hud`, `.expected`, `.feedback` CSS rules if present
- Do not remove `feedbackEl` from `GamePoller` if it is still wired to Epic 8 score feedback — audit usages first. If `feedbackEl` drives only the removed legacy element, remove it entirely. If it drives Epic 8 elements, keep the reference but point it to the correct Epic 8 DOM element.

---

### Story 11-5: README Update for v1.0

As a **new user or contributor**, I want the README to accurately describe the current state of Subway Scaler v1.0, so I can understand what the game is, how to set it up, and how to play it without reading outdated or incomplete information.

**Acceptance Criteria:**

**Given** a developer clones the repository
**When** they read `README.md`
**Then** the README describes Subway Scaler as a guitar/bass scale trainer Slopsmith plugin with Subway Surfers-style gameplay
**And** includes setup instructions for running it (Docker / native, Slopsmith integration)
**And** describes the controls: instrument selection, scale selection, difficulty, how playing a note moves the character
**And** lists the supported instruments: 4-string bass, 5-string bass, 6-string guitar, 7-string guitar, 8-string guitar
**And** describes the string colour system (Rocksmith convention) so players know how to read the track
**And** mentions the variant switching mechanic at a high level
**And** does not contain references to features not yet implemented (e.g., tutorial screen, sound effects, multiplayer)
**And** does not contain placeholder text, broken links, or TODO markers

**Given** a first-time player reads the README
**When** they follow the "How to Play" section
**Then** the instructions are accurate for the currently implemented game: setup screen → pick scale/instrument/strings/difficulty → click START → play notes → avoid carts

**Implementation Notes:**
- Update `README.md` in the project root
- Sections to include: Project overview, Prerequisites, Installation, Running (Docker + native), How to play, Instrument support, String colour reference, Known limitations / future work
- Remove or rewrite any content written for an earlier planned-but-not-implemented state
- No code changes required — documentation only

---

## Epic 12: YIN Pitch Detector Correctness & Performance

The game correctly detects bass and guitar notes down to B0 (30.87 Hz) — fixing a silent correctness bug where the current window size makes low bass notes undetectable — and the pitch detection pipeline remains within its real-time processing budget even with the larger window.

**User Outcomes:**
- Bass players on 5-string bass or 7/8-string guitar can reliably trigger correct-note detection on their lowest strings (B0, F#1) — notes that were silently undetectable before this epic
- Pitch detection runs within the AudioWorklet hop budget (~23ms at 44100 Hz) with windowSize=4096, keeping the game at 60 FPS
- Tau search is bounded to the playable frequency range, skipping irrelevant computation and giving headroom for the larger window

**New Functional Requirements:**

**FR-E12-01:** B0 Detection — The YIN detector must correctly detect pitches down to B0 (30.87 Hz). At 44100 Hz sample rate, this requires `halfSize ≥ 1429`, meaning `windowSize ≥ 4096`. Current `windowSize=2048` silently fails to detect any note below ~43 Hz.

**FR-E12-02:** Bounded Tau Search — Tau computation must be constrained to `[tauMin, tauMax]` where `tauMin = ceil(sampleRate / fMax)` and `tauMax = min(halfSize - 1, floor(sampleRate / fMin))`, using configurable `fMin` (default 27 Hz) and `fMax` (default 2637 Hz — E7, highest note on standard-tuned guitar).

**FR-E12-03:** FFT-Based Difference Function — The O(n²) `_difference()` implementation must be replaced with an FFT-based autocorrelation approach: `d(τ) = 2·r(0) - 2·ACF(τ)` via `IFFT(|FFT(zero-padded signal)|²)`. Implementation must be a hand-rolled Cooley-Tukey FFT (no external dependency) inlined in `yin.js`. FFT size must be `nextPow2(2 * windowSize)` to avoid circular autocorrelation.

**New Non-Functional Requirement:**

**NFR-E12-01:** Pitch detection processing per hop must complete in < 5ms wall-clock time with `windowSize=4096` at 44100 Hz sample rate. The AudioWorklet hop budget is ~23ms; this leaves headroom for the rest of the audio pipeline.

**Depends on:** None (self-contained changes to `static/game/yin.js` and `static/game/yin-worklet.js`). Story 10-3's `YinDetector` fallback path benefits directly.

**GitHub:** Epic issue [#25](https://github.com/OmikronApex/slopsmith-plugin-subway-scaler/issues/25)

**Stories:**

| Story | Title | Status | Depends on | GitHub |
|---|---|---|---|---|
| 12-1 | Fix Window Size — Enable B0 Detection | todo | — | [#26](https://github.com/OmikronApex/slopsmith-plugin-subway-scaler/issues/26) |
| 12-2 | Bounded Tau Search — fMin/fMax Config | todo | 12-1 | [#27](https://github.com/OmikronApex/slopsmith-plugin-subway-scaler/issues/27) |
| 12-3 | FFT-Based Difference Function — O(n log n) | todo | 12-2 | [#28](https://github.com/OmikronApex/slopsmith-plugin-subway-scaler/issues/28) |

---

### Story 12-1: Fix Window Size — Enable B0 Detection

As a **bass player**,
I want the pitch detector to correctly identify notes down to B0 (30.87 Hz),
So that my lowest bass strings trigger note detection reliably in the game.

**Acceptance Criteria:**

**Given** the `YinDetector` is constructed with default options
**When** `windowSize` and `halfSize` are inspected
**Then** `windowSize` equals `4096`
**And** `halfSize` equals `2048`
**And** `this.diff` and `this.cmnd` are both `Float32Array` of length `2048`

**Given** a synthetic 30.87 Hz sine wave (B0) at 44100 Hz sample rate, 4096 samples
**When** `process(buf)` is called with that buffer
**Then** `frequencyHz` is within ±2 Hz of 30.87
**And** `confidence` is above `0.5`

**Given** a synthetic 440 Hz sine wave at 44100 Hz, 4096 samples (regression)
**When** `process(buf)` is called
**Then** `frequencyHz` is within ±2 Hz of 440
**And** `confidence` is above `0.5`

**Given** the `YinProcessor` AudioWorklet is constructed with default `processorOptions`
**When** `this.windowSize` and `this.ring.length` are inspected
**Then** both equal `4096`
**And** `this.frame.length` equals `4096`
**And** `this.hopSize` remains `1024` (unchanged — no scope increase)

**Given** all existing tests in `tests/unit/js/yin.test.js`
**When** run after this change
**Then** all pass without modification

**Implementation Notes:**
- `static/game/yin.js`: Change constructor default `windowSize = 2048` → `windowSize = 4096`
- `static/game/yin-worklet.js`: Change `this.windowSize = opts.windowSize || 2048` → `opts.windowSize || 4096`. Do NOT change `hopSize` — keep at `1024`.
- B0 test fixture: `new Float32Array(4096).map((_, i) => Math.sin(2 * Math.PI * 30.87 * i / 44100))`
- 440 Hz test fixture: `new Float32Array(4096).map((_, i) => Math.sin(2 * Math.PI * 440 * i / 44100))`
- No changes to `_difference`, `_cmnd`, `_absoluteThreshold`, or `_parabolicInterpolation` in this story

---

### Story 12-2: Bounded Tau Search — fMin/fMax Config

As a **developer**,
I want the YIN detector's tau search bounded to a configurable playable frequency range,
So that computation skips irrelevant lag values and the larger 4096-sample window stays within the real-time hop budget.

**Acceptance Criteria:**

**Given** `YinDetector` constructed with `{ sampleRate: 44100, fMin: 27, fMax: 2637 }`
**When** `this.tauMin` and `this.tauMax` are inspected
**Then** `tauMin` equals `ceil(44100 / 2637)` = `17`
**And** `tauMax` equals `min(2047, floor(44100 / 27))` = `min(2047, 1633)` = `1633`

**Given** `YinDetector` constructed without `fMin`/`fMax` (defaults: `fMin=27`, `fMax=2637`)
**When** `tauMin` and `tauMax` are inspected
**Then** they equal the same values as above (27 and 2637 are the constructor defaults)

**Given** a synthetic 30.87 Hz sine wave (B0, τ ≈ 1429) — within [tauMin=17, tauMax=1633]
**When** `process(buf)` is called
**Then** `frequencyHz` is within ±2 Hz of 30.87
**And** detection succeeds (was already passing from 12-1 — regression guard)

**Given** a synthetic 27.5 Hz sine wave (A0, τ ≈ 1603) — at the lower boundary
**When** `process(buf)` is called
**Then** `frequencyHz` is within ±2 Hz of 27.5 (boundary note not silently dropped)

**Given** a synthetic 2637 Hz sine wave (E7, τ ≈ 17) — at the upper boundary (highest note on standard-tuned guitar)
**When** `process(buf)` is called
**Then** `frequencyHz` is within ±5 Hz of 2637 (upper boundary note detected)

**Given** the `_difference(buf)` method with bounded tau
**When** called with any buffer
**Then** the outer loop runs only from `tauMin` to `tauMax` (inclusive)
**And** `diff[tau]` for `tau < tauMin` or `tau > tauMax` is `0` or untouched (never written)
**And** the `_absoluteThreshold()` search starts from `tauMin`, not `tau=2`

**Given** all existing tests in `tests/unit/js/yin.test.js`
**When** run after this change
**Then** all pass without modification

**Implementation Notes:**
- `static/game/yin.js` constructor: add `fMin = 27` and `fMax = 1600` to options destructuring. Compute and store `this.tauMin = Math.ceil(sampleRate / fMax)` and `this.tauMax = Math.min(this.halfSize - 1, Math.floor(sampleRate / fMin))`.
- `_difference(buf)`: change outer loop `for (let tau = 1; tau < H; tau++)` → `for (let tau = this.tauMin; tau <= this.tauMax; tau++)`
- `_absoluteThreshold()`: change start `for (let tau = 2; tau < H; tau++)` → `for (let tau = this.tauMin; tau <= this.tauMax; tau++)`
- `_cmnd()`: keep running from `tau=1` to `halfSize` (CMNDF normalization must cover all taus to be correct; only search is bounded)
- `yin-worklet.js`: pass `fMin` and `fMax` from `processorOptions` through to `YinDetector` constructor

---

### Story 12-3: FFT-Based Difference Function — O(n log n)

As a **developer**,
I want the YIN difference function computed via FFT-based autocorrelation,
So that pitch detection with `windowSize=4096` stays within the real-time 5ms processing budget instead of doing 8M operations per hop.

**Acceptance Criteria:**

**Given** `YinDetector` constructed with `{ sampleRate: 44100, windowSize: 4096 }`
**When** `process(buf)` is called with a 440 Hz sine wave buffer
**Then** `frequencyHz` is within ±1 Hz of 440 (end-to-end correctness with FFT path)

**Given** the FFT implementation inside `yin.js`
**When** inspected
**Then** the FFT size is `nextPow2(2 * windowSize)` — for `windowSize=4096` this is `8192`
**And** the input signal is zero-padded to `fftSize` before transformation (no circular autocorrelation)
**And** after IFFT, values are divided by `fftSize` (correct normalization)
**And** all scratch buffers (`_fftRe`, `_fftIm`, `_scratchRe`, `_scratchIm`) are pre-allocated `Float32Array` of length `fftSize` in the constructor — no per-hop heap allocation

**Given** a 440 Hz sine wave buffer processed by both the original O(n²) `_difference` and the FFT-based path
**When** the raw `d[tau]` arrays are compared element-by-element for `tau` in `[tauMin, tauMax]`
**Then** the maximum absolute difference between any element is less than `1e-3`

**Given** 20 test signals spanning the full playable range (A0 at 27.5 Hz to C7 at 2093 Hz, sampled at musically meaningful intervals)
**When** the FFT path is used for each
**Then** the detected pitch matches the direct O(n²) reference implementation to within **0.5 cents** for every signal
**And** "same note name" is NOT a sufficient pass criterion — the cent deviation must be asserted numerically

**Given** a zero-filled input buffer (silence)
**When** `process(buf)` is called
**Then** the function returns `{ frequencyHz: null, confidence: 0 }` without NaN, Infinity, or thrown errors
**And** no division-by-zero occurs in the CMNDF step

**Given** a noisy signal (440 Hz sine + Gaussian noise at SNR ≈ 20dB)
**When** `process(buf)` is called
**Then** `frequencyHz` is within ±5 Hz of 440 or `null` (noise may reduce confidence below threshold — both are acceptable)
**And** no NaN or Infinity values are returned

**Given** the `process()` method called 100 times with a 4096-sample 440 Hz sine buffer
**When** total wall-clock time is measured via `performance.now()`
**Then** average time per call is less than `5ms`

**Given** all existing tests in `tests/unit/js/yin.test.js` and all Playwright E2E specs
**When** run after this change
**Then** all pass without modification

**Given** `yin.test.js` structure after this story
**When** inspected
**Then** the file is organized into four `describe` blocks:
- `'YIN - window size'` — B0 detection and 440 Hz regression (from Story 12-1)
- `'YIN - tau bounds'` — boundary notes and arithmetic assertions (from Story 12-2)
- `'YIN - FFT difference fn'` — cross-validation suite, d[tau] array comparison, silence, noise
- `'YIN - integration'` — all three changes active together on the full note set (A0 through C7)

**Implementation Notes:**
- All FFT code is **hand-rolled Cooley-Tukey** inlined directly in `static/game/yin.js`. No external library, no CDN import, no vendored file — plain ES module, no bundler.
- Constructor additions: `this._fftSize = nextPow2(2 * this.windowSize)` (where `nextPow2` is a pure function computing the next power of 2). Pre-allocate: `this._fftRe`, `this._fftIm`, `this._scratchRe`, `this._scratchIm` — all `Float32Array(this._fftSize)`.
- `_difference(buf)` replacement: (1) copy `buf[0..windowSize]` into `_fftRe`, zero-pad `_fftRe[windowSize.._fftSize]`, zero `_fftIm`; (2) in-place FFT on `(_fftRe, _fftIm)`; (3) compute power spectrum: `re[k] = re[k]²+im[k]², im[k] = 0`; (4) in-place IFFT; (5) divide by `_fftSize`; (6) build `diff[tau]` using `d(τ) = 2·_fftRe[0] - 2·_fftRe[tau]` for `tau` in `[tauMin, tauMax]`.
- Cooley-Tukey runtime assert: add `if ((n & (n - 1)) !== 0) throw new Error('FFT size must be power of 2')` at construction time.
- `yin-worklet.js` is unchanged by this story — the worklet delegates entirely to `YinDetector.process()`.
- Cross-validation test approach: keep the original O(n²) loop as a private `_differenceReference` method only present in test builds, or compute it inline in the test file for comparison. Do not ship the O(n²) reference in production code.
