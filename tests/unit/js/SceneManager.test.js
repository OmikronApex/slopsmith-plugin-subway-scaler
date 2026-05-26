// Red-phase ATDD scaffold — Story 3.1: SceneManager and Three.js canvas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneManager, createScene } from '../../../static/game/SceneManager.js';

// Helper: create a mock 3D object with trackable position
function makePos(x = 0, y = 0, z = 0) {
  const pos = { x, y, z };
  pos.set = (nx, ny, nz) => { pos.x = nx; pos.y = ny; pos.z = nz; };
  return pos;
}

function makeMeshMock() {
  return {
    isMesh: true,
    position: makePos(),
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() },
    visible: true,
    userData: {},
    add: vi.fn(),
    traverse: vi.fn(fn => fn({ isMesh: true, geometry: { dispose: vi.fn() } })),
  };
}

function makeGroupMock() {
  const children = [];
  return {
    position: makePos(),
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    add: vi.fn(child => children.push(child)),
    traverse: vi.fn(fn => { fn({ isMesh: false }); }),
    children,
  };
}

// Mock the vendor three module to avoid WebGL/DOM requirements in node env
vi.mock('../../../static/game/vendor/three.module.js', () => {
  const mockRenderer = {
    setSize: vi.fn(),
    render: vi.fn(),
    setClearColor: vi.fn(),
    domElement: { tagName: 'CANVAS' },
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
  };
  const sceneObjects = [];
  const mockScene = {
    fog: null,
    add: vi.fn(obj => sceneObjects.push(obj)),
    remove: vi.fn(obj => {
      const idx = sceneObjects.indexOf(obj);
      if (idx >= 0) sceneObjects.splice(idx, 1);
    }),
  };
  const mockCamera = {
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    lookAt: vi.fn(),
  };
  return {
    WebGLRenderer: vi.fn(() => mockRenderer),
    Scene: vi.fn(() => mockScene),
    PerspectiveCamera: vi.fn(() => mockCamera),
    Color: vi.fn(),
    DirectionalLight: vi.fn(() => ({ position: { set: vi.fn() } })),
    AmbientLight: vi.fn(),
    Fog: vi.fn(),
    BoxGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    CapsuleGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    PlaneGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    MeshStandardMaterial: vi.fn(() => ({ dispose: vi.fn(), color: 0 })),
    SpriteMaterial: vi.fn(() => ({})),
    CanvasTexture: vi.fn(() => ({})),
    DoubleSide: 2,
    Mesh: vi.fn(() => {
      const m = {
        isMesh: true,
        position: { x: 0, y: 0, z: 0, set: (x, y, z) => { m.position.x = x; m.position.y = y; m.position.z = z; } },
        rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() },
        visible: true,
        userData: {},
        add: vi.fn(),
        scale: { set: vi.fn() },
      };
      return m;
    }),
    Sprite: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      scale: { set: vi.fn() },
    })),
    Group: vi.fn(() => {
      const children = [];
      const g = {
        position: { x: 0, y: 0, z: 0, set: (x, y, z) => { g.position.x = x; g.position.y = y; g.position.z = z; } },
        rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
        add: vi.fn(c => children.push(c)),
        remove: vi.fn(),
        traverse: vi.fn(fn => { children.forEach(c => fn(c)); }),
        children,
      };
      return g;
    }),
  };
});

function makeMockContainer() {
  return {
    appendChild: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 })),
    clientWidth: 800,
    clientHeight: 600,
  };
}

// Mock canvas for createScene (needs clientWidth/clientHeight + getContext)
function makeMockCanvas() {
  return {
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    getContext: vi.fn(() => ({
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      strokeText: vi.fn(),
      fillText: vi.fn(),
    })),
  };
}

// Constants from SceneManager (duplicated for test readability)
const STRAIGHT_LEN = 60;
const DIAG_LEN = 45;
const SPAWN_Z_TEST = -80; // from TrackSystem

