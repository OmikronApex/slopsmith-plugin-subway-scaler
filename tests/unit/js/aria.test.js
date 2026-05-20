// Red-phase ATDD scaffold — Story 4.4: ARIA roles and keyboard navigation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: these modules do not exist yet — imports will fail until implementation
import { SetupScreen } from '../../../static/game/ui/setup.js';
import { OverlayManager } from '../../../static/game/ui/overlay.js';

function makeMockElement(tagName = 'div') {
  const classList = new Set();
  const attrs = {};
  const listeners = {};
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
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] ?? [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    children: [],
    parentNode: null,
  };
}

function makeMockDocument(extraElements = {}) {
  const formEl = makeMockElement('form');
  const difficultyGroupEl = makeMockElement('div');
  const instrumentGroupEl = makeMockElement('div');
  const difficultyOptions = [makeMockElement('button'), makeMockElement('button'), makeMockElement('button')];
  const instrumentOptions = [makeMockElement('button'), makeMockElement('button')];
  const overlayEl = makeMockElement('div');
  const scoreEl = makeMockElement('div');
  const startBtn = makeMockElement('button');

  return {
    createElement: vi.fn((tag) => makeMockElement(tag)),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => formEl),
    querySelectorAll: vi.fn(() => []),
    body: makeMockElement('body'),
    _formEl: formEl,
    _difficultyGroupEl: difficultyGroupEl,
    _instrumentGroupEl: instrumentGroupEl,
    _difficultyOptions: difficultyOptions,
    _instrumentOptions: instrumentOptions,
    _overlayEl: overlayEl,
    _scoreEl: scoreEl,
    _startBtn: startBtn,
    ...extraElements,
  };
}

// ─── Story 4.4: Setup screen ARIA ────────────────────────────────────────────

describe('SetupScreen — ARIA roles (Story 4.4)', () => {
  let mockDocument;
  let setup;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ scales: [{ id: 'major', name: 'Major' }] }),
    }));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    setup = new SetupScreen();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('setup form element has role="form"', () => {
    const formEl = setup.formElement ?? mockDocument._formEl;
    expect(formEl.setAttribute).toHaveBeenCalledWith('role', 'form');
  });

  it.skip('setup form element has aria-label="Session Setup"', () => {
    const formEl = setup.formElement ?? mockDocument._formEl;
    expect(formEl.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringMatching(/session setup/i),
    );
  });

  it.skip('difficulty toggle group has role="radiogroup"', () => {
    const groupEl = setup.difficultyGroup ?? mockDocument._difficultyGroupEl;
    expect(groupEl.setAttribute).toHaveBeenCalledWith('role', 'radiogroup');
  });

  it.skip('difficulty toggle group has an aria-label matching its label text', () => {
    const groupEl = setup.difficultyGroup ?? mockDocument._difficultyGroupEl;
    expect(groupEl.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringMatching(/difficulty/i),
    );
  });

  it.skip('instrument toggle group has role="radiogroup"', () => {
    const groupEl = setup.instrumentGroup ?? mockDocument._instrumentGroupEl;
    expect(groupEl.setAttribute).toHaveBeenCalledWith('role', 'radiogroup');
  });

  it.skip('each toggle option has role="radio"', () => {
    // At least one option element must have received role="radio"
    const allSetAttributeCalls = [
      ...mockDocument._difficultyOptions.flatMap(el => el.setAttribute.mock.calls),
      ...mockDocument._instrumentOptions.flatMap(el => el.setAttribute.mock.calls),
    ];
    const hasRadioRole = allSetAttributeCalls.some(
      ([attr, val]) => attr === 'role' && val === 'radio',
    );
    expect(hasRadioRole).toBe(true);
  });

  it.skip('selected toggle option has aria-checked="true"', () => {
    // After construction, medium is pre-selected — aria-checked="true"
    const allSetAttributeCalls = [
      ...mockDocument._difficultyOptions.flatMap(el => el.setAttribute.mock.calls),
    ];
    const hasCheckedTrue = allSetAttributeCalls.some(
      ([attr, val]) => attr === 'aria-checked' && val === 'true',
    );
    expect(hasCheckedTrue).toBe(true);
  });

  it.skip('unselected toggle options have aria-checked="false"', () => {
    const allSetAttributeCalls = [
      ...mockDocument._difficultyOptions.flatMap(el => el.setAttribute.mock.calls),
    ];
    const hasCheckedFalse = allSetAttributeCalls.some(
      ([attr, val]) => attr === 'aria-checked' && val === 'false',
    );
    expect(hasCheckedFalse).toBe(true);
  });

  it.skip('selecting a toggle option updates aria-checked on the selected option and clears others', () => {
    const option = setup.difficultyOptions?.[2] ?? mockDocument._difficultyOptions[2];
    setup.selectDifficulty?.('hard');
    // The hard option should now be aria-checked=true
    expect(option.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
  });
});

