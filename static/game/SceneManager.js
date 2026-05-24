// Subway-Surfer scene for Guitar Subway Scaler (v6.3 - safezone alignment).
//
// Dynamic waves: carts come towards the player at Z=0.
// Lanes (X-axis) = strings.
// Character slides X-only between strings.

import * as THREE from './vendor/three.module.js';
import { laneX, cameraForPitch, SPAWN_Z, LANE_X_SCALE } from './TrackSystem.js';
import { COLORS, STRING_COLORS } from './ui/tokens.js';

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
  renderer.setClearColor(0x101a2a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101a2a, 35, 100);

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

  const trackMat = new THREE.MeshStandardMaterial({ color: 0x2a3142 });
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_COLOUR });

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
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    ctx.font = 'Bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.strokeText(message, 32, 32);
    ctx.fillText(message, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.8, 1);
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
  let variantSafeZoneMesh = null;   // safe zone mesh on variant lane (story 5-7)
  let variantAcceptState = null;    // { newPrimary, acceptX, characterMoved } — tracks accept animation
  let lastWaveSpeed = 0.05;         // captured from setWaves; used for piece scrolling

  let tween = null;
  let succeeded = false;
  let lastTime = 0;
  let gameStartTime = 0;
  let baseFret = 0;
  let numLanes = 6;

  function clearWaves() {
    for (const w of activeWaves.values()) {
      scene.remove(w.mesh);
    }
    activeWaves.clear();
  }

  function clearScene() {
    for (const t of tracks) {
      scene.remove(t.mesh);
      scene.remove(t.label);
    }
    tracks = [];
    clearWaves();
  }

  function rebuildTracks() {
    const count = numLanes;
    for (let i = 0; i < count; i++) {
      const x = laneX(i, count);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH),
        trackMat
      );
      mesh.position.set(x, -0.05, -TRACK_DEPTH / 2 + 5);
      scene.add(mesh);

      const label = makeTextSprite((baseFret + i).toString());
      label.position.set(x, 0.1, 1.8);
      scene.add(label);

      tracks.push({ mesh, label });
    }
    targetCameraX = 0;
    currentCameraX = 0;
  }

  function reset() {
    clearWaves();
    clearVariantGeom();
    tween = null;
    succeeded = false;
    character.position.set(laneX(0, numLanes), CHAR_Y, FRONT_Z + 0.1);
    character.rotation.set(0, 0, 0);
    targetCameraX = 0;
    currentCameraX = 0;
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
    variantAcceptState = null;
    variantInfo = null;
  }

  function _variantLaneX(side) {
    const sign = side === 'RIGHT' ? 1 : -1;
    const edgeLane = side === 'RIGHT' ? numLanes - 1 : 0;
    return laneX(edgeLane, numLanes) + sign * LANE_X_SCALE;
  }

  function proposeVariantTracks(variant, transitionWave = null) {
    clearVariantGeom();
    const vx = _variantLaneX(variant.side);
    const spawnTimeMs = performance.now() - gameStartTime;
    const mesh = buildVariantTrackGroup(variant.side, vx);
    mesh.position.set(0, 0, SPAWN_Z);
    scene.add(mesh);
    variantProposePiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
    variantInfo = { side: variant.side, variantX: vx, speedPxMs: lastWaveSpeed };

    // Safe zone on variant lane — colored by transition string (story 5-7, AC-2, AC-3)
    const variantSzColor = STRING_COLORS[variant.base_string] ?? COLORS.ACCENT;
    const szGeo = new THREE.PlaneGeometry(1.2, VARIANT_SZ_DEPTH);
    const szMat = new THREE.MeshStandardMaterial({
      color: variantSzColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const szMesh = new THREE.Mesh(szGeo, szMat);
    szMesh.rotation.x = -Math.PI / 2;
    // Compute spawn time: when transitionWave is provided, back-calculate so the
    // safe zone arrives at z=0 at the same moment as the wave deadline (AC-4).
    let szSpawnMs;
    if (transitionWave) {
      const arrivalMs = transitionWave.spawn_time_ms + transitionWave.duration_ms;
      const travelMs = Math.abs(SPAWN_Z) / (transitionWave.speed_px_per_ms * 0.5);
      szSpawnMs = arrivalMs - travelMs;
    } else {
      szSpawnMs = performance.now() - gameStartTime;
    }
    szMesh.userData.spawnMs = szSpawnMs;
    szMesh.position.set(vx, 0.05, SPAWN_Z + VARIANT_SZ_DEPTH / 2);
    scene.add(szMesh);
    variantSafeZoneMesh = szMesh;
  }

  function dismissVariantTracks() {
    if (!variantInfo || variantDismissPiece) return;
    const spawnTimeMs = performance.now() - gameStartTime;
    const mesh = buildVariantTrackGroup(variantInfo.side, variantInfo.variantX);
    mesh.position.set(0, 0, SPAWN_Z);
    scene.add(mesh);
    variantDismissPiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
  }

  function acceptVariantTracks(newPrimary, notes = []) {
    if (!variantInfo) {
      // Fallback: no active variant state, rebuild immediately.
      clearScene();
      baseFret = newPrimary.base_fret;
      numLanes = newPrimary.num_lanes;
      rebuildTracks();
      return;
    }
    // Land character on-grid using NEW num_lanes (P6 fix).
    const edgeLane = variantInfo.side === 'RIGHT' ? newPrimary.num_lanes - 1 : 0;
    const acceptX = laneX(edgeLane, newPrimary.num_lanes);
    // AC-6 §1: spawn dismiss piece so old track visually peels away.
    if (!variantDismissPiece) {
      const spawnTimeMs = performance.now() - gameStartTime;
      const mesh = buildVariantTrackGroup(variantInfo.side, variantInfo.variantX);
      mesh.position.set(0, 0, SPAWN_Z);
      scene.add(mesh);
      variantDismissPiece = { mesh, spawnTimeMs, speedPxMs: lastWaveSpeed };
    }
    // AC-6 §2-4: defer character tween + track rebuild to render loop.
    // Store notes for post-rebuild character alignment (story 5-7, AC-7).
    variantAcceptState = { newPrimary, acceptX, characterMoved: false, notes };
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
          const cart = makeCart(bodyMaterial(0x888888));
          cart.position.x = laneX(i, numLanes);
          group.add(cart);
        }
        scene.add(group);
        w = { mesh: group, data: waveData };
        activeWaves.set(waveData.wave_id, w);
      }
      w.data = waveData; // Update data (speed might change)
    }
  }

  function moveToTrack(trackIdx, immediate = false) {
    const toX = laneX(trackIdx, numLanes);
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

  function checkCollision() {
    if (!instrument || succeeded) return false;

    const charX = character.position.x;
    const charZ = character.position.z;

    for (const w of activeWaves.values()) {
      const waveZ = w.mesh.position.z;

      // Carts are 1.3 deep, character is ~0.5 deep.
      // Sum of half-depths = 0.65 + 0.25 = 0.9.
      if (Math.abs(charZ - waveZ) < 0.8) {
        // Potential collision! Check if we are in the safe lane.
        const safeX = laneX(w.data.safe_track, numLanes);
        // Lanes are 1.6 apart. If we are > 0.6 away from safe center, we are hitting a cart.
        if (Math.abs(charX - safeX) > 0.6) {
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

    // Variant propose piece — Z-scroll only (AC-8)
    if (variantProposePiece) {
      const elapsed = Math.max(0, nowMs - gameStartTime - variantProposePiece.spawnTimeMs);
      variantProposePiece.mesh.position.z = SPAWN_Z + elapsed * variantProposePiece.speedPxMs * 0.5;
      if (variantProposePiece.mesh.position.z > STRAIGHT_LEN / 2 + DIAG_LEN) {
        scene.remove(variantProposePiece.mesh);
        variantProposePiece.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose(); });
        variantProposePiece = null;
      }
    }

    // Variant safe zone — scroll with same formula as SafeZoneRenderer (AC-2)
    if (variantSafeZoneMesh) {
      const elapsed = Math.max(0, nowMs - gameStartTime - variantSafeZoneMesh.userData.spawnMs);
      const z = SPAWN_Z + elapsed * lastWaveSpeed * 0.5 + VARIANT_SZ_DEPTH / 2;
      variantSafeZoneMesh.position.z = z;
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
          // Snap character to first post-accept note's lane (story 5-7, AC-7).
          const firstNote = variantAcceptState.notes?.[0];
          if (firstNote && firstNote.fret != null) {
            const lane = Math.max(0, Math.min(numLanes - 1, firstNote.fret - baseFret));
            character.position.x = laneX(lane, numLanes);
          }
          targetCameraX = 0;
          currentCameraX = 0;
          variantAcceptState = null;
        }
      }
    }

    currentCameraX += (targetCameraX - currentCameraX) * 0.1;
    const rad = (CAMERA_PITCH * Math.PI) / 180;
    camera.position.x = currentCameraX;
    camera.position.y = CAMERA_DISTANCE * Math.sin(rad);
    camera.position.z = CAMERA_DISTANCE * Math.cos(rad) + camBase.lookAt[2];
    camera.lookAt(currentCameraX, 0, camBase.lookAt[2]);

    renderer.render(scene, camera);
  }

  return {
    threeScene: scene,
    setInstrument,
    setWaves,
    moveToTrack,
    showSuccess,
    setGameStartTime,
    setBaseFret,
    checkCollision,
    getWaveCount() { return activeWaves.size; },
    reset,
    render,
    proposeVariantTracks,
    dismissVariantTracks,
    acceptVariantTracks,
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

  static #showClearEffect(instance, position, stringIndex) {
    if (!instance._scene || !THREE.RingGeometry) return;
    const color = STRING_COLORS[stringIndex] || 0xFFFFFF;
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
