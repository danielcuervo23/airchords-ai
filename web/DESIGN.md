---
name: AirChords
description: Cada acorde es un color de luz de escenario (direccion B, Gelatina).
colors:
  curtain: "#1C1216"
  curtain-2: "#2A1C22"
  curtain-3: "#3A2830"
  chalk: "#F6EEE9"
  chalk-2: "#CDBDC3"
  gel-1-amber: "#F5A623"
  gel-2-pink: "#EF5B8C"
  gel-3-violet: "#A386EE"
  gel-4-mint: "#3FC59A"
  gel-5-sky: "#4AA8F0"
  gel-6-coral: "#F26B4F"
  gel-7-straw: "#E8D86A"
typography:
  chord-display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "92px"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 900
    lineHeight: 1
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  picker:
    backgroundColor: "{colors.curtain-2}"
    textColor: "{colors.chalk}"
    rounded: "14px"
    height: "52px"
    padding: "10px 14px"
  picker-hover:
    backgroundColor: "{colors.curtain-3}"
  button-cta:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.curtain}"
    rounded: "{rounded.xl}"
    padding: "18px"
  degree-badge:
    backgroundColor: "{colors.gel-2-pink}"
    textColor: "{colors.curtain}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: AirChords

Source: `web/design/mockups/direccion-b.html` (chosen over A and C; all three are kept in `web/design/mockups/`). Tokens live in `web/src/ui/tokens.css` as CSS custom properties; names below match them. Mode: Operate (an instrument you play), with a Persuade home screen.

## Overview

**Creative North Star: "La gelatina de escenario"**

In theatre, a lighting tech changes the scene by putting a coloured sheet (a gel) in front of the lamp. Here every chord has its own gel. When the sign changes, the light that washes the camera image changes colour. The seven chords live in a fan of swatches, like the one technicians carry in a pocket.

The ground is a near-black aubergine (the "telon", the stage curtain) so the seven colours carry all the energy. Everything else is quiet: chalk text, flat surfaces, no shadows on the UI. There is one motion gesture, the "cambio de luz".

**Key characteristics:**
- Dark only. One ground, one chalk, seven gels.
- Colour means chord. Never use a gel as decoration or as a generic accent.
- Chord names and titles are extended and heavy. Body is normal width. Numbering is condensed.
- Flat surfaces; depth comes from tone steps (curtain, curtain-2, curtain-3), not shadows.

## Colors

### Surfaces (telon)
- **Curtain** `#1C1216` (`--curtain`): page, device, panels. Also the ink colour on top of any gel.
- **Curtain 2** `#2A1C22` (`--curtain-2`): raised surfaces: pickers, switch, cue rows, segmented control.
- **Curtain 3** `#3A2830` (`--curtain-3`): hover state of raised surfaces, toggle track off, slider track, 1px dividers.
- **Curtain deep** `#120B0E` (`--curtain-deep`): desktop window chrome only.

### Text (tiza)
- **Chalk** `#F6EEE9` (`--chalk`): primary text and icons. 15.97:1 on curtain, 14.23:1 on curtain-2.
- **Chalk 2** `#CDBDC3` (`--chalk-2`): secondary text, labels, captions. 10.16:1 on curtain, 9.06:1 on curtain-2, 7.64:1 on curtain-3. Never use it on video.

### The 7 chord gels

Degree maps to token and to chord in key C major. The key can change; the colour follows the **degree**, not the note name.

| Degree | Token | Hex | Name | Chord in C | Ink (curtain) on gel |
|---|---|---|---|---|---|
| I | `--g1` | `#F5A623` | amber | C | 9.03:1 |
| II | `--g2` | `#EF5B8C` | pink | Dm | 5.70:1 |
| III | `--g3` | `#A386EE` | violet | Em | 6.28:1 |
| IV | `--g4` | `#3FC59A` | mint | F | 8.42:1 |
| V | `--g5` | `#4AA8F0` | sky | G | 7.10:1 |
| VI | `--g6` | `#F26B4F` | coral | Am | 6.09:1 |
| VII | `--g7` | `#E8D86A` | straw | B dim | 12.60:1 |

