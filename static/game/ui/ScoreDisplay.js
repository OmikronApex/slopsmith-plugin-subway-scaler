export class ScoreDisplay {
  constructor(hudShell) {
    this._score = 0;
    this._pulseTimer = null;

    this._el = document.createElement('span');
    this._el.className = 'hud-score';
    this._el.setAttribute('aria-live', 'polite');
    this._el.setAttribute('aria-atomic', 'true');
    this._el.textContent = '0';

    hudShell.registerChild('score', this._el);
  }

  update(score) {
    const prev = this._score;
    this._score = score;
    this._el.textContent = String(score);
    if (prev !== score) {
      this._el.classList.add('score-increment');
      if (this._pulseTimer) clearTimeout(this._pulseTimer);
      this._pulseTimer = setTimeout(() => {
        this._el.classList.remove('score-increment');
        this._pulseTimer = null;
      }, 150);
    }
  }

  destroy() {
    if (this._pulseTimer) {
      clearTimeout(this._pulseTimer);
      this._pulseTimer = null;
    }
    this._el?.remove();
    this._el = null;
  }
}
