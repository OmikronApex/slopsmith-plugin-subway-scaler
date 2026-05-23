// Audio capture + YIN worklet pipeline. Exposes start/stop/pause/resume + onDetection.
// Story 3.3: class hierarchy (AudioDetector → YinDetector) wraps existing functional API.
import { quantize } from './notes.js';

// ===== Error class =====

export class AudioDetectorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AudioDetectorError';
  }
}

// ===== Base class — no GameState coupling =====

export class AudioDetector {
  async detect() {
    throw new Error('Not implemented');
  }
}

// ===== YIN adapter =====

export class YinDetector extends AudioDetector {
  constructor() {
    super();
    this._audioHandle = null;
    this._lastDetection = null;
    this._detectionReady = false;
  }

  async init(deviceId = null) {
    try {
      this._audioHandle = await startAudio({ deviceId });
      this._detectionReady = true;
      this._audioHandle.onDetection((detection) => {
        this._lastDetection = detection;
      });
    } catch (err) {
      throw new AudioDetectorError(err.message ?? String(err));
    }
  }

  async detect() {
    try {
      if (!this._detectionReady || !this._audioHandle) {
        throw new Error('Audio detection not started — call init() first');
      }
      return await this._runDetection();
    } catch (err) {
      throw new AudioDetectorError(err.message ?? String(err));
    }
  }

  async _runDetection() {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Detection timeout — no audio detected'));
        }
      }, 500);

      const checkDetection = () => {
        if (this._lastDetection?.note) {
          resolved = true;
          clearTimeout(timeout);
          const { note, confidence } = this._lastDetection;
          resolve({ midi: note.midi, confidence });
        } else {
          setTimeout(checkDetection, 50);
        }
      };

      checkDetection();
    });
  }

  stop() {
    if (this._audioHandle?.stop) {
      this._audioHandle.stop();
    }
    this._audioHandle = null;
    this._detectionReady = false;
  }

  pause() {
    if (this._audioHandle?.pause) {
      return this._audioHandle.pause();
    }
  }

  resume() {
    if (this._audioHandle?.resume) {
      return this._audioHandle.resume();
    }
  }

  switchInput(deviceId) {
    if (this._audioHandle?.switchInput) {
      return this._audioHandle.switchInput(deviceId);
    }
  }
}

const WORKLET_URL = '/plugins/subway-scaler/static/game/yin-worklet.js';

export async function enumerateInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const devs = await navigator.mediaDevices.enumerateDevices();
  return devs
    .filter(d => d.kind === 'audioinput')
    .map(d => ({ deviceId: d.deviceId, label: d.label }));
}

async function buildSource(audioCtx, deviceId) {
  const constraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
  if (deviceId) constraints.audio.deviceId = { exact: deviceId };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const source = audioCtx.createMediaStreamSource(stream);
  return { stream, source };
}

export async function startAudio({ deviceId = null } = {}) {
  window.__audioState = {
    micActive: false,
    pipelineReady: false,
    lastDetectedNote: null,
    detectionConfidence: 0,
    streamType: null,
  };

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.audioWorklet.addModule(WORKLET_URL);
  const node = new AudioWorkletNode(audioCtx, 'yin-processor', {
    processorOptions: { windowSize: 2048, hopSize: 1024, threshold: 0.1 },
  });

  let { stream, source } = await buildSource(audioCtx, deviceId);

  const trackLabel = stream.getAudioTracks()[0]?.label ?? '';
  window.__audioState.streamType = trackLabel.toLowerCase().includes('fake') ? 'fake' : 'real';
  window.__audioState.micActive = true;
  window.__audioState.pipelineReady = true;
  source.connect(node);
  // Worklet is a sink for analysis; do not connect to destination (avoid feedback).

  let listener = () => {};
  let errorListener = null;

  stream.getTracks().forEach(track => {
    track.addEventListener('ended', () => {
      if (errorListener) errorListener('Audio track ended unexpectedly');
    });
  });
  audioCtx.addEventListener('statechange', () => {
    if ((audioCtx.state === 'interrupted' || audioCtx.state === 'closed') && errorListener) {
      errorListener(`AudioContext ${audioCtx.state}`);
    }
  });

  node.port.onmessage = (ev) => {
    const { frequencyHz, confidence, timestampMs } = ev.data;
    let note = null;
    let centsOffset = 0;
    if (frequencyHz != null) {
      const q = quantize(frequencyHz);
      if (q) { note = q; centsOffset = q.centsOffset; }
    }
    if (window.__audioState) {
      window.__audioState.lastDetectedNote = note?.name ?? null;
      window.__audioState.detectionConfidence = confidence ?? 0;
    }
    if (window.__gameState) {
      window.__gameState.lastDetectedNote = note?.name ?? null;
    }
    listener({ frequencyHz, confidence, note, centsOffset, timestampMs });
  };

  return {
    audioContext: audioCtx,
    onDetection(cb) { listener = cb; },
    onError(cb) { errorListener = cb; },
    async pause() { try { await audioCtx.suspend(); } catch (_) {} },
    async resume() { try { await audioCtx.resume(); } catch (_) {} },
    async switchInput(newDeviceId) {
      try { source.disconnect(); } catch (_) {}
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      const next = await buildSource(audioCtx, newDeviceId);
      stream = next.stream;
      source = next.source;
      source.connect(node);
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (errorListener) errorListener('Audio track ended unexpectedly');
        });
      });
    },
    stop() {
      try { source.disconnect(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { audioCtx.close(); } catch (_) {}
    },
  };
}
