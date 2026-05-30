// Slopsmith SDK integration bridge.
// Handles minigame registration, lifecycle (start/stop), SDK audio detection,
// best-score tracking, and run submission.
//
// Stories: 10-1 (registration), 10-2 (lifecycle), 10-3 (audio), 10-5 (end/quit).

import { AudioDetector, YinDetector } from './AudioDetector.js';

// ===== SdkDetector — wraps sdk.scoring.createContinuous() =====
// Implements AudioDetector interface: async detect() → {midi, confidence, cents, tMs} | null

export class SdkDetector extends AudioDetector {
  constructor() {
    super();
    this._latest = null;
    this._handle = null;
  }

  attach(handle) {
    this._handle = handle;
    handle.on('pitch', ({ midiFloat, cents, confidence, tMs }) => {
      if (confidence < 0.3) {
        this._latest = null;
        return;
      }
      const midi = Math.round(midiFloat);
      if (midi < 21 || midi > 108) {
        this._latest = null;
        return;
      }
      this._latest = { midi, confidence, cents: cents ?? 0, tMs };
    });
  }

  async detect() {
    return this._latest;
  }

  stop() {
    if (this._handle) {
      try { this._handle.stop(); } catch (_) {}
      this._handle = null;
    }
    this._latest = null;
  }
}

// ===== Fake audio handle — adapts SdkDetector to main.js's push-callback API =====

function createSdkAudioHandle(sdkDetector) {
  let _onDetectionCb = () => {};
  let _onErrorCb = () => {};
  let _stopped = false;

  // Poll the SdkDetector at ~60Hz and push detections to main.js
  const _interval = setInterval(() => {
    if (_stopped) return;
    sdkDetector.detect().then(det => {
      if (det) {
        const { midi, confidence, cents, tMs } = det;
        _onDetectionCb({
          note: { midi, name: '' },
          frequencyHz: 440 * Math.pow(2, (midi - 69) / 12),
          confidence,
          centsOffset: cents,
          timestampMs: tMs,
        });
      }
    });
  }, 16);

  return {
    _isSdkHandle: true,
    onDetection(cb) { _onDetectionCb = cb; },
    onError(cb) { _onErrorCb = cb; },
    async pause() {},
    async resume() {},
    async switchInput() {},
    stop() {
      _stopped = true;
      clearInterval(_interval);
      sdkDetector.stop();
    },
  };
}

// ===== Module state =====

let _sdk = null;
let _modifiers = {};
let _sessionStartTime = 0;
let _bestScore = 0;
let _attempts = 0;
let _notesPlayed = 0;
let _sdkDetector = null;
let _sdkAudioHandle = null;

// ===== Audio detection (Story 10-3) =====

async function startPitchDetection(rootMidi) {
  if (!_sdk?.scoring?.createContinuous) return null;
  const expectedBaseFreqHz = 440 * Math.pow(2, (rootMidi - 69) / 12);
  try {
    const handle = await _sdk.scoring.createContinuous({ expectedBaseFreqHz, smoothingMs: 30 });
    _sdkDetector = new SdkDetector();
    _sdkDetector.attach(handle);
    _sdkAudioHandle = createSdkAudioHandle(_sdkDetector);
    window.__slopsmithSdkBridge = window.__slopsmithSdkBridge || {};
    window.__slopsmithSdkBridge.sdkAudioHandle = _sdkAudioHandle;
    return _sdkAudioHandle;
  } catch (e) {
    console.warn('[SdkBridge] createContinuous() failed, falling back to YinDetector:', e);
    return null;
  }
}

function stopPitchDetection() {
  if (_sdkAudioHandle) {
    try { _sdkAudioHandle.stop(); } catch (_) {}
    _sdkAudioHandle = null;
  }
  if (_sdkDetector) {
    try { _sdkDetector.stop(); } catch (_) {}
    _sdkDetector = null;
  }
  if (window.__slopsmithSdkBridge) {
    window.__slopsmithSdkBridge.sdkAudioHandle = null;
  }
}

