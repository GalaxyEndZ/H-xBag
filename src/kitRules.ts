import type { ProtectionMode, ProtectionTier } from './combatDefenses'

/**
 * Kit definitions supplied for the HäxBag inventory system (V83).
 * V219: bônus oficiais de cada espaço dos kits equipáveis.
 * Formatos antigos, com bônus único, continuam legíveis sem migração de dados.
 * Existing scarcity mechanics are reused rather than replacing them.
 */
export const KIT_TYPE_KEYS = [
  'equip_simple', 'equip_standard', 'equip_rare',
  'immediate', 'preparation', 'prolonged',
] as const
export type KitType = typeof KIT_TYPE_KEYS[number]
export type KitFamily = 'equippable' | 'consumable'
export type KitBenefitMode = 'rest' | 'skills' | 'skills_unique' | 'unique_pair' | 'three_archetype' | 'general_and_archetype' | 'unique_triple' | 'rare_skills_two_unique' | 'rare_mixed_two_unique' | 'protection' | 'main_and_archetype'
export type KitUniqueFeatureKey = 'extra_damage' | 'protection' | 'armor_class' | 'main_skill' | 'remove_condition' | 'constitution' | 'health_points' | 'resistance_points' | 'complex_actions' | 'initiative_dice'
export type KitUniqueFeature = {
  key: KitUniqueFeatureKey | ''
  amount: string
  details: string
  mainSkill?: string
  /** Mesmas opções de proteção dos equipamentos convencionais. */
  protectionTier?: ProtectionTier
  protectionMode?: ProtectionMode
}
export const KIT_UNIQUE_FEATURES: {key: KitUniqueFeatureKey; label: string; rareOnly?: boolean; needsAmount?: boolean}[] = [
  {key:'extra_damage',label:'Aumentar o dano extra',needsAmount:true},
  {key:'protection',label:'Conceder proteção (mesmas regras dos equipamentos)'},
  {key:'armor_class',label:'Aumentar o valor de CA',needsAmount:true},
  {key:'main_skill',label:'Aumentar uma perícia principal',needsAmount:true},
  {key:'remove_condition',label:'Capacidade de retirar condições'},
  {key:'constitution',label:'Aumentar Constituição',rareOnly:true,needsAmount:true},
  {key:'health_points',label:'Aumentar PV máximo',rareOnly:true,needsAmount:true},
  {key:'resistance_points',label:'Aumentar PR máximo',rareOnly:true,needsAmount:true},
  {key:'complex_actions',label:'Aumentar ações complexas disponíveis',rareOnly:true,needsAmount:true},
  {key:'initiative_dice',label:'Aumentar dados de iniciativa',rareOnly:true,needsAmount:true},
]
export function kitUniqueSlots(type:KitType|null|undefined, mode:KitBenefitMode):number {
  if(type==='equip_standard')return mode==='skills_unique'?1:mode==='unique_pair'?2:0
  if(type==='equip_rare')return mode==='unique_triple'?3:mode==='rare_skills_two_unique'||mode==='rare_mixed_two_unique'?2:0
  return 0
}
export function kitRestType(type:KitType|null|undefined, mode:KitBenefitMode):KitDefinition['restType']|null {
  return mode==='rest' ? kitDefinition(type)?.restType ?? null : null
}
export function itemKitRestType(metadata:Record<string, unknown>|null|undefined):KitDefinition['restType']|null {
  const type=isKitType(metadata?.kitType)?metadata.kitType:null
  if(!type)return null
  if(metadata?.kitBenefitMode==='rest')return kitDefinition(type)?.restType ?? null
  // Kits anteriores à escolha exclusiva tinham descanso associado ao próprio subtipo.
  if(metadata?.kitRulesVersion !== 2 && ['precario','mediano','completo'].includes(String(metadata?.kitRestType)))
    return metadata?.kitRestType as KitDefinition['restType']
  return null
}
export function parseKitUniqueFeatures(value:unknown):KitUniqueFeature[] {
  if(!Array.isArray(value))return []
  return value.slice(0,3).filter((entry):entry is Record<string,unknown>=>Boolean(entry)&&typeof entry==='object'&&!Array.isArray(entry))
    .map(entry=>({
      key:KIT_UNIQUE_FEATURES.some(f=>f.key===entry.key)?entry.key as KitUniqueFeatureKey:'',
      amount:typeof entry.amount==='string'?entry.amount:String(entry.amount??''),
      details:typeof entry.details==='string'?entry.details:'',
      mainSkill:typeof entry.mainSkill==='string'?entry.mainSkill:'',
      // Benefícios anteriores não tinham classificação: básica / resistência é a escolha de compatibilidade.
      protectionTier: entry.key==='protection' ? (entry.protectionTier==='moderada'||entry.protectionTier==='avancada'?entry.protectionTier:'basica') : undefined,
      protectionMode: entry.key==='protection' ? (entry.protectionMode==='sanidade'?'sanidade':'resistencia') : undefined,
    }))
}
export function validateKitUniqueFeatures(type:KitType|null|undefined,mode:KitBenefitMode,features:readonly KitUniqueFeature[]):string|null {
  const count=kitUniqueSlots(type,mode)
  if(!count)return null
  const picked=features.slice(0,count)
  if(picked.length!==count||picked.some(feature=>!feature.key))return `Configure as ${count} funcionalidades únicas do kit.`
  if(new Set(picked.map(feature=>feature.key)).size!==count)return 'Escolha funcionalidades únicas diferentes para cada espaço.'
  if(picked.some(feature=>!KIT_UNIQUE_FEATURES.some(f=>f.key===feature.key&&(type==='equip_rare'||!f.rareOnly))))return 'Esta funcionalidade não está disponível neste nível de kit.'
  if(picked.some(feature=>feature.key==='main_skill'&&!KIT_MAIN_SKILLS.includes(feature.mainSkill as typeof KIT_MAIN_SKILLS[number])))return 'Selecione a perícia principal beneficiada.'
  if(picked.some(feature=>{
    const rule=KIT_UNIQUE_FEATURES.find(f=>f.key===feature.key)
    if(!rule?.needsAmount)return false
    const number=Number(feature.amount.replace(',','.'))
    return !feature.amount.trim()||!Number.isFinite(number)||number<=0||number>100000
  }))return 'Informe um valor numérico positivo para cada bônus que precisa de quantidade.'
  return null
}



