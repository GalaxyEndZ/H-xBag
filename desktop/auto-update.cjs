'use strict'

/**
 * HäxBag Desktop V293 — atualização do instalador NSIS (Windows).
 * Não é um mecanismo de execução remota: apenas versões publicadas
 * no feed configurado no momento da compilação podem ser baixadas.
 */
const { existsSync } = require('node:fs')
const path = require('node:path')
const { dialog } = require('electron')
const CHECK_AFTER_START_MS = 20_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

function shouldStartAutoUpdates({ app, env = process.env, resourcesPath = process.resourcesPath }) {
  if (process.platform !== 'win32' || !app.isPackaged) return false
  // A edição portátil não é atualizada in-place pelo instalador NSIS.
  if (env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE) return false
  return existsSync(path.join(resourcesPath, 'app-update.yml'))
}

function startAutoUpdates({ app, getWindow }) {
  if (!shouldStartAutoUpdates({ app })) {
    if (app.isPackaged && process.platform === 'win32') {
      console.info('[HäxBag] Atualização automática indisponível: versão portátil ou feed não configurado.')
    }
    return { enabled: false }
  }

  // Importação tardia: o updater nunca roda no Vite ou na versão web.
  const { autoUpdater } = require('electron-updater')
  // V26+ preserva headers sensíveis no host original; nunca encaminhar
  // tokens de atualização para outros domínios em redirecionamentos.
  autoUpdater.crossOriginHeaders = () => []
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  let checking = false
  let promptOpen = false
  let lastProgressBucket = -1
  let closed = false

  async function check() {
    if (checking || closed) return
    checking = true
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      // Sem popups repetidos quando o usuário está sem internet.
      console.warn('[HäxBag] Não foi possível verificar atualizações:', error?.message || String(error))
    } finally { checking = false }
  }

  autoUpdater.on('checking-for-update', () => console.info('[HäxBag] Verificando atualizações…'))
  autoUpdater.on('update-available', info => console.info(`[HäxBag] Nova versão disponível: ${info.version}`))
  autoUpdater.on('update-not-available', () => console.info('[HäxBag] Aplicativo atualizado.'))
  autoUpdater.on('download-progress', info => {
    // Evitar log excessivo; apenas progresso periódico de 10 em 10 pontos.
    const bucket = Math.floor(Number(info.percent || 0) / 10)
    if (bucket !== lastProgressBucket) {
      lastProgressBucket = bucket
      console.info(`[HäxBag] Download: ${Math.round(info.percent)}%`)
    }
  })
  autoUpdater.on('error', error => console.warn('[HäxBag] Falha na atualização:', error?.message || String(error)))
  autoUpdater.on('update-downloaded', async info => {
    if (closed || promptOpen) return
    promptOpen = true
    try {
      const options = {
        type: 'info',
        title: 'HäxBag atualizado',
        message: `A versão ${info.version} está pronta para instalar.`,
        detail: 'Você pode reiniciar agora ou continuar usando o HäxBag. A atualização também será aplicada ao encerrar o aplicativo.',
        buttons: ['Reiniciar e atualizar', 'Depois'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      }
      const window = getWindow()
      const result = window && !window.isDestroyed()
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options)
      if (result.response === 0 && !closed) autoUpdater.quitAndInstall(false, true)
    } catch (error) {
      console.warn('[HäxBag] Não foi possível apresentar a atualização:', error?.message || String(error))
    } finally { promptOpen = false }
  })

  const startup = setTimeout(() => { void check() }, CHECK_AFTER_START_MS)
  const interval = setInterval(() => { void check() }, CHECK_EVERY_MS)
  app.on('before-quit', () => {
    closed = true
    clearTimeout(startup)
    clearInterval(interval)
  })
  return { enabled: true, check }
}

module.exports = { startAutoUpdates, shouldStartAutoUpdates }
