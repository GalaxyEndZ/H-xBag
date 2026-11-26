'use strict'
const { contextBridge, ipcRenderer } = require('electron')
// Sem acesso ao ipcRenderer genérico, Node, arquivos, comandos ou URLs arbitrárias.
const updater = Object.freeze({
  getStatus: () => ipcRenderer.invoke('haxbag:update:status'),
  check: () => ipcRenderer.invoke('haxbag:update:check'),
  install: () => ipcRenderer.invoke('haxbag:update:install'),
  onStatus: callback => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('haxbag:update:changed', listener)
    return () => ipcRenderer.removeListener('haxbag:update:changed', listener)
  },
})
contextBridge.exposeInMainWorld('haxbagDesktop', Object.freeze({
  enabled: true,
  platform: process.platform,
  updater,
}))
