# SiteFooter
The back of the file: the last sheet of every page, on `contrast`. It raises its own tab into the sheet above, **End of file** with the pixel and the year, as every sheet raises one; then the white logo and one sentence with the social row; the four link columns as numbered indexes on hairlines (`01 Home`), as the site's lists are; the type-set wordmark across the width of the sheet, the mark in signal and the name at `dim`, closing the page; and the base line with the legal, the offices, and the print stamp (`Printed 16-10-2026`, a fresh stamp with its pixel, the build's date on a static page).

**Use** once, after the closing CTA sheet, so the ground sequence ends signal → contrast and the tab rises into the signal sheet. Columns are Company (Home, About Us, Careers, Contact Us), Offer (Platform, Solutions, Services, Partners), Resources (Insight, Research, Media Room, Support) and Legal (Privacy Policy, EULA). Social links are 36px framed squares holding the five social glyphs from Icon (LinkedIn, X, YouTube, Instagram, Facebook) at 32px, inverting on hover; a network without a glyph shows its two-letter mono code.

**Provide** the columns from the Payload `footer` global, the social URLs, the legal line and the offices; the year and the print date come from the build.

**Don't** add a newsletter form, badges or an address block here; offices live on Contact Us. Keep the logo at 30px; the big wordmark is type, never the logo file scaled up. The wordmark's size follows the sheet's width (`footer-mark`) so it is always one line.

**Build** `src/Footer/Component.tsx` from the `footer` global: the `sheet-tab` at `--k: 0`, `footer-grid` with `footer-brand` and the numbered `footer-col` lists, `footer-mark`, and `footer-base` with the `fresh` stamp.
