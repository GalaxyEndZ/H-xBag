import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type ArcadeGameProps = { onFinish: (score: number) => void }
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
export function SnakeGame({ onFinish }: ArcadeGameProps) {
  const snakeRef = useRef<Point[]>([{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }])
  const foodRef = useRef<Point>(spawnFood(snakeRef.current))
  const direction = useRef<Point>({ x: 1, y: 0 })
  const nextDirection = useRef<Point>({ x: 1, y: 0 })
  const scoreRef = useRef(0)
  const ended = useRef(false)
  const [score, setScore] = useState(0)
  const [snake, setSnake] = useState<Point[]>(snakeRef.current)
  const [food, setFood] = useState(foodRef.current)
  const turn = (dx: number, dy: number) => { const now = direction.current; if (dx !== -now.x || dy !== -now.y) nextDirection.current = { x: dx, y: dy } }
  useArcadeKeyboard(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'], (key, down) => {
    if (!down) return
    if (key === 'arrowup' || key === 'w') turn(0, -1)
    if (key === 'arrowdown' || key === 's') turn(0, 1)
    if (key === 'arrowleft' || key === 'a') turn(-1, 0)
    if (key === 'arrowright' || key === 'd') turn(1, 0)
  })
  useEffect(() => {
    let ticks = 0
    const timer = window.setInterval(() => {
      if (ended.current) return
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
      if (eating) { scoreRef.current += 10; setScore(scoreRef.current); foodRef.current = spawnFood(snakeRef.current); setFood(foodRef.current) }
      ticks++
      if (snakeRef.current.length === 400) { ended.current = true; onFinish(scoreRef.current) }
    }, 115)
    return () => window.clearInterval(timer)
  }, [onFinish])
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🍎 {score} pontos</strong><span>Setas / WASD · Coma frutas sem colidir</span></div><div className="hb-snake-board" role="img" aria-label={`Jogo Snake, ${score} pontos`}>{Array.from({ length: 400 }, (_, i) => { const x = i % 20, y = Math.floor(i / 20); const body = snake.findIndex(p => p.x === x && p.y === y); return <span key={i} className={`${body === 0 ? 'head' : body > 0 ? 'body' : ''} ${food.x === x && food.y === y ? 'fruit' : ''}`} /> })}</div><div className="hb-mini-pad"><button type="button" onClick={() => turn(-1, 0)}>←</button><button type="button" onClick={() => turn(0, -1)}>↑</button><button type="button" onClick={() => turn(0, 1)}>↓</button><button type="button" onClick={() => turn(1, 0)}>→</button></div></div>
}

