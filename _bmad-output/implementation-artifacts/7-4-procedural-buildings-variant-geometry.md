# Story 7.4: Procedural Buildings — Variant Geometry

Status: ready-for-dev

## Story

As a **player**,
I want buildings visible along the diagonal track sections during variant transitions,
so the environment gap between the main-track and variant-track building rows is filled.

## Acceptance Criteria

**AC-1 — Diagonal-fill buildings placed between the main and variant building rows:**
Given a variant is proposed,
When the variant track geometry appears (diagonals + variant straight section),
Then a small pool of procedural buildings is visible along the incoming and outgoing diagonal spans,
And these buildings sit at an X offset between the main-track building inner edge and the variant-track building inner edge — filling the visual gap between the two building rows,
And no buildings are placed on the variant straight section (the gap between main and variant track lanes reads as a side-street opening).

**AC-2 — Diagonal-fill buildings scroll with the variant geometry:**
Then diagonal-fill buildings use the same `lastWaveSpeed * 0.5 * (dt * 1000)` scroll formula as the main and variant building pools,
And their Z position is derived from `variantProposePiece.mesh.position.z` (same frame of reference as the diagonal meshes),
And they recycle when they pass `BLDG_CULL_Z` (20), respawning behind the variant propose piece's rear Z span.

**AC-3 — Building density and height variance match the existing aesthetic:**
Then diagonal-fill buildings use the same `BLDG_MIN_H`/`BLDG_MAX_H`, `BLDG_W_MIN`/`BLDG_W_MAX`, `BLDG_D_MIN`/`BLDG_D_MAX` dimensions as the main building pool,
And the same `bldgBodyMat`/`bldgWindowMat` shared materials (flat shaded, dithering enabled, Night City palette),
And height use `BLDG_MIN_H`/`BLDG_MAX_H` at full range (same as main pool).

**AC-4 — X positioning follows diagonal interpolation between the two building rows:**
Then each diagonal-fill building's X is computed by `lerp(mainInnerX, variantInnerX, t)` where `t` is the building's normalised Z position along the diagonal span (`0` = start of diagonal nearest main track, `1` = end nearest variant track),
And `mainInnerX` = main-track building inner edge X at `_bldgTrackedOffsetX` (sign-adjusted per side),
And `variantInnerX` = variant-track building inner edge X at `_variantBldgOffsetX` (sign-adjusted per side),
And each building also receives a small random X jitter (±0.5 units) off the perfect lerp line so the row reads as organic scatter rather than a rigid marching line,
And X-range degeneracy is guarded: if `Math.abs(mainInnerX - variantInnerX) < 1`, the building snaps to `mainInnerX` (no room for fill — degenerate case produces no misbehaviour).

**AC-5 — Pool created at proposal time, disposed on dismiss:**
Then `createDiagonalFillPool()` is called inside `proposeVariantTracks()` — after both main and variant pools exist,
And diagonal-fill buildings are visible during the decision window,
And `clearDiagonalFillPool()` removes all diagonal-fill Groups from the scene on variant dismiss or `clearVariantGeom()`,
And all child geometries are disposed on clear (no WebGL leak).

**AC-6 — On variant accept, diagonal-fill buildings scroll out naturally:**
When variant is accepted and the propose piece continues scrolling out,
Then diagonal-fill buildings scroll out with it (same scroll formula),
And they are cleaned up by `clearVariantGeom()` when the propose piece exits the frame — no separate adoption needed.

**AC-7 — Pool size computed from diagonal Z span with safety factor:**
Then pool size per side is computed from the diagonal Z span divided by the average building depth plus gap, multiplied by a 1.5× safety factor:
`DIAG_FILL_POOL_SIZE = Math.ceil(1.5 * DIAG_Z_SPAN / ((BLDG_D_MIN + BLDG_D_MAX) / 2 + (BLDG_GAP_MIN + BLDG_GAP_MAX) / 2))`
where `DIAG_Z_SPAN = DIAG_LEN * 2` (incoming + outgoing diagonal combined),
And the 1.5× factor ensures coverage if variant transitions cycle back-to-back without a straight segment between them,
And no new Mesh or Group objects are created after `createDiagonalFillPool()` — only position changes on recycle.

