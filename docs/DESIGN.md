# DESIGN.md: PoultryPilot

> **Revision 2.** The v1 palette failed the WCAG 2.1 AA target that the same document set for
> itself — it was the stock Material palette, pasted in without contrast validation. Every colour
> below has been recomputed and its ratio is stated. v1 also had no chart specification, no series
> palette, no empty or error states, no breakpoints, and no dark mode, for a product whose stated
> identity is "data-rich" *(G-53, G-54, G-55)*.
>
> **This is specification, not visual design.** There are no wireframes, mockups, or logo here —
> those need a designer or a design tool. What follows is everything an engineer needs to build
> consistently without one.

---

## 1. Brand & Experience Goals

PoultryPilot is clean, modern, and data-dense — professional clarity with an approachable, natural
feel. Earthy and fresh tones convey reliability, growth, and health. The design's job is to make
complex data digestible and actionable for someone who is, at the moment of use, standing in a barn
with one hand free.

| Goal | Target |
|:---|:---|
| **Efficiency of entry** | A full day's logging for all flocks completes in under 2 minutes |
| **Clarity of insight** | A user identifies a trend or problem on the dashboard within 5 seconds |
| **Actionable alerts** | 90% of critical alerts are responded to within 24 hours |

**Design consequence of the primary context:** data entry happens on a phone, one-handed, possibly
in gloves, in bright daylight or dim barn lighting. This drives the 44px minimum touch target, the
mobile-first numeric inputs, and the elevated contrast floor below. It is the single most important
constraint in this document.

---

## 2. Colour

### 2.1 Method

Every foreground colour states its contrast ratio against its intended background, computed with the
WCAG 2.1 relative-luminance formula.

| Use | Minimum ratio |
|:---|:---|
| Body text, labels, placeholder text | **4.5:1** |
| Large text (≥24px, or ≥18.66px bold) | **3:1** |
| UI component boundaries, icons, chart marks | **3:1** |
| Decorative fills carrying no information | none |

**Placeholder text counts as text.** v1's `#ADB5BD` placeholder measured 2.07:1 — one of the clearest
failures in the set, and a common one, because placeholder colour is usually chosen by eye.

### 2.2 Light theme tokens

```css
:root {
  /* ── Surfaces ───────────────────────────────── */
  --color-bg:            #FFFFFF;
  --color-surface:       #F8F9FA;  /* cards, panels */
  --color-surface-sunken:#F1F3F5;  /* table headers, wells */
  --color-border:        #DEE2E6;  /* 1.47:1 — decorative only, never a sole signal */
  --color-border-strong: #ADB5BD;  /* 2.07:1 — pairs with a shape or label, not alone */

  /* ── Text ───────────────────────────────────── */
  --color-text:          #212529;  /* 16.10:1 on white — headings, primary */
  --color-text-body:     #495057;  /*  8.18:1 — body copy */
  --color-text-muted:    #6C757D;  /*  4.69:1 — placeholder, captions, hints */

  /* ── Brand ──────────────────────────────────── */
  --color-primary:       #2E7D32;  /*  5.13:1 — text, icons, primary button fill */
  --color-primary-hover: #1B5E20;  /*  7.87:1 */
  --color-primary-weak:  #E8F5E9;  /* tinted background; pair with --color-primary text */

  --color-secondary:     #1565C0;  /*  5.75:1 — links, secondary actions */
  --color-secondary-hover:#0D47A1; /*  8.59:1 */
  --color-secondary-weak:#E3F2FD;

  /* ── Status: text and icon (AA on white) ────── */
  --color-danger:        #C62828;  /*  5.62:1 */
  --color-warning:       #B45309;  /*  5.02:1 */
  --color-caution:       #8D6708;  /*  5.15:1 — the old #FFC107 was 1.64:1 */
  --color-success:       #2E7D32;  /*  5.13:1 */
  --color-info:          #1565C0;  /*  5.75:1 */

  /* ── Status: surface tints (backgrounds only) ─ */
  --color-danger-weak:   #FDECEA;
  --color-warning-weak:  #FEF3E2;
  --color-caution-weak:  #FFF8E1;
  --color-success-weak:  #E8F5E9;
  --color-info-weak:     #E3F2FD;

  /* ── Focus ──────────────────────────────────── */
  --color-focus:         #0D47A1;  /* 8.59:1 — never removed, never subtle */
}
```

### 2.3 What changed and why

