// Transition phase state machine for Epic 6 variant cinematic (Story 6.1).
// Tracks the variant accept → cinematic → active flow.

const _listeners = [];
const _cleanups = [];
let _phase = 'idle';

const PHASE_ORDER = ['idle', 'proposed', 'accepted', 'riding', 'breather', 'promoting', 'active'];

export function setTransitionPhaseListener(cb) {
  _listeners.push(cb);
}

export function registerPhaseCleanup(phase, cleanupFn) {
  _cleanups.push({ phase, fn: cleanupFn });
}

export function setTransitionPhase(next, ctx = {}) {
  const prev = _phase;

  // Warn on likely-bug transitions (skipping intermediate phases), except * → idle (always valid).
  if (next !== 'idle') {
    const prevIdx = PHASE_ORDER.indexOf(prev);
    const nextIdx = PHASE_ORDER.indexOf(next);
    if (prevIdx >= 0 && nextIdx >= 0 && nextIdx > prevIdx + 1) {
      console.warn(`[transition-phase] skipping phases: ${prev} → ${next}`);
    }
  }

  // Phase-exit cleanup — always fires before listeners, including on error/dismiss paths.
  for (const c of _cleanups) {
    if (c.phase === prev) {
      try { c.fn(); } catch (e) { console.error('[transition-phase] cleanup error', e); }
    }
  }

  _phase = next;
  if (window.__gameState?.variant) {
    window.__gameState.variant.transitionPhase = next;
  }

  for (const cb of _listeners) {
    try { cb(next, prev, ctx); } catch (e) { console.error('[transition-phase] listener error', e); }
  }
}

export function currentTransitionPhase() {
  return _phase;
}

export function resetTransitionPhase() {
  _phase = 'idle';
  _listeners.length = 0;
  _cleanups.length = 0;
}
