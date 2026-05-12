// Audio capture + YIN worklet pipeline. Exposes start/stop/pause/resume + onDetection.
import { quantize } from './notes.js';

const WORKLET_URL = '/plugins/subway_scaler/static/game/yin-worklet.js';

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
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.audioWorklet.addModule(WORKLET_URL);
  const node = new AudioWorkletNode(audioCtx, 'yin-processor', {
    processorOptions: { windowSize: 2048, hopSize: 1024, threshold: 0.1 },
  });

  let { stream, source } = await buildSource(audioCtx, deviceId);
  source.connect(node);
  // Worklet is a sink for analysis; do not connect to destination (avoid feedback).

  let listener = () => {};
  node.port.onmessage = (ev) => {
    const { frequencyHz, confidence, timestampMs } = ev.data;
    let note = null;
    let centsOffset = 0;
    if (frequencyHz != null) {
      const q = quantize(frequencyHz);
      if (q) { note = q; centsOffset = q.centsOffset; }
    }
    listener({ frequencyHz, confidence, note, centsOffset, timestampMs });
  };

  return {
    audioContext: audioCtx,
    onDetection(cb) { listener = cb; },
    async pause() { try { await audioCtx.suspend(); } catch (_) {} },
    async resume() { try { await audioCtx.resume(); } catch (_) {} },
    async switchInput(newDeviceId) {
      try { source.disconnect(); } catch (_) {}
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      const next = await buildSource(audioCtx, newDeviceId);
      stream = next.stream;
      source = next.source;
      source.connect(node);
    },
    stop() {
      try { source.disconnect(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { audioCtx.close(); } catch (_) {}
    },
  };
}
