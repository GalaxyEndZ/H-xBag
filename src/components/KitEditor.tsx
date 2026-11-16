import type { Dispatch, SetStateAction } from 'react'
import {
  KIT_DEFINITIONS, SCARCITY_DICE,
  kitAvailableScarcityLevels, kitDefinition, kitEffectLabel, kitSlots, kitWeight,
  type KitBenefitMode, type KitEffect, type KitType,
} from '../kitRules'
import { KIT_SKILL_CATALOG } from '../kitSkillCatalog'
import './KitEditor.css'

export type KitEditorProps = {
  type: KitType | null
  onTypeChange: (type: KitType | null) => void
  benefitMode: KitBenefitMode
  onBenefitModeChange: (mode: KitBenefitMode) => void
  skills: string[]
  setSkills: Dispatch<SetStateAction<string[]>>
  skillBonus: string
  onSkillBonusChange: (value: string) => void
  uniqueEffect: string
  onUniqueEffectChange: (value: string) => void
  effect: KitEffect | null
  onEffectChange: (value: KitEffect | null) => void
  effectNotes: string
  onEffectNotesChange: (value: string) => void
  scarcityLevel: string
  onScarcityLevelChange: (value: string) => void
  exhausted: boolean
  onExhaustedChange: (value: boolean) => void
}

