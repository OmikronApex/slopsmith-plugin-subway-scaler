// Subway Scaler game bootstrap.
// Wires the menu UI, run lifecycle, audio pipeline, run state machine, and 3D scene.

import { createScene } from './SceneManager.js';
import { startAudio } from './AudioDetector.js';
import { Run, difficultyToTimePerNoteMs, PHASES } from './GameState.js';
import {
  setTransitionPhaseListener,
  setTransitionPhase,
  currentTransitionPhase,
  registerPhaseCleanup,
  resetTransitionPhase,
} from './TransitionPhases.js';
import { midiToName } from './notes.js';
import { GameClient } from './game-client.js';
import { DebugLogger } from './DebugLogger.js';
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js';
import { VariantController } from './VariantController.js';
import { NoteAcceptor } from './NoteAcceptor.js';
import { GamePoller } from './GamePoller.js';
import { laneX, SPAWN_Z, LANE_W, DIAG_LEN } from './TrackSystem.js';

// Cinematic refinement constants (Story 6.8) -- mirror SceneManager values.
const MAX_BEND_YAW = Math.PI / 4;
const FIRST_WAVE_ARRIVAL_DELAY_MS = 500;
const REPOSITION_SLIDE_MS = 400;

// URL-driven test-mode keyboard shortcuts (Story 6.8 T12).
// Setting window.__TEST_MODE here ensures the _test.playNote hook (gated on it later
// in bootstrap) gets wired -- without this, Q/W keydown finds no injection target.
const TEST_MODE = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('testMode');
if (TEST_MODE && typeof window !== 'undefined') {
  window.__TEST_MODE = true;
}
import { injectTokens } from './ui/tokens.js';
import { renderSetupScreen } from './ui/setup.js';
import { OverlayManager } from './ui/overlay.js';
import { WaveScheduler } from './WaveScheduler.js';
import { HudShell } from './ui/HudShell.js';
import { ScoreDisplay } from './ui/ScoreDisplay.js';
import { PauseButton } from './ui/PauseButton.js';
import { FretBox } from './ui/FretBox.js';

