# Story 10.4: Difficulty-Based Scoring Multiplier

Status: review

## Story

As a **player**,
I want higher difficulty levels to award more points per correct note,
So that challenging settings are properly rewarded.

## Acceptance Criteria

1. **Easy** — `GameState.session.difficulty === 'easy'` → multiplier **x1.0** → `BASE_SCORE × 1.0` per correct note.

2. **Medium** — `difficulty === 'medium'` → multiplier **x2.0**.

3. **Hard** — `difficulty === 'hard'` → multiplier **x3.0**.

4. **Immutable** — Multiplier is read from `GameState.session.difficulty` at session start and does not change mid-run.

5. **Display** — Hard-mode correct note awards 300 (100 × 3.0). HUD shows "x3.0" badge next to score in `color-accent` text.

6. **SDK end()** — When `end()` called on Quit, modifiers payload includes `difficulty` for leaderboard filtering.

## Tasks / Subtasks

- [x] Add `DIFFICULTY_MULTIPLIERS` constant to `GameState.js` (AC: #1-3)
  - [x] `{ easy: 1.0, medium: 2.0, hard: 3.0 }`
- [x] Apply multiplier in score increment (AC: #1-4)
  - [x] `increment = round(100 * DIFFICULTY_MULTIPLIERS[session.difficulty])` in game_engine.py
  - [x] `BASE_SCORE = 100` exported from GameState.js
- [x] Add multiplier badge to `ScoreDisplay.js` (AC: #5)
  - [x] Show "x1.0" / "x2.0" / "x3.0" in `color-accent` text via setDifficulty()
- [x] Verify `end()` payload includes difficulty (AC: #6)
- [x] Tests (AC: #1-6)

## Dev Notes

### Architecture Compliance

- `CartSystem.js` owns `runtime.score` writes per GameState ownership table
- `GameState.session.difficulty` is populated from setup screen (Story 10-2)
- `BASE_SCORE = 100` from PRD FR-004: "Base points: 100 × difficulty multiplier"
- No mid-run difficulty change allowed — single code path for difficulty setting

### Multiplier Badge in HUD

Extend `ScoreDisplay.js` (from Epic 8-1):
```js
const multSpan = document.createElement('span');
multSpan.className = 'score-multiplier';
multSpan.style.color = 'var(--color-accent)';
multSpan.textContent = `x${DIFFICULTY_MULTIPLIERS[GameState.session.difficulty].toFixed(1)}`;
```

Position it immediately after the score number. No animation needed — static text that updates only on session restart.

### Files to Touch

| File | Action |
|---|---|
| `static/game/GameState.js` | UPDATE — add `DIFFICULTY_MULTIPLIERS` const and `BASE_SCORE` |
| `static/game/CartSystem.js` | UPDATE — read difficulty multiplier in score computation |
| `static/game/ui/ScoreDisplay.js` | UPDATE — add x-badge next to score |

### Testing

- Parameterised Vitest: for each difficulty level, assert correct increment:
  ```js
  test.each([['easy', 100], ['medium', 200], ['hard', 300]])(
    '%s awards %i per correct note',
    (difficulty, expected) => { ... }
  );
  ```
- Vitest: assert multiplier badge text matches difficulty
- Regression: existing score-related tests pass

### References

- [Source: epics.md § Epic 10 — Story 10-4]
- [Source: PRD FR-004 — Base score 100 × difficulty multiplier]
- [Source: Architecture doc § GameState ownership table — CartSystem owns runtime.score]
- [Source: Epic 8-1 — ScoreDisplay.js]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- DIFFICULTY_MULTIPLIERS and BASE_SCORE exported from GameState.js
- Backend game_engine.py applies multiplier at note acceptance: `round(100 * multiplier)`
- ScoreDisplay.js now creates a wrapper span + score span + mult span; setDifficulty() updates badge text
- main.js calls scoreDisplay.setDifficulty(state.difficulty) after HUD shows at game start
- Adapter note: story referenced CartSystem.js which doesn't exist in codebase; score is backend-computed

### File List
- static/game/GameState.js
- static/game/ui/ScoreDisplay.js
- static/game/main.js
- services/game_engine.py
- tests/unit/js/difficulty-multiplier.test.js
- tests/unit/js/ScoreDisplay.test.js
- tests/integration/test_difficulty_multiplier.py

### Change Log
- 2026-05-30: Implemented difficulty scoring multiplier (Story 10-4)