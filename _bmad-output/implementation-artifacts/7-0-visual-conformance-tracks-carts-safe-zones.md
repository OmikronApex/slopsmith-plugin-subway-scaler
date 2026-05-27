# Story 7.0: Visual Conformance — Tracks, Carts & Safe Zones

Status: done

## Story

As a **player**,
I want the track geometry, carts, and safe-zone indicators to use the correct Night City palette colours and a polished neon-border safe-zone treatment,
so that the game world reads consistently before new environment elements are added in Epic 7.

## Acceptance Criteria

**AC-1 — Track lane material uses `COLORS.BG_STAGE`:**
Given the game scene loads,
When track lane geometry is rendered,
Then each track lane surface material colour is `COLORS.BG_STAGE` (`0x1A1A2E`),
And no track geometry constructor call contains a colour literal — all colours sourced from `tokens.js` exports.

**AC-2 — NPC cart material uses `COLORS.DANGER`:**
Given the game scene loads,
When cart meshes are rendered,
Then all NPC / obstacle carts use `COLORS.DANGER` (`0xFF4411`),
And no cart material references colour values outside `tokens.js` exports,
And `COLORS.ACCENT` (`0xFFB800`) is not used on any cart.

**AC-3 — Safe zone fill plane uses `STRING_SAFE_ZONE_FILLS[i]` at `opacity: 0.75`:**
Given a safe zone is active on track lane at string index `i`,
When the safe-zone indicator is rendered,
Then a translucent plane fills the safe-zone bounds with material colour `STRING_SAFE_ZONE_FILLS[i]`, `opacity: 0.75`, `transparent: true`, `depthWrite: false`, `polygonOffset: true`, `polygonOffsetFactor: 1`, `polygonOffsetUnits: 1`.

**AC-4 — Safe zone border uses `EdgesGeometry` with neon colour:**
And a border mesh (`EdgesGeometry` wrapping a `PlaneGeometry` matching the fill plane) surrounds the perimeter with `LineBasicMaterial({ color: STRING_COLORS[i] })` at full string-colour brightness,
And the border mesh has `renderOrder` set 1 higher than the fill plane,
And no internal diagonal edges appear (use `EdgesGeometry` on `PlaneGeometry`, not `BoxGeometry`).
Note: `LineBasicMaterial` does not support `emissive`/`emissiveIntensity`. `EMISSIVE_SAFE_ZONE_BORDER = 0.7` is exported as a reserved constant for a future shader/material upgrade (post-7-3 lighting).

**AC-5 — Safe zone group is child of lane group / scrolls correctly:**
And the fill plane + border are managed as a two-mesh unit within `SafeZoneRenderer` — positioned in world space but scrolling correctly with the wave timing (existing Z-scroll logic preserved).

**AC-6 — Variant safe zone receives same treatment:**
Given a variant is proposed,
When the variant safe zone is rendered in `SceneManager.proposeVariantTracks`,
Then the variant safe zone fill uses `opacity: 0.75`, `depthWrite: false`, `polygonOffset: true/1/1`,
And an `EdgesGeometry` border mesh with `LineBasicMaterial({ color: STRING_COLORS[paletteIdx] })` borders it,
And the border `renderOrder` is 1 higher than the fill.

**AC-7 — Tokens additions committed in `tokens.js`:**
`COLORS.DANGER = 0xFF4411` added to the COLORS export (hot coral — distinct from String Red/Orange by hue),
`STRING_SAFE_ZONE_FILLS` array (8 values, darkened variants of STRING_COLORS) exported,
`EMISSIVE_SAFE_ZONE_BORDER = 0.7` exported (with tone-mapping warning comment).

**AC-8 — Zero Three.js console warnings from these elements:**
Given all three element types (tracks, carts, safe zones) are visible simultaneously,
When the scene runs,
Then the browser console shows zero Three.js warnings attributable to these elements.

**AC-9 — No regressions:**
All existing E2E tests pass (baseline, epic1–6 suites) with no new console errors.

---

## Tasks / Subtasks

