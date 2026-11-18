import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ConditionModifiers = Record<string, number>
type Effect = { type?: string; target?: string; key?: string; value?: number; unit?: 'flat' | 'percent' }
type Assignment = { definition_id?: string; condition_id?: string; id?: string }
type DefinitionEffects = { id: string; effects: Effect[] | string | null }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function conditionModifier(modifiers: ConditionModifiers, target: string, key: string): number {
  const fixed = (modifiers[`${target}:${normalize(key)}`] || 0) + (modifiers[`${target}:*`] || 0)
  return fixed
}

export function calculateConditionModifiers(assignments: Assignment[], definitions: DefinitionEffects[]): ConditionModifiers {
  const byId = new Map(definitions.map(def => [def.id, typeof def.effects === 'string' ? JSON.parse(def.effects) as Effect[] : (Array.isArray(def.effects) ? def.effects : [])]))
  const totals: ConditionModifiers = {}
  for (const assignment of assignments) {
    for (const effect of byId.get(assignment.definition_id || assignment.condition_id || '') || []) {
      if (effect.type !== 'modifier' || !effect.target || !Number.isFinite(effect.value)) continue
      const key = `${effect.unit === 'percent' ? 'percent:' : ''}${effect.target}:${normalize(effect.key || '*')}`
      totals[key] = (totals[key] || 0) + Number(effect.value)
      // Guarda somente a existência de uma concessão específica. Mesmo que outra
      // condição anule seus pontos, a perícia ainda deve ser exibida como temporária.
      if (effect.unit !== 'percent' && Number(effect.value) > 0 && effect.key !== '*' &&
        (effect.target === 'extra_skill' || effect.target === 'archetype_skill')) {
        const grantedKey = `grant:${effect.target}:${normalize(effect.key || '')}`
        totals[grantedKey] = (totals[grantedKey] || 0) + 1
      }
    }
  }
  return totals
}

/** Lê somente as condições aplicadas pelo mestre. Não grava nem aplica condições. */
export function useCharacterConditionModifiers(campaignId: string, characterId: string): ConditionModifiers {
  const [state, setState] = useState<{ scope: string; modifiers: ConditionModifiers }>({ scope: '', modifiers: {} })
  const scope = `${campaignId}:${characterId}`
  useEffect(() => {
    if (!campaignId || !characterId) return
    let live = true
    const load = async () => {
      const [active, definitions] = await Promise.all([
        supabase.rpc('hax_list_active_conditions', { p_campaign_id: campaignId, p_character_id: characterId }),
        supabase.rpc('hax_list_condition_effects', { p_campaign_id: campaignId }),
      ])
      if (!live || active.error || definitions.error) return
      setState({ scope, modifiers: calculateConditionModifiers((active.data || []) as Assignment[], (definitions.data || []) as DefinitionEffects[]) })
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => { live = false; window.clearInterval(timer) }
  }, [campaignId, characterId, scope])
  return state.scope === scope ? state.modifiers : {}
}

/** Efeitos de condições aplicadas manualmente a inimigos pelo mestre. */
export function useEnemyConditionModifiers(campaignId: string, enemyId: string): ConditionModifiers {
  const [state, setState] = useState<{scope:string; modifiers: ConditionModifiers}>({scope:'',modifiers:{}})
  const scope=`${campaignId}:${enemyId}`
  useEffect(()=>{
    if(!campaignId||!enemyId)return
    let live=true
    const load=async()=>{
      const [active, definitions]=await Promise.all([
        supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:enemyId}),
        supabase.rpc('hax_list_condition_effects',{p_campaign_id:campaignId}),
      ])
      if(!live||active.error||definitions.error)return
      setState({scope,modifiers:calculateConditionModifiers((active.data||[]) as Assignment[],(definitions.data||[]) as DefinitionEffects[])})
    }
    void load()
    const timer=window.setInterval(()=>void load(),5000)
    return()=>{live=false;window.clearInterval(timer)}
  },[campaignId,enemyId,scope])
  return state.scope===scope?state.modifiers:{}
}

export type ConditionRuleState = {
  dice: ConditionModifiers
  resources: ConditionModifiers
  resourcePercent: ConditionModifiers
  restrictions: string[]
  periodic: { resource: string; dice: string; definitionId: string }[]
  counters: { rounds: number; definitionId: string }[]
}

