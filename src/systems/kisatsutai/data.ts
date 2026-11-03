// Dados e progressão específicos do sistema Kisatsutai.
// Mantidos fora do App.tsx para permitir adicionar outros sistemas sem misturar regras.

export const KISATSUTAI_FAMILY_TIERS = {
  '1': { label: 'Tier 1 — Família principal', pv: 30, ps: 25, pr: 60, strength: 1, agility: 1, defense: 1, breathing: 2, intellect: 1, points: 7, focus: 24 },
  '2': { label: 'Tier 2 — Família muito influente', pv: 25, ps: 20, pr: 40, strength: 0, agility: 1, defense: 0, breathing: 2, intellect: 1, points: 5, focus: 12 },
  '3': { label: 'Tier 3 — Envolvimento direto', pv: 20, ps: 15, pr: 20, strength: 0, agility: 0, defense: 0, breathing: 1, intellect: 1, points: 3, focus: 6 },
  '4': { label: 'Tier 4 — Conhecimento dos Kisatsutai', pv: 15, ps: 10, pr: 10, strength: 0, agility: 0, defense: -1, breathing: 1, intellect: 1, points: 2, focus: 4 },
  '5': { label: 'Tier 5 — Sem relação com Kisatsutai', pv: 10, ps: 5, pr: 5, strength: -1, agility: 0, defense: -1, breathing: -1, intellect: 0, points: 0, focus: 2 },
} as const

export const KISATSUTAI_RANKS = [
  { id: 'zaidan', name: 'Zaidan', group: 'Carpa', focus: '1', benefits: '+15 PV, +10 PS, +0 PR; 20 pontos de perícias principais; +1 atributo extra; dano 1d4; formas Carpa e Raposa.' },
  { id: 'mizunoto', name: 'Mizunoto', group: 'Raposa', focus: '2', benefits: '+30 PV, +25 PS, +5 PR; 25 pontos de perícias; +1 atributo extra; dano 1d6; fluxo Raposa.' },
  { id: 'mizunoe', name: 'Mizunoe', group: 'Raposa', focus: '4', benefits: '+35 PV, +30 PS, +10 PR; 25 pontos de perícias; +2 atributos extras; dano 1d6; fluxo Raposa.' },
  { id: 'kanoto', name: 'Kanoto', group: 'Raposa', focus: '6', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'kanoe', name: 'Kanoe', group: 'Tigre', focus: '10', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'tsuchinoto', name: 'Tsuchinoto', group: 'Tigre', focus: '14', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'tsuchinoe', name: 'Tsuchinoe', group: 'Tigre', focus: '18', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'hinoto', name: 'Hinoto', group: 'Dragão', focus: '24', benefits: '+40 PV, +35 PS, +20 PR; 28 pontos de perícias; +4 atributos extras; Concentração Total Aprimorada (DT19); dano 1d10.' },
  { id: 'hinoe', name: 'Hinoe', group: 'Dragão', focus: '28', benefits: '+41 PV, +36 PS, +25 PR; 28 pontos de perícias; +5 atributos extras; técnica aprimorada DT19; dano 1d10.' },
  { id: 'kinoto', name: 'Kinoto', group: 'Dragão', focus: '32', benefits: '+42 PV, +37 PS, +30 PR; 29 pontos de perícias; +5 atributos extras; técnica aprimorada DT19; dano 1d10.' },
  { id: 'kinoe', name: 'Kinoe (Tsuguko)', group: 'Corvo', focus: '44', benefits: '+44 PV, +39 PS, +35 PR; 29 pontos de perícias; +6 atributos extras; técnica completa DT18; dano 1d12; fluxo Corvo.' },
  { id: 'hashira-inferior', name: 'Hashira Inferior (Shinkai)', group: 'Corvo', focus: '92', benefits: '+56 PV, +51 PS, +80 PR; 35 pontos de perícias; +10 atributos extras; técnica perfeita DT17; não gasta PR nas formas Tigre e Raposa; dano 1d12.' },
  { id: 'hashira-superior', name: 'Hashira Superior (Saikou)', group: 'Corvo', focus: 'Ilimitado', benefits: 'Benefícios totais não definidos no material.' },
] as const

export const KISATSUTAI_ARCHETYPES = [
  'Linha de Frente',
  'Flanco',
  'Defensor',
  'Especialista',
  'Suporte',
] as const

export const KISATSUTAI_RANK_STATUS: Record<string, { pv: number; ps: number; pr: number }> = {
  zaidan: { pv: 15, ps: 10, pr: 0 },
  mizunoto: { pv: 30, ps: 25, pr: 5 },
  mizunoe: { pv: 35, ps: 30, pr: 10 },
  hinoto: { pv: 40, ps: 35, pr: 20 },
  hinoe: { pv: 41, ps: 36, pr: 25 },
  kinoto: { pv: 42, ps: 37, pr: 30 },
  kinoe: { pv: 44, ps: 39, pr: 35 },
  'hashira-inferior': { pv: 56, ps: 51, pr: 80 },
}

export const KISATSUTAI_PROMOTIONS: Record<string, string> = {
  'zaidan>mizunoto': '+15 PV, +15 PS, +5 PR, +5 pontos de perícias, +1 foco; dano 1d4 → 1d6; desbloqueia fluxo Raposa.',
  'mizunoto>mizunoe': '+5 PV, +5 PS, +5 PR, +1 atributo extra, +2 foco.',
  'mizunoe>kanoto': '+1 PV, +1 PS, +5 PR, +1 ponto de perícia principal, +2 foco.',
  'hinoto>hinoe': 'Registro inconsistente no material: menciona +1 PR, +1 PS, +5 PR, +1 ponto de atributo e +6 foco. Confirmar com o mestre antes de aplicar.',
  'kinoto>kinoe': '+2 PV, +2 PS, +5 PR, +1 ponto de atributo, técnica completa DT18, dano 1d10 → 1d12, fluxo Corvo, +12 foco e formas Corvo.',
  'kinoe>hashira-inferior': '+12 PV, +12 PS, +45 PR, +6 perícias principais, +4 atributos extras, técnica perfeita DT17, formas Tigre/Raposa sem custo de PR e +48 foco.',
}

