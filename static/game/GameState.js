// Run state machine + note-acceptance gate.
// States: idle / running / paused / succeeded / failed / abandoned.

// ===== TRANSITION_PHASES constants (Story 6.1) =====
export const TRANSITION_PHASES = {
  IDLE: 'idle',
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  RIDING: 'riding',
  BREATHER: 'breather',
  PROMOTING: 'promoting',
  ACTIVE: 'active',
};

// ===== PHASES constants (Story 1.2) =====
export const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  RESTARTING: 'restarting',
};

// ===== Canonical game state (Story 1.2) =====
export const GameState = {
  session: {
    scale: null,
    rootMidi: null,
    difficulty: null,
    instrument: null,
  },
  runtime: {
    score: 0,
    speed: 1.0,
    phase: PHASES.IDLE,
    currentNote: null,
  },
  scene: {
    carts: [],
    tracks: [],
    character: {},
  },
};

// ===== Original Run class + utilities =====
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
  }

  currentExpected() {
    if (this.cursor >= this.sequence.length) return null;
    return { index: this.cursor, note: this.sequence[this.cursor], strictOctave: this.strictOctave };
  }

  upcoming(n) {
    const result = [];
    if (!this.sequence || this.sequence.length === 0) return result;
    for (let i = 0; i < n; i++) {
      result.push(this.sequence[(this.cursor + i) % this.sequence.length]);
    }
    return result;
  }

  pause(nowMs) {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this._pausedAt = nowMs;
  }

  resume(nowMs) {
    if (this.state !== 'paused') return;
    this.state = 'running';
  }

  abandon() {
    if (this.state === 'succeeded' || this.state === 'failed') return;
    this.state = 'abandoned';
    this.endedAt = Date.now();
  }

  tick(nowMs) {
    // Primary failure is via scene.checkCollision() in main.js.
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
    this.cursor = (this.cursor + 1) % this.sequence.length;
    this._stableMidi = null;
    this._stableCount = 0;
    return 'accepted';
  }
}
