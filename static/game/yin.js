// YIN pitch detector (de Cheveigné & Kawahara 2002).
// Pure JS, no allocations inside process() once constructed.

export class YinDetector {
  constructor({ sampleRate, windowSize = 2048, threshold = 0.1 } = {}) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.threshold = threshold;
    this.halfSize = Math.floor(windowSize / 2);
    // Pre-allocated buffers for difference and cumulative-mean-normalized-difference.
    this.diff = new Float32Array(this.halfSize);
    this.cmnd = new Float32Array(this.halfSize);
  }

  // Step 1: difference function
  _difference(buf) {
    const d = this.diff;
    const H = this.halfSize;
    for (let tau = 0; tau < H; tau++) d[tau] = 0;
    for (let tau = 1; tau < H; tau++) {
      let sum = 0;
      const limit = buf.length - tau;
      for (let i = 0; i < limit; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }
  }

  // Step 2: cumulative mean normalized difference
  _cmnd() {
    const d = this.diff;
    const c = this.cmnd;
    const H = this.halfSize;
    c[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < H; tau++) {
      runningSum += d[tau];
      c[tau] = d[tau] * tau / (runningSum || 1e-12);
    }
  }

  // Step 3 + 4: absolute threshold + first dip
  _absoluteThreshold() {
    const c = this.cmnd;
    const H = this.halfSize;
    for (let tau = 2; tau < H; tau++) {
      if (c[tau] < this.threshold) {
        // Find local minimum
        while (tau + 1 < H && c[tau + 1] < c[tau]) tau++;
        return tau;
      }
    }
    return -1;
  }

  // Step 5: parabolic interpolation
  _parabolicInterpolation(tau) {
    const c = this.cmnd;
    const H = this.halfSize;
    if (tau <= 0 || tau + 1 >= H) return tau;
    const s0 = c[tau - 1];
    const s1 = c[tau];
    const s2 = c[tau + 1];
    const denom = (2 * (2 * s1 - s2 - s0));
    if (denom === 0) return tau;
    return tau + (s2 - s0) / denom;
  }

  process(buf) {
    if (!buf || buf.length < this.windowSize) return { frequencyHz: null, confidence: 0 };
    // Quick silence check on RMS
    let rms = 0;
    for (let i = 0; i < this.windowSize; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / this.windowSize);
    if (rms < 1e-4) return { frequencyHz: null, confidence: 0 };

    this._difference(buf);
    this._cmnd();
    const tauInt = this._absoluteThreshold();
    if (tauInt < 0) return { frequencyHz: null, confidence: 0 };
    const tau = this._parabolicInterpolation(tauInt);
    if (tau <= 0) return { frequencyHz: null, confidence: 0 };
    const freq = this.sampleRate / tau;
    // confidence = 1 - aperiodicity (clamp)
    const aperiodicity = Math.max(0, Math.min(1, this.cmnd[tauInt]));
    const confidence = Math.max(0, Math.min(1, 1 - aperiodicity));
    return { frequencyHz: freq, confidence };
  }
}
