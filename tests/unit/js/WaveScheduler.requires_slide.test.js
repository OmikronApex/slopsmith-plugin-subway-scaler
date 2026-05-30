import { describe, it, expect } from 'vitest';
import { WaveScheduler } from '../../../static/game/WaveScheduler.js';

const TIMING = {
  base_duration_ms: 2500,
  wave_spacing_factor: 0.4,
  wave_lookahead_ms: 10000,
};

// baseFret=2, numLanes=6 → safeTrack = clamp(fret - 2, 0, 5)
const BASE_FRET = 2;
const NUM_LANES = 6;

function note(fret) {
  return { midi: 60 + fret, name: `N${fret}`, fret, string: 3 };
}

function scheduleWaves(notes) {
  const s = new WaveScheduler(notes, TIMING, BASE_FRET, NUM_LANES);
  s.tick(0, 1.0);
  return s;
}

describe('WaveScheduler — requires_slide', () => {
  it('consecutive same-fret: second wave has requires_slide=true', () => {
    const s = scheduleWaves([note(4), note(4), note(6)]);
    // wave[0]: fret 4 → safeTrack 2, prev=null → false
    // wave[1]: fret 4 → safeTrack 2, prev=2 → true
    // wave[2]: fret 6 → safeTrack 4, prev=2 → false
    expect(s.waves[0].requires_slide).toBeFalsy();
    expect(s.waves[1].requires_slide).toBe(true);
    expect(s.waves[2].requires_slide).toBeFalsy();
  });

  it('consecutive different-fret: neither wave has requires_slide', () => {
    const s = scheduleWaves([note(3), note(5), note(7)]);
    expect(s.waves[0].requires_slide).toBeFalsy();
    expect(s.waves[1].requires_slide).toBeFalsy();
    expect(s.waves[2].requires_slide).toBeFalsy();
  });

  it('same-fret pair followed by different fret: only index 1 has requires_slide', () => {
    const s = scheduleWaves([note(4), note(4), note(7)]);
    expect(s.waves[0].requires_slide).toBeFalsy();
    expect(s.waves[1].requires_slide).toBe(true);
    expect(s.waves[2].requires_slide).toBeFalsy();
  });

  it('after reset(): first wave never has requires_slide=true even if previous run ended on same track', () => {
    // Run 1: ends on fret 4 (safeTrack 2)
    const s = new WaveScheduler([note(4)], TIMING, BASE_FRET, NUM_LANES);
    s.tick(0, 1.0);
    // confirm last wave in first run is fret 4
    const lastWave = s.waves[s.waves.length - 1];
    expect(lastWave.safe_track).toBe(2);

    // reset to same note — first wave should NOT have requires_slide=true
    s.reset([note(4)], 0);
    s.tick(0, 1.0);
    expect(s.waves[0].requires_slide).toBeFalsy();
  });
});
