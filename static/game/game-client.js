/**
 * GameClient handles communication with the FastAPI backend.
 * Synchronizes local game state with server-side GameSession.
 */
export class GameClient {
  constructor(baseUrl = '/api/plugins/subway-scaler') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
    this.pollingInterval = null;
  }

  async start(scaleId, difficulty = 'easy', options = {}) {
    const response = await fetch(`${this.baseUrl}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        scale_id: scaleId, 
        difficulty,
        root_midi: options.rootMidi,
        octaves: options.octaves,
        descending: options.descending,
        instrument_id: options.instrumentId
      })
    });
    
    if (!response.ok) throw new Error('Failed to start game');
    
    const data = await response.json();
    this.sessionId = data.session_id;
    return data;
  }

  async playNote(midi, timingMs) {
    if (!this.sessionId) return null;
    
    const response = await fetch(`${this.baseUrl}/game/${this.sessionId}/play-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ midi, timing_ms: timingMs })
    });
    
    if (!response.ok) throw new Error('Failed to submit note');
    return await response.json();
  }

  async getState() {
    if (!this.sessionId) return null;
    
    const response = await fetch(`${this.baseUrl}/game/${this.sessionId}`);
    if (!response.ok) throw new Error('Failed to get game state');
    return await response.json();
  }

  async pause() {
    if (!this.sessionId) return;
    await fetch(`${this.baseUrl}/game/${this.sessionId}/pause`, { method: 'POST' });
  }

  async resume() {
    if (!this.sessionId) return;
    await fetch(`${this.baseUrl}/game/${this.sessionId}/resume`, { method: 'POST' });
  }

  startPolling(callback, intervalMs = 200) {
    this.stopPolling();
    this.pollingInterval = setInterval(async () => {
      try {
        const state = await this.getState();
        if (state) callback(state);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async proposeVariant() {
    if (!this.sessionId) return null;
    const r = await fetch(`${this.baseUrl}/game/${this.sessionId}/variant/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return await r.json();
  }

  async acceptVariant(midi) {
    if (!this.sessionId) return null;
    const r = await fetch(`${this.baseUrl}/game/${this.sessionId}/variant/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ midi }),
    });
    return await r.json();
  }

  async timeoutVariant() {
    if (!this.sessionId) return null;
    const r = await fetch(`${this.baseUrl}/game/${this.sessionId}/variant/timeout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return await r.json();
  }
}
