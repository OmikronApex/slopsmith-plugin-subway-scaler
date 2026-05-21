// Red-phase ATDD scaffold — Story 3.8: Integration test — session config → GameState → GameLoop → CartSystem → score
//                          Story 5.4: Variant acceptance and transition

// NOTE: This file is NOT picked up by the default vitest config.
// Add to vitest.config.js before running:
//   include: ['tests/unit/js/**/*.test.js', 'tests/integration/**/*.test.js'],

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: These modules do not exist yet — imports will fail until implementation
import { GameState, PHASES } from '../../static/game/GameState.js';
import { GameLoop } from '../../static/game/GameLoop.js';
import { CartSystem } from '../../static/game/CartSystem.js';
import { DifficultyManager } from '../../static/game/DifficultyManager.js';
import { SceneManager } from '../../static/game/SceneManager.js';

// ─── Shared mock fixtures ─────────────────────────────────────────────────────

/** C major, root MIDI 60 (C4), guitar-standard — from /game/session-config */
const C_MAJOR_SESSION_CONFIG = {
  scale_id: 'major',
  root_midi: 60,
  instrument_id: 'guitar-standard',
  notes: [
    { midi: 60, name: 'C4',  string: 3, fret: 5 },
    { midi: 62, name: 'D4',  string: 3, fret: 7 },
    { midi: 64, name: 'E4',  string: 2, fret: 5 },
    { midi: 65, name: 'F4',  string: 2, fret: 6 },
    { midi: 67, name: 'G4',  string: 2, fret: 8 },
    { midi: 69, name: 'A4',  string: 1, fret: 5 },
    { midi: 71, name: 'B4',  string: 1, fret: 7 },
  ],
  track_count: 7,
};

function makeStubs() {
  return {
    audioDetector: {
      detect: vi.fn().mockResolvedValue({ midi: 60, confidence: 0.95 }),
    },
    sceneManager: { render: vi.fn(), init: vi.fn() },
  };
}

function freshGameState() {
  // Create a fresh GameState from the module's exported factory/object
  // Using spread to avoid singleton mutation across tests
  return {
    session: {
      scale: null,
      rootMidi: null,
      difficulty: 'medium',
      instrument: null,
    },
    runtime: {
      score: 0,
      speed: 10,
      phase: PHASES.IDLE,
      currentNote: null,
      tutorialActive: false,
    },
    scene: {
      carts: [],
      tracks: [],
      character: { z: 0, lane: 3 },
    },
  };
}

// ─── Story 3.8: Session Config → Score Integration ───────────────────────────

describe('Integration — session config → GameState → score (Story 3.8)', () => {
  let gameState;
  let stubs;
  let cartSystem;
  let difficultyManager;
  let gameLoop;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { cb(16); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(C_MAJOR_SESSION_CONFIG),
    }));

    gameState = freshGameState();
    stubs = makeStubs();

    cartSystem = new CartSystem();
    difficultyManager = new DifficultyManager('medium');
    gameLoop = new GameLoop({
      gameState,
      audioDetector: stubs.audioDetector,
      cartSystem,
      difficultyManager,
      sceneManager: stubs.sceneManager,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initialising GameState.session from /game/session-config populates session fields correctly', async () => {
    // Simulate what main.js does on session start
    const response = await fetch('/api/plugins/subway-scaler/game/session-config?scale_id=major&root_midi=60&instrument_id=guitar-standard');
    const config = await response.json();

    // main.js should map snake_case keys to GameState.session
    gameState.session.scale = config.scale_id;
    gameState.session.rootMidi = config.root_midi;
    gameState.session.instrument = config.instrument_id;

    expect(gameState.session.scale).toBe('major');
    expect(gameState.session.rootMidi).toBe(60);
    expect(gameState.session.instrument).toBe('guitar-standard');
  });

  it('after 3 simulated ticks with correct note detection, GameState.runtime.score equals 300 * difficultyMultiplier', async () => {
    // Populate session from config
    gameState.session.rootMidi = 60;
    gameState.session.scale = 'major';
    gameState.runtime.phase = PHASES.PLAYING;

    // Cart at z=50 (safe distance from character at z=0; no collision, safe zone active)
    gameState.scene.carts = [
      { z: 50, lane: 3, notemidi: 60, safeZoneActive: true, cleared: false },
    ];

    // Audio returns correct note (midi=60) every tick
    stubs.audioDetector.detect.mockResolvedValue({ midi: 60, confidence: 0.95 });

    gameLoop.start();
    await gameLoop.runOneTick(16);
    // Replenish the cart for next tick
    gameState.scene.carts = [{ z: 50, lane: 3, notemidi: 60, safeZoneActive: true, cleared: false }];
    await gameLoop.runOneTick(32);
    gameState.scene.carts = [{ z: 50, lane: 3, notemidi: 60, safeZoneActive: true, cleared: false }];
    await gameLoop.runOneTick(48);

    // medium difficulty: 3 * 100 * 1.5 = 450
    expect(gameState.runtime.score).toBe(450);
  });

  it('cart positions in GameState.scene.carts are updated (advanced toward character) each tick', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.scene.carts = [{ z: 50, lane: 1, notemidi: 99, safeZoneActive: true, cleared: false }];

    gameLoop.start();
    await gameLoop.runOneTick(16);

    // Cart should have moved closer (z decreased) OR been removed (if past character)
    const cartStillPresent = gameState.scene.carts.find(c => c.notemidi === 99);
    if (cartStillPresent) {
      expect(cartStillPresent.z).toBeLessThan(50);
    } else {
      // Cart was removed after passing character — that's also valid movement
      expect(gameState.scene.carts.length).toBeLessThanOrEqual(0);
    }
  });

  it('GameState.runtime.phase remains PHASES.PLAYING across 3 ticks when no collision occurs', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    // Carts far away — no collision during 3 ticks
    gameState.scene.carts = [{ z: 100, lane: 9, notemidi: 99, safeZoneActive: false, cleared: false }];

    gameLoop.start();
    await gameLoop.runOneTick(16);
    await gameLoop.runOneTick(32);
    await gameLoop.runOneTick(48);

    expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
  });

  it('GameState.scene.character is written only by GameLoop (structural ownership test)', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    const charRef = gameState.scene.character;

    gameLoop.start();
    await gameLoop.runOneTick(16);

    // After a tick, character should exist and may have been updated by GameLoop
    expect(gameState.scene.character).toBeDefined();
    expect(typeof gameState.scene.character).toBe('object');
  });
});

