export class WaveScheduler {
  constructor(notes, timingParams, baseFret, numLanes) {
    this._notes = notes;
    this._timingParams = timingParams;
    this._baseFret = baseFret;
    this._numLanes = numLanes;
    this._waves = [];
    this._nextDeadlineMs = 0;
    this._nextWaveNoteIndex = 0;
    this._totalWavesSpawned = 0;
  }

  tick(game_now, speedMultiplier) {
    const { base_duration_ms, wave_spacing_factor, wave_lookahead_ms } = this._timingParams;

    while (this._nextDeadlineMs < game_now + wave_lookahead_ms) {
      const gap = (base_duration_ms * wave_spacing_factor) / speedMultiplier;
      this._nextDeadlineMs += gap;
      const note = this._notes[this._nextWaveNoteIndex];
      this._waves.push(this._buildWave(note, this._nextDeadlineMs, speedMultiplier));
      this._nextWaveNoteIndex = (this._nextWaveNoteIndex + 1) % this._notes.length;
      this._totalWavesSpawned++;
    }

    const pruneThreshold = game_now - 10000;
    this._waves = this._waves.filter(
      w => w.spawn_time_ms + w.duration_ms >= pruneThreshold
    );
  }

  _buildWave(note, deadlineMs, speedMultiplier) {
    const { base_duration_ms } = this._timingParams;
    const basePxPerMs = 100.0 / base_duration_ms;
    const safeTrack = Math.max(0, Math.min(this._numLanes - 1, note.fret - this._baseFret));
    const durationMs = base_duration_ms / speedMultiplier;
    return {
      wave_id: `w-${this._totalWavesSpawned}`,
      wave_index: this._totalWavesSpawned,
      safe_track: safeTrack,
      safe_midi: note.midi,
      note_name: note.name,
      safe_string: note.string ?? null,
      spawn_time_ms: deadlineMs - durationMs,
      speed_px_per_ms: basePxPerMs * speedMultiplier,
      duration_ms: durationMs,
      cleared: false,
    };
  }

  get waves() {
    return this._waves;
  }

  reset(notes) {
    this._notes = notes;
    this._waves = [];
    this._nextDeadlineMs = 0;
    this._nextWaveNoteIndex = 0;
    this._totalWavesSpawned = 0;
  }
}
