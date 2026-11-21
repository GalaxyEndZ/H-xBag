/** Teto de bônus efetivo das perícias gerais/extras e de arquétipo do Kisatsutai.
 * As seis perícias principais não usam este limite. */
import { KISATSUTAI_TRAINING } from './systems/kisatsutai/extendedData'

export const MAX_KISATSUTAI_SKILL_BONUS = 25

/** Mantém penalidades negativas; limita somente o teto superior, inclusive após kits e condições. */
export function capKisatsutaiSkillBonus(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_KISATSUTAI_SKILL_BONUS, Math.round(value)) : 0
}

/** Os treinamentos antigos são níveis (5/10/15/20); os novos podem registrar 25 exatamente.
 * O valor individual salvo é consultado apenas para uma perícia realmente treinada. */
export function storedKisatsutaiSkillBonus(
  key: string, level: string | undefined, exactBonuses: Record<string, number> = {},
): number {
  const levels: Record<string, number> = { leve: 5, medio: 10, avancado: 15, completo: 20 }
  if (!level || !Object.prototype.hasOwnProperty.call(levels, level)) return 0
  const exact = exactBonuses[key]
  return capKisatsutaiSkillBonus(typeof exact === 'number' && Number.isFinite(exact) ? exact : levels[level])
}

/** Constrói níveis legados e bônus numéricos exatos sem arredondar +25 para +20.
 * Cada alocação de Intelecto vale +5. Quem excede o teto deve ser bloqueado no editor. */
export function buildKisatsutaiTrainingData(
  base: Record<string, keyof typeof KISATSUTAI_TRAINING>, allocations: string[],
): {extraTrainings: Record<string, keyof typeof KISATSUTAI_TRAINING>; extraTrainingBonuses: Record<string, number>} {
  const selectedKeys = new Set([...Object.keys(base), ...allocations.filter(Boolean)])
  const extraTrainings = { ...base }
  const extraTrainingBonuses: Record<string, number> = {}
  for (const skillKey of selectedKeys) {
    const points = (base[skillKey] ? KISATSUTAI_TRAINING[base[skillKey]] : 0) + allocations.filter(value => value === skillKey).length * 5
    extraTrainingBonuses[skillKey] = capKisatsutaiSkillBonus(points)
    extraTrainings[skillKey] = points >= 20 ? 'completo' : points >= 15 ? 'avancado' : points >= 10 ? 'medio' : 'leve'
  }
  return { extraTrainings, extraTrainingBonuses }
}
