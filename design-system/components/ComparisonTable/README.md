# ComparisonTable
The competitor comparison (K7 vs CrowdStrike): four columns, criteria grouped under section rows, every point a ✔ or ✖ bullet.

**Use** on Why K7 → Competitor Comparison pages. The K7 column carries `is-k7` and the signal pixel in its head. Section rows (`batch`) carry the theme and its one-line description; criteria are numbered because the content numbers them. Items the doc marks red become `li.no` (✖ in `acc-ink`); all others are ✔ in `ink`.

**Provide** the competitor name, the sections, and per criterion the three cell lists with each item flagged yes/no. Repeat the Explore platform and Request demo actions after the table.

**Don't** shade the K7 column, use green/red fills, or truncate bullets. On narrow screens the table scrolls inside `table-wrap`; a stacked Accordion per criterion is the mobile alternative.

**Build** the `ComparisonTable` block (`comparisonTable`) on `dtable`, with a `competitor` field; a line that starts with ✖ or x becomes a gap.
