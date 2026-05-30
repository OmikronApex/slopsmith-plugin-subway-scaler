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
    appendChild: vi.fn(),
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

  // ScoreDisplay now creates: [0] score span, [1] mult span, [2] wrapper
  function getScoreEl() { return document.createElement.mock.results[0].value; }
  function getMultEl() { return document.createElement.mock.results[1].value; }

  it('creates a span element with class hud-score', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(getScoreEl().className).toBe('hud-score');
  });

  it('sets aria-live="polite" on span', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(getScoreEl().setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
  });

  it('sets aria-atomic="true" on span', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(getScoreEl().setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
  });

  it('registers with HudShell as "score"', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(shell.registerChild).toHaveBeenCalledWith('score', expect.any(Object));
  });

  it('initialises display to "0"', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(getScoreEl().textContent).toBe('0');
  });

  it('initialises multiplier badge to "x1.0"', () => {
    const shell = makeHudShell();
    new ScoreDisplay(shell);
    expect(getMultEl().textContent).toBe('x1.0');
  });

  it('update() sets textContent to string of score', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.update(42);
    expect(getScoreEl().textContent).toBe('42');
  });

  it('update() adds .score-increment class on score change', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.update(10);
    expect(getScoreEl().classList.add).toHaveBeenCalledWith('score-increment');
  });

  it('update() removes .score-increment class after 150ms', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.update(10);
    vi.advanceTimersByTime(150);
    expect(getScoreEl().classList.remove).toHaveBeenCalledWith('score-increment');
  });

  it('update() does NOT add .score-increment if score unchanged', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.update(0); // same as init
    expect(getScoreEl().classList.add).not.toHaveBeenCalledWith('score-increment');
  });

  it('setDifficulty() updates multiplier badge text', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.setDifficulty('hard');
    expect(getMultEl().textContent).toBe('x3.0');
    sd.setDifficulty('medium');
    expect(getMultEl().textContent).toBe('x2.0');
    sd.setDifficulty('easy');
    expect(getMultEl().textContent).toBe('x1.0');
  });

  it('destroy() removes element', () => {
    const shell = makeHudShell();
    const sd = new ScoreDisplay(shell);
    sd.destroy();
    expect(getScoreEl().remove).toHaveBeenCalled();
  });
});
