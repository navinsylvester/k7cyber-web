# Icon
Flat lines on a 32px grid, 2px stroke, square caps, mitred joins, no curve where a corner will do, and exactly one 3px `signal` pixel. These eight are the reference set from the research build (Analysis, Advisory, Ranking, Report; Definition, Telemetry, Outbreak, Cleared).

**Use** `licon` at 32px in rows and tables, `licon-48` in capability rows, 40px in compact banners. The content doc's <Icon> placeholders (endpoints, servers, OT, network, mobile, cloud, DLP, patching, the seven industries, the modules) need new icons drawn to these rules; until drawn, reuse the closest of the eight and keep the Placeholder caption.

**Provide** the path data in a 32-unit viewBox and the pixel's x, y. In React the pixel is a `<rect>` that reads `--signal`.

**Don't** fill shapes, round caps, use two weights, or add a second pixel. Lucide icons are a stopgap only with square caps and mitred joins set.
