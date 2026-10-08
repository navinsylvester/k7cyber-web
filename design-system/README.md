K7 Design Language is the visual system for K7 CyberSecurity's web presence: version 2.1 as published for the research pages, extended here with the parts the enterprise website's content needs. Quiet by design. Type carries the message, one signal colour marks what matters, and one diagonal, taken from the stroke of the 7, organises everything: corners, tabs, headlines, who is speaking.

Start with the four grounds and one signal, set everything said in Archivo and everything counted in IBM Plex Mono, cut the top-right corner of what matters, and let parallel content be a list rather than a card grid.

## Content fundamentals

- Write in British English, as the content doc does: organisation, behaviour, defence, centre.
- Speak plainly and as K7: "we", "our"; the reader is "you" or "your organisation". No exclamation marks except the one in "Let's Talk!" the content already carries.
- Headlines are statements, not labels: "Pages are case files. Not scrolls." Split a headline in two where the second clause can sit at `dim` opacity.
- Labels are evidence, set in `label`: a counter (`03/07`), a section name (`THE RECORD`), a date (`29-09-2026`). Never a decorative eyebrow with no information.
- Dates in tables are DD-MM-YYYY; bylines read "25 Sep 2026". Phone numbers and IDs are set in `meta`.
- No emoji anywhere. A tick is the signal pixel or the glyph ✔ in `ink`; a cross is ✖ in `acc-ink`.
- Product names are exact: K7 Seventh Sense, K7 Seventh Sense MDR, K7 Data Loss Protection, K7 SD-WAN. "Seventh Sense" alone only after the full name has appeared on the page.

## Grounds and the signal

- Four grounds only: `paper`, `panel`, `contrast`, `signal`. Every section of a page is a sheet on one ground (`.g-paper`, `.g-panel`, `.g-contrast`, `.g-signal`), and never the same ground twice in a row.
- Themes swap `paper` and `ink`; `signal` never moves. Dark is the default theme. The `contrast` sheet is always dark: full ink in the light theme, graphite in dark so it never glares.
- Secondary text is `muted` (ink at 66%), rules are `line` (ink at 16%), hover tints are `tint` (6%). On `contrast` use `contrast-muted`, `contrast-line`, `contrast-tint`; on `signal` the `signal-` set. Never introduce a new grey.
- Signal is scarce. One `.g-signal` sheet per page at most, and otherwise only: the primary button, the signal pixel, a redacted word, Critical, a fresh stamp, the focus ring. As text on `paper` and `panel`, signal is `acc-ink`, never `signal` itself.
- Hover is always an inversion: `ink` becomes ground, ground becomes `ink`, eased on cubic-bezier(.7, 0, .2, 1) over 240ms. No shadows, no gradients, no radius.
- Focus is a 2px `signal` outline offset 2px on every ground; inside a `.g-signal` sheet it is `on-signal`.

## Type

- Archivo for everything said, IBM Plex Mono for everything counted: indices, timestamps, tags, specs. Both load from Google Fonts with Archivo's width and weight axes: `family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=IBM+Plex+Mono:wght@400;500`.
- The width axis is the one expressive lever: width 62 for numbers and ledgers (`num`), 100 for everything else, 112 for the type-set wordmark, 125 on hover only.
- Display sizes are fluid, set in container units so they scale with the sheet and nothing is tuned per device; the token lists each style's maximum and its clamp. Hero and page headlines are flush left; never centre a headline.
- Running copy stays near 65 characters; a lede stops at `measure-lede`, the prose column at `measure-prose`.
- Uppercase is for `label`, `tag` and `caption` only, always letter-spaced 0.08em.

## Signatures

Six quirks make a K7 page recognisable with the logo covered. Use one per view.

- S1 Tab walk: every sheet raises a tab (`.sheet-tab`, `tab-w` × `tab-h`, cut `cut-tab`) into the sheet above, stepping right to left down the page so the tabs draw the 7's diagonal. A data page raises a tab only to state freshness or scope.
- S2 The cut: top-right only. `cut-tab` on tabs, `cut-btn` on primary buttons, `cut-feature` on featured panels. Everything else is square.
- S3 Redaction: a `signal` bar hides one word of the home hero headline; hover or tap declassifies it. Hero headlines only.
- S4 The stair: three lines indented 2em, 1em, 0. The diagonal in type. Also the stepping of chain figures and stacked content.
- S5 Signal pixel: one `pixel` square per icon, tab and wordmark. It blinks in steps, never fades, and only when data is live.
- S6 Log strip: a one-line `mono` marquee at the foot of the home hero, set like a terminal, linear, on a 70s loop. Home page only.

## Patterns and figures

