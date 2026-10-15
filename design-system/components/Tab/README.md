# Tab
The one shape of the language (S2): a rectangle whose right edge runs its full height at the 7's angle, 24.5° from vertical, descending to the left. `--tab7` is the clip path; `--h` is the element's height and the run is `--h × seven-run`. Sheets raise it (SheetTab), the research bar and the workspace bar step through it (`rtab`), the primary and ink buttons are it (Button), the type-set wordmark's square is it at 22px (`wordmark-mark`), and every filed container carries its evidence on it (S7).

**Use** `filed` on any container that has its own ground and is not a whole sheet: a feature panel, a ledger, a report cover, a code block, a form sheet, a dialog. Inside it, `ftab` in `label` type holds the evidence the container already carries: the batch and the count, the label, the series, the language and the length, the report's title. `ftab.is-right` sits at the right edge; `ledger-hint` is a muted note in the tab's row that is not a tab. The tab takes the container's ground through `--t-bg` and `--t-fg`, so it inverts with the panel on hover.

**Provide** the text, at most two facts separated by `·`, and the pixel only when the tab states a single live or current state (`is-stamp` when the thing arrives).

**Don't** cut anything else: frames, tags, cells, rows and figures are rectangles, and below 36px nothing is cut. Never put a heading in a tab, never two tabs on one container (the ledger's second line is a hint, not a tab), never the 45° chamfer: it was the 7's mirror and left in 2.2.

**Build** `.sheet-tab`, `.rtab`, `.btn-primary`, `.btn-ink`, `.wordmark-mark`, `.filed`, `.ftab`, `.ledger`, `.code` in `bundle.css`; `Sheet` (`src/components/k7/Sheet.tsx`) raises the sheet tab, `FeaturePanels`, `PostFeature`, the threat-reports lead, `Cover`, `Code` and `Lead` carry filed tabs, the Labs and support ledgers wrap their tables in `ledger filed`.
