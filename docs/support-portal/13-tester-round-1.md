# Tester round 1: findings and the fix list

Four junior support agents tested the agent workspace on UAT through the Cloudflare tunnel (phase 1 brief,
`12-tester-brief.md`) and sent their notes on 2026-10-24. Every claim was checked the same day against the code,
UAT through `scripts/dataverse-probe.py`, and the live portal in Chrome (Microsoft door, as Navin). This file is
the work list that came out of it and the state across sessions.

**State 2026-10-24 (session 3): closed.** Every TR item passed its *Done when* in Chrome; TR-13 and TR-15, whose checks named a
tester, were accepted on Navin's own review the same day. What stays open is outside this list's fixes and has an owner: D-1 to
D-3 (support lead), D-4's Compact density (Navin, later), U-1 (UAT roles). The reply to testers is §4.

**2026-11-18 (session 4): the later notes closed.** The testers kept sending notes after the round (24-10 to 16-11, §5b): TR-16 to
TR-21. TR-17 was fixed on 2026-11-06; TR-18 to TR-21 were built and checked in Chrome through the tunnel on 2026-11-18; TR-16 is the
design language's rule, not a defect.

## 0. Working across sessions
- Take the next open item in §1 by priority (P1 first). Read its entry in §2 before touching code; the entry names
  the files, the cause and the check that closes it.
- Mark the item **doing** in §1 when you start and **done YYYY-MM-DD** when its *Done when* check has passed in a
  real browser on the tunnel (not only in tests). Partial work stays **doing** with a line in the session log.
- Any change to how a part looks follows `design-system/README.md`, "Keeping it current": the `SupportParts`
  README, the reference CSS, `preview.html` when markup changes, the artboards, `design-system/CHANGELOG.md`.
- When an item changes what is built, update `09-portal-guide.md` in the same commit.
- Append one entry to §6 at the end of every session: what was done, what was verified, what is next.
- Test data: CS-01194-B4N9 (Portal Test, owned by Navin, status In Progress-Lab) and CS-01195-B0Q3 (batman K of
  BATMAN corp, a contact customer with an account) are the cases to try fixes on. Put CS-01194-B4N9 back to
  In Progress-Lab after any status test.

