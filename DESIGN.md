---
version: 1.0
name: Cursor-inspired Architectural Site Analysis PPT
description: A PowerPoint-native design system for architectural site and infrastructure analysis. It adapts Cursor's warm editorial canvas, restrained orange accent, hairline structure, and quiet typography to 16:9 Korean presentation slides. Satellite imagery remains photographic evidence while every analytical overlay, label, title, table, and legend remains editable in PowerPoint.

format:
  aspect-ratio: "16:9"
  canvas-width: 1280px
  canvas-height: 720px
  safe-margin-x: 32px
  safe-margin-y: 32px

colors:
  primary: "#F54E00"
  primary-active: "#D04200"
  ink: "#26251E"
  body: "#5A5852"
  muted: "#807D72"
  muted-soft: "#A09C92"
  hairline: "#E6E5E0"
  hairline-soft: "#EFEEE8"
  hairline-strong: "#CFCDC4"
  canvas: "#F7F7F4"
  canvas-soft: "#FAFAF7"
  surface-card: "#FFFFFF"
  on-primary: "#FFFFFF"
  verified: "#26251E"
  outside-radius: "#A09C92"
  map-label-line: "#FFFFFF"

typography:
  font-family: "페이퍼로지 4 Regular"
  font-family-medium: "페이퍼로지 5 Medium"
  font-family-semibold: "페이퍼로지 6 SemiBold"
  font-family-bold: "페이퍼로지 7 Bold"
  title:
    font-size: 46px
    font-weight: 400
    line-height: 1.12
  subtitle:
    font-size: 20px
    font-weight: 400
    line-height: 1.4
  section-label:
    font-size: 15px
    font-weight: 700
    letter-spacing: 0.6px
  metric:
    font-size: 32px
    font-weight: 400
  body:
    font-size: 18px
    font-weight: 400
    line-height: 1.45
  caption:
    font-size: 14px
    font-weight: 400
    line-height: 1.35
  table:
    font-size: 15px
    font-weight: 400

spacing:
  unit: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

rounded:
  none: 0px
  label: 6px
  card: 12px

layout:
  title-top: 56px
  title-left-panel: 770px
  subtitle-top: 132px
  page-number-right: 48px
  page-number-bottom: 28px
  map-frame: "x=32, y=32, w=656, h=656"
  information-panel: "x=720, y=0, w=560, h=720"
  table-frame: "x=64, y=160, w=1152, h=440"

components:
  map-card:
    background-color: "{colors.surface-card}"
    border-color: "{colors.hairline-strong}"
    border-width: 1px
    radius: "{rounded.card}"
  information-panel:
    background-color: "{colors.canvas}"
    border-color: "{colors.hairline}"
    border-width: 1px
  target-pin:
    fill: "{colors.primary}"
    outline: "{colors.on-primary}"
    diameter: 20px
  facility-pin:
    fill: "{colors.verified}"
    outline: "{colors.on-primary}"
    diameter: 16px
  outside-pin:
    fill: "{colors.outside-radius}"
    outline: "{colors.on-primary}"
    diameter: 16px
  target-parcel:
    fill: transparent
    line-color: "{colors.primary}"
    line-width: 4px
  facility-parcel:
    fill: transparent
    line-color: "{colors.map-label-line}"
    line-width: 2px
  radius-ring:
    fill: transparent
    line-color: "{colors.primary}"
    line-width: 3px
  map-label:
    background-color: "{colors.surface-card}"
    text-color: "{colors.ink}"
    border-color: "{colors.hairline-strong}"
    border-width: 1px
    radius: "{rounded.label}"
    font-size: 16px
  native-table:
    header-fill: "{colors.ink}"
    header-text: "{colors.on-primary}"
    row-fill: "{colors.surface-card}"
    alternate-row-fill: "{colors.canvas-soft}"
    border-color: "{colors.hairline}"
  page-number:
    text-color: "{colors.muted}"
    font-size: 13px
---

# Purpose

This file is the single visual authority for reusable architectural site-analysis decks. It starts from the Cursor design language but is explicitly rewritten for PowerPoint, Korean text, satellite maps, and editable GIS evidence.

