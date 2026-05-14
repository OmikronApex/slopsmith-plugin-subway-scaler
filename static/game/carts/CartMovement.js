import { easeInQuad, easeOutQuad } from '../utils/easing.js';

/**
 * Handles the calculation of a single cart's movement along the Z-axis.
 * Supports different states: entering, active, and exiting.
 */
export class CartMovement {
  /**
   * Calculates baseline speed to cover trackLength in timerDurationMs.
   * @param {number} trackLength 
   * @param {number} timerDurationMs 
   * @returns {number} units per millisecond
   */
  static calculateSpeed(trackLength, timerDurationMs) {
    if (timerDurationMs <= 0) return 0;
    return trackLength / timerDurationMs;
  }

  constructor(config) {
    this.id = config.id;
    this.noteId = config.noteId;
    this.noteDurationMs = config.noteDurationMs;
    this.spawnZ = config.spawnZ;
    this.exitBoundaryZ = config.exitBoundaryZ;
    this.fret = config.fret;
    this.positionZ = config.spawnZ;
    
    const trackLength = Math.abs(this.exitBoundaryZ - this.spawnZ);
    this.baselineSpeed = CartMovement.calculateSpeed(trackLength, this.noteDurationMs);
    
    this.elapsed = 0;
    this.entryTimeStart = 0;
    this.exitTimeStart = 0;
    this.state = 'entering'; 
  }

  updatePosition(deltaTimeMs, speedMultiplier) {
    this.elapsed += deltaTimeMs;
    const currentSpeed = this.baselineSpeed * speedMultiplier;
    const direction = this.exitBoundaryZ > this.spawnZ ? 1 : -1;

    if (this.state === 'exiting') {
      const t = Math.min(300, this.elapsed - this.exitTimeStart);
      const easingFactor = easeInQuad(t, 300);
      const boostedSpeed = currentSpeed * (1 + easingFactor * 5); 
      this.positionZ += direction * boostedSpeed * deltaTimeMs;
    } else if (this.state === 'entering') {
      const t = Math.min(300, this.elapsed - this.entryTimeStart);
      const easingFactor = easeOutQuad(t, 300);
      const boostedSpeed = currentSpeed * (5 - easingFactor * 4); 
      this.positionZ += direction * boostedSpeed * deltaTimeMs;
      if (t >= 300) this.state = 'active';
    } else {
      this.positionZ += direction * currentSpeed * deltaTimeMs;
    }
    
    return this.positionZ;
  }

  startExit() {
    this.state = 'exiting';
    this.exitTimeStart = this.elapsed;
  }

  isExpired() {
    return this.elapsed >= this.noteDurationMs && this.state !== 'exiting';
  }
}
