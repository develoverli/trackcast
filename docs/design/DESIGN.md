# TrackCast — Design System

Source of truth for the renderer UI (`src/renderer/`). All values are CSS custom properties defined in `src/renderer/styles.css` under `:root`. Components must use tokens, never raw colors or sizes.

## Direction

Dark, focused desktop tool with a single vivid green accent. Calm surfaces tinted toward green, high-contrast text, one primary action per screen. Accent green signals "connected / playing"; amber means "needs attention"; red means "broken".

Hero moments (Welcome, Setup complete) are the only place for extra atmosphere: the glowing app mark with a green to violet gradient ring, faint background waves, and violet/blue benefit icons. Task screens stay restrained.

## Color (OKLCH)

| Token | Use |
|-------|-----|
| `--bg-base` | App background |
| `--bg-elevated` | Sidebar, raised panels |
| `--bg-card` / `--bg-card-hover` | Cards and their hover state |
| `--bg-input` / `--bg-input-focus` | Form fields, inline code |
| `--accent` / `--accent-hover` / `--accent-active` | Primary actions, success, playing state |
| `--accent-soft` | Accent tints (focus glow, success backgrounds) |
| `--text-primary` / `--text-secondary` / `--text-muted` | Text hierarchy |
| `--text-on-accent` | Text on accent-filled buttons |
| `--border` / `--border-strong` | Dividers, outlined buttons |
| `--accent-strong` / `--accent-glow` | Hero button gradient, glows on active status |
| `--violet` / `--violet-soft` / `--blue` / `--blue-soft` | Hero moments and benefit icons only |
| `--bg-sunken` | Title bar, sidebar, logs |
| `--border-subtle` | Dividers inside panels |
| `--success-border` | Success notices, found source |
| `--warning` / `--warning-soft` / `--warning-border` | Attention states (e.g. migration notice) |
| `--error` / `--error-soft` | Failures |
| `--info` | Neutral information |

Status color is never the only signal: always pair it with an icon or text.

## Typography

- `--font-display`: Plus Jakarta Sans 700/800. Page and step titles, hero title, wordmark, track title, hero button. Never labels, body, or regular buttons.
- `--font-sans`: Inter 400/500/700. Everything else.
- `--font-mono`: URLs, redirect URIs, logs, timestamps.
- Both typefaces are self-hosted in `assets/fonts/` with their SIL OFL 1.1 license files.
- Scale: `--text-xs` 11 · `--text-sm` 12 · `--text-base` 14 · `--text-md` 16 · `--text-lg` 20 · `--text-xl` 28 · `--text-2xl` 36 · `--text-hero` 44 (38 on short windows).
- Weights: `--weight-normal` 400 · `--weight-medium` 500 (labels) · `--weight-bold` 700 (buttons, card titles) · `--weight-heavy` 800 (display).
- Line height: `--leading-tight` 1.15 (display) · `--leading-snug` 1.35 (card titles) · `--leading-normal` 1.5 (body).
- Use `font-variant-numeric: tabular-nums` for times and intervals.

## Spacing, radius, elevation

- Spacing: 4px scale, `--space-1` (4) … `--space-16` (64).
- Radius: `--radius-sm` 6 · `--radius-md` 8 (inputs) · `--radius-lg` 12 (cards, notices) · `--radius-xl` 16 (panels) · `--radius-pill` (buttons).
- Shadows: `--shadow-sm` / `--shadow-md` / `--shadow-lg`; focus ring is `--focus-ring` (2px accent outline with a base-color gap).

## Motion

- Durations: `--duration-fast` 120 · `--duration-base` 180 · `--duration-slow` 240 · `--duration-slower` 320 ms.
- Easing: `--ease-out-quart` (default), `--ease-out-expo` (entrances).
- Animate `transform` and `opacity` only. `prefers-reduced-motion` disables animation globally.

## Layout

- Frameless window (default 1040 × 720, minimum 720 × 500): custom title bar (`--titlebar-height` 44px).
- After setup: sidebar (`--sidebar-width` 236px) + main view (`--page-width` 760px). During setup: full-width wizard (`--content-width` 680px) with a 4-segment stepper, no sidebar.
- The wizard footer (Back / Continue) is sticky at the bottom of the scroll area.
- Z-index scale: `--z-base` · `--z-sticky` · `--z-titlebar`.

## Components

