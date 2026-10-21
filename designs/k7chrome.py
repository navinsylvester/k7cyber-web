import os
SCR='/tmp/claude-1000/-home-navin-code-k7cyber-web/0327a34e-2202-429c-9930-d4acd4cd1835/scratchpad'
OUT=SCR+'/k7-pages/project/'
HEAD='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%(title)s</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/k7/tokens.css">
<link rel="stylesheet" href="ds/k7/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<style>
body{margin:0;background:#0a0a09}
a{color:inherit}a:hover{color:#ff6647}
</style>
</helmet>
<div class="page" data-theme="{{theme}}" style="min-height: 100%%; background: var(--paper); color: var(--ink); font-family: var(--font-sans);">

<header class="site-header g-paper">
  <div class="bar">
    <a class="brand" href="Main.dc.html" aria-label="K7 CyberSecurity">
      <sc-if value="{{isDark}}" hint-placeholder-val="{{true}}"><img src="/_blob/9d01d02852773043853d31caa5213fa6" alt="K7 CyberSecurity"></sc-if>
      <sc-if value="{{isLight}}" hint-placeholder-val="{{false}}"><img src="/_blob/9ebd49ce79d48dde4518b17d830cd766" alt="K7 CyberSecurity"></sc-if>
    </a>
    <nav class="main-nav" aria-label="Main">
      <button aria-expanded="false"%(cur_platform)s>Platform <i class="chev"></i></button>
      <button aria-expanded="false"%(cur_solutions)s>Solutions <i class="chev"></i></button>
      <button aria-expanded="false"%(cur_services)s>Services <i class="chev"></i></button>
      <a href="#partners">Partners</a>
      <button aria-expanded="false">Resources <i class="chev"></i></button>
      <button aria-expanded="false">About Us <i class="chev"></i></button>
      <button aria-expanded="false">Why K7 <i class="chev"></i></button>
      <a href="#support">Support</a>
    </nav>
    <div class="hdr-tools">
      <button type="button" class="theme-btn" aria-label="Theme: dark. Switch to light." title="Switch to light"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 4h24v24H4z M24 4L13 28 M28 10l-8.2 18 M28 18l-4.6 10"/><rect x="8" y="8" width="3" height="3"/></svg></button>
      <a class="btn btn-primary btn-sm" href="#next-step">Request demo →</a>
      <button class="btn btn-line btn-sm menu-btn" aria-label="Open menu">Menu</button>
    </div>
  </div>
</header>
'''
FOOT='''
<footer class="site-footer g-contrast">
  <div class="sheet-tab" style="--k: 0;"><span><i class="pixel"></i><span class="label">End of file</span></span><span class="label">2026</span></div>
  <div class="footer-grid">
    <div class="footer-brand"><img src="/_blob/9d01d02852773043853d31caa5213fa6" alt="K7 CyberSecurity" style="height: 30px; width: auto; align-self: flex-start;"><p class="body-s">Security that answers to you. Superior cybersecurity since 1991, built and supported in-house.</p><div class="social"><a href="#top" aria-label="LinkedIn"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 14v12 M15 26V14h9v12"/><rect x="7.5" y="8" width="3" height="3"/></svg></a><a href="#top" aria-label="X"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 8l13 13 M24 8L8 24"/><rect x="22.5" y="22.5" width="3" height="3"/></svg></a><a href="#top" aria-label="YouTube"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 8h24v16H4z M13 12l8 4-8 4z"/><rect x="7" y="11" width="3" height="3"/></svg></a><a href="#top" aria-label="Instagram"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5h22v22H5z M11 11h10v10H11z"/><rect x="22.5" y="7.5" width="3" height="3"/></svg></a><a href="#top" aria-label="Facebook"><svg class="licon" viewBox="0 0 32 32" aria-hidden="true"><path d="M17 27V8h5 M12 16h10"/><rect x="23.5" y="6.5" width="3" height="3"/></svg></a></div></div>
    <div class="footer-col"><h2 class="label">Company</h2><ol><li><a href="Main.dc.html"><span class="n">01</span>Home</a></li><li><a href="#top"><span class="n">02</span>About Us</a></li><li><a href="#top"><span class="n">03</span>Careers</a></li><li><a href="#next-step"><span class="n">04</span>Contact Us</a></li></ol></div>
    <div class="footer-col"><h2 class="label">Offer</h2><ol><li><a href="Platform.dc.html"><span class="n">01</span>Platform</a></li><li><a href="#top"><span class="n">02</span>Solutions</a></li><li><a href="#top"><span class="n">03</span>Services</a></li><li><a href="#top"><span class="n">04</span>Partners</a></li></ol></div>
    <div class="footer-col"><h2 class="label">Resources</h2><ol><li><a href="#top"><span class="n">01</span>Insight</a></li><li><a href="#top"><span class="n">02</span>Research</a></li><li><a href="#top"><span class="n">03</span>Media Room</a></li><li><a href="#top"><span class="n">04</span>Support</a></li></ol></div>
    <div class="footer-col"><h2 class="label">Legal</h2><ol><li><a href="#top"><span class="n">01</span>Privacy Policy</a></li><li><a href="#top"><span class="n">02</span>EULA</a></li></ol></div>
  </div>
  <div class="footer-mark" aria-hidden="true"><span class="wordmark-mark"></span><span>K7 CyberSecurity</span></div>
  <div class="footer-base body-s"><span>© 2026 K7 Enterprise Security Private Limited. All Rights Reserved.</span><span class="label">Chennai · Singapore · Dubai</span><span class="fresh is-fresh"><i class="fresh-px"></i><span class="label">Printed 16-10-2026</span></span></div>
</footer>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"dark","section":"Theme"},"$preview":{"width":1440,"height":%(h)d}}'>
class Component extends DCLogic {
  renderVals() {
    const theme = this.props.theme ?? 'dark';
    return { theme: theme, isDark: theme !== 'light', isLight: theme === 'light' };
  }
}
</script>
</body>
</html>
'''
MOBILE='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%(title)s, phone</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/k7/tokens.css">
<link rel="stylesheet" href="ds/k7/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<style>
body{margin:0;background:#0a0a09}
a{color:inherit}a:hover{color:#ff6647}
</style>
</helmet>
<div style="width: 100%%; max-width: 100%%; min-height: 100%%; background: #0a0a09; color: #efeee8; font-family: 'Archivo', system-ui, sans-serif;">
  <dc-import name="%(name)s" theme="{{theme}}" hint-size="100%%,%(h)dpx"></dc-import>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"dark","section":"Theme"},"$preview":{"width":390,"height":%(h)d}}'>
class Component extends DCLogic {
  renderVals() {
    return { theme: this.props.theme ?? 'dark' };
  }
}
</script>
</body>
</html>
'''
ICONS={
 'analysis':'<path d="M5 5h15v15H5z M20 20l7 7"/><rect x="11" y="11" width="3" height="3"/>',
 'advisory':'<path d="M6 5h20v12l-10 10-10-10z M17 9l-3 6h5l-3 6"/><rect x="8.5" y="8" width="3" height="3"/>',
 'ranking':'<path d="M4 27h24 M7 27V9 M13 27V14 M19 27V19 M25 27V23"/><rect x="5.5" y="4" width="3" height="3"/>',
 'report':'<path d="M10 4h13l5 5v18H10z M23 4v5h5 M6 8v23h17"/><rect x="14" y="13" width="3" height="3"/>',
 'definition':'<path d="M7 4h13l5 5v19H7z M20 4v5h5 M11 15h10 M11 20h10"/><rect x="11" y="8.5" width="3" height="3"/>',
 'telemetry':'<path d="M16 15v13 M11 28h10 M11 11l5-4 5 4 M6 13l10-9 10 9"/><rect x="14.5" y="12" width="3" height="3"/>',
 'outbreak':'<path d="M4 4h24v24H4z M12 4v24 M20 4v24 M4 12h24 M4 20h24"/><rect x="14.5" y="14.5" width="3" height="3"/>',
 'cleared':'<path d="M4 4h18l6 6v18H4z M9 16l5 5 9-9"/><rect x="7" y="7" width="3" height="3"/>',
 'monitor':'<path d="M4 6h24v16H4z M12 26h8 M16 22v4"/><rect x="7" y="9" width="3" height="3"/>',
 'lock':'<path d="M7 14h18v14H7z M11 14V7h10v7"/><rect x="14.5" y="19" width="3" height="3"/>',
 'patch':'<path d="M10 4h12l6 6v12l-6 6H10l-6-6V10z M16 10v12 M10 16h12"/><rect x="14.5" y="14.5" width="3" height="3"/>',
 'key':'<path d="M18 4h10v10H18z M18 14L4 28 M8 24l4 4 M12 20l3 3"/><rect x="21.5" y="7.5" width="3" height="3"/>',
 'devices':'<path d="M4 8h18v12H4z M10 24h6 M13 20v4 M24 12h4v12h-4z"/><rect x="7" y="11" width="3" height="3"/>',
 'pulse':'<path d="M4 16h8l3-8 5 16 3-8h5"/><rect x="14.5" y="14.5" width="3" height="3"/>',
 'clipboard':'<path d="M7 4h18v24H7z M11 11h10 M11 16h10 M11 21h6"/><rect x="20" y="19.5" width="3" height="3"/>',
 'network':'<path d="M4 24h8v4H4z M20 24h8v4h-8z M12 4h8v4h-8z M16 8v8 M8 24v-8h16v8"/><rect x="14.5" y="14.5" width="3" height="3"/>',
}
def icon(k): return '<svg class="licon" viewBox="0 0 32 32" aria-hidden="true">%s</svg>'%ICONS[k]
def cap(rows):
    return '<div class="cap-list" style="margin-top: clamp(40px, 5cqw, 72px);">\n'+''.join('    <div>%s<div><h3>%s</h3><p>%s</p></div></div>\n'%(icon(i),t,p) for i,t,p in rows)+'  </div>'
