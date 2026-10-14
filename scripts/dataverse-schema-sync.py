#!/usr/bin/env python3
"""Copy the support (case) schema from production Dataverse into a sandbox.

What moves: option-set values (added, never removed; labels changed only for the attributes in
--relabel), a whitelist of missing columns, every public incident view, every incident chart,
the Rafi / SR / Defect dashboards with whatever views and charts they reference, the two case
main forms, and the "Dynamics 365 Mobile – custom" app (sitemap + components). Everything keeps
its production GUID so dashboards, the app and the portal resolve the same ids in both orgs.

Reads the SOURCE with GET only. Writes only to TARGET and refuses the production host as a
target. Idempotent: existing components are updated in place, nothing is deleted. New or changed
components are also added to the unmanaged solution K7SupportSchemaSync in the target so the
change set stays visible (best effort, --no-solution turns it off).

  python3 -I scripts/dataverse-schema-sync.py --target https://<sandbox>.crm8.dynamics.com --dry-run
  python3 -I scripts/dataverse-schema-sync.py --target https://<sandbox>.crm8.dynamics.com
Options: --only options,attributes,views,charts,dashboards,forms,app,publish
         --relabel incident.k7_servicerequesttype,incident.k7_srstatus   (default)
         --no-solution   --report migration/dataverse-schema-sync-report.json
         --force-publish  (after an interrupted run: publish the selected steps' entities, app, sitemap)
Views that both orgs share by id but production has deactivated are deactivated in the target too.
Every component the run overwrites is saved first to migration/uat-schema-backup-<timestamp>.json
(--backup to choose the path). Comparisons are XML-aware (Dataverse adds savedqueryid= on save).
Known gap: AddAppComponents does not persist *entity* components for this app; the app validates
without them, so the five reference entities keep showing as 'component_add' in a dry run.
Auth: the device-code refresh token shared with dataverse-probe.py (scripts/.token_cache.json).
"""
import os, sys, re, json, time, argparse, urllib.request, urllib.parse, urllib.error
import http.client
import socket as _socket
_gai = _socket.getaddrinfo
def _gai_v4_first(*a, **k):   # the IPv6 path to Microsoft is unreliable from the dev network: try IPv4 first, IPv6 as fallback
    res = _gai(*a, **k); return sorted(res, key=lambda r: r[0] != _socket.AF_INET)
_socket.getaddrinfo = _gai_v4_first

import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_CACHE = os.path.join(HERE, ".token_cache.json")
PUBLIC_CLIENT = "51f81489-12ee-4a9e-aaae-a2591f45987d"
PRODUCTION_HOSTS = {"k7crm.crm8.dynamics.com", "k7crm.api.crm8.dynamics.com"}

OPTION_ENTITIES = ["incident", "account", "contact"]
RELABEL_DEFAULT = "incident.k7_servicerequesttype,incident.k7_srstatus"
ATTRIBUTES = [("account", "k7_description")]           # columns created in the target when missing
VIEW_ENTITIES = ["incident"]                             # all public views (querytype 0, active)
CHART_ENTITIES = ["incident"]
DASHBOARDS = ["Active Cases Dashboard - Rafi", "Monthly Dashboard - Rafi", "SR - Dashboard", "Defect - Rafi"]
FORMS = [("incident", 2, "Case"), ("incident", 2, "Case for Multisession experience")]
APP = "mobilecustom"
SOLUTION = "K7SupportSchemaSync"
GUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

def load_dotenv(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.split(" #", 1)[0].strip().strip('"').strip("'"))
load_dotenv()
TENANT = os.environ.get("DV_TENANT_ID", "005ef94f-7dbd-4d0e-a29a-494e2a63d911")

# ------------------------------------------------------------------ auth (same cache as the probe / seed)
_tokens = {}
def _form(url, fields):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e: return json.loads(e.read().decode(errors="ignore") or "{}")
def _cache(): return json.load(open(TOKEN_CACHE)) if os.path.exists(TOKEN_CACHE) else {}
def _save_refresh(t):
    c = _cache(); c["refresh_token"] = t.get("refresh_token", c.get("refresh_token")); c.setdefault("exp", 0); c.setdefault("access_token", "")
    json.dump(c, open(TOKEN_CACHE, "w")); os.chmod(TOKEN_CACHE, 0o600)
def token(org):
    t = _tokens.get(org)
    if t and time.time() < t["exp"] - 300: return t["access_token"]
    scope = f"{org}/user_impersonation offline_access"; c = _cache()
    if c.get("refresh_token"):
        r = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
                  {"grant_type": "refresh_token", "client_id": PUBLIC_CLIENT, "refresh_token": c["refresh_token"], "scope": scope})
        if "access_token" in r:
            _save_refresh(r); _tokens[org] = {"access_token": r["access_token"], "exp": time.time() + int(r["expires_in"])}; return r["access_token"]
    dc = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/devicecode", {"client_id": PUBLIC_CLIENT, "scope": scope})
    if "device_code" not in dc: raise SystemExit(f"device code failed: {dc}")
    print("SIGN-IN REQUIRED: " + dc["message"], file=sys.stderr, flush=True)
    deadline = time.time() + int(dc.get("expires_in", 900))
    while time.time() < deadline:
        time.sleep(int(dc.get("interval", 5)))
        r = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
                  {"grant_type": "urn:ietf:params:oauth:grant-type:device_code", "client_id": PUBLIC_CLIENT, "device_code": dc["device_code"]})
        if "access_token" in r:
            _save_refresh(r); _tokens[org] = {"access_token": r["access_token"], "exp": time.time() + int(r["expires_in"])}; return r["access_token"]
        if r.get("error") not in ("authorization_pending", "slow_down"): raise SystemExit(f"sign-in failed: {r}")
    raise SystemExit("sign-in timed out")

