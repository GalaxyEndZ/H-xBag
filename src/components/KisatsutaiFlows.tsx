import { useState } from 'react'
import {
  FLOW_ATTRIBUTES,
  FLOW_ATTRIBUTE_LABELS,
  FLOW_CHOICES,
  FLOW_TIER_LABELS,
  FLOW_TIER_RANKS,
  FLOW_TIERS,
  getEligibleFlowAttributes,
  getUnlockedFlowTiers,
  type FlowAttribute,
  type FlowSelections,
  type FlowTier,
} from '../systems/kisatsutai/flowRules'
import './KisatsutaiFlows.css'

type Props = {
  group: string
  values: Record<FlowAttribute, number>
  selections: FlowSelections
  editable: boolean
  onSelect: (tier: FlowTier, attribute: FlowAttribute | '') => void
}

type FocusedNode = { tier: FlowTier; attribute: FlowAttribute }

/**
 * V269 — Fluxos em trilha horizontal: a graduação progride da esquerda para
 * a direita e cada atributo é uma alternativa, não um pré-requisito.
 * A geometria SVG é relativa à área desktop. Em telas compactas, a interface
 * vira seções de cartões e as conexões do desktop são ocultadas.
 */
const MAP_WIDTH = 1200
const MAP_HEIGHT = 770
const TIER_X = [150, 450, 750, 1050] as const
const ATTRIBUTE_Y = [208, 326, 444, 562, 680] as const
const NODE_HALF_WIDTH = 109

const ATTRIBUTE_SYMBOLS: Record<FlowAttribute, string> = {
  strength: '✦', agility: '➶', defense: '⬡', breathing: '❖', intellect: '✧',
}
const TIER_SYMBOLS: Record<FlowTier, string> = {
  raposa: '✧', tigre: '♜', dragao: '◇', corvo: '✦',
}
const REQUIRED_RANKING: Record<FlowTier, string> = {
  raposa: '4 atributos mais altos',
  tigre: '3 atributos mais altos',
  dragao: '2 atributos mais altos',
  corvo: 'atributo mais alto',
}
const RANK_SHORT: Record<FlowTier, string> = {
  raposa: 'Top 4 atributos',
  tigre: 'Top 3 atributos',
  dragao: 'Top 2 atributos',
  corvo: 'Maior atributo',
}

function drawLink(fromTier: FlowTier, from: FlowAttribute, to: FlowAttribute): string {
  const index = FLOW_TIERS.indexOf(fromTier)
  const x1 = TIER_X[index] + NODE_HALF_WIDTH
  const y1 = ATTRIBUTE_Y[FLOW_ATTRIBUTES.indexOf(from)]
  const x2 = TIER_X[index + 1] - NODE_HALF_WIDTH
  const y2 = ATTRIBUTE_Y[FLOW_ATTRIBUTES.indexOf(to)]
  const bend = Math.max(20, (x2 - x1) * .55)
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
}