/**
 * Proteções de kits equipáveis seguem exatamente as proteções de equipamentos:
 * básica (¼), moderada (½) e avançada (integral); física usa RESISTÊNCIA,
 * sanidade usa MENTAL. O consumo/remoção fica sob as mesmas regras do equipamento.
 * Recebe metadados de um kit já equipado (a verificação de equipped é do chamador).
 */
export function kitEquipmentProtections(metadata: {
  kitType?: unknown
  kitBenefitMode?: unknown
  kitRulesVersion?: unknown
  kitUniqueFeatures?: unknown
} | null | undefined): Array<{protectionTier: ProtectionTier; protectionMode: ProtectionMode}> {
  if (!metadata || (metadata.kitType!=='equip_standard' && metadata.kitType!=='equip_rare')) return []
  // Preserva kits antigos de proteção moderada mesmo antes da escolha de funcionalidades.
  if (metadata.kitType==='equip_standard' && metadata.kitBenefitMode==='protection') {
    return [{protectionTier:'moderada',protectionMode:'resistencia'}]
  }
  if (metadata.kitRulesVersion!==2 || !(
    ['skills_unique','unique_pair','rare_skills_two_unique','rare_mixed_two_unique','unique_triple'] as string[]
  ).includes(String(metadata.kitBenefitMode))) return []
  return parseKitUniqueFeatures(metadata.kitUniqueFeatures)
    .filter(feature=>feature.key==='protection')
    .map(feature=>({
      protectionTier:feature.protectionTier??'basica',
      protectionMode:feature.protectionMode??'resistencia',
    }))
}

