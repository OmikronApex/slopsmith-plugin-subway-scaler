// Note acceptance handler (Story 9-5 extraction from main.js).
// Processes audio detection events: safe-zone check, run acceptance, backend sync,
// score feedback, and variant proposal delegation.

import { Run } from './GameState.js';

export class NoteAcceptor {
  constructor({
    safeZoneRenderer,
    gameClient,
    scene,
    variantController,
    feedbackEl,
    pushGameEvent,
    debugLogger,
  }) {
    this.safeZoneRenderer = safeZoneRenderer;
    this.gameClient = gameClient;
    this.scene = scene;
    this.variantController = variantController;
    this.feedbackEl = feedbackEl;
    this.pushGameEvent = pushGameEvent;
    this.debugLogger = debugLogger;

    // External refs set by main.js after construction:
    this.run = null;
    this.setExpectedFn = null; // callback to update UI after cursor advance
    this.ascendingNoteCount = 0;
  }

  /**
   * Main detection handler — called by audio.onDetection().
   * Returns { accepted: boolean, result: string } for testability.
   */
  async handle(det, { run, nowFn, gameStartTime }) {
    this.run = run;
    if (!run || run.state !== 'running') return { accepted: false, result: 'not-running' };
    if (!det?.note || det.note.midi == null) return { accepted: false, result: 'no-note' };

    // Variant accept gate — delegated to variantController.
    // If accepted, the controller handles the full lifecycle; return early.
    const variantResult = await this.variantController.handleAccept(
      det, nowFn, gameStartTime, run
    );
    if (variantResult?.accepted) {
      if (this.debugLogger) this.debugLogger.log('variant.accept.accepted', { midi: det.note.midi });
      return { accepted: false, result: 'variant-accepted' };
    }
    if (variantResult === 'error' || variantResult === 'rejected' || variantResult === 'stale') {
      return { accepted: false, result: `variant-${variantResult}` };
    }

    // Standard note detection: safe zone adjacency check.
    if (!this.safeZoneRenderer.isAnyPrimarySafeZoneAdjacent(det.note.midi, run?.cursor)) {
      run.onMissOutsideWindow?.(det);
      return { accepted: false, result: 'not-adjacent' };
    }

    const prevIdx = run.cursor;
    const result = run.onDetection(det);

    if (result === 'accepted') {
      // Sync with backend
      const playResult = await this.gameClient.playNote(det.note.midi, nowFn() - run.startedAt);
      this.pushGameEvent('note.accepted', { midi: det.note.midi, cursor: prevIdx });
      if (this.debugLogger) this.debugLogger.log('note.accepted', {
        midi: det.note.midi, cursor: prevIdx,
        track: playResult?.game_state?.current_track,
      });

      if (playResult && playResult.success) {
        if (playResult.game_state?.current_track !== undefined) {
          this.scene.moveToTrack(playResult.game_state.current_track);
        }

        // Note-triggered variant proposal: root → RIGHT, apex → LEFT.
        // Delegates to variantController which checks guards internally.
        const passes = playResult.scale_passes_completed ?? 0;
        if (!this.variantController.activeVariant && !this.variantController.proposePending && passes >= 2) {
          const isRoot = prevIdx === 0;
          const isApex = this.ascendingNoteCount > 0 && prevIdx === this.ascendingNoteCount - 1;
          if (isRoot || isApex) {
            await this.variantController.tryPropose(prevIdx, this.ascendingNoteCount);
          }
        }
      }

      this.feedbackEl.textContent = '✓';
      if (this.setExpectedFn) this.setExpectedFn();
      return { accepted: true, result: 'accepted' };
    }

    if (result === 'rejected') {
      this.feedbackEl.textContent = '·';
      return { accepted: false, result: 'rejected' };
    }

    return { accepted: false, result };
  }
}