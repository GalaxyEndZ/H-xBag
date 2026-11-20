import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SurvivorExperience, SurvivorUpgradeChoice, experienceForNextLevel, arenaExperienceDrop, drawSurvivorUpgrades, type SurvivorUpgradeId, type SurvivorUpgrade } from './ArcadeSurvivorUpgrades'
import { breakAsteroid, shotHitsAsteroid } from './ArcadeAsteroidFragmentation'

export type ArcadeGameProps = { onFinish: (score: number) => void; paused?: boolean }
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))
const rand = (max: number) => Math.floor(Math.random() * max)
const BASE_W = 720, BASE_H = 420

function useArcadeKeyboard(keys: string[], handler: (key: string, down: boolean) => void) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable]')) return
      if (keys.includes(e.key.toLowerCase())) { e.preventDefault(); latest.current(e.key.toLowerCase(), true) }
    }
    const up = (e: KeyboardEvent) => { if (keys.includes(e.key.toLowerCase())) latest.current(e.key.toLowerCase(), false) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [keys.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Fundo estático compartilhado: evita recriar linhas de grade em todos os frames.
const backdropCache = new Map<string, HTMLCanvasElement>()
function frame(ctx: CanvasRenderingContext2D, width = BASE_W, height = BASE_H) {
  const key = `${width}x${height}`
  let background = backdropCache.get(key)
  if (!background) {
    background = document.createElement('canvas')
    background.width = width; background.height = height
    const bg = background.getContext('2d')
    if (!bg) { ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, width, height); return }
    bg.fillStyle = '#0b1420'; bg.fillRect(0, 0, width, height)
    bg.strokeStyle = '#ffffff0e'; bg.lineWidth = 1
    for (let x = 0; x <= width; x += 30) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, height); bg.stroke() }
    for (let y = 0; y <= height; y += 30) { bg.beginPath(); bg.moveTo(0, y); bg.lineTo(width, y); bg.stroke() }
    backdropCache.set(key, background)
  }
  ctx.drawImage(background, 0, 0)
}
/** Usa mais pixels internos ao ampliar o canvas, mantendo a física em coordenadas 720×420. */
function prepareArcadeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const cssScale = canvas.clientWidth / BASE_W
  const density = Math.min(2.25, Math.max(1, window.devicePixelRatio || 1, cssScale))
  const targetWidth = Math.round(BASE_W * density)
  const targetHeight = Math.round(BASE_H * density)
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth
    canvas.height = targetHeight
  }
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(canvas.width / BASE_W, 0, 0, canvas.height / BASE_H, 0, 0)
  return ctx
}

function canvasPointer(e: ReactPointerEvent<HTMLCanvasElement>, w = BASE_W, h = BASE_H) {
  const rect = e.currentTarget.getBoundingClientRect()
  return { x: clamp((e.clientX - rect.left) / rect.width * w, 0, w), y: clamp((e.clientY - rect.top) / rect.height * h, 0, h) }
}

// Snake: grades e colisões independentes do ritmo de renderização.
type Point = { x: number; y: number }
const SNAKE_SIZE = 20
function spawnFood(snake: Point[]): Point {
  const occupied = new Set(snake.map(part => part.y * SNAKE_SIZE + part.x))
  const free: number[] = []
  for (let i = 0; i < SNAKE_SIZE * SNAKE_SIZE; i++) if (!occupied.has(i)) free.push(i)
  const chosen = free[rand(free.length)] ?? 0
  return { x: chosen % SNAKE_SIZE, y: Math.floor(chosen / SNAKE_SIZE) }
}
export function SnakeGame({ onFinish, paused = false }: ArcadeGameProps) {
  const snakeRef = useRef<Point[]>([{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }])
  const foodRef = useRef<Point>(spawnFood(snakeRef.current))
  const direction = useRef<Point>({ x: 1, y: 0 })
  const nextDirection = useRef<Point>({ x: 1, y: 0 })
  const swipeStart = useRef<Point | null>(null)
  const scoreRef = useRef(0)
  const ended = useRef(false)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [snake, setSnake] = useState<Point[]>(snakeRef.current)
  const [food, setFood] = useState(foodRef.current)
  // O corpo era percorrido até 400 vezes por render. A busca por posição agora é O(1).
  const snakeCells = useMemo(() => new Map<number, number>(snake.map((part, index): [number, number] => [part.y * SNAKE_SIZE + part.x, index])), [snake])
  const turn = (dx: number, dy: number) => {
    if (paused || ended.current) return
    const now = direction.current
    if (dx !== -now.x || dy !== -now.y) nextDirection.current = { x: dx, y: dy }
  }
  useArcadeKeyboard(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'], (key, down) => {
    if (!down || paused) return
    if (key === 'arrowup' || key === 'w') turn(0, -1)
    if (key === 'arrowdown' || key === 's') turn(0, 1)
    if (key === 'arrowleft' || key === 'a') turn(-1, 0)
    if (key === 'arrowright' || key === 'd') turn(1, 0)
  })
  useEffect(() => {
    let timer = 0
    const tick = () => {
      if (ended.current) return
      if (!paused) {
        direction.current = nextDirection.current
        const { x, y } = snakeRef.current[0]
        const newHead = { x: x + direction.current.x, y: y + direction.current.y }
        const eating = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y
        const body = eating ? snakeRef.current : snakeRef.current.slice(0, -1)
        if (newHead.x < 0 || newHead.x >= SNAKE_SIZE || newHead.y < 0 || newHead.y >= SNAKE_SIZE || body.some(p => p.x === newHead.x && p.y === newHead.y)) {
          ended.current = true; onFinish(scoreRef.current); return
        }
        snakeRef.current = [newHead, ...snakeRef.current.slice(0, eating ? undefined : -1)]
        setSnake(snakeRef.current)
        if (eating) {
          scoreRef.current += 10; setScore(scoreRef.current)
          if (snakeRef.current.length === SNAKE_SIZE * SNAKE_SIZE) {
            // Tabuleiro perfeito: não encerra a partida; recomeça a arena mantendo os pontos.
            snakeRef.current = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }]
            direction.current = { x: 1, y: 0 }; nextDirection.current = { x: 1, y: 0 }
            setSnake(snakeRef.current)
            setRound(current => current + 1)
          }
          foodRef.current = spawnFood(snakeRef.current); setFood(foodRef.current)
        }
      }
      timer = window.setTimeout(tick, Math.max(68, 142 - Math.floor(scoreRef.current / 50) * 8))
    }
    timer = window.setTimeout(tick, 142)
    return () => window.clearTimeout(timer)
  }, [onFinish, paused])
  const endSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current; swipeStart.current = null
    if (!start || paused) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0)
    else turn(0, Math.sign(dy))
  }
  const finish = () => { if (ended.current || paused) return; ended.current = true; onFinish(scoreRef.current) }
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🍎 {score} pontos</strong><span>Rodada {round} · {snake.length} segmentos · Velocidade {Math.floor(score/50)+1} · Setas, WASD ou deslize</span></div><div className="hb-snake-board" role="img" aria-label={`Jogo Snake, ${score} pontos`} onPointerDown={e=>{swipeStart.current={x:e.clientX,y:e.clientY}}} onPointerUp={endSwipe} onPointerCancel={()=>{swipeStart.current=null}}>{Array.from({ length: 400 }, (_, i) => { const x = i % 20, y = Math.floor(i / 20); const body = snakeCells.get(i) ?? -1; return <span key={i} className={`${body === 0 ? 'head' : body > 0 ? 'body' : ''} ${food.x === x && food.y === y ? 'fruit' : ''}`} /> })}</div><div className="hb-mini-pad" aria-label="Direção da serpente"><button type="button" disabled={paused} onClick={() => turn(-1, 0)}>←</button><button type="button" disabled={paused} onClick={() => turn(0, -1)}>↑</button><button type="button" disabled={paused} onClick={() => turn(0, 1)}>↓</button><button type="button" disabled={paused} onClick={() => turn(1, 0)}>→</button></div><button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || ended.current} onClick={finish}>✓ Encerrar e registrar {score} pontos</button></div>
}

type Brick = { x: number; y: number; hp: number; maxHp: number; row: number }
/** Cada onda traz uma parede nova; algumas peças resistem a mais de uma batida. */
export function createBreakoutWave(wave: number): Brick[] {
  const rows = Math.min(7, 4 + Math.ceil(wave / 2))
  const armor = Math.min(3, 1 + Math.floor((wave - 1) / 3))
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < 10; column++) {
    // Da onda 2 em diante, padrões mudam sem bloquear a bola na área inferior.
    const gap = wave > 1 && (column + row * 2 + wave) % (wave % 2 ? 11 : 13) === 0
    if (gap) continue
    const hp = row < Math.min(wave - 1, 3) && (column + row + wave) % 3 === 0 ? armor : 1
    bricks.push({ x: 27 + column * 67, y: 44 + row * 32, hp, maxHp: hp, row })
  }
  return bricks
}

