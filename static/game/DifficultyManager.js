const BASE_SPEED = { easy: 10, medium: 16, hard: 25 };
const SPEED_CAP  = { easy: 100, medium: 200, hard: 400 };
const VARIANT_OFFER_LOOP_COUNT = { easy: 3, medium: 2, hard: 1 };

const VARIANT_SHIFT_UP   = 5;
const VARIANT_SHIFT_DOWN = 2;

export class DifficultyManager {
  constructor(difficulty, options = {}) {
    this.baseSpeed = BASE_SPEED[difficulty] ?? BASE_SPEED.medium;
    this.speedCap  = SPEED_CAP[difficulty]  ?? SPEED_CAP.medium;
    this.variantOfferLoopCount = VARIANT_OFFER_LOOP_COUNT[difficulty] ?? 2;
    this.loopCount = 0;
    this._onVariantOffer = options.onVariantOffer ?? null;
  }

  init(gameState) {
    gameState.runtime.speed = this.baseSpeed;
  }

  tick(noteDetected, gameState) {
    if (!noteDetected) return;
    gameState.runtime.speed = Math.min(gameState.runtime.speed * 1.05, this.speedCap);
  }

  onLoopComplete(gameState) {
    this.loopCount++;
    if (this.loopCount > this.variantOfferLoopCount) {
      const offer = this._buildOffer(gameState.session.rootMidi);
      if (this._onVariantOffer) this._onVariantOffer(offer);
      this.loopCount = 0;
    }
  }

  onDecisionWindowExpired(gameState) {
    this.loopCount = 0;
  }

  _buildOffer(rootMidi) {
    let upMidi   = rootMidi + VARIANT_SHIFT_UP;
    let downMidi = rootMidi - VARIANT_SHIFT_DOWN;
    if (upMidi > 108)   upMidi   = rootMidi - VARIANT_SHIFT_DOWN;
    if (downMidi < 21)  downMidi = rootMidi + VARIANT_SHIFT_UP;
    return {
      options: [
        { rootMidi: upMidi,   side: 'RIGHT' },
        { rootMidi: downMidi, side: 'LEFT'  },
      ],
    };
  }
}
