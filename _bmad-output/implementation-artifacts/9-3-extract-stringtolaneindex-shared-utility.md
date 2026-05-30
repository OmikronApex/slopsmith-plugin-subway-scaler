# Story 9.3: Extract `stringToLaneIndex` Shared Utility

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-3
**Story Key:** 9-3-extract-stringtolaneindex-shared-utility
**Depends on:** none

---

## Context

The conversion `paletteIdx = stringCount - string` (or equivalent) is independently computed in at least 5 locations across the codebase. If the string indexing convention ever changes, all sites must be updated individually — a known source of drift. This story extracts the conversion to a single canonical function.

**Current duplication sites (confirmed):**
1. `static/game/ui/SafeZoneRenderer.js:129` — `const paletteIdx = wave.safe_string != null ? (stringCount - wave.safe_string) : 0;`
2. `static/game/SceneManager.js:1200` — `const paletteIdx = anchorString != null ? (stringCount - anchorString) : 0;`
3. `static/game/TrackSystem.js:79` — `const paletteIdx = note?.string != null ? (stringCount - note.string) : 0;`
4. `static/game/ui/FretBox.js:114` — `const paletteIdx = stringCount - backendString;`
5. `static/game/ui/FretBox.js:129` — `const paletteIdx = stringCount - backendString;`

---

## User Story

As a **developer**,
I want the string-to-lane-index conversion in a single canonical place,
so that any change to the string indexing convention requires exactly one edit.

---

## Acceptance Criteria

**AC-1 — Shared function extracted:**
Given the duplicated `stringCount - string` calculation across the codebase,
When the utility is extracted,
Then all 5 known call sites import and call the shared function instead of computing inline.

**AC-2 — No other inline call sites remain:**
No other call sites in the codebase perform the same calculation inline.
(A `git grep` of `stringCount - ` in `static/game/` should yield zero false positives.)

**AC-3 — Unit tests pass:**
Given the new shared utility,
When unit tested directly,
Then `stringToLaneIndex(string, stringCount)` returns `stringCount - string` for valid inputs,
And edge cases are tested: `string = 0`, `string = stringCount - 1`, and `string = stringCount`.

**AC-4 — No test regression:**
Given all existing Vitest and Playwright tests,
When run after the extraction,
Then all pass without modification.

---

## Tasks / Subtasks

- [x] Task 1: Choose and create the shared utility location (AC: 1)
  - [x] 1.1 Prefer append to `static/game/ui/tokens.js` as a named export (already imported everywhere)
  - [x] 1.2 OR create new `static/game/utils.js` — if so, register in HTML module chain or import map
  - [x] 1.3 Function: `export function stringToLaneIndex(string, stringCount) { return stringCount - string; }`

- [x] Task 2: Migrate all call sites (AC: 1, 2)
  - [x] 2.1 `static/game/ui/SafeZoneRenderer.js:129` — replace inline with imported call
  - [x] 2.2 `static/game/SceneManager.js:1200` — replace inline with imported call
  - [x] 2.3 `static/game/TrackSystem.js:79` — replace inline with imported call
  - [x] 2.4 `static/game/ui/FretBox.js:114,129` — replace both inline calls with imported call
  - [x] 2.5 `git grep "stringCount - "` to verify no remaining inline sites
  - [x] 2.6 Verify all imports are correct (no 404s, no circular dependencies)

- [x] Task 3: Write unit tests (AC: 3)
  - [x] 3.1 Create test file (e.g. `tests/unit/js/stringToLaneIndex.test.js` or append to `stringPalette.test.js`)
  - [x] 3.2 Test valid inputs: `string=0, stringCount=6 → 6`; `string=5, stringCount=6 → 1`; `string=3, stringCount=4 → 1`
  - [x] 3.3 Test edge cases: `string = 0` (lowest), `string = stringCount - 1` (highest), `string = stringCount` (out-of-bounds guard)

- [x] Task 4: Run existing test suites (AC: 4)
  - [x] 4.1 All existing Vitest unit tests pass
  - [x] 4.2 All Playwright E2E specs pass

---

## Dev Notes

### Architecture Constraints

