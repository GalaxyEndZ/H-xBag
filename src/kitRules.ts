/**
 * Kit definitions supplied for the HäxBag inventory system (V83).
 * The count of affected skills is defined. The NUMERICAL bonus per skill is
 * deliberately unspecified by the rules; no default +1/+2 is invented.
 * Existing scarcity mechanics are reused rather than replacing them.
 */
export const KIT_TYPE_KEYS = [
  'equip_simple', 'equip_standard', 'equip_rare',
  'immediate', 'preparation', 'prolonged',
] as const
export type KitType = typeof KIT_TYPE_KEYS[number]
export type KitFamily = 'equippable' | 'consumable'
export type KitBenefitMode = 'skills' | 'protection' | 'three_archetype' | 'main_and_archetype'
export type KitEffect = 'damage' | 'resistance' | 'combat_point'
export type ScarcityLevel = 1 | 2 | 3 | 4
export type KitDefinition = {
  type: KitType
  name: string
  family: KitFamily
  fixedWeight?: number
  weights?: Partial<Record<ScarcityLevel, number>>
  description: string
}

export const KIT_DEFINITIONS: Record<KitType, KitDefinition> = {
  equip_simple: {
    type: 'equip_simple', name: 'Equipável simples', family: 'equippable', fixedWeight: 1,
    description: 'Afeta duas perícias extras. O valor do aumento é definido pelo mestre.',
  },
  equip_standard: {
    type: 'equip_standard', name: 'Equipável padrão', family: 'equippable', fixedWeight: 2,
    description: 'Afeta duas perícias de arquétipo OU concede proteção moderada.',
  },
  equip_rare: {
    type: 'equip_rare', name: 'Equipável raro', family: 'equippable', fixedWeight: 4.5,
    description: 'Afeta três perícias de arquétipo OU uma principal e duas de arquétipo. Possui funcionalidade única.',
  },
  immediate: {
    type: 'immediate', name: 'Consumível de uso imediato', family: 'consumable',
    weights: {4: 1, 3: 2.5, 2: 5.75, 1: 12},
    description: 'Buff temporário de dano, resistência ou um ponto de combate por até 1d6 rodadas.',
  },
  preparation: {
    type: 'preparation', name: 'Consumível de pré-preparo', family: 'consumable',
    weights: {4: 2.75, 3: 5.5, 2: 12},
    description: 'Buff de dano, resistência ou ponto de combate por uma cena.',
  },
  prolonged: {
    type: 'prolonged', name: 'Consumível de uso prolongado', family: 'consumable',
    weights: {4: 5.5, 3: 12},
    description: 'Duração e tipo de benefício ainda não especificados.',
  },
}

export const SCARCITY_DICE: Record<ScarcityLevel, number> = {1: 12, 2: 8, 3: 6, 4: 4}
export const SCARCITY_CHARGES: Record<ScarcityLevel, number> = {1: 7, 2: 5, 3: 3, 4: 1}
export const KIT_MAIN_SKILLS = ['VIGOR', 'MENTAL', 'COMBATE', 'DESTREZA', 'RESISTÊNCIA', 'HABILIDADE'] as const

export function isKitType(value: unknown): value is KitType {
  return typeof value === 'string' && (KIT_TYPE_KEYS as readonly string[]).includes(value)
}
export function kitDefinition(type: KitType | null | undefined): KitDefinition | null {
  return type ? KIT_DEFINITIONS[type] : null
}
export function kitAvailableScarcityLevels(type: KitType | null | undefined): ScarcityLevel[] {
  const def = kitDefinition(type)
  return def?.weights ? ([1, 2, 3, 4] as ScarcityLevel[]).filter(level => def.weights?.[level] !== undefined) : []
}
export function kitWeight(type: KitType | null | undefined, level: number, exhausted = false): number | null {
  const def = kitDefinition(type)
  if (!def) return null
  if (def.family === 'equippable') return def.fixedWeight ?? null
  if (exhausted) return 0 // Existing inventory semantics for exhausted consumables.
  if (!Number.isInteger(level) || level < 1 || level > 4) return null
  return def.weights?.[level as ScarcityLevel] ?? null
}
export function normalizeKitLevel(type: KitType, level: number): ScarcityLevel | null {
  const available = kitAvailableScarcityLevels(type)
  if (!available.length) return null
  return available.includes(level as ScarcityLevel) ? level as ScarcityLevel : available[0]
}
export function kitSlots(type: KitType, benefitMode: KitBenefitMode): {group: 'extra' | 'archetype' | 'main'; label: string}[] {
  if (type === 'equip_simple') return [
    {group: 'extra', label: 'Perícia extra 1'}, {group: 'extra', label: 'Perícia extra 2'},
  ]
  if (type === 'equip_standard' && benefitMode !== 'protection') return [
    {group: 'archetype', label: 'Perícia de arquétipo 1'}, {group: 'archetype', label: 'Perícia de arquétipo 2'},
  ]
  if (type === 'equip_rare') return benefitMode === 'main_and_archetype' ? [
    {group: 'main', label: 'Perícia principal'},
    {group: 'archetype', label: 'Perícia de arquétipo 1'},
    {group: 'archetype', label: 'Perícia de arquétipo 2'},
  ] : [
    {group: 'archetype', label: 'Perícia de arquétipo 1'},
    {group: 'archetype', label: 'Perícia de arquétipo 2'},
    {group: 'archetype', label: 'Perícia de arquétipo 3'},
  ]
  return []
}
export function kitEffectLabel(effect: KitEffect | null): string {
  return effect === 'damage' ? 'Dano' : effect === 'resistance' ? 'Resistência' : effect === 'combat_point' ? 'Ponto de combate' : 'Não definido'
}
