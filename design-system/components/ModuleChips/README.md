# ModuleChips
"Modular by design": a hairline-gridded set of toggle tiles, each with an icon, a ✓ or + state, the module name and one line.

**Use** on the home page and the Platform page for the core solutions (MDR, XDR, EDR, EPS) and add-ons (DLP, IAM, Patch Management, Advanced Endpoint Management, Agentic SOC, Log Retention, File Security Monitoring). A tile that is on is inverted; pressing a + tile turns it on. Where the doc asks for an expansion, the pressed tile opens an Accordion or FeaturePanel below the grid with the module's full description.

**Provide** {icon, name, line, on, href}, in groups where the page separates core from add-ons (Core · 04, Add-ons · 07). Keep the order the content doc uses.

**The tally** (home page only): a bar under the grid with a count, `08 modules active`, a figure at width 62 that steps as add-ons are pressed and stands still otherwise; beside it the note `1 agent · 1 console`, the add-ons picked (`Core + DLP, IAM`), and at the right one text link, "Request demo with 2 add-ons →", whose URL carries the modules that are on (`?modules=EPP,EDR,XDR,MDR,DLP,IAM`). The state is shared across the groups, so the count spans core and add-ons. Each tile draws its own hairline, so a short last row leaves the ground bare.

**Don't** colour tiles by category, round them, or make them all on by default; "switch on capabilities as required" is the point.

**Build** the `ModuleGrid` block (`moduleGrid`) on the `module` tiles, with the core and add-on states as the tick and plus marks; `legend` adds the legend cell (`module-legend`), `tally` the bar with the count and the demo request (`module-tally`).
