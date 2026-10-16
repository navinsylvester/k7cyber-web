# Switchboard
"Modular by design" as a board on one rail, not a grid of tiles. The core modules are cells above the rail, each with its icon, name, one line and the mark **On** as a block of ink, not a switch, because the core is always on. The add-ons are cells below the rail, the same but with an **Off | On** switch on the segmented control the header's theme toggle uses. Every cell is plugged into the rail by a hairline tick; a module that is on has a 2px tick and a 7px plug of ink on the rail. The rail is labelled at its ends with the note, `1 agent` and `1 console`: everything on the board runs on them. Under the board the sum line, `04 of 11 modules on` in the counting width, the add-ons picked, and one text link whose URL carries the modules that are on. Throwing a switch plugs the module in, steps the count and changes the link. Nothing inverts on hover but the switch; the plugs are ink, not signal, because they repeat.

**Use** on the home page in place of ModuleChips, where a visitor should see at a glance what is always on, what can be switched on, and that it all runs on one agent and one console. The Platform page keeps the tiles.

**Provide** two groups, core then add-ons, of {icon, name, line, on, href}; the tally's note (`1 agent · 1 console`, split at the dot onto the rail's ends) and request URL. Keep the content doc's order.

**Don't** make a core cell a switch, invert a cell on hover, colour cells by category, switch add-ons on by default, or set the plugs in signal.

**Build** the `ModuleGrid` block with `layout` set to switchboard (`Switchboard.client.tsx`; `switchboard`, `sw-head`, `sw-tier`, `sw-cell`, `sw-on`, `sw-rail` and the shared `module-tally` in `bundle.css`). From 1080px each tier sits on one row and every cell is plugged in; below that the tiers wrap and the ticks and plugs are dropped, the rail and the switches carrying the state.
