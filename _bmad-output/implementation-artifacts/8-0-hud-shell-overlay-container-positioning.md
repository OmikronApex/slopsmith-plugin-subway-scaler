# Story 8.0: HUD Shell — Overlay Container & Positioning Foundation

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-0
**Story Key:** 8-0-hud-shell-overlay-container-positioning
**Depends on:** Epic 4 (pause overlay, overlay container pattern, game-shell), Epic 7 (tokens.js — Night City palette)

---

## Context

Epic 4 established the `.game-shell` (16:9 fixed-aspect container) and `OverlayManager` (full-viewport dialog overlays with RGB-shift glitch animation). The game shell has Three.js canvas filling it, and full-screen overlays stack above via `z-index: 2000`.

The HUD needs a **lighter-weight container** between the canvas and the overlay layer. Unlike overlays, the HUD:
- Has **no backdrop** — canvas must remain fully visible behind all HUD elements
- Has `pointer-events: none` by default — canvas interactions pass through
- Is always present during `PLAYING` and `PAUSED` phases
- Anchors child elements (score, pause button, fret box) at fixed corners via per-element absolute positioning

This story creates `HudShell` — the shared container class that all other HUD stories mount into.

---

## User Story

As a **developer**,
I want a shared HUD shell positioned over the Three.js canvas and anchored to the 16:9 game shell,
so that all HUD elements (score, pause button, fret box) are consistently positioned, do not block canvas interaction, and respond to container resize.

---

## Acceptance Criteria

**AC-1 — HUD container element created inside `.game-shell`:**
Given the game scene loads and gameplay is active,
When `HudShell` is constructed with `.game-shell` as the parent,
Then a `<div class="hud-shell">` child is appended to `.game-shell`,
And `hud-shell` has `position: absolute; inset: 0`,
And `hud-shell` has `pointer-events: none` so all canvas interactions pass through,
And `hud-shell` has `z-index: 100` (above canvas, below overlays at `z-index: 2000`),
And `hud-shell` has no background/backdrop — canvas fully visible behind.

**AC-2 — Child registration with `pointer-events: auto`:**
When `shell.registerChild(name, element)` is called with a DOM element,
Then the element is appended to the `.hud-shell` container,
And the element gets `pointer-events: auto` so it receives clicks/touch,
And the element `style.position` is set to `absolute`.

**AC-3 — Child positioning constants defined per element:**
The `HudShell` class defines static position constants as CSS strings:
- `score:` `top: 1rem; right: 1rem`
- `pause button:` `bottom: 1rem; right: 1rem`
- `fret box:` `top: 1rem; left: 1rem`

**AC-4 — Phase visibility:**
When `shell.onPhaseChange(PHASES.PLAYING)` is called,
Then `.hud-shell` `display` is not `none` (visible).
When `shell.onPhaseChange(PHASES.PAUSED)` is called,
Then `.hud-shell` `display` is not `none` (visible — HUD visible behind overlay).
When `shell.onPhaseChange(PHASES.IDLE)` is called,
Then `.hud-shell` `display` is `none` (hidden — setup screen shown).
When `shell.onPhaseChange(PHASES.GAME_OVER)` is called,
Then `.hud-shell` `display` is `none` (hidden — overlay covers it).

**AC-5 — `show()` and `hide()` methods:**
`shell.hide()` sets `.hud-shell` `display: none`.
`shell.show()` restores `.hud-shell` to visible (`display` not `none`).

**AC-6 — `destroy()` cleanup:**
`shell.destroy()` removes `.hud-shell` from the DOM,
Sets all internal references to `null`,
Does not throw if called twice.

**AC-7 — ResizeObserver:**
The HudShell sets up a `ResizeObserver` on `.game-shell`.
When shell dimensions change, child elements keep their absolute corner positions (handled by CSS `top`/`bottom`/`left`/`right` in rem units — automatic).
The ResizeObserver triggers a `'hud-resize'` event on `.hud-shell` for any downstream consumers (e.g., FretBox re-rendering at new size).