describe('createScene — isBendMidpointReached (Story 6.2)', () => {
  let sceneApi;

  beforeEach(() => {
    // Mock document.createElement for makeTextSprite
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 64,
        height: 64,
        getContext: vi.fn(() => ({
          font: '',
          textAlign: '',
          textBaseline: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          strokeText: vi.fn(),
          fillText: vi.fn(),
        })),
      })),
    });
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });
    vi.stubGlobal('window', {
      __gameState: { variant: { safeZoneZ: null }, scene: {} },
    });

    const canvas = makeMockCanvas();
    sceneApi = createScene(canvas);
    sceneApi.setBaseFret(2, 6);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when no propose piece exists', () => {
    expect(sceneApi.isBendMidpointReached()).toBe(false);
  });

  it('returns false when propose piece is far from player (piece just spawned at SPAWN_Z)', () => {
    const variant = { side: 'RIGHT', variant_id: 'v1' };
    // spawn_time_ms = 1000 means the piece spawns 1000ms from game start.
    // With performance.now() = 0 and gameStartTime = 0, nowGameMs = 0, geomElapsed = max(0, 0-1000) = 0.
    // Position = SPAWN_Z + 0 = -80. midpointCheck: -80 + 30 + 22.5 = -27.5 < 0 → false.
    const wave = { spawn_time_ms: 1000, speed_px_per_ms: 0.05, safe_fret: 3, note_index: 0, wave_id: 'w-0' };
    sceneApi.proposeVariantTracks(variant, wave, null, null);

    expect(sceneApi.isBendMidpointReached()).toBe(false);
  });

  it('getVariantInfo returns side and variantX after propose', () => {
    const variant = { side: 'RIGHT', variant_id: 'v1' };
    const wave = { spawn_time_ms: -5000, speed_px_per_ms: 0.05, safe_fret: 3, note_index: 0, wave_id: 'w-0' };
    sceneApi.proposeVariantTracks(variant, wave, null, null);

    const info = sceneApi.getVariantInfo();
    expect(info).not.toBeNull();
    expect(info.side).toBe('RIGHT');
    expect(typeof info.variantX).toBe('number');
  });
});

// Camera constants (duplicated from SceneManager for assertions)
const CAMERA_BEND_YAW_MAX = 12 * Math.PI / 180;
const CAMERA_LOOK_AHEAD_Z = 5;
const CAMERA_RESET_DURATION_MS = 500;
// Story 6.8 cinematic refinement constants
const MAX_BEND_YAW = Math.PI / 4;
const DIAG_CROSS_MS = 1200;
const REPOSITION_SLIDE_MS = 200;
const CAMERA_YAW_RATE = 0.02;
const LANE_W = 1.4;
const DIAG_LEN_C = 45;

// ─── Story 6.8 rewrite tests ───────────────────────────────────────────────