| Component | Classes | Notes |
|-----------|---------|-------|
| Button | `.btn` + `.btn--primary` / `.btn--secondary` / `.btn--ghost` | Pill, 40px high. One primary per screen. |
| Small button | `.btn--sm` | 32px high, for inline actions (copy, paste, notices). |
| Hero button | `.btn--hero` | Display font, green gradient, 56px. Welcome and Setup complete only. |
| Icon button | `.icon-btn` | 32px square, always with `aria-label`. |
| Icons | `.icon` + `<use href="#i-name">` | Inline SVG sprite in `index.html`, 2px stroke, Lucide style. |
| Input group | `.input-group` | Input plus trailing ghost buttons declared with `data-paste-target`, `data-copy-input`, `data-copy-target`, `data-reveal-target`. |
| Choice card | `.choice` + `.choice__input` (radio) | Selectable card with title, optional `.choice__badge`, and text; used for output mode and layout (with `.layout-thumb`). |
| Swatches | `.swatches` / `.swatch` (`--custom`) | Accent color presets as radios plus a native color picker. |
| Corner picker | `.corner-picker` | 2×2 radio grid drawn as a tiny 16:9 screen. |
| Theme card | `.theme-card` + `.theme-card__apply` (+ `__actions` for custom themes) | Live mini preview (`.mini-overlay` or `.text-sample`), name, vibe, *Modified* badge. Selected state uses the accent border. |
| Mini overlay | `.mini-overlay` | Small CSS replica of the OBS overlay driven by `--mini-*` variables and `data-radius/border/effect/font` attributes. |
| Color field | `.color-grid` / `.color-field` | Native color input in a swatch with label and hint; optional fields pair it with a *Use* checkbox. |
| Check chip | `.check-chip` | Pill-shaped checkbox for inline style flags (bold, italic, uppercase). |
| Save bar | `.savebar` | Sticky pill at the bottom of a page, visible only while there are unsaved changes. |
| Dialog | `dialog.dialog` (`#app-dialog`) | The only modal. `appDialog.prompt()` and `appDialog.confirm({ danger })`; never native `alert`, `confirm`, or `prompt`. |
| Overlay preview | `.overlay-preview` | 1920×1080 iframe of the real overlay scaled into a 16:9 canvas; unsaved style is sent with `postMessage`. The iframe uses `color-scheme: normal` so Chromium keeps it transparent. |
| Disclosure | `.disclosure` | Native `<details>` for advanced options. |
| Field error | `.field__error` + `.input-group.is-invalid` | Inline error under the field (`id="<input-id>-error"`, linked with `aria-describedby`); states the cause and what to copy instead. |
| Toggle | `.toggle` + `.toggle__input` | Native checkbox with `role="switch"`, title and hint. |
| Task list | `.tasks` / `.task` | Numbered setup instructions inside one panel. |
| Copy list | `.copy-list` / `.copy-row` (`--mono`, `--key`) | Label, value, copy button. |
| Panel | `.panel` (`--list`) | Grouped form fields or toggles. |
| Stepper | `.stepper` | Four bars; `.is-done` / `.is-current`. |
| App mark | `.app-mark` (`--sm`, `--quiet`) | Glowing icon tile with gradient ring. |
| Status card | `.status-card` | Sidebar summary, Spotify/OBS rows, tracking switch. |
| Tabs | `.tabs` / `.tab-btn` | `role="tablist"`, arrow-key navigation, panels toggled with `hidden`. |
| Badge | `.badge--success/warning/error/muted` | Status chips with a dot. |
| Notice | `.notice` + `.notice--warning` / `.notice--success` | Inline, non-blocking. Icon + title + text + action row (+ dismiss). |
| Status text | `.auth-status-text` (+ `.success` / `.error`) | Inline async feedback with `role="status"` and `aria-live="polite"`. Hidden when empty. |
| Test result | `.test-result` (+ `.success` / `.error`) | Inline result next to a test button. |

## OBS overlay (`src/overlay/`)

Rendered by OBS Browser Source on a transparent canvas, so it follows its own rules:

- Must work in OBS 28+ (Chromium 103): no `:has()`, no `color-mix()`.
- Sizes in `rem`; `--scale` changes the root font size. Theme colors arrive as `--accent`, `--accent2`, `--text-rgb`, `--surface-rgb`, and `--surface-alpha`; shape, border, effect, and font as `data-*` attributes.
- Built-in themes live in `src/renderer/themes.js`. A theme only sets visual keys; layout, corner, animation, visible parts, labels, and pause behavior stay with the user.
- Legible over any stream: dark surface at 82% opacity by default, text shadow when the background is `transparent`, darker accent on the light background.
- Motion: `--enter` 520 ms ease-out-expo, `--exit` 320 ms ease-in; only `opacity` and `transform`.
- No backdrop blur: OBS composites the page separately, so it cannot blur the scene behind it.

## Accessibility

- Text contrast ≥ 4.5:1 against its surface.
- Every interactive element is a real `<button>`/`<input>` with a visible `:focus-visible` ring.
- Icon-only buttons have `aria-label`.
- Async results are announced via `aria-live="polite"`.
- Minimum target height 32px for icon buttons, 36–44px for text buttons.
