// Red-phase ATDD scaffold — Story 3.2: TrackSystem init + Story 5.2: variant track geometry
// (Renamed/successor to grid.test.js)
//
// TODO: migrate existing grid.test.js tests here once TrackSystem wraps or replaces grid.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO: TrackSystem.js does not exist yet — import will fail until implementation
import { TrackSystem, VARIANT_DIRECTION } from '../../../static/game/TrackSystem.js';

// STRING_COLORS inlined to avoid depending on unimplemented tokens.js
const STRING_COLORS = {
  1: 0xFF3333,
  2: 0xFFDD00,
  3: 0x3366FF,
  4: 0xFF8800,
  5: 0x33AA33,
  6: 0x9933CC,
  7: 0xFF66AA,
};

// Expected track background color (Night City palette --color-bg-stage)
const COLOR_BG_STAGE = '#1A1A2E';

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
      phase: 'playing',
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

function makeMockSessionConfig(trackCount = 6) {
  return {
    track_count: trackCount,
    notes: Array.from({ length: trackCount }, (_, i) => ({
      midi: 60 + i,
      string: (i % 7) + 1,
      fret: i,
    })),
    scale: 'major',
    root_midi: 60,
    difficulty: 'medium',
    instrument_id: 'guitar-standard',
  };
}

describe('VARIANT_DIRECTION constants', () => {
  it.skip('VARIANT_DIRECTION.LOWER_FRET equals "left"', () => {
    expect(VARIANT_DIRECTION.LOWER_FRET).toBe('left');
  });

  it.skip('VARIANT_DIRECTION.HIGHER_FRET equals "right"', () => {
    expect(VARIANT_DIRECTION.HIGHER_FRET).toBe('right');
  });
});

describe('TrackSystem.init() — Story 3.2', () => {
  it.skip('TrackSystem.init(sessionConfig) populates GameState.scene.tracks with one lane per note', () => {
    const gameState = makeMockGameState();
    const sessionConfig = makeMockSessionConfig(6);
    TrackSystem.init(sessionConfig, gameState);
    expect(gameState.scene.tracks).toHaveLength(sessionConfig.track_count);
  });

  it.skip('lane count equals sessionConfig.track_count', () => {
    const gameState = makeMockGameState();
    const sessionConfig = makeMockSessionConfig(4);
    TrackSystem.init(sessionConfig, gameState);
    expect(gameState.scene.tracks).toHaveLength(4);
  });

  it.skip('each lane color matches --color-bg-stage (#1A1A2E)', () => {
    const gameState = makeMockGameState();
    const sessionConfig = makeMockSessionConfig(3);
    TrackSystem.init(sessionConfig, gameState);
    for (const lane of gameState.scene.tracks) {
      expect(lane.color).toBe(COLOR_BG_STAGE);
    }
  });

  it.skip('safe zone color matches STRING_COLORS[note.string]', () => {
    const gameState = makeMockGameState();
    const sessionConfig = makeMockSessionConfig(3);
    TrackSystem.init(sessionConfig, gameState);
    for (let i = 0; i < gameState.scene.tracks.length; i++) {
      const lane = gameState.scene.tracks[i];
      const note = sessionConfig.notes[i];
      expect(lane.safeZoneColor).toBe(STRING_COLORS[note.string]);
    }
  });

  it.skip('TrackSystem is the only module writing to GameState.scene.tracks', () => {
    // Architectural contract test: verify TrackSystem does write to scene.tracks
    const gameState = makeMockGameState();
    const sessionConfig = makeMockSessionConfig(3);
    expect(gameState.scene.tracks).toHaveLength(0);
    TrackSystem.init(sessionConfig, gameState);
    expect(gameState.scene.tracks.length).toBeGreaterThan(0);
  });
});

describe('TrackSystem variant tracks — Story 5.2', () => {
  let gameState;
  let sessionConfig;

  beforeEach(() => {
    gameState = makeMockGameState({ session: { scale: null, rootMidi: 60, difficulty: 'medium', instrument: 'guitar-standard' } });
    sessionConfig = makeMockSessionConfig(6);
    TrackSystem.init(sessionConfig, gameState);
  });

  it.skip('TrackSystem.showVariant({ rootMidi, fret }) adds a variant track to GameState.scene.tracks', () => {
    const trackCountBefore = gameState.scene.tracks.length;
    TrackSystem.showVariant({ rootMidi: 65, fret: 5 }, gameState);
    expect(gameState.scene.tracks.length).toBeGreaterThan(trackCountBefore);
  });

  it.skip('variant slides in from LEFT when variantConfig.fret < currentRootFret', () => {
    // Current root is fret 0 (rootMidi 60); variant at lower fret → slides from left
    TrackSystem.showVariant({ rootMidi: 55, fret: -5 }, gameState);
    const variantTrack = gameState.scene.tracks.find(t => t.isVariant);
    expect(variantTrack).toBeDefined();
    expect(variantTrack.slideDirection).toBe(VARIANT_DIRECTION.LOWER_FRET);
  });

  it.skip('variant slides in from RIGHT when variantConfig.fret > currentRootFret', () => {
    // Variant at higher fret → slides from right
    TrackSystem.showVariant({ rootMidi: 65, fret: 5 }, gameState);
    const variantTrack = gameState.scene.tracks.find(t => t.isVariant);
    expect(variantTrack).toBeDefined();
    expect(variantTrack.slideDirection).toBe(VARIANT_DIRECTION.HIGHER_FRET);
  });

  it.skip('TrackSystem.hideVariant() removes variant without changing current track geometry', () => {
    TrackSystem.showVariant({ rootMidi: 65, fret: 5 }, gameState);
    const regularTracksSnapshot = gameState.scene.tracks
      .filter(t => !t.isVariant)
      .map(t => JSON.stringify(t));
    TrackSystem.hideVariant(gameState);
    const remainingTracks = gameState.scene.tracks.filter(t => !t.isVariant);
    const remainingSnapshot = remainingTracks.map(t => JSON.stringify(t));
    // No variant tracks remain
    expect(gameState.scene.tracks.filter(t => t.isVariant)).toHaveLength(0);
    // Regular tracks unchanged
    expect(remainingSnapshot).toEqual(regularTracksSnapshot);
  });

  it.skip('variant lane fret label uses color-accent color (#FFB800)', () => {
    TrackSystem.showVariant({ rootMidi: 65, fret: 5 }, gameState);
    const variantTrack = gameState.scene.tracks.find(t => t.isVariant);
    expect(variantTrack).toBeDefined();
    expect(variantTrack.fretLabelColor).toBe('#FFB800');
  });
});
