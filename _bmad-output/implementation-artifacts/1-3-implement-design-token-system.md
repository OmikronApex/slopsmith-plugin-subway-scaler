# Story 1.3: Implement Design Token System

**Status:** review
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.3
**Story Key:** 1-3-implement-design-token-system

---

## User Story

As a developer,
I want a single-source-of-truth token module that exports JS hex constants and injects CSS custom properties at init,
So that Three.js materials and HTML overlays use identical colour values with zero CSS/JS drift.

---

## Acceptance Criteria

**AC-1 — Design Token Module Export:**
- `static/game/ui/tokens.js` exports an object named `COLORS` with Night City palette (8 colors total)
- Exact structure: `{ BG_VOID: 0x0D0D1A, BG_STAGE: 0x1A1A2E, BG_NEAR: 0x252538, ACCENT: 0xFFB800, TEXT_PRIMARY: 0xE8E8F0, TEXT_DISABLED: 0x555570, EDGE: 0x08080F, ... }`
- All values are JavaScript hex integers (not strings)
- `STRING_COLORS` object exported with exactly 7 Rocksmith string colors: indices 1-7, values as hex integers
- Rocksmith color mapping: string 1 → 0xFF3333, string 2 → 0xFFDD00, string 3 → 0x3366FF, string 4 → 0xFF8800, string 5 → 0x33AA33, string 6 → 0x9933CC, string 7 → 0xFF66AA

**AC-2 — CSS Custom Property Injection:**
- `injectTokens()` function exported from `tokens.js`
- When called, injects CSS custom properties into `document.documentElement.style`
- All Night City palette colors available as `--color-bg-void`, `--color-bg-stage`, `--color-bg-near`, `--color-accent`, `--color-text-primary`, `--color-text-disabled`, `--color-edge`
- All 7 Rocksmith string colors available as `--color-string-1` through `--color-string-7`
- CSS custom properties are formatted as hex strings: `#0D0D1A`, `#1A1A2E`, etc.
- Custom properties are set before `requestAnimationFrame()` starts (call `injectTokens()` synchronously in `main.js` at initialization)

**AC-3 — Colour Values Match Specification:**
- Night City palette matches exactly: BG_VOID `#0D0D1A`, BG_STAGE `#1A1A2E`, BG_NEAR `#252538`, ACCENT `#FFB800`, TEXT_PRIMARY `#E8E8F0`, TEXT_DISABLED `#555570`, EDGE `#08080F`
- Rocksmith string colors match exactly (1-based indexing)
- No other hardcoded colour constants in the codebase

**AC-4 — No Color Drift:**
- Three.js materials that need Night City colours reference `COLORS.BG_VOID` etc., never hardcoded hex
- Three.js materials that need string colours reference `STRING_COLORS[stringIndex]`, never hardcoded hex
- No CSS files contain hardcoded hex values — all use `var(--color-*)` custom properties
- Tests validate that `COLORS` and CSS custom properties match (no manual sync required)

---

## Developer Context

### What This Story Does

This story creates the **single source of truth** for all design tokens used throughout the game. Two forms:
1. **JS constants** (`COLORS`, `STRING_COLORS`) — for Three.js materials and runtime logic
2. **CSS custom properties** — for HTML overlays, setup screen, score display, etc.

Both forms are derived from a single canonical definition in `tokens.js`, eliminating the risk of CSS/JS colour drift that plagued earlier projects.

### Why Tokens Matter

The Night City palette and Rocksmith string colors are core to the visual identity. Without a single source of truth:
- A colour change requires updates in multiple places (CSS + JS)
- Typos cause visual inconsistencies ("this overlay is slightly different shade")
- New features copy old hardcoded hex values instead of using the palette

Tokens solve this by making colours a **data structure, not magic strings**.

### Color Values Reference

**Night City Palette (UX-DR2):**
```
BG_VOID:      #0D0D1A  (deepest void, scene background)
BG_STAGE:     #1A1A2E  (dark stage, lane geometry)
BG_NEAR:      #252538  (near foreground, UI elements)
ACCENT:       #FFB800  (bright amber, buttons and highlights)
TEXT_PRIMARY: #E8E8F0  (light grey, primary text)
TEXT_DISABLED:#555570  (muted grey, disabled text)
EDGE:         #08080F  (almost black, edge/border emphasis)
```

