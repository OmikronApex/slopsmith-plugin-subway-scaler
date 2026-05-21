// Setup screen UI and session initialization logic.
// Handles form submission, localStorage persistence, and session-config API calls.

const SETTINGS_KEY = 'subway-scaler-settings';
const API = '/api/plugins/subway-scaler';

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

function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function computeRandomRootMidi(instrument) {
  if (!instrument || !instrument.tuning || !instrument.tuning[0]) return 60;
  const lowestString = instrument.tuning[0];
  const fretMin = lowestString + 5;
  const fretMax = lowestString + 8;
  return Math.floor(Math.random() * (fretMax - fretMin + 1)) + fretMin;
}

function createToggleGroup(name, options, defaultValue, onSelect) {
  const group = el('div', { class: 'toggle-group', role: 'group', 'aria-label': name });

  options.forEach((opt, idx) => {
    const display = typeof opt === 'object' ? opt.name : opt;
    const value = typeof opt === 'object' ? opt.id : opt;

    const btn = el('button',
      {
        class: `toggle-button ${value === defaultValue ? 'active' : ''}`,
        'data-value': value,
        type: 'button'
      },
      display
    );

    btn.addEventListener('click', () => {
      group.querySelectorAll('.toggle-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(value);
    });

    // Keyboard navigation: Arrow keys
    btn.addEventListener('keydown', (e) => {
      const buttons = Array.from(group.querySelectorAll('.toggle-button'));
      const btnIdx = buttons.indexOf(btn);

      if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && btnIdx > 0) {
        e.preventDefault();
        buttons[btnIdx - 1].focus();
        buttons[btnIdx - 1].click();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && btnIdx < buttons.length - 1) {
        e.preventDefault();
        buttons[btnIdx + 1].focus();
        buttons[btnIdx + 1].click();
      }
    });

    group.appendChild(btn);
  });

  return group;
}

export async function renderSetupScreen(root, scales, instruments, onGameStart) {
  const stored = loadSettings();

  const defaultScaleId = stored.scale_id || (scales.length > 0 ? scales[0].id : '');
  const defaultDifficulty = stored.difficulty || 'medium';
  const defaultInstrumentId = stored.instrument_id || (instruments.length > 0 ? instruments[0].id : '');

  let currentScaleId = defaultScaleId;
  let currentDifficulty = defaultDifficulty;
  let currentInstrumentId = defaultInstrumentId;

  const container = el('div', { class: 'setup-container' });
  const form = el('div', { class: 'setup-form' });

  // Scale selector
  const scaleGroup = el('div', { class: 'form-group' });
  scaleGroup.appendChild(el('label', { 'for': 'scale-select' }, 'Scale'));
  const scaleSelect = el('select', { id: 'scale-select' },
    ...scales.map(s => el('option',
      { value: s.id, ...(s.id === defaultScaleId ? { selected: 'selected' } : {}) },
      s.name
    ))
  );
  scaleSelect.addEventListener('change', (e) => {
    currentScaleId = e.target.value;
  });
  scaleGroup.appendChild(scaleSelect);
  form.appendChild(scaleGroup);

  // Difficulty toggle
  const diffGroup = el('div', { class: 'form-group' });
  diffGroup.appendChild(el('label', {}, 'Difficulty'));
  const diffToggle = createToggleGroup(
    'Difficulty',
    ['easy', 'medium', 'hard'],
    defaultDifficulty,
    (val) => { currentDifficulty = val; }
  );
  diffGroup.appendChild(diffToggle);
  form.appendChild(diffGroup);

  // Instrument toggle
  const instGroup = el('div', { class: 'form-group' });
  instGroup.appendChild(el('label', {}, 'Instrument'));
  const instToggle = createToggleGroup(
    'Instrument',
    instruments.map(i => ({ id: i.id, name: i.name })),
    defaultInstrumentId,
    (val) => { currentInstrumentId = val; }
  );
  instGroup.appendChild(instToggle);
  form.appendChild(instGroup);

  // Root label
  const rootLabel = el('div', { class: 'form-group' });
  rootLabel.appendChild(el('label', {}, 'Root: randomised fret 5–8'));
  form.appendChild(rootLabel);

  // Error message (hidden by default)
  const errorMsg = el('div', {
    class: 'error-message',
    role: 'alert',
    'aria-live': 'assertive'
  }, 'Couldn\'t load session — check your connection and try again');
  form.appendChild(errorMsg);

  // START button
  const startBtn = el('button',
    { class: 'start-button', type: 'button' },
    'START'
  );

  let isLoading = false;
  startBtn.addEventListener('click', async () => {
    if (isLoading) return;

    errorMsg.classList.remove('visible');
    isLoading = true;
    startBtn.disabled = true;

    try {
      const selectedInst = instruments.find(i => i.id === currentInstrumentId);
      const rootMidi = computeRandomRootMidi(selectedInst);

      // Save to localStorage (but not root_midi)
      saveSettings({
        scale_id: currentScaleId,
        difficulty: currentDifficulty,
        instrument_id: currentInstrumentId
      });

      // Call session-config endpoint
      const response = await fetchJson(
        `${API}/game/session-config?scale_id=${encodeURIComponent(currentScaleId)}&root_midi=${rootMidi}&instrument_id=${encodeURIComponent(currentInstrumentId)}`
      );

      // On success, call the callback
      onGameStart(response);
    } catch (err) {
      // Show error message and re-enable button
      errorMsg.classList.add('visible');
      startBtn.disabled = false;
      isLoading = false;
    }
  });

  // Tab order and keyboard handling
  scaleSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      instToggle.querySelector('.toggle-button').focus();
    }
  });

  const firstDiffBtn = diffToggle.querySelector('.toggle-button');
  if (firstDiffBtn) {
    firstDiffBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        instToggle.querySelector('.toggle-button').focus();
      }
    });
  }

  const lastInstBtn = Array.from(instToggle.querySelectorAll('.toggle-button')).pop();
  if (lastInstBtn) {
    lastInstBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        startBtn.focus();
      }
    });
  }

  startBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      instToggle.querySelector('.toggle-button').focus();
    }
  });

  form.appendChild(startBtn);
  container.appendChild(form);

  root.innerHTML = '';
  root.appendChild(container);
}
