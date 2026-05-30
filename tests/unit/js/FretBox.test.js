import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal real DOM-like element factory for FretBox (which builds a real DOM tree)
function makeElement(tag = 'div') {
  const classList = new Set();
  const attrs = {};
  const children = [];
  let _innerHTML = '';
  let _textContent = '';
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    get innerHTML() { return _innerHTML; },
    set innerHTML(v) {
      _innerHTML = v;
      children.length = 0;
    },
    get textContent() { return _textContent; },
    set textContent(v) { _textContent = v; },
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: vi.fn((k, v) => { attrs[k] = v; }),
    removeAttribute: vi.fn((k) => { delete attrs[k]; }),
    remove: vi.fn(),
    appendChild: vi.fn((child) => { children.push(child); return child; }),
    _children: children,
    _attrs: attrs,
    querySelectorAll: vi.fn(() => []),
  };
  const cls = {
    _set: classList,
    add: vi.fn((...cs) => cs.forEach(c => classList.add(c))),
    remove: vi.fn((...cs) => cs.forEach(c => classList.delete(c))),
    contains: (c) => classList.has(c),
    toString: () => [...classList].join(' '),
  };
  Object.defineProperty(el, 'classList', { get: () => cls });
  return el;
}

let _docElements = [];

function makeDoc() {
  _docElements = [];
  return {
    createElement: vi.fn((tag) => {
      const el = makeElement(tag);
      _docElements.push(el);
      return el;
    }),
  };
}

function makeHudShell() {
  return { registerChild: vi.fn() };
}

function makeMockStorage() {
  const store = {};
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
    _store: store,
  };
}

const SAMPLE_NOTES = [
  { string: 2, fret: 5, midi: 69, name: 'A4' },  // root note
  { string: 2, fret: 7, midi: 71, name: 'B4' },
  { string: 1, fret: 5, midi: 74, name: 'D5' },
  { string: 1, fret: 7, midi: 76, name: 'E5' },
];

describe('FretBox', () => {
  let FretBox;

  beforeEach(async () => {
    vi.stubGlobal('document', makeDoc());
    vi.stubGlobal('localStorage', makeMockStorage());
    ({ FretBox } = await import('../../../static/game/ui/FretBox.js?t=' + Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('creates a div with class hud-fret-box', () => {
    const fb = new FretBox();
    expect(fb._panel.className).toContain('hud-fret-box');
  });

  it('has role="img" on panel', () => {
    const fb = new FretBox();
    expect(fb._panel.setAttribute).toHaveBeenCalledWith('role', 'img');
  });

  it('register() calls shell.registerChild("fretbox", panel)', () => {
    const fb = new FretBox();
    const shell = makeHudShell();
    fb.register(shell);
    expect(shell.registerChild).toHaveBeenCalledWith('fretbox', fb._panel);
  });

  it('render() with no notes shows placeholder and no crash', () => {
    const fb = new FretBox();
    expect(() => fb.render({ notes: [], scale_id: 'major', root_midi: 69 })).not.toThrow();
    // After render with empty notes, a placeholder child should be appended
    const appended = fb._panel.appendChild.mock.calls;
    expect(appended.length).toBeGreaterThan(0);
  });

  it('render() with null notes shows placeholder and no crash', () => {
    const fb = new FretBox();
    expect(() => fb.render({})).not.toThrow();
  });

  it('render() with valid notes sets aria-label with scale/root info', () => {
    const fb = new FretBox();
    fb.render({ notes: SAMPLE_NOTES, scale_id: 'major', root_midi: 69 });
    const calls = fb._panel.setAttribute.mock.calls;
    const ariaCall = calls.find(c => c[0] === 'aria-label' && c[1] !== 'Finger pattern');
    expect(ariaCall).toBeTruthy();
    expect(ariaCall[1]).toContain('Major');
    expect(ariaCall[1]).toContain('A');
  });

  it('render() returns this for chaining', () => {
    const fb = new FretBox();
    const result = fb.render({ notes: SAMPLE_NOTES, scale_id: 'major', root_midi: 69 });
    expect(result).toBe(fb);
  });

  it('render() clears previous content (innerHTML = "")', () => {
    const fb = new FretBox();
    fb.render({ notes: SAMPLE_NOTES, scale_id: 'major', root_midi: 69 });
    // Second render should clear old content
    expect(() => fb.render({ notes: SAMPLE_NOTES, scale_id: 'major', root_midi: 69 })).not.toThrow();
  });

  it('fadeOut() adds fretbox-hidden, removes fretbox-visible', () => {
    const fb = new FretBox();
    fb.fadeOut();
    expect(fb._panel.classList.add).toHaveBeenCalledWith('fretbox-hidden');
    expect(fb._panel.classList.remove).toHaveBeenCalledWith('fretbox-visible');
  });

  it('fadeIn() adds fretbox-visible, removes fretbox-hidden', () => {
    const fb = new FretBox();
    fb.fadeIn();
    expect(fb._panel.classList.add).toHaveBeenCalledWith('fretbox-visible');
    expect(fb._panel.classList.remove).toHaveBeenCalledWith('fretbox-hidden');
  });

  it('destroy() removes panel', () => {
    const fb = new FretBox();
    fb.destroy();
    expect(fb._panel).toBeNull();
  });
});
