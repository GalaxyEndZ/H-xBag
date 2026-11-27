import { KISATSUTAI_SKILL_GROUPS } from './systems/kisatsutai/extendedData'

/** Ocupações civis são narrativas: a seleção NÃO concede bônus automáticos de treinamento. */
export const CIVIL_SKILL_LIMIT = 5
export const CIVIL_SKILLS = Object.entries(KISATSUTAI_SKILL_GROUPS).flatMap(([group, entries]) =>
  entries.map(skill => ({ key: `${group}:${skill.name}`, name: skill.name, group }))
)

export const CIVIL_JOB_PRESETS = [
  { name: 'Agricultor', skills: ['Preparo', 'Sobrevivência', 'Atletismo', 'Localizar', 'Comércio'] },
  { name: 'Ferreiro', skills: ['Montagem', 'Engenharia', 'Técnica', 'Comércio', 'Atletismo'] },
  { name: 'Comerciante', skills: ['Comércio', 'Contabilidade', 'Lábia', 'Diplomacia', 'Percepção'] },
  { name: 'Curandeiro', skills: ['Medicina', 'Primeiros Socorros', 'Farmácia', 'Psicologia', 'Preparo'] },
  { name: 'Cozinheiro', skills: ['Culinária', 'Preparo', 'Comércio', 'Montagem', 'Percepção'] },
  { name: 'Carpinteiro', skills: ['Montagem', 'Arquitetura', 'Atletismo', 'Engenharia', 'Técnica'] },
  { name: 'Professor', skills: ['Literatura', 'História', 'Liderança', 'Cultura', 'Diplomacia'] },
  { name: 'Guarda', skills: ['Percepção', 'Atletismo', 'Tática', 'Imobilizar', 'Primeiros Socorros'] },
  { name: 'Mensageiro', skills: ['Corrida', 'Localizar', 'Sobrevivência', 'Percepção', 'Discrição'] },
  { name: 'Artista', skills: ['Artes', 'Música', 'Cultura', 'Carisma', 'Aparência'] },
  { name: 'Pescador', skills: ['Navegar', 'Mergulho', 'Sobrevivência', 'Localizar', 'Preparo'] },
  { name: 'Estalajadeiro', skills: ['Comércio', 'Culinária', 'Contabilidade', 'Diplomacia', 'Lábia'] },
] as const

export function civilSuggestedSkills(job: string): string[] {
  const preset = CIVIL_JOB_PRESETS.find(entry => entry.name.toLocaleLowerCase('pt-BR') === job.trim().toLocaleLowerCase('pt-BR'))
  if (!preset) return []
  const values = new Set<string>(preset.skills)
  return CIVIL_SKILLS.filter(skill => values.has(skill.name)).map(skill => skill.key).slice(0, CIVIL_SKILL_LIMIT)
}

/** Remove habilidades desconhecidas e duplicatas preservando a ordem e o limite. */
export function normalizeCivilSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const available = new Set(CIVIL_SKILLS.map(skill => skill.key))
  const unique = new Set<string>()
  for (const raw of value) {
    if (typeof raw === 'string' && available.has(raw)) unique.add(raw)
    if (unique.size === CIVIL_SKILL_LIMIT) break
  }
  return [...unique]
}

export function civilSkillLabel(key: string): string {
  return CIVIL_SKILLS.find(skill => skill.key === key)?.name || key.split(':').slice(1).join(':') || key
}
