---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prds/prd-subway-scaler.md
  - architecture.md
  - ux-design-specification.md
  - https://github.com/byrongamatos/slopsmith (official setup documentation)
---

# Subway Scaler - Epic Breakdown (with E2E Testing Infrastructure)

## Overview

This document provides the epic and story breakdown for slopsmith-plugin-subway-scaler, including the new Epic 0 for E2E Testing Infrastructure to support test-driven development across all epics.

---

## Extracted Requirements

### Functional Requirements (E2E Testing Focus)

**FR-E2E-001:** E2E tests must validate that the plugin loads successfully at localhost:8000 in the Slopsmith Docker container

**FR-E2E-002:** E2E tests must verify DOM renders without errors and all required HTML elements are present

**FR-E2E-003:** E2E tests must verify no console errors or warnings during plugin operation

**FR-E2E-004:** E2E tests must validate ARIA attributes are present and correct on all interactive elements

**FR-E2E-005:** E2E tests must validate keyboard navigation (Tab, Enter, Escape) works across all HTML surfaces

**FR-E2E-006:** E2E tests must validate focus management (focus trap, focus restoration) on overlays and forms

**FR-E2E-007:** E2E tests must validate game loop execution, character movement, and score increment

**FR-E2E-008:** E2E tests must validate collision detection triggers game-over overlay with correct final score

**FR-E2E-009:** E2E tests must validate pause/resume overlay functionality and keyboard shortcuts

**FR-E2E-010:** E2E tests must validate variant track rendering and decision window timer behavior

### Non-Functional Requirements (E2E Testing)

**NFR-E2E-001:** Docker development setup must mount local repository at `/app/plugins/subway-scaler` with hot-reloading

**NFR-E2E-002:** E2E test harness must be Playwright-based with configurable browser targets (Chrome, Firefox, Safari, Edge)

**NFR-E2E-003:** Tests must execute within Slopsmith Docker container environment at localhost:8000

**NFR-E2E-004:** Test suite must complete in under 5 minutes for standard baseline tests

**NFR-E2E-005:** Test framework must provide helper utilities for common plugin interactions (setup form, game start, pause, etc.)

**NFR-E2E-006:** Test results must be machine-readable (JSON) for CI/CD integration

**NFR-E2E-007:** Tests must capture screenshots/videos on failure for debugging

### Additional Requirements (Architecture & Docker Integration)

- Docker development environment must support volume mounting from local repository
- Plugin must auto-reload when local files change
- Test harness must be able to interact with Slopsmith UI at localhost:8000
- Tests must validate plugin.json manifest, API routes, and UI rendering
- Tests must support both headless and headed browser execution for debugging
- Test infrastructure must be reusable across all Epics 1-5

### E2E Testing Requirements by Epic

**Standard E2E Test Suite** (applies to every Epic):
- Plugin loads at localhost:8000
- DOM renders without errors
- No console errors or warnings
- ARIA attributes present and correct (accessibility baseline)
- Keyboard navigation functional (Tab, Enter, Escape)
- Focus management working (focus trap, restoration)

**Epic 0 (This Epic):** E2E Testing Infrastructure
- Docker dev setup with local volume mount at `/app/plugins/subway-scaler`
- Playwright test harness and helper library
- Standard baseline test suite
- Test integration into npm scripts and CI/CD

**Epic 1:** Setup form, localStorage persistence, error handling on fetch failure

**Epic 3:** Game loop runs, character moves, score increments, collision triggers game-over

**Epic 4:** Pause overlay appears/disappears, game-over overlay shows correct score/context, keyboard/focus work

**Epic 5:** Variant track renders, decision window timer counts down, variant acceptance transitions smoothly

---

## Docker Development Setup Specification

**Environment:** Slopsmith Docker container with plugin mounted locally

**Volume Mount:**
```
Local Repository Path: {project-root}/
Container Plugin Path: /app/plugins/subway-scaler
```

**Access Point:** http://localhost:8000

**Development Features Required:**
- Hot-reload on file change
- Console error/warning visibility in browser DevTools
- ARIA attribute inspection via DevTools
- Keyboard event inspection and focus tracking

---

## Playwright Test Framework Specification

**Test Runner:** Playwright (supports Chrome, Firefox, Safari, Edge)

