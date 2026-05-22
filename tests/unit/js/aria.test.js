// Unit tests — Story 4.4: ARIA roles and keyboard navigation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SetupScreen } from '../../../static/game/ui/setup.js';
import { OverlayManager } from '../../../static/game/ui/overlay.js';

function makeMockElement(tagName = 'div') {
  const classList = new Set();
  const attrs = {};
  const listeners = {};
  let _textContent = '';
  const el = {
    tagName,
    getAttribute: vi.fn((attr) => attrs[attr] ?? null),
    removeAttribute: vi.fn((attr) => { delete attrs[attr]; }),
    _attrs: attrs,
    style: {},
    get textContent() { return _textContent; },
    set textContent(v) { _textContent = v; },
    innerHTML: '',
    focus: vi.fn(),
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    children: [],
    parentNode: null,
    appendChild: vi.fn(),
    id: '',
  };
  const cls = {
    add: vi.fn((...cs) => cs.forEach(c => classList.add(c))),
    remove: vi.fn((...cs) => cs.forEach(c => classList.delete(c))),
    contains: vi.fn((c) => classList.has(c)),
    _set: classList,
  };
  Object.defineProperty(el, 'classList', { get: () => cls });
  // setAttribute records into attrs AND calls the mock fn
  el.setAttribute = vi.fn((attr, val) => { attrs[attr] = val; });
  return el;
}

function makeMockDocument() {
  return {
    createElement: vi.fn((tag) => makeMockElement(tag)),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    body: makeMockElement('body'),
    activeElement: null,
  };
}

// ─── Story 4.4: SetupScreen ARIA ─────────────────────────────────────────────

describe('SetupScreen — ARIA roles (Story 4.4)', () => {
  let mockDocument;
  let setup;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    setup = new SetupScreen();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('setup form element has role="form"', () => {
    expect(setup.formElement.setAttribute).toHaveBeenCalledWith('role', 'form');
  });

  it('setup form element has aria-label="Session Setup"', () => {
    expect(setup.formElement.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringMatching(/session setup/i),
    );
  });

  it('difficulty toggle group has role="radiogroup"', () => {
    expect(setup.difficultyGroup.setAttribute).toHaveBeenCalledWith('role', 'radiogroup');
  });

  it('difficulty toggle group has aria-label matching "Difficulty"', () => {
    expect(setup.difficultyGroup.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringMatching(/difficulty/i),
    );
  });

  it('instrument toggle group has role="radiogroup"', () => {
    expect(setup.instrumentGroup.setAttribute).toHaveBeenCalledWith('role', 'radiogroup');
  });

  it('each toggle option has role="radio"', () => {
    const allCalls = [
      ...setup.difficultyOptions.flatMap(el => el.setAttribute.mock.calls),
      ...setup.instrumentOptions.flatMap(el => el.setAttribute.mock.calls),
    ];
    const hasRadioRole = allCalls.some(([attr, val]) => attr === 'role' && val === 'radio');
    expect(hasRadioRole).toBe(true);
  });

  it('selected toggle option has aria-checked="true"', () => {
    const allCalls = setup.difficultyOptions.flatMap(el => el.setAttribute.mock.calls);
    const hasCheckedTrue = allCalls.some(([attr, val]) => attr === 'aria-checked' && val === 'true');
    expect(hasCheckedTrue).toBe(true);
  });

  it('unselected toggle options have aria-checked="false"', () => {
    const allCalls = setup.difficultyOptions.flatMap(el => el.setAttribute.mock.calls);
    const hasCheckedFalse = allCalls.some(([attr, val]) => attr === 'aria-checked' && val === 'false');
    expect(hasCheckedFalse).toBe(true);
  });

  it('selectDifficulty("hard") sets aria-checked="true" on the hard option', () => {
    setup.selectDifficulty('hard');
    const hardOption = setup.difficultyOptions[2];
    const lastCall = hardOption.setAttribute.mock.calls
      .filter(([attr]) => attr === 'aria-checked')
      .at(-1);
    expect(lastCall).toEqual(['aria-checked', 'true']);
  });
});

// ─── Story 4.4: OverlayManager ARIA ──────────────────────────────────────────

describe('OverlayManager — ARIA roles (Story 4.4)', () => {
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

  it('overlay container has role="dialog" when shown', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.containerElement.setAttribute).toHaveBeenCalledWith('role', 'dialog');
  });

  it('overlay container has aria-modal="true" when shown', () => {
    overlay.show({ type: 'pause' });
    expect(overlay.containerElement.setAttribute).toHaveBeenCalledWith('aria-modal', 'true');
  });

  it('overlay container has aria-labelledby pointing to a non-empty string', () => {
    overlay.show({ type: 'pause' });
    const calls = overlay.containerElement.setAttribute.mock.calls.filter(([attr]) => attr === 'aria-labelledby');
    expect(calls.length).toBeGreaterThan(0);
    expect(typeof calls[0][1]).toBe('string');
    expect(calls[0][1].length).toBeGreaterThan(0);
  });

  it('Tab keydown is handled (preventDefault called or focusTrapActive is true)', () => {
    overlay.show({ type: 'pause' });
    const preventDefault = vi.fn();
    overlay.onKeyDown?.({ key: 'Tab', preventDefault, shiftKey: false });
    const handled = preventDefault.mock.calls.length > 0 || overlay.focusTrapActive;
    expect(handled).toBe(true);
  });
});

// ─── Story 4.4: Keyboard navigation ──────────────────────────────────────────

describe('SetupScreen — keyboard navigation (Story 4.4)', () => {
  let mockDocument;
  let setup;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    setup = new SetupScreen();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ArrowRight key within a toggle group moves focus to next option', () => {
    const firstOption = setup.difficultyOptions[0];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowRight',
      target: firstOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[1].focus).toHaveBeenCalled();
  });

  it('ArrowLeft key within a toggle group moves focus to previous option', () => {
    const thirdOption = setup.difficultyOptions[2];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowLeft',
      target: thirdOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[1].focus).toHaveBeenCalled();
  });

  it('Home key moves to first option', () => {
    const thirdOption = setup.difficultyOptions[2];
    setup.onToggleGroupKeyDown?.({
      key: 'Home',
      target: thirdOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[0].focus).toHaveBeenCalled();
  });

  it('End key moves to last option', () => {
    const firstOption = setup.difficultyOptions[0];
    setup.onToggleGroupKeyDown?.({
      key: 'End',
      target: firstOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[2].focus).toHaveBeenCalled();
  });

  it('ArrowRight from last option wraps to first', () => {
    const lastOption = setup.difficultyOptions[2];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowRight',
      target: lastOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[0].focus).toHaveBeenCalled();
  });

  it('ArrowLeft from first option wraps to last', () => {
    const firstOption = setup.difficultyOptions[0];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowLeft',
      target: firstOption,
      preventDefault: vi.fn(),
    });
    expect(setup.difficultyOptions[2].focus).toHaveBeenCalled();
  });

  it('keyboardNavigationEnabled is true', () => {
    expect(setup.keyboardNavigationEnabled).toBe(true);
  });
});