Do not reproduce the Cursor website as a UI. Translate only its visual character: warm cream canvas, warm black text, one orange accent, editorial whitespace, compact rounded corners, and hairline borders.

# Non-negotiable PowerPoint Rules

1. Every deck uses a 16:9 canvas at 1280 × 720 logical pixels.
2. Use only the supplied **Paperlogy 1.000** family. Use Paperlogy 4 Regular for titles and body, Paperlogy 5 Medium for compact emphasis, Paperlogy 6 SemiBold for labels and table headers, and Paperlogy 7 Bold only for rare high-emphasis text.
3. Keep slide title, subtitle, and page number in the same coordinates on every slide of the same family.
4. Keep titles short and factual. Do not add slogan-like language, decorative kickers, or filler subtitles.
5. Use native PowerPoint text, tables, lines, circles, polygons, and charts. Users must be able to edit them after export.
6. Use raster images only for satellite or aerial imagery and unavoidable source visuals. Never bake pins, labels, parcel lines, legends, tables, or captions into the map bitmap.
7. Preserve geospatial accuracy. Project every overlay from the same bounds, coordinate reference, image size, and crop used for the satellite base.
8. Store sources, query dates, address normalization, coordinate system, and known limitations in speaker notes.
9. Do not distort logos. If no approved logo asset exists, omit the logo instead of inventing one.
10. Fill the slide with useful evidence, but preserve at least 32px safe margins and avoid ornamental density.

# Visual Character

The deck should feel calm, technical, and architectural. The satellite map carries visual complexity. The surrounding slide structure stays flat and restrained.

- Canvas: warm cream `{colors.canvas}`, never pure white across the full slide.
- Text: warm ink `{colors.ink}`, not pure black.
- Accent: Cursor Orange `{colors.primary}` only for the target site, the search radius, and the single most important number.
- Depth: white-on-cream contrast and 1px hairlines. No shadows, bevels, gradients, or glass effects.
- Corners: 12px for the map frame, 6px for map labels. Tables remain square or minimally rounded.
- Decoration: none unless it encodes data.

# Slide Families

## A. Map + Evidence Panel

Use for radius search, infrastructure distribution, and parcel verification.

- Satellite map: `x=32, y=32, w=656, h=656`.
- Evidence panel: `x=720, y=0, w=560, h=720` on `{colors.canvas}`.
- Title: `x=770, y=56`, 46px, regular weight.
- Subtitle or address: `x=770, y=132`, 20px, `{colors.body}`.
- Start the first evidence block around `y=224`.
- Place the legend in the lower half and reserve the final 32px band for a concise editability or source note.
- Never cover the target parcel with a label. Place labels outside critical boundaries and use short leader lines only when necessary.

## B. Native Data Table

Use for infrastructure names, categories, addresses, distances, and verification status.

- Title: `x=64, y=42`.
- Subtitle: `x=64, y=102`.
- Table: `x=64, y=160, w=1152, h≈440`.
- Header uses `{colors.ink}` with white text.
- Body rows alternate `{colors.surface-card}` and `{colors.canvas-soft}`.
- Distance cells use a consistent unit and alignment.
- The table must remain a native PowerPoint table.
- Put methodology in speaker notes. Keep only one short accuracy note on-slide.

## C. Finding / Comparison Slide

Use only when the research supports a conclusion.

- Keep the same title zone as the table family.
- Prefer one dominant map, chart, or comparison over a grid of small cards.
- Use orange for one selected finding. Use ink and gray for the remaining evidence.
- Native charts must retain editable series and categories.

# Map Encoding

Use a stable visual hierarchy across projects:

- Target address point: 20px orange circle with a 2px white outline.
- Target parcel: 4px orange outline, transparent fill.
- Verified facility: 16px ink circle with a 2px white outline.
- Facility parcel: 2px white outline when visible on imagery.
- Facility outside the requested radius: muted gray.
- Search radius: 3px orange outline, transparent fill.
- Label: white fill, 1px warm-gray border, 6px radius, 16px text.
- Label content: facility name plus rounded distance. Put full addresses in the data table, not on the map.

