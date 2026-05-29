# Story 8.6: Accessibility Audit — HUD Focus, ARIA & Reduced Motion

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-6
**Story Key:** 8-6-accessibility-audit-hud-focus-aria-reduced-motion
**Depends on:** 8-0 (HudShell), 8-1 (ScoreDisplay), 8-2 (PauseButton), 8-3 (FretBox), 8-5 (HUD Detail Toggle)

---

## Context

Epic 4 established WCAG 2.1 AA patterns for overlays (focus trapping, ARIA dialog roles, keyboard navigation). The HUD elements created in 8-0 through 8-5 need the same accessibility treatment:
- Keyboard navigation (pause button focusable, others not)
- Screen reader announcements (score via `aria-live`, fret box via `role="img"`)
- Motion-sensitive users (score increment flash alternative)

This story audits all HUD elements, fixes any gaps, and verifies with axe DevTools / Lighthouse.

---

## User Story

As a **developer**,
I want the HUD overlay audited for accessibility compliance (WCAG 2.1 AA),
so the pause button is keyboard-reachable, screen readers can announce score changes, and motion-sensitive users see safe alternatives.

---

## Acceptance Criteria

**AC-1 — Pause button keyboard focus:**
Given the HUD is visible during gameplay,
When a keyboard user presses Tab repeatedly,
Then the pause button receives keyboard focus after the expected number of Tab presses,
And the pause button has `:focus-visible` visible focus ring in `--color-accent`,
And pressing Enter or Space on the focused pause button triggers pause.

**AC-2 — Tab order: only pause button is reachable:**
Given the pause button is the only interactive HUD element,
When a keyboard-only user navigates the plugin,
Then no other HUD element (score, fret box) is reachable by Tab — only the pause button.
Score and fret box have `tabindex="-1"` applied by `HudShell.registerChild`.

**AC-3 — Score `aria-live`:**
Given the score display is present,
When the score value changes,
Then `aria-live="polite"` region announces the new score value.

**AC-4 — Fret-box ARIA:**
Given the fret box is rendered,
When inspected by an accessibility tool,
Then the fret-box container has `role="img"` with `aria-label` describing the scale and root (e.g., "Finger pattern for C Major, root fret 5").
The `aria-label` is updated on each `render()` call.

**AC-5 — Reduced motion for score increment:**
Given the system has `prefers-reduced-motion: reduce` set,
When the score increments,
Then the increment flash is a static colour change (no animation duration),
Implemented as a `@media (prefers-reduced-motion: reduce)` override in CSS.

**AC-6 — Axe / Lighthouse audit:**
Given axe DevTools or Lighthouse accessibility audit,
When run on the HUD elements during gameplay,
Then no critical or serious violations are reported for `.hud-shell`, `.hud-score`, `.hud-pause-btn`, or `.hud-fret-box`.

**AC-7 — HUD label on shell container:**
The `.hud-shell` container has `aria-label="Game HUD"` and `role="group"`.

---

## Tasks / Subtasks

- [x] Task 1: Audit and fix Tab order in HudShell (AC: 1, 2)
  - [x] 1.1 Verify `registerChild` sets `tabindex="-1"` automatically on all non-interactive child elements
  - [x] 1.2 Verify pause button is the only child with `tabindex="0"` (or no `tabindex`, inheriting `<button>` default of 0)
  - [x] 1.3 Verify `:focus-visible` styles present on `.hud-pause-btn` in `hud.css`

- [x] Task 2: Verify score `aria-live` (AC: 3)
  - [x] 2.1 Check `ScoreDisplay.js`: `<span>` element has `aria-live="polite"` set in constructor
  - [x] 2.2 Confirm no JavaScript sets/unsets `aria-live` dynamically (should be static in HTML)

- [x] Task 3: Add fret-box ARIA (AC: 4)
  - [x] 3.1 In `FretBox.js` constructor/update, set `role="img"` and `aria-label` on container
  - [x] 3.2 `aria-label` format: `"Finger pattern for {scale name}, root fret {fret number}"`
  - [x] 3.3 Update `aria-label` on each `render()` call with current scale/root info
  - [x] 3.4 Fallback for empty/error state: `"No finger pattern data"`

- [x] Task 4: Reduced motion CSS audit (AC: 5)
  - [x] 4.1 Verify `@media (prefers-reduced-motion: reduce)` block in `hud.css` handles:
    - Score increment flash: replace animated transition with static colour change
    - Fret-box fade-out/in (8-4): replace with instant show/hide
  - [x] 4.2 Follow same pattern as `overlays.css` — already has `prefers-reduced-motion` override for overlay glitch animation

- [x] Task 5: Shell container ARIA (AC: 7)
  - [x] 5.1 In `HudShell.js` constructor, set `role="group"` and `aria-label="Game HUD"` on `.hud-shell`

- [x] Task 6: Axe / Lighthouse audit (AC: 6)
  - [x] 6.1 Add axe-core or run Lighthouse audit on HUD elements during gameplay
  - [x] 6.2 Fix any critical or serious violations found
  - [x] 6.3 Document any known/acceptable violations (e.g., colour contrast on reduced-motion override is same colours — not an issue)

