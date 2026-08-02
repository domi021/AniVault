'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anivault', {
  isElectron: true,
  setPlayerReferer: (referer) => ipcRenderer.invoke('player:set-referer', referer),
});
