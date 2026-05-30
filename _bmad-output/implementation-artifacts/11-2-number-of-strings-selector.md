# Story 11.2: Number of Strings Selector in Setup UI

Status: ready-for-dev

## Story

As a player,
I want a "Number of Strings" control below the Instrument toggle that adjusts its range based on Guitar (6–8) or Bass (4–5),
so that I can select my exact instrument configuration and the game uses the correct tuning and fret positions.

## Acceptance Criteria

1. Setup screen shows two Instrument toggle options: "Guitar" and "Bass" (not individual instrument names)
2. Below the Instrument toggle, a "Number of Strings" toggle group appears:  Guitar → options 6, 7, 8 | Bass → options 4, 5
3. When Instrument changes Guitar↔Bass, the Number of Strings control rebuilds with the correct range and resets to the default for that kind (Guitar→6, Bass→4)
4. Selecting 7 strings on Guitar sets `currentInstrumentId = "guitar-7-standard"`; selecting 8 sets `"guitar-8-standard"`, 6 sets `"guitar-standard"`
5. Selecting 5 strings on Bass sets `currentInstrumentId = "bass-5-standard"`; selecting 4 sets `"bass-4-standard"`
6. On START, `instrument_id` in the session-config request matches the resolved instrument ID
7. `instrument_id` saved to localStorage matches the resolved instrument ID (e.g., `"guitar-7-standard"`)
8. On page reload, if stored `instrument_id` is `"guitar-7-standard"`, setup shows Guitar selected and 7 pre-selected in the string count toggle
9. All existing E2E specs that interact with the Instrument toggle continue to pass (no regression)

## Tasks / Subtasks

- [ ] Add `resolveInstrumentId(kind, stringCount)` pure function to `setup.js` (AC: 4, 5)
- [ ] Add `deriveKindAndCount(instrumentId)` helper to parse stored instrument_id back to kind + count (AC: 8)
- [ ] Refactor Instrument toggle to show "Guitar" / "Bass" only (AC: 1)
  - [ ] On kind select: call `deriveKindAndCount` for defaults, rebuild string count toggle, call `resolveInstrumentId`, update `currentInstrumentId`
- [ ] Add `createStringCountToggle(kind, selectedCount, onChange)` helper function (AC: 2)
  - [ ] Guitar: options [6, 7, 8]; Bass: options [4, 5]
  - [ ] Returns a `.toggle-group` element using existing `createToggleGroup` helper
- [ ] Insert string count toggle into the form below the Instrument toggle (AC: 2)
- [ ] Wire onChange to update `currentInstrumentId` via `resolveInstrumentId` (AC: 4, 5)
- [ ] Verify `saveSettings` call includes the resolved `instrument_id` (AC: 7)
- [ ] Update tab-order keyboard wiring: Instrument → String Count → START (AC: 9)
- [ ] Run E2E tests and confirm no regression

## Dev Notes

### Current state of `setup.js` — Instrument toggle (lines 185–197)

```js
// Current — lists all instrument objects by id/name:
const instToggle = createToggleGroup(
  'Instrument',
  instruments.map(i => ({ id: i.id, name: i.name })),
  defaultInstrumentId,
  (val) => { currentInstrumentId = val; }
);
```

This must change to two kind options. The `instruments` prop list is still passed in from `main.js` but is only needed to derive initial kind/count from `stored.instrument_id`.

### New helpers to add to `setup.js`

```js
// Map (kind, stringCount) → instrument_id
const _INSTRUMENT_ID_MAP = {
  guitar: { 6: 'guitar-standard', 7: 'guitar-7-standard', 8: 'guitar-8-standard' },
  bass:   { 4: 'bass-4-standard',  5: 'bass-5-standard' },
};

function resolveInstrumentId(kind, stringCount) {
  return (_INSTRUMENT_ID_MAP[kind] ?? {})[stringCount] ?? 'guitar-standard';
}

// Parse stored instrument_id → { kind, stringCount }
function deriveKindAndCount(instrumentId) {
  for (const [kind, counts] of Object.entries(_INSTRUMENT_ID_MAP)) {
    for (const [count, id] of Object.entries(counts)) {
      if (id === instrumentId) return { kind, stringCount: Number(count) };
    }
  }
  return { kind: 'guitar', stringCount: 6 }; // safe fallback
}

// String count options per kind
const _STRING_COUNT_OPTIONS = { guitar: [6, 7, 8], bass: [4, 5] };
const _DEFAULT_STRING_COUNT  = { guitar: 6, bass: 4 };
```

