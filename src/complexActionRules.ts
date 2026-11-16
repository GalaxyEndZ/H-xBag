/** Regras da Ação Complexa, válidas durante uma cena e por ficha. */
export const MAX_COMPLEX_ACTIONS_PER_SCENE = 3

/** Só as seis perícias principais da ficha podem receber bônus de Ação Complexa. */
export const COMPLEX_MAIN_SKILLS = [
  { key: 'vigor', label: 'Vigor' },
  { key: 'mental', label: 'Mental' },
  { key: 'combat', label: 'Combate' },
  { key: 'dexterity', label: 'Destreza' },
  { key: 'resistance', label: 'Resistência' },
  { key: 'ability', label: 'Habilidade' },
] as const

export type ComplexMainSkillKey = typeof COMPLEX_MAIN_SKILLS[number]['key']

export function isComplexMainSkillKey(key: string): key is ComplexMainSkillKey {
  return COMPLEX_MAIN_SKILLS.some(skill => skill.key === key)
}

export type ComplexPreparation = {
  sourceSkillKey: string
  sourceSkillLabel: string
  targetSkillKey: string
  targetSkillLabel: string
  bonus: number
  consumed: boolean
}

/** Preserva as faixas de resultados já usadas pelo HäxBag. */
export function complexBonusFromResult(result: number): number {
  if (!Number.isInteger(result) || result < 15) return 0
  if (result >= 35) return 5
  if (result >= 30) return 4
  if (result >= 25) return 3
  if (result >= 20) return 2
  return 1
}

/** Impede a repetição de origem e de destino, mesmo após o bônus ter sido consumido. */
export function complexPreparationError(
  preparations: readonly ComplexPreparation[],
  sourceSkillKey: string,
  targetSkillKey: string,
  result: number,
): string | null {
  if (preparations.length >= MAX_COMPLEX_ACTIONS_PER_SCENE) return 'Limite de três preparações atingido nesta cena.'
  if (!sourceSkillKey) return 'Escolha uma perícia extra disponível para realizar o preparo.'
  if (!isComplexMainSkillKey(targetSkillKey)) return 'Escolha Vigor, Mental, Combate, Destreza, Resistência ou Habilidade como destino.'
  if (preparations.some(preparation => preparation.sourceSkillKey === sourceSkillKey))
    return 'Essa perícia extra já foi utilizada em uma Ação Complexa nesta cena.'
  if (preparations.some(preparation => preparation.targetSkillKey === targetSkillKey))
    return 'Essa perícia já recebeu um bônus de Ação Complexa nesta cena.'
  if (!Number.isInteger(result) || result < 0) return 'Informe um resultado inteiro e não negativo.'
  if (complexBonusFromResult(result) === 0) return 'É necessário obter pelo menos 15 para gerar bônus.'
  return null
}

/** Somente o teste da perícia específica recebe o bônus pendente. */
export function pendingComplexBonus(preparations: readonly ComplexPreparation[], skillKey: string): number {
  return preparations.find(preparation => preparation.targetSkillKey === skillKey && !preparation.consumed)?.bonus ?? 0
}

/** Consumir não libera origem nem destino para outro preparo na mesma cena. */
export function consumeComplexBonus(preparations: readonly ComplexPreparation[], skillKey: string): ComplexPreparation[] {
  return preparations.map(preparation =>
    preparation.targetSkillKey === skillKey && !preparation.consumed
      ? {...preparation, consumed: true}
      : preparation
  )
}