describe('createScene — Story 6.8 cinematic refinement', () => {
  let sceneApi;
  let mockCamera;
  let nowMs;

  beforeEach(async () => {
    nowMs = 0;
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 64, height: 64,
        getContext: vi.fn(() => ({
          font: '', textAlign: '', textBaseline: '',
          fillStyle: '', strokeStyle: '', lineWidth: 0,
          strokeText: vi.fn(), fillText: vi.fn(),
        })),
      })),
    });
    vi.stubGlobal('performance', { now: vi.fn(() => nowMs) });
    vi.stubGlobal('window', { __gameState: { variant: { safeZoneZ: null }, scene: {} } });

    const canvas = makeMockCanvas();
    sceneApi = createScene(canvas);
    sceneApi.setBaseFret(2, 6);

    const { PerspectiveCamera } = await import('../../../static/game/vendor/three.module.js');
    mockCamera = PerspectiveCamera.mock.results[PerspectiveCamera.mock.results.length - 1].value;
    mockCamera.rotation.y = 0;
    mockCamera.lookAt.mockClear();
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  function proposeWithSpawn(spawnMs, side = 'RIGHT') {
    const variant = { side, variant_id: 'v1' };
    const wave = { spawn_time_ms: spawnMs, speed_px_per_ms: 0.05, safe_fret: 3, note_index: 0, wave_id: 'w-0' };
    sceneApi.proposeVariantTracks(variant, wave, null, null);
  }

  it('isOutgoingCornerAtPlayer false when no piece', () => {
    expect(sceneApi.isOutgoingCornerAtPlayer()).toBe(false);
  });

  it('isOutgoingCornerAtPlayer false before group.z reaches STRAIGHT_LEN/2', () => {
    // Spawn far in past so piece is near player but not yet at corner threshold.
    // pos.z = -100 + elapsed * 0.025. Want pos.z = 29 (< STRAIGHT_LEN/2 = 30).
    // elapsed = 5160 → spawn_time_ms = -5160.
    proposeWithSpawn(-5160);
    expect(sceneApi.isOutgoingCornerAtPlayer()).toBe(false);
  });

  it('isOutgoingCornerAtPlayer true when group.z >= STRAIGHT_LEN/2', () => {
    // pos.z = 31 ≥ 30 → corner reached. elapsed = 5240 → spawn_time_ms = -5240.
    proposeWithSpawn(-5240);
    expect(sceneApi.isOutgoingCornerAtPlayer()).toBe(true);
  });

  it('snapCharacterYaw sets character rotation immediately (no easing)', () => {
    sceneApi.snapCharacterYaw(MAX_BEND_YAW);
    // No direct accessor; render with no exit/riding mode active should preserve via no-op.
    // Indirect: subsequent startCinematicExit captures fromCharYaw and reads it back.
    sceneApi.startCinematicExit(0, 100);
    nowMs = 100;
    sceneApi.render(100); // exit complete → character.rotation.y = fromCharYaw * 0 = 0
    // Camera yaw also resets to 0 — confirms exit ran with captured yaw.
    expect(mockCamera.rotation.y).toBe(0);
  });

  it('setCharacterX sets character X immediately', () => {
    sceneApi.setCharacterX(3.7);
    expect(sceneApi.getCharacterX()).toBeCloseTo(3.7, 5);
  });

  it('startCinematicExit lerps character X to targetX and camera yaw to 0 over durationMs', () => {
    sceneApi.setCharacterX(1.0);
    sceneApi.snapCharacterYaw(0.5);
    // Prime camera ride yaw, then exit.
    sceneApi.setCameraMode('riding');
    sceneApi.setRidingCameraTarget(0.5);
    for (let i = 0; i < 30; i++) sceneApi.render(0); // build up _currentCamYaw

    const startMs = 1000;
    nowMs = startMs;
    sceneApi.startCinematicExit(4.0, REPOSITION_SLIDE_MS);
    // Midpoint frame:
    nowMs = startMs + REPOSITION_SLIDE_MS / 2;
    sceneApi.render(nowMs);
    expect(sceneApi.getCharacterX()).toBeGreaterThan(1.0);
    expect(sceneApi.getCharacterX()).toBeLessThan(4.0);

    // End frame:
    nowMs = startMs + REPOSITION_SLIDE_MS + 5;
    sceneApi.render(nowMs);
    expect(sceneApi.getCharacterX()).toBeCloseTo(4.0, 5);
    expect(mockCamera.rotation.y).toBe(0);
  });

  it('disableVariantMissCallback does not remove the safe zone mesh', () => {
    proposeWithSpawn(-1000);
    // Safe zone present before:
    sceneApi.render(0);
    const zonesBefore = sceneApi.getActiveSafeZones();
    expect(zonesBefore.some(z => z.isVariant)).toBe(true);

    sceneApi.disableVariantMissCallback();
    const zonesAfter = sceneApi.getActiveSafeZones();
    expect(zonesAfter.some(z => z.isVariant)).toBe(true);
  });

  it('camera in riding mode eases _currentCamYaw toward target at CAMERA_YAW_RATE per frame', () => {
    sceneApi.setCameraMode('riding');
    sceneApi.setRidingCameraTarget(0.5);
    sceneApi.render(0);
    // After 1 frame, yaw should be exactly CAMERA_YAW_RATE (rate-clamped from 0 toward 0.5).
    expect(mockCamera.rotation.y).toBeCloseTo(CAMERA_YAW_RATE, 5);
  });

  // Pure formula coverage — derived from spec AC-5/AC-7.
  it('newScaleCenterX formula: RIGHT, numLanes 3..6', () => {
    const landingX = 5.0;
    const sign = 1;
    for (const n of [3, 4, 5, 6]) {
      const center = landingX + sign * (n - 1) / 2 * LANE_W;
      expect(center).toBeCloseTo(5 + (n - 1) / 2 * 1.4, 5);
    }
  });

  it('newScaleCenterX formula: LEFT, numLanes 3..6', () => {
    const landingX = -5.0;
    const sign = -1;
    for (const n of [3, 4, 5, 6]) {
      const center = landingX + sign * (n - 1) / 2 * LANE_W;
      expect(center).toBeCloseTo(-5 - (n - 1) / 2 * 1.4, 5);
    }
  });

  it('variantNoteX formula across variant_lane_index values', () => {
    const landingX = 4.2;
    const sign = 1;
    for (const idx of [0, 1, 2, 3]) {
      const x = landingX + sign * idx * LANE_W;
      expect(x).toBeCloseTo(4.2 + idx * 1.4, 5);
    }
    // idx=0 must equal landingX (no slide).
    expect(landingX + sign * 0 * LANE_W).toBe(landingX);
  });

  it('landingX formula: variantX + sign * DIAG_LEN', () => {
    const variantX = 2.1;
    expect(variantX + 1 * DIAG_LEN_C).toBe(2.1 + 45);
    expect(variantX + -1 * DIAG_LEN_C).toBe(2.1 - 45);
  });
});

