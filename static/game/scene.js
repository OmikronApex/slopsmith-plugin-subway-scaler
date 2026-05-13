// Subway-Surfer scene for Guitar Subway Scaler (v5).
//
// Flat queue: one cart per row. Each cart sits at (laneX(fret, anchorFret), 0, queueZ(rowIndex)).
// Body colour = Rocksmith string palette indexed by stringIdx. Roof = single dark gray.
// Camera fixed at 45° top-down (cameraFor45Deg). Character slides X-only on accept.

import * as THREE from './vendor/three.module.js';
import { laneX, queueZ, cameraFor45Deg } from './grid.js';
import { colourForString } from './stringPalette.js';

const CHAR_Y = 1.1;
const FRONT_Z = 0;
const LATERAL_MS = 120;
const CAMERA_DISTANCE = 9;
const TRACK_PLANK_HALF_DEPTH = 30;
const ROOF_COLOUR = 0x444444;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(0x101a2a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101a2a, 25, 70);

  const camBase = cameraFor45Deg(CAMERA_DISTANCE);
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

  // Cached body materials, one per palette colour. Front cart uses a separate
  // emissive-tinted clone (per-colour) so the highlight does not steal the string colour.
  const bodyMatByColour = new Map();
  const activeMatByColour = new Map();
  function bodyMaterial(colourHex) {
    let m = bodyMatByColour.get(colourHex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colourHex });
      bodyMatByColour.set(colourHex, m);
    }
    return m;
  }
  function activeMaterial(colourHex) {
    let m = activeMatByColour.get(colourHex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: colourHex,
        emissive: colourHex,
        emissiveIntensity: 0.35,
      });
      activeMatByColour.set(colourHex, m);
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
  // Flat queue: carts[i] = { stringIdx, fret, colour, mesh } | null. Index = row.
  let carts = [];
  let trackPlanks = []; // { fret, mesh }
  let trackLabels = []; // { fret, mesh }
  let anchorFret = 0;

  let tween = null;
  let falling = false;
  let succeeded = false;
  let lastTime = 0;

  function clearScene() {
    for (const t of trackPlanks) scene.remove(t.mesh);
    trackPlanks = [];
    for (const l of trackLabels) {
      scene.remove(l.mesh);
      if (l.mesh.material.map) l.mesh.material.map.dispose();
      l.mesh.material.dispose();
    }
    trackLabels = [];
    for (const c of carts) if (c && c.mesh) scene.remove(c.mesh);
    carts = [];
  }

  function computeAnchor() {
    let lo = Infinity;
    for (const c of carts) if (c && c.fret < lo) lo = c.fret;
    anchorFret = isFinite(lo) ? lo : 0;
  }

  function rebuildTracks() {
    for (const t of trackPlanks) scene.remove(t.mesh);
    trackPlanks = [];
    for (const l of trackLabels) {
      scene.remove(l.mesh);
      if (l.mesh.material.map) l.mesh.material.map.dispose();
      l.mesh.material.dispose();
    }
    trackLabels = [];
    if (carts.length === 0) return;

    let min = Infinity;
    let max = -Infinity;
    for (const c of carts) {
      if (!c) continue;
      if (c.fret < min) min = c.fret;
      if (c.fret > max) max = c.fret;
    }
    if (!isFinite(min)) return;

    // Ensure we show at least the 4-fret "box" span if we have notes
    if (max - min < 3) max = min + 3;

    for (let fret = min; fret <= max; fret++) {
      const x = laneX(fret, anchorFret);
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, TRACK_PLANK_HALF_DEPTH * 2),
        trackMat,
      );
      plank.position.set(x, -0.05, -TRACK_PLANK_HALF_DEPTH + 4);
      scene.add(plank);
      trackPlanks.push({ fret, mesh: plank });

      const label = makeTextSprite(fret.toString());
      label.position.set(x, 0.1, 1.8);
      scene.add(label);
      trackLabels.push({ fret, mesh: label });
    }

    targetCameraX = (laneX(min, anchorFret) + laneX(max, anchorFret)) / 2;
  }

  function fretToX(fret) {
    return laneX(fret, anchorFret);
  }

  function placeCarts() {
    for (let i = 0; i < carts.length; i++) {
      const c = carts[i];
      if (!c) continue;
      const isFront = i === 0;
      const mat = isFront ? activeMaterial(c.colour) : bodyMaterial(c.colour);
      if (!c.mesh) {
        c.mesh = makeCart(mat);
        scene.add(c.mesh);
      } else if (c.mesh.children[0]) {
        c.mesh.children[0].material = mat;
      }
      c.mesh.position.set(fretToX(c.fret), 0, queueZ(i));
    }
  }

  function snapCharToFront() {
    const front = carts[0];
    if (!front) return;
    character.position.x = fretToX(front.fret);
    character.position.y = CHAR_Y;
    character.position.z = queueZ(0) + 0.1;
  }

  function setInstrument(inst) {
    instrument = inst;
    clearScene();
    tween = null;
    falling = false;
    succeeded = false;
    character.position.set(0, CHAR_Y, FRONT_Z + 0.1);
  }

  // positions: flat array of { stringIdx, fret } | null. One row per entry.
  function setQueue(positions) {
    for (const c of carts) if (c && c.mesh) scene.remove(c.mesh);
    carts = positions.map(p => p
      ? { stringIdx: p.stringIdx, fret: p.fret, colour: colourForString(p.stringIdx, instrument), mesh: null }
      : null);
    computeAnchor();
    rebuildTracks();
    placeCarts();
    snapCharToFront();
  }

  function appendQueue(position) {
    carts.push(position
      ? { stringIdx: position.stringIdx, fret: position.fret, colour: colourForString(position.stringIdx, instrument), mesh: null }
      : null);
    computeAnchor();
    rebuildTracks();
    placeCarts();
  }

  function advanceQueue() {
    if (tween) {
      character.position.x = tween.toX;
      character.position.y = CHAR_Y;
      tween = null;
    }
    const consumed = carts.shift();
    if (consumed && consumed.mesh) scene.remove(consumed.mesh);

    computeAnchor();
    rebuildTracks();
    placeCarts();

    const front = carts[0];
    if (!front) return;
    tween = {
      fromX: character.position.x, toX: fretToX(front.fret),
      durMs: LATERAL_MS,
      startMs: performance.now(),
    };
  }

  function dropOffCliff() { falling = true; }
  function showSuccess() { succeeded = true; }
  // Legacy shims (older run-state wiring may still call these).
  function setUpcomingNotes() {}
  function jumpToNext() {}
  function lateralLaneChange() {}
  function rowJump() {}
  function setCarts() {}

  function render(nowMs) {
    const dt = lastTime ? Math.min(0.05, (nowMs - lastTime) / 1000) : 0.016;
    lastTime = nowMs;

    if (tween) {
      const t = Math.min(1, (nowMs - tween.startMs) / tween.durMs);
      const e = 1 - (1 - t) * (1 - t);
      character.position.x = tween.fromX + (tween.toX - tween.fromX) * e;
      if (t >= 1) tween = null;
    }

    if (falling) {
      for (const t of trackPlanks) t.mesh.position.y -= dt * 8;
      for (const l of trackLabels) l.mesh.position.y -= dt * 8;
      for (const c of carts) if (c && c.mesh) c.mesh.position.y -= dt * 8;
      character.position.y -= dt * 8;
    }
    if (succeeded) character.rotation.y += dt * 2;
    
    // Smoothly update camera X to target
    currentCameraX += (targetCameraX - currentCameraX) * 0.1;
    camera.position.x = currentCameraX;
    camera.lookAt(currentCameraX, 0, camBase.lookAt[2]);

    renderer.render(scene, camera);
  }

  return {
    setInstrument,
    setQueue,
    appendQueue,
    advanceQueue,
    dropOffCliff,
    showSuccess,
    setUpcomingNotes,
    jumpToNext,
    lateralLaneChange,
    rowJump,
    setCarts,
    render,
    _state() {
      let lo = Infinity;
      for (const c of carts) if (c && c.fret < lo) lo = c.fret;
      return {
        queueLen: carts.length,
        trackCount: trackPlanks.length,
        anchorFret: isFinite(lo) ? lo : null,
      };
    },
  };
}
