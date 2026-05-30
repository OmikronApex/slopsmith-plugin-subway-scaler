// Overlay system: base class + PauseOverlay / GameOverOverlay subclasses.
// OverlayManager coordinates lifecycle and exposes the public API used by main.js.

const LAST_SCORE_KEY = 'subway-scaler-last-score';

function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function _safeAppend(parent, child) {
  if (parent && child && parent.appendChild) parent.appendChild(child);
}

function _saveScore(score) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LAST_SCORE_KEY, String(score)); } catch (_) {}
}

// ─── Base class ───────────────────────────────────────────────────────────────

class Overlay {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this._previousFocus = null;
    this.focusTrapActive = false;
    this._cleanupTimer = null;
    this._hideInProgress = false;
    this._animationEndListener = null;

    this.headingElement = null;
    this.resumeButton = null;
    this.quitLink = null;
    this.scoreElement = null;
    this.contextElement = null;
    this.restartButton = null;
    this.mainMenuButton = null;

    this.onResumeClick = null;
    this.onRestartClick = null;
    this.onMainMenuClick = null;
    // Exposed for OverlayManager delegation and unit tests
    this.onKeyDown = (e) => this._handleKeyDown(e);
  }

  show(options = {}) {
    const el = this.containerElement;

    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      this._previousFocus = (active && active.isConnected) ? active : null;
    } else {
      this._previousFocus = null;
    }

    // Cancel any in-flight hide (stale timer + animationend listener)
    this._hideInProgress = false;
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    if (this._animationEndListener) {
      el.removeEventListener('animationend', this._animationEndListener);
      this._animationEndListener = null;
    }

    el.innerHTML = '';
    this.headingElement = null;
    this.resumeButton = null;
    this.quitLink = null;
    this.scoreElement = null;
    this.contextElement = null;
    this.restartButton = null;
    this.mainMenuButton = null;

    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.classList.remove('hidden', 'overlay--exiting', 'overlay--entering',
      'overlay--fade-enter', 'overlay--fade-exit', 'overlay--pause', 'overlay--game-over');

    // Subclass builds content and adds its type class
    this._build(options);

    if (this.headingElement) {
      this.headingElement.id = 'overlay-heading';
      el.setAttribute('aria-labelledby', 'overlay-heading');
    }

    // CSS @media (prefers-reduced-motion: reduce) swaps to fade — no JS branch needed
    el.classList.add('overlay--entering');
    this.focusTrapActive = true;

    const firstBtn = this.resumeButton || this.restartButton;
    if (firstBtn && firstBtn.focus) {
      setTimeout(() => firstBtn.focus(), 0);
    }
  }

  /** Subclasses override: add type class and build DOM content. */
  _build(_options) {}

  /** Subclasses override: handle Escape key per overlay semantics. */
  _onEscape(_e) {}

  hide() {
    this.focusTrapActive = false;
    const el = this.containerElement;
    el.classList.remove('overlay--entering');
    el.classList.add('overlay--exiting');

    if (this._previousFocus && this._previousFocus.focus) {
      if (this._previousFocus.isConnected !== false) {
        this._previousFocus.focus();
      } else if (typeof document !== 'undefined' && document.body && document.body.focus) {
        document.body.focus();
      }
    }

    // Cancel any previous hide in progress before starting a new one
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    if (this._animationEndListener) {
      el.removeEventListener('animationend', this._animationEndListener);
      this._animationEndListener = null;
    }

    this._hideInProgress = true;
    const done = () => {
      if (!this._hideInProgress) return;
      this._hideInProgress = false;
      this._cleanupTimer = null;
      this._animationEndListener = null;
      el.classList.add('hidden');
      el.classList.remove('overlay--exiting');
    };

    this._animationEndListener = done;
    el.addEventListener('animationend', done, { once: true });
    this._cleanupTimer = setTimeout(done, 350);
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape') {
      this._onEscape(e);
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [
        this.resumeButton,
        this.restartButton,
        this.quitLink,
        this.mainMenuButton,
      ].filter(Boolean);
      if (focusables.length === 0) return;
      e.preventDefault();
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      const idx = focusables.indexOf(active);
      const next = e.shiftKey
        ? (idx <= 0 ? focusables.length - 1 : idx - 1)
        : (idx + 1) % focusables.length;
      if (focusables[next] && focusables[next].focus) focusables[next].focus();
    }
  }

  get isVisible() {
    return !this.containerElement.classList.contains('hidden');
  }
}

// ─── PauseOverlay ─────────────────────────────────────────────────────────────

class PauseOverlay extends Overlay {
  constructor(containerElement, { onResume, onMainMenu } = {}) {
    super(containerElement);
    this._onResume = onResume;
    this._onMainMenu = onMainMenu;
  }

  _build({ reason = 'normal' } = {}) {
    const el = this.containerElement;
    el.classList.add('overlay--pause');

    const heading = _el('h2', 'overlay-heading');
    heading.textContent = reason === 'audio-error'
      ? 'Audio disconnected — reconnect to resume'
      : 'PAUSED';
    this.headingElement = heading;
    _safeAppend(el, heading);

    const buttons = _el('div', 'overlay-buttons');

    const resumeBtn = _el('button', 'overlay-btn-primary');
    resumeBtn.textContent = 'RESUME';
    resumeBtn.type = 'button';
    this.resumeButton = resumeBtn;
    this.onResumeClick = () => {
      if (this._onResume) this._onResume();
      this.hide();
    };
    resumeBtn.addEventListener('click', this.onResumeClick);
    _safeAppend(buttons, resumeBtn);

    const quitBtn = _el('button', 'overlay-btn-secondary');
    quitBtn.textContent = 'MAIN MENU';
    quitBtn.type = 'button';
    this.quitLink = quitBtn;
    quitBtn.addEventListener('click', () => {
      if (this._onMainMenu) this._onMainMenu();
      this.hide();
    });
    _safeAppend(buttons, quitBtn);
    _safeAppend(el, buttons);

  }

