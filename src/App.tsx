import {
  getRegisteredSystems,
  getSystemByName,
} from './systems/core/registry'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Auth from './Auth'
import './App.css'
import './themes/seasonThemes.css'
import './themes/seasonThemes-enhanced.css'
import './themes/visualStyles.css'
import { seasonThemes } from './themes'
import { visualStyles, type VisualStyleKey } from './themes/visualStyles'
import CyberneticsInventory from './systems/cyberflower/CyberneticsInventory'
import { KISATSUTAI_TRAINING, KISATSUTAI_SKILL_GROUPS, KISATSUTAI_PATHS, KISATSUTAI_ONI_CLASSES } from './systems/kisatsutai/extendedData'
import HaxTable from './components/HaxTable'
import MasterChest from './components/MasterChest'
import ChestMessages from './components/ChestMessages'
import FriendsPanel from './components/FriendsPanel'
import { ConditionsPanel, CharacterConditions, EnemyConditions } from './ConditionsPanel'
import { ARCHETYPE_KITS } from './archetypeKits'
import { useCharacterConditionModifiers, useCharacterConditionRules, conditionModifier, applyConditionModifier } from './conditionEngine'

type TrainingLevel = keyof typeof KISATSUTAI_TRAINING
const TRAINING_LABELS: Record<TrainingLevel, string> = { completo: 'Completo', avancado: 'Avançado', medio: 'Médio', leve: 'Leve' }
const SKILL_GROUP_ALIAS: Record<string, string[]> = {
  'Linha de Frente': ['Linha de Frente'], Defensor: ['Defensores'], Defensores: ['Defensores'],
  Flanco: ['Flanco'], Especialista: ['Especialistas'], Especialistas: ['Especialistas'],
  Suporte: ['Suporte'], Gerais: ['Sociais', 'Conhecimentos Gerais', 'Naturais'],
  // A vaga livre usa o mesmo conjunto de perícias gerais/de arquétipo do Intelecto.
  'Qualquer Arquétipo': ['Sociais', 'Conhecimentos Gerais', 'Naturais', 'Defensores', 'Linha de Frente', 'Flanco', 'Especialistas', 'Suporte'],
  'qualquer Arquétipo': ['Sociais', 'Conhecimentos Gerais', 'Naturais', 'Defensores', 'Linha de Frente', 'Flanco', 'Especialistas', 'Suporte'],
  'Suporte/Defensor': ['Suporte', 'Defensores'],
}
const KISATSUTAI_GROUP_NAMES = Object.keys(KISATSUTAI_SKILL_GROUPS)
function resolveTrainingGroups(category: string): string[] {
  const candidates = SKILL_GROUP_ALIAS[category] || [category]
  return candidates.flatMap(candidate => KISATSUTAI_GROUP_NAMES.filter(name => name === candidate || (category === 'Gerais' && !['Defensores','Linha de Frente','Flanco','Especialistas','Suporte'].includes(name))))
}
/** A combinação define a trilha-base; o arquétipo primário define a especialização única. */
function getKisatsutaiPath(primary: string, secondary: string): string {
  if (!primary || !secondary || primary === secondary) return ''
  const pair = [primary.trim(), secondary.trim()].sort().join('|')
  const combinations: Record<string, string> = {
    'Flanco|Linha de Frente': 'Assassino',
    'Especialista|Flanco': 'Estrategista',
    'Especialista|Suporte': 'Detetive',
    'Defensor|Suporte': 'Guardião',
    'Defensor|Linha de Frente': 'Guerreiro',
    'Especialista|Linha de Frente': 'Duelista',
    'Defensor|Especialista': 'Sentinela',
    'Flanco|Suporte': 'Socorrista',
  }
  return combinations[pair] || ''
}

function getKisatsutaiFullPath(primary: string, secondary: string): string {
  const path = getKisatsutaiPath(primary, secondary)
  return path ? `${primary.trim()} ${path}` : ''
}

/** Exibição de treinamentos sem alterar os dados persistidos da ficha. */
function TrainedSkillsSummary({ trainings, forEnemy, kitNames = [], modifiers = {}, pending = null }: { trainings: Record<string, string>; forEnemy: boolean; kitNames?: string[]; modifiers?: Record<string, number>; pending?: {skill:string;bonus:number}|null }) {
  const kitBonuses = ARCHETYPE_KITS.filter(kit => kitNames.some(name => name.toLocaleLowerCase('pt-BR') === kit.name.toLocaleLowerCase('pt-BR')))
  const getKitBonus = (skillName: string) => kitBonuses.flatMap(kit => {
    const match = kit.description.match(/\+(\d+)\s+em\s+([^.;]+)/i)
    if (!match) return []
    const listed = match[2].split(/,|\s+e\s+/i).map(x => x.trim().toLocaleLowerCase('pt-BR'))
    return listed.includes(skillName.toLocaleLowerCase('pt-BR')) ? [{name: kit.name, bonus: Number(match[1])}] : []
  })
  const levels: TrainingLevel[] = ['completo', 'avancado', 'medio', 'leve']
  const generalGroups = new Set(['Sociais', 'Conhecimentos Gerais', 'Naturais'])
  const sections = [
    { id: 'arquetipo', icon: '✦', title: 'Perícias de Arquétipo', subtitle: 'Treinamentos vinculados aos arquétipos', accepts: (group: string) => !generalGroups.has(group) },
    { id: 'extras', icon: '✧', title: 'Perícias Gerais', subtitle: 'Sociais, conhecimentos gerais e naturais', accepts: (group: string) => generalGroups.has(group) },
  ]
  const allSkills = Object.entries(KISATSUTAI_SKILL_GROUPS).flatMap(([group, entries]) =>
    entries.flatMap(skill => {
      const key = `${group}:${skill.name}`
      const level = trainings[key] as TrainingLevel | undefined
      return level && Object.prototype.hasOwnProperty.call(KISATSUTAI_TRAINING, level)
        ? [{ key, group, name: skill.name, level }] : []
    })
  )
  return (
    <section className="hb-trained-skills" id={forEnemy ? 'inimigo-pericias-extras' : 'ficha-pericias-extras'} aria-labelledby={forEnemy ? 'enemy-trained-skills-title' : 'trained-skills-title'}>
      <div className="hb-trained-skills-intro">
        <div className="hb-trained-skills-icon" aria-hidden="true">✧</div>
        <div>
          <span className="hb-trained-skills-eyebrow">DESENVOLVIMENTO DO PERSONAGEM</span>
          <h3 id={forEnemy ? 'enemy-trained-skills-title' : 'trained-skills-title'}>Perícias treinadas</h3>
          <p>Treinamentos organizados por origem e nível. Os bônus refletem os dados atuais da ficha.</p>
        </div>
        <span className="hb-trained-skills-total">{allSkills.length} {allSkills.length === 1 ? 'perícia' : 'perícias'}</span>
      </div>
      <div className="hb-trained-skills-sections">
        {sections.map(section => {
          const skills = allSkills.filter(skill => section.accepts(skill.group))
          return (
            <article className="hb-trained-skills-section" key={section.id}>
              <header className="hb-trained-skills-section-head">
                <span className="hb-trained-skills-section-icon" aria-hidden="true">{section.icon}</span>
                <div><h4>{section.title}</h4><p>{section.subtitle}</p></div>
                <span className="hb-trained-skills-count">{skills.length}</span>
              </header>
              <div className="hb-trained-skills-tiers">
                {levels.map(level => {
                  const entries = skills.filter(skill => skill.level === level).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  return (
                    <div className="hb-trained-skills-tier" key={level}>
                      <div className="hb-trained-skills-tier-head">
                        <strong>{TRAINING_LABELS[level]}</strong>
                        <span className="hb-trained-skills-bonus">+{KISATSUTAI_TRAINING[level]}</span>
                        <span className="hb-trained-skills-tier-count">{entries.length} {entries.length === 1 ? 'perícia' : 'perícias'}</span>
                      </div>
                      {entries.length > 0 ? (
                        <ul className="hb-trained-skills-items">
                          {entries.map(skill => (
                            <li key={skill.key} className="hb-trained-skills-item">
                              <span className="hb-trained-skills-item-info"><strong>{skill.name}</strong><small>{skill.group}</small></span>
                              {(() => {const base=KISATSUTAI_TRAINING[level];const target=section.id==='arquetipo'?'archetype_skill':'extra_skill';const modified=applyConditionModifier(applyConditionModifier(base,modifiers,target,skill.key),modifiers,target,skill.name);const effective=applyConditionModifier(modified,modifiers,'main_skill',skill.name)+(pending?.skill===skill.name?pending.bonus:0);return <><span className="hb-trained-skills-item-bonus">{effective>=0?'+':''}{effective}</span>{effective!==base&&<small className="hb-trained-skills-condition-delta">✦ Condições / preparo: {effective-base>0?'+':''}{effective-base}</small>}</>})()}
                              {getKitBonus(skill.name).map(kit => <span key={kit.name} className="hb-trained-skills-item-bonus" title={kit.name}>🧰 Kit: +{kit.bonus}</span>)}
                            </li>
                          ))}
                        </ul>
                      ) : <p className="hb-trained-skills-empty">Nenhuma perícia neste nível.</p>}
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function KisatsutaiSkillDistribution({ fullPath, skills, onChange, intellectExtraLevels = 0, disabled = false }: {
  fullPath: string; skills: Record<string, any>; intellectExtraLevels?: number;
  onChange: (next: Record<string, any>) => void; disabled?: boolean
}) {
  // A trilha completa (ex.: "Linha de Frente Duelista") é a única fonte das vagas.
  // O arquétipo não é usado como uma segunda regra de distribuição.
  const pathName = Object.keys(KISATSUTAI_PATHS).find(name => fullPath.endsWith(` ${name}`)) || ''
  const path = KISATSUTAI_PATHS[pathName as keyof typeof KISATSUTAI_PATHS]
  const benefitEntry = path && Object.entries(path.benefits as Record<string, readonly string[]>).find(([title]) => title === fullPath)
  const requirements = (benefitEntry?.[1] || []).flatMap((line: string, row: number) => {
    const match = line.match(/^Treinamento (Avançado|Médio|Leve|Completo) em (\d+) Perícias? (?:de |Gerais$)(.*)$/i)
    if (!match) return []
    const level = ({ 'Avançado':'avancado', 'Médio':'medio', 'Leve':'leve', 'Completo':'completo' } as Record<string, TrainingLevel>)[match[1]]
    const category = line.endsWith('Gerais') ? 'Gerais' : match[3].trim()
    return Array.from({length: Number(match[2])}, (_, index) => ({ id: `${row}-${index}`, level, category, groups: resolveTrainingGroups(category) }))
  })
  // Mantém a chave de persistência anterior para preservar distribuições existentes.
  const key = `${pathName}:${fullPath.slice(0, -(pathName.length + 1))}`
  const distribution = (skills.distributionByPath?.[key] || {}) as Record<string, string>
  // Cada ponto de Intelecto dedicado a perícias gerais concede um passo de +5.
  // Pode iniciar uma perícia geral em +5 ou melhorar uma já treinada até +15.
  const intellectGroups = resolveTrainingGroups('Qualquer Arquétipo')
  const intellectOptions = intellectGroups.flatMap(group => (KISATSUTAI_SKILL_GROUPS[group as keyof typeof KISATSUTAI_SKILL_GROUPS] || []).map(skill => ({ key: `${group}:${skill.name}`, name: skill.name, group })))
  const intellectSelections: string[] = Array.isArray(skills.intellectExtraAllocations) ? skills.intellectExtraAllocations.slice(0, intellectExtraLevels) : []
  const baseTrainings: Record<string, TrainingLevel> = {}
  requirements.forEach(item => { if (distribution[item.id]) baseTrainings[distribution[item.id]] = item.level })
  const trainingSteps = (key: string, selections: string[] = intellectSelections) => {
    const base = baseTrainings[key] ? KISATSUTAI_TRAINING[baseTrainings[key]] : 0
    return base + selections.filter(selected => selected === key).length * 5
  }
  const buildTrainings = (allocations: string[]) => {
    const result: Record<string, TrainingLevel> = { ...baseTrainings }
    for (const selected of new Set(allocations.filter(Boolean))) {
      const points = trainingSteps(selected, allocations)
      result[selected] = points >= 15 ? 'avancado' : points >= 10 ? 'medio' : 'leve'
    }
    return result
  }
  const updateIntellect = (index: number, value: string) => {
    if (disabled) return
    const next = [...intellectSelections]
    next[index] = value
    // Um ponto pode iniciar ou melhorar uma perícia extra OU de arquétipo, até +15.
    if (value && trainingSteps(value, next) > 15) return
    onChange({ ...skills, intellectExtraAllocations: next, extraTrainings: buildTrainings(next) })
  }
  const validSlots = new Set(requirements.map(req => req.id))
  const assigned = new Set(requirements.map(req => distribution[req.id]).filter(Boolean))
  const change = (id: string, value: string) => {
    if (disabled || !validSlots.has(id)) return
    const req = requirements.find(item => item.id === id)
    const permitted = req?.groups.some(group => KISATSUTAI_SKILL_GROUPS[group as keyof typeof KISATSUTAI_SKILL_GROUPS]?.some(skill => `${group}:${skill.name}` === value))
    if (value && (!permitted || (assigned.has(value) && distribution[id] !== value))) return
    const all = { ...(skills.distributionByPath || {}) }
    const previous = { ...(all[key] || {}) }
    const next = { ...previous, [id]: value }
    all[key] = next
    const base: Record<string, TrainingLevel> = {}
    requirements.forEach(item => { if (next[item.id]) base[next[item.id]] = item.level })
    const updated: Record<string, TrainingLevel> = { ...base }
    for (const selected of new Set(intellectSelections.filter(Boolean))) {
      const points = (base[selected] ? KISATSUTAI_TRAINING[base[selected]] : 0) + intellectSelections.filter(s => s === selected).length * 5
      updated[selected] = points >= 15 ? 'avancado' : points >= 10 ? 'medio' : 'leve'
    }
    onChange({ ...skills, distributionByPath: all, extraTrainings: updated })
  }
  if (!fullPath || !path) return <div className="kisatsutai-distribution"><strong>Distribuição de perícias gerais e de arquétipo</strong><p className="kisatsutai-editor-note">Defina os arquétipos primário e secundário na Identidade para calcular automaticamente a trilha e as vagas de treinamento.</p></div>
  if (!benefitEntry) return <p className="kisatsutai-editor-note">A trilha {fullPath} não possui benefícios de treinamento cadastrados.</p>
  const sections = [
    { id: 'arquetipo', title: 'Pontos de perícias de arquétipo', description: 'Treinamentos das perícias dos arquétipos previstos na trilha.', slots: requirements.filter(req => req.category !== 'Gerais') },
    { id: 'extras', title: 'Pontos de perícias gerais', description: 'Treinamentos exclusivos das perícias gerais: Sociais, Conhecimentos Gerais e Naturais.', slots: requirements.filter(req => req.category === 'Gerais') },
  ]
  return <div className="kisatsutai-distribution sheet-distribution-panel">
    <div className="kisatsutai-distribution-title"><span className="kisatsutai-distribution-symbol">✦</span><div><small>DESENVOLVIMENTO · {fullPath.toUpperCase()}</small><strong>Distribuição de perícias gerais e de arquétipo</strong><p>Os dois tipos de pontos são independentes e definidos pela trilha {fullPath}.</p></div></div>
    {sections.map(section => {
      const used = section.slots.filter(req => !!distribution[req.id]).length
      const levels = (['avancado', 'medio', 'leve', 'completo'] as const).filter(level => section.slots.some(req => req.level === level))
      return <section className="kisatsutai-distribution-section" key={section.id}>
        <div className="kisatsutai-distribution-section-heading"><div><h3>{section.title}</h3><p>{section.description}</p></div><strong>{used} / {section.slots.length}</strong></div>
        <div className="kisatsutai-distribution-overall"><strong>{used} pontos distribuídos</strong><span>{section.slots.length - used} restantes</span></div>
        <div className="kisatsutai-distribution-progress"><span style={{width: `${section.slots.length ? used / section.slots.length * 100 : 0}%`}} /></div>
        <div className="kisatsutai-distribution-summary">
          {levels.map(level => { const slots = section.slots.filter(req => req.level === level); const count = slots.filter(req => !!distribution[req.id]).length; return <div className="kisatsutai-distribution-stat" key={level}><span>{TRAINING_LABELS[level]} <em>+{KISATSUTAI_TRAINING[level]}</em></span><strong>{count} <small>/ {slots.length}</small></strong><div className="kisatsutai-distribution-progress"><span style={{width: `${slots.length ? count / slots.length * 100 : 0}%`}} /></div><small>{slots.length - count} vagas livres</small></div> })}
        </div>
        {levels.map(level => <div className="kisatsutai-distribution-tier" key={level}><h4>{TRAINING_LABELS[level]} <span>+{KISATSUTAI_TRAINING[level]}</span></h4><div className="kisatsutai-distribution-rows">{section.slots.filter(req => req.level === level).map(req => {
          // Uma perícia aparece apenas uma vez e não volta a ser oferecida após distribuída.
          // A seleção desta vaga permanece visível para permitir sua edição.
          const uniqueOptions = new Map<string, { key: string; name: string; group: string }>()
          req.groups.forEach(group => {
            const groupSkills: ReadonlyArray<{ name: string; description: string }> = KISATSUTAI_SKILL_GROUPS[group as keyof typeof KISATSUTAI_SKILL_GROUPS] || []
            groupSkills.forEach(skill => {
            const key = `${group}:${skill.name}`
            if (!uniqueOptions.has(key) && (!assigned.has(key) || distribution[req.id] === key)) {
              uniqueOptions.set(key, { key, name: skill.name, group })
            }
            })
          })
          const options = Array.from(uniqueOptions.values())
          return <label key={req.id} className="kisatsutai-distribution-row"><span><strong>{req.category === 'qualquer Arquétipo' ? 'Qualquer Arquétipo' : req.category}</strong><small>{distribution[req.id] ? 'Distribuída' : 'Disponível'}</small></span><select disabled={disabled} value={distribution[req.id] || ''} onChange={e => change(req.id, e.target.value)}><option value="">Selecionar perícia...</option>{options.map(option => <option key={option.key} value={option.key}>{option.name} · {option.group}</option>)}</select></label>
        })}</div></div>)}
        {section.slots.length > 0 && used === section.slots.length && <p className="kisatsutai-distribution-complete">Distribuição de {section.id === 'extras' ? 'perícias gerais' : 'perícias de arquétipo'} concluída!</p>}
      </section>
    })}
    <section className="kisatsutai-distribution-section">
      <div className="kisatsutai-distribution-section-heading"><div><h3>Desenvolvimento por Intelecto</h3><p>Os pontos de Intelecto são independentes das vagas da trilha. Cada ponto concede +5 a uma perícia extra ou de arquétipo, até +15.</p></div><strong>{intellectSelections.filter(Boolean).length} / {intellectExtraLevels}</strong></div>
      <div className="kisatsutai-distribution-rows">
        {Array.from({ length: intellectExtraLevels }, (_, index) => {
          const selected = intellectSelections[index] || ''
          return <label className="kisatsutai-distribution-row" key={index}><span><strong>Ponto extra {index + 1}</strong><small>{selected ? `Treinamento total: +${trainingSteps(selected)}` : 'Disponível'}</small></span><select disabled={disabled} value={selected} onChange={event => updateIntellect(index, event.target.value)}><option value="">Selecionar perícia...</option>{intellectOptions.filter(option => option.key === selected || trainingSteps(option.key, intellectSelections.filter((_, slot) => slot !== index)) < 15).map(option => <option key={option.key} value={option.key}>{option.name} · {option.group} (+{Math.min(15, trainingSteps(option.key, intellectSelections.filter((_, slot) => slot !== index)) + 5)})</option>)}</select></label>
        })}
      </div>
    </section>
    <p className="kisatsutai-editor-note">Cada vaga pertence a um único tipo de perícia. Não é possível repetir a mesma perícia entre as duas distribuições.</p>
  </div>
}

type SheetAttribute = 'strength' | 'agility' | 'defense' | 'breathing' | 'intellect'

// Regra compartilhada por fichas de personagens e inimigos.
// Os pontos distribuídos e o bônus familiar são aplicados ao valor-base,
// respeitando o limite de atributos do sistema.
function calculateSheetAttribute(
  read: (path: string, fallback?: any) => any,
  attribute: SheetAttribute,
  familyBonus: number,
  maxAttribute = 5,
) {
  const nonnegativeInteger = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
  }
  const base = nonnegativeInteger(read(`attributes.${attribute}`, 0))
  const allocations = ['family', 'hierarchy', 'extra'].reduce(
    (sum, source) => sum + nonnegativeInteger(read(`progression.allocations.${source}.${attribute}`, 0)),
    0,
  )
  const legacyClass = nonnegativeInteger(read(`progression.allocations.class.${attribute}`, 0))
  // Penalidade voluntária independente dos pontos de família / tier.
  // Só gera -1 quando o atributo efetivamente parte de zero, sem penalidade herdada.
  const penalty = Number(read(`progression.attributePenalties.${attribute}`, 0)) === -1 &&
    base + familyBonus === 0 && familyBonus >= 0 ? -1 : 0
  return Math.min(maxAttribute, Math.max(-1, base + allocations + legacyClass + familyBonus + penalty))
}

type SheetSkill = 'vigor' | 'mental' | 'combat' | 'dexterity' | 'resistance' | 'ability'

// A distribuição de perícias é calculada pela configuração do sistema,
// tanto nas fichas de personagens quanto nas fichas de inimigos.
function calculateSheetSkill(
  read: (path: string, fallback?: any) => any,
  skill: SheetSkill,
  config: { maxPerSkill?: number; sources?: ReadonlyArray<{id: string}> } | null | undefined,
  allowLegacyDirect = false,
) {
  const maxSkill = Math.max(1, Math.floor(config?.maxPerSkill ?? 12))
  const sources = config?.sources ?? []
  const allocated = sources.reduce((sum, source) => {
    const value = Number(read(`skills.pointAllocations.${source.id}.${skill}`, 0))
    return sum + (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)
  }, 0)
  const legacy = Number(read(`skills.${skill}`, 0))
  const raw = Number.isFinite(legacy) ? Math.max(0, Math.floor(legacy)) : 0
  const hasAllocationObject = read('skills.pointAllocations', null) !== null
  return Math.min(maxSkill, sources.length && (hasAllocationObject || !allowLegacyDirect)
    ? allocated : raw)
}

// Uma única fórmula de recursos para a ficha e o Escudo do Mestre (Party).
// Recebe os dados da própria ficha, portanto a Party não precisa reconstruir
// distribuições de perícias, atributos ou bônus de forma independente.
function calculateSheetResourceMaximums(
  sheetData: Record<string, any>,
  options: {
    skillPointConfig?: Parameters<typeof calculateSheetSkill>[2]
    usesFamilyTiers: boolean
    familyTier?: { pv?: number; ps?: number; pr?: number } | null
    familyBreathingBonus: number
    rankStatus?: { pv: number; ps: number; pr: number } | null
  },
) {
  const read = (path: string, fallback: any = 0): any =>
    path.split('.').reduce(
      (current: any, key: string) =>
        current && typeof current === 'object' ? current[key] : undefined,
      sheetData as any,
    ) ?? fallback
  const number = (path: string) => {
    const value = Number(read(path, 0))
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  }
  const vigor = calculateSheetSkill(read, 'vigor', options.skillPointConfig)
  const mental = calculateSheetSkill(read, 'mental', options.skillPointConfig)
  const ability = calculateSheetSkill(read, 'ability', options.skillPointConfig)
  const breathing = calculateSheetAttribute(
    read, 'breathing', options.usesFamilyTiers ? options.familyBreathingBonus : 0,
  )
  const family = options.usesFamilyTiers ? options.familyTier : null
  const rank = options.rankStatus
  return {
    pv: Math.max(0, vigor * 10 + (family?.pv ?? 0) + (rank?.pv ?? 0) +
      number('progression.classStatus.pv') + number('progression.statusBonuses.pv')),
    ps: Math.max(0, mental * 10 + (family?.ps ?? 0) + (rank?.ps ?? 0) +
      number('progression.classStatus.ps') + number('progression.statusBonuses.ps')),
    pr: Math.max(0, (breathing + ability) * 10 + (family?.pr ?? 0) + (rank?.pr ?? 0) +
      number('progression.classStatus.pr') + number('progression.statusBonuses.pr')),
  }
}

// Regras reutilizadas pelo combate de personagens e inimigos.
// O formato dos itens é normalizado antes do cálculo, evitando que as fichas
// dependam das tabelas de inventário umas das outras.
type SheetCombatEquipment = {
  name?: string
  weaponDamage?: string
  equipmentType?: string
  armorClass?: string
  armorCoverage?: string
  protectionTier?: string
  protectionMode?: string
}
type SheetDamageType = 'cortante_perfurante' | 'especial_bruto'

function calculateSheetDefenses(
  equippedItems: SheetCombatEquipment[],
  stats: { dexterity: number; resistance: number; combat: number; mental: number },
) {
  const armor = equippedItems.find(item => item.equipmentType === 'armor')
  const protections = equippedItems.filter(item => item.equipmentType === 'protection')
  const armorClass = armor?.armorClass || 'leve'
  const armorDexterity = !armor ? stats.dexterity
    : armorClass === 'pesada' ? 0
    : armorClass === 'media' ? Math.floor(stats.dexterity / 2)
    : stats.dexterity
  const armorResistance = armorClass === 'pesada' ? stats.resistance * 2 + 8
    : armorClass === 'media' ? stats.resistance + 6
    : Math.floor(stats.resistance / 2) + 4
  const armorCovers = (type: SheetDamageType) => Boolean(armor) && (
    armorClass === 'pesada' || armor?.armorCoverage === 'todos' || armor?.armorCoverage === type
  )
  const fraction = (item: SheetCombatEquipment) => item.protectionTier === 'avancada'
    ? 1 : item.protectionTier === 'moderada' ? 0.5 : 0.25
  const physicalProtection = protections.filter(item => item.protectionMode !== 'sanidade')
    .reduce((total, item) => total + Math.floor(stats.resistance * fraction(item)), 0)
  const sanityProtection = protections.filter(item => item.protectionMode === 'sanidade')
    .reduce((total, item) => total + Math.floor(stats.mental * fraction(item)), 0)
  return {
    armor,
    armorClass,
    armorDexterity,
    counterAttackDT: stats.combat + armorDexterity,
    armorResistance,
    armorCovers,
    physicalProtection,
    sanityProtection,
  }
}

function calculateSheetPhysicalDamage(input: {
  incoming: number
  reactionReduction: number
  damageType: SheetDamageType
  defenses: ReturnType<typeof calculateSheetDefenses>
  specialBruteProtectionOnly?: boolean
}) {
  const incoming = Math.max(0, input.incoming)
  const reactionPrevented = Math.floor(incoming * Math.max(0, Math.min(1, input.reactionReduction)))
  const damageAfterReaction = Math.max(0, incoming - reactionPrevented)
  const armorReduction = input.defenses.armorCovers(input.damageType)
    ? input.defenses.armorResistance : 0
  const armorPrevented = Math.min(
    damageAfterReaction,
    armorReduction + (input.specialBruteProtectionOnly && input.damageType !== 'especial_bruto'
      ? 0 : input.defenses.physicalProtection),
  )
  return {
    reactionPrevented,
    armorPrevented,
    remaining: Math.max(0, damageAfterReaction - armorPrevented),
    totalPrevented: reactionPrevented + armorPrevented,
  }
}

function rollSheetAttributeDice(diceCount: number, agilityOverloaded = false, sides = 20) {
  const effectiveDiceCount = Math.floor(diceCount) - (agilityOverloaded ? 1 : 0)
  const hasDisadvantage = effectiveDiceCount <= 0
  const diceSides = Math.max(2, Math.floor(sides))
  // 0 dados -> 2 dados; -1 -> 3; -2 -> 4; etc.
  const rollCount = hasDisadvantage ? 2 - effectiveDiceCount : effectiveDiceCount
  const rolls = Array.from({length: rollCount},
    () => Math.floor(Math.random() * diceSides) + 1)
  const result = hasDisadvantage ? Math.min(...rolls) : Math.max(...rolls)
  return {
    rolls, result, effectiveDiceCount, hasDisadvantage,
    description: hasDisadvantage
      ? `${rollCount}D${diceSides} = [${rolls.join(', ')}] (desvantagem) → ${result}`
      : `${effectiveDiceCount}D${diceSides} = [${rolls.join(', ')}] (maior: ${result})`,
  }
}

type Campaign = {
  id: string
  name: string
  description: string | null
  system_name: string | null
  currency_config: {
  currencies: {
    id: string
    name: string
    symbol: string
    conversionRate: number
  }[]
} | null
  created_by: string
  role: string
}

type Character = {
  id: string
  campaign_id: string
  user_id: string
  name: string
  emoji?: string | null
  archetype: string | null
  level: number
  strength: number
  visibility: 'private' | 'campaign' | 'selected'
  current_player_id: string | null
  created_at: string
}

type CampaignMember = {
  user_id: string
  role: string
  display_name: string
}

type CharacterGrant = {
  user_id: string
}

type Season = { id: string; campaign_id: string; name: string; description: string | null; season_number: number; status: 'draft' | 'active' | 'completed' | 'archived'; theme_key?: string | null; visual_style_key?: string | null }
type CampaignActivity = {
  id: string
  campaign_id: string
  actor_id: string | null
  actor_name: string
  activity_type: string
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  created_at: string
}
type CharacterSheet = { id: string; character_id: string; season_id: string; sheet_data: Record<string, unknown> }
type Item = {
  id: string
  character_id: string
  name: string
  description: string | null
  category: string
  quantity: number
  weight: number
  unit_price: number
  currency_id: string | null
  metadata: Record<string, unknown> | null
  sale_blocked: boolean
}

type CampaignCreature = {
  id: string
  campaign_id: string
  name: string
  category: string
  description: string | null
  image_url: string | null
  image_display_url?: string | null
  threat_level: string
  is_hidden: boolean
  pv: number | null
  ps: number | null
  pr: number | null
  attributes: Record<string, unknown>
  resistances: string[]
  weaknesses: string[]
  immunities: string[]
  abilities: unknown[]
  attacks: unknown[]
  rewards: unknown[]
  created_by: string | null
  created_at: string
  updated_at: string
}

// Traços adicionais são armazenados em campaign_creatures.attributes (JSONB).
// Não exigem novas colunas e não alteram as características anteriores.
function readCreatureTraits(creature: CampaignCreature, key: 'vices' | 'peculiarities'): string[] {
  const value = creature.attributes?.[key]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : []
}
const parseCreatureTraits = (text: string): string[] => [...new Set(
  text.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
)]

type CampaignEnemy = {
  id: string
  campaign_id: string
  name: string
  emoji: string | null
  archetype: string | null
  description: string | null
  sheet_data: Record<string, any>
  created_by: string
  created_at: string
  updated_at: string
}

// Participação, iniciativa e demais dados táticos da party inimiga são
// independentes da Party de personagens e persistem na ficha de cada inimigo.
function getEnemyPartySeason(enemy: CampaignEnemy, seasonId: string): {
  participating: boolean
  initiative: number | null
} {
  const entry = enemy.sheet_data?.enemyPartyBySeason?.[seasonId]
  const initiative = entry?.initiative
  return {
    participating: entry?.participating === true,
    initiative: initiative === null || initiative === undefined || initiative === '' ||
      !Number.isFinite(Number(initiative)) ? null : Number(initiative),
  }
}

type CampaignShop = {
  id: string
  campaign_id: string
  name: string
  description: string | null
  is_visible: boolean
}

type CampaignShopItem = {
  id: string
  shop_id: string
  name: string
  description: string | null
  category: string
  weight: number
  unit_price: number
  currency_id: string | null
  quantity: number | null
  metadata: Record<string, unknown> | null
  purchase_blocked: boolean
}

// Avatares armazenados apenas nos metadados da conta do usuário.
const profileAvatarOptions = ['🌸', '🌙', '🦊', '🐉', '🦋', '🗡️', '🛡️', '⚜️', '🌿', '🔮', '🪶', '✦'] as const

function displayNameForMembers(session: Session | null) {
  return session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Você'
}

type CurrencyTransaction = {
  id: string
  character_id: string
  campaign_id: string
  currency_id: string
  amount_delta: number
  balance_after: number
  description: string | null
  created_by: string | null
  created_at: string
}


const categories = [
  'Todos',
  'Armas',
  'Equipamento',
  'Kits',
  'Consumíveis',
  'Alimentos',
  'Tesouros',
  'Diversos',
]

const enemyEmojiChoices = [
  '👹', '👺', '💀', '☠️', '🩸', '👁️', '🧟', '🦇',
  '🐺', '🐉', '🦂', '🕷️', '⚔️', '🛡️', '🔥', '🕯️',
]

const availableEmojis = [
  '📦', '⚔️', '🗡️', '🏹', '🛡️', '🪄',
  '🧪', '🧴', '🍖', '🍷', '🧀', '🧭',
  '🔑', '📜', '📕', '💎', '💰', '🪙',
  '💍', '👑', '🪶', '🪓', '🔨', '⛏️',
  '🔥', '❄️', '🌿', '💀', '🐉', '✨',
  '🦑', '🐦‍⬛', '🧙', '🧝', '🧛', '🧚', '🥷', '🧑‍🎤', '🧑‍🚀', '🧑‍🔬', '👻', '👾', '🤖', '🦊', '🐻', '🐯', '🦁', '🐲', '🦅', '🦉', '🐍', '🦋', '🌙', '⭐', '🌟', '⚡', '🌊', '🌪️', '🌸', '🍀', '🌹', '🎭', '🎯', '🎲', '🏰', '🗝️', '🔮', '🪬', '🧿', '🪷', '💠', '❤️‍🔥', '🖤', '🤍', '💜', '💚', '💙', '🧡', '🩵', '🩶', '💫', '🛡️',
]



// Descanso: rolagem auditável e aplicação opcional na ficha por RPC existente.
type RestRecovery = { pv: number; ps: number; pr: number; fullPV: boolean; fullPR: boolean; foodItemId: string | null; kitItemId: string | null; kitType: string; requestId: string }
function RestActionsPanel({ onApply, canApply, maxPR, inventoryItems }: {
  inventoryItems: Item[]
  onApply: (recovery: RestRecovery) => Promise<void>
  canApply: boolean
  maxPR: number
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [rest, setRest] = useState('mediano')
  const [bonus, setBonus] = useState('nenhum')
  const [kit, setKit] = useState('nenhum')
  const [kitTest, setKitTest] = useState('20')
  const [foodItemId, setFoodItemId] = useState('')
  const [kitItemId, setKitItemId] = useState('')
  const [exhaustedDays, setExhaustedDays] = useState(0)
  const [result, setResult] = useState('')
  const [recovery, setRecovery] = useState<RestRecovery | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const allowedBonus = rest === 'precario' ? ['nenhum', 'respirar'] : rest === 'mediano' || rest === 'completo' ? ['nenhum','refeicao','meditacao','respirar'] : ['nenhum']
  const hasCategory = (item: Item, category: string) => item.category === category || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes(category))
  const usable = (item: Item) => hasCategory(item, 'Consumíveis') && item.quantity > 0 && item.metadata?.scarcityExhausted !== true && Number(item.metadata?.scarcityCharge ?? 1) > 0
  const foods = inventoryItems.filter(item => usable(item) && hasCategory(item, 'Alimentos'))
  const bandages = inventoryItems.filter(item => usable(item) && /bandag(em|ens)/i.test(item.name))
  const therapistKits = inventoryItems.filter(item => usable(item) && /kit de terapeuta|kit terap[eê]utic|incenso/i.test(item.name))
  const availableKits = kit === 'bandagens' ? bandages : kit === 'incensos' ? therapistKits : []
  const chosenFood = foods.find(item => item.id === foodItemId)
  const chosenKit = availableKits.find(item => item.id === kitItemId)
  const selectionError = (rest === 'nenhum' && kit !== 'nenhum') ? 'Sem descanso não permite utilizar kits.' : bonus === 'refeicao' && !chosenFood ? 'Selecione um alimento disponível no inventário.' : kit !== 'nenhum' && !chosenKit ? 'Selecione o kit disponível no inventário.' : ''
  const roll = (count: number, faces: number) => Array.from({length: count}, () => 1 + Math.floor(Math.random() * faces)).reduce((a,b) => a+b,0)
  const resetResult = () => {setResult('');setRecovery(null);setApplied(false)}
  const perform = () => {
    resetResult()
    if (rest === 'nenhum') {
      const days = exhaustedDays + 1
      setExhaustedDays(days)
      setResult(days >= 2 ? 'Segundo dia sem descanso: personagem inconsciente, Exausto e Vulnerável.' : 'Sem descanso: Exausto e Vulnerável até o próximo descanso.')
      return
    }
    if (selectionError) {setResult(selectionError);return}
    if (kit !== 'nenhum' && (!kitTest.trim() || !Number.isFinite(Number(kitTest)))) {
      setResult('Informe um resultado numérico válido para o teste do kit.')
      return
    }
    setExhaustedDays(0)
    let pv = 0, ps = 0, pr = 0
    if (rest === 'precario') { pv = roll(1,4); ps = roll(1,4) }
    if (rest === 'mediano') { pv = roll(bonus === 'refeicao' ? 4 : 2,6); ps = roll(bonus === 'meditacao' ? 2 : 1,6) }
    if (rest === 'completo') { pv = roll(bonus === 'refeicao' ? 8 : 4,6); ps = roll(bonus === 'meditacao' ? 4 : 2,6) }
    if (rest === 'intensivo') { ps = roll(6,6) }
    if (bonus === 'respirar') pr = Math.ceil(Math.max(0,maxPR) * (rest === 'precario' ? .25 : .5))
    let extra = ''
    if (kit === 'bandagens') { const passed = Number(kitTest) >= 20; pv += roll(passed ? 4 : 2,8); extra = ` Medicina DT 20: ${passed ? 'sucesso (+4d8 PV)' : 'falha (+2d8 PV)'}.` }
    if (kit === 'incensos') { const passed = Number(kitTest) >= 20; ps += roll(passed ? 2 : 1,8); extra = ` Terapia DT 20: ${passed ? 'sucesso (+2d8 PS)' : 'falha (+1d8 PS)'}. Até 4 participantes.` }
    const next: RestRecovery = {pv,ps,pr,fullPV:rest === 'intensivo',fullPR:rest === 'intensivo',foodItemId:bonus === 'refeicao' ? foodItemId : null,kitItemId:kit !== 'nenhum' ? kitItemId : null,kitType:kit,requestId:crypto.randomUUID()}
    setRecovery(next)
    setResult(rest === 'intensivo' ? `Após 3 dias: PV e PR totalmente restaurados; PS +${ps}.${extra}` : `Recuperação: PV +${pv}, PS +${ps}, PR +${pr}.${extra}`)
  }
  const restOptions = [
    {id:'nenhum',icon:'🌑',name:'Sem descanso',time:'Sem recuperação',desc:'Exausto e Vulnerável; 2 dias seguidos: inconsciente'},
    {id:'precario',icon:'🌙',name:'Precário',time:'Até 2 horas',desc:'1d4 PV · 1d4 PS'},
    {id:'mediano',icon:'🛏️',name:'Mediano',time:'Até 4 horas',desc:'2d6 PV · 1d6 PS'},
    {id:'completo',icon:'✨',name:'Completo',time:'Até 8 horas',desc:'4d6 PV · 2d6 PS'},
    {id:'intensivo',icon:'💚',name:'Intensivo',time:'3 dias completos',desc:'PV e PR totais · 6d6 PS'},
  ]
  const bonusOptions = [
    {id:'nenhum',icon:'➖',name:'Nenhum',desc:'Sem bônus adicional'},
    {id:'refeicao',icon:'🍲',name:'Refeição',desc:'Dobra os dados de PV'},
    {id:'meditacao',icon:'🧘',name:'Meditação',desc:'Dobra os dados de PS'},
    {id:'respirar',icon:'🌬️',name:'Respirar',desc:'Recupera 25% ou 50% dos PR'},
  ]
  const kitOptions = [
    {id:'nenhum',icon:'➖',name:'Nenhum',desc:'Sem tratamento adicional'},
    {id:'bandagens',icon:'🩹',name:'Tratamentos Prolongados',desc:'Medicina DT 20 · +4d8 ou +2d8 PV'},
    {id:'incensos',icon:'🪔',name:'Incensos Terapêuticos',desc:'Terapia DT 20 · +2d8 ou +1d8 PS'},
  ]
  const choiceStyle = (active:boolean, disabled=false): React.CSSProperties => ({
    display:'grid',gridTemplateColumns:'24px minmax(0,1fr)',alignContent:'center',alignItems:'center',columnGap:7,rowGap:2,textAlign:'left',
    border:active?'1px solid var(--accent, #6da6f6)':'1px solid var(--border, #5a5a5a55)',
    borderRadius:9,padding:'7px 9px',background:active?'color-mix(in srgb, var(--accent, #6da6f6) 12%, transparent)':'var(--surface, transparent)',
    opacity:disabled?.45:1,cursor:disabled?'not-allowed':'pointer',minWidth:0,width:'100%',color:'inherit',
  })
  const gridStyle:React.CSSProperties = {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))',gap:6,marginTop:5}
  const titleStyle:React.CSSProperties = {display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',marginBottom:3}
  const isUnconsumedItemBonus = bonus === 'refeicao' || kit !== 'nenhum'
  const restLabel = restOptions.find(option => option.id === rest)
  const bonusLabel = bonusOptions.find(option => option.id === bonus)
  const kitLabel = kitOptions.find(option => option.id === kit)
  const recoveryPreview = rest === 'nenhum' ? 'Exausto + Vulnerável' : rest === 'precario' ? '1d4 PV · 1d4 PS' : rest === 'mediano' ? `${bonus === 'refeicao' ? '4d6' : '2d6'} PV · ${bonus === 'meditacao' ? '2d6' : '1d6'} PS` : rest === 'completo' ? `${bonus === 'refeicao' ? '8d6' : '4d6'} PV · ${bonus === 'meditacao' ? '4d6' : '2d6'} PS` : 'PV + PR completos · 6d6 PS'
  const prPreview = bonus === 'respirar' ? ` · +${rest === 'precario' ? '25%' : '50%'} PR` : ''
  return <section className="combat-skill-test" style={{marginTop:6,display:'grid',gap:8,width:'100%',maxWidth:'none',minWidth:0,boxSizing:'border-box'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
      <div style={{display:'grid',gap:3}}><strong style={{fontSize:'1.05rem'}}>🛏️ Descanso e Recuperação</strong><small>Escolha as opções, confira os recursos e role a recuperação.</small></div>
      <span style={{fontSize:'.76rem',padding:'5px 9px',borderRadius:999,border:'1px solid var(--border, #5a5a5a55)'}}>🎲 {restLabel?.time}</span>
    </header>
    <div>
      <div style={titleStyle}><strong>01 · Tipo de descanso</strong><small>{restLabel?.name} selecionado</small></div>
      <div style={gridStyle}>{restOptions.map(option=><button type="button" key={option.id} style={choiceStyle(rest===option.id)} aria-pressed={rest===option.id} onClick={()=>{setRest(option.id);setBonus('nenhum');setFoodItemId('');setKit('nenhum');setKitItemId('');resetResult()}}>
        <span style={{fontSize:'1rem',gridRow:'1 / span 2'}}>{option.icon}</span><strong style={{fontSize:'.88rem'}}>{option.name} <span style={{fontWeight:400,opacity:.7}}>· {option.time}</span></strong><small style={{gridColumn:2,lineHeight:1.25,opacity:.8}}>{option.desc}</small>
      </button>)}</div>
    </div>
    <div>
      <div style={titleStyle}><strong>02 · Bônus do descanso</strong><small>{foods.length} alimento(s) disponível(is)</small></div>
      <div style={gridStyle}>{bonusOptions.map(option=>{const disabled=!allowedBonus.includes(option.id) || (option.id === 'refeicao' && foods.length === 0);return <button type="button" key={option.id} disabled={disabled} aria-pressed={bonus===option.id} style={choiceStyle(bonus===option.id,disabled)} onClick={()=>{setBonus(option.id);setFoodItemId('');resetResult()}}>
        <span style={{fontSize:'1rem',gridRow:'1 / span 2'}}>{option.icon}</span><strong style={{fontSize:'.88rem'}}>{option.name}</strong><small style={{gridColumn:2,lineHeight:1.25,opacity:.8}}>{option.desc}</small>
      </button>})}</div>
    </div>
    <div>
      {bonus === 'refeicao' && <label className="combat-skill-test-field" style={{display:'grid',gap:6,marginTop:8}}><span>🍲 Alimento disponível</span><select value={foodItemId} onChange={e=>{setFoodItemId(e.target.value);resetResult()}}><option value="">Selecione um alimento...</option>{foods.map(item=><option key={item.id} value={item.id}>{item.name} · Escassez nível {String(item.metadata?.scarcityLevel ?? 1)}</option>)}</select></label>}
    <div style={titleStyle}><strong>03 · Kit de tratamento</strong><small>{bandages.length + therapistKits.length} kit(s) disponível(is)</small></div>
      <div style={gridStyle}>{kitOptions.filter(option=>option.id==='nenhum'||(rest !== 'nenhum' && (option.id==='bandagens'?bandages:therapistKits).length>0)).map(option=><button type="button" key={option.id} aria-pressed={kit===option.id} style={choiceStyle(kit===option.id)} onClick={()=>{setKit(option.id);setKitItemId('');resetResult()}}>
        <span style={{fontSize:'1rem',gridRow:'1 / span 2'}}>{option.icon}</span><strong style={{fontSize:'.88rem'}}>{option.name}</strong><small style={{gridColumn:2,lineHeight:1.25,opacity:.8}}>{option.desc}</small>
      </button>)}</div>
      {kit!=='nenhum' && <label className="combat-skill-test-field" style={{display:'grid',gap:6,marginTop:8}}><span>🧰 Kit disponível</span><select value={kitItemId} onChange={e=>{setKitItemId(e.target.value);resetResult()}}><option value="">Selecione um kit...</option>{availableKits.map(item=><option key={item.id} value={item.id}>{item.name} · Escassez nível {String(item.metadata?.scarcityLevel ?? 1)}</option>)}</select></label>}
      {kit!=='nenhum' && <label className="combat-skill-test-field" style={{display:'grid',gap:6,marginTop:8,maxWidth:280}}><span>Resultado do teste · INT + {kit==='bandagens'?'Medicina':'Terapia'} (DT 20)</span><input type="number" value={kitTest} onChange={e=>{setKitTest(e.target.value);resetResult()}} /></label>}
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6,flexWrap:'wrap',padding:'6px 9px',border:'1px solid var(--border, #5a5a5a55)',borderRadius:9}}>
      <div style={{display:'grid',gap:2}}><strong style={{fontSize:'.87rem'}}>🎒 Recursos disponíveis</strong><small>🍲 {foods.length} alimentos · 🩹 {bandages.length} bandagens · 🪔 {therapistKits.length} kits terapêuticos</small></div>
      <button type="button" aria-expanded={showDetails} onClick={()=>setShowDetails(value=>!value)}>{showDetails?'Ocultar regras':'Ver regras'}</button>
    </div>
    {showDetails && <div style={{padding:10,borderRadius:10,background:'var(--surface, #80808015)',display:'grid',gap:5,fontSize:'.82rem'}}>
      <strong>📖 Regras rápidas</strong>
      <span>🌑 Sem descanso: Exausto e Vulnerável; segundo dia consecutivo: inconsciente.</span>
      <span>🍲 Refeição dobra os dados de PV; 🧘 Meditação dobra os dados de PS (descanso mediano ou completo).</span>
      <span>🌬️ Respirar: recupera 25% dos PR no precário ou 50% no mediano/completo.</span>
      <span>🩹 Bandagens: INT + Medicina DT 20, +4d8 PV no sucesso, +2d8 na falha.</span>
      <span>🪔 Kit de Terapeuta: INT + Terapia DT 20, +2d8 PS no sucesso, +1d8 na falha; até 4 jogadores.</span>
      <span>⚠️ Consumo por Escassez ainda depende de uma operação transacional no Supabase.</span>
    </div>}
    <div style={{padding:9,borderRadius:9,border:'1px solid var(--border, #5a5a5a55)',display:'grid',gap:5}}>
      <strong>📋 Resumo e recuperação</strong>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,fontSize:'.82rem'}}>
        {[`${restLabel?.icon} ${restLabel?.name}`,`${bonusLabel?.icon} ${bonusLabel?.name}`,`${kitLabel?.icon} ${kitLabel?.name}`].map(label=><span key={label} style={{padding:'5px 8px',borderRadius:7,background:'var(--surface, #80808015)'}}>{label}</span>)}
      </div>
      <div style={{fontSize:'.9rem'}}><strong>Recuperação prevista:</strong> {recoveryPreview}{prPreview}{kit !== 'nenhum' ? ` · ${kit === 'bandagens' ? '+4d8/+2d8 PV' : '+2d8/+1d8 PS'} (DT 20)` : ''}</div>
      {chosenFood && <small>🍲 Alimento: {chosenFood.name}</small>}
      {chosenKit && <small>🧰 Kit: {chosenKit.name}</small>}
      {isUnconsumedItemBonus && <small>🎲 Ao aplicar, o Supabase rolará a Escassez e salvará o consumo junto da recuperação.</small>}
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        <button type="button" disabled={Boolean(selectionError)} onClick={perform}>🎲 {rest === 'nenhum' ? 'Registrar sem descanso' : 'Rolar recuperação'}</button>
        {recovery && <button type="button" disabled={!canApply || applying || applied} onClick={async()=>{setApplying(true);try{await onApply(recovery);setApplied(true)}catch(e){setResult(`Falha ao aplicar: ${e instanceof Error ? e.message : String(e)}`)}finally{setApplying(false)}}}>{applying?'Salvando...':applied?'✓ Aplicado':'💚 Aplicar na ficha'}</button>}
      </div>
      {selectionError && <small role="alert" style={{color:'var(--warning, #d9a64c)'}}>⚠️ {selectionError}</small>}
      {result && <div role="status" style={{display:'grid',gap:7,padding:10,borderRadius:9,background:'var(--surface, #80808015)'}}>
        <strong>🎲 Resultado do descanso</strong>
        {recovery && <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:6}}>
          {([['❤️','PV',recovery.fullPV?'Total':`+${recovery.pv}`],['🧠','PS',`+${recovery.ps}`],['💨','PR',recovery.fullPR?'Total':`+${recovery.pr}`]] as const).map(([emoji,name,value])=><div key={name} style={{padding:9,borderRadius:8,border:'1px solid var(--border, #5a5a5a55)',textAlign:'center',display:'grid',gap:3}}><small>{emoji} {name}</small><strong style={{fontSize:'1.2rem'}}>{value}</strong></div>)}
        </div>}
        <small>{result}</small>
        {applied && <small>✓ Recuperação salva na ficha.</small>}
      </div>}
      {!canApply && <small>Para aplicar os pontos, selecione uma ficha que você possa editar.</small>}
    </div>
    <small>Condições de Exausto, Vulnerável e Inconsciente ainda exigem registro manual. A recuperação por rolagem não é persistida até clicar em Aplicar.</small>
  </section>
}

function App() {                                                                                                                                                                                                                                                                                                                                                                                                                                                                
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [campaignNews, setCampaignNews] = useState<Array<{id:string;title:string;body:string;image_url:string|null;created_at:string;updated_at:string}>>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState('')
  const [newsEditingId, setNewsEditingId] = useState<string | null>(null)
  const [newsTitle, setNewsTitle] = useState('')
  const [newsBody, setNewsBody] = useState('')
  const [newsImageUrl, setNewsImageUrl] = useState('')
  const [newsImageFile, setNewsImageFile] = useState<File | null>(null)
  const [newsShowHistory, setNewsShowHistory] = useState(false)
  const [newsShowEditor, setNewsShowEditor] = useState(false)
  const [newsSaving, setNewsSaving] = useState(false)
  const [newsRefresh, setNewsRefresh] = useState(0)

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  )
  const activeSystem = getSystemByName(selectedCampaign?.system_name)
  const isKisatsutaiSystem = activeSystem?.id === 'kisatsutai'

  const isCyberFlowerSystem =
  activeSystem?.data?.features?.hasCyberneticsInventory === true

  const resourceAbbreviation = isKisatsutaiSystem
    ? 'PR'
    : isCyberFlowerSystem
      ? 'PE'
      : 'PM'

  const resourceName = isKisatsutaiSystem
    ? 'Respiração'
    : isCyberFlowerSystem
      ? 'Eletrização'
      : 'Mana'

  const resourcePointsLabel = isKisatsutaiSystem
    ? 'Pontos de Respiração (PR)'
    : isCyberFlowerSystem
      ? 'Pontos de Eletrização (PE)'
      : 'Pontos de Mana (PM)'

  // Inimigos de Kisatsutai usam Pontos de Sangue, sem conflitar com PS (Sanidade).
  const enemyResourceAbbreviation = isKisatsutaiSystem ? 'SG' : resourceAbbreviation
  const enemyResourcePointsLabel = isKisatsutaiSystem ? 'Pontos de Sangue' : resourcePointsLabel

  const systemRanks = activeSystem?.data?.ranks ?? []
  const systemArchetypes = activeSystem?.data?.archetypes ?? []
  const systemLogic = activeSystem?.logic
  const systemFeatures = activeSystem?.data?.features ?? {
    usesRanks: false,
    usesLevels: true,
    usesFamilyTiers: false,
    usesSkillPoints: false,
    hasDefaultCurrency: false,
  }
  const getSystemRankName = systemLogic?.getRankName ?? (
  (rankId: string) =>
    systemRanks.find(rank => rank.id === rankId)?.name ??
    systemRanks[0]?.name ??
    ''
  )
  const getSystemRank = (rankId: string) =>
    systemLogic?.getRank?.(rankId) ??
    systemRanks.find(rank => rank.id === rankId) ??
    systemRanks[0]
  const getSystemRankStatus = (rankId: string) =>
  systemLogic?.getRankStatus?.(rankId) ?? {
    pv: 0,
    ps: 0,
    pr: 0,
  }
  const getSystemFamilyTier = (tierKey: string) =>
    systemLogic?.getFamilyTier?.(tierKey)
  const getSystemFamilyTiers = () =>
    systemLogic?.getFamilyTiers?.() ?? []
  const getSystemAttributeBonus = (
    tierKey: string,
    attribute: 'strength' | 'agility' | 'defense' | 'breathing' | 'intellect'
  ) => systemLogic?.getAttributeBonus?.(tierKey, attribute) ?? 0
  const getSystemPromotionId = (from: string, to: string) =>
    systemLogic?.getPromotionId?.(from, to) ?? `${from}>${to}`
    const hasSystemPromotion = (
    promotionLog: { transition?: string }[],
    transition: string
  ) =>
    systemLogic?.hasPromotion?.(promotionLog, transition) ?? false

  const createSystemPromotionEntry = (
    from: string,
    to: string,
    id: string,
    at: string,
    description: string
  ) =>
    systemLogic?.createPromotionEntry?.(
      from,
      to,
      id,
      at,
      description
    )

  const findSystemRank = (rankId: string) =>
    systemLogic?.findRank?.(rankId)

  const createSystemDefaultCurrencyConfig = () =>
    systemLogic?.createDefaultCurrencyConfig?.() ?? { currencies: [] }
  const isMaster = selectedCampaign?.role === 'master'
  useEffect(() => {
    setNewsEditingId(null)
    setNewsTitle('')
    setNewsBody('')
    setNewsImageUrl('')
    setNewsImageFile(null)
    setNewsShowHistory(false)
    setNewsShowEditor(false)
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId) { setCampaignNews([]); setNewsError(''); return }
    let cancelled = false
    const load = async () => {
      setNewsLoading(true)
      const { data, error } = await supabase.from('campaign_news')
        .select('id,title,body,image_url,created_at,updated_at')
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setNewsLoading(false)
      setNewsError(error ? 'Não foi possível carregar as notícias. Confira se a migração SQL v122 foi aplicada.' : '')
      setCampaignNews((data ?? []) as typeof campaignNews)
    }
    void load()
    return () => { cancelled = true }
  }, [selectedCampaignId, newsRefresh])

  const resetNewsEditor = () => {
    setNewsEditingId(null); setNewsTitle(''); setNewsBody(''); setNewsImageUrl(''); setNewsImageFile(null); setNewsShowEditor(false)
  }
  const editCampaignNews = (item: (typeof campaignNews)[number]) => {
    setNewsEditingId(item.id); setNewsTitle(item.title); setNewsBody(item.body)
    setNewsImageUrl(item.image_url || ''); setNewsImageFile(null); setNewsShowEditor(true)
  }
  const saveCampaignNews = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isMaster || !selectedCampaignId || !newsTitle.trim() || !newsBody.trim() || newsSaving) return
    setNewsSaving(true)
    setNewsError('')
    let imageUrl = newsImageUrl.trim() || null
    if (newsImageFile) {
      if (!newsImageFile.type.startsWith('image/') || newsImageFile.size > 5 * 1024 * 1024) {
        setNewsError('Selecione uma imagem válida de até 5 MB.'); setNewsSaving(false); return
      }
      const extension = (newsImageFile.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
      const filePath = `${selectedCampaignId}/${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage.from('campaign-news-images').upload(filePath, newsImageFile, { contentType: newsImageFile.type, upsert: false })
      if (upload.error) { setNewsError(`Erro ao enviar imagem: ${upload.error.message}`); setNewsSaving(false); return }
      imageUrl = supabase.storage.from('campaign-news-images').getPublicUrl(filePath).data.publicUrl
    }
    const payload = { title: newsTitle.trim(), body: newsBody.trim(), image_url: imageUrl }
    const result = newsEditingId
      ? await supabase.from('campaign_news').update(payload).eq('id', newsEditingId).eq('campaign_id', selectedCampaignId)
      : await supabase.from('campaign_news').insert({ ...payload, campaign_id: selectedCampaignId, author_id: session?.user.id })
    setNewsSaving(false)
    if (result.error) { setNewsError(result.error.message); return }
    resetNewsEditor(); setNewsRefresh(n => n + 1)
  }
  const deleteCampaignNews = async (id: string) => {
    if (!isMaster || !selectedCampaignId || !window.confirm('Excluir esta notícia da campanha?')) return
    const { error } = await supabase.from('campaign_news').delete().eq('id', id).eq('campaign_id', selectedCampaignId)
    if (error) { setNewsError(error.message); return }
    if (newsEditingId === id) resetNewsEditor()
    setNewsRefresh(n => n + 1)
  }

  const [characters, setCharacters] = useState<Character[]>([])
  const [sheetCharacterSearch, setSheetCharacterSearch] = useState('')
  const [sheetCharacterArchetype, setSheetCharacterArchetype] = useState('all')
  const [sheetSeasonFilter, setSheetSeasonFilter] = useState('all')
  const [sheetTeamFilter, setSheetTeamFilter] = useState('all')
  const [sheetSeasonRoster, setSheetSeasonRoster] = useState<Record<string, Record<string, {participating:boolean;party:boolean;team:string;teams:string[]}>>>({})
  const [sheetCharacterOwnerFilter, setSheetCharacterOwnerFilter] = useState<'all' | 'mine' | 'assigned' | 'unassigned'>('all')
  const [sheetCharacterSort, setSheetCharacterSort] = useState<'name' | 'recent' | 'level' | 'favorites'>('name')
  const [sheetCharacterLayout, setSheetCharacterLayout] = useState<'grid' | 'list'>('grid')
  const [sheetOnlyFavorites, setSheetOnlyFavorites] = useState(false)
  const [sheetFavoriteCollections, setSheetFavoriteCollections] = useState<Record<string, string[]>>(() => {
    try {
      const stored = window.localStorage.getItem('haxbag:sheet-character-favorites:v1')
      const parsed: unknown = stored ? JSON.parse(stored) : {}
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string[]> : {}
    } catch { return {} }
  })
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const conditionModifiers = useCharacterConditionModifiers(selectedCampaignId, selectedCharacterId)
  const conditionRules = useCharacterConditionRules(selectedCampaignId, selectedCharacterId)

  const [characterNameDraft, setCharacterNameDraft] = useState('')
  const [characterNameSaving, setCharacterNameSaving] = useState(false)
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null)
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([])
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null)
  const [characterGrants, setCharacterGrants] = useState<CharacterGrant[]>([])
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [transferItem, setTransferItem] = useState<Item | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferQuantity, setTransferQuantity] = useState(1)
  const [transferSaving, setTransferSaving] = useState(false)
  const [currencyBalances, setCurrencyBalances] = useState<Record<string, number>>({})
  const [currencyAmount, setCurrencyAmount] = useState('')
  const [currencyDescription, setCurrencyDescription] = useState('')
  const [currencyAdjustmentId, setCurrencyAdjustmentId] = useState('')
  const [conversionFromId, setConversionFromId] = useState('')
  const [conversionToId, setConversionToId] = useState('')
  const [conversionAmount, setConversionAmount] = useState('')

  const [currencyActionLoading, setCurrencyActionLoading] = useState(false)
  const [currencyLoading, setCurrencyLoading] = useState(false)
  const [showCurrencyHistory, setShowCurrencyHistory] = useState(false)
  const [currencyTransactions, setCurrencyTransactions] = useState<CurrencyTransaction[]>([])
  const [currencyHistoryLoading, setCurrencyHistoryLoading] = useState(false)
  const [currencyDraftName, setCurrencyDraftName] = useState('')
  const [currencyDraftSymbol, setCurrencyDraftSymbol] = useState('')
  const [currencyDraftRate, setCurrencyDraftRate] = useState('1')
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null)
  const [currencyConfigSaving, setCurrencyConfigSaving] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedItemDetails, setSelectedItemDetails] = useState<Item | null>(null)
  const [saleQuantity, setSaleQuantity] = useState('1')
  const [shopSaleQuantities, setShopSaleQuantities] = useState<Record<string, string>>({})
  const [saleShopId, setSaleShopId] = useState('')
  const [saleLoading, setSaleLoading] = useState(false)
  const [shops, setShops] = useState<CampaignShop[]>([])
  const [creatures, setCreatures] = useState<CampaignCreature[]>([])
  const [enemies, setEnemies] = useState<CampaignEnemy[]>([])
  const [enemiesLoading, setEnemiesLoading] = useState(false)
  const [enemyPartySavingId, setEnemyPartySavingId] = useState<string | null>(null)
  const [enemyPartyInitiativeDrafts, setEnemyPartyInitiativeDrafts] = useState<Record<string, string>>({})
  const [enemyPartyRefreshKey, setEnemyPartyRefreshKey] = useState(0)
  const [enemySearch, setEnemySearch] = useState('')
  const [enemyArchetypeFilter, setEnemyArchetypeFilter] = useState('all')
  const [enemySortOrder, setEnemySortOrder] = useState<'recent' | 'name' | 'oldest'>('recent')
  const [enemyStatusFilter, setEnemyStatusFilter] = useState<'all' | 'configured' | 'unconfigured' | 'party' | 'critical'>('all')
  const [enemyViewMode, setEnemyViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null)
  const [enemySheetView, setEnemySheetView] = useState(false)
  const [showEnemyForm, setShowEnemyForm] = useState(false)
  const [editingEnemyId, setEditingEnemyId] = useState<string | null>(null)
  const [enemySaving, setEnemySaving] = useState(false)
  const [enemyName, setEnemyName] = useState('')
  const [enemyEmoji, setEnemyEmoji] = useState('👹')
  const [enemyArchetype, setEnemyArchetype] = useState('')
  const [enemyDescription, setEnemyDescription] = useState('')
  const [creaturesLoading, setCreaturesLoading] = useState(false)
  const [creatureSearch, setCreatureSearch] = useState('')
  const [creatureCategoryFilter, setCreatureCategoryFilter] = useState('Todas')
  const [creatureThreatFilter, setCreatureThreatFilter] = useState('Todas')
  const [creatureVisibilityFilter, setCreatureVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [creatureSortOrder, setCreatureSortOrder] = useState<'name' | 'threat' | 'recent'>('name')
  const [creatureViewMode, setCreatureViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null)
  const [showCreatureForm, setShowCreatureForm] = useState(false)
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null)
  const [creatureSaving, setCreatureSaving] = useState(false)
  const [creatureName, setCreatureName] = useState('')
  const [creatureCategory, setCreatureCategory] = useState('Outros')
  const [creatureDescription, setCreatureDescription] = useState('')
  const [creatureImageUrl, setCreatureImageUrl] = useState('')
  const [creatureImageFile, setCreatureImageFile] = useState<File | null>(null)
  const [creatureImagePreview, setCreatureImagePreview] = useState('')
  const [creatureStoredImagePreview, setCreatureStoredImagePreview] = useState('')
  const [creatureThreatLevel, setCreatureThreatLevel] = useState('Comum')
  const [creaturePv, setCreaturePv] = useState('')
  const [creaturePs, setCreaturePs] = useState('')
  const [creaturePr, setCreaturePr] = useState('')
  const [creatureResistances, setCreatureResistances] = useState('')
  const [creatureWeaknesses, setCreatureWeaknesses] = useState('')
  const [creatureImmunities, setCreatureImmunities] = useState('')
  const [creatureVices, setCreatureVices] = useState('')
  const [creaturePeculiarities, setCreaturePeculiarities] = useState('')

const accessibleCreatures = isMaster ? creatures : creatures.filter(creature => !creature.is_hidden)
const creatureThreatOrder = ['Comum', 'Baixo', 'Moderado', 'Alto', 'Lua Inferior', 'Extremo', 'Lua Superior', 'Lendário']
const creatureThreatTone = (level: string) =>
  ['Lendário', 'Lua Superior', 'Extremo'].includes(level) ? 'extreme' :
  ['Lua Inferior', 'Alto'].includes(level) ? 'high' :
  level === 'Moderado' ? 'moderate' : 'common'
const creatureCategories = [
  'Todas',
  ...Array.from(new Set(accessibleCreatures.map(creature => creature.category))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  ),
]
const creatureThreatLevels = [
  'Todas',
  ...Array.from(new Set(accessibleCreatures.map(creature => creature.threat_level))).sort((a, b) =>
    (creatureThreatOrder.indexOf(a) < 0 ? 99 : creatureThreatOrder.indexOf(a)) -
    (creatureThreatOrder.indexOf(b) < 0 ? 99 : creatureThreatOrder.indexOf(b))
  ),
]
const filteredCreatures = accessibleCreatures.filter(creature => {
  const query = creatureSearch.trim().toLocaleLowerCase('pt-BR')
  const searchText = [creature.name, creature.category, creature.threat_level,
    creature.description ?? '', ...(creature.resistances ?? []),
    ...(creature.weaknesses ?? []), ...(creature.immunities ?? []),
    ...readCreatureTraits(creature, 'vices'), ...readCreatureTraits(creature, 'peculiarities'),
  ].join(' ').toLocaleLowerCase('pt-BR')
  return (!query || searchText.includes(query)) &&
    (creatureCategoryFilter === 'Todas' || creature.category === creatureCategoryFilter) &&
    (creatureThreatFilter === 'Todas' || creature.threat_level === creatureThreatFilter) &&
    (!isMaster || creatureVisibilityFilter === 'all' ||
      (creatureVisibilityFilter === 'hidden' ? creature.is_hidden : !creature.is_hidden))
}).sort((a, b) => {
  if (creatureSortOrder === 'recent') return Date.parse(b.created_at) - Date.parse(a.created_at)
  if (creatureSortOrder === 'threat') {
    const aRank = creatureThreatOrder.indexOf(a.threat_level)
    const bRank = creatureThreatOrder.indexOf(b.threat_level)
    const difference = (bRank < 0 ? -1 : bRank) - (aRank < 0 ? -1 : aRank)
    if (difference) return difference
  }
  return a.name.localeCompare(b.name, 'pt-BR')
})
const selectedCreature = accessibleCreatures.find(creature => creature.id === selectedCreatureId) ?? null
const creatureFiltersActive = Boolean(creatureSearch.trim()) || creatureCategoryFilter !== 'Todas' ||
  creatureThreatFilter !== 'Todas' || (isMaster && creatureVisibilityFilter !== 'all')
const resetCreatureFilters = () => {
  setCreatureSearch('')
  setCreatureCategoryFilter('Todas')
  setCreatureThreatFilter('Todas')
  setCreatureVisibilityFilter('all')
}
  const [shopItems, setShopItems] = useState<CampaignShopItem[]>([])
  const [selectedShopId, setSelectedShopId] = useState('')
  const [shopPurchaseCharacterId, setShopPurchaseCharacterId] = useState('')
  const [shopPurchaseQuantities, setShopPurchaseQuantities] = useState<Record<string, string>>({})

  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShopId, setEditingShopId] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')

  const [showShopItemForm, setShowShopItemForm] = useState(false)
  const [editingShopItemId, setEditingShopItemId] = useState<string | null>(null)
  const [shopItemName, setShopItemName] = useState('')
  const [shopItemDescription, setShopItemDescription] = useState('')
  const [shopItemCategory, setShopItemCategory] = useState('Diversos')
  const [shopItemRarity, setShopItemRarity] = useState('comum')
  const [shopItemWeight, setShopItemWeight] = useState('0')
  const [shopItemPrice, setShopItemPrice] = useState('0')
  const [shopItemCurrencyId, setShopItemCurrencyId] = useState('')
  const [shopItemStock, setShopItemStock] = useState('')
  const [shopItemEmoji, setShopItemEmoji] = useState('📦')
  const [shopItemCategories, setShopItemCategories] = useState<string[]>(['Diversos'])
  const [shopItemEquipmentType, setShopItemEquipmentType] = useState<'none' | 'armor' | 'protection' | 'cybernetic'>('none')
  const [shopCyberneticCategory, setShopCyberneticCategory] = useState('Outro')
  const [shopCyberneticLocation, setShopCyberneticLocation] = useState('')
  const [shopCyberneticLoad, setShopCyberneticLoad] = useState('0')
  const [shopCyberneticEffects, setShopCyberneticEffects] = useState('')
  const [shopItemArmorClass, setShopItemArmorClass] = useState<'leve' | 'media' | 'pesada'>('leve')
  const [shopItemArmorCoverage, setShopItemArmorCoverage] = useState<'cortante_perfurante' | 'especial_bruto' | 'todos'>('cortante_perfurante')
  const [shopItemProtectionTier, setShopItemProtectionTier] = useState<'basica' | 'moderada' | 'avancada'>('basica')
  const [shopItemProtectionMode, setShopItemProtectionMode] = useState<'resistencia' | 'sanidade'>('resistencia')
  const [shopItemWeaponClass, setShopItemWeaponClass] = useState('improvised')
  const [shopItemScarcityLevel, setShopItemScarcityLevel] = useState<'1' | '2' | '3' | '4'>('1')
  const [shopItemScarcityExhausted, setShopItemScarcityExhausted] = useState(false)

  const [shopLoading, setShopLoading] = useState(false)
  const [shopPurchaseLoading, setShopPurchaseLoading] = useState<string | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [campaignActivities, setCampaignActivities] = useState<CampaignActivity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityTableMissing, setActivityTableMissing] = useState(false)
  const [showAllCampaignActivities, setShowAllCampaignActivities] = useState(false)
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [masterShieldSeasonId, setMasterShieldSeasonId] = useState('')
  const [masterShieldSheets, setMasterShieldSheets] = useState<Record<string, Record<string, any>>>({})
  const [cyberneticsArchetypeSheets, setCyberneticsArchetypeSheets] = useState<Record<string, Record<string, any>>>({})
  const [, setMasterShieldGrantRows] = useState<Array<{ character_id: string; user_id: string }>>([])
  const [masterShieldLoading, setMasterShieldLoading] = useState(false)
  const [masterShieldRefreshKey, setMasterShieldRefreshKey] = useState(0)
  const [seasonNameDraft, setSeasonNameDraft] = useState('')
  const [seasonDescriptionDraft, setSeasonDescriptionDraft] = useState('')
  const [seasonThemeSaving, setSeasonThemeSaving] = useState(false)
  const [seasonVisualStyleSaving, setSeasonVisualStyleSaving] = useState(false)
  const [seasonOrderSaving, setSeasonOrderSaving] = useState(false)
  const [showSeasonEditor, setShowSeasonEditor] = useState(false)

  async function recordCampaignActivity(input: {
  activityType: string
  title: string
  description?: string | null
  entityType?: string | null
  entityId?: string | null
  campaignId?: string
}) {
  const campaignId = input.campaignId ?? selectedCampaignId

  if (!campaignId || !session?.user.id) {
    const reason = !campaignId
      ? 'Nenhuma campanha foi identificada.'
      : 'Nenhum usuário autenticado foi identificado.'

    console.error('Histórico de atividades:', reason)
    setError(`Não foi possível registrar a atividade: ${reason}`)
    return
  }

  const payload = {
    campaign_id: campaignId,
    actor_id: session.user.id,
    actor_name: displayNameForMembers(session),
    activity_type: input.activityType,
    title: input.title,
    description: input.description ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  }

  try {
    const { data, error: insertError } = await supabase
      .from('campaign_activity')
      .insert(payload)
      .select('id,campaign_id,actor_id,actor_name,activity_type,title,description,entity_type,entity_id,created_at')
      .single()

    if (insertError) {
      console.error('Erro ao registrar atividade:', insertError)
      setError(
        `Falha ao registrar atividade: ${insertError.message} (código: ${insertError.code ?? 'desconhecido'})`
      )
      return
    }

    const activity = data as CampaignActivity

    setCampaignActivities(current =>
      [activity, ...current.filter(entry => entry.id !== activity.id)].slice(0, 30)
    )
  } catch (err) {
    console.error('Erro inesperado no histórico:', err)
    setError(
      `Erro inesperado ao registrar atividade: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

  const activeSeason = seasons.find(entry => entry.id === selectedSeasonId)
  const activeThemeKey = activeSeason?.theme_key && activeSeason.theme_key in seasonThemes ? activeSeason.theme_key as keyof typeof seasonThemes : 'default'
  const activeTheme = seasonThemes[activeThemeKey]
  const activeVisualStyleKey: VisualStyleKey = activeSeason?.visual_style_key === 'tyr'
    ? 'hax' // Compatibilidade com temporadas que usavam o antigo Tÿr
    : activeSeason?.visual_style_key && activeSeason.visual_style_key in visualStyles
      ? activeSeason.visual_style_key as VisualStyleKey
      : 'classic'
  const activeVisualStyle = visualStyles[activeVisualStyleKey]

  // Janelas renderizadas por createPortal ficam fora de .app-shell.
  // Espelhamos o estilo e a paleta no body para modais e seletores flutuantes,
  // restaurando os valores anteriores ao trocar de tema ou desmontar o app.
  useEffect(() => {
    const body = document.body
    const oldStyle = body.getAttribute('data-hb-visual-style')
    const palette: Record<string, string> = {
      '--season-primary': activeTheme.primary,
      '--season-secondary': activeTheme.secondary,
      '--season-glow': activeTheme.glow,
      '--season-bg': activeTheme.bg,
      '--season-surface': activeTheme.surface,
      '--season-surface-alt': activeTheme.surfaceAlt,
      '--season-line': activeTheme.line,
      '--season-muted': '#b9b4c2',
      '--season-on-primary': activeTheme.onPrimary,
    }
    const oldProperties = Object.entries(palette).map(([property, value]) => {
      const previousValue = body.style.getPropertyValue(property)
      const previousPriority = body.style.getPropertyPriority(property)
      body.style.setProperty(property, value)
      return { property, previousValue, previousPriority }
    })
    body.dataset.hbVisualStyle = activeVisualStyleKey
    return () => {
      if (oldStyle === null) body.removeAttribute('data-hb-visual-style')
      else body.setAttribute('data-hb-visual-style', oldStyle)
      oldProperties.forEach(({ property, previousValue, previousPriority }) => {
        if (previousValue) body.style.setProperty(property, previousValue, previousPriority)
        else body.style.removeProperty(property)
      })
    }
  }, [activeThemeKey, activeVisualStyleKey])

  const [creatingSeason, setCreatingSeason] = useState(false)
  const creatingSeasonRef = useRef(false)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileUsernameDraft, setProfileUsernameDraft] = useState('')
  const [profileAvatarDraft, setProfileAvatarDraft] = useState('')
  const [profileBioDraft, setProfileBioDraft] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonDescription, setNewSeasonDescription] = useState('')
  const [sheet, setSheet] = useState<CharacterSheet | null>(null)
  const [sheetDraft, setSheetDraft] = useState('{}')
  const sheetDraftRef = useRef(sheetDraft)
    sheetDraftRef.current = sheetDraft
  const [enemySheetDraft, setEnemySheetDraft] = useState('{}')
  const enemySheetDraftRef = useRef(enemySheetDraft)
    enemySheetDraftRef.current = enemySheetDraft
  const [enemySheetLoading, setEnemySheetLoading] = useState(false)
  const [enemySheetSaving, setEnemySheetSaving] = useState(false)
  const [enemySheetDirty, setEnemySheetDirty] = useState(false)
  const [enemyAutoSaveStatus, setEnemyAutoSaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle')
  const enemyFailedAutoSaveDraftRef = useRef<string | null>(null)
  const enemySheetSavingRef = useRef(false)
  const [enemyEditingSheet, setEnemyEditingSheet] = useState(false)






  // Valores de ajuste são controles temporários, não dados da ficha.

  const [enemyItemSearch, setEnemyItemSearch] = useState('')
  const [enemyFavoriteOnly, setEnemyFavoriteOnly] = useState(false)
  const [enemySortBy, setEnemySortBy] = useState('created')
  const [enemyWalletCurrency, setEnemyWalletCurrency] = useState('')
  const [enemyWalletAmount, setEnemyWalletAmount] = useState('')
  const [enemyWalletDescription, setEnemyWalletDescription] = useState('')
  const [enemyWalletFrom, setEnemyWalletFrom] = useState('')
  const [enemyWalletTo, setEnemyWalletTo] = useState('')
  const [enemyWalletConversionAmount, setEnemyWalletConversionAmount] = useState('')
  const [enemyWalletShowHistory, setEnemyWalletShowHistory] = useState(false)

  const [enemyItemCategory, setEnemyItemCategory] = useState('Todos')
  const [enemyItemEditorOpen, setEnemyItemEditorOpen] = useState(false)
  const [enemyItemEditorIndex, setEnemyItemEditorIndex] = useState<number | null>(null)
  const [enemyItemForm, setEnemyItemForm] = useState<Record<string, any>>({})
  const enemySheetLoadedForRef = useRef<string | null>(null)
  const selectedEnemy = enemies.find(
    enemy => enemy.id === selectedEnemyId
  ) ?? null
  const [enemySheetNameDraft, setEnemySheetNameDraft] = useState('')
  const [enemySheetNameSaving, setEnemySheetNameSaving] = useState(false)
  useEffect(() => { setEnemySheetNameDraft(selectedEnemy?.name ?? '') }, [selectedEnemy?.id, selectedEnemy?.name])

  const enemySystemName = selectedCampaign?.system_name || ''

const enemySystemFeatures =
  getSystemByName(enemySystemName)?.data?.features

const enemyUsesFamilyTiers =
  enemySystemFeatures?.usesFamilyTiers ?? false

const enemyUsesRanks =
  enemySystemFeatures?.usesRanks ?? false

const enemyTierKey = String(
  readEnemySheet('family.tier', '5')
)

const enemyAttributeBonuses = {
  strength: enemyUsesFamilyTiers ? getSystemAttributeBonus(enemyTierKey, 'strength') : 0,
  agility: enemyUsesFamilyTiers ? getSystemAttributeBonus(enemyTierKey, 'agility') : 0,
  defense: enemyUsesFamilyTiers ? getSystemAttributeBonus(enemyTierKey, 'defense') : 0,
  breathing: enemyUsesFamilyTiers ? getSystemAttributeBonus(enemyTierKey, 'breathing') : 0,
  intellect: enemyUsesFamilyTiers ? getSystemAttributeBonus(enemyTierKey, 'intellect') : 0,
}
const enemyEffectiveAttribute = (attribute: SheetAttribute) =>
  calculateSheetAttribute(readEnemySheet, attribute, enemyAttributeBonuses[attribute])

const enemySkillPointConfig = activeSystem?.data?.skillPoints
const enemyUsesSkillPoints = systemFeatures?.usesSkillPoints ?? false
  function getEnemySheetOverview(enemy: CampaignEnemy) {
    const data = enemy.sheet_data || {}
    const readFromEnemy = (path: string, fallback: any = 0) =>
      path.split('.').reduce((current: any, key: string) =>
        current && typeof current === 'object' ? current[key] : undefined,
        data as any,
      ) ?? fallback
    const tierKey = String(readFromEnemy('family.tier', '5'))
    const tier = enemyUsesFamilyTiers ? getSystemFamilyTier(tierKey) : null
    const rank = enemyUsesRanks
      ? getSystemRankStatus(String(readFromEnemy('progression.rankId', 'zaidan')))
      : { pv: 0, ps: 0, pr: 0 }
    const breathingBonus = enemyUsesFamilyTiers
      ? getSystemAttributeBonus(tierKey, 'breathing') : 0
    const breathing = calculateSheetAttribute(readFromEnemy, 'breathing', breathingBonus)
    const skill = (key: SheetSkill) => calculateSheetSkill(
      readFromEnemy, key, enemyUsesSkillPoints ? enemySkillPointConfig : null, true,
    )
    const bonus = (path: string) => Number(readFromEnemy(path, 0)) || 0
    const maxPV = Math.max(0, skill('vigor') * 10 + (tier?.pv ?? 0) +
      rank.pv + bonus('progression.classStatus.pv') + bonus('progression.statusBonuses.pv'))
    const maxPS = Math.max(0, skill('mental') * 10 + (tier?.ps ?? 0) +
      rank.ps + bonus('progression.classStatus.ps') + bonus('progression.statusBonuses.ps'))
    const maxPR = Math.max(0, (breathing + skill('ability')) * 10 + (tier?.pr ?? 0) +
      rank.pr + bonus('progression.classStatus.pr') + bonus('progression.statusBonuses.pr'))
    const currentStatus = readFromEnemy('status.current', {})
    const hasStats = Boolean(
      data.status?.current || data.skills?.vigor !== undefined ||
      data.skills?.mental !== undefined || data.attributes?.strength !== undefined ||
      data.progression?.statusBonuses,
    )
    const current = (key: 'pv' | 'ps' | 'pr', maximum: number) => {
      const value = currentStatus && typeof currentStatus === 'object' ? currentStatus[key] : undefined
      return value === undefined || value === null ? maximum : Math.max(0, Number(value) || 0)
    }
    return {
      pv: current('pv', maxPV), ps: current('ps', maxPS), pr: current('pr', maxPR),
      maxPV, maxPS, maxPR, hasStats,
    }
  }

  const enemyArchetypes = Array.from(new Set(
    enemies.map(enemy => enemy.archetype?.trim() || 'Sem arquétipo')
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const enemyWithStatsCount = enemies.filter(enemy => getEnemySheetOverview(enemy).hasStats).length
  const enemyWithoutStatsCount = enemies.length - enemyWithStatsCount
  const enemiesInSelectedSeason = selectedSeasonId
    ? enemies.filter(enemy => getEnemyPartySeason(enemy, selectedSeasonId).participating)
    : []
  const enemyCriticalCount = enemies.filter(enemy => {
    const status = getEnemySheetOverview(enemy)
    return status.hasStats && status.maxPV > 0 && status.pv <= status.maxPV * 0.25
  }).length
  const normalizedEnemySearch = enemySearch.trim().toLocaleLowerCase('pt-BR')
  const visibleEnemies = enemies.filter(enemy => {
    const archetype = enemy.archetype?.trim() || 'Sem arquétipo'
    if (enemyArchetypeFilter !== 'all' && archetype !== enemyArchetypeFilter) return false
    if (enemyStatusFilter !== 'all') {
      const hasStats = getEnemySheetOverview(enemy).hasStats
      if (enemyStatusFilter === 'configured' && !hasStats) return false
      if (enemyStatusFilter === 'unconfigured' && hasStats) return false
      if (enemyStatusFilter === 'party' &&
        (!selectedSeasonId || !getEnemyPartySeason(enemy, selectedSeasonId).participating)) return false
      if (enemyStatusFilter === 'critical') {
        const status = getEnemySheetOverview(enemy)
        if (!status.hasStats || status.maxPV <= 0 || status.pv > status.maxPV * 0.25) return false
      }
    }
    if (!normalizedEnemySearch) return true
    return [enemy.name, archetype, enemy.description || ''].some(value =>
      value.toLocaleLowerCase('pt-BR').includes(normalizedEnemySearch)
    )
  }).sort((a, b) => {
    if (enemySortOrder === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    const dateA = Date.parse(a.updated_at || a.created_at) || 0
    const dateB = Date.parse(b.updated_at || b.created_at) || 0
    return enemySortOrder === 'recent' ? dateB - dateA : dateA - dateB
  })

  const openEnemyFromLibrary = (enemy: CampaignEnemy) => {
    if (enemy.id !== selectedEnemyId && enemySheetDirty &&
      !window.confirm('A ficha atual possui alterações não salvas. Deseja descartar as alterações e abrir outra ficha?')) return
    setSelectedEnemyId(enemy.id)
    setEnemySheetView(true)
    setEnemyItemEditorOpen(false)
  }

  const enemyInventoryRaw = readEnemySheet('inventory.items', [])
  const enemyInventory: Array<Record<string, any>> = Array.isArray(enemyInventoryRaw)
    ? enemyInventoryRaw : []
  const enemyTotalWeight = enemyInventory.reduce((total, item) => total +
    Math.max(0, Number(item.weight) || 0) * Math.max(0, Number(item.quantity) || 0), 0)
  const enemyMaxCapacity = 10 + 2 * enemyEffectiveAttribute('strength')
  const enemyIsOverloaded = enemyTotalWeight > enemyMaxCapacity

  function openEnemyItemEditor(index: number | null) {
    setEnemyItemEditorIndex(index)
    setEnemyItemForm(index === null ? {
      name: '', emoji: '📦', description: '', rarity: 'comum', categories: ['Diversos'],
      quantity: 1, weight: 0, unitPrice: 0, equipmentType: 'none', equipped: false,
      weaponClass: 'improvised', armorClass: 'leve', armorCoverage: 'cortante_perfurante',
      protectionTier: 'basica', protectionMode: 'resistencia', scarcityLevel: 1,
      scarcityExhausted: false,
    } : structuredClone(enemyInventory[index]))
    setEnemyItemEditorOpen(true)
  }
  function persistEnemyItemEditor() {
    if (!isMaster || !selectedEnemyId) return
    const name = String(enemyItemForm.name || '').trim()
    if (!name) { setError('Informe o nome do item.');return }
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(enemyItemForm.quantity) || 1)))
    const categories = Array.isArray(enemyItemForm.categories)
      ? enemyItemForm.categories.filter((item: unknown) => typeof item === 'string' && item.trim()) : []
    if (!categories.length) { setError('Selecione ao menos uma categoria.'); return }
    const type = categories.includes('Equipamento')
      ? String(enemyItemForm.equipmentType || 'none')
      : categories.includes('Armas') ? 'weapon' : 'none'
    const finalCategories = [...categories]
    if (type === 'weapon' && !finalCategories.includes('Armas')) finalCategories.push('Armas')
    if (['armor','protection'].includes(type) && !finalCategories.includes('Equipamento'))
      finalCategories.push('Equipamento')
    const isConsumable = finalCategories.includes('Consumíveis')
    const level = Math.max(1,Math.min(4,Math.floor(Number(enemyItemForm.scarcityLevel) || 1)))
    const scarcityDie = [0,12,8,6,4][level]
    const scarcityCharge = enemyItemForm.scarcityExhausted ? 0 : [0,7,5,3,1][level]
    const autoWeights: Record<string,number> = {improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}
    const weaponDamages: Record<string,string> = {improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}
    const weaponClass = String(enemyItemForm.weaponClass || 'improvised')
    const automaticWeight = type === 'weapon' ? autoWeights[weaponClass] ?? 0.5
      : type === 'armor' ? enemyItemForm.armorClass === 'pesada' ? 6
        : enemyItemForm.armorClass === 'media' ? 4 : 2
      : type === 'protection' ? 0 : null
    const weight = isConsumable ? scarcityCharge
      : automaticWeight ?? Math.max(0,Number(enemyItemForm.weight) || 0)
    const inventoryItem = {
      ...enemyItemForm,
      id: enemyItemForm.id || crypto.randomUUID(), name,
      emoji: String(enemyItemForm.emoji || '📦'), categories:finalCategories, quantity,
      weight,
      unitPrice: Math.max(0,Number(enemyItemForm.unitPrice) || 0),
      currencyId: String(enemyItemForm.currencyId || ''),
      equipmentType: type,
      equipped: Boolean(enemyItemForm.equipped),
      weaponDamage: type === 'weapon' ? weaponDamages[weaponClass] || '1d4' : null,
      armorCoverage: type === 'armor' && enemyItemForm.armorClass === 'pesada'
        ? 'todos' : type === 'armor' ? enemyItemForm.armorCoverage : enemyItemForm.armorCoverage,
      scarcityLevel: isConsumable ? level : null,
      scarcityDie: isConsumable ? `d${scarcityDie}` : null,
      scarcityCharge: isConsumable ? scarcityCharge : null,
      scarcityExhausted: isConsumable ? Boolean(enemyItemForm.scarcityExhausted) : false,
      rarity: String(enemyItemForm.rarity || 'comum'),
    }
    const next = [...enemyInventory]
    if (enemyItemEditorIndex === null) next.push(inventoryItem)
    else next[enemyItemEditorIndex] = inventoryItem
    if (inventoryItem.equipped && ['armor','weapon'].includes(type)) {
      next.forEach((other,index) => {
        if (index !== (enemyItemEditorIndex ?? next.length - 1) && other.equipmentType === type)
          next[index] = { ...other, equipped:false }
      })
    }
    writeEnemySheet('inventory.items', next)
    setEnemyItemEditorOpen(false)
    setError('')
  }
  function useEnemyConsumable(index: number) {
    const item = enemyInventory[index]
    const categories = Array.isArray(item?.categories) ? item.categories : []
    if (!categories.includes('Consumíveis') || item?.scarcityExhausted) return
    const level = Math.max(1,Math.min(4,Math.floor(Number(item.scarcityLevel) || 1)))
    const diceByLevel = [0,12,8,6,4]
    const chargeByLevel = [0,7,5,3,1]
    const die=diceByLevel[level]
    const roll=Math.floor(Math.random()*die)+1
    const exhausted=roll===1 && level===4
    const nextLevel=roll===1 && level<4 ? level+1 : level
    const next=[...enemyInventory]
    next[index]={...item,scarcityLevel:nextLevel,scarcityDie:`d${diceByLevel[nextLevel]}`,
      scarcityCharge:exhausted?0:chargeByLevel[nextLevel],scarcityUses:(Number(item.scarcityUses)||0)+1,
      scarcityLastRoll:roll,scarcityLastDie:`d${die}`,scarcityExhausted:exhausted,
      weight:exhausted?0:chargeByLevel[nextLevel],
      ...(exhausted?{unitPrice:0}:{})}
    writeEnemySheet('inventory.items',next)
    setNotice(`${item.name}: d${die} → ${roll}. ${exhausted?'Consumível esgotado.'
      :roll===1?`Escassez avançou para nível ${nextLevel}.`:'Escassez mantida.'}`)
  }
  function equipEnemyItem(index: number) {
    const item = enemyInventory[index]
    const next = enemyInventory.map((other,i) => {
      if (i === index) return {...other,equipped:!item.equipped}
      return !item.equipped && ['armor','weapon'].includes(String(item.equipmentType)) &&
        item.equipmentType === other.equipmentType ? {...other,equipped:false} : other
    })
    writeEnemySheet('inventory.items',next)
  }
















  const [statusAdjustments, setStatusAdjustments] = useState<Record<string, string>>({ pv: '+10', ps: '+10', pr: '+10' })
  const [breathingTestResult, setBreathingTestResult] = useState<{ rolls: number[]; best: number; total: number; dt: number; success: boolean; recovery: number; applied: number; group: string } | null>(null)
  const [combatActionResult, setCombatActionResult] = useState<string>('')
  const [selectedSkillTest, setSelectedSkillTest] = useState<string>('')
  const [skillTestOpen, setSkillTestOpen] = useState(false)
  const [restActionsOpen, setRestActionsOpen] = useState(false)
  const [complexActionsOpen, setComplexActionsOpen] = useState(false)
  const [complexSkill, setComplexSkill] = useState('')
  const [complexResult, setComplexResult] = useState('')
  const [complexUsed, setComplexUsed] = useState<Record<string, number>>({})
  const [complexSceneCount, setComplexSceneCount] = useState(0)
  const [complexAttribute, setComplexAttribute] = useState('intelligence')
  const [complexMainSkill, setComplexMainSkill] = useState('')
  const [complexPending, setComplexPending] = useState<{skill: string; bonus: number} | null>(null)
  const [selectedSkillAttribute, setSelectedSkillAttribute] = useState<string>('strength')
  const [blockDamageReduction, setBlockDamageReduction] = useState<number | null>(null)
  const [blockIncomingDamage, setBlockIncomingDamage] = useState('')
  const [blockPhysicalDamageType, setBlockPhysicalDamageType] = useState<'cortante_perfurante' | 'especial_bruto'>('cortante_perfurante')
  const [physicalDamageType, setPhysicalDamageType] = useState<'cortante_perfurante' | 'especial_bruto'>('cortante_perfurante')
  const [physicalDamageAmount, setPhysicalDamageAmount] = useState('')
  const [sanityDamageAmount, setSanityDamageAmount] = useState('')
  const [dodgeTarget, setDodgeTarget] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetSaving, setSheetSaving] = useState(false)
  const [editingSheet, setEditingSheet] = useState(false)
  const [sheetAutoSaveStatus, setSheetAutoSaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle')

  const sheetDraftLoadedForRef = useRef('')
  const lastSavedSheetDraftRef = useRef('{}')
  const saveInFlightRef = useRef(false)

  useEffect(() => {
    sheetDraftRef.current = sheetDraft
  }, [sheetDraft])

  const [activePage, setActivePage] = useState<
  'overview' | 'player-table' | 'sheets' | 'campaigns' | 'customization' | 'shops' | 'master-shield' | 'master-chest' | 'bestiary' | 'enemies' | 'profile' | 'conditions'
>('overview')
  const [sheetCharacterView, setSheetCharacterView] = useState(false)

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showCampaignEditor, setShowCampaignEditor] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [showCharacterManagement, setShowCharacterManagement] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [copyPreviousSheet] = useState(true);
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignInviteLink, setCampaignInviteLink] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [systemName, setSystemName] = useState('')
  const [campaignSystemChoice, setCampaignSystemChoice] = useState('')

  const [characterName, setCharacterName] = useState('')
  const [characterEmoji, setCharacterEmoji] = useState('⚔️')
  const [characterRanks, setCharacterRanks] = useState<Record<string, string>>({})
  // Fichas: o filtro só atua nos personagens que as políticas do Supabase já retornaram.
  const sheetFavoriteScope = `${session?.user.id ?? 'guest'}:${selectedCampaignId}`
  const sheetFavoriteIds = Array.isArray(sheetFavoriteCollections[sheetFavoriteScope])
    ? sheetFavoriteCollections[sheetFavoriteScope] : []
  const sheetFavoriteSet = new Set(sheetFavoriteIds)
  const sheetArchetypes = Array.from(new Set(characters.map(character => character.archetype?.trim() || '').filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const sheetCharacterIsMine = (character: Character) => Boolean(session?.user.id &&
    (character.current_player_id ? character.current_player_id === session.user.id : character.user_id === session.user.id))
  const sheetCharactersWithPlayer = characters.filter(character => Boolean(character.current_player_id)).length
  const sheetMyCharacters = characters.filter(sheetCharacterIsMine).length
  // Carrega participação e equipe de cada ficha por temporada, sem modificar o JSON salvo.
  useEffect(() => {
    if (!selectedCampaignId || !seasons.length || !characters.length) { setSheetSeasonRoster({}); return }
    let cancelled = false
    const load = async () => {
      const ids = characters.map(character => character.id)
      const {data, error: rosterError} = await supabase.from('character_sheets')
        .select('character_id,season_id,sheet_data').in('season_id', seasons.map(season => season.id))
        .in('character_id', ids)
      if (cancelled || rosterError) return
      const next: Record<string, Record<string, {participating:boolean;party:boolean;team:string;teams:string[]}>> = {}
      for (const row of data ?? []) {
        const raw = (row.sheet_data ?? {}) as Record<string, any>
        const rawTeams = raw.identity?.teams ?? raw.teams
        const teamNames = Array.from(new Set([...(Array.isArray(rawTeams) ? rawTeams.filter((value: unknown): value is string => typeof value === 'string') : []), String(raw.teamName ?? raw.team ?? raw.equipe ?? raw.identity?.team ?? '').trim()].filter(Boolean)))
        const team = teamNames[0] ?? ''
        if (!next[row.season_id]) next[row.season_id] = {}
        next[row.season_id][row.character_id] = {
          participating: raw.seasonParticipation === true,
          party: raw.partyParticipation === true,
          team,
          teams: teamNames,
        }
      }
      setSheetSeasonRoster(next)
    }
    void load()
    return () => {cancelled = true}
  }, [selectedCampaignId, seasons, characters])
  const sheetTeams = Array.from(new Set(Object.entries(sheetSeasonRoster)
    .filter(([season]) => sheetSeasonFilter === 'all' || season === sheetSeasonFilter)
    .flatMap(([, roster]) => Object.values(roster).flatMap(entry => entry.teams ?? (entry.team ? [entry.team] : [])))))
    .sort((a,b) => a.localeCompare(b, 'pt-BR'))
  const sheetFilteredCharacters = characters.filter(character => {
    const text = [character.name, character.archetype, systemFeatures.usesRanks ? characterRanks[character.id] : character.level]
      .map(value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')).join(' ')
    const query = sheetCharacterSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    if (query && !text.includes(query)) return false
    if (sheetSeasonFilter !== 'all' && !sheetSeasonRoster[sheetSeasonFilter]?.[character.id]?.participating) return false
    if (sheetTeamFilter !== 'all') {
      const records = Object.entries(sheetSeasonRoster).filter(([season]) => sheetSeasonFilter === 'all' || season === sheetSeasonFilter).map(([, roster]) => roster[character.id]).filter(Boolean)
      if (sheetTeamFilter === 'party' && !records.some(entry => entry.participating && entry.party)) return false
      if (sheetTeamFilter === 'outside' && !records.some(entry => entry.participating && !entry.party)) return false
      if (sheetTeamFilter.startsWith('team:') && !records.some(entry => entry.participating && (entry.teams ?? [entry.team]).includes(sheetTeamFilter.slice(5)))) return false
    }
    if (sheetCharacterArchetype !== 'all' && (character.archetype?.trim() || '') !== sheetCharacterArchetype) return false
    if (sheetCharacterOwnerFilter === 'mine' && !sheetCharacterIsMine(character)) return false
    if (sheetCharacterOwnerFilter === 'assigned' && !character.current_player_id) return false
    if (sheetCharacterOwnerFilter === 'unassigned' && character.current_player_id) return false
    if (sheetOnlyFavorites && !sheetFavoriteSet.has(character.id)) return false
    return true
  }).sort((a, b) => {
    if (sheetCharacterSort === 'favorites') {
      const diff = Number(sheetFavoriteSet.has(b.id)) - Number(sheetFavoriteSet.has(a.id))
      if (diff) return diff
    }
    if (sheetCharacterSort === 'recent') {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (diff) return diff
    }
    if (sheetCharacterSort === 'level' && !systemFeatures.usesRanks) {
      const diff = b.level - a.level
      if (diff) return diff
    }
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  })
  const sheetHasActiveFilters = Boolean(sheetCharacterSearch.trim() || sheetCharacterArchetype !== 'all' ||
    sheetCharacterOwnerFilter !== 'all' || sheetOnlyFavorites || sheetSeasonFilter !== 'all' || sheetTeamFilter !== 'all')
  const resetSheetFilters = () => {
    setSheetCharacterSearch(''); setSheetCharacterArchetype('all')
    setSheetCharacterOwnerFilter('all'); setSheetOnlyFavorites(false)
    setSheetSeasonFilter('all'); setSheetTeamFilter('all')
  }
  const toggleSheetFavorite = (id: string) => {
    setSheetFavoriteCollections(current => {
      const existing = Array.isArray(current[sheetFavoriteScope]) ? current[sheetFavoriteScope] : []
      const updated = existing.includes(id) ? existing.filter(value => value !== id) : [...existing, id]
      const next = { ...current, [sheetFavoriteScope]: updated }
      try { window.localStorage.setItem('haxbag:sheet-character-favorites:v1', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const [archetype, setArchetype] = useState('')
  const [primaryArchetype, setPrimaryArchetype] = useState('')
  const [secondaryArchetype, setSecondaryArchetype] = useState('')
  const [characterRank, setCharacterRank] = useState('civil')
  const [characterFamilyTier, setCharacterFamilyTier] = useState('5')
  const [characterLevel, setCharacterLevel] = useState('1')

  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemRarity, setNewItemRarity] = useState('comum')
  const [newItemCategory, setNewItemCategory] = useState('Diversos')
  const [newItemCategories, setNewItemCategories] = useState<string[]>(['Diversos'])
  const [newWeaponClass, setNewWeaponClass] = useState('improvised')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemWeight, setNewItemWeight] = useState('0')
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('0')
  const [newItemCurrencyId, setNewItemCurrencyId] = useState('')
  const [newItemEmoji, setNewItemEmoji] = useState('📦')
  const [newEquipmentType, setNewEquipmentType] = useState<'none' | 'armor' | 'protection' | 'cybernetic'>('none')
  const [newCyberneticCategory, setNewCyberneticCategory] = useState('Outro')
  const [newCyberneticLocation, setNewCyberneticLocation] = useState('')
  const [newCyberneticLoad, setNewCyberneticLoad] = useState('0')
  const [newCyberneticEffects, setNewCyberneticEffects] = useState('')
  const [newArmorClass, setNewArmorClass] = useState<'leve' | 'media' | 'pesada'>('leve')
  const [newArmorCoverage, setNewArmorCoverage] = useState<'cortante_perfurante' | 'especial_bruto' | 'todos'>('cortante_perfurante')
  const [newProtectionTier, setNewProtectionTier] = useState<'basica' | 'moderada' | 'avancada'>('basica')
  const [newProtectionMode, setNewProtectionMode] = useState<'resistencia' | 'sanidade'>('resistencia')
  const [newScarcityLevel, setNewScarcityLevel] = useState<'1' | '2' | '3' | '4'>('1')
  const [newScarcityExhausted, setNewScarcityExhausted] = useState(false)

  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [emojiPickerItem, setEmojiPickerItem] = useState<Item | null>(null)
  const [emojiPickerCharacter, setEmojiPickerCharacter] = useState<Character | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sortBy, setSortBy] = useState('created')
  const [draggedInventoryId, setDraggedInventoryId] = useState<string | null>(null)
  const [inventoryDropId, setInventoryDropId] = useState<string | null>(null)
  const inventoryReorderBusy = useRef(false)
  const [updatingQuantityItemId, setUpdatingQuantityItemId] = useState<string | null>(null)
  const [usingScarcityItemId, setUsingScarcityItemId] = useState<string | null>(null)

  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) setInviteCode(invite)
  }, [])

useEffect(() => {
  if (!creatureImageFile) {
    setCreatureImagePreview('')
    return
  }

  const previewUrl = URL.createObjectURL(creatureImageFile)
  setCreatureImagePreview(previewUrl)

  return () => URL.revokeObjectURL(previewUrl)
}, [creatureImageFile])

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error: sessionError } =
        await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      setCampaigns([])
      setCharacters([])
      setItems([])
      setSelectedCampaignId('')
      setSelectedCharacterId('')
      return
    }

    let cancelled = false

    async function loadCampaigns() {
      setLoading(true)
      setError('')

      const { data: memberships, error: membershipError } =
        await supabase
          .from('campaign_members')
          .select('campaign_id, role')
          .eq('user_id', session!.user.id)

      if (cancelled) return

      if (membershipError) {
        setError(`Erro ao carregar campanhas: ${membershipError.message}`)
        setLoading(false)
        return
      }

      if (!memberships?.length) {
        setCampaigns([])
        setCharacters([])
        setItems([])
        setSelectedCampaignId('')
        setSelectedCharacterId('')
        setLoading(false)
        return
      }

      const ids = memberships.map((member) => member.campaign_id)

      const { data, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, description, system_name, currency_config, created_by')
        .in('id', ids)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (campaignError) {
        setError(`Erro ao carregar campanhas: ${campaignError.message}`)
        setLoading(false)
        return
      }

      const result: Campaign[] = (data ?? []).map((campaign) => ({
        ...campaign,
        role:
          memberships.find((member) => member.campaign_id === campaign.id)
            ?.role ?? 'player',
      }))

      setCampaigns(result)

      const preferredCampaignId = typeof session!.user.user_metadata?.primary_campaign_id === 'string'
        ? session!.user.user_metadata.primary_campaign_id
        : ''
      setSelectedCampaignId((current) =>
        result.some((campaign) => campaign.id === current)
          ? current
          : result.some((campaign) => campaign.id === preferredCampaignId)
            ? preferredCampaignId
            : result[0]?.id ?? '',
      )

      setLoading(false)
    }

    void loadCampaigns()

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!selectedCampaignId) { setSeasons([]); setSelectedSeasonId(''); return }
    let cancelled = false
    async function loadSeasons() {
      const { data, error: seasonsError } = await supabase.from('campaign_seasons').select('*').eq('campaign_id', selectedCampaignId).order('season_number', { ascending: true })
      if (cancelled) return
      if (seasonsError) { setError(`Erro ao carregar temporadas: ${seasonsError.message}`); setSeasons([]); setSelectedSeasonId(''); return }
      const rows = (data ?? []) as Season[]
      setSeasons(rows)
      setSelectedSeasonId(current => rows.some(row => row.id === current) ? current : (rows.find(row => row.status === 'active')?.id ?? rows[0]?.id ?? ''))
    }
    void loadSeasons()
    const channel = supabase.channel(`campaign-seasons-visual-${selectedCampaignId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'campaign_seasons',
        filter: `campaign_id=eq.${selectedCampaignId}`,
      }, () => { void loadSeasons() })
      .subscribe()
    const refreshOnFocus = () => { void loadSeasons() }
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshOnFocus)
      void supabase.removeChannel(channel)
    }
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignActivities([])
      setActivityTableMissing(false)
      setActivityLoading(false)
      return
    }

    let cancelled = false

    async function loadCampaignActivities() {
      setActivityLoading(true)
      const { data, error: loadError } = await supabase
        .from('campaign_activity')
        .select('id,campaign_id,actor_id,actor_name,activity_type,title,description,entity_type,entity_id,created_at')
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (cancelled) return

      if (loadError) {
        setCampaignActivities([])
        if (loadError.code === '42P01' || loadError.code === 'PGRST205') {
          setActivityTableMissing(true)
        } else {
          console.warn('Não foi possível carregar o histórico da campanha:', loadError.message)
        }
      } else {
        setActivityTableMissing(false)
        setCampaignActivities((data ?? []) as CampaignActivity[])
      }

      setActivityLoading(false)
    }

    void loadCampaignActivities()
    return () => { cancelled = true }
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId || !masterShieldSeasonId || !characters.length) { setMasterShieldSheets({}); setMasterShieldGrantRows([]); return }
    let cancelled = false
    async function loadMasterShieldSheets() {
      setMasterShieldLoading(true)
      const ids = characters.map(character => character.id)
      const [{ data, error: loadError }, { data: grants, error: grantsError }] = await Promise.all([
        supabase.from('character_sheets').select('character_id,sheet_data').eq('season_id', masterShieldSeasonId).in('character_id', ids),
        supabase.from('character_visibility').select('character_id,user_id').in('character_id', ids),
      ])
      if (cancelled) return
      if (loadError || grantsError) { setError(`Erro ao carregar dados do Escudo do mestre: ${(loadError || grantsError)?.message}`); setMasterShieldSheets({}); setMasterShieldGrantRows([]) }
      else {
        const result: Record<string, Record<string, any>> = {}
        for (const row of data ?? []) result[row.character_id] = (row.sheet_data ?? {}) as Record<string, any>
        setMasterShieldSheets(result)
        setMasterShieldGrantRows((grants ?? []) as Array<{ character_id: string; user_id: string }>)
      }
      setMasterShieldLoading(false)
    }
    void loadMasterShieldSheets()
    const channel = supabase
      .channel(`master-shield-${masterShieldSeasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_sheets', filter: `season_id=eq.${masterShieldSeasonId}` }, payload => {
        const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { character_id?: string; sheet_data?: Record<string, any> } | undefined
        if (row?.character_id && payload.eventType !== 'DELETE' && row.sheet_data) {
          setMasterShieldSheets(current => ({ ...current, [row.character_id!]: row.sheet_data! }))
        }
        if (payload.eventType === 'DELETE' && row?.character_id) {
          setMasterShieldSheets(current => { const next = { ...current }; delete next[row.character_id!]; return next })
        }
        // Reconsulta para manter o painel consistente também em inclusões e alterações de participação.
        void loadMasterShieldSheets()
      })
      .subscribe()
    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [selectedCampaignId, masterShieldSeasonId, characters, masterShieldRefreshKey])

  useEffect(() => {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    setSeasonNameDraft(season?.name ?? '')
    setSeasonDescriptionDraft(season?.description ?? '')
  }, [selectedSeasonId, seasons])

useEffect(() => {
  if (!selectedCampaignId) {
    setShops([])
    setShopItems([])
    setSelectedShopId('')
    return
  }

  let cancelled = false

  async function loadShops() {
    setShopLoading(true)

    const { data: shopData, error: shopError } = await supabase
      .from('campaign_shops')
      .select('id, campaign_id, name, description, is_visible')
      .eq('campaign_id', selectedCampaignId)
      .order('created_at', { ascending: true })

    if (cancelled) return

    if (shopError) {
      setError(`Erro ao carregar lojas: ${shopError.message}`)
      setShops([])
      setShopItems([])
      setShopLoading(false)
      return
    }

const loadedShops = (shopData ?? []) as CampaignShop[]

const accessibleShops = isMaster
  ? loadedShops
  : loadedShops.filter(shop => shop.is_visible)

setShops(accessibleShops)

setSelectedShopId(current =>
  accessibleShops.some(shop => shop.id === current)
    ? current
    : accessibleShops[0]?.id ?? ''
)

if (accessibleShops.length === 0) {
      setShopItems([])
      setShopLoading(false)
      return
    }

    const shopIds = accessibleShops.map(shop => shop.id)

    const { data: itemData, error: itemError } = await supabase
      .from('campaign_shop_items')
      .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: true })

    if (cancelled) return

    if (itemError) {
      setError(`Erro ao carregar produtos das lojas: ${itemError.message}`)
      setShopItems([])
    } else {
      setShopItems((itemData ?? []) as CampaignShopItem[])
    }

    setShopLoading(false)
  }

  void loadShops()

  return () => {
    cancelled = true
  }
}, [selectedCampaignId, isMaster])

useEffect(() => {
  if (!selectedCampaignId || !isMaster) {
    setEnemies([])
    setSelectedEnemyId(null)
    setEnemySheetView(false)
    return
  }

  let cancelled = false

  async function loadEnemies() {
    setEnemiesLoading(true)

    const { data, error: enemiesError } = await supabase
      .from('campaign_enemies')
      .select(`
        id,
        campaign_id,
        name,
        emoji,
        archetype,
        description,
        sheet_data,
        created_by,
        created_at,
        updated_at
      `)
      .eq('campaign_id', selectedCampaignId)
      .order('created_at', { ascending: true })

    if (cancelled) return

    if (enemiesError) {
      setError(`Erro ao carregar inimigos: ${enemiesError.message}`)
      setEnemies([])
      setSelectedEnemyId(null)
    } else {
      const rows = (data ?? []) as CampaignEnemy[]

      setEnemies(rows)

      setSelectedEnemyId(current =>
        rows.some(enemy => enemy.id === current)
          ? current
          : rows[0]?.id ?? null
      )
    }

    setEnemiesLoading(false)
  }

  void loadEnemies()

  return () => {
    cancelled = true
  }
}, [selectedCampaignId, isMaster])

// Escudo do Mestre: mantém a party de inimigos sincronizada com as fichas.
useEffect(() => {
  if (!selectedCampaignId || !isMaster || (activePage !== 'master-shield' && activePage !== 'player-table')) return
  let cancelled = false
  const reload = async () => {
    const { data, error: loadError } = await supabase
      .from('campaign_enemies')
      .select('id,campaign_id,name,emoji,archetype,description,sheet_data,created_by,created_at,updated_at')
      .eq('campaign_id', selectedCampaignId)
    if (cancelled) return
    if (loadError) {
      setError(`Não foi possível atualizar a Party de Inimigos: ${loadError.message}`)
      return
    }
    // Uma ficha com edições locais pendentes não pode ser sobrescrita pelo painel.
    setEnemies(current => (data ?? []).map(row => {
      const existing = current.find(enemy => enemy.id === row.id)
      if (row.id === selectedEnemyId && enemySheetDirty && existing) return existing
      return row as CampaignEnemy
    }))
  }
  void reload()
  const channel = supabase.channel(`master-enemy-party-${selectedCampaignId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'campaign_enemies',
      filter: `campaign_id=eq.${selectedCampaignId}`,
    }, () => { void reload() })
    .subscribe()
  return () => { cancelled = true; void supabase.removeChannel(channel) }
}, [selectedCampaignId, isMaster, activePage, enemyPartyRefreshKey])

useEffect(() => { setEnemyPartyInitiativeDrafts({}) }, [masterShieldSeasonId])

useEffect(() => {
  if (!selectedCampaignId || !selectedEnemyId || !isMaster) {
  setEnemySheetDraft('{}')
  enemySheetDraftRef.current = '{}'
  enemySheetLoadedForRef.current = null
  enemyFailedAutoSaveDraftRef.current = null
  setEnemySheetDirty(false)
  setEnemyAutoSaveStatus('idle')
  setEnemyEditingSheet(false)
  return
}

setEnemySheetDraft('{}')
enemySheetDraftRef.current = '{}'
setEnemyEditingSheet(false)
enemySheetLoadedForRef.current = null
enemyFailedAutoSaveDraftRef.current = null
setEnemySheetDirty(false)
setEnemyAutoSaveStatus('idle')

setEnemyItemEditorOpen(false)

  let cancelled = false

  async function loadEnemySheet() {
    setEnemySheetLoading(true)

    const { data, error: loadError } = await supabase
      .from('campaign_enemies')
      .select('sheet_data')
      .eq('id', selectedEnemyId)
      .eq('campaign_id', selectedCampaignId)
      .single()

    if (cancelled) return

    if (loadError) {
      setError(`Erro ao carregar ficha do inimigo: ${loadError.message}`)
      setEnemySheetDraft('{}')
    } else {
      const draft = JSON.stringify(data?.sheet_data ?? {}, null, 2)
      setEnemySheetDraft(draft)
      enemySheetDraftRef.current = draft
      enemySheetLoadedForRef.current = `${selectedCampaignId}:${selectedEnemyId}`
      setEnemySheetDirty(false)
    }

    setEnemySheetLoading(false)
  }

  void loadEnemySheet()

  return () => {
    cancelled = true
  }
}, [selectedCampaignId, selectedEnemyId, isMaster])

// Assim como na ficha dos personagens, persiste as alterações após uma pausa
// na edição. Uma gravação em andamento nunca descarta edições posteriores.
useEffect(() => {
  if (
    !isMaster || !selectedCampaignId || !selectedEnemyId ||
    enemySheetLoading || enemySheetSaving || !enemySheetDirty ||
    enemySheetLoadedForRef.current !== `${selectedCampaignId}:${selectedEnemyId}` ||
    enemyFailedAutoSaveDraftRef.current === enemySheetDraft
  ) return

  const timeout = window.setTimeout(() => void saveEnemySheet(true), 850)
  return () => window.clearTimeout(timeout)
}, [
  isMaster, selectedCampaignId, selectedEnemyId,
  enemySheetLoading, enemySheetSaving, enemySheetDirty, enemySheetDraft,
])

// Proteção adicional contra fechamento da aba enquanto há dados pendentes.
useEffect(() => {
  if (!enemySheetDirty) return
  const confirmLeave = (event: BeforeUnloadEvent) => {
    event.preventDefault()
  }
  window.addEventListener('beforeunload', confirmLeave)
  return () => window.removeEventListener('beforeunload', confirmLeave)
}, [enemySheetDirty])

useEffect(() => {
  setCreatureSearch('')
  setCreatureCategoryFilter('Todas')
  setCreatureThreatFilter('Todas')
  setCreatureVisibilityFilter('all')
  setSelectedCreatureId(null)
  setShowCreatureForm(false)
  setEditingCreatureId(null)
}, [selectedCampaignId])

useEffect(() => {
  if (!selectedCampaignId) {
    setCreatures([])
    return
  }

  let cancelled = false

  async function loadCreatures() {
    setCreaturesLoading(true)

    const { data, error: creatureError } = await supabase
      .from('campaign_creatures')
      .select('*')
      .eq('campaign_id', selectedCampaignId)
      .order('name', { ascending: true })

    if (cancelled) return

    if (creatureError) {
      setError(`Erro ao carregar criaturas: ${creatureError.message}`)
      setCreatures([])
} else {
  const loadedCreatures = (data ?? []) as CampaignCreature[]

  const creaturesWithImages = await Promise.all(
    loadedCreatures.map(async creature => {
      if (!creature.image_url) return creature
      if (/^https?:\/\//i.test(creature.image_url)) {
        return { ...creature, image_display_url: creature.image_url }
      }

      const { data: signedImage, error: signedError } = await supabase.storage
        .from('campaign-creatures')
        .createSignedUrl(creature.image_url, 60 * 60)

      if (signedError) {
        console.error(
          `Erro ao gerar imagem de ${creature.name}:`,
          signedError.message
        )
        return creature
      }

return {
  ...creature,
  image_display_url: signedImage.signedUrl,
}
    })
  )

  if (cancelled) return

  setCreatures(creaturesWithImages)
}

    setCreaturesLoading(false)
  }

  void loadCreatures()

  return () => {
    cancelled = true
  }
}, [selectedCampaignId])

  useEffect(() => {
  const ownerKey = `${selectedCharacterId ?? ''}:${selectedSeasonId ?? ''}`

  sheetDraftLoadedForRef.current = ''
  setSheetAutoSaveStatus('idle')

  if (!selectedCharacterId || !selectedSeasonId) {
    setSheet(null)
    setSheetDraft('{}')
    lastSavedSheetDraftRef.current = '{}'
    setSheetLoading(false)
    return
  }

  let cancelled = false

  async function loadSheet() {
    setSheetLoading(true)

    const { data, error: sheetError } = await supabase
      .from('character_sheets')
      .select('id,character_id,season_id,sheet_data')
      .eq('character_id', selectedCharacterId)
      .eq('season_id', selectedSeasonId)
      .maybeSingle()

    if (cancelled) return

    if (sheetError) {
      setError(`Erro ao carregar ficha: ${sheetError.message}`)
      setSheet(null)
      setSheetDraft('{}')
      lastSavedSheetDraftRef.current = '{}'
    } else {
      const value = (data ?? null) as CharacterSheet | null
      const initialDraft = JSON.stringify(value?.sheet_data ?? {}, null, 2)

      setSheet(value)
      setSheetDraft(initialDraft)
      lastSavedSheetDraftRef.current = initialDraft
      sheetDraftLoadedForRef.current = ownerKey
    }

    setSheetLoading(false)
  }

  void loadSheet()

  return () => {
    cancelled = true
  }
}, [selectedCharacterId, selectedSeasonId])

  useEffect(() => {
    if (!selectedSeasonId || !characters.length || !systemFeatures.usesRanks) {
      setCharacterRanks({})
      return
    }
    let cancelled = false
    async function loadCharacterRanks() {
      const ids = characters.map(character => character.id)
      const { data } = await supabase.from('character_sheets').select('character_id,sheet_data').eq('season_id', selectedSeasonId).in('character_id', ids)
      if (cancelled) return
      const ranks: Record<string, string> = {}
      for (const row of data ?? []) {
        const sheetData = (row.sheet_data ?? {}) as Record<string, any>
        const progression = sheetData.progression ?? {}
        ranks[row.character_id] = String(progression.rankName || getSystemRankName(progression.rankId) || 'Graduação não definida')
      }
      setCharacterRanks(ranks)
    }
    void loadCharacterRanks()
    return () => { cancelled = true }
  }, [selectedSeasonId, selectedCampaign?.system_name, characters])

  useEffect(() => {
    if (!selectedCampaignId) {
      setCharacters([])
      setSelectedCharacterId('')
      setItems([])
      return
    }

    let cancelled = false

    async function loadCharacters() {
      setError('')

      const { data, error: characterError } = await supabase
        .from('characters')
        .select(
          'id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at',
        )
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (characterError) {
        setError(`Erro ao carregar personagens: ${characterError.message}`)
        setCharacters([])
        setSelectedCharacterId('')
        setLoading(false)
        return
      }

      const result = (data ?? []) as Character[]
      setCharacters(result)

      setSelectedCharacterId((current) =>
        result.some((character) => character.id === current)
          ? current
          : result[0]?.id ?? '',
      )
    }

    void loadCharacters()

    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignMembers([])
      return
    }

    let cancelled = false

    async function loadCampaignMembers() {
      const { data: memberships, error: membersError } = await supabase
        .from('campaign_members')
        .select('user_id, role')
        .eq('campaign_id', selectedCampaignId)

      if (cancelled) return
      if (membersError) {
        setError(`Erro ao carregar membros da campanha: ${membersError.message}`)
        setCampaignMembers([])
        return
      }

      const userIds = (memberships ?? []).map((member) => member.user_id)
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
        : { data: [], error: null }

      if (cancelled) return
      if (profilesError) {
        setError(`Erro ao carregar nomes dos membros: ${profilesError.message}`)
      }

      setCampaignMembers((memberships ?? []).map((member) => ({
        user_id: member.user_id,
        role: member.role,
        display_name:
          profiles?.find((profile) => profile.id === member.user_id)?.display_name ||
          (member.user_id === session?.user.id ? displayNameForMembers(session) : 'Jogador'),
      })))
    }

    void loadCampaignMembers()
    return () => { cancelled = true }
  }, [selectedCampaignId, session?.user.id])

  useEffect(() => {
    if (!selectedCharacterId || !session?.user?.id) {
      setCharacterGrants([])
      return
    }

    let cancelled = false
    async function loadCharacterGrants() {
      let query = supabase
        .from('character_visibility')
        .select('user_id')
        .eq('character_id', selectedCharacterId)

      // Mestres precisam da lista completa para administrar acessos;
      // jogadores só precisam confirmar a própria concessão.
      if (campaigns.find(campaign => campaign.id === selectedCampaignId)?.role !== 'master') {
        query = query.eq('user_id', session!.user.id)
      }

      const { data, error: grantsError } = await query
      if (cancelled) return
      if (grantsError) {
        setError(`Erro ao carregar permissões do personagem: ${grantsError.message}`)
        setCharacterGrants([])
      } else {
        setCharacterGrants((data ?? []) as CharacterGrant[])
      }
    }
    void loadCharacterGrants()
    return () => { cancelled = true }
  }, [selectedCharacterId, selectedCampaignId, campaigns, session?.user?.id])

  // CARREGAMENTO DA CARTEIRA
  useEffect(() => {
    if (!selectedCharacterId) {
      setCurrencyBalances({})
      setCurrencyLoading(false)
      return
    }

    let cancelled = false

    async function loadCurrencyBalances() {
      setCurrencyLoading(true)

      const { data, error: currencyError } = await supabase.rpc(
        'get_character_currency',
        {
          p_character_id: selectedCharacterId,
        },
      )

      if (cancelled) return

      if (currencyError) {
        setError(`Erro ao carregar carteira: ${currencyError.message}`)
        setCurrencyBalances({})
      } else {
        setCurrencyBalances(
          data && typeof data === 'object'
            ? data as Record<string, number>
            : {},
        )
      }

      setCurrencyLoading(false)
    }

    void loadCurrencyBalances()

    return () => {
      cancelled = true
    }
  }, [selectedCharacterId])

  // CARREGAMENTO DO INVENTÁRIO
  useEffect(() => {
    if (!selectedCharacterId) {
      setItems([])
      setItemsLoading(false)
      return
    }

    let cancelled = false

    async function loadItems() {
      setItemsLoading(true)
      setError('')

      const { data, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
        .eq('character_id', selectedCharacterId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (itemsError) {
        setError(`Erro ao carregar inventário: ${itemsError.message}`)
        setItems([])
      } else {
        setItems(
  ((data ?? []) as Item[]).filter(
    item =>
      item.metadata?.cybernetic !== true ||
      item.metadata?.cyberneticEquipped !== true
  )
)
      }

      setItemsLoading(false)
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [selectedCharacterId])

useEffect(() => {
  if (!creatureImageFile) {
    setCreatureImagePreview('')
    return
  }
  const previewUrl = URL.createObjectURL(creatureImageFile)
  setCreatureImagePreview(previewUrl)
  return () => URL.revokeObjectURL(previewUrl)
}, [creatureImageFile])

function openNewCreatureForm() {
  setEditingCreatureId(null)
  setCreatureName('')
  setCreatureCategory('Outros')
  setCreatureDescription('')
  setCreatureImageUrl('')
  setCreatureImageFile(null)
  setCreatureStoredImagePreview('')
  setCreatureThreatLevel('Comum')
  setCreaturePv('')
  setCreaturePs('')
  setCreaturePr('')
  setCreatureResistances('')
  setCreatureWeaknesses('')
  setCreatureImmunities('')
  setCreatureVices('')
  setCreaturePeculiarities('')
  setShowCreatureForm(true)
}

function openCreatureEditor(creature: CampaignCreature) {
  setEditingCreatureId(creature.id)
  setCreatureName(creature.name)
  setCreatureCategory(creature.category)
  setCreatureDescription(creature.description ?? '')
setCreatureImageUrl(
  creature.image_url?.startsWith('http')
    ? creature.image_url
    : ''
)
setCreatureImageFile(null)
setCreatureStoredImagePreview(
  creature.image_display_url ??
  (creature.image_url?.startsWith('http') ? creature.image_url : '')
)
  setCreatureThreatLevel(creature.threat_level)
  setCreaturePv(creature.pv?.toString() ?? '')
  setCreaturePs(creature.ps?.toString() ?? '')
  setCreaturePr(creature.pr?.toString() ?? '')
  setCreatureResistances(creature.resistances.join('\n'))
  setCreatureWeaknesses(creature.weaknesses.join('\n'))
  setCreatureImmunities(creature.immunities.join('\n'))
  setCreatureVices(readCreatureTraits(creature, 'vices').join('\n'))
  setCreaturePeculiarities(readCreatureTraits(creature, 'peculiarities').join('\n'))
  setShowCreatureForm(true)
}

async function toggleCreatureVisibility(creature: CampaignCreature) {
  if (!isMaster || !selectedCampaignId) return

  const nextHidden = !creature.is_hidden

  const { data, error: updateError } = await supabase
    .from('campaign_creatures')
    .update({ is_hidden: nextHidden })
    .eq('id', creature.id)
    .eq('campaign_id', selectedCampaignId)
    .select('*')
    .single()

  if (updateError) {
    setError(`Erro ao alterar visibilidade do monstro: ${updateError.message}`)
    return
  }

let updatedCreature = data as CampaignCreature

if (updatedCreature.image_url) {
  if (/^https?:\/\//i.test(updatedCreature.image_url)) {
    updatedCreature = { ...updatedCreature, image_display_url: updatedCreature.image_url }
  } else {
    const { data: signedImage, error: signedError } = await supabase.storage
      .from('campaign-creatures')
      .createSignedUrl(updatedCreature.image_url, 60 * 60)

    if (!signedError && signedImage) {
      updatedCreature = { ...updatedCreature, image_display_url: signedImage.signedUrl }
    }
  }
}

setCreatures(current =>
  current.map(entry =>
    entry.id === creature.id
      ? updatedCreature
      : entry
  )
)

setNotice(
  nextHidden
    ? 'Monstro ocultado dos jogadores.'
    : 'Monstro revelado aos jogadores.'
)
}

async function saveCreature() {
  if (
    !isMaster ||
    !selectedCampaignId ||
    !creatureName.trim() ||
    creatureSaving
  ) return

  setCreatureSaving(true)
  setError('')
  setNotice('')

  const existingCreature = editingCreatureId
    ? creatures.find(creature => creature.id === editingCreatureId)
    : null

  const payload = {
    campaign_id: selectedCampaignId,
    name: creatureName.trim(),
    category: creatureCategory,
    description: creatureDescription.trim() || null,
    image_url: editingCreatureId
  ? creatures.find(creature => creature.id === editingCreatureId)?.image_url ?? null
  : null,
    threat_level: creatureThreatLevel,
    pv: creaturePv.trim() === '' ? null : Number(creaturePv),
    ps: creaturePs.trim() === '' ? null : Number(creaturePs),
    pr: creaturePr.trim() === '' ? null : Number(creaturePr),
    attributes: {
      ...(existingCreature?.attributes ?? {}),
      peculiarities: parseCreatureTraits(creaturePeculiarities),
      ...(isKisatsutaiSystem ? { vices: parseCreatureTraits(creatureVices) } : {}),
    },
resistances: creatureResistances
  .split('\n')
  .map(value => value.trim())
  .filter(Boolean),

weaknesses: creatureWeaknesses
  .split('\n')
  .map(value => value.trim())
  .filter(Boolean),

immunities: creatureImmunities
  .split('\n')
  .map(value => value.trim())
  .filter(Boolean),
    abilities: existingCreature?.abilities ?? [],
    attacks: existingCreature?.attacks ?? [],
    rewards: existingCreature?.rewards ?? [],
    created_by: existingCreature?.created_by ?? session?.user.id ?? null,
  }

  try {
let data: CampaignCreature | null = null
let saveError: Error | null = null

if (editingCreatureId) {
  const { data: updated, error: updateError } = await supabase
    .from('campaign_creatures')
    .update(payload)
    .eq('id', editingCreatureId)
    .select('*')
    .single()

  if (updateError) {
    saveError = updateError
  } else {
    data = updated as CampaignCreature
  }
} else {
  const { data: inserted, error: insertError } = await supabase
    .from('campaign_creatures')
    .insert(payload)
    .select('*')
    .single()

  if (insertError) {
    saveError = insertError
  } else {
    data = inserted as CampaignCreature
  }
}

if (saveError) throw saveError

if (!data) {
  throw new Error('Não foi possível obter os dados da criatura salva.')
}

// Se uma nova imagem foi selecionada, envia para o Storage.
if (creatureImageFile) {
  const extension = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }[creatureImageFile.type]

  if (!extension) {
    throw new Error('Formato de imagem não suportado.')
  }

  if (creatureImageFile.size > 5 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 5 MB.')
  }

  const imagePath = `${selectedCampaignId}/${data.id}/${crypto.randomUUID()}.${extension}`
  console.log('[Bestiário] Iniciando upload:', imagePath)

  const { error: uploadError } = await supabase.storage
    .from('campaign-creatures')
    .upload(imagePath, creatureImageFile, {
      contentType: creatureImageFile.type,
      upsert: false,
    })
console.log('[Bestiário] Resultado do upload:', { uploadError })
  if (uploadError) throw uploadError

  const { data: updatedCreature, error: imageUpdateError } = await supabase
    .from('campaign_creatures')
    .update({ image_url: imagePath })
    .eq('id', data.id)
    .select('*')
    .single()

  if (imageUpdateError) throw imageUpdateError

  data = updatedCreature as CampaignCreature
}

// Gera a URL temporária para visualizar a imagem privada.
if (data.image_url) {
  if (data.image_url.startsWith('http')) {
    data = {
      ...data,
      image_display_url: data.image_url,
    }
  } else {
    const { data: signedImage, error: signedError } = await supabase.storage
      .from('campaign-creatures')
      .createSignedUrl(data.image_url, 60 * 60)

    if (signedError) {
  console.error('[Bestiário] Erro ao gerar URL assinada:', signedError)
  throw new Error(`Falha ao gerar URL da imagem: ${signedError.message}`)
}

    data = {
      ...data,
      image_display_url: signedImage.signedUrl,
    }
  }
}

setCreatures(current => {
  const exists = current.some(creature => creature.id === data.id)

  const updated = exists
    ? current.map(creature =>
        creature.id === data.id ? data : creature
      )
    : [...current, data]

  return updated.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  )
})

    setCreatureName('')
    setCreatureCategory('Outros')
    setCreatureDescription('')
    setCreatureImageUrl('')
    setCreatureImageFile(null)
    setCreatureStoredImagePreview('')
    setCreatureThreatLevel('Comum')
    setCreaturePv('')
    setCreaturePs('')
    setCreaturePr('')
    setCreatureResistances('')
setCreatureWeaknesses('')
setCreatureImmunities('')
setShowCreatureForm(false)
setEditingCreatureId(null)

setNotice(
  editingCreatureId
    ? 'Criatura atualizada com sucesso!'
    : 'Criatura cadastrada com sucesso!'
)
  } catch (err) {
    setError(`Não foi possível cadastrar a criatura: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setCreatureSaving(false)
  }
}

async function saveEnemy() {
  if (
    !isMaster ||
    !selectedCampaignId ||
    !enemyName.trim() ||
    enemySaving
  ) return

  setEnemySaving(true)
  setError('')
  setNotice('')

  // Ao editar informações básicas, nunca sobrescreva o JSON da ficha.
  // O salvamento automático tem uma operação própria para sheet_data.
  const payload = {
    campaign_id: selectedCampaignId,
    name: enemyName.trim(),
    emoji: enemyEmoji.trim() || '👹',
    archetype: enemyArchetype.trim() || null,
    description: enemyDescription.trim() || null,
    updated_at: new Date().toISOString(),
  }

  try {
    let data: CampaignEnemy

    if (editingEnemyId) {
      const { data: updated, error: updateError } = await supabase
        .from('campaign_enemies')
        .update(payload)
        .eq('id', editingEnemyId)
        .eq('campaign_id', selectedCampaignId)
        .select('*')
        .single()

      if (updateError) throw updateError

      data = updated as CampaignEnemy
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('campaign_enemies')
        .insert({
          ...payload,
          sheet_data: { identity: { name: enemyName.trim() } },
          updated_at: undefined,
        })
        .select('*')
        .single()

      if (insertError) throw insertError

      data = inserted as CampaignEnemy
    }

    setEnemies(current => {
      const exists = current.some(enemy => enemy.id === data.id)

      return exists
        ? current.map(enemy =>
            enemy.id === data.id
              ? { ...data, sheet_data: enemy.sheet_data }
              : enemy
          )
        : [...current, data]
    })

    setSelectedEnemyId(data.id)

    setEnemyName('')
    setEnemyEmoji('👹')
    setEnemyArchetype('')
    setEnemyDescription('')
    setEditingEnemyId(null)
    setShowEnemyForm(false)
    setEnemySearch('')
    setEnemyArchetypeFilter('all')

    setNotice(
      editingEnemyId
        ? 'Inimigo atualizado com sucesso!'
        : 'Inimigo cadastrado com sucesso!'
    )
  } catch (err) {
    setError(`Não foi possível salvar o inimigo: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setEnemySaving(false)
  }
}

async function duplicateEnemy(enemy: CampaignEnemy) {
  if (!isMaster || !selectedCampaignId || !session?.user.id || enemySaving) return
  if (enemySheetDirty &&
      !window.confirm('Existem alterações não salvas na ficha atual. A cópia utilizará a última versão salva do inimigo escolhido. Deseja continuar?')) return

  const suggestedName = `${enemy.name} (cópia)`
  const requestedName = window.prompt('Nome da nova ficha independente:', suggestedName)
  if (requestedName === null) return
  const name = requestedName.trim()
  if (!name) {
    setError('Informe um nome para a cópia do inimigo.')
    return
  }

  const maxima = getEnemySheetOverview(enemy)
  const duplicateData = structuredClone(enemy.sheet_data ?? {})
  delete duplicateData.enemyPartyBySeason
  duplicateData.identity = { ...(duplicateData.identity || {}), name }
  duplicateData.combat = { ...(duplicateData.combat || {}), history: [] }
  delete duplicateData.combat.initiative
  duplicateData.status = {
    ...(duplicateData.status || {}),
    current: {
      ...(duplicateData.status?.current || {}),
      pv: maxima.maxPV, ps: maxima.maxPS, pr: maxima.maxPR,
    },
  }

  setEnemySaving(true)
  setError('')
  try {
    const { data, error: duplicateError } = await supabase
      .from('campaign_enemies')
      .insert({
        campaign_id: selectedCampaignId,
        name,
        emoji: enemy.emoji,
        archetype: enemy.archetype,
        description: enemy.description,
        sheet_data: duplicateData,
        created_by: session.user.id,
      })
      .select('id,campaign_id,name,emoji,archetype,description,sheet_data,created_by,created_at,updated_at')
      .single()
    if (duplicateError) throw duplicateError
    setEnemies(current => [...current, data as CampaignEnemy])
    setSelectedEnemyId(data.id)
    setEnemySheetView(true)
    setNotice(`Ficha independente de "${name}" criada com sucesso!`)
  } catch (err) {
    setError(`Não foi possível duplicar o inimigo: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    setEnemySaving(false)
  }
}

async function deleteEnemy(enemy: CampaignEnemy) {
  if (!isMaster || !selectedCampaignId) return

  const confirmed = window.confirm(
    `Tem certeza que deseja excluir "${enemy.name}"? Essa ação não poderá ser desfeita.`
  )

  if (!confirmed) return

  setError('')
  setNotice('')

  const { error: deleteError } = await supabase
    .from('campaign_enemies')
    .delete()
    .eq('id', enemy.id)
    .eq('campaign_id', selectedCampaignId)

  if (deleteError) {
    setError(`Não foi possível excluir o inimigo: ${deleteError.message}`)
    return
  }

  setEnemies(current => current.filter(item => item.id !== enemy.id))

  setSelectedEnemyId(current =>
    current === enemy.id
      ? enemies.find(item => item.id !== enemy.id)?.id ?? null
      : current
  )

  setNotice('Inimigo excluído com sucesso!')
}



function adjustEnemyWallet(currencyId: string, adjustment: number, description: string) {
  if (!selectedEnemyId || !isMaster || !Number.isFinite(adjustment) || !currencyId) return
  const wallet = readEnemySheet('wallet', {}) as Record<string, any>
  const balances: Record<string, number> = { ...(wallet.balances || {}) }
  const current = Math.max(0, Number(balances[currencyId]) || 0)
  if (current + adjustment < 0) { setError('Saldo insuficiente para esta movimentação.'); return }
  balances[currencyId] = Math.round((current + adjustment) * 1e8) / 1e8
  const history = Array.isArray(wallet.history) ? wallet.history : []
  writeEnemySheet('wallet', { ...wallet, balances, history: [{
    id: crypto.randomUUID(), at: new Date().toISOString(),
    currencyId, amount: adjustment, description: description || 'Ajuste de saldo',
  }, ...history].slice(0, 200) })
  setNotice('Carteira do inimigo atualizada.')
}
function convertEnemyWallet(fromId: string, toId: string, amount: number) {
  const currencies = selectedCampaign?.currency_config?.currencies ?? []
  const from = currencies.find(entry => entry.id === fromId)
  const to = currencies.find(entry => entry.id === toId)
  if (!from || !to || fromId === toId || !Number.isFinite(amount) || amount <= 0) {
    setError('Selecione duas moedas diferentes e uma quantia válida.'); return
  }
  const wallet = readEnemySheet('wallet', {}) as Record<string, any>
  const balances: Record<string, number> = { ...(wallet.balances || {}) }
  const available = Number(balances[fromId]) || 0
  if (amount > available) { setError('Saldo insuficiente para a conversão.'); return }
  const received = amount * from.conversionRate / to.conversionRate
  if (!Number.isFinite(received)) { setError('Taxa de conversão inválida.'); return }
  balances[fromId] = Math.round((available - amount) * 1e8) / 1e8
  balances[toId] = Math.round(((Number(balances[toId]) || 0) + received) * 1e8) / 1e8
  const history = Array.isArray(wallet.history) ? wallet.history : []
  writeEnemySheet('wallet', { ...wallet, balances, history: [{
    id: crypto.randomUUID(), at: new Date().toISOString(), currencyId: fromId,
    amount: -amount, description: `Conversão de ${from.symbol} ${amount} para ${to.symbol} ${received.toFixed(2)}`,
  }, ...history].slice(0, 200) })
  setNotice('Conversão registrada na carteira do inimigo.')
}

async function saveEnemyNameFromSheet() {
  if (!isMaster || !selectedCampaignId || !selectedEnemyId || enemySheetNameSaving) return
  const name = enemySheetNameDraft.trim()
  if (!name) { setError('O nome do inimigo não pode ficar vazio.'); return }
  if (name === selectedEnemy?.name) return
  setEnemySheetNameSaving(true)
  try {
    const { data, error: renameError } = await supabase.from('campaign_enemies')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', selectedEnemyId).eq('campaign_id', selectedCampaignId)
      .select('id, name, updated_at').single()
    if (renameError || !data) throw renameError ?? new Error('Inimigo não encontrado.')
    setEnemies(current => current.map(enemy => enemy.id === data.id
      ? { ...enemy, name: data.name, updated_at: data.updated_at }
      : enemy))
    writeEnemySheet('identity.name', name)
    setNotice('Nome do inimigo atualizado.')
  } catch (err) {
    setError('Não foi possível atualizar o nome do inimigo: ' + (err instanceof Error ? err.message : String(err)))
  } finally { setEnemySheetNameSaving(false) }
}

function writeEnemySheet(path: string, value: any) {
  let current: Record<string, any> = {}

  try {
    current = JSON.parse(enemySheetDraftRef.current)
  } catch {
    current = {}
  }

  const next = structuredClone(current)
  const keys = path.split('.')

  let target = next

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]

    if (
      !target[key] ||
      typeof target[key] !== 'object' ||
      Array.isArray(target[key])
    ) {
      target[key] = {}
    }

    target = target[key]
  }

  target[keys[keys.length - 1]] = value

  const draft = JSON.stringify(next, null, 2)

  enemySheetDraftRef.current = draft
  setEnemySheetDraft(draft)
  setEnemySheetDirty(true)
  setEnemyAutoSaveStatus('pending')
  enemyFailedAutoSaveDraftRef.current = null
}

function readEnemySheet(path: string, fallback: any = 0) {
  let data: Record<string, any> = {}

  try {
    data = JSON.parse(enemySheetDraftRef.current)
  } catch {
    data = {}
  }

  return path
    .split('.')
    .reduce(
      (obj: any, key: string) =>
        obj && typeof obj === 'object' ? obj[key] : undefined,
      data
    ) ?? fallback
}

async function saveEnemySheet(automatic = false) {
  const campaignId = selectedCampaignId
  const enemyId = selectedEnemyId
  const ownerKey = `${campaignId}:${enemyId}`
  if (
    !isMaster || !campaignId || !enemyId || enemySheetSavingRef.current ||
    enemySheetLoadedForRef.current !== ownerKey
  ) return

  const originalDraft = enemySheetDraftRef.current
  let sheetData: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(originalDraft)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('A ficha precisa conter um objeto válido.')
    }
    sheetData = parsed as Record<string, unknown>
  } catch (err) {
    setError(`Não foi possível ler a ficha: ${err instanceof Error ? err.message : String(err)}`)
    setEnemyAutoSaveStatus('error')
    return
  }

  enemySheetSavingRef.current = true
  setEnemySheetSaving(true)
  setEnemyAutoSaveStatus('saving')
  if (!automatic) setError('')

  try {
    const { data, error: saveError } = await supabase
      .from('campaign_enemies')
      .update({ sheet_data: sheetData, updated_at: new Date().toISOString() })
      .eq('id', enemyId)
      .eq('campaign_id', campaignId)
      .select('id, sheet_data, updated_at')
      .single()

    if (saveError) throw saveError

    setEnemies(current => current.map(enemy => enemy.id === data.id
      ? { ...enemy, sheet_data: data.sheet_data, updated_at: data.updated_at }
      : enemy))

    // Uma resposta atrasada não pode limpar o rascunho de outro inimigo.
    if (enemySheetLoadedForRef.current === ownerKey) {
      if (enemySheetDraftRef.current === originalDraft) {
        setEnemySheetDirty(false)
        setEnemyAutoSaveStatus('saved')
      } else {
        setEnemySheetDirty(true)
        setEnemyAutoSaveStatus('pending')
      }
      enemyFailedAutoSaveDraftRef.current = null
      if (!automatic) setNotice('Ficha do inimigo salva com sucesso!')
    }
  } catch (err) {
    if (enemySheetLoadedForRef.current === ownerKey) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Não foi possível salvar a ficha do inimigo: ${message}`)
      setEnemyAutoSaveStatus('error')
      // Evita uma sequência de tentativas sem limite enquanto o servidor falha.
      enemyFailedAutoSaveDraftRef.current = originalDraft
    }
  } finally {
    enemySheetSavingRef.current = false
    setEnemySheetSaving(false)
  }
}

// Cada lançamento fica registrado exclusivamente dentro da ficha deste inimigo.

// Os testes seguem a mesma fórmula de rolagem das fichas de personagens.



async function saveShop() {
  if (!selectedCampaignId || !shopName.trim() || shopLoading) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const payload = {
    campaign_id: selectedCampaignId,
    name: shopName.trim(),
    description: shopDescription.trim() || null,
  }

  try {
    if (editingShopId) {
      const { data, error: updateError } = await supabase
        .from('campaign_shops')
        .update({
          name: payload.name,
          description: payload.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingShopId)
        .select('id, campaign_id, name, description, is_visible')
        .single()

      if (updateError) throw updateError

      setShops(current =>
        current.map(shop => shop.id === editingShopId
          ? data as CampaignShop
          : shop
        )
      )

      setNotice('Loja atualizada com sucesso!')
    } else {
      const { data, error: insertError } = await supabase
        .from('campaign_shops')
        .insert({
  ...payload,
  is_visible: false,
})
        .select('id, campaign_id, name, description, is_visible')
        .single()

      if (insertError) throw insertError

      const newShop = data as CampaignShop
      setShops(current => [...current, newShop])
      setSelectedShopId(newShop.id)
      setNotice('Loja criada com sucesso!')
    }

    setShopName('')
    setShopDescription('')
    setEditingShopId(null)
    setShowShopForm(false)
  } catch (err) {
    setError(`Não foi possível salvar a loja: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setShopLoading(false)
  }
}

async function toggleShopVisibility(shop: CampaignShop) {
  if (!isMaster || !selectedCampaignId || shopLoading) return

  const nextVisibility = !shop.is_visible

  setShopLoading(true)
  setError('')
  setNotice('')

  try {
    const { data, error: updateError } = await supabase
      .from('campaign_shops')
      .update({
        is_visible: nextVisibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shop.id)
      .eq('campaign_id', selectedCampaignId)
      .select('id, campaign_id, name, description, is_visible')
      .single()

    if (updateError) throw updateError

    setShops(current =>
      current.map(entry =>
        entry.id === shop.id
          ? data as CampaignShop
          : entry
      )
    )

    setNotice(
      nextVisibility
        ? `A loja "${shop.name}" agora está visível para os jogadores.`
        : `A loja "${shop.name}" agora está oculta para os jogadores.`
    )
  } catch (err) {
    setError(`Não foi possível alterar a visibilidade: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setShopLoading(false)
  }
}

function editShop(shop: CampaignShop) {
  setEditingShopId(shop.id)
  setShopName(shop.name)
  setShopDescription(shop.description ?? '')
  setShowShopForm(true)
}

async function deleteShop(shop: CampaignShop) {
  if (!window.confirm(
    `Deseja excluir a loja "${shop.name}" e todos os seus produtos?`
  )) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const { error: deleteError } = await supabase
    .from('campaign_shops')
    .delete()
    .eq('id', shop.id)

  if (deleteError) {
    setError(`Não foi possível excluir a loja: ${deleteError.message}`)
    setShopLoading(false)
    return
  }

  setShops(current => current.filter(entry => entry.id !== shop.id))
  setShopItems(current => current.filter(item => item.shop_id !== shop.id))

  if (selectedShopId === shop.id) {
    const remaining = shops.filter(entry => entry.id !== shop.id)
    setSelectedShopId(remaining[0]?.id ?? '')
  }

  setNotice('Loja excluída com sucesso.')
  setShopLoading(false)
}


async function saveShopItem() {
  if (!selectedShopId) {
    setError('Selecione uma loja antes de cadastrar o produto.')
    return
  }

  if (!shopItemName.trim()) {
    setError('Informe o nome do produto.')
    return
  }

  if (!shopItemCategories.length) {
    setError('Selecione pelo menos uma classificação para o produto.')
    return
  }

  if (shopLoading) {
    setError('Aguarde a operação atual terminar antes de salvar o produto.')
    return
  }

  const price = Number(shopItemPrice.replace(',', '.'))
  const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass)
  const weight = automaticWeight ?? Number(shopItemWeight.replace(',', '.'))
  const stockText = shopItemStock.trim()
  const stock = stockText === '' ? null : Number(stockText)

  if (!Number.isFinite(price) || price < 0) {
    setError('Informe um preço válido, igual ou maior que zero.')
    return
  }

  if (!Number.isFinite(weight) || weight < 0) {
    setError('Informe um peso válido, igual ou maior que zero.')
    return
  }

  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    setError('O estoque deve ser um número inteiro igual ou maior que zero.')
    return
  }

  if (price > 0 && !shopItemCurrencyId) {
    setError('Selecione a moeda utilizada neste produto.')
    return
  }

  setShopLoading(true)
  setError('')
  setNotice('')

  const shopEquipmentTypeForSave = shopItemCategories.includes('Equipamento') ? shopItemEquipmentType : 'none'
  const payload = {
    shop_id: selectedShopId,
    name: shopItemName.trim(),
    description: shopItemDescription.trim() || null,
    category: shopItemCategories[0] ?? shopItemCategory.trim() ?? 'Diversos',
    weight,
    unit_price: price,
    currency_id: price > 0 ? shopItemCurrencyId : null,
    quantity: stock,
    metadata: {
      ...(editingShopItemId ? shopItems.find(item => item.id === editingShopItemId)?.metadata ?? {} : {}),
      icon: shopItemEmoji.trim() || '📦',
      rarity: shopItemRarity,
      categories: shopItemCategories.length ? shopItemCategories : [shopItemCategory],
      equipmentType: isCyberFlowerSystem ? shopEquipmentTypeForSave : (
  shopEquipmentTypeForSave === 'cybernetic' ? 'none' : shopEquipmentTypeForSave
),
      armorClass: shopEquipmentTypeForSave === 'armor' ? shopItemArmorClass : null,
      armorCoverage: shopEquipmentTypeForSave === 'armor' ? (shopItemArmorClass === 'pesada' ? 'todos' : shopItemArmorCoverage) : null,
      protectionTier: shopEquipmentTypeForSave === 'protection' ? shopItemProtectionTier : null,
      protectionMode: shopEquipmentTypeForSave === 'protection' ? shopItemProtectionMode : null,
      scarcityLevel: shopItemCategories.includes('Consumíveis') ? Number(shopItemScarcityLevel) : null,
      scarcityDie: shopItemCategories.includes('Consumíveis') ? ({ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' } as Record<string, string>)[shopItemScarcityLevel] : null,
      scarcityCharge: shopItemCategories.includes('Consumíveis') ? ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[shopItemScarcityLevel] : null,
      scarcityExhausted: shopItemCategories.includes('Consumíveis') ? shopItemScarcityExhausted : false,
      weaponClass: shopItemCategories.includes('Armas') ? shopItemWeaponClass : null,
      weaponDamage: shopItemCategories.includes('Armas') ? ({ improvised: '1d4', advanced: '1d6', special: '1d8', black_red: '1d10', mutable: '1d12' } as Record<string, string>)[shopItemWeaponClass] || '1d4' : null,
      weaponWeight: shopItemCategories.includes('Armas') ? weight : null,

cybernetic: isCyberFlowerSystem && shopEquipmentTypeForSave === 'cybernetic',
cyberneticEquipped: false,
biologicalLoad: isCyberFlowerSystem && shopEquipmentTypeForSave === 'cybernetic'
  ? Math.max(0, Number(shopCyberneticLoad) || 0)
  : null,
cyberneticData: isCyberFlowerSystem && shopEquipmentTypeForSave === 'cybernetic'
  ? {
      name: shopItemName.trim(),
      category: shopCyberneticCategory,
      description: shopItemDescription.trim(),
      location: shopCyberneticLocation.trim(),
      biologicalLoad: Math.max(0, Number(shopCyberneticLoad) || 0),
      cost: String(price),
      effects: shopCyberneticEffects.trim(),
      status: 'stored',
    }
  : null,
    },
  }

  try {
    if (editingShopItemId) {
      const { data, error: updateError } = await supabase
        .from('campaign_shop_items')
        .update({
          name: payload.name,
          description: payload.description,
          category: payload.category,
          weight: payload.weight,
          unit_price: payload.unit_price,
          currency_id: payload.currency_id,
          quantity: payload.quantity,
          metadata: payload.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingShopItemId)
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .single()

      if (updateError) throw updateError

      setShopItems(current =>
        current.map(item =>
          item.id === editingShopItemId
            ? data as CampaignShopItem
            : item
        )
      )

      setNotice('Produto atualizado com sucesso!')
    } else {
      const { data, error: insertError } = await supabase
        .from('campaign_shop_items')
        .insert(payload)
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .single()

      if (insertError) throw insertError

      setShopItems(current => [...current, data as CampaignShopItem])
      setNotice('Produto cadastrado com sucesso!')
    }

    setEditingShopItemId(null)
    setShopItemName('')
    setShopItemDescription('')
    setShopItemCategory('Diversos')
    setShopItemRarity('comum')
    setShopItemWeight('0')
    setShopItemPrice('0')
    setShopItemCurrencyId('')
    setShopItemStock('')
    setShopItemEmoji('📦')
    setShopItemCategories(['Diversos'])
    setShopItemEquipmentType('none')
    setShopItemArmorClass('leve')
    setShopItemArmorCoverage('cortante_perfurante')
    setShopItemProtectionTier('basica')
    setShopItemProtectionMode('resistencia')
    setShopItemWeaponClass('improvised')
    setShopItemScarcityLevel('1')
    setShopItemScarcityExhausted(false)
    setShowShopItemForm(false)
  } catch (err) {
    const dbError = err as { message?: string; code?: string; details?: string; hint?: string }
    const reason = [
      dbError?.message ?? (err instanceof Error ? err.message : String(err)),
      dbError?.code ? `Código: ${dbError.code}` : '',
      dbError?.details ? `Detalhes: ${dbError.details}` : '',
      dbError?.hint ? `Sugestão do banco: ${dbError.hint}` : '',
    ].filter(Boolean).join(' · ')
    setError(`Não foi possível salvar o produto: ${reason}`)
  } finally {
    setShopLoading(false)
  }
}

function editShopItem(item: CampaignShopItem) {
  setEditingShopItemId(item.id)
  setShopItemName(item.name)
  setShopItemDescription(item.description ?? '')
  setShopItemCategory(item.category)
  setShopItemCategories(Array.isArray(item.metadata?.categories) ? item.metadata.categories.filter((value): value is string => typeof value === 'string') : [item.category])
  setShopItemRarity(typeof item.metadata?.rarity === 'string' ? item.metadata.rarity.toLocaleLowerCase('pt-BR') : 'comum')
  setShopItemEquipmentType(
  item.metadata?.equipmentType === 'armor' ||
  item.metadata?.equipmentType === 'protection' ||
  (isCyberFlowerSystem && item.metadata?.equipmentType === 'cybernetic')
    ? item.metadata.equipmentType
    : 'none'
)

const cyberneticData = isCyberFlowerSystem
  ? item.metadata?.cyberneticData as Record<string, unknown> | undefined
  : undefined

setShopCyberneticCategory(
  typeof cyberneticData?.category === 'string' ? cyberneticData.category : 'Outro'
)
setShopCyberneticLocation(
  typeof cyberneticData?.location === 'string' ? cyberneticData.location : ''
)
setShopCyberneticLoad(
  String(cyberneticData?.biologicalLoad ?? item.metadata?.biologicalLoad ?? 0)
)
setShopCyberneticEffects(
  typeof cyberneticData?.effects === 'string' ? cyberneticData.effects : ''
)
  setShopItemArmorClass(item.metadata?.armorClass === 'media' || item.metadata?.armorClass === 'pesada' ? item.metadata.armorClass : 'leve')
  setShopItemArmorCoverage(item.metadata?.armorCoverage === 'especial_bruto' || item.metadata?.armorCoverage === 'todos' ? item.metadata.armorCoverage : 'cortante_perfurante')
  setShopItemProtectionTier(item.metadata?.protectionTier === 'moderada' || item.metadata?.protectionTier === 'avancada' ? item.metadata.protectionTier : 'basica')
  setShopItemProtectionMode(item.metadata?.protectionMode === 'sanidade' ? 'sanidade' : 'resistencia')
  setShopItemWeaponClass(typeof item.metadata?.weaponClass === 'string' ? item.metadata.weaponClass : 'improvised')
  setShopItemScarcityLevel(['1', '2', '3', '4'].includes(String(item.metadata?.scarcityLevel ?? '1')) ? String(item.metadata?.scarcityLevel ?? '1') as '1' | '2' | '3' | '4' : '1')
  setShopItemScarcityExhausted(item.metadata?.scarcityExhausted === true)
  setShopItemWeight(String(item.weight))
  setShopItemPrice(String(item.unit_price))
  setShopItemCurrencyId(item.currency_id ?? '')
  setShopItemStock(item.quantity === null ? '' : String(item.quantity))
  setShopItemEmoji(
    typeof item.metadata?.icon === 'string'
      ? item.metadata.icon
      : '📦'
  )
  setShowShopItemForm(true)
}

async function deleteShopItem(item: CampaignShopItem) {
  if (!window.confirm(`Deseja excluir o produto "${item.name}"?`)) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const { error: deleteError } = await supabase
    .from('campaign_shop_items')
    .delete()
    .eq('id', item.id)

  if (deleteError) {
    setError(`Não foi possível excluir o produto: ${deleteError.message}`)
    setShopLoading(false)
    return
  }

  setShopItems(current =>
    current.filter(entry => entry.id !== item.id)
  )

  setNotice('Produto excluído com sucesso.')
  setShopLoading(false)
}


async function purchaseShopItem(
  item: CampaignShopItem,
  quantity: number = 1,
) {
  if (!shopPurchaseCharacterId || shopPurchaseLoading) {
    setError('Selecione um personagem antes de comprar.')
    return
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    setError('Informe uma quantidade válida.')
    return
  }

  if (!characters.some(character => character.id === shopPurchaseCharacterId && character.user_id === session?.user.id)) {
    setError('Selecione um personagem da sua conta para comprar.')
    return
  }
  if (item.purchase_blocked) {
    setError('Este produto está bloqueado para compra.')
    return
  }
  if (item.quantity !== null && item.quantity < quantity) {
    setError('Não há estoque suficiente deste produto.')
    return
  }

  setShopPurchaseLoading(item.id)
  setError('')
  setNotice('')

  let purchaseConfirmed = false
  try {
    const { data, error: purchaseError } = await supabase.rpc(
      'purchase_campaign_shop_item',
      {
        p_shop_item_id: item.id,
        p_character_id: shopPurchaseCharacterId,
        p_quantity: quantity,
      },
    )

    if (purchaseError) {
      const detail = [purchaseError.message, purchaseError.details, purchaseError.hint, purchaseError.code ? `Código ${purchaseError.code}` : ''].filter(Boolean).join(' · ')
      throw new Error(detail || 'A função de compra do Supabase retornou um erro sem descrição.')
    }
    purchaseConfirmed = true
    const result = (data ?? {}) as {
      item_name?: string
      quantity?: number
      total_price?: number
    }
    setNotice(`${result.quantity ?? quantity}x ${result.item_name ?? item.name} comprado com sucesso!`)

    // Atualiza o inventário do personagem
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .eq('character_id', shopPurchaseCharacterId)
      .order('created_at', { ascending: true })

    if (inventoryError) console.error('Compra confirmada, mas falhou atualização do inventário:', inventoryError)

    if (!inventoryError) setItems(current => [
      ...current.filter(entry => entry.character_id !== shopPurchaseCharacterId),
      ...((inventoryData ?? []) as Item[]),
    ])

    // Atualiza a carteira
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'get_character_currency',
      { p_character_id: shopPurchaseCharacterId },
    )

    if (balanceError) console.error('Compra confirmada, mas falhou atualização do saldo:', balanceError)

    if (!balanceError) setCurrencyBalances(
      balanceData && typeof balanceData === 'object'
        ? balanceData as Record<string, number>
        : {},
    )

    // Atualiza o estoque do produto
    const { data: updatedItem, error: stockError } = await supabase
      .from('campaign_shop_items')
      .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
      .eq('id', item.id)
      .maybeSingle()

    if (stockError) console.error('Compra confirmada, mas falhou atualização do estoque:', stockError)

    if (updatedItem) {
      setShopItems(current =>
        current.map(entry =>
          entry.id === item.id
            ? updatedItem as CampaignShopItem
            : entry
        )
      )
    }

    const purchasedCharacter = characters.find(character => character.id === shopPurchaseCharacterId)
    void recordCampaignActivity({
      activityType: 'shop_purchase',
      title: 'Compra realizada',
      description: `${result.quantity ?? quantity}x ${result.item_name ?? item.name}${purchasedCharacter ? ` · ${purchasedCharacter.name}` : ''}`,
      entityType: 'item',
      entityId: item.id,
    })
    setShopPurchaseQuantities(current => ({
  ...current,
  [item.id]: '1',
}))
  } catch (err) {
    const detail = err instanceof Error
      ? err.message
      : err && typeof err === 'object'
        ? [String((err as { message?: unknown }).message ?? ''), String((err as { details?: unknown }).details ?? ''), String((err as { hint?: unknown }).hint ?? ''), String((err as { code?: unknown }).code ?? '')].filter(Boolean).join(' · ') || JSON.stringify(err)
        : String(err)
    console.error('Falha na compra da loja:', err)
    if (purchaseConfirmed) {
      setNotice('Compra realizada no banco, mas houve falha ao atualizar a tela. Recarregue a página antes de tentar comprar novamente.')
    } else {
      setError(`Não foi possível concluir a compra: ${detail}`)
    }
  } finally {
    setShopPurchaseLoading(null)
  }
}

async function setItemRestriction(
  type: 'inventory' | 'shop',
  itemId: string,
  blocked: boolean,
) {
  setError('')
  setNotice('')

  try {
    const { error: restrictionError } = await supabase.rpc(
      'set_item_restriction',
      {
        p_target_type: type,
        p_target_id: itemId,
        p_blocked: blocked,
      },
    )

    if (restrictionError) throw restrictionError

    if (type === 'inventory') {
      setItems(current =>
        current.map(item =>
          item.id === itemId
            ? { ...item, sale_blocked: blocked }
            : item
        )
      )

      setSelectedItemDetails(current =>
        current?.id === itemId
          ? { ...current, sale_blocked: blocked }
          : current
      )

      setNotice(
        blocked
          ? 'Venda do item bloqueada pelo mestre.'
          : 'Venda do item liberada.'
      )
    } else {
      setShopItems(current =>
        current.map(item =>
          item.id === itemId
            ? { ...item, purchase_blocked: blocked }
            : item
        )
      )

      setNotice(
        blocked
          ? 'Compra do item bloqueada pelo mestre.'
          : 'Compra do item liberada.'
      )
    }
  } catch (err) {
    setError(
      `Não foi possível alterar o bloqueio: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

async function sellInventoryItem(item: Item, requestedQuantity?: number) {
  const quantity = requestedQuantity ?? Number(saleQuantity)

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    setError('Informe uma quantidade válida.')
    return
  }

  if (quantity > item.quantity) {
    setError('Você não possui essa quantidade do item.')
    return
  }

  if (saleLoading) return

  const isShopItem = Boolean(
    item.metadata?.shop_id && item.metadata?.shop_item_id
  )

const destinationShopId = selectedShopId || saleShopId

if (!isShopItem && !destinationShopId) {
  setError('Selecione a loja que receberá o item.')
  return
}

  const total = Number(item.unit_price) * quantity

  const confirmed = window.confirm(
    `Vender ${quantity}x ${item.name} por ${total.toLocaleString('pt-BR')}?`
  )

  if (!confirmed) return

  setSaleLoading(true)
  setError('')
  setNotice('')

  // Primeira etapa: realizar a venda no banco.
  const { data, error: saleError } = await supabase.rpc(
    'sell_character_inventory_item',
    {
      p_inventory_item_id: item.id,
      p_shop_id: isShopItem ? null : destinationShopId,
      p_quantity: quantity,
    },
  )

  if (saleError) {
    setError(`Não foi possível vender o item: ${saleError.message}`)
    setSaleLoading(false)
    return
  }

  // A venda já foi concluída. Não devemos desfazer esse sucesso
  // visualmente caso alguma consulta de atualização falhe.
  const result = data as {
    item_name?: string
    quantity?: number
    total_price?: number
  }

  setNotice(
    `${result.quantity ?? quantity}x ${result.item_name ?? item.name} vendido(s) por ${Number(result.total_price ?? total).toLocaleString('pt-BR')}.`
  )

  setSelectedItemDetails(null)
  setSaleQuantity('1')
  setSaleShopId('')

  // Segunda etapa: atualizar os dados exibidos na página.
  const refreshErrors: string[] = []

  try {
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .eq('character_id', item.character_id)
      .order('created_at', { ascending: true })

    if (inventoryError) throw inventoryError

    setItems((inventoryData ?? []) as Item[])
  } catch (err) {
    refreshErrors.push('inventário')
  }

  try {
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'get_character_currency',
      { p_character_id: item.character_id },
    )

    if (balanceError) throw balanceError

    setCurrencyBalances(
      balanceData && typeof balanceData === 'object'
        ? balanceData as Record<string, number>
        : {},
    )
  } catch (err) {
    refreshErrors.push('carteira')
  }

  if (shops.length > 0) {
    try {
      const { data: shopData, error: shopError } = await supabase
        .from('campaign_shop_items')
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .in('shop_id', shops.map(shop => shop.id))
        .order('created_at', { ascending: true })

      if (shopError) throw shopError

      setShopItems((shopData ?? []) as CampaignShopItem[])
    } catch (err) {
      refreshErrors.push('estoque das lojas')
    }
  }

  if (refreshErrors.length > 0) {
    setError(
      `A venda foi realizada, mas não foi possível atualizar: ${refreshErrors.join(', ')}. Recarregue a página para sincronizar os dados.`
    )
  }

  setSaleLoading(false)
}

async function loadCurrencyHistory() {
  if (!selectedCharacterId || currencyHistoryLoading) return

  setCurrencyHistoryLoading(true)

  const { data, error: historyError } = await supabase
    .from('character_currency_transactions')
    .select('id, character_id, campaign_id, currency_id, amount_delta, balance_after, description, created_by, created_at')
    .eq('character_id', selectedCharacterId)
    .order('created_at', { ascending: false })

  if (historyError) {
    setError(`Erro ao carregar histórico: ${historyError.message}`)
    setCurrencyTransactions([])
  } else {
    setCurrencyTransactions((data ?? []) as CurrencyTransaction[])
  }

  setCurrencyHistoryLoading(false)
}

async function toggleCurrencyHistory() {
  const nextState = !showCurrencyHistory

  setShowCurrencyHistory(nextState)

  if (nextState) {
    setCurrencyTransactions([])
    await loadCurrencyHistory()
  }
}

async function clearCurrencyHistory() {
  if (!selectedCharacterId || currencyHistoryLoading) return

  const confirmed = window.confirm(
    'Tem certeza que deseja apagar todo o histórico de transações deste personagem? Os saldos das moedas NÃO serão alterados. Esta ação não pode ser desfeita.'
  )

  if (!confirmed) return

  setCurrencyHistoryLoading(true)
  setError('')
  setNotice('')

  const { data, error: deleteError } = await supabase
    .from('character_currency_transactions')
    .delete()
    .eq('character_id', selectedCharacterId)
    .select('id')

  if (deleteError) {
    setError(`Não foi possível limpar o histórico: ${deleteError.message}`)
  } else if (!data || data.length === 0) {
    setError('Nenhuma transação foi apagada. Verifique as permissões.')
  } else {
    setCurrencyTransactions([])
    setNotice('Histórico de transações apagado com sucesso.')
  }

  setCurrencyHistoryLoading(false)
}

async function saveCampaignCurrencyConfig(nextCurrencies: NonNullable<Campaign['currency_config']>['currencies']) {
  if (!selectedCampaign || !isMaster || currencyConfigSaving) return
  setCurrencyConfigSaving(true)
  setError('')
  setNotice('')
  const nextConfig = { currencies: nextCurrencies }
  const { data, error: updateError } = await supabase
    .from('campaigns')
    .update({ currency_config: nextConfig })
    .eq('id', selectedCampaign.id)
    .select('id, name, description, system_name, currency_config, created_by')
    .maybeSingle()
  if (updateError || !data) {
    setError(`Não foi possível salvar as moedas: ${updateError?.message ?? 'nenhum registro atualizado; verifique as permissões da campanha.'}`)
    setCurrencyConfigSaving(false)
    return false
  }
  setCampaigns(current => current.map(campaign => campaign.id === selectedCampaign.id ? { ...campaign, currency_config: data.currency_config } : campaign))
  setNotice('Configuração de moedas salva. A primeira moeda da lista é a moeda do sistema.')
  setCurrencyConfigSaving(false)
  return true
}

async function addCampaignCurrency() {
  if (!selectedCampaign || !currencyDraftName.trim() || !currencyDraftSymbol.trim()) {
    setError('Informe o nome e o símbolo da moeda.')
    return
  }
  const rate = Number(currencyDraftRate.replace(',', '.'))
  if (!Number.isFinite(rate) || rate <= 0) {
    setError('A taxa de conversão deve ser maior que zero.')
    return
  }
  const current = selectedCampaign.currency_config?.currencies ?? []
  const next = [...current, { id: crypto.randomUUID(), name: currencyDraftName.trim(), symbol: currencyDraftSymbol.trim(), conversionRate: rate }]
  await saveCampaignCurrencyConfig(next)
  if (!currencyConfigSaving) {
    setCurrencyDraftName('')
    setCurrencyDraftSymbol('')
    setCurrencyDraftRate('1')
  }
}

function beginEditingCampaignCurrency(currency: NonNullable<Campaign['currency_config']>['currencies'][number]) {
  setEditingCurrencyId(currency.id)
  setCurrencyDraftName(currency.name)
  setCurrencyDraftSymbol(currency.symbol)
  setCurrencyDraftRate(String(currency.conversionRate))
}

async function saveEditedCampaignCurrency() {
  if (!selectedCampaign || !editingCurrencyId || !currencyDraftName.trim() || !currencyDraftSymbol.trim()) {
    setError('Informe o nome e o símbolo da moeda.')
    return
  }
  const rate = Number(currencyDraftRate.replace(',', '.'))
  if (!Number.isFinite(rate) || rate <= 0) {
    setError('A taxa de conversão deve ser maior que zero.')
    return
  }
  const current = selectedCampaign.currency_config?.currencies ?? []
  const next = current.map(currency => currency.id === editingCurrencyId
    ? { ...currency, name: currencyDraftName.trim(), symbol: currencyDraftSymbol.trim(), conversionRate: rate }
    : currency)
  const saved = await saveCampaignCurrencyConfig(next)
  if (!saved) return
  setEditingCurrencyId(null)
  setCurrencyDraftName('')
  setCurrencyDraftSymbol('')
  setCurrencyDraftRate('1')
}

async function handleCurrencyAdjustment(action: 'add' | 'remove') {
  if (!selectedCharacterId || !selectedCampaign || currencyActionLoading) return

  const currencies = selectedCampaign.currency_config?.currencies ?? []
  const currency = currencies.find(
    item => item.id === (currencyAdjustmentId || currencies[0]?.id),
  )

  if (!currency) {
    setError('Esta campanha ainda não possui moedas configuradas.')
    return
  }

  const amount = Number(currencyAmount.replace(',', '.'))

  if (!Number.isFinite(amount) || amount <= 0) {
    setError('Informe um valor válido e maior que zero.')
    return
  }

  setCurrencyActionLoading(true)
  setError('')
  setNotice('')

  const { data, error: adjustmentError } = await supabase.rpc(
    'adjust_character_currency',
    {
      p_character_id: selectedCharacterId,
      p_currency_id: currency.id,
      p_amount: action === 'add' ? amount : -amount,
      p_description: currencyDescription.trim() || null,
    },
  )

  if (adjustmentError) {
    setError(`Não foi possível movimentar a carteira: ${adjustmentError.message}`)
    setCurrencyActionLoading(false)
    return
  }

  setCurrencyBalances(current => ({
    ...current,
    [currency.id]: Number(data),
  }))

  setCurrencyAmount('')
  setCurrencyDescription('')
  setNotice(
    action === 'add'
      ? 'Dinheiro adicionado à carteira!'
      : 'Dinheiro retirado da carteira!',
  )

  if (showCurrencyHistory) {
    await loadCurrencyHistory()
  }

  setCurrencyActionLoading(false)
}

async function handleCurrencyConversion() {
  if (!selectedCharacterId || !selectedCampaign || currencyActionLoading) return

  const currencies = selectedCampaign.currency_config?.currencies ?? []
  const fromCurrency = currencies.find(currency => currency.id === conversionFromId)
  const toCurrency = currencies.find(currency => currency.id === conversionToId)
  const amount = Number(conversionAmount.replace(',', '.'))

  if (!fromCurrency || !toCurrency) {
    setError('Selecione as moedas de origem e destino.')
    return
  }

  if (fromCurrency.id === toCurrency.id) {
    setError('Escolha duas moedas diferentes.')
    return
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    setError('Informe um valor válido e maior que zero.')
    return
  }

  if ((currencyBalances[fromCurrency.id] ?? 0) < amount) {
    setError(`Saldo insuficiente em ${fromCurrency.name}.`)
    return
  }

  setCurrencyActionLoading(true)
  setError('')
  setNotice('')

  const { data, error: conversionError } = await supabase.rpc(
    'convert_character_currency',
    {
      p_character_id: selectedCharacterId,
      p_from_currency_id: fromCurrency.id,
      p_to_currency_id: toCurrency.id,
      p_amount: amount,
    },
  )

  if (conversionError) {
    setError(`Não foi possível converter as moedas: ${conversionError.message}`)
    setCurrencyActionLoading(false)
    return
  }

  setCurrencyBalances(current => ({
    ...current,
    [fromCurrency.id]: Number(data.from_balance),
    [toCurrency.id]: Number(data.to_balance),
  }))

  setConversionAmount('')
  setNotice(
    `Conversão realizada! ${amount.toLocaleString('pt-BR')} ${fromCurrency.name} → ${Number(data.amount_received).toLocaleString('pt-BR')} ${toCurrency.name}.`,
  )

  if (showCurrencyHistory) {
    await loadCurrencyHistory()
  }

  setCurrencyActionLoading(false)
}

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(`Não foi possível sair: ${signOutError.message}`)
    }
  }

  async function saveCampaignDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingCampaignId || !isMaster || !campaignName.trim()) return

    setLoading(true)
    setError('')
    setNotice('')

    const normalizedSystemName = systemName.trim() || null
    const existingCurrencies = campaigns.find(campaign => campaign.id === editingCampaignId)?.currency_config?.currencies ?? []
    const shouldAddDefaultCurrency =
      getSystemByName(normalizedSystemName)?.data?.features?.hasDefaultCurrency === true &&
      existingCurrencies.length === 0
    const campaignUpdate: Record<string, unknown> = {
      name: campaignName.trim(),
      description: campaignDescription.trim() || null,
      system_name: normalizedSystemName,
      ...(shouldAddDefaultCurrency ? { currency_config: { currencies: [{ id: crypto.randomUUID(), name: 'Iene', symbol: '¥', conversionRate: 1 }] } } : {}),
    }

    const { data, error: updateError } = await supabase
      .from('campaigns')
      .update(campaignUpdate)
      .eq('id', editingCampaignId)
      .select('id, name, description, system_name, currency_config, created_by')
      .maybeSingle()

    if (updateError || !data) {
      setError(`Não foi possível atualizar a campanha: ${updateError?.message ?? 'nenhum registro atualizado. Verifique as permissões RLS.'}`)
      setLoading(false)
      return
    }

    setCampaigns(current => current.map(campaign =>
      campaign.id === editingCampaignId ? { ...campaign, ...data } : campaign
    ))
    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
    setCampaignSystemChoice('')
    setEditingCampaignId(null)
    setShowCampaignForm(false)
    setNotice('Campanha atualizada com sucesso!')
    setLoading(false)
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!campaignName.trim()) return

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase.rpc(
      'create_campaign',
      {
        p_name: campaignName.trim(),
        p_description: campaignDescription.trim() || null,
        p_system_name: systemName.trim() || null,
      },
    )

    if (createError) {
      setError(`Não foi possível criar a campanha: ${createError.message}`)
      setLoading(false)
      return
    }

    const newCampaignId = data as string

    const { data: membership, error: membershipError } = await supabase
      .from('campaign_members')
      .select('campaign_id, role')
      .eq('campaign_id', newCampaignId)
      .eq('user_id', session!.user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      setError(
        'A campanha foi criada, mas não consegui confirmar sua participação. Atualize a página.',
      )
      setLoading(false)
      return
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, description, system_name, currency_config, created_by')
      .eq('id', newCampaignId)
      .single()

    if (fetchError || !campaign) {
      setError('A campanha foi criada. Atualize a página para carregá-la.')
      setLoading(false)
      return
    }

    let campaignToUse = campaign

    const selectedSystem = getSystemByName(campaign.system_name)
    const hasDefaultCurrency =
      selectedSystem?.data?.features?.hasDefaultCurrency === true

    if (
      hasDefaultCurrency &&
      !(campaign.currency_config?.currencies?.length)
    ) {
      const defaultCurrencyConfig =
        selectedSystem.id === 'ciclos'
          ? {
              currencies: [
                {
                  id: 'imperial',
                  name: 'Imperial',
                  symbol: '₰',
                  conversionRate: 1,
                },
                {
                  id: 'astra',
                  name: 'Astra',
                  symbol: '₳',
                  conversionRate: 0.1,
                },
                {
                  id: 'arkanis',
                  name: 'Arkanis',
                  symbol: 'ø',
                  conversionRate: 0.01,
                },
              ],
            }
          : createSystemDefaultCurrencyConfig()

      const { data: updatedCampaign, error: currencyInitError } =
        await supabase
          .from('campaigns')
          .update({ currency_config: defaultCurrencyConfig })
          .eq('id', newCampaignId)
          .select(
            'id, name, description, system_name, currency_config, created_by',
          )
          .single()

      if (currencyInitError || !updatedCampaign) {
        setError(
          `Campanha criada, mas não foi possível configurar as moedas automaticamente: ${currencyInitError?.message ?? 'erro desconhecido'}. Você pode adicioná-las nas configurações de moedas.`,
        )
      } else {
        campaignToUse = updatedCampaign
      }
    }

    setCampaigns((current) => [
      ...current,
      { ...campaignToUse, role: membership.role },
    ])
    setSelectedCampaignId(newCampaignId)
    setCharacters([])
    setItems([])
    setSelectedCharacterId('')
    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
    setCampaignSystemChoice('')
    setShowCampaignForm(false)
    setNotice('Campanha criada e salva!')
    void recordCampaignActivity({ activityType: 'campaign_created', title: 'Campanha criada', description: campaignToUse.name, entityType: 'campaign', entityId: newCampaignId, campaignId: newCampaignId })
    setLoading(false)
  }

  async function createCampaignInvite() {
    if (inviteLoading) return
    if (!selectedCampaignId) {
      setError('Selecione uma campanha antes de gerar o convite.')
      return
    }
    if (!isMaster) {
      setError('Somente o mestre da campanha pode gerar convites.')
      return
    }

    setInviteLoading(true)
    setError('')
    setNotice('')

    try {
      const { data, error: inviteError } = await supabase.rpc(
        'create_campaign_invite',
        { p_campaign_id: selectedCampaignId },
      )

      if (inviteError) {
        throw new Error(inviteError.message)
      }

      // A RPC normalmente retorna o token como texto. Também aceitamos
      // formatos JSON caso a função SQL tenha sido criada como RETURNS json.
      let token = ''
      if (typeof data === 'string') {
        token = data.trim()
      } else if (data && typeof data === 'object') {
        const result = data as Record<string, unknown>
        const candidate = result.token ?? result.invite_token ?? result.create_campaign_invite
        if (typeof candidate === 'string') token = candidate.trim()
      }

      if (!token) {
        throw new Error(
          `A função do Supabase respondeu, mas não retornou um token válido. Resposta: ${JSON.stringify(data)}`,
        )
      }

      const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`
      setCampaignInviteLink(link)
      setNotice('Convite criado. Copie o link e compartilhe com os jogadores.')
    } catch (inviteError) {
      const message = inviteError instanceof Error
        ? inviteError.message
        : String(inviteError)
      setError(`Não foi possível gerar o convite: ${message}`)
    } finally {
      setInviteLoading(false)
    }
  }


async function deleteCampaign(campaign: Campaign) {
  if (campaign.role !== 'master') {
    setError('Apenas o mestre pode excluir esta campanha.')
    return
  }

  const confirmation = window.prompt(
    `Esta ação é irreversível e apagará todos os dados da campanha "${campaign.name}".\n\nDigite o nome da campanha para confirmar:`
  )

  if (confirmation === null) return

  if (confirmation.trim() !== campaign.name) {
    setError('O nome digitado não corresponde ao nome da campanha. Exclusão cancelada.')
    return
  }

  setError('')
  setNotice('')

  const { error: deleteError } = await supabase.rpc('delete_campaign', {
    p_campaign_id: campaign.id,
  })

  if (deleteError) {
    setError(`Não foi possível excluir a campanha: ${deleteError.message}`)
    return
  }

  setCampaigns(current =>
    current.filter(entry => entry.id !== campaign.id)
  )

  if (selectedCampaignId === campaign.id) {
    setSelectedCampaignId('')
  }

  setNotice(`Campanha "${campaign.name}" excluída com sucesso.`)
}


  async function joinCampaignWithInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteCode.trim() || inviteLoading) return
    setInviteLoading(true); setError(''); setNotice('')
    const { data, error: joinError } = await supabase.rpc('join_campaign_by_invite', { p_token: inviteCode.trim() })
    if (joinError || !data) {
      setError(`Não foi possível entrar na campanha: ${joinError?.message ?? 'convite inválido'}`)
      setInviteLoading(false)
      return
    }
    const joinedId = typeof data === 'string' ? data : String(data)
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').select('id,name,description,system_name,currency_config,created_by').eq('id', joinedId).single()
    if (campaignError || !campaign) {
      setError(`Você entrou na campanha, mas não foi possível carregá-la: ${campaignError?.message ?? ''}`)
      setInviteLoading(false)
      return
    }
    setCampaigns(current =>
  current.some(entry => entry.id === campaign.id)
    ? current
    : [
        ...current,
        {
          ...campaign,
          currency_config: (campaign as Campaign).currency_config ?? null,
          role: 'player',
        },
      ],
)
    setSelectedCampaignId(campaign.id); setInviteCode(''); setCampaignInviteLink('')
    window.history.replaceState({}, '', window.location.pathname)
    setNotice(`Você entrou na campanha ${campaign.name}!`)
    setInviteLoading(false)
  }

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCampaignId || !isMaster || !newSeasonName.trim() || creatingSeasonRef.current) return
    creatingSeasonRef.current = true
    setCreatingSeason(true)
    setLoading(true); setError(''); setNotice('')
    try {
    const nextNumber = Math.max(0, ...seasons.map(season => season.season_number)) + 1
    const { data: created, error: createError } = await supabase.from('campaign_seasons').insert({ campaign_id: selectedCampaignId, name: newSeasonName.trim(), description: newSeasonDescription.trim() || null, season_number: nextNumber, status: seasons.some(season => season.status === 'active') ? 'draft' : 'active', created_by: session!.user.id }).select('*').single()
    if (createError || !created) { setError(`Não foi possível criar a temporada: ${createError?.message ?? 'resposta vazia'}`); setLoading(false); return }
    const season = created as Season
    // A temporada já existe no banco. Mostre-a imediatamente, mesmo se um snapshot falhar,
    // para evitar que o mestre a crie novamente ao tentar corrigir o problema.
    setSeasons(current => current.some(entry => entry.id === season.id) ? current : [...current, season].sort((a,b) => a.season_number-b.season_number))
    setSelectedSeasonId(season.id)
    setNewSeasonName('')
    setNewSeasonDescription('')
    for (const character of characters) {
      let initialData: Record<string, unknown> = {}
      if (copyPreviousSheet && selectedSeasonId) {
        const { data: previous, error: previousError } = await supabase.from('character_sheets').select('sheet_data').eq('character_id', character.id).eq('season_id', selectedSeasonId).maybeSingle()
        if (previousError) { setError(`Temporada criada, mas não foi possível copiar a ficha de ${character.name}: ${previousError.message}`); setLoading(false); return }
        initialData = (previous?.sheet_data ?? {}) as Record<string, unknown>
      }
      const { data: newSheet, error: newSheetError } = await supabase.from('character_sheets').insert({ character_id: character.id, season_id: season.id, sheet_data: initialData, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (newSheetError) { setError(`Temporada criada, mas a ficha de ${character.name} não foi inicializada: ${newSheetError.message}`); setLoading(false); return }
      const { error: versionError } = await supabase.from('character_sheet_versions').insert({ character_sheet_id: newSheet.id, character_id: character.id, season_id: season.id, sheet_data: initialData, milestone_type: 'season_start', milestone_name: `Início da temporada ${season.name}`, notes: 'Snapshot automático no início da temporada.', created_by: session!.user.id })
      if (versionError) { setError(`Ficha de ${character.name} criada, mas o snapshot inicial falhou: ${versionError.message}`); setLoading(false); return }
    }
    setSeasons(current => current.some(entry => entry.id === season.id) ? current : [...current, season].sort((a,b) => a.season_number-b.season_number)); setSelectedSeasonId(season.id); setNewSeasonName(''); setNewSeasonDescription(''); setNotice(`Temporada “${season.name}” criada.`); void recordCampaignActivity({ activityType: 'season_created', title: 'Temporada criada', description: `T${season.season_number} · ${season.name}`, entityType: 'season', entityId: season.id }); setLoading(false)
    } catch (err) {
      setError('Não foi possível concluir a criação: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      creatingSeasonRef.current = false
      setCreatingSeason(false)
      setLoading(false)
    }
  }

  async function saveSeasonTheme(themeKey: keyof typeof seasonThemes) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || seasonThemeSaving) return
    setSeasonThemeSaving(true)
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ theme_key: themeKey }).eq('id', season.id).select('*').single()
    setSeasonThemeSaving(false)
    if (updateError || !data) { setError(`Não foi possível salvar o tema: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry))
    setNotice(`Tema “${seasonThemes[themeKey].label}” aplicado à temporada.`)
    void recordCampaignActivity({ activityType: 'season_theme_changed', title: 'Tema da temporada alterado', description: `${season.name} · ${seasonThemes[themeKey].label}`, entityType: 'season', entityId: season.id })
  }

  async function saveSeasonVisualStyle(styleKey: VisualStyleKey) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || seasonVisualStyleSaving || activeVisualStyleKey === styleKey) return
    setSeasonVisualStyleSaving(true)
    const { data, error: updateError } = await supabase.from('campaign_seasons')
      .update({ visual_style_key: styleKey })
      .eq('id', season.id)
      .select('*')
      .single()
    setSeasonVisualStyleSaving(false)
    if (updateError || !data) {
      const missingColumn = updateError?.code === '42703' || /visual_style_key/i.test(updateError?.message ?? '')
      setError(missingColumn
        ? 'Para ativar os estilos, execute o arquivo SQL de estilos visuais no Supabase e tente novamente.'
        : `Não foi possível salvar o estilo: ${updateError?.message ?? 'resposta vazia'}`)
      return
    }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry))
    setNotice(`Estilo “${visualStyles[styleKey].label}” aplicado à temporada junto do tema “${activeTheme.label}”.`)
    void recordCampaignActivity({
      activityType: 'season_visual_style_changed', title: 'Estilo visual da temporada alterado',
      description: `${season.name} · ${visualStyles[styleKey].label}`,
      entityType: 'season', entityId: season.id,
    })
  }

  async function saveSeasonDetails() {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || !seasonNameDraft.trim()) return
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ name: seasonNameDraft.trim(), description: seasonDescriptionDraft.trim() || null }).eq('id', season.id).select('*').single()
    if (updateError || !data) { setError(`Não foi possível atualizar a temporada: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry)); setNotice('Dados da temporada atualizados.'); void recordCampaignActivity({ activityType: 'season_updated', title: 'Temporada atualizada', description: seasonNameDraft.trim(), entityType: 'season', entityId: season.id })
  }

  async function changeSeasonStatus(status: Season['status']) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster) return
    if (status === 'active' && seasons.some(entry => entry.status === 'active' && entry.id !== season.id)) { setError('Já existe uma temporada ativa. Conclua ou arquive a atual antes de ativar outra.'); return }
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ status }).eq('id', season.id).select('*').single()
    if (updateError || !data) { setError(`Não foi possível mudar o status: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry)); setNotice(`Status da temporada: ${status}.`); void recordCampaignActivity({ activityType: 'season_status_changed', title: 'Status da temporada alterado', description: `${season.name} · ${status}`, entityType: 'season', entityId: season.id })
  }

async function moveSeason(seasonId: string, direction: -1 | 1) {
  if (!isMaster || seasonOrderSaving) return

  const orderedSeasons = [...seasons].sort(
    (a, b) => a.season_number - b.season_number
  )

  const currentIndex = orderedSeasons.findIndex(
    season => season.id === seasonId
  )

  const targetIndex = currentIndex + direction

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= orderedSeasons.length
  ) return

  const currentSeason = orderedSeasons[currentIndex]
  const targetSeason = orderedSeasons[targetIndex]
  const temporaryNumber =
    Math.max(0, ...orderedSeasons.map(season => season.season_number)) + 1

  setSeasonOrderSaving(true)
  setError('')
  setNotice('')

  const firstUpdate = await supabase
    .from('campaign_seasons')
    .update({ season_number: temporaryNumber })
    .eq('id', currentSeason.id)

  if (firstUpdate.error) {
    setError(`Não foi possível alterar a ordem: ${firstUpdate.error.message}`)
    setSeasonOrderSaving(false)
    return
  }

  const secondUpdate = await supabase
    .from('campaign_seasons')
    .update({ season_number: currentSeason.season_number })
    .eq('id', targetSeason.id)

  if (secondUpdate.error) {
    await supabase
      .from('campaign_seasons')
      .update({ season_number: currentSeason.season_number })
      .eq('id', currentSeason.id)

    setError(`Não foi possível alterar a ordem: ${secondUpdate.error.message}`)
    setSeasonOrderSaving(false)
    return
  }

  const thirdUpdate = await supabase
    .from('campaign_seasons')
    .update({ season_number: targetSeason.season_number })
    .eq('id', currentSeason.id)

  if (thirdUpdate.error) {
    await supabase
      .from('campaign_seasons')
      .update({ season_number: targetSeason.season_number })
      .eq('id', targetSeason.id)

    await supabase
      .from('campaign_seasons')
      .update({ season_number: currentSeason.season_number })
      .eq('id', currentSeason.id)

    setError(`Não foi possível concluir a alteração: ${thirdUpdate.error.message}`)
    setSeasonOrderSaving(false)
    return
  }

  setSeasons(current =>
    current
      .map(season => {
        if (season.id === currentSeason.id) {
          return { ...season, season_number: targetSeason.season_number }
        }

        if (season.id === targetSeason.id) {
          return { ...season, season_number: currentSeason.season_number }
        }

        return season
      })
      .sort((a, b) => a.season_number - b.season_number)
  )

  setNotice('Ordem das temporadas atualizada!')
  setSeasonOrderSaving(false)
}

async function deleteSeason(seasonId: string) {
  if (!isMaster || loading) return

  const season = seasons.find(entry => entry.id === seasonId)
  if (!season) return

  const confirmed = window.confirm(
    `Tem certeza que deseja excluir a temporada "${season.name}"?\n\n` +
    'ATENÇÃO: todas as fichas dos personagens e todos os snapshots históricos desta temporada serão apagados permanentemente.\n\n' +
    'Essa ação não poderá ser desfeita.'
  )

  if (!confirmed) return

  setLoading(true)
  setError('')
  setNotice('')

  const { error: deleteError } = await supabase.rpc(
    'delete_campaign_season',
    { p_season_id: season.id }
  )

  if (deleteError) {
    setError(`Não foi possível excluir a temporada: ${deleteError.message}`)
    setLoading(false)
    return
  }

  const remainingSeasons = seasons.filter(entry => entry.id !== season.id)

  setSeasons(remainingSeasons)

  if (selectedSeasonId === season.id) {
    setSelectedSeasonId(
      remainingSeasons.find(entry => entry.status === 'active')?.id ??
      remainingSeasons[0]?.id ??
      ''
    )
  }

  if (remainingSeasons.length === 0) {
    setShowSeasonEditor(false)
  }

  setNotice(`Temporada "${season.name}" excluída com sucesso.`)

  void recordCampaignActivity({
    activityType: 'season_deleted',
    title: 'Temporada excluída',
    description: season.name,
    entityType: 'season',
    entityId: season.id
  })

  setLoading(false)
}

  async function toggleSeasonParticipation(participates: boolean) {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet || sheetSaving) return
    let parsed: Record<string, unknown>
    try {
      const value: unknown = JSON.parse(sheetDraft || '{}')
      parsed = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch {
      setError('Não foi possível atualizar a participação porque os dados da ficha estão inválidos. Salve ou corrija a edição primeiro.')
      return
    }
    const persistedCombat =
  sheet?.sheet_data?.combat &&
  typeof sheet.sheet_data.combat === 'object' &&
  !Array.isArray(sheet.sheet_data.combat)
    ? sheet.sheet_data.combat as Record<string, unknown>
    : {}

const draftCombat =
  parsed.combat &&
  typeof parsed.combat === 'object' &&
  !Array.isArray(parsed.combat)
    ? parsed.combat as Record<string, unknown>
    : {}

parsed = {
  ...parsed,
  seasonParticipation: participates,
  ...(participates ? {} : { partyParticipation: false }),
  combat: {
    ...draftCombat,
    ...(persistedCombat.initiative !== undefined
      ? { initiative: persistedCombat.initiative }
      : {}),
  },
}
    setSheetSaving(true)
    setError('')
    if (sheet) {
      const { data, error: updateError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id).select('id,character_id,season_id,sheet_data').single()
      if (updateError || !data) {
        setError(`Não foi possível salvar a participação: ${updateError?.message ?? 'resposta vazia'}`)
        setSheetSaving(false)
        return
      }
      setSheet(data as CharacterSheet)
    } else {
      const { data, error: insertError } = await supabase.from('character_sheets').insert({ character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (insertError || !data) {
        setError(`Não foi possível salvar a participação: ${insertError?.message ?? 'resposta vazia'}`)
        setSheetSaving(false)
        return
      }
      setSheet(data as CharacterSheet)
    }
    setSheetDraft(JSON.stringify(parsed, null, 2))
    setMasterShieldSheets(current => ({ ...current, [selectedCharacterId]: parsed as Record<string, any> }))
    setNotice(participates ? 'Personagem incluído nesta temporada.' : 'Personagem removido desta temporada. A ficha e o histórico foram preservados.')
    setSheetSaving(false)
  }

  async function saveCharacterInitiative(total: number) {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet) {
      setError('Não foi possível registrar a iniciativa: ficha sem permissão de edição.')
      return
    }

    setSheetSaving(true)
    setError('')
    setNotice('')

    try {
      // Busca a versão mais recente para preservar os dados da ficha.
      const { data: latest, error: loadError } = await supabase
        .from('character_sheets')
        .select('id,character_id,season_id,sheet_data')
        .eq('character_id', selectedCharacterId)
        .eq('season_id', selectedSeasonId)
        .maybeSingle()

      if (loadError) {
        throw new Error(`Não foi possível consultar a ficha: ${loadError.message}`)
      }

      let baseData: Record<string, any> = {}

      if (latest?.sheet_data && typeof latest.sheet_data === 'object' && !Array.isArray(latest.sheet_data)) {
        baseData = latest.sheet_data as Record<string, any>
      } else {
        const parsed: unknown = JSON.parse(sheetDraft)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('A ficha precisa ser um objeto JSON válido.')
        }
        baseData = parsed as Record<string, any>
      }

      const currentCombat =
        baseData.combat && typeof baseData.combat === 'object' && !Array.isArray(baseData.combat)
          ? baseData.combat
          : {}

      const nextData = {
        ...baseData,
        combat: {
          ...currentCombat,
          initiative: total,
        },
      }

      let savedSheet: CharacterSheet

      if (latest) {
        const { data, error: updateError } = await supabase
          .from('character_sheets')
          .update({ sheet_data: nextData })
          .eq('id', latest.id)
          .select('id,character_id,season_id,sheet_data')
          .single()

        if (updateError || !data) {
          throw new Error(`Não foi possível salvar a iniciativa: ${updateError?.message ?? 'resposta vazia'}`)
        }

        savedSheet = data as CharacterSheet
      } else {
        const { data, error: insertError } = await supabase
          .from('character_sheets')
          .insert({
            character_id: selectedCharacterId,
            season_id: selectedSeasonId,
            sheet_data: nextData,
            created_by: session!.user.id,
          })
          .select('id,character_id,season_id,sheet_data')
          .single()

if (insertError || !data) {
  setError(`Não foi possível criar a ficha: ${insertError?.message ?? 'resposta vazia'}`)
  setSheetSaving(false)
  return
}

        savedSheet = data as CharacterSheet
      }

      setSheet(savedSheet)

      setSheetDraft(previous => {
        try {
          const draft = JSON.parse(previous)
          const draftCombat =
            draft.combat && typeof draft.combat === 'object' && !Array.isArray(draft.combat)
              ? draft.combat
              : {}

          return JSON.stringify({
            ...draft,
            combat: {
              ...draftCombat,
              initiative: total,
            },
          }, null, 2)
        } catch {
          return JSON.stringify(nextData, null, 2)
        }
      })

      setMasterShieldSheets(current => ({
        ...current,
        [selectedCharacterId]: nextData,
      }))

      setNotice(`Iniciativa registrada: ${total}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar a iniciativa.')
    } finally {
      setSheetSaving(false)
    }
  }

async function clearCharacterInitiative(characterId: string, seasonId: string) {
  if (!isMaster || !characterId || !seasonId) {
    setError('Não foi possível limpar a iniciativa.')
    return
  }

  setSheetSaving(true)
  setError('')
  setNotice('')

  try {
    const { data: latest, error: loadError } = await supabase
      .from('character_sheets')
      .select('id, character_id, season_id, sheet_data')
      .eq('character_id', characterId)
      .eq('season_id', seasonId)
      .maybeSingle()

    if (loadError) throw loadError

    if (!latest) {
      setNotice('Não há iniciativa registrada para limpar.')
      return
    }

    const baseData = latest.sheet_data as Record<string, any>
    const currentCombat = { ...(baseData.combat ?? {}) }

    delete currentCombat.initiative

    const nextData = {
      ...baseData,
      combat: currentCombat,
    }

    const { error: updateError } = await supabase
      .from('character_sheets')
      .update({ sheet_data: nextData })
      .eq('id', latest.id)

    if (updateError) throw updateError

    setMasterShieldSheets(current => ({
      ...current,
      [characterId]: nextData,
    }))

    setNotice('Iniciativa removida com sucesso.')
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Erro ao limpar a iniciativa.')
  } finally {
    setSheetSaving(false)
  }
}

async function clearAllCharacterInitiatives(seasonId: string, skipConfirmation = false): Promise<boolean> {
  if (!isMaster || !seasonId) {
    setError('Não foi possível limpar as iniciativas.')
    return false
  }

  const participatingIds = characters
    .filter(character =>
      masterShieldSheets[character.id]?.seasonParticipation === true &&
      masterShieldSheets[character.id]?.partyParticipation === true
    )
    .map(character => character.id)

  if (participatingIds.length === 0) {
    return true
  }

  if (!skipConfirmation && !window.confirm(
    'Tem certeza de que deseja limpar todas as iniciativas desta temporada?'
  )) return false

  setSheetSaving(true)
  setError('')
  setNotice('')

  try {
    const { data: sheets, error: loadError } = await supabase
      .from('character_sheets')
      .select('id, character_id, sheet_data')
      .eq('season_id', seasonId)
      .in('character_id', participatingIds)

    if (loadError) throw loadError

    const updatedSheets: Record<string, Record<string, any>> = {}

    for (const item of sheets ?? []) {
      const baseData = (item.sheet_data ?? {}) as Record<string, any>
      const currentCombat = { ...(baseData.combat ?? {}) }

      if (
        currentCombat.initiative === undefined ||
        currentCombat.initiative === null ||
        currentCombat.initiative === ''
      ) continue

      delete currentCombat.initiative

      const nextData = {
        ...baseData,
        combat: currentCombat,
      }

      const { error: updateError } = await supabase
        .from('character_sheets')
        .update({ sheet_data: nextData })
        .eq('id', item.id)

      if (updateError) throw updateError

      updatedSheets[item.character_id] = nextData
    }

    if (Object.keys(updatedSheets).length === 0) {
      return true
    }

    setMasterShieldSheets(current => ({
      ...current,
      ...updatedSheets,
    }))

    if (!skipConfirmation) setNotice('Todas as iniciativas foram removidas com sucesso.')
    return true
  } catch (e) {
    setError(
      e instanceof Error
        ? e.message
        : 'Erro ao limpar todas as iniciativas.'
    )
    return false
  } finally {
    setSheetSaving(false)
  }
}

  async function saveCharacterSheet(draftOverride?: string, automatic = false) {
    if (
  !selectedCharacterId ||
  !selectedSeasonId ||
  !canEditSelectedSheet ||
  saveInFlightRef.current
) return

const draftToSave = draftOverride ?? sheetDraft
    let parsed: Record<string, unknown>
    try { const value: unknown = JSON.parse(draftToSave); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A ficha precisa ser um objeto JSON.'); parsed = value as Record<string, unknown> }
    catch (e) {
  setError(e instanceof Error ? e.message : 'JSON inválido.')
  if (automatic) setSheetAutoSaveStatus('error')
  return
}
    // O salvamento geral da ficha não deve alterar PV, PS ou PR atuais.
    // Esses três campos são persistidos exclusivamente por saveCharacterConditions().
    if (sheet) {
      const persistedStatus = sheet.sheet_data.status && typeof sheet.sheet_data.status === 'object' && !Array.isArray(sheet.sheet_data.status)
        ? sheet.sheet_data.status as Record<string, unknown>
        : {}
      const persistedCurrent = persistedStatus.current && typeof persistedStatus.current === 'object' && !Array.isArray(persistedStatus.current)
        ? persistedStatus.current as Record<string, unknown>
        : {}
      const draftStatus = parsed.status && typeof parsed.status === 'object' && !Array.isArray(parsed.status)
        ? parsed.status as Record<string, unknown>
        : {}
      const draftCurrent = draftStatus.current && typeof draftStatus.current === 'object' && !Array.isArray(draftStatus.current)
        ? draftStatus.current as Record<string, unknown>
        : {}

const persistedCombat =
  sheet.sheet_data.combat &&
  typeof sheet.sheet_data.combat === 'object' &&
  !Array.isArray(sheet.sheet_data.combat)
    ? sheet.sheet_data.combat as Record<string, unknown>
    : {}

const draftCombat =
  parsed.combat &&
  typeof parsed.combat === 'object' &&
  !Array.isArray(parsed.combat)
    ? parsed.combat as Record<string, unknown>
    : {}

      parsed = {
        ...parsed,
        status: {
          ...draftStatus,
          current: {
            ...draftCurrent,
            ...persistedCurrent,
          },
        },
        combat: {
          ...draftCombat,
          ...(persistedCombat.initiative !== undefined
            ? { initiative: persistedCombat.initiative }
            : {}),
        },
      }
    }

    saveInFlightRef.current = true

if (automatic) {
  setSheetAutoSaveStatus('saving')
}

setSheetSaving(true)
setError('')
    if (sheet) {
      const { data, error: updateError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id).select('id,character_id,season_id,sheet_data').single()
      if (updateError || !data) {
  setError(`Não foi possível salvar a ficha: ${updateError?.message ?? 'resposta vazia'}`)
  setSheetSaving(false)
  saveInFlightRef.current = false

  if (automatic) setSheetAutoSaveStatus('error')

  return
}
      setSheet(data as CharacterSheet)
    } else {
      const { data, error: insertError } = await supabase.from('character_sheets').insert({ character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (insertError || !data) {
  setError(`Não foi possível criar a ficha: ${insertError?.message ?? 'resposta vazia'}`)
  setSheetSaving(false)
  saveInFlightRef.current = false

  if (automatic) setSheetAutoSaveStatus('error')

  return
}
      setSheet(data as CharacterSheet)
    }
    if (selectedSeasonId === masterShieldSeasonId) {
  setMasterShieldSheets(current => ({
    ...current,
    [selectedCharacterId]: parsed,
  }))
}
    let strengthSyncFailed = false
    const sheetStrength = (parsed.attributes as Record<string, unknown> | undefined)?.strength
    if (typeof sheetStrength === 'number' && Number.isInteger(sheetStrength) && sheetStrength >= 0 && sheetStrength <= 100) {
      const { data: updatedCharacter, error: strengthError } = await supabase
        .from('characters')
        .update({ strength: sheetStrength })
        .eq('id', selectedCharacterId)
        .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
        .maybeSingle()
      if (strengthError) {
        strengthSyncFailed = true
        setError(`Ficha salva, mas não foi possível sincronizar a Força com a capacidade de carga: ${strengthError.message}`)
      } else if (updatedCharacter) {
        // A atualização da ficha nunca deve redefinir o emoji escolhido no cartão.
        setCharacters(current => current.map(character =>
          character.id === selectedCharacterId ? { ...character, strength: updatedCharacter.strength } : character
        ))
      }
    }

const savedDraft = JSON.stringify(parsed, null, 2)

lastSavedSheetDraftRef.current = savedDraft

if (sheetDraftRef.current === draftToSave) {
  setSheetDraft(savedDraft)
}

if (automatic) {
  setSheetAutoSaveStatus('saved')
} else if (!strengthSyncFailed) {
  setNotice('Ficha salva.')
}

saveInFlightRef.current = false
setSheetSaving(false)
  }

async function saveCharacterCybernetics(
  characterId: string,
  seasonId: string,
  cybernetics: Record<string, unknown>,
): Promise<void> {
  if (!session?.user?.id) {
    throw new Error('Você precisa estar autenticado.')
  }

  if (saveInFlightRef.current) {
    throw new Error('Aguarde o salvamento da ficha terminar.')
  }

  saveInFlightRef.current = true
  setSheetSaving(true)
  setError('')

  try {
    const { data, error: cyberneticsError } = await supabase.rpc(
      'update_character_cybernetics',
      {
        p_character_id: characterId,
        p_season_id: seasonId,
        p_cybernetics: cybernetics,
      },
    )

    if (cyberneticsError) {
      throw cyberneticsError
    }

    // Evita atualizar a ficha errada caso o usuário tenha trocado
    // de personagem ou temporada enquanto o salvamento acontecia.
    if (
      selectedCharacterId !== characterId ||
      selectedSeasonId !== seasonId
    ) {
      return
    }

    const savedCybernetics = data ?? cybernetics

    setSheet(current => {
      if (
        !current ||
        current.character_id !== characterId ||
        current.season_id !== seasonId
      ) {
        return current
      }

      return {
        ...current,
        sheet_data: {
          ...current.sheet_data,
          cybernetics: savedCybernetics,
        },
      }
    })

    // Atualiza apenas a parte cibernética do rascunho,
    // preservando eventuais alterações feitas em outros campos.
    let currentDraft: Record<string, any> = {}

    try {
      currentDraft = JSON.parse(sheetDraftRef.current || '{}')
    } catch {
      currentDraft = {}
    }

    const nextDraft = JSON.stringify(
      {
        ...currentDraft,
        cybernetics: savedCybernetics,
      },
      null,
      2,
    )

    const persistedSheetData = sheet
      ? {
          ...sheet.sheet_data,
          cybernetics: savedCybernetics,
        }
      : null

    if (persistedSheetData) {
      lastSavedSheetDraftRef.current = JSON.stringify(
        persistedSheetData,
        null,
        2,
      )
    }

    sheetDraftRef.current = nextDraft
    setSheetDraft(nextDraft)
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Não foi possível salvar os implantes.'

    setError(message)
    throw new Error(message)
  } finally {
    saveInFlightRef.current = false
    setSheetSaving(false)
  }
}

  async function saveCharacterConditions(draftOverride?: Record<string, unknown>) {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet) return

    let parsed: Record<string, unknown>
    try {
      const value: unknown = draftOverride ?? JSON.parse(sheetDraft)
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('A ficha precisa ser um objeto JSON.')
      }
      parsed = value as Record<string, unknown>
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido.')
      return
    }

    const status = parsed.status && typeof parsed.status === 'object' && !Array.isArray(parsed.status)
      ? parsed.status as Record<string, unknown>
      : {}
    const current = status.current && typeof status.current === 'object' && !Array.isArray(status.current)
      ? status.current as Record<string, unknown>
      : {}

    const rawValues = [current.pv, current.ps, current.pr]
    const values = rawValues.map(value => value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value))
    if (values.some(value => !Number.isFinite(value))) {
      setError(`PV, PS e ${resourceAbbreviation} precisam ter valores numéricos válidos antes de salvar.`)
      return
    }
    if (values.some(value => value < 0)) {
      setError(`PV, PS e ${resourceAbbreviation} não podem ser negativos.`)
      return
    }

    setSheetSaving(true)
    setError('')
    setNotice('')

    try {
      let targetSheet = sheet

      // Uma ficha nova precisa ser criada uma única vez; depois disso, as
      // alterações de condições passam exclusivamente pela RPC.
      if (!targetSheet) {
        const { data: inserted, error: insertError } = await supabase
          .from('character_sheets')
          .insert({
            character_id: selectedCharacterId,
            season_id: selectedSeasonId,
            sheet_data: parsed,
            created_by: session!.user.id,
          })
          .select('id,character_id,season_id,sheet_data')
          .single()

        if (insertError || !inserted) {
          throw new Error(`Não foi possível criar a ficha: ${insertError?.message ?? 'resposta vazia'}`)
        }
        targetSheet = inserted as CharacterSheet
        setSheet(targetSheet)
      }

      const { data, error: rpcError } = await supabase.rpc('update_character_conditions', {
        p_sheet_id: targetSheet.id,
        p_pv: values[0],
        p_ps: values[1],
        p_pr: values[2],
      })

      if (rpcError || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Não foi possível salvar as condições: ${rpcError?.message ?? 'resposta vazia'}`)
      }

      const savedSheetData = data as Record<string, unknown>
      const savedStatus = savedSheetData.status && typeof savedSheetData.status === 'object'
        ? savedSheetData.status as Record<string, unknown>
        : status

      setSheet({ ...targetSheet, sheet_data: savedSheetData })
      // Mantém eventuais alterações locais de outros campos no rascunho,
      // mas substitui status.current pelos valores efetivamente gravados.
      setSheetDraft(JSON.stringify({
        ...parsed,
        status: {
          ...status,
          ...savedStatus,
          current: {
            ...current,
            ...(savedStatus.current && typeof savedStatus.current === 'object'
              ? savedStatus.current as Record<string, unknown>
              : {}),
          },
        },
      }, null, 2))
      setNotice(`PV, PS e ${resourceAbbreviation} atualizados com sucesso!`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar as condições.')
    } finally {
      setSheetSaving(false)
    }
  }

  async function createSheetMilestone() {
    if (!sheet || !selectedCharacterId || !selectedSeasonId || !isMaster) return
    let parsed: Record<string, unknown>
    try { const value: unknown = JSON.parse(sheetDraft); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A ficha precisa ser um objeto JSON.'); parsed = value as Record<string, unknown> }
    catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); return }
    const { error: saveError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id)
    if (saveError) { setError(`Não foi possível salvar antes do marco: ${saveError.message}`); return }
    const milestoneName = window.prompt('Nome deste marco (ex.: Após a missão):')
    if (!milestoneName?.trim()) return
    const { error: milestoneError } = await supabase.from('character_sheet_versions').insert({ character_sheet_id: sheet.id, character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, milestone_type: 'manual', milestone_name: milestoneName.trim(), created_by: session!.user.id })
    if (milestoneError) { setError(`Ficha salva, mas não foi possível registrar o marco: ${milestoneError.message}`); return }
    setSheet({ ...sheet, sheet_data: parsed }); setNotice('Marco do histórico registrado.')
  }

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCampaignId || !characterName.trim()) return

    const usesSystemRanks = systemFeatures.usesRanks
    const level = usesSystemRanks ? 1 : Number(characterLevel)
    if (usesSystemRanks) {
  if (!primaryArchetype || !secondaryArchetype) {
    setError('Selecione os dois arquétipos.')
    return
  }

  const forbidden =
    (primaryArchetype === 'Linha de Frente' && secondaryArchetype === 'Suporte') ||
    (primaryArchetype === 'Suporte' && secondaryArchetype === 'Linha de Frente') ||
    (primaryArchetype === 'Defensor' && secondaryArchetype === 'Flanco') ||
    (primaryArchetype === 'Flanco' && secondaryArchetype === 'Defensor')

  if (forbidden) {
    setError('Essa combinação de arquétipos não é permitida.')
    return
  }
}

    if (!usesSystemRanks && (!Number.isInteger(level) || level < 1 || level > 999)) {
      setError('O nível deve ser um número inteiro entre 1 e 999.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase.rpc(
      'create_character',
      {
        p_campaign_id: selectedCampaignId,
        p_name: characterName.trim(),
        p_archetype: usesSystemRanks
  ? primaryArchetype
  : archetype.trim() || null,
        p_level: level,
      },
    )

    if (createError) {
      setError(`Não foi possível criar o personagem: ${createError.message}`)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Não foi possível confirmar a criação do personagem.')
      setLoading(false)
      return
    }

    let createdCharacter = data as Character
    const { data: emojiUpdated, error: emojiError } = await supabase.from('characters').update({ emoji: characterEmoji }).eq('id', createdCharacter.id).select('id,campaign_id,user_id,name,emoji,archetype,level,strength,visibility,current_player_id,created_at').single()
    if (emojiError) { setError(`Personagem criado, mas não foi possível salvar o emoji: ${emojiError.message}. Execute a migração SQL fornecida.`); setLoading(false); return }
    createdCharacter = emojiUpdated as Character
if (usesSystemRanks && selectedSeasonId) {
  const initialSheetData: Record<string, any> = {
    identity: {
      primaryArchetype,
      secondaryArchetype,
    },
    attributes: {
      strength: 0,
      agility: 0,
      defense: 0,
      breathing: 0,
      intellect: 0,
    },
    family: {
      tier: characterFamilyTier,
    },
    progression: {
      system: selectedCampaign?.system_name ?? '',
      rankId: characterRank,
      rankName: getSystemRankName(characterRank),
    },
  }

  const { data: newSheet, error: sheetError } = await supabase
    .from('character_sheets')
    .insert({
      character_id: createdCharacter.id,
      season_id: selectedSeasonId,
      sheet_data: initialSheetData,
      created_by: session!.user.id,
    })
    .select('id,character_id,season_id,sheet_data')
    .single()

  if (sheetError) {
    setError(`Personagem criado, mas houve um erro ao inicializar sua ficha: ${sheetError.message}`)
  } else {
    setSheet(newSheet as CharacterSheet)
    setSheetDraft(JSON.stringify(initialSheetData, null, 2))

    const { error: versionError } = await supabase
      .from('character_sheet_versions')
      .insert({
        character_sheet_id: newSheet.id,
        character_id: createdCharacter.id,
        season_id: selectedSeasonId,
        sheet_data: initialSheetData,
        milestone_type: 'season_start',
        milestone_name: `Início da temporada ${
          seasons.find(season => season.id === selectedSeasonId)?.name ?? ''
        }`,
        notes: 'Snapshot automático no início da temporada.',
        created_by: session!.user.id,
      })

    if (versionError) {
      setError(
        `Personagem criado e ficha inicializada, mas o snapshot inicial falhou: ${versionError.message}`,
      )
      setLoading(false)
      return
    }
  }
}
    setCharacters((current) =>
      current.some((character) => character.id === createdCharacter.id)
        ? current.map((character) =>
            character.id === createdCharacter.id ? createdCharacter : character,
          )
        : [...current, createdCharacter],
    )
    setSelectedCharacterId(createdCharacter.id)
setCharacterName('')
setCharacterEmoji('⚔️')
setArchetype('')
setPrimaryArchetype('')
setSecondaryArchetype('')
setCharacterLevel('1')
setCharacterRank('civil')
setCharacterFamilyTier('5')
setShowCharacterForm(false)
setNotice('Personagem criado e salvo!')
void recordCampaignActivity({ activityType: 'character_created', title: 'Personagem criado', description: `${createdCharacter.emoji ? `${createdCharacter.emoji} ` : ''}${createdCharacter.name}`, entityType: 'character', entityId: createdCharacter.id })
setLoading(false)
  }

function openCharacterEmojiPicker(character: Character) {
  setError('')
  setEmojiPickerCharacter(character)
}

async function changeCharacterEmoji(character: Character, emoji: string) {
  if (!availableEmojis.includes(emoji)) {
    setError('Selecione um emoji disponível na lista.')
    return
  }

  const { data, error: updateError } = await supabase
    .from('characters')
    .update({ emoji })
    .eq('id', character.id)
    .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
    .single()

  if (updateError || !data) {
    setError(`Não foi possível atualizar o emoji: ${updateError?.message ?? 'personagem não encontrado'}`)
    return
  }

  setCharacters(current => current.map(entry => entry.id === character.id ? data as Character : entry))
  setEmojiPickerCharacter(null)
  setError('')
  setNotice(`Emoji de ${character.name} atualizado.`)
}


async function deleteCharacter(character: Character) {
  console.log('[DELETE CHARACTER]', {
    character: character.name,
    isMaster,
    deletingCharacterId,
  })

  if (!isMaster || deletingCharacterId) {
    console.log('[DELETE BLOCKED]')
    return
  }

  const confirmed = window.confirm(
    `ATENÇÃO: deseja excluir definitivamente "${character.name}"?\n\n` +
    'Todas as fichas, versões históricas, itens e permissões deste personagem serão apagados.\n\n' +
    'Esta ação não pode ser desfeita.'
  )

  if (!confirmed) return

  console.log('[DELETE CONFIRMED] Starting RPC for:', character.id)

  setDeletingCharacterId(character.id)
  setError('')
  setNotice('')

  try {
    const { error: deleteError } = await supabase.rpc(
      'delete_character',
      { p_character_id: character.id }
    )

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    const { data: remaining, error: checkError } = await supabase
      .from('characters')
      .select('id')
      .eq('id', character.id)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Não foi possível confirmar a exclusão: ${checkError.message}`)
    }

    if (remaining) {
      throw new Error(
        'A função SQL foi executada, mas o personagem ainda existe no banco. Verifique a função delete_character no Supabase.'
      )
    }

    const remainingCharacters = characters.filter(
      entry => entry.id !== character.id
    )

    setCharacters(remainingCharacters)

    if (selectedCharacterId === character.id) {
      setSelectedCharacterId(remainingCharacters[0]?.id ?? '')
      setItems([])
      setSheet(null)
      setSheetDraft('{}')
      setCharacterGrants([])
      setSheetCharacterView(false)
    }

    setNotice(`Personagem "${character.name}" excluído permanentemente.`)
  } catch (deleteError) {
    const message = deleteError instanceof Error
      ? deleteError.message
      : String(deleteError)

    setError(`Não foi possível excluir o personagem: ${message}`)
  } finally {
    setDeletingCharacterId(null)
  }
}


  async function changeCharacterPlayer(userId: string) {
    if (!selectedCharacter || !isMaster || !selectedCampaignId) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')
    const { data, error: updateError } = await supabase
      .from('characters')
      .update({ current_player_id: userId || null })
      .eq('id', selectedCharacter.id)
      .eq('campaign_id', selectedCampaignId)
      .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
      .maybeSingle()
    setVisibilitySaving(false)
    if (updateError || !data) {
      setError(`Não foi possível definir o jogador atual: ${updateError?.message ?? 'permissão negada'}`)
      return
    }
    setCharacters(current => current.map(character => character.id === selectedCharacter.id ? data as Character : character))
    setNotice('Jogador atual do personagem atualizado.')
  }

  async function changeCharacterVisibility(visibility: Character['visibility']) {
    if (!selectedCharacter || !isMaster) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')

    const { data, error: visibilityError } = await supabase
      .from('characters')
      .update({ visibility })
      .eq('id', selectedCharacter.id)
      .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
      .maybeSingle()

    setVisibilitySaving(false)
    if (visibilityError || !data) {
      setError(`Não foi possível alterar a visibilidade: ${visibilityError?.message ?? 'permissão negada'}`)
      return
    }

    setCharacters((current) => current.map((character) =>
      character.id === selectedCharacter.id ? { ...character, visibility: data.visibility as Character['visibility'] } : character
    ))
    setNotice('Visibilidade do personagem atualizada.')
  }

  async function toggleCharacterGrant(userId: string, shouldGrant: boolean) {
    if (!selectedCharacter || !isMaster || userId === selectedCharacter.user_id) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')

    if (shouldGrant) {
      const { error: grantError } = await supabase
        .from('character_visibility')
        .insert({
          character_id: selectedCharacter.id,
          user_id: userId,
          granted_by: session!.user.id,
        })
      if (grantError && !grantError.message.toLowerCase().includes('duplicate')) {
        setError(`Não foi possível autorizar o jogador: ${grantError.message}`)
        setVisibilitySaving(false)
        return
      }
      setCharacterGrants((current) =>
        current.some((grant) => grant.user_id === userId) ? current : [...current, { user_id: userId }]
      )
    } else {
      const { error: revokeError } = await supabase
        .from('character_visibility')
        .delete()
        .eq('character_id', selectedCharacter.id)
        .eq('user_id', userId)
      if (revokeError) {
        setError(`Não foi possível remover a autorização: ${revokeError.message}`)
        setVisibilitySaving(false)
        return
      }
      setCharacterGrants((current) => current.filter((grant) => grant.user_id !== userId))
    }

    setVisibilitySaving(false)
    setNotice('Permissões do personagem atualizadas.')
  }

  async function useScarcityItem(item: Item) {
    const metadata = item.metadata ?? {}
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [item.category]
    if (!categories.includes('Consumíveis') || metadata.scarcityExhausted === true || usingScarcityItemId) return

    const currentLevel = Math.min(4, Math.max(1, Number(metadata.scarcityLevel) || 1))
    const diceByLevel: Record<number, number> = { 1: 12, 2: 8, 3: 6, 4: 4 }
    const chargeByLevel: Record<number, number> = { 1: 7, 2: 5, 3: 3, 4: 1 }
    const die = diceByLevel[currentLevel]
    const roll = Math.floor(Math.random() * die) + 1
    const exhausted = roll === 1 && currentLevel === 4
    const nextLevel = roll === 1 && currentLevel < 4 ? currentLevel + 1 : currentLevel
    const nextMetadata = {
      ...metadata,
      scarcityLevel: nextLevel,
      scarcityDie: `d${diceByLevel[nextLevel]}`,
      scarcityCharge: exhausted ? 0 : chargeByLevel[nextLevel],
      scarcityLastRoll: roll,
      scarcityLastDie: `d${die}`,
      scarcityUses: (Number(metadata.scarcityUses) || 0) + 1,
      scarcityExhausted: exhausted,
    }

    setUsingScarcityItemId(item.id)
    const { data, error: updateError } = await supabase
      .from('inventory_items')
.update({
  metadata: nextMetadata,
  weight: nextMetadata.scarcityCharge,
  ...(exhausted ? { unit_price: 0 } : {}),
})
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id')
      .maybeSingle()
    setUsingScarcityItemId(null)

    if (updateError || !data) {
      setError(`Não foi possível registrar o uso: ${updateError?.message || 'sem retorno do banco'}`)
      return
    }

    const updatedItem = data as Item
    setItems(current => current.map(entry => entry.id === updatedItem.id ? updatedItem : entry))
    setSelectedItemDetails(updatedItem)
    setNotice(exhausted
      ? `${item.name}: saiu 1 no d4. O item está esgotado!`
      : roll === 1
        ? `${item.name}: saiu 1 no d${die}. Escassez avançou para o nível ${nextLevel} (${nextMetadata.scarcityDie}).`
        : `${item.name}: ${roll} no d${die}. O nível de escassez permanece em ${currentLevel}.`)
  }

  function getAutomaticItemWeight(
    categories: string[],
    equipmentType: 'none' | 'armor' | 'protection' | 'cybernetic',
    armorClass: 'leve' | 'media' | 'pesada',
    weaponClass: string,
  ): number | null {
    if (categories.includes('Armas')) {
      const weaponWeights: Record<string, number> = { improvised: 0.5, advanced: 1, special: 1, black_red: 1.5, mutable: 2 }
      return weaponWeights[weaponClass] ?? 0.5
    }
    if (!categories.includes('Equipamento')) return null
    if (equipmentType === 'armor') return armorClass === 'pesada' ? 6 : armorClass === 'media' ? 4 : 2
    if (equipmentType === 'protection') return 0
    return null
  }

  function resetItemForm() {
    setEditingItem(null)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('Diversos')
    setNewItemCategories(['Diversos'])
    setNewWeaponClass('improvised')
    setNewItemQuantity('1')
    setNewItemWeight('0')
    setNewItemUnitPrice('0')
    setNewItemCurrencyId(selectedCampaign?.currency_config?.currencies?.[0]?.id ?? '')
    setNewItemEmoji('📦')
    setNewEquipmentType('none')
    setNewCyberneticCategory('Outro')
    setNewCyberneticLocation('')
    setNewCyberneticLoad('0')
    setNewCyberneticEffects('')
    setNewArmorClass('leve')
    setNewArmorCoverage('cortante_perfurante')
    setNewProtectionTier('basica')
    setNewProtectionMode('resistencia')
    setNewScarcityLevel('1')
    setNewScarcityExhausted(false)
    setNewItemRarity('comum')
  }

  function startEditingItem(item: Item) {
    setSelectedCharacterId(item.character_id)
    setEditingItem(item)
    setNewItemUnitPrice(String(item.unit_price ?? 0))
    setNewItemCurrencyId(item.currency_id ?? '')
    setNewItemName(item.name)
    setNewItemDescription(item.description ?? '')
    setNewItemCategory(item.category)
    setNewItemRarity(typeof item.metadata?.rarity === 'string' ? item.metadata.rarity : 'comum')
    setNewScarcityLevel(['1', '2', '3', '4'].includes(String(item.metadata?.scarcityLevel ?? '1')) ? String(item.metadata?.scarcityLevel ?? '1') as '1' | '2' | '3' | '4' : '1')
    setNewScarcityExhausted(item.metadata?.scarcityExhausted === true)
    setNewItemCategories(Array.isArray(item.metadata?.categories) ? item.metadata.categories.filter((value): value is string => typeof value === 'string') : [item.category])
    setNewWeaponClass(typeof item.metadata?.weaponClass === 'string' ? item.metadata.weaponClass : 'improvised')
    setNewEquipmentType(
  item.metadata?.equipmentType === 'armor' ||
  item.metadata?.equipmentType === 'protection' ||
  (isCyberFlowerSystem && item.metadata?.equipmentType === 'cybernetic')
    ? item.metadata.equipmentType
    : 'none'
)

const cyberneticData = isCyberFlowerSystem
  ? item.metadata?.cyberneticData as Record<string, unknown> | undefined
  : undefined

setNewCyberneticCategory(
  typeof cyberneticData?.category === 'string' ? cyberneticData.category : 'Outro'
)
setNewCyberneticLocation(
  typeof cyberneticData?.location === 'string' ? cyberneticData.location : ''
)
setNewCyberneticLoad(
  String(cyberneticData?.biologicalLoad ?? item.metadata?.biologicalLoad ?? 0)
)
setNewCyberneticEffects(
  typeof cyberneticData?.effects === 'string' ? cyberneticData.effects : ''
)
    setNewArmorClass(item.metadata?.armorClass === 'media' || item.metadata?.armorClass === 'pesada' ? item.metadata.armorClass : 'leve')
    setNewArmorCoverage(item.metadata?.armorCoverage === 'especial_bruto' || item.metadata?.armorCoverage === 'todos' ? item.metadata.armorCoverage : 'cortante_perfurante')
    setNewProtectionTier(item.metadata?.protectionTier === 'moderada' || item.metadata?.protectionTier === 'avancada' ? item.metadata.protectionTier : 'basica')
    setNewProtectionMode(item.metadata?.protectionMode === 'sanidade' ? 'sanidade' : 'resistencia')
    setNewItemQuantity(String(item.quantity))
    setNewItemWeight(String(item.weight))
    setNewItemEmoji(
      typeof item.metadata?.icon === 'string'
        ? item.metadata.icon
        : '📦',
    )
    setShowItemForm(true)
    setError('')
    setNotice('')
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if ((!selectedCharacterId && !editingItem) || !newItemName.trim()) return

    const quantity = Number(newItemQuantity)
const chargeByLevel: Record<number, number> = { 1: 7, 2: 5, 3: 3, 4: 1 }

const weight = newItemCategories.includes('Consumíveis')
  ? (newScarcityExhausted ? 0 : chargeByLevel[Number(newScarcityLevel)] ?? 1)
  : Number(newItemWeight.replace(',', '.'))

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError('A quantidade deve ser um número inteiro entre 1 e 999.')
      return
    }

    if (!Number.isFinite(weight) || weight < 0 || weight > 100000) {
      setError('Informe um peso válido igual ou maior que zero.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const itemEquipmentTypeForSave = newItemCategories.includes('Equipamento') ? newEquipmentType : 'none'

    const itemData = {
      name: newItemName.trim(),
      description: newItemDescription.trim() || null,
      category: newItemCategories[0] ?? newItemCategory,
      quantity,
      weight,
      unit_price: newItemCategories.includes('Consumíveis') && newScarcityExhausted ? 0 : (Number(newItemUnitPrice.replace(',', '.')) || 0),
      currency_id: newItemCurrencyId || null,
      metadata: {
  ...(editingItem?.metadata ?? {}),
  icon: newItemEmoji,
  rarity: newItemRarity,
  categories: newItemCategories.length ? newItemCategories : [newItemCategory],
  equipmentType: isCyberFlowerSystem ? itemEquipmentTypeForSave : (
  itemEquipmentTypeForSave === 'cybernetic' ? 'none' : itemEquipmentTypeForSave
),
  cybernetic: isCyberFlowerSystem && itemEquipmentTypeForSave === 'cybernetic',
cyberneticEquipped: isCyberFlowerSystem && itemEquipmentTypeForSave === 'cybernetic'
  ? editingItem?.metadata?.cyberneticEquipped === true
  : false,
biologicalLoad: isCyberFlowerSystem && itemEquipmentTypeForSave === 'cybernetic'
  ? Math.max(0, Number(newCyberneticLoad) || 0)
  : null,
cyberneticData: isCyberFlowerSystem && itemEquipmentTypeForSave === 'cybernetic'
  ? {
      name: newItemName.trim(),
      category: newCyberneticCategory,
      description: newItemDescription.trim(),
      location: newCyberneticLocation.trim(),
      biologicalLoad: Math.max(0, Number(newCyberneticLoad) || 0),
      cost: String(Number(newItemUnitPrice.replace(',', '.')) || 0),
      effects: newCyberneticEffects.trim(),
      status: editingItem?.metadata?.cyberneticEquipped === true
        ? 'installed'
        : 'stored',
    }
  : null,
  armorClass: itemEquipmentTypeForSave === 'armor' ? newArmorClass : null,
  armorCoverage: itemEquipmentTypeForSave === 'armor' ? (newArmorClass === 'pesada' ? 'todos' : newArmorCoverage) : null,
  protectionTier: itemEquipmentTypeForSave === 'protection' ? newProtectionTier : null,
  protectionMode: itemEquipmentTypeForSave === 'protection' ? newProtectionMode : null,
  scarcityLevel: newItemCategories.includes('Consumíveis') ? Number(newScarcityLevel) : null,
  scarcityDie: newItemCategories.includes('Consumíveis') ? ({ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' } as Record<string, string>)[newScarcityLevel] : null,
  scarcityCharge: newItemCategories.includes('Consumíveis') ? (newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel]) : null,
  scarcityExhausted: newItemCategories.includes('Consumíveis') ? newScarcityExhausted : false,
  weaponClass: newItemCategories.includes('Armas') ? newWeaponClass : null,
  weaponDamage: newItemCategories.includes('Armas') ? ({ improvised: '1d4', advanced: '1d6', special: '1d8', black_red: '1d10', mutable: '1d12' } as Record<string,string>)[newWeaponClass] || '1d4' : null,
  weaponWeight: newItemCategories.includes('Armas') ? weight : null,
},
    }

    let savedItem: Item | null = null

    if (editingItem) {
      const { data, error: updateError } = await supabase
        .from('inventory_items')
        .update(itemData)
        .eq('id', editingItem.id)
        .eq('character_id', editingItem.character_id)
        .select(
          'id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id',
        )
        .maybeSingle()

      if (updateError) {
        setError(`Não foi possível atualizar o item: ${updateError.message}`)
        setLoading(false)
        return
      }

      if (!data) {
        setError(
          'O item não foi atualizado. Verifique as permissões no Supabase.',
        )
        setLoading(false)
        return
      }

      savedItem = data as Item
    } else {
      const { data, error: insertError } = await supabase
        .from('inventory_items')
        .insert({
          character_id: selectedCharacterId,
          ...itemData,
        })
        .select(
          'id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id',
        )
        .single()

      if (insertError) {
        setError(`Não foi possível salvar o item: ${insertError.message}`)
        setLoading(false)
        return
      }

      savedItem = data as Item
    }

    if (!savedItem) {
      setError('Não foi possível confirmar o salvamento do item.')
      setLoading(false)
      return
    }

    if (editingItem) {
      setItems((current) =>
        current.map((item) =>
          item.id === savedItem!.id ? savedItem! : item,
        ),
      )
      setNotice(`"${savedItem.name}" foi atualizado!`)
    } else {
      setItems((current) => [...current, savedItem!])
      setNotice('Item salvo no inventário!')
    }

    resetItemForm()
    setShowItemForm(false)
    setActiveCategory('Todos')
    setSearch('')
    setLoading(false)
  }

  async function changeItemEmoji(item: Item, emoji: string) {
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({
        metadata: {
          ...(item.metadata ?? {}),
          icon: emoji,
        },
      })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select(
        'id, character_id, name, description, category, quantity, weight, metadata',
      )
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível alterar o emoji: ${updateError.message}`)
      return
    }

    if (!data) {
      setError(
        'O emoji não foi alterado. Verifique as permissões de acesso no Supabase.',
      )
      return
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? (data as Item) : entry,
      ),
    )

    setEmojiPickerItem(null)
    setNotice(`Emoji de "${item.name}" atualizado!`)
  }

  async function changeItemQuantity(item: Item, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return
    if (updatingQuantityItemId === item.id) return

    setUpdatingQuantityItemId(item.id)
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .maybeSingle()

    setUpdatingQuantityItemId(null)

    if (updateError) {
      setError(`Não foi possível alterar a quantidade: ${updateError.message}`)
      return
    }
    if (!data) {
      setError('A quantidade não foi alterada. Verifique as permissões no Supabase.')
      return
    }

    setItems((current) => current.map((entry) => entry.id === item.id ? (data as Item) : entry))
    setNotice(`Quantidade de "${item.name}" atualizada para ${data.quantity}.`)
  }

  async function toggleFavorite(item: Item) {
    const isFavorite = item.metadata?.favorite === true
    const metadata = { ...(item.metadata ?? {}), favorite: !isFavorite }
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({ metadata })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível atualizar o favorito: ${updateError.message}`)
      return
    }
    if (!data) {
      setError('O favorito não foi atualizado. Verifique as permissões no Supabase.')
      return
    }

    setItems((current) => current.map((entry) => entry.id === item.id ? (data as Item) : entry))
    setNotice(!isFavorite ? `"${item.name}" adicionado aos favoritos.` : `"${item.name}" removido dos favoritos.`)
  }

async function sendItemToCharacter() {
    if (!transferItem || !transferTargetId || transferSaving) return
    const target = characters.find(character => character.id === transferTargetId && character.campaign_id === selectedCampaignId)
    if (!target || target.id === transferItem.character_id) {
      setError('Selecione outro personagem da mesma campanha.')
      return
    }
    const amount = Math.floor(Number(transferQuantity))
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > transferItem.quantity) {
      setError('A quantidade deve estar entre 1 e a quantidade disponível.')
      return
    }
    setTransferSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: transferError } = await supabase.rpc('haxbag_transfer_inventory_item', {
        p_item_id: transferItem.id,
        p_target_character_id: target.id,
        p_quantity: amount,
      })
      if (transferError) throw transferError
      setItems(current => current.flatMap(entry => {
        if (entry.id !== transferItem.id) return [entry]
        if (amount >= entry.quantity) return []
        return [{ ...entry, quantity: entry.quantity - amount }]
      }))
      setTransferItem(null)
      setTransferTargetId('')
      setNotice(`${amount} × ${transferItem.name} enviado para ${target.name}.`)
    } catch (err) {
      setError(`Não foi possível enviar o item: ${err instanceof Error ? err.message : String(err)}. Verifique se o SQL de transferência foi instalado.`)
    } finally {
      setTransferSaving(false)
    }
  }

  async function duplicateItem(item: Item) {
  const isInstalledCybernetic =
    item.metadata?.cybernetic === true &&
    (
      item.metadata?.cyberneticEquipped === true ||
      (item.metadata?.cyberneticData as Record<string, unknown> | undefined)?.status === 'installed'
    )

  if (isInstalledCybernetic) {
    setError('Não é possível duplicar um implante cibernético instalado. Desequipe-o primeiro.')
    return
  }

  setError('')
  setNotice('')

    const { data, error: insertError } = await supabase
      .from('inventory_items')
      .insert({
        character_id: item.character_id,
        name: `${item.name} (cópia)`,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        weight: item.weight,
        unit_price: item.unit_price ?? 0,
        currency_id: item.currency_id ?? null,
        metadata: {
  ...(item.metadata ?? {}),
  favorite: false,
  equipmentType: isCyberFlowerSystem && item.metadata?.equipmentType === 'cybernetic'
    ? 'cybernetic'
    : item.metadata?.equipmentType === 'cybernetic'
      ? 'none'
      : item.metadata?.equipmentType,
  cybernetic: isCyberFlowerSystem && item.metadata?.cybernetic === true,
  cyberneticEquipped: false,
  biologicalLoad: isCyberFlowerSystem ? item.metadata?.biologicalLoad ?? null : null,
  cyberneticData: isCyberFlowerSystem ? item.metadata?.cyberneticData ?? null : null,
},
      })
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .single()

    if (insertError) {
      setError(`Não foi possível duplicar o item: ${insertError.message}`)
      return
    }

    if (!data) {
      setError('O Supabase não confirmou a duplicação do item. Verifique as permissões de inserção e leitura do inventário.')
      return
    }

    setItems((current) => [...current, data as Item])
    setNotice(`Cópia de "${item.name}" criada.`)
  }

  async function removeItem(item: Item) {
    const confirmed = window.confirm(
      `Deseja remover "${item.name}" do inventário?`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    const { data, error: deleteError } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id')

    if (deleteError) {
      setError(`Não foi possível remover o item: ${deleteError.message}`)
      return
    }

    if (!data?.length) {
      setError(
        'Nenhum item foi removido. Verifique as permissões de acesso no Supabase.',
      )
      return
    }

    let removalDamageMessage = ''
    if (item.metadata?.equipmentType === 'protection' && sheet?.id && selectedCharacterId === item.character_id) {
      const tier = item.metadata?.protectionTier
      const rolls = tier === 'avancada' ? [12, 12, 4] : tier === 'moderada' ? [8, 8] : [8]
      const results = rolls.map(sides => Math.floor(Math.random() * sides) + 1)
      const damage = results.reduce((sum, value) => sum + value, 0)
      const sheetData = sheet.sheet_data as Record<string, any>
      const status = sheetData.status && typeof sheetData.status === 'object' ? sheetData.status : {}
      const current = status.current && typeof status.current === 'object' ? status.current : {}
      const currentPS = Number(current.ps ?? ((Number(sheetData.skills && (sheetData.skills as any).mental) || 0) * 10))
      const nextData = { ...sheetData, status: { ...status, current: { ...current, ps: Math.max(0, currentPS - damage) } } }
      const { error: statusError } = await supabase.from('character_sheets').update({ sheet_data: nextData }).eq('id', sheet.id)
      if (!statusError) {
        setSheet({ ...sheet, sheet_data: nextData })
        setSheetDraft(JSON.stringify(nextData, null, 2))
        removalDamageMessage = ` Dano de sanidade pela perda da proteção: ${results.join(' + ')} = ${damage}.`
      } else {
        setError(`O item foi removido, mas não foi possível aplicar o dano de sanidade: ${statusError.message}`)
      }
    }

    setItems((current) =>
      current.filter((entry) => entry.id !== item.id),
    )
    setNotice(`${item.name} foi removido do inventário.${removalDamageMessage}`)
  }

  async function updateEnemyPartySeason(
    enemyId: string,
    seasonId: string,
    changes: { participating?: boolean; initiative?: number | null },
    successMessage = 'Party de Inimigos atualizada.',
  ): Promise<boolean> {
    if (!isMaster || !selectedCampaignId || !seasonId || enemyPartySavingId) return false
    if (selectedEnemyId === enemyId && (enemySheetDirty || enemySheetSavingRef.current)) {
      setError('Salve primeiro as alterações pendentes da ficha deste inimigo antes de editar a Party.')
      return false
    }
    setEnemyPartySavingId(enemyId)
    setError('')
    try {
      const { data: latest, error: loadError } = await supabase.from('campaign_enemies')
        .select('id,sheet_data,updated_at')
        .eq('campaign_id', selectedCampaignId).eq('id', enemyId).single()
      if (loadError || !latest) throw loadError ?? new Error('Inimigo não encontrado.')
      const original = latest.sheet_data && typeof latest.sheet_data === 'object' && !Array.isArray(latest.sheet_data)
        ? latest.sheet_data as Record<string, any> : {}
      const bySeason = original.enemyPartyBySeason && typeof original.enemyPartyBySeason === 'object'
        ? original.enemyPartyBySeason as Record<string, any> : {}
      const oldEntry = bySeason[seasonId] && typeof bySeason[seasonId] === 'object'
        ? bySeason[seasonId] as Record<string, any> : {}
      const entry = { ...oldEntry, ...changes }
      if (changes.participating === false) entry.initiative = null
      const nextSheet = { ...original, enemyPartyBySeason: {
        ...bySeason, [seasonId]: entry,
      } }
      const { data: updated, error: saveError } = await supabase.from('campaign_enemies')
        .update({ sheet_data: nextSheet, updated_at: new Date().toISOString() })
        .eq('id', enemyId).eq('campaign_id', selectedCampaignId)
        .select('id,sheet_data,updated_at').single()
      if (saveError || !updated) throw saveError ?? new Error('Não foi possível salvar a Party.')
      setEnemies(current => current.map(enemy => enemy.id === enemyId
        ? { ...enemy, sheet_data: updated.sheet_data, updated_at: updated.updated_at }
        : enemy))
      if (selectedEnemyId === enemyId && enemySheetLoadedForRef.current === `${selectedCampaignId}:${enemyId}`) {
        const nextDraft = JSON.stringify(updated.sheet_data ?? {}, null, 2)
        enemySheetDraftRef.current = nextDraft
        setEnemySheetDraft(nextDraft)
        setEnemySheetDirty(false)
      }
      setEnemyPartyInitiativeDrafts(current => {
        const next = { ...current }
        delete next[enemyId]
        return next
      })
      setNotice(successMessage)
      return true
    } catch (err) {
      setError('Não foi possível atualizar a Party de Inimigos: ' +
        (err instanceof Error ? err.message : String(err)))
      return false
    } finally { setEnemyPartySavingId(null) }
  }

  const enemyPartyMembers = masterShieldSeasonId
    ? enemies.filter(enemy => getEnemyPartySeason(enemy, masterShieldSeasonId).participating)
    : []

  // A iniciativa é apenas uma visão conjunta: cada resultado continua salvo
  // na ficha de origem (combat.initiative para personagens;
  // enemyPartyBySeason para inimigos).
  type MasterShieldInitiativeEntry = {
    id: string
    kind: 'character' | 'enemy'
    name: string
    emoji: string | null
    initiative: number | null
    sheetData: Record<string, any>
  }
  const masterShieldInitiativeEntries: MasterShieldInitiativeEntry[] = [
    ...characters.filter(character =>
      masterShieldSheets[character.id]?.seasonParticipation === true &&
      masterShieldSheets[character.id]?.partyParticipation === true,
    ).map(character => {
      const data = masterShieldSheets[character.id] ?? {}
      const raw = data.combat?.initiative
      return {
        id: character.id,
        kind: 'character' as const,
        name: character.name,
        emoji: character.emoji ?? null,
        initiative: raw === null || raw === undefined || raw === '' ||
          !Number.isFinite(Number(raw)) ? null : Number(raw),
        sheetData: data,
      }
    }),
    ...enemyPartyMembers.map(enemy => ({
      id: enemy.id,
      kind: 'enemy' as const,
      name: enemy.name,
      emoji: enemy.emoji,
      initiative: getEnemyPartySeason(enemy, masterShieldSeasonId).initiative,
      sheetData: enemy.sheet_data ?? {},
    })),
  ].sort((a, b) => {
    if (a.initiative === null && b.initiative !== null) return 1
    if (b.initiative === null && a.initiative !== null) return -1
    if (a.initiative !== null && b.initiative !== null && a.initiative !== b.initiative)
      return b.initiative - a.initiative

    // Empate: a mesma regra de Agilidade e Sempre Pronto da antiga lista.
    const agility = (entry: MasterShieldInitiativeEntry) => {
      const data = entry.sheetData
      const read = (path: string, fallback: any = 0) => path.split('.')
        .reduce((current: any, key: string) => current && typeof current === 'object'
          ? current[key] : undefined, data as any) ?? fallback
      const tier = String(data.family?.tier ?? '5')
      return calculateSheetAttribute(read, 'agility',
        systemFeatures.usesFamilyTiers ? getSystemAttributeBonus(tier, 'agility') : 0)
    }
    const agilityDifference = agility(b) - agility(a)
    if (agilityDifference !== 0) return agilityDifference
    const alwaysReady = (entry: MasterShieldInitiativeEntry) => {
      const flows = String(entry.sheetData.flows?.details ?? '').toLocaleLowerCase('pt-BR')
      return flows.includes('raposa') && flows.includes('sempre pronto')
    }
    if (alwaysReady(a) !== alwaysReady(b)) return alwaysReady(a) ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR') || a.kind.localeCompare(b.kind)
  })

  async function clearAllMasterShieldInitiatives(seasonId: string) {
    if (!isMaster || !seasonId || sheetSaving || enemyPartySavingId) return
    if (!masterShieldInitiativeEntries.some(entry => entry.initiative !== null)) {
      setNotice('Nenhuma iniciativa registrada nesta party.')
      return
    }
    if (!window.confirm('Limpar as iniciativas de personagens e inimigos desta temporada?')) return

    const characterOk = await clearAllCharacterInitiatives(seasonId, true)
    if (!characterOk) return
    const enemiesToClear = enemyPartyMembers.filter(enemy =>
      getEnemyPartySeason(enemy, seasonId).initiative !== null)
    for (const enemy of enemiesToClear) {
      const ok = await updateEnemyPartySeason(enemy.id, seasonId, { initiative: null },
        `Iniciativa de ${enemy.name} removida.`)
      if (!ok) return // Preserva a mensagem de erro e permite tentar de novo.
    }
    setNotice('Iniciativas de personagens e inimigos removidas da ordem de combate.')
  }

  function rollEnemyPartyInitiative(enemy: CampaignEnemy) {
    if (!masterShieldSeasonId) return
    const data = enemy.sheet_data ?? {}
    const read = (path: string, fallback: any = 0) => path.split('.')
      .reduce((current: any, key: string) => current && typeof current === 'object'
        ? current[key] : undefined, data as any) ?? fallback
    const dexterity = calculateSheetSkill(read, 'dexterity',
      systemFeatures.usesSkillPoints ? activeSystem?.data?.skillPoints : null, true)
    const equipped = Array.isArray(data.inventory?.items)
      ? data.inventory.items.filter((item: any) => item?.equipped === true) : []
    const armorDexterity = calculateSheetDefenses(equipped, {
      dexterity, combat: 0, resistance: 0, mental: 0,
    }).armorDexterity
    const die = Math.floor(Math.random() * 20) + 1
    const total = die + armorDexterity
    void updateEnemyPartySeason(enemy.id, masterShieldSeasonId, { initiative: total },
      `Iniciativa de ${enemy.name}: d20 (${die}) + Destreza de Armadura (${armorDexterity}) = ${total}.`)
  }


  const seasonPartyCharacters = characters.filter(character => masterShieldSheets[character.id]?.seasonParticipation === true)
  // A party inclui sempre o mestre da campanha e os jogadores atribuídos
  // aos personagens participantes da temporada.
  const masterShieldPartyUserIds = new Set(
    seasonPartyCharacters.map(character => character.current_player_id).filter((id): id is string => Boolean(id)),
  )
  campaignMembers.filter(member => member.role === 'master').forEach(member => {
    masterShieldPartyUserIds.add(member.user_id)
  })
  const masterShieldPartyMembers = campaignMembers.filter(member => masterShieldPartyUserIds.has(member.user_id))

  const displayName =
    session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Aventureiro'
  const accountUsername = typeof session?.user.user_metadata?.username === 'string' ? String(session.user.user_metadata.username) : ''
  const rawAccountAvatar = session?.user.user_metadata?.profile_avatar
  const accountAvatar = typeof rawAccountAvatar === 'string' &&
    profileAvatarOptions.some(emoji => emoji === rawAccountAvatar) ? rawAccountAvatar : ''
  const accountBio = typeof session?.user.user_metadata?.profile_bio === 'string'
    ? String(session.user.user_metadata.profile_bio) : ''
  const accountCreatedAt = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : 'Data indisponível'
  const profileHasChanges = profileUsernameDraft.trim().toLowerCase() !== accountUsername.toLowerCase() || profileNameDraft.trim() !== String(displayName).trim() ||
    profileAvatarDraft !== accountAvatar || profileBioDraft.trim() !== accountBio.trim()
  const openProfilePage = () => {
    setProfileNameDraft(String(displayName))
    setProfileUsernameDraft(accountUsername)
    setProfileAvatarDraft(accountAvatar)
    setProfileBioDraft(accountBio)
    setProfileEditing(false)
    setError('')
    setNotice('')
    setActivePage('profile')
  }

  const selectedCharacter = characters.find(
    (character) => character.id === selectedCharacterId,
  )
  useEffect(() => {
    setCharacterNameDraft(selectedCharacter?.name ?? '')
  }, [selectedCharacter?.id, selectedCharacter?.name])
  // O acesso explícito registrado em character_visibility é uma concessão
  // válida por si só; não deve depender do valor atual de visibility.
  // A campanha também é uma fonte de acesso para personagens compartilhados.
  const hasExplicitCharacterGrant = Boolean(
    session?.user?.id && characterGrants.some(
      grant => grant.user_id === session.user.id,
    ),
  )
  const canAccessSelectedCharacter = Boolean(
    selectedCharacter && session?.user?.id && (
      isMaster ||
      selectedCharacter.user_id === session.user.id ||
      selectedCharacter.visibility === 'campaign' ||
      hasExplicitCharacterGrant
    ),
  )
  // Quem recebeu acesso ao personagem pode consultar a carteira e ajustar
  // as condições atuais da ficha; o banco continua validando a permissão.
  const canEditSelectedSheet = canAccessSelectedCharacter

const isMechanic = Boolean(
  isCyberFlowerSystem &&
  session?.user?.id &&
  characters.some(character => {
    const sheetData = cyberneticsArchetypeSheets[character.id] ?? {}
    const identity = sheetData.identity ?? {}

    const normalizeArchetype = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    const isAssignedToUser =
      character.user_id === session.user.id ||
      character.current_player_id === session.user.id

    return (
      isAssignedToUser &&
      (
        normalizeArchetype(identity.primaryArchetype) === 'medcanico' ||
        normalizeArchetype(identity.secondaryArchetype) === 'medcanico'
      )
    )
  })
)

const canManageCybernetics = Boolean(isCyberFlowerSystem && (isMaster || isMechanic))

useEffect(() => {
  if (!selectedSeasonId || !characters.length) {
    setCyberneticsArchetypeSheets({})
    return
  }

  let cancelled = false

  async function loadCyberneticsArchetypes() {
    const ids = characters.map(character => character.id)

    const { data, error: loadError } = await supabase
      .from('character_sheets')
      .select('character_id, sheet_data')
      .eq('season_id', selectedSeasonId)
      .in('character_id', ids)

    if (cancelled) return

    if (loadError) {
      setError(`Erro ao verificar arquétipos: ${loadError.message}`)
      return
    }

    const result: Record<string, Record<string, any>> = {}

    for (const row of data ?? []) {
      result[row.character_id] = (row.sheet_data ?? {}) as Record<string, any>
    }

    setCyberneticsArchetypeSheets(result)
  }

  void loadCyberneticsArchetypes()

  return () => {
    cancelled = true
  }
}, [selectedSeasonId, characters])

useEffect(() => {
  const ownerKey = `${selectedCharacterId ?? ''}:${selectedSeasonId ?? ''}`

  if (
    !selectedCharacterId ||
    !selectedSeasonId ||
    sheetLoading ||
    sheetSaving ||
    !canEditSelectedSheet ||
    sheetDraftLoadedForRef.current !== ownerKey ||
    sheetDraft === lastSavedSheetDraftRef.current
  ) {
    return
  }

  const timeout = window.setTimeout(() => {
    void saveCharacterSheet(sheetDraft, true)
  }, 700)

  return () => window.clearTimeout(timeout)
}, [
  sheetDraft,
  selectedCharacterId,
  selectedSeasonId,
  sheetLoading,
  sheetSaving,
  canEditSelectedSheet,
])

  const canRenameSelectedCharacter = Boolean(
    selectedCharacter && session?.user?.id && (
      isMaster || selectedCharacter.user_id === session.user.id
    ),
  )

  async function saveSelectedCharacterName() {
    if (!selectedCharacter || !canRenameSelectedCharacter || characterNameSaving) return
    const nextName = characterNameDraft.trim()
    if (!nextName) {
      setError('O nome do personagem não pode ficar vazio.')
      return
    }
    if (nextName === selectedCharacter.name) {
      setNotice('O nome do personagem já está atualizado.')
      return
    }

    setCharacterNameSaving(true)
    setError('')
    setNotice('')
    const { data, error: updateError } = await supabase
      .from('characters')
      .update({ name: nextName })
      .eq('id', selectedCharacter.id)
      .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
      .single()

    if (updateError || !data) {
      setError(`Não foi possível atualizar o nome: ${updateError?.message ?? 'personagem não encontrado'}`)
      setCharacterNameSaving(false)
      return
    }

    setCharacters(current => current.map(character => character.id === selectedCharacter.id ? data as Character : character))
    setCharacterNameDraft((data as Character).name)
    setNotice('Nome do personagem atualizado!')
    setCharacterNameSaving(false)
  }

  async function changeMemberRole(member: CampaignMember) {
    if (!selectedCampaignId || !isMaster || memberActionLoading) return

    const newRole = member.role === 'master' ? 'player' : 'master'
    const action = newRole === 'master' ? 'promover' : 'rebaixar'

    if (
      member.role === 'master' &&
      campaignMembers.filter((entry) => entry.role === 'master').length <= 1
    ) {
      setError('A campanha precisa ter pelo menos um mestre.')
      return
    }

    const confirmed = window.confirm(
      `Deseja ${action} ${member.display_name} ${
        newRole === 'master' ? 'a mestre' : 'a jogador'
      }?`,
    )
    if (!confirmed) return

    setMemberActionLoading(member.user_id)
    setError('')
    setNotice('')

    const { error: rpcError } = await supabase.rpc('set_campaign_member_role', {
      p_campaign_id: selectedCampaignId,
      p_user_id: member.user_id,
      p_role: newRole,
    })

    if (rpcError) {
      setError(`Não foi possível alterar o cargo: ${rpcError.message}`)
      setMemberActionLoading(null)
      return
    }

    setCampaignMembers((current) =>
      current.map((entry) =>
        entry.user_id === member.user_id ? { ...entry, role: newRole } : entry,
      ),
    )

    if (member.user_id === session?.user.id) {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selectedCampaignId
            ? { ...campaign, role: newRole }
            : campaign,
        ),
      )
    }

    setNotice(
      `${member.display_name} agora é ${newRole === 'master' ? 'mestre' : 'jogador'}.`,
    )
    setMemberActionLoading(null)
  }

  async function removeCampaignMember(member: CampaignMember) {
    if (!selectedCampaignId || !isMaster || memberActionLoading) return

    if (
      member.role === 'master' &&
      campaignMembers.filter((entry) => entry.role === 'master').length <= 1
    ) {
      setError('Não é possível remover o último mestre da campanha.')
      return
    }

    const confirmed = window.confirm(
      `Tem certeza de que deseja remover ${member.display_name} desta campanha?`,
    )
    if (!confirmed) return

    setMemberActionLoading(member.user_id)
    setError('')
    setNotice('')

    const { error: rpcError } = await supabase.rpc('remove_campaign_member', {
      p_campaign_id: selectedCampaignId,
      p_user_id: member.user_id,
    })

    if (rpcError) {
      setError(`Não foi possível remover o membro: ${rpcError.message}`)
      setMemberActionLoading(null)
      return
    }

    setCampaignMembers((current) =>
      current.filter((entry) => entry.user_id !== member.user_id),
    )

    if (member.user_id === session?.user.id) {
      setCampaigns((current) =>
        current.filter((campaign) => campaign.id !== selectedCampaignId),
      )
      setSelectedCampaignId('')
      setNotice('Você saiu da campanha.')
    } else {
      setNotice(`${member.display_name} foi removido da campanha.`)
    }

    setMemberActionLoading(null)
  }

  const filteredItems = items.filter((item) => {
  const matchesCategory =
    activeCategory === 'Todos' ||
    item.category === activeCategory ||
    (
      Array.isArray(item.metadata?.categories) &&
      item.metadata.categories.includes(activeCategory)
    )

  const term = search.trim().toLowerCase()

  const matchesSearch =
    item.name.toLowerCase().includes(term) ||
    (item.description ?? '').toLowerCase().includes(term)

  const matchesFavorite =
    !favoriteOnly || item.metadata?.favorite === true

  return matchesCategory && matchesSearch && matchesFavorite
})
.sort((a, b) => {
  const aData = masterShieldSheets[a.id]
  const bData = masterShieldSheets[b.id]

  const aRaw = aData?.combat?.initiative
  const bRaw = bData?.combat?.initiative

  const aHas =
    aRaw !== null &&
    aRaw !== undefined &&
    aRaw !== '' &&
    Number.isFinite(Number(aRaw))

  const bHas =
    bRaw !== null &&
    bRaw !== undefined &&
    bRaw !== '' &&
    Number.isFinite(Number(bRaw))

  // Personagens que já rolaram ficam primeiro.
  if (aHas && !bHas) return -1
  if (!aHas && bHas) return 1

  // Maior iniciativa primeiro.
  if (aHas && bHas && Number(aRaw) !== Number(bRaw)) {
    return Number(bRaw) - Number(aRaw)
  }

  const getAgility = (data: any) => {
    const familyTierKey = String(data?.family?.tier ?? '5')
    const familyBonus = systemFeatures.usesFamilyTiers
      ? getSystemAttributeBonus(familyTierKey, 'agility')
      : 0

    const allocations = data?.progression?.allocations ?? {}

    const allocation = (source: string) => {
      const own = Math.max(
        0,
        Math.floor(Number(allocations[source]?.agility) || 0)
      )

      const legacyClass = source === 'extra'
        ? Math.max(0, Math.floor(Number(allocations.class?.agility) || 0))
        : 0

      return own + legacyClass
    }

    const base = Math.max(
      0,
      Math.floor(Number(data?.attributes?.agility) || 0)
    )

    return Math.min(
      5,
      Math.max(
        0,
        base +
          allocation('family') +
          allocation('hierarchy') +
          allocation('extra') +
          familyBonus
      )
    )
  }

  // Maior Agilidade efetiva primeiro.
  const agilityDifference =
    getAgility(bData) - getAgility(aData)

  if (agilityDifference !== 0) {
    return agilityDifference
  }

  // Raposa — Sempre Pronto tem preferência.
  const hasAlwaysReady = (data: any) => {
    const flows = String(data?.flows?.details ?? '').toLowerCase()

    return (
      flows.includes('raposa') &&
      flows.includes('sempre pronto')
    )
  }

  const aHasPriority = hasAlwaysReady(aData)
  const bHasPriority = hasAlwaysReady(bData)

  if (aHasPriority && !bHasPriority) return -1
  if (!aHasPriority && bHasPriority) return 1

  // Empate total: ordem alfabética.
  return a.name.localeCompare(b.name)
})

  // Ordem manual é armazenada no metadata existente, sem migração de banco.
  const orderedInventoryItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'manual') {
      const aOrder = Number(a.metadata?.manualOrder)
      const bOrder = Number(b.metadata?.manualOrder)
      const aValid = Number.isFinite(aOrder) && a.metadata?.manualOrder != null
      const bValid = Number.isFinite(bOrder) && b.metadata?.manualOrder != null
      if (aValid && bValid && aOrder !== bOrder) return aOrder - bOrder
      if (aValid !== bValid) return aValid ? -1 : 1
      return items.findIndex(x => x.id === a.id) - items.findIndex(x => x.id === b.id)
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    if (sortBy === 'category') return a.category.localeCompare(b.category, 'pt-BR')
    if (sortBy === 'weight') return Number(b.weight) - Number(a.weight)
    if (sortBy === 'quantity') return Number(b.quantity) - Number(a.quantity)
    return items.findIndex(x => x.id === a.id) - items.findIndex(x => x.id === b.id)
  })

  async function reorderInventoryItem(sourceId: string, targetId: string) {
    if (sourceId === targetId || inventoryReorderBusy.current || !selectedCharacterId) return
    // Com filtros ativos, a movimentação afeta somente os itens visíveis.
    const visible = orderedInventoryItems.map(item => item.id)
    const from = visible.indexOf(sourceId)
    const to = visible.indexOf(targetId)
    if (from < 0 || to < 0) return
    const reordered = [...visible]
    reordered.splice(from, 1)
    reordered.splice(to, 0, sourceId)
    const original = items
    const allIds = [...items]
      .sort((a,b) => {
        const av = Number(a.metadata?.manualOrder)
        const bv = Number(b.metadata?.manualOrder)
        const aHas = a.metadata?.manualOrder != null && Number.isFinite(av)
        const bHas = b.metadata?.manualOrder != null && Number.isFinite(bv)
        return aHas && bHas ? av-bv : aHas ? -1 : bHas ? 1 : 0
      }).map(item => item.id)
    const slots = allIds.map((id, index) => visible.includes(id) ? index : -1).filter(i => i >= 0)
    reordered.forEach((id, index) => { allIds[slots[index]] = id })
    const changed = allIds.map((id, index) => {
      const item = items.find(entry => entry.id === id)!
      return { ...item, metadata: { ...(item.metadata || {}), manualOrder: index } }
    })
    inventoryReorderBusy.current = true
    setItems(changed)
    setSortBy('manual')
    setDraggedInventoryId(null)
    setInventoryDropId(null)
    try {
      // Só atualiza o metadata; nunca modifica quantidade, peso ou equipamentos.
      for (const item of changed) {
        const before = original.find(entry => entry.id === item.id)!
        if (before.metadata?.manualOrder === item.metadata?.manualOrder) continue
        const { error: reorderError } = await supabase.from('inventory_items')
          .update({ metadata: item.metadata })
          .eq('id', item.id)
          .eq('character_id', selectedCharacterId)
        if (reorderError) throw reorderError
      }
      setNotice('Ordem do inventário salva.')
    } catch (reorderError) {
      setItems(original)
      setError(`Não foi possível salvar a ordem: ${reorderError instanceof Error ? reorderError.message : String(reorderError)}. Recarregue o inventário antes de tentar novamente.`)
    } finally {
      inventoryReorderBusy.current = false
    }
  }

  const totalObjects = items.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  )

  const totalWeight = items.reduce((sum, item) => {
    const unitWeight = Number(item.weight) || 0
    return sum + unitWeight * (Number(item.quantity) || 0)
  }, 0)

  // A Força da tabela characters pode não incluir a penalidade voluntária (-1).
  // A ficha é a fonte de verdade para a capacidade, inclusive antes do autosave.
  const strengthForInventory = (() => {
    const fallback = Number(selectedCharacter?.strength ?? 0)
    if (!selectedCharacterId || !selectedSeasonId || (sheet && (sheet.character_id !== selectedCharacterId || sheet.season_id !== selectedSeasonId))) return fallback
    try {
      const parsed: unknown = JSON.parse(sheetDraft || '{}')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
      const data = parsed as Record<string, any>
      if (!data.attributes || typeof data.attributes !== 'object') return fallback
      const read = (path: string, defaultValue: any = 0) => path.split('.').reduce(
        (node: any, key) => node && typeof node === 'object' ? node[key] : undefined, data,
      ) ?? defaultValue
      const tier = String(read('family.tier', '5'))
      const familyBonus = systemFeatures.usesFamilyTiers ? getSystemAttributeBonus(tier, 'strength') : 0
      return calculateSheetAttribute(read, 'strength', familyBonus)
    } catch { return fallback }
  })()
  const maxCapacity = Math.max(0, 10 + 2 * strengthForInventory)
  const remainingCapacity = maxCapacity - totalWeight
  const isOverloaded = totalWeight > maxCapacity
  const capacityPercent = maxCapacity > 0
    ? Math.min(100, (totalWeight / maxCapacity) * 100)
    : totalWeight > 0 ? 100 : 0


  // A MESMA ficha visual, progressão e ações de combate para jogadores e inimigos.
  // A origem e o destino da persistência são selecionados aqui, nunca na interface.
  const renderSharedSheetCore = (forEnemy: boolean, section: 'main' | 'armor' = 'main') => {
    const renderDraft = forEnemy ? enemySheetDraft : sheetDraft
    const sheetResourceAbbreviation = forEnemy ? enemyResourceAbbreviation : resourceAbbreviation
    const sheetResourcePointsLabel = forEnemy ? enemyResourcePointsLabel : resourcePointsLabel
    const sheetResourceUnit = forEnemy && isKisatsutaiSystem ? 'pontos de sangue' : sheetResourceAbbreviation
    const sheetResourceName = forEnemy && isKisatsutaiSystem ? 'Sangue' : resourceName
    const sheetRecoveryTestName = forEnemy && isKisatsutaiSystem ? 'Teste de Sangue' : 'Teste de Respiração'
    const updateRenderDraft = (draft: string) => {
      if (!forEnemy) { setSheetDraft(draft); return }
      enemySheetDraftRef.current = draft
      setEnemySheetDraft(draft)
      setEnemySheetDirty(true)
      setEnemyAutoSaveStatus('pending')
      enemyFailedAutoSaveDraftRef.current = null
    }
    const renderSubject = forEnemy
      ? (selectedEnemy ? { name: selectedEnemy.name, archetype: selectedEnemy.archetype } : null)
      : selectedCharacter
    const renderSubjectId = forEnemy ? selectedEnemyId : selectedCharacterId
    const renderCanEdit = forEnemy ? Boolean(isMaster && selectedEnemy) : canEditSelectedSheet
    const renderCanRename = forEnemy ? Boolean(isMaster && selectedEnemy) : canRenameSelectedCharacter
    const renderEditing = forEnemy ? enemyEditingSheet : editingSheet
    const renderNameDraft = forEnemy ? enemySheetNameDraft : characterNameDraft
    const renderNameSaving = forEnemy ? enemySheetNameSaving : characterNameSaving
    const setRenderNameDraft = (value: string) => forEnemy
      ? setEnemySheetNameDraft(value) : setCharacterNameDraft(value)
    const saveRenderName = () => forEnemy ? saveEnemyNameFromSheet() : saveSelectedCharacterName()
    const renderOverloaded = forEnemy ? enemyIsOverloaded : isOverloaded
    const renderInventoryItems: Item[] = forEnemy
      ? enemyInventory.map(entry => ({
          id: String(entry.id || ''),
          character_id: selectedEnemyId || '',
          name: String(entry.name || ''),
          description: entry.description == null ? null : String(entry.description),
          category: String(entry.categories?.[0] || 'Diversos'),
          quantity: Math.max(1, Number(entry.quantity) || 1),
          weight: Number(entry.weight) || 0,
          unit_price: Number(entry.unitPrice) || 0,
          currency_id: entry.currencyId ? String(entry.currencyId) : null,
          sale_blocked: false,
          metadata: {
            ...entry,
            categories: Array.isArray(entry.categories) ? entry.categories : [],
            equipped: Boolean(entry.equipped),
            equipmentType: entry.equipmentType === 'weapon' ? 'weapon' : (entry.equipmentType || 'none'),
            weaponDamage: entry.weaponDamage || ({ improvised:'1d4', advanced:'1d6', special:'1d8', black_red:'1d10', mutable:'1d12' } as Record<string,string>)[String(entry.weaponClass)] || '—',
          },
        })) : items
    const updateCombatArmor = async (armorId: string) => {
      if (!renderCanEdit || !renderSubjectId) return
      if (forEnemy) {
        const nextInventory = enemyInventory.map(entry =>
          entry.equipmentType === 'armor'
            ? { ...entry, equipped: String(entry.id) === armorId }
            : entry,
        )
        writeEnemySheet('inventory.items', nextInventory)
        setNotice(armorId ? 'Armadura do inimigo equipada.' : 'Armadura do inimigo removida.')
        return
      }
      // Armaduras dos personagens continuam na tabela de inventário.
      // Nenhum item de outro personagem é modificado.
      const armorItems = renderInventoryItems.filter(item =>
        item.character_id === renderSubjectId && item.metadata?.equipmentType === 'armor'
      )
      for (const item of armorItems) {
        const shouldEquip = item.id === armorId
        if (Boolean(item.metadata?.equipped) === shouldEquip) continue
        const { data, error: equipError } = await supabase.from('inventory_items')
          .update({ metadata: { ...(item.metadata || {}), equipped: shouldEquip } })
          .eq('id', item.id)
          .eq('character_id', renderSubjectId)
          .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id')
          .single()
        if (equipError) {
          setError(`Não foi possível alterar a armadura: ${equipError.message}`)
          return
        }
        setItems(current => current.map(entry => entry.id === item.id ? data as Item : entry))
      }
      setNotice(armorId ? 'Armadura equipada.' : 'Armadura removida.')
    }
    const persistRenderConditions = async (next: Record<string, any>) => {
      if (forEnemy) {
        updateRenderDraft(JSON.stringify(next, null, 2))
        await saveEnemySheet()
      } else {
        await saveCharacterConditions(next)
      }
    }
    const persistRenderInitiative = async (total: number) => {
      if (forEnemy) {
        writeEnemySheet('combat.initiative', total)
        await saveEnemySheet()
      } else {
        await saveCharacterInitiative(total)
      }
    }
    return <>{(() => {
                    let data: Record<string, any> = {}
                    try { data = JSON.parse(renderDraft) } catch { data = {} }
                    const read = (path: string, fallback: any = 0) => path.split('.').reduce((obj: any, key) => obj && typeof obj === 'object' ? obj[key] : undefined, data) ?? fallback
                    const write = (path: string, value: any) => {
                      const next = { ...data }
                      const parts = path.split('.')
                      let node: Record<string, any> = next
                      for (const part of parts.slice(0, -1)) {
                        if (!node[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part] = {}
                        else node[part] = { ...node[part] }
                        node = node[part]
                      }
                      node[parts[parts.length - 1]] = value
                      // Sincroniza a trilha salva ao alterar qualquer um dos arquétipos.
                      if ((path === 'identity.primaryArchetype' || path === 'identity.secondaryArchetype') &&
                          String(read('progression.system', selectedCampaign?.system_name || '')).toLowerCase().includes('kisatsutai')) {
                        next.identity = { ...(next.identity || {}) }
                        const oldPath = getKisatsutaiPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', '')))
                        const oldPrimary = String(read('identity.primaryArchetype', ''))
                        next.identity.path = getKisatsutaiFullPath(
                          String(next.identity.primaryArchetype || ''),
                          String(next.identity.secondaryArchetype || '')
                        )
                        // Ao mudar a trilha ou o arquétipo principal, as vagas antigas deixam de conceder bônus.
                        if (oldPath !== getKisatsutaiPath(String(next.identity.primaryArchetype || ''), String(next.identity.secondaryArchetype || '')) || oldPrimary !== next.identity.primaryArchetype) {
                          const oldKey = `${oldPath}:${oldPrimary}`
                          const previousSlots = (read('skills.distributionByPath', {}) || {})[oldKey] || {}
                          const oldTrainings = { ...(read('skills.extraTrainings', {}) || {}) }
                          for (const skillName of Object.values(previousSlots) as string[]) {
                            if (skillName) delete oldTrainings[skillName]
                          }
                          next.skills = { ...(next.skills || {}), extraTrainings: oldTrainings }
                        }
                      }
                      updateRenderDraft(JSON.stringify(next, null, 2))
                    }

                    const currentSystem = forEnemy ? (selectedCampaign?.system_name || '') : String(
                      read('progression.system', selectedCampaign?.system_name || '')
                    )
                    const systemFeatures = getSystemByName(currentSystem)?.data?.features

                    const familyTierKey = String(read('family.tier', '5'))
                    const usesFamilyTiers = systemFeatures?.usesFamilyTiers ?? false

                    const familyTier = usesFamilyTiers
                      ? getSystemFamilyTier(familyTierKey)
                      : undefined

                    const familyTierData = familyTier ?? {
                      pv: 0,
                      ps: 0,
                      pr: 0,
                      strength: 0,
                      agility: 0,
                      defense: 0,
                      breathing: 0,
                      intellect: 0,
                      points: 0,
                      focus: '',
                      label: '',
                    }
                    const allocationSources = ['family', 'hierarchy', 'extra'] as const
                    const familyAllocationKeys = ['strength','agility','defense','breathing','intellect'] as const

                    const skillKeys = ['vigor','mental','combat','dexterity','resistance','ability'] as const
                    const allocation = (source: string, key: string) => { if (!(familyAllocationKeys as readonly string[]).includes(key)) return 0; const own = Math.max(0, Math.floor(Number(read(`progression.allocations.${source}.${key}`, 0)) || 0)); const legacyClass = source === 'extra' ? Math.max(0, Math.floor(Number(read(`progression.allocations.class.${key}`, 0)) || 0)) : 0; return own + legacyClass }
                    // Pontos extras de atributos concedidos por graduação, conforme benefícios explicitamente documentados.
                    // Graduações sem quantidade definida no material não concedem pontos automáticos aqui.
                    const rankIdForAttributes = String(read('progression.rankId', 'zaidan'))

                    const rankIdForStatus = rankIdForAttributes
                    const numRaw = (path: string) => { const value = Number(read(path, 0)); return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }

                    const voluntaryAttributeCredit = familyAllocationKeys.reduce((sum, key) => {
                      const base = numRaw(`attributes.${key}`)
                      const bonus = usesFamilyTiers ? getSystemAttributeBonus(familyTierKey, key) : 0
                      return sum + (base + bonus === 0 && bonus >= 0 && Number(read(`progression.attributePenalties.${key}`, 0)) === -1 ? 1 : 0)
                    }, 0)
                    const attributeTotalUsed = (source: typeof allocationSources[number]) =>
                      familyAllocationKeys.reduce(
                        (sum, key) => sum + allocation(source, key),
                        0
                      )

                    const skillPointConfig = activeSystem?.data?.skillPoints
                    const maxSkillLevel = Math.max(1, Math.floor(skillPointConfig?.maxPerSkill ?? 12))
                    const num = (path: string) => {
                      const match = path.match(/^(attributes|skills)\.(.+)$/)
                      // Não há bases de perícia definidas por família/tier no material; portanto, a base é 0.
                      const base = match?.[1] === 'skills' ? 0 : numRaw(path)
                      if (!match) return base
                      const key = match[2]
                      if (match[1] === 'skills') {
                        return skillKeys.includes(key as typeof skillKeys[number])
                          ? calculateSheetSkill(read, key as SheetSkill, skillPointConfig)
                          : 0
                      }
                      const sourceBonus = allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
                      return Math.min(5, base + sourceBonus)
                    }
                      const effectiveAttribute = (
                        _path: string,
                        attribute: SheetAttribute
                      ) => calculateSheetAttribute(
                        read,
                        attribute,
                        usesFamilyTiers ? getSystemAttributeBonus(familyTierKey, attribute) : 0,
                      )
                    const agility = Math.floor(effectiveAttribute('attributes.agility', 'agility'))
                    const movementActions = Math.max(0, applyConditionModifier(1 + Math.floor(agility / 2), conditionModifiers, 'actions', 'movement'))
                    const extraActions = Math.max(0, applyConditionModifier(agility % 2, conditionModifiers, 'actions', 'extra'))
                    const dexterity = Math.min(maxSkillLevel, num('skills.dexterity'))
                    const intellectChoiceConfig = skillPointConfig?.intellectChoice
                    const skillChoicePath = intellectChoiceConfig?.choicePath ?? 'skills.intelligenceChoices'
                    const mainChoiceValue = intellectChoiceConfig?.mainChoiceValue ?? 'main'
                    const extraChoiceValue = intellectChoiceConfig?.extraChoiceValue ?? 'extra'
                    const intellect = intellectChoiceConfig?.enabled
                      ? Math.floor(
                          intellectChoiceConfig.useEffectiveAttribute
                            ? effectiveAttribute(
                                intellectChoiceConfig.attributePath,
                                'intellect'
                              )
                            : num(intellectChoiceConfig.attributePath)
                        )
                      : 0
                    const choices: string[] = Array.isArray(read(skillChoicePath, []))
                      ? read(skillChoicePath, [])
                      : []
                    const mainAllocations = Array.from(
                      { length: intellect },
                      (_, i) => choices[i] === extraChoiceValue
                        ? extraChoiceValue
                        : mainChoiceValue
                    )
                    const mainPoints = mainAllocations.filter(value => value === mainChoiceValue).length *
                      (intellectChoiceConfig?.pointsPerMainChoice ?? 0)
                    const extraLevels = mainAllocations.filter(value => value === extraChoiceValue).length
                    const defaultSkillLabels: Record<typeof skillKeys[number], string> = {
                      vigor: 'Vigor',
                      mental: 'Mental',
                      combat: 'Combate',
                      dexterity: 'Destreza',
                      resistance: 'Respiração',
                      ability: 'Habilidade',
                    }
                    const skillLabels = {
                      ...defaultSkillLabels,
                      ...(skillPointConfig?.skillLabels ?? {}),
                    }
                    const skillPointSources = skillPointConfig?.sources ?? []
                    const configuredAllocationOrder = skillPointConfig?.allocationOrder ?? []
                    const orderedSkillPointSources = [
                      ...configuredAllocationOrder
                        .map(id => skillPointSources.find(source => source.id === id))
                        .filter((source): source is typeof skillPointSources[number] => Boolean(source)),
                      ...skillPointSources.filter(source => !configuredAllocationOrder.includes(source.id)),
                    ]
                    const skillPool = (sourceId: string) => {
                      const source = skillPointSources.find(item => item.id === sourceId)
                      if (!source) return 0

                      if (source.pool === 'rankBenefits') {
                        const rankBenefitsText = getSystemRank(rankIdForStatus)?.benefits || ''
                        const pattern = source.rankBenefitsPattern || '(\\d+) pontos? de perícias?'
                        try {
                          return Number(rankBenefitsText.match(new RegExp(pattern, 'i'))?.[1] || 0)
                        } catch {
                          return 0
                        }
                      }

                      if (source.pool === 'intellectChoices') {
                        return mainPoints
                      }

                      if (source.pool === 'progressionFields') {
                        return (source.progressionPaths ?? []).reduce(
                          (total, path) => total + numRaw(path),
                          0
                        )
                      }

                      if (source.pool === 'fixed') {
                        return Math.max(0, Math.floor(source.fixedPoints ?? 0))
                      }

                      return 0
                    }
                    const skillAllocations = (source: string, key: typeof skillKeys[number]) =>
                      Math.max(0, Math.floor(Number(read(`skills.pointAllocations.${source}.${key}`, 0)) || 0))
                    const skillTotalUsed = (source: string) =>
                      skillKeys.reduce((sum, key) => sum + skillAllocations(source, key), 0)
                    const skillAllocatedTotal = (key: typeof skillKeys[number]) =>
                      skillPointSources.reduce((sum, source) => sum + skillAllocations(source.id, key), 0)
                    const setSkillAllocation = (key: typeof skillKeys[number], value: number) => {
                      const next = {
                        ...data,
                        skills: {
                          ...(data.skills || {}),
                          pointAllocations: { ...(data.skills?.pointAllocations || {}) },
                        },
                      }
                      let left = Math.max(0, Math.min(maxSkillLevel, Math.floor(Number(value) || 0)))

                      for (const source of orderedSkillPointSources) {
                        const otherSpent = skillKeys.reduce(
                          (sum, item) => sum + skillAllocations(source.id, item),
                          0
                        ) - skillAllocations(source.id, key)
                        const capacity = Math.max(0, skillPool(source.id) - otherSpent)
                        const assigned = Math.min(left, capacity)
                        next.skills.pointAllocations[source.id] = {
                          ...(next.skills.pointAllocations[source.id] || {}),
                          [key]: assigned,
                        }
                        left -= assigned
                      }

                      updateRenderDraft(JSON.stringify(next, null, 2))
                    }
                    const vigor = Math.min(maxSkillLevel, num('skills.vigor'))
                    const mental = Math.min(maxSkillLevel, num('skills.mental'))
                    const breathing = effectiveAttribute('attributes.breathing', 'breathing')
                    const ability = Math.min(maxSkillLevel, num('skills.ability'))
                    const defense = effectiveAttribute('attributes.defense', 'defense')
                    const reactions = defense + 1
                    const combat = Math.min(maxSkillLevel, num('skills.combat'))
                    const resistance = Math.min(maxSkillLevel, num('skills.resistance'))
                    const strength = effectiveAttribute('attributes.strength', 'strength')
                    const rankName = String(
                      read(
                        'progression.rankName',
                        getSystemRankName(rankIdForStatus)
                      )
                    )
const hierarchyGroup = findSystemRank(rankIdForStatus)?.group || ''
                    const equippedWeapon = renderInventoryItems.find(item => item.character_id === renderSubjectId && item.metadata?.equipped === true && Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))
                    const equippedWeaponDamage = equippedWeapon ? String(equippedWeapon.metadata?.weaponDamage || '—') : '—'
                    const equippedArmor = renderInventoryItems.find(item => item.character_id === renderSubjectId && item.metadata?.equipped === true && item.metadata?.equipmentType === 'armor')
                    const equippedCharacterItems: SheetCombatEquipment[] = renderInventoryItems
                      .filter(item => item.character_id === renderSubjectId && item.metadata?.equipped === true)
                      .map(item => ({
                        equipmentType: String(item.metadata?.equipmentType || 'none'),
                        armorClass: String(item.metadata?.armorClass || 'leve'),
                        armorCoverage: String(item.metadata?.armorCoverage || ''),
                        protectionTier: String(item.metadata?.protectionTier || 'basica'),
                        protectionMode: String(item.metadata?.protectionMode || 'resistencia'),
                      }))
                    const characterDefenses = calculateSheetDefenses(equippedCharacterItems, {
                      dexterity, resistance, combat, mental,
                    })
                    const {
                      armorClass, armorDexterity, counterAttackDT, armorResistance, armorCovers,
                      physicalProtection, sanityProtection,
                    } = characterDefenses
                    const baseDamage = activeSystem?.data?.damageByGroup?.[hierarchyGroup] ?? '—'
                    const criticalValue = Math.max(1, Math.min(20, Math.floor(num('combat.critical') || 20)))
                    const rollD20 = () => Math.floor(Math.random() * 20) + 1

const rollAttributeDice = (diceCount: number, usesAgility = false) => {
  const roll = rollSheetAttributeDice(diceCount, renderOverloaded && usesAgility)
  return {
    rolls: roll.rolls,
    selectedDice: roll.hasDisadvantage ? [roll.result] : roll.rolls,
    result: roll.result,
    effectiveDiceCount: roll.effectiveDiceCount,
    hasDisadvantage: roll.hasDisadvantage,
  }
}

const performCombatRoll = (
  kind: 'Ataque bruto' | 'Ataque ágil' | 'Ataque especial' | 'Tiro' | 'Disparo' | 'Bloqueio' | 'Esquiva',
  dodgeDt?: string
) => {
  const blockedAction = kind === 'Esquiva' ? 'dodge' : kind === 'Bloqueio' ? 'block' : (kind.startsWith('Ataque') || kind==='Tiro' || kind==='Disparo') ? 'attack' : ''
  const limitedByCondition = conditionRules.restrictions.includes('all_actions') ||
    (blockedAction === 'attack' && conditionRules.restrictions.includes('no_attacks')) ||
    ((blockedAction === 'block' || blockedAction === 'dodge') && conditionRules.restrictions.includes('no_reactions'))
  if (limitedByCondition) {
    setCombatActionResult(`${kind} indisponível: condição ativa limita as ações.`)
    setBlockDamageReduction(null)
    return
  }
  if (blockedAction && conditionRules.restrictions.includes(blockedAction)) {
    setCombatActionResult(`${kind} indisponível devido a uma condição ativa.`)
    setBlockDamageReduction(null)
    return
  }
  const target = dodgeDt !== undefined && dodgeDt.trim() !== '' ? Number(dodgeDt) : null
  const validTarget = target !== null && Number.isFinite(target) && target >= 0

const attribute =
  kind === 'Ataque bruto' ? strength :
  kind === 'Ataque ágil' || kind === 'Esquiva' ? agility :
  kind === 'Ataque especial' ? breathing :
  kind === 'Tiro' ? intellect :
  kind === 'Disparo' ? agility :
  defense

  const bonus =
    kind === 'Ataque bruto' || kind === 'Ataque ágil' ? combat :
    (kind === 'Ataque especial' || kind === 'Tiro' || kind === 'Disparo') ? ability :
    kind === 'Bloqueio' ? vigor + resistance :
    armorDexterity

  const diceKey = kind === 'Ataque bruto' ? 'strength' : kind === 'Ataque ágil' || kind === 'Esquiva' ? 'agility' : kind === 'Ataque especial' ? 'breathing' : kind === 'Tiro' ? 'intelligence' : kind === 'Disparo' ? 'agility' : 'defense'
  const diceGroup = (kind.startsWith('Ataque') || kind==='Tiro' || kind==='Disparo') ? 'attack' : kind === 'Bloqueio' ? 'block' : 'dodge'
  const diceBonus = conditionModifier(conditionRules.dice, 'status', diceKey) + conditionModifier(conditionRules.dice, 'combat_points', diceGroup)
  const diceCount = (kind === 'Tiro' ? 1 + Math.floor(intellect) : kind === 'Disparo' ? 1 + Math.floor(agility) : 1 + Math.floor(attribute)) + diceBonus
  const usesAgility = kind === 'Ataque ágil' || kind === 'Disparo' || kind === 'Esquiva'

  const roll = rollAttributeDice(diceCount, usesAgility)

  const dice = roll.rolls
  const highest = roll.result
  const preparationBonus = (kind.startsWith('Ataque') || kind==='Tiro' || kind==='Disparo') && (complexPending?.skill === ((kind === 'Ataque especial' || kind==='Tiro' || kind==='Disparo') ? 'Habilidade' : 'Combate')) ? (complexPending?.bonus || 0) : 0
  const conditionAttributeKey = kind === 'Ataque bruto' ? 'strength' : kind === 'Ataque ágil' || kind === 'Esquiva' ? 'agility' : kind === 'Ataque especial' ? 'breathing' : kind === 'Tiro' ? 'intelligence' : kind === 'Disparo' ? 'agility' : 'defense'
  const conditionCombatKey = (kind.startsWith('Ataque') || kind === 'Tiro' || kind === 'Disparo') ? 'attack' : kind === 'Bloqueio' ? 'block' : 'dodge'
  const attributeBase = kind === 'Ataque bruto' ? strength : kind === 'Ataque ágil' || kind === 'Esquiva' || kind === 'Disparo' ? agility : kind === 'Ataque especial' ? breathing : kind === 'Tiro' ? intellect : defense
  const conditionBonus = applyConditionModifier(attributeBase, conditionModifiers, 'status', conditionAttributeKey) - attributeBase
  const combatConditionBonus = applyConditionModifier(bonus, conditionModifiers, 'combat_points', conditionCombatKey) - bonus
  const total = highest + bonus + preparationBonus + conditionBonus + combatConditionBonus
  if ((kind.startsWith('Ataque') || kind==='Tiro' || kind==='Disparo') && complexPending && preparationBonus) setComplexPending(null)

  const diceDescriptionBase = roll.hasDisadvantage
    ? `${dice.length}D20 = [${dice.join(', ')}] (desvantagem) → ${highest}`
    : `${roll.effectiveDiceCount}D20 = [${dice.join(', ')}] (maior: ${highest})`
  const conditionTotal = conditionBonus + combatConditionBonus
  const diceDescription = `${diceDescriptionBase}${conditionTotal ? ` + Condições (${conditionTotal > 0 ? '+' : ''}${conditionTotal})` : ''}`
  if (kind === 'Bloqueio') {
    const critical = highest >= criticalValue
    const success = validTarget && total > target
    const reduction = !validTarget ? null : critical ? 1 : success ? 0.5 : 0.25
    const outcome = !validTarget
      ? 'Informe a DT do inimigo para determinar o resultado do bloqueio.'
      : critical
        ? `Crítico contra DT ${target}: nega 100% do dano.`
        : success
          ? `Sucesso contra DT ${target}: nega 50% do dano.`
          : `Falha contra DT ${target}: nega 25% do dano.`

    setBlockIncomingDamage('')
    setBlockDamageReduction(reduction)
    setCombatActionResult(
      `Bloqueio: ${diceDescription} + Vigor + Respiração (${bonus}) = ${total}. ${outcome}`
    )
  } else if (kind === 'Esquiva') {
    const target =
      dodgeDt !== undefined && dodgeDt.trim() !== ''
        ? Number(dodgeDt)
        : null

    const validTarget =
      target !== null &&
      Number.isFinite(target) &&
      target >= 0

    const outcome = validTarget
      ? total > target!
        ? `Sucesso contra DT ${target}: nega 100% do dano.`
        : `Falha contra DT ${target}: não evita o dano.`
      : 'Informe a DT do inimigo no campo ao lado do botão Esquiva.'

    setBlockDamageReduction(
  validTarget && total > target! ? 1 : 0
)

    setCombatActionResult(
      `Esquiva: ${diceDescription} + Destreza de armadura (${bonus}) = ${total}. ${outcome}`
    )
  } else {
    setBlockDamageReduction(null)

    const bonusName =
      (kind === 'Ataque especial' || kind==='Tiro' || kind==='Disparo') ? 'Habilidade' : 'Combate'

    setCombatActionResult(
      `${kind}: ${diceDescription} + ${bonusName} (${bonus})${preparationBonus ? ` + Preparo (+${preparationBonus})` : ''} = ${total}.`
    )
  }

  return total
}
              const applyBlockedDamage = () => {
                      const incoming = Number(blockIncomingDamage)

                      if (!Number.isFinite(incoming) || incoming < 0 || blockDamageReduction === null) {
                        setError('Informe um dano inimigo válido (zero ou maior).')
                        return
                      }

                      // O mesmo cálculo é usado pelos inimigos e personagens.
                      const { reactionPrevented, armorPrevented, remaining, totalPrevented } =
                        calculateSheetPhysicalDamage({
                          incoming,
                          reactionReduction: blockDamageReduction,
                          damageType: blockPhysicalDamageType,
                          defenses: characterDefenses,
      specialBruteProtectionOnly: isKisatsutaiSystem,
                        })

                      const currentStatus = data.status && typeof data.status === 'object' && !Array.isArray(data.status)
                        ? data.status as Record<string, any>
                        : {}

                      const currentValues = currentStatus.current && typeof currentStatus.current === 'object'
                        ? currentStatus.current as Record<string, any>
                        : {}

                      const maxPV = Number(derived[0][1]) || 0
                      const currentPVValue = Number(currentValues.pv ?? maxPV)
                      const currentPV = Number.isFinite(currentPVValue) ? Math.max(0, currentPVValue) : maxPV
                      const nextPV = Math.max(0, currentPV - remaining)

                      const next = {
                        ...data,
                        status: {
                          ...currentStatus,
                          current: {
                            ...currentValues,
                            pv: nextPV,
                            ps: Number(currentValues.ps ?? derived[1][1]),
                            pr: Number(currentValues.pr ?? derived[2][1]),
                          },
                        },
                      }

                      updateRenderDraft(JSON.stringify(next, null, 2))
                      void persistRenderConditions(next)

                      setCombatActionResult(
                        previous => `${previous} Dano recebido: ${incoming}. Dano negado pela reação: ${reactionPrevented}. Dano reduzido pela armadura e proteções: ${armorPrevented}. Redução total: ${totalPrevented}. Dano aplicado aos PV: ${remaining}. PV restantes: ${nextPV}.`
                      )

                      setBlockDamageReduction(null)
                      setBlockIncomingDamage('')
                      setError('')
                    }

                    const rankStatus = systemFeatures?.usesRanks
                      ? getSystemRankStatus(rankIdForStatus)
                      : { pv: 0, ps: 0, pr: 0 }
                    const customClassPV = num('progression.classStatus.pv')
                    const customClassPS = num('progression.classStatus.ps')
                    const customClassPR = num('progression.classStatus.pr')
                    const classPV = rankStatus.pv + customClassPV
                    const classPS = rankStatus.ps + customClassPS
                    const classPR = rankStatus.pr + customClassPR
                    const progressionPV = num('progression.statusBonuses.pv')
                    const progressionPS = num('progression.statusBonuses.ps')
                    const progressionPR = num('progression.statusBonuses.pr')
                    const familyPV = usesFamilyTiers ? familyTierData.pv : 0
                    const familyPS = usesFamilyTiers ? familyTierData.ps : 0
                    const familyPR = usesFamilyTiers ? familyTierData.pr : 0
                    const sharedResourceMaximums = calculateSheetResourceMaximums(data, {
                      skillPointConfig,
                      usesFamilyTiers,
                      familyTier: familyTierData,
                      familyBreathingBonus: usesFamilyTiers
                        ? getSystemAttributeBonus(familyTierKey, 'breathing') : 0,
                      rankStatus,
                    })
                    const conditionResourceMaximum = (key: 'pv' | 'ps' | 'pr', base: number) => {
                      if (forEnemy) return base
                      const flat = conditionRules.resources[`resource:${key}`] || 0
                      const percent = conditionRules.resourcePercent[`resource:${key}`] || 0
                      return Math.max(0, Math.round((base + flat) * (1 + percent / 100)))
                    }
                    const derived = [
                      ['Pontos de Vida (PV)', conditionResourceMaximum('pv', sharedResourceMaximums.pv), `Vigor × 10 (${vigor * 10}) + família (${familyPV}) + classe (${classPV}) + progressão (${progressionPV})`],
                      ['Pontos de Sanidade (PS)', conditionResourceMaximum('ps', sharedResourceMaximums.ps), `Mental × 10 (${mental * 10}) + família (${familyPS}) + classe (${classPS}) + progressão (${progressionPS})`],
                      [sheetResourcePointsLabel, conditionResourceMaximum('pr', sharedResourceMaximums.pr), `(${sheetResourceName} + Habilidade) × 10 + família (${familyPR}) + classe (${classPR}) + progressão (${progressionPR})`],
                    ] as const
const field = (path: string, label: string, type: 'number' | 'text' = 'number', hint?: string) => {
  const limit = path.startsWith('attributes.')
    ? 5
    : path.startsWith('skills.')
      ? maxSkillLevel
      : undefined

  return (
    <label key={path} style={{...labelStyle, display:'flex', flexDirection:'column', gap:6}}>
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? limit : undefined}
        step="1"
        value={String(read(path, type === 'number' ? 0 : ''))}
        onChange={e => write(
          path,
          type === 'number'
            ? Math.min(limit ?? 999, Math.max(0, e.target.value === '' ? 0 : Number(e.target.value)))
            : e.target.value
        )}
        style={inputStyle}
      />
      {hint && <small style={{color:'var(--season-muted, #b9b4c2)'}}>{hint}{limit ? ` · máximo ${limit}` : ''}</small>}
    </label>
  )
}
                    const area = (path: string, label: string) => <label key={path} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{label}<textarea rows={3} value={String(read(path, ''))} onChange={e=>write(path,e.target.value)} style={{...inputStyle,fontFamily:'inherit',resize:'vertical'}}/></label>
                    const panel = (title: string, children: any) => {
                      const panelIcon = title.includes('Identidade') ? '✦'
                        : title.includes('Status') ? '♥'
                        : title.includes('Combate') ? '⚔'
                        : title.includes('Fluxos') ? '〰'
                        : title.includes('Habilidades') ? '✧' : '✎'
                      return <details className="sheet-editor-accordion sheet-editor-premium">
                        <summary><span className="sheet-editor-icon" aria-hidden="true">{panelIcon}</span><span className="sheet-editor-title">{title}</span><span className="sheet-editor-expand">Expandir detalhes</span></summary>
                        <div className="sheet-editor-fields">{children}</div>
                      </details>
                    }



                    // Mesmo painel visual para personagens e inimigos, acima do inventário.
                    // O seletor preserva a função de equipar usada no combate.
                    if (section === 'armor') {
                      const availableArmors = renderInventoryItems.filter(item =>
                        item.character_id === renderSubjectId && item.metadata?.equipmentType === 'armor'
                      )
                      const protectionItems = renderInventoryItems.filter(item =>
                        item.character_id === renderSubjectId &&
                        item.metadata?.equipmentType === 'protection' && item.metadata?.equipped === true
                      )
                      const armorClassLabel = armorClass === 'pesada' ? 'Pesada' : armorClass === 'media' ? 'Média' : 'Leve'
                      const armorCoverageLabel = !equippedArmor ? 'Nenhuma'
                        : armorCovers('cortante_perfurante') && armorCovers('especial_bruto') ? 'Completa'
                        : armorCovers('especial_bruto') ? 'Especial / bruto'
                        : armorCovers('cortante_perfurante') ? 'Cortante / perfurante'
                        : 'Não definida'
                      const dexterityLoss = Math.max(0, dexterity - armorDexterity)
                      return (
                        <>
                        {!forEnemy && selectedCampaignId && selectedCharacterId && <CharacterConditions campaignId={selectedCampaignId} characterId={selectedCharacterId} />}
                        {forEnemy && selectedCampaignId && selectedEnemyId && <EnemyConditions campaignId={selectedCampaignId} enemyId={selectedEnemyId} />}
                        <section
                          className="combat-armor-panel sheet-armor-standalone sheet-armor-premium"
                          id={forEnemy ? 'inimigo-armadura-protecao' : 'ficha-armadura-protecao'}
                          aria-label="Armadura e proteção"
                        >
                          <style>{`
                            .sheet-armor-premium {
                              --armor-muted: var(--season-muted, #aab0bb);
                              --armor-text: var(--season-text, #eff2f5);
                              --armor-border: var(--season-line, rgba(255,255,255,.13));
                              display: block;
                              position: relative;
                              overflow: hidden;
                              isolation: isolate;
                              margin: 20px 0 22px;
                              padding: clamp(18px, 2.4vw, 28px);
                              border-radius: 20px;
                              border: 1px solid var(--armor-border);
                              color: var(--armor-text);
                              background: linear-gradient(135deg, var(--season-surface-alt, #1d2027), var(--season-surface, #171a20) 68%);
                              box-shadow: 0 12px 32px rgba(0,0,0,.13);
                            }
                            .sheet-armor-premium::before {
                              content: '';
                              position: absolute;
                              top: 0;
                              left: 22px;
                              right: 22px;
                              height: 2px;
                              background: linear-gradient(90deg, var(--season-primary, #98bd9a), transparent 70%);
                              opacity: .8;
                              pointer-events: none;
                            }
                            .sheet-armor-premium .armor-panel-header {
                              display: flex;
                              align-items: flex-start;
                              justify-content: space-between;
                              flex-wrap: wrap;
                              gap: 14px;
                              margin-bottom: 20px;
                            }
                            .sheet-armor-premium .armor-title-wrap {display: flex; gap: 13px; min-width: 0; align-items: center;}
                            .sheet-armor-premium .armor-title-icon {
                              width: 48px;
                              height: 48px;
                              flex: 0 0 48px;
                              display: grid;
                              place-items: center;
                              border-radius: 15px;
                              color: var(--season-primary, #98bd9a);
                              background: color-mix(in srgb, var(--season-primary, #98bd9a) 12%, transparent);
                              border: 1px solid color-mix(in srgb, var(--season-primary, #98bd9a) 30%, transparent);
                            }
                            .sheet-armor-premium .armor-eyebrow {
                              display: block;
                              margin-bottom: 5px;
                              font-size: 10px;
                              font-weight: 800;
                              letter-spacing: .14em;
                              text-transform: uppercase;
                              color: var(--season-primary, #98bd9a);
                            }
                            .sheet-armor-premium h3 {font-size: clamp(20px, 2.4vw, 25px); margin: 0; line-height: 1.18;}
                            .sheet-armor-premium .armor-panel-description {
                              font-size: 12px;
                              margin: 7px 0 0;
                              line-height: 1.55;
                              color: var(--armor-muted);
                            }
                            .sheet-armor-premium .armor-status-pill {
                              display: inline-flex;
                              align-items: center;
                              gap: 8px;
                              padding: 9px 12px;
                              border-radius: 999px;
                              border: 1px solid var(--armor-border);
                              background: color-mix(in srgb, var(--season-bg, #11151a) 65%, transparent);
                              font-size: 11px;
                              font-weight: 750;
                              white-space: nowrap;
                            }
                            .sheet-armor-premium .armor-status-dot {
                              width: 7px;
                              height: 7px;
                              border-radius: 50%;
                              background: var(--season-primary, #98bd9a);
                              box-shadow: 0 0 0 3px color-mix(in srgb, var(--season-primary, #98bd9a) 15%, transparent);
                            }
                            .sheet-armor-premium .armor-status-pill.is-empty .armor-status-dot {
                              background: var(--armor-muted);
                              box-shadow: none;
                            }
                            .sheet-armor-premium .armor-equipment-grid {
                              display: grid;
                              grid-template-columns: minmax(0, 1.3fr) minmax(255px, .9fr);
                              gap: 12px;
                              margin-bottom: 13px;
                            }
                            .sheet-armor-premium .armor-equipped-card,
                            .sheet-armor-premium .armor-select-card {
                              min-width: 0;
                              border-radius: 15px;
                              border: 1px solid var(--armor-border);
                              padding: 18px;
                            }
                            .sheet-armor-premium .armor-equipped-card {
                              background: linear-gradient(115deg, color-mix(in srgb, var(--season-primary, #98bd9a) 10%, var(--season-surface, #171a20)), var(--season-surface, #171a20));
                              display: flex;
                              gap: 15px;
                              align-items: center;
                            }
                            .sheet-armor-premium .armor-equipped-emblem {
                              width: 62px;
                              height: 62px;
                              flex: 0 0 62px;
                              display: grid;
                              place-items: center;
                              border-radius: 18px;
                              color: var(--season-primary, #98bd9a);
                              background: color-mix(in srgb, var(--season-primary, #98bd9a) 12%, transparent);
                              border: 1px solid color-mix(in srgb, var(--season-primary, #98bd9a) 28%, transparent);
                            }
                            .sheet-armor-premium .armor-small-label {
                              color: var(--armor-muted);
                              display: block;
                              font-size: 10px;
                              font-weight: 800;
                              text-transform: uppercase;
                              letter-spacing: .1em;
                            }
                            .sheet-armor-premium .armor-equipped-name {
                              display: block;
                              margin: 7px 0 10px;
                              overflow-wrap: anywhere;
                              font-size: clamp(17px, 2vw, 22px);
                              line-height: 1.2;
                              font-weight: 800;
                            }
                            .sheet-armor-premium .armor-equipment-tags {display: flex; flex-wrap: wrap; gap: 7px;}
                            .sheet-armor-premium .armor-equipment-tags span {
                              padding: 5px 9px;
                              border-radius: 7px;
                              font-size: 11px;
                              font-weight: 700;
                              color: var(--armor-text);
                              background: color-mix(in srgb, var(--season-primary, #98bd9a) 13%, transparent);
                              border: 1px solid color-mix(in srgb, var(--season-primary, #98bd9a) 22%, transparent);
                            }
                            .sheet-armor-premium .armor-select-card {
                              display: flex;
                              flex-direction: column;
                              gap: 8px;
                              justify-content: center;
                              background: color-mix(in srgb, var(--season-bg, #11151a) 45%, transparent);
                            }
                            .sheet-armor-premium .armor-select-card label {font-size: 12px; font-weight: 750;}
                            .sheet-armor-premium .armor-select-card select {
                              width: 100%;
                              min-width: 0;
                              height: 43px;
                              border-radius: 10px;
                              padding: 0 12px;
                              background: var(--season-surface, #171a20);
                              color: var(--armor-text);
                              border: 1px solid var(--armor-border);
                              font: inherit;
                              font-size: 13px;
                              font-weight: 650;
                            }
                            .sheet-armor-premium .armor-select-card select:focus-visible {
                              outline: 2px solid var(--season-primary, #98bd9a);
                              outline-offset: 2px;
                            }
                            .sheet-armor-premium .armor-select-card select:disabled {cursor: not-allowed; opacity: .65;}
                            .sheet-armor-premium .armor-select-card small {font-size: 11px; line-height: 1.5; color: var(--armor-muted);}
                            .sheet-armor-premium .armor-stats-grid {
                              display: grid;
                              grid-template-columns: repeat(4, minmax(0, 1fr));
                              gap: 11px;
                            }
                            .sheet-armor-premium .armor-stat {
                              position: relative;
                              min-width: 0;
                              display: flex;
                              flex-direction: column;
                              align-items: flex-start;
                              padding: 17px 16px 15px;
                              border-radius: 14px;
                              border: 1px solid var(--armor-border);
                              background: color-mix(in srgb, var(--season-bg, #11151a) 38%, var(--season-surface, #171a20));
                              transition: border-color .18s ease, transform .18s ease;
                            }
                            .sheet-armor-premium .armor-stat:hover {
                              border-color: color-mix(in srgb, var(--season-primary, #98bd9a) 45%, var(--armor-border));
                              transform: translateY(-2px);
                            }
                            .sheet-armor-premium .armor-stat-icon {
                              display: grid;
                              place-items: center;
                              width: 33px;
                              height: 33px;
                              border-radius: 10px;
                              margin-bottom: 11px;
                              color: var(--season-primary, #98bd9a);
                              font-size: 19px;
                              background: color-mix(in srgb, var(--season-primary, #98bd9a) 11%, transparent);
                            }
                            .sheet-armor-premium .armor-stat-label {
                              font-size: 11px;
                              line-height: 1.3;
                              font-weight: 650;
                              color: var(--armor-muted);
                              min-height: 28px;
                            }
                            .sheet-armor-premium .armor-stat-number {
                              display: block;
                              margin: 4px 0 7px;
                              font-size: clamp(26px, 3vw, 34px);
                              line-height: 1;
                              letter-spacing: -.04em;
                              font-weight: 850;
                              color: var(--armor-text);
                              font-variant-numeric: tabular-nums;
                            }
                            .sheet-armor-premium .armor-stat-note {
                              font-size: 10px;
                              color: var(--armor-muted);
                              line-height: 1.5;
                            }
                            .sheet-armor-premium .armor-footnote {
                              display: flex;
                              align-items: center;
                              gap: 8px;
                              margin-top: 15px;
                              padding: 11px 13px;
                              border-radius: 10px;
                              border: 1px dashed var(--armor-border);
                              font-size: 11px;
                              line-height: 1.5;
                              color: var(--armor-muted);
                            }
                            .sheet-armor-premium .armor-footnote strong {color: var(--armor-text); font-weight: 750;}
                            @media (max-width: 900px) {
                              .sheet-armor-premium .armor-equipment-grid {grid-template-columns: minmax(0, 1fr);}
                              .sheet-armor-premium .armor-stats-grid {grid-template-columns: repeat(2, minmax(0, 1fr));}
                            }
                            @media (max-width: 480px) {
                              .sheet-armor-premium {padding: 16px; border-radius: 16px;}
                              .sheet-armor-premium .armor-title-icon {width: 42px; height: 42px; flex-basis: 42px;}
                              .sheet-armor-premium .armor-equipped-emblem {width: 49px; height: 49px; flex-basis: 49px;}
                              .sheet-armor-premium .armor-equipped-card {padding: 14px; gap: 12px;}
                              .sheet-armor-premium .armor-stat {padding: 13px 12px;}
                              .sheet-armor-premium .armor-stat-number {font-size: 27px;}
                            }
                            @media (prefers-reduced-motion: reduce) {
                              .sheet-armor-premium .armor-stat {transition: none;}
                              .sheet-armor-premium .armor-stat:hover {transform: none;}
                            }
                          `}</style>
                          <header className="armor-panel-header">
                            <div className="armor-title-wrap">
                              <span className="armor-title-icon" aria-hidden="true">
                                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                                  <path d="m9 12 2 2 4-4"/>
                                </svg>
                              </span>
                              <div>
                                <span className="armor-eyebrow">Defesa e equipamentos</span>
                                <h3>Armadura e proteção</h3>
                                <p className="armor-panel-description">Resistências e proteções calculadas pelos itens equipados.</p>
                              </div>
                            </div>
                            <div className={`armor-status-pill${equippedArmor ? '' : ' is-empty'}`}>
                              <span className="armor-status-dot" aria-hidden="true" />
                              {equippedArmor ? 'Armadura equipada' : 'Sem armadura equipada'}
                            </div>
                          </header>

                          <div className="armor-equipment-grid">
                            <div className="armor-equipped-card">
                              <div className="armor-equipped-emblem" aria-hidden="true">
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                                  <path d="M12 6v12M7 12h10"/>
                                </svg>
                              </div>
                              <div style={{minWidth:0}}>
                                <span className="armor-small-label">Equipamento defensivo atual</span>
                                <strong className="armor-equipped-name">{equippedArmor?.name || 'Nenhuma armadura'}</strong>
                                <div className="armor-equipment-tags">
                                  {equippedArmor ? (
                                    <>
                                      <span>Classe {armorClassLabel}</span>
                                      <span>Cobertura: {armorCoverageLabel}</span>
                                    </>
                                  ) : <span>Equipe uma armadura para obter resistência</span>}
                                </div>
                              </div>
                            </div>
                            <div className="armor-select-card">
                              <span className="armor-small-label">Gerenciar equipamento</span>
                              <label htmlFor={forEnemy ? 'enemy-combat-armor-select' : 'character-combat-armor-select'}>Armadura em combate</label>
                              <select
                                id={forEnemy ? 'enemy-combat-armor-select' : 'character-combat-armor-select'}
                                value={equippedArmor?.id || ''}
                                disabled={!renderCanEdit}
                                onChange={event => void updateCombatArmor(event.target.value)}
                              >
                                <option value="">Sem armadura</option>
                                {availableArmors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                              <small>{availableArmors.length === 0
                                ? 'Adicione uma armadura ao inventário para equipá-la aqui.'
                                : renderCanEdit ? 'Selecione um item do inventário para atualizar a defesa.'
                                : 'Visualização do equipamento defensivo atual.'}</small>
                            </div>
                          </div>

                          <div className="armor-stats-grid" aria-label="Indicadores de defesa">
                            <article className="armor-stat">
                              <span className="armor-stat-icon" aria-hidden="true">↗</span>
                              <span className="armor-stat-label">Destreza de armadura</span>
                              <strong className="armor-stat-number">{armorDexterity}</strong>
                              <small className="armor-stat-note">{dexterityLoss > 0 ? `Base ${dexterity} · penalidade −${dexterityLoss}` : `Base ${dexterity} · sem penalidade`}</small>
                            </article>
                            <article className="armor-stat">
                              <span className="armor-stat-icon" aria-hidden="true">⛨</span>
                              <span className="armor-stat-label">Resistência da armadura</span>
                              <strong className="armor-stat-number">{equippedArmor ? armorResistance : 0}</strong>
                              <small className="armor-stat-note">{equippedArmor ? `Cobertura ${armorCoverageLabel.toLocaleLowerCase('pt-BR')}` : 'Sem armadura equipada'}</small>
                            </article>
                            <article className="armor-stat">
                              <span className="armor-stat-icon" aria-hidden="true">✣</span>
                              <span className="armor-stat-label">{isKisatsutaiSystem ? 'Proteção especial / bruto' : 'Proteção física'}</span>
                              <strong className="armor-stat-number">{physicalProtection}</strong>
                              <small className="armor-stat-note">{protectionItems.filter(item => item.metadata?.protectionMode !== 'sanidade').length} proteção(ões) equipada(s)</small>
                            </article>
                            <article className="armor-stat">
                              <span className="armor-stat-icon" aria-hidden="true">✧</span>
                              <span className="armor-stat-label">Proteção de sanidade</span>
                              <strong className="armor-stat-number">{sanityProtection}</strong>
                              <small className="armor-stat-note">{protectionItems.filter(item => item.metadata?.protectionMode === 'sanidade').length} proteção(ões) equipada(s)</small>
                            </article>
                          </div>
                          <div className="armor-footnote">
                            <span aria-hidden="true">ⓘ</span>
                            <span><strong>Como funciona:</strong> a resistência da armadura depende da cobertura do item. {isKisatsutaiSystem
                              ? 'As proteções físicas do Kisatsutai reduzem dano especial / bruto.'
                              : 'As proteções físicas complementam a redução de dano.'} A proteção de sanidade é calculada separadamente.</span>
                          </div>
                        </section>
                        {isKisatsutaiSystem && (
                          <TrainedSkillsSummary
                            trainings={(read('skills.extraTrainings', {}) || {}) as Record<string, string>}
                            forEnemy={forEnemy}
                            kitNames={forEnemy ? [] : items.filter(item => item.character_id === selectedCharacterId).map(item => item.name)}
                            modifiers={forEnemy ? {} : conditionModifiers}
                            pending={forEnemy ? null : complexPending}
                          />
                        )}
                        {(() => {
                          const legacyTeam = String(read('identity.team', '') || read('identity.teamName', '')).trim()
                          const storedTeams = read('identity.teams', [])
                          const teams = Array.from(new Set([
                            ...(Array.isArray(storedTeams) ? storedTeams.filter((value): value is string => typeof value === 'string') : []),
                            ...(legacyTeam ? [legacyTeam] : []),
                          ].map(value => value.trim()).filter(Boolean)))
                          const updateTeams = (next: string[]) => {
                            const unique = Array.from(new Set(next.map(value => value.trim()).filter(Boolean)))
                            write('identity.teams', unique)
                            write('identity.team', unique[0] ?? '')
                          }
                          return <div className="hb-sheet-team-indicator hb-sheet-team-multi">
                            <div className="hb-team-identity"><span className="hb-team-crest" aria-hidden="true">🛡️</span><div><span className="hb-team-eyebrow">EQUIPES DO PERSONAGEM</span><strong>{teams.length ? `${teams.length} equipe${teams.length > 1 ? 's' : ''}` : 'Sem equipe'}</strong></div></div>
                            <div className="hb-team-memberships">
                              {teams.map(name => <span key={name} className="hb-team-membership">🛡️ {name}{isMaster && <button type="button" aria-label={`Remover da equipe ${name}`} title={`Remover da equipe ${name}`} onClick={() => updateTeams(teams.filter(item => item !== name))}>×</button>}</span>)}
                              {!teams.length && <span className="hb-team-empty">Nenhuma equipe atribuída</span>}
                            </div>
                            {isMaster && <div className="hb-team-controls">
                              <label className="hb-team-field"><span>Adicionar equipe existente</span><select aria-label="Adicionar equipe existente" value="" onChange={event => {if(event.target.value)updateTeams([...teams,event.target.value])}}><option value="">Selecionar equipe</option>{sheetTeams.filter(name => !teams.includes(name)).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
                              <form className="hb-team-add-form" onSubmit={event => {event.preventDefault();const input=event.currentTarget.elements.namedItem('newTeam') as HTMLInputElement | null;const value=input?.value.trim();if(value){updateTeams([...teams,value]);if(input)input.value=''}}}>
                                <label className="hb-team-field"><span>Criar / adicionar equipe</span><input name="newTeam" aria-label="Nome da nova equipe" list="hax-sheet-teams" placeholder="Nome da equipe" maxLength={80} /></label>
                                <button type="submit" className="hb-team-add-button">+ Adicionar</button>
                              </form>
                              <datalist id="hax-sheet-teams">{sheetTeams.map(name => <option key={name} value={name} />)}</datalist>
                            </div>}
                          </div>
                        })()}
                        </>
                      )
                    }

                    return (
                      <>
  {systemFeatures?.usesRanks && (
    <section
      aria-label="Graduação atual"
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 20px',
        margin: '0 0 18px',
        border: '1px solid var(--season-line, rgba(255,255,255,.12))',
        borderRadius: 16,
        background: 'linear-gradient(115deg, var(--season-surface, #19151d) 0%, var(--season-bg, #100e19) 100%)',
        boxShadow: '0 8px 24px rgba(0,0,0,.16)',
      }}
    >
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 4, background: 'var(--season-accent, #e58a36)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 46, height: 46, flex: '0 0 46px', display: 'grid', placeItems: 'center',
          borderRadius: 13, border: '1px solid var(--season-line, rgba(255,255,255,.14))',
          background: 'var(--season-surface-alt, rgba(255,255,255,.06))',
          color: 'var(--season-accent, #e58a36)', fontSize: 22, fontWeight: 800,
        }}>✦</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <small style={{ color: 'var(--season-muted, #b9b4c2)', fontSize: 10, fontWeight: 800, letterSpacing: '1.5px' }}>GRADUAÇÃO ATUAL</small>
            <span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--season-accent, #e58a36)' }} />
            <small style={{ color: 'var(--season-muted, #b9b4c2)', fontSize: 10, fontWeight: 700, letterSpacing: '.7px' }}>
  {activeSystem?.name?.toUpperCase() ?? 'SISTEMA PERSONALIZADO'}
</small>
          </div>
          <h2 style={{ margin: 0, color: 'var(--season-text, inherit)', fontSize: 'clamp(20px, 3vw, 26px)', lineHeight: 1.15, fontWeight: 850, overflowWrap: 'anywhere' }}>{rankName}</h2>
          <div style={{ marginTop: 5, color: 'var(--season-muted, #b9b4c2)', fontSize: 12 }}>
  Progressão {forEnemy ? 'do inimigo' : 'do personagem'}
</div>
        </div>
      </div>
      <div style={{ flex: '0 0 auto', alignSelf: 'stretch', display: 'flex', alignItems: 'center', paddingLeft: 12, borderLeft: '1px solid var(--season-line, rgba(255,255,255,.12))', color: 'var(--season-accent, #e58a36)', fontSize: 11, fontWeight: 800, letterSpacing: '.8px', textAlign: 'right' }}>PROGRESSÃO<br/>ATUAL</div>
    </section>
  )}
                      {renderEditing && renderCanEdit ? (<fieldset
                        disabled={!renderEditing || !renderCanEdit}
                        className="character-sheet-editor sheet-editor-layout"
                        id={forEnemy ? 'inimigo-edicao' : 'ficha-edicao'}
                        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                      >
                      {!forEnemy && selectedCharacter && (
                  <section className="sheet-current-player-panel" aria-labelledby="sheet-current-player-heading">
                    <div className="sheet-current-player-info">
                      <span className="sheet-current-player-icon" aria-hidden="true">♙</span>
                      <div>
                        <span className="sheet-page-eyebrow">PERSONAGEM</span>
                        <h3 id="sheet-current-player-heading">Jogador atribuído</h3>
                        <p>{isMaster ? "Escolha quem controla este personagem. A atribuição também é usada na Party do Escudo do Mestre." : "Jogador responsável por este personagem."}</p>
                      </div>
                    </div>
                    {isMaster ? (
                    <label className="sheet-current-player-field" htmlFor="sheet-character-current-player">
                      <span>Jogador atribuído</span>
                      <select
                        id="sheet-character-current-player"
                        value={selectedCharacter.current_player_id ?? ''}
                        onChange={(event) => void changeCharacterPlayer(event.target.value)}
                        disabled={visibilitySaving}
                      >
                        <option value="">Sem jogador atribuído</option>
                        {campaignMembers.map(member => (
                          <option key={member.user_id} value={member.user_id}>{member.display_name}{member.role === 'master' ? ' (Mestre)' : ''}{member.user_id === session?.user.id ? ' · Você' : ''}</option>
                        ))}
                      </select>
                      {session?.user.id && campaignMembers.some(member => member.user_id === session!.user.id) && selectedCharacter.current_player_id !== session!.user.id && (
                        <button type="button" className="btn btn-secondary" disabled={visibilitySaving} onClick={() => void changeCharacterPlayer(session!.user.id)}>
                          ♙ Atribuir a mim
                        </button>
                      )}
                    </label>
                    ) : (
                      <div className="sheet-current-player-field">
                        <span>Jogador atribuído</span>
                        <strong>{campaignMembers.find(member => member.user_id === (selectedCharacter.current_player_id || selectedCharacter.user_id))?.display_name || (selectedCharacter.current_player_id === session?.user.id || (!selectedCharacter.current_player_id && selectedCharacter.user_id === session?.user.id) ? 'Você' : 'Jogador não encontrado')}</strong>
                      </div>
                    )}
                  </section>
                )}
                      {(() => {
                        const system = forEnemy ? (selectedCampaign?.system_name || '') : String(read('progression.system', selectedCampaign?.system_name || ''))
                        const systemFeatures = getSystemByName(system)?.data?.features

                        const usesRanks = systemFeatures?.usesRanks ?? false
                        const usesFamilyTiers = systemFeatures?.usesFamilyTiers ?? false

                        const tierKey = String(read('family.tier', '5'))
                        const tier = usesFamilyTiers
                          ? getSystemFamilyTier(tierKey) ?? {
                              pv: 0,
                              ps: 0,
                              pr: 0,
                              strength: 0,
                              agility: 0,
                              defense: 0,
                              breathing: 0,
                              intellect: 0,
                              points: 0,
                              focus: '',
                              label: '',
                            }
                          : {
                              pv: 0,
                              ps: 0,
                              pr: 0,
                              strength: 0,
                              agility: 0,
                              defense: 0,
                              breathing: 0,
                              intellect: 0,
                              points: 0,
                              focus: '',
                              label: '',
                            }
                        const rankId = String(read('progression.rankId', 'zaidan'))
                        const rank = getSystemRank(rankId)
const rankAttributePoints = Math.max(
  0,
  Math.floor(
    Number(
      getSystemByName(system)?.logic?.getRankAttributePoints?.(rankId) ?? 0
    )
  )
)
const allocationPool = (source: typeof allocationSources[number]) => {
  if (source === 'family') {
    return usesFamilyTiers
      ? Math.max(0, Math.floor(Number(tier.points) || 0))
      : 0
  }

  if (source === 'hierarchy') {
    return rankAttributePoints
  }

  return (
    numRaw('progression.extraAttributePoints') +
    numRaw('progression.attributePoints') +
    numRaw('progression.manualExtraAttributePoints') +
    voluntaryAttributeCredit
  )
}
                        const promotionLog: any[] = Array.isArray(read('progression.promotionLog', [])) ? read('progression.promotionLog', []) : []
                        const benefitsApplied: string[] = Array.isArray(read('progression.appliedPromotionIds', [])) ? read('progression.appliedPromotionIds', []) : []
          const changeRank = (nextId: string) => {
  const transition = getSystemPromotionId(rankId, nextId)

  if (hasSystemPromotion(promotionLog, transition)) {
    setError('Esta promoção já está registrada no histórico. Confira o registro existente para evitar duplicar benefícios.')
    return
  }

  const description = window.prompt(
    'Descrição desta promoção (motivo, missão, observações):',
    ''
  ) ?? ''

  const promotionEntry = createSystemPromotionEntry(
    rankId,
    nextId,
    `${Date.now()}-${transition}`,
    new Date().toISOString(),
    description
  )

  const oldRankStatus = getSystemRankStatus(rankId)
  const newRankStatus = getSystemRankStatus(nextId)

  const pvGain = newRankStatus.pv - oldRankStatus.pv
  const psGain = newRankStatus.ps - oldRankStatus.ps
  const prGain = newRankStatus.pr - oldRankStatus.pr

  const oldMaxPV = Number(derived[0][1]) || 0
  const oldMaxPS = Number(derived[1][1]) || 0
  const oldMaxPR = Number(derived[2][1]) || 0

  const newMaxPS = oldMaxPS + psGain
  const newMaxPR = oldMaxPR + prGain

  const currentStatus = data.status?.current || {}

  const currentPV = Number(currentStatus.pv ?? oldMaxPV) || 0
  const currentPS = Number(currentStatus.ps ?? oldMaxPS) || 0
  const currentPR = Number(currentStatus.pr ?? oldMaxPR) || 0

  const next = {
    ...data,
    progression: {
      ...(data.progression || {}),
      rankId: nextId,
      rankName: promotionEntry.to,
      promotionLog: [
        ...promotionLog,
        {
          ...promotionEntry,
          applied: true,
        },
      ],
      appliedPromotionIds: Array.from(
        new Set([...benefitsApplied, transition])
      ),
    },
    status: {
      ...(data.status || {}),
      current: {
        ...currentStatus,
        pv: Math.max(0, currentPV + pvGain),
        ps: Math.max(0, Math.min(newMaxPS, currentPS + psGain)),
        pr: Math.max(0, Math.min(newMaxPR, currentPR + prGain)),
      },
    },
  }

  updateRenderDraft(JSON.stringify(next, null, 2))
}
                        return <section className="sheet-editor-manager">
                          <div className="sheet-editor-manager-title"><span aria-hidden="true">✦</span><div><small>DESENVOLVIMENTO DO PERSONAGEM</small><h3>Família, classe e progressão</h3><p>Configure hierarquia, atributos e distribuições de pontos.</p></div></div>
                                                    <label style={labelStyle}>
                            Sistema de progressão
                            <select
                              value={system}
                              disabled={forEnemy}
                              onChange={e => write('progression.system', e.target.value)}
                              style={inputStyle}
                            >
                              <option value="">Selecione um sistema</option>
                              {getRegisteredSystems().map(registeredSystem => (
                                <option
                                  key={registeredSystem.id}
                                  value={registeredSystem.name}
                                >
                                  {registeredSystem.name}
                                </option>
                              ))}
                              <option value="Personalizado">Personalizado</option>
                            </select>
                          </label>
                          {usesFamilyTiers && <>
                              <label style={{...labelStyle,display:'block',marginTop:12}}>
                                Tier da família
                                <select
                                  value={tierKey}
                                  onChange={e => write('family.tier', e.target.value)}
                                  style={inputStyle}
                                >
                                  {getSystemFamilyTiers().map(([key, value]) => (
                                    <option key={key} value={key}>
                                      {value.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:8,marginTop:10}}>
                                {[
                                  ['PV', tier.pv],
                                  ['PS', tier.ps],
                                  [sheetResourceAbbreviation, tier.pr],
                                  ['Força', tier.strength],
                                  ['Agilidade', tier.agility],
                                  ['Defesa', tier.defense],
                                  ['Respiração', tier.breathing],
                                  ['Intelecto', tier.intellect],
                                  ['Pontos base da família', tier.points],
                                  ['Foco', tier.focus],
                                ].map(([label, value]) => (
                                  <div key={String(label)} style={{padding:9,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}>
                                    <small style={{color:'var(--season-muted, #b9b4c2)'}}>{label}</small>
                                    <div style={{fontSize:19,fontWeight:800}}>{value}</div>
                                  </div>
                                ))}
                              </div>
                            </>}
                          {usesRanks ? <>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Classe / hierarquia do caçador<select value={rankId} onChange={e=>changeRank(e.target.value)} style={inputStyle}>{systemRanks.map(entry=><option key={entry.id} value={entry.id}>{entry.group} · {entry.name}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>FOCO EXIGIDO</small><div style={{fontSize:22,fontWeight:800}}>{rank.focus}</div></div>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>GRUPO</small><div style={{fontSize:22,fontWeight:800}}>{rank.group}</div></div>
                            </div>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}><strong>Referência de benefícios da classe:</strong> {rank.benefits}</p>
                            <div style={{marginTop:12,padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Status concedidos pela classe</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>A classe selecionada adiciona automaticamente os bônus documentados. Para classes sem valores definidos no material, o bônus automático fica em zero até confirmação do mestre.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:10}}>{(['pv','ps','pr'] as const).map(key=><div key={key} style={{padding:10,borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>{key === 'pr' ? sheetResourceAbbreviation : key.toUpperCase()} da classe</small><div style={{fontSize:22,fontWeight:800}}>+{rankStatus[key]}</div></div>)}</div><strong style={{fontSize:12}}>Bônus adicionais personalizados</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>{field('progression.classStatus.pv','PV adicional')}{field('progression.classStatus.ps','PS adicional')}{field('progression.classStatus.pr',`${sheetResourceAbbreviation} adicional`)}</div></div>

                            <div style={{marginTop:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><strong>Histórico de promoções</strong><button
  type="button"
  className="secondary-button"
  disabled={!promotionLog.length}
  onClick={() => {
    if (window.confirm('Limpar todo o histórico de promoções desta ficha? Esta ação não pode ser desfeita.')) {
      const next = {
        ...data,
        progression: {
          ...(data.progression || {}),
          promotionLog: [],
          appliedPromotionIds: [],
        },
      }

      updateRenderDraft(JSON.stringify(next, null, 2))
    }
  }}
>
  Limpar histórico
</button></div>{promotionLog.length===0?<p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Nenhuma promoção registrada nesta ficha.</p>:promotionLog.map((entry:any)=><div key={entry.id} style={{padding:10,marginTop:8,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:8}}><strong>{entry.from} → {entry.to}</strong><div style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>{new Date(entry.at).toLocaleString('pt-BR')} · {entry.applied?'Benefícios marcados como aplicados':'Benefícios pendentes de conferência'}</div>{entry.description&&<p style={{fontSize:13,marginBottom:4}}>{entry.description}</p>}<p style={{fontSize:13,marginBottom:0}}>{entry.benefitReference}</p></div>)}</div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
  <button
    className="secondary-button"
    type="button"
    onClick={() => {
      const updated = promotionLog.map(entry => ({
        ...entry,
        applied: true,
      }))

      const next = {
        ...data,
        progression: {
          ...(data.progression || {}),
          promotionLog: updated,
          appliedPromotionIds: Array.from(
            new Set([
              ...benefitsApplied,
              ...promotionLog.map(entry => entry.transition),
            ])
          ),
        },
      }

      updateRenderDraft(JSON.stringify(next, null, 2))
    }}
  >
    Marcar promoções registradas como conferidas
  </button>
</div>
                          </> : <>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Progressão genérica: configure o modelo usado por esta campanha sem impor níveis numéricos.</p>
                            {(['model','currentStage','experience','nextRequirement'] as const).map(key=><label key={key} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{({model:'Modelo (nível, XP, tier, patente...)',currentStage:'Nível / estágio atual',experience:'Experiência / XP atual',nextRequirement:'Requisito para avançar'} as Record<string,string>)[key]}<input type={key==='experience'?'number':'text'} value={String(read(`progression.${key}`,''))} onChange={e=>write(`progression.${key}`,key==='experience'?Number(e.target.value):e.target.value)} style={inputStyle}/></label>)}
                            <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Bônus de status da progressão</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>{field('progression.statusBonuses.pv','Bônus de PV')}{field('progression.statusBonuses.ps','Bônus de PS')}{field('progression.statusBonuses.pr',`Bônus de ${sheetResourceAbbreviation}`)}</div></div><label style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>Regras de progressão<textarea rows={3} value={String(read('progression.rules',''))} onChange={e=>write('progression.rules',e.target.value)} style={inputStyle}/></label>
                          </>}

                          {(allocationSources.some(source => allocationPool(source) > 0) || renderCanEdit) && <>
                            <div className="sheet-distribution-panel sheet-attribute-distribution" style={{marginTop:22,padding:18,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 24%, transparent))',borderRadius:18,background:'linear-gradient(150deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)),var(--season-surface, var(--season-bg, #100e19)))',boxShadow:'0 14px 34px rgba(0,0,0,.18)'}}>
                              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
                                <div style={{width:38,height:38,flex:'0 0 38px',display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 25%, transparent))',fontSize:18}}>✦</div>
                                <div>
                                  <div style={{fontSize:10,letterSpacing:1.5,fontWeight:800,color:'var(--season-primary, #b49aff)',textTransform:'uppercase'}}>Desenvolvimento</div>
                                  <strong style={{display:'block',fontSize:17,marginTop:2}}>Distribuição de Pontos de Atributos</strong>
                                  <p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'4px 0 0',lineHeight:1.5}}>Distribua os pontos de atributos recebidos pela família, hierarquia e fontes extras.</p>
                                </div>
                              </div>

                              <p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'0 0 12px'}}>Cada ponto aumenta o atributo em 1. Você pode reduzir a −1 um atributo que começa em 0 para ganhar 1 ponto em Extras. Penalidades herdadas de família/tier não concedem pontos. Limite superior: 5.</p>

                              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:9}}>
                                {allocationSources.map(source=>{
                                  const pool=allocationPool(source)
                                  const used=attributeTotalUsed(source)
                                  const ratio=pool>0?Math.min(100,used/pool*100):0
                                  const sourceInfo={
                                    family:{label:'Família',color:'#d5a6ff'},
                                    hierarchy:{label:'Hierarquia',color:'#e8bd75'},
                                    extra:{label:'Extras',color:'#75c9ee'},
                                  }[source]

                                  return (
                                    <div key={source} style={{minWidth:0,padding:'13px 14px',borderRadius:15,background:'rgba(255,255,255,.045)',border:`1px solid ${sourceInfo.color}44`}}>
                                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:12}}>
                                        <strong style={{display:'flex',alignItems:'center',gap:8,fontSize:14}}>
                                          <span style={{width:9,height:9,borderRadius:'50%',background:sourceInfo.color,flex:'0 0 9px'}}/>
                                          {sourceInfo.label}
                                        </strong>
                                        <small style={{color:'var(--season-muted, #b9b4c2)',fontWeight:700,whiteSpace:'nowrap'}}>{Math.max(0,pool-used)} livres</small>
                                      </div>
                                      <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                                        <strong style={{fontSize:29,lineHeight:1,fontWeight:800}}>{used}</strong>
                                        <span style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>/ {pool} pontos usados</span>
                                      </div>
                                      <div style={{height:7,background:'rgba(255,255,255,.10)',borderRadius:99,overflow:'hidden',marginTop:13}}>
                                        <div style={{height:'100%',width:ratio+'%',background:sourceInfo.color}}/>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9,marginTop:16}}>
                                {familyAllocationKeys.map(key=>{
const extra = allocationSources.reduce(
  (sum, source) => sum + allocation(source, key),
  0
)

const baseValue = numRaw(`attributes.${key}`)

const familyBonus = usesFamilyTiers
  ? getSystemAttributeBonus(familyTierKey, key)
  : 0

const innate = Math.min(5, Math.max(-1, baseValue + familyBonus))
const canTakePenalty = innate === 0 && familyBonus >= 0
const penalty = canTakePenalty && Number(read(`progression.attributePenalties.${key}`, 0)) === -1 ? -1 : 0
const minimum = canTakePenalty ? -1 : innate
const current = Math.min(5, Math.max(-1, baseValue + familyBonus + extra + penalty))
                                  return (
                                    <label key={key} style={{...labelStyle,fontSize:11,display:'flex',flexDirection:'column',gap:6,margin:0,padding:'10px 11px',borderRadius:10,background:'color-mix(in srgb, var(--season-surface-alt, #211c31) 28%, transparent)',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 12%, transparent))'}}>
                                      <span style={{color:'var(--season-muted, #b9b4c2)',fontWeight:650}}>{({strength:'Força',agility:'Agilidade',defense:'Defesa',breathing:sheetResourceName,intellect:'Intelecto'})[key]}</span>
                                      <input type="number" min={minimum} max={5} defaultValue={current} key={`${key}-${current}-${minimum}`} disabled={!renderCanEdit} onChange={e => {

if (e.target.value === '') return

const wanted = Math.max(minimum, Math.min(5, Math.floor(Number(e.target.value) || 0)))

const familyBonus = usesFamilyTiers
  ? getSystemAttributeBonus(familyTierKey, key)
  : 0

const baseValue = numRaw(`attributes.${key}`)

const maximum = Math.max(
  0,
  5 - baseValue - familyBonus
)

let remaining = Math.max(
  0,
  Math.min(wanted - baseValue - familyBonus, maximum)
)

  const next = {
    ...data,
    progression: {
      ...(data.progression || {}),
      attributePenalties: {
        ...(data.progression?.attributePenalties || {}),
        [key]: wanted === -1 && canTakePenalty ? -1 : 0,
      },
      allocations: {
        ...(data.progression?.allocations || {}),
        family: {
          ...(data.progression?.allocations?.family || {}),
        },
        hierarchy: {
          ...(data.progression?.allocations?.hierarchy || {}),
        },
        extra: {
          ...(data.progression?.allocations?.extra || {}),
        },
        class: {
          ...(data.progression?.allocations?.class || {}),
        },
      },
    },
  }

  // Ao escolher -1, remove distribuições anteriores desse atributo,
  // e o crédito passa a existir exclusivamente na reserva Extras.
  if (wanted === -1 && canTakePenalty) {
    for (const source of allocationSources) next.progression.allocations[source][key] = 0
    next.progression.allocations.class[key] = 0
    updateRenderDraft(JSON.stringify(next, null, 2))
    return
  }

  for (const source of allocationSources) {
    const otherUsed = familyAllocationKeys.reduce(
      (sum, item) => {
        if (item === key) return sum

        const own = Math.max(
          0,
          Math.floor(
            Number(next.progression.allocations[source]?.[item]) || 0
          )
        )

        const legacyClass = source === 'extra'
          ? Math.max(
              0,
              Math.floor(
                Number(next.progression.allocations.class?.[item]) || 0
              )
            )
          : 0

        return sum + own + legacyClass
      },
      0
    )

    const capacity = Math.max(
      0,
      allocationPool(source) - (source === 'extra' && penalty === -1 ? 1 : 0) - otherUsed
    )

    const assigned = Math.min(remaining, capacity)

    next.progression.allocations[source][key] = assigned
    remaining -= assigned
  }

  // Migra eventual valor antigo de "class" para "extra",
  // evitando que os pontos sejam contabilizados duas vezes.
  next.progression.allocations.class[key] = 0

updateRenderDraft(JSON.stringify(next, null, 2))
}}
onBlur={e => {
  e.currentTarget.value = String(current)
}}
style={{...inputStyle,margin:0,padding:'8px 9px',fontSize:15,fontWeight:700,borderRadius:8}}/>
                                      <small style={{color:'var(--season-muted)',fontWeight:700}}>{penalty === -1 ? "+1 ponto em Extras · " : ""}Total: {current}/5</small>
                                    </label>
                                  )
                                })}
                              </div>
                              <div style={{marginTop:28,padding:13,borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 9%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 16%, transparent))'}}>
                                <label style={{...labelStyle,display:'block',margin:0}}>
                                  Pontos extras de atributos
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    disabled={!renderCanEdit}
                                    value={numRaw('progression.extraAttributePoints')}
                                    onChange={e => write('progression.extraAttributePoints',Math.max(0,Math.floor(Number(e.target.value)||0)))}
                                    style={{...inputStyle,marginTop:7}}
                                  />
                                </label>
                                <small style={{display:'block',marginTop:6,color:'var(--season-muted, #b9b4c2)'}}>
                                  Pontos concedidos pelo mestre. Entram na reserva Extras acima e podem ser distribuídos entre os atributos, respeitando o limite de 5.
                                </small>
                              </div>
                            </div>
                          </>}
                          {systemFeatures?.usesSkillPoints && <>
                            <div className="sheet-distribution-panel sheet-skill-distribution" style={{marginTop:22,padding:18,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 24%, transparent))',borderRadius:18,background:'linear-gradient(150deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)),var(--season-surface, var(--season-bg, #100e19)))',boxShadow:'0 14px 34px rgba(0,0,0,.18)'}}>
                              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}><div style={{width:38,height:38,flex:'0 0 38px',display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 25%, transparent))',fontSize:18}}>✦</div><div><div style={{fontSize:10,letterSpacing:1.5,fontWeight:800,color:'var(--season-primary, #b49aff)',textTransform:'uppercase'}}>Desenvolvimento</div><strong style={{display:'block',fontSize:17,marginTop:2}}>Distribuição de Pontos de Perícias</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'4px 0 0',lineHeight:1.5}}>{skillPointConfig?.description || 'Distribua os pontos de perícias recebidos pelas fontes disponíveis e pontos extras.'}</p></div></div>
                              <p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'0 0 12px'}}>Cada ponto distribuído aumenta a perícia em 1 nível. Limite: 12 por perícia.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:9}}>{skillPointSources.map(source=>{const pool=skillPool(source.id);const used=skillTotalUsed(source.id);const ratio=pool>0?Math.min(100,used/pool*100):0;return <div key={source.id} style={{minWidth:0,padding:'13px 14px',borderRadius:15,background:'rgba(255,255,255,.045)',border:`1px solid ${source.color}44`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:12}}><strong style={{display:'flex',alignItems:'center',gap:8,fontSize:14}}><span style={{width:9,height:9,borderRadius:'50%',background:source.color,flex:'0 0 9px'}}/>{source.label}</strong><small style={{color:'var(--season-muted, #b9b4c2)',fontWeight:700,whiteSpace:'nowrap'}}>{Math.max(0,pool-used)} livres</small></div><div style={{display:'flex',alignItems:'baseline',gap:5}}><strong style={{fontSize:29,lineHeight:1,fontWeight:800}}>{used}</strong><span style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>/ {pool} pontos usados</span></div><div style={{height:7,background:'rgba(255,255,255,.10)',borderRadius:99,overflow:'hidden',marginTop:13}}><div style={{height:'100%',width:ratio+'%',background:source.color}}/></div></div>})}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9,marginTop:16}}>{skillKeys.map(key=>{const current=num(`skills.${key}`);const extra=skillAllocatedTotal(key);return <label key={key} style={{...labelStyle,fontSize:11,display:'flex',flexDirection:'column',gap:6,margin:0,padding:'10px 11px',borderRadius:10,background:'color-mix(in srgb, var(--season-surface-alt, #211c31) 28%, transparent)',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 12%, transparent))'}}><span style={{color:'var(--season-muted, #b9b4c2)',fontWeight:650}}>{skillLabels[key]}</span><input
  type="number"
  min="0"
  max={maxSkillLevel}
  defaultValue={extra}
  key={key}
  onChange={e => {
    if (e.target.value === '') return
    setSkillAllocation(key, Number(e.target.value))
  }}
  onBlur={e => {
    e.currentTarget.value = String(skillAllocatedTotal(key))
  }}
  style={{...inputStyle,margin:0,padding:'8px 9px',fontSize:15,fontWeight:700,borderRadius:8}}
/><small style={{color:'var(--season-muted)',fontWeight:700}}>Total: {current}/{maxSkillLevel}</small></label>})}</div>{skillPointConfig?.extraPointsInput && <div style={{marginTop:28,padding:13,borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 9%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 16%, transparent))'}}><label style={{...labelStyle,display:'block',margin:0}}>{skillPointConfig.extraPointsInput.label}<input type="number" min="0" step="1" value={numRaw(skillPointConfig.extraPointsInput.path)} onChange={e=>write(skillPointConfig.extraPointsInput!.path,Math.max(0,Math.floor(Number(e.target.value)||0)))} style={{...inputStyle,marginTop:7}} /></label>{skillPointConfig.extraPointsInput.description && <small style={{display:'block',marginTop:6,color:'var(--season-muted, #b9b4c2)'}}>{skillPointConfig.extraPointsInput.description}</small>}</div>}{intellectChoiceConfig?.enabled && <div style={{marginTop:16,padding:14,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><strong>{intellectChoiceConfig.title || 'Desenvolvimento por atributo'}</strong><p style={{fontSize:13,color:'var(--season-muted, #b9b4c2)'}}>{intellectChoiceConfig.description || 'Escolha como utilizar cada ponto do atributo configurado.'}</p>{Array.from({length:intellect},(_,i)=><label key={i} style={{...labelStyle,display:'grid',gridTemplateColumns:'90px 1fr',alignItems:'center',gap:10,marginTop:8}}>{intellectChoiceConfig.pointLabel || 'Ponto'} {i+1}<select value={mainAllocations[i]} onChange={e=>{const next=[...mainAllocations];next[i]=e.target.value;write(skillChoicePath,next)}} style={inputStyle}><option value={mainChoiceValue}>{intellectChoiceConfig.mainLabel}</option><option value={extraChoiceValue}>{intellectChoiceConfig.extraLabel}</option></select></label>)}<div style={{marginTop:10,color:'#eee'}}>{intellectChoiceConfig.mainPointsLabel || 'Pontos da opção principal'}: <strong>{mainPoints}</strong> · {intellectChoiceConfig.extraLevelsLabel || 'Níveis extras'}: <strong>{extraLevels}</strong></div></div>}</div>
                          </>}

                        </section>
                      })()}
                      {panel('1. Identidade', <>{renderCanRename && <div className="character-name-editor identity-character-name-editor"><label htmlFor="sheet-character-name">{forEnemy ? 'Nome do inimigo' : 'Nome do personagem'}</label><div><input id="sheet-character-name" value={renderNameDraft} onChange={event => setRenderNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveRenderName() } }} maxLength={80} placeholder={forEnemy ? 'Nome do inimigo' : 'Nome do personagem'} disabled={renderNameSaving} /><button className="secondary-button" type="button" onClick={() => void saveRenderName()} disabled={renderNameSaving || !renderNameDraft.trim()}>{renderNameSaving ? 'Salvando…' : 'Salvar nome'}</button></div></div>}{field('identity.sex','Sexo','text')}{field('identity.family','Família','text')}{field('identity.age','Idade')}{field('identity.height','Altura','text')}{field('identity.weight','Peso','text')}{(['primaryArchetype', 'secondaryArchetype'] as const).map((key) => {
  const otherKey = key === 'primaryArchetype'
    ? 'secondaryArchetype'
    : 'primaryArchetype'

  const current = String(read(`identity.${key}`, ''))
  const other = String(read(`identity.${otherKey}`, ''))

  const isForbidden = (a: string, b: string) =>
    (a === 'Linha de Frente' && b === 'Suporte') ||
    (a === 'Suporte' && b === 'Linha de Frente') ||
    (a === 'Defensor' && b === 'Flanco') ||
    (a === 'Flanco' && b === 'Defensor')

  return (
    <label key={key} style={{...labelStyle, display:'flex', flexDirection:'column', gap:6}}>
      {key === 'primaryArchetype' ? 'Arquétipo primário' : 'Arquétipo secundário'}
      <select
        value={current}
        onChange={e => {
          const next = e.target.value
          if (other && isForbidden(next, other)) {
            setError('Essa combinação de arquétipos não é permitida.')
            return
          }
          write(`identity.${key}`, next)
        }}
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {systemArchetypes.map(archetype => (
          <option
            key={archetype}
            value={archetype}
            disabled={Boolean(other && isForbidden(archetype, other))}
          >
            {archetype}
          </option>
        ))}
      </select>
    </label>
  )
})}
{isKisatsutaiSystem && <label style={{...labelStyle, display:'flex', flexDirection:'column', gap:6}}>
  Trilha
  <input
    type="text"
    readOnly
    value={getKisatsutaiFullPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', ''))) || 'Selecione os arquétipos primário e secundário'}
    style={{...inputStyle, cursor:'default'}}
    title="Definida automaticamente pelos arquétipos primário e secundário"
  />
</label>}
{!isKisatsutaiSystem && field('identity.path','Caminho','text')}{field('identity.breathing',sheetResourceName,'text')}{area('identity.appearance','Aparência')}{area('identity.beliefs','Crenças')}{area('identity.lore','História / lore')}</>)}
                      {panel('2. Status', <>{derived.map(([label,value,hint])=><div key={label} style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small style={{color:'var(--season-muted, #b9b4c2)'}}>{label.toUpperCase()}</small><div style={{fontSize:26,fontWeight:800}}>{value}</div><small style={{color:'var(--season-muted, #b9b4c2)'}}>{hint}</small></div>)}</>)}

                      {panel('3. Combate', <><div className="sheet-editor-combat-content"><div style={{padding:12,marginBottom:12,borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><strong>Dano base · {hierarchyGroup}</strong><div style={{fontSize:24,fontWeight:800}}>{baseDamage}</div><small>Definido automaticamente pela hierarquia.</small></div><div style={{padding:12,marginBottom:12,borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><strong>Arma equipada</strong>{equippedWeapon ? <><div style={{fontSize:18,fontWeight:800}}>{equippedWeapon.name}</div><small>Dano extra: {equippedWeaponDamage} · Carga: {String(equippedWeapon.metadata?.weaponWeight ?? equippedWeapon.weight)} kg</small></> : <p>Nenhuma arma equipada. Equipe uma arma pelo Inventário.</p>}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><small>DANO EXTRA DA ARMA EQUIPADA</small><div style={{fontSize:20,fontWeight:800}}>{equippedWeaponDamage}</div><small>Definido pela classificação da arma no inventário.</small></div>{field('combat.armor','Armadura')}{field('combat.mentalArmor','Armadura Mental')}{field('combat.essence','Essência')}{field('combat.critical','Crítico')}<div className="sheet-movement-card" style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}>
  <small>DESLOCAMENTO</small>
<div className="sheet-movement-values">
  <strong>
    {equippedArmor && equippedArmor.metadata?.armorClass !== 'leve' && (
      <small className="armor-dexterity-value">
        {Math.max(1, Math.floor(
          (movementActions * dexterity) /
          (equippedArmor.metadata?.armorClass === 'media' ? 2 : 4)
        ))}
      </small>
    )}
    {Math.max(1, movementActions * dexterity)}
  </strong>
</div>
  <small>Ações de Movimento × Destreza</small>
</div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES DE MOVIMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES EXTRAS</small><div style={{fontSize:24,fontWeight:800}}>{extraActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>REAÇÕES</small><div style={{fontSize:24,fontWeight:800}}>{reactions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONTRA-ATAQUE</small><div style={{fontSize:24,fontWeight:800}}>{combat + armorDexterity}</div>
<small>Combate + Destreza de Armadura</small></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONSTITUIÇÃO</small><div style={{fontSize:24,fontWeight:800}}>{resistance+vigor}</div><small>Resistência + Vigor</small></div></div>{area('combat.actions','Observações de ações e regras de combate')}</div></>)}

                      {panel('4. Fluxos', <>{area('flows.details','Fluxos desbloqueados e detalhes')}</>)}
{panel(
  isKisatsutaiSystem
    ? '5. Habilidades & Respirações'
    : isCyberFlowerSystem
      ? '5. Habilidades & Eletrização'
      : '5. Habilidades & Mana',
  <>
    {area('abilities.archetype', 'Habilidades do arquétipo')}
    {area('abilities.path', 'Habilidades do caminho')}
    {area('abilities.conditions', 'Condições')}
    {field(
      'breathing.type',
      isKisatsutaiSystem ? 'Tipo de respiração' : isCyberFlowerSystem ? 'Tipo de eletrização' : 'Tipo de mana',
      'text'
    )}
    {area(
      'breathing.forms',
      isKisatsutaiSystem ? 'Formas de respiração' : isCyberFlowerSystem ? 'Formas de eletrização' : 'Formas de mana'
    )}
    {area(
      'breathing.concentration',
      isKisatsutaiSystem ? 'Técnica de concentração' : isCyberFlowerSystem ? 'Técnica de concentração de eletrização' : 'Técnica de concentração de mana'
    )}
  </>
)}
                      {isKisatsutaiSystem && panel('6. Perícias gerais, arquétipo ou extras', <div className="kisatsutai-extra-skills">
                        <KisatsutaiSkillDistribution fullPath={getKisatsutaiFullPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', '')))} skills={read('skills', {})} onChange={next => write('skills', next)} intellectExtraLevels={extraLevels} disabled={!renderCanEdit} />
                        <details className="kisatsutai-skill-group"><summary>Consultar lista de perícias e descrições</summary>
                          {Object.entries(KISATSUTAI_SKILL_GROUPS).map(([group, groupSkills]) => <details key={group} className="kisatsutai-skill-group"><summary>{group} <small>({groupSkills.length} perícias)</small></summary><div className="kisatsutai-skill-grid">{groupSkills.map(skill => <div key={skill.name} className="kisatsutai-skill-entry"><span><strong>{skill.name}</strong><small>{skill.description}</small></span></div>)}</div></details>)}
                        </details>
                      </div>)}
                      {isKisatsutaiSystem && panel('7. Trilhas', <div className="kisatsutai-path-editor">
                        <label>Trilha definida automaticamente<input readOnly value={getKisatsutaiFullPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', ''))) || 'Defina os dois arquétipos na seção Identidade'} style={inputStyle} /></label>
                        {Object.entries(KISATSUTAI_PATHS).filter(([name]) => name === getKisatsutaiPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', '')))).map(([name,path]) => <div key={name} className="kisatsutai-path-details"><p>Trilha do personagem: <strong>{getKisatsutaiFullPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', '')))}</strong></p><p>Combinação: <strong>{path.combination}</strong></p><p className="kisatsutai-editor-note">Os benefícios abaixo determinam as vagas da distribuição de perícias, na seção anterior.</p>{Object.entries(path.benefits as Record<string, readonly string[]>).filter(([title]) => title === getKisatsutaiFullPath(String(read('identity.primaryArchetype', '')), String(read('identity.secondaryArchetype', '')))).map(([title,benefits]) => <details key={title} open><summary>{title}</summary><ul>{benefits.map((benefit: string, i: number) => <li key={i}>{benefit}</li>)}</ul></details>)}<h4>Habilidades por graduação</h4>{(['Mizunoe','Kanoe','Tsuchinoe','Hinoe','Kinoe'] as const).map(rank => { const ability = path.abilities[rank]; return <div key={rank} className="kisatsutai-path-ability"><strong>{rank}{ability?.name ? ` · ${ability.name}` : ''}</strong><p>{ability?.description || 'Habilidade ainda não definida no material do sistema.'}</p></div> })}</div>)}
                      </div>)}
                      {panel('Anotações', area('notes','Anotações gerais'))}
                      </fieldset>) : (<section className="character-sheet-summary sheet-overview-premium">
                        <header className="sheet-summary-header">
                          <div className="sheet-summary-identity"><div className="sheet-summary-identity-main"><span className="sheet-summary-avatar" aria-hidden="true">{forEnemy ? (selectedEnemy?.emoji || '👹') : (selectedCharacter?.emoji || '⚔️')}</span><div className="sheet-summary-identity-copy"><span className="sheet-eyebrow">{forEnemy ? 'FICHA DE INIMIGO' : 'FICHA DE PERSONAGEM'}</span><h2>{String(read('identity.name', renderSubject?.name || (forEnemy ? 'Inimigo' : 'Personagem')))}</h2><p>
  {String(read('identity.family', 'Família não definida'))}
  {' · '}
  {String(read('identity.primaryArchetype', renderSubject?.archetype || 'Arquétipo não definido'))}
  {' + '}
  {String(read('identity.secondaryArchetype', 'Arquétipo secundário não definido'))}
</p></div></div></div>
                          <div className="sheet-summary-progression">
                            {[
                              ...(systemFeatures?.usesRanks
                                ? [['Classe', read('progression.rankName', getSystemRankName(rankIdForStatus))]]
                                : []),
                              ...(usesFamilyTiers
                                ? [
                                    ['Tier familiar', familyTierData.label],
                                    ['Foco', read('progression.classFocus', familyTierData.focus)],
                                  ]
                                : []),
                              ['Pontos de perícia', read('progression.classSkillPoints', 0)],
                            ].map(([label, value]) => (
                              <div key={String(label)}>
                                <span>{label}</span>
                                <strong>{value}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="sheet-summary-season">{forEnemy ? 'Campanha' : (seasons.find(entry => entry.id === selectedSeasonId)?.name || 'Temporada')}</div>
                        </header>
                        <div className="sheet-section-heading" id={forEnemy ? 'inimigo-status' : 'ficha-status'}><span className="sheet-section-symbol" aria-hidden="true">♥</span><div><span className="sheet-section-kicker">RECURSOS VITAIS</span><h3>Status</h3><p>Acompanhe seus recursos, aplique ajustes e registre danos.</p></div></div>
                        <div className="sheet-summary-status">{derived.map(([label,value], index) => {
                          const keys = ['pv', 'ps', 'pr'] as const
                          const key = keys[index]
                          const currentPath = `status.current.${key}`
                          const rawCurrent = Number(read(currentPath, value))
                          const current = Math.max(0, key === 'pv' ? (Number.isFinite(rawCurrent) ? rawCurrent : value) : Math.min(value, Number.isFinite(rawCurrent) ? rawCurrent : value))
                          const adjust = (delta: number) => {
                            if (!renderCanEdit) return
                            // Fichas antigas podem ainda não ter status.current.
                            // Inicializa os três valores com os máximos calculados,
                            // preservando qualquer valor atual já registrado.
                            const existingCurrent = (data.status?.current && typeof data.status.current === 'object')
                              ? data.status.current
                              : {}
                            const currentDefaults = {
                              pv: Number(existingCurrent.pv ?? derived[0][1]),
                              ps: Number(existingCurrent.ps ?? derived[1][1]),
                              pr: Number(existingCurrent.pr ?? derived[2][1]),
                            }
                            const next = {
                              ...data,
                              status: {
                                ...(data.status || {}),
                                current: {
                                  ...currentDefaults,
                                  [key]: Math.max(0, key === 'pv' ? current + delta : Math.min(value, current + delta)),
                                },
                              },
                            }
                            updateRenderDraft(JSON.stringify(next, null, 2))
                            void persistRenderConditions(next)
                          }
                          const applyTypedAdjustment = () => {
                            const raw = (statusAdjustments[key] ?? '').trim()
                            if (!/^[+-]\d+$/.test(raw) || Number(raw) === 0) {
                              setError('Digite um valor inteiro com sinal, como +10 ou -10.')
                              return
                            }
                            adjust(Number(raw))
                            setError('')
                            setNotice(`${key === 'pr' ? sheetResourceAbbreviation : key.toUpperCase()} ajustado em ${raw} e salvo automaticamente.`)
                          }
                          const colors = [{accent:'#f28b9b',glow:'rgba(242,139,155,.18)'},{accent:'var(--season-primary)',glow:'var(--season-glow)'},{accent:forEnemy && isKisatsutaiSystem ? '#e47683' : '#75c9ee',glow:forEnemy && isKisatsutaiSystem ? 'rgba(228,118,131,.18)' : 'rgba(117,201,238,.18)'}][index]
                          const percent = value > 0 ? Math.min(current / value * 100, 100) : 0
                          const extraPV = key === 'pv' ? Math.max(0, current - value) : 0
                          const extraPercent = value > 0 ? Math.min(extraPV / value * 100, 100) : 0
                          return <article key={label} className={`sheet-summary-status-card sheet-status-${key}`} style={{position:'relative',overflow:'hidden'}}>
                            <div className="sheet-status-card-top"><span className="sheet-status-icon" aria-hidden="true">{key === 'pv' ? '♥' : key === 'ps' ? '✧' : forEnemy && isKisatsutaiSystem ? '🩸' : '〰'}</span><span className="sheet-status-card-name">{key === 'pv' ? 'PONTOS DE VIDA' : key === 'ps' ? 'SANIDADE' : sheetResourceAbbreviation}</span></div>
                            <span className="sheet-status-full-label">{label.replace('Pontos de ', '').replace(/\s\(.+\)/, '')}</span>
                            <strong style={{display:'block',fontSize:24,margin:'5px 0'}}>{current}<small style={{fontSize:13,fontWeight:500,opacity:.7}}> / {value}</small></strong>
                            <div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.12)',overflow:'hidden',margin:'8px 0 4px'}}><div style={{height:'100%',width:`${percent}%`,borderRadius:99,background:colors.accent,boxShadow:`0 0 12px ${colors.glow}`,transition:'width .2s ease'}}/></div>
                            {extraPV > 0 && <><div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.12)',overflow:'hidden',margin:'0 0 6px'}}><div style={{height:'100%',width:`${extraPercent}%`,borderRadius:99,background:'linear-gradient(90deg,#f6b84a,#ff7b45)',boxShadow:'0 0 12px rgba(246,184,74,.3)',transition:'width .2s ease'}}/></div><small style={{display:'block',color:'#ffc875',marginBottom:6}}>＋{extraPV} PV excedentes · barra extra</small></>}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                              <small style={{opacity:.7}}>{Math.round(percent)}% disponível</small>
                              {renderCanEdit && <div style={{display:'flex',gap:6}}>
                                <button type="button" aria-label={`Diminuir ${key === 'pr' ? sheetResourceAbbreviation : key.toUpperCase()}`} disabled={current <= 0} onClick={()=>adjust(-1)} style={{width:32,height:30,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.07)',color:'inherit',fontSize:19,cursor:current<=0?'not-allowed':'pointer',opacity: current <= 0 ? 0.4 : 1}}>−</button>
                                <button type="button" aria-label={`Aumentar ${key === 'pr' ? sheetResourceAbbreviation : key.toUpperCase()}`} disabled={key !== 'pv' && current >= value} onClick={()=>adjust(1)} style={{width:32,height:30,borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontSize:19,cursor:key !== 'pv' && current>=value?'not-allowed':'pointer',opacity: key !== 'pv' && current >= value ? 0.4 : 1}}>+</button>
                              </div>}
                            </div>
                            {renderCanEdit && <div style={{display:'flex',gap:7,marginTop:10}}>
                              <input type="text" inputMode="numeric" aria-label={`Ajuste de ${key === 'pr' ? sheetResourceAbbreviation : key.toUpperCase()}`} value={statusAdjustments[key] ?? ''} onChange={event=>setStatusAdjustments(previous=>({...previous,[key]:event.target.value}))} onKeyDown={event=>{if(event.key==='Enter')applyTypedAdjustment()}} placeholder="+10 ou -10" style={{minWidth:0,width:'100%',padding:'8px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,.18)',background:'rgba(0,0,0,.2)',color:'inherit',font:'inherit'}} />
                              <button type="button" onClick={applyTypedAdjustment} style={{whiteSpace:'nowrap',padding:'7px 11px',borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontWeight:700,cursor:'pointer'}}>Aplicar</button>
                            </div>}
                            {key === 'pv' && <div className="status-card-damage-control"><strong>Aplicar dano físico</strong><label>Tipo de dano<select value={physicalDamageType} onChange={event=>setPhysicalDamageType(event.target.value as 'cortante_perfurante'|'especial_bruto')}><option value="cortante_perfurante">Cortante / Perfurante</option><option value="especial_bruto">Especial / Bruto</option></select></label><label>Dano recebido<input type="number" min="0" value={physicalDamageAmount} onChange={event=>setPhysicalDamageAmount(event.target.value)} placeholder="Quantidade" /></label><small>{armorCovers(physicalDamageType) ? `Armadura: ${armorResistance} · Proteção: ${isKisatsutaiSystem && physicalDamageType !== 'especial_bruto' ? 0 : physicalProtection}` : `Proteção: ${isKisatsutaiSystem && physicalDamageType !== 'especial_bruto' ? 0 : physicalProtection}`}</small><button type="button" disabled={!renderCanEdit || physicalDamageAmount.trim()==='' || Number(physicalDamageAmount)<0} onClick={()=>{const incoming=Math.max(0,Number(physicalDamageAmount)||0);const reduced=calculateSheetPhysicalDamage({incoming,reactionReduction:0,damageType:physicalDamageType,defenses:characterDefenses,specialBruteProtectionOnly:isKisatsutaiSystem}).remaining;const currentPV=Number(read('status.current.pv',derived[0][1]));const nextPV=Math.max(0,currentPV-reduced);const next={...data,status:{...(data.status||{}),current:{...((data.status as any)?.current||{}),pv:nextPV,ps:Number(read('status.current.ps',derived[1][1])),pr:Number(read('status.current.pr',derived[2][1]))}}};updateRenderDraft(JSON.stringify(next,null,2));void persistRenderConditions(next);setNotice(`Dano ${physicalDamageType==='cortante_perfurante'?'cortante/perfurante':'especial/bruto'}: ${incoming}. Redução: ${incoming-reduced}. PV perdidos: ${reduced}.`);setPhysicalDamageAmount('')}}>Aplicar aos PV</button></div>}
                            {key === 'ps' && <div className="status-card-damage-control sanity"><strong>Aplicar dano de sanidade</strong><label>Dano recebido<input type="number" min="0" value={sanityDamageAmount} onChange={event=>setSanityDamageAmount(event.target.value)} placeholder="Quantidade" /></label><small>Proteção de sanidade equipada: {sanityProtection}</small><button type="button" disabled={!renderCanEdit || sanityDamageAmount.trim()==='' || Number(sanityDamageAmount)<0} onClick={()=>{const incoming=Math.max(0,Number(sanityDamageAmount)||0);const reduced=Math.max(0,incoming-sanityProtection);const currentPS=Number(read('status.current.ps',derived[1][1]));const nextPS=Math.max(0,currentPS-reduced);const next={...data,status:{...(data.status||{}),current:{...((data.status as any)?.current||{}),pv:Number(read('status.current.pv',derived[0][1])),ps:nextPS,pr:Number(read('status.current.pr',derived[2][1]))}}};updateRenderDraft(JSON.stringify(next,null,2));void persistRenderConditions(next);setNotice(`Dano de sanidade: ${incoming}. Redução: ${incoming-reduced}. PS perdidos: ${reduced}.`);setSanityDamageAmount('')}}>Aplicar aos PS</button></div>}
                            {key === 'pr' && usesFamilyTiers && (() => {
                              const rank = getSystemRank(rankIdForStatus)
                              const group = rank.group
                              const dtByGroup: Record<string, number> = { Raposa: 20, Tigre: 19, Dragão: 18, Corvo: 17 }
                              const dt = dtByGroup[group]
                              const runBreathingTest = () => {
                                if (group === 'Carpa' || !dt) return
                                const diceCount = Math.max(1, Math.floor(1 + breathing))
                                const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 20) + 1)
                                const best = Math.max(...rolls)
                                const total = best + vigor
                                const success = total >= dt
                                const recovery = Math.floor(value / (success ? 4 : 8))
                                const applied = Math.min(recovery, Math.max(0, value - current))
                                setBreathingTestResult({ rolls, best, total, dt, success, recovery, applied, group })
                                if (renderCanEdit && applied > 0) {
                                  const next = { ...data, status: { ...(data.status || {}), current: { ...((data.status || {}).current || {}), pr: current + applied } } }
                                  updateRenderDraft(JSON.stringify(next, null, 2))
                                  void persistRenderConditions(next)
                                  setNotice(`${sheetRecoveryTestName}: ${success ? 'sucesso' : 'falha'}. ${applied} ${sheetResourceUnit} recuperados e salvos automaticamente.`)
                                }
                              }
                              return <div style={{marginTop:12,padding:12,borderRadius:10,background:'rgba(117,201,238,.08)',border:'1px solid rgba(117,201,238,.22)'}}>
                                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:13}}>{sheetRecoveryTestName} · {group}</strong><small style={{opacity:.75}}>{group === 'Carpa' ? 'Sem teste' : `DT ${dt}`}</small></div>
                                {group === 'Carpa' ? <small style={{display:'block',marginTop:7,opacity:.8}}>Este grupo não realiza o {forEnemy && isKisatsutaiSystem ? 'teste de Sangue' : 'teste de Respiração'}.</small> : <>
                                  <small style={{display:'block',marginTop:5,opacity:.8}}>{1 + breathing}d20 · maior resultado + Vigor ({vigor})</small>
                                  <button type="button" onClick={runBreathingTest} style={{marginTop:9,padding:'8px 12px',borderRadius:9,border:'1px solid rgba(117,201,238,.55)',background:'rgba(117,201,238,.16)',color:'inherit',fontWeight:700,cursor:'pointer'}}>Rolar teste</button>
                                  {breathingTestResult && breathingTestResult.group === group && <div style={{marginTop:9,fontSize:13}}><div>Dados: {breathingTestResult.rolls.join(' · ')} → maior: <strong>{breathingTestResult.best}</strong></div><div>Resultado: <strong>{breathingTestResult.best} + {vigor} = {breathingTestResult.total}</strong> / DT {breathingTestResult.dt} — <strong style={{color:breathingTestResult.success?'#8de0a5':'#f0a0a0'}}>{breathingTestResult.success?'Sucesso':'Falha'}</strong></div><div>Recuperação: {breathingTestResult.recovery} {sheetResourceUnit} ({breathingTestResult.success?'¼':'⅛'} do máximo) · aplicado: <strong>{breathingTestResult.applied} {sheetResourceUnit}</strong></div></div>}
                                </>}
                              </div>
                            })()}
                          </article>
                        })}</div>
                        <div className="sheet-section-heading" id={forEnemy ? 'inimigo-atributos' : 'ficha-atributos'}><span className="sheet-section-symbol" aria-hidden="true">✦</span><div><span className="sheet-section-kicker">CAPACIDADES</span><h3>Atributos</h3><p>Valores efetivos considerando progressão e bônus.</p></div></div>
                        <div className="sheet-summary-attributes">{[['Força',strength],['Agilidade',agility],['Defesa',defense],[sheetResourceName,breathing],['Intelecto',intellect]].map(([label,value])=><article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
                        <div className="sheet-summary-grid">
                          <article className="sheet-summary-card sheet-skills-card" id={forEnemy ? 'inimigo-pericias' : 'ficha-pericias'}><div className="sheet-card-title"><span className="sheet-card-title-icon">✧</span><div><span>ESPECIALIZAÇÃO</span><h3>Perícias</h3></div></div><div className="sheet-summary-values">{[['Vigor',vigor],['Mental',mental],['Combate',combat],['Destreza',dexterity],['Resistência',resistance],['Habilidade',ability]].map(([label,value])=><div key={String(label)} className={String(label)==='Destreza'?'sheet-dexterity-with-armor':''}><span>{label}</span><strong>{String(label)==='Destreza' && equippedArmor ? <><small className="armor-dexterity-value">{armorDexterity}</small>{value}</> : value}</strong></div>)}</div></article>
<article className="sheet-summary-card sheet-combat-card" id={forEnemy ? 'inimigo-combate' : 'ficha-combate'}>
  <div className="sheet-card-title"><span className="sheet-card-title-icon">⚔</span><div><span>PREPARAÇÃO</span><h3>Combate</h3></div></div>
  <div className="sheet-summary-values">
    {[
      ['Dano base', baseDamage],
      ['Dano extra', equippedWeaponDamage],
      ['Deslocamento', Math.max(1, Math.floor((movementActions * dexterity) / (renderOverloaded ? 2 : 1)))],
      ['Ações', movementActions + extraActions],
      ['Reações', reactions],
['Contra-ataque', counterAttackDT],
['Constituição', resistance + vigor],
['Crítico', criticalValue],
...(usesFamilyTiers ? [['Essência', read('combat.essence', '—')]] : [])
    ].map(([label, value]) => (
      <div key={String(label)}>
        <span>{label}</span>
        <strong>
          {String(label) === 'Deslocamento' &&
            equippedArmor &&
            equippedArmor.metadata?.armorClass !== 'leve' && (
              <small className="armor-dexterity-value">
                {Math.max(
                  1,
                  Math.floor(
                    Number(value) /
                    (equippedArmor.metadata?.armorClass === 'media' ? 2 : 4)
                  )
                )}
              </small>
            )}
          {value}
        </strong>
      </div>
    ))}
  </div>
</article>
                        </div>

                        <div className="sheet-summary-notes"><div className="sheet-card-title"><span className="sheet-card-title-icon">✎</span><div><span>HISTÓRIA E TRAÇOS</span><h3>Resumo {forEnemy ? 'do inimigo' : 'do personagem'}</h3></div></div><p>{String(read('identity.appearance','Aparência não registrada'))}</p><p>{String(read('identity.beliefs',''))}</p><p>{String(read('identity.lore',''))}</p></div>
                        <p className="sheet-summary-hint">Esta é uma visão resumida. {renderCanEdit ? 'Clique em “Editar ficha” para acessar todos os campos e detalhes.' : 'Você não tem permissão para editar esta ficha.'}</p>
                      </section>)}
                        <section className="combat-actions-panel sheet-actions-premium" id={forEnemy ? 'inimigo-acoes' : 'ficha-acoes'}>
                          <div className="combat-actions-heading"><div><span className="combat-eyebrow">{forEnemy ? 'TURNO DO INIMIGO' : 'TURNO DO PERSONAGEM'}</span><h3>Ações</h3><p>Escolha uma ação para rolar os dados automaticamente.</p></div><div className="combat-d20-mark">D20</div></div>
                          <div className="combat-action-grid">
                            <button type="button" className="combat-action-card" onClick={() => performCombatRoll('Ataque bruto')}>
                              <span className="combat-action-icon">⚔</span>
                              <strong>Ataque Bruto</strong>
                              <small>{Math.floor(1 + strength) <= 0 ? `${2 - Math.floor(1 + strength)}D20 (desvantagem)` : `${Math.floor(1 + strength)}D20`} + Combate ({combat})</small>
                            </button>

                            <button type="button" className="combat-action-card" onClick={() => performCombatRoll('Ataque ágil')}>
                              <span className="combat-action-icon">➶</span>
                              <strong>Ataque Ágil</strong>
                              <small>{Math.floor(1 + agility) <= 0 ? `${2 - Math.floor(1 + agility)}D20 (desvantagem)` : `${Math.floor(1 + agility)}D20`} + Combate ({combat})</small>
                            </button>

                            {isKisatsutaiSystem && <><button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Tiro')}><span className="combat-action-icon">🎯</span><strong>Tiro</strong><small>{Math.max(1, 1 + Math.floor(intellect))}D20 + Habilidade ({ability})</small></button><button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Disparo')}><span className="combat-action-icon">🏹</span><strong>Disparo</strong><small>{Math.max(1, 1 + Math.floor(agility))}D20 + Habilidade ({ability})</small></button></>}

                            <button type="button" className="combat-action-card" onClick={() => performCombatRoll('Ataque especial')}>
                              <span className="combat-action-icon">✦</span>
                              <strong>Ataque Especial</strong>
                              <small>{Math.floor(1 + breathing) <= 0 ? `${2 - Math.floor(1 + breathing)}D20 (desvantagem)` : `${Math.floor(1 + breathing)}D20`} + Habilidade ({ability})</small>
                            </button>
                            {isKisatsutaiSystem && <button type="button" className="combat-action-card" aria-expanded={skillTestOpen} onClick={() => setSkillTestOpen(open => !open)}>
                              <span className="combat-action-icon">✧</span>
                              <strong>Teste de Perícia</strong>
                              <small>{skillTestOpen ? 'Fechar teste' : 'Escolher perícia e atributo'}</small>
                            </button>}
                            {isKisatsutaiSystem && <button type="button" className="combat-action-card" aria-expanded={complexActionsOpen} aria-controls="haxbag-complex-actions" onClick={() => setComplexActionsOpen(open => !open)}>
                              <span className="combat-action-icon">🧠</span>
                              <strong>Ações Complexas</strong>
                              <small>{complexActionsOpen ? 'Fechar preparo' : 'Preparar bônus para a próxima ação'}</small>
                            </button>}
                            {isKisatsutaiSystem && !forEnemy && <button type="button" className="combat-action-card" aria-expanded={restActionsOpen} aria-controls="haxbag-rest-actions" onClick={() => setRestActionsOpen(open => !open)}>
                              <span className="combat-action-icon">🛏️</span>
                              <strong>Descanso</strong>
                              <small>{restActionsOpen ? 'Fechar opções de descanso' : 'Recuperar PV, PS e PR'}</small>
                            </button>}
                          </div>
                          {isKisatsutaiSystem && (() => {
                            const trainings = (read('skills.extraTrainings', {}) || {}) as Record<string, string>
                            const available = Object.entries(KISATSUTAI_SKILL_GROUPS).flatMap(([group, groupSkills]) =>
                              groupSkills.flatMap(skill => {
                                const key = `${group}:${skill.name}`
                                const level = trainings[key] as TrainingLevel | undefined
                                return level && Object.prototype.hasOwnProperty.call(KISATSUTAI_TRAINING, level)
                                  ? [{ key, name: skill.name, group, bonus: KISATSUTAI_TRAINING[level] }]
                                  : []
                              })
                            )
                            const selected = available.find(skill => skill.key === selectedSkillTest)
                            const testAttributes = [
                              { key: 'strength', label: 'Força', value: strength },
                              { key: 'agility', label: 'Agilidade', value: agility },
                              { key: 'defense', label: 'Defesa', value: defense },
                              { key: 'breathing', label: sheetResourceName, value: breathing },
                              { key: 'intellect', label: 'Intelecto', value: intellect },
                            ]
                            const testAttribute = testAttributes.find(attribute => attribute.key === selectedSkillAttribute) || testAttributes[0]
                            const testDiceCount = 1 + Math.floor(testAttribute.value)
                            const testDiceLabel = testDiceCount <= 0
                              ? `${2 - testDiceCount}D20 (desvantagem)`
                              : `${testDiceCount}D20 (maior dado)`
                            return skillTestOpen && <div className="combat-skill-test">
                              <div className="combat-skill-test-heading"><strong>✧ Teste de Perícia</strong><small>Escolha uma perícia e um atributo principal. O atributo define a quantidade de D20; o treinamento soma ao maior resultado.</small></div>
                              <div className="combat-skill-test-controls">
                                <label className="combat-skill-test-field"><span>Atributo principal</span><select aria-label="Atributo para o teste de perícia" value={testAttribute.key} onChange={event => setSelectedSkillAttribute(event.target.value)}>
                                  {testAttributes.map(attribute => <option key={attribute.key} value={attribute.key}>{attribute.label} ({attribute.value >= 0 ? '+' : ''}{attribute.value})</option>)}
                                </select></label>
                                <label className="combat-skill-test-field"><span>Perícia treinada</span><select aria-label="Perícia para o teste" value={selected?.key || ''} onChange={event => setSelectedSkillTest(event.target.value)}>
                                  <option value="">Selecionar perícia...</option>
                                  {available.map(skill => <option key={skill.key} value={skill.key}>{skill.name} · {skill.group} (+{skill.bonus})</option>)}
                                </select></label>
                                <button type="button" disabled={!selected} onClick={() => {
                                  if (!selected) return
                                  const conditionDiceBonus = conditionModifier(conditionRules.dice, 'status', testAttribute.key) + conditionModifier(conditionRules.dice, selected.group === 'Perícias de Arquétipo' ? 'archetype_skill' : 'extra_skill', selected.key) + conditionModifier(conditionRules.dice, 'main_skill', selected.name)
                                  const roll = rollAttributeDice(testDiceCount + conditionDiceBonus, testAttribute.key === 'agility')
                                  const attributeConditionBonus = applyConditionModifier(testAttribute.value, conditionModifiers, 'status', testAttribute.key) - testAttribute.value
                                  const skillGroup = selected.group === 'Perícias de Arquétipo' ? 'archetype_skill' : 'extra_skill'
                                  const trainedSkillBonus = applyConditionModifier(selected.bonus, conditionModifiers, skillGroup, selected.key)
                                  const skillConditionBonus = applyConditionModifier(trainedSkillBonus, conditionModifiers, 'main_skill', selected.name) - selected.bonus
                                  const conditionTotal = attributeConditionBonus + skillConditionBonus
                                  const preparationBonus = complexPending?.skill===selected.name ? complexPending.bonus : 0
                                  const total = roll.result + selected.bonus + conditionTotal + preparationBonus
                                  if(preparationBonus)setComplexPending(null)
                                  const diceDescription = roll.hasDisadvantage
                                    ? `${roll.rolls.length}D20 [${roll.rolls.join(', ')}] (desvantagem: ${roll.result})`
                                    : `${roll.effectiveDiceCount}D20 [${roll.rolls.join(', ')}] (maior: ${roll.result})`
                                  setBlockDamageReduction(null)
                                  setCombatActionResult(`Teste de Perícia — ${selected.name} (${selected.group}) com ${testAttribute.label} (${testAttribute.value}): ${diceDescription} + Treinamento (+${selected.bonus})${conditionTotal ? ` + Condições (${conditionTotal > 0 ? '+' : ''}${conditionTotal})` : ''} = ${total}.`)
                                }}>🎲 Rolar teste</button>
                              </div>
                              <small className="combat-skill-test-dice">{testAttribute.label}: {testDiceLabel} · Treinamento: {selected ? `+${selected.bonus}` : 'selecione uma perícia'}</small>
                              {available.length === 0 && <small className="combat-skill-test-empty">Nenhuma perícia treinada. Distribua treinamentos em Editar ficha para habilitar os testes.</small>}
                            </div>
                          })()}
                          {isKisatsutaiSystem && complexActionsOpen && (() => {
                            const trainings = (read('skills.extraTrainings', {}) || {}) as Record<string, string>
                            const skills = Object.entries(KISATSUTAI_SKILL_GROUPS).flatMap(([group, entries]) => entries.flatMap(skill => {
                              const key = `${group}:${skill.name}`
                              const level = trainings[key] as TrainingLevel | undefined
                              return level && Object.prototype.hasOwnProperty.call(KISATSUTAI_TRAINING, level) ? [{key, label: `${skill.name} · ${group}`, bonus: KISATSUTAI_TRAINING[level]}] : []
                            }))
                            const archetypeSkills = skills.filter(skill => !['Sociais', 'Conhecimentos Gerais', 'Naturais'].includes(skill.key.split(':')[0]))
                            const chosen = archetypeSkills.find(skill => skill.key === complexSkill)
                            const result = Number(complexResult)
                            const complexBonus = result >= 35 ? 5 : result >= 30 ? 4 : result >= 25 ? 3 : result >= 20 ? 2 : result >= 15 ? 1 : 0
                            const validResult = complexResult.trim() !== '' && Number.isFinite(result) && Number.isInteger(result) && result >= 0
                            const alreadyUsed = Boolean(chosen && complexUsed[chosen.key] > 0)
                            const savedBonus = chosen ? complexUsed[`${chosen.key}:bonus`] : undefined
                            const remainingPreparations = Math.max(0, 3 - complexSceneCount)
                            const canPrepare = Boolean(chosen && complexMainSkill && validResult && complexBonus > 0 && !alreadyUsed && remainingPreparations > 0)
                            const canRepeat = Boolean(chosen && complexMainSkill && alreadyUsed && remainingPreparations > 0)
                            const actionHint = remainingPreparations === 0 ? 'Limite da cena atingido. Inicie uma nova cena para continuar.' : !chosen ? 'Escolha uma perícia de arquétipo treinada.' : !complexMainSkill ? 'Escolha a perícia principal que receberá o bônus.' : !validResult ? 'Informe um resultado inteiro e não negativo.' : complexBonus === 0 ? 'O resultado precisa ser pelo menos 15 para gerar bônus.' : alreadyUsed ? 'Esta perícia já foi preparada nesta cena. Use Repetir preparo.' : 'Tudo pronto para preparar a ação.'
                            const thresholds = [{label:'15–19',bonus:1},{label:'20–24',bonus:2},{label:'25–29',bonus:3},{label:'30–34',bonus:4},{label:'35+',bonus:5}]
                            return <div id="haxbag-complex-actions" className="combat-skill-test hax-complex-panel">
                              <style>{`
                                .hax-complex-panel{width:100%;max-width:none;box-sizing:border-box;margin-top:12px;padding:20px;border-radius:18px;display:flex;flex-direction:column;gap:16px;min-width:0}
                                .hax-complex-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
                                .hax-complex-stat{display:flex;flex-direction:column;gap:4px;padding:13px;border-radius:12px;background:rgba(120,145,175,.065);border:1px solid var(--border-color,rgba(150,170,190,.17))}
                                .hax-complex-stat small{font-size:.73rem;opacity:.73}.hax-complex-stat strong{font-size:1.18rem;font-variant-numeric:tabular-nums}
                                .hax-complex-guide{display:flex;gap:9px;align-items:center;padding:12px 14px;border-radius:11px;border:1px dashed var(--border-color,rgba(150,170,190,.3));font-size:.84rem;line-height:1.5}
                                .hax-complex-guide.ready{border-style:solid;border-color:var(--accent,#75a8ed);background:rgba(90,145,220,.09)}
                                .hax-complex-result-preview{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.85rem}
                                .hax-complex-result-preview span{border-radius:8px;padding:7px 10px;background:rgba(120,145,175,.09)}
                                .hax-complex-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
                                .hax-complex-head strong{font-size:1.15rem;letter-spacing:-.02em}
                                .hax-complex-head small{display:block;opacity:.75;margin-top:5px;line-height:1.45}
                                .hax-complex-pill{border:1px solid var(--border-color,rgba(150,170,190,.25));background:rgba(120,145,175,.06);border-radius:999px;padding:7px 12px;font-size:.78rem;white-space:normal}
                                .hax-complex-progress{height:8px;border-radius:999px;background:rgba(120,145,175,.15);overflow:hidden}.hax-complex-progress span{display:block;height:100%;background:var(--accent,#75a8ed);border-radius:inherit;transition:width .2s ease}
                                .hax-complex-fields{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(180px,.65fr);gap:12px;align-items:end}
                                .hax-complex-fields label{min-width:0;display:grid;gap:8px;font-size:.84rem;font-weight:600}
                                .hax-complex-fields select,.hax-complex-fields input{width:100%;min-width:0;box-sizing:border-box;height:44px;border-radius:10px;padding:0 12px;background:var(--input-bg,rgba(10,16,22,.5));color:inherit;border:1px solid var(--border-color,rgba(150,170,190,.28))}
                                .hax-complex-fields select:focus,.hax-complex-fields input:focus{outline:2px solid var(--accent,#75a8ed);outline-offset:1px}
                                .hax-complex-scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
                                .hax-complex-tier{border:1px solid var(--border-color,rgba(150,170,190,.22));border-radius:12px;padding:12px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(120,145,175,.04);min-height:66px}
                                .hax-complex-tier strong{font-size:1.25rem;line-height:1.1}.hax-complex-tier small{opacity:.7;font-size:.76rem}
                                .hax-complex-tier.active{border-color:var(--accent,#75a8ed);background:rgba(90,145,220,.18);box-shadow:inset 0 0 0 1px var(--accent,#75a8ed)}
                                .hax-complex-status{border:1px solid var(--border-color,rgba(150,170,190,.25));border-radius:12px;padding:13px 15px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(120,145,175,.035)}
                                .hax-complex-status-text{display:flex;flex-direction:column;gap:5px;min-width:0}
                                .hax-complex-status strong{font-size:.94rem}.hax-complex-status small{opacity:.78;line-height:1.45}
                                .hax-complex-buttons{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
                                .hax-complex-buttons button{min-height:40px;padding:8px 14px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:5px}
                                .hax-complex-buttons button:disabled{opacity:.42;cursor:not-allowed;filter:none}
                                .hax-complex-note{opacity:.75;font-size:.78rem;line-height:1.5}
                                .hax-complex-empty{border:1px dashed var(--border-color,rgba(150,170,190,.35));border-radius:12px;padding:14px;display:flex;gap:11px;align-items:center;background:rgba(120,145,175,.035)}
                                .hax-complex-empty span{font-size:1.3rem}.hax-complex-empty div{display:grid;gap:3px}.hax-complex-empty small{opacity:.7}
                                .hax-complex-footer{padding-top:11px;border-top:1px solid var(--border-color,rgba(150,170,190,.17))}
                                @media(max-width:680px){.hax-complex-overview{grid-template-columns:repeat(3,minmax(0,1fr))}.hax-complex-stat{padding:9px}.hax-complex-stat strong{font-size:1rem}.hax-complex-fields{grid-template-columns:1fr}.hax-complex-panel{padding:14px;gap:12px}.hax-complex-scale{gap:5px}.hax-complex-tier{padding:10px 3px;min-height:58px}.hax-complex-tier strong{font-size:1.05rem}.hax-complex-buttons button{flex:1 1 145px}}
                              `}</style>
                              <div className="hax-complex-head">
                                <div><strong>🧠 Ações Complexas</strong><small>Escolha atributo, perícia de arquétipo e perícia principal beneficiada. Máximo de 3 preparações por cena.</small></div>
                                <span className="hax-complex-pill">⏳ Preparo: 1 ação · {complexSceneCount}/3 nesta cena</span>
                              </div>
                              <div className="hax-complex-overview">
                                <div className="hax-complex-stat"><small>Preparações usadas</small><strong>{complexSceneCount} / 3</strong></div>
                                <div className="hax-complex-stat"><small>Restantes</small><strong>{remainingPreparations}</strong></div>
                                <div className="hax-complex-stat"><small>Bônus atual</small><strong>{validResult && complexBonus > 0 ? `+${complexBonus}` : '—'}</strong></div>
                              </div>
                              <div className="hax-complex-progress" role="progressbar" aria-label="Ações complexas utilizadas nesta cena" aria-valuenow={complexSceneCount} aria-valuemin={0} aria-valuemax={3}><span style={{width:`${complexSceneCount / 3 * 100}%`}} /></div>
                              <div className="hax-complex-fields">
                                <label><span>1 · 🎲 Atributo</span><select value={complexAttribute} onChange={event=>setComplexAttribute(event.target.value)}><option value="intelligence">Intelecto</option><option value="strength">Força</option><option value="agility">Agilidade</option><option value="defense">Defesa</option><option value="resistance">Respiração</option></select></label>
                                <label><span>2 · 📚 Perícia de arquétipo</span><select value={chosen?.key || ''} onChange={e => {setComplexSkill(e.target.value);setComplexResult('')}}><option value="">Selecione uma perícia...</option>{archetypeSkills.map(skill => <option key={skill.key} value={skill.key}>{skill.label} (+{skill.bonus})</option>)}</select></label>
                                <label><span>3 · 🎯 Perícia principal beneficiada</span><select value={complexMainSkill} onChange={event=>setComplexMainSkill(event.target.value)}><option value="">Selecione...</option>{['Vigor','Resistência','Combate','Destreza','Mental','Habilidade'].map(skill=><option key={skill} value={skill}>{skill}</option>)}</select></label>
                                <label><span>🎲 Resultado total do teste</span><input type="number" min="0" step="1" value={complexResult} onChange={e => setComplexResult(e.target.value)} placeholder="Role ou informe o resultado" /></label>
                                <button type="button" className="secondary-button" disabled={!chosen} onClick={()=>{if(!chosen)return;const attributeValue=complexAttribute==='intelligence'?intellect:complexAttribute==='strength'?strength:complexAttribute==='agility'?agility:complexAttribute==='defense'?defense:resistance;const count=1+Math.floor(attributeValue)+conditionModifier(conditionRules.dice,'status',complexAttribute);const roll=rollAttributeDice(count,complexAttribute==='agility');const trained=applyConditionModifier(chosen.bonus,conditionModifiers,'archetype_skill',chosen.key);const total=roll.result+trained;setComplexResult(String(total));setCombatActionResult(`Ação Complexa — ${chosen.label}: ${roll.rolls.join(', ')} (${roll.hasDisadvantage?'menor':'maior'} ${roll.result}) + Perícia de Arquétipo ${trained>=0?'+':''}${trained} = ${total}.`)}}>🎲 Rolar (Atributo + 1)d20 + Perícia</button>
                              </div>
                              <div className="hax-complex-result-preview"><span>🎲 {complexAttribute === 'intelligence' ? 'Intelecto' : complexAttribute === 'strength' ? 'Força' : complexAttribute === 'agility' ? 'Agilidade' : complexAttribute === 'defense' ? 'Defesa' : 'Resistência'}</span><span>📚 {chosen?.label || 'Perícia não selecionada'}</span><span>🎯 {complexMainSkill || 'Destino não selecionado'}</span></div>
                              <div className="hax-complex-scale">{thresholds.map(tier => <div key={tier.label} className={`hax-complex-tier${validResult && complexBonus === tier.bonus ? ' active' : ''}`}><small>{tier.label}</small><strong>+{tier.bonus}</strong></div>)}</div>
                              <div className="hax-complex-status">
                                <div className="hax-complex-status-text"><strong>{validResult ? `✨ Bônus calculado: +${complexBonus}` : '✨ Bônus do preparo'}</strong><small>{alreadyUsed ? 'Perícia já utilizada: repita para restaurar o bônus original.' : 'Selecione as três opções e informe o resultado do teste (mínimo 15 para receber bônus).'}</small></div>
                                {complexPending && <span className="hax-complex-pill">🎯 Pendente: +{complexPending.bonus} · {complexPending.skill}</span>}
                              </div>
                              <div className={`hax-complex-guide${canPrepare || canRepeat ? ' ready' : ''}`} role="status">{canPrepare || canRepeat ? '✓' : 'ℹ️'} {actionHint}</div>
                              <div className="hax-complex-buttons">
                                <button type="button" disabled={!canPrepare} onClick={() => {if(!chosen || !canPrepare)return;setComplexUsed(old => ({...old,[chosen.key]:1,[`${chosen.key}:bonus`]:complexBonus}));setComplexSceneCount(count=>count+1);setComplexPending({skill:complexMainSkill,bonus:complexBonus});setCombatActionResult(`Ação Complexa — ${chosen.label}: resultado ${result}, bônus +${complexBonus} para a próxima ação de ${complexMainSkill}. Preparo realizado (1 ação).`)}}>🎯 Preparar ação</button>
                                <button type="button" disabled={!canRepeat} onClick={() => {if(!chosen || !canRepeat)return;const bonus = savedBonus ?? 0;setComplexSceneCount(count=>count+1);setComplexPending({skill:complexMainSkill||chosen.label,bonus});setCombatActionResult(`Ação Complexa repetida — ${chosen.label}. Uma ação gasta; bônus anterior +${bonus} para ${complexMainSkill || chosen.label} restaurado.`)}}>🔁 Repetir preparo</button>
                                <button type="button" className="secondary-button" onClick={() => {setComplexUsed({});setComplexSceneCount(0);setComplexPending(null);setComplexResult('')}}>↺ Nova cena</button>
                              </div>
                              {archetypeSkills.length === 0 && <div className="hax-complex-empty"><span>📚</span><div><strong>Nenhuma perícia de arquétipo disponível</strong><small>Treine uma Perícia de Arquétipo na ficha para habilitar o preparo.</small></div></div>}
                              <small className="hax-complex-note hax-complex-footer">💡 Limite de 3 preparações por cena, incluindo repetições. Reinicie somente ao começar uma nova cena. O bônus pendente é aplicado à próxima ação compatível com a perícia principal escolhida.</small>
                            </div>
                          })()}
                          {isKisatsutaiSystem && !forEnemy && restActionsOpen && <div id="haxbag-rest-actions"><RestActionsPanel
                            canApply={Boolean(canEditSelectedSheet && selectedCharacterId && selectedSeasonId)}
                            maxPR={Number(derived[2][1])}
                            inventoryItems={items.filter(item=>item.character_id===selectedCharacterId)}
                            onApply={async recovery => {
                              const parsed = JSON.parse(sheetDraft) as Record<string, any>
                              const status = parsed.status || {}
                              const current = status.current || {}
                              const max = sharedResourceMaximums
                              const getValue = (key: 'pv'|'ps'|'pr') => {
                                const value = Number(current[key] ?? max[key])
                                const maximum = Number(max[key])
                                if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum < 0) throw new Error(`Valores de ${key.toUpperCase()} inválidos na ficha.`)
                                return {value,maximum}
                              }
                              const pv = getValue('pv'), ps = getValue('ps'), pr = getValue('pr')
                              const next = {
                                ...parsed,
                                status: {...status, current: {
                                  ...current,
                                  pv: recovery.fullPV ? pv.maximum : Math.min(pv.maximum, pv.value + recovery.pv),
                                  ps: Math.min(ps.maximum, ps.value + recovery.ps),
                                  pr: recovery.fullPR ? pr.maximum : Math.min(pr.maximum, pr.value + recovery.pr),
                                }},
                              }
                              // A RPC de condições já é usada pelo HäxBag para persistir PV/PS/PR.
                              if (!sheet?.id) throw new Error('Salve a ficha antes de aplicar o descanso.')
                              const {data,error} = await supabase.rpc('apply_rest_with_scarcity', {
                                p_request_id: recovery.requestId,
                                p_sheet_id: sheet.id,
                                p_pv: next.status.current.pv,
                                p_ps: next.status.current.ps,
                                p_pr: next.status.current.pr,
                                p_food_id: recovery.foodItemId,
                                p_kit_id: recovery.kitItemId,
                                p_kit_type: recovery.kitType,
                              })
                              if (error || !data || typeof data !== 'object') throw new Error(error?.message || 'O banco não confirmou a recuperação.')
                              const response = data as {sheet_data?: Record<string, unknown>; consumed?: Array<{id:string;name:string;roll:number;die:number;level:number;exhausted:boolean}>}
                              if (!response.sheet_data) throw new Error('O banco não retornou a ficha atualizada.')
                              setSheet({...sheet,sheet_data:response.sheet_data})
                              setSheetDraft(JSON.stringify({...parsed,status:response.sheet_data.status || next.status},null,2))
                              const consumed = response.consumed || []
                              if (consumed.length) {
                                const {data: refreshed,error:refreshError} = await supabase.from('inventory_items').select('*').eq('character_id',selectedCharacterId)
                                if (!refreshError && refreshed) setItems(current=>[...current.filter(item=>item.character_id!==selectedCharacterId),...(refreshed as Item[])])
                              }
                              setNotice(`Descanso aplicado. ${consumed.map(item=>`${item.name}: d${item.die}=${item.roll}${item.exhausted?' (esgotou)':''}`).join(' · ')}`)
                            }}
                          /></div>}
                          <div className="combat-complementary-section">
                            <div className="combat-reactions-heading"><h3>Ações Complementares</h3><p>Role testes e ações auxiliares {forEnemy ? 'do inimigo' : 'do personagem'}.</p></div>
                            <div className="combat-action-grid combat-complementary-grid">
                              <button
                                type="button"
                                className="combat-action-card"
                                onClick={() => {
                                  const diceCount = 1
                                  const rolls = Array.from({ length: diceCount }, () => rollD20())
                                  const highest = Math.max(...rolls)
                                  const total = highest + armorDexterity

                                  setBlockDamageReduction(null)
                                  setCombatActionResult(
                                    `Iniciativa: ${diceCount}D20 = [${rolls.join(', ')}] (maior: ${highest}) + Destreza de armadura (${armorDexterity}) = ${total}.`
                                  )
                                  void persistRenderInitiative(total)
                                }}
                              >
                                <span className="combat-action-icon">⚡</span>
                                <strong>Iniciativa</strong>
                                <small>1D20 + Destreza de armadura ({armorDexterity})</small>
                              </button>

                              <button
                                type="button"
                                className="combat-action-card"
                                onClick={() => {
                                  const diceCount = 1 + Math.floor(strength)
                                  const roll = rollSheetAttributeDice(diceCount)
                                  const total = roll.result + vigor

                                  setBlockDamageReduction(null)
                                  setCombatActionResult(
                                    `Manobra de Luta: ${roll.description} + Vigor (${vigor}) = ${total}.`
                                  )
                                }}
                              >
                                <span className="combat-action-icon">⚔</span>
                                <strong>Manobra de Luta</strong>
                                <small>{Math.floor(1 + strength) <= 0 ? `${2 - Math.floor(1 + strength)}D20 (desvantagem)` : `${Math.floor(1 + strength)}D20`} + Vigor ({vigor})</small>
                              </button>

                              <button
                                type="button"
                                className="combat-action-card"
                                onClick={() => {
                                  const diceCount = 1 + Math.floor(defense)
                                  const roll = rollSheetAttributeDice(diceCount)
                                  const total = roll.result + resistance

                                  setBlockDamageReduction(null)
                                  setCombatActionResult(
                                    `Resistência Física: ${roll.description} + Respiração (${resistance}) = ${total}.`
                                  )
                                }}
                              >
                                <span className="combat-action-icon">⛨</span>
                                <strong>Resistência Física</strong>
                                <small>{Math.floor(1 + defense) <= 0 ? `${2 - Math.floor(1 + defense)}D20 (desvantagem)` : `${Math.floor(1 + defense)}D20`} + Resistência ({resistance})</small>
                              </button>

                              <button
                                type="button"
                                className="combat-action-card"
                                onClick={() => {
                                  const diceCount = 1 + Math.floor(intellect)
                                  const roll = rollSheetAttributeDice(diceCount)
                                  const total = roll.result + mental

                                  setBlockDamageReduction(null)
                                  setCombatActionResult(
                                    `Teste de Sanidade: ${roll.description} + Mental (${mental}) = ${total}.`
                                  )
                                }}
                              >
                                <span className="combat-action-icon">◈</span>
                                <strong>Teste de Sanidade</strong>
                                <small>{Math.floor(1 + intellect) <= 0 ? `${2 - Math.floor(1 + intellect)}D20 (desvantagem)` : `${Math.floor(1 + intellect)}D20`} + Mental ({mental})</small>
                              </button>
                            </div>
                          </div>

                          <div className="combat-reactions-section" id={forEnemy ? 'inimigo-reacoes' : 'ficha-reacoes'}>
                            <div className="combat-reactions-heading"><h3>Reações</h3><p>Escolha uma ação para rolar os dados automaticamente.</p></div>
                            <div className="combat-action-grid combat-reactions-grid">
                            <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Bloqueio', dodgeTarget)}><span className="combat-action-icon">▣</span><strong>Bloqueio</strong><small>{1 + Math.floor(defense) <= 0 ? `${2 - (1 + Math.floor(defense))}D20 (desvantagem)` : `${1 + Math.floor(defense)}D20`} + Vigor + Respiração</small></button>
                            <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Esquiva', dodgeTarget)}><span className="combat-action-icon">↗</span><strong>Esquiva</strong><small>
  {(() => {
    const diceCount = 1 + Math.floor(agility) - (renderOverloaded ? 1 : 0)
    return `${diceCount <= 0 ? `${2 - diceCount}D20 (desvantagem)` : `${diceCount}D20`} + Destreza de armadura (${armorDexterity})`
  })()}
</small></button>
                              <button
                                type="button"
                                className="combat-action-card"
                                disabled={conditionRules.restrictions.some(key=>['counterattack','no_reactions','all_actions'].includes(key))}
                                title={conditionRules.restrictions.some(key=>['counterattack','no_reactions','all_actions'].includes(key))?'Contra-ataque bloqueado por uma condição ativa':undefined}
                                onClick={() => {
                                  if(conditionRules.restrictions.some(key=>['counterattack','no_reactions','all_actions'].includes(key))){setCombatActionResult('Contra-ataque bloqueado por condição ativa.');return}
                                  const actionConfig = activeSystem?.data?.combatActions?.['Contra-ataque']

                                  if (!actionConfig) {
                                    setCombatActionResult(
                                      `O sistema ${activeSystem?.name ?? 'selecionado'} ainda não possui uma configuração de contra-ataque.`
                                    )
                                    return
                                  }

                                  const enemy =
                                    dodgeTarget.trim() === ''
                                      ? null
                                      : Number(dodgeTarget)

const dt = counterAttackDT

                                  const validEnemy =
                                    enemy !== null &&
                                    Number.isFinite(enemy) &&
                                    enemy >= 0

    setBlockIncomingDamage('')
    setBlockDamageReduction(validEnemy ? (enemy! < dt ? 1 : 0) : null)

                                  setCombatActionResult(
                                    validEnemy
                                      ? `Contra-ataque: resultado do inimigo ${enemy} ${enemy < dt ? '<' : '≥'} sua DT ${dt}. ${enemy < dt ? 'Contra-ataque bem-sucedido.' : 'Contra-ataque não sucedido.'}`
                                      : 'Informe a DT do inimigo no campo ao lado das reações.'
                                  )
                                }}
                              >
                                <span className="combat-action-icon">↶</span>
                                <strong>Contra-ataque</strong>
<small>DT: {counterAttackDT}</small>
                              </button>
                              <label className="combat-dodge-target-inline combat-reactions-dt-card" htmlFor="combat-dodge-target">DT do inimigo<input id="combat-dodge-target" type="number" min="0" step="1" value={dodgeTarget} onChange={event=>setDodgeTarget(event.target.value)} placeholder="DT" /></label>
                            </div>
                          </div>

                          <div className="combat-action-result"><div className="combat-result-title"><span>Resultado da rolagem</span><span className="combat-result-die">D20</span></div><p>{combatActionResult || 'Nenhuma ação rolada ainda. Escolha uma das ações acima.'}</p>{blockDamageReduction !== null && blockDamageReduction !== 1 && <div className="combat-block-damage-entry"><div className="combat-block-damage-heading"><strong>Dano recebido</strong><button type="button" className="combat-block-damage-close" onClick={()=>{setBlockDamageReduction(null);setBlockIncomingDamage('')}} aria-label="Fechar dano total do inimigo">Fechar</button></div>{blockDamageReduction !== 1 && (
<label htmlFor="combat-incoming-damage-type">

  Categoria do dano recebido
  <select
    id="combat-incoming-damage-type"
    value={blockPhysicalDamageType}
    onChange={event => setBlockPhysicalDamageType(event.target.value as 'cortante_perfurante' | 'especial_bruto')}
  >
    <option value="cortante_perfurante">Cortante e perfurante</option>
    <option value="especial_bruto">Especial e bruto</option>
  </select>
</label>
)}
{blockDamageReduction !== 1 && (
  <label htmlFor="combat-incoming-damage">
    Dano total do inimigo
    <input
      id="combat-incoming-damage"
      type="number"
      min="0"
      step="1"
      value={blockIncomingDamage}
      onChange={event => setBlockIncomingDamage(event.target.value)}
      placeholder="Informe o dano recebido"
    />
  </label>
)}<div className="combat-block-damage-preview">
  {(() => {
    const incoming = Number(blockIncomingDamage)

    if (
      blockIncomingDamage.trim() === '' ||
      !Number.isFinite(incoming) ||
      incoming < 0
    ) {
      return <>Informe o dano recebido para visualizar os cálculos.</>
    }

    const { reactionPrevented, armorPrevented, remaining } = calculateSheetPhysicalDamage({
      incoming,
      reactionReduction: blockDamageReduction,
      damageType: blockPhysicalDamageType,
      defenses: characterDefenses,
      specialBruteProtectionOnly: isKisatsutaiSystem,
    })

    return (
      <>
        Dano inicial: <strong>{incoming}</strong>
        {' · '}Negado pela reação: <strong>{reactionPrevented}</strong>
        {' · '}Reduzido pela armadura e proteções: <strong>{armorPrevented}</strong>
        {' · '}Dano aplicado aos PV: <strong>{remaining}</strong>
      </>
    )
  })()}
</div><button type="button" className="combat-counter-button" onClick={applyBlockedDamage} disabled={blockIncomingDamage.trim() === '' || !Number.isFinite(Number(blockIncomingDamage)) || Number(blockIncomingDamage) < 0}>Aplicar dano aos PV</button></div>}</div>
                          <details className="combat-rules"><summary>Consultar regras das ações</summary><div className="combat-rules-grid"><p><strong>Ataque Bruto</strong><span>1 + Força d20 + Combate.</span></p><p><strong>Ataque Ágil</strong><span>1 + Agilidade d20 + Combate.</span></p><p><strong>Ataque Especial</strong><span>1 + Resistência d20 + Habilidade.</span></p><p><strong>Iniciativa</strong><span>1D20 + Destreza de armadura. Habilidades podem conceder D20 adicionais.</span></p>
<p><strong>Manobra de Luta</strong><span>1 + Força D20 (utiliza o maior resultado) + Vigor.</span></p>
<p><strong>Resistência Física</strong><span>1 + Defesa D20 (utiliza o maior resultado) + Resistência.</span></p>
<p><strong>Teste de Sanidade</strong><span>1 + Intelecto D20 (utiliza o maior resultado) + Mental.</span></p><p><strong>Bloqueio</strong><span>1 + Defesa d20 + Constituição. Falha: nega ¼ do dano; sucesso (resultado maior que DT): nega ½ do dano; crítico: dano completo negado.</span></p><p><strong>Esquiva</strong><span>1 + Agilidade d20 + Destreza de armadura. Se alcançar a DT, nega 100% do dano.</span></p><p>
  <strong>Contra-ataque</strong>
  <span>
    O resultado do inimigo precisa ser menor que sua DT de Contra-ataque
    {activeSystem?.data?.combatActions?.['Contra-ataque']
      ? ` (${activeSystem.data.combatActions['Contra-ataque']!.attributeLabel} + ${activeSystem.data.combatActions['Contra-ataque']!.bonusLabel}: ${
counterAttackDT
        }).`
      : ', ainda não configurada para este sistema.'}
  </span>
</p></div></details>
                        </section>
                    </>
                    )

                  })()}</>
  }

  if (authLoading) {
    return <main style={centerStyle}>Verificando sua sessão...</main>
  }

  if (!session) return <Auth />

  return (
    <div className={`app-shell hb-polish theme-${activeThemeKey} visual-style-${activeVisualStyleKey}`} style={{'--season-primary': activeTheme.primary, '--season-secondary': activeTheme.secondary, '--season-glow': activeTheme.glow, '--season-bg': activeTheme.bg, '--season-surface': activeTheme.surface, '--season-surface-alt': activeTheme.surfaceAlt, '--season-line': activeTheme.line, '--season-line-soft': activeTheme.glow.replace(/\.\d+\)/, '.14)'), '--season-muted': '#b9b4c2', '--season-on-primary': activeTheme.onPrimary,  '--season-panel-tint': activeTheme.surfaceAlt, '--purple': activeTheme.primary, '--purple-bright': activeTheme.primary, '--purple-dark': activeTheme.secondary} as React.CSSProperties}>
      <ChestMessages userId={session.user.id} campaignId={selectedCampaignId} />
      <aside className="sidebar hb-sidebar" aria-label="Menu principal do HäxBag">
        <a className="brand hb-sidebar-brand" href="#inicio" onClick={() => setActivePage('overview')} aria-label="HäxBag — ir para visão geral">
          <span className="brand-mark"><img src="/haxbag-symbol.png" alt="" aria-hidden="true" className="hb-brand-symbol" /></span>
          <span className="hb-sidebar-brand-copy">
            <strong>Häx<span className="brand-light">Bag</span></strong>
            <small>SEU UNIVERSO DE RPG</small>
          </span>
          <span className="hb-sidebar-brand-spark" aria-hidden="true">✦</span>
        </a>

        <div className="hb-sidebar-style-identity" title={`Identidade visual da temporada: ${activeVisualStyle.label}`}>
          <span className="hb-sidebar-style-emblem" aria-hidden="true">{activeVisualStyle.symbol}</span>
          <span className="hb-sidebar-style-text">
            <small>ESTILO DA TEMPORADA</small>
            <strong>{activeVisualStyle.label}</strong>
            <span className="hb-sidebar-style-signature">// {(selectedCampaign?.name?.trim() || 'CAMPANHA').toLocaleUpperCase('pt-BR')}</span>
          </span>
          <span className="hb-sidebar-style-ornament" aria-hidden="true">✧</span>
        </div>

        <section className="hb-sidebar-workspace" aria-label="Campanha atual" style={{display:"flex",flexDirection:"column",height:"auto",minHeight:0,maxHeight:"none",overflow:"visible",flexShrink:0,position:"relative",zIndex:2,padding:"15px 13px 12px"}}>
          <div className="hb-sidebar-workspace-top">
            <span className="hb-sidebar-eyebrow">✦ ESPAÇO DE JOGO</span>
            <span className="hb-sidebar-role">{isMaster ? 'Mestre' : 'Jogador'}</span>
          </div>
          <label htmlFor="hb-campaign-switch">Campanha selecionada</label>
          <div className="hb-sidebar-campaign-field">
            <span className="hb-sidebar-campaign-symbol" aria-hidden="true">⚑</span>
            <select
              id="hb-campaign-switch"
              value={selectedCampaignId}
              onChange={async event => {
                const campaignId = event.target.value
                setSelectedCampaignId(campaignId)
                const { error: preferenceError } = await supabase.auth.updateUser({ data: { primary_campaign_id: campaignId || null } })
                if (preferenceError) setError(`Campanha selecionada, mas não foi possível salvar como principal: ${preferenceError.message}`)
                else if (activePage !== 'profile' && activePage !== 'master-chest') setNotice('Campanha principal atualizada para este perfil.')
              }}
              aria-label="Selecionar campanha ativa"
            >
              <option value="">Selecione uma campanha</option>
              {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </div>
          <button type="button" className="hb-sidebar-create" onClick={() => {
            setActivePage('campaigns'); setEditingCampaignId(null); setShowCampaignForm(true)
            setCampaignName(''); setCampaignDescription(''); setSystemName(''); setCampaignSystemChoice('')
          }}><span aria-hidden="true">＋</span> Criar campanha</button>
        </section>

        <nav className="navigation hb-sidebar-nav" aria-label="Navegação principal">
          <div className="hb-sidebar-nav-group">
            <span className="hb-sidebar-group-title">EXPLORAR</span>
            <button type="button" className={`nav-link ${activePage === 'overview' ? 'active' : ''}`} onClick={() => setActivePage('overview')} disabled={!selectedCampaignId} aria-current={activePage === 'overview' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">◫</span><span className="hb-sidebar-nav-name">Visão geral</span>
            </button>
            <button type="button" className={`nav-link ${activePage === 'player-table' ? 'active' : ''}`}
              onClick={() => { setActivePage('player-table') }}
              disabled={!selectedCampaignId} aria-current={activePage === 'player-table' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">▦</span>
              <span className="hb-sidebar-nav-name">Mesa dos jogadores</span>
              <span className="hb-sidebar-nav-flair">MESA</span>
            </button>
            {isMaster && <button type="button" className={`nav-link ${activePage === 'master-shield' ? 'active' : ''}`} onClick={() => setActivePage('master-shield')} disabled={!selectedCampaignId} aria-current={activePage === 'master-shield' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">♜</span><span className="hb-sidebar-nav-name">Escudo do mestre</span><span className="hb-sidebar-nav-flair">MESTRE</span>
            </button>}
            {isMaster && <button type="button" className={`nav-link ${activePage === 'master-chest' ? 'active' : ''}`} onClick={() => { setNotice(''); setActivePage('master-chest') }} disabled={!selectedCampaignId} aria-current={activePage === 'master-chest' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">🗝</span><span className="hb-sidebar-nav-name">Baú do Mestre</span><span className="hb-sidebar-nav-flair">MESTRE</span>
            </button>}
          </div>
          <div className="hb-sidebar-nav-group">
            <span className="hb-sidebar-group-title">PERSONAGENS E FICHAS</span>
            <button type="button" className={`nav-link ${activePage === 'sheets' ? 'active' : ''}`} onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }} disabled={!selectedCampaignId} aria-current={activePage === 'sheets' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">▧</span><span className="hb-sidebar-nav-name">Fichas</span><span className="nav-count">{characters.length}</span>
            </button>
            {isMaster && <button type="button" className={`nav-link ${activePage === 'enemies' ? 'active' : ''}`} onClick={() => setActivePage('enemies')} disabled={!selectedCampaignId} aria-current={activePage === 'enemies' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">⚔</span><span className="hb-sidebar-nav-name">Inimigos</span><span className="nav-count">{enemies.length}</span>
            </button>}
            {isMaster && <button type="button" className={`nav-link ${activePage === 'conditions' ? 'active' : ''}`} onClick={() => setActivePage('conditions')} disabled={!selectedCampaignId} aria-current={activePage === 'conditions' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">✦</span><span className="hb-sidebar-nav-name">Condições</span><span className="hb-sidebar-nav-flair">MESTRE</span>
            </button>}
          </div>
          <div className="hb-sidebar-nav-group">
            <span className="hb-sidebar-group-title">MUNDO DA CAMPANHA</span>
            <button type="button" className={`nav-link ${activePage === 'shops' ? 'active' : ''}`} onClick={() => setActivePage('shops')} disabled={!selectedCampaignId} aria-current={activePage === 'shops' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">▤</span><span className="hb-sidebar-nav-name">Lojas</span><span className="nav-count">{shops.length}</span>
            </button>
            <button type="button" className={`nav-link ${activePage === 'bestiary' ? 'active' : ''}`} onClick={() => setActivePage('bestiary')} disabled={!selectedCampaignId} aria-current={activePage === 'bestiary' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">♞</span><span className="hb-sidebar-nav-name">Bestiário</span><span className="nav-count">{creatures.length}</span>
            </button>
            <button type="button" className={`nav-link ${activePage === 'campaigns' ? 'active' : ''}`} onClick={() => { setActivePage('campaigns'); setShowCampaignForm(false) }} aria-current={activePage === 'campaigns' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">⚑</span><span className="hb-sidebar-nav-name">Campanhas</span><span className="nav-count">{campaigns.length}</span>
            </button>
            <button type="button" className={`nav-link ${activePage === 'customization' ? 'active' : ''}`} onClick={() => { setNotice(''); setActivePage('customization') }} disabled={!selectedCampaignId} aria-current={activePage === 'customization' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">✧</span><span className="hb-sidebar-nav-name">Customização</span>
            </button>
          </div>
          <div className="hb-sidebar-nav-group">
            <span className="hb-sidebar-group-title">CONTA</span>
            <button type="button" className={`nav-link ${activePage === 'profile' ? 'active' : ''}`} onClick={openProfilePage} aria-current={activePage === 'profile' ? 'page' : undefined}>
              <span className="hb-sidebar-nav-icon" aria-hidden="true">♙</span><span className="hb-sidebar-nav-name">Meu perfil</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom hb-sidebar-footer">
          <div className="invite-card hb-sidebar-invite">
            <div className="hb-sidebar-invite-top"><span className="invite-icon" aria-hidden="true">✉</span><span className="hb-sidebar-invite-tag">SUA EQUIPE</span></div>
            <strong>{isMaster && selectedCampaignId ? 'Reúna seus jogadores' : 'Continue sua aventura'}</strong>
            <p>{isMaster && selectedCampaignId
              ? 'Envie um convite para a campanha e reúna seu grupo.'
              : 'Encontre uma campanha ou participe usando um convite.'}</p>
            <button type="button" className="hb-sidebar-invite-button" disabled={inviteLoading} onClick={() => {
              if (isMaster && selectedCampaignId) void createCampaignInvite()
              else { setActivePage('campaigns'); setShowCampaignForm(false) }
            }}>{inviteLoading ? 'Gerando convite…' : isMaster && selectedCampaignId ? 'Gerar convite' : 'Ver campanhas'} <span aria-hidden="true">↗</span></button>
            {campaignInviteLink && selectedCampaignId && isMaster && <button type="button" className="hb-sidebar-copy" onClick={() => {
              void navigator.clipboard.writeText(campaignInviteLink)
              setNotice('Link copiado!')
            }}>⧉ Copiar link gerado</button>}
          </div>
          <button type="button" className="profile hb-sidebar-profile hb-profile-shortcut" onClick={openProfilePage} title="Abrir meu perfil">
            <div className="avatar">{accountAvatar || displayName.charAt(0).toUpperCase()}</div>
            <div className="profile-info"><strong>{displayName}</strong><small>{session.user.email}</small></div>
            <span className="hb-sidebar-online" aria-label="Conectado" title="Conectado" />
          </button>
        </div>
      </aside>

      <main className={`main-content ${activePage === 'player-table' ? 'hb-vtt-app-main' : ''}`} id="inicio">
        <header className="topbar">
          <div className="breadcrumb hb-topbar-trail">
            <span>HäxBag</span><span className="crumb-slash">/</span>
            <span className="hb-topbar-campaign">{selectedCampaign?.name ?? 'Suas campanhas'}</span>
            <span className="crumb-slash">/</span>
            <strong>{({ overview: 'Visão geral', 'master-shield': 'Escudo do mestre', 'master-chest': 'Baú do Mestre', sheets: 'Fichas', enemies: 'Inimigos', shops: 'Lojas', bestiary: 'Bestiário', campaigns: 'Campanhas', customization: 'Customização', 'player-table': 'Mesa dos jogadores', profile: 'Meu perfil', conditions: 'Condições' } as Record<string, string>)[activePage]}</strong>
          </div>

          <div className="topbar-right">
            <span className="hb-topbar-style-badge" title={`Identidade visual: ${activeVisualStyle.label}`}>
              <span aria-hidden="true">{activeVisualStyle.symbol}</span>
              <strong>{activeVisualStyle.label}</strong>
            </span>
            <span className="online-dot" />
            Conectado
            <button
              type="button"
              className="hb-topbar-logout"
              onClick={handleSignOut}
              style={secondaryButtonStyle}
            >
              Sair
            </button>
          </div>
        </header>

        <div className={`page-content page-${activePage}`}>
          {activePage === 'master-chest' && isMaster && selectedCampaignId && (
            <MasterChest
              key={selectedCampaignId}
              campaignId={selectedCampaignId}
              characters={characters.map(character => ({ id: character.id, campaign_id: character.campaign_id, name: character.name, emoji: character.emoji }))}
              currencyOptions={selectedCampaign?.currency_config?.currencies ?? []}
              onDelivered={() => {
                if (selectedCharacterId) {
                  void supabase.from('inventory_items')
                    .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
                    .eq('character_id', selectedCharacterId)
                    .order('created_at', { ascending: true })
                    .then(({ data }) => { if (data) setItems((data as Item[]).filter(item => item.metadata?.cybernetic !== true || item.metadata?.cyberneticEquipped !== true)) })
                }
              }}
            />
          )}
          <style>{`
/* HäxBag · Fichas — renovação visual completa, compartilhada por jogadores e inimigos */
.page-content.page-sheets .sheet-page-panel,
.page-content.page-enemies .enemy-sheet-panel {
  --sheet-ink: var(--season-text, #f0eae4);
  --sheet-dim: var(--season-muted, #aea7a6);
  --sheet-line: var(--season-line, rgba(255,255,255,.14));
  --sheet-accent: var(--season-accent, var(--season-primary, #e1a978));
  --sheet-aura: var(--season-accent-soft, color-mix(in srgb, var(--season-primary, #e1a978) 12%, transparent));
  min-width: 0;
}
.page-content.page-sheets .sheet-page-panel { border-radius: 22px; }
.sheet-page-hero { position: relative; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:22px; margin:0 0 23px !important; padding:24px 27px !important; overflow:hidden; isolation:isolate; border:1px solid var(--sheet-line) !important; border-radius:22px; background:radial-gradient(ellipse at 0% 0%,var(--sheet-aura),transparent 53%),linear-gradient(135deg,var(--season-surface,#28232a),var(--season-bg,#161318)) !important; box-shadow:0 15px 35px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.06); }
.sheet-page-hero:after { content:''; position:absolute; right:-32px; top:-80px; width:190px; height:190px; border:1px solid color-mix(in srgb,var(--sheet-accent) 20%,transparent); border-radius:50%; box-shadow:0 0 0 25px color-mix(in srgb,var(--sheet-accent) 4%,transparent),0 0 0 55px color-mix(in srgb,var(--sheet-accent) 2%,transparent); z-index:-1; pointer-events:none; }
/* Ações da ficha de inimigo: estado de salvamento em faixa separada dos atalhos. */
.sheet-enemy-hero { display:flex !important; flex-direction:column; align-items:stretch !important; gap:20px !important; }
.sheet-enemy-hero::after { opacity:.38; right:-95px; top:-110px; }
.enemy-sheet-hero-top { display:flex; align-items:center; justify-content:space-between; gap:18px 24px; flex-wrap:wrap; width:100%; position:relative; z-index:1; }
.enemy-sheet-hero-utilities { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:9px; }
.enemy-sheet-hero-utilities .secondary-button { min-height:39px; padding:9px 14px; font-size:12px; border-radius:11px; white-space:nowrap; }
.enemy-sheet-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px 22px; flex-wrap:wrap; width:100%; min-width:0; padding:14px 16px; position:relative; z-index:1; border:1px solid var(--sheet-line); border-radius:16px; background:linear-gradient(135deg,var(--season-surface-alt,rgba(255,255,255,.06)),var(--season-bg,rgba(0,0,0,.22))); box-shadow:inset 0 1px 0 rgba(255,255,255,.045); }
.enemy-sheet-save-indicator { display:flex; align-items:center; gap:11px; flex:1 1 205px; min-width:0; }
.enemy-sheet-save-icon { display:grid; place-items:center; width:38px; height:38px; flex:0 0 38px; border:1px solid color-mix(in srgb,var(--sheet-accent) 30%,transparent); border-radius:12px; background:var(--sheet-aura); color:var(--sheet-accent); font-weight:900; font-size:19px; line-height:1; }
.enemy-sheet-save-copy { min-width:0; }
.enemy-sheet-save-copy strong { display:block; color:var(--sheet-ink); font-size:13px; line-height:1.4; font-weight:800; }
.enemy-sheet-save-copy small { display:block; margin-top:3px; font-size:11px; line-height:1.45; color:var(--sheet-dim); }
.enemy-sheet-save-indicator.is-saved .enemy-sheet-save-icon { border-color:rgba(100,202,156,.25); color:#8bd8a9; background:rgba(100,202,156,.09); }
.enemy-sheet-save-indicator.is-error .enemy-sheet-save-icon { border-color:rgba(249,135,135,.3); color:#f59d9d; background:rgba(249,135,135,.1); }
.enemy-sheet-save-indicator.is-pending .enemy-sheet-save-icon { border-color:rgba(238,180,96,.32); color:#edc18d; background:rgba(238,180,96,.10); }
.enemy-sheet-save-indicator.is-saving .enemy-sheet-save-icon { animation:enemy-save-pulse 1.8s ease-in-out infinite; }
@keyframes enemy-save-pulse { 50% { opacity:.55; } }
.enemy-sheet-toolbar-actions { display:flex; align-items:center; justify-content:flex-end; gap:9px; flex-wrap:wrap; flex:0 1 auto; }
.enemy-sheet-toolbar-actions button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:41px; padding:10px 16px; border-radius:11px; white-space:nowrap; font-size:12px; font-weight:800; }
.enemy-sheet-toolbar-actions button span { font-size:16px; line-height:1; }
.enemy-sheet-save-button:disabled { cursor:wait; }
@media (max-width:680px) { .enemy-sheet-hero-top { align-items:flex-start; } .enemy-sheet-hero-utilities { justify-content:flex-start; } .enemy-sheet-toolbar { align-items:stretch; } }
@media (max-width:460px) { .enemy-sheet-toolbar-actions { width:100%; justify-content:stretch; } .enemy-sheet-toolbar-actions button { flex:1 1 auto; } .enemy-sheet-hero-utilities { width:100%; } .enemy-sheet-hero-utilities button { flex:1 1 auto; } }
@media (prefers-reduced-motion:reduce) { .enemy-sheet-save-indicator.is-saving .enemy-sheet-save-icon { animation:none; } }

.sheet-page-hero-leading { display:flex; align-items:center; min-width:0; gap:18px; }
.sheet-page-hero-icon { display:grid; place-items:center; width:66px; height:66px; flex:0 0 66px; border:1px solid color-mix(in srgb,var(--sheet-accent) 32%,transparent); border-radius:19px; background:linear-gradient(150deg,color-mix(in srgb,var(--sheet-accent) 20%,transparent),var(--season-surface-alt,rgba(255,255,255,.05))); color:var(--sheet-accent); font-size:31px; box-shadow:inset 0 1px 0 rgba(255,255,255,.08); }
.sheet-page-eyebrow { display:block; margin-bottom:7px; color:var(--sheet-accent); font-size:10px; font-weight:850; letter-spacing:.15em; text-transform:uppercase; }
.sheet-page-hero h2 { color:var(--sheet-ink); font-size:clamp(24px,3vw,34px) !important; font-weight:850 !important; letter-spacing:-.045em !important; line-height:1.15; margin:0 !important; }
.sheet-page-hero p { color:var(--sheet-dim) !important; font-size:13px !important; line-height:1.55 !important; max-width:650px; margin:7px 0 0 !important; }
.sheet-library-total { padding:9px 13px; border:1px solid var(--sheet-line); border-radius:999px; background:var(--season-surface-alt,rgba(255,255,255,.06)); color:var(--sheet-ink); font-size:12px; font-weight:750; white-space:nowrap; }
.sheet-page-back { position:relative; z-index:2; flex:0 0 auto; min-height:43px; border-radius:11px; }
.sheet-library-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr)); gap:16px; margin:0 0 22px; }
.sheet-library-card { display:flex; flex-direction:column; min-width:0; min-height:254px; padding:20px; border:1px solid var(--sheet-line); border-radius:20px; background:linear-gradient(155deg,var(--season-surface-alt,rgba(255,255,255,.05)),var(--season-surface,rgba(0,0,0,.18))); box-shadow:0 12px 30px rgba(0,0,0,.10); transition:transform .18s,border-color .18s,box-shadow .18s; }
.sheet-library-card:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--sheet-accent) 46%,transparent); box-shadow:0 18px 35px rgba(0,0,0,.19); }
.sheet-library-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.sheet-library-avatar { display:grid; place-items:center; width:57px; height:57px; border:1px solid color-mix(in srgb,var(--sheet-accent) 28%,transparent); border-radius:17px; background:var(--sheet-aura); font-size:27px; }
/* Administração e criação diretamente na biblioteca de Fichas */
.sheet-library-toolbar { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:10px; }
.sheet-library-toolbar .sheet-library-total { white-space:nowrap; }
.sheet-library-manage-button,.sheet-library-create-button { min-height:40px; white-space:nowrap; border-radius:12px; }
.sheet-library-admin-notice { display:flex; align-items:center; flex-wrap:wrap; gap:14px; padding:15px 18px; margin-bottom:20px; border:1px solid color-mix(in srgb,var(--sheet-accent) 30%,var(--sheet-line)); border-radius:15px; background:var(--sheet-aura); }
.sheet-library-admin-notice > span { display:grid; place-items:center; width:40px; height:40px; flex:0 0 40px; border-radius:12px; background:color-mix(in srgb,var(--sheet-accent) 15%,transparent); color:var(--sheet-accent); font-size:22px; }
.sheet-library-admin-notice > div { flex:1 1 210px; }
.sheet-library-admin-notice strong { color:var(--sheet-ink); font-size:14px; }
.sheet-library-admin-notice p { margin:4px 0 0; font-size:12px; line-height:1.55; color:var(--sheet-dim); }
.sheet-page-panel .hb-character-form { display:grid; gap:13px; padding:22px; margin:0 0 22px; border:1px solid var(--sheet-line); border-radius:18px; background:var(--season-surface,rgba(28,26,30,.93)); }
.sheet-page-panel .hb-character-form .hb-form-heading { display:flex; align-items:center; gap:12px; }
.sheet-page-panel .hb-character-form .hb-form-heading h3 { margin:0; }
.sheet-page-panel .hb-character-form .hb-form-heading p { margin:4px 0 0; color:var(--sheet-dim); font-size:13px; }
.sheet-page-panel .hb-character-form > label { display:grid; gap:7px; }
.sheet-library-card:has(.sheet-library-delete-button) { border-color:color-mix(in srgb,#d16e73 32%,var(--sheet-line)); }
.sheet-library-delete-button { margin:0 17px 17px; min-height:37px; border:1px solid color-mix(in srgb,#d16e73 45%,transparent); border-radius:11px; color:#e99ca3; }
.sheet-library-delete-button:hover:not(:disabled) { background:color-mix(in srgb,#d16e73 13%,transparent); }
@media(max-width:640px) { .sheet-library-toolbar { width:100%; justify-content:flex-start; } .sheet-library-toolbar .sheet-library-total { width:100%; } .sheet-library-manage-button,.sheet-library-create-button { flex:1; } .sheet-library-admin-notice .secondary-button { width:100%; } }

/* O emoji do cartão em Fichas abre o seletor já existente. */
button.sheet-library-avatar-edit { position:relative; flex:0 0 57px; padding:0; color:inherit; font-family:inherit; line-height:1; cursor:pointer; transition:transform .18s, background .18s, border-color .18s, box-shadow .18s; }
button.sheet-library-avatar-edit::after { content:'✎'; position:absolute; right:-6px; bottom:-5px; display:grid; place-items:center; width:21px; height:21px; border:1px solid var(--sheet-line); border-radius:8px; background:var(--season-surface,#28232a); color:var(--sheet-accent); font-size:12px; font-weight:800; pointer-events:none; box-shadow:0 2px 9px rgba(0,0,0,.22); }
button.sheet-library-avatar-edit:hover { transform:translateY(-2px) scale(1.04); border-color:var(--sheet-accent); background:color-mix(in srgb,var(--sheet-accent) 20%,transparent); box-shadow:0 6px 18px var(--sheet-aura); }
button.sheet-library-avatar-edit:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:4px; }

.sheet-library-system { padding:6px 10px; max-width:130px; border:1px solid var(--sheet-line); border-radius:999px; color:var(--sheet-dim); font-size:10px; font-weight:750; text-align:right; overflow-wrap:anywhere; }
.sheet-library-info { flex:1; padding:20px 0; }
.sheet-library-info h3 { margin:0 0 5px; font-size:21px; line-height:1.25; font-weight:850; letter-spacing:-.03em; overflow-wrap:anywhere; }
.sheet-library-info p { margin:0; color:var(--sheet-dim); font-size:13px; line-height:1.5; }
.sheet-library-rank { display:inline-block; margin-top:11px; color:var(--sheet-accent); font-size:12px; font-weight:700; }
.sheet-library-open { display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; min-height:44px; padding:11px 14px; border:1px solid color-mix(in srgb,var(--sheet-accent) 30%,transparent); border-radius:12px; background:var(--sheet-aura); color:var(--sheet-ink); font:inherit; font-size:13px; font-weight:800; cursor:pointer; transition:background .2s,border-color .2s; }
.sheet-library-open:hover { background:color-mix(in srgb,var(--sheet-accent) 20%,transparent); border-color:var(--sheet-accent); }
.sheet-library-open span { color:var(--sheet-accent); font-size:19px; }
.sheet-library-empty { text-align:center; padding:48px 20px; border:1px dashed var(--sheet-line); border-radius:20px; }
.sheet-library-empty > span { display:block; margin:0 auto 14px; color:var(--sheet-accent); font-size:42px; }
/* Atribuição de jogador: apenas o mestre, dentro da ficha do personagem. */
.sheet-current-player-panel { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px 26px; margin:0 0 21px; padding:17px 19px; border:1px solid var(--sheet-line); border-radius:16px; background:linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.045)),var(--season-surface,rgba(0,0,0,.15))); }
.sheet-current-player-info { display:flex; align-items:center; gap:13px; flex:1 1 290px; min-width:0; }
.sheet-current-player-icon { display:grid; place-items:center; width:43px; height:43px; flex:0 0 43px; border:1px solid color-mix(in srgb,var(--sheet-accent) 28%,transparent); border-radius:12px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:24px; }
.sheet-current-player-info .sheet-page-eyebrow { margin-bottom:4px; font-size:9px; }
.sheet-current-player-info h3 { margin:0; color:var(--sheet-ink); font-size:17px; font-weight:800; }
.sheet-current-player-info p { margin:5px 0 0; color:var(--sheet-dim); font-size:11px; line-height:1.5; }
.sheet-current-player-field { display:grid; gap:7px; flex:0 1 270px; min-width:min(100%,230px); color:var(--sheet-dim); font-size:11px; font-weight:750; }
.sheet-current-player-field select { box-sizing:border-box; width:100%; min-height:44px; padding:10px 12px; border:1px solid var(--sheet-line); border-radius:11px; background:var(--season-surface-alt,var(--season-surface,#29252d)); color:var(--sheet-ink); font:inherit; font-size:12px; }
.sheet-current-player-field select:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.sheet-current-player-field select:disabled { opacity:.65; cursor:wait; }
@media(max-width:600px){ .sheet-current-player-field { flex:1 1 100%; } }
.sheet-season-selector { display:flex !important; flex-direction:column; gap:7px; max-width:450px; padding:0 0 4px; margin:4px 0 16px !important; color:var(--sheet-dim); font-size:12px; font-weight:750; }
.sheet-season-selector select { min-height:47px; padding:10px 12px; border-radius:12px !important; border:1px solid var(--sheet-line) !important; background:var(--season-surface-alt,var(--season-surface,#29252d)) !important; color:var(--sheet-ink); }
.sheet-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:13px; margin:22px 0 13px; padding:17px 20px; border:1px solid var(--sheet-line); border-radius:17px; background:var(--season-surface-alt,rgba(255,255,255,.035)); }
.sheet-toolbar-title { display:flex; align-items:center; gap:12px; }
.sheet-toolbar-title > span { display:grid; place-items:center; width:39px; height:39px; flex:0 0 39px; border-radius:11px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:22px; }
.sheet-toolbar-title strong { display:block; font-size:15px; font-weight:850; }
.sheet-toolbar-title p { margin:3px 0 0; max-width:460px; color:var(--sheet-dim); font-size:12px; line-height:1.5; }
.sheet-toolbar .primary-button { min-height:42px; border-radius:12px; }
.sheet-quick-nav { display:flex; gap:7px; align-items:center; flex-wrap:wrap; margin:0 0 22px; padding:10px; border:1px solid var(--sheet-line); border-radius:15px; background:var(--season-bg,rgba(0,0,0,.12)); }
.sheet-quick-nav button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:37px; padding:8px 12px; border:1px solid transparent; border-radius:10px; background:transparent; color:var(--sheet-dim); font:inherit; font-size:12px; font-weight:750; cursor:pointer; white-space:nowrap; transition:background .17s,color .17s,border-color .17s; }
.sheet-quick-nav button span { color:var(--sheet-accent); font-size:15px; }
.sheet-quick-nav button:hover { border-color:var(--sheet-line); background:var(--sheet-aura); color:var(--sheet-ink); }
.sheet-quick-nav button:focus-visible,.sheet-library-open:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.sheet-summary-header { grid-template-columns:minmax(0,1fr) minmax(210px,.85fr) auto; align-items:center; gap:18px; padding:25px 27px; border-radius:22px; border:1px solid var(--sheet-line); background:radial-gradient(ellipse at 5% 0%,var(--sheet-aura),transparent 55%),linear-gradient(145deg,var(--season-surface-alt,#29232d),var(--season-surface,#1e1a22)); }
.sheet-summary-identity-main { display:flex; align-items:center; gap:16px; min-width:0; }
.sheet-summary-avatar { display:grid; place-items:center; width:65px; height:65px; flex:0 0 65px; border:1px solid color-mix(in srgb,var(--sheet-accent) 34%,transparent); border-radius:19px; background:var(--sheet-aura); font-size:31px; }
.sheet-summary-identity-copy { min-width:0; }
.sheet-summary-identity-copy h2 { overflow-wrap:anywhere; }
.sheet-summary-progression { gap:9px; }
.sheet-summary-progression > div { border-radius:12px; background:var(--season-bg,rgba(0,0,0,.16)); padding:12px; }
.sheet-summary-progression strong { font-size:13px; }
.sheet-summary-season { white-space:normal; text-align:center; }
.sheet-section-heading { scroll-margin-top:26px; display:flex; align-items:center; gap:13px; margin:19px 0 0; }
.sheet-section-symbol { display:grid; place-items:center; width:42px; height:42px; flex:0 0 42px; border:1px solid color-mix(in srgb,var(--sheet-accent) 30%,transparent); border-radius:13px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:22px; }
.sheet-section-kicker { display:block; color:var(--sheet-accent); font-size:9px; font-weight:850; letter-spacing:.15em; }
.sheet-section-heading h3 { margin:2px 0 2px; font-size:20px; font-weight:850; line-height:1.2; letter-spacing:-.025em; }
.sheet-section-heading p { margin:0; color:var(--sheet-dim); font-size:12px; }
.character-sheet-summary { gap:14px; margin-top:0; }
.sheet-summary-status { gap:13px; }
.sheet-summary-status-card { padding:19px !important; border-radius:19px !important; border-color:var(--sheet-line) !important; background:linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.045)),var(--season-surface,rgba(0,0,0,.14))) !important; box-shadow:0 12px 27px rgba(0,0,0,.12) !important; }
.sheet-summary-status-card::before { content:''; position:absolute; inset:0 0 auto; height:3px; background:var(--sheet-accent); opacity:.65; }
.sheet-summary-status-card.sheet-status-pv::before { background:#ed8692; }
.sheet-summary-status-card.sheet-status-ps::before { background:var(--season-primary,var(--sheet-accent)); }
.sheet-summary-status-card.sheet-status-pr::before { background:#73bce2; }
.sheet-status-card-top { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.sheet-status-icon { display:grid; place-items:center; width:30px; height:30px; flex:0 0 30px; border-radius:9px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:17px; }
.sheet-status-pv .sheet-status-icon { background:rgba(237,134,146,.12); color:#f49fa8; }
.sheet-status-pr .sheet-status-icon { background:rgba(115,188,226,.12); color:#88ccef; }
.sheet-status-card-name { color:var(--sheet-ink); font-size:10px; letter-spacing:.10em; font-weight:850; }
.sheet-status-full-label { display:block; color:var(--sheet-dim); font-size:11px; }
.sheet-summary-status-card > strong { font-size:clamp(27px,3vw,35px) !important; letter-spacing:-.035em; }
.status-card-damage-control { border-radius:12px; margin-top:15px; padding:14px !important; }
.status-card-damage-control strong { display:block; margin-bottom:9px; }
.status-card-damage-control label { line-height:1.45; }
.status-card-damage-control input,.status-card-damage-control select { width:100%; max-width:100%; min-height:38px; border-radius:9px; }
.status-card-damage-control button { min-height:39px; border-radius:9px; font-weight:800; }
.sheet-summary-attributes { gap:11px; }
.sheet-summary-attributes article { min-height:102px; border-color:var(--sheet-line); border-radius:17px; background:linear-gradient(150deg,var(--season-surface-alt,rgba(255,255,255,.04)),var(--season-surface,rgba(0,0,0,.12))); }
.sheet-summary-attributes article::before { background:var(--sheet-accent); }
.sheet-summary-attributes strong { align-self:flex-end; min-width:41px; min-height:41px; font-size:20px; border-radius:12px; color:var(--sheet-accent); background:var(--sheet-aura); }
.sheet-summary-grid { gap:14px; }
.sheet-summary-card,.sheet-summary-notes { padding:21px; border-color:var(--sheet-line); border-radius:19px; background:linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.045)),var(--season-surface,rgba(0,0,0,.13))); }
.sheet-card-title { display:flex; align-items:center; gap:11px; margin-bottom:18px; }
.sheet-card-title-icon { display:grid; place-items:center; width:40px; height:40px; flex:0 0 40px; border:1px solid color-mix(in srgb,var(--sheet-accent) 25%,transparent); border-radius:12px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:21px; }
.sheet-card-title > div > span { display:block; margin-bottom:2px; color:var(--sheet-accent); font-size:9px; font-weight:800; letter-spacing:.13em; }
.sheet-card-title h3 { margin:0; color:var(--sheet-ink); font-size:19px; letter-spacing:-.025em; }
.sheet-summary-values { gap:9px; }
.sheet-summary-values > div { min-height:44px; border:1px solid var(--sheet-line); border-radius:11px; background:var(--season-bg,rgba(0,0,0,.15)); padding:10px 12px; }
.sheet-summary-values span { color:var(--sheet-dim); font-size:12px; }
.sheet-summary-values strong { font-size:15px; color:var(--sheet-ink); }
.sheet-summary-notes { padding:21px; }
.sheet-summary-notes p { margin:10px 0; line-height:1.7; font-size:13px; }
.sheet-summary-hint { padding:10px 0 2px; }
.sheet-actions-premium { scroll-margin-top:26px; padding:24px; margin:16px 0 20px; border-radius:22px; border-color:var(--sheet-line); background:radial-gradient(ellipse at 0 0,var(--sheet-aura),transparent 46%),linear-gradient(145deg,var(--season-surface-alt,#252027),var(--season-surface,#151219)); }
.sheet-actions-premium .combat-actions-heading h3 { color:var(--sheet-ink); font-size:25px; }
.sheet-actions-premium .combat-d20-mark { border-radius:14px; background:var(--sheet-aura); color:var(--sheet-accent); }
.sheet-actions-premium .combat-action-card { min-height:117px; border-radius:15px; border-color:var(--sheet-line); background:linear-gradient(150deg,var(--season-surface-alt,rgba(255,255,255,.035)),var(--season-bg,rgba(0,0,0,.14))); }
.sheet-actions-premium .combat-action-card:hover { border-color:color-mix(in srgb,var(--sheet-accent) 50%,transparent); transform:translateY(-2px); }
.sheet-actions-premium .combat-complementary-section,.sheet-actions-premium .combat-reactions-section { padding-top:22px; margin-top:22px; border-top:1px solid var(--sheet-line); }
.sheet-actions-premium .combat-reactions-heading h3 { color:var(--sheet-ink); font-size:19px; }
.sheet-actions-premium .combat-action-result { border-radius:13px; }
.sheet-inventory-section { margin-top:20px !important; border-color:var(--sheet-line) !important; border-radius:22px !important; background:radial-gradient(ellipse at 5% 0,var(--sheet-aura),transparent 40%),linear-gradient(140deg,var(--season-surface,#221e22),var(--season-bg,#111015)) !important; }
.sheet-inventory-section > .inventory-heading h3 { font-size:23px; }
.sheet-inventory-section > .inventory-heading p { color:var(--sheet-dim); margin:5px 0 0; font-size:12px; }
.sheet-inventory-section > .inventory-heading h3::before { content:'▤'; color:var(--sheet-accent); }
.sheet-inventory-section .item-card { border-radius:16px; }
.sheet-armor-standalone,.sheet-inventory-section,.sheet-actions-premium,.sheet-summary-card,.sheet-quick-nav,.sheet-page-hero,.sheet-summary-status-card { scroll-margin-top:26px; }
.sheet-editor-layout { width:100%; }
.sheet-editor-premium { padding:0 !important; margin:13px 0 !important; border:1px solid var(--sheet-line) !important; border-radius:17px !important; background:linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.04)),var(--season-surface,rgba(0,0,0,.15))) !important; overflow:hidden; }
.sheet-editor-premium > summary { display:flex; align-items:center; gap:12px; min-height:62px; padding:13px 18px !important; color:var(--sheet-ink); font-size:14px; font-weight:800; }
.sheet-editor-premium > summary:hover { background:var(--sheet-aura); }
.sheet-editor-premium > summary::after { margin-left:0; }
.sheet-editor-icon { display:grid; place-items:center; width:37px; height:37px; flex:0 0 37px; border:1px solid color-mix(in srgb,var(--sheet-accent) 24%,transparent); border-radius:11px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:19px; }
.sheet-editor-title { flex:1; min-width:0; }
.sheet-editor-expand { color:var(--sheet-dim); font-size:10px; font-weight:650; white-space:nowrap; }
.sheet-editor-premium[open] > summary { border-bottom:1px solid var(--sheet-line); }
.sheet-editor-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr)); align-items:start; gap:13px; margin-top:0; padding:19px; }
.sheet-editor-fields > label { min-width:0; }
.sheet-editor-fields input,.sheet-editor-fields select,.sheet-editor-fields textarea { max-width:100%; box-sizing:border-box; border-radius:10px !important; }
.sheet-editor-fields :focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.sheet-quick-nav button:active,.sheet-library-open:active { transform:scale(.98); }

.sheet-editor-manager { padding:22px !important; border:1px solid var(--sheet-line) !important; border-radius:19px !important; background:linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.035)),var(--season-surface,rgba(0,0,0,.15))) !important; }
.sheet-editor-manager-title { display:flex; align-items:center; gap:13px; padding-bottom:18px; margin-bottom:18px; border-bottom:1px solid var(--sheet-line); }
.sheet-editor-manager-title > span { display:grid; place-items:center; width:43px; height:43px; flex:0 0 43px; border-radius:13px; border:1px solid color-mix(in srgb,var(--sheet-accent) 25%,transparent); background:var(--sheet-aura); color:var(--sheet-accent); font-size:23px; }
.sheet-editor-manager-title small { color:var(--sheet-accent); font-size:9px; letter-spacing:.15em; font-weight:850; }
.sheet-editor-manager-title h3 { margin:3px 0; font-size:20px; font-weight:850; letter-spacing:-.035em; }
.sheet-editor-manager-title p { margin:0; color:var(--sheet-dim); font-size:12px; line-height:1.45; }
.sheet-editor-manager label { min-width:0; }
.sheet-editor-manager input,.sheet-editor-manager select,.sheet-editor-manager textarea { box-sizing:border-box; min-height:41px; max-width:100%; border-radius:11px !important; }
.sheet-editor-manager input:focus-visible,.sheet-editor-manager select:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.sheet-distribution-panel { border-color:var(--sheet-line) !important; border-radius:17px !important; background:linear-gradient(150deg,var(--season-surface,#211d21),var(--season-bg,#141116)) !important; box-shadow:0 9px 26px rgba(0,0,0,.11) !important; }
.sheet-distribution-panel > div:first-child { padding-bottom:4px; }
.sheet-distribution-panel > div:first-child strong { color:var(--sheet-ink); font-size:18px !important; }
.sheet-distribution-panel input[type=number] { min-height:39px; }
.sheet-page-panel > .season-participation-toggle { border-radius:16px; }
.sheet-page-panel .season-theme-panel { border-radius:17px; }

@media (max-width:1050px){ .sheet-summary-header { grid-template-columns: minmax(0,1fr) auto; } .sheet-summary-progression { grid-column:1 / -1; grid-row:2; } .sheet-summary-season { grid-column:2; grid-row:1; } .sheet-summary-attributes { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:750px){ .sheet-page-hero { padding:18px !important; align-items:flex-start; } .sheet-page-hero-icon { width:52px; height:52px; flex-basis:52px; font-size:25px; } .sheet-quick-nav { flex-wrap:nowrap; overflow-x:auto; scroll-snap-type:x proximity; scrollbar-width:thin; } .sheet-quick-nav button { scroll-snap-align:start; } .sheet-summary-status { grid-template-columns:1fr; } .sheet-summary-grid { grid-template-columns:1fr; } .sheet-actions-premium { padding:17px; } .sheet-editor-expand { display:none; } }
@media (max-width:560px){ .sheet-page-hero-leading { gap:12px; } .sheet-page-hero h2 { font-size:24px !important; } .sheet-page-hero-detail .sheet-page-back { width:100%; } .sheet-summary-header { grid-template-columns:1fr; gap:13px; padding:18px; } .sheet-summary-avatar { width:52px; height:52px; flex-basis:52px; font-size:24px; } .sheet-summary-progression { grid-column:auto; grid-row:auto; grid-template-columns:repeat(2,minmax(0,1fr)); } .sheet-summary-season { grid-column:auto; grid-row:auto; justify-self:start; } .sheet-summary-attributes { grid-template-columns:repeat(2,minmax(0,1fr)); } .sheet-section-heading p { line-height:1.45; } .sheet-summary-status-card { padding:15px !important; } .sheet-summary-card,.sheet-summary-notes { padding:15px; } .sheet-editor-fields { padding:13px; } .sheet-library-grid { grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce){.sheet-library-card,.sheet-quick-nav button,.sheet-actions-premium .combat-action-card {transition:none !important;} .sheet-library-card:hover,.sheet-actions-premium .combat-action-card:hover {transform:none !important;} }

/* HÄXBAG v51 · Arquivo de personagens / biblioteca renovada */
.page-sheets .sheet-roster-hero { min-height:198px; align-items:center; gap:28px; padding:28px 30px !important; border-radius:22px !important; }
.page-sheets .sheet-roster-hero::after { right:-20px; top:-115px; width:300px; height:300px; opacity:.48; }
.page-sheets .sheet-roster-hero .sheet-page-hero-leading { flex:1 1 380px; align-items:flex-start; gap:20px; }
.page-sheets .sheet-roster-hero-emblem { width:76px; height:76px; flex-basis:76px; border-radius:22px; font-size:39px; background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--sheet-accent) 22%,transparent),transparent 65%),var(--season-surface-alt,rgba(255,255,255,.04)); box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 9px 25px rgba(0,0,0,.19); }
.page-sheets .sheet-roster-hero-copy { min-width:0; }
.page-sheets .sheet-roster-hero-copy .sheet-page-eyebrow { line-height:1.5; margin-bottom:12px; }
.page-sheets .sheet-roster-hero-copy h2 { font-size:clamp(26px,3vw,38px) !important; }
.page-sheets .sheet-roster-hero-copy p { max-width:550px; font-size:13px !important; }
.page-sheets .sheet-roster-hero-meta { display:flex; flex-wrap:wrap; align-items:center; gap:13px; margin-top:17px; color:var(--sheet-dim); font-size:11px; }
.page-sheets .sheet-roster-hero-meta span:first-child { color:var(--sheet-ink); border:1px solid var(--sheet-line); background:var(--season-surface-alt,rgba(255,255,255,.05)); padding:6px 10px; border-radius:20px; }
.page-sheets .sheet-roster-hero-meta i { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:7px; background:var(--sheet-accent); box-shadow:0 0 8px var(--sheet-aura); vertical-align:middle; }
.page-sheets .sheet-roster-hero .sheet-library-toolbar { position:relative; z-index:1; gap:8px; }
.page-sheets .sheet-roster-hero .sheet-library-toolbar button { min-height:43px; padding:10px 15px; border-radius:12px; font-size:12px; }
.page-sheets .sheet-roster-overview { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:0 0 22px; }
.page-sheets .sheet-roster-stat { display:flex; gap:12px; align-items:center; min-width:0; min-height:98px; padding:17px 18px; border:1px solid var(--sheet-line); border-radius:16px; background:linear-gradient(155deg,var(--season-surface-alt,rgba(255,255,255,.05)),var(--season-surface,rgba(0,0,0,.15))); box-shadow:inset 0 1px 0 rgba(255,255,255,.035); }
.page-sheets .sheet-roster-stat-icon { display:grid; place-items:center; flex:0 0 42px; width:42px; height:42px; border:1px solid color-mix(in srgb,var(--sheet-accent) 22%,transparent); border-radius:12px; background:var(--sheet-aura); color:var(--sheet-accent); font-size:23px; }
.page-sheets .sheet-roster-stat>div { min-width:0; display:grid; gap:2px; }
.page-sheets .sheet-roster-stat small { color:var(--sheet-dim); font-size:9px; font-weight:850; letter-spacing:.085em; }
.page-sheets .sheet-roster-stat strong { color:var(--sheet-ink); font-size:26px; font-weight:850; line-height:1.2; font-variant-numeric:tabular-nums; }
.page-sheets .sheet-roster-stat div>span { color:var(--sheet-dim); font-size:10px; }
.page-sheets .sheet-roster-browser { margin:6px 0 16px; padding:17px; border:1px solid var(--sheet-line); border-radius:18px; background:var(--season-surface-alt,rgba(255,255,255,.035)); }
.page-sheets .sheet-roster-filterbar { display:grid; grid-template-columns:minmax(190px,1.55fr) repeat(3,minmax(125px,1fr)); gap:12px; align-items:end; }
.page-sheets .sheet-roster-search,.page-sheets .sheet-roster-select { display:grid; gap:8px; min-width:0; color:var(--sheet-dim); font-size:11px; font-weight:750; }
.page-sheets .sheet-roster-search-input { display:flex; align-items:center; gap:9px; min-height:43px; padding:0 12px; border:1px solid var(--sheet-line); border-radius:11px; background:var(--season-surface,#231e25); transition:border-color .2s,box-shadow .2s; }
.page-sheets .sheet-roster-search-input:focus-within { border-color:var(--sheet-accent); box-shadow:0 0 0 3px var(--sheet-aura); }
.page-sheets .sheet-roster-search-input>span { font-size:22px; line-height:1; color:var(--sheet-accent); }
.page-sheets .sheet-roster-search-input input { min-width:0; width:100%; flex:1; padding:9px 0; border:0; outline:0; color:var(--sheet-ink); background:transparent; font:inherit; font-size:12px; }
.page-sheets .sheet-roster-search-input input::placeholder { color:var(--sheet-dim); opacity:.75; }
.page-sheets .sheet-roster-search-input button { flex:0 0 auto; border:0; background:none; color:var(--sheet-dim); cursor:pointer; padding:4px; }
.page-sheets .sheet-roster-select select { width:100%; min-width:0; height:43px; padding:9px 11px; border:1px solid var(--sheet-line); border-radius:11px; background:var(--season-surface,#231e25); color:var(--sheet-ink); font:inherit; font-size:12px; cursor:pointer; }
.page-sheets .sheet-roster-select select:focus-visible,.page-sheets .sheet-roster-search-input button:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.page-sheets .sheet-roster-subbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:13px; margin-top:14px; border-top:1px solid var(--sheet-line); }
.page-sheets .sheet-roster-subbar-start,.page-sheets .sheet-roster-subbar-end { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.page-sheets .sheet-roster-subbar-start>strong { font-size:13px; color:var(--sheet-ink); }
.page-sheets .sheet-roster-subbar-start>strong>span { margin-left:4px; padding:3px 8px; color:var(--sheet-accent); border-radius:30px; background:var(--sheet-aura); font-size:11px; }
.page-sheets .sheet-roster-favorites-filter,.page-sheets .sheet-roster-clear { background:transparent; border:1px solid transparent; border-radius:9px; padding:7px 10px; color:var(--sheet-dim); font:inherit; font-size:11px; cursor:pointer; }
.page-sheets .sheet-roster-favorites-filter span { color:var(--sheet-accent); font-size:17px; vertical-align:-1px; }
.page-sheets .sheet-roster-favorites-filter.is-active { color:var(--sheet-ink); border-color:var(--sheet-accent); background:var(--sheet-aura); }
.page-sheets .sheet-roster-clear { color:var(--sheet-accent); }
.page-sheets .sheet-roster-subbar-end>span { color:var(--sheet-dim); font-size:11px; }
.page-sheets .sheet-roster-view-switch { display:inline-flex; padding:3px; border:1px solid var(--sheet-line); border-radius:10px; background:var(--season-surface,#231e25); }
.page-sheets .sheet-roster-view-switch button { border:0; border-radius:7px; background:transparent; color:var(--sheet-dim); padding:7px 11px; font:inherit; font-size:11px; cursor:pointer; }
.page-sheets .sheet-roster-view-switch button.is-active { color:var(--sheet-ink); background:var(--sheet-aura); box-shadow:0 1px 5px rgba(0,0,0,.14); }
.page-sheets .sheet-roster-grid { grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:14px; }
.page-sheets .sheet-roster-card { position:relative; overflow:hidden; isolation:isolate; min-height:305px; padding:20px !important; border-radius:17px; transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease; }
.page-sheets .sheet-roster-card::before { content:''; position:absolute; right:-85px; top:-95px; width:205px; height:205px; border:1px solid var(--sheet-line); border-radius:50%; box-shadow:0 0 0 26px color-mix(in srgb,var(--sheet-accent) 3%,transparent); pointer-events:none; opacity:.55; z-index:-1; }
.page-sheets .sheet-roster-card-accent { position:absolute; left:0; top:0; width:100%; height:2px; background:linear-gradient(90deg,transparent,var(--sheet-accent),transparent); opacity:.6; }
.page-sheets .sheet-roster-card.is-favorite .sheet-roster-card-accent { height:3px; opacity:1; }
.page-sheets .sheet-roster-card.is-current { border-color:color-mix(in srgb,var(--sheet-accent) 50%,var(--sheet-line)); }
.page-sheets .sheet-roster-card-top { align-items:flex-start; }
.page-sheets .sheet-roster-card .sheet-library-avatar { width:62px; height:62px; flex-basis:62px; font-size:30px; background:linear-gradient(145deg,var(--sheet-aura),var(--season-surface,#211f24)); border-radius:17px; }
.page-sheets .sheet-roster-card-top-actions { display:flex; gap:7px; align-items:center; }
.page-sheets .sheet-roster-mine { padding:5px 7px; border:1px solid color-mix(in srgb,var(--sheet-accent) 34%,transparent); border-radius:20px; color:var(--sheet-accent); background:var(--sheet-aura); font-size:9px; font-weight:850; letter-spacing:.06em; }
.page-sheets .sheet-roster-star { display:grid; place-items:center; width:34px; height:34px; padding:0; border:1px solid var(--sheet-line); border-radius:10px; background:var(--season-surface-alt,rgba(255,255,255,.04)); color:var(--sheet-dim); font-size:23px; line-height:1; cursor:pointer; }
.page-sheets .sheet-roster-star.is-active { color:var(--sheet-accent); border-color:color-mix(in srgb,var(--sheet-accent) 42%,transparent); background:var(--sheet-aura); }
.page-sheets .sheet-roster-card-info { flex:0 0 auto; padding:20px 0 16px; }
.page-sheets .sheet-roster-card-info .sheet-page-eyebrow { margin:0 0 7px; }
.page-sheets .sheet-roster-card-info h3 { margin:0 0 6px; font-size:22px; }
.page-sheets .sheet-roster-card-info p { min-height:18px; }
.page-sheets .sheet-roster-card-details { display:grid; gap:0; margin-top:auto; margin-bottom:15px; border:1px solid var(--sheet-line); border-radius:12px; background:var(--season-bg,rgba(0,0,0,.15)); overflow:hidden; }
.page-sheets .sheet-roster-card-details>div { display:flex; gap:8px; align-items:center; justify-content:space-between; min-width:0; padding:10px 12px; }
.page-sheets .sheet-roster-card-details>div+div { border-top:1px solid var(--sheet-line); }
.page-sheets .sheet-roster-card-details span { flex:0 0 auto; color:var(--sheet-dim); font-size:9px; font-weight:850; letter-spacing:.06em; }
.page-sheets .sheet-roster-card-details strong { min-width:0; max-width:62%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--sheet-ink); font-size:11px; font-weight:750; text-align:right; }
.page-sheets .sheet-roster-card-footer { display:flex; gap:8px; align-items:center; }
.page-sheets .sheet-roster-card .sheet-library-open { min-height:43px; flex:1; }
.page-sheets .sheet-roster-card .sheet-library-delete-button { margin:0; min-height:43px; padding:9px 11px; }
.page-sheets .sheet-roster-card .sheet-library-open:focus-visible,.page-sheets .sheet-roster-star:focus-visible,.page-sheets .sheet-roster-favorites-filter:focus-visible,.page-sheets .sheet-roster-view-switch button:focus-visible { outline:2px solid var(--sheet-accent); outline-offset:2px; }
.page-sheets .sheet-roster-grid.is-list { grid-template-columns:1fr; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card { min-height:0; display:grid; grid-template-columns:75px minmax(120px,1fr) minmax(160px,1.35fr) auto; align-items:center; gap:16px; padding:16px 19px !important; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-top { align-self:center; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-top-actions { position:absolute; right:16px; top:12px; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-top .sheet-roster-mine { display:none; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-info { padding:0; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-info h3 { font-size:17px; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-info p { font-size:11px; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-details { margin:0; }
.page-sheets .sheet-roster-grid.is-list .sheet-roster-card-footer { width:150px; margin-right:34px; flex-direction:column; }
.page-sheets .sheet-roster-grid.is-list .sheet-library-open,.page-sheets .sheet-roster-grid.is-list .sheet-library-delete-button { width:100%; }
.page-sheets .sheet-roster-no-results,.page-sheets .sheet-roster-empty { display:grid; justify-items:center; text-align:center; gap:11px; padding:45px 18px; border:1px dashed var(--sheet-line); border-radius:18px; background:var(--season-surface-alt,rgba(255,255,255,.03)); }
.page-sheets .sheet-roster-no-results>span,.page-sheets .sheet-roster-empty-icon { color:var(--sheet-accent); font-size:40px; line-height:1; }
.page-sheets .sheet-roster-no-results h3,.page-sheets .sheet-roster-empty h3 { margin:0; font-size:18px; color:var(--sheet-ink); }
.page-sheets .sheet-roster-no-results p,.page-sheets .sheet-roster-empty p { margin:0 0 8px; max-width:420px; font-size:13px; color:var(--sheet-dim); }
@media(max-width:1120px) { .page-sheets .sheet-roster-overview { grid-template-columns:repeat(2,minmax(0,1fr)); } .page-sheets .sheet-roster-filterbar { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:900px) { .page-sheets .sheet-roster-grid.is-list .sheet-roster-card { grid-template-columns:68px minmax(110px,1fr) minmax(130px,1fr); } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card-footer { grid-column:2/-1; width:100%; margin:0; flex-direction:row; } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card-footer button { width:auto; } }
@media(max-width:640px) { .page-sheets .sheet-roster-hero { padding:20px !important; } .page-sheets .sheet-roster-hero-emblem { width:54px; height:54px; flex-basis:54px; font-size:29px; } .page-sheets .sheet-roster-hero .sheet-page-hero-leading { gap:12px; } .page-sheets .sheet-roster-hero .sheet-library-toolbar { width:100%; } .page-sheets .sheet-roster-overview { gap:9px; } .page-sheets .sheet-roster-stat { min-height:80px; padding:12px; gap:8px; } .page-sheets .sheet-roster-stat-icon { flex-basis:34px; width:34px; height:34px; font-size:18px; } .page-sheets .sheet-roster-stat strong { font-size:22px; } .page-sheets .sheet-roster-filterbar { grid-template-columns:1fr; } .page-sheets .sheet-roster-browser { padding:13px; } .page-sheets .sheet-roster-subbar { align-items:flex-start; } .page-sheets .sheet-roster-view-switch button>span { display:none; } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card { display:flex; flex-direction:row; flex-wrap:wrap; gap:12px; } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card-info { flex:1 1 140px; } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card-details { width:100%; } .page-sheets .sheet-roster-grid.is-list .sheet-roster-card-footer { width:100%; flex-direction:row; } }
@media(prefers-reduced-motion:reduce) { .page-sheets .sheet-roster-card { transition:none; } }

          `}</style>
    <style>{`
      .currency-wallet > .inventory-heading,
      .currency-wallet > .currency-tabs,
      .currency-wallet > .currency-history-page { grid-column: 1 / -1; width: 100%; box-sizing: border-box; }
      .currency-wallet > .currency-balances-grid { grid-column: 1 / -1; width: 100%; min-width: 0; align-self: stretch; }
      .currency-wallet > .currency-conversion-panel { grid-column: 1; width: 100%; min-width: 0; align-self: stretch; }
      .currency-wallet > .currency-actions { grid-column: 2; width: 100%; min-width: 0; align-self: stretch; }
      .currency-wallet > p { grid-column: 2; }
      @media (max-width: 760px) {
        .currency-wallet { grid-template-columns: minmax(0, 1fr) !important; }
        .currency-wallet > .inventory-heading,
        .currency-wallet > .currency-tabs,
        .currency-wallet > .currency-balances-grid,
        .currency-wallet > .currency-conversion-panel,
        .currency-wallet > .currency-actions,
        .currency-wallet > .currency-history-page,
        .currency-wallet > p { grid-column: 1 !important; }
      }
      .currency-wallet .currency-balance { min-width: 0; }
      .currency-wallet .currency-actions input { max-width: 100%; }
      /* Refinamento visual da carteira */

/* Cartões das moedas */
.currency-wallet .currency-balance {
  position: relative;
  overflow: hidden;
  min-width: 0;
  border-radius: 20px !important;
  transition: transform .22s ease,
              border-color .22s ease,
              box-shadow .22s ease;
}

.currency-wallet .currency-balance::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at top right,
    var(--season-accent-soft, rgba(220,135,65,.16)),
    transparent 65%
  );
  pointer-events: none;
}

.currency-wallet .currency-balance:hover {
  transform: translateY(-4px);
  border-color: var(--season-accent, currentColor) !important;
  box-shadow: 0 14px 30px rgba(0,0,0,.20) !important;
}

/* Painel de movimentações */
.currency-wallet .currency-actions {
  border-radius: 20px !important;
  backdrop-filter: blur(12px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 12px 28px rgba(0,0,0,.12);
}

/* Campos */
.currency-wallet input,
.currency-wallet select,
.currency-wallet textarea {
  transition: border-color .2s ease,
              box-shadow .2s ease;
}

.currency-wallet input:focus,
.currency-wallet select:focus,
.currency-wallet textarea:focus {
  outline: none;
  border-color: var(--season-accent, currentColor) !important;
  box-shadow: 0 0 0 3px var(--season-accent-soft, rgba(220,135,65,.15));
}

/* Histórico */
.currency-wallet .currency-history-entry {
  border-radius: 14px;
  transition: background .2s ease,
              transform .2s ease;
}

.currency-wallet .currency-history-entry:hover {
  transform: translateX(3px);
  background: var(--season-surface-alt, rgba(255,255,255,.07));
}

/* Botões */
.currency-wallet button {
  transition: transform .18s ease,
              filter .18s ease;
}

.currency-wallet button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.currency-wallet button:active:not(:disabled) {
  transform: scale(.97);
}

/* Telas menores */
@media (max-width: 760px) {
  .currency-wallet {
    padding: 18px !important;
  }
}

/* Respeita preferência por movimento reduzido */
@media (prefers-reduced-motion: reduce) {
  .currency-wallet * {
    transition: none !important;
    transform: none !important;
  }
}
  /* ===== HÄXBAG — CARTEIRA PREMIUM ===== */

.currency-wallet {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(220, 135, 65, .16);
  border-radius: 24px !important;
  background:
    radial-gradient(
      ellipse at 100% 0%,
      rgba(220, 135, 65, .09),
      transparent 42%
    ),
    var(--season-surface, #171717);
  box-shadow:
    0 18px 45px rgba(0, 0, 0, .20),
    inset 0 1px 0 rgba(255, 255, 255, .035);
}

/* Cabeçalho */
.currency-wallet h2,
.currency-wallet h3 {
  letter-spacing: -.035em;
}

/* Cartões de saldo */
.currency-wallet .currency-balance {
  border: 1px solid rgba(255, 255, 255, .075) !important;
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, .055),
      rgba(255, 255, 255, .012)
    ) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .055),
    0 8px 22px rgba(0, 0, 0, .13);
}

.currency-wallet .currency-balance:hover {
  border-color: rgba(220, 135, 65, .38) !important;
}

/* Valores monetários */
.currency-wallet .currency-balance strong,
.currency-wallet .currency-balance b {
  font-variant-numeric: tabular-nums;
  letter-spacing: -.045em;
}

/* Painel de movimentações */
.currency-wallet .currency-actions {
  border: 1px solid rgba(220, 135, 65, .13) !important;
  background:
    linear-gradient(
      145deg,
      rgba(220, 135, 65, .055),
      rgba(255, 255, 255, .018)
    ) !important;
}

/* Histórico */
.currency-wallet .currency-history-entry {
  border: 1px solid rgba(255, 255, 255, .045);
  background: rgba(255, 255, 255, .018);
  padding: 12px;
}

.currency-wallet .currency-history-entry:hover {
  border-color: rgba(220, 135, 65, .22);
}

/* Campos */
.currency-wallet input,
.currency-wallet select,
.currency-wallet textarea {
  border-radius: 12px !important;
  background-color: rgba(0, 0, 0, .16) !important;
}

/* Botões */
.currency-wallet button {
  border-radius: 12px;
  font-weight: 600;
}

.currency-wallet button:hover:not(:disabled) {
  box-shadow: 0 5px 16px rgba(220, 135, 65, .12);
}

/* Responsividade */
@media (max-width: 760px) {
  .currency-wallet {
    border-radius: 18px !important;
  }
}

/* ===== ACABAMENTO VISUAL DA CARTEIRA ===== */
.currency-wallet {
  gap: 0 18px;
  padding: clamp(16px, 2.4vw, 26px) !important;
  border-color: var(--season-line, rgba(255,255,255,.14)) !important;
  background:
    radial-gradient(ellipse at 4% 0%, var(--season-accent-soft, rgba(220,135,65,.16)), transparent 38%),
    linear-gradient(145deg, var(--season-surface, rgba(20,18,25,.97)), var(--season-surface-alt, rgba(255,255,255,.025))) !important;
}

.currency-wallet > .inventory-heading {
  margin-bottom: 18px !important;
  padding-bottom: 18px !important;
}

.currency-wallet .currency-tabs {
  display: inline-flex;
  justify-self: start;
  gap: 6px;
  width: fit-content;
  max-width: 100%;
  margin: 0 0 20px;
  padding: 5px;
  border: 1px solid var(--season-line, rgba(255,255,255,.12));
  border-radius: 14px;
  background: var(--season-bg, rgba(0,0,0,.16));
}

.currency-wallet .currency-tab {
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--season-muted, #aaa);
  font-size: 12px;
  font-weight: 750;
}

.currency-wallet .currency-tab.active {
  border-color: var(--season-line, rgba(255,255,255,.12));
  background: var(--season-accent-soft, rgba(220,135,65,.16));
  color: var(--season-text, inherit);
  box-shadow: 0 3px 12px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.06);
}

.currency-wallet .currency-balances-grid {
  gap: 12px !important;
  margin-bottom: 20px !important;
}

.currency-wallet .currency-balance {
  min-height: 142px !important;
  padding: 18px !important;
  border-color: var(--season-line, rgba(255,255,255,.13)) !important;
  background:
    radial-gradient(circle at 100% 0%, var(--season-accent-soft, rgba(220,135,65,.17)), transparent 58%),
    linear-gradient(145deg, var(--season-surface-alt, rgba(255,255,255,.065)), var(--season-surface, rgba(0,0,0,.12))) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 24px rgba(0,0,0,.13) !important;
}

.currency-wallet .currency-balance > strong {
  font-size: clamp(26px, 3vw, 34px) !important;
  line-height: 1.05 !important;
}

.currency-wallet .currency-conversion-panel,
.currency-wallet .currency-actions {
  align-self: stretch;
  min-width: 0;
  padding: clamp(16px, 2vw, 21px) !important;
  border: 1px solid var(--season-line, rgba(255,255,255,.13)) !important;
  border-radius: 19px !important;
  background:
    linear-gradient(145deg, var(--season-surface-alt, rgba(255,255,255,.055)), var(--season-surface, rgba(0,0,0,.12))) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.055), 0 12px 26px rgba(0,0,0,.12) !important;
}

.currency-wallet .currency-conversion-panel h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px !important;
  font-weight: 800;
  letter-spacing: -.02em;
}

.currency-wallet .currency-conversion-panel label,
.currency-wallet .currency-actions label {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: var(--season-muted, #aaa);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .045em;
}

.currency-wallet .currency-conversion-panel input,
.currency-wallet .currency-conversion-panel select,
.currency-wallet .currency-actions input,
.currency-wallet .currency-actions select {
  width: 100%;
  min-width: 0;
  min-height: 45px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--season-line, rgba(255,255,255,.16)) !important;
  border-radius: 11px !important;
  background: var(--season-bg, rgba(0,0,0,.2)) !important;
  color: var(--season-text, inherit) !important;
  font: inherit;
  font-size: 13px;
  letter-spacing: normal;
}

.currency-wallet .currency-conversion-panel button,
.currency-wallet .currency-actions button {
  min-height: 43px;
  border-radius: 11px !important;
  font-size: 12px;
  font-weight: 800;
}

.currency-wallet .currency-conversion-panel button {
  width: 100%;
  border: 1px solid var(--season-line, rgba(255,255,255,.18));
  background: var(--season-accent-soft, rgba(220,135,65,.17));
  color: var(--season-text, inherit);
}

.currency-wallet .currency-actions {
  display: grid;
  align-content: start;
  gap: 14px;
}

.currency-wallet .currency-actions .currency-buttons {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px !important;
  margin-top: 2px;
}

.currency-wallet .currency-actions .currency-action-add,
.currency-wallet .currency-actions .currency-action-remove {
  justify-content: center;
  min-width: 0;
  padding: 10px 9px !important;
}

.currency-wallet .currency-history-page {
  padding: clamp(14px, 2vw, 22px);
  border: 1px solid var(--season-line, rgba(255,255,255,.13));
  border-radius: 19px;
  background: var(--season-surface-alt, rgba(255,255,255,.035));
}

.currency-wallet .currency-history-summary,
.currency-wallet .currency-history-entry {
  border-color: var(--season-line, rgba(255,255,255,.12));
}

@media (max-width: 760px) {
  .currency-wallet .currency-tabs { width: 100%; }
  .currency-wallet .currency-tab { flex: 1; }
  .currency-wallet .currency-actions .currency-buttons { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .currency-wallet *,
  .currency-wallet *::before,
  .currency-wallet *::after {
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
  }
}
    `}</style>
          <style>{`
          .page-content.page-overview > * {
  display: none !important;
}

.page-content.page-overview > .overview-page-panel {
  display: block !important;
}
          .page-content.page-shops > * {
  display: none !important;
}

.page-content.page-shops > .shops-page-panel {
  display: block !important;
}
 
            .page-content.page-bestiary > * { display: none !important; }
            .page-content.page-bestiary > .bestiary-page-panel { display: block !important; }
            .page-content.page-enemies > * {
              display: none !important;
            }

            .page-content.page-enemies > .enemies-page-panel {
              display: block !important;
            }
            .page-content.page-master-shield > * { display: none !important; }
            .page-content.page-master-shield > .master-shield-page-panel { display: block !important; }
            .page-content.page-sheets > * { display: none !important; }
            .page-content.page-sheets > .sheet-page-panel { display: block !important; }
            .page-content.page-characters > * { display: none !important; }
            .page-content.page-characters > .characters-page-panel { display: block !important; }
            .page-content.page-campaigns > * { display: none !important; }
            .page-content.page-campaigns > .campaigns-page-panel { display: block !important; }
            .page-content.page-campaigns > #inventario {
              display: block !important;
            }
            .page-content.page-inventory > .season-sheet-section { display: none !important; }
          `}</style>

          <style>{`
/* HäxBag | Redesign transversal: areas administrativas e exploracao */
.hb-polish { --hb-accent: var(--season-primary,#d7a77e); --hb-line:var(--season-line,rgba(255,255,255,.13)); --hb-fg:var(--season-text,#f3eee8); --hb-muted:var(--season-muted,#b9b4c2); --hb-surface:var(--season-surface,#1d1b20); --hb-surface-alt:var(--season-surface-alt,#29242b); --hb-soft:color-mix(in srgb,var(--hb-accent) 11%,transparent); }
.hb-polish .sidebar { border-right:1px solid var(--hb-line); background:linear-gradient(180deg,var(--season-bg,#121014),color-mix(in srgb,var(--season-bg,#121014) 88%,var(--hb-accent) 12%)); }
.hb-polish .brand-mark { box-shadow:0 4px 22px color-mix(in srgb,var(--hb-accent) 18%,transparent); }
.hb-polish .navigation { gap:4px; }
.hb-polish .nav-link { border-radius:11px; border:1px solid transparent; transition:background .16s,border-color .16s,transform .16s; }
.hb-polish .nav-link:not(:disabled):hover { background:color-mix(in srgb,var(--hb-accent) 8%,transparent); border-color:color-mix(in srgb,var(--hb-accent) 16%,transparent); transform:translateX(2px); }
.hb-polish .nav-link.active { background:linear-gradient(95deg,color-mix(in srgb,var(--hb-accent) 16%,transparent),color-mix(in srgb,var(--hb-accent) 5%,transparent)); border-color:color-mix(in srgb,var(--hb-accent) 26%,transparent); box-shadow:inset 3px 0 var(--hb-accent); }
.hb-polish .topbar { border-bottom:1px solid var(--hb-line); backdrop-filter:blur(12px); }
.hb-polish .page-content { min-width:0; }
.hb-polish .page-content:is(.page-overview,.page-master-shield,.page-characters,.page-campaigns,.page-shops,.page-bestiary) { padding-top:clamp(18px,3vw,38px); }
.hb-polish .page-content :is(.overview-page-panel,.master-shield-page-panel,.characters-page-panel,.campaigns-page-panel,.shops-page-panel,.bestiary-page-panel) { min-width:0; }
.hb-polish .hb-kicker { display:inline-flex; align-items:center; gap:8px; color:var(--hb-accent); font-size:10px; font-weight:850; letter-spacing:.15em; line-height:1.3; text-transform:uppercase; }
.hb-polish .hb-kicker-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--hb-accent); box-shadow:0 0 0 4px var(--hb-soft); }
.hb-polish .hb-title-dot { color:var(--hb-accent); }
.hb-polish .hb-hero { position:relative; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:21px; padding:clamp(22px,3vw,35px); border:1px solid color-mix(in srgb,var(--hb-accent) 22%,var(--hb-line)); border-radius:23px; background:radial-gradient(ellipse at 3% 0%,color-mix(in srgb,var(--hb-accent) 15%,transparent),transparent 53%),linear-gradient(115deg,var(--hb-surface),var(--season-bg,#141218)); overflow:hidden; isolation:isolate; box-shadow:0 16px 36px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.04); }
.hb-polish .hb-hero:after { content:''; position:absolute; width:220px; height:220px; right:-50px; top:-100px; border:1px solid color-mix(in srgb,var(--hb-accent) 18%,transparent); border-radius:50%; box-shadow:0 0 0 38px color-mix(in srgb,var(--hb-accent) 3%,transparent),0 0 0 77px color-mix(in srgb,var(--hb-accent) 2%,transparent); pointer-events:none; z-index:-1; }
.hb-polish .hb-hero h2 { margin:7px 0 9px; font-family:'Space Grotesk',Manrope,sans-serif; font-size:clamp(27px,3vw,37px); font-weight:850; letter-spacing:-.045em; line-height:1.1; color:var(--hb-fg); }
.hb-polish .hb-hero p { max-width:680px; margin:0; line-height:1.65; font-size:13px; color:var(--hb-muted); }
.hb-polish .hb-hero-main { min-width:0; flex:1 1 420px; }
.hb-polish .hb-hero-emblem { display:grid; place-items:center; flex:0 0 90px; width:90px; height:90px; border:1px solid color-mix(in srgb,var(--hb-accent) 28%,transparent); border-radius:27px; background:linear-gradient(140deg,color-mix(in srgb,var(--hb-accent) 19%,transparent),color-mix(in srgb,var(--hb-accent) 4%,transparent)); color:var(--hb-accent); font-size:49px; line-height:1; box-shadow:inset 0 1px rgba(255,255,255,.09); }
.hb-polish .hb-hero-tags { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:18px; }
.hb-polish .hb-hero-tags > span { display:inline-flex; align-items:center; min-height:27px; gap:6px; padding:5px 10px; border:1px solid var(--hb-line); border-radius:999px; background:color-mix(in srgb,var(--hb-surface-alt) 65%,transparent); color:var(--hb-fg); font-size:10px; font-weight:750; }
.hb-polish .hb-hero-actions { display:flex; flex-wrap:wrap; gap:9px; width:100%; position:relative; z-index:1; }
.hb-polish .hb-hero :is(.primary-button,.secondary-button) { min-height:39px; border-radius:11px; }
.hb-polish .hb-metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:19px 0; }
.hb-polish .hb-metric { display:flex; position:relative; min-width:0; align-items:flex-start; gap:13px; padding:17px 16px; border:1px solid var(--hb-line); border-radius:17px; background:linear-gradient(140deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 58%,transparent)); text-align:left; color:var(--hb-fg); box-shadow:inset 0 1px rgba(255,255,255,.025); }
.hb-polish button.hb-metric { width:100%; cursor:pointer; transition:transform .17s,border-color .17s,box-shadow .17s; }
.hb-polish button.hb-metric:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--hb-accent) 40%,var(--hb-line)); box-shadow:0 14px 26px rgba(0,0,0,.11); }
.hb-polish .hb-metric-icon { display:grid; place-items:center; flex:0 0 43px; width:43px; height:43px; border:1px solid color-mix(in srgb,var(--hb-accent) 24%,transparent); border-radius:12px; background:var(--hb-soft); color:var(--hb-accent); font-size:22px; }
.hb-polish .hb-metric-content { display:grid; min-width:0; gap:5px; flex:1; }
.hb-polish .hb-metric-label { color:var(--hb-muted); font-size:10px; font-weight:850; letter-spacing:.07em; text-transform:uppercase; }
.hb-polish .hb-metric-content strong { font-family:'Space Grotesk',Manrope,sans-serif; font-size:clamp(21px,2.2vw,29px); line-height:1.12; font-weight:850; letter-spacing:-.04em; overflow-wrap:anywhere; }
.hb-polish .hb-metric-content strong.hb-metric-name { font-size:15px; letter-spacing:-.025em; line-height:1.35; }
.hb-polish .hb-metric-content small { font-size:10px; color:var(--hb-muted); line-height:1.45; }
.hb-polish .hb-metric-arrow { align-self:center; color:var(--hb-accent); opacity:.75; font-size:17px; }
.hb-polish .hb-panel { min-width:0; padding:22px; border:1px solid var(--hb-line); border-radius:20px; background:linear-gradient(145deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 55%,transparent)); }
.hb-polish .hb-panel-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:18px; }
.hb-polish .hb-panel-heading h3 { margin:5px 0; font-family:'Space Grotesk',Manrope,sans-serif; color:var(--hb-fg); font-size:19px; line-height:1.25; letter-spacing:-.025em; }
.hb-polish .hb-panel-heading p { margin:0; color:var(--hb-muted); font-size:12px; line-height:1.6; }
.hb-polish .hb-heading-icon { display:grid; place-items:center; flex-shrink:0; width:42px; height:42px; border:1px solid color-mix(in srgb,var(--hb-accent) 24%,transparent); border-radius:12px; background:var(--hb-soft); color:var(--hb-accent); font-size:23px; }
.hb-polish .hb-dashboard-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); align-items:start; gap:16px; }
.hb-polish .hb-overview-activity { margin-top:16px; }
.hb-polish .hb-journey-list,.hb-polish .hb-roster-list { display:grid; gap:8px; }
.hb-polish .hb-journey-entry { display:flex; align-items:center; gap:12px; min-width:0; padding:11px 12px; background:color-mix(in srgb,var(--hb-surface-alt) 42%,transparent); border:1px solid var(--hb-line); border-radius:13px; }
.hb-polish .hb-journey-entry.is-current { background:color-mix(in srgb,var(--hb-accent) 8%,var(--hb-surface)); border-color:color-mix(in srgb,var(--hb-accent) 35%,var(--hb-line)); }
.hb-polish .hb-journey-index { display:grid; place-items:center; flex:0 0 40px; height:40px; border-radius:11px; background:var(--hb-soft); color:var(--hb-accent); font-weight:850; font-size:14px; }
.hb-polish .hb-journey-copy { flex:1; display:grid; min-width:0; gap:3px; }
.hb-polish .hb-journey-copy strong,.hb-polish .hb-roster-entry strong { overflow:hidden; text-overflow:ellipsis; font-size:12px; color:var(--hb-fg); }
.hb-polish .hb-journey-copy small,.hb-polish .hb-roster-entry small { color:var(--hb-muted); font-size:10px; line-height:1.45; }
.hb-polish .hb-season-status { flex-shrink:0; padding:5px 9px; border-radius:100px; border:1px solid var(--hb-line); color:var(--hb-muted); font-size:10px; font-weight:750; }
.hb-polish .hb-season-status-active { background:var(--hb-soft); color:var(--hb-accent); border-color:color-mix(in srgb,var(--hb-accent) 27%,transparent); }
.hb-polish .hb-roster-entry { display:flex; align-items:center; gap:10px; min-width:0; padding:10px 12px; text-align:left; border:1px solid var(--hb-line); border-radius:13px; background:color-mix(in srgb,var(--hb-surface-alt) 42%,transparent); color:var(--hb-fg); cursor:pointer; }
.hb-polish .hb-roster-entry:hover { border-color:var(--hb-accent); background:var(--hb-soft); }
.hb-polish .hb-roster-avatar { display:grid; place-items:center; flex:0 0 41px; width:41px; height:41px; font-size:23px; background:var(--hb-soft); border-radius:12px; }
.hb-polish .hb-roster-entry > span:nth-child(2) { display:grid; flex:1; min-width:0; gap:3px; }
.hb-polish .hb-roster-entry > span:last-child { color:var(--hb-accent); }
.hb-polish .hb-timeline { display:grid; gap:0; }
.hb-polish .hb-timeline-event { display:grid; grid-template-columns:20px 1fr; gap:14px; position:relative; padding:0 0 17px; }
.hb-polish .hb-timeline-event:not(:last-child):before { content:''; position:absolute; top:10px; bottom:0; left:8px; width:1px; background:var(--hb-line); }
.hb-polish .hb-timeline-dot { position:relative; z-index:1; width:16px; height:16px; margin-top:2px; border:3px solid color-mix(in srgb,var(--hb-accent) 30%,var(--hb-surface)); border-radius:50%; background:var(--hb-accent); }
.hb-polish .hb-timeline-event strong { color:var(--hb-fg); font-size:13px; }
.hb-polish .hb-timeline-event p { margin:5px 0; font-size:12px; line-height:1.5; color:var(--hb-muted); }
.hb-polish .hb-timeline-event small { color:var(--hb-accent); font-size:10px; }
.hb-polish .hb-minimal-empty { padding:27px 18px; border:1px dashed var(--hb-line); border-radius:13px; background:color-mix(in srgb,var(--hb-surface-alt) 30%,transparent); color:var(--hb-muted); text-align:center; font-size:12px; line-height:1.6; }
.hb-polish .hb-overview-empty { text-align:center; padding:50px 25px; }
.hb-polish .hb-overview-empty > span { display:block; margin-bottom:15px; font-size:42px; color:var(--hb-accent); }
.hb-polish .hb-overview-empty h3 { margin:0 0 7px; font-size:20px; }
.hb-polish .hb-overview-empty p { margin:0 0 20px; color:var(--hb-muted); }
/* Personagens: listagem e editor */
.hb-polish .hb-characters-page > .hb-characters-hero { margin-bottom:22px; }
.hb-polish .hb-characters-hero > div:first-child { flex:1 1 370px; }
.hb-polish .hb-characters-hero .primary-button,.hb-polish .hb-characters-hero .secondary-button { white-space:normal; }
.hb-polish .hb-character-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,245px),1fr)); gap:15px; }
.hb-polish .hb-character-grid .hb-character-card { display:flex; align-items:stretch; gap:0; min-height:235px; padding:19px; border-radius:19px; border:1px solid var(--hb-line); background:radial-gradient(ellipse at 10% 0%,var(--hb-soft),transparent 58%),linear-gradient(130deg,var(--hb-surface),var(--hb-surface-alt)); box-shadow:0 8px 22px rgba(0,0,0,.06); }
.hb-polish .hb-character-card:hover { border-color:color-mix(in srgb,var(--hb-accent) 40%,var(--hb-line)); box-shadow:0 15px 26px rgba(0,0,0,.12); }
.hb-polish .hb-character-card:before { display:none; }
.hb-polish .hb-character-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; margin:0 0 15px; }
.hb-polish .hb-character-card .item-art { display:grid; place-items:center; margin:0; width:67px; height:67px; border:1px solid color-mix(in srgb,var(--hb-accent) 28%,transparent); border-radius:19px; background:linear-gradient(140deg,var(--hb-soft),color-mix(in srgb,var(--hb-surface-alt) 75%,transparent)); font-size:35px; }
.hb-polish .hb-card-tag { display:inline-block; max-width:130px; padding:6px 9px; border:1px solid var(--hb-line); border-radius:999px; background:var(--hb-soft); color:var(--hb-accent); font-size:9px; font-weight:850; letter-spacing:.085em; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; }
.hb-polish .hb-character-card h3 { margin:0 0 5px; font-size:18px; line-height:1.3; font-weight:850; color:var(--hb-fg); }
.hb-polish .hb-character-card p { margin:0 0 10px; min-height:0; font-size:12px; line-height:1.55; color:var(--hb-muted); }
.hb-polish .hb-character-card .item-description { padding:6px 9px; border-radius:9px; background:var(--hb-soft); color:var(--hb-accent); font-size:11px; }
.hb-polish .hb-character-card > button { align-self:stretch; width:100%; min-height:36px; margin-top:8px; border-radius:10px; text-align:center; }
.hb-polish .hb-character-card > button.primary-button { margin-top:auto; }
.hb-polish .hb-character-card-admin { border-color:color-mix(in srgb,var(--hb-accent) 22%,var(--hb-line)); }
.hb-polish .hb-character-card-admin > button:last-child { background:rgba(183,58,64,.055); }
.hb-polish .hb-character-empty { grid-column:1/-1; }
/* Formulario visual consistente */
.hb-polish .hb-form { padding:22px; border:1px solid var(--hb-line); border-radius:19px; background:linear-gradient(140deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 55%,transparent)); box-shadow:inset 0 1px rgba(255,255,255,.035); }
.hb-polish .hb-form-heading { display:flex; align-items:center; gap:13px; padding-bottom:16px; border-bottom:1px solid var(--hb-line); margin:0 0 7px; }
.hb-polish .hb-form-heading h3 { margin:4px 0; font-family:'Space Grotesk',Manrope,sans-serif; font-size:19px; letter-spacing:-.03em; }
.hb-polish .hb-form-heading p { margin:0; color:var(--hb-muted); line-height:1.5; font-size:12px; }
.hb-polish .hb-form label { color:var(--hb-muted); font-size:12px; font-weight:750; }
.hb-polish .hb-form :is(input,select,textarea) { min-height:44px; border:1px solid var(--hb-line); border-radius:10px; background:var(--season-bg,#121014); color:var(--hb-fg); }
.hb-polish .hb-form :is(input,select,textarea):focus { border-color:var(--hb-accent); box-shadow:0 0 0 3px var(--hb-soft); outline:0; }
.hb-polish .hb-form .emoji-grid { gap:8px; }
.hb-polish .hb-form .emoji-option { border-radius:9px; }
.hb-polish .hb-form button.primary-button { border-radius:10px; }
/* Bestiario */
.hb-polish .hb-bestiary .hb-bestiary-hero { margin-bottom:19px; }
.hb-polish .hb-bestiary .hb-bestiary-hero > div:first-child { flex:1 1 330px; }
.hb-polish .hb-bestiary .hb-bestiary-hero .bestiary-add-button { min-height:42px; padding:11px 16px; border-radius:11px; }
.hb-polish .hb-bestiary-metrics { margin:0 0 24px; }
.hb-polish .hb-toolbar-label { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:9px; }
.hb-polish .hb-toolbar-label strong { color:var(--hb-muted); font-size:11px; }
.hb-polish .hb-bestiary-toolbar { display:flex; position:relative; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:22px; padding:12px; border:1px solid var(--hb-line); border-radius:15px; background:color-mix(in srgb,var(--hb-surface) 85%,transparent); }
.hb-polish .hb-bestiary-toolbar .hb-search-symbol { position:absolute; left:23px; color:var(--hb-accent); font-size:24px; pointer-events:none; }
.hb-polish .hb-bestiary-toolbar input { flex:1 1 240px; min-width:0; padding-left:41px; }
.hb-polish .hb-bestiary-toolbar select { flex:0 1 220px; min-width:150px; }
.hb-polish .hb-bestiary-toolbar :is(input,select) { min-height:43px; border:1px solid var(--hb-line); border-radius:11px; background:var(--season-bg,#121014); color:var(--hb-fg); }
.hb-polish .hb-bestiary-toolbar :is(input,select):focus { border-color:var(--hb-accent); outline:2px solid var(--hb-soft); }
.hb-polish .hb-reset-filters { min-height:42px; border-radius:10px; }
.hb-polish .hb-bestiary .bestiary-creature-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr)); gap:17px; }
.hb-polish .hb-bestiary .hb-bestiary-card { min-width:0; border:1px solid var(--hb-line); border-radius:19px; background:var(--hb-surface); overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.08); transition:transform .18s,border-color .18s,box-shadow .18s; }
.hb-polish .hb-bestiary .hb-bestiary-card:hover { transform:translateY(-4px); border-color:color-mix(in srgb,var(--hb-accent) 48%,var(--hb-line)); box-shadow:0 15px 32px rgba(0,0,0,.15); }
.hb-polish .hb-bestiary .hb-bestiary-card:focus-visible { outline:2px solid var(--hb-accent); outline-offset:3px; }
.hb-polish .hb-bestiary-card .bestiary-creature-image,.hb-polish .hb-bestiary-card .bestiary-creature-placeholder { width:100%; height:185px; object-fit:cover; border-radius:0; }
.hb-polish .hb-bestiary-card .bestiary-creature-placeholder { display:grid; place-items:center; background:radial-gradient(circle at 45% 30%,var(--hb-soft),var(--hb-surface-alt)); color:var(--hb-accent); font-size:58px; }
.hb-polish .hb-bestiary-card .bestiary-creature-info { display:grid; align-content:start; gap:6px; min-height:130px; padding:16px; }
.hb-polish .hb-bestiary-card .bestiary-creature-info > .hb-bestiary-category { justify-self:start; padding:5px 9px; border:1px solid color-mix(in srgb,var(--hb-accent) 25%,transparent); border-radius:100px; background:var(--hb-soft); color:var(--hb-accent); font-size:10px; font-weight:850; }
.hb-polish .hb-bestiary-card .bestiary-creature-info h3 { margin:4px 0 0; overflow-wrap:anywhere; font-size:17px; line-height:1.35; color:var(--hb-fg); }
.hb-polish .hb-bestiary-card .bestiary-creature-info p { display:flex; flex-wrap:wrap; gap:5px; align-items:center; color:var(--hb-muted); font-size:11px; margin:3px 0 6px; }
.hb-polish .hb-bestiary-card .bestiary-creature-info p strong { color:var(--hb-fg); }
.hb-polish .hb-danger-indicator { width:7px; height:7px; background:#e28a64; border-radius:100%; }
.hb-polish .hb-bestiary-card .bestiary-creature-status { font-size:10px; line-height:1.5; }

/* Bestiário 2026 — catálogo responsivo, sem afetar as outras páginas */
.hb-polish .hb-beast { width:100%; min-width:0; }
.hb-polish .hb-beast .hb-beast-hero { align-items:center; padding:clamp(22px,3vw,34px); margin-bottom:16px; background:radial-gradient(ellipse at 5% 0%,color-mix(in srgb,var(--hb-accent) 17%,transparent),transparent 52%),linear-gradient(135deg,var(--hb-surface),var(--season-bg,#141218)); }
.hb-beast-hero-copy { flex:1 1 370px; min-width:0; position:relative; z-index:1; }
.hb-beast-hero-meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:17px; }
.hb-beast-hero-meta span { display:inline-flex; align-items:center; min-height:30px; padding:6px 11px; border:1px solid var(--hb-line); border-radius:999px; color:var(--hb-fg); background:color-mix(in srgb,var(--hb-surface-alt) 75%,transparent); font-size:11px; font-weight:700; }
.hb-beast-hero-side { position:relative; z-index:1; display:flex; align-items:center; gap:18px; }
.hb-beast-hero-symbol { width:82px; height:82px; display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--hb-accent) 32%,transparent); border-radius:25px; background:color-mix(in srgb,var(--hb-accent) 12%,transparent); color:var(--hb-accent); font-size:52px; box-shadow:inset 0 1px rgba(255,255,255,.05); }
.hb-polish .hb-beast .hb-beast-create { min-height:46px; padding:10px 18px; background:var(--hb-accent); color:var(--season-bg,#181318); border:1px solid transparent; border-radius:12px; font-weight:850; white-space:nowrap; box-shadow:0 9px 22px color-mix(in srgb,var(--hb-accent) 17%,transparent); }
.hb-polish .hb-beast .hb-beast-create:hover { filter:brightness(1.07); transform:translateY(-1px); }
.hb-polish .hb-beast .hb-beast-metrics { margin:0 0 18px; }
.hb-polish .hb-beast .hb-beast-metrics .hb-metric { min-height:112px; }
.hb-polish .hb-beast-library { padding:clamp(16px,2vw,24px); border:1px solid var(--hb-line); border-radius:22px; background:linear-gradient(155deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 35%,var(--hb-surface))); box-shadow:0 10px 30px rgba(0,0,0,.1); }
.hb-beast-library-head { display:flex; justify-content:space-between; align-items:center; gap:15px; margin-bottom:17px; }
.hb-beast-library-head h3 { margin:5px 0 4px; font-family:'Space Grotesk',Manrope,sans-serif; font-size:clamp(19px,2vw,23px); letter-spacing:-.03em; color:var(--hb-fg); }
.hb-beast-library-head p { margin:0; color:var(--hb-muted); font-size:12px; line-height:1.55; }
.hb-beast-result-count { flex-shrink:0; padding:8px 12px; border-radius:999px; border:1px solid var(--hb-line); background:var(--hb-soft); color:var(--hb-accent); font-size:11px; font-weight:800; }
.hb-polish .hb-beast .hb-beast-toolbar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:9px; margin:0 0 12px; padding:12px; border:1px solid var(--hb-line); border-radius:14px; background:color-mix(in srgb,var(--season-bg,#131118) 68%,transparent); }
.hb-beast-search { display:flex; align-items:center; position:relative; flex:1 1 230px; min-width:170px; }
.hb-beast-search > span { position:absolute; left:13px; top:50%; transform:translateY(-50%); font-size:24px; color:var(--hb-accent); pointer-events:none; }
.hb-polish .hb-beast .hb-beast-search input { flex:1; width:100%; min-width:0; min-height:43px; padding:10px 12px 10px 40px; background:var(--hb-surface); border:1px solid var(--hb-line); border-radius:10px; color:var(--hb-fg); font-size:12px; }
.hb-beast-filter { display:grid; gap:4px; flex:0 1 156px; min-width:132px; color:var(--hb-muted); font-size:10px; font-weight:800; }
.hb-polish .hb-beast .hb-beast-filter select { width:100%; min-width:0; min-height:43px; padding:8px 10px; background:var(--hb-surface); border:1px solid var(--hb-line); border-radius:10px; color:var(--hb-fg); font-size:12px; }
.hb-polish .hb-beast .hb-beast-toolbar :is(input,select):focus-visible { outline:2px solid var(--hb-accent); outline-offset:2px; }
.hb-beast-view-toggle { display:flex; align-items:center; gap:4px; padding:3px; border:1px solid var(--hb-line); border-radius:10px; background:var(--hb-surface); }
.hb-beast-view-toggle button { display:grid; place-items:center; width:36px; height:36px; padding:0; border:0; border-radius:7px; background:transparent; color:var(--hb-muted); font-size:19px; cursor:pointer; }
.hb-beast-view-toggle button.active { background:var(--hb-soft); color:var(--hb-accent); }
.hb-beast-category-row { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-bottom:21px; }
.hb-beast-category-row button { display:inline-flex; align-items:center; gap:7px; min-height:32px; padding:7px 11px; border:1px solid var(--hb-line); border-radius:999px; background:color-mix(in srgb,var(--hb-surface-alt) 68%,transparent); color:var(--hb-muted); font-size:11px; font-weight:750; cursor:pointer; }
.hb-beast-category-row button span { opacity:.8; font-size:10px; }
.hb-beast-category-row button.active { border-color:color-mix(in srgb,var(--hb-accent) 42%,var(--hb-line)); background:var(--hb-soft); color:var(--hb-accent); }
.hb-beast-category-row button:hover { color:var(--hb-fg); border-color:var(--hb-accent); }
.hb-beast-category-row .hb-beast-clear { margin-left:auto; background:transparent; color:var(--hb-accent); }
.hb-polish .hb-beast .hb-beast-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr)); gap:15px; margin:0; }
.hb-polish .hb-beast .hb-beast-card { position:relative; min-width:0; display:flex; flex-direction:column; border:1px solid var(--hb-line); border-radius:17px; overflow:hidden; background:var(--hb-surface-alt); opacity:1; box-shadow:0 5px 18px rgba(0,0,0,.1); transition:transform .18s,border-color .18s,box-shadow .18s; }
.hb-polish .hb-beast .hb-beast-card:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--hb-accent) 55%,var(--hb-line)); box-shadow:0 12px 30px rgba(0,0,0,.2); }
.hb-polish .hb-beast .hb-beast-card:focus-visible { outline:2px solid var(--hb-accent); outline-offset:3px; }
.hb-beast-card-media { position:relative; height:183px; flex:0 0 183px; overflow:hidden; background:linear-gradient(135deg,color-mix(in srgb,var(--hb-accent) 11%,var(--hb-surface)),var(--season-bg,#141118)); }
.hb-polish .hb-beast .hb-beast-card-media .bestiary-creature-image,.hb-polish .hb-beast .hb-beast-card-media .bestiary-creature-placeholder { width:100%; height:100%; display:block; object-fit:cover; }
.hb-polish .hb-beast .hb-beast-card-media .bestiary-creature-placeholder { display:grid; place-items:center; background:radial-gradient(circle at 50% 45%,var(--hb-soft),var(--hb-surface-alt)); color:var(--hb-accent); font-size:66px; }
.hb-beast-card-shade { position:absolute; inset:0; pointer-events:none; background:linear-gradient(180deg,rgba(9,11,15,.55),transparent 40%,rgba(9,11,15,.66)); }
.hb-beast-card-top { position:absolute; top:10px; left:10px; right:10px; display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.hb-beast-threat { display:inline-flex; align-items:center; gap:5px; min-height:27px; padding:6px 9px; border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(25,30,36,.86); backdrop-filter:blur(9px); color:#dbe4e9; font-size:10px; font-weight:850; white-space:nowrap; }
.hb-beast-threat-moderate { color:#f3cf8e; border-color:rgba(240,196,118,.42); }
.hb-beast-threat-high { color:#ffb28c; border-color:rgba(239,132,91,.45); }
.hb-beast-threat-extreme { color:#ff9296; border-color:rgba(244,102,112,.52); background:rgba(66,24,33,.87); }
.hb-polish .hb-beast .hb-beast-visibility { position:static; flex:0 0 31px; width:31px; height:31px; border:1px solid rgba(255,255,255,.22); border-radius:9px; background:rgba(15,18,22,.8); color:#f1f4f7; font-size:17px; }
.hb-polish .hb-beast .hb-beast-visibility:hover { background:var(--hb-accent); color:var(--season-bg,#141118); }
.hb-beast-card-category { position:absolute; bottom:11px; left:12px; display:inline-flex; padding:5px 9px; border-radius:6px; background:rgba(10,14,18,.72); color:#f4f4f4; font-size:10px; font-weight:850; letter-spacing:.04em; }
.hb-polish .hb-beast .hb-beast-card-body { display:flex; flex:1; flex-direction:column; gap:0; min-height:0; padding:16px; }
.hb-polish .hb-beast .hb-beast-card-body h3 { margin:0 0 8px; font-size:18px; line-height:1.3; letter-spacing:-.02em; color:var(--hb-fg); }
.hb-polish .hb-beast .hb-beast-card-body .hb-beast-card-description { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:35px; margin:0 0 14px; font-size:11px; line-height:1.55; color:var(--hb-muted); }
.hb-beast-card-resources { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:auto; }
.hb-beast-card-resources > span { display:flex; justify-content:space-between; align-items:center; gap:4px; min-width:0; padding:9px 8px; border:1px solid var(--hb-line); border-radius:9px; background:color-mix(in srgb,var(--hb-surface) 65%,transparent); }
.hb-beast-card-resources small { font-size:10px; color:var(--hb-muted); font-weight:850; }
.hb-beast-card-resources strong { font-size:13px; color:var(--hb-fg); font-variant-numeric:tabular-nums; }
.hb-beast-card-traits { display:flex; gap:5px; flex-wrap:wrap; min-height:24px; margin:11px 0 7px; }
.hb-beast-card-traits span { display:inline-flex; align-items:center; padding:4px 7px; border:1px solid var(--hb-line); border-radius:6px; color:var(--hb-muted); font-size:10px; }
.hb-beast-card-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:7px; padding-top:12px; border-top:1px solid var(--hb-line); }
.hb-beast-card-status { color:#79cba9; font-size:10px; font-weight:750; }
.hb-beast-card-status.secret { color:#f0bb7e; }
.hb-beast-card-open { display:inline-flex; align-items:center; gap:5px; color:var(--hb-accent); font-size:11px; font-weight:800; }
.hb-beast-card-edit { width:100%; margin-top:10px; padding:9px; border:1px solid var(--hb-line); border-radius:8px; background:color-mix(in srgb,var(--hb-accent) 7%,transparent); color:var(--hb-fg); font-size:11px; font-weight:750; cursor:pointer; }
.hb-beast-card-edit:hover { border-color:var(--hb-accent); color:var(--hb-accent); }
.hb-polish .hb-beast .hb-beast-grid.hb-beast-list-mode { grid-template-columns:1fr; }
.hb-beast-list-mode .hb-beast-card { flex-direction:row !important; min-height:178px; }
.hb-beast-list-mode .hb-beast-card-media { width:220px; height:auto; flex:0 0 220px; }
.hb-beast-list-mode .hb-beast-card-body { display:grid !important; grid-template-columns:minmax(0,1fr) minmax(165px,220px); column-gap:18px; align-content:center; }
.hb-beast-list-mode .hb-beast-card-body h3,.hb-beast-list-mode .hb-beast-card-description { grid-column:1; }
.hb-beast-list-mode .hb-beast-card-resources { grid-column:2; grid-row:1 / span 2; align-self:center; }
.hb-beast-list-mode .hb-beast-card-traits { grid-column:1; }
.hb-beast-list-mode .hb-beast-card-footer { grid-column:1 / -1; }
.hb-beast-list-mode .hb-beast-card-edit { grid-column:1 / -1; }
.hb-beast-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; min-height:270px; padding:30px; border:1px dashed var(--hb-line); border-radius:17px; background:color-mix(in srgb,var(--hb-surface-alt) 65%,transparent); text-align:center; }
.hb-beast-empty-icon { display:grid; place-items:center; width:65px; height:65px; border:1px solid color-mix(in srgb,var(--hb-accent) 30%,var(--hb-line)); border-radius:19px; background:var(--hb-soft); color:var(--hb-accent); font-size:38px; }
.hb-beast-empty h3 { margin:4px 0 0; font-size:19px; color:var(--hb-fg); }
.hb-beast-empty p { margin:0 0 8px; max-width:390px; color:var(--hb-muted); font-size:12px; line-height:1.65; }
.hb-beast-empty button { margin-top:3px; }
/* Editor e ficha de criatura */
.hb-polish .hb-beast .hb-beast-editor { width:min(800px,calc(100vw - 24px)); max-height:calc(100dvh - 38px); overflow-y:auto; padding:0; border:1px solid var(--hb-line); border-radius:20px; background:var(--hb-surface); }
.hb-beast-editor-header { position:sticky; top:0; z-index:2; margin-bottom:0; padding:22px 26px; border-bottom:1px solid var(--hb-line); background:var(--hb-surface); }
.hb-beast-editor-header h2 { margin:5px 0 6px; }
.hb-beast-editor-header p { margin:0; }
.hb-beast-editor-body { display:grid; gap:0; padding:0 26px; }
.hb-beast-form-section { display:grid; gap:14px; padding:22px 0; border-bottom:1px solid var(--hb-line); }
.hb-beast-form-section:last-child { border-bottom:0; }
.hb-beast-form-heading { display:flex; align-items:center; gap:12px; }
.hb-beast-form-heading > span { display:grid; place-items:center; flex:0 0 36px; height:36px; border:1px solid color-mix(in srgb,var(--hb-accent) 27%,var(--hb-line)); border-radius:11px; background:var(--hb-soft); color:var(--hb-accent); font-size:12px; font-weight:900; }
.hb-beast-form-heading h3 { margin:0; color:var(--hb-fg); font-size:15px; }
.hb-beast-form-heading p { margin:3px 0 0; color:var(--hb-muted); font-size:11px; }
.hb-beast-upload-row { display:flex; align-items:center; gap:15px; }
.hb-beast-upload-preview { display:grid; place-items:center; flex:0 0 106px; width:106px; height:106px; border:1px solid var(--hb-line); border-radius:14px; background:var(--hb-soft); overflow:hidden; color:var(--hb-accent); font-size:48px; }
.hb-beast-upload-preview img { width:100%; height:100%; object-fit:cover; }
.hb-beast-upload-label { flex:1; min-width:0; }
.hb-beast-upload-label input { width:100%; max-width:100%; }
.hb-beast-upload-label small { color:var(--hb-muted); overflow-wrap:anywhere; }
.hb-beast-trait-inputs { display:grid; grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); gap:12px; }
.hb-beast-trait-inputs label { min-width:0; }
.hb-beast-trait-inputs textarea { width:100%; min-height:100px; }
.hb-polish .hb-beast .hb-beast-editor-actions { position:sticky; bottom:0; z-index:2; display:flex; justify-content:flex-end; gap:9px; padding:16px 26px; margin:0; border-top:1px solid var(--hb-line); background:var(--hb-surface); }
.hb-polish .hb-beast .hb-beast-editor-actions button { min-height:42px; border-radius:10px; }
.hb-polish .hb-beast .hb-beast-detail { width:min(850px,calc(100vw - 24px)); max-height:calc(100dvh - 36px); overflow-y:auto; padding:0; border:1px solid var(--hb-line); border-radius:20px; background:var(--hb-surface); }
.hb-beast-detail-hero { position:relative; height:290px; overflow:hidden; background:radial-gradient(circle at 50% 35%,var(--hb-soft),var(--hb-surface-alt)); }
.hb-beast-detail-hero > img,.hb-beast-detail-placeholder { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.hb-beast-detail-placeholder { display:grid; place-items:center; color:var(--hb-accent); font-size:130px; }
.hb-beast-detail-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(12,13,18,.24),rgba(12,13,18,.18) 30%,rgba(12,13,18,.96) 100%); }
.hb-beast-detail-identity { position:absolute; left:28px; right:28px; bottom:24px; color:#fff; }
.hb-beast-detail-category { display:inline-block; margin-left:8px; padding:5px 9px; border:1px solid rgba(255,255,255,.22); border-radius:999px; background:rgba(12,15,19,.62); font-size:10px; font-weight:850; }
.hb-beast-detail-identity h2 { margin:11px 0 5px; color:#fff; font-size:clamp(25px,4vw,36px); line-height:1.1; letter-spacing:-.035em; }
.hb-beast-detail-identity p { margin:0; color:#d9e0e5; font-size:11px; }
.hb-beast-detail-close { position:absolute; top:16px; right:16px; display:grid; place-items:center; width:35px; height:35px; border:1px solid rgba(255,255,255,.22); border-radius:10px; background:rgba(16,19,24,.76); color:#fff; font-size:24px; cursor:pointer; }
.hb-beast-detail-content { padding:24px 28px 28px; }
.hb-beast-detail-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.hb-beast-detail-stats article { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:5px; padding:16px; border:1px solid var(--hb-line); border-radius:12px; background:var(--hb-surface-alt); }
.hb-beast-detail-stats article > span { color:var(--hb-muted); font-size:10px; font-weight:850; letter-spacing:.035em; }
.hb-beast-detail-stats article strong { color:var(--hb-fg); font-size:29px; line-height:1.15; font-variant-numeric:tabular-nums; }
.hb-beast-detail-stats article small { position:absolute; right:15px; bottom:15px; color:var(--hb-accent); font-size:11px; font-weight:850; }
.hb-beast-detail-section { margin-top:25px; }
.hb-beast-detail-section-title { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.hb-beast-detail-section-title span { color:var(--hb-accent); font-size:11px; font-weight:900; }
.hb-beast-detail-section-title h3 { margin:0; color:var(--hb-fg); font-size:16px; }
.hb-beast-detail-section p { margin:0; color:var(--hb-muted); font-size:13px; line-height:1.75; white-space:pre-wrap; }
.hb-beast-detail-traits { display:grid; grid-template-columns:repeat(auto-fit,minmax(175px,1fr)); gap:10px; margin-top:24px; }
.hb-beast-trait-panel { min-width:0; padding:15px; border:1px solid var(--hb-line); border-radius:12px; background:var(--hb-surface-alt); }
.hb-beast-trait-panel h3 { display:flex; align-items:center; gap:6px; margin:0 0 12px; color:var(--hb-fg); font-size:12px; }
.hb-beast-trait-panel h3 span { color:var(--hb-accent); font-size:16px; }
.hb-beast-trait-panel h3 small { margin-left:auto; color:var(--hb-muted); font-size:10px; }
.hb-beast-trait-tags { display:flex; flex-wrap:wrap; gap:6px; }
.hb-beast-trait-tags span { padding:6px 8px; border:1px solid var(--hb-line); border-radius:7px; background:var(--hb-surface); color:var(--hb-fg); font-size:11px; overflow-wrap:anywhere; }
.hb-beast-trait-panel > p { margin:0; color:var(--hb-muted); font-size:11px; }
.hb-beast-trait-weakness h3 span { color:#e8a074; }
.hb-beast-trait-immunity h3 span { color:#7dcbb9; }
.hb-beast-trait-peculiarity h3 span { color:#9cc9f1; }
.hb-beast-trait-vice h3 span { color:#e4a0c0; }
.hb-beast-detail-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:9px; margin-top:24px; padding-top:18px; border-top:1px solid var(--hb-line); }
.hb-beast-detail-actions button { min-height:42px; border-radius:10px; }
@media(max-width:950px) { .hb-beast-hero-symbol { display:none; } .hb-beast-list-mode .hb-beast-card-media { width:185px; flex-basis:185px; } }
@media(max-width:700px) { .hb-beast-hero-side { width:100%; } .hb-beast-hero-side .hb-beast-create { width:100%; } .hb-polish .hb-beast .hb-beast-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .hb-beast-library-head { align-items:flex-start; } .hb-beast-library-head p { display:none; } .hb-beast-filter { flex:1 1 145px; } .hb-beast-view-toggle { margin-left:auto; } .hb-beast-list-mode .hb-beast-card-media { width:140px; flex-basis:140px; } .hb-beast-list-mode .hb-beast-card-body { display:flex !important; } .hb-beast-detail-traits { grid-template-columns:1fr; } .hb-beast-trait-inputs { grid-template-columns:1fr; } }
@media(max-width:500px) { .hb-polish .hb-beast-library { padding:13px; } .hb-polish .hb-beast .hb-beast-grid { grid-template-columns:1fr; } .hb-beast-list-mode .hb-beast-card { flex-direction:column !important; } .hb-beast-list-mode .hb-beast-card-media { width:100%; height:160px; flex-basis:160px; } .hb-beast-library-head { flex-wrap:wrap; } .hb-beast-detail-hero { height:230px; } .hb-beast-detail-identity { left:17px; right:17px; bottom:17px; } .hb-beast-detail-content { padding:17px; } .hb-beast-detail-stats { gap:6px; } .hb-beast-detail-stats article { padding:10px; } .hb-beast-detail-stats article > span { font-size:9px; } .hb-beast-detail-stats article strong { font-size:22px; } .hb-beast-editor-body { padding:0 17px; } .hb-beast-editor-header { padding:17px; } .hb-polish .hb-beast .hb-beast-editor-actions { padding:12px 17px; } .hb-beast-upload-row { align-items:flex-start; } .hb-beast-upload-preview { width:80px; height:80px; flex-basis:80px; } }
@media(prefers-reduced-motion:reduce) { .hb-beast-card,.hb-beast-category-row button,.hb-beast-create { transition:none !important; } }

/* Loja: unificar as areas existentes com a nova linguagem visual */
.hb-polish .hb-shops-hero { margin-bottom:18px; }
.hb-polish .hb-market-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
.hb-polish .hb-market-form { margin-bottom:20px; }
.hb-polish .page-shops .shops-workspace { gap:16px; align-items:start; }
.hb-polish .page-shops .shops-sidebar,.hb-polish .page-shops .shops-main { border:1px solid var(--hb-line); border-radius:19px; background:linear-gradient(155deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 57%,transparent)); box-shadow:0 7px 21px rgba(0,0,0,.065); }
.hb-polish .page-shops .shops-sidebar-heading { border-bottom:1px solid var(--hb-line); }
.hb-polish .page-shops .shop-card { border-radius:13px; transition:border-color .17s,background .17s,transform .17s; }
.hb-polish .page-shops .shop-card:hover { transform:translateY(-1px); border-color:color-mix(in srgb,var(--hb-accent) 35%,var(--hb-line)); }
.hb-polish .page-shops .shop-card.is-selected { border-color:var(--hb-accent) !important; background:var(--hb-soft); }
.hb-polish .page-shops .shops-hero { border:1px solid var(--hb-line); border-radius:16px; background:radial-gradient(ellipse at 0 0,var(--hb-soft),transparent 62%),var(--hb-surface-alt); }
.hb-polish .page-shops .shop-product-card { border-radius:15px; }
/* Campanhas: portfolio, controles administrativos, temporadas, economia e permissões */
.hb-polish .hb-campaigns-page { display:grid; gap:17px; }
.hb-polish .hb-campaigns-page > .hb-campaigns-hero { margin-bottom:0; }
.hb-polish .hb-campaigns-hero > div:first-child { flex:1 1 330px; }
.hb-polish .hb-campaign-chooser { margin:0; }
.hb-polish .hb-campaign-chooser-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,265px),1fr)); gap:11px; }
.hb-polish .hb-campaign-option { display:flex; align-items:center; gap:11px; min-width:0; padding:15px; border:1px solid var(--hb-line); border-radius:13px; background:color-mix(in srgb,var(--hb-surface-alt) 45%,transparent); color:var(--hb-fg); cursor:pointer; text-align:left; transition:transform .15s,border-color .15s; }
.hb-polish .hb-campaign-option:hover { transform:translateY(-2px); border-color:var(--hb-accent); }
.hb-polish .hb-campaign-option.is-selected { background:var(--hb-soft); border-color:color-mix(in srgb,var(--hb-accent) 50%,var(--hb-line)); }
.hb-polish .hb-campaign-option-art { display:grid; place-items:center; width:44px; height:44px; flex:0 0 44px; border-radius:12px; background:var(--hb-soft); color:var(--hb-accent); font-size:24px; }
.hb-polish .hb-campaign-option-copy { display:grid; flex:1; min-width:0; gap:4px; }
.hb-polish .hb-campaign-option-copy strong { font-size:13px; overflow-wrap:anywhere; }
.hb-polish .hb-campaign-option-copy small { color:var(--hb-muted); font-size:10px; }
.hb-polish .hb-campaign-selection { align-self:flex-end; color:var(--hb-accent); font-size:10px; font-weight:850; white-space:nowrap; }
.hb-polish .hb-campaigns-page > .add-form { margin:0; }
.hb-polish .hb-campaigns-page .season-editor-toggle { justify-self:start; min-height:41px; border-radius:10px; }
.hb-polish .hb-campaigns-page .campaign-editor-grid { grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr)); gap:12px; }
.hb-polish .hb-campaigns-page .campaign-editor-grid .item-card { gap:9px; padding:18px; border:1px solid var(--hb-line); border-radius:15px; background:var(--hb-surface); }
.hb-polish .hb-campaigns-page .campaign-editor-grid .item-card h3 { margin:0; font-size:15px; }
.hb-polish .hb-campaigns-page .campaign-editor-grid .item-card button { align-self:stretch; border-radius:9px; }
.hb-polish .hb-campaigns-page .hb-admin-panel { min-width:0; padding:22px; border:1px solid var(--hb-line); border-radius:19px; background:linear-gradient(145deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 50%,transparent)); }
.hb-polish .hb-season-editor { gap:19px; }
.hb-polish .hb-season-create-form { display:grid; gap:14px; }
.hb-polish .hb-season-create-form label { display:grid; gap:7px; font-size:12px; }
.hb-polish .hb-season-create-form :is(input,select,textarea) { padding:11px 12px; min-height:43px; border:1px solid var(--hb-line); border-radius:10px; background:var(--season-bg,#121014); color:var(--hb-fg); }
.hb-polish .hb-season-create-form > .primary-button { justify-self:start; }
.hb-polish .hb-season-order { margin:0; background:color-mix(in srgb,var(--hb-surface-alt) 40%,transparent); }
.hb-polish .hb-season-order > div:not(.hb-form-heading) > div { border-radius:13px !important; border-color:var(--hb-line) !important; background:color-mix(in srgb,var(--hb-surface-alt) 42%,transparent); }
.hb-polish .hb-season-order button { min-width:37px; border-radius:9px; }
.hb-polish .hb-currency-panel .currency-balance { padding:13px 15px; border:1px solid var(--hb-line); border-radius:12px; background:color-mix(in srgb,var(--hb-surface-alt) 48%,transparent); }
.hb-polish .hb-currency-panel .currency-balance > span { font-size:13px; font-weight:800; }
.hb-polish .hb-currency-panel .form-row { gap:11px; }
.hb-polish .hb-currency-panel :is(input,select) { min-height:42px; border:1px solid var(--hb-line); border-radius:10px; background:var(--season-bg,#121014); color:var(--hb-fg); }
.hb-polish .hb-campaigns-page .hb-members-panel .item-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:14px; }
.hb-polish .hb-member-card { gap:10px; padding:18px; border-radius:16px; }
.hb-polish .hb-member-card .item-art { display:grid; place-items:center; width:56px; height:56px; border-radius:15px; background:var(--hb-soft); font-size:29px; }
.hb-polish .hb-member-card .item-category { color:var(--hb-accent); font-size:10px; font-weight:850; letter-spacing:.09em; }
.hb-polish .hb-member-card h3 { margin:0; font-size:16px; }
.hb-polish .hb-member-card p { margin:0; min-height:32px; }
.hb-polish .hb-member-card > div:last-child { width:100%; }
.hb-polish .hb-member-card button { min-height:36px; border-radius:9px; }
.hb-polish .hb-access-panel > div:not(.inventory-heading) { max-width:100%; }
.hb-polish .hb-access-panel > div:not(.inventory-heading) :is(select,input) { border-radius:10px; min-height:42px; }
.hb-polish .hb-access-panel label { color:var(--hb-muted); }
/* Geral: estados de foco, responsividade e movimento reduzido */
.hb-polish .page-content :is(.hb-metric-button,.hb-roster-entry,.hb-campaign-option,.hb-character-card button,.hb-hero button,.hb-bestiary-card):focus-visible { outline:2px solid var(--hb-accent); outline-offset:3px; }
@media(max-width:1120px) { .hb-polish .hb-metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .hb-polish .hb-dashboard-grid { grid-template-columns:1fr; } }
@media(max-width:760px) { .hb-polish .hb-hero { padding:22px; } .hb-polish .hb-hero-emblem { width:65px; height:65px; flex-basis:65px; font-size:33px; border-radius:18px; } .hb-polish .hb-market-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .hb-polish .hb-characters-hero > div:last-child { width:100%; } .hb-polish .hb-characters-hero > div:last-child :is(button) { flex:1; } }
@media(max-width:520px) { .hb-polish .hb-metric-grid { grid-template-columns:1fr; } .hb-polish .hb-hero { gap:14px; padding:20px; border-radius:17px; } .hb-polish .hb-hero h2 { font-size:27px; } .hb-polish .hb-hero-emblem { display:none; } .hb-polish .hb-panel,.hb-polish .hb-form,.hb-polish .hb-campaigns-page .hb-admin-panel { padding:16px; border-radius:15px; } .hb-polish .hb-campaign-option { flex-wrap:wrap; } .hb-polish .hb-campaign-selection { margin-left:auto; } .hb-polish .hb-bestiary-toolbar select { flex:1 1 100%; } .hb-polish .hb-bestiary-toolbar .hb-reset-filters { flex:1 1 100%; } .hb-polish .hb-journey-entry { flex-wrap:wrap; } .hb-polish .hb-season-status { margin-left:52px; } .hb-polish .hb-hero-actions > button { flex:1 1 100%; } .hb-polish .hb-characters-hero button { flex:1; } }

.hb-polish .page-content.page-campaigns > .campaigns-page-panel.hb-campaigns-page { display:grid !important; gap:17px; }
.hb-polish .hb-master-page .master-shield { margin:0; padding:0; border:0; background:none; }
.hb-polish .hb-master-page .master-shield-heading { margin-bottom:20px; }
.hb-polish .hb-master-page .master-shield-heading h2 { margin:6px 0 8px; }
.hb-polish .hb-master-page .master-shield-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:0 0 17px; }
.hb-polish .hb-master-page .master-shield-stat { min-height:92px; padding:17px; border:1px solid var(--hb-line); border-radius:15px; background:linear-gradient(145deg,var(--hb-surface),var(--hb-surface-alt)); }
.hb-polish .hb-master-page .master-shield-stat span { text-transform:uppercase; font-size:10px; letter-spacing:.08em; font-weight:800; }
.hb-polish .hb-master-page .master-shield-stat strong { margin-top:10px; font-family:'Space Grotesk',Manrope,sans-serif; font-size:20px; line-height:1.3; }
.hb-polish .hb-master-page .master-shield-columns { margin-top:16px; }
.hb-polish .hb-master-page .master-shield-columns > div { border-radius:17px; background:linear-gradient(155deg,var(--hb-surface),color-mix(in srgb,var(--hb-surface-alt) 62%,transparent)); }
.hb-polish .hb-master-page .master-shield-character { border-radius:14px; }
.hb-polish .hb-master-page .campaign-activity-panel { margin-top:20px; border-radius:17px; }
@media(max-width:1000px) { .hb-polish .hb-master-page .master-shield-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:500px) { .hb-polish .hb-master-page .master-shield-stat { min-height:84px; padding:13px; } .hb-polish .hb-master-page .master-shield-stat strong { font-size:16px; } }
@media (prefers-reduced-motion: reduce) { .hb-polish .hb-metric,.hb-polish .hb-character-card,.hb-polish .hb-bestiary-card,.hb-polish .hb-campaign-option,.hb-polish .nav-link { transition:none !important; transform:none !important; } }
`}</style>

<style>{`

/* HäxBag · Nova navegação principal + Escudo do Mestre em seções independentes */
.hb-polish .hb-sidebar{gap:0;padding:22px 15px 17px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--season-primary) 32%,transparent) transparent;background:radial-gradient(ellipse at 12% 0%,color-mix(in srgb,var(--season-primary) 11%,transparent),transparent 45%),linear-gradient(180deg,var(--season-bg,#141217),color-mix(in srgb,var(--season-surface,#201b21) 80%,var(--season-bg,#141217)))}
.hb-polish .hb-sidebar-brand{display:flex;gap:11px;align-items:center;padding:7px 8px 20px;text-decoration:none;color:var(--season-text,#f4f0ea);border-bottom:1px solid var(--season-line,rgba(255,255,255,.12));margin-bottom:18px;min-height:65px}
.hb-polish .hb-sidebar-brand .brand-mark{flex:0 0 44px;width:44px;height:44px;font-size:22px;border-radius:14px}
.hb-polish .hb-sidebar-brand-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.hb-polish .hb-sidebar-brand-copy strong{font-family:'Space Grotesk',Manrope,sans-serif;font-size:23px;letter-spacing:-1px;line-height:1}
.hb-polish .hb-sidebar-brand-copy small{font-size:8px;letter-spacing:.16em;font-weight:800;color:var(--season-muted,#a9a1ac)}
.hb-polish .hb-sidebar-brand-spark{margin-left:auto;color:var(--season-primary,#d9af84);font-size:13px;opacity:.8}
.hb-polish .hb-sidebar-workspace{padding:15px 13px 12px;border:1px solid color-mix(in srgb,var(--season-primary,#d6a37d) 19%,var(--season-line,rgba(255,255,255,.1)));border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--season-primary,#d6a37d) 9%,var(--season-surface,#211d23)),var(--season-surface,#211d23));box-shadow:inset 0 1px rgba(255,255,255,.04)}
.hb-polish .hb-sidebar-workspace-top{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:14px}
.hb-polish .hb-sidebar-eyebrow{font-size:9px;font-weight:850;letter-spacing:.10em;color:var(--season-primary,#d6a37d)}
.hb-polish .hb-sidebar-role{padding:4px 7px;border-radius:99px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 13%,transparent);font-weight:750;font-size:9px;color:var(--season-primary,#d6a37d)}
.hb-polish .hb-sidebar-workspace label{display:block;margin-bottom:7px;color:var(--season-muted,#b3aab5);font-weight:700;font-size:10px}
.hb-polish .hb-sidebar-campaign-field{display:flex;align-items:center;gap:8px;padding:5px 9px;min-width:0;border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:11px;background:var(--season-bg,#171319)}
.hb-polish .hb-sidebar-campaign-symbol{color:var(--season-primary,#d6a37d);font-size:18px}
.hb-polish .hb-sidebar-campaign-field select{appearance:auto;min-width:0;width:100%;height:35px;border:0!important;outline:none;background:transparent!important;color:var(--season-text,#eee);font:700 11px Manrope,sans-serif;cursor:pointer}
.hb-polish .hb-sidebar-create{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;margin-top:10px;min-height:35px;border:1px dashed color-mix(in srgb,var(--season-primary,#d6a37d) 36%,var(--season-line,rgba(255,255,255,.14)));border-radius:10px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 5%,transparent);color:var(--season-primary,#d6a37d);font-size:11px;font-weight:800;cursor:pointer;transition:background .15s,border-color .15s}
.hb-polish .hb-sidebar-create:hover{background:color-mix(in srgb,var(--season-primary,#d6a37d) 14%,transparent);border-color:var(--season-primary,#d6a37d)}
.hb-polish .hb-sidebar-create span{font-size:19px;line-height:1}
.hb-polish .hb-sidebar-nav{display:flex;flex-direction:column;gap:15px;margin:23px 0 20px}
.hb-polish .hb-sidebar-nav-group{display:flex;flex-direction:column;gap:5px;min-width:0}
.hb-polish .hb-sidebar-group-title{padding:0 10px 7px;font-size:9px;font-weight:850;letter-spacing:.15em;color:var(--season-muted,#aea4ad);opacity:.85}
.hb-polish .hb-sidebar-nav .nav-link{display:flex;align-items:center;gap:10px;min-width:0;min-height:43px;padding:6px 10px;border-radius:12px;color:var(--season-muted,#b3aab6);font-weight:650;letter-spacing:.005em}
.hb-polish .hb-sidebar-nav .nav-link.active{color:var(--season-text,#f4efea);font-weight:850;box-shadow:inset 3px 0 var(--season-primary,#d6a37d),0 4px 15px rgba(0,0,0,.1)}
.hb-polish .hb-sidebar-nav .nav-link:focus-visible,.hb-polish .hb-sidebar-create:focus-visible,.hb-polish .hb-sidebar-invite-button:focus-visible{outline:2px solid var(--season-primary,#d6a37d);outline-offset:2px}
.hb-polish .hb-sidebar-nav-icon{display:grid;place-items:center;flex:0 0 31px;width:31px!important;height:31px;border-radius:9px;border:1px solid var(--season-line,rgba(255,255,255,.11));background:var(--season-surface-alt,rgba(255,255,255,.05));color:var(--season-primary,#d6a37d)!important;font-size:18px!important;line-height:1}
.hb-polish .hb-sidebar-nav .nav-link.active .hb-sidebar-nav-icon{background:color-mix(in srgb,var(--season-primary,#d6a37d) 20%,transparent);border-color:color-mix(in srgb,var(--season-primary,#d6a37d) 32%,transparent)}
.hb-polish .hb-sidebar-nav-name{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.hb-polish .hb-sidebar-nav .nav-count{margin-left:auto;padding:4px 7px;border-radius:7px;font-size:10px;font-weight:800;background:color-mix(in srgb,var(--season-primary,#d6a37d) 10%,var(--season-surface-alt,#211d23))}
.hb-polish .hb-sidebar-nav-flair{margin-left:auto;color:var(--season-primary,#d6a37d);font-size:8px;letter-spacing:.04em;font-weight:850}
.hb-polish .hb-sidebar-nav .nav-link:disabled{opacity:.45;cursor:not-allowed;transform:none}
.hb-polish .hb-sidebar-footer{display:grid;gap:12px;margin-top:auto}
.hb-polish .hb-sidebar-invite{padding:14px;border-radius:15px;background:linear-gradient(135deg,color-mix(in srgb,var(--season-primary,#d6a37d) 10%,var(--season-surface,#1d1820)),var(--season-surface,#1d1820))}
.hb-polish .hb-sidebar-invite-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.hb-polish .hb-sidebar-invite .invite-icon{display:grid;place-items:center;width:33px;height:33px;margin:0;border-radius:10px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 15%,transparent)}
.hb-polish .hb-sidebar-invite-tag{font-size:8px;font-weight:850;letter-spacing:.13em;color:var(--season-primary,#d6a37d)}
.hb-polish .hb-sidebar-invite strong{font-size:12px}
.hb-polish .hb-sidebar-invite p{margin:7px 0 12px;line-height:1.5}
.hb-polish .hb-sidebar-invite .hb-sidebar-invite-button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:10px 11px;border:1px solid color-mix(in srgb,var(--season-primary,#d6a37d) 38%,transparent);border-radius:10px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 15%,transparent);color:var(--season-primary,#d6a37d);font-size:11px;font-weight:850;cursor:pointer}
.hb-polish .hb-sidebar-invite .hb-sidebar-copy{display:block;width:100%;padding:9px 4px 1px;text-align:center;font-size:10px;color:var(--season-muted,#b2a9b5);cursor:pointer}
.hb-polish .hb-sidebar-profile{gap:10px;margin-top:0;padding:14px 3px 2px}
.hb-polish .hb-sidebar-profile .profile-info{min-width:0}
.hb-polish .hb-sidebar-profile .profile-info :is(strong,small){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hb-polish .hb-sidebar-online{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:#77c49a;box-shadow:0 0 0 4px rgba(119,196,154,.10)}
.hb-polish .hb-topbar-trail{min-width:0;gap:10px}
.hb-polish .hb-topbar-trail span,.hb-polish .hb-topbar-trail strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb-polish .hb-topbar-trail strong{color:var(--season-primary,#d6a37d);font-weight:800}
/* Escudo do Mestre: topo de controle, party principal, iniciativas, inimigos e atividades */
.hb-polish .hb-ms-dashboard{padding:0;border:0;background:none;box-shadow:none;overflow:visible;isolation:auto}
.hb-polish .hb-ms-dashboard:before{display:none}
.hb-polish .hb-ms-dashboard .master-shield-heading{margin:0 0 13px;padding:clamp(22px,3vw,34px);border-radius:23px}
.hb-polish .hb-ms-quicknav{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:6px 0 11px;margin-bottom:6px}
.hb-polish .hb-ms-quicknav a{display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:11px;border:1px solid var(--season-line,rgba(255,255,255,.13));background:var(--season-surface,#1c1920);color:var(--season-muted,#bcb3bf);font-size:11px;font-weight:800;text-decoration:none;transition:background .15s,border-color .15s}
.hb-polish .hb-ms-quicknav a:hover,.hb-polish .hb-ms-quicknav a:focus-visible{background:color-mix(in srgb,var(--season-primary,#d6a37d) 12%,var(--season-surface,#1c1920));border-color:var(--season-primary,#d6a37d);color:var(--season-text,#fff)}
.hb-polish .hb-ms-quicknav a span{font-size:16px;color:var(--season-primary,#d6a37d)}
.hb-polish .hb-ms-stats{grid-template-columns:repeat(4,minmax(0,1fr));margin:6px 0 14px;gap:11px}
.hb-polish .hb-ms-stats .master-shield-stat{min-height:105px;background:linear-gradient(140deg,var(--season-surface,#201c23),color-mix(in srgb,var(--season-surface-alt,#2a252b) 56%,transparent))}
.hb-polish .hb-ms-stats .master-shield-stat strong{font-size:clamp(22px,2.7vw,29px)}
.hb-polish .hb-ms-stats .master-shield-stat .hb-ms-season-name{font-size:clamp(14px,1.5vw,18px);line-height:1.4}
.hb-polish .hb-ms-stats .master-shield-stat small{display:block;position:relative;z-index:1;margin-top:7px;font-size:10px;color:var(--season-muted,#bcb3bf)}
.hb-polish .hb-ms-session-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding:18px 20px;margin:0 0 14px;border-radius:18px;border:1px solid color-mix(in srgb,var(--season-primary,#d6a37d) 24%,var(--season-line,rgba(255,255,255,.12)));background:radial-gradient(ellipse at 100% 0%,color-mix(in srgb,var(--season-primary,#d6a37d) 11%,transparent),transparent 60%),var(--season-surface,#1d1921)}
.hb-polish .hb-ms-session-intro{min-width:210px;flex:1 1 230px}
.hb-polish .hb-ms-session-intro h3{margin:5px 0 4px;font-size:19px;letter-spacing:-.03em}
.hb-polish .hb-ms-session-intro p{margin:0;font-size:11px;line-height:1.5;color:var(--season-muted,#afa5b2)}
.hb-polish .hb-ms-session-actions{display:flex;align-items:end;gap:9px;flex:2 1 300px;justify-content:flex-end}
.hb-polish .hb-ms-session-actions label{flex:1;max-width:370px;display:grid;gap:6px;font-size:10px;font-weight:750;color:var(--season-muted,#afa5b2)}
.hb-polish .hb-ms-session-actions select{width:100%;min-height:42px;padding:9px 12px;border:1px solid var(--season-line,rgba(255,255,255,.15));border-radius:11px;background:var(--season-bg,#151219);color:var(--season-text,#eee);font:650 12px Manrope,sans-serif}
.hb-polish .hb-ms-session-actions button{min-height:42px;border-radius:11px;font-size:11px;white-space:nowrap}
.hb-polish .hb-ms-campaign-description{margin:0 0 16px;padding:12px 16px;border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:13px;background:var(--season-surface,#1d1921);color:var(--season-muted,#afa5b2)}
.hb-polish .hb-ms-campaign-description summary{cursor:pointer;color:var(--season-text,#eee);font-size:12px;font-weight:800}
.hb-polish .hb-ms-campaign-description p{margin:11px 0 2px;line-height:1.6;font-size:12px;white-space:pre-wrap}
.hb-polish .hb-ms-party-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:stretch;margin-bottom:14px}
.hb-polish .hb-ms-pane{min-width:0;padding:clamp(17px,2.2vw,24px);border:1px solid var(--season-line,rgba(255,255,255,.13));border-radius:20px;background:linear-gradient(155deg,var(--season-surface,#1d1a21),color-mix(in srgb,var(--season-surface-alt,#252129) 60%,transparent));box-shadow:inset 0 1px rgba(255,255,255,.025)}
.hb-polish .hb-ms-pane-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}
.hb-polish .hb-ms-pane-heading h3{margin:6px 0 5px;font-size:clamp(18px,2vw,23px);line-height:1.2;letter-spacing:-.035em}
.hb-polish .hb-ms-pane-heading p{margin:0;font-size:11px;color:var(--season-muted,#afa5b2);line-height:1.5}
.hb-polish .hb-ms-section-count{padding:7px 10px;border-radius:50px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 12%,transparent);color:var(--season-primary,#d6a37d);font-size:10px;font-weight:850;white-space:nowrap}
.hb-polish .hb-ms-party-main .master-shield-character-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));margin-top:0}
.hb-polish .hb-ms-party-main .master-shield-character{min-height:195px;border-radius:15px}
.hb-polish .hb-ms-party-members .hb-ms-member-list{display:grid;gap:9px;list-style:none;margin:0;padding:0}
.hb-polish .hb-ms-party-members .hb-ms-member-list li{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:12px;background:var(--season-bg,#16121b)}
.hb-polish .hb-ms-member-avatar{display:grid;place-items:center;flex:0 0 33px;width:33px;height:33px;border-radius:10px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 17%,transparent);color:var(--season-primary,#d6a37d);font-weight:850;font-size:13px}
.hb-polish .hb-ms-member-name{flex:1;min-width:0;overflow-wrap:anywhere;font-size:11px;font-weight:750}
.hb-polish .hb-ms-member-list li small{padding:4px 7px;border-radius:50px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 10%,transparent);font-size:9px;color:var(--season-primary,#d6a37d);font-weight:750}
.hb-polish .hb-ms-initiative-section{margin:0 0 14px;scroll-margin-top:85px}
.hb-polish .hb-ms-initiative-content{padding:0;margin:0}
.hb-polish .hb-ms-initiative-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.hb-polish .hb-ms-initiative-toolbar p{margin:0;font-size:11px;color:var(--season-muted,#b8acb9)}
.hb-polish .hb-ms-initiative-toolbar button{min-height:34px;font-size:11px}
.hb-polish .hb-ms-initiative-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:11px;padding:12px 14px;border-radius:12px;border:1px solid var(--season-line,rgba(255,255,255,.12));background:var(--season-bg,#151119)}
.hb-polish .hb-ms-initiative-row:not(:last-child){margin-bottom:7px}
.hb-polish .hb-ms-enemy-section{scroll-margin-top:85px;margin:0;padding:clamp(17px,2.2vw,24px);border-radius:20px;box-shadow:inset 0 1px rgba(255,255,255,.03)}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr))}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-card{min-height:195px}
.hb-polish .hb-ms-combined-initiative-list{display:grid;gap:8px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-row{margin:0;min-height:70px}
.hb-polish .hb-ms-initiative-identity{display:flex;align-items:center;gap:10px;min-width:0}
.hb-polish .hb-ms-initiative-rank{flex:0 0 30px;font-size:14px;color:var(--season-primary,#d6a37d);font-variant-numeric:tabular-nums}
.hb-polish .hb-ms-initiative-avatar{display:grid;place-items:center;flex:0 0 37px;width:37px;height:37px;border-radius:11px;background:color-mix(in srgb,var(--season-primary,#d6a37d) 12%,transparent);font-size:20px}
.hb-polish .hb-ms-initiative-person{display:grid;gap:3px;min-width:0}
.hb-polish .hb-ms-initiative-person strong{font-size:12px;overflow-wrap:anywhere}
.hb-polish .hb-ms-initiative-person small{font-size:10px;font-weight:750;color:var(--season-muted,#bcb3bf)}
.hb-polish .hb-ms-initiative-enemy .hb-ms-initiative-avatar{background:rgba(197,80,86,.15)}
.hb-polish .hb-ms-initiative-enemy .hb-ms-initiative-person small{color:#d88b90}
.hb-polish .hb-ms-initiative-score{display:flex;align-items:center;gap:12px}
.hb-polish .hb-ms-initiative-score > strong{min-width:45px;text-align:right;font-size:20px;color:var(--season-primary,#d6a37d);font-variant-numeric:tabular-nums}
.hb-polish .hb-ms-initiative-score > strong.pending{font-size:11px;font-weight:650;color:var(--season-muted,#bcb3bf)}
.hb-polish .hb-ms-initiative-score button{min-height:32px;padding:6px 10px;font-size:11px}
.hb-polish .hb-ms-activity-section{margin:0;border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:20px;background:var(--season-surface,#201a22);padding:clamp(17px,2.2vw,24px);scroll-margin-top:85px}
.hb-polish .hb-ms-activity-section .campaign-activity-heading{margin-bottom:16px}
.hb-polish #hb-ms-players{scroll-margin-top:85px}
@media(max-width:1130px){.hb-polish .hb-ms-party-layout{grid-template-columns:1fr}.hb-polish .hb-ms-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.hb-polish .hb-ms-session-actions{justify-content:stretch}.hb-polish .hb-ms-session-actions label{max-width:none}.hb-polish .hb-ms-quicknav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.hb-polish .hb-ms-quicknav a{justify-content:center;text-align:center}.hb-polish .hb-ms-party-main .master-shield-character-list{grid-template-columns:1fr}}
@media(max-width:560px){.hb-polish .hb-ms-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hb-polish .hb-ms-session-actions{flex-direction:column;align-items:stretch}.hb-polish .hb-ms-session-actions label{width:100%}.hb-polish .hb-ms-stats .master-shield-stat{min-height:94px}.hb-polish .hb-ms-quicknav a{font-size:10px;padding:9px 6px}.hb-polish .hb-ms-party-layout{gap:11px}}
@media(max-width:800px){.hb-polish .hb-sidebar{max-height:none;overflow:visible;padding:15px 18px}.hb-polish .hb-sidebar-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.hb-polish .hb-sidebar-nav-group:last-child{grid-column:1/-1}.hb-polish .hb-sidebar-footer{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:end}.hb-polish .hb-sidebar-profile{align-self:end}}
@media(max-width:540px){.hb-polish .hb-sidebar-nav{grid-template-columns:1fr}.hb-polish .hb-sidebar-nav-group:last-child{grid-column:auto}.hb-polish .hb-sidebar-footer{grid-template-columns:1fr}.hb-polish .hb-ms-quicknav{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){.hb-polish .hb-sidebar-nav .nav-link,.hb-polish .hb-ms-quicknav a{transition:none;transform:none}}

/* HäxBag · Escudo do Mestre: composição visual refinada */
.hb-polish .hb-ms-dashboard{--hb-ms-red: #cf686b;--hb-ms-gold:var(--season-primary,#cfa777)}
.hb-polish .hb-ms-dashboard .master-shield-heading{margin-bottom:15px;min-height:200px;align-items:center;background:radial-gradient(ellipse at 82% 28%,color-mix(in srgb,var(--season-primary,#cfa777) 10%,transparent),transparent 49%),radial-gradient(ellipse at 0% 0%,color-mix(in srgb,var(--season-primary,#cfa777) 14%,transparent),transparent 55%),linear-gradient(125deg,var(--season-surface,#1d1b20),var(--season-bg,#141218));border-color:color-mix(in srgb,var(--season-primary,#cfa777) 24%,var(--season-line,rgba(255,255,255,.12)))}
.hb-polish .hb-ms-dashboard .master-shield-heading h2{font-size:clamp(30px,3.6vw,44px);max-width:650px;line-height:1.08}
.hb-polish .hb-ms-dashboard .master-shield-heading p{max-width:620px;font-size:12px;line-height:1.75}
.hb-polish .hb-ms-hero-stamp{display:grid;justify-items:center;gap:10px;position:relative;z-index:1;flex-shrink:0}
.hb-polish .hb-ms-hero-stamp .hb-hero-emblem{width:98px;height:98px;flex:0 0 98px;border-radius:27px;box-shadow:0 12px 34px color-mix(in srgb,var(--season-primary,#cfa777) 10%,transparent),inset 0 1px rgba(255,255,255,.08)}
.hb-polish .hb-ms-hero-stamp small{color:var(--season-muted,#afa7b0);font-size:9px;letter-spacing:.15em;font-weight:850}
.hb-polish .hb-ms-quicknav{padding:3px 0 11px;gap:8px}
.hb-polish .hb-ms-quicknav a{min-height:40px;padding:10px 14px;border-radius:12px;transition:background .17s,border-color .17s,transform .17s;box-shadow:inset 0 1px rgba(255,255,255,.018)}
.hb-polish .hb-ms-quicknav a:hover{transform:translateY(-2px)}
.hb-polish .hb-ms-stats{gap:12px;margin:3px 0 14px}
.hb-polish .hb-ms-stats .master-shield-stat{position:relative;overflow:hidden;min-height:115px;display:flex;flex-direction:column;justify-content:space-between;gap:0;padding:17px 18px;border-radius:17px;box-shadow:inset 0 1px rgba(255,255,255,.035)}
.hb-polish .hb-ms-stats .master-shield-stat:before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--season-primary,#cfa777),transparent 82%);opacity:.72}
.hb-polish .hb-ms-stats .master-shield-stat:nth-child(2):before{background:linear-gradient(90deg,var(--hb-ms-red),transparent 85%)}
.hb-polish .hb-ms-stats .master-shield-stat strong{margin:8px 0 0;font-size:clamp(25px,2.7vw,30px);line-height:1.15;word-break:break-word}
.hb-polish .hb-ms-stats .master-shield-stat strong em{font-size:14px;font-style:normal;font-weight:650;color:var(--season-muted,#afa7b0)}
.hb-polish .hb-ms-stats .master-shield-stat span{font-size:10px;letter-spacing:.065em;text-transform:uppercase}
.hb-polish .hb-ms-stats .master-shield-stat small{margin-top:7px;font-size:10px}
.hb-polish .hb-ms-session-toolbar{gap:18px;padding:21px 23px;margin-bottom:18px;border-radius:19px}
.hb-polish .hb-ms-session-intro h3{font-size:20px}
.hb-polish .hb-ms-session-intro p{font-size:11px;max-width:430px}
.hb-polish .hb-ms-group-heading,.hb-polish .hb-ms-support-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:28px 0 13px}
.hb-polish .hb-ms-group-heading-left{display:flex;align-items:center;gap:13px;min-width:0}
.hb-polish .hb-ms-group-index{width:39px;height:39px;flex:0 0 39px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--season-primary,#cfa777) 28%,var(--season-line,rgba(255,255,255,.12)));border-radius:12px;background:color-mix(in srgb,var(--season-primary,#cfa777) 10%,var(--season-surface,#211d25));font-size:13px;font-weight:900;color:var(--season-primary,#cfa777);font-variant-numeric:tabular-nums}
.hb-polish .hb-ms-group-heading h3,.hb-polish .hb-ms-support-heading h3{font-size:clamp(19px,2.2vw,23px);letter-spacing:-.035em;line-height:1.2;margin:4px 0 3px}
.hb-polish .hb-ms-group-heading p{font-size:11px;line-height:1.6;color:var(--season-muted,#afa7b0);margin:0}
.hb-polish .hb-ms-legend{display:flex;gap:7px;flex-wrap:wrap}
.hb-polish .hb-ms-legend span{display:flex;gap:7px;align-items:center;white-space:nowrap;padding:7px 10px;border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:100px;background:var(--season-surface,#211d23);font-size:10px;color:var(--season-muted,#aaa)}
.hb-polish .hb-ms-legend-dot{width:7px;height:7px;display:block;border-radius:100px;background:var(--season-primary,#cfa777);box-shadow:0 0 0 3px color-mix(in srgb,var(--season-primary,#cfa777) 11%,transparent)}
.hb-polish .hb-ms-legend-dot.enemies{background:var(--hb-ms-red);box-shadow:0 0 0 3px rgba(207,104,107,.10)}
.hb-polish .hb-ms-party-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:13px;align-items:stretch;margin:0 0 16px;min-width:0}
.hb-polish .hb-ms-party-layout>.hb-ms-party-main,.hb-polish .hb-ms-party-layout>.hb-ms-enemy-section{width:100%;min-width:0;margin:0;box-sizing:border-box;padding:clamp(19px,2.5vw,27px);border-radius:20px}
.hb-polish .hb-ms-party-layout>.hb-ms-party-main{border-color:color-mix(in srgb,var(--season-primary,#cfa777) 18%,var(--season-line,rgba(255,255,255,.12)))}
.hb-polish .hb-ms-party-layout>.hb-ms-enemy-section{border-color:color-mix(in srgb,var(--hb-ms-red) 18%,var(--season-line,rgba(255,255,255,.12)));background:linear-gradient(145deg,color-mix(in srgb,var(--hb-ms-red) 3%,var(--season-surface,#211d25)),var(--season-surface-alt,#2a252b))}
.hb-polish .hb-ms-party-main .hb-ms-pane-heading,.hb-polish .hb-ms-enemy-section .hb-enemy-party-header{margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--season-line,rgba(255,255,255,.10))}
.hb-polish .hb-ms-pane-heading h3,.hb-polish .hb-ms-enemy-section h3{font-size:clamp(20px,2.2vw,24px);letter-spacing:-.04em}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-header p{font-size:11px;line-height:1.6}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-kicker{color:var(--hb-ms-red)}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-counter{background:rgba(207,104,107,.10);border-color:rgba(207,104,107,.19);color:var(--hb-ms-red)}
.hb-polish .hb-ms-party-main .master-shield-character-list,.hb-polish .hb-ms-enemy-section .hb-enemy-party-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,285px),1fr));align-items:stretch;gap:13px}
.hb-polish .hb-ms-party-main .hb-ms-player-card,.hb-polish .hb-ms-enemy-section .hb-enemy-party-card{min-height:270px;max-width:none;padding:17px;border:1px solid var(--season-line,rgba(255,255,255,.13));border-radius:16px;background:linear-gradient(160deg,color-mix(in srgb,var(--season-surface-alt,#2b262e) 65%,var(--season-bg,#141218)),var(--season-surface,#211d24));box-shadow:0 4px 12px rgba(0,0,0,.035),inset 0 1px rgba(255,255,255,.025);transition:border-color .17s,box-shadow .17s,transform .17s}
.hb-polish .hb-ms-party-main .hb-ms-player-card{display:flex;flex-direction:column;gap:14px;text-align:left;color:var(--season-text,#f4f1ef);cursor:pointer}
.hb-polish .hb-ms-party-main .hb-ms-player-card:hover,.hb-polish .hb-ms-party-main .hb-ms-player-card:focus-visible{border-color:color-mix(in srgb,var(--season-primary,#cfa777) 50%,var(--season-line,rgba(255,255,255,.12)));transform:translateY(-2px);box-shadow:0 12px 26px rgba(0,0,0,.1)}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-card:hover{border-color:color-mix(in srgb,var(--hb-ms-red) 45%,var(--season-line,rgba(255,255,255,.12)));box-shadow:0 12px 26px rgba(0,0,0,.09)}
.hb-polish .hb-ms-player-identity{display:flex;align-items:center;gap:11px;width:100%;min-height:51px;margin:0;text-align:left}
.hb-polish .hb-ms-player-avatar,.hb-polish .hb-ms-enemy-section .hb-enemy-party-avatar{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border:1px solid color-mix(in srgb,var(--season-primary,#cfa777) 20%,transparent);border-radius:14px;background:color-mix(in srgb,var(--season-primary,#cfa777) 13%,transparent);font-size:25px;line-height:1}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-avatar{background:rgba(207,104,107,.13);border-color:rgba(207,104,107,.2)}
.hb-polish .hb-ms-player-copy,.hb-polish .hb-ms-enemy-section .hb-enemy-party-card-head>div{display:block;min-width:0;flex:1}
.hb-polish .hb-ms-player-copy strong,.hb-polish .hb-ms-enemy-section .hb-enemy-party-card-head strong{display:block;font-size:15px;font-weight:850;line-height:1.3;overflow-wrap:anywhere;color:var(--season-text,#f4f1ef)}
.hb-polish .hb-ms-player-copy small,.hb-polish .hb-ms-enemy-section .hb-enemy-party-card-head small{display:block;margin-top:5px;font-size:10px;line-height:1.35;color:var(--season-muted,#afa7b0);font-weight:600}
.hb-polish .hb-ms-card-arrow{font-size:19px;color:var(--season-primary,#cfa777);opacity:.7;margin-left:auto}
.hb-polish .hb-ms-resource-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:9px;font-weight:850;letter-spacing:.095em;color:var(--season-muted,#afa7b0)}
.hb-polish .hb-ms-party-main .master-shield-bars,.hb-polish .hb-ms-enemy-section .hb-enemy-party-resources{display:grid;gap:10px;min-width:0;margin:0}
.hb-polish .hb-ms-party-main .master-shield-bar-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:5px 8px;align-items:center;text-align:left;font-size:11px}
.hb-polish .hb-ms-party-main .master-shield-bar-row>span:first-child{grid-column:1;grid-row:1;font-weight:850;line-height:1.3}
.hb-polish .hb-ms-party-main .master-shield-bar-row>strong:first-of-type{grid-column:3;grid-row:1;font-size:11px;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap}
.hb-polish .hb-ms-party-main .master-shield-bar-row>.master-shield-bar{grid-column:1/-1;grid-row:2;width:100%;height:7px;margin:0;border-radius:20px;overflow:hidden;background:color-mix(in srgb,var(--season-muted,#aaa) 17%,transparent)}
.hb-polish .hb-ms-party-main .master-shield-bar-row>.master-shield-bar>i{display:block;height:100%;border-radius:20px;background:var(--season-primary,#cfa777)}
.hb-polish .hb-ms-party-main .master-shield-bar-row>.master-shield-extra-name{grid-column:1/3;grid-row:3}
.hb-polish .hb-ms-party-main .master-shield-bar-row>.master-shield-extra-value{grid-column:3;grid-row:3;font-size:10px}
.hb-polish .hb-ms-party-main .master-shield-bar-row>.master-shield-bar-extra{grid-column:1/-1;grid-row:4}
.hb-polish .hb-ms-party-main .master-shield-open-hint{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:11px;border-top:1px solid var(--season-line,rgba(255,255,255,.1));width:100%;text-align:left;font-size:10px;font-weight:800;color:var(--season-primary,#cfa777)}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-resource{grid-template-columns:30px minmax(0,1fr) auto;gap:5px 8px;font-size:11px}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-track{height:7px}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-initiative{margin-top:auto;padding-top:12px;border-top:1px solid var(--season-line,rgba(255,255,255,.1));gap:7px}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-initiative label{font-size:10px;font-weight:750}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-initiative input{min-height:38px}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-initiative button,.hb-polish .hb-ms-enemy-section .hb-enemy-party-actions button{min-height:38px;border-radius:10px}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-pickers{padding:12px 14px;margin-bottom:15px;border:1px solid var(--season-line,rgba(255,255,255,.1));border-radius:13px;background:color-mix(in srgb,var(--season-bg,#141218) 55%,transparent)}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-pickers label{font-weight:750}
.hb-polish .hb-ms-enemy-section .hb-enemy-party-pickers button{min-height:41px;border-radius:10px}
.hb-polish .hb-ms-initiative-section{margin:20px 0 0;padding:clamp(19px,2.5vw,27px);background:radial-gradient(ellipse at 95% 0%,color-mix(in srgb,var(--season-primary,#cfa777) 8%,transparent),transparent 50%),var(--season-surface,#201b22)}
.hb-polish .hb-ms-initiative-section .hb-ms-pane-heading{padding-bottom:17px;border-bottom:1px solid var(--season-line,rgba(255,255,255,.10));margin-bottom:19px}
.hb-polish .hb-ms-initiative-section .hb-ms-initiative-toolbar{padding:12px 15px;border:1px solid var(--season-line,rgba(255,255,255,.1));border-radius:12px;background:color-mix(in srgb,var(--season-bg,#141218) 60%,transparent);margin-bottom:15px}
.hb-polish .hb-ms-combined-initiative-list{gap:8px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-row{min-height:78px;gap:12px;padding:12px 15px;border-radius:14px;transition:border-color .15s,background .15s;position:relative;overflow:hidden}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-row:hover{border-color:color-mix(in srgb,var(--season-primary,#cfa777) 35%,var(--season-line,rgba(255,255,255,.12)));background:color-mix(in srgb,var(--season-primary,#cfa777) 5%,var(--season-bg,#141218))}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-enemy{border-left:3px solid var(--hb-ms-red)}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-character{border-left:3px solid var(--season-primary,#cfa777)}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-leader{border-color:color-mix(in srgb,var(--season-primary,#cfa777) 40%,var(--season-line,rgba(255,255,255,.12)));background:linear-gradient(100deg,color-mix(in srgb,var(--season-primary,#cfa777) 10%,var(--season-bg,#141218)),var(--season-bg,#141218))}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-leader:after{content:'PRIMEIRO TURNO';position:absolute;top:0;right:0;padding:3px 8px;border-bottom-left-radius:8px;font-size:8px;font-weight:850;letter-spacing:.1em;color:var(--season-primary,#cfa777);background:color-mix(in srgb,var(--season-primary,#cfa777) 10%,transparent)}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-rank{display:flex;align-items:baseline;gap:1px;justify-content:center;flex:0 0 40px;font-size:24px;line-height:1;color:var(--season-primary,#cfa777)}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-rank small{font-size:10px;line-height:1}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-avatar{width:43px;height:43px;flex-basis:43px;border-radius:12px;font-size:22px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-person strong{font-size:13px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-person small{font-size:10px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-score>strong{display:inline-flex;min-width:58px;min-height:38px;align-items:center;justify-content:center;padding:4px 10px;border-radius:10px;background:color-mix(in srgb,var(--season-primary,#cfa777) 12%,transparent);color:var(--season-primary,#cfa777);font-size:22px}
.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-score>strong.pending{font-size:10px;line-height:1.3;color:var(--season-muted,#afa7b0);background:var(--season-surface-alt,#29252d)}
.hb-polish .hb-ms-support-heading{margin:24px 0 13px;justify-content:flex-start}
.hb-polish .hb-ms-support-heading>div{min-width:0}
.hb-polish .hb-ms-support-grid{display:grid;grid-template-columns:minmax(245px,0.75fr) minmax(0,1.25fr);gap:13px;align-items:start;margin-bottom:5px}
.hb-polish .hb-ms-support-grid>.hb-ms-party-members,.hb-polish .hb-ms-support-grid>.hb-ms-activity-section{height:100%;min-width:0;margin:0;padding:clamp(18px,2.2vw,24px);border:1px solid var(--season-line,rgba(255,255,255,.12));border-radius:19px;background:linear-gradient(155deg,var(--season-surface,#211c24),var(--season-surface-alt,#28232c))}
.hb-polish .hb-ms-support-grid .hb-ms-pane-heading{margin-bottom:16px}
.hb-polish .hb-ms-party-members .hb-ms-member-list{grid-template-columns:1fr}
.hb-polish .hb-ms-party-members .hb-ms-member-list li{padding:11px 13px}
.hb-polish .hb-ms-support-grid .campaign-activity-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:11px;flex-wrap:wrap;padding-bottom:15px;border-bottom:1px solid var(--season-line,rgba(255,255,255,.1))}
.hb-polish .hb-ms-support-grid .campaign-activity-heading h3{font-size:20px;letter-spacing:-.035em}
.hb-polish .hb-ms-support-grid .campaign-activity-list{margin-top:14px}
.hb-polish .hb-ms-dashboard :is(.master-shield-empty,.hb-enemy-party-empty){min-height:80px;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;border:1px dashed var(--season-line,rgba(255,255,255,.15));border-radius:13px;background:color-mix(in srgb,var(--season-bg,#141218) 45%,transparent);font-size:12px;line-height:1.6}
@media(max-width:1020px){.hb-polish .hb-ms-support-grid{grid-template-columns:1fr 1fr}.hb-polish .hb-ms-party-main .master-shield-character-list,.hb-polish .hb-ms-enemy-section .hb-enemy-party-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}}
@media(max-width:780px){.hb-polish .hb-ms-support-grid{grid-template-columns:1fr}.hb-polish .hb-ms-group-heading{align-items:flex-start}.hb-polish .hb-ms-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hb-polish .hb-ms-party-main .master-shield-character-list,.hb-polish .hb-ms-enemy-section .hb-enemy-party-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}}
@media(max-width:560px){.hb-polish .hb-ms-hero-stamp{display:none}.hb-polish .hb-ms-dashboard .master-shield-heading{min-height:0}.hb-polish .hb-ms-stats .master-shield-stat{min-height:103px;padding:14px}.hb-polish .hb-ms-stats .master-shield-stat strong{font-size:24px}.hb-polish .hb-ms-stats .hb-ms-stat-season strong{font-size:13px}.hb-polish .hb-ms-group-heading-left{align-items:flex-start}.hb-polish .hb-ms-group-index{flex-basis:34px;width:34px;height:34px}.hb-polish .hb-ms-party-layout>.hb-ms-party-main,.hb-polish .hb-ms-party-layout>.hb-ms-enemy-section{padding:15px}.hb-polish .hb-ms-party-main .master-shield-character-list,.hb-polish .hb-ms-enemy-section .hb-enemy-party-grid{grid-template-columns:1fr}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-row{align-items:center;padding:12px;gap:8px}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-rank{flex-basis:25px;font-size:19px}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-avatar{width:36px;height:36px;flex-basis:36px;font-size:18px}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-score{gap:6px}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-score>strong{min-width:40px;font-size:17px}.hb-polish .hb-ms-combined-initiative-list .hb-ms-initiative-score button{padding:5px 7px;font-size:10px}}
@media(prefers-reduced-motion:reduce){.hb-polish .hb-ms-dashboard :is(.hb-ms-player-card,.hb-enemy-party-card,.hb-ms-initiative-row,.hb-ms-quicknav a){transition:none;transform:none}}

`}</style>

          {activePage === 'customization' && (
            <section className="hb-customization-page" aria-labelledby="hb-customization-title">
              <header className="hb-customization-hero">
                <div className="hb-customization-hero-copy">
                  <span className="hb-customization-eyebrow">✦ APARÊNCIA DA CAMPANHA</span>
                  <h1 id="hb-customization-title">Customização<span aria-hidden="true">.</span></h1>
                  <p>Defina a identidade visual da temporada. Combine cores e estilos para personalizar toda a experiência no HäxBag.</p>
                  <div className="hb-customization-hero-badges">
                    <span>◈ {activeTheme.label}</span>
                    <span>{activeVisualStyle.symbol} {activeVisualStyle.label}</span>
                    <span>{isMaster ? '✎ Edição do mestre' : '◉ Visualização'}</span>
                  </div>
                </div>
                <div className="hb-customization-hero-preview" aria-label={`Prévia: ${activeTheme.label} com estilo ${activeVisualStyle.label}`}>
                  <span className="hb-customization-preview-orbit" aria-hidden="true" />
                  <span className="hb-customization-preview-symbol" aria-hidden="true">{activeVisualStyle.symbol}</span>
                  <strong>{activeVisualStyle.label}</strong>
                  <small>{selectedCampaign?.name || 'HäxBag'}</small>
                </div>
              </header>

              {!selectedCampaignId ? (
                <div className="hb-customization-empty">
                  <span aria-hidden="true">⚑</span>
                  <h2>Selecione uma campanha</h2>
                  <p>Escolha uma campanha para consultar a identidade visual de suas temporadas.</p>
                  <button type="button" className="primary-button" onClick={() => setActivePage('campaigns')}>Ir para Campanhas</button>
                </div>
              ) : seasons.length === 0 ? (
                <div className="hb-customization-empty">
                  <span aria-hidden="true">✧</span>
                  <h2>Nenhuma temporada criada</h2>
                  <p>Crie uma temporada na área de Fichas para poder configurar o tema e o estilo visual.</p>
                  <button type="button" className="primary-button" onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }}>Abrir Fichas</button>
                </div>
              ) : (
                <>
                  <div className="hb-customization-season-bar">
                    <div className="hb-customization-season-copy">
                      <span className="hb-customization-eyebrow">TEMPORADA EM EDIÇÃO</span>
                      <strong>{activeSeason?.name || 'Escolha uma temporada'}</strong>
                      <small>As alterações afetam a aparência da temporada selecionada.</small>
                    </div>
                    <label htmlFor="hb-customization-season-select">
                      <span>Selecionar temporada</span>
                      <select id="hb-customization-season-select" value={selectedSeasonId} onChange={event => setSelectedSeasonId(event.target.value)}>
                        <option value="">Selecione uma temporada</option>
                        {seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name} ({season.status})</option>)}
                      </select>
                    </label>
                  </div>
                  {selectedSeasonId ? (
                <section className="season-theme-panel" aria-label="Identidade visual da temporada">
                  <div className="season-theme-heading">
                    <div><strong>Identidade visual</strong><small>Combine uma paleta de cores com um estilo de interface.</small></div>
                    <span className="season-theme-current-swatch" style={{background:`linear-gradient(135deg,${activeTheme.primary},${activeTheme.secondary})`}} />
                  </div>
                  <div className="season-visual-group">
                    <div className="season-visual-group-heading"><span>01 · Tema</span><strong>{activeTheme.label}</strong><small>Define as cores da temporada.</small></div>
                    {isMaster ? <div className="season-theme-options">{(Object.entries(seasonThemes) as [keyof typeof seasonThemes, typeof seasonThemes[keyof typeof seasonThemes]][]).map(([key,theme])=><button key={key} type="button" aria-pressed={activeThemeKey === key} disabled={seasonThemeSaving} onClick={()=>void saveSeasonTheme(key)} className={`season-theme-option ${activeThemeKey===key?'active':''}`} style={{ '--hb-palette-first': theme.primary, '--hb-palette-second': theme.secondary } as React.CSSProperties}><span className="season-theme-swatches"><i style={{background:theme.primary}}/><i style={{background:theme.secondary}}/></span><span>{theme.label}</span>{activeThemeKey===key&&<b>✓</b>}</button>)}</div> : <small>O mestre escolhe o tema desta temporada.</small>}
                  </div>
                  <div className="season-visual-group season-visual-style-group">
                    <div className="season-visual-group-heading"><span>02 · Estilo</span><strong>{activeVisualStyle.label}</strong><small>Transforma todas as páginas, incluindo menus e janelas, preservando as cores do tema.</small></div>
                    <div className="season-style-grid">
                      {(Object.entries(visualStyles) as [VisualStyleKey, typeof visualStyles[VisualStyleKey]][]).map(([key, style]) => (
                        <button key={key} type="button" aria-pressed={activeVisualStyleKey === key}
                          disabled={!isMaster || seasonVisualStyleSaving} onClick={() => void saveSeasonVisualStyle(key)}
                          className={`season-style-card season-style-${key} ${activeVisualStyleKey === key ? 'active' : ''}`}>
                          <span className="season-style-signature" aria-hidden="true"><span>✦</span>{style.signature}<span>✦</span></span>
                          <span className="season-style-preview" aria-hidden="true">
                            <span className="season-style-preview-orb" />
                            <span className="season-style-preview-glyph">{style.symbol}</span>
                            <span className="season-style-preview-lines"><i /><i /><i /></span>
                          </span>
                          <span className="season-style-card-info"><strong>{style.label}</strong><small>{style.description}</small></span>
                          <span className="season-style-card-check" aria-hidden="true">{activeVisualStyleKey === key ? '✓' : '＋'}</span>
                        </button>
                      ))}
                    </div>
                    {!isMaster && <small className="season-style-readonly">O mestre escolhe o estilo desta temporada.</small>}
                    <p className="season-style-hint">Combinação atual: <b>{activeTheme.label}</b> + <b>{activeVisualStyle.label}</b>. O estilo modifica apenas a aparência: regras e dados da temporada continuam iguais.</p>
                  </div>
                </section>
                  ) : (
                    <div className="hb-customization-empty"><h2>Escolha uma temporada</h2><p>Selecione uma temporada acima para visualizar as opções de identidade visual.</p></div>
                  )}
                  {!isMaster && <p className="hb-customization-readonly">Você pode visualizar a identidade visual da campanha. Apenas o mestre pode alterá-la.</p>}
                </>
              )}
            </section>
          )}

          {activePage === 'conditions' && isMaster && selectedCampaignId && (
            <ConditionsPanel campaignId={selectedCampaignId} characters={characters.filter(c => c.campaign_id === selectedCampaignId)} enemies={enemies.filter(e => e.campaign_id === selectedCampaignId)} master={isMaster} />
          )}
          {activePage === 'profile' && (
            <section className="hb-profile-page hb-profile-page-v12 hb-profile-page-v13 hb-profile-page-v15" aria-labelledby="hb-profile-title">
              <header className="hb-profile-identity" aria-label="Sua identidade no HäxBag">
                <div className="hb-profile-identity-cover">
                  <span className="hb-profile-identity-cover-art" aria-hidden="true" />
                  <span className="hb-profile-identity-cover-vignette" aria-hidden="true" />
                  <div className="hb-profile-identity-cover-topline">
                    <span><span aria-hidden="true">✦</span> HÄXBAG <span className="hb-profile-identity-overline">/ ARQUIVO DO AVENTUREIRO</span></span>
                    <span className="hb-profile-identity-style">{activeVisualStyle.symbol} {activeVisualStyle.label}</span>
                  </div>
                  <div className="hb-profile-cover-story">
                    <span className="hb-profile-cover-chapter"><span aria-hidden="true">✧</span> CRÔNICAS PESSOAIS <span className="hb-profile-cover-chapter-index">· VOL. I</span></span>
                    <p className="hb-profile-cover-title">Toda jornada tem<br /><em>uma história.</em></p>
                    <p className="hb-profile-cover-subtitle">O seu espaço entre mundos, personagens e aventuras.</p>
                  </div>
                  <div className="hb-profile-identity-cover-bottomline" aria-hidden="true"><span>✧</span><i /><span>✧</span></div>
                </div>
                <div className="hb-profile-identity-main">
                  <div className="hb-profile-identity-avatar-wrap">
                    <span className="hb-profile-identity-avatar" aria-label="Avatar do perfil">
                      {accountAvatar || String(displayName).charAt(0).toUpperCase()}
                    </span>
                    <span className="hb-profile-identity-avatar-spark" aria-hidden="true">{activeVisualStyle.symbol}</span>
                  </div>
                  <div className="hb-profile-identity-copy">
                    <span className="hb-profile-identity-kicker"><span aria-hidden="true">✦</span> IDENTIDADE DO AVENTUREIRO</span>
                    <h1 id="hb-profile-title">{displayName}</h1>
                    <p className="hb-profile-username">{accountUsername ? `@${accountUsername}` : 'Escolha seu @usuário em Editar perfil'}</p>
                    <p>{accountBio.trim() || 'Toda aventura merece uma história. Personalize a sua apresentação e deixe sua marca no HäxBag.'}</p>
                    <div className="hb-profile-identity-badges">
                      <span><i aria-hidden="true" className="hb-profile-status-light" /> Conta ativa</span>
                      <span aria-label={`Estilo ${activeVisualStyle.label}`}>{activeVisualStyle.symbol} {activeVisualStyle.label}</span>
                      <span>✧ Membro desde {accountCreatedAt}</span>
                    </div>
                  </div>
                  <button type="button" className="hb-profile-identity-edit" onClick={() => setProfileEditing(value => !value)}
                    aria-expanded={profileEditing} aria-controls="hb-profile-editor-region">
                    <span aria-hidden="true">{profileEditing ? '←' : '✎'}</span> {profileEditing ? 'Voltar ao perfil' : 'Editar perfil'}
                  </button>
                </div>
              </header>

              <div className="hb-profile-section-heading" aria-hidden="true">
                <span className="hb-profile-section-emblem">✧</span>
                <span>MINHA JORNADA</span>
                <i />
                <span className="hb-profile-section-end">EM NÚMEROS</span>
              </div>
              <div className="hb-profile-action-strip" aria-label="Ações do perfil">
                <button type="button" onClick={() => setProfileEditing(true)}><span aria-hidden="true">✎</span><span><strong>Personalizar perfil</strong><small>Nome, avatar e apresentação</small></span></button>
                <button type="button" onClick={() => document.getElementById('hb-social-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span aria-hidden="true">♧</span><span><strong>Minha companhia</strong><small>Amigos e solicitações</small></span></button>
                <button type="button" onClick={() => document.getElementById('hb-social-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span aria-hidden="true">✉</span><span><strong>Convites</strong><small>Campanhas compartilhadas</small></span></button>
              </div>
              <div className="hb-profile-overview-grid">
                <article className="hb-profile-info-tile">
                  <span className="hb-profile-tile-icon" aria-hidden="true">⚑</span>
                  <span>Campanhas vinculadas</span>
                  <strong>{campaigns.length}</strong>
                  <small>Seus mundos e aventuras</small>
                </article>
                <article className="hb-profile-info-tile">
                  <span className="hb-profile-tile-icon" aria-hidden="true">♜</span>
                  <span>Atuação na campanha</span>
                  <strong>{selectedCampaign ? isMaster ? 'Mestre' : 'Jogador' : '—'}</strong>
                  <small>{selectedCampaign?.name || 'Nenhuma campanha selecionada'}</small>
                </article>
                <article className="hb-profile-info-tile">
                  <span className="hb-profile-tile-icon" aria-hidden="true">✧</span>
                  <span>Conta criada em</span>
                  <strong>{accountCreatedAt}</strong>
                  <small>Seu registro no HäxBag</small>
                </article>
              </div>

              <section className="hb-profile-collections" aria-label="Minha jornada nas campanhas">
                <div className="hb-profile-collection-heading"><div><span className="hb-kicker">REGISTROS DA JORNADA</span><h2>Meus personagens</h2><p>Personagens que você criou ou que foram atribuídos a você.</p></div><span className="hb-profile-collection-count">{characters.filter(character => character.user_id === session.user.id || character.current_player_id === session.user.id).length} personagens</span></div>
                <div className="hb-profile-character-grid">
                  {characters.filter(character => character.user_id === session.user.id || character.current_player_id === session.user.id).length ?
                    characters.filter(character => character.user_id === session.user.id || character.current_player_id === session.user.id).map(character => (
                      <article className="hb-profile-character-card" key={character.id}>
                        <span className="hb-profile-character-avatar" aria-hidden="true">{character.emoji || '⚔️'}</span>
                        <div className="hb-profile-character-info"><strong>{character.name}</strong><span>{campaigns.find(campaign => campaign.id === character.campaign_id)?.name || 'Campanha não disponível'}</span><small>{character.archetype || 'Arquétipo não definido'}</small></div>
                        <span className="hb-profile-character-role">{character.current_player_id === session.user.id ? 'Jogador' : 'Criador'}</span>
                      </article>
                    )) : <p className="hb-profile-empty-collection">Seus personagens aparecerão aqui quando forem criados ou atribuídos à sua conta.</p>}
                </div>
                <div className="hb-profile-collection-heading hb-profile-campaign-heading"><div><span className="hb-kicker">MUNDOS COMPARTILHADOS</span><h2>Minhas campanhas</h2><p>Uma visão das campanhas das quais você participa.</p></div><span className="hb-profile-collection-count">{campaigns.length} campanhas</span></div>
                <div className="hb-profile-campaign-grid">
                  {campaigns.length ? campaigns.map(campaign => (
                    <article key={campaign.id} className="hb-profile-campaign-card">
                      <span className="hb-profile-campaign-emblem" aria-hidden="true">✧</span>
                      <div><strong>{campaign.name}</strong><small>{campaign.system_name || 'Campanha de RPG'}</small></div>
                      <span className="hb-profile-campaign-role">{campaign.role === 'master' || campaign.created_by === session.user.id ? 'Mestre' : 'Jogador'}</span>
                    </article>
                  )) : <p className="hb-profile-empty-collection">Você ainda não participa de nenhuma campanha.</p>}
                </div>
              </section>

              <div className="hb-profile-layout" id="hb-profile-editor-region">
                {profileEditing ? (
                <form className="hb-profile-card hb-profile-edit-card" onSubmit={async event => {
                  event.preventDefault()
                  if (profileSaving || !profileHasChanges) return
                  const nextName = profileNameDraft.trim().replace(/\s+/g, ' ')
                  const nextUsername = profileUsernameDraft.trim().toLowerCase().replace(/^@/, '')
                  const nextBio = profileBioDraft.trim()
                  if (!nextName || nextName.length > 60) {
                    setError('O nome de exibição deve ter entre 1 e 60 caracteres.')
                    return
                  }
                  if (!/^[a-z0-9_]{3,24}$/.test(nextUsername)) {
                    setError('Nome de usuário: 3 a 24 caracteres, somente letras, números e _.')
                    return
                  }
                  if (nextBio.length > 180) {
                    setError('A apresentação pode ter até 180 caracteres.')
                    return
                  }
                  setProfileSaving(true)
                  setError('')
                  try {
                    if (nextUsername !== accountUsername.toLowerCase()) {
                      const { data: available, error: checkError } = await supabase.rpc('is_username_available', { candidate: nextUsername, exclude_user: session.user.id })
                      if (checkError) throw checkError
                      if (!available) { setError('Esse nome de usuário já está em uso.'); return }
                    }
                    const { error: authError } = await supabase.auth.updateUser({
                      data: { display_name: nextName, username: nextUsername, profile_avatar: profileAvatarDraft, profile_bio: nextBio },
                    })
                    if (authError) throw authError
                    if (nextName !== String(displayName).trim()) {
                      const { error: profileError } = await supabase.from('profiles')
                        .update({ display_name: nextName, username: nextUsername }).eq('id', session.user.id)
                      if (profileError) {
                        setNotice('Perfil salvo na conta. Não foi possível sincronizar o nome com os membros: ' + profileError.message)
                      } else {
                        setNotice('Perfil atualizado com sucesso.')
                      }
                    } else {
                      const { error: profileError } = await supabase.from('profiles').update({ username: nextUsername }).eq('id', session.user.id)
                      if (profileError) throw profileError
                      setNotice('Perfil atualizado com sucesso.')
                    }
                    setProfileEditing(false)
                  } catch (err) {
                    setError(/nome.*uso|display.name|duplicate|unique/i.test(err instanceof Error ? err.message : String(err)) ? 'Esse nome já está em uso. Escolha outro.' : 'Erro ao salvar seu perfil: ' + (err instanceof Error ? err.message : String(err)))
                  } finally {
                    setProfileSaving(false)
                  }
                }}>
                  <div className="hb-profile-card-heading">
                    <span className="hb-profile-card-glyph" aria-hidden="true">✦</span>
                    <div><span className="hb-kicker">PERSONALIZAÇÃO</span><h2>Editar perfil</h2><p>Deixe sua marca no HäxBag. As mudanças aparecem na prévia ao lado.</p></div>
                  </div>
                  <fieldset className="hb-profile-avatar-fieldset">
                    <legend>Avatar do perfil</legend>
                    <p>Escolha um símbolo para representar sua conta no menu principal e no seu cartão de perfil.</p>
                    <div className="hb-profile-avatar-options" role="group" aria-label="Escolha seu avatar">
                      <button type="button" className={`hb-profile-avatar-option ${profileAvatarDraft === '' ? 'active' : ''}`}
                        aria-label="Usar iniciais do nome" aria-pressed={profileAvatarDraft === ''} onClick={() => setProfileAvatarDraft('')}>
                        {(profileNameDraft.trim() || String(displayName)).charAt(0).toUpperCase()}
                      </button>
                      {profileAvatarOptions.map(emoji => (
                        <button key={emoji} type="button" className={`hb-profile-avatar-option ${profileAvatarDraft === emoji ? 'active' : ''}`}
                          aria-label={`Usar avatar ${emoji}`} aria-pressed={profileAvatarDraft === emoji} onClick={() => setProfileAvatarDraft(emoji)}>{emoji}</button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="hb-profile-field">Nome de exibição
                    <input maxLength={60} required value={profileNameDraft} onChange={event => setProfileNameDraft(event.target.value)}
                      autoComplete="nickname" placeholder="Como os outros jogadores verão seu nome" />
                    <small>Pode se repetir. É como os outros jogadores verão você nas campanhas. {profileNameDraft.length}/60</small>
                  </label>
                  <label className="hb-profile-field">Nome de usuário
                    <input maxLength={24} required value={profileUsernameDraft} onChange={event => setProfileUsernameDraft(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" placeholder="seu_usuario" />
                    <small>Seu identificador exclusivo: @seu_usuario. Usado para encontrar amigos.</small>
                  </label>
                  <label className="hb-profile-field">Sobre você <span className="hb-profile-optional">Opcional</span>
                    <textarea rows={4} maxLength={180} value={profileBioDraft} onChange={event => setProfileBioDraft(event.target.value)}
                      placeholder="Uma frase sobre suas aventuras, personagens ou histórias favoritas…" />
                    <span className="hb-profile-bio-meta"><small>Visível apenas para você nesta versão</small><small>{profileBioDraft.length}/180</small></span>
                    <span className="hb-profile-bio-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (profileBioDraft.length / 180) * 100)}%` }} /></span>
                  </label>
                  <div className="hb-profile-form-footer">
                    <span className={`hb-profile-save-status ${profileHasChanges ? 'has-changes' : 'is-saved'}`} aria-live="polite">{profileHasChanges ? '● Alterações não salvas' : '✓ Perfil atualizado'}</span>
                    <div className="hb-profile-form-actions">
                      <button type="button" className="secondary-button" disabled={profileSaving || !profileHasChanges}
                        onClick={() => { setProfileNameDraft(String(displayName)); setProfileUsernameDraft(accountUsername); setProfileAvatarDraft(accountAvatar); setProfileBioDraft(accountBio) }}>Descartar</button>
                      <button type="submit" className="primary-button" disabled={profileSaving || !profileHasChanges}>
                        {profileSaving ? 'Salvando…' : 'Salvar alterações'}
                      </button>
                    </div>
                  </div>
                </form>
                ) : (
                  <article className="hb-profile-story" aria-labelledby="hb-profile-story-title">
                    <div className="hb-profile-story-heading">
                      <span className="hb-profile-story-emblem" aria-hidden="true">✦</span>
                      <div><span className="hb-kicker">O AVENTUREIRO</span><h2 id="hb-profile-story-title">Sobre mim</h2></div>
                      <span className="hb-profile-story-chapter">CAPÍTULO I</span>
                    </div>
                    <div className={`hb-profile-story-content ${accountBio.trim() ? 'has-bio' : 'is-empty'}`}>
                      <span className="hb-profile-story-quote" aria-hidden="true">“</span>
                      <div className="hb-profile-story-text">
                        {!accountBio.trim() && <span className="hb-profile-story-empty-label">O PRÓXIMO CAPÍTULO É SEU</span>}
                        <p>{accountBio.trim() || 'Toda grande aventura começa com uma página em branco. Escreva a sua história e dê vida ao seu perfil.'}</p>
                      </div>
                    </div>
                    <div className="hb-profile-story-rule" aria-hidden="true"><span>✦</span></div>
                    <div className="hb-profile-story-inscription">
                      <div><span>ASSINADO POR</span><strong>{displayName}</strong></div>
                      <span className="hb-profile-story-seal" aria-label={`Estilo ${activeVisualStyle.label}`}>{activeVisualStyle.symbol}</span>
                    </div>
                    <button type="button" className="hb-profile-story-action" onClick={() => setProfileEditing(true)}>
                      <span aria-hidden="true">✎</span> {accountBio.trim() ? 'Editar minha história' : 'Escrever minha história'} <span aria-hidden="true">↗</span>
                    </button>
                  </article>
                )}

                <aside className="hb-profile-side-panel">
                  <section className="hb-profile-side-card hb-profile-preview-panel" aria-label="Prévia do perfil">
                    <div className="hb-profile-side-heading"><span aria-hidden="true">✧</span><div><span className="hb-kicker">{profileEditing ? 'EM TEMPO REAL' : 'SUA INSÍGNIA'}</span><h2>{profileEditing ? 'Prévia do perfil' : 'Cartão do aventureiro'}</h2></div></div>
                    <div className="hb-profile-preview-card">
                      <span className="hb-profile-preview-art" aria-hidden="true" />
                      <div className="hb-profile-preview-topline"><span>HÄXBAG <span className="hb-profile-preview-edition">· CARTA DE IDENTIDADE</span></span><span>{activeVisualStyle.symbol} {activeVisualStyle.label}</span></div>
                      <span className="hb-profile-preview-decor" aria-hidden="true">✧</span>
                      <span className="hb-profile-preview-avatar" aria-hidden="true">{profileEditing ? (profileAvatarDraft || (profileNameDraft.trim() || String(displayName)).charAt(0).toUpperCase()) : (accountAvatar || String(displayName).charAt(0).toUpperCase())}</span>
                      <strong className="hb-profile-preview-name">{profileEditing ? (profileNameDraft.trim() || 'Seu nome de exibição') : displayName}</strong>
                      <p className="hb-profile-preview-bio">{(profileEditing ? profileBioDraft : accountBio).trim() || 'Uma aventura começa com uma história. Adicione sua apresentação.'}</p>
                      <span className="hb-profile-preview-signature"><span>✦ CARTÃO DO AVENTUREIRO</span><span>HÄXBAG · I</span></span>
                    </div>
                    <p className="hb-profile-preview-help">{profileEditing ? 'Prévia das suas alterações. Somente as informações salvas ficarão na sua conta.' : 'Seu cartão pessoal, com a identidade visual da temporada em uso.'}</p>
                  </section>
                  <section className="hb-profile-side-card">
                    <div className="hb-profile-side-heading"><span aria-hidden="true">⌘</span><div><span className="hb-kicker">DADOS DA CONTA</span><h2>Informações</h2></div></div>
                    <div className="hb-profile-account-line"><span>E-mail</span><strong title={session.user.email || ''}>{session.user.email || 'Indisponível'}</strong><small>Privado · não exibido para outros jogadores</small></div>
                    <div className="hb-profile-account-line"><span>Tipo de acesso</span><strong>{selectedCampaign ? isMaster ? 'Mestre e jogador' : 'Jogador' : 'Conta pessoal'}</strong></div>
                    <div className="hb-profile-account-line"><span>Estilo em uso</span><strong>{activeVisualStyle.symbol} {activeVisualStyle.label}</strong><small>O visual acompanha a temporada ativa</small></div>
                  </section>
                  <section className="hb-profile-side-card">
                    <div className="hb-profile-side-heading"><span aria-hidden="true">↗</span><div><span className="hb-kicker">ACESSO RÁPIDO</span><h2>Continuar aventura</h2></div></div>
                    <div className="hb-profile-shortcuts">
                      <button type="button" onClick={() => { setActivePage('campaigns'); setShowCampaignForm(false) }}>
                        <span aria-hidden="true">⚑</span><span><strong>Minhas campanhas</strong><small>Gerenciar seus mundos</small></span><span aria-hidden="true">↗</span>
                      </button>
                      <button type="button" disabled={!selectedCampaignId} onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }}>
                        <span aria-hidden="true">▧</span><span><strong>Minhas fichas</strong><small>{selectedCampaignId ? 'Abrir personagens' : 'Selecione uma campanha'}</small></span><span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </section>
          )}
          {activePage === 'profile' && <div id="hb-social-hub"><FriendsPanel campaignId={selectedCampaignId} campaignName={selectedCampaign?.name ?? 'campanha'} canInvite={Boolean(isMaster && selectedCampaignId)} /></div>}
          {activePage === 'overview' && (
  <section className="inventory-section overview-page-panel hb-overview">
    <header className="hb-hero hb-overview-hero">
      <div className="hb-hero-main">
        <span className="hb-kicker"><span className="hb-kicker-dot" /> CENTRAL DA AVENTURA</span>
        <h2>Visão geral<span className="hb-title-dot">.</span></h2>
        <p>Acompanhe a campanha, explore seus personagens e continue de onde parou.</p>
        {selectedCampaign && (
          <div className="hb-hero-tags">
            <span>⚑ {selectedCampaign.name}</span>
            <span>✧ {selectedCampaign.system_name || 'Sistema personalizado'}</span>
            <span>{isMaster ? '♜ Mestre' : '♙ Jogador'}</span>
          </div>
        )}
      </div>
      <div className="hb-hero-emblem" aria-hidden="true">◈</div>
      <div className="hb-hero-actions">
        <button type="button" className="primary-button" onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }}>Abrir fichas ↗</button>
        <button type="button" className="secondary-button" onClick={() => setActivePage('campaigns')}>Gerenciar campanhas</button>
      </div>
    </header>
    {selectedCampaign ? (
      <>
        <div className="hb-metric-grid hb-overview-metrics">
          {([
            ['♙', 'Personagens', characters.length, 'Fichas na campanha', 'sheets'],
            ['◷', 'Temporadas', seasons.length, activeSeason ? `Atual: ${activeSeason.name}` : 'Jornada da campanha', 'campaigns'],
            ['♜', 'Lojas', shops.length, 'Estabelecimentos', 'shops'],
            ['♞', 'Criaturas', creatures.length, 'Registros no bestiário', 'bestiary'],
          ] as const).map(([icon, title, count, hint, page]) => (
            <button type="button" className="hb-metric hb-metric-button" key={title} onClick={() => setActivePage(page)}>
              <span className="hb-metric-icon" aria-hidden="true">{icon}</span>
              <span className="hb-metric-content"><span className="hb-metric-label">{title}</span><strong>{count}</strong><small>{hint}</small></span>
              <span className="hb-metric-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="hb-dashboard-grid">
          <section className="hb-panel hb-journey-panel">
            <div className="hb-panel-heading"><div><span className="hb-kicker">CAMPANHA EM ANDAMENTO</span><h3>Temporadas</h3><p>Capítulos da jornada do seu grupo.</p></div><span className="hb-heading-icon">◷</span></div>
            {seasons.length ? (
              <div className="hb-journey-list">
                {[...seasons].sort((a,b) => a.season_number-b.season_number).slice(0,5).map(season => <div className={`hb-journey-entry ${season.status === 'active' ? 'is-current' : ''}`} key={season.id}>
                  <span className="hb-journey-index">{String(season.season_number).padStart(2,'0')}</span>
                  <span className="hb-journey-copy"><strong>{season.name}</strong><small>{season.description || 'Capítulo da campanha'}</small></span>
                  <span className={`hb-season-status hb-season-status-${season.status}`}>{season.status === 'active' ? 'Ativa' : season.status === 'completed' ? 'Concluída' : season.status === 'archived' ? 'Arquivada' : 'Rascunho'}</span>
                </div>)}
              </div>
            ) : <div className="hb-minimal-empty">Nenhuma temporada cadastrada por enquanto.</div>}
          </section>
          <div className="hb-overview-right-column">
          <section className="hb-panel hb-roster-panel">
            <div className="hb-panel-heading"><div><span className="hb-kicker">SEU GRUPO</span><h3>Personagens</h3><p>Os protagonistas desta campanha.</p></div><span className="hb-heading-icon">♙</span></div>
            {characters.length ? (
              <div className="hb-roster-list">{characters.slice(0,6).map(character => (
                <button type="button" className="hb-roster-entry" key={character.id} onClick={() => { setSelectedCharacterId(character.id); setSheetCharacterView(true); setActivePage('sheets') }}>
                  <span className="hb-roster-avatar">{character.emoji || '⚔️'}</span>
                  <span><strong>{character.name}</strong><small>{character.archetype || 'Sem arquétipo'}</small></span>
                  <span aria-hidden="true">↗</span>
                </button>))}</div>
            ) : <div className="hb-minimal-empty">Nenhum personagem criado ainda.</div>}
          </section>
          <section className="hb-panel hb-news-panel">
            <div className="hb-panel-heading"><div><span className="hb-kicker">MURAL DA CAMPANHA</span><h3>Notícias e atualizações</h3><p>A última notícia publicada pelo mestre.</p></div><span className="hb-heading-icon">✦</span></div>
            {isMaster && <div className="hb-news-toolbar"><button type="button" className="secondary-button" onClick={() => { if (newsShowEditor) resetNewsEditor(); else setNewsShowEditor(true) }}>{newsShowEditor ? 'Fechar editor' : '+ Nova notícia'}</button></div>}
            {isMaster && newsShowEditor && <form className="hb-news-editor" onSubmit={saveCampaignNews}>
              <h4>{newsEditingId ? 'Editar publicação' : 'Nova publicação'}</h4>
              <label>Título<input value={newsTitle} maxLength={120} onChange={event => setNewsTitle(event.target.value)} placeholder="Ex.: Próxima sessão" required /></label>
              <label>Mensagem<textarea value={newsBody} maxLength={10000} rows={5} onChange={event => setNewsBody(event.target.value)} placeholder="Escreva as novidades para os jogadores..." required /></label>
              <label>Imagem (opcional)<input type="file" accept="image/*" onChange={event => setNewsImageFile(event.target.files?.[0] || null)} /></label>
              <label>Ou endereço da imagem<input type="url" value={newsImageUrl} onChange={event => setNewsImageUrl(event.target.value)} placeholder="https://..." /></label>
              {(newsImageFile || newsImageUrl) && <p className="hb-news-image-hint">{newsImageFile ? `Arquivo selecionado: ${newsImageFile.name}` : 'Imagem vinculada por endereço.'}</p>}
              <div className="hb-news-editor-actions"><button className="primary-button" type="submit" disabled={newsSaving || !newsTitle.trim() || !newsBody.trim()}>{newsSaving ? 'Salvando...' : newsEditingId ? 'Salvar alterações' : 'Publicar notícia'}</button>
                <button type="button" className="secondary-button" onClick={resetNewsEditor}>Cancelar</button></div>
            </form>}
            {newsError && <p className="hb-news-error" role="alert">{newsError}</p>}
            {newsLoading ? <div className="hb-minimal-empty">Carregando notícias...</div> : campaignNews.length ? <>
              <div className="hb-news-feed">{(newsShowHistory ? campaignNews : campaignNews.slice(0, 1)).map(item => <article className="hb-news-card" key={item.id}>
                <div className="hb-news-card-top"><span className="hb-news-date">{new Date(item.created_at).toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})}</span>
                  {isMaster && <div className="hb-news-card-actions"><button type="button" onClick={() => editCampaignNews(item)}>Editar</button><button type="button" onClick={() => void deleteCampaignNews(item.id)}>Excluir</button></div>}</div>
                <h4>{item.title}</h4>{item.image_url && <img className="hb-news-image" src={item.image_url} alt={`Imagem da notícia: ${item.title}`} loading="lazy" />}
                <p>{item.body}</p>{item.updated_at !== item.created_at && <small>Atualizada após a publicação</small>}
              </article>)}</div>
              {campaignNews.length > 1 && <button type="button" className="secondary-button hb-news-history-button" onClick={() => setNewsShowHistory(value => !value)}>{newsShowHistory ? 'Mostrar somente a última notícia' : `Ver notícias antigas (${campaignNews.length - 1})`}</button>}
            </> : <div className="hb-minimal-empty">Ainda não há notícias publicadas nesta campanha.</div>}
          </section>
          </div>
        </div>
        <section className="hb-panel hb-overview-activity">
          <div className="hb-panel-heading"><div><span className="hb-kicker">LINHA DO TEMPO</span><h3>Últimas atividades</h3><p>Movimentações recentes da campanha.</p></div><span className="hb-heading-icon">✧</span></div>
          {activityLoading ? <div className="hb-minimal-empty">Carregando atividades...</div> : activityTableMissing ? <div className="hb-minimal-empty">Histórico indisponível nesta campanha.</div> : campaignActivities.length ?
            <div className="hb-timeline">{campaignActivities.slice(0,4).map(activity => <div className="hb-timeline-event" key={activity.id}>
              <span className="hb-timeline-dot"/><div><strong>{activity.title}</strong>{activity.description && <p>{activity.description}</p>}<small>{activity.actor_name} · {new Date(activity.created_at).toLocaleDateString('pt-BR')}</small></div>
            </div>)}</div> : <div className="hb-minimal-empty">As novidades da campanha aparecerão aqui.</div>}
        </section>
      </>
    ) : (
      <section className="hb-panel hb-overview-empty"><span aria-hidden="true">⚑</span><h3>Escolha sua campanha</h3><p>Selecione uma campanha para visualizar os detalhes da jornada.</p><button type="button" className="primary-button" onClick={() => setActivePage('campaigns')}>Ver campanhas</button></section>
    )}
  </section>
)}

          {activePage !== 'player-table' && activePage !== 'profile' && activePage !== 'master-chest' && activePage !== 'customization' && activePage !== 'conditions' && (
          <section className="welcome-row">



            <div>
              <div className="eyebrow">
                <span /> SUA JORNADA COMEÇA AQUI
              </div>

<h1>
{activePage === 'bestiary'
? 'Bestiário'
: activePage === 'enemies'
    ? 'Fichas de inimigos'
  : activePage === 'shops'
      ? 'Lojas da campanha'
      : activePage === 'sheets'
        ? 'Fichas de personagens'
        : 'Campanhas'}
  <span className="title-period">.</span>
</h1>

<p className="page-description">
{activePage === 'bestiary'
  ? 'Descubra criaturas, monstros e ameaças para suas aventuras.'
  : activePage === 'enemies'
    ? 'Crie, consulte e atualize as fichas de inimigos da campanha.'
    : activePage === 'shops'
      ? 'Explore os estabelecimentos e encontre novos itens para sua aventura.'
      : activePage === 'sheets'
        ? 'Crie, organize e atualize os personagens e suas fichas por temporada.'
        : 'Organize suas campanhas e escolha qual deseja administrar.'}
</p>

            </div>

            {activePage === 'campaigns' && (
              <button
                className="primary-button"
                onClick={() => setShowCampaignForm((value) => !value)}
              >
                + Criar campanha
              </button>
            )}
          </section>
          )}

{activePage === 'enemies' && selectedCampaign && isMaster && (
  <section className="inventory-section enemies-page-panel">
    <style>{`
      .enemies-page-panel { min-width:0; }
      .enemy-hub { --eh-border:var(--season-line,rgba(255,255,255,.13)); --eh-ink:var(--season-text,inherit); --eh-muted:var(--season-muted,#b4adb5); --eh-accent:var(--season-accent,#dca279); --eh-wash:var(--season-accent-soft,rgba(220,162,121,.1)); display:grid; gap:20px; color:var(--eh-ink); }
      .enemy-hub * { box-sizing:border-box; }
      .enemy-hub-hero { display:flex; justify-content:space-between; align-items:center; gap:24px; min-width:0; padding:33px clamp(22px,3.1vw,38px); border:1px solid var(--eh-border); border-radius:25px; background:radial-gradient(ellipse at 5% 0%,var(--eh-wash),transparent 56%),linear-gradient(125deg,var(--season-surface,rgba(24,22,27,.96)),var(--season-surface-alt,rgba(255,255,255,.035))); overflow:hidden; position:relative; box-shadow:0 18px 40px rgba(0,0,0,.07); }
      .enemy-hub-hero:before { content:''; position:absolute; right:-70px; top:-190px; width:360px; height:360px; border-radius:100%; border:1px solid var(--eh-border); box-shadow:0 0 0 45px rgba(255,255,255,.014),0 0 0 90px rgba(255,255,255,.01); pointer-events:none; }
      .enemy-hub-hero > * { position:relative; z-index:1; }
      .enemy-hub-eyebrow { display:inline-flex; align-items:center; gap:8px; margin-bottom:12px; font-size:10px; font-weight:850; letter-spacing:.155em; text-transform:uppercase; color:var(--eh-accent); }
      .enemy-hub-eyebrow:before { content:''; width:7px; height:7px; border-radius:100%; background:currentColor; box-shadow:0 0 0 4px var(--eh-wash); }
      .enemy-hub-hero h2 { font-size:clamp(27px,3.1vw,40px); letter-spacing:-.048em; line-height:1.1; margin:0 0 12px; }
      .enemy-hub-hero p { margin:0; max-width:550px; color:var(--eh-muted); line-height:1.62; font-size:13px; }
      .enemy-hub-hero-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:19px; }
      .enemy-hub-hero-meta span { display:inline-flex; align-items:center; gap:7px; max-width:100%; border:1px solid var(--eh-border); border-radius:99px; padding:7px 11px; background:var(--season-surface-alt,rgba(255,255,255,.04)); color:var(--eh-muted); font-size:11px; font-weight:650; }
      .enemy-hub-hero-meta span strong { color:var(--eh-ink); font-weight:750; overflow-wrap:anywhere; }
      .enemy-hub-hero-actions { display:grid; justify-items:center; flex:0 0 auto; gap:17px; }
      .enemy-hub-hero-symbol { display:grid; place-items:center; width:86px; height:86px; font-size:39px; border:1px solid var(--eh-border); border-radius:25px; background:var(--eh-wash); transform:rotate(-7deg); box-shadow:0 14px 30px rgba(0,0,0,.09); }
      .enemy-hub-hero-symbol > span { transform:rotate(7deg); }
      .enemy-hub-hero .primary-button { white-space:nowrap; min-height:46px; padding-inline:20px; border-radius:12px; font-weight:800; }
      .enemy-hub-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }
      .enemy-hub-metric { display:flex; align-items:center; gap:14px; min-width:0; padding:17px; border:1px solid var(--eh-border); border-radius:18px; background:linear-gradient(155deg,var(--season-surface,rgba(255,255,255,.025)),var(--season-surface-alt,rgba(255,255,255,.035))); }
      .enemy-hub-metric-icon { display:grid; place-items:center; height:43px; width:43px; flex:0 0 43px; border-radius:13px; background:var(--eh-wash); font-size:20px; }
      .enemy-hub-metric-copy { display:grid; gap:5px; min-width:0; }
      .enemy-hub-metric-copy > span { color:var(--eh-muted); font-size:11px; font-weight:700; line-height:1.35; }
      .enemy-hub-metric strong { font-size:clamp(21px,2.4vw,28px); letter-spacing:-.048em; line-height:1.06; font-variant-numeric:tabular-nums; }
      .enemy-hub-library { min-width:0; padding:23px; border:1px solid var(--eh-border); border-radius:24px; background:var(--season-surface,rgba(0,0,0,.08)); }
      .enemy-hub-section-title { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px; margin-bottom:20px; }
      .enemy-hub-section-heading { display:flex; align-items:center; gap:13px; }
      .enemy-hub-section-icon { display:grid; place-items:center; width:45px; height:45px; flex:0 0 45px; border:1px solid var(--eh-border); border-radius:14px; background:var(--eh-wash); font-size:21px; }
      .enemy-hub-section-title h3 { margin:0 0 4px; font-size:21px; letter-spacing:-.035em; }
      .enemy-hub-section-title p { margin:0; color:var(--eh-muted); font-size:12px; line-height:1.4; }
      .enemy-hub-result-count { align-self:center; display:inline-flex; align-items:center; gap:6px; padding:8px 11px; font-size:11px; color:var(--eh-muted); font-weight:750; border:1px solid var(--eh-border); border-radius:999px; background:var(--season-surface-alt,rgba(255,255,255,.03)); }
      .enemy-hub-toolbar { display:grid; grid-template-columns:minmax(175px,1.8fr) minmax(145px,1fr) minmax(165px,1fr); gap:10px; margin-bottom:13px; }
      .enemy-hub-search { display:flex; align-items:center; gap:10px; min-width:0; border:1px solid var(--eh-border); background:var(--season-surface-alt,rgba(255,255,255,.04)); border-radius:13px; padding:0 13px; transition:border-color .16s,box-shadow .16s; }
      .enemy-hub-search > span { font-size:22px; line-height:1; opacity:.68; }
      .enemy-hub-search input { min-width:0; width:100%; min-height:46px; background:transparent; border:0; padding:9px 0; color:inherit; font:inherit; font-size:12px; outline:0; }
      .enemy-hub-search:focus-within { border-color:var(--eh-accent); box-shadow:0 0 0 3px var(--eh-wash); }
      .enemy-hub-clear { border:0; padding:6px; color:inherit; background:transparent; cursor:pointer; opacity:.75; font-size:13px; }
      .enemy-hub-toolbar select { min-width:0; width:100%; min-height:46px; border-radius:13px; padding:9px 12px; border:1px solid var(--eh-border); background:var(--season-surface-alt,var(--season-surface,#29252a)); color:inherit; font:inherit; font-size:12px; }
      .enemy-hub-toolbar select:focus-visible { outline:2px solid var(--eh-accent); outline-offset:2px; }
      .enemy-hub-toolbar select option { background:var(--season-surface,#252025); color:var(--season-text,#eee); }
      .enemy-hub-controls { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:0 0 18px; margin-bottom:18px; border-bottom:1px solid var(--eh-border); }
      .enemy-hub-filter-group { display:flex; align-items:center; flex-wrap:wrap; gap:7px; }
      .enemy-hub-filter-group button { display:inline-flex; align-items:center; gap:7px; min-height:34px; padding:7px 12px; border:1px solid var(--eh-border); border-radius:999px; background:transparent; color:var(--eh-muted); cursor:pointer; font:inherit; font-size:11px; font-weight:750; transition:background .15s,border-color .15s,color .15s; }
      .enemy-hub-filter-group button:hover { color:var(--eh-ink); border-color:var(--eh-accent); }
      .enemy-hub-filter-group button[aria-pressed=true] { color:var(--eh-accent); border-color:var(--eh-accent); background:var(--eh-wash); }
      .enemy-hub-filter-group button:disabled { opacity:.42; cursor:not-allowed; }
      .enemy-hub-filter-group button small { font-size:10px; color:inherit; opacity:.8; }
      .enemy-hub-view-switch { display:inline-flex; align-items:center; gap:4px; padding:4px; border:1px solid var(--eh-border); border-radius:11px; background:var(--season-surface-alt,rgba(255,255,255,.025)); }
      .enemy-hub-view-switch button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:32px; min-width:75px; padding:6px 9px; border:0; border-radius:8px; cursor:pointer; background:transparent; color:var(--eh-muted); font:inherit; font-size:11px; font-weight:750; }
      .enemy-hub-view-switch button[aria-pressed=true] { background:var(--eh-wash); color:var(--eh-accent); }
      .enemy-hub-view-switch button:focus-visible, .enemy-hub-filter-group button:focus-visible { outline:2px solid var(--eh-accent); outline-offset:2px; }
      .enemy-hub-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,286px),1fr)); gap:15px; }
      .enemy-hub-card { display:flex; flex-direction:column; min-width:0; position:relative; overflow:hidden; border:1px solid var(--eh-border); border-radius:19px; background:linear-gradient(155deg,var(--season-surface-alt,rgba(255,255,255,.04)),var(--season-surface,rgba(0,0,0,.08))); transition:border-color .17s ease,transform .17s ease,box-shadow .17s ease; }
      .enemy-hub-card:before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--eh-accent); opacity:.45; }
      .enemy-hub-card:hover, .enemy-hub-card:focus-within { border-color:var(--eh-accent); transform:translateY(-3px); box-shadow:0 17px 35px rgba(0,0,0,.12); }
      .enemy-hub-card-main { display:flex; flex-direction:column; align-items:stretch; gap:13px; width:100%; flex:1; padding:19px 18px 17px; text-align:left; color:inherit; background:transparent; border:0; cursor:pointer; font:inherit; }
      .enemy-hub-card-main:focus-visible, .enemy-hub-card-actions button:focus-visible { outline:2px solid var(--eh-accent); outline-offset:-3px; }
      .enemy-hub-card-head { display:flex; gap:10px; align-items:center; justify-content:space-between; }
      .enemy-hub-avatar { display:grid; place-items:center; width:57px; height:57px; flex:0 0 57px; font-size:29px; background:var(--eh-wash); border-radius:16px; border:1px solid var(--eh-border); }
      .enemy-hub-status-pill { display:inline-flex; align-items:center; gap:6px; min-width:0; border-radius:99px; padding:7px 10px; border:1px solid var(--eh-border); color:var(--eh-muted); background:var(--season-surface-alt,rgba(255,255,255,.03)); font-size:10px; font-weight:750; }
      .enemy-hub-status-pill:before { content:''; width:6px; height:6px; border-radius:100%; background:currentColor; flex:0 0 6px; }
      .enemy-hub-status-pill.is-ready { color:var(--eh-accent); background:var(--eh-wash); }
      .enemy-hub-card-identity { display:grid; gap:6px; }
      .enemy-hub-type { color:var(--eh-accent); font-size:10px; font-weight:850; letter-spacing:.105em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; text-transform:uppercase; }
      .enemy-hub-card h4 { font-size:19px; line-height:1.3; margin:0; letter-spacing:-.032em; overflow-wrap:anywhere; }
      .enemy-hub-card-description { margin:0; font-size:12px; line-height:1.6; color:var(--eh-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:39px; }
      .enemy-hub-resource-panel { display:grid; gap:9px; margin-top:auto; padding:13px; border:1px solid var(--eh-border); border-radius:13px; background:var(--season-surface-alt,rgba(255,255,255,.025)); }
      .enemy-hub-resource-row { display:grid; grid-template-columns:25px minmax(0,1fr) auto; align-items:center; gap:9px; min-width:0; }
      .enemy-hub-resource-row > span:first-child { font-size:10px; font-weight:850; color:var(--eh-muted); }
      .enemy-hub-resource-row strong { font-size:11px; font-weight:850; white-space:nowrap; font-variant-numeric:tabular-nums; }
      .enemy-hub-resource-track { display:block; height:6px; border-radius:20px; overflow:hidden; background:var(--season-line,rgba(255,255,255,.11)); }
      .enemy-hub-resource-track > span { display:block; height:100%; max-width:100%; border-radius:inherit; background:var(--eh-resource,#c97676); transition:width .18s; }
      .enemy-hub-resource-pv { --eh-resource:#df7777; }
      .enemy-hub-resource-ps { --eh-resource:#76a3da; }
      .enemy-hub-resource-pr { --eh-resource:#62bba1; }
      .enemy-hub-resource-blood { --eh-resource:#e47683; }
      .enemy-hub-card-bottom { display:grid; gap:11px; padding:12px 14px 14px; border-top:1px solid var(--eh-border); background:var(--season-surface-alt,rgba(255,255,255,.015)); }
      .enemy-hub-card-bottom > small { color:var(--eh-muted); font-size:10px; padding:0 4px; }
      .enemy-hub-card-actions { display:flex; align-items:center; gap:6px; }
      .enemy-hub-card-actions button { display:inline-flex; justify-content:center; align-items:center; gap:6px; min-height:36px; padding:8px 11px; border:1px solid var(--eh-border); background:var(--season-surface-alt,rgba(255,255,255,.03)); color:inherit; border-radius:10px; cursor:pointer; font:inherit; font-weight:750; font-size:11px; transition:border-color .15s,background .15s; }
      .enemy-hub-card-actions button:hover:not(:disabled) { border-color:var(--eh-accent); background:var(--eh-wash); }
      .enemy-hub-card-actions button:disabled { opacity:.45; cursor:not-allowed; }
      .enemy-hub-card-actions .enemy-hub-open { background:var(--eh-wash); color:var(--eh-ink); flex:1; }
      .enemy-hub-card-actions .enemy-hub-delete:hover:not(:disabled) { border-color:#d86666; background:rgba(216,102,102,.12); color:#e9a4a4; }
      .enemy-hub-grid.is-list { grid-template-columns:minmax(0,1fr); gap:10px; }
      .enemy-hub-grid.is-list .enemy-hub-card { display:grid; grid-template-columns:minmax(0,1fr) minmax(200px,.45fr); align-items:stretch; }
      .enemy-hub-grid.is-list .enemy-hub-card:before { left:0; top:0; bottom:0; right:auto; width:3px; height:auto; }
      .enemy-hub-grid.is-list .enemy-hub-card-main { display:grid; grid-template-columns:60px minmax(0,1fr) minmax(155px,.65fr); column-gap:14px; row-gap:7px; padding:15px 18px; align-items:center; }
      .enemy-hub-grid.is-list .enemy-hub-card-head { grid-column:1; grid-row:1/4; justify-content:center; }
      .enemy-hub-grid.is-list .enemy-hub-card-head .enemy-hub-status-pill { display:none; }
      .enemy-hub-grid.is-list .enemy-hub-card-identity { grid-column:2; grid-row:1; }
      .enemy-hub-grid.is-list .enemy-hub-card-description { grid-column:2; grid-row:2; min-height:unset; -webkit-line-clamp:1; }
      .enemy-hub-grid.is-list .enemy-hub-resource-panel { grid-column:3; grid-row:1/4; margin:0; }
      .enemy-hub-grid.is-list .enemy-hub-card-bottom { justify-content:center; min-width:0; }
      .enemy-hub-grid.is-list .enemy-hub-card-actions { flex-wrap:wrap; }
      .enemy-hub-empty { display:grid; justify-items:center; gap:12px; padding:49px 18px; border:1px dashed var(--eh-border); border-radius:20px; text-align:center; background:radial-gradient(ellipse at 50% 0%,var(--eh-wash),transparent 75%),var(--season-surface-alt,rgba(255,255,255,.015)); }
      .enemy-hub-empty > span { display:grid; place-items:center; width:75px; height:75px; border-radius:24px; border:1px solid var(--eh-border); background:var(--eh-wash); font-size:34px; }
      .enemy-hub-empty h4 { margin:0; font-size:20px; letter-spacing:-.025em; }
      .enemy-hub-empty p { color:var(--eh-muted); margin:0 0 6px; max-width:430px; font-size:13px; line-height:1.6; }
      .enemy-hub-modal { width:min(620px,calc(100vw - 28px)); }
      .enemy-hub-form-preview { display:flex; gap:14px; align-items:center; margin-bottom:17px; padding:16px; border:1px solid var(--eh-border); background:linear-gradient(125deg,var(--eh-wash),var(--season-surface-alt,rgba(255,255,255,.025))); border-radius:17px; }
      .enemy-hub-form-preview strong,.enemy-hub-form-preview > div span { display:block; overflow-wrap:anywhere; }
      .enemy-hub-form-preview strong { font-size:17px; }
      .enemy-hub-form-preview > div span { margin-top:4px; font-size:12px; color:var(--eh-muted); }
      .enemy-hub-modal .bestiary-form input,.enemy-hub-modal .bestiary-form textarea { border-radius:11px; }
      /* Arquivo tático: leitura dos inimigos, encontros e recursos */
      .enemy-hub { gap:17px; }
      .enemy-hub-hero { border-radius:26px; padding:clamp(25px,3vw,39px); background:radial-gradient(circle at 90% 5%,var(--eh-wash),transparent 44%),linear-gradient(130deg,var(--season-surface,rgba(25,25,29,.96)),var(--season-surface-alt,rgba(255,255,255,.035))); }
      .enemy-hub-hero h2 { font-size:clamp(30px,3.4vw,43px); }
      .enemy-hub-hero-symbol { width:94px; height:94px; border-radius:28px; box-shadow:0 14px 32px rgba(0,0,0,.15); }
      .enemy-hub-hero-subline { display:inline-flex; gap:7px; align-items:center; margin-top:15px; font-size:11px; color:var(--eh-muted); font-weight:650; }
      .enemy-hub-hero-subline i { display:block; width:6px; height:6px; border-radius:50%; background:var(--eh-accent); }
      .enemy-hub-metric { transition:border-color .17s,transform .17s; }
      .enemy-hub-metric.is-scene { border-color:color-mix(in srgb,var(--eh-accent) 35%,var(--eh-border)); background:linear-gradient(150deg,var(--eh-wash),var(--season-surface,rgba(255,255,255,.025))); }
      .enemy-hub-metric.is-warning .enemy-hub-metric-icon { background:rgba(224,93,101,.12); color:#ee999e; }
      .enemy-hub-scene { padding:22px; border:1px solid var(--eh-border); border-radius:22px; background:linear-gradient(135deg,var(--season-surface-alt,rgba(255,255,255,.04)),var(--season-surface,rgba(20,20,25,.7))); }
      .enemy-hub-scene-top { display:flex; align-items:start; justify-content:space-between; gap:15px; margin-bottom:16px; }
      .enemy-hub-scene-title { display:flex; align-items:center; gap:12px; min-width:0; }
      .enemy-hub-scene-icon { display:grid; place-items:center; height:46px; width:46px; flex:0 0 46px; font-size:22px; background:var(--eh-wash); border:1px solid var(--eh-border); border-radius:14px; }
      .enemy-hub-scene-kicker { font-size:10px; font-weight:850; letter-spacing:.13em; color:var(--eh-accent); }
      .enemy-hub-scene-title h3 { margin:3px 0 4px; font-size:19px; letter-spacing:-.025em; }
      .enemy-hub-scene-title p { margin:0; font-size:12px; color:var(--eh-muted); line-height:1.5; }
      .enemy-hub-scene-tag { flex:0 0 auto; padding:8px 12px; background:var(--eh-wash); border:1px solid var(--eh-border); border-radius:999px; color:var(--eh-accent); font-size:11px; font-weight:800; }
      .enemy-hub-scene-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr)); gap:9px; }
      .enemy-hub-scene-enemy { display:flex; align-items:center; gap:11px; min-width:0; padding:11px; border:1px solid var(--eh-border); border-radius:14px; background:var(--season-surface-alt,rgba(255,255,255,.04)); color:inherit; text-align:left; cursor:pointer; font:inherit; transition:border-color .16s,background .16s,transform .16s; }
      .enemy-hub-scene-enemy:hover { border-color:var(--eh-accent); background:var(--eh-wash); transform:translateY(-2px); }
      .enemy-hub-scene-enemy:focus-visible { outline:2px solid var(--eh-accent); outline-offset:2px; }
      .enemy-hub-scene-face { display:grid; place-items:center; width:42px; height:42px; flex:0 0 42px; border-radius:12px; background:var(--eh-wash); font-size:24px; }
      .enemy-hub-scene-info { display:grid; gap:3px; flex:1; min-width:0; }
      .enemy-hub-scene-info strong { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; }
      .enemy-hub-scene-info small { font-size:10px; color:var(--eh-muted); }
      .enemy-hub-scene-end { color:var(--eh-accent); font-size:18px; }
      .enemy-hub-scene-empty { display:flex; align-items:center; gap:10px; padding:14px; border:1px dashed var(--eh-border); border-radius:13px; color:var(--eh-muted); font-size:12px; line-height:1.5; }
      .enemy-hub-scene-empty > span { font-size:19px; }
      .enemy-hub-scene-more { display:grid; place-items:center; padding:12px; border:1px dashed var(--eh-border); border-radius:13px; font-size:11px; font-weight:750; color:var(--eh-muted); }
      .enemy-hub-library { padding:25px; }
      .enemy-hub-card { border-radius:20px; }
      .enemy-hub-card:before { height:4px; opacity:.6; }
      .enemy-hub-card.is-in-party:before { opacity:1; }
      .enemy-hub-card.is-critical { border-color:rgba(226,103,112,.45); }
      .enemy-hub-card.is-critical:before { background:#e36d7b; }
      .enemy-hub-card-head { align-items:flex-start; }
      .enemy-hub-avatar { width:62px; height:62px; flex-basis:62px; font-size:32px; border-radius:18px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.025); }
      .enemy-hub-card-flags { display:grid; justify-items:end; align-content:start; gap:6px; }
      .enemy-hub-status-pill.is-in-party { color:var(--eh-accent); border-color:color-mix(in srgb,var(--eh-accent) 40%,var(--eh-border)); background:var(--eh-wash); }
      .enemy-hub-status-pill.is-critical { color:#f1a2ad; border-color:rgba(226,103,112,.4); background:rgba(226,103,112,.12); }
      .enemy-hub-card-main { padding:20px 20px 17px; }
      .enemy-hub-card h4 { font-size:20px; }
      .enemy-hub-resource-panel { gap:11px; padding:14px; }
      .enemy-hub-resource-track { height:7px; }
      .enemy-hub-card-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:2px; }
      .enemy-hub-card-meta-label { font-size:10px; color:var(--eh-muted); }
      .enemy-hub-card-meta strong { color:var(--eh-accent); font-size:10px; }
      .enemy-hub-card-bottom { gap:9px; }
      .enemy-hub-card-actions { flex-wrap:wrap; }
      .enemy-hub-card-actions .enemy-hub-party-toggle { width:100%; justify-content:center; border-color:color-mix(in srgb,var(--eh-accent) 30%,var(--eh-border)); }
      .enemy-hub-card-actions .enemy-hub-party-toggle.is-active { background:var(--eh-wash); color:var(--eh-accent); }
      .enemy-hub-card-actions .enemy-hub-party-toggle:disabled { opacity:.5; }
      .enemy-hub-emoji-picker { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
      .enemy-hub-emoji-picker button { display:grid; place-items:center; width:40px; height:40px; border-radius:11px; border:1px solid var(--eh-border); background:var(--season-surface-alt,rgba(255,255,255,.025)); font-size:20px; cursor:pointer; transition:border-color .15s,background .15s; }
      .enemy-hub-emoji-picker button:hover, .enemy-hub-emoji-picker button[aria-pressed=true] { border-color:var(--eh-accent); background:var(--eh-wash); }
      .enemy-hub-emoji-picker button:focus-visible { outline:2px solid var(--eh-accent); outline-offset:2px; }
      .enemy-hub-library-count { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
      .enemy-hub-active-filters { display:flex; align-items:center; flex-wrap:wrap; gap:9px; margin:-4px 0 16px; color:var(--eh-muted); font-size:11px; }
      .enemy-hub-active-filters > button { border:0; background:transparent; color:var(--eh-accent); font:inherit; font-weight:800; cursor:pointer; padding:4px 0; text-decoration:underline; text-underline-offset:3px; }
      .enemy-hub-active-filters > button:focus-visible { outline:2px solid var(--eh-accent); }
      .enemy-hub-grid.is-list .enemy-hub-card-main { grid-template-columns:66px minmax(0,1fr) minmax(155px,.65fr); }
      .enemy-hub-grid.is-list .enemy-hub-card-meta { grid-column:2; grid-row:3; }
      .enemy-hub-grid.is-list .enemy-hub-card-flags { display:none; }
      .enemy-hub-grid.is-list .enemy-hub-card-bottom { min-width:210px; }
      @media(max-width:850px) { .enemy-hub-scene-top { flex-wrap:wrap; } }
      @media(max-width:650px) { .enemy-hub-grid.is-list .enemy-hub-card-meta { grid-column:auto; grid-row:auto; } }
      @media(max-width:560px) { .enemy-hub-scene { padding:15px; } .enemy-hub-scene-top { gap:12px; } .enemy-hub-scene-tag { width:100%; text-align:center; } .enemy-hub-card-actions .enemy-hub-party-toggle { width:100%; } }
      @media(max-width:1050px) { .enemy-hub-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .enemy-hub-grid.is-list .enemy-hub-card { grid-template-columns:minmax(0,1fr); } .enemy-hub-grid.is-list .enemy-hub-card-bottom { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; } }
      @media(max-width:850px) { .enemy-hub-hero { flex-wrap:wrap; } .enemy-hub-hero-actions { display:flex; align-items:center; } .enemy-hub-hero-symbol { width:57px; height:57px; font-size:27px; border-radius:16px; } .enemy-hub-toolbar { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } .enemy-hub-search { grid-column:1/-1; } }
      @media(max-width:650px) { .enemy-hub-grid.is-list .enemy-hub-card-main { display:flex; flex-direction:column; align-items:stretch; } .enemy-hub-grid.is-list .enemy-hub-card-head { justify-content:space-between; } .enemy-hub-grid.is-list .enemy-hub-card-head .enemy-hub-status-pill { display:inline-flex; } .enemy-hub-grid.is-list .enemy-hub-card-description { -webkit-line-clamp:2; } }
      @media(max-width:560px) { .enemy-hub { gap:14px; } .enemy-hub-hero { padding:23px; border-radius:19px; } .enemy-hub-hero-symbol { display:none; } .enemy-hub-hero-actions { width:100%; } .enemy-hub-hero .primary-button { width:100%; } .enemy-hub-metrics { gap:8px; } .enemy-hub-metric { padding:12px; gap:9px; } .enemy-hub-metric-icon { width:34px; height:34px; flex-basis:34px; font-size:16px; } .enemy-hub-metric strong { font-size:23px; } .enemy-hub-library { padding:15px; border-radius:19px; } .enemy-hub-toolbar { grid-template-columns:minmax(0,1fr); } .enemy-hub-search { grid-column:auto; } .enemy-hub-controls { align-items:stretch; } .enemy-hub-view-switch { width:100%; } .enemy-hub-view-switch button { flex:1; } .enemy-hub-card-actions { flex-wrap:wrap; } }
    `}</style>

    {!enemySheetView && (
      <div className="enemy-hub">
        <header className="enemy-hub-hero">
          <div>
            <span className="enemy-hub-eyebrow">ARQUIVO DO MESTRE · {selectedCampaign.name}</span>
            <h2>Inimigos da campanha</h2>
            <p>Seu centro de comando para encontros. Organize ameaças, visualize os recursos de cada ficha e monte a Party de Inimigos sem sair desta página.</p>
            <span className="enemy-hub-hero-subline"><i aria-hidden="true" /> Dados independentes de personagens e inimigos</span>
            <div className="enemy-hub-hero-meta">
              <span>✧ Sistema: <strong>{selectedCampaign.system_name || 'Não definido'}</strong></span>
              <span>♜ Área exclusiva do mestre</span>
              <span>◷ Temporada: <strong>{activeSeason?.name || 'Não selecionada'}</strong></span>
            </div>
          </div>
          <div className="enemy-hub-hero-actions">
            <div className="enemy-hub-hero-symbol" aria-hidden="true"><span>⚔️</span></div>
            <button type="button" className="primary-button" onClick={() => {
              setEditingEnemyId(null)
              setEnemyName('')
              setEnemyEmoji('👹')
              setEnemyArchetype('')
              setEnemyDescription('')
              setShowEnemyForm(true)
            }}>＋ Criar inimigo</button>
          </div>
        </header>

        <div className="enemy-hub-metrics" aria-label="Resumo dos inimigos da campanha">
          <article className="enemy-hub-metric"><span className="enemy-hub-metric-icon" aria-hidden="true">⚔</span><div className="enemy-hub-metric-copy"><span>Inimigos cadastrados</span><strong>{enemies.length}</strong></div></article>
          <article className="enemy-hub-metric is-scene"><span className="enemy-hub-metric-icon" aria-hidden="true">♜</span><div className="enemy-hub-metric-copy"><span>Na Party de Inimigos</span><strong>{enemiesInSelectedSeason.length}</strong></div></article>
          <article className="enemy-hub-metric"><span className="enemy-hub-metric-icon" aria-hidden="true">◈</span><div className="enemy-hub-metric-copy"><span>Com status na ficha</span><strong>{enemyWithStatsCount}</strong></div></article>
          <article className="enemy-hub-metric is-warning"><span className="enemy-hub-metric-icon" aria-hidden="true">♥</span><div className="enemy-hub-metric-copy"><span>PV crítico (≤ 25%)</span><strong>{enemyCriticalCount}</strong></div></article>
        </div>

        <section className="enemy-hub-scene" aria-label="Inimigos em cena na temporada selecionada">
          <div className="enemy-hub-scene-top">
            <div className="enemy-hub-scene-title">
              <span className="enemy-hub-scene-icon" aria-hidden="true">⚔</span>
              <div><span className="enemy-hub-scene-kicker">ENCONTRO ATUAL</span><h3>Inimigos em cena</h3><p>{activeSeason?.name ? `Party vinculada à temporada ${activeSeason.name}` : 'Escolha uma temporada para preparar o encontro.'}</p></div>
            </div>
            <span className="enemy-hub-scene-tag">{enemiesInSelectedSeason.length} {enemiesInSelectedSeason.length === 1 ? 'inimigo' : 'inimigos'} em cena</span>
          </div>
          {enemiesInSelectedSeason.length ? (
            <div className="enemy-hub-scene-list">
              {enemiesInSelectedSeason.slice(0, 5).map(enemy => {
                const party = getEnemyPartySeason(enemy, selectedSeasonId)
                const overview = getEnemySheetOverview(enemy)
                return <button key={enemy.id} type="button" className="enemy-hub-scene-enemy" onClick={() => openEnemyFromLibrary(enemy)} title={`Abrir ficha de ${enemy.name}`}>
                  <span className="enemy-hub-scene-face" aria-hidden="true">{enemy.emoji || '👹'}</span>
                  <span className="enemy-hub-scene-info"><strong>{enemy.name}</strong><small>{overview.hasStats ? `PV ${overview.pv} / ${overview.maxPV}` : 'Status ainda não configurado'} · {party.initiative === null ? 'Sem iniciativa' : `Iniciativa ${party.initiative}`}</small></span>
                  <span className="enemy-hub-scene-end" aria-hidden="true">↗</span>
                </button>
              })}
              {enemiesInSelectedSeason.length > 5 && <span className="enemy-hub-scene-more">+ {enemiesInSelectedSeason.length - 5} na biblioteca abaixo</span>}
            </div>
          ) : (
            <div className="enemy-hub-scene-empty"><span aria-hidden="true">◌</span>{selectedSeasonId ? 'Nenhum inimigo nesta Party. Use “Adicionar à Party” em qualquer cartão da biblioteca para preparar o encontro.' : 'Selecione uma temporada em Campanhas para acompanhar a Party de Inimigos.'}</div>
          )}
        </section>

        <div className="enemy-hub-library">
          <div className="enemy-hub-section-title">
            <div className="enemy-hub-section-heading"><span className="enemy-hub-section-icon" aria-hidden="true">☷</span><div><h3>Biblioteca de inimigos</h3><p>Filtre, consulte ou edite as fichas de suas ameaças.</p></div></div>
            <div className="enemy-hub-library-count"><span className="enemy-hub-result-count" role="status" aria-live="polite">◈ {visibleEnemies.length} {visibleEnemies.length === 1 ? 'resultado' : 'resultados'}</span><span className="enemy-hub-result-count">✧ {enemyArchetypes.length} {enemyArchetypes.length === 1 ? 'arquétipo' : 'arquétipos'}</span></div>
          </div>

          <div className="enemy-hub-toolbar">
            <label className="enemy-hub-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" value={enemySearch} onChange={event => setEnemySearch(event.target.value)}
                aria-label="Pesquisar inimigos" placeholder="Buscar nome, arquétipo ou descrição..." />
              {enemySearch && <button type="button" className="enemy-hub-clear" aria-label="Limpar busca" onClick={() => setEnemySearch('')}>✕</button>}
            </label>
            <select value={enemyArchetypeFilter} onChange={event => setEnemyArchetypeFilter(event.target.value)} aria-label="Filtrar por arquétipo">
              <option value="all">Todos os arquétipos</option>
              {enemyArchetypes.map(archetype => <option key={archetype} value={archetype}>{archetype}</option>)}
            </select>
            <select value={enemySortOrder} onChange={event => setEnemySortOrder(event.target.value as 'recent' | 'name' | 'oldest')} aria-label="Ordenar inimigos">
              <option value="recent">Atualizados recentemente</option>
              <option value="name">Nome: A–Z</option>
              <option value="oldest">Atualizados há mais tempo</option>
            </select>
          </div>

          <div className="enemy-hub-controls">
            <div className="enemy-hub-filter-group" role="group" aria-label="Filtrar inimigos pelo preenchimento da ficha">
              <button type="button" aria-pressed={enemyStatusFilter === 'all'} onClick={() => setEnemyStatusFilter('all')}>Todos <small>{enemies.length}</small></button>
              <button type="button" aria-pressed={enemyStatusFilter === 'configured'} onClick={() => setEnemyStatusFilter('configured')}>◈ Com status <small>{enemyWithStatsCount}</small></button>
              <button type="button" aria-pressed={enemyStatusFilter === 'unconfigured'} onClick={() => setEnemyStatusFilter('unconfigured')}>✎ Sem status <small>{enemyWithoutStatsCount}</small></button>
              <button type="button" aria-pressed={enemyStatusFilter === 'party'} disabled={!selectedSeasonId} onClick={() => setEnemyStatusFilter('party')}>♜ Em cena <small>{enemiesInSelectedSeason.length}</small></button>
              <button type="button" aria-pressed={enemyStatusFilter === 'critical'} onClick={() => setEnemyStatusFilter('critical')}>♥ PV crítico <small>{enemyCriticalCount}</small></button>
            </div>
            <div className="enemy-hub-view-switch" role="group" aria-label="Modo de exibição dos inimigos">
              <button type="button" aria-pressed={enemyViewMode === 'grid'} onClick={() => setEnemyViewMode('grid')}>▦ Grade</button>
              <button type="button" aria-pressed={enemyViewMode === 'list'} onClick={() => setEnemyViewMode('list')}>☷ Lista</button>
            </div>
          </div>

          {(enemySearch || enemyArchetypeFilter !== 'all' || enemyStatusFilter !== 'all') && (
            <div className="enemy-hub-active-filters"><span>Filtros ativos · {visibleEnemies.length} de {enemies.length} inimigos</span><button type="button" onClick={() => { setEnemySearch(''); setEnemyArchetypeFilter('all'); setEnemyStatusFilter('all') }}>Limpar tudo</button></div>
          )}

          {enemiesLoading ? (
            <div className="enemy-hub-empty" role="status"><span aria-hidden="true">⏳</span><h4>Carregando inimigos...</h4><p>Buscando as fichas da campanha.</p></div>
          ) : enemies.length === 0 ? (
            <div className="enemy-hub-empty">
              <span aria-hidden="true">⚔</span>
              <h4>Seu arquivo ainda está vazio</h4>
              <p>Cadastre o primeiro inimigo para começar a preparar os encontros da campanha.</p>
              <button type="button" className="primary-button" onClick={() => {
                setEditingEnemyId(null); setEnemyName(''); setEnemyEmoji('👹');
                setEnemyArchetype(''); setEnemyDescription(''); setShowEnemyForm(true)
              }}>+ Criar primeiro inimigo</button>
            </div>
          ) : visibleEnemies.length === 0 ? (
            <div className="enemy-hub-empty">
              <span aria-hidden="true">⌕</span><h4>Nenhum inimigo encontrado</h4>
              <p>Tente outra palavra ou remova os filtros para visualizar todas as fichas.</p>
              <button type="button" className="secondary-button" onClick={() => { setEnemySearch(''); setEnemyArchetypeFilter('all'); setEnemyStatusFilter('all') }}>Limpar filtros</button>
            </div>
          ) : (
            <div className={`enemy-hub-grid${enemyViewMode === 'list' ? ' is-list' : ''}`}>
              {visibleEnemies.map(enemy => {
                const status = getEnemySheetOverview(enemy)
                const updatedAt = new Date(enemy.updated_at || enemy.created_at)
                const labelDate = Number.isNaN(updatedAt.getTime()) ? 'Data indisponível' : updatedAt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })
                const party = selectedSeasonId ? getEnemyPartySeason(enemy, selectedSeasonId) : null
                const isInParty = party?.participating === true
                const isCritical = status.hasStats && status.maxPV > 0 && status.pv <= status.maxPV * 0.25
                const resourceRows = [
                  {key: 'pv', label: 'PV', current: status.pv, max: status.maxPV},
                  {key: 'ps', label: 'PS', current: status.ps, max: status.maxPS},
                  {key: 'pr', label: enemyResourceAbbreviation, current: status.pr, max: status.maxPR},
                ]
                const open = () => openEnemyFromLibrary(enemy)
                return (
                  <article className={`enemy-hub-card${isInParty ? ' is-in-party' : ''}${isCritical ? ' is-critical' : ''}`} key={enemy.id}>
                    <button type="button" className="enemy-hub-card-main" onClick={open} aria-label={`Abrir ficha de ${enemy.name}`}>
                      <div className="enemy-hub-card-head">
                        <span className="enemy-hub-avatar" aria-hidden="true">{enemy.emoji || '👹'}</span>
                        <span className="enemy-hub-card-flags">
                          {isInParty && <span className="enemy-hub-status-pill is-in-party">Em cena</span>}
                          {isCritical && <span className="enemy-hub-status-pill is-critical">PV crítico</span>}
                          {!isInParty && !isCritical && <span className={`enemy-hub-status-pill${status.hasStats ? ' is-ready' : ''}`}>{status.hasStats ? 'Ficha pronta' : 'Sem status'}</span>}
                        </span>
                      </div>
                      <div className="enemy-hub-card-identity">
                        <span className="enemy-hub-type">{enemy.archetype || 'Sem arquétipo'}</span>
                        <h4>{enemy.name}</h4>
                      </div>
                      <p className="enemy-hub-card-description">{enemy.description || 'Adicione uma descrição para organizar esta ameaça.'}</p>
                      <div className="enemy-hub-resource-panel" aria-label={`Recursos de ${enemy.name}`}>
                        {resourceRows.map(resource => (
                          <div className={`enemy-hub-resource-row enemy-hub-resource-${resource.key}${resource.key === 'pr' && isKisatsutaiSystem ? ' enemy-hub-resource-blood' : ''}`} key={resource.key}>
                            <span>{resource.label}</span>
                            <span className="enemy-hub-resource-track" aria-hidden="true"><span style={{width: `${status.hasStats && resource.max > 0 ? Math.max(0,Math.min(100,(resource.current / resource.max) * 100)) : 0}%`}} /></span>
                            <strong>{status.hasStats ? `${resource.current} / ${resource.max}` : '—'}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="enemy-hub-card-meta"><span className="enemy-hub-card-meta-label">{isInParty ? '♜ Participando do encontro' : status.hasStats ? '◈ Ficha configurada' : '✎ Aguardando configuração'}</span>{isInParty && <strong>{party?.initiative == null ? 'Sem iniciativa' : `Iniciativa ${party.initiative}`}</strong>}</div>
                    </button>
                    <footer className="enemy-hub-card-bottom">
                      <small>◷ Atualizado em {labelDate}</small>
                      <div className="enemy-hub-card-actions">
                        <button type="button" className="enemy-hub-open" onClick={open}>Abrir ficha ↗</button>
                        <button type="button" onClick={() => {
                          setEditingEnemyId(enemy.id)
                          setEnemyName(enemy.name)
                          setEnemyEmoji(enemy.emoji || '👹')
                          setEnemyArchetype(enemy.archetype || '')
                          setEnemyDescription(enemy.description || '')
                          setShowEnemyForm(true)
                        }} aria-label={`Editar informações de ${enemy.name}`} title="Editar informações">✎ Editar</button>
                        <button type="button" onClick={() => void duplicateEnemy(enemy)} disabled={enemySaving} aria-label={`Duplicar ${enemy.name}`} title="Duplicar ficha">⧉</button>
                        <button type="button" className="enemy-hub-delete" onClick={() => void deleteEnemy(enemy)} aria-label={`Excluir ${enemy.name}`} title="Excluir inimigo">✕</button>
                        <button type="button" className={`enemy-hub-party-toggle${isInParty ? ' is-active' : ''}`}
                          disabled={!selectedSeasonId || enemyPartySavingId !== null}
                          aria-pressed={isInParty}
                          title={!selectedSeasonId ? 'Selecione uma temporada para gerenciar a Party' : undefined}
                          onClick={() => { if (!selectedSeasonId) return; void updateEnemyPartySeason(enemy.id, selectedSeasonId, {participating: !isInParty}, isInParty ? `${enemy.name} removido da Party de Inimigos.` : `${enemy.name} adicionado à Party de Inimigos.`) }}>
                          {enemyPartySavingId === enemy.id ? 'Salvando participação...' : isInParty ? '✓ Na Party · Remover' : '＋ Adicionar à Party'}
                        </button>
                      </div>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {showEnemyForm && (
          <div className="bestiary-modal-overlay" onMouseDown={event => {
            if (event.target === event.currentTarget && !enemySaving) { setShowEnemyForm(false); setEditingEnemyId(null) }
          }}>
            <form className="bestiary-modal enemy-hub-modal" onSubmit={event => { event.preventDefault(); void saveEnemy() }}>
              <div className="bestiary-modal-header">
                <div><span className="shops-eyebrow">⚔ FICHAS DA CAMPANHA</span><h2>{editingEnemyId ? 'Editar inimigo' : 'Novo inimigo'}</h2><p>Informações básicas da ficha. Os dados de combate são editados ao abrir o inimigo.</p></div>
                <button type="button" aria-label="Fechar janela" onClick={() => { if (!enemySaving) { setShowEnemyForm(false); setEditingEnemyId(null) } }}>×</button>
              </div>
              <div className="bestiary-form">
                <div className="enemy-hub-form-preview" aria-live="polite">
                  <span className="enemy-hub-avatar" aria-hidden="true">{enemyEmoji || '👹'}</span>
                  <div><strong>{enemyName.trim() || 'Nome do inimigo'}</strong><span>{enemyArchetype.trim() || 'Arquétipo não definido'}</span></div>
                </div>
                <label>Nome do inimigo *<input type="text" value={enemyName} onChange={event => setEnemyName(event.target.value)} placeholder="Ex.: Guarda da fortaleza" maxLength={100} required autoFocus /></label>
                <div className="bestiary-form-row">
                  <label>Emoji<input type="text" value={enemyEmoji} onChange={event => setEnemyEmoji(event.target.value)} placeholder="👹" maxLength={12} /></label>
                  <label>Arquétipo<input type="text" value={enemyArchetype} onChange={event => setEnemyArchetype(event.target.value)} placeholder="Ex.: Humanoide, Chefe, Elite..." maxLength={80} /></label>
                </div>
                <div><span style={{fontSize:12, color:'var(--eh-muted)',fontWeight:700}}>Escolha rápida de emoji</span><div className="enemy-hub-emoji-picker" role="group" aria-label="Emojis sugeridos para inimigos">{enemyEmojiChoices.map(emoji => <button type="button" key={emoji} aria-pressed={enemyEmoji === emoji} aria-label={`Usar emoji ${emoji}`} onClick={() => setEnemyEmoji(emoji)}>{emoji}</button>)}</div></div>
                <label>Descrição<textarea value={enemyDescription} onChange={event => setEnemyDescription(event.target.value)} placeholder="Aparência, comportamento, papel na história..." rows={4} maxLength={1000} /></label>
              </div>
              <div className="bestiary-modal-actions">
                <button type="button" disabled={enemySaving} onClick={() => { setShowEnemyForm(false); setEditingEnemyId(null) }}>Cancelar</button>
                <button type="submit" disabled={enemySaving || !enemyName.trim()}>{enemySaving ? 'Salvando...' : editingEnemyId ? 'Salvar alterações' : 'Criar inimigo'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    )}

{enemySheetView && selectedEnemy && (
  <div className="enemy-sheet-panel">
    {enemySheetLoading || enemySheetLoadedForRef.current !== `${selectedCampaignId}:${selectedEnemyId}`
      ? <p className="master-shield-empty">Carregando ficha do inimigo...</p> : (
      <>
        <div className="inventory-heading sheet-page-hero sheet-page-hero-detail sheet-enemy-hero">
          <div className="enemy-sheet-hero-top">
            <div className="sheet-page-hero-leading">
              <span className="sheet-page-hero-icon" aria-hidden="true">{selectedEnemy.emoji || '👹'}</span>
              <div>
                <span className="sheet-page-eyebrow">FICHA DE INIMIGO · EXCLUSIVA DO MESTRE</span>
                <h2>{selectedEnemy.name}</h2>
                <p>{selectedCampaign?.name} · {enemySystemName || 'Sistema de RPG'}</p>
              </div>
            </div>
            <div className="enemy-sheet-hero-utilities">
              <button type="button" className="secondary-button" onClick={() => {
                if (enemySheetDirty && !window.confirm('Existem alterações não salvas na ficha. Deseja voltar sem salvá-las?')) return
                setEnemySheetView(false)
                setEnemyItemEditorOpen(false)
              }}>← Lista de inimigos</button>
              <button type="button" className="secondary-button" disabled={enemySaving || enemySheetSaving}
                onClick={() => void duplicateEnemy(selectedEnemy)}>Duplicar ficha</button>
            </div>
          </div>
          <div className="enemy-sheet-toolbar">
            <div className={`enemy-sheet-save-indicator is-${enemyAutoSaveStatus}`} role="status" aria-live="polite">
              <span className="enemy-sheet-save-icon" aria-hidden="true">
                {enemyAutoSaveStatus === 'error' ? '!' : enemyAutoSaveStatus === 'saving' ? '↻' : enemySheetDirty ? '•' : '✓'}
              </span>
              <div className="enemy-sheet-save-copy">
                <strong>
                  {enemyAutoSaveStatus === 'error' ? 'Não foi possível salvar'
                    : enemyAutoSaveStatus === 'saving' ? 'Salvando alterações'
                    : enemyAutoSaveStatus === 'pending' || enemySheetDirty ? 'Alterações pendentes'
                    : enemyAutoSaveStatus === 'saved' ? 'Ficha salva' : 'Ficha pronta'}
                </strong>
                <small>
                  {enemyAutoSaveStatus === 'error' ? 'Confira a conexão e tente salvar novamente.'
                    : enemyAutoSaveStatus === 'saving' ? 'Atualizando as informações da ficha…'
                    : enemyAutoSaveStatus === 'pending' || enemySheetDirty ? 'O salvamento automático está ativo.'
                    : 'Nenhuma alteração pendente.'}
                </small>
              </div>
            </div>
            <div className="enemy-sheet-toolbar-actions">
              <button type="button" className="secondary-button enemy-sheet-edit-button"
                onClick={() => setEnemyEditingSheet(value => !value)}>
                <span aria-hidden="true">✎</span>
                {enemyEditingSheet ? 'Visualizar ficha' : 'Editar ficha'}
              </button>
              {(enemySheetDirty || enemySheetSaving) && (
                <button type="button" className="primary-button enemy-sheet-save-button"
                  disabled={enemySheetSaving}
                  onClick={() => void saveEnemySheet()}>
                  <span aria-hidden="true">{enemySheetSaving ? '↻' : '↓'}</span>
                  {enemySheetSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              )}
            </div>
          </div>
        </div>
        <nav className="sheet-quick-nav hb-sheet-nav-v2" aria-label="Navegação da ficha do inimigo"><span className="hb-nav-caption">SEÇÕES DA FICHA</span>
          {(enemyEditingSheet ? [
            ['✎', 'Edição', 'inimigo-edicao'], ['⚔', 'Ações', 'inimigo-acoes'], ['◈', 'Reações', 'inimigo-reacoes'],
            ['⛨', 'Armadura', 'inimigo-armadura-protecao'], ['▤', 'Inventário', 'inimigo-inventario'],
          ] : [
            ['♥', 'Status', 'inimigo-status'], ['✦', 'Atributos', 'inimigo-atributos'], ['✧', 'Perícias', 'inimigo-pericias'],
            ['⚔', 'Combate', 'inimigo-combate'], ['◈', 'Ações', 'inimigo-acoes'], ['↶', 'Reações', 'inimigo-reacoes'],
            ['⛨', 'Armadura', 'inimigo-armadura-protecao'], ['▤', 'Inventário', 'inimigo-inventario'],
          ]).map(([symbol,label,target]) => <button type="button" key={target} onClick={() => document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'start'})}><span aria-hidden="true">{symbol}</span>{label}</button>)}
        </nav>
        {renderSharedSheetCore(true)}
        {renderSharedSheetCore(true, 'armor')}
<section className="inventory-section sheet-inventory-section" id="inimigo-inventario">
  <div className="inventory-heading">
    <div><span className="sheet-page-eyebrow">EQUIPAMENTOS E RECURSOS</span><h3>Inventário</h3><p>Equipamentos e itens exclusivos de {selectedEnemy.name}.</p></div>
    <button type="button" className="primary-button" onClick={() => openEnemyItemEditor(null)}>
      + Adicionar item
    </button>
  </div>
  <div className="sheet-capacity-overview" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:12,margin:'4px 0 18px'}}>
    {([
      ['▤','Objetos',String(enemyInventory.reduce((sum,item) => sum+Math.max(1,Number(item.quantity)||1),0)),'itens na mochila'],
      ['⚖','Peso carregado',enemyTotalWeight.toFixed(1)+' kg','peso total dos itens'],
      ['🎒','Capacidade livre',(enemyMaxCapacity-enemyTotalWeight).toFixed(1)+' kg',enemyIsOverloaded?'acima do limite de carga':'disponíveis para carregar']
    ] as const).map(([icon,label,value,sub]) => (
      <div key={label} style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line,rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>{icon}</span>{label}</div>
        <strong style={{display:'block',fontSize:27,fontWeight:800,color:enemyIsOverloaded && label==='Capacidade livre'?'#ff8b8b':'var(--season-text,#f4efff)'}}>{value}</strong>
        <small style={{color:'var(--season-muted,#aaa2b5)'}}>{sub}</small>
      </div>
    ))}
    <div style={{gridColumn:'1 / -1',padding:'12px 15px',borderRadius:12,border:'1px solid var(--season-line,rgba(160,140,190,.16))',background:'var(--season-bg,rgba(10,9,15,.28))'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12,marginBottom:8}}><span>Uso da capacidade</span><strong>{Math.round(Math.min(100,enemyTotalWeight/Math.max(1,enemyMaxCapacity)*100))}%</strong></div>
      <div role="progressbar" aria-label="Capacidade utilizada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,enemyTotalWeight/Math.max(1,enemyMaxCapacity)*100)} style={{height:8,borderRadius:99,overflow:'hidden',background:'var(--season-line,rgba(160,140,190,.22))'}}>
        <div style={{height:'100%',width:Math.min(100,enemyTotalWeight/Math.max(1,enemyMaxCapacity)*100)+'%',background:enemyIsOverloaded?'linear-gradient(90deg,#e78b62,#e45f70)':'linear-gradient(90deg,var(--season-secondary,#8d70cf),var(--season-primary,#c8b5ff))'}} />
      </div>
    </div>
  </div>
  <div className="inventory-toolbar">
    <div className="category-tabs">
      {categories.map(category => <button key={category} type="button" className={enemyItemCategory===category?'category-tab selected':'category-tab'} onClick={() => setEnemyItemCategory(category)}>{category}</button>)}
    </div>
    <div className="inventory-extra-controls">
      <label className="search-box"><span>⌕</span><input value={enemyItemSearch} onChange={event=>setEnemyItemSearch(event.target.value)} placeholder="Buscar item..." aria-label="Buscar item"/><kbd>/</kbd></label>
      <button type="button" className={enemyFavoriteOnly?'category-tab selected':'category-tab'} onClick={()=>setEnemyFavoriteOnly(value=>!value)}>{enemyFavoriteOnly?'★ Favoritos':'☆ Favoritos'}</button>
      <label className="inventory-sort-label"><span>Ordenar:</span><select value={enemySortBy} onChange={event=>setEnemySortBy(event.target.value)} aria-label="Ordenar itens"><option value="created">Adicionados</option>
                        <option value="manual">Minha ordem</option><option value="name">Nome</option><option value="category">Categoria</option><option value="weight">Maior peso</option><option value="quantity">Maior quantidade</option></select></label>
    </div>
  </div>
  {(() => {
    const visible = (enemyInventory.map((item,index)=>({...item,index})) as Array<Record<string, any> & {index: number}>).filter(item => {
      const search=enemyItemSearch.trim().toLocaleLowerCase('pt-BR')
      return (!search || (String(item.name||'')+' '+String(item.description||'')).toLocaleLowerCase('pt-BR').includes(search)) &&
        (enemyItemCategory==='Todos' || (Array.isArray(item.categories)&&item.categories.includes(enemyItemCategory))) &&
        (!enemyFavoriteOnly || Boolean(item.favorite))
    }).sort((a,b)=>enemySortBy==='name'?String(a.name).localeCompare(String(b.name),'pt-BR')
      :enemySortBy==='category'?String(a.categories?.[0]||'').localeCompare(String(b.categories?.[0]||''),'pt-BR')
      :enemySortBy==='weight'?(Number(b.weight)||0)-(Number(a.weight)||0)
      :enemySortBy==='quantity'?(Number(b.quantity)||0)-(Number(a.quantity)||0)
      :a.index-b.index)
    if (!visible.length) return <div className="empty-state"><span>▤</span><h3>{enemyInventory.length?'Nenhum item encontrado':'Mochila vazia'}</h3><p>{enemyInventory.length?'Tente outra busca ou selecione outra categoria.':'Adicione o primeiro item deste inimigo.'}</p><button type="button" onClick={()=>enemyInventory.length?(setEnemyItemSearch(''),setEnemyItemCategory('Todos'),setEnemyFavoriteOnly(false)):openEnemyItemEditor(null)}>{enemyInventory.length?'Limpar filtros':'Adicionar primeiro item'}</button></div>
    return <div className="item-grid">
      {visible.map(item => <article className="item-card inventory-item-card" key={String(item.id||item.index)} style={{cursor:'pointer'}} onClick={event=>{if((event.target as HTMLElement).closest('button,input,select,textarea,a'))return;openEnemyItemEditor(item.index)}}>
        <div className="item-card-top">
          <button type="button" className="item-art" title="Editar emoji e detalhes" aria-label={`Editar \${item.name} `} onClick={event=>{event.stopPropagation();openEnemyItemEditor(item.index)}} style={{font:'inherit',fontSize:28,cursor:'pointer'}}>{String(item.emoji||'📦')}</button>
          <div className="item-actions">
            <button type="button" className="item-menu" aria-label="Favorito" title={item.favorite?'Remover dos favoritos':'Adicionar aos favoritos'} onClick={event=>{event.stopPropagation();writeEnemySheet('inventory.items',enemyInventory.map((entry,index)=>index===item.index?{...entry,favorite:!entry.favorite}:entry))}}>{item.favorite?'★':'☆'}</button>
            <button type="button" className="item-menu" aria-label="Duplicar item" title="Duplicar item" onClick={event=>{event.stopPropagation();const next=[...enemyInventory];next.splice(item.index+1,0,{...item,id:crypto.randomUUID(),name:String(item.name)+' (cópia)'});writeEnemySheet('inventory.items',next)}}>⧉</button>
            {item.equipmentType && item.equipmentType!=='none' && <button type="button" className={`item-menu equipment-card-icon \${item.equipped?'is-equipped':''}`} title={item.equipped?'Desequipar':'Equipar'} onClick={event=>{event.stopPropagation();equipEnemyItem(item.index)}}>{item.equipped?'✓':item.equipmentType==='armor'?'🛡':item.equipmentType==='protection'?'✧':'⚔'}</button>}
            <button type="button" className="item-menu" aria-label="Editar item" onClick={event=>{event.stopPropagation();openEnemyItemEditor(item.index)}}>✎</button>
            <button type="button" className="item-menu" aria-label="Excluir item" onClick={event=>{event.stopPropagation();if(window.confirm('Excluir '+String(item.name||'este item')+'?'))writeEnemySheet('inventory.items',enemyInventory.filter((_,index)=>index!==item.index))}}>×</button>
          </div>
        </div>
        <span className="item-category">{String(item.rarity||'comum').toUpperCase()}</span>
        <h3>{String(item.name||'Item sem nome')}</h3>
        <p className="item-description">{String(item.description||'Sem descrição.')}</p>
        <div className="item-tags">{(Array.isArray(item.categories)?item.categories:[]).map((category:string)=><span key={category} className="item-tag">{category}</span>)}</div>
        {item.equipmentType && item.equipmentType!=='none' && <div className="inventory-equip-status">{item.equipped?'✓ Equipado':'○ Não equipado'}</div>}
        {Array.isArray(item.categories)&&item.categories.includes('Consumíveis')&&<div className="scarcity-card"><small>{item.scarcityExhausted?'Esgotado':`Escassez: nível \${item.scarcityLevel||1}`}</small><button type="button" className="secondary-button" disabled={Boolean(item.scarcityExhausted)} onClick={event=>{event.stopPropagation();useEnemyConsumable(item.index)}}>Usar consumível</button></div>}
        <div className="item-footer"><span>⚖ {(Number(item.weight)||0).toFixed(1)} kg / un.</span><div className="quantity-controls" aria-label={`Quantidade de \${item.name}`}>
          <button type="button" className="quantity-button" disabled={(Number(item.quantity)||1)<=1} onClick={event=>{event.stopPropagation();writeEnemySheet('inventory.items',enemyInventory.map((entry,index)=>index===item.index?{...entry,quantity:Math.max(1,(Number(entry.quantity)||1)-1)}:entry))}}>−</button>
          <span className="quantity">{Math.max(1,Number(item.quantity)||1)}</span>
          <button type="button" className="quantity-button" disabled={(Number(item.quantity)||1)>=999} onClick={event=>{event.stopPropagation();writeEnemySheet('inventory.items',enemyInventory.map((entry,index)=>index===item.index?{...entry,quantity:Math.min(999,(Number(entry.quantity)||1)+1)}:entry))}}>+</button>
        </div></div>
      </article>)}
    </div>
  })()}
</section>
{enemyItemEditorOpen && createPortal(
              <div className="item-modal-overlay" onMouseDown={event => {
                if (event.target === event.currentTarget) setEnemyItemEditorOpen(false)
              }}>
                <div className="item-modal-content" role="dialog" aria-modal="true"
                  aria-label={enemyItemEditorIndex===null?'Adicionar item do inimigo':'Editar item do inimigo'}>
                  <form className="add-form item-editor-form" onSubmit={event => {
                    event.preventDefault();persistEnemyItemEditor()
                  }}>
                    <div className="form-heading"><div>
                      <h3>{enemyItemEditorIndex===null?'Novo item':'Editar item'}</h3>
                      <p>Inventário de {selectedEnemy.name} · exclusivo da campanha.</p>
                    </div><button type="button" className="secondary-button"
                      onClick={() => setEnemyItemEditorOpen(false)}>Fechar</button></div>
                    <label>Nome do item
                      <input required maxLength={100} value={String(enemyItemForm.name||'')}
                        onChange={event => setEnemyItemForm(current => ({...current,name:event.target.value}))}/>
                    </label>
                    <label>Descrição
                      <textarea maxLength={1000} rows={3} value={String(enemyItemForm.description||'')}
                        onChange={event => setEnemyItemForm(current => ({...current,description:event.target.value}))}/>
                    </label>
                    <div className="emoji-field"><label>Emoji do item</label>
                      <div className="emoji-grid">
                        {availableEmojis.map(emoji => <button key={emoji} type="button"
                          className={enemyItemForm.emoji===emoji?'emoji-option selected':'emoji-option'}
                          onClick={() => setEnemyItemForm(current => ({...current,emoji}))}>{emoji}</button>)}
                      </div>
                    </div>
                    <fieldset style={{border:'none',padding:0}}><legend>Categorias (escolha ao menos uma)</legend>
                      <div className="form-row">
                        {categories.filter(category => category!=='Todos').map(category =>
                          <label key={category} style={{display:'flex',gap:6,alignItems:'center'}}>
                            <input type="checkbox" checked={Array.isArray(enemyItemForm.categories) &&
                              enemyItemForm.categories.includes(category)}
                              onChange={event => setEnemyItemForm(current => ({...current,
                                categories:event.target.checked
                                  ? [...(current.categories || []),category]
                                  : (current.categories || []).filter((value:string)=>value!==category),
                              }))}/>{category}</label>)}
                      </div>
                    </fieldset>
                    <div className="form-row">
                      <label>Raridade<select value={String(enemyItemForm.rarity||'comum')}
                        onChange={event => setEnemyItemForm(current => ({...current,rarity:event.target.value}))}>
                        {['comum','incomum','raro','épico','mítico','relíquia'].map(value =>
                          <option key={value} value={value}>{value}</option>)}
                      </select></label>
                      <label>Quantidade<input type="number" min="1" max="999"
                        value={Number(enemyItemForm.quantity ?? 1)}
                        onChange={event => setEnemyItemForm(current => ({...current,quantity:event.target.value}))}/></label>
                      <label>Peso unitário (kg)<input type="number" step="0.1" min="0"
                        value={Number(enemyItemForm.weight ?? 0)}
                        onChange={event => setEnemyItemForm(current => ({...current,weight:event.target.value}))}/></label>
                      <label>Preço unitário<input type="number" min="0" step="0.01"
                        value={Number(enemyItemForm.unitPrice ?? 0)}
                        onChange={event => setEnemyItemForm(current => ({...current,unitPrice:event.target.value}))}/></label>
                      <label>Moeda
                        <select value={String(enemyItemForm.currencyId||'')}
                          onChange={event => setEnemyItemForm(current => ({...current,currencyId:event.target.value}))}>
                          <option value="">Sem moeda específica</option>
                          {(selectedCampaign?.currency_config?.currencies ?? []).map(currency =>
                            <option key={currency.id} value={currency.id}>
                              {currency.name} ({currency.symbol})</option>)}
                        </select>
                      </label>
                    </div>
                    {Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Equipamento') && <label>Tipo de equipamento<select value={String(enemyItemForm.equipmentType||'none')}
                      onChange={event => setEnemyItemForm(current => ({...current,equipmentType:event.target.value}))}>
                      <option value="none">Nenhum</option><option value="weapon">Arma</option>
                      <option value="armor">Armadura</option><option value="protection">Proteção</option>
                      <option value="cybernetic">Cibernético</option>
                    </select></label>}
                    {(enemyItemForm.equipmentType==='weapon' || (Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Armas')))  && <div className="form-row">
                      <label>Classe da arma<select value={String(enemyItemForm.weaponClass||'improvised')}
                        onChange={event => setEnemyItemForm(current => ({...current,weaponClass:event.target.value}))}>
                        {([['improvised','Improvisada'],['advanced','Avançada'],['special','Especial'],
                          ['black_red','Preta/Vermelha'],['mutable','Mutável']] as const).map(([value,label]) =>
                          <option key={value} value={value}>{label}</option>)}
                      </select></label>
                      <div style={{padding:10,alignSelf:'center'}}>
                        Dano da arma: <strong>{({improvised:'1d4',advanced:'1d6',special:'1d8',
                          black_red:'1d10',mutable:'1d12'} as Record<string,string>)[
                            String(enemyItemForm.weaponClass||'improvised')] || '1d4'}</strong>
                      </div>
                    </div>}
                    {Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Equipamento') && enemyItemForm.equipmentType==='armor' && <div className="form-row">
                      <label>Classe da armadura<select value={String(enemyItemForm.armorClass||'leve')}
                        onChange={event => setEnemyItemForm(current => ({...current,armorClass:event.target.value}))}>
                        <option value="leve">Leve</option><option value="media">Média</option>
                        <option value="pesada">Pesada</option>
                      </select></label>
                      <label>Cobertura<select value={String(enemyItemForm.armorCoverage||'cortante_perfurante')}
                        onChange={event => setEnemyItemForm(current => ({...current,armorCoverage:event.target.value}))}>
                        <option value="cortante_perfurante">Cortante / Perfurante</option>
                        <option value="especial_bruto">Especial / Bruto</option>
                        {!isKisatsutaiSystem && <option value="todos">Todos</option>}
                      </select></label>
                    </div>}
                    {Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Equipamento') && enemyItemForm.equipmentType==='protection' && <div className="form-row">
                      <label>Nível de proteção<select value={String(enemyItemForm.protectionTier||'basica')}
                        onChange={event => setEnemyItemForm(current => ({...current,protectionTier:event.target.value}))}>
                        <option value="basica">Básica</option><option value="moderada">Moderada</option>
                        <option value="avancada">Avançada</option>
                      </select></label>
                      <label>Modo<select value={String(enemyItemForm.protectionMode||'resistencia')}
                        onChange={event => setEnemyItemForm(current => ({...current,protectionMode:event.target.value}))}>
                        <option value="resistencia">Resistência</option>
                        <option value="sanidade">Sanidade</option>
                      </select></label>
                    </div>}
                    {Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Equipamento') && enemyItemForm.equipmentType==='cybernetic' && <div className="form-row">
                      <label>Categoria cibernética<input value={String(enemyItemForm.cyberneticCategory||'')}
                        onChange={event => setEnemyItemForm(current => ({...current,cyberneticCategory:event.target.value}))}/></label>
                      <label>Localização<input value={String(enemyItemForm.cyberneticLocation||'')}
                        onChange={event => setEnemyItemForm(current => ({...current,cyberneticLocation:event.target.value}))}/></label>
                      <label>Efeitos<textarea rows={2} value={String(enemyItemForm.cyberneticEffects||'')}
                        onChange={event => setEnemyItemForm(current => ({...current,cyberneticEffects:event.target.value}))}/></label>
                    </div>}
                    {Array.isArray(enemyItemForm.categories) && enemyItemForm.categories.includes('Consumíveis') &&
                      <div className="form-row">
                        <label>Nível de escassez<select value={String(enemyItemForm.scarcityLevel||1)}
                          onChange={event => setEnemyItemForm(current => ({...current,scarcityLevel:Number(event.target.value)}))}>
                          <option value="1">1 · d12 · carga 7</option><option value="2">2 · d8 · carga 5</option>
                          <option value="3">3 · d6 · carga 3</option><option value="4">4 · d4 · carga 1</option>
                        </select></label>
                        <label><input type="checkbox" checked={Boolean(enemyItemForm.scarcityExhausted)}
                          onChange={event => setEnemyItemForm(current => ({...current,scarcityExhausted:event.target.checked}))}/>
                          Esgotado</label>
                      </div>}
                    <div className="form-row">
                      <label><input type="checkbox" checked={Boolean(enemyItemForm.equipped)}
                        onChange={event => setEnemyItemForm(current => ({...current,equipped:event.target.checked}))}/>
                        Equipado</label>
                    </div>
                    <div className="form-row" style={{justifyContent:'flex-end'}}>
                      <button type="button" className="secondary-button"
                        onClick={() => setEnemyItemEditorOpen(false)}>Cancelar</button>
                      <button type="submit" className="primary-button">
                        {enemyItemEditorIndex===null?'Adicionar item':'Salvar item'}</button>
                    </div>
                  </form>
                </div>
              </div>,document.body)}
          {(selectedCampaign?.currency_config?.currencies?.length ?? 0) > 0 && (
            <section className="inventory-section currency-wallet" style={{marginTop:18,display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(0,.95fr)',columnGap:22,rowGap:0,alignItems:'start',width:'100%',boxSizing:'border-box',position:'relative',isolation:'isolate',overflow:'hidden',padding:24,borderRadius:24,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'radial-gradient(ellipse at 8% 0%,var(--season-accent-soft,rgba(220,135,65,.16)),transparent 42%),linear-gradient(145deg,var(--season-surface,rgba(20,18,25,.96)),var(--season-surface-alt,rgba(255,255,255,.035)))',boxShadow:'0 18px 48px rgba(0,0,0,.16)'}}>
              {(() => {
                const currencies = selectedCampaign?.currency_config?.currencies ?? []
                const wallet = readEnemySheet('wallet', {}) as Record<string, any>
                const balances: Record<string, number> = wallet.balances || {}
                const selectedId = enemyWalletCurrency || currencies[0]?.id || ''
                const fromId = enemyWalletFrom || currencies[0]?.id || ''
                const toId = enemyWalletTo || currencies[1]?.id || ''
                const conversionValue = Number(enemyWalletConversionAmount.replace(',', '.'))
                const from = currencies.find(entry => entry.id === fromId)
                const to = currencies.find(entry => entry.id === toId)
                const conversionResult = from && to && conversionValue > 0 && from.conversionRate > 0 && to.conversionRate > 0
                  ? conversionValue * from.conversionRate / to.conversionRate : null
                const history: Array<Record<string, any>> = Array.isArray(wallet.history) ? wallet.history : []
                const amount = Number(enemyWalletAmount.replace(',', '.'))
                const formatMoney = (value: number) => value.toLocaleString('pt-BR', {maximumFractionDigits:8})
                return <>
                  <div className="inventory-heading" style={{position:'relative',alignItems:'center',gap:16,marginBottom:24,paddingBottom:18,borderBottom:'1px solid var(--season-line,rgba(255,255,255,.12))'}}>
                    <div style={{display:'flex',alignItems:'center',gap:14}}>
                      <div aria-hidden="true" style={{width:58,height:58,flex:'0 0 58px',display:'grid',placeItems:'center',borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'linear-gradient(145deg,var(--season-accent-soft,rgba(220,135,65,.20)),var(--season-surface-alt,rgba(255,255,255,.04)))',fontSize:28}}>👛</div>
                      <div><h3 style={{margin:'0 0 5px',fontSize:24,fontWeight:850,letterSpacing:'-.04em'}}>Carteira</h3>
                        <p style={{margin:0,fontSize:13}}>Recursos de <strong>{selectedEnemy.name}</strong></p>
                        <small style={{display:'block',marginTop:5,opacity:.68}}>Saldos e histórico de movimentações</small>
                      </div>
                    </div>
                    <span style={{marginLeft:'auto',padding:'6px 10px',borderRadius:999,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'var(--season-surface-alt,rgba(255,255,255,.05))',fontSize:11,fontWeight:750,letterSpacing:'.08em',textTransform:'uppercase'}}>Finanças</span>
                  </div>
                  <div className="currency-tabs">
                    <button type="button" className={!enemyWalletShowHistory ? 'currency-tab active' : 'currency-tab'} onClick={() => setEnemyWalletShowHistory(false)}>👛 Carteira</button>
                    <button type="button" className={enemyWalletShowHistory ? 'currency-tab active' : 'currency-tab'} onClick={() => setEnemyWalletShowHistory(true)}>▤ Histórico</button>
                  </div>
                  {!enemyWalletShowHistory ? <>
                    <div className="currency-balances-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,210px),1fr))',gap:14,marginBottom:24}}>
                      {currencies.map((currency,index) => <div className="currency-balance" key={currency.id} style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',gap:14,minHeight:132,padding:19,borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.09)),var(--season-surface,rgba(0,0,0,.10)))'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <span style={{fontSize:12,fontWeight:700,letterSpacing:'.045em',color:'var(--season-muted,#aaa)'}}>{currency.name}</span>
                          <span aria-hidden="true" style={{width:34,height:34,display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-accent-soft,rgba(220,135,65,.16))'}}>{index===0?'◈':'◇'}</span>
                        </div>
                        <strong style={{fontSize:'clamp(25px,3.4vw,33px)',lineHeight:1.12,fontWeight:850,letterSpacing:'-.035em',fontVariantNumeric:'tabular-nums',overflowWrap:'anywhere'}}><span style={{fontSize:'.78em',opacity:.8,marginRight:5}}>{currency.symbol}</span>{formatMoney(Number(balances[currency.id])||0)}</strong>
                        <span style={{fontSize:11,color:'var(--season-muted,#aaa)'}}>Saldo disponível</span>
                      </div>)}
                    </div>
                    <div className="currency-conversion-panel" style={{display:'grid',gap:16,marginBottom:20,padding:20,borderRadius:18,border:'1px solid var(--season-line,rgba(255,255,255,.12))',background:'var(--season-surface-alt,rgba(255,255,255,.035))'}}>
                      <div><h4 style={{margin:'0 0 5px',fontSize:16}}>⇄ Converter moedas</h4><p style={{margin:0,fontSize:12,opacity:.7}}>Converta seus saldos entre as moedas da campanha.</p></div>
                      <div className="form-row">
                        <label style={labelStyle}>MOEDA DE ORIGEM<select style={inputStyle} value={fromId} onChange={event=>setEnemyWalletFrom(event.target.value)}>{currencies.map(currency=><option key={currency.id} value={currency.id}>{currency.name} ({currency.symbol})</option>)}</select></label>
                        <label style={labelStyle}>MOEDA DE DESTINO<select style={inputStyle} value={toId} onChange={event=>setEnemyWalletTo(event.target.value)}>{currencies.map(currency=><option key={currency.id} value={currency.id}>{currency.name} ({currency.symbol})</option>)}</select></label>
                      </div>
                      <label style={labelStyle}>QUANTIDADE<input style={inputStyle} type="number" min="0" step="any" value={enemyWalletConversionAmount} onChange={event=>setEnemyWalletConversionAmount(event.target.value)}/></label>
                      <p style={{margin:0,fontSize:13}}>{conversionResult===null?'Informe uma quantidade para visualizar a conversão.':`Você receberá ${to?.symbol||''} ${formatMoney(conversionResult)}`}</p>
                      <button type="button" className="primary-button" disabled={!conversionResult || fromId===toId || conversionValue > (Number(balances[fromId])||0)} onClick={()=>{convertEnemyWallet(fromId,toId,conversionValue);setEnemyWalletConversionAmount('')}}>⇄ Converter moedas</button>
                    </div>
                    <div className="currency-actions" style={{display:'grid',gap:14,padding:20,borderRadius:18,border:'1px solid var(--season-line,rgba(255,255,255,.12))',background:'var(--season-surface-alt,rgba(255,255,255,.035))'}}>
                      <div><h4 style={{margin:'0 0 5px',fontSize:16}}>Movimentar saldo</h4><p style={{margin:0,fontSize:12,opacity:.7}}>Adicione ou retire moedas desta carteira.</p></div>
                      <label style={labelStyle}>MOEDA<select style={inputStyle} value={selectedId} onChange={event=>setEnemyWalletCurrency(event.target.value)}>{currencies.map(currency=><option value={currency.id} key={currency.id}>{currency.name} ({currency.symbol})</option>)}</select></label>
                      <label style={labelStyle}>QUANTIDADE<input style={inputStyle} type="number" min="0" step="any" value={enemyWalletAmount} onChange={event=>setEnemyWalletAmount(event.target.value)}/></label>
                      <label style={labelStyle}>DESCRIÇÃO<input style={inputStyle} value={enemyWalletDescription} maxLength={150} onChange={event=>setEnemyWalletDescription(event.target.value)} placeholder="Recompensa, compra, saque..."/></label>
                      <div className="currency-buttons" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
                        <button type="button" className="primary-button currency-action-add" disabled={!selectedId || !(amount>0) || !Number.isFinite(amount)} onClick={()=>{adjustEnemyWallet(selectedId,amount,enemyWalletDescription);setEnemyWalletAmount('');setEnemyWalletDescription('')}}>+ Adicionar</button>
                        <button type="button" className="secondary-button currency-action-remove" disabled={!selectedId || !(amount>0) || !Number.isFinite(amount) || amount>(Number(balances[selectedId])||0)} onClick={()=>{adjustEnemyWallet(selectedId,-amount,enemyWalletDescription);setEnemyWalletAmount('');setEnemyWalletDescription('')}}>− Retirar</button>
                      </div>
                    </div>
                  </> : <div className="currency-history-page" style={{padding:20,borderRadius:18}}>
                    <div className="inventory-heading"><div><h3>Histórico de movimentações</h3><p>Acompanhe todas as movimentações desta carteira.</p></div></div>
                    {history.length ? <>
                      <div className="currency-history-summary" style={{marginBottom:16}}><strong>{history.length} movimentações registradas</strong></div>
                      {history.map(entry => <article className="currency-history-entry" key={String(entry.id)}>
                        <small>{entry.at?new Date(entry.at).toLocaleString('pt-BR'):'Sem data'}</small>
                        <p>{String(entry.description || 'Movimentação')}</p>
                        <strong>{Number(entry.amount)>0?'+':''}{formatMoney(Number(entry.amount)||0)} {currencies.find(currency=>currency.id===entry.currencyId)?.symbol||''}</strong>
                      </article>)}
                    </> : <p>Nenhuma movimentação registrada.</p>}
                    <button type="button" className="secondary-button" onClick={()=>setEnemyWalletShowHistory(false)}>← Voltar à carteira</button>
                  </div>}
                </>
              })()}
            </section>
          )}
          </>
    )}
  </div>
)}

  </section>
)}

          {activePage === 'player-table' && selectedCampaign && (
            <HaxTable
              campaignId={selectedCampaign.id}
              campaignName={selectedCampaign.name}
              seasonId={selectedSeasonId}
              seasons={seasons}
              onSeasonChange={setSelectedSeasonId}
              isMaster={isMaster}
              userId={session?.user.id ?? ''}
              playerName={displayName}
              characters={characters}
              enemies={isMaster ? enemies : []}
            />
          )}

          {activePage === 'master-shield' && selectedCampaign && isMaster && (
            <section className="inventory-section master-shield-page-panel hb-master-page">
              <section className="master-shield hb-ms-dashboard" aria-labelledby="master-shield-title">
                <div className="master-shield-heading hb-hero">
                  <div>
                    <span className="hb-kicker">✦ CENTRAL DE SESSÃO · ÁREA DO MESTRE</span>
                    <h2 id="master-shield-title">Escudo do Mestre<span className="hb-title-dot">.</span></h2>
                    <p>Sua mesa de comando: acompanhe os dois grupos, prepare o combate e consulte tudo o que importa durante a sessão.</p>
                    <div className="hb-hero-tags"><span>⚑ {selectedCampaign.name}</span><span>✧ {selectedCampaign.system_name || 'Sistema não definido'}</span></div>
                  </div>
                  <div className="hb-ms-hero-stamp" aria-hidden="true"><span className="master-shield-icon hb-hero-emblem">♜</span><small>PAINEL DO MESTRE</small></div>
                </div>

                <nav className="hb-ms-quicknav" aria-label="Seções do Escudo do Mestre">
                  <a href="#hb-ms-players"><span aria-hidden="true">♙</span> Party de personagens</a>
                  <a href="#hb-ms-enemies"><span aria-hidden="true">⚔</span> Party de inimigos</a>
                  <a href="#hb-ms-initiative"><span aria-hidden="true">⚡</span> Iniciativa conjunta</a>
                  <a href="#hb-ms-activities"><span aria-hidden="true">◷</span> Atividades</a>
                </nav>

                <div className="master-shield-grid hb-ms-stats">
                  <article className="master-shield-stat"><span>♙ Personagens na party</span><strong>{characters.filter(character => masterShieldSheets[character.id]?.seasonParticipation === true && masterShieldSheets[character.id]?.partyParticipation === true).length}</strong><small>Na temporada selecionada</small></article>
                  <article className="master-shield-stat"><span>⚔ Inimigos em cena</span><strong>{enemyPartyMembers.length}</strong><small>Na party de inimigos</small></article>
                  <article className="master-shield-stat hb-ms-stat-ready"><span>⚡ Iniciativas prontas</span><strong>{masterShieldInitiativeEntries.filter(entry => entry.initiative !== null).length}<em> / {masterShieldInitiativeEntries.length}</em></strong><small>Personagens e inimigos</small></article>
                  <article className="master-shield-stat hb-ms-stat-season"><span>◷ Temporada</span><strong className="hb-ms-season-name">{seasons.find(season => season.id === masterShieldSeasonId)?.name || 'Não selecionada'}</strong><small>{seasons.length} {seasons.length === 1 ? 'temporada' : 'temporadas'} disponíveis</small></article>
                </div>

                <section className="hb-ms-session-toolbar" aria-label="Controles da sessão">
                  <div className="hb-ms-session-intro"><span className="hb-kicker">CONTROLES DA SESSÃO</span><h3>Temporada ativa</h3><p>A mesma temporada é usada nas duas parties e na lista de iniciativas.</p></div>
                  <div className="hb-ms-session-actions">
                    <label htmlFor="hb-ms-season-select">Selecionar temporada
                      <select id="hb-ms-season-select" value={masterShieldSeasonId} onChange={event => setMasterShieldSeasonId(event.target.value)}>
                        <option value="">Selecione uma temporada</option>
                        {seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="secondary-button" disabled={!masterShieldSeasonId || masterShieldLoading} onClick={() => { setMasterShieldRefreshKey(value => value + 1); setEnemyPartyRefreshKey(value => value + 1) }}>↻ Atualizar parties</button>
                  </div>
                </section>

                {selectedCampaign.description && <details className="hb-ms-campaign-description"><summary>✧ Sobre esta campanha</summary><p>{selectedCampaign.description}</p></details>}

                <div className="hb-ms-group-heading" aria-label="Grupos da sessão">
                  <div className="hb-ms-group-heading-left"><span className="hb-ms-group-index" aria-hidden="true">01</span><div><span className="hb-kicker">ELENCO DO ENCONTRO</span><h3>Grupos em cena</h3><p>Seus personagens e seus adversários, lado a lado na batalha e organizados em painéis iguais.</p></div></div>
                  <div className="hb-ms-legend" aria-label="Tipos de participantes"><span><i className="hb-ms-legend-dot players"/> Personagens</span><span><i className="hb-ms-legend-dot enemies"/> Inimigos</span></div>
                </div>
                <div className="hb-ms-party-layout">
                  <section className="hb-ms-pane hb-ms-party-main" id="hb-ms-players" aria-labelledby="hb-ms-players-heading">
                    <div className="hb-ms-pane-heading"><div><span className="hb-kicker">PERSONAGENS E RECURSOS</span><h3 id="hb-ms-players-heading">♙ Party dos personagens</h3><p>Visualize PV, PS e os demais recursos diretamente das fichas.</p></div><span className="hb-ms-section-count">{characters.filter(character => masterShieldSheets[character.id]?.seasonParticipation === true && masterShieldSheets[character.id]?.partyParticipation === true).length} ativos</span></div>
                    {masterShieldLoading ? <p className="master-shield-empty">Carregando personagens...</p> : !masterShieldSeasonId ? <p className="master-shield-empty">Selecione uma temporada para visualizar os personagens.</p> : characters.length ? <div className="master-shield-character-list">{characters.map(character => {
                      const data = masterShieldSheets[character.id]
                      if (
  !data ||
  data.seasonParticipation !== true ||
  data.partyParticipation !== true
) return null
                      const tierKey = String(data.family?.tier ?? '5')
                      const rankId = String(data.progression?.rankId ?? 'zaidan')
                      const maximums = calculateSheetResourceMaximums(data, {
                        skillPointConfig: activeSystem?.data?.skillPoints,
                        usesFamilyTiers: systemFeatures.usesFamilyTiers ?? false,
                        familyTier: systemFeatures.usesFamilyTiers ? getSystemFamilyTier(tierKey) : null,
                        familyBreathingBonus: systemFeatures.usesFamilyTiers
                          ? getSystemAttributeBonus(tierKey, 'breathing') : 0,
                        rankStatus: systemFeatures.usesRanks
                          ? getSystemRankStatus(rankId) : null,
                      })
                      const maxes = maximums
                      const current = data.status?.current ?? {}
                      const stats = ([['PV',maxes.pv],['PS',maxes.ps],[resourceAbbreviation,maxes.pr]] as const).map(([key,max]) => {
                        const id = key === 'PV' ? 'pv' : key === 'PS' ? 'ps' : 'pr'
                        const saved = Number(current[id] ?? max)
                        const rawValue = Number.isFinite(saved) ? saved : max
                        // PV pode ultrapassar o máximo normal; PS e PR continuam limitados.
                        const value=Math.max(0,key==='PV'?rawValue:Math.min(max,rawValue))
                        const extra=key==='PV'?Math.max(0,value-max):0
                        return {key,max,value,extra,pct:max>0?Math.min(100,value/max*100):0,extraPct:max>0?Math.min(100,extra/max*100):0}
                      })
                      return <button type="button" className="master-shield-character hb-ms-player-card" key={character.id} onClick={() => { setSelectedSeasonId(masterShieldSeasonId); setSelectedCharacterId(character.id); setSheetCharacterView(true); setActivePage('sheets') }}><div className="master-shield-character-title hb-ms-player-identity"><span className="hb-ms-player-avatar" aria-hidden="true">{character.emoji || '🧑'}</span><span className="hb-ms-player-copy"><strong>{character.name}</strong><small>{String(data.progression?.rankName || getSystemRankName(rankId) || character.archetype || 'Sem graduação')}</small></span><span className="hb-ms-card-arrow" aria-hidden="true">↗</span></div><div className="hb-ms-resource-heading"><span>RECURSOS ATUAIS</span><span>ATUAL / MÁX.</span></div><div className="master-shield-bars">{stats.map(stat=><div className="master-shield-bar-row" key={stat.key}><span>{stat.key}</span><strong>{stat.value} / {stat.max}</strong><div className="master-shield-bar"><i style={{width:`${stat.pct}%`}}/></div>{stat.extra>0&&<><span className="master-shield-extra-name">PV Ex.</span><strong className="master-shield-extra-value">+ {stat.extra}</strong><div className="master-shield-bar master-shield-bar-extra"><i style={{width:`${stat.extraPct}%`}}/></div></>}</div>)}</div><small className="master-shield-open-hint">Ver ficha completa <span aria-hidden="true">↗</span></small></button>
                    })}{!characters.some(character =>
  masterShieldSheets[character.id]?.seasonParticipation === true &&
  masterShieldSheets[character.id]?.partyParticipation === true
) && (
  <p className="master-shield-empty">
    Nenhum personagem participa da Party nesta temporada.
  </p>
)}</div> : <p className="master-shield-empty">Ainda não há personagens cadastrados.</p>}
                  </section>
                <section className="hb-enemy-party hb-ms-enemy-section" id="hb-ms-enemies" aria-labelledby="hb-enemy-party-heading">
  <style>{`
    .hb-enemy-party{grid-column:1/-1;min-width:0;margin-top:8px;padding:clamp(16px,2vw,25px);border-radius:22px;border:1px solid var(--season-line,rgba(255,255,255,.13));background:linear-gradient(140deg,var(--season-surface,rgba(18,16,23,.94)),var(--season-surface-alt,rgba(255,255,255,.04)))}
    .hb-enemy-party *{box-sizing:border-box}
    .hb-enemy-party-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .hb-enemy-party-header h3{font-size:clamp(19px,2.1vw,25px);letter-spacing:-.04em;margin:3px 0 6px}
    .hb-enemy-party-header p{margin:0;max-width:580px;font-size:12px;line-height:1.55;color:var(--season-muted,#aaa)}
    .hb-enemy-party-kicker{font-size:10px;font-weight:800;color:var(--season-accent,#d7a184);letter-spacing:.15em}
    .hb-enemy-party-counter{padding:8px 13px;border-radius:99px;border:1px solid var(--season-line,rgba(255,255,255,.15));font-size:12px;font-weight:750}
    .hb-enemy-party-pickers{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:18px}
    .hb-enemy-party-pickers label{display:grid;gap:6px;min-width:200px;flex:1;font-size:11px;color:var(--season-muted,#bbb)}
    .hb-enemy-party-pickers select{min-height:41px;width:100%;padding:9px 11px;background:var(--season-surface-alt,var(--season-surface,#222));border:1px solid var(--season-line,rgba(255,255,255,.2));border-radius:11px;color:inherit}
    .hb-enemy-party-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:13px}
    .hb-enemy-party-card{min-width:0;padding:17px;border:1px solid var(--season-line,rgba(255,255,255,.13));border-radius:17px;background:var(--season-surface-alt,rgba(255,255,255,.04));display:grid;gap:14px}
    .hb-enemy-party-card-head{display:flex;align-items:center;gap:11px;min-width:0}
    .hb-enemy-party-avatar{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;border-radius:14px;background:var(--season-accent-soft,rgba(220,160,115,.13));font-size:27px}
    .hb-enemy-party-card-head strong{display:block;font-size:15px;overflow-wrap:anywhere}
    .hb-enemy-party-card-head small{display:block;margin-top:4px;opacity:.7;font-size:11px}
    .hb-enemy-party-resources{display:grid;gap:9px}
    .hb-enemy-party-resource{display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:center;font-size:11px}
    .hb-enemy-party-resource>span{font-weight:850}
    .hb-enemy-party-resource>strong{font-size:11px;font-variant-numeric:tabular-nums}
    .hb-enemy-party-track{height:6px;border-radius:20px;background:rgba(128,128,128,.2);overflow:hidden}
    .hb-enemy-party-track>i{display:block;height:100%;background:var(--season-primary,var(--season-accent,#bd9b73));border-radius:20px;transition:width .2s}
    .hb-enemy-party-resource.blood .hb-enemy-party-track>i{background:#c34c55}
    .hb-enemy-party-actions{display:flex;gap:8px;flex-wrap:wrap}
    .hb-enemy-party-actions button{flex:1;min-height:35px;font-size:11px}
    .hb-enemy-party-initiative{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:14px}
    .hb-enemy-party-initiative label{display:grid;gap:6px;flex:1;min-width:105px;font-size:11px}
    .hb-enemy-party-initiative input{width:100%;min-height:35px;padding:6px 9px;border-radius:9px;background:var(--season-surface-alt,var(--season-surface,#222));border:1px solid var(--season-line,rgba(255,255,255,.17));color:inherit;font:inherit}
    .hb-enemy-party-initiative button{min-height:35px;font-size:11px}
    .hb-enemy-party-order{margin-top:20px;border-top:1px solid var(--season-line,rgba(255,255,255,.12));padding-top:16px}
    .hb-enemy-party-order h4{margin:0 0 12px;font-size:15px}
    .hb-enemy-party-order-list{display:grid;gap:7px}
    .hb-enemy-party-order-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:11px;background:var(--season-surface-alt,rgba(255,255,255,.045))}
    .hb-enemy-party-order-row strong{font-variant-numeric:tabular-nums}
    .hb-enemy-party-empty{margin:8px 0 0;padding:17px;text-align:center;border:1px dashed var(--season-line,rgba(255,255,255,.22));border-radius:13px;color:var(--season-muted,#aaa);font-size:12px;line-height:1.5}
    @media(max-width:620px){.hb-enemy-party{padding:14px}.hb-enemy-party-header{gap:10px}.hb-enemy-party-card{padding:13px}.hb-enemy-party-pickers select{min-width:0}}
  `}</style>
  <div className="hb-enemy-party-header">
    <div><span className="hb-enemy-party-kicker">⚔ ENCONTROS E AMEAÇAS</span>
      <h3 id="hb-enemy-party-heading">⚔ Party dos inimigos</h3>
      <p>Gerencie os adversários da temporada, confira PV, PS e SG e controle a iniciativa de cada um.</p>
    </div>
    <span className="hb-enemy-party-counter hb-ms-section-count">{enemyPartyMembers.length} {enemyPartyMembers.length === 1 ? 'ativo' : 'ativos'}</span>
  </div>
  {!masterShieldSeasonId ? <p className="hb-enemy-party-empty">Selecione uma temporada na Party acima para administrar os inimigos.</p> : <>
    <div className="hb-enemy-party-pickers">
      <label>Adicionar inimigo à party
        <select aria-label="Adicionar inimigo à Party de Inimigos" value="" disabled={enemyPartySavingId !== null || enemies.every(enemy => getEnemyPartySeason(enemy, masterShieldSeasonId).participating)}
          onChange={event => { if (event.target.value) void updateEnemyPartySeason(event.target.value, masterShieldSeasonId, { participating: true }) }}>
          <option value="">Selecione um inimigo...</option>
          {enemies.filter(enemy => !getEnemyPartySeason(enemy, masterShieldSeasonId).participating)
            .map(enemy => <option value={enemy.id} key={enemy.id}>{enemy.emoji || '👹'} {enemy.name}</option>)}
        </select>
      </label>
      <button type="button" className="secondary-button" disabled={enemyPartySavingId !== null} onClick={() => setEnemyPartyRefreshKey(value => value + 1)}>↻ Atualizar inimigos</button>
    </div>
    {!enemies.length ? <p className="hb-enemy-party-empty">Nenhum inimigo cadastrado. Use “Inimigos da campanha” para criar a primeira ficha.</p>
      : !enemyPartyMembers.length ? <p className="hb-enemy-party-empty">Nenhum inimigo adicionado a esta temporada. Escolha um na lista acima para começar.</p>
      : <>
        <div className="hb-enemy-party-grid">{enemyPartyMembers.map(enemy => {
          const status = getEnemySheetOverview(enemy)
          const party = getEnemyPartySeason(enemy, masterShieldSeasonId)
          const busy = enemyPartySavingId !== null
          const resources = ([
            { label: 'PV', current: status.pv, max: status.maxPV },
            { label: 'PS', current: status.ps, max: status.maxPS },
            { label: enemyResourceAbbreviation, current: status.pr, max: status.maxPR },
          ])
          return <article key={enemy.id} className="hb-enemy-party-card">
            <div className="hb-enemy-party-card-head">
              <span className="hb-enemy-party-avatar" aria-hidden="true">{enemy.emoji || '👹'}</span>
              <div><strong>{enemy.name}</strong><small>{enemy.archetype || 'Sem arquétipo'} · Inimigo ativo</small></div>
            </div>
            <div className="hb-ms-resource-heading"><span>RECURSOS ATUAIS</span><span>ATUAL / MÁX.</span></div><div className="hb-enemy-party-resources">{resources.map(resource => <div className={`hb-enemy-party-resource${resource.label === 'SG' ? ' blood' : ''}`} key={resource.label}>
              <span>{resource.label}</span><div className="hb-enemy-party-track" aria-hidden="true"><i style={{width: `${resource.max > 0 ? Math.max(0, Math.min(100, resource.current / resource.max * 100)) : 0}%`}} /></div>
              <strong>{resource.current} / {resource.max}</strong>
            </div>)}</div>
            <div className="hb-enemy-party-initiative"><label>Iniciativa
              <input type="number" step="1" aria-label={`Iniciativa de ${enemy.name}`} placeholder="Não rolou"
                value={enemyPartyInitiativeDrafts[enemy.id] ?? (party.initiative === null ? '' : String(party.initiative))}
                onChange={event => setEnemyPartyInitiativeDrafts(current => ({ ...current, [enemy.id]: event.target.value }))}
                disabled={busy} />
              </label>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => rollEnemyPartyInitiative(enemy)}>⚡ Rolar</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => {
                const text = enemyPartyInitiativeDrafts[enemy.id] ?? (party.initiative === null ? '' : String(party.initiative))
                if (text.trim() && !Number.isFinite(Number(text))) { setError('Informe uma iniciativa válida.'); return }
                void updateEnemyPartySeason(enemy.id, masterShieldSeasonId, { initiative: text.trim() ? Math.floor(Number(text)) : null })
              }}>Salvar</button>
            </div>
            <div className="hb-enemy-party-actions">
              <button type="button" className="primary-button" onClick={() => { setSelectedEnemyId(enemy.id); setEnemySheetView(true); setActivePage('enemies') }}>Abrir ficha ↗</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void updateEnemyPartySeason(enemy.id, masterShieldSeasonId, { participating: false })}>Remover da party</button>
            </div>
          </article>
        })}</div>
      </>}
  </>}
</section>


                </div>

                <section className="hb-ms-pane hb-ms-initiative-section" id="hb-ms-initiative" aria-labelledby="hb-ms-initiative-heading">
                  <div className="hb-ms-pane-heading">
                    <div>
                      <span className="hb-kicker">02 · ORDEM DE COMBATE</span>
                      <h3 id="hb-ms-initiative-heading">⚡ Iniciativa da batalha</h3>
                      <p>Personagens e inimigos juntos, da maior iniciativa para a menor.</p>
                    </div>
                    <span className="hb-ms-section-count">{masterShieldInitiativeEntries.filter(entry => entry.initiative !== null).length} de {masterShieldInitiativeEntries.length} prontos</span>
                  </div>
                  {masterShieldSeasonId && (
                    <div className="hb-ms-initiative-content">
                      <div className="hb-ms-initiative-toolbar">
                        <p>As iniciativas continuam salvas nas fichas de origem de cada participante.</p>
                        <button type="button" className="secondary-button" style={{ padding: '8px 12px', fontSize: 12 }}
                          disabled={sheetSaving || enemyPartySavingId !== null || masterShieldLoading ||
                            !masterShieldInitiativeEntries.some(entry => entry.initiative !== null)}
                          onClick={() => void clearAllMasterShieldInitiatives(masterShieldSeasonId)}>
                          ↺ Limpar iniciativas
                        </button>
                      </div>
                      {masterShieldLoading && <p className="master-shield-empty">Carregando iniciativas dos personagens...</p>}
                      {!masterShieldLoading && !masterShieldInitiativeEntries.length &&
                        <p className="master-shield-empty">Nenhum personagem ou inimigo participa desta batalha.</p>}
                      {!masterShieldLoading && masterShieldInitiativeEntries.length > 0 &&
                        <div className="hb-ms-combined-initiative-list">
                          {masterShieldInitiativeEntries.map((entry, index) => (
                            <div className={`hb-ms-initiative-row hb-ms-initiative-${entry.kind}${index === 0 && entry.initiative !== null ? ' hb-ms-initiative-leader' : ''}`} key={`${entry.kind}-${entry.id}`}>
                              <div className="hb-ms-initiative-identity">
                                <strong className="hb-ms-initiative-rank" aria-label={`${index + 1}ª posição`}>{index + 1}<small>º</small></strong>
                                <span className="hb-ms-initiative-avatar" aria-hidden="true">{entry.emoji || (entry.kind === 'enemy' ? '👹' : '🧑')}</span>
                                <div className="hb-ms-initiative-person">
                                  <strong>{entry.name}</strong>
                                  <small>{entry.kind === 'enemy' ? '⚔ Inimigo' : '♙ Personagem'}</small>
                                </div>
                              </div>
                              <div className="hb-ms-initiative-score">
                                <strong className={entry.initiative === null ? 'pending' : ''}>
                                  {entry.initiative ?? 'Não rolou'}
                                </strong>
                                {entry.initiative !== null && (
                                  <button type="button" className="secondary-button"
                                    disabled={sheetSaving || enemyPartySavingId !== null}
                                    onClick={() => entry.kind === 'enemy'
                                      ? void updateEnemyPartySeason(entry.id, masterShieldSeasonId, { initiative: null },
                                        `Iniciativa de ${entry.name} removida.`)
                                      : void clearCharacterInitiative(entry.id, masterShieldSeasonId)}>
                                    Limpar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>}
                    </div>
                  )}
                  {!masterShieldSeasonId && <p className="master-shield-empty">Selecione uma temporada para conferir as iniciativas.</p>}
                </section>

                <div className="hb-ms-support-heading"><span className="hb-ms-group-index" aria-hidden="true">03</span><div><span className="hb-kicker">ACOMPANHAMENTO</span><h3>Equipe e histórico</h3></div></div>
                <div className="hb-ms-support-grid">
                  <aside className="hb-ms-pane hb-ms-party-members" aria-label="Integrantes da party">
                    <div className="hb-ms-pane-heading"><div><span className="hb-kicker">EQUIPE DA CAMPANHA</span><h3>✦ Integrantes</h3><p>Jogadores vinculados à party de personagens.</p></div><span className="hb-ms-section-count">{masterShieldPartyMembers.length} membros</span></div>
                    {masterShieldPartyMembers.length
                      ? <ul className="hb-ms-member-list">{masterShieldPartyMembers.map(member => <li key={member.user_id}><span className="hb-ms-member-avatar" aria-hidden="true">{member.display_name.charAt(0).toUpperCase()}</span><span className="hb-ms-member-name">{member.display_name}</span><small>{member.role === 'master' ? 'Mestre' : 'Jogador'}</small></li>)}</ul>
                      : <p className="master-shield-empty">Nenhum integrante encontrado nesta party.</p>}
                  </aside>

                <section className="campaign-activity-panel hb-ms-activity-section" id="hb-ms-activities" aria-labelledby="hb-ms-activity-heading">
  <div className="campaign-activity-heading">
    <div>
      <h3 id="hb-ms-activity-heading">Atividades recentes</h3>
      <p>Acompanhe as novidades desta campanha.</p>
    </div>
    <span>{campaignActivities.length} registros</span>
  </div>

  {activityLoading ? (
    <p className="master-shield-empty">Carregando atividades...</p>
  ) : activityTableMissing ? (
    <p className="master-shield-empty">O histórico ficará disponível assim que a tabela de atividades for criada no Supabase.</p>
  ) : campaignActivities.length > 0 ? (
  <>
    <ul className="campaign-activity-list">
      {campaignActivities
        .slice(0, showAllCampaignActivities ? campaignActivities.length : 5)
        .map(activity => (
          <li key={activity.id}>
            <span className="campaign-activity-marker" aria-hidden="true">•</span>
            <div className="campaign-activity-content">
              <strong>{activity.title}</strong>
              {activity.description && <p>{activity.description}</p>}
              <small>
                {activity.actor_name} · {new Date(activity.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </small>
            </div>
          </li>
        ))}
    </ul>

    {campaignActivities.length > 5 && (
      <button
        type="button"
        className="secondary-button"
        onClick={() => setShowAllCampaignActivities(value => !value)}
      >
        {showAllCampaignActivities ? 'Mostrar menos' : 'Atividades completas'}
      </button>
    )}
  </>
  ) : (
    <p className="master-shield-empty">Nenhuma atividade registrada ainda.</p>
  )}
</section>
                </div>
              </section>
            </section>
          )}

          {activePage === 'sheets' && selectedCampaignId && (
            <section className="inventory-section sheet-page-panel">
            
              {!sheetCharacterView ? <>
                <div className="inventory-heading sheet-page-hero sheet-page-hero-library sheet-roster-hero">
                  <div className="sheet-page-hero-leading">
                    <span className="sheet-page-hero-icon sheet-roster-hero-emblem" aria-hidden="true">◈</span>
                    <div className="sheet-roster-hero-copy">
                      <span className="sheet-page-eyebrow">◈ ARQUIVO DA CAMPANHA · {selectedCampaign?.name ?? 'Campanha'}</span>
                      <h2>Fichas de personagens</h2>
                      <p>Seu elenco em um só lugar. Encontre protagonistas, acompanhe suas funções e abra uma ficha em instantes.</p>
                      <div className="sheet-roster-hero-meta"><span><i aria-hidden="true" />{activeSystem?.name ?? 'RPG'}</span><span>{characters.length} {characters.length === 1 ? 'personagem registrado' : 'personagens registrados'}</span></div>
                    </div>
                  </div>
                  <div className="sheet-library-toolbar">
                    {isMaster && <button type="button" className="secondary-button sheet-library-manage-button" onClick={() => { setShowCharacterManagement(value => !value); setShowCharacterForm(false) }} aria-pressed={showCharacterManagement}>
                      {showCharacterManagement ? '✓ Concluir gerenciamento' : '⚙ Gerenciar'}
                    </button>}
                    {!showCharacterManagement && <button type="button" className="primary-button sheet-library-create-button" onClick={() => setShowCharacterForm(value => !value)} aria-expanded={showCharacterForm}>
                      {showCharacterForm ? '✕ Fechar criação' : '+ Criar personagem'}
                    </button>}
                  </div>
                </div>
                <div className="sheet-roster-overview" aria-label="Resumo da campanha">
                  <div className="sheet-roster-stat"><span className="sheet-roster-stat-icon" aria-hidden="true">♙</span><div><small>PERSONAGENS</small><strong>{characters.length}</strong><span>no arquivo</span></div></div>
                  <div className="sheet-roster-stat"><span className="sheet-roster-stat-icon" aria-hidden="true">◉</span><div><small>COM JOGADOR</small><strong>{sheetCharactersWithPlayer}</strong><span>atribuídos</span></div></div>
                  <div className="sheet-roster-stat"><span className="sheet-roster-stat-icon" aria-hidden="true">✦</span><div><small>MEUS PERSONAGENS</small><strong>{sheetMyCharacters}</strong><span>criados ou atribuídos</span></div></div>
                  <div className="sheet-roster-stat"><span className="sheet-roster-stat-icon" aria-hidden="true">◇</span><div><small>ARQUÉTIPOS</small><strong>{sheetArchetypes.length}</strong><span>no grupo</span></div></div>
                </div>
                {showCharacterManagement && isMaster && <div className="sheet-library-admin-notice"><span aria-hidden="true">⚙</span><div><strong>Gerenciamento de personagens</strong><p>Exclua personagens usando os controles dos cartões. A gestão de acessos e permissões continua em Campanhas.</p></div><button type="button" className="secondary-button" onClick={() => setActivePage('campaigns')}>Acessos e permissões ↗</button></div>}
    {!showCharacterManagement && showCharacterForm && (
      <form className="add-form hb-form hb-character-form" onSubmit={createCharacter}>
        <div className="hb-form-heading"><span className="hb-heading-icon">✦</span><div><span className="hb-kicker">NOVO PROTAGONISTA</span><h3>Criar personagem</h3><p>Defina identidade, arquétipo e progressão inicial.</p></div></div>
        <label>
          Nome
          <input
            value={characterName}
            onChange={e => setCharacterName(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <div className="emoji-field">
          <label>Emoji do personagem</label>
          <div className="emoji-grid">
            {availableEmojis.map((emoji) => (
              <button key={emoji} type="button" className={characterEmoji === emoji ? 'emoji-option selected' : 'emoji-option'} onClick={() => setCharacterEmoji(emoji)} aria-label={`Selecionar emoji ${emoji}`} aria-pressed={characterEmoji === emoji}>{emoji}</button>
            ))}
          </div>
          <small>Selecione um dos emojis disponíveis para representar o personagem.</small>
        </div>

{systemFeatures.usesRanks ? (
  <>
    <label>
      Arquétipo primário
      <select
        value={primaryArchetype}
        onChange={e => setPrimaryArchetype(e.target.value)}
        required
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {systemArchetypes.map(item => (
          <option
            key={item}
            value={item}
            disabled={
              (item === 'Linha de Frente' && secondaryArchetype === 'Suporte') ||
              (item === 'Suporte' && secondaryArchetype === 'Linha de Frente') ||
              (item === 'Defensor' && secondaryArchetype === 'Flanco') ||
              (item === 'Flanco' && secondaryArchetype === 'Defensor')
            }
          >
            {item}
          </option>
        ))}
      </select>
    </label>

    <label>
      Arquétipo secundário
      <select
        value={secondaryArchetype}
        onChange={e => setSecondaryArchetype(e.target.value)}
        required
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {systemArchetypes.map(item => (
          <option
            key={item}
            value={item}
disabled={
  item === primaryArchetype ||
  (item === 'Linha de Frente' && primaryArchetype === 'Suporte') ||
  (item === 'Suporte' && primaryArchetype === 'Linha de Frente') ||
  (item === 'Defensor' && primaryArchetype === 'Flanco') ||
  (item === 'Flanco' && primaryArchetype === 'Defensor')
}
          >
            {item}
          </option>
        ))}
      </select>
    </label>
  </>
) : (
  <label>
    Arquétipo
    <input
      value={archetype}
      onChange={e => setArchetype(e.target.value)}
      style={inputStyle}
    />
  </label>
)}

{systemFeatures.usesRanks ? (
  <label>
    Graduação
    <select
      value={characterRank}
      onChange={(event) => setCharacterRank(event.target.value)}
      required
    >
      {systemRanks.map(rank => (
        <option key={rank.id} value={rank.id}>
          {rank.name}
        </option>
      ))}
    </select>
  </label>
) : (
  <label>
    Nível
    <input
      type="number"
      min="1"
      max="999"
      value={characterLevel}
      onChange={(event) => setCharacterLevel(event.target.value)}
      required
    />
  </label>
)}

{systemFeatures.usesFamilyTiers && (
  <label>
    Tier da família
    <select
      value={characterFamilyTier}
      onChange={event => setCharacterFamilyTier(event.target.value)}
      required
      style={inputStyle}
    >
      {getSystemFamilyTiers().map(([key, value]) => (
        <option key={key} value={key}>
          {value.label}
        </option>
      ))}
    </select>
  </label>
)}

        <button className="primary-button" type="submit" disabled={loading}>
          Salvar personagem
        </button>
      </form>
    )}
                {characters.length > 0 && <section className="sheet-roster-browser" aria-label="Explorar fichas de personagens">
                  <div className="sheet-roster-filterbar">
                    <div className="sheet-roster-search">
                      <label htmlFor="sheet-character-search">Buscar no elenco</label>
                      <div className="sheet-roster-search-input"><span aria-hidden="true">⌕</span>
                        <input id="sheet-character-search" type="search" placeholder="Nome, arquétipo ou graduação..." autoComplete="off" value={sheetCharacterSearch} onChange={event => setSheetCharacterSearch(event.target.value)} />
                        {sheetCharacterSearch && <button type="button" onClick={() => setSheetCharacterSearch('')} title="Limpar busca" aria-label="Limpar busca">✕</button>}
                      </div>
                    </div>
                    <label className="sheet-roster-select">Arquétipo
                      <select value={sheetCharacterArchetype} onChange={event => setSheetCharacterArchetype(event.target.value)}>
                        <option value="all">Todos os arquétipos</option>
                        {sheetArchetypes.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </label>
                    <label className="sheet-roster-select">Temporada
                      <select value={sheetSeasonFilter} onChange={event => {setSheetSeasonFilter(event.target.value);setSheetTeamFilter('all')}}>
                        <option value="all">Todas as temporadas</option>
                        {seasons.map(season => <option key={season.id} value={season.id}>{season.name}</option>)}
                      </select>
                    </label>
                    <label className="sheet-roster-select">Equipe
                      <select value={sheetTeamFilter} onChange={event => setSheetTeamFilter(event.target.value)}>
                        <option value="all">Todas as equipes</option>
                        <option value="party">Na equipe / Party</option>
                        <option value="outside">Fora da equipe / Party</option>
                        {sheetTeams.map(team => <option key={team} value={`team:${team}`}>{team}</option>)}
                      </select>
                    </label>
                    <label className="sheet-roster-select">Vínculo
                      <select value={sheetCharacterOwnerFilter} onChange={event => setSheetCharacterOwnerFilter(event.target.value as 'all' | 'mine' | 'assigned' | 'unassigned')}>
                        <option value="all">Todos os personagens</option>
                        <option value="mine">Meus personagens</option>
                        {isMaster && <option value="assigned">Com jogador atribuído</option>}
                        {isMaster && <option value="unassigned">Sem jogador atribuído</option>}
                      </select>
                    </label>
                    <label className="sheet-roster-select sheet-roster-sort">Ordenar por
                      <select value={sheetCharacterSort} onChange={event => setSheetCharacterSort(event.target.value as 'name' | 'recent' | 'level' | 'favorites')}>
                        <option value="name">Nome (A–Z)</option>
                        <option value="recent">Mais recentes</option>
                        {!systemFeatures.usesRanks && <option value="level">Maior nível</option>}
                        <option value="favorites">Favoritos primeiro</option>
                      </select>
                    </label>
                  </div>
                  <div className="sheet-roster-subbar">
                    <div className="sheet-roster-subbar-start">
                      <strong>Personagens <span>{sheetFilteredCharacters.length}</span></strong>
                      <button type="button" className={`sheet-roster-favorites-filter${sheetOnlyFavorites ? ' is-active' : ''}`} aria-pressed={sheetOnlyFavorites} onClick={() => setSheetOnlyFavorites(value => !value)}><span aria-hidden="true">☆</span> Favoritos</button>
                      {sheetHasActiveFilters && <button type="button" className="sheet-roster-clear" onClick={resetSheetFilters}>Limpar filtros <span aria-hidden="true">×</span></button>}
                    </div>
                    <div className="sheet-roster-subbar-end">
                      <span>{sheetFilteredCharacters.length} de {characters.length}</span>
                      <div className="sheet-roster-view-switch" role="group" aria-label="Modo de visualização">
                        <button type="button" className={sheetCharacterLayout === 'grid' ? 'is-active' : ''} aria-pressed={sheetCharacterLayout === 'grid'} title="Visualizar em cartões" onClick={() => setSheetCharacterLayout('grid')}>▦ <span>Grade</span></button>
                        <button type="button" className={sheetCharacterLayout === 'list' ? 'is-active' : ''} aria-pressed={sheetCharacterLayout === 'list'} title="Visualizar em lista" onClick={() => setSheetCharacterLayout('list')}>☷ <span>Lista</span></button>
                      </div>
                    </div>
                  </div>
                </section>}
                {characters.length === 0 ? (
                  <div className="empty-state sheet-library-empty sheet-roster-empty">
                    <span className="sheet-roster-empty-icon" aria-hidden="true">♙</span>
                    <h3>O elenco ainda está vazio</h3><p>Os personagens da campanha aparecerão aqui. Crie o primeiro e comece a contar a história.</p>
                    {!showCharacterForm && !showCharacterManagement && <button type="button" className="primary-button" onClick={() => setShowCharacterForm(true)}>+ Criar primeiro personagem</button>}
                  </div>
                ) : sheetFilteredCharacters.length === 0 ? (
                  <div className="sheet-roster-no-results" role="status">
                    <span aria-hidden="true">⌕</span><h3>Nenhum personagem encontrado</h3>
                    <p>Experimente outro termo ou remova os filtros para visualizar todo o elenco.</p>
                    <button type="button" className="secondary-button" onClick={resetSheetFilters}>Limpar todos os filtros</button>
                  </div>
                ) : (
                  <div className={`sheet-library-grid sheet-roster-grid${sheetCharacterLayout === 'list' ? ' is-list' : ''}`}>
                    {sheetFilteredCharacters.map(character => {
                      const isFavorite = sheetFavoriteSet.has(character.id)
                      const isMine = sheetCharacterIsMine(character)
                      const player = character.current_player_id ? campaignMembers.find(member => member.user_id === character.current_player_id) : undefined
                      const characterRoleText = character.current_player_id ? (player?.display_name || (isMine ? 'Você' : 'Jogador atribuído')) : 'Sem jogador atribuído'
                      const rank = characterRanks[character.id] || 'Não definida'
                      return <article className={`sheet-library-card sheet-roster-card${isFavorite ? ' is-favorite' : ''}${selectedCharacterId === character.id ? ' is-current' : ''}`} key={character.id}>
                        <div className="sheet-roster-card-accent" aria-hidden="true" />
                        <div className="sheet-library-top sheet-roster-card-top">
                          <button type="button" className="sheet-library-avatar sheet-library-avatar-edit" onClick={() => openCharacterEmojiPicker(character)} title={`Alterar emoji de ${character.name}`} aria-label={`Alterar emoji de ${character.name}`}>{character.emoji || '⚔️'}</button>
                          <div className="sheet-roster-card-top-actions">
                            {isMine && <span className="sheet-roster-mine" title="Criado por você ou atribuído a você">MEU</span>}
                            <button type="button" className={`sheet-roster-star${isFavorite ? ' is-active' : ''}`} onClick={() => toggleSheetFavorite(character.id)} aria-pressed={isFavorite} title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-label={`${isFavorite ? 'Remover' : 'Adicionar'} ${character.name} ${isFavorite ? 'dos' : 'aos'} favoritos`}>{isFavorite ? '★' : '☆'}</button>
                          </div>
                        </div>
                        <div className="sheet-library-info sheet-roster-card-info">
                          <span className="sheet-page-eyebrow">{systemFeatures.usesRanks ? 'PERSONAGEM' : `NÍVEL ${character.level}`}<span className="sheet-roster-campaign-signature"> // {(selectedCampaign?.name?.trim() || 'CAMPANHA').toLocaleUpperCase('pt-BR')}</span></span>
                          <h3>{character.name}</h3>
                          <p>{character.archetype?.trim() || 'Arquétipo não definido'}</p>
                        </div>
                        <div className="sheet-roster-card-details">
                          <div><span>{systemFeatures.usesRanks ? 'GRADUAÇÃO' : 'PROGRESSÃO'}</span><strong>{systemFeatures.usesRanks ? rank : `Nível ${character.level}`}</strong></div>
                          <div><span>JOGADOR</span><strong title={characterRoleText}>{characterRoleText}</strong></div>
                        </div>
                        <div className="sheet-roster-card-footer">
                          <button type="button" className="sheet-library-open" onClick={() => { setSelectedCharacterId(character.id); setSheetCharacterView(true) }}>Abrir ficha <span aria-hidden="true">↗</span></button>
                          {isMaster && showCharacterManagement && <button type="button" className="secondary-button sheet-library-delete-button" disabled={deletingCharacterId !== null} onClick={() => void deleteCharacter(character)}>{deletingCharacterId === character.id ? 'Excluindo…' : 'Excluir'}</button>}
                        </div>
                      </article>
                    })}
                  </div>
                )}
              </> : <>
                <div className="inventory-heading sheet-page-hero sheet-page-hero-detail"><div className="sheet-page-hero-leading"><span className="sheet-page-hero-icon" aria-hidden="true">{selectedCharacter?.emoji || '⚔️'}</span><div><span className="sheet-page-eyebrow">FICHA DE PERSONAGEM · {activeSystem?.name ?? 'RPG'}</span><h2>{selectedCharacter?.name ?? 'Personagem'}</h2><p>{selectedCampaign?.name} · Consulte e administre as informações do personagem.</p></div></div><button type="button" className="secondary-button sheet-page-back" onClick={() => setSheetCharacterView(false)}>← Voltar à lista</button></div>
                <label className="sheet-season-selector" style={labelStyle}>Temporada<select value={selectedSeasonId} onChange={e => setSelectedSeasonId(e.target.value)} style={inputStyle}><option value="">Selecione uma temporada</option>{seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name} ({season.status})</option>)}</select></label>
                {selectedSeasonId && !sheetLoading && <label className={`season-participation-toggle ${(() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'is-participating' : ''}`}><input type="checkbox" checked={(() => { try { return (() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() } catch { return false } })()} disabled={!canEditSelectedSheet || sheetSaving} onChange={e => { void toggleSeasonParticipation(e.target.checked) }} /><span><strong>{(() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'Participando desta temporada' : 'Não participa desta temporada'}</strong><small>{sheetSaving ? 'Salvando participação…' : 'Altere esta opção para incluir ou retirar o personagem. A ficha e o histórico permanecem preservados.'}</small></span><b className="season-participation-status">{sheetSaving ? '…' : (() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'ATIVO' : 'INATIVO'}</b></label>}
{selectedSeasonId && !sheetLoading && (() => {
  let partyParticipation = false
  let seasonParticipation = false

  try {
    const parsed = JSON.parse(sheetDraft || '{}')
    partyParticipation = parsed.partyParticipation === true
    seasonParticipation = parsed.seasonParticipation === true
  } catch {}

  return (
    <label className={`season-participation-toggle ${partyParticipation ? 'is-participating' : ''}`}>
      <input
        type="checkbox"
        checked={partyParticipation}
        disabled={!canEditSelectedSheet || sheetSaving || !seasonParticipation}
        onChange={e => {
          const participates = e.target.checked

          let parsed: Record<string, any> = {}
          try {
            parsed = JSON.parse(sheetDraft || '{}')
          } catch {}

          const next = {
            ...parsed,
            partyParticipation: participates,
          }

          setSheetDraft(JSON.stringify(next, null, 2))
        }}
      />

      <span>
        <strong>
          {partyParticipation ? 'Participando da Party' : 'Não participa da Party'}
        </strong>
        <small>
          {!seasonParticipation
            ? 'O personagem precisa participar da temporada para entrar na Party.'
            : 'Defina se este personagem faz parte da Party desta temporada.'}
        </small>
      </span>

      <b className="season-participation-status">
        {partyParticipation ? 'ATIVO' : 'INATIVO'}
      </b>
    </label>
  )
})()}
                {isMaster && selectedSeasonId && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,margin:'12px 0'}}><label style={labelStyle}>Nome da temporada<input value={seasonNameDraft} onChange={e=>setSeasonNameDraft(e.target.value)} style={inputStyle}/></label><label style={labelStyle}>Descrição<input value={seasonDescriptionDraft} onChange={e=>setSeasonDescriptionDraft(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="button" onClick={()=>void saveSeasonDetails()}>Salvar detalhes da temporada</button><label style={labelStyle}>Status<select value={seasons.find(s=>s.id===selectedSeasonId)?.status ?? 'draft'} onChange={e=>void changeSeasonStatus(e.target.value as Season['status'])} style={inputStyle}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="completed">Concluída</option><option value="archived">Arquivada</option></select></label></div>}


                {!selectedSeasonId ? <p>Crie ou selecione uma temporada para editar a ficha.</p> : sheetLoading ? <p>Carregando ficha…</p> : <>
                  <div className="sheet-toolbar">
                    <div className="sheet-toolbar-title"><span aria-hidden="true">◈</span><div><strong>Visão da ficha</strong><p>Consulte os dados calculados e edite os detalhes quando necessário.</p></div></div>
                    {canEditSelectedSheet && (
  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>

    <button
      className="primary-button"
      type="button"
      onClick={()=>setEditingSheet(value=>!value)}
    >
      {editingSheet?'Fechar edição':'Editar ficha'}
    </button>
    {isCyberFlowerSystem && (
  <span className="sheet-autosave-status">
    {sheetAutoSaveStatus === 'saving' && 'Salvando...'}
    {sheetAutoSaveStatus === 'saved' && 'Salvo automaticamente'}
    {sheetAutoSaveStatus === 'error' && 'Erro ao salvar'}
    {sheetAutoSaveStatus === 'pending' && 'Alterações pendentes'}
  </span>
)}
  </div>
)}
                  </div>
                  <nav className="sheet-quick-nav hb-sheet-nav-v2" aria-label="Navegação da ficha"><span className="hb-nav-caption">SEÇÕES DA FICHA</span>
                    {(editingSheet ? [
                      ['✎', 'Edição', 'ficha-edicao'], ['⚔', 'Ações', 'ficha-acoes'], ['◈', 'Reações', 'ficha-reacoes'],
                      ['⛨', 'Armadura', 'ficha-armadura-protecao'], ['▤', 'Inventário', 'ficha-inventario'],
                    ] : [
                      ['♥', 'Status', 'ficha-status'], ['✦', 'Atributos', 'ficha-atributos'], ['✧', 'Perícias', 'ficha-pericias'],
                      ['⚔', 'Combate', 'ficha-combate'], ['◈', 'Ações', 'ficha-acoes'], ['↶', 'Reações', 'ficha-reacoes'],
                      ['⛨', 'Armadura', 'ficha-armadura-protecao'], ['▤', 'Inventário', 'ficha-inventario'],
                    ]).map(([symbol,label,target]) => <button type="button" key={target} onClick={() => document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'start'})}><span aria-hidden="true">{symbol}</span>{label}</button>)}
                  </nav>
                  {renderSharedSheetCore(false)}
                  {editingSheet && canEditSelectedSheet && (
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
    <button
      className="secondary-button"
      type="button"
      disabled={!sheet}
      onClick={()=>void createSheetMilestone()}
    >
      Registrar marco no histórico
    </button>
  </div>
)}
                

{canAccessSelectedCharacter && selectedCharacter && renderSharedSheetCore(false, 'armor')}

{canAccessSelectedCharacter && selectedCharacter && (
  <section className="inventory-section sheet-inventory-section" id="ficha-inventario">
    <div className="inventory-heading">
      <div><span className="sheet-page-eyebrow">EQUIPAMENTOS E RECURSOS</span><h3>Inventário</h3><p>Gerencie itens, carga, equipamentos e consumíveis.</p></div>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
  if (showItemForm) {
    resetItemForm()
    setShowItemForm(false)
  } else {
    resetItemForm()
    setShowItemForm(true)
  }
}}
        disabled={loading}
      >
        + Adicionar item
      </button>
    </div>

{showItemForm &&
  (selectedCharacterId || editingItem) &&
  createPortal(
    <div className="item-modal-overlay">
      <div
        className="item-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-modal-title"
      >
        <form className="add-form item-editor-form" onSubmit={createItem}>
                    <div className="form-heading">
                      <div>
                        <h3>{editingItem ? 'Editar item' : 'Novo item'}</h3>
                        <p>
                          {editingItem
                            ? 'Altere os dados do item e salve as mudanças.'
                            : 'O item será associado ao personagem selecionado.'}
                        </p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span>{editingItem ? '✎' : '✧'}</span>
                        <button type="button" className="secondary-button" onClick={() => { resetItemForm(); setShowItemForm(false) }}>Fechar</button>
                      </div>
                    </div>

                    {error && (
                      <div className="notice" role="alert" style={{ marginBottom: 12 }}>
                        <span>!</span> {error}
                        <button type="button" onClick={() => setError('')} aria-label="Fechar erro">×</button>
                      </div>
                    )}

                    <label>
                      Nome do item
                      <input
                        value={newItemName}
                        onChange={(event) => setNewItemName(event.target.value)}
                        placeholder="Ex.: Espada de prata"
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Descrição
                      <input
                        value={newItemDescription}
                        onChange={(event) =>
                          setNewItemDescription(event.target.value)
                        }
                        placeholder="Detalhes do item (opcional)"
                        maxLength={1000}
                      />
                    </label>

                    <div className="form-row">
                      <div className="emoji-field">
                        <label>Emoji do item</label>

                        <div className="emoji-grid">
                          {availableEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={
                                newItemEmoji === emoji
                                  ? 'emoji-option selected'
                                  : 'emoji-option'
                              }
                              onClick={() => setNewItemEmoji(emoji)}
                              aria-label={`Selecionar emoji ${emoji}`}
                              aria-pressed={newItemEmoji === emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

<p className="emoji-preview">
  <span className="emoji-preview-label">Emoji selecionado:</span>
  <span className="emoji-preview-icon">{newItemEmoji}</span>
</p>
                      </div>

                      <section className="item-classifications-panel">
                        <div className="item-classifications-heading">
                          <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. Um item pode ter várias classificações.</p></div>
                          <span>{newItemCategories.length} selecionada{newItemCategories.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="item-classifications-grid">
                          {categories.filter(category => category !== 'Todos').map(category => (
                            <label key={category} className={newItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                              <input type="checkbox" checked={newItemCategories.includes(category)} onChange={event => {
                                let next = event.target.checked ? [...newItemCategories, category] : newItemCategories.filter(value => value !== category)
                                // Alimentos são sempre consumíveis e seguem a escassez.
                                if (category === 'Alimentos' && event.target.checked && !next.includes('Consumíveis')) next = [...next, 'Consumíveis']
                                if (category === 'Consumíveis' && !event.target.checked) next = next.filter(value => value !== 'Alimentos')
                                setNewItemCategories(next)
                                if (next.length) setNewItemCategory(next[0])
                                const automaticWeight = getAutomaticItemWeight(next, newEquipmentType, newArmorClass, newWeaponClass)
                                if (automaticWeight !== null) setNewItemWeight(String(automaticWeight))
                              }} />
                              <span className="item-classification-check">{newItemCategories.includes(category) ? '✓' : '+'}</span>
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                        {!newItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                      </section>

                      {newItemCategories.includes('Consumíveis') && (
                        <section className="scarcity-editor-card">
                          <div className="scarcity-editor-heading">
                            <span className="scarcity-editor-icon">⌛</span>
                            <div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div>
                          </div>
                          <label>Nível inicial de escassez
                            <select value={newScarcityLevel} disabled={newScarcityExhausted} onChange={event => setNewScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}>
                              <option value="1">Nível 1 — d12</option>
                              <option value="2">Nível 2 — d8</option>
                              <option value="3">Nível 3 — d6</option>
                              <option value="4">Nível 4 — d4</option>
                            </select>
                          </label>
                          <div className="scarcity-level-preview">
                            <div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[newScarcityLevel]}</strong></div>
                            <div><span>Carga</span><strong>{newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel]}</strong></div>
                          </div>
                          <p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
                          <label className="scarcity-exhausted-toggle"><input type="checkbox" checked={newScarcityExhausted} onChange={event => {
  const exhausted = event.target.checked
  setNewScarcityExhausted(exhausted)
  setNewItemWeight(
    String(exhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel])
  )
}} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label>
                        </section>
                      )}

<label style={labelStyle}>
  Raridade
</label>

<select
  value={newItemRarity}
  onChange={event => setNewItemRarity(event.target.value)}
  style={inputStyle}
>
  <option value="comum">Comum</option>
  <option value="incomum">Incomum</option>
  <option value="raro">Raro</option>
  <option value="épico">Épico</option>
  <option value="mítico">Mítico</option>
  <option value="relíquia">Relíquia</option>
</select>

                      {newItemCategories.includes('Equipamento') && <><label>
                        Tipo de equipamento
                        <select value={newEquipmentType} onChange={event => { const nextType = event.target.value as 'none' | 'armor' | 'protection' | 'cybernetic'; setNewEquipmentType(nextType); const automaticWeight = getAutomaticItemWeight(newItemCategories, nextType, newArmorClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}>
                          <option value="none">Item comum</option>
                          <option value="armor">Armadura</option>
<option value="protection">Proteção</option>
{isCyberFlowerSystem && (
  <option value="cybernetic">Cibernética</option>
)}
                        </select>
                      </label>

                      {newEquipmentType === 'armor' && <>
                        <label>Tipo de armadura<select value={newArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setNewArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, nextClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                        {newArmorClass !== 'pesada' && <label>Tipos de dano protegidos<select value={newArmorCoverage} onChange={event => setNewArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                        <div className="equipment-rules-preview">
  <strong>Regras da armadura</strong>
  <p>
    Carga: {newArmorClass === 'leve' ? 2 : newArmorClass === 'media' ? 4 : 6}
  </p>
  <p>
    Proteção: {newArmorClass === 'leve'
      ? '(Resistência ÷ 2) + 4'
      : newArmorClass === 'media'
        ? 'Resistência + 6'
        : '(Resistência × 2) + 8'}
  </p>
  <p>
    Destreza de armadura: {newArmorClass === 'leve'
      ? 'Destreza integral'
      : newArmorClass === 'media'
        ? '½ dos pontos de destreza'
        : '0'}
  </p>
  <p>
    Penalidades: {newArmorClass === 'media'
      ? '−5 em Reflexo; metade do deslocamento'
      : newArmorClass === 'pesada'
        ? '−10 em Reflexo e Corrida; ¼ do deslocamento'
        : 'Sem penalidade; deslocamento normal'}
  </p>
</div>
                      </>}

                      {newEquipmentType === 'protection' && <>
                        <label>Nível de proteção<select value={newProtectionTier} onChange={event => setNewProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                        <label>Tipo de resistência<select value={newProtectionMode} onChange={event => setNewProtectionMode(event.target.value as 'resistencia' | 'sanidade')}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                        <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0</p><p>Proteção: {newProtectionTier === 'basica' ? '¼' : newProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {newProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {newProtectionTier === 'basica' ? '1d8' : newProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                      </>}

{isCyberFlowerSystem && newEquipmentType === 'cybernetic' && <>
  <label>
    Categoria da cibernética
    <select
      value={newCyberneticCategory}
      onChange={event => setNewCyberneticCategory(event.target.value)}
    >
      <option value="Neurológico">Neurológico</option>
      <option value="Sensorial">Sensorial</option>
      <option value="Órgãos">Órgãos</option>
      <option value="Membros">Membros</option>
      <option value="Estrutural">Estrutural</option>
      <option value="Armamento">Armamento</option>
      <option value="Suporte">Suporte</option>
      <option value="Outro">Outro</option>
    </select>
  </label>

  <label>
    Localização no corpo
    <input
      value={newCyberneticLocation}
      onChange={event => setNewCyberneticLocation(event.target.value)}
      placeholder="Ex.: Crânio, braço esquerdo..."
    />
  </label>

  <label>
    Carga biológica
    <input
      type="number"
      min="0"
      step="1"
      value={newCyberneticLoad}
      onChange={event => setNewCyberneticLoad(event.target.value)}
    />
  </label>

  <label>
    Efeitos
    <textarea
      value={newCyberneticEffects}
      onChange={event => setNewCyberneticEffects(event.target.value)}
      placeholder="Descreva os efeitos da cibernética..."
    />
  </label>
</>}
                      </>}

                      {newItemCategories.includes('Armas') && <>
                        <label>Classificação da arma<select value={newWeaponClass} onChange={event => { const nextClass = event.target.value; setNewWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, nextClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                        <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[newWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[newWeaponClass]} kg</p></div>
                      </>}

                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={newItemQuantity}
                          onChange={(event) =>
                            setNewItemQuantity(event.target.value)
                          }
                          required
                        />
                      </label>

<label>
  Peso por unidade (kg)
  <input
    type="number"
    min="0"
    max="100000"
    step="0.1"
    value={
      newItemCategories.includes('Consumíveis')
        ? String(newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel])
        : newItemWeight
    }
    onChange={(event) => setNewItemWeight(event.target.value)}
    disabled={
      newItemCategories.includes('Consumíveis') ||
      getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
    }
    required
  />
  <small>
    {newItemCategories.includes('Consumíveis')
      ? 'Peso definido automaticamente pela carga restante do consumível.'
      : getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
        ? 'Peso definido automaticamente pela classificação e bloqueado para manter as regras do equipamento.'
        : 'Informe o peso por unidade deste item.'}
  </small>
</label>
                    </div>

<label>
  Valor unitário
  <input
    type="number"
    min="0"
    step="0.01"
    value={newScarcityExhausted && newItemCategories.includes('Consumíveis') ? '0' : newItemUnitPrice}
    onChange={event => setNewItemUnitPrice(event.target.value)}
    disabled={newScarcityExhausted && newItemCategories.includes('Consumíveis')}
    placeholder="Ex.: 500"
  />
</label>

<label>
  Moeda
  <select
    value={newItemCurrencyId}
    onChange={event => setNewItemCurrencyId(event.target.value)}
  >
    <option value="">Sem moeda definida</option>
    {selectedCampaign?.currency_config?.currencies?.map((currency, index) => (
      <option key={currency.id} value={currency.id}>
        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
      </option>
    ))}
  </select>
</label>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading
                        ? 'Salvando...'
                        : editingItem
                          ? 'Salvar alterações'
                          : 'Salvar item'}
                    </button>
        </form>
      </div>
    </div>,
    document.body
  )}

    <div className="sheet-capacity-overview" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:12,margin:'4px 0 18px'}}>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>▤</span> Objetos</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{totalObjects}</div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>{totalObjects === 1 ? 'item na mochila' : 'itens na mochila'}</div>
      </div>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>⚖</span> Peso carregado</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{totalWeight.toFixed(1)}<span style={{fontSize:14,fontWeight:650,marginLeft:4}}>kg</span></div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>peso total dos itens</div>
      </div>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>🎒</span> Capacidade livre</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:remainingCapacity < 0 ? '#ff8b8b' : 'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{remainingCapacity.toFixed(1)}<span style={{fontSize:14,fontWeight:650,marginLeft:4}}>kg</span></div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>{remainingCapacity < 0 ? 'acima do limite de carga' : 'disponíveis para carregar'}</div>
      </div>
      <div style={{gridColumn:'1 / -1',padding:'12px 15px',borderRadius:12,border:'1px solid var(--season-line,rgba(160,140,190,.16))',background:'var(--season-bg,rgba(10,9,15,.28))'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8,fontSize:12}}><span style={{color:'var(--season-muted,#aaa2b5)',fontWeight:650}}>Uso da capacidade</span><strong style={{color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{capacityPercent.toFixed(0)}%</strong></div>
        <div role="progressbar" aria-label="Capacidade utilizada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,capacityPercent))} style={{height:8,overflow:'hidden',borderRadius:99,background:'var(--season-line,rgba(160,140,190,.22))'}}><div style={{height:'100%',width:`${Math.min(100,Math.max(0,capacityPercent))}%`,borderRadius:99,background:remainingCapacity < 0 ? 'linear-gradient(90deg,#e78b62,#e45f70)' : 'linear-gradient(90deg,var(--season-secondary,#8d70cf),var(--season-primary,#c8b5ff))',transition:'width .25s ease'}} /></div>
      </div>
    </div>

    <div className="inventory-toolbar">
      <div className="category-tabs">
        {categories.map(category => (
          <button key={category} className={activeCategory === category ? 'category-tab selected' : 'category-tab'} onClick={() => setActiveCategory(category)}>
            {category}
          </button>
        ))}
      </div>
      <div className="inventory-extra-controls">
        <label className="search-box">
          <span>⌕</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar item..." aria-label="Buscar item" />
          <kbd>/</kbd>
        </label>
        <button type="button" className={favoriteOnly ? 'category-tab selected' : 'category-tab'} onClick={() => setFavoriteOnly(current => !current)} aria-pressed={favoriteOnly}>
          {favoriteOnly ? '★ Favoritos' : '☆ Favoritos'}
        </button>
        <label className="inventory-sort-label">
          <span>Ordenar:</span>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Ordenar itens">
            <option value="created">Adicionados</option>
                        <option value="manual">Minha ordem</option>
            <option value="name">Nome</option>
            <option value="category">Categoria</option>
            <option value="weight">Maior peso</option>
            <option value="quantity">Maior quantidade</option>
          </select>
        </label>
      </div>
    </div>

    {itemsLoading ? (
      <div className="empty-state"><p>Carregando inventário...</p></div>
    ) : filteredItems.length === 0 ? (
      <div className="empty-state">
        <span>▤</span>
        <h3>{items.length === 0 ? 'Mochila vazia' : 'Nenhum item encontrado'}</h3>
        <p>{items.length === 0 ? 'Adicione o primeiro item deste personagem.' : 'Tente outra busca ou selecione outra categoria.'}</p>
        {items.length === 0 ? (
          <button type="button" onClick={() => {
  resetItemForm()
  setShowItemForm(true)
}}>Adicionar primeiro item</button>
        ) : (
          <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setFavoriteOnly(false) }}>Limpar filtros</button>
        )}
      </div>
    ) : (
      <div className="item-grid">
        {orderedInventoryItems.map(item => (
          <article className={`item-card inventory-item-card ${inventoryDropId === item.id ? 'inventory-drop-target' : ''} ${draggedInventoryId === item.id ? 'inventory-dragging' : ''}`} key={item.id}
          draggable
          onDragStart={event => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"]')) { event.preventDefault(); return }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.id)
    setDraggedInventoryId(item.id)
  }}
  onDragEnd={() => { setDraggedInventoryId(null); setInventoryDropId(null) }}
          onDragOver={event => { if (draggedInventoryId && draggedInventoryId !== item.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setInventoryDropId(item.id) } }}
          onDragLeave={() => setInventoryDropId(current => current === item.id ? null : current)}
          onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain') || draggedInventoryId; if (id) void reorderInventoryItem(id, item.id) }}
          onClickCapture={event => {
  const target = event.target as HTMLElement
  if (target.closest('button, input, select, textarea, a, [role=\"button\"]')) return
  setSelectedItemDetails(item)
}}
style={{cursor:'pointer'}}>
            <div className="item-card-top">
              <button type="button" className="item-art" onClick={event => { event.stopPropagation(); setEmojiPickerItem(item) }} title="Clique para alterar o emoji" aria-label={`Alterar emoji de ${item.name}`} style={{cursor:'pointer',font:'inherit',fontSize:28}}>
                {typeof item.metadata?.icon === 'string' ? item.metadata.icon : '📦'}
              </button>
              <div className="item-actions">
                <button type="button" className="item-menu" title={item.metadata?.favorite === true ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-label={item.metadata?.favorite === true ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`} aria-pressed={item.metadata?.favorite === true} onClick={event => { event.stopPropagation(); void toggleFavorite(item) }}>{item.metadata?.favorite === true ? '★' : '☆'}</button>
                <button type="button" className="item-menu" title="Duplicar item" aria-label={`Duplicar ${item.name}`} disabled={loading} onClick={event => { event.stopPropagation(); void duplicateItem(item) }}>⧉</button>
                {item.metadata?.equipmentType === 'armor' && <button type="button" className={`item-menu equipment-card-icon armor-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar armadura' : 'Equipar armadura'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped=item.metadata?.equipped!==true; if(nextEquipped){ const others=items.filter(entry=>entry.character_id===item.character_id && entry.id!==item.id && entry.metadata?.equipmentType==='armor' && entry.metadata?.equipped===true); for(const other of others) await supabase.from('inventory_items').update({metadata:{...(other.metadata||{}),equipped:false}}).eq('id',other.id) } const {data,error}=await supabase.from('inventory_items').update({metadata:{...(item.metadata||{}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if(error||!data){setError(`Não foi possível alterar a armadura: ${error?.message||'sem retorno'}`);return} setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry.character_id===item.character_id&&entry.metadata?.equipmentType==='armor'&&entry.id!==item.id?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped===true?'✓':'🛡'}</button>}
                {item.metadata?.equipmentType === 'protection' && <button type="button" className={`item-menu equipment-card-icon protection-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar proteção' : 'Equipar proteção'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped=item.metadata?.equipped!==true; const {data,error}=await supabase.from('inventory_items').update({metadata:{...(item.metadata||{}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if(error||!data){setError(`Não foi possível alterar a proteção: ${error?.message||'sem retorno'}`);return} setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped===true?'✓':'✧'}</button>}
                {Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas') && <button type="button" className={`item-menu equipment-card-icon weapon-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar arma' : 'Equipar arma'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped = item.metadata?.equipped !== true; if (nextEquipped) { const otherEquipped = items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas')); for (const other of otherEquipped) { await supabase.from('inventory_items').update({metadata:{...(other.metadata || {}),equipped:false}}).eq('id',other.id) } } const {data,error: equipError}=await supabase.from('inventory_items').update({metadata:{...(item.metadata || {}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if (equipError || !data) { setError(`Não foi possível alterar a arma equipada: ${equipError?.message || 'sem retorno'}`); return } setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry.id!==item.id&&entry.character_id===item.character_id&&entry.metadata?.equipped===true&&Array.isArray(entry.metadata?.categories)&&entry.metadata.categories.includes('Armas')?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped === true ? '✓' : '⚔'}</button>}
                <button type="button" className="item-menu" title="Editar item" aria-label={`Editar ${item.name}`} disabled={loading} onClick={event => {
  event.stopPropagation()
  startEditingItem(item)
}}>✎</button>
                <button type="button" className="item-menu" title="Remover item" aria-label={`Remover ${item.name}`} disabled={loading} onClick={event => { event.stopPropagation(); void removeItem(item) }}>×</button>
              </div>
            </div>
            
            <div className="item-category">{item.category}</div>
            <h3>{item.name}</h3>
            <p className="item-description">{item.description || 'Sem descrição.'}</p>
            {(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))) && <div className="inventory-equipment-controls" aria-label={`Equipamento de ${item.name}`}>
              <span className="inventory-equipment-label">EQUIPAMENTO</span>
              <button type="button" className={`inventory-equip-button ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => {
                event.stopPropagation();
                const isWeapon = Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas');
                const type = isWeapon ? 'weapon' : item.metadata?.equipmentType;
                const nextEquipped = item.metadata?.equipped !== true;
                const others = nextEquipped && (type === 'weapon' || type === 'armor') ? items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && (type === 'weapon' ? Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas') : entry.metadata?.equipmentType === 'armor')) : [];
                for (const other of others) {
                  const { error: otherError } = await supabase.from('inventory_items').update({ metadata: { ...(other.metadata || {}), equipped: false } }).eq('id', other.id);
                  if (otherError) { setError(`Não foi possível atualizar outro equipamento: ${otherError.message}`); return; }
                }
                const { data, error: equipError } = await supabase.from('inventory_items').update({ metadata: { ...(item.metadata || {}), equipped: nextEquipped } }).eq('id', item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle();
                if (equipError || !data) { setError(`Não foi possível alterar o equipamento: ${equipError?.message || 'sem retorno'}`); return; }
                setItems(current => current.map(entry => entry.id === item.id ? data as Item : others.some(other => other.id === entry.id) ? { ...entry, metadata: { ...(entry.metadata || {}), equipped: false } } : entry));
                setNotice(nextEquipped ? `${item.name} equipado(a).` : `${item.name} desequipado(a).`);
              }}>
                <span className="inventory-equip-symbol">{item.metadata?.equipped === true ? '✓' : item.metadata?.equipmentType === 'armor' ? '🛡' : item.metadata?.equipmentType === 'protection' ? '✧' : '⚔'}</span>
                {item.metadata?.equipped === true ? 'Equipado · Desequipar' : item.metadata?.equipmentType === 'armor' ? 'Equipar armadura' : item.metadata?.equipmentType === 'protection' ? 'Equipar proteção' : 'Equipar arma'}
              </button>
            </div>}
            <div className="item-footer">
              <span>⚖ {`${(Number(item.weight) || 0).toFixed(1)} kg / un.`}</span>
              <div className="quantity-controls" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" className="quantity-button" onClick={event => { event.stopPropagation(); void changeItemQuantity(item, Number(item.quantity)-1) }} disabled={Number(item.quantity)<=1 || updatingQuantityItemId===item.id} aria-label={`Diminuir quantidade de ${item.name}`}>−</button>
                <span className="quantity" aria-live="polite">{item.quantity}</span>
                <button type="button" className="quantity-button" onClick={event => { event.stopPropagation(); void changeItemQuantity(item, Number(item.quantity)+1) }} disabled={Number(item.quantity)>=999 || updatingQuantityItemId===item.id} aria-label={`Aumentar quantidade de ${item.name}`}>+</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
    <small style={{display:'block',marginTop:12,color:'var(--season-muted, #b9b4c2)'}}>
      Os itens pertencem ao personagem selecionado na campanha. Alterações, equipamentos e quantidades são sincronizados com a ficha.
    </small>
  </section>
)}

{isCyberFlowerSystem &&
  canAccessSelectedCharacter &&
  selectedCharacter &&
  selectedSeasonId &&
  !sheetLoading && (
    <CyberneticsInventory
      sheetDraft={sheetDraft}
      setSheetDraft={setSheetDraft}
      characterId={selectedCharacter.id}
      seasonId={selectedSeasonId}
      canManageCybernetics={canManageCybernetics}
      sheetSaving={sheetSaving}
      inventoryItems={items}
      onInventoryItemsChange={setItems}
      onSaveCybernetics={(cybernetics) =>
        saveCharacterCybernetics(
          selectedCharacter.id,
          selectedSeasonId,
          cybernetics,
        )
      }
    />
  )}

{canAccessSelectedCharacter &&
  (selectedCampaign?.currency_config?.currencies?.length ?? 0) > 0 && (
  <section className="inventory-section currency-wallet" style={{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(0,.95fr)',columnGap:22,rowGap:0,alignItems:'start',width:'100%',boxSizing:'border-box',position:'relative',isolation:'isolate',overflow:'hidden',padding:24,borderRadius:24,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'radial-gradient(ellipse at 8% 0%,var(--season-accent-soft,rgba(220,135,65,.16)),transparent 42%),linear-gradient(145deg,var(--season-surface,rgba(20,18,25,.96)),var(--season-surface-alt,rgba(255,255,255,.035)))',boxShadow:'0 18px 48px rgba(0,0,0,.16)'}}>

    <div className="inventory-heading" style={{position:'relative',alignItems:'center',gap:16,marginBottom:24,paddingBottom:18,borderBottom:'1px solid var(--season-line,rgba(255,255,255,.12))'}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <div aria-hidden="true" style={{width:58,height:58,flex:'0 0 58px',display:'grid',placeItems:'center',borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'linear-gradient(145deg,var(--season-accent-soft,rgba(220,135,65,.20)),var(--season-surface-alt,rgba(255,255,255,.04)))',fontSize:28,boxShadow:'0 10px 28px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.12)'}}>👛</div>
        <div>
          <h3 style={{margin:'0 0 5px',fontSize:24,fontWeight:850,letterSpacing:'-.04em'}}>Carteira</h3>
          <p style={{margin:0,fontSize:13}}>Recursos de <strong>{selectedCharacter?.name ?? 'este personagem'}</strong></p>
          <small style={{display:'block',marginTop:5,opacity:.68}}>Saldos e histórico de movimentações</small>
        </div>
      </div>
      <span style={{marginLeft:'auto',padding:'6px 10px',borderRadius:999,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'var(--season-surface-alt,rgba(255,255,255,.05))',fontSize:11,fontWeight:750,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Finanças</span>
    </div>

<div className="currency-tabs">
  <button
    type="button"
    className={!showCurrencyHistory ? 'currency-tab active' : 'currency-tab'}
    onClick={() => {
      if (showCurrencyHistory) void toggleCurrencyHistory()
    }}
  >
    👛 Carteira
  </button>

  <button
    type="button"
    className={showCurrencyHistory ? 'currency-tab active' : 'currency-tab'}
    onClick={() => {
      if (!showCurrencyHistory) void toggleCurrencyHistory()
    }}
  >
    ▤ Histórico
  </button>
</div>


{!showCurrencyHistory ? (
  <>
    <div className="currency-balances-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,210px),1fr))',gap:14,marginBottom:24}}>
      {(selectedCampaign?.currency_config?.currencies ?? []).map((currency, index) => (
        <div className="currency-balance" key={currency.id} style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',gap:14,minHeight:132,padding:19,borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.09)),var(--season-surface,rgba(0,0,0,.10)))',boxShadow:'0 12px 28px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:'.045em',color:'var(--season-muted, #aaa)'}}>{currency.name}</span>
            <span aria-hidden="true" style={{width:34,height:34,display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-accent-soft,rgba(220,135,65,.16))',color:'var(--season-accent,currentColor)',fontSize:16}}>{index===0?'◈':'◇'}</span>
          </div>
          <strong style={{fontSize:'clamp(25px,3.4vw,33px)',lineHeight:1.12,fontWeight:850,letterSpacing:'-.035em',fontVariantNumeric:'tabular-nums',overflowWrap:'anywhere'}}><span style={{fontSize:'.78em',opacity:.8,marginRight:5}}>{currency.symbol}</span>{(currencyBalances[currency.id] ?? 0).toLocaleString('pt-BR')}</strong>
          <span style={{fontSize:11,color:'var(--season-muted, #aaa)',opacity:.8}}>Saldo disponível</span>
        </div>
      ))}
    </div>

    <div
      className="currency-conversion-panel"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gap: 16,
        marginBottom: 20,
        padding: 20,
        borderRadius: 18,
        border: '1px solid var(--season-line,rgba(255,255,255,.12))',
        background: 'var(--season-surface-alt,rgba(255,255,255,.035))',
      }}
    >
      <div>
        <h4 style={{ margin: '0 0 5px', fontSize: 16 }}>⇄ Converter moedas</h4>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--season-muted,#aaa)' }}>
          Converta seus saldos entre as moedas da campanha.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))',
        gap: 12,
        alignItems: 'end',
      }}>
        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
          MOEDA DE ORIGEM
          <select
            value={conversionFromId}
            onChange={event => setConversionFromId(event.target.value)}
            style={{
              width: '100%',
              minHeight: 46,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--season-line,rgba(255,255,255,.16))',
              background: 'var(--season-surface,rgba(0,0,0,.16))',
              color: 'var(--season-text,inherit)',
            }}
          >
            <option value="">Selecione</option>
            {(selectedCampaign?.currency_config?.currencies ?? []).map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.name} ({currency.symbol})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
          MOEDA DE DESTINO
          <select
            value={conversionToId}
            onChange={event => setConversionToId(event.target.value)}
            style={{
              width: '100%',
              minHeight: 46,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--season-line,rgba(255,255,255,.16))',
              background: 'var(--season-surface,rgba(0,0,0,.16))',
              color: 'var(--season-text,inherit)',
            }}
          >
            <option value="">Selecione</option>
            {(selectedCampaign?.currency_config?.currencies ?? []).map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.name} ({currency.symbol})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
          QUANTIDADE A CONVERTER
          <input
            type="number"
            min="0.01"
            step="any"
            value={conversionAmount}
            onChange={event => setConversionAmount(event.target.value)}
            placeholder="Ex.: 10"
            style={{
              width: '100%',
              minHeight: 46,
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--season-line,rgba(255,255,255,.16))',
              background: 'var(--season-surface,rgba(0,0,0,.16))',
              color: 'var(--season-text,inherit)',
            }}
          />
        </label>
      </div>

      {(() => {
        const from = (selectedCampaign?.currency_config?.currencies ?? []).find(
          currency => currency.id === conversionFromId,
        )
        const to = (selectedCampaign?.currency_config?.currencies ?? []).find(
          currency => currency.id === conversionToId,
        )
        const amount = Number(conversionAmount.replace(',', '.'))
        const received = from && to && Number.isFinite(amount) && amount > 0
          ? amount * from.conversionRate / to.conversionRate
          : null

        return (
          <div style={{
            padding: 13,
            borderRadius: 12,
            background: 'var(--season-surface,rgba(0,0,0,.13))',
            fontSize: 13,
          }}>
            {received !== null && from && to ? (
              <>
                <span style={{ color: 'var(--season-muted,#aaa)' }}>Você receberá aproximadamente:</span>
                <strong style={{ display: 'block', marginTop: 5, fontSize: 20 }}>
                  {to.symbol} {received.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                </strong>
              </>
            ) : (
              <span style={{ color: 'var(--season-muted,#aaa)' }}>
                Selecione as moedas e informe uma quantidade para visualizar a conversão.
              </span>
            )}
          </div>
        )
      })()}

      <button
        type="button"
        className="currency-action-button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          minHeight: 46,
          padding: '11px 18px',
          borderRadius: 12,
          border: '1px solid var(--season-line,rgba(255,255,255,.18))',
          background: 'var(--season-accent-soft,rgba(220,135,65,.18))',
          color: 'var(--season-text,inherit)',
          fontWeight: 750,
          cursor: 'pointer',
        }}
        disabled={
          currencyActionLoading ||
          !canAccessSelectedCharacter ||
          !conversionFromId ||
          !conversionToId ||
          conversionFromId === conversionToId ||
          !conversionAmount ||
          Number(conversionAmount.replace(',', '.')) <= 0
        }
        onClick={() => void handleCurrencyConversion()}
      >
        {currencyActionLoading ? 'Convertendo…' : '⇄ Converter moedas'}
      </button>
    </div>

    {currencyLoading ? (
      <p>Carregando carteira...</p>
    ) : (
<div className="currency-actions">
  <label>
    Moeda
    <select
      value={currencyAdjustmentId || (selectedCampaign?.currency_config?.currencies ?? [])[0]?.id || ''}
      onChange={event => setCurrencyAdjustmentId(event.target.value)}
    >
      {(selectedCampaign?.currency_config?.currencies ?? []).map(currency => (
        <option key={currency.id} value={currency.id}>
          {currency.name} ({currency.symbol})
        </option>
      ))}
    </select>
  </label>

  <label>
    Valor
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={currencyAmount}
            onChange={event => setCurrencyAmount(event.target.value)}
            placeholder="Quanto deseja movimentar?"
            style={{width:'100%',minHeight:46,boxSizing:'border-box',padding:'11px 13px',borderRadius:12,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'var(--season-surface,rgba(0,0,0,.16))',color:'var(--season-text,inherit)',outlineColor:'var(--season-accent,currentColor)'}}
          />
        </label>

        <label style={{display:'grid',gap:8,fontSize:12,fontWeight:750,letterSpacing:'.035em',color:'var(--season-muted, #aaa)'}}>
          DESCRIÇÃO (OPCIONAL)
          <input
            type="text"
            value={currencyDescription}
            onChange={event => setCurrencyDescription(event.target.value)}
            placeholder="Ex.: Recompensa de missão"
            style={{width:'100%',minHeight:46,boxSizing:'border-box',padding:'11px 13px',borderRadius:12,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'var(--season-surface,rgba(0,0,0,.16))',color:'var(--season-text,inherit)',outlineColor:'var(--season-accent,currentColor)'}}
          />
        </label>

        <div className="currency-buttons" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',gridColumn:'1 / -1'}}>
          <button
            type="button"
            className="currency-action-button currency-action-add"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,minHeight:44,padding:'10px 16px',borderRadius:12,border:'1px solid rgba(94,205,145,.42)',background:'linear-gradient(135deg, rgba(55,174,112,.22), rgba(55,174,112,.10))',color:'var(--text-primary, inherit)',fontWeight:700,letterSpacing:'.01em',boxShadow:'0 3px 12px rgba(30,140,85,.10)',cursor:'pointer',transition:'transform .18s ease, box-shadow .18s ease'}}
            disabled={currencyActionLoading || !canAccessSelectedCharacter}
            onClick={() => void handleCurrencyAdjustment('add')}
          >
            <span className="currency-action-icon" aria-hidden="true" style={{display:'grid',placeItems:'center',width:23,height:23,borderRadius:8,background:'rgba(65,190,125,.18)',fontSize:18,lineHeight:1}}>＋</span>
            <span>{currencyActionLoading ? 'Processando…' : 'Adicionar saldo'}</span>
          </button>

          <button
            type="button"
            className="currency-action-button currency-action-remove"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,minHeight:44,padding:'10px 16px',borderRadius:12,border:'1px solid rgba(224,117,117,.38)',background:'linear-gradient(135deg, rgba(205,82,82,.17), rgba(205,82,82,.07))',color:'var(--text-primary, inherit)',fontWeight:700,letterSpacing:'.01em',boxShadow:'0 3px 12px rgba(150,50,50,.08)',cursor:'pointer',transition:'transform .18s ease, box-shadow .18s ease'}}
            disabled={currencyActionLoading || !canAccessSelectedCharacter}
            onClick={() => void handleCurrencyAdjustment('remove')}
          >
            <span className="currency-action-icon" aria-hidden="true" style={{display:'grid',placeItems:'center',width:23,height:23,borderRadius:8,background:'rgba(220,105,105,.16)',fontSize:18,lineHeight:1}}>−</span>
            <span>Retirar saldo</span>
          </button>
        </div>
      </div>
    )}
  </>
) : (
<div className="currency-history-page">
  <div className="currency-history-page-header">
    <div className="currency-history-title">
      <div>
        <span className="currency-section-eyebrow">FINANÇAS DA CAMPANHA</span>
        <h3>Histórico de transações</h3>
        <p>Acompanhe todas as movimentações desta carteira.</p>
      </div>

      <button
        type="button"
        className="secondary-button currency-back-button"
        onClick={() => void toggleCurrencyHistory()}
      >
        ← Voltar à carteira
      </button>
    </div>

    <div className="currency-history-summary">
      <div>
        <span>Movimentações registradas</span>
        <strong>{currencyTransactions.length}</strong>
      </div>

      <button
        type="button"
        className="currency-clear-button"
        disabled={currencyHistoryLoading || currencyTransactions.length === 0}
        onClick={() => void clearCurrencyHistory()}
      >
        <span>🗑</span> Limpar histórico
      </button>
    </div>
  </div>

  {currencyHistoryLoading ? (
    <div className="currency-history-empty">
      <p>Carregando histórico...</p>
    </div>
  ) : currencyTransactions.length === 0 ? (
    <div className="currency-history-empty">
      <span>📜</span>
      <strong>Nenhuma movimentação encontrada</strong>
      <p>Quando uma moeda for adicionada ou retirada, ela aparecerá aqui.</p>
    </div>
  ) : (
    <div className="currency-history-list">
      {currencyTransactions.map(transaction => {
        const currency = selectedCampaign?.currency_config?.currencies
          ?.find(item => item.id === transaction.currency_id)

        const isEntry = transaction.amount_delta > 0

        return (
          <article
            className={`currency-history-entry ${isEntry ? 'is-entry' : 'is-withdrawal'}`}
            key={transaction.id}
          >
            <div className="currency-history-icon">
              {isEntry ? '↙' : '↗'}
            </div>

            <div className="currency-history-info">
              <strong>{isEntry ? 'Entrada' : 'Retirada'}</strong>
              <span>{transaction.description || 'Sem descrição'}</span>
              <small>
                {new Date(transaction.created_at).toLocaleString('pt-BR')}
              </small>
            </div>

            <div className="currency-history-values">
              <strong>
                {isEntry ? '+' : '−'}
                {currency?.symbol ?? ''}
                {Math.abs(transaction.amount_delta).toLocaleString('pt-BR')}
              </strong>
              <small>
                Saldo após movimentação: {currency?.symbol ?? ''}
                {transaction.balance_after.toLocaleString('pt-BR')}
              </small>
            </div>
          </article>
        )
      })}
    </div>
  )}
</div>
)}

  </section>
)}

                </>}
              </>}
            </section>
          )}

{activePage === 'bestiary' && (
  <section className="inventory-section bestiary-page-panel">
    {!selectedCampaignId ? (
      <div className="empty-state">
        <h3>Nenhuma campanha selecionada</h3>
        <p>Selecione uma campanha para acessar o bestiário.</p>
      </div>
    ) : (
      <div className="bestiary-container hb-bestiary hb-beast">
        <div className="inventory-heading hb-hero hb-bestiary-hero hb-beast-hero">
          <div className="hb-beast-hero-copy">
            <span className="hb-kicker">✦ ARQUIVO DE CRIATURAS</span>
            <h2>Bestiário<span className="hb-title-dot">.</span></h2>
            <p>Um catálogo vivo de criaturas, ameaças e descobertas da sua campanha.</p>
            <div className="hb-beast-hero-meta">
              <span>◈ {selectedCampaign?.name ?? 'Campanha'}</span>
              <span>{isMaster ? '♜ Visão do mestre' : '◉ Criaturas reveladas'}</span>
            </div>
          </div>
          <div className="hb-beast-hero-side">
            <div className="hb-beast-hero-symbol" aria-hidden="true">♞</div>
            {isMaster && (
              <button type="button" className="bestiary-add-button hb-beast-create" onClick={openNewCreatureForm}>
                <span aria-hidden="true">＋</span> Nova criatura
              </button>
            )}
          </div>
        </div>

        <div className="hb-bestiary-metrics hb-metric-grid hb-beast-metrics">
          <article className="hb-metric"><span className="hb-metric-icon">♞</span><span className="hb-metric-content"><span className="hb-metric-label">Catalogadas</span><strong>{accessibleCreatures.length}</strong><small>Registros disponíveis</small></span></article>
          <article className="hb-metric"><span className="hb-metric-icon">◉</span><span className="hb-metric-content"><span className="hb-metric-label">Reveladas</span><strong>{accessibleCreatures.filter(creature => !creature.is_hidden).length}</strong><small>Conhecidas pelos jogadores</small></span></article>
          {isMaster ? (
            <article className="hb-metric"><span className="hb-metric-icon">◌</span><span className="hb-metric-content"><span className="hb-metric-label">Em segredo</span><strong>{creatures.filter(creature => creature.is_hidden).length}</strong><small>Exclusivas do mestre</small></span></article>
          ) : (
            <article className="hb-metric"><span className="hb-metric-icon">⚔</span><span className="hb-metric-content"><span className="hb-metric-label">Ameaças elevadas</span><strong>{accessibleCreatures.filter(creature => ['Alto','Extremo','Lua Inferior','Lua Superior','Lendário'].includes(creature.threat_level)).length}</strong><small>Desafios catalogados</small></span></article>
          )}
          <article className="hb-metric"><span className="hb-metric-icon">✧</span><span className="hb-metric-content"><span className="hb-metric-label">Categorias</span><strong>{Math.max(0, creatureCategories.length - 1)}</strong><small>Tipos encontrados</small></span></article>
        </div>

        <div className="hb-beast-library">
          <div className="hb-beast-library-head">
            <div><span className="hb-kicker">EXPLORAR REGISTROS</span><h3>Catálogo de criaturas</h3><p>Pesquise por nome, ameaça, descrição, resistência ou fraqueza.</p></div>
            <span className="hb-beast-result-count">{filteredCreatures.length} {filteredCreatures.length === 1 ? 'criatura' : 'criaturas'}</span>
          </div>

          <div className="bestiary-toolbar hb-bestiary-toolbar hb-beast-toolbar">
            <label className="hb-beast-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" aria-label="Pesquisar criaturas" placeholder="Pesquisar no bestiário..." value={creatureSearch} onChange={event => setCreatureSearch(event.target.value)}/>
            </label>
            <label className="hb-beast-filter"><span>Ameaça</span><select aria-label="Filtrar por nível de ameaça" value={creatureThreatFilter} onChange={event => setCreatureThreatFilter(event.target.value)}>{creatureThreatLevels.map(level => <option key={level} value={level}>{level === 'Todas' ? 'Todas as ameaças' : level}</option>)}</select></label>
            {isMaster && <label className="hb-beast-filter"><span>Visibilidade</span><select aria-label="Filtrar por visibilidade" value={creatureVisibilityFilter} onChange={event => setCreatureVisibilityFilter(event.target.value as 'all' | 'visible' | 'hidden')}><option value="all">Todos os registros</option><option value="visible">Revelados</option><option value="hidden">Ocultos</option></select></label>}
            <label className="hb-beast-filter"><span>Ordenar</span><select aria-label="Ordenar criaturas" value={creatureSortOrder} onChange={event => setCreatureSortOrder(event.target.value as 'name' | 'threat' | 'recent')}><option value="name">Nome A–Z</option><option value="threat">Maior ameaça</option><option value="recent">Mais recentes</option></select></label>
            <div className="hb-beast-view-toggle" role="group" aria-label="Modo de exibição"><button type="button" className={creatureViewMode === 'grid' ? 'active' : ''} aria-label="Visualizar cartões" aria-pressed={creatureViewMode === 'grid'} title="Cartões" onClick={() => setCreatureViewMode('grid')}>▦</button><button type="button" className={creatureViewMode === 'list' ? 'active' : ''} aria-label="Visualizar lista" aria-pressed={creatureViewMode === 'list'} title="Lista" onClick={() => setCreatureViewMode('list')}>☷</button></div>
          </div>
          <div className="hb-beast-category-row" aria-label="Categorias de criaturas">
            {creatureCategories.map(category => (
              <button type="button" key={category} className={creatureCategoryFilter === category ? 'active' : ''} aria-pressed={creatureCategoryFilter === category} onClick={() => setCreatureCategoryFilter(category)}>
                {category}<span>{category === 'Todas' ? accessibleCreatures.length : accessibleCreatures.filter(creature => creature.category === category).length}</span>
              </button>
            ))}
            {creatureFiltersActive && <button type="button" className="hb-beast-clear" onClick={resetCreatureFilters}>✕ Limpar filtros</button>}
          </div>

          {creaturesLoading ? (
            <div className="hb-beast-empty" role="status"><span className="hb-beast-empty-icon">◌</span><h3>Carregando registros...</h3><p>Consultando o catálogo da campanha.</p></div>
          ) : filteredCreatures.length === 0 ? (
            <div className="hb-beast-empty">
              <span className="hb-beast-empty-icon">♞</span>
              <h3>{accessibleCreatures.length === 0 ? 'Seu bestiário está esperando a primeira criatura' : 'Nenhuma criatura encontrada'}</h3>
              <p>{accessibleCreatures.length === 0 ? 'Os registros cadastrados pelo mestre aparecerão aqui.' : 'Tente outro termo ou remova os filtros para explorar mais registros.'}</p>
              {creatureFiltersActive && <button type="button" className="secondary-button" onClick={resetCreatureFilters}>Limpar filtros</button>}
              {isMaster && accessibleCreatures.length === 0 && <button type="button" className="primary-button" onClick={openNewCreatureForm}>＋ Cadastrar primeira criatura</button>}
            </div>
          ) : (
            <div className={`bestiary-creature-grid hb-beast-grid ${creatureViewMode === 'list' ? 'hb-beast-list-mode' : ''}`}>
              {filteredCreatures.map(creature => {
                const imageSrc = creature.image_display_url || (creature.image_url?.startsWith('http') ? creature.image_url : '')
                return <article key={creature.id} className={`bestiary-creature-card hb-bestiary-card hb-beast-card ${creature.is_hidden ? 'is-hidden' : ''}`} role="button" tabIndex={0} aria-label={`Abrir registro de ${creature.name}`} onClick={() => setSelectedCreatureId(creature.id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedCreatureId(creature.id) } }}>
                  <div className="hb-beast-card-media">
                    {imageSrc ? <img src={imageSrc} alt="" className="bestiary-creature-image" loading="lazy"/> : <div className="bestiary-creature-placeholder"><span aria-hidden="true">♞</span></div>}
                    <div className="hb-beast-card-shade"/>
                    <div className="hb-beast-card-top">
                      <span className={`hb-beast-threat hb-beast-threat-${creatureThreatTone(creature.threat_level)}`}>✦ {creature.threat_level}</span>
                      {isMaster && <button type="button" className="bestiary-creature-visibility hb-beast-visibility" title={creature.is_hidden ? 'Revelar aos jogadores' : 'Ocultar dos jogadores'} aria-label={creature.is_hidden ? `Revelar ${creature.name}` : `Ocultar ${creature.name}`} onClick={event => { event.stopPropagation(); void toggleCreatureVisibility(creature) }}>{creature.is_hidden ? '◌' : '◉'}</button>}
                    </div>
                    <span className="hb-beast-card-category">{creature.category}</span>
                  </div>
                  <div className="bestiary-creature-info hb-beast-card-body">
                    <h3>{creature.name}</h3>
                    <p className="hb-beast-card-description">{creature.description?.trim() || 'Nenhuma descrição registrada para esta criatura.'}</p>
                    <div className="hb-beast-card-resources" aria-label="Recursos da criatura">
                      <span><small>PV</small><strong>{creature.pv ?? '—'}</strong></span>
                      <span><small>PS</small><strong>{creature.ps ?? '—'}</strong></span>
                      <span><small>SG</small><strong>{creature.pr ?? '—'}</strong></span>
                    </div>
                    <div className="hb-beast-card-traits">
                      {(creature.resistances ?? []).length > 0 && <span>🛡 {creature.resistances.length} res.</span>}
                      {(creature.weaknesses ?? []).length > 0 && <span>⚠ {creature.weaknesses.length} fraq.</span>}
                      {(creature.immunities ?? []).length > 0 && <span>✧ {creature.immunities.length} imune</span>}
                    </div>
                    <div className="hb-beast-card-footer">
                      {isMaster ? <span className={`hb-beast-card-status ${creature.is_hidden ? 'secret' : ''}`}>{creature.is_hidden ? '◌ Oculta' : '◉ Revelada'}</span> : <span className="hb-beast-card-status">◉ Catalogada</span>}
                      <span className="hb-beast-card-open">Ver detalhes <span aria-hidden="true">↗</span></span>
                    </div>
                    {isMaster && <button type="button" className="hb-beast-card-edit" onClick={event => { event.stopPropagation(); openCreatureEditor(creature) }}>✎ Editar registro</button>}
                  </div>
                </article>
              })}
            </div>
          )}
        </div>

        {showCreatureForm && (
          <div className="bestiary-modal-overlay" role="presentation">
            <div className="bestiary-modal hb-beast-editor" role="dialog" aria-modal="true" aria-labelledby="hb-beast-editor-title">
              <div className="bestiary-modal-header hb-beast-editor-header">
                <div><span className="shops-eyebrow">✦ {editingCreatureId ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span><h2 id="hb-beast-editor-title">{editingCreatureId ? 'Editar criatura' : 'Cadastrar criatura'}</h2><p>Organize as informações que aparecerão no catálogo da campanha.</p></div>
                <button type="button" onClick={() => { setShowCreatureForm(false); setEditingCreatureId(null) }} disabled={creatureSaving} aria-label="Fechar">×</button>
              </div>
              <div className="bestiary-form hb-beast-editor-body">
                <section className="hb-beast-form-section">
                  <div className="hb-beast-form-heading"><span>01</span><div><h3>Identidade</h3><p>Como a criatura será reconhecida no bestiário.</p></div></div>
                  <label>Nome da criatura *<input type="text" maxLength={100} value={creatureName} onChange={event => setCreatureName(event.target.value)} placeholder="Ex.: Oni das Sombras"/></label>
                  <div className="bestiary-form-row"><label>Categoria<select value={creatureCategory} onChange={event => setCreatureCategory(event.target.value)}>{['Outros', 'Humanoide', 'Fera', 'Monstro', 'Espírito', 'Demônio', 'Morto-vivo', 'Chefe', ...(isKisatsutaiSystem ? Object.keys(KISATSUTAI_ONI_CLASSES).map(name => `Oni ${name}`) : [])].map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>Nível de ameaça<select value={creatureThreatLevel} onChange={event => setCreatureThreatLevel(event.target.value)}>{['Comum','Baixo','Moderado','Alto','Extremo',...(isKisatsutaiSystem ? ['Lua Inferior','Lua Superior'] : []),'Lendário'].map(level => <option key={level} value={level}>{level}</option>)}</select></label></div>
                  {isKisatsutaiSystem && creatureCategory.startsWith('Oni ') && <p className="kisatsutai-oni-hint">{KISATSUTAI_ONI_CLASSES[creatureCategory.slice(4) as keyof typeof KISATSUTAI_ONI_CLASSES] || ''}</p>}<label>Descrição<textarea value={creatureDescription} onChange={event => setCreatureDescription(event.target.value)} placeholder="Aparência, comportamento, origem e informações importantes..." rows={4}/></label>
                </section>
                <section className="hb-beast-form-section">
                  <div className="hb-beast-form-heading"><span>02</span><div><h3>Retrato</h3><p>PNG, JPG ou WebP, até 5 MB. A imagem é exibida nos cartões e na ficha.</p></div></div>
                  <div className="hb-beast-upload-row">
                    <div className="hb-beast-upload-preview">{(creatureImagePreview || creatureStoredImagePreview || creatureImageUrl) ? <img src={creatureImagePreview || creatureStoredImagePreview || creatureImageUrl} alt="Pré-visualização da criatura"/> : <span aria-hidden="true">♞</span>}</div>
                    <label className="hb-beast-upload-label">Selecionar imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0] ?? null; if (file && file.size > 5 * 1024 * 1024) { setError('A imagem deve ter no máximo 5 MB.'); setCreatureImageFile(null); event.target.value = ''; return } setCreatureImageFile(file) }}/><small>{creatureImageFile?.name || (creatureStoredImagePreview ? 'Imagem atual preservada' : 'Nenhuma imagem selecionada')}</small></label>
                  </div>
                </section>
                <section className="hb-beast-form-section">
                  <div className="hb-beast-form-heading"><span>03</span><div><h3>Recursos</h3><p>Valores de referência para consulta rápida.</p></div></div>
                  <div className="bestiary-form-row bestiary-stats-row"><label>PV<input type="number" min="0" value={creaturePv} onChange={event => setCreaturePv(event.target.value)} placeholder="—"/></label><label>PS<input type="number" min="0" value={creaturePs} onChange={event => setCreaturePs(event.target.value)} placeholder="—"/></label><label>SG · Sangue<input type="number" min="0" value={creaturePr} onChange={event => setCreaturePr(event.target.value)} placeholder="—"/></label></div>
                </section>
                <section className="hb-beast-form-section">
                  <div className="hb-beast-form-heading"><span>04</span><div><h3>Características</h3><p>Insira uma característica por linha.</p></div></div>
                  <div className="hb-beast-trait-inputs"><label>🛡 Resistências<textarea value={creatureResistances} onChange={event => setCreatureResistances(event.target.value)} placeholder={'Fogo\nCorte'} rows={3}/></label><label>⚠ Fraquezas<textarea value={creatureWeaknesses} onChange={event => setCreatureWeaknesses(event.target.value)} placeholder={'Água\nLuz'} rows={3}/></label><label>✧ Imunidades<textarea value={creatureImmunities} onChange={event => setCreatureImmunities(event.target.value)} placeholder={'Veneno\nMedo'} rows={3}/></label><label>✦ Peculiaridades<textarea value={creaturePeculiarities} onChange={event => setCreaturePeculiarities(event.target.value)} placeholder={'Olhos brilhantes\nAudição sobrenatural'} rows={3}/></label>{isKisatsutaiSystem && <label>⛓ Vícios<textarea value={creatureVices} onChange={event => setCreatureVices(event.target.value)} placeholder={'Obsessão por sangue\nCompulsão por desafios'} rows={3}/></label>}</div>
                </section>
              </div>
              <div className="bestiary-modal-actions hb-beast-editor-actions"><button type="button" disabled={creatureSaving} onClick={() => { setShowCreatureForm(false); setEditingCreatureId(null) }}>Cancelar</button><button type="button" disabled={creatureSaving || !creatureName.trim()} onClick={() => void saveCreature()}>{creatureSaving ? 'Salvando…' : editingCreatureId ? 'Salvar alterações' : 'Cadastrar criatura'}</button></div>
            </div>
          </div>
        )}

        {selectedCreature && (
          <div className="bestiary-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedCreatureId(null) }}>
            <div className="bestiary-modal bestiary-detail-modal hb-beast-detail" role="dialog" aria-modal="true" aria-labelledby="hb-beast-detail-title">
              <div className="hb-beast-detail-hero">
                {selectedCreature.image_display_url || selectedCreature.image_url?.startsWith('http') ? <img src={selectedCreature.image_display_url || selectedCreature.image_url || ''} alt=""/> : <div className="hb-beast-detail-placeholder" aria-hidden="true">♞</div>}
                <div className="hb-beast-detail-shade"/>
                <div className="hb-beast-detail-identity"><span className={`hb-beast-threat hb-beast-threat-${creatureThreatTone(selectedCreature.threat_level)}`}>✦ {selectedCreature.threat_level}</span><span className="hb-beast-detail-category">{selectedCreature.category}</span><h2 id="hb-beast-detail-title">{selectedCreature.name}</h2><p>{isMaster ? (selectedCreature.is_hidden ? '◌ Registro oculto dos jogadores' : '◉ Registro revelado aos jogadores') : '◉ Registro do bestiário'}</p></div>
                <button type="button" className="hb-beast-detail-close" onClick={() => setSelectedCreatureId(null)} aria-label="Fechar detalhes">×</button>
              </div>
              <div className="hb-beast-detail-content">
                <div className="hb-beast-detail-stats"><article><span>❤ PONTOS DE VIDA</span><strong>{selectedCreature.pv ?? '—'}</strong><small>PV</small></article><article><span>◈ SANIDADE</span><strong>{selectedCreature.ps ?? '—'}</strong><small>PS</small></article><article><span>◆ PONTOS DE SANGUE</span><strong>{selectedCreature.pr ?? '—'}</strong><small>SG</small></article></div>
                {isKisatsutaiSystem && selectedCreature.category.startsWith('Oni ') && <section className="hb-beast-detail-section"><h3>Classificação de Oni</h3><p>{KISATSUTAI_ONI_CLASSES[selectedCreature.category.slice(4) as keyof typeof KISATSUTAI_ONI_CLASSES] || ''}</p></section>}{selectedCreature.description && <section className="hb-beast-detail-section"><div className="hb-beast-detail-section-title"><span>01</span><h3>Sobre a criatura</h3></div><p>{selectedCreature.description}</p></section>}
                <div className="hb-beast-detail-traits">{[
                  {title:'Resistências', icon:'🛡', items:selectedCreature.resistances ?? [], tone:'resistance'},
                  {title:'Fraquezas', icon:'⚠', items:selectedCreature.weaknesses ?? [], tone:'weakness'},
                  {title:'Imunidades', icon:'✧', items:selectedCreature.immunities ?? [], tone:'immunity'},
                   {title:'Peculiaridades', icon:'✦', items:readCreatureTraits(selectedCreature, 'peculiarities'), tone:'peculiarity'},
                   ...(isKisatsutaiSystem ? [{title:'Vícios', icon:'⛓', items:readCreatureTraits(selectedCreature, 'vices'), tone:'vice'}] : []),
                ].map(section => <section key={section.title} className={`hb-beast-trait-panel hb-beast-trait-${section.tone}`}><h3><span>{section.icon}</span>{section.title}<small>{section.items.length}</small></h3>{section.items.length > 0 ? <div className="hb-beast-trait-tags">{section.items.map((item,index) => <span key={`${item}-${index}`}>{item}</span>)}</div> : <p>Não registradas.</p>}</section>)}</div>
                <div className="hb-beast-detail-actions"><button type="button" className="secondary-button" onClick={() => setSelectedCreatureId(null)}>← Voltar ao catálogo</button>{isMaster && <button type="button" className="primary-button" onClick={() => { const creature = selectedCreature; setSelectedCreatureId(null); openCreatureEditor(creature) }}>✎ Editar criatura</button>}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}
  </section>
)}

{activePage === 'shops' && (
  <section className="inventory-section shops-page-panel">
    {!selectedCampaignId ? (
      <div className="empty-state">
        <h3>Nenhuma campanha selecionada</h3>
        <p>Selecione uma campanha para acessar suas lojas.</p>
      </div>
    ) : (
      <>
        <div className="inventory-heading shops-heading hb-hero hb-shops-hero">
          <div>
            <span className="hb-kicker">♜ COMÉRCIO DA CAMPANHA</span>
            <h2>Mercado da campanha<span className="hb-title-dot">.</span></h2>
            <p>
              {isMaster
                ? 'Administre estabelecimentos e seus produtos.'
                : 'Confira os produtos disponíveis para sua aventura.'}
            </p>
          </div>

          {isMaster && (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setEditingShopId(null)
                setShopName('')
                setShopDescription('')
                setShowShopForm(value => !value)
              }}
            >
              + Nova loja
            </button>
          )}
        </div>

        <div className="hb-market-metrics hb-metric-grid">
          <article className="hb-metric"><span className="hb-metric-icon">♜</span><span className="hb-metric-content"><span className="hb-metric-label">Estabelecimentos</span><strong>{shops.length}</strong><small>Lojas cadastradas</small></span></article>
          <article className="hb-metric"><span className="hb-metric-icon">✧</span><span className="hb-metric-content"><span className="hb-metric-label">Loja selecionada</span><strong className="hb-metric-name">{shops.find(shop => shop.id === selectedShopId)?.name || 'Nenhuma'}</strong><small>Escolha ao lado para explorar</small></span></article>
          <article className="hb-metric"><span className="hb-metric-icon">▣</span><span className="hb-metric-content"><span className="hb-metric-label">Produtos</span><strong>{selectedShopId ? shopItems.filter(item => item.shop_id === selectedShopId).length : 0}</strong><small>Na loja selecionada</small></span></article>
        </div>
        {isMaster && showShopForm && (
          <form
            className="add-form hb-form hb-market-form"
            onSubmit={event => {
              event.preventDefault()
              void saveShop()
            }}
          >
            <h3>{editingShopId ? 'Editar loja' : 'Criar loja'}</h3>

            <label style={labelStyle}>
              Nome da loja
              <input
                value={shopName}
                onChange={event => setShopName(event.target.value)}
                placeholder="Ex.: Mercado de Eldoria"
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Descrição
              <textarea
                value={shopDescription}
                onChange={event => setShopDescription(event.target.value)}
                placeholder="Conte um pouco sobre este estabelecimento..."
                style={inputStyle}
              />
            </label>

            <div className="form-row">
              <button
                className="primary-button"
                type="submit"
                disabled={shopLoading}
              >
                {shopLoading ? 'Salvando...' : 'Salvar loja'}
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowShopForm(false)
                  setEditingShopId(null)
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {shopLoading && shops.length === 0 ? (
          <div className="empty-state">
            <p>Carregando lojas...</p>
          </div>
        ) : shops.length === 0 ? (
          <div className="empty-state">
            <h3>Esta campanha ainda não possui lojas</h3>
            <p>
              {isMaster
                ? 'Crie a primeira loja para começar a montar o catálogo.'
                : 'O mestre ainda não cadastrou nenhum estabelecimento.'}
            </p>
          </div>
        ) : (
          <>
            <div className="shops-workspace">
  <aside className="shops-sidebar">
    <div className="shops-sidebar-heading">
      <div>
        <span>EXPLORAÇÃO</span>
        <h3>Estabelecimentos</h3>
      </div>
      <span className="shops-count">{shops.length}</span>
    </div>

    <div className="shops-sidebar-list">
              {shops.map(shop => {
                const isSelected = selectedShopId === shop.id

                return (
                  <article
                    className={`item-card shop-card ${isSelected ? 'is-selected' : ''}`}
                    key={shop.id}
                    style={{
                      borderColor: isSelected
                        ? 'var(--season-primary, #b49aff)'
                        : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedShopId(shop.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="item-art">🏪</div>
                      <h3>{shop.name}</h3>
                      <p className="item-description">
                        {shop.description || 'Um estabelecimento da campanha.'}
                      </p>
                      <small>
                        {shopItems.filter(item => item.shop_id === shop.id).length}
                        {' '}produto(s)
                      </small>
                    </button>

                    {isMaster && (
                      <div className="form-row" style={{ marginTop: 12 }}>
                        <button
  type="button"
  className="secondary-button"
  disabled={shopLoading}
  onClick={() => void toggleShopVisibility(shop)}
>
  {shopLoading
    ? 'Atualizando...'
    : shop.is_visible
      ? 'Ocultar dos jogadores'
      : 'Revelar aos jogadores'}
</button>
<small
  style={{
    display: 'block',
    marginTop: 8,
    color: 'var(--season-muted, #b9b4c2)',
  }}
>
  {shop.is_visible
    ? '🌐 Visível para os jogadores'
    : '🔒 Oculta para os jogadores'}
</small>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editShop(shop)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={shopLoading}
                          onClick={() => void deleteShop(shop)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
    </div>
  </aside>

  <main className="shops-main">
    {selectedShopId ? (
      <div style={{ marginTop: 0 }}>
                {(() => {
                  const selectedShop = shops.find(
                    shop => shop.id === selectedShopId
                  )

                  if (!selectedShop) return null

                  const visibleItems = shopItems.filter(
                    item => item.shop_id === selectedShopId
                  )

                  return (
                    <>
<div className="shops-hero">
  <div className="shops-hero-main">
    <div className="shops-hero-icon">🏪</div>

    <div className="shops-hero-copy">
      <span className="shops-eyebrow">✦ ESTABELECIMENTO SELECIONADO</span>
      <h2>{selectedShop.name}</h2>
      <p>Gerencie o catálogo e acompanhe as atividades comerciais deste estabelecimento.</p>

      <div className="shops-hero-meta">
        <span>📦 {visibleItems.length} produto{visibleItems.length === 1 ? '' : 's'} no catálogo</span>
      </div>
    </div>
  </div>

  {isMaster && (
    <button
      type="button"
      className="primary-button shops-new-product-button"
      onClick={() => {
        setEditingShopItemId(null)
        setShopItemName('')
        setShopItemDescription('')
        setShopItemCategory('Diversos')
        setShopItemRarity('comum')
        setShopItemWeight('0')
        setShopItemPrice('0')
        setShopItemCurrencyId(selectedCampaign?.currency_config?.currencies?.[0]?.id ?? '')
        setShopItemStock('')
        setShopItemEmoji('📦')
        setShopItemCategories(['Diversos'])
        setShopItemEquipmentType('none')
        setShopCyberneticCategory('Outro')
        setShopCyberneticLocation('')
        setShopCyberneticLoad('0')
        setShopCyberneticEffects('')
        setShopItemArmorClass('leve')
        setShopItemArmorCoverage('cortante_perfurante')
        setShopItemProtectionTier('basica')
        setShopItemProtectionMode('resistencia')
        setShopItemWeaponClass('improvised')
        setShopItemScarcityLevel('1')
        setShopItemScarcityExhausted(false)
        setShowShopItemForm(value => !value)
      }}
    >
      <span>＋</span> Novo produto
    </button>
  )}
</div>

{true && (
  <section className="inventory-section" style={{ marginBottom: 24 }}>
    <div className="inventory-heading">
      <div>
        <h2>Vender itens</h2>
        <p>Venda itens do inventário do seu personagem para esta loja.</p>
      </div>
    </div>

    <label style={labelStyle}>
      Personagem
      <select
        value={selectedCharacterId}
        onChange={event => setSelectedCharacterId(event.target.value)}
        style={inputStyle}
      >
        {characters
          .filter(character => character.user_id === session?.user.id)
          .map(character => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
      </select>
    </label>

    <div className="item-grid">
      {items
        .filter(item => item.character_id === selectedCharacterId)
        .map(item => (
          <article className="item-card shop-sale-item-card" key={item.id}>
            <div className="item-art">
              {typeof item.metadata?.icon === 'string'
                ? item.metadata.icon
                : '📦'}
            </div>

            <h3 className="shop-sale-item-name" title={item.name}>{item.name}</h3>
            <p>Disponível: {item.quantity}</p>
            <p>
              Valor unitário: {Number(item.unit_price).toLocaleString('pt-BR')}
            </p>

            <label style={labelStyle}>
              Quantidade
              <input
                type="number"
                min="1"
                max={item.quantity}
                value={shopSaleQuantities[item.id] ?? '1'}
                onChange={event =>
                  setShopSaleQuantities(current => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              disabled={saleLoading || !!item.sale_blocked}
              onClick={() =>
                void sellInventoryItem(
                  item,
                  Number(shopSaleQuantities[item.id] ?? '1')
                )
              }
            >
              {item.sale_blocked
                ? 'Venda bloqueada'
                : saleLoading
                  ? 'Vendendo...'
                  : 'Vender'}
            </button>
          </article>
        ))}
    </div>
  </section>
)}

                      {isMaster && showShopItemForm && (
                        <form
                          className="add-form shop-item-editor"
                          onSubmit={event => {
                            event.preventDefault()
                            void saveShopItem()
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(220px, .8fr)',
                            gap: 22,
                            alignItems: 'start',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ marginBottom: 20 }}>
                              <h3 style={{ marginBottom: 6 }}>
                                {editingShopItemId ? 'Editar produto' : 'Novo produto'}
                              </h3>
                              <p style={{ margin: 0, color: 'var(--season-muted, #aaa)' }}>
                                Preencha as informações para adicionar este item ao catálogo de {selectedShop.name}.
                              </p>
                            </div>

<div className="shop-editor-section shop-editor-identification" style={{ marginBottom: 20 }}>
                              <label style={labelStyle}>
                                Nome do produto
                                <input
                                  value={shopItemName}
                                  onChange={event => setShopItemName(event.target.value)}
                                  placeholder="Ex.: Poção de cura menor"
                                  required
                                  maxLength={80}
                                  style={inputStyle}
                                />
                              </label>

                              <label style={labelStyle}>
                                Descrição
                                <textarea
                                  value={shopItemDescription}
                                  onChange={event => setShopItemDescription(event.target.value)}
                                  placeholder="Descreva os efeitos, a aparência ou alguma característica..."
                                  rows={3}
                                  maxLength={500}
                                  style={{ ...inputStyle, resize: 'vertical' }}
                                />
                                <small style={{ color: 'var(--season-muted, #aaa)' }}>
                                  {shopItemDescription.length}/500 caracteres
                                </small>
                              </label>

                              <section className="item-classifications-panel">
                                <div className="item-classifications-heading">
                                  <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. O produto terá as mesmas categorias quando comprado.</p></div>
                                  <span>{shopItemCategories.length} selecionada{shopItemCategories.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="item-classifications-grid">
                                  {categories.filter(category => category !== 'Todos').map(category => (
                                    <label key={category} className={shopItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                                      <input type="checkbox" checked={shopItemCategories.includes(category)} onChange={event => {
                                        let next = event.target.checked ? [...shopItemCategories, category] : shopItemCategories.filter(value => value !== category)
                                // Alimentos são sempre consumíveis e seguem a escassez.
                                if (category === 'Alimentos' && event.target.checked && !next.includes('Consumíveis')) next = [...next, 'Consumíveis']
                                if (category === 'Consumíveis' && !event.target.checked) next = next.filter(value => value !== 'Alimentos')
                                        setShopItemCategories(next)
                                        if (next.length) setShopItemCategory(next[0])
                                        const automaticWeight = getAutomaticItemWeight(next, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass)
                                        if (automaticWeight !== null) setShopItemWeight(String(automaticWeight))
                                      }} />
                                      <span className="item-classification-check">{shopItemCategories.includes(category) ? '✓' : '+'}</span>
                                      <span>{category}</span>
                                    </label>
                                  ))}
                                </div>
                                {!shopItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                              </section>

                              <div className="item-rarity-field">
                                <label htmlFor="shop-item-rarity">Raridade</label>
                                <select id="shop-item-rarity" value={shopItemRarity} onChange={event => setShopItemRarity(event.target.value)}>
                                  <option value="comum">Comum</option><option value="incomum">Incomum</option><option value="raro">Raro</option><option value="épico">Épico</option><option value="mítico">Mítico</option><option value="relíquia">Relíquia</option>
                                </select>
                              </div>

                              {shopItemCategories.includes('Equipamento') && <><label style={labelStyle}>Tipo de equipamento
<select
  value={shopItemEquipmentType}
  onChange={event => {
    const nextType = event.target.value as 'none' | 'armor' | 'protection' | 'cybernetic'
    setShopItemEquipmentType(nextType)
    const automaticWeight = getAutomaticItemWeight(
      shopItemCategories,
      nextType,
      shopItemArmorClass,
      shopItemWeaponClass
    )
    if (automaticWeight !== null) setShopItemWeight(String(automaticWeight))
  }}
  style={inputStyle}
>
  <option value="none">Item comum</option>
  <option value="armor">Armadura</option>
<option value="protection">Proteção</option>
{isCyberFlowerSystem && (
  <option value="cybernetic">Cibernética</option>
)}
</select>
                              </label>

                              {shopItemEquipmentType === 'armor' && <>
                                <label style={labelStyle}>Tipo de armadura<select value={shopItemArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setShopItemArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, nextClass, shopItemWeaponClass); if (automaticWeight !== null) setShopItemWeight(String(automaticWeight)) }} style={inputStyle}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                                {shopItemArmorClass !== 'pesada' && <label style={labelStyle}>Tipos de dano protegidos<select value={shopItemArmorCoverage} onChange={event => setShopItemArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')} style={inputStyle}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                                <div className="equipment-rules-preview"><strong>Regras da armadura</strong><p>Carga: {shopItemArmorClass === 'leve' ? 2 : shopItemArmorClass === 'media' ? 4 : 6} kg</p><p>Proteção: {shopItemArmorClass === 'leve' ? '(Resistência ÷ 2) + 4' : shopItemArmorClass === 'media' ? 'Resistência + 6' : '(Resistência × 2) + 8'}</p><p>Destreza: {shopItemArmorClass === 'leve' ? 'Integral' : shopItemArmorClass === 'media' ? '½ dos pontos' : '0'}</p><p>Penalidades: {shopItemArmorClass === 'media' ? '−5 em Reflexo; metade do deslocamento' : shopItemArmorClass === 'pesada' ? '−10 em Reflexo e Corrida; ¼ do deslocamento' : 'Sem penalidade'}</p></div>
                              </>}

                              {shopItemEquipmentType === 'protection' && <>
                                <label style={labelStyle}>Nível de proteção<select value={shopItemProtectionTier} onChange={event => setShopItemProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')} style={inputStyle}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                                <label style={labelStyle}>Tipo de resistência<select value={shopItemProtectionMode} onChange={event => setShopItemProtectionMode(event.target.value as 'resistencia' | 'sanidade')} style={inputStyle}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                                <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0 kg</p><p>Proteção: {shopItemProtectionTier === 'basica' ? '¼' : shopItemProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {shopItemProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {shopItemProtectionTier === 'basica' ? '1d8' : shopItemProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                              </>}


{isCyberFlowerSystem && shopItemEquipmentType === 'cybernetic' && <>
  <label style={labelStyle}>
    Categoria da cibernética
    <select
      value={shopCyberneticCategory}
      onChange={event => setShopCyberneticCategory(event.target.value)}
      style={inputStyle}
    >
      <option value="Neurológico">Neurológico</option>
      <option value="Sensorial">Sensorial</option>
      <option value="Órgãos">Órgãos</option>
      <option value="Membros">Membros</option>
      <option value="Estrutural">Estrutural</option>
      <option value="Armamento">Armamento</option>
      <option value="Suporte">Suporte</option>
      <option value="Outro">Outro</option>
    </select>
  </label>

  <label style={labelStyle}>
    Localização no corpo
    <input
      value={shopCyberneticLocation}
      onChange={event => setShopCyberneticLocation(event.target.value)}
      placeholder="Ex.: Braço esquerdo, coluna, crânio..."
      style={inputStyle}
    />
  </label>

  <label style={labelStyle}>
    Carga biológica
    <input
      type="number"
      min="0"
      step="1"
      value={shopCyberneticLoad}
      onChange={event => setShopCyberneticLoad(event.target.value)}
      style={inputStyle}
    />
  </label>

  <label style={labelStyle}>
    Efeitos da cibernética
    <textarea
      value={shopCyberneticEffects}
      onChange={event => setShopCyberneticEffects(event.target.value)}
      placeholder="Descreva os efeitos e benefícios do implante..."
      style={inputStyle}
    />
  </label>
</>}
                              </>}

                              {shopItemCategories.includes('Armas') && <>
                                <label style={labelStyle}>Classificação da arma<select value={shopItemWeaponClass} onChange={event => { const nextClass = event.target.value; setShopItemWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, nextClass); if (automaticWeight !== null) setShopItemWeight(String(automaticWeight)) }} style={inputStyle}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                                <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[shopItemWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[shopItemWeaponClass]} kg</p></div>
                              </>}

                              {shopItemCategories.includes('Consumíveis') && <section className="scarcity-editor-card"><div className="scarcity-editor-heading"><span className="scarcity-editor-icon">⌛</span><div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div></div><label>Nível inicial de escassez<select value={shopItemScarcityLevel} onChange={event => setShopItemScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}><option value="1">Nível 1 — d12</option><option value="2">Nível 2 — d8</option><option value="3">Nível 3 — d6</option><option value="4">Nível 4 — d4</option></select></label><div className="scarcity-level-preview"><div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[shopItemScarcityLevel]}</strong></div><div><span>Carga</span><strong>{{ '1': 7, '2': 5, '3': 3, '4': 1 }[shopItemScarcityLevel]}</strong></div></div><p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p><label className="scarcity-exhausted-toggle"><input type="checkbox" checked={shopItemScarcityExhausted} onChange={event => setShopItemScarcityExhausted(event.target.checked)} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label></section>}

                            </div>

                            <div style={{ marginBottom: 20 }}>
                              <strong className="shop-editor-section-title">Preço e inventário</strong>
                              <div className="form-row">
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Preço por unidade
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shopItemPrice}
                                    onChange={event => setShopItemPrice(event.target.value)}
                                    style={inputStyle}
                                  />
                                </label>
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Moeda
                                  <select
                                    value={shopItemCurrencyId}
                                    onChange={event => setShopItemCurrencyId(event.target.value)}
                                    style={inputStyle}
                                  >
                                    <option value="">Sem moeda definida</option>
                                    {(selectedCampaign?.currency_config?.currencies ?? []).map((currency, index) => (
                                      <option key={currency.id} value={currency.id}>
                                        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="form-row">
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Estoque disponível
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={shopItemStock}
                                    onChange={event => setShopItemStock(event.target.value)}
                                    placeholder="Ilimitado"
                                    style={inputStyle}
                                  />
                                  <small style={{ color: 'var(--season-muted, #aaa)' }}>
                                    Deixe vazio para não limitar a quantidade.
                                  </small>
                                </label>
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Peso por unidade (kg)
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shopItemWeight}
                                    onChange={event => setShopItemWeight(event.target.value)}
                                    disabled={getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass) !== null}
                                    style={inputStyle}
                                  />
                                  <small style={{ color: 'var(--season-muted, #aaa)' }}>{getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass) !== null ? 'Peso definido automaticamente pelas regras do equipamento.' : 'Informe o peso por unidade deste item.'}</small>
                                </label>
                              </div>
                            </div>

<div className="shop-editor-icon-section">
  <strong className="shop-editor-section-title">Ícone do produto</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {availableEmojis.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    aria-label={`Usar ícone ${emoji}`}
                                    aria-pressed={shopItemEmoji === emoji}
                                    onClick={() => setShopItemEmoji(emoji)}
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 10,
                                      border: `1px solid ${shopItemEmoji === emoji ? 'var(--season-primary, #b49aff)' : 'var(--season-line, #44375f)'}`,
                                      background: shopItemEmoji === emoji ? 'var(--season-surface-alt, rgba(180,154,255,.16))' : 'var(--season-surface, transparent)',
                                      color: 'inherit',
                                      fontSize: 19,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <label style={{ ...labelStyle, marginTop: 12 }}>
                                Ou informe outro emoji
                                <input
                                  value={shopItemEmoji}
                                  onChange={event => setShopItemEmoji(event.target.value)}
                                  placeholder="📦"
                                  style={{ ...inputStyle, maxWidth: 150 }}
                                  maxLength={8}
                                />
                              </label>
                            </div>

                            <div className="shop-editor-actions" style={{ marginTop: 24 }}>
                              <button
                                type="button"
                                className="primary-button"
                                disabled={shopLoading}
                                onClick={() => void saveShopItem()}
                              >
                                {shopLoading ? 'Salvando...' : editingShopItemId ? 'Salvar alterações' : 'Adicionar ao catálogo'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={shopLoading}
                                onClick={() => {
                                  setShowShopItemForm(false)
                                  setEditingShopItemId(null)
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>

<aside
  className="shop-editor-preview"
  aria-label="Prévia do produto"
                            style={{
                              position: 'sticky',
                              top: 18,
                              padding: 18,
                              borderRadius: 16,
                              border: '1px solid var(--season-line, rgba(180,154,255,.25))',
                              background: 'var(--season-surface, rgba(20,18,30,.7))',
                              minWidth: 0,
                            }}
                          >
                            <small style={{ color: 'var(--season-muted, #aaa)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                              Prévia no catálogo
                            </small>
                            <div style={{ textAlign: 'center', padding: '22px 8px 18px' }}>
                              <div style={{ fontSize: 52, lineHeight: 1.2, marginBottom: 12 }}>
                                {shopItemEmoji || '📦'}
                              </div>
                              <div className="item-category">{shopItemCategory.trim() || 'Diversos'}</div>
                              <div style={{ display: 'inline-flex', marginTop: 7, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--season-line)', color: 'var(--season-primary)', fontSize: 11, textTransform: 'capitalize' }}>{shopItemRarity}</div>
                              <h3 style={{ margin: '8px 0' }}>{shopItemName.trim() || 'Nome do produto'}</h3>
                              <p className="item-description" style={{ minHeight: 42 }}>
                                {shopItemDescription.trim() || 'A descrição do produto aparecerá aqui.'}
                              </p>
                            </div>
                            <div style={{ borderTop: '1px solid var(--season-line, rgba(180,154,255,.2))', paddingTop: 14, display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Preço</span>
                                <strong>
                                  {(() => {
                                    const currency = selectedCampaign?.currency_config?.currencies?.find(item => item.id === shopItemCurrencyId)
                                    const price = Number(shopItemPrice.replace(',', '.'))
                                    return price > 0 ? `${currency?.symbol ?? ''}${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` · ${currency.name}` : ''}` : 'Gratuito'
                                  })()}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Estoque</span>
                                <strong>{shopItemStock.trim() === '' ? 'Ilimitado' : `${shopItemStock} un.`}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Peso</span>
                                <strong>{shopItemWeight || '0'} kg</strong>
                              </div>
                            </div>
                          </aside>
                        </form>
                      )}

                      {visibleItems.length === 0 ? (
                        <div className="empty-state">
                          <h3>Catálogo vazio</h3>
                          <p>Esta loja ainda não possui produtos.</p>
                        </div>
                      ) : (
                        <div className="item-grid">
                          {visibleItems.map(item => {
                            const currency = selectedCampaign?.currency_config?.currencies?.find(
                              entry => entry.id === item.currency_id
                            )

                            const outOfStock =
                              item.quantity !== null && item.quantity <= 0

                            return (
<article className="item-card shop-product-card" key={item.id}>
  <div className="shop-product-top">
    <div className="item-art shop-product-art">
      {typeof item.metadata?.icon === 'string'
        ? item.metadata.icon
        : '📦'}
    </div>

    <span className={`shop-product-status ${outOfStock ? 'is-empty' : ''}`}>
      {outOfStock ? 'Esgotado' : 'Disponível'}
    </span>
  </div>

  <div className="item-category shop-product-category">
    {item.category}
  </div>

  <h3 className="shop-product-title">{item.name}</h3>

  <p className="item-description">
    {item.description || 'Sem descrição.'}
  </p>

  <div className="shop-product-economics">
    <div className="shop-product-price">
      <span>Preço por unidade</span>
      <strong>
        {currency?.symbol ?? ''}{' '}
        {Number(item.unit_price).toLocaleString('pt-BR')}
      </strong>
    </div>

    <div className="shop-product-weight">
      <span>Peso</span>
      <strong>
        {Number(item.weight).toLocaleString('pt-BR')} kg
      </strong>
    </div>
  </div>

  <p className={`shop-product-stock ${outOfStock ? 'is-empty' : ''}`}>
    <span className="shop-stock-dot" />
    {item.quantity === null
      ? 'Estoque ilimitado'
      : outOfStock
        ? 'Esgotado'
        : `Disponível: ${item.quantity} unidade(s)`}
  </p>

  {isMaster && (
    <div className="shop-product-admin">
      <div className="shop-product-admin-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => editShopItem(item)}
        >
          Editar
        </button>

        <button
          type="button"
          className="secondary-button"
          disabled={shopLoading}
          onClick={() => void deleteShopItem(item)}
        >
          Excluir
        </button>
      </div>

      <label className="shop-product-restriction">
        <input
          type="checkbox"
          className="restriction-checkbox"
          checked={!!item.purchase_blocked}
          onChange={event =>
            void setItemRestriction(
              'shop',
              item.id,
              event.target.checked
            )
          }
        />
        Bloquear compra pelos jogadores
      </label>
    </div>
  )}

  <div className="shop-product-purchase">
    <label className="shop-purchase-field" style={labelStyle}>
      Comprar para
      <select
        value={shopPurchaseCharacterId}
        onChange={event => setShopPurchaseCharacterId(event.target.value)}
        style={inputStyle}
      >
        <option value="">Selecione seu personagem</option>
        {characters
          .filter(character => character.user_id === session?.user.id)
          .map(character => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
      </select>
    </label>

    <label className="shop-purchase-field" style={labelStyle}>
      Quantidade
      <input
        type="number"
        min="1"
        max={item.quantity === null ? undefined : item.quantity}
        value={shopPurchaseQuantities[item.id] ?? '1'}
        onChange={event =>
          setShopPurchaseQuantities(current => ({
            ...current,
            [item.id]: event.target.value,
          }))
        }
        style={inputStyle}
      />
      {item.quantity !== null && (
        <small>Disponível: {item.quantity} unidade(s)</small>
      )}
    </label>

    {item.purchase_blocked && (
      <p className="shop-product-blocked">
        🔒 Compra bloqueada pelo mestre.
      </p>
    )}

    <button
      type="button"
      className="primary-button shop-buy-button"
      disabled={
        outOfStock ||
        !!item.purchase_blocked ||
        shopPurchaseLoading !== null ||
        !shopPurchaseCharacterId ||
        !characters.some(character =>
          character.id === shopPurchaseCharacterId &&
          character.user_id === session?.user.id
        )
      }
      onClick={() =>
        void purchaseShopItem(
          item,
          Number(shopPurchaseQuantities[item.id] ?? '1')
        )
      }
    >
      {shopPurchaseLoading === item.id
        ? 'Comprando...'
        : item.purchase_blocked
          ? 'Compra bloqueada'
          : outOfStock
            ? 'Esgotado'
            : `Comprar ${shopPurchaseQuantities[item.id] ?? '1'} unidade(s)`}
    </button>
  </div>
</article>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )
                })()}
      </div>
    ) : (
      <div className="shops-empty-selection">
        <span>🏪</span>
        <h3>Escolha um estabelecimento</h3>
        <p>
          Selecione uma loja na lista ao lado para visualizar
          seu catálogo e realizar operações comerciais.
        </p>
      </div>
    )}
  </main>
</div>
          </>
        )}
      </>
    )}
  </section>
)}

          {activePage === 'campaigns' && <section className="inventory-section campaigns-page-panel hb-campaigns-page">
            <header className="hb-hero hb-campaigns-hero">
              <div><span className="hb-kicker">⚑ ADMINISTRAÇÃO</span><h2>Campanhas<span className="hb-title-dot">.</span></h2><p>Organize mundos, temporadas, participantes e o acesso aos personagens.</p><div className="hb-hero-tags"><span>{campaigns.length} {campaigns.length === 1 ? 'campanha' : 'campanhas'}</span><span>{seasons.length} temporadas na atual</span><span>{campaignMembers.length} membros</span></div></div>
              <button type="button" className="primary-button" onClick={() => { setShowCampaignForm(true); setEditingCampaignId(null); setCampaignName(''); setCampaignDescription(''); setCampaignSystemChoice(''); setSystemName('') }}>＋ Criar campanha</button>
            </header>
            <div className="hb-campaign-chooser hb-panel"><div className="hb-panel-heading"><div><span className="hb-kicker">MUNDOS DISPONÍVEIS</span><h3>Suas campanhas</h3><p>Escolha a campanha que deseja administrar.</p></div><span className="hb-heading-icon">⚑</span></div>
              {campaigns.length ? <div className="hb-campaign-chooser-grid">{campaigns.map(campaign => <button type="button" key={campaign.id} className={`hb-campaign-option ${selectedCampaignId === campaign.id ? 'is-selected' : ''}`} onClick={async () => {
                  setSelectedCampaignId(campaign.id)
                  const { error: preferenceError } = await supabase.auth.updateUser({ data: { primary_campaign_id: campaign.id } })
                  if (preferenceError) setError(`Campanha selecionada, mas não foi possível salvar como principal: ${preferenceError.message}`)
                }} aria-pressed={selectedCampaignId === campaign.id}>
                <span className="hb-campaign-option-art">⚑</span><span className="hb-campaign-option-copy"><strong>{campaign.name}</strong><small>{campaign.system_name || 'Sistema não definido'}</small></span><span className="hb-campaign-selection">{selectedCampaignId === campaign.id ? '✓ Selecionada' : 'Selecionar ↗'}</span>
              </button>)}</div> : <div className="hb-minimal-empty">Crie sua primeira campanha para começar.</div>}
            </div>
            {inviteCode && <form className="add-form" onSubmit={joinCampaignWithInvite}><h3>Entrar com convite</h3><p>Um convite foi detectado no link. Confirme o código para entrar na campanha.</p><label>Código do convite<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle}/></label><button className="primary-button" type="submit" disabled={inviteLoading}>{inviteLoading?'Entrando…':'Entrar na campanha'}</button></form>}
            <form className="add-form hb-form hb-invite-form" onSubmit={joinCampaignWithInvite}><div className="hb-form-heading"><span className="hb-heading-icon">✉</span><div><span className="hb-kicker">ACESSAR NOVO MUNDO</span><h3>Tenho um convite</h3><p>Entre em outra campanha com um código de convite.</p></div></div><label>Código ou token<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle} placeholder="Cole aqui o código recebido"/></label><button className="secondary-button" type="submit" disabled={inviteLoading || !inviteCode.trim()}>Usar convite</button></form>
            {showCampaignForm && (
              <form
                className="add-form hb-form hb-campaign-form"
                onSubmit={editingCampaignId ? saveCampaignDetails : createCampaign}
              >
                <div className="hb-form-heading"><span className="hb-heading-icon">⚑</span><div><span className="hb-kicker">CONFIGURAÇÕES DA CAMPANHA</span><h3>{editingCampaignId ? 'Editar campanha' : 'Criar campanha'}</h3><p>Defina o nome, o sistema e a descrição do cenário.</p></div></div>

                <label>
                  Nome
                  <input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </label>

                <label>
                  Sistema
                  <select
                    value={campaignSystemChoice}
                    onChange={e => {
                      const choice = e.target.value
                      setCampaignSystemChoice(choice)

                      const selectedSystem = getRegisteredSystems().find(
                        system => system.id === choice
                      )

                      if (selectedSystem) {
                        setSystemName(selectedSystem.name)
                      } else if (choice === 'other') {
                        setSystemName('')
                      } else {
                        setSystemName('')
                      }
                    }}
                    style={inputStyle}
                  >
                    <option value="">Selecione um sistema</option>

                    {getRegisteredSystems().map(system => (
                      <option key={system.id} value={system.id}>
                        {system.name}
                      </option>
                    ))}

                    <option value="other">Outro sistema</option>
                  </select>
                </label>

                {campaignSystemChoice === 'other' && (
                  <label>
                    Nome do sistema
                    <input
                      value={systemName}
                      onChange={e => setSystemName(e.target.value)}
                      placeholder="Ex.: Dungeons & Dragons 5e"
                      required
                      style={inputStyle}
                    />
                  </label>
                )}

                <label>
                  Descrição
                  <input
                    value={campaignDescription}
                    onChange={e => setCampaignDescription(e.target.value)}
                    style={inputStyle}
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading
                      ? 'Salvando…'
                      : editingCampaignId
                        ? 'Salvar alterações'
                        : 'Criar campanha'}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setShowCampaignForm(false)
                      setEditingCampaignId(null)
                      setCampaignName('')
                      setCampaignDescription('')
                      setSystemName('')
                      setCampaignSystemChoice('')
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

{selectedCampaign && isMaster && (
  <div className="add-form hb-form hb-admin-panel hb-invite-admin" style={{ marginTop: 20 }}>
    <div className="hb-form-heading"><span className="hb-heading-icon">✉</span><div><span className="hb-kicker">CONVIDAR JOGADORES</span><h3>Convites de campanha</h3><p>Gere um convite seguro para reunir o grupo.</p></div></div>

    <p>
      Gere um link para convidar jogadores para{' '}
      <strong>{selectedCampaign.name}</strong>.
    </p>

    <button
      type="button"
      className="primary-button"
      onClick={() => void createCampaignInvite()}
      disabled={inviteLoading}
    >
      {inviteLoading ? 'Gerando…' : 'Gerar convite'}
    </button>

    {campaignInviteLink && (
      <label>
        Link para compartilhar

        <input
          readOnly
          value={campaignInviteLink}
          onFocus={event => event.currentTarget.select()}
          style={inputStyle}
        />

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            void navigator.clipboard.writeText(campaignInviteLink)
            setNotice('Link copiado!')
          }}
        >
          Copiar link
        </button>
      </label>
    )}
  </div>
)}

{selectedCampaign && isMaster && (
  <>
    <button
      type="button"
      className="secondary-button season-editor-toggle"
      onClick={() => setShowCampaignEditor(value => !value)}
    >
      {showCampaignEditor ? 'Fechar edição de campanhas' : 'Editar campanhas'}
    </button>

{showCampaignEditor && (
  <div className="item-grid campaign-editor-grid">{campaigns.map(campaign=><article className="item-card" key={campaign.id}><h3>{campaign.name}</h3><p>{campaign.system_name||'Sistema não definido'}</p><button className="primary-button" onClick={()=>{setSelectedCampaignId(campaign.id);setActivePage('campaigns')}}>Selecionar campanha</button>
{campaign.role === 'master' && (
  <>
    <button
      type="button"
      className="secondary-button"
      onClick={() => {
        setSelectedCampaignId(campaign.id)
        setCampaignName(campaign.name)
        setCampaignDescription(campaign.description ?? '')
        setSystemName(campaign.system_name ?? '')
        setCampaignSystemChoice(
          !campaign.system_name
            ? ''
            : getSystemByName(campaign.system_name)?.id ?? 'other'
        )
        setEditingCampaignId(campaign.id)
        setShowCampaignForm(true)
      }}
    >
      Editar campanha
    </button>

    <button
      type="button"
      className="secondary-button"
      onClick={() => deleteCampaign(campaign)}
    >
      Excluir campanha
    </button>
  </>
)}
</article>)}</div>
)}

    <button
      type="button"
      className="secondary-button season-editor-toggle"
      onClick={() => setShowSeasonEditor(value => !value)}
    >
      {showSeasonEditor ? 'Fechar edição de temporadas' : 'Editar temporadas'}
    </button>
  </>
)}

{selectedCampaign && isMaster && showSeasonEditor && (
  <section className="add-form season-editor-panel hb-admin-panel hb-season-editor">
    <form onSubmit={createSeason} className="hb-season-create-form">
      <div className="hb-form-heading"><span className="hb-heading-icon">◷</span><div><span className="hb-kicker">NOVA ETAPA</span><h3>Criar nova temporada</h3><p>Adicione um novo capítulo à história da campanha.</p></div></div>

      <label style={labelStyle}>
        Nome da temporada
        <input
          value={newSeasonName}
          onChange={e => setNewSeasonName(e.target.value)}
          placeholder="Ex.: A Jornada Começa"
          required
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Descrição
        <input
          value={newSeasonDescription}
          onChange={e => setNewSeasonDescription(e.target.value)}
          placeholder="Uma breve descrição da temporada"
          style={inputStyle}
        />
      </label>

      <button className="primary-button" type="submit" disabled={creatingSeason || loading}>
        {creatingSeason ? "Criando temporada…" : "Criar temporada"}
      </button>
    </form>

    {seasons.length > 0 && (
      <section className="add-form season-order-panel hb-season-order">
        <div className="hb-form-heading"><span className="hb-heading-icon">☷</span><div><span className="hb-kicker">LINHA DO TEMPO</span><h3>Ordem das temporadas</h3></div></div>
        <p>Organize a sequência das temporadas desta campanha.</p>

        <div style={{ display: 'grid', gap: 10 }}>
          {[...seasons]
            .sort((a, b) => a.season_number - b.season_number)
            .map((season, index, orderedSeasons) => (
              <div
                key={season.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  border: '1px solid var(--season-line, #444)',
                  borderRadius: 10,
                }}
              >
                <div>
                  <strong>
                    {index + 1}. {season.name}
                  </strong>
                  <small style={{ display: 'block', opacity: 0.7 }}>
                    Temporada {season.season_number}
                  </small>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={index === 0 || seasonOrderSaving}
                    onClick={() => void moveSeason(season.id, -1)}
                    aria-label={`Mover ${season.name} para cima`}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      index === orderedSeasons.length - 1 ||
                      seasonOrderSaving
                    }
                    onClick={() => void moveSeason(season.id, 1)}
                    aria-label={`Mover ${season.name} para baixo`}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={loading || seasonOrderSaving}
                    onClick={() => void deleteSeason(season.id)}
                    aria-label={`Excluir temporada ${season.name}`}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
        </div>

        {seasonOrderSaving && (
          <p style={{ opacity: 0.7 }}>Salvando nova ordem...</p>
        )}
      </section>
    )}
  </section>
)}

            {selectedCampaign && isMaster && (
  <section className="inventory-section hb-admin-panel hb-currency-panel" style={{ marginBottom: 16 }}>
    <div className="inventory-heading"><div><span className="hb-kicker">✦ ECONOMIA</span><h3>Moedas da campanha</h3><p>A primeira moeda é a moeda do sistema, usada por padrão na carteira e nos novos produtos.</p></div></div>
    {(selectedCampaign.currency_config?.currencies ?? []).map((currency, index) => (
      <div key={currency.id} className="currency-balance" style={{ gap: 10 }}>
        <span>{currency.name} ({currency.symbol}) {index === 0 ? '· Moeda do sistema' : ''}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => beginEditingCampaignCurrency(currency)}>Editar</button>
          {index > 0 && <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => void saveCampaignCurrencyConfig([currency, ...(selectedCampaign.currency_config?.currencies ?? []).filter(item => item.id !== currency.id)])}>Definir como principal</button>}
          <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => { if (window.confirm(`Remover ${currency.name}? Produtos e registros antigos que usam essa moeda podem ficar sem correspondência.`)) void saveCampaignCurrencyConfig((selectedCampaign.currency_config?.currencies ?? []).filter(item => item.id !== currency.id)) }}>Remover</button>
        </div>
      </div>
    ))}
    <div className="form-row" style={{ marginTop: 12 }}>
      <label style={{ ...labelStyle, flex: 2, minWidth: 130 }}>Nome<input value={currencyDraftName} onChange={event => setCurrencyDraftName(event.target.value)} placeholder="Ex.: Iene" style={inputStyle} /></label>
      <label style={{ ...labelStyle, flex: 1, minWidth: 90 }}>Símbolo<input value={currencyDraftSymbol} onChange={event => setCurrencyDraftSymbol(event.target.value)} placeholder="¥" style={inputStyle} /></label>
      <label style={{ ...labelStyle, flex: 1, minWidth: 110 }}>Conversão<input type="number" min="0.000001" step="any" value={currencyDraftRate} onChange={event => setCurrencyDraftRate(event.target.value)} style={inputStyle} /></label>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button type="button" className="primary-button" disabled={currencyConfigSaving} onClick={() => void (editingCurrencyId ? saveEditedCampaignCurrency() : addCampaignCurrency())}>{currencyConfigSaving ? 'Salvando…' : editingCurrencyId ? 'Salvar edição da moeda' : 'Adicionar moeda'}</button>
      {editingCurrencyId && <button type="button" className="secondary-button" onClick={() => { setEditingCurrencyId(null); setCurrencyDraftName(''); setCurrencyDraftSymbol(''); setCurrencyDraftRate('1') }}>Cancelar edição</button>}
    </div>
  </section>
)}
          {selectedCampaign && isMaster && (
            <section className="inventory-section hb-admin-panel hb-members-panel">
              <div className="inventory-heading">
                <div><span className="hb-kicker">♙ PARTICIPANTES</span>
                  <h2>Membros da campanha</h2>
                  <p>
                    {campaignMembers.length} membro(s) ·{' '}
                    {campaignMembers.filter((member) => member.role === 'master').length}{' '}
                    mestre(s)
                  </p>
                </div>
              </div>

              {campaignMembers.length === 0 ? (
                <div className="empty-state">
                  <p>Não foi possível carregar os membros desta campanha.</p>
                </div>
              ) : (
                <div className="item-grid">
                  {campaignMembers.map((member) => {
                    const isSelf = member.user_id === session?.user.id
                    const isLastMaster =
                      member.role === 'master' &&
                      campaignMembers.filter((entry) => entry.role === 'master').length <= 1

                    return (
                      <article className="item-card hb-member-card" key={member.user_id}>
                        <div className="item-art">
                          {member.role === 'master' ? '👑' : '♙'}
                        </div>
                        <div className="item-category">
                          {member.role === 'master' ? 'MESTRE' : 'JOGADOR'}
                        </div>
                        <h3>
                          {member.display_name}
                          {isSelf ? ' (você)' : ''}
                        </h3>
                        <p className="item-description">
                          {member.role === 'master'
                            ? 'Pode administrar os membros da campanha.'
                            : 'Participante da campanha.'}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={memberActionLoading !== null || isLastMaster}
                            onClick={() => void changeMemberRole(member)}
                            title={isLastMaster ? 'A campanha precisa ter pelo menos um mestre.' : undefined}
                          >
                            {memberActionLoading === member.user_id
                              ? 'Aguarde...'
                              : member.role === 'master'
                                ? 'Rebaixar a jogador'
                                : 'Promover a mestre'}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={memberActionLoading !== null || isLastMaster}
                            onClick={() => void removeCampaignMember(member)}
                            title={isLastMaster ? 'O último mestre não pode ser removido.' : undefined}
                          >
                            Remover
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

            {selectedCampaign && isMaster && (
              <section className="inventory-section character-access-settings hb-admin-panel hb-access-panel">
                <div className="inventory-heading"><div><span className="hb-kicker">◈ PERMISSÕES</span><h2>Acesso do personagem</h2><p>Selecione um personagem da campanha para definir quem controla e quem pode visualizá-lo.</p></div></div>
                <div style={{ maxWidth: 460, marginBottom: 16 }}>
                  <label style={labelStyle} htmlFor="character-access-selector">Personagem</label>
                  <select
                    id="character-access-selector"
                    value={selectedCharacterId}
                    onChange={(event) => setSelectedCharacterId(event.target.value)}
                    disabled={visibilitySaving || characters.length === 0}
                    style={inputStyle}
                  >
                    <option value="">Selecione um personagem...</option>
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.emoji ? `${character.emoji} ` : ''}{character.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!selectedCharacter ? (
                  <div className="empty-state">
                    <p>{characters.length === 0 ? 'Esta campanha ainda não possui personagens.' : 'Escolha um personagem acima para configurar os acessos.'}</p>
                  </div>
                ) : (
                <div style={{ minWidth: 220, padding: '12px', border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))', borderRadius: 10, background: 'var(--season-bg, var(--season-bg, #100e19))' }}>
                      <label style={labelStyle} htmlFor="character-visibility">Visibilidade</label>
                      <select
                        id="character-visibility"
                        value={selectedCharacter.visibility ?? 'private'}
                        onChange={(event) => void changeCharacterVisibility(event.target.value as Character['visibility'])}
                        disabled={visibilitySaving}
                        style={inputStyle}
                      >
                        <option value="private">Privado</option>
                        <option value="campaign">Toda a campanha</option>
                        <option value="selected">Jogadores selecionados</option>
                      </select>
                      <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', lineHeight: 1.5 }}>
                        {selectedCharacter.visibility === 'campaign'
                          ? 'Todos os membros da campanha podem ver este personagem.'
                          : selectedCharacter.visibility === 'selected'
                            ? 'Somente os jogadores autorizados, o proprietário e os mestres podem vê-lo.'
                            : 'Somente o proprietário e os mestres podem ver este personagem.'}
                      </small>
                      {selectedCharacter.visibility === 'selected' && (
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Acesso dos jogadores</strong>
                          {campaignMembers.filter((member) => member.role !== 'master' && member.user_id !== selectedCharacter.user_id).map((member) => (
                            <label key={member.user_id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, margin: '8px 0', color: '#f4f0fa' }}>
                              <input
                                type="checkbox"
                                checked={characterGrants.some((grant) => grant.user_id === member.user_id)}
                                disabled={visibilitySaving}
                                onChange={(event) => void toggleCharacterGrant(member.user_id, event.target.checked)}
                              />
                              {member.display_name}
                            </label>
                          ))}
                          {campaignMembers.filter((member) => member.role !== 'master' && member.user_id !== selectedCharacter.user_id).length === 0 && (
                            <small style={{ color: 'var(--season-muted, #b9b4c2)' }}>Não há outros jogadores na campanha.</small>
                          )}
                        </div>
                      )}
                    </div>
                )}
              </section>
            )}

          </section>}


          {error && activePage !== 'conditions' && (
            <div className="notice" role="alert">
              <span>!</span> {error}
              <button
                onClick={() => setError('')}
                aria-label="Fechar aviso"
              >
                ×
              </button>
            </div>
          )}

          {notice && activePage !== 'customization' && activePage !== 'master-chest' && activePage !== 'conditions' && (
            <div className="notice" role="status">
              <span>✓</span> {notice}
              <button
                onClick={() => setNotice('')}
                aria-label="Fechar aviso"
              >
                ×
              </button>
            </div>
          )}

          {/* O formulário de campanha fica somente na página Campanhas. */}

          {activePage === 'campaigns' && selectedCampaign && (
            <section className="character-banner">
              <div className="banner-art">
                <span>✧</span>
                <div className="rune rune-one">ᚱ</div>
                <div className="rune rune-two">ᚨ</div>
                <div className="banner-orb" />
              </div>

              <div className="character-info">
                <div className="character-tag">
                  <span /> CAMPANHA ATIVA
                </div>
                <h2>{selectedCampaign.name}</h2>
                <p>
                  {selectedCampaign.system_name || 'Sistema não definido'}
                  <span> · </span>
                  {isMaster ? 'Mestre' : 'Jogador'}
                </p>
                <div className="character-meta">
                  <span>{characters.length} personagem(ns)</span>
                </div>
              </div>
            </section>
          )}

          {activePage === 'campaigns' && !selectedCampaignId && (
            <div className="empty-state">
              <span>⚑</span>
              <h3>Vamos começar uma aventura?</h3>
              <p>Crie sua primeira campanha para adicionar personagens e itens.</p>
              <button onClick={() => setShowCampaignForm(true)}>
                Criar campanha
              </button>
            </div>
          )}

          {activePage === 'campaigns' && selectedCampaignId && (
            <>
              <section className="inventory-section">
                <div className="inventory-heading">
                  <div>
                    <h2>Personagens</h2>
                    <p>Personagens salvos na campanha selecionada.</p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => setShowCharacterForm((value) => !value)}
                  >
                    {showCharacterForm ? 'Cancelar' : '+ Novo personagem'}
                  </button>
                </div>

                {showCharacterForm && (
                  <form className="add-form" onSubmit={createCharacter}>
                    <div className="form-heading">
                      <div>
                        <h3>Novo personagem</h3>
                        <p>Preencha os dados básicos do aventureiro.</p>
                      </div>
                      <span>♙</span>
                    </div>

                    <label>
                      Nome
                      <input
                        value={characterName}
                        onChange={(event) =>
                          setCharacterName(event.target.value)
                        }
                        placeholder="Ex.: Kaelen Vento Cinzento"
                        required
                        maxLength={100}
                      />
                    </label>

                    <div className="form-row">
{systemFeatures.usesRanks ? (
  <>
    <label>
      Arquétipo primário
      <select
        value={primaryArchetype}
        onChange={(event) => setPrimaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {systemArchetypes.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>

    <label>
      Arquétipo secundário
      <select
        value={secondaryArchetype}
        onChange={(event) => setSecondaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {systemArchetypes.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  </>
) : (
  <label>
    Classe ou arquétipo
    <input
      value={archetype}
      onChange={(event) => setArchetype(event.target.value)}
      placeholder="Ex.: Andarilho"
      maxLength={100}
    />
  </label>
)}

{!systemFeatures.usesRanks && (
    <label>
      Nível
      <input
        type="number"
        min="1"
        max="999"
        value={characterLevel}
        onChange={(event) => setCharacterLevel(event.target.value)}
        required
      />
    </label>
  )}
</div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Salvando...' : 'Salvar personagem'}
                    </button>
                  </form>
                )}

                {characters.length === 0 ? (
                  <div className="empty-state">
                    <span>♙</span>
                    <h3>Nenhum personagem ainda</h3>
                    <p>Crie o primeiro personagem desta campanha.</p>
                    <button onClick={() => setShowCharacterForm(true)}>
                      Criar personagem
                    </button>
                  </div>
                ) : (
                  <div className="item-grid">
                    {characters.map((character) => (
                      <article
                        className="item-card"
                        key={character.id}
                        style={{
                          outline:
                            selectedCharacterId === character.id
                              ? '1px solid var(--season-primary)'
                              : undefined,
                        }}
                      >
                        <div className="item-art">{character.emoji || '⚔️'}</div>
<div className="item-category">
  {systemFeatures.usesRanks
    ? 'PERSONAGEM'
    : `NÍVEL ${character.level}`}
</div>
                        <h3>{character.name}</h3>
                        <p className="item-description">
                          {character.archetype || 'Arquétipo não definido'}
                        </p>
                        {systemFeatures.usesRanks && <p className="item-description">⛩️ {characterRanks[character.id] || 'Graduação não definida'}</p>}
                        <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', margin: '8px 0' }}>
                          {character.visibility === 'campaign' ? '🌐 Toda a campanha' : character.visibility === 'selected' ? '👥 Jogadores selecionados' : '🔒 Privado'}
                        </small>
                        <button type="button" className="secondary-button" onClick={() => openCharacterEmojiPicker(character)}>Alterar emoji</button>
                        <button
                          className="primary-button"
                          onClick={() => {
                            setSelectedCharacterId(character.id)
                            setNotice(`${character.name} selecionado.`)
                          }}
                        >
                          {selectedCharacterId === character.id
                            ? 'Personagem selecionado'
                            : 'Selecionar personagem'}
                        </button>

                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>TIPOS DE ITEM</span>
                    <span className="stat-icon purple">▤</span>
                  </div>
                  <div className="stat-number">
                    {items.length}<small> tipos</small>
                  </div>
                  <div className="stat-note">No personagem selecionado</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>OBJETOS NA MOCHILA</span>
                    <span className="stat-icon gold">▣</span>
                  </div>
                  <div className="stat-number">
                    {totalObjects}<small> unidades</small>
                  </div>
                  <div className="stat-note">Somando as quantidades</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>PESO TOTAL</span>
                    <span className="stat-icon blue">⚖</span>
                  </div>
                  <div className="stat-number">
                    {totalWeight.toFixed(1)}<small> kg</small>
                  </div>
                  <div className="stat-note">Peso estimado dos itens</div>
                </div>
              </section>

              {selectedCharacter && (
                <section className="character-banner capacity-banner">
                  <div className="banner-art">
                    <span>✧</span>
                    <div className="banner-orb" />
                  </div>

                  <div className="character-info">
                    <div className="character-tag">
                      <span /> PERSONAGEM ATIVO
                    </div>
                    <h2>{selectedCharacter.name}</h2>
<p>
  {selectedCharacter.archetype || 'Aventureiro'}
{!systemFeatures.usesRanks && (
    <>
      <span> · </span>
      Nível {selectedCharacter.level}
    </>
  )}
</p>
                  </div>

                  <div className="banner-divider" />

                  <div className="banner-stat">
                    <span>CAPACIDADE DE CARGA</span>

                    <strong>
                      {totalWeight.toFixed(1)}
                      <small> / {maxCapacity} kg</small>
                    </strong>

                    <div className="progress-track">
                      <div
                        style={{
                          width: `${capacityPercent}%`,
                          background:
                            totalWeight > maxCapacity
                              ? '#e66b78'
                              : undefined,
                        }}
                      />
                    </div>

                    <small className="stat-caption">
                      {remainingCapacity >= 0
                        ? `${remainingCapacity.toFixed(1)} kg disponíveis`
                        : `${Math.abs(remainingCapacity).toFixed(1)} kg acima do limite`}
                    </small>


                    <small className="stat-caption">
                      10 kg base + 2 kg por ponto de Força
                    </small>
                  </div>
                </section>
              )}

              {false && activePage === 'campaigns' && (
              <section className="inventory-section" id="inventario">
                <div className="inventory-heading">
                  <div>
                    <h2>Mochila</h2>
                    <p>
                      {selectedCharacter
                        ? `Pertences de ${selectedCharacter?.name}.`
                        : 'Selecione um personagem para gerenciar seus itens.'}
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    disabled={!selectedCharacterId || loading}
                    onClick={() => {
                      if (showItemForm) {
                        resetItemForm()
                        setShowItemForm(false)
                      } else {
                        resetItemForm()
                        setShowItemForm(true)
                      }
                    }}
                  >
                    {showItemForm ? 'Cancelar' : '+ Adicionar item'}
                  </button>
                </div>

                {error && (
                  <div className="notice" role="alert" style={{ margin: '12px 0' }}>
                    <span>!</span> {error}
                    <button type="button" onClick={() => setError('')} aria-label="Fechar erro">×</button>
                  </div>
                )}

                {showItemForm &&
                  (selectedCharacterId || editingItem) &&
                  createPortal(
                    (
                      <div className="item-modal-overlay">
                        <div
                          className="item-modal-content"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="item-modal-title"
                        >
                          <form
                            className="add-form item-editor-form"
                            onSubmit={createItem}
                          >
                    <div className="form-heading">
                      <div>
                            <h3 id="item-modal-title">
                              {editingItem ? 'Editar item' : 'Novo item'}
                            </h3>
                        <p>
                          {editingItem
                            ? 'Altere os dados do item e salve as mudanças.'
                            : 'O item será associado ao personagem selecionado.'}
                        </p>
                      </div>
                      <span>{editingItem ? '✎' : '✧'}</span>
                    </div>

                    <label>
                      Nome do item
                      <input
                        value={newItemName}
                        onChange={(event) => setNewItemName(event.target.value)}
                        placeholder="Ex.: Espada de prata"
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Descrição
                      <input
                        value={newItemDescription}
                        onChange={(event) =>
                          setNewItemDescription(event.target.value)
                        }
                        placeholder="Detalhes do item (opcional)"
                        maxLength={1000}
                      />
                    </label>

                    <div className="form-row">
                      <div className="emoji-field">
                        <label>Emoji do item</label>

                        <div className="emoji-grid">
                          {availableEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={
                                newItemEmoji === emoji
                                  ? 'emoji-option selected'
                                  : 'emoji-option'
                              }
                              onClick={() => setNewItemEmoji(emoji)}
                              aria-label={`Selecionar emoji ${emoji}`}
                              aria-pressed={newItemEmoji === emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

<p className="emoji-preview">
  <span className="emoji-preview-label">Emoji selecionado:</span>
  <span className="emoji-preview-icon">{newItemEmoji}</span>
</p>
                      </div>

                      <section className="item-classifications-panel">
                        <div className="item-classifications-heading">
                          <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. Um item pode ter várias classificações.</p></div>
                          <span>{newItemCategories.length} selecionada{newItemCategories.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="item-classifications-grid">
                          {categories.filter(category => category !== 'Todos').map(category => (
                            <label key={category} className={newItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                              <input type="checkbox" checked={newItemCategories.includes(category)} onChange={event => {
                                const next = event.target.checked ? [...newItemCategories, category] : newItemCategories.filter(value => value !== category)
                                setNewItemCategories(next)
                                if (next.length) setNewItemCategory(next[0])
                                const automaticWeight = getAutomaticItemWeight(next, newEquipmentType, newArmorClass, newWeaponClass)
                                if (automaticWeight !== null) setNewItemWeight(String(automaticWeight))
                              }} />
                              <span className="item-classification-check">{newItemCategories.includes(category) ? '✓' : '+'}</span>
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                        {!newItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                      </section>

                      {newItemCategories.includes('Consumíveis') && (
                        <section className="scarcity-editor-card">
                          <div className="scarcity-editor-heading">
                            <span className="scarcity-editor-icon">⌛</span>
                            <div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div>
                          </div>
                          <label>Nível inicial de escassez
                            <select value={newScarcityLevel} onChange={event => setNewScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}>
                              <option value="1">Nível 1 — d12</option>
                              <option value="2">Nível 2 — d8</option>
                              <option value="3">Nível 3 — d6</option>
                              <option value="4">Nível 4 — d4</option>
                            </select>
                          </label>
                          <div className="scarcity-level-preview">
                            <div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[newScarcityLevel]}</strong></div>
                            <div><span>Carga</span><strong>{{ '1': 7, '2': 5, '3': 3, '4': 1 }[newScarcityLevel]}</strong></div>
                          </div>
                          <p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
                          <label className="scarcity-exhausted-toggle"><input type="checkbox" checked={newScarcityExhausted} onChange={event => {
  const exhausted = event.target.checked
  setNewScarcityExhausted(exhausted)
  setNewItemWeight(
    String(exhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel])
  )
}} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label>
                        </section>
                      )}

<label className="item-rarity-field">
  Raridade

  <select
    value={newItemRarity}
    onChange={event => setNewItemRarity(event.target.value)}
  >
    <option value="comum">Comum</option>
    <option value="incomum">Incomum</option>
    <option value="raro">Raro</option>
    <option value="épico">Épico</option>
    <option value="mítico">Mítico</option>
    <option value="relíquia">Relíquia</option>
  </select>
</label>

                      {newItemCategories.includes('Equipamento') && <><label>
                        Tipo de equipamento
                        <select value={newEquipmentType} onChange={event => { const nextType = event.target.value as 'none' | 'armor' | 'protection' | 'cybernetic'; setNewEquipmentType(nextType); const automaticWeight = getAutomaticItemWeight(newItemCategories, nextType, newArmorClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}>
                          <option value="none">Item comum</option>
                          <option value="armor">Armadura</option>
<option value="protection">Proteção</option>
{isCyberFlowerSystem && (
  <option value="cybernetic">Cibernética</option>
)}
                        </select>
                      </label>

                      {newEquipmentType === 'armor' && <>
                        <label>Tipo de armadura<select value={newArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setNewArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, nextClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                        {newArmorClass !== 'pesada' && <label>Tipos de dano protegidos<select value={newArmorCoverage} onChange={event => setNewArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                        <div className="equipment-rules-preview"><strong>Regras da armadura</strong><p>Carga: {newArmorClass === 'leve' ? 2 : newArmorClass === 'media' ? 4 : 6}</p><p>Resistência adicional: {newArmorClass === 'leve' ? '½ dos pontos de resistência + 4' : newArmorClass === 'media' ? '+6 pontos' : '2× os pontos de resistência + 8'}</p><p>Destreza de armadura: {newArmorClass === 'leve' ? 'Destreza integral' : newArmorClass === 'media' ? 'Metade do valor de destreza' : '0'}</p><p>Penalidades: {newArmorClass === 'media' ? '−5 em Reflexo; ½ do deslocamento' : newArmorClass === 'pesada' ? '−10 em Reflexo e Corrida; ¼ do deslocamento' : 'Sem penalidade; deslocamento normal'}</p></div>
                      </>}

                      {newEquipmentType === 'protection' && <>
                        <label>Nível de proteção<select value={newProtectionTier} onChange={event => setNewProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                        <label>Tipo de resistência<select value={newProtectionMode} onChange={event => setNewProtectionMode(event.target.value as 'resistencia' | 'sanidade')}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                        <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0</p><p>Proteção: {newProtectionTier === 'basica' ? '¼' : newProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {newProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {newProtectionTier === 'basica' ? '1d8' : newProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                      </>}

{isCyberFlowerSystem && newEquipmentType === 'cybernetic' && <>
  <label>
    Categoria da cibernética
    <select
      value={newCyberneticCategory}
      onChange={event => setNewCyberneticCategory(event.target.value)}
    >
      <option value="Neurológico">Neurológico</option>
      <option value="Sensorial">Sensorial</option>
      <option value="Órgãos">Órgãos</option>
      <option value="Membros">Membros</option>
      <option value="Estrutural">Estrutural</option>
      <option value="Armamento">Armamento</option>
      <option value="Suporte">Suporte</option>
      <option value="Outro">Outro</option>
    </select>
  </label>

  <label>
    Localização no corpo
    <input
      value={newCyberneticLocation}
      onChange={event => setNewCyberneticLocation(event.target.value)}
      placeholder="Ex.: Crânio, braço esquerdo..."
    />
  </label>

  <label>
    Carga biológica
    <input
      type="number"
      min="0"
      step="1"
      value={newCyberneticLoad}
      onChange={event => setNewCyberneticLoad(event.target.value)}
    />
  </label>

  <label>
    Efeitos
    <textarea
      value={newCyberneticEffects}
      onChange={event => setNewCyberneticEffects(event.target.value)}
      placeholder="Descreva os efeitos da cibernética..."
    />
  </label>
</>}
                      </>}

                      {newItemCategories.includes('Armas') && <>
                        <label>Classificação da arma<select value={newWeaponClass} onChange={event => { const nextClass = event.target.value; setNewWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, nextClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                        <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[newWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[newWeaponClass]} kg</p></div>
                      </>}

                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={newItemQuantity}
                          onChange={(event) =>
                            setNewItemQuantity(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Peso por unidade (kg)
<input
  type="number"
  min="0"
  max="100000"
  step="0.1"
  value={
    newItemCategories.includes('Consumíveis')
      ? String(newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel])
      : newItemWeight
  }
  onChange={(event) => setNewItemWeight(event.target.value)}
  disabled={
    newItemCategories.includes('Consumíveis') ||
    getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
  }
  required
/>
<small>
  {newItemCategories.includes('Consumíveis')
    ? 'Peso definido automaticamente pela carga restante do consumível.'
    : getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
      ? 'Peso definido automaticamente pela classificação e bloqueado para manter as regras do equipamento.'
      : 'Informe o peso por unidade deste item.'}
</small>
                      </label>
                    </div>

<label>
  Valor unitário
  <input
    type="number"
    min="0"
    step="0.01"
    value={newItemUnitPrice}
    onChange={event => setNewItemUnitPrice(event.target.value)}
    placeholder="Ex.: 500"
  />
</label>

<label>
  Moeda
  <select
    value={newItemCurrencyId}
    onChange={event => setNewItemCurrencyId(event.target.value)}
  >
    <option value="">Sem moeda definida</option>
    {selectedCampaign?.currency_config?.currencies?.map((currency, index) => (
      <option key={currency.id} value={currency.id}>
        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
      </option>
    ))}
  </select>
</label>

                        <div className="item-editor-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={loading}
                            onClick={() => {
                              resetItemForm()
                              setShowItemForm(false)
                            }}
                          >
                            Cancelar
                          </button>

                          <button
                            className="primary-button"
                            type="submit"
                            disabled={loading}
                          >
                            {loading
                              ? 'Salvando...'
                              : editingItem
                                ? 'Salvar alterações'
                                : 'Salvar item'}
                          </button>
                        </div>
                          </form>
                        </div>
                      </div>
                    ),
                    document.body
                  )}

                <div className="inventory-toolbar">
                  <div className="category-tabs">
                    {categories.map((category) => (
                      <button
                        key={category}
                        className={
                          activeCategory === category
                            ? 'category-tab selected'
                            : 'category-tab'
                        }
                        onClick={() => setActiveCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="inventory-extra-controls">
                    <label className="search-box">
                      <span>⌕</span>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar item..."
                        aria-label="Buscar item"
                      />
                      <kbd>/</kbd>
                    </label>

                    <button
                      type="button"
                      className={favoriteOnly ? 'category-tab selected' : 'category-tab'}
                      onClick={() => setFavoriteOnly((current) => !current)}
                      aria-pressed={favoriteOnly}
                    >
                      {favoriteOnly ? '★ Favoritos' : '☆ Favoritos'}
                    </button>

                    <label className="inventory-sort-label">
                      <span>Ordenar:</span>
                      <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar itens">
                        <option value="created">Adicionados</option>
                        <option value="manual">Minha ordem</option>
                        <option value="name">Nome</option>
                        <option value="category">Categoria</option>
                        <option value="weight">Maior peso</option>
                        <option value="quantity">Maior quantidade</option>
                      </select>
                    </label>
                  </div>
                </div>

                {itemsLoading ? (
                  <div className="empty-state">
                    <p>Carregando inventário...</p>
                  </div>
                ) : !selectedCharacterId ? (
                  <div className="empty-state">
                    <span>♙</span>
                    <h3>Selecione um personagem</h3>
                    <p>Escolha um personagem para ver seus pertences.</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="empty-state">
                    <span>▤</span>
                    <h3>
                      {items.length === 0
                        ? 'Mochila vazia'
                        : 'Nenhum item encontrado'}
                    </h3>
                    <p>
                      {items.length === 0
                        ? 'Adicione o primeiro item deste personagem.'
                        : 'Tente outra busca ou selecione outra categoria.'}
                    </p>
                    {items.length === 0 ? (
                      <button onClick={() => setShowItemForm(true)}>
                        Adicionar primeiro item
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSearch('')
                          setActiveCategory('Todos')
                        }}
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="item-grid">
                    {orderedInventoryItems.map((item) => (
                      <article
  className={`item-card inventory-item-card ${inventoryDropId === item.id ? 'inventory-drop-target' : ''} ${draggedInventoryId === item.id ? 'inventory-dragging' : ''}`}
  key={item.id}
  draggable
  onDragStart={event => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"]')) { event.preventDefault(); return }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.id)
    setDraggedInventoryId(item.id)
  }}
  onDragEnd={() => { setDraggedInventoryId(null); setInventoryDropId(null) }}
  onDragOver={event => { if (draggedInventoryId && draggedInventoryId !== item.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setInventoryDropId(item.id) } }}
  onDragLeave={() => { if (inventoryDropId === item.id) setInventoryDropId(null) }}
  onDrop={event => { event.preventDefault(); if (draggedInventoryId) void reorderInventoryItem(draggedInventoryId, item.id) }}
  onClick={() => { if (!draggedInventoryId) setSelectedItemDetails(item) }}
  style={{ cursor: 'pointer' }}
>
                        <div className="item-card-top">
                          <button
                            type="button"
                            className="item-art"
                            onClick={() => setEmojiPickerItem(item)}
                            title="Clique para alterar o emoji"
                            aria-label={`Alterar emoji de ${item.name}`}
                            style={{
                              cursor: 'pointer',
                              font: 'inherit',
                              fontSize: '28px',
                            }}
                          >
                            {typeof item.metadata?.icon === 'string'
                              ? item.metadata.icon
                              : '📦'}
                          </button>

                          {transferItem?.id === item.id && (
                            <div className="item-transfer-panel" onClick={event => event.stopPropagation()} style={{ padding: 12, marginBottom: 12, border: '1px solid var(--border, #666)', borderRadius: 10, display: 'grid', gap: 8 }}>
                              <strong>Enviar {item.name}</strong>
                              <label>Personagem de destino</label>
                              <select value={transferTargetId} onChange={event => setTransferTargetId(event.target.value)}>
                                <option value="">Selecione um personagem...</option>
                                {characters.filter(character => character.campaign_id === selectedCampaignId && character.id !== item.character_id).map(character => (
                                  <option key={character.id} value={character.id}>{character.name}</option>
                                ))}
                              </select>
                              <label>Quantidade (máximo: {item.quantity})</label>
                              <input type="number" min={1} max={item.quantity} step={1} value={transferQuantity} onChange={event => setTransferQuantity(Number(event.target.value))} />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" disabled={transferSaving || !transferTargetId || transferQuantity < 1 || transferQuantity > item.quantity} onClick={() => void sendItemToCharacter()}>{transferSaving ? 'Enviando...' : 'Confirmar envio'}</button>
                                <button type="button" disabled={transferSaving} onClick={() => setTransferItem(null)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                          <div className="item-actions">
                            <button
                              type="button"
                              className="item-menu"
                              title={item.metadata?.favorite === true ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              aria-label={item.metadata?.favorite === true ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
                              aria-pressed={item.metadata?.favorite === true}
                              onClick={() => void toggleFavorite(item)}
                            >
                              {item.metadata?.favorite === true ? '★' : '☆'}
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              title="Enviar para outro personagem"
                              aria-label={`Enviar ${item.name} para outro personagem`}
                              disabled={loading}
                              onClick={(event) => {
                                event.stopPropagation()
                                setError('')
                                setTransferItem(item)
                                setTransferTargetId('')
                                setTransferQuantity(1)
                              }}
                            >
                              ↗
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              title="Duplicar item"
                              aria-label={`Duplicar ${item.name}`}
                              disabled={loading}
                              onClick={() => void duplicateItem(item)}
                            >
                              ⧉
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              title="Editar item"
                              aria-label={`Editar ${item.name}`}
                              disabled={loading}
                              onClick={(event) => {
                                event.stopPropagation()
                                startEditingItem(item)
                              }}
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              onClick={(event) => {
  event.stopPropagation()
  void removeItem(item)
}}
                              title="Remover item"
                              aria-label={`Remover ${item.name}`}
                              disabled={loading}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="item-category">{item.category}</div>
                        <h3>{item.name}</h3>
                        <p className="item-description">
                          {item.description || 'Sem descrição.'}
                        </p>

  {(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))) && (
                            <div className="inventory-equipment-controls" aria-label={`Equipamento de ${item.name}`}>
                              <span className="inventory-equipment-label">EQUIPAMENTO</span>
                              <button
                                type="button"
                                className={`inventory-equip-button ${item.metadata?.equipped === true ? 'is-equipped' : ''}`}
                                aria-pressed={item.metadata?.equipped === true}
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const isWeapon = Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas');
                                  const type = isWeapon ? 'weapon' : item.metadata?.equipmentType;
                                  const nextEquipped = item.metadata?.equipped !== true;
                                  const others = nextEquipped && (type === 'weapon' || type === 'armor')
                                    ? items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && (type === 'weapon' ? Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas') : entry.metadata?.equipmentType === 'armor'))
                                    : [];
                                  for (const other of others) {
                                    const { error: otherError } = await supabase.from('inventory_items').update({ metadata: { ...(other.metadata || {}), equipped: false } }).eq('id', other.id);
                                    if (otherError) { setError(`Não foi possível atualizar outro equipamento: ${otherError.message}`); return; }
                                  }
                                  const { data, error: equipError } = await supabase.from('inventory_items').update({ metadata: { ...(item.metadata || {}), equipped: nextEquipped } }).eq('id', item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle();
                                  if (equipError || !data) { setError(`Não foi possível alterar o equipamento: ${equipError?.message || 'sem retorno'}`); return; }
                                  setItems(current => current.map(entry => entry.id === item.id ? data as Item : others.some(other => other.id === entry.id) ? { ...entry, metadata: { ...(entry.metadata || {}), equipped: false } } : entry));
                                  setNotice(nextEquipped ? `${item.name} equipado(a).` : `${item.name} desequipado(a).`);
                                }}
                              >
                                <span className="inventory-equip-symbol">{item.metadata?.equipped === true ? '✓' : item.metadata?.equipmentType === 'armor' ? '🛡' : item.metadata?.equipmentType === 'protection' ? '✧' : '⚔'}</span>
                                {item.metadata?.equipped === true ? 'Equipado · Desequipar' : item.metadata?.equipmentType === 'armor' ? 'Equipar armadura' : item.metadata?.equipmentType === 'protection' ? 'Equipar proteção' : 'Equipar arma'}
                              </button>
                            </div>
                          )}

                          <div className="item-footer">
                            <span>
                              ⚖ {`${(Number(item.weight) || 0).toFixed(1)} kg / un.`}
                            </span>
                            <div className="quantity-controls" aria-label={`Quantidade de ${item.name}`}>
                              <button
                                type="button"
                                className="quantity-button"
                                onClick={() => void changeItemQuantity(item, Number(item.quantity) - 1)}
                                disabled={Number(item.quantity) <= 1 || updatingQuantityItemId === item.id}
                                aria-label={`Diminuir quantidade de ${item.name}`}
                              >−</button>
                              <span className="quantity" aria-live="polite">{item.quantity}</span>
                              <button
                                type="button"
                                className="quantity-button"
                                onClick={() => void changeItemQuantity(item, Number(item.quantity) + 1)}
                                disabled={Number(item.quantity) >= 999 || updatingQuantityItemId === item.id}
                                aria-label={`Aumentar quantidade de ${item.name}`}
                              >+</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                )}
              </>
            )}

            {loading && <p role="status">Salvando ou carregando...</p>}

  {emojiPickerCharacter && createPortal((
    <div
      className="emoji-modal-backdrop"
      onClick={() => setEmojiPickerCharacter(null)}
      style={{ zIndex: 11000 }}
    >
      <section
        className="emoji-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-emoji-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="emoji-modal-heading">
          <div>
            <h3 id="character-emoji-modal-title">Escolher emoji</h3>
            <p>{emojiPickerCharacter.name}</p>
          </div>

          <button
            type="button"
            className="item-menu"
            onClick={() => setEmojiPickerCharacter(null)}
            aria-label="Fechar seletor de emoji"
          >
            ×
          </button>
        </div>

        <div className="emoji-grid">
          {availableEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={
                emojiPickerCharacter.emoji === emoji
                  ? 'emoji-option selected'
                  : 'emoji-option'
              }
              onClick={() =>
                void changeCharacterEmoji(emojiPickerCharacter, emoji)
              }
              aria-label={`Usar emoji ${emoji}`}
              aria-pressed={emojiPickerCharacter.emoji === emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => setEmojiPickerCharacter(null)}
        >
          Cancelar
        </button>
      </section>
    </div>
  ), document.body)}

  {emojiPickerItem && createPortal((
    <div
      className="emoji-modal-backdrop"
      onClick={() => setEmojiPickerItem(null)}
      style={{ zIndex: 11000 }}
    >
      <section
        className="emoji-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emoji-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="emoji-modal-heading">
          <div>
            <h3 id="emoji-modal-title">Escolher emoji</h3>
            <p>{emojiPickerItem.name}</p>
          </div>

          <button
            type="button"
            className="item-menu"
            onClick={() => setEmojiPickerItem(null)}
            aria-label="Fechar seletor de emoji"
          >
            ×
          </button>
        </div>

        <div className="emoji-grid">
          {availableEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={
                emojiPickerItem.metadata?.icon === emoji
                  ? 'emoji-option selected'
                  : 'emoji-option'
              }
              onClick={() =>
                void changeItemEmoji(emojiPickerItem, emoji)
              }
              aria-label={`Usar emoji ${emoji}`}
              aria-pressed={emojiPickerItem.metadata?.icon === emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => setEmojiPickerItem(null)}
        >
          Cancelar
        </button>
      </section>
    </div>
  ), document.body)}

  {selectedItemDetails && createPortal((
    <div className="modal-overlay" onClick={() => setSelectedItemDetails(null)} style={{position:'fixed',inset:0,zIndex:10000,display:'grid',placeItems:'center',padding:20,background:'rgba(5,5,9,.78)',backdropFilter:'blur(7px)'}}>
      <div className="item-details-modal item-details-redesigned" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedItemDetails.name}`} onClick={event => event.stopPropagation()} style={{position:'relative',width:'min(100%,520px)',maxHeight:'min(85vh,760px)',overflowY:'auto',padding:28,borderRadius:20,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'var(--season-surface,#17151f)',color:'var(--season-text,#f4f0fa)',boxShadow:'0 24px 80px rgba(0,0,0,.5)'}}>
        <button type="button" className="item-menu" onClick={() => setSelectedItemDetails(null)} aria-label="Fechar detalhes" style={{position:'absolute',right:16,top:16,width:36,height:36,borderRadius:10,fontSize:20}}>✕</button>
  <div className="item-details-header">
    <div className="item-art">
      {typeof selectedItemDetails.metadata?.icon === 'string'
        ? selectedItemDetails.metadata.icon
        : '📦'}
    </div>

    <div className="item-details-heading">
      <small>{selectedItemDetails.category}</small>

  <p className="item-rarity">
    <strong>Raridade:</strong>
    <span>
      {typeof selectedItemDetails.metadata?.rarity === 'string'
        ? selectedItemDetails.metadata.rarity.charAt(0).toLocaleUpperCase('pt-BR') +
          selectedItemDetails.metadata.rarity.slice(1)
        : 'Comum'}
    </span>
  </p>

      <h2>{selectedItemDetails.name}</h2>
      <p>{selectedItemDetails.description || 'Sem descrição.'}</p>
    </div>
  </div>
        {((selectedItemDetails.metadata?.equipmentType === 'armor' || selectedItemDetails.metadata?.equipmentType === 'protection') || (Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas'))) && <button type="button" className="equipment-toggle-button" onClick={async()=>{
          const isWeapon=Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas');
          const equipmentType=isWeapon?'weapon':selectedItemDetails.metadata?.equipmentType;
          const nextEquipped=selectedItemDetails.metadata?.equipped!==true;
          // Uma arma e uma armadura por personagem; proteções podem coexistir.
          if(nextEquipped && (equipmentType==='armor' || equipmentType==='weapon')) {
            const others=items.filter(entry=>entry.character_id===selectedItemDetails.character_id && entry.id!==selectedItemDetails.id && entry.metadata?.equipped===true && (equipmentType==='armor' ? entry.metadata?.equipmentType==='armor' : Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas')));
            for(const other of others) {
              const {error:unequipError}=await supabase.from('inventory_items').update({metadata:{...(other.metadata||{}),equipped:false}}).eq('id',other.id);
              if(unequipError){setError(`Não foi possível substituir o equipamento: ${unequipError.message}`);return}
            }
            if(others.length) setItems(current=>current.map(entry=>others.some(other=>other.id===entry.id)?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry));
          }
          const {data,error}=await supabase.from('inventory_items').update({metadata:{...(selectedItemDetails.metadata||{}),equipped:nextEquipped}}).eq('id',selectedItemDetails.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked').maybeSingle();
          if(error||!data){setError(`Não foi possível alterar equipamento: ${error?.message||'sem retorno'}`);return}
          setItems(current=>current.map(entry=>entry.id===selectedItemDetails.id?data as Item:entry));setSelectedItemDetails(data as Item);setNotice(nextEquipped?(isWeapon?'Arma equipada.':equipmentType==='armor'?'Armadura equipada.':'Proteção equipada.'):'Equipamento desativado.');
        }}>{selectedItemDetails.metadata?.equipped===true?'✓ Equipado · Desequipar':(Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas'))?'⚔ Equipar arma':'Equipar item'}</button>}

        {((Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Consumíveis')) || selectedItemDetails.category === 'Consumíveis') && (() => {
          const level = Math.min(4, Math.max(1, Number(selectedItemDetails.metadata?.scarcityLevel) || 1))
          const die = ({ 1: 'd12', 2: 'd8', 3: 'd6', 4: 'd4' } as Record<number, string>)[level]
          const exhausted = selectedItemDetails.metadata?.scarcityExhausted === true
          return <section className="scarcity-use-card">
            <div className="scarcity-use-heading"><span>⌛</span><div><h3>Escassez do consumível</h3><p>{exhausted ? 'Este item está esgotado.' : `Nível ${level} · ${die} · Carga ${({ 1: 7, 2: 5, 3: 3, 4: 1 } as Record<number, number>)[level]}`}</p></div></div>
            <div className="scarcity-use-stats"><div><small>Última rolagem</small><strong>{selectedItemDetails.metadata?.scarcityLastRoll ? `${selectedItemDetails.metadata.scarcityLastRoll} em ${selectedItemDetails.metadata.scarcityLastDie || '—'}` : 'Ainda não usado'}</strong></div><div><small>Usos registrados</small><strong>{Number(selectedItemDetails.metadata?.scarcityUses) || 0}</strong></div></div>
            <p>Role o dado indicado ao usar. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
            <button type="button" className="primary-button" disabled={exhausted || usingScarcityItemId === selectedItemDetails.id} onClick={() => void useScarcityItem(selectedItemDetails)}>{usingScarcityItemId === selectedItemDetails.id ? 'Rolando dado...' : exhausted ? 'Item esgotado' : `🎲 Rolar ${die} · Registrar uso`}</button>
          </section>
        })()}
        <div className="item-economic-details">
          <div><span>Valor unitário</span><strong>{selectedItemDetails.currency_id ? `${selectedCampaign?.currency_config?.currencies?.find(currency => currency.id === selectedItemDetails.currency_id)?.symbol ?? ''} ` : ''}{Number(selectedItemDetails.unit_price ?? 0).toLocaleString('pt-BR')}</strong></div>
          <div><span>Valor total</span><strong>{selectedItemDetails.currency_id ? `${selectedCampaign?.currency_config?.currencies?.find(currency => currency.id === selectedItemDetails.currency_id)?.symbol ?? ''} ` : ''}{(Number(selectedItemDetails.unit_price ?? 0) * Number(selectedItemDetails.quantity ?? 0)).toLocaleString('pt-BR')}</strong></div>
        </div>
        <div className="item-sale-section">
    <h3>Vender para uma loja</h3>

    {isMaster && (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '12px 0',
        fontSize: 13,
      }}
    >
      <input
        type="checkbox"
        className="restriction-checkbox"
        checked={!!selectedItemDetails.sale_blocked}
        onChange={event =>
          void setItemRestriction(
            'inventory',
            selectedItemDetails.id,
            event.target.checked
          )
        }
      />
      Bloquear venda deste item
    </label>
  )}

  {selectedItemDetails.sale_blocked && (
    <p style={{ color: '#e6a36d', fontSize: 13 }}>
      🔒 A venda deste item foi bloqueada pelo mestre.
    </p>
  )}

    {!(selectedItemDetails.metadata?.shop_id &&
      selectedItemDetails.metadata?.shop_item_id) && (
      <label style={labelStyle}>
        Loja que receberá o item

        <select
          value={saleShopId}
          onChange={event => setSaleShopId(event.target.value)}
          style={inputStyle}
        >
          <option value="">Selecione uma loja</option>

          {shops.map(shop => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
      </label>
    )}

    <label style={labelStyle}>
      Quantidade para vender

      <input
        type="number"
        min="1"
        max={selectedItemDetails.quantity}
        value={saleQuantity}
        onChange={event => setSaleQuantity(event.target.value)}
        style={inputStyle}
      />
    </label>

    <p>
      Valor da venda:{' '}
      <strong>
        {(
          Number(selectedItemDetails.unit_price) *
          Number(saleQuantity || 0)
        ).toLocaleString('pt-BR')}
      </strong>
    </p>

    <button
      type="button"
      className="primary-button"
      disabled={saleLoading || !!selectedItemDetails.sale_blocked}
      onClick={() => void sellInventoryItem(selectedItemDetails)}
    >
      {saleLoading
      ? 'Vendendo...'
      : selectedItemDetails.sale_blocked
        ? 'Venda bloqueada'
        : 'Vender item'}
    </button>
  </div>
        {selectedItemDetails.metadata?.equipmentType === 'armor' && <section className="equipment-rules-preview"><h3>Armadura {selectedItemDetails.metadata?.armorClass === 'media' ? 'média' : selectedItemDetails.metadata?.armorClass === 'pesada' ? 'pesada' : 'leve'}</h3><p>Tipos protegidos: {selectedItemDetails.metadata?.armorCoverage === 'todos' ? 'Cortante, perfurante, especial e bruto' : selectedItemDetails.metadata?.armorCoverage === 'especial_bruto' ? 'Especial e bruto' : 'Cortante e perfurante'}</p><p>Carga por unidade: {Number(selectedItemDetails.weight || 0).toLocaleString('pt-BR')} kg</p><p>Resistência: {selectedItemDetails.metadata?.armorClass === 'media' ? '+6' : selectedItemDetails.metadata?.armorClass === 'pesada' ? 'Dobro dos pontos + 8' : 'Metade dos pontos + 4'}</p><p>Destreza de armadura: {selectedItemDetails.metadata?.armorClass === 'media' ? 'Metade da destreza' : selectedItemDetails.metadata?.armorClass === 'pesada' ? '0' : 'Igual à destreza'}</p><p>Penalidades: {selectedItemDetails.metadata?.armorClass === 'media' ? '−5 em Reflexo; deslocamento pela metade' : selectedItemDetails.metadata?.armorClass === 'pesada' ? '−10 em Reflexo e Corrida; deslocamento a ¼' : 'Nenhuma'}</p></section>}
        {selectedItemDetails.metadata?.equipmentType === 'protection' && <section className="equipment-rules-preview"><h3>Proteção {selectedItemDetails.metadata?.protectionTier === 'moderada' ? 'moderada' : selectedItemDetails.metadata?.protectionTier === 'avancada' ? 'avançada' : 'básica'}</h3><p>Carga: 0</p><p>Tipo: {selectedItemDetails.metadata?.protectionMode === 'sanidade' ? 'Resistência de sanidade' : 'Resistência contra dano especial e bruto'}</p><p>Valor protegido: {selectedItemDetails.metadata?.protectionTier === 'basica' ? '¼' : selectedItemDetails.metadata?.protectionTier === 'moderada' ? '½' : 'Integral'}</p><p>Dano de sanidade ao perder: {selectedItemDetails.metadata?.protectionTier === 'basica' ? '1d8' : selectedItemDetails.metadata?.protectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}</p></section>}
  <section className="item-basic-stats">
    <div className="item-stat-card">
      <small>Quantidade</small>
      <strong>{selectedItemDetails.quantity}</strong>
    </div>

    <div className="item-stat-card">
      <small>Peso por unidade</small>
      <strong>{Number(selectedItemDetails.weight).toFixed(1)} kg</strong>
    </div>

    <div className="item-stat-card">
      <small>Peso total</small>
      <strong>
        {(Number(selectedItemDetails.weight) * Number(selectedItemDetails.quantity)).toFixed(1)} kg
      </strong>
    </div>
  </section>
      </div>
    </div>
  ), document.body)}

            {activePage !== 'player-table' && (
            <footer className="page-footer">
              <span>
                HäxBag
                <span className="footer-separator"> · </span>
                Seu inventário, suas regras.
              </span>
              <span>
                FEITO PARA QUEM VIVE GRANDES AVENTURAS <span>✧</span>
              </span>
            </footer>
            )}
          </div>
        </main>
      </div>
    )
  }

  const centerStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--season-bg, #100e19)',
    color: '#f4f0fa',
    fontFamily: 'sans-serif',
  } as const

  const labelStyle = {
    display: 'block',
    color: 'var(--season-muted, #b9b4c2)',
    fontSize: '12px',
    marginBottom: '6px',
  } as const

  const inputStyle = {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))',
    background: 'var(--season-bg, var(--season-bg, #100e19))',
    color: '#f4f0fa',
    marginBottom: '8px',
  } as const

  const secondaryButtonStyle = {
    padding: '8px 12px',
    border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))',
    borderRadius: '8px',
    background: 'var(--season-surface-alt, var(--season-surface-alt, #211c31))',
    color: 'var(--season-primary, var(--season-primary, #b49aff))',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '12px',
  } as const

  export default App
