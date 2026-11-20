import type { RPGSystem } from './types'
import { KISATSUTAI_SYSTEM } from '../kisatsutai/system'
import { CICLOS_SYSTEM } from '../ciclos/system'
import { CYBERFLOWER_SYSTEM } from '../cyberflower/system'
import { GENERIC_SYSTEM } from '../generico/system'


// Sistemas de RPG registrados no HäxBag.
const systems: RPGSystem[] = [
  GENERIC_SYSTEM,
  KISATSUTAI_SYSTEM,
  CICLOS_SYSTEM,
  CYBERFLOWER_SYSTEM,
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

// Verifica se uma campanha pertence a um sistema específico.
export function isSystem(
  systemName: string | null | undefined,
  systemId: string
): boolean {
  return getSystemByName(systemName)?.id === systemId
}

/**
 * Resolve um sistema conhecido ou o conjunto neutro de regras genéricas.
 * Mantém `getSystemByName` estrito para identificar sistemas personalizados
 * sem alterar o nome escolhido pelo mestre.
 */
export function getEffectiveSystemByName(systemName?: string | null): RPGSystem {
  return getSystemByName(systemName) ?? GENERIC_SYSTEM
}

/** Detecta sistemas sem regras próprias (Genérico ou nome personalizado). */
export function isGenericSystem(systemName?: string | null): boolean {
  return getEffectiveSystemByName(systemName).id === GENERIC_SYSTEM.id
}