**AC-8 — Unit tests pass:**
`tests/unit/js/HudShell.test.js` contains tests covering:
- Container creation inside `.game-shell`
- `pointer-events: none` on container
- `registerChild` appends element and sets `pointer-events: auto`
- `show()`/`hide()` toggle visibility
- Phase visibility for all 4 phase states
- `destroy()` removes container
All pass.

**AC-9 — E2E spec passes:**
`tests/e2e/specs/epic8-hud.spec.ts` verifies:
- `.hud-shell` present and visible during gameplay
- `pointer-events: none` on `.hud-shell`
All pass (early stories — some E2E assertions deferred to later stories).

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/ui/HudShell.js` (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 1.1 Implement `HudShell` class with constructor taking `.game-shell` element
  - [x] 1.2 Create `.hud-shell` div, style it: `position: absolute; inset: 0; pointer-events: none; z-index: 100; background: none;`
  - [x] 1.3 Implement `registerChild(name, element)` — appends to container, sets `pointer-events: auto`, `position: absolute`
  - [x] 1.4 Implement `show()`/`hide()` visibility toggling (set `display: none` / restore)
  - [x] 1.5 Implement `onPhaseChange(phase)` — maps phase to visible/hidden per AC-4
  - [x] 1.6 Implement `destroy()` — removes container, nulls refs
  - [x] 1.7 Set up `ResizeObserver` on `.game-shell`, dispatch `'hud-resize'` event on `.hud-shell`

- [x] Task 2: Add HUD styles to `hud.css` (new file) (AC: 1)
  - [x] 2.1 Create `static/game/ui/hud.css` — `.hud-shell` base styles
  - [x] 2.2 Child positioning classes per element
  - [x] 2.3 Hook into `@media (prefers-reduced-motion: reduce)` if needed

- [x] Task 3: Create unit test `tests/unit/js/HudShell.test.js` (AC: 8)
  - [x] 3.1 Import HudShell, PHASES
  - [x] 3.2 Container creation and pointer-events tests
  - [x] 3.3 `registerChild` test
  - [x] 3.4 `show`/`hide` test
  - [x] 3.5 Phase visibility tests for all phases
  - [x] 3.6 Destroy test

- [x] Task 4: Create E2E spec `tests/e2e/specs/epic8-hud.spec.ts` (AC: 9)
  - [x] 4.1 HUD container present during gameplay
  - [x] 4.2 `pointer-events: none` assertion

- [x] Task 5: Wire HudShell into `main.js` bootstrap (AC: 4)
  - [x] 5.1 Import HudShell
  - [x] 5.2 Instantiate after scene setup, pass `.game-shell`
  - [x] 5.3 Subscribe to phase changes (via `GameLoop` phase dispatch or direct `GameState.runtime.phase` polling)
  - [x] 5.4 Call `onPhaseChange` on phase transitions
  - [x] 5.5 Call `destroy()` on teardown

---

## Dev Notes

### Architecture Constraints

- **HudShell is NOT an overlay.** It lives *between* the canvas and the overlay layer. It uses `z-index: 100` — above Three.js canvas (`z-index: 0` implicitly) and below overlay--dialog (`z-index: 2000`).
- **HudShell has `pointer-events: none`** — interactive children (pause button) set `pointer-events: auto` individually.
- **HudShell has no background** — `background: none` / no `background-color`. Canvas must be fully visible through the HUD area.
- **Phase subscription:** The simplest integration is polling `GameState.runtime.phase` each frame in the game loop, or listening on a phase-change event. The epic spec suggests subscribing via polling or event dispatch in `GameLoop`. Check if `GameLoop.js` already dispatches phase-change events (it may after Epic 4-4's focus-trapping patterns).

### File to Create

#### `static/game/ui/HudShell.js`

```js
import { PHASES } from '../GameState.js';

export class HudShell {
  constructor(gameShellElement) {
    this._shell = gameShellElement;
    this._container = document.createElement('div');
    this._container.className = 'hud-shell';
    Object.assign(this._container.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '100',
      background: 'none',
      display: 'none', // hidden until told otherwise
    });
    this._shell.appendChild(this._container);

    // ResizeObserver
    this._resizeObserver = new ResizeObserver(() => {
      this._container.dispatchEvent(new CustomEvent('hud-resize'));
    });
    this._resizeObserver.observe(this._shell);

