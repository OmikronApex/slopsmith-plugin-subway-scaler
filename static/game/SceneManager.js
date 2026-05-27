// Subway-Surfer scene for Guitar Subway Scaler (v6.3 - safezone alignment).
//
// Dynamic waves: carts come towards the player at Z=0.
// Lanes (X-axis) = strings.
// Character slides X-only between strings.

import * as THREE from './vendor/three.module.js';
import { laneX, cameraForPitch, SPAWN_Z, LANE_X_SCALE } from './TrackSystem.js';
import { COLORS, colourForString, STRING_COLORS, STRING_SAFE_ZONE_FILLS } from './ui/tokens.js';

const CHAR_Y = 1.1;
const FRONT_Z = 0;
const LATERAL_MS = 120;
const CAMERA_PITCH = 30; // Shallower angle (deg) to see more upcoming track
const CAMERA_DISTANCE = 15; // Euclidean distance
const TRACK_DEPTH = 120;
const ROOF_COLOUR = 0x444444;
const VARIANT_SZ_DEPTH = 20;      // Safe zone depth for variant lane (matches SafeZoneRenderer)
const LANE_W = 1.4;               // Lane box width (matches BoxGeometry in rebuildTracks)
const PIECE_H = 0.06;             // Track piece height
const STRAIGHT_LEN = 60;          // Z length of variant parallel track = 3 wave spacings (story 5-7 adjustment)
const DIAG_LEN = 45;              // Z length of diagonal section in bend piece (~3× to reach frame edge)
// SEG_LEN = 25 removed — variant track uses fixed 3-piece group (story 5-7)

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(COLORS.BG_VOID);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.BG_VOID, 35, 100);

  const camBase = cameraForPitch(CAMERA_PITCH, CAMERA_DISTANCE);
  const camera = new THREE.PerspectiveCamera(55, (canvas.width / canvas.height) || 16 / 9, 0.1, 200);
  camera.position.set(camBase.x, camBase.y, camBase.z);
  camera.lookAt(camBase.lookAt[0], camBase.lookAt[1], camBase.lookAt[2]);

  let targetCameraX = 0;
  let currentCameraX = 0;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 12, 8);
  scene.add(sun);

  const trackMat = new THREE.MeshStandardMaterial({ color: COLORS.BG_STAGE });
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_COLOUR });

  // ─── Floor plane (story 7-1) ─────────────────────────────────────────────
  const FLOOR_Y = -0.15;          // below track bottom (-0.08) with clearance (spec AC-4)
  const FLOOR_WIDTH = 400;        // extends far beyond visible world edges
  const FLOOR_TILE_DEPTH = 300;   // two tiles = 600 units depth, well past fog (100)
  const FLOOR_CULL_Z = 20;        // cull tiles whose front edge passes this Z (behind camera)

  let floorMat = new THREE.MeshStandardMaterial({ color: COLORS.BG_VOID });
  function makeFloorTile() {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_WIDTH, FLOOR_TILE_DEPTH, 32, 32),
      floorMat
    );
    tile.rotation.x = -Math.PI / 2;
    return tile;
  }
  let floorTiles = [makeFloorTile(), makeFloorTile()];
  floorTiles[0].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z);
  floorTiles[1].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z);
  floorTiles.forEach(t => scene.add(t));
  // ─────────────────────────────────────────────────────────────────────────

  const bodyMatByColour = new Map();
  function bodyMaterial(colourHex) {
    let m = bodyMatByColour.get(colourHex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colourHex });
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

  function makeTextSprite(message) {
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
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.scale.set(0.8, 0.8, 1);
    // Safe zone has rotation.x = -π/2, so local +Z maps to world +Y.
    sprite.position.set(0, 0, 0.5);
    return sprite;
  }

  const character = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xff4488 }),
  );
  character.position.set(0, CHAR_Y, FRONT_Z + 0.1);
  scene.add(character);

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
        new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH),
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
    character.position.set(laneX(0, numLanes), CHAR_Y, FRONT_Z + 0.1);
    character.rotation.set(0, 0, 0);
    targetCameraX = 0;
    currentCameraX = 0;

    // Recreate floor tiles (story 7-1) — dispose old, spawn fresh at initial positions.
    for (const tile of floorTiles) {
      scene.remove(tile);
      tile.geometry.dispose();
    }
    floorMat.dispose();
    floorMat = new THREE.MeshStandardMaterial({ color: COLORS.BG_VOID });
    floorTiles = [makeFloorTile(), makeFloorTile()];
    floorTiles[0].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH / 2) + FLOOR_CULL_Z);
    floorTiles[1].position.set(0, FLOOR_Y, -(FLOOR_TILE_DEPTH * 1.5) + FLOOR_CULL_Z);
    floorTiles.forEach(t => scene.add(t));
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
    const outgoing = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, DIAG_LEN * 1.414), mat);
    outgoing.rotation.set(0, sign * -Math.PI / 4, 0);
    outgoing.position.set(variantX + sign * DIAG_LEN * 0.5, 0, -(STRAIGHT_LEN / 2 + DIAG_LEN * 0.5));
    group.add(outgoing);
    // Straight section: player-facing end at highest local Z (first to reach player).
    const straight = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, STRAIGHT_LEN), mat);
    straight.position.set(variantX, 0, 0);
    group.add(straight);
    // Incoming diagonal (front — arrives first): 45° peel from main-track area to variant lane.
    const incoming = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, PIECE_H, DIAG_LEN * 1.414), mat);
    incoming.rotation.set(0, sign * -1 * -Math.PI / 4, 0);
    incoming.position.set(variantX + sign * DIAG_LEN * 0.5, 0, STRAIGHT_LEN / 2 + DIAG_LEN * 0.5);
    group.add(incoming);
    return group;
  }

  function clearVariantGeom() {
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
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH), trackMat);
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
    const geomElapsed = Math.max(0, nowGameMs - spawnMs);
    mesh.position.set(0, 0, SPAWN_Z + geomElapsed * speedPxMs * 0.5);
    scene.add(mesh);
    variantProposePiece = { mesh, spawnTimeMs: spawnMs, speedPxMs };
    variantInfo = { side: variant.side, variantX: vx, speedPxMs };

    // Palette index for variant safe zone colours (story 7-0).
    // Uses STRING_SAFE_ZONE_FILLS for fill and STRING_COLORS for the neon border.
    const stringCount = instrument?.stringCount ?? 6;
    const paletteIdx = anchorString != null ? (stringCount - anchorString) : 0;
    // Safe zone fill — dim translucent plane using STRING_SAFE_ZONE_FILLS (story 7-0).
    const szGeo = new THREE.PlaneGeometry(1.2, VARIANT_SZ_DEPTH);
    const fillColor = paletteIdx < STRING_SAFE_ZONE_FILLS.length
      ? STRING_SAFE_ZONE_FILLS[paletteIdx]
      : STRING_SAFE_ZONE_FILLS[0];
    const borderColor = paletteIdx < STRING_COLORS.length
      ? STRING_COLORS[paletteIdx]
      : STRING_COLORS[0];
    const szMat = new THREE.MeshStandardMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
    });
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
    const szElapsed = Math.max(0, nowGameMs - spawnMs);
    // Match SafeZoneRenderer Z: SPAWN_Z + elapsed*speed*0.5 + DEPTH/2.
    // Without the +DEPTH/2 offset the variant safezone trails the anchor's by half a depth.
    const szInitialZ = SPAWN_Z + szElapsed * speedPxMs * 0.5 + VARIANT_SZ_DEPTH / 2;
    // Variant tracks sit at y=0 (top surface +0.03). Use y=0.15 to match the
    // clearance SafeZoneRenderer gives primary zones above main tracks (y=-0.05, top=-0.02).
    szMesh.position.set(vx, 0.15, szInitialZ);
    if (anchorFret != null) {
      const fretOffset = variant.side === 'RIGHT' ? 2 : -2;
      const label = makeTextSprite((anchorFret + fretOffset).toString());
      szMesh.add(label);
    }
    scene.add(szMesh);
    variantSafeZoneMesh = szMesh;

    // Safe zone border — EdgesGeometry neon outline (story 7-0).
    // EdgesGeometry on PlaneGeometry = 4 perimeter edges, no internal diagonals.
    const szBorderMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(szGeo),
      new THREE.LineBasicMaterial({ color: borderColor })
    );
    szBorderMesh.renderOrder = 1;
    szBorderMesh.rotation.x = -Math.PI / 2;
    szBorderMesh.position.set(vx, 0.16, szInitialZ);
    scene.add(szBorderMesh);
    variantSafeZoneBorderMesh = szBorderMesh;
  }

  function dismissVariantTracks() {
    if (!variantInfo || variantDismissPiece) return;
    const spawnTimeMs = performance.now() - gameStartTime;
    const mesh = buildVariantTrackGroup(variantInfo.side, variantInfo.variantX);
    mesh.position.set(0, 0, SPAWN_Z);
    scene.add(mesh);
    variantDismissPiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
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
    const dt = lastTime ? Math.min(0.05, (nowMs - lastTime) / 1000) : 0.016;
    lastTime = nowMs;

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
      if (tRaw >= 1) _charTraversal = null;
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

    if (succeeded) character.rotation.y += dt * 2;

    // Variant propose piece — Z-scroll only (AC-8). Despawn deferred 500ms past
    // the geometric end-of-diagonal so the piece is visibly out of frame before
    // it's removed (rather than blinking out at the moment of arrival).
    if (variantProposePiece) {
      const elapsed = Math.max(0, nowMs - gameStartTime - variantProposePiece.spawnTimeMs);
      variantProposePiece.mesh.position.z = SPAWN_Z + elapsed * variantProposePiece.speedPxMs * 0.5;
      if (variantProposePiece.mesh.position.z > STRAIGHT_LEN / 2 + DIAG_LEN) {
        if (variantProposePiece.despawnAtMs == null) {
          variantProposePiece.despawnAtMs = nowMs + 500;
        } else if (nowMs >= variantProposePiece.despawnAtMs) {
          scene.remove(variantProposePiece.mesh);
          variantProposePiece.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
          variantProposePiece = null;
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
        const elapsed = Math.max(0, nowMs - gameStartTime - adjSpawnMs);
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
      character.rotation.y = e.fromCharYaw * (1 - t);
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

  function snapCharacterYaw(yaw) {
    character.rotation.y = yaw;
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
    const color = colourForString(stringCount - stringIndex, instrument);
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