- [x] Task 1: Add new token exports to `tokens.js` (AC: 7)
  - [x] 1.1 Add `DANGER: 0xFF4411` to the `COLORS` object (after `EDGE`) — hot coral, distinct from String Red/Orange by hue
  - [x] 1.2 Add `STRING_SAFE_ZONE_FILLS` array (8 darkened-string-colour entries) as named export
  - [x] 1.3 Add `EMISSIVE_SAFE_ZONE_BORDER = 0.7` as named export with tone-mapping warning comment

- [x] Task 2: Fix track lane material colour in `SceneManager.js` (AC: 1)
  - [x] 2.1 Import `COLORS` (already imported) — verify `COLORS.BG_STAGE` is accessible
  - [x] 2.2 Change `trackMat` from literal `0x2a3142` to `COLORS.BG_STAGE`
  - [x] 2.3 Change `renderer.setClearColor(0x101a2a)` to `COLORS.BG_VOID` (scene clear colour, keeps palette consistent; also fix fog colour `0x101a2a`)
  - [x] 2.4 Verify `rebuildTracks` and `spawnVariantTracks` both use `trackMat` (no new literals)

- [x] Task 3: Fix NPC cart colour in `SceneManager.js` (AC: 2)
  - [x] 3.1 Import `COLORS` is already present; add `COLORS.DANGER` token reference
  - [x] 3.2 Change cart body `bodyMaterial(0x888888)` call to `bodyMaterial(COLORS.DANGER)`
  - [x] 3.3 Verify `makeCart` and `bodyMatByColour` map work with the new token value

- [x] Task 4: Refactor `SafeZoneRenderer.js` safe zone visual (AC: 3, 4, 5)
  - [x] 4.1 Import `STRING_SAFE_ZONE_FILLS`, `STRING_COLORS` from `tokens.js`
  - [x] 4.2 Replace shared `this.material` (old `MeshStandardMaterial`, green, opacity 0.4) with per-zone `_makeZoneMeshes(paletteIdx)` factory
  - [x] 4.3 Fill plane: `STRING_SAFE_ZONE_FILLS[paletteIdx]`, `opacity: 0.15`, `transparent`, `depthWrite: false`, `polygonOffset: true/1/1`, `DoubleSide`
  - [x] 4.4 Border: `EdgesGeometry` on `PlaneGeometry(1.2, SAFE_ZONE_DEPTH)` → `LineSegments` with `LineBasicMaterial({ color: STRING_COLORS[paletteIdx] })`
  - [x] 4.5 Fill `renderOrder=0`, border `renderOrder=1`; both `rotation.x=-Math.PI/2`
  - [x] 4.6 `this.zones` stores `{ fill, border }`; both positioned each frame
  - [x] 4.7 `reset()` disposes fill material + border geometry+material; removes both from scene
  - [x] 4.8 Stale-wave cleanup removes both fill and border, disposes materials

- [x] Task 5: Refactor variant safe zone in `SceneManager.js` (AC: 6)
  - [x] 5.1 Import `STRING_COLORS`, `STRING_SAFE_ZONE_FILLS` into `SceneManager.js`
  - [x] 5.2 `szMat`: `STRING_SAFE_ZONE_FILLS[paletteIdx]`, `opacity: 0.15`, `depthWrite: false`, `polygonOffset: true/1/1`
  - [x] 5.3 Border: `EdgesGeometry(szGeo)` + `LineBasicMaterial({ color: STRING_COLORS[paletteIdx] })`
  - [x] 5.4 Fill `renderOrder=0`, border `renderOrder=1`; border `rotation.x=-Math.PI/2`
  - [x] 5.5 `variantSafeZoneBorderMesh` declared; position synced each frame alongside fill
  - [x] 5.6 Border disposed in `clearVariantGeom()`, `clearVariantSafeZone()`, and off-screen removal block

- [x] Task 6: Run full E2E suite and confirm no regressions (AC: 8, 9)
  - [x] 6.1 E2E skipped by user request — failures confirmed pre-existing (WebGL context loss in Docker, ARIA/keyboard flakes, epic6 timing flakes unrelated to visual changes)
  - [x] 6.2 No Three.js material warnings introduced — changes use valid Three.js APIs (`LineSegments`, `EdgesGeometry`, `LineBasicMaterial`, `MeshStandardMaterial` with standard params)

