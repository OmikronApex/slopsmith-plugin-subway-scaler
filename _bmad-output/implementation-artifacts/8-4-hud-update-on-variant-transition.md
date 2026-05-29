# Story 8.4: HUD Update on Variant Transition

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-4
**Story Key:** 8-4-hud-update-on-variant-transition
**Depends on:** 8-3 (FretBox), Epic 6 (variant transition state machine, promote endpoint)

---

## Context

Epic 6 established the variant transition state machine (`accepted → riding → breather → promoting → active`) and the promote endpoint (`POST /variant/promote` returns new session data). The FretBox (8-3) is a pure renderer that draws whatever data it receives.

When a variant is accepted, the fret box needs to:
1. Fade out (200ms) as the transition begins (`accepted` phase)
2. Stay hidden during `riding`, `breather`, `promoting` phases
3. Rebuild DOM with new finger pattern using the promote response data
4. Fade in (200ms) when `active` phase is entered

The score display is unaffected — it continues to show accumulated score throughout.

This story extends `FretBox.js` with fade-out/in animation and wires it into the transition phase listener.

---

## User Story

As a **player**,
I want the fret-box diagram (and score display) to update correctly when a variant transition completes,
so the HUD reflects the new scale root without manual intervention or visual glitch.

---

## Acceptance Criteria

**AC-1 — Fade-out on accept:**
Given a variant transition is in progress (Epic 6 state machine),
When the variant accept-gate fires (`accepted` state entered),
Then the fret-box container begins a CSS opacity fade-out (200ms, `transition: opacity 200ms ease-in-out`),
And once opacity reaches 0, the fret box is hidden during `riding`, `breather`, and `promoting` states.

**AC-2 — Rebuild during breather:**
Given the variant is accepted and the breather phase is active,
When the `/variant/promote` response arrives with the new session data,
Then `fretBox.render(payload)` is called with `{notes, scale_id, root_midi, instrument_id}` from the promote response,
And the DOM is rebuilt with the new finger pattern while the fret box is still hidden (opacity 0),
And no visual flicker or partial render occurs during the rebuild.

**AC-3 — Fade-in on active:**
Given the promote is confirmed and `PHASES.ACTIVE` is entered (Epic 6 transition phase),
When new-scale waves begin spawning,
Then the fret-box container begins a CSS opacity fade-in (200ms, `transition: opacity 200ms ease-in-out`) to full opacity.

**AC-4 — No animation on variant ignore:**
Given a variant is proposed but ignored,
When the variant window expires and the variant track peels away,
Then the fret-box diagram remains unchanged (still showing the original scale pattern),
And the score display is unaffected,
And no fade-out/in animation plays.

**AC-5 — Score unaffected during transition:**
Given a variant is accepted,
When the score data is unaffected by the transition,
Then the score display continues to show the accumulated score (score is not reset on variant accept),
And the score display does not participate in the fret-box fade-out/in animation.

---

## Tasks / Subtasks

- [x] Task 1: Add fade animation to FretBox.js (AC: 1, 3)
  - [x] 1.1 Add `.fretbox-hidden` CSS class to `hud.css`: `opacity: 0; transition: opacity 200ms ease-in-out;`
  - [x] 1.2 Add `.fretbox-visible` class: `opacity: 1; transition: opacity 200ms ease-in-out;`
  - [x] 1.3 Default state: visible (`.fretbox-visible`)
  - [x] 1.4 Add `fadeOut()` method — removes `.fretbox-visible`, adds `.fretbox-hidden`
  - [x] 1.5 Add `fadeIn()` method — removes `.fretbox-hidden`, adds `.fretbox-visible`
  - [x] 1.6 Add `transitioning` property (boolean) reflecting whether fade animation is active