Contrast rules for the gels:
- A gel is always a **fill** with **curtain ink** on top (all pass 4.5:1). **Never put chalk text on a gel**: it fails everywhere (1.27:1 on VII, 2.80:1 at best on II).
- A gel as a thin stroke or glyph on curtain also passes (same ratios, symmetrical).
- Colour alone must not carry meaning: always pair a gel with its degree numeral (I to VII) and the chord name.
- `--gel` is the **active** gel. Set it on the instrument root; the wash and the degree badge read it.
- The toggle "on" state uses mint (`--g4`, `--on-state`) with a curtain knob, and its state is also exposed as text/`aria-checked`.

### Over the video
- **Wash**: `--gel` layer with `mix-blend-mode: multiply`, opacity `0.78` (`--wash-opacity`), over the mirrored camera. A faint white-to-transparent `screen` highlight sits on top (14% to 0 over the top 55%).
- **Landmarks**: hand skeleton lines white (`#fff`, 3px, 90% opacity); joints curtain-filled with 2.5px white stroke.

### Named rules
**The One Meaning Rule.** A gel appears only to mean a chord. Not for buttons, links, or sections.
**The Ink Rule.** Text on a gel is curtain. Text on curtain is chalk or chalk-2. Nothing else.

## Typography

**Font:** Archivo (variable, Google Fonts, `wdth 62..125`, `wght 400..900`), fallback `system-ui, sans-serif`, `display=swap`. Consider self-hosting before production, since the product promises that camera data stays on the device.

Three widths do three jobs (`font-stretch`):
- **Extended 125%**, weight 800-900: chord symbols, degree badges, titles, wordmark, CTA, tempo number.
- **Normal 100%**, weight 400-700: body, labels, buttons.
- **Condensed 75%**, weight 700: numbering ("N.º 01", "Cambio 2").

### Ramp
| Role | Size | Weight / width | Use |
|---|---|---|---|
| Chord display (phone) | 92px, lh 0.8, ls -0.03em | 900 / 125% | Chord symbol over video |
| Chord display (desktop) | 132px | 900 / 125% | Same |
| Degree badge | 28px phone, 40px desktop | 800 / 125% | Roman numeral on gel |
| Hero title | 2.55rem, lh 0.95, ls -0.025em | 900 / 125% | Home headline |
| Page title | 1.8rem | 900 / 125% | Guide title |
| Tempo value | 2rem | 900 / 125% | BPM output |
| Subtitle | 1.4rem | 800 / 125% | Section heads |
| Wordmark / CTA | 1.2rem to 1.25rem | 900 / 125% | |
| Body | 1rem, lh 1.5 | 400 / 100% | Paragraphs; picker values at 800 |
| Control label | 0.85rem | 700 | Buttons, segmented control |
| Caption | 0.85rem | 400, chalk-2 | Privacy note, footers |
| Micro label | 0.75rem (12px) | 700 | Picker captions, meters, "Espejo" |

Rules:
- **Minimum 12px (0.75rem)** for any functional text. The mockup used 0.78 to 0.92rem in places; implement these as the nearest ramp step (0.75, 0.85, 1).
- Changing numbers (BPM, step count) use `font-variant-numeric: tabular-nums`.
- Widths only 75 / 100 / 125. Body prose max line length 62ch.

## Layout

Phone portrait is the primary layout; desktop expands it.

**Phone portrait (design width 390, works down to 360):**
- Single column, full height. Video is the top block (about 540px of 844, roughly 64%), edge to edge.
- App bar floats over the top of the video: wordmark left, "Guia" and "Creditos" pill buttons right, on a top scrim.
- Over the video: meters top-right (stacked), chord display bottom-left (20px from edge, 22px from bottom), "Espejo" pill bottom-right.
- Below the video, 16px side padding: cue line and fan of swatches, then a 2-column control grid (Sound 1.2fr and Tone 1fr; Mode and Mask toggle).
- Interactive controls sit in the lower part, within thumb reach.

