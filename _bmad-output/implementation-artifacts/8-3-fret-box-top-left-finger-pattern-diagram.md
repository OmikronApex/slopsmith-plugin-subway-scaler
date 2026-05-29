# Story 8.3: Fret Box — Top-Left Finger Pattern Diagram

Status: review

**Epic:** 8 — In-Game HUD Overlay: Score, Pause Button & Fret Box
**Story ID:** 8-3
**Story Key:** 8-3-fret-box-top-left-finger-pattern-diagram
**Depends on:** 8-0 (HudShell)

---

## Context

The fret box is the most complex HUD element. It renders a visual guitar-fretboard diagram showing the active scale's finger pattern: strings as horizontal rows, frets as vertical columns, note boxes marking which frets to play. The diagram anchors to the top-left corner of the game shell, sits on a dark PS1-era panel, and updates when the scale or root note changes (including variant transitions, handled by 8-4).

This story creates the `FretBox` class — a pure renderer that takes note data and builds an HTML CSS Grid diagram.

---

## User Story

As a **player**,
I want a visual fret-box diagram in the top-left corner showing the current scale's string/fret pattern,
so I can see where my fingers should be on the neck without looking away from the game.

---

## Acceptance Criteria

**AC-1 — Fret-box diagram rendered in top-left corner:**
Given the game scene is loaded and the HUD container exists,
When a game session starts with a valid scale, root, and instrument,
Then a fret-box diagram is rendered in the top-left corner of `.game-shell` (positioned by `HudShell.registerChild` at `top: 1rem; left: 1rem`),
And the container element has CSS class `.hud-fret-box`.

**AC-2 — Panel styling:**
The fret-box sits on a solid dark panel with:
- `background: rgba(12, 12, 18, 0.85)` (matching `color-bg-void` at ~85%)
- `border: 2px solid #0a0a10` (dark stroke — PS1-era restrained border)
- `box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08)` (inner highlight line)
- Maximum bounding box ~168×144px

**AC-3 — String orientation (locked):**
- Strings run horizontally (rows). **Bottom row = lowest-pitch string** (Red, `var(--color-string-0)` or STRING_COLORS[0]).
- **Top row = highest-pitch string** (Purple for 6-string, Pink for 7-string).
- **This orientation is locked — not configurable.**
- **Row index formula:** `row = stringCount - 1 - note.string` — string 0 (lowest pitch) maps to the bottom row.
- Note: backend `Note.string` is 1-based from HIGH (tabulator convention). Convert with `stringCount - note.string` before indexing `STRING_COLORS`.

**AC-4 — Grid layout:**
- Frets run vertically (columns), divided by vertical fret-bar lines (`1px solid rgba(255,255,255,0.15)`)
- Fret number labels at the top of each fret column in `var(--color-text-primary)`
- Grid sized dynamically: `display: grid`, `grid-template-columns: repeat(N_frets, 1fr)`, `grid-template-rows: repeat(N_strings, 1fr)`
- Gap between columns: `2px` (for fret-bar lines), between rows: `0`

**AC-5 — Note box rendering:**
For each note in the session config, a coloured rectangular box fills the cell at its string×fret intersection:
- Box border: `2px solid var(--color-string-N)` (full string colour, full opacity)
- Box fill: `var(--color-string-N)` at 70-80% opacity with `filter: brightness(1.2)`
- The border carries colour identity; the fill carries occupancy

**AC-6 — Root note emphasis:**
The root note cell has CSS class `.fret-cell-root` with:
- Brighter fill: opacity 0.85, `filter: brightness(1.3)`
- A small accent-yellow dot (`#FFB800`, ~6px) centred inside the cell via `::after` pseudo-element (`border-radius: 50%`)
- Not a double-border ring

**AC-7 — Empty cells:**
Empty cells have no border, no fill. Grid lines visible as separators.

**AC-8 — Fret range:**
The diagram displays only frets within the active fret span:
- Start fret: `Math.max(0, Math.min(...notes.map(n => n.fret)) - 1)` (one column of positional context)
- End fret: `Math.max(...notes.map(n => n.fret))`
- Minimum 4 columns displayed centred on the single fret if all notes share one fret
- Fret 0 (open strings) never shown
- If `notes.length === 0`, render a "No session" placeholder text inside the panel — no crash

