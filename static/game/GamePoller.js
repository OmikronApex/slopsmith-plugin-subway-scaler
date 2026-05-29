// Backend poll handler (Story 9-6 extraction from main.js).
// Owns the integration boundary between backend poll state and frontend game state.

import { currentTransitionPhase } from './TransitionPhases.js';

export class GamePoller {
  constructor({ gameClient, scoreDisplay, variantController, scene, onGameOver }) {
    this.gameClient = gameClient;
    this.scoreDisplay = scoreDisplay;
    this.variantController = variantController;
    this.scene = scene;
    this.onGameOver = onGameOver;
    this._speedMultiplier = 1.0;

    // External refs set by main.js:
    this.feedbackEl = null;
    this.run = null;
    this.pushGameEvent = null;
    this.debugLogger = null;
    this._nowFn = null;
    this.gameStartTime = 0;
  }

  /** Start polling the backend for state updates. */
  start(intervalMs = 200) {
    this.gameClient.startPolling((pollState) => {
      if (!pollState) return;
      if (this.run && this.run.state === 'paused') return;

      // Score update
      if (pollState.score !== undefined) {
        if (this.feedbackEl) this.feedbackEl.textContent = `Score: ${pollState.score}`;
        if (window.__gameState) window.__gameState.score.current = pollState.score;
        this.scoreDisplay.update(pollState.score);
      }

      // Speed multiplier from backend (Story 9-7)
      if (pollState.speed_multiplier !== undefined) {
        this._speedMultiplier = pollState.speed_multiplier;
      }

      // Game-over detection from poll
      if (pollState.status === 'failed') {
        if (this.run) this.run.state = 'failed';
        return; // Let the render loop handle game-over UI
      }

      // Variant lifecycle -- delegated to variantController
      if (this.variantController) {
        const nowFn = this._nowFn || (() => performance.now());
        this.variantController.onPollUpdate(pollState, currentTransitionPhase(), nowFn, this.gameStartTime);
      }
    }, intervalMs);
  }

  /** Stop polling. */
  stop() {
    this.gameClient.stopPolling();
  }

  /** Current speed multiplier from backend. Returns 1.0 until Story 9-7 wires the real value. */
  get speedMultiplier() {
    return this._speedMultiplier;
  }

  /** Reset multiplier for new session. */
  reset() {
    this._speedMultiplier = 1.0;
  }
}