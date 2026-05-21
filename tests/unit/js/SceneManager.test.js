// Red-phase ATDD scaffold — Story 3.1: SceneManager and Three.js canvas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneManager } from '../../../static/game/SceneManager.js';

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
  const mockScene = {};
  const mockCamera = {
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    position: { set: vi.fn() },
    lookAt: vi.fn(),
  };
  return {
    WebGLRenderer: vi.fn(() => mockRenderer),
    Scene: vi.fn(() => mockScene),
    PerspectiveCamera: vi.fn(() => mockCamera),
    Color: vi.fn(),
    DirectionalLight: vi.fn(() => ({ position: { set: vi.fn() } })),
    AmbientLight: vi.fn(),
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
