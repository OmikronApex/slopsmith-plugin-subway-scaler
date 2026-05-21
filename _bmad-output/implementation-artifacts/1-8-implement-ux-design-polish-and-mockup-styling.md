# Story 1.8: Implement UX Design Polish and Mockup Styling

**Status:** ready-for-dev
**Epic:** 1 — Foundation & Session Setup
**Story ID:** 1.8
**Story Key:** 1-8-implement-ux-design-polish-and-mockup-styling

---

## User Story

As a player,
I want the setup screen to match the Night City design mockup with polished typography, layout, and visual effects,
So that the experience feels cohesive with the Rocksmith aesthetic and professional appearance.

---

## Acceptance Criteria

**AC-1 — Game Title:**
- Display "SUBWAY SCALER" title above the form
- Apply text-shadow effects: `3px 0 0 rgba(255, 50, 50, 0.45), -3px 0 0 rgba(50, 100, 255, 0.45)` (red/blue glitch)
- Font: clamp(18px, 4vw, 34px), font-weight: 700, uppercase, letter-spacing: 5px
- Color: var(--color-accent) with shadow depth

**AC-2 — Form Layout:**
- Change from single-column to 2-column grid: `grid-template-columns: 1fr 1fr; gap: 18px 32px`
- Scale selector spans full width (both columns): `grid-column: 1 / -1`
- Difficulty toggle and Instrument toggle each take one column
- Form max-width: 540px (updated from 480px), centered
- Container padding and spacing follow mockup (clamp sizes for responsiveness)

**AC-3 — Scale Preview Display:**
- Add scale preview text below scale dropdown showing selected scale name
- Font: 10px, color: var(--color-accent), letter-spacing: 1px, text-align: center
- Margin-top: -8px to tighten spacing with scale select

**AC-4 — Root Randomised Label Styling:**
- Root label: "Root: randomised fret 5–8" on light grey background
- Font: 9px, color: var(--color-text-disabled), background: var(--color-bg-near), border: 2px solid var(--color-bg-near)
- Padding: 10px 12px
- Accent word highlighting (if applicable): color: var(--color-accent)

**AC-5 — Toggle Group Button Styling:**
- Toggle buttons with NO right border between buttons (only between first and middle, middle and last)
- Border style: `border-right-width: 0` for all except last button
- Last button: `border-right-width: 2px`
- Button class when selected: `.selected` (not `.active`)
- Active button styling: background: var(--color-accent), color: var(--color-bg-void), border-color: var(--color-accent)

**AC-6 — Responsive Breakpoints:**
- `< 600px`: Toggle groups stack vertically, form spans full width minus padding
- `≥ 600px`: 2-column grid layout as described above
- Clamp font sizes for smooth scaling across all breakpoints

**AC-7 — Field Group Styling:**
- Label styling: 9px, font-weight: 700, color: var(--color-text-disabled), uppercase, letter-spacing: 2px
- Form control padding: 10px 12px (consistent across select and buttons)
- Gaps: 7px between label and control, 18px/32px in grid

**AC-8 — START Button:**
- Primary button styling: background: var(--color-accent), color: var(--color-bg-void)
- Full-width within grid context
- Font: 12px, font-weight: 700, uppercase, letter-spacing: 2px
- Hover state: slight opacity change or border highlight
- Padding: 10px 12px for consistency with other controls

**AC-9 — Accessibility & Touch Targets:**
- All interactive elements: minimum 44×44px touch target (padding: 10px 12px gives ~34px height + spacing)
- Focus states: `:focus-visible` with color accent outline
- Label associations maintained (for select) or aria-labelledby (for toggles)

**AC-10 — Responsive Behavior:**
- Form scales smoothly from 320px to 1200px+ widths
- Mobile (< 600px): single column, toggle groups vertical stack
- Desktop (≥ 600px): 2-column grid with max-width 540px
- No content overflow or awkward wrapping

---

## Developer Context

### What This Story Does

Transforms the minimal, functional setup screen from stories 1-5 and 1-6 into a **Night City-styled, polished UI** matching the design mockup. This completes Epic 1's UX vision without adding new functionality — pure visual and layout work.

### Design Guidance

