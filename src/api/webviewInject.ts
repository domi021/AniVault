import adList from '../../electron/ad-domains.json';

// Single source of truth, shared with electron/main.js. See the file for why
// the two consumers must not keep separate copies.
const AD_DOMAINS: string[] = adList.adDomains;
const PLAYER_ALLOW_HOSTS: string[] = adList.playerAllowHosts;
const AD_URL_HINTS: string[] = adList.adUrlHints;



// Substrings that show up in ad iframe/script URLs even when the host is
// first-party or unknown, so host-list matching alone misses a lot.


// Hosts that must never be blocked. Kept as a safety net so that future edits
// to AD_DOMAINS cannot accidentally break playback: the m3u8 stream for
// megaplay is served from fetch.nexabloom.top.
//
// NOTE: do not add path-based rules here. The real media segments and the
// popunder beacons share the /anime/<hash>/<hash> shape, so matching on path
// blocks playback (verified: readyState stuck at 0, JW reports e=err).
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function shouldBlockAdUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const host = hostOf(lower);
  if (host && PLAYER_ALLOW_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return false;
  }
  return AD_DOMAINS.some((d) => lower.includes(d));
}

export function extractIframeSrc(html: string): string | null {
  const match = html.match(/<iframe\s[^>]*src\s*=\s*"?([^"\s>]+)/i);
  return match ? match[1] : null;
}

export function getAdBlockJS(): string {
  return `
(function() {
  var AD_DOMAINS = ${JSON.stringify(AD_DOMAINS)};
  var ALLOW = ${JSON.stringify(PLAYER_ALLOW_HOSTS)};
  function blocked(u) {
    var lower = (u || '').toLowerCase();
    for (var i = 0; i < ALLOW.length; i++) {
      if (lower.indexOf('//' + ALLOW[i]) !== -1) return false;
    }
    for (var j = 0; j < AD_DOMAINS.length; j++) {
      if (lower.indexOf(AD_DOMAINS[j]) !== -1) return true;
    }
    return false;
  }
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

  // Unconditional block, NOT a blocklist filter. The player never legitimately
  // needs to open a window (fullscreen goes through the native controls), and
  // the ad unit opens popunders from rotating domains that are not in the
  // list. Do not "improve" this into a passthrough for unlisted URLs: that
  // re-enables popunders, which is what the pre-existing behaviour prevented
  // (it returned null / threw for every URL, so nothing ever opened).
  try {
    window.open = function() { return null; };
  } catch(e) {}

  // Popunder beacons are same-page XHR/fetch calls. On Android the native
  // onShouldStartLoadWithRequest only sees MAIN-FRAME navigations, so those
  // requests were never blocked and the response script could still call
  // window.open(). Abort them here. Never matches the player itself: the
  // allowlist check runs first, and hls.js reads the m3u8 over XHR.
  try {
    var XHR = window.XMLHttpRequest;
    if (XHR && XHR.prototype) {
      var xOpen = XHR.prototype.open;
      XHR.prototype.open = function(method, url) {
        try { this.__anivaultBlocked = blocked(url); } catch(e) {}
        return xOpen.apply(this, arguments);
      };
      var xSend = XHR.prototype.send;
      XHR.prototype.send = function() {
        if (this.__anivaultBlocked) {
          // Fail asynchronously so the caller sees a completed request
          // instead of hanging forever on a response that never arrives.
          try {
            var self = this;
            setTimeout(function() {
              try { self.dispatchEvent(new Event('error')); } catch(e) {}
              try { self.dispatchEvent(new Event('loadend')); } catch(e) {}
              try { if (self.onerror) self.onerror(new Event('error')); } catch(e) {}
            }, 0);
          } catch(e) {}
          return undefined;
        }
        return xSend.apply(this, arguments);
      };
    }
  } catch(e) {}

  try {
    if (typeof window.fetch === 'function') {
      var fOrig = window.fetch;
      window.fetch = function(input) {
        var u = '';
        try { u = typeof input === 'string' ? input : (input && input.url) || ''; } catch(e) {}
        if (blocked(u)) return Promise.reject(new Error('blocked by adblock'));
        return fOrig.apply(this, arguments);
      };
    }
  } catch(e) {}
})();
true;
`;
}

