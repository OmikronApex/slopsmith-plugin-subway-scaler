---
project_name: slopsmith-plugin-subway-scaler
document: prd-subway-scaler.md
status: draft
created: 2026-05-20
---

# Decision Log

_Tracks decisions, trade-offs, and rationale for the PRD._

---

## Decisions

### DC-001: Feature Scope

**What:** Core gameplay loop only; no scale switching mid-run.

**Why:** Keep first PRD focused. Variant switching (FR-008) is "medium" priority but not MVP.

**When:** Discovery phase, when clarifying feature boundaries.

**References:** User stated "currently no new features planned, still setting up bmad_method."

---

### DC-002: Audio Detection Interface

**What:** YIN implementation with pluggable interface for future centralized solution.

**Why:** Slopsmith may offer centralized note detection; leave room for replacement.

**Alternatives Considered:**
- Lock into YIN only: Would prevent future migration
- No pluggable interface: Ties to single algorithm

**Decision:** Pluggable interface allows seamless migration when centralized solution available.

---

### DC-003: Open Source License

**What:** No monetization; MIT or similar license.

**Why:** User explicitly stated "open-source project," "no monetization planned."

**Alternatives Considered:**
- GPL license: Would prevent commercial use (may limit plugin integration)
- Apache 2.0: More permissive for commercial use

**Decision:** MIT license chosen for maximum compatibility with Slopsmith and other projects.

---

### DC-004: Variant Switching Frequency

**What:** Offer variants every 2 octave loops (or similar interval).

**Why:** Provides enough gameplay before interruption; aligns with "every octave loop" milestone.

**Rationale:** User mentioned variant scales offered at "regular interval."

**Open Question:** OQ-004: Should we measure session length and offer variants after X seconds instead?

---

### DC-005: Visual Fidelity Target

**What:** Retro/PlayStation 1 style visual (ultimate goal).

**Why:** Accessible aesthetic that fits minimalist Three.js implementation.

**Alternatives Considered:**
- Modern high-fidelity: Would require more art resources
- Abstract/flat design: Would not match "Subway Surfers" familiarity

**Decision:** Start simple, evolve toward PS1-style retro aesthetic.

---

### DC-006: Track/Lane Count

**What:** Dynamic lanes based on scale fret span, clamped 3-12.

**Why:** Matches fretboard geography while keeping UI clean.

**Formula:** `(max_fret - base_fret) + 1`, clamped to 3-12 lanes.

**Rationale:** Guitar scales typically span 4-5 frets; bass scales may span more.

---

### DC-007: Score System

**What:** Base 100 points × difficulty multiplier; no penalty for early/late hits (current).

**Why:** Encourages experimentation and skill building.

**Rationale:** Early penalty would discourage players; late penalty can be added later.

---

### DC-008: Performance Target

**What:** 60 FPS minimum; prune wave queue every frame (10s lookback).

**Why:** Maintains smooth gameplay; prevents frame drops as session progresses.

**Rationale:** Three.js performance degrades without pruning.

---

## Pending Decisions

| ID | Question | Options |
|----|-----------|--------|
| PDC-001 | Tutorial on first run? | Auto-tutorial vs. skip vs. tooltip-only |
| PDC-002 | Maximum cart speed cap? | 300px/sec, 500px/sec, no cap |
| PDC-003 | Sound effects? | None, basic SFX, full audio track |
| PDC-004 | Session end screen content? | Just score, score + stats, achievements |

---

## Open Questions

| ID | Question | Priority | Owner |
|----|-----------|--------|-----|
| OQ-001 | Minimum session length for "completion"? | Medium | Product |
| OQ-002 | Tutorial on first run? | Low | Product |
| OQ-003 | Maximum cart speed cap? | Medium | Technical |
| OQ-004 | Variant offer frequency? | Medium | Product |
| OQ-005 | Sound effects scope? | Low | Product |

---

*Last updated: 2026-05-20*