## 1. Status at a glance
| id | item | kind | priority | status |
|---|---|---|---|---|
| TR-01 | Theme shows dark on every full page load, then flips | bug | P1 | done 2026-10-24 |
| TR-02 | React never hydrates after a cut-off chunk (dead toggles, pickers, menu) | delivery | P1 | done 2026-10-24 |
| TR-03 | New contact form loses vertical, state, city and organisation on an error | bug | P1 | done 2026-10-24 |
| TR-04 | Phone field accepts letters | bug | P1 | done 2026-10-24 |
| TR-05 | Changing the state keeps the old city on the contact | bug | P1 | done 2026-10-24 |
| TR-06 | New case: picked contact does not fill the email; "create a contact" return loses the contact | bug | P1 | done 2026-10-24 |
| TR-07 | Case head shows no account when the customer is a contact | gap | P1 | done 2026-10-24 |
| TR-08 | Case head shows no phone number for the customer | gap | P2 | done 2026-10-24 |
| TR-09 | Incident ID not shown | gap | P2 | done 2026-10-24 |
| TR-10 | Serial key hard to find and named three ways | gap | P2 | done 2026-10-24 |
| TR-11 | Searching by email finds too few cases | bug | P1 | done 2026-10-24 |
| TR-12 | An unknown status reason shows as a bare number | bug | P3 | done 2026-10-24 |
| TR-13 | Field labels too small to read | design | P2 | done 2026-10-24 (accepted by Navin; density is D-4) |
| TR-14 | Mandatory fields not clear | design | P2 | done 2026-10-24 |
| TR-15 | Light mode looks inconsistent (colour, size, bold) | check | P3 | done 2026-10-24 (no defect; accepted by Navin) |
| TR-16 | "CS" of the case number lighter than the rest | check | P3 | no defect: the prefix is dim by rule L1 (`splitTicket`, `.tid .pre`) |
| TR-17 | New case on a contact fails with 0x8004f865 | bug | P1 | done 2026-11-06 (e68541e) |
| TR-18 | Email: font, size, colour; links not highlighted | gap | P2 | done 2026-11-18 |
| TR-19 | Email: attach files | gap | P2 | done 2026-11-18 |
| TR-20 | Operating system version field | gap | P2 | done 2026-11-18 |
| TR-21 | Merge one case into another | gap | P2 | done 2026-11-18 |
| TR-22 | Bug ID not saved in Incident ID | bug | P1 | done 2026-11-26 (the CRM's field security; who may set it is D-5) |
| TR-23 | State and City not filtered by letter | gap | P2 | done 2026-11-26 |
| TR-24 | Case summary with the existing notes | gap | P2 | done 2026-11-27 (Copilot's summary on the timeline; production's setting to confirm, `11` item 29d) |
| TR-25 | Select a template in the email | gap | P2 | done 2026-11-27 (templates are written in Dynamics; the desk's own still to add) |
| TR-26 | Notify managers: overdue emails, the bin, pending cases, escalations, Lab samples | request | P1 | done 2026-11-27 as the notification system (09 §4g) |
| D-1 | Fill the customer and serial key from the registered mobile | request | — | decide |
| D-2 | "Customer type: consumer or enterprise" on the case | request | — | decide |
| D-3 | Rename field titles | request | — | decide |
| D-4 | Smaller text, denser layout | request | — | decided 2026-10-24: labels now (TR-13), Compact density later |
| D-5 | Who may set Incident ID, Module, Sub module, Product version (field security profiles) | request | — | decide (support lead; `11-staging-readiness.md` item 29b) |
| U-1 | Seven agents without a role in UAT, their cases owned by Navin | UAT | — | open (`11-staging-readiness.md` item 29) |

## 2. Entries

### TR-01 · Theme shows dark on every full page load, then flips (P1)
**Testers said:** "The screen frequently switches between light and dark appearances." "When switching to Light Mode,
the font color and size appear to change."
**Verified:** with Light chosen, a full load of `/support/workspace/queues` through the tunnel read `data-theme="dark"`
at first script access and `light` about ten seconds later.
**Cause:** `src/providers/Theme/InitTheme/index.tsx` renders the theme switch through `next/script` with
`strategy="beforeInteractive"`. In the App Router an inline script with that strategy is serialised into
`self.__next_s` in the HTML and executed by Next's client runtime, not by the parser. The page paints with the
server's default (dark) and switches only when the runtime has loaded, which takes seconds on the dev server over
the tunnel. The comment in that file states the opposite of what happens.
**Fix:** render a plain inline `<script dangerouslySetInnerHTML>` in `<head>` (a server component, same body as
today) so the parser runs it before the body paints. `InitTheme` is used by three root layouts: `(frontend)`,
`(portal)` and `(partner)`; fixing the component fixes all three. Read `node_modules/next/dist/docs/01-app/02-guides/scripts.md`
first. Keep `suppressHydrationWarning` on `<html>`. While there, start `ThemeProvider` from the attribute already on
`<html>` so the Dark/Light buttons do not show Dark pressed until the effect runs.
**Done when:** with Light chosen, a hard reload of three portal pages and one site page over the tunnel shows
`data-theme="light"` in a script placed first in `<body>`, and a screenshot taken immediately after navigation is light.

**Done 2026-10-24:** `InitTheme` is a plain inline `<script>` in `<head>`; `ThemeProvider` reads `<html data-theme>` through `useSyncExternalStore` (server snapshot undefined, so hydration matches), and until hydration the Dark | Light pair has no `aria-pressed` and `bundle.css` presses the button matching `data-theme`. Checked on the production server through the tunnel with Light stored: the HTML of `/support/workspace`, a case, the new contact form and `/` carries `data-theme="dark"` and the script before `<body>`; a probe script inserted first in `<body>` read `light` on all four; screenshots straight after Ctrl+Shift+R on the queues and case pages are light with *Light* pressed.

### TR-02 · React never hydrates after a cut-off chunk (P1, delivery)
**Testers said:** nothing directly; it explains "the theme does not stay", pickers that do not fill and buttons
that do nothing for some people only.
**Verified:** in Chrome the react-dom dev chunk was cached at 450 KB of 1,065 KB and the next-devtools chunk at
482 KB of 864 KB; the console showed `SyntaxError: Unexpected end of input`; no element had React props 22 s after
load. curl fetched both files whole from localhost and from the tunnel. Refetching with `cache: 'reload'` fixed it.
**Cause:** the dev server sends chunks with `Cache-Control: no-cache, must-revalidate` and a weak ETag. A transfer
cut off once in the tunnel is stored, and every later revalidation answers 304, so the broken copy is reused for good.
Server forms still post, so the portal looks half alive.
**Fix:** testers use a production server, not `next dev`: `pnpm build && pnpm start` behind the tunnel (the build
reaches the local Postgres, `11-staging-readiness.md` item 8). Production chunks are content-hashed, so a damaged
copy is never revalidated into place. Add to `12-tester-brief.md`: "If a button or the theme switch does nothing,
press Ctrl+Shift+R once." Record the switch in `09-portal-guide.md` §1 (how testers are served).
**Done when:** the tunnel serves `next start`; the brief carries the hard-refresh line; a fresh Chrome profile
hydrates on the workspace, a case, the new contact form.

**Done 2026-10-24:** the tunnel now serves `next start` (`scripts/serve.sh rebuild|up|down|status`, `09-portal-guide.md` §1); production chunks are `public, max-age=31536000, immutable` with hashed names. Found while checking: through the quick tunnel Cloudflare's Email Address Obfuscation rewrote every email in the HTML into a link plus a decoding script, so React's hydration failed and the tree was rebuilt on any page showing an address (case heads, the new case form, searches); the portal routes now send `Cache-Control: … no-transform` (`next.config.ts`), which stops it (proved on a probe route, then on the pages: no `__cf_email__`). The brief carries the Ctrl+Shift+R line. After Ctrl+Shift+R the workspace, CS-01195-B0Q3 and the new contact form hydrated in 0.5 to 1.4 s with no console error. Fresh profiles (session 3): Playwright on the system Chrome with new, empty profile directories. Through the tunnel the sign-in page, `/support`, `/support/kb` and the partner sign-in hydrated in 0.3 to 1.3 s with no console error; the workspace, CS-01195-B0Q3 and the new contact form, which need an agent session, were checked the same way on the same build served on 127.0.0.1:3100 with the probe door (a local-only port the tunnel does not reach; your Microsoft sign-in cannot be scripted): hydrated in 0.2 to 0.5 s, no console error, the case head rendered in full. That instance was stopped afterwards. Then the full check over the tunnel: a visible Chrome window on a new, empty profile, Navin signed in through the Microsoft door himself (07:18Z), and the workspace (0.4 s), CS-01195-B0Q3 (1.3 s) and the new contact form (0.6 s) hydrated with no console error and no rewritten email. The throwaway profiles were deleted. Regression found and fixed in session 3: `next start` sets NODE_ENV=production, which switched off the probe service identity (the KB read "Nothing published yet", the one-time-code doors would fail) and the partner portal (404). `src/lib/env.ts` `isDeployed()` now gates those development fallbacks; `K7_LOCAL_BUILD=1` in `.env` keeps them on this machine's production build, and `scripts/serve.sh` refuses to start without it. After the fix: KB lists articles, partner sign-in 200, 299 unit tests pass.

### TR-03 · New contact form loses vertical, state, city and organisation on an error (P1)
**Testers said:** "if given data in mobile number is invalid > selected the vertical type and state & city >
coming to default unselected state."
**Verified in code:** `createContactAction` (`customers/contacts/new/actions.ts`) redirects with first name, last
name, email, mobile, phone and job title only. The page cannot restore what it was not sent. The edit panel
(`updateContactAction`) is worse: on an error it reopens with the stored record, so every typed change is lost.
`accounts/new` and the account edit have the same pattern.
**Fix:** two layers. (1) Validate in the browser first: `pattern`, `minLength` and `title` on mobile, phone and
email in `ContactFields` and `AccountFields` (`customers/forms.tsx`), so the common mistakes never round-trip.
(2) On a server error, carry every field back: vertical, stateId, cityId, accountId and the account search for
contacts; type, vertical, licenceKey, stateId, cityId for accounts. Pass them into the form values and into
`loadGeo(auth, stateId)` so the city list is loaded for the restored state. For the edit panels, carry the
submitted values the same way and prefer them over the record when `edit=1`.
**Done when:** on both new forms and both edit panels, a bad mobile with vertical, state, city and organisation
chosen comes back with all of them still chosen and the error shown; with JavaScript on, the browser stops the
submit before it leaves.

**Done 2026-10-24:** inputs carry the rules as `pattern`/`title`; a refused submit redirects with every value (`carry`) and the failing fields (`bad`), and the pages read them back (`contactFromQuery`, `accountFromQuery`, the city list loaded for the restored state; the new contact form also keeps the organisation search and choice; the edit panels prefer the submitted values when `edit=1` and an error is present). In Chrome: on the new contact form the browser stopped `98400abc00`/`abc` with the hint; with the browser check off the server refused both and BATMAN corp, Enterprise, Tamil Nadu and ABHINASHI came back chosen with Mobile and Phone marked; the same on the new account form, the batman K edit panel and the BATMAN corp edit panel. A legacy value that predates the rules (a stored mobile of eight digits) does not block an edit while left unchanged (`keep_<field>`).

### TR-04 · Phone field accepts letters (P1)
**Testers said:** "while creating the contact, in phone number field taking alphabets."
**Verified in code:** `readContactForm` checks mobile (`^\+?[0-9 ]{10,15}$`) but not phone; `readAccountForm`
checks neither.
**Fix:** one rule for landlines in `forms.tsx`: digits, spaces, `+`, `-`, `(`, `)`, between 6 and 15 digits,
applied to contact phone and account phone on the server, mirrored as an HTML `pattern` (TR-03). Unit-test both
readers (`tests/int/support-forms.int.spec.ts`, new; no tenant needed).
**Done when:** "abc" in either phone field is refused in the browser and by the server; the tests pass.

**Done 2026-10-24:** phone: digits, spaces, + - ( ), 6 to 15 digits per number, several numbers allowed separated by / , or & (30 of 173 UAT contact phones hold two numbers); applied to contact and account phone on the server and as a pattern in the browser. `tests/int/support-forms.int.spec.ts` (11 tests) passes; "abc" refused in the browser and by the server in Chrome.

### TR-05 · Changing the state keeps the old city on the contact (P1)
**Testers said:** "When updating contact > if state is changed and city not updated > previous selected city
reflecting in contact."
**Verified in code:** `contactBody` in `src/lib/support/customers.ts` binds city, state and region only when an id
is present. An empty city is not sent, so Dynamics keeps the old one. `accountBody` has the same gap. A state
cleared to "Select a state" is never cleared either.
**Fix:** on update, send a disassociation for any of the three lookups the form leaves empty. Try it on the test
contact first: the documented call is `DELETE contacts(id)/alletec_City/$ref` (one per lookup, through the guarded
client); check whether a `PATCH` with the navigation property set to `null` is accepted instead, as
`caseBody`'s comment suggests, and use the one UAT accepts. Server side, also refuse a city that does not belong to
the chosen state (the cities memo has `stateId`). Consider making the city required when a state is chosen;
decide with the support lead whether the Hub requires it.
**Done when:** on the batman K contact, state changed with the city left empty saves with no city; state cleared
saves with no state, city or region; the probe confirms the row. Put the contact back as it was.

**Done 2026-10-24:** UAT accepts `"<nav>@odata.bind": null` on PATCH (checked on batman K first), so `contactBody`/`accountBody` send null for an empty city, state or region on update (creates leave them out), and the readers refuse a city outside the chosen state. The same null was being dropped by `caseBody`, so clearing a case's product or category in *Edit details* also said saved and did nothing; fixed with it. In Chrome on batman K: Tamil Nadu + ABHINASHI saved (probe: city, state, South); state changed to Kerala with the city empty saved (probe: city null, Kerala); state cleared saved (probe: all three null); a city from another state refused with City marked. The contact is back as it was (no geography). Whether the Hub should require the city stays with the support lead (D-3).

### TR-06 · New case: the picked contact does not fill the email (P1)
**Testers said:** "When creating new case > even after selecting customer contact > still asking for email id."
**Verified in code:** `cases/new/page.tsx` prefills *Customer email* and *Vertical* only from the `sel` parameter,
which is set by the accounts' "choose a contact" link. Picking a contact radio changes nothing on the page.
Second bug on the same path: "Create a contact" returns to `cases/new?customer=…&contact=<id>`, but the page reads
`sel`, not `contact`, so the new contact is not even selected.
**Fix:** a small client part around the customer choice (`src/components/support/CasePickers.client.tsx`) that, on a
contact pick, fills *Customer email* and *Vertical* from data attributes on the radio, without overwriting what the
agent typed by hand. Without JavaScript the server path stays: make the contact return use `sel=contact:<id>`.
**Done when:** picking a contact in the results fills its email and vertical at once; creating a contact from the
case form lands with that contact chosen and its email filled.

**Done 2026-10-24:** `CustomerAutofill` fills *Customer email* and *Vertical* from the picked radio's `data-email`/`data-vertical` unless the agent changed them; the server takes the contact's email when the field is left blank; the contact return uses `sel=contact:<id>`. Also fixed: the account page's *New case* linked `?account=`, which the form never read (now `sel=account:<id>`). In Chrome (dev and production): picking Jack Sparrow and batman K filled their email (and Enterprise for batman K) at once; *Create a contact* → *Save and open a case* landed on the case form with the new contact chosen, its email and vertical filled. That created the UAT contact **TEST TR06** (`tr06.test@example.com`, id `23aa656b-75cf-f111-a05d-7ced8daf56a6`), left in place.

### TR-07 · Case head shows no account when the customer is a contact (P1)
**Testers said:** "the Account field appears blank in the case overview. However, when we open the contact, the
complete account details are visible."
**Verified:** 1,198 of the 1,438 UAT cases have a contact as customer whose contact has a parent account; the head
shows only the contact (CS-01195-B0Q3: batman K, account BATMAN corp not shown).
**Fix:** in `getCase` (`src/lib/support/cases.ts`) expand the customer contact
(`customerid_contact($select=_parentcustomerid_value,mobilephone,telephone1,emailaddress1)`) and the primary
contact the same way; on the head (`workspace/cases/[id]/page.tsx`) add an *Account* row linking to the account
page when the customer is a contact. Same on the case lists? No: the views keep the CRM's own columns.
**Done when:** CS-01195-B0Q3's head shows Account: BATMAN corp, linked; an account case still shows its account as
customer and its primary contact as contact.

**Done 2026-10-24:** `getCaseParties` reads the customer contact (and its parent account), the customer account and the primary contact in one expanded GET; the head shows *Account* linked when the customer is a contact. CS-01195-B0Q3: Account BATMAN corp → its page; an account case (CS-431236-P6T7) shows its account as customer and Vineet Ram as contact, no Account row.

### TR-08 · Case head shows no phone number (P2)
**Testers said:** "Need to add the contact number information."
**Fix:** from the expansion of TR-07, a *Phone* row on the head: the contact's mobile, else its phone; for an
account case the primary contact's, else the account's `telephone1`. `tel:` link. Hidden when empty.
**Done when:** CS-01195-B0Q3 and one account case show a callable number when the CRM has one.

**Done 2026-10-24:** *Phone* row with a `tel:` link (contact mobile, else phone; account: primary contact's, else the account's). CS-01195-B0Q3 shows 9995716824, CS-431236-P6T7 shows its primary contact's 9440126001.

### TR-09 · Incident ID not shown (P2)
**Testers said:** "The Incident ID field needs to be added."
**Verified:** `incident.k7_incidentid` ("Incident ID", text) exists and is filled on 172 UAT cases, often as "-"
or "Incident ID - 14286889". The portal neither reads nor edits it.
**Fix:** add it to `CASE_SELECT`, show it on the Details tab (empty and "-" read as empty), add it to the edit
panel and to `NewCase`/`caseBody` and the new-case form (section 3, product details), and to the in-view and header
search conditions. Ask a tester what fills it today (the Pro32 desk's number?) and label it the way they say it.
**Done when:** a case with an incident id shows it; editing it saves; searching it finds the case.

**Done 2026-10-24:** `k7_incidentid` in `CASE_SELECT`, on Details as *Incident ID* ("-" reads empty), in *Edit details*, on the new case form, and in the in-view and header searches. Set on CS-01195-B0Q3 in Chrome, shown, found by the header search, then cleared again (probe: null). What fills it today was not asked of a tester; the label is the CRM's.

### TR-10 · Serial key hard to find and named three ways (P2)
**Testers said:** "Need to add a Serial Key Number field under Customer Information." Another tester: "The Serial
Key field is visible under Edit Details."
**Verified:** the case's serial (`k7_2ndserialnumber`) is on the Details tab as "Serial", in the edit panel and new
case form as "Serial number"; the account's licence key (`k7_description`) is "Licence key"; contracts carry
`alletec_productkey`. Nothing sits next to the customer.
**Fix:** one name, *Serial key*, everywhere the case field appears. Show it on the case head under the customer when
set. On the head, also show the account's licence key when the case has none. Leave contract keys to D-1.
**Done when:** the head of a case with a serial shows it under the customer; the label reads the same on head,
Details, edit panel and new case form.

**Done 2026-10-24:** *Serial key* on the head (under the customer, or the account's *Licence key* when the case has none), Details, *Edit details* and the new case form. Set and cleared on CS-01195-B0Q3 in Chrome.

### TR-11 · Searching by email finds too few cases (P1)
**Testers said:** "When we search using the email ID of an existing customer, only one Case ID is displayed, even
though multiple cases are available for that customer."
**Verified:** three separate causes.
1. The search box on `/support/workspace/cases` searches inside the chosen saved view. For jacksparrow.rafi@gmail.com,
   *Active Cases* (case type Case, origin Phone/Email/Chat) shows 1 of the 4 active cases; the other three are
   Service Requests. Gabriel Vega's 37 cases show 0 in *My Active Cases*.
2. The header search (`searchCases`) matches only the case's own email field `k7_customeremail`. 25 active UAT
   cases have none while their contact has one.
3. The header search returns at most 20 cases with no sign that there are more (37 found, 20 shown). The contact
   and account pages cap their case lists at 25, also silently.
**Fix:** (1) on the cases page, say where the search ran ("in My Active Cases") and, under the results and on an
empty result, offer "Search all cases for …" linking to `/support/workspace/search?q=`. (2) in `searchCases`, also
match `customerid_contact/emailaddress1`, `primarycontactid/emailaddress1` and the contact's mobile when the needle
looks like a phone number (probe the filter on UAT first). (3) count with `$count=true`, show "20 of 37" and a link
to the customer's page; give the contact and account case lists a count and paging.
**Done when:** Gabriel Vega's address in the header search reads 37 and every case can be reached; the jacksparrow
address in *Active Cases* shows 1 with the link to all 4; a case without its own email is found by its contact's.

**Done 2026-10-24:** (1) the cases page says "Searched in <view> only" with *Search all cases for …*; (2) `searchCases` also matches the customer contact's and primary contact's email, the incident id, and the contacts' phones when the query looks like a number; (3) counts with `$count`: "20 of 37" and *Show all* (`?all=1`), the contact and account case lists "25 of N" and `?cases=all`. In Chrome: Gabriel Vega 20 of 37, all 37 reachable, his contact page 25 of 37 then 37; jacksparrow in *Active Cases* 1 with the link, the header search 5 (one more than the case email alone finds). Also fixed: "1 cases" on the view count and the ledger foot.

### TR-12 · An unknown status reason shows as a bare number (P3)
**Verified:** five legacy UAT cases from 2018 carry status reason 696720006, which is not an option in UAT (nor in
the production list in `03-metadata-summary.md`), so the formatted value is missing and the tag shows the number.
**Fix:** `StatusTag` (`src/components/support/Parts.tsx`) falls back to the label in `STATUS_REASONS`, then to
"Unknown status". Same fallback wherever `fv(row, 'statuscode')` is printed.
**Done when:** the header search for jacksparrow.rafi@gmail.com shows no bare number.

**Done 2026-10-24:** `caseStatusLabel` (CRM label, else ours, else "Unknown status") in `StatusTag`, the reopen line, the engineer rows and the status spread. The jacksparrow search shows "Unknown status" for the 2018 case, no number.

### TR-13 · Field labels too small to read (P2, design, needs D-4)
**Testers said:** "difficult to identify the titles and understand where to enter the data"; "every topic has to be
highlighted for better visibility".
**Verified:** form labels are 11 px uppercase IBM Plex Mono in `--mu` (muted), 10 px inside the case action
panels (`portal.css` `.acts .field > .label`), against 16 px inputs.
**Fix proposal:** for forms only, labels 12 px in full ink, the action panels' override removed, section titles in
the forms one step stronger. A design-system change: `SupportParts` README, `bundle.css`/`portal.css`, previews,
CHANGELOG. Settle with D-4 so the same pass handles density.
**Done when:** decided, built, the design system updated, a tester confirms on the new contact and new case forms.

**Done 2026-10-24 (Navin chose: labels now, density later):** portal form labels, legends and filter labels 12px in full ink, the action panels' 10px override removed, form section titles weight 500 (`portal.css`; SupportParts S20, Field README, CHANGELOG). Checked in Chrome in Light (new case form) and Dark (action panel). Accepted by Navin on his own review (2026-10-24, session 3) in place of a tester's confirmation; the Compact density switch stays with D-4.

### TR-14 · Mandatory fields not clear (P2, design)
**Testers said:** "Clearly highlight all mandatory fields so agents can easily identify the information required to
create a case."
**Verified:** `Field` appends " *" to the 11 px label; nothing else marks a required field, and the new case form
requires only the customer and the title.
**Fix:** the asterisk in the accent colour and a one-line legend at the top of each form ("* required"); invalid
fields marked after a failed submit (`.is-invalid` exists in `Field`, unused by the server forms). If the desk wants
more fields required on a case (product, category, email), that is a decision for the support lead: list it in D-3.
**Done when:** the new case, new contact and new account forms show the legend and the marked fields; the design
system documents it.

**Done 2026-10-24:** the asterisk in the accent (`Req`), "Fields marked * are mandatory" (`RequiredNote`) on the new case, contact and account forms, refused fields marked `is-invalid` with the rule as text, the browser's own refusal underlined through `:user-invalid`. Applied to the site's FormSheet and the partner deal form too, so the language has one rule (Field README and preview, the Contact and Quote artboards, CHANGELOG). Whether more case fields become required stays with D-3.

### TR-15 · Light mode looks inconsistent (P3, check after TR-01)
**Testers said:** "When switching to Light Mode, the font color and size appear to change. Some entries are
displayed in bold, while others are not."
**Verified:** the colour change is TR-01. Weight 600 titles over regular meta text is the design language, not an
error. No size change between themes was found in the CSS.
**Next step:** after TR-01 ships, ask the tester for a screenshot of the page that looks wrong. Close if it is the
design; open a new item if it is not.

**Done 2026-10-24 (no defect):** after TR-01, font size, weight, family, letter-spacing and case of all 523 text elements on the workspace, a case and the new contact form were compared in Dark and Light: identical; only colours change. The colour flip testers saw was TR-01. Accepted by Navin on this measurement (session 3) in place of the tester's screenshot; if a tester still sees a difference, open a new item with their screenshot.

## 3. Requests that need a decision
| id | request | what exists | proposal | who decides |
|---|---|---|---|---|
| D-1 | Enter the registered mobile, get the customer and the serial key filled | The new case search already matches mobile numbers (contains). Contracts per customer carry `alletec_productkey`. | On picking a customer, list their contracts' product keys and let the agent pick one into *Serial key*. A day of work after TR-06. | support lead |
| D-2 | A *Customer Type* to say consumer or enterprise | The case's *Vertical* (`new_verticaltype`) already says Consumer / Enterprise and shows as a tag on the head. The CRM's *Customer type* is a different field (Existing, New, Partner…), on Details and in the edit panel. | Label the head tag "Vertical: Enterprise" so it is read as the answer; no new field. | support lead |
| D-3 | Rename the field titles | The portal uses the Hub's names on purpose so agents can work in both. | Collect the renames the desk wants in one list (and any field they want mandatory, TR-14), apply them in one pass, note each mapping in `09-portal-guide.md`. | support lead |
| D-4 | Smaller text, denser layout | Sheet text is 15–17 px, row padding generous. | A *Compact* density switch for agents next to Dark/Light, stored like the theme; tighter rows and 14 px body text. **Decided 2026-10-24:** the labels first (TR-13, built), the Compact switch later. | Navin |

## 4. Not bugs: the reply for the testers
- **"Case status not updated in New CRM".** A status change in the portal reaches the CRM: checked on 2026-10-24 on a
  test case (the case sheet, the case list and the CRM row all read the new status). The portal reads a copy of
  the CRM taken on 12 October, so anything changed in the real CRM since then is not in it. Send the case number if
  it still looks wrong.
- **"Case owner's name is incorrect".** In the test copy, cases of seven agents who have no access there were given
  to Navin Sylvester. Production shows the right owner; the test copy will be fixed (U-1).
- **"Add a Customer Type field".** It is on the Details tab and in *Edit details*. Consumer or Enterprise is the
  *Vertical*, the tag on the case head (D-2).
- **"Add a Serial Key field".** It now sits under the customer on the case head as *Serial key* (or the account's licence
  key when the case has none), with the same name on Details, *Edit details* and the new case form (TR-10).
- **Fixed since your notes (2026-10-24):** the theme no longer flips on load; the contact and account forms keep everything
  you chose when one field is wrong, refuse letters in phone numbers and mark the field to fix; changing the state clears the
  old city; picking a contact on a new case fills the email; the case head shows the contact's account, a phone number, the
  serial key; the Incident ID is on the case; searching an email finds the customer's cases through their contact too and
  says how many there are; labels are larger and darker; required fields carry an orange asterisk, with a note at the top of the form.
- **Speed, case assignment.** Reported as working; nothing to do.

**Reply for the notes of 2026-11-26 (TR-22, TR-23):**
- **"BUG ID not getting added" (Incident ID).** Incident ID is a locked field in the CRM: only users in its *Level 2 Users*
  group (and administrators) may fill it in or see it, and the Hub works the same way. Your user is not in that group, so the CRM
  refused the save, and the portal dropped everything else you had changed along with it. Since 26 November the portal shows
  Incident ID greyed out with the note *Locked: Dynamics field security does not let your user set this.*, and the rest of what you
  change saves. Module, Sub module and Product version are locked the same way, and so is the YODIZ id on RFEs. The Details tab
  says which of these fields are hidden from you, so a case can have a Bug ID you cannot see. Until the support lead decides who
  should set the Bug ID (D-5), ask a Level 2 colleague to add it, or put it in a note on the case.
- **"State and City name not filtered with Letter".** Fixed on 26 November. On the contact and account forms, State and City are
  now fields you type into: a few letters from anywhere in the name narrow the list ("chen" leaves Chengalpattu, Chennai,
  Tiruchendur and Tiruchengode), then pick with the mouse, or the arrow keys and Enter. Choose the state first; the cities follow it.
  The test CRM listed most cities twice; each now appears once.

**Reply for the notes of 2026-11-26 (TR-24, TR-25, TR-26):**
- **"Case summary should be added" (existing notes).** Done on 27 November. A case's timeline now opens with *Case summary*. Press
  *Summarise the case* and the CRM's Copilot sums the case up from its title, description, notes and emails, the same summary the
  case form in Dynamics shows; it takes about ten seconds. The summary stays on the case for everyone who opens it, with who asked and
  when, and says so when newer notes or emails have come in, so you can summarise again. *Save as a note* keeps it on the case as an
  internal note. A machine writes it: check it before you rely on it.
- **"Select template option" (email template).** Done on 27 November. *Email the customer* now starts with *Template*: pick one and
  press *Use template*, and the subject and message are filled with the case's details (customer name, case number, owner). Edit
  them before you send; *Undo* puts back what you had. The list is the CRM's own email templates, so a template written once in
  Dynamics (Settings → Templates → Email Templates) appears in both. The test CRM has only Microsoft's five standard ones: tell us which
  replies you send most and we will add them.
- **Manager notifications** (fresh email not answered, pending reply, case not picked from the bin, pending for long, escalated,
  Lab sample). Done on 27 November, for everyone, not only managers. *Notifications* next to your name lists what concerns you; it
  is emailed too once the mail server is set up. You are told when one of your cases is at risk of missing its target, or past it:
  - the first answer to a new case;
  - the answer to the customer's follow-up;
  - picking a case up from the bin;
  - a Lab sample;
  - the resolution.
  You are also told when a case is assigned to you, when the customer writes, when a case is escalated to the Lab, principal support
  or product, and at the end of your shift, if any of your figures miss the desk's targets. Managers get the same for the whole desk.
  The targets, the shifts and who receives what are set by the support lead in the manager view; until then the targets are the current
  ones (for example 30 minutes for a follow-up, 5 minutes to pick a case from the bin, 3 hours for a Lab sample).

## 5. Evidence kept
UAT counts used above, read with the probe on 2026-10-24: 1,438 cases, 214 active; 1,370 with a case email; 1,198
contact customers whose contact has an account; 142 cases (22 active) owned by Navin through the seed's owner
fallback; 172 with an incident id; 5 with status reason 696720006. Chrome: dev chunks served with
`Cache-Control: no-cache, must-revalidate` and a weak ETag, through the tunnel `cf-cache-status: DYNAMIC`.

## 5b. Later notes (2026-10-24 to 2026-11-16)
The testers' sheet kept growing after the round. Each entry was checked against the code on 2026-11-18.

### TR-16 · "CS" lighter than the rest of the case number (P3, Imran, 24-10)
**Verified:** on purpose. Identifiers read their unique part first (design rule L1): `splitTicket` splits `CS-`, and `Tid`
renders it as `.pre` at 55% opacity (38% on the case head). **Reply:** the prefix is the same on every case, so it is dimmed to let
the part that differs stand out. If the desk prefers it full, it is one line in `portal.css` plus the design-system update.

### TR-17 · New case on a contact fails with 0x8004f865 (P1, Imran, 24-10)
**Done 2026-11-06 (e68541e):** the agent's *New case* sent the customer contact as its own primary contact, which Dynamics refuses;
the primary contact is now sent only for account cases. Checked again on 2026-11-18: CS-01217-D4L9 and CS-01218-X5C4 were created on
the contact TEST TR06 from the form.

### TR-18 · Email: font, size, colour; links not highlighted (P2, Farhin, 29-10)
**Verified:** *Email the customer* was a plain textarea; its text was sent as `<p>` paragraphs with no link anywhere, and in the
portal's timeline every link in an email or note body read as plain text (the CSS reset sets `text-decoration: inherit`, and the
display cleaner turned `mailto:` into `#`). **Done 2026-11-18:** the composer (`EmailComposer.client.tsx`, SupportParts S31): bold,
italic, underline, lists, link, clear, five fonts, four sizes and six colours, the message on light paper in the email's
Arial; the server keeps an allowlist and links bare addresses (`src/lib/support/email-html.ts`, `tests/int/support-email.int.spec.ts`);
the timeline underlines links, keeps `mailto:` and shows list bullets.

### TR-19 · Email: attach files (P2, Farhin, 29-10)
**Done 2026-11-18:** several files on one email (10, 15 MB in all), each an `activitymimeattachment` on the email before `SendEmail`;
the organisation's blocked extensions, the count and the size are refused in the browser first, then by the server; a refused
attachment deletes the draft again. Server actions and the proxy's body buffer take 16 MB (`next.config.ts`).

### TR-20 · Operating system version (P2, Farhin, 31-10)
**Verified:** the case already has the column `new_linuxosversion` ("Linux( O.S & Version)", 100 characters), used for any OS on the
two UAT cases that carry it ("win8", "Ubuntu OS"). **Done 2026-11-18:** *OS version* on Details, in *Edit details* and on the agent's
new case form; *Operating system* (optional) on the customer's. No schema change.

### TR-21 · Merge one case into another (P2, Farhin, 16-11)
**Done 2026-11-18:** *Merge into another case* (SupportParts S32) calls the platform's `Merge`; the merged case closes as Merged with
`masterid` set and its timeline moves to the case that stays. Only active cases; nothing chosen by default; a picked case plus a typed
number is asked, not guessed. A merged case shows *Merged into* and a *Merged* panel instead of *Reopen*; a customer's link to it
lands on the surviving case.

### TR-22 · Bug ID not saved in Incident ID (P1, reported 2026-11-26)
**Testers said:** "BUG ID not getting added" (field: Incident ID).
**Verified:** Incident ID (`k7_incidentid`) is a secured column in Dynamics: only the field security profiles *Level 2 Users* (one
member) and System Administrator may read, create or update it. Abeed Shaik is in neither; the server log has his create refused
(`0x8004f502`) and the edit after it (`0x8004f507`), and his CS-01224-S2H6 (11:27 IST) has no Incident ID. The whole save was refused
with "Your Dynamics role does not allow this." Module and Sub module are secured the same way, Product version for Level 1 and 2, and
the RFE's YODIZ id for System Administrators only (the RFE edit sent it, unchanged, on every save, so any other agent's RFE save failed).
**Done 2026-11-26:** the portal reads the agent's field rights and switches those fields off with a hint (case Edit details, new case,
RFE forms), names the columns hidden from them under the case facts, never posts a disabled field, and retries a refused write without
the secured columns, naming what was not saved (SupportParts S34; `09` §3, *Field security*). Checked in Chrome on a local instance:
as an admin, *TEST-BG-1* saved on CS-01195-B0Q3; with Abeed's rights, the four fields locked, an OS version change saved and Incident ID
kept, an unchanged save said *Nothing changed.*; the new case and new RFE forms locked; the test values cleared again. Whether agents
should set the Bug ID is D-5: the fix in Dynamics is the profile, not the portal.

### TR-23 · State and City not filtered by letter (P2, reported 2026-11-26)
**Testers said:** "State and City name not filtered with Letter."
**Verified:** both were selects: a letter jumps to the first entry that starts with it, the list never narrows (Tamil Nadu 291 cities,
Andhra Pradesh 453; "che" lands on Chengalpattu). Not caused by the 2026-11-21 select change: the jump works the same in both modes.
UAT also lists most cities twice (its own set and the seeded production set).
**Done 2026-11-26:** State and City are type-to-filter fields (Field *Type to filter*, SupportParts S33): typing narrows the list,
arrows and Enter pick, leaving the field settles on an exact or single match; each city name shows once. Checked in Chrome: "chen" →
Chengalpattu, Chennai, Tiruchendur, Tiruchengode; batman K saved as Tamil Nadu / Chennai (region South) and cleared again in UAT.

### TR-24 · Case summary with the existing notes (P2, Faridha, 26-11)
**Testers said:** "Case summary should be added" (existing notes).
**Verified:** the CRM's case forms carry a *Copilot Summary Section*, and Copilot case summary is on in this CRM (enabled, consent
2024-01-16): it summarises the title, description, product, notes and emails. The portal has no summary. The summary API answers from
outside: `msdyn_CustomApiCustomerServiceCaseSummary` on CS-01195-B0Q3 returned four sentences in 8 s (06:14:57Z), nothing changed.
**Done 2026-11-27** (`09` §3, *Case summary*; SupportParts S37): *Case summary* at the top of the timeline; *Summarise the case* asks
Copilot as the agent (about ten seconds), the summary is kept for every agent who opens the case with who asked and when, flagged when
the case has moved on since, and *Save as a note* keeps it in Dynamics as an internal note. Checked in Chrome on CS-01225-H8W2: summary
at 14:08 IST, saved as a note (08:39:14Z), a new note (08:39:30Z) flagged it as moved on, *Summarise again* (08:39:51Z) took the new note
in. Asking sets *Copilot engaged* on the case (by SYSTEM, 08:38:44Z), as the Hub does.

