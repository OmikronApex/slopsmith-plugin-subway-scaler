import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ResizeObserver (not available in Node test env)
class MockResizeObserver {
  constructor(cb) { this._cb = cb; }
  observe() {}
  disconnect() { this._disconnected = true; }
}

function makeElement(tag = 'div') {
  const classList = new Set();
  const attrs = {};
  const children = [];
  const listeners = {};
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: vi.fn((k, v) => { attrs[k] = v; }),
    removeAttribute: vi.fn((k) => { delete attrs[k]; }),
    appendChild: vi.fn((child) => { children.push(child); }),
    remove: vi.fn(),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _children: children,
    _attrs: attrs,
  };
  const cls = {
    add: vi.fn((...cs) => cs.forEach(c => classList.add(c))),
    remove: vi.fn((...cs) => cs.forEach(c => classList.delete(c))),
    contains: (c) => classList.has(c),
    _set: classList,
  };
  Object.defineProperty(el, 'classList', { get: () => cls });
  return el;
}

function makeDocument() {
  return {
    createElement: vi.fn((tag) => makeElement(tag)),
  };
}

describe('HudShell', () => {
  let gameShell;
  let HudShell;

  beforeEach(async () => {
    gameShell = makeElement('div');
    vi.stubGlobal('document', makeDocument());
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
    });
    ({ HudShell } = await import('../../../static/game/ui/HudShell.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('appends .hud-shell container inside game-shell on construction', () => {
    const shell = new HudShell(gameShell);
    expect(gameShell.appendChild).toHaveBeenCalled();
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.className).toBe('hud-shell');
  });

  it('container has pointer-events: none', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.style.pointerEvents).toBe('none');
  });

  it('container has z-index: 100', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.style.zIndex).toBe('100');
  });

  it('container has no background (background: none)', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.style.background).toBe('none');
  });

  it('container starts hidden (display: none)', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.style.display).toBe('none');
  });

  it('container has role="group" and aria-label="Game HUD"', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    expect(container.setAttribute).toHaveBeenCalledWith('role', 'group');
    expect(container.setAttribute).toHaveBeenCalledWith('aria-label', 'Game HUD');
  });

  it('registerChild appends element and sets pointer-events: auto', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    const child = makeElement('div');
    shell.registerChild('score', child);
    expect(child.style.pointerEvents).toBe('auto');
    expect(container.appendChild).toHaveBeenCalledWith(child);
  });

  it('registerChild sets position: absolute on child', () => {
    const shell = new HudShell(gameShell);
    const child = makeElement('span');
    shell.registerChild('score', child);
    expect(child.style.position).toBe('absolute');
  });

  it('registerChild sets tabindex="-1" on non-interactive elements', () => {
    const shell = new HudShell(gameShell);
    const child = makeElement('span');
    shell.registerChild('score', child);
    expect(child.setAttribute).toHaveBeenCalledWith('tabindex', '-1');
  });

  it('registerChild does NOT set tabindex on BUTTON elements', () => {
    const shell = new HudShell(gameShell);
    const btn = makeElement('button');
    shell.registerChild('pause', btn);
    expect(btn.setAttribute).not.toHaveBeenCalledWith('tabindex', '-1');
  });

  it('show() removes display: none', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.show();
    expect(container.style.display).toBe('');
  });

  it('hide() sets display: none', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.show();
    shell.hide();
    expect(container.style.display).toBe('none');
  });

  it('onPhaseChange(PLAYING) shows container', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.onPhaseChange('playing');
    expect(container.style.display).toBe('');
  });

  it('onPhaseChange(PAUSED) shows container', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.onPhaseChange('paused');
    expect(container.style.display).toBe('');
  });

  it('onPhaseChange(IDLE) hides container', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.onPhaseChange('playing');
    shell.onPhaseChange('idle');
    expect(container.style.display).toBe('none');
  });

  it('onPhaseChange(GAME_OVER) hides container', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.onPhaseChange('playing');
    shell.onPhaseChange('game_over');
    expect(container.style.display).toBe('none');
  });

  it('destroy() removes container from DOM', () => {
    const shell = new HudShell(gameShell);
    const container = gameShell.appendChild.mock.calls[0][0];
    shell.destroy();
    expect(container.remove).toHaveBeenCalled();
  });

  it('destroy() does not throw if called twice', () => {
    const shell = new HudShell(gameShell);
    shell.destroy();
    expect(() => shell.destroy()).not.toThrow();
  });
});
