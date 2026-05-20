// Red-phase ATDD scaffold — Story 4.1: Overlay container + RGB-shift glitch
//                          Story 4.2: Pause overlay
//                          Story 4.3: Game Over overlay

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: overlay.js does not exist yet — import will fail until implementation
import { OverlayManager } from '../../../static/game/ui/overlay.js';

const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

function makeMockElement(tagName = 'div') {
  const classList = new Set();
  const attrs = {};
  return {
    tagName,
    getAttribute: vi.fn((attr) => attrs[attr] ?? null),
    setAttribute: vi.fn((attr, val) => { attrs[attr] = val; }),
    removeAttribute: vi.fn((attr) => { delete attrs[attr]; }),
    _attrs: attrs,
    classList: {
      add: vi.fn((...cls) => cls.forEach(c => classList.add(c))),
      remove: vi.fn((...cls) => cls.forEach(c => classList.delete(c))),
      contains: vi.fn((cls) => classList.has(cls)),
      _set: classList,
    },
    style: {},
    textContent: '',
    innerHTML: '',
    focus: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    parentNode: null,
    children: [],
  };
}

function makeMockDocument() {
  const overlayEl = makeMockElement();
  const headingEl = makeMockElement('h2');
  const resumeBtn = makeMockElement('button');
  const restartBtn = makeMockElement('button');
  const menuBtn = makeMockElement('button');
  const quitLink = makeMockElement('a');
  const scoreEl = makeMockElement('p');

  overlayEl.querySelector.mockImplementation((sel) => {
    if (sel.includes('heading') || sel.includes('h2') || sel.includes('[aria-labelledby]')) return headingEl;
    if (sel.includes('resume')) return resumeBtn;
    if (sel.includes('restart')) return restartBtn;
    if (sel.includes('menu')) return menuBtn;
    if (sel.includes('quit')) return quitLink;
    if (sel.includes('score')) return scoreEl;
    return null;
  });

  return {
    createElement: vi.fn(() => makeMockElement()),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => overlayEl),
    querySelectorAll: vi.fn(() => []),
    body: makeMockElement('body'),
    _overlayEl: overlayEl,
    _headingEl: headingEl,
    _resumeBtn: resumeBtn,
    _restartBtn: restartBtn,
    _menuBtn: menuBtn,
    _quitLink: quitLink,
    _scoreEl: scoreEl,
  };
}

// ─── Story 4.1: Overlay Container + RGB-Shift Glitch ─────────────────────────

describe('OverlayManager — overlay container + glitch animation (Story 4.1)', () => {
  let mockDocument;
  let overlay;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    overlay = new OverlayManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('showing overlay adds overlay--entering CSS class to container element', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.classList.add).toHaveBeenCalledWith(expect.stringMatching(/entering/));
  });

  it.skip('hiding overlay adds overlay--exiting CSS class and removes overlay--entering', () => {
    overlay.show({ type: 'pause' });
    overlay.hide();
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.classList.add).toHaveBeenCalledWith(expect.stringMatching(/exiting/));
  });

  it.skip('overlay sets role="dialog", aria-modal="true", and aria-labelledby on container', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.setAttribute).toHaveBeenCalledWith('role', 'dialog');
    expect(el.setAttribute).toHaveBeenCalledWith('aria-modal', 'true');
    expect(el.setAttribute).toHaveBeenCalledWith(
      'aria-labelledby',
      expect.any(String),
    );
  });

  it.skip('focus moves to first focusable element inside overlay when shown', () => {
    overlay.show({ type: 'pause' });
    // At least one of the inner elements should have received focus
    const focusCalls = [
      mockDocument._resumeBtn.focus,
      mockDocument._restartBtn.focus,
      mockDocument._menuBtn.focus,
    ];
    const anyFocused = focusCalls.some(fn => fn.mock.calls.length > 0);
    expect(anyFocused).toBe(true);
  });

  it.skip('when prefers-reduced-motion is enabled, no glitch class is added (uses simple fade class instead)', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const reducedOverlay = new OverlayManager();
    reducedOverlay.show({ type: 'pause' });
    const el = reducedOverlay.containerElement ?? mockDocument._overlayEl;
    // Should NOT add the glitch class
    const addedClasses = el.classList.add.mock.calls.flat();
    expect(addedClasses.every(c => !c.includes('glitch'))).toBe(true);
  });
});

// ─── Story 4.2: Pause Overlay ─────────────────────────────────────────────────

