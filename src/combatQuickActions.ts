import { calculateSheetPhysicalDamage, type SheetDamageType, type calculateSheetDefenses } from './combatDefenses'

export type QuickReaction = 'none' | 'block_miss' | 'block_success' | 'block_critical' | 'dodge_success'
export type QuickResource = 'pv' | 'ps' | 'pr'
export type QuickDamageInput = {
  incoming: number
  resource: QuickResource
  damageType: SheetDamageType
  reaction: QuickReaction
  useDefenses: boolean
  defenses: ReturnType<typeof calculateSheetDefenses> | null
  extraReduction: number
  penetrationFlat: number
  penetrationPercent: number
  specialBruteProtectionOnly: boolean
}
export type QuickDamageResult = {
  reactionPrevented: number
  armorPrevented: number
  protectionPrevented: number
  sanityPrevented: number
  extraPrevented: number
  net: number
  armorValue: number
  effectiveArmor: number
}

/** O cálculo não altera a ficha; a função SQL aplica apenas o dano líquido autorizado pelo mestre. */
export function calculateQuickDamage(input: QuickDamageInput): QuickDamageResult {
  const incoming = Math.max(0, Math.trunc(input.incoming))
  const rate = input.resource === 'pv'
    ? input.reaction === 'block_miss' ? 0.25 : input.reaction === 'block_success' ? 0.5
      : input.reaction === 'block_critical' || input.reaction === 'dodge_success' ? 1 : 0
    : 0
  const reactionPrevented = Math.floor(incoming * rate)
  const postReaction = Math.max(0, incoming - reactionPrevented)
  const defenses = input.useDefenses ? input.defenses : null
  const armorValue = defenses && input.resource === 'pv' && defenses.armorCovers(input.damageType)
    ? Math.max(0, defenses.armorResistance) : 0
  const penetrationFlat = Math.max(0, Math.trunc(input.penetrationFlat))
  const penetrationPercent = Math.max(0, Math.min(100, Math.trunc(input.penetrationPercent)))
  const effectiveArmor = Math.max(0, Math.floor(Math.max(0, armorValue - penetrationFlat) * (100 - penetrationPercent) / 100))
  // Reutiliza a regra das fichas inclusive para a cobertura especial de Kisatsutai.
  const physical = defenses && input.resource === 'pv'
    ? calculateSheetPhysicalDamage({ incoming: postReaction, reactionReduction: 0,
      damageType: input.damageType,
      defenses: { ...defenses, armorResistance: effectiveArmor },
      specialBruteProtectionOnly: input.specialBruteProtectionOnly })
    : null
  const armorPrevented = Math.min(postReaction, physical ? effectiveArmor : 0)
  const protectionPrevented = Math.max(0, (physical?.armorPrevented ?? 0) - armorPrevented)
  const sanityPrevented = input.resource === 'ps' && defenses
    ? Math.min(postReaction, Math.max(0, defenses.sanityProtection)) : 0
  const afterDefenses = Math.max(0, postReaction - armorPrevented - protectionPrevented - sanityPrevented)
  const extraPrevented = input.resource === 'pr' ? 0 : Math.min(afterDefenses, Math.max(0, Math.trunc(input.extraReduction)))
  return { reactionPrevented, armorPrevented, protectionPrevented, sanityPrevented,
    extraPrevented, net: Math.max(0, afterDefenses - extraPrevented), armorValue, effectiveArmor }
}

export function previewResource(current: number, max: number | undefined, resource: QuickResource, delta: number): number {
  let next = Math.max(0, Math.min(1000000, current + delta))
  if (delta > 0 && resource !== 'pv' && max !== undefined && Number.isInteger(max))
    next = Math.max(current, Math.min(next, max))
  return next
}