export function BreakoutGame({ onFinish, paused = false }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const controls = useRef<{ left: boolean; right: boolean; target: number | null }>({ left: false, right: false, target: null })
  const game = useRef({
    ballX: 360, ballY: 343, vx: 155, vy: -220,
    paddle: 310, score: 0, lives: 3, wave: 1, ended: false,
    bricks: createBreakoutWave(1), nextWaveDelay: 1.1, waveFlash: 1.3,
  })
  const [score, setScore] = useState(0), [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1), [bricksLeft, setBricksLeft] = useState(game.current.bricks.length)
  const paddleWidth = (level: number) => Math.max(64, 90 - (level - 1) * 3)
  useArcadeKeyboard(['arrowleft', 'arrowright', 'a', 'd'], (key, down) => {
    if (paused) return
    controls.current.target = null
    if (key === 'arrowleft' || key === 'a') controls.current.left = down
    else controls.current.right = down
  })
  useEffect(() => {
    if (paused) { controls.current.left = false; controls.current.right = false }
  }, [paused])
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || paused) return
    let id = 0, last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(.035, (now - last) / 1000) : .016
      last = now
      const g = game.current, ctl = controls.current
      if (g.ended) return
      if (paused) { id = requestAnimationFrame(tick); return }
      const pw = paddleWidth(g.wave)
      if (ctl.left) g.paddle -= 430 * dt
      if (ctl.right) g.paddle += 430 * dt
      if (!ctl.left && !ctl.right && ctl.target !== null)
        g.paddle += clamp(ctl.target - pw / 2 - g.paddle, -620 * dt, 620 * dt)
      g.paddle = clamp(g.paddle, 6, 714 - pw)
      g.waveFlash = Math.max(0, g.waveFlash - dt)
      if (g.nextWaveDelay > 0) {
        g.nextWaveDelay -= dt
        g.ballX = g.paddle + pw / 2
        g.ballY = 362
      } else {
        const previousY = g.ballY
        g.ballX += g.vx * dt
        g.ballY += g.vy * dt
        if (g.ballX < 8 || g.ballX > 712) {
          g.vx *= -1; g.ballX = clamp(g.ballX, 8, 712)
        }
        if (g.ballY < 8) { g.vy = Math.abs(g.vy); g.ballY = 8 }
        if (g.vy > 0 && previousY <= 375 && g.ballY >= 375 && g.ballX >= g.paddle - 7 && g.ballX <= g.paddle + pw + 7) {
          const offset = clamp((g.ballX - (g.paddle + pw / 2)) / (pw / 2), -1, 1)
          const speed = Math.min(445, 250 + (g.wave - 1) * 22 + Math.floor(g.score / 160) * 5)
          g.vx = (offset >= 0 ? 1 : -1) * Math.max(65, Math.abs(offset * speed * .78))
          g.vy = -Math.sqrt(Math.max(170 * 170, speed * speed - g.vx * g.vx))
          g.ballY = 374
        }
        for (const brick of g.bricks) {
          if (brick.hp > 0 && g.ballX > brick.x - 8 && g.ballX < brick.x + 68 && g.ballY > brick.y - 8 && g.ballY < brick.y + 33) {
            brick.hp -= 1
            const movingDown = g.vy > 0
            g.vy = movingDown ? -Math.abs(g.vy) : Math.abs(g.vy)
            // Reposicionar fora do bloco evita contá-lo duas vezes no frame seguinte.
            g.ballY = movingDown ? brick.y - 9 : brick.y + 34
            if (brick.hp <= 0) { g.score += 10; setScore(g.score); setBricksLeft(current => Math.max(0, current - 1)) }
            break
          }
        }
        if (g.ballY > 430) {
          g.lives -= 1; setLives(g.lives)
          if (g.lives <= 0) {
            g.ended = true
            onFinish(g.score)
            return
          }
          g.vx = 145 + Math.min(70, g.wave * 8)
          g.vy = -240 - Math.min(120, g.wave * 15)
          g.nextWaveDelay = 1
        }
        // Nunca encerra por limpar a parede: uma nova onda nasce na mesma partida.
        if (g.bricks.every(brick => brick.hp <= 0)) {
          g.wave += 1
          g.bricks = createBreakoutWave(g.wave)
          g.nextWaveDelay = 1.2
          g.waveFlash = 1.7
          g.vx = (g.wave % 2 ? 1 : -1) * (155 + Math.min(100, g.wave * 10))
          g.vy = -220 - Math.min(150, g.wave * 18)
          setWave(g.wave)
          setBricksLeft(g.bricks.length)
        }
      }
      frame(ctx)
      const palette = ['#7eacc7', '#88d7c6', '#f0c88f', '#d9a2ad', '#aa9bd5', '#94c2df', '#bbaddb']
      for (const brick of g.bricks) if (brick.hp > 0) {
        ctx.fillStyle = palette[brick.row] || '#88d7c6'
        ctx.globalAlpha = brick.hp < brick.maxHp ? .6 : 1
        ctx.fillRect(brick.x, brick.y, 60, 24)
        ctx.globalAlpha = 1
        if (brick.hp > 1) { ctx.strokeStyle = '#ffffff9b'; ctx.lineWidth = 1; ctx.strokeRect(brick.x + 3, brick.y + 3, 54, 18) }
      }
      ctx.fillStyle = '#8ee3fc'; ctx.fillRect(g.paddle, 383, pw, 11)
      ctx.beginPath(); ctx.arc(g.ballX, g.ballY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#8ee3fc'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0
      if (g.waveFlash > 0) {
        ctx.fillStyle = `rgba(9,18,28,${Math.min(.8, g.waveFlash * .6)})`
        ctx.fillRect(220, 172, 280, 76)
        ctx.font = 'bold 25px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e9d5aa'
        ctx.fillText(`ONDA ${g.wave}`, 360, 205)
        ctx.font = '12px sans-serif'; ctx.fillStyle = '#f0f7fa'
        ctx.fillText('Novos blocos chegando!', 360, 228)
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [onFinish, paused])
  const pointerControl = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (paused) return
    controls.current.target = canvasPointer(e).x
    controls.current.left = false; controls.current.right = false
  }
  return <div className="hb-mini-inner hb-breakout-v191">
    <div className="hb-mini-hud"><strong>🧱 {score} pontos</strong><span>Onda {wave} · {bricksLeft} blocos · {'♥'.repeat(lives)}{'♡'.repeat(3 - lives)}</span></div>
    <div className="hb-breakout-tip">♾️ Modo infinito: limpe todos os blocos para iniciar outra onda. Os pontos acumulam até você perder as três vidas.</div>
    <canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} onPointerMove={pointerControl} onPointerDown={e => {pointerControl(e);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e => {if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={() => {controls.current.target = null}} aria-label="Breakout infinito: mova a raquete com o mouse, toque ou setas. Novos blocos surgem quando acaba a onda." />
    <div className="hb-mini-pad"><button type="button" disabled={paused} onPointerDown={e => {e.currentTarget.setPointerCapture(e.pointerId);controls.current.target = null;controls.current.left = true}} onPointerUp={() => {controls.current.left = false}} onPointerCancel={() => {controls.current.left = false}} onPointerLeave={() => {controls.current.left = false}}>←</button><button type="button" disabled={paused} onPointerDown={e => {e.currentTarget.setPointerCapture(e.pointerId);controls.current.target = null;controls.current.right = true}} onPointerUp={() => {controls.current.right = false}} onPointerCancel={() => {controls.current.right = false}} onPointerLeave={() => {controls.current.right = false}}>→</button></div>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={() => { if (game.current.ended) return; game.current.ended = true; onFinish(game.current.score) }}>✓ Encerrar e registrar {score} pontos</button>
  </div>
}

// Asteroids V204 — arcade clássico, sem XP ou cartas de melhoria.
// Fragmentação, controles precisos e dificuldade por setores sem encerrar a partida.
type Rock = {
  x: number; y: number; vx: number; vy: number; radius: number
  tier: 1 | 2 | 3; rotation: number; spin: number; edges: number[]
  splitFlash: number; collisionGrace: number
}
type Shot = { x: number; y: number; vx: number; vy: number; life: number }
type ArcadeSpark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }
const ASTEROID_STARS = Array.from({ length: 96 }, (_, i) => ({
  x: (i * 149 + 21) % BASE_W,
  y: (i * 83 + 47) % BASE_H,
  radius: i % 9 === 0 ? 1.7 : i % 3 === 0 ? 1.15 : .65,
  layer: 1 + (i % 3),
}))
const wrapCoord = (value: number, limit: number) => ((value % limit) + limit) % limit
const wrapDelta = (a: number, b: number, limit: number) => {
  const d = Math.abs(a - b)
  return Math.min(d, limit - d)
}
const wrapDistanceSq = (x1: number, y1: number, x2: number, y2: number) =>
  wrapDelta(x1, x2, BASE_W) ** 2 + wrapDelta(y1, y2, BASE_H) ** 2
function createAsteroid(x: number, y: number, tier: 1 | 2 | 3, vx: number, vy: number): Rock {
  return {
    x: wrapCoord(x, BASE_W), y: wrapCoord(y, BASE_H), vx, vy,
    tier, radius: tier === 3 ? 35 : tier === 2 ? 23 : 13,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - .5) * (tier === 3 ? 1 : 1.8),
    splitFlash: 0, collisionGrace: 0,
    edges: Array.from({ length: tier === 3 ? 11 : tier === 2 ? 9 : 8 }, () => .73 + Math.random() * .34),
  }
}
function asteroidBurst(g: { sparks: ArcadeSpark[] }, x: number, y: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 38 + Math.random() * 130
    const life = .22 + Math.random() * .36
    g.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color })
  }
  if (g.sparks.length > 150) g.sparks.splice(0, g.sparks.length - 150)
}
export function AsteroidsGame({ onFinish, paused = false }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const game = useRef({
    x: 360, y: 210, angle: -Math.PI / 2, vx: 0, vy: 0,
    score: 0, lives: 3, sector: 1, elapsed: 0, shake: 0,
    cooldown: 0, invulnerable: 1.6, spawn: .35, ended: false,
    rocks: [] as Rock[], shots: [] as Shot[], sparks: [] as ArcadeSpark[], splits: 0,
  })
  const [splitCount, setSplitCount] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [sector, setSector] = useState(1)
  useArcadeKeyboard(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '], (key, down) => {
    if (paused) return
    if (down) keys.current.add(key)
    else keys.current.delete(key)
  })
  useEffect(() => { if (paused) keys.current.clear() }, [paused])
  useEffect(() => {
    const clear = () => keys.current.clear()
    window.addEventListener('blur', clear)
    return () => window.removeEventListener('blur', clear)
  }, [])
  useEffect(() => {
    const element = canvas.current
    if (!element || paused) return
    const ctx = prepareArcadeCanvas(element)
    if (!ctx) return
    let last = 0, id = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(.034, (now - last) / 1000) : .016
      last = now
      const g = game.current, k = keys.current
      if (g.ended) return
      g.elapsed += dt
      const newSector = 1 + Math.floor(g.elapsed / 42) + Math.floor(g.score / 700)
      if (newSector !== g.sector) { g.sector = newSector; setSector(newSector) }
      const turning = Number(k.has('arrowright') || k.has('d')) - Number(k.has('arrowleft') || k.has('a'))
      g.angle += turning * 3.8 * dt
      const thrusting = k.has('arrowup') || k.has('w')
      const braking = k.has('arrowdown') || k.has('s')
      if (thrusting) { g.vx += Math.cos(g.angle) * 235 * dt; g.vy += Math.sin(g.angle) * 235 * dt }
      const drag = Math.exp(-(braking ? 2.8 : .18) * dt)
      g.vx *= drag; g.vy *= drag
      const speed = Math.hypot(g.vx, g.vy)
      if (speed > 350) { g.vx *= 350 / speed; g.vy *= 350 / speed }
      g.x = wrapCoord(g.x + g.vx * dt, BASE_W)
      g.y = wrapCoord(g.y + g.vy * dt, BASE_H)
      g.cooldown -= dt; g.invulnerable -= dt; g.spawn -= dt
      g.shake = Math.max(0, g.shake - dt * 16)
      if (g.spawn <= 0 && g.rocks.length < Math.min(46, 13 + g.sector * 2)) {
        // Rochas novas não aparecem coladas à nave, nem por trás da borda do mapa.
        let px = 0, py = 0
        for (let attempt = 0; attempt < 12; attempt++) {
          const side = rand(4)
          px = side < 2 ? rand(BASE_W) : side === 2 ? 0 : BASE_W - 1
          py = side >= 2 ? rand(BASE_H) : side === 0 ? 0 : BASE_H - 1
          if (wrapDistanceSq(g.x, g.y, px, py) > 175 * 175) break
        }
        const aim = Math.atan2(BASE_H / 2 - py, BASE_W / 2 - px) + (Math.random() - .5) * 1.7
        const drift = 27 + Math.min(78, g.sector * 5) + Math.random() * 30
        g.rocks.push(createAsteroid(px, py, Math.random() < .72 ? 3 : 2, Math.cos(aim) * drift, Math.sin(aim) * drift))
        g.spawn = Math.max(.59, 2.1 - g.sector * .11)
      }
      if (k.has(' ') && g.cooldown <= 0 && g.shots.length < 45) {
        const ux = Math.cos(g.angle), uy = Math.sin(g.angle)
        g.shots.push({ x: wrapCoord(g.x + ux * 20, BASE_W), y: wrapCoord(g.y + uy * 20, BASE_H),
          vx: g.vx + ux * 505, vy: g.vy + uy * 505, life: 1.12 })
        g.cooldown = .17
        asteroidBurst(g, g.x + ux * 17, g.y + uy * 17, 2, '#ffddb0')
      }
      g.shots = g.shots.filter(shot => {
        shot.x = wrapCoord(shot.x + shot.vx * dt, BASE_W)
        shot.y = wrapCoord(shot.y + shot.vy * dt, BASE_H)
        shot.life -= dt
        return shot.life > 0
      })
      for (const rock of g.rocks) {
        rock.x = wrapCoord(rock.x + rock.vx * dt, BASE_W)
        rock.y = wrapCoord(rock.y + rock.vy * dt, BASE_H)
        rock.rotation += rock.spin * dt
        rock.splitFlash = Math.max(0, rock.splitFlash - dt)
        rock.collisionGrace = Math.max(0, rock.collisionGrace - dt)
      }
      for (let i = g.rocks.length - 1; i >= 0; i--) {
        const rock = g.rocks[i]
        if (!rock) continue
        const hit = g.shots.findIndex(s => shotHitsAsteroid(s, rock, dt, BASE_W, BASE_H))
        if (hit >= 0) {
          g.shots.splice(hit, 1)
          g.rocks.splice(i, 1)
          g.score += 20; setScore(g.score)
          asteroidBurst(g, rock.x, rock.y, rock.tier === 3 ? 14 : 9, '#f0c894')
          g.shake = Math.min(6, g.shake + (rock.tier === 3 ? 2.8 : 1.6))
          const fragments = breakAsteroid(rock)
          if (fragments.length) {
            // Fragmentos nascem separados e com impulso oposto; a diferença
            // entre os tamanhos fica imediatamente visível.
            for (const piece of fragments) {
              const child = createAsteroid(piece.x, piece.y, piece.tier, piece.vx, piece.vy)
              child.splitFlash = 0.55
              child.collisionGrace = 0.45
              g.rocks.push(child)
              asteroidBurst(g, child.x, child.y, 5, '#ffc67c')
            }
            g.splits += 1
            setSplitCount(g.splits)
          }
          continue
        }
        if (g.invulnerable <= 0 && rock.collisionGrace <= 0 && wrapDistanceSq(g.x, g.y, rock.x, rock.y) < (rock.radius + 11) ** 2) {
          g.lives--; setLives(g.lives)
          g.invulnerable = 2.35; g.shake = 8
          asteroidBurst(g, g.x, g.y, 22, '#8de4ff')
          g.x = BASE_W / 2; g.y = BASE_H / 2; g.vx = 0; g.vy = 0
          if (g.lives <= 0) { g.ended = true; onFinish(g.score); return }
        }
      }
      g.sparks = g.sparks.filter(s => {
        s.x = wrapCoord(s.x + s.vx * dt, BASE_W)
        s.y = wrapCoord(s.y + s.vy * dt, BASE_H)
        s.vx *= Math.exp(-1.7 * dt); s.vy *= Math.exp(-1.7 * dt)
        s.life -= dt
        return s.life > 0
      })
      ctx.save()
      if (g.shake > 0) ctx.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake)
      frame(ctx)
      ctx.fillStyle = '#08101b98'; ctx.fillRect(0, 0, BASE_W, BASE_H)
      for (const star of ASTEROID_STARS) {
        const y = wrapCoord(star.y + g.elapsed * star.layer * 1.7, BASE_H)
        ctx.fillStyle = star.layer === 3 ? '#bceeffa4' : star.layer === 2 ? '#9bb0e47a' : '#dfe9f756'
        ctx.beginPath(); ctx.arc(star.x, y, star.radius, 0, Math.PI * 2); ctx.fill()
      }
      for (const rock of g.rocks) {
        ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.rotation)
        ctx.beginPath()
        rock.edges.forEach((edge, j) => {
          const angle = j / rock.edges.length * Math.PI * 2
          const x = Math.cos(angle) * rock.radius * edge, y = Math.sin(angle) * rock.radius * edge
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = rock.tier === 3 ? '#314254' : rock.tier === 2 ? '#3e4b59' : '#4b5260'
        ctx.fill()
        const splitGlow = rock.splitFlash > 0 ? rock.splitFlash / .55 : 0
        ctx.strokeStyle = splitGlow > 0 ? '#ffd8a4' : '#c1d5e8'
        ctx.lineWidth = 1.8 + splitGlow * 2.4
        if (splitGlow > 0) { ctx.shadowColor = '#ffc075'; ctx.shadowBlur = 14 * splitGlow }
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = '#0d1b29a0'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(-rock.radius * .35, -rock.radius * .16); ctx.lineTo(rock.radius * .2, rock.radius * .11)
        ctx.lineTo(rock.radius * .09, rock.radius * .38); ctx.stroke()
        ctx.restore()
      }
      for (const shot of g.shots) {
        ctx.strokeStyle = '#ffd8a7'; ctx.lineWidth = 3; ctx.lineCap = 'round'
        const angle = Math.atan2(shot.vy, shot.vx)
        ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - Math.cos(angle) * 9, shot.y - Math.sin(angle) * 9); ctx.stroke()
      }
      for (const spark of g.sparks) {
        ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife)
        ctx.fillStyle = spark.color; ctx.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3)
      }
      ctx.globalAlpha = 1
      if (g.invulnerable <= 0 || Math.floor(g.invulnerable * 8) % 2 === 0) {
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle + Math.PI / 2)
        if (thrusting) {
          ctx.fillStyle = '#ffb867'; ctx.beginPath(); ctx.moveTo(-7, 11); ctx.lineTo(0, 21 + Math.random() * 13)
          ctx.lineTo(7, 11); ctx.fill()
          ctx.fillStyle = '#a1edff'; ctx.beginPath(); ctx.moveTo(-3, 11); ctx.lineTo(0, 21 + Math.random() * 5); ctx.lineTo(3, 11); ctx.fill()
        }
        ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(13, 13); ctx.lineTo(0, 8); ctx.lineTo(-13, 13); ctx.closePath()
        ctx.fillStyle = '#132b3f'; ctx.fill(); ctx.strokeStyle = '#93e8ff'; ctx.lineWidth = 2.7; ctx.stroke()
        ctx.strokeStyle = '#ffffffa0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 3); ctx.stroke()
        ctx.restore()
      }
      ctx.fillStyle = '#d2e0ebad'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(`SETOR ${g.sector}`, 18, 26)
      ctx.restore()
      id = requestAnimationFrame(tick)
    }
    const resize = () => { prepareArcadeCanvas(element) }
    window.addEventListener('resize', resize)
    document.addEventListener('fullscreenchange', resize)
    id = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', resize)
      document.removeEventListener('fullscreenchange', resize)
    }
  }, [onFinish, paused])
  const control = (key: string, down: boolean) => {
    if (paused) return
    if (down) keys.current.add(key); else keys.current.delete(key)
  }
  const finish = () => {
    if (game.current.ended || paused) return
    game.current.ended = true; onFinish(game.current.score)
  }
  return <div className="hb-mini-inner hb-asteroids-v204">
    <div className="hb-mini-hud"><strong>🚀 {score} pontos</strong><span>Setor {sector} · {'♥'.repeat(lives)}{'♡'.repeat(Math.max(0, 3 - lives))} · Sobreviva e destrua os asteroides</span></div>
    <canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} aria-label="Asteroids infinito: gire com A e D, acelere com W, freie com S, atire com Espaço" />
    <div className="hb-mini-game-info"><span>✦ Grandes → 2 médios → 4 pequenos. Acerte-os com os disparos.</span><span>↗ {splitCount} fragmentações nesta partida · Novos asteroides aparecem continuamente.</span></div>
    <div className="hb-mini-pad hb-asteroids-pad" aria-label="Controles de Asteroids">{[
      ['↶', 'arrowleft', 'Girar à esquerda'], ['↑', 'arrowup', 'Acelerar'],
      ['↷', 'arrowright', 'Girar à direita'], ['◈', ' ', 'Atirar'], ['▣', 'arrowdown', 'Frear'],
    ].map(([label, key, title]) => <button key={key} type="button" title={title} aria-label={title} disabled={paused}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); control(key, true) }}
      onPointerUp={() => control(key, false)} onPointerCancel={() => control(key, false)}
      onLostPointerCapture={() => control(key, false)}>{label}</button>)}</div>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={finish}>✓ Encerrar e registrar {score} pontos</button>
  </div>
}

