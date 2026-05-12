import { describe, it, expect } from 'vitest';
import { YinDetector } from '../../../static/game/yin.js';

const SR = 48000;
const N = 2048;

function sine(freq, samples, sampleRate = SR) {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

describe('YinDetector', () => {
  for (const f of [220, 440, 880]) {
    it(`detects ${f} Hz sine within 1 Hz`, () => {
      const yin = new YinDetector({ sampleRate: SR, windowSize: N, threshold: 0.1 });
      const res = yin.process(sine(f, N));
      expect(res.frequencyHz).not.toBeNull();
      expect(Math.abs(res.frequencyHz - f)).toBeLessThan(1.0);
      expect(res.confidence).toBeGreaterThanOrEqual(0.8);
    });
  }

  it('returns null on silence', () => {
    const yin = new YinDetector({ sampleRate: SR, windowSize: N, threshold: 0.1 });
    const res = yin.process(new Float32Array(N));
    expect(res.frequencyHz).toBeNull();
  });
});
