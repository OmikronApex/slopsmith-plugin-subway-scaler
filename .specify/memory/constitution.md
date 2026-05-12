<!--
Sync Impact Report:
- Version change: Initial -> 0.1.0
- List of modified principles:
  - Added I. Self-Hosted, Single-User, Docker-First
  - Added II. Vanilla Frontend — No Frameworks
  - Added III. Plugin Isolation via load_sibling
  - Added IV. Backwards-Compatible CDLC Library
  - Added V. Test-First Development (NON-NEGOTIABLE)
  - Added VI. Observability Over Chattiness
  - Added VII. Simplicity & Migration Awareness
- Added sections: Technology Stack, Development Workflow
- Removed sections: N/A
- Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ updated
  - .specify/templates/spec-template.md: ✅ updated
  - .specify/templates/tasks-template.md: ✅ updated
- Follow-up TODOs:
  - None
-->

# Slopsmith Plugin: Subway Scaler Constitution

## Core Principles

### I. Self-Hosted, Single-User, Docker-First
The application is designed to run in a private, self-hosted Docker container. It assumes a single user and minimizes external dependencies to ensure reliability and ease of deployment in home-server environments.
**Rationale**: Most Rocksmith users play in a private setting; self-hosting ensures they own their data and experience.

### II. Vanilla Frontend — No Frameworks
Frontend must use Vanilla JavaScript, Canvas 2D, and Tailwind CSS (via CDN). React, Vue, or other heavy frameworks are strictly prohibited.
**Rationale**: To ensure long-term maintainability and avoid the "framework fatigue" or breaking updates common in the modern JS ecosystem.

### III. Plugin Isolation via `load_sibling`
Plugins are discovered and loaded at startup. They must remain isolated from each other, communicating only through defined API boundaries and the `load_sibling` pattern.
**Rationale**: Prevents a single plugin failure from crashing the entire app and ensures a clean, modular architecture.

### IV. Backwards-Compatible CDLC Library
Metadata extraction and file handling must support both official Rocksmith DLC and community-created CDLC. Compatibility with older PSARC formats must be maintained.
**Rationale**: The core value of Slopsmith is its library; breaking support for any portion of the user's collection is unacceptable.

### V. Test-First Development (NON-NEGOTIABLE)
All functional changes MUST be preceded by automated tests. Tests are NOT optional. Use `pytest` for backend logic and `Playwright` for UI interactions.
**Rationale**: High reliability is required for a tool that handles large media collections and real-time visualization.

### VI. Observability Over Chattiness
Favor structured logging (JSON/Text) and comprehensive diagnostic bundles (`Settings -> Diagnostics`) over noisy, uninformative console output.
**Rationale**: Essential for troubleshooting in containerized environments where the maintainer is not the end-user.

### VII. Simplicity & Migration Awareness
Prioritize simple, readable code over clever abstractions (YAGNI). All schema changes or breaking updates must include an automated migration path.
**Rationale**: Ensures the project remains accessible to community contributors and stable for long-term use.

## Technology Stack
- **Backend**: Python 3.11+, FastAPI, SQLite.
- **Frontend**: Vanilla JS, HTML5 Canvas 2D, Tailwind CSS.
- **Media**: FFmpeg, vgmstream, FluidSynth, rubberband.
- **Containerization**: Docker, Docker Compose.
- **Workflow Tools**: RsCli (F#) for SNG compilation.

## Development Workflow
- **Specification-First**: Features must be specified in `.specify/` before implementation.
- **TDD Cycle**: Write failing test → Implement minimal code → Pass test → Refactor.
- **Plugin Pattern**: New features should be implemented as plugins whenever possible.
- **Code Review**: Verify compliance with the 7 Core Principles and check for generic agent-neutral guidance.

## Governance
This Constitution supersedes all other documentation and local development practices. Amendments require a formal update to this file and a semantic version bump. All Pull Requests must be reviewed for compliance with the Core Principles. Use `CLAUDE.md` for runtime development guidance but ensure all shared instructions remain generic.

**Version**: 0.1.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
