---
title: Implementation Readiness Assessment Report
date: 2026-05-20
project: slopsmith-plugin-subway-scaler
stepsCompleted: [1, 2, 3, 4, 5, 6]
documentsInventoried:
  prd: _bmad-output/planning-artifacts/prds/prd-subway-scaler.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  ux_design: _bmad-output/planning-artifacts/ux-design-specification.md
  epics: _bmad-output/planning-artifacts/epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-20
**Project:** slopsmith-plugin-subway-scaler

---

## PRD Analysis

### Functional Requirements

| ID | Name | Description | Priority |
|----|------|-------------|----------|
| FR-001 | Session Start | Player selects scale (15-scale catalog), root note (MIDI 21-108), difficulty (Easy/Medium/Hard), instrument (guitar 6-string / bass 4-string); session begins immediately on confirm | High |
| FR-002 | Note Visualization | 3D track system showing fret/string positions; track count = fret span of scale (clamped 3-12); safe zone = distance between cart waves; color coding by string (string 1 = highest pitch) | High |
| FR-003 | Correct Note Detection | Real-time audio input via YIN algorithm; tolerance: 50 cents (configurable); confidence threshold: 0.8; stability frames: 3; character moves to matching track instantly | High |
| FR-004 | Score Calculation | Base points: 100 × difficulty multiplier; no timing penalty; visual sparkle/glow feedback; safe zone fades after correct note | Medium |
| FR-005 | Difficulty Scaling | 5% speed multiplier per-note; configurable max speed cap; cart frequency = base_duration / multiplier; spacing factor: 0.4 (carts closer) | High |
| FR-006 | Collision Detection | Collision with cart on wrong track → "run over" animation → session ends immediately → final score displayed; optional restart | High |
| FR-007 | Visual Feedback | Sparkle/glow on correct note; highlighted safe zone; shadow/dim on cart approach; confetti/particles at session end | Low |
| FR-008 | Variant Switching | Offered every 2 octave loops; options: +5 semitones (up), -2 semitones (down); player plays target root note; visual guide highlights target track | Medium |

**Total FRs: 8**

### Non-Functional Requirements

| ID | Category | Description |
|----|----------|-------------|
| FR-011 | Performance | 60 FPS minimum; prune wave queue every frame (10s lookback); no frame drops during texture scroll or variant switching |
| FR-012 | Performance | Memory usage < 500MB RAM; prune old scene graph frames; recycle particle effects |
| FR-013 | Reliability | Invalid note input: log and ignore; audio device disconnect: reconnect or show error; failed texture load: use fallback; plugin crash: restart game instance |
| FR-014 | Reliability | Save session state to localStorage; resume on reconnect; clear state on session end |
| FR-015 | Accessibility | Support professional audio interfaces, USB-MIDI controllers, Slopsmith centralized detection (future); configurable sensitivity |
| FR-016 | Usability | Persist last scale, root note, difficulty, audio device preferences; reset-to-defaults option |

**Total NFRs: 6**

### Additional Requirements (Constraints)

| ID | Description |
|----|-------------|
| C-001 | Slopsmith plugin API compliance; no external runtime dependencies; Docker + desktop compatible |
| C-002 | YIN audio detection (pluggable adapter pattern); device IDs as Base64 strings |
| C-003 | Browser support: Chrome, Firefox, Edge, Safari; no WebGL fallback required |
| C-004 | Open source (MIT or similar); free, no monetization |
| C-005 | No scale switching mid-run; single-scale mastery focus; environment/themes deferred |

### PRD Completeness Assessment

The PRD is well-structured with 8 FRs and 6 NFRs clearly identified. Open questions exist (OQ-001 through OQ-005) around session completion definition, tutorial flow, max cart speed, and variant frequency — these are acknowledged as unresolved but deferred to technical spec or backlog, which is acceptable for implementation readiness. The PRD adequately specifies the core gameplay loop, audio detection approach, and platform constraints.

---

## Epic Coverage Validation

### Coverage Matrix