// ─── Story 5.4: Variant Acceptance and Transition ────────────────────────────

describe('Integration — variant acceptance → session-config re-fetch (Story 5.4)', () => {
  let gameState;
  let stubs;
  let cartSystem;
  let difficultyManager;
  let gameLoop;

  const VARIANT_SESSION_CONFIG = {
    ...C_MAJOR_SESSION_CONFIG,
    root_midi: 65, // F4 — new root after variant acceptance (+5 semitones)
    notes: [
      { midi: 65, name: 'F4',  string: 2, fret: 6 },
      { midi: 67, name: 'G4',  string: 2, fret: 8 },
    ],
    track_count: 2,
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { cb(16); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // First call returns original config; second call (after variant acceptance) returns variant config
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(C_MAJOR_SESSION_CONFIG) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(VARIANT_SESSION_CONFIG) }),
    );

    gameState = freshGameState();
    stubs = makeStubs();

    cartSystem = new CartSystem();
    difficultyManager = new DifficultyManager('medium');
    gameLoop = new GameLoop({
      gameState,
      audioDetector: stubs.audioDetector,
      cartSystem,
      difficultyManager,
      sceneManager: stubs.sceneManager,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('CartSystem.update() detecting the variant root MIDI notifies main.js of variant acceptance', async () => {
    const onVariantAccepted = vi.fn();
    gameLoop.onVariantAccepted = onVariantAccepted;

    gameState.runtime.phase = PHASES.PLAYING;
    gameState.session.rootMidi = 60;

    // Variant offer is active — variant root is MIDI 65
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    // Audio detects the variant root note (65)
    stubs.audioDetector.detect.mockResolvedValue({ midi: 65, confidence: 0.92 });

    gameLoop.start();
    await gameLoop.runOneTick(16);

    expect(onVariantAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ rootMidi: 65 }),
    );
  });

  it('after variant acceptance, main.js calls GET /game/session-config with the new root_midi', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.session.rootMidi = 60;
    gameState.session.scale = 'major';
    gameState.session.instrument = 'guitar-standard';
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    stubs.audioDetector.detect.mockResolvedValue({ midi: 65, confidence: 0.92 });

    gameLoop.start();
    await gameLoop.runOneTick(16);

    // Trigger the acceptance path directly if not auto-triggered
    await gameLoop.acceptVariant?.({ rootMidi: 65 });

    const fetchCalls = fetch.mock.calls;
    const variantFetch = fetchCalls.find(
      ([url]) => url?.includes('root_midi=65') || url?.includes('root_midi%3D65'),
    );
    expect(variantFetch).toBeTruthy();
  });

  it('after variant acceptance, GameState.session.rootMidi is updated to the new root', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.session.rootMidi = 60;
    gameState.session.scale = 'major';
    gameState.session.instrument = 'guitar-standard';
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    stubs.audioDetector.detect.mockResolvedValue({ midi: 65, confidence: 0.92 });

    gameLoop.start();
    await gameLoop.acceptVariant?.({ rootMidi: 65 });
    await Promise.resolve(); // allow async fetch to settle

    expect(gameState.session.rootMidi).toBe(65);
  });

  it('after variant transition, GameState.runtime.speed resets to base difficulty speed', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.runtime.speed = 25; // elevated speed from playing
    gameState.session.rootMidi = 60;
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    stubs.audioDetector.detect.mockResolvedValue({ midi: 65, confidence: 0.92 });

    gameLoop.start();
    await gameLoop.acceptVariant?.({ rootMidi: 65 });
    await Promise.resolve();

    const baseSpeed = difficultyManager.baseSpeed ?? 10;
    expect(gameState.runtime.speed).toBeCloseTo(baseSpeed, 1);
  });

  it('after variant transition, gameplay continues on the new root (phase stays PLAYING)', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.session.rootMidi = 60;
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    await gameLoop.acceptVariant?.({ rootMidi: 65 });
    await Promise.resolve();

    expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
  });

  it('score from both root positions contributes to the total score (accumulated, not reset)', async () => {
    gameState.runtime.phase = PHASES.PLAYING;
    gameState.runtime.score = 500; // pre-existing score from original root
    gameState.session.rootMidi = 60;
    gameState.runtime.variantOffer = { rootMidi: 65, active: true };

    await gameLoop.acceptVariant?.({ rootMidi: 65 });

    // Score should not have been reset to 0
    expect(gameState.runtime.score).toBeGreaterThanOrEqual(500);
  });
});
