# SheetTab
S1, the tab walk: each sheet raises a `tab-w` × `tab-h` tab in its own ground into the sheet above, cut `cut-tab`, carrying the counter and the section name in `label`.

**Use** on every sheet after the first. Set `--k` from 1 (right edge) down to 0 (left edge) in equal steps across the page so the tabs draw the 7's diagonal. The pixel on the left marks the current sheet in a scrolling page. On data pages a sheet raises a tab only to state freshness or scope (`is-state`, right-aligned).

**Provide** the counter (`02/05`), the section name, and `--k`. The section component computes `k = 1 - (index - 1) / (count - 1)`.

**Don't** put more than two labels in a tab, use a tab as a heading, or let two sheets in a row share a ground.
