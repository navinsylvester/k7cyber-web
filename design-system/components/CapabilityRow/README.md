# CapabilityRow
A row with a 48px icon, a title and one sentence, in a two-column ledger under a full `ink` rule. This is what the content doc's Highlights and Benefits grids become.

**Use** for every icon + title + text set: product highlights, benefits, "The Threat Stops Here" for an industry, service deliverables. Two columns from 900px, one below; odd rows carry the right-hand hairline.

**Provide** an ordered list of {icon, title, text}. Icons follow the 07 rules (Icon). Benefits in the doc are often a phrase with one bold term ("Adherence to **regulatory requirements**"): keep the bold.

**Numbered** (2026-10-16, the home page's four capabilities): where the rows are few and each carries a list, the ledger sets each row with its index large in the counting width (`num`) and the icon under it, the title at `h-title` and the sentence at lede size beside, and the list as a **scope**: a head saying what it is and how many (`Covers · 06`, `Frameworks · 06`) over tags a size up (13px), in ink, always shown. While the row is hovered its tags fill with signal and carry ink, the inversion on the 240ms curve; nothing is hidden, nothing else moves. Three columns from 1000px, the scope under the body from 760px, one column below. `numbered` on the block; `scopeLabel` per row.

**Don't** turn these into cards, add a Learn More to each, or exceed four words plus one sentence. If a row needs a link, the title is the link.

**Build** the `CapabilityRows` block (`capabilityRows`), a plain list on `cap-list`, or the numbered ledger on `cap-ledger` (`numbered`); the Labs landing uses the plain rows with tags, the home page the numbered ledger.