**Test Location:** `tests/e2e/` directory with structure:
- `tests/e2e/fixtures/` — Page objects and fixtures
- `tests/e2e/helpers/` — Plugin interaction utilities
- `tests/e2e/specs/` — Individual test files
- `tests/e2e/screenshots/` — Failure artifacts

**Helper Library Functions:**
- `startGame(config)` — Navigate setup, select settings, START
- `pauseGame()` — Trigger pause, verify overlay
- `queryElement(selector)` — Get element + ARIA attributes
- `assertAria(selector, expected)` — Verify ARIA attributes
- `assertDomPresent(selector, attributes)` — Verify DOM structure
- `screenshot(name)` — Capture for debugging

**Test Output:** JSON report for CI/CD integration

---

---

## Epic List

### Epic 0: E2E Testing Infrastructure

Developers can validate the entire plugin user journey (setup → play → pause → variant → game-over) using automated E2E tests within Slopsmith Docker environment.

**User Outcomes:**
- Developers run comprehensive E2E tests locally before committing
- CI/CD validates plugin behavior against Slopsmith UI
- All future epics (1-5) have passing E2E tests as acceptance criteria
- Docker development environment with hot-reload enables rapid iteration

**Stories:**
- 0-1: Docker Development Setup
- 0-2: Playwright Test Harness
- 0-2a: Mocked Audio Input Device
- 0-3: Standard Baseline Test Suite
- 0-4: Test Integration & Templates

**FRs Covered:** FR-E2E-001, FR-E2E-002, FR-E2E-003, FR-E2E-004, FR-E2E-005, FR-E2E-006, FR-E2E-007, FR-E2E-008, FR-E2E-009, FR-E2E-010

**NFRs Covered:** NFR-E2E-001, NFR-E2E-002, NFR-E2E-003, NFR-E2E-004, NFR-E2E-005, NFR-E2E-006, NFR-E2E-007

---

## Requirements Coverage Map

### E2E Testing Requirements → Epic 0

| Requirement | Story | Coverage |
|---|---|---|
| FR-E2E-001 | 0-2, 0-3 | Plugin loads at localhost:8000 |
| FR-E2E-002 | 0-3 | DOM renders without errors |
| FR-E2E-003 | 0-3 | No console errors/warnings |
| FR-E2E-004 | 0-3 | ARIA attributes present and correct |
| FR-E2E-005 | 0-3 | Keyboard navigation functional |
| FR-E2E-006 | 0-3 | Focus management working |
| FR-E2E-007 | 0-2a, 0-3, 0-4 | Game loop runs, character moves, score increments |
| FR-E2E-008 | 0-2a, 0-3, 0-4 | Collision triggers game-over overlay |
| FR-E2E-009 | 0-3, 0-4 | Pause/resume overlay functionality |
| FR-E2E-010 | 0-4 | Variant track and timer testing |
| NFR-E2E-001 | 0-1 | Docker dev setup with `/app/plugins/subway-scaler` mount |
| NFR-E2E-002 | 0-2 | Playwright-based test framework |
| NFR-E2E-003 | 0-1, 0-2 | Tests run in Slopsmith Docker at localhost:8000 |
| NFR-E2E-004 | 0-4 | Tests complete in < 5 minutes |
| NFR-E2E-005 | 0-2 | Helper utilities for plugin interactions |
| NFR-E2E-006 | 0-4 | Machine-readable JSON test results |
| NFR-E2E-007 | 0-2, 0-3, 0-4 | Screenshot/video capture on failure |

---

---

### Epic 0.5: E2E Coverage Review

Developers have comprehensive E2E test coverage for all implemented epics and executable ATDD acceptance tests written in advance for open epics, ensuring regressions are caught automatically and new epics ship with a green test baseline from day one.

**User Outcomes:**
- Regressions in CartSystem, DifficultyManager, overlays, and accessibility are caught by CI before merge
- Epic 5 implementer has executable acceptance tests to work against (ATDD)
- Test gaps from Epics 2 and 4 are filled without duplicating existing Epic 3 coverage

**Stories:**
- 0.5a: E2E Coverage — Epic 2 (CartSystem & DifficultyManager observable behavior)
- 0.5b: E2E Coverage — Epic 4 (Overlays, keyboard shortcuts, ARIA accessibility)
- 0.5c: ATDD Scaffold — Epic 5 (Variant track & decision window — written to fail until Epic 5 ships)

