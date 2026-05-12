<!--
### Sync Impact Report
- Version change: none -> 1.0.0
- List of modified principles: Initialized principles (Modular Design, TDD, Independent User Stories, Consistent API, Performance/Simplicity)
- Added sections: Technology Stack, Quality Gates
- Removed sections: None
- Templates requiring updates:
    - .specify/templates/plan-template.md (✅ updated)
    - .specify/templates/spec-template.md (✅ updated)
    - .specify/templates/tasks-template.md (✅ updated)
- Follow-up TODOs: None
-->

# Subway Scaler Constitution

## Core Principles

### I. Modular Design
The plugin must follow a modular architecture. Core logic should be separated from the FastAPI
routes and the frontend. This ensures testability and maintainability as the plugin grows.

### II. Test-Driven Development (NON-NEGOTIABLE)
TDD is mandatory. All new features and bug fixes must start with a reproduction test (contract or
integration) that fails. Implementation is only allowed once the test is approved and failing.

### III. Independent User Stories
Features must be broken down into independent user stories. Each story should be a vertical slice
of functionality that can be implemented, tested, and demonstrated on its own.

### IV. Consistent API Design
All API endpoints must reside under `/api/plugins/subway_scaler/`. JSON is the primary data
exchange format. Error responses must be structured and informative.

### V. Performance and Simplicity
The plugin should remain lightweight. Avoid unnecessary dependencies. Ensure fast response times
and efficient frontend rendering.

## Technology Stack

- **Backend**: Python 3.10+, FastAPI
- **Frontend**: HTML5, Tailwind CSS, JavaScript (Vanilla)
- **Plugin System**: Slopsmith Plugin Architecture

## Quality Gates

- All PRs must include tests covering the new functionality.
- Linting and formatting must pass.
- No remaining TODOs in the code unless tracked as issues.

## Governance

- The Constitution is the source of truth for all development practices.
- Amendments require a version bump and justification.
- Every task must be verified against these principles.

**Version**: 1.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
