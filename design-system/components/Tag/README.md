# Tag
A mono, uppercase, 1px-bordered label for anything counted or classified: compliance frameworks, modules, platforms, severity.

**Use** the plain `tag` for compliance pills (DPDP, PCI DSS) and platform names. `tag-solid` with a ✓ for a module that is on; `tag-quiet` (dashed) with a + for an add-on that can be switched on. `tag-signal` only for a live or critical state, which carries its own pixel. Make it an `<a>` or `<button>` when it filters or toggles; then it inverts on hover.

**Provide** the text; optionally an href or an onClick. Type is `tag`; padding 4px 8px; the gap between tags is 6px.

**Don't** colour tags by category, round them, or use a tag as a heading. Never more than one `tag-signal` in a group.

**shadcn** Badge with `variant="outline"`, `rounded-none`, `font-mono uppercase tracking-[.08em] text-[11px]`.
