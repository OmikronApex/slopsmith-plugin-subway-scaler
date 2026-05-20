import { describe, it, expect } from 'vitest';
import { Run, difficultyToTimePerNoteMs } from '../../../static/game/GameState.js';

function note(midi, name) {
  return { midi, name, frequencyHz: 440 * Math.pow(2, (midi - 69) / 12) };
}

const C_MAJOR = [60, 62, 64, 65, 67, 69, 71, 72].map(m => note(m, `M${m}`));

function detection(midi, opts = {}) {
  return {
    frequencyHz: 440 * Math.pow(2, (midi - 69) / 12),
    confidence: opts.confidence ?? 0.9,
    note: { midi, name: `M${midi}`, frequencyHz: 0 },
    centsOffset: opts.centsOffset ?? 0,
    timestampMs: opts.timestampMs ?? 0,
  };
}

describe('Run state machine', () => {
  it('advances cursor on three stable correct frames and loops at the end', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 2000, stabilityFrames: 3 });
    run.start(0);
    expect(run.state).toBe('running');
    expect(run.cursor).toBe(0);

    for (const target of C_MAJOR) {
      let r = null;
      for (let i = 0; i < 3; i++) r = run.onDetection(detection(target.midi));
      expect(r).toBe('accepted');
    }
    expect(run.state).toBe('running');
    expect(run.cursor).toBe(0);
  });

  it('rejects single-frame correct detection (debounce)', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 2000, stabilityFrames: 3 });
    run.start(0);
    const r = run.onDetection(detection(60));
    expect(r).not.toBe('accepted');
    expect(run.cursor).toBe(0);
  });


  it('pause and resume preserve the cursor', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 1000, stabilityFrames: 3 });
    run.start(0);
    run.pause(200);
    expect(run.state).toBe('paused');
    run.resume(5000);
    expect(run.state).toBe('running');
    run.tick(5500);
    expect(run.state).toBe('running');
  });

  it('abandon ends the run', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 1000, stabilityFrames: 3 });
    run.start(0);
    run.abandon();
    expect(run.state).toBe('abandoned');
  });

  it('rejects low-confidence frames', () => {
    const run = new Run({
      sequence: C_MAJOR, timePerNoteMs: 2000, stabilityFrames: 3, confidenceThreshold: 0.8,
    });
    run.start(0);
    for (let i = 0; i < 3; i++) run.onDetection(detection(60, { confidence: 0.3 }));
    expect(run.cursor).toBe(0);
  });

  it('default mode accepts wrong-octave same pitch class', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 2000, stabilityFrames: 3, strictOctave: false });
    run.start(0);
    for (let i = 0; i < 3; i++) run.onDetection(detection(72));
    expect(run.cursor).toBe(1);
  });

  it('strict-octave mode rejects wrong-octave same pitch class', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 2000, stabilityFrames: 3, strictOctave: true });
    run.start(0);
    for (let i = 0; i < 3; i++) run.onDetection(detection(72));
    expect(run.cursor).toBe(0);
  });

  it('upcoming(n) returns next n notes from sequence', () => {
    const run = new Run({ sequence: C_MAJOR, timePerNoteMs: 1000 });
    const up = run.upcoming(3);
    expect(up).toHaveLength(3);
    expect(up[0]).toBe(C_MAJOR[0]);
    expect(up[1]).toBe(C_MAJOR[1]);
    expect(up[2]).toBe(C_MAJOR[2]);
  });

  it('difficultyToTimePerNoteMs', () => {
    expect(difficultyToTimePerNoteMs('easy')).toBe(4000);
    expect(difficultyToTimePerNoteMs('medium')).toBe(2500);
    expect(difficultyToTimePerNoteMs('hard')).toBe(1500);
  });
});
