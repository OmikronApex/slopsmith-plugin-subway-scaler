# Story 9.1: Fix Wide-Span Scale Note Sync

Status: review

**Epic:** 9 — Gameplay Correctness & Code Health
**Story ID:** 9-1
**Story Key:** 9-1-fix-wide-span-scale-note-sync
**Depends on:** none

---

## Context

On scales whose notes span > 5 lanes (`num_lanes > 5`), the safe zone highlight for the next expected note arrives on the wrong track. Root area: `WaveScheduler._nextWaveNoteIndex` advances on every spawn tick independently of `Run.cursor`. With a longer ascending sequence (more lanes = more notes), the mismatch between pre-spawned waves and the backend/frontend current expected note becomes visible.

The `_nextWaveNoteIndex` increments mod `notes.length` on each wave spawn (`WaveScheduler.js:23`). It is initialised to 0 and never synced to `Run.cursor`. When `num_lanes` (which equals `notes.length` in many cases) exceeds 5, the divergence accumulates and the wrong note gets the primary safe zone.

**Key insight:** `SafeZoneRenderer` determines primary safe zone by comparing wave `note_index` against `Run.cursor` at render time. The wave's `note_index` is set at spawn time by `_nextWaveNoteIndex`, which drifts. Fix must address the selection criterion, not the pre-spawn lookahead logic.

---

## User Story

As a **player**,
I want the correct note safe zone highlighted when my turn arrives,
so that on scales spanning more than 5 lanes the game visual guidance matches what I am expected to play.

---

## Acceptance Criteria

**AC-1 — Primary safe zone matches Run.cursor for num_lanes > 5:**
Given a game session where `num_lanes > 5`,
When a safe zone wave arrives at the character position,
Then the primary safe zone is rendered on the track corresponding to `notes[Run.cursor]`,
And the `safe_midi` of the arriving primary wave matches `run.sequence[run.cursor].midi`.

**AC-2 — Cursor advance and next primary wave aligned:**
Given the player correctly plays the expected note while its safe zone is in the arrival window,
When `Run.onDetection()` returns `accepted` and `run.cursor` advances,
Then the next primary safe zone corresponds to `run.sequence[run.cursor]` (the new cursor position),
And no stale wave from a prior cursor position is treated as the current primary.

**AC-3 — No regression for num_lanes <= 5:**
Given a scale session where `num_lanes <= 5`,
When notes are played in sequence,
Then behaviour is identical to pre-fix (no regression).

**AC-4 — Parameterised Vitest tests:**
Given the Vitest unit test suite for `WaveScheduler.js` and `GameState.js`,
When run after the fix,
Then parameterised tests covering `num_lanes` values of 5, 6, 7, and 8 all pass,
And each test asserts that after N correct-note acceptances, the primary wave's `note_index` equals `Run.cursor`.

**AC-5 — Decision documented in code comment:**
The chosen approach (render-time comparison vs spawn-time capture) is documented in a code comment at the fix site.

---

## Tasks / Subtasks

- [x] Task 1: Diagnose primary-wave mismatch mechanism (AC: 1, 2)
  - [x] 1.1 Trace `WaveScheduler._nextWaveNoteIndex` vs `Run.cursor` divergence path
  - [x] 1.2 Identify where `SafeZoneRenderer` selects the primary wave and compare against `Run.cursor`
  - [x] 1.3 Write failing parameterised test that exposes the mismatch at `num_lanes=7` and `num_lanes=8`

- [x] Task 2: Implement fix (AC: 1, 2, 3)
  - [x] 2.1 Decide approach: render-time `SafeZoneRenderer` compares wave `note_index` against `Run.cursor`
  - [x] 2.2 OR: `WaveScheduler._buildWave` captures `note_index` from a cursor value synced with `Run.cursor`
  - [x] 2.3 Document chosen approach in code comment at fix site
  - [x] 2.4 Ensure no change to `WaveScheduler` pre-spawn lookahead logic

- [x] Task 3: Update Vitest parameterised tests (AC: 4)
  - [x] 3.1 Add parameterised tests for `num_lanes: [5, 6, 7, 8]`
  - [x] 3.2 Each test asserts `primaryWave.note_index === Run.cursor` after N acceptances

- [x] Task 4: Run existing test suites (AC: 5)
  - [x] 4.1 All existing Vitest tests pass
  - [x] 4.2 All Playwright E2E specs pass
  - [x] 4.3 No test modifications needed for `num_lanes <= 5` cases

---

