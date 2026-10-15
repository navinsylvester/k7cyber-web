# FeatureMatrix
The "Modules & Addons" table of a product page: modules down the left, products across the top, the glyph ✔ in `ink` where a module is included.

**Use** on MDR, XDR, EDR and EPS pages. Section rows (`batch`) open Modules and Addons with a count. The page's own product column is marked `is-k7` and reads in `ink`; a module that is not included is an em dash in `muted`, never an empty cell.

**Provide** the column list, the rows grouped by section, and a boolean per cell. Add the Enquire and View brochure actions beneath the table, not inside it.

**Don't** use colour to mean included; the tick plus the dash reads without colour. Never the signal pixel per cell: a ledger of thirty rows would spend thirty pixels, and signal is scarce. The one pixel is in the `is-k7` head. Scroll horizontally inside `table-wrap` on narrow screens rather than stacking.

**Build** the `FeatureMatrix` block (`featureMatrix`) on `dtable`, one table per section with its count in the head.
