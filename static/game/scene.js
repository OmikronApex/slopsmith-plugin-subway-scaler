// Subway-Surfer scene for Guitar Subway Scaler (v4).
//
// Queue model: groups of consecutive same-string notes share one z-row.
// Within a row, carts spread along X by fret. Lateral within row = same-string
// fret change. Forward to next row = string change.
//
// Axes: +X right, +Y up, +Z toward camera (front row at Z=0 closest to camera).
// Camera fixed (no vertical motion). Character slides flat (no Y arc).

import * as THREE from './vendor/three.module.js';
import { laneX, queueZ, cameraFor45Deg } from './grid.js';

const CHAR_Y = 1.1;
const FRONT_Z = 0;
const LATERAL_MS = 120;
const ROW_JUMP_MS = 220;
const CAMERA_DISTANCE = 9;
const TRACK_PLANK_HALF_DEPTH = 30;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(0x101a2a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101a2a, 25, 70);

  const cam = cameraFor45Deg(CAMERA_DISTANCE);
  const camera = new THREE.PerspectiveCamera(55, (canvas.width / canvas.height) || 16 / 9, 0.1, 200);
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.lookAt[0], cam.lookAt[1], cam.lookAt[2]);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 12, 8);
  scene.add(sun);

  const cartMat = new THREE.MeshStandardMaterial({ color: 0x66aaff });
  const activeCartMat = new THREE.MeshStandardMaterial({
    color: 0xffaa33, emissive: 0x331a00, emissiveIntensity: 0.5,
  });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x2a3142 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

  function makeCart(material) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.3), material);
    body.position.y = 0.45;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.4), roofMat);
    roof.position.y = 0.9;
    g.add(roof);
    return g;
  }

  const character = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xff4488 }),
  );
  character.position.set(0, CHAR_Y, FRONT_Z + 0.1);
  scene.add(character);

  // Row-grouped queue. rows[k] = array of { fret, stringIdx, mesh } | null.
  // cursorInRow = index of next-due cart within rows[0].
  let rows = [];
  let cursorInRow = 0;
  let trackPlanks = [];
  let anchorFret = 0;

  let tween = null;
  let falling = false;
  let succeeded = false;
  let lastTime = 0;

  function clearScene() {
    for (const t of trackPlanks) scene.remove(t.mesh);
    trackPlanks = [];
    for (const r of rows) for (const c of r) if (c && c.mesh) scene.remove(c.mesh);
    rows = [];
    cursorInRow = 0;
  }

  function computeAnchor() {
    let lo = Infinity;
    for (const r of rows) for (const c of r) if (c && c.fret < lo) lo = c.fret;
    anchorFret = isFinite(lo) ? lo : 0;
  }

  function rebuildTracks() {
    for (const t of trackPlanks) scene.remove(t.mesh);
    trackPlanks = [];
    const fretSet = new Set();
    for (const r of rows) for (const c of r) if (c) fretSet.add(c.fret);
    const sortedFrets = [...fretSet].sort((a, b) => a - b);
    for (const fret of sortedFrets) {
      const x = laneX(fret, anchorFret);
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, TRACK_PLANK_HALF_DEPTH * 2),
        trackMat,
      );
      plank.position.set(x, -0.05, -TRACK_PLANK_HALF_DEPTH + 4);
      scene.add(plank);
      trackPlanks.push({ fret, mesh: plank });
    }
  }

  function fretToX(fret) {
    return laneX(fret, anchorFret);
  }

  function placeAllCarts() {
    for (let k = 0; k < rows.length; k++) {
      for (let i = 0; i < rows[k].length; i++) {
        const c = rows[k][i];
        if (!c) continue;
        const isActive = k === 0 && i === cursorInRow;
        const mat = isActive ? activeCartMat : cartMat;
        if (!c.mesh) {
          c.mesh = makeCart(mat);
          scene.add(c.mesh);
        } else if (c.mesh.children[0]) {
          c.mesh.children[0].material = mat;
        }
        c.mesh.position.set(fretToX(c.fret), 0, queueZ(k));
      }
    }
  }

  function snapCharToActive() {
    const front = rows[0];
    if (!front || !front[cursorInRow]) return;
    character.position.x = fretToX(front[cursorInRow].fret);
    character.position.y = CHAR_Y;
    character.position.z = queueZ(0) + 0.1;
  }

  function setInstrument() {
    clearScene();
    tween = null;
    falling = false;
    succeeded = false;
    character.position.set(0, CHAR_Y, FRONT_Z + 0.1);
  }

  // rowsInput: array of rows. Each row = array of { stringIdx, fret } | null.
  function setQueue(rowsInput) {
    for (const r of rows) for (const c of r) if (c && c.mesh) scene.remove(c.mesh);
    rows = rowsInput.map(row => row.map(p => p ? { stringIdx: p.stringIdx, fret: p.fret, mesh: null } : null));
    cursorInRow = 0;
    computeAnchor();
    rebuildTracks();
    placeAllCarts();
    snapCharToActive();
  }

  function appendQueue(position, sameStringAsLast) {
    if (!position) {
      if (sameStringAsLast && rows.length) rows[rows.length - 1].push(null);
      else rows.push([null]);
    } else if (sameStringAsLast && rows.length) {
      rows[rows.length - 1].push({ stringIdx: position.stringIdx, fret: position.fret, mesh: null });
    } else {
      rows.push([{ stringIdx: position.stringIdx, fret: position.fret, mesh: null }]);
    }
    computeAnchor();
    rebuildTracks();
    placeAllCarts();
  }

  function advanceQueue() {
    if (tween) {
      character.position.x = tween.toX;
      character.position.z = tween.toZ;
      character.position.y = CHAR_Y;
      tween = null;
    }
    if (!rows.length) return;
    const consumed = rows[0][cursorInRow];
    if (consumed && consumed.mesh) scene.remove(consumed.mesh);
    rows[0][cursorInRow] = null;

    let nextCursor = cursorInRow + 1;
    while (nextCursor < rows[0].length && rows[0][nextCursor] == null) nextCursor++;
    let rowShift = false;
    if (nextCursor >= rows[0].length) {
      rows.shift();
      cursorInRow = 0;
      while (rows.length && rows[0].every(c => c == null)) rows.shift();
      rowShift = true;
    } else {
      cursorInRow = nextCursor;
    }

    computeAnchor();
    rebuildTracks();
    placeAllCarts();

    const front = rows[0] && rows[0][cursorInRow];
    if (!front) return;
    tween = {
      fromX: character.position.x, toX: fretToX(front.fret),
      fromZ: character.position.z, toZ: queueZ(0) + 0.1,
      durMs: rowShift ? ROW_JUMP_MS : LATERAL_MS,
      startMs: performance.now(),
    };
  }

  function dropOffCliff() { falling = true; }
  function showSuccess() { succeeded = true; }
  // Legacy shims kept so older run-state wiring in main.js still resolves.
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
      character.position.z = tween.fromZ + (tween.toZ - tween.fromZ) * e;
      if (t >= 1) tween = null;
    }

    if (falling) {
      for (const t of trackPlanks) t.mesh.position.y -= dt * 8;
      for (const r of rows) for (const c of r) if (c && c.mesh) c.mesh.position.y -= dt * 8;
      character.position.y -= dt * 8;
    }
    if (succeeded) character.rotation.y += dt * 2;

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
    _state() { return { rowCount: rows.length, cursorInRow, trackCount: trackPlanks.length, anchorFret }; },
  };
}
