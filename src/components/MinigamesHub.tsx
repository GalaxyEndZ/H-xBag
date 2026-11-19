import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../supabase'
import './MinigamesHub.css'

const WIDTH = 900
const HEIGHT = 508
const PADDLE_HEIGHT = 96
const PADDLE_WIDTH = 14
const PADDLE_MARGIN = 37
const BALL_RADIUS = 9
const STARTING_LIVES = 3

type Phase = 'ready' | 'playing' | 'paused' | 'over'
type ScoreRow = { placement: number; user_id: string; player_name: string; username: string | null; best_score: number; games_played: number }
type MyScore = { placement?: number | null; best_score?: number; games_played?: number }
type Engine = { ballX: number; ballY: number; vx: number; vy: number; playerY: number; aiY: number; score: number; lives: number; rally: number; opponentGoals: number; playerGoals: number }
const initialEngine = (): Engine => ({ ballX: WIDTH / 2, ballY: HEIGHT / 2, vx: -320, vy: 115, playerY: (HEIGHT - PADDLE_HEIGHT) / 2, aiY: (HEIGHT - PADDLE_HEIGHT) / 2, score: 0, lives: STARTING_LIVES, rally: 0, opponentGoals: 0, playerGoals: 0 })
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value)

function paint(canvas: HTMLCanvasElement, engine: Engine) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const desiredWidth = Math.round(WIDTH * dpr)
  const desiredHeight = Math.round(HEIGHT * dpr)
  if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) { canvas.width = desiredWidth; canvas.height = desiredHeight }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  bg.addColorStop(0, '#101a24'); bg.addColorStop(.52, '#0c101b'); bg.addColorStop(1, '#171525')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(179,199,223,.055)'
  for (let x = 22; x < WIDTH; x += 38) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke() }
  for (let y = 22; y < HEIGHT; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke() }
  ctx.strokeStyle = 'rgba(201,214,239,.23)'; ctx.setLineDash([7, 12]); ctx.beginPath(); ctx.moveTo(WIDTH / 2, 20); ctx.lineTo(WIDTH / 2, HEIGHT - 20); ctx.stroke(); ctx.setLineDash([])
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 75, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(201,214,239,.10)'; ctx.stroke()
  ctx.shadowBlur = 24; ctx.shadowColor = '#8de4ff'; ctx.fillStyle = '#8de4ff'
  ctx.fillRect(PADDLE_MARGIN, engine.playerY, PADDLE_WIDTH, PADDLE_HEIGHT)
  ctx.shadowColor = '#e4b78d'; ctx.fillStyle = '#e4b78d'
  ctx.fillRect(WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, engine.aiY, PADDLE_WIDTH, PADDLE_HEIGHT)
  ctx.shadowBlur = 26; ctx.shadowColor = '#f2f8ff'; ctx.fillStyle = '#f2f8ff'
  ctx.beginPath(); ctx.arc(engine.ballX, engine.ballY, BALL_RADIUS, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.textAlign = 'center'; ctx.font = '700 14px system-ui, sans-serif'; 
  ctx.fillStyle = '#84c4d3'; ctx.fillText('VOCÊ', WIDTH * .25, 36)
  ctx.fillStyle = '#c4a08b'; ctx.fillText('COMPUTADOR', WIDTH * .75, 36)
}

