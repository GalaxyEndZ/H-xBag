import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ConditionModifiers = Record<string, number>
type Effect = { type?: string; target?: string; key?: string; value?: number }
type Assignment = { definition_id: string }
type DefinitionEffects = { id: string; effects: Effect[] }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function conditionModifier(modifiers: ConditionModifiers, target: string, key: string): number {
  return (modifiers[`${target}:${normalize(key)}`] || 0) + (modifiers[`${target}:*`] || 0)
}

export function calculateConditionModifiers(assignments: Assignment[], definitions: DefinitionEffects[]): ConditionModifiers {
  const byId = new Map(definitions.map(def => [def.id, def.effects]))
  const totals: ConditionModifiers = {}
  for (const assignment of assignments) {
    for (const effect of byId.get(assignment.definition_id) || []) {
      if (effect.type !== 'modifier' || !effect.target || !Number.isFinite(effect.value)) continue
      const key = `${effect.target}:${normalize(effect.key || '*')}`
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