**Rocksmith String Colors (UX-DR3) — 1-indexed:**
```
String 1: #FF3333  (high E, red)
String 2: #FFDD00  (B, yellow)
String 3: #3366FF  (G, blue)
String 4: #FF8800  (D, orange)
String 5: #33AA33  (A, green)
String 6: #9933CC  (low E, purple)
String 7: #FF66AA  (7-string low, pink)
```

### Pattern: Tokens as Data

Design tokens are **data with semantic names**, not magic values. Each colour has a semantic role:
- **BG_VOID** = scene background (lowest contrast, deepest)
- **ACCENT** = primary interactive colour (highest contrast, most saturated)
- **TEXT_PRIMARY** = main body text (readable on all backgrounds)
- **STRING_COLORS[i]** = visual identity for fretboard lane i (unchanging per string)

When a new feature needs a colour, **choose from existing tokens by semantic role** rather than creating new hex values.

### File Locations

- **Implementation:** `static/game/ui/tokens.js` (new)
- **Tests:** `tests/unit/js/tokens.test.js` (new)
- **CSS Integration:** Update any existing `.css` files that use hardcoded hex → `var(--color-*)` (if found)

### Current State: No Existing Tokens

There is no `tokens.js` yet. `main.js` and other files may contain hardcoded hex values. This story creates the canonical module and establishes the pattern for future features.

### No Wiring to Three.js Yet

This story creates the tokens and the injection mechanism. **Story 3.1 (SceneManager)** will wire `COLORS.BG_VOID` into the Three.js renderer background. **Story 3.2 (TrackSystem)** will wire `STRING_COLORS[i]` into lane safe-zone materials. Do NOT pre-emptively wire Three.js in this story — just define and test the tokens.

### Architecture Compliance

From architecture.md:
- Tokens are the **single source of truth** for all design values
- `injectTokens()` called synchronously at app init (before game loop starts)
- CSS custom properties are preferred by all CSS files — no duplicate hex values
- Three.js materials reference `COLORS` and `STRING_COLORS` constants — no hardcoded hex

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `static/game/ui/tokens.js` | CREATE | JS module exporting COLORS, STRING_COLORS, injectTokens() |
| `static/game/ui/tokens.test.js` | CREATE | ATDD scaffold tests (will be un-skipped during implementation) |
| `static/game/main.js` | MODIFY | Add call to `injectTokens()` at app initialization |
| Any `.css` files with hardcoded hex | MODIFY | Replace hardcoded hex with `var(--color-*)` references |

---

## Design Token Template

### tokens.js Structure

```js
// ===== COLORS EXPORT (JS hex integers for Three.js) =====
export const COLORS = {
  // Night City Palette (8 colors)
  BG_VOID:       0x0D0D1A,
  BG_STAGE:      0x1A1A2E,
  BG_NEAR:       0x252538,
  ACCENT:        0xFFB800,
  TEXT_PRIMARY:  0xE8E8F0,
  TEXT_DISABLED: 0x555570,
  EDGE:          0x08080F,
  // Additional (if needed) — but the 7 above are canonical
};

// ===== STRING COLORS EXPORT (1-indexed, for Rocksmith convention) =====
export const STRING_COLORS = {
  1: 0xFF3333,  // string 1 (high E), red
  2: 0xFFDD00,  // string 2 (B), yellow
  3: 0x3366FF,  // string 3 (G), blue
  4: 0xFF8800,  // string 4 (D), orange
  5: 0x33AA33,  // string 5 (A), green
  6: 0x9933CC,  // string 6 (low E), purple
  7: 0xFF66AA,  // string 7 (7-string low), pink
};

// ===== CSS CUSTOM PROPERTY INJECTION =====
export function injectTokens() {
  // Convert COLORS to CSS custom properties
  const root = document.documentElement;
  
  // Night City palette
  root.style.setProperty('--color-bg-void', hexToCss(COLORS.BG_VOID));
  root.style.setProperty('--color-bg-stage', hexToCss(COLORS.BG_STAGE));
  root.style.setProperty('--color-bg-near', hexToCss(COLORS.BG_NEAR));
  root.style.setProperty('--color-accent', hexToCss(COLORS.ACCENT));
  root.style.setProperty('--color-text-primary', hexToCss(COLORS.TEXT_PRIMARY));
  root.style.setProperty('--color-text-disabled', hexToCss(COLORS.TEXT_DISABLED));
  root.style.setProperty('--color-edge', hexToCss(COLORS.EDGE));
  
  // Rocksmith string colors (1-indexed)
  for (let i = 1; i <= 7; i++) {
    root.style.setProperty(`--color-string-${i}`, hexToCss(STRING_COLORS[i]));
  }
}

// ===== INTERNAL HELPER =====
function hexToCss(hexInt) {
  return '#' + hexInt.toString(16).padStart(6, '0').toUpperCase();
}
```