**Desktop (design 1120 x 760, scales up):**
- Two columns: video fills the left (`1fr`); side panel on the right (`--side-panel-w` 340px, curtain, 1px curtain-3 left border, 20px padding, 16px gap).
- Chord display grows to 132px, bottom-left (28px offsets). Meters sit top-left in a row. Nav pills top-right over the video.
- The side panel stacks: wordmark, Mode segmented control, change sheet (Auto mode), tempo, Sound and Tone pickers (2 columns), mask toggle.
- Recommended switch from phone to desktop layout at `min-width: 900px` (the mockup shows both frames but defines no breakpoint).

**Home and Guide** are phone-first single columns with 22px (home) or 16px (guide) side padding. Home: gel fan across the top 240px fading into curtain, hero title, intro, full-width CTA pinned to the bottom with the privacy line beneath.

**Spacing scale** (4px base): `--sp-1` 4, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 20, `--sp-6` 24, `--sp-7` 32, `--sp-8` 40. Gaps inside a control group are 8px; between blocks 14-16px.

## Elevation & Depth

Flat. No shadows on UI. Depth is tonal (curtain, curtain-2, curtain-3) and by scrim over video. The device frames and window chrome in the mockup are presentation only; do not ship them. Backdrop blur (8-10px) only on pills and meters that sit over video.

## Shapes

Soft and rounded, like gel sheets. Radius scale: `--r-1` 6 (fan swatch top corners), `--r-2` 8 (degree badge, focus ring), `--r-3` 10 (meters, cue rows), `--r-4` 12 (segmented control, guide rows), `--r-5` 14 (pickers, switch), `--r-6` 16 (CTA), `--r-pill` 999 (nav pills, toggle, Espejo). Swatches round their tops more than their bottoms (6px 6px 2px 2px) so the fan reads like cards in a hand.

## Components

Min tap target 44px (pickers and switch 52px). Apply hover only under `@media (hover:hover)`. Focus-visible uses the global ring (see Accessibility). Disabled controls use 45% opacity, `cursor:not-allowed`, and the `disabled` or `aria-disabled` attribute; disabled text is exempt from contrast but the state must also be stated in words where it matters.

### Chord display
Symbol (e.g. `Dm`) in 92px/132px extended black, chalk, with the degree badge beside it (gel fill, curtain ink, radius 8, bottom-aligned to the symbol, 12px gap). Under it the name in weight 500 chalk: "Re menor · tono Do mayor". Container has `aria-live="polite"`. It sits on the bottom scrim. On change, the badge background transitions together with the wash (see Motion).

### Gel fan / swatches ("muestrario")
Row of 7 swatches, 4px gap, equal width, each filled with its gel and holding the hand-sign icon (26px) and its numeral (0.85rem, extended 800) in curtain ink. Ordered list with an `aria-label`.
- **Inactive**: height 62px, full opacity. The mockup dimmed these to 0.62, which drops ink-on-gel below 4.5:1 for II, III, V and VI. Do not dim: use size for hierarchy.
- **Now**: height 96px, `aria-current="step"`.
- **Next**: height 78px, 2px dashed chalk outline with 3px offset, plus a text cue ("Despues: V") in the cue line; the dashes alone are never the only signal.
- Transition: height and outline 500ms `--ease`.
- If swatches are interactive (Free mode): hover lifts 4px and shows a 2px chalk outline; focus-visible uses the ring; active scales 0.97; disabled per the general rule.
- Hand icons: 50x50 viewBox, fill = gel, stroke curtain 2.3, round joins, `aria-hidden`; the label carries meaning.

### Cue line
Above the fan: left bold chalk title (0.95rem, "Acordes de City of Stars"), right caption chalk-2 ("Paso 3 de 12", tabular nums, 0.85rem). 10px bottom margin.

### Now / next guided display (Guided mode)
The fan plus cue line is the display: "now" is the tall swatch, "next" the dashed one, and the cue line says it in words. List `aria-label`: "Muestrario de acordes: ahora II, despues V".

