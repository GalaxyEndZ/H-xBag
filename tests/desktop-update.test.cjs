'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const Module = require('node:module')
// Testes sem Electron nem rede; nenhuma caixa de diálogo deve ser criada.
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') throw new Error('O atualizador silencioso não deve abrir diálogos Electron')
  return originalLoad.call(this, request, parent, isMain)
}
const { startAutoUpdates, getDisableReason, cleanError } = require('../desktop/auto-update.cjs')
Module._load = originalLoad

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haxbag-update-test-'))
  const resource = path.join(dir, 'resources')
  fs.mkdirSync(resource)
  fs.writeFileSync(path.join(resource, 'app-update.yml'), 'provider: github\nowner: GalaxyEndZ\nrepo: H-xBagReleases\n')
  const app = new EventEmitter()
  app.isPackaged = true
  app.getVersion = () => '0.298.0'
  app.getPath = () => dir
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => { updater.emit('update-not-available') }
  updater.quitAndInstall = () => { updater.installs = (updater.installs || 0) + 1 }
  return {
    dir, app, updater, config: {
      app, getWindow: () => null, resourcesPath: resource,
      env: {}, platform: 'win32', updaterFactory: () => updater,
    },
    finish() { fs.rmSync(dir, { recursive: true, force: true }) },
  }
}

test('desativa updater portátil e instalação sem feed', () => {
  const t = setup()
  try {
    assert.match(getDisableReason({ ...t.config, env: { PORTABLE_EXECUTABLE_DIR: 'C:\\x' } }), /portátil/i)
    assert.match(getDisableReason({ ...t.config, resourcesPath: '/missing-folder' }), /app-update\.yml/i)
    assert.equal(getDisableReason(t.config), '')
  } finally { t.finish() }
})

test('detecta versão atualizada, mantém estado e gera log', async () => {
  const t = setup()
  try {
    const manager = startAutoUpdates(t.config)
    assert.equal(manager.getStatus().phase, 'idle')
    const status = await manager.check()
    assert.equal(status.phase, 'up-to-date')
    assert.equal(status.version, '0.298.0')
    assert.equal(status.enabled, true)
    assert.match(fs.readFileSync(path.join(t.dir, 'haxbag-update.log'), 'utf8'), /Nenhuma atualização/)
    manager.stop()
  } finally { t.finish() }
})

test('baixa automaticamente, anuncia progresso e permite instalar', async () => {
  const t = setup()
  try {
    t.updater.checkForUpdates = async () => {
      t.updater.emit('update-available', { version: '0.299.0' })
      t.updater.emit('download-progress', { percent: 55 })
      t.updater.emit('update-downloaded', { version: '0.299.0' })
    }
    const manager = startAutoUpdates(t.config)
    assert.equal(t.updater.autoDownload, true)
    assert.equal(t.updater.autoInstallOnAppQuit, true)
    const phases = []
    const unsubscribe = manager.subscribe(state => phases.push(state.phase))
    await manager.check()
    assert.deepEqual(phases.slice(0, 4), ['checking', 'available', 'downloading', 'ready'])
    assert.equal(manager.getStatus().percent, 100)
    assert.equal(manager.getStatus().availableVersion, '0.299.0')
    assert.match(manager.getStatus().message, /ao encerrar/i)
    assert.equal(t.updater.installs || 0, 0, 'não deve forçar reinício após download')
    assert.equal(manager.install(), true)
    assert.equal(t.updater.installs, 1)
    unsubscribe()
    manager.stop()
  } finally { t.finish() }
})

test('explica ausência de releases públicas e evita erro silencioso', async () => {
  const t = setup()
  try {
    t.updater.checkForUpdates = async () => { throw new Error('HTTP 404 Not Found') }
    const manager = startAutoUpdates(t.config)
    const status = await manager.check()
    assert.equal(status.phase, 'error')
    assert.match(status.message, /release pública/i)
    manager.stop()
    assert.match(cleanError({ message: 'Bearer secret&token=hi' }).message, /\[oculto\]/)
  } finally { t.finish() }
})
