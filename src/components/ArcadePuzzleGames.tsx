import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { ArcadeGameProps } from './ArcadeCanvasGames'

const random = (max: number) => Math.floor(Math.random() * max)
type Direction = 'left' | 'right' | 'up' | 'down'
function spawnTile(board: number[]) {
  const empty = board.map((n, i) => n ? -1 : i).filter(i => i >= 0)
  if (!empty.length) return board
  const next = [...board]
  next[empty[random(empty.length)]] = Math.random() < .9 ? 2 : 4
  return next
}
function canMove2048(board: number[]) {
  if (board.includes(0)) return true
  return board.some((value, i) => (i % 4 < 3 && board[i + 1] === value) || (i < 12 && board[i + 4] === value))
}
function move2048(board: number[], direction: Direction) {
  const next = [...board]
  let points = 0
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, j) => {
      if (direction === 'left') return line * 4 + j
      if (direction === 'right') return line * 4 + 3 - j
      if (direction === 'up') return j * 4 + line
      return (3 - j) * 4 + line
    })
    const present = indices.map(i => board[i]).filter(n => n !== 0)
    const merged: number[] = []
    for (let i = 0; i < present.length; i++) {
      if (present[i] === present[i + 1]) { const num = present[i] * 2; merged.push(num); points += num; i++ }
      else merged.push(present[i])
    }
    indices.forEach((index, i) => { next[index] = merged[i] || 0 })
  }
  return { board: next, points, changed: next.some((v, i) => v !== board[i]) }
}
export function Game2048({ onFinish }: ArcadeGameProps) {
  const [board, setBoard] = useState(() => spawnTile(spawnTile(Array(16).fill(0) as number[])))
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const boardRef = useRef(board), scoreRef = useRef(0), ended = useRef(false)
  const play = useCallback((direction: Direction) => {
    if (ended.current) return
    const outcome = move2048(boardRef.current, direction)
    if (!outcome.changed) return
    const next = spawnTile(outcome.board)
    boardRef.current = next
    scoreRef.current += outcome.points
    setScore(scoreRef.current); setBoard(next)
    if (!canMove2048(next) || next.some(n => n >= 2048)) { ended.current = true; setFinished(true); onFinish(scoreRef.current) }
  }, [onFinish])
  useEffect(() => {
    const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select')) return
      const direction = keys[event.key]
      if (direction) { event.preventDefault(); play(direction) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [play])
  const finish = () => { if (ended.current) return; ended.current = true; setFinished(true); onFinish(scoreRef.current) }
  return <div className="hb-mini-inner hb-puzzle"><div className="hb-mini-hud"><strong>🔢 {score.toLocaleString('pt-BR')} pontos</strong><span>Junte números iguais até chegar a 2048</span></div><div className="hb-2048-board" role="grid" aria-label="Tabuleiro 2048">{board.map((tile, index) => <div role="gridcell" key={index} className={`hb-2048-tile ${tile ? 'has-value' : ''}`} data-value={Math.min(tile, 2048)}>{tile || ''}</div>)}</div><div className="hb-mini-pad"><button type="button" onClick={()=>play('left')}>←</button><button type="button" onClick={()=>play('up')}>↑</button><button type="button" onClick={()=>play('down')}>↓</button><button type="button" onClick={()=>play('right')}>→</button></div><button type="button" className="hb-mini-finish" disabled={finished} onClick={finish}>✓ Encerrar e registrar {score} pontos</button></div>
}

const MINE_SIZE = 9, MINE_TOTAL = 10
type MineCell = { mine: boolean; opened: boolean; flagged: boolean; adjacent: number }
const adjacentIndices = (index: number) => {
  const x = index % MINE_SIZE, y = Math.floor(index / MINE_SIZE)
  const result: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy
    if ((dx || dy) && nx >= 0 && nx < MINE_SIZE && ny >= 0 && ny < MINE_SIZE) result.push(ny * MINE_SIZE + nx)
  }
  return result
}
function mineBoard(firstSafe: number): MineCell[] {
  const cells = Array.from({length:81}, (): MineCell => ({mine:false,opened:false,flagged:false,adjacent:0}))
  const available = Array.from({length:81}, (_, i) => i).filter(i => i !== firstSafe && !adjacentIndices(firstSafe).includes(i))
  for (let i=0;i<MINE_TOTAL;i++) { const pick = random(available.length); const position = available.splice(pick,1)[0]; cells[position].mine=true }
  cells.forEach((cell, i) => { if (!cell.mine) cell.adjacent = adjacentIndices(i).filter(j => cells[j].mine).length })
  return cells
}
export function MinesweeperGame({ onFinish }: ArcadeGameProps) {
  const [cells, setCells] = useState<MineCell[]>(() => Array.from({length:81}, (): MineCell => ({mine:false, opened:false,flagged:false,adjacent:0})))
  const [flagsMode, setFlagsMode] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('Descubra todas as casas seguras.')
  const gridRef = useRef(cells), firstRef = useRef(true), finishedRef=useRef(false), startRef=useRef(Date.now())
  useEffect(()=>{const interval=window.setInterval(()=>{if(!finishedRef.current)setElapsed(Math.floor((Date.now()-startRef.current)/1000))},1000);return()=>clearInterval(interval)},[])
  const play = (index: number, flag: boolean) => {
    if (finishedRef.current) return
    let next=gridRef.current.map(cell=>({...cell}))
    if (flag) {if (!next[index].opened) next[index].flagged=!next[index].flagged}
    else {
      if (next[index].flagged || next[index].opened) return
      if (firstRef.current) {next=mineBoard(index);firstRef.current=false}
      if (next[index].mine) { next[index].opened=true;next=next.map(c=>c.mine?{...c,opened:true}:c); finishedRef.current=true;setMessage('Você encontrou uma mina.');onFinish(0) }
      else {
        const todo=[index], seen=new Set<number>()
        while (todo.length) {const i=todo.pop()!;if(seen.has(i)||next[i].flagged||next[i].mine)continue;seen.add(i);next[i].opened=true;if(!next[i].adjacent)todo.push(...adjacentIndices(i))}
        if (next.filter(c=>c.opened&&!c.mine).length===81-MINE_TOTAL) {finishedRef.current=true;const seconds=Math.max(1,Math.floor((Date.now()-startRef.current)/1000));setMessage('Campo limpo! Vitória!');onFinish(Math.max(150,750-seconds*5))}
      }
    }
    gridRef.current=next;setCells(next)
  }
  const flags=cells.filter(c=>c.flagged).length
  return <div className="hb-mini-inner hb-puzzle"><div className="hb-mini-hud"><strong>💣 {MINE_TOTAL-flags} minas</strong><span>⏱ {elapsed}s · Clique com o direito para sinalizar</span></div><div className="hb-mine-tools"><button type="button" className={flagsMode?'is-active':''} aria-pressed={flagsMode} onClick={()=>setFlagsMode(f=>!f)}>🚩 {flagsMode?'Modo bandeira ativo':'Ativar bandeira'}</button><span>{message}</span></div><div className="hb-mine-board" role="grid" aria-label="Campo Minado 9 por 9">{cells.map((cell,i)=><button type="button" role="gridcell" key={i} className={`${cell.opened?'opened':''} ${cell.mine?'mine':''}`} data-adjacent={cell.adjacent} onClick={()=>play(i,flagsMode)} onContextMenu={(event:ReactMouseEvent)=>{event.preventDefault();play(i,true)}} aria-label={`Casa ${i+1}: ${cell.opened ? cell.mine?'mina':cell.adjacent+' minas próximas':cell.flagged?'bandeira':'fechada'}`}>{cell.opened ? cell.mine?'💥':cell.adjacent||'' :cell.flagged?'🚩':''}</button>)}</div></div>
}

const RUNES=['✦','☽','♜','⚔','❖','♢','☀','✺']
type MemoryCard={id:number;rune:string;open:boolean;matched:boolean}
function shuffle<T>(values:T[]):T[]{const list=[...values];for(let i=list.length-1;i>0;i--){const j=random(i+1);[list[i],list[j]]=[list[j],list[i]]}return list}
export function MemoryGame({onFinish}:ArcadeGameProps){
  const [cards,setCards]=useState<MemoryCard[]>(()=>shuffle([...RUNES,...RUNES].map((rune,id)=>({id,rune,open:false,matched:false}))))
  const [moves,setMoves]=useState(0),[matches,setMatches]=useState(0),[elapsed,setElapsed]=useState(0)
  const cardsRef=useRef(cards),selected=useRef<number[]>([]),locked=useRef(false),finished=useRef(false),timerRef=useRef<number|null>(null),startRef=useRef(Date.now())
  useEffect(()=>{const interval=window.setInterval(()=>{if(!finished.current)setElapsed(Math.floor((Date.now()-startRef.current)/1000))},1000);return()=>{clearInterval(interval);if(timerRef.current)clearTimeout(timerRef.current)}},[])
  const reveal=(id:number)=>{
    if(locked.current||finished.current||selected.current.includes(id))return
    const item=cardsRef.current.find(c=>c.id===id);if(!item||item.matched)return
    const next=cardsRef.current.map(c=>c.id===id?{...c,open:true}:c)
    cardsRef.current=next;setCards(next);selected.current.push(id)
    if(selected.current.length===2){
      const [a,b]=selected.current;const first=next.find(c=>c.id===a)!, second=next.find(c=>c.id===b)!
      const nextMoves=movesRef.current+1;movesRef.current=nextMoves;setMoves(nextMoves)
      if(first.rune===second.rune){const completed=next.map(c=>c.id===a||c.id===b?{...c,matched:true}:c);cardsRef.current=completed;setCards(completed);selected.current=[];const count=completed.filter(c=>c.matched).length/2;setMatches(count);if(count===8){finished.current=true;const seconds=Math.floor((Date.now()-startRef.current)/1000);onFinish(Math.max(100,800-nextMoves*22-seconds*4))}}
      else{locked.current=true;timerRef.current=window.setTimeout(()=>{const nextCards=cardsRef.current.map(c=>c.id===a||c.id===b?{...c,open:false}:c);cardsRef.current=nextCards;setCards(nextCards);selected.current=[];locked.current=false},720)}
    }
  }
  const movesRef=useRef(0)
  return <div className="hb-mini-inner hb-puzzle"><div className="hb-mini-hud"><strong>🔮 {matches}/8 pares</strong><span>{moves} movimentos · {elapsed}s · Combine as runas</span></div><div className="hb-memory-board" role="grid" aria-label="Memória Arcana, 16 cartas">{cards.map(card=><button type="button" role="gridcell" key={card.id} className={`${card.open||card.matched?'revealed':''} ${card.matched?'matched':''}`} onClick={()=>reveal(card.id)} aria-label={card.open||card.matched?`Runa ${card.rune}`:'Carta virada para baixo'}>{card.open||card.matched?card.rune:'✧'}</button>)}</div></div>
}
