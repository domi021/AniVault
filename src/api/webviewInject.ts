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
  'bit.ly', 'tinyurl.com', 'adf.ly', 'bc.vc',
  'shorte.st', 'sh.st', 'adfoc.us', 'linkbucks.com',
  'adfly.com', 'linkshrink.net', 'vivads.net',
  'clickaine.com', 'popmyads.com', 'pushame.com',
  'onclickads.net', 'revcontent.com', 'mgid.com',
  'serving-sys.com', 'smaato.net', 'inmobi.com',
  'applovin.com', 'mintegral.com', 'vungle.com',
  'ironsrc.com', 'chartboost.com',
];

export function extractIframeSrc(html: string): string | null {
  const match = html.match(/<iframe\s[^>]*src\s*=\s*"?([^"\s>]+)/i);
  return match ? match[1] : null;
}

export function getAdBlockJS(): string {
  return `
(function() {
  try {
    var g = [
      'google_ima', 'ima', 'googletag', 'googletagcmd',
      '__gads', '__qpa', '__tcfapi', '__cmp',
      'adsbygoogle', 'google_ad_modifications',
    ];
    for (var i = 0; i < g.length; i++) {
      try { window[g[i]] = null; } catch(e) {}
    }
  } catch(e) {}

  try {
    window.open = function(url) {
      if (url && typeof url === 'string') {
        var lower = url.toLowerCase();
        for (var i = 0; i < AD_DOMAINS.length; i++) {
          if (lower.indexOf(AD_DOMAINS[i]) !== -1) return null;
        }
      }
      return null;
    };
  } catch(e) {}
})();
true;
`;
}

export function getPlayerJS(): string {
  return `
(function() {
  try {
    var SELECTORS = [
      'ins.adsbygoogle',
      '[id*="google_ads"]',
      '[class*="google-ad"]',
      '[id*="div-gpt-ad"]',
      '[class*="gpt-ad"]',
      '[id*="prebid"]',
      '[class*="prebid"]',
    ];

    var FIXED_OVERLAY = 'div[style*="position: fixed"][style*="z-index"]';

    function ra() {
      try {
        document.querySelectorAll(SELECTORS.join(',')).forEach(function(e) { e.remove(); });
      } catch(ex) {}

      try {
        document.querySelectorAll('iframe').forEach(function(f) {
          var src = (f.src || f.getAttribute('data-src') || '').toLowerCase();
          for (var i = 0; i < AD_DOMAINS.length; i++) {
            if (src.indexOf(AD_DOMAINS[i]) !== -1) { f.remove(); return; }
          }
          var style = (f.getAttribute('style') || '').toLowerCase();
          if (style.indexOf('position:fixed') !== -1 || style.indexOf('position: fixed') !== -1) {
            var zi = style.match(/z-index:\\s*(\\d+)/);
            if (zi && parseInt(zi[1], 10) > 1000) f.remove();
          }
        });
      } catch(ex) {}

      try {
        document.querySelectorAll(FIXED_OVERLAY).forEach(function(e) {
          var style = window.getComputedStyle(e);
          if (style.position !== 'fixed') return;
          var zi = parseInt(style.zIndex, 10);
          if (zi > 1000 && zi < 99999) {
            var rect = e.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) e.remove();
          }
        });
      } catch(ex) {}

      try {
        document.querySelectorAll('[onclick]').forEach(function(e) {
          var oc = (e.getAttribute('onclick') || '').toLowerCase();
          if (oc.indexOf('window.open') !== -1 && oc.indexOf('http') !== -1) {
            e.removeAttribute('onclick');
          }
        });
      } catch(ex) {}
    }

    ra();
    if (document.body) {
      new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0) { ra(); break; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }

    try {
      var st = document.createElement('style');
      st.textContent =
        '[id*="google_ads"]{display:none!important}' +
        '[class*="gpt-ad"]{display:none!important}' +
        '[id*="prebid"]{display:none!important}' +
        '[class*="prebid"]{display:none!important}' +
        'ins.adsbygoogle{display:none!important}';
      if (document.head) document.head.appendChild(st);
    } catch(ex) {}

    var li = document.createElement('div');
    li.style.cssText = 'position:fixed;top:50%;transform:translateY(-50%);width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:28px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .25s;left:15%';
    li.textContent = '\\u27F210';

    var ri = document.createElement('div');
    ri.style.cssText = 'position:fixed;top:50%;transform:translateY(-50%);width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:28px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .25s;right:15%';
    ri.textContent = '10\\u27F3';

    if (document.body) {
      document.body.appendChild(li);
      document.body.appendChild(ri);
    }

    var lastTap = 0, lastTapX = 0;
    function show(el) {
      el.style.opacity = '1';
      setTimeout(function() { el.style.opacity = '0'; }, 400);
    }

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
        lastTap = now;
        lastTapX = t.clientX;
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
