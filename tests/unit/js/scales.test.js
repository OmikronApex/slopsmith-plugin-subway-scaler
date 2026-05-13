import { describe, it, expect } from 'vitest';
import { expand } from '../../../static/game/scales.js';

const MAJOR = { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11, 12] };

describe('scales.expand', () => {
  it('C major one octave ascending', () => {
    const notes = expand(MAJOR, 60, 1, false);
    expect(notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('C major two octaves ascending', () => {
    const notes = expand(MAJOR, 60, 2, false);
    expect(notes.map(n => n.midi)).toEqual([
      60, 62, 64, 65, 67, 69, 71,
      72, 74, 76, 77, 79, 81, 83, 84,
    ]);
  });

  it('descending pass appended without duplicating apex', () => {
    const notes = expand(MAJOR, 60, 1, true);
    expect(notes.map(n => n.midi)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72,
      71, 69, 67, 65, 64, 62, 60,
    ]);
  });
});
