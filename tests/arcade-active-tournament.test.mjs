import test from 'node:test'
import assert from 'node:assert/strict'
import { activeTournamentsByGame, chooseActiveTournament } from '../src/components/arcadeActiveTournaments.ts'

const now = Date.parse('2026-11-27T16:00:00Z')
const row = (id, game_id, starts_at, ends_at) => ({ id, game_id, starts_at, ends_at })
const previous = row('old', 'pong', '2026-10-01T03:00:00Z', '2026-11-01T03:00:00Z')
const current = row('now-pong', 'pong', '2026-11-01T03:00:00Z', '2026-12-01T03:00:00Z')
const snake = row('now-snake', 'snake', '2026-11-01T03:00:00Z', '2026-12-01T03:00:00Z')
const future = row('future', 'pong', '2027-05-01T03:00:00Z', '2027-06-01T03:00:00Z')

test('temporada atual não desaparece com mais de 60 torneios futuros', () => {
  const many = Array.from({length: 120}, (_, i) => row(`future-${i}`, `future-game-${i}`, '2027-05-01T03:00:00Z', '2027-06-01T03:00:00Z'))
  const actual = activeTournamentsByGame([...many, previous, current], now)
  assert.deepEqual(actual.map(x=>x.id), ['now-pong'])
})

test('mostra jogos vigentes simultâneos e permite selecionar o preferido', () => {
  const active = activeTournamentsByGame([future, current, snake], now)
  assert.equal(active.length, 2)
  assert.equal(chooseActiveTournament(active, 'snake')?.id, 'now-snake')
  assert.equal(chooseActiveTournament(active, 'pong')?.id, 'now-pong')
})

test('temporada começa inclusivamente e termina exclusivamente', () => {
  assert.equal(activeTournamentsByGame([current], Date.parse(current.starts_at)).length, 1)
  assert.equal(activeTournamentsByGame([current], Date.parse(current.ends_at)).length, 0)
})

test('não inventa temporada ativa quando existem apenas torneios futuros', () => {
  const active = activeTournamentsByGame([future, previous], now)
  assert.equal(chooseActiveTournament(active, 'pong'), null)
})

test('seleciona a temporada vigente mais recente para cada jogo', () => {
  const overlapping = row('newer', 'pong', '2026-11-20T03:00:00Z', '2026-11-30T03:00:00Z')
  assert.equal(activeTournamentsByGame([current, overlapping, future], now)[0].id, 'newer')
})
