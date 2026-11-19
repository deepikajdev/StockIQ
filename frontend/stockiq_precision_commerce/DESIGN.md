---
name: StockIQ Precision Commerce
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  hero-metric:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  page-title:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  section-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  lead:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-default:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  table-cell:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  table-header:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  overline:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  page-title-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system embodies the convergence of Linear's precision, Stripe's financial rigor, and Notion's document-like calm. Created for independent retail shop owners and inventory leads, it transforms anxiety-inducing stock tracking into a calm, confident operational cockpit.

The visual direction uses a refined **Modern Utility / High-Precision Minimalism** aesthetic:
- **Tension & Density:** Tight, dense information design where data density is mandatory (tables, calculation trees, stock matrices), paired with airy, comfortable spacing where strategic interpretation takes place (KPI summaries, recommendation digests).
- **Explainable Metrics ("Show the Work"):** The interface never presents a raw number in isolation. Every stock anomaly, forecasted stock-out date, and restock suggestion displays its provenance through micro-metadata, formulas, or contextual popovers.
- **Controlled Expressiveness:** Chrome remains strictly flat and functional. Gradients are reserved solely for high-leverage anchor points: the primary product mark, the hero reorder index metric, and select zero-state canvases.

## Colors

The palette establishes an atmosphere of grounded credibility using deep indigo tones complemented by an analytical teal for algorithmic validation.

### Palette Architecture
- **Primary Indigo (`#4F46E5`):** Commands action, focal selection, active navigation nodes, and primary system commitments. Hover transitions to `#4338CA`; subtle selections leverage `#EEF2FF`.
- **Secondary Teal (`#0D9488`):** Allocated strictly to "intelligence moments"—prescriptive restock signals, high-velocity forecasts, and algorithmically sound inventory states.
- **Neutrals (Slate Core):**
  - Page Background: `#F8FAFC`
  - Card & Container Surface: `#FFFFFF`
  - Subdued Surface / Table Striping: `#F1F5F9`
  - Hairline Borders & Dividers: `#E2E8F0`
  - Muted / Supporting Labels: `#64748B`
  - High-Contrast Text: `#0F172A`

### Semantics & Status Signaling
Color is never utilized as the sole vector of meaning; it must always be anchored by an icon, an explicit badge status string, or signed arithmetic prefixing:
- **Stock Depleted / Critical Danger:** `#DC2626` (Fill/Tint: `#FEE2E2`)
- **Restock Warning / Low Reserve:** `#D97706` (Fill/Tint: `#FEF3C7`)
- **Optimal / Surplus / Success:** `#16A34A` (Fill/Tint: `#DCFCE7`)
- **Informational / Transit:** `#0284C7` (Fill/Tint: `#E0F2FE`)

### Dark Mode System
When shifting to the dark theme, surface depth transitions to slate-navy rather than true black to avoid harsh optical clipping:
- Canvas: `#0B1020`
- Surface Containers: `#121A2E`
- Elevated Overlays & Drawers: `#18233D`
- Structural Lines: `#25314D`
- Body Foreground: `#E6EAF5`
- Subdued Metadata: `#8A97B5`
- Primary Accent Shift: Shifts up to Indigo 400 (`#818CF8`) to ensure WCAG AAA legibility against dark slate.

### Brand Signature Gradient
- Defined as `linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)`.
- Restrict usage exclusively to: the primary application icon mark, the primary Hero KPI highlight badge, and empty-state spot illustrations. All standard buttons, sidebars, headers, and cards must remain entirely flat.

## Typography

The type system runs on a disciplined implementation of Inter. Because this platform handles mission-critical accounting and stock calculations, numerical fidelity is paramount.

### Tabular Numerals Rule
All elements presenting numeric data—including counts, inventory velocity, monetary units, days-of-supply, and timestamps—must enforce `font-variant-numeric: tabular-nums` (or OpenType feature `'tnum' 1`). Columns of numbers must align cleanly on their decimal or fractional axes.

### Formatting & Currency Rules
- Currencies must adhere to the Indian Numbering System with explicit comma segregation (`₹1,24,580.00`).
- Overline text must be rendered in uppercase with wide letter-spacing (`0.05em`) to categorize complex inventory sub-modules cleanly without demanding visual weight.
- Negative values must carry an explicit minus sign (`-`) and red hue (`#DC2626`); incoming or credited amounts must feature an explicit plus sign (`+`) and green hue (`#16A34A`).

## Layout & Spacing

The spatial architecture is grounded in a rigorous 8px base grid, maintaining balance between high-density operational tables and scannable strategic dashboards.

### Shell Architecture
- **Desktop Layout:** 
  - Fixed-width collapsible sidebar: `248px` wide, border-right `1px solid #E2E8F0`.
  - Header toolbar: `64px` height with contextual search, store switcher, and notification badges.
  - Main operational stage: Fluid horizontal distribution bounded by a maximum width constraint of `1440px` to maintain optimal data scanning lines.
- **Breakpoints:**
  - Compact (Mobile): `< 768px` — Single column, collapsed slide-over drawer navigation, table cards reflow into structured vertical stacks.
  - Medium (Tablet): `768px – 1024px` — Sidebar shifts to an icon-only `64px` rail; KPI cards shift to a 2x2 grid.
  - Expanded (Desktop): `> 1024px` — Full 248px navigational sidebar, multi-column dashboard, side-by-side calculation panes.