**Coverage rationale:**
- Epic 1: ✅ Already covered by `epic1-setup.spec.ts` and `ux-design-audit.spec.ts`
- Epic 2: ❌ No dedicated spec — CartSystem and DifficultyManager have no E2E tests → Story 0.5a
- Epic 3: ✅ Well covered by `epic3-game.spec.ts`, `epic3-score.spec.ts`, `audio-injection.spec.ts`, `mic-access.spec.ts`, `canvas-overlay-alignment.spec.ts`
- Epic 4: ❌ No dedicated spec — Overlays, keyboard shortcuts, and ARIA untested → Story 0.5b
- Epic 5: ⏳ Not yet implemented → ATDD scaffold → Story 0.5c

---

## Requirements Coverage Map

### E2E Testing Requirements → Epic 0

| Requirement | Story | Coverage |
|---|---|---|
| FR-E2E-001 | 0-2, 0-3 | Plugin loads at localhost:8000 |
| FR-E2E-002 | 0-3 | DOM renders without errors |
| FR-E2E-003 | 0-3 | No console errors/warnings |
| FR-E2E-004 | 0-3 | ARIA attributes present and correct |
| FR-E2E-005 | 0-3, 0.5b | Keyboard navigation functional |
| FR-E2E-006 | 0-3, 0.5b | Focus management working |
| FR-E2E-007 | 0-2a, 0-3, 0-4, 0.5a | Game loop runs, character moves, score increments |
| FR-E2E-008 | 0-2a, 0-3, 0-4, 0.5a | Collision triggers game-over overlay |
| FR-E2E-009 | 0-3, 0-4, 0.5b | Pause/resume overlay functionality |
| FR-E2E-010 | 0-4, 0.5c | Variant track and timer testing |
| NFR-E2E-001 | 0-1 | Docker dev setup with `/app/plugins/subway-scaler` mount |
| NFR-E2E-002 | 0-2 | Playwright-based test framework |
| NFR-E2E-003 | 0-1, 0-2 | Tests run in Slopsmith Docker at localhost:8000 |
| NFR-E2E-004 | 0-4 | Tests complete in < 5 minutes |
| NFR-E2E-005 | 0-2 | Helper utilities for plugin interactions |
| NFR-E2E-006 | 0-4 | Machine-readable JSON test results |
| NFR-E2E-007 | 0-2, 0-3, 0-4 | Screenshot/video capture on failure |

---

## Epic 4: Session UX & Accessibility

### Story Sequence (with prerequisites)

**Timing Refactor Stories (MUST complete before 4-2):**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 4-1 | Implement Overlay Container with RGB-Shift Glitch Animation | done | — |
| 4-T1 | Strip Python Wave Queue and Expose timing_params | todo | — |
| 4-T2 | Implement WaveScheduler.js | todo | 4-T1 |
| 4-T3 | Rework CartSystem.js and SafeZoneRenderer.js to Consume WaveScheduler | todo | 4-T2 |
| 4-T4 | Wire WaveScheduler into GameLoop and Simplify main.js | todo | 4-T3 |

**Remaining Epic 4 Stories (require 4-T1 through 4-T4):**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 4-2 | Implement Pause Overlay | review | 4-T4 |
| 4-3 | Implement Game Over Overlay | todo | 4-T4 |
| 4-4 | Implement ARIA Roles and Keyboard Navigation | todo | 4-T4 |
| 4-5 | Implement Touch Targets and Final Accessibility Audit | todo | 4-4 |

**Rationale for 4-T prerequisite block:**
Stories 4-T1 through 4-T4 eliminate the dual-clock instability between Python's `time.time()` and
JS's `performance.now()`. Pause/resume timing, wave delivery lag, and cart pop-in are all symptoms
of this split. Story 4-2 (pause overlay) depends on reliable pause/resume; without the timing
refactor it would ship on top of a broken foundation. See `architecture.md` amendment (2026-05-22).

---

## Epic 5: Variant Track System

Players can experience mid-session scale changes (variants) that feel like a real railway
switch: visually distinct, correctly timed, and seamlessly animated.

