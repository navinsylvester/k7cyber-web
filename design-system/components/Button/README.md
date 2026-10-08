# Button
The three actions of the language: primary is `signal` with the top-right cut, secondary is a 1px line, text is an underline that thickens on hover.

**Use** `btn btn-primary` for the one action a view is for (Request demo, Enquire, Submit); at most one per view. `btn btn-line` for the alternative beside it (Explore platform, View brochure, Download). `link-u` for an inline action inside copy or a row. `btn-ink` only on a `.g-signal` sheet or over imagery where the line button would vanish. `btn-sm` (36px) inside tables, forms and rows.

**Provide** the label and the href or handler. End the label with → when the action leads somewhere; leave it off for Submit and Download. Height is `btn-h`, the cut is `cut-btn`, type is `btn`.

**Don't** add icons other than the arrow, round the corners, add a shadow, or put two primary buttons in one sheet. Hover is the inversion (ink on ground), not a tint. Disabled is `disabled` opacity with pointer events off.

**shadcn** Button: variants `default` (primary), `outline` (line), `link`; set `rounded-none`, remove the shadow, apply the clip-path on `default`.
