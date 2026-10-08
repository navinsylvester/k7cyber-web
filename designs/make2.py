from k7chrome import *
pages={}
def li(items):
    out=''
    for t in items:
        no = t.startswith('✖')
        t=t.lstrip('✖✔ ')
        out+='<li%s>%s</li>'%(' class="no"' if no else '',t)
    return '<ul>%s</ul>'%out
def crit(n,title,cs,k7,adv):
    return '<tr class="row"><td class="crit"><span class="label muted">%d</span><br>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>\n'%(n,title,li(cs),li(k7),li(adv))
def batch(t,d): return '<tr class="batch"><th colspan="4"><span>%s <em>%s</em></span></th></tr>\n'%(t,d)
# ---------- Comparison: K7 vs CrowdStrike ----------
rows = batch('Threat protection','Knowing your exposure, stopping attacks, and containing them without stopping the business')
rows+=crit(1,'Knowing what you own, and what is actually protected',
 ['✖Counts installed agents, not assets; cannot report the gap between agents and assets','✖Agent does not cover phones and tablets','✖Does not identify unregistered machines'],
 ['Complete inventory of hardware, software, and what is actually running on every managed machine','Change tracking from the base licence','Unmanaged and network devices are discovered by a module of the same platform','What you own and what is vulnerable are one record; no reconciliation required'],
 ['Numbers provided to the Board correspond to numbers on the network','Security decisions and budgets reflect ground reality'])
rows+=crit(2,'Stopping attacks, including ransomware, before they spread',
 ['Blocks malware and exploits on Windows, macOS and Linux','Isolates infected machines','Prevents ransomware spreading over SMB','✖Does not perform file recovery'],
 ['On-device detection protects even when the cloud link is interrupted','Multi-layered ransomware protection','Backed-up files are restored from the same console'],
 ['Attacks do not turn into business interruption','Unknown ransomware variants are identified and blocked','Backup restoration does not require a separate product or project'])
rows+=crit(3,'Closing identified weaknesses',
 ['Lists vulnerabilities on Windows, macOS and Linux','Ranks likelihood of exploitation','✖Does not fix; requires a separate product for patching'],
 ['Exposure is visible from the base licence','Vulnerability detection flows from inventory, eliminating the scan window','Patching runs on that same console, administered by the same team'],
 ['Quick vulnerability mitigation, as finding and fixing are part of the same solution managed under the same team'])
rows+=crit(4,'Accepting documents from external sources without risk',
 ['On-device file scanning','Cloud-based sandbox detonation (also offered on premises)','✖Does not evaluate files for PII or prohibited content','✖No audit trail for accept/reject with rule and approver'],
 ['K7 File Security Monitoring runs entirely within the perimeter as a platform module','Air-gapped, if required by regulators','Danger and permissibility judged together','Removal of active content to disarm files'],
 ['No per-platform sandbox estate to maintain','Accept, review, hold or reject decisions for every document with rules, evidence and approver, written to a tamper-evident record'])
rows+=crit(5,'Knowing what is coming, not only what has already arrived',
 ['Attacker attribution for detected threats','✖Proactive reporting requires a separate intelligence offering'],
 ['K7 Ecosystem Threat Intelligence feeds, specific to your sector or your region, delivered as STIX2'],
 ['Threat intelligence built around K7 Labs\' research and K7\'s protection telemetry from more than 40 million devices across the globe','Dual consumer and business estates enable gathering of intelligence from regional campaigns before they reach enterprise targets'])
rows+=batch('Data and access','What is sensitive, where it can go, and who can reach it')
rows+=crit(6,'Knowing what information is sensitive',
 ['Finds and classifies sensitive data across machines, browsers, cloud and SaaS applications','Windows, macOS: discovery and classification on the endpoint','Linux: served by Falcon Data Protection for Cloud, for cloud workloads and containers','✖No data classification for Linux servers that are not cloud workloads'],
 ['Rules based on file content, not file name','Classification and enforcement are one policy on one console'],
 ['No gap between what the platform knows is sensitive and what it will stop'])
rows+=crit(7,'Controlling where information is allowed to go',
 ['USB control on Windows and macOS','Data transmission via upload, cloud storage or AI tools is handled by Falcon Data Protection on Windows and macOS endpoints, and Falcon Data Protection for Cloud for Linux cloud workloads','✖Does not cover Linux file server, application server or database host'],
 ['Transfer (uploads, copy and paste, cloud storage, printing, pasting into public AI tools) is blocked the moment it happens by the agent on the machine and, where required, at the perimeter'],
 ['One policy, one log, whatever the channel'])
