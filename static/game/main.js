// Subway Scaler game bootstrap.
// Wires the menu UI, run lifecycle, audio pipeline, run state machine, and 3D scene.

import { createScene } from './SceneManager.js';
import { startAudio } from './AudioDetector.js';
import { Run, difficultyToTimePerNoteMs } from './GameState.js';
import { quantize, midiToName } from './notes.js';
import { GameClient } from './game-client.js';
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js';
import { laneX } from './TrackSystem.js';
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

  // Initialize game state observable for E2E tests (story 0-5)
  window.__TEST_MODE = window.__TEST_MODE ?? false;
  window.__gameState = {
    version: '1.0.0',
    timestamp: Date.now(),
    loop: { running: false, frameCount: 0, deltaTime: 0 },
    character: { positionX: 0, positionY: 0, velocityX: 0, velocityY: 0, state: 'idle' },
    scene: { waveCount: 0 },
    score: { current: 0, highScore: 0, distanceTraveled: 0 },
    collision: { lastCollisionType: null, lastCollisionTimestamp: null, invincibilityFrames: 0 },
    gameOver: { isGameOver: false, reason: null, triggeredAt: null },
    session: { phase: 'idle', pauseCount: 0, totalPausedMs: 0 },
    variant: { id: null, timerMs: 0, timerRunning: false, timerExpired: false, safeZoneZ: null },
    lastDetectedNote: null,
    _test: { forceCollision: null, triggerPause: null, resetGame: null, setVariant: null },
  };

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
        const lo = inst.tuning[0];
        const fretMin = Math.max(21, lo + 5);
        const fretMax = Math.min(108, lo + 8);
        state.rootMidi = fretMin <= fretMax
          ? Math.floor(Math.random() * (fretMax - fretMin + 1)) + fretMin
          : 60;
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
  const variantHud = el('div', { class: 'variant-indicator hidden', 'data-variant-track': '' });
  const overlay = el('div', { class: 'overlay hidden' });
  const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause');
  hud.appendChild(expectedEl);
  hud.appendChild(feedbackEl);
  hud.appendChild(pauseBtn);
  // game-wrap fills the shell absolutely; canvas, overlay, hud all position within it.
  const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay, hud, variantHud);
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
  let prevFretPos = null;

  // Variant state mirrors backend (feature 008-track-variants).
  // shownVariantId tracks which variant we've already rendered in the scene.
  let proposePending = false;
  let shownVariantId = null;
  let activeVariant = null; // last seen from polling
  let activeWindow = null;
  let pendingVariantPropose = null; // AC-6: deferred safe zone when findTransitionWave returned null

  // Lightweight oscillator cue (no asset). Plays a 3-note arpeggio when a
  // variant appears so the player gets an audible "switch available" signal.
  let cueCtx = null;
  function playVariantCue() {
    try {
      if (!cueCtx) cueCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = cueCtx.currentTime;
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
      freqs.forEach((f, i) => {
        const osc = cueCtx.createOscillator();
        const gain = cueCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.connect(gain).connect(cueCtx.destination);
        const start = now + i * 0.08;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch (_) { /* audio unavailable: cue is best-effort */ }
  }

  function updateVariantHud() {
    if (!activeVariant || !activeWindow) {
      variantHud.classList.add('hidden');
      variantHud.textContent = '';
      return;
    }
    const name = midiToName(activeVariant.root_midi);
    const side = activeVariant.side.toLowerCase();
    if (scene.isVariantSafeZoneAdjacent()) {
      variantHud.textContent = `SWITCH → ${name} ← NOW`;
    } else {
      variantHud.textContent = `Switch → ${name} (${side})`;
    }
    variantHud.classList.remove('hidden');
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
      if (notesResp.base_fret !== undefined) {
        scene.setBaseFret(notesResp.base_fret, notesResp.num_lanes);
      }
      scene.reset();
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

      // Transition-wave tracking for variant safe zone timing (story 5-7, AC-5).
      const ascendingNoteCount = notesResp.ascending_note_count;
      const apexMidi = ascendingNoteCount > 0
        ? (notesResp.notes[ascendingNoteCount - 1]?.midi ?? null)
        : null;
      const rootMidi = notesResp.notes[0]?.midi ?? null;
      function findTransitionWave(side) {
        const targetMidi = side === 'RIGHT' ? apexMidi : rootMidi;
        if (!targetMidi) return null;
        const game_now = performance.now() - gameStartTime;
        return waveScheduler.waves
          .filter(w => w.safe_midi === targetMidi)
          .sort((a, b) =>
            (a.spawn_time_ms + a.duration_ms - game_now) -
            (b.spawn_time_ms + b.duration_ms - game_now)
          )
          .find(w => w.spawn_time_ms + w.duration_ms >= game_now) ?? null;
      }

      // Start the rendering loop so we can see the initial state
      let _pausedAt = null;
      let gameStartTime = 0; // set after audio setup so countdownStart is accurate
      const loop = (now) => {
        if (!run) return;

        // Use visual collision detection as the primary failure source.
        // Invincible mode (debug): skip the failure transition entirely.
        if (run.state === 'running' && !state.invincible && scene.checkCollision()) {
          run.state = 'failed';
        }

        run.tick(now);

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
          gameStartTime += now - _pausedAt;
          scene.setGameStartTime(gameStartTime);
          _pausedAt = null;
        }

        const game_now = now - gameStartTime;
        const speedMultiplier = 1.0; // TODO: wire run.speedMultiplier when available
        waveScheduler.tick(game_now, speedMultiplier);
        const waves = waveScheduler.waves;

        scene.setWaves(waves, now);
        safeZoneRenderer.update(waves, 0, (track) => laneX(track, notesResp.num_lanes), now, gameStartTime, currentInstrument());

        if (window.__gameState) {
          window.__gameState.scene.waveCount = waves.length;
        }

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
      const countdownStart = performance.now();
      gameStartTime = countdownStart + 3500;
      scene.setGameStartTime(gameStartTime);

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
        if (activeVariant) {
          gameClient.timeoutVariant().catch(() => {});
          shownVariantId = null;
          activeVariant = null;
          activeWindow = null;
          pendingVariantPropose = null;
          if (window.__gameState) {
            window.__gameState.variant.id = null;
            window.__gameState.variant.timerRunning = false;
            window.__gameState.variant.timerMs = 0;
          }
          updateVariantHud();
        }
      });

      audio.onDetection(async (det) => {
        if (!run || run.state !== 'running') return;

        // Variant accept: gate on adjacency — safe zone must be at player position (AC-1).
        if (activeVariant && activeWindow && det && det.note && det.note.midi === activeWindow.trigger_midi
            && scene.isVariantSafeZoneAdjacent()) {
          const resp = await gameClient.acceptVariant(det.note.midi);
          if (resp && resp.success) {
            scene.acceptVariantTracks({ num_lanes: resp.num_lanes, base_fret: resp.base_fret }, resp.notes);
            if (run && resp.notes) {
              run.sequence = resp.notes;
              run.cursor = 1 % resp.notes.length;
              setExpected();
            }
            // Reset WaveScheduler to new note sequence; clear visual state
            if (resp.notes) waveScheduler.reset(resp.notes);
            scene.setWaves([], performance.now());
            safeZoneRenderer.reset();

            shownVariantId = null;
            activeVariant = null;
            activeWindow = null;
            pendingVariantPropose = null;
            updateVariantHud();
            return; // Don't treat as a normal expected-note input.
          }
        }

        const result = run.onDetection(det);
        if (result === 'accepted') {
          // Sync with backend
          const playResult = await gameClient.playNote(det.note.midi, performance.now() - run.startedAt);
          if (playResult && playResult.success) {
            if (playResult.game_state && playResult.game_state.current_track !== undefined) {
              scene.moveToTrack(playResult.game_state.current_track);
            }
            if (playResult.next_wave) {
              currentWaves.push(playResult.next_wave);
            }
          }

          feedbackEl.textContent = '✓';
          setExpected();
        } else if (result === 'rejected') {
          feedbackEl.textContent = '·';
        }
      });

      setExpected();

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
        activeVariant = pollState.active_variant || null;
        activeWindow = pollState.active_window || null;
        if (window.__gameState) {
          window.__gameState.variant.id = activeVariant ? activeVariant.variant_id : null;
          window.__gameState.variant.timerRunning = !!(activeVariant && activeWindow &&
            activeWindow.state === 'OPEN' && Date.now() < activeWindow.deadline_ms);
          window.__gameState.variant.timerMs = activeWindow
            ? Math.max(0, activeWindow.deadline_ms - Date.now()) : 0;
        }

        // Milestone trigger: ask backend to propose a variant if eligible.
        const loops = pollState.scale_passes_completed || 0;
        if (!activeVariant && !proposePending && loops >= 3) {
          proposePending = true;
          gameClient.proposeVariant().then((resp) => {
            proposePending = false;
            if (resp && resp.success) {
              // Will be picked up on next poll; render eagerly too.
              activeVariant = resp.variant;
              activeWindow = resp.window;
              if (window.__gameState) {
                window.__gameState.variant.id = resp.variant.variant_id;
                window.__gameState.variant.timerRunning = true;
                window.__gameState.variant.timerMs = Math.max(0, resp.window.deadline_ms - Date.now());
                window.__gameState.variant.timerExpired = false;
              }
              if (shownVariantId !== resp.variant.variant_id) {
                const tw = findTransitionWave(resp.variant.side);
                scene.proposeVariantTracks(resp.variant, tw);
                if (!tw) pendingVariantPropose = { variant: resp.variant, side: resp.variant.side };
                playVariantCue();
                shownVariantId = resp.variant.variant_id;
              }
            }
          }).catch(() => { proposePending = false; });
        }

        // Render variant if backend reports one we haven't shown yet.
        if (activeVariant && shownVariantId !== activeVariant.variant_id) {
          const tw = findTransitionWave(activeVariant.side);
          scene.proposeVariantTracks(activeVariant, tw);
          if (!tw) pendingVariantPropose = { variant: activeVariant, side: activeVariant.side };
          playVariantCue();
          shownVariantId = activeVariant.variant_id;
        }

        // Pending safe zone: retry findTransitionWave each poll (AC-6)
        if (pendingVariantPropose) {
          const w = findTransitionWave(pendingVariantPropose.side);
          if (w) {
            scene.updateVariantSafeZoneWave(w);
            pendingVariantPropose = null;
          }
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
    pendingVariantPropose = null;
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
            variantHud.classList.add('hidden');
            variantHud.textContent = '';
            return;
          }
          window.__gameState.variant.id = id;
          window.__gameState.variant.timerMs = durationMs;
          window.__gameState.variant.timerRunning = true;
          window.__gameState.variant.timerExpired = false;
          variantHud.classList.remove('hidden');
          variantHud.textContent = `Test variant: ${id} (${(durationMs / 1000).toFixed(1)}s)`;
          const start = Date.now();
          _timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, durationMs - elapsed);
            window.__gameState.variant.timerMs = remaining;
            if (remaining === 0) {
              window.__gameState.variant.timerExpired = true;
              window.__gameState.variant.timerRunning = false;
              window.__gameState.variant.id = null;
              variantHud.classList.add('hidden');
              variantHud.textContent = '';
              clearInterval(_timer);
              _timer = null;
            }
          }, 50);
        };
      })(),
    };
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
