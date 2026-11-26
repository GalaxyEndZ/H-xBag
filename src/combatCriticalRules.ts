import { flowIsActive, type FlowAttribute, type FlowSelections, type FlowTier } from './systems/kisatsutai/flowRules'

/** A margem base permanece em combat.critical; reduções dos Fluxos são derivadas. */
export type CriticalFormClass = 'none' | 'raposa' | 'tigre' | 'dragao'
export type CriticalAttribute = 'strength' | 'agility' | 'intellect' | 'breathing'
export const CRITICAL_ATTRIBUTE_LABEL: Record<CriticalAttribute,string> = {strength:'FOR',agility:'AGI',intellect:'INT',breathing:'RES'}
export const CRITICAL_FORM_LABELS: Record<CriticalFormClass, string> = {
  none: 'Sem forma de Respiração', raposa:'Forma Raposa', tigre:'Forma Tigre', dragao:'Forma Dragão',
}
// Compatibilidade com partes antigas da ficha; a nova regra depende também do atributo.
export const CRITICAL_BONUS_DICE: Record<CriticalFormClass,number> = {none:1,raposa:2,tigre:4,dragao:6}
export type CriticalProfile = {
  base:number;afterConditions:number;threshold:number;agilityBonuses:number;activeAgilityFlows:FlowTier[];
  corvoStrength:boolean;tigreStrength:boolean;dragaoStrength:boolean;corvoDefense:boolean
}
const bounded = (value:number) => Math.max(2,Math.min(20,Math.floor(value)))
export function calculateCriticalProfile(input:{base:unknown;conditioned?:unknown;selections?:FlowSelections;group?:string}):CriticalProfile {
  const rawBase = Number(input.base)
  const base=bounded(Number.isFinite(rawBase)&&rawBase>0?rawBase:20)
  const rawConditioned=Number(input.conditioned)
  const afterConditions=bounded(input.conditioned===undefined||!Number.isFinite(rawConditioned)?base:rawConditioned)
  const selections=input.selections??{}
  const group=input.group??''
  const active=(tier:FlowTier,attribute:FlowAttribute)=>flowIsActive(selections,group,tier,attribute)
  const activeAgilityFlows:FlowTier[]=(['tigre','dragao','corvo'] as const).filter(t=>active(t,'agility'))
  return {base,afterConditions,threshold:bounded(afterConditions-activeAgilityFlows.length),agilityBonuses:activeAgilityFlows.length,activeAgilityFlows,
    corvoStrength:active('corvo','strength'),tigreStrength:active('tigre','strength'),dragaoStrength:active('dragao','strength'),corvoDefense:active('corvo','defense')}
}
export function classifyCriticalD20(value:number,threshold:number):'critical'|'failure'|'normal' {
  if(value===1)return 'failure'
  return value>=bounded(threshold)?'critical':'normal'
}
export type WeaponDice={count:number;sides:number}
export function parseWeaponDice(formula:string):WeaponDice|null {
  const match=/^\s*(\d+)\s*d\s*(\d+)(?:\s*[+-]\s*\d+)?\s*$/i.exec(formula)
  if(!match)return null
  const count=Number(match[1]),sides=Number(match[2])
  if(!Number.isSafeInteger(count)||count<1||count>20||!Number.isSafeInteger(sides)||sides<2||sides>100)return null
  return {count,sides}
}
export type CriticalCondition={nature:'ruim'|'boa';grade:1|2;quantity:number;duration:string}
export type CriticalEffect={diceCount:number;conditions:CriticalCondition[];movementPrReduction:number;note:string}
/** Regras de crítico de atributo × classificação. 'Fluxo de força' = Guerreiro Insuperável (Corvo/FOR). */
export function getCriticalEffect(form:CriticalFormClass,attribute:CriticalAttribute,corvoStrength:boolean):CriticalEffect {
  const tierNumber=({none:0,raposa:1,tigre:2,dragao:3} as const)[form]
  if(attribute==='strength') {
    const ordinary=([1,2,4,6] as const)[tierNumber]
    const withFlow=([2,4,6,8] as const)[tierNumber]
    return {diceCount:corvoStrength?withFlow:ordinary,conditions:[],movementPrReduction:0,note:corvoStrength?'Guerreiro Insuperável (Fluxo Corvo/FOR) aplicado ao dado crítico.':''}
  }
  if(attribute==='agility')return {
    diceCount:([0,1,2,4] as const)[tierNumber],
    conditions:tierNumber===0?[{nature:'ruim',grade:1,quantity:1,duration:'1'}]:tierNumber===1?[{nature:'ruim',grade:2,quantity:1,duration:'1d2'}]:tierNumber===2?[{nature:'ruim',grade:2,quantity:1,duration:'1d3'},{nature:'ruim',grade:1,quantity:1,duration:'1d3'}]:[{nature:'ruim',grade:2,quantity:2,duration:'1d4+2'}],
    movementPrReduction:0,note:'Escolha e aplicação das condições pelo mestre; não são aplicadas automaticamente.',
  }
  if(attribute==='intellect')return {
    diceCount:([0,1,2,4] as const)[tierNumber],
    conditions:tierNumber===0?[{nature:'boa',grade:1,quantity:1,duration:'1d2'}]:tierNumber===1?[{nature:'boa',grade:2,quantity:1,duration:'1d2+1'}]:tierNumber===2?[{nature:'boa',grade:2,quantity:1,duration:'1d3+1'},{nature:'boa',grade:1,quantity:1,duration:'1d3+1'}]:[{nature:'boa',grade:2,quantity:2,duration:'1d6+2'}],
    movementPrReduction:0,note:'Condições boas decididas e aplicadas pelo mestre; não são aplicadas automaticamente.',
  }
  return {diceCount:([0,1,2,4] as const)[tierNumber],conditions:[],movementPrReduction:([0,25,50,75] as const)[tierNumber],note:tierNumber===0?'Crítico de RES sem Forma não possui efeito específico definido.':'A redução vale somente para gasto de PR no movimento, não para o custo comum da Forma.'}
}
export type CriticalBonusInput={form:CriticalFormClass;weaponFormula:string;corvoStrength:boolean;attribute?:CriticalAttribute}
export function getCriticalBonus(input:CriticalBonusInput){
  const attribute=input.attribute??'strength'
  const effect=getCriticalEffect(input.form,attribute,input.corvoStrength)
  const weapon=parseWeaponDice(input.weaponFormula)
  return {...effect,weapon,bonusDice:effect.diceCount,formula:weapon&&effect.diceCount>0?`+${effect.diceCount}d${weapon.sides}`:null}
}
function rollDuration(text:string,die:(sides:number)=>number):number {
  const match=/^(\d+)d(\d+)(?:\+(\d+))?$/.exec(text)
  return match?Array.from({length:Number(match[1])},()=>die(Number(match[2]))).reduce((a,b)=>a+b,0)+Number(match[3]??0):Number(text)
}
export function rollCriticalBonus(input:CriticalBonusInput,die:(sides:number)=>number=sides=>Math.floor(Math.random()*sides)+1){
  const bonus=getCriticalBonus(input)
  const rolls=bonus.weapon?Array.from({length:bonus.bonusDice},()=>die(bonus.weapon!.sides)):[]
  const durations=new Map<string,number>()
  const conditions=bonus.conditions.map(condition=>{
    if(!durations.has(condition.duration))durations.set(condition.duration,rollDuration(condition.duration,die))
    return {...condition,rounds:durations.get(condition.duration)!}
  })
  return {...bonus,rolls,conditions,total:bonus.weapon?rolls.reduce((a,b)=>a+b,0):bonus.bonusDice===0?0:null as number|null}
}
