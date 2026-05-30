# Story 10.1: Minigame Manifest + SDK Registration

Status: review

## Story

As the **Slopsmith plugin system**,
I want Subway Scaler to declare its minigame metadata in `plugin.json` and register with the SDK,
So that the Minigames Hub discovers it as a playable tile — and it has no standalone entry point.

## Acceptance Criteria

1. **plugin.json updated** — `nav` and `screen` removed; `minigame` block added with title, tagline, type: "chart-free", scoring: "pitch-continuous", thumbnail, no modifiers. `script` and `routes` unchanged.

2. **SDK registration** — When SDK is loaded and plugin script runs, `window.slopsmithMinigames.register()` is called with `id` matching `plugin.json`'s `id`, `start` and `stop` lifecycle functions. Hub tile renders correctly. Server-side `/api/plugins/minigames/registry` returns minigame manifest.

3. **Inert without SDK** — If `window.slopsmithMinigames` is undefined, registration fails silently, logged, plugin does nothing (no UI, no crash).

4. **No standalone nav** — `plugin.json` has no `nav` field; no "Plugins → Subway Scaler" link in Slopsmith main menu. No `screen` field — no standalone screen entry.

## Tasks / Subtasks

- [x] Update `plugin.json`: remove `nav`, `screen`; add `minigame` block (AC: #1)
- [x] Create `static/game/SdkBridge.js` with registration logic (AC: #2)
  - [x] Registration guard: `if (typeof window.slopsmithMinigames?.register === 'function')`
  - [x] Call `register({id: 'subway-scaler', start, stop, title: 'Subway Scaler', tagline: '...', thumbnail: '...'})`
  - [x] On SDK unavailable: log warning, return (no further init)
- [x] Ensure plugin script does nothing besides registering until `start()` is called
- [x] Tests (AC: #2, #3, #4)

## Dev Notes

### Architecture Compliance

- `plugin.json` reference (`slopsmith-plugin-flappy-bend` for comparison): path `/tmp/slopsmith-plugin-flappy-bend/plugin.json` — omit `modifiers` array
- SDK registration contract: `window.slopsmithMinigames.register({ id, start, stop, title, tagline, thumbnail })` — no `screen`, `nav`, or `modifiers`
- Server registry (`routes.py` via `slopsmith-plugin-minigames` backend) reads `plugin.json` `minigame` block — not the JS register() call
- Plugin loader mounts scripts alphabetically; minigame plugins load BEFORE the SDK script. Use `window.__slopsmithMinigamesPending` queue pattern or check `slopsmith-minigames-ready` event for registration timing

### Files to Touch

| File | Action |
|---|---|
| `plugin.json` | UPDATE — remove `nav`, `screen`; add `minigame` block |
| `static/game/SdkBridge.js` | CREATE — SDK wrapper module |
| `static/game/main.js` | NO CHANGE — game logic stays; entry point moves to `start()` callback |

### Files NOT to Touch

- `routes.py` — stays unchanged, already includes routers
- `services/` — backend unchanged in this story
- `static/game/*.js` — game modules unchanged, only `SdkBridge.js` added

### Testing

- Vitest with mock `window.slopsmithMinigames`: verify `register()` called with correct spec shape, correct `id`
- Vitest without mock SDK: verify no crash, warning logged
- E2E: verify hub tile appears when SDK loaded
- E2E: verify no "Plugins → Subway Scaler" nav entry exists

### References

- [Source: epics.md § Epic 10 — Story 10-1]
- [Source: slopsmith-plugin-minigames/screen.js lines 519-533 (register implementation)]
- [Source: slopsmith-plugin-flappy-bend/plugin.json (minigame block reference)]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Updated plugin.json: removed `nav` and `screen`, added `minigame` block with title, tagline, type, scoring, thumbnail
- Created static/game/SdkBridge.js with `registerWithSdk()` using pending-queue pattern for timing safety
- Updated screen.js to import and call `registerWithSdk()` — no standalone boot
- Tests: SdkBridge.test.js covers register with SDK present, pending queue, no-crash when addEventListener missing

### File List
- plugin.json
- static/game/SdkBridge.js
- screen.js
- tests/unit/js/SdkBridge.test.js

### Change Log
- 2026-05-30: Implemented minigame manifest and SDK registration (Story 10-1)