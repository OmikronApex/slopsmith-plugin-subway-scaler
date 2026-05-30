// Setup screen UI and session initialization logic.
// Handles form submission, localStorage persistence, and session-config API calls.

const SETTINGS_KEY = 'subway-scaler-settings';
const API = '/api/plugins/subway-scaler';

export { saveSettings, loadSettings };

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
  try {
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old data');
      try {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e2) {
        console.error('Failed to save settings:', e2);
      }
    } else {
      console.error('Failed to save settings:', e);
    }
  }
}

// ─── Instrument-kind + string-count helpers ───────────────────────────────────
const _INSTRUMENT_ID_MAP = {
  guitar: { 6: 'guitar-standard', 7: 'guitar-7-standard', 8: 'guitar-8-standard' },
  bass:   { 4: 'bass-4-standard',  5: 'bass-5-standard' },
};
const _STRING_COUNT_OPTIONS = { guitar: [6, 7, 8], bass: [4, 5] };
const _DEFAULT_STRING_COUNT  = { guitar: 6, bass: 4 };

function resolveInstrumentId(kind, stringCount) {
  return (_INSTRUMENT_ID_MAP[kind] ?? {})[stringCount] ?? 'guitar-standard';
}

function deriveKindAndCount(instrumentId) {
  for (const [kind, counts] of Object.entries(_INSTRUMENT_ID_MAP)) {
    for (const [count, id] of Object.entries(counts)) {
      if (id === instrumentId) return { kind, stringCount: Number(count) };
    }
  }
  return { kind: 'guitar', stringCount: 6 };
}
// ─────────────────────────────────────────────────────────────────────────────

function computeRandomRootMidi(instrument) {
  if (!instrument || !instrument.tuning || !instrument.tuning[0]) return 60;
  const lowestString = instrument.tuning[0];
  const fretMin = Math.max(21, lowestString + 5);
  const fretMax = Math.min(108, lowestString + 8);
  if (fretMin > fretMax) return 60;
  return Math.floor(Math.random() * (fretMax - fretMin + 1)) + fretMin;
}

function createToggleGroup(name, options, defaultValue, onSelect) {
  const group = el('div', { class: 'toggle-group', role: 'radiogroup', 'aria-label': name });
  const buttons = [];

  options.forEach((opt) => {
    const display = typeof opt === 'object' ? opt.name : opt;
    const value = typeof opt === 'object' ? opt.id : opt;
    const isDefault = value === defaultValue;

    const btn = el('button',
      {
        class: `toggle-button ${isDefault ? 'selected' : ''}`,
        'data-value': value,
        type: 'button',
        role: 'radio',
        'aria-checked': isDefault ? 'true' : 'false',
      },
      display
    );

    btn.addEventListener('click', () => {
      const wasSelected = btn.classList.contains('selected');
      group.querySelectorAll('.toggle-button').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      if (!wasSelected) onSelect(value);
    });

    btn.addEventListener('keydown', (e) => {
      const idx = buttons.indexOf(btn);
      let nextIdx = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = (idx + 1) % buttons.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = (idx - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = buttons.length - 1;
      } else {
        return;
      }
      buttons[nextIdx].focus();
      buttons[nextIdx].click();
    });

    buttons.push(btn);
    group.appendChild(btn);
  });

  return group;
}

