#!/usr/bin/env python3
"""Seed a development sandbox from production Dataverse: full reference tables plus the
last N months of cases with their contacts, accounts, notes and activities.

Reads from SOURCE (production) with your own account, writes to TARGET (a sandbox made
with a *Minimal copy*, so schema, views, apps already exist). Record GUIDs and case
numbers are preserved so lookups resolve. Nothing is ever written to production: the
script refuses a target whose host is the production org.

  python3 -I scripts/dataverse-seed.py --target https://<sandbox>.crm8.dynamics.com --months 6 --dry-run
  python3 -I scripts/dataverse-seed.py --target https://<sandbox>.crm8.dynamics.com --months 6
Options: --since YYYY-MM-DD (instead of --months), --max-cases N, --no-emails,
         --attachments-max-mb 2 (default 0 = notes keep text only), --workers 4, --report path
Target-aware mapping (added for the drifted UAT org): a choice value the target lacks is dropped and
counted (skipped_options); a number written into a text column becomes its production label
(k7_salespersonname); lookups bind only to rows that exist in the target; user lookups are mapped by
UPN; open emails never land as Pending Send (they become drafts); cases are resolved/cancelled only
after their notes and activities exist; products still in Draft after the create are published when
active in production (a target that creates products in the active state reports published_products 0);
rows whose production owner has no security role in the target fall back to the seeding user as owner
(owner_fallbacks); a re-run skips existing rows and repairs missing case product, orphaned notes/emails
and emails left in Pending Send.

Auth: device-code sign-in once (same cache as dataverse-probe.py: scripts/.token_cache.json);
the refresh token is redeemed separately for the source and the target org.
Env (optional, from .env): DV_TENANT_ID, SEED_SOURCE_URL (default production).
"""
import os, sys, json, time, argparse, datetime as dt, urllib.request, urllib.parse, urllib.error
import http.client
import socket as _socket
_gai = _socket.getaddrinfo
def _gai_v4_first(*a, **k):   # the IPv6 path to Microsoft is unreliable from the dev network: try IPv4 first, IPv6 as fallback
    res = _gai(*a, **k); return sorted(res, key=lambda r: r[0] != _socket.AF_INET)
_socket.getaddrinfo = _gai_v4_first

from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_CACHE = os.path.join(HERE, ".token_cache.json")
PUBLIC_CLIENT = "51f81489-12ee-4a9e-aaae-a2591f45987d"
PRODUCTION_HOSTS = {"k7crm.crm8.dynamics.com", "k7crm.api.crm8.dynamics.com"}
WRITE_HDR = {"MSCRM.SuppressDuplicateDetection": "true"}   # the target mirrors production by id; its duplicate-detection rules must not reject rows that share a name

def load_dotenv(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.split(" #", 1)[0].strip().strip('"').strip("'"))
load_dotenv()
TENANT = os.environ.get("DV_TENANT_ID", "005ef94f-7dbd-4d0e-a29a-494e2a63d911")

# ------------------------------------------------------------------ auth
_tokens = {}
def _form(url, fields):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e: return json.loads(e.read().decode(errors="ignore") or "{}")

def _cache(): return json.load(open(TOKEN_CACHE)) if os.path.exists(TOKEN_CACHE) else {}
def _save_refresh(t):
    c = _cache(); c["refresh_token"] = t.get("refresh_token", c.get("refresh_token")); c.setdefault("exp", 0)
    c.setdefault("access_token", ""); json.dump(c, open(TOKEN_CACHE, "w")); os.chmod(TOKEN_CACHE, 0o600)

def token(org):
    t = _tokens.get(org)
    if t and time.time() < t["exp"] - 300: return t["access_token"]
    scope = f"{org}/user_impersonation offline_access"
    c = _cache()
    if c.get("refresh_token"):
        r = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
                  {"grant_type": "refresh_token", "client_id": PUBLIC_CLIENT, "refresh_token": c["refresh_token"], "scope": scope})
        if "access_token" in r:
            _save_refresh(r); _tokens[org] = {"access_token": r["access_token"], "exp": time.time() + int(r["expires_in"])}
            return r["access_token"]
    dc = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/devicecode", {"client_id": PUBLIC_CLIENT, "scope": scope})
    if "device_code" not in dc: raise SystemExit(f"device code failed: {dc}")
    print("SIGN-IN REQUIRED: " + dc["message"], file=sys.stderr, flush=True)
    deadline = time.time() + int(dc.get("expires_in", 900))
    while time.time() < deadline:
        time.sleep(int(dc.get("interval", 5)))
        r = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
                  {"grant_type": "urn:ietf:params:oauth:grant-type:device_code", "client_id": PUBLIC_CLIENT, "device_code": dc["device_code"]})
        if "access_token" in r:
            _save_refresh(r); _tokens[org] = {"access_token": r["access_token"], "exp": time.time() + int(r["expires_in"])}
            return r["access_token"]
        if r.get("error") not in ("authorization_pending", "slow_down"): raise SystemExit(f"sign-in failed: {r}")
    raise SystemExit("sign-in timed out")

