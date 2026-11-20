import { useEffect, useReducer, useRef } from 'react'
import type { ArcadeGameProps } from './ArcadeCanvasGames'
import './RuneFallGame.css'

type RuneKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
type Cell = [number, number]
type RunePiece = { kind: RuneKind; x: number; y: number; rotation: number }
type RuneAction = 'left' | 'right' | 'down' | 'drop' | 'rotate' | 'rotate-back' | 'hold' | 'tick' | 'end'
type RuneState = {
  board: number[]; piece: RunePiece; queue: RuneKind[]; hold: RuneKind | null
  holdUsed: boolean; score: number; lines: number; level: number; over: boolean
  lastClear: number; pieces: number
}

const W = 10, H = 20
const KINDS: RuneKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const COLORS: Record<RuneKind, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }
const SHAPES: Record<RuneKind, Cell[]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

const shuffleBag = (): RuneKind[] => {
  const list = [...KINDS]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function shape(kind: RuneKind, rotation: number): Cell[] {
  let cells = SHAPES[kind].map(([x, y]) => [x, y] as Cell)
  for (let r = 0; r < ((rotation % 4) + 4) % 4; r++) cells = cells.map(([x, y]) => [3 - y, x])
  const minX = Math.min(...cells.map(cell => cell[0]))
  const minY = Math.min(...cells.map(cell => cell[1]))
  return cells.map(([x, y]) => [x - minX, y - minY])
}
function position(kind: RuneKind): RunePiece {
  const width = Math.max(...shape(kind, 0).map(([x]) => x)) + 1
  return { kind, x: Math.floor((W - width) / 2), y: 0, rotation: 0 }
}
function fits(board: number[], piece: RunePiece) {
  return shape(piece.kind, piece.rotation).every(([dx, dy]) => {
    const x = piece.x + dx, y = piece.y + dy
    return x >= 0 && x < W && y < H && (y < 0 || board[y * W + x] === 0)
  })
}
function takeNext(queue: RuneKind[]): { kind: RuneKind; queue: RuneKind[] } {
  const expanded = queue.length < 8 ? [...queue, ...shuffleBag()] : queue
  return { kind: expanded[0], queue: expanded.slice(1) }
}
function initial(): RuneState {
  const first = takeNext(shuffleBag())
  return { board: Array(W * H).fill(0), piece: position(first.kind), queue: first.queue,
    hold: null, holdUsed: false, score: 0, lines: 0, level: 1, over: false, lastClear: 0, pieces: 0 }
}
function lock(state: RuneState): RuneState {
  const board = [...state.board]
  for (const [dx, dy] of shape(state.piece.kind, state.piece.rotation)) {
    const x = state.piece.x + dx, y = state.piece.y + dy
    if (y < 0) return { ...state, over: true }
    board[y * W + x] = COLORS[state.piece.kind]
  }
  const rows: number[][] = []
  let cleared = 0
  for (let y = 0; y < H; y++) {
    const row = board.slice(y * W, (y + 1) * W)
    if (row.every(Boolean)) cleared++
    else rows.push(row)
  }
  while (rows.length < H) rows.unshift(Array(W).fill(0))
  const nextBoard = rows.flat()
  const totalLines = state.lines + cleared
  const next = takeNext(state.queue)
  const nextPiece = position(next.kind)
  return {
    ...state, board: nextBoard, piece: nextPiece, queue: next.queue,
    holdUsed: false, lines: totalLines, level: Math.floor(totalLines / 10) + 1,
    score: state.score + ([0, 100, 300, 500, 800][cleared] || 0) * state.level,
    lastClear: cleared, pieces: state.pieces + 1, over: !fits(nextBoard, nextPiece),
  }
}
/** Regras independentes da interface: verificáveis sem renderizar React. */
export function runeFallStep(state: RuneState, action: RuneAction): RuneState {
  if (state.over) return state
  if (action === 'end') return { ...state, over: true }
  if (action === 'hold') {
    if (state.holdUsed) return state
    if (state.hold) {
      const nextPiece = position(state.hold)
      return { ...state, piece: nextPiece, hold: state.piece.kind, holdUsed: true, over: !fits(state.board, nextPiece) }
    }
    const next = takeNext(state.queue)
    const nextPiece = position(next.kind)
    return { ...state, piece: nextPiece, queue: next.queue, hold: state.piece.kind, holdUsed: true, over: !fits(state.board, nextPiece) }
  }
  if (action === 'rotate' || action === 'rotate-back') {
    if (state.piece.kind === 'O') return state
    const rotation = (state.piece.rotation + (action === 'rotate' ? 1 : 3)) % 4
    for (const move of [0, -1, 1, -2, 2]) {
      const piece = { ...state.piece, rotation, x: state.piece.x + move }
      if (fits(state.board, piece)) return { ...state, piece }
    }
    return state
  }
  if (action === 'drop') {
    let piece = state.piece, distance = 0
    while (fits(state.board, { ...piece, y: piece.y + 1 })) { piece = { ...piece, y: piece.y + 1 }; distance++ }
    return lock({ ...state, piece, score: state.score + distance * 2 })
  }
  const dx = action === 'left' ? -1 : action === 'right' ? 1 : 0
  const dy = action === 'down' || action === 'tick' ? 1 : 0
  const piece = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy }
  if (fits(state.board, piece)) return { ...state, piece, score: action === 'down' ? state.score + 1 : state.score }
  if (dy) return lock(state)
  return state
}

