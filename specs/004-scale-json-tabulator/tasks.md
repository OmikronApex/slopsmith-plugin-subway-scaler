# Tasks: Scale JSON Tabulator

**Input**: Design documents from `/specs/004-scale-json-tabulator/`  
**Prerequisites**: plan.md, spec.md (required)  
**Branch**: `004-scale-json-tabulator`

**Organization**: Tasks grouped by user story to enable independent implementation. Constitution mandates TDD - tests written first and MUST FAIL before implementation.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3) - only for story-specific tasks
- Paths relative to repo root

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create infrastructure for scales JSON migration

- [X] T001 Create `scales.json` in plugin root with scale definitions (reference research.md)
- [X] T002 [P] Update `services/schemas.py` to add ScalePattern and StringFretPair Pydantic models
- [X] T003 Create `services/tabulator.py` module (stub) with Tabulator and GeometryValidator class definitions

---

## Phase 2: Foundational (Core Dependencies)

**Purpose**: Infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete

- [X] T004 [P] Contract test: Load scales.json successfully in `tests/contract/test_scales.py::test_load_scales_json` (WRITE FIRST, MUST FAIL)
- [X] T005 [P] Contract test: Invalid JSON raises ValueError in `tests/contract/test_scales.py::test_load_invalid_json` (WRITE FIRST, MUST FAIL)
- [X] T006 Update `services/scales.py` to load scales from JSON instead of hardcoded list (load_scales_from_json function)
- [X] T007 Update `services/scales_router.py` to use loaded scales instead of in-memory catalog

**Checkpoint**: Scales successfully load from JSON. All contract tests pass.

---

## Phase 3: User Story 1 - JSON Configuration (Priority: P1) 🎯 MVP

**Goal**: Plugin developers can externalize scale definitions from code into a JSON file and reload without code changes.

**Independent Test**: Load scale definitions from JSON file and confirm they match expected scale patterns.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Contract test: GET `/api/plugins/subway_scaler/scales` returns all loaded scales in `tests/contract/test_scales.py::test_get_all_scales` (WRITE FIRST, MUST FAIL)
- [X] T009 [P] [US1] Contract test: GET `/api/plugins/subway_scaler/scales/{scale_id}` returns specific scale in `tests/contract/test_scales.py::test_get_scale_by_id` (WRITE FIRST, MUST FAIL)
- [X] T010 [US1] Integration test: Modified scales.json loads correctly on plugin reload in `tests/integration/test_scales_reload.py` (WRITE FIRST, MUST FAIL)

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement `services.scales.get_scale(scale_id: str) -> Scale` in `services/scales.py`
- [X] T012 [P] [US1] Implement `services.scales.list_scales() -> list[Scale]` in `services/scales.py`
- [X] T013 [US1] Update `services/scales_router.py` to expose GET `/api/plugins/subway_scaler/scales` and `/api/plugins/subway_scaler/scales/{scale_id}`
- [X] T014 [US1] Add error handling in scales_router for missing/invalid scale_id (return 404)
- [X] T015 [US1] Verify all US1 contract tests pass

**Checkpoint**: User Story 1 complete. Scales load from JSON, endpoints work, all tests pass. Can be deployed independently.

---

## Phase 4: User Story 2 - Tabulator Encoding (Priority: P1)

**Goal**: Tabulator encodes scales as fret positions across multiple strings, matching how musicians naturally play scales on guitar.

**Independent Test**: Given a scale and root note, verify tabulator generates multi-string fret patterns that represent the scale correctly.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T016 [P] [US2] Contract test: POST `/api/plugins/subway_scaler/scales/{scale_id}/tabulate` with root_note returns pattern in `tests/contract/test_tabulator.py::test_tabulate_major_c` (WRITE FIRST, MUST FAIL)
- [X] T017 [P] [US2] Contract test: Tabulator generates 6+ notes for major scale in `tests/contract/test_tabulator.py::test_tabulate_all_notes` (WRITE FIRST, MUST FAIL)
- [X] T018 [P] [US2] Contract test: Multiple root notes generate different patterns in `tests/contract/test_tabulator.py::test_tabulate_different_roots` (WRITE FIRST, MUST FAIL)