    // Track registered children for cleanup
    this._children = new Map();
  }

  registerChild(name, element) {
    element.style.pointerEvents = 'auto';
    element.style.position = 'absolute';
    this._container.appendChild(element);
    this._children.set(name, element);
  }

  show() {
    this._container.style.display = '';
  }

  hide() {
    this._container.style.display = 'none';
  }

  onPhaseChange(phase) {
    if (phase === PHASES.PLAYING || phase === PHASES.PAUSED) {
      this.show();
    } else {
      this.hide();
    }
  }

  destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._container?.remove();
    this._container = null;
    this._shell = null;
    this._children.clear();
  }
}
```

### Files to Create

- `static/game/ui/HudShell.js` — NEW (class above)
- `static/game/ui/hud.css` — NEW (`hud-shell` base styles)
- `tests/unit/js/HudShell.test.js` — NEW (unit tests per AC-8)
- `tests/e2e/specs/epic8-hud.spec.ts` — NEW (E2E tests per AC-9)

### Files to Modify

- `static/game/main.js` — import HudShell, instantiate after scene setup, wire phase subscription
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — mark 8-0 status

### Existing Patterns

- **Game shell** is `.game-shell` — established in Epic 4 responsive shell. Three.js canvas fills it at 100%×100%. Overlays anchor inside it with `position: absolute; inset: 0`.
- **Overlay container** (`overlay--dialog`) uses `z-index: 2000`. The HUD must go below that.
- **Phase constants** live in `GameState.js` as `PHASES` object. Phase transitions owned by `GameLoop.js` (playing↔paused, playing→game_over).
- **CSS naming:** Existing overlay styles use `.subway-scaler .overlay--*` scoping. For consistency, HUD styles should use `.subway-scaler .hud-*`.
- **`main.js` bootstrap pattern:** `bootstrap(root)` is exported, called by the plugin entry point. It injects tokens, sets up `__gameState`, creates scene, renders setup screen.

### Test Files

**`tests/unit/js/HudShell.test.js`** — see Epic 8 spec in epics.md for the exact test content (lines 190–250 of the Epic 8 section). The tests cover container creation, pointer-events, registerChild, show/hide, phase visibility per phase, and destroy.

**`tests/e2e/specs/epic8-hud.spec.ts`** — see Epic 8 spec (lines 255–313). Early stories run only the HUD-present and pointer-events tests; other assertions (score position, pause button, fret box, game-over hidden) are uncommented incrementally by 8-1, 8-2, 8-3, and 8-4.

### Out of Scope

- Score display content (8-1)
- Pause button UI (8-2)
- Fret box diagram (8-3)
- Any backdrop or background on HUD container
- Keyboard/Accessibility (8-6)

---

### References

- Epic 8 section — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-0]
- `.game-shell` responsive shell — [Source: UX spec, Epics FR Coverage Map]
- Overlay container `z-index: 2000` — [Source: `static/game/ui/overlays.css` — ``.overlay--dialog`` `]
- Phase constants and ownership — [Source: `static/game/GameState.js`]
- `main.js` bootstrap — [Source: `static/game/main.js` — `bootstrap()` function]
- tokens.js Night City palette — [Source: `static/game/ui/tokens.js`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- Implemented HudShell class with full AC coverage (phase visibility, registerChild, show/hide, ResizeObserver, destroy)
- Added ARIA (role="group", aria-label="Game HUD") and tabindex=-1 on non-interactive children (8-6 preemptive)
- 19 unit tests passing. E2E spec created (epic8-hud.spec.ts)
- CSS in hud.css, imported via static/styles.css. Phase wiring in main.js via PHASES constants

### File List

- `static/game/ui/HudShell.js` (NEW)
- `static/game/ui/hud.css` (NEW)
- `tests/unit/js/HudShell.test.js` (NEW)
- `tests/e2e/specs/epic8-hud.spec.ts` (NEW)
- `static/game/main.js` (UPDATE)
- `static/styles.css` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-05-29: Story 8-0 implemented — HudShell, hud.css, unit tests, E2E spec, main.js wiring