def tab(n,total,label,k): return '<div class="sheet-tab" style="--k: %s;"><span><i class="pixel"></i><span class="label">%02d/%02d</span></span><span class="label">%s</span></div>'%(k,n,total,label)
def head(h,lede,dim=None):
    d=' <span class="dim">%s</span>'%dim if dim else ''
    return '<div class="sheet-head"><h2 class="h-sheet">%s%s</h2><p class="lede">%s</p></div>'%(h,d,lede)
def banner(meta_l,meta_r,title,lede,actions):
    return '''<!-- 01 · Banner -->
<section class="sheet g-paper hero-u" id="top">
  <div class="hero-meta"><span class="label">%s</span><span class="label">%s</span></div>
  <div class="hero-grid">
    <h1 class="h-page">%s</h1>
    <div class="hero-side">
      <p class="lede">%s</p>
      <div class="actions">%s</div>
    </div>
  </div>
</section>
'''%(meta_l,meta_r,title,lede,actions)
def cta(n,total,h,p,actions):
    return '''
<section class="sheet g-signal cta-sheet" id="next-step">
  %s
  <div class="sheet-head"><h2 class="h-sheet">%s</h2><p>%s</p></div>
  <div class="cta-actions">%s</div>
</section>
'''%(tab(n,total,'Next step',0),h,p,actions)

