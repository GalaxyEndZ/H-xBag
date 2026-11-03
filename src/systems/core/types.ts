// Estruturas comuns utilizadas por todos os sistemas de RPG.

export interface RPGSystem {
  id: string
  name: string

  // Identifica se uma campanha pertence a este sistema.
  matches(systemName?: string | null): boolean
}