// Subway Scaler game bootstrap.
// Wires the menu UI, run lifecycle, audio pipeline, run state machine, and 3D scene.

import { createScene } from './SceneManager.js';
import { startAudio } from './AudioDetector.js';
import { Run, difficultyToTimePerNoteMs } from './GameState.js';
import {
  setTransitionPhase,
  setTransitionPhaseListener,
  registerPhaseCleanup,
  currentTransitionPhase,
  resetTransitionPhase,
} from './TransitionPhases.js';
import { quantize, midiToName } from './notes.js';
import { GameClient } from './game-client.js';
import { DebugLogger } from './DebugLogger.js';
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js';
import { laneX, SPAWN_Z } from './TrackSystem.js';

// Cinematic refinement constants (Story 6.8) — mirror SceneManager values.
const MAX_BEND_YAW = Math.PI / 4;
const DIAG_CROSS_MS = 1200;
const FIRST_WAVE_ARRIVAL_DELAY_MS = 500;
const REPOSITION_SLIDE_MS = 400;
const DIAG_LEN = 45;
const LANE_W = 1.4;

// URL-driven test-mode keyboard shortcuts (Story 6.8 T12).
// Setting window.__TEST_MODE here ensures the _test.playNote hook (gated on it later
// in bootstrap) gets wired — without this, Q/W keydown finds no injection target.
const TEST_MODE = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('testMode');
if (TEST_MODE && typeof window !== 'undefined') {
  window.__TEST_MODE = true;
}
import { injectTokens } from './ui/tokens.js';
import { renderSetupScreen } from './ui/setup.js';
import { OverlayManager } from './ui/overlay.js';
import { WaveScheduler } from './WaveScheduler.js';

const API = '/api/plugins/subway-scaler';
const STATIC = '/plugins/subway-scaler/static/game';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + r.status));
  return data;
}


