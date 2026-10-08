# IndexRow
Parallel content is a list, not a card grid: a numbered row with a title, a description and an arrow, that inverts and indents on hover.

**Use** for the industry grid, "Built for your industry", related products, the services index, listing pages. Number rows only when the order means something (an index does); otherwise drop `.n`.

**Provide** {title, description, href} per row; the whole row is the link. Descriptions end with the compliance frameworks as plain text where the content lists them.

**Don't** add images or icons to rows except the 32px publication icon in PublicationRow. Never more than ~12 rows without a filter.

**shadcn** No primitive. Payload: `industryGrid` and `listing` blocks.
