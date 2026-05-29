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
    this._queueingPaused = false;
    this._prevSafeTrack = null;
  }

  tick(game_now, speedMultiplier) {
    const { base_duration_ms, wave_spacing_factor, wave_lookahead_ms } = this._timingParams;

    if (!this._queueingPaused) {
      while (this._nextDeadlineMs < game_now + wave_lookahead_ms) {
        const gap = (base_duration_ms * wave_spacing_factor) / speedMultiplier;
        this._nextDeadlineMs += gap;
        const note = this._notes[this._nextWaveNoteIndex];
        this._waves.push(this._buildWave(note, this._nextDeadlineMs, speedMultiplier));
        this._nextWaveNoteIndex = (this._nextWaveNoteIndex + 1) % this._notes.length;
        this._totalWavesSpawned++;
      }
    }

    const pruneThreshold = game_now - 10000;
    this._waves = this._waves.filter(
      w => w.spawn_time_ms + w.duration_ms >= pruneThreshold
    );
  }

  pauseQueueing() {
    this._queueingPaused = true;
  }

  resumeQueueing(notes, startIndex = 0, baseFret = null, numLanes = null, gameNow = null) {
    this._notes = notes;
    this._nextWaveNoteIndex = notes.length > 0 ? startIndex % notes.length : 0;
    this._nextDeadlineMs = gameNow != null ? gameNow : 0;
    this._queueingPaused = false;
    this._prevSafeTrack = null;
    if (baseFret != null) this._baseFret = baseFret;
    if (numLanes != null) this._numLanes = numLanes;
    // Preserve in-flight outgoing-scale waves — they coexist with new-scale waves.
  }

  get queueingPaused() {
    return this._queueingPaused;
  }

  _buildWave(note, deadlineMs, speedMultiplier) {
    const { base_duration_ms } = this._timingParams;
    const basePxPerMs = 100.0 / base_duration_ms;
    const safeTrack = Math.max(0, Math.min(this._numLanes - 1, note.fret - this._baseFret));
    const requiresSlide = (this._prevSafeTrack !== null && safeTrack === this._prevSafeTrack);
    this._prevSafeTrack = safeTrack;
    const durationMs = base_duration_ms / speedMultiplier;
    const wave = {
      wave_id: `w-${this._totalWavesSpawned}`,
      wave_index: this._totalWavesSpawned,
      note_index: this._nextWaveNoteIndex,
      safe_track: safeTrack,
      safe_fret: note.fret,
      safe_midi: note.midi,
      note_name: note.name,
      safe_string: note.string ?? null,
      spawn_time_ms: deadlineMs - durationMs,
      speed_px_per_ms: basePxPerMs * speedMultiplier,
      duration_ms: durationMs,
      cleared: false,
      requires_slide: requiresSlide,
    };
    if (typeof window !== 'undefined' && window.pushGameEvent) {
      window.pushGameEvent('wave.spawn', { wave_id: wave.wave_id, note_index: wave.note_index, safe_track: wave.safe_track, safe_midi: wave.safe_midi });
    }
    return wave;
  }

  get waves() {
    return this._waves;
  }

  clearWavesForTesting() {
    this._waves = [];
  }

  reset(notes, startIndex = 0) {
    this._notes = notes;
    this._waves = [];
    this._nextDeadlineMs = 0;
    this._nextWaveNoteIndex = notes.length > 0 ? startIndex % notes.length : 0;
    this._totalWavesSpawned = 0;
    this._prevSafeTrack = null;
  }
}