// ─── Story 4.4: Overlay ARIA ─────────────────────────────────────────────────

describe('OverlayManager — ARIA roles (Story 4.4)', () => {
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

  it.skip('overlay container has role="dialog" when shown', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.setAttribute).toHaveBeenCalledWith('role', 'dialog');
  });

  it.skip('overlay container has aria-modal="true" when shown', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    expect(el.setAttribute).toHaveBeenCalledWith('aria-modal', 'true');
  });

  it.skip('overlay container has aria-labelledby pointing to the heading element id', () => {
    overlay.show({ type: 'pause' });
    const el = overlay.containerElement ?? mockDocument._overlayEl;
    const labelledByCalls = el.setAttribute.mock.calls.filter(([attr]) => attr === 'aria-labelledby');
    expect(labelledByCalls.length).toBeGreaterThan(0);
    const headingId = labelledByCalls[0][1];
    expect(typeof headingId).toBe('string');
    expect(headingId.length).toBeGreaterThan(0);
  });

  it.skip('focus is trapped inside the overlay — Tab keydown is handled to prevent focus leaving overlay', () => {
    overlay.show({ type: 'pause' });
    const preventDefaultSpy = vi.fn();
    overlay.onKeyDown?.({ key: 'Tab', preventDefault: preventDefaultSpy, shiftKey: false });
    // Tab should be handled by the overlay (either calls preventDefault or moves focus internally)
    const handled = preventDefaultSpy.mock.calls.length > 0 || overlay.focusTrapActive;
    expect(handled).toBe(true);
  });
});

// ─── Story 4.4: Score display ARIA ───────────────────────────────────────────

describe('Score display — aria-live (Story 4.4)', () => {
  let mockDocument;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('score display element has aria-live="polite" so screen readers announce score changes', async () => {
    // Import ScoreDisplay lazily to use updated document stub
    const { ScoreDisplay } = await import('../../../static/game/ui/score-display.js');
    const display = new ScoreDisplay();
    const el = display.element ?? display.domElement ?? mockDocument._scoreEl;
    expect(el.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
  });
});

// ─── Story 4.4: Keyboard navigation ──────────────────────────────────────────

describe('SetupScreen — keyboard navigation (Story 4.4)', () => {
  let mockDocument;
  let setup;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ scales: [] }),
    }));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    setup = new SetupScreen();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('ArrowRight key within a toggle group moves focus to the next option', () => {
    const firstOption = setup.difficultyOptions?.[0] ?? mockDocument._difficultyOptions[0];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowRight',
      target: firstOption,
      preventDefault: vi.fn(),
    });
    const secondOption = setup.difficultyOptions?.[1] ?? mockDocument._difficultyOptions[1];
    expect(secondOption.focus).toHaveBeenCalled();
  });

  it.skip('ArrowLeft key within a toggle group moves focus to the previous option', () => {
    const thirdOption = setup.difficultyOptions?.[2] ?? mockDocument._difficultyOptions[2];
    setup.onToggleGroupKeyDown?.({
      key: 'ArrowLeft',
      target: thirdOption,
      preventDefault: vi.fn(),
    });
    const secondOption = setup.difficultyOptions?.[1] ?? mockDocument._difficultyOptions[1];
    expect(secondOption.focus).toHaveBeenCalled();
  });

  it.skip('all interactive elements receive keyboard event listeners (addEventListener called for keydown or keyup)', () => {
    // At minimum the form or toggle groups should have a keyboard listener registered
    const formListenerCalls = mockDocument._formEl.addEventListener.mock.calls;
    const keyboardListeners = formListenerCalls.filter(
      ([evt]) => evt === 'keydown' || evt === 'keyup',
    );
    expect(keyboardListeners.length > 0 || setup.keyboardNavigationEnabled).toBe(true);
  });
});