- Three patterns, as texture never decoration, each once per sheet at most, between `pattern-min` and `pattern-max` ink, fading away from text through a linear mask. PT1 Registration: 32px tile, 8px plus mark, 1px stroke, `pattern-mid` ink, mask at 100°; the hero sheet. PT2 Seven hatch: 20px tile, one stroke at the angle of the 7, `pattern-min` ink, mask at 260°; the contrast sheet. PT3 Dot field: 24px tile, 2px square, `pattern-max` ink, no mask; only inside figure frames.
- Figures carry a `caption` in mono and live in a 1px `line` frame. A placeholder figure (`.ph`) is the dot field in a frame with its caption bottom-left; use it wherever the content doc says <Image>, <Icon> or <Animation> until the asset exists.
- Home-page devices (redaction, log strip, year rings, the interception matrix, the seven hatch) stay on the home page. Research and product pages carry none of them.

## Components

- Few parts, sharp ones. Parallel content is a list, not a card grid: use IndexRow and CapabilityRow where a card grid would be the reflex. The content doc's Highlights and Benefits grids become capability rows in two columns; its industry grid becomes an index.
- Buttons: `Button` primary is `signal` with `cut-btn`, one per view; secondary is a 1px `ink` line; text links underline and the underline thickens on hover. Every button label ends in → when it leads somewhere.
- Tags (`Tag`): 1px border in currentColor, `tag` type. Solid for the active state, `signal` only for a live or critical state, dashed for an optional add-on.
- Forms (`Field`): label in `label` `muted`, the control is an underline in `ink` 2px that turns `signal` on focus, 19px input text. Checkboxes are 18px squares that fill `signal` when checked. Errors are `acc-ink` text under the field, and the underline turns `acc-ink`.
- Tables (`DataTable`): a full `ink` rule on top, `line` rules between rows, `label` heads in `muted`, rows tint on hover and never shift. The feature matrix and the competitor comparison are data tables, not cards.
- Sheets: the closing call to action of every page is one `.g-signal` sheet (`CtaSheet`) with the headline, one paragraph and the primary and secondary actions.

## Icons

- Flat lines on a 32px grid, 2px stroke, square caps, mitred joins, no curve where a corner will do. Every icon carries exactly one 3px `signal` pixel. The eight lab icons in `Icon` are the reference set; draw new ones to the same rules.
- In React, start from Lucide only with `strokeLinecap="square"` and `strokeLinejoin="miter"`, and add the pixel in the wrapper; replace Lucide's rounded glyphs with K7's own as they are drawn.

## Layout and motion

- One file, every width: layout reflows with flex, grid and container queries. Nav links, labels and secondary actions collapse to zero width below their threshold with `max-width: max(0px, calc((100cqw - 1180px) * 999))`; the Menu button uses the inverse. No media queries except prefers-reduced-motion.
- Gutter is `pad` everywhere; sheets pad `sheet-top` and `sheet-bottom`; the header is `header-h` and sticky.
- Motion is the inversion on hover, the stepped blink of a live pixel, and the log strip. Nothing fades in on scroll. Honour prefers-reduced-motion by removing every transition.

## Logos

- Use the supplied files in `assets/Logos`, never a redrawn mark. The full logo on `paper` in light; the white variant on `paper` in dark and on `contrast`; the square and icon variants where height is under 40px. The orange inside them is `logo-orange` (#EC6A23), which is not `signal`: do not recolour the mark, and do not use `logo-orange` elsewhere.
- Where the type-set wordmark is used instead (the research pages), it is a 22px `signal` square cut top-right beside "K7" in `wordmark`, with CYBERSECURITY in `label` at `quiet` opacity.

## Consuming in React, Tailwind and shadcn/ui

- Map the tokens onto shadcn's CSS variables, dark first: `--background: paper`, `--foreground: ink`, `--card: panel`, `--card-foreground: ink`, `--popover: panel`, `--primary: signal`, `--primary-foreground: on-signal`, `--secondary: panel`, `--muted: panel`, `--muted-foreground: muted`, `--accent: signal`, `--accent-foreground: on-signal`, `--destructive: acc-ink`, `--border: line`, `--input: ink`, `--ring: signal`, `--radius: 0`. Keep `contrast`, `acc-ink`, `code`, the `-line`/`-muted`/`-tint` sets and the `cut` values as extra variables.
- Keep the grounds as classes (`g-paper`, `g-panel`, `g-contrast`, `g-signal`) that set `--bg`, `--fg`, `--acc`, `--line`, `--muted`, `--tint`; components read those, so one component works on every ground.
- Override shadcn defaults that the language forbids: radius 0, no shadows, hover as inversion, square icon caps. Button, Badge (Tag), Input, Checkbox, Table, NavigationMenu, Sheet, Collapsible, Dialog and Form are the shadcn primitives in use.
