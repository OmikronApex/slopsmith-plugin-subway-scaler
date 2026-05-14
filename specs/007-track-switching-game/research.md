# Research: Track-Switching Game Rework

**Created**: 2026-05-14  
**Feature**: [spec.md](spec.md)  
**Status**: Research Complete

---

## 1. Existing Game Architecture

### Decision
Adopt Three.js 3D rendering pattern with existing CartRenderer and CartMovement architecture. Extend current game_router with new endpoints. Reuse SpeedService and NoteService for difficulty and input handling.

### Rationale
- Existing CartRenderer (CartRenderer.js) already handles 3D cart visualization with Three.js
- Current track/lane system (laneX from grid.js) maps frets to 3D positions
- SpeedService incrementally increases speed multiplier on correct note
- NoteService manages note sequences
- Minimal dependency injection needed; clear separation between rendering and game logic

### Alternatives Considered
- **DOM/Canvas instead of Three.js**: Rejected. Three.js already integrated; would require migration effort for same performance outcome.
- **WebSocket for real-time updates**: Rejected. Current polling pattern in frontend works; not bottleneck for single-player game.
- **State management library**: Rejected. Run state machine in runState.js already proven pattern; adding library adds complexity.

---

## 2. Note Detection Integration

### Decision
Reuse existing note_service.NoteService for sequence tracking. Extend play_note endpoint to handle track-switching logic. Note detection (pitch-to-MIDI conversion) already handled by frontend Yin detection (yin.js).

### Rationale
- Frontend Yin algorithm (yin.js) converts audio → MIDI note in real-time
- NoteService tracks "expected next note" in sequence
- Note play endpoint at `/game/notes/{note_id}/played` already exists
- Can extend with `fret`/`string` parameters to map MIDI → expected track

### Alternatives Considered
- **Custom pitch detection**: Rejected. Yin algorithm already integrated and tested.
- **Server-side note detection**: Rejected. Latency would violate 100ms response time target. Keep detection on frontend.
- **Scale validation on client**: Partially applied. Server validates sequence; client validates input timing.

---

## 3. Scale Definition Format

### Decision
Leverage output of feature 004-scale-json-tabulator. Scales stored as JSON with ascending/descending note lists. Modify ScaleManager to alternate between ascending and descending when querying next note.

### Rationale
- 004-scale-json-tabulator already migrates scale definitions to JSON format
- Spec expects "ascending then descending loop" behavior
- ScaleManager (scales.py/scales.js) already handles scale queries
- JSON structure supports array slicing for ascending/descending iteration

### Alternatives Considered
- **Hardcoded scale arrays**: Rejected. JSON migration reduces duplication and enables user configuration.
- **Note stream generator**: Considered. Implementation detail; JSON + ScaleManager sufficient for MVP.

---

## 4. Frontend Rendering Strategy

### Decision
Use Three.js with HTML5 canvas for 60 fps. Render:
- Cart waves as 3D boxes (existing CartRenderer)
- Safe zone tracks as colored planes sliding down (new SafeZoneRenderer)
- Player character as lane highlight on current track
- HUD: score, difficulty level, next note indicator

### Rationale
- Three.js proven to handle cart + track rendering at target FPS
- Canvas leverages GPU acceleration for animation
- Existing CartMovement (CartMovement.js) updates cart positions each frame
- SafeZoneRenderer can follow same pattern: create mesh, animate position, remove when passed player

### Alternatives Considered
- **WebGL directly**: Rejected. Three.js abstraction already in place; no benefit to raw WebGL.
- **2D Canvas with transforms**: Rejected. Three.js provides perspective and cleaner layering for overlapping elements.

---

## 5. FastAPI Game Session Pattern

### Decision
Use in-memory game state with session_id UUID. Endpoints return full GameState snapshot (cart positions, current track, score, difficulty). Frontend polls periodically (100-200ms) for state updates.

### Rationale
- Single-player game; no persistence across sessions required
- Polling at 100-200ms interval acceptable for single player (not MMO)
- Avoids WebSocket complexity; reduces infrastructure burden
- Current endpoint `/game/game-state` already returns snapshot format

### Alternatives Considered
- **WebSocket real-time push**: Rejected. Polling simpler for MVP; can upgrade if multi-player added.
- **Database persistence**: Rejected. Session state is temporary; in-memory sufficient.
- **Message queue (e.g., RabbitMQ)**: Rejected. Overkill for single-player game.

---

## Key Dependencies Confirmed

| Dependency | Purpose | Status |
|-----------|---------|--------|
| FastAPI | Backend framework | ✓ Existing |
| Three.js | 3D rendering | ✓ Existing (vendor/three.module.js) |
| Yin (yin.js) | Pitch detection | ✓ Existing |
| SpeedService | Difficulty scaling | ✓ Existing (extend) |
| ScaleManager | Scale iteration | ✓ Existing (extend) |
| NoteService | Sequence tracking | ✓ Existing (extend) |

---

## Implementation Constraints & Notes

1. **Input latency target**: <100ms from note played to character move visible
   - Frontend detection + rendering: ~16ms (60 fps)
   - API call + response: ~50-70ms typical
   - Leaves ~30ms buffer

2. **Difficulty scaling**: Current SpeedService increments multiplier linearly. Need to verify cart speed formula and ensure 60 fps maintained at max difficulty.

3. **Safe zone timing**: Time window for note input must shrink as difficulty increases (proportional to cart speed). Current structure supports this via `timePerNoteMs` in Run state machine.

4. **Scale loop edge case**: When ascending finishes, must transition to descending without duplicate root note. Verify with ScaleManager.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 60 fps not maintained at high difficulty | Game unplayable | Profile rendering; optimize cart count/mesh pooling if needed |
| Polling latency noticeable | Input feels unresponsive | Increase poll frequency to 100ms; monitor network latency |
| Scale ascending/descending breaks | Wrong notes appear | Unit test ScaleManager loop behavior; write contract test before implementation |
| Character movement doesn't align with cart positions | Visual jank | Ensure coordinate systems (laneX mapping) consistent between carts and safe zones |

