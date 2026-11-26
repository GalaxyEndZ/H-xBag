/** V274: rolagem de dano FÍSICO de ataque. Nunca altera PV/PS do próprio personagem. */
import { parseWeaponDice, rollCriticalBonus, type CriticalFormClass } from './combatCriticalRules'

export type PhysicalAttackDamageInput = {
  baseFormula: string
  weaponFormula: string
  kitExtra: number
  dragaoStrength: boolean
  corvoStrength: boolean
  confirmedCritical: boolean
  criticalForm: CriticalFormClass
}
export type PhysicalAttackDamageResult = { total: number; details: string[] }

export function rollPhysicalAttackDamage(
  input: PhysicalAttackDamageInput,
  die: (sides: number) => number = sides => Math.floor(Math.random() * sides) + 1,
): PhysicalAttackDamageResult | null {
  const base = parseWeaponDice(input.baseFormula)
  const weapon = parseWeaponDice(input.weaponFormula)
  if (!base && !weapon) return null
  const details: string[] = []
  let total = 0
  const rollPart = (label: string, count: number, sides: number) => {
    const rolls = Array.from({ length: count }, () => die(sides))
    const value = rolls.reduce((sum, roll) => sum + roll, 0)
    total += value
    details.push(`${label} ${count}d${sides} [${rolls.join(', ')}] = ${value}`)
  }
  if (base) rollPart('Dano base:', base.count, base.sides)
  if (weapon) rollPart('Arma:', weapon.count, weapon.sides)
  if (input.dragaoStrength && base) rollPart('Ímpeto Certeiro:', 2, base.sides)
  const kit = Number.isFinite(input.kitExtra) ? Math.max(0, Math.floor(input.kitExtra)) : 0
  if (kit) { total += kit; details.push(`Kit: +${kit}`) }
  if (input.corvoStrength) { total += 10; details.push('Guerreiro Insuperável (acerto): +10') }
  if (input.confirmedCritical && weapon) {
    const critical = rollCriticalBonus({ form: input.criticalForm, weaponFormula: input.weaponFormula, corvoStrength: input.corvoStrength }, die)
    if (critical.total !== null) {
      total += critical.total
      details.push(`Crítico confirmado: ${critical.formula} [${critical.rolls.join(', ')}] = +${critical.total}`)
    }
  }
  return { total, details }
}
