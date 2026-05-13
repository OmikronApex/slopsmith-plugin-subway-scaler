// Run state machine + note-acceptance gate.
// States: idle / running / paused / succeeded / failed / abandoned.

const DIFF_TABLE = { easy: 4000, medium: 2500, hard: 1500 };

export function difficultyToTimePerNoteMs(difficulty) {
  return DIFF_TABLE[difficulty] ?? 2500;
}

export class Run {
  constructor({
    sequence,
    timePerNoteMs,
    strictOctave = false,
    stabilityFrames = 3,
    toleranceCents = 50,
    confidenceThreshold = 0.8,
  }) {
    this.sequence = sequence;
    this.timePerNoteMs = timePerNoteMs;
    this.strictOctave = strictOctave;
    this.stabilityFrames = stabilityFrames;
    this.toleranceCents = toleranceCents;
    this.confidenceThreshold = confidenceThreshold;

    this.state = 'idle';
    this.cursor = 0;
    this.deadlineAt = 0;
    this.startedAt = 0;
    this.endedAt = null;
    this._pausedAt = 0;
    this._stableMidi = null;
    this._stableCount = 0;
  }

  start(nowMs) {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.startedAt = nowMs;
    this.deadlineAt = nowMs + this.timePerNoteMs;
  }

  currentExpected() {
    if (this.cursor >= this.sequence.length) return null;
    return { index: this.cursor, note: this.sequence[this.cursor], strictOctave: this.strictOctave };
  }

  upcoming(n) {
    return this.sequence.slice(this.cursor, this.cursor + n);
  }

  pause(nowMs) {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this._pausedAt = nowMs;
  }

  resume(nowMs) {
    if (this.state !== 'paused') return;
    const remaining = this.deadlineAt - this._pausedAt;
    this.deadlineAt = nowMs + Math.max(0, remaining);
    this.state = 'running';
  }

  abandon() {
    if (this.state === 'succeeded' || this.state === 'failed') return;
    this.state = 'abandoned';
    this.endedAt = Date.now();
  }

  tick(nowMs) {
    if (this.state !== 'running') return;
    if (nowMs >= this.deadlineAt) {
      this.state = 'failed';
      this.endedAt = nowMs;
    }
  }

  _matches(expectedMidi, detectedMidi) {
    if (this.strictOctave) return expectedMidi === detectedMidi;
    return ((expectedMidi % 12) + 12) % 12 === ((detectedMidi % 12) + 12) % 12;
  }

  onDetection(det) {
    if (this.state !== 'running') return 'ignored';
    if (!det || det.frequencyHz == null || det.note == null) {
      this._stableMidi = null;
      this._stableCount = 0;
      return 'silence';
    }
    if (det.confidence < this.confidenceThreshold) {
      this._stableMidi = null;
      this._stableCount = 0;
      return 'low-confidence';
    }
    if (Math.abs(det.centsOffset) > this.toleranceCents) {
      this._stableMidi = null;
      this._stableCount = 0;
      return 'out-of-tolerance';
    }
    const expected = this.currentExpected();
    if (!expected) return 'ignored';

    if (this._stableMidi === det.note.midi) {
      this._stableCount++;
    } else {
      this._stableMidi = det.note.midi;
      this._stableCount = 1;
    }

    if (this._stableCount < this.stabilityFrames) return 'rejected';
    if (!this._matches(expected.note.midi, det.note.midi)) return 'rejected';

    // Accept
    this.cursor++;
    this._stableMidi = null;
    this._stableCount = 0;
    if (this.cursor >= this.sequence.length) {
      this.state = 'succeeded';
      this.endedAt = Date.now();
    } else {
      this.deadlineAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + this.timePerNoteMs;
    }
    return 'accepted';
  }
}
