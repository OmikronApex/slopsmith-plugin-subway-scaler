// OverlayManager: unified overlay system for pause and game-over dialogs.
// Manages a single persistent container element mounted into the game shell.

const LAST_SCORE_KEY = 'subway-scaler-last-score';

function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function _safeAppend(parent, child) {
  if (parent && child && parent.appendChild) parent.appendChild(child);
}

export class OverlayManager {
  constructor({ onResume, onRestart, onMainMenu } = {}) {
    this._onResume = onResume;
    this._onMainMenu = onMainMenu;
    this._onRestart = onRestart;
    this._type = null;
    this._previousFocus = null;
    this.focusTrapActive = false;
    this._cleanupTimer = null;
    this._hideInProgress = false;

    // Persistent container — mounted once, hidden when not in use
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'overlay overlay--dialog hidden';

    // Child element references (populated on show())
    this.headingElement = null;
    this.resumeButton = null;
    this.quitLink = null;
    this.scoreElement = null;
    this.contextElement = null;
    this.restartButton = null;
    this.mainMenuButton = null;

    // Callable handlers exposed for unit testing
    this.onResumeClick = null;
    this.onRestartClick = null;
    this.onMainMenuClick = null;
    this.onKeyDown = (e) => this._handleKeyDown(e);

    this.containerElement.addEventListener('keydown', this.onKeyDown);
  }

  /** Append the container to a parent DOM element (call once during bootstrap). */
  mount(parent) {
    _safeAppend(parent, this.containerElement);
  }

  /** Show the overlay with the given type and options. */
  show({ type, reason = 'normal', score = 0 }) {
    this._type = type;
    this._score = score;

    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      this._previousFocus = (active && active.isConnected) ? active : null;
    } else {
      this._previousFocus = null;
    }

    const el = this.containerElement;

    // Cancel pending hide cleanup (stale animationend listener from hide())
    this._hideInProgress = false;
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
      this._cleanupTimer = null;
    }

    // Reset child refs and content
    el.innerHTML = '';
    this.headingElement = null;
    this.resumeButton = null;
    this.quitLink = null;
    this.scoreElement = null;
    this.contextElement = null;
    this.restartButton = null;
    this.mainMenuButton = null;

    // ARIA dialog attributes
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    // Remove hidden, reset animation classes and type classes
    el.classList.remove('hidden', 'overlay--exiting', 'overlay--entering', 'overlay--fade-enter', 'overlay--fade-exit', 'overlay--pause', 'overlay--game-over');

    el.classList.add(type === 'pause' ? 'overlay--pause' : 'overlay--game-over');

    // Always add overlay--entering; CSS @media (prefers-reduced-motion: reduce)
    // swaps the animation to a simple fade. No JS branching needed.
    el.classList.add('overlay--entering');

    if (type === 'pause') {
      this._buildPause(reason);
    } else if (type === 'game-over') {
      this._buildGameOver(score);
    }

    // aria-labelledby points to the heading
    if (this.headingElement) {
      this.headingElement.id = 'overlay-heading';
      el.setAttribute('aria-labelledby', 'overlay-heading');
    }

    this.focusTrapActive = true;

    // Move focus to first button after paint
    const firstBtn = this.resumeButton || this.restartButton;
    if (firstBtn && firstBtn.focus) {
      setTimeout(() => firstBtn.focus(), 0);
    }
  }

  _buildPause(reason) {
    const el = this.containerElement;

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

    const quitBtn = _el('button', 'overlay-link');
    quitBtn.textContent = 'Quit to Menu';
    quitBtn.type = 'button';
    this.quitLink = quitBtn;
    quitBtn.addEventListener('click', () => {
      if (this._onMainMenu) this._onMainMenu();
      this.hide();
    });
    _safeAppend(buttons, quitBtn);

    _safeAppend(el, buttons);
  }

  _buildGameOver(score) {
    const el = this.containerElement;

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
    if (lastScore === null) {
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
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(LAST_SCORE_KEY, String(score));
        } catch (_) { /* storage full — silent skip */ }
      }
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
      if (this._onMainMenu) this._onMainMenu();
      this.hide();
    };
    menuBtn.addEventListener('click', this.onMainMenuClick);
    _safeAppend(buttons, menuBtn);

    _safeAppend(el, buttons);
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape' && this._type === 'pause') {
      e.preventDefault();
      this.onResumeClick?.();
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
      let next;
      if (e.shiftKey) {
        next = idx <= 0 ? focusables.length - 1 : idx - 1;
      } else {
        next = (idx + 1) % focusables.length;
      }
      if (focusables[next] && focusables[next].focus) {
        focusables[next].focus();
      }
    }
  }

  hide() {
    this.focusTrapActive = false;
    const el = this.containerElement;
    el.classList.remove('overlay--entering');
    el.classList.add('overlay--exiting');

    // Restore focus to element that was focused before overlay opened
    if (this._previousFocus && this._previousFocus.focus) {
      this._previousFocus.focus();
    }

    this._hideInProgress = true;
    const done = () => {
      if (!this._hideInProgress) return; // show() was called, abort cleanup
      if (this._cleanupTimer === null) return; // already cleaned up
      clearTimeout(this._cleanupTimer);
      this._cleanupTimer = null;
      el.classList.add('hidden');
      el.classList.remove('overlay--exiting');
    };

    el.addEventListener('animationend', done, { once: true });
    // Fallback: ensure hidden even if animation doesn't fire (e.g. tests, no CSS)
    this._cleanupTimer = setTimeout(done, 350);
  }

  /** Returns true if the overlay is currently visible. */
  get isVisible() {
    return !this.containerElement.classList.contains('hidden');
  }
}
