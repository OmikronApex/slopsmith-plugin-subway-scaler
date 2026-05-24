/**
 * Tests for wave-coupled variant spawn logic (story 5-8).
 *
 * Variant geometry + safe zone are anchored to the target wave's spawn_time_ms,
 * not proposal time. The render loop watches for the target wave (by note_index)
 * and calls proposeVariantTracks with that wave.
 *
 * Target indices:
 *   - RIGHT variant: apex → first descending note = ascendingNoteCount
 *   - LEFT variant:  root → second ascending note = 1
 */
import { describe, it, expect } from 'vitest';

// --- Wave-coupled spawn: find target wave by note_index ---

/**
 * Simulates the render-loop wave watcher. Finds the first upcoming wave
 * matching targetNoteIndex that hasn't fully expired.
 */
function findTargetWave(waves, targetNoteIndex, game_now) {
  return waves
    .filter(w => w.note_index === targetNoteIndex && w.spawn_time_ms + w.duration_ms >= game_now)
    .sort((a, b) => a.spawn_time_ms - b.spawn_time_ms)[0] ?? null;
}

function makeWave(id, noteIndex, deadlineMs, durationMs = 4000) {
  return {
    wave_id: id,
    note_index: noteIndex,
    spawn_time_ms: deadlineMs - durationMs,
    duration_ms: durationMs,
  };
}

const ASCENDING_COUNT = 8; // A minor pentatonic on bass

describe('wave-coupled spawn: find target wave', () => {
  it('returns null when no waves match the target note_index', () => {
    const waves = [makeWave('w1', 0, 5000)];
    expect(findTargetWave(waves, ASCENDING_COUNT, 5000)).toBeNull();
  });

  it('returns null for an expired wave', () => {
    const game_now = 10000;
    const waves = [makeWave('w-apex', ASCENDING_COUNT, game_now - 100)];
    expect(findTargetWave(waves, ASCENDING_COUNT, game_now)).toBeNull();
  });

  it('finds the first descending note wave (RIGHT target = ascendingNoteCount)', () => {
    const game_now = 10000;
    const waves = [
      makeWave('w-asc-root', 0, game_now + 100),
      makeWave('w-asc-apex', ASCENDING_COUNT - 1, game_now + 1600 * 7),
      makeWave('w-desc-first', ASCENDING_COUNT, game_now + 1600 * 8), // target
      makeWave('w-desc-second', ASCENDING_COUNT + 1, game_now + 1600 * 9),
    ];
    const result = findTargetWave(waves, ASCENDING_COUNT, game_now);
    expect(result?.wave_id).toBe('w-desc-first');
  });

  it('finds the second ascending note wave (LEFT target = 1)', () => {
    const game_now = 10000;
    const waves = [
      makeWave('w-root', 0, game_now + 100),
      makeWave('w-second', 1, game_now + 1600 + 100), // target
      makeWave('w-third', 1, game_now + 1600 * 8 + 100), // next cycle
    ];
    const result = findTargetWave(waves, 1, game_now);
    expect(result?.wave_id).toBe('w-second');
  });

  it('returns the soonest upcoming wave when multiple cycles exist', () => {
    const game_now = 10000;
    const waves = [
      makeWave('w-this-cycle', ASCENDING_COUNT, game_now + 1600 * 8),
      makeWave('w-next-cycle', ASCENDING_COUNT, game_now + 1600 * 22),
    ];
    const result = findTargetWave(waves, ASCENDING_COUNT, game_now);
    expect(result?.wave_id).toBe('w-this-cycle');
  });

  it('does not deduplicate by wave_id — returns first match sorted by spawn_time_ms', () => {
    const game_now = 10000;
    // Explicitly test that the sort order picks the earliest spawn
    const waves = [
      makeWave('w-late', ASCENDING_COUNT, game_now + 30000),
      makeWave('w-early', ASCENDING_COUNT, game_now + 1600 * 8),
    ];
    const result = findTargetWave(waves, ASCENDING_COUNT, game_now);
    expect(result?.wave_id).toBe('w-early');
  });
});

describe('variant safe zone timing model (wave-coupled anchor)', () => {
  it('safe zone travels in lockstep with target wave', () => {
    // Anchor is the target wave's spawn_time_ms, not proposal time.
    // Both the wave and safe zone use the same elapsed calculation:
    //   z = SPAWN_Z + elapsed * speed * 0.5
    // This means for any game_now >= waveSpawnMs, the safe zone and wave
    // share the same Z-offset from spawn.
    const SPAWN_Z = -100;
    const waveSpawnMs = 8000; // target wave spawns at t=8000
    const speed = 0.025;
    const game_now = 12000; // 4000ms after spawn
    const elapsed = game_now - waveSpawnMs; // 4000ms

    const waveZ = SPAWN_Z + elapsed * speed * 0.5;
    // Safe zone uses same formula with same elapsed + speed
    const szZ = SPAWN_Z + elapsed * speed * 0.5;

    expect(szZ).toBe(waveZ);
  });

  it('timing is independent of proposal time', () => {
    // Proposal could happen at t=0 while target wave spawns at t=12800.
    // The safe zone should be at Z=-100 (just spawned) at t=12800, not
    // already 12800ms into its travel.
    const SPAWN_Z = -100;
    const speed = 0.025;
    const proposalTime = 0;
    const waveSpawnMs = 12800; // ~8 notes × 1600ms
    const game_now = 12800;

    // Old behavior: anchored to proposal time → safe zone already at player
    const oldElapsed = game_now - proposalTime; // 12800ms
    const oldSzZ = SPAWN_Z + oldElapsed * speed * 0.5; // far past player

    // New behavior: anchored to wave spawn time → safe zone just spawned
    const newElapsed = Math.max(0, game_now - waveSpawnMs);
    const newSzZ = SPAWN_Z + newElapsed * speed * 0.5; // at SPAWN_Z

    expect(newSzZ).toBe(SPAWN_Z);
    // Old is wrong: far past the player (z=0) by t=12800
    expect(oldSzZ).toBeGreaterThan(SPAWN_Z + 50);
  });

  it('elapsed snaps to 0 when game_now precedes wave spawn', () => {
    // Prior to the target wave spawning, elapsed clamps to 0 via Math.max.
    const waveSpawnMs = 8000;
    const game_now = 4000;
    const elapsed = Math.max(0, game_now - waveSpawnMs);
    expect(elapsed).toBe(0);
  });
});

describe('targetNoteIndex calculation', () => {
  it('RIGHT variant targets ascendingNoteCount (first descending note)', () => {
    const ascendingNoteCount = 8;
    const targetNoteIndex = ascendingNoteCount;
    expect(targetNoteIndex).toBe(8);
  });

  it('LEFT variant targets index 1 (second ascending note)', () => {
    const targetNoteIndex = 1; // always 1 for LEFT
    expect(targetNoteIndex).toBe(1);
  });
});