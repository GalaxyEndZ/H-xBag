'use strict'

/** HäxBag Desktop V291 — Electron main process.
 * The React app runs as unprivileged bundled content; never expose Node APIs to it.
 */
const { app, BrowserWindow, ipcMain, protocol, net, session, shell } = require('electron')
const { existsSync, statSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { startAutoUpdates } = require('./auto-update.cjs')

const APP_SCHEME = 'haxbag'
const APP_HOST = 'app'
const APP_HOME = 'haxbag://app/index.html'
const DEV_URL = !app.isPackaged ? process.env.HAXBAG_DEV_URL : undefined

// V292: Electron may include the Unicode product name (HäxBag) in User-Agent.
// Some HTTP paths pass that header to the Postgres Auth session as raw Latin-1
// bytes (ä = 0xE4), which are invalid UTF-8. Keep branding unchanged; use a
// printable ASCII User-Agent on every network request instead.
function normalizeNetworkUserAgent(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
}
// This fallback must be set before Electron initializes the renderer.
if (app.userAgentFallback) {
  app.userAgentFallback = normalizeNetworkUserAgent(app.userAgentFallback)
}
function configureNetworkIdentity() {
  const ses = session.defaultSession
  const original = ses.getUserAgent() || app.userAgentFallback
  const safe = normalizeNetworkUserAgent(original)
  if (!safe) throw new Error('O User-Agent do Electron está vazio; não é seguro iniciar a autenticação.')
  ses.setUserAgent(safe)
  app.userAgentFallback = safe
  return safe
}
const STATE = new Map() // Screen-source chooser state keyed by its webContents ID.
let mainWindow = null
let shuttingDown = false
let updateController = null

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}])

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function isAppURL(value) {
  try {
    const u = new URL(value)
    return u.protocol === `${APP_SCHEME}:` && u.hostname === APP_HOST
  } catch { return false }
}

function isDevURL(value) {
  if (!DEV_URL) return false
  try {
    const wanted = new URL(DEV_URL)
    const actual = new URL(value)
    return wanted.origin === actual.origin &&
      (wanted.hostname === '127.0.0.1' || wanted.hostname === 'localhost') &&
      wanted.protocol === 'http:'
  } catch { return false }
}
function trusted(value) { return isAppURL(value) || isDevURL(value) }
function openOutside(value) {
  try {
    const u = new URL(value)
    if (u.protocol === 'https:' || u.protocol === 'mailto:') void shell.openExternal(value)
  } catch { /* Invalid links are ignored. */ }
}
function approvedSender(webContents, requestedURL) {
  return !!mainWindow && !mainWindow.isDestroyed() &&
    webContents && webContents.id === mainWindow.webContents.id &&
    trusted(webContents.getURL()) &&
    (!requestedURL || requestedURL === 'null' || trusted(requestedURL))
}

function bindLocalAppProtocol() {
  const distRoot = path.resolve(__dirname, '..', 'dist')
  protocol.handle(APP_SCHEME, request => {
    let pathname
    try {
      const url = new URL(request.url)
      if (url.hostname !== APP_HOST) return new Response('Host não autorizado', { status: 403 })
      pathname = decodeURIComponent(url.pathname)
    } catch { return new Response('URL inválida', { status: 400 }) }

    if (pathname.includes('\\') || pathname.includes('\0')) return new Response('Caminho inválido', { status: 400 })
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const target = path.resolve(distRoot, relative)
    if (target !== distRoot && !target.startsWith(distRoot + path.sep)) return new Response('Acesso negado', { status: 403 })
    try {
      if (statSync(target).isFile()) return net.fetch(pathToFileURL(target).toString())
    } catch { /* Nothing at this path. */ }
    // The React app uses History API/query parameters. Never return HTML for missing assets.
    if (!path.extname(relative)) return net.fetch(pathToFileURL(path.join(distRoot, 'index.html')).toString())
    return new Response('Arquivo não encontrado', { status: 404 })
  })
}

function registerPermissions() {
  const ses = session.defaultSession
  const allowed = new Set(['media', 'display-capture', 'fullscreen', 'speaker-selection', 'notifications', 'clipboard-sanitized-write'])
  ses.setPermissionRequestHandler((wc, permission, answer, details) => {
    if (!allowed.has(permission) || !approvedSender(wc, details?.requestingUrl)) return answer(false)
    if (permission === 'media') {
      // The existing HäxBag voice client requests audio only; cameras are not enabled.
      const types = details?.mediaTypes
      if (Array.isArray(types) && types.includes('video')) return answer(false)
    }
    answer(true)
  })
  ses.setPermissionCheckHandler((wc, permission, origin, details) => {
    if (!allowed.has(permission)) return false
    const requestingURL = details?.requestingUrl || origin || ''
    return !!wc && approvedSender(wc, requestingURL)
  })

  // Windows has no reliable native picker in Electron; show our own explicit chooser.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!mainWindow || mainWindow.isDestroyed() || !trusted(request.securityOrigin) || !request.userGesture) {
      try { callback({}) } catch { /* Rejected display media request. */ }
      return
    }
    try {
      await requestScreenShare(callback)
    } catch (error) {
      console.error('[HäxBag] Não foi possível selecionar a tela:', error)
      try { callback({}) } catch { /* No screen was shared. */ }
    }
  }, { useSystemPicker: process.platform === 'darwin' })
}

