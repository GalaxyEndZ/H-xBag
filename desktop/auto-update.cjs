'use strict'

/** HäxBag V298 — Atualização do instalador Windows NSIS.
 * A fonte vem de resources/app-update.yml gerado pelo electron-builder.
 * Não desabilite verificação de integridade/assinaturas do electron-updater.
 */
const fs = require('node:fs')
const path = require('node:path')

const CHECK_AFTER_START_MS = 10_000
const CHECK_EVERY_MS = 60 * 60 * 1000
const CHECK_ON_FOCUS_AFTER_MS = 30 * 60 * 1000
const VALID_PHASES = new Set(['disabled', 'idle', 'checking', 'available', 'downloading', 'ready', 'up-to-date', 'error'])

function getDisableReason({ app, env = process.env, resourcesPath = process.resourcesPath, platform = process.platform }) {
  if (platform !== 'win32') return 'O atualizador automático é exclusivo do Windows.'
  if (!app.isPackaged) return 'O atualizador funciona somente no instalador publicado, não no modo de desenvolvimento.'
  if (env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE) return 'Esta é a edição portátil. Instale a edição Setup para receber atualizações automáticas.'
  if (!resourcesPath || !fs.existsSync(path.join(resourcesPath, 'app-update.yml'))) {
    return 'O aplicativo foi instalado sem o arquivo app-update.yml. Reinstale uma versão Setup publicada com o feed configurado.'
  }
  return ''
}
function shouldStartAutoUpdates(options) { return !getDisableReason(options) }

function cleanError(error) {
  const code = String(error?.code || '')
  let message = String(error?.message || error || 'Falha desconhecida')
    .replace(/([?&](?:token|access_token|authorization|key|signature)=)[^\s&]+/gi, '$1[oculto]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[oculto]')
    .slice(0, 360)
  if (/\b404\b|cannot find latest\.yml|no published versions|release not found/i.test(message)) {
    message = 'Nenhuma release pública com latest.yml foi encontrada no GitHub. Publique um Setup NSIS e o latest.yml na mesma release.'
  } else if (/\b403\b|\b401\b|forbidden|unauthori[sz]ed/i.test(message)) {
    message = 'O GitHub não permitiu acesso à atualização. Confirme que o repositório e a release são públicos.'
  }
  return { code: code.slice(0, 70), message }
}

