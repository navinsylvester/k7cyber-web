K7 Design Language is a case file. Material is paper and Glass is glass; a K7 page is a sheet in a file: tabbed, numbered, dated, stamped and redacted, and it survives a photocopy. Version 2.2 names what 2.1 (as published for the research pages and extended for the enterprise website) already was. Quiet by design: type carries the message, one signal colour marks what matters, and one diagonal, the stroke of the 7, organises everything that is not a rectangle.

Two marks make a K7 page recognisable with the logo covered. The pixel, one square of signal, sits in every icon, on the current tab and menu item, in every stamp and beside the wordmark: the smallest unit of the language and its crown jewel. The tab, a rectangle whose right edge descends to the left at the 7's angle, is the one shape: sheets raise it, buttons are it, every filed container carries its evidence on it. The quirks (Signatures) are the language; they are kept, not tidied away.

Start with the four grounds and one signal, set everything said in Archivo and everything counted in IBM Plex Mono, file everything that has a ground under a tab cut on the 7, let parallel content be a list rather than a card grid, and before anything ships ask whether it would survive a photocopy.

## Content fundamentals

- Write in British English, as the content doc does: organisation, behaviour, defence, centre.
- Speak plainly and as K7: "we", "our"; the reader is "you" or "your organisation". No exclamation marks except the one in "Let's Talk!" the content already carries.
- Headlines are statements, not labels: "Pages are case files. Not scrolls." Split a headline in two where the second clause can sit at `dim` opacity.
- Labels are evidence, set in `label`: a counter (`03/07`), a section name (`THE RECORD`), a date (`29-09-2026`). Never a decorative eyebrow with no information.
- Dates in tables are DD-MM-YYYY; bylines read "25 Sep 2026". Phone numbers and IDs are set in `meta`.
- No emoji anywhere. A tick is the signal pixel for a single state (a head, a tab, a live stamp) or the glyph ✔ in `ink` wherever ticks repeat, as in a ledger; a cross is ✖ in `acc-ink`.
- Product names are exact: K7 Seventh Sense, K7 Seventh Sense MDR, K7 Data Loss Protection, K7 SD-WAN. "Seventh Sense" alone only after the full name has appeared on the page.

## Grounds and the signal

- Four grounds only: `paper`, `panel`, `contrast`, `signal`. Every section of a page is a sheet on one ground (`.g-paper`, `.g-panel`, `.g-contrast`, `.g-signal`), and never the same ground twice in a row.
- Themes swap `paper` and `ink`; `signal` never moves. Dark is the default theme. The `contrast` sheet is always dark: full ink in the light theme, graphite in dark so it never glares.
- Secondary text is `muted` (ink at 66%), rules are `line` (ink at 16%), hover tints are `tint` (6%). On `contrast` use `contrast-muted`, `contrast-line`, `contrast-tint`; on `signal` the `signal-` set. Never introduce a new grey.
- Signal is scarce. One `.g-signal` sheet per page at most, and otherwise only: the primary button, the signal pixel, a redacted word, Critical, a fresh stamp, the focus ring. As text on `paper` and `panel`, signal is `acc-ink`, never `signal` itself.
- Hover is always an inversion: `ink` becomes ground, ground becomes `ink`, eased on cubic-bezier(.7, 0, .2, 1) over 240ms. No shadows, no gradients, no radius.
- Focus is a 2px `signal` outline offset 2px on every ground; inside a `.g-signal` sheet it is `on-signal`.

## The pixel

- One square of `signal`: `pixel` (6px) on tabs, in stamps, in menus and beside the wordmark; 3px on the 32px icon grid. Always a square, never a dot with a radius, never two in one element. It is the one thing on the page that is both small and in colour, which is why it reads as K7 from across the room.
- It marks one state: the current sheet tab, the current research tab and menu item, a fresh stamp, a live feed, a critical or waiting state, the one K7 column in a matrix. Where ticks repeat, as in a ledger, use the glyph ✔ in `ink`, not a pixel per cell.
- It blinks in steps (`steps(1)`), never fades, and only when data is live (`is-live`). A thing that arrives, a dialog or a toast, is stamped: no entry transition, and the pixel on its tab blinks twice (`is-stamp`).
- Every icon carries exactly one, placed where it means something: the record light, the dot of the i, the flash (Icon).

## Type