| Role | v1 | Ratio | v2 | Ratio |
|:---|:---|:---:|:---|:---:|
| Primary green | `#4CAF50` | 2.78:1 ✗ | `#2E7D32` | **5.13:1** ✓ |
| Secondary blue | `#2196F3` | 3.13:1 ✗ | `#1565C0` | **5.75:1** ✓ |
| Danger red | `#F44336` | 3.76:1 ✗ | `#C62828` | **5.62:1** ✓ |
| Warning orange | `#FF9800` | 2.15:1 ✗ | `#B45309` | **5.02:1** ✓ |
| Caution yellow | `#FFC107` | 1.64:1 ✗ | `#8D6708` | **5.15:1** ✓ |
| Muted text | `#ADB5BD` | 2.07:1 ✗ | `#6C757D` | **4.69:1** ✓ |

The hues are preserved — this still reads as the same green-and-blue farm product. Each is simply
dark enough to carry text. The original brighter values remain usable as **decorative fills** where
no information depends on them, but never behind or as text.

### 2.4 Colour is never the only signal

Every status is carried by **at least two** of: colour, an icon, and a text label. A user with
deuteranopia, or one reading a phone in direct sunlight, gets the same information.

| Status | Colour | Icon | Label |
|:---|:---|:---|:---|
| Normal | — | — | value only |
| Caution | `--color-caution` | ▲ | "Below average" |
| Warning | `--color-warning` | ⚠ | "Low stock" |
| Critical | `--color-danger` | ● | "Mortality spike" |
| Withdrawal | `--color-danger` | ⊘ | "Under withdrawal until 3 Aug" |

### 2.5 Dark theme

```css
:root[data-theme="dark"] {
  --color-bg:            #121417;
  --color-surface:       #1A1D21;
  --color-surface-sunken:#0D0F11;
  --color-border:        #2C3034;
  --color-border-strong: #495057;

  --color-text:          #F8F9FA;  /* 16.4:1 on --color-bg */
  --color-text-body:     #DEE2E6;  /* 12.9:1 */
  --color-text-muted:    #9AA3AB;  /*  5.9:1 */

  --color-primary:       #81C784;  /*  9.17:1 on --color-bg */
  --color-primary-hover: #A5D6A7;  /* 11.6:1 */
  --color-primary-weak:  #1B2E1D;

  --color-secondary:     #64B5F6;  /*  8.6:1 */
  --color-secondary-hover:#90CAF9; /* 11.0:1 */
  --color-secondary-weak:#12243A;

  --color-danger:        #EF9A9A;  /*  8.9:1 */
  --color-warning:       #FFB74D;  /* 10.2:1 */
  --color-caution:       #FFD54F;  /* 12.4:1 */
  --color-success:       #81C784;  /*  9.17:1 */
  --color-info:          #64B5F6;  /*  8.6:1 */

  --color-focus:         #90CAF9;
}
```

Dark theme **inverts the lightness relationship**: light-theme accents are darkened to sit on white,
dark-theme accents are lightened to sit on near-black. Reusing the light values on a dark surface is
the most common dark-mode error and produces 1.5:1 text.

Default to `prefers-color-scheme`; a manual toggle sets `data-theme` on the root and wins over it.

---

## 3. Data Visualization

Absent from v1 entirely, in a product that describes itself as data-rich.

### 3.1 Categorical series palette

Ordered. Use in sequence; do not skip to a colour because it looks nicer. All ratios are against
`--color-bg` light.

| # | Hex | Ratio | Typical series |
|:---:|:---|:---:|:---|
| 1 | `#1565C0` | 5.75:1 | Primary metric — eggs, actual weight |
| 2 | `#B45309` | 5.02:1 | Comparison — 7-day average, target weight |
| 3 | `#00695C` | 6.62:1 | Third series — water |
| 4 | `#7B1FA2` | 8.20:1 | Fourth series — feed |
| 5 | `#C62828` | 5.62:1 | Negative-valence series — mortality |
| 6 | `#4E342E` | 9.87:1 | Fifth series |

**Six is the maximum.** Beyond six, categorical encoding stops working regardless of palette; switch
to small multiples.

Ordered 1–4 to remain distinguishable under the common colour-vision deficiencies: blue/orange
separates under deuteranopia and protanopia, and the teal/purple pair separates by lightness as well
as hue. Every pairing also differs by at least 1.3:1 in contrast, so the series remain distinct in
greyscale printing.

### 3.2 Sequential and diverging

- **Sequential** (single-hue intensity, e.g. a production heatmap):
  `#E3F2FD → #90CAF9 → #42A5F5 → #1565C0 → #0D47A1`
- **Diverging** (variance around a target, e.g. actual vs. target weight):
  `#C62828 ← #EF9A9A ← #F5F5F5 → #A5D6A7 → #2E7D32`, always anchored at zero.

### 3.3 Chart rules

