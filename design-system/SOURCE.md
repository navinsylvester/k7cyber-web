Origin: the Design System artifact https://claude.ai/artifact/E87ZMAcWXnAD8X43ukn55S (K7 Design Language 2.1, extended for the enterprise site), mirrored into this folder on 2026-10-08.

Since 2026-10-15 this folder is the source of truth. It changes with the site (README.md, "Keeping it current"), `CHANGELOG.md` records every change, and `design-system.json` carries the latest change note. The artifact is the origin and is not kept in step.

- `tokens.json` is the source of truth for colours, type, spacing, cut sizes and opacities; `tokens.css` is generated from it and imported by the site's stylesheets (the variable mapping for Tailwind is in `src/app/(frontend)/globals.css`).
- `components/bundle.css` is the reference CSS every React part reproduces; sections 08 (Labs) and 09 (Support) keep theirs beside the app, in `src/app/(frontend)/research.css` and `src/app/(portal)/portal.css`, with their rules in `components/LabsParts` and `components/SupportParts`.
- `components/<Name>/README.md` are the rules per part; `preview.html` the reference markup, rendered by the design canvas against `bundle.css` and `tokens.css`.
- `assets/Logos/*.svg` are the supplied logo files (from ~/office_docs/website).
- Ported from `~/office_docs/website/k7-research/assets/k7-research.css` and `k7-research/design-system/K7_Design_System_v2.1_dc.html`.
