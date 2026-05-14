# Tasks: Track-Switching Game Rework

**Input**: Design documents from `/specs/007-track-switching-game/`  
**Prerequisites**: plan.md (required), spec.md, data-model.md, contracts/, research.md

**Tests**: TDD is MANDATORY per constitution. Contract tests MUST be written and FAILING before implementation begins.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and foundation structure

- [X] T001 Review existing code structure in services/, static/game/, tests/ and document module boundaries
- [X] T002 Update project dependencies (confirm Three.js in vendor/, Yin detection ready)
- [X] T003 Create initial GameEngine class structure in services/game_engine.py with GameSession skeleton

---

## Phase 2: Foundational (Blocking Prerequisites - TDD MANDATORY)

**Purpose**: Core infrastructure and contract tests - MUST complete before ANY user story implementation

**⚠️ CRITICAL**: Contract tests MUST be written FIRST and FAIL before implementation

### Contract Tests (WRITE FIRST - MUST FAIL) 🚨

- [X] T004 [P] Write contract test for POST /api/plugins/subway_scaler/game/start in tests/contract/test_game_start.py (MUST FAIL)
- [X] T005 [P] Write contract test for POST /api/plugins/subway_scaler/game/{id}/play-note in tests/contract/test_game_play_note.py (MUST FAIL)
- [X] T006 [P] Write contract test for GET /api/plugins/subway_scaler/game/{id} in tests/contract/test_game_state.py (MUST FAIL)

### Implementation - After Tests Are Failing

- [X] T007 [P] Implement GameSession class in services/game_engine.py with state machine (IDLE → RUNNING → PAUSED → FAILED)
- [X] T008 [P] Implement DifficultyManager in services/difficulty_manager.py with speed multiplier calculation
- [X] T009 [P] Extend ScaleManager in services/scales.py to support ascending/descending loop iteration
- [X] T010 Implement game_router.py endpoints to support all contract tests (depends on T007, T008, T009)
- [X] T011 Create SafeZoneRenderer class in static/game/ui/SafeZoneRenderer.js with mesh creation and updates
- [X] T012 Implement game-client.js polling logic for game state synchronization
- [X] T013 Update game main.js to integrate SafeZoneRenderer into render loop

**Verify**: All contract tests now PASS

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Start Game with Initial Track Placement (Priority: P1) 🎯 MVP

**Goal**: Player launches game and sees themselves positioned on a random track (not root), with first cart wave and safe zone highlight visible.

**Independent Test**: Start game → verify character position is non-root track → verify first wave renders → verify root note highlighted in red → story complete

### Integration Test for User Story 1

- [X] T014 [US1] Write integration test for complete game start flow in tests/integration/test_game_start_flow.py (start request → character positioned → first wave visible)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement GameSession.start() method to initialize scale, difficulty, and first wave in services/game_engine.py
- [X] T016 [P] [US1] Extend game_router.py POST /api/plugins/subway_scaler/game/start endpoint to handle scale_id and difficulty parameters
- [X] T017 [US1] Update static/game/main.js to call game/start API and initialize game state (depends on T016)
- [X] T018 [US1] Implement initial track selection logic in services/game_engine.py (random track ≠ root track)
- [X] T019 [US1] Implement first CartWave generation in services/game_engine.py with correct safe_track
- [X] T020 [US1] Add SafeZoneTrack rendering for root note in static/game/main.js (colored red, visible above carts)
- [X] T021 [US1] Test game start: hit /game/start endpoint and verify response includes session_id, initial_track, root_note

**Checkpoint**: User Story 1 complete - can start game and see setup screen

---

## Phase 4: User Story 2 - Play Note and Move to Safe Zone (Priority: P1)

**Goal**: Player plays correct note on instrument → character moves to safe track → next wave approaches with next safe zone → difficulty increases.

**Independent Test**: Start game (US1) → detect note matching root → character moves to highlighted track → next wave + safe zone appear with increased speed → story complete

### Integration Test for User Story 2