### Padding and Container Cadence
- Card interiors apply `1.25rem` (20px) or `1.5rem` (24px) padding for standard metrics, down to `1rem` (16px) for compact data tables and filter panels.
- Content gaps across distinct functional blocks strictly utilize `space-xl` (32px), preserving cognitive separation between overview charts, active alerts, and line-item tables.

## Elevation & Depth

To preserve the clean aesthetic of Linear and Notion, depth is achieved primarily through layered surface planes and crisp, razor-sharp hairline borders (`1px solid #E2E8F0`), rather than heavy drop shadows.

### Elevation Hierarchy
- **Level 0 (Base Canvas):** Flat canvas background (`#F8FAFC` in light mode, `#0B1020` in dark mode).
- **Level 1 (Card & Content Blocks):** Pure white `#FFFFFF` surface bordered by a 1px stroke of `#E2E8F0`. Grounded by an ultra-soft dual shadow:
  - Ambient: `0 1px 2px rgba(15, 23, 42, 0.04)`
  - Direct: `0 8px 24px rgba(15, 23, 42, 0.04)`
- **Level 2 (Dropdowns, Popovers, & Quick Edits):** Floating tooltips, formula breakdowns, and combobox menus:
  - Surface: `#FFFFFF`
  - Border: `1px solid #E2E8F0`
  - Shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 10px 15px -3px rgba(15, 23, 42, 0.06)`
- **Level 3 (Modal Dialogs & Context Drawers):** 480px sliding right drawers and modal confirm windows:
  - Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`
  - Backing Backdrop Scrim: `rgba(15, 23, 42, 0.45)` with a `backdrop-filter: blur(2px)` pass.

## Shapes

The geometry uses balanced rounding that avoids both brutalist sharpness and overly playful bubbles, conveying steady software craftsmanship:

- **Base Components (`rounded` / 8px):** Form inputs, select triggers, quantity adjusters, table cell selections, dropdown popovers, and primary command buttons.
- **Containers & Structural Blocks (`rounded-lg` / 12px):** All standalone cards, KPI blocks, slide-in drawer corners, dialog boxes, and notification banners.
- **Pills & Status Identifiers (Full Radius / `9999px`):** Inventory badges, signed quantity chips, interactive tag filters, and numerical summary pills.

## Components

### Buttons
All primary interactive buttons use a standard height of `36px` (`space-md` horizontal padding, 13px/14px medium type):
- **Primary:** Filled Indigo (`#4F46E5`), white text, subtle top inner-bevel light stroke (`inset 0 1px 0 rgba(255,255,255,0.15)`), hover to `#4338CA`.
- **Secondary:** Surface `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`, hover `#F8FAFC`.
- **Ghost:** Transparent canvas, hover `#F1F5F9`, text `#64748B` switching to `#0F172A` on interaction.
- **Destructive:** Tint `#FEE2E2`, border `#FECACA`, text `#DC2626`, hover to `#DC2626` with `#FFFFFF` text.
- **Icon Only:** 36x36px square bounding box, centered 16px icon, standard ghost or outline behavior.

### Data Tables (The Operational Core)
- **Header:** Height `36px`, uppercase `11px` overline styling, background `#F8FAFC`, sticky positioning with hairline bottom border.
- **Rows:** Height `48px`, baseline cell alignment, hover background `#F8FAFC`.
- **Alignments:** Left-align SKU details and category strings; right-align all numeric fields, unit prices, minimum thresholds, and lead-time days.
- **Interactive Sorting:** Hover reveals an up/down caret; active sorting renders a fixed Indigo arrow.

### Form Inputs & Comboboxes
- Standard input height `36px`, border `1px solid #E2E8F0`, padding `0 12px`.
- Focus ring: `0 0 0 2px #EEF2FF, 1px solid #4F46E5` without heavy generic rings.
- Quantity Stepper: Compound component with decrement/increment ghost triggers flanking an explicit `tabular-nums` center input.
- Date-Range Picker: Includes quick presets ("Last 7 Days", "Last 30 Days", "Festive Season Spike", "Lead Time Window").

### Status Chips & Signed Pills
- **Status Indicator Badges:** Full-pill structure containing a `6px` solid status dot paired with a status label:
  - *In Stock:* Light green container (`#DCFCE7`), green dot and text (`#16A34A`).
  - *Low Stock:* Amber container (`#FEF3C7`), amber dot and text (`#D97706`).
  - *Out of Stock:* Red container (`#FEE2E2`), red dot and text (`#DC2626`).
  - *Draft / Inactive:* Neutral container (`#F1F5F9`), slate dot and text (`#64748B`).
- **Signed Quantity Pill:** High-density chips displaying delta movement:
  - Stock replenishment: `+24` with green background `#DCFCE7` and text `#15803D`.
  - Stock shrinkage/sale: `-3` with red background `#FEE2E2` and text `#B91C1C`.

### KPI Cards with Micro-Sparklines
- Structure: Metric label in caption uppercase (`11px`), current value displayed in `36px` hero number, followed by a secondary footer containing the delta comparison.
- Embedded Sparkline: A 40px tall inline SVG sparkline sitting along the right flank, highlighting the 30-day velocity trend without axis clutter.

### Slide-Over Drawer
- Width: `480px`. Anchored to the right viewport boundary for detailed stock inspects, recalculation breakdowns, and supplier purchase order previews without breaking context from the master list.