rows+=crit(8,'Proving what someone with legitimate access actually did',
 ['Indicates who changed a file, and grants administrator rights, on Windows, macOS and Linux','✖Does not include privileged session recording','✖Behavioural analysis runs on identity and SIEM products, not on the endpoint record'],
 ['Continuous record of every change, with the acting user, process and parent process attached','Real-time scan on Windows and Linux, scheduled scan on macOS'],
 ['Establishes, even months later, what a user touched, even with a valid login'])
rows+=batch('Compliance and proving control','Evidencing controls, hardening systems, and keeping the proof')
rows+=crit(9,'Proving to auditors and regulators that controls are working',
 ['Compliance dashboards for your cloud, and those your team builds in the SIEM','✖Laptops and servers: nothing is mapped to a regulation; Falcon\'s reports have to be manually linked to auditors\' requests'],
 ['Every detection rule already carries the control it evidences','Each framework has a live view, not an export'],
 ['Ships with PCI DSS, GDPR, HIPAA, NIST 800-53 and SOC 2 ready-mapped','Compliance reporting is a by-product of detection, not a separate exercise'])
rows+=crit(10,'Keeping systems hardened, and proving they stay hardened',
 ['Checks your machines against CIS and STIG benchmarks','Indicates what is misconfigured and how to fix it, and can fix some of it automatically','✖Does not indicate which regulation has been violated; audit answers require manual compilation'],
 ['Pass or fail against CIS for every machine is tracked over time','Every failed check carries the associated regulation','Regulator\'s, or your own, baseline can be configured as policy; feature changes are not required'],
 ['Output is audit evidence, not a to-do list','Enables quick identification of drift from standards'])
rows+=batch('Security economics','What the platform costs to run and to staff')
rows+=crit(11,'The real cost of a security platform is people, not licences',
 ['One agent, one console on Windows, macOS and Linux','✖Mobile security is on a different console','✖Exposure management, identity, next-gen SIEM and automation each need someone who knows them','✖Incident analysis requires assembling events across functions, by people who each know only one part'],
 ['One platform, one console, one record','Machine, person, what changed, and the response associated with an event are recorded together'],
 ['Incident reconstruction is a query, not a project','Savings in hours spent monitoring each console and reconciling one system\'s account against another\'s'])
rows+=crit(12,'Running security on your terms: on-premises, cloud or managed',
 ['Falcon is delivered from CrowdStrike\'s cloud','Falcon Complete adds round-the-clock monitoring and response, using CrowdStrike\'s own experts','✖No on-premises deployment','✖If your telemetry cannot leave your environment, Falcon is not a candidate at any price, in any region','✖Falcon Complete is staffed by CrowdStrike alone; the partner who knows your estate leaves the response chain'],
 ['One product, three deployment models: on-premises, regional cloud, K7-operated regional cloud','K7 owns detection and response; your local partner keeps the relationship, the deployment and first-line support','MDR runs on the cloud model'],
 ['Deployment factor is not a constraint','K7 has a solution if you need nothing to leave your environment','K7 also has a solution if you need someone to manage cybersecurity 24/7'])
b=banner('Why K7 · Competitor comparison','K7 Seventh Sense vs CrowdStrike Falcon Insight XDR','K7 vs CrowdStrike','K7 Seventh Sense compared with CrowdStrike Falcon Insight XDR, capability by capability.','<a class="btn btn-primary" href="#next-step">Request demo →</a><a class="btn btn-line" href="Platform.dc.html">Explore platform</a>')
b+='''
<section class="sheet g-panel" id="why">
  %s
  %s
  <p class="body-l" style="margin: clamp(32px, 4cqw, 56px) 0 0; max-width: 62ch;">K7 Seventh Sense stops an attack, undoes it and proves it, from inside your own environment, on a fully proprietary platform, on a detection engine K7 builds and owns. K7 delivers what your Board and auditors want, with no handovers that require additional licences, specialists and costs.</p>
</section>
<section class="sheet g-paper" id="comparison">
  %s
  %s
  <div class="table-wrap" style="margin-top: clamp(40px, 5cqw, 72px);"><table class="dtable" style="min-width: 960px;">
    <thead><tr><th style="width: 22%%;">Capability</th><th style="width: 26%%;">CrowdStrike Falcon Insight XDR</th><th class="is-k7" style="width: 26%%;">K7 Seventh Sense</th><th>K7's advantage</th></tr></thead>
    <tbody>
%s    </tbody>
  </table></div>
  <div class="actions" style="margin-top: 32px;"><a class="btn btn-line" href="Platform.dc.html">Explore platform</a><a class="link-u" href="#next-step">Request demo →</a></div>
</section>
'''%(tab(2,4,'Why K7',1), head('Stops it. Undoes it. Proves it.','CrowdStrike Falcon Insight XDR tells you what is vulnerable, but does not patch it; tells you what it detected, but not which regulation that evidences. Such capabilities require a handover to another tool, team or line on your budget.'),
 tab(3,4,'Comparison',0.5), head('Twelve capabilities.','Four themes, twelve criteria, and what each difference means for the organisation. ✔ is a capability; ✖ is a gap.'), rows)
