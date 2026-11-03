import type { RPGSystem } from '../core/types'

export const CYBERFLOWER_SYSTEM: RPGSystem = {
  id: 'cyberflower',
  name: 'CyberFlower',
  matches: systemName => String(systemName ?? '').trim().toLowerCase() === 'cyberflower',
  data: { features: { usesLevels: true, usesRanks: false, usesFamilyTiers: false, usesSkillPoints: false, hasDefaultCurrency: false } },
}