| FR / NFR | PRD Description | Epic Coverage | Status |
|----------|----------------|---------------|--------|
| FR-001 | Session Start: scale selection, root randomisation (fret 5–8), difficulty, instrument | Epic 1 — Stories 1.4, 1.6 | ✅ Covered |
| FR-002 | Note Visualization: 3D track, safe zones, string colour coding, fret span clamped 3-12 | Epic 3 — Story 3.2 | ✅ Covered |
| FR-003 | Correct Note Detection: YIN, 50-cent tolerance, confidence 0.8, 3 stability frames | Epic 3 — Story 3.3, 3.4 | ✅ Covered |
| FR-004 | Score Calculation: 100 × difficulty multiplier per correct note | Epic 3 — Stories 3.4, 3.6 | ✅ Covered |
| FR-005 | Difficulty Scaling: 5% speed multiplier per note, configurable cap, cart frequency | Epic 2 (DifficultyManager) + Epic 3 wiring | ✅ Covered |
| FR-006 | Collision Detection: cart collision → game-over animation → session end | Epic 3 — Stories 3.2, 3.4 (GAME_OVER phase) | ✅ Covered |
| FR-007 | Visual Feedback: sparkle/glow on correct note, safe zone fade | Epic 3 — Story 3.7 | ✅ Covered |
| FR-008 | Variant Switching: timed offer, +5/-2 semitone options, visual guide, root note acceptance | Epic 5 — Stories 5.1–5.4 | ✅ Covered |
| NFR-001 (FR-011) | 60 FPS minimum; no frame drops during texture scroll or variant switching | Epic 3 (GameLoop), Epic 5 (variant) | ✅ Covered |
| NFR-002 (FR-012) | Memory < 500MB; scene graph pruning; particle recycling | Epic 3 — Stories 3.1, 3.7 | ✅ Covered |
| NFR-003 (FR-013) | Error recovery: audio disconnect → auto-pause → reconnect overlay | Epic 3 (phase propagation) + Epic 4 — Story 4.2 | ✅ Covered |
| NFR-004 (FR-014) | Session state to localStorage; resume on reconnect; clear on clean end | Epic 1 (settings) + Epic 4 — Stories 4.2, 4.3 | ✅ Covered |
| NFR-005 (FR-015) | Pluggable audio adapter: professional interfaces, USB-MIDI, future Slopsmith API | Epic 3 — Story 3.3 | ✅ Covered |
| NFR-006 (FR-016) | Persist scale/difficulty/instrument to `subway-scaler-settings`; reset to defaults | Epic 1 — Stories 1.6, 1.2 | ✅ Covered |
| C-001 / NFR-007 | Slopsmith plugin API compliance; no external runtime dependencies | Epic 1 (architecture setup) | ✅ Covered |
| C-003 / NFR-008 | Browser support: Chrome, Firefox, Edge, Safari | Epic 1 (no external deps + vendor font) | ✅ Covered |

### UX Design Requirement Coverage

