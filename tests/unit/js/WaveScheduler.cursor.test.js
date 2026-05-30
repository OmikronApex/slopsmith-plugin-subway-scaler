import { describe, it, expect } from 'vitest';
import { WaveScheduler } from '../../../static/game/WaveScheduler.js';

const BASE_TIMING = {
  base_duration_ms: 2500,
  wave_spacing_factor: 0.4,
  wave_lookahead_ms: 10000,
  speed_increment_per_note: 0.05,
};

function makeNotes(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    midi: 60 + i,
    name: `N${i}`,
    fret: i + 2,
    string: 3,
  }));
}

describe('WaveScheduler — note_index vs cursor alignment (Story 9-1)', () => {
  it.each([5, 6, 7, 8])('pre-spawned waves include one matching each cursor position for num_lanes=%i', (numLanes) => {
    const notes = makeNotes(numLanes);
    const ws = new WaveScheduler(notes, BASE_TIMING, 0, numLanes);

    // Simulate enough ticks to fill the lookahead window
    ws.tick(0, 1.0);

    // For each cursor position 0..numLanes-1, there should be at least one wave
    for (let cursor = 0; cursor < numLanes; cursor++) {
      const match = ws.waves.find(w => w.note_index === cursor);
      expect(match).toBeDefined();
    }
  });

  it('after cursor advances past cycle boundary, a wave with matching note_index exists', () => {
    const numLanes = 7;
    const notes = makeNotes(numLanes);
    const ws = new WaveScheduler(notes, BASE_TIMING, 0, numLanes);
    ws.tick(0, 1.0);

    // Simulate cursor = 3
    let cursor = 3;
    const match = ws.waves.find(w => w.note_index === cursor);
    expect(match).toBeDefined();
    expect(match.safe_midi).toBe(notes[cursor].midi);
  });
});