### Implementation for User Story 2

- [X] T019 [P] [US2] Implement `Tabulator.encode_scale(scale: Scale, root_note: str) -> ScalePattern` in `services/tabulator.py` (maps scale intervals to fret/string pairs)
- [X] T020 [P] [US2] Implement `GUITAR_OPEN_NOTES` constant in `services/tabulator.py` (MIDI notes for E-A-D-G-B-E tuning: [40, 45, 50, 55, 59, 64])
- [X] T021 [US2] Implement helper `_note_to_midi(note_name: str) -> int` in `services/tabulator.py` to convert note names to MIDI
- [X] T022 [US2] Add `services/tabulator.py` functions to find lowest playable fret for each scale note (respecting 0-24 range)
- [X] T023 [US2] Expose `/api/plugins/subway_scaler/scales/{scale_id}/tabulate` endpoint in `services/scales_router.py` (POST with root_note parameter)
- [X] T024 [US2] Verify all US2 contract tests pass

**Checkpoint**: User Story 2 complete. Tabulator encodes scales correctly across strings. Can be deployed independently. Scales with tabulator patterns work from JSON.

---

## Phase 5: User Story 3 - Geometry Validation (Priority: P2)

**Goal**: System validates that encoded scale patterns are physically playable on standard guitar tuning, preventing invalid fret/string combinations.

**Independent Test**: Validate several scale patterns and confirm all fret positions are within playable range on 6-string guitar.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T025 [P] [US3] Contract test: Valid pattern passes validation in `tests/contract/test_validator.py::test_validate_valid_pattern` (WRITE FIRST, MUST FAIL)
- [X] T026 [P] [US3] Contract test: Fret > 24 raises error in `tests/contract/test_validator.py::test_validate_invalid_fret` (WRITE FIRST, MUST FAIL)
- [X] T027 [P] [US3] Contract test: String > 6 raises error in `tests/contract/test_validator.py::test_validate_invalid_string` (WRITE FIRST, MUST FAIL)

### Implementation for User Story 3

- [X] T028 [P] [US3] Implement `GeometryValidator.validate_pattern(pattern: ScalePattern) -> tuple[bool, list[str]]` in `services/tabulator.py`
- [X] T029 [P] [US3] Add validation check: All frets in range 0-24 in GeometryValidator
- [X] T030 [P] [US3] Add validation check: All strings in range 1-6 in GeometryValidator
- [X] T031 [US3] Call GeometryValidator in `/api/plugins/subway_scaler/scales/{scale_id}/tabulate` endpoint before returning pattern
- [X] T032 [US3] Return 422 (Unprocessable Entity) with error list if validation fails in tabulate endpoint
- [X] T033 [US3] Verify all US3 contract tests pass

**Checkpoint**: User Story 3 complete. Geometry validation working. Invalid patterns rejected with clear error messages. All three stories independently testable and integrated.

---

## Phase 6: Integration & Polish

**Purpose**: End-to-end testing and final refinements

- [X] T034 [P] Integration test: Complete flow (load scale → tabulate → validate) in `tests/integration/test_scale_tabulator_flow.py`
- [X] T035 [P] Update `quickstart.md` with actual code examples from implementation
- [X] T036 Verify all existing contract tests still pass (non-regression)
- [X] T037 [P] Update `CLAUDE.md` with link to completed tasks.md
- [X] T038 Performance check: Ensure scale loading + tabulation < 100ms per request

**Checkpoint**: Feature complete. All tests pass. Documentation updated.

---

## Phase 7: Bass & UI Refinements

**Purpose**: Fix UI issues and improve bass support

- [X] T039 [P] Update `fretboard.js` to prefer box patterns (natural fingerings)
- [X] T040 [P] Update `scene.js` `rebuildTracks` to cover full fret span (including empty frets)
- [X] T041 [P] Increase `VISIBLE_ROWS` to 8 in `main.js` to show full octave
- [X] T042 Verify bass A minor scale shows expected tracks (5, 6, 7, 8) in UI

