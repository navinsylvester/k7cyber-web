#!/usr/bin/env python3
"""Minimal, dependency-free Dataverse Web API client + metadata discovery.

Config: env vars or a `.env` file in the working directory (KEY=VALUE lines):
  DV_ORG_URL       e.g. https://<org>.crm8.dynamics.com            (required)
  DV_TENANT_ID     Entra tenant id (or domain)                       (required)
  DV_CLIENT_ID + DV_CLIENT_SECRET   app registration = application user (server-to-server)
  DV_AUTH=device   instead: sign in interactively as yourself with a device code
                   (uses Microsoft's documented public sample client id; needs no app registration)

  dataverse_probe.py discover            -> spec/metadata/*.json + spec/METADATA.md (move to docs/support-portal/05-metadata-full.md)
  dataverse_probe.py get "incidents?$select=ticketnumber&$top=3"
  dataverse_probe.py count incident contact account

Only GET requests are issued by `discover`/`count`; `post`/`patch` helpers exist for your app code.
"""
import os, sys, json, time, urllib.request, urllib.parse, urllib.error

def _load_dotenv(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                v = v.split(" #", 1)[0].strip().strip('"').strip("'")   # drop inline comments
                os.environ.setdefault(k.strip(), v)
_load_dotenv()

ORG = os.environ.get("DV_ORG_URL", "").rstrip("/")
PUBLIC_CLIENT = "51f81489-12ee-4a9e-aaae-a2591f45987d"   # Microsoft sample public client for Dataverse
TOKEN_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".token_cache.json")
API = f"{ORG}/api/data/v9.2/"
TABLES = ["incident", "contact", "account", "product", "knowledgearticle", "annotation",
          "new_issuecategory", "new_subcategory", "k7_rfe", "k7_defect", "k7_state", "k7_region",
          "alletec_city", "alletec_k7contract"]
_token = {"value": None, "exp": 0}

def _form(url, fields):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode(errors="ignore") or "{}")

def _device_token():
    tenant = os.environ.get("DV_TENANT_ID", "organizations")
    if os.path.exists(TOKEN_CACHE):
        c = json.load(open(TOKEN_CACHE))
        if time.time() < c.get("exp", 0) - 300:
            return c["access_token"], c["exp"]
        if c.get("refresh_token"):
            t = _form(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                      {"grant_type": "refresh_token", "client_id": PUBLIC_CLIENT,
                       "refresh_token": c["refresh_token"], "scope": f"{ORG}/user_impersonation offline_access"})
            if "access_token" in t:
                return _save_token(t)
    dc = _form(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode",
               {"client_id": PUBLIC_CLIENT, "scope": f"{ORG}/user_impersonation offline_access"})
    if "device_code" not in dc:
        raise RuntimeError(f"device code request failed: {dc}")
    print("SIGN-IN REQUIRED: " + dc["message"], file=sys.stderr, flush=True)
    deadline = time.time() + int(dc.get("expires_in", 900))
    while time.time() < deadline:
        time.sleep(int(dc.get("interval", 5)))
        t = _form(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                  {"grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                   "client_id": PUBLIC_CLIENT, "device_code": dc["device_code"]})
        if "access_token" in t:
            return _save_token(t)
        if t.get("error") not in ("authorization_pending", "slow_down"):
            raise RuntimeError(f"device code sign-in failed: {t}")
    raise RuntimeError("device code sign-in timed out")

def _save_token(t):
    exp = time.time() + int(t["expires_in"])
    json.dump({"access_token": t["access_token"], "refresh_token": t.get("refresh_token"), "exp": exp},
              open(TOKEN_CACHE, "w"))
    os.chmod(TOKEN_CACHE, 0o600)
    return t["access_token"], exp

def token():
    if _token["value"] and time.time() < _token["exp"] - 300:
        return _token["value"]
    if os.environ.get("DV_AUTH", "").lower() == "device":
        _token["value"], _token["exp"] = _device_token()
        return _token["value"]
    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": os.environ["DV_CLIENT_ID"],
        "client_secret": os.environ["DV_CLIENT_SECRET"],
        "scope": f"{ORG}/.default"}).encode()
    url = f"https://login.microsoftonline.com/{os.environ['DV_TENANT_ID']}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, data=body)) as r:
        t = json.load(r)
    _token.update(value=t["access_token"], exp=time.time() + int(t["expires_in"]))
    return _token["value"]

def call(method, path, body=None, prefer=None, extra=None):
    url = path if path.startswith("http") else API + path
    url = urllib.parse.quote(url, safe=":/?=&$'(),@;+%!*[]")   # percent-encode spaces etc.; keep existing %xx
    headers = {"Authorization": f"Bearer {token()}", "OData-MaxVersion": "4.0", "OData-Version": "4.0",
               "Accept": "application/json", "Content-Type": "application/json; charset=utf-8",
               "Prefer": prefer or 'odata.include-annotations="*"'}
    headers.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method)) as r:
                raw = r.read()
                return (json.loads(raw) if raw else {}), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(float(e.headers.get("Retry-After", 2 ** attempt)))
                continue
            raise RuntimeError(f"{e.code} {method} {url}\n{e.read().decode(errors='ignore')[:2000]}") from None