### TR-25 · Select a template in the email (P2, Farhin, 26-11)
**Testers said:** "Select template option" (email template).
**Verified:** the Hub's email has *Insert Template*; the portal's composer has none. UAT holds five case templates, all Microsoft's from
2018 (New Case Acknowledgement, Closed Case Acknowledgement, Case Auto Response, Case Escalation, Case resolution survey invite).
`InstantiateTemplate` fills one for a case (customer, title, owner, number) without creating a record (06:17:41Z).
**Done 2026-11-27** (`09` §3, *Email templates*; SupportParts S31): a *Template* field at the top of *Email the customer*, case templates
first, then the general ones; *Use template* has Dynamics fill it for the case and replaces the subject and the message, *Undo* puts back
what was there; tables become lines, images and unreadable white text go, and the line under the picker says so. Checked in Chrome on
CS-01220-W4G6 (nothing sent): New Case Acknowledgement filled "A case has been opened for your request" with TEST TR06, the case title,
the owner, the follow-up address as a link and the case number; *Undo* brought back the draft; the survey invite's table came through as
lines with "Support feedback" readable. **Still needed:** the desk's own templates in Dynamics (UAT has only Microsoft's five from 2018):
ask Farhin which replies they send most, write them once in Dynamics, and both the Hub and the portal offer them.

