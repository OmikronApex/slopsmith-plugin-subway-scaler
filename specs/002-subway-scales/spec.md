# Feature Specification: Subway Scales

**Feature Branch**: `002-subway-scales`
**Created**: 2026-05-13
**Status**: Draft
**Input**: User description: "Build a Slopsmith plugin that teaches musical scales to the user and let's them practice in the form of a 3D game with real-time note detection via an audio stream using a YIN implementation for fast and reliable detection. The game should feature a character jumping between subway carts moving along tracks based on the player playing the right note. If the correct note is not played in time the carts fall off a cliff and the game ends in failure."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practice a Scale by Playing Notes in Time (Priority: P1)

A learner selects a musical scale (e.g., C major) and starts a practice run. A 3D scene shows their character standing on a subway cart moving along tracks toward a cliff edge. Ahead, additional carts approach from the side carrying the next notes of the scale in order. The player must play the next note of the scale on their instrument so the character jumps onto the corresponding incoming cart before their current cart reaches the cliff. Each correct note in time advances the run; missing a note (wrong note or no detection before the deadline) causes the carts to fall off the cliff and the run ends in failure.

**Why this priority**: This is the core gameplay loop and learning mechanic. Without it the plugin delivers no value. A working version of just this story constitutes a viable MVP.

**Independent Test**: Launch the plugin, pick a scale, plug in (or open) an audio input, and complete or fail a run by playing notes into the microphone. The game must respond in real time to pitch and visibly succeed or fail.

**Acceptance Scenarios**:

1. **Given** the player has selected C major and started a run, **When** the player plays the next correct note within the time window, **Then** the character jumps to the next cart and the run continues with the following note expected.
2. **Given** the current expected note is E4, **When** the player plays a different note (e.g., F4) before the deadline, **Then** no jump occurs and, if the deadline passes without a correct detection, the carts fall off the cliff and the run ends in failure.
3. **Given** a run is in progress, **When** the player plays the correct note slightly early or slightly late within the allowed window, **Then** the jump still succeeds.
4. **Given** the player completes every note of the selected scale, **When** the final note is detected in time, **Then** the run ends in a success state with the completed scale shown.

---

### User Story 2 - Choose and Configure a Scale to Practice (Priority: P2)

Before a run, the player picks which scale to practice from a menu (root note + scale type, e.g., A minor, G mixolydian, C major pentatonic). They can also set a difficulty that controls cart speed / time-per-note and the octave range of the scale.

**Why this priority**: Necessary for the plugin to actually *teach scales* (plural) rather than a single hardcoded one. Without this the learning value is limited, but P1 can ship and be demoed against a fixed default scale first.

**Independent Test**: Open the scale selection UI, pick a non-default scale and difficulty, start a run, and verify the expected note sequence and pacing match the selection.

**Acceptance Scenarios**:

1. **Given** the scale menu is open, **When** the player selects "A natural minor" at medium difficulty, **Then** the next run uses A, B, C, D, E, F, G, A as the expected sequence at the medium time-per-note.
2. **Given** a difficulty of "easy", **When** a run starts, **Then** the time window allowed to play each note is visibly longer than on "hard".

---

### User Story 3 - Configure Audio Input and Calibrate Detection (Priority: P3)

The player chooses which audio input device to use, sees a live tuner-style readout of the detected pitch, and can adjust input gain and tolerance (cents) so the game reliably recognizes their instrument before starting a run.

**Why this priority**: Improves reliability across instruments and rooms but is not strictly required for a first playable build — a sensible default device and tolerance can ship first.

**Independent Test**: Open the audio settings panel, switch input device, play a sustained note, and confirm the displayed pitch matches the played note within the configured tolerance.

**Acceptance Scenarios**:

1. **Given** multiple audio inputs are available, **When** the player selects a different input device, **Then** the live pitch readout switches to that device's signal without restarting the plugin.
2. **Given** the player plays a sustained A4 (440 Hz), **When** detection runs, **Then** the displayed note is "A4" and the cents offset is within the configured tolerance.

---

### Edge Cases