**User Outcomes:**
- Variant proposals appear at the right moment in the wave sequence (transition note timing)
- Full-fretboard traversal replaces the narrow octave-band visual — waves sweep from the
  lowest string to the highest string and back
- Track lanes are color-coded by string so the player can orient spatially without reading labels
- Accepting a variant produces a smooth continuous animation: character follows the bend,
  old tracks scroll away, new scale arrives from the horizon

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 5-1 | Wire Variant Observable State and Test Hook | done | — |
| 5-2 | Remove ATDD Scaffolding and Validate E2E | done | 5-1 |
| 5-3 | Polling Integration Coverage — Variant Lifecycle | done | 5-1 |
| 5-4 | Backend Variant Direction Logic | done | 5-3 |
| 5-5 | SceneManager Visual Refactor — Single-Lane Peel Transition | done | 5-4 |
| 5-6 | Full String Range — Wave Spawning Across All Strings | todo | 5-5 |
| 5-7 | Variant Visual Spec — Track Coloring, Spawn Timing, Transition Animation | todo | 5-6 |

---

## Epic 6: Variant Transition Cinematic & Handoff

Accepting a variant feels like a real railway switch: the character physically rides the bend,
the camera follows with cinematic ease, in-flight waves from the old scale clear naturally,
the new scale arrives from the horizon, and gameplay resumes seamlessly on the new lane after
a short breather that gives the player time to reposition fingers on the fretboard.

**User Outcomes:**
- Accepting a variant (playing the transition note) triggers a continuous, polished animation
  rather than an instant scale swap
- The character moves onto the variant track and rides the 45° bend with the camera following
- Outgoing-scale waves already in flight continue travelling until they exit the frame —
  no abrupt freeze, no pop-out
- A short "breather" on the straight variant section lets the player reposition before
  new waves arrive
- Remaining tracks of the new scale arrive from the horizon and slot into position before
  wave spawning resumes
- Backend scale state is promoted only after the new tracks are in position, so waves never
  spawn into empty or transitioning track geometry

**Depends on:** Epic 5 (5-6, 5-7) — variant proposal and visual baseline must be in place.

**Architectural decisions:**
- **Two-phase backend protocol:** Variant acceptance (note hit) and scale promotion (tracks
  landed) are separate events. New `POST /variant/promote` endpoint commits the scale swap;
  until promoted, backend continues to serve the outgoing scale. This decouples the cinematic
  timeline from backend state and prevents premature wave spawning on the new scale.
- **Soft halt:** `WaveScheduler` stops *queuing* new outgoing-scale waves at accept time, but
  in-flight waves continue rendering and travelling until off-frame. No hard freeze.
- **Breather duration:** Default ~3s on the straight section, tunable via `timing_params`
  (consistent with 4-T timing refactor). Floor gated on "all outgoing waves have cleared the
  frame" so the breather never starts while old-scale waves are still visible.
- **Camera:** Eased lerp with look-ahead through the bend, restoring to forward-facing once
  on the straight variant section.

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 6-1 | Accept-Gate State Machine & Soft Halt of Outgoing Scale | todo | 5-7 |
| 6-2 | Character Lateral Traversal Onto Variant Track | todo | 6-1 |
| 6-3 | 45° Bend Camera Follow (Eased Lerp + Look-Ahead) | todo | 6-2 |
| 6-4 | Post-Bend Breather + New Scale Track Approach | todo | 6-3 |
| 6-5 | Backend `POST /variant/promote` Endpoint & Scale Swap | todo | 6-4 |
| 6-6 | Variant Scale Wave Spawn Activation | todo | 6-5 |
| 6-7 | E2E Transition Sequence Coverage | todo | 6-6 |

**Story summaries:**

