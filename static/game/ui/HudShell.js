import { PHASES } from '../GameState.js';

export class HudShell {
  constructor(gameShellElement) {
    this._shell = gameShellElement;
    this._container = document.createElement('div');
    this._container.className = 'hud-shell';
    this._container.setAttribute('role', 'group');
    this._container.setAttribute('aria-label', 'Game HUD');
    Object.assign(this._container.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '100',
      background: 'none',
      display: 'none',
    });
    this._shell.appendChild(this._container);

    this._resizeObserver = new ResizeObserver(() => {
      this._container.dispatchEvent(new CustomEvent('hud-resize'));
    });
    this._resizeObserver.observe(this._shell);

    this._children = new Map();
  }

  registerChild(name, element) {
    element.style.pointerEvents = 'auto';
    element.style.position = 'absolute';
    if (element.tagName !== 'BUTTON' && element.tagName !== 'A') {
      element.setAttribute('tabindex', '-1');
    }
    this._container.appendChild(element);
    this._children.set(name, element);
  }

  show() {
    if (this._container) this._container.style.display = '';
  }

  hide() {
    if (this._container) this._container.style.display = 'none';
  }

  onPhaseChange(phase) {
    if (phase === PHASES.PLAYING || phase === PHASES.PAUSED) {
      this.show();
    } else {
      this.hide();
    }
  }

  destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._container?.remove();
    this._container = null;
    this._shell = null;
    this._children?.clear();
  }
}
