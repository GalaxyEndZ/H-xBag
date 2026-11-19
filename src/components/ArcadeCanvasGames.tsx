import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

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

function frame(ctx: CanvasRenderingContext2D, width = BASE_W, height = BASE_H) {
  ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#ffffff0e'; ctx.lineWidth = 1
  for (let x = 0; x <= width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = 0; y <= height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
}
function canvasPointer(e: ReactPointerEvent<HTMLCanvasElement>, w = BASE_W, h = BASE_H) {
  const rect = e.currentTarget.getBoundingClientRect()
  return { x: clamp((e.clientX - rect.left) / rect.width * w, 0, w), y: clamp((e.clientY - rect.top) / rect.height * h, 0, h) }
}

// Snake: grades e colisões independentes do ritmo de renderização.
type Point = { x: number; y: number }
const SNAKE_SIZE = 20
function spawnFood(snake: Point[]): Point {
  const free: Point[] = []
  for (let y = 0; y < SNAKE_SIZE; y++) for (let x = 0; x < SNAKE_SIZE; x++) if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y })
  return free[rand(free.length)] || { x: 0, y: 0 }
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
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🍎 {score} pontos</strong><span>Rodada {round} · {snake.length} segmentos · Velocidade {Math.floor(score/50)+1} · Setas, WASD ou deslize</span></div><div className="hb-snake-board" role="img" aria-label={`Jogo Snake, ${score} pontos`} onPointerDown={e=>{swipeStart.current={x:e.clientX,y:e.clientY}}} onPointerUp={endSwipe} onPointerCancel={()=>{swipeStart.current=null}}>{Array.from({ length: 400 }, (_, i) => { const x = i % 20, y = Math.floor(i / 20); const body = snake.findIndex(p => p.x === x && p.y === y); return <span key={i} className={`${body === 0 ? 'head' : body > 0 ? 'body' : ''} ${food.x === x && food.y === y ? 'fruit' : ''}`} /> })}</div><div className="hb-mini-pad" aria-label="Direção da serpente"><button type="button" disabled={paused} onClick={() => turn(-1, 0)}>←</button><button type="button" disabled={paused} onClick={() => turn(0, -1)}>↑</button><button type="button" disabled={paused} onClick={() => turn(0, 1)}>↓</button><button type="button" disabled={paused} onClick={() => turn(1, 0)}>→</button></div><button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || ended.current} onClick={finish}>✓ Encerrar e registrar {score} pontos</button></div>
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
    if (!ctx) return
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