Pins and parcel boundaries must use the exact projected coordinates from the research database. Manual visual nudging may affect label placement only, never geographic points or parcel geometry.

# Typography

Use regular weight for large headings to preserve Cursor's editorial tone. Bold is reserved for short table headers, section labels, and a small number of factual highlights.

The PowerPoint family names stored inside the supplied font files are `페이퍼로지 4 Regular`, `페이퍼로지 5 Medium`, `페이퍼로지 6 SemiBold`, and `페이퍼로지 7 Bold`. Reference these exact names. Do not synthesize bold or substitute Malgun Gothic.

- Deck or slide title: 42–48px.
- Subtitle or address: 19–21px.
- Main metric: 28–34px.
- Body and legend: 17–20px.
- Table text: 14–16px, never smaller unless the user explicitly requests a dense appendix.
- Caption and page number: 13–14px.

Do not shrink text to solve overcrowding before simplifying wording or changing the layout.

# Content Density and Alignment

- Align all objects to a 4px base grid.
- Related labels sit close to their evidence. Unrelated groups need at least 24px separation.
- Keep the title and subtitle visually connected. Avoid a large empty gap between them.
- Avoid leaving the lower third empty when additional verified evidence belongs on the slide.
- Do not create dashboard-like card grids. The preferred composition is one map plus one evidence column, or one native table.
- Keep all text within the safe area and check Korean line breaks manually.

# Editability Contract

The final `.pptx` must support these actions without rebuilding the deck:

- Move or recolor a facility pin.
- Edit a facility name or distance label.
- Change the search-radius line style.
- Edit parcel outlines as PowerPoint shapes.
- Change table cells directly.
- Edit chart values through the chart's embedded workbook when a chart exists.
- Replace the satellite image while retaining the overlay layer order.

Recommended layer order from back to front:

1. Slide canvas
2. Satellite image
3. Search radius
4. Parcel outlines
5. Pins
6. Labels and leader lines
7. Title, legend, notes, and page number

# Quality-Control Loop

Follow the one-slide refinement method before scaling to a full project:

1. Generate one representative map slide.
2. Render it at full size.
3. Check title/subtitle coordinates, map crop, target alignment, label collisions, font substitution, and lower-page balance.
4. Correct the design rule or generator, not just the exported slide.
5. Generate the slide again and compare it with the previous version.
6. After the representative slide passes, build the remaining slides.
7. Render and inspect every final slide individually.

# Do

- Use `{colors.primary}` sparingly and consistently.
- Keep the satellite image visually dominant.
- Keep titles and addresses in fixed positions.
- Preserve native PowerPoint objects for analytical evidence.
- Record data provenance and limitations in speaker notes.
- Use one coordinate transformation for each map and all its overlays.

# Do Not

- Do not copy website navigation, buttons, pricing cards, or product UI into the deck.
- Do not use orange for ordinary facilities or decorative accents.
- Do not add drop shadows, gradients, decorative icons, or unnecessary badges.
- Do not use screenshots of tables or charts.
- Do not merge analytical overlays into the satellite image.
- Do not move geographic points to reduce label collisions.
- Do not claim parcel-level accuracy when only road-address geocoding was verified.
- Do not publish API keys, credentials, or private endpoints in the deck, notes, or repository.

# Project-Specific Defaults

- Project type: architectural site and surrounding-infrastructure analysis.
- Default subject address: 서울특별시 송파구 법원로8길 8.
- Default map source: VWorld satellite imagery, subject to its license and attribution requirements.
- Default output: editable `.pptx` plus the underlying structured research database.
- Branding: no logo until the user supplies an approved source asset.
- Font source: `assets/fonts/Paperlogy-1.000/`, copied from the user-supplied `Paperlogy-1.000.zip`.

# Iteration Notes

When the user edits a generated slide, compare the edited slide with the generated version and update this file with measurable rules: exact coordinates, font sizes, widths, spacing, colors, and object ordering. Keep this document in English for more reliable machine interpretation, while all audience-facing deck copy may remain Korean.
