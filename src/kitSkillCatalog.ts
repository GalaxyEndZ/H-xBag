import { KISATSUTAI_SKILL_GROUPS } from './systems/kisatsutai/extendedData'
import { KIT_MAIN_SKILLS, itemKitSkillBonuses, kitSlots, type KitType, type KitBenefitMode } from './kitRules'

/** Mesma fonte de perícias utilizada pelas fichas do Kisatsutai e pelas Condições. */
const EXTRA_GROUPS = new Set(['Sociais','Conhecimentos Gerais','Naturais'])
export type KitSkillGroup = 'main' | 'extra' | 'archetype'
export const KIT_SKILL_CATALOG: Record<KitSkillGroup, {group:string;options:{value:string;label:string}[]}[]> = {
  main:[{group:'Perícias principais',options:KIT_MAIN_SKILLS.map(name=>({value:name,label:name}))}],
  extra:[],
  archetype:[],
}
for (const [group, entries] of Object.entries(KISATSUTAI_SKILL_GROUPS)) {
  const target = EXTRA_GROUPS.has(group) ? 'extra' : 'archetype'
  KIT_SKILL_CATALOG[target].push({group,options:entries.map(skill=>({value:`${group}:${skill.name}`,label:skill.name}))})
}
export const KIT_SKILL_LABELS: Record<string,string> = Object.fromEntries(
  Object.values(KIT_SKILL_CATALOG).flatMap(groups=>groups.flatMap(group=>group.options.map(entry=>[entry.value,entry.label])))
)
export const formatKitSkill = (key:string):string => KIT_SKILL_LABELS[key] || key.split(':').at(-1) || key
export function validateKitSkillSelection(type:KitType, mode:KitBenefitMode, skills:readonly string[], bonus:string|number):string|null {
  const slots=kitSlots(type,mode)
  if(!slots.length)return null // Proteção moderada não usa bônus de perícias.
  const chosen=slots.map((slot,i)=>({slot,value:(skills[i]||'').trim()}))
  if(chosen.some(({slot,value})=>!(KIT_SKILL_CATALOG[slot?.group] ?? []).some(group=>group.options.some(option=>option.value===value))))
    return 'Selecione perícias existentes do catálogo para todos os espaços do kit.'
  if(new Set(chosen.map(({value})=>value)).size!==chosen.length)return 'Escolha perícias diferentes para o mesmo kit.'
  // O bônus de cada espaço é fixado pela regra do kit; o valor legado não é editado aqui.
  void bonus
  return null
}

/** Bônus de kits de inventário apenas enquanto estiverem equipados. */
export function equippedKitSkillBonuses(items:readonly {name:string;character_id:string;metadata?:Record<string,any>|null}[],characterId:string,skillKey:string):{name:string;bonus:number}[] {
  if(!characterId || !skillKey)return []
  return items.flatMap(item=>{
    const meta=item.metadata||{}
    if(item.character_id!==characterId || meta.equipped!==true || !['equip_simple','equip_standard','equip_rare'].includes(String(meta.kitType)))return []
    const keys=Array.isArray(meta.kitSkills)?meta.kitSkills:[]
    const values=itemKitSkillBonuses(meta)
    return keys.flatMap((key:string,index:number)=>key===skillKey && (values[index]??0)>0
      ? [{name:item.name,bonus:values[index]}] : [])
  })
}