export default function MinigamesHub({ userId }: { userId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine>(initialEngine())
  const keysRef = useRef({ up: false, down: false })
  const targetYRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [rally, setRally] = useState(0)
  const [games, setGames] = useState({ player: 0, opponent: 0 })
  const [ranking, setRanking] = useState<ScoreRow[]>([])
  const [myScore, setMyScore] = useState<MyScore | null>(null)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [starting, setStarting] = useState(false)

  const refreshRanking = useCallback(async () => {
    setRankingLoading(true)
    const [board, mine] = await Promise.all([
      supabase.rpc('hax_pong_leaderboard', { p_limit: 25 }),
      supabase.rpc('hax_pong_my_score'),
    ])
    if (board.error) { setRankingError('Ranking indisponível. Execute a migração SQL V188 no Supabase.'); setRanking([]) }
    else { setRankingError(''); setRanking((board.data || []) as ScoreRow[]) }
    if (!mine.error && mine.data && typeof mine.data === 'object' && !Array.isArray(mine.data)) setMyScore(mine.data as MyScore)
    setRankingLoading(false)
  }, [])

  useEffect(() => { void refreshRanking() }, [refreshRanking])
  useEffect(() => { if (canvasRef.current) paint(canvasRef.current, engineRef.current) }, [])

  const finish = useCallback(async (finalScore: number) => {
    if (savingRef.current) return
    savingRef.current = true
    const runId = runIdRef.current
    runIdRef.current = null
    if (!runId) { setSaveStatus('Partida concluída. O ranking está indisponível até a instalação do SQL.'); savingRef.current = false; return }
    setSaveStatus('Salvando pontuação…')
    const { error } = await supabase.rpc('hax_pong_finish', { p_run_id: runId, p_score: finalScore })
    if (error) setSaveStatus(`Pontuação não registrada: ${error.message}`)
    else { setSaveStatus('Pontuação registrada no ranking global!'); await refreshRanking() }
    savingRef.current = false
  }, [refreshRanking])

  const serve = (engine: Engine, toPlayer: boolean) => {
    engine.ballX = WIDTH / 2; engine.ballY = HEIGHT / 2
    engine.vx = (toPlayer ? -1 : 1) * (325 + Math.min(140, engine.score * 1.6))
    engine.vy = (Math.random() * 2 - 1) * 190
    engine.rally = 0
  }

  useEffect(() => {
    if (phase !== 'playing') { if (canvasRef.current) paint(canvasRef.current, engineRef.current); return }
    let frame = 0
    let last = 0
    let running = true
    const tick = (now: number) => {
      if (!running) return
      if (!last) last = now
      const dt = Math.min((now - last) / 1000, .035)
      last = now
      const game = engineRef.current
      const speed = 420
      if (keysRef.current.up) game.playerY -= speed * dt
      if (keysRef.current.down) game.playerY += speed * dt
      if (targetYRef.current !== null && !keysRef.current.up && !keysRef.current.down) {
        game.playerY += clamp(targetYRef.current - PADDLE_HEIGHT / 2 - game.playerY, -speed * 1.9 * dt, speed * 1.9 * dt)
      }
      game.playerY = clamp(game.playerY, 10, HEIGHT - PADDLE_HEIGHT - 10)
      const aim = (game.vx > 0 ? game.ballY : HEIGHT / 2) - PADDLE_HEIGHT / 2
      const aiMove = clamp(aim - game.aiY, -(265 + Math.min(100, game.score * 1.7)) * dt, (265 + Math.min(100, game.score * 1.7)) * dt)
      game.aiY = clamp(game.aiY + aiMove, 10, HEIGHT - PADDLE_HEIGHT - 10)
      const previousX = game.ballX
      game.ballX += game.vx * dt
      game.ballY += game.vy * dt
      if (game.ballY < BALL_RADIUS) { game.ballY = BALL_RADIUS; game.vy = Math.abs(game.vy) }
      if (game.ballY > HEIGHT - BALL_RADIUS) { game.ballY = HEIGHT - BALL_RADIUS; game.vy = -Math.abs(game.vy) }
      const bounce = (paddleY: number, toRight: boolean) => {
        const hit = clamp((game.ballY - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2), -1, 1)
        const velocity = Math.min(850, Math.hypot(game.vx, game.vy) * 1.05 + 8)
        const angle = hit * .93
        game.vx = (toRight ? 1 : -1) * Math.cos(angle) * velocity
        game.vy = Math.sin(angle) * velocity
        game.rally++
        if (toRight) { game.score++; setScore(game.score); setRally(game.rally) }
      }
      if (game.vx < 0 && game.ballX - BALL_RADIUS <= PADDLE_MARGIN + PADDLE_WIDTH && previousX - BALL_RADIUS >= PADDLE_MARGIN + PADDLE_WIDTH && game.ballY >= game.playerY - BALL_RADIUS && game.ballY <= game.playerY + PADDLE_HEIGHT + BALL_RADIUS) {
        game.ballX = PADDLE_MARGIN + PADDLE_WIDTH + BALL_RADIUS; bounce(game.playerY, true)
      }
      if (game.vx > 0 && game.ballX + BALL_RADIUS >= WIDTH - PADDLE_MARGIN - PADDLE_WIDTH && previousX + BALL_RADIUS <= WIDTH - PADDLE_MARGIN - PADDLE_WIDTH && game.ballY >= game.aiY - BALL_RADIUS && game.ballY <= game.aiY + PADDLE_HEIGHT + BALL_RADIUS) {
        game.ballX = WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_RADIUS; bounce(game.aiY, false)
      }
      if (game.ballX < -BALL_RADIUS) {
        game.lives--; game.opponentGoals++; setLives(game.lives); setGames({ player: game.playerGoals, opponent: game.opponentGoals }); setRally(0)
        if (game.lives === 0) { setPhase('over'); void finish(game.score); if (canvasRef.current) paint(canvasRef.current, game); return }
        serve(game, true)
      }
      if (game.ballX > WIDTH + BALL_RADIUS) {
        game.score += 5; game.playerGoals++; setScore(game.score); setGames({ player: game.playerGoals, opponent: game.opponentGoals }); setRally(0)
        serve(game, false)
      }
      if (canvasRef.current) paint(canvasRef.current, game)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => { running = false; window.cancelAnimationFrame(frame) }
  }, [phase, finish])

  useEffect(() => {
    const isInput = (element: EventTarget | null) => element instanceof HTMLElement && !!element.closest('input,textarea,select,[contenteditable="true"]')
    const down = (event: KeyboardEvent) => {
      if (isInput(event.target) || phase === 'ready' || phase === 'over') return
      if (['ArrowUp','ArrowDown',' ','w','W','s','S'].includes(event.key)) event.preventDefault()
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') keysRef.current.up = true
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') keysRef.current.down = true
      if (event.code === 'Space' && !event.repeat) setPhase(current => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') keysRef.current.up = false
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') keysRef.current.down = false
    }
    const onHidden = () => { if (document.hidden) setPhase(current => current === 'playing' ? 'paused' : current) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); document.addEventListener('visibilitychange', onHidden)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); document.removeEventListener('visibilitychange', onHidden); keysRef.current = { up: false, down: false } }
  }, [phase])

  const start = async () => {
    if (starting) return
    setStarting(true)
    setSaveStatus('')
    let runId: string | null = null
    const { data, error } = await supabase.rpc('hax_pong_start')
    if (!error && typeof data === 'string') runId = data
    else setSaveStatus('O ranking está indisponível nesta sessão; ainda é possível jogar normalmente.')
    runIdRef.current = runId
    savingRef.current = false
    engineRef.current = initialEngine()
    targetYRef.current = null
    setScore(0); setLives(STARTING_LIVES); setRally(0); setGames({ player: 0, opponent: 0 })
    setPhase('playing'); setStarting(false)
    canvasRef.current?.focus({ preventScroll: true })
  }
  const handlePointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    targetYRef.current = clamp((event.clientY - bounds.top) / bounds.height * HEIGHT, 0, HEIGHT)
  }

  return <section className="hb-arcade" aria-labelledby="hb-arcade-heading">
    <header className="hb-arcade-hero">
      <div><span className="hb-arcade-eyebrow">HÄXBAG / MINIGAMES / ARCADE</span><h1 id="hb-arcade-heading">Minigames<span>.</span></h1><p>Pequenas disputas, grandes pontuações. Jogue, supere seu recorde e suba no ranking da comunidade.</p><div className="hb-arcade-chips"><span>◉ Pong disponível</span><span>♜ Ranking global</span><span>⌨ Teclado, mouse e toque</span></div></div>
      <div className="hb-arcade-hero-mark" aria-hidden="true"><span>◉</span><b>ARCADE</b></div>
    </header>
    <div className="hb-arcade-grid">
      <div className="hb-arcade-main">
        <div className="hb-arcade-game-card">
          <div className="hb-arcade-card-head"><div><span className="hb-arcade-eyebrow">01 / CLÁSSICOS</span><h2>Pong <span>✦</span></h2><p>Devolva a bola para marcar pontos. Marque um gol para ganhar bônus!</p></div><span className="hb-arcade-status">{phase === 'playing' ? '● AO VIVO' : phase === 'paused' ? 'Ⅱ PAUSADO' : phase === 'over' ? '◆ FIM DE JOGO' : '○ PRONTO'}</span></div>
          <div className="hb-arcade-metrics"><div><small>PONTOS</small><strong>{formatNumber(score)}</strong></div><div><small>VIDAS</small><strong className="hb-arcade-lives">{'♥'.repeat(lives)}{'♡'.repeat(STARTING_LIVES - lives)}</strong></div><div><small>SEQUÊNCIA</small><strong>{rally}</strong></div><div><small>PLACAR</small><strong>{games.player} : {games.opponent}</strong></div></div>
          <div className="hb-pong-frame">
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} tabIndex={0} onPointerDown={handlePointer} onPointerMove={handlePointer} onPointerLeave={() => { targetYRef.current = null }} aria-label="Pong: mova a raquete com o mouse, toque ou teclas W, S e setas" />
            {phase !== 'playing' && <div className="hb-pong-overlay"><div className="hb-pong-overlay-content"><span className="hb-pong-overlay-symbol" aria-hidden="true">◈</span><h3>{phase === 'ready' ? 'Pronto para jogar?' : phase === 'paused' ? 'Partida pausada' : 'Fim de jogo'}</h3><p>{phase === 'ready' ? 'Você tem 3 vidas. Cada devolução vale 1 ponto e cada gol vale 5.' : phase === 'paused' ? 'A bola está parada até você continuar.' : `Você fez ${formatNumber(score)} pontos nesta partida.`}</p><button type="button" onClick={() => phase === 'paused' ? setPhase('playing') : void start()} disabled={starting}>{starting ? 'Preparando…' : phase === 'paused' ? '▶ Continuar' : phase === 'over' ? '↻ Jogar novamente' : '▶ Começar partida'}</button></div></div>}
          </div>
          <div className="hb-arcade-controls"><div><span>W / S</span> ou <span>↑ / ↓</span> para mover · mouse / toque na quadra · <span>Espaço</span> para pausar</div><div>{phase === 'playing' && <button type="button" onClick={() => setPhase('paused')}>Ⅱ Pausar</button>}{phase === 'paused' && <button type="button" onClick={() => setPhase('playing')}>▶ Retomar</button>}</div></div>
          {saveStatus && <p className="hb-arcade-save" role="status">{saveStatus}</p>}
        </div>
        <div className="hb-arcade-how"><div><strong>+1</strong><span>Por devolução</span></div><div><strong>+5</strong><span>Por gol no computador</span></div><div><strong>3</strong><span>Vidas por partida</span></div><div><strong>♛</strong><span>Seu melhor recorde</span></div></div>
      </div>
      <aside className="hb-arcade-ranking" aria-labelledby="hb-pong-ranking-title">
        <div className="hb-arcade-ranking-head"><span className="hb-arcade-eyebrow">COMPETIÇÃO GLOBAL</span><h2 id="hb-pong-ranking-title">🏆 Ranking Pong</h2><p>Melhor pontuação de cada jogador do HäxBag.</p><button type="button" onClick={() => void refreshRanking()} disabled={rankingLoading}>{rankingLoading ? 'Atualizando…' : '↻ Atualizar ranking'}</button></div>
        <div className="hb-arcade-my-rank"><small>SUA POSIÇÃO</small><strong>{myScore?.placement ? `#${myScore.placement}` : '—'}</strong><div><span>Recorde</span><b>{formatNumber(myScore?.best_score || 0)}</b></div><div><span>Partidas</span><b>{formatNumber(myScore?.games_played || 0)}</b></div></div>
        {rankingError && <p className="hb-arcade-error" role="status">{rankingError}</p>}
        {rankingLoading && !ranking.length && <p className="hb-arcade-muted" role="status">Carregando classificação…</p>}
        <ol className="hb-arcade-ranking-list">{ranking.map(row => <li key={row.user_id} className={row.user_id === userId ? 'is-self' : ''}><span className={`hb-arcade-place ${row.placement <= 3 ? 'is-podium' : ''}`}>{row.placement <= 3 ? ['🥇','🥈','🥉'][row.placement - 1] : `#${row.placement}`}</span><span className="hb-arcade-player"><strong>{row.player_name || 'Jogador'}</strong><small>{row.username ? `@${row.username}` : `${row.games_played} partida${row.games_played === 1 ? '' : 's'}`}</small></span><b>{formatNumber(row.best_score)}</b></li>)}</ol>
        {!rankingLoading && !ranking.length && !rankingError && <div className="hb-arcade-empty">Ainda não há pontuações. Seja o primeiro a aparecer no ranking!</div>}
        <p className="hb-arcade-ranking-note">O ranking guarda o melhor resultado de cada conta. Pontuações são enviadas ao concluir a partida.</p>
      </aside>
    </div>
  </section>
}