- **6-1** — Introduce transition state machine (`idle | proposed | accepted | riding | breather | promoting | active`). On transition-note hit: set `accepted`, instruct `WaveScheduler` to stop queuing new outgoing-scale waves. In-flight waves keep rendering until off-frame.
- **6-2** — Animate character X from main lane onto variant lane bound to bend-segment Z-progress (not wall-clock). Hand-off triggers on entering the incoming diagonal.
- **6-3** — Camera follows character through the 45° turn using eased lerp with a look-ahead offset along the track tangent. Restores to forward-facing once character is on the straight section.
- **6-4** — Once on straight section AND all outgoing waves have cleared frame: start breather timer (default ~3s, `timing_params.variantBreatherMs`). At breather end: spawn the remaining variant-scale tracks at the horizon and scroll them toward the play anchor.
- **6-5** — New `POST /variant/promote` route. Request schema includes variant id; response confirms new primary scale. Backend rejects promote if variant not in `accepted` state. Existing acceptance call no longer mutates primary scale.
- **6-6** — Client calls `/variant/promote` once new tracks reach play anchor. On success, `WaveScheduler` begins queuing waves for the new scale. State transitions `promoting → active`.
- **6-7** — Playwright spec: inject audio for transition note → assert state-machine phase progression, camera transform per phase, in-flight outgoing waves not frozen, no new outgoing-scale waves queued post-accept, `/variant/promote` fired only after tracks landed, new-scale waves only after promote success, no console errors.

**Open questions deferred to story creation:**
- Exact easing curve and look-ahead distance for 6-3 (tune in-engine)
- Whether breather should be skippable by player input (default: no)
- Whether `/variant/promote` should also return updated `timing_params` snapshot

---

## Epic 7: Visual Polish — World Environment & Procedural Scenery

The game world transitions from a bare track-in-void to a lived-in night city environment with a ground plane, procedural building skyline, lamppost lighting, and a vertex-shader curved-world effect that reinforces the PS1 demake aesthetic and sells the illusion of Z-movement during gameplay.

**User Outcomes:**
- The track runs through a recognizable 3D space with a floor plane, flanking buildings, and street lighting — no longer floating in void
- Procedurally generated buildings of varied heights create a convincing skyline on both sides of the tracks, selling forward-motion at speed
- Buildings leave a deliberate gap where variant geometry peels off, so the side-street metaphor reads spatially
- Lampposts in front of buildings cast warm `color-accent` light, grounding the Night City palette in the 3D scene
- Variant track geometry also has flanking buildings — both sides of the diagonals and the outside of the straight section — maintaining environmental consistency through transitions
- A vertex shader bends the world surface beneath the character, simulating a curved planet-like ground and adding retro-PS1 aesthetic authenticity

**Depends on:** Epic 6 — variant geometry (diagonals, straight sections) must exist before buildings can be placed alongside them.

**Stories:**

| Story | Title | Status | Depends on |
|---|---|---|---|
| 7-0 | Visual Conformance — Tracks, Carts & Safe Zones | todo | — |
| 7-1 | Floor Plane — Ground Surface Beneath Tracks | todo | 7-0 |
| 7-2 | Procedural Building Generation — Main Track Skyline | todo | 7-1 |
| 7-3 | Lamppost Geometry & Point Lighting | todo | 7-2 |
| 7-4 | Procedural Buildings — Variant Geometry | todo | 7-2, Epic 6 |
| 7-5 | Vertex Shader — Curved World Surface | todo | 7-1 |

### Story 7-0: Visual Conformance — Tracks, Carts & Safe Zones

As a **player**, I want the track geometry, carts, and safe-zone indicators to use the correct Night City palette colours and a polished neon-border safe-zone treatment, so the game world reads consistently before new environment elements are added.

**Background:**

The existing geometry (track lanes, cart meshes, safe-zone planes) was built for logic correctness. Before the world-environment stories layer on top, all existing elements must match the `tokens.js` Night City palette and the agreed UX safe-zone specification: a translucent plane with an opaque, slightly emissive neon border that matches the lane's string colour.

**Token additions required in `tokens.js` before implementation:**

```js
// Add to COLORS object:
DANGER: 0xFF2233,  // NPC cart threat colour — reserved solely for hazard state signals

// Add as new top-level export (parallel to STRING_COLORS):
export const STRING_SAFE_ZONE_FILLS = [
  0x330000, // 0 — Red    (darkened)
  0x332A00, // 1 — Yellow (darkened)
  0x001A33, // 2 — Blue   (darkened)
  0x331900, // 3 — Orange (darkened)
  0x003319, // 4 — Green  (darkened)
  0x260033, // 5 — Purple (darkened)
  0x330029, // 6 — Magenta(darkened)
  0x003333, // 7 — Teal   (darkened)
];
// Same index as STRING_COLORS (0 = lowest pitch string).
// Each fill is a darkened variant of the string colour for use as
// translucent safe-zone plane material. Border uses STRING_COLORS[i] at full value.

export const EMISSIVE_SAFE_ZONE_BORDER = 0.7;
// Provisional — retune after lighting stories (7-3) land.
// Designed for ACESFilmicToneMapping; do not raise above 0.8 before testing tone mapping.
```