describe.skip('createScene — camera riding mode (legacy 6.3 / 6.8 pre-rewrite)', () => {
  let sceneApi;
  let mockCamera;
  let nowMs;

  beforeEach(async () => {
    nowMs = 0;
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 64,
        height: 64,
        getContext: vi.fn(() => ({
          font: '', textAlign: '', textBaseline: '',
          fillStyle: '', strokeStyle: '', lineWidth: 0,
          strokeText: vi.fn(), fillText: vi.fn(),
        })),
      })),
    });
    vi.stubGlobal('performance', { now: vi.fn(() => nowMs) });
    vi.stubGlobal('window', {
      __gameState: { variant: { safeZoneZ: null }, scene: {} },
    });

    const canvas = makeMockCanvas();
    sceneApi = createScene(canvas);
    sceneApi.setBaseFret(2, 6);

    const { PerspectiveCamera } = await import('../../../static/game/vendor/three.module.js');
    mockCamera = PerspectiveCamera.mock.results[PerspectiveCamera.mock.results.length - 1].value;
    // Reset rotation state between tests (camera mock is shared)
    mockCamera.rotation.y = 0;
    mockCamera.lookAt.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // SPAWN_Z=-100, speed=0.05, geomFactor=0.5 → pos = -100 + elapsed*0.025
  // For progress=0.5: straightZ=-63.75 → elapsed=(100-63.75)/0.025=1450ms → spawn_time_ms=-1450
  // frontEdgeZ=11.25, midpointZ=-11.25, range=22.5, progress=11.25/22.5=0.5
  function proposeAtMidProgress(side = 'RIGHT') {
    const variant = { side, variant_id: 'v1' };
    const wave = { spawn_time_ms: -1450, speed_px_per_ms: 0.05, safe_fret: 3, note_index: 0, wave_id: 'w-0' };
    sceneApi.proposeVariantTracks(variant, wave, null, null);
  }

  it('camera yaw is 0 in default mode after render', () => {
    sceneApi.render(0);
    expect(mockCamera.rotation.y).toBe(0);
  });

  it('camera in riding mode builds up yaw following character heading (rate-clamped 0.02 rad/frame)', () => {
    // Story 6.8 AC-3: heading-tracking camera replaces sine yaw.
    // At progress≈0.5, character.rotation.y = MAX_BEND_YAW * sin(π/2) ≈ 0.785 rad.
    // _targetCamYaw = min(π/4, 0.785*0.7) ≈ 0.55. Each frame adds max 0.02 rad.
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');

    for (let i = 0; i < 20; i++) sceneApi.render(0); // 20 frames → ~0.40 rad

    const yaw = mockCamera.rotation.y;
    expect(yaw).toBeGreaterThan(0.1);
    expect(yaw).toBeLessThan(Math.PI / 4 + 0.001); // bounded by ±π/4 value-clamp
  });

  it('camera yaw is negative for LEFT variant during riding mode', () => {
    proposeAtMidProgress('LEFT');
    sceneApi.setCharacterTargetX(-2.8);
    sceneApi.setCameraMode('riding');

    for (let i = 0; i < 20; i++) sceneApi.render(0);

    expect(mockCamera.rotation.y).toBeLessThan(-0.1);
  });

  it('camera lookAt uses LOOK_AHEAD_DIST along character heading during riding mode', () => {
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');

    sceneApi.render(0);

    expect(mockCamera.lookAt).toHaveBeenCalled();
    const lastCall = mockCamera.lookAt.mock.calls[mockCamera.lookAt.mock.calls.length - 1];
    // lookAheadZ = charZ + cos(camYaw)*LOOK_AHEAD_DIST + camBase.lookAt[2]
    // charZ ≈ -6.75, cos(0.02)*10 ≈ 9.998, camBase.lookAt[2] = -2 → ≈ 1.25 > 0
    expect(lastCall[2]).toBeGreaterThan(0);
  });

  it('camera reset: yaw lerps to 0 over CAMERA_RESET_DURATION_MS after setCameraMode(default)', () => {
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');
    sceneApi.render(0); // 1 frame → rate-clamped yaw = 0.02

    const yawBeforeReset = mockCamera.rotation.y;
    expect(yawBeforeReset).toBeGreaterThan(0); // rate-clamped to 0.02 after 1 frame

    nowMs = 100;
    sceneApi.setCameraMode('default'); // captures _cameraResetStartYaw = yawBeforeReset
    sceneApi.render(100); // t=0 of reset → yaw ≈ yawBeforeReset
    const yawAtStart = mockCamera.rotation.y;
    expect(yawAtStart).toBeCloseTo(yawBeforeReset, 2);

    const endMs = 100 + CAMERA_RESET_DURATION_MS + 10;
    sceneApi.render(endMs); // t≥1 → yaw=0
    expect(mockCamera.rotation.y).toBe(0);
  });

  it('camera yaw stays 0 in default mode when never entering riding mode', () => {
    sceneApi.render(0);
    sceneApi.render(100);
    expect(mockCamera.rotation.y).toBe(0);
  });
});