| UX-DR | Description | Epic Coverage | Status |
|-------|-------------|---------------|--------|
| UX-DR1–3 | tokens.js: Night City palette + STRING_COLORS + injectTokens() | Epic 1 — Story 1.3 | ✅ Covered |
| UX-DR4–5 | Setup screen UI; root label "randomised fret 5–8"; no root selector | Epic 1 — Story 1.6 | ✅ Covered |
| UX-DR6 | First-wave tutorial: slow cart + text cue, fades on first correct note | Epic 3 — Story 3.5 | ✅ Covered |
| UX-DR7 | Fret labels neutral grey; STRING_COLORS on safe zones only | Epic 3 — Story 3.2 | ✅ Covered |
| UX-DR8 | Variant spatial direction: lower fret = LEFT, higher fret = RIGHT | Epic 5 — Story 5.2 (scaffolded in 3.2) | ✅ Covered |
| UX-DR9 | RGB-shift glitch `@keyframes` + `prefers-reduced-motion` fallback | Epic 4 — Story 4.1 | ✅ Covered |
| UX-DR10 | Pause overlay: RESUME primary + "Quit to Menu" tertiary | Epic 4 — Story 4.2 | ✅ Covered |
| UX-DR11 | Game over overlay: score + context + RESTART + MAIN MENU | Epic 4 — Story 4.3 | ✅ Covered |
| UX-DR12 | Audio disconnect overlay: auto-triggered by GameLoop on AudioDetectorError | Epic 4 — Story 4.2 (audio disconnect variant) | ✅ Covered |
| UX-DR13 | Score display: HTML overlay, top-right, aria-live="polite", accent pulse | Epic 3 — Story 3.6 | ✅ Covered |
| UX-DR14 | Decision window timer bar: CSS width transition, transitionend → hideVariant | Epic 5 — Story 5.3 | ✅ Covered |
| UX-DR15–16 | ARIA roles (form/radiogroup/radio/dialog); focus trap; 44×44px touch targets | Epic 4 — Stories 4.4, 4.5 | ✅ Covered |
| UX-DR17 | Vendored monospace font at `static/game/fonts/`; @font-face in CSS | Epic 1 — Story 1.5 | ✅ Covered |
| UX-DR18 | Responsive breakpoints: <600px compact, ≥600px standard; max-width 480px | Epic 1 — Story 1.5 | ✅ Covered |

### Missing Requirements

**None.** All 8 FRs, all 6 NFRs (including constraints C-001, C-003), and all 18 UX-DRs trace to at least one story.

### Coverage Statistics

- Total PRD FRs: 8
- FRs covered in epics: 8
- FR coverage: **100%**
- Total NFRs (incl. constraints C-001, C-003): 8
- NFRs covered: 8
- NFR coverage: **100%**
- Total UX-DRs: 18
- UX-DRs covered: 18
- UX-DR coverage: **100%**

---

## UX Alignment Assessment

### UX Document Status

**Found:** `_bmad-output/planning-artifacts/ux-design-specification.md` — complete (stepsCompleted: 1–14)

### UX ↔ PRD Alignment

| Check | Result |
|-------|--------|
| Session setup screen (FR-001) | ✅ UX defines full setup UI, scale selector, difficulty/instrument toggles |
| Note visualization as 3D tracks (FR-002) | ✅ UX specifies PS1 demake Night City perspective track aesthetic |
| Real-time audio detection (FR-003) | ✅ UX principle: "Sound before sight" — audio is the controller |
| Score display (FR-004) | ✅ UX-DR13: HTML overlay, top-right, aria-live, accent pulse |
| Visual feedback (FR-007) | ✅ UX-DR confirms sparkle/glow on correct note |
| Variant spatial guide (FR-008) | ✅ UX-DR8 adds spatial direction convention (left/right) not in PRD |

**One deliberate refinement — PRD vs UX divergence on root note:**
- PRD FR-001 states: "Choose root note (MIDI 21-108)" — player-selectable
- UX design + epics: root note **randomised** to fret 5–8, not player-selectable; setup form shows informational label only
- **Assessment:** This was a deliberate product decision made during UX design and reflected consistently in all epics. The PRD has not been updated, but the epics' Requirements Inventory supersedes it. **No implementation risk** — epics are the source of truth. PRD may be updated post-implementation as a housekeeping item.

### UX ↔ Architecture Alignment

| UX Requirement | Architecture Support | Status |
|----------------|---------------------|--------|
| tokens.js single source of truth | Explicitly in module split; `static/game/ui/tokens.js` listed | ✅ Aligned |
| Three.js scene fills 100% viewport | SceneManager owns renderer + resize handler | ✅ Aligned |
| HTML overlays absolutely positioned over canvas | Architecture specifies HTML layer over Three.js canvas | ✅ Aligned |
| RGB-shift CSS animations | Pure CSS @keyframes — no special arch needed | ✅ Aligned |
| ARIA roles on HTML surfaces | Standard browser, no architectural constraint | ✅ Aligned |
| Vendored font at `static/game/fonts/` | Static files served by FastAPI; no external deps | ✅ Aligned |
| Canvas texture for fret labels and tutorial text | Three.js canvas texture — supported by SceneManager | ✅ Aligned |
| VARIANT_DIRECTION constants in TrackSystem.js | Defined in Story 3.2, used in Story 5.2 | ✅ Aligned |
| Decision window timer bar (HTML element) | HTML layer over canvas — supported by arch | ✅ Aligned |