### TR-26 · Notify managers (P1, 26-11)
**Testers said:** six notifications: a fresh email not answered in 4 hours; a pending reply not sent in 30 minutes; a case not picked
from the bin or queue in 5 minutes; a case pending more than 12 hours; a case escalated to an internal team; a Lab sample not closed
in 3 hours.
**Navin decided (2026-11-27):** a notification system like the partner portal's, for every user, not only managers; on the SLA and
KPI targets configured in the portal, no other ad hoc rules; counted in shift working hours; "pending reply" is the customer's
follow-up waiting for our answer; a Lab sample is submitted when the case goes to In Progress-Lab, and leaving the Lab does not close
it; the 12 hours is the SLA's and the KPIs'; email once `SMTP_URL` is set, the bell in the console now.
**Done 2026-11-27** (`09-portal-guide.md` §4c, §4g): shifts replace the business hours; three new clocks with their targets and cards
(follow-up reply 30 min, pick-up from the bin 5 min, Lab sample 180 min); the notification catalogue set per entry on
`/manage/notifications`; the bell and `/support/workspace/notifications`; the watch every minute (`scripts/serve.sh` starts it). How
the six map: fresh email → the first-response clock (its target is the 4 hours, set on the KPI page; automatic acknowledgements no
longer count as an answer); pending reply → the follow-up clock; the bin → the pick-up clock; 12 hours → the resolution clock and the
KPI reports; escalated → *Escalated to an internal team*; Lab → the Lab clock. The fixed prevention rules are gone. To set by the
support lead: the first-response target (60 minutes now), the shifts and their members, the managers on the notifications page.