b+=cta(4,4,'See the difference on your estate.','Request a demo and a K7 engineer will walk through these twelve criteria on your own endpoints, identities and data.','<a class="btn btn-primary" href="#next-step">Request demo →</a><a class="btn btn-line" href="Platform.dc.html">Explore platform</a>')
pages['Comparison-CrowdStrike']=dict(title='K7 vs CrowdStrike — Comparison',body=b,cur='why',h=6400,mh=11000)

# ---------- Contact Us ----------
def loc(name,addr,rows,map_):
    dl=''.join('<dt class="label">%s</dt><dd%s>%s</dd>'%(k,' class="sans"' if sans else '',v) for k,v,sans in rows)
    return '<div class="location"><h3 class="h-block">%s</h3><address>%s</address><dl class="meta-rows">%s</dl><figure class="ph" style="--ar: 16/7;"><figcaption>Map · %s</figcaption></figure></div>'%(name,addr,dl,map_)
locs=loc('India','K7 Enterprise Security Private Limited<br>2nd Floor, Tower C, Tek Meadows, No. 51, Rajiv Gandhi Salai (OMR), Sholinganallur, Chennai – 600 119, Tamil Nadu, India',
 [('Telephone','<a href="tel:+914466117777">+91-44-6611-7777</a>',0),('Fax','+91-44-6611-7788',0),('Sales','businessenquiry@k7computing.com',1),('Support','enterprisesupport@k7computing.com',1),('Toll free','<a href="tel:+18004190077">1800-419-0077</a>',0)],'Chennai')
locs+=loc('Singapore','K7 Computing Technologies Pte Ltd<br>1 North Bridge Road, #19-08, High Street Centre, Singapore 179094',
 [('Telephone','<a href="tel:+6531594200">+65-3159-4200</a>',0),('Sales','sales@k7computing.sg',1),('Support','support@k7computing.sg',1)],'Singapore')
locs+=loc('UAE','K7 Cyber Security FZCO<br>M2, Ali Saif Al Mansoori Business Center, M Floor, Arzoo Building, Next to Al Twar Centre, Al Qusais 2, Dubai, UAE',
 [('Telephone','<a href="tel:+971563672864">+971-56-367-2864</a>',0),('Email','businessenquiry@k7computing.com',1),('Support','enterprisesupport@k7computing.com',1)],'Dubai')
b=banner('About Us · Contact','India · Singapore · UAE','Contact Us','Three offices. Sales, support and media enquiries, answered by the people who build and run the platform.','<a class="btn btn-primary" href="#enquiry">Send an enquiry →</a><a class="btn btn-line" href="tel:+914466117777">Call Chennai</a>')
b+='''
<section class="sheet g-panel" id="offices">
  %s
  %s
  <div class="locations" style="margin-top: clamp(40px, 5cqw, 72px);">%s</div>
</section>
<section class="sheet g-paper" id="enquiry">
  %s
  <div class="sheet-head"><h2 class="h-sheet">Let us know your questions or enquiries.</h2><p class="muted body-s">Fields marked * are mandatory.</p></div>
  <form class="form-grid" style="margin-top: clamp(40px, 5cqw, 72px);">
    <div class="field"><label class="label" for="c-first">First name *</label><div class="control"><input id="c-first" type="text"></div></div>
    <div class="field"><label class="label" for="c-last">Last name *</label><div class="control"><input id="c-last" type="text"></div></div>
    <div class="field"><label class="label" for="c-company">Company name *</label><div class="control"><input id="c-company" type="text"></div></div>
    <div class="field"><label class="label" for="c-email">Email address *</label><div class="control"><input id="c-email" type="email"></div></div>
    <div class="field"><label class="label" for="c-country">Country</label><div class="control is-select"><select id="c-country"><option>India</option><option>Singapore</option><option>United Arab Emirates</option><option>Other</option></select></div></div>
    <div class="field"><label class="label" for="c-phone">Phone</label><div class="control"><input id="c-phone" type="tel"></div></div>
    <div class="field"><label class="label" for="c-type">Type of enquiry</label><div class="control is-select"><select id="c-type"><option>Sales</option><option>Support</option><option>Press and Media Relations</option><option>Other Enquiry</option></select></div></div>
    <div class="field span-2"><label class="label" for="c-msg">Enter your message here *</label><div class="control"><textarea id="c-msg"></textarea></div></div>
    <div class="form-foot span-2"><a class="link-u" href="https://www.k7computing.com/in/privacy-policy">Privacy Policy</a><button class="btn btn-primary" type="submit">Submit</button></div>
  </form>
</section>
'''%(tab(2,3,'Offices',1), head('Where we are.','K7 Enterprise Security in Chennai, K7 Computing Technologies in Singapore and K7 Cyber Security in Dubai.'), locs, tab(3,3,'Enquiry',0))
pages['Contact']=dict(title='Contact Us',body=b,cur='about',h=4200,mh=7600)

