import { DIFFICULTY_MULTIPLIERS } from '../GameState.js';

export class ScoreDisplay {
  constructor(hudShell) {
    this._score = 0;
    this._pulseTimer = null;

    this._el = document.createElement('span');
    this._el.className = 'hud-score';
    this._el.setAttribute('aria-live', 'polite');
    this._el.setAttribute('aria-atomic', 'true');
    this._el.textContent = '0';

    this._multEl = document.createElement('span');
    this._multEl.className = 'score-multiplier';
    this._multEl.style.color = 'var(--color-accent)';
    this._multEl.textContent = 'x1.0';

    const wrapper = document.createElement('span');
    wrapper.className = 'hud-score-wrapper';
    wrapper.appendChild(this._el);
    wrapper.appendChild(this._multEl);

    hudShell.registerChild('score', wrapper);
  }

  setDifficulty(difficulty) {
    const mult = DIFFICULTY_MULTIPLIERS[difficulty] ?? 1.0;
    this._multEl.textContent = `x${mult.toFixed(1)}`;
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
    this._multEl?.remove();
    this._el = null;
    this._multEl = null;
  }
}
