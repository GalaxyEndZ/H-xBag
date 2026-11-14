import { useState, type FormEvent } from 'react'
import './DiceTower.css'

type NormalRoll = {
  id: number
  quantity: number
  faces: number
  modifier: number
  values: number[]
  subtotal: number
  total: number
  time: string
}

const MAX_DICE = 100
const MAX_FACES = 1_000_000
const MAX_MODIFIER = 1_000_000
const QUICK_FACES = [4, 6, 8, 10, 12, 20, 100]

const signed = (value: number) => value > 0 ? `+${value}` : String(value)
const isIntegerInRange = (n: number, low: number, high: number) =>
  Number.isSafeInteger(n) && n >= low && n <= high

/** Sorteio uniforme por rejeição quando a API de aleatoriedade segura está disponível. */
function rollOneDie(faces: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bucket = new Uint32Array(1)
    const range = 2 ** 32
    const threshold = range - (range % faces)
    do { crypto.getRandomValues(bucket) } while (bucket[0] >= threshold)
    return (bucket[0] % faces) + 1
  }
  return Math.floor(Math.random() * faces) + 1
}

export default function DiceTower() {
  const [quantity, setQuantity] = useState('1')
  const [faces, setFaces] = useState('20')
  const [modifier, setModifier] = useState('0')
  const [rolls, setRolls] = useState<NormalRoll[]>([])

  const amount = Number(quantity)
  const sides = Number(faces)
  const bonus = modifier.trim() === '' ? 0 : Number(modifier)
  const validAmount = quantity.trim() !== '' && isIntegerInRange(amount, 1, MAX_DICE)
  const validFaces = faces.trim() !== '' && isIntegerInRange(sides, 2, MAX_FACES)
  const validModifier = modifier.trim() === '' || isIntegerInRange(bonus, -MAX_MODIFIER, MAX_MODIFIER)
  const valid = validAmount && validFaces && validModifier
  const latest = rolls[0]

  function roll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    const values = Array.from({ length: amount }, () => rollOneDie(sides))
    const subtotal = values.reduce((total, die) => total + die, 0)
    const now = new Date()
    setRolls(previous => [{
      id: now.getTime() + Math.random(),
      quantity: amount,
      faces: sides,
      modifier: bonus,
      values,
      subtotal,
      total: subtotal + bonus,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...previous].slice(0, 20))
  }

  return <main className="hdt" aria-label="Torre de Dados">
    <header className="hdt-hero">
      <div className="hdt-hero-symbol" aria-hidden="true">✧</div>
      <div className="hdt-hero-copy">
        <span className="hdt-eyebrow">HÄXBAG · FERRAMENTAS DE MESA</span>
        <h1>Torre de Dados</h1>
        <p>Role dados livremente para a sua sessão. Escolha quantos dados usar, o número de faces e um modificador opcional.</p>
      </div>
      <div className="hdt-hero-mark" aria-hidden="true">🎲</div>
    </header>

    <div className="hdt-columns">
      <section className="hdt-panel hdt-editor" aria-labelledby="hdt-normal-title">
        <div className="hdt-panel-heading">
          <span className="hdt-panel-icon" aria-hidden="true">◇</span>
          <div><span className="hdt-eyebrow">CATEGORIA 01</span><h2 id="hdt-normal-title">Dados normais</h2>
          <p>Configuração livre de rolagens, sem restrição a dados predefinidos.</p></div>
        </div>
        <form onSubmit={roll} noValidate>
          <div className="hdt-fields">
            <label htmlFor="hdt-quantity">Quantidade de dados
              <input id="hdt-quantity" type="number" inputMode="numeric" min="1" max={MAX_DICE} step="1" value={quantity} onChange={event => setQuantity(event.target.value)} aria-invalid={!validAmount} />
              <small>De 1 a {MAX_DICE} dados</small>
            </label>
            <label htmlFor="hdt-faces">Quantidade de lados
              <input id="hdt-faces" type="number" inputMode="numeric" min="2" max={MAX_FACES} step="1" value={faces} onChange={event => setFaces(event.target.value)} aria-invalid={!validFaces} />
              <small>Escolha qualquer número de 2 até 1.000.000</small>
            </label>
            <label htmlFor="hdt-modifier">Modificador
              <input id="hdt-modifier" type="number" inputMode="numeric" min={-MAX_MODIFIER} max={MAX_MODIFIER} step="1" value={modifier} placeholder="0" onChange={event => setModifier(event.target.value)} aria-invalid={!validModifier} />
              <small>Valor positivo, negativo ou zero</small>
            </label>
          </div>
          <div className="hdt-presets" aria-label="Atalhos para faces dos dados">
            <span>Atalhos</span>
            {QUICK_FACES.map(value => <button type="button" key={value} className={sides === value ? 'selected' : ''} aria-pressed={sides === value} onClick={() => setFaces(String(value))}>d{value}</button>)}
          </div>
          <div className="hdt-roll-action">
            <div className="hdt-formula-preview">
              <small>Expressão</small>
              <strong>{validAmount ? amount : '?'}d{validFaces ? sides : '?'} {validModifier && bonus !== 0 ? signed(bonus) : ''}</strong>
            </div>
            <button className="hdt-roll-button" type="submit" disabled={!valid}>🎲 Rolar dados</button>
          </div>
          {!valid && <p role="alert" className="hdt-validation">Confira os valores: quantidade entre 1–{MAX_DICE}, lados entre 2–{MAX_FACES} e modificador inteiro entre −{MAX_MODIFIER.toLocaleString('pt-BR')} e +{MAX_MODIFIER.toLocaleString('pt-BR')}.</p>}
        </form>
      </section>

      <section className="hdt-panel hdt-result" aria-labelledby="hdt-result-title">
        <div className="hdt-panel-heading">
          <span className="hdt-panel-icon" aria-hidden="true">✦</span>
          <div><span className="hdt-eyebrow">RESULTADO</span><h2 id="hdt-result-title">Última rolagem</h2><p>Veja o resultado individual de cada dado e o modificador aplicado.</p></div>
        </div>
        {latest ? <div className="hdt-result-body" aria-live="polite" aria-atomic="true">
          <div className="hdt-result-total"><span>TOTAL</span><strong>{latest.total.toLocaleString('pt-BR')}</strong><small>{latest.quantity}d{latest.faces}{latest.modifier !== 0 ? ` ${signed(latest.modifier)}` : ''}</small></div>
          <div className="hdt-result-breakdown"><span>Resultados individuais</span><div className="hdt-dice-list">{latest.values.map((value, index) => <span key={`${latest.id}:${index}`} className="hdt-die" title={`Dado ${index + 1}: ${value}`}>{value}</span>)}</div></div>
          <div className="hdt-sum-row"><span>Soma dos dados</span><strong>{latest.subtotal.toLocaleString('pt-BR')}</strong></div>
          <div className="hdt-sum-row"><span>Modificador</span><strong>{signed(latest.modifier)}</strong></div>
          <div className="hdt-sum-row hdt-grand-total"><span>Resultado final</span><strong>{latest.total.toLocaleString('pt-BR')}</strong></div>
        </div> : <div className="hdt-empty-result"><div aria-hidden="true">⚄</div><strong>Nenhuma rolagem ainda</strong><span>Configure seus dados e clique em “Rolar dados”.</span></div>}
      </section>
    </div>

    <section className="hdt-panel hdt-history" aria-labelledby="hdt-history-title">
      <div className="hdt-history-heading"><div><span className="hdt-eyebrow">NESTA SESSÃO</span><h2 id="hdt-history-title">Histórico de rolagens</h2></div><button type="button" disabled={!rolls.length} onClick={() => setRolls([])}>Limpar histórico</button></div>
      {rolls.length ? <ol className="hdt-history-list">{rolls.map(item => <li key={item.id}>
        <span className="hdt-history-expression">{item.quantity}d{item.faces} {item.modifier !== 0 ? signed(item.modifier) : ''}</span>
        <span className="hdt-history-details">[{item.values.join(', ')}] = {item.subtotal}{item.modifier !== 0 ? ` ${signed(item.modifier)}` : ''}</span>
        <strong>{item.total.toLocaleString('pt-BR')}</strong>
        <time>{item.time}</time>
      </li>)}</ol> : <p className="hdt-history-empty">As próximas rolagens aparecerão aqui. O histórico é temporário e não altera fichas ou campanhas.</p>}
    </section>
  </main>
}
