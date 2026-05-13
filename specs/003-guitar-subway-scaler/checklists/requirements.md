# Specification Quality Checklist: Guitar Subway Scaler

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-13
**Last Updated**: 2026-05-13 (re-validated after camera-angle + scale-cart-filtering update)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- 2026-05-13 update v1: layout flipped to vertical. Lanes now represent frets (columns); strings now represent depth-stacked rows. FR-002 through FR-010 rewritten accordingly. SC-005 added to lock in "exactly one lane × one row at all times" invariant.
- 2026-05-13 update v2: camera fixed at 45° top-down (FR-002, SC-008). Carts no longer pile up — queued behind one another along each row (FR-005, SC-007). Scale-only cart filtering added: a cart exists at a cell iff its pitch is in the active scale (FR-006, FR-007, SC-006). New User Story 4 (P1) covers the filtering rule.
- 2026-05-13 update v4: rewrote spec around the **note-queue Subway-Surfer** model. Lanes now render only for frets used by the visible queue (FR-005). Rows now represent runs of consecutive same-string notes from the playing-order sequence (FR-006), not the instrument's strings. Camera explicitly does not move vertically (FR-011, SC-005). Char slides flat (no Y arc). v2's scale-only cell filtering (`scaleMap.js`) is no longer wired into the scene — it remains as a pure module for possible HUD use.
- 2026-05-13 update v5: drop v4 row grouping. **Exactly one cart per row** regardless of string continuity (FR-003, FR-004, SC-003). Cart body now coloured by the **Slopsmith / Rocksmith string palette** (Red/Yellow/Blue/Orange/Green/Purple) (FR-008). Roof is a standard dark gray for all carts (FR-009, SC-005). Tracks rendered only for frets present in the visible queue, ordered low→high left-to-right (FR-006, FR-007).