- Archivo for everything said, IBM Plex Mono for everything counted: indices, timestamps, tags, specs. Both load from Google Fonts with Archivo's width and weight axes: `family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=IBM+Plex+Mono:wght@400;500`.
- The width axis is the one expressive lever: width 62 for numbers and ledgers (`num`), 100 for everything else, 112 for the type-set wordmark, 125 on hover only.
- Said things ease, counted things step. Words, rows, panels and the theme invert on the 240ms curve; anything counted (a figure that changes, a meter, a clock, the days-ago, the pixel) moves in steps, never eased, and a figure that does not change does not move (StatRow).
- Display sizes are fluid, set in container units so they scale with the sheet and nothing is tuned per device; the token lists each style's maximum and its clamp. Hero and page headlines are flush left; never centre a headline.
- Running copy stays near 65 characters; a lede stops at `measure-lede`, the prose column at `measure-prose`.
- Uppercase is for `label`, `tag` and `caption` only, always letter-spaced 0.08em.

## Signatures

The quirks are the language: eight devices make a K7 page recognisable with the logo covered. S1 to S6 are the originals; S7 and S8 joined in 2.2. The pixel (S5) and the tab (S2) appear wherever their rules say; of the page-level devices (S3, S4, S6) use one per view.

- S1 Tab walk: every sheet raises a tab (`.sheet-tab`, `tab-w` × `tab-h`, its right edge on the 7) into the sheet above, stepping right to left down the page so the tabs draw the 7's diagonal. A data page raises a tab only to state freshness or scope.
- S2 The Seven: one angle, `seven`, 24.5° from vertical, the long stroke of the 7 in the mark, descending to the left. It is the right edge of every tab, running the tab's full height: sheet tabs, research and workspace tabs, filed tabs, primary and ink buttons, the wordmark square (`--tab7`; the run is the height × `seven-run`). Nothing else is cut; everything else is a rectangle, and below 36px nothing is cut at all. The hatch (PT2) and the stair (S4) run at the same angle. Until 2.2 the cut was a 45° top-right chamfer, which was the 7's mirror; the 2.1 artifact still shows it.
- S3 Redaction: a `signal` bar hides one word of the home page's opening statement, the headline of the sheet after the hero ("Beyond the ████."); hover or tap declassifies it. Home page only; the hero headline is the product name and is never redacted.
- S4 The stair: three lines indented .82em, .41em, 0, so the line starts sit on the 7's line (.9em of line height × tan 24.5°). The diagonal in type. On any headline but the top one: the hero sets the product name flush left, and since 2026-10-16 no home-page headline is stepped either. Also the stepping of chain figures and stacked content.
- S5 The pixel: one `pixel` square per icon, tab, menu item and wordmark (The pixel, above). It blinks in steps, never fades, and only when data is live.
- S6 Log strip: a one-line `mono` marquee at the foot of the home hero, set like a terminal, linear, on a 70s loop. Home page only.
- S7 Filed: every container with its own ground is a sheet, and a sheet has a tab (`filed` + `ftab`, Tab). The feature panel's label, the ledger's results line (its heads become a band on the next ground), the report cover's series label, the code block's language and length, the lead dialog's title all move onto the tab. The tab carries evidence, never a heading. Frames stay square and ungrounded: figures, tags, cells, rows.
- S8 The record rail: on Labs articles and CVE records every paragraph with text is numbered in the margin (`§ 01`) and the number is its anchor (`record`, `para`, `para-n`); the target paragraph takes a 2px `signal` rule. Labs pages only; the marketing templates keep their prose unnumbered.

## The test

Would it survive a photocopy? Ink, halftone greys (`muted`, `line`, `tint`), one stamp, a slanted tab, a level read by length, a state read by word and weight: all survive. A shadow, a blur, a gradient, a second hue, a level read by colour, a thing that is only visible while it moves: none do. The light theme is the positive print of the dark negative; hover is a region inverted; the redaction is a bar. If a decision needs any of the second list to be understood, it is not K7.

## The words

The parts have the file's names, in the READMEs, the code comments and the CMS labels; say these and not the generic ones.