**Checkpoint**: Bass patterns look natural, lanes correspond to frets, full octave visible.

### Phase Dependencies

| Phase | Depends On | Can Start |
|-------|-----------|-----------|
| **Setup (1)** | Nothing | Immediately |
| **Foundational (2)** | Setup complete | After Phase 1 |
| **US1 (3)** | Foundational complete | After Phase 2 |
| **US2 (4)** | Foundational complete | After Phase 2 (can parallel with US1) |
| **US3 (5)** | Foundational complete | After Phase 2 (can parallel with US1/US2) |
| **Polish (6)** | All stories complete | After Phase 5 |
| **Bass & UI (7)** | Polish complete | After Phase 6 |

### Within Each User Story

- Contract tests MUST be written first and FAIL before implementation begins
- Run tests after each implementation task
- Fix tests if they fail unexpectedly
- Mark story complete only when all tests pass

### Parallel Opportunities

- **Setup**: T002, T003 can run in parallel (different files)
- **Foundational**: T004, T005 (test writing) can be parallel
- **User Stories**: Once Foundational complete, US1/US2/US3 can run in parallel by different developers
- **Within US1**: T008, T009 (test writing) parallel; T011, T012 (implementations) parallel
- **Within US2**: T016, T017, T018 (tests) parallel; T019, T020, T021 (implementations) parallel
- **Within US3**: T025, T026, T027 (tests) parallel; T028, T029, T030 (implementations) parallel

---

## Parallel Example: Execute US1 Independently

```bash
# After Phase 2 (Foundational) is complete:

# Write and verify US1 tests fail
pytest tests/contract/test_scales.py::test_get_all_scales -v  # MUST FAIL initially
pytest tests/contract/test_scales.py::test_get_scale_by_id -v  # MUST FAIL initially
pytest tests/integration/test_scales_reload.py -v  # MUST FAIL initially

# Implement US1 (T011-T015)
# Code: services/scales.py, services/scales_router.py

# Verify US1 tests pass
pytest tests/contract/test_scales.py -v  # ALL PASS
pytest tests/integration/test_scales_reload.py -v  # ALL PASS

# AT THIS POINT: User Story 1 is COMPLETE and independently deployable
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

Recommended for initial delivery:

1. Complete Phase 1: Setup ✅
2. Complete Phase 2: Foundational ✅
3. Complete Phase 3: User Story 1 ✅
4. **STOP and VALIDATE**: Run all US1 tests, ensure independent
5. **DEPLOY**: Scales load from JSON, basic API works

### Incremental Delivery

Add value with each story:

1. Setup + Foundational → Foundation ready ✅
2. Add US1 → Test independently ✅ → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Deploy/Demo (Tabulator feature)
4. Add US3 → Test independently → Deploy/Demo (Full validation)

### Team Parallel Strategy

With multiple developers (after Foundational is done):

- Developer A: US1 (JSON loading)
- Developer B: US2 (Tabulator encoding) - can start immediately after foundational
- Developer C: US3 (Geometry validation) - can start immediately after foundational
- All three stories integrate cleanly (no conflicts)

---

## Task Checklist Format Verification

All tasks follow strict format:
- ✅ Checkbox: `- [ ]`
- ✅ Task ID: T001, T002, etc.
- ✅ [P] parallelization marker: Present where applicable
- ✅ [Story] label: US1, US2, US3 for story-specific tasks
- ✅ File paths: Exact locations for all code changes

---

## Notes

- **TDD Mandatory**: Write tests first per Constitution Principle II
- **[P] tasks**: Different files, no blocking dependencies
- **[Story] label**: Maps task to user story for traceability
- **Independent Testing**: Each story should be completable and testable standalone
- **Stop at checkpoints**: Validate each story independently before moving forward
- **Avoid cross-story blocking**: Stories should integrate cleanly without dependencies
- **Configuration**: All 15+ scales from scales.json are available from startup