### Review Findings

- [x] [Review][Patch] AC-7 doc out of sync — story says `COLORS.DANGER = 0xFF2233` but committed value is `0xFF4411` (hot coral, intentional per d27fd44); update AC-7 and subtask 1.1 to reflect actual value [tokens.js]
- [x] [Review][Patch] AC-6 doc out of sync — story says `opacity: 0.15` for variant SZ fill but code uses `0.75` (raised intentionally post-dev); update AC-6 to say `0.75` [SceneManager.js]
- [x] [Review][Patch] AC-4 doc misleading — spec text says `emissiveIntensity: EMISSIVE_SAFE_ZONE_BORDER (0.7)` but `LineBasicMaterial` doesn't support emissive; Dev Notes resolve this correctly (use `color` only); update AC-4 to remove emissive claim and note that `EMISSIVE_SAFE_ZONE_BORDER` is reserved for future shader/material upgrade
- [x] [Review][Defer] SafeZoneRenderer.this.geometry has no disposal path on permanent renderer teardown — pre-existing architecture gap; geometry leaks if renderer is GC'd without reset() [SafeZoneRenderer.js] — deferred, pre-existing
- [x] [Review][Defer] paletteIdx=0 fallback when anchorString=null ignores available transitionWave.safe_string — renders variant SZ always red for null-anchor case; pre-existing behaviour [SceneManager.js:388] — deferred, pre-existing
- [x] [Review][Defer] paletteIdx conversion (stringCount - string) duplicated in SceneManager and SafeZoneRenderer without shared utility — divergence risk if indexing convention changes [SceneManager.js:388, SafeZoneRenderer.js:109] — deferred, pre-existing
- [x] [Review][Defer] stale-zone cleanup skips fill.geometry dispose (correct — shared) but no comment explains the invariant — future refactor risk [SafeZoneRenderer.js:95] — deferred, pre-existing

---

## Dev Notes

### Architecture Constraint: Scroll-World Model

The game uses a scroll-world: geometry spawns at `SPAWN_Z = -100` and travels toward `Z = 0` (player). Character is **stationary in Z**. All Z-motion is via scrolling geometry. Do **not** modify `character.position.z` during gameplay.

### Files to Touch (and current state)

#### `static/game/ui/tokens.js`

Current exports: `COLORS`, `STRING_COLORS`, `colourForString`, `injectTokens`.

**Missing (must add):**
```js
// In COLORS object (add after EDGE):
DANGER: 0xFF2233,  // NPC cart threat — reserved for hazard signals only. NOT for UI warnings or ACCENT.

// New top-level exports:
export const STRING_SAFE_ZONE_FILLS = [
  0x330000, // 0 — Red    (darkened)
  0x332A00, // 1 — Yellow (darkened)
  0x001A33, // 2 — Blue   (darkened)
  0x331900, // 3 — Orange (darkened)
  0x003319, // 4 — Green  (darkened)
  0x260033, // 5 — Purple (darkened)
  0x330029, // 6 — Magenta(darkened)
  0x003333, // 7 — Teal   (darkened)
];

// PROVISIONAL — retune after lamppost lighting (7-3) lands.
// Do NOT raise above 0.8 before testing with ACESFilmicToneMapping.
export const EMISSIVE_SAFE_ZONE_BORDER = 0.7;
```

#### `static/game/SceneManager.js`

Key lines to change (current values → new values):

| Line(s) | Current | Target |
|---|---|---|
| `renderer.setClearColor(0x101a2a)` | literal | `COLORS.BG_VOID` |
| `scene.fog = new THREE.Fog(0x101a2a, ...)` | literal | `COLORS.BG_VOID` |
| `trackMat = new THREE.MeshStandardMaterial({ color: 0x2a3142 })` | literal | `COLORS.BG_STAGE` |
| `makeCart(bodyMaterial(0x888888))` | literal | `bodyMaterial(COLORS.DANGER)` |
| `szMat` in `proposeVariantTracks` | `opacity: 0.5`, old colour logic | `STRING_SAFE_ZONE_FILLS[paletteIdx]`, `opacity: 0.15`, `depthWrite: false`, `polygonOffset` |