**Architecture note:** Step 5 of the architecture document incorrectly stated JS tests go in `static/game/tests/`. This was later corrected to `tests/unit/js/`. All epics use the corrected location. No implementation risk.

### Warnings

None that affect implementation. One housekeeping note:
- PRD FR-001 root note field description should be updated to reflect the "randomised fret 5–8" decision once implementation is complete.

---

## Epic Quality Review

### Epic Structure Validation

#### Best Practices Compliance Checklist

| Epic | User Value | Independent | Stories Sized | No Fwd Deps | Clear ACs | FR Traceability |
|------|-----------|-------------|---------------|-------------|-----------|-----------------|
| Epic 1: Foundation & Session Setup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 2: Game Engine Migration | ⚠️ Developer-only | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 3: Core Gameplay Loop | ✅ | ✅ (needs E1+E2) | ✅ | ✅ | ✅ | ✅ |
| Epic 4: Session UX & Accessibility | ✅ | ✅ (needs E3) | ✅ | ✅ | ✅ | ✅ |
| Epic 5: Variant System | ✅ | ✅ (needs E2+E3) | ✅ | ✅ | ✅ | ✅ |

---

### 🔴 Critical Violations

**None found.**

---

### 🟠 Major Issues

#### ISSUE-01: DifficultyManager.tick() call frequency conflict between Story 2.3 and Story 3.4

**Story 3.4 GameLoop tick sequence states:**
> "Each tick calls: `AudioDetector.detect()` → update `GameState.runtime.currentNote` → `CartSystem.update(deltaTime)` → `DifficultyManager.tick()` → `SceneManager.render()`"

This implies `DifficultyManager.tick()` is called **every rAF frame** (~60 times/second).

**Story 2.3 DifficultyManager states:**
> "When `DifficultyManager.tick()` is called after each correct note"

This implies `DifficultyManager.tick()` is called **only on correct note events** (once per detected note).

**Impact:** If DifficultyManager.tick() unconditionally increments speed every frame, speed will ramp to the cap in under a second. If it only increments on note events, calling it every frame is wasteful (and potentially incorrect if tick() has side effects).

**Recommendation:** Align the two stories. Either:
- (a) GameLoop calls `DifficultyManager.tick(noteDetected: boolean)` every frame, and DifficultyManager only increments when `noteDetected === true`; or
- (b) CartSystem notifies DifficultyManager on note detection (event/callback), and GameLoop does not call tick() directly.

Option (a) is simpler and keeps the tick sequence readable. This must be resolved before Story 3.4 begins.

**Severity:** 🟠 Major — ambiguous contract between two modules will cause implementation divergence.

---

### 🟡 Minor Concerns

#### CONCERN-01: Epic 2 delivers developer value only, not user-visible value

Epic 2 ("Game Engine Migration") is a pure technical epic — the user cannot observe its output. Story 2.1 produces a documentation file; Stories 2.2 and 2.3 produce isolated JS modules with no UI.

**Assessment:** Acceptable and deliberate in this brownfield project. The alternative (embedding the migration into Epic 3) was explicitly rejected during planning due to reverse-engineering risk. The choice to isolate the migration as its own epic is sound. No remediation needed, but the epic's value statement reads better as a developer precondition than a user-facing deliverable.

#### CONCERN-02: Story 1.1 and 2.1 are developer stories (not user stories)

Story 1.1 (file renames) and Story 2.1 (analysis document) deliver zero user-visible value. They are implementation prerequisites.