type Rock = { x:number; y:number; vx:number; vy:number; radius:number }
type Shot = { x:number;y:number;vx:number;vy:number;life:number }
export function AsteroidsGame({ onFinish, paused = false }: ArcadeGameProps) {
  const canvas=useRef<HTMLCanvasElement>(null)
  const keys=useRef(new Set<string>())
  const game=useRef({ x:360,y:210,angle:-Math.PI/2,vx:0,vy:0,score:0,lives:3,cooldown:0,invulnerable:1.2,spawn:0,ended:false,rocks:[] as Rock[],shots:[] as Shot[] })
  const [score,setScore]=useState(0),[lives,setLives]=useState(3)
  useArcadeKeyboard(['arrowleft','arrowright','arrowup','a','d','w',' '],(key,down)=>{if(paused)return;if(down)keys.current.add(key);else keys.current.delete(key)})
  useEffect(()=>{if(paused)keys.current.clear()},[paused])
  useEffect(()=>{const clear=()=>keys.current.clear();window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear)},[])
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let last=0,id=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.035,(now-last)/1000):.016;last=now
      const g=game.current,k=keys.current
      if (g.ended) return
      if (paused) { id=requestAnimationFrame(tick); return }
      if(k.has('arrowleft')||k.has('a'))g.angle-=3.6*dt
      if(k.has('arrowright')||k.has('d'))g.angle+=3.6*dt
      if(k.has('arrowup')||k.has('w')){g.vx+=Math.cos(g.angle)*165*dt;g.vy+=Math.sin(g.angle)*165*dt}
      g.vx*=.992;g.vy*=.992;g.x=(g.x+g.vx*dt+BASE_W)%BASE_W;g.y=(g.y+g.vy*dt+BASE_H)%BASE_H
      g.cooldown-=dt;g.invulnerable-=dt;g.spawn-=dt
      if(g.spawn<=0){const side=rand(4), x=side<2?rand(720):side===2?0:720, y=side>=2?rand(420):side===0?0:420;g.rocks.push({x,y,vx:(Math.random()-.5)*95,vy:(Math.random()-.5)*95,radius:14+rand(17)});g.spawn=Math.max(.32,1.05-g.score/2500)}
      if(k.has(' ')&&g.cooldown<=0){g.shots.push({x:g.x+Math.cos(g.angle)*18,y:g.y+Math.sin(g.angle)*18,vx:g.vx+Math.cos(g.angle)*480,vy:g.vy+Math.sin(g.angle)*480,life:1.2});g.cooldown=.17}
      g.shots=g.shots.filter(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;return s.life>0&&s.x>=0&&s.x<=720&&s.y>=0&&s.y<=420})
      for(const r of g.rocks){r.x=(r.x+r.vx*dt+720)%720;r.y=(r.y+r.vy*dt+420)%420}
      for(let i=g.rocks.length-1;i>=0;i--){const r=g.rocks[i];if(!r)continue;const shotIndex=g.shots.findIndex(s=>Math.hypot(s.x-r.x,s.y-r.y)<r.radius+3);if(shotIndex>=0){g.shots.splice(shotIndex,1);g.rocks.splice(i,1);g.score+=20;setScore(g.score);continue}if(g.invulnerable<=0&&Math.hypot(g.x-r.x,g.y-r.y)<r.radius+13){g.lives--;setLives(g.lives);g.invulnerable=2;g.x=360;g.y=210;g.vx=0;g.vy=0}}
      frame(ctx)
      ctx.strokeStyle='#b7c8dc';ctx.lineWidth=2
      for(const r of g.rocks){ctx.beginPath();ctx.arc(r.x,r.y,r.radius,0,Math.PI*2);ctx.stroke()}
      ctx.fillStyle='#f0c88f';for(const s of g.shots){ctx.beginPath();ctx.arc(s.x,s.y,3,0,Math.PI*2);ctx.fill()}
      if(g.invulnerable<=0||Math.floor(g.invulnerable*7)%2===0){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.angle+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(12,14);ctx.lineTo(0,8);ctx.lineTo(-12,14);ctx.closePath();ctx.strokeStyle='#8de4ff';ctx.lineWidth=3;ctx.stroke();ctx.restore()}
      if(g.lives<=0){if(!g.ended){g.ended=true;onFinish(g.score)};return}
      id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)
  },[onFinish,paused])
  const control=(key:string,down:boolean)=>{if(paused)return;if(down)keys.current.add(key);else keys.current.delete(key)}
  const finish = () => { if (game.current.ended || paused) return; game.current.ended = true; onFinish(game.current.score) }
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🚀 {score} pontos</strong><span>{'♥'.repeat(lives)}{'♡'.repeat(3-lives)} · Gire, acelere e atire nos asteroides</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} aria-label="Asteroids: setas ou A D para girar, W acelerar e Espaço atirar"/><div className="hb-mini-pad">{[['↶','arrowleft'],['↑','arrowup'],['↷','arrowright'],['◎',' ']].map(([label,key])=><button key={key} type="button" onPointerDown={()=>control(key,true)} onPointerUp={()=>control(key,false)} onPointerLeave={()=>control(key,false)}>{label}</button>)}</div><button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={finish}>✓ Encerrar e registrar {score} pontos</button></div>
}

