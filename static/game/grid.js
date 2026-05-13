// Pure geometry helpers for the vertical subway scene.
//
// Lanes (columns) = frets, log-spaced via d(n) = 1 - 2^(-n/12).
// Rows (depth) = strings. Row 0 (lowest pitch) sits at the front (largest Z).
// See specs/003-guitar-subway-scaler/research.md §4–§5.

export const LANE_X_SCALE = 18;
export const ROW_DZ = 3.0;
export const WINDOW = 9;
export const QUEUE_DZ = 2.2;

export function queueZ(queueIndex) {
  const z = -queueIndex * QUEUE_DZ;
  return z === 0 ? 0 : z;
}

function fretDistance(n) {
  return 1 - Math.pow(2, -n / 12);
}

export function laneX(fret, activeFret) {
  return LANE_X_SCALE * (fretDistance(fret) - fretDistance(activeFret));
}

export function rowZ(stringIdx) {
  const z = -stringIdx * ROW_DZ;
  return z === 0 ? 0 : z;
}

// Camera placement that achieves a 45° downward pitch toward (0, 0, lookAtZ).
// At distance d, set camera at (0, d, d + lookAtZ) so the line from camera to
// lookAt has equal Y-drop and Z-distance ⇒ 45° pitch.
export function cameraFor45Deg(distance, lookAtZ = -2) {
  return { x: 0, y: distance, z: distance + lookAtZ, lookAt: [0, 0, lookAtZ] };
}

// Compute the visible window of lanes centred on `activeFret`, clamped to [0, maxFret].
// Returns an array of { fret, x } objects, length WINDOW.
export function windowedLanes(activeFret, _stringCount, maxFret) {
  const half = Math.floor(WINDOW / 2);
  let lo = activeFret - half;
  let hi = activeFret + half;
  if (lo < 0) { hi += -lo; lo = 0; }
  if (hi > maxFret) { lo -= (hi - maxFret); hi = maxFret; }
  if (lo < 0) lo = 0;
  const out = [];
  for (let f = lo; f <= hi; f++) out.push({ fret: f, x: laneX(f, activeFret) });
  return out;
}
