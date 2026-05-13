import { describe, it, expect } from 'vitest';
import { resolve } from '../../../static/game/fretboard.js';

const GUITAR = {
  id: 'guitar-standard',
  stringCount: 6,
  tuning: [40, 45, 50, 55, 59, 64],
  maxFret: 24,
};

const BASS = {
  id: 'bass-4-standard',
  stringCount: 4,
  tuning: [28, 33, 38, 43],
  maxFret: 24,
};

describe('fretboard.resolve', () => {
  it('open strings map to their string at fret 0 with no prev', () => {
    for (let s = 0; s < GUITAR.stringCount; s++) {
      const midi = GUITAR.tuning[s];
      // Choose the LOWEST-fret candidate with no prev — could be on a lower-pitch string
      // at a non-zero fret. Verify the chosen string actually plays the right pitch.
      const pos = resolve(midi, null, GUITAR);
      expect(pos).not.toBeNull();
      expect(GUITAR.tuning[pos.stringIdx] + pos.fret).toBe(midi);
      // And specifically: lowest-fret strategy picks the highest playable string (fret 0)
      // when an open candidate exists.
      expect(pos.fret).toBe(0);
      expect(pos.stringIdx).toBe(s);
    }
  });

  it('returns null when MIDI is below the lowest open string', () => {
    expect(resolve(39, null, GUITAR)).toBeNull(); // below low E2 (40)
    expect(resolve(27, null, BASS)).toBeNull();   // below low E1 (28)
  });

  it('bass open E1 resolves on bass, null on guitar', () => {
    expect(resolve(28, null, BASS)).toEqual({ stringIdx: 0, fret: 0 });
    expect(resolve(28, null, GUITAR)).toBeNull();
  });

  it('returns null when MIDI is above tuning[-1] + maxFret', () => {
    expect(resolve(GUITAR.tuning[5] + GUITAR.maxFret + 1, null, GUITAR)).toBeNull();
  });

  it('same-string bias: consecutive note reachable on the current string stays there', () => {
    // string 0 (E2 open) → MIDI 43 (G2). On guitar this is reachable on string 0 fret 3
    // OR string 1 (A2 open) fret -2 (invalid); only valid candidate is string 0 fret 3.
    const prev = { stringIdx: 0, fret: 0 };
    expect(resolve(43, prev, GUITAR)).toEqual({ stringIdx: 0, fret: 3 });
  });

  it('stays on current string when a close candidate exists there', () => {
    // prev (string 1 = A2, fret 5 → C3). Next MIDI 48 (C3):
    //   string 0 fret 8 (dist sqrt(1+9)=3.16), string 1 fret 3 (dist 2.0). String 1 wins.
    const prev = { stringIdx: 1, fret: 5 };
    expect(resolve(48, prev, GUITAR)).toEqual({ stringIdx: 1, fret: 3 });
  });

  it('US2: crossing an open-MIDI boundary changes stringIdx', () => {
    // Prev (string 0 = E2 open). Next MIDI 45 (A2 = string 1 open).
    // string 0 fret 5 (dist 5), string 1 fret 0 (dist sqrt(1+0)=1). String 1 wins.
    const prev = { stringIdx: 0, fret: 0 };
    expect(resolve(45, prev, GUITAR)).toEqual({ stringIdx: 1, fret: 0 });
  });

  it('US3: bass-only MIDI resolves on bass, null on guitar', () => {
    expect(resolve(28, null, BASS)).toEqual({ stringIdx: 0, fret: 0 });
    expect(resolve(28, null, GUITAR)).toBeNull();
  });

  it('string change picked when only adjacent string can reach the note close by', () => {
    // prev on string 0 (E2 open). Next note MIDI 45 (A2). Reachable on string 0 fret 5,
    // and string 1 open. With same-string bias, string 0 fret 5 (distance 5) beats
    // string 1 fret 0 (distance sqrt(1+25)≈5.1). Resolver picks string 0.
    // Verify: when the candidate on a new string is meaningfully closer, that wins.
    // MIDI 50 (D3): string 0 fret 10, string 1 fret 5, string 2 fret 0.
    const prev = { stringIdx: 0, fret: 0 };
    const pos = resolve(50, prev, GUITAR);
    // Closest in (string, fret) space: string 2 fret 0 has dist sqrt(4+0)=2;
    // string 1 fret 5 has dist sqrt(1+25)~5.1; string 0 fret 10 has dist 10.
    // Same-string bias is small, so string 2 should win.
    expect(pos).toEqual({ stringIdx: 2, fret: 0 });
  });
});
