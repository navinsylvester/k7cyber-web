# IndexRow
Parallel content is a list, not a card grid: a numbered row with a title, a description and an arrow, that inverts and indents on hover.

**Use** for the industry grid, "Built for your industry", related products, the services index, listing pages. Number rows only when the order means something (an index does); otherwise drop `.n`.

**Provide** {title, description, href, icon?} per row; the whole row is the link. Descriptions end with the compliance frameworks as plain text where the content lists them.

**Glyphs** (2026-10-16): an index whose rows are kinds of thing, as the seven industries are, may carry one 32px icon per row, drawn on the icon rules and set before the arrow in a column of its own (`ilist-glyphs`) so the arrows stay in line. It is the row's symbol, not a picture: the bank, the mortarboard, the capitol, the cross, the factory, the terminal, the bag (Icon). A list of names (products, services) carries none.

**Don't** add images to rows, or icons beyond that one glyph before the arrow and the 32px publication icon in PublicationRow. Never more than ~12 rows without a filter.

**Build** the `IndexRows` block (`indexRows`) and `PublicationRows` (`publicationRows`) on `irow`; the Labs listings and the support case rows reuse the shape.
