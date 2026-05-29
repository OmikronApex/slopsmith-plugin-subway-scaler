// Subway-Surfer scene for Guitar Subway Scaler (v6.3 - safezone alignment).
//
// Dynamic waves: carts come towards the player at Z=0.
// Lanes (X-axis) = strings.
// Character slides X-only between strings.

import * as THREE from './vendor/three.module.js';
import { laneX, cameraForPitch, SPAWN_Z, LANE_X_SCALE } from './TrackSystem.js';
import { COLORS, colourForString, stringToLaneIndex, STRING_COLORS, STRING_SAFE_ZONE_FILLS, CURVED_WORLD, WORLD_CURVE_STRENGTH, CHARACTER_SPRITE_PATH, CHARACTER_FRAME_COUNT, CHARACTER_FRAME_W, CHARACTER_FRAME_H, CHARACTER_FPS } from './ui/tokens.js';
import { parseGifFrames } from './ui/gif-parser.js';

const FRONT_Z = 0;
const LATERAL_MS = 120;
const CAMERA_PITCH = 30; // Shallower angle (deg) to see more upcoming track
const CAMERA_DISTANCE = 15; // Euclidean distance
const TRACK_DEPTH = 120;
const ROOF_COLOUR = 0x444444;
const CHAR_FRAME_DURATION = 1000 / CHARACTER_FPS;  // ms per frame for sprite animation (story 7-6)
const VARIANT_SZ_DEPTH = 20;      // Safe zone depth for variant lane (matches SafeZoneRenderer)
const LANE_W = 1.4;               // Lane box width (matches BoxGeometry in rebuildTracks)
const PIECE_H = 0.06;             // Track piece height
const STRAIGHT_LEN = 60;          // Z length of variant parallel track = 3 wave spacings (story 5-7 adjustment)
const DIAG_LEN = 45;              // Z length of diagonal section in bend piece (~3× to reach frame edge)
// SEG_LEN = 25 removed — variant track uses fixed 3-piece group (story 5-7)