export default function KisatsutaiFlows({ group, values, selections, editable, onSelect }: Props) {
  const unlocked = getUnlockedFlowTiers(group)
  const [focused, setFocused] = useState<FocusedNode>(() => {
    const lastSelected = [...FLOW_TIERS].reverse().find(tier => Boolean(selections[tier]))
    const tier = lastSelected ?? 'raposa'
    return { tier, attribute: selections[tier] ?? 'strength' }
  })

  const focusedChoice = FLOW_CHOICES[focused.tier][focused.attribute]
  const focusTierUnlocked = unlocked.includes(focused.tier)
  const focusEligible = getEligibleFlowAttributes(focused.tier, values).includes(focused.attribute)
  const isFocusedChoice = selections[focused.tier] === focused.attribute
  const canLearn = editable && focusTierUnlocked && (focusEligible || isFocusedChoice)
  const chosenCount = unlocked.filter(tier => Boolean(selections[tier])).length

  const selectStage = (tier: FlowTier) => {
    setFocused({
      tier,
      attribute: selections[tier] ?? getEligibleFlowAttributes(tier, values)[0] ?? 'strength',
    })
  }

  return <section className="hb-flows hb-flow-tree" aria-label="Árvore de Fluxos de Atributo do Kisatsutai">
    <header className="hb-flows-header">
      <div className="hb-flow-hero">
        <span className="hb-flow-hero-mark" aria-hidden="true">✦</span>
        <div>
          <span className="hb-flows-eyebrow">Kisatsutai · Progressão do caçador</span>
          <h3>Árvore de Fluxos</h3>
          <p>Escolha um Fluxo por graduação. A trilha conecta suas escolhas, mesmo quando você muda de atributo.</p>
        </div>
      </div>
      <div className="hb-flow-progress" aria-label={`${chosenCount} Fluxos escolhidos de ${unlocked.length} liberados`}>
        <strong>{chosenCount}<span> / {unlocked.length}</span></strong>
        <small>Fluxos aprendidos</small>
        <div className="hb-flow-progress-track" aria-hidden="true"><span style={{ width: `${chosenCount / Math.max(unlocked.length, 1) * 100}%` }} /></div>
      </div>
    </header>

    <nav className="hb-flow-path-stages" aria-label="Etapas da árvore">
      {FLOW_TIERS.map((tier, index) => {
        const learned = selections[tier]
        const tierUnlocked = unlocked.includes(tier)
        const active = focused.tier === tier
        return <button
          type="button"
          key={tier}
          className={`hb-flow-stage-pill ${tierUnlocked ? 'is-unlocked' : 'is-locked'} ${learned && tierUnlocked ? 'is-chosen' : ''} ${active ? 'is-current' : ''}`}
          onClick={() => selectStage(tier)}
          aria-current={active ? 'step' : undefined}
          aria-label={`${index + 1}. ${FLOW_TIER_LABELS[tier]}. ${tierUnlocked ? (learned ? `Escolhido: ${FLOW_ATTRIBUTE_LABELS[learned]}` : 'Disponível') : 'Bloqueado'}. Ver opções`}
        >
          <span className="hb-flow-pill-number">0{index + 1}</span>
          <span className="hb-flow-pill-icon" aria-hidden="true">{learned && tierUnlocked ? '✓' : TIER_SYMBOLS[tier]}</span>
          <span className="hb-flow-pill-label"><strong>{FLOW_TIER_LABELS[tier]}</strong><small>{learned ? `${FLOW_ATTRIBUTE_LABELS[learned]} · ${FLOW_CHOICES[tier][learned].name}` : tierUnlocked ? 'Escolha disponível' : 'Ainda bloqueado'}</small></span>
        </button>
      })}
    </nav>

    <div className="hb-flow-workspace">
      <div className="hb-flow-tree-viewport" role="region" aria-label="Mapa da árvore de Fluxos">
        <div className="hb-flow-map" style={{ height: MAP_HEIGHT }}>
          <div className="hb-flow-map-caption"><span aria-hidden="true">✦</span> CAMINHO DO CAÇADOR <small>Selecione um nó para conhecer seu efeito</small></div>
          <svg className="hb-flow-connections" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <path className="hb-flow-track" d="M150 45 H1050" />
            {TIER_X.map((x, index) => <circle key={`track-${index}`} className="hb-flow-track-dot" cx={x} cy={45} r="5" />)}
            {FLOW_TIERS.slice(0, -1).map((tier, index) => {
              const nextTier = FLOW_TIERS[index + 1]
              const from = selections[tier]
              const to = selections[nextTier]
              if (!from || !to || !unlocked.includes(tier) || !unlocked.includes(nextTier)) return null
              const d = drawLink(tier, from, to)
              return <g key={`selected-path-${tier}`}>
                <path className="hb-flow-branch-chosen-glow" d={d} />
                <path className="hb-flow-branch-chosen" d={d} />
              </g>
            })}
            {FLOW_TIERS.slice(0, -1).map((tier, index) => {
              const nextTier = FLOW_TIERS[index + 1]
              if (focused.tier !== nextTier || selections[nextTier] === focused.attribute || !focusTierUnlocked || !focusEligible) return null
              const from = selections[tier]
              return from && unlocked.includes(tier) ? <path key={`preview-${tier}`} className="hb-flow-branch-preview" d={drawLink(tier, from, focused.attribute)} /> : null
            })}
          </svg>

          {FLOW_TIERS.map((tier, index) => {
            const tierUnlocked = unlocked.includes(tier)
            const chosen = selections[tier]
            return <div key={`heading-${tier}`} className={`hb-flow-tier-heading ${tierUnlocked ? 'is-unlocked' : 'is-locked'}`} style={{ left: `${TIER_X[index] / MAP_WIDTH * 100}%`, order: index * 6 }}>
              <span className="hb-flow-tier-emblem" aria-hidden="true">{TIER_SYMBOLS[tier]}</span>
              <span className="hb-flow-tier-overline">ETAPA 0{index + 1}</span>
              <strong>{FLOW_TIER_LABELS[tier]}</strong>
              <small>{RANK_SHORT[tier]}</small>
              <span className="hb-flow-tier-status">{tierUnlocked ? (chosen ? '✓ Aprendido' : 'Disponível') : 'Bloqueado'}</span>
            </div>
          })}

          {FLOW_TIERS.flatMap((tier, tierIndex) => FLOW_ATTRIBUTES.map((attribute, attrIndex) => {
            const option = FLOW_CHOICES[tier][attribute]
            const tierUnlocked = unlocked.includes(tier)
            const eligible = getEligibleFlowAttributes(tier, values).includes(attribute)
            const chosen = selections[tier] === attribute
            const activeChoice = chosen && tierUnlocked
            const selectedForDetails = focused.tier === tier && focused.attribute === attribute
            const locked = !tierUnlocked || (!eligible && !chosen)
            const stateText = activeChoice ? 'Aprendido' : chosen ? 'Salvo, inativo' : !tierUnlocked ? 'Bloqueado' : !eligible ? 'Fora do ranking' : 'Disponível'
            return <button
              type="button"
              key={`${tier}-${attribute}`}
              className={`hb-flow-node ${activeChoice ? 'is-chosen' : ''} ${locked ? 'is-unavailable' : 'is-available'} ${selectedForDetails ? 'is-focused' : ''} ${chosen && !tierUnlocked ? 'is-inactive' : ''}`}
              style={{ left: `${TIER_X[tierIndex] / MAP_WIDTH * 100}%`, top: ATTRIBUTE_Y[attrIndex], order: tierIndex * 6 + attrIndex + 1 }}
              onClick={() => setFocused({ tier, attribute })}
              aria-pressed={selectedForDetails}
              aria-label={`${FLOW_TIER_LABELS[tier]}, ${FLOW_ATTRIBUTE_LABELS[attribute]}: ${option.name}. ${stateText}. Abrir detalhes`}
            >
              <span className="hb-flow-node-icon" aria-hidden="true">{activeChoice ? '✓' : ATTRIBUTE_SYMBOLS[attribute]}</span>
              <span className="hb-flow-node-content">
                <span className="hb-flow-node-meta"><span>{FLOW_ATTRIBUTE_LABELS[attribute]}</span><span>{values[attribute]} pts</span></span>
                <strong>{option.name}</strong>
                <small className="hb-flow-node-status">{stateText}</small>
              </span>
              <span className="hb-flow-node-corner" aria-hidden="true">{selectedForDetails ? '◆' : activeChoice ? '✧' : ''}</span>
            </button>
          }))}
        </div>
      </div>

      <aside className="hb-flow-inspector" aria-live="polite" aria-label="Detalhes do Fluxo selecionado">
        <div className="hb-flow-inspector-main">
          <div className="hb-flow-inspector-top">
            <span className="hb-flow-inspector-emblem" aria-hidden="true">{ATTRIBUTE_SYMBOLS[focused.attribute]}</span>
            <div><span className="hb-flows-eyebrow">{FLOW_TIER_LABELS[focused.tier]} · {FLOW_ATTRIBUTE_LABELS[focused.attribute]}</span><h4>{focusedChoice.name}</h4></div>
          </div>
          <div className="hb-flow-inspector-tags">
            <span className={`hb-flow-tag ${isFocusedChoice && focusTierUnlocked ? 'is-learned' : ''}`}>
              {isFocusedChoice ? (focusTierUnlocked ? '✓ Aprendido' : 'Salvo, inativo') : focusTierUnlocked && focusEligible ? 'Disponível' : 'Bloqueado'}
            </span>
            <span className="hb-flow-tag">{REQUIRED_RANKING[focused.tier]}</span>
          </div>
          <p className="hb-flow-inspector-description">{focusedChoice.description}</p>
        </div>
        <div className="hb-flow-inspector-meta">
          <div className="hb-flow-inspector-rule"><span>Aplicação na ficha</span><p>{focusedChoice.automatic}</p></div>
          <div className="hb-flow-inspector-requirement"><span>Graduações</span><strong>{FLOW_TIER_RANKS[focused.tier]}</strong>
            {!focusTierUnlocked && <small>Atinga essa graduação para desbloquear o Fluxo.</small>}
            {focusTierUnlocked && !focusEligible && !isFocusedChoice && <small>{focused.tier === 'corvo'
              ? `Seu atributo ${FLOW_ATTRIBUTE_LABELS[focused.attribute]} não possui o maior valor entre os atributos do personagem.`
              : `Seu atributo ${FLOW_ATTRIBUTE_LABELS[focused.attribute]} não está entre os ${REQUIRED_RANKING[focused.tier]}.`}</small>}
            {focusTierUnlocked && !focusEligible && isFocusedChoice && <small>Escolha anterior preservada após alterações nos atributos.</small>}
          </div>
          {isFocusedChoice ? <div className="hb-flow-inspector-actions">
            <span className="hb-flow-learned-confirmation">{focusTierUnlocked ? '✓ Fluxo registrado na ficha' : 'Escolha preservada, mas inativa'}</span>
            {editable && <button type="button" className="hb-flow-remove" onClick={() => onSelect(focused.tier, '')} disabled={!focusTierUnlocked}>Remover escolha</button>}
          </div> : <button
            type="button"
            className="hb-flow-learn"
            disabled={!canLearn}
            onClick={() => onSelect(focused.tier, focused.attribute)}
          >{selections[focused.tier] ? 'Trocar para este Fluxo' : 'Aprender este Fluxo'}</button>}
        </div>
      </aside>
    </div>
    <footer className="hb-flow-tree-footer">
      <span><span className="hb-flow-legend-dot is-learned" /> Aprendido</span>
      <span><span className="hb-flow-legend-dot is-available" /> Disponível</span>
      <span><span className="hb-flow-legend-dot is-locked" /> Bloqueado</span>
      <p>Os atributos elegíveis são calculados pelos maiores valores; empates no limite são aceitos. <strong>Fluxos anteriores são preservados.</strong></p>
    </footer>
  </section>
}
