// Estruturas comuns utilizadas por todos os sistemas de RPG.

export interface FamilyTier {
  label: string
  pv: number
  ps: number
  pr: number
  strength: number
  agility: number
  defense: number
  breathing: number
  intellect: number
  points: number
  focus: number | string
}

export type CombatActionKind =
  | 'Ataque bruto'
  | 'Ataque ágil'
  | 'Bloqueio'
  | 'Esquiva'

export type CombatActionId = CombatActionKind | 'Contra-ataque'

export interface CombatActionConfig {
  attribute: string
  bonus: string
  attributeLabel: string
  bonusLabel: string
}

export interface CombatRollInput {
  kind: CombatActionKind
  attribute: number
  bonus: number
  target?: number | null
  criticalThreshold?: number
  rollDie: () => number
}

export interface CombatRollResult {
  dice: number[]
  diceTotal: number
  total: number
  diceCount: number
  critical: boolean
  succeeded: boolean | null
  damageReduction: number | null
  outcome: string
}

export type SkillPointKey =
  | 'vigor'
  | 'mental'
  | 'combat'
  | 'dexterity'
  | 'resistance'
  | 'ability'

export interface SkillPointSource {
  id: string
  label: string
  color: string
  pool: 'rankBenefits' | 'intellectChoices' | 'progressionFields' | 'fixed'
  rankBenefitsPattern?: string
  progressionPaths?: readonly string[]
  fixedPoints?: number
}

export interface SkillPointsConfig {
  maxPerSkill?: number
  allocationOrder?: readonly string[]
  description?: string
  allocationDescription?: string
  skillLabels?: Partial<Record<SkillPointKey, string>>
  sources?: readonly SkillPointSource[]
  extraPointsInput?: {
    path: string
    label: string
    description?: string
  }
  intellectChoice?: {
    enabled?: boolean
    attributePath: string
    choicePath?: string
    useEffectiveAttribute?: boolean
    pointsPerMainChoice?: number
    mainChoiceValue?: string
    extraChoiceValue?: string
    title?: string
    description?: string
    pointLabel?: string
    mainLabel?: string
    extraLabel?: string
    mainPointsLabel?: string
    extraLevelsLabel?: string
  }
}

export interface RPGSystem {
  id: string
  name: string

  // Identifica se uma campanha pertence a este sistema.
  matches(systemName?: string | null): boolean

  // Dados específicos do sistema.
  data?: {
    archetypes?: readonly string[]

    ranks?: readonly {
      id: string
      name: string
      group: string
      focus: string
      benefits: string
    }[]

    damageByGroup?: Readonly<Record<string, string>>

    skillPoints?: SkillPointsConfig

    // Configuração dos atributos e bônus de cada ação de combate.
    combatActions?: Partial<
      Record<CombatActionId, CombatActionConfig>
    >

    features?: {
      usesRanks?: boolean
      usesLevels?: boolean
      usesFamilyTiers?: boolean
      usesSkillPoints?: boolean
      hasDefaultCurrency?: boolean
    }
  }

  // Regras e cálculos específicos do sistema.
  logic?: {
    calculateCombatRoll?: (
      input: CombatRollInput
    ) => CombatRollResult

    getRankName?: (rankId: string) => string
    getRank?: (rankId: string) => any

    getRankStatus?: (rankId: string) => {
      pv: number
      ps: number
      pr: number
    }

    getRankAttributePoints?: (rankId: string) => number

    getFamilyTier?: (tierKey: string) => FamilyTier

    getFamilyTiers?: () => readonly (readonly [string, FamilyTier])[]

    getAttributeBonus?: (
      tierKey: string,
      attribute: 'strength' | 'agility' | 'defense' | 'breathing' | 'intellect'
    ) => number

    getPromotionId?: (from: string, to: string) => string

    hasPromotion?: (
      promotionLog: { transition?: string }[],
      transition: string
    ) => boolean

    createPromotionEntry?: (
      from: string,
      to: string,
      id: string,
      at: string,
      description: string
    ) => any

    findRank?: (rankId: string) => any

    createDefaultCurrencyConfig?: () => {
      currencies: {
        id: string
        name: string
        symbol: string
        conversionRate: number
      }[]
    }
  }
}