export async function renderSetupScreen(root, scales, instruments, onGameStart) {
  // Validate input data
  if (!scales || scales.length === 0) {
    root.innerHTML = '<div style="color: red; padding: 1rem;">Error: No scales available</div>';
    return;
  }
  if (!instruments || instruments.length === 0) {
    root.innerHTML = '<div style="color: red; padding: 1rem;">Error: No instruments available</div>';
    return;
  }

  const stored = loadSettings();

  // Create setup section with title
  const setupSection = el('div', { class: 'setup-section' });

  const defaultScaleId = stored.scale_id || scales[0].id;
  const defaultDifficulty = stored.difficulty || 'medium';
  const defaultInstrumentId = stored.instrument_id || 'guitar-standard';

  let currentScaleId = defaultScaleId;
  let currentDifficulty = defaultDifficulty;
  let { kind: currentKind, stringCount: currentStringCount } = deriveKindAndCount(defaultInstrumentId);
  let currentInstrumentId = resolveInstrumentId(currentKind, currentStringCount);

  // Add title
  setupSection.appendChild(el('div', { class: 'game-title' }, 'SUBWAY SCALER'));

  const container = el('div', { class: 'setup-container' });
  const form = el('div', { class: 'setup-form', role: 'form', 'aria-label': 'Session Setup' });

  // Scale selector (full width in grid)
  const scaleGroup = el('div', { class: 'form-group full-width' });
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
  const diffLabel = el('label', { id: 'label-difficulty' }, 'Difficulty');
  diffGroup.appendChild(diffLabel);
  const diffToggle = createToggleGroup(
    'Difficulty',
    ['easy', 'medium', 'hard'],
    defaultDifficulty,
    (val) => { currentDifficulty = val; }
  );
  diffToggle.setAttribute('aria-labelledby', 'label-difficulty');
  diffGroup.appendChild(diffToggle);
  form.appendChild(diffGroup);

  // Instrument kind toggle (Guitar / Bass)
  const instGroup = el('div', { class: 'form-group' });
  const instLabel = el('label', { id: 'label-instrument' }, 'Instrument');
  instGroup.appendChild(instLabel);
  const instToggle = createToggleGroup(
    'Instrument',
    [{ id: 'guitar', name: 'Guitar' }, { id: 'bass', name: 'Bass' }],
    currentKind,
    (val) => {
      currentKind = val;
      currentStringCount = _DEFAULT_STRING_COUNT[val];
      currentInstrumentId = resolveInstrumentId(val, currentStringCount);
      // Rebuild string count control for the new kind, then re-wire tab order
      const old = stringCountGroup.querySelector('.toggle-group');
      if (old) old.remove();
      stringCountGroup.appendChild(buildStringCountToggle(currentKind, currentStringCount));
      if (typeof wireStringCountTabOrder === 'function') {
        lastStrBtn = wireStringCountTabOrder();
      }
    }
  );
  instToggle.setAttribute('aria-labelledby', 'label-instrument');
  instGroup.appendChild(instToggle);
  form.appendChild(instGroup);

  // Number of Strings toggle
  function buildStringCountToggle(kind, selected) {
    return createToggleGroup(
      'Number of Strings',
      _STRING_COUNT_OPTIONS[kind].map(n => ({ id: String(n), name: String(n) })),
      String(selected),
      (val) => {
        currentStringCount = Number(val);
        currentInstrumentId = resolveInstrumentId(currentKind, currentStringCount);
      }
    );
  }
  const stringCountGroup = el('div', { class: 'form-group' });
  stringCountGroup.appendChild(el('label', { id: 'label-strings' }, 'Number of Strings'));
  stringCountGroup.appendChild(buildStringCountToggle(currentKind, currentStringCount));
  form.appendChild(stringCountGroup);

  // Root label
  const rootLabel = el('div', { class: 'form-group' });
  rootLabel.appendChild(el('label', {}, 'Root: 5th fret of lowest string'));
  form.appendChild(rootLabel);

  // Debug logging checkbox
  const storedDebug = stored.debug_logging === true;
  let currentDebugLogging = storedDebug;
  const debugGroup = el('div', { class: 'form-group full-width' });
  const debugLabel = el('label', { for: 'debug-logging' }, 'Debug logging');
  const debugCheckbox = el('input', {
    type: 'checkbox',
    id: 'debug-logging',
    class: 'debug-checkbox',
    ...(storedDebug ? { checked: 'checked' } : {}),
  });
  debugCheckbox.addEventListener('change', (e) => {
    currentDebugLogging = e.target.checked;
  });
  debugGroup.appendChild(debugLabel);
  debugGroup.appendChild(debugCheckbox);
  form.appendChild(debugGroup);

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
  let lastRequestTime = 0;
  const REQUEST_TIMEOUT = 5000; // Prevent duplicate requests within 5s

  startBtn.addEventListener('click', async () => {
    // Prevent concurrent and duplicate requests
    if (isLoading) return;
    const now = Date.now();
    if (now - lastRequestTime < REQUEST_TIMEOUT) return;

    // Clear error message and prepare for new request
    errorMsg.classList.remove('visible');
    errorMsg.textContent = 'Couldn\'t load session — check your connection and try again';

    isLoading = true;
    lastRequestTime = now;
    startBtn.disabled = true;

    try {
      const selectedInst = instruments.find(i => i.id === currentInstrumentId);
      if (!selectedInst) throw new Error('Invalid instrument selection');

      const rootMidi = selectedInst?.tuning?.[0] != null ? selectedInst.tuning[0] + 5 : 60;

      // Save to localStorage (but not root_midi)
      saveSettings({
        scale_id: currentScaleId,
        difficulty: currentDifficulty,
        instrument_id: currentInstrumentId,
        debug_logging: currentDebugLogging,
      });

      // Call session-config endpoint with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetchJson(
        `${API}/game/session-config?scale_id=${encodeURIComponent(currentScaleId)}&root_midi=${rootMidi}&instrument_id=${encodeURIComponent(currentInstrumentId)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      // On success, call the callback and reset state
      isLoading = false;
      errorMsg.classList.remove('visible');
      errorMsg.textContent = '';
      startBtn.disabled = false;
      onGameStart({ ...response, debug_logging: currentDebugLogging });
    } catch (err) {
      // Show error message with context
      const errMsg = err.name === 'AbortError'
        ? 'Request timed out — please try again'
        : 'Couldn\'t load session — check your connection and try again';
      errorMsg.textContent = errMsg;
      errorMsg.classList.add('visible');

      // Reset button state and manage focus
      startBtn.disabled = false;
      isLoading = false;
      // Move focus to error message for accessibility
      setTimeout(() => {
        errorMsg.focus();
      }, 100);
    }
  });

  // Tab order: Scale → Difficulty → Instrument (kind) → Number of Strings → START
  scaleSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const firstDiffBtn = diffToggle.querySelector('.toggle-button');
      if (firstDiffBtn) firstDiffBtn.focus();
    }
  });

  const firstDiffBtn = diffToggle.querySelector('.toggle-button');
  if (firstDiffBtn) {
    firstDiffBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const firstInstBtn = instToggle.querySelector('.toggle-button');
        if (firstInstBtn) firstInstBtn.focus();
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        scaleSelect.focus();
      }
    });
  }

  const diffBtns = Array.from(diffToggle.querySelectorAll('.toggle-button'));
  const lastDiffBtn = diffBtns[diffBtns.length - 1];

  // Difficulty buttons tab wiring
  diffBtns.forEach((btn, idx) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey && idx === diffBtns.length - 1) {
        e.preventDefault();
        const firstInstBtn = instToggle.querySelector('.toggle-button');
        if (firstInstBtn) firstInstBtn.focus();
      } else if (e.key === 'Tab' && e.shiftKey && idx === 0) {
        e.preventDefault();
        scaleSelect.focus();
      }
    });
  });

  // Instrument kind buttons tab wiring: last → first string-count button
  const instBtns = Array.from(instToggle.querySelectorAll('.toggle-button'));
  const lastInstBtn = instBtns[instBtns.length - 1];

  instBtns.forEach((btn, idx) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey && idx === instBtns.length - 1) {
        e.preventDefault();
        const firstStrBtn = stringCountGroup.querySelector('.toggle-button');
        if (firstStrBtn) firstStrBtn.focus();
      } else if (e.key === 'Tab' && e.shiftKey && idx === 0) {
        e.preventDefault();
        const focusBtn = lastDiffBtn || firstDiffBtn;
        if (focusBtn) focusBtn.focus();
      }
    });
  });

  // String count buttons tab wiring: last → START, first → last kind button
  function wireStringCountTabOrder() {
    const strBtns = Array.from(stringCountGroup.querySelectorAll('.toggle-button'));
    const lastStrBtn = strBtns[strBtns.length - 1];
    strBtns.forEach((btn, idx) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey && idx === strBtns.length - 1) {
          e.preventDefault();
          startBtn.focus();
        } else if (e.key === 'Tab' && e.shiftKey && idx === 0) {
          e.preventDefault();
          if (lastInstBtn) lastInstBtn.focus();
        }
      });
    });
    return lastStrBtn;
  }
  let lastStrBtn = wireStringCountTabOrder();

  startBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const strBtns = stringCountGroup.querySelectorAll('.toggle-button');
      const last = strBtns[strBtns.length - 1];
      if (last) last.focus();
    }
  });

  form.appendChild(startBtn);
  setupSection.appendChild(form);
  container.appendChild(setupSection);

  root.innerHTML = '';
  root.appendChild(container);
}

// ===== SetupScreen class (exposes DOM refs for unit testing and ARIA validation) =====

export class SetupScreen {
  constructor() {
    this.keyboardNavigationEnabled = true;

    // Form element with ARIA
    this.formElement = document.createElement('div');
    this.formElement.setAttribute('role', 'form');
    this.formElement.setAttribute('aria-label', 'Session Setup');

    // Difficulty group
    this.difficultyGroup = document.createElement('div');
    this.difficultyGroup.setAttribute('role', 'radiogroup');
    this.difficultyGroup.setAttribute('aria-label', 'Difficulty');

    const difficultyValues = ['easy', 'medium', 'hard'];
    this.difficultyOptions = difficultyValues.map((val, idx) => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', idx === 1 ? 'true' : 'false'); // medium default
      btn.setAttribute('data-value', val);
      btn.textContent = val;
      btn.focus = btn.focus || (() => {});
      return btn;
    });

    // Instrument group
    this.instrumentGroup = document.createElement('div');
    this.instrumentGroup.setAttribute('role', 'radiogroup');
    this.instrumentGroup.setAttribute('aria-label', 'Instrument');

    this.instrumentOptions = ['guitar-standard', 'bass-4-standard'].map((val, idx) => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', idx === 0 ? 'true' : 'false');
      btn.setAttribute('data-value', val);
      btn.textContent = val;
      btn.focus = btn.focus || (() => {});
      return btn;
    });

    this.onToggleGroupKeyDown = ({ key, target, preventDefault }) => {
      const idx = this.difficultyOptions.indexOf(target);
      if (idx === -1) return;
      let next = idx;
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        next = (idx + 1) % this.difficultyOptions.length;
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        next = (idx - 1 + this.difficultyOptions.length) % this.difficultyOptions.length;
      } else if (key === 'Home') {
        next = 0;
      } else if (key === 'End') {
        next = this.difficultyOptions.length - 1;
      } else {
        return;
      }
      if (preventDefault) preventDefault();
      this.difficultyOptions[next].focus();
    };
  }

  selectDifficulty(val) {
    this.difficultyOptions.forEach(btn => {
      const isMatch = btn.getAttribute('data-value') === val;
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });
  }
}