| Word | What it is | In code |
| --- | --- | --- |
| Sheet | A ground. A page is sheets stacked with nothing between them. | `.sheet`, `g-*`, `Sheet` |
| Tab | The one shape, on the 7. Raised from a sheet, or pressed on it as a button. | `.sheet-tab`, `.rtab`, `.btn-primary`, `.ftab` |
| The Seven | The one angle: 24.5° from vertical, descending left. Tabs, hatch, stair. | `seven`, `seven-run`, `--tab7` |
| The pixel | The one dot. Current, fresh, live, critical, waiting; one per icon. | `.pixel`, `is-live`, `is-stamp` |
| Stamp | The pixel's states on a record: fresh within 7 days, live within a day, stamped on arrival. | `fresh`, `tag-signal`, `is-stamp` |
| Ledger | Counted rows on hairlines under a tab that says what and how many. | `.ledger`, `.dtable`, DataTable |
| Index | A numbered list that inverts. Never a card grid. | `.irow`, IndexRow |
| Count | A figure at width 62. It steps when it changes and stands still when it does not. | `.num`, StatRow |
| Redaction | The signal bar over one word. Hover declassifies. | `.redact` |
| Log | Time in mono, newest first. | `.logstrip`, the timelines |
| Record | Prose with the rail: numbered paragraphs that can be cited. | `.record`, Prose `rail` |
| Negative · Positive | The two states of the same file. Dark is the negative and the default. | `data-theme` |
| The photocopy | The test every decision passes before it ships. | this file |

## Patterns and figures

- Three patterns, as texture never decoration, each once per sheet at most, between `pattern-min` and `pattern-max` ink, fading away from text through a linear mask. PT1 Registration: 32px tile, 8px plus mark, 1px stroke, `pattern-mid` ink, mask at 100°; the hero sheet. PT2 Seven hatch: 20px tile, one stroke at the angle of the 7 (`M14.56 0 L5.44 20`, 24.5° from vertical), `pattern-min` ink, mask at 260°; the contrast sheet. PT3 Dot field: 24px tile, 2px square, `pattern-max` ink, no mask; only inside figure frames.
- Figures carry a `caption` in mono and live in a 1px `line` frame. A placeholder figure (`.ph`) is the dot field in a frame with its caption bottom-left; use it wherever the content doc says <Image>, <Icon> or <Animation> until the asset exists.
- Photography and illustration are evidence, not decoration, and never bring a second palette. Inside a figure frame (`.ph`) and in portraits (`.avatar`), every photograph and illustration renders greyscale: the blog's featured images, the leadership portraits, the office maps. A drawn cover (`ReportCover`, `.is-cover`) keeps its colour. Figures inside an article (`.prose figure.fig`), screenshots, charts and diagrams, keep their colour too: there the colour is information.
- Home-page devices (the redacted word, the stack figure, the puzzle glyph, log strip, year rings, the interception matrix, the seven hatch) stay on the home page. Research and product pages carry none of them.

## Components

- Few parts, sharp ones. Parallel content is a list, not a card grid: use IndexRow and CapabilityRow where a card grid would be the reflex. The content doc's Highlights and Benefits grids become capability rows in two columns; its industry grid becomes an index.
- Buttons: `Button` primary is `signal` in the tab shape (S2), one per view; secondary is a 1px `ink` line; text links underline and the underline thickens on hover. Every button label ends in → when it leads somewhere.
- Tags (`Tag`): 1px border in currentColor, `tag` type. Solid for the active state, `signal` only for a live or critical state, dashed for an optional add-on.
- Forms (`Field`): label in `label` `muted`, the control is an underline in `ink` 2px that turns `signal` on focus, 19px input text. Checkboxes are 18px squares that fill `signal` when checked. Errors are `acc-ink` text under the field, and the underline turns `acc-ink`.
- Tables (`DataTable`): filed (S7) where they have a results line: the line is the ledger's tab, the `label` heads in `muted` sit on a band of the next ground with a full `ink` rule under it, `line` rules between rows, rows tint on hover and never shift. The feature matrix and the competitor comparison are data tables with a plain `ink` rule on top, not cards.
- Filed containers (`Tab`): a feature panel, a report cover, a code block, a form sheet and a dialog each raise a tab with the evidence they already carry. Frames, tags, cells and rows are rectangles.
- Sheets: the closing call to action of every page is one `.g-signal` sheet (`CtaSheet`) with the headline, one paragraph and the primary and secondary actions.

## Icons

- Flat lines on a 32px grid, 2px stroke, square caps, mitred joins, no curve where a corner will do. Every icon carries exactly one 3px `signal` pixel. The eight lab icons in `Icon` are the reference set; draw new ones to the same rules.
- In React, start from Lucide only with `strokeLinecap="square"` and `strokeLinejoin="miter"`, and add the pixel in the wrapper; replace Lucide's rounded glyphs with K7's own as they are drawn.

## Layout and motion

