import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeElement(tag = 'button') {
  const attrs = {};
  const listeners = {};
  let _innerHTML = '';
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    type: '',
    get innerHTML() { return _innerHTML; },
    set innerHTML(v) { _innerHTML = v; },
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: vi.fn((k, v) => { attrs[k] = v; }),
    remove: vi.fn(),
    addEventListener: vi.fn((evt, cb) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    _attrs: attrs,
  };
  return el;
}

function makeHudShell() {
  return { registerChild: vi.fn() };
}

function makeDoc() {
  return { createElement: vi.fn((tag) => makeElement(tag)) };
}

describe('PauseButton', () => {
  let PauseButton;

  beforeEach(async () => {
    vi.stubGlobal('document', makeDoc());
    ({ PauseButton } = await import('../../../static/game/ui/PauseButton.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('creates a button with class hud-pause-btn', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    expect(el.className).toBe('hud-pause-btn');
  });

  it('button has aria-label="Pause game"', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    expect(el.setAttribute).toHaveBeenCalledWith('aria-label', 'Pause game');
  });

  it('button has type="button"', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    expect(el.setAttribute).toHaveBeenCalledWith('type', 'button');
  });

  it('button contains inline SVG pause icon', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    expect(el.innerHTML).toContain('<svg');
    expect(el.innerHTML).toContain('<rect');
  });

  it('click triggers onPause callback', () => {
    const shell = makeHudShell();
    const onPause = vi.fn();
    new PauseButton(shell, onPause);
    const el = document.createElement.mock.results[0].value;
    const clickHandler = el._listeners['click'][0];
    clickHandler();
    expect(onPause).toHaveBeenCalled();
  });

  it('registers with HudShell as "pause"', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    expect(shell.registerChild).toHaveBeenCalledWith('pause', expect.any(Object));
  });

  it('destroy() removes element', () => {
    const shell = makeHudShell();
    const pb = new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    pb.destroy();
    expect(el.remove).toHaveBeenCalled();
  });

  it('SVG fill uses var(--color-accent)', () => {
    const shell = makeHudShell();
    new PauseButton(shell, vi.fn());
    const el = document.createElement.mock.results[0].value;
    expect(el.innerHTML).toContain('var(--color-accent');
  });
});
