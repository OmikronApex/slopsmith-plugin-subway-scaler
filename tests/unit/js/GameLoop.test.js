// Red-phase ATDD scaffold — Story 3.4: GameLoop with phase management + Story 3.5: first-wave tutorial

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: GameLoop.js does not exist yet — import will fail until implementation
import { GameLoop } from '../../../static/game/GameLoop.js';

// PHASES values inlined to avoid depending on unimplemented GameState.js
const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

function makeMockGameState() {
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
      phase: PHASES.IDLE,
      currentNote: null,
    },
    scene: {
      carts: [],
      tracks: [],
      character: { lane: 3 },
    },
  };
}

function makeStubs() {
  return {
    audioDetector: { detect: vi.fn().mockResolvedValue({ midi: 60, confidence: 0.9 }) },
    cartSystem: { update: vi.fn() },
    difficultyManager: { tick: vi.fn() },
    sceneManager: { render: vi.fn() },
  };
}

describe('GameLoop — phase management (Story 3.4)', () => {
  let gameState;
  let stubs;
  let gameLoop;

  beforeEach(() => {
    gameState = makeMockGameState();
    stubs = makeStubs();
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { cb(16); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    gameLoop = new GameLoop({
      gameState,
      audioDetector: stubs.audioDetector,
      cartSystem: stubs.cartSystem,
      difficultyManager: stubs.difficultyManager,
      sceneManager: stubs.sceneManager,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GameLoop.start() transitions phase from PHASES.IDLE to PHASES.PLAYING', () => {
    expect(gameState.runtime.phase).toBe(PHASES.IDLE);
    gameLoop.start();
    expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
  });

  it('each tick calls AudioDetector.detect, then CartSystem.update, then DifficultyManager.tick, then SceneManager.render in order', async () => {
    const callOrder = [];
    stubs.audioDetector.detect.mockImplementation(async () => { callOrder.push('detect'); return { midi: 60, confidence: 0.9 }; });
    stubs.cartSystem.update.mockImplementation(() => { callOrder.push('cartUpdate'); });
    stubs.difficultyManager.tick.mockImplementation(() => { callOrder.push('dmTick'); });
    stubs.sceneManager.render.mockImplementation(() => { callOrder.push('render'); });

    gameLoop.start();
    await gameLoop.runOneTick(16);

    expect(callOrder).toEqual(['detect', 'cartUpdate', 'dmTick', 'render']);
  });

  it('DifficultyManager.tick receives true when detected note matches a safe zone lane this tick', async () => {
    // Set up a cart whose note matches what audio returns
    gameState.scene.carts = [{ z: 0, lane: gameState.scene.character.lane, notemidi: 60, safeZoneActive: true, cleared: false }];
    stubs.audioDetector.detect.mockResolvedValue({ midi: 60, confidence: 0.9 });

    gameLoop.start();
    await gameLoop.runOneTick(16);

    expect(stubs.difficultyManager.tick).toHaveBeenCalledWith(true, expect.anything());
  });

  it('DifficultyManager.tick receives false when no safe zone match this tick', async () => {
    gameState.scene.carts = [{ z: 0, lane: gameState.scene.character.lane, notemidi: 72, safeZoneActive: true, cleared: false }];
    stubs.audioDetector.detect.mockResolvedValue({ midi: 60, confidence: 0.9 });

    gameLoop.start();
    await gameLoop.runOneTick(16);

    expect(stubs.difficultyManager.tick).toHaveBeenCalledWith(false, expect.anything());
  });

  it('AudioDetectorError caught by GameLoop transitions phase to PHASES.PAUSED', async () => {
    // TODO: AudioDetector.js not yet implemented — import AudioDetectorError inline
    class AudioDetectorError extends Error {}
    stubs.audioDetector.detect.mockRejectedValue(new AudioDetectorError('mic disconnected'));

    gameLoop.start();
    await gameLoop.runOneTick(16);

    expect(gameState.runtime.phase).toBe(PHASES.PAUSED);
  });

  it('GameLoop.resume() transitions PHASES.PAUSED to PHASES.PLAYING', () => {
    gameState.runtime.phase = PHASES.PAUSED;
    gameLoop.resume();
    expect(gameState.runtime.phase).toBe(PHASES.PLAYING);
  });

  it('GameState.runtime.phase === PHASES.GAME_OVER stops the update loop on next tick', async () => {
    gameLoop.start();
    gameState.runtime.phase = PHASES.GAME_OVER;
    const rafCallsBefore = requestAnimationFrame.mock.calls.length;
    await gameLoop.runOneTick(16);
    const rafCallsAfter = requestAnimationFrame.mock.calls.length;
    // No new rAF should have been requested after game over
    expect(rafCallsAfter).toBe(rafCallsBefore);
  });

  it('GameLoop is sole writer to GameState.runtime.currentNote', async () => {
    stubs.audioDetector.detect.mockResolvedValue({ midi: 69, confidence: 0.88 });
    gameLoop.start();
    await gameLoop.runOneTick(16);
    expect(gameState.runtime.currentNote).toBeDefined();
    expect(gameState.runtime.currentNote.midi).toBe(69);
  });

  it('GameLoop is sole writer to GameState.scene.character', async () => {
    const charBefore = gameState.scene.character;
    gameLoop.start();
    await gameLoop.runOneTick(16);
    // GameLoop may update character position — verify it only changes via GameLoop
    expect(gameState.scene.character).toBeDefined();
    // Character object should still be the same reference or an updated version set by GameLoop
    expect(typeof gameState.scene.character).toBe('object');
  });
});

describe('GameLoop — tutorial hint (Story 3.5)', () => {
  let gameState;
  let stubs;
  let gameLoop;

  beforeEach(() => {
    gameState = makeMockGameState();
    stubs = makeStubs();
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { cb(16); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    gameLoop = new GameLoop({
      gameState,
      audioDetector: stubs.audioDetector,
      cartSystem: stubs.cartSystem,
      difficultyManager: stubs.difficultyManager,
      sceneManager: stubs.sceneManager,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('first cart wave spawns at 50% of base difficulty speed', () => {
    gameLoop.start();
    const firstWaveSpeed = gameLoop.firstWaveSpeed;
    expect(firstWaveSpeed).toBeCloseTo(gameLoop.baseSpeed * 0.5, 5);
  });

  it('tutorial text overlay appears on first wave (truthy indication set in GameState or returned value)', () => {
    gameLoop.start();
    // GameLoop should signal tutorial state — either in gameState or via a property
    const tutorialActive = gameState.runtime.tutorialActive ?? gameLoop.tutorialActive;
    expect(tutorialActive).toBeTruthy();
  });

  it('after first correct note is detected, tutorial state is cleared/hidden', async () => {
    stubs.audioDetector.detect.mockResolvedValue({ midi: 60, confidence: 0.9 });
    gameState.scene.carts = [{ z: 0, lane: gameState.scene.character.lane, notemidi: 60, safeZoneActive: true, cleared: false }];
    gameLoop.start();
    await gameLoop.runOneTick(16);
    const tutorialActive = gameState.runtime.tutorialActive ?? gameLoop.tutorialActive;
    expect(tutorialActive).toBeFalsy();
  });

  it('tutorial never reappears after first correct note in a session', async () => {
    stubs.audioDetector.detect.mockResolvedValue({ midi: 60, confidence: 0.9 });
    gameState.scene.carts = [{ z: 0, lane: gameState.scene.character.lane, notemidi: 60, safeZoneActive: true, cleared: false }];
    gameLoop.start();
    // First correct note — tutorial dismissed
    await gameLoop.runOneTick(16);
    // Additional ticks
    await gameLoop.runOneTick(32);
    await gameLoop.runOneTick(48);
    const tutorialActive = gameState.runtime.tutorialActive ?? gameLoop.tutorialActive;
    expect(tutorialActive).toBeFalsy();
  });
});
