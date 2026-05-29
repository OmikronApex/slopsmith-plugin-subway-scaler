// Pure geometry helpers for the vertical subway scene.
//
// Lanes (columns) = frets, equally distanced.
// Rows (depth) = strings. Row 0 (lowest pitch) sits at the front (largest Z).
// See specs/003-guitar-subway-scaler/research.md §4–§5.

import { colourForString, stringToLaneIndex } from './ui/tokens.js';

export const LANE_X_SCALE = 1.6;
export const ROW_DZ = 3.0;
export const WINDOW = 9;
export const QUEUE_DZ = 2.2;
export const SPAWN_Z = -100;

export function queueZ(queueIndex) {
  const z = -queueIndex * QUEUE_DZ;
  return z === 0 ? 0 : z;
}

export function laneX(stringIdx, stringCount) {
  return LANE_X_SCALE * (stringIdx - (stringCount - 1) / 2);
}

export function rowZ(stringIdx) {
  const z = -stringIdx * ROW_DZ;
  return z === 0 ? 0 : z;
}

// Camera placement for a given pitch angle (degrees) toward (0, 0, lookAtZ).
// pitchDeg = 0 is horizontal, 90 is looking straight down.
// distance is the Euclidean distance from the lookAt point.
export function cameraForPitch(pitchDeg, distance, lookAtZ = -2) {
  const rad = (pitchDeg * Math.PI) / 180;
  const y = distance * Math.sin(rad);
  const zRel = distance * Math.cos(rad);
  return { x: 0, y, z: zRel + lookAtZ, lookAt: [0, 0, lookAtZ], pitchDeg };
}

// Legacy helper for 45° pitch.
export function cameraFor45Deg(distance, lookAtZ = -2) {
  // To match old behavior where distance was the component:
  // old Y = distance, old Zrel = distance => true distance = sqrt(2) * distance.
  return cameraForPitch(45, distance * Math.SQRT2, lookAtZ);
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

// ===== TrackSystem — Story 3.2 =====

export const VARIANT_DIRECTION = {
  LOWER_FRET: 'left',
  HIGHER_FRET: 'right',
};

let _currentRootFret = 0;

export class TrackSystem {
  static init(sessionConfig, gameState) {
    const notes = sessionConfig.notes ?? [];
    _currentRootFret = notes[0]?.fret ?? 0;
    const instrument = sessionConfig.instrument ?? { stringCount: 6 };
    const stringCount = instrument.stringCount ?? 6;
    gameState.scene.tracks = [];
    for (let i = 0; i < sessionConfig.track_count; i++) {
      const note = notes[i];
      // note.string is 1-based from HIGH; convert to low→high palette index.
      const paletteIdx = stringToLaneIndex(note?.string, stringCount);
      gameState.scene.tracks.push({
        lane: i,
        note,
        color: '#1A1A2E',
        safeZoneColor: colourForString(paletteIdx, instrument),
        fretLabelColor: '#666680',
      });
    }
  }

  static showVariant(variantConfig, gameState) {
    const dir = (variantConfig.fret ?? 0) < _currentRootFret
      ? VARIANT_DIRECTION.LOWER_FRET
      : VARIANT_DIRECTION.HIGHER_FRET;
    gameState.scene.tracks.push({
      isVariant: true,
      slideDirection: dir,
      fretLabelColor: '#FFB800',
      note: variantConfig,
      lane: gameState.scene.tracks.length,
      color: '#1A1A2E',
      safeZoneColor: 0xFFB800,
    });
  }

  static hideVariant(gameState) {
    gameState.scene.tracks = gameState.scene.tracks.filter(t => !t.isVariant);
  }
}
