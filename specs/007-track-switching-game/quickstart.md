# Quickstart: Track-Switching Game Development

**Feature**: [spec.md](spec.md)  
**Data Model**: [data-model.md](data-model.md)  
**API Contracts**: [contracts/](contracts/)

---

## System Architecture

### Frontend (JavaScript/HTML5/Three.js)

```
static/game/
├── main.js                 # Game loop entry point
├── game-client.js          # API communication
├── runState.js             # Game state machine (Run class)
├── scene.js                # Three.js scene setup
├── carts/
│   ├── CartRenderer.js     # Render cart meshes
│   └── CartMovement.js     # Update cart positions
├── ui/
│   └── SafeZoneRenderer.js # [NEW] Render safe zone tracks
└── fretboard.js            # Note detection integration
```

### Backend (Python/FastAPI)

```
services/
├── game_router.py          # [EXTEND] Game endpoints
├── game_engine.py          # [NEW] GameSession + state machine
├── difficulty_manager.py   # [NEW] Speed scaling logic
├── scale_manager.py        # [EXTEND] Scale iteration (asc/desc)
├── speed_service.py        # [REUSE] Difficulty multiplier
├── note_service.py         # [REUSE] Sequence tracking
└── schemas.py              # [EXTEND] Pydantic models
```

---

## Key Implementation Points

### 1. Game Session Initialization

Backend (`game_engine.py`):

```python
class GameSession:
    def __init__(self, session_id, scale_id, difficulty="easy"):
        self.session_id = session_id
        self.status = "running"
        self.scale_progression = ScaleProgression(scale_id)
        self.difficulty_level = 0
        self.speed_multiplier = 1.0
        self.current_track = random.choice([0,1,2,3,4,5]) 
        self.current_track != self.scale_progression.root_fret
        self.score = 0
        
    def start(self):
        # Spawn first cart wave + safe zone
        self.next_wave = CartWave(
            safe_track=self.scale_progression.root_fret,
            speed=self.calculate_speed()
        )
        self.next_safe_zone = SafeZoneTrack(
            track=self.next_wave.safe_track,
            color="#FF0000"  # Red for root note
        )
```

Frontend (`main.js`):

```javascript
const gameLoop = async () => {
  // Poll game state every 150ms
  const state = await fetch(`/api/game/${sessionId}`).then(r => r.json());
  
  // Update cart positions
  updateCartPositions(state.active_waves);
  
  // Render safe zone highlight
  renderSafeZone(state.active_safe_zone);
  
  // Check for collision: if safe_zone.z >= 0 and wrong track → collision
  if (checkCollision(state)) {
    endGame(state.score);
  }
  
  requestAnimationFrame(gameLoop);
};
```

### 2. Note Input Flow

Frontend (`fretboard.js` detects note):

```javascript
onNotePlayed = async (midiNote, timestampMs) => {
  const response = await fetch(
    `/api/game/${sessionId}/play-note`,
    {
      method: 'POST',
      body: JSON.stringify({ midi: midiNote, timestamp_ms: timestampMs })
    }
  );
  
  const result = await response.json();
  if (result.success && result.note_correct) {
    // Update UI with new score, difficulty, next note
    moveCharacterToTrack(result.character_moved_to_track);
  } else if (!result.note_correct) {
    // Game over
    displayGameOverScreen(result.game_state.score);
  }
};
```

Backend (`game_router.py` handles input):

```python
@router.post("/game/{session_id}/play-note")
async def play_note(session_id: str, payload: dict):
    session = get_session(session_id)
    if not session:
        return {"error": "session_not_found"}
    
    detected_midi = payload.get("midi")
    expected_note = session.scale_progression.current_note()
    
    # Validation
    if not validate_timing(payload.get("timestamp_ms")):
        session.status = "failed"
        return {"success": True, "note_correct": False, "reason": "deadline_missed"}
    
    if validate_note(detected_midi, expected_note):
        # Correct!
        session.score += 1
        session.difficulty_level += 1
        session.speed_multiplier = 1.0 + (0.1 * session.difficulty_level)
        
        next_note = session.scale_progression.next_note()
        next_wave = CartWave(safe_track=next_note.fret, speed=calculate_speed(...))
        
        return {
            "success": True,
            "note_correct": True,
            "current_score": session.score,
            "next_note": next_note.to_dict(),
            "next_wave": next_wave.to_dict(),
            "game_state": session.to_dict()
        }
    else:
        session.status = "failed"
        return {"success": True, "note_correct": False, "reason": "wrong_note"}
```

### 3. Safe Zone Rendering

New file: `static/game/ui/SafeZoneRenderer.js`

```javascript
export class SafeZoneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.activeMesh = null;
  }
  
  createSafeZone(safeZone) {
    const geometry = new THREE.PlaneGeometry(1.0, 3.0);  // Width=1 track, Length=3
    const material = new THREE.MeshStandardMaterial({
      color: safeZone.color,
      emissive: parseInt(safeZone.color),
      emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = safeZone.z_position;
    mesh.position.x = laneX(safeZone.track);
    mesh.position.y = -0.1;  // Slightly below cart level
    this.scene.add(mesh);
    return mesh;
  }
  
  updatePosition(mesh, zPosition) {
    if (mesh) mesh.position.z = zPosition;
  }
  
  removeMesh(mesh) {
    if (mesh) this.scene.remove(mesh);
  }
}
```