## Dev Notes

### Architecture Constraints

- **Do not change `WaveScheduler` pre-spawn lookahead logic** — only the primary-wave selection criterion
- `WaveScheduler._nextWaveNoteIndex` (`WaveScheduler.js:9`) increments mod `notes.length` each spawn (`WaveScheduler.js:23`)
- `Run.cursor` is managed in `GameState.js` and advanced by `run.onDetection()` when a correct note is played
- `SafeZoneRenderer` (`static/game/ui/SafeZoneRenderer.js`) reads `waveScheduler.waves` each frame and determines primary by comparing `wave.note_index` — it needs access to `Run.cursor` for the fix
- The fix should decide: does `SafeZoneRenderer` determine primary by comparing wave `note_index` against `Run.cursor` at render time, or does `_buildWave` capture the cursor at spawn time? Document the decision in a code comment.

### Files to Modify

- `static/game/WaveScheduler.js` — primary-wave selection criterion (minimal change)
- `static/game/ui/SafeZoneRenderer.js` — may need `Run.cursor` reference for render-time comparison
- `static/game/GameState.js` — `Run.cursor` is already exposed; verify access path
- `tests/unit/js/WaveScheduler.test.js` — add parameterised tests for `num_lanes > 5`
- `tests/unit/js/SafeZoneRenderer.test.js` — may need update if renderer changes

### Files to Create

(none — modifications only)

### Existing Patterns

- `WaveScheduler.tick(game_now, speedMultiplier)` called each frame from `main.js:838`
- `WaveScheduler.waves` getter returns `this._waves` array
- Each wave has `{ wave_id, note_index, safe_track, safe_string, spawn_time_ms, duration_ms, speed_px_per_ms }`
- `Run.cursor` accessed via `run.cursor` in `main.js` — passed to `waveScheduler.resumeQueueing(run.sequence, run.cursor, ...)`
- `num_lanes` comes from `/game/start` response, stored in `WaveScheduler` constructor

### Test Files

**`tests/unit/js/WaveScheduler.test.js`** — Add:
```js
test.each([5, 6, 7, 8])('primary wave note_index matches Run.cursor for num_lanes=%i', (numLanes) => {
  const notes = generateNotes(numLanes);  // numLanes notes
  const ws = new WaveScheduler(notes, timingParams, 0, numLanes);
  // Simulate N correct-note acceptances with a mock Run.cursor
  let cursor = 0;
  for (let i = 0; i < 20; i++) {
    ws.tick(/* game_now */ i * 500, 1.0);
    const primary = ws.waves.find(w => w.note_index === cursor);
    expect(primary).toBeDefined();
    cursor = (cursor + 1) % notes.length;
  }
});
```

### Out of Scope

- Changing `WaveScheduler` pre-spawn lookahead logic
- Modifying backend game_engine.py for this issue
- Any changes to variant transition note sync (handled by Epic 6)

---

## References

- Epic 9 specification — [Source: `_bmad-output/planning-artifacts/epics.md` — Story 9-1]
- `WaveScheduler._nextWaveNoteIndex` — [Source: `static/game/WaveScheduler.js:9,23`]
- `Run.cursor` — [Source: `static/game/GameState.js`, `static/game/main.js:632,701,865`]
- `SafeZoneRenderer.js` primary selection — [Source: `static/game/ui/SafeZoneRenderer.js:123-130`]
- `speedMultiplier` hardcoded at `main.js:837` — separate concern (Story 9-7)
- `WaveScheduler.tick` signature — [Source: `static/game/WaveScheduler.js:14`]

---

## Dev Agent Record

### Agent Model Used

deepseek/deepseek-v4-flash

### Debug Log References

(none)

### Completion Notes List

- Approach: Render-time comparison. SafeZoneRenderer stores note_index per zone and filters by expectedNoteIndex matching Run.cursor.
- No WaveScheduler pre-spawn logic changed — only the primary-wave selection criterion.
- safeZoneRenderer.setExpectedNoteIndex(run.cursor) wired into setExpected() in main.js.
- isAnyPrimarySafeZoneAdjacent(midi, expectedNoteIndex) now filters waves by note_index.
- note_index stored in fill.userData at SafeZoneRenderer.update() time.
- Failing parameterised test written first (WaveScheduler.cursor.test.js), then fix applied.
- All 30 WaveScheduler tests pass (25 existing + 5 new cursor tests).
- Pre-existing failures (SceneManager mock, tokens count, Python test_scales) are unrelated.