type Pipe={x:number;gap:number;passed:boolean}
export function FlappyGame({onFinish,paused=false}:ArcadeGameProps){
  const canvas=useRef<HTMLCanvasElement>(null)
  const flap=useRef(false)
  const game=useRef({y:210,vy:0,pipes:[] as Pipe[],spawn:1.3,score:0,ended:false,first:true})
  const [score,setScore]=useState(0)
  useArcadeKeyboard([' ','arrowup','w'],(_key,down)=>{if(down&&!paused&&!flap.current)flap.current=true})
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let id=0,last=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.033,(now-last)/1000):.016;last=now
      const g=game.current
      if(g.ended)return
      if(paused){id=requestAnimationFrame(tick);return}
      if(g.first){if(flap.current){g.first=false;g.vy=-255;flap.current=false}else{frame(ctx);ctx.fillStyle='#f0c88f';ctx.beginPath();ctx.arc(175,g.y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e1ebf4';ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.fillText('Toque ou aperte Espaço para começar',360,130);id=requestAnimationFrame(tick);return}}
      if(flap.current){g.vy=-255;flap.current=false}
      g.vy+=660*dt;g.y+=g.vy*dt;g.spawn-=dt
      if(g.spawn<=0){g.pipes.push({x:740,gap:115+rand(190),passed:false});g.spawn=1.6}
      for(const p of g.pipes){p.x-=(175+Math.min(120,g.score*3))*dt;if(!p.passed&&p.x+72<175){p.passed=true;g.score+=5;setScore(g.score)}}
      g.pipes=g.pipes.filter(p=>p.x>-80)
      const hit=g.y<12||g.y>BASE_H-12||g.pipes.some(p=>p.x<186&&p.x+70>163&&(g.y-12<p.gap-75||g.y+12>p.gap+75))
      frame(ctx)
      for(const p of g.pipes){ctx.fillStyle='#5baf90';ctx.fillRect(p.x,0,70,p.gap-75);ctx.fillRect(p.x,p.gap+75,70,420-p.gap-75);ctx.fillStyle='#7bd7b1';ctx.fillRect(p.x-5,p.gap-91,80,16);ctx.fillRect(p.x-5,p.gap+75,80,16)}
      ctx.fillStyle='#f0c88f';ctx.beginPath();ctx.arc(175,g.y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17212c';ctx.fillRect(178,g.y-5,4,4)
      if(hit){if(!g.ended){g.ended=true;onFinish(g.score)};return}
      id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)
  },[onFinish,paused])
  const finish = () => { if (game.current.ended || paused) return; game.current.ended = true; onFinish(game.current.score) }
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🪽 {score} pontos</strong><span>Espaço / ↑ / toque para voar entre obstáculos</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} onPointerDown={()=>{if(!paused)flap.current=true}} aria-label="Voo Infinito: toque ou pressione Espaço para voar"/><div className="hb-mini-pad"><button type="button" disabled={paused} onPointerDown={()=>{if(!paused)flap.current=true}}>↑ Voar</button></div><button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={finish}>✓ Encerrar e registrar {score} pontos</button></div>
}

