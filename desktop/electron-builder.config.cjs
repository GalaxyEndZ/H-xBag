// HäxBag V294 — feed oficial público de atualizações do HäxBag Desktop.
// O nome do aplicativo mantém HäxBag; o repositório usa apenas caracteres ASCII.
// O feed é incorporado ao instalador NSIS em app-update.yml durante a compilação.
// Tokens de publicação NUNCA devem entrar no projeto empacotado.
const pkg = require('../package.json')
const DEFAULT_RELEASE_REPOSITORY = 'GalaxyEndZ/H-xBagReleases'
const repository = String(process.env.HAXBAG_RELEASE_REPOSITORY || DEFAULT_RELEASE_REPOSITORY).trim()
const match = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(repository)
if (!match) throw new Error('HAXBAG_RELEASE_REPOSITORY inválido. Use usuario/repositorio.')
const config = { ...pkg.build }
config.publish = {
  provider: 'github',
  owner: match[1],
  repo: match[2],
  releaseType: 'draft',
}
module.exports = config