- Silence or background noise only: detector must not report a false note and trigger an unintended jump.
- Notes played in a different octave than expected: by default count as correct for the same pitch class; configurable strict-octave mode rejects them.
- Sustained correct note held across multiple expected notes: must only count once per expected note, not auto-advance the whole scale.
- Very short / staccato notes: must still be detected if their duration exceeds the minimum detection window.
- Pitch glides (slides into the note): the detector must wait for a stable pitch before scoring, so an in-glide wrong pitch does not fail the run.
- Player pauses or tabs away mid-run: the run should pause rather than instantly fail.
- No microphone permission granted or no input device present: the plugin must explain the problem and not start a run.
- Instrument is badly out of tune: detection may not match; the calibration / tolerance setting is the escape hatch.
- Extreme low or high notes outside the detector's reliable range: warn the player and refuse to start, rather than fail silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST present a selectable library of musical scales covering at least major, natural minor, and the modes of the major scale, across all twelve root notes.
- **FR-002**: The plugin MUST start a practice run that displays a 3D scene with the player's character on a moving subway cart and additional carts arriving in sequence representing upcoming notes.
- **FR-003**: The plugin MUST continuously capture audio from the player's selected input device while a run is active.
- **FR-004**: The plugin MUST detect the fundamental pitch of the incoming audio in real time using a YIN-based pitch detection algorithm.
- **FR-005**: The plugin MUST map each detected pitch to the nearest musical note (pitch class + octave) and reject detections whose confidence is below a configurable threshold.
- **FR-006**: The plugin MUST, for each expected note in the scale, accept a correct detection within a bounded time window and trigger the character to jump to the next cart.
- **FR-007**: The plugin MUST end the run in failure, with a visible "carts falling off the cliff" outcome, when the time window for the current expected note expires without a correct detection.
- **FR-008**: The plugin MUST end the run in success when every expected note of the selected scale has been played in time.
- **FR-009**: The plugin MUST provide visible feedback during a run for: the current expected note, time remaining for that note, and whether the most recent detection was accepted or rejected.
- **FR-010**: The plugin MUST allow the player to choose a difficulty level that controls cart speed and the time window allowed per note.
- **FR-011**: The plugin MUST allow the player to choose the audio input device when more than one is available, and to see a live pitch readout for calibration.
- **FR-012**: The plugin MUST handle the case where audio capture is unavailable (no device, permission denied, device disconnected mid-run) by surfacing a clear error and preventing or safely ending the run.
- **FR-013**: The plugin MUST keep end-to-end latency from a played note to the resulting on-screen jump low enough that timing feels responsive to the player (see Success Criteria).
- **FR-014**: The plugin MUST persist the player's last-used scale, difficulty, and audio input selection between sessions.
- **FR-015**: The plugin MUST allow the player to pause and resume a run, and to abandon a run and return to the scale menu, without crashing or leaving the audio stream open.
- **FR-016**: By default the plugin MUST treat any octave of the correct pitch class as a correct answer; it MUST also offer a strict-octave mode that requires the exact octave shown on the incoming cart.

### Key Entities

- **Scale**: A named musical scale defined by a root note and an ordered set of intervals; expands at runtime into a sequence of expected notes for a chosen octave range.
- **Note**: A pitch class plus octave (e.g., E4), used both as an expected target and as the result of a detection.
- **Run**: A single practice attempt; holds the chosen scale, difficulty, current position in the note sequence, time remaining for the current note, and final outcome (success / failure / abandoned).
- **PitchDetection**: A real-time estimate of fundamental frequency with an associated confidence value, produced from a window of captured audio.
- **AudioInput**: The selected capture device and its configuration (sample rate, gain, tolerance in cents).
- **GameWorld**: The 3D scene state — track, current cart, queued upcoming carts, character position, and the cliff edge — driven by the Run's progress.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the moment a correct note's pitch becomes stable in the audio stream to the moment the character visibly begins its jump, the median delay is under 100 ms and the 95th percentile is under 150 ms.
- **SC-002**: For sustained, in-tune notes played on a typical acoustic or electric instrument in a quiet room, the detector identifies the correct pitch class on at least 95% of attempts and produces no false note on silence.
- **SC-003**: A new player can pick a scale, start a run, and understand from on-screen cues alone what note to play next within 30 seconds of opening the plugin, without reading external documentation.
- **SC-004**: At least 70% of players who complete one practice run choose to start another within the same session, indicating the loop is engaging enough to support repeated practice.
- **SC-005**: The plugin sustains a smooth interactive frame rate on the project's target hardware throughout a full run, with no visible stutter caused by audio analysis.
- **SC-006**: After three runs of the same scale, players can play that scale ascending without failure on the default difficulty at least 80% of the time, demonstrating measurable practice value.

## Assumptions

- The host application (Slopsmith) provides a plugin interface capable of rendering a real-time 3D scene, capturing audio input, and running per-frame logic; this spec does not redefine that host capability.
- The player has a working audio input (built-in mic, audio interface, or virtual input) and an acoustic or electric instrument capable of producing single sustained pitches. Polyphonic input (chords) is out of scope for v1.
- Pitch detection targets the typical instrument range roughly C2–C7; notes outside that range are not guaranteed to be detected reliably.
- "Scales" in v1 means single-octave ascending sequences by default, with optional extension to two octaves and optional descending pass; exotic / microtonal scales are out of scope.
- Visual style, character art, and track aesthetics follow Slopsmith's existing conventions and are not specified in detail here.
- The plugin runs locally; no network connectivity, accounts, leaderboards, or telemetry are required for v1.
- The standard 12-tone equal temperament tuning with A4 = 440 Hz is used; alternate tunings are out of scope for v1.