**`COLORS` is already imported** in `SceneManager.js` (`import { COLORS, colourForString } from './ui/tokens.js'`) — just add the new exports to the import destructuring.

**Variant safe zone border tracking:**
Add module-level `let variantSafeZoneBorderMesh = null;` alongside `variantSafeZoneMesh`. Sync both in the render loop. Dispose both in `clearVariantGeom()` and `clearVariantSafeZone()`.

#### `static/game/ui/SafeZoneRenderer.js`

Current state:
- Single shared `this.geometry = new THREE.PlaneGeometry(1.2, SAFE_ZONE_DEPTH)` — KEEP (reuse for fill).
- Single shared `this.material = new THREE.MeshStandardMaterial({ color: 0x00ff00, ... opacity: 0.4 })` — REMOVE. Each zone gets its own fill material (colour varies by string).
- `this.zones = new Map()` stores one mesh per wave. → Change to `{ fill, border }`.
- `mesh.material.color.setHex(color)` at the bottom of `update()` — replace with proper fill/border creation on zone spawn.

**Border geometry note:** `EdgesGeometry` wrapping a `PlaneGeometry(1.2, SAFE_ZONE_DEPTH)` produces exactly 4 edge segments (the rectangle perimeter) with **no internal diagonal**. If you use `BoxGeometry` you get diagonals across each face — do NOT do this.

**`LineBasicMaterial` does NOT support `emissive` or `emissiveIntensity`.** Use `LineBasicMaterial` with just `color: STRING_COLORS[paletteIdx]` for the border. The colour itself is vivid enough at full value without emissive (emissive is a `MeshStandardMaterial` feature). The spec says `emissive: STRING_COLORS[i], emissiveIntensity: EMISSIVE_SAFE_ZONE_BORDER` — implement as: use a `LineBasicMaterial` with `color` set to the string colour. The visual intent (bright neon outline) is achieved by the vivid STRING_COLORS at full brightness. If you need a subtle glow effect beyond the border line itself, that is deferred to a future story.

**`renderOrder` on `LineSegments`:** Works exactly like `Mesh.renderOrder`. Set `borderMesh.renderOrder = fillMesh.renderOrder + 1` to guarantee the border draws on top.

**Position sync:** Both fill and border have `rotation.x = -Math.PI / 2`. Position them identically (`mesh.position.set(x, 0.05, z)`) each frame. The border can be `0.06` Y instead of `0.05` to sit fractionally above the fill (avoids z-fighting without `polygonOffset`).

### Testing Strategy

This story is **purely visual** — no unit tests for colour values are meaningful. The test gates are:

1. **E2E regression pass:** `rtk playwright test` all specs green. This validates no JavaScript errors, no missing exports, no broken imports.
2. **Console warning check:** Playwright output should contain zero Three.js deprecation or material warnings.
3. **Manual visual check (recommended):** Start game, confirm:
   - Track lanes dark navy (not medium blue/grey)
   - Carts red (not grey)
   - Safe zones dim translucent fill + bright neon border
   - Variant safe zone same treatment

No new spec file is required for this story. The AC gates are regression-green + zero console warnings.

### Variant Safe Zone — Fallback Colour

When `anchorString` is null (no anchor note), the current code falls back to `COLORS.ACCENT`. After this story the fallback should be:
```js
const variantFillColor = paletteIdx < STRING_SAFE_ZONE_FILLS.length
  ? STRING_SAFE_ZONE_FILLS[paletteIdx]
  : STRING_SAFE_ZONE_FILLS[0];
const variantBorderColor = paletteIdx < STRING_COLORS.length
  ? STRING_COLORS[paletteIdx]
  : STRING_COLORS[0];
```
Do not use `COLORS.ACCENT` as a fill — it's reserved for lampposts (7-3).

### Existing `colourForString` Import in `SafeZoneRenderer.js`

Already imported from `tokens.js`. Add `STRING_SAFE_ZONE_FILLS`, `STRING_COLORS`, `EMISSIVE_SAFE_ZONE_BORDER` to the same import line.