- [X] T022 [US2] Write integration test for note input flow in tests/integration/test_note_input_flow.py (play note → character move → next wave spawn)

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement note validation logic in services/game_engine.py (detect_midi vs expected_note matching)
- [X] T024 [P] [US2] Extend game_router.py POST /api/plugins/subway_scaler/game/{id}/play-note endpoint with full implementation
- [X] T025 [US2] Implement character movement animation in static/game/main.js (move to safe track position on note input)
- [X] T026 [US2] Implement next wave generation with increased speed in services/game_engine.py (depends on T023)
- [X] T027 [US2] Implement next safe zone track rendering in static/game/main.js (update color based on next note's string)
- [X] T028 [US2] Extend DifficultyManager to increase speed multiplier on correct note in services/difficulty_manager.py
- [X] T029 [US2] Update game polling loop to handle play-note responses and update UI accordingly in static/game/game-client.js
- [X] T030 [US2] Add validation: reject note input if outside time window (deadline check) in services/game_engine.py

**Checkpoint**: User Story 2 complete - can play one note successfully and see difficulty increase

---

## Phase 5: User Story 3 - Survive Multiple Rounds and Scale Loop (Priority: P1)

**Goal**: Player continues playing notes through ascending scale → transitions to descending → loops back → difficulty increases each round → game continues until player fails.

**Independent Test**: Start game (US1) → play all ascending scale notes correctly (US2 ×N) → verify scale transitions to descending → play descending notes correctly → verify loops back to ascending → story complete

### Integration Test for User Story 3

- [X] T031 [US3] Write integration test for full scale loop in tests/integration/test_scale_loop.py (ascending → descending → loop verification)

### Implementation for User Story 3

- [X] T032 [P] [US3] Verify ScaleManager ascending/descending iteration logic in services/scales.py (test with major/minor/pentatonic scales)
- [X] T033 [P] [US3] Implement scale loop handling in ScaleProgression.next_note() for transition without duplicate root notes
- [X] T034 [US3] Test scale progression: play full ascending scale → verify correct note sequence in manual testing
- [X] T035 [US3] Test scale loop: complete ascending → verify descending starts → verify returns to ascending (depends on T033)
- [X] T036 [US3] Verify difficulty continues scaling correctly throughout all rounds (speed increases per correct note)
- [X] T037 [US3] Update game state polling to maintain scale position across requests in static/game/game-client.js

**Checkpoint**: User Story 3 complete - full playable game sessions with scale looping

---

## Phase 6: User Story 4 - Fail and End Game (Priority: P2)

**Goal**: Player fails to play correct note or misses deadline → character hit by cart → game ends with final score displayed.

**Independent Test**: Start game (US1) → play one correct note (US2) → wait for deadline or play wrong note → verify collision detection → game ends with score display → story complete

### Integration Test for User Story 4

- [X] T038 [US4] Write integration test for game failure scenarios in tests/integration/test_game_failure.py (deadline miss, wrong note, collision)

### Implementation for User Story 4

- [X] T039 [P] [US4] Implement collision detection logic in services/game_engine.py (check player track vs cart wave safe_track at z=0)
- [X] T040 [P] [US4] Implement deadline tracking in services/game_engine.py (set next_deadline_ms, check in tick)
- [X] T041 [US4] Implement game failure endpoint response in game_router.py (status = FAILED, final_score)
- [X] T042 [US4] Implement end-game screen rendering in static/game/main.js (display final score, restart button)
- [X] T043 [US4] Add session cleanup in services/game_engine.py (mark session as expired after N minutes)
- [X] T044 [US4] Test failure scenarios: hit deadline → game ends with correct score

**Checkpoint**: User Story 4 complete - game failure and session closure working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance, edge cases, visual polish, and full integration

- [X] T045 [P] Verify 60 fps target in static/game/main.js (profile frame timing, optimize if needed)
- [X] T046 [P] Verify <100ms input response time (note detection → character move visible)
- [X] T047 [P] Test edge cases: scale with only 3 notes, very high difficulty (speed 2.5x), rapid fire input
- [X] T048 [P] Add visual polish: safe zone color animation, cart visual variety, score+difficulty HUD
- [X] T049 [P] Add logging for debugging: session lifecycle, note validation results, collision detection in services/game_engine.py
- [X] T050 Update quickstart.md with verified code examples and actual file paths
- [X] T051 Run full end-to-end test: start game → play 10+ notes → fail intentionally → verify final score
- [X] T052 Review all files for compliance with constitution (modular design, TDD applied, no unnecessary dependencies)

**Checkpoint**: All user stories complete and integrated, ready for demo/deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
  - **CRITICAL**: Contract tests MUST be written and FAILING before implementation
- **User Story 1 (Phase 3)**: Depends on Foundational - P1 priority, MVP scope
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (extends game loop)
- **User Story 3 (Phase 5)**: Depends on Foundational + US2 (adds looping)
- **User Story 4 (Phase 6)**: Depends on Foundational + US2 (adds failure detection)
- **Polish (Phase 7)**: Depends on all desired user stories

### Within-Phase Dependencies

- **Phase 2**: Write contract tests (T004-T006) FIRST → FAIL → then implementation (T007-T013)
- **Phase 3**: T016 (endpoint) → T017 (integrate in main.js) → T021 (verify)
- **Phase 4**: T023 (validation) → T024 (endpoint) → T025-T029 (UI updates)
- **Phase 5**: T032-T033 (scale logic) → T034-T035 (verification) → T036-T037 (integration)
- **Phase 6**: T039-T040 (failure detection) → T041-T042 (response + UI) → T044 (test)

### Parallel Opportunities

**Phase 2 Parallel Block**:
```
T004, T005, T006  (all contract tests - write together, verify all FAIL)
T007, T008, T009  (all backend classes - no dependencies)
T011              (SafeZoneRenderer - independent from backend)
```

**Phase 3+ Parallel Block**:
Once Foundational (Phase 2) completes, user story implementation can run in parallel by different team members:
```
Developer A: Phase 3 (US1 - Start Game)
Developer B: Phase 4 (US2 - Play Note) [after A completes US1 endpoints]
Developer C: Phase 6 (US4 - Failure) [independent logic, after Foundational]
```

**Within-Story Parallel**:
- T023 + T026 + T028 can run in parallel (different files, no shared state)
- T004, T005, T006 (contract tests) can run in parallel

---

## Test-Driven Development (TDD) - MANDATORY Per Constitution

### Gate: Contract Tests First

1. **Phase 2 T004-T006**: Write contract tests → Verify ALL FAIL
2. **Phase 2 T007-T013**: Implement code to make tests PASS
3. **Phase 3-6**: Integration + feature tests, same pattern

### Writing Tests (Before Implementation)

Example:
```python
# tests/contract/test_game_start.py - WRITE FIRST, SHOULD FAIL
def test_game_start_creates_session():
    response = client.post("/api/game/start", json={"scale_id": "major"})
    assert response.status_code == 200
    assert "session_id" in response.json()
```

Run: `pytest tests/contract/test_game_start.py` → ❌ FAIL (endpoint doesn't exist yet)

Then implement services/game_engine.py + game_router.py → ✅ PASS

---

## Parallel Example: User Story 2

```
3 developers work on US2 in parallel after Phase 2 completes:

Developer A:
  - T023: Implement note validation
  - T026: Implement next wave generation

Developer B:
  - T024: Extend play-note endpoint
  - T029: Update polling logic

Developer C:
  - T025: Character movement animation
  - T027: Safe zone rendering
  - T028: Difficulty scaling

All converge at T030 (validation check) for integration test (T022)
```

---

## Implementation Strategy

### MVP First (Recommended)

1. **Complete Phase 1**: Setup ✓
2. **Complete Phase 2**: Foundational (TDD) ✓
3. **Complete Phase 3**: User Story 1 ✓
4. **STOP and VALIDATE**: User Story 1 independently functional
5. **Deploy/Demo**: Show game start working
6. **Continue**: Add US2, US3, US4 incrementally

### Estimated Task Counts

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 10 tasks (3 tests + 7 implementation)
- **Phase 3 (US1)**: 8 tasks (1 integration test + 7 implementation)
- **Phase 4 (US2)**: 9 tasks (1 integration test + 8 implementation)
- **Phase 5 (US3)**: 6 tasks (1 integration test + 5 implementation)
- **Phase 6 (US4)**: 7 tasks (1 integration test + 6 implementation)
- **Phase 7 (Polish)**: 8 tasks
- **TOTAL**: 52 tasks

### Validation Checkpoints

- ✅ After Phase 1: Structure ready
- ✅ After Phase 2: All contract tests passing
- ✅ After Phase 3: Game start functional (MVP!)
- ✅ After Phase 4: Note input + movement working
- ✅ After Phase 5: Full playable session with scale looping
- ✅ After Phase 6: Game failure + end states
- ✅ After Phase 7: Polish complete, ready for release

---

## Notes

- **[P] = Parallelizable**: Different files, no blocking dependencies
- **[US#] = User Story**: Maps task to specific feature for traceability
- **Contract tests MUST FAIL first**: Per TDD and constitution requirements
- **Each user story independently testable**: Can stop at any checkpoint and validate
- **Avoid cross-story dependencies**: Each story adds value independently
- Commit after each task or logical group
- Stop at any checkpoint to demo/validate story in isolation