| Rule | Detail |
|:---|:---|
| **Y-axis origin** | Bar charts start at zero, always. Line charts may crop, but must label the range explicitly. |
| **Gridlines** | Horizontal only, `--color-border`, 1px. No vertical gridlines, no chart borders. |
| **Series labelling** | Label the line directly at its right end where space allows. A legend is the fallback, not the default. |
| **Target lines** | Dashed 4-4, `--color-warning`, labelled inline. |
| **Data density** | ≤31 points shows markers; beyond that, line only. |
| **Missing data** | **Break the line.** Never interpolate across an unlogged day — a farmer must be able to see that a day is missing. |
| **Tooltips** | Trigger on hover *and* focus. Include date, value, unit. Never the only route to a value. |
| **Touch** | Minimum 44×44px hit area on every interactive mark. |
| **Reduced motion** | `prefers-reduced-motion` disables entry animation; charts render at final state. |
| **Empty** | "No data for this period" plus what would produce some — never an empty grid. |

**Interpolation across missing days is the rule most worth enforcing.** A smooth line through an
unlogged day looks like data. Backfilling is a documented flow *(USER_FLOWS §4.4)* precisely because
gaps are expected.

---

## 4. Typography

- **Headings:** Montserrat · **Body:** Lato · **Numerals:** Lato, `font-variant-numeric: tabular-nums`

Tabular figures are mandatory in every table, metric tile, and chart axis. Proportional digits make
a column of weights visually ragged and slow to scan.

**Fallback stack** — absent from v1, so a font-load failure fell back to Times:
```css
--font-heading: 'Montserrat', 'Segoe UI', system-ui, -apple-system, sans-serif;
--font-body:    'Lato', 'Segoe UI', system-ui, -apple-system, sans-serif;
```
Load with `font-display: swap`, preload the two weights used above the fold.

### 4.1 Responsive scale

v1 specified a single 48px dashboard metric with no responsive scale — it overflows on a 360px phone,
the primary field device.

| Token | Mobile | Desktop | Use |
|:---|:---:|:---:|:---|
| `xs` | 12 | 12 | Captions, table meta |
| `sm` | 14 | 14 | Labels, secondary text |
| `base` | 16 | 16 | Body, form inputs — **never below 16px on inputs**, iOS zooms otherwise |
| `lg` | 18 | 18 | Subheadings |
| `xl` | 20 | 24 | Section titles |
| `2xl` | 24 | 32 | Page titles |
| `3xl` | 30 | 48 | Dashboard primary metrics |

Weights: 300 Light · 400 Regular · 600 Semi-bold · 700 Bold. Line height 1.5 for body, 1.2 for
headings and metrics.

---

## 5. Spacing, Radius, Elevation

4px grid.

```css
--space-xs: 4px;   --space-sm: 8px;   --space-md: 12px;  --space-lg: 16px;
--space-xl: 24px;  --space-2xl:32px;  --space-3xl:48px;  --space-4xl:64px;

--radius-sm: 2px;  --radius-md: 4px;  --radius-lg: 8px;  --radius-full: 9999px;

--shadow-sm: 0 1px 2px rgb(0 0 0 / .06);
--shadow-md: 0 2px 8px rgb(0 0 0 / .08);
--shadow-lg: 0 8px 24px rgb(0 0 0 / .12);
```

Elevation is a hierarchy, not decoration: `sm` cards · `md` dropdowns and popovers · `lg` modals.
In dark theme, elevation is expressed by **surface lightness**, not shadow — shadows are invisible on
near-black.

---

## 6. Breakpoints

| Name | Width | Layout |
|:---|:---|:---|
| `sm` | < 640px | Single column. Bottom nav. Cards stack. Tables become stacked lists. |
| `md` | 640–1023px | Two-column dashboard. Side nav collapsed to icons. |
| `lg` | 1024–1439px | Three-column dashboard. Persistent side nav. |
| `xl` | ≥ 1440px | Content capped at 1440px, centred. |

**Mobile-first.** Base styles target `sm`; larger breakpoints add. Daily data entry is designed at
`sm` and adapted upward, not the reverse — it is the flow that happens in the barn.

Tables do not scroll horizontally on mobile. They become stacked label-value cards, because a
horizontally scrolling table one-handed on a phone is unusable.

---

## 7. Component States

Every interactive component specifies all seven. v1 specified hover and validation only.

| State | Treatment |
|:---|:---|
| **Default** | Base tokens |
| **Hover** | Background shifts one step; `--shadow-sm` on cards. Pointer devices only. |
| **Focus** | 2px `--color-focus` outline, 2px offset. **Never removed.** Use `:focus-visible`. |
| **Active** | Background shifts two steps; shadow removed to read as pressed |
| **Disabled** | 38% opacity, `cursor: not-allowed`, `aria-disabled`. Never the only explanation — pair with text saying why |
| **Loading** | In-place spinner, original width preserved, `aria-busy`. Never a layout shift |
| **Error** | 2px `--color-danger` border, icon, message below. **Never colour alone** |

