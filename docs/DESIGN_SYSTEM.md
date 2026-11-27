# Design System

## 1. Product direction

JOGGLE ME should feel modern, focused, encouraging, and credible. It is not a generic school administration dashboard. The interface should emphasise:

- A clear learning task
- Fast content discovery
- Calm assessment modes
- Explainable progress
- Immediate, constructive feedback

## 2. Colour palette

Starting palette:

- Deep Indigo: `#35216B`
- Purple: `#7655D9`
- Cyan: `#27B9D6`
- Yellow: `#F4C84A`
- Background: `#F7F7FC`
- White: `#FFFFFF`
- Primary text: `#17152A`
- Secondary text: `#77758A`

Colours must be paired with text labels or icons, not colour alone. Contrast must meet WCAG 2.2 AA:

- Normal text contrast >= 4.5:1
- Large text >= 3:1
- UI components >= 3:1 against adjacent colours

Do not place white text on low-contrast yellow or cyan.

## 3. Typography

- Use a professional, highly legible system or locally hosted humanist sans-serif.
- Display: 600-700 weight.
- Body: 400-500 weight.
- Numeric exam/progress values: tabular numerals.
- Responsive type scale; do not rely solely on viewport units.
- Line height: 1.5 for body copy, 1.25-1.35 for headings.
- Minimum 16 px body text on mobile where practical.

## 4. Spacing and layout

- 4 px base unit.
- Common radii: 8 px, 12 px, and 16 px.
- Use a 12-column desktop grid and 4-column mobile grid.
- Desktop navigation may be side or top; tablet and mobile must use a compact or drawer navigation.
- Content width should be constrained for readability.
- Examination mode should reduce navigation distraction and keep the active question central.

## 5. Components

Adopt shadcn/ui primitives and wrap them in JOGGLE ME components where consistent behavior is needed:

- App shell and navigation
- Page header
- Data cards
- Upload dropzone
- Progress and status indicators
- Question card
- Option selector
- Timer
- Answer save state
- Result summary
- Topic performance chart
- Empty/error/loading states
- Confirmation dialog
- Role/owner controls
- Toast and inline alert

Avoid custom components that reinvent keyboard or screen-reader behavior.

## 6. Responsive behaviour

### Desktop

- Persistent navigation
- Wide data views
- Side-by-side quiz configuration and preview
- Owner analytics cards and tables

### Tablet

- Collapsed labels or compact navigation
- Stack dense panels
- Preserve table equivalents or switch to cards

### Mobile

- Bottom or drawer navigation
- One-column forms
- Sticky examination submit/navigation controls
- Touch targets >= 44 px
- Upload and camera flows must be explicit about supported formats

## 7. Accessibility

- Semantic landmarks and heading hierarchy.
- Visible focus states.
- Complete keyboard operation.
- Focus management for dialogs and route changes.
- Labels and help text for form controls.
- Live regions for save status and timeout warnings.
- Accessible timers and non-color countdown warnings.
- Motion reduction support.
- Reduced-motion mode for celebration/XP effects.
- Long tables provide responsive alternatives.

## 8. States

Every asynchronous screen should define:

- Initial/loading
- Success
- Empty
- Validation
- Forbidden
- Not found
- Partial success
- Retryable failure
- Offline/recovery

Examination recovery and saving state must be explicit and unambiguous.

## 9. Iconography and imagery

- Prefer a consistent Lucide-style icon set.
- Icons never replace required text in high-stakes actions.
- Avoid stock imagery that resembles a generic enterprise dashboard.
- Illustrations should support learning, progress, and discovery.

## 10. Component states and token conventions

Use design tokens for colour, radius, spacing, typography, shadows, and focus rings. Store Tailwind/shadcn theme tokens centrally. Do not hardcode divergent brand values in feature components.