type Brick = { x: number; y: number; alive: boolean }
export function BreakoutGame({ onFinish }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const controls = useRef({ left: false, right: false, target: BASE_W / 2 })
  const game = useRef({ ballX: 360, ballY: 320, vx: 155, vy: -220, paddle: 310, score: 0, lives: 3, ended: false, bricks: Array.from({ length: 50 }, (_, i): Brick => ({ x: 27 + i % 10 * 67, y: 45 + Math.floor(i / 10) * 34, alive: true })) })
  const [score, setScore] = useState(0), [lives, setLives] = useState(3)
  useArcadeKeyboard(['arrowleft','arrowright','a','d'], (key, down) => { if (['arrowleft','a'].includes(key)) controls.current.left = down; else controls.current.right = down })
  useEffect(() => {
    const c = canvas.current; const ctx = c?.getContext('2d'); if (!ctx) return
    let id = 0, last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(.035, (now-last)/1000) : .016; last=now
      const g = game.current, ctl = controls.current
      if (ctl.left) g.paddle -= 410*dt
      if (ctl.right) g.paddle += 410*dt
      if (!ctl.left && !ctl.right) g.paddle += clamp(ctl.target-45-g.paddle, -560*dt, 560*dt)
      g.paddle = clamp(g.paddle, 6, 624)
      const py = g.ballY
      g.ballX += g.vx*dt; g.ballY += g.vy*dt
      if (g.ballX < 8 || g.ballX > 712) { g.vx = -g.vx; g.ballX = clamp(g.ballX,8,712) }
      if (g.ballY < 8) { g.vy = Math.abs(g.vy); g.ballY=8 }
      if (g.vy > 0 && py <= 378 && g.ballY >= 378 && g.ballX >= g.paddle-9 && g.ballX <= g.paddle+99) { g.vy = -Math.abs(g.vy)*1.02; g.vx = ((g.ballX - (g.paddle+45))/45)*280 }
      for (const brick of g.bricks) if (brick.alive && g.ballX > brick.x-8 && g.ballX < brick.x+61 && g.ballY > brick.y-8 && g.ballY < brick.y+26) { brick.alive = false; g.vy *= -1; g.score+=10; setScore(g.score); break }
      if (g.ballY > 430) { g.lives--; setLives(g.lives); g.ballX=360; g.ballY=300; g.vx=155; g.vy=-220 }
      frame(ctx)
      const palette = ['#7eacc7','#88d7c6','#f0c88f','#d9a2ad','#aa9bd5']
      for (const b of g.bricks) if(b.alive) {ctx.fillStyle=palette[Math.floor((b.y-45)/34)]||'#88d7c6';ctx.fillRect(b.x,b.y,60,25)}
      ctx.fillStyle='#8ee3fc';ctx.fillRect(g.paddle,383,90,11)
      ctx.beginPath(); ctx.arc(g.ballX,g.ballY,8,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()
      if (g.lives<=0 || g.bricks.every(b=>!b.alive)) { if (!g.ended) {g.ended=true;onFinish(g.score)};return }
      id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(id)
  },[onFinish])
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🧱 {score} pontos</strong><span>{'♥'.repeat(lives)}{'♡'.repeat(3-lives)} · Mova a raquete para quebrar 50 blocos</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} onPointerMove={e=>{controls.current.target=canvasPointer(e).x}} onPointerDown={e=>{controls.current.target=canvasPointer(e).x}} aria-label="Breakout: mova a raquete com mouse, toque ou setas"/><div className="hb-mini-pad"><button type="button" onPointerDown={()=>{controls.current.left=true}} onPointerUp={()=>{controls.current.left=false}} onPointerLeave={()=>{controls.current.left=false}}>←</button><button type="button" onPointerDown={()=>{controls.current.right=true}} onPointerUp={()=>{controls.current.right=false}} onPointerLeave={()=>{controls.current.right=false}}>→</button></div></div>
}

type Rock = { x:number; y:number; vx:number; vy:number; radius:number }
type Shot = { x:number;y:number;vx:number;vy:number;life:number }
export function AsteroidsGame({ onFinish }: ArcadeGameProps) {
  const canvas=useRef<HTMLCanvasElement>(null)
  const keys=useRef(new Set<string>())
  const game=useRef({ x:360,y:210,angle:-Math.PI/2,vx:0,vy:0,score:0,lives:3,cooldown:0,invulnerable:1.2,spawn:0,ended:false,rocks:[] as Rock[],shots:[] as Shot[] })
  const [score,setScore]=useState(0),[lives,setLives]=useState(3)
  useArcadeKeyboard(['arrowleft','arrowright','arrowup','a','d','w',' '],(key,down)=>{if(down)keys.current.add(key);else keys.current.delete(key)})
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let last=0,id=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.035,(now-last)/1000):.016;last=now
      const g=game.current,k=keys.current
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
  },[onFinish])
  const control=(key:string,down:boolean)=>{if(down)keys.current.add(key);else keys.current.delete(key)}
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🚀 {score} pontos</strong><span>{'♥'.repeat(lives)}{'♡'.repeat(3-lives)} · Gire, acelere e atire nos asteroides</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} aria-label="Asteroids: setas ou A D para girar, W acelerar e Espaço atirar"/><div className="hb-mini-pad">{[['↶','arrowleft'],['↑','arrowup'],['↷','arrowright'],['◎',' ']].map(([label,key])=><button key={key} type="button" onPointerDown={()=>control(key,true)} onPointerUp={()=>control(key,false)} onPointerLeave={()=>control(key,false)}>{label}</button>)}</div></div>
}

type Pipe={x:number;gap:number;passed:boolean}
export function FlappyGame({onFinish}:ArcadeGameProps){
  const canvas=useRef<HTMLCanvasElement>(null)
  const flap=useRef(false)
  const game=useRef({y:210,vy:0,pipes:[] as Pipe[],spawn:0,score:0,ended:false,first:true})
  const [score,setScore]=useState(0)
  useArcadeKeyboard([' ','arrowup','w'],(_key,down)=>{if(down&&!flap.current)flap.current=true})
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let id=0,last=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.033,(now-last)/1000):.016;last=now
      const g=game.current
      if(g.first){g.vy=-180;g.first=false}
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
  },[onFinish])
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>🪽 {score} pontos</strong><span>Espaço / ↑ / toque para voar entre obstáculos</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} onPointerDown={()=>{flap.current=true}} aria-label="Voo Infinito: toque ou pressione Espaço para voar"/><div className="hb-mini-pad"><button type="button" onPointerDown={()=>{flap.current=true}}>↑ Voar</button></div></div>
}

