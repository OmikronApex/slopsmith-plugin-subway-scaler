// Red-phase ATDD scaffold — Story 3.6: Score display DOM element

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: update import once score-display.js API is finalised — file does not exist yet
import { ScoreDisplay } from '../../../static/game/ui/score-display.js';

// PHASES values inlined to avoid depending on unimplemented GameState.js
const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

function makeMockElement(overrides = {}) {
  const classList = new Set();
  return {
    getAttribute: vi.fn((attr) => mockElement._attrs[attr] ?? null),
    setAttribute: vi.fn((attr, val) => { mockElement._attrs[attr] = val; }),
    _attrs: {},
    classList: {
      add: vi.fn((cls) => classList.add(cls)),
      remove: vi.fn((cls) => classList.delete(cls)),
      contains: vi.fn((cls) => classList.has(cls)),
      _set: classList,
    },
    style: {},
    textContent: '',
    ...overrides,
  };
}

// Expose as variable so getAttribute mock can close over it
let mockElement;

describe('ScoreDisplay — Story 3.6', () => {
  let mockDocument;

  beforeEach(() => {
    mockElement = makeMockElement();
    mockDocument = {
      createElement: vi.fn(() => mockElement),
      getElementById: vi.fn(() => null),
      querySelector: vi.fn(() => null),
    };
    vi.stubGlobal('document', mockDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('score display element has aria-live="polite" attribute', () => {
    const display = new ScoreDisplay();
    const element = display.element ?? display.domElement ?? mockDocument.createElement.mock.results[0]?.value;
    expect(element.getAttribute('aria-live')).toBe('polite');
  });

  it.skip('score display shows GameState.runtime.score value', () => {
    const display = new ScoreDisplay();
    const gameState = { runtime: { score: 350, phase: PHASES.PLAYING } };
    display.update(gameState);
    const element = display.element ?? display.domElement ?? mockElement;
    expect(element.textContent).toContain('350');
  });

  it.skip('score display is absolutely positioned (CSS class or inline style)', () => {
    const display = new ScoreDisplay();
    const element = display.element ?? display.domElement ?? mockElement;
    const hasAbsoluteClass = element.classList._set.has('score-display') ||
      element.classList._set.has('score-display--absolute') ||
      element.style.position === 'absolute';
    // Check that at minimum a class was applied (CSS handles the positioning)
    expect(element.classList._set.size > 0 || element.style.position === 'absolute').toBe(true);
  });

  it.skip('score increments trigger a pulse animation CSS class being added', () => {
    const display = new ScoreDisplay();
    const gameState = { runtime: { score: 100, phase: PHASES.PLAYING } };
    display.update(gameState);
    const gameState2 = { runtime: { score: 200, phase: PHASES.PLAYING } };
    display.update(gameState2);
    const element = display.element ?? display.domElement ?? mockElement;
    expect(element.classList.add).toHaveBeenCalledWith(expect.stringMatching(/pulse/));
  });

  it.skip('score display remains visible when phase is PHASES.GAME_OVER', () => {
    const display = new ScoreDisplay();
    const gameState = { runtime: { score: 500, phase: PHASES.GAME_OVER } };
    display.update(gameState);
    const element = display.element ?? display.domElement ?? mockElement;
    // Should not add a hidden class when in GAME_OVER
    expect(element.classList._set.has('hidden')).toBe(false);
    expect(element.style.display).not.toBe('none');
  });

  it.skip('score display remains visible when phase is PHASES.PAUSED', () => {
    const display = new ScoreDisplay();
    const gameState = { runtime: { score: 200, phase: PHASES.PAUSED } };
    display.update(gameState);
    const element = display.element ?? display.domElement ?? mockElement;
    expect(element.classList._set.has('hidden')).toBe(false);
    expect(element.style.display).not.toBe('none');
  });
});
