'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('haxbagScreenPicker', Object.freeze({
  onSources(callback) {
    if (typeof callback !== 'function') return
    ipcRenderer.once('haxbag:screen:sources', (_event, sources) => callback(sources))
  },
  choose(index) { if (Number.isInteger(index)) ipcRenderer.send('haxbag:screen:choose', index) },
  cancel() { ipcRenderer.send('haxbag:screen:cancel') },
}))
