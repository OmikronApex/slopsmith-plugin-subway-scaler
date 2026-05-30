// Variant lifecycle controller (Story 9-4 extraction from main.js).
// Owns variant state machine: propose -> accept -> ride -> promote -> dismiss.
// Also manages transition phase state via TransitionPhases module.

import {
  setTransitionPhase,
  currentTransitionPhase,
} from './TransitionPhases.js';
import { stringToLaneIndex } from './ui/tokens.js';

export class VariantController {
  constructor({ gameClient, scene, waveScheduler, run, pushGameEvent }) {
    this.gameClient = gameClient;
    this.scene = scene;
    this.waveScheduler = waveScheduler;
    this.run = run;
    this.pushGameEvent = pushGameEvent;

    // Variant breather duration -- module-level for test overrides
    this._variantBreatherMs = 3000;

    // Variant state (mirrors backend -- feature 008-track-variants)
    this.proposePending = false;
    this.shownVariantId = null;
    this.activeVariant = null;
    this.activeWindow = null;
    this.variantPendingSpawn = null;  // { variant, targetNoteIndex, queuedAtMs }
    this.variantSpawnedForWave = null; // wave_id of wave we spawned for

    // Set externally by main.js from the start() closure.
    this.ascendingNoteCount = 0;
  }

  /** Reset all variant state (game over / restart). */
  reset() {
    this.proposePending = false;
    this.shownVariantId = null;
    this.activeVariant = null;
    this.activeWindow = null;
    this.variantPendingSpawn = null;
    this.variantSpawnedForWave = null;
    if (window.__gameState?.variant) {
      // Patch fields individually to preserve transitionPhase and other fields
      // added by TransitionPhases module — replacing the whole object clobbers them.
      window.__gameState.variant.id = null;
      window.__gameState.variant.timerMs = 0;
      window.__gameState.variant.timerRunning = false;
      window.__gameState.variant.timerExpired = false;
    }
  }

  /** Trigger variant proposal after a correct note at root or apex. */
  async tryPropose(prevIdx, ascendingNoteCount) {
    if (this.activeVariant || this.proposePending) return;
    // Guards set by caller before calling this.
    this.proposePending = true;
    try {
      const resp = await this.gameClient.proposeVariant();
      if (resp && resp.success) {
        this.pushGameEvent('variant.propose', {
          variant_id: resp.variant.variant_id,
          side: resp.variant.side,
          root_midi: resp.variant.root_midi,
        });
        this.activeVariant = resp.variant;
        this.activeWindow = resp.window;
        this.shownVariantId = resp.variant.variant_id;
        if (window.__gameState) {
          window.__gameState.variant.id = resp.variant.variant_id;
          window.__gameState.variant.timerRunning = true;
          window.__gameState.variant.timerMs = Math.max(
            0, resp.window.deadline_ms - Date.now()
          );
          window.__gameState.variant.timerExpired = false;
        }
        setTransitionPhase('proposed', { variant: resp.variant });
        this.queueVariantSpawn(resp.variant);
      }
    } finally {
      this.proposePending = false;
    }
  }

  /** Queue a wave-coupled variant spawn for the render loop to pick up. */
  queueVariantSpawn(variant) {
    if (this.variantPendingSpawn) return;
    const seqLen = this.run?.sequence?.length ?? 0;
    let targetNoteIndex =
      variant.side === 'RIGHT'
        ? (this.ascendingNoteCount ?? this.run?.sequence?.length ?? 1)
        : 1;
    // Clamp for degenerate sequences
    if (seqLen > 0 && (targetNoteIndex < 0 || targetNoteIndex >= seqLen)) {
      targetNoteIndex = 0;
    }
    this.variantPendingSpawn = {
      variant,
      targetNoteIndex,
      queuedAtMs: performance.now(),
    };
    this.variantSpawnedForWave = null;
  }

  /** Handle variant accept gate in detection handler. */
  async handleAccept(det, nowFn, gameStartTime, run) {
    if (!this.activeVariant || !this.activeWindow) return 'no-variant';
    if (det.note.midi !== this.activeWindow.trigger_midi) return 'wrong-midi';
    if (!this.scene.isVariantSafeZoneAdjacent?.()) return 'not-adjacent';

    let resp;
    try {
      resp = await this.gameClient.acceptVariant(det.note.midi);
    } catch (_) {
      if (currentTransitionPhase() !== 'proposed') return 'stale';
      this._dismissCleanup('accept-failed');
      return 'error';
    }

    if (resp && resp.success) {
      this.pushGameEvent('variant.accept', {
        variant_id: this.activeVariant?.variant_id ?? resp.variant_id,
        midi: det.note.midi,
      });
      // Reset breather for new scale's timing
      if (resp.timing_params?.variant_breather_ms) {
        this._variantBreatherMs = resp.timing_params.variant_breather_ms;
      }
      return { accepted: true, resp };
    }

    // Backend rejected
    if (currentTransitionPhase() !== 'proposed') return 'stale';
    this._dismissCleanup('accept-rejected');
    return 'rejected';
  }

