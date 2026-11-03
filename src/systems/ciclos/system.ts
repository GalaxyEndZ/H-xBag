import type { RPGSystem } from '../core/types'

export const CICLOS_SYSTEM: RPGSystem = {
  id: 'ciclos',
  name: 'Ciclos',
  matches: systemName => String(systemName ?? '').trim().toLowerCase() === 'ciclos',
  data: { features: { usesLevels: true, usesRanks: false, usesFamilyTiers: false, usesSkillPoints: false, hasDefaultCurrency: false } },
}
