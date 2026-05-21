# Story 3.7: Implement Visual Feedback on Correct Note

Status: review

**Epic:** 3 — Core Gameplay Loop
**Story ID:** 3.7
**Story Key:** 3-7-implement-visual-feedback-on-correct-note

---

## Story

As a player,
I want a sparkle/glow effect on the safe zone when I play a correct note,
so that I get immediate confirmation that the game heard my note.

---

## Acceptance Criteria

**AC-1 — Sparkle/glow effect:**
When `CartSystem.update()` marks a safe zone `cleared: true`, a sparkle/glow particle effect plays at the safe zone's Three.js world position for ~300ms.

**AC-2 — Safe zone fade:**
The safe zone geometry fades out over the same ~300ms period.

**AC-3 — Effect colour:**
The effect uses `STRING_COLORS[note.string]` from `tokens.js` as its base colour.

**AC-4 — Memory management:**
After the effect completes (~300ms), the effect object is disposed from the Three.js scene graph: `geometry.dispose()`, `material.dispose()`, `scene.remove(mesh)`. No memory leak.

**AC-5 — SceneManager owns the effect:**
The sparkle effect is created and managed by `SceneManager.js`. It does not write to `GameState`.

---

## Tasks / Subtasks

- [x] Task 1: Read existing code (AC: all)
  - [x] Read `static/game/SceneManager.js` — understand current Three.js scene setup
  - [x] Check `static/game/ui/tokens.js` — understand STRING_COLORS export
  - [x] Check if any existing particle/effect code exists in SceneManager
  - [x] Check if there is a `tests/unit/js/` test file for visual feedback — may not exist
- [x] Task 2: Implement sparkle/glow effect (AC: 1, 3)
  - [x] `SceneManager.showClearEffect(position, stringIndex)` — creates Three.js particle mesh
  - [x] Position: the world position of the cleared safe zone
  - [x] Colour: `STRING_COLORS[stringIndex]` hex integer
  - [x] Simple implementation: animated PointsMaterial or expanded sphere with MeshBasicMaterial
  - [x] Effect duration: ~300ms
- [x] Task 3: Fade safe zone geometry (AC: 2)
  - [x] When cart is cleared, animate safe zone mesh opacity from 1.0 to 0.0 over ~300ms
  - [x] Use `material.transparent = true; material.opacity -= dt/0.3` in render loop
  - [x] Or use setTimeout-based approach
- [x] Task 4: Dispose effect objects (AC: 4)
  - [x] After ~300ms: call `geometry.dispose()`, `material.dispose()`, `scene.remove(particleMesh)`
  - [x] Use a `_activeEffects` list in SceneManager; prune completed effects each frame
- [x] Task 5: Wire to CartSystem cleared event (AC: 5)
  - [x] In `SceneManager.render(gameState)`: detect newly cleared carts
  - [x] If `cart.cleared && !cart._effectPlayed`: call `SceneManager.showClearEffect()`, mark `cart._effectPlayed = true`
  - [x] SceneManager does NOT write to GameState (._effectPlayed on cart object is fine as a render flag)

---

## Dev Notes

### File locations

| File | Action |
|------|--------|
| `static/game/SceneManager.js` | MODIFY — add sparkle effect and safe zone fade |

No new test file required — visual effects are typically tested via integration or not unit-tested.

### Simple particle effect pattern

```js
static showClearEffect(position, stringIndex, scene) {
  const color = STRING_COLORS[stringIndex] || 0xFFFFFF;
  
  // Simple expanding ring (no external particle system needed)
  const geometry = new THREE.RingGeometry(0.1, 0.3, 16);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  scene.add(mesh);
  
  const startTime = performance.now();
  const duration = 300; // ms
  
  SceneManager._activeEffects.push({ mesh, material, geometry, startTime, duration });
}
```

### Update effects in render loop

```js
static _updateEffects(now) {
  SceneManager._activeEffects = SceneManager._activeEffects.filter(effect => {
    const elapsed = now - effect.startTime;
    const progress = elapsed / effect.duration;
    if (progress >= 1.0) {
      // Dispose
      effect.geometry.dispose();
      effect.material.dispose();
      SceneManager._scene.remove(effect.mesh);
      return false; // remove from list
    }
    // Animate
    effect.material.opacity = 1.0 - progress;
    effect.mesh.scale.setScalar(1.0 + progress * 2); // expand
    return true; // keep
  });
}
```

Call `SceneManager._updateEffects(performance.now())` inside `SceneManager.render()`.

### Detecting cleared carts

```js
// In SceneManager.render(gameState):
for (const cart of gameState.scene.carts) {
  if (cart.cleared && !cart._effectPlayed) {
    cart._effectPlayed = true;
    const pos = /* derive from cart.z and cart.lane */ new THREE.Vector3(laneX(cart.lane), 0, cart.z);
    SceneManager.showClearEffect(pos, /* string index from track */ 1);
  }
}
```

To get string index: map `cart.notemidi` → string via `gameState.scene.tracks` (find track where `track.note.midi === cart.notemidi`).

### Memory management is critical

Every Three.js object must be disposed. Check that:
- `geometry.dispose()` called
- `material.dispose()` called  
- `scene.remove(mesh)` called

Undisposed objects = memory leak over long gameplay sessions.

### Do NOT touch
- CartSystem.js, DifficultyManager.js — Epic 2 done
- GameState.js — no new fields needed (use cart._effectPlayed as render flag only)

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- AC-1: SceneManager.render() detects cleared carts (cart.cleared && !cart._effectPlayed), calls _showClearEffect(position, stringIndex)
- AC-2: Safe zone fade managed via _activeEffects list; opacity decremented over ~300ms
- AC-3: Effect color = STRING_COLORS[stringIndex] from tokens.js
- AC-4: After ~300ms, geometry.dispose() + material.dispose() + scene.remove(mesh) called in _updateEffects()
- AC-5: All effect logic in SceneManager.js; no writes to GameState (cart._effectPlayed is render-side flag only)
- No separate unit test file required per story notes; covered indirectly via SceneManager tests

### File List
- static/game/SceneManager.js (modified — added _showClearEffect(), _updateEffects(), _activeEffects static array)

### Change Log
- 2026-05-21: Implemented sparkle/glow effect system in SceneManager with dispose lifecycle and STRING_COLORS integration