# ------------------------------------------------------------------ http
class DvError(Exception): pass

def call(org, method, path, body=None, prefer=None, headers=None):
    url = path if path.startswith("http") else f"{org}/api/data/v9.2/{path}"
    url = urllib.parse.quote(url, safe=":/?=&$'(),@;+%!*[]")
    h = {"Authorization": f"Bearer {token(org)}", "OData-MaxVersion": "4.0", "OData-Version": "4.0", "Accept": "application/json",
         "Content-Type": "application/json; charset=utf-8", "Prefer": prefer or 'odata.include-annotations="*"'}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=120) as r:
                raw = r.read(); return (json.loads(raw) if raw else {}), dict(r.headers)
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="ignore")
            if e.code in (429, 503) and attempt < 9:
                time.sleep(float(e.headers.get("Retry-After", min(60, 2 ** attempt)))); continue
            raise DvError(f"{e.code} {method} {path[:120]}: {txt[:400]}") from None
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:   # includes connection resets   # DNS blips and dropped connections: wait up to ~5 minutes in total
            if attempt < 9: time.sleep(min(60, 2 ** attempt)); continue
            raise DvError(f"network {method} {path[:120]}: {e}") from None

def get_all(org, path, page=1000, limit=None):
    rows, nxt = [], path
    while nxt:
        p, _ = call(org, "GET", nxt, prefer=f'odata.maxpagesize={page},odata.include-annotations="*"')
        rows += p.get("value", []); nxt = p.get("@odata.nextLink")
        if limit and len(rows) >= limit: return rows[:limit]
    return rows

# ------------------------------------------------------------------ metadata (from TARGET)
class Meta:
    def __init__(self, org): self.org, self._e, self._a, self._r = org, {}, {}, {}
    def entity(self, name):
        if name not in self._e:
            d, _ = call(self.org, "GET", f"EntityDefinitions(LogicalName='{name}')?$select=EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute")
            self._e[name] = d
        return self._e[name]
    def attrs(self, name):
        if name not in self._a:
            rows = get_all(self.org, f"EntityDefinitions(LogicalName='{name}')/Attributes?$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate,AttributeOf")
            self._a[name] = {a["LogicalName"]: a for a in rows}
        return self._a[name]
    def options(self, name):  # attribute -> set of allowed choice values in the target
        if name not in getattr(self, "_o", {}):
            self._o = getattr(self, "_o", {}); out = {}
            for kind in ("PicklistAttributeMetadata", "StatusAttributeMetadata", "StateAttributeMetadata"):
                for a in get_all(self.org, f"EntityDefinitions(LogicalName='{name}')/Attributes/Microsoft.Dynamics.CRM.{kind}?$select=LogicalName&$expand=OptionSet($select=Options)"):
                    out[a["LogicalName"]] = {o["Value"] for o in (a.get("OptionSet") or {}).get("Options", [])}
            self._o[name] = out
        return self._o[name]
    def maxlen(self, name):  # text attribute -> MaxLength in the target
        if name not in getattr(self, "_m", {}):
            self._m = getattr(self, "_m", {})
            rows = get_all(self.org, f"EntityDefinitions(LogicalName='{name}')/Attributes/Microsoft.Dynamics.CRM.StringAttributeMetadata?$select=LogicalName,MaxLength")
            self._m[name] = {a["LogicalName"]: a.get("MaxLength") for a in rows}
        return self._m[name]
    def rels(self, name):  # (referencing attribute, referenced entity) -> navigation property
        if name not in self._r:
            rows = get_all(self.org, f"EntityDefinitions(LogicalName='{name}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName")
            self._r[name] = {(r["ReferencingAttribute"], r["ReferencedEntity"]): r["ReferencingEntityNavigationPropertyName"] for r in rows}
        return self._r[name]

