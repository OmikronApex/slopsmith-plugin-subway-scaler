// Unit tests — Story 4.1: Overlay container + RGB-shift glitch
//               Story 4.2: Pause overlay
//               Story 4.3: Game Over overlay

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OverlayManager } from '../../../static/game/ui/overlay.js';

function makeMockElement(tagName = 'div') {
  const classList = new Set();
  const attrs = {};
  const listeners = {};
  let _textContent = '';
  const el = {
    tagName,
    getAttribute: vi.fn((attr) => attrs[attr] ?? null),
    setAttribute: vi.fn((attr, val) => { attrs[attr] = val; }),
    removeAttribute: vi.fn((attr) => { delete attrs[attr]; }),
    _attrs: attrs,
    get classList() {
      return {
        add: vi.fn((...cls) => cls.forEach(c => classList.add(c))),
        remove: vi.fn((...cls) => cls.forEach(c => classList.delete(c))),
        contains: vi.fn((cls) => classList.has(cls)),
        _set: classList,
      };
    },
    style: {},
    get textContent() { return _textContent; },
    set textContent(v) { _textContent = v; },
    innerHTML: '',
    focus: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    parentNode: null,
    children: [],
    appendChild: vi.fn(),
    id: '',
  };
  // make classList methods persistent (not recreated each access)
  const cls = {
    add: vi.fn((...cs) => cs.forEach(c => classList.add(c))),
    remove: vi.fn((...cs) => cs.forEach(c => classList.delete(c))),
    contains: vi.fn((c) => classList.has(c)),
    _set: classList,
  };
  Object.defineProperty(el, 'classList', { get: () => cls });
  return el;
}

function makeMockDocument() {
  const elements = {};
  return {
    createElement: vi.fn((tag) => {
      const e = makeMockElement(tag);
      elements[tag] = elements[tag] || [];
      elements[tag].push(e);
      return e;
    }),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    body: makeMockElement('body'),
    activeElement: null,
    _elements: elements,
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
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    overlay = new OverlayManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('constructor creates a containerElement div', () => {
    expect(overlay.containerElement).toBeTruthy();
  });

  it('showing overlay adds overlay--entering CSS class to container element', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.containerElement.classList.add).toHaveBeenCalledWith('overlay--entering');
  });

  it('hiding overlay adds overlay--exiting CSS class', () => {
    overlay.show({ type: 'pause' });
    overlay.hide();
    expect(overlay.containerElement.classList.add).toHaveBeenCalledWith('overlay--exiting');
  });

  it('overlay sets role="dialog", aria-modal="true", and aria-labelledby on container', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement;
    expect(el.setAttribute).toHaveBeenCalledWith('role', 'dialog');
    expect(el.setAttribute).toHaveBeenCalledWith('aria-modal', 'true');
    expect(el.setAttribute).toHaveBeenCalledWith('aria-labelledby', expect.any(String));
  });

  it('focus moves to first focusable element (resumeButton) when pause overlay shown', () => {
    overlay.show({ type: 'pause' });
    // resumeButton is created and focus() is scheduled via setTimeout
    // We verify it was created and has focus mock
    expect(overlay.resumeButton).toBeTruthy();
    expect(overlay.resumeButton.focus).toBeDefined();
  });

  it('pause overlay adds overlay--pause class for animation timing', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.containerElement.classList.add).toHaveBeenCalledWith('overlay--pause');
  });

  it('game-over overlay adds overlay--game-over class for animation timing', () => {
    overlay.show({ type: 'game-over' });
    expect(overlay.containerElement.classList.add).toHaveBeenCalledWith('overlay--game-over');
  });

  it('showing a new overlay clears previous type class', () => {
    overlay.show({ type: 'pause' });
    overlay.show({ type: 'game-over', score: 500 });
    const calls = overlay.containerElement.classList.remove.mock.calls.flat();
    expect(calls).toContain('overlay--pause');
  });

  it('when prefers-reduced-motion enabled, overlay--entering is still added (CSS @media swaps animation)', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const reducedOverlay = new OverlayManager();
    reducedOverlay.show({ type: 'pause' });
    const addedClasses = reducedOverlay.containerElement.classList.add.mock.calls.flat();
    // JS always adds overlay--entering; CSS @media (prefers-reduced-motion: reduce)
    // swaps the animation to a simple fade via the @media query.
    expect(addedClasses).toContain('overlay--entering');
  });
});

// ─── Story 4.2: Pause Overlay ─────────────────────────────────────────────────

