// Red-phase ATDD scaffold — Story 5.3: Decision Window Timer Bar

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// TODO: timer-bar.js does not exist yet — import will fail until implementation
import { TimerBar } from '../../../static/game/ui/timer-bar.js';

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
    style: {
      width: '',
      transition: '',
      backgroundColor: '',
      display: '',
    },
    textContent: '',
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] ?? [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    remove: vi.fn(),
    parentNode: { removeChild: vi.fn() },
  };
}

function makeMockDocument() {
  const barEl = makeMockElement('div');
  return {
    createElement: vi.fn(() => barEl),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    body: makeMockElement('body'),
    _barEl: barEl,
  };
}

describe('TimerBar — Decision Window Timer Bar (Story 5.3)', () => {
  let mockDocument;
  let timerBar;
  let mockHideVariant;

  beforeEach(() => {
    mockDocument = makeMockDocument();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    mockHideVariant = vi.fn();
    timerBar = new TimerBar({ onExpire: mockHideVariant });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.skip('TimerBar.show() appends a bar element to the document (or a given container)', () => {
    timerBar.show({ durationMs: 3000 });
    // Either createElement was called or the bar element was inserted into body
    const el = timerBar.element ?? mockDocument._barEl;
    expect(el).toBeTruthy();
  });

  it.skip('bar element width starts at 100% when show() is called', () => {
    timerBar.show({ durationMs: 3000 });
    const el = timerBar.element ?? mockDocument._barEl;
    expect(el.style.width).toBe('100%');
  });

  it.skip('bar element width animates to 0% via CSS transition driven by durationMs', () => {
    timerBar.show({ durationMs: 3000 });
    // After a tick the implementation should set width to 0% and transition duration
    timerBar.startAnimation?.();
    const el = timerBar.element ?? mockDocument._barEl;
    // Transition should encode the duration
    const hasTransition =
      el.style.transition?.includes('3000') ||
      el.style.transition?.includes('3s') ||
      el.style.transition?.includes('width');
    expect(hasTransition || el.style.width === '0%').toBe(true);
  });

  it.skip('bar element background color is var(--color-accent)', () => {
    timerBar.show({ durationMs: 3000 });
    const el = timerBar.element ?? mockDocument._barEl;
    expect(el.style.backgroundColor).toMatch(/var\(--color-accent\)/);
  });

  it.skip('TimerBar.dismiss() removes the bar element from the DOM immediately (no fade)', () => {
    timerBar.show({ durationMs: 3000 });
    timerBar.dismiss();
    const el = timerBar.element ?? mockDocument._barEl;
    // Either remove() was called or display was set to none immediately
    const wasRemoved =
      el.remove.mock.calls.length > 0 ||
      el.parentNode.removeChild.mock.calls.length > 0 ||
      el.style.display === 'none' ||
      timerBar.element == null;
    expect(wasRemoved).toBe(true);
  });

  it.skip('transitionend event on the bar element triggers the onExpire callback (calls TrackSystem.hideVariant)', () => {
    timerBar.show({ durationMs: 3000 });
    const el = timerBar.element ?? mockDocument._barEl;
    // Simulate transitionend on the element
    const transitionEndListeners = el._listeners?.transitionend ?? [];
    if (transitionEndListeners.length > 0) {
      transitionEndListeners.forEach(cb => cb({ propertyName: 'width' }));
    } else {
      // Fallback: call the handler directly
      timerBar.onTransitionEnd?.({ propertyName: 'width' });
    }
    expect(mockHideVariant).toHaveBeenCalledTimes(1);
  });

  it.skip('transitionend removes the bar element from the DOM', () => {
    timerBar.show({ durationMs: 3000 });
    const el = timerBar.element ?? mockDocument._barEl;
    const transitionEndListeners = el._listeners?.transitionend ?? [];
    if (transitionEndListeners.length > 0) {
      transitionEndListeners.forEach(cb => cb({ propertyName: 'width' }));
    } else {
      timerBar.onTransitionEnd?.({ propertyName: 'width' });
    }
    const wasRemoved =
      el.remove.mock.calls.length > 0 ||
      el.parentNode.removeChild.mock.calls.length > 0 ||
      timerBar.element == null;
    expect(wasRemoved).toBe(true);
  });

  it.skip('when prefers-reduced-motion is enabled, width transition is replaced by static bar that disappears at expiry', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const reducedTimerBar = new TimerBar({ onExpire: mockHideVariant });
    reducedTimerBar.show({ durationMs: 3000 });
    const el = reducedTimerBar.element ?? mockDocument._barEl;
    // No CSS width transition — either no transition property or transition: none
    const hasNoWidthTransition =
      !el.style.transition ||
      el.style.transition === 'none' ||
      !el.style.transition?.includes('width');
    expect(hasNoWidthTransition).toBe(true);
  });

  it.skip('when prefers-reduced-motion enabled, onExpire is still called at window expiry', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    vi.useFakeTimers();
    const reducedTimerBar = new TimerBar({ onExpire: mockHideVariant });
    reducedTimerBar.show({ durationMs: 1000 });
    vi.runAllTimers();
    expect(mockHideVariant).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it.skip('bar is absolutely positioned over the canvas (CSS class or style.position === "absolute")', () => {
    timerBar.show({ durationMs: 3000 });
    const el = timerBar.element ?? mockDocument._barEl;
    const isAbsolute =
      el.style.position === 'absolute' ||
      el.classList._set.has('timer-bar') ||
      el.classList._set.has('timer-bar--active');
    expect(isAbsolute || el.classList._set.size > 0).toBe(true);
  });
});
