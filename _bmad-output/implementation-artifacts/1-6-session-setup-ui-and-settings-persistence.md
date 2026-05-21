# Story 1.6: Session Setup UI and Settings Persistence

**Status:** review
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.6
**Story Key:** 1-6-session-setup-ui-and-settings-persistence

---

## User Story

As a player,
I want a setup screen where I can select scale, difficulty, and instrument with my choices remembered between sessions,
So that I can configure and start a training session quickly without re-entering settings each visit.

---

## Acceptance Criteria

**AC-1 — Setup Screen Form:**
- HTML form rendered at app initialization (before game loop starts)
- Scale selector: native `<select>` populated from `GET /scales` API
- Difficulty toggle group: Easy / Medium / Hard (Medium pre-selected)
- Instrument toggle group: Guitar / Bass (Guitar pre-selected)
- Label reads "root randomised fret 5–8" (no root note field)
- START button present and enabled
- Form uses setup.css base styles and tokens.js color scheme

**AC-2 — Start Button Behavior:**
- On START click, compute random root MIDI in range [fret 5–8 on lowest string]
- Example: Guitar-standard lowest string (low E) = MIDI 40. Frets 5-8 = MIDI 45-48. Pick random.
- Write to `localStorage` key `subway-scaler-settings`: `{ scale_id, difficulty, instrument_id }`
- **Do NOT** write `root_midi` to localStorage (always re-randomise on session start)
- Call `GET /game/session-config?scale_id=...&root_midi=...&instrument_id=...`
- On success: transition to game canvas and start game
- On error: display error message (see AC-4), keep setup screen visible

**AC-3 — Settings Persistence:**
- On app initialization, read `localStorage` key `subway-scaler-settings`
- If exists: pre-fill Scale, Difficulty, Instrument from saved values
- If missing: use defaults (first scale, Medium difficulty, Guitar)
- Root MIDI always re-randomised (never read from localStorage)

**AC-4 — Error Handling:**
- If `GET /game/session-config` fails (404, 422, network error):
  - Setup screen remains visible
  - Error message below START button: "Couldn't load session — check your connection and try again"
  - START button re-enabled for retry
  - Error dismissed automatically when START is tapped again
  - Error message has `role="alert"` for screen reader announcement

**AC-5 — Keyboard Navigation:**
- Tab order: Scale → Difficulty group → Instrument group → START
- Arrow keys move between toggle options (left/right or up/down)
- Enter/Space activate toggle options
- All interactive elements have `:focus-visible` styles

---

## Developer Context

### What This Story Does

Builds the **first interactive UI** players see:
1. Fetch scale list from backend
2. Render form with dropdowns and toggle groups
3. Handle player input (selections)
4. Persist choices to localStorage
5. Call session-config endpoint
6. Transition to game on success, show error on failure

This story **depends on**:
- Story 1-3 (tokens.js and design colors)
- Story 1-4 (session-config endpoint)
- Story 1-5 (setup.css and fonts)

### Architecture Compliance

From architecture.md + project-context.md:
- Settings stored in localStorage key `subway-scaler-settings`
- Error responses follow project standard: `{ "error": { "code": "...", "message": "..." } }`
- All API field names `snake_case`
- Root MIDI computed client-side (range 21-108, fret 5-8 on lowest string)
- Setup screen is the entry point before game loop

### Root MIDI Calculation

```
For instrument with tuning array [40, 45, 50, 55, 59, 64] (guitar-standard):
- Lowest string = tuning[0] = 40 (low E)
- Fret 5 = 40 + 5 = 45
- Fret 8 = 40 + 8 = 48
- Random: Math.floor(Math.random() * (48 - 45 + 1)) + 45  // 45-48 inclusive
```

### No Game Loop Yet

This story wires the **setup screen only**. **Story 3.4 (GameLoop)** will handle the game loop after player taps START. This story just transitions to the game canvas; GameLoop takes it from there.

### Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `static/game/setup.html` | CREATE | HTML form (or create dynamically in JS if preferred) |
| `static/game/setup.js` | CREATE | Form logic: fetch scales, handle START, localStorage, error handling |
| `static/game/main.js` | MODIFY | Wire setup.js to app initialization |