export function calculateConditionRules(assignments: Assignment[], definitions: DefinitionEffects[]): ConditionRuleState {
  const byId = new Map(definitions.map(def => [def.id, typeof def.effects === 'string' ? JSON.parse(def.effects) as Effect[] : (Array.isArray(def.effects) ? def.effects : [])]))
  const result: ConditionRuleState = { dice: {}, resources: {}, resourcePercent: {}, restrictions: [], periodic: [], counters: [] }
  const restrictions = new Set<string>()
  for (const assignment of assignments) {
    for (const raw of byId.get(assignment.definition_id || assignment.condition_id || '') || []) {
      const effect = raw as Effect & { dice?: string }
      const key = normalize(effect.key || '*')
      const value = Number(effect.value)
      if (effect.type === 'dice' && ['status', 'combat_points'].includes(effect.target || '') && Number.isFinite(value)) {
        const index = `${effect.target || 'status'}:${key}`
        result.dice[index] = (result.dice[index] || 0) + value
      } else if (effect.type === 'resource' && ['pv', 'ps', 'pr'].includes(key) && Number.isFinite(value)) {
        const index = `resource:${key}`
        if (effect.unit === 'percent') result.resourcePercent[index] = (result.resourcePercent[index] || 0) + value
        else result.resources[index] = (result.resources[index] || 0) + value
      } else if (effect.type === 'restriction' && key !== '*') restrictions.add(key)
      else if (effect.type === 'periodic_damage' && /^\d{1,2}d\d{1,3}$/i.test(effect.dice || '')) {
        result.periodic.push({ resource: key, dice: effect.dice!, definitionId: assignment.definition_id || assignment.condition_id || '' })
      } else if (effect.type === 'round_counter' && Number.isInteger(value) && value > 0) {
        result.counters.push({ rounds: value, definitionId: assignment.definition_id || assignment.condition_id || '' })
      }
    }
  }
  result.restrictions = [...restrictions]
  return result
}

/** Apenas lê regras. A aplicação e remoção de condições continuam exclusivas do mestre. */
export function useCharacterConditionRules(campaignId: string, characterId: string): ConditionRuleState {
  const [state, setState] = useState<{ scope: string; rules: ConditionRuleState } | null>(null)
  const scope = `${campaignId}:${characterId}`
  useEffect(() => {
    if (!campaignId || !characterId) return
    let live = true
    const load = async () => {
      const [active, definitions] = await Promise.all([
        supabase.rpc('hax_list_active_conditions', { p_campaign_id: campaignId, p_character_id: characterId }),
        supabase.rpc('hax_list_condition_effects', { p_campaign_id: campaignId }),
      ])
      if (!live || active.error || definitions.error) return
      setState({ scope, rules: calculateConditionRules((active.data || []) as Assignment[], (definitions.data || []) as DefinitionEffects[]) })
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => { live = false; window.clearInterval(timer) }
  }, [campaignId, characterId, scope])
  return state?.scope === scope ? state.rules : { dice: {}, resources: {}, resourcePercent: {}, restrictions: [], periodic: [], counters: [] }
}

/** Aplica pontos e porcentagens sobre o valor-base, arredondando ao inteiro mais próximo. */
export function applyConditionModifier(base: number, modifiers: ConditionModifiers, target: string, key: string): number {
  const fixed = conditionModifier(modifiers, target, key)
  const percent = conditionModifier(modifiers, `percent:${target}`, key)
  return Math.round(base * (1 + percent / 100) + fixed)
}

/** Componentes consolidados de uma perícia, incluindo os efeitos "Todos".
 * Mantém a preferência pela chave completa e compatibilidade com registros antigos
 * salvos apenas com o nome da perícia, sem duplicar o curinga. */
export function conditionSkillComponents(
  modifiers: ConditionModifiers, target: 'extra_skill'|'archetype_skill', key: string, name?: string,
): { flat: number; percent: number; specificFlat: number; hasGrant: boolean } {
  const full = normalize(key)
  const short = normalize(name || key.split(':').slice(1).join(':') || key)
  const hasExact = Object.prototype.hasOwnProperty.call(modifiers, `${target}:${full}`)
    || Object.prototype.hasOwnProperty.call(modifiers, `percent:${target}:${full}`)
  const hasLegacy = short !== full && (
    Object.prototype.hasOwnProperty.call(modifiers, `${target}:${short}`)
    || Object.prototype.hasOwnProperty.call(modifiers, `percent:${target}:${short}`)
  )
  const selected = !hasExact && hasLegacy ? short : full
  return {
    flat: conditionModifier(modifiers, target, selected),
    percent: conditionModifier(modifiers, `percent:${target}`, selected),
    specificFlat: Number(modifiers[`${target}:${selected}`] || 0),
    hasGrant: Number(modifiers[`grant:${target}:${selected}`] || 0) > 0,
  }
}

/** Perícias treinadas mantêm a fórmula existente da V152:
 * percentual sobre o treinamento-base, seguido dos pontos.
 * Quando o treinamento-base é zero (perícia concedida exclusivamente por condições),
 * o percentual também incide sobre os pontos concedidos. Isso permite que -100%
 * neutralize uma concessão temporária de +20 sem modificar a ficha permanente. */
export function effectiveConditionSkill(
  base: number, modifiers: ConditionModifiers,
  target: 'extra_skill'|'archetype_skill', key: string, name?: string,
): number {
  const { flat, percent } = conditionSkillComponents(modifiers, target, key, name)
  return base === 0
    ? Math.round(flat * (1 + percent / 100))
    : Math.round(base * (1 + percent / 100) + flat)
}

/** O vínculo de concessão permanece visível mesmo que o bônus seja anulado:
 * uma condição ainda concede a perícia, mas sua pontuação líquida pode ser 0. */
export function isConditionGrantedSkill(
  modifiers: ConditionModifiers, target: 'extra_skill'|'archetype_skill', key: string, name?: string,
): boolean {
  const parts = conditionSkillComponents(modifiers, target, key, name)
  return parts.hasGrant || parts.specificFlat > 0
}
