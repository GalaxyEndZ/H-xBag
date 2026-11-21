// Regras reutilizadas pelo combate de personagens e inimigos.
// O formato dos itens é normalizado antes do cálculo, evitando que as fichas
// dependam das tabelas de inventário umas das outras.
export type SheetCombatEquipment = {
  name?: string
  weaponDamage?: string
  equipmentType?: string
  armorClass?: string
  armorCoverage?: string
  protectionTier?: string
  protectionMode?: string
  kitType?: string
  kitSkills?: string[]
  kitSkillBonus?: number
  kitSkillBonuses?: number[]
}
export type SheetDamageType = 'cortante_perfurante' | 'especial_bruto'

export function calculateSheetDefenses(
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

export function calculateSheetPhysicalDamage(input: {
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

