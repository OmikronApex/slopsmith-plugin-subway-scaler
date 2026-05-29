const PAUSE_ICON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--color-accent, #FFB800)" aria-hidden="true">
  <rect x="6" y="4" width="4" height="16" rx="1"/>
  <rect x="14" y="4" width="4" height="16" rx="1"/>
</svg>`;

export class PauseButton {
  constructor(hudShell, onPause) {
    this._onPause = onPause;

    this._el = document.createElement('button');
    this._el.className = 'hud-pause-btn';
    this._el.setAttribute('type', 'button');
    this._el.setAttribute('aria-label', 'Pause game');
    this._el.innerHTML = PAUSE_ICON_SVG;

    this._clickHandler = () => {
      if (this._onPause) this._onPause();
    };
    this._el.addEventListener('click', this._clickHandler);

    hudShell.registerChild('pause', this._el);
  }

  destroy() {
    this._el?.removeEventListener('click', this._clickHandler);
    this._el?.remove();
    this._el = null;
  }
}
