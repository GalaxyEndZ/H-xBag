'use strict'
/** Diagnóstico público sem GH_TOKEN; não faz downloads nem instala nada. */
const repository = 'GalaxyEndZ/H-xBagReleases'
const url = `https://api.github.com/repos/${repository}/releases/latest`
const current = require('../package.json').version
async function main() {
  console.log(`[HäxBag] Versão do projeto: ${current}`)
  console.log(`[HäxBag] Feed: https://github.com/${repository}/releases`)
  const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'HaxBag-Update-Diagnostic' }, signal: AbortSignal.timeout(15000) })
  if (response.status === 404) {
    throw new Error('Não há release pública no repositório (404). Crie uma tag no repositório de código-fonte e conclua o GitHub Actions.')
  }
  if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}`)
  const release = await response.json()
  if (release.draft || release.prerelease) throw new Error('A release atual é draft/prerelease e não será entregue aos usuários.')
  const assets = new Set((release.assets || []).map(asset => asset.name))
  if (!assets.has('latest.yml')) throw new Error('Release sem latest.yml.')
  const expected = `HaxBag-Setup-${String(release.tag_name || '').replace(/^v/, '')}-x64.exe`
  if (!assets.has(expected)) throw new Error(`Release sem instalador ${expected}.`)
  console.log(`[HäxBag] Feed operacional: ${release.tag_name}`)
  console.log(`[HäxBag] Arquivos confirmados: latest.yml e ${expected}`)
}
main().catch(error => { console.error(`[HäxBag] FALHA: ${error.message}`); process.exitCode = 1 })
