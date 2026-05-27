import * as THREE from '../vendor/three.module.js';
import { STRING_COLORS, STRING_SAFE_ZONE_FILLS } from './tokens.js';
import { SPAWN_Z } from '../TrackSystem.js';

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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
  sprite.scale.set(0.8, 0.8, 1);
  // Safe zone has rotation.x = -π/2, so local +Z maps to world +Y.
  sprite.position.set(0, 0, 0.5);
  return sprite;
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
    this.geometry = new THREE.PlaneGeometry(1.2, SAFE_ZONE_DEPTH);
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
      new THREE.MeshStandardMaterial({
        color: fillColor,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        side: THREE.DoubleSide,
        dithering: true,
      })
    );
    fill.renderOrder = 0;
    fill.rotation.x = -Math.PI / 2;

    // EdgesGeometry on PlaneGeometry = exactly 4 perimeter edges, no internal diagonals.
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.geometry),
      new THREE.LineBasicMaterial({ color: borderColor })
    );
    border.renderOrder = 1;
    border.rotation.x = -Math.PI / 2;

    return { fill, border };
  }

  update(waves, currentTrack, laneXFn, nowMs, gameStartTime, instrument) {
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
        const paletteIdx = wave.safe_string != null ? (stringCount - wave.safe_string) : 0;
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

  isAnyPrimarySafeZoneAdjacent(midi) {
    for (const [, zone] of this.zones.entries()) {
      if (midi !== undefined && zone.fill.userData.safe_midi !== midi) continue;
      if (Math.abs(zone.fill.position.z) <= SAFE_ZONE_DEPTH / 2) return true;
    }
    return false;
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
