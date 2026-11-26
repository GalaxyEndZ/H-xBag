import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { ARCADE_GAMES } from './ArcadeChallengeCatalog'
import './V304Features.css'

type Tournament = {
  id: string
  game_id: string
  title: string
  season_key: string
  starts_at: string
  ends_at: string
}

type Standing = {
  tournament_id: string
  user_id: string
  best_score: number
  runs_played: number
  updated_at: string
}

function pickCurrentTournament(items: Tournament[]) {
  const now = Date.now()
  const active = items.find(item => new Date(item.starts_at).getTime() <= now && new Date(item.ends_at).getTime() >= now)
  if (active) return active
  const future = [...items]
    .filter(item => new Date(item.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
  if (future) return future
  return items[0] || null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function TournamentsV304({ userId }: { userId: string }) {
  const [items, setItems] = useState<Tournament[]>([])
  const [scores, setScores] = useState<Standing[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [names, setNames] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setError('')
    const provision = await supabase.rpc('hax_v304_ensure_season')
    if (provision.error) throw provision.error
    const { data, error: loadError } = await supabase
      .from('hax_v304_tournaments')
      .select('*')
      .order('starts_at', { ascending: false })
      .limit(60)
    if (loadError) throw loadError
    setItems((data || []) as Tournament[])
  }, [])

  useEffect(() => {
    void refresh()
      .catch((e: Error) => setError(`Torneios indisponíveis: ${e.message}. Execute a migração V304.`))
      .finally(() => setLoading(false))
  }, [refresh])

  const chosen = useMemo(() => pickCurrentTournament(items), [items])

  useEffect(() => {
    if (!chosen) {
      setScores([])
      return
    }
    let alive = true
    void supabase
      .from('hax_v304_tournament_standings')
      .select('tournament_id,user_id,best_score,runs_played,updated_at')
      .eq('tournament_id', chosen.id)
      .order('best_score', { ascending: false })
      .limit(30)
      .then(async ({ data, error: loadError }) => {
        if (!alive) return
        if (loadError) {
          setError(loadError.message)
          return
        }
        const rows = (data || []) as Standing[]
        setScores(rows)
        const ids = rows.map(row => row.user_id)
        if (!ids.length) {
          setNames({})
          return
        }
        const people = await supabase.from('profiles').select('id,display_name,username').in('id', ids)
        if (alive && !people.error) {
          setNames(Object.fromEntries((people.data || []).map(person => [person.id, person.display_name || person.username || 'Jogador'])))
        }
      })
    return () => {
      alive = false
    }
  }, [chosen])

  const now = Date.now()
  const future = chosen ? new Date(chosen.starts_at).getTime() > now : false
  const ended = chosen ? new Date(chosen.ends_at).getTime() < now : false
  const stateLabel = chosen ? (future ? 'Em breve' : ended ? 'Encerrado' : 'Temporada atual') : ''
  const game = chosen ? ARCADE_GAMES.find(entry => entry.id === chosen.game_id) : null
  const myRank = scores.findIndex(row => row.user_id === userId)

  return (
    <section className="hb-v304-wrap hb-v304-compact hb-v304-tournament-shell" id="hb-arcade-tournaments-v304">
      <header className="hb-v304-inline hb-v304-tournament-header">
        <div>
          <small>ARCADE · COMPETIÇÕES</small>
          <h3>Torneios e temporadas</h3>
          <p className="hb-v304-muted">Acompanhe a temporada em destaque e os melhores resultados verificados pelo servidor.</p>
        </div>
        <button type="button" onClick={() => void refresh().catch((e: Error) => setError(e.message))}>↻ Atualizar</button>
      </header>

      {error && <p role="alert" className="hb-v304-error">{error}</p>}

      {loading ? (
        <p>Carregando torneios…</p>
      ) : chosen ? (
        <>
          <article className="hb-v304-tournament-hero">
            <div className="hb-v304-tournament-identity">
              <span className="hb-v304-tournament-icon" aria-hidden="true">{game?.icon || '🏆'}</span>
              <div>
                <div className="hb-v304-tournament-badges">
                  <span className={`hb-v304-tournament-status${future ? ' is-future' : ended ? ' is-ended' : ' is-live'}`}>{stateLabel}</span>
                  <span className="hb-v304-tournament-game">{game?.label || chosen.game_id}</span>
                </div>
                <h4>{chosen.title}</h4>
                <p className="hb-v304-muted">{chosen.season_key}</p>
              </div>
            </div>
            <div className="hb-v304-tournament-meta">
              <div><span>Período</span><strong>{formatDate(chosen.starts_at)} até {formatDate(chosen.ends_at)}</strong></div>
              <div><span>Participantes</span><strong>{scores.length.toLocaleString('pt-BR')}</strong></div>
              <div><span>Sua posição</span><strong>{myRank >= 0 ? `#${myRank + 1}` : '—'}</strong></div>
            </div>
          </article>

          {scores.length ? (
            <ol className="hb-v304-tournament-leaders">
              {scores.map((row, index) => (
                <li key={row.user_id} className={row.user_id === userId ? 'is-mine' : ''}>
                  <div className="hb-v304-tournament-row-main">
                    <b>#{index + 1} {row.user_id === userId ? 'Você' : names[row.user_id] || 'Jogador'}</b>
                    <small>{row.runs_played} partida(s)</small>
                  </div>
                  <strong>{row.best_score.toLocaleString('pt-BR')} pts</strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="hb-v304-tournament-empty">
              <strong>{future ? 'A temporada ainda não começou.' : 'Nenhuma pontuação verificada ainda.'}</strong>
              <p className="hb-v304-muted">{future ? 'Quando o período começar, os resultados do arcade aparecerão aqui automaticamente.' : 'Assim que as partidas forem registradas pelo servidor, o ranking aparecerá nesta área.'}</p>
            </div>
          )}
        </>
      ) : (
        <p className="hb-v304-muted">Nenhum torneio disponível.</p>
      )}
    </section>
  )
}
