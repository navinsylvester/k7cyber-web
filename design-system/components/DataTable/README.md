# DataTable
The ledger, filed (S7): the results line is its tab (`ledger filed` + `ftab`: what is shown, how many, how sorted), the mono `label` heads sit on a band of the next ground with a full `ink` rule under it, hairline rows tint on hover and never shift, batch rules when grouped, and the pager. A `ledger-hint` ("Select a column to sort") sits in the tab's row at the right.

**Use** for vulnerability and threat listings, log and spec tables, and as the base of FeatureMatrix and ComparisonTable. Identifiers use `lid` (the unique part reads first); severity uses the level meter; dates are DD-MM-YYYY in mono.

**Provide** the tab's line, columns, rows, optional group rules, the sort state (`aria-sort` on the head), and paging. FeatureMatrix and ComparisonTable are ledgers without a results line and keep the plain top rule.

**Don't** zebra-stripe, round, or add row shadows. Columns never reflow; the wrapper scrolls.
