export class ScoreDisplay {
  constructor() {
    const el = document.createElement('div');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', 'status');
    el.classList.add('score-display');
    el.style.position = 'absolute';
    el.style.top = '16px';
    el.style.right = '16px';
    el.textContent = '0';
    this.element = el;
    this._lastScore = undefined;
  }

  update(gameState) {
    const score = gameState.runtime.score;
    this.element.textContent = String(score);
    if (score !== this._lastScore && this._lastScore !== undefined) {
      this.element.classList.add('score-display--pulse');
      setTimeout(() => this.element.classList.remove('score-display--pulse'), 150);
    }
    this._lastScore = score;
  }
}