// Voo Infinito V204 — voo fluido, obstáculos variados e fundo com profundidade.
// Cada obstáculo continua valendo exatamente 5 pontos (desafios e ranking existentes).
type Pipe = { x: number; gap: number; halfGap: number; width: number; passed: boolean; theme: number }
type Feather = { x: number; y: number; vx: number; vy: number; life: number }
export function FlappyGame({ onFinish, paused = false }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const flap = useRef(false)
  const heldFlapKeys = useRef(new Set<string>())
  const game = useRef({
    y: 210, vy: 0, pipes: [] as Pipe[], feathers: [] as Feather[],
    spawn: 1.5, score: 0, passed: 0, distance: 0, elapsed: 0,
    lastGap: 205, flash: 0, ended: false, first: true,
  })
  const [score, setScore] = useState(0)
  const [distance, setDistance] = useState(0)
  const [passed, setPassed] = useState(0)
  useArcadeKeyboard([' ', 'arrowup', 'w'], (key, down) => {
    if (paused) return
    if (down) {
      if (!heldFlapKeys.current.has(key)) flap.current = true
      heldFlapKeys.current.add(key)
    } else heldFlapKeys.current.delete(key)
  })
  useEffect(() => { if (paused) { flap.current = false; heldFlapKeys.current.clear() } }, [paused])
  useEffect(() => {
    const clear = () => { heldFlapKeys.current.clear() }
    window.addEventListener('blur', clear)
    return () => window.removeEventListener('blur', clear)
  }, [])
  useEffect(() => {
    const element = canvas.current
    if (!element || paused) return
    const ctx = prepareArcadeCanvas(element)
    if (!ctx) return
    let id = 0, last = 0, hudTimer = 0
    const draw = (now: number) => {
      const dt = last ? Math.min(.033, (now - last) / 1000) : .016
      last = now
      const g = game.current
      if (g.ended) return
      if (g.first) {
        if (flap.current) { g.first = false; g.vy = -255; flap.current = false }
        else g.y = 210 + Math.sin(now / 360) * 5
      } else {
        g.elapsed += dt
        const speed = Math.min(305, 179 + g.passed * 2.3 + g.elapsed * .28)
        g.distance += speed * dt
        hudTimer += dt
        if (hudTimer >= .33) { setDistance(Math.floor(g.distance / 10)); hudTimer = 0 }
        if (flap.current) {
          g.vy = -255; flap.current = false
          for (let i = 0; i < 5; i++) g.feathers.push({ x: 166, y: g.y + 4, vx: -55 - Math.random() * 70,
            vy: (Math.random() - .5) * 80, life: .45 })
        }
        g.vy = Math.min(395, g.vy + 675 * dt)
        g.y += g.vy * dt
        g.spawn -= dt
        if (g.spawn <= 0) {
          const halfGap = Math.max(69, 89 - Math.floor(g.passed / 5) * 2)
          const nextGap = clamp(g.lastGap + (Math.random() - .5) * 138, 111, 286)
          g.lastGap = nextGap
          g.pipes.push({ x: BASE_W + 24, gap: nextGap, halfGap, width: 68 + rand(3) * 5,
            passed: false, theme: rand(3) })
          g.spawn = Math.max(1.23, 1.82 - g.passed * .009)
        }
        for (const pipe of g.pipes) {
          pipe.x -= speed * dt
          if (!pipe.passed && pipe.x + pipe.width < 175 - 12) {
            pipe.passed = true; g.score += 5; g.passed++; g.flash = .8
            setScore(g.score); setPassed(g.passed)
          }
        }
        g.pipes = g.pipes.filter(pipe => pipe.x + pipe.width > -20)
        g.feathers = g.feathers.filter(p => {
          p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt
          return p.life > 0
        })
        g.flash = Math.max(0, g.flash - dt)
        // Círculo contra retângulo: evita mortes quando apenas a caixa invisível da asa encosta.
        const hitsRect = (x: number, y: number, w: number, h: number) => {
          const cx = clamp(175, x, x + w), cy = clamp(g.y, y, y + h)
          return (cx - 175) ** 2 + (cy - g.y) ** 2 < 11 ** 2
        }
        const hit = g.y < 14 || g.y > BASE_H - 35 || g.pipes.some(pipe =>
          hitsRect(pipe.x, 0, pipe.width, pipe.gap - pipe.halfGap) ||
          hitsRect(pipe.x, pipe.gap + pipe.halfGap, pipe.width, BASE_H - pipe.gap - pipe.halfGap))
        if (hit) { g.ended = true; onFinish(g.score); return }
      }
      // Céu e parallax — decorativo; a física continua sempre em 720×420.
      const sky = ctx.createLinearGradient(0, 0, 0, BASE_H)
      sky.addColorStop(0, '#11243d'); sky.addColorStop(.63, '#254660'); sky.addColorStop(1, '#3f5c67')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, BASE_W, BASE_H)
      const travel = g.distance
      for (let i = 0; i < 19; i++) {
        const x = wrapCoord(i * 131 + 35 - travel * .05, BASE_W + 80) - 40
        const y = 35 + (i * 67) % 190
        ctx.fillStyle = i % 5 === 0 ? '#cdeeff9c' : '#d5ecff59'
        ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 1.7 : .95, 0, Math.PI * 2); ctx.fill()
      }
      for (let i = 0; i < 8; i++) {
        const x = wrapCoord(i * 139 + 40 - travel * .14, BASE_W + 170) - 100
        const y = 67 + (i * 59) % 120
        ctx.fillStyle = '#a6c6d028'
        ctx.beginPath(); ctx.ellipse(x, y, 52, 13, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(x + 20, y - 8, 30, 11, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#1e3c4c'
      for (let i = -1; i < 9; i++) {
        const x = i * 113 - (travel * .26 % 113)
        ctx.beginPath(); ctx.moveTo(x, BASE_H - 28); ctx.lineTo(x + 57, 246 + (i % 3) * 20)
        ctx.lineTo(x + 116, BASE_H - 28); ctx.fill()
      }
      ctx.fillStyle = '#193642'; ctx.fillRect(0, BASE_H - 27, BASE_W, 27)
      ctx.fillStyle = '#507b72'; ctx.fillRect(0, BASE_H - 27, BASE_W, 3)
      for (let i = 0; i < 18; i++) {
        const x = wrapCoord(i * 53 - travel * .65, BASE_W + 30) - 15
        ctx.fillStyle = i % 3 === 0 ? '#84ad88' : '#43695a'
        ctx.fillRect(x, BASE_H - 17 + i % 3 * 5, 16, 2)
      }
      for (const pipe of g.pipes) {
        const top = pipe.gap - pipe.halfGap, bottom = pipe.gap + pipe.halfGap
        ctx.fillStyle = pipe.theme === 0 ? '#3b937b' : pipe.theme === 1 ? '#457e95' : '#528d70'
        ctx.fillRect(pipe.x, 0, pipe.width, top)
        ctx.fillRect(pipe.x, bottom, pipe.width, BASE_H - bottom)
        ctx.fillStyle = '#ffffff18'
        ctx.fillRect(pipe.x + 8, 0, 6, top)
        ctx.fillRect(pipe.x + 8, bottom, 6, BASE_H - bottom)
        ctx.fillStyle = '#102f3d55'
        ctx.fillRect(pipe.x + pipe.width - 10, 0, 7, top)
        ctx.fillRect(pipe.x + pipe.width - 10, bottom, 7, BASE_H - bottom)
        ctx.fillStyle = '#84d5ad'; ctx.fillRect(pipe.x - 5, top - 14, pipe.width + 10, 14)
        ctx.fillRect(pipe.x - 5, bottom, pipe.width + 10, 14)
        ctx.strokeStyle = '#b1f6d266'; ctx.lineWidth = 1
        ctx.strokeRect(pipe.x - 5, top - 14, pipe.width + 10, 14)
        ctx.strokeRect(pipe.x - 5, bottom, pipe.width + 10, 14)
      }
      for (const particle of g.feathers) {
        ctx.globalAlpha = particle.life / .45; ctx.fillStyle = '#b7ebff'
        ctx.beginPath(); ctx.arc(particle.x, particle.y, 2.4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.save()
      ctx.translate(175, g.y)
      ctx.rotate(clamp(g.vy / 750, -.34, .6))
      ctx.fillStyle = '#efc686'; ctx.strokeStyle = '#fdf0c6'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#d59a64'
      ctx.beginPath(); ctx.ellipse(-6, 5 + Math.sin(now / 85) * 2.5, 8, 5, -.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffebac'
      ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(22, 2); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#11243d'; ctx.beginPath(); ctx.arc(5, -4, 2.3, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      if (g.flash > 0) {
        ctx.globalAlpha = Math.min(1, g.flash * 1.8)
        ctx.fillStyle = '#f7e2a8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('+5 · OBSTÁCULO SUPERADO', 350, 52)
        ctx.globalAlpha = 1
      }
      if (g.first) {
        ctx.fillStyle = '#081727bf'; ctx.fillRect(169, 92, 382, 72)
        ctx.fillStyle = '#e9f5fb'; ctx.font = 'bold 21px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('Pronto para voar?', 360, 119)
        ctx.font = '13px sans-serif'; ctx.fillText('Espaço, ↑ ou toque para começar', 360, 144)
      }
      id = requestAnimationFrame(draw)
    }
    const resize = () => { prepareArcadeCanvas(element) }
    window.addEventListener('resize', resize)
    document.addEventListener('fullscreenchange', resize)
    id = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', resize)
      document.removeEventListener('fullscreenchange', resize)
    }
  }, [onFinish, paused])
  const requestFlap = () => { if (!paused && !game.current.ended) flap.current = true }
  const finish = () => {
    if (game.current.ended || paused) return
    game.current.ended = true; onFinish(game.current.score)
  }
  return <div className="hb-mini-inner hb-flappy-v204">
    <div className="hb-mini-hud"><strong>🪽 {score} pontos</strong><span>{passed} obstáculos · {distance} m percorridos · Espaço / ↑ / toque para voar</span></div>
    <canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H}
      onPointerDown={e => { e.preventDefault(); requestFlap() }} aria-label="Voo Infinito: toque ou pressione Espaço para voar" />
    <div className="hb-mini-game-info"><span>✦ A abertura dos obstáculos muda progressivamente.</span><span>♾️ Cada obstáculo vale 5 pontos. Voe o máximo que conseguir!</span></div>
    <div className="hb-mini-pad"><button type="button" disabled={paused} onClick={requestFlap}>↑ Bater asas</button></div>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={finish}>✓ Encerrar e registrar {score} pontos</button>
  </div>
}

// Os tiros da Arena têm atributos próprios de combate; os do Asteroids continuam simples.
type ArenaShot = Shot & { damage: number; pierce: number; hitIds: number[]; critical: boolean }
type EnemyKind = 'runner' | 'stalker' | 'brute' | 'elite'
type Enemy = { id: number; x: number; y: number; speed: number; radius: number; hp: number; maxHp: number; kind: EnemyKind; flash?: number }
type ArenaDrop = { x: number; y: number; kind: 'xp' | 'heart'; value: number; age: number }
type ArenaSpark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }
type ArenaCamera = { x: number; y: number }

