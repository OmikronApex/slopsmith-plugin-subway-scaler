import { CartMovement } from './CartMovement.js';

export class CartPool {
  constructor(renderer, trackConfig) {
    this.renderer = renderer;
    this.trackConfig = trackConfig;
    this.carts = []; // Array of { movement, mesh }
  }

  spawn(id, noteId, noteDurationMs, colourHex, fret, initialZ) {
    const movement = new CartMovement({
      id,
      noteId,
      noteDurationMs,
      spawnZ: initialZ ?? this.trackConfig.spawnZ,
      exitBoundaryZ: this.trackConfig.exitBoundaryZ,
      fret
    });
    
    const mesh = this.renderer.createMesh(movement, colourHex);
    this.carts.push({ movement, mesh });
    return movement;
  }

  updateAll(deltaTimeMs, speedMultiplier, anchorFret) {
    const toRemoveIndices = [];
    for (let i = 0; i < this.carts.length; i++) {
      const c = this.carts[i];
      const posZ = c.movement.updatePosition(deltaTimeMs, speedMultiplier);
      this.renderer.updateMeshPosition(c.mesh, posZ, c.movement.fret, anchorFret);
      
      // If exiting and animation finished, mark for removal
      if (c.movement.state === 'exiting' && (c.movement.elapsed - c.movement.exitTimeStart) >= 300) {
        toRemoveIndices.push(i);
      }
    }
    
    for (let i = toRemoveIndices.length - 1; i >= 0; i--) {
      const idx = toRemoveIndices[i];
      const c = this.carts[idx];
      this.renderer.removeMesh(c.mesh);
      this.carts.splice(idx, 1);
    }
  }

  handleExpirations() {
    for (const c of this.carts) {
      if (c.movement.isExpired() && c.movement.state !== 'exiting') {
        c.movement.startExit();
      }
    }
  }

  clear() {
    for (const c of this.carts) {
      this.renderer.removeMesh(c.mesh);
    }
    this.carts = [];
  }

  spawnInitialCarts(sequencePositions, getColourFn, timerDurationMs) {
    this.clear();
    const spacing = 10.0; // distance between carts on Z
    for (let i = 0; i < Math.min(2, sequencePositions.length); i++) {
      const pos = sequencePositions[i];
      if (!pos) continue;
      const id = `cart-${i}`;
      const colour = getColourFn(pos.stringIdx);
      // stagger initial position so they aren't on top of each other
      const initialZ = this.trackConfig.exitBoundaryZ - (i * spacing);
      this.spawn(id, id, timerDurationMs, colour, pos.fret, initialZ);
    }
  }

  spawnNextCart(id, pos, getColourFn, timerDurationMs) {
    if (!pos) return;
    const colour = getColourFn(pos.stringIdx);
    this.spawn(id, id, timerDurationMs, colour, pos.fret);
  }

  playNoteCorrect(id) {
    const cart = this.carts.find(c => c.movement.id === id);
    if (cart && cart.movement.state !== 'exiting') {
      cart.movement.startExit();
      return true;
    }
    return false;
  }
}