---

## Definition of Done

- [x] Setup screen HTML form created with Scale, Difficulty, Instrument selectors
- [x] Scale selector populated from `GET /scales` API
- [x] Difficulty: Easy/Medium/Hard toggle (Medium default)
- [x] Instrument: Guitar/Bass toggle (Guitar default)
- [x] "root randomised fret 5–8" label visible
- [x] No root note field on form
- [x] START button present and enabled
- [x] On START: compute random root MIDI (fret 5-8 on lowest string)
- [x] On START: save { scale_id, difficulty, instrument_id } to localStorage (not root_midi)
- [x] On START: call GET /game/session-config with computed values
- [x] On app load: restore Scale/Difficulty/Instrument from localStorage (if exists)
- [x] On app load: root MIDI always re-randomised (never from localStorage)
- [x] On session-config success: transition to game canvas
- [x] On session-config error: show error message, keep setup visible, re-enable START
- [x] Error message has role="alert" for accessibility
- [x] Tab navigation: Scale → Difficulty → Instrument → START
- [x] Arrow keys navigate toggle groups
- [x] All colors use var(--color-*) from tokens.js
- [x] All controls have :focus-visible styles

---

## Dev Agent Record

### Implementation Plan

1. Create setup.html or generate form dynamically
2. Wire form inputs: scale select, difficulty/instrument toggles
3. Fetch /scales and populate dropdown
4. On START: validate, compute root MIDI, save to localStorage
5. Call /game/session-config
6. Handle success (transition to game)
7. Handle error (show message, re-enable START)
8. On app load: restore from localStorage
9. Keyboard navigation: Tab order, Arrow keys in toggles

### Completion Notes

✅ **Setup Screen Module (setup.js):**
- Created renderSetupScreen() function that builds form dynamically
- Implements Scale select (populated from /scales API)
- Implements Difficulty toggle group (Easy/Medium/Hard, defaults to Medium)
- Implements Instrument toggle group (shows instrument names from API, defaults to first instrument)
- ROOT MIDI: displays "Root: randomised fret 5–8" label (no input field)

✅ **Form Logic:**
- Computes random root MIDI on START: fret 5–8 range on lowest string of selected instrument
- Saves { scale_id, difficulty, instrument_id } to localStorage key 'subway-scaler-settings' (NOT root_midi)
- Calls GET /game/session-config with computed scale_id, root_midi, instrument_id
- On success: invokes callback to transition to game canvas
- On error: displays error message "Couldn't load session — check your connection and try again" with role="alert"
- START button re-enabled on error for retry

✅ **Settings Persistence:**
- On app load: reads localStorage 'subway-scaler-settings'
- Pre-fills Scale, Difficulty, Instrument from saved values (if exists)
- Defaults: first scale, Medium difficulty, first instrument
- Root MIDI always re-randomised (never read from localStorage)

✅ **Integration with main.js:**
- Modified main.js to import and call renderSetupScreen()
- Setup screen renders before game UI
- Once session-config succeeds, game UI (menu + canvas) becomes visible
- Settings persisted via PUT /api/plugins/subway-scaler/settings

✅ **Keyboard Navigation:**
- Tab order: Scale dropdown → Difficulty toggles → Instrument toggles → START
- Arrow keys (left/right or up/down) navigate within toggle groups
- All elements have :focus-visible styles from setup.css

✅ **Accessibility:**
- Error message has role="alert" for screen reader announcement
- Toggle groups have role="group" with aria-label
- All form inputs have proper labels

---

## File List

- `static/game/setup.js` — Setup screen UI module (created): renderSetupScreen(), form logic, localStorage integration
- `static/game/main.js` — Modified: imports renderSetupScreen, calls it at initialization, hides game UI until setup complete
- `static/game/ui/setup.css` — Already created in story 1-5: provides form styling and responsive design

---

## Change Log

- 2026-05-21: Story created. Setup UI and settings persistence scaffolded per UX-DR4, UX-DR5, NFR-006.
- 2026-05-21: Implemented setup.js with form logic, localStorage persistence, session-config integration. Integrated with main.js bootstrap flow.