**AC-9 — `render()` method with full DOM rebuild:**
`fretBox.render({notes, scale_id, root_midi, instrument_id})` replaces the grid content entirely:
- Old grid removed, new grid built from scratch (no morph, no incremental update)
- Returns `this` for chaining

**AC-10 — Error resilience:**
If the fetch of `/game/session-config` fails or no notes data is available,
Then the fret-box shows a placeholder state (`<span>No session</span>`) without crashing,
And no console errors are thrown from FretBox code.

---

## Tasks / Subtasks

- [x] Task 1: Create `static/game/ui/FretBox.js` (AC: 1–10)
  - [x] 1.1 `FretBox` class constructor takes mount container (not HudShell — mounts into its own panel element)
  - [x] 1.2 Panel element: `class="hud-fret-box"`, dark background, PS1-era border, `display: flex; flex-direction: column; gap: 4px; padding: 8px`
  - [x] 1.3 `register(shell)` method that calls `shell.registerChild('fretbox', this._panel)` — called by main.js after construction
  - [x] 1.4 `render({notes, scale_id, root_midi, instrument_id})` method:
    - [x] Guard clause: if `!notes || notes.length === 0`, show placeholder, return
    - [x] Determine string count from `instrument_id` or notes data
    - [x] Calculate fret range per AC-8
    - [x] Build grid: `display: grid`, template columns/rows from fret span × string count
    - [x] Create fret number labels row above grid
    - [x] For each cell: determine if it contains a note, render accordingly (empty / note / root note)
    - [x] Note box uses wrapper pattern: outer div border, inner div fill+opacity
    - [x] Root note cell gets `.fret-cell-root` + `::after` yellow dot
    - [x] Row inversion: `row = stringCount - 1 - note.string`
    - [x] Colour lookup: `var(--color-string-${note.string})` (0-indexed from low pitch)
  - [x] 1.5 Scale name label (span) above grid — hidden by default, shown in Full detail mode (8-5)
  - [x] 1.6 `destroy()` — removes panel from DOM, cleans up

- [x] Task 2: Add fret box styles to `static/game/ui/hud.css` (AC: 2–7)
  - [x] 2.1 `.hud-fret-box` panel base styles
  - [x] 2.2 Grid cell styles: `.fret-cell` (empty), `.fret-cell-note` (filled), `.fret-cell-root` (root emphasis)
  - [x] 2.3 Fret number label styles
  - [x] 2.4 Grid lines (fret bars) via column gap or borders
  - [x] 2.5 `.fret-cell-root::after` — yellow dot (6px, border-radius 50%, positioned centre)
  - [x] 2.6 Placeholder text styles

- [x] Task 3: Wire FretBox into `main.js` (AC: 1, 8, 9)
  - [x] 3.1 Import FretBox
  - [x] 3.2 Instantiate after HudShell, call `register(shell)`
  - [x] 3.3 Call `fretBox.render(sessionConfig)` after session config is fetched

- [x] Task 4: Create unit tests `tests/unit/js/FretBox.test.js` (AC: 3, 5, 6, 7, 8, 9, 10)
  - [x] 4.1 Empty notes → placeholder, no errors
  - [x] 4.2 Single note → 1 cell filled, correct position
  - [x] 4.3 Root note → `.fret-cell-root` class present, yellow dot rendered
  - [x] 4.4 String inversion → low E at bottom row, high E at top row (4 and 6 string variants)
  - [x] 4.5 Fret range → columns match min-max with padding
  - [x] 4.6 `render()` → DOM rebuild, no stale nodes
  - [x] 4.7 Panel background → computed style matches `rgba(12, 12, 18, 0.85)`
  - [x] 4.8 Empty notes session → errors handled gracefully, no crash

- [x] Task 5: Update E2E spec (AC: 1)
  - [x] 5.1 Uncomment fret box position test in `epic8-hud.spec.ts` — top-left corner assertion
  - [x] 5.2 Run and verify passes

