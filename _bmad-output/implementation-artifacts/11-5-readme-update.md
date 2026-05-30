# Story 11.5: README Update for v1.0

Status: ready-for-dev

## Story

As a new user or contributor,
I want the README to accurately describe Subway Scaler v1.0,
so that I can understand what the game is, how to set it up, and how to play it without reading outdated or missing information.

## Acceptance Criteria

1. README describes Subway Scaler as a guitar/bass scale trainer Slopsmith plugin with Subway Surfers-style gameplay
2. README includes setup instructions covering both Slopsmith-integrated (Docker) and standalone development modes
3. README describes the controls: how to use the setup screen, what happens when you play a note, how to avoid carts
4. README lists all supported instruments: 4-string bass, 5-string bass, 6-string guitar, 7-string guitar, 8-string guitar, each with its standard tuning
5. README describes the string colour system (Rocksmith convention) so players can read the track lanes
6. README mentions the variant switching mechanic at a high level
7. README contains no references to unimplemented features, placeholder text, broken links, or TODO markers
8. "How to Play" section is accurate for the currently implemented game flow: setup screen → pick settings → click START → play notes → avoid carts

## Tasks / Subtasks

- [ ] Rewrite `README.md` with accurate v1.0 content (all ACs)
  - [ ] Project overview and what the game is (AC: 1)
  - [ ] Prerequisites section (Python 3.12+, Node.js, Slopsmith) (AC: 2)
  - [ ] Installation and running (Docker / native dev) (AC: 2)
  - [ ] How to Play section (AC: 3, 8)
  - [ ] Instrument support table (AC: 4)
  - [ ] String colour reference (AC: 5)
  - [ ] Variant switching paragraph (AC: 6)
  - [ ] Known limitations / out of scope section (AC: 7)
  - [ ] Testing section (existing commands are correct — keep them)

## Dev Notes

### Current README state

The current `README.md` (6 sections, ~30 lines) is a stub. It is factually mostly correct but extremely terse and missing key player-facing information. The stack section is accurate.

### Suggested structure for the new README

```markdown
# Subway Scaler

A guitar/bass scale trainer for [Slopsmith](https://github.com/slopsmith/slopsmith).
Play correct scale notes to keep your character running and avoid the carts — Subway Surfers style.

## What It Is

[2-3 sentence description of gameplay loop]

## Prerequisites

- Python 3.12+
- Node.js 18+ (for JS tests)
- [Slopsmith](https://github.com/slopsmith/slopsmith) (Docker or native)

## Installation

[pip install + npm install commands]

## Running

### With Slopsmith (recommended)
[how to place the plugin in Slopsmith and navigate to it]

### Development (standalone)
[uvicorn command for local dev server]

## How to Play

1. Select your **scale** (Major, Minor, Pentatonic, etc.)
2. Choose your **instrument** and **number of strings**
3. Choose **difficulty** (Easy / Medium / Hard)
4. Click **START** — the root note is randomised to a fret 5–8
5. Play the note shown on the colour-coded track lane — your character moves to that lane
6. Avoid the carts by playing the correct notes in sequence
7. The game speeds up as you play correctly

### Variant switching
Every few octave loops, a parallel track appears offering a new root position.
Play the new root note during the window to switch positions (and reset speed).
Miss the window — the variant peels away and the game continues unchanged.

## Instruments

| Instrument | Strings | Standard Tuning |
|---|---|---|
| Guitar (6-string) | 6 | E2 A2 D3 G3 B3 E4 |
| Guitar (7-string) | 7 | B1 E2 A2 D3 G3 B3 E4 |
| Guitar (8-string) | 8 | F#1 B1 E2 A2 D3 G3 B3 E4 |
| Bass (4-string)   | 4 | E1 A1 D2 G2 |
| Bass (5-string)   | 5 | B0 E1 A1 D2 G2 |

## String Colours (Rocksmith convention)

| Track lane (low→high pitch) | Colour |
|---|---|
| Lowest string | Red |
| 2nd | Yellow |
| 3rd | Blue |
| 4th | Orange |
| 5th | Green |
| 6th | Purple |
| 7th | Magenta |
| 8th | Teal |

## Development

### Tests
[existing pytest and npm test commands]

### Project structure
[brief description of services/ backend, static/game/ frontend]

## Known Limitations / Out of Scope (v1.0)

- No sound effects
- No tutorial screen (first note is the tutorial)
- Screen reader support for gameplay canvas is not available (inherent to audio-driven play)
- Mobile / phone-width viewports are not supported
```

### What to keep from the current README

- The stack section facts are all correct — incorporate into Prerequisites/structure
- The `pip install` and `npm test` commands are correct — keep them

### What to remove

- The terse one-liner description "Guitar/Bass scale trainer. Subway Surfers style." becomes the expanded intro
- No placeholder text, no TODO markers
- Do not promise features not yet in the codebase

### Project Structure Notes

- `README.md` is at the project root — documentation only, no code changes
- This story has no dependencies on other Epic 11 stories; it can be completed independently

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-subway-scaler.md#2] — Feature list and descriptions
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Executive Summary] — String colour system table
- [Source: services/instruments.py] — Instrument IDs and tunings (accurate after Story 11-1)

## Dev Agent Record

### Agent Model Used

_tbd_

### Debug Log References

### Completion Notes List

### File List