**Assessment:** Common and acceptable in brownfield setups. Epic 1 as a whole delivers user value (setup screen), so Story 1.1 as the enabling foundation story is fine. Story 2.1 is an analysis spike — unusual but explicitly called out as a mandatory pre-condition for 2.2/2.3.

#### CONCERN-03: Story 1.6 has no AC for session-config fetch failure at game start

Story 1.6 covers START button behaviour, including root MIDI randomisation and localStorage write. However, it does not specify what happens if `GET /game/session-config` returns an error after START is tapped.

**Assessment:** FR-013 (Error Recovery) is covered in Epic 3 (GameLoop error handling). However, the fetch happens at the boundary of Epic 1 and Epic 3, and no story explicitly owns the "session-config fails at game start" error path. This is a minor gap — the user would see no feedback.

**Recommendation:** Add one AC to Story 1.6 or Story 3.4: "Given `GET /game/session-config` returns an error, When START is triggered, Then an error message is displayed and the setup screen remains visible."

#### CONCERN-04: tests/integration/test_game_loop.js naming collision risk

The architecture directory structure shows `tests/integration/test_game_loop.py` as an **existing** Python integration test. Story 3.8 creates `tests/integration/test_game_loop.js` — same directory, same base name, different extension.

**Assessment:** No actual filesystem conflict (different extensions), but could confuse developers or test runners that glob `test_game_loop.*`. Consider naming the JS integration test `tests/integration/test_game_loop_e2e.js` or similar.

#### CONCERN-05: Story 3.2 forward reference to Epic 5

Story 3.2 scaffolds `VARIANT_DIRECTION` constants but notes: "documented for Epic 5 use, not yet wired to variant logic." This is an intentional forward reference.

**Assessment:** Acceptable. The scaffold is read-only setup with no behaviour — Epic 3 is not broken if Epic 5 never runs. The explicit note prevents confusion.

### Story Quality Summary

| Story | Clear User Value | Independent | Given/When/Then ACs | Error Conditions | Status |
|-------|-----------------|-------------|---------------------|-----------------|--------|
| 1.1 | Developer only | ✅ | ✅ | N/A | ✅ |
| 1.2 | Developer | ✅ | ✅ | N/A | ✅ |
| 1.3 | Developer | Needs 1.1 | ✅ | N/A | ✅ |
| 1.4 | Backend | ✅ | ✅ | ✅ (404, 422) | ✅ |
| 1.5 | Developer | Needs 1.1 | ✅ | N/A | ✅ |
| 1.6 | Player | Needs 1.4, 1.5 | ✅ | ⚠️ Missing fetch-fail AC | ⚠️ |
| 2.1 | Developer | Needs 1.1 | ✅ | N/A | ✅ |
| 2.2 | Developer | Needs 2.1 | ✅ | Collision, score | ✅ |
| 2.3 | Developer | Needs 2.1 | ✅ | Speed cap | ✅ |
| 3.1 | Developer | Needs 1.2, 1.3 | ✅ | N/A | ✅ |
| 3.2 | Player | Needs 3.1, 1.4 | ✅ | N/A | ✅ |
| 3.3 | Developer | Needs 1.1 | ✅ | Error propagation | ✅ |
| 3.4 | Player | Needs 2.2, 2.3, 3.1–3.3 | ✅ | Audio error, GAME_OVER | ⚠️ tick() conflict |
| 3.5 | Player | Needs 3.4 | ✅ | N/A | ✅ |
| 3.6 | Player | Needs 3.4 | ✅ | Overlay visibility | ✅ |
| 3.7 | Player | Needs 3.4 | ✅ | Disposal/memory | ✅ |
| 3.8 | Developer | Needs 3.1–3.7 | ✅ | N/A | ✅ |
| 4.1 | Player | Needs 3.4 | ✅ | reduced-motion | ✅ |
| 4.2 | Player | Needs 4.1 | ✅ | Audio disconnect variant | ✅ |
| 4.3 | Player | Needs 4.1 | ✅ | Escape key no-op | ✅ |
| 4.4 | Player | Needs 4.2, 4.3 | ✅ | Focus trap | ✅ |
| 4.5 | Player | Needs 4.4 | ✅ | Contrast, axe audit | ✅ |
| 5.1 | Developer | Needs 2.3 | ✅ | MIDI range validation | ✅ |
| 5.2 | Player | Needs 3.2, 5.1 | ✅ | hideVariant, read-only | ✅ |
| 5.3 | Player | Needs 5.2 | ✅ | reduced-motion | ✅ |
| 5.4 | Player | Needs 5.1–5.3 | ✅ | Score context line | ✅ |

