---
project_name: slopsmith-plugin-subway-scaler
title: PRD - Subway Scaler
status: draft
created: 2026-05-20
updated: 2026-05-20
version: 0.1.0
author: Robin Kasparek
---

# Subway Scaler

An open-source, gameified guitar/bass scale trainer that combines Subway Surfers-style gameplay with music theory education.

---

## Essential Spine

### 1. Vision

#### 1.1 Product Purpose

Subway Scaler is a **guitar/bass scale trainer plugin** for Slopsmith that teaches players:
- Different musical scales and their finger patterns
- Neck shifting and position switching
- Pattern recognition through gameplay

#### 1.2 Core Value Proposition

- **Learn scales in context** — Practice theory while having fun
- **Visual pattern recognition** — See finger positions as 3D tracks
- **Progressive difficulty** — Adaptive challenge that scales with skill
- **Open-source** — Free for all guitar/bass players

#### 1.3 Target Users

**Primary:**
- Hobbyist guitarists and bassists (intermediate level)
- Players wanting to explore scale patterns
- Users practicing neck shifts and position changes

**Assumed Capabilities:**
- Can play guitar/bass with basic technique
- Owns compatible MIDI controller or uses Slopsmith's audio detection
- Has a web browser (Windows, Linux, macOS)

#### 1.4 Platform

**Deployment:**
- Slopsmith plugin for desktop (Docker & native)
- Web-based interface (no native app required)
- Browser support: Windows, Linux, macOS

**External Dependencies:**
- Avoid external dependencies (per Slopsmith plugin API)
- Audio detection via YIN implementation (pluggable interface)
- Three.js for 3D rendering

### 2. Features

#### 2.1 Core Gameplay Loop

| FR ID | Feature | Description | Priority |
|-------|---------|-------------|----------|
| FR-001 | Session Start | Player selects scale, root note, difficulty | High |
| FR-002 | Note Visualization | Frets appear as colored "safe zones" on tracks | High |
| FR-003 | Correct Note Detection | Audio input triggers character movement | High |
| FR-004 | Score Calculation | Points based on difficulty + timing | Medium |
| FR-005 | Difficulty Scaling | Speed and cart frequency increases with score | High |
| FR-006 | Collision Detection | Cart collision ends session with game over | High |
| FR-007 | Visual Feedback | Sparkle/glow effects on correct notes | Low |
| FR-008 | Variant Switching | Switch root note mid-session | Medium |

#### 2.2 Feature Descriptions

**FR-001: Session Start**
- Select scale from catalog (15 scales: major, minor, pentatonic, modes, etc.)
- Choose root note (MIDI 21-108)
- Select difficulty (Easy/Medium/Hard)
- Confirm instrument (guitar 6-string / bass 4-string)
- Session begins immediately on confirm

**FR-002: Note Visualization**
- 3D track system showing fret/string positions
- Track count = fret span of scale (clamped 3-12)
- Safe zone = distance between cart waves
- Color coding by string (string 1 = highest pitch)
- Fret position implied by track position

**FR-003: Correct Note Detection**
- Real-time audio input via YIN algorithm
- Tolerance: 50 cents (configurable)
- Confidence threshold: 0.8
- Stability frames: 3
- Character moves to matching track instantly

**FR-004: Score Calculation**
- Base points: 100 × difficulty multiplier
- Early hit: No penalty (generous timing window)
- Late hit: No penalty (currently no strict windows)
- Visual feedback: Sparkle/glow effect
- Safe zone fades after correct note

**FR-005: Difficulty Scaling**
- Base speed: Adjustable starting velocity
- Per-note increase: 5% speed multiplier
- Max speed: Configurable cap
- Cart frequency: `base_duration / multiplier`
- Spacing factor: 0.4 (carts closer together)

**FR-006: Collision Detection**
- Character collides with cart on wrong track
- "Run over" animation plays
- Session ends immediately
- Final score displayed
- Optional: Restart option

**FR-007: Visual Feedback**
- Correct note: Sparkle/glow animation
- Safe zone: Highlighted track segment
- Cart approach: Shadow/dim effect
- Session end: Confetti or particles
- Environment: Day/night cycles (future)

**FR-008: Variant Switching**
- Offered at regular intervals (e.g., every 2 octave loops)
- Variant options: +5 semitones (up), -2 semitones (down)
- Player selects target root note
- Character moves to new track set
- Requires fret shift (e.g., fret 5 → fret 3)
- Visual guide: Target track highlights

### 3. User Journeys

#### 3.1 First Session

**Act 1: Setup (30 seconds)**
1. Launch plugin
2. Select scale (e.g., C Major)
3. Choose root note (e.g., C3)
4. Select difficulty (Medium)
5. Session begins

**Act 2: Gameplay (2-5 minutes)**
1. Character runs on track
2. Safe zones appear in sequence
3. Player plays notes in time
4. Score increases, speed rises
5. Variant offer appears (optional)

**Act 3: Session End (10 seconds)**
1. Character collides with cart
2. "Game Over" animation
3. Final score displayed
4. Restart or quit option

#### 3.2 Variant Switch

**Flow:**
1. Variant timer reaches threshold
2. Variant tracks fade in (+5/-2 semitones)
3. Current root highlighted
4. Target root highlighted with guide
5. Player plays target root note
6. Tracks switch, session continues