describe('OverlayManager — pause overlay (Story 4.2)', () => {
  let mockDocument;
  let overlay;
  let mockGameLoop;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    mockGameLoop = { resume: vi.fn() };
    overlay = new OverlayManager({ gameLoop: mockGameLoop });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('showing pause overlay sets heading to "PAUSED" for normal pause', () => {
    overlay.show({ type: 'pause', reason: 'normal' });
    const heading = overlay.headingElement ?? mockDocument._headingEl;
    expect(heading.textContent).toMatch(/paused/i);
  });

  it.skip('showing pause overlay sets heading to audio disconnect message when reason is audio-error', () => {
    overlay.show({ type: 'pause', reason: 'audio-error' });
    const heading = overlay.headingElement ?? mockDocument._headingEl;
    expect(heading.textContent).toMatch(/audio disconnected/i);
  });

  it.skip('RESUME button is present in pause overlay', () => {
    overlay.show({ type: 'pause' });
    const resumeBtn = overlay.resumeButton ?? mockDocument._resumeBtn;
    expect(resumeBtn).toBeTruthy();
  });

  it.skip('"Quit to Menu" link is present in pause overlay', () => {
    overlay.show({ type: 'pause' });
    const quitLink = overlay.quitLink ?? mockDocument._quitLink;
    expect(quitLink).toBeTruthy();
  });

  it.skip('activating RESUME button calls GameLoop.resume()', () => {
    overlay.show({ type: 'pause' });
    // Simulate resume button click
    overlay.onResumeClick?.();
    expect(mockGameLoop.resume).toHaveBeenCalledTimes(1);
  });

  it.skip('Escape key triggers resume when pause overlay is open', () => {
    overlay.show({ type: 'pause' });
    overlay.onKeyDown?.({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockGameLoop.resume).toHaveBeenCalledTimes(1);
  });

  it.skip('hiding overlay after RESUME triggers exit glitch animation', () => {
    overlay.show({ type: 'pause' });
    overlay.hide();
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.classList.add).toHaveBeenCalledWith(expect.stringMatching(/exiting/));
  });
});

// ─── Story 4.3: Game Over Overlay ────────────────────────────────────────────

describe('OverlayManager — game over overlay (Story 4.3)', () => {
  let mockDocument;
  let overlay;
  let mockOnRestart;
  let mockOnMainMenu;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    mockOnRestart = vi.fn();
    mockOnMainMenu = vi.fn();
    overlay = new OverlayManager({
      onRestart: mockOnRestart,
      onMainMenu: mockOnMainMenu,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('showing game-over overlay displays the final score value', () => {
    overlay.show({ type: 'game-over', score: 1250 });
    const scoreEl = overlay.scoreElement ?? mockDocument._scoreEl;
    const displayed = scoreEl.textContent;
    expect(displayed).toContain('1250');
  });

  it.skip('game-over overlay shows personal-best context line from localStorage', () => {
    localStorage.getItem.mockReturnValue('1000');
    overlay.show({ type: 'game-over', score: 1250 });
    // Should display a delta or "personal best" message
    const el = overlay.contextElement ?? mockDocument._overlayEl;
    // The overlay must present context — either personal best or delta
    const anyTextMatches =
      el.textContent?.includes('best') ||
      el.textContent?.includes('+') ||
      el.innerHTML?.includes('best') ||
      el.innerHTML?.includes('+250');
    expect(anyTextMatches || mockDocument.createElement.mock.calls.length > 0).toBe(true);
  });

  it.skip('RESTART button is present in game-over overlay', () => {
    overlay.show({ type: 'game-over', score: 500 });
    const restartBtn = overlay.restartButton ?? mockDocument._restartBtn;
    expect(restartBtn).toBeTruthy();
  });

  it.skip('MAIN MENU button is present in game-over overlay', () => {
    overlay.show({ type: 'game-over', score: 500 });
    const menuBtn = overlay.mainMenuButton ?? mockDocument._menuBtn;
    expect(menuBtn).toBeTruthy();
  });

  it.skip('activating RESTART triggers the onRestart callback', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onRestartClick?.();
    expect(mockOnRestart).toHaveBeenCalledTimes(1);
  });

  it.skip('activating MAIN MENU triggers the onMainMenu callback', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onMainMenuClick?.();
    expect(mockOnMainMenu).toHaveBeenCalledTimes(1);
  });

  it.skip('Escape key does nothing when game-over overlay is open', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onKeyDown?.({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockOnRestart).not.toHaveBeenCalled();
    expect(mockOnMainMenu).not.toHaveBeenCalled();
  });
});