SKIP_ALWAYS = {"createdon", "modifiedon", "createdby", "modifiedby", "createdonbehalfby", "modifiedonbehalfby", "owningbusinessunit",
               "owninguser", "owningteam", "versionnumber", "importsequencenumber", "timezoneruleversionnumber", "utcconversiontimezonecode",
               "exchangerate", "processid", "stageid", "traversedpath", "onholdtime", "lastonholdtime", "entityimage", "entityimage_url",
               "entityimage_timestamp", "entityimageid", "statecode", "statuscode", "overriddencreatedon", "msdyn_precreatenotesid",
               "msdyn_precreateattachmentsid", "slainvokedid", "firstresponsebykpiid", "resolvebykpiid", "caseage", "lastinteraction",
               "nextsla", "k7_today", "emailreminderexpirytime", "activityadditionalparams", "safedescription", "mimetype_unused"}
PASS_THROUGH_BY_NAME = {"transactioncurrency": "isocurrencycode", "uom": "name", "uomschedule": "name", "subject": "title", "languagelocale": "localeid"}
KEY_ATTR = {"product": "productnumber"}                       # key used to find a same-key row in the target when a create conflicts (default: primary name)
PARENT_REQUIRED = {"annotation": "objectid_", "email": "regardingobjectid_", "phonecall": "regardingobjectid_", "task": "regardingobjectid_"}   # never create orphans
REPAIR = {"incident": ("productid", "_productid_value"), "annotation": ("objectid", "_objectid_value"), "email": ("regardingobjectid", "_regardingobjectid_value")}  # fill these lookups on existing rows that lack them

