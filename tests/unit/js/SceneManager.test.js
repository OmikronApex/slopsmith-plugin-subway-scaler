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

describe('createScene — camera riding mode (Story 6.3)', () => {
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

  it('camera in riding mode with active traversal applies yaw per sin curve', () => {
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');

    sceneApi.render(0); // nowMs=0 → progress≈0.5 → yaw = CAMERA_BEND_YAW_MAX * sin(0.5π) ≈ max yaw

    const yaw = mockCamera.rotation.y;
    // At progress ≈ 0.5: yaw ≈ CAMERA_BEND_YAW_MAX * sin(0.5π) = CAMERA_BEND_YAW_MAX (~0.209 rad)
    expect(yaw).toBeGreaterThan(0.1);
    expect(yaw).toBeLessThanOrEqual(CAMERA_BEND_YAW_MAX + 0.001);
  });

  it('camera yaw is negated for LEFT variant during riding mode', () => {
    proposeAtMidProgress('LEFT');
    sceneApi.setCharacterTargetX(-2.8);
    sceneApi.setCameraMode('riding');

    sceneApi.render(0);

    expect(mockCamera.rotation.y).toBeLessThan(-0.1);
  });

  it('camera lookAt Z shifts by CAMERA_LOOK_AHEAD_Z offset during riding mode', () => {
    // camBase.lookAt[2] = -2 (cameraForPitch default), so lookAheadZ = -2 + 5 = 3
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');

    sceneApi.render(0);

    expect(mockCamera.lookAt).toHaveBeenCalled();
    const lastCall = mockCamera.lookAt.mock.calls[mockCamera.lookAt.mock.calls.length - 1];
    // Z = camBase.lookAt[2] (-2) + CAMERA_LOOK_AHEAD_Z (5) = 3, well above the default -2
    expect(lastCall[2]).toBeGreaterThan(0);
  });

  it('camera reset: yaw lerps to 0 over CAMERA_RESET_DURATION_MS after setCameraMode(default)', () => {
    proposeAtMidProgress('RIGHT');
    sceneApi.setCharacterTargetX(2.8);
    sceneApi.setCameraMode('riding');
    sceneApi.render(0); // sets non-zero yaw

    const yawBeforeReset = mockCamera.rotation.y;
    expect(yawBeforeReset).toBeGreaterThan(0.1);

    // Transition to default at t=100ms — performance.now() used inside setCameraMode
    nowMs = 100;
    sceneApi.setCameraMode('default'); // records _cameraResetStartMs=100, _cameraResetStartYaw=yawBeforeReset
    sceneApi.render(100); // t=(100-100)/500=0, yaw unchanged from startYaw
    const yawAtStart = mockCamera.rotation.y;
    expect(yawAtStart).toBeCloseTo(yawBeforeReset, 1); // at t=0 of reset, yaw = startYaw

    // After full reset duration, yaw should be 0
    const endMs = 100 + CAMERA_RESET_DURATION_MS + 10;
    sceneApi.render(endMs); // t=1 → yaw=0
    expect(mockCamera.rotation.y).toBe(0);
  });

  it('camera yaw stays 0 in default mode when never entering riding mode', () => {
    sceneApi.render(0);
    sceneApi.render(100);
    expect(mockCamera.rotation.y).toBe(0);
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