function Preview({ kind }: { kind: RuneKind | null }) {
  const cells = kind ? shape(kind, 0) : []
  const cellSet = new Set(cells.map(([x, y]) => `${x}:${y}`))
  return <div className="hb-rune-preview-grid" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <span key={i} className={cellSet.has(`${i % 4}:${Math.floor(i / 4)}`) ? `rune-${kind}` : ''} />)}</div>
}

export default function RuneFallGame({ onFinish, paused = false }: ArcadeGameProps) {
  const [game, dispatch] = useReducer((state: RuneState, action: RuneAction) => runeFallStep(state, action), undefined, initial)
  const ended = useRef(false)
  useEffect(() => {
    if (!paused && !game.over) {
      const timer = window.setInterval(() => dispatch('tick'), Math.max(90, 790 * Math.pow(.88, game.level - 1)))
      return () => window.clearInterval(timer)
    }
  }, [paused, game.over, game.level])
  useEffect(() => {
    if (game.over && !ended.current) { ended.current = true; onFinish(game.score) }
  }, [game.over, game.score, onFinish])
  useEffect(() => {
    const controls: Record<string, RuneAction> = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate',
      a: 'left', d: 'right', s: 'down', w: 'rotate', x: 'rotate', z: 'rotate-back',
      ' ': 'drop', c: 'hold', C: 'hold',
    }
    const keydown = (event: KeyboardEvent) => {
      if (paused || ended.current || game.over || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]')) return
      const action = controls[event.key]
      if (!action) return
      if (event.repeat && ['drop','hold','rotate','rotate-back'].includes(action)) return
      event.preventDefault(); dispatch(action)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [paused, game.over])
  const finish = () => { if (paused || ended.current) return; dispatch('end') }
  const ghost = { ...game.piece }
  while (fits(game.board, { ...ghost, y: ghost.y + 1 })) ghost.y++
  const onBoard = new Set(shape(game.piece.kind, game.piece.rotation).map(([x, y]) => `${x + game.piece.x}:${y + game.piece.y}`))
  const onGhost = new Set(shape(ghost.kind, ghost.rotation).map(([x, y]) => `${x + ghost.x}:${y + ghost.y}`))
  return <div className="hb-mini-inner hb-rune-fall">
    <header className="hb-rune-score-header"><div className="hb-rune-main-score"><span aria-hidden="true">✥</span><div><small>PONTUAÇÃO</small><strong>{game.score.toLocaleString('pt-BR')} <em>pts</em></strong></div></div><div className="hb-rune-score-details"><div><small>NÍVEL</small><strong>{game.level}</strong></div><div><small>LINHAS</small><strong>{game.lines}</strong></div><div><small>PEÇAS</small><strong>{game.pieces}</strong></div></div></header>
    <div className="hb-rune-layout"><section className="hb-rune-side"><div className="hb-rune-side-card"><span>PEÇA RESERVADA</span><Preview kind={game.hold}/><small>{game.holdUsed ? 'Disponível após fixar a peça' : 'C para guardar / trocar'}</small></div><div className="hb-rune-side-card hb-rune-tips"><span>COMO JOGAR</span><p>Monte linhas completas com as runas. Limpe 10 linhas para subir de nível.</p><small>← → Mover</small><small>↑ Girar</small><small>Espaço · Queda</small><small>C · Reservar</small></div></section>
    <section className="hb-rune-board-wrap" aria-label={`Queda Rúnica, nível ${game.level}, ${game.lines} linhas`}><div className="hb-rune-board-heading"><span>✦ QUEDA RÚNICA</span><small>ETERNAMENTE EM MOVIMENTO</small></div><div className="hb-rune-board" role="img" aria-label="Tabuleiro com dez colunas e vinte linhas">{Array.from({length: W*H},(_,i)=>{
      const x=i%W,y=Math.floor(i/W),active=onBoard.has(`${x}:${y}`),shade=!active&&!game.board[i]&&onGhost.has(`${x}:${y}`)
      return <span key={i} className={`hb-rune-cell ${active ? `rune-${game.piece.kind} is-active` : game.board[i] ? `rune-color-${game.board[i]}` : shade ? 'is-ghost' : ''}`} />
    })}</div><div className="hb-rune-board-bottom">{game.lastClear > 0 ? `✦ ${game.lastClear} linha${game.lastClear === 1 ? '' : 's'} eliminada${game.lastClear === 1 ? '' : 's'}!` : 'Limpe linhas e continue até o topo chegar'}</div></section>
    <aside className="hb-rune-side"><div className="hb-rune-side-card"><span>PRÓXIMAS PEÇAS</span>{game.queue.slice(0,3).map((kind,index)=><div className="hb-rune-next" key={`${kind}-${index}`}><Preview kind={kind}/></div>)}</div><div className="hb-rune-side-card"><span>PROGRESSO DO NÍVEL</span><div className="hb-rune-level-progress"><i style={{width:`${game.lines%10*10}%`}} /></div><small>{game.lines%10}/10 linhas para o próximo nível</small></div></aside></div>
    <div className="hb-rune-touch-controls" role="group" aria-label="Controles do Queda Rúnica">{([['←','left'],['↻','rotate'],['→','right'],['↓','down'],['⤓','drop'],['◇','hold']] as const).map(([label,action])=><button key={action} type="button" disabled={paused||game.over} onClick={()=>dispatch(action)} aria-label={{left:'Mover para esquerda',right:'Mover para direita',rotate:'Girar peça',down:'Descer peça',drop:'Queda imediata',hold:'Reservar peça'}[action]}>{label}</button>)}</div>
    <button className="hb-mini-finish hb-mini-end-run" type="button" disabled={paused||game.over} onClick={finish}>✓ Encerrar e registrar {game.score.toLocaleString('pt-BR')} pontos</button>
  </div>
}
