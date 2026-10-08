# CapabilityRow
A row with a 48px icon, a title and one sentence, in a two-column ledger under a full `ink` rule. This is what the content doc's Highlights and Benefits grids become.

**Use** for every icon + title + text set: product highlights, benefits, "The Threat Stops Here" for an industry, service deliverables. Two columns from 900px, one below; odd rows carry the right-hand hairline.

**Provide** an ordered list of {icon, title, text}. Icons follow the 07 rules (Icon). Benefits in the doc are often a phrase with one bold term ("Adherence to **regulatory requirements**"): keep the bold.

**Don't** turn these into cards, add a Learn More to each, or exceed four words plus one sentence. If a row needs a link, the title is the link.

**shadcn** No primitive; a plain list component. In Payload it is the `featureGrid` block.