export default function KitEditor({
  type, onTypeChange, benefitMode, onBenefitModeChange, skills, setSkills, skillBonus, onSkillBonusChange,
  uniqueEffect, onUniqueEffectChange, effect, onEffectChange,
  effectNotes, onEffectNotesChange, scarcityLevel, onScarcityLevelChange,
  exhausted, onExhaustedChange,
}: KitEditorProps) {
  const definition = kitDefinition(type)
  const slots = type ? kitSlots(type, benefitMode) : []
  const levels = kitAvailableScarcityLevels(type)
  const weight = kitWeight(type, Number(scarcityLevel), exhausted)
  return <section className="hb-kit-editor" aria-label="Tipos de kits">
    <header className="hb-kit-editor-head">
      <span className="hb-kit-editor-emblem" aria-hidden="true">🧰</span>
      <div><strong>Classificação do kit</strong><p>Escolha o tipo e configure suas regras sem alterar os demais itens.</p></div>
    </header>
    <label>Tipo de kit
      <select value={type ?? ''} onChange={event => onTypeChange(event.target.value ? event.target.value as KitType : null)}>
        <option value="">Kit sem subtipo definido</option>
        <optgroup label="Equipáveis">
          {Object.values(KIT_DEFINITIONS).filter(entry => entry.family === 'equippable').map(entry =>
            <option key={entry.type} value={entry.type}>{entry.name} · {entry.fixedWeight} kg</option>)}
        </optgroup>
        <optgroup label="Consumíveis">
          {Object.values(KIT_DEFINITIONS).filter(entry => entry.family === 'consumable').map(entry =>
            <option key={entry.type} value={entry.type}>{entry.name}</option>)}
        </optgroup>
      </select>
    </label>
    {definition && <>
      <div className="hb-kit-summary"><strong>{definition.name}</strong><p>{definition.description}</p>
        <span>Peso: <b>{weight === null ? 'Selecione um nível válido' : `${weight.toLocaleString('pt-BR', {maximumFractionDigits:2})} kg`}</b></span>
      </div>
      {definition.family === 'equippable' && <>
        {type === 'equip_standard' && <label>Benefício do kit padrão
          <select value={benefitMode === 'protection' ? 'protection' : 'skills'} onChange={event => onBenefitModeChange(event.target.value as KitBenefitMode)}>
            <option value="skills">Duas perícias de arquétipo</option>
            <option value="protection">Proteção moderada</option>
          </select>
        </label>}
        {type === 'equip_rare' && <label>Benefício do kit raro
          <select value={benefitMode === 'main_and_archetype' ? 'main_and_archetype' : 'three_archetype'} onChange={event => onBenefitModeChange(event.target.value as KitBenefitMode)}>
            <option value="three_archetype">Três perícias de arquétipo</option>
            <option value="main_and_archetype">Uma perícia principal + duas de arquétipo</option>
          </select>
        </label>}
        {slots.length > 0 && <div className="hb-kit-skill-grid">
          {slots.map((slot, index) => <label key={`${type}-${benefitMode}-${index}`}>{slot.label}
            <select value={skills[index] || ''} onChange={event => setSkills(current => { const next = [...current]; next[index] = event.target.value; return next })}>
              <option value="">Selecione uma perícia cadastrada...</option>
              {KIT_SKILL_CATALOG[slot.group].map(group => <optgroup key={group.group} label={group.group}>
                {group.options.map(option => <option key={option.value} value={option.value}
                  disabled={skills.some((value,slotIndex)=>slotIndex!==index && value===option.value)}>{option.label}</option>)}
              </optgroup>)}
            </select>
          </label>)}
          <label className="hb-kit-skill-bonus">Bônus numérico em cada perícia (+)
            <input type="number" inputMode="numeric" min={1} step={1} required
              value={skillBonus} onChange={event=>onSkillBonusChange(event.target.value)} placeholder="Ex.: 5" />
            <small>Escolha um número inteiro positivo. O mesmo bônus será aplicado a cada perícia selecionada enquanto o kit estiver equipado.</small>
          </label>
        </div>}
        {benefitMode === 'protection' && type === 'equip_standard' && <p className="hb-kit-editor-note">O kit concede proteção moderada. A forma de aplicar segue o sistema de proteção já existente.</p>}
        {type === 'equip_rare' && <label>Funcionalidade única
          <textarea value={uniqueEffect} onChange={event => onUniqueEffectChange(event.target.value)} maxLength={1000} rows={3} placeholder="Descreva a função exclusiva deste kit..."/>
        </label>}
        <p className="hb-kit-editor-note">As perícias vêm do catálogo do RPG. O mestre escolhe o bônus numérico de cada kit ao criá-lo ou editá-lo.</p>
      </>}
      {definition.family === 'consumable' && <>
        <div className="hb-kit-scarcity-row">
          <label>Nível de escassez
            <select value={levels.includes(Number(scarcityLevel) as 1|2|3|4) ? scarcityLevel : String(levels[0])} onChange={event => onScarcityLevelChange(event.target.value)} disabled={exhausted}>
              {levels.map(level => <option key={level} value={level}>Nível {level} · 1d{SCARCITY_DICE[level]} · {definition.weights?.[level]?.toLocaleString('pt-BR')} kg</option>)}
            </select>
          </label>
          <label className="hb-kit-scarcity-check"><input type="checkbox" checked={exhausted} onChange={event => onExhaustedChange(event.target.checked)}/> Esgotado</label>
        </div>
        {type !== 'prolonged' && <label>Benefício temporário
          <select value={effect ?? ''} onChange={event => onEffectChange(event.target.value ? event.target.value as KitEffect : null)}>
            <option value="">Escolha o efeito...</option>
            <option value="damage">Dano</option>
            <option value="resistance">Resistência</option>
            <option value="combat_point">Um ponto de combate</option>
          </select>
        </label>}
        {type !== 'prolonged' && <label>Detalhes do efeito (opcional)
          <textarea value={effectNotes} rows={2} maxLength={500} onChange={event => onEffectNotesChange(event.target.value)} placeholder={`Descreva o buff de ${kitEffectLabel(effect).toLowerCase()} (valor definido pelo mestre)`}/>
        </label>}
        <p className="hb-kit-editor-note">{type === 'immediate' ? 'Duração: até 1d6 rodadas.' : type === 'preparation' ? 'Duração: uma cena.' : 'Os efeitos e a duração do uso prolongado ainda não foram definidos.'} O dado de escassez continua sendo rolado na utilização do item.</p>
      </>}
    </>}
  </section>
}