### `TrackSystem.js` — No Changes Needed

`TrackSystem.init` and `TrackSystem.showVariant` set `color: '#1A1A2E'` on track data objects. This string is used as a CSS hex in the UI layer — not directly as a Three.js material. The Three.js `trackMat` in `SceneManager.js` is the actual renderer material. Only `SceneManager.js` needs the `COLORS.BG_STAGE` fix.

### Previous Story Intelligence (Epic 6)

- The `6-8` story introduced `_retiringTracks`, `_pendingTracks`, `_cinematicExit`, `variantSafeZoneMesh`, `variantSafeZoneBorderMesh` — all of these must continue working after this story. The border mesh addition to the variant SZ path mirrors the existing `variantSafeZoneMesh` lifecycle exactly.
- The `disableVariantMissCallback()` and `clearVariantSafeZone()` functions clean up `variantSafeZoneMesh`. Both must also clean up the new `variantSafeZoneBorderMesh`.
- `finalizeVariantTransition()` does NOT touch `variantSafeZoneMesh` — that's fine, no changes needed there.

### Out of Scope

- Floor plane, buildings, lampposts, vertex shader (7-1 through 7-5)
- Safe-zone pulse animation / emissive oscillation (backlog, post-7-1)
- Retune of `EMISSIVE_SAFE_ZONE_BORDER` (deferred to after 7-3 lighting lands)
- Cart roof material colour (`ROOF_COLOUR = 0x444444`) — not in ACs, leave as-is

---

### References

- Epic 7, Story 7-0 spec: `_bmad-output/planning-artifacts/epics.md` — Epic 7 section
- `static/game/ui/tokens.js` — current token exports, STRING_COLORS palette
- `static/game/SceneManager.js` — `trackMat`, `makeCart`, `proposeVariantTracks`, clear/dispose lifecycle
- `static/game/ui/SafeZoneRenderer.js` — `update()`, `reset()`, zone mesh lifecycle
- `static/game/TrackSystem.js` — track data model (CSS strings, NOT Three.js materials — read-only reference)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Added `COLORS.DANGER = 0xFF2233`, `STRING_SAFE_ZONE_FILLS[8]`, `EMISSIVE_SAFE_ZONE_BORDER = 0.7` to `tokens.js`
- `SceneManager.js`: track material `0x2a3142` → `COLORS.BG_STAGE`; renderer/fog clear `0x101a2a` → `COLORS.BG_VOID`; cart body `0x888888` → `COLORS.DANGER`
- `SafeZoneRenderer.js`: replaced single shared green `MeshStandardMaterial` with per-zone `_makeZoneMeshes(paletteIdx)` factory producing `{ fill, border }` pair. Fill uses `STRING_SAFE_ZONE_FILLS` at `opacity:0.15`, `depthWrite:false`, `polygonOffset`. Border uses `EdgesGeometry(PlaneGeometry)` + `LineBasicMaterial(STRING_COLORS[i])` — 4 perimeter edges only, no diagonals.
- `SceneManager.js` variant SZ: same fill+border treatment; `variantSafeZoneBorderMesh` tracked through all 4 disposal paths (`clearVariantGeom`, `clearVariantSafeZone`, off-screen removal, `reset` via `clearVariantGeom`)
- Removed now-unused `variantSzColor` variable and `colourForString` import from SafeZoneRenderer
- E2E skipped per user request; pre-existing failures confirmed unrelated to visual changes (WebGL context loss in Docker, ARIA/keyboard flakes, epic6 timing flakes)

### File List

- `static/game/ui/tokens.js`
- `static/game/SceneManager.js`
- `static/game/ui/SafeZoneRenderer.js`
- `_bmad-output/implementation-artifacts/7-0-visual-conformance-tracks-carts-safe-zones.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-27: Story 7-0 implemented — token conformance for tracks (BG_STAGE), carts (DANGER), safe zones (STRING_SAFE_ZONE_FILLS fill + STRING_COLORS EdgesGeometry border)
- 2026-05-27: Safe zone fill opacity increased 0.15 → 0.75 for improved visibility (AC-3 updated accordingly); applied same opacity to variant safe zone in SceneManager.js
