# Story 4.5: Implement Touch Targets and Final Accessibility Audit

**Status:** ready-for-dev

**Epic:** 4 — Session UX & Accessibility
**Story ID:** 4.5
**Story Key:** 4-5-implement-touch-targets-and-final-accessibility-audit

---

## User Story

As a player on a touch device,
I want all interactive elements to have adequate touch targets and the plugin to pass an accessibility audit,
So that the plugin is usable on tablet without mis-taps and meets its WCAG 2.1 AA commitment.

---

## Acceptance Criteria

**AC-1 — Minimum 44×44px Touch Targets:**
- All buttons across setup.css and overlays.css have a minimum 44×44px tap area (calculated as height + padding + border)
- All toggle options (radio buttons) have a minimum 44×44px tap area
- All text links (e.g., "Quit to Menu") have a minimum 44×44px tap area
- START button on setup screen: measured ≥ 44×44px
- RESUME button on pause overlay: measured ≥ 44×44px
- RESTART button on game-over overlay: measured ≥ 44×44px
- MAIN MENU button on game-over overlay: measured ≥ 44×44px
- "Quit to Menu" text link: measured ≥ 44×44px
- Scale `<select>` element: measured ≥ 44px height
- Difficulty and Instrument toggle options: each ≥ 44×44px