// O mapa existe em coordenadas do mundo, sem paredes. Apenas a janela de 720×420
// é desenhada. As células são determinísticas: voltar a uma região conserva o cenário.
const ARENA_TILE = 80
const arenaNoise = (x: number, y: number, seed = 0) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
const screenX = (x: number, camera: ArenaCamera) => x - camera.x + BASE_W / 2
const screenY = (y: number, camera: ArenaCamera) => y - camera.y + BASE_H / 2

// A Arena só redesenha terrenos novos. Os tiles já vistos são reutilizados em um
// LRU limitado (180 × 81² × 4 bytes ≈ 4,7 MB); a exploração continua ilimitada.
const ARENA_CACHE_LIMIT = 180
const arenaTileCache = new Map<string, HTMLCanvasElement>()
function arenaTile(col: number, row: number): HTMLCanvasElement {
  const key = `${col}:${row}`
  const cached = arenaTileCache.get(key)
  if (cached) {
    arenaTileCache.delete(key); arenaTileCache.set(key, cached)
    return cached
  }
  const canvas = document.createElement('canvas')
  canvas.width = ARENA_TILE + 1; canvas.height = ARENA_TILE + 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const nature = arenaNoise(col, row)
    const path = ((col % 16) + 16) % 16 === 0 || ((row % 15) + 15) % 15 === 0
    ctx.fillStyle = path ? '#28302d' : nature > .79 ? '#1b302b' : nature < .18 ? '#14252b' : '#172826'
    ctx.fillRect(0, 0, ARENA_TILE + 1, ARENA_TILE + 1)
    ctx.strokeStyle = '#d3ddcb07'; ctx.lineWidth = 1
    ctx.strokeRect(.5, .5, ARENA_TILE, ARENA_TILE)
    const detail = arenaNoise(col, row, 7)
    const dx = 13 + arenaNoise(col, row, 8) * 54
    const dy = 13 + arenaNoise(col, row, 9) * 54
    if (detail > .91) {
      ctx.fillStyle = '#44514d'
      ctx.beginPath(); ctx.ellipse(dx, dy, 11, 7, -.35, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#67766a'; ctx.beginPath(); ctx.arc(dx - 2, dy - 2, 3, 0, Math.PI * 2); ctx.fill()
    } else if (detail > .52) {
      ctx.strokeStyle = '#40674d'; ctx.lineWidth = 1.7
      ctx.beginPath(); ctx.moveTo(dx - 5, dy + 5); ctx.lineTo(dx - 2, dy - 4)
      ctx.moveTo(dx, dy + 5); ctx.lineTo(dx + 4, dy - 7)
      ctx.moveTo(dx + 4, dy + 5); ctx.lineTo(dx + 8, dy - 2); ctx.stroke()
    } else if (detail > .26) {
      ctx.fillStyle = '#47604e'; ctx.beginPath(); ctx.arc(dx, dy, 2.1, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#67775e'; ctx.fillRect(dx + 9, dy - 9, 2, 2)
    }
    if (((col % 11) + 11) % 11 === 4 && ((row % 9) + 9) % 9 === 3) {
      const cx = 40, cy = 40
      ctx.strokeStyle = '#acac8160'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cx, cy, 21, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx + 12, cy)
      ctx.lineTo(cx, cy + 15); ctx.lineTo(cx - 12, cy); ctx.closePath(); ctx.stroke()
      ctx.fillStyle = '#d2b87755'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
    }
  }
  arenaTileCache.set(key, canvas)
  if (arenaTileCache.size > ARENA_CACHE_LIMIT) {
    const oldest = arenaTileCache.keys().next().value
    if (oldest !== undefined) arenaTileCache.delete(oldest)
  }
  return canvas
}

