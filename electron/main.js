'use strict';

const { app, BrowserWindow, ipcMain, session, shell, components } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PLAYER_PARTITION = 'anivault-player';

const WIDEVINE_CDM_VERSION = '4.10.3050.0';

function seedWidevine() {
  try {
    const src = path.join(process.resourcesPath, 'widevine');
    if (!fs.existsSync(src)) return;
    const cdmRoot = path.join(app.getPath('userData'), 'WidevineCdm');
    const target = path.join(cdmRoot, WIDEVINE_CDM_VERSION);
    const marker = path.join(target, '_platform_specific', 'linux_x64', 'libwidevinecdm.so');
    if (!fs.existsSync(marker)) {
      fs.cpSync(src, target, { recursive: true });
      fs.writeFileSync(
        path.join(cdmRoot, 'latest-component-updated-widevine-cdm'),
        JSON.stringify({ Path: target })
      );
    }
  } catch {
    /* ignore seeding errors; component updater can still fetch the CDM */
  }
}

// Single source of truth, shared with src/api/webviewInject.ts.
const AD_LIST = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'ad-domains.json'), 'utf8')
);
const AD_DOMAINS = AD_LIST.adDomains;
const PLAYER_ALLOW_HOSTS = AD_LIST.playerAllowHosts;

// PLAYER_ALLOW_HOSTS is checked BEFORE AD_DOMAINS as a safety net so future
// edits to the ad list cannot break playback. Do NOT add path-based rules:
// the real media segments and the popunder beacons share the
// /anime/<hash>/<hash> shape, and matching on path blocks playback
// (verified: readyState stuck at 0, JW reports e=err).

const DIST_DIR = path.join(__dirname, '..', 'dist');

const APP_PORT = 37523;

let currentReferer = null;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let urlPath;  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(DIST_DIR, urlPath));
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const send = (file) => {
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  };

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      send(filePath);
      return;
    }
    if (!path.extname(urlPath)) {
      send(path.join(DIST_DIR, 'index.html'));
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(serveStatic);
    const tryListen = (port) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port === APP_PORT) {
          tryListen(0);
          return;
        }
        throw err;
      });
      server.listen(port, '127.0.0.1', () => {
        resolve({ server, port: server.address().port });
      });
    };
    tryListen(APP_PORT);
  });
}

const PLAYER_EMBED_HOSTS = ['megaplay.buzz', 'goload.pro', 'embtaku.pro'];

// Built from AD_LIST so the DOM cleanup and the network blocklist can never
// disagree. src/api/webviewInject.ts has the equivalent builder for the
// react-native-webview path; both read electron/ad-domains.json.
const ADBLOCK_JS = `
(function(){
  var AD = ${JSON.stringify(AD_LIST.adDomains)};
  var ALLOW = ${JSON.stringify(AD_LIST.playerAllowHosts)};
  function blocked(u){
    var s = (u || '').toLowerCase();
    for (var i = 0; i < ALLOW.length; i++) if (s.indexOf('//' + ALLOW[i]) !== -1) return false;
    for (var j = 0; j < AD.length; j++) if (s.indexOf(AD[j]) !== -1) return true;
    return false;
  }
  function sweep(){
    try {
      document.querySelectorAll('script[src]').forEach(function(s){
        if (blocked(s.src)) { s.remove(); return; }
      });
    } catch(e){}
    try {
      document.querySelectorAll('iframe').forEach(function(f){
        if (blocked(f.src || f.getAttribute('data-src') || '')) f.remove();
      });
    } catch(e){}
  }
  try {
    var _open = window.open;
    window.open = function(u){ return null; };
  } catch(e){}
  sweep();
  try {
    new MutationObserver(function(){ sweep(); }).observe(document.documentElement, {
      childList: true, subtree: true
    });
  } catch(e){}
})();
true;
`;

