import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { ArcadeGameProps } from './ArcadeCanvasGames'

/** Tempo de jogo real: começa na primeira ação e não conta períodos pausados. */
function useActiveTimer(running: boolean, paused: boolean) {
  const accumulatedMs = useRef(0)
  const start = useRef<number | null>(null)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running || paused) return
    start.current = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = accumulatedMs.current + (start.current === null ? 0 : Date.now() - start.current)
      setSeconds(Math.floor(elapsed / 1000))
    }, 250)
    return () => {
      window.clearInterval(timer)
      if (start.current !== null) accumulatedMs.current += Date.now() - start.current
      start.current = null
    }
  }, [running, paused])
  const readSeconds = () => Math.floor((accumulatedMs.current + (start.current === null ? 0 : Date.now() - start.current)) / 1000)
  return { seconds, readSeconds }
}

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
export function Game2048({ onFinish, paused = false }: ArcadeGameProps) {
  const [board, setBoard] = useState(() => spawnTile(spawnTile(Array(16).fill(0) as number[])))
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [moves, setMoves] = useState(0)
  const swipeStart = useRef<{x:number;y:number}|null>(null)
  const boardRef = useRef(board), scoreRef = useRef(0), ended = useRef(false)
  const play = useCallback((direction: Direction) => {
    if (ended.current || paused) return
    const outcome = move2048(boardRef.current, direction)
    if (!outcome.changed) return
    const next = spawnTile(outcome.board)
    boardRef.current = next
    scoreRef.current += outcome.points
    setScore(scoreRef.current); setBoard(next); setMoves(current => current + 1)
    // 2048 é apenas um marco; é possível continuar para 4096, 8192 e além.
    // A rodada só acaba por falta de movimentos (derrota) ou encerramento manual.
    if (!canMove2048(next)) { ended.current = true; setFinished(true); onFinish(scoreRef.current) }
  }, [onFinish, paused])
  useEffect(() => {
    const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select')) return
      const direction = keys[event.key]
      if (!paused && direction) { event.preventDefault(); play(direction) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [play, paused])
  const finish = () => { if (ended.current) return; ended.current = true; setFinished(true); onFinish(scoreRef.current) }
  const endSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start=swipeStart.current;swipeStart.current=null
    if(!start||paused)return
    const dx=event.clientX-start.x,dy=event.clientY-start.y
    if(Math.max(Math.abs(dx),Math.abs(dy))<25)return
    play(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))
  }
  const largestTile = Math.max(...board)
  return <div className="hb-mini-inner hb-puzzle hb-v207-game hb-v207-2048">
    <header className="hb-v207-scorebar" aria-label="Placar do 2048">
      <div className="hb-v207-score-primary"><span className="hb-v207-score-icon" aria-hidden="true">✦</span><div><small>PONTUAÇÃO</small><strong>{score.toLocaleString('pt-BR')}<em>pts</em></strong></div></div>
      <div className="hb-v207-score-stats"><div><small>MAIOR PEÇA</small><strong>{largestTile.toLocaleString('pt-BR')}</strong></div><div><small>MOVIMENTOS</small><strong>{moves.toLocaleString('pt-BR')}</strong></div></div>
    </header>
    <div className="hb-v207-board-frame hb-v207-2048-frame">
      <div className="hb-v207-board-heading"><span><i aria-hidden="true"/> FUSÃO NUMÉRICA</span><small>COMBINE AS PEÇAS · VÁ ALÉM DE 2048</small></div>
      <div className="hb-2048-board" role="grid" aria-label="Tabuleiro 2048, quatro por quatro" onPointerDown={event=>{swipeStart.current={x:event.clientX,y:event.clientY}}} onPointerUp={endSwipe} onPointerCancel={()=>{swipeStart.current=null}}>{board.map((tile, index) => <div role="gridcell" key={`${index}-${tile}`} className={`hb-2048-tile ${tile ? 'has-value' : ''}`} data-value={Math.min(tile, 2048)} data-high-tile={tile > 2048 ? 'true' : undefined} aria-label={tile ? `Peça ${tile}` : 'Espaço vazio'}>{tile ? tile.toLocaleString('pt-BR') : ''}</div>)}</div>
      <div className="hb-v207-board-foot"><span>✦ UNA NÚMEROS IGUAIS</span><span>SEM LIMITE DE VALOR</span></div>
    </div>
    <div className="hb-v207-controls"><p>Use as <kbd>setas</kbd>, <kbd>WASD</kbd> ou deslize para combinar peças</p><div className="hb-mini-pad hb-v207-direction-pad" role="group" aria-label="Controles do 2048"><button data-dir="up" type="button" aria-label="Cima" disabled={paused||finished} onClick={()=>play('up')}>↑</button><button data-dir="left" type="button" aria-label="Esquerda" disabled={paused||finished} onClick={()=>play('left')}>←</button><button data-dir="down" type="button" aria-label="Baixo" disabled={paused||finished} onClick={()=>play('down')}>↓</button><button data-dir="right" type="button" aria-label="Direita" disabled={paused||finished} onClick={()=>play('right')}>→</button></div></div>
    <button type="button" className="hb-mini-finish hb-mini-end-run hb-v207-end-button" disabled={paused||finished} onClick={finish}>✓ Encerrar e registrar {score.toLocaleString('pt-BR')} pontos</button>
  </div>
}

