import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'../..')
const mobile=join(root,'mobile')
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
const mobilePkg=JSON.parse(readFileSync(join(mobile,'package.json'),'utf8'))
assert.equal(pkg.version,mobilePkg.version,'Versão web e mobile divergente')
assert.ok(existsSync(join(mobile,'capacitor.config.ts')))
assert.ok(existsSync(join(root,'src/mobile/MobileTabsV306.tsx')))
assert.ok(existsSync(join(root,'src/mobile/MobileV306.css')))
console.log(`HäxBag Mobile ${pkg.version}: estrutura e versão consistentes.`)