### 4. Scale Progression (Ascending/Descending)

Backend (`scale_manager.py`):

```python
class ScaleProgression:
    def __init__(self, scale_id):
        self.scale = load_scale(scale_id)  # e.g., [60, 62, 64, 65, 67, 69, 71, 72]
        self.current_index = 0
        self.is_ascending = True
    
    def next_note(self):
        if self.is_ascending:
            if self.current_index >= len(self.scale) - 1:
                # Switch to descending, skip duplicate root
                self.is_ascending = False
                self.current_index = len(self.scale) - 2
            else:
                self.current_index += 1
        else:
            if self.current_index <= 0:
                # Switch to ascending, skip duplicate root
                self.is_ascending = True
                self.current_index = 1
            else:
                self.current_index -= 1
        
        return self.scale[self.current_index]
    
    def current_note(self):
        return self.scale[self.current_index]
```

---

## Testing Strategy (TDD)

### Contract Tests (tests/contract/)

Test API request/response contracts:

```python
# test_game_start.py
def test_game_start_creates_session():
    response = client.post("/api/game/start", json={"scale_id": "major"})
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "initial_track" in data
    assert data["initial_track"] != data["root_note"]["string"]  # Not root

# test_game_play_note.py
def test_correct_note_increments_score():
    session = start_game("major")
    response = client.post(
        f"/api/game/{session['session_id']}/play-note",
        json={"midi": 60, "timestamp_ms": 500}  # C4 (root)
    )
    assert response.json()["success"] == True
    assert response.json()["current_score"] == 1
    assert response.json()["difficulty_level"] == 1
```

### Integration Tests (tests/integration/)

Test end-to-end game rounds:

```python
# test_game_flow.py
def test_complete_game_round():
    # Start game with "major" scale: C D E F G A B C
    session = start_game("major")
    
    # Play C (correct)
    r1 = play_note(session["session_id"], midi=60)
    assert r1["note_correct"] == True
    assert r1["next_note"]["midi"] == 62  # D
    
    # Play D (correct)
    r2 = play_note(session["session_id"], midi=62)
    assert r2["note_correct"] == True
    assert r2["next_note"]["midi"] == 64  # E
    
    # Play E (correct) - continues...
```

### Frontend Unit Tests (tests/unit/js/)

Test SafeZoneRenderer, note detection integration:

```javascript
// test_safe_zone_renderer.js
describe('SafeZoneRenderer', () => {
  it('creates mesh at correct position', () => {
    const renderer = new SafeZoneRenderer(scene);
    const zone = { track: 2, z_position: -8.5, color: "#FF0000" };
    const mesh = renderer.createSafeZone(zone);
    
    expect(mesh.position.z).toBe(-8.5);
    expect(mesh.position.x).toBe(laneX(2));
  });
});
```

---

## Development Checklist

### Phase 1: Backend Foundation
- [ ] Create GameEngine class with state machine
- [ ] Extend game_router with `/start`, `/play-note`, GET endpoints
- [ ] Implement DifficultyManager (speed scaling)
- [ ] Extend ScaleManager for ascending/descending iteration
- [ ] Write contract tests (MUST BE FAILING FIRST - TDD)

### Phase 2: Frontend Foundation  
- [ ] Create SafeZoneRenderer class
- [ ] Integrate safe zone rendering into game loop
- [ ] Implement game state polling (100-200ms)
- [ ] Connect note input to `/play-note` endpoint

### Phase 3: Integration & Polish
- [ ] End-to-end game flow testing
- [ ] Verify 60 fps performance
- [ ] Tune difficulty scaling curve
- [ ] Visual polish (colors, animations)

### Phase 4: Edge Cases
- [ ] Handle scale loop (ascending → descending transition)
- [ ] Test collision detection edge cases
- [ ] Network resilience (reconnect on dropped poll)
- [ ] Verify 100ms input response time

---

## API Endpoint Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/plugins/subway_scaler/game/start` | Initialize game session |
| POST | `/api/plugins/subway_scaler/game/{id}/play-note` | Submit note input |
| GET | `/api/plugins/subway_scaler/game/{id}` | Poll game state |

See [contracts/](contracts/) for detailed request/response specifications.

---

## Performance Targets

- **Frame rate**: 60 fps
- **Input latency**: <100ms from note played to character visible movement
- **Poll frequency**: 100-200ms (non-blocking)
- **Max difficulty**: Speed multiplier caps at 2.5x for playability

---

## Debugging Tips

### Check Current Game State
```javascript
// In browser console during game
fetch(`/api/plugins/subway_scaler/game/${sessionId}`)
  .then(r => r.json())
  .then(console.log)
```

### Verify Cart Positions
```javascript
// CartRenderer logs positions each frame
console.log(activeWaves.map(w => ({ wave_id: w.wave_id, z: w.z_position })))
```

### Profile Frontend Performance
```javascript
// Measure frame time
let frameCount = 0;
let frameStart = performance.now();
// In gameLoop:
frameCount++;
if (performance.now() - frameStart >= 1000) {
  console.log(`FPS: ${frameCount}`);
  frameCount = 0;
  frameStart = performance.now();
}
```