const MINE_SIZE = 9, MINE_TOTAL = 10
const minesForRound = (round: number) => Math.min(18, MINE_TOTAL + Math.floor((round - 1) / 2))
type MineCell = { mine: boolean; opened: boolean; flagged: boolean; adjacent: number }
const blankMineBoard = (): MineCell[] => Array.from({length: MINE_SIZE * MINE_SIZE}, () => ({mine: false, opened: false, flagged: false, adjacent: 0}))
const adjacentIndices = (index: number) => {
  const x = index % MINE_SIZE, y = Math.floor(index / MINE_SIZE)
  const result: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy
    if ((dx || dy) && nx >= 0 && nx < MINE_SIZE && ny >= 0 && ny < MINE_SIZE) result.push(ny * MINE_SIZE + nx)
  }
  return result
}
function mineBoard(firstSafe: number, mineTotal: number): MineCell[] {
  const cells = blankMineBoard()
  const available = Array.from({length: 81}, (_, i) => i).filter(i => i !== firstSafe && !adjacentIndices(firstSafe).includes(i))
  for (let i = 0; i < mineTotal; i++) { const pick = random(available.length); const position = available.splice(pick, 1)[0]; cells[position].mine = true }
  cells.forEach((cell, i) => { if (!cell.mine) cell.adjacent = adjacentIndices(i).filter(j => cells[j].mine).length })
  return cells
}
export function MinesweeperGame({ onFinish, paused = false }: ArcadeGameProps) {
  const [cells, setCells] = useState<MineCell[]>(blankMineBoard)
  const [flagsMode, setFlagsMode] = useState(false)
  const [message, setMessage] = useState('Descubra todas as casas seguras. A primeira jogada é protegida.')
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [betweenRounds, setBetweenRounds] = useState(false)
  const [ended, setEnded] = useState(false)
  const [running, setRunning] = useState(false)
  const { seconds: elapsed, readSeconds } = useActiveTimer(running, paused)
  const gridRef = useRef(cells), firstRef = useRef(true), finishedRef = useRef(false)
  const scoreRef = useRef(0), roundStartSeconds = useRef(0)
  const mineCount = minesForRound(round)

  // Passar de fase gera automaticamente outro campo sem zerar o recorde da partida.
  // A contagem é congelada durante uma pausa, inclusive entre rodadas.
  useEffect(() => {
    if (!betweenRounds || paused) return
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return
      const next = blankMineBoard()
      gridRef.current = next; setCells(next)
      firstRef.current = true
      setRound(current => current + 1)
      setFlagsMode(false)
      setMessage('Nova rodada! As minas aumentam aos poucos. Boa sorte!')
      setBetweenRounds(false)
    }, 950)
    return () => window.clearTimeout(timer)
  }, [betweenRounds, paused])

  const finish = () => {
    if (finishedRef.current || paused) return
    finishedRef.current = true; setEnded(true); setRunning(false)
    onFinish(scoreRef.current)
  }
  const play = (index: number, flag: boolean) => {
    if (finishedRef.current || betweenRounds || paused) return
    let next = gridRef.current.map(cell => ({ ...cell }))
    if (flag) { if (!next[index].opened) next[index].flagged = !next[index].flagged }
    else {
      if (next[index].flagged || next[index].opened) return
      if (firstRef.current) {
        // A primeira casa e todas as adjacentes estão seguras em cada novo campo.
        next = mineBoard(index, mineCount)
        firstRef.current = false
        roundStartSeconds.current = readSeconds()
        if (!running) setRunning(true)
      }
      if (next[index].mine) {
        next[index].opened = true
        next = next.map(c => c.mine ? { ...c, opened: true } : c)
        setMessage('Você encontrou uma mina. Fim de jogo!')
        finish()
      } else {
        const todo = [index], seen = new Set<number>()
        while (todo.length) {
          const i = todo.pop()!
          if (seen.has(i) || next[i].flagged || next[i].mine) continue
          seen.add(i); next[i].opened = true
          if (!next[i].adjacent) todo.push(...adjacentIndices(i))
        }
        if (next.filter(c => c.opened && !c.mine).length === 81 - mineCount) {
          const roundSeconds = Math.max(1, readSeconds() - roundStartSeconds.current)
          const earned = Math.max(150, 750 - roundSeconds * 5)
          scoreRef.current += earned; setScore(scoreRef.current)
          setMessage(`Campo ${round} limpo! +${earned} pontos. Preparando o próximo…`)
          setBetweenRounds(true)
        }
      }
    }
    gridRef.current = next; setCells(next)
  }
  const flags = cells.filter(c => c.flagged).length
  const safeOpened = cells.filter(c => c.opened && !c.mine).length
  const safeTotal = MINE_SIZE * MINE_SIZE - mineCount
  return <div className="hb-mini-inner hb-puzzle hb-mini-endless hb-v207-game hb-v207-mines">
    <header className="hb-v207-scorebar" aria-label="Placar do Campo Minado">
      <div className="hb-v207-score-primary"><span className="hb-v207-score-icon" aria-hidden="true">⚑</span><div><small>PONTUAÇÃO TOTAL</small><strong>{score.toLocaleString('pt-BR')}<em>pts</em></strong></div></div>
      <div className="hb-v207-score-stats"><div><small>RODADA</small><strong>{String(round).padStart(2, '0')}</strong></div><div><small>MINAS</small><strong>{mineCount - flags}</strong></div><div><small>TEMPO</small><strong>{elapsed}s</strong></div></div>
    </header>
    <div className="hb-v207-mines-panel">
      <div className="hb-v207-mines-status"><span>CASAS SEGURAS <b>{safeOpened}/{safeTotal}</b></span><div className="hb-v207-mines-progress" role="progressbar" aria-label="Casas seguras abertas" aria-valuenow={safeOpened} aria-valuemin={0} aria-valuemax={safeTotal}><span style={{ width: `${safeOpened / safeTotal * 100}%` }}/></div></div>
      <div className="hb-v207-mine-modes" role="group" aria-label="Ferramenta de marcação"><button type="button" className={!flagsMode ? 'is-active' : ''} aria-pressed={!flagsMode} disabled={paused || ended || betweenRounds} onClick={() => setFlagsMode(false)}>⌖ <span>Revelar</span></button><button type="button" className={flagsMode ? 'is-active' : ''} aria-pressed={flagsMode} disabled={paused || ended || betweenRounds} onClick={() => setFlagsMode(true)}>🚩 <span>Bandeira</span></button></div>
    </div>
    <div className="hb-v207-board-frame hb-v207-mines-frame">
      <div className="hb-v207-board-heading"><span><i aria-hidden="true"/> CAMPO DE EXPLORAÇÃO</span><small>9 × 9 · PRIMEIRO CLIQUE SEGURO</small></div>
      <div className="hb-mine-board" role="grid" aria-label={`Campo Minado, rodada ${round}, tabuleiro 9 por 9`}>{cells.map((cell, i) => <button type="button" role="gridcell" disabled={paused || ended || betweenRounds} key={i} className={`${cell.opened ? 'opened' : ''} ${cell.opened && cell.mine ? 'mine' : ''} ${cell.flagged ? 'flagged' : ''}`} data-adjacent={cell.adjacent} onClick={() => play(i, flagsMode)} onContextMenu={(event: ReactMouseEvent) => { event.preventDefault(); play(i, true) }} aria-label={`Casa ${i + 1}: ${cell.opened ? cell.mine ? 'mina' : cell.adjacent + ' minas próximas' : cell.flagged ? 'bandeira' : 'fechada'}`}>{cell.opened ? cell.mine ? '💥' : cell.adjacent || '' : cell.flagged ? '🚩' : ''}</button>)}</div>
      <div className="hb-v207-board-foot"><span>⌖ CLIQUE PARA REVELAR</span><span>🚩 CLIQUE DIREITO PARA MARCAR</span></div>
    </div>
    <p className="hb-v207-mine-message" role="status">{message}</p>
    {betweenRounds && <p className="hb-mini-next-notice" role="status">✦ Campo concluído! Sua pontuação continua na próxima rodada.</p>}
    <button type="button" className="hb-mini-finish hb-mini-end-run hb-v207-end-button" disabled={paused || ended} onClick={finish}>✓ Encerrar e registrar {score.toLocaleString('pt-BR')} pontos</button>
  </div>
}

