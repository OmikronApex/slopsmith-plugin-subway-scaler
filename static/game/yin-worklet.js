// AudioWorklet processor that runs YIN every 1024-sample hop.
// Loaded at runtime via audioContext.audioWorklet.addModule().

import { YinDetector } from './yin.js';

class YinProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.windowSize = opts.windowSize || 2048;
    this.hopSize = opts.hopSize || 1024;
    this.detector = new YinDetector({
      sampleRate: sampleRate,
      windowSize: this.windowSize,
      threshold: opts.threshold || 0.1,
    });
    this.ring = new Float32Array(this.windowSize);
    this.frame = new Float32Array(this.windowSize);
    this.writePos = 0;
    this.samplesSinceHop = 0;
    this.filled = false;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      this.ring[this.writePos] = ch[i];
      this.writePos = (this.writePos + 1) % this.windowSize;
      if (this.writePos === 0) this.filled = true;
      this.samplesSinceHop++;
      if (this.filled && this.samplesSinceHop >= this.hopSize) {
        this.samplesSinceHop = 0;
        // Copy ring buffer in correct order into a contiguous frame (preallocated)
        const split = this.writePos;
        this.frame.set(this.ring.subarray(split));
        this.frame.set(this.ring.subarray(0, split), this.windowSize - split);
        const result = this.detector.process(this.frame);
        this.port.postMessage({
          frequencyHz: result.frequencyHz,
          confidence: result.confidence,
          timestampMs: currentTime * 1000,
        });
      }
    }
    return true;
  }
}

registerProcessor('yin-processor', YinProcessor);
