# LabsParts
The research-page parts from section 08: L1 Identifier (the unique part reads first, prefixes at 55% ink, hashes in groups of four, every ID copyable), L2 Level meter (five cells for severity, two for prevalence; only the top level fills `signal`), L3 Freshness stamp (solid pixel within 7 days, outlined after, blinking in steps only within 24 hours).

**Use** on Research pages only: Vulnerability Information, Top Threats, Lab Blog IOC tables, the Labs status line. Chain stair (L5), Series cover (L6) and Lab icons (L7) are in ReportCover and Icon.

**Provide** the identifier string, the level and its scale, the ISO date for stamps (the script recomputes "n days ago").

**Don't** use the meter for anything but severity and prevalence, or colour levels by hue; they read by length.
