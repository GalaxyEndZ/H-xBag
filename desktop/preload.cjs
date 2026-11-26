'use strict'
const { contextBridge } = require('electron')
// A narrowly-scoped, read-only desktop indicator. Do not expose ipcRenderer or Node.js.
contextBridge.exposeInMainWorld('haxbagDesktop', Object.freeze({
  enabled: true,
  platform: process.platform,
}))
