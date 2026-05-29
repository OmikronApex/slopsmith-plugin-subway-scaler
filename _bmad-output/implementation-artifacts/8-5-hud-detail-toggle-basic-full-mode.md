# Story 8.5: HUD Detail Toggle — Basic / Full Mode

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-5
**Story Key:** 8-5-hud-detail-toggle-basic-full-mode
**Depends on:** 8-3 (FretBox), Epic 4-2 (pause overlay)

---

## Context

The fret-box diagram (8-3) renders the finger-pattern grid. Some players want more context (scale name, root note label, string-colour strip), while skilled players prefer a clean minimal pattern reference.

This story adds a "HUD Detail" toggle on the pause overlay with two modes: Basic (minimal) and Full (with labels). The preference is persisted in `localStorage` and applied across sessions.

Note: In the epic spec, this story is labelled **8-5** in the story table but appears as "8-6" in the detailed section — this is a typo in the source. The canonical index is 8-5.

---

## User Story

As a **player**,
I want to choose between a basic and full HUD detail level,
so learners get note names and scale labels while skilled players see a clean minimal pattern reference.

---

## Acceptance Criteria

**AC-1 — Toggle control on pause overlay:**
Given the game is paused (pause overlay visible, Epic 4-2),
When the pause overlay is rendered,
Then a "HUD Detail" toggle control is present with two options: "Basic" and "Full",
And the toggle is rendered as a toggle group (consistent with the Setup screen's toggle group pattern — `role="radiogroup"`, arrow-key navigable),
And the current selection reflects the stored preference.

**AC-2 — "Full" mode content:**
Given the HUD detail is set to "Full",
When a game session is active,
Then the fret-box panel displays the scale name and root note label (e.g., "A Minor Pentatonic — Root A") above the grid in `var(--color-text-primary)`,
And fret-box fret numbers are at full contrast (`var(--color-text-primary)`),
And a thin string-colour strip is visible along the left edge of the fret box, one per row, mapping string colour ↔ row.

**AC-3 — "Basic" mode content:**
Given the HUD detail is set to "Basic",
When a game session is active,
Then the scale name and root note label are hidden (only the grid and fret numbers visible),
And fret numbers are rendered at reduced contrast (`var(--color-text-disabled)`),
And the thin string-colour strip along the left edge is hidden,
And the fret-box remains at the same size and position — only content density changes.

**AC-4 — Preference persistence:**
Given the HUD detail preference is changed,
When the player toggles between Basic and Full in the pause menu,
Then the preference is persisted to `localStorage` under key `subway-scaler-hud-detail`,
And on the next session start, the persisted preference is applied.

**AC-5 — Default:**
Given no preference has been stored,
When a new session starts,
Then the HUD detail defaults to "Full" (learner-friendly default).

---

## Tasks / Subtasks

- [x] Task 1: Add toggle UI to pause overlay (AC: 1, 4, 5)
  - [x] 1.1 Modify `PauseOverlay._build()` in `overlay.js` to add a HUD Detail toggle group
  - [x] 1.2 Toggle group: `class="toggle-group"`, `role="radiogroup"`, `aria-label="HUD Detail"`
  - [x] 1.3 Two radio buttons: "Basic" and "Full" with `role="radio"`, `aria-checked`
  - [x] 1.4 On toggle change: write to `localStorage` under key `subway-scaler-hud-detail`
  - [x] 1.5 Read stored preference on startup; default to `"full"` if none found
  - [x] 1.6 Dispatch a custom event `'hud-detail-change'` with `{ detail: 'basic' | 'full' }` on the overlay container

- [x] Task 2: Extend FretBox.js with detail mode rendering (AC: 2, 3)
  - [x] 2.1 Create scale name label element in constructor (initially hidden)
  - [x] 2.2 In `render()`, populate label from `scale_id` and `root_midi` (map scale_id to display name, midi to note name)
  - [x] 2.3 Create string-colour strip element along left edge (thin vertical bar per row, coloured per `STRING_COLORS`)
  - [x] 2.4 `setDetailMode('basic' | 'full')` method:
    - Full: show label, full-contrast fret numbers (class `.fret-numbers-full`), show colour strip
    - Basic: hide label, reduced-contrast fret numbers (class `.fret-numbers-basic`), hide colour strip
  - [x] 2.5 Add CSS classes: `.fret-detail-basic`, `.fret-detail-full` on the panel container
  - [x] 2.6 Read initial preference from `localStorage` in constructor

- [x] Task 3: Add styles to `hud.css` (AC: 2, 3)
  - [x] 3.1 `.hud-fret-box.fret-detail-full .fret-scale-label` — visible, primary colour
  - [x] 3.2 `.hud-fret-box.fret-detail-basic .fret-scale-label` — `display: none`
  - [x] 3.3 `.hud-fret-box.fret-detail-full .fret-number` — `color: var(--color-text-primary)`
  - [x] 3.4 `.hud-fret-box.fret-detail-basic .fret-number` — `color: var(--color-text-disabled)`
  - [x] 3.5 String-colour strip: `.hud-fret-box.fret-detail-full .fret-string-strip` — visible; `.fret-detail-basic` — hidden

- [x] Task 4: Add pause overlay toggle styles (AC: 1)
  - [x] 4.1 Add `.hud-detail-toggle` styling in `overlays.css` — consistent with Setup toggle group
  - [x] 4.2 Toggle group uses existing `.toggle-group` / `.toggle-button` pattern from `setup.css`

- [x] Task 5: Create unit tests (AC: 1, 2, 3, 4, 5)
  - [x] 5.1 Extend `tests/unit/js/FretBox.test.js`:
    - `setDetailMode('basic')` hides label, uses disabled colour
    - `setDetailMode('full')` shows label, uses primary colour
    - String-colour strip visible in full mode, hidden in basic mode
  - [x] 5.2 `tests/unit/js/overlay.test.js` (or new `tests/unit/js/PauseButton.test.js`):
    - HUD Detail toggle present in pause overlay
    - Toggle change persists to localStorage
    - Default preference is "full"

- [x] Task 6: Update E2E spec
  - [x] 6.1 Add test to `epic8-hud.spec.ts`: toggle HUD detail to Basic, verify fret box has no scale label

---

## Dev Notes

### Architecture Constraints

- **Persistence key:** `subway-scaler-hud-detail` — separate from session settings (`subway-scaler-settings`) to allow independent toggling without overwriting session preferences.
- **Event dispatch:** The toggle dispatches `'hud-detail-change'` on the overlay container. The FretBox listens for this event (or reads `localStorage` on each `render()` call — simpler and avoids event wiring).
- **Default value:** `"full"` — learners benefit from labels; skilled players can opt down.
- **Scale name mapping:** The `scale_id` from session config (e.g., `"minor-pentatonic"`) needs to be mapped to a human-readable name. Options:
  - Include a scale name map in FretBox or `notes.js` (e.g., `{ "minor-pentatonic": "Minor Pentatonic" }`)
  - Read from the `/scales` catalog response (scale objects have `name` field)
  - Simplest: pass the name alongside the render data or store in FretBox constructor

### Scale ↔ Root Label

```js
// Map scale_id to display name (add to notes.js or inline in FretBox)
const SCALE_NAMES = {
  'major': 'Major',
  'minor-pentatonic': 'Minor Pentatonic',
  'major-pentatonic': 'Major Pentatonic',
  'blues': 'Blues',
  'harmonic-minor': 'Harmonic Minor',
  'dorian': 'Dorian',
  'mixolydian': 'Mixolydian',
};

// Root note name from MIDI
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(midi) {
  return NOTE_NAMES[midi % 12];
}
```

Label text: `"${SCALE_NAMES[scale_id] || scale_id} — Root ${midiToName(root_midi)}"`

### String-Colour Strip

A thin vertical bar along the left edge of the fret-box panel, one segment per string row:
```html
<div class="fret-string-strip">
  <div class="fret-string-strip-row" style="background: var(--color-string-0);"></div>
  <div class="fret-string-strip-row" style="background: var(--color-string-1);"></div>
  ...
</div>
```
Each `.fret-string-strip-row` is `height: calc(100% / stringCount)`, `width: 4px`, no gaps.

### Files to Modify

- `static/game/ui/FretBox.js` — add `setDetailMode()`, string-colour strip, scale label
- `static/game/ui/overlay.js` — add HUD Detail toggle to `PauseOverlay._build()`
- `static/game/ui/overlays.css` — toggle styles
- `static/game/ui/hud.css` — detail mode styles
- `tests/unit/js/FretBox.test.js` — extend
- `tests/unit/js/overlay.test.js` — extend
- `tests/e2e/specs/epic8-hud.spec.ts` — add toggle test
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Out of Scope

- Telemetry (future: log toggle events + session count per mode)
- Additional detail levels beyond Basic/Full
- Per-element detail configuration

---

### References

- HUD Detail toggle ACs — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-5 (listed as "8-6: HUD Detail Toggle" in detailed section — typo; canonical index 8-5 from story table)]
- Toggle group pattern — [Source: `static/game/ui/setup.js` — toggle group setup]
- Persistence pattern — [Source: `static/game/ui/overlay.js` — `localStorage` usage for `subway-scaler-last-score`]
- Button/toggle styles — [Source: `static/game/ui/setup.css` — `.toggle-button`, `.toggle-group`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- HUD Detail toggle added to PauseOverlay._build() in overlay.js. FretBox.setDetailMode() persists to localStorage. CSS detail classes in hud.css and overlays.css. 'hud-detail-change' event wired in main.js.

### File List

- `static/game/ui/FretBox.js` (UPDATE)
- `static/game/ui/overlay.js` (UPDATE)
- `static/game/ui/overlays.css` (UPDATE)
- `static/game/ui/hud.css` (UPDATE)
- `tests/unit/js/FretBox.test.js` (UPDATE)
- `tests/unit/js/overlay.test.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)