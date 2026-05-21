import { PHASES } from './GameState.js';
import { CartSystem } from './CartSystem.js';

export class GameLoop {
  constructor({ gameState, audioDetector, cartSystem, difficultyManager, sceneManager }) {
    this._gameState = gameState;
    this._audioDetector = audioDetector;
    this._cartSystem = cartSystem;
    this._dm = difficultyManager;
    this._sceneManager = sceneManager;
    this._running = false;
    this._lastTime = 0;
    this._tutorialDone = false;
    this.tutorialActive = false;
    this.baseSpeed = 0;
    this.firstWaveSpeed = 0;
    this.onVariantAccepted = null;
  }

  start() {
    this._gameState.runtime.phase = PHASES.PLAYING;
    this.baseSpeed = this._gameState.runtime.speed;
    this.firstWaveSpeed = this.baseSpeed * 0.5;
    this._tutorialDone = false;
    this.tutorialActive = true;
    this._gameState.runtime.tutorialActive = true;
    this._running = true;
    this._lastTime = 0;
    CartSystem.init(this._gameState);
  }

  resume() {
    this._gameState.runtime.phase = PHASES.PLAYING;
  }

  stop() {
    this._running = false;
  }

  async runOneTick(timestamp) {
    const deltaTime = this._lastTime
      ? Math.min(0.05, (timestamp - this._lastTime) / 1000)
      : 0.016;
    this._lastTime = timestamp;

    const phase = this._gameState.runtime.phase;

    if (phase === PHASES.GAME_OVER) {
      this._sceneManager.render(this._gameState);
      return;
    }

    if (phase === PHASES.PLAYING) {
      try {
        const result = await this._audioDetector.detect();
        this._gameState.runtime.currentNote = result;

        // Variant offer acceptance check
        const variantOffer = this._gameState.runtime.variantOffer;
        if (variantOffer?.active && result.midi === variantOffer.rootMidi) {
          if (this.onVariantAccepted) {
            this.onVariantAccepted({ rootMidi: result.midi });
          }
        }

        // noteDetected: check before CartSystem processes (stub-safe pre-check)
        const noteDetected = this._gameState.scene.carts.some(
          c => !c.cleared && c.safeZoneActive && c.notemidi === result.midi,
        );

        // CartSystem: use injected instance if it has update(), else fall back to static
        const cs = (typeof this._cartSystem?.update === 'function')
          ? this._cartSystem
          : CartSystem;
        cs.update(deltaTime, this._gameState);

        // Tutorial lifecycle: clear on first correct note
        if (!this._tutorialDone && noteDetected) {
          this._tutorialDone = true;
          this.tutorialActive = false;
          this._gameState.runtime.tutorialActive = false;
        }

        this._dm.tick(noteDetected, this._gameState);
      } catch (err) {
        if (err.constructor?.name === 'AudioDetectorError') {
          this._gameState.runtime.phase = PHASES.PAUSED;
        }
      }
    }

    this._sceneManager.render(this._gameState);
  }

  async acceptVariant({ rootMidi }) {
    const scale = this._gameState.session.scale || 'major';
    const instrument = this._gameState.session.instrument || 'guitar-standard';
    try {
      const url = `/api/plugins/subway-scaler/game/session-config?scale_id=${scale}&root_midi=${rootMidi}&instrument_id=${instrument}`;
      const resp = await fetch(url);
      if (resp.ok) {
        await resp.json();
        this._gameState.session.rootMidi = rootMidi;
        this._gameState.runtime.speed = this._dm.baseSpeed ?? this._gameState.runtime.speed;
      }
    } catch (_) {}
  }
}
