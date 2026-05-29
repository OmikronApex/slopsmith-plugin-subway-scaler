import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeElement(tag = 'span') {
  const classList = new Set();
  const attrs = {};
  let _textContent = '';
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    get textContent() { return _textContent; },
    set textContent(v) { _textContent = v; },
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: vi.fn((k, v) => { attrs[k] = v; }),
    remove: vi.fn(),
  };
  const cls = {
    _set: classList,
    add: vi.fn((...cs) => cs.forEach(c => classList.add(c))),
    remove: vi.fn((...cs) => cs.forEach(c => classList.delete(c))),
    contains: (c) => classList.has(c),
  };
  Object.defineProperty(el, 'classList', { get: () => cls });
  return el;
}

function makeHudShell() {
  return {
    registerChild: vi.fn(),
  };
}

function makeDoc() {
  return {
    createElement: vi.fn((tag) => makeElement(tag)),
  };
}

describe('ScoreDisplay', () => {
  let ScoreDisplay;

  beforeEach(async () => {
    vi.stubGlobal('document', makeDoc());
    vi.useFakeTimers();
    ({ ScoreDisplay } = await import('../../../static/game/ui/ScoreDisplay.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('creates a span element with class hud-score', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    expect(el.className).toBe('hud-score');
  });

  it('sets aria-live="polite" on span', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    expect(el.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
  });

  it('sets aria-atomic="true" on span', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    expect(el.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
  });

  it('registers with HudShell as "score"', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(shell.registerChild).toHaveBeenCalledWith('score', expect.any(Object));
  });

  it('initialises display to "0"', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    expect(el.textContent).toBe('0');
  });

  it('update() sets textContent to string of score', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    sd.update(42);
    expect(el.textContent).toBe('42');
  });

  it('update() adds .score-increment class on score change', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    sd.update(10);
    expect(el.classList.add).toHaveBeenCalledWith('score-increment');
  });

  it('update() removes .score-increment class after 150ms', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    sd.update(10);
    vi.advanceTimersByTime(150);
    expect(el.classList.remove).toHaveBeenCalledWith('score-increment');
  });

  it('update() does NOT add .score-increment if score unchanged', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    sd.update(0); // same as init
    expect(el.classList.add).not.toHaveBeenCalledWith('score-increment');
  });

  it('destroy() removes element', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    const el = document.createElement.mock.results[0].value;
    sd.destroy();
    expect(el.remove).toHaveBeenCalled();
  });
});