function setupPlayerSession() {
  const ses = session.fromPartition(PLAYER_PARTITION);
  let currentEmbedOrigin = null;

  const hostOf = (u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return null;
    }
  };

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    const url = details.url || '';

    if (currentReferer && /^https?:/i.test(url)) {
      let embedOrigin = null;
      try {
        embedOrigin = new URL(url).origin + '/';
      } catch {
        embedOrigin = null;
      }
      const isMainFrame = details.resourceType === 'mainFrame';
      const isPlayerEmbed =
        !isMainFrame && PLAYER_EMBED_HOSTS.includes(hostOf(url)) && /(stream|embed|player|s-)/i.test(url);

      if (isMainFrame) {
        currentEmbedOrigin = embedOrigin;
        requestHeaders.Referer = currentReferer;
      } else if (isPlayerEmbed) {
        if (currentEmbedOrigin && hostOf(url) !== hostOf(currentEmbedOrigin)) {
          requestHeaders.Referer = currentEmbedOrigin;
        } else {
          requestHeaders.Referer = currentReferer;
        }
        currentEmbedOrigin = embedOrigin;
      } else if (currentEmbedOrigin && hostOf(url) !== hostOf(currentEmbedOrigin)) {
        requestHeaders.Referer = currentEmbedOrigin;
      } else {
        requestHeaders.Referer = currentReferer;
      }
    }

    callback({ requestHeaders });
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = (details.url || '').toLowerCase();
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch {}
    const allowed = host && PLAYER_ALLOW_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    const blocked = !allowed && AD_DOMAINS.some((d) => url.includes(d));
    // Opt-in request trace for debugging the ad list. Off unless asked for.
    // Logs every decision that involves the allowlist, plus every block, so a
    // false positive (blocked playback) is immediately visible.
    if (
      process.env.ANIVAULT_DIAG &&
      (blocked || PLAYER_ALLOW_HOSTS.some((h) => host === h || host.endsWith('.' + h)))
    ) {
      console.log(
        'DIAG_REQ ' + (blocked ? 'BLOCK ' : 'PASS  ') +
        String(details.resourceType).padEnd(10) + url.slice(0, 100)
      );
    }
    callback({ cancel: blocked });
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 640,
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  const appOrigin = `http://127.0.0.1:${port}`;

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appOrigin)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(appOrigin);

  // The player is a cross-origin subframe: the watch page loads anipub as the
  // top frame and megaplay sits in an iframe inside it, so injecting only into
  // the top frame leaves the ads in the subframe untouched. Walk every frame.
  win.webContents.on('did-attach-webview', (_e, wc) => {
    const injectAllFrames = () => {
      const frames = [wc.mainFrame, ...wc.mainFrame.frames].filter(Boolean);
      for (const frame of frames) {
        frame.executeJavaScript(ADBLOCK_JS, true).catch(() => {});
      }
      if (process.env.ANIVAULT_DIAG) {
        console.log('DIAG_INJECTED_FRAMES ' + frames.length);
      }
    };

    wc.on('did-frame-finish-load', injectAllFrames);
    wc.on('dom-ready', injectAllFrames);
  });

  if (process.env.ANIVAULT_SMOKE) {
    win.webContents.on('render-process-gone', (_e, details) => {
      console.log('SMOKE_GONE ' + JSON.stringify(details));
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.log('SMOKE_FAILLOAD ' + code + ' ' + desc);
    });
    win.webContents.on('console-message', (_event, level, message) => {
      const msg = typeof level === 'object' && level !== null ? level.message : message;
      console.log('SMOKE_CONSOLE ' + msg);
    });
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await win.webContents.executeJavaScript(`({
            ready: document.readyState,
            rootChildren: (document.getElementById('root') || { children: [] }).children.length,
            text: (document.body && document.body.innerText || '').slice(0, 120),
            electron: !!(window.anivault && window.anivault.isElectron),
            scripts: Array.prototype.map.call(document.scripts || [], (s) => s.src),
            errors: (window.__errors || []).slice(0, 3),
          })`);
          console.log('SMOKE_RESULT ' + JSON.stringify(result));
          const ok = result.rootChildren > 0 && result.electron === true;
          console.log(ok ? 'SMOKE_PASS' : 'SMOKE_FAIL');
          try {
            const probe = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
            await probe.loadURL('https://example.com/');
            await new Promise((r) => setTimeout(r, 1500));
            const wv = await probe.webContents.executeJavaScript(`(async () => {
              let r = 'n/a';
              try {
                const a = await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
                  initDataTypes: ['cenc', 'cbcs'],
                  videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
                  audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
                }]);
                r = 'OK ' + a.keySystem;
              } catch (e) { r = 'FAIL ' + (e.name || '') + ' ' + (e.message || ''); }
              return r;
            })()`);
            console.log('SMOKE_WV ' + wv);
            probe.destroy();
          } catch (e) {
            console.log('SMOKE_WV_ERR ' + String(e));
          }
          app.exit(ok ? 0 : 1);
        } catch (err) {
          console.log('SMOKE_ERROR ' + (err && err.stack ? err.stack : String(err)));
          app.exit(1);
        }
      }, 4000);
    });
  }

  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    seedWidevine();
    if (components && components.whenReady) {
      try {
        await Promise.race([
          components.whenReady(),
          new Promise((resolve) => setTimeout(resolve, 30000)),
        ]);
      } catch {
        /* continue without a confirmed CDM */
      }
    }
    setupPlayerSession();
    const { server, port } = await startServer();

    ipcMain.handle('player:set-referer', (_event, referer) => {
      currentReferer = referer || null;
    });

    if (process.env.ANIVAULT_DEBUG_EME) {
      const EME_PROBE = `(async () => {
        const out = {
          secure: window.isSecureContext,
          fn: typeof navigator.requestMediaKeySystemAccess,
          mk: !!(window.MediaKeys && window.MediaKeySystemAccess),
          href: location.href,
        };
        let drm = 'n/a';
        try {
          const a = await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
            initDataTypes: ['cenc', 'cbcs'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
            audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
          }]);
          drm = 'OK ' + a.keySystem;
        } catch (e) { drm = 'FAIL ' + (e && e.name) + ' ' + (e && e.message); }
        console.log('ANIVAULT_EME ' + JSON.stringify(Object.assign(out, { drm })));
      })()`;
      app.on('web-contents-created', (_event, wc) => {
        wc.on('console-message', (_e, level, message) => {
          const m = typeof level === 'object' && level !== null ? level.message : message;
          console.log('[WV] ' + m);
        });
        wc.on('dom-ready', () => {
          if (/^https:/.test(wc.getURL())) {
            wc.executeJavaScript(EME_PROBE).catch(() => {});
          }
        });
      });
    }

    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });

    app.on('window-all-closed', () => {
      server.close();
      if (process.platform !== 'darwin') app.quit();
    });
  });
}
