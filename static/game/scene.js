// Subway-Surfer scene for Guitar Subway Scaler (v6.3 - safezone alignment).
//
// Dynamic waves: carts come towards the player at Z=0.
// Lanes (X-axis) = strings.
// Character slides X-only between strings.

import * as THREE from './vendor/three.module.js';
import { laneX, cameraForPitch, SPAWN_Z } from './grid.js';
import { colourForString } from './stringPalette.js';

const CHAR_Y = 1.1;
const FRONT_Z = 0;
const LATERAL_MS = 120;
const CAMERA_PITCH = 30; // Shallower angle (deg) to see more upcoming track
const CAMERA_DISTANCE = 15; // Euclidean distance
const CAMERA_DISTANCE_VARIANT = 32; // Euclidean distance pulled back
const TRACK_DEPTH = 120;
const ROOF_COLOUR = 0x444444;
const VARIANT_GAP = 3.5; // Lateral gap (world units) between primary and variant track set
const VARIANT_TINT = 0x3a5a3a; // Greenish tint to mark variant tracks

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

  // Variant tracks (feature 008-track-variants): a second track group offered
  // at milestones. Positioned at +X (RIGHT) or -X (LEFT) of the primary set.
  let variantTracks = []; // { mesh, label }
  let variantOffsetX = 0; // 0 when no variant active
  let variantTintMat = new THREE.MeshStandardMaterial({ color: VARIANT_TINT, transparent: true, opacity: 0 });
  let variantBaseHighlight = null; // glowing marker on the variant base note lane
  let variantBaseHighlightMat = null; // built per-variant with the correct string colour
  let variantFade = null; // { from, to, startMs, durMs }

  let tween = null;
  let succeeded = false;
  let lastTime = 0;
  let gameStartTime = 0;
  let baseFret = 0;
  let numLanes = 6;
  // Camera framing for variant overlay.
  let targetCameraDistance = CAMERA_DISTANCE;
  let currentCameraDistance = CAMERA_DISTANCE;

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
    targetCameraDistance = CAMERA_DISTANCE;
    currentCameraDistance = CAMERA_DISTANCE;
  }

  function reset() {
    clearWaves();
    tween = null;
    succeeded = false;
    character.position.set(laneX(0, numLanes), CHAR_Y, FRONT_Z + 0.1);
    character.rotation.set(0, 0, 0);
    targetCameraX = 0;
    currentCameraX = 0;
    targetCameraDistance = CAMERA_DISTANCE;
    currentCameraDistance = CAMERA_DISTANCE;
    variantFade = null;
    variantTintMat.opacity = 0;
    if (variantBaseHighlightMat) variantBaseHighlightMat.opacity = 0;
  }

  function clearVariantTracks() {
    for (const t of variantTracks) {
      scene.remove(t.mesh);
      scene.remove(t.label);
    }
    variantTracks = [];
    if (variantBaseHighlight) {
      scene.remove(variantBaseHighlight);
      variantBaseHighlight = null;
    }
  }

  function buildTrackGroup(numLanesV, baseFretV, originX, mat) {
    const out = [];
    for (let i = 0; i < numLanesV; i++) {
      const x = originX + laneX(i, numLanesV);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, TRACK_DEPTH),
        mat
      );
      mesh.position.set(x, -0.05, -TRACK_DEPTH / 2 + 5);
      scene.add(mesh);
      const label = makeTextSprite((baseFretV + i).toString());
      label.position.set(x, 0.1, 1.8);
      scene.add(label);
      out.push({ mesh, label });
    }
    return out;
  }

  function proposeVariantTracks(variant) {
    // variant: { side: "LEFT"|"RIGHT", num_lanes, base_fret, base_lane, root_midi, ... }
    if (variantTracks.length > 0) return; // already shown
    const sign = variant.side === "RIGHT" ? 1 : -1;
    const primaryHalf = numLanes * 0.8;
    const variantHalf = variant.num_lanes * 0.8;
    variantOffsetX = sign * (primaryHalf + VARIANT_GAP + variantHalf);
    // Reset shared material to transparent before building so fade-in is visible.
    variantTintMat.opacity = 0;
    variantTracks = buildTrackGroup(variant.num_lanes, variant.base_fret, variantOffsetX, variantTintMat);
    // Target highlight: a glowing marker coloured to match the string the
    // variant's root note is actually played on. variant.base_string is
    // 1-based from HIGH; colourForString expects 0-based LOW→HIGH.
    const baseLane = typeof variant.base_lane === 'number' ? variant.base_lane : 0;
    const baseLaneX = variantOffsetX + laneX(baseLane, variant.num_lanes);
    const stringHigh1 = typeof variant.base_string === 'number' ? variant.base_string : 1;
    const strCount = (instrument && instrument.stringCount) || 6;
    const stringLow0 = strCount - stringHigh1;
    const highlightColour = colourForString(stringLow0, instrument);
    variantBaseHighlightMat = new THREE.MeshStandardMaterial({
      color: highlightColour,
      emissive: highlightColour,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0,
    });
    variantBaseHighlight = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, TRACK_DEPTH * 0.5),
      variantBaseHighlightMat,
    );
    variantBaseHighlight.position.set(baseLaneX, 0.04, -TRACK_DEPTH * 0.25 + 2);
    scene.add(variantBaseHighlight);
    variantFade = { from: 0, to: 1, startMs: performance.now(), durMs: 500 };
    // Reframe: zoom out and pan to midpoint.
    targetCameraDistance = CAMERA_DISTANCE_VARIANT;
    targetCameraX = variantOffsetX / 2;
  }

  function dismissVariantTracks() {
    // Trigger a fade-out; defer actual removal until opacity reaches 0.
    if (variantTracks.length === 0) return;
    variantFade = { from: variantTintMat.opacity, to: 0, startMs: performance.now(), durMs: 500, removeOnEnd: true };
    targetCameraDistance = CAMERA_DISTANCE;
    targetCameraX = 0;
  }

  function acceptVariantTracks(newPrimary) {
    // newPrimary: { num_lanes, base_fret } from /variant/accept response.
    // Remove primary tracks and promote variant geometry to primary by rebuilding.
    for (const t of tracks) {
      scene.remove(t.mesh);
      scene.remove(t.label);
    }
    tracks = [];
    clearVariantTracks();
    baseFret = newPrimary.base_fret;
    numLanes = newPrimary.num_lanes;
    rebuildTracks();
    variantOffsetX = 0;
    targetCameraDistance = CAMERA_DISTANCE;
    targetCameraX = 0;
    // Snap character to its (new) starting lane; runState will drive subsequent moves.
    character.position.x = laneX(0, numLanes);
  }

  function setInstrument(inst) {
    instrument = inst;
    clearScene();
    rebuildTracks();
    reset();
    gameStartTime = performance.now();
  }

  function setWaves(waves, nowMs) {
    const currentIds = new Set(waves.map(w => w.wave_id));
    for (const [id, w] of activeWaves.entries()) {
      if (!currentIds.has(id)) {
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
    
    // Variant fade tween (transparent material opacity). Drives both the
    // track-set tint and the base-lane highlight in lockstep.
    if (variantFade) {
      const t = Math.min(1, (nowMs - variantFade.startMs) / variantFade.durMs);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      const v = variantFade.from + (variantFade.to - variantFade.from) * eased;
      variantTintMat.opacity = v;
      if (variantBaseHighlightMat) variantBaseHighlightMat.opacity = v * 0.8;
      if (t >= 1) {
        if (variantFade.removeOnEnd) {
          clearVariantTracks();
          variantOffsetX = 0;
        }
        variantFade = null;
      }
    }

    currentCameraX += (targetCameraX - currentCameraX) * 0.1;
    currentCameraDistance += (targetCameraDistance - currentCameraDistance) * 0.08;
    const rad = (CAMERA_PITCH * Math.PI) / 180;
    camera.position.x = currentCameraX;
    camera.position.y = currentCameraDistance * Math.sin(rad);
    camera.position.z = currentCameraDistance * Math.cos(rad) + camBase.lookAt[2];
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
    reset,
    render,
    proposeVariantTracks,
    dismissVariantTracks,
    acceptVariantTracks,
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