# ------------------------------------------------------------------ plan
REFERENCE = ["alletec_country", "k7_region", "k7_state", "alletec_city", "subject", "new_issuecategory", "new_subcategory", "product", "knowledgearticle"]
TRANSACTIONAL = ["account", "contact", "incident", "annotation", "email", "phonecall", "task", "k7_rfe", "k7_defect"]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True); ap.add_argument("--source", default=os.environ.get("SEED_SOURCE_URL", "https://k7crm.crm8.dynamics.com"))
    ap.add_argument("--months", type=int, default=6); ap.add_argument("--since")
    ap.add_argument("--max-cases", type=int); ap.add_argument("--no-emails", action="store_true")
    ap.add_argument("--attachments-max-mb", type=float, default=0); ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--report", default="migration/dataverse-seed-report.json")
    a = ap.parse_args()
    src, tgt = a.source.rstrip("/"), a.target.rstrip("/")
    if urllib.parse.urlparse(tgt).hostname in PRODUCTION_HOSTS or tgt == src:
        raise SystemExit("refusing: target is the production org (or equals the source)")
    since = a.since or (dt.date.today() - dt.timedelta(days=30 * a.months)).isoformat()
    since_iso = f"{since}T00:00:00Z"
    print(f"source {src}\ntarget {tgt}\ncases created on/after {since}  dry_run={a.dry_run}", file=sys.stderr)

    # ---------- read source ----------
    data = {}
    for e in REFERENCE:
        es = {"alletec_country": "alletec_countries", "k7_region": "k7_regions", "k7_state": "k7_states", "alletec_city": "alletec_cities",
              "subject": "subjects", "new_issuecategory": "new_issuecategories", "new_subcategory": "new_subcategories",
              "product": "products", "knowledgearticle": "knowledgearticles"}[e]
        data[e] = get_all(src, es)
        print(f"  {e}: {len(data[e])}", file=sys.stderr)
    cases = get_all(src, f"incidents?$filter=createdon ge {since_iso}&$orderby=createdon asc", limit=a.max_cases)
    data["incident"] = cases; case_ids = {c["incidentid"] for c in cases}
    print(f"  incident: {len(cases)}", file=sys.stderr)

    contact_ids, account_ids = set(), set()
    def lk(rec, attr):
        v = rec.get(f"_{attr}_value"); t = rec.get(f"_{attr}_value@Microsoft.Dynamics.CRM.lookuplogicalname")
        return (v, t) if v else (None, None)
    for c in cases:
        for attr in ("customerid", "primarycontactid", "responsiblecontactid", "msa_partnercontactid", "msa_partnerid"):
            v, t = lk(c, attr)
            if t == "contact": contact_ids.add(v)
            elif t == "account": account_ids.add(v)
    def fetch_by_ids(entityset, idattr, ids):
        ids = list(ids); out = []
        for i in range(0, len(ids), 40):
            f = " or ".join(f"{idattr} eq {x}" for x in ids[i:i + 40]); out += get_all(src, f"{entityset}?$filter={f}")
        return out
    contacts = fetch_by_ids("contacts", "contactid", contact_ids)
    for ct in contacts:
        v, t = lk(ct, "parentcustomerid")
        if t == "account": account_ids.add(v)
    accounts = fetch_by_ids("accounts", "accountid", account_ids)
    extra_acc = {lk(x, "parentaccountid")[0] for x in accounts} - account_ids - {None}
    if extra_acc: accounts += fetch_by_ids("accounts", "accountid", extra_acc); account_ids |= extra_acc
    extra_ct = {lk(x, "primarycontactid")[0] for x in accounts} - contact_ids - {None}
    if extra_ct: contacts += fetch_by_ids("contacts", "contactid", extra_ct); contact_ids |= extra_ct
    data["account"], data["contact"] = accounts, contacts
    print(f"  contact: {len(contacts)}  account: {len(accounts)}", file=sys.stderr)

    notes = get_all(src, f"annotations?$filter=objecttypecode eq 'incident' and createdon ge {since_iso}")
    data["annotation"] = [n for n in notes if n.get("_objectid_value") in case_ids]
    acts = {}
    for e, es in (("email", "emails"), ("phonecall", "phonecalls"), ("task", "tasks")):
        if e == "email" and a.no_emails: data[e] = []; continue
        rows = get_all(src, f"{es}?$filter=createdon ge {since_iso} and _regardingobjectid_value ne null")
        data[e] = [r for r in rows if r.get("_regardingobjectid_value") in case_ids]
    data["k7_rfe"] = get_all(src, "k7_rfes"); data["k7_defect"] = get_all(src, "k7_defects")
    for e in ("annotation", "email", "phonecall", "task", "k7_rfe", "k7_defect"): print(f"  {e}: {len(data[e])}", file=sys.stderr)
    if a.dry_run:
        print(json.dumps({e: len(v) for e, v in data.items()}, indent=1)); return

    # ---------- write target ----------
    meta = Meta(tgt)
    me, _ = call(tgt, "GET", "WhoAmI"); default_owner = me["UserId"]
    tgt_users = {u["domainname"].lower(): u["systemuserid"] for u in get_all(tgt, "systemusers?$select=systemuserid,domainname&$filter=isdisabled eq false") if u.get("domainname")}
    src_users = {u["systemuserid"]: (u.get("domainname") or "").lower() for u in get_all(src, "systemusers?$select=systemuserid,domainname")}
    def map_owner(src_id):
        return tgt_users.get(src_users.get(src_id, ""), default_owner) if src_id else default_owner
    passthrough = {}
    for ent, nameattr in PASS_THROUGH_BY_NAME.items():
        es = meta.entity(ent)["EntitySetName"]; pid = meta.entity(ent)["PrimaryIdAttribute"]
        try:
            tmap = {r.get(nameattr): r[pid] for r in get_all(tgt, f"{es}?$select={nameattr}")}
            smap = {r[pid]: r.get(nameattr) for r in get_all(src, f"{es}?$select={nameattr}")}
            passthrough[ent] = {sid: tmap.get(n) for sid, n in smap.items()}
        except DvError as ex: print(f"  passthrough {ent} skipped: {ex}", file=sys.stderr)

    report = {"since": since, "target": tgt, "entities": {}, "skipped_lookups": Counter(), "skipped_options": Counter(), "owner_fallbacks": Counter(), "repaired": Counter(),
              "emails_pending_cancelled": 0, "deferred_patches": 0, "closed": {}, "published_products": 0, "errors": defaultdict(list)}
    null_ids = {}                # entity -> ids of existing target rows in the slice whose REPAIR lookup is empty
    done, deferred = set(), []   # deferred: (entityset, id, {nav@odata.bind: ref})
    ok_ids = defaultdict(set)    # entity -> ids that exist in the target (created now or already there)
    remap = defaultdict(dict)    # entity -> {production id: target id} when the row exists in the target under another id (alternate key on the name)
    close_later = []             # incidents resolved/cancelled after their notes and activities exist
    order = REFERENCE + TRANSACTIONAL
    seeded_sets = {e: meta.entity(e)["EntitySetName"] for e in order}

    def build(e, rec):
        attrs, rels = meta.attrs(e), meta.rels(e); pid = meta.entity(e)["PrimaryIdAttribute"]
        opts, lens = meta.options(e), meta.maxlen(e)
        body, later = {pid: rec[pid]}, {}
        for k, v in rec.items():
            if "@" in k or v is None or k == pid: continue
            if k.startswith("_") and k.endswith("_value"):
                attr = k[1:-6]; t = rec.get(f"{k}@Microsoft.Dynamics.CRM.lookuplogicalname")
                nav = rels.get((attr, t))
                if attr == "ownerid": body["ownerid@odata.bind"] = f"/systemusers({map_owner(v)})"; continue
                if not nav: report["skipped_lookups"][f"{e}.{attr}"] += 1; continue
                if t == "systemuser":
                    mapped = tgt_users.get(src_users.get(v, ""))
                    if mapped: body[f"{nav}@odata.bind"] = f"/systemusers({mapped})"
                    else: report["skipped_lookups"][f"{e}.{attr}"] += 1
                    continue
                if t in seeded_sets:
                    v2 = remap[t].get(v, v)
                    if v2 in ok_ids[t]: body[f"{nav}@odata.bind"] = f"/{seeded_sets[t]}({v2})"
                    elif t not in done: later[f"{nav}@odata.bind"] = (t, v)   # target entity not seeded yet (or self-reference): resolve at the end
                    else: report["skipped_lookups"][f"{e}.{attr}"] += 1       # referenced row failed or is missing in the target
                elif t in passthrough and passthrough[t].get(v):
                    body[f"{nav}@odata.bind"] = f"/{meta.entity(t)['EntitySetName']}({passthrough[t][v]})"
                else: report["skipped_lookups"][f"{e}.{attr}"] += 1
                continue
            m = attrs.get(k)
            if k in SKIP_ALWAYS or not m or not m.get("IsValidForCreate") or m.get("AttributeOf") or m["AttributeType"] in ("Virtual", "EntityName"): continue
            if k.endswith("_base") and m["AttributeType"] == "Money": continue
            if m["AttributeType"] in ("Picklist", "Status", "State") and k in opts and v not in opts[k]:
                report["skipped_options"][f"{e}.{k}"] += 1; continue           # choice value the target does not have
            if m["AttributeType"] in ("String", "Memo") and not isinstance(v, str):
                v = rec.get(f"{k}@OData.Community.Display.V1.FormattedValue") or str(v)   # e.g. production picklist -> target text
            if m["AttributeType"] == "String" and isinstance(v, str) and lens.get(k) and len(v) > lens[k]: v = v[:lens[k]]
            body[k] = v
        if rec.get("createdon"): body["overriddencreatedon"] = rec["createdon"]
        return body, later

    def post_state(e, rec, es, rid):
        sc, st = rec.get("statecode"), rec.get("statuscode")
        if e == "incident":
            if sc == 1: call(tgt, "POST", "CloseIncident", {"IncidentResolution": {"subject": "Seeded (resolved in production)", "incidentid@odata.bind": f"/incidents({rid})"}, "Status": st})
            elif sc == 2: call(tgt, "PATCH", f"incidents({rid})", {"statecode": 2, "statuscode": st}, headers={"If-Match": "*", **WRITE_HDR})
        elif e == "product": return                                   # published separately; retired products stay drafts
        elif e == "email" and st in (6, 7): call(tgt, "PATCH", f"{es}({rid})", {"statecode": 2, "statuscode": 5}, headers={"If-Match": "*", **WRITE_HDR})   # Pending Send/Sending -> Canceled: a sandbox must never send them
        elif sc not in (None, 0):
            call(tgt, "PATCH", f"{es}({rid})", {"statecode": sc, "statuscode": st}, headers={"If-Match": "*", **WRITE_HDR})

    opts_inc = meta.options("incident")
    def seed_one(e, es, rec):
        pid = meta.entity(e)["PrimaryIdAttribute"]; rid = rec[pid]
        try:
            body, later = build(e, rec)
            if e == "annotation" and rec.get("filename"):
                mb = (rec.get("filesize") or 0) / 1e6
                if a.attachments_max_mb and mb <= a.attachments_max_mb:
                    full, _ = call(src, "GET", f"annotations({rid})?$select=documentbody"); body["documentbody"] = full.get("documentbody")
                else:
                    for k in ("filename", "mimetype", "filesize", "isdocument", "documentbody"): body.pop(k, None)
                    body["notetext"] = (rec.get("notetext") or "") + f"\n[attachment omitted in seed: {rec['filename']}]"
            if e == "incident": body.setdefault("statuscode", rec.get("statuscode") if rec.get("statecode") == 0 else 696720000)
            elif e not in ("incident", "product") and rec.get("statecode") == 0 and rec.get("statuscode") is not None: body["statuscode"] = rec["statuscode"]
            if e == "email" and rec.get("statecode") == 0 and body.get("statuscode") in (6, 7): body["statuscode"] = 1   # never Pending Send in the sandbox
            if e == "incident" and body.get("statuscode") not in opts_inc.get("statuscode", {body.get("statuscode")}): body["statuscode"] = 696720000
            if e in PARENT_REQUIRED and not any(k.startswith(PARENT_REQUIRED[e]) for k in body): return "skipped_no_parent"
            try:
                try: call(tgt, "POST", es, body, prefer="return=minimal", headers=WRITE_HDR)
                except DvError as ex:
                    me_ref = f"/systemusers({default_owner})"
                    if "Read Privilege Check For Owner" not in str(ex) or body.get("ownerid@odata.bind") == me_ref: raise
                    body["ownerid@odata.bind"] = me_ref; report["owner_fallbacks"][e] += 1    # the production owner has no security role in the target
                    call(tgt, "POST", es, body, prefer="return=minimal", headers=WRITE_HDR)
                if e == "incident": close_later.append((rec, es, rid))
                else: post_state(e, rec, es, rid)
                result = "created"; ok_ids[e].add(rid)
            except DvError as ex:
                msg = str(ex)
                if "already exists" not in msg and "conflicts with" not in msg and "duplicate" not in msg.lower(): raise
                try: call(tgt, "GET", f"{es}({rid})?$select={pid}"); result = "existing"; ok_ids[e].add(rid)
                except DvError:                       # same key (name / product number) under another id in the target: point lookups at that row
                    keyattr = KEY_ATTR.get(e) or meta.entity(e).get("PrimaryNameAttribute"); nm = rec.get(keyattr) if keyattr else None
                    hit = get_all(tgt, f"{es}?$select={pid}&$filter={keyattr} eq '{str(nm).replace(chr(39), chr(39)*2)}'&$top=1") if nm else []
                    if not hit: raise
                    remap[e][rid] = hit[0][pid]; ok_ids[e].add(hit[0][pid]); result = "remapped"
            if result == "existing" and e in REPAIR and rid in null_ids.get(e, set()):   # fill the lookup an earlier run could not resolve
                attr, valattr = REPAIR[e]; v = rec.get(valattr); t = rec.get(f"{valattr}@Microsoft.Dynamics.CRM.lookuplogicalname"); nav = meta.rels(e).get((attr, t))
                if v and nav and t in seeded_sets:
                    v2 = remap[t].get(v, v)
                    if v2 in ok_ids[t]:
                        call(tgt, "PATCH", f"{es}({rid})", {f"{nav}@odata.bind": f"/{seeded_sets[t]}({v2})"}, headers={"If-Match": "*", **WRITE_HDR}); report["repaired"][f"{e}.{attr}"] += 1
            if later: deferred.append((es, rid, later))
            return result
        except DvError as ex:
            report["errors"][e].append(str(ex)[:300]); return "failed"

    for e in order:
        rows = data.get(e, []); es = seeded_sets[e]
        if e in ("account", "contact", "product", "k7_state", "alletec_city", "k7_region"):  # parents before children where cheap
            rows = sorted(rows, key=lambda r: ((r.get("productstructure") != 2) if e == "product" else 0, r.get("createdon") or ""))
        meta.attrs(e); meta.rels(e)
        if e in REPAIR:
            pid_ = meta.entity(e)["PrimaryIdAttribute"]
            null_ids[e] = {r[pid_] for r in get_all(tgt, f"{es}?$select={pid_}&$filter=createdon ge {since_iso} and {REPAIR[e][1]} eq null")}
            if null_ids[e]: print(f"  {e}: {len(null_ids[e])} existing rows lack {REPAIR[e][0]} (repaired when resolvable)", file=sys.stderr)
        if e == "email":   # emails an earlier run left in Pending Send must not stay sendable
            pend = get_all(tgt, f"emails?$select=activityid&$filter=createdon ge {since_iso} and statuscode eq 6")
            def cancel(r):
                try: call(tgt, "PATCH", f"emails({r['activityid']})", {"statecode": 2, "statuscode": 5}, headers={"If-Match": "*", **WRITE_HDR}); return True
                except DvError as ex: report["errors"]["email_cancel"].append(str(ex)[:300]); return False
            with ThreadPoolExecutor(max_workers=a.workers) as ex: report["emails_pending_cancelled"] = sum(1 for ok in ex.map(cancel, pend) if ok)
            if pend: print(f"  email: {report['emails_pending_cancelled']} of {len(pend)} Pending Send emails cancelled", file=sys.stderr)
        c = Counter()
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            for r in ex.map(lambda rec: seed_one(e, es, rec), rows): c[r] += 1
        done.add(e); report["entities"][e] = dict(c)
        print(f"  {e}: {dict(c)}", file=sys.stderr)
        if e == "product":   # products are created as drafts; publish the ones active in production (families first, already sorted)
            drafts = {r["productid"] for r in get_all(tgt, "products?$select=productid&$filter=statecode eq 2")}
            def publish(rec):
                if rec.get("statecode") != 0 or remap["product"].get(rec["productid"], rec["productid"]) not in drafts: return False
                try: call(tgt, "POST", "PublishProductHierarchy", {"Target": {"@odata.type": "Microsoft.Dynamics.CRM.product", "productid": rec["productid"]}}); return True
                except DvError as ex:
                    if "already" in str(ex).lower() or "Active" in str(ex): return True
                    report["errors"]["product_publish"].append(str(ex)[:200]); return False
            fams = [r for r in rows if r.get("productstructure") == 2]; rest = [r for r in rows if r.get("productstructure") != 2]
            n = sum(1 for r in fams if publish(r))
            with ThreadPoolExecutor(max_workers=a.workers) as ex: n += sum(1 for ok in ex.map(publish, rest) if ok)
            report["published_products"] = n; print(f"  product: published {n}", file=sys.stderr)

    # deferred lookups (self references, account<->contact cycles) - only to rows that exist in the target
    def patch_deferred(item):
        es, rid, body = item; resolved = {}
        for k, (t, v) in body.items():
            v2 = remap[t].get(v, v)
            if v2 in ok_ids[t]: resolved[k] = f"/{seeded_sets[t]}({v2})"
            else: report["skipped_lookups"][f"deferred.{k.split('@')[0]}"] += 1
        body = resolved
        if not body: return False
        try: call(tgt, "PATCH", f"{es}({rid})", body, headers={"If-Match": "*", **WRITE_HDR}); return True
        except DvError as ex: report["errors"]["deferred"].append(str(ex)[:300]); return False
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        report["deferred_patches"] = sum(1 for ok in ex.map(patch_deferred, deferred) if ok)

    # resolve / cancel cases last, so notes and activities were created against open cases
    def close_one(item):
        rec, es, rid = item
        if rec.get("statecode") in (None, 0): return "open"
        try: post_state("incident", rec, es, rid); return "closed"
        except DvError as ex: report["errors"]["close"].append(str(ex)[:300]); return "failed"
    cc = Counter()
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for r in ex.map(close_one, close_later): cc[r] += 1
    report["closed"] = dict(cc); print(f"  incident state: {dict(cc)}", file=sys.stderr)
    report["skipped_lookups"] = dict(report["skipped_lookups"]); report["skipped_options"] = dict(report["skipped_options"]); report["remapped"] = {e: len(m) for e, m in remap.items() if m}
    report["owner_fallbacks"] = dict(report["owner_fallbacks"]); report["repaired"] = dict(report["repaired"])
    report["errors"] = {k: v[:20] for k, v in report["errors"].items()}
    os.makedirs(os.path.dirname(a.report) or ".", exist_ok=True); json.dump(report, open(a.report, "w"), indent=1)
    print("report written to", a.report, file=sys.stderr)

if __name__ == "__main__":
    main()