function drawArenaWorld(ctx: CanvasRenderingContext2D, camera: ArenaCamera) {
  ctx.fillStyle = '#101c21'; ctx.fillRect(0, 0, BASE_W, BASE_H)
  const left = camera.x - BASE_W / 2, top = camera.y - BASE_H / 2
  const colStart = Math.floor(left / ARENA_TILE) - 1
  const colEnd = Math.ceil((left + BASE_W) / ARENA_TILE) + 1
  const rowStart = Math.floor(top / ARENA_TILE) - 1
  const rowEnd = Math.ceil((top + BASE_H) / ARENA_TILE) + 1
  for (let row = rowStart; row <= rowEnd; row++) for (let col = colStart; col <= colEnd; col++) {
    ctx.drawImage(arenaTile(col, row), Math.floor(col * ARENA_TILE - left), Math.floor(row * ARENA_TILE - top))
  }
}

function drawArenaRadar(ctx: CanvasRenderingContext2D, x: number, y: number, enemies: Enemy[]) {
  const rx = BASE_W - 118, ry = 12, size = 104
  ctx.fillStyle = '#081116d9'; ctx.fillRect(rx, ry, size, size)
  ctx.strokeStyle = '#9ab4a055'; ctx.lineWidth = 1; ctx.strokeRect(rx + .5, ry + .5, size - 1, size - 1)
  ctx.strokeStyle = '#ffffff1b'
  ctx.beginPath(); ctx.moveTo(rx + size / 2, ry + 9); ctx.lineTo(rx + size / 2, ry + size - 9)
  ctx.moveTo(rx + 9, ry + size / 2); ctx.lineTo(rx + size - 9, ry + size / 2); ctx.stroke()
  const radius = 800
  for (const enemy of enemies) {
    const dx = enemy.x - x, dy = enemy.y - y
    if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue
    ctx.fillStyle = enemy.kind === 'elite' ? '#f8cf74' : enemy.kind === 'brute' ? '#ce91d2' : '#e88d98'
    ctx.fillRect(rx + size / 2 + dx / radius * 45 - 1.5, ry + size / 2 + dy / radius * 45 - 1.5, 3, 3)
  }
  ctx.fillStyle = '#91e5fb'; ctx.beginPath(); ctx.arc(rx + size / 2, ry + size / 2, 3.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#c6d8ca'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('MAPA', rx + 7, ry + 12)
}

export function ArenaGame({ onFinish, paused = false }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const upgrading = useRef(false)
  const dashRequest = useRef(false)
  const levelsOwned = useRef<Partial<Record<SurvivorUpgradeId, number>>>({})
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const firing = useRef(false)
  const lastDirection = useRef({ x: 1, y: 0 })
  const camera = useRef<ArenaCamera>({ x: 0, y: 0 })
  const game = useRef({ x: 0, y: 0, health: 3, maxHealth: 3, score: 0, wave: 1, spawn: .7, shoot: 0, seconds: 0,
    invulnerable: 1.5, ended: false, enemies: [] as Enemy[], shots: [] as ArenaShot[], hitFlash: 0,
    distance: 0, hudTimer: 0, nextEnemyId: 1, kills: 0, eliteSpawnedWave: 0,
    drops: [] as ArenaDrop[], sparks: [] as ArenaSpark[],
    dashCooldown: 0, dashMaxCooldown: 5.5, dashFlash: 0, dashFromX: 0, dashFromY: 0,
    level: 1, xp: 0, shootDelay: .235, volley: 1, damage: 1, pierce: 0, moveSpeed: 198,
    bulletSpeed: 525, bulletLife: .95, regenInterval: Infinity, regenTimer: Infinity,
    pickupRadius: 25, criticalChance: 0 })
  const [score, setScore] = useState(0), [health, setHealth] = useState(3), [wave, setWave] = useState(1)
  const [shooting, setShooting] = useState(false)
  const [dashDisplay, setDashDisplay] = useState(0)
  const [defeated, setDefeated] = useState(0)
  const [maxHealth, setMaxHealth] = useState(3)
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [upgradeOffer, setUpgradeOffer] = useState<SurvivorUpgrade[] | null>(null)
  const [upgradeRanks, setUpgradeRanks] = useState<Partial<Record<SurvivorUpgradeId, number>>>({})
  const [position, setPosition] = useState({ x: 0, y: 0, distance: 0 })
  useArcadeKeyboard(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd', ' ', 'j', 'shift'], (key, down) => {
    if (paused || upgrading.current) return
    if (key === 'shift' && down && !keys.current.has('shift')) dashRequest.current = true
    if (down) keys.current.add(key); else keys.current.delete(key)
  })
  useEffect(() => { if (paused || upgradeOffer) { keys.current.clear(); firing.current = false; dashRequest.current = false; setShooting(false) } }, [paused, upgradeOffer])
  useEffect(() => {
    const clear = () => { keys.current.clear(); firing.current = false; dashRequest.current = false; setShooting(false) }
    window.addEventListener('blur', clear)
    return () => window.removeEventListener('blur', clear)
  }, [])
  const chooseUpgrade = (id: SurvivorUpgradeId) => {
    const g = game.current
    if (g.ended || !upgrading.current || !upgradeOffer?.some(item => item.id === id)) return
    const rank = (levelsOwned.current[id] || 0) + 1
    levelsOwned.current = { ...levelsOwned.current, [id]: rank }
    setUpgradeRanks(levelsOwned.current)
    switch (id) {
      case 'arena_cadence': g.shootDelay = Math.max(.07, g.shootDelay*.85); break
      case 'arena_volley': g.volley = Math.min(5, g.volley+1); break
      case 'arena_power': g.damage++; break
      case 'arena_piercing': g.pierce = Math.min(5, g.pierce+1); break
      case 'arena_sprint': g.moveSpeed *= 1.12; break
      case 'arena_vigor': g.maxHealth++; g.health = Math.min(g.maxHealth,g.health+1); setHealth(g.health); setMaxHealth(g.maxHealth); break
      case 'arena_range': g.bulletSpeed *= 1.1; g.bulletLife += .13; break
      case 'arena_recovery': g.regenInterval = Math.max(14,32-rank*4); g.regenTimer = g.regenInterval; break
      case 'arena_magnet': g.pickupRadius += 25; break
      case 'arena_dash': g.dashMaxCooldown = Math.max(1.8, g.dashMaxCooldown - .65); g.dashCooldown = Math.min(g.dashCooldown,g.dashMaxCooldown); break
      case 'arena_critical': g.criticalChance = Math.min(.5, g.criticalChance + .1); break
    }
    upgrading.current = false
    setUpgradeOffer(null)
  }
  useEffect(() => {
    const element = canvas.current
    if (!element || paused || upgradeOffer) return
    const ctx = prepareArcadeCanvas(element)
    if (!ctx) return
    let id = 0, last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(.035, (now - last) / 1000) : .016; last = now
      const g = game.current, k = keys.current, cam = camera.current
      if (g.ended || upgrading.current) return
      const dx = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'))
      const dy = Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'))
      const len = Math.hypot(dx, dy) || 1
      if (dx || dy) lastDirection.current = { x: dx / len, y: dy / len }
      const vxMove = dx / len * g.moveSpeed * dt, vyMove = dy / len * g.moveSpeed * dt
      g.x += vxMove; g.y += vyMove; g.distance += Math.hypot(vxMove, vyMove)
      g.dashCooldown = Math.max(0, g.dashCooldown - dt)
      g.dashFlash = Math.max(0, g.dashFlash - dt)
      if (dashRequest.current) {
        dashRequest.current = false
        if (g.dashCooldown <= 0) {
          const dashDirection = dx || dy ? { x: dx / len, y: dy / len } : lastDirection.current
          g.dashFromX = g.x; g.dashFromY = g.y
          g.x += dashDirection.x * 135; g.y += dashDirection.y * 135; g.distance += 135
          g.dashFlash = .34; g.dashCooldown = g.dashMaxCooldown
          g.invulnerable = Math.max(g.invulnerable, .36)
        }
      }
      // A câmera segue suavemente o personagem. Coordenadas do mundo não são limitadas.
      const follow = 1 - Math.exp(-10 * dt)
      cam.x += (g.x - cam.x) * follow; cam.y += (g.y - cam.y) * follow
      g.hudTimer -= dt
      if (g.hudTimer <= 0) {
        setPosition({ x: Math.round(g.x / 10), y: Math.round(g.y / 10), distance: Math.floor(g.distance / 10) })
        setDashDisplay(Math.ceil(g.dashCooldown * 10) / 10)
        g.hudTimer = .2
      }
      g.seconds += dt
      const nextWave = 1 + Math.floor(g.seconds / 13)
      if (nextWave !== g.wave) {
        g.wave = nextWave; setWave(nextWave)
        // Um inimigo de elite aparece a cada cinco ondas, fora da câmera.
        if (nextWave % 5 === 0 && g.eliteSpawnedWave !== nextWave && g.enemies.length < 130) {
          g.eliteSpawnedWave = nextWave
          const angle = Math.random() * Math.PI * 2
          const eliteHp = 6 + Math.ceil(nextWave * 1.15)
          g.enemies.push({ id:g.nextEnemyId++, x:g.x + Math.cos(angle)*520, y:g.y + Math.sin(angle)*520,
            speed:Math.min(165,48+nextWave*3),radius:30,hp:eliteHp,maxHp:eliteHp,kind:'elite' })
        }
      }
      g.spawn -= dt; g.shoot -= dt; g.invulnerable -= dt; g.hitFlash -= dt
      if (Number.isFinite(g.regenInterval)) {
        g.regenTimer -= dt
        if (g.regenTimer <= 0) {
          if (g.health < g.maxHealth) { g.health++; setHealth(g.health) }
          g.regenTimer = g.regenInterval
        }
      }
      if (g.spawn <= 0 && g.enemies.length < 130) {
        const amount = g.wave >= 7 ? 3 : g.wave >= 4 ? 2 : 1
        for (let n = 0; n < amount; n++) {
          const angle = Math.random() * Math.PI * 2
          const radius = 470 + rand(210)
          const kind: EnemyKind = (g.wave >= 3 && rand(6) === 0) ? 'brute' : rand(4) === 0 ? 'runner' : 'stalker'
          const enemyRadius = kind === 'brute' ? 20 : kind === 'runner' ? 10 : 13
          g.enemies.push({ id: g.nextEnemyId++, x: g.x + Math.cos(angle) * radius, y: g.y + Math.sin(angle) * radius,
            speed: Math.min(255,(kind === 'runner' ? 106 : kind === 'brute' ? 45 : 69) + g.wave * (kind === 'brute' ? 5 : 11)),
            radius: enemyRadius, hp: kind === 'brute' ? 3 : 1, maxHp: kind === 'brute' ? 3 : 1, kind })
        }
        g.spawn = Math.max(.24, .92 - g.wave * .085)
      }
      const aim = pointer.current
      let nearest: Enemy | null = null
      if (!aim) {
        let bestDistanceSq = Infinity
        for (const enemy of g.enemies) {
          const vx = enemy.x - g.x, vy = enemy.y - g.y, distanceSq = vx * vx + vy * vy
          if (distanceSq < bestDistanceSq) { bestDistanceSq = distanceSq; nearest = enemy }
        }
      }
      // O mouse mira na janela da câmera; o alvo é convertido para coordenadas do mundo.
      const targetX = aim ? aim.x - BASE_W / 2 + cam.x - g.x : nearest ? nearest.x - g.x : lastDirection.current.x
      const targetY = aim ? aim.y - BASE_H / 2 + cam.y - g.y : nearest ? nearest.y - g.y : lastDirection.current.y
      const aimLen = Math.hypot(targetX, targetY) || 1
      const aimX = targetX / aimLen, aimY = targetY / aimLen
      // Mantém disparos totalmente manuais: clique, Espaço, J ou botão ATIRAR.
      // Mesmo com multitiro e upgrades, os disparos dependem do comando do jogador.
      if ((firing.current || k.has(' ') || k.has('j')) && g.shoot <= 0) {
        const angle = Math.atan2(aimY, aimX)
        for (let i = 0; i < g.volley; i++) {
          const direction = angle + (i-(g.volley-1)/2)*.15
          const vx = Math.cos(direction), vy = Math.sin(direction)
          const critical = Math.random() < g.criticalChance
          g.shots.push({ x:g.x+vx*18,y:g.y+vy*18,vx:vx*g.bulletSpeed,vy:vy*g.bulletSpeed,
            life:g.bulletLife,damage:g.damage*(critical?2:1),pierce:g.pierce,hitIds:[],critical })
        }
        g.shoot = g.shootDelay
      }
      for (const enemy of g.enemies) {
        const ox = g.x - enemy.x, oy = g.y - enemy.y, length = Math.hypot(ox, oy) || 1
        enemy.x += ox / length * enemy.speed * dt; enemy.y += oy / length * enemy.speed * dt
        enemy.flash = Math.max(0,(enemy.flash || 0)-dt)
      }
      // Apenas inimigos absurdamente distantes são descartados (quando se foge de uma horda).
      g.enemies = g.enemies.filter(e => { const dx = e.x - g.x, dy = e.y - g.y; return dx * dx + dy * dy < 1250 * 1250 })
      g.shots = g.shots.filter(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; return s.life > 0 })
      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const enemy = g.enemies[i]; if (!enemy) continue
        const hit = g.shots.findIndex(s => {
          if (s.hitIds.includes(enemy.id)) return false
          const dx = s.x-enemy.x, dy = s.y-enemy.y, radius = enemy.radius+5
          return dx*dx+dy*dy < radius*radius
        })
        if (hit >= 0) {
          const shot = g.shots[hit]
          shot.hitIds.push(enemy.id)
          if (shot.pierce > 0) shot.pierce -= 1
          else g.shots.splice(hit,1)
          enemy.hp -= shot.damage
          enemy.flash = .13
          if (enemy.hp <= 0) {
            g.enemies.splice(i,1)
            g.score += enemy.kind === 'elite' ? 60 : enemy.kind === 'brute' ? 30 : enemy.kind === 'runner' ? 15 : 10
            g.kills++
            setScore(g.score)
            setDefeated(g.kills)
            const xpValue = arenaExperienceDrop(enemy.kind)
            g.drops.push({ x:enemy.x,y:enemy.y,kind:'xp',value:xpValue,age:0 })
            if (enemy.kind === 'elite' || Math.random() < .025) {
              g.drops.push({ x:enemy.x + 11,y:enemy.y - 8,kind:'heart',value:1,age:0 })
            }
            if (g.drops.length > 220) g.drops.splice(0,g.drops.length - 220)
            const color = enemy.kind === 'elite' ? '#f8d27a' : '#f0a5bb'
            const sparks = enemy.kind === 'elite' ? 16 : 7
            for (let s=0;s<sparks;s++) {
              const a=Math.random()*Math.PI*2, v=45+Math.random()*120
              g.sparks.push({x:enemy.x,y:enemy.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.45+Math.random()*.3,maxLife:.8,color})
            }
            if (g.sparks.length > 110) g.sparks.splice(0,g.sparks.length-110)
            continue
          }
        }
        if (g.invulnerable <= 0 && (g.x-enemy.x)**2+(g.y-enemy.y)**2 < (enemy.radius+12)**2) {
          g.health--; setHealth(g.health); g.invulnerable=1.05; g.enemies.splice(i,1); g.hitFlash=.28
        }
      }
      // Cristais ficam no chão até o jogador recolher, como em um survivor.
      // O upgrade Ímã de essência aumenta a distância de atração.
      let collectedXp = 0
      for (let i=g.drops.length-1;i>=0;i--) {
        const drop=g.drops[i]
        drop.age += dt
        let offsetX=g.x-drop.x, offsetY=g.y-drop.y
        const distance=Math.hypot(offsetX,offsetY)
        if (drop.age > 80 || distance > 1500) { g.drops.splice(i,1); continue }
        if (distance > 0 && distance < g.pickupRadius*3) {
          const speed = (145 + g.pickupRadius*2) * dt
          const ratio = Math.min(1,speed/distance)
          drop.x += offsetX*ratio; drop.y += offsetY*ratio
          offsetX=g.x-drop.x; offsetY=g.y-drop.y
        }
        if (offsetX*offsetX + offsetY*offsetY < g.pickupRadius*g.pickupRadius) {
          if (drop.kind === 'xp') collectedXp += drop.value
          else if (g.health < g.maxHealth) { g.health++; setHealth(g.health) }
          g.drops.splice(i,1)
        }
      }
      if (collectedXp) { g.xp += collectedXp; setXp(g.xp) }
      const needed = experienceForNextLevel(g.level)
      if (g.xp >= needed && g.health > 0 && !upgrading.current) {
        const choices=drawSurvivorUpgrades('arena',levelsOwned.current)
        if (choices.length) {
          g.xp -= needed; g.level++
          setXp(g.xp); setLevel(g.level); upgrading.current=true; setUpgradeOffer(choices)
        }
      }
      g.sparks = g.sparks.filter(s => { s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;return s.life>0 })
      drawArenaWorld(ctx, cam)
      ctx.save()
      // Objetos do jogo são desenhados depois do chão usando a projeção mundo → tela.
      for (const enemy of g.enemies) {
        const x = screenX(enemy.x, cam), y = screenY(enemy.y, cam)
        if (x < -32 || y < -32 || x > BASE_W + 32 || y > BASE_H + 32) continue
        ctx.fillStyle = '#00000036'; ctx.beginPath(); ctx.ellipse(x, y + enemy.radius * .6, enemy.radius * .85, enemy.radius * .4, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x, y, enemy.radius, 0, Math.PI * 2)
        ctx.fillStyle = enemy.flash && enemy.flash>0 ? '#fff6db' : enemy.kind === 'elite' ? '#a87c43' : enemy.kind === 'brute' ? '#986491' : enemy.kind === 'runner' ? '#f1ac7b' : '#cf829b'; ctx.fill()
        ctx.strokeStyle = enemy.kind === 'elite' ? '#ffe39d' : enemy.kind === 'brute' ? '#e7c4ec' : '#fae5e8'; ctx.lineWidth = enemy.kind === 'elite' ? 3 : 1.5; ctx.stroke()
        if (enemy.kind === 'elite') {
          ctx.strokeStyle='#f8d58999';ctx.lineWidth=1.5
          ctx.beginPath();ctx.arc(x,y,enemy.radius+7+Math.sin(g.seconds*4)*3,0,Math.PI*2);ctx.stroke()
        }
        if (enemy.kind === 'brute' || enemy.kind === 'elite') {
          const width=enemy.kind === 'elite'?56:24
          ctx.fillStyle = '#1a1d27'; ctx.fillRect(x-width/2, y-enemy.radius-11, width, 4)
          ctx.fillStyle = enemy.kind === 'elite'?'#eec677':'#e9d2ee'
          ctx.fillRect(x-width/2, y-enemy.radius-11, width * (enemy.hp / enemy.maxHp), 4)
        }
      }
      for (const drop of g.drops) {
        const x=screenX(drop.x,cam),y=screenY(drop.y,cam)
        if (x<-16 || x>BASE_W+16 || y<-16 || y>BASE_H+16) continue
        const pulsate=1+Math.sin(g.seconds*6+drop.x)*.13
        ctx.save();ctx.translate(x,y);ctx.scale(pulsate,pulsate)
        ctx.shadowColor=drop.kind==='xp'?'#72dcba':'#f28a91';ctx.shadowBlur=10
        ctx.fillStyle=drop.kind==='xp'?'#83f0c1':'#f99c9f'
        if (drop.kind==='xp') { ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(5,0);ctx.lineTo(0,6);ctx.lineTo(-5,0);ctx.closePath();ctx.fill() }
        else {ctx.font='15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♥',0,0)}
        ctx.restore()
      }
      for (const spark of g.sparks) {
        const x=screenX(spark.x,cam),y=screenY(spark.y,cam)
        if (x<-10||y<-10||x>BASE_W+10||y>BASE_H+10) continue
        ctx.globalAlpha=Math.min(1,spark.life/spark.maxLife)
        ctx.fillStyle=spark.color;ctx.fillRect(x-2,y-2,4,4)
      }
      ctx.globalAlpha=1
      for (const shot of g.shots) {
        const x = screenX(shot.x, cam), y = screenY(shot.y, cam)
        if (x < -10 || y < -10 || x > BASE_W + 10 || y > BASE_H + 10) continue
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = shot.critical?'#a1faff':'#f5d78d'; ctx.shadowColor = shot.critical?'#5fd9ff':'#e9bf65'; ctx.shadowBlur = shot.critical?15:9; ctx.fill()
      }
      ctx.shadowBlur = 0
      const px = screenX(g.x, cam), py = screenY(g.y, cam)
      if (g.dashFlash > 0) {
        ctx.save();ctx.globalAlpha=Math.min(.55,g.dashFlash*1.6)
        ctx.strokeStyle='#91efff';ctx.lineWidth=8;ctx.lineCap='round'
        ctx.beginPath();ctx.moveTo(screenX(g.dashFromX,cam),screenY(g.dashFromY,cam));ctx.lineTo(px,py);ctx.stroke()
        ctx.restore()
      }
      ctx.globalAlpha = .55
      ctx.beginPath(); ctx.moveTo(px + aimX * 16, py + aimY * 16); ctx.lineTo(px + aimX * 42, py + aimY * 42)
      ctx.strokeStyle = '#a3e7ff'; ctx.lineWidth = 2; ctx.stroke()
      ctx.globalAlpha = 1
      if (g.invulnerable <= 0 || Math.floor(g.invulnerable * 9) % 2 === 0) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(aimY, aimX))
        ctx.fillStyle = '#050c1390'; ctx.beginPath(); ctx.ellipse(0, 8, 14, 7, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fillStyle = '#8de4ff'; ctx.fill()
        ctx.strokeStyle = '#e7fbff'; ctx.lineWidth = 2; ctx.stroke()
        ctx.fillStyle = '#153d53'; ctx.fillRect(5, -4, 17, 8); ctx.restore()
      }
      if (pointer.current) {
        ctx.strokeStyle = '#f5d78d'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(pointer.current.x, pointer.current.y, 9, 0, Math.PI * 2)
        ctx.moveTo(pointer.current.x - 15, pointer.current.y); ctx.lineTo(pointer.current.x - 5, pointer.current.y)
        ctx.moveTo(pointer.current.x + 5, pointer.current.y); ctx.lineTo(pointer.current.x + 15, pointer.current.y); ctx.stroke()
      }
      if (g.hitFlash > 0) { ctx.fillStyle = `rgba(238,104,130,${Math.min(.15, g.hitFlash * .45)})`; ctx.fillRect(0, 0, BASE_W, BASE_H) }
      ctx.restore()
      drawArenaRadar(ctx, g.x, g.y, g.enemies)
      if (g.health <= 0) { if (!g.ended) { g.ended = true; onFinish(g.score) } return }
      if (!upgrading.current) id = requestAnimationFrame(tick)
    }
    const onResize = () => prepareArcadeCanvas(element)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onResize)
    id = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onResize) }
  }, [onFinish, paused, upgradeOffer])
  const control = (key: string, down: boolean) => { if (paused || upgrading.current) return; if (down) keys.current.add(key); else keys.current.delete(key) }
  const aimAt = (e: ReactPointerEvent<HTMLCanvasElement>) => { pointer.current = canvasPointer(e) }
  const setFire = (down: boolean) => { firing.current = down && !paused && !upgrading.current; setShooting(firing.current) }
  return <div className="hb-mini-inner hb-arena-v191 hb-arena-v193 hb-survivor-game">
    <div className="hb-mini-hud"><strong>⚔️ {score} pontos</strong><span>{'♥'.repeat(health)}{'♡'.repeat(Math.max(0,maxHealth-health))} · Onda {wave} · ☠ {defeated} derrotados</span></div>
    <SurvivorExperience level={level} xp={xp} next={experienceForNextLevel(level)} count={Object.values(upgradeRanks).reduce((sum,n)=>sum+(n||0),0)} />
    <div className="hb-arena-world-info"><span>♾️ <strong>Mundo sem bordas</strong></span><span>🧭 X {position.x} · Y {position.y}</span><span>👣 {position.distance} m percorridos</span></div>
    <div className="hb-arena-tip">💎 Recolha cristais verdes para ganhar XP. Cada novo nível exige mais experiência; elites rendem cristais melhores. Encontre corações para recuperar vida e enfrente elites a cada 5 ondas. Mova-se com WASD/setas, mire com o mouse, atire com clique/Espaço/J e use <strong>Shift para esquivar</strong>. No celular, use ATIRAR e ESQUIVA.</div>
    <canvas className="hb-mini-canvas hb-arena-canvas" ref={canvas} width={BASE_W} height={BASE_H}
      onPointerMove={e => { if (!paused && !upgrading.current) aimAt(e) }}
      onPointerDown={e => { if (paused || upgrading.current) return; aimAt(e); setFire(true); e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerUp={e => { setFire(false); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
      onPointerCancel={() => setFire(false)}
      onPointerLeave={e => { if (e.pointerType === 'mouse') { setFire(false); pointer.current = null } }}
      aria-label="Arena Infinita: mundo explorável sem limites, câmera seguindo o jogador. WASD/setas para mover, mouse para mirar e clique, Espaço ou J para atirar" />
    <div className="hb-mini-pad hb-mini-arena-pad">{[['←', 'arrowleft'], ['↑', 'arrowup'], ['↓', 'arrowdown'], ['→', 'arrowright']].map(([label, key]) => <button key={key} type="button" disabled={paused || !!upgradeOffer} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); control(key, true) }} onPointerUp={() => control(key, false)} onPointerCancel={() => control(key, false)} onPointerLeave={() => control(key, false)}>{label}</button>)}<button type="button" className={`hb-mini-fire ${shooting ? 'is-firing' : ''}`} disabled={paused || !!upgradeOffer} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setFire(true) }} onPointerUp={() => setFire(false)} onPointerCancel={() => setFire(false)} onPointerLeave={() => setFire(false)}>⌖ ATIRAR</button><button type="button" className="hb-mini-dash" disabled={paused || !!upgradeOffer || dashDisplay>0} onPointerDown={() => { if (!paused && !upgrading.current) dashRequest.current=true }}>➟ {dashDisplay>0?`ESQUIVA ${dashDisplay.toFixed(1)}s`:'ESQUIVA'}</button></div>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended || !!upgradeOffer} onClick={() => { if (game.current.ended) return; game.current.ended = true; onFinish(game.current.score) }}>✓ Encerrar e registrar {score} pontos</button>
    {upgradeOffer && <SurvivorUpgradeChoice game="arena" level={level} choices={upgradeOffer} ranks={upgradeRanks} onChoose={chooseUpgrade} />}
  </div>
}