export async function bootstrap(root) {
  // Inject design tokens (CSS custom properties) at initialization
  injectTokens();

  // Initialize audio state observable for E2E tests (story 0-2a)
  window.__audioState = {
    micActive: false,
    pipelineReady: false,
    lastDetectedNote: null,
    detectionConfidence: 0,
    streamType: null,
  };

  // Structured event log for E2E test observability (Story 6.7).
  function pushGameEvent(type, data = {}) {
    if (!window.__gameEvents) window.__gameEvents = [];
    window.__gameEvents.push({ type, time: _now(), timestamp: Date.now(), data });
  }
  window.pushGameEvent = pushGameEvent;

  // Test-mode clock override: set window.__fakeGameClock (game-relative ms) to drive deterministically.
  const _now = () => window.__TEST_MODE && window.__fakeGameClock != null
    ? window.__fakeGameClock
    : performance.now();

  // Initialize game state observable for E2E tests (story 0-5)
  window.__TEST_MODE = window.__TEST_MODE ?? false;
  window.__gameState = {
    version: '1.0.0',
    timestamp: Date.now(),
    loop: { running: false, frameCount: 0, deltaTime: 0 },
    character: { positionX: 0, positionY: 0, velocityX: 0, velocityY: 0, state: 'idle' },
    scene: { waveCount: 0 },
    score: { current: 0, highScore: 0, distanceTraveled: 0 },
    collision: { lastCollisionType: null, lastCollisionTimestamp: null, invincibilityFrames: 0, lastDebug: null, waveCount: 0, charTrack: null },
    gameOver: { isGameOver: false, reason: null, triggeredAt: null },
    session: { phase: 'idle', pauseCount: 0, totalPausedMs: 0 },
    variant: { id: null, timerMs: 0, timerRunning: false, timerExpired: false, safeZoneZ: null, transitionPhase: 'idle' },
    lastDetectedNote: null,
    _test: { forceCollision: null, triggerPause: null, resetGame: null, setVariant: null },
  };
  pushGameEvent('init');

  // Persistent RAF loop keeps loop.frameCount ticking for E2E liveness checks
  (function _bgLoop(last) {
    requestAnimationFrame((now) => {
      if (window.__gameState) {
        window.__gameState.loop.frameCount++;
        window.__gameState.loop.deltaTime = last ? now - last : 0;
        window.__gameState.timestamp = Date.now();
      }
      _bgLoop(now);
    });
  })(0);

  if (!root) return;
  root.innerHTML = '';
  root.className = 'subway-scaler';

  const shell = el('div', { class: 'game-shell' });
  root.appendChild(shell);

  let scales = [];
  let instruments = [];
  let settings = null;
  try {
    [scales, instruments, settings] = await Promise.all([
      fetchJson(`${API}/scales`).then(d => d.scales),
      fetchJson(`${API}/instruments`).then(d => d.instruments),
      fetchJson(`${API}/settings`),
    ]);
  } catch (err) {
    root.appendChild(el('div', { class: 'error-panel' }, `Failed to load plugin data: ${err.message}`));
    return;
  }

  // Helper: show / hide the setup screen vs. game wrap
  function showMenu() {
    Array.from(shell.children).forEach(child => {
      if (child.classList && child.classList.contains('setup-container')) child.style.display = '';
      if (child.classList && child.classList.contains('game-wrap')) child.style.display = 'none';
    });
  }

  // Helper: pause the run and show the pause overlay
  function pauseGame(reason = 'normal') {
    if (!run || run.state !== 'running') return;
    pushGameEvent('game.pause', { reason });
    if (_debugLogger) _debugLogger.log('game.pause', { reason });
    _pauseReason = reason;
    run.pause(performance.now());
    if (audio) audio.pause();
    pauseBtn.textContent = 'Resume';
    if (window.__gameState) window.__gameState.session.phase = 'paused';
    gameClient.pause().catch(() => {});
    overlayMgr.show({ type: 'pause', reason });
  }

  // Helper: resume the run and hide the overlay
  async function resumeGame() {
    if (!run || run.state !== 'paused') return;
    pushGameEvent('game.resume');
    if (_debugLogger) _debugLogger.log('game.resume');
    const reason = _pauseReason;
    _pauseReason = 'normal';
    if (reason === 'audio-error' && audio) {
      try {
        await audio.switchInput(state.audio.deviceId);
      } catch (_err) {
        _pauseReason = 'audio-error';
        pauseGame('audio-error');
        return;
      }
    }
    run.resume(performance.now());
    if (audio) audio.resume();
    pauseBtn.textContent = 'Pause';
    if (window.__gameState) window.__gameState.session.phase = 'playing';
    gameClient.resume().catch(() => {});
  }

  // Overlay manager — wired before game starts so restart/quit work in any phase
  const overlayMgr = new OverlayManager({
    onResume: resumeGame,
    onRestart: () => {
      const inst = currentInstrument();
      if (inst && inst.tuning && inst.tuning[0]) {
        state.rootMidi = inst.tuning[0] + 5; // always 5th fret of lowest string
      }
      cleanup();
      start();
    },
    onMainMenu: () => {
      if (run) { run.abandon(); }
      cleanup();
      showMenu();
    },
  });

  // Setup screen callback: initialize game once session-config succeeds
  async function onSetupComplete(sessionConfig) {
    // Update state with values from setup
    state.rootMidi = sessionConfig.root_midi;
    state.scaleId = sessionConfig.scale_id;
    state.instrumentId = sessionConfig.instrument_id;
    state.debugLogging = !!sessionConfig.debug_logging;

    // Difficulty is client-only, read from localStorage
    try {
      const stored = localStorage.getItem('subway-scaler-settings');
      const settings = stored ? JSON.parse(stored) : {};
      state.difficulty = settings.difficulty || 'medium';
    } catch (e) {
      state.difficulty = 'medium';
    }

    // Persist settings
    const merged = {
      lastScaleId: state.scaleId,
      lastRootMidi: state.rootMidi,
      lastDifficulty: state.difficulty,
      strictOctave: state.strictOctave,
      instrumentId: state.instrumentId,
      strictTuning: state.strictTuning,
      audio: state.audio,
    };
    fetchJson(`${API}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).catch(() => {});

    // Hide setup, show game, then auto-start the run
    const allChildren = Array.from(shell.children);
    allChildren.forEach(child => {
      if (child.classList && child.classList.contains('setup-container')) {
        child.style.display = 'none';
      }
      if (child.classList && child.classList.contains('game-wrap')) {
        child.style.display = 'block';
      }
    });
    start();
  }

  // Render setup screen into the shell (renderSetupScreen clears shell and appends setup-container)
  renderSetupScreen(shell, scales, instruments, onSetupComplete);

  // --- Game state (populated after setup screen) ---
  let state = {
    scaleId: settings.lastScaleId,
    rootMidi: settings.lastRootMidi,
    difficulty: settings.lastDifficulty,
    strictOctave: settings.strictOctave,
    instrumentId: settings.instrumentId || 'guitar-standard',
    strictTuning: !!settings.strictTuning,
    invincible: false,
    audio: { ...settings.audio },
  };

  function currentInstrument() {
    return instruments.find(i => i.id === state.instrumentId) || instruments[0];
  }

  // --- Game container ---
  const canvas = el('canvas', { class: 'game-canvas', width: '800', height: '450' });
  const hud = el('div', { class: 'hud' });
  const expectedEl = el('div', { class: 'expected' });
  const feedbackEl = el('div', { class: 'feedback' });
  const overlay = el('div', { class: 'overlay hidden' });
  const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause');
  hud.appendChild(expectedEl);
  hud.appendChild(feedbackEl);
  hud.appendChild(pauseBtn);
  // game-wrap fills the shell absolutely; canvas, overlay, hud all position within it.
  const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay, hud);
  shell.appendChild(gameWrap);
  overlayMgr.mount(gameWrap);

  const scene = createScene(canvas);

  // Keep Three.js renderer resolution in sync with the shell's actual pixel size
  new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      scene.resize(width, height);
    }
  }).observe(shell);

  // Grab the microphone on the setup screen so it's ready when the game starts.
  // Errors are handled silently here; start() will surface them if audio is still null.
  startAudio({ deviceId: state.audio.deviceId })
    .then(a => { audio = a; })
    .catch(() => {});

  const gameClient = new GameClient(API);
  const safeZoneRenderer = new SafeZoneRenderer(scene.threeScene || scene.scene);

  const debugOn = typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search);
  const fretHud = debugOn ? el('div', { class: 'fret-hud', style: 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;font:11px monospace;padding:2px 4px;border-radius:3px;' }) : null;
  if (fretHud) gameWrap.appendChild(fretHud);

  let currentScenicInstrumentId = null;
  function applyInstrument() {
    const inst = currentInstrument();
    if (!inst) return null;
    if (inst.id !== currentScenicInstrumentId) {
      scene.setInstrument(inst);
      currentScenicInstrumentId = inst.id;
    }
    return inst;
  }
  applyInstrument();

  let run = null;
  let audio = null;
  let _pauseReason = 'normal';
  let rafId = null;
  let _onDetection = null;           // set by start(); exposed to _test.playNote hook
  let _runAcceptTransitionFn = null; // set by start(); exposed to _test hooks
  let _waveScheduler = null;         // set by start(); exposed to _test.clearSceneWaves() (Story 6.7)
  let _perFrameHook = null;          // called each RAF frame; used by breather phase (Story 6.4)
  let _variantBreatherMs = 3000;     // module-level so _test.setBreatherMs() can override (Story 6.7)
  let _debugLogger = null;          // debug logger (set by start(); flushes JSONL to server /logs/)
  let prevFretPos = null;

  // Variant state mirrors backend (feature 008-track-variants).
  // shownVariantId tracks which variant we've already rendered in the scene.
  let proposePending = false;
  let shownVariantId = null;
  let activeVariant = null; // last seen from polling
  let activeWindow = null;
  // Wave-coupled spawn: set when variant is proposed; cleared once the target wave is found.
  let variantPendingSpawn = null;  // { variant, targetNoteIndex }
  let variantSpawnedForWave = null; // wave_id of the wave we already spawned for

  function updateVariantHud() {
    // Variant HUD retired — transition track geometry is the sole signal.
  }

  function rangeWarning(notes) {
    const inst = currentInstrument();
    const min = inst.tuning[0] + 1;
    const max = 96;
    for (const n of notes) {
      if (n.midi < min || n.midi > max) return `Note ${n.name} (MIDI ${n.midi}) is outside the supported range for this instrument (${midiToName(min)}–${midiToName(max)}).`;
    }
    return null;
  }

  function setExpected() {
    if (!run || !run.currentExpected()) return;
    const exp = run.currentExpected();
    expectedEl.textContent = `Play: ${exp.note.name}`;
    const upcoming = run.upcoming(3).map(e => e.name);
    scene.setUpcomingNotes(upcoming);
  }

  async function start() {
    if (run && run.state === 'running') return;
    feedbackEl.textContent = '';
    
    try {
      const notesResp = await gameClient.start(state.scaleId, state.difficulty, {
        rootMidi: state.rootMidi,
        instrumentId: state.instrumentId
      });
      const rangeMsg = rangeWarning(notesResp.notes || []);
      if (rangeMsg) {
        showOverlay(`Cannot start: ${rangeMsg}`);
        cleanup();
        return;
      }
      // Persist last-used settings
      const merged = {
        lastScaleId: state.scaleId,
        lastRootMidi: state.rootMidi,
        lastDifficulty: state.difficulty,
        strictOctave: state.strictOctave,
        instrumentId: state.instrumentId,
        strictTuning: state.strictTuning,
        audio: state.audio,
      };
      fetchJson(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      }).catch(() => {});

      // Apply selected instrument before the run starts; reset resolver history.
      applyInstrument();
      // reset BEFORE setBaseFret so _worldOffsetX (cleared by reset) is 0 when
      // setBaseFret rebuilds tracks — otherwise restart inherits the prior game's
      // variant offset and tracks spawn off-center.
      scene.reset();
      if (notesResp.base_fret !== undefined) {
        scene.setBaseFret(notesResp.base_fret, notesResp.num_lanes);
      }
      safeZoneRenderer.reset();
      if (notesResp.initial_track !== undefined) {
        scene.moveToTrack(notesResp.initial_track, true);
      }
      prevFretPos = null;

      const timePerNoteMs = difficultyToTimePerNoteMs(state.difficulty);
      run = new Run({
        sequence: notesResp.notes,
        timePerNoteMs,
        strictOctave: state.strictOctave,
        stabilityFrames: state.audio.stabilityFrames,
        toleranceCents: state.audio.toleranceCents,
        confidenceThreshold: state.audio.confidenceThreshold,
      });
      setExpected();

      const waveScheduler = new WaveScheduler(
        notesResp.notes,
        notesResp.timing_params,
        notesResp.base_fret,
        notesResp.num_lanes,
      );
      _waveScheduler = waveScheduler;
      pushGameEvent('game.start', { difficulty: state.difficulty, base_fret: notesResp.base_fret, num_lanes: notesResp.num_lanes });

      // File-based debug logger (activated by setup checkbox).
      const debugLogger = new DebugLogger(notesResp.session_id, state.debugLogging, 0);
      _debugLogger = debugLogger;
      debugLogger.log('game.start', { difficulty: state.difficulty, session_id: notesResp.session_id });

      // ascending_note_count: index where descending begins in the note sequence.
      // Mutable — updated after each variant accept when the new scale may differ.
      let ascendingNoteCount = notesResp.ascending_note_count;

      // Root and apex notes for variant safe zone positioning (same string, 2-fret shift).
      let rootNote = notesResp.notes?.[0] ?? null;
      let apexNote = (ascendingNoteCount > 0 && notesResp.notes)
        ? notesResp.notes[ascendingNoteCount - 1] : null;

      // Transition phase machine (Story 6.1) — reset on each game start, then register
      // default listeners that drive the synchronous accept waterfall. Later stories
      // replace individual listeners with async, animation-driven variants.
      resetTransitionPhase();
      if (window.__gameState?.variant) {
        window.__gameState.variant.transitionPhase = 'idle';
      }

      // Universal phase change logger (debug-logging).
      setTransitionPhaseListener((next, prev) => {
        if (_debugLogger) _debugLogger.log('phase.change', { from: prev, to: next });
      });

      // Default accepted → riding: soft halt, then advance phase.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'accepted') return;
        waveScheduler.pauseQueueing();
        setTransitionPhase('riding', ctx);
      });

      // Riding phase (Story 6.8 rewrite): wait on the straight section for the outgoing
      // corner to reach the player; then snap character yaw, ease camera, time-lerp X to
      // landingX, schedule early new-scale spawn, and on landing fire promote + sync exit.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'riding') return;
        const info = scene.getVariantInfo();
        scene.setCameraMode('riding');
        // Disable miss callback only — keep mesh so it scrolls away naturally (AC-2).
        scene.disableVariantMissCallback?.();
        if (!info) {
          // No variant geometry (test/edge path): straight to promoting.
          setTransitionPhase('promoting', ctx);
          return;
        }
        scene.setCharacterTargetX(info.variantX);
        scene.clearBendMidpointCallback();
        let _cornerFired = false;
        _perFrameHook = () => {
          if (_cornerFired) return;
          if (!scene.isOutgoingCornerAtPlayer()) return;
          _cornerFired = true;
          const cornerTime = performance.now();
          const { variantX, side } = scene.getVariantInfo() || info;
          const sign = side === 'RIGHT' ? 1 : -1;
          const landingX = variantX + sign * DIAG_LEN;

          // Cinematic duration derived from actual wave-scroll speed so the
          // character X lerp finishes exactly when the outgoing diagonal's back
          // edge reaches the player (DIAG_LEN units of group-scroll). Static
          // DIAG_CROSS_MS drifted relative to the geometry at non-default tempos.
          const waveSpeed = scene.getLastWaveSpeed() || 0.05;
          const dynamicDiagMs = DIAG_LEN / (waveSpeed * 0.5);

          // Character snap + camera target (AC-4). Camera 45° pivot uses the
          // SceneManager default (250ms) — slow enough to read as a deliberate
          // camera move, fast enough to land before the diagonal scrolls far.
          scene.snapCharacterYaw(sign * MAX_BEND_YAW);
          scene.setRidingCameraTarget(sign * MAX_BEND_YAW);

          // Early spawn (AC-5): time wave arrival to land at FIRST_WAVE_ARRIVAL_DELAY_MS post-landing.
          // newScaleCenterX: near edge of new scale at landingX (AC-5 formula).
          // Scene propagates this as _worldOffsetX so subsequent wave/collision/lane logic
          // operates in offset coords automatically.
          const T_travel = Math.abs(SPAWN_Z) / (waveSpeed * 0.5);
          const spawnDelayMs = dynamicDiagMs - T_travel + FIRST_WAVE_ARRIVAL_DELAY_MS;
          const resp = ctx?.resp;
          const newBase = resp?.base_fret ?? notesResp.base_fret;
          const newLanes = resp?.num_lanes ?? notesResp.num_lanes;
          const newScaleCenterX = landingX + sign * (newLanes - 1) / 2 * LANE_W;
          const doSpawn = () => scene.spawnVariantTracks(newBase, newLanes, waveSpeed, newScaleCenterX);
          if (spawnDelayMs <= 0) doSpawn();
          else setTimeout(doSpawn, spawnDelayMs);

          // Fire promote NOW (don't await) so the new-scale waves can be scheduled
          // during the cinematic rather than at landing. Pre-staging the scheduler
          // with gameNow=landingGameNow puts the first wave at the same spawn_time
          // it would get at a landing-time resume — but the wave meshes start
          // appearing at SPAWN_Z mid-cinematic and scroll smoothly into view.
          //
          // landingGameNow is then shifted EARLIER by 1.5 wave-gaps so the first
          // new wave arrives sooner after landing (default scheduler timing put
          // first arrival a full gap past landing+REPOSITION; that felt late).
          const tp = notesResp.timing_params;
          const waveGapMs = (tp?.base_duration_ms ?? 4000) * (tp?.wave_spacing_factor ?? 0.5);
          const landingGameNow =
            (_now() - gameStartTime) + dynamicDiagMs + REPOSITION_SLIDE_MS - 1.5 * waveGapMs;
          const promotePromise = gameClient.promoteVariant().catch(err => {
            console.error('[main] promote error', err);
            return null;
          });
          promotePromise.then(resp => {
            if (!resp || !resp.success) return;
            // Drop in-flight old-scale waves from the scheduler — their meshes
            // keep scrolling (setWaves' "wave gone but still in front" path)
            // until they pass the player; finalizeVariantTransition at landing
            // hard-cleans whatever remains.
            waveScheduler.clearWavesForTesting();
            waveScheduler.resumeQueueing(resp.notes, resp.current_note_index ?? 0, resp.base_fret, resp.num_lanes, landingGameNow);
          });

          // X lerp (AC-4) + landing handler (AC-6/7/8). Duration matches the
          // diagonal piece's scroll-through time → no drift; character reaches
          // landingX exactly when the diagonal's back edge passes the player.
          _perFrameHook = () => {
            const p = Math.min(1, (performance.now() - cornerTime) / dynamicDiagMs);
            scene.setCharacterX(variantX + (landingX - variantX) * p);
            if (p >= 1) {
              _perFrameHook = null;
              onDiagComplete(landingX, sign, ctx, promotePromise);
            }
          };
        };
      });

      async function onDiagComplete(landingX, sign, ctx, promotePromise) {
        // promotePromise was kicked off at corner-fire so the scheduler could be
        // pre-staged during the cinematic. Await it here only to read the values
        // we need for the exit slide.
        const resp = await promotePromise;
        if (!resp || !resp.success) {
          scene.clearCinematicExit?.();
          scene.setCameraMode('default');
          waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0);
          setTransitionPhase('idle', ctx);
          return;
        }

        // Compute the target X = the character's actual lane in the new scale, in the
        // OFFSET coord system established by AC-5 (laneX is center-0; world offset added).
        // REPOSITION_SLIDE_MS slides char from landingX → final lane position.
        const newNumLanes = resp.num_lanes ?? notesResp.num_lanes;
        const currentTrack = resp.current_track ?? 0;
        const worldOffsetX = scene.getWorldOffsetX?.() ?? 0;
        const targetX = laneX(currentTrack, newNumLanes) + worldOffsetX;

        scene.startCinematicExit(targetX, REPOSITION_SLIDE_MS);

        setTimeout(() => {
          scene.setCameraMode('default');
          applyPromoteResponse(resp, ctx);
        }, REPOSITION_SLIDE_MS);
      }

      function applyPromoteResponse(resp, ctx) {
        // Force-finalize the cinematic exit lerp BEFORE writing character.position.x,
        // otherwise the next render frame's clamped p=1 overwrites our moveToTrack
        // value back to landingX (Story 6.8 bugfix — caused instant collision).
        scene.clearCinematicExit?.();
        // Park the default-mode camera at the new world offset so it stays with the
        // offset tracks once cinematic exit hands control back (Story 6.8 AC-5).
        scene.setTargetCameraX?.(scene.getWorldOffsetX?.() ?? 0);
        // Demote in-flight pre-variant waves to visual-only — they live in the old
        // world frame and would otherwise collide with the character who is now in
        // the new frame.
        scene.ghostExistingWaves?.();
        // Tear down retiring tracks + remove old-frame ghost wave meshes.
        // Scheduler was already pre-staged at corner-fire so new waves are
        // mid-scroll by now; we do NOT reset the scheduler or safe-zone
        // renderer here (that would wipe the pre-staged new state).
        scene.finalizeVariantTransition?.();
        const startIdx = resp.current_note_index ?? 0;
        if (run && resp.notes) {
          run.sequence = resp.notes;
          run.cursor = startIdx;
          setExpected();
        }
        if (resp.ascending_note_count != null) {
          ascendingNoteCount = resp.ascending_note_count;
        }
        if (resp.notes) {
          rootNote = resp.notes[0] ?? null;
          apexNote = ascendingNoteCount > 0 ? resp.notes[ascendingNoteCount - 1] : null;
        }
        if (resp.current_track != null) {
          scene.moveToTrack(resp.current_track, true);
        }
        if (resp.base_fret != null && resp.num_lanes != null) {
          scene.setLaneGeometry(resp.base_fret, resp.num_lanes);
        }
        pushGameEvent('variant.promote', { base_fret: resp.base_fret, num_lanes: resp.num_lanes, note_index: startIdx });
        if (_debugLogger) _debugLogger.log('variant.promote', { base_fret: resp.base_fret, num_lanes: resp.num_lanes, note_index: startIdx, current_track: resp.current_track });
        // Do NOT call safeZoneRenderer.reset() — it wipes the cached-X per-wave
        // mesh state we rely on so in-flight old-scale safe zones stay at their
        // original X. They despawn naturally as their wave passes.
        setTransitionPhase('active', ctx);
      }

      // Phase-exit cleanup: reset camera mode and clear hooks on any riding exit.
      registerPhaseCleanup('riding', () => {
        scene.clearBendMidpointCallback();
        scene.setCameraMode('default');
        if (_perFrameHook) { _perFrameHook = null; }
      });

      // Breather: hold until timer expires AND all outgoing waves have cleared (Story 6.4).
      // _variantBreatherMs is module-level so _test.setBreatherMs() can override for tests.
      _variantBreatherMs = notesResp.timing_params?.variant_breather_ms ?? 3000;
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'breather') return;
        const breatherStartMs = performance.now();
        const resp = ctx.resp;

        _perFrameHook = () => {
          const timerExpired = performance.now() - breatherStartMs >= _variantBreatherMs;
          const wavesCleared = scene.getActiveWaveCount() === 0;
          if (timerExpired && wavesCleared) {
            _perFrameHook = null;
            if (_debugLogger) _debugLogger.log('breather.complete', { timerExpired, activeWaveCount: scene.getActiveWaveCount() });
            const spawnSpeed = scene.getLastWaveSpeed();
            const newBase = resp?.base_fret ?? notesResp.base_fret;
            const newLanes = resp?.num_lanes ?? notesResp.num_lanes;
            scene.spawnVariantTracks(newBase, newLanes, spawnSpeed);
            scene.setOnTracksLanded(() => setTransitionPhase('promoting', ctx));
          }
        };
        registerPhaseCleanup('breather', () => { _perFrameHook = null; });
      });

      // Default promoting → active: call /variant/promote to commit scale swap.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'promoting') return;
        gameClient.promoteVariant().then((resp) => {
          if (!resp || !resp.success) {
            console.error('[main] promote failed', resp);
            waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0);
            setTransitionPhase('idle', ctx);
            return;
          }
          const startIdx = resp.current_note_index ?? 0;
          if (run && resp.notes) {
            run.sequence = resp.notes;
            run.cursor = startIdx;
            setExpected();
          }
          if (resp.ascending_note_count != null) {
            ascendingNoteCount = resp.ascending_note_count;
          }
          if (resp.notes) {
            rootNote = resp.notes[0] ?? null;
            apexNote = ascendingNoteCount > 0 ? resp.notes[ascendingNoteCount - 1] : null;
            const gameNow = _now() - gameStartTime;
            waveScheduler.resumeQueueing(resp.notes, startIdx, resp.base_fret, resp.num_lanes, gameNow);
          }
          // Snap character from variant track X to the correct main-track lane (Story 6.6 bugfix).
          if (resp.current_track != null) {
            scene.moveToTrack(resp.current_track, true);
          }
          // Sync scene lane geometry with new scale (numLanes may differ from original).
          if (resp.base_fret != null && resp.num_lanes != null) {
            scene.setLaneGeometry(resp.base_fret, resp.num_lanes);
          }
          pushGameEvent('variant.promote', { base_fret: resp.base_fret, num_lanes: resp.num_lanes, note_index: startIdx });
          if (_debugLogger) _debugLogger.log('variant.promote', { base_fret: resp.base_fret, num_lanes: resp.num_lanes, note_index: startIdx, current_track: resp.current_track });
          safeZoneRenderer.reset();
          setTransitionPhase('active', ctx);
        }).catch((err) => {
          console.error('[main] promote error', err);
          waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0);
          setTransitionPhase('idle', ctx);
        });
      });

      // Default active: reset variant tracking state.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'active') return;
        shownVariantId = null;
        activeVariant = null;
        activeWindow = null;
        variantPendingSpawn = null;
        variantSpawnedForWave = null;
        updateVariantHud();
      });

      function runAcceptTransition(resp) {
        setTransitionPhase('accepted', { resp });
      }
      _runAcceptTransitionFn = runAcceptTransition;

      // Start the rendering loop so we can see the initial state
      let _pausedAt = null;
      let gameStartTime = 0; // set after audio setup so countdownStart is accurate
      const loop = (now) => {
        if (!run) return;

        // Use visual collision detection as the primary failure source.
        // Invincible mode (debug): skip the failure transition entirely.
        // Also skip during cinematic transition: character is on the variant lane and
        // old-scale waves have primary-lane safe zones, so collision is expected but not fatal.
        const _inTransition = ['accepted','riding','breather','promoting'].includes(currentTransitionPhase());
        if (run.state === 'running' && !state.invincible && !_inTransition) {
          const collided = scene.checkCollision();
          if (window.__gameState) {
            window.__gameState.collision.waveCount = scene.getActiveWaveCount();
            window.__gameState.collision.charTrack = run?.cursor ?? null;
            window.__gameState.collision.lastDebug = scene.getLastCollisionDebug?.() ?? null;
          }
          if (collided) {
            const debug = window.__gameState?.collision?.lastDebug;
            pushGameEvent('collision', debug ?? {});
            if (_debugLogger) _debugLogger.log('collision', { charX: debug?.charX, safeX: debug?.safeX, safeTrack: debug?.safeTrack, numLanes: debug?.numLanes, charTrack: run?.cursor, phase: currentTransitionPhase() });
            run.state = 'failed';
          }
        }

        run.tick(now);

        // Frame-level debug logging (throttled to every 60 frames to avoid log spam).
        if (_debugLogger && window.__gameState && window.__gameState.loop.frameCount % 60 === 0) {
          _debugLogger.log('frame', {
            frame: window.__gameState.loop.frameCount,
            phase: currentTransitionPhase(),
            runState: run.state,
            charTrack: run?.cursor,
            waveCount: scene.getActiveWaveCount(),
            inTransition: ['accepted','riding','breather','promoting'].includes(currentTransitionPhase()),
          });
        }

        // Sync observable session phase each frame (AC-4 story 0-5)
        if (window.__gameState) {
          const phaseMap = { running: 'playing', paused: 'paused', succeeded: 'game_over', failed: 'game_over', abandoned: 'game_over' };
          window.__gameState.session.phase = phaseMap[run.state] || 'idle';
          window.__gameState.loop.running = true;
        }

        if (run.state === 'succeeded') {
          scene.showSuccess();
          showOverlay('Success! Scale complete.');
          cleanup();
          return;
        }
        if (run.state === 'failed') {
          const finalScore = window.__gameState?.score?.current || 0;
          pushGameEvent('game.over', { reason: 'collision', score: finalScore });
          if (_debugLogger) _debugLogger.log('game.over', { reason: 'collision', score: finalScore });
          if (window.__gameState) {
            window.__gameState.gameOver.isGameOver = true;
            window.__gameState.gameOver.reason = 'collision';
            window.__gameState.gameOver.triggeredAt = Date.now();
          }
          overlayMgr.show({ type: 'game-over', score: finalScore });
          cleanup();
          return;
        }

        // Freeze scene while paused; accumulate paused duration into gameStartTime on resume
        if (run.state === 'paused') {
          if (_pausedAt === null) _pausedAt = now;
          rafId = requestAnimationFrame(loop);
          return;
        }
        if (_pausedAt !== null) {
          gameStartTime += _now() - _pausedAt;
          scene.setGameStartTime(gameStartTime);
          _pausedAt = null;
        }

        const game_now = _now() - gameStartTime;
        const speedMultiplier = 1.0; // TODO: wire run.speedMultiplier when available
        waveScheduler.tick(game_now, speedMultiplier);
        const waves = waveScheduler.waves;

        // Wave-coupled variant spawn: watch for the target wave (first note after
        // apex for RIGHT, first note after root for LEFT) to enter the scheduler.
        // When found, spawn geometry + safe zone anchored to that wave's timing.
        if (variantPendingSpawn) {
          const targetIdx = variantPendingSpawn.targetNoteIndex;
          const targetWave = waves
            .filter(w => w.note_index === targetIdx && w.spawn_time_ms + w.duration_ms >= game_now)
            .sort((a, b) => a.spawn_time_ms - b.spawn_time_ms)[0] ?? null;
          // Defensive timeout: if no matching wave appears within 15s, dismiss the
          // variant gracefully — clearing variantPendingSpawn alone strands the variant
          // in "proposed" forever (activeVariant stays set, no SZ ever spawns, so the
          // proximity-miss path can't fire either). Subsequent variants would never be
          // proposed because !activeVariant gates the next proposal.
          if (!targetWave && variantPendingSpawn.queuedAtMs != null
              && performance.now() - variantPendingSpawn.queuedAtMs > 15000) {
            if (_debugLogger) _debugLogger.log('variant.spawn.timeout', { targetNoteIndex: targetIdx });
            gameClient.dismissVariant().catch(() => {});
            if (waveScheduler.queueingPaused) {
              waveScheduler.resumeQueueing(run.sequence, run.cursor);
            }
            setTransitionPhase('idle', { reason: 'spawn-timeout' });
            shownVariantId = null;
            activeVariant = null;
            activeWindow = null;
            variantPendingSpawn = null;
            variantSpawnedForWave = null;
            if (window.__gameState) {
              window.__gameState.variant.id = null;
              window.__gameState.variant.timerRunning = false;
              window.__gameState.variant.timerMs = 0;
            }
            updateVariantHud();
          } else if (targetWave && targetWave.wave_id !== variantSpawnedForWave) {
            // Anchor note = note at wave.note_index - 1 (apex for RIGHT, root for LEFT).
            const anchorIdx = targetWave.note_index - 1;
            const anchorNote = (anchorIdx >= 0 && run.sequence[anchorIdx]) ? run.sequence[anchorIdx] : null;
            // Anchor wave: the wave carrying the anchor note. Used to align variant Z
            // with the anchor note (root/apex), not the target wave one step behind.
            const anchorWave = waves
              .filter(w => w.note_index === anchorIdx && w.spawn_time_ms <= targetWave.spawn_time_ms)
              .sort((a, b) => b.spawn_time_ms - a.spawn_time_ms)[0] ?? null;
            scene.proposeVariantTracks(variantPendingSpawn.variant, targetWave, anchorNote, anchorWave);
            variantSpawnedForWave = targetWave.wave_id;
            variantPendingSpawn = null;
          }
        }

        scene.setWaves(waves, _now());
        const _safeZoneOffset = scene.getWorldOffsetX?.() ?? 0;
        const _safeZoneLanes = scene.getNumLanes?.() ?? notesResp.num_lanes;
        safeZoneRenderer.update(waves, 0, (track) => laneX(track, _safeZoneLanes) + _safeZoneOffset, now, gameStartTime, currentInstrument());

        if (window.__gameState) {
          window.__gameState.scene.waveCount = waves.length;
        }

        // During riding phase, camera X tracks the character (Story 6.3).
        if (currentTransitionPhase() === 'riding') {
          scene.setTargetCameraX(scene.getCharacterX());
        }

        // Per-frame hook: used by breather phase timer/wave-clearance check (Story 6.4).
        if (_perFrameHook) _perFrameHook();

        scene.render(now);
        updateVariantHud(); // AC-4: update each frame to catch brief adjacency window
        rafId = requestAnimationFrame(loop);
      };
      // Ensure mic pipeline is ready before countdown; start fresh only if setup-screen grab failed.
      if (!audio) audio = await startAudio({ deviceId: state.audio.deviceId });
      // Wire error handler now so a disconnect during countdown aborts cleanly instead of silently.
      audio.onError(() => {
        if (run && run.state === 'running') pauseGame('audio-error');
        else cleanup();
      });

      // countdownStart must be captured AFTER audio setup so any async delay
      // doesn't skew gameStartTime and cause waves to appear early.
      const countdownStart = _now();
      gameStartTime = countdownStart + 3500;
      scene.setGameStartTime(gameStartTime);
      if (_debugLogger) _debugLogger.setGameStartTime(gameStartTime);

      rafId = requestAnimationFrame(loop);

      // 3-second countdown
      for (let i = 3; i > 0; i--) {
        showOverlay(i.toString(), false);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      showOverlay('GO!', false);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Actually start the game
      gameStartTime = performance.now();
      scene.setGameStartTime(gameStartTime);
      run.start(gameStartTime);

      overlay.classList.add('hidden');
      pauseBtn.classList.remove('hidden');

      // Proximity dismiss: SceneManager fires this when safe zone passes player (AC-2, AC-3)
      scene.setOnVariantMissed(() => {
        // Guard: only dismiss during proposed or riding — after breather the variant is
        // being committed, not missed. Without this guard a late miss fires during breather
        // and overwrites the phase to idle, aborting the transition.
        const _missPhase = currentTransitionPhase();
        if (_missPhase !== 'proposed' && _missPhase !== 'riding') return;
        if (activeVariant) {
          gameClient.dismissVariant().catch(() => {});
          if (waveScheduler.queueingPaused) {
            waveScheduler.resumeQueueing(run.sequence, run.cursor);
          }
          setTransitionPhase('idle', { reason: 'missed' });
          shownVariantId = null;
          activeVariant = null;
          activeWindow = null;
          variantPendingSpawn = null;
          variantSpawnedForWave = null;
          if (window.__gameState) {
            window.__gameState.variant.id = null;
            window.__gameState.variant.timerRunning = false;
            window.__gameState.variant.timerMs = 0;
          }
          updateVariantHud();
        }
      });

      const detectionHandler = async (det) => {
        if (!run || run.state !== 'running') return;
        _onDetection = detectionHandler;
        if (!det?.note || det.note.midi == null) return;

        // Variant accept: gate on adjacency — safe zone must be at player position (AC-1).
        if (activeVariant && activeWindow && det.note.midi === activeWindow.trigger_midi
            && scene.isVariantSafeZoneAdjacent()) {
          let resp = null;
          try { resp = await gameClient.acceptVariant(det.note.midi); }
          catch (_) {
            // Guard: another concurrent callback may have already advanced the phase.
            if (currentTransitionPhase() !== 'proposed') {
              if (_debugLogger) _debugLogger.log('variant.accept.stale', { phase: currentTransitionPhase(), error: 'network' });
              return;
            }
            if (waveScheduler.queueingPaused) {
              waveScheduler.resumeQueueing(run.sequence, run.cursor);
            }
            setTransitionPhase('idle', { reason: 'accept-failed' });
            shownVariantId = null;
            activeVariant = null;
            activeWindow = null;
            variantPendingSpawn = null;
            variantSpawnedForWave = null;
            updateVariantHud();
            return;
          }
          if (resp && resp.success) {
            pushGameEvent('variant.accept', { variant_id: activeVariant?.variant_id ?? resp.variant_id, midi: det.note.midi });
            if (_debugLogger) _debugLogger.log('variant.accept', { variant_id: activeVariant?.variant_id ?? resp.variant_id, midi: det.note.midi });
            runAcceptTransition(resp);
            return;
          }
          // Accept attempted but backend rejected (success:false). Clear stale variant
          // state and consume the trigger note — do NOT also process as a regular note.
          // Guard: if another detection callback already advanced the phase (accepted→riding→breather)
          // via a successful concurrent acceptVariant call, do NOT overwrite to idle.
          if (currentTransitionPhase() !== 'proposed') {
            if (_debugLogger) _debugLogger.log('variant.accept.stale', { phase: currentTransitionPhase() });
            return;
          }
          if (waveScheduler.queueingPaused) {
            waveScheduler.resumeQueueing(run.sequence, run.cursor);
          }
          setTransitionPhase('idle', { reason: 'accept-rejected' });
          shownVariantId = null;
          activeVariant = null;
          activeWindow = null;
          variantPendingSpawn = null;
          variantSpawnedForWave = null;
          updateVariantHud();
          return;
        }

        if (!safeZoneRenderer.isAnyPrimarySafeZoneAdjacent(det.note.midi)) {
          run.onMissOutsideWindow?.(det);
          return;
        }

        const prevIdx = run.cursor;
        const result = run.onDetection(det);
        if (result === 'accepted') {
          // Sync with backend
          const playResult = await gameClient.playNote(det.note.midi, _now() - run.startedAt);
          pushGameEvent('note.accepted', { midi: det.note.midi, cursor: prevIdx });
            if (_debugLogger) _debugLogger.log('note.accepted', { midi: det.note.midi, cursor: prevIdx, track: playResult?.game_state?.current_track });
            if (playResult && playResult.success) {
            if (playResult.game_state && playResult.game_state.current_track !== undefined) {
              scene.moveToTrack(playResult.game_state.current_track);
            }
            if (playResult.next_wave) {
              currentWaves.push(playResult.next_wave);
            }

            // Note-triggered variant proposal: root → RIGHT, apex → LEFT.
            // Either trigger fires at the milestone (passes >= 2). Backend picks side
            // from last_pass_direction, which alternates RIGHT/LEFT across cycles.
            const passes = playResult.scale_passes_completed ?? 0;
            if (!activeVariant && !proposePending && passes >= 2) {
              const isRoot = prevIdx === 0;
              const isApex = ascendingNoteCount > 0 && prevIdx === ascendingNoteCount - 1;
              if (isRoot || isApex) {
                proposePending = true;
                try {
                  const resp = await gameClient.proposeVariant();
                  if (resp && resp.success) {
                    pushGameEvent('variant.propose', { variant_id: resp.variant.variant_id, side: resp.variant.side, root_midi: resp.variant.root_midi });
                    if (_debugLogger) _debugLogger.log('variant.propose', { variant_id: resp.variant.variant_id, side: resp.variant.side, root_midi: resp.variant.root_midi, base_fret: resp.variant.base_fret, num_lanes: resp.variant.num_lanes });
                    activeVariant = resp.variant;
                    activeWindow = resp.window;
                    shownVariantId = resp.variant.variant_id;
                    if (window.__gameState) {
                      window.__gameState.variant.id = resp.variant.variant_id;
                      window.__gameState.variant.timerRunning = true;
                      window.__gameState.variant.timerMs = Math.max(0, resp.window.deadline_ms - Date.now());
                      window.__gameState.variant.timerExpired = false;
                    }
                    setTransitionPhase('proposed', { variant: resp.variant });
                    _queueVariantSpawn(resp.variant);
                  }
                } finally {
                  proposePending = false;
                }
              }
            }
          }

          feedbackEl.textContent = '✓';
          setExpected();
        } else if (result === 'rejected') {
          feedbackEl.textContent = '·';
        }
      };
      audio.onDetection(detectionHandler);

      setExpected();

      // Queue a wave-coupled variant spawn. The render loop picks up the first
      // matching wave (note after apex for RIGHT, note after root for LEFT).
      function _queueVariantSpawn(variant) {
        if (variantPendingSpawn) return; // already queued
        const seqLen = run?.sequence?.length ?? 0;
        let targetNoteIndex = variant.side === 'RIGHT' ? ascendingNoteCount : 1;
        // Defensive: clamp into a valid range for tiny/degenerate sequences so the
        // render-loop watcher can actually find a matching wave.
        if (seqLen > 0 && (targetNoteIndex < 0 || targetNoteIndex >= seqLen)) {
          targetNoteIndex = 0;
        }
        variantPendingSpawn = { variant, targetNoteIndex, queuedAtMs: performance.now() };
        variantSpawnedForWave = null;
      }

      gameClient.startPolling((pollState) => {
        if (!pollState) return;
        if (run && run.state === 'paused') return;

        if (pollState.score !== undefined) {
          feedbackEl.textContent = `Score: ${pollState.score}`;
          if (window.__gameState) window.__gameState.score.current = pollState.score;
        }

        if (pollState.status === 'failed') {
          run.state = 'failed';
        }

        // Variant lifecycle (feature 008-track-variants).
        const prevVariant = activeVariant;
        activeVariant = pollState.active_variant || null;
        activeWindow = pollState.active_window || null;
        // Polling-driven dismiss: backend cleared the variant without frontend initiating it.
        if (prevVariant && !activeVariant && currentTransitionPhase() === 'proposed') {
          if (waveScheduler.queueingPaused) {
            waveScheduler.resumeQueueing(run.sequence, run.cursor);
          }
          setTransitionPhase('idle', { reason: 'dismissed' });
          shownVariantId = null;
          variantPendingSpawn = null;
          variantSpawnedForWave = null;
        }
        if (window.__gameState) {
          window.__gameState.variant.id = activeVariant ? activeVariant.variant_id : null;
          window.__gameState.variant.timerRunning = !!(activeVariant && activeWindow &&
            activeWindow.state === 'OPEN' && Date.now() < activeWindow.deadline_ms);
          window.__gameState.variant.timerMs = activeWindow
            ? Math.max(0, activeWindow.deadline_ms - Date.now()) : 0;
        }

        // Render variant if backend reports one we haven't shown yet
        // (proposed via note-triggered flow in detection handler).
        if (activeVariant && shownVariantId !== activeVariant.variant_id) {
          shownVariantId = activeVariant.variant_id;
          _queueVariantSpawn(activeVariant);
        }

        updateVariantHud();
      }, 200);

    } catch (err) {
      const code = (err && err.name) || '';
      if (code === 'NotAllowedError') {
        showOverlay('Microphone permission denied. Allow access and try again.');
      } else if (code === 'NotFoundError') {
        showOverlay('No microphone found. Connect a device and try again.');
      } else {
        showOverlay(`Cannot start run: ${err.message || err}`);
      }
      cleanup();
    }
  }

  function cleanup() {
    gameClient.stopPolling();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    // Keep the mic stream alive for the next run; silence detection and error handlers.
    if (audio) { audio.onDetection(() => {}); audio.onError(() => {}); }
    pauseBtn.classList.add('hidden');
    if (_debugLogger) { _debugLogger.destroy(); _debugLogger = null; }
    if (window.__gameState) {
      window.__gameState.session.phase = 'idle';
      window.__gameState.loop.running = false;
      window.__gameState.score.current = 0;
      window.__gameState.gameOver.isGameOver = false;
      window.__gameState.gameOver.reason = null;
      window.__gameState.gameOver.triggeredAt = null;
    }
    // Variant cleanup.
    if (window.__gameState) {
      window.__gameState.variant = { id: null, timerMs: 0, timerRunning: false, timerExpired: false };
    }
    if (scene.dismissVariantTracks) scene.dismissVariantTracks();
    shownVariantId = null;
    activeVariant = null;
    activeWindow = null;
    proposePending = false;
    variantPendingSpawn = null;
    variantSpawnedForWave = null;
    updateVariantHud();
  }

  function showOverlay(msg, isMessage = true) {
    overlay.textContent = msg;
    if (isMessage) {
      overlay.classList.add('message');
    } else {
      overlay.classList.remove('message');
    }
    overlay.classList.remove('hidden');
  }

  // Wire _test hooks now that closure variables (run, audio, pauseBtn) are in scope
  if (window.__TEST_MODE) {
    window.__gameState._test = {
      forceCollision: () => {
        if (!run || run.state === 'abandoned') return;
        run.state = 'failed';
        const finalScore = window.__gameState?.score?.current || 0;
        if (window.__gameState) {
          window.__gameState.gameOver.isGameOver = true;
          window.__gameState.gameOver.reason = 'collision';
          window.__gameState.gameOver.triggeredAt = Date.now();
        }
        overlayMgr.show({ type: 'game-over', score: finalScore });
        cleanup();
      },
      triggerPause: () => {
        if (!run) return;
        if (run.state === 'running') {
          pauseGame();
        } else if (run.state === 'paused') {
          resumeGame();
          overlayMgr.hide();
        }
      },
      resetGame: () => { if (run) { run.abandon(); cleanup(); } },
      setVariant: (() => {
        let _timer = null;
        return (id, durationMs = 10000) => {
          if (_timer) { clearInterval(_timer); _timer = null; }
          if (!id) {
            window.__gameState.variant = { id: null, timerMs: 0, timerRunning: false, timerExpired: false };
            return;
          }
          window.__gameState.variant.id = id;
          window.__gameState.variant.timerMs = durationMs;
          window.__gameState.variant.timerRunning = true;
          window.__gameState.variant.timerExpired = false;
          const start = Date.now();
          _timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, durationMs - elapsed);
            window.__gameState.variant.timerMs = remaining;
            if (remaining === 0) {
              window.__gameState.variant.timerExpired = true;
              window.__gameState.variant.timerRunning = false;
              window.__gameState.variant.id = null;
              clearInterval(_timer);
              _timer = null;
            }
          }, 50);
        };
      })(),
      // Shorten the breather timer for fast E2E test completion (Story 6.7).
      setBreatherMs: (ms) => { _variantBreatherMs = ms; },
      // Clear all active wave meshes AND scheduler queue (breather wave-clearance gate in tests).
      clearSceneWaves: () => { scene.clearWavesForTesting(); _waveScheduler?.clearWavesForTesting(); },
      // Simulates a detected MIDI note through the real detection pipeline.
      playNote: (midi) => {
        if (!_onDetection) return;
        const name = midiToName(midi);
        _onDetection({
          note: { midi, name, octave: Math.floor(midi / 12) - 1 },
          frequencyHz: 440 * Math.pow(2, (midi - 69) / 12),
          confidence: 0.95,
          centsOffset: 0,
        });
      },
      // Triggers accept transition via phase machine with a synthetic response (Story 6.1 smoke).
      triggerVariantAccept: (mockResp) => {
        if (!run || run.state !== 'running') return;
        if (!_runAcceptTransitionFn) return;
        const resp = mockResp || {
          success: true,
          current_note_index: 0,
          num_lanes: 6,
          base_fret: 2,
          notes: run.sequence,
          ascending_note_count: run.sequence ? Math.ceil(run.sequence.length / 2) : 0,
        };
        setTransitionPhase('proposed', { variant: { variant_id: 'test-v1', side: 'RIGHT' } });
        _runAcceptTransitionFn(resp);
      },
    };
  }

  // Test-mode keyboard injection (Story 6.8 T12).
  // Q = play the next required scale note. W = play the variant trigger note.
  // Burst-injects for ~500ms to mimic continuous audio detection — single keypress
  // would only get one frame's chance at the spatial-adjacency gate inside the
  // detection handler, which is what made the keys feel flaky (only fired at SZ
  // center). The detection handler's own spatial gates are the sole gating.
  const _BURST_MS = 500;
  const _BURST_INTERVAL_MS = 30;
  if (TEST_MODE) {
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return; // browser auto-repeat triggers the burst already; ignore
      const k = ev.key?.toLowerCase();
      if (k !== 'q' && k !== 'w') return;
      let midi = null;
      if (k === 'q') {
        midi = run?.currentExpected?.()?.note?.midi ?? null;
      } else if (k === 'w') {
        midi = activeWindow?.trigger_midi ?? null;
      }
      if (midi == null) return;
      _burstInjectNote(midi);
    });
  }
  function _injectTestNote(midi) {
    const fn = window.__gameState?._test?.playNote;
    if (typeof fn === 'function') fn(midi);
  }
  function _burstInjectNote(midi) {
    const startCursor = run?.cursor ?? -1;
    const startMs = performance.now();
    const tick = () => {
      _injectTestNote(midi);
      const advanced = run && run.cursor !== startCursor;
      if (advanced) return;
      if (performance.now() - startMs >= _BURST_MS) return;
      setTimeout(tick, _BURST_INTERVAL_MS);
    };
    tick();
  }

  pauseBtn.addEventListener('click', () => {
    if (!run) return;
    if (run.state === 'running') {
      pauseGame();
    } else if (run.state === 'paused') {
      resumeGame();
      overlayMgr.hide();
    }
  });
  // Pause on window blur (silent — no overlay, so E2E test hooks stay unblocked)
  window.addEventListener('blur', () => {
    if (!run || run.state !== 'running') return;
    run.pause(performance.now());
    if (audio) audio.pause();
    pauseBtn.textContent = 'Resume';
    if (window.__gameState) window.__gameState.session.phase = 'paused';
  });
  // No auto-resume on focus — user must click Resume explicitly to avoid
  // unintentionally resuming a manually-paused game after alt-tab.

}
