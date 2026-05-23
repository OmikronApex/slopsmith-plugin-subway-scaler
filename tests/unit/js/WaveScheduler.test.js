import { describe, it, expect, beforeEach } from 'vitest';
import { WaveScheduler } from '../../../static/game/WaveScheduler.js';

function makeNotes(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    midi: 60 + i,
    name: `N${i}`,
    fret: i + 2,
    string: 3,
  }));
}

const BASE_TIMING = {
  base_duration_ms: 2500,
  wave_spacing_factor: 0.4,
  wave_lookahead_ms: 10000,
  speed_increment_per_note: 0.05,
};

describe('WaveScheduler', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new WaveScheduler(makeNotes(), BASE_TIMING, 2, 6);
  });

  describe('constructor', () => {
    it('starts with empty waves before tick', () => {
      expect(scheduler.waves).toHaveLength(0);
    });
  });

  describe('tick — wave count', () => {
    it('populates waves after tick(0, 1.0)', () => {
      scheduler.tick(0, 1.0);
      expect(scheduler.waves.length).toBeGreaterThan(0);
    });

    it('fills lookahead: waves cover game_now + wave_lookahead_ms', () => {
      scheduler.tick(0, 1.0);
      const { wave_lookahead_ms, base_duration_ms, wave_spacing_factor } = BASE_TIMING;
      const gap = base_duration_ms * wave_spacing_factor;
      const expectedCount = Math.ceil(wave_lookahead_ms / gap);
      expect(scheduler.waves.length).toBeGreaterThanOrEqual(expectedCount);
    });

    it('does not add more waves when lookahead already covered', () => {
      scheduler.tick(0, 1.0);
      const countAfterFirst = scheduler.waves.length;
      scheduler.tick(0, 1.0);
      expect(scheduler.waves.length).toBe(countAfterFirst);
    });
  });

  describe('tick — spawn_time_ms advances', () => {
    it('each subsequent wave has a larger spawn_time_ms', () => {
      scheduler.tick(0, 1.0);
      const times = scheduler.waves.map(w => w.spawn_time_ms);
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
    });
  });

  describe('tick — wave shape', () => {
    it('wave has required fields', () => {
      scheduler.tick(0, 1.0);
      const w = scheduler.waves[0];
      expect(w).toHaveProperty('wave_id');
      expect(w).toHaveProperty('wave_index');
      expect(w).toHaveProperty('safe_track');
      expect(w).toHaveProperty('safe_midi');
      expect(w).toHaveProperty('note_name');
      expect(w).toHaveProperty('spawn_time_ms');
      expect(w).toHaveProperty('speed_px_per_ms');
      expect(w).toHaveProperty('duration_ms');
      expect(w).toHaveProperty('cleared');
      expect(w.cleared).toBe(false);
    });

    it('wave_id is w-<index>', () => {
      scheduler.tick(0, 1.0);
      expect(scheduler.waves[0].wave_id).toBe('w-0');
      expect(scheduler.waves[1].wave_id).toBe('w-1');
    });
  });

  describe('tick — pruning', () => {
    it('prunes waves whose expiry is > 10s in the past', () => {
      scheduler.tick(0, 1.0);
      const firstWave = scheduler.waves[0];
      // Advance game_now past first wave's expiry by 10001ms
      const advancedNow = firstWave.spawn_time_ms + firstWave.duration_ms + 10001;
      scheduler.tick(advancedNow, 1.0);
      const ids = scheduler.waves.map(w => w.wave_id);
      expect(ids).not.toContain(firstWave.wave_id);
    });
  });

  describe('reset', () => {
    it('clears waves and restarts from new notes', () => {
      scheduler.tick(0, 1.0);
      expect(scheduler.waves.length).toBeGreaterThan(0);

      const newNotes = makeNotes(3);
      scheduler.reset(newNotes);
      expect(scheduler.waves).toHaveLength(0);

      scheduler.tick(0, 1.0);
      expect(scheduler.waves[0].safe_midi).toBe(newNotes[0].midi);
    });

    it('resets internal deadline so next tick re-fills from scratch', () => {
      scheduler.tick(0, 1.0);
      const countBefore = scheduler.waves.length;
      scheduler.reset(makeNotes());
      scheduler.tick(0, 1.0);
      expect(scheduler.waves.length).toBe(countBefore);
    });
  });

  describe('speedMultiplier effects', () => {
    it('higher speed produces shorter duration_ms', () => {
      const slow = new WaveScheduler(makeNotes(), BASE_TIMING, 2, 6);
      const fast = new WaveScheduler(makeNotes(), BASE_TIMING, 2, 6);
      slow.tick(0, 1.0);
      fast.tick(0, 2.0);
      expect(fast.waves[0].duration_ms).toBeLessThan(slow.waves[0].duration_ms);
    });

    it('higher speed produces tighter gap between waves', () => {
      const slow = new WaveScheduler(makeNotes(), BASE_TIMING, 2, 6);
      const fast = new WaveScheduler(makeNotes(), BASE_TIMING, 2, 6);
      slow.tick(0, 1.0);
      fast.tick(0, 2.0);
      const slowGap = slow.waves[1].spawn_time_ms - slow.waves[0].spawn_time_ms;
      const fastGap = fast.waves[1].spawn_time_ms - fast.waves[0].spawn_time_ms;
      expect(fastGap).toBeLessThan(slowGap);
    });
  });

  describe('safe_track clamping', () => {
    it('safe_track is clamped to [0, numLanes-1]', () => {
      const notesHighFret = [{ midi: 60, name: 'N', fret: 100, string: 1 }];
      const s = new WaveScheduler(notesHighFret, BASE_TIMING, 0, 6);
      s.tick(0, 1.0);
      expect(s.waves[0].safe_track).toBe(5); // clamped to numLanes-1
    });

    it('safe_track is clamped at 0 for fret < baseFret', () => {
      const notesLowFret = [{ midi: 60, name: 'N', fret: 0, string: 1 }];
      const s = new WaveScheduler(notesLowFret, BASE_TIMING, 5, 6);
      s.tick(0, 1.0);
      expect(s.waves[0].safe_track).toBe(0);
    });
  });
});
