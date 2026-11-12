import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ConditionModifiers = Record<string, number>
type Effect = { type?: string; target?: string; key?: string; value?: number; unit?: 'flat' | 'percent' }
type Assignment = { definition_id: string }
type DefinitionEffects = { id: string; effects: Effect[] }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function conditionModifier(modifiers: ConditionModifiers, target: string, key: string): number {
  const fixed = (modifiers[`${target}:${normalize(key)}`] || 0) + (modifiers[`${target}:*`] || 0)
  return fixed
}

export function calculateConditionModifiers(assignments: Assignment[], definitions: DefinitionEffects[]): ConditionModifiers {
  const byId = new Map(definitions.map(def => [def.id, def.effects]))
  const totals: ConditionModifiers = {}
  for (const assignment of assignments) {
    for (const effect of byId.get(assignment.definition_id) || []) {
      if (effect.type !== 'modifier' || !effect.target || !Number.isFinite(effect.value)) continue
      const key = `${effect.unit === 'percent' ? 'percent:' : ''}${effect.target}:${normalize(effect.key || '*')}`
      totals[key] = (totals[key] || 0) + Number(effect.value)
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

export type ConditionRuleState = {
  dice: ConditionModifiers
  resources: ConditionModifiers
  restrictions: string[]
  periodic: { resource: string; dice: string; definitionId: string }[]
  counters: { rounds: number; definitionId: string }[]
}

export function calculateConditionRules(assignments: Assignment[], definitions: DefinitionEffects[]): ConditionRuleState {
  const byId = new Map(definitions.map(def => [def.id, def.effects]))
  const result: ConditionRuleState = { dice: {}, resources: {}, restrictions: [], periodic: [], counters: [] }
  const restrictions = new Set<string>()
  for (const assignment of assignments) {
    for (const raw of byId.get(assignment.definition_id) || []) {
      const effect = raw as Effect & { dice?: string }
      const key = normalize(effect.key || '*')
      const value = Number(effect.value)
      if (effect.type === 'dice' && ['status', 'combat_points'].includes(effect.target || '') && Number.isFinite(value)) {
        const index = `${effect.target || 'status'}:${key}`
        result.dice[index] = (result.dice[index] || 0) + value
      } else if (effect.type === 'resource' && ['pv', 'ps', 'pr'].includes(key) && Number.isFinite(value)) {
        const index = `resource:${key}`
        result.resources[index] = (result.resources[index] || 0) + value
      } else if (effect.type === 'restriction' && key !== '*') restrictions.add(key)
      else if (effect.type === 'periodic_damage' && /^\d{1,2}d\d{1,3}$/i.test(effect.dice || '')) {
        result.periodic.push({ resource: key, dice: effect.dice!, definitionId: assignment.definition_id })
      } else if (effect.type === 'round_counter' && Number.isInteger(value) && value > 0) {
        result.counters.push({ rounds: value, definitionId: assignment.definition_id })
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
  return state?.scope === scope ? state.rules : { dice: {}, resources: {}, restrictions: [], periodic: [], counters: [] }
}

/** Aplica pontos e porcentagens sobre o valor-base, arredondando ao inteiro mais próximo. */
export function applyConditionModifier(base: number, modifiers: ConditionModifiers, target: string, key: string): number {
  const fixed = conditionModifier(modifiers, target, key)
  const percent = conditionModifier(modifiers, `percent:${target}`, key)
  return Math.round((base + fixed) * (1 + percent / 100))
}
