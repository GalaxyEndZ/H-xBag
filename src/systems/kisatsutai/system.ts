
import type { RPGSystem } from '../core/types'
import {
  calculateKisatsutaiCombatRoll,
  isKisatsutaiSystem,
  getKisatsutaiRankName,
  getKisatsutaiRank,
  getKisatsutaiRankStatus,
  getKisatsutaiRankAttributePoints,
  getKisatsutaiFamilyTier,
  getKisatsutaiFamilyTiers,
  getKisatsutaiAttributeBonus,
  getKisatsutaiPromotionId,
  hasKisatsutaiPromotion,
  createKisatsutaiPromotionEntry,
  findKisatsutaiRank,
  createKisatsutaiDefaultCurrencyConfig,
} from './logic'
import {
  KISATSUTAI_ARCHETYPES,
  KISATSUTAI_RANKS,
} from './data'

export const KISATSUTAI_SYSTEM: RPGSystem = {
  id: 'kisatsutai',
  name: 'Kisatsutai',

  matches(systemName) {
    return isKisatsutaiSystem(systemName)
  },

  data: {
    archetypes: KISATSUTAI_ARCHETYPES,
    ranks: KISATSUTAI_RANKS,

    damageByGroup: {
      Carpa: '1d4',
      Raposa: '1d6',
      Tigre: '1d8',
      Dragão: '1d10',
      Corvo: '1d12',
    },

    combatActions: {
      'Ataque bruto': {
        attribute: 'attributes.strength',
        bonus: 'skills.combat',
        attributeLabel: 'Força',
        bonusLabel: 'Combate',
      },
      'Ataque ágil': {
        attribute: 'attributes.agility',
        bonus: 'skills.combat',
        attributeLabel: 'Agilidade',
        bonusLabel: 'Combate',
      },
      'Bloqueio': {
        attribute: 'attributes.defense',
        bonus: 'attributes.constitution',
        attributeLabel: 'Defesa',
        bonusLabel: 'Constituição',
      },
      'Esquiva': {
        attribute: 'attributes.agility',
        bonus: 'skills.dexterity',
        attributeLabel: 'Agilidade',
        bonusLabel: 'Destreza',
      },
      'Contra-ataque': {
        attribute: 'skills.combat',
        bonus: 'skills.dexterity',
        attributeLabel: 'Combate',
        bonusLabel: 'Destreza',
      },
    },

    skillPoints: {
      maxPerSkill: 12,
      allocationOrder: ['hierarchy', 'intellect', 'extra'],
      description: 'Distribua os pontos disponíveis entre as perícias do personagem.',
      allocationDescription: 'Cada ponto aumenta um nível da perícia.',
      skillLabels: {
        vigor: 'Vigor',
        mental: 'Mental',
        combat: 'Combate',
        dexterity: 'Destreza',
        resistance: 'Resistência',
        ability: 'Habilidade',
      },
      sources: [
        {
          id: 'hierarchy',
          label: 'Hierarquia',
          color: '#8bc8a7',
          pool: 'rankBenefits',
          rankBenefitsPattern: '(\\d+) pontos? de perícias?',
        },
        {
          id: 'intellect',
          label: 'Intelecto',
          color: '#8fb8d8',
          pool: 'intellectChoices',
        },
        {
          id: 'extra',
          label: 'Extra',
          color: '#c2a0ed',
          pool: 'progressionFields',
          progressionPaths: [
            'progression.classSkillPoints',
            'progression.manualExtraSkillPoints',
          ],
        },
      ],
      extraPointsInput: {
        path: 'progression.manualExtraSkillPoints',
        label: 'Pontos extras',
        description: 'Adicione pontos de perícia concedidos por recompensas, eventos ou decisões do mestre.',
      },
      intellectChoice: {
        enabled: true,
        attributePath: 'attributes.intellect',
        choicePath: 'skills.intelligenceChoices',
        useEffectiveAttribute: true,
        pointsPerMainChoice: 5,
        mainChoiceValue: 'main',
        extraChoiceValue: 'extra',
        title: 'Desenvolvimento por Intelecto',
        description: 'Para cada ponto do atributo Intelecto, escolha entre as duas formas de desenvolvimento disponíveis.',
        pointLabel: 'Ponto',
        mainLabel: '5 pontos para o distribuidor',
        extraLabel: '+1 nível em perícia extra',
        mainPointsLabel: 'Pontos para perícias principais',
        extraLevelsLabel: 'Níveis de treinamento extra',
      },
    },

    features: {
      usesRanks: true,
      usesLevels: false,
      usesFamilyTiers: true,
      usesSkillPoints: true,
      hasDefaultCurrency: true,
    },
  },

  logic: {
    calculateCombatRoll: calculateKisatsutaiCombatRoll,
    getRankName: getKisatsutaiRankName,
    getRank: getKisatsutaiRank,
    getRankStatus: getKisatsutaiRankStatus,
    getRankAttributePoints: getKisatsutaiRankAttributePoints,
    getFamilyTier: getKisatsutaiFamilyTier,
    getFamilyTiers: getKisatsutaiFamilyTiers,
    getAttributeBonus: getKisatsutaiAttributeBonus,
    getPromotionId: getKisatsutaiPromotionId,
    hasPromotion: hasKisatsutaiPromotion,
    createPromotionEntry: createKisatsutaiPromotionEntry,
    findRank: findKisatsutaiRank,
    createDefaultCurrencyConfig: createKisatsutaiDefaultCurrencyConfig,
  },
}