# ---------- Form: Request Quote, XDR ----------
b='''
<section class="sheet g-paper hero-u" id="top" style="padding-bottom: 0;">
  <div class="hero-meta" style="margin-bottom: 0;"><span class="label">Platform · Core · K7 Seventh Sense XDR</span><span class="label">Request quote</span></div>
</section>
<section class="sheet g-panel" id="form" style="margin-top: 56px;">
  <div class="sheet-tab" style="--k: 0;"><span><i class="pixel"></i><span class="label">Request quote</span></span><span class="label">XDR</span></div>
  <div class="sheet-head"><h2 class="h-sheet">K7 Seventh Sense XDR</h2><p class="muted body-s">Fields marked * are mandatory. Tell us the size of your estate and we will come back with a quote.</p></div>
  <form class="form-grid" style="margin-top: clamp(40px, 5cqw, 72px); max-width: 960px;">
    <div class="field"><label class="label" for="q-company">Company name *</label><div class="control"><input id="q-company" type="text"></div></div>
    <div class="field"><label class="label" for="q-person">Contact person *</label><div class="control"><input id="q-person" type="text"></div></div>
    <div class="field"><label class="label" for="q-email">Contact email *</label><div class="control"><input id="q-email" type="email"></div></div>
    <div class="field"><label class="label" for="q-phone">Contact phone *</label><div class="control"><input id="q-phone" type="tel"></div></div>
    <div class="field"><label class="label" for="q-country">Country *</label><div class="control is-select"><select id="q-country"><option>India</option></select></div></div>
    <div class="field"><label class="label" for="q-state">State *</label><div class="control is-select"><select id="q-state"><option>Select a State</option></select></div></div>
    <div class="field"><label class="label" for="q-city">City *</label><div class="control"><input id="q-city" type="text"></div></div>
    <div class="field"><label class="label" for="q-emp">No. of employees *</label><div class="control"><input id="q-emp" type="number" min="1"></div></div>
    <div class="field span-2"><label class="label" for="q-comment">Comment</label><div class="control"><textarea id="q-comment"></textarea></div></div>
    <div class="consent span-2">
      <label class="check"><input id="q-all" type="checkbox"> Select all</label>
      <label class="check"><input id="q-consent" type="checkbox"> I agree to the collection and processing of my personal data for the stated purpose *</label>
      <label class="check"><input id="q-updates" type="checkbox"> I would like to receive updates from K7 CyberSecurity</label>
    </div>
    <div class="form-foot span-2"><a class="link-u" href="https://www.k7computing.com/in/privacy-policy">Privacy Policy</a><button class="btn btn-primary" type="submit">Submit</button></div>
  </form>
</section>
'''
pages['Form-Quote-XDR']=dict(title='Request quote — K7 Seventh Sense XDR',body=b,cur='platform',h=1500,mh=2200)

for name,p in pages.items():
    cur={'cur_platform':'','cur_solutions':'','cur_services':''}
    if 'cur_'+p['cur'] in cur: cur['cur_'+p['cur']]=' aria-current="page"'
    html=HEAD%dict(title=p['title'],**cur)+p['body']+FOOT%dict(h=p['h'])
    open(OUT+name+'.dc.html','w').write(html)
    open(OUT+name+'-Mobile.dc.html','w').write(MOBILE%dict(title=p['title'],name=name,h=p['mh']))
    print(name,len(html))
