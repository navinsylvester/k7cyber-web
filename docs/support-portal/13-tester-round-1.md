# Tester round 1: findings and the fix list

Four junior support agents tested the agent workspace on UAT through the Cloudflare tunnel (phase 1 brief,
`12-tester-brief.md`) and sent their notes on 2026-10-24. Every claim was checked the same day against the code,
UAT through `scripts/dataverse-probe.py`, and the live portal in Chrome (Microsoft door, as Navin). This file is
the work list that came out of it and the state across sessions.

**State 2026-10-24 (session 3): closed.** Every TR item passed its *Done when* in Chrome; TR-13 and TR-15, whose checks named a
tester, were accepted on Navin's own review the same day. What stays open is outside this list's fixes and has an owner: D-1 to
D-3 (support lead), D-4's Compact density (Navin, later), U-1 (UAT roles). The reply to testers is §4.

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
| D-1 | Fill the customer and serial key from the registered mobile | request | — | decide |
| D-2 | "Customer type: consumer or enterprise" on the case | request | — | decide |
| D-3 | Rename field titles | request | — | decide |
| D-4 | Smaller text, denser layout | request | — | decided 2026-10-24: labels now (TR-13), Compact density later |
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

## 5. Evidence kept
UAT counts used above, read with the probe on 2026-10-24: 1,438 cases, 214 active; 1,370 with a case email; 1,198
contact customers whose contact has an account; 142 cases (22 active) owned by Navin through the seed's owner
fallback; 172 with an incident id; 5 with status reason 696720006. Chrome: dev chunks served with
`Cache-Control: no-cache, must-revalidate` and a weak ETag, through the tunnel `cf-cache-status: DYNAMIC`.

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
