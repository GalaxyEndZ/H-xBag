const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function compile(relative, dependencies = {}) {
  const filename = path.join(root, relative)
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const mod = { exports: {} }
  const load = name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`Import inesperado: ${name}`)
  }
  new Function('require', 'module', 'exports', outputText)(load, mod, mod.exports)
  return mod.exports
}
const extendedData = compile('src/systems/kisatsutai/extendedData.ts')
const jobs = compile('src/civilProfessions.ts', { './systems/kisatsutai/extendedData': extendedData })

test('o gerador usa o catálogo oficial do Kisatsutai', () => {
  const expected = Object.values(extendedData.KISATSUTAI_SKILL_GROUPS).flatMap(group => group)
  assert.equal(jobs.CIVIL_SKILLS.length, expected.length)
  assert.ok(jobs.CIVIL_SKILLS.some(skill => skill.name === 'Medicina'))
})

test('profissões sugerem no máximo cinco perícias existentes', () => {
  const available = new Set(jobs.CIVIL_SKILLS.map(skill => skill.key))
  for (const profession of jobs.CIVIL_JOB_PRESETS) {
    const selected = jobs.civilSuggestedSkills(profession.name)
    assert.ok(selected.length > 0 && selected.length <= jobs.CIVIL_SKILL_LIMIT, profession.name)
    assert.equal(selected.length, new Set(selected).size, profession.name)
    selected.forEach(skill => assert.ok(available.has(skill), skill))
  }
})

test('o limite de cinco também é aplicado a dados salvos', () => {
  const values = jobs.CIVIL_SKILLS.slice(0, 9).map(skill => skill.key)
  assert.deepEqual(jobs.normalizeCivilSkills([...values, values[0]]), values.slice(0, 5))
  assert.deepEqual(jobs.normalizeCivilSkills(['inventada', values[1], values[1], null]), [values[1]])
  assert.deepEqual(jobs.normalizeCivilSkills('texto inválido'), [])
})

test('profissões desconhecidas não criam bônus ou treinamentos', () => {
  assert.deepEqual(jobs.civilSuggestedSkills('Ofício personalizado'), [])
  assert.deepEqual(jobs.civilSuggestedSkills('ferreiro'), jobs.civilSuggestedSkills('Ferreiro'))
})
