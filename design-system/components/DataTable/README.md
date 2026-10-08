# DataTable
The ledger: a full `ink` rule on top, mono `label` heads, hairline rows that tint on hover and never shift, batch rules when grouped, and the pager.

**Use** for vulnerability and threat listings, log and spec tables, and as the base of FeatureMatrix and ComparisonTable. Identifiers use `lid` (the unique part reads first); severity uses the level meter; dates are DD-MM-YYYY in mono.

**Provide** columns, rows, optional group rules, the sort state (`aria-sort` on the head), and paging.

**Don't** zebra-stripe, round, or add row shadows. Columns never reflow; the wrapper scrolls.