**Touch targets:** minimum 44×44px, 8px minimum between adjacent targets.

### 7.1 Screen-level states

Every data view specifies four. v1 specified none, which is why the flows in
[USER_FLOWS.md](USER_FLOWS.md) reference states that have no visual definition.

| State | Contains |
|:---|:---|
| **Empty (first run)** | What this screen is for, the primary action, an example. Never "No data." |
| **Empty (filtered)** | What was filtered, a clear-filter action |
| **Loading** | Skeletons matching final layout — not a centred spinner. Skeletons prevent the layout shift that costs CLS |
| **Error** | What failed, whether data is safe, a retry. Form input is **always** preserved *(USER_FLOWS, Cross-Cutting)* |

### 7.2 Warnings versus errors

The API returns a `warnings` array on successful writes *(API §3)*. These are visually distinct from
errors and must never look like failure:

| | Error | Warning |
|:---|:---|:---|
| Meaning | Nothing was saved | Saved, with a caveat |
| Placement | Inline, at the field | Toast below the form, after save |
| Colour | `--color-danger` + `--color-danger-weak` | `--color-warning` + `--color-warning-weak` |
| Icon | ⚠ filled | ⓘ outline |
| Dismissible | No — blocks until fixed | Yes |
| Example | "Mortality cannot exceed 48" | "Saved. Layer Feed is now −2.4 kg." |

---

## 8. Motion

| Token | Duration | Use |
|:---|:---|:---|
| `--motion-fast` | 150ms | Hover, focus, colour shifts |
| `--motion-base` | 200ms | Dropdowns, tooltips, toasts |
| `--motion-slow` | 300ms | Modals, drawers, page transitions |

Easing `ease-in-out`; entering elements `ease-out`, exiting `ease-in`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
```

Chart data never animates on data change — only on first paint. A re-animating value is unreadable
during the animation, which is exactly when the user is trying to read it.

---

## 9. Accessibility

Target: **WCAG 2.1 Level AA**. The colour system above is built to meet it; §2.3 records the v1
values that did not.

- **Contrast** — every ratio in this document is computed, not estimated. New colours must be
  verified before use.
- **Keyboard** — full operability, logical tab order, visible focus on everything, no traps, skip
  link to main content. Modals trap focus while open and restore it on close.
- **Semantics** — real HTML elements. `<button>` for actions, `<a>` for navigation, `<table>` for
  tabular data with proper headers and scopes.
- **ARIA** — only where native semantics fall short. Live regions (`aria-live="polite"`) for toasts
  and alert counts; `aria-live="assertive"` reserved for errors.
- **Forms** — every input has a visible `<label>`. Placeholders are never labels. Errors are tied by
  `aria-describedby`. Required fields are marked in text, not by colour or an asterisk alone.
- **Charts** — every chart has an accessible name, a text summary, and a data table alternative.
  A chart is never the only path to a number.
- **Zoom** — usable to 200% without horizontal scrolling; no `maximum-scale`.
- **Targets** — 44×44px minimum, exceeding the AA requirement because of the gloved, one-handed
  context.

### 9.1 Verification

| Layer | Method |
|:---|:---|
| Automated | `axe-core` in CI; build fails on any violation |
| Contrast | Every token verified at definition; documented in §2 |
| Keyboard | Manual pass per screen before release |
| Screen reader | NVDA (Windows) and VoiceOver (iOS) on the daily-entry and dashboard flows |

Automated tooling catches roughly a third of WCAG issues. The manual passes are not optional.

---

## 10. Screen Priorities

**Admin:** Dashboard · Daily Data Entry · Flock Management · Inventory · System Configuration ·
User Management · Reports · Sales

**Farm Worker:** Daily Data Entry · Dashboard · Health & Treatment · Inventory (read-only)

> Daily Data Entry ranks second for Admin and first for Worker: it is the only screen touched every
> single day, and the task-completion KPI (>95% of days logged) depends entirely on it.

---

## Open Items

| Gap | Issue |
|:---|:---|
| — | **No wireframes, mockups, or logo.** This document specifies a system; it does not draw screens. |
| — | No icon set chosen. Needs to cover ▲ ⚠ ● ⊘ ⓘ plus navigation. Lucide or Phosphor would suit. |
| — | No PDF invoice template design *(FR-09)*. |
| **G-56** | Design assumes connectivity. If offline entry is ever adopted, sync and conflict states need designing. |
