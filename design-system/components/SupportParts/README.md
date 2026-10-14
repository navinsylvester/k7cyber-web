# SupportParts
The support-portal parts from section 09 (reference CSS: `src/app/(portal)/portal.css`, the way section 08 lives in `research.css`). Two audiences share one language: customers get fewer, larger things on the sheet rhythm of the site; agents get the ledger.

**S1 Case number (`tid`)** the identifier reads like the Labs identifier: `CS-` dim, the unique part first and full weight, mono. `tid-display` is the large form on a case head.

**S2 State tag** a `Tag` for the customer's state, one of four words: Received, Being worked on, Waiting for you, Closed. Solid for the current state; `tag-signal` only for *Waiting for you*, because that is the one state that asks the customer to act; closed at 60% ink. Agents see the Dynamics status reason instead, with the Critical priority as the only signal mark on a row (`crit`).

**S3 Case track (`track`)** four cells in a row (Received · In progress · Your turn · Closed), 6px bars: done in `ink`, current in `signal`, ahead in `line`. One sentence under it says what happens next. Customer pages only; the agent sees the status reason.

**S4 Case row (`case-row`)** the customer's list: number and date in mono on the left, the title and a one-line preview in the middle, the state tag and arrow on the right. An IndexRow in a ledger shape: hover is the inversion, the title link covers the row.

**S5 Conversation (`msg`)** the customer's thread: avatar, name, relative time, the body at 16px with a 66ch measure, attachments as tags. The customer's own messages carry an outlined avatar, K7's a solid one. Newest first. Emails on the case are always shown; notes only when they were written through the portal (subject `Portal:` or `Reply to customer`), so internal notes never leave the desk.

**S6 Timeline (`tl`)** the agent's thread: timestamp column in mono, a kind tag (Email, Internal note, Portal note, Call, Task), the author, the subject, and the body behind a summary (+/−). Internal notes carry a dashed tag.

**S7 Ledger (`dtable` in the workspace)** the saved view's columns as mono heads, sortable through the head links, the case number as the row link, dates DD-MM-YYYY, status as a tag. Pages of 25; the pager and the count sit in `ledger-foot`.

**S8 Action panels (`acts`)** the right column of a case: each action is a `details` block with a short form (note, reply, status, assign, resolve, cancel, reopen, queue, call, task). Confirmation is a checkbox inside the form, never a browser dialog.

**S9 Charts (`bars`, `cols`, `trend`)** dashboards on the ledger grid: horizontal bars for categories (sorted by size, twelve plus "Other"), columns for short series, an inline SVG line with a signal end-point for trends. Ink only; Critical is signal.

**S10 Workspace bar (`wsbar`)** the sitemap of the mobile app as research-style tabs under the header, with the quick search on the right. The current section joins the sheet's ground.

**S11 Choice tiles (`choice`)** radio groups as tiles for the choices a customer makes with one tap: what the case is about, individual or organisation. The chosen tile inverts; hover on the chosen tile goes signal.

**S12 KPI card (`kpic`)** the manager's counter on a hairline grid: the measure in `label`, the number at width 62, a 4px meter of progress to the target, the target line and the change against the previous period in mono. "Below target" and the number go `acc-ink`, and the meter `signal`, only when the target is missed; hover is the inversion. Cards link to the page that explains them.

**S13 SLA meter (`slam`)** a 6px bar of the share of target used with the time left in mono: ink while on track, hatched when at risk, `signal` when past target, dim when paused, and the state word in `fmtLeft` ("1 h 20 m left", "overdue 3 h", "met in 25 min"). Compact form inside ledger cells.

**S14 SLA strip (`slastrip`)** five counters in a row: on track, at risk, past target, paused, unanswered; the two that mean a breach go `acc-ink` when non-zero. Each links into the board filtered to that state.

**S15 Engineer card (`eng`)** one engineer on the hairline grid: avatar, name, the load line, six measures in a 3 × 2 grid (resolve SLA, respond SLA, FCR, median resolve, median respond, per day), and a foot of counts where "past target" alone reads `acc-ink`. The name link covers the card; hover inverts. The table layout (`dtable`) is the same data with sortable heads.

**S16 Board row (`board-row`)** the prevention board: the case title with the signal pixel when past target, its facts in `muted`, the rules' verdicts as dashed tags, the two meters, and inline forms for reassign, remind and queue. The two-series trend (`trend2`) draws the second series dashed with a legend, never a second hue.

**S17 Score tag (`score`)** a customer's 1–5 rating as a Tag: "2/5 · Unhappy". A low score is the one state that goes `tag-signal`; a satisfied score is `tag-solid`; the middle is outlined; no rating is dashed. The words come from the five-point scale (Very unhappy … Very happy).

**S18 Care tag (`care`) and mark (`care-mark`)** the band a customer sits in, read before the first line of a reply: *Handle with care* on `signal`, *Watch* in solid ink, *Happy customer* outlined at 78%. The tag sits beside the customer's name on a case head and a contact or account page; the 8px mark stands before the name in ledgers and lists. The title carries the reason. No second hue: the three bands read by word and weight.

**S19 Care band (`care-band`)** one line under a case head when the band is high or watch: the tag, the reason in a sentence ("Rated their last case CS-… 2/5 three days ago."), the count and a History link. A 2px `signal` top rule for high.

**S20 Rating scale (`rate`)** five choice tiles in a row, the number large in mono with its word beneath; the chosen tile inverts and goes `signal` on hover, like S11. Large on the customer's closed case and the emailed survey, compact (numbers only) in the agent's action panel.

**S21 Distribution (`dist`)** the five scores as horizontal bars, 5 on top, count and share in mono; the low rows are `signal`, the satisfied rows ink, the neutral row hatched. The follow-up queue (`fu-row`) is a board row with the customer first, the score and the comment, and inline forms to take and close the follow-up.

**S22 Reason picker (`ReasonSelect`)** one native select, the sixteen reasons grouped under their four areas (the product, product support, licensing & sales, other). The customer sees it in their own words on the survey ("It slows my computer down"), optional; the desk sees the short labels ("Slows the computer"), and the manager closing a follow-up must pick one. Underlined like every portal select, never a widget.

**S23 Cause tag (`cause`)** what a low score was about as an outlined Tag with an 8px square before the words: "Support · Took too long to resolve". The square carries the area by weight: ink for the product, `signal` for support (the desk's own failing is the one that goes signal), hatched for licensing, outlined for other. A small "customer" suffix when it is the customer's own pick, not the desk's call; dashed "Not classified" until somebody says.

**S24 Area stack (`stack`, `stack-rows`)** one 14px bar split by area on a shared scale, the total in mono at the right: a row per product family, per week or per repeat customer. Segments use the same weights as the cause square, plus a dotted muted segment for the unclassified; each segment can link into the filtered ledger. A `legend.areas` key sits under the first stack on a page.

**Use** on `/support` (customers) and `/support/workspace` (agents). Customer pages open with a `help-hero` or a compact `ws` sheet; workspace pages are always `ws` sheets so the data sits near the fold.

**Provide** the case row (number, title, status reason, priority, dates), the timeline entries with their audience flag, the view's columns, and the chart series.

**Don't** show Dynamics status reasons, owners or SLA flags to customers; grade engineers by colour (the composite orders cards, it is never shown as a traffic light); put more than one primary button in a view; colour states by hue (they read by word and weight; the care band is signal, solid or outlined, never red, amber and green; the four areas of a low score are ink, signal, hatched and outlined, never four colours); let a customer see a note that was not written through the portal; show a customer their own care band.