# ------------------------------------------------------------------ http
class DvError(Exception): pass
def call(org, method, path, body=None, headers=None, prefer=None):
    if method != "GET" and urllib.parse.urlparse(org).hostname in PRODUCTION_HOSTS:
        raise SystemExit(f"refusing {method} against production ({org})")
    url = path if path.startswith("http") else f"{org}/api/data/v9.2/{path}"
    url = urllib.parse.quote(url, safe=":/?=&$'(),@;+%!*[]")
    h = {"Authorization": f"Bearer {token(org)}", "OData-MaxVersion": "4.0", "OData-Version": "4.0", "Accept": "application/json",
         "Content-Type": "application/json; charset=utf-8", "Prefer": prefer or 'odata.include-annotations="*"'}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=300) as r:
                raw = r.read(); return (json.loads(raw) if raw else {}), dict(r.headers)
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="ignore")
            if e.code in (429, 503) and attempt < 5: time.sleep(float(e.headers.get("Retry-After", 2 ** attempt))); continue
            raise DvError(f"{e.code} {method} {path[:100]}: {txt[:500]}") from None
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:   # includes connection resets   # DNS blips and dropped connections: wait up to ~5 minutes in total
            if attempt < 9: time.sleep(min(60, 2 ** attempt)); continue
            raise DvError(f"network {method} {path[:100]}: {e}") from None
def get_all(org, path, page=1000):
    rows, nxt = [], path
    while nxt:
        p, _ = call(org, "GET", nxt, prefer=f'odata.maxpagesize={page},odata.include-annotations="*"')
        rows += p.get("value", []); nxt = p.get("@odata.nextLink")
    return rows

# ------------------------------------------------------------------ helpers
def ulabel(lbl): return ((lbl or {}).get("UserLocalizedLabel") or {}).get("Label")
def label_body(lbl):
    ll = [l for l in (lbl or {}).get("LocalizedLabels", []) if l.get("Label") is not None] or ([{"Label": ulabel(lbl), "LanguageCode": 1033}] if ulabel(lbl) else [])
    return {"@odata.type": "Microsoft.Dynamics.CRM.Label", "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel", "Label": l["Label"], "LanguageCode": l["LanguageCode"]} for l in ll]}

class Target:
    """Lazy metadata/component lookups in the target org."""
    def __init__(self, org): self.org, self._attrs, self._ents, self._ids = org, {}, None, {}
    def attrs(self, ent):
        if ent not in self._attrs:
            try: self._attrs[ent] = {a["LogicalName"] for a in get_all(self.org, f"EntityDefinitions(LogicalName='{ent}')/Attributes?$select=LogicalName")}
            except DvError: self._attrs[ent] = None
        return self._attrs[ent]
    def entities(self):
        if self._ents is None: self._ents = {e["MetadataId"].lower(): e["LogicalName"] for e in get_all(self.org, "EntityDefinitions?$select=LogicalName")}
        return self._ents
    def exists(self, entityset, idattr, rid):
        key = (entityset, rid.lower())
        if key not in self._ids:
            try: call(self.org, "GET", f"{entityset}({rid})?$select={idattr}"); self._ids[key] = True
            except DvError: self._ids[key] = False
        return self._ids[key]
    def webresource(self, name):
        rows = get_all(self.org, f"webresourceset?$select=name&$filter=name eq '{name}'"); return bool(rows)

_SQID = re.compile(r'\s+savedqueryid="[^"]*"')
def xeq(a, b):
    """True when two XML strings are the same document, ignoring the savedqueryid attribute Dataverse adds on save."""
    a, b = _SQID.sub("", a or ""), _SQID.sub("", b or "")
    if a == b: return True
    try: return ET.canonicalize(xml_data=a, strip_text=True) == ET.canonicalize(xml_data=b, strip_text=True)
    except Exception: return False

def validate_fetch(tgt, xml):
    """(entity, attribute) pairs referenced by fetchxml that the target lacks; ['PARSE'] if unreadable."""
    bad = set()
    try: root = ET.fromstring(xml)
    except Exception: return ["PARSE"]
    def walk(el, ent):
        for ch in el:
            if ch.tag in ("entity", "link-entity"): walk(ch, ch.get("name")); continue
            if ch.tag in ("attribute", "order", "condition"):
                a = ch.get("attribute") if ch.tag == "condition" else ch.get("name"); e = ch.get("entityname") or ent
                if a and e and not a.startswith("@"):
                    s = tgt.attrs(e)
                    if s is None: bad.add((e, "ENTITY-MISSING"))
                    elif a not in s: bad.add((e, a))
            walk(ch, ent)
    for f in ([root] if root.tag == "fetch" else root.iter("fetch")): walk(f, None)
    return sorted(bad)

# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True); ap.add_argument("--source", default=os.environ.get("SEED_SOURCE_URL", "https://k7crm.crm8.dynamics.com"))
    ap.add_argument("--only", default="options,attributes,views,charts,dashboards,forms,app,publish")
    ap.add_argument("--relabel", default=RELABEL_DEFAULT); ap.add_argument("--no-solution", action="store_true")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--report", default="migration/dataverse-schema-sync-report.json")
    ap.add_argument("--backup", help="where to write the target's previous versions of everything this run overwrites")
    ap.add_argument("--force-publish", action="store_true", help="after an interrupted run: publish the entities of the steps selected with --only (and the app + sitemap when 'app' is selected) even if this run changed nothing")
    a = ap.parse_args()
    src, tgt = a.source.rstrip("/"), a.target.rstrip("/")
    if urllib.parse.urlparse(tgt).hostname in PRODUCTION_HOSTS or tgt == src: raise SystemExit("refusing: target is the production org (or equals the source)")
    steps = set(a.only.split(",")); relabel_ok = set(filter(None, a.relabel.split(","))); dry = a.dry_run
    T = Target(tgt)
    rep = {"dry_run": dry, "source": src, "target": tgt, "steps": {}, "errors": defaultdict(list), "publish": {"entities": set(), "optionsets": set(), "dashboards": set(), "sitemaps": set(), "appmodules": set()}}
    def log(*x): print(*x, file=sys.stderr, flush=True)
    backup = {"target": tgt, "taken": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "views": {}, "charts": {}, "forms": {}, "dashboards": {}, "sitemaps": {}, "option_labels": []}
    backup_path = a.backup or f"migration/uat-schema-backup-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}.json"
    def save_backup():
        if dry: return
        os.makedirs(os.path.dirname(backup_path) or ".", exist_ok=True); json.dump(backup, open(backup_path, "w"), indent=1)
    def err(step, msg): rep["errors"][step].append(str(msg)[:400]); log(f"  ! {step}: {str(msg)[:200]}")
    log(f"source {src}\ntarget {tgt}\ndry_run={dry} steps={sorted(steps)}")
    me, _ = call(tgt, "GET", "WhoAmI"); log(f"target user {me['UserId']}")

    # -------- solution container in the target (best effort)
    sol_hdr = {}
    if not a.no_solution and not dry:
        try:
            if not get_all(tgt, f"solutions?$select=solutionid&$filter=uniquename eq '{SOLUTION}'"):
                pubs = get_all(tgt, "publishers?$select=publisherid,uniquename,customizationprefix,isreadonly&$filter=isreadonly eq false")
                pub = next((p for p in pubs if p.get("customizationprefix") == "k7"), None) or next((p for p in pubs if p.get("customizationprefix") == "new"), None) or (pubs[0] if pubs else None)
                if pub:
                    call(tgt, "POST", "solutions", {"uniquename": SOLUTION, "friendlyname": "K7 Support schema sync (from production)", "version": "1.0.0.0",
                         "description": "Components copied from production by scripts/dataverse-schema-sync.py for the support portal sandbox.", "publisherid@odata.bind": f"/publishers({pub['publisherid']})"})
                    log(f"  created solution {SOLUTION} (publisher {pub['uniquename']})")
            sol_hdr = {"MSCRM.SolutionUniqueName": SOLUTION}
        except DvError as ex: err("solution", ex)
    def add_to_solution(component_id, ctype):
        if not sol_hdr: return
        body = {"ComponentId": component_id, "ComponentType": ctype, "SolutionUniqueName": SOLUTION, "AddRequiredComponents": False}
        if ctype == 1: body["DoNotIncludeSubcomponents"] = True
        try: call(tgt, "POST", "AddSolutionComponent", body)
        except DvError as ex:
            if "already" not in str(ex).lower(): err("solution", f"AddSolutionComponent {ctype} {component_id}: {ex}")
    _tgt_optionsets = {}
    def target_optionset_id(name):   # global option sets have their own MetadataId in each org
        if not _tgt_optionsets:
            for o in get_all(tgt, "GlobalOptionSetDefinitions?$select=Name"): _tgt_optionsets[o["Name"]] = o["MetadataId"]
        return _tgt_optionsets.get(name)

    # -------- 1. option values
    if "options" in steps:
        def option_meta(org, ent):
            out = {}
            for kind in ("PicklistAttributeMetadata", "StatusAttributeMetadata"):
                for at in get_all(org, f"EntityDefinitions(LogicalName='{ent}')/Attributes/Microsoft.Dynamics.CRM.{kind}?$select=LogicalName&$expand=OptionSet($select=IsGlobal,Name,Options,MetadataId)"):
                    o = at.get("OptionSet") or {}
                    out[at["LogicalName"]] = {"kind": kind, "global": o.get("IsGlobal"), "name": o.get("Name"), "metadataid": o.get("MetadataId"), "options": {x["Value"]: x for x in o.get("Options", [])}}
            return out
        plan, seen, conflicts, to_cache = [], set(), [], {}
        for ent in OPTION_ENTITIES:
            so, to = option_meta(src, ent), option_meta(tgt, ent); to_cache[ent] = to
            for attr, m in so.items():
                t = to.get(attr)
                if not t: rep["steps"].setdefault("options_skipped_attributes", []).append(f"{ent}.{attr} ({m['kind']}) not a choice column in target"); continue
                key_base = ("G", m["name"]) if m["global"] else ("L", ent, attr)
                for v, o in m["options"].items():
                    k = key_base + (v,)
                    if k in seen: continue
                    if v not in t["options"]: seen.add(k); plan.append(("insert", ent, attr, m, v, o))
                    elif ulabel(o["Label"]) != ulabel(t["options"][v]["Label"]):
                        if f"{ent}.{attr}" in relabel_ok: seen.add(k); plan.append(("relabel", ent, attr, m, v, o))
                        else: conflicts.append(f"{ent}.{attr}={v}: target '{ulabel(t['options'][v]['Label'])}' vs source '{ulabel(o['Label'])}' (kept)")
        rep["steps"]["options_plan"] = [f"{act} {ent}.{attr}={v} '{ulabel(o['Label'])}'" + (f" [global {m['name']}]" if m["global"] else "") for act, ent, attr, m, v, o in plan]
        rep["steps"]["options_label_conflicts_kept"] = conflicts
        log(f"options: {sum(1 for p in plan if p[0]=='insert')} values to add, {sum(1 for p in plan if p[0]=='relabel')} to relabel, {len(conflicts)} label conflicts kept as-is")
        done = Counter()
        for act, ent, attr, m, v, o in plan:
            body = {"Value": v, "Label": label_body(o["Label"])}
            if m["global"]: body["OptionSetName"] = m["name"]
            else: body.update(EntityLogicalName=ent, AttributeLogicalName=attr)
            if m["kind"] == "StatusAttributeMetadata": body["StateCode"] = o.get("State"); action = "InsertStatusValue" if act == "insert" else "UpdateOptionValue"
            else: action = "InsertOptionValue" if act == "insert" else "UpdateOptionValue"
            if act == "relabel": body["MergeLabels"] = True; backup["option_labels"].append({"entity": ent, "attribute": attr, "optionset": m["name"] if m["global"] else None, "value": v, "old_label": ulabel(to_cache[ent][attr]["options"][v]["Label"]), "new_label": ulabel(o["Label"])})
            if dry: done[act] += 1; continue
            try: call(tgt, "POST", action, body, headers=sol_hdr if act == "insert" else {}); done[act] += 1
            except DvError as ex: err("options", f"{act} {ent}.{attr}={v}: {ex}")
            if m["global"]:
                rep["publish"]["optionsets"].add(m["name"]); oid = target_optionset_id(m["name"])
                if oid: add_to_solution(oid, 9)
            else: rep["publish"]["entities"].add(ent)
        rep["steps"]["options_done"] = dict(done); save_backup()

    # -------- 2. columns
    if "attributes" in steps:
        res = []
        for ent, attr in ATTRIBUTES:
            if attr in (T.attrs(ent) or set()): res.append(f"{ent}.{attr} exists"); continue
            sa, _ = call(src, "GET", f"EntityDefinitions(LogicalName='{ent}')/Attributes(LogicalName='{attr}')")
            body = {k: sa[k] for k in ("@odata.type", "AttributeType", "AttributeTypeName", "SchemaName", "MaxLength", "FormatName", "Format", "DateTimeBehavior", "Precision", "MinValue", "MaxValue", "DefaultValue") if sa.get(k) is not None}
            body["DisplayName"] = label_body(sa.get("DisplayName")); body["Description"] = label_body(sa.get("Description"))
            if sa.get("RequiredLevel"): body["RequiredLevel"] = {"Value": sa["RequiredLevel"]["Value"], "CanBeChanged": True, "ManagedPropertyLogicalName": "canmodifyrequirementlevelsettings"}
            if sa.get("SourceType"): res.append(f"{ent}.{attr} skipped: calculated/rollup column (SourceType {sa['SourceType']})"); continue
            res.append(f"{ent}.{attr} create ({sa.get('AttributeType')}, len {sa.get('MaxLength')})")
            if dry: continue
            try: call(tgt, "POST", f"EntityDefinitions(LogicalName='{ent}')/Attributes", body, headers=sol_hdr); T._attrs.pop(ent, None); rep["publish"]["entities"].add(ent)
            except DvError as ex: err("attributes", f"{ent}.{attr}: {ex}")
        rep["steps"]["attributes"] = res

    # -------- collect dashboard references first (views/charts of any entity they need)
    dash_src, extra_view_ids, extra_chart_ids = [], set(), set()
    if "dashboards" in steps or "views" in steps or "charts" in steps:
        all_sq = {q["savedqueryid"].lower(): q["returnedtypecode"] for q in get_all(src, "savedqueries?$select=savedqueryid,returnedtypecode")}
        all_cv = {c["savedqueryvisualizationid"].lower(): c["primaryentitytypecode"] for c in get_all(src, "savedqueryvisualizations?$select=savedqueryvisualizationid,primaryentitytypecode")}
        for name in DASHBOARDS:
            rows = get_all(src, f"systemforms?$select=formid,name,description,type,formpresentation,formactivationstate,isdefault&$filter=type eq 0 and name eq '{name.replace(chr(39), chr(39)*2)}'")
            if not rows: err("dashboards", f"'{name}' not found in source"); continue
            d = rows[0]; x, _ = call(src, "GET", f"systemforms({d['formid']})?$select=formxml"); d["formxml"] = x.get("formxml")
            for g in {g.lower() for g in GUID.findall(d["formxml"] or "")}:
                if g in all_sq: extra_view_ids.add(g)
                elif g in all_cv: extra_chart_ids.add(g)
            dash_src.append(d)
    # app components (views/forms the app needs)
    app_src = app_tgt = None; app_missing = []
    if "app" in steps:
        s_rows = get_all(src, f"appmodules?$select=appmoduleid,appmoduleidunique,name&$filter=uniquename eq '{APP}'")
        t_rows = get_all(tgt, f"appmodules?$select=appmoduleid,appmoduleidunique,name&$filter=uniquename eq '{APP}'")
        if s_rows and t_rows:
            app_src, app_tgt = s_rows[0], t_rows[0]
            s_comps = get_all(src, f"appmodulecomponents?$select=componenttype,objectid&$filter=_appmoduleidunique_value eq {app_src['appmoduleidunique']}")
            t_comps = {c["objectid"].lower() for c in get_all(tgt, f"appmodulecomponents?$select=componenttype,objectid&$filter=_appmoduleidunique_value eq {app_tgt['appmoduleidunique']}")}
            app_src["sitemap"] = next((c["objectid"] for c in s_comps if c["componenttype"] == 62), None)
            app_tgt["sitemap"] = next((c["objectid"] for c in get_all(tgt, f"appmodulecomponents?$select=componenttype,objectid&$filter=_appmoduleidunique_value eq {app_tgt['appmoduleidunique']} and componenttype eq 62")), None)
            app_missing = [c for c in s_comps if c["objectid"].lower() not in t_comps and c["componenttype"] != 62]
            for c in app_missing:
                if c["componenttype"] == 26: extra_view_ids.add(c["objectid"].lower())
                elif c["componenttype"] == 59: extra_chart_ids.add(c["objectid"].lower())
        else: err("app", f"app {APP} missing in source or target; skipped")

    # -------- 3. views
    if "views" in steps:
        flt = " or ".join(f"returnedtypecode eq '{e}'" for e in VIEW_ENTITIES)
        sel = "$select=savedqueryid,name,description,fetchxml,layoutxml,returnedtypecode,querytype,statecode,isdefault"
        src_views = get_all(src, f"savedqueries?{sel}&$filter=({flt}) and querytype eq 0 and statecode eq 0")
        have = {v["savedqueryid"].lower() for v in src_views}
        for g in extra_view_ids - have:
            try: v, _ = call(src, "GET", f"savedqueries({g})?{sel}"); src_views.append(v)
            except DvError as ex: err("views", f"source view {g}: {ex}")
        tgt_views = {v["savedqueryid"].lower(): v for v in get_all(tgt, f"savedqueries?$select=savedqueryid,name,description,fetchxml,layoutxml,returnedtypecode,querytype,statecode&$filter={flt}")}
        res = Counter(); detail = []
        for v in src_views:
            vid = v["savedqueryid"].lower()
            bad = validate_fetch(T, v["fetchxml"])
            if bad: res["skipped_invalid"] += 1; detail.append(f"SKIP {v['returnedtypecode']} '{v['name']}': {bad}"); continue
            t = tgt_views.get(vid)
            if t is None and vid in extra_view_ids:
                try: t, _ = call(tgt, "GET", f"savedqueries({vid})?$select=savedqueryid,name,description,fetchxml,layoutxml,statecode")
                except DvError: t = None
            if t is None:
                res["create"] += 1; detail.append(f"CREATE {v['returnedtypecode']} '{v['name']}'")
                if dry: continue
                body = {"savedqueryid": v["savedqueryid"], "name": v["name"], "description": v.get("description"), "fetchxml": v["fetchxml"], "layoutxml": v.get("layoutxml"),
                        "returnedtypecode": v["returnedtypecode"], "querytype": v.get("querytype", 0), "isdefault": False}
                try: call(tgt, "POST", "savedqueries", body, headers=sol_hdr); rep["publish"]["entities"].add(v["returnedtypecode"])
                except DvError as ex: err("views", f"create '{v['name']}': {ex}")
            elif not xeq(v["fetchxml"], t.get("fetchxml")) or not xeq(v.get("layoutxml"), t.get("layoutxml")) or v["name"] != t.get("name") or (v.get("statecode") == 0 and t.get("statecode") == 1):
                reactivate = v.get("statecode") == 0 and t.get("statecode") == 1
                res["update"] += 1; detail.append(f"UPDATE {v['returnedtypecode']} '{v['name']}'" + (" (re-activate)" if reactivate else ""))
                if dry: continue
                backup["views"][vid] = {k: t.get(k) for k in ("name", "description", "fetchxml", "layoutxml", "statecode")}
                try:
                    body = {"name": v["name"], "description": v.get("description"), "fetchxml": v["fetchxml"], "layoutxml": v.get("layoutxml")}
                    if reactivate: body.update(statecode=0, statuscode=1)
                    call(tgt, "PATCH", f"savedqueries({vid})", body, headers={"If-Match": "*"})
                    rep["publish"]["entities"].add(v["returnedtypecode"]); add_to_solution(vid, 26)
                except DvError as ex: err("views", f"update '{v['name']}': {ex}")
            else: res["same"] += 1
        src_inactive = {v["savedqueryid"].lower(): v for v in get_all(src, f"savedqueries?$select=savedqueryid,name,statecode&$filter=({flt}) and querytype eq 0 and statecode eq 1")}
        for vid, t in tgt_views.items():
            if vid in src_inactive and t.get("statecode") == 0 and t.get("querytype") == 0:
                res["deactivate"] += 1; detail.append(f"DEACTIVATE {t['returnedtypecode']} '{t['name']}' (inactive in source)")
                if dry: continue
                backup["views"][vid] = {k: t.get(k) for k in ("name", "description", "fetchxml", "layoutxml", "statecode")}
                try: call(tgt, "PATCH", f"savedqueries({vid})", {"statecode": 1, "statuscode": 2}, headers={"If-Match": "*"}); rep["publish"]["entities"].add(t["returnedtypecode"])
                except DvError as ex: err("views", f"deactivate '{t['name']}': {ex}")
        rep["steps"]["views"] = dict(res); rep["steps"]["views_detail"] = detail; log(f"views: {dict(res)}"); save_backup()

    # -------- 4. charts
    if "charts" in steps:
        flt = " or ".join(f"primaryentitytypecode eq '{e}'" for e in CHART_ENTITIES)
        sel = "$select=savedqueryvisualizationid,name,description,datadescription,presentationdescription,primaryentitytypecode,isdefault,_webresourceid_value"
        src_charts = get_all(src, f"savedqueryvisualizations?{sel}&$filter={flt}")
        have = {c["savedqueryvisualizationid"].lower() for c in src_charts}
        for g in extra_chart_ids - have:
            try: c, _ = call(src, "GET", f"savedqueryvisualizations({g})?{sel}"); src_charts.append(c)
            except DvError as ex: err("charts", f"source chart {g}: {ex}")
        tgt_charts = {c["savedqueryvisualizationid"].lower(): c for c in get_all(tgt, f"savedqueryvisualizations?$select=savedqueryvisualizationid,name,datadescription,presentationdescription&$filter={flt}")}
        res = Counter(); detail = []
        for c in src_charts:
            cid = c["savedqueryvisualizationid"].lower()
            if c.get("_webresourceid_value"): res["skipped_webresource"] += 1; detail.append(f"SKIP '{c['name']}': custom web resource chart"); continue
            bad = validate_fetch(T, c["datadescription"] or "")
            if bad: res["skipped_invalid"] += 1; detail.append(f"SKIP {c['primaryentitytypecode']} '{c['name']}': {bad}"); continue
            t = tgt_charts.get(cid)
            if t is None and cid in extra_chart_ids:
                try: t, _ = call(tgt, "GET", f"savedqueryvisualizations({cid})?$select=savedqueryvisualizationid,name,datadescription,presentationdescription")
                except DvError: t = None
            if t is None:
                res["create"] += 1; detail.append(f"CREATE {c['primaryentitytypecode']} '{c['name']}'")
                if dry: continue
                body = {"savedqueryvisualizationid": c["savedqueryvisualizationid"], "name": c["name"], "description": c.get("description"), "datadescription": c["datadescription"],
                        "presentationdescription": c.get("presentationdescription"), "primaryentitytypecode": c["primaryentitytypecode"], "isdefault": False}
                try: call(tgt, "POST", "savedqueryvisualizations", body, headers=sol_hdr); rep["publish"]["entities"].add(c["primaryentitytypecode"])
                except DvError as ex: err("charts", f"create '{c['name']}': {ex}")
            elif not xeq(c["datadescription"], t.get("datadescription")) or not xeq(c.get("presentationdescription"), t.get("presentationdescription")):
                res["update"] += 1; detail.append(f"UPDATE {c['primaryentitytypecode']} '{c['name']}'")
                if dry: continue
                backup["charts"][cid] = {k: t.get(k) for k in ("name", "datadescription", "presentationdescription")}
                try:
                    call(tgt, "PATCH", f"savedqueryvisualizations({cid})", {"name": c["name"], "description": c.get("description"), "datadescription": c["datadescription"], "presentationdescription": c.get("presentationdescription")}, headers={"If-Match": "*"})
                    rep["publish"]["entities"].add(c["primaryentitytypecode"]); add_to_solution(cid, 59)
                except DvError as ex: err("charts", f"update '{c['name']}': {ex}")
            else: res["same"] += 1
        rep["steps"]["charts"] = dict(res); rep["steps"]["charts_detail"] = detail; log(f"charts: {dict(res)}"); save_backup()

    # -------- 5. dashboards
    if "dashboards" in steps:
        res = Counter(); detail = []
        for d in dash_src:
            fid = d["formid"].lower()
            missing_refs = [g for g in {g.lower() for g in GUID.findall(d["formxml"] or "")} if (g in all_sq and not T.exists("savedqueries", "savedqueryid", g)) or (g in all_cv and not T.exists("savedqueryvisualizations", "savedqueryvisualizationid", g))]
            if missing_refs and not dry: res["skipped_missing_refs"] += 1; detail.append(f"SKIP '{d['name']}': target lacks {missing_refs}"); continue
            try: t, _ = call(tgt, "GET", f"systemforms({fid})?$select=formid,name,formxml")
            except DvError: t = None
            if t is None:
                res["create"] += 1; detail.append(f"CREATE '{d['name']}'" + (f" (refs still missing in dry run: {len(missing_refs)})" if missing_refs else ""))
                if dry: continue
                body = {"formid": d["formid"], "name": d["name"], "description": d.get("description"), "type": 0, "formxml": d["formxml"], "formpresentation": d.get("formpresentation", 0),
                        "formactivationstate": 1, "isdefault": False, "objecttypecode": "none"}
                try: call(tgt, "POST", "systemforms", body, headers=sol_hdr); rep["publish"]["dashboards"].add(fid)
                except DvError as ex:
                    try: body.pop("objecttypecode"); call(tgt, "POST", "systemforms", body, headers=sol_hdr); rep["publish"]["dashboards"].add(fid)
                    except DvError as ex2: err("dashboards", f"create '{d['name']}': {ex2}")
            elif not xeq(d["formxml"], t.get("formxml")):
                res["update"] += 1; detail.append(f"UPDATE '{d['name']}'")
                if dry: continue
                backup["dashboards"][fid] = {"name": t.get("name"), "formxml": t.get("formxml")}
                try: call(tgt, "PATCH", f"systemforms({fid})", {"formxml": d["formxml"], "name": d["name"], "description": d.get("description")}, headers={"If-Match": "*"}); rep["publish"]["dashboards"].add(fid); add_to_solution(fid, 60)
                except DvError as ex: err("dashboards", f"update '{d['name']}': {ex}")
            else: res["same"] += 1
        rep["steps"]["dashboards"] = dict(res); rep["steps"]["dashboards_detail"] = detail; log(f"dashboards: {dict(res)}"); save_backup()

    # -------- 6. forms
    if "forms" in steps:
        res = Counter(); detail = []
        for ent, ftype, name in FORMS:
            rows = get_all(src, f"systemforms?$select=formid,name&$filter=objecttypecode eq '{ent}' and type eq {ftype} and name eq '{name.replace(chr(39), chr(39)*2)}'")
            if not rows: err("forms", f"'{name}' not in source"); continue
            fid = rows[0]["formid"].lower(); sx, _ = call(src, "GET", f"systemforms({fid})?$select=formxml")
            try: tx, _ = call(tgt, "GET", f"systemforms({fid})?$select=formxml,name")
            except DvError: res["skipped_missing"] += 1; detail.append(f"SKIP '{name}': form id not in target"); continue
            if xeq(sx.get("formxml"), tx.get("formxml")): res["same"] += 1; continue
            fx = sx.get("formxml") or ""
            problems = [f"field {f}" for f in set(re.findall(r'datafieldname="([^"]+)"', fx)) if f not in (T.attrs(ent) or set())]
            problems += [f"webresource {n}" for n in set(re.findall(r'<Library name="([^"]+)"', fx)) if not T.webresource(n)]
            problems += [f"quickform {g}" for g in {g.lower() for g in GUID.findall("".join(re.findall(r"<QuickForms>.*?</QuickForms>", fx, flags=re.S)))} if not T.exists("systemforms", "formid", g)]
            if problems: res["skipped_invalid"] += 1; detail.append(f"SKIP '{name}': {problems[:8]}"); continue
            res["update"] += 1; detail.append(f"UPDATE '{name}'")
            if dry: continue
            backup["forms"][fid] = {"name": tx.get("name"), "formxml": tx.get("formxml")}
            try: call(tgt, "PATCH", f"systemforms({fid})", {"formxml": fx}, headers={"If-Match": "*"}); rep["publish"]["entities"].add(ent); add_to_solution(fid, 60)
            except DvError as ex: err("forms", f"update '{name}': {ex}")
        rep["steps"]["forms"] = dict(res); rep["steps"]["forms_detail"] = detail; log(f"forms: {dict(res)}"); save_backup()

    # -------- 7. app module: sitemap + components
    if "app" in steps and app_src and app_tgt:
        res = Counter(); detail = []
        if app_src.get("sitemap") and app_tgt.get("sitemap"):
            sx, _ = call(src, "GET", f"sitemaps({app_src['sitemap']})?$select=sitemapxml"); tx, _ = call(tgt, "GET", f"sitemaps({app_tgt['sitemap']})?$select=sitemapxml")
            if not xeq(sx.get("sitemapxml"), tx.get("sitemapxml")):
                ents = set(re.findall(r'Entity="([^"]+)"', sx.get("sitemapxml") or "")); tnames = set(T.entities().values())
                missing_ents = sorted(e for e in ents if e not in tnames)
                dash_refs = [g.lower() for g in re.findall(r'DefaultDashboard="\{?([0-9a-fA-F-]{36})\}?"', sx.get("sitemapxml") or "")]
                missing_dash = [g for g in dash_refs if not dry and not T.exists("systemforms", "formid", g)]
                if missing_ents or missing_dash: res["sitemap_skipped"] += 1; detail.append(f"SKIP sitemap: entities {missing_ents} dashboards {missing_dash}")
                else:
                    res["sitemap_update"] += 1; detail.append("UPDATE sitemap")
                    if not dry:
                        backup["sitemaps"][app_tgt["sitemap"]] = {"sitemapxml": tx.get("sitemapxml")}
                        try: call(tgt, "PATCH", f"sitemaps({app_tgt['sitemap']})", {"sitemapxml": sx.get("sitemapxml")}, headers={"If-Match": "*"}); rep["publish"]["sitemaps"].add(app_tgt["sitemap"]); add_to_solution(app_tgt["sitemap"], 62)
                        except DvError as ex: err("app", f"sitemap: {ex}")
            else: res["sitemap_same"] += 1
        comps = []; tent = T.entities()
        for c in app_missing:
            g, ct = c["objectid"].lower(), c["componenttype"]
            if ct == 26: ok = dry or T.exists("savedqueries", "savedqueryid", g); comps.append(({"@odata.type": "Microsoft.Dynamics.CRM.savedquery", "savedqueryid": g}, "view", ok))
            elif ct == 60: ok = dry or T.exists("systemforms", "formid", g); comps.append(({"@odata.type": "Microsoft.Dynamics.CRM.systemform", "formid": g}, "form", ok))
            elif ct == 59: ok = dry or T.exists("savedqueryvisualizations", "savedqueryvisualizationid", g); comps.append(({"@odata.type": "Microsoft.Dynamics.CRM.savedqueryvisualization", "savedqueryvisualizationid": g}, "chart", ok))
            elif ct == 1: ok = g in tent; comps.append(({"@odata.type": "Microsoft.Dynamics.CRM.entity", "entityid": g}, f"entity {tent.get(g, g)}", ok))
            else: detail.append(f"SKIP component type {ct} {g}")
        for body, kind, ok in comps:
            if not ok: res["component_skipped_missing"] += 1; detail.append(f"SKIP {kind}: not in target"); continue
            res["component_add"] += 1; detail.append(f"ADD {kind} {list(body.values())[-1]}")
            if dry: continue
            try: call(tgt, "POST", "AddAppComponents", {"AppId": app_tgt["appmoduleid"], "Components": [body]})
            except DvError as ex: err("app", f"AddAppComponents {kind} {body}: {ex}")
        if not dry:
            try:
                v, _ = call(tgt, "GET", f"ValidateApp(AppModuleId={app_tgt['appmoduleid']})")
                rep["steps"]["app_validation"] = {"success": v.get("ValidationSuccess"), "issues": [f"{i.get('ErrorType')}: {i.get('Message', '')[:160]}" for i in (v.get("ValidationIssueList") or [])][:20]}
            except DvError as ex: err("app", f"ValidateApp: {ex}")
            rep["publish"]["appmodules"].add(app_tgt["appmoduleid"]); add_to_solution(app_tgt["appmoduleid"], 80)
        rep["steps"]["app"] = dict(res); rep["steps"]["app_detail"] = detail; log(f"app: {dict(res)}"); save_backup()

    # -------- 8. publish (targeted, never PublishAllXml)
    if a.force_publish and not dry:
        if "views" in steps: rep["publish"]["entities"] |= set(VIEW_ENTITIES)
        if "charts" in steps: rep["publish"]["entities"] |= set(CHART_ENTITIES)
        if "options" in steps or "attributes" in steps: rep["publish"]["entities"] |= set(OPTION_ENTITIES)
        if "app" in steps and app_tgt:
            rep["publish"]["appmodules"].add(app_tgt["appmoduleid"])
            if app_tgt.get("sitemap"): rep["publish"]["sitemaps"].add(app_tgt["sitemap"])
        forced = {k: sorted(v) for k, v in rep["publish"].items() if v}; log(f"force-publish: {forced}")
    pub = {k: sorted(v) for k, v in rep["publish"].items()}; rep["publish"] = pub
    if "publish" in steps and not dry:
        parts = []
        if pub["entities"]: parts.append(("entities", "<entities>" + "".join(f"<entity>{e}</entity>" for e in pub["entities"]) + "</entities>"))
        if pub["optionsets"]: parts.append(("optionsets", "<optionsets>" + "".join(f"<optionset>{o}</optionset>" for o in pub["optionsets"]) + "</optionsets>"))
        if pub["dashboards"]: parts.append(("dashboards", "<dashboards>" + "".join(f"<dashboard>{{{d}}}</dashboard>" for d in pub["dashboards"]) + "</dashboards>"))
        if pub["sitemaps"]: parts.append(("sitemaps", "<sitemaps>" + "".join(f"<sitemap>{{{s}}}</sitemap>" for s in pub["sitemaps"]) + "</sitemaps>"))
        if pub["appmodules"]: parts.append(("appmodules", "<appmodules>" + "".join(f"<appmodule>{{{m}}}</appmodule>" for m in pub["appmodules"]) + "</appmodules>"))
        published = {}
        for name, xml in parts:
            try: call(tgt, "POST", "PublishXml", {"ParameterXml": f"<importexportxml>{xml}</importexportxml>"}); published[name] = "ok"
            except DvError as ex: published[name] = str(ex)[:300]; err("publish", f"{name}: {ex}")
        rep["steps"]["published"] = published; log(f"published: {published}")

    rep["errors"] = dict(rep["errors"]); rep["backup"] = None if dry else backup_path; save_backup()
    os.makedirs(os.path.dirname(a.report) or ".", exist_ok=True); json.dump(rep, open(a.report, "w"), indent=1, default=str)
    log(f"report written to {a.report}")
    if dry: print(json.dumps({k: v for k, v in rep["steps"].items() if not k.endswith("_detail") and k != "options_plan"}, indent=1, default=str))

if __name__ == "__main__":
    main()
