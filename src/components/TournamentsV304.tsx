import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { ARCADE_GAMES } from './ArcadeChallengeCatalog'
import { activeTournamentsByGame, chooseActiveTournament } from './arcadeActiveTournaments'
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

type StandingsState = {
  tournamentId: string
  rows: Standing[]
  names: Record<string, string>
}

function formatDate(value: string, exclusiveEnd = false) {
  const date = new Date(value)
  if (exclusiveEnd) date.setTime(date.getTime() - 1)
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export default function TournamentsV304({ userId }: { userId: string }) {
  const [items, setItems] = useState<Tournament[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [preferredGameId, setPreferredGameId] = useState('pong')
  const [standings, setStandings] = useState<StandingsState | null>(null)
  const [loadingStandingsId, setLoadingStandingsId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      // O RPC mantém aberta a temporada do mês atual; a consulta não inclui
      // próximas temporadas nem depende dos 60 registros mais recentes.
      const provision = await supabase.rpc('hax_v304_ensure_season')
      if (provision.error) throw provision.error
      const now = new Date()
      const { data, error: loadError } = await supabase
        .from('hax_v304_tournaments')
        .select('id,game_id,title,season_key,starts_at,ends_at')
        .lte('starts_at', now.toISOString())
        .gt('ends_at', now.toISOString())
        .order('starts_at', { ascending: false })
        .limit(100)
      if (loadError) throw loadError
      setItems((data || []) as Tournament[])
      setNowMs(Date.now())
      setError('')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const reload = () => {
      void refresh().catch((e: Error) => setError(`Torneios indisponíveis: ${e.message}. Confira a migração V304.`))
    }
    reload()
    // Corrige também a virada do mês e o retorno ao app após ficar em segundo plano.
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
      if (document.visibilityState === 'visible') reload()
    }, 60_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const active = useMemo(() => activeTournamentsByGame(items, nowMs), [items, nowMs])
  const chosen = useMemo(() => chooseActiveTournament(active, preferredGameId), [active, preferredGameId])

  useEffect(() => {
    if (!chosen) {
      setLoadingStandingsId(null)
      return
    }
    let alive = true
    setLoadingStandingsId(chosen.id)
    void (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('hax_v304_tournament_standings')
          .select('tournament_id,user_id,best_score,runs_played,updated_at')
          .eq('tournament_id', chosen.id)
          .order('best_score', { ascending: false })
          .limit(30)
        if (!alive) return
        if (loadError) throw loadError
        const rows = (data || []) as Standing[]
        setStandings({ tournamentId: chosen.id, rows, names: {} })
        const ids = rows.map(row => row.user_id)
        if (!ids.length) return
        const people = await supabase.from('profiles').select('id,display_name,username').in('id', ids)
        if (alive && !people.error) {
          const names = Object.fromEntries((people.data || []).map(person => [person.id, person.display_name || person.username || 'Jogador']))
          setStandings(current => current?.tournamentId === chosen.id ? { ...current, names } : current)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Não foi possível consultar o ranking.')
      } finally {
        if (alive) setLoadingStandingsId(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [chosen])

  const scores = chosen && standings?.tournamentId === chosen.id ? standings.rows : []
  const names = chosen && standings?.tournamentId === chosen.id ? standings.names : {}
  const waitingScores = chosen != null && (loadingStandingsId === chosen.id || standings?.tournamentId !== chosen.id)
  const game = chosen ? ARCADE_GAMES.find(entry => entry.id === chosen.game_id) : null
  const myRank = scores.findIndex(row => row.user_id === userId)

  return (
    <section className="hb-v304-wrap hb-v304-compact hb-v304-tournament-shell" id="hb-arcade-tournaments-v304">
      <header className="hb-v304-inline hb-v304-tournament-header">
        <div>
          <small>ARCADE · COMPETIÇÕES</small>
          <h3>Torneios e temporadas</h3>
          <p className="hb-v304-muted">Acompanhe as temporadas em andamento e os melhores resultados verificados pelo servidor.</p>
        </div>
        <button type="button" disabled={refreshing} onClick={() => void refresh().catch((e: Error) => setError(e.message))}>{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button>
      </header>

      {error && <p role="alert" className="hb-v304-error">{error}</p>}

      {loading ? (
        <p>Carregando torneios…</p>
      ) : chosen ? (
        <>
          <div className="hb-v304-tournament-picker" aria-label="Temporadas ativas por jogo">
            <span className="hb-v304-tournament-picker-label">● EM ANDAMENTO · {active.length} {active.length === 1 ? 'JOGO' : 'JOGOS'}</span>
            <div className="hb-v304-tournament-picker-games" role="group" aria-label="Escolher jogo da temporada atual">
              {active.map(item => {
                const gameItem = ARCADE_GAMES.find(entry => entry.id === item.game_id)
                return <button key={item.id} type="button" className={item.id === chosen.id ? 'is-selected' : ''} aria-pressed={item.id === chosen.id} onClick={() => setPreferredGameId(item.game_id)}>{gameItem?.icon || '🏆'} {gameItem?.title || item.game_id}</button>
              })}
            </div>
          </div>
          <article className="hb-v304-tournament-hero">
            <div className="hb-v304-tournament-identity">
              <span className="hb-v304-tournament-icon" aria-hidden="true">{game?.icon || '🏆'}</span>
              <div>
                <div className="hb-v304-tournament-badges">
                  <span className="hb-v304-tournament-status is-live">Em andamento</span>
                  <span className="hb-v304-tournament-game">{game?.title || chosen.game_id}</span>
                </div>
                <h4>{chosen.title}</h4>
                <p className="hb-v304-muted">{chosen.season_key}</p>
              </div>
            </div>
            <div className="hb-v304-tournament-meta">
              <div><span>Período</span><strong>{formatDate(chosen.starts_at)} até {formatDate(chosen.ends_at, true)}</strong></div>
              <div><span>No top 30</span><strong>{scores.length.toLocaleString('pt-BR')}</strong></div>
              <div><span>Sua posição</span><strong>{myRank >= 0 ? `#${myRank + 1}` : '—'}</strong></div>
            </div>
          </article>

          {waitingScores ? (
            <div className="hb-v304-tournament-empty">Carregando classificação…</div>
          ) : scores.length ? (
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
              <strong>Nenhuma pontuação verificada ainda.</strong>
              <p className="hb-v304-muted">Assim que as partidas forem registradas pelo servidor, o ranking aparecerá nesta área.</p>
            </div>
          )}
        </>
      ) : (
        <div className="hb-v304-tournament-empty">
          <strong>Nenhuma temporada em andamento neste momento.</strong>
          <p className="hb-v304-muted">A temporada atual aparecerá aqui assim que estiver disponível. Não exibimos torneios futuros como se fossem os atuais.</p>
        </div>
      )}
    </section>
  )
}
