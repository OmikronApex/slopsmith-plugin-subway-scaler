// Subway Scaler game bootstrap.
// Wires the menu UI, run lifecycle, audio pipeline, run state machine, and 3D scene.

import { createScene } from './scene.js';
import { startAudio, enumerateInputs } from './audio.js';
import { Run, difficultyToTimePerNoteMs } from './runState.js';
import { quantize, midiToName } from './notes.js';
import { resolve as resolveFretboard } from './fretboard.js';

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

function rootSelectOptions(selectedMidi) {
  // C2 (36) .. B6 (95)
  const opts = [];
  for (let m = 36; m <= 95; m++) {
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
    octaves: settings.lastOctaves,
    descending: false,
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

  const rootSelect = el('select', {}, ...rootSelectOptions(state.rootMidi));
  rootSelect.addEventListener('change', () => { state.rootMidi = parseInt(rootSelect.value, 10); });

  const octSelect = el('select', {},
    el('option', { value: '1', ...(state.octaves === 1 ? { selected: 'selected' } : {}) }, '1 octave'),
    el('option', { value: '2', ...(state.octaves === 2 ? { selected: 'selected' } : {}) }, '2 octaves'));
  octSelect.addEventListener('change', () => { state.octaves = parseInt(octSelect.value, 10); });

  const descChk = el('input', { type: 'checkbox', ...(state.descending ? { checked: 'checked' } : {}) });
  descChk.addEventListener('change', () => { state.descending = descChk.checked; });

  const diffSelect = el('select', {},
    ...['easy', 'medium', 'hard'].map(d =>
      el('option', { value: d, ...(d === state.difficulty ? { selected: 'selected' } : {}) }, d)));
  diffSelect.addEventListener('change', () => { state.difficulty = diffSelect.value; });

  const strictChk = el('input', { type: 'checkbox', ...(state.strictOctave ? { checked: 'checked' } : {}) });
  strictChk.addEventListener('change', () => { state.strictOctave = strictChk.checked; });

  const instrumentSelect = el('select', {},
    ...instruments.map(i => el('option', { value: i.id, ...(i.id === state.instrumentId ? { selected: 'selected' } : {}) }, i.name)));
  instrumentSelect.addEventListener('change', () => { state.instrumentId = instrumentSelect.value; });

  const startBtn = el('button', { class: 'start-btn' }, 'Start Run');
  const audioBtn = el('button', { class: 'audio-btn' }, 'Audio Settings');

  menu.appendChild(el('label', {}, 'Scale ', scaleSelect));
  menu.appendChild(el('label', {}, 'Root ', rootSelect));
  menu.appendChild(el('label', {}, 'Octaves ', octSelect));
  menu.appendChild(el('label', {}, 'Descending ', descChk));
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
  const timeBar = el('div', { class: 'time-bar' });
  const timeFill = el('div', { class: 'time-fill' });
  timeBar.appendChild(timeFill);
  const feedbackEl = el('div', { class: 'feedback' });
  const overlay = el('div', { class: 'overlay hidden' });
  const pauseBtn = el('button', { class: 'pause-btn hidden' }, 'Pause');
  const abandonBtn = el('button', { class: 'abandon-btn hidden' }, 'Abandon');
  hud.appendChild(expectedEl);
  hud.appendChild(timeBar);
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

  const VISIBLE_ROWS = 4; // rows of cart groups to show ahead of the player
  // Full per-sequence resolved positions. Indexed by note-sequence index.
  let sequencePositions = [];
  // Per-note row index: same value for consecutive same-string notes.
  let positionRowIdx = [];

  function buildSequencePositions(notes, inst) {
    const out = [];
    let prev = null;
    for (const n of notes) {
      const pos = resolveFretboard(n.midi, prev, inst);
      out.push(pos);
      if (pos) prev = pos;
    }
    return out;
  }

  // Compute row indices: consecutive positions sharing stringIdx share a row.
  // Nulls inherit the previous row index (best-effort).
  function buildRowIndices(positions) {
    const out = [];
    let cur = 0;
    let prev = null;
    for (const p of positions) {
      if (p == null) {
        out.push(cur);
        continue;
      }
      if (prev != null && p.stringIdx !== prev.stringIdx) cur += 1;
      out.push(cur);
      prev = p;
    }
    return out;
  }

  // Slice the current run's remaining sequence into VISIBLE_ROWS groups starting
  // at run.cursor and call scene.setQueue.
  function refreshSceneQueueFromRun() {
    if (!run) return;
    const start = run.cursor;
    if (start >= sequencePositions.length) {
      scene.setQueue([]);
      return;
    }
    const startRow = positionRowIdx[start];
    const visibleRows = [];
    for (let i = start; i < sequencePositions.length; i++) {
      const rowOffset = positionRowIdx[i] - startRow;
      if (rowOffset >= VISIBLE_ROWS) break;
      if (!visibleRows[rowOffset]) visibleRows[rowOffset] = [];
      visibleRows[rowOffset].push(sequencePositions[i]);
    }
    // Fill any gaps with empty arrays so indices stay correct.
    for (let k = 0; k < visibleRows.length; k++) if (!visibleRows[k]) visibleRows[k] = [];
    scene.setQueue(visibleRows);
  }

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
    // Roughly C2..C7
    for (const n of notes) {
      if (n.midi < 36 || n.midi > 96) return `Note ${n.name} (MIDI ${n.midi}) is outside the reliable detection range (C2–C7).`;
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
    const warning = null; // computed below from sequence
    try {
      const notesResp = await fetchJson(
        `${API}/scales/${encodeURIComponent(state.scaleId)}/notes?root_midi=${state.rootMidi}&octaves=${state.octaves}&descending=${state.descending}`,
      );
      const rangeMsg = rangeWarning(notesResp.notes);
      if (rangeMsg) {
        showOverlay(`Cannot start: ${rangeMsg}`);
        return;
      }
      // Persist last-used settings
      const merged = {
        lastScaleId: state.scaleId,
        lastRootMidi: state.rootMidi,
        lastOctaves: state.octaves,
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
      run.start(performance.now());
      // Resolve the full sequence to (string, fret) positions and seed the scene queue.
      sequencePositions = buildSequencePositions(notesResp.notes, currentInstrument());
      positionRowIdx = buildRowIndices(sequencePositions);
      refreshSceneQueueFromRun();
      setExpected();
      overlay.classList.add('hidden');
      feedbackEl.textContent = '';
      pauseBtn.classList.remove('hidden');
      abandonBtn.classList.remove('hidden');
      startBtn.disabled = true;

      audio = await startAudio({ deviceId: state.audio.deviceId });
      audio.onDetection(det => {
        if (!run) return;
        if (fretHud && det && det.note) {
          const st = scene._state ? scene._state() : null;
          fretHud.textContent = `${det.note.name}` + (st ? `  q=${st.queueLen} tracks=${st.trackCount} f=${st.activeFret}` : '');
        }
        const result = run.onDetection(det);
        if (result === 'accepted') {
          // Advance the visible queue. Recompute visible rows from the new cursor —
          // simpler than incrementally appending under the row-grouped model.
          scene.advanceQueue();
          refreshSceneQueueFromRun();
          feedbackEl.textContent = '✓';
          setExpected();
        } else if (result === 'rejected') {
          feedbackEl.textContent = '·';
        }
        if (det && det.note) {
          tunerEl.textContent = `${det.note.name} ${det.centsOffset >= 0 ? '+' : ''}${Math.round(det.centsOffset)}¢`;
        }
      });

      const loop = (now) => {
        if (!run) return;
        run.tick(now);
        const exp = run.currentExpected();
        if (exp) {
          const rem = Math.max(0, run.deadlineAt - now);
          timeFill.style.width = `${Math.round(100 * rem / run.timePerNoteMs)}%`;
        }
        if (run.state === 'succeeded') {
          scene.showSuccess();
          showOverlay('Success! Scale complete.');
          cleanup();
          return;
        }
        if (run.state === 'failed') {
          scene.dropOffCliff();
          showOverlay('Failed — carts off the cliff.');
          cleanup();
          return;
        }
        scene.render(now);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
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
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (audio) { audio.stop(); audio = null; }
    pauseBtn.classList.add('hidden');
    abandonBtn.classList.add('hidden');
    startBtn.disabled = false;
  }

  function showOverlay(msg) {
    overlay.textContent = msg;
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
        lastOctaves: state.octaves,
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
