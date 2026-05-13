# Implementation Plan: Scale JSON Tabulator

**Branch**: `004-scale-json-tabulator` | **Date**: 2026-05-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-scale-json-tabulator/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Migrate scale definitions from hardcoded Python list to external JSON file. Implement tabulator that encodes scales as multi-string fret patterns respecting standard guitar tuning and geometry. Ensures scales are playable across multiple strings rather than single-string linear patterns.

## Technical Context

**Language/Version**: Python 3.10+  
**Primary Dependencies**: FastAPI, Pydantic  
**Storage**: JSON file (scales.json in plugin directory)  
**Testing**: pytest, contract + integration tests  
**Target Platform**: Server (Slopsmith plugin)
**Project Type**: Plugin/library  
**Performance Goals**: Scale loading at startup (no real-time constraint)  
**Constraints**: Keep plugin lightweight, fast schema parsing  
**Scale/Scope**: ~15 scale definitions, 6-string guitar (standard tuning)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Modular Design**: Feature separates scale definitions (JSON) from loading logic (service) from tabulator encoding. No FastAPI route changes required yet.

✅ **Test-Driven Development**: Contract tests already exist for scales API. New tests required for: JSON loading, tabulator encoding, geometry validation.

✅ **Independent User Stories**: Three P1/P2 stories that can be developed sequentially. Each story delivers independent value (JSON loading → tabulator → validation).

✅ **Consistent API Design**: Routes remain under `/api/plugins/subway_scaler/`. No API contract changes for v1.

✅ **Performance and Simplicity**: JSON is lightweight, no new dependencies, no database changes.

## Project Structure

### Documentation (this feature)

```text
specs/004-scale-json-tabulator/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

**Existing structure** (Slopsmith plugin architecture):
```text
.
├── routes.py                          # FastAPI setup, routers
├── services/
│   ├── scales.py                      # Scale catalog (CHANGE: migrate to JSON)
│   ├── scales_router.py               # FastAPI endpoints
│   ├── instruments.py                 # Instrument definitions
│   ├── instruments_router.py
│   ├── settings.py
│   ├── settings_router.py
│   ├── schemas.py                     # Pydantic models
│   └── __init__.py
├── tests/
│   ├── contract/                      # API contract tests
│   │   ├── test_scales.py
│   │   └── [others]
│   ├── integration/                   # Flow tests
│   │   └── test_settings_flow.py
│   └── conftest.py
├── static/                            # Frontend assets
├── scales.json                        # NEW: External scale definitions
└── [config, etc.]
```

**Structure Decision**: Single-project plugin architecture. Scale JSON loading logic adds to services/scales.py. Tabulator encoding becomes new module services/tabulator.py. Contract tests expand to cover JSON loading and tabulator logic.

## Complexity Tracking

> **No Constitution violations.**
