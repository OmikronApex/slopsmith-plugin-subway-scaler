// Red-phase ATDD scaffold — Story 1.2: GameState module with PHASES constants

import { describe, it, expect } from 'vitest';
// TODO: GameState.js does not exist yet — import will fail until implementation
import { GameState, PHASES } from '../../../static/game/GameState.js';

describe('GameState module', () => {
  describe('exports', () => {
    it('exports a GameState object', () => {
      expect(GameState).toBeDefined();
      expect(typeof GameState).toBe('object');
    });

    it('exports PHASES with all required phase values', () => {
      expect(PHASES).toBeDefined();
      expect(typeof PHASES).toBe('object');
    });
  });

  describe('PHASES constants', () => {
    it('PHASES.IDLE equals "idle"', () => {
      expect(PHASES.IDLE).toBe('idle');
    });

    it('PHASES.PLAYING equals "playing"', () => {
      expect(PHASES.PLAYING).toBe('playing');
    });

    it('PHASES.PAUSED equals "paused"', () => {
      expect(PHASES.PAUSED).toBe('paused');
    });

    it('PHASES.GAME_OVER equals "game_over"', () => {
      expect(PHASES.GAME_OVER).toBe('game_over');
    });

    it('PHASES.RESTARTING equals "restarting"', () => {
      expect(PHASES.RESTARTING).toBe('restarting');
    });

    it('PHASES has exactly the 5 expected keys', () => {
      const keys = Object.keys(PHASES);
      expect(keys).toHaveLength(5);
      expect(keys).toContain('IDLE');
      expect(keys).toContain('PLAYING');
      expect(keys).toContain('PAUSED');
      expect(keys).toContain('GAME_OVER');
      expect(keys).toContain('RESTARTING');
    });
  });

  describe('GameState.runtime', () => {
    it('GameState.runtime.phase initialises to PHASES.IDLE', () => {
      expect(GameState.runtime.phase).toBe(PHASES.IDLE);
    });

    it('GameState.runtime has key score', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.runtime, 'score')).toBe(true);
    });

    it('GameState.runtime has key speed', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.runtime, 'speed')).toBe(true);
    });

    it('GameState.runtime has key phase', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.runtime, 'phase')).toBe(true);
    });

    it('GameState.runtime has key currentNote', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.runtime, 'currentNote')).toBe(true);
    });
  });

  describe('GameState.session', () => {
    it('GameState.session has key scale', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.session, 'scale')).toBe(true);
    });

    it('GameState.session has key rootMidi', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.session, 'rootMidi')).toBe(true);
    });

    it('GameState.session has key difficulty', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.session, 'difficulty')).toBe(true);
    });

    it('GameState.session has key instrument', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.session, 'instrument')).toBe(true);
    });
  });

  describe('GameState.scene', () => {
    it('GameState.scene has key carts which is an array', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.scene, 'carts')).toBe(true);
      expect(Array.isArray(GameState.scene.carts)).toBe(true);
    });

    it('GameState.scene has key tracks which is an array', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.scene, 'tracks')).toBe(true);
      expect(Array.isArray(GameState.scene.tracks)).toBe(true);
    });

    it('GameState.scene has key character which is an object', () => {
      expect(Object.prototype.hasOwnProperty.call(GameState.scene, 'character')).toBe(true);
      expect(typeof GameState.scene.character).toBe('object');
      expect(GameState.scene.character).not.toBeNull();
    });
  });
});