- [x] Task 7: Extend unit tests (AC: 1, 2, 3, 4, 5)
  - [x] 7.1 Extend `tests/unit/js/HudShell.test.js`: verify `role` and `aria-label` on container
  - [x] 7.2 Extend `tests/unit/js/ScoreDisplay.test.js`: verify `aria-live="polite"` present
  - [x] 7.3 Extend `tests/unit/js/FretBox.test.js`: verify `role="img"` and `aria-label` on rendered fret box
  - [x] 7.4 Extend `tests/unit/js/PauseButton.test.js`: verify `:focus-visible` style matches accent colour

- [x] Task 8: Update E2E spec (AC: 6)
  - [x] 8.1 Add axe-core audit test to `epic8-hud.spec.ts` (or extend baseline accessibility spec)
  - [x] 8.2 Add keyboard Tab-order test: verify pause button is focusable, score/fret-box are not

---

## Dev Notes

### Architecture Constraints

- **Focus management:** `HudShell.registerChild` should enforce `tabindex` based on element type. Interactive elements (buttons) keep default `tabindex=0`; non-interactive elements (span/div for score, fret-box panel) get `tabindex="-1"`.
- **No focus indicator on canvas:** Follow Epic 4-4 pattern — focus returns to canvas on overlay close, canvas has no visible focus indicator.
- **`aria-live="polite"`** must be set in HTML markup (on the `<span>` element) not injected by JS. `ScoreDisplay.js` constructor sets `element.setAttribute('aria-live', 'polite')`.
- **Reduced motion:** Already handled at the overlay level in `overlays.css`. The HUD's `hud.css` should follow the same pattern — single `@media (prefers-reduced-motion: reduce)` block.

### HudShell focus management snippet

```js
registerChild(name, element) {
  element.style.pointerEvents = 'auto';
  element.style.position = 'absolute';
  // Non-interactive children should not be keyboard-reachable
  if (element.tagName !== 'BUTTON' && element.tagName !== 'A') {
    element.setAttribute('tabindex', '-1');
  }
  this._container.appendChild(element);
  this._children.set(name, element);
}
```

### Reduced Motion CSS for HUD

```css
@media (prefers-reduced-motion: reduce) {
  /* Score increment: instant colour change, no transition */
  .hud-score.score-increment {
    color: var(--color-accent);
    transition: none;
  }

  /* Fret-box fade: instant visibility change */
  .hud-fret-box.fretbox-hidden {
    opacity: 0;
    transition: none;
  }

  .hud-fret-box.fretbox-visible {
    opacity: 1;
    transition: none;
  }
}
```

### Fret-box `aria-label` update

```js
// Inside render():
const scaleName = this._getScaleLabel(scale_id);
const rootName = NOTE_NAMES[root_midi % 12];
const rootFret = notes.find(n => n.midi === root_midi)?.fret ?? '?';
this._panel.setAttribute('aria-label',
  `Finger pattern for ${scaleName}, root fret ${rootFret}`);
```

### Files to Modify

- `static/game/ui/HudShell.js` — add `role="group"`, `aria-label`, tabindex enforcement
- `static/game/ui/ScoreDisplay.js` — ensure `aria-live="polite"` is set
- `static/game/ui/FretBox.js` — add `role="img"` and `aria-label`
- `static/game/ui/hud.css` — add reduced-motion overrides
- `tests/unit/js/HudShell.test.js` — extend
- `tests/unit/js/ScoreDisplay.test.js` — extend
- `tests/unit/js/FretBox.test.js` — extend
- `tests/unit/js/PauseButton.test.js` — extend
- `tests/e2e/specs/epic8-hud.spec.ts` — add accessibility tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Out of Scope

- Full-page accessibility audit (outside HUD — setup screen, overlays already covered by Epic 4)
- Screen reader end-to-end gameplay testing (documented as out of scope per UX spec)
- Colour contrast verification (already passing for Night City palette per tokens.js audit)

---

### References

- Accessibility audit ACs — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-6 (Accessibility Audit)]
- Epic 4 accessibility patterns — [Source: Story 4-4 (ARIA roles and keyboard navigation)]
- Reduced-motion overlay pattern — [Source: `static/game/ui/overlays.css` — `@media (prefers-reduced-motion: reduce)`]
- WCAG 2.1 AA reference — [Source: UX spec, Accessibility Strategy section]
- Colour contrast audit — [Source: `static/game/ui/tokens.js` — contrast ratio comments]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- ARIA implemented upfront across all HUD components: role=group/img, aria-label, aria-live=polite. tabindex=-1 on non-interactive HUD children in registerChild(). focus-visible ring on pause button. prefers-reduced-motion overrides in hud.css.

### File List

- `static/game/ui/HudShell.js` (UPDATE)
- `static/game/ui/ScoreDisplay.js` (UPDATE)
- `static/game/ui/FretBox.js` (UPDATE)
- `static/game/ui/hud.css` (UPDATE)
- `tests/unit/js/HudShell.test.js` (UPDATE)
- `tests/unit/js/ScoreDisplay.test.js` (UPDATE)
- `tests/unit/js/FretBox.test.js` (UPDATE)
- `tests/unit/js/PauseButton.test.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)