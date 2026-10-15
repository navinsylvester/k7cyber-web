# Changes to the K7 Design Language in this repository

Newest first. Each entry names the rule, the reference CSS and the parts it touched, so the system describes the site as built (README.md, "Keeping it current"). Until 2026-10-15 the folder mirrored the Design System artifact unchanged (SOURCE.md).

## 2026-10-15

- **Icon, SiteFooter**: five social glyphs (LinkedIn, X, YouTube, Instagram, Facebook) drawn on the icon rules, each with its one pixel placed where it means something. SiteFooter shows them at 32px in the 36px frames in place of the two-letter mono codes, which remain the fallback for a network without a glyph. `src/components/k7/Icon.tsx` (`social`), `src/Footer`, the desktop artboards and `designs/k7chrome.py`, the Icon and SiteFooter previews.
- **FeatureMatrix**: included is the glyph ✔ in ink, not a signal pixel per cell; the one pixel stays in the `is-k7` head. Content fundamentals now say the pixel is for a single state and the glyph for a ledger. `bundle.css` (`td.tick`), the block, the MDR artboard, the FeatureMatrix preview.
- **Photography and illustration**: inside a figure frame (`.ph`) and in portraits (`.avatar`) every photograph and illustration renders greyscale; a drawn cover (`.is-cover`) keeps its colour; figures inside an article keep theirs. Written for the Lab Blog's imported featured images. README (Patterns and figures), Placeholder, `bundle.css`.
- **Building in React**: the stock shadcn parts were removed from `src/components/ui` with the packages only they used; the README's consuming section is rewritten, each part's `**shadcn**` line is now a `**Build**` line naming the real block or component, and "Where each part lives" and "Keeping it current" are added. The theme attribute is rendered on the server so nothing is hidden before paint.
- **LabsParts**: the README now covers the whole of section 08 (utility header, research bar, ledger, Lab Blog, post, detail pages, threat reports, the Labs landing), not only the three identifier parts.
