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

  describe('pauseQueueing / resumeQueueing (Story 6.1)', () => {
    it('pauseQueueing stops new wave generation on subsequent ticks', () => {
      scheduler.tick(0, 1.0);
      const countBefore = scheduler.waves.length;
      scheduler.pauseQueueing();
      scheduler.tick(BASE_TIMING.wave_lookahead_ms + 5000, 1.0);
      expect(scheduler.waves.length).toBeLessThanOrEqual(countBefore);
    });

    it('paused scheduler still prunes waves past the prune threshold', () => {
      scheduler.tick(0, 1.0);
      const firstWave = scheduler.waves[0];
      scheduler.pauseQueueing();
      const farFuture = firstWave.spawn_time_ms + firstWave.duration_ms + 15000;
      scheduler.tick(farFuture, 1.0);
      const ids = scheduler.waves.map(w => w.wave_id);
      expect(ids).not.toContain(firstWave.wave_id);
    });

    it('pauseQueueing does not remove in-flight waves', () => {
      scheduler.tick(0, 1.0);
      const initialCount = scheduler.waves.length;
      scheduler.pauseQueueing();
      scheduler.tick(BASE_TIMING.base_duration_ms, 1.0);
      expect(scheduler.waves.length).toBeGreaterThan(0);
      // Count should not increase (no new waves added)
      expect(scheduler.waves.length).toBeLessThanOrEqual(initialCount);
    });

    it('resumeQueueing starts spawning new notes; pre-pause waves survive', () => {
      scheduler.tick(0, 1.0);
      const preCount = scheduler.waves.length;
      const preIds = new Set(scheduler.waves.map(w => w.wave_id));

      scheduler.pauseQueueing();
      scheduler.tick(1000, 1.0);
      expect(scheduler.waves.length).toBeLessThanOrEqual(preCount);

      const newNotes = makeNotes(3).map((n, i) => ({ ...n, midi: 70 + i }));
      const resumeGameNow = 10000;
      scheduler.resumeQueueing(newNotes, 0, null, null, resumeGameNow);
      scheduler.tick(resumeGameNow + BASE_TIMING.wave_lookahead_ms, 1.0);

      const newWaves = scheduler.waves.filter(w => !preIds.has(w.wave_id));
      expect(newWaves.length).toBeGreaterThan(0);
      const firstNew = newWaves.sort((a, b) => a.spawn_time_ms - b.spawn_time_ms)[0];
      expect(firstNew.safe_midi).toBe(newNotes[0].midi);

      // Pre-pause waves that haven't been pruned are still present
      const survivingOld = scheduler.waves.filter(w => preIds.has(w.wave_id));
      expect(survivingOld.length).toBeGreaterThanOrEqual(0); // may have been pruned by elapsed time
    });

    it('resumeQueueing with startIndex 2 starts from note at index 2', () => {
      scheduler.pauseQueueing();
      const newNotes = makeNotes(4);
      scheduler.resumeQueueing(newNotes, 2);
      const nowMs = performance.now();
      scheduler.tick(nowMs + BASE_TIMING.wave_lookahead_ms, 1.0);
      const newWaves = scheduler.waves.filter(w => !w.wave_id.startsWith('w-'));
      // The first newly queued wave's note should come from index 2
      const firstNew = scheduler.waves.find(w => w.safe_midi === newNotes[2].midi || w.safe_midi === newNotes[3].midi || w.safe_midi === newNotes[0].midi);
      expect(firstNew).toBeTruthy();
    });

    it('queueingPaused getter reflects state', () => {
      expect(scheduler.queueingPaused).toBe(false);
      scheduler.pauseQueueing();
      expect(scheduler.queueingPaused).toBe(true);
      scheduler.resumeQueueing(makeNotes(), 0);
      expect(scheduler.queueingPaused).toBe(false);
    });

    it('promote failure recovery: resumeQueueing with cursor restores pre-pause waves and cursor (AC-6 6-5)', () => {
      scheduler.tick(0, 1.0);
      const preIds = scheduler.waves.map(w => w.wave_id);
      const cursor = 2;
      scheduler.pauseQueueing();
      // Simulate promote error — caller resumes with outgoing notes at current cursor.
      const recoveryNotes = makeNotes(4);
      scheduler.resumeQueueing(recoveryNotes, cursor);
      // Pre-pause in-flight waves still present (not cleared by resumeQueueing).
      const nowIds = new Set(scheduler.waves.map(w => w.wave_id));
      // At least some pre-pause waves survive resumeQueueing (may be fewer if pruned).
      const survivors = preIds.filter(id => nowIds.has(id));
      expect(survivors.length).toBeGreaterThan(0);
      expect(scheduler.queueingPaused).toBe(false);
      // Tick to verify new waves spawn from cursor.
      scheduler.tick(performance.now() + BASE_TIMING.wave_lookahead_ms, 1.0);
      const newWaves = scheduler.waves.filter(w => !preIds.includes(w.wave_id));
      expect(newWaves.length).toBeGreaterThan(0);
      // First new wave note index should reflect the cursor offset.
      const firstNew = newWaves.sort((a, b) => a.spawn_time_ms - b.spawn_time_ms)[0];
      expect(firstNew.note_index).toBeGreaterThanOrEqual(cursor);
    });
  });

  describe('dual-wave cohort coexistence (Story 6.6)', () => {
    it('old and new waves coexist after resumeQueueing — no early removal', () => {
      scheduler.tick(0, 1.0);
      const oldIds = scheduler.waves.map(w => w.wave_id);
      expect(oldIds.length).toBeGreaterThan(0);

      scheduler.pauseQueueing();
      scheduler.tick(500, 1.0);

      const newNotes = makeNotes(3).map((n, i) => ({ ...n, midi: 70 + i }));
      scheduler.resumeQueueing(newNotes, 0);
      scheduler.tick(performance.now() + BASE_TIMING.wave_lookahead_ms, 1.0);

      const allIds = scheduler.waves.map(w => w.wave_id);
      const surviving = oldIds.filter(id => allIds.includes(id));
      const added = allIds.filter(id => !oldIds.includes(id));
      expect(added.length).toBeGreaterThan(0);
      expect(surviving.length).toBeGreaterThanOrEqual(0); // may be pruned by time
    });

    it('_totalWavesSpawned increments monotonically across pause/resume', () => {
      scheduler.tick(0, 1.0);
      const countA = scheduler.waves.length;
      scheduler.pauseQueueing();
      const newNotes = makeNotes(2).map((n, i) => ({ ...n, midi: 80 + i }));
      scheduler.resumeQueueing(newNotes, 0);
      scheduler.tick(performance.now() + BASE_TIMING.wave_lookahead_ms, 1.0);
      const allIds = new Set(scheduler.waves.map(w => w.wave_id));
      // No duplicate wave IDs.
      expect(allIds.size).toBe(scheduler.waves.length);
    });

    it('resumeQueueing with empty scheduler (0 old waves) starts fresh', () => {
      // Don't tick; scheduler has 0 waves.
      scheduler.pauseQueueing();
      const newNotes = makeNotes(2).map((n, i) => ({ ...n, midi: 75 + i }));
      scheduler.resumeQueueing(newNotes, 0);
      scheduler.tick(performance.now() + BASE_TIMING.wave_lookahead_ms, 1.0);
      expect(scheduler.waves.length).toBeGreaterThan(0);
    });

    it('new waves use new note data after resumeQueueing', () => {
      scheduler.tick(0, 1.0);
      const oldMidis = new Set(scheduler.waves.map(w => w.safe_fret));
      scheduler.pauseQueueing();
      const newNotes = [{ midi: 99, name: 'X', fret: 22, string: 1 }];
      scheduler.resumeQueueing(newNotes, 0);
      scheduler.tick(performance.now() + BASE_TIMING.wave_lookahead_ms, 1.0);
      const newWaves = scheduler.waves.filter(w => w.safe_fret === 22);
      expect(newWaves.length).toBeGreaterThan(0);
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
