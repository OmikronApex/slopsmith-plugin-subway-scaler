import { describe, it, expect } from 'vitest';
import { frequencyToMidi, midiToName, midiToFrequency, quantize } from '../../../static/game/notes.js';

describe('notes', () => {
  it('frequencyToMidi(440) === 69', () => {
    expect(frequencyToMidi(440)).toBeCloseTo(69, 6);
  });

  it('midiToName covers C4 and A4', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(61)).toBe('C#4');
  });

  it('midiToFrequency(69) ≈ 440', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 4);
  });

  it('quantize gives signed cents within (-50, 50]', () => {
    const exact = quantize(440);
    expect(exact.midi).toBe(69);
    expect(exact.name).toBe('A4');
    expect(Math.abs(exact.centsOffset)).toBeLessThan(0.001);

    // Slightly sharp A4 (+30 cents): 440 * 2^(0.3/12)
    const sharp = quantize(440 * Math.pow(2, 0.3 / 12));
    expect(sharp.midi).toBe(69);
    expect(sharp.centsOffset).toBeGreaterThan(0);
    expect(sharp.centsOffset).toBeLessThanOrEqual(50);

    // Slightly flat A4 (-30 cents)
    const flat = quantize(440 * Math.pow(2, -0.3 / 12));
    expect(flat.midi).toBe(69);
    expect(flat.centsOffset).toBeLessThan(0);
    expect(flat.centsOffset).toBeGreaterThan(-50);
  });
});
