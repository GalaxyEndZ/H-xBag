import type { RPGSystem } from './types'
import { KISATSUTAI_SYSTEM } from '../kisatsutai/system'


// Sistemas de RPG registrados no HäxBag.
const systems: RPGSystem[] = [
  KISATSUTAI_SYSTEM,
]

// Adiciona um sistema ao registro.
export function registerSystem(system: RPGSystem): void {
  const alreadyRegistered = systems.some(
    registered => registered.id === system.id
  )

  if (alreadyRegistered) {
    throw new Error(`O sistema "${system.id}" já está registrado.`)
  }

  systems.push(system)
}

// Retorna todos os sistemas registrados.
export function getRegisteredSystems(): RPGSystem[] {
  return [...systems]
}

// Localiza um sistema pelo nome usado na campanha.
export function getSystemByName(
  systemName?: string | null
): RPGSystem | undefined {
  return systems.find(system => system.matches(systemName))
}