/** Efeitos de kits equipados com valor numérico. Sem automatizar ações manuais do mestre. */
export function equippedKitFeatureBonuses(items: readonly {metadata?:Record<string,unknown>|null}[], key:KitUniqueFeatureKey, mainSkill?:string):number {
  return items.reduce((sum,item)=>{
    const meta=item.metadata
    if(meta?.equipped!==true || !isKitType(meta.kitType) || !['equip_standard','equip_rare'].includes(meta.kitType)) return sum
    if(meta.kitRulesVersion!==2 || !(['skills_unique','unique_pair','rare_skills_two_unique','rare_mixed_two_unique','unique_triple'] as KitBenefitMode[]).includes(meta.kitBenefitMode as KitBenefitMode)) return sum
    return sum + parseKitUniqueFeatures(meta.kitUniqueFeatures).reduce((sub,feature)=>{
      if(feature.key!==key || (key==='main_skill' && String(feature.mainSkill||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR') !== String(mainSkill||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'))) return sub
      const n=Number(feature.amount.replace(',','.'))
      return sub+(Number.isFinite(n)&&n>0?n:0)
    },0)
  },0)
}

export type KitEffect = 'damage' | 'resistance' | 'combat_point'
export type ScarcityLevel = 1 | 2 | 3 | 4
export type KitDefinition = {
  type: KitType
  name: string
  family: KitFamily
  fixedWeight?: number
  exampleItem?: string
  restType?: 'precario' | 'mediano' | 'completo'
  weights?: Partial<Record<ScarcityLevel, number>>
  description: string
}

export const KIT_DEFINITIONS: Record<KitType, KitDefinition> = {
  equip_simple: {
    type: 'equip_simple', name: 'Equipável simples', family: 'equippable', fixedWeight: 1,
    exampleItem: 'Saco de dormir', restType: 'precario',
    description: 'Escolha UMA opção: Saco de dormir (Descanso Precário) OU +10 em duas perícias extras.',
  },
  equip_standard: {
    type: 'equip_standard', name: 'Equipável padrão', family: 'equippable', fixedWeight: 2,
    exampleItem: 'Futon', restType: 'mediano',
    description: 'Escolha UMA opção: Futon (Descanso Mediano), duas perícias de arquétipo (+15/+10) e uma funcionalidade única, OU duas funcionalidades únicas.',
  },
  equip_rare: {
    type: 'equip_rare', name: 'Equipável raro', family: 'equippable', fixedWeight: 4.5,
    exampleItem: 'Barraca de acampamento', restType: 'completo',
    description: 'Escolha UMA opção: Barraca de acampamento (Descanso Completo), três perícias (+15/+15/+10) e duas funcionalidades únicas, OU três funcionalidades únicas.',
  },
  immediate: {
    type: 'immediate', name: 'Consumível de uso imediato', family: 'consumable',
    weights: {4: 1, 3: 2.5, 2: 5.75, 1: 12},
    description: 'Buff temporário de dano, resistência ou um ponto de combate por até 1d6 rodadas.',
  },
  preparation: {
    type: 'preparation', name: 'Consumível de pré-preparo', family: 'consumable',
    weights: {4: 2.75, 3: 5.5, 2: 12},
    description: 'Buff de dano, resistência ou ponto de combate por uma cena.',
  },
  prolonged: {
    type: 'prolonged', name: 'Consumível de uso prolongado', family: 'consumable',
    weights: {4: 5.5, 3: 12},
    description: 'Duração e tipo de benefício ainda não especificados.',
  },
}

export const SCARCITY_DICE: Record<ScarcityLevel, number> = {1: 12, 2: 8, 3: 6, 4: 4}
export const SCARCITY_CHARGES: Record<ScarcityLevel, number> = {1: 7, 2: 5, 3: 3, 4: 1}
export const KIT_MAIN_SKILLS = ['VIGOR', 'MENTAL', 'COMBATE', 'DESTREZA', 'RESISTÊNCIA', 'HABILIDADE'] as const