  _onEscape(e) {
    e.preventDefault();
    this.onResumeClick?.();
  }
}

// ─── GameOverOverlay ──────────────────────────────────────────────────────────

class GameOverOverlay extends Overlay {
  constructor(containerElement, { onRestart, onMainMenu } = {}) {
    super(containerElement);
    this._onRestart = onRestart;
    this._onMainMenu = onMainMenu;
  }

  _build({ score = 0 } = {}) {
    const el = this.containerElement;
    el.classList.add('overlay--game-over');

    const heading = _el('h2', 'overlay-heading');
    heading.textContent = 'GAME OVER';
    this.headingElement = heading;
    _safeAppend(el, heading);

    const scoreEl = _el('p', 'overlay-score');
    scoreEl.textContent = String(score);
    this.scoreElement = scoreEl;
    _safeAppend(el, scoreEl);

    const contextEl = _el('p', 'overlay-score-context');
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SCORE_KEY) : null;
    const lastScore = stored !== null ? parseInt(stored, 10) : null;
    if (lastScore === null || isNaN(lastScore)) {
      contextEl.textContent = 'Personal Best!';
    } else {
      const delta = score - lastScore;
      if (delta > 0)      contextEl.textContent = `+${delta} from last`;
      else if (delta < 0) contextEl.textContent = `${delta} from last`;
      else                contextEl.textContent = 'Tied with last';
    }
    this.contextElement = contextEl;
    _safeAppend(el, contextEl);

    const buttons = _el('div', 'overlay-buttons');

    const restartBtn = _el('button', 'overlay-btn-primary');
    restartBtn.textContent = 'RESTART';
    restartBtn.type = 'button';
    this.restartButton = restartBtn;
    this.onRestartClick = () => {
      _saveScore(score);
      if (this._onRestart) this._onRestart();
      this.hide();
    };
    restartBtn.addEventListener('click', this.onRestartClick);
    _safeAppend(buttons, restartBtn);

    const menuBtn = _el('button', 'overlay-btn-secondary');
    menuBtn.textContent = 'MAIN MENU';
    menuBtn.type = 'button';
    this.mainMenuButton = menuBtn;
    this.onMainMenuClick = () => {
      _saveScore(score); // persist score on menu exit too
      if (this._onMainMenu) this._onMainMenu();
      this.hide();
    };
    menuBtn.addEventListener('click', this.onMainMenuClick);
    _safeAppend(buttons, menuBtn);
    _safeAppend(el, buttons);
  }

  // Escape suppressed on game-over: explicit button action required to exit
  _onEscape(e) { e.preventDefault(); }
}

// ─── OverlayManager ───────────────────────────────────────────────────────────

export class OverlayManager {
  constructor({ onResume, onRestart, onMainMenu } = {}) {
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'overlay overlay--dialog hidden';

    this._pause = new PauseOverlay(this.containerElement, { onResume, onMainMenu });
    this._gameOver = new GameOverOverlay(this.containerElement, { onRestart, onMainMenu });
    this._active = null;

    // Single keydown listener delegates to whichever overlay is active
    this.onKeyDown = (e) => this._active?._handleKeyDown(e);
    this.containerElement.addEventListener('keydown', this.onKeyDown);

    // Element refs — synced after each show()
    this.headingElement = null;
    this.resumeButton = null;
    this.quitLink = null;
    this.scoreElement = null;
    this.contextElement = null;
    this.restartButton = null;
    this.mainMenuButton = null;
    this.onResumeClick = null;
    this.onRestartClick = null;
    this.onMainMenuClick = null;
  }

  mount(parent) {
    _safeAppend(parent, this.containerElement);
  }

  show({ type, reason = 'normal', score = 0 }) {
    this._active = type === 'pause' ? this._pause : this._gameOver;
    this._active.show(type === 'pause' ? { reason } : { score });
    this._syncRefs();
  }

  hide() {
    this._active?.hide();
  }

  _syncRefs() {
    const a = this._active;
    this.headingElement   = a?.headingElement   ?? null;
    this.resumeButton     = a?.resumeButton     ?? null;
    this.quitLink         = a?.quitLink         ?? null;
    this.scoreElement     = a?.scoreElement     ?? null;
    this.contextElement   = a?.contextElement   ?? null;
    this.restartButton    = a?.restartButton    ?? null;
    this.mainMenuButton   = a?.mainMenuButton   ?? null;
    this.onResumeClick    = a?.onResumeClick    ?? null;
    this.onRestartClick   = a?.onRestartClick   ?? null;
    this.onMainMenuClick  = a?.onMainMenuClick  ?? null;
  }

  get focusTrapActive() {
    return this._active?.focusTrapActive ?? false;
  }

  get isVisible() {
    return !this.containerElement.classList.contains('hidden');
  }
}
