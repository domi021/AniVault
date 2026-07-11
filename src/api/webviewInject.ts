const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'popads.net', 'advertising.com',
  'exoclick.com', 'propellerads.com', 'trafficfactory.biz',
  'adsterra.com', 'adbico.com', 'adbanners',
  'an.yandex.ru', 'mc.yandex.ru',
  'scorecardresearch.com', 'outbrain.com', 'taboola.com',
  'criteo.com', 'criteo.net', 'casalemedia.com',
  'adsrvr.org', 'adsymptotic.com', 'adnxs.com',
  'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'indexww.com', 'agkn.com', 'media.net',
  'amazon-adsystem.com', 'aax.amazon-adsystem.com',
  'adsafeprotected.com', 'moatads.com', 'imrworldwide.com',
  '2mdn.net', 'g.doubleclick.net', 'securepubads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
];

export function extractIframeSrc(html: string): string | null {
  const match = html.match(/<iframe\s[^>]*src\s*=\s*"?([^"\s>]+)/i);
  return match ? match[1] : null;
}

export function getAdBlockJS(): string {
  return `
(function() {
  try { window.google && (google.ima = null); } catch(e) {}
  try { window.ima = null; } catch(e) {}
  try { window.googletag = null; } catch(e) {}
  try { window.open = function() { return null; }; } catch(e) {}
})();
true;
`;
}

export function getPlayerJS(): string {
  return `
(function() {
  try {
    /* Remove ad elements */
    function ra() {
      ['[class*="ad-"]','[class*="ads-"]','[id*="ad-"]','[id*="ads-"]',
       '[class*="popup"]','[id*="popup"]','[class*="banner"]','[id*="banner"]',
       'ins.adsbygoogle'].forEach(function(s) {
        try { document.querySelectorAll(s).forEach(function(e) { e.remove(); }); } catch(e) {}
      });
    }
    ra();
    if (document.body) {
      new MutationObserver(ra)
        .observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    /* Double-tap skip 10s */
    var st = document.createElement('style');
    st.textContent = '.si{position:fixed;top:50%;transform:translateY(-50%);width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:28px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .25s}.si.s{opacity:1}.si.l{left:15%}.si.r{right:15%}';
    if (document.head) document.head.appendChild(st);

    var li = document.createElement('div'); li.className = 'si l'; li.textContent = '⟲10';
    var ri = document.createElement('div'); ri.className = 'si r'; ri.textContent = '10⟳';
    if (document.body) {
      document.body.appendChild(li);
      document.body.appendChild(ri);
    }

    var lastTap = 0, lastTapX = 0;
    function show(el) { el.classList.add('s'); setTimeout(function(){el.classList.remove('s')},400); }

    document.addEventListener('touchend', function(e) {
      var t = e.changedTouches[0];
      if (!t) return;
      var now = Date.now();
      if (now - lastTap < 350 && Math.abs(t.clientX - lastTapX) < 50) {
        var v = document.querySelector('video');
        if (v && isFinite(v.duration)) {
          if (t.clientX < window.innerWidth / 2) {
            v.currentTime = Math.max(0, v.currentTime - 10);
            show(li);
          } else {
            v.currentTime = Math.min(v.duration, v.currentTime + 10);
            show(ri);
          }
        }
        lastTap = 0;
      } else {
        lastTap = now; lastTapX = t.clientX;
      }
    }, { passive: true, capture: true });
  } catch(e) {}
})();
true;
`;
}

export function shouldBlockAdUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return AD_DOMAINS.some((d) => lower.includes(d));
}
