# Feature Specification: Track-Switching Game Rework

**Feature Branch**: `007-track-switching-game`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: Rework game mechanic from character jumping between subway carts to character avoiding carts by switching tracks based on fret input.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Game with Initial Track Placement (Priority: P1)

Player starts a game session and is automatically positioned on a random track (excluding the root note track). This establishes the initial state for the first challenge.

**Why this priority**: Essential foundation. Game cannot progress without initial state. MVP-complete on its own (player sees start screen with character position).

**Independent Test**: Can be tested by starting game and verifying character appears on a non-root track. Delivers initial game state ready for input.

**Acceptance Scenarios**:

1. **Given** game is launched, **When** game initializes, **Then** character is placed on a random track that is NOT the root note track
2. **Given** character is placed, **When** first cart wave approaches, **Then** only the player's current track is empty (safe)
3. **Given** first cart wave passes, **When** safe zone highlight appears, **Then** one track is highlighted in red indicating the root note fret

---

### User Story 2 - Play Note and Move to Safe Zone (Priority: P1)

Player receives visual feedback (colored track) showing which fret to play, plays the correct note on their instrument, and character moves to the safe zone before the next cart wave arrives.

**Why this priority**: Core gameplay loop. Must work flawlessly. MVP-complete (player plays note → character moves → survives).

**Independent Test**: Can be tested by: (1) seeing red track highlight, (2) playing correct note on instrument, (3) character moving to that track, (4) next cart wave passing without collision. Delivers one complete success cycle.

**Acceptance Scenarios**:

1. **Given** a cart wave has passed the player, **When** the next safe track is highlighted, **Then** the track color corresponds to the string and the fret number of the next note in the scale
2. **Given** the safe track is highlighted, **When** player plays the correct note within the time window, **Then** character instantly moves to the highlighted safe track
3. **Given** character has moved to the safe track, **When** the next cart wave arrives, **Then** character is in the empty (safe) track and is not hit
4. **Given** player plays the correct note, **When** character moves to safe track, **Then** speed of next cart wave increases (difficulty escalates)

---

### User Story 3 - Survive Multiple Rounds and Scale Loop (Priority: P1)

Player continues through ascending then descending scale repetitions, speed increases with each correct note, and player must maintain accuracy through the challenge.

**Why this priority**: Main gameplay experience. Defines session length and progression. MVP-complete (player plays 5-10 notes successfully then fails, establishing session flow).

**Independent Test**: Can be tested by playing through multiple rounds (ascending scale, then descending) and verifying: speed increases, scale loops correctly, and game continues until failure. Delivers complete playable session.

**Acceptance Scenarios**:

1. **Given** player completes the ascending scale, **When** all root-note-fret notes are played, **Then** the scale resets to ascending again (loops)
2. **Given** each correct note is played, **When** the next cart wave is generated, **Then** speed is faster than the previous wave
3. **Given** scale is selected, **When** game progresses, **Then** scale notes appear in sequence (ascending) followed by descending until player fails

---

### User Story 4 - Fail and End Game (Priority: P2)

Player fails to play the correct note in time, gets hit by a cart, and the game ends with a clear failure state.

**Why this priority**: Necessary for game loop closure but not required for MVP. Can be fully tested independently with a single failed input.

**Independent Test**: Can be tested by: (1) waiting for a note prompt, (2) NOT playing or playing wrong note, (3) cart hits player, (4) game displays failure. Delivers session termination and score/result display.

**Acceptance Scenarios**:

1. **Given** a safe track is highlighted, **When** player does not play the correct note before next cart wave arrives, **Then** character is hit by a cart
2. **Given** character is hit by a cart, **When** collision occurs, **Then** game immediately ends
3. **Given** game ends, **When** failure occurs, **Then** final score or number of correct notes is displayed

---

### Edge Cases

- What happens if player plays note while cart wave is passing (no safe zone highlighted yet)?
- What happens if player plays a note that is out of sequence (wrong note for current position)?
- What happens when difficulty becomes very high (extremely fast carts)? Can player physically play fast enough?
- What happens if player's track position is the same as the next safe track (no movement needed)? Does character still need input or auto-advance?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Game MUST display subway cart rows coming down the screen with all tracks occupied except one (the safe track)
- **FR-002**: Game MUST highlight one track in red after each cart wave passes, indicating the safe zone for the next note
- **FR-003**: The highlighted track color MUST correspond to the string/fret of the next scale note to be played
- **FR-004**: Game MUST detect when player plays the correct note on their instrument within the time window before next cart wave
- **FR-005**: Character MUST move to the highlighted safe track immediately upon correct note input
- **FR-006**: Game MUST increase cart speed incrementally after each correct note played
- **FR-007**: Game MUST repeat the selected scale in ascending order, then descending order, looping until player fails
- **FR-008**: Game MUST end immediately when character is hit by a subway cart
- **FR-009**: Game MUST display final score (number of correct notes played) when game ends
- **FR-010**: Game MUST position player on a random track (excluding root note track) at game start
- **FR-011**: Game MUST ensure only the player's current track is empty when cart wave approaches
- **FR-012**: Game MUST provide time window for player to play next note before cart collision (based on current difficulty level)

### Key Entities

- **Subway Cart Wave**: Row of carts coming down the screen; all tracks occupied except safe track (one per wave)
- **Safe Zone Track**: Colored track highlight indicating where player must move for next note; appears after cart wave passes
- **Track**: One of N parallel lanes where player character can stand; corresponds to guitar string/fret
- **Player Character**: Entity positioned on current track; moves to safe zone after correct note input
- **Scale Progression**: Sequence of notes (ascending then descending) that determines which track is safe next
- **Difficulty Level**: Current speed of cart waves; increases after each correct note

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Player can complete at least 10 consecutive correct notes in a single session without collision (demonstrates core mechanic works)
- **SC-002**: Cart speed increases noticeably with each correct note (progressive difficulty is perceivable)
- **SC-003**: Player receives clear visual feedback on which track to move to (colored track highlight is visible and unambiguous)
- **SC-004**: Game responds to note input within 100ms (player feels responsive control)
- **SC-005**: Scale loop correctly repeats ascending then descending pattern without gaps or missing notes
- **SC-006**: Game displays final score at end of session (session closure is clear)

## Assumptions

- **Game uses existing guitar note input system**: The system to detect which fret/string is played already exists and can be reused; this feature only changes display and game logic
- **Color scheme defaults**: If string-to-color mapping is not specified, standard convention will be used (e.g., high E = red, B = orange, etc.); can be configurable later
- **Input timing window scales with difficulty**: As carts move faster, the input window for playing the next note automatically shrinks (proportional to cart speed)
- **Single player only**: Feature assumes one player at a time; multiplayer is out of scope for v1
- **Collision detection is straightforward**: Character in wrong track when cart arrives = collision; no partial/edge collision states
- **Mobile support is out of scope**: Feature targets desktop/web gameplay; mobile touch input for fretboard is not in scope for v1