**AC-2 — Colour Contrast Verification:**
- `var(--color-accent)` (#FFB800) on `var(--color-bg-void)` (#0D0D1A): contrast ratio ≥ 4.5:1 (WCAG AA for normal text, AAA for large text)
- `var(--color-text-primary)` (#E8E8F0) on `var(--color-bg-stage)` (#1A1A2E): contrast ratio ≥ 4.5:1
- `var(--color-text-primary)` (#E8E8F0) on `var(--color-bg-void)` (#0D0D1A): contrast ratio ≥ 4.5:1
- Focus indicator (outline) must have ≥ 3:1 contrast against the element's background
- All interactive element text must have sufficient contrast with their background

**AC-3 — axe DevTools Accessibility Audit:**
- axe DevTools run on setup screen: zero WCAG 2.1 AA violations
- axe DevTools run on pause overlay: zero WCAG 2.1 AA violations
- axe DevTools run on game-over overlay: zero WCAG 2.1 AA violations
- Any canvas-related warnings (e.g., "Color contrast on canvas") are documented in code comments as non-applicable to Three.js rendering

**AC-4 — Lighthouse Accessibility Audit:**
- Lighthouse accessibility score ≥ 90 on setup screen
- Lighthouse accessibility score ≥ 90 on a page with pause overlay open
- Lighthouse accessibility score ≥ 90 on a page with game-over overlay open
- Report includes no critical accessibility failures

**AC-5 — Responsive Touch Layout:**
- On viewports ≤ 600px width, toggle options stack vertically with adequate spacing
- On all touch devices (iOS Safari, Android Chrome), tap targets are reachable without accidental mis-taps
- No single interactive element overlaps another (minimum 2px gap between adjacent touch targets on dense layouts)

**AC-6 — Error Message and Alert Accessibility:**
- Error message from Story 1.7 has `role="alert"` and is visually distinct (e.g., border, background color, or icon)
- Error message colour is not the only indicator (icon or text label also present)
- Error message has sufficient contrast (≥ 4.5:1 against background)

---

## Tasks / Subtasks

- [ ] Task 1: Measure and adjust button padding for 44×44px targets (AC: 1)
  - [ ] START button: measure current dimensions, add padding if needed to reach 44×44px minimum
  - [ ] RESUME button: measure and pad to 44×44px
  - [ ] RESTART button: measure and pad to 44×44px
  - [ ] MAIN MENU button: measure and pad to 44×44px
  - [ ] "Quit to Menu" link: measure and pad to 44×44px (use padding on wrapping container)
  - [ ] All toggle options in toggle groups: pad to 44×44px each
  - [ ] Scale `<select>`: set `height: 44px` or equivalent padding
  - [ ] Document actual measured dimensions in code comments or browser DevTools screenshots

- [ ] Task 2: Verify and document colour contrast (AC: 2)
  - [ ] Use WebAIM Contrast Checker or browser DevTools: verify #FFB800 on #0D0D1A
  - [ ] Use WebAIM Contrast Checker or browser DevTools: verify #E8E8F0 on #1A1A2E
  - [ ] Use WebAIM Contrast Checker or browser DevTools: verify #E8E8F0 on #0D0D1A
  - [ ] Verify focus indicator outline has ≥ 3:1 contrast
  - [ ] Document results in a comment in `tokens.js` or a separate `ACCESSIBILITY.md` file
  - [ ] Flag any colors that fall below 4.5:1 and request design review (none should be flagged if tokens are correct)

- [ ] Task 3: Run axe DevTools audit on setup screen (AC: 3)
  - [ ] Install axe DevTools browser extension (Chrome, Firefox, Edge)
  - [ ] Open setup screen in browser
  - [ ] Run axe DevTools scan
  - [ ] Document results: violations count, all violation IDs and descriptions
  - [ ] If violations exist: categorise by type (structure, labeling, contrast, etc.)
  - [ ] Fix each violation:
    - [ ] Missing alt text → add `aria-label` or `aria-describedby`
    - [ ] Low contrast → adjust colors or increase font size
    - [ ] Missing form labels → add `<label>` or `aria-label`
    - [ ] Incomplete focus indicators → enhance `:focus-visible` styles
  - [ ] Re-run axe DevTools after fixes: confirm zero violations

- [ ] Task 4: Run axe DevTools audit on pause overlay (AC: 3)
  - [ ] Manually trigger pause in game (or mock pause state for testing)
  - [ ] Open axe DevTools and run scan on pause overlay
  - [ ] Document results and fix any violations
  - [ ] Re-run until zero WCAG 2.1 AA violations

- [ ] Task 5: Run axe DevTools audit on game-over overlay (AC: 3)
  - [ ] Manually trigger game-over (play until collision or mock collision)
  - [ ] Run axe DevTools scan on game-over overlay
  - [ ] Document results and fix any violations
  - [ ] Re-run until zero WCAG 2.1 AA violations
  - [ ] Document any canvas-related warnings as non-applicable (e.g., "canvas text contrast cannot be analyzed by automated tools")

- [ ] Task 6: Run Lighthouse accessibility audit on setup screen (AC: 4)
  - [ ] Open setup screen in Chrome DevTools Lighthouse
  - [ ] Run accessibility audit
  - [ ] Document score and all findings
  - [ ] If score < 90: fix each critical item (color contrast, labels, ARIA)
  - [ ] Re-run until score ≥ 90

- [ ] Task 7: Run Lighthouse accessibility audit on pause overlay (AC: 4)
  - [ ] Pause game (or mock state)
  - [ ] Run Lighthouse accessibility audit
  - [ ] Document score and fix any critical items
  - [ ] Re-run until score ≥ 90

- [ ] Task 8: Run Lighthouse accessibility audit on game-over overlay (AC: 4)
  - [ ] Trigger game-over
  - [ ] Run Lighthouse accessibility audit
  - [ ] Document score and fix any critical items
  - [ ] Re-run until score ≥ 90

- [ ] Task 9: Test responsive touch layout (AC: 5)
  - [ ] Test on iPad (iOS 15+) in portrait and landscape
  - [ ] Test on Android tablet (Chrome or Firefox) in portrait and landscape
  - [ ] Test on desktop browser with touch emulation (Chrome DevTools device emulation)
  - [ ] Verify toggle options stack vertically on ≤ 600px viewport
  - [ ] Verify no overlapping interactive elements (minimum 2px gap)
  - [ ] Perform mis-tap test: try to tap adjacent buttons, verify no mis-activations
  - [ ] Document screenshots of layout on different viewports

- [ ] Task 10: Verify error message accessibility (AC: 6)
  - [ ] Error message has `role="alert"` (from Story 1.7)
  - [ ] Error message is visually distinct: colour, border, icon, or text indicator
  - [ ] Error message colour is not the sole indicator (e.g., not just red without text or icon)
  - [ ] Verify contrast: error message text on background ≥ 4.5:1
  - [ ] Test: trigger error, verify screen reader announces it immediately

- [ ] Task 11: Final accessibility summary document (AC: 1-6)
  - [ ] Create or update `docs/accessibility.md` with:
    - [ ] WCAG 2.1 AA compliance checklist
    - [ ] Colour contrast verification results
    - [ ] Touch target measurements (with screenshots or DevTools measurements)
    - [ ] axe DevTools audit results for each surface
    - [ ] Lighthouse accessibility scores
    - [ ] Known limitations or exceptions (canvas text, Three.js rendering)
    - [ ] Testing methodology and date
  - [ ] Include in PR description or link in PR

---

## Developer Context

### What This Story Is

This is the **final accessibility audit and validation** for Epic 4. Unlike Stories 4-1 through 4-4, which implement features, this story is pure testing and verification. The work is:
1. **Physical measurement**: ensure interactive elements meet 44×44px minimum
2. **Colour verification**: confirm contrast ratios mathematically
3. **Automated auditing**: run axe DevTools and Lighthouse on all HTML surfaces
4. **Manual testing**: touch devices and responsive layout verification
5. **Documentation**: capture results and any known limitations

No new features are added here — only refinement based on audit findings.

### Architecture Compliance

**Files Affected:**
- `static/game/ui/setup.css` — May add/adjust padding on buttons and form elements
- `static/game/ui/overlays.css` — May add/adjust padding on overlay buttons and links
- `static/game/ui/tokens.js` — May add colour contrast documentation
- `docs/accessibility.md` — NEW: accessibility audit results and compliance checklist

**No Logic Changes:**
- This story does NOT modify JavaScript game logic
- This story does NOT add new features
- This story ONLY adjusts CSS padding/sizing and verifies colour/contrast

### Previous Story Intelligence (from Epic 4)

**Story 4.1 (Overlay Container):**
- Base CSS structure is in place; this story only adds padding to buttons

**Story 4.2 & 4.3 (Pause & Game-Over Overlays):**
- Buttons and links are already functional; this story verifies and adjusts their touch targets

**Story 4.4 (ARIA Roles & Keyboard Navigation):**
- All ARIA roles and attributes are in place; this story verifies them via automated tools

**Story 1.5 (Setup CSS Foundation):**
- Setup CSS has responsive breakpoints; this story verifies layout on actual touch devices

**Story 1.6 (Setup UI):**
- Form elements exist; this story measures and adjusts them for 44×44px minimum

### Critical Implementation Notes

**Touch Target Measurement:**
44×44px is the WCAG 2.5.5 (AAA) and Apple/Google guidance minimum. Measure as:
```
Target size = (element height + padding top + padding bottom) × (element width + padding left + padding right)
```
Or use Chrome DevTools Lighthouse to inspect element and see "Touch Target Size" in the audit results.

**Colour Contrast Calculation:**
Use the formula: `(L1 + 0.05) / (L2 + 0.05)` where L = `(R*0.299 + G*0.587 + B*0.114) / 255`
Or use online tools:
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Contrast Ratio: https://contrast-ratio.com/

The tokens provided in UX-DR2 should already meet 4.5:1, so this task is verification.

**axe DevTools vs Lighthouse:**
- **axe DevTools**: more detailed, structured findings with quick fixes
- **Lighthouse**: includes performance, SEO, best practices; accessibility is one section
- Both should report zero violations when properly configured

**Canvas Accessibility Limitation:**
Three.js canvas rendering is inherently visual. Tools like axe DevTools may report "Text on canvas not readable" — this is expected and should be documented as non-applicable, since the canvas is for game rendering, not information display.

**Touch Device Testing Priority:**
1. iOS iPad (most common tablet)
2. Android tablet (secondary coverage)
3. Desktop browser touch emulation (quick validation, not a substitute for real devices)

---

## Testing Requirements

**Measurement Tests:**
- [ ] START button: document measured width/height/padding, confirm ≥ 44×44px
- [ ] All overlay buttons: measure and confirm ≥ 44×44px
- [ ] All toggle options: measure and confirm ≥ 44×44px
- [ ] Scale `<select>`: measure height, confirm ≥ 44px
- [ ] All text links: measure and confirm ≥ 44×44px
- [ ] Screenshot DevTools element inspector showing dimensions for each interactive element

**Colour Contrast Tests:**
- [ ] Use WebAIM Contrast Checker: #FFB800 on #0D0D1A result ≥ 4.5:1
- [ ] Use WebAIM Contrast Checker: #E8E8F0 on #1A1A2E result ≥ 4.5:1
- [ ] Use WebAIM Contrast Checker: #E8E8F0 on #0D0D1A result ≥ 4.5:1
- [ ] Use Lighthouse: focus indicator outline contrast ≥ 3:1
- [ ] Document all contrast verification results

**Automated Audit Tests:**
- [ ] axe DevTools on setup screen: zero violations, screenshot results
- [ ] axe DevTools on pause overlay: zero violations, screenshot results
- [ ] axe DevTools on game-over overlay: zero violations, screenshot results
- [ ] Lighthouse setup screen: score ≥ 90, screenshot results
- [ ] Lighthouse pause overlay: score ≥ 90
- [ ] Lighthouse game-over overlay: score ≥ 90

**Manual Touch Device Tests:**
- [ ] iPad (portrait): tap all buttons without mis-taps
- [ ] iPad (landscape): tap all buttons without mis-taps
- [ ] Android tablet (portrait): tap all buttons without mis-taps
- [ ] Android tablet (landscape): tap all buttons without mis-taps
- [ ] Desktop browser with touch emulation: verify layout reflow
- [ ] Verify toggle options stack vertically on ≤ 600px
- [ ] Verify no overlapping interactive elements

**Responsive Layout Tests:**
- [ ] Viewport 320px (small phone): form usable, buttons accessible
- [ ] Viewport 600px (break point): transition to full layout
- [ ] Viewport 1024px (tablet/desktop): full layout, no overflow

**Error Message Accessibility:**
- [ ] Error message has `role="alert"` visible in HTML
- [ ] Error message is visually distinct (colour, icon, border)
- [ ] Error message text has ≥ 4.5:1 contrast
- [ ] Screen reader announces error immediately without user tabbing to it

---

## Definition of Done

- [ ] All interactive elements measured: START, RESUME, RESTART, MAIN MENU, toggle options, links ≥ 44×44px
- [ ] All button padding adjusted in `setup.css` and `overlays.css` to meet 44×44px minimum
- [ ] Scale `<select>` height set to ≥ 44px
- [ ] Colour contrast verified: all token colours ≥ 4.5:1
- [ ] Focus indicator outline contrast verified ≥ 3:1
- [ ] axe DevTools audit: zero WCAG 2.1 AA violations on setup screen, pause overlay, game-over overlay
- [ ] Lighthouse accessibility: score ≥ 90 on all three surfaces
- [ ] Canvas-related warnings documented as non-applicable in code comments
- [ ] Responsive touch layout tested on iPad and Android tablet
- [ ] No overlapping interactive elements (minimum 2px gap verified)
- [ ] Touch mis-tap test passed: adjacent buttons do not mis-activate
- [ ] Error message accessibility verified: `role="alert"`, visual distinction, contrast
- [ ] Accessibility documentation created: `docs/accessibility.md` with audit results and compliance checklist
- [ ] Measurements and audit screenshots included in PR description or separate document
- [ ] All accessibility findings documented in PR and/or code comments
- [ ] PR reviewed and approved by accessibility reviewer (or tech lead)

---

## Change Log

- 2026-05-21: Story created. Touch target sizing, colour contrast verification, and final accessibility audit planned per WCAG 2.1 AA and UX-DR16 requirements.
