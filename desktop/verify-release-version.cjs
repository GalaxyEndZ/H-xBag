// Falha o release se a tag não corresponder à versão do aplicativo.
const { version } = require('../package.json')
const tag = process.env.HAXBAG_TAG
if (tag && tag !== `v${version}`) {
  console.error(`[HäxBag] Tag ${tag} diferente da versão do aplicativo v${version}.`)
  process.exitCode = 1
} else {
  console.log(`[HäxBag] Preparando v${version}${tag ? ` (${tag})` : ' (disparo manual)'}.`)
}
