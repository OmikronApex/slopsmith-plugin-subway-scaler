// Red-phase ATDD scaffold — Story 2.3: DifficultyManager module + Story 5.1: variant offer trigger

import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO: DifficultyManager.js does not exist yet — import will fail until implementation
import { DifficultyManager } from '../../../static/game/DifficultyManager.js';

// PHASES values inlined to avoid depending on unimplemented GameState.js
const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

/**
 * Factory for a minimal mock GameState with the right shape.
 */
function makeMockGameState(overrides = {}) {
  return {
    session: {
      scale: null,
      rootMidi: 60,
      difficulty: 'medium',
      instrument: 'guitar-standard',
    },
    runtime: {
      score: 0,
      speed: 5,
      phase: PHASES.PLAYING,
      currentNote: null,
    },
    scene: {
      carts: [],
      tracks: [],
      character: {},
    },
    ...overrides,
  };
}

describe('DifficultyManager — core (Story 2.3)', () => {
  describe('initialisation', () => {
    it('new DifficultyManager("easy") initialises with easy base speed', () => {
      const dm = new DifficultyManager('easy');
      expect(dm.baseSpeed).toBeGreaterThan(0);
      // easy base speed should be the lowest
      const dmMedium = new DifficultyManager('medium');
      expect(dm.baseSpeed).toBeLessThan(dmMedium.baseSpeed);
    });

    it('new DifficultyManager("medium") initialises with medium base speed (higher than easy)', () => {
      const dmEasy = new DifficultyManager('easy');
      const dmMedium = new DifficultyManager('medium');
      expect(dmMedium.baseSpeed).toBeGreaterThan(dmEasy.baseSpeed);
    });

    it('new DifficultyManager("hard") initialises with hard base speed (higher than medium)', () => {
      const dmMedium = new DifficultyManager('medium');
      const dmHard = new DifficultyManager('hard');
      expect(dmHard.baseSpeed).toBeGreaterThan(dmMedium.baseSpeed);
    });
  });

  describe('tick()', () => {
    it('tick(true) increases GameState.runtime.speed by 5% of current speed', () => {
      const gameState = makeMockGameState({ runtime: { score: 0, speed: 100, phase: PHASES.PLAYING, currentNote: null } });
      const dm = new DifficultyManager('medium');
      const speedBefore = gameState.runtime.speed;
      dm.tick(true, gameState);
      expect(gameState.runtime.speed).toBeCloseTo(speedBefore * 1.05, 5);
    });

    it('tick(false) does NOT change GameState.runtime.speed', () => {
      const gameState = makeMockGameState({ runtime: { score: 0, speed: 100, phase: PHASES.PLAYING, currentNote: null } });
      const dm = new DifficultyManager('medium');
      const speedBefore = gameState.runtime.speed;
      dm.tick(false, gameState);
      expect(gameState.runtime.speed).toBe(speedBefore);
    });

    it('tick(true) never allows speed to exceed the difficulty cap constant', () => {
      const gameState = makeMockGameState({ runtime: { score: 0, speed: 1_000_000, phase: PHASES.PLAYING, currentNote: null } });
      const dm = new DifficultyManager('hard');
      dm.tick(true, gameState);
      expect(gameState.runtime.speed).toBeLessThanOrEqual(dm.speedCap);
    });

    it('DifficultyManager is sole writer to GameState.runtime.speed', () => {
      // Architectural contract: only DifficultyManager.tick() mutates runtime.speed.
      // Verify DifficultyManager does write to it.
      const gameState = makeMockGameState({ runtime: { score: 0, speed: 10, phase: PHASES.PLAYING, currentNote: null } });
      const dm = new DifficultyManager('medium');
      dm.tick(true, gameState);
      expect(gameState.runtime.speed).toBeGreaterThan(10);
    });
  });
});

describe('DifficultyManager — variant offer (Story 5.1)', () => {
  it('after configured loop count, DifficultyManager emits a variant offer (calls callback or fires event)', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    const gameState = makeMockGameState();
    // Simulate enough loops to trigger the variant offer
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    expect(onVariantOffer).toHaveBeenCalled();
  });

  it('variant offer includes +5 semitones and -2 semitones options relative to current root', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    const gameState = makeMockGameState({ session: { scale: null, rootMidi: 60, difficulty: 'medium', instrument: 'guitar-standard' } });
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    const [callArgs] = onVariantOffer.mock.calls;
    const offer = callArgs[0];
    expect(offer).toBeDefined();
    const optionRootMidis = offer.options.map(o => o.rootMidi);
    expect(optionRootMidis).toContain(60 + 5); // +5 semitones
    expect(optionRootMidis).toContain(60 - 2); // -2 semitones
  });

  it('both variant options keep root_midi within [21, 108]', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    const gameState = makeMockGameState();
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    const [callArgs] = onVariantOffer.mock.calls;
    const offer = callArgs[0];
    for (const option of offer.options) {
      expect(option.rootMidi).toBeGreaterThanOrEqual(21);
      expect(option.rootMidi).toBeLessThanOrEqual(108);
    }
  });

  it('if +5 semitones would exceed 108, it is replaced with an in-range option', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    // rootMidi 106: +5 would be 111 (> 108)
    const gameState = makeMockGameState({ session: { scale: null, rootMidi: 106, difficulty: 'medium', instrument: 'guitar-standard' } });
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    const [callArgs] = onVariantOffer.mock.calls;
    const offer = callArgs[0];
    for (const option of offer.options) {
      expect(option.rootMidi).toBeLessThanOrEqual(108);
    }
  });

  it('if -2 semitones would go below 21, it is replaced with an in-range option', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    // rootMidi 22: -2 would be 20 (< 21)
    const gameState = makeMockGameState({ session: { scale: null, rootMidi: 22, difficulty: 'medium', instrument: 'guitar-standard' } });
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    const [callArgs] = onVariantOffer.mock.calls;
    const offer = callArgs[0];
    for (const option of offer.options) {
      expect(option.rootMidi).toBeGreaterThanOrEqual(21);
    }
  });

  it('hard difficulty offers variants more frequently than easy', () => {
    const dmEasy = new DifficultyManager('easy');
    const dmHard = new DifficultyManager('hard');
    // Fewer loops needed between offers = more frequent
    expect(dmHard.variantOfferLoopCount).toBeLessThan(dmEasy.variantOfferLoopCount);
  });

  it('when decision window expires without acceptance, loop counter resets and no penalty is applied', () => {
    const onVariantOffer = vi.fn();
    const dm = new DifficultyManager('medium', { onVariantOffer });
    const gameState = makeMockGameState({ runtime: { score: 100, speed: 10, phase: PHASES.PLAYING, currentNote: null } });
    for (let i = 0; i < dm.variantOfferLoopCount + 1; i++) {
      dm.onLoopComplete(gameState);
    }
    const scoreBefore = gameState.runtime.score;
    dm.onDecisionWindowExpired(gameState);
    // Score unchanged — no penalty
    expect(gameState.runtime.score).toBe(scoreBefore);
    // Loop counter resets
    expect(dm.loopCount).toBe(0);
  });
});