### Refactored Instrument + String count block

Replace the current `instGroup` block with:

```js
// --- Instrument kind toggle ---
let { kind: currentKind, stringCount: currentStringCount } = deriveKindAndCount(defaultInstrumentId);
let currentInstrumentId = resolveInstrumentId(currentKind, currentStringCount);

const instGroup = el('div', { class: 'form-group' });
const instLabel = el('label', { id: 'label-instrument' }, 'Instrument');
instGroup.appendChild(instLabel);

const kindToggle = createToggleGroup(
  'Instrument',
  [{ id: 'guitar', name: 'Guitar' }, { id: 'bass', name: 'Bass' }],
  currentKind,
  (val) => {
    currentKind = val;
    currentStringCount = _DEFAULT_STRING_COUNT[val];
    currentInstrumentId = resolveInstrumentId(val, currentStringCount);
    // Rebuild string count control
    const old = stringCountGroup.querySelector('.toggle-group');
    if (old) old.remove();
    const newToggle = buildStringCountToggle(val, currentStringCount);
    stringCountGroup.appendChild(newToggle);
  }
);
kindToggle.setAttribute('aria-labelledby', 'label-instrument');
instGroup.appendChild(kindToggle);
form.appendChild(instGroup);

// --- Number of Strings toggle ---
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
const stringCountLabel = el('label', { id: 'label-strings' }, 'Number of Strings');
stringCountGroup.appendChild(stringCountLabel);
stringCountGroup.appendChild(buildStringCountToggle(currentKind, currentStringCount));
form.appendChild(stringCountGroup);
```

### Tab order

The existing tab-order keyboard wiring block (lines ~303–355 of setup.js) wires `scaleSelect → diffToggle → instToggle → START`. After this change it should be:

`scaleSelect → diffToggle → kindToggle → stringCountToggle → START`

Update the `keydown` handlers accordingly. The `stringCountToggle` is rebuilt on kind change — wire Tab on the *last button of kindToggle* to focus the first button of `stringCountGroup.querySelector('.toggle-group')`.

### `defaultInstrumentId` derivation on load

```js
// Before: defaultInstrumentId = stored.instrument_id || instruments[0].id
// After:
const defaultInstrumentId = stored.instrument_id || 'guitar-standard';
// instruments list is no longer needed for the toggle — it's only used for
// computeRandomRootMidi (line ~58) and validation. Keep it passed in but
// don't use it to populate the instrument toggle anymore.
```

### `computeRandomRootMidi` — no change needed

This function receives the resolved instrument object (looked up by `currentInstrumentId`), not the toggle list. Works unchanged once `currentInstrumentId` resolves correctly.

### START handler — no change needed

The START handler (line ~240) already uses `currentInstrumentId` and calls `instruments.find(i => i.id === currentInstrumentId)`. Once the registry has the new IDs (Story 11-1), this works automatically.

### E2E regression risk

Existing E2E specs that click an Instrument toggle button by text will break if they click "Guitar 6-string (Standard)". After this change the buttons read "Guitar" and "Bass". Audit `tests/e2e/specs/` for any selector like `:has-text("guitar")` or `data-value="guitar-standard"` and update to match the new `data-value="guitar"` and `data-value="bass"` kind buttons.

### Project Structure Notes

- `static/game/ui/setup.js` — no bundler; plain ES module; `createToggleGroup` helper is defined in this file (line 66)
- `loadSettings` / `saveSettings` use `localStorage` key `subway-scaler-settings`; `instrument_id` key is already persisted in `saveSettings` call (line 264) — no change to the key name needed
- No changes needed in `main.js` — it passes `instruments` (full list) and `onSetupComplete` to `renderSetupScreen` and receives `instrument_id` back via the session-config response, not from the setup directly

### References

- [Source: static/game/ui/setup.js#126] — `renderSetupScreen` function signature
- [Source: static/game/ui/setup.js#66] — `createToggleGroup` helper (reuse, do not duplicate)
- [Source: static/game/ui/setup.js#137–148] — `stored` loading and `currentInstrumentId` init
- [Source: static/game/ui/setup.js#185–197] — Instrument toggle block to replace
- [Source: static/game/ui/setup.js#260–266] — `saveSettings` call (instrument_id persisted here)
- [Source: static/game/ui/setup.js#303–355] — tab-order keyboard handlers to update
- [Source: services/instruments.py] — instrument IDs available after Story 11-1

## Dev Agent Record

### Agent Model Used

_tbd_

### Debug Log References

### Completion Notes List

### File List