function startAutoUpdates({ app, getWindow, updaterFactory, clock = () => Date.now(),
  resourcesPath = process.resourcesPath, env = process.env, platform = process.platform }) {
  const version = app.getVersion()
  const releaseUrl = 'https://github.com/GalaxyEndZ/H-xBagReleases/releases'
  let state = {
    enabled: false, phase: 'disabled', message: '', version,
    availableVersion: null, percent: null, lastCheckedAt: null,
    errorCode: null, releaseUrl,
  }
  const listeners = new Set()
  let updater = null
  let checking = false
  let closed = false
  let timer = null
  let startup = null
  let lastCheck = 0
  let lastProgress = -1

  const logPath = (() => {
    try { return path.join(app.getPath('userData'), 'haxbag-update.log') } catch { return '' }
  })()
  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`
    console.info('[HäxBag Update]', message)
    if (!logPath) return
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 512 * 1024) fs.renameSync(logPath, `${logPath}.old`)
      fs.appendFileSync(logPath, line, 'utf8')
    } catch { /* Falha de log não bloqueia o programa. */ }
  }
  function setState(patch) {
    state = { ...state, ...patch }
    if (!VALID_PHASES.has(state.phase)) throw new Error('Fase de atualização inválida')
    for (const listener of listeners) {
      try { listener({ ...state }) } catch { /* Uma janela pode ter sido fechada. */ }
    }
  }
  const controller = {
    getStatus: () => ({ ...state }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    check: async () => ({ ...state }),
    install: () => false,
    stop() {
      closed = true
      if (timer) clearInterval(timer)
      if (startup) clearTimeout(startup)
      listeners.clear()
    },
  }
  const disableReason = getDisableReason({ app, env, resourcesPath, platform })
  if (disableReason) {
    setState({ message: disableReason })
    log(`Indisponível: ${disableReason}`)
    return controller
  }
  try {
    updater = updaterFactory ? updaterFactory() : require('electron-updater').autoUpdater
  } catch (error) {
    const problem = cleanError(error)
    setState({ phase: 'error', message: `O módulo electron-updater não foi encontrado: ${problem.message}`, errorCode: problem.code })
    log(`Falha ao carregar o updater: ${problem.message}`)
    return controller
  }

  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.allowPrerelease = false
  // Mantemos as verificações nativas e os headers padrão. Não enviamos GH_TOKEN ao cliente.
  setState({ enabled: true, phase: 'idle', message: 'Atualizações automáticas ativadas.' })
  log(`Iniciado: versão ${version}, feed NSIS presente.`)

  async function check({ manual = false } = {}) {
    if (closed || checking || state.phase === 'downloading' || state.phase === 'ready') return { ...state }
    checking = true
    lastCheck = clock()
    setState({ phase: 'checking', message: manual ? 'Verificando atualizações no GitHub…' : 'Buscando novas versões…', errorCode: null, lastCheckedAt: new Date().toISOString(), percent: null })
    try {
      await updater.checkForUpdates()
    } catch (error) {
      const problem = cleanError(error)
      setState({ phase: 'error', message: problem.message, errorCode: problem.code })
      log(`Verificação falhou (${problem.code}): ${problem.message}`)
    } finally { checking = false }
    return { ...state }
  }
  function install() {
    if (closed || state.phase !== 'ready') return false
    log(`Instalando versão ${state.availableVersion} e reiniciando por solicitação do usuário.`)
    try {
      updater.quitAndInstall(false, true)
      return true
    } catch (error) {
      const problem = cleanError(error)
      setState({ phase: 'error', message: problem.message, errorCode: problem.code })
      return false
    }
  }
  controller.check = () => check({ manual: true })
  controller.install = install

  updater.on('checking-for-update', () => { /* Estado já atualizado em check(). */ })
  updater.on('update-available', info => {
    const next = String(info?.version || '')
    setState({ phase: 'available', availableVersion: next, message: `Versão ${next} disponível. Iniciando download…`, percent: 0 })
    log(`Nova versão encontrada: ${next}`)
  })
  updater.on('update-not-available', () => {
    setState({ phase: 'up-to-date', message: `Você já está usando a versão mais recente (${version}).`, availableVersion: null, percent: null })
    log('Nenhuma atualização mais recente.')
  })
  updater.on('download-progress', info => {
    const percent = Math.max(0, Math.min(100, Number(info?.percent || 0)))
    setState({ phase: 'downloading', message: `Baixando atualização ${state.availableVersion || ''}…`, percent })
    const bucket = Math.floor(percent / 10)
    if (bucket !== lastProgress) { lastProgress = bucket; log(`Download: ${Math.round(percent)}%`) }
  })
  updater.on('error', error => {
    if (closed) return
    const problem = cleanError(error)
    setState({ phase: 'error', message: problem.message, errorCode: problem.code })
    log(`Erro (${problem.code}): ${problem.message}`)
  })
  updater.on('update-downloaded', info => {
    if (closed) return
    const next = String(info?.version || state.availableVersion || '')
    setState({ phase: 'ready', message: `Versão ${next} baixada. Será instalada ao encerrar o HäxBag normalmente.`, availableVersion: next, percent: 100 })
    log(`Download concluído: ${next}. Instalação silenciosa agendada para a saída do aplicativo.`)
    // Sem caixa de diálogo e sem reinício forçado: autoInstallOnAppQuit realiza
    // a instalação quando o usuário decidir encerrar o programa.
  })

  startup = setTimeout(() => { void check() }, CHECK_AFTER_START_MS)
  timer = setInterval(() => { void check() }, CHECK_EVERY_MS)
  app.on('browser-window-focus', () => {
    if (clock() - lastCheck >= CHECK_ON_FOCUS_AFTER_MS) void check()
  })
  app.on('before-quit', () => controller.stop())
  return controller
}

module.exports = { startAutoUpdates, shouldStartAutoUpdates, getDisableReason, cleanError }
