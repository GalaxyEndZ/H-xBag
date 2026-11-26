import { useMemo, useRef, useState } from 'react'
import { getCriticalBonus, rollCriticalBonus, parseWeaponDice, type CriticalFormClass } from '../combatCriticalRules'
import { BREATHING_DAMAGE, BREATHING_TIER_LABEL, parseDamageExpression, rollDamageExpression, type BreathingKind, type BreathingTier } from '../damageRollRulesV274'
import '../CombatDamageV274.css'

type DamageMode = 'pure' | 'breathing'
type DamagePart = { title: string; formula: string; total: number; detail: string }
type RollResult = { total: number; parts: DamagePart[]; critical: boolean; modeLabel: string; paidPR?: number; previousPR?: number }

type Props = {
  id: string
  baseFormula: string
  weaponFormula: string
  weaponName?: string
  kitBonus: number
  dragonStrength: boolean
  corvoStrength: boolean
  criticalThreshold: number
  mode: DamageMode
  onModeChange: (mode: DamageMode) => void
  tier: BreathingTier
  onTierChange: (tier: BreathingTier) => void
  currentPR: number
  resourceLabel: string
  canSpendPR: boolean
  onSpendPR: (cost: number) => Promise<boolean>
}

/** Rola exclusivamente dano causado. Formas descontam PR uma única vez antes de lançar os dados. */
export default function CombatDamageRollerV274({ id, baseFormula, weaponFormula, weaponName, kitBonus, dragonStrength, corvoStrength, criticalThreshold, mode, onModeChange, tier, onTierChange, currentPR, resourceLabel, canSpendPR, onSpendPR }: Props) {
  const [kind, setKind] = useState<BreathingKind>('ofensiva')
  const [customForm, setCustomForm] = useState('')
  const [extraBonus, setExtraBonus] = useState('0')
  const [costInput, setCostInput] = useState('')
  const [critical, setCritical] = useState(false)
  const [result, setResult] = useState<RollResult | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rollingRef = useRef(false)

  const formPreset = BREATHING_DAMAGE[tier][kind]
  const formFormula = customForm.trim() || formPreset
  const base = baseFormula === '—' ? '' : baseFormula.trim()
  const weapon = weaponFormula === '—' ? '' : weaponFormula.trim()
  const baseDie = useMemo(() => parseWeaponDice(base)?.sides ?? null, [base])
  const dragonDice = dragonStrength && baseDie ? `2d${baseDie}` : ''
  const corvoUnspecified = mode === 'breathing' && tier === 'corvo'
  const criticalClass: CriticalFormClass = mode === 'breathing' && !corvoUnspecified ? tier as CriticalFormClass : 'none'
  const criticalPreview = !corvoUnspecified ? getCriticalBonus({form:criticalClass,weaponFormula:weapon,corvoStrength}) : null
  const manualBonus = /^[-+]?\d+$/.test(extraBonus.trim()) ? Number(extraBonus) : NaN
  const bonusValid = Number.isSafeInteger(manualBonus) && Math.abs(manualBonus) <= 100000
  const baseValid = Boolean(parseDamageExpression(base))
  const weaponValid = !weapon || Boolean(parseDamageExpression(weapon))
  const formValid = mode === 'pure' || Boolean(parseDamageExpression(formFormula))
  const costValid = /^\d+$/.test(costInput.trim()) && Number.isSafeInteger(Number(costInput)) && Number(costInput) > 0
  const cost = costValid ? Number(costInput) : 0
  const enoughPR = costValid && Number.isFinite(currentPR) && cost <= currentPR
  const canRoll = baseValid && weaponValid && formValid && bonusValid && !saving &&
    (mode === 'pure' || (costValid && enoughPR && canSpendPR))

  const changeMode = (next: DamageMode) => {
    if (saving) return
    onModeChange(next)
    setCostInput('')
    setResult(null)
    setError('')
    setCritical(false)
  }
  const changeTier = (next: BreathingTier) => {
    if (saving) return
    onTierChange(next)
    setCustomForm('')
    setCostInput('')
    setResult(null)
    setError('')
  }
  const changeKind = (next: BreathingKind) => {
    if (saving) return
    setKind(next)
    setCustomForm('')
    setCostInput('')
    setResult(null)
    setError('')
  }

  const roll = async () => {
    if (rollingRef.current) return
    if (!canRoll) {
      setError('Verifique o dano e, para Formas de Respiração, informe um custo de PR válido que não ultrapasse o saldo atual.')
      return
    }
    rollingRef.current = true
    setSaving(true)
    setError('')
    setResult(null)
    try {
      // A rolagem acontece apenas depois de confirmar a persistência da despesa.
      if (mode === 'breathing') {
        const saved = await onSpendPR(cost)
        if (!saved) {
          setError(`Não foi possível descontar ${cost} ${resourceLabel}. Nenhum dano foi rolado; confira seu saldo e a conexão.`)
          return
        }
      }
      const parts: DamagePart[] = []
      const add = (title: string, expression: string) => {
        const rolled = rollDamageExpression(expression)
        if (!rolled) return false
        const diceText = rolled.dice.map(group=>`${group.values.length}d${group.sides} [${group.values.join(', ')}]`).join(' + ')
        const detail = [diceText, rolled.modifier ? `${rolled.modifier > 0 ? '+' : ''}${rolled.modifier}` : ''].filter(Boolean).join(' ')
        parts.push({title, formula:expression, total:rolled.total, detail:detail || String(rolled.total)})
        return true
      }
      add('Dano base', base)
      if (weapon) add(weaponName ? `Arma · ${weaponName}` : 'Arma equipada', weapon)
      if (mode === 'breathing') add(`Forma ${BREATHING_TIER_LABEL[tier]} · ${kind}`, formFormula)
      if (kitBonus > 0) add('Kit equipado', String(Math.floor(kitBonus)))
      if (dragonDice) add('Fluxo · Ímpeto Certeiro', dragonDice)
      if (corvoStrength) add('Fluxo · Guerreiro Insuperável', '10')
      if (manualBonus !== 0) add('Modificador adicional', String(manualBonus))
      if (critical && criticalPreview?.formula) {
        const crit = rollCriticalBonus({form:criticalClass,weaponFormula:weapon,corvoStrength})
        if (crit.total !== null) parts.push({title:'Crítico confirmado', formula:crit.formula || '',total:crit.total,detail:`[${crit.rolls.join(', ')}]`})
      }
      setResult({
        total: Math.max(0,parts.reduce((sum,part)=>sum+part.total,0)),
        parts, critical,
        modeLabel: mode === 'pure' ? 'Dano puro' : `Forma ${BREATHING_TIER_LABEL[tier]} · ${kind}`,
        paidPR: mode === 'breathing' ? cost : undefined,
        previousPR: mode === 'breathing' ? currentPR : undefined,
      })
    } catch {
      setError('Falha ao salvar o consumo de PR. A rolagem foi cancelada para evitar gasto ou dano duplicado.')
    } finally {
      rollingRef.current = false
      setSaving(false)
    }
  }

  return <section className="hb-damage-roll-v274" id={id} aria-label="Rolagem de dano causado">
    <div className="hb-damage-roll-v274-heading">
      <div><span className="combat-eyebrow">ROLAGEM OFENSIVA</span><h3>⚔ Dano</h3><p>Role o dano que você causa. O dano puro não consome PR; uma Forma de Respiração desconta o custo informado antes da rolagem. Nenhum PV ou PS é alterado.</p></div>
      <span className="hb-damage-roll-v274-label">DANO CAUSADO</span>
    </div>
    <div className="hb-damage-roll-v274-modes" role="group" aria-label="Modo de dano">
      <button type="button" disabled={saving} aria-pressed={mode==='pure'} className={mode==='pure'?'is-selected':''} onClick={()=>changeMode('pure')}>⚔ Dano puro</button>
      <button type="button" disabled={saving} aria-pressed={mode==='breathing'} className={mode==='breathing'?'is-selected':''} onClick={()=>changeMode('breathing')}>✦ Forma de Respiração</button>
    </div>
    {mode === 'breathing' && <>
      <div className="hb-damage-roll-v274-form">
        <label>Classificação<select disabled={saving} value={tier} onChange={event=>changeTier(event.target.value as BreathingTier)}>{(Object.keys(BREATHING_TIER_LABEL) as BreathingTier[]).map(key=><option value={key} key={key}>{BREATHING_TIER_LABEL[key]}</option>)}</select></label>
        <label>Tipo de forma<select disabled={saving} value={kind} onChange={event=>changeKind(event.target.value as BreathingKind)}><option value="defensiva">Defensiva</option><option value="ofensiva">Ofensiva</option><option value="destrutiva">Destrutiva</option></select></label>
        <label>Dados adicionais da forma<input disabled={saving} aria-label="Fórmula de dano da forma" spellCheck={false} value={customForm || formPreset} onChange={event=>{setCustomForm(event.target.value);setResult(null)}} placeholder="Ex.: 2d6+4" /></label>
        <p className="hb-damage-roll-v274-helper">A classificação escolhida aqui também determina o bônus crítico mostrado na aba Ações. A fórmula pode ser ajustada para técnicas especiais, sem repetir o dano base. Formas Carpa de cura, suporte ou controle não são ataques físicos diretos.</p>
      </div>
      <div className="hb-damage-roll-v274-pr">
        <div className="hb-damage-roll-v274-pr-balance"><small>{resourceLabel} disponível</small><strong>{currentPR}</strong><span>A despesa é registrada na própria ficha.</span></div>
        <label>Custo de {resourceLabel} da forma
          <input type="number" min="1" step="1" inputMode="numeric" disabled={saving} value={costInput} onChange={event=>{setCostInput(event.target.value);setError('');setResult(null)}} placeholder="Informe o custo" aria-describedby={`${id}-pr-hint`} />
        </label>
        <div className="hb-damage-roll-v274-pr-after" id={`${id}-pr-hint`}><small>Saldo após a forma</small><strong>{costValid && enoughPR ? currentPR-cost : '—'}</strong><span>{!canSpendPR ? 'Somente quem pode editar a ficha pode gastar PR.' : !costInput.trim() ? 'Informe o custo para liberar a rolagem.' : !costValid ? 'Digite um valor inteiro maior que zero.' : !enoughPR ? `Saldo insuficiente de ${resourceLabel}.` : 'O saldo será descontado automaticamente ao rolar.'}</span></div>
      </div>
    </>}
    <div className="hb-damage-roll-v274-parts" aria-label="Componentes da rolagem">
      <div><small>Dano base · graduação</small><strong>{base || 'Não definido'}</strong></div>
      <div><small>Arma equipada</small><strong>{weapon || 'Sem arma'}</strong></div>
      <div><small>Bônus do kit</small><strong>+{Math.max(0,Math.floor(kitBonus))}</strong></div>
      {mode==='breathing' && <div><small>Forma escolhida</small><strong>{formFormula}</strong></div>}
      {dragonStrength && <div><small>Ímpeto Certeiro</small><strong>{dragonDice ? `+${dragonDice}` : 'Sem dado base'}</strong></div>}
      {corvoStrength && <div><small>Guerreiro Insuperável</small><strong>+10</strong></div>}
    </div>
    <div className="hb-damage-roll-v274-controls">
      <label>Bônus ou penalidade situacional<input type="number" inputMode="numeric" step="1" disabled={saving} value={extraBonus} onChange={event=>{setExtraBonus(event.target.value);setResult(null)}} /></label>
      <label className="hb-damage-roll-v274-crit"><input type="checkbox" disabled={saving} checked={critical} onChange={event=>{setCritical(event.target.checked);setResult(null)}} /><span><strong>Acerto crítico confirmado</strong><small>Marque apenas depois de confirmar o acerto na aba Ações · margem {criticalThreshold}+.</small></span></label>
    </div>
    {critical && <p className="hb-damage-roll-v274-helper">{corvoUnspecified ? 'O bônus crítico específico das formas Corvo ainda não foi definido: nenhum dado extra da classe será inventado.' : criticalPreview?.formula ? `Dano extra de crítico com a arma: ${criticalPreview.formula}.` : 'Sem dados de arma definidos, a rolagem normal ainda é possível.'}</p>}
    <button type="button" className="hb-damage-roll-v274-submit" disabled={!canRoll} onClick={()=>{void roll()}}>{saving ? 'Salvando custo de PR…' : mode === 'pure' ? '🎲 Rolar dano puro' : `🎲 Gastar ${costValid ? cost : '—'} ${resourceLabel} e rolar dano`}</button>
    {!canRoll && !saving && <p className="hb-damage-roll-v274-error" role="status">{!baseValid ? 'A graduação não possui uma fórmula de dano base válida.' : !weaponValid ? 'A arma equipada possui uma fórmula inválida.' : !formValid ? 'A fórmula da forma é inválida.' : !bonusValid ? 'O modificador adicional deve ser um inteiro.' : mode === 'breathing' && !canSpendPR ? 'Você não tem permissão para gastar PR nesta ficha.' : mode === 'breathing' && !costValid ? `Informe o custo de ${resourceLabel} para esta forma.` : mode === 'breathing' && !enoughPR ? `${resourceLabel} insuficiente para esta forma.` : ''}</p>}
    {error && <p className="hb-damage-roll-v274-error" role="alert">{error}</p>}
    {result && <div className="hb-damage-roll-v274-result" role="status" aria-live="polite"><div className="hb-damage-roll-v274-result-top"><span>{result.modeLabel}{result.critical ? ' · Crítico' : ''}</span><strong>{result.total} <small>de dano</small></strong></div>{result.paidPR !== undefined && <p className="hb-damage-roll-v274-pr-receipt">{result.paidPR} {resourceLabel} consumidos · {result.previousPR} → {(result.previousPR ?? 0)-result.paidPR} {resourceLabel} restantes</p>}<div className="hb-damage-roll-v274-result-list">{result.parts.map((part,index)=><div key={`${index}-${part.title}`}><span><b>{part.title}</b><small>{part.formula} · {part.detail}</small></span><strong>{part.total > 0 ? '+' : ''}{part.total}</strong></div>)}</div><small className="hb-damage-roll-v274-helper">Resultado apenas informativo: o mestre ou o alvo aplica resistências e reduções separadamente.</small></div>}
  </section>
}
