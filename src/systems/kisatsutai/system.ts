import type { RPGSystem } from '../core/types'
import { isKisatsutaiSystem } from './logic'

export const KISATSUTAI_SYSTEM: RPGSystem = {
  id: 'kisatsutai',
  name: 'Kisatsutai',

  matches(systemName) {
    return isKisatsutaiSystem(systemName)
  },
}