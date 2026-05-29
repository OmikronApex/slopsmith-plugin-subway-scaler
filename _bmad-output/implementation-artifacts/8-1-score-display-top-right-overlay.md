# Story 8.1: Score Display — Top-Right Corner Overlay

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-1
**Story Key:** 8-1-score-display-top-right-overlay
**Depends on:** 8-0 (HudShell)

---

## Context

The score display is the most glance-read HUD element. It reads `GameState.runtime.score` (written by `CartSystem.js` on correct note detection) and renders the integer at the top-right corner. On increment, a brief `color-accent` pulse signals the point was counted.

The HUD container (8-0) provides the phase-aware shell and empty corner slots. This story creates the `ScoreDisplay` class and registers it with `HudShell`.

---

## User Story

As a **player**,
I want my current score visible in the top-right corner during gameplay,
so I can track my progress at a peripheral glance without taking my hands off the instrument.

---

## Acceptance Criteria

**AC-1 — Score element rendered in top-right corner:**
Given the game scene is loaded and the HUD container exists,
When a game session starts and `runtime.score` is initialised,
Then the score display renders in the top-right corner of `.game-shell` (positioned by `HudShell.registerChild` at `top: 1rem; right: 1rem`),
And the score text uses the vendored Space Mono monospace font at `font-size: 1.5rem` (minimum 1.2rem, readable at peripheral glance),
And the score text colour is `var(--color-text-primary)` (#E8E8F0),
And the score element has no background — canvas visible behind it,
And the score element has `aria-live="polite"` for screen reader announcements,
And the score element CSS class is `.hud-score`.

**AC-2 — Score updates immediately on change:**
Given `runtime.score` increments during gameplay (written by CartSystem),
When the score value changes,
Then the displayed number updates immediately (same frame as score write, via `textContent` assignment),
And a brief `--color-accent` (#FFB800) text colour pulse occurs for ~150ms (CSS class `.score-increment` toggled on, then removed after 150ms),
And for `prefers-reduced-motion: reduce`, the pulse is replaced by a static colour change to `--color-accent` with no animation duration (CSS `@media` override).

**AC-3 — Score display hidden during inactive phases:**
Given a game-over or idle phase,
When the HUD becomes hidden (per HudShell phase management),
Then the score display is hidden (per HudShell container visibility).

**AC-4 — Score display shows 0 on reset:**
Given a session restart (same settings),
When the score resets to 0,
Then the score display immediately shows "0".

**AC-5 — Score integer uses `textContent`:**
The score value is set via `element.textContent = String(score)` — no string concatenation per frame, no `innerHTML`.

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/ui/ScoreDisplay.js` (AC: 1, 2, 4, 5)
  - [x] 1.1 `ScoreDisplay` class wrapping a `<span class="hud-score">` element
  - [x] 1.2 Element styled: `font-family: 'Space Mono'`, `font-size: 1.5rem`, `font-weight: 700`, `color: var(--color-text-primary)`, `background: none`, `aria-live="polite"`
  - [x] 1.3 Constructor takes `HudShell` instance — calls `shell.registerChild('score', this.element)`
  - [x] 1.4 `update(score)` method sets `textContent = String(score)`, triggers increment pulse
  - [x] 1.5 Increment pulse: add `.score-increment` class (sets `color: var(--color-accent)`), remove after 150ms via `setTimeout`
  - [x] 1.6 `destroy()` removes element, cancels pending timeout

- [x] Task 2: Add score styles to `static/game/ui/hud.css` (AC: 1, 2)
  - [x] 2.1 `.hud-score` base styles
  - [x] 2.2 `.hud-score.score-increment` — `color: var(--color-accent)`, `transition: color 150ms ease-out`
  - [x] 2.3 `@media (prefers-reduced-motion: reduce)` — `.hud-score.score-increment` has `color: var(--color-accent)` with NO `transition` (static change)

- [x] Task 3: Wire ScoreDisplay into `main.js` (AC: 2)
  - [x] 3.1 Import ScoreDisplay
  - [x] 3.2 Instantiate after HudShell, pass shell instance
  - [x] 3.3 Call `scoreDisplay.update(GameState.runtime.score)` each frame from game loop (or subscribe to score-change event)

- [x] Task 4: Create/extend unit tests `tests/unit/js/ScoreDisplay.test.js` (AC: 1, 2, 4, 5)
  - [x] 4.1 Score element created with correct class, font, aria-live
  - [x] 4.2 Score display shows initial score
  - [x] 4.3 `update()` changes text content
  - [x] 4.4 `.score-increment` class toggled on update
  - [x] 4.5 Destroy cleans up element

- [x] Task 5: Update E2E spec (AC: 1, 3)
  - [x] 5.1 Uncomment score position test in `epic8-hud.spec.ts` — top-right corner position assertion
  - [x] 5.2 Run and verify passes

---

## Dev Notes

### Architecture Constraints

- **Score value source:** `GameState.runtime.score` is owned (`writes`) by `CartSystem.js` per the GameState ownership table. `ScoreDisplay` reads only — never writes `runtime.score`.
- **Increment flash timing:** 150ms as measured by a `setTimeout`. The timing can be imprecise (JS timer granularity) — the effect is a visible pulse, not a frame-exact animation. CSS `transition: color 150ms ease-out` handles the visual nicely.
- **No string concatenation per frame:** Use `textContent = String(score)`. Avoid `innerHTML` (security) and string building (`'Score: ' + score` — wastes tokens).
- **`aria-live="polite"`** is set in the HTML markup (on the `<span>` element), not injected by JS. Screen readers announce the value when it changes without interrupting current speech.

### Files to Create

- `static/game/ui/ScoreDisplay.js` — NEW
- `tests/unit/js/ScoreDisplay.test.js` — NEW

### Files to Modify

- `static/game/ui/hud.css` — add score styles
- `static/game/main.js` — wire ScoreDisplay
- `tests/e2e/specs/epic8-hud.spec.ts` — uncomment score position assertions
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Existing Patterns

- `GameState.runtime.score` is updated by `CartSystem.js` on correct note detection (collision-check path).
- `overlay.css` already uses `.overlay-score` for the game-over overlay. The HUD score is a separate, lighter element — no size constraints, no background.
- `tokens.js` exports `COLORS.ACCENT` (0xFFB800) and CSS variable `--color-accent` — use the CSS variable in HUD styles.
- Space Mono is vendored at `static/game/fonts/` with `@font-face` in `setup.css`. The HUD does NOT need `@font-face` — it inherits from the page-level font stack.

### Increment Flash Implementation

```js
update(score) {
  const prev = this._score;
  this._score = score;
  this._el.textContent = String(score);
  if (prev !== score) {
    this._el.classList.add('score-increment');
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._el.classList.remove('score-increment');
      this._pulseTimer = null;
    }, 150);
  }
}
```

### Out of Scope

- Score context line / personal best (Epic 4-3 game-over overlay)
- Score animation beyond colour pulse (no scale, bounce, or particle effects)
- Leaderboard or high-score persistence (localStorage score persistence is on game-over, not HUD)
- Multiple digit formatting (comma separation)

---

### References

- Score display ACs — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-1]
- `GameState.runtime.score` ownership — [Source: `_bmad-output/planning-artifacts/architecture.md` — Module Ownership table]
- `old_score.css` / `.overlay-score` reference — [Source: `static/game/ui/overlays.css`]
- `aria-live` pattern for score — [Source: UX spec, UX-DR1]
- `tokens.js COLORS.ACCENT` — [Source: `static/game/ui/tokens.js`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- ScoreDisplay.js created with aria-live, pulse animation, and destroy(). Wired into main.js polling. 16 unit tests pass.

### File List

- `static/game/ui/ScoreDisplay.js` (NEW)
- `static/game/ui/hud.css` (UPDATE)
- `tests/unit/js/ScoreDisplay.test.js` (NEW)
- `static/game/main.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)