def get_all(path, max_pages=50):
    """Follow @odata.nextLink. Returns list of rows."""
    rows, nxt = [], path
    for _ in range(max_pages):
        page, _h = call("GET", nxt, prefer='odata.maxpagesize=500,odata.include-annotations="*"')
        rows += page.get("value", [])
        nxt = page.get("@odata.nextLink")
        if not nxt:
            break
    return rows

def post(entity_set, body):      # returns (created-id-url, representation)
    rep, h = call("POST", entity_set, body, prefer="return=representation")
    return h.get("OData-EntityId"), rep

def patch(entity_set, guid, body, etag="*"):
    return call("PATCH", f"{entity_set}({guid})", body, extra={"If-Match": etag})

# ---------- discovery ----------
def discover(outdir="spec/metadata"):
    os.makedirs(outdir, exist_ok=True)
    md = ["# Dataverse metadata (generated by tools/dataverse_probe.py discover)\n"]
    all_tables = get_all("EntityDefinitions?$select=LogicalName,EntitySetName,DisplayName,IsCustomEntity")
    json.dump([t["LogicalName"] for t in all_tables], open(f"{outdir}/all_table_names.json", "w"))
    custom = [t for t in all_tables if t["LogicalName"].startswith(("k7_", "alletec_", "adx_", "new_", "cit_", "msa_"))]
    json.dump(custom, open(f"{outdir}/custom_tables.json", "w"), indent=1)
    md.append("## Custom and portal tables\n")
    for e in custom:
        label = (e.get("DisplayName") or {}).get("UserLocalizedLabel") or {}
        md.append(f"- `{e['LogicalName']}` (set `{e['EntitySetName']}`): {label.get('Label', '')}")
    try:
        names = "','".join(TABLES)
        cnt, _ = call("GET", f"RetrieveTotalRecordCount(EntityNames=['{names}'])")
        pairs = cnt.get("EntityRecordCountCollection", {})
        counts = dict(zip(pairs.get("Keys", []), pairs.get("Values", [])))
        md.append("\n## Row counts\n")
        md += [f"- {k}: {v:,}" for k, v in counts.items()]
    except Exception as ex:
        md.append(f"\n(row count failed: {str(ex)[:200]})")
    for t in TABLES:
        try:
            attrs = get_all(f"EntityDefinitions(LogicalName='{t}')/Attributes?$select=LogicalName,DisplayName,AttributeType,IsCustomAttribute,IsValidForCreate,IsValidForUpdate")
        except Exception as ex:
            md.append(f"\n## {t}\n(not found: {str(ex)[:120]})"); continue
        picks = get_all(f"EntityDefinitions(LogicalName='{t}')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet,GlobalOptionSet")
        status = get_all(f"EntityDefinitions(LogicalName='{t}')/Attributes/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName&$expand=OptionSet")
        states = get_all(f"EntityDefinitions(LogicalName='{t}')/Attributes/Microsoft.Dynamics.CRM.StateAttributeMetadata?$select=LogicalName&$expand=OptionSet")
        rels = get_all(f"EntityDefinitions(LogicalName='{t}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName")
        json.dump({"attributes": attrs, "picklists": picks, "status": status, "state": states, "lookups": rels},
                  open(f"{outdir}/{t}.json", "w"), indent=1)
        md.append(f"\n## {t}\n")
        md.append("| logical name | display | type | custom | create/update |"); md.append("|---|---|---|---|---|")
        for a in sorted(attrs, key=lambda a: a["LogicalName"]):
            lab = ((a.get("DisplayName") or {}).get("UserLocalizedLabel") or {}).get("Label", "")
            if not lab:  # skip unlabeled system plumbing
                continue
            md.append(f"| {a['LogicalName']} | {lab} | {a['AttributeType']} | {'y' if a.get('IsCustomAttribute') else ''} | "
                      f"{'c' if a.get('IsValidForCreate') else ''}{'u' if a.get('IsValidForUpdate') else ''} |")
        def opts(o):
            return ", ".join(f"{x['Value']}={((x.get('Label') or {}).get('UserLocalizedLabel') or {}).get('Label','')}"
                             + (f" [state {x['State']}]" if 'State' in x else "") for x in o)
        for p in picks + status + states:
            os_ = p.get("OptionSet") or p.get("GlobalOptionSet") or {}
            if os_.get("Options"):
                md.append(f"- **{p['LogicalName']}**: {opts(os_['Options'])}")
        for r in rels:
            if r["ReferencedEntity"] not in ("systemuser", "team", "businessunit", "transactioncurrency", "owner"):
                md.append(f"- lookup `{r['ReferencingAttribute']}` → {r['ReferencedEntity']} (bind via `{r['ReferencingEntityNavigationPropertyName']}@odata.bind`)")
    open("spec/METADATA.md", "w").write("\n".join(md) + "\n")
    print("wrote spec/METADATA.md and", outdir, file=sys.stderr)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "discover":
        discover()
    elif cmd == "get":
        page, _ = call("GET", sys.argv[2])
        print(json.dumps(page, indent=1))
    elif cmd == "count":
        names = "','".join(sys.argv[2:] or TABLES)
        print(json.dumps(call("GET", f"RetrieveTotalRecordCount(EntityNames=['{names}'])")[0], indent=1))
    else:
        print(__doc__)
