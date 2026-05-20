// Red-phase ATDD scaffold — Story 3.1: SceneManager and Three.js canvas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: SceneManager.js does not exist yet — import will fail until implementation
// TODO: Three.js WebGLRenderer is mocked below; SceneManager must be importable in node env
import { SceneManager } from '../../../static/game/SceneManager.js';

// Mock the 'three' module entirely to avoid WebGL/DOM requirements in node env
vi.mock('three', () => {
  const mockRenderer = {
    setSize: vi.fn(),
    render: vi.fn(),
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
    it.skip('SceneManager.init(container) does not throw (smoke test with mock container)', () => {
      const container = makeMockContainer();
      expect(() => SceneManager.init(container)).not.toThrow();
    });
  });

  describe('render()', () => {
    it.skip('SceneManager.render() calls the renderer render method', () => {
      const container = makeMockContainer();
      SceneManager.init(container);
      // Access the underlying renderer spy via SceneManager internals or via the mock
      const { WebGLRenderer } = await import('three');
      const rendererInstance = WebGLRenderer.mock.results[0].value;
      SceneManager.render();
      expect(rendererInstance.render).toHaveBeenCalled();
    });

    it.skip('SceneManager.js does not write to any GameState sub-object after render', () => {
      // This test documents an architectural constraint.
      // SceneManager should be read-only with respect to GameState.
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
    it.skip('resize handler updates renderer on window resize', async () => {
      const container = makeMockContainer();
      SceneManager.init(container);
      const { WebGLRenderer } = await import('three');
      const rendererInstance = WebGLRenderer.mock.results[0].value;
      rendererInstance.setSize.mockClear();
      // Simulate window resize
      if (typeof SceneManager.onResize === 'function') {
        SceneManager.onResize(1024, 768);
      } else {
        // Trigger via window resize event if SceneManager auto-registers
        window.dispatchEvent(new Event('resize'));
      }
      expect(rendererInstance.setSize).toHaveBeenCalled();
    });
  });
});
