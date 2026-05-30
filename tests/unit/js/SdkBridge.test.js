import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal DOM stubs for tests running in node environment
function makeElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    textContent: '',
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
  };
}

function stubDom() {
  vi.stubGlobal('document', { createElement: vi.fn(() => makeElement()), getElementById: vi.fn(() => null) });
  vi.stubGlobal('window', {
    __slopsmithSdkBridge: null,
    __gameState: null,
    slopsmithMinigames: undefined,
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('performance', { now: vi.fn(() => 1000) });
}

describe('SdkDetector', () => {
  let SdkDetector;

  beforeEach(async () => {
    stubDom();
    ({ SdkDetector } = await import('../../../static/game/SdkBridge.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('detect() returns null before any pitch event', async () => {
    const det = new SdkDetector();
    expect(await det.detect()).toBeNull();
  });

  it('attach() registers pitch handler and buffers valid events', async () => {
    const det = new SdkDetector();
    const listeners = {};
    const handle = { on: (ev, cb) => { listeners[ev] = cb; }, stop: vi.fn() };
    det.attach(handle);
    listeners.pitch({ midiFloat: 60.1, cents: 5, confidence: 0.9, tMs: 100 });
    const result = await det.detect();
    expect(result).toEqual({ midi: 60, confidence: 0.9, cents: 5, tMs: 100 });
  });

  it('attach() ignores events with confidence < 0.3', async () => {
    const det = new SdkDetector();
    const listeners = {};
    const handle = { on: (ev, cb) => { listeners[ev] = cb; }, stop: vi.fn() };
    det.attach(handle);
    listeners.pitch({ midiFloat: 60.0, cents: 0, confidence: 0.2, tMs: 100 });
    expect(await det.detect()).toBeNull();
  });

  it('attach() ignores MIDI values out of [21,108]', async () => {
    const det = new SdkDetector();
    const listeners = {};
    const handle = { on: (ev, cb) => { listeners[ev] = cb; }, stop: vi.fn() };
    det.attach(handle);
    listeners.pitch({ midiFloat: 10.0, cents: 0, confidence: 0.9, tMs: 100 });
    expect(await det.detect()).toBeNull();
  });

  it('stop() calls handle.stop() and clears latest', async () => {
    const det = new SdkDetector();
    const listeners = {};
    const handle = { on: (ev, cb) => { listeners[ev] = cb; }, stop: vi.fn() };
    det.attach(handle);
    listeners.pitch({ midiFloat: 60.0, cents: 0, confidence: 0.9, tMs: 100 });
    det.stop();
    expect(handle.stop).toHaveBeenCalled();
    expect(await det.detect()).toBeNull();
  });
});

describe('registerWithSdk', () => {
  let registerWithSdk;

  beforeEach(async () => {
    stubDom();
    ({ registerWithSdk } = await import('../../../static/game/SdkBridge.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('calls register() with correct id and lifecycle functions', () => {
    const registerMock = vi.fn();
    window.slopsmithMinigames = { register: registerMock };
    registerWithSdk();
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'subway-scaler',
        title: expect.any(String),
        start: expect.any(Function),
        stop: expect.any(Function),
      })
    );
  });

  it('queues registration if SDK not yet available', () => {
    window.slopsmithMinigames = undefined;
    window.__slopsmithMinigamesPending = undefined;
    registerWithSdk();
    expect(Array.isArray(window.__slopsmithMinigamesPending)).toBe(true);
    expect(window.__slopsmithMinigamesPending.length).toBe(1);
  });

  it('does not crash if SDK is undefined and window.addEventListener not available', () => {
    window.slopsmithMinigames = undefined;
    window.__slopsmithMinigamesPending = undefined;
    window.addEventListener = vi.fn();
    expect(() => registerWithSdk()).not.toThrow();
  });
});

describe('SdkBridge.end() reentry guard', () => {
  let SdkBridge;

  beforeEach(async () => {
    stubDom();
    ({ SdkBridge } = await import('../../../static/game/SdkBridge.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('end() is a no-op when already ended', async () => {
    const endMock = vi.fn(() => Promise.resolve());
    window.slopsmithMinigames = { end: endMock };
    SdkBridge._ended = true;
    await SdkBridge.end();
    expect(endMock).not.toHaveBeenCalled();
  });

  it('stop() calls end() only once when called twice', async () => {
    const endMock = vi.fn(() => Promise.resolve());
    window.slopsmithMinigames = { end: endMock };
    SdkBridge._ended = false;
    await SdkBridge.stop();
    await SdkBridge.stop();
    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
