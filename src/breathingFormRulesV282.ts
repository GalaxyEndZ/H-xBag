/** Kisatsutai V282: formas comuns. O catálogo não inventa custos, dano ou efeitos para Carpa/Corvo. */
import type { BreathingTier, BreathingKind } from './damageRollRulesV274'

export type FormAttribute = 'strength' | 'agility' | 'intellect' | 'breathing'
export type FormDelivery = 'direct' | 'ranged'
export type FormProfile = {
  tier: BreathingTier
  kind: BreathingKind
  baseDamage: string
  rangedDamage?: string
  costPR: number | null
  counterAttackBonus: number
  description: string
  mechanic: string
  maximum: number | null
  /** Máximo matemático da forma com FOR (sem dano base, arma, kits ou crítico). */
  maximumWithStrength?:number
  maximumRanged?:number
}
export const FORM_ATTRIBUTE_LABEL: Record<FormAttribute, string> = {
  strength: 'FOR', agility: 'AGI', intellect: 'INT', breathing: 'RES',
}
export const FORM_KIND_LABEL: Record<BreathingKind, string> = {
  defensiva: 'Defensiva', ofensiva: 'Ofensiva', destrutiva: 'Destrutiva',
}
export const FORM_PROFILES: Record<BreathingTier, Record<BreathingKind, FormProfile>> = {
  raposa: {
    defensiva: {tier:'raposa',kind:'defensiva',baseDamage:'1d8',costPR:6,counterAttackBonus:3,maximum:8,description:'+3 na DT de Contra-Ataque. Em Ação, utiliza obrigatoriamente AGI.',mechanic:'Dano baixo e bônus de reação.'},
    ofensiva: {tier:'raposa',kind:'ofensiva',baseDamage:'2d6',costPR:8,counterAttackBonus:0,maximum:12,maximumWithStrength:13,description:'FOR adiciona +1 ao dano; AGI adiciona +2 ao resultado do ataque.',mechanic:'Dano moderado e bônus ofensivo.'},
    destrutiva: {tier:'raposa',kind:'destrutiva',baseDamage:'2d6+4',costPR:12,counterAttackBonus:0,maximum:16,description:'Em Ação, utiliza obrigatoriamente FOR. Sem bônus extra de classe.',mechanic:'Dano elevado; não possui bônus de classe.'},
  },
  tigre: {
    defensiva: {tier:'tigre',kind:'defensiva',baseDamage:'2d8',costPR:20,counterAttackBonus:6,maximum:16,description:'+6 na DT de Contra-Ataque e AGI obrigatória em Ação. Pode defender ataques à distância e vários ataques com a mesma forma.',mechanic:'Defender múltiplos ataques ou defletir ataques à distância (Reação).'},
    ofensiva: {tier:'tigre',kind:'ofensiva',baseDamage:'2d6+2d4+2',costPR:22,counterAttackBonus:0,maximum:22,maximumWithStrength:25,description:'FOR adiciona +3 ao dano; AGI adiciona +4 ao ataque. Passiva: ataque múltiplo (Ação) ou negar dano com DEF (Reação), concedendo metade do dano em armadura temporária.',mechanic:'Múltiplos ataques (Ação) ou negar dano (Reação).'},
    destrutiva: {tier:'tigre',kind:'destrutiva',baseDamage:'3d6+1d4+6',rangedDamage:'2d6+1d4+4',costPR:26,counterAttackBonus:0,maximum:28,maximumRanged:20,description:'FOR realiza ataque direto. AGI realiza ataque à distância ou em área com dano reduzido, sacrificando o dado de Dano Base.',mechanic:'Ataques à distância ou em área (Ação).'},
  },
  dragao: {
    defensiva: {tier:'dragao',kind:'defensiva',baseDamage:'2d12+1d4',costPR:50,counterAttackBonus:12,maximum:28,description:'+12 na DT de Contra-Ataque e RES obrigatória em Ação. Pode bloquear à distância, devolver dano ou usar a mesma forma em todas as Reações do turno.',mechanic:'Defender múltiplos ataques ou defletir ataques à distância (Reação).'},
    ofensiva: {tier:'dragao',kind:'ofensiva',baseDamage:'4d6+2d4+4',costPR:55,counterAttackBonus:0,maximum:36,maximumWithStrength:43,description:'FOR adiciona +7 ao dano; AGI adiciona +8 ao ataque. Passiva: negar dano com DEF e obter armadura temporária equivalente ao dano ou atingir vários inimigos usando Ações e Reações.',mechanic:'Múltiplos ataques (Ação) ou negar dano (Reação).'},
    destrutiva: {tier:'dragao',kind:'destrutiva',baseDamage:'3d6+3d4+10',rangedDamage:'2d6+3d4+8',costPR:65,counterAttackBonus:0,maximum:40,maximumRanged:32,description:'FOR realiza ataque direto. AGI realiza ataque à distância ou em área, com grande alcance, dano reduzido e sem dado de Dano Base.',mechanic:'Ataques à distância ou em área amplificados (Ação).'},
  },
  corvo: {
    defensiva: {tier:'corvo',kind:'defensiva',baseDamage:'4d12+2d4+8',costPR:null,counterAttackBonus:0,maximum:null,description:'Regras desta forma Corvo ainda não fornecidas; confirme o custo de PR e o efeito com o mestre.',mechanic:'Sem custo e bônus de classe oficiais nesta atualização.'},
    ofensiva: {tier:'corvo',kind:'ofensiva',baseDamage:'7d6+6d4+10',costPR:null,counterAttackBonus:0,maximum:null,description:'Regras desta forma Corvo ainda não fornecidas; confirme o custo de PR e o efeito com o mestre.',mechanic:'Sem custo e bônus de classe oficiais nesta atualização.'},
    destrutiva: {tier:'corvo',kind:'destrutiva',baseDamage:'7d6+7d4+26',costPR:null,counterAttackBonus:0,maximum:null,description:'Regras desta forma Corvo ainda não fornecidas; confirme o custo de PR e o efeito com o mestre.',mechanic:'Sem custo e bônus de classe oficiais nesta atualização.'},
  },
}