const RUNES=['✦','☽','♜','⚔','❖','♢','☀','✺']
type MemoryCard={id:number;rune:string;open:boolean;matched:boolean}
function shuffle<T>(values:T[]):T[]{const list=[...values];for(let i=list.length-1;i>0;i--){const j=random(i+1);[list[i],list[j]]=[list[j],list[i]]}return list}
export function MemoryGame({ onFinish, paused = false }: ArcadeGameProps) {
  const freshCards = () => shuffle([...RUNES, ...RUNES].map((rune, id) => ({ id, rune, open: false, matched: false })))
  const [cards, setCards] = useState<MemoryCard[]>(freshCards)
  const [moves, setMoves] = useState(0), [matches, setMatches] = useState(0)
  const [combo, setCombo] = useState(0), [bestCombo, setBestCombo] = useState(0)
  const comboRef = useRef(0)
  const [score, setScore] = useState(0), [round, setRound] = useState(1)
  const [betweenRounds, setBetweenRounds] = useState(false)
  const [notice, setNotice] = useState('Encontre os pares para avançar à próxima rodada.')
  const [running, setRunning] = useState(false)
  const { seconds: elapsed, readSeconds } = useActiveTimer(running, paused)
  const cardsRef = useRef(cards), selected = useRef<number[]>([]), locked = useRef(false), finished = useRef(false), timerRef = useRef<number | null>(null)
  const mismatch = useRef<{ a: number; b: number; remaining: number; started: number } | null>(null)
  const movesRef = useRef(0), scoreRef = useRef(0), roundStartSeconds = useRef(0)
  const closeMismatch = () => {
    const pair = mismatch.current
    if (!pair) return
    const nextCards = cardsRef.current.map(c => c.id === pair.a || c.id === pair.b ? { ...c, open: false } : c)
    cardsRef.current = nextCards; setCards(nextCards); selected.current = []; locked.current = false; mismatch.current = null; timerRef.current = null
  }
  useEffect(() => {
    if (paused) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      if (mismatch.current) mismatch.current.remaining = Math.max(50, mismatch.current.remaining - (Date.now() - mismatch.current.started))
    } else if (mismatch.current && timerRef.current === null) {
      mismatch.current.started = Date.now()
      timerRef.current = window.setTimeout(closeMismatch, mismatch.current.remaining)
    }
  }, [paused]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current) }, [])
  useEffect(() => {
    if (!betweenRounds || paused) return
    const timer = window.setTimeout(() => {
      if (finished.current) return
      const next = freshCards()
      cardsRef.current = next; setCards(next)
      selected.current = []; locked.current = false
      movesRef.current = 0; setMoves(0); setMatches(0); comboRef.current = 0; setCombo(0)
      setRound(current => current + 1)
      setBetweenRounds(false)
      setNotice('Nova rodada! Continue combinando runas para somar pontos.')
    }, 1150)
    return () => clearTimeout(timer)
  }, [betweenRounds, paused])
  const finish = () => {
    if (paused || finished.current) return
    finished.current = true
    setRunning(false)
    onFinish(scoreRef.current)
  }
  const reveal = (id: number) => {
    if (paused || locked.current || finished.current || selected.current.includes(id)) return
    const item = cardsRef.current.find(c => c.id === id)
    if (!item || item.matched) return
    if (!running) setRunning(true)
    if (movesRef.current === 0 && selected.current.length === 0 && cardsRef.current.every(c => !c.open && !c.matched)) roundStartSeconds.current = readSeconds()
    const next = cardsRef.current.map(c => c.id === id ? { ...c, open: true } : c)
    cardsRef.current = next; setCards(next); selected.current.push(id)
    if (selected.current.length === 2) {
      const [a, b] = selected.current
      const first = next.find(c => c.id === a)!, second = next.find(c => c.id === b)!
      const nextMoves = movesRef.current + 1
      movesRef.current = nextMoves; setMoves(nextMoves)
      if (first.rune === second.rune) {
        comboRef.current += 1; setCombo(comboRef.current)
        setBestCombo(current => Math.max(current, comboRef.current))
        const completed = next.map(c => c.id === a || c.id === b ? { ...c, matched: true } : c)
        cardsRef.current = completed; setCards(completed); selected.current = []
        const count = completed.filter(c => c.matched).length / 2
        setMatches(count)
        if (count === RUNES.length) {
          const roundSeconds = Math.max(1, readSeconds() - roundStartSeconds.current)
          const earned = Math.max(100, 800 - nextMoves * 22 - roundSeconds * 4)
          scoreRef.current += earned; setScore(scoreRef.current)
          locked.current = true
          setNotice(`Rodada ${round} completa! +${earned} pontos. Embaralhando novas runas…`)
          setBetweenRounds(true)
        }
      } else {
        comboRef.current = 0; setCombo(0)
        locked.current = true
        mismatch.current = { a, b, remaining: 720, started: Date.now() }
        timerRef.current = window.setTimeout(closeMismatch, 720)
      }
    }
  }
  const accuracy = moves > 0 ? Math.round(matches / moves * 100) : 100
  return <div className="hb-mini-inner hb-puzzle hb-mini-endless hb-v208-memory">
    <header className="hb-v208-memory-hud">
      <div className="hb-v208-memory-main"><span className="hb-v208-memory-icon" aria-hidden="true">🔮</span><div><small>PONTUAÇÃO TOTAL</small><strong>{score.toLocaleString('pt-BR')} <em>pts</em></strong></div></div>
      <div className="hb-v208-memory-stats"><div><small>RODADA</small><strong>{String(round).padStart(2,'0')}</strong></div><div><small>PARES</small><strong>{matches}/{RUNES.length}</strong></div><div><small>ACERTOS</small><strong>{accuracy}%</strong></div><div><small>SEQUÊNCIA</small><strong>{combo} ✦</strong></div></div>
    </header>
    <section className="hb-v208-memory-frame" aria-label="Tabuleiro rúnico">
      <div className="hb-v208-memory-heading"><span><i aria-hidden="true"/> CÂMARA DAS RUNAS</span><small>⏱ {elapsed}s · {moves} tentativas</small></div>
      <div className="hb-v208-memory-progress" aria-label={`${matches} de ${RUNES.length} pares encontrados`}><span style={{width:`${matches/RUNES.length*100}%`}} /></div>
      <div className="hb-memory-board hb-v208-memory-board" role="grid" aria-label={`Memória Arcana, rodada ${round}, 16 cartas`}>{cards.map(card => <button type="button" role="gridcell" disabled={paused || finished.current || betweenRounds || card.matched} key={card.id} className={`hb-v208-memory-card ${card.open || card.matched ? 'revealed' : ''} ${card.matched ? 'matched' : ''}`} onClick={() => reveal(card.id)} aria-label={card.open || card.matched ? `Runa ${card.rune}` : 'Carta virada para baixo'}><span className="hb-v208-memory-card-inner"><span className="hb-v208-memory-card-back" aria-hidden="true">✧</span><span className="hb-v208-memory-card-front" aria-hidden="true">{card.rune}</span></span></button>)}</div>
      <div className="hb-v208-memory-bottom"><span>✦ COMBINE DUAS RUNAS IGUAIS</span><span>MELHOR SEQUÊNCIA · {bestCombo}</span></div>
    </section>
    <p className="hb-v208-memory-notice" role="status">{notice}</p>
    <button type="button" className="hb-mini-finish hb-mini-end-run" disabled={paused || finished.current} onClick={finish}>✓ Encerrar e registrar {score.toLocaleString('pt-BR')} pontos</button>
  </div>
}