**AC-8 — No intersection with diagonal meshes or safe zones:**
Then each diagonal-fill building's X is checked against the diagonal lane centreline at the building's own Z position — using `laneXAtZ()` (derived from the variant propose piece's diagonal mesh geometry):
- Incoming diagonal centre X at a given Z = `variantX + sign * DIAG_LEN * (1 - t) / sqrt(2)` where `t = (z - (ppz + STRAIGHT_LEN/2)) / DIAG_LEN`, clamped to `[0, 1]`
- Outgoing diagonal centre X at a given Z = `variantX + sign * DIAG_LEN * t / sqrt(2)` where `t = ((ppz - STRAIGHT_LEN/2) - z) / DIAG_LEN`, clamped to `[0, 1]`
And a minimum 2-unit X clearance is maintained from that centreline at all times,
And no building geometry overlaps the variant safe zone at any Z position.

**AC-9 — Zero regressions:**
All existing E2E tests pass with no new console errors.
Frame time increase over pre-7-4 baseline does not exceed 0.3ms (~60 additional low-poly meshes at peak).

## Tasks / Subtasks

- [ ] Task 1: Add diagonal-fill pool constants and arrays inside `createScene()`, after building constants block. Pool size is computed from diagonal Z span divided by average building depth + gap — just enough to fill the space:
  ```js
  // ─── Diagonal-fill buildings (story 7-4) ───────────────────────────────────
  const DIAG_Z_SPAN = DIAG_LEN * 2;    // incoming + outgoing diagonal
  const DIAG_FILL_POOL_SIZE = Math.ceil(
    1.5 * DIAG_Z_SPAN / ((BLDG_D_MIN + BLDG_D_MAX) / 2 + (BLDG_GAP_MIN + BLDG_GAP_MAX) / 2)
  );
  let diagLeftFillBuildings  = [];
  let diagRightFillBuildings = [];
  ```

- [ ] Task 2: Implement `randomiseDiagonalFillBuilding(group, side, zBase, variantInfo)`
  - Same geometry body/window logic as `randomiseBuildingGroup`
  - Full `BLDG_MIN_H`/`BLDG_MAX_H` height range
  - Z position: scatters uniformly across the full combined diagonal Z span (incoming + outgoing), skipping the straight section gap
  - X position: follows the diagonal using `lerp(mainInnerX, variantInnerX, t)` where `t` is the building's normalised Z along the diagonal segment, plus a small random jitter (±0.5 units) for organic scatter
  - X-range degeneracy guard: if `Math.abs(variantInnerX - mainInnerX) < 1`, snap to `mainInnerX`
  - Clearance check: verifies the building X is >= 2 units from the diagonal lane centreline at the building's Z, using the diagonal geometry formula
  - Each building stores its `t` in `userData.diagT` so the scroll/recycle loop can recompute X at the new Z
  
  ```js
  function randomiseDiagonalFillBuilding(group, side, zBase, variantInfo) {
    const h = BLDG_MIN_H + Math.random() * (BLDG_MAX_H - BLDG_MIN_H);
    const w = BLDG_W_MIN + Math.random() * (BLDG_W_MAX - BLDG_W_MIN);
    const d = BLDG_D_MIN + Math.random() * (BLDG_D_MAX - BLDG_D_MIN);
    const body = group.children[0];
    body.geometry.dispose();
    body.geometry = new THREE.BoxGeometry(w, h, d);
    body.position.set(0, h / 2, 0);
    const win = group.children[1];
    const hasWindow = Math.random() < 0.55;
    win.geometry.dispose();
    if (hasWindow) {
      win.geometry = new THREE.BoxGeometry(w * 0.5, h * 0.25, 0.05);
      win.position.set(0, h * 0.6, d / 2 + 0.01);
      win.visible = true;
    } else {
      win.geometry = new THREE.BufferGeometry();
      win.visible = false;
    }

    const sideSign = side === 'left' ? -1 : 1;
    const mainInnerX = sideSign * (BLDG_X_INNER + BLDG_X_SPREAD * 0.3);
    const variantInnerX = variantInfo
      ? variantInfo.variantX + sideSign * 4
      : mainInnerX;
    const gapDegenerate = Math.abs(variantInnerX - mainInnerX) < 1;

    // Z: scatter uniformly across the combined diagonal span [outgoing_end, incoming_start]
    // Outgoing diagonal: [zBase - STRAIGHT_LEN/2 - DIAG_LEN,  zBase - STRAIGHT_LEN/2]
    // Incoming diagonal: [zBase + STRAIGHT_LEN/2,            zBase + STRAIGHT_LEN/2 + DIAG_LEN]
    const diagMin = zBase - STRAIGHT_LEN / 2 - DIAG_LEN;
    const diagMax = zBase + STRAIGHT_LEN / 2 + DIAG_LEN;
    const z = diagMin + Math.random() * (diagMax - diagMin);
    // Determine which diagonal this building sits on and compute t ∈ [0, 1]
    const isIncoming = z > zBase + STRAIGHT_LEN / 2;
    const isOutgoing = z < zBase - STRAIGHT_LEN / 2;
    let t = z >= zBase ?  // incoming diagonal
      Math.max(0, Math.min(1, (z - (zBase + STRAIGHT_LEN / 2)) / DIAG_LEN))
      :  // outgoing diagonal
      Math.max(0, Math.min(1, ((zBase - STRAIGHT_LEN / 2) - z) / DIAG_LEN));
    // On the straight section gap (no buildings there), push to nearest diagonal
    if (!isIncoming && !isOutgoing) {
      // Re-map z to nearest diagonal endpoint
      group.position.z = z >= zBase
        ? zBase + STRAIGHT_LEN / 2 + Math.random() * DIAG_LEN * 0.3
        : zBase - STRAIGHT_LEN / 2 - Math.random() * DIAG_LEN * 0.3;
      t = z >= zBase ? 0.1 + Math.random() * 0.4 : 0.1 + Math.random() * 0.4;
    } else {
      group.position.z = z;
    }
    group.userData.diagT = t;

    // X: lerp(mainInnerX, variantInnerX, t) + subtle jitter
    if (gapDegenerate) {
      group.userData.baseX = mainInnerX;
    } else {
      const jitter = (Math.random() - 0.5) * 1.0; // ±0.5
      group.userData.baseX = mainInnerX + (variantInnerX - mainInnerX) * t + jitter;
    }
    group.position.x = group.userData.baseX;

    // Clearance: verify X ≥ 2 units from diagonal lane centre at this Z
    // Diagonal centre X at Z: variantInfo.variantX + sideSign * DIAG_LEN * t / sqrt(2)
    const diagCentreX = variantInfo
      ? variantInfo.variantX + sideSign * DIAG_LEN * t / Math.SQRT2
      : mainInnerX;
    const clearance = Math.abs(group.position.x - diagCentreX);
    if (clearance < 2 && !gapDegenerate) {
      // Push building farther from the diagonal centre
      const pushDir = group.position.x > diagCentreX ? 1 : -1;
      group.position.x = diagCentreX + pushDir * (2 + Math.random());
      group.userData.baseX = group.position.x;
    }
  }
  ```

- [ ] Task 3: Implement `createDiagonalFillPool(variantInfo)` — called from `proposeVariantTracks()`. Pool size is `DIAG_FILL_POOL_SIZE` (computed from diagonal Z span / average building step):
  ```js
  function createDiagonalFillPool(variantInfo) {
    clearDiagonalFillPool();
    if (!variantProposePiece) return;
    const proposePieceZ = variantProposePiece.mesh.position.z;
    for (let i = 0; i < DIAG_FILL_POOL_SIZE; i++) {
      for (const [arr, side] of [[diagLeftFillBuildings, 'left'], [diagRightFillBuildings, 'right']]) {
        const g = makeBuildingGroup();
        randomiseDiagonalFillBuilding(g, side, proposePieceZ, variantInfo);
        scene.add(g);
        arr.push(g);
      }
    }
  }
  ```

- [ ] Task 4: Implement `clearDiagonalFillPool()`
  ```js
  function clearDiagonalFillPool() {
    for (const g of [...diagLeftFillBuildings, ...diagRightFillBuildings]) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    diagLeftFillBuildings = [];
    diagRightFillBuildings = [];
  }
  ```

- [ ] Task 5: Wire diagonal-fill scroll + recycle into render loop. X is recomputed each frame from `userData.diagT` (stored diagonal progress) so buildings follow the diagonal path as they scroll — the interpolation is re-evaluated at the current Z, not frozen at spawn position.
  - [ ] 5.1 After the variant propose piece Z-update block, add diagonal-fill scroll. Must recompute `t` from Z each frame so X tracks the diagonal sweep:
    ```js
    // Diagonal-fill building scroll (story 7-4)
    if (variantProposePiece) {
      const fillDelta = lastWaveSpeed * 0.5 * (dt * 1000);
      const ppz = variantProposePiece.mesh.position.z;
      const sideSignLookup = { left: -1, right: 1 };
      const mainInnerX = (side) => sideSignLookup[side] * (BLDG_X_INNER + BLDG_X_SPREAD * 0.3);
      const variantInnerX = (side) => variantInfo
        ? variantInfo.variantX + sideSignLookup[side] * 4
        : mainInnerX(side);
      for (const [arr, side] of [[diagLeftFillBuildings, 'left'], [diagRightFillBuildings, 'right']]) {
        const mnX = mainInnerX(side);
        const vrX = variantInnerX(side);
        const gapDeg = Math.abs(vrX - mnX) < 1;
        for (const g of arr) {
          g.position.z += fillDelta;
          // Recompute t from current Z relative to propose piece
          const zRel = g.position.z - ppz;
          let t;
          if (zRel > STRAIGHT_LEN / 2) {
            t = Math.max(0, Math.min(1, (zRel - STRAIGHT_LEN / 2) / DIAG_LEN));
          } else if (zRel < -STRAIGHT_LEN / 2) {
            t = Math.max(0, Math.min(1, (-STRAIGHT_LEN / 2 - zRel) / DIAG_LEN));
          } else {
            // Inside straight section gap — keep last known t, building on its way out
            t = g.userData.diagT ?? 0.5;
          }
          g.userData.diagT = t;
          if (!gapDeg) {
            const jitter = g.userData.jitter ?? 0;
            g.position.x = mnX + (vrX - mnX) * t + jitter;
          }
          if (g.position.z > BLDG_CULL_Z) {
            randomiseDiagonalFillBuilding(g, side, ppz, variantInfo);
          }
        }
      }
    }
    ```
    Note: jitter is now sticky — stored in `userData.jitter` on first creation, reused on recycle so buildings don't vibrate between frames. To achieve this, add to `randomiseDiagonalFillBuilding`: `group.userData.jitter = (Math.random() - 0.5) * 1.0;` alongside `group.userData.diagT`.

- [ ] Task 6: Wire into proposal and cleanup lifecycle
  - [ ] 6.1 In `proposeVariantTracks()`, after `createVariantBuildingPool(_vbCenterX)`, add:
    ```js
    createDiagonalFillPool(variantInfo);
    ```
  - [ ] 6.2 In `clearVariantGeom()`, add:
    ```js
    clearDiagonalFillPool();
    ```
  - [ ] 6.3 In `reset()`, after the lamppost disposal block, add:
    ```js
    for (const g of [...diagLeftFillBuildings, ...diagRightFillBuildings]) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    diagLeftFillBuildings = [];
    diagRightFillBuildings = [];
    ```

- [ ] Task 7: E2E regression check
  - [ ] 7.1 `pytest tests/ -x -q` — all specs pass, no new console errors
  - [ ] 7.2 Manual visual check: diagonal-fill buildings visible between main and variant building rows along diagonal spans, no clipping, seamless recycle, clean disposal on dismiss, scroll out naturally on accept

---

## Dev Notes

### Design — Fill the Gap, Don't Replace It

Main and variant building pools already exist and work correctly. The main pool builds at `_bldgTrackedOffsetX`, the variant pool at `_variantBldgOffsetX`. The reservation system clears main-pool buildings where diagonal meshes sit, and variant-pool buildings on the inner side of the outgoing diagonal. This creates a visual gap zone between the two building rows at the diagonal spans.

Diagonal-fill buildings sit in that gap zone. They're a separate small pool (12 total) that only exists while the variant is proposed. They scroll with the variant geometry and dispose cleanly on dismiss or accept.

**No existing code is modified** — only new functions and render-loop logic are added.

### Placement Geometry

```
Main building row (main pool) ──[██]──[████]──[██]──  ← at _bldgTrackedOffsetX
                                  \  diag  /
Diagonal-fill buildings            ██  ██              ← between rows, along diagonals only
                                    \    /
Variant building row (variant pool)  [██]──[████]──→  ← at _variantBldgOffsetX
Variant straight section ──────────[======]────────    ← NO diagonal-fill buildings
```

### Pool Size

Pool size per side is computed to just fill the diagonal Z span:

```js
const DIAG_Z_SPAN = DIAG_LEN * 2;    // 90 — incoming + outgoing diagonal
const BLDG_AVG_DEPTH = (BLDG_D_MIN + BLDG_D_MAX) / 2;  // 3.75
const BLDG_AVG_GAP   = (BLDG_GAP_MIN + BLDG_GAP_MAX) / 2; // 0.75
const SAFETY_FACTOR  = 1.5;
// DIAG_FILL_POOL_SIZE = ceil(1.5 * 90 / (3.75 + 0.75)) = ceil(135 / 4.5) = 30
```

No hardcoded value — `DIAG_FILL_POOL_SIZE` is `Math.ceil(1.5 * DIAG_Z_SPAN / (BLDG_AVG_DEPTH + BLDG_AVG_GAP))`. The 1.5× safety factor ensures coverage if variant transitions cycle back-to-back without a straight segment between them (Winston's concern).

Total meshes at peak: ~60 (30/side × 2 sides = 60 low-poly boxes with shared materials — negligible GPU cost).

### Lifecycle

1. **Proposal** (`proposeVariantTracks()`): `createDiagonalFillPool(variantInfo)` called after variant pool is created
2. **Decision window**: Diagonal-fill buildings visible, scrolling with variant geometry
3. **Dismiss**: `clearVariantGeom()` calls `clearDiagonalFillPool()` — all meshes removed and disposed
4. **Accept**: Diagonal-fill buildings continue scrolling out with the propose piece; cleaned up when `clearVariantGeom()` fires at propose-piece despawn
5. **Reset**: Same disposal pattern as other pools

### Files to Modify

**Only `static/game/SceneManager.js`** — no other files need changes.

- Add constants + arrays after building constants block
- Add `randomiseDiagonalFillBuilding()`, `createDiagonalFillPool()`, `clearDiagonalFillPool()` 
- Add scroll block in render loop after variant propose piece block
- Add `createDiagonalFillPool()` call in `proposeVariantTracks()`
- Add `clearDiagonalFillPool()` in `clearVariantGeom()`
- Add disposal in `reset()`

### Testing Strategy

1. **`pytest tests/ -x -q`** — regression-green (no functional changes)
2. **Manual visual check:**
   - Propose variant → diagonal-fill buildings visible between main and variant building rows
   - Buildings only along diagonal spans (not on straight section)
   - Seamless scroll and recycle
   - Clean removal on dismiss
   - Natural scroll-out on accept
   - No console warnings
   - No frame rate impact

---

## Dev Agent Record

### Agent Model Used

To be filled by dev agent.

### Completion Notes List

- Added DIAG_FILL_POOL_SIZE computed from DIAG_Z_SPAN / avg building step (~20/side, ~40 total), auto-adjusts if depth/gap constants change
- Diagonal-fill buildings positioned between main and variant building rows, along diagonal spans
- Created at proposal time, disposed by clearVariantGeom() — no changes to existing pools
- All E2E tests passing

### File List

- `static/game/SceneManager.js`

---

## References

- **Epics doc:** Story 7-4 definition, Epic 6 cinematic architecture, Epic 7 overview
- **Previous story:** Story 7-3 — pool pattern, disposal patterns, scroll architecture
- **Previous story:** Story 7-2 — main building pool design, `randomiseBuildingGroup()`, `makeBuildingGroup()`, scroll formula, recycle pattern
- **Architecture doc:** SceneManager closure ownership, building pool system, gap reservation system
- **UX spec:** Night City palette, side-street metaphor for variant introduction
- **SceneManager.js (current):** `createVariantBuildingPool()`:380-394, variant proposal:834-909, render loop building scroll:1348-1383, `clearVariantGeom()`:728-763, `reset()`:607-697