The design mockup (`_bmad-output/planning-artifacts/ux-design-directions.html`) specifies:
- 2-column grid layout with specific gaps and spacing
- Game title with text-shadow effects for visual depth
- Scale preview display for player feedback
- Toggle buttons with connector styling (no borders between middle buttons)
- Responsive scaling using `clamp()` for smooth transitions
- Accessibility: 44×44px minimum touch targets, focus-visible styling

### Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `static/game/setup.js` | MODIFY | Add game title element, scale preview display, update grid/class names |
| `static/game/ui/setup.css` | MODIFY | Implement 2-column grid, button border logic, clamp sizing, responsive breakpoints |

### No New Dependencies

This story uses only CSS Grid, CSS clamp(), and existing HTML element creation. No external libraries or frameworks required.

---

## Definition of Done

- [x] Game title "SUBWAY SCALER" renders with text-shadow effects above form
- [x] Setup form uses 2-column grid (scale full-width, difficulty/instrument side-by-side on mobile becomes vertical)
- [x] Scale dropdown has preview text display below it
- [x] Root randomised label displays with proper styling (grey background, accent text)
- [x] Toggle buttons styled with connector borders (no right border except last)
- [x] All form controls have consistent padding (10px 12px)
- [x] Responsive breakpoints: < 600px stacks vertically, ≥ 600px uses 2-column grid
- [x] START button full-width with accent styling
- [x] All interactive elements have minimum 44×44px touch targets
- [x] Focus-visible styling on all interactive elements
- [x] No layout regressions; form displays correctly at all widths
- [x] All existing functionality (form submission, error handling, localStorage) intact
- [x] Tests validate: layout structure, CSS class application, responsive behavior

---

## Implementation Guidance

### Step 1: Update setup.js

1. Add game title element above the form: `el('div', { class: 'game-title' }, 'SUBWAY SCALER')`
2. Create scale preview display element (empty initially)
3. Update scale select listener to populate preview with selected scale name
4. Update toggle button class from `.active` to `.selected` for CSS consistency
5. Ensure instToggle (instrument) uses correct class names for styling

### Step 2: Update setup.css

1. **Grid Layout:**
   ```css
   .setup-form {
     display: grid;
     grid-template-columns: 1fr 1fr;
     gap: 18px 32px;
   }
   .field-group.full-width {
     grid-column: 1 / -1;
   }
   ```

2. **Game Title:**
   ```css
   .game-title {
     font-size: clamp(18px, 4vw, 34px);
     font-weight: 700;
     color: var(--color-accent);
     text-transform: uppercase;
     letter-spacing: 5px;
     text-shadow: 3px 0 0 rgba(255, 50, 50, 0.45), -3px 0 0 rgba(50, 100, 255, 0.45);
     margin-bottom: 28px;
   }
   ```

3. **Scale Preview:**
   ```css
   .scale-preview {
     font-size: 10px;
     color: var(--color-accent);
     letter-spacing: 1px;
     text-align: center;
     margin-top: -8px;
   }
   ```

4. **Toggle Button Borders:**
   ```css
   .toggle-group button {
     border-right-width: 0;
   }
   .toggle-group button:last-child {
     border-right-width: 2px;
   }
   ```

5. **Responsive Media Queries:**
   - `< 600px`: toggle groups `flex-direction: column`, form full width
   - `≥ 600px`: maintain grid layout, max-width 540px

### Step 3: Test

- Render at 320px, 600px, 900px, 1200px widths
- Verify grid layout switches at 600px breakpoint
- Test form submission still works
- Verify error handling still functions
- Check touch targets are >= 44px
- Validate focus-visible styling on all interactive elements

---

## Dev Agent Record

### Implementation Plan

1. Read current setup.js and setup.css to understand structure
2. Add game title to renderSetupScreen() with proper class
3. Add scale preview display element
4. Update scale select listener to populate preview
5. Implement 2-column grid in setup.css
6. Add game-title, scale-preview, and toggle button border styling
7. Add responsive media queries for < 600px breakpoint
8. Test at multiple viewport widths
9. Verify existing functionality (form submit, error handling, localStorage)
10. Run full test suite to ensure no regressions

### Completion Notes

[Will be updated after implementation]

---

## File List

[Will be updated after implementation]

---

## Change Log

- 2026-05-21: Story created. Planned polish of setup UI to match Night City design mockup.

---

## Status Definitions

# ready-for-dev: designed and approved, waiting for developer
# in-progress: actively being developed
# review: implementation complete, awaiting code review
# done: reviewed and merged
