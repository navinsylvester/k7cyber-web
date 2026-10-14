#!/usr/bin/env python3
"""Pause and resume the automation in the sandbox around a data seed.

--pause  deactivates, in the target only: every active classic workflow on incident, email,
         annotation, phonecall, task, account and contact; the cloud flow that mails customers on
         case creation; the Celedon autonumber plugin steps on incident (so production case numbers
         survive); and both email server profiles. What was changed is written to the state file.
--resume re-activates everything in the state file except the customer-facing items in KEEP_OFF
         (SMS / feedback / acknowledgement mails, the customer email flow, the mail profiles), which
         stay off until someone turns them on deliberately. Refuses the production host.

  python3 -I scripts/dataverse-uat-automation.py --target https://<sandbox>.crm8.dynamics.com --pause [--dry-run]
  python3 -I scripts/dataverse-uat-automation.py --target https://<sandbox>.crm8.dynamics.com --resume
State: migration/uat-automation-state.json (renamed with a timestamp after a resume).
"""
import os, sys, json, time, argparse, datetime as dt, urllib.request, urllib.parse, urllib.error
import http.client
import socket as _socket
_gai = _socket.getaddrinfo
def _gai_v4_first(*a, **k):   # the IPv6 path to Microsoft is unreliable from the dev network: try IPv4 first, IPv6 as fallback
    res = _gai(*a, **k); return sorted(res, key=lambda r: r[0] != _socket.AF_INET)
_socket.getaddrinfo = _gai_v4_first


HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_CACHE = os.path.join(HERE, ".token_cache.json")
PUBLIC_CLIENT = "51f81489-12ee-4a9e-aaae-a2591f45987d"
PRODUCTION_HOSTS = {"k7crm.crm8.dynamics.com", "k7crm.api.crm8.dynamics.com"}
ENTITIES = {"incident", "email", "annotation", "account"}
FLOWS = {"Send Email to Customer When Case is Created"}
PLUGIN_STEPS = {"CeledonPartners.AutoNumber.incident", "CeledonPartners.AutoNumber.incident Update"}
KEEP_OFF = {"SMS on Case Creation", "SMS on Case Closure", "Feedback Mail to Customer when case is Resolved", "Assignment Email to Owner",
            "Send Mail to ME after waiting 24 hours from customer", "Send Email to ME of L2 after 4 hours waiting for Customer - case resolution",
            "case creation", "Send email on Account create", "Pro32 Case creation acknowledgment email", "Pro 32 Case Closure Acknowledgment email",
            "Send Email to Customer When Case is Created"}

def load_dotenv(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.split(" #", 1)[0].strip().strip('"').strip("'"))
load_dotenv()
TENANT = os.environ.get("DV_TENANT_ID", "005ef94f-7dbd-4d0e-a29a-494e2a63d911")
_tokens = {}
def _form(url, fields):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e: return json.loads(e.read().decode(errors="ignore") or "{}")
def token(org):
    t = _tokens.get(org)
    if t and time.time() < t["exp"] - 300: return t["access_token"]
    c = json.load(open(TOKEN_CACHE)) if os.path.exists(TOKEN_CACHE) else {}
    if not c.get("refresh_token"): raise SystemExit("no refresh token in scripts/.token_cache.json; run dataverse-probe.py once to sign in")
    r = _form(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token", {"grant_type": "refresh_token", "client_id": PUBLIC_CLIENT, "refresh_token": c["refresh_token"], "scope": f"{org}/user_impersonation offline_access"})
    if "access_token" not in r: raise SystemExit(f"token refresh failed: {r.get('error')} {str(r.get('error_description'))[:160]}")
    c["refresh_token"] = r.get("refresh_token", c["refresh_token"]); json.dump(c, open(TOKEN_CACHE, "w")); os.chmod(TOKEN_CACHE, 0o600)
    _tokens[org] = {"access_token": r["access_token"], "exp": time.time() + int(r["expires_in"])}; return r["access_token"]
class DvError(Exception): pass
def call(org, method, path, body=None, headers=None):
    if method != "GET" and urllib.parse.urlparse(org).hostname in PRODUCTION_HOSTS: raise SystemExit("refusing a write against production")
    url = urllib.parse.quote(path if path.startswith("http") else f"{org}/api/data/v9.2/{path}", safe=":/?=&$'(),@;+%!*[]")
    h = {"Authorization": f"Bearer {token(org)}", "OData-MaxVersion": "4.0", "OData-Version": "4.0", "Accept": "application/json", "Content-Type": "application/json; charset=utf-8", "Prefer": 'odata.maxpagesize=1000,odata.include-annotations="*"'}
    h.update(headers or {})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method), timeout=120) as r:
                raw = r.read(); return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="ignore")
            if e.code in (429, 503) and attempt < 5: time.sleep(float(e.headers.get("Retry-After", 2 ** attempt))); continue
            raise DvError(f"{e.code} {method} {path[:80]}: {txt[:300]}") from None
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:   # DNS blips, connection resets
            if attempt < 5: time.sleep(min(60, 2 ** attempt)); continue
            raise DvError(f"network {method} {path[:80]}: {e}") from None
