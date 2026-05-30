# Story 11.4: Remove Legacy Score/Note HUD

Status: ready-for-dev

## Story

As a player,
I want the game screen to show only the Epic 8 HUD overlay for score and feedback,
so there is no redundant bottom-left readout cluttering the display.

## Acceptance Criteria

1. No `.hud` div (the legacy container) exists in the DOM during active gameplay
2. No score or note-name text appears in the bottom-left corner of the game shell
3. The Epic 8 HUD overlay (top-right score, bottom-right pause button, top-left fret box) remains fully functional
4. `NoteAcceptor` and `GamePoller` do not crash or throw when `feedbackEl` is removed
5. All existing unit tests and E2E specs pass

## Tasks / Subtasks

- [ ] Remove legacy HUD elements from `main.js` (AC: 1, 2)
  - [ ] Delete `const hud = el('div', { class: 'hud' });` (line ~295)
  - [ ] Delete `const expectedEl = el('div', { class: 'expected' });` (line ~296)
  - [ ] Delete `const feedbackEl = el('div', { class: 'feedback' });` (line ~297)
  - [ ] Delete `hud.appendChild(expectedEl);` (line ~299)
  - [ ] Delete `hud.appendChild(feedbackEl);` (line ~300)
  - [ ] Remove `hud` from `gameWrap` children: `el('div', { class: 'game-wrap', ... }, canvas, overlay, hud)` → `el('div', { class: 'game-wrap', ... }, canvas, overlay)` (line ~302)
- [ ] Fix `setExpected()` that references `expectedEl` (AC: 4)
  - [ ] Line ~377: `expectedEl.textContent = ...` — remove this line (the fret box in Epic 8 HUD serves this purpose)
- [ ] Fix `NoteAcceptor` instantiation that passes `feedbackEl` (AC: 4)
  - [ ] Line ~480: remove `feedbackEl` from the constructor options object
- [ ] Fix `GamePoller` that receives `feedbackEl` (AC: 4)
  - [ ] Line ~904: remove `poller.feedbackEl = feedbackEl;`
- [ ] Remove any CSS rules for `.hud`, `.expected`, `.feedback` legacy selectors
  - [ ] Search `static/game/ui/overlays.css`, `static/game/ui/hud.css`, `static/game/ui/setup.css` for these class names and remove matching rules
- [ ] Run all tests and verify no regression (AC: 5)

## Dev Notes

### Exact locations in `main.js`

All line numbers are approximate — verify in file before editing:

```js
// ~line 295–302 — DELETE these lines:
const hud = el('div', { class: 'hud' });
const expectedEl = el('div', { class: 'expected' });
const feedbackEl = el('div', { class: 'feedback' });
const overlay = el('div', { class: 'overlay hidden' });
hud.appendChild(expectedEl);
hud.appendChild(feedbackEl);
// game-wrap fills the shell absolutely; canvas, overlay, hud all position within it.
const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay, hud);

// BECOMES:
const overlay = el('div', { class: 'overlay hidden' });
const gameWrap = el('div', { class: 'game-wrap', style: 'display:none' }, canvas, overlay);
```

```js
// ~line 374–382 — setExpected() function:
function setExpected() {
  if (!run || !run.currentExpected()) return;
  const exp = run.currentExpected();
  expectedEl.textContent = `Play: ${exp.note.name}`;  // ← DELETE this line
  const upcoming = run.upcoming(3).map(e => e.name);
  scene.setUpcomingNotes(upcoming);
  safeZoneRenderer.setExpectedNoteIndex(run.cursor);
}
```

```js
// ~line 475–483 — NoteAcceptor constructor:
const noteAcceptor = new NoteAcceptor({
  safeZoneRenderer,
  gameClient,
  scene,
  variantController,
  feedbackEl,        // ← DELETE this line
  pushGameEvent,
  debugLogger: _debugLogger,
});
```

```js
// ~line 904 — GamePoller wiring:
poller.feedbackEl = feedbackEl;   // ← DELETE this line
```

### `NoteAcceptor.js` — no changes needed

`NoteAcceptor.js` reads `this.feedbackEl` at lines 94 and 100:
```js
this.feedbackEl.textContent = '✓';
this.feedbackEl.textContent = '·';
```
If `feedbackEl` is not passed, `this.feedbackEl` will be `undefined`. This causes `TypeError: Cannot set properties of undefined`. Fix by guarding the accesses in `NoteAcceptor.js`:

```js
// In NoteAcceptor.js handle() method, change:
this.feedbackEl.textContent = '✓';
// To:
if (this.feedbackEl) this.feedbackEl.textContent = '✓';

// And:
this.feedbackEl.textContent = '·';
// To:
if (this.feedbackEl) this.feedbackEl.textContent = '·';
```

Alternatively, set `this.feedbackEl = feedbackEl ?? null` in the constructor (line 20) and the guard is a one-time fix. Either approach is acceptable.

### `GamePoller.js` — already guarded

`GamePoller.js` line 15: `this.feedbackEl = null;` and line 31: `if (this.feedbackEl) this.feedbackEl.textContent = ...`. Already null-safe — no change needed in `GamePoller.js` itself once the assignment `poller.feedbackEl = feedbackEl` is removed from `main.js`.

### CSS cleanup

Search for `.hud`, `.expected`, `.feedback` in:
- `static/game/ui/overlays.css`
- `static/game/ui/hud.css`
- `static/game/ui/setup.css`

Remove any matching rules. Do NOT remove `.hud-shell`, `.hud-score`, `.hud-pause-btn`, `.hud-fret-box` — those belong to Epic 8's HUD.

### What is NOT removed

- The Epic 8 `HudShell`, `ScoreDisplay`, `PauseButton`, `FretBox` — leave fully intact
- The `gameWrap` div itself — leave it; only `hud` (the legacy child) is removed
- The `overlay` div — leave it (pause/game-over overlays depend on it)
- The `fretHud` debug div (line ~334) — leave it (debug-only, gated on `debugOn`)

### Project Structure Notes

- Only `main.js` and `NoteAcceptor.js` require changes, plus a CSS cleanup pass
- `GamePoller.js` already null-guards `feedbackEl` — no change needed there
- `setExpected()` still serves a purpose (calls `scene.setUpcomingNotes` and `safeZoneRenderer.setExpectedNoteIndex`) — only the `expectedEl.textContent` line is removed

### References

- [Source: static/game/main.js#295–302] — legacy hud, expectedEl, feedbackEl creation
- [Source: static/game/main.js#374–382] — `setExpected()` function
- [Source: static/game/main.js#475–483] — NoteAcceptor instantiation
- [Source: static/game/main.js#904] — `poller.feedbackEl` assignment
- [Source: static/game/NoteAcceptor.js#94,100] — feedbackEl textContent writes (add null guard)
- [Source: static/game/GamePoller.js#15,31] — already null-safe

## Dev Agent Record

### Agent Model Used

_tbd_

### Debug Log References

### Completion Notes List

### File List
