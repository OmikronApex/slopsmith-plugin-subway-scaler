// Subway Scaler game bootstrap.
// Wires the menu UI, run lifecycle, audio pipeline, run state machine, and 3D scene.

import { createScene } from './scene.js';
import { startAudio, enumerateInputs } from './audio.js';
import { Run, difficultyToTimePerNoteMs } from './runState.js';
import { quantize, midiToName } from './notes.js';
import { resolve as resolveFretboard } from './fretboard.js';
import { GameClient } from './game-client.js';
import { SafeZoneRenderer } from './ui/SafeZoneRenderer.js';
import { laneX } from './grid.js';

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

function rootSelectOptions(selectedMidi, instrument) {
  // Start from the first fret of the lowest string of the instrument
  const min = (instrument && instrument.tuning) ? (instrument.tuning[0] + 1) : 36;
  const max = 95;
  const opts = [];
  for (let m = min; m <= max; m++) {
    opts.push(el('option', { value: String(m), ...(m === selectedMidi ? { selected: 'selected' } : {}) }, midiToName(m)));
  }
  return opts;
}

export async function bootstrap(root) {
  if (!root) return;
  root.innerHTML = '';
  root.className = 'subway-scaler';

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

  // --- Menu state ---
  const state = {
    scaleId: settings.lastScaleId,
    rootMidi: settings.lastRootMidi,
    difficulty: settings.lastDifficulty,
    strictOctave: settings.strictOctave,
    instrumentId: settings.instrumentId || 'guitar-standard',
    strictTuning: !!settings.strictTuning,
    audio: { ...settings.audio },
  };

  function currentInstrument() {
    return instruments.find(i => i.id === state.instrumentId) || instruments[0];
  }

  const menu = el('div', { class: 'menu' });
  const scaleSelect = el('select', {},
    ...scales.map(s => el('option', { value: s.id, ...(s.id === state.scaleId ? { selected: 'selected' } : {}) }, s.name)));
  scaleSelect.addEventListener('change', () => { state.scaleId = scaleSelect.value; });

  const rootSelect = el('select', {}, ...rootSelectOptions(state.rootMidi, currentInstrument()));
  rootSelect.addEventListener('change', () => { state.rootMidi = parseInt(rootSelect.value, 10); });

  const diffSelect = el('select', {},
    ...['easy', 'medium', 'hard'].map(d =>
      el('option', { value: d, ...(d === state.difficulty ? { selected: 'selected' } : {}) }, d)));
  diffSelect.addEventListener('change', () => { state.difficulty = diffSelect.value; });

  const strictChk = el('input', { type: 'checkbox', ...(state.strictOctave ? { checked: 'checked' } : {}) });
  strictChk.addEventListener('change', () => { state.strictOctave = strictChk.checked; });

  const instrumentSelect = el('select', {},
    ...instruments.map(i => el('option', { value: i.id, ...(i.id === state.instrumentId ? { selected: 'selected' } : {}) }, i.name)));
  instrumentSelect.addEventListener('change', () => { 
    state.instrumentId = instrumentSelect.value;
    const inst = currentInstrument();
    rootSelect.innerHTML = '';
    const newOpts = rootSelectOptions(state.rootMidi, inst);
    for (const o of newOpts) rootSelect.appendChild(o);
    
    const min = inst.tuning[0] + 1;
    if (state.rootMidi < min) {
      state.rootMidi = min;
      rootSelect.value = String(min);
    }
  });

  const startBtn = el('button', { class: 'start-btn' }, 'Start Run');
  const audioBtn = el('button', { class: 'audio-btn' }, 'Audio Settings');

  menu.appendChild(el('label', {}, 'Scale ', scaleSelect));
  menu.appendChild(el('label', {}, 'Root ', rootSelect));
  menu.appendChild(el('label', {}, 'Difficulty ', diffSelect));
  menu.appendChild(el('label', {}, 'Strict octave ', strictChk));
  menu.appendChild(el('label', {}, 'Instrument ', instrumentSelect));
  menu.appendChild(startBtn);
  menu.appendChild(audioBtn);
  root.appendChild(menu);

  // --- Game container ---
  const canvas = el('canvas', { class: 'game-canvas', width: '800', height: '450' });
  const hud = el('div', { class: 'hud' });
  const expectedEl = el('div', { class: 'expected' });
  const feedbackEl = el('div', { class: 'feedback' });
  const overlay = el('div', { class: 'overlay hidden' });
  const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause');
  const abandonBtn = el('button', { class: 'abandon-btn hidden' }, 'Abandon');
  hud.appendChild(expectedEl);
  hud.appendChild(feedbackEl);
  hud.appendChild(pauseBtn);
  hud.appendChild(abandonBtn);
  const gameWrap = el('div', { class: 'game-wrap' }, canvas, hud, overlay);
  root.appendChild(gameWrap);

  // --- Audio settings panel ---
  const audioPanel = el('div', { class: 'audio-panel hidden' });
  const deviceSel = el('select', {});
  const tunerEl = el('div', { class: 'tuner' }, '—');
  const tolInput = el('input', { type: 'range', min: '1', max: '100', value: String(state.audio.toleranceCents) });
  const confInput = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(state.audio.confidenceThreshold * 100)) });
  const stabInput = el('input', { type: 'number', min: '1', max: '10', value: String(state.audio.stabilityFrames) });
  audioPanel.appendChild(el('h3', {}, 'Audio Settings'));
  audioPanel.appendChild(el('label', {}, 'Input Device ', deviceSel));
  audioPanel.appendChild(el('div', { class: 'tuner-wrap' }, 'Live: ', tunerEl));
  audioPanel.appendChild(el('label', {}, 'Tolerance (cents) ', tolInput));
  audioPanel.appendChild(el('label', {}, 'Confidence threshold (×100) ', confInput));
  audioPanel.appendChild(el('label', {}, 'Stability frames ', stabInput));
  const closeAudio = el('button', {}, 'Close');
  audioPanel.appendChild(closeAudio);
  root.appendChild(audioPanel);

  const scene = createScene(canvas);
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
    if (startBtn.disabled && run && run.state === 'running') return;
    startBtn.disabled = true;
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
        
        // Use visual collision detection as the primary failure source
        if (run.state === 'running' && scene.checkCollision()) {
          run.state = 'failed';
        }

        run.tick(now);
        if (run.state === 'succeeded') {
          scene.showSuccess();
          showOverlay('Success! Scale complete.');
          cleanup();
          return;
        }
        if (run.state === 'failed') {
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
      audio = await startAudio({ deviceId: state.audio.deviceId });
      audio.onDetection(async (det) => {
        if (!run || run.state !== 'running') return;
        
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
        if (det && det.note) {
          tunerEl.textContent = `${det.note.name} ${det.centsOffset >= 0 ? '+' : ''}${Math.round(det.centsOffset)}¢`;
        }
      });

      setExpected();

      gameClient.startPolling((pollState) => {
        if (!pollState) return;
        
        if (pollState.score !== undefined) {
           feedbackEl.textContent = `Score: ${pollState.score}`;
        }
        
        if (pollState.game_state && pollState.game_state.waves) {
            currentWaves = pollState.game_state.waves;
        }

        if (pollState.status === 'failed') {
          run.state = 'failed';
        }
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
    if (audio) { audio.stop(); audio = null; }
    pauseBtn.classList.add('hidden');
    abandonBtn.classList.add('hidden');
    startBtn.disabled = false;
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

  startBtn.addEventListener('click', () => start());
  pauseBtn.addEventListener('click', () => {
    if (!run) return;
    if (run.state === 'running') { run.pause(performance.now()); audio && audio.pause(); pauseBtn.textContent = 'Resume'; }
    else if (run.state === 'paused') { run.resume(performance.now()); audio && audio.resume(); pauseBtn.textContent = 'Pause'; }
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

  // --- Audio settings wiring ---
  audioBtn.addEventListener('click', async () => {
    audioPanel.classList.remove('hidden');
    try {
      const devs = await enumerateInputs();
      deviceSel.innerHTML = '';
      deviceSel.appendChild(el('option', { value: '' }, 'Default'));
      for (const d of devs) {
        const opt = el('option', { value: d.deviceId }, d.label || 'Unnamed input');
        if (d.deviceId === state.audio.deviceId) opt.selected = true;
        deviceSel.appendChild(opt);
      }
    } catch (err) {
      deviceSel.innerHTML = '';
      deviceSel.appendChild(el('option', {}, `Cannot list devices: ${err.message}`));
    }

    // Live tuner
    let tunerAudio = audio;
    if (!tunerAudio) {
      try {
        tunerAudio = await startAudio({ deviceId: state.audio.deviceId });
        tunerAudio.onDetection(det => {
          if (det && det.note) {
            tunerEl.textContent = `${det.note.name} ${det.centsOffset >= 0 ? '+' : ''}${Math.round(det.centsOffset)}¢`;
          } else {
            tunerEl.textContent = '—';
          }
        });
        audioPanel._tuner = tunerAudio;
      } catch (err) {
        tunerEl.textContent = `mic unavailable: ${err.message}`;
      }
    }
  });

  let putTimer = null;
  function persistAudio() {
    clearTimeout(putTimer);
    putTimer = setTimeout(() => {
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
    }, 250);
  }

  deviceSel.addEventListener('change', async () => {
    state.audio.deviceId = deviceSel.value || null;
    state.audio.deviceLabel = deviceSel.options[deviceSel.selectedIndex].textContent;
    const tunerAudio = audioPanel._tuner;
    if (tunerAudio && tunerAudio.switchInput) {
      try { await tunerAudio.switchInput(state.audio.deviceId); } catch (_) {}
    }
    persistAudio();
  });
  tolInput.addEventListener('input', () => {
    state.audio.toleranceCents = parseInt(tolInput.value, 10);
    if (run) run.toleranceCents = state.audio.toleranceCents;
    persistAudio();
  });
  confInput.addEventListener('input', () => {
    state.audio.confidenceThreshold = parseInt(confInput.value, 10) / 100;
    if (run) run.confidenceThreshold = state.audio.confidenceThreshold;
    persistAudio();
  });
  stabInput.addEventListener('change', () => {
    state.audio.stabilityFrames = Math.max(1, Math.min(10, parseInt(stabInput.value, 10) || 3));
    if (run) run.stabilityFrames = state.audio.stabilityFrames;
    persistAudio();
  });
  closeAudio.addEventListener('click', () => {
    audioPanel.classList.add('hidden');
    if (audioPanel._tuner && audioPanel._tuner !== audio) {
      audioPanel._tuner.stop();
      audioPanel._tuner = null;
    }
  });
}
