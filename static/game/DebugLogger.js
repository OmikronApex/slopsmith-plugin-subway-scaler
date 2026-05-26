// File-based debug logger. Writes structured JSONL to server /logs/.
// Activated by checkbox in setup screen. Each entry is flushed every 2s or on destroy.

const LOG_API = '/api/plugins/subway-scaler/game/logs';

export class DebugLogger {
  constructor(sessionId, enabled, gameStartTime) {
    this.sessionId = sessionId;
    this.enabled = enabled;
    this.gameStartTime = gameStartTime;
    this._buffer = [];
    this._flushTimer = null;
    if (enabled) {
      this._flushTimer = setInterval(() => this._flush(), 2000);
    }
  }

  log(event, data = {}) {
    if (!this.enabled) return;
    this._buffer.push({
      t: Date.now(),
      gt: this.gameStartTime != null ? Date.now() - this.gameStartTime : null,
      ev: event,
      d: data,
    });
    // Flush immediately on high-priority events so logs survive a crash
    if (event === 'collision' || event === 'game.over' || event === 'variant.promote') {
      this._flush();
    }
  }

  setGameStartTime(t) {
    this.gameStartTime = t;
  }

  _flush() {
    if (this._buffer.length === 0) return;
    const batch = this._buffer;
    this._buffer = [];
    fetch(LOG_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId, entries: batch }),
    }).catch(() => {});
  }

  destroy() {
    this._flush();
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
  }
}