export function isKitType(value: unknown): value is KitType {
  return typeof value === 'string' && (KIT_TYPE_KEYS as readonly string[]).includes(value)
}
export function kitDefinition(type: KitType | null | undefined): KitDefinition | null {
  return type ? KIT_DEFINITIONS[type] : null
}
export function kitAvailableScarcityLevels(type: KitType | null | undefined): ScarcityLevel[] {
  const def = kitDefinition(type)
  return def?.weights ? ([1, 2, 3, 4] as ScarcityLevel[]).filter(level => def.weights?.[level] !== undefined) : []
}
export function kitWeight(type: KitType | null | undefined, level: number, exhausted = false): number | null {
  const def = kitDefinition(type)
  if (!def) return null
  if (def.family === 'equippable') return def.fixedWeight ?? null
  if (exhausted) return 0 // Existing inventory semantics for exhausted consumables.
  if (!Number.isInteger(level) || level < 1 || level > 4) return null
  return def.weights?.[level as ScarcityLevel] ?? null
}
export function normalizeKitLevel(type: KitType, level: number): ScarcityLevel | null {
  const available = kitAvailableScarcityLevels(type)
  if (!available.length) return null
  return available.includes(level as ScarcityLevel) ? level as ScarcityLevel : available[0]
}
/** Os bônus variam exclusivamente com a alternativa escolhida. */
export function kitFixedSkillBonuses(type:KitType|null|undefined,mode:KitBenefitMode):number[] {
  if(type==='equip_simple' && mode==='skills')return [10,10]
  if(type==='equip_standard' && (mode==='skills_unique'||mode==='skills'))return [15,10]
  if(type==='equip_rare' && (mode==='three_archetype'||mode==='general_and_archetype'||mode==='main_and_archetype'||mode==='rare_skills_two_unique'||mode==='rare_mixed_two_unique'))return [15,15,10]
  return []
}
/** Retorna os bônus salvos por posição, sem alterar o funcionamento de itens antigos. */
export function itemKitSkillBonuses(metadata:Record<string,unknown>):number[] {
  const skills=Array.isArray(metadata.kitSkills)?metadata.kitSkills:[]
  const values=metadata.kitSkillBonuses
  if(Array.isArray(values)&&values.length>=skills.length&&values.every(value=>Number.isFinite(Number(value))&&Number(value)>=0))
    return values.slice(0,skills.length).map(Number)
  const legacy=Number(metadata.kitSkillBonus)
  return skills.map(()=>Number.isSafeInteger(legacy)&&legacy>0?legacy:0)
}
export function kitSlots(type:KitType,mode:KitBenefitMode):{group:'extra'|'archetype'|'main';label:string}[] {
  if(type==='equip_simple'&&mode==='skills')return [{group:'extra',label:'Perícia extra 1'},{group:'extra',label:'Perícia extra 2'}]
  if(type==='equip_standard'&&(mode==='skills_unique'||mode==='skills'))return [{group:'archetype',label:'Perícia de arquétipo 1'},{group:'archetype',label:'Perícia de arquétipo 2'}]
  if(type==='equip_rare'&&mode==='main_and_archetype')return [{group:'main',label:'Perícia principal'},{group:'archetype',label:'Perícia de arquétipo 1'},{group:'archetype',label:'Perícia de arquétipo 2'}]
  if(type==='equip_rare'&&(['three_archetype','general_and_archetype','rare_skills_two_unique','rare_mixed_two_unique'] as KitBenefitMode[]).includes(mode))return [
    {group:'archetype',label:'Perícia de arquétipo 1'},
    {group:'archetype',label:'Perícia de arquétipo 2'},
    (mode==='general_and_archetype'||mode==='rare_mixed_two_unique')?{group:'extra',label:'Perícia extra'}:{group:'archetype',label:'Perícia de arquétipo 3'},
  ]
  return []
}
export function kitEffectLabel(effect: KitEffect | null): string {
  return effect === 'damage' ? 'Dano' : effect === 'resistance' ? 'Resistência' : effect === 'combat_point' ? 'Ponto de combate' : 'Não definido'
}

/** Tipo único entre o editor, as lojas, o baú e os metadados salvos. */
export const KIT_BENEFIT_MODES: readonly KitBenefitMode[] = [
  'rest','skills','skills_unique','unique_pair','three_archetype',
  'general_and_archetype','rare_skills_two_unique','rare_mixed_two_unique','unique_triple','protection','main_and_archetype',
]
