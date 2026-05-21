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
    score: { current: 0, highScore: 0, distanceTraveled: 0 },
    collision: { lastCollisionType: null, lastCollisionTimestamp: null, invincibilityFrames: 0 },
    gameOver: { isGameOver: false, reason: null, triggeredAt: null },
    session: { phase: 'idle', pauseCount: 0, totalPausedMs: 0 },
    variant: { id: null, timerMs: 0, timerRunning: false, timerExpired: false },
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
  const variantHud = el('div', { class: 'variant-indicator hidden' });
  const overlay = el('div', { class: 'overlay hidden' });
  const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause');
  const abandonBtn = el('button', { class: 'abandon-btn hidden' }, 'Abandon');
  hud.appendChild(expectedEl);
  hud.appendChild(feedbackEl);
  hud.appendChild(pauseBtn);
  hud.appendChild(abandonBtn);
  // game-wrap fills the shell absolutely; canvas, overlay, hud all position within it.
  const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay, hud, variantHud);
  shell.appendChild(gameWrap);

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
  let rafId = null;
  let prevFretPos = null;

  // Variant state mirrors backend (feature 008-track-variants).
  // shownVariantId tracks which variant we've already rendered in the scene.
  let proposePending = false;
  let timeoutPending = false;
  let requiredTimestamp = 0;
  let shownVariantId = null;
  let activeVariant = null; // last seen from polling
  let activeWindow = null;

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
    const remain = Math.max(0, activeWindow.deadline_ms - Date.now());
    const secs = (remain / 1000).toFixed(1);
    const name = midiToName(activeVariant.root_midi);
    variantHud.classList.remove('hidden');
    variantHud.textContent = `Switch → ${name} (${activeVariant.side.toLowerCase()}) ${secs}s`;
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

      let currentWaves = notesResp.waves || [];
      const countdownStart = performance.now();
      // Set a future game start time so waves stay at spawn during countdown
      let gameStartTime = countdownStart + 3500; 
      scene.setGameStartTime(gameStartTime);

      // Start the rendering loop so we can see the initial state
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
          if (window.__gameState) {
            window.__gameState.gameOver.isGameOver = true;
            window.__gameState.gameOver.reason = 'collision';
            window.__gameState.gameOver.triggeredAt = Date.now();
          }
          showOverlay('Run failed! Collision detected.');
          cleanup();
          return;
        }

        // Update waves and safe zones
        if (currentWaves.length > 0) {
          scene.setWaves(currentWaves, now);
          safeZoneRenderer.update(currentWaves, 0, (track) => laneX(track, notesResp.num_lanes), now, gameStartTime, currentInstrument());
        }

        scene.render(now);
        rafId = requestAnimationFrame(loop);
      };
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
      abandonBtn.classList.remove('hidden');
      // Reuse the mic pipeline started on the setup screen; start fresh only if it failed.
      if (!audio) audio = await startAudio({ deviceId: state.audio.deviceId });
      audio.onDetection(async (det) => {
        if (!run || run.state !== 'running') return;

        // Variant accept: if a switch window is open and the detected midi
        // matches the variant's trigger, ask backend to finalize the switch.
        if (activeVariant && activeWindow && det && det.note && det.note.midi === activeWindow.trigger_midi) {
          const resp = await gameClient.acceptVariant(det.note.midi);
          if (resp && resp.success) {
            scene.acceptVariantTracks({ num_lanes: resp.num_lanes, base_fret: resp.base_fret });
            if (resp.required_timestamp_ms !== undefined) {
              requiredTimestamp = resp.required_timestamp_ms;
            }
            if (run && resp.notes) {
              run.sequence = resp.notes;
              run.cursor = 1 % resp.notes.length;
              setExpected();
            }
            // Clear waves immediately for visual feedback
            currentWaves = [];
            scene.setWaves([], performance.now());
            safeZoneRenderer.reset();

            shownVariantId = null;
            activeVariant = null;
            activeWindow = null;
            updateVariantHud();
            return; // Don't treat as a normal expected-note input.
          }
        }

        if (det && det.note && performance.now() - gameStartTime < requiredTimestamp) {
          feedbackEl.textContent = 'Too early!';
          return;
        }

        const result = run.onDetection(det);
        if (result === 'accepted') {
          // Sync with backend
          const playResult = await gameClient.playNote(det.note.midi, performance.now() - run.startedAt);
          if (playResult && playResult.success) {
            if (playResult.game_state && playResult.game_state.required_timestamp_ms !== undefined) {
              requiredTimestamp = playResult.game_state.required_timestamp_ms;
            }
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

        if (pollState.score !== undefined) {
          feedbackEl.textContent = `Score: ${pollState.score}`;
          if (window.__gameState) window.__gameState.score.current = pollState.score;
        }

        if (pollState.game_state && pollState.game_state.waves) {
            currentWaves = pollState.game_state.waves;
        }

        if (pollState.game_state && pollState.game_state.required_timestamp_ms !== undefined) {
            requiredTimestamp = pollState.game_state.required_timestamp_ms;
        }

        if (pollState.status === 'failed') {
          run.state = 'failed';
        }

        // Variant lifecycle (feature 008-track-variants).
        activeVariant = pollState.active_variant || null;
        activeWindow = pollState.active_window || null;

        // Milestone trigger: ask backend to propose a variant if eligible.
        const loops = pollState.octave_loops_completed || 0;
        if (!activeVariant && !proposePending && loops >= 2) {
          proposePending = true;
          gameClient.proposeVariant().then((resp) => {
            proposePending = false;
            if (resp && resp.success) {
              // Will be picked up on next poll; render eagerly too.
              activeVariant = resp.variant;
              activeWindow = resp.window;
              if (shownVariantId !== resp.variant.variant_id) {
                scene.proposeVariantTracks(resp.variant);
                playVariantCue();
                shownVariantId = resp.variant.variant_id;
              }
            }
          }).catch(() => { proposePending = false; });
        }

        // Render variant if backend reports one we haven't shown yet.
        if (activeVariant && shownVariantId !== activeVariant.variant_id) {
          scene.proposeVariantTracks(activeVariant);
          playVariantCue();
          shownVariantId = activeVariant.variant_id;
        }

        // Timeout: deadline reached, ask backend to finalize.
        if (activeVariant && activeWindow && !timeoutPending && Date.now() > activeWindow.deadline_ms) {
          timeoutPending = true;
          gameClient.timeoutVariant().then((resp) => {
            timeoutPending = false;
            if (resp && resp.success) {
              scene.dismissVariantTracks();
              shownVariantId = null;
              activeVariant = null;
              activeWindow = null;
            }
          }).catch(() => { timeoutPending = false; });
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
    // Keep the mic stream alive for the next run; just silence the detection handler.
    if (audio) { audio.onDetection(() => {}); }
    pauseBtn.classList.add('hidden');
    abandonBtn.classList.add('hidden');
    if (window.__gameState) {
      window.__gameState.session.phase = 'idle';
      window.__gameState.loop.running = false;
      window.__gameState.score.current = 0;
      window.__gameState.gameOver.isGameOver = false;
      window.__gameState.gameOver.reason = null;
      window.__gameState.gameOver.triggeredAt = null;
    }
    // Variant cleanup.
    if (scene.dismissVariantTracks) scene.dismissVariantTracks();
    shownVariantId = null;
    activeVariant = null;
    activeWindow = null;
    proposePending = false;
    timeoutPending = false;
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
      forceCollision: () => { if (run && run.state === 'running') run.state = 'failed'; },
      triggerPause: () => {
        if (!run) return;
        if (run.state === 'running') { run.pause(performance.now()); audio && audio.pause(); pauseBtn.textContent = 'Resume'; }
        else if (run.state === 'paused') { run.resume(performance.now()); audio && audio.resume(); pauseBtn.textContent = 'Pause'; }
      },
      resetGame: () => { if (run) { run.abandon(); cleanup(); } },
      setVariant: null,
    };
  }

  pauseBtn.addEventListener('click', () => {
    if (!run) return;
    if (run.state === 'running') {
      run.pause(performance.now()); audio && audio.pause(); pauseBtn.textContent = 'Resume';
      if (window.__gameState) window.__gameState.session.phase = 'paused';
    } else if (run.state === 'paused') {
      run.resume(performance.now()); audio && audio.resume(); pauseBtn.textContent = 'Pause';
      if (window.__gameState) window.__gameState.session.phase = 'playing';
    }
  });
  abandonBtn.addEventListener('click', () => {
    if (!run) return;
    run.abandon();
    showOverlay('Run abandoned.');
    cleanup();
  });

  // Pause on window blur
  window.addEventListener('blur', () => {
    if (run && run.state === 'running') {
      run.pause(performance.now());
      audio && audio.pause();
      pauseBtn.textContent = 'Resume';
    }
  });
  window.addEventListener('focus', () => {
    if (run && run.state === 'paused') {
      run.resume(performance.now());
      audio && audio.resume();
      pauseBtn.textContent = 'Pause';
    }
  });

}
