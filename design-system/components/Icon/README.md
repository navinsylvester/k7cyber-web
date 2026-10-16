# Icon
Flat lines on a 32px grid, 2px stroke, square caps, mitred joins, no curve where a corner will do, and exactly one 3px `signal` pixel: the one dot of the language, placed where it means something (README, The pixel). These eight are the reference set from the research build (Analysis, Advisory, Ranking, Report; Definition, Telemetry, Outbreak, Cleared).

**Use** `licon` at 32px in rows and tables, `licon-48` in capability rows, 40px in compact banners. The seven industries are drawn (bank, mortarboard, capitol, cross, factory, terminal, bag; the pixel is the seal in the pediment, the tassel, the flag on the tower, the centre of the cross, the smoke over the stack, the cursor and the label on the bag) and sit before the arrow in the industry index (IndexRow). The content doc's other <Icon> placeholders (endpoints, servers, OT, network, mobile, cloud, DLP, patching, the modules) need new icons drawn to these rules; until drawn, reuse the closest of the eight and keep the Placeholder caption.

**The puzzle** (home page): three 11px pieces in an L and the fourth slot empty but for the pixel, which marks the piece that is missing. It sits at 80px beside the "Beyond the obvious" paragraph (`symbol-row`), as an icon sits beside a capability row; it is the only icon used above 48px.

**Provide** the path data in a 32-unit viewBox and the pixel's x, y. In React the pixel is a `<rect>` that reads `--signal`.

Five social glyphs are drawn to the same rules for SiteFooter: LinkedIn (the pixel is the dot of the i), X (the tip of one stroke), YouTube (the record light beside the play mark), Instagram (the flash) and Facebook (the end of the f's arm). They stay out of the content icon picker.

**Don't** fill shapes, round caps, use two weights, or add a second pixel. Lucide icons are a stopgap only with square caps and mitred joins set.