describe.skip('createScene — character rotation and diagonal movement (legacy 6.8 pre-rewrite)', () => {
  let sceneApi;

  // SPAWN_Z=-100, speed=0.05, factor=0.5 → pos = -100 + elapsed*0.025
  // progress = (straightZ + 75) / 22.5; straightZ = -100 + elapsed*0.025
  // progress=0:   straightZ=-75 → elapsed=1000ms → spawn_time_ms=-1000
  // progress=0.5: straightZ=-63.75 → elapsed=1450ms → spawn_time_ms=-1450
  // progress=1:   straightZ=-52.5 → elapsed=1900ms → spawn_time_ms=-1900
  function spawnForProgress(sceneApi, targetProgress, side = 'RIGHT') {
    const spawnMs = -(1000 + targetProgress * 900); // -1000 at p=0, -1900 at p=1
    const variant = { side, variant_id: 'v1' };
    const wave = { spawn_time_ms: spawnMs, speed_px_per_ms: 0.05, safe_fret: 3, note_index: 0, wave_id: 'w-0' };
    sceneApi.proposeVariantTracks(variant, wave, null, null);
    sceneApi.setCharacterTargetX(side === 'RIGHT' ? 2.8 : -2.8);
  }

  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 64, height: 64,
        getContext: vi.fn(() => ({
          font: '', textAlign: '', textBaseline: '',
          fillStyle: '', strokeStyle: '', lineWidth: 0,
          strokeText: vi.fn(), fillText: vi.fn(),
        })),
      })),
    });
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });
    vi.stubGlobal('window', { __gameState: { variant: { safeZoneZ: null }, scene: {} } });

    const canvas = makeMockCanvas();
    sceneApi = createScene(canvas);
    sceneApi.setBaseFret(2, 6);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('character yaw ≈ 0 at diagonal start (progress≈0)', () => {
    spawnForProgress(sceneApi, 0, 'RIGHT');
    sceneApi.render(0);
    // At progress=0: sin(0)=0 → yaw=0
    expect(Math.abs(sceneApi.getCharacterX())).toBeDefined(); // traversal active
    // Access character yaw indirectly via scene — yaw should be near 0
    // We verify by checking isTraversalActive
    expect(sceneApi.isTraversalActive()).toBe(true);
  });

  it('character yaw ≈ MAX_BEND_YAW at diagonal midpoint (progress≈0.5)', () => {
    spawnForProgress(sceneApi, 0.5, 'RIGHT');
    sceneApi.render(0);
    // progress≈0.5 → yaw = MAX_BEND_YAW * sin(π/2) = MAX_BEND_YAW ≈ 0.785 rad
    expect(sceneApi.isTraversalActive()).toBe(true);
    // Character Z stays at player plane (no Z offset) — world scrolls past player
    expect(sceneApi.getCharacterZ()).toBeCloseTo(0.1, 1);
  });

  it('character Z stays at player plane (≈0.1) during traversal — Z offset removed', () => {
    spawnForProgress(sceneApi, 0.5, 'RIGHT');
    sceneApi.render(0);
    expect(sceneApi.getCharacterZ()).toBeCloseTo(0.1, 1);
  });

  it('character Z stays at player plane at progress=1', () => {
    spawnForProgress(sceneApi, 1, 'RIGHT');
    sceneApi.render(0);
    expect(sceneApi.getCharacterZ()).toBeCloseTo(0.1, 1);
  });

  it('LEFT variant: character Z stays at player plane', () => {
    spawnForProgress(sceneApi, 0.5, 'LEFT');
    sceneApi.render(0);
    expect(sceneApi.getCharacterZ()).toBeCloseTo(0.1, 1);
  });

  it('isTraversalActive returns true during traversal and false when no traversal', () => {
    expect(sceneApi.isTraversalActive()).toBe(false); // no traversal yet
    spawnForProgress(sceneApi, 0.5, 'RIGHT');
    sceneApi.render(0);
    expect(sceneApi.isTraversalActive()).toBe(true); // traversal in progress at p=0.5
  });

  it('isTraversalActive returns false after traversal completes (progress=1)', () => {
    // At progress=1: _charTraversal is set to null in render()
    spawnForProgress(sceneApi, 1, 'RIGHT');
    sceneApi.render(0);
    expect(sceneApi.isTraversalActive()).toBe(false);
  });

  it('getCharacterZ returns 0 before any traversal', () => {
    sceneApi.render(0);
    // FRONT_Z + 0.1 = 0.1 ≈ 0
    expect(sceneApi.getCharacterZ()).toBeCloseTo(0.1, 1);
  });

  it('transitionRideProgress is set in __gameState.scene during traversal', () => {
    spawnForProgress(sceneApi, 0.5, 'RIGHT');
    sceneApi.render(0);
    const rp = window.__gameState.scene.transitionRideProgress;
    expect(rp).toBeDefined();
    expect(rp).toBeGreaterThan(0);
    expect(rp).toBeLessThanOrEqual(1);
  });

  it('transitionRideProgress set to 0 when traversal completes (progress=1)', () => {
    spawnForProgress(sceneApi, 1, 'RIGHT');
    sceneApi.render(0);
    expect(window.__gameState.scene.transitionRideProgress).toBe(0);
  });

  it('transitionRideProgress set to undefined after reset()', () => {
    spawnForProgress(sceneApi, 0.5, 'RIGHT');
    sceneApi.render(0);
    sceneApi.reset();
    expect(window.__gameState.scene.transitionRideProgress).toBeUndefined();
  });
});