type Enemy={x:number;y:number;speed:number}
export function ArenaGame({onFinish}:ArcadeGameProps){
  const canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>())
  const game=useRef({x:360,y:210,health:3,score:0,wave:1,spawn:.5,shoot:0,seconds:0,invulnerable:0,ended:false,enemies:[] as Enemy[],shots:[] as Shot[]})
  const [score,setScore]=useState(0),[health,setHealth]=useState(3),[wave,setWave]=useState(1)
  useArcadeKeyboard(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'],(key,down)=>{if(down)keys.current.add(key);else keys.current.delete(key)})
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return
    let id=0,last=0
    const tick=(now:number)=>{
      const dt=last?Math.min(.035,(now-last)/1000):.016;last=now
      const g=game.current,k=keys.current
      const dx=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),dy=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'))
      const len=Math.hypot(dx,dy)||1;g.x=clamp(g.x+dx/len*210*dt,12,708);g.y=clamp(g.y+dy/len*210*dt,12,408)
      g.seconds+=dt;g.wave=1+Math.floor(g.seconds/18);g.spawn-=dt;g.shoot-=dt;g.invulnerable-=dt
      if(g.spawn<=0){const side=rand(4);g.enemies.push({x:side===0?-5:side===1?725:rand(720),y:side===2?-5:side===3?425:rand(420),speed:40+g.wave*8});g.spawn=Math.max(.21,.9-g.wave*.07);setWave(g.wave)}
      const nearest=g.enemies.slice().sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y))[0]
      if(nearest&&g.shoot<=0){const sx=nearest.x-g.x,sy=nearest.y-g.y,slen=Math.hypot(sx,sy)||1;g.shots.push({x:g.x,y:g.y,vx:sx/slen*430,vy:sy/slen*430,life:1.1});g.shoot=.36}
      for(const enemy of g.enemies){const ox=g.x-enemy.x,oy=g.y-enemy.y,l=Math.hypot(ox,oy)||1;enemy.x+=ox/l*enemy.speed*dt;enemy.y+=oy/l*enemy.speed*dt}
      g.shots=g.shots.filter(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;return s.life>0})
      for(let i=g.enemies.length-1;i>=0;i--){const e=g.enemies[i];if(!e)continue;const hit=g.shots.findIndex(s=>Math.hypot(s.x-e.x,s.y-e.y)<17);if(hit>=0){g.shots.splice(hit,1);g.enemies.splice(i,1);g.score+=10;setScore(g.score);continue}if(g.invulnerable<=0&&Math.hypot(g.x-e.x,g.y-e.y)<23){g.health--;setHealth(g.health);g.invulnerable=1.5;g.enemies.splice(i,1)}}
      frame(ctx)
      ctx.fillStyle='#d99bad';for(const e of g.enemies){ctx.beginPath();ctx.arc(e.x,e.y,13,0,Math.PI*2);ctx.fill()}
      ctx.fillStyle='#f0c88f';for(const s of g.shots){ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fill()}
      if(g.invulnerable<=0||Math.floor(g.invulnerable*8)%2===0){ctx.beginPath();ctx.arc(g.x,g.y,13,0,Math.PI*2);ctx.fillStyle='#8de4ff';ctx.fill();ctx.strokeStyle='#fff';ctx.stroke()}
      if(g.health<=0){if(!g.ended){g.ended=true;onFinish(g.score)};return}
      id=requestAnimationFrame(tick)
    }
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)
  },[onFinish])
  const control=(key:string,down:boolean)=>{if(down)keys.current.add(key);else keys.current.delete(key)}
  return <div className="hb-mini-inner"><div className="hb-mini-hud"><strong>⚔️ {score} pontos</strong><span>{'♥'.repeat(health)}{'♡'.repeat(3-health)} · Onda {wave} · Ataques automáticos</span></div><canvas className="hb-mini-canvas" ref={canvas} width={BASE_W} height={BASE_H} aria-label="Arena Infinita: mova o herói com as setas ou WASD"/><div className="hb-mini-pad">{[['←','arrowleft'],['↑','arrowup'],['↓','arrowdown'],['→','arrowright']].map(([label,key])=><button key={key} type="button" onPointerDown={()=>control(key,true)} onPointerUp={()=>control(key,false)} onPointerLeave={()=>control(key,false)}>{label}</button>)}</div></div>
}
