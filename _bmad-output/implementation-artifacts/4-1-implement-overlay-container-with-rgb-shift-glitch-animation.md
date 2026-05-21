# Story 4.1: Implement Overlay Container with RGB-Shift Glitch Animation

**Status:** ready-for-dev

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4.1
**Story Key:** 4-1-implement-overlay-container-with-rgb-shift-glitch-animation

---

## User Story

As a developer,
I want a shared overlay container component with an RGB-shift glitch entry/exit animation,
So that all overlays share a consistent transition that reinforces the retro gaming identity.

---

## Acceptance Criteria

**AC-1 — Overlay Container Structure:**
- An overlay base class/component exists that all overlays (pause, game-over, audio disconnect) inherit from
- `overlays.css` defines the container, backdrop, and animation keyframes
- Overlays have semantic HTML: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to heading

**AC-2 — RGB-Shift Glitch Animation (Entry):**
- Overlay enters DOM with class `overlay--entering`
- RGB-shift glitch plays: chromatic aberration split (~30ms) → channels converge (~60ms) → fully sharp and settled
- Total entry duration: ~200ms for game-over, ~250ms for pause
- Semi-opaque `var(--color-bg-void)` backdrop covers full viewport
- Animation uses CSS `@keyframes` with filter effects (no JavaScript animation)

**AC-3 — RGB-Shift Glitch Animation (Exit):**
- Overlay receives class `overlay--exiting` before removal
- Reverse glitch plays at half the entry duration (~100ms game-over, ~150ms pause)
- Backdrop fades out simultaneously
- Animation completes before element is removed from DOM

**AC-4 — Reduced Motion Support:**
- When OS `prefers-reduced-motion` is enabled
- Glitch animation replaced by simple opacity fade (~200ms)
- No rapid visual flicker or chromatic aberration
- Accessible to users with vestibular disorders

**AC-5 — Focus Management:**
- When overlay opens, focus moves to first focusable element inside overlay
- Focus is trapped within overlay (Tab does not escape to elements outside)
- Escape key handled by individual overlay implementations (pause/game-over)
- When overlay closes, focus returns to previous context (canvas or setup screen)

---

## Tasks / Subtasks

- [ ] Task 1: Create overlays.css with RGB-shift keyframes (AC: 2, 3, 4)
  - [ ] Define `@keyframes rgb-glitch-enter` with chromatic aberration filter
  - [ ] Define `@keyframes rgb-glitch-exit` (reverse animation)
  - [ ] Define `@keyframes fade-enter` and `@keyframes fade-exit` for prefers-reduced-motion
  - [ ] Define `.overlay` base class with positioning and backdrop
  - [ ] Define `.overlay--entering` and `.overlay--exiting` animation trigger classes
  - [ ] Test animation timing: game-over (200ms/100ms), pause (250ms/150ms)
  - [ ] Verify reduced-motion respects `prefers-reduced-motion: reduce`

- [ ] Task 2: Create OverlayManager utility class (AC: 1, 5)
  - [ ] Export `class OverlayManager` with static methods for focus/backdrop management
  - [ ] Implement `open(overlayElement, firstFocusableElement)` - moves focus, traps focus
  - [ ] Implement `close(returnFocusTo = previousElement)` - restore focus after animation completes
  - [ ] Implement focus trap middleware: Tab/Shift+Tab cycling within overlay
  - [ ] Add `aria-modal="true"` and `role="dialog"` to overlay element

- [ ] Task 3: Create overlay.js base component (AC: 1, 2, 3, 4)
  - [ ] Export base `Overlay` class or factory function
  - [ ] Accept heading text, content nodes, buttons/links as constructor arguments
  - [ ] Generate semantic HTML with proper ARIA roles and attributes
  - [ ] Expose `open()` and `close()` methods that trigger CSS classes
  - [ ] Ensure animation completes before removal (use `transitionend` listener)
  - [ ] Set `aria-labelledby` to heading element ID

- [ ] Task 4: Wire overlays into GameLoop phase transitions
  - [ ] Detect `PHASES.PAUSED` → call `PauseOverlay.open()` (Story 4.2)
  - [ ] Detect `PHASES.GAME_OVER` → call `GameOverOverlay.open()` (Story 4.3)
  - [ ] Ensure `SceneManager.render()` continues during overlay (render only, no update)

- [ ] Task 5: Test overlay accessibility and animation
  - [ ] Verify focus trap: Tab cycles within overlay, outside elements unreachable
  - [ ] Verify focus restoration: after close, focus returns to canvas or setup
  - [ ] Verify reduced-motion: animation is simple fade, no glitch on `prefers-reduced-motion: reduce`
  - [ ] Manual: screenshot RGB-glitch at each phase (30ms, 60ms, 200ms)
  - [ ] Automated: Unit test OverlayManager focus trap and animation trigger classes

---

## Developer Context

### What This Story Is

This is the **foundational UX layer** for Epic 4. All three overlays (pause, game-over, audio disconnect) will inherit from the container and animation system built here. The RGB-shift glitch is a signature transition that reinforces the Night City retro aesthetic.

This story is **pure UX/presentation** — no game logic. It's the DOM architecture and CSS that subsequent stories (4.2, 4.3, 4.4) will use.