const API = '/api/plugins/subway-scaler';
const STATIC = '/plugins/subway-scaler/static/game';

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

  // Persistent RAF loop keeps loop.frameCount ticking for E2E liveness checks.
  // Capped at 60 fps in test mode to avoid CPU saturation under software WebGL.
  const _BG_FRAME_MS = 1000 / 60;
  (function _bgLoop(last) {
    requestAnimationFrame((now) => {
      if (window.__TEST_MODE && now - last < _BG_FRAME_MS) {
        const remaining = _BG_FRAME_MS - (now - last);
        setTimeout(() => _bgLoop(last), remaining);
        return;
      }
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

  // Inject plugin stylesheet when running inside SDK hub (screen.html is not loaded there)
  const STYLES_URL = '/plugins/subway-scaler/static/styles.css';
  if (!document.querySelector(`link[href="${STYLES_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES_URL;
    document.head.appendChild(link);
  }

  // Ensure SdkBridge bridge object exists so onGameOver can be wired late
  window.__slopsmithSdkBridge = window.__slopsmithSdkBridge || {};

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
    if (window.__gameState) window.__gameState.session.phase = 'paused';
    hudShell.onPhaseChange(PHASES.PAUSED);
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
    if (window.__gameState) window.__gameState.session.phase = 'playing';
    hudShell.onPhaseChange(PHASES.PLAYING);
    gameClient.resume().catch(() => {});
  }

  // Overlay manager -- wired before game starts so restart/quit work in any phase
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
  const overlay = el('div', { class: 'overlay hidden' });
  // game-wrap fills the shell absolutely; canvas and overlay position within it.
  const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay);
  shell.appendChild(gameWrap);
  overlayMgr.mount(gameWrap);

  // HUD layer (Epic 8) -- sits between canvas and overlays (z-index: 100 vs 2000)
  const hudShell = new HudShell(shell);
  const scoreDisplay = new ScoreDisplay(hudShell);
  const pauseButton = new PauseButton(hudShell, () => pauseGame());
  const fretBox = new FretBox();
  fretBox.register(hudShell);

const scene = createScene(canvas);

  // Keep Three.js renderer resolution in sync with the shell's actual pixel size
  new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      scene.resize(width, height);
    }
  }).observe(shell);

  // Grab the microphone on the setup screen so it's ready when the game starts.
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

  // Variant state managed by VariantController (Story 9-4).
  let variantController = null;

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
    const upcoming = run.upcoming(3).map(e => e.name);
    scene.setUpcomingNotes(upcoming);
    // Sync cursor to safe zone renderer for primary-wave filtering (Story 9-1).
    safeZoneRenderer.setExpectedNoteIndex(run.cursor);
  }

  async function start() {
    if (run && run.state === 'running') return;
    // Reset phase machine early so a failure before register/listener setup
    // doesn't leave stale listeners from the previous game (P7).
    resetTransitionPhase();

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
      // setBaseFret rebuilds tracks -- otherwise restart inherits the prior game's
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
      // Mutable -- updated after each variant accept when the new scale may differ.
      let ascendingNoteCount = notesResp.ascending_note_count;

      // Root and apex notes for variant safe zone positioning (same string, 2-fret shift).
      let rootNote = notesResp.notes?.[0] ?? null;
      let apexNote = (ascendingNoteCount > 0 && notesResp.notes)
        ? notesResp.notes[ascendingNoteCount - 1] : null;

      // Transition phase machine (Story 6.1) -- reset on each game start, then register
      // default listeners that drive the synchronous accept waterfall. Later stories
      // replace individual listeners with async, animation-driven variants.
      if (window.__gameState?.variant) {
        window.__gameState.variant.transitionPhase = 'idle';
      }
      variantController = new VariantController({ gameClient, scene, waveScheduler, run, pushGameEvent });
      variantController.ascendingNoteCount = ascendingNoteCount;
      const noteAcceptor = new NoteAcceptor({
        safeZoneRenderer,
        gameClient,
        scene,
        variantController,
        pushGameEvent,
        debugLogger: _debugLogger,
      });
      noteAcceptor.setExpectedFn = setExpected;
      // Universal phase change logger (debug-logging).
      setTransitionPhaseListener((next, prev) => {
        if (_debugLogger) _debugLogger.log('phase.change', { from: prev, to: next });
      });

      // Default accepted → riding: soft halt, then advance phase.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'accepted') return;
        fretBox.fadeOut();
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
        // Disable miss callback only -- keep mesh so it scrolls away naturally (AC-2).
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

          // Cinematic duration: character X lerp must match diagonal scroll speed.
          // Use propose-piece speed (baked at spawn), not getLastWaveSpeed(), because
          // promotePromise clears waves mid-cinematic and corrupts the live speed.
          const vInfo = scene.getVariantInfo();
          const diagSpeedPxMs = vInfo?.speedPxMs ?? scene.getLastWaveSpeed() ?? 0.05;
          const dynamicDiagMs = DIAG_LEN / (diagSpeedPxMs * 0.5);

          // Character snap + camera target (AC-4). Camera 45° pivot uses the
          // SceneManager default (250ms) -- slow enough to read as a deliberate
          // camera move, fast enough to land before the diagonal scrolls far.
          scene.snapCharacterYaw(sign * MAX_BEND_YAW);
          scene.setRidingCameraTarget(sign * MAX_BEND_YAW);

          // Early spawn (AC-5): time wave arrival to land at FIRST_WAVE_ARRIVAL_DELAY_MS post-landing.
          // newScaleCenterX: near edge of new scale at landingX (AC-5 formula).
          // Scene propagates this as _worldOffsetX so subsequent wave/collision/lane logic
          // operates in offset coords automatically.
          const T_travel = Math.abs(SPAWN_Z) / (diagSpeedPxMs * 0.5);
          const spawnDelayMs = dynamicDiagMs - T_travel + FIRST_WAVE_ARRIVAL_DELAY_MS;
          const resp = ctx?.resp;
          const newBase = resp?.base_fret ?? notesResp.base_fret;
          const newLanes = resp?.num_lanes ?? notesResp.num_lanes;
          const newScaleCenterX = landingX + sign * (newLanes - 1) / 2 * LANE_W;
          const doSpawn = () => scene.spawnVariantTracks(newBase, newLanes, diagSpeedPxMs, newScaleCenterX);
          if (spawnDelayMs <= 0) doSpawn();
          else setTimeout(doSpawn, spawnDelayMs);

          // Fire promote NOW (don't await) so the new-scale waves can be scheduled
          // during the cinematic rather than at landing. Pre-staging the scheduler
          // with gameNow=landingGameNow puts the first wave at the same spawn_time
          // it would get at a landing-time resume -- but the wave meshes start
          // appearing at SPAWN_Z mid-cinematic and scroll smoothly into view.
          //
          // landingGameNow is then shifted EARLIER by 1.5 wave-gaps so the first
          // new wave arrives sooner after landing (default scheduler timing put
          // first arrival a full gap past landing+REPOSITION; that felt late).
          const tp = notesResp.timing_params;
          const waveGapMs = (tp?.base_duration_ms ?? 4000) * (tp?.wave_spacing_factor ?? 0.5);
          const landingGameNow =
            gameNow() + dynamicDiagMs + REPOSITION_SLIDE_MS - 1.5 * waveGapMs;
          const promotePromise = gameClient.promoteVariant().catch(err => {
            console.error('[main] promote error', err);
            return null;
          });
          promotePromise.then(resp => {
            if (!resp || !resp.success) return;
            // Drop in-flight old-scale waves from the scheduler -- their meshes
            // keep scrolling (setWaves' "wave gone but still in front" path)
            // until they pass the player; finalizeVariantTransition at landing
            // hard-cleans whatever remains.
            waveScheduler.clearWavesForTesting();
            waveScheduler.resumeQueueing(resp.notes, resp.current_note_index ?? 0, resp.base_fret, resp.num_lanes, landingGameNow);
            // Sync speed multiplier immediately -- backend resets to 1.0 on promote.
            if (resp.speed_multiplier != null) {
              poller._speedMultiplier = resp.speed_multiplier;
            }
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
          waveScheduler.clearWavesForTesting();
          waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0, null, null, gameNow());
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

      function _applyPromoteResponse(resp, ctx) {
        const startIdx = resp.current_note_index ?? 0;
        if (run && resp.notes) {
          run.sequence = resp.notes;
          run.cursor = startIdx;
          setExpected();
        }
        if (resp.ascending_note_count != null) {
          ascendingNoteCount = resp.ascending_note_count;
          variantController.ascendingNoteCount = ascendingNoteCount;
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
        if (resp.speed_multiplier != null && poller) {
          poller._speedMultiplier = resp.speed_multiplier;
        }
        if (resp.notes) fretBox.render(resp);
        setTransitionPhase('active', ctx);
      }

      function applyPromoteResponse(resp, ctx) {
        // Force-finalize the cinematic exit lerp BEFORE writing character.position.x,
        // otherwise the next render frame's clamped p=1 overwrites our moveToTrack
        // value back to landingX (Story 6.8 bugfix -- caused instant collision).
        scene.clearCinematicExit?.();
        // Park the default-mode camera at the new world offset so it stays with the
        // offset tracks once cinematic exit hands control back (Story 6.8 AC-5).
        scene.setTargetCameraX?.(scene.getWorldOffsetX?.() ?? 0);
        // Demote in-flight pre-variant waves to visual-only -- they live in the old
        // world frame and would otherwise collide with the character who is now in
        // the new frame.
        scene.ghostExistingWaves?.();
        // Tear down retiring tracks + remove old-frame ghost wave meshes.
        // Scheduler was already pre-staged at corner-fire so new waves are
        // mid-scroll by now; we do NOT reset the scheduler or safe-zone
        // renderer here (that would wipe the pre-staged new state).
        scene.finalizeVariantTransition?.();
        _applyPromoteResponse(resp, ctx);
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
            // Test mode: triggerVariantAccept uses a synthetic resp without creating a
            // real backend variant, so promoteVariant() returns failure. Fall back to
            // ctx.resp (the accept resp already has all data needed to complete the transition).
            if (window.__TEST_MODE && ctx?.resp?.success && ctx.resp.notes) {
              const r = ctx.resp;
              waveScheduler.resumeQueueing(r.notes, r.current_note_index ?? 0, r.base_fret, r.num_lanes, gameNow());
              safeZoneRenderer.reset();
              _applyPromoteResponse(r, ctx);
              return;
            }
            console.error('[main] promote failed', resp);
            waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0, null, null, gameNow());
            setTransitionPhase('idle', ctx);
            return;
          }
          const startIdx = resp.current_note_index ?? 0;
          if (resp.notes) waveScheduler.resumeQueueing(resp.notes, startIdx, resp.base_fret, resp.num_lanes, gameNow());
          safeZoneRenderer.reset();
          _applyPromoteResponse(resp, ctx);
        }).catch((err) => {
          console.error('[main] promote error', err);
          waveScheduler.resumeQueueing(notesResp.notes, run?.cursor ?? 0, null, null, gameNow());
          setTransitionPhase('idle', ctx);
        });
      });

      // Default active: reset variant tracking state and fade in fret box with new data.
      setTransitionPhaseListener((next, prev, ctx) => {
        if (next !== 'active') return;
        variantController.reset();
        fretBox.fadeIn();
      });

      // Idle transition recovery: fade in fret box if it was hidden (e.g. variant dismissed).
      setTransitionPhaseListener((next, prev) => {
        if (next !== 'idle') return;
        fretBox.fadeIn();
      });

      function runAcceptTransition(resp) {
        setTransitionPhase('accepted', { resp });
      }
      _runAcceptTransitionFn = runAcceptTransition;
      // Wire variantController accept gate into the transition response
      window.__variantAcceptFn = (resp) => runAcceptTransition(resp);

      // Start the rendering loop so we can see the initial state
      let _pausedAt = null;
      let gameStartTime = 0; // set after audio setup so countdownStart is accurate
      // In test mode cap the render loop at 60 fps to avoid maxing out the CPU
      // under software WebGL (SwiftShader) in headless Chromium. Real browsers are
      // uncapped — if your hardware supports 240 Hz, the game runs at 240 Hz.
      const _TEST_FRAME_MS = 1000 / 60;
      let _lastLoopTime = 0;

      const loop = (now) => {
        if (!run) return;
        if (window.__TEST_MODE) {
          const remaining = _TEST_FRAME_MS - (now - _lastLoopTime);
          if (remaining > 1) {
            // Sleep for the remaining frame time instead of spinning on RAF —
            // spinning would saturate the JS event loop and starve timers.
            rafId = setTimeout(() => { rafId = requestAnimationFrame(loop); }, remaining);
            return;
          }
          _lastLoopTime = now;
        }

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
          // Notify SdkBridge to track best score (Story 10-5); end() only called on Quit.
          window.__slopsmithSdkBridge?.onGameOver?.(finalScore);
          hudShell.onPhaseChange(PHASES.GAME_OVER);
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

        const game_now = gameNow();
        const speedMultiplier = poller.speedMultiplier;
        waveScheduler.tick(game_now, speedMultiplier);
        const waves = waveScheduler.waves;

        // Wave-coupled variant spawn: delegated to VariantController (Story 9-4).
        variantController.processVariantSpawn(waves, game_now);

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
      gameStartTime = countdownStart + 3500; // Do NOT overwrite after countdown -- set once so
      // wave scheduler ticks during countdown use a consistent clock (P1).
      const gameNow = () => _now() - gameStartTime;
      scene.setGameStartTime(gameStartTime);
      if (_debugLogger) _debugLogger.setGameStartTime(gameStartTime);
      // Wire poller after gameStartTime is known.
      const poller = new GamePoller({
        gameClient, scoreDisplay, variantController, scene,
      });
      poller.run = run;
      poller._nowFn = _now;
      poller.gameStartTime = gameStartTime;
      // Wire speed multiplier from playNote response directly to poller (no poll wait).
      noteAcceptor.onSpeedUpdate = (speed) => { poller._speedMultiplier = speed; };

      rafId = requestAnimationFrame(loop);

      // 3-second countdown
      for (let i = 3; i > 0; i--) {
        showOverlay(i.toString(), false);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      showOverlay('GO!', false);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Actually start the game -- gameStartTime already set above; start the run clock.
      run.start(gameStartTime);

      overlay.classList.add('hidden');

      // HUD: show and render initial finger pattern
      hudShell.onPhaseChange(PHASES.PLAYING);
      scoreDisplay.update(0);
      scoreDisplay.setDifficulty(state.difficulty);
      fretBox.render(notesResp);

      // Proximity dismiss: SceneManager fires this when safe zone passes player (AC-2, AC-3)
      scene.setOnVariantMissed(() => {
        variantController.handleMissed(_now, gameStartTime);
      });

      const detectionHandler = async (det) => {
        if (!run || run.state !== 'running') return;
        _onDetection = detectionHandler;
        if (!det?.note || det.note.midi == null) return;

        // Variant accept gate (stays in main.js -- needs runAcceptTransition closure).
        if (variantController.activeVariant && variantController.activeWindow && det.note.midi === variantController.activeWindow.trigger_midi
            && scene.isVariantSafeZoneAdjacent()) {
          const acceptResult = await variantController.handleAccept(det, _now, gameStartTime, run);
          if (acceptResult?.accepted) {
            pushGameEvent('variant.accept', { variant_id: acceptResult.resp.variant_id, midi: det.note.midi });
            if (_debugLogger) _debugLogger.log('variant.accept', { variant_id: acceptResult.resp.variant_id, midi: det.note.midi });
            // Reset breatherMs from new scale's timing
            if (acceptResult.resp.timing_params?.variant_breather_ms) {
              _variantBreatherMs = acceptResult.resp.timing_params.variant_breather_ms;
            }
            runAcceptTransition(acceptResult.resp);
            return;
          }
          // Error / rejected / stale -- handler already cleared state; consume the det.
          return;
        }

        // Standard note detection -- delegated to NoteAcceptor.
        noteAcceptor.ascendingNoteCount = ascendingNoteCount;
        const noteResult = await noteAcceptor.handle(det, { run, nowFn: _now, gameStartTime });
        if (noteResult.accepted) {
          // NoteAcceptor updated cursor, feedback, and triggered variant propose.
          // Re-read cursor for subsequent frames.
        }
      };
      audio.onDetection(detectionHandler);

      setExpected();

      poller.start();

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
    // Clear test-mode interval first (P4) -- prevents orphaned interval writing to
    // stale __gameState.variant after cleanup has replaced the object.
    if (window.__TEST_MODE && typeof window.__variantTimer !== 'undefined') {
      clearInterval(window.__variantTimer);
      window.__variantTimer = null;
    }
    gameClient.stopPolling();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    // Keep the mic stream alive for the next run; silence detection and error handlers.
    if (audio) { audio.onDetection(() => {}); audio.onError(() => {}); }
    hudShell.onPhaseChange(PHASES.IDLE);
    scoreDisplay.update(0);
    if (_debugLogger) { _debugLogger.destroy(); _debugLogger = null; }
    if (window.__gameState) {
      window.__gameState.session.phase = 'idle';
      window.__gameState.loop.running = false;
      window.__gameState.score.current = 0;
      window.__gameState.gameOver.isGameOver = false;
      window.__gameState.gameOver.reason = null;
      window.__gameState.gameOver.triggeredAt = null;
    }
    // Variant cleanup -- delegate to controller.
    if (variantController) variantController.reset();
    if (scene.dismissVariantTracks) scene.dismissVariantTracks();
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

  // Wire _test hooks now that closure variables (run, audio) are in scope
  if (window.__TEST_MODE) {
    window.__gameState._test = {
      forceCollision: () => {
        if (!run || run.state === 'abandoned') return;
        run.state = 'failed';
        const finalScore = window.__gameState?.score?.current || 0;
        overlayMgr.show({ type: 'game-over', score: finalScore });
        cleanup(); // resets gameOver + session.phase to idle — re-set below
        if (window.__gameState) {
          window.__gameState.gameOver.isGameOver = true;
          window.__gameState.gameOver.reason = 'collision';
          window.__gameState.gameOver.triggeredAt = Date.now();
          window.__gameState.session.phase = 'game_over';
        }
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
        return (id, durationMs = 10000) => {
          if (window.__variantTimer) { clearInterval(window.__variantTimer); window.__variantTimer = null; }
          if (!id) {
            window.__gameState.variant = { id: null, timerMs: 0, timerRunning: false, timerExpired: false };
            return;
          }
          window.__gameState.variant.id = id;
          window.__gameState.variant.timerMs = durationMs;
          window.__gameState.variant.timerRunning = true;
          window.__gameState.variant.timerExpired = false;
          const start = Date.now();
          window.__variantTimer = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, durationMs - elapsed);
            window.__gameState.variant.timerMs = remaining;
            if (remaining === 0) {
              window.__gameState.variant.timerExpired = true;
              window.__gameState.variant.timerRunning = false;
              window.__gameState.variant.id = null;
              clearInterval(window.__variantTimer);
              window.__variantTimer = null;
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
  // Burst-injects for ~500ms to mimic continuous audio detection -- single keypress
  // would only get one frame's chance at the spatial-adjacency gate inside the
  // detection handler, which is what made the keys feel flaky (only fired at SZ
  // center). The detection handler's own spatial gates are the sole gating.
  const _BURST_MS = 500;
  const _BURST_INTERVAL_MS = 30;
  if (TEST_MODE) {
    // capture: true — fires before hub keydown handlers, so stopPropagation in hub UI
    // cannot prevent Q/W from reaching the game when running inside the minigame hub.
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return; // browser auto-repeat triggers the burst already; ignore
      const k = ev.key?.toLowerCase();
      if (k !== 'q' && k !== 'w') return;
      let midi = null;
      if (k === 'q') {
        midi = run?.currentExpected?.()?.note?.midi ?? null;
      } else if (k === 'w') {
        midi = variantController.activeWindow?.trigger_midi ?? null;
      }
      if (midi == null) return;
      _burstInjectNote(midi);
    }, { capture: true });
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

  // Pause on window blur (silent -- no overlay, so E2E test hooks stay unblocked)
  window.addEventListener('blur', () => {
    if (!run || run.state !== 'running') return;
    pauseGame();
  });
  // No auto-resume on focus -- user must click Resume explicitly to avoid
  // unintentionally resuming a manually-paused game after alt-tab.

}
