'use strict';

const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PLAYER_PARTITION = 'anivault-player';

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

const DIST_DIR = path.join(__dirname, '..', 'dist');

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
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function setupPlayerSession() {
  const ses = session.fromPartition(PLAYER_PARTITION);

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    if (currentReferer && details.url && /^https?:/i.test(details.url)) {
      callback({ requestHeaders: { ...details.requestHeaders, Referer: currentReferer } });
    } else {
      callback({ requestHeaders: details.requestHeaders });
    }
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = (details.url || '').toLowerCase();
    const blocked = AD_DOMAINS.some((d) => url.includes(d));
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
    setupPlayerSession();
    const { server, port } = await startServer();

    ipcMain.handle('player:set-referer', (_event, referer) => {
      currentReferer = referer || null;
    });

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