  /** Handle variant lifecycle updates from poll response. */
  onPollUpdate(pollState, currentPhase, nowFn, gameStartTime) {
    const prevVariant = this.activeVariant;
    this.activeVariant = pollState.active_variant || null;
    this.activeWindow = pollState.active_window || null;

    // Polling-driven dismiss
    if (prevVariant && !this.activeVariant && currentPhase === 'proposed') {
      if (this.waveScheduler.queueingPaused) {
        this.waveScheduler.resumeQueueing(
          this.run?.sequence, this.run?.cursor,
          null, null, nowFn() - gameStartTime
        );
      }
      setTransitionPhase('idle', { reason: 'dismissed' });
      this.shownVariantId = null;
      this.variantPendingSpawn = null;
      this.variantSpawnedForWave = null;
    }

    if (window.__gameState) {
      window.__gameState.variant.id = this.activeVariant
        ? this.activeVariant.variant_id : null;
      window.__gameState.variant.timerRunning = !!(
        this.activeVariant && this.activeWindow &&
        this.activeWindow.state === 'OPEN' &&
        Date.now() < this.activeWindow.deadline_ms
      );
      window.__gameState.variant.timerMs = this.activeWindow
        ? Math.max(0, this.activeWindow.deadline_ms - Date.now()) : 0;
    }

    // Queue spawn if variant exists but not yet shown
    if (
      this.activeVariant &&
      this.shownVariantId !== this.activeVariant.variant_id
    ) {
      this.shownVariantId = this.activeVariant.variant_id;
      this.queueVariantSpawn(this.activeVariant);
    }
  }

  /** Proximity-based dismiss handler. */
  handleMissed(nowFn, gameStartTime) {
    const missPhase = currentTransitionPhase();
    if (missPhase !== 'proposed' && missPhase !== 'riding') return;
    if (!this.activeVariant) return;

    this.gameClient.dismissVariant().catch(() => {});
    if (this.waveScheduler.queueingPaused) {
      this.waveScheduler.resumeQueueing(
        this.run?.sequence, this.run?.cursor,
        null, null, nowFn() - gameStartTime
      );
    }
    setTransitionPhase('idle', { reason: 'missed' });
    this._dismissCleanup('missed');
  }

  /** Check and process wave-coupled variant spawn in the render loop. */
  processVariantSpawn(waves, gameNow) {
    if (!this.variantPendingSpawn) return;

    const targetIdx = this.variantPendingSpawn.targetNoteIndex;
    const targetWave = waves
      .filter(
        w =>
          w.note_index === targetIdx &&
          w.spawn_time_ms + w.duration_ms >= gameNow
      )
      .sort((a, b) => a.spawn_time_ms - b.spawn_time_ms)[0] ?? null;

    // Timeout guard
    if (
      !targetWave &&
      this.variantPendingSpawn.queuedAtMs != null &&
      performance.now() - this.variantPendingSpawn.queuedAtMs > 15000
    ) {
      if (currentTransitionPhase() !== 'proposed') {
        this.variantPendingSpawn = null;
        this.variantSpawnedForWave = null;
        return;
      }
      this.gameClient.dismissVariant().catch(() => {});
      if (this.waveScheduler.queueingPaused) {
        this.waveScheduler.resumeQueueing(
          this.run?.sequence, this.run?.cursor,
          null, null, performance.now()
        );
      }
      setTransitionPhase('idle', { reason: 'spawn-timeout' });
      this._dismissCleanup('timeout');
      return;
    }

    if (
      targetWave &&
      targetWave.wave_id !== this.variantSpawnedForWave
    ) {
      const anchorIdx = targetWave.note_index - 1;
      const anchorNote =
        anchorIdx >= 0 && this.run?.sequence?.[anchorIdx]
          ? this.run.sequence[anchorIdx]
          : null;
      const anchorWave = waves
        .filter(
          w =>
            w.note_index === anchorIdx &&
            w.spawn_time_ms <= targetWave.spawn_time_ms
        )
        .sort((a, b) => b.spawn_time_ms - a.spawn_time_ms)[0] ?? null;
      this.scene.proposeVariantTracks?.(
        this.variantPendingSpawn.variant,
        targetWave,
        anchorNote,
        anchorWave
      );
      this.variantSpawnedForWave = targetWave.wave_id;
      this.variantPendingSpawn = null;
    }
  }

  // ── Internal helpers ──

  _dismissCleanup(reason) {
    if (this.waveScheduler.queueingPaused) {
      this.waveScheduler.resumeQueueing(
        this.run?.sequence, this.run?.cursor,
        null, null, performance.now()
      );
    }
    this.shownVariantId = null;
    this.activeVariant = null;
    this.activeWindow = null;
    this.variantPendingSpawn = null;
    this.variantSpawnedForWave = null;
    if (window.__gameState) {
      window.__gameState.variant.id = null;
      window.__gameState.variant.timerRunning = false;
      window.__gameState.variant.timerMs = 0;
    }
  }
}