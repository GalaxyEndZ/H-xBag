
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
  {
    id: 'zaidan',
    name: 'Zaidan',
    group: 'Carpa',
    focus: '1',
    benefits: '+15 PV, +10 PS, +0 PR; 20 pontos de perícias principais; +1 atributo extra; dano 1d4; formas Carpa e Raposa.',
  },
  {
    id: 'mizunoto',
    name: 'Mizunoto',
    group: 'Raposa',
    focus: '2',
    benefits: '+30 PV, +25 PS, +5 PR; 25 pontos para distribuir em Perícias Principais; +1 ponto para distribuir em Atributos Extras; dano base 1d6; fluxo de atributo Raposa; formas de Respiração Carpa e Raposa; 2 pontos de foco.',
  },
  {
    id: 'mizunoe',
    name: 'Mizunoe',
    group: 'Raposa',
    focus: '4',
    benefits: '+35 PV, +30 PS, +10 PR; 25 pontos para distribuir em Perícias Principais; +2 pontos adicionais para distribuir em Atributos Extras; dano base 1d6; fluxo de atributo Raposa; formas de Respiração Carpa e Raposa; 4 pontos de foco.',
  },
  {
    id: 'kanoto',
    name: 'Kanoto',
    group: 'Raposa',
    focus: '6',
    benefits: '+36 PV, +31 PS, +15 PR; 26 pontos para distribuir em Perícias Principais; +2 pontos adicionais para distribuir em Atributos Extras; dano base 1d6; fluxo de atributo Raposa; formas de Respiração Carpa e Raposa; 6 pontos de foco.',
  },
  {
    id: 'kanoe',
    name: 'Kanoe',
    group: 'Tigre',
    focus: '10',
    benefits: '+37 PV, +32 PS, +15 PR; 26 pontos para distribuir em Perícias Principais; +3 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Iniciante (DT 20); dano base 1d8; fluxo de atributo Tigre; formas de Respiração Carpa, Raposa e Tigre; 10 pontos de foco.',
  },
  {
    id: 'tsuchinoto',
    name: 'Tsuchinoto',
    group: 'Tigre',
    focus: '14',
    benefits: '+38 PV, +33 PS, +15 PR; 27 pontos para distribuir em Perícias Principais; +3 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Iniciante (DT 20); dano base 1d8; fluxo de atributo Tigre; formas de Respiração Carpa, Raposa e Tigre; 14 pontos de foco.',
  },
  {
    id: 'tsuchinoe',
    name: 'Tsuchinoe',
    group: 'Tigre',
    focus: '18',
    benefits: '+39 PV, +34 PS, +15 PR; 27 pontos para distribuir em Perícias Principais; +4 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Iniciante (DT 20); dano base 1d8; fluxo de atributo Tigre; formas de Respiração Carpa, Raposa e Tigre; 18 pontos de foco.',
  },
  {
    id: 'hinoto',
    name: 'Hinoto',
    group: 'Dragão',
    focus: '24',
    benefits: '+40 PV, +35 PS, +20 PR; 28 pontos para distribuir em Perícias Principais; +4 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Aprimorada (DT 19); dano base 1d10; fluxo de atributo Dragão; formas de Respiração Carpa, Raposa, Tigre e Dragão; 24 pontos de foco.',
  },
  {
    id: 'hinoe',
    name: 'Hinoe',
    group: 'Dragão',
    focus: '28',
    benefits: '+41 PV, +36 PS, +25 PR; 28 pontos para distribuir em Perícias Principais; +5 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Aprimorada (DT 19); dano base 1d10; fluxo de atributo Dragão; formas de Respiração Carpa, Raposa, Tigre e Dragão; 28 pontos de foco.',
  },
  {
    id: 'kinoto',
    name: 'Kinoto',
    group: 'Dragão',
    focus: '32',
    benefits: '+42 PV, +37 PS, +30 PR; 29 pontos para distribuir em Perícias Principais; +5 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Aprimorada (DT 19); dano base 1d10; fluxo de atributo Dragão; formas de Respiração Carpa, Raposa, Tigre e Dragão; 32 pontos de foco.',
  },
  {
    id: 'kinoe',
    name: 'Kinoe (Tsuguko)',
    group: 'Corvo',
    focus: '44',
    benefits: '+44 PV, +39 PS, +35 PR; 29 pontos para distribuir em Perícias Principais; +6 pontos adicionais para distribuir em Atributos Extras; Técnica de Concentração Total Completa (DT 18); dano base 1d12; fluxo de atributo Corvo; formas de Respiração Carpa, Raposa, Tigre, Dragão e Corvo; 44 pontos de foco.',
  },
  {
    id: 'hashira-inferior',
    name: 'Hashira Inferior (Shinkai)',
    group: 'Corvo',
    focus: '92',
    benefits: '+56 PV, +51 PS, +80 PR; 35 pontos de perícias; +10 atributos extras; técnica perfeita DT17; não gasta PR nas formas Tigre e Raposa; dano 1d12.',
  },
  {
    id: 'hashira-superior',
    name: 'Hashira Superior (Saikou)',
    group: 'Corvo',
    focus: 'Ilimitado',
    benefits: 'Benefícios totais não definidos no material.',
  },
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
  kanoto: { pv: 36, ps: 31, pr: 15 },
  kanoe: { pv: 37, ps: 32, pr: 15 },
  tsuchinoto: { pv: 38, ps: 33, pr: 15 },
  tsuchinoe: { pv: 39, ps: 34, pr: 15 },
  hinoto: { pv: 40, ps: 35, pr: 20 },
  hinoe: { pv: 41, ps: 36, pr: 25 },
  kinoto: { pv: 42, ps: 37, pr: 30 },
  kinoe: { pv: 44, ps: 39, pr: 35 },
  'hashira-inferior': { pv: 56, ps: 51, pr: 80 },
}

