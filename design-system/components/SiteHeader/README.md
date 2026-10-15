# SiteHeader
The sticky 60px bar with the logo, the eight top-level items from the Header Menu table, the theme toggle and the one primary action, plus a mega-menu panel that opens on a `.g-panel` sheet beneath it.

**Use** on every page. Items with children (Platform, Solutions, Services, Resources, About Us, Why K7) are buttons that open the mega menu; Partners and Support are links. The open item is underlined 2px in `ink`, exactly like the current page. The mega menu has one column per Sub Menu 1 entry, each headed by a `label` with its count, listing Sub Menu 2 pages as rows that invert and indent on hover. A column with no children (Managed Security Services, K7 ISAP, Certifications) is a single row under its parent's label.

**Provide** the nav tree (from the Payload `header` global), the current path, the primary CTA (Request demo), and the two logo files: the white variant in dark, the full-colour variant in light. The theme toggle writes `data-theme` on `<html>` and stores it under `k7-theme`.

**Don't** show more than one panel, add icons to nav items, or shrink the logo under 26px. Below 1040px the nav collapses behind a Menu button and opens the mobile list (24px rows with a pixel on the current page).

**Build** `src/Header/Component.client.tsx` from the `header` global: the bar, the mega panel on `g-panel`, the mobile list behind the Menu button, and the theme toggle as a two-button group; no menu library.