export const CARPA_KINDS = {
  controle:'Dano mental ou debuff — execução e custo definidos pelo mestre',
  suporte:'Aumento de dano, armadura ou buff — execução e custo definidos pelo mestre',
  cura:'Concede PV temporário — execução e custo definidos pelo mestre',
} as const

export function formDefaultAttribute(tier: BreathingTier, kind: BreathingKind, delivery: FormDelivery): FormAttribute {
  if (kind === 'defensiva') return tier === 'dragao' ? 'breathing' : 'agility'
  if (kind === 'ofensiva') return 'strength'
  return delivery === 'ranged' && tier !== 'raposa' ? 'agility' : 'strength'
}
export function formAllowedAttributes(tier: BreathingTier, kind: BreathingKind, delivery: FormDelivery): FormAttribute[] {
  if (tier === 'corvo') return ['strength','agility','breathing','intellect']
  if (kind === 'defensiva') return [tier === 'dragao' ? 'breathing' : 'agility']
  if (kind === 'ofensiva') return ['strength','agility']
  if (tier === 'raposa') return ['strength']
  return [delivery === 'ranged' ? 'agility' : 'strength']
}
export function formDamageFormula(tier: BreathingTier, kind: BreathingKind, delivery: FormDelivery): string {
  const profile = FORM_PROFILES[tier][kind]
  return delivery === 'ranged' && profile.rangedDamage ? profile.rangedDamage : profile.baseDamage
}
export function formDamageBonus(tier: BreathingTier, kind: BreathingKind, attribute: FormAttribute): number {
  return kind === 'ofensiva' && attribute === 'strength' ? ({raposa:1,tigre:3,dragao:7,corvo:0} as const)[tier] : 0
}
export function formAttackBonus(tier: BreathingTier, kind: BreathingKind, attribute: FormAttribute): number {
  return kind === 'ofensiva' && attribute === 'agility' ? ({raposa:2,tigre:4,dragao:8,corvo:0} as const)[tier] : 0
}
