/** V306: prepara o projeto Android nativo sem exigir Capacitor no npm da versão desktop. */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(mobile, '..')
const android = join(mobile, 'android')
const isWindows = process.platform === 'win32'
const mode = process.argv[2] || 'sync'

function fail(message) {
  console.error(`[HäxBag Mobile] ${message}`)
  process.exit(1)
}
function exec(command, args, cwd) {
  // Windows: arquivos .cmd/.bat precisam de cmd.exe e aspas no caminho (Área de Trabalho/OneDrive).
  const batchFile = isWindows && /\.(cmd|bat)$/i.test(command)
  const shellLine = batchFile
    ? `"${command}" ${args.map(value => `"${String(value).replace(/"/g, '')}"`).join(' ')}`
    : ''
  const result = batchFile
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${shellLine}"`], { cwd, stdio: 'inherit' })
    : spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) process.exit(result.status || 1)
}
function cap(args) {
  const command = join(mobile, 'node_modules', '.bin', isWindows ? 'cap.cmd' : 'cap')
  if (!existsSync(command)) fail('Dependências do Capacitor ausentes. Execute npm run mobile:deps.')
  exec(command, args, mobile)
}
function patchManifest() {
  const manifestPath = join(android, 'app','src','main','AndroidManifest.xml')
  if (!existsSync(manifestPath)) fail('AndroidManifest.xml não encontrado após criar o projeto Android.')
  let xml = readFileSync(manifestPath, 'utf8')
  // Preparação para áudio em chamadas. O consentimento do microfone continua obrigatório em tempo de uso.
  for (const permission of ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA']) {
    if (!xml.includes(`android:name="${permission}"`)) {
      xml = xml.replace(/<manifest\b[^>]*>/, match => `${match}\n    <uses-permission android:name="${permission}" />`)
    }
  }
  writeFileSync(manifestPath, xml)
}
function installBranding() {
  const assetDir = join(mobile, 'assets', 'android')
  const resDir = join(android, 'app', 'src', 'main', 'res')
  const targets = [
    ...['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].flatMap(dpi => [
      [`mipmap-${dpi}/ic_launcher.png`, `mipmap-${dpi}/ic_launcher.png`],
      [`mipmap-${dpi}/ic_launcher_round.png`, `mipmap-${dpi}/ic_launcher_round.png`],
    ]),
    ['drawable/haxbag_launcher_foreground.png','drawable/haxbag_launcher_foreground.png'],
    ['mipmap-anydpi-v26/ic_launcher.xml','mipmap-anydpi-v26/ic_launcher.xml'],
    ['mipmap-anydpi-v26/ic_launcher_round.xml','mipmap-anydpi-v26/ic_launcher_round.xml'],
    ['values/haxbag_launcher_colors.xml','values/haxbag_launcher_colors.xml'],
  ]
  for (const [source, target] of targets) {
    const destination = join(resDir, target)
    mkdirSync(dirname(destination), { recursive:true })
    copyFileSync(join(assetDir, source), destination)
  }
}
if (!['sync','open','apk'].includes(mode)) fail('Uso: node mobile/scripts/android.mjs sync|open|apk')
if (!existsSync(join(root,'dist','index.html'))) fail('Execute npm run build na raiz antes de sincronizar o Android.')
if (!existsSync(join(android,'app','build.gradle')) && !existsSync(join(android,'app','build.gradle.kts'))) {
  console.log('[HäxBag Mobile] Criando projeto Android com Capacitor 8...')
  cap(['add','android'])
}
patchManifest()
installBranding()
cap(['sync','android'])
if (mode === 'open') {
  cap(['open','android'])
} else if (mode === 'apk') {
  const wrapper = join(android, isWindows ? 'gradlew.bat' : 'gradlew')
  if (!existsSync(wrapper)) fail('Gradle Wrapper ausente. Abra o projeto pelo Android Studio e verifique a instalação.')
  if (!isWindows) exec('chmod',['+x',wrapper],android)
  exec(wrapper,['assembleDebug'],android)
  const source = join(android,'app','build','outputs','apk','debug','app-debug.apk')
  if (!existsSync(source)) fail('Gradle não produziu app-debug.apk.')
  const version = JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version
  const outputDir = join(mobile,'output')
  mkdirSync(outputDir,{recursive:true})
  const destination = join(outputDir,`HaxBag-${version}-android-debug.apk`)
  copyFileSync(source,destination)
  console.log(`[HäxBag Mobile] APK de testes: ${destination}`)
} else {
  console.log('[HäxBag Mobile] Android sincronizado. Execute npm run mobile:android:open ou npm run mobile:apk.')
}