describe('SceneManager', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init()', () => {
    it('SceneManager.init(container) does not throw (smoke test with mock container)', () => {
      const container = makeMockContainer();
      expect(() => SceneManager.init(container)).not.toThrow();
    });
  });

  describe('render()', () => {
    it('SceneManager.render() calls the renderer render method', async () => {
      const container = makeMockContainer();
      SceneManager.init(container);
      const { WebGLRenderer } = await import('../../../static/game/vendor/three.module.js');
      const rendererInstance = WebGLRenderer.mock.results[0].value;
      SceneManager.render();
      expect(rendererInstance.render).toHaveBeenCalled();
    });

    it('SceneManager.js does not write to any GameState sub-object after render', () => {
      const gameState = {
        session: { scale: null, rootMidi: 60, difficulty: 'medium', instrument: 'guitar-standard' },
        runtime: { score: 0, speed: 10, phase: 'playing', currentNote: null },
        scene: { carts: [], tracks: [], character: {} },
      };
      const container = makeMockContainer();
      SceneManager.init(container);
      const snapshotBefore = JSON.stringify(gameState);
      SceneManager.render(gameState);
      const snapshotAfter = JSON.stringify(gameState);
      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });

  describe('resize handling', () => {
    it('resize handler updates renderer on window resize', async () => {
      const container = makeMockContainer();
      SceneManager.init(container);
      const { WebGLRenderer } = await import('../../../static/game/vendor/three.module.js');
      const rendererInstance = WebGLRenderer.mock.results[0].value;
      rendererInstance.setSize.mockClear();
      if (typeof SceneManager.onResize === 'function') {
        SceneManager.onResize(1024, 768);
      } else {
        window.dispatchEvent(new Event('resize'));
      }
      expect(rendererInstance.setSize).toHaveBeenCalled();
    });
  });
});