### 4. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session completion rate | 80%+ | Runs ending on player quit vs. crash |
| Average session length | 3-5 minutes | Timestamp from start to end |
| High score threshold | Scale-dependent | Track percentile per scale |
| FPS stability | 60fps minimum | Monitor performance logs |
| User engagement | Repeat sessions | Plugin launch frequency |

### 5. Non-Functional Requirements

#### 5.1 Performance

**FR-011: 60 FPS Target**
- Render loop at 60fps minimum
- Prune wave queue every frame (10s lookback)
- Texture scrolling must not impact render time
- Variant switching: No frame drops

**FR-012: Memory Usage**
- Keep below 500MB RAM
- Prune old frames from scene graph
- Recycle particle effects

#### 5.2 Reliability

**FR-013: Error Recovery**
- Invalid note input: Log and ignore
- Audio device disconnect: Reconnect or show error
- Failed texture load: Use fallback or visible error
- Plugin crash: Restart game instance

**FR-014: Session State**
- Save session state to local storage
- Resume on reconnect
- Clear state on session end

#### 5.3 Accessibility

**FR-015: Audio Input Options**
- Support professional audio interfaces
- Support USB-MIDI controllers
- Support Slopsmith's centralized detection (when available)
- Configurable sensitivity settings

#### 5.4 Usability

**FR-016: Settings Persistence**
- Save last scale, root note, difficulty
- Save audio device preferences
- Reset to defaults option

### 6. Constraints

#### 6.1 Technical

**C-001: Slopsmith Compatibility**
- Follow Slopsmith plugin API
- No external dependencies
- Works with Docker and desktop versions

**C-002: Audio Detection**
- Use YIN implementation (pluggable)
- Leave interface for centralized solution
- Accept device IDs as Base64 strings

**C-003: Browser Support**
- Chrome, Firefox, Edge, Safari
- No WebGL fallback required
- Modern browsers only

#### 6.2 Product

**C-004: Open Source**
- Free, no monetization
- Community-driven development
- MIT or similar license

**C-005: Feature Scope**
- No scale switching mid-run (future)
- Focus on single-scale mastery
- Environment/themes: Future iterations

### 7. Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-001 | What's the minimum session length for "completion"? | Product | By next sprint |
| OQ-002 | Should we show tutorial on first run? | Product | By next sprint |
| OQ-003 | What's the maximum cart speed cap? | Product | Technical spec |
| OQ-004 | How often to offer variants? (Time vs. score) | Product | Technical spec |
| OQ-005 | Should we add sound effects for notes/collisions? | Product | Future backlog |

### 8. Assumptions

**[ASSUMPTION A-001]** Users have basic knowledge of fretboard geography (frets, strings, scale positions).

**[ASSUMPTION A-002]** MIDI note input is the primary interaction method; keyboard fallback not required.

**[ASSUMPTION A-003]** Users will engage with variant offers (at least 70% acceptance rate).

**[ASSUMPTION A-004]** Slopsmith's audio detection API will become available for plugins.

### 9. Notes for PM

**[NOTE FOR PM]** This is an open-source project; prioritize community feedback and feature requests from GitHub issues.

**[NOTE FOR PM]** The `001-background-scroll` task is legacy; ignore it. Focus on core gameplay loop first.

---

## Appendix A: Scale Catalog

The following scales are supported (from `scales.json`):

| ID | Name | Intervals |
|----|------|-----------|
| major | Major | 0, 2, 4, 5, 7, 9, 11, 12 |
| natural-minor | Natural Minor | 0, 2, 3, 5, 7, 8, 10, 12 |
| ionian | Ionian | 0, 2, 4, 5, 7, 9, 11, 12 |
| aeolian | Aeolian | 0, 2, 3, 5, 7, 8, 10, 12 |
| minor-pentatonic | Minor Pentatonic | 0, 3, 5, 7, 10, 12 |
| major-pentatonic | Major Pentatonic | 0, 2, 4, 7, 9, 12 |
| blues | Blues | 0, 3, 5, 6, 7, 10, 12 |
| dorian | Dorian | 0, 2, 3, 5, 7, 9, 10, 12 |
| phrygian | Phrygian | 0, 1, 3, 5, 7, 8, 10, 12 |
| lydian | Lydian | 0, 2, 4, 6, 7, 9, 11, 12 |
| mixolydian | Mixolydian | 0, 2, 4, 5, 7, 9, 10, 12 |
| locrian | Locrian | 0, 1, 3, 5, 6, 8, 10, 12 |
| harmonic-minor | Harmonic Minor | 0, 2, 3, 5, 7, 8, 11, 12 |
| melodic-minor | Melodic Minor | 0, 2, 3, 5, 7, 9, 11, 12 |
| chromatic | Chromatic | 0-12 (all semitones) |
| whole-tone | Whole Tone | 0, 2, 4, 6, 8, 10, 12 |

**Instruments:**
- `guitar-standard`: 6 strings, E2-E4 tuning, max 24 frets
- `bass-4-standard`: 4 strings, E1-A tuning, max 24 frets

---

*Generated by BMad PRD workflow. Next: `bmad-create-ux-design` or `bmad-create-architecture`.*