## 6. Session log
- **2026-10-24 (1)** — Tester notes triaged against code, UAT and the live portal. TR-01 and TR-02 found while
  checking the theme claim. CS-01194-B4N9 moved to In Progress-Support and back to In Progress-Lab to prove status
  writes. This file written. No code changed. **Next:** TR-01 and TR-02 (they change what every tester sees), then
  TR-03 to TR-06 (the contact and case forms), then TR-11 and TR-07.
- **2026-10-24 (2)** — All TR items built and closed. Code: `InitTheme` inline script, `ThemeProvider` on
  `useSyncExternalStore`, the theme pair pressed by CSS before hydration; `customers/forms.tsx` rules, patterns, `carry` and the
  read-back helpers, `checkGeo`, `keep_<field>`; lookups cleared with `@odata.bind: null` for contacts, accounts and cases (UAT
  accepts it; clearing a case's product had silently done nothing); `CustomerAutofill`; `getCaseParties`; incident id and
  *Serial key*; `searchCases`/`casesForCustomer` with counts; `caseStatusLabel`; `Req`/`RequiredNote` and the Field CSS; portal
  labels 12px ink. Found on the way: Cloudflare's email obfuscation through the quick tunnel broke hydration on every page
  showing an email (fixed with `no-transform` on the portal routes); the account page's *New case* link was ignored; "1 cases".
  Delivery: `scripts/serve.sh`, the tunnel now serves `next start`; the brief has the Ctrl+Shift+R line and the current link.
  Verified in Chrome (dev first, then the production build through the tunnel): every *Done when* above; 95 support unit tests
  pass (`support-forms` new, `support-lib` extended), `tsc` clean, `pnpm build` clean. UAT writes, all put back: batman K's
  geography (set, changed, cleared; it had none), CS-01195-B0Q3's serial key and incident id (set, cleared). Left in UAT: the
  contact TEST TR06 (`23aa656b-75cf-f111-a05d-7ced8daf56a6`). Navin chose for D-4: labels now, density later. **Next:** send the
  testers §4 with the new link and ask them to re-check their own notes; D-1 to D-3 with the support lead; U-1.
- **2026-10-24 (3)** — Closing pass after the goal check found three *Done when* gaps. TR-02: fresh Chrome profiles run (see the
  entry), which surfaced the NODE_ENV regression of the switch to `next start` (customer service identity, partner portal);
  fixed with `isDeployed()` and `K7_LOCAL_BUILD=1`, rebuilt, rechecked. TR-13 and TR-15: Navin accepted both on his own review.
  Committed on `support-portal/planning` (not pushed). Then TR-02's check exactly as written: a fresh Chrome profile signed in
  with Microsoft by Navin on the tunnel; the workspace, a case and the new contact form hydrated, no console error.
  **Next:** send §4 to the testers with the new link; D-1 to D-3; U-1.
- **2026-11-18 (4)** — The later notes (§5b). Built: the email composer with formatting and attachments, links and lists readable in
  the timeline, the OS version field, case merge with the customer's redirect, pending labels on *Create case*, *Send email* and
  *Merge case*. Verified in Chrome through the tunnel on the production build (Microsoft door, as Navin): CS-01217-D4L9 and
  CS-01218-X5C4 created on TEST TR06 with an OS version (07:06Z, 07:07Z); OS version edited on CS-01217-D4L9; an empty message and a
  blocked `.exe`, a 16 MB set and an unchosen merge target refused in the browser; a picked case plus a typed number refused by the
  server; an email with bold, red, Georgia, a list, a bare URL, a bare address and an agent link plus two attachments sent from
  CS-01218-X5C4 to `tr06.test@example.com` (07:10:48Z; Pending Send, UAT has no mailbox); CS-01218-X5C4 merged into CS-01217-D4L9
  (07:14:05Z): Merged, `masterid` set, the email and its two attachments now on CS-01217-D4L9. Found in that pass and fixed: Size
  then Font at the caret kept only the font (the composer re-set the selection, which drops the browser's pending style); the
  editor's lists and every link and list in the timeline bodies had lost their markers to the CSS reset, and `mailto:` became `#`;
  a 50-byte file read "0 KB"; *Create case* and *Merge case* took 10 to 20 s with no sign of it. After the rebuild: links underlined
  and `mailto:` kept in the timeline and the customer's conversation, bullets and numbers shown; a second email on CS-01217-D4L9
  (07:17:38Z) stored the 18px Georgia span; *Creating…*, *Sending…* and *Merging…* shown with the button disabled; CS-01219-T7R8
  created (07:18:24Z) and merged into CS-01217-D4L9 by its typed number in lower case (07:18:54Z); the merged CS-01218-X5C4 shows
  *Merged into* and the *Merged* panel. Customer side on a local-only second instance (127.0.0.1:3100, `AUTH_URL` and an empty
  allowlist for it, stopped afterwards; the tunnel's allowlist does not cover example.com): TEST TR06 signed in with the code from
  that instance's mail log, opened CS-01218-X5C4 and landed on CS-01217-D4L9 with the joined-cases line; CS-01220-W4G6 raised from
  the customer form (07:21:25Z) stored "Ubuntu 22.04 LTS". Light theme: the message paper took a hairline frame (it was the page's
  colour); at 390px in a frame nothing overflows. No console errors. The tester server was rebuilt three times (down 07:04:17 to
  07:05:01Z, 07:15:40 to 07:16:15Z, 07:22:22 to 07:22:54Z). 111 support tests pass (`support-email` new), `tsc` and lint clean.
  Left in UAT: CS-01217-D4L9 (open), CS-01218-X5C4 and CS-01219-T7R8 (Merged), CS-01220-W4G6 (open), the two Pending Send emails to
  `tr06.test@example.com`. Not committed. **Next:** the reply to the testers for TR-16 to TR-21; D-1 to D-3; U-1.
- **2026-11-26** — Two new tester notes, TR-22 and TR-23, both valid. TR-22 is Dynamics field security (Incident ID, Module, Sub
  module, Product version on the case; YODIZ id on RFEs and defects): fields locked for agents without the profile, the refused write
  retried without the secured columns, the RFE save no longer sends an unchanged YODIZ id. TR-23: State and City as type-to-filter
  fields, each UAT city name once. Checked on a local probe instance (127.0.0.1:3200, stopped afterwards; Abeed's rights through a
  temporary local override, removed): CS-01195-B0Q3 Incident ID set and cleared (07:18:01Z, 07:19:11Z), OS version set and cleared,
  batman K's state and city set and cleared (07:17:00Z, 07:17:03Z). New tests `support-field-security`, `support-filter-options`.
  The reply to the testers is in §4. **Next:** D-5 with the support lead (`11` item 29b).
- **2026-11-27** — Three new notes: TR-24 (case summary) and TR-25 (email templates) checked and planned, not built; TR-26 built as
  the support notification system on Navin's answers (see the entry). Checked on a local probe instance (127.0.0.1:3200, stopped
  afterwards) against UAT with the watch called every minute: CS-01195-B0Q3 to In Progress-Lab (06:55:19Z) and the K7 Level2 team
  (06:55:24Z), a portal-reply note added (06:55:30Z); the escalation, the customer's message, the pick-up clock at risk (06:59:54Z) and
  past target (07:00:56Z) were each told once; back to Faridha Banu (07:03:17Z) and Open (07:03:19Z), the note deleted (07:03:23Z), the
  test rows and settings cleared in Payload. Summary and template APIs called once each on UAT (06:14:57Z, 06:17:41Z), nothing written.
  New tests `support-notify`, shift tests in `support-sla`. **Next:** TR-25 and TR-24; the support lead sets the shifts, their
  members, the managers and the first-response target.
- **2026-11-27 (2)** — Every TR-26 notification verified in Chrome end to end (`09-portal-guide.md` §4g has the times): first response,
  resolution, follow-up, pick-up and Lab clocks at risk and past target; the customer wrote; escalated; assigned; low rating; the desk and
  personal KPI reports at a shift's end. Found and fixed on the way: notifications of a clock just past its deadline read "overdue 0 min"
  (now "just overdue"); the at-risk board listed only SLA notifications (now everything told, to whom). Left in UAT: CS-01225-H8W2
  (TEST TR06, Closed-Remote). Testers' server rebuilt (down 08:16:19 to 08:16:47Z).
- **2026-11-27 (3)** — TR-25 built: email templates on *Email the customer* (see the entry). The five UAT case templates filled once each
  for CS-01225-H8W2 to take the real HTML as test data (08:28Z, nothing created); checked in Chrome on CS-01220-W4G6, nothing sent. Found on
  the way: the survey invite's white banner text vanished once its blue cell was dropped (now its colour goes). `support-email` +4 tests.
  **Next:** the desk's templates in Dynamics (Farhin); TR-24.
- **2026-11-27 (4)** — TR-24 built: the case summary on the timeline (see the entry), checked in Chrome on CS-01225-H8W2 (two notes
  added there, the summary kept in Payload). A Dataverse read timed out once from this machine during the check (the network, not the
  code; the page rendered). New tests `support-summary`. **Next:** production's Copilot setting and an agent's rights (`11` item 29d);
  the desk's email templates in Dynamics; the tester reply for TR-24 to TR-26.