**Total stories reviewed: 26**
**Fully clean: 23 | Minor warnings: 2 (1.6, 3.4) | Major issues: 1 (3.4 tick conflict)**

---

## Summary and Recommendations

### Overall Readiness Status

**READY WITH CONDITIONS**

Planning artifacts are comprehensive, internally consistent, and well-structured. All requirements trace to stories. One major contractual ambiguity must be resolved before Story 3.4 begins, but does not block Epics 1 or 2.

### Critical Issues Requiring Immediate Action

None that block starting Epic 1 or Epic 2.

### Recommended Next Steps

1. **Resolve ISSUE-01 before Story 3.4 begins:** Align `DifficultyManager.tick()` call semantics between Story 2.3 and Story 3.4. Recommended resolution: GameLoop calls `DifficultyManager.tick(noteDetected: boolean)` each frame; DifficultyManager increments speed only when `noteDetected === true`. Update both stories' ACs to reflect this contract.

2. **Add error-handling AC to Story 1.6:** Add one AC covering the case where `GET /game/session-config` fails after the player taps START. Without this, the error path is unowned and the user gets no feedback.

3. **Clarify integration test file naming (CONCERN-04):** Rename `tests/integration/test_game_loop.js` (Story 3.8) to avoid superficial confusion with the existing `test_game_loop.py` in the same directory. Suggestion: `test_game_loop_e2e.js`.

4. **Update PRD FR-001 post-implementation (housekeeping):** The PRD states root note is player-selectable; all other documents reflect the randomised-fret-5-8 decision. Update PRD when the feature ships.

5. **Proceed to Epic 1 implementation:** All other requirements are complete, unambiguous, and implementation-ready.

### Issue Register

| ID | Severity | Epic / Story | Description | Blocked By |
|----|----------|-------------|-------------|------------|
| ISSUE-01 | 🟠 Major | 2.3 / 3.4 | DifficultyManager.tick() frame-vs-event call conflict | Blocks Story 3.4 |
| CONCERN-01 | 🟡 Minor | Epic 2 | Developer-only epic — no user-visible value | Acknowledged, justified |
| CONCERN-02 | 🟡 Minor | 1.1, 2.1 | Developer stories, not user stories | Acceptable brownfield pattern |
| CONCERN-03 | 🟡 Minor | 1.6 | Missing AC for session-config fetch failure | Should fix before Story 1.6 |
| CONCERN-04 | 🟡 Minor | 3.8 | JS integration test name collision risk | Fix before Story 3.8 |
| CONCERN-05 | 🟡 Minor | 3.2 | Forward reference to Epic 5 (scaffolding only) | Acceptable |

### Final Note

This assessment identified **6 items** across **2 severity levels**:
- 0 Critical violations
- 1 Major issue (must resolve before Story 3.4)
- 5 Minor concerns (recommended fixes, none blocking)

FR coverage: **100% (8/8 FRs, 8/8 NFRs, 18/18 UX-DRs)**.
Epic structure: Sound. Dependencies flow correctly Epic 1 → 2 → 3 → 4 → 5.
Story quality: 23/26 clean; 2 flagged for minor AC additions; 1 contract ambiguity.

**Recommendation: Proceed to Epic 1 implementation immediately. Resolve ISSUE-01 and CONCERN-03 before Sprint containing Stories 1.6 and 3.4.**

---

_Assessment completed: 2026-05-20_
_Assessor: bmad-check-implementation-readiness workflow_
