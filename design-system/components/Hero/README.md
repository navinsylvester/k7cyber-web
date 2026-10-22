# Hero
The home page opener: the product name flush left on three lines, the lede with two actions, the stack figure on the right, the registration pattern (PT1) fading from the headline, and the log strip (S6). The stair (S4) and the redacted word (S3) are not here: they open the sheet after it (SheetHead with `stair` and `redact`).

**Use** once, on the home page. The headline is the product name, one word per line, flush left, never redacted; the first line, the brand, is ink and the lines after it sit at `dim` (since 2026-10-16), the same split a sheet headline makes with its second clause, so K7 stands and the product name follows. The live pixel in the meta line blinks in steps only when the threat-lab feed is live.

**The halves** (since 2026-10-21): from 1000px the copy and the stack are two equal columns, so the figure stands at the headline's scale, as tall as the copy from the brand to the actions, instead of a drawing a third of the sheet beside it; below 1000px the stack sits under the copy at its width.

**The stack**: three tab-shaped plates (S2) stacked foot first, sensor, platform, agentic SOC on top, the top plate narrower so it sits on the one below; two square-capped arrows up the chain; each plate carries a mono label, its line in Archivo and an optional mono note. One signal pixel climbs the chain in five steps on a 5s loop, `steps(1)`, never eased; under prefers-reduced-motion it rests on the top plate. Plates are filled with the ground, so the registration pattern stays outside them. Strokes 2px, currentColor; no fill but the ground, no second colour but the pixel.

**Provide** the three headline lines (K7 / Seventh / Sense), the lede (the content doc's hero line, "Unified Endpoint-To-SOC Security Platform"), the two actions, the three layers of the stack foot first ({label, value, note}: 01 · Sensor, 02 · Platform, 03 · Agentic SOC with the pillar lines), and the log-strip entries (real detections from K7 Labs, newest first, repeated once for the loop).

**Don't** step or redact the hero headline, use the stack, stair or log strip on any other page (the Platform page and products open with PageBanner), or animate anything in the stack but the one pixel. Never a background image, video or glow behind the headline.

**Build** the `HomeHero` block (`homeHero`): `h-hero`, `hero-body`, `hero-copy`, `hero-fig` and the `stack` SVG in `bundle.css`.
