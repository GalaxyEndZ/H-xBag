import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { ARCADE_GAMES, type ArcadeGameId } from './ArcadeChallengeCatalog'
import PongGame from './PongGame'
import { SnakeGame, BreakoutGame, AsteroidsGame, FlappyGame, ArenaGame } from './ArcadeCanvasGames'
import { Game2048, MinesweeperGame, MemoryGame } from './ArcadePuzzleGames'
import './MinigamesHub.css'

type DailyChallenge = { challenge_id: string; game_id: ArcadeGameId; title: string; target: number; difficulty: number; completed: boolean; completed_at: string | null; reward: number }
type Wallet = { coins: number; earned_total: number; completed_today: number; reward_today: number; claimed_today: boolean }
type Rank = { placement: number; user_id: string; player_name: string; username: string | null; best_score: number; games_played: number }
type MyScore = { placement?: number | null; best_score?: number; games_played?: number }
type Phase = 'ready' | 'starting' | 'playing' | 'paused' | 'over'
const nf = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const daysInBrasilia = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const difficultyLabel = (difficulty: number) => difficulty <= 1 ? 'Fácil' : difficulty <= 3 ? 'Médio' : 'Difícil'
const EMPTY_WALLET: Wallet = { coins: 0, earned_total: 0, completed_today: 0, reward_today: 0, claimed_today: false }

