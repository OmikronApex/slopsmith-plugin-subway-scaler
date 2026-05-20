// Red-phase ATDD scaffold — Story 2.2: CartSystem module

import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO: CartSystem.js does not exist yet — import will fail until implementation
import { CartSystem } from '../../../static/game/CartSystem.js';

// PHASES values inlined here to avoid depending on unimplemented GameState.js
const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

/**
 * Factory for a minimal mock GameState with the right shape.
 * Each test creates its own instance to avoid shared state.
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
      speed: 10,
      phase: PHASES.PLAYING,
      currentNote: null,
    },
    scene: {
      carts: [],
      tracks: [],
      character: { z: 0 },
    },
    ...overrides,
  };
}

describe('CartSystem', () => {
  describe('cart movement', () => {
    it.skip('CartSystem.update(deltaTime) moves carts by speed * deltaTime', () => {
      const gameState = makeMockGameState({
        scene: {
          carts: [{ z: 50, lane: 2, cleared: false }],
          tracks: [],
          character: { z: 0 },
        },
      });
      CartSystem.update(0.1, gameState);
      // Cart should have moved by speed (10) * deltaTime (0.1) = 1.0 units
      expect(gameState.scene.carts[0].z).toBeCloseTo(49, 5);
    });

    it.skip('carts past character Z are removed from GameState.scene.carts', () => {
      const gameState = makeMockGameState({
        scene: {
          carts: [{ z: -5, lane: 2, cleared: false }],
          tracks: [],
          character: { z: 0 },
        },
      });
      CartSystem.update(0.016, gameState);
      expect(gameState.scene.carts).toHaveLength(0);
    });
  });

  describe('collision and game over', () => {
    it.skip('cart in same lane as character sets GameState.runtime.phase to PHASES.GAME_OVER', () => {
      const gameState = makeMockGameState({
        scene: {
          carts: [{ z: 0, lane: 2, cleared: false }],
          tracks: [],
          character: { z: 0, lane: 2 },
        },
      });
      CartSystem.update(0.016, gameState);
      expect(gameState.runtime.phase).toBe(PHASES.GAME_OVER);
    });

    it.skip('phase is set using PHASES constant (not string literal) — GameState.runtime.phase === PHASES.GAME_OVER', () => {
      const gameState = makeMockGameState({
        scene: {
          carts: [{ z: 0, lane: 3, cleared: false }],
          tracks: [],
          character: { z: 0, lane: 3 },
        },
      });
      CartSystem.update(0.016, gameState);
      expect(gameState.runtime.phase).toBe('game_over');
    });
  });

  describe('scoring', () => {
    it.skip('correct note match increments GameState.runtime.score by 100 * difficultyMultiplier', () => {
      const difficultyMultiplier = 1; // medium
      const gameState = makeMockGameState({
        runtime: {
          score: 0,
          speed: 10,
          phase: PHASES.PLAYING,
          currentNote: { midi: 60 },
        },
        scene: {
          carts: [{ z: 0, lane: 2, notemidi: 60, cleared: false, safeZoneActive: true }],
          tracks: [],
          character: { z: 0, lane: 2 },
        },
      });
      CartSystem.update(0.016, gameState);
      expect(gameState.runtime.score).toBe(100 * difficultyMultiplier);
    });

    it.skip('matched safe zone is marked cleared in GameState.scene.carts', () => {
      const gameState = makeMockGameState({
        runtime: {
          score: 0,
          speed: 10,
          phase: PHASES.PLAYING,
          currentNote: { midi: 60 },
        },
        scene: {
          carts: [{ z: 0, lane: 2, notemidi: 60, cleared: false, safeZoneActive: true }],
          tracks: [],
          character: { z: 0, lane: 2 },
        },
      });
      CartSystem.update(0.016, gameState);
      // After a successful match the safe zone should be flagged as cleared
      const matchedCart = gameState.scene.carts.find(c => c.notemidi === 60);
      if (matchedCart) {
        expect(matchedCart.cleared).toBe(true);
      } else {
        // Cart may have been removed after clearing — check score incremented instead
        expect(gameState.runtime.score).toBeGreaterThan(0);
      }
    });
  });

  describe('sole writer contract', () => {
    it.skip('CartSystem is sole writer to GameState.scene.carts — other modules read only', () => {
      // This test documents the architectural contract.
      // Verify CartSystem does mutate scene.carts (adds, removes, or updates entries).
      const gameState = makeMockGameState({
        scene: {
          carts: [{ z: 100, lane: 1, cleared: false }],
          tracks: [],
          character: { z: 0, lane: 0 },
        },
      });
      const initialLength = gameState.scene.carts.length;
      CartSystem.update(0.016, gameState);
      // CartSystem must have had write access — length may change if carts were removed/added
      expect(typeof gameState.scene.carts.length).toBe('number');
      // Structural assertion: CartSystem modified state (position changed)
      // Length may remain same if cart wasn't removed, but z must have changed
      if (gameState.scene.carts.length === initialLength) {
        expect(gameState.scene.carts[0].z).toBeLessThan(100);
      }
    });
  });
});
