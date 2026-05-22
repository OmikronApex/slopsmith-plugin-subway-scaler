import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartSystem } from '../../../static/game/CartSystem.js';

const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

// SPAWN_Z = -100 (from TrackSystem.js)
const SPAWN_Z = -100;

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
      character: { z: 0, lane: 2 },
    },
    ...overrides,
  };
}

function makeWave(overrides = {}) {
  return {
    wave_id: 'w-0',
    wave_index: 0,
    safe_track: 2,
    safe_midi: 60,
    note_name: 'C4',
    spawn_time_ms: 0,
    speed_px_per_ms: 0.04,
    duration_ms: 2500,
    cleared: false,
    ...overrides,
  };
}

// game_now at which wave z ≈ characterZ (0)
// z = SPAWN_Z + elapsed * speed * 0.5 = 0
// elapsed = -SPAWN_Z / (speed * 0.5) = 100 / (0.04 * 0.5) = 5000
const WAVE_AT_PLAYER = 5000; // game_now where wave z = 0

describe('CartSystem', () => {
  describe('collision detection', () => {
    it('sets GAME_OVER when character is in a cart lane at the wave position', () => {
      const gameState = makeMockGameState({
        scene: { carts: [], tracks: [], character: { z: 0, lane: 0 } },
      });
      const waves = [makeWave({ safe_track: 2 })]; // character in lane 0, safe is 2 → collision
      CartSystem.update(WAVE_AT_PLAYER, gameState, waves);
      expect(gameState.runtime.phase).toBe(PHASES.GAME_OVER);
    });

    it('does not set GAME_OVER when character is in the safe lane', () => {
      const gameState = makeMockGameState({
        scene: { carts: [], tracks: [], character: { z: 0, lane: 2 } },
      });
      const waves = [makeWave({ safe_track: 2 })];
      CartSystem.update(WAVE_AT_PLAYER, gameState, waves);
      expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
    });

    it('does not set GAME_OVER when wave is far away', () => {
      const gameState = makeMockGameState({
        scene: { carts: [], tracks: [], character: { z: 0, lane: 0 } },
      });
      // game_now = 0, wave just spawned at z = SPAWN_Z = -100 — far from player
      const waves = [makeWave({ safe_track: 2 })];
      CartSystem.update(0, gameState, waves);
      expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
    });

    it('skips cleared waves during collision check', () => {
      const gameState = makeMockGameState({
        scene: { carts: [], tracks: [], character: { z: 0, lane: 0 } },
      });
      const waves = [makeWave({ safe_track: 2, cleared: true })];
      CartSystem.update(WAVE_AT_PLAYER, gameState, waves);
      expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
    });

    it('collision uses game_now and spawn_time_ms to derive z', () => {
      // spawn_time_ms = 1000; speed = 0.04; game_now = 6000 → elapsed = 5000 → z = 0
      const gameState = makeMockGameState({
        scene: { carts: [], tracks: [], character: { z: 0, lane: 0 } },
      });
      const waves = [makeWave({ spawn_time_ms: 1000, speed_px_per_ms: 0.04, safe_track: 2 })];
      CartSystem.update(6000, gameState, waves);
      expect(gameState.runtime.phase).toBe(PHASES.GAME_OVER);
    });
  });

  describe('scoring', () => {
    it('increments score and sets wave.cleared when current note matches wave.safe_midi', () => {
      const gameState = makeMockGameState({
        runtime: { score: 0, speed: 10, phase: PHASES.PLAYING, currentNote: { midi: 60 } },
        scene: { carts: [], tracks: [], character: { z: 0, lane: 2 } },
      });
      const waves = [makeWave({ safe_midi: 60 })];
      CartSystem.update(0, gameState, waves);
      expect(waves[0].cleared).toBe(true);
      expect(gameState.runtime.score).toBe(100 * 1.5); // medium multiplier
    });

    it('does not double-score already cleared waves', () => {
      const gameState = makeMockGameState({
        runtime: { score: 0, speed: 10, phase: PHASES.PLAYING, currentNote: { midi: 60 } },
        scene: { carts: [], tracks: [], character: { z: 0, lane: 2 } },
      });
      const waves = [makeWave({ safe_midi: 60, cleared: true })];
      CartSystem.update(0, gameState, waves);
      expect(gameState.runtime.score).toBe(0);
    });
  });

  describe('empty / missing waves', () => {
    it('does nothing when waves array is empty', () => {
      const gameState = makeMockGameState();
      expect(() => CartSystem.update(0, gameState, [])).not.toThrow();
    });

    it('does nothing when waves is null', () => {
      const gameState = makeMockGameState();
      expect(() => CartSystem.update(0, gameState, null)).not.toThrow();
    });
  });
});