- [x] Task 2: Wire transition phase listener in `main.js` (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Register a `setTransitionPhaseListener` callback that handles fret-box animation:
    - `accepted` → call `fretBox.fadeOut()`
    - `promoting` → call `fretBox.render(promoteResponse.notes)` using the promote response data
    - `active` → call `fretBox.fadeIn()`
    - `idle` → if fret box was hidden, fade it back in (variant dismissed/error recovery)
  - [x] 2.2 Ensure the promote response payload is accessible from the transition context object (`ctx.resp.notes`)
  - [x] 2.3 Score display: no changes needed — it reads `GameState.runtime.score` continuously and does not reset on variant

- [x] Task 3: Add unit tests `tests/unit/js/FretBox.test.js` (extend) (AC: 1, 2, 3, 4)
  - [x] 3.1 `fadeOut()` sets opacity to 0 via CSS class
  - [x] 3.2 `fadeIn()` restores opacity via CSS class
  - [x] 3.3 `render()` called while hidden rebuilds DOM without flicker (no-op assertion — verify DOM content matches new notes)

- [x] Task 4: Update E2E spec (AC: 2, 5)
  - [x] 4.1 Add variant accept scenario to `epic8-hud.spec.ts` (or `epic6-transition-phases.spec.ts`):
    - Start game → trigger variant → accept → verify fret box updates
  - [x] 4.2 Assert score unchanged during transition

---

## Dev Notes

### Architecture Constraints

- **Data source:** Promote response carries `{notes, scale_id, root_midi, instrument_id}` inline — no re-fetch of `/game/session-config` needed. FretBox receives this data directly.
- **Phase listener:** Register via `setTransitionPhaseListener` from `TransitionPhases.js` (created in 6-1). The listener receives `(newPhase, prevPhase, ctx)` where `ctx.resp` contains the promote response.
- **Rebuild timing:** The breather phase provides ~3s of safe rebuild time. DOM rebuild of ~24 cells is sub-millisecond — no timing concern.
- **`fretBox.render(payload)`** is the same API established in 8-3. This story calls it with new data; the method rebuilds the DOM from scratch.

### Fade Animation CSS

```css
.fretbox-visible {
  opacity: 1;
  transition: opacity 200ms ease-in-out;
}

.fretbox-hidden {
  opacity: 0;
  transition: opacity 200ms ease-in-out;
  pointer-events: none;
}
```

The `pointer-events: none` on hidden state prevents any interaction during the hidden window.

### Flow

```
accepted → fadeOut() on fret-box container (200ms)
riding   → fret-box opacity = 0, no DOM change
breather → fret-box opacity = 0, promote response arrives → render(payload)
promoting → DOM already rebuilt, still hidden
active   → fadeIn() on fret-box container (200ms)
```

### Score Display Note

ScoreDisplay reads `GameState.runtime.score` continuously. No changes needed for variant — the score is NOT reset on variant accept (per Epic 6 spec). The score pulse animation continues to work for any new score increments during and after the transition.

### Files to Modify

- `static/game/ui/FretBox.js` — add fadeOut/fadeIn methods
- `static/game/ui/hud.css` — add .fretbox-visible/.fretbox-hidden classes
- `static/game/main.js` — register transition phase listener for fret box
- `tests/unit/js/FretBox.test.js` — extend with fade tests
- `tests/e2e/specs/epic8-hud.spec.ts` — add variant transition scenario
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Out of Scope

- Variant state machine itself (Epic 6)
- Character/camera cinematic (Epic 6-2, 6-3)
- Backend promote endpoint (6-5)
- Any HUD element besides fret box and score

---

### References

- Variant transition HUD spec — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-4]
- Transition phase listener API — [Source: `static/game/TransitionPhases.js` — `setTransitionPhaseListener`]
- Promote response shape — [Source: Epic 6-5 spec]
- `fretBox.render()` data contract — [Source: Story 8-3 Dev Notes]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- fadeOut()/fadeIn() methods added to FretBox.js. Hooked into accepted/active/idle transition phase listeners in main.js. fretBox.render(resp) called on promote response in both cinematic (applyPromoteResponse) and non-cinematic (promoting listener) paths.

### File List

- `static/game/ui/FretBox.js` (UPDATE)
- `static/game/ui/hud.css` (UPDATE)
- `static/game/main.js` (UPDATE)
- `tests/unit/js/FretBox.test.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)