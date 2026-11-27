/** Seleção consistente com o intervalo [starts_at, ends_at) usado pelo backend V304. */
export type ArcadeTournamentWindow = {
  id: string
  game_id: string
  starts_at: string
  ends_at: string
}

/**
 * Mostra no máximo uma temporada vigente por jogo. A mais recente prevalece
 * caso haja cadastros que se sobreponham, sem nunca escolher uma futura.
 */
export function activeTournamentsByGame<T extends ArcadeTournamentWindow>(items: readonly T[], nowMs: number): T[] {
  const byGame = new Map<string, T>()
  for (const item of items) {
    const starts = Date.parse(item.starts_at)
    const ends = Date.parse(item.ends_at)
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || !(starts <= nowMs && nowMs < ends)) continue
    const previous = byGame.get(item.game_id)
    if (!previous || Date.parse(previous.starts_at) < starts) byGame.set(item.game_id, item)
  }
  return [...byGame.values()].sort((a, b) => a.game_id.localeCompare(b.game_id, 'pt-BR'))
}

export function chooseActiveTournament<T extends ArcadeTournamentWindow>(items: readonly T[], preferredGameId: string): T | null {
  return items.find(item => item.game_id === preferredGameId) ?? items[0] ?? null
}
