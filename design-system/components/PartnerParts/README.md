# PartnerParts
The partner-portal parts from section 10 (reference CSS: `src/app/(partner)/partner.css`, loaded over section 09's `portal.css`, whose chrome, forms, flashes and ledgers the partner portal shares). Two audiences again: partner users get the customer's sheet rhythm, fewer and larger things; K7 staff get the ledger. Built from M1 (2026-10-22); parts are added as the milestones in `docs/partner-portal/02-build-plan.md` land.

**P1 Partner ID (`pid`)** the identifier reads like the case number: `K7P-` dim, the number first and full weight, mono (`Pid`, on `tid`); `tid-display` is the large form on the partner's home and on an organisation page. Deal IDs (`K7D-`) and certificate IDs (`K7P-C-`, `K7P-O-`) take the same shape when they arrive.

**P2 Organisation state (`OrgStateTag`, `TypeTag`)** a `Tag` for the organisation: Approved solid, Suspended on `tag-signal`, because that is the one state that stops the partner. The partner type is a quiet outlined tag; no hue per type.

**P3 Status strip (`pstrip`)** the organisation's facts on hairlines, read before anything else on a home page: a `dl` of label-over-value cells in a row (type, status, your roles, certificate; on the K7 side: signed in as, roles, unread, staff listed), divided by hairlines, stacked on a phone. Values at 17px; a tag sits as a value.

**P4 The bell (`bell`, `bell-n`) and its rows (`ntf`)** the bell is the word *Notifications* in the header with the unread count as a block on `signal`, zero-padded (`03`), only while something is unread; on a phone the word hides and the block stays. The rows: relative time in mono on the left, the subject in semibold with the pixel before it while unread, the body in `muted` beneath; read rows drop to medium weight. The same list carries the organisation's recent record on the home page (date, action, from → to, who).

**P5 Role tags (`roles`, `tag-dashed`)** a person's roles as outlined tags in a row: Partner Admin · Sales · Technical for partner users, the five K7 roles for staff. A role is not a state, so nothing inverts; "No role" is dashed.

**P6 Partner home (`phome`)** the sheet after the strip: the latest notifications and the record in the main column, the organisation's facts (`meta-rows`) in the 360px side column from 1080px. Deals, collateral and schemes join the column as their milestones land.

**Doors** the sign-in page is section 09's `signin-split` with the partner door (email → code) and the K7 door (Microsoft) side by side; the one the visitor came for leads.