---

## Dev Notes

### Architecture Constraints

- **Data contract:** `fretBox.render({notes, scale_id, root_midi, instrument_id})` — identical to `/game/session-config` response and `/variant/promote` response. FretBox is a pure renderer — no separate model, no internal state beyond the last rendered payload.
- **`render()` replaces DOM completely** — no incremental updates, no morphing. The grid is small (~6×4 = 24 cells maximum), DOM rebuild is sub-millisecond.
- **Row inversion:** `row = stringCount - 1 - note.string` — `note.string` is 1-based from high pitch (tabulator convention). `stringCount` is the total number of strings for the instrument. Result: index 0 = bottom row (lowest pitch).

### String Colour Indexing

The backend `Note.string` is 1-based from HIGH pitch (tabulator convention). Convert to 0-based low→high index:
```js
const paletteIdx = stringCount - note.string;  // 0..stringCount-1, low→high
```
Then look up with `STRING_COLORS[paletteIdx]` or CSS `var(--color-string-${paletteIdx})`.

Note: `tokens.js` emits CSS variables both 0-indexed and 1-indexed (for backward compatibility). Use 0-indexed in fret-box code.

### Fret Range Calculation

```js
const frets = notes.map(n => n.fret);
const minFret = Math.max(1, Math.min(...frets));
const maxFret = Math.max(...frets);
let startFret = Math.max(1, minFret - 1); // at least fret 1
let endFret = maxFret;
let numFrets = endFret - startFret + 1;

if (numFrets < 4) {
  // Centre on the single fret and expand to 4 columns
  const centre = minFret === maxFret ? minFret : Math.floor((minFret + maxFret) / 2);
  const halfSpan = Math.floor(4 / 2);
  startFret = Math.max(1, centre - halfSpan);
  endFret = startFret + 3;
  numFrets = 4;
}
```

### CSS Grid Cell — Note Cell Wrapper Pattern

For each populated cell:
```html
<div class="fret-cell-note" style="border-color: var(--color-string-0);">
  <div class="fret-cell-note-fill" style="background: var(--color-string-0); opacity: 0.75; filter: brightness(1.2);"></div>
</div>
```

Root note cells additionally get `class="fret-cell-root"` and the `::after` yellow dot.

### Panel PS1 Border

```css
.hud-fret-box {
  background: rgba(12, 12, 18, 0.85);
  border: 2px solid #0a0a10;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
```

### Files to Create

- `static/game/ui/FretBox.js` — NEW
- `tests/unit/js/FretBox.test.js` — NEW

### Files to Modify

- `static/game/ui/hud.css` — add fret box styles
- `static/game/main.js` — wire FretBox
- `tests/e2e/specs/epic8-hud.spec.ts` — uncomment fret box assertion
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Related Stories

- Story 8-4 extends FretBox with variant transition animations (fade-out/in on accept)
- Story 8-5 adds Basic/Full detail toggle (scale name label, string colour strip)

### Out of Scope

- Variant transition animation (8-4)
- Scale name label / string colour strip (8-5)
- ARIA role/accessibility (8-6)
- Any interaction (hover, click) on fret-box cells

---

### References

- Fret box ACs — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 8-3]
- String colour system (UX-DR5) — [Source: UX spec, String Color System section]
- Row inversion formula — [Source: Epics — Story 8-3 Implementation Notes]
- `STRING_COLORS` palette — [Source: `static/game/ui/tokens.js`]
- `/game/session-config` response shape — [Source: `_bmad-output/planning-artifacts/architecture.md`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- FretBox.js created with full DOM-rebuild render(), fret range calc, string inversion, root note emphasis, error resilience. 16 unit tests pass.

### File List

- `static/game/ui/FretBox.js` (NEW)
- `static/game/ui/hud.css` (UPDATE)
- `tests/unit/js/FretBox.test.js` (NEW)
- `static/game/main.js` (UPDATE)
- `tests/e2e/specs/epic8-hud.spec.ts` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)