- **Preferred location:** `static/game/ui/tokens.js` — already imported by every file that needs it. Avoids adding a new import edge.
- **Fallback location:** `static/game/utils.js` — only if `tokens.js` creates circular imports. If used, must add `<script type="module" src="./utils.js">` or import-map entry.
- **Function signature:** `export function stringToLaneIndex(string, stringCount) { return stringCount - string; }`
- **Null-safe wrapper:** Call sites currently guard with `!= null ? (stringCount - string) : 0`. The shared function should accept `string` nullable and return `0` for null/undefined: `string != null ? stringCount - string : 0`

### Files to Modify

- `static/game/ui/tokens.js` (UPDATE — add `stringToLaneIndex` export)
- `static/game/ui/SafeZoneRenderer.js` (UPDATE — import and use shared function)
- `static/game/SceneManager.js` (UPDATE — import and use shared function)
- `static/game/TrackSystem.js` (UPDATE — import and use shared function)
- `static/game/ui/FretBox.js` (UPDATE — import and use shared function)

### Files to Create

- `tests/unit/js/stringToLaneIndex.test.js` (NEW — direct unit tests)

### Test File — `tests/unit/js/stringToLaneIndex.test.js`

```js
import { stringToLaneIndex } from '../../../static/game/ui/tokens.js';

describe('stringToLaneIndex', () => {
  test('6-string: string 0 (low E) → lane 6 (bottom)', () => {
    expect(stringToLaneIndex(0, 6)).toBe(6);
  });
  test('6-string: string 5 (high E) → lane 1 (top)', () => {
    expect(stringToLaneIndex(5, 6)).toBe(1);
  });
  test('4-string: string 0 → lane 4', () => {
    expect(stringToLaneIndex(0, 4)).toBe(4);
  });
  test('4-string: string 3 → lane 1', () => {
    expect(stringToLaneIndex(3, 4)).toBe(1);
  });
  test('null string → 0 (fallback)', () => {
    expect(stringToLaneIndex(null, 6)).toBe(0);
  });
  test('undefined string → 0 (fallback)', () => {
    expect(stringToLaneIndex(undefined, 6)).toBe(0);
  });
});
```

### Out of Scope

- Renaming `STRING_COLORS` or `STRING_SAFE_ZONE_FILLS` arrays
- Changing the string indexing convention itself (that's why this utility exists, but the decision to change is separate)
- Any behavioural changes beyond the extraction

---

## References

- Epic 9 specification — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 9-3]
- Duplicate call sites — [Source: `static/game/TrackSystem.js:79`, `static/game/SceneManager.js:1200`, `static/game/ui/SafeZoneRenderer.js:129`, `static/game/ui/FretBox.js:114,129`]
- tokens.js existing exports — [Source: `static/game/ui/tokens.js`]
- Deferred item: paletteIdx duplication — [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — "paletteIdx conversion duplicated"]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- Added `stringToLaneIndex(string, stringCount)` to `tokens.js` with null-safe guard.
- Migrated 6 call sites (5 known + 1 additional in SceneManager #showClearEffect):
  1. SafeZoneRenderer.js:129
  2. SceneManager.js:1200 (variant SZ colour)
  3. SceneManager.js:2208 (clear effect colour)
  4. TrackSystem.js:79 (track creation)
  5. FretBox.js:114 (string lines)
  6. FretBox.js:131 (cell colours)
- git grep confirms no remaining inline `stringCount - string` conversion patterns.
- 9 unit tests written and passing (valid inputs, edge cases, null/undefined fallback).
- Full vitest suite: no new regressions (same 2 pre-existing failures).

### File List

- `static/game/ui/tokens.js` (UPDATE — added stringToLaneIndex export)
- `static/game/ui/SafeZoneRenderer.js` (UPDATE — import + use shared function)
- `static/game/SceneManager.js` (UPDATE — import + use shared function, 2 call sites)
- `static/game/TrackSystem.js` (UPDATE — import + use shared function)
- `static/game/ui/FretBox.js` (UPDATE — import + use shared function, 2 call sites)
- `tests/unit/js/stringToLaneIndex.test.js` (NEW — 9 tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)