### Auto-mode list ("hoja de cambios")
Label "Hoja de cambios · I - V - VI - IV", then a list with 4px gaps. Row: grid `72px 30px 1fr auto`, 8px gap, padding 8px 12px, radius 10, curtain-2, 0.85rem. Columns: "Cambio n" (condensed 700, chalk-2, no wrap), a 26px swatch in the gel (radius 5), degree + chord symbol (extended 800), chord name.
- **Rest**: curtain-2.
- **Now**: row fills with the gel; all text curtain; the swatch becomes curtain. Background transition 500ms `--ease`.
- If rows are clickable: hover curtain-3; focus-visible ring (use the double ring on gel); active curtain-3 with scale 0.99; disabled per the general rule.
- Advances by itself every 4 beats at the set tempo (60000 / BPM x 4 ms). Auto-advance is function, so it keeps running under reduced motion; only the visual transition is removed.

### Buttons
- **Nav pill** (Guia, Creditos, Cerrar): inline-flex, padding 9px 13px (min height 44px on touch), radius pill, `--glass` background with 10px blur, 0.85rem 700, 16px icon plus text. Hover `--glass-hover` 250ms; focus-visible ring; active `--glass-hover` and scale 0.97; disabled 45% opacity.
- **CTA** (Empezar): full width, padding 18px, radius 16, chalk fill, curtain ink, 1.25rem 900 extended, 20px arrow icon. Hover: translateY(-2px) and `#fff` background, 300ms; focus-visible ring; active translateY(0) scale 0.98; disabled curtain-3 fill, chalk-2 text, no lift.
- Icons always come with a text label.

### Selectors (pickers)
Sound, Tone, Mode. Button, curtain-2, radius 14, padding 10px 14px, min height 52, left aligned. Micro caption on top (0.75rem 600 chalk-2, e.g. "Sonido · abre la boca para cambiar"), value below (1rem 800) with a 14px chevron at 80% opacity. Sound shows its number in condensed chalk-2 ("N.º 01") before the name. Hover: curtain-3 over 250ms. Focus-visible: ring. Active: curtain-3 and scale 0.99. Disabled: 45% opacity. Opening presents a list with radio semantics (sheet on phone, popover on desktop).

### Segmented control (Mode, desktop)
Container curtain-2, radius 12, padding 4, 4px gap. Buttons `flex:1`, radius 9, 0.85rem 700, transparent with chalk-2 text. `aria-pressed="true"`: chalk fill, curtain text. Hover on unpressed: curtain-3. Focus-visible: ring. Active: scale 0.98. Disabled: 45% opacity.

### Toggle (Mascara 3D)
`role="switch"` with `aria-checked`. A 52px-high card (curtain-2, radius 14, padding 10px 14px) with a 38x22 track (pill, curtain-3), a 16px chalk knob inset 3px, and a text label (0.85rem 700). On: track `--g4`, knob curtain, translateX(16px), 300ms `--ease`. Hover: card curtain-3. Focus-visible: ring around the whole card. Active: scale 0.99. Disabled: 45% opacity.

### Tempo slider
Label "Tempo (BPM, de 60 a 160)", extended 2rem tabular-nums output at left (`min-width: 3ch`), native `input[type=range]`: 8px track radius 4, filled part chalk, remainder curtain-3, thumb 24px chalk with 4px curtain border. Hover: thumb scale 1.1. Focus-visible: ring on the thumb. Active: thumb scale 0.95. Disabled: 45% opacity. Keyboard step 1 BPM; PageUp/PageDown 10.

### Meters (Volumen, Brillo)
Plate radius 10 over video: label 0.75rem 700 chalk, 46x6 bar (chalk fill on chalk 25% track). Plate is `--plate-soft` (78% curtain) with 8px blur. Expose the value as `role="meter"` with `aria-valuenow` or as text.

### Mirror badge ("Espejo")
Pill, `--plate` (82% curtain), 0.75rem 700, padding 8px 12px. Informational, not interactive.

### Home and Guide
- Home fan: 7 vertical strips rotated (i-3) x 6deg, faded to curtain from 30% to 88% height. Decorative, `aria-hidden`.
- Guide row: grid `44px 1fr auto`, gel fill, curtain ink, radius 12, padding 8px 14px 8px 10px; 38px hand icon, "C · Do mayor" with the sign description beneath (0.85rem), degree numeral on the right (extended 900, 1.3rem). 5px between rows.

## Motion

