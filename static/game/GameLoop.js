import { PHASES } from './GameState.js';
import { CartSystem } from './CartSystem.js';

export class GameLoop {
  constructor({ gameState, audioDetector, cartSystem, difficultyManager, sceneManager, waveScheduler }) {
    this._gameState = gameState;
    this._audioDetector = audioDetector;
    this._cartSystem = cartSystem;
    this._dm = difficultyManager;
    this._sceneManager = sceneManager;
    this._waveScheduler = waveScheduler ?? null;
    this._running = false;
    this._lastTime = 0;
    this._gameStartTime = 0;
    this._pausedAt = null;
    this._tutorialDone = false;
    this.tutorialActive = false;
    this.baseSpeed = 0;
    this.firstWaveSpeed = 0;
    this.onVariantAccepted = null;
  }

  start(gameStartTime = 0) {
    this._gameState.runtime.phase = PHASES.PLAYING;
    this.baseSpeed = this._gameState.runtime.speed;
    this.firstWaveSpeed = this.baseSpeed * 0.5;
    this._tutorialDone = false;
    this.tutorialActive = true;
    this._gameState.runtime.tutorialActive = true;
    this._running = true;
    this._lastTime = 0;
    this._gameStartTime = gameStartTime;
    this._pausedAt = null;
    try {
      CartSystem.init(this._gameState);
    } catch (err) {
      console.error('CartSystem initialization failed:', err);
      this._gameState.runtime.phase = PHASES.PAUSED;
    }
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

    if (phase === PHASES.PAUSED) {
      if (this._pausedAt === null) this._pausedAt = timestamp;
      return;
    }

    if (phase === PHASES.PLAYING) {
      // JS-local pause tracking: detect resume
      if (this._pausedAt !== null) {
        this._gameStartTime += timestamp - this._pausedAt;
        this._pausedAt = null;
      }

      // Tick WaveScheduler each frame
      const game_now = timestamp - this._gameStartTime;
      const speedMultiplier = this._gameState.runtime.speedMultiplier ?? 1.0;
      let waves = [];
      if (this._waveScheduler) {
        this._waveScheduler.tick(game_now, speedMultiplier);
        waves = this._waveScheduler.waves;
      }

      try {
        const result = await this._audioDetector.detect();
        if (!result) return;
        this._gameState.runtime.currentNote = result;

        // Variant offer acceptance check
        const variantOffer = this._gameState.runtime.variantOffer;
        if (variantOffer?.active && result?.midi === variantOffer.rootMidi) {
          if (this.onVariantAccepted) {
            this.onVariantAccepted({ rootMidi: result.midi });
          }
        }

        // noteDetected: check before CartSystem processes (stub-safe pre-check)
        const noteDetected = waves.some(w => !w.cleared && w.safe_midi === result.midi) || false;

        // CartSystem: use injected instance if it has update(), else fall back to static
        const cs = (typeof this._cartSystem?.update === 'function')
          ? this._cartSystem
          : CartSystem;
        cs.update(game_now, this._gameState, waves);

        // Tutorial lifecycle: clear on first correct note
        if (!this._tutorialDone && noteDetected) {
          this._tutorialDone = true;
          this.tutorialActive = false;
          this._gameState.runtime.tutorialActive = false;
        }

        this._dm.tick(noteDetected, this._gameState);
      } catch (err) {
        if (err.constructor?.name === 'AudioDetectorError') {
          console.warn('Audio detection error:', err.message);
          this._gameState.runtime.phase = PHASES.PAUSED;
        } else {
          console.error('Unexpected error in game loop:', err);
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
      } else {
        console.warn('Variant acceptance failed:', resp.status);
      }
    } catch (err) {
      console.error('Error accepting variant:', err);
    }
  }
}