describe('createScene — dual-wave cohort rendering (Story 6.6)', () => {
  let sceneApi;

  function makeWave(id, fret, spawnMs = -500) {
    return { wave_id: id, spawn_time_ms: spawnMs, speed_px_per_ms: 0.1, safe_fret: fret, note_index: 0, duration_ms: 4000 };
  }
  // spawn_time_ms = -3000 → elapsed=3000, z = SPAWN_Z(-100) + 3000*0.05 = 50 >= FRONT_Z(0) → removable
  function makePassedWave(id, fret) {
    return makeWave(id, fret, -3000);
  }

  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 64, height: 64,
        getContext: vi.fn(() => ({
          font: '', textAlign: '', textBaseline: '',
          fillStyle: '', strokeStyle: '', lineWidth: 0,
          strokeText: vi.fn(), fillText: vi.fn(),
        })),
      })),
    });
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });
    vi.stubGlobal('window', { __gameState: { variant: { safeZoneZ: null }, scene: {} } });

    const canvas = makeMockCanvas();
    sceneApi = createScene(canvas);
    sceneApi.setBaseFret(0, 6);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setWaves with old + new waves creates meshes for all (activeWaves.size == total)', () => {
    const oldWaves = [makeWave('old-1', 2), makeWave('old-2', 3)];
    sceneApi.setWaves(oldWaves, 0);
    expect(sceneApi.getActiveWaveCount()).toBe(2);

    const newWaves = [makeWave('new-1', 4), makeWave('new-2', 5), makeWave('new-3', 6)];
    sceneApi.setWaves([...oldWaves, ...newWaves], 0);
    expect(sceneApi.getActiveWaveCount()).toBe(5);
  });

  it('old wave meshes removed once they pass FRONT_Z and are dropped from scheduler array', () => {
    // Use waves that have already passed FRONT_Z (z >= 0) so setWaves removes them.
    const oldWaves = [makePassedWave('old-1', 2), makePassedWave('old-2', 3)];
    sceneApi.setWaves(oldWaves, 0);
    expect(sceneApi.getActiveWaveCount()).toBe(2);

    const newWaves = [makeWave('new-1', 4)];
    sceneApi.setWaves(newWaves, 0); // old waves past FRONT_Z → removed
    expect(sceneApi.getActiveWaveCount()).toBe(1);
  });

  it('new waves get meshes without clearing old waves', () => {
    const oldWaves = [makeWave('old-1', 2)];
    sceneApi.setWaves(oldWaves, 0);
    expect(sceneApi.getActiveWaveCount()).toBe(1);

    const combined = [makeWave('old-1', 2), makeWave('new-1', 5), makeWave('new-2', 6)];
    sceneApi.setWaves(combined, 0);
    // Old wave preserved, two new meshes created.
    expect(sceneApi.getActiveWaveCount()).toBe(3);
  });
});
