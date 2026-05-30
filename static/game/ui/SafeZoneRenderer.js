import * as THREE from '../vendor/three.module.js';
import { STRING_COLORS, STRING_SAFE_ZONE_FILLS, stringToLaneIndex } from './tokens.js';
import { SPAWN_Z } from '../TrackSystem.js';
import { applyWorldCurve } from '../SceneManager.js';

const SAFE_ZONE_DEPTH = 20;

function makeLabel(text) {
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
  ctx.strokeText(text, 32, 32);
  ctx.fillText(text, 32, 32);
  // Upright textured quad (not a Sprite): a Sprite billboards via three's SpritePlugin
  // and cannot be touched by the world-curve vertex shader, so it floats off the
  // dropped track. A curve-wrapped mesh laid FLAT on the track reads poorly at the
  // camera's shallow pitch, so we stand it VERTICAL like a little sign: being thin in
  // Z, the bend translates it straight down onto the curve (same as buildings) while
  // keeping it upright and readable. Parent safe zone is rotated -π/2, so
  // rotation.x=+π/2 cancels that → the quad stands world-upright facing the camera
  // (+Z). Local +Z maps to world +Y, so position z raises its base onto the track.
  // Material params match the SceneManager prewarm label exactly so the compiled
  // program is reused (no spike). renderOrder draws it over fill + border.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8),
    applyWorldCurve(new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }))
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, 0, 0.4);
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * SafeZoneRenderer handles the visualization of safe tracks.
 * Renders colored highlights on the subway tracks to guide the player.
 */