type EnemyKind = 'runner' | 'stalker' | 'brute'
type Enemy = { x:number; y:number; speed:number; radius:number; hp:number; kind:EnemyKind }
export function ArenaGame({onFinish, paused = false}: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const pointer = useRef<{x:number;y:number}|null>(null)
  const firing = useRef(false)
  const lastDirection = useRef({x:1,y:0})
  const game = useRef({x:360,y:210,health:3,score:0,wave:1,spawn:.7,shoot:0,seconds:0,invulnerable:1.5,ended:false,enemies:[] as Enemy[],shots:[] as Shot[],hitFlash:0})
  const [score,setScore] = useState(0), [health,setHealth] = useState(3), [wave,setWave] = useState(1)
  const [shooting,setShooting] = useState(false)
  useArcadeKeyboard(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d',' ','j'],(key,down)=>{
    if(paused)return
    if(down)keys.current.add(key);else keys.current.delete(key)
  })
  useEffect(()=>{if(paused){keys.current.clear();firing.current=false;setShooting(false)}},[paused])
  useEffect(()=>{
    const clear=()=>{keys.current.clear();firing.current=false;setShooting(false)}
    window.addEventListener('blur',clear)
    return()=>window.removeEventListener('blur',clear)
  },[])
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let id=0,last=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.035,(now-last)/1000):.016;last=now
      const g=game.current,k=keys.current
      if(g.ended)return
      if(paused){id=requestAnimationFrame(tick);return}
      const dx=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'))
      const dy=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'))
      const len=Math.hypot(dx,dy)||1
      if(dx||dy)lastDirection.current={x:dx/len,y:dy/len}
      g.x=clamp(g.x+dx/len*198*dt,15,705)
      g.y=clamp(g.y+dy/len*198*dt,15,405)
      g.seconds+=dt
      const nextWave=1+Math.floor(g.seconds/13)
      if(nextWave!==g.wave){g.wave=nextWave;setWave(nextWave)}
      g.spawn-=dt;g.shoot-=dt;g.invulnerable-=dt;g.hitFlash-=dt
      if(g.spawn<=0&&g.enemies.length<130){
        const amount=g.wave>=7?3:g.wave>=4?2:1
        for(let n=0;n<amount;n++){
          const side=rand(4),kind:EnemyKind=(g.wave>=3 && rand(6)===0)?'brute':rand(4)===0?'runner':'stalker'
          const radius=kind==='brute'?20:kind==='runner'?10:13
          g.enemies.push({x:side===0?-radius:side===1?720+radius:rand(720),y:side===2?-radius:side===3?420+radius:rand(420),speed:(kind==='runner'?106:kind==='brute'?45:69)+g.wave*(kind==='brute'?5:11),radius,hp:kind==='brute'?3:1,kind})
        }
        g.spawn=Math.max(.24,.92-g.wave*.085)
      }
      const nearest=g.enemies.reduce<Enemy|null>((best,e)=>!best||Math.hypot(e.x-g.x,e.y-g.y)<Math.hypot(best.x-g.x,best.y-g.y)?e:best,null)
      const aim=pointer.current
      const targetX=aim?aim.x-g.x:nearest?nearest.x-g.x:lastDirection.current.x
      const targetY=aim?aim.y-g.y:nearest?nearest.y-g.y:lastDirection.current.y
      const aimLen=Math.hypot(targetX,targetY)||1
      const vx=targetX/aimLen,vy=targetY/aimLen
      // Nada de disparos automáticos: somente botão pressionado, clique ou Espaço/J.
      if((firing.current||k.has(' ')||k.has('j')) && g.shoot<=0){
        g.shots.push({x:g.x+vx*18,y:g.y+vy*18,vx:vx*525,vy:vy*525,life:.95})
        g.shoot=.235
      }
      for(const enemy of g.enemies){const ox=g.x-enemy.x,oy=g.y-enemy.y,l=Math.hypot(ox,oy)||1;enemy.x+=ox/l*enemy.speed*dt;enemy.y+=oy/l*enemy.speed*dt}
      g.shots=g.shots.filter(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;return s.life>0 && s.x>=-20 && s.x<=740 && s.y>=-20 && s.y<=440})
      for(let i=g.enemies.length-1;i>=0;i--){
        const e=g.enemies[i];if(!e)continue
        const hit=g.shots.findIndex(s=>Math.hypot(s.x-e.x,s.y-e.y)<e.radius+5)
        if(hit>=0){g.shots.splice(hit,1);e.hp--;g.hitFlash=.09;if(e.hp<=0){g.enemies.splice(i,1);g.score+=e.kind==='brute'?30:e.kind==='runner'?15:10;setScore(g.score);continue}}
        if(g.invulnerable<=0 && Math.hypot(g.x-e.x,g.y-e.y)<e.radius+12){g.health--;setHealth(g.health);g.invulnerable=1.05;g.enemies.splice(i,1);g.hitFlash=.28}
      }
      frame(ctx)
      ctx.save()
      for(const e of g.enemies){
        ctx.beginPath();ctx.arc(e.x,e.y,e.radius,0,Math.PI*2)
        ctx.fillStyle=e.kind==='brute'?'#986491':e.kind==='runner'?'#f1ac7b':'#cf829b';ctx.fill()
        ctx.strokeStyle=e.kind==='brute'?'#e7c4ec':'#fae5e8';ctx.lineWidth=1.5;ctx.stroke()
        if(e.kind==='brute'){ctx.fillStyle='#e9d2ee';ctx.fillRect(e.x-12,e.y-e.radius-9,24*(e.hp/3),3)}
      }
      for(const s of g.shots){ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fillStyle='#f5d78d';ctx.shadowColor='#e9bf65';ctx.shadowBlur=9;ctx.fill()}
      ctx.shadowBlur=0
      ctx.globalAlpha=.35
      ctx.beginPath();ctx.moveTo(g.x+vx*15,g.y+vy*15);ctx.lineTo(g.x+vx*42,g.y+vy*42);ctx.strokeStyle='#a3e7ff';ctx.lineWidth=2;ctx.stroke()
      ctx.globalAlpha=1
      if(g.invulnerable<=0||Math.floor(g.invulnerable*9)%2===0){
        ctx.save();ctx.translate(g.x,g.y);ctx.rotate(Math.atan2(vy,vx));
        ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fillStyle='#8de4ff';ctx.fill();ctx.strokeStyle='#e7fbff';ctx.lineWidth=2;ctx.stroke()
        ctx.fillStyle='#153d53';ctx.fillRect(5,-4,17,8);ctx.restore()
      }
      if(pointer.current){ctx.strokeStyle='#f5d78d';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(pointer.current.x,pointer.current.y,9,0,Math.PI*2);ctx.moveTo(pointer.current.x-15,pointer.current.y);ctx.lineTo(pointer.current.x-5,pointer.current.y);ctx.moveTo(pointer.current.x+5,pointer.current.y);ctx.lineTo(pointer.current.x+15,pointer.current.y);ctx.stroke()}
      if(g.hitFlash>0){ctx.fillStyle=`rgba(238,104,130,${Math.min(.15,g.hitFlash*.45)})`;ctx.fillRect(0,0,720,420)}
      ctx.restore()
      if(g.health<=0){if(!g.ended){g.ended=true;onFinish(g.score)};return}
      id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(id)
  },[onFinish,paused])
  const control=(key:string,down:boolean)=>{if(paused)return;if(down)keys.current.add(key);else keys.current.delete(key)}
  const aimAt=(e:ReactPointerEvent<HTMLCanvasElement>)=>{pointer.current=canvasPointer(e)}
  const setFire=(down:boolean)=>{firing.current=down&&!paused;setShooting(firing.current)}
  return <div className="hb-mini-inner hb-arena-v191">
    <div className="hb-mini-hud"><strong>⚔️ {score} pontos</strong><span>{'♥'.repeat(health)}{'♡'.repeat(3-health)} · Onda {wave} · {wave>=4?'Horda intensa':'Prepare sua mira'}</span></div>
    <div className="hb-arena-tip">🎯 <strong>Você controla os disparos.</strong> WASD/setas para mover · Mouse para mirar · Clique, Espaço ou J para atirar. No celular, segure <strong>ATIRAR</strong>.</div>
    <canvas className="hb-mini-canvas hb-arena-canvas" ref={canvas} width={BASE_W} height={BASE_H} onPointerMove={e=>{if(!paused)aimAt(e)}} onPointerDown={e=>{if(paused)return;aimAt(e);setFire(true);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{setFire(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>setFire(false)} onPointerLeave={e=>{if(e.pointerType==='mouse')setFire(false)}} aria-label="Arena Infinita: WASD ou setas para mover; mire com mouse e clique, Espaço ou J para atirar" />
    <div className="hb-mini-pad hb-mini-arena-pad">{[['←','arrowleft'],['↑','arrowup'],['↓','arrowdown'],['→','arrowright']].map(([label,key])=><button key={key} type="button" disabled={paused} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);control(key,true)}} onPointerUp={()=>control(key,false)} onPointerCancel={()=>control(key,false)} onPointerLeave={()=>control(key,false)}>{label}</button>)}<button type="button" className={`hb-mini-fire ${shooting?'is-firing':''}`} disabled={paused} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setFire(true)}} onPointerUp={()=>setFire(false)} onPointerCancel={()=>setFire(false)} onPointerLeave={()=>setFire(false)}>⌖ ATIRAR</button></div>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || game.current.ended} onClick={() => { if (game.current.ended) return; game.current.ended = true; onFinish(game.current.score) }}>✓ Encerrar e registrar {score} pontos</button>
  </div>
}