// ===== SdkBridge public API =====

export const SdkBridge = {
  _ended: false,

  // ---- Story 10-3: inject bestScore on game-over (called by main.js) ----
  onGameOver(score) {
    _attempts++;
    _bestScore = Math.max(_bestScore, score);
    _notesPlayed += window.__gameState?.score?.current
      ? Math.floor(window.__gameState.score.current / 100)
      : 0;
  },

  // ---- Story 10-2: start lifecycle ----
  async start({ container, modifiers, sdk }) {
    _sdk = sdk;
    _modifiers = modifiers || {};
    SdkBridge._ended = false;  // reset for new session
    _bestScore = 0;
    _attempts = 0;
    _notesPlayed = 0;
    _sessionStartTime = performance.now();

    // Wire onGameOver so main.js can update bestScore via window.__slopsmithSdkBridge
    window.__slopsmithSdkBridge = window.__slopsmithSdkBridge || {};
    window.__slopsmithSdkBridge.onGameOver = (score) => SdkBridge.onGameOver(score);

    // Dynamically import bootstrap to avoid circular deps at registration time
    const { bootstrap } = await import('./main.js');
    await bootstrap(container);

    // Override SDK Quit button to submit best score instead of score: 0 (Story 10-5)
    const quitBtn = document.getElementById('mg-stage-quit');
    if (quitBtn) {
      quitBtn.onclick = () => {
        if (SdkBridge._ended) return;
        SdkBridge.end();
      };
    }
  },

  // ---- Story 10-5: stop lifecycle (reentry guard prevents double end()) ----
  async stop() {
    await SdkBridge.end();
    stopPitchDetection();
  },

  // ---- Story 10-5: submit best score to SDK ----
  async end() {
    if (SdkBridge._ended) return;
    SdkBridge._ended = true;

    if (window.slopsmithMinigames?.end) {
      // Capture live score in case player quits mid-run without hitting game-over first
      const liveScore = window.__gameState?.score?.current || 0;
      _bestScore = Math.max(_bestScore, liveScore);

      const durationMs = Math.round(performance.now() - _sessionStartTime);
      const difficulty = _modifiers?.difficulty || 'easy';
      const totalNotes = window.__gameState?.scene?.waveCount ?? 0;
      const accuracyPct = totalNotes > 0
        ? Math.round((_notesPlayed / totalNotes) * 100)
        : 0;
      const payload = {
        score: _bestScore,
        durationMs,
        modifiers: { difficulty },
        meta: {
          notes_played: _notesPlayed,
          accuracy_pct: accuracyPct,
          attempts: _attempts,
        },
      };
      await window.slopsmithMinigames.end(payload).catch(e => console.warn('[SdkBridge] end() error:', e));
    }

    _bestScore = 0;
    // _ended stays true until next start() — prevents double-submit if stop() follows end()
  },
};

// ===== Story 10-1: Registration =====

function _doRegister() {
  if (typeof window.slopsmithMinigames?.register !== 'function') return;
  window.slopsmithMinigames.register({
    id: 'subway-scaler',
    title: 'Subway Scaler',
    tagline: 'Dodge obstacles by playing the right notes on your instrument',
    thumbnail: '/plugins/subway-scaler/static/assets/mg_thumbnail.png',
    start: (opts) => SdkBridge.start(opts),
    stop: () => SdkBridge.stop(),
  });
  console.log('[SdkBridge] Registered with slopsmithMinigames');
}

export function registerWithSdk() {
  if (typeof window.slopsmithMinigames?.register === 'function') {
    _doRegister();
  } else {
    // SDK not yet loaded — queue for when it's ready
    window.__slopsmithMinigamesPending = window.__slopsmithMinigamesPending || [];
    window.__slopsmithMinigamesPending.push(_doRegister);
    window.addEventListener('slopsmith-minigames-ready', _doRegister, { once: true });
    console.log('[SdkBridge] SDK not yet available; queued registration');
  }
}