/** Arcade com 9 jogos e desafios do dia vindos do catálogo do servidor. */
export default function MinigamesHub({ userId }: { userId: string }) {
  const [selectedGame, setSelectedGame] = useState<ArcadeGameId>('pong')
  const [phase, setPhase] = useState<Phase>('ready')
  const [gameKey, setGameKey] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [daily, setDaily] = useState<DailyChallenge[]>([])
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET)
  const [dailyError, setDailyError] = useState('')
  const [ranking, setRanking] = useState<Rank[]>([])
  const [myScore, setMyScore] = useState<MyScore | null>(null)
  const [rankingError, setRankingError] = useState('')
  const [rankingLoading, setRankingLoading] = useState(false)
  const [day, setDay] = useState(() => daysInBrasilia(new Date()))
  const runId = useRef<string | null>(null)
  const startVersion = useRef(0)
  const arenaRef = useRef<HTMLElement>(null)
  const selectedGameRef = useRef<ArcadeGameId>(selectedGame)
  selectedGameRef.current = selectedGame
  const saving = useRef(false)
  const game = ARCADE_GAMES.find(item => item.id === selectedGame) || ARCADE_GAMES[0]

  const refreshChallenges = useCallback(async () => {
    const [challenges, balance] = await Promise.all([
      supabase.rpc('hax_arcade_daily_challenges'),
      supabase.rpc('hax_arcade_wallet'),
    ])
    if (challenges.error || balance.error) {
      setDailyError('Desafios indisponíveis. Execute HaxBag_Arcade_Jogos_Desafios_V190.sql no Supabase.')
      return
    }
    setDaily((challenges.data || []) as DailyChallenge[])
    if (balance.data && typeof balance.data === 'object' && !Array.isArray(balance.data)) setWallet(balance.data as Wallet)
    setDailyError('')
  }, [])

  const refreshRanking = useCallback(async (gameId: ArcadeGameId) => {
    if (gameId === 'pong') return
    setRankingLoading(true)
    const [leaders, mine] = await Promise.all([
      supabase.rpc('hax_arcade_leaderboard', { p_game: gameId, p_limit: 25 }),
      supabase.rpc('hax_arcade_my_score', { p_game: gameId }),
    ])
    if (leaders.error) { setRanking([]); setRankingError('Ranking indisponível. Instale o SQL V190.') }
    else { setRanking((leaders.data || []) as Rank[]); setRankingError('') }
    setMyScore(!mine.error && mine.data && typeof mine.data === 'object' && !Array.isArray(mine.data) ? mine.data as MyScore : null)
    setRankingLoading(false)
  }, [])

  useEffect(() => { void refreshChallenges() }, [refreshChallenges])
  useEffect(() => { void refreshRanking(selectedGame) }, [refreshRanking, selectedGame])
  useEffect(() => {
    const onHidden = () => { if (document.hidden) setPhase(current => current === 'playing' ? 'paused' : current) }
    const onKeys = (event: KeyboardEvent) => {
      if (selectedGameRef.current === 'pong' || event.repeat || !(event.key.toLowerCase() === 'p' || event.key === 'Escape')) return
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]')) return
      event.preventDefault()
      setPhase(current => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('keydown', onKeys)
    return () => { document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('keydown', onKeys) }
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextDay = daysInBrasilia(new Date())
      if (nextDay !== day) { setDay(nextDay); void refreshChallenges() }
    }, 30000)
    return () => clearInterval(timer)
  }, [day, refreshChallenges])

  const selectGame = (next: ArcadeGameId, scroll = false) => {
    if (saving.current || phase === 'starting') return
    if (next !== selectedGame) {
      if ((phase === 'playing' || phase === 'paused') && !window.confirm('Sair da partida atual? A pontuação desta partida não será registrada.')) return
      startVersion.current++
      runId.current = null
      setPhase('ready'); setResult(null); setSaveStatus('')
      setSelectedGame(next)
    }
    if (scroll) window.requestAnimationFrame(() => arenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const finishGame = useCallback(async (score: number) => {
    if (saving.current) return
    saving.current = true
    setSavingResult(true)
    const finishedGameId = selectedGameRef.current
    setResult(score)
    setPhase('over')
    const id = runId.current
    runId.current = null
    if (!id) { setSaveStatus('Partida concluída. Sem acesso ao servidor: resultado não registrado no ranking.'); saving.current = false; setSavingResult(false); return }
    setSaveStatus('Registrando pontuação…')
    const { data, error } = await supabase.rpc('hax_arcade_finish', { p_run: id, p_score: score })
    if (error) setSaveStatus(`Não foi possível registrar: ${error.message}`)
    else {
      const award = data && typeof data === 'object' && !Array.isArray(data) ? Number((data as {coins_earned?:number}).coins_earned || 0) : 0
      setSaveStatus(award ? `3/3 desafios! Você recebeu ${award} moedinhas!` : 'Partida salva no ranking global!')
      void refreshChallenges()
      void refreshRanking(finishedGameId)
    }
    saving.current = false
    setSavingResult(false)
  }, [refreshChallenges, refreshRanking])

  // O callback de término precisa permanecer estável durante toda a partida (RAF/intervalos).
  const startGame = async () => {
    if (phase === 'starting' || saving.current) return
    const version = ++startVersion.current
    const requestedGame = selectedGame
    setPhase('starting'); setResult(null); setSaveStatus('')
    const { data, error } = await supabase.rpc('hax_arcade_start', { p_game: requestedGame })
    if (version !== startVersion.current) return
    runId.current = !error && typeof data === 'string' ? data : null
    if (error) setSaveStatus('Modo local: não foi possível iniciar a partida pontuada. Verifique a migração V190.')
    setGameKey(k => k + 1)
    setPhase('playing')
  }

  const replay = () => { void startGame() }
  const showPong = selectedGame === 'pong'
  const completed = daily.filter(ch => ch.completed).length
  const reward = daily[0]?.reward || wallet.reward_today || 0
  const gameComponent = () => {
    const props = { onFinish: finishGame, paused: phase === 'paused' }
    switch (selectedGame) {
      case 'snake': return <SnakeGame {...props} />
      case 'breakout': return <BreakoutGame {...props} />
      case '2048': return <Game2048 {...props} />
      case 'asteroids': return <AsteroidsGame {...props} />
      case 'minesweeper': return <MinesweeperGame {...props} />
      case 'flappy': return <FlappyGame {...props} />
      case 'arena': return <ArenaGame {...props} />
      case 'memory': return <MemoryGame {...props} />
      default: return null
    }
  }

  return <section className="hb-arcade hb-arcade-v190" aria-labelledby="hb-arcade-heading">
    <header className="hb-arcade-hero"><div><span className="hb-arcade-eyebrow">HÄXBAG / ARCADE</span><h1 id="hb-arcade-heading">Minigames<span>.</span></h1><p>Nove jogos de progressão contínua, rankings globais e três desafios diferentes a cada dia. Jogue e ganhe moedinhas ao completar o conjunto!</p><div className="hb-arcade-chips"><span>♾️ 9 jogos infinitos</span><span>🏆 Rankings globais</span><span>🗓 3 desafios por dia</span></div></div><div className="hb-arcade-hero-mark" aria-hidden="true"><span>◈</span><b>ARCADE</b></div></header>

    <section className="hb-arcade-daily" aria-labelledby="hb-arcade-daily-heading">
      <div className="hb-arcade-daily-top"><div><span className="hb-arcade-eyebrow">MISSÕES DO DIA · HORÁRIO DE BRASÍLIA</span><h2 id="hb-arcade-daily-heading">Desafios diários</h2><p>O mesmo trio é sorteado para toda a comunidade. Novas metas à meia-noite.</p></div><div className="hb-arcade-wallet"><span>🪙 SALDO DO ARCADE</span><strong>{nf(wallet.coins || 0)}</strong><small>{wallet.claimed_today ? 'Recompensa de hoje recebida ✓' : `Conjunto completo: +${reward} moedas`}</small></div></div>
      <div className="hb-arcade-progress"><div><strong>{completed}/3 concluídos</strong><span>{wallet.claimed_today ? `+${reward} moedinhas creditadas!` : completed === 3 ? 'Conjunto concluído!' : 'A recompensa só é creditada após os 3 desafios'}</span></div><div className="hb-arcade-progress-track"><span style={{width:`${completed / 3 * 100}%`}}/></div></div>
      {dailyError && <p className="hb-arcade-error" role="alert">{dailyError}</p>}
      <div className="hb-arcade-daily-grid">{daily.map((challenge, i) => {
        const info = ARCADE_GAMES.find(item => item.id === challenge.game_id)
        return <button type="button" key={challenge.challenge_id} className={`hb-arcade-challenge ${challenge.completed ? 'is-done':''}`} onClick={() => selectGame(challenge.game_id, true)}><span className="hb-arcade-challenge-number">{String(i + 1).padStart(2,'0')} · {difficultyLabel(challenge.difficulty)}</span><span className="hb-arcade-challenge-icon" aria-hidden="true">{info?.icon || '◈'}</span><strong>{challenge.title}</strong><span className="hb-arcade-challenge-game">{info?.title}</span><span className="hb-arcade-challenge-foot">{challenge.completed ? '✓ Concluído' : `→ Jogar ${info?.title || challenge.game_id}`}</span></button>
      })}</div>
      <p className="hb-arcade-daily-info">O catálogo tem 27 desafios predefinidos, com níveis fácil, médio e difícil. O sorteio seleciona 3 desafios de jogos diferentes. Prêmio único de 1 a 10 moedas, dependendo da dificuldade do conjunto.</p>
    </section>

    <section className="hb-arcade-library" aria-label="Biblioteca de minigames"><div className="hb-arcade-daily-top"><div><span className="hb-arcade-eyebrow">SUA COLEÇÃO DE JOGOS</span><h2>Escolha um minigame</h2></div><small>Selecione um jogo para abrir a arena e o ranking.</small></div><div className="hb-arcade-games-grid">{ARCADE_GAMES.map(item => <button type="button" key={item.id} className={`hb-arcade-game-choice ${selectedGame===item.id?'is-selected':''}`} onClick={()=>selectGame(item.id, true)} aria-pressed={selectedGame===item.id}><span aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></section>

    {showPong ? <div ref={arenaRef as React.RefObject<HTMLDivElement>} className="hb-arcade-embedded-pong"><PongGame userId={userId} onArcadeUpdated={refreshChallenges} /></div> : <div className="hb-arcade-grid">
      <section ref={arenaRef} className="hb-arcade-main"><div className="hb-arcade-game-card">
        <div className="hb-arcade-card-head"><div><span className="hb-arcade-eyebrow">{game.icon} MINIGAME</span><h2>{game.title} <span>✦</span></h2><p>{game.description}</p></div><span className="hb-arcade-status">{phase==='playing'?'● JOGANDO':phase==='paused'?'Ⅱ PAUSADO':phase==='starting'?'◌ PREPARANDO':phase==='over'?'◆ FIM DE JOGO':'○ PRONTO'}</span></div>
        {phase==='playing' || phase==='paused' || phase==='over' ? <div key={`${selectedGame}-${gameKey}`} className="hb-mini-stage">
          <div className="hb-mini-session-bar"><span>✦ Partida {phase==='over' ? 'concluída' : 'em andamento'}</span>{(phase==='playing' || phase==='paused') && <button type="button" onClick={() => setPhase(current => current === 'playing' ? 'paused' : 'playing')}>{phase==='paused' ? '▶ Continuar' : 'Ⅱ Pausar'} <small>P / Esc</small></button>}</div>
          {gameComponent()}
          {phase==='paused' && <div className="hb-mini-pause-overlay" role="status"><div><span aria-hidden="true">Ⅱ</span><h3>Partida pausada</h3><p>Seu progresso está preservado. Pressione P, Esc ou o botão abaixo para continuar.</p><button type="button" onClick={() => setPhase('playing')}>▶ Retomar partida</button></div></div>}
          {phase==='over' && <div className="hb-mini-result"><div><small>RESULTADO DA PARTIDA</small><strong>{nf(result || 0)} pontos</strong></div><button type="button" disabled={savingResult} onClick={replay}>{savingResult ? 'Salvando…' : '↻ Jogar novamente'}</button></div>}
        </div> : <div className="hb-mini-ready"><span aria-hidden="true">{game.icon}</span><h3>Pronto para jogar {game.title}?</h3><p>{game.description}. Continue até perder ou decida encerrar e salvar sua pontuação no ranking global.</p><button type="button" disabled={phase==='starting'} onClick={()=>void startGame()}>{phase==='starting'?'Preparando…':'▶ Iniciar partida'}</button></div>}
        {saveStatus && <p role="status" className="hb-arcade-save">{saveStatus}</p>}
      </div></section>
      <aside className="hb-arcade-ranking" aria-labelledby="hb-arcade-ranking-title"><div className="hb-arcade-ranking-head"><span className="hb-arcade-eyebrow">COMPETIÇÃO GLOBAL</span><h2 id="hb-arcade-ranking-title">🏆 Ranking {game.title}</h2><p>Melhores pontuações de cada jogador.</p><button type="button" disabled={rankingLoading} onClick={()=>void refreshRanking(selectedGame)}>{rankingLoading?'Atualizando…':'↻ Atualizar ranking'}</button></div>
      <div className="hb-arcade-my-rank"><small>SUA POSIÇÃO</small><strong>{myScore?.placement ? `#${myScore.placement}` : '—'}</strong><div><span>Recorde</span><b>{nf(myScore?.best_score || 0)}</b></div><div><span>Partidas</span><b>{nf(myScore?.games_played || 0)}</b></div></div>
      {rankingError && <p className="hb-arcade-error" role="alert">{rankingError}</p>}
      <ol className="hb-arcade-ranking-list">{ranking.map(row => <li className={row.user_id===userId?'is-self':''} key={row.user_id}><span className="hb-arcade-place">{row.placement<=3?['🥇','🥈','🥉'][row.placement-1]:`#${row.placement}`}</span><span className="hb-arcade-player"><strong>{row.player_name}</strong><small>{row.username?`@${row.username}`:`${row.games_played} partidas`}</small></span><b>{nf(row.best_score)}</b></li>)}</ol>
      {!rankingLoading && !ranking.length && !rankingError && <div className="hb-arcade-empty">Ainda não há pontuações registradas.</div>}
      <p className="hb-arcade-ranking-note">Cada conta aparece uma vez, pelo melhor resultado.</p></aside>
    </div>}
  </section>
}
