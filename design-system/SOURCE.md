Mirror of the Design System artifact https://claude.ai/artifact/E87ZMAcWXnAD8X43ukn55S (K7 Design Language, version 2.1 extended for the enterprise site).

- `tokens.json` is the source of truth for colours, type, spacing, cut sizes and opacities; generate Tailwind/shadcn CSS variables from it (mapping in README.md, "Consuming in React, Tailwind and shadcn/ui").
- `components/bundle.css` is the reference CSS each shadcn component must reproduce.
- `components/<Name>/README.md` are the per-component guidelines; `preview.html` the reference markup.
- `assets/Logos/*.svg` are the supplied logo files (from ~/office_docs/website).
- Ported from `~/office_docs/website/k7-research/assets/k7-research.css` and `k7-research/design-system/K7_Design_System_v2.1_dc.html`.
