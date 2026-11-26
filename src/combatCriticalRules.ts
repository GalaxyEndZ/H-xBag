import { flowIsActive, type FlowAttribute, type FlowSelections, type FlowTier } from './systems/kisatsutai/flowRules'

/** Valores em combat.critical continuam sendo a margem BASE da ficha. */
export type CriticalFormClass = 'none' | 'raposa' | 'tigre' | 'dragao'
export const CRITICAL_FORM_LABELS: Record<CriticalFormClass, string> = {
  none: 'Sem forma de Respiração',
  raposa: 'Forma Raposa',
  tigre: 'Forma Tigre',
  dragao: 'Forma Dragão',
}
export const CRITICAL_BONUS_DICE: Record<CriticalFormClass, number> = {
  none: 1, raposa: 2, tigre: 4, dragao: 6,
}
export type CriticalProfile = {
  base: number
  afterConditions: number
  threshold: number
  agilityBonuses: number
  activeAgilityFlows: FlowTier[]
  corvoStrength: boolean
  tigreStrength: boolean
  dragaoStrength: boolean
  corvoDefense: boolean
}

const bounded = (value: number) => Math.max(2, Math.min(20, Math.floor(value)))
export function calculateCriticalProfile(input: {
  base: unknown
  conditioned?: unknown
  selections?: FlowSelections
  group?: string
}): CriticalProfile {
  const rawBase = Number(input.base)
  const base = bounded(Number.isFinite(rawBase) && rawBase > 0 ? rawBase : 20)
  const rawConditioned = Number(input.conditioned)
  const afterConditions = bounded(input.conditioned === undefined || !Number.isFinite(rawConditioned) ? base : rawConditioned)
  const selections = input.selections ?? {}
  const group = input.group ?? ''
  const active = (tier: FlowTier, attribute: FlowAttribute) => flowIsActive(selections, group, tier, attribute)
  const activeAgilityFlows: FlowTier[] = (['tigre', 'dragao', 'corvo'] as const).filter(tier => active(tier, 'agility'))
  return {
    base,
    afterConditions,
    threshold: bounded(afterConditions - activeAgilityFlows.length),
    agilityBonuses: activeAgilityFlows.length,
    activeAgilityFlows,
    corvoStrength: active('corvo', 'strength'),
    tigreStrength: active('tigre', 'strength'),
    dragaoStrength: active('dragao', 'strength'),
    corvoDefense: active('corvo', 'defense'),
  }
}

export function classifyCriticalD20(value: number, threshold: number): 'critical' | 'failure' | 'normal' {
  // O 1 natural é falha crítica mesmo com modificadores que melhorem a margem.
  if (value === 1) return 'failure'
  return value >= bounded(threshold) ? 'critical' : 'normal'
}

export type WeaponDice = { count: number; sides: number }
/** Interpretar apenas fórmulas simples de dados (ex.: 1d8, 2d6+3). Não adivinhar dados de armas. */
export function parseWeaponDice(formula: string): WeaponDice | null {
  const match = /^\s*(\d+)\s*d\s*(\d+)(?:\s*[+-]\s*\d+)?\s*$/i.exec(formula)
  if (!match) return null
  const count = Number(match[1]); const sides = Number(match[2])
  if (!Number.isSafeInteger(count) || count < 1 || count > 20 || !Number.isSafeInteger(sides) || sides < 2 || sides > 100) return null
  return { count, sides }
}

export function getCriticalBonus(input: { form: CriticalFormClass; weaponFormula: string; corvoStrength: boolean }) {
  const weapon = parseWeaponDice(input.weaponFormula)
  const bonusDice = CRITICAL_BONUS_DICE[input.form] * (input.corvoStrength ? 2 : 1)
  return {
    weapon,
    bonusDice,
    formula: weapon ? `+${bonusDice}d${weapon.sides}` : null,
  }
}

export function rollCriticalBonus(
  input: { form: CriticalFormClass; weaponFormula: string; corvoStrength: boolean },
  die: (sides: number) => number = sides => Math.floor(Math.random() * sides) + 1,
) {
  const bonus = getCriticalBonus(input)
  if (!bonus.weapon) return { ...bonus, rolls: [] as number[], total: null as number | null }
  const rolls = Array.from({ length: bonus.bonusDice }, () => die(bonus.weapon!.sides))
  return { ...bonus, rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) }
}
