// YIN pitch detector (de Cheveigné & Kawahara 2002).
// Pure JS, no allocations inside process() once constructed.

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// Iterative Cooley-Tukey in-place FFT on Float32Array pair (re, im).
// inverse=true divides by n after butterfly stages.
function _fftInPlace(re, im, inverse) {
  const n = re.length;
  if ((n & (n - 1)) !== 0) throw new Error('FFT size must be power of 2');
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 1 : -1) * 2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j],         uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j]        = uRe + vRe;  im[i + j]        = uIm + vIm;
        re[i + j + half] = uRe - vRe;  im[i + j + half] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

export class YinDetector {
  constructor({ sampleRate, windowSize = 4096, threshold = 0.1, fMin = 27, fMax = 2637 } = {}) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.threshold = threshold;
    this.halfSize = Math.floor(windowSize / 2);
    // Tau search bounds derived from playable frequency range.
    // fMax=2637 Hz covers E7, the highest note on standard-tuned guitar.
    // tauMin backs off by 1 so parabolic interpolation has a valid left neighbor at the boundary.
    if (fMin >= fMax) throw new Error(`fMin (${fMin}) must be less than fMax (${fMax})`);
    this.tauMin = Math.max(2, Math.ceil(sampleRate / fMax) - 1);
    this.tauMax = Math.min(this.halfSize - 1, Math.floor(sampleRate / fMin));
    // Pre-allocated buffers for difference and cumulative-mean-normalized-difference.
    this.diff = new Float32Array(this.halfSize);
    this.cmnd = new Float32Array(this.halfSize);
    // Pre-allocated FFT scratch buffers. fftSize = nextPow2(2 * windowSize) to avoid
    // circular autocorrelation (linear convolution requires zero-padding to 2N).
    this._fftSize = nextPow2(2 * windowSize);
    this._fftRe = new Float32Array(this._fftSize);
    this._fftIm = new Float32Array(this._fftSize);
    // Cumulative squared sum buffer for exact d[tau] formula.
    this._cumSq = new Float32Array(windowSize + 1);
  }

  // Step 1: difference function via FFT-based autocorrelation.
  // Exact formula: d(τ) = sq_left(τ) + sq_right(τ) - 2·ACF(τ)
  // where sq_left(τ) = Σ_{i=0}^{N-τ-1} x[i]²,  sq_right(τ) = Σ_{i=τ}^{N-1} x[i]²
  // ACF(τ) = IFFT(|FFT(zero-padded x)|²)[τ]  (zero-padding to 2N gives linear autocorrelation)
  // Upper-bounded at tauMax to skip inaudibly-low frequencies.
  _difference(buf) {
    const re = this._fftRe;
    const im = this._fftIm;
    const N = this._fftSize;
    const W = this.windowSize;
    const cumSq = this._cumSq;

    // 1. Compute prefix squared sums: cumSq[k] = Σ_{i=0}^{k-1} x[i]²
    cumSq[0] = 0;
    for (let i = 0; i < W; i++) cumSq[i + 1] = cumSq[i] + buf[i] * buf[i];
    const r0 = cumSq[W];

    // 2. Copy signal into re, zero-pad to N, zero im
    for (let i = 0; i < W; i++) re[i] = buf[i];
    for (let i = W; i < N; i++) re[i] = 0;
    im.fill(0);

    // 3. Forward FFT
    _fftInPlace(re, im, false);

    // 4. Power spectrum in-place: re[k] = re[k]² + im[k]², im[k] = 0
    for (let k = 0; k < N; k++) {
      re[k] = re[k] * re[k] + im[k] * im[k];
      im[k] = 0;
    }

    // 5. Inverse FFT — gives linear ACF(τ) = Σ_{i=0}^{W-τ-1} x[i]·x[i+τ]
    _fftInPlace(re, im, true);

    // 6. Build diff[τ] using exact formula for τ in [1, tauMax]
    //    d[τ] = cumSq[W-τ] + (r0 - cumSq[τ]) - 2·re[τ]
    const d = this.diff;
    const tauMax = this.tauMax;
    for (let tau = 0; tau < this.halfSize; tau++) d[tau] = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      d[tau] = cumSq[W - tau] + (r0 - cumSq[tau]) - 2 * re[tau];
    }
  }

  // Step 2: cumulative mean normalized difference — unbounded (full running sum required).
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

  // Step 3 + 4: absolute threshold + first dip — search starts at tauMin.
  _absoluteThreshold() {
    const c = this.cmnd;
    const tauMin = this.tauMin;
    const tauMax = this.tauMax;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (c[tau] < this.threshold) {
        // Find local minimum
        while (tau + 1 <= tauMax && c[tau + 1] < c[tau]) tau++;
        return tau;
      }
    }
    return -1;
  }

  // Step 5: parabolic interpolation
  _parabolicInterpolation(tau) {
    const c = this.cmnd;
    const H = this.halfSize;
    // Also guard tau >= tauMax: c[tauMax+1] is zero-filled by _difference, corrupting interpolation.
    if (tau <= 0 || tau + 1 >= H || tau >= this.tauMax) return tau;
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

    try {
      this._difference(buf);
    } catch {
      return { frequencyHz: null, confidence: 0 };
    }
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
