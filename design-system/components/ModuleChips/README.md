# ModuleChips
"Modular by design": a hairline-gridded set of toggle tiles, each with an icon, a ✓ or + state, the module name and one line.

**Use** on the home page and the Platform page for the core solutions (MDR, XDR, EDR, EPS) and add-ons (DLP, IAM, Patch Management, Advanced Endpoint Management, Agentic SOC, Log Retention, File Security Monitoring). A tile that is on is inverted; pressing a + tile turns it on. Where the doc asks for an expansion, the pressed tile opens an Accordion or FeaturePanel below the grid with the module's full description.

**Provide** {icon, name, line, on, href}. Keep the order the content doc uses.

**Don't** colour tiles by category, round them, or make them all on by default; "switch on capabilities as required" is the point.

**shadcn** Toggle / ToggleGroup, with Collapsible for the expansion. Payload: `moduleGrid` block.
