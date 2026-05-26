import * as THREE from '../vendor/three.module.js';
import { colourForString } from './tokens.js';
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
    this.zones = new Map(); // wave_id -> mesh
    this.geometry = new THREE.PlaneGeometry(1.2, SAFE_ZONE_DEPTH);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
  }

  update(waves, currentTrack, laneXFn, nowMs, gameStartTime, instrument) {
    // Clean up old waves — but only if they've visually passed the player.
    // Waves absent from the backend list but still in front of z=0 are kept alive
    // AND continue to be positioned each frame using their cached userData.
    const waveMap = new Map(waves.map(w => [w.wave_id, w]));
    for (const [id, mesh] of this.zones.entries()) {
      if (!waveMap.has(id)) {
        const wdata = mesh.userData;
        if (wdata && wdata.spawn_time_ms !== undefined) {
          const elapsed = Math.max(0, nowMs - gameStartTime - wdata.spawn_time_ms);
          const z = SPAWN_Z + (elapsed * wdata.speed_px_per_ms * 0.5) + (SAFE_ZONE_DEPTH / 2);
          if (z < 0) {
            // Still in front of player — keep moving it so it doesn't freeze.
            mesh.position.z = z;
            continue;
          }
        }
        this.scene.remove(mesh);
        this.zones.delete(id);
      }
    }

    // Add/Update current waves
    waves.forEach(wave => {
      let mesh = this.zones.get(wave.wave_id);
      let isNew = false;
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.material.clone());
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this.zones.set(wave.wave_id, mesh);
        isNew = true;
      }
      const prevFret = mesh.userData.safe_fret;
      // Preserve cachedX across userData rewrite so post-variant waves don't
      // re-snap to the new offset on subsequent frames.
      const cachedX = mesh.userData.cachedX;
      // Use property assignment (not full object replacement) so other code
      // that stores data on mesh.userData doesn't get silently destroyed (D1).
      mesh.userData.spawn_time_ms = wave.spawn_time_ms;
      mesh.userData.speed_px_per_ms = wave.speed_px_per_ms;
      mesh.userData.safe_midi = wave.safe_midi;
      mesh.userData.safe_fret = wave.safe_fret;
      mesh.userData.cachedX = cachedX;

      if (wave.safe_fret != null && wave.safe_fret !== prevFret) {
        const old = mesh.getObjectByName('sz-label');
        if (old) {
          old.material?.map?.dispose();
          old.material?.dispose();
          mesh.remove(old);
        }
        const label = makeLabel(wave.safe_fret.toString());
        label.name = 'sz-label';
        mesh.add(label);
      }

      // Capture X exactly once on creation. After a variant transition the laneXFn
      // returns offset-adjusted coordinates, but already-in-flight safe zones must
      // stay at their original X — only newly-spawned waves get the new offset.
      if (isNew || mesh.userData.cachedX == null) {
        const rawX = laneXFn(wave.safe_track);
        mesh.userData.cachedX = (rawX != null && isFinite(rawX)) ? rawX : 0;
      }
      const x = mesh.userData.cachedX;
      const elapsed = Math.max(0, nowMs - gameStartTime - wave.spawn_time_ms);
      const z = SPAWN_Z + (elapsed * wave.speed_px_per_ms * 0.5) + (SAFE_ZONE_DEPTH / 2);

      mesh.position.set(x, 0.05, z);
      mesh.visible = elapsed > 0;
      
      // Safe zone color corresponds to the string used
      // Tabulator uses string 1 = highest pitch, so invert: lowest string → idx 0 (Red)
      const stringCount = (instrument && instrument.stringCount) || 6;
      const paletteIdx = wave.safe_string != null ? (stringCount - wave.safe_string) : 0;
      const color = colourForString(paletteIdx, instrument);
      mesh.material.color.setHex(color);
    });
  }

  isAnyPrimarySafeZoneAdjacent(midi) {
    for (const [, mesh] of this.zones.entries()) {
      if (midi !== undefined && mesh.userData.safe_midi !== midi) continue;
      if (Math.abs(mesh.position.z) <= SAFE_ZONE_DEPTH / 2) return true;
    }
    return false;
  }

  reset() {
    for (const mesh of this.zones.values()) {
      // Dispose label sprite material + texture to prevent GPU memory leak (P1).
      const label = mesh.getObjectByName('sz-label');
      if (label) {
        label.material?.map?.dispose();
        label.material?.dispose();
      }
      this.scene.remove(mesh);
    }
    this.zones.clear();
  }
}
