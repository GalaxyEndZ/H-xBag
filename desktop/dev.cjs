'use strict'
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const VITE_URL = 'http://127.0.0.1:5173/'
const cwd = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const vite = spawn(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
let electron = null
let stopped = false
function shutdown() {
  if (stopped) return
  stopped = true
  if (electron && !electron.killed) electron.kill()
  if (!vite.killed) vite.kill()
}
function checkReady(attempt) {
  if (stopped) return
  http.get(VITE_URL, response => {
    response.resume()
    if (electron) return
    const binary = require('electron')
    electron = spawn(binary, ['.'], { cwd, stdio: 'inherit', env: { ...process.env, HAXBAG_DEV_URL: VITE_URL } })
    electron.on('exit', () => { shutdown(); process.exitCode = 0 })
  }).on('error', () => {
    if (attempt >= 60) { console.error('Não foi possível iniciar o Vite na porta 5173.');shutdown();process.exitCode=1;return }
    setTimeout(() => checkReady(attempt+1), 500)
  })
}
vite.on('exit', code => { if (!stopped) { console.error('O Vite encerrou:', code);shutdown();process.exitCode=code||1 } })
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
setTimeout(() => checkReady(0), 450)