export class SafeZoneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.zones = new Map(); // wave_id -> { fill: Mesh, border: LineSegments }
    // Shared plane geometry reused for both fill and border EdgeGeometry source.
    this.geometry = new THREE.PlaneGeometry(1.2, SAFE_ZONE_DEPTH, 1, 16);
    this._expectedNoteIndex = undefined; // Story 9-1: set by setExpectedNoteIndex()
  }

  // Build a { fill, border } zone pair for a given low→high palette index.
  _makeZoneMeshes(paletteIdx) {
    const fillColor = paletteIdx < STRING_SAFE_ZONE_FILLS.length
      ? STRING_SAFE_ZONE_FILLS[paletteIdx]
      : STRING_SAFE_ZONE_FILLS[0];
    const borderColor = paletteIdx < STRING_COLORS.length
      ? STRING_COLORS[paletteIdx]
      : STRING_COLORS[0];

    const fill = new THREE.Mesh(
      this.geometry,
      applyWorldCurve(new THREE.MeshStandardMaterial({
        color: fillColor,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        side: THREE.DoubleSide,
        dithering: true,
      }))
    );
    fill.renderOrder = 0;
    fill.rotation.x = -Math.PI / 2;

    // EdgesGeometry on PlaneGeometry = exactly 4 perimeter edges, no internal diagonals.
    // Scale the border mesh slightly larger than the fill so the neon outline overhangs
    // visibly on all sides. linewidth > 1 is not supported in WebGL; scale is the
    // standard Three.js approach for a thicker outline effect.
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.geometry),
      applyWorldCurve(new THREE.LineBasicMaterial({ color: borderColor }))
    );
    border.renderOrder = 1;
    border.rotation.x = -Math.PI / 2;
    border.scale.set(1.18, 1, 1.06);

    return { fill, border };
  }

  update(waves, currentTrack, laneXFn, nowMs, gameStartTime, instrument) {
    // Store expectedNoteIndex for isAnyPrimarySafeZoneAdjacent.
    // Waves with note_index matching expectedNoteIndex are considered primary.
    // This prevents stale pre-spawned waves from being treated as primary
    // when _nextWaveNoteIndex has drifted from Run.cursor (Story 9-1).
    const expectedNoteIndex = this._expectedNoteIndex;
    // Clean up old waves — but only if they've visually passed the player.
    // Waves absent from the backend list but still in front of z=0 are kept alive
    // AND continue to be positioned each frame using their cached userData.
    const waveMap = new Map(waves.map(w => [w.wave_id, w]));
    for (const [id, zone] of this.zones.entries()) {
      if (!waveMap.has(id)) {
        const wdata = zone.fill.userData;
        if (wdata && wdata.spawn_time_ms !== undefined) {
          const elapsed = Math.max(0, nowMs - gameStartTime - wdata.spawn_time_ms);
          const z = SPAWN_Z + (elapsed * wdata.speed_px_per_ms * 0.5) + (SAFE_ZONE_DEPTH / 2);
          if (z < 0) {
            // Still in front of player — keep moving it so it doesn't freeze.
            zone.fill.position.z = z;
            zone.border.position.z = z;
            continue;
          }
        }
        this.scene.remove(zone.fill);
        this.scene.remove(zone.border);
        zone.fill.material?.dispose();
        zone.border.geometry?.dispose();
        zone.border.material?.dispose();
        this.zones.delete(id);
      }
    }

    // Add/Update current waves
    waves.forEach(wave => {
      let zone = this.zones.get(wave.wave_id);
      let isNew = false;
      if (!zone) {
        // Compute palette index for this wave's string.
        const stringCount = (instrument && instrument.stringCount) || 6;
        const paletteIdx = stringToLaneIndex(wave.safe_string, stringCount);
        zone = this._makeZoneMeshes(paletteIdx);
        this.scene.add(zone.fill);
        this.scene.add(zone.border);
        this.zones.set(wave.wave_id, zone);
        isNew = true;
      }

      const fill = zone.fill;
      const prevFret = fill.userData.safe_fret;
      // Preserve cachedX across userData rewrite so post-variant waves don't
      // re-snap to the new offset on subsequent frames.
      const cachedX = fill.userData.cachedX;
      // Use property assignment (not full object replacement) so other code
      // that stores data on fill.userData doesn't get silently destroyed (D1).
      fill.userData.spawn_time_ms = wave.spawn_time_ms;
      fill.userData.speed_px_per_ms = wave.speed_px_per_ms;
      fill.userData.safe_midi = wave.safe_midi;
      fill.userData.safe_fret = wave.safe_fret;
      fill.userData.note_index = wave.note_index;
      fill.userData.cachedX = cachedX;

      if (wave.safe_fret != null && wave.safe_fret !== prevFret) {
        const old = fill.getObjectByName('sz-label');
        if (old) {
          old.material?.map?.dispose();
          old.material?.dispose();
          fill.remove(old);
        }
        const label = makeLabel(wave.safe_fret.toString());
        label.name = 'sz-label';
        fill.add(label);
      }

      // Capture X exactly once on creation. After a variant transition the laneXFn
      // returns offset-adjusted coordinates, but already-in-flight safe zones must
      // stay at their original X — only newly-spawned waves get the new offset.
      if (isNew || fill.userData.cachedX == null) {
        const rawX = laneXFn(wave.safe_track);
        fill.userData.cachedX = (rawX != null && isFinite(rawX)) ? rawX : 0;
      }
      const x = fill.userData.cachedX;
      const elapsed = Math.max(0, nowMs - gameStartTime - wave.spawn_time_ms);
      const z = SPAWN_Z + (elapsed * wave.speed_px_per_ms * 0.5) + (SAFE_ZONE_DEPTH / 2);

      fill.position.set(x, 0.05, z);
      fill.visible = elapsed > 0;
      // Border sits fractionally above fill to avoid z-fighting without extra polygonOffset.
      zone.border.position.set(x, 0.06, z);
      zone.border.visible = elapsed > 0;
    });
  }

  isAnyPrimarySafeZoneAdjacent(midi, expectedNoteIndex) {
    for (const [, zone] of this.zones.entries()) {
      if (midi !== undefined && zone.fill.userData.safe_midi !== midi) continue;
      // Story 9-1: Only consider waves whose note_index matches Run.cursor.
      // This prevents stale pre-spawned waves (where _nextWaveNoteIndex has
      // drifted from cursor) from being treated as the current primary zone.
      if (expectedNoteIndex !== undefined && zone.fill.userData.note_index !== expectedNoteIndex) continue;
      if (Math.abs(zone.fill.position.z) <= SAFE_ZONE_DEPTH / 2) return true;
    }
    return false;
  }

  setExpectedNoteIndex(index) {
    this._expectedNoteIndex = index;
  }

  reset() {
    for (const zone of this.zones.values()) {
      // Dispose label sprite material + texture to prevent GPU memory leak (P1).
      const label = zone.fill.getObjectByName('sz-label');
      if (label) {
        label.material?.map?.dispose();
        label.material?.dispose();
      }
      this.scene.remove(zone.fill);
      this.scene.remove(zone.border);
      zone.fill.material?.dispose();
      zone.border.geometry?.dispose();
      zone.border.material?.dispose();
    }
    this.zones.clear();
  }
}
