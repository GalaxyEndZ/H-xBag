// Regras e cálculos específicos do sistema Kisatsutai.

import {
  KISATSUTAI_FAMILY_TIERS,
  KISATSUTAI_PROMOTIONS,
  KISATSUTAI_RANK_STATUS,
  KISATSUTAI_RANKS,
} from './data'

// Pontos extras de atributos concedidos por graduação.
export const KISATSUTAI_RANK_ATTRIBUTE_POINTS: Record<string, number> = {
  zaidan: 1,
  mizunoto: 1,
  mizunoe: 2,
  hinoto: 4,
  hinoe: 5,
  kinoto: 5,
  kinoe: 6,
  'hashira-inferior': 10,
}

// Retorna os pontos extras de atributos da graduação.
// Graduações sem quantidade definida no material concedem zero.
export function getKisatsutaiRankAttributePoints(rankId: string): number {
  return KISATSUTAI_RANK_ATTRIBUTE_POINTS[rankId] ?? 0
}

// Monta o identificador de uma promoção.
export function getKisatsutaiPromotionId(from: string, to: string): string {
  return `${from}>${to}`
}

// Verifica se uma promoção já existe no histórico.
export function hasKisatsutaiPromotion(
  promotionLog: { transition?: string }[],
  transition: string
): boolean {
  return promotionLog.some(entry => entry.transition === transition)
}

// Retorna a referência de benefícios documentada para uma promoção.
export function getKisatsutaiPromotionReference(transition: string): string {
  return (
    KISATSUTAI_PROMOTIONS[transition] ||
    'Benefícios incrementais não definidos no material.'
  )
}

// Retorna os bônus de PV, PS e PR concedidos pela graduação.
export function getKisatsutaiRankStatus(rankId: string): {
  pv: number
  ps: number
  pr: number
} {
  return KISATSUTAI_RANK_STATUS[rankId] ?? {
    pv: 0,
    ps: 0,
    pr: 0,
  }
}

// Monta o registro de uma promoção para o histórico da ficha.
export function createKisatsutaiPromotionEntry(
  from: string,
  to: string,
  id: string,
  at: string,
  description: string
) {
  const oldRank = KISATSUTAI_RANKS.find(rank => rank.id === from)
  const nextRank = KISATSUTAI_RANKS.find(rank => rank.id === to)
  const transition = getKisatsutaiPromotionId(from, to)

  return {
    id,
    transition,
    from: oldRank?.name || from,
    to: nextRank?.name || to,
    at,
    description,
    benefitReference: getKisatsutaiPromotionReference(transition),
    applied: false,
  }
}

// Retorna o nome de uma graduação pelo identificador.
export function getKisatsutaiRankName(rankId: string): string {
  return KISATSUTAI_RANKS.find(rank => rank.id === rankId)?.name || 'Zaidan'
}

// Retorna os dados completos de uma graduação pelo identificador.
export function getKisatsutaiRank(rankId: string) {
  return KISATSUTAI_RANKS.find(rank => rank.id === rankId) || KISATSUTAI_RANKS[0]
}

// Retorna os dados de uma graduação, sem aplicar uma graduação alternativa.
export function findKisatsutaiRank(rankId: string) {
  return KISATSUTAI_RANKS.find(rank => rank.id === rankId)
}

// Retorna os dados de um tier familiar, usando o tier 5 como padrão.
export function getKisatsutaiFamilyTier(tierKey: string) {
  return KISATSUTAI_FAMILY_TIERS[
    tierKey as keyof typeof KISATSUTAI_FAMILY_TIERS
  ] || KISATSUTAI_FAMILY_TIERS['5']
}

// Retorna todos os tiers familiares disponíveis para seleção.
export function getKisatsutaiFamilyTiers(): [
  string,
  (typeof KISATSUTAI_FAMILY_TIERS)[keyof typeof KISATSUTAI_FAMILY_TIERS]
][] {
  return Object.entries(KISATSUTAI_FAMILY_TIERS) as [
    string,
    (typeof KISATSUTAI_FAMILY_TIERS)[keyof typeof KISATSUTAI_FAMILY_TIERS]
  ][]
}

// Cria a configuração inicial de moedas do sistema Kisatsutai.
export function createKisatsutaiDefaultCurrencyConfig() {
  return {
    currencies: [
      {
        id: crypto.randomUUID(),
        name: 'Iene',
        symbol: '¥',
        conversionRate: 1,
      },
    ],
  }
}

// Verifica se o nome informado corresponde ao sistema Kisatsutai.
export function isKisatsutaiSystem(systemName?: string | null): boolean {
  return String(systemName ?? '').toLowerCase().includes('kisatsutai')
}