- One file, every width: layout reflows with flex, grid and container queries. Nav links, labels and secondary actions collapse to zero width below their threshold with `max-width: max(0px, calc((100cqw - 1180px) * 999))`; the Menu button uses the inverse. No media queries except prefers-reduced-motion.
- Gutter is `pad` everywhere; sheets pad `sheet-top` and `sheet-bottom`; the header is `header-h` and sticky.
- Motion: said things ease, counted things step (Type). The inversion on hover eases; a live pixel blinks in steps; a meter, a clock or a figure that changes moves in steps; the log strip runs linear. A thing that arrives is stamped: no fade, slide or scale, and the pixel on its tab blinks twice. Nothing fades in on scroll. Honour prefers-reduced-motion by removing every transition.

## Logos

- Use the supplied files in `assets/Logos`, never a redrawn mark. The full logo on `paper` in light; the white variant on `paper` in dark and on `contrast`; the square and icon variants where height is under 40px. The orange inside them is `logo-orange` (#EC6A23), which is not `signal`: do not recolour the mark, and do not use `logo-orange` elsewhere.
- Where the type-set wordmark is used instead, it is a 22px `signal` square in the tab shape (`wordmark-mark`) beside "K7" in `wordmark`, with CYBERSECURITY in `label` at `quiet` opacity.

## Building in React

- Parts are plain React on the classes in `components/bundle.css`: `Sheet`, `SheetHead`, `Actions` and `Icon` in `src/components/k7/`, one block per sheet in `src/blocks/k7/` (`RenderBlocks` numbers the sheets, places the tabs and alternates the grounds), the research parts in `src/components/research/`, the support parts in `src/components/support/`. The header and footer are `src/Header` and `src/Footer`, fed by their globals.
- Keep the grounds as classes (`g-paper`, `g-panel`, `g-contrast`, `g-signal`) that set `--bg`, `--fg`, `--acc`, `--line`, `--muted`, `--tint`; components read those, so one component works on every ground.
- No component library. The shadcn parts the scaffold came with were removed on 2026-10-15: nothing on the site rendered them, and they carried radius, shadows and rings. `src/app/(frontend)/globals.css` keeps the token-to-variable mapping (`--background: paper`, `--foreground: ink`, `--primary: signal`, `--border: line`, `--ring: signal`, `--radius: 0` and the rest) so Tailwind utilities read the language. If a primitive is ever added, it is restyled to the language before it ships (radius 0, no shadow, hover as inversion, square caps) and gets a README in `components/` like every other part.
- The theme attribute is rendered on `<html>` by the server (dark) and only overridden by the reader's stored choice before first paint, so nothing is hidden while scripts load.

## Where each part lives

| Parts | Rules | Reference CSS | React |
| --- | --- | --- | --- |
| Grounds, type, the pixel, sheets and tabs, the tab and filed containers (`Tab`), header, footer, buttons, tags, placeholders, rows, tables, forms, quotes, chips, prose, CTA sheet, icons | `components/<Name>/README.md` | `components/bundle.css` | `src/components/k7`, `src/blocks/k7`, `src/Header`, `src/Footer` |
| 08 · Labs, with the record rail | `components/LabsParts/README.md` | `src/app/(frontend)/research.css` | `src/components/research`, `src/app/(frontend)/research` |
| 09 · Support | `components/SupportParts/README.md` | `src/app/(portal)/portal.css` | `src/components/support`, `src/app/(portal)/support` |
| Tokens | this file | `tokens.json`, generated to `tokens.css` | imported by the frontend and portal stylesheets |
| Page designs | `designs/README.md` | the artboards in `designs/`, on the same two files | the templates in `docs/page-shapes.md` |

## Keeping it current

The design system describes the site as built, so a change to how anything looks is a change to the design system, made in the same commit:

1. **Rules**: the part's `components/<Name>/README.md` (for sections 08 and 09, `LabsParts` and `SupportParts`), and this file when a language-level rule moves.
2. **Reference CSS**: `components/bundle.css`, or `research.css` and `portal.css` for the Labs and Support parts.
3. **Reference markup**: the part's `preview.html` when its markup changes.
4. **Designs**: the artboards in `designs/` that show the part, and `designs/k7chrome.py` for the shared chrome.
5. **Record**: a line in `CHANGELOG.md` and the `lastChange` note in `design-system.json`.

A new part gets its folder, README and preview before its first use. Nothing is temporary: if it ships, it is in the system.