---

## Test Requirements (Red-Green-Refactor)

### Red Phase (Write Failing Tests)

The ATDD scaffold `tests/unit/js/tokens.test.js` will contain tests like:
- ✓ "exports COLORS object"
- ✓ "COLORS.BG_VOID equals 0x0D0D1A"
- ✓ "COLORS has exactly 7 Night City palette properties"
- ✓ "exports STRING_COLORS object"
- ✓ "STRING_COLORS[1] equals 0xFF3333"
- ✓ "STRING_COLORS has exactly 7 string colors (indices 1-7)"
- ✓ "injectTokens() sets --color-bg-void on document root"
- ✓ "injectTokens() sets all 7 string color custom properties"
- ✓ "injectTokens() custom properties match COLORS hex values"

Currently these are all `it.skip()`. Before implementation, un-skip them. They will FAIL because tokens.js doesn't exist yet.

### Green Phase (Implement to Pass Tests)

Add the COLORS, STRING_COLORS, injectTokens() to tokens.js. Tests pass.

### Refactor Phase

No refactoring needed — shape is mandated by story ACs.

---

## Definition of Done

- [x] `COLORS` object exported with exact 7 Night City palette values (hex integers)
- [x] `STRING_COLORS` object exported with exactly 7 string colors (1-indexed, hex integers)
- [x] `injectTokens()` function exports and injects all CSS custom properties
- [x] CSS custom properties match COLORS and STRING_COLORS exactly (no manual sync drift)
- [x] `tests/unit/js/tokens.test.js` tests un-skipped and all pass
- [x] `main.js` calls `injectTokens()` at app initialization (before `requestAnimationFrame`)
- [x] No hardcoded hex values in JS or CSS (except inside tokens.js)
- [x] `rtk vitest` runs with 0 new failures

---

## Dev Agent Record

### Implementation Plan

Straightforward addition of:
1. Create `static/game/ui/tokens.js` with COLORS, STRING_COLORS, injectTokens()
2. Create test scaffold `tests/unit/js/tokens.test.js` (starting with it.skip())
3. Un-skip tests during green phase
4. Update `main.js` to call `injectTokens()` at init
5. Scan CSS files for hardcoded hex values → replace with `var(--color-*)`

### Completion Notes

✅ Implemented 2026-05-21. All ACs satisfied:
- AC-1: COLORS object exported with exact 7 Night City palette values (hex integers) ✓
- AC-2: injectTokens() function exported and injects all CSS custom properties ✓
- AC-3: Colour values match specification exactly (no drift) ✓
- AC-4: No hardcoded hex values in JS (except tokens.js); no CSS files with hex (none exist yet) ✓

Test results: 28 new tests pass (tokens.test.js), 99 total pass, 0 new regressions. Two pre-existing SafeZoneRenderer failures persist (documented in story 1.1).

---

## File List

- `static/game/ui/tokens.js` (created) — JS module exporting COLORS, STRING_COLORS, injectTokens()
- `tests/unit/js/tokens.test.js` (created) — ATDD tests for design token system (28 tests)
- `static/game/main.js` (modified) — Added import and call to injectTokens() at bootstrap init

---

## Change Log

- 2026-05-21: Story created. Design token system scaffolded per UX-DR1 specifications.
- 2026-05-21: Implementation complete. tokens.js created with COLORS and STRING_COLORS exports. injectTokens() wired to main.js bootstrap. All 28 tests pass. Zero new regressions.