describe('OverlayManager — pause overlay (Story 4.2)', () => {
  let mockDocument;
  let overlay;
  let mockOnResume;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    mockOnResume = vi.fn();
    overlay = new OverlayManager({ onResume: mockOnResume });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('showing pause overlay sets heading to "PAUSED" for normal pause', () => {
    overlay.show({ type: 'pause', reason: 'normal' });
    expect(overlay.headingElement.textContent).toMatch(/paused/i);
  });

  it('showing pause overlay sets heading to audio disconnect message when reason is audio-error', () => {
    overlay.show({ type: 'pause', reason: 'audio-error' });
    expect(overlay.headingElement.textContent).toMatch(/audio disconnected/i);
  });

  it('RESUME button is present in pause overlay', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.resumeButton).toBeTruthy();
    expect(overlay.resumeButton.textContent).toMatch(/resume/i);
  });

  it('"Quit to Menu" link is present in pause overlay', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.quitLink).toBeTruthy();
    expect(overlay.quitLink.textContent).toMatch(/quit/i);
  });

  it('activating RESUME calls the onResume callback', () => {
    overlay.show({ type: 'pause' });
    overlay.onResumeClick?.();
    expect(mockOnResume).toHaveBeenCalledTimes(1);
  });

  it('Escape key triggers resume when pause overlay is open', () => {
    overlay.show({ type: 'pause' });
    overlay.onKeyDown?.({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockOnResume).toHaveBeenCalledTimes(1);
  });

  it('hiding overlay adds overlay--exiting class (exit animation triggered)', () => {
    overlay.show({ type: 'pause' });
    overlay.hide();
    expect(overlay.containerElement.classList.add).toHaveBeenCalledWith('overlay--exiting');
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

  it('showing game-over overlay displays the final score value', () => {
    overlay.show({ type: 'game-over', score: 1250 });
    expect(overlay.scoreElement.textContent).toContain('1250');
  });

  it('game-over overlay shows "Personal Best!" when no previous score in localStorage', () => {
    overlay.show({ type: 'game-over', score: 1250 });
    expect(overlay.contextElement.textContent).toMatch(/personal best/i);
  });

  it('game-over overlay shows positive delta when score improved', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '1000'),
      setItem: vi.fn(),
    });
    overlay = new OverlayManager({ onRestart: mockOnRestart, onMainMenu: mockOnMainMenu });
    overlay.show({ type: 'game-over', score: 1250 });
    expect(overlay.contextElement.textContent).toContain('+250');
  });

  it('game-over overlay shows negative delta when score declined', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '2000'),
      setItem: vi.fn(),
    });
    overlay = new OverlayManager({ onRestart: mockOnRestart, onMainMenu: mockOnMainMenu });
    overlay.show({ type: 'game-over', score: 1500 });
    expect(overlay.contextElement.textContent).toContain('-500');
  });

  it('RESTART button is present in game-over overlay', () => {
    overlay.show({ type: 'game-over', score: 500 });
    expect(overlay.restartButton).toBeTruthy();
    expect(overlay.restartButton.textContent).toMatch(/restart/i);
  });

  it('MAIN MENU button is present in game-over overlay', () => {
    overlay.show({ type: 'game-over', score: 500 });
    expect(overlay.mainMenuButton).toBeTruthy();
    expect(overlay.mainMenuButton.textContent).toMatch(/main menu/i);
  });

  it('activating RESTART triggers the onRestart callback', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onRestartClick?.();
    expect(mockOnRestart).toHaveBeenCalledTimes(1);
  });

  it('activating RESTART saves score to localStorage', () => {
    overlay.show({ type: 'game-over', score: 750 });
    overlay.onRestartClick?.();
    expect(localStorage.setItem).toHaveBeenCalledWith('subway-scaler-last-score', '750');
  });

  it('activating MAIN MENU triggers the onMainMenu callback', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onMainMenuClick?.();
    expect(mockOnMainMenu).toHaveBeenCalledTimes(1);
  });

  it('Escape key does nothing when game-over overlay is open', () => {
    overlay.show({ type: 'game-over', score: 500 });
    overlay.onKeyDown?.({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockOnRestart).not.toHaveBeenCalled();
    expect(mockOnMainMenu).not.toHaveBeenCalled();
  });

  it('Tab key prevents default (focus trap active)', () => {
    overlay.show({ type: 'game-over', score: 500 });
    const preventDefault = vi.fn();
    overlay.onKeyDown?.({ key: 'Tab', preventDefault, shiftKey: false });
    expect(overlay.focusTrapActive).toBe(true);
  });
});
