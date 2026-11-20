import type { RPGSystem } from '../core/types'

/**
 * Regras neutras para campanhas sem um sistema dedicado.
 * Não aplica automaticamente graduações, arquétipos ou cálculos proprietários.
 * Os campos já usados pelas fichas continuam sendo a fonte de verdade.
 */
export const GENERIC_SYSTEM: RPGSystem = {
  id: 'generico',
  name: 'Genérico',
  matches: systemName => {
    const normalized = String(systemName ?? '').trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    return ['generico', 'sistema generico', 'personalizado'].includes(normalized)
  },
  data: {
    resource: { name: 'Mana', abbreviation: 'PM', pointsLabel: 'Pontos de Mana (PM)' },
    features: {
      usesRanks: false,
      usesLevels: true,
      usesFamilyTiers: false,
      usesSkillPoints: false,
      hasDefaultCurrency: false,
      hasCyberneticsInventory: false,
    },
  },
}