### Architecture Compliance

**File Locations (per Epic 1 pattern):**
- `static/game/ui/overlays.css` — CSS animations and base styles (alongside setup.css, tokens.js, SafeZoneRenderer.js)
- `static/game/ui/overlay.js` — Overlay base component
- `static/game/ui/overlay-manager.js` — Focus trap and lifecycle utilities

**Module Exports:**
- `overlays.css`: CSS file with `@keyframes` definitions
- `overlay.js`: Export `class Overlay` or `function createOverlay(config)`
- `overlay-manager.js`: Export `class OverlayManager` with static methods

**No GameState Coupling:**
- Overlay component does NOT import `GameState` directly
- Focus management and animation are pure DOM concerns
- Phase detection happens in `GameLoop.js`, not in overlay module

**Dependency on Previous Work:**
- Uses `tokens.js` variables: `--color-bg-void`, `--color-accent`, `--color-text-primary`
- Uses fonts from `setup.css` (vendored monospace font already loaded)
- Respects WCAG 2.1 AA color contrast (verified in Story 1.3)

### Critical Implementation Notes

**RGB-Shift Glitch Effect:**
The glitch is achieved via CSS `filter: drop-shadow()` with slight offsets on R/G/B channels, not actual channel splitting. This is performant and achievable in browser CSS:
```css
@keyframes rgb-glitch-enter {
  0% {
    filter: drop-shadow(-2px 0 0 red) drop-shadow(2px 0 0 blue);
  }
  50% {
    filter: drop-shadow(-1px 0 0 red) drop-shadow(1px 0 0 blue);
  }
  100% {
    filter: drop-shadow(0 0 0 transparent);
  }
}
```
(This is a **starting point** — refine for visual polish based on design feedback.)

**Reduced Motion:**
The `@media (prefers-reduced-motion: reduce)` query must override glitch animations entirely. Use Lighthouse or axe DevTools to verify accessibility.

**Focus Trap Implementation:**
JavaScript must intercept Tab/Shift+Tab and cycle focus within overlay elements only:
```js
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const focusable = overlay.querySelectorAll('[tabindex], button, a, input');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
```

**Animation Completion:**
Use `transitionend` event to know when animation finishes before removing element from DOM:
```js
overlay.addEventListener('transitionend', () => {
  if (overlay.classList.contains('overlay--exiting')) {
    overlay.remove();
  }
});
```

---

## Design Tokens Reference

From `tokens.js` / design system:
- `--color-bg-void`: #0D0D1A (very dark navy, overlay backdrop)
- `--color-accent`: #FFB800 (bright yellow, button highlights)
- `--color-text-primary`: #E8E8F0 (off-white, body text)

**Contrast verified in Story 1.3:**
- Accent on bg-void: ≥4.5:1 ✓
- Text-primary on bg-void: ≥4.5:1 ✓

---

## Testing Requirements

**Unit Tests (overlays module):**
- [ ] OverlayManager focus trap cycles within overlay
- [ ] OverlayManager restores focus after close
- [ ] CSS animation classes trigger (`overlay--entering`, `overlay--exiting`)
- [ ] `prefers-reduced-motion: reduce` disables glitch, uses fade

**Integration Tests:**
- [ ] GameLoop.js detects `PHASES.PAUSED` → overlay opens
- [ ] Overlay animation completes without errors
- [ ] Escape key (or button action) closes overlay
- [ ] Game render loop continues during overlay (no freeze)

**Manual Tests:**
- [ ] Glitch animation visually matches design intent (RGB chromatic aberration → clarity)
- [ ] Backdrop opacity is sufficient (readable without distraction)
- [ ] Reduced motion: fade animation is smooth, no flicker
- [ ] Keyboard: Tab cycles within overlay, cannot reach outside elements
- [ ] Keyboard: After close, focus returns to canvas or setup screen

**Accessibility:**
- [ ] axe DevTools: zero violations on overlay container
- [ ] Screen reader: `role="dialog"`, `aria-modal="true"`, heading `aria-labelledby` announced
- [ ] Color: glitch effect and backdrop meet WCAG AA contrast

---

## Definition of Done

- [ ] `overlays.css` created with RGB-shift keyframes, backdrop, animation classes
- [ ] `overlay.js` exports `Overlay` component with open/close lifecycle
- [ ] `overlay-manager.js` exports `OverlayManager` with focus trap
- [ ] Focus trap tested: Tab stays within overlay, restored after close
- [ ] Reduced motion tested: fade animation used when `prefers-reduced-motion: reduce`
- [ ] Animation timing verified: game-over (200ms entry, 100ms exit), pause (250ms entry, 150ms exit)
- [ ] `PHASES.PAUSED` → overlay opens (wired in GameLoop.js)
- [ ] `PHASES.GAME_OVER` → overlay opens (wired in GameLoop.js)
- [ ] All unit + integration tests pass
- [ ] axe DevTools audit: zero violations
- [ ] PR reviewed and approved by tech lead

---

## Change Log

- 2026-05-21: Story created. RGB-shift glitch animation and overlay container architecture planned per UX-DR9, UX-DR10.
