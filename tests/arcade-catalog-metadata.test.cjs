const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('torneios usam title, propriedade definida no catálogo Arcade', () => {
  const catalog = fs.readFileSync(path.join(root, 'src/components/ArcadeChallengeCatalog.ts'), 'utf8')
  const tournaments = fs.readFileSync(path.join(root, 'src/components/TournamentsV304.tsx'), 'utf8')
  assert.match(catalog, /title: 'Pong'/)
  assert.match(tournaments, /game\?\.title\s*\|\|\s*chosen\.game_id/)
  assert.doesNotMatch(tournaments, /game\?\.label/)
})