// ─── Curved world vertex bend (story 7-5) ──────────────────────────────────
// Injects a view-space cylindrical bend into a standard/basic material's vertex
// shader. The surface drops in Y as geometry recedes from the camera (negative
// view Z), producing a falling horizon. Computed in VIEW space so scrolling/
// recycling geometry curves correctly with zero CPU bookkeeping (the model-view
// matrix already carries each object's per-frame Z).
//
// No-op when CURVED_WORLD is false — material compiles to its stock program.
// The injected body faithfully reproduces the bundled three.js <project_vertex>
// chunk (USE_BATCHING + USE_INSTANCING branches preserved) plus one bend line,
// so downstream chunks (fog_vertex, lighting via vViewPosition) still find a
// valid mvPosition / gl_Position. Works on any material whose vertex shader
// includes <project_vertex> — MeshStandard/Physical AND LineBasic (safe-zone
// borders), keeping borders aligned with their bent fills.
//
// Module-level so SafeZoneRenderer (a separate module) can share the exact same
// helper — see SafeZoneRenderer.js. The constant customProgramCacheKey lets all
// curved materials share one compiled program per base-material kind, keeping
// renderer.info.programs flat (different base materials still differ by their
// own internal key, so basic vs standard programs do not collide).
export function applyWorldCurve(material) {
  if (!CURVED_WORLD) return material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurveStrength = { value: WORLD_CURVE_STRENGTH };
    shader.vertexShader =
      'uniform float uCurveStrength;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
         #ifdef USE_BATCHING
           mvPosition = batchingMatrix * mvPosition;
         #endif
         #ifdef USE_INSTANCING
           mvPosition = instanceMatrix * mvPosition;
         #endif
         mvPosition = modelViewMatrix * mvPosition;
         // Cylindrical bend: drop Y by the square of view-space depth.
         mvPosition.y -= (mvPosition.z * mvPosition.z) * uCurveStrength;
         gl_Position = projectionMatrix * mvPosition;`
      );
  };
  material.customProgramCacheKey = () => 'worldCurve';
  return material;
}
// ────────────────────────────────────────────────────────────────────────────

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(COLORS.BG_VOID);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.BG_VOID, 35, 100);

  const FLOOR_LAYER = 1; // floor tiles isolated on this layer — sun (layer 0) won't illuminate them

  const camBase = cameraForPitch(CAMERA_PITCH, CAMERA_DISTANCE);
  const camera = new THREE.PerspectiveCamera(55, (canvas.width / canvas.height) || 16 / 9, 0.1, 200);
  camera.layers.enable(FLOOR_LAYER); // see floor tiles on layer 1
  camera.position.set(camBase.x, camBase.y, camBase.z);
  camera.lookAt(camBase.lookAt[0], camBase.lookAt[1], camBase.lookAt[2]);

  let targetCameraX = 0;
  let currentCameraX = 0;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 12, 8);
  scene.add(sun);

  // Floor-only ambient light on layer 1 — floor receives uniform ambient only, not directional
  const floorAmbient = new THREE.AmbientLight(0xffffff, 0.45);
  floorAmbient.layers.set(FLOOR_LAYER);
  scene.add(floorAmbient);

  const trackMat = applyWorldCurve(new THREE.MeshStandardMaterial({ color: COLORS.BG_STAGE, dithering: true }));
  const roofMat = applyWorldCurve(new THREE.MeshStandardMaterial({ color: ROOF_COLOUR, dithering: true }));

  // ─── Floor plane (story 7-1) ─────────────────────────────────────────────
  const FLOOR_Y = -0.15;          // below track bottom (-0.08) with clearance (spec AC-4)
  const FLOOR_WIDTH = 400;        // extends far beyond visible world edges
  const FLOOR_TILE_DEPTH = 300;   // two tiles = 600 units depth, well past fog (100)
  const FLOOR_CULL_Z = 20;        // cull tiles whose front edge passes this Z (behind camera)

  let floorMat = applyWorldCurve(new THREE.MeshPhysicalMaterial({ color: COLORS.BG_VOID, roughness: 1.0, metalness: 0.0, dithering: true }));
  function makeFloorTile() {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_WIDTH, FLOOR_TILE_DEPTH, 32, 32),
      floorMat
    );
    tile.rotation.x = -Math.PI / 2;
    tile.layers.set(FLOOR_LAYER); // floor layer only — sun (layer 0) doesn't illuminate it
    return tile;
  }
  let floorTiles = [makeFloorTile(), makeFloorTile()];
  floorTiles[0].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z);
  floorTiles[1].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z);
  floorTiles.forEach(t => scene.add(t));
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Buildings (story 7-2) ───────────────────────────────────────────────
  // ── Lighting layer split ──────────────────────────────────────────────────
  // FLOOR_LAYER = 1: floor tiles receive ambient-only via a dedicated AmbientLight.
  //   Reason: DirectionalLight on a large flat plane creates circular brightness
  //   banding due to per-vertex lighting interpolation across huge triangles.
  // Buildings stay on layer 0: they receive DirectionalLight (sun) as well as
  //   ambient. This gives them bright tops and dark sides — the depth cue that
  //   makes box silhouettes read as solid 3D forms rather than flat sprites.
  //   Different surface, different problem, different solution.
  // ─────────────────────────────────────────────────────────────────────────
  const BLDG_POOL_SIZE   = 26;    // groups per side — covers BLDG_NEAR_CUTOFF to fog distance (~100 units)
  const BLDG_MIN_H       = 2.0;   // min height
  const BLDG_MAX_H       = 8.0;   // max height
  const BLDG_W_MIN       = 2.5;   // min width (X)
  const BLDG_W_MAX       = 4.0;   // max width
  const BLDG_D_MIN       = 2.5;   // min depth (Z)
  const BLDG_D_MAX       = 5.0;   // max depth
  const BLDG_X_INNER     = 12;    // inner edge X offset from centre (per side)
  const BLDG_X_SPREAD    = 6;     // buildings scatter up to this far outward of BLDG_X_INNER
  const BLDG_SPAWN_Z     = -115;  // Z at which buildings are (re)spawned
  const BLDG_CULL_Z      = 20;    // Z threshold — recycle when building.position.z > this
  const BLDG_NEAR_CUTOFF = -15;   // buildings only at z ≤ this (side-street gap)

  // Shared materials — let so reset() can dispose and recreate.
  let bldgBodyMat = applyWorldCurve(new THREE.MeshStandardMaterial({
    color: COLORS.BG_NEAR,
    flatShading: true,
    dithering: true,
  }));
  let bldgWindowMat = applyWorldCurve(new THREE.MeshStandardMaterial({
    color: COLORS.TEXT_PRIMARY,
    emissive: COLORS.TEXT_PRIMARY,
    emissiveIntensity: 0.6,
    flatShading: true,
    dithering: true,
  }));

  // ─── Lampposts (story 7-3) ──────────────────────────────────────────────
  const LAMP_POST_SPACING = 18;     // Z spacing between consecutive lampposts
  const LAMP_POOL_SIZE     = 6;      // lampposts per side (12 total)
  const LAMP_X_OFFSET      = 10.5;   // X = ±(BLDG_X_INNER - 1.5) — between track edge and building line
  const LAMP_POLE_H        = 3.0;    // pole height
  const LAMP_POLE_R        = 0.08;   // pole radius (thin — reads as distant)
  const LAMP_HEAD_W        = 0.4;    // lamp head width
  const LAMP_HEAD_H        = 0.15;   // lamp head height
  const LAMP_HEAD_D        = 0.4;    // lamp head depth

  let lampPoleMat = applyWorldCurve(new THREE.MeshStandardMaterial({
    color: COLORS.EDGE,
    flatShading: true,
    dithering: true,
  }));
  let lampHeadMat = applyWorldCurve(new THREE.MeshStandardMaterial({
    color: COLORS.ACCENT,
    emissive: COLORS.ACCENT,
    emissiveIntensity: 0.8,
    flatShading: true,
    dithering: true,
  }));

  let leftLampposts  = [];
  let rightLampposts = [];
  // Pre-transition variant-track lamppost pool. PREVIEW lamps: geometry + emissive
  // head only, NO SpotLight — adding real lights mid-game changes the scene light
  // count and forces a full material shader recompile (a propose-time lag spike).
  // Spawned at proposal so the variant track shows lampposts during the decision/
  // ride window. At landing the old main pool's SpotLights are reparented onto
  // these exact lamps (see _commitBuildingTransition) and they become the main pool.
  let variantLeftLampposts  = [];
  let variantRightLampposts = [];
  let _variantLampOffsetX   = 0;

  function makeLamppostGroup(side, withLight = true) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(LAMP_POLE_R, LAMP_POLE_R * 1.5, LAMP_POLE_H, 6), lampPoleMat);
    pole.position.set(0, LAMP_POLE_H / 2, 0);
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(LAMP_HEAD_W, LAMP_HEAD_H, LAMP_HEAD_D), lampHeadMat);
    head.position.set(0, LAMP_POLE_H, 0);
    group.add(head);
    let spot = null;
    if (withLight) {
      spot = new THREE.SpotLight(COLORS.ACCENT, 0.6, 15, Math.PI / 4, 0.5, 1);
      spot.position.set(0, LAMP_POLE_H, 0);
      spot.target.position.set(0, 0, 0);
      group.add(spot);
      group.add(spot.target);
    }
    const flickerPhase = Math.random() * Math.PI * 2;
    const flickerHz   = 2 + Math.random() * 1;
    const hasFlicker  = Math.random() < 0.55;
    group.userData = { flickerPhase, flickerHz, hasFlicker, spot };
    group.userData.baseX = side === 'left' ? -LAMP_X_OFFSET : LAMP_X_OFFSET;
    group.position.x = group.userData.baseX;
    scene.add(group);
    return group;
  }

  function createLamppostPool() {
    leftLampposts  = [];
    rightLampposts = [];
    for (let i = 0; i < LAMP_POOL_SIZE; i++) {
      for (const [arr, side] of [[leftLampposts, 'left'], [rightLampposts, 'right']]) {
        const g = makeLamppostGroup(side);
        g.position.z = BLDG_SPAWN_Z + i * LAMP_POST_SPACING;
        arr.push(g);
      }
    }
  }

  // Pre-transition variant lamppost preview pool: light-less, spawned at the variant
  // offset so the new track shows lampposts during the proposal/ride window.
  function createVariantLamppostPool(offsetX) {
    clearVariantLamppostPool();
    _variantLampOffsetX = offsetX;
    for (let i = 0; i < LAMP_POOL_SIZE; i++) {
      for (const [arr, side] of [[variantLeftLampposts, 'left'], [variantRightLampposts, 'right']]) {
        const g = makeLamppostGroup(side, false); // light-less — no shader recompile
        g.position.z = BLDG_SPAWN_Z + i * LAMP_POST_SPACING;
        g.position.x = g.userData.baseX + offsetX;
        arr.push(g);
      }
    }
  }

  // Dispose a lamppost group's geometry + lights. Shared materials (lampPoleMat /
  // lampHeadMat) are NOT disposed here — only in reset().
  function _disposeLamppost(g) {
    scene.remove(g);
    g.traverse(c => {
      if (c.isMesh) c.geometry?.dispose();
      if (c.isSpotLight) { c.dispose(); scene.remove(c.target); }
      if (c.isLight) scene.remove(c);
    });
  }

  function clearVariantLamppostPool() {
    for (const g of [...variantLeftLampposts, ...variantRightLampposts]) _disposeLamppost(g);
    variantLeftLampposts = [];
    variantRightLampposts = [];
  }
  // ─────────────────────────────────────────────────────────────────────────

  function randomiseBuildingGroup(group, side) {
    const h = BLDG_MIN_H + Math.random() * (BLDG_MAX_H - BLDG_MIN_H);
    const w = BLDG_W_MIN + Math.random() * (BLDG_W_MAX - BLDG_W_MIN);
    const d = BLDG_D_MIN + Math.random() * (BLDG_D_MAX - BLDG_D_MIN);
    // body
    const body = group.children[0];
    body.geometry.dispose();
    body.geometry = new THREE.BoxGeometry(w, h, d);
    body.position.set(0, h / 2, 0); // base sits at y=0 (floor level)
    // window — always dispose before reassigning (symmetric disposal — no mid-game VRAM accumulation)
    const win = group.children[1];
    const hasWindow = Math.random() < 0.55; // ~55% density — bustling night city
    win.geometry.dispose(); // dispose regardless of new state
    if (hasWindow) {
      win.geometry = new THREE.BoxGeometry(w * 0.5, h * 0.25, 0.05);
      win.position.set(0, h * 0.6, d / 2 + 0.01); // front face
      win.visible = true;
    } else {
      win.geometry = new THREE.BufferGeometry(); // cheap empty placeholder
      win.visible = false;
    }
    // X position — inner edge at BLDG_X_INNER, scatter outward.
    // Store as baseX so the render loop can add _worldOffsetX each frame (variant track shift).
    // Note: do NOT read _worldOffsetX here — this function is called during createBuildingPool()
    // which runs before _worldOffsetX is declared. The render loop applies the offset every frame.
    const xOffset = BLDG_X_INNER + w / 2 + Math.random() * BLDG_X_SPREAD;
    group.userData.baseX = side === 'left' ? -xOffset : xOffset;
    group.position.x = group.userData.baseX; // render loop adds _worldOffsetX each frame
  }

  function makeBuildingGroup() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bldgBodyMat);
    const win  = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.05), bldgWindowMat);
    win.visible = false;
    group.add(body, win);
    return group;
  }

  let leftBuildings  = [];
  let rightBuildings = [];
  // Buildings retired during a variant-track transition: locked to old world X, scroll out, then disposed.
  let retiringBuildings = [];
  // Last known world offset applied to the active building pool — used to detect transitions.
  let _bldgTrackedOffsetX = 0;

  // Pre-transition variant-track building pool.  Spawned at proposal time at the variant world
  // offset so buildings are already populated when the player lands on the new track.
  // Adopted as the main pool on acceptance (_worldOffsetX change); despawned on dismissal.
  let variantLeftBuildings  = [];
  let variantRightBuildings = [];
  let _variantBldgOffsetX   = 0;

  // Small random gap between buildings — just enough to avoid perfectly uniform marching.
  const BLDG_GAP_MIN = 0.3;
  const BLDG_GAP_MAX = 1.2;

  // ─── Building gap reservation system ─────────────────────────────────────
  // A reservation is a Z range on one side that buildings must NOT occupy.
  // Placement (initial + recycle) consults active reservations and jumps the
  // candidate Z behind any reservation it would overlap. This is a HARD
  // invariant — there is no "drain over multiple frames" race.
  //
  // To add a gap, call setBuildingGap(id, { poolSide, poolKind, zRangeAt }):
  //   poolSide: 'left' | 'right'    — which pool array (matches building.userData.baseX sign)
  //   poolKind: 'main' | 'variant'  — main pool or pre-transition variant pool
  //   zRangeAt(): () => { z0, z1 }  — world Z, z0 < z1, called each placement check
  //
  // The zRangeAt callback is where ALL gap geometry lives. To change a gap's
  // shape, edit that one closure. Return { z0: -Infinity, z1: -Infinity } to
  // disable the reservation without removing it (e.g. when the anchor piece is
  // briefly null).
  const _bldgReservations = new Map();
  function setBuildingGap(id, spec) { _bldgReservations.set(id, spec); }
  function clearBuildingGap(id) { _bldgReservations.delete(id); }
  function reservationsFor(side, kind) {
    const out = [];
    for (const r of _bldgReservations.values()) {
      if (r.poolSide === side && r.poolKind === kind) out.push(r);
    }
    return out;
  }
  // On adoption (variant pool → main pool), re-tag variant reservations as main
  // so the same Z constraint keeps applying to the same buildings (now in main arrays).
  function _adoptVariantReservations() {
    for (const r of _bldgReservations.values()) {
      if (r.poolKind === 'variant') r.poolKind = 'main';
    }
  }

  // ─── Debug visualiser ────────────────────────────────────────────────────
  // Gated on window.__TEST_MODE (set by ?testMode= URL param in main.js).
  // Renders each active reservation as a translucent ground plane so gap zones
  // are visible in the scene. Disposed automatically when reservation cleared.
  const _gapDebugMeshes = new Map(); // id → Mesh
  function _updateGapDebug() {
    if (typeof window === 'undefined' || !window.__TEST_MODE) {
      if (_gapDebugMeshes.size === 0) return;
      for (const m of _gapDebugMeshes.values()) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      _gapDebugMeshes.clear();
      return;
    }
    // Drop meshes for reservations that no longer exist.
    for (const [id, mesh] of _gapDebugMeshes) {
      if (!_bldgReservations.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        _gapDebugMeshes.delete(id);
      }
    }
    // Add / update meshes for active reservations.
    for (const [id, r] of _bldgReservations) {
      const { z0, z1 } = r.zRangeAt();
      let mesh = _gapDebugMeshes.get(id);
      if (z1 <= z0) { if (mesh) mesh.visible = false; continue; }
      if (!mesh) {
        // Unit-Z plane; scaled per frame to match the reservation's Z extent.
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 1),
          new THREE.MeshBasicMaterial({
            color: r.poolKind === 'variant' ? 0xff00ff : 0x00ffff,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 2;
        scene.add(mesh);
        _gapDebugMeshes.set(id, mesh);
      }
      mesh.visible = true;
      const offsetX  = r.poolKind === 'variant' ? _variantBldgOffsetX : _worldOffsetX;
      const sideSign = r.poolSide === 'right' ? 1 : -1;
      mesh.position.set(
        offsetX + sideSign * (BLDG_X_INNER + BLDG_X_SPREAD / 2),
        0.05,
        (z0 + z1) / 2,
      );
      mesh.scale.set(1, z1 - z0, 1); // PlaneGeometry depth = 1 (along Z post-rotation)
    }
  }

  // Place a single building just behind the rearmost building in its pool array,
  // jumping behind any reservation that the candidate Z would overlap.
  // cursorZ must be the rear FACE Z of the reference point (not a centre), or null
  // to derive from the pool's rearmost building.
  // Returns the rear face Z of the newly placed building for chaining.
  function placeBuildingBehindPool(g, side, arr, cursorZ, kind = 'main') {
    randomiseBuildingGroup(g, side);
    const d = g.children[0].geometry.parameters.depth;
    const gap = BLDG_GAP_MIN + Math.random() * (BLDG_GAP_MAX - BLDG_GAP_MIN);
    let rearFaceZ;
    if (cursorZ !== null) {
      rearFaceZ = cursorZ;
    } else {
      const rearmost = arr.reduce((a, b) => a.position.z < b.position.z ? a : b);
      rearFaceZ = rearmost.position.z - rearmost.children[0].geometry.parameters.depth / 2;
    }
    let frontFaceZ = rearFaceZ - gap;
    // Skip any reservation this candidate would overlap. Sort z1 desc so we jump
    // behind the rearmost (highest z1) reservation first — handles adjacent gaps.
    const res = reservationsFor(side, kind)
      .map(r => r.zRangeAt())
      .filter(({ z0, z1 }) => z1 > z0)
      .sort((a, b) => b.z1 - a.z1);
    for (const { z0, z1 } of res) {
      // Building occupies [frontFaceZ - d, frontFaceZ]. Overlap iff frontFaceZ > z0 AND (frontFaceZ - d) < z1.
      if (frontFaceZ > z0 && frontFaceZ - d < z1) {
        frontFaceZ = z0 - gap;
      }
    }
    g.position.z = frontFaceZ - d / 2;  // centre
    return frontFaceZ - d;              // new rear face (cursor for next)
  }

  function createBuildingPool() {
    leftBuildings  = [];
    rightBuildings = [];
    // Chain buildings from BLDG_NEAR_CUTOFF backward for each side independently.
    for (const [arr, side] of [[leftBuildings, 'left'], [rightBuildings, 'right']]) {
      let cursor = BLDG_NEAR_CUTOFF; // start just in front of the near-cutoff gap
      for (let i = 0; i < BLDG_POOL_SIZE; i++) {
        const g = makeBuildingGroup();
        cursor = placeBuildingBehindPool(g, side, arr, cursor, 'main');
        scene.add(g);
        arr.push(g);
      }
    }
  }

  // Pre-transition variant-track building pool: spawned at proposal time so the variant
  // skyline is populated before the player lands.  Adopted as main pool on acceptance.
  function createVariantBuildingPool(offsetX) {
    clearVariantBuildingPool();
    _variantBldgOffsetX = offsetX;
    // Populate both sides — offsetX is the variant track centre so ±baseX places
    // buildings symmetrically on both sides of the variant track.
    for (const [arr, side] of [[variantLeftBuildings, 'left'], [variantRightBuildings, 'right']]) {
      let cursor = BLDG_NEAR_CUTOFF;
      for (let i = 0; i < BLDG_POOL_SIZE; i++) {
        const g = makeBuildingGroup();
        cursor = placeBuildingBehindPool(g, side, arr, cursor, 'variant');
        g.position.x = g.userData.baseX + offsetX;
        scene.add(g);
        arr.push(g);
      }
    }
  }

  function clearVariantBuildingPool() {
    for (const g of [...variantLeftBuildings, ...variantRightBuildings]) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    variantLeftBuildings = [];
    variantRightBuildings = [];
  }

  // Reservation-based recycle: each building is respawned behind the pool if
  // it (a) passes the cull plane, or (b) overlaps any active gap reservation
  // on its side. placeBuildingBehindPool() jumps over reservations so the
  // respawn point itself can never land inside a gap.
  //
  // To add/modify/remove a gap, use setBuildingGap / clearBuildingGap.
  // All gap geometry lives in the reservation's zRangeAt() closure.
  function recyclePool(arr, side, kind, offsetX, bldgDelta, skipGaps = false) {
    const res = skipGaps ? [] : reservationsFor(side, kind);
    for (const g of arr) {
      g.position.z += bldgDelta;
      g.position.x = g.userData.baseX + offsetX;
      const cz = g.position.z;
      const d  = g.children[0].geometry.parameters.depth;
      let inGap = false;
      for (const r of res) {
        const { z0, z1 } = r.zRangeAt();
        if (z1 > z0 && cz + d / 2 > z0 && cz - d / 2 < z1) { inGap = true; break; }
      }
      if (cz > BLDG_CULL_Z || inGap) {
        const rear = arr.reduce((a, b) => a.position.z < b.position.z ? a : b);
        const rearFaceZ = rear.position.z - rear.children[0].geometry.parameters.depth / 2;
        placeBuildingBehindPool(g, side, arr, rearFaceZ, kind);
        g.position.x = g.userData.baseX + offsetX;
      }
    }
  }

  // Commit a pending building/lamppost world-offset transition.
  // Called explicitly at traversal completion and as a safety net in clearVariantGeom().
  // Never called from the per-frame scroll block — that block only reads _bldgTrackedOffsetX.
  function _commitBuildingTransition() {
    if (_worldOffsetX === _bldgTrackedOffsetX) return;
    retiringBuildings.push(...leftBuildings, ...rightBuildings);
    if (variantLeftBuildings.length > 0) {
      leftBuildings  = variantLeftBuildings;
      rightBuildings = variantRightBuildings;
      variantLeftBuildings  = [];
      variantRightBuildings = [];
      _adoptVariantReservations();
      clearBuildingGap('main-propose');
    } else {
      createBuildingPool();
    }
    for (const g of [...leftBuildings, ...rightBuildings]) {
      g.position.x = g.userData.baseX + _worldOffsetX;
    }
    // Lampposts: transfer the SpotLights from the old main pool onto the light-less
    // variant preview lamps, then adopt the preview pool as the new main pool.
    // Reparenting the lights keeps the total scene light count constant (no shader
    // recompile / lag spike), and the preview lamps the player saw during the ride
    // stay exactly in place — so the cast light turns on without a positional pop.
    if (variantLeftLampposts.length > 0) {
      for (const [oldArr, newArr] of [
        [leftLampposts, variantLeftLampposts],
        [rightLampposts, variantRightLampposts],
      ]) {
        for (let i = 0; i < newArr.length; i++) {
          const donor = oldArr[i];
          if (donor && donor.userData.spot) {
            const spot = donor.userData.spot;
            donor.remove(spot, spot.target);
            newArr[i].add(spot, spot.target);
            newArr[i].userData.spot         = spot;
            newArr[i].userData.hasFlicker   = donor.userData.hasFlicker;
            newArr[i].userData.flickerPhase = donor.userData.flickerPhase;
            newArr[i].userData.flickerHz    = donor.userData.flickerHz;
            donor.userData.spot = null;
          }
        }
        for (const g of oldArr) _disposeLamppost(g); // old lamps now light-less
      }
      leftLampposts  = variantLeftLampposts;
      rightLampposts = variantRightLampposts;
      variantLeftLampposts  = [];
      variantRightLampposts = [];
      for (const g of [...leftLampposts, ...rightLampposts]) {
        g.position.x = g.userData.baseX + _worldOffsetX;
      }
    }
    _bldgTrackedOffsetX = _worldOffsetX;
  }

  createBuildingPool();
  createLamppostPool();  // story 7-3
  // ─────────────────────────────────────────────────────────────────────────

  const bodyMatByColour = new Map();
  function bodyMaterial(colourHex) {
    let m = bodyMatByColour.get(colourHex);
    if (!m) {
      m = applyWorldCurve(new THREE.MeshStandardMaterial({ color: colourHex, dithering: true }));
      bodyMatByColour.set(colourHex, m);
    }
    return m;
  }

  function makeCart(bodyMat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.3), bodyMat);
    body.position.y = 0.45;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.4), roofMat);
    roof.position.y = 0.9;
    g.add(roof);
    return g;
  }

  function makeFretLabel(message) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.strokeText(message, 32, 32);
    ctx.fillText(message, 32, 32);
    // Upright textured quad (not a Sprite): a Sprite billboards via three's
    // SpritePlugin and cannot be touched by the world-curve vertex shader, so it
    // floats off the dropped track. A curve-wrapped mesh laid FLAT on the track reads
    // poorly at the camera's shallow pitch. So we stand it VERTICAL like a little
    // sign: being thin in Z, the bend translates it straight down onto the curve
    // (same as buildings) while keeping it upright and readable. Parent safe zone is
    // rotated -π/2, so rotation.x=+π/2 cancels that → the quad stands world-upright
    // facing the camera (+Z). Local +Z maps to world +Y, so position z raises the
    // quad's base onto the track. renderOrder draws it over fill + border.
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      applyWorldCurve(new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, 0, 0.4);
    mesh.renderOrder = 2;
    return mesh;
  }

  // ─── Character sprite (story 7-6) ───────────────────────────────────────────
  // Generates a procedural placeholder pixel-art running character (4 frames)
  // drawn on canvases. Used when the real .gif asset is unavailable.
  function generatePlaceholderFrames(count = 4, size = 24) {
    const frames = [];
    const cx = size / 2, cy = size / 2;
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      // Body colour — dark silhouette with ACCENT glow
      ctx.fillStyle = '#222';
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 1.5;
      // Head (circle)
      ctx.beginPath(); ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Torso (rectangle)
      ctx.fillRect(cx - 3, cy - 1, 6, 8);
      ctx.strokeRect(cx - 3, cy - 1, 6, 8);
      // Legs — animated based on frame
      const legSwing = [0, 2, 0, -2][i];
      ctx.fillRect(cx - 4, cy + 7, 3, 5 + legSwing);
      ctx.fillRect(cx + 1, cy + 7, 3, 5 - legSwing);
      ctx.strokeRect(cx - 4, cy + 7, 3, 5 + legSwing);
      ctx.strokeRect(cx + 1, cy + 7, 3, 5 - legSwing);
      // Arms
      const armSwing = [0, -2, 0, 2][i];
      ctx.fillRect(cx - 6, cy, 3, 3 + armSwing);
      ctx.fillRect(cx + 3, cy, 3, 3 - armSwing);
      frames.push(c);
    }
    return frames;
  }

  // Build the character sprite frame array, using the real asset if available
  // or falling back to the procedural placeholder. Each frame is an HTMLCanvasElement.
  // THIS FUNCTION IS CALLED ASYNCHRONOUSLY (CharacterSpriteFrames) — the sprite
  // renders a placeholder until the real asset loads.
  let _spriteFrames = null;   // Array<HTMLCanvasElement>
  let _spriteFrameDelays = null; // Array<number> — ms per frame (from GIF)
  let _spriteFramesReady = false;  // true once frames are loaded and drawable

  function initSpriteFrames() {
    _spriteFrames = generatePlaceholderFrames(CHARACTER_FRAME_COUNT, 24);
    _spriteFrameDelays = null;
    _spriteFramesReady = true;

    // Attempt to load the real animated GIF asynchronously; on success, replace frames.
    fetch(CHARACTER_SPRITE_PATH)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buf => {
        const { frames, delays } = parseGifFrames(buf);
        if (frames.length >= 1) {
          _spriteFrames = frames;
          _spriteFrameDelays = delays;
          _frameTimelineFn = _frameTimeline(delays);
        }
      })
      .catch(() => { /* fallback: keep placeholder */ });
  }
  initSpriteFrames();

  // Create the character sprite mesh. Replaces the old CapsuleGeometry (story 7-6).
  // Uses a PlaneGeometry (not THREE.Sprite) so the feet anchor at world y=0 and
  // there's no screen-aligned X parallax at lane edges. Manually billboarded in
  // render() to always face the camera.
  const characterGeometry = new THREE.PlaneGeometry(1, 1);
  // Shift geometry origin to bottom edge so that position.y drives foot height.
  characterGeometry.translate(0, 0.5, 0);
  const character = new THREE.Mesh(characterGeometry, new THREE.MeshBasicMaterial({
    map: null,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    depthTest: true,
  }));
  character.renderOrder = 999; // draw after all safe-zone planes (default renderOrder=0)
  // 4× larger than original capsule proxy (0.7 → 2.8) for readable pixel art at gameplay scale.
  character.scale.set(2.8, 2.8, 1);
  // The sprite sheet (Character_running_north.gif, 124×124) has 31 px of transparent
  // padding below the feet. At scale 2.8, those pixels occupy 31/124 × 2.8 ≈ 0.70
  // world units. Without correction the character floats 0.70 units above the track.
  // Offsetting position.y by -0.70 brings the visual feet to y = 0 (track surface).
  const CHAR_FOOT_Y = -0.70;
  character.position.set(0, CHAR_FOOT_Y, FRONT_Z + 0.1);
  scene.add(character);

  let _charLastFrameIdx = -1;

  // Timeline-based frame advancement. Uses GIF per-frame delays (which include
  // the accumulated display time of all prior frames) when available; falls back
  // to uniform CHARACTER_FRAME_DURATION for placeholder frames.
  function _frameTimeline(delays) {
    if (delays && delays.length > 0) {
      // Build cumulative timeline from per-frame delays
      let total = 0;
      const tl = delays.map(d => { total += d; return total; });
      return (elapsed, len) => {
        const t = elapsed % total;
        for (let i = 0; i < tl.length; i++) {
          if (t < tl[i]) return i % len;
        }
        return 0;
      };
    } else {
      // Uniform frame durations (placeholder)
      const dur = CHAR_FRAME_DURATION;
      return (elapsed, len) => Math.floor(elapsed / dur) % len;
    }
  }

  let _frameTimelineFn = _frameTimeline(null);

  // Update the character sprite's texture for the current game-time frame.
  // Called from render() each tick — only triggers texture upload on frame change.
  function updateCharacterSprite(nowGameMs) {
    if (!_spriteFramesReady || !_spriteFrames || _spriteFrames.length === 0) return;
    const elapsed = nowGameMs - gameStartTime;
    const frameIdx = _frameTimelineFn(elapsed, _spriteFrames.length);
    if (frameIdx !== _charLastFrameIdx) {
      _charLastFrameIdx = frameIdx;
      const tex = new THREE.CanvasTexture(_spriteFrames[frameIdx]);
      tex.colorSpace = THREE.SRGBColorSpace; // canvas pixels are sRGB — correct identity pipeline
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      character.material.map = tex;
      character.material.needsUpdate = true;
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  let instrument = null;
  let tracks = []; // { mesh, label }
  let activeWaves = new Map(); // wave_id -> { mesh, data }

  // Variant peel transition (feature 008-track-variants, story 5-5).
  // One bent piece scrolls in (propose) or out (dismiss); straight lane segs fill the gap.
  let variantProposePiece = null;   // { mesh: Group, spawnTimeMs, speedPxMs }
  let variantDismissPiece = null;   // { mesh: Group, spawnTimeMs, speedPxMs }
  let variantInfo = null;           // { side, variantX }
  let variantSafeZoneMesh = null;         // safe zone fill plane on variant lane (story 5-7)
  let variantSafeZoneBorderMesh = null;   // neon border LineSegments for variant safe zone (story 7-0)
  let variantAcceptState = null;    // { newPrimary, acceptX, characterMoved } — tracks accept animation
  let lastWaveSpeed = 0.05;         // captured from setWaves; used for piece scrolling
  let onVariantMissedCb = null;     // registered from main.js (story 5-8, AC-2)
  let _savedMissCb = null;          // remembered original handler — re-armed on next propose (Story 6-8)
  let _variantMissFired = false;    // cb fires once at SZ-pass; cleanup deferred until off-frame
  let lastVariantTickMs = 0;        // last render tick that saw a variant SZ — for tab-resume guard

  let tween = null;
  let succeeded = false;
  let lastTime = 0;
  let gameStartTime = 0;
  let baseFret = 0;
  let numLanes = 6;

  // Camera constants (Story 6.3)
  const CAMERA_BEND_YAW_MAX = 12 * Math.PI / 180;
  const CAMERA_LOOK_AHEAD_Z = 5;
  const CAMERA_RESET_DURATION_MS = 500;

  // Cinematic refinement constants (Story 6.8 rewrite)
  const MAX_BEND_YAW = Math.PI / 4;          // 45° — character snap & camera target
  const DIAG_CROSS_MS = 1200;                // X crossing duration (breather window)
  const FIRST_WAVE_ARRIVAL_DELAY_MS = 500;   // ms after landing before first new-scale wave
  const REPOSITION_SLIDE_MS = 200;           // quick slide to variant note fret after landing
  const CAMERA_YAW_RATE = 0.02;              // rad/frame camera ease rate

  let _cameraMode = 'default';
  let _cameraResetStartMs = 0;
  let _cameraResetStartYaw = 0;
  let _targetCamYaw = 0;
  let _currentCamYaw = 0;

  // Cinematic exit (Story 6.8 AC-6): synchronized time-based lerp.
  let _cinematicExit = null; // { startMs, durMs, fromCamYaw, fromCharYaw, fromX, targetX }

  // World-space X offset applied to lane positions, cart positions, collision safeX,
  // and moveToTrack targets after a variant transition (Story 6.8 AC-5). Set by
  // spawnVariantTracks(centerX). Reset to 0 on scene reset / setInstrument.
  let _worldOffsetX = 0;

  // Pending tracks — new-scale track meshes scrolling in from horizon (Story 6.4)
  let _pendingTracks = [];         // [{ mesh, targetZ, speedPxMs }]
  let _tracksLandedCb = null;
  let _tracksLandedFired = false;
  // Pre-variant lane meshes kept visible during the cinematic; removed at the
  // finalize step (post-promote) so the old + new track sets coexist during
  // the ride rather than blinking out the moment new tracks start scrolling in.
  let _retiringTracks = [];

  function clearWaves() {
    for (const w of activeWaves.values()) {
      scene.remove(w.mesh);
    }
    activeWaves.clear();
  }

  function clearScene() {
    for (const t of tracks) {
      scene.remove(t.mesh);
    }
    tracks = [];
    for (const t of _retiringTracks) {
      scene.remove(t.mesh);
      t.mesh.geometry?.dispose?.();
    }
    _retiringTracks = [];
    clearWaves();
  }

  function rebuildTracks() {
    const count = numLanes;
    for (let i = 0; i < count; i++) {
      const x = laneX(i, count) + _worldOffsetX;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH, 1, 1, 64),
        trackMat
      );
      // Front edge at z=20 — well past the camera (camera.z ≈ 11) so the near end
      // is out of frame and tracks read as continuous.
      mesh.position.set(x, -0.05, -TRACK_DEPTH / 2 + 20);
      scene.add(mesh);

      tracks.push({ mesh });
    }
    targetCameraX = _worldOffsetX;
    currentCameraX = _worldOffsetX;
  }

  function reset() {
    clearWaves();
    clearVariantGeom();
    tween = null;
    _charTraversal = null;
    _bendMidpointCb = null;
    _bendMidpointFired = false;
    _cameraMode = 'default';
    _cameraResetStartMs = 0;
    _cameraResetStartYaw = 0;
    _targetCamYaw = 0;
    _currentCamYaw = 0;
    if (window.__gameState?.scene) window.__gameState.scene.transitionRideProgress = undefined;
    for (const pt of _pendingTracks) { scene.remove(pt.mesh); }
    _pendingTracks = [];
    for (const rt of _retiringTracks) { scene.remove(rt.mesh); }
    _retiringTracks = [];
    _tracksLandedCb = null;
    _tracksLandedFired = false;
    succeeded = false;
    _worldOffsetX = 0;
    _cinematicExit = null;
    // Dispose character sprite texture to prevent GPU memory accumulation on replay (story 7-6).
    if (character.material.map) { character.material.map.dispose(); character.material.map = null; }
    _charLastFrameIdx = -1;
    character.position.set(laneX(0, numLanes), CHAR_FOOT_Y, FRONT_Z + 0.1);
    character.rotation.set(0, 0, 0);
    targetCameraX = 0;
    currentCameraX = 0;

    // Recreate floor tiles (story 7-1) — dispose old, spawn fresh at initial positions.
    for (const tile of floorTiles) {
      scene.remove(tile);
      tile.geometry.dispose();
    }
    floorMat.dispose();
    floorMat = applyWorldCurve(new THREE.MeshPhysicalMaterial({ color: COLORS.BG_VOID, roughness: 1.0, metalness: 0.0, dithering: true }));
    floorTiles = [makeFloorTile(), makeFloorTile()];
    floorTiles[0].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z);
    floorTiles[1].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z);
    floorTiles.forEach(t => scene.add(t));

    // Dispose buildings (story 7-2) — remove all groups, dispose geometries and shared materials.
    for (const g of [...leftBuildings, ...rightBuildings]) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    // Also dispose variant pre-transition pool and any retiring buildings.
    clearVariantBuildingPool();
    for (const g of retiringBuildings) {
      scene.remove(g);
      for (const child of g.children) child.geometry.dispose();
    }
    retiringBuildings = [];
    bldgBodyMat.dispose();
    bldgWindowMat.dispose();
    bldgBodyMat = applyWorldCurve(new THREE.MeshStandardMaterial({
      color: COLORS.BG_NEAR,
      flatShading: true,
      dithering: true,
    }));
    bldgWindowMat = applyWorldCurve(new THREE.MeshStandardMaterial({
      color: COLORS.TEXT_PRIMARY,
      emissive: COLORS.TEXT_PRIMARY,
      emissiveIntensity: 0.6,
      flatShading: true,
      dithering: true,
    }));
    _bldgTrackedOffsetX = 0;
    createBuildingPool();

    // Dispose lampposts (story 7-3)
    for (const g of [...leftLampposts, ...rightLampposts]) {
      scene.remove(g);
      g.traverse(c => {
        if (c.isMesh) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material?.dispose();
        }
        if (c.isSpotLight) {
          c.dispose();
          scene.remove(c.target);
        }
        if (c.isLight) scene.remove(c);
      });
    }
    lampPoleMat.dispose();
    lampHeadMat.dispose();
    lampPoleMat = applyWorldCurve(new THREE.MeshStandardMaterial({ color: COLORS.EDGE, flatShading: true, dithering: true }));
    lampHeadMat = applyWorldCurve(new THREE.MeshStandardMaterial({ color: COLORS.ACCENT, emissive: COLORS.ACCENT, emissiveIntensity: 0.8, flatShading: true, dithering: true }));
    leftLampposts = [];
    rightLampposts = [];
    clearVariantLamppostPool();
    createLamppostPool();
  }

  // ─── Variant geometry helpers (story 5-5) ─────────────────────────────────

  // Returns a Three.js Group with 3 baked pieces forming a lane switch:
  // incoming diagonal → straight (parallel) section → outgoing diagonal.
  // The group translates only in Z at runtime. No runtime rotation.
  // side: "LEFT"|"RIGHT" — which side the diagonals exit toward.
  // variantX: world X of the straight section centre.
  function buildVariantTrackGroup(side, variantX) {
    const mat = trackMat;
    const group = new THREE.Group();
    const sign = side === 'RIGHT' ? 1 : -1;
    // Outgoing diagonal (back — arrives last): 45° peel from variant lane off-screen.
    const outgoing = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, DIAG_LEN * 1.414, 1, 1, 32), mat);
    outgoing.rotation.set(0, sign * -Math.PI / 4, 0);
    outgoing.position.set(variantX + sign * DIAG_LEN * 0.5, 0, -(STRAIGHT_LEN / 2 + DIAG_LEN * 0.5));
    group.add(outgoing);
    // Straight section: player-facing end at highest local Z (first to reach player).
    const straight = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, STRAIGHT_LEN, 1, 1, 32), mat);
    straight.position.set(variantX, 0, 0);
    group.add(straight);
    // Incoming diagonal (front — arrives first): 45° peel from main-track area to variant lane.
    const incoming = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, DIAG_LEN * 1.414, 1, 1, 32), mat);
    incoming.rotation.set(0, sign * -1 * -Math.PI / 4, 0);
    incoming.position.set(variantX + sign * DIAG_LEN * 0.5, 0, STRAIGHT_LEN / 2 + DIAG_LEN * 0.5);
    group.add(incoming);
    return group;
  }

  function clearVariantGeom() {
    _commitBuildingTransition(); // safety net: flush any pending env swap before clearing state
    clearVariantBuildingPool();
    clearVariantLamppostPool(); // story 7-3 fix
    clearBuildingGap('main-propose');
    clearBuildingGap('main-dismiss');
    clearBuildingGap('variant-outgoing');
    if (variantProposePiece) {
      scene.remove(variantProposePiece.mesh);
      variantProposePiece.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
      variantProposePiece = null;
    }
    if (variantDismissPiece) {
      scene.remove(variantDismissPiece.mesh);
      variantDismissPiece.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
      variantDismissPiece = null;
    }
    if (variantSafeZoneMesh) {
      scene.remove(variantSafeZoneMesh);
      variantSafeZoneMesh.geometry?.dispose();
      variantSafeZoneMesh.material?.dispose();
      variantSafeZoneMesh = null;
    }
    if (variantSafeZoneBorderMesh) {
      scene.remove(variantSafeZoneBorderMesh);
      variantSafeZoneBorderMesh.geometry?.dispose();
      variantSafeZoneBorderMesh.material?.dispose();
      variantSafeZoneBorderMesh = null;
    }
    variantAcceptState = null;
    variantInfo = null;
    _charTraversal = null;
    _bendMidpointCb = null;
    _bendMidpointFired = false;
    character.position.z = FRONT_Z + 0.1;
    character.rotation.y = 0;
  }

  // Remove only track lane meshes — preserves activeWaves (in-flight old-scale wave meshes).
  function clearTracks() {
    for (const t of tracks) { scene.remove(t.mesh); }
    tracks = [];
  }

  // Spawn new-scale track meshes at SPAWN_Z and scroll them toward rest position (Story 6.4).
  function spawnVariantTracks(newBaseFret, newNumLanes, speedPxMs, centerX = 0) {
    // Defer old-track removal to finalizeVariantTransition() — old lanes stay
    // visible until the cinematic completes. Move current tracks into a holding
    // list; `tracks` only collects the new pending ones once they land.
    _retiringTracks = _retiringTracks.concat(tracks);
    tracks = [];
    _pendingTracks = [];
    _tracksLandedFired = false;
    _worldOffsetX = centerX;
    for (let i = 0; i < newNumLanes; i++) {
      const x = laneX(i, newNumLanes) + centerX;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH, 1, 1, 64), trackMat);
      mesh.position.set(x, -0.05, SPAWN_Z);
      scene.add(mesh);
      _pendingTracks.push({ mesh, targetZ: -TRACK_DEPTH / 2 + 20, speedPxMs });
    }
    baseFret = newBaseFret;
    numLanes = newNumLanes;
  }

  function areTracksLanded() {
    if (_pendingTracks.length === 0) return false;
    return _pendingTracks.every(pt => pt.mesh.position.z <= pt.targetZ + 1);
  }

  function setOnTracksLanded(cb) {
    _tracksLandedCb = cb;
    _tracksLandedFired = false;
  }

  function _variantLaneX(side, anchorFret, anchorNoteLane) {
    const sign = side === 'RIGHT' ? 1 : -1;
    // Place variant 2 lanes outside the anchor note's lane. No clamp:
    // the variant must sit beyond the main track range (1-track gap expected).
    // _worldOffsetX folded in so subsequent variants spawn in the current frame.
    if (anchorNoteLane != null) {
      return laneX(anchorNoteLane + sign * 2, numLanes) + _worldOffsetX;
    }
    if (anchorFret != null) {
      const lane = (anchorFret - baseFret) + sign * 2;
      return laneX(lane, numLanes) + _worldOffsetX;
    }
    // Fallback when wave not yet known: 2 lane widths beyond the edge.
    const edgeLane = side === 'RIGHT' ? numLanes - 1 : 0;
    return laneX(edgeLane, numLanes) + sign * 2 * LANE_X_SCALE + _worldOffsetX;
  }

  // Drop retiring (pre-variant) lane meshes and all ghosted wave meshes at the
  // end of the cinematic. Called from main.js applyPromoteResponse.
  function finalizeVariantTransition() {
    // Commit the pending building/lamppost world-offset swap at landing — the same
    // moment old tracks are dropped. Without this, the riding/accept flow (which has
    // no dismiss piece) defers the commit to the next propose's clearVariantGeom(),
    // leaving the main lamppost pool stranded at the old offset so the variant track
    // has no lampposts until the next proposal. Idempotent (early-returns if already
    // committed); the building pool's variant stand-in masked this for buildings.
    _commitBuildingTransition();
    for (const t of _retiringTracks) {
      scene.remove(t.mesh);
      t.mesh.geometry?.dispose?.();
    }
    _retiringTracks = [];
    for (const [id, w] of Array.from(activeWaves.entries())) {
      if (w.ghost) {
        scene.remove(w.mesh);
        activeWaves.delete(id);
      }
    }
  }

  function proposeVariantTracks(variant, transitionWave, anchorNote, anchorWave) {
    clearVariantGeom();
    _variantMissFired = false;
    // Re-arm the missed callback in case a prior transition's
    // disableVariantMissCallback() nulled it — without this, dismissing the new
    // variant only removes the SZ mesh and leaves the propose-piece orphaned.
    if (_savedMissCb && !onVariantMissedCb) onVariantMissedCb = _savedMissCb;
    // Anchor note: note at wave.note_index - 1 (apex for RIGHT, root for LEFT).
    // Color matches the anchor note's string. Position is 2 lanes from anchor.
    const anchorFret = anchorNote?.fret ?? transitionWave?.safe_fret;
    const anchorNoteLane = (anchorNote?.fret != null) ? (anchorNote.fret - baseFret) : null;
    if (!anchorNote) {
      console.warn('[variant] anchor note missing — color/X may be off', { variant, transitionWave });
    }
    const anchorString = anchorNote?.string;
    const vx = _variantLaneX(variant.side, anchorFret, anchorNoteLane);
    // Align variant Z with the TARGET wave's safezone (the wave one note after
    // the anchor). The variant safezone should sit adjacent to that safezone,
    // not the anchor's, so the player accepts on the wave following root/apex.
    const timingWave = transitionWave ?? anchorWave;
    const spawnMs = timingWave?.spawn_time_ms ?? (performance.now() - gameStartTime);
    const speedPxMs = timingWave?.speed_px_per_ms ?? lastWaveSpeed;
    const nowGameMs = performance.now() - gameStartTime;

    const mesh = buildVariantTrackGroup(variant.side, vx);
    // Unclamped elapsed: while the start time is still in the future this is negative,
    // so the piece spawns FURTHER BACK than SPAWN_Z and scrolls forward during the
    // wait, crossing SPAWN_Z at exactly its scheduled moment. Timing from SPAWN_Z
    // onward (the whole gameplay-visible journey) is unchanged; the piece simply
    // emerges from the fog instead of sitting parked at SPAWN_Z.
    const geomElapsed = nowGameMs - spawnMs;
    mesh.position.set(0, 0, SPAWN_Z + geomElapsed * speedPxMs * 0.5);
    scene.add(mesh);
    variantProposePiece = { mesh, spawnTimeMs: spawnMs, speedPxMs };
    variantInfo = { side: variant.side, variantX: vx, speedPxMs };

    // Pre-populate buildings at the approximate variant track centre so the skyline is
    // ready when the player lands.  Formula mirrors main.js newScaleCenterX:
    //   landingX = vx + sign * DIAG_LEN  (X where player lands after the diagonal)
    //   centre   = landingX + sign * (numLanes - 1) / 2 * LANE_W
    // Using current numLanes as a proxy for newLanes — snapped to exact _worldOffsetX
    // on acceptance so any residual delta is invisible.
    const _vbSign = variantInfo.side === 'RIGHT' ? 1 : -1;
    const _vbLandingX = vx + _vbSign * DIAG_LEN;
    const _vbCenterX = _vbLandingX + _vbSign * (numLanes - 1) / 2 * LANE_W;

    // ─── Building gap reservations ───────────────────────────────────────────
    // Register BEFORE createVariantBuildingPool so the variant pool spawns clean.
    // Each closure owns all geometry for its gap — edit here to change shape/anchor.
    const _vSideLower = variant.side === 'RIGHT' ? 'right' : 'left';
    const _innerLower = variant.side === 'RIGHT' ? 'left'  : 'right';

    // Main pool gap on the variant side — clears the piece's outgoing-diagonal +
    // straight-section span so main buildings don't clip through the propose piece.
    setBuildingGap('main-propose', {
      poolSide: _vSideLower,
      poolKind: 'main',
      zRangeAt: () => {
        if (!variantProposePiece) return { z0: -Infinity, z1: -Infinity };
        const pz = variantProposePiece.mesh.position.z;
        // Width 25, centred on outgoing-diagonal midpoint (pz − (STRAIGHT_LEN + DIAG_LEN) / 2).
        return { z0: pz - 50, z1: pz - 35 };
      },
    });

    // Variant pool gap on the inner side — clears the outgoing diagonal's Z extent
    // so the variant skyline doesn't clip through the diagonal that the character
    // rides during the transition.
    setBuildingGap('variant-outgoing', {
      poolSide: _innerLower,
      poolKind: 'variant',
      zRangeAt: () => {
        if (!variantProposePiece) return { z0: -Infinity, z1: -Infinity };
        const pz = variantProposePiece.mesh.position.z;
        // Width 25, centred 10 units behind outgoing-diagonal midpoint.
        return { z0: pz - 70, z1: pz - 55 };
      },
    });

    createVariantBuildingPool(_vbCenterX);
    createVariantLamppostPool(_vbCenterX); // story 7-3 fix — preview lamps on variant track

    // Palette index for variant safe zone colours (story 7-0).
    // Uses STRING_SAFE_ZONE_FILLS for fill and STRING_COLORS for the neon border.
    const stringCount = instrument?.stringCount ?? 6;
    const paletteIdx = stringToLaneIndex(anchorString, stringCount);
    // Safe zone fill — dim translucent plane using STRING_SAFE_ZONE_FILLS (story 7-0).
    const szGeo = new THREE.PlaneGeometry(1.2, VARIANT_SZ_DEPTH, 1, 16);
    const fillColor = paletteIdx < STRING_SAFE_ZONE_FILLS.length
      ? STRING_SAFE_ZONE_FILLS[paletteIdx]
      : STRING_SAFE_ZONE_FILLS[0];
    const borderColor = paletteIdx < STRING_COLORS.length
      ? STRING_COLORS[paletteIdx]
      : STRING_COLORS[0];
    const szMat = applyWorldCurve(new THREE.MeshStandardMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
      dithering: true,
    }));
    const szMesh = new THREE.Mesh(szGeo, szMat);
    szMesh.renderOrder = 0;
    szMesh.rotation.x = -Math.PI / 2;
    szMesh.userData.spawnMs = spawnMs;
    szMesh.userData.speedPxMs = speedPxMs;
    // Variant note value the safe zone expects — used by getActiveSafeZones (Story 6.8 T12).
    if (anchorFret != null) {
      const fretOffset = variant.side === 'RIGHT' ? 2 : -2;
      szMesh.userData.variantNote = anchorFret + fretOffset;
    }
    // Unclamped (negative while waiting) so the safe zone spawns further back and
    // scrolls in lockstep with the propose track piece — emerging from the fog rather
    // than parked at SPAWN_Z. Match SafeZoneRenderer Z: SPAWN_Z + elapsed*speed*0.5 +
    // DEPTH/2. Without the +DEPTH/2 offset the variant safezone trails by half a depth.
    const szElapsed = nowGameMs - spawnMs;
    const szInitialZ = SPAWN_Z + szElapsed * speedPxMs * 0.5 + VARIANT_SZ_DEPTH / 2;
    // Variant tracks sit at y=0 (top surface +0.03). Use y=0.15 to match the
    // clearance SafeZoneRenderer gives primary zones above main tracks (y=-0.05, top=-0.02).
    szMesh.position.set(vx, 0.15, szInitialZ);
    if (anchorFret != null) {
      const fretOffset = variant.side === 'RIGHT' ? 2 : -2;
      const label = makeFretLabel((anchorFret + fretOffset).toString());
      szMesh.add(label);
    }
    scene.add(szMesh);
    variantSafeZoneMesh = szMesh;

    // Safe zone border — EdgesGeometry neon outline (story 7-0).
    // EdgesGeometry on PlaneGeometry = 4 perimeter edges, no internal diagonals.
    const szBorderMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(szGeo),
      applyWorldCurve(new THREE.LineBasicMaterial({ color: borderColor }))
    );
    szBorderMesh.renderOrder = 1;
    szBorderMesh.rotation.x = -Math.PI / 2;
    szBorderMesh.position.set(vx, 0.16, szInitialZ);
    scene.add(szBorderMesh);
    variantSafeZoneBorderMesh = szBorderMesh;
  }

  // Dismiss-piece gap on the inner side of the (post-adoption) main pool — clears
  // the outgoing-diagonal + straight-section span so the dismiss piece doesn't
  // clip through the buildings it scrolls past.
  function _registerDismissGap() {
    if (!variantInfo) return;
    const innerLower = variantInfo.side === 'RIGHT' ? 'left' : 'right';
    setBuildingGap('main-dismiss', {
      poolSide: innerLower,
      poolKind: 'main',
      zRangeAt: () => {
        if (!variantDismissPiece) return { z0: -Infinity, z1: -Infinity };
        const pz = variantDismissPiece.mesh.position.z;
        // Width 25, centred on outgoing-diagonal midpoint.
        return { z0: pz - 65, z1: pz - 40 };
      },
    });
  }

  function dismissVariantTracks() {
    if (!variantInfo || variantDismissPiece) return;
    const spawnTimeMs = performance.now() - gameStartTime;
    const mesh = buildVariantTrackGroup(variantInfo.side, variantInfo.variantX);
    mesh.position.set(0, 0, SPAWN_Z);
    scene.add(mesh);
    variantDismissPiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
    _registerDismissGap();
  }

  function acceptVariantTracks(newPrimary, notes = [], startIndex = 0) {
    if (!variantInfo) {
      clearScene();
      baseFret = newPrimary.base_fret;
      numLanes = newPrimary.num_lanes;
      rebuildTracks();
      return;
    }
    const edgeLane = variantInfo.side === 'RIGHT' ? newPrimary.num_lanes - 1 : 0;
    const acceptX = laneX(edgeLane, newPrimary.num_lanes);
    if (!variantDismissPiece) {
      const spawnTimeMs = performance.now() - gameStartTime;
      const mesh = buildVariantTrackGroup(variantInfo.side, variantInfo.variantX);
      mesh.position.set(0, 0, SPAWN_Z);
      scene.add(mesh);
      variantDismissPiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
      _registerDismissGap();
    }
    // startIndex: which note the player will play next (used to snap character to the
    // note they just played, i.e. startIndex - 1 for RIGHT / 0 for LEFT).
    // NOTE: variantProposePiece is NOT cleared here — it becomes the ride piece in Epic 6
    // and continues scrolling until it naturally exits the frame.
    variantAcceptState = { newPrimary, acceptX, characterMoved: false, notes, startIndex };
  }

  function setInstrument(inst) {
    instrument = inst;
    clearScene();
    rebuildTracks();
    reset();
    gameStartTime = performance.now();
  }

  function setWaves(waves, nowMs) {
    if (waves.length > 0 && waves[0].speed_px_per_ms) {
      lastWaveSpeed = waves[0].speed_px_per_ms;
    }
    const currentIds = new Set(waves.map(w => w.wave_id));
    for (const [id, w] of activeWaves.entries()) {
      if (!currentIds.has(id)) {
        // Only remove the wave if it has visually passed the player. This prevents
        // the backend's real-time clock from expiring waves that the frontend's
        // pause-adjusted clock still considers alive (e.g. after a long pause).
        const elapsed = Math.max(0, nowMs - gameStartTime - w.data.spawn_time_ms);
        const z = SPAWN_Z + (elapsed * w.data.speed_px_per_ms * 0.5);
        if (z < FRONT_Z) continue; // still in front — keep it alive
        scene.remove(w.mesh);
        activeWaves.delete(id);
      }
    }

    for (const waveData of waves) {
      let w = activeWaves.get(waveData.wave_id);
      if (!w) {
        // In Subway Scaler, a wave consists of carts in ALL tracks EXCEPT the safe_track.
        const group = new THREE.Group();
        for (let i = 0; i < numLanes; i++) {
          if (i === waveData.safe_track) continue;
          const cart = makeCart(bodyMaterial(COLORS.DANGER));
          cart.position.x = laneX(i, numLanes) + _worldOffsetX;
          group.add(cart);
        }
        scene.add(group);
        // Capture offset + lane count at creation so collision uses the same
        // world geometry the carts were positioned in (post-variant lanes/offset
        // changes must not retro-warp in-flight waves).
        w = { mesh: group, data: waveData, offsetX: _worldOffsetX, numLanes };
        activeWaves.set(waveData.wave_id, w);
      }
      w.data = waveData; // Update data (speed might change)
    }
  }

  function moveToTrack(trackIdx, immediate = false) {
    const toX = laneX(trackIdx, numLanes) + _worldOffsetX;
    if (immediate) {
      character.position.x = toX;
      tween = null;
    } else {
      tween = {
        fromX: character.position.x,
        toX,
        durMs: LATERAL_MS,
        startMs: performance.now(),
      };
    }
  }

  function showSuccess() {
    succeeded = true;
  }

  function setGameStartTime(time) {
    gameStartTime = time;
  }

  function setBaseFret(f, nL = 6) {
    baseFret = f;
    numLanes = nL;
    clearScene();
    rebuildTracks();
  }

  // Lightweight lane geometry update without clearing scene (post-promote).
  function setLaneGeometry(f, nL) {
    baseFret = f;
    numLanes = nL;
  }

  let _lastCollisionDebug = null;

  function getLastCollisionDebug() {
    return _lastCollisionDebug;
  }

  function checkCollision() {
    if (!instrument || succeeded) return false;

    const charX = character.position.x;
    const charZ = character.position.z;

    for (const w of activeWaves.values()) {
      if (w.ghost) continue; // demoted to visual-only after variant promote
      const waveZ = w.mesh.position.z;

      // Carts are 1.3 deep, character is ~0.5 deep.
      // Sum of half-depths = 0.65 + 0.25 = 0.9.
      if (Math.abs(charZ - waveZ) < 0.8) {
        // Use the wave's captured offset + numLanes (set at wave creation), not
        // the current scene values — post-variant the world geometry has shifted
        // but in-flight waves still live in their original frame.
        const safeX = laneX(w.data.safe_track, w.numLanes) + w.offsetX;
        if (Math.abs(charX - safeX) > 0.6) {
          _lastCollisionDebug = {
            charX: Math.round(charX * 100) / 100,
            charZ: Math.round(charZ * 100) / 100,
            safeX: Math.round(safeX * 100) / 100,
            safeTrack: w.data.safe_track,
            waveId: w.data.wave_id,
            waveNoteIndex: w.data.note_index,
            numLanes: w.numLanes,
            baseFret,
          };
          return true;
        }
      }
    }
    return false;
  }

  function render(nowMs) {
    const dt = lastTime ? Math.max(0, Math.min(0.05, (nowMs - lastTime) / 1000)) : 0.016;
    lastTime = nowMs;

    // Animate character sprite frame (story 7-6).
    updateCharacterSprite(nowMs);

    // Billboard: plane always faces camera — feet stay anchored on track surface.
    character.quaternion.copy(camera.quaternion);

    if (tween) {
      const t = Math.min(1, (nowMs - tween.startMs) / tween.durMs);
      const e = 1 - (1 - t) * (1 - t);
      character.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
      if (t >= 1) tween = null;
    }

    // Time-based eased traversal onto the variant lane (Story 6-8 polish).
    // The original geometric variant (Story 6.2 — bound to incoming diagonal
    // Z-progress) clamped to progress=1 instantly on accept because the
    // incoming diagonal had already passed the player, producing a hard snap.
    // Switching to a time-based easeInOutCubic gives a smooth slide that the
    // camera's 0.1 X lerp can track without lag-jumping.
    if (_charTraversal) {
      const t = _charTraversal;
      const tRaw = Math.min(1, (nowMs - t.startMs) / t.durMs);
      const e = _easeInOutCubic(tRaw);
      character.position.x = t.startX + (t.targetX - t.startX) * e;
      if (tRaw >= 1) {
        _charTraversal = null;
        _commitBuildingTransition(); // character arrived — commit env offset swap now
      }
    }

    // Bend midpoint reached callback — fires once when incoming diagonal midpoint hits player (z ≥ 0).
    if (_bendMidpointCb && !_bendMidpointFired && isBendMidpointReached()) {
      _bendMidpointFired = true;
      const cb = _bendMidpointCb;
      _bendMidpointCb = null;
      cb();
    }

    // Update wave positions
    for (const w of activeWaves.values()) {
      const elapsed = Math.max(0, nowMs - gameStartTime - w.data.spawn_time_ms);
      // Z position: starts at SPAWN_Z and moves towards FRONT_Z
      // If speed_px_per_ms is given, we use it.
      const z = SPAWN_Z + (elapsed * w.data.speed_px_per_ms * 0.5); // scaling speed for visual
      w.mesh.position.z = z;
      w.mesh.visible = elapsed > 0;
    }

    // Note: character billboarded in render() (quaternion copy from camera).
    // `succeeded` spin removed — plane always faces camera.

    // Variant propose piece — Z-scroll only (AC-8). Despawn deferred 500ms past
    // the geometric end-of-diagonal so the piece is visibly out of frame before
    // it's removed (rather than blinking out at the moment of arrival).
    if (variantProposePiece) {
      // Unclamped: negative while the start time is still future, so the piece
      // approaches from beyond SPAWN_Z (out of the fog) instead of parking there.
      const elapsed = nowMs - gameStartTime - variantProposePiece.spawnTimeMs;
      variantProposePiece.mesh.position.z = SPAWN_Z + elapsed * variantProposePiece.speedPxMs * 0.5;
      if (variantProposePiece.mesh.position.z > STRAIGHT_LEN / 2 + DIAG_LEN) {
        if (variantProposePiece.despawnAtMs == null) {
          variantProposePiece.despawnAtMs = nowMs + 500;
        } else if (nowMs >= variantProposePiece.despawnAtMs) {
          scene.remove(variantProposePiece.mesh);
          variantProposePiece.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
          variantProposePiece = null;
          clearBuildingGap('main-propose');
          clearBuildingGap('variant-outgoing');
        }
      }
    }

    // Variant safe zone — scrolls in lockstep with variant geometry (same spawn time + speed)
    if (variantSafeZoneMesh) {
      const spawnMs = variantSafeZoneMesh.userData.spawnMs;
      const speedPxMs = variantSafeZoneMesh.userData.speedPxMs;
      if (spawnMs != null && speedPxMs != null) {
        // Tab-resume guard: if RAF was throttled (tab hidden, sleep, etc.) the next
        // frame may jump huge — instantly firing onVariantMissed. Detect a large
        // gap and shift spawnMs forward so the safe zone resumes at its pre-gap Z.
        if (lastVariantTickMs > 0) {
          const dt = nowMs - lastVariantTickMs;
          if (dt > 500) {
            variantSafeZoneMesh.userData.spawnMs += (dt - 16);
          }
        }
        lastVariantTickMs = nowMs;
        const adjSpawnMs = variantSafeZoneMesh.userData.spawnMs;
        // Unclamped: negative while waiting, so the safe zone approaches from beyond
        // SPAWN_Z (out of the fog) in lockstep with the propose track piece.
        const elapsed = nowMs - gameStartTime - adjSpawnMs;
        const z = SPAWN_Z + elapsed * speedPxMs * 0.5 + VARIANT_SZ_DEPTH / 2;
        variantSafeZoneMesh.position.z = z;
        if (variantSafeZoneBorderMesh) variantSafeZoneBorderMesh.position.z = z;
        if (window.__gameState?.variant) {
          window.__gameState.variant.safeZoneZ = z;
        }
        // Miss handling (Story 6.8 polish):
        // - Fire the cb ONCE when the back edge passes the player (z > 10). State
        //   transitions (phase → idle, etc.) happen in main.js immediately.
        // - Defer mesh removal until the geometry is visually off-frame so the
        //   SZ scrolls away naturally rather than blinking out at the player.
        // - Post-accept path (cb null) gets the same treatment — the SZ scrolls
        //   past with the rest of the variant geometry instead of vanishing the
        //   moment the player accepts.
        const SZ_OFFSCREEN_Z = 25; // SZ mesh fully past camera viewport
        if (z > VARIANT_SZ_DEPTH / 2 && !_variantMissFired) {
          _variantMissFired = true;
          lastVariantTickMs = 0;
          if (onVariantMissedCb) onVariantMissedCb();
        }
        if (_variantMissFired && variantSafeZoneMesh && z > SZ_OFFSCREEN_Z) {
          // Dispose child sprite material + texture to prevent per-propose accumulation
          variantSafeZoneMesh.traverse(c => {
            if (c.isSprite && c.material) {
              c.material.map?.dispose();
              c.material.dispose();
            }
          });
          scene.remove(variantSafeZoneMesh);
          variantSafeZoneMesh.geometry?.dispose();
          variantSafeZoneMesh.material?.dispose();
          variantSafeZoneMesh = null;
          if (variantSafeZoneBorderMesh) {
            scene.remove(variantSafeZoneBorderMesh);
            variantSafeZoneBorderMesh.geometry?.dispose();
            variantSafeZoneBorderMesh.material?.dispose();
            variantSafeZoneBorderMesh = null;
          }
        }
      }
    } else {
      lastVariantTickMs = 0;
      if (window.__gameState?.variant) {
        window.__gameState.variant.safeZoneZ = null;
      }
    }

    // Dismiss piece — Z-scroll; trigger character tween at bend midpoint on accept (P1)
    if (variantDismissPiece) {
      const elapsed = Math.max(0, nowMs - gameStartTime - variantDismissPiece.spawnTimeMs);
      variantDismissPiece.mesh.position.z = SPAWN_Z + elapsed * variantDismissPiece.speedPxMs * 0.5;
      if (variantAcceptState && !variantAcceptState.characterMoved) {
        const BEND_CENTER_OFFSET = STRAIGHT_LEN / 2 + DIAG_LEN / 2;
        if (variantDismissPiece.mesh.position.z >= BEND_CENTER_OFFSET) {
          tween = {
            fromX: character.position.x,
            toX: variantAcceptState.acceptX,
            durMs: 200,
            startMs: nowMs,
          };
          variantAcceptState.characterMoved = true;
        }
      }
      if (variantDismissPiece.mesh.position.z > STRAIGHT_LEN / 2 + DIAG_LEN) {
        clearVariantGeom();
        if (variantAcceptState) {
          clearScene();
          baseFret = variantAcceptState.newPrimary.base_fret;
          numLanes = variantAcceptState.newPrimary.num_lanes;
          rebuildTracks();
          // Snap character to the note just played (startIndex - 1 for RIGHT; 0 for LEFT).
          const snapIdx = variantAcceptState.startIndex > 0 ? variantAcceptState.startIndex - 1 : 0;
          const snapNote = variantAcceptState.notes?.[snapIdx];
          if (snapNote && snapNote.fret != null) {
            const lane = Math.max(0, Math.min(numLanes - 1, snapNote.fret - baseFret));
            character.position.x = laneX(lane, numLanes);
          }
          targetCameraX = 0;
          currentCameraX = 0;
          variantAcceptState = null;
        }
      }
    }

    // Pending tracks — scroll new-scale track meshes from SPAWN_Z to rest position (Story 6.4).
    if (_pendingTracks.length > 0) {
      for (const pt of _pendingTracks) {
        pt.mesh.position.z += pt.speedPxMs * 0.5 * (dt * 1000);
        if (pt.mesh.position.z <= pt.targetZ) {
          pt.mesh.position.z = pt.targetZ;
        }
      }
      if (!_tracksLandedFired && areTracksLanded()) {
        _tracksLandedFired = true;
        // Promote pending to main tracks array
        for (const pt of _pendingTracks) { tracks.push({ mesh: pt.mesh }); }
        _pendingTracks = [];
        const cb = _tracksLandedCb;
        _tracksLandedCb = null;
        if (cb) cb();
      }
    }

    // Floor tile scrolling (story 7-1). Matches pending-track speed formula.
    {
      const floorDelta = lastWaveSpeed * 0.5 * (dt * 1000);
      for (const tile of floorTiles) {
        tile.position.z += floorDelta;
        if (tile.position.z > FLOOR_CULL_Z + FLOOR_TILE_DEPTH / 2) {
          tile.position.z -= FLOOR_TILE_DEPTH * 2;
        }
      }
    }

    // Building scroll (story 7-2) — same speed formula as floor and pending tracks.
    // The world-offset swap is no longer detected here — it is committed explicitly
    // by _commitBuildingTransition() at traversal completion and in clearVariantGeom().
    {
      const bldgDelta = lastWaveSpeed * 0.5 * (dt * 1000);

      // Suppress gap-based recycling across the full accept→arrival window:
      //   variantAcceptState: set at accept, before _worldOffsetX has even changed
      //   _charTraversal:     active during the actual diagonal slide
      //   _worldOffsetX !== _bldgTrackedOffsetX: covers the gap between _worldOffsetX
      //     changing (spawnVariantTracks) and traversal starting (_bendMidpointCb firing)
      // All three together ensure no near-camera building or lamppost is gap-kicked
      // at any point during the transition.
      const suppressEnvGaps = variantAcceptState !== null || _charTraversal !== null || _worldOffsetX !== _bldgTrackedOffsetX;
      recyclePool(leftBuildings,         'left',  'main',    _bldgTrackedOffsetX, bldgDelta, suppressEnvGaps);
      recyclePool(rightBuildings,        'right', 'main',    _bldgTrackedOffsetX, bldgDelta, suppressEnvGaps);
      recyclePool(variantLeftBuildings,  'left',  'variant', _variantBldgOffsetX, bldgDelta);
      recyclePool(variantRightBuildings, 'right', 'variant', _variantBldgOffsetX, bldgDelta);

      _updateGapDebug();

      // Scroll retiring buildings (X frozen at old offset); dispose when they pass the cull plane.
      // Use a minimum scroll rate (0.25 units/frame ≈ 15 units/sec at 60fps) so retirees always
      // make progress even if lastWaveSpeed drops to zero (edge case: wave-free initial state or
      // zero-speed wave config). Without this guard, retirees would freeze mid-scene and leak geometry.
      const retireDelta = Math.max(bldgDelta, 0.25);
      for (let i = retiringBuildings.length - 1; i >= 0; i--) {
        const g = retiringBuildings[i];
        g.position.z += retireDelta;
        if (g.position.z > BLDG_CULL_Z) {
          scene.remove(g);
          for (const child of g.children) child.geometry.dispose();
          retiringBuildings.splice(i, 1);
        }
      }
    }

    // Lamppost scroll + flicker (story 7-3) — same speed formula as buildings.
    // Gap-based recycling is suppressed during the variant accept→arrival window,
    // matching the same suppressEnvGaps logic applied to main building recyclePool calls.
    {
      const lampDelta = lastWaveSpeed * 0.5 * (dt * 1000);
      const flickerNow = nowMs / 1000;
      const suppressLampGaps = variantAcceptState !== null || _charTraversal !== null || _worldOffsetX !== _bldgTrackedOffsetX;
      for (const [arr, side] of [[leftLampposts, 'left'], [rightLampposts, 'right']]) {
        const lampRes = suppressLampGaps ? [] : reservationsFor(side, 'main');
        for (const g of arr) {
          g.position.z += lampDelta;
          g.position.x = g.userData.baseX + _bldgTrackedOffsetX;
          if (g.userData.hasFlicker && g.userData.spot) {
            const s = 0.5 + 0.5 * Math.sin(g.userData.flickerHz * flickerNow * Math.PI * 2 + g.userData.flickerPhase);
            g.userData.spot.intensity = 0.4 + s * 0.4;
          }
          let inGap = false;
          for (const r of lampRes) {
            const { z0, z1 } = r.zRangeAt();
            if (z1 > z0 && g.position.z > z0 && g.position.z < z1) { inGap = true; break; }
          }
          if (g.position.z > BLDG_CULL_Z || inGap) {
            const rearZ = arr.reduce((min, g2) => Math.min(min, g2.position.z), Infinity);
            g.position.z = rearZ - LAMP_POST_SPACING;
            g.position.x = g.userData.baseX + _bldgTrackedOffsetX;
          }
        }
      }

      // Pre-transition variant lamppost preview pool (story 7-3 fix): scroll +
      // recycle at the variant offset so the new track shows lampposts during the
      // decision/ride window. Light-less — adopted (lights reparented) at landing.
      for (const arr of [variantLeftLampposts, variantRightLampposts]) {
        for (const g of arr) {
          g.position.z += lampDelta;
          g.position.x = g.userData.baseX + _variantLampOffsetX;
          if (g.position.z > BLDG_CULL_Z) {
            const rearZ = arr.reduce((min, g2) => Math.min(min, g2.position.z), Infinity);
            g.position.z = rearZ - LAMP_POST_SPACING;
            g.position.x = g.userData.baseX + _variantLampOffsetX;
          }
        }
      }
    }

    currentCameraX += (targetCameraX - currentCameraX) * 0.1;

    // Compute the effective camera yaw from whichever mode owns the camera.
    // We then orbit the camera around its lookAt point — keeping the lookAt
    // position fixed, the camera body translates in -X/-Z (for +yaw) so the
    // camera ends up *behind the character along the diagonal axis* rather
    // than staying at the rest-position Z while only its head rotates. The
    // diagonal track now appears as a straight line into the distance.
    let effectiveYaw = 0;
    if (_cinematicExit) {
      const e = _cinematicExit;
      const tRaw = Math.min(1, (nowMs - e.startMs) / e.durMs);
      const t = _easeInOutCubic(tRaw);
      character.position.x = e.fromX + (e.targetX - e.fromX) * t;
      effectiveYaw = e.fromCamYaw * (1 - t);
      // Note: character sprite is billboarded (plane faces camera), so no rotation.y set here.
      _currentCamYaw = effectiveYaw;
      _targetCamYaw = effectiveYaw;
      if (tRaw >= 1) {
        _cinematicExit = null;
        _currentCamYaw = 0;
        _targetCamYaw = 0;
      }
    } else if (_cameraMode === 'riding') {
      if (_camEase) {
        const tRaw = Math.min(1, (nowMs - _camEase.startMs) / _camEase.durMs);
        _currentCamYaw = _camEase.fromYaw + (_camEase.toYaw - _camEase.fromYaw) * _easeInOutCubic(tRaw);
        if (tRaw >= 1) _camEase = null;
      } else {
        _currentCamYaw += Math.max(-CAMERA_YAW_RATE, Math.min(CAMERA_YAW_RATE, _targetCamYaw - _currentCamYaw));
      }
      effectiveYaw = _currentCamYaw;
    } else if (_cameraResetStartMs > 0) {
      const t = Math.min(1, (nowMs - _cameraResetStartMs) / CAMERA_RESET_DURATION_MS);
      const e = 1 - (1 - t) * (1 - t);
      effectiveYaw = _cameraResetStartYaw * (1 - e);
      if (t >= 1) {
        _cameraResetStartMs = 0;
        _currentCamYaw = 0;
        _targetCamYaw = 0;
        effectiveYaw = 0;
      }
    }

    // Pivot around the CHARACTER (currentCameraX, 0, 0) — not the lookAt point —
    // and rotate both the camera-position offset and the lookAt-point offset by
    // effectiveYaw. The look-direction (lookAt − camera) then lies exactly along
    // the diagonal, the camera body sits 11 units back from the character along
    // that diagonal, and the lookAt point sits 2 units in front of the character.
    //
    //   camRadius   = camera.z at rest, relative to character (= 11)
    //   lookFwdDist = |camBase.lookAt[2]| (= 2) — how far the lookAt point sits
    //                 in front of the character along the look direction.
    //
    // Default rest position (effectiveYaw=0) evaluates to the exact original
    // (currentCameraX, height, camBase.z) / lookAt(currentCameraX, 0, lookAtZ).
    const pitchRad = (CAMERA_PITCH * Math.PI) / 180;
    const camRadius = CAMERA_DISTANCE * Math.cos(pitchRad) + camBase.lookAt[2]; // 11
    const lookFwdDist = -camBase.lookAt[2];                                     // 2
    const sY = Math.sin(effectiveYaw);
    const cY = Math.cos(effectiveYaw);
    camera.position.x = currentCameraX - sY * camRadius;
    camera.position.y = CAMERA_DISTANCE * Math.sin(pitchRad);
    camera.position.z = cY * camRadius;
    camera.lookAt(currentCameraX + sY * lookFwdDist, 0, -cY * lookFwdDist);

    renderer.render(scene, camera);
  }

  function isVariantSafeZoneAdjacent() {
    if (!variantSafeZoneMesh) return false;
    return Math.abs(variantSafeZoneMesh.position.z) <= VARIANT_SZ_DEPTH / 2;
  }

  // Returns true when the incoming diagonal's midpoint has reached z = 0 (player position).
  function isBendMidpointReached() {
    if (!variantProposePiece) return false;
    const straightZ = variantProposePiece.mesh.position.z;
    return straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2 >= 0;
  }

  // Character traversal state — lateral lerp bound to variant propose piece Z-progress.
  let _charTraversal = null; // { startX, targetX }
  let _bendMidpointCb = null;
  let _bendMidpointFired = false;

  function setCharacterTargetX(targetX, durMs = LATERAL_MS) {
    _charTraversal = {
      startX: character.position.x,
      targetX,
      startMs: performance.now(),
      durMs,
    };
  }

  function setOnBendMidpointReached(cb) {
    _bendMidpointCb = cb;
    _bendMidpointFired = false;
  }

  function clearBendMidpointCallback() {
    _bendMidpointCb = null;
    _bendMidpointFired = false;
  }

  function getVariantInfo() {
    return variantInfo ? { variantX: variantInfo.variantX, side: variantInfo.side } : null;
  }

  function setCameraMode(mode) {
    if (mode === 'default' && _cameraMode === 'riding') {
      _cameraResetStartMs = performance.now();
      _cameraResetStartYaw = camera.rotation.y;
    }
    _cameraMode = mode;
  }

  function setTargetCameraX(x) {
    targetCameraX = x;
  }

  function getCharacterX() {
    return character.position.x;
  }

  function getTraversalProgress() {
    if (!_charTraversal || !variantProposePiece) return null;
    const straightZ = variantProposePiece.mesh.position.z;
    const frontEdgeZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN;
    const midpointZ = straightZ + STRAIGHT_LEN / 2 + DIAG_LEN / 2;
    const range = frontEdgeZ - midpointZ;
    return range > 0 ? Math.max(0, Math.min(1, (frontEdgeZ - 0) / range)) : 1;
  }

  function setOnVariantMissed(cb) {
    onVariantMissedCb = cb;
    _savedMissCb = cb; // remember so we can re-arm after a transition disables it
  }

  // Disables the variant miss callback without removing the safe zone mesh
  // (Story 6.8 AC-2). The mesh continues to scroll away naturally.
  function disableVariantMissCallback() {
    onVariantMissedCb = null;
    lastVariantTickMs = 0;
  }

  function isOutgoingCornerAtPlayer() {
    if (!variantProposePiece) return false;
    return variantProposePiece.mesh.position.z >= STRAIGHT_LEN / 2;
  }

  function snapCharacterYaw(_yaw) {
    // No-op: sprite is a PlaneGeometry billboarded in render() — always faces camera.
  }

  function setCharacterX(x) {
    character.position.x = x;
  }

  // easeInOutCubic — slow start, fast middle, slow end.
  function _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Camera ease state for riding mode (Story 6-8 polish). When durMs is provided,
  // the riding render branch eases _currentCamYaw from start→target over that
  // window with easeInOutCubic instead of the constant-velocity rate clamp.
  let _camEase = null; // { startMs, durMs, fromYaw, toYaw }

  function setRidingCameraTarget(yaw, durMs = 400) {
    _targetCamYaw = yaw;
    if (durMs != null && durMs > 0) {
      _camEase = { startMs: performance.now(), durMs, fromYaw: _currentCamYaw, toYaw: yaw };
    } else {
      _camEase = null;
    }
  }

  // Synchronized exit lerp (Story 6.8 AC-6).
  function startCinematicExit(targetX, durationMs) {
    _cinematicExit = {
      startMs: performance.now(),
      durMs: durationMs,
      fromCamYaw: _currentCamYaw,
      fromCharYaw: character.rotation.y,
      fromX: character.position.x,
      targetX,
    };
  }

  // Force-finalize the cinematic exit so subsequent render frames don't clobber
  // character.position.x set by main.js after the exit's nominal duration.
  function clearCinematicExit() {
    _cinematicExit = null;
    _camEase = null;
    _currentCamYaw = 0;
    _targetCamYaw = 0;
  }

  function getActiveSafeZones() {
    const zones = [];
    if (variantSafeZoneMesh) {
      zones.push({
        note: variantSafeZoneMesh.userData.variantNote ?? null,
        z: variantSafeZoneMesh.position.z,
        isVariant: true,
      });
    }
    return zones;
  }

  // Clear variant safe zone and miss callback without disturbing traversal or geometry.
  // Called on accept so the safe zone can't trigger a false miss during riding.
  function clearVariantSafeZone() {
    if (variantSafeZoneMesh) {
      scene.remove(variantSafeZoneMesh);
      variantSafeZoneMesh.geometry?.dispose();
      variantSafeZoneMesh.material?.dispose();
      variantSafeZoneMesh = null;
    }
    if (variantSafeZoneBorderMesh) {
      scene.remove(variantSafeZoneBorderMesh);
      variantSafeZoneBorderMesh.geometry?.dispose();
      variantSafeZoneBorderMesh.material?.dispose();
      variantSafeZoneBorderMesh = null;
    }
    onVariantMissedCb = null;
    lastVariantTickMs = 0;
  }

  // ─── Shader pre-warm ───────────────────────────────────────────────────────
  // The first time a material is drawn, WebGL compiles its GPU program on the
  // render thread — a synchronous stall that shows up as a lag spike. Carts
  // (DANGER material + roof) first draw when the opening waves spawn; the variant
  // track, safe-zone fill, neon border and number sprite first draw on propose.
  // Compile all of those up front (during load, before the countdown) by building
  // throwaway prototypes and calling renderer.compile(), so the spike never lands
  // during play. Compile runs under the live light rig (12 lamppost SpotLights),
  // which matches runtime — the variant preview lamps add no lights and the light
  // count stays constant across transitions, so these programs are reused as-is.
  //
  // Retains the prewarm-only fill/border materials for the scene's lifetime. Three
  // reference-counts compiled programs per material; disposing the sole holder frees
  // the program, so we must keep these alive or the warmed safe-zone programs are
  // evicted before the first wave uses them (re-introducing the spike).
  const _prewarmKeepAlive = [];
  function prewarmShaders() {
    const cart  = makeCart(bodyMaterial(COLORS.DANGER));       // DANGER body + roofMat
    const track = buildVariantTrackGroup('RIGHT', 0);          // trackMat
    const szGeo = new THREE.PlaneGeometry(1.2, VARIANT_SZ_DEPTH, 1, 16);
    const szMat = applyWorldCurve(new THREE.MeshStandardMaterial({
      color: STRING_SAFE_ZONE_FILLS[0], transparent: true, opacity: 0.75,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1,
      polygonOffsetUnits: 1, side: THREE.DoubleSide, dithering: true,
    }));
    const szMesh = new THREE.Mesh(szGeo, szMat);
    szMesh.rotation.x = -Math.PI / 2;
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(szGeo),
      applyWorldCurve(new THREE.LineBasicMaterial({ color: STRING_COLORS[0] })),
    );
    const label = makeFretLabel('0');                           // flat curve-wrapped MeshBasic + CanvasTexture
    szMesh.add(label);

    // Park the prototypes far below the track — out of the camera frustum so they
    // never flash on screen while the async compile is pending, but still walked by
    // compile() (which does not frustum-cull). Compiling inside the LIVE scene is
    // deliberate: it gives the warmed programs the exact same fog + light state the
    // runtime draws use, so they are reused with no first-wave/propose spike.
    // Also prewarm the character sprite — prime the MeshBasicMaterial program so
    // the first gameplay frame has no shader compile stall.
    const charProto = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    );
    // Park far below with the others.
    const protos = [cart, track, szMesh, border, charProto];
    for (const p of protos) { p.position.set(0, -1000, 0); scene.add(p); }

    const finish = () => {
      for (const p of protos) scene.remove(p);
      // Dispose ONLY throwaway geometry + the label's throwaway texture. Do NOT
      // dispose the prewarm-only materials (szMat fill, border LineBasic, label
      // MeshBasic): three reference-counts compiled GPU programs per material, so
      // disposing the sole holder drops the refcount to 0 and FREES the program.
      // Those programs are exactly what the safe-zone fill / border / number label
      // need on the first wave — freeing them here is what made the prewarm
      // ineffective and the spike return. Instead we retain these materials for the
      // scene's lifetime (see _prewarmKeepAlive) so their programs stay cached and the
      // runtime safe-zone materials reuse them. The shared cart/track/roof materials
      // are already retained elsewhere, so they need no dispose.
      cart.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
      track.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
      szGeo.dispose();
      border.geometry.dispose();
      label.geometry.dispose();
      label.material.map?.dispose(); // per-label throwaway texture; the program is not
      // Retain the refcounted mesh/line programs (fill + border + label) for the scene's life.
      _prewarmKeepAlive.push(szMat, border.material, label.material);
    };

    // compileAsync waits for KHR_parallel_shader_compile to finish LINKING the
    // programs (compile() only starts the link; the blocking link-status check then
    // lands on the first real draw — i.e. the first-wave spike). Awaiting it means
    // the first draw finds the program ready. Fall back to sync compile if absent.
    // NOTE: compileAsync's readiness poll would otherwise crash on the Sprite label's
    // program (undefined currentProgram) — guarded by a local patch in
    // vendor/three.module.js (checkMaterialsReady).
    if (typeof renderer.compileAsync === 'function') {
      renderer.compileAsync(scene, camera).then(finish, finish);
    } else {
      if (typeof renderer.compile === 'function') renderer.compile(scene, camera);
      finish();
    }
  }
  prewarmShaders();
  // ─────────────────────────────────────────────────────────────────────────

  return {
    threeScene: scene,
    setInstrument,
    setWaves,
    moveToTrack,
    showSuccess,
    setGameStartTime,
    setBaseFret,
    setLaneGeometry,
    checkCollision,
    getWaveCount() { return activeWaves.size; },
    getActiveWaveCount() { return activeWaves.size; },
    getLastCollisionDebug,
    getLastWaveSpeed() { return lastWaveSpeed; },
    reset,
    render,
    proposeVariantTracks,
    dismissVariantTracks,
    acceptVariantTracks,
    clearTracks,
    spawnVariantTracks,
    areTracksLanded,
    setOnTracksLanded,
    isVariantSafeZoneAdjacent,
    isBendMidpointReached,
    setCharacterTargetX,
    setOnBendMidpointReached,
    clearBendMidpointCallback,
    getVariantInfo,
    getCharacterX,
    getCharacterZ() { return character.position.z; },
    getTraversalProgress,
    isTraversalActive() { return _charTraversal !== null; },
    setCameraMode,
    setTargetCameraX,
    setOnVariantMissed,
    clearVariantSafeZone,
    disableVariantMissCallback,
    isOutgoingCornerAtPlayer,
    snapCharacterYaw,
    setCharacterX,
    setRidingCameraTarget,
    startCinematicExit,
    clearCinematicExit,
    getActiveSafeZones,
    getWorldOffsetX() { return _worldOffsetX; },
    getNumLanes() { return numLanes; },
    ghostExistingWaves() {
      // Only ghost waves whose captured offset doesn't match the current world
      // offset — those are the leftover pre-variant waves. New-frame waves
      // (pre-staged during the cinematic) share the current offset and must
      // remain collidable.
      for (const w of activeWaves.values()) {
        if (w.offsetX !== _worldOffsetX) w.ghost = true;
      }
    },
    finalizeVariantTransition,
    clearWavesForTesting() { clearWaves(); },
    resize(w, h) {
      if (w <= 0 || h <= 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    // Shims for old API
    setQueue() {},
    appendQueue() {},
    advanceQueue() {},
    dropOffCliff() {},
    setUpcomingNotes() {},
    _state() {
      return {
        queueLen: activeWaves.size,
        trackCount: tracks.length,
        anchorFret: 0,
      };
    },
  };
}

// ===== SceneManager — Story 3.1: static class owning renderer, camera, scene =====

export class SceneManager {
  static _instances = new WeakMap(); // Per-container instance storage
  static _primaryInstance = null; // Default instance for backward compatibility

  static #createInstance(container) {
    return {
      _container: container,
      _renderer: null,
      _scene: null,
      _camera: null,
      _activeEffects: [],
    };
  }

  static onResize(newW, newH) {
    const instance = SceneManager._primaryInstance;
    if (!instance || !instance._renderer || newW <= 0 || newH <= 0) return;
    instance._renderer.setSize(newW, newH);
    instance._camera.aspect = newW / newH;
    instance._camera.updateProjectionMatrix();
  }

  static init(container) {
    const instance = SceneManager.#createInstance(container);
    SceneManager._instances.set(container, instance);
    if (!SceneManager._primaryInstance) {
      SceneManager._primaryInstance = instance;
    }

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    instance._renderer = new THREE.WebGLRenderer({ antialias: true });
    instance._renderer.setSize(w, h);
    instance._renderer.setClearColor(COLORS.BG_VOID);
    container.appendChild(instance._renderer.domElement);

    instance._scene = new THREE.Scene();
    instance._camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
    instance._camera.position.set(0, 8, 12);
    instance._camera.lookAt(0, 0, -10);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        const cw = container?.clientWidth || 800;
        const ch = container?.clientHeight || 600;
        SceneManager.onResize(cw, ch);
      });
    }
  }

  // Read-only render — NEVER writes to gameState
  static render(gameState, container = null) {
    const instance = container
      ? SceneManager._instances.get(container)
      : SceneManager._primaryInstance;

    if (!instance || !instance._renderer) return;

    // Detect newly cleared carts and trigger effects (Story 3.7)
    if (gameState?.scene?.carts?.length) {
      for (const cart of gameState.scene.carts) {
        if (cart.cleared && instance._scene) {
          const track = gameState.scene?.tracks?.find(t => t.note?.midi === cart.notemidi);
          const stringIdx = track?.note?.string ?? 1;
          const pos = { x: 0, y: 0, z: cart.z ?? 0 };
          SceneManager.#showClearEffect(instance, pos, stringIdx);
        }
      }
    }

    SceneManager.#updateEffects(instance, performance.now());
    instance._renderer.render(instance._scene, instance._camera);
  }

  static #showClearEffect(instance, position, stringIndex, instrument = null) {
    if (!instance._scene || !THREE.RingGeometry) return;
    // stringIndex is 1-based from HIGH (tabulator); convert to low→high palette index.
    const stringCount = instrument?.stringCount ?? 6;
    const color = colourForString(stringToLaneIndex(stringIndex, stringCount), instrument);
    const geometry = new THREE.RingGeometry(0.1, 0.3, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
    instance._scene.add(mesh);
    instance._activeEffects.push({
      mesh, material, geometry,
      startTime: performance.now(),
      duration: 300,
    });
  }

  static #updateEffects(instance, now) {
    instance._activeEffects = instance._activeEffects.filter(effect => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.duration;
      if (progress >= 1.0) {
        effect.geometry?.dispose?.();
        effect.material?.dispose?.();
        if (effect.mesh && instance._scene) {
          instance._scene.remove(effect.mesh);
        }
        return false;
      }
      if (effect.material) {
        effect.material.opacity = 1.0 - progress;
      }
      if (effect.mesh?.scale) {
        effect.mesh.scale.setScalar(1.0 + progress * 2);
      }
      return true;
    });
  }
}