async function requestScreenShare(callback) {
  const { desktopCapturer } = require('electron')
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  })
  if (!sources.length) { try { callback({}) } catch {} ; return }
  if (!mainWindow || mainWindow.isDestroyed()) { try { callback({}) } catch {} ; return }
  const picker = new BrowserWindow({
    parent: mainWindow, modal: true,
    title: 'HäxBag — Escolher tela ou janela',
    width: 810, height: 630, minWidth: 550, minHeight: 420,
    show: false, autoHideMenuBar: true,
    backgroundColor: '#10151b',
    webPreferences: {
      preload: path.join(__dirname, 'screen-picker-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  })
  const id = picker.webContents.id
  let completed = false
  const finish = source => {
    if (completed) return
    completed = true
    STATE.delete(id)
    if (!picker.isDestroyed()) picker.close()
    try { callback(source ? { video: source } : {}) } catch (error) {
      // An empty streams object cancels on supported versions. Do not grant a fallback source.
      if (source) console.error('[HäxBag] Captura cancelada:', error)
    }
  }
  STATE.set(id, { sources, finish })
  picker.on('closed', () => finish(null))
  picker.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  await picker.loadFile(path.join(__dirname, 'screen-picker.html'))
  if (picker.isDestroyed()) { finish(null); return }
  picker.webContents.send('haxbag:screen:sources', sources.map((s, index) => ({
    index,
    name: String(s.name || `Tela ${index + 1}`).slice(0, 160),
    kind: s.id.startsWith('screen:') ? 'Tela' : 'Janela',
    thumbnail: s.thumbnail?.isEmpty() ? '' : s.thumbnail?.toDataURL() || '',
  })))
  picker.show()
}

ipcMain.on('haxbag:screen:choose', (event, index) => {
  const state = STATE.get(event.sender.id)
  if (!state || !Number.isInteger(index) || index < 0 || index >= state.sources.length) return
  state.finish(state.sources[index])
})
ipcMain.on('haxbag:screen:cancel', event => STATE.get(event.sender.id)?.finish(null))

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'HäxBag', width: 1440, height: 900, minWidth: 980, minHeight: 650,
    show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'haxbag.ico'),
    backgroundColor: '#0d1015',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, spellcheck: true,
      backgroundThrottling: false,
    },
  })
  // Apply before loadURL: the first Supabase Auth call must use ASCII headers.
  mainWindow.webContents.setUserAgent(normalizeNetworkUserAgent(session.defaultSession.getUserAgent()))
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!trusted(url)) { event.preventDefault(); openOutside(url) }
  })
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!trusted(url)) { event.preventDefault(); openOutside(url) }
  })
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[HäxBag] Processo de interface encerrado:', details.reason)
  })
  // Keep external documents, OAuth links and shared URLs in the user's normal browser.
  const start = DEV_URL && isDevURL(DEV_URL) ? DEV_URL : APP_HOME
  void mainWindow.loadURL(start).catch(error => {
    console.error('[HäxBag] Erro ao abrir a interface:', error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent('<body style="background:#111;color:white;font:16px sans-serif;padding:38px"><h2>Não foi possível carregar o HäxBag.</h2><p>Execute npm run build antes de abrir o aplicativo.</p></body>'))
    }
  })
}

// Somente a janela confiável do HäxBag pode consultar ou controlar o atualizador.
function requireAppUpdateSender(event) {
  if (!approvedSender(event.sender, event.senderFrame?.url)) {
    throw new Error('Solicitação de atualização não autorizada')
  }
}
ipcMain.handle('haxbag:update:status', event => {
  requireAppUpdateSender(event)
  return updateController?.getStatus() ?? { enabled: false, phase: 'idle', message: 'Inicializando atualizador…', version: app.getVersion() }
})
ipcMain.handle('haxbag:update:check', async event => {
  requireAppUpdateSender(event)
  return updateController ? updateController.check() : { enabled: false, phase: 'idle', message: 'Inicializando atualizador…', version: app.getVersion() }
})
ipcMain.handle('haxbag:update:install', event => {
  requireAppUpdateSender(event)
  return updateController?.install() ?? false
})

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return
  if (!app.isPackaged && !DEV_URL && !existsSync(path.resolve(__dirname, '..', 'dist', 'index.html'))) {
    console.warn('[HäxBag] Execute npm run build ou npm run desktop:dev antes de iniciar o Electron.')
  }
  configureNetworkIdentity()
  bindLocalAppProtocol()
  registerPermissions()
  createMainWindow()
  // O app instalado busca atualizações publicadas sem interferir no modo web/dev.
  updateController = startAutoUpdates({ app, getWindow: () => mainWindow })
  updateController.subscribe(status => {
    if (mainWindow && !mainWindow.isDestroyed() && trusted(mainWindow.webContents.getURL())) {
      mainWindow.webContents.send('haxbag:update:changed', status)
    }
  })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})
app.on('before-quit', () => { shuttingDown = true })
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !shuttingDown) app.quit() })