**Acceptance Criteria:**

**Given** the game scene loads
**When** track lane geometry is rendered
**Then** each track lane surface uses `COLORS.BG_STAGE` (`0x1A1A2E`) as its base material colour
**And** no track geometry uses raw hex colour literals — all colours referenced from `tokens.js` exports

**Given** the game scene loads
**When** cart meshes are rendered
**Then** all NPC / obstacle carts use `COLORS.DANGER`
**And** no cart material references colour values outside `tokens.js` exports
**And** `COLORS.ACCENT` (`0xFFB800`) is not used on any cart — it is reserved for world lighting (lampposts)

**Given** a safe zone is active on track lane at string index `i`
**When** the safe-zone indicator is rendered
**Then** a translucent plane fills the safe-zone bounds with material colour `STRING_SAFE_ZONE_FILLS[i]`, `opacity: 0.15`, `transparent: true`, `depthWrite: false`, `polygonOffset: true`, `polygonOffsetFactor: 1`, `polygonOffsetUnits: 1`
**And** a border mesh (`EdgesGeometry` on a `PlaneGeometry` matching the fill plane) surrounds the perimeter with colour `STRING_COLORS[i]`, `emissive: STRING_COLORS[i]`, `emissiveIntensity: EMISSIVE_SAFE_ZONE_BORDER`
**And** the border mesh has `renderOrder` set 1 higher than the fill plane, guaranteeing it draws on top
**And** the safe-zone plane and border are children of the track lane group (not scene root), so they scroll with the track without manual Z translation
**And** no safe-zone geometry is visible outside the lane bounds at any camera angle

**Given** all three element types (tracks, carts, safe zones) are visible simultaneously
**When** the scene is inspected at runtime
**Then** no `MeshBasicMaterial` or `MeshStandardMaterial` constructor call contains a colour literal — all colours sourced from `tokens.js`
**And** the browser console shows zero Three.js warnings attributable to these elements

**Out of scope for this story:** floor plane, buildings, lampposts, vertex shader (covered in 7-1 through 7-5). Safe-zone pulse animation (emissive oscillation) noted as backlog item for post-7-1.

**Implementation notes:**
- `EdgesGeometry` must wrap a `PlaneGeometry` (not `BoxGeometry`) to produce only the 4 perimeter edges — no internal diagonals
- `EMISSIVE_SAFE_ZONE_BORDER = 0.7` is provisional; add an inline comment noting tone-mapping dependency so future devs do not raise it blindly
- `COLORS.DANGER` is reserved for transient hazard signals only — do not reuse for UI warnings or low-health indicators

### Story 7-1: Floor Plane — Ground Surface Beneath Tracks

As a **player**, I want a ground plane visible beneath the track geometry, so the world feels grounded rather than floating in void.

**Acceptance Criteria:**

**Given** the game scene loads
**When** the initial track geometry is rendered
**Then** a flat shaded ground plane is visible beneath all track lanes
**And** the floor extends outward to at least 3× the track span width on each side
**And** the floor material uses `color-bg-stage` from the Night City palette
**And** the floor scrolls with the track (Z-texture animation consistent with cart speed)
**And** the floor plane renders at a Z position below the lowest track surface
**And** no floor geometry protrudes above the track surface at any camera angle

### Story 7-2: Procedural Building Generation — Main Track Skyline

As a **player**, I want procedurally generated buildings of varied heights flanking both sides of the main track, so the environment feels like a city and Z-movement reads convincingly.

**Acceptance Criteria:**

