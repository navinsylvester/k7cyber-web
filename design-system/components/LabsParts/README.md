# LabsParts
The research pages of section 08 · Labs: the parts that `src/app/(frontend)/research.css` adds to `bundle.css`, rendered by `src/components/research/` under `src/app/(frontend)/research/`. These are data pages, so the list sits near the fold, the identifier reads first, and freshness is stated, never implied.

**A1 Utility header (`uhead`)** every listing and data page opens compact on `panel`: the section icon at 40px beside the title in `h-util`, the lede at 60ch, and on the right either `meta-rows` (entries, cadence) or the search field. Its tab states freshness ("Latest batch 01-09-2026 · 44 days ago"), the one tab a data page raises.

**A2 Research bar (`research-bar`, `crumbs`, `rtabs`)** breadcrumbs in `label` and the five section tabs (K7 Labs, Lab Blog, Vulnerability Information, Top Threats, Threat Reports) under the site header. The current tab carries the pixel and joins the ground of the sheet below it (`on-panel`, `on-paper`, `on-contrast`); on a detail page it is marked `is-section`, not current.

**L1 Identifier (`lid`, `id-display`, `lid-det`)** the unique part reads first and at full weight, the prefix (`pre`) at 55% ink; hashes (`hash`) in groups of four with a Copy button. On a detail page the identifier is the headline: `id-display` at Archivo width 62 up to 120px with the prefix at 38%, the name beneath in `id-sub`.

**L2 Level meter (`sev`)** five cells for severity, two for prevalence; only the top level fills `signal` (`is-top`). Levels read by length, never by hue.

**L3 Freshness stamp (`fresh`)** a solid pixel within 7 days, outlined after, blinking in steps only within 24 hours (`is-live`), with the date and "n days ago" recomputed on the client.

**L4 Ledger (`ledger filed` with `filters`, `ftab`, `pager`)** the filters sit above as `field` controls with Apply and Export; the results line is the ledger's tab (S7) and counts the rows and names the grouping, with "Select a column to sort" as the `ledger-hint` at the right; the heads sit on a paper band; batch rules group the rows (`batch-count`); the identifier cell (`id`) is the link and covers its row; dates and versions in 13px mono; heads sort through plain links that show ↓ or ↑. An empty state is one sentence inside the table at 19px.

**L5 Chain stair (`chain`)** an infection chain as numbered steps, each indented one step further: the 7's diagonal in content. The counter is `acc-ink`; a `det` foot links to the detection.

**L6 Series cover** see ReportCover. **L7 Lab icons** see Icon.

**L8 Lab Blog (`blog-layout`, `feature`, `post-row`, `blog-aside`)** the lead post is a filed feature panel ("Latest · date" on its tab, the image in a frame, title, excerpt, byline, tags). Then the list: each `post-row` has the date column in mono, the title up to 26px, the excerpt at 62ch, the byline with up to three category tags (then "+n"), and the thumbnail frame on the right; the whole row is the link, and it inverts and indents on hover. The aside (320px, sticky from 1080px): Categories in two columns with children under a corner mark, Featured posts, Recent posts with 88px thumbnails, Subscribe by RSS with the pixel. The search field sits in the utility header.

**L9 Post (`post-hero`, `article-grid`, `toc`)** the head on `panel`: back link, tags, the title up to 76px at 22ch beside the featured figure, the byline with the portrait, the date and the reading time. The article on `paper` in three columns from 1080px: the table of contents (a `details` block on a 2px left rule, the active heading in `signal`), the prose at 40rem, air on the right. Prose carries figures (`fig`, caption in `label`), tables (`tbl`, a full ink rule on top), code filed under a tab that names the language and the length with a Copy text button, and blockquotes on a 2px `signal` rule. The article is a record (L13). After the article: K7 detects (`det`, the detection names as identifiers), Share (underlined text links, no icons), the author card, and previous and next as two index rows (`pn`).

**L10 Detail (`detail-grid`, `block`, `spec-table`, `mono-list`, `log`)** the CVE and threat pages. The utility header carries `id-display`; the body is two columns from 1000px with a 360px aside. The main column is `block`s with `h-block` heads and 18px paragraphs. The aside holds the `spec-table` (mono heads, mono values), `mono-list`s of affected products or files, the `hash-cell`, and the removal `log`: op, key and value rows in 13px mono inside a frame, with a `details` fold for the rest. The back link reads "← All …" in `label`.

**L11 Threat reports (`report-feature`, `report-row`, `year-filter`, `lead`)** the latest report as a filed feature panel ("Latest report · published date" on its tab) with the cover at 300px; the rest as rows with the cover at 96px, the period in `label`, the title, one paragraph, and the actions on the right (Download PDF, the size in `label`). The year filter is a `seg` of links. A gated report opens the `lead` dialog, which arrives stamped: no entry transition, a filed sheet on panel at 560px over a backdrop of paper at 66% whose tab carries the report's title with the pixel blinking twice (`is-stamp`) and the close ×, one "Get the report" action, then the done state.

**L12 Labs landing (`labs-hero`, `statusline`, `lab-facts`, `stage`)** the one designed page of the section: the stair headline over the PT1 registration pattern masked at 100°, the lede with two actions, and the status line at the foot, four freshness stamps (latest analysis, CVE batch, top threats list, latest definitions) as cells on hairlines, each a link into its page. Then the facts in two columns, the K7ETI capability rows, the conferences as an index, and the Threat Intel CTA sheet.

**L13 Record rail (`record`, `para`, `para-n`)** S8: on a post (`Prose` with `rail`) and in a CVE record's technical information every paragraph with text is numbered `§ 01 …` in a 56px margin inside the measure; the number is a link to the paragraph, and the target paragraph takes a 2px `signal` rule at its left. Empty paragraphs, headings, lists and quotes are not numbered. Labs pages only.

**Figures** every featured image, thumbnail and portrait renders greyscale in its frame (README, Patterns and figures); figures inside an article keep their colour.

**Use** on `/research` and its sections only. Data pages open with A1 and A2; the landing opens with its own hero and A2.

**Provide** identifiers as strings, levels with their scale, ISO dates for the stamps, the post with its featured image, authors and categories, the report with its cover, period and gating.

**Don't** use the meter for anything but severity and prevalence; colour levels, states or categories by hue; add icons to the share links; bring the home-page devices (redaction, log strip) onto research pages; show a thumbnail in colour.
