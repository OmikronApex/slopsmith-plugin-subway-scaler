const HUD_DETAIL_KEY = 'subway-scaler-hud-detail';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_NAMES = {
  'major':             'Major',
  'natural-minor':     'Natural Minor',
  'minor-pentatonic':  'Minor Pentatonic',
  'major-pentatonic':  'Major Pentatonic',
  'blues':             'Blues',
  'harmonic-minor':    'Harmonic Minor',
  'dorian':            'Dorian',
  'mixolydian':        'Mixolydian',
};

function midiToNoteName(midi) {
  return NOTE_NAMES[midi % 12];
}

function readDetailPref() {
  try {
    return localStorage.getItem(HUD_DETAIL_KEY) || 'full';
  } catch (_) {
    return 'full';
  }
}

export class FretBox {
  constructor() {
    this._panel = document.createElement('div');
    this._panel.className = 'hud-fret-box fretbox-visible fret-detail-full';
    this._panel.setAttribute('role', 'img');
    this._panel.setAttribute('aria-label', 'Finger pattern');

    this._panel.style.position = 'absolute';

    this._detailMode = readDetailPref();
    this._applyDetailClass();

    this._lastPayload = null;
  }

  register(shell) {
    shell.registerChild('fretbox', this._panel);
  }

  render({ notes, scale_id, root_midi, instrument_id } = {}) {
    this._lastPayload = { notes, scale_id, root_midi, instrument_id };
    this._panel.innerHTML = '';

    if (!notes || notes.length === 0) {
      const ph = document.createElement('span');
      ph.className = 'fret-placeholder';
      ph.textContent = 'No session';
      this._panel.appendChild(ph);
      this._panel.setAttribute('aria-label', 'No finger pattern data');
      return this;
    }

    // Determine string count from notes (max string index, 1-based from high)
    const maxStringIdx = Math.max(...notes.map(n => n.string));
    const stringCount = maxStringIdx;

    // Fret range calculation
    const frets = notes.map(n => n.fret);
    const minFret = Math.max(1, Math.min(...frets));
    const maxFret = Math.max(...frets);
    let startFret = Math.max(1, minFret - 1);
    let endFret = maxFret;
    let numFrets = endFret - startFret + 1;

    if (numFrets < 4) {
      const centre = minFret === maxFret ? minFret : Math.floor((minFret + maxFret) / 2);
      startFret = Math.max(1, centre - 2);
      endFret = startFret + 3;
      numFrets = 4;
    }

    // ARIA label
    const scaleName = SCALE_NAMES[scale_id] || scale_id || 'Scale';
    const rootName = root_midi != null ? midiToNoteName(root_midi) : '';
    const rootNote = notes.find(n => n.midi === root_midi);
    const rootFret = rootNote?.fret ?? '?';
    this._panel.setAttribute('aria-label',
      `Finger pattern for ${scaleName}${rootName ? ' — Root ' + rootName : ''}, root fret ${rootFret}`);

    // Scale label (Full mode)
    const labelEl = document.createElement('span');
    labelEl.className = 'fret-scale-label';
    labelEl.textContent = `${scaleName}${rootName ? ' — Root ' + rootName : ''}`;
    this._panel.appendChild(labelEl);

    // Build note lookup: (string×fret) -> note
    const noteMap = new Map();
    for (const note of notes) {
      noteMap.set(`${note.string}:${note.fret}`, note);
    }

    const colTemplate = `repeat(${numFrets}, 1fr)`;

    // Header row: spacer (matches strip width) + fret number grid
    // The spacer keeps numbers aligned over the grid columns when strip is visible.
    const header = document.createElement('div');
    header.className = 'fret-header';

    const spacer = document.createElement('div');
    spacer.className = 'fret-header-spacer';
    header.appendChild(spacer);

    const fretNumRow = document.createElement('div');
    fretNumRow.className = 'fret-numbers-row';
    fretNumRow.style.gridTemplateColumns = colTemplate;
    for (let f = startFret; f <= endFret; f++) {
      const fn = document.createElement('span');
      fn.className = 'fret-number';
      fn.textContent = String(f);
      fretNumRow.appendChild(fn);
    }
    header.appendChild(fretNumRow);
    this._panel.appendChild(header);

    // Content row: strip + flat CSS grid
    const contentRow = document.createElement('div');
    contentRow.className = 'fret-content-row';

    // String colour strip — always in DOM so layout is stable in both detail modes.
    // Opacity is toggled by CSS class instead of display:none.
    const strip = document.createElement('div');
    strip.className = 'fret-string-strip';
    for (let r = 0; r < stringCount; r++) {
      const stripRow = document.createElement('div');
      stripRow.className = 'fret-string-strip-row';
      stripRow.style.background = `var(--color-string-${r})`;
      strip.appendChild(stripRow);
    }
    contentRow.appendChild(strip);

    // Flat CSS grid — one cell per (string × fret) combination.
    // Using CSS grid guarantees every column is exactly the same width regardless
    // of whether a cell is empty or occupied by a note box.
    const grid = document.createElement('div');
    grid.className = 'fret-grid';
    grid.style.gridTemplateColumns = colTemplate;

    for (let r = 0; r < stringCount; r++) {
      const backendString = r + 1; // 1 = highest pitch = top row
      const paletteIdx = stringCount - backendString;

      for (let f = startFret; f <= endFret; f++) {
        const noteAtCell = noteMap.get(`${backendString}:${f}`);
        if (noteAtCell) {
          const cell = document.createElement('div');
          cell.className = 'fret-cell-note';
          if (noteAtCell.midi === root_midi) cell.classList.add('fret-cell-root');
          cell.style.borderColor = `var(--color-string-${paletteIdx})`;
          const fill = document.createElement('div');
          fill.className = 'fret-cell-note-fill';
          fill.style.background = `var(--color-string-${paletteIdx})`;
          fill.style.opacity = '0.75';
          fill.style.filter = 'brightness(1.2)';
          cell.appendChild(fill);
          grid.appendChild(cell);
        } else {
          const cell = document.createElement('div');
          cell.className = 'fret-cell';
          grid.appendChild(cell);
        }
      }
    }

    contentRow.appendChild(grid);

    this._panel.appendChild(contentRow);

    this._applyDetailClass();
    return this;
  }

  fadeOut() {
    if (this._panel) {
      this._panel.classList.remove('fretbox-visible');
      this._panel.classList.add('fretbox-hidden');
    }
  }

  fadeIn() {
    if (this._panel) {
      this._panel.classList.remove('fretbox-hidden');
      this._panel.classList.add('fretbox-visible');
    }
  }

  get transitioning() {
    return this._panel
      ? this._panel.classList.contains('fretbox-hidden') || this._panel.classList.contains('fretbox-visible')
      : false;
  }

  setDetailMode(mode) {
    this._detailMode = mode === 'basic' ? 'basic' : 'full';
    try { localStorage.setItem(HUD_DETAIL_KEY, this._detailMode); } catch (_) {}
    this._applyDetailClass();
  }

  _applyDetailClass() {
    if (!this._panel) return;
    this._panel.classList.remove('fret-detail-basic', 'fret-detail-full');
    this._panel.classList.add(this._detailMode === 'basic' ? 'fret-detail-basic' : 'fret-detail-full');
  }

  destroy() {
    this._panel?.remove();
    this._panel = null;
    this._lastPayload = null;
  }
}