export const KISATSUTAI_PROMOTIONS: Record<string, string> = {
  'zaidan>mizunoto': '+15 PV, +15 PS, +5 PR, +5 pontos de perícias principais; +1 ponto de foco; dano base 1d4 → 1d6; desbloqueia fluxo de atributo Raposa.',

  'mizunoto>mizunoe': '+5 PV, +5 PS, +5 PR; +1 ponto para distribuir em Atributos Extras; +2 pontos de foco.',

  'mizunoe>kanoto': '+1 PV, +1 PS, +5 PR; +1 ponto para distribuir em Perícias Principais; +2 pontos de foco.',

  'kanoto>kanoe': '+1 PS, +1 PR; +1 ponto para distribuir em Atributos Extras; Técnica de Concentração Total não completa (DT 20); dano base 1d6 → 1d8; ganha fluxo de atributo Tigre; +4 pontos de foco; desbloqueia formas de Respiração de classificação Tigre.',

  'kanoe>tsuchinoto': '+1 PV, +1 PS; +1 ponto para distribuir em Perícias Principais; +4 pontos de foco.',

  'tsuchinoto>tsuchinoe': '+1 PV, +1 PS; +1 ponto para distribuir em Atributos Extras; +4 pontos de foco.',

  'tsuchinoe>hinoto': '+1 PV, +1 PS, +5 PR; +1 ponto para distribuir em Perícias Principais; Técnica de Concentração Total Aprimorada (DT 19); dano base 1d8 → 1d10; ganha fluxo de atributo Dragão; +6 pontos de foco; desbloqueia formas de Respiração de classificação Dragão.',

  'hinoto>hinoe': '+1 PV, +1 PS, +5 PR; +1 ponto para distribuir em Atributos Extras; +6 pontos de foco.',

  'hinoe>kinoto': '+1 PV, +1 PS, +5 PR; +1 ponto para distribuir em Perícias Principais; +6 pontos de foco.',

  'kinoto>kinoe': '+2 PV, +2 PS, +5 PR; +1 ponto para distribuir em Atributos Extras; Técnica de Concentração Total Completa (DT 18); dano base 1d10 → 1d12; ganha fluxo de atributo Corvo; +12 pontos de foco; desbloqueia formas de Respiração de classificação Corvo.',

  'kinoe>hashira-inferior': '+12 PV, +12 PS, +45 PR, +6 pontos de perícias principais, +4 pontos de atributos extras; Técnica de Concentração Total Perfeita (DT 17); formas Tigre e Raposa sem custo de PR; +48 pontos de foco.',
}