export function getPlayerJS(): string {
  return `
(function() {
  var AD_DOMAINS = ${JSON.stringify(AD_DOMAINS)};
  var AD_HINTS = ${JSON.stringify(AD_URL_HINTS)};
  var ALLOW = ${JSON.stringify(PLAYER_ALLOW_HOSTS)};
  function blocked(u) {
    var lower = (u || '').toLowerCase();
    for (var i = 0; i < ALLOW.length; i++) {
      if (lower.indexOf('//' + ALLOW[i]) !== -1) return false;
    }
    for (var j = 0; j < AD_DOMAINS.length; j++) {
      if (lower.indexOf(AD_DOMAINS[j]) !== -1) return true;
    }
    return false;
  }
  try {
    var SELECTORS = [
      'ins.adsbygoogle',
      '[id*="google_ads"]',
      '[class*="google-ad"]',
      '[id*="div-gpt-ad"]',
      '[class*="gpt-ad"]',
      '[id*="prebid"]',
      '[class*="prebid"]',
      // The player injects its own ad unit as a first-party child, so the
      // container URL is always allowlisted and no host blocklist can match
      // it. Live DOM: <div class="afs_ads ad-placement" style="width:1px;
      // height:1px; position:absolute">. The script that fills it in still
      // loads on Android, so the container has to be removed here.
      '.afs_ads',
      '[class*="afs_ads"]',
      '[class*="ad-placement"]',
      '[class*="popunder"]',
      '[class*="clickunder"]',
      '[class*="interstitial"]',
    ];
    var AD_SEL = SELECTORS.join(',');
    var reported = {};

    function desc(e) {
      if (!e || !e.tagName) return '?';
      var s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      if (e.className && typeof e.className === 'string') {
        s += '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.');
      }
      return s;
    }
    // Everything the sweeper decides is echoed here. On Android a WebView
    // console.log does not reach the Metro terminal on its own, so the same
    // line is pushed over postMessage and printed by the app.
    function report(line) {
      try { console.log(line); } catch (x) {}
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(line);
        }
      } catch (x) {}
    }

    // Surfaced to the app over postMessage (console.log from an Android
    // WebView does not reliably reach the Metro terminal) so an ad that
    // survives can be identified by name instead of guessed at.
    function note(kind, e) {
      var d = desc(e);
      if (reported[d]) return;
      reported[d] = 1;
      report('[anivault-ad] removed ' + kind + ' ' + d);
    }

    // The player and our own controls are never touched.
    function isPlayer(e) {
      if (!e || e.nodeType !== 1) return true;
      var t = e.tagName;
      if (t === 'VIDEO' || t === 'SOURCE' || t === 'TRACK') return true;
      if (e.closest && e.closest('.jwplayer, #megaplay-player, [data-anivault]')) return true;
      try { if (e.querySelector && e.querySelector('video')) return true; } catch (x) {}
      return false;
    }

    function kill(kind, e) {
      if (!e || !e.parentNode) return;
      note(kind, e);
      try { e.remove(); } catch (x) {}
    }

    function ra() {
      // 1. Known ad containers. Removed even inside the player subtree,
      //    because that is exactly where the ad unit is injected.
      try {
        document.querySelectorAll(AD_SEL).forEach(function (e) { kill('container', e); });
      } catch (ex) {}

      // 2. Ad scripts. On desktop main.js cancels these at the network layer.
      //    On Android they still load, so drop the tags we can see.
      try {
        document.querySelectorAll('script[src]').forEach(function (s) {
          var t = (s.src || '').toLowerCase();
          if (blocked(s.src)) { kill('script', s); return; }
          for (var i = 0; i < AD_HINTS.length; i++) {
            if (t.indexOf(AD_HINTS[i]) !== -1) { kill('script', s); return; }
          }
        });
      } catch (ex) {}

      // 3. Ad iframes, plus large src-less iframes (ad shells).
      try {
        document.querySelectorAll('iframe').forEach(function (f) {
          if (isPlayer(f)) return;
          var src = (f.src || f.getAttribute('data-src') || '').toLowerCase();
          for (var i = 0; i < AD_DOMAINS.length; i++) {
            if (src.indexOf(AD_DOMAINS[i]) !== -1) { kill('iframe', f); return; }
          }
          for (var j = 0; j < AD_HINTS.length; j++) {
            if (src.indexOf(AD_HINTS[j]) !== -1) { kill('iframe', f); return; }
          }
          if (!src && !f.getAttribute('data-src') && f.width > 200 && f.height > 200) {
            kill('shell', f);
          }
        });
      } catch (ex) {}

      // 4. Stacked overlays. Deliberately narrow: only elements with an
      //    explicit high z-index, which is what an ad needs to sit on top of
      //    the video. Size alone is NOT enough - the player's own 1280x872
      //    wrapper is position:absolute with z-index auto and would be
      //    destroyed by a size heuristic.
      try {
        document.querySelectorAll('div, section, aside, iframe, img, a').forEach(function (e) {
          if (isPlayer(e)) return;
          var cs = getComputedStyle(e);
          if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') return;
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
          var zi = parseInt(cs.zIndex, 10) || 0;
          if (zi < 1000) return;
          var r = e.getBoundingClientRect();
          if (r.width < 40 || r.height < 40) return;
          kill('overlay', e);
        });
      } catch (ex) {}

      // 5. Inline window.open redirect handlers.
      try {
        document.querySelectorAll('[onclick]').forEach(function (e) {
          var oc = (e.getAttribute('onclick') || '').toLowerCase();
          if (oc.indexOf('window.open') !== -1 && oc.indexOf('http') !== -1) {
            try { e.removeAttribute('onclick'); note('onclick', e); } catch (x) {}
          }
        });
      } catch (ex) {}
    }

    ra();

    // Backstop: a MutationObserver alone is defeated by scripts that mutate
    // on rAF or inside shadow roots, which is how the popunder animates in.
    try { setInterval(ra, 500); } catch (ex) {}

    if (document.body) {
      try {
        new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            if (muts[i].addedNodes.length > 0) { ra(); return; }
          }
        }).observe(document.body, { childList: true, subtree: true });
      } catch (ex) {}
    }

    // Drop ad containers at insertion so they never paint, instead of
    // removing them a frame later.
    try {
      var proto = Node.prototype;
      var realAppend = proto.appendChild;
      proto.appendChild = function (n) {
        try {
          if (n && n.nodeType === 1 && n.matches && n.matches(AD_SEL)) { note('append', n); return n; }
        } catch (x) {}
        return realAppend.apply(this, arguments);
      };
      var realInsert = proto.insertBefore;
      proto.insertBefore = function (n) {
        try {
          if (n && n.nodeType === 1 && n.matches && n.matches(AD_SEL)) { note('insert', n); return n; }
        } catch (x) {}
        return realInsert.apply(this, arguments);
      };
    } catch (ex) {}

    // Belt and braces with the DOM removal: hide them from the first paint.
    try {
      var st = document.createElement('style');
      st.setAttribute('data-anivault', '1');
      st.textContent = AD_SEL.split(',').map(function (s) {
        return s + '{display:none!important}';
      }).join('');
      if (document.head) document.head.appendChild(st);
    } catch (ex) {}

    // Touch-triggered clickunder. The ad unit makes the page itself a link,
    // so a tap navigates this WebView to the advertiser. With
    // setSupportMultipleWindows=false that replaces the player IN PLACE,
    // which is what an "ad popping up inside the video player" looks like.
    // Anchors are neutralised rather than opened, and any anchor covering
    // most of the viewport is removed outright.
    try {
      var hrefOk = function (h) {
        if (!h) return true;
        if (h === '#' || h.charAt(0) === '#') return true;
        if (/^javascript:/i.test(h)) return true;
        if (blocked(h)) return false;
        for (var i = 0; i < ALLOW.length; i++) {
          if (h.indexOf(ALLOW[i]) !== -1) return true;
        }
        // Any absolute off-site link from inside the player is an ad.
        if (/^https?:/i.test(h)) return false;
        return true;
      };
      var stopNav = function (e, a) {
        report('[anivault-nav] blocked tap nav -> ' + (a.getAttribute('href') || '').slice(0, 100));
        try { e.preventDefault(); } catch (x) {}
        try { e.stopPropagation(); } catch (x) {}
      };
      ['click', 'touchend'].forEach(function (ev) {
        document.addEventListener(ev, function (e) {
          try {
            var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (a && !hrefOk(a.getAttribute('href'))) stopNav(e, a);
          } catch (x) {}
        }, true);
      });
      // A full-viewport anchor is a clickunder, never a real control.
      try {
        document.querySelectorAll('a[href]').forEach(function (a) {
          if (isPlayer(a)) return;
          var r = a.getBoundingClientRect();
          if (r.width > window.innerWidth * 0.7 && r.height > window.innerHeight * 0.7) {
            kill('clickunder', a);
          }
        });
      } catch (ex) {}
    } catch (ex) {}

    var li = document.createElement('div');
    li.setAttribute('data-anivault', '1');
    li.style.cssText = 'position:fixed;top:50%;transform:translateY(-50%);width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:28px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .25s;left:15%';
    li.textContent = '\\u27F210';

    var ri = document.createElement('div');
    ri.setAttribute('data-anivault', '1');
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
        e.preventDefault();
        e.stopPropagation();
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
    }, { passive: false, capture: true });
  } catch(e) {}
})();
true;
`;
}