One gesture: **the change of light.** When the chord changes, `--gel` changes on the instrument root and everything that reads it transitions at once:
- Video wash `background`: **700ms**, `cubic-bezier(0.16, 1, 0.3, 1)` (`--dur-light`, `--ease`).
- Degree badge `background`: 700ms, same curve.
- Symbol and name text swap instantly; colour carries the transition.
- Fan swatch height and cue-row backgrounds: 500ms `--ease`.
- Toggle knob/track and CTA lift: 300ms `--ease`. Hover backgrounds: 250ms `--ease`.

The change starts on the beat that triggers the chord and never blocks input or sound.

**prefers-reduced-motion: reduce**: all transitions and animations are 0ms (the tokens set every `--dur-*` to 0ms; also apply `*{transition:none!important;animation:none!important}`). Colour and state changes still happen, instantly. Functional timing (Auto-mode advance, audio) is unaffected. Motion never carries a change alone: the numeral and name always update.

## Accessibility

- **Contrast: text at least 4.5:1** (large text 3:1; UI boundaries 3:1). Verified: chalk on curtain 15.97, chalk-2 on curtain 10.16, curtain on every gel 5.70 to 12.60.
- **Text over video needs a scrim or backplate. This fixes the mockup's low-contrast advisory** (chalk `#F6EEE9` over the video's grey `#7A7577` measured 3.95:1, and a bright camera image is worse):
  1. The chord display (symbol, badge, name) sits on a bottom scrim: gradient from transparent to `--scrim-bottom` (92% curtain) over the lower 55% of the video, and at least 78% curtain-opaque behind the name line. Worst case (white video): chalk 7.1:1 at 75%, 8.6:1 at 80%.
  2. The app bar over the phone video uses a top scrim from `--scrim-top` (78%, raised from the mockup's 75%) to transparent, covering the bar plus 24px.
  3. Every small label over video (meters, Espejo, toasts) has its own plate of at least 78% curtain (`--plate-soft`, `--plate`). The mockup's 62% meter plate gave 4.48:1 on white and is retired.
  4. Nav pills are translucent glass: keep the top scrim behind them, text chalk 0.85rem 700.
  5. Never chalk-2 over video (2.9 to 5.9:1). Chalk only.
  6. Keep wash opacity between 0.6 and 0.78 so the camera image stays legible.
- **Visible focus.** `:focus-visible { outline: var(--focus-width) solid var(--focus); outline-offset: var(--focus-offset); border-radius: 8px }`. The chalk ring is 15.97:1 on curtain. For controls sitting on a gel (swatches, active rows) use a double ring, `box-shadow: 0 0 0 3px var(--curtain), 0 0 0 6px var(--chalk)`, so it keeps 3:1 against both neighbours. Never remove outlines.
- **Text labels.** Icons never stand alone (Guia, Creditos, Cerrar, Empezar carry text). Colour never stands alone (numeral and chord name with every gel). Hand-sign icons are decorative; the Guide describes each sign in words ("Pulgar arriba").
- **Semantics.** Toggle: `role="switch"` + `aria-checked`. Mode buttons: `aria-pressed`. Fan: `<ol>` with `aria-current="step"`. Video: `role="img"` with a text alternative naming the current wash colour. Chord display: `aria-live="polite"`.
- **Targets.** At least 44x44px; pickers and switch 52px high.
- **Language.** `lang="es"`, plain words.

## Do's and Don'ts

**Do**
- Use curtain ground and chalk text everywhere; let the gels be the only colour.
- Pair every gel with its numeral and name.
- Put curtain ink on gels and a scrim behind every text over video.
- Keep one motion gesture, timed to the music, and honour reduced motion.
- Keep the fan visible in every mode so players learn the signs.

**Don't**
- Don't use a gel for a button, link, or decoration.
- Don't put chalk on a gel, or chalk-2 on video.
- Don't dim swatches with opacity; change height instead.
- Don't add shadows, text gradients, glow, or extra fonts.
- Don't ship device frames, window chrome, or the spec header from the mockup; they are presentation.
- Don't animate layout properties other than swatch height, and never delay a chord sounding for an animation.