**Given** the game scene loads
**When** the main track geometry is rendered
**Then** procedurally generated box buildings appear on both sides of the track
**And** buildings are positioned at least 3 track-widths from the outermost track lane
**And** buildings vary in height (randomized within configurable min/max range)
**And** buildings use flat-shaded low-poly materials in the Night City palette (dark silhouettes with occasional lit-window accent)
**And** there is a clear gap in the building row where variant track geometry peels off (side-street gap)
**And** buildings scroll in Z with the world (they are part of the moving environment)
**And** buildings are generated in a pool and recycled (popped behind camera, re-randomized at horizon) to avoid unbounded memory growth
**And** the building density does not impact 60fps rendering (batch geometry or instancing where beneficial)

### Story 7-3: Lamppost Geometry & Point Lighting

As a **player**, I want lampposts in front of the buildings emitting warm `color-accent` light, so the Night City atmosphere is reinforced and the scene has a grounded lighting source.

**Acceptance Criteria:**

**Given** the game scene loads
**When** buildings are rendered on both sides of the track
**Then** lamppost geometry is placed along the street edge (between track edge and building line)
**And** each lamppost emits a warm `#FFB800` (`color-accent`) point or spot light
**And** lampposts are spaced at regular intervals matching building density
**And** lamppost light reaches the track surface (visible glow or illumination on ground plane)
**And** lampposts scroll with the building environment (part of the same pool/recycle loop)
**And** the light count is limited or baked (point lights per lamppost would exceed typical WebGL budgets — use spot lights with distance cutoff, or emissive geometry with a glow quad)

### Story 7-4: Procedural Buildings — Variant Geometry

As a **player**, I want buildings alongside the variant track sections (both sides of diagonals and the outside of straight sections), so the environment remains consistent during variant transitions.

**Acceptance Criteria:**

**Given** a variant is proposed
**When** the variant track geometry appears (diagonals + variant straight section)
**Then** procedural buildings flank both sides of the diagonal track sections
**And** buildings flank the outside edge of the variant straight section
**And** building density and height variance match the main track aesthetic
**And** variant-section buildings scroll in Z with same speed as the variant track
**And** buildings recycle into the pool when they pass behind the camera
**And** no building geometry intersects with cart collision zones or track safe zones

### Story 7-5: Vertex Shader — Curved World Surface

As a **player**, I want the world surface (floor + track area) to appear slightly curved, like running on a cylindrical planet surface, adding PS1-era visual authenticity.

**Acceptance Criteria:**

**Given** the game scene renders
**When** the ground plane and track geometry are drawn
**Then** a custom vertex shader applies a cylindrical bend to the world geometry (floor, track surface, building bases)
**And** the bend is subtle — curvature radius configurable, default such that the horizon appears ~5-10° below a flat plane within visible draw distance
**And** building geometry above ground level remains upright (only base positions follow the curve; vertical extrusion stays perpendicular to the curve tangent)
**And** horizon fog or background ring geometry is rendered at the lowered horizon line produced by the curve
**And** horizon fog uses `color-bg-void` (#0D0D1A) fading to transparent toward the camera — within Night City palette, no external color
**And** the shader does not reduce frame rate below 60fps (benchmarked with 200+ building instances)
**And** the shader gracefully handles the scrolling/recycling of geometry (vertex positions update correctly as objects move in Z)
**And** the curved world effect is toggleable via a constant in `tokens.js` (for debugging/comparison)

---

## Epic 7 Requirements Coverage Map

| Requirement | Story | Coverage |
|---|---|---|
| FR-VP-000: Existing geometry (tracks, carts, safe zones) uses Night City palette tokens | 7-0 | Token conformance, neon border safe zones |
| FR-VP-001: Floor plane rendered beneath tracks | 7-1 | Ground surface with scrolling texture |
| FR-VP-002: Procedural buildings flanking main tracks at 3-track distance | 7-2 | Skyline generation, pool recycling, variant gap |
| FR-VP-003: Lampposts with `color-accent` lighting | 7-3 | Point/spot lights, pool recycling, light budget |
| FR-VP-004: Buildings on variant geometry (diagonals + straight) | 7-4 | Variant building placement, density match |
| FR-VP-005: Vertex shader curved world surface | 7-5 | Cylindrical bend, performance benchmark, toggle |
| NFR-001 (60 FPS) | 7-2, 7-3, 7-4, 7-5 | Instancing, light budget, shader benchmark |
| NFR-002 (Memory < 500MB) | 7-2, 7-3, 7-4 | Pool recycling, no unbounded growth |