def get_all(org, path):
    rows, nxt = [], path
    while nxt:
        p = call(org, "GET", nxt); rows += p.get("value", []); nxt = p.get("@odata.nextLink")
    return rows

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True); g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--pause", action="store_true"); g.add_argument("--resume", action="store_true")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--state", default="migration/uat-automation-state.json")
    a = ap.parse_args(); tgt = a.target.rstrip("/")
    if urllib.parse.urlparse(tgt).hostname in PRODUCTION_HOSTS: raise SystemExit("refusing: target is production")
    log = lambda *x: print(*x, file=sys.stderr, flush=True)

    if a.pause:
        if os.path.exists(a.state): raise SystemExit(f"{a.state} exists: resume first (or move it away)")
        wf = [w for w in get_all(tgt, "workflows?$select=workflowid,name,category,primaryentity,statecode,statuscode,mode&$filter=type eq 1 and statecode eq 1 and (category eq 0 or category eq 5)")
              if (w["category"] == 0 and w.get("primaryentity") in ENTITIES) or (w["category"] == 5 and w["name"] in FLOWS)]
        steps = [s for s in get_all(tgt, "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid,name,statecode,statuscode&$filter=statecode eq 0") if s["name"] in PLUGIN_STEPS]
        profiles = get_all(tgt, "emailserverprofiles?$select=emailserverprofileid,name,statecode,statuscode&$filter=statecode eq 0")
        state = {"target": tgt, "paused_at": dt.datetime.now(dt.timezone.utc).isoformat(), "dry_run": a.dry_run,
                 "workflows": [{"id": w["workflowid"], "name": w["name"], "category": w["category"], "entity": w.get("primaryentity"), "mode": w.get("mode"), "keep_off": w["name"] in KEEP_OFF} for w in wf],
                 "plugin_steps": [{"id": s["sdkmessageprocessingstepid"], "name": s["name"]} for s in steps],
                 "email_server_profiles": [{"id": p["emailserverprofileid"], "name": p["name"], "keep_off": True} for p in profiles], "errors": []}
        log(f"pause: {len(wf)} workflows/flows, {len(steps)} plugin steps, {len(profiles)} email server profiles" + (" (dry run)" if a.dry_run else ""))
        for w in state["workflows"]: log(f"  workflow  {'flow ' if w['category']==5 else ''}{w['entity'] or '':<10} {w['name']}" + ("  [stays off]" if w["keep_off"] else ""))
        for s in state["plugin_steps"]: log(f"  step      {s['name']}")
        for p in state["email_server_profiles"]: log(f"  profile   {p['name']}  [stays off]")
        if a.dry_run: return
        for w in state["workflows"]:
            try: call(tgt, "PATCH", f"workflows({w['id']})", {"statecode": 0, "statuscode": 1}, headers={"If-Match": "*"})
            except DvError as ex: state["errors"].append(f"pause workflow {w['name']}: {ex}"); log("  !", ex)
        for s in state["plugin_steps"]:
            try: call(tgt, "PATCH", f"sdkmessageprocessingsteps({s['id']})", {"statecode": 1, "statuscode": 2}, headers={"If-Match": "*"})
            except DvError as ex: state["errors"].append(f"pause step {s['name']}: {ex}"); log("  !", ex)
        for p in state["email_server_profiles"]:
            try: call(tgt, "PATCH", f"emailserverprofiles({p['id']})", {"statecode": 1, "statuscode": 2}, headers={"If-Match": "*"})
            except DvError as ex: state["errors"].append(f"pause profile {p['name']}: {ex}"); log("  !", ex)
        os.makedirs(os.path.dirname(a.state) or ".", exist_ok=True); json.dump(state, open(a.state, "w"), indent=1)
        log(f"state written to {a.state}; errors: {len(state['errors'])}")

    if a.resume:
        if not os.path.exists(a.state): raise SystemExit(f"{a.state} not found")
        state = json.load(open(a.state)); state["resumed_at"] = dt.datetime.now(dt.timezone.utc).isoformat(); state["resume_errors"] = []; kept = []
        if state.get("target") != tgt: raise SystemExit(f"state file is for {state.get('target')}, not {tgt}")
        for w in state["workflows"]:
            if w["keep_off"]: kept.append(w["name"]); continue
            if a.dry_run: log(f"  would reactivate workflow {w['name']}"); continue
            try: call(tgt, "PATCH", f"workflows({w['id']})", {"statecode": 1, "statuscode": 2}, headers={"If-Match": "*"})
            except DvError as ex: state["resume_errors"].append(f"resume workflow {w['name']}: {ex}"); log("  !", ex)
        for s in state["plugin_steps"]:
            if a.dry_run: log(f"  would re-enable step {s['name']}"); continue
            try: call(tgt, "PATCH", f"sdkmessageprocessingsteps({s['id']})", {"statecode": 0, "statuscode": 1}, headers={"If-Match": "*"})
            except DvError as ex: state["resume_errors"].append(f"resume step {s['name']}: {ex}"); log("  !", ex)
        kept += [p["name"] for p in state["email_server_profiles"]]
        log(f"resume: reactivated {sum(1 for w in state['workflows'] if not w['keep_off'])} workflows, {len(state['plugin_steps'])} plugin steps; still off: {kept}; errors: {len(state['resume_errors'])}")
        if a.dry_run: return
        done = a.state.replace(".json", f"-resumed-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json")
        json.dump(state, open(done, "w"), indent=1); os.remove(a.state); log(f"state moved to {done}")

if __name__ == "__main__":
    main()
