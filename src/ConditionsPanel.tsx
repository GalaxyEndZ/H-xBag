import { KISATSUTAI_SKILL_GROUPS } from './systems/kisatsutai/extendedData'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

type EnemyOption = { id: string; name: string; emoji?: string | null }
type CharacterOption = { id: string; name: string; emoji?: string | null }
type ConditionEffect = {type:'modifier'|'dice'|'restriction'|'resource'|'periodic_damage'|'round_counter'|'apply_condition'|'remove_condition';target?:string;key?:string;value?:number;unit?:'flat'|'percent';condition_id?:string;dice?:string;duration?:string}
type Definition = { id: string; name: string; emoji: string; description: string; severity: string; polarity?:string; effects?:ConditionEffect[] }
type Active = { id: string; character_id: string; definition_id: string; duration_label: string | null; notes: string | null; name: string; emoji: string; description: string; severity: string }

// Rótulos em português; os identificadores internos são mantidos para não quebrar efeitos salvos.
const CONDITION_KEYS: Record<string, {value:string;label:string}[]> = {
  status: [
    {value:'strength',label:'Força (FOR)'}, {value:'agility',label:'Agilidade (AGI)'},
    {value:'defense',label:'Defesa (DEF)'}, {value:'resistance',label:'Resistência (RES)'},
    {value:'intelligence',label:'Intelecto (INT)'}, {value:'*',label:'Todos os atributos'},
  ],
  combat_points: [
    {value:'attack',label:'Ataque'}, {value:'block',label:'Bloqueio'},
    {value:'dodge',label:'Esquiva'}, {value:'counterattack',label:'Contra-ataque'},
    {value:'*',label:'Todos os testes de combate'},
  ],
  actions: [{value:'movement',label:'Ações de movimento'},{value:'extra',label:'Ações extras'}],
  resource: [{value:'pv',label:'Pontos de Vida (PV)'},{value:'ps',label:'Pontos de Sanidade (PS)'},{value:'pr',label:'Pontos de Recurso (PR)'}],
}
const GENERAL_SKILL_GROUPS = new Set(['Sociais', 'Conhecimentos Gerais', 'Naturais'])
const SKILL_CHOICES: Record<string, {value:string;label:string}[]> = {
  main_skill: [{value:'*',label:'Todas as perícias principais'}],
  extra_skill: [{value:'*',label:'Todas as perícias gerais'}],
  archetype_skill: [{value:'*',label:'Todas as perícias de arquétipo'}],
}
for (const [group, entries] of Object.entries(KISATSUTAI_SKILL_GROUPS)) {
  const target = GENERAL_SKILL_GROUPS.has(group) ? 'extra_skill' : 'archetype_skill'
  for (const entry of entries) {
    const skill = entry.name
    if (!skill) continue
    SKILL_CHOICES[target].push({value:`${group}:${skill}`,label:`${group} · ${skill}`})
    if (!SKILL_CHOICES.main_skill.some(item => item.value === skill))
      SKILL_CHOICES.main_skill.push({value:skill,label:skill})
  }
}
for (const target of Object.keys(SKILL_CHOICES)) {
  const [all, ...rest] = SKILL_CHOICES[target]
  SKILL_CHOICES[target] = [all, ...rest.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))]
}
const labelForConditionKey = (key:string) => Object.values(CONDITION_KEYS).flat().find(option=>option.value===key.toLowerCase())?.label || (key==='*'?'Todos':key)

export function ConditionsPanel({ campaignId, characters, enemies, master }: {campaignId:string;characters:CharacterOption[];enemies:EnemyOption[];master:boolean}) {
  const [definitions,setDefinitions]=useState<Definition[]>([])
  const [active,setActive]=useState<Active[]>([])
  const [enemyActive,setEnemyActive]=useState<Active[]>([])
  const [name,setName]=useState('')
  const [emoji,setEmoji]=useState('✨')
  const [description,setDescription]=useState('')
  const [severity,setSeverity]=useState('normal')
  const [polarity,setPolarity]=useState('ruim')
  const [characterId,setCharacterId]=useState('')
  const [targetType,setTargetType]=useState<'character'|'enemy'>('character')
  const [definitionId,setDefinitionId]=useState('')
  const [duration,setDuration]=useState('')
  const [durationMode,setDurationMode]=useState<'indeterminada'|'fixa'|'dado'>('indeterminada')
  const [durationDice,setDurationDice]=useState('1d6')
  const rollDuration=()=>{
    if(durationMode==='indeterminada')return 'Indeterminada'
    if(durationMode==='fixa')return duration.trim()||null
    const match=/^(\d+)d(\d+)$/.exec(durationDice)
    if(!match)return null
    const count=Number(match[1]),faces=Number(match[2])
    const total=Array.from({length:count},()=>1+Math.floor(Math.random()*faces)).reduce((sum,value)=>sum+value,0)
    return `${total} rodadas (${durationDice})`
  }
  const [notes,setNotes]=useState('')
  const [editingDefinition,setEditingDefinition]=useState<string|null>(null)
  const [editingAssignment,setEditingAssignment]=useState<string|null>(null)
  const [editName,setEditName]=useState('')
  const [editEmoji,setEditEmoji]=useState('✨')
  const [editDescription,setEditDescription]=useState('')
  const [editSeverity,setEditSeverity]=useState('normal')
  const [editPolarity,setEditPolarity]=useState('ruim')
  const [editDuration,setEditDuration]=useState('')
  const [editNotes,setEditNotes]=useState('')
  const [editEffects,setEditEffects]=useState<ConditionEffect[]>([])
  const [newEffects,setNewEffects]=useState<ConditionEffect[]>([])
  const [orderMap,setOrderMap]=useState<Record<string,number>>({})
  const [dragged,setDragged]=useState<string|null>(null)
  const [dragOver,setDragOver]=useState<string|null>(null)
  const dragSource=useRef<string|null>(null)
  const [rounds,setRounds]=useState<Record<string,number>>({})
  const [rollLog,setRollLog]=useState<Record<string,string>>({})
  const orderKey=(kind:'definition'|'character'|'enemy',id:string)=>`${kind}:${id}`
  const sortBySavedOrder=<T extends {id:string}>(items:T[],kind:'definition'|'character'|'enemy')=>[...items].sort((a,b)=>{
    const ap=orderMap[orderKey(kind,a.id)]??1000000
    const bp=orderMap[orderKey(kind,b.id)]??1000000
    return ap-bp
  })
  const moveCondition=async(kind:'definition'|'character'|'enemy',sourceId:string,destinationId:string)=>{
    if(!master||busy||sourceId===destinationId)return
    const source=kind==='definition'?sortBySavedOrder(definitions,'definition'):kind==='character'?sortBySavedOrder(active,'character'):sortBySavedOrder(enemyActive,'enemy')
    const target=source.find(item=>item.id===destinationId)
    const moving=source.find(item=>item.id===sourceId)
    if(!target||!moving)return
    // Cada personagem ou inimigo mantém uma ordem própria.
    const scoped=kind==='definition'?source:source.filter(item=>(item as Active).character_id===(target as Active).character_id)
    if(!scoped.some(item=>item.id===sourceId))return
    const ids=scoped.map(item=>item.id)
    // Troca direta: a condição arrastada ocupa o lugar da outra, e vice-versa.
    // As demais condições permanecem exatamente nas posições anteriores.
    const sourceIndex=ids.indexOf(sourceId)
    const destinationIndex=ids.indexOf(destinationId)
    ;[ids[sourceIndex],ids[destinationIndex]]=[ids[destinationIndex],ids[sourceIndex]]
    const previous={...orderMap}
    setOrderMap(current=>{
      const updated={...current}
      ids.forEach((id,index)=>{updated[orderKey(kind,id)]=index+1})
      return updated
    })
    setBusy(true)
    try{
      const result=await supabase.rpc('hax_reorder_conditions',{p_campaign_id:campaignId,p_kind:kind,p_ids:ids})
      if(result.error){setOrderMap(previous);setError(`Não foi possível salvar a ordem: ${result.error.message}`)}
    }catch(err){setOrderMap(previous);setError(err instanceof Error?err.message:'Erro ao salvar a ordem das condições')}
    finally{setBusy(false)}
  }
  const clearDrag=()=>{dragSource.current=null;setDragged(null);setDragOver(null)}
  const dragProps=(kind:'definition'|'character'|'enemy',id:string)=>master?{
    draggable:!busy,
    onDragStart:(event:import('react').DragEvent<HTMLElement>)=>{
      if(busy||((event.target as HTMLElement).closest('button,input,textarea,select,a'))){event.preventDefault();return}
      const key=orderKey(kind,id)
      dragSource.current=key
      setDragged(key)
      event.dataTransfer.effectAllowed='move'
      event.dataTransfer.setData('text/plain',key)
    },
    onDragEnter:(event:import('react').DragEvent<HTMLElement>)=>{
      const source=dragSource.current||event.dataTransfer.getData('text/plain')
      if(source.startsWith(`${kind}:`)&&source!==orderKey(kind,id))setDragOver(orderKey(kind,id))
    },
    onDragOver:(event:import('react').DragEvent<HTMLElement>)=>{
      const source=dragSource.current||event.dataTransfer.getData('text/plain')
      if(source.startsWith(`${kind}:`)&&source!==orderKey(kind,id)){
        event.preventDefault()
        event.dataTransfer.dropEffect='move'
        if(dragOver!==orderKey(kind,id))setDragOver(orderKey(kind,id))
      }
    },
    onDrop:(event:import('react').DragEvent<HTMLElement>)=>{
      event.preventDefault()
      event.stopPropagation()
      const source=dragSource.current||event.dataTransfer.getData('text/plain')
      clearDrag()
      if(source.startsWith(`${kind}:`))void moveCondition(kind,source.slice(kind.length+1),id)
    },
    onDragEnd:clearDrag,
    title:'Arraste o cartão para alterar a ordem',
  }:{ }
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const duplicateCondition=async(d:Definition)=>{
    if(!master||busy)return
    setBusy(true);setError('')
    try{
      const created=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:`${d.name} (cópia)`,p_emoji:d.emoji,p_description:d.description,p_severity:d.severity})
      if(created.error)throw created.error
      const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:created.data as string,p_effects:d.effects||[]})
      if(saved.error)throw saved.error
      const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:created.data as string,p_polarity:d.polarity||'ruim'})
      if(classified.error)throw classified.error
      await refresh()
    }catch(error){setError(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  const startEditDefinition=(d:Definition)=>{setEditingDefinition(d.id);setEditName(d.name);setEditEmoji(d.emoji);setEditDescription(d.description);setEditSeverity(d.severity);setEditPolarity(d.polarity||'ruim');setEditEffects(d.effects||[])}
  const [workspace,setWorkspace]=useState<'active'|'apply'|'create'|'library'>('active')
  const [characterFilter,setCharacterFilter]=useState('todos')
  const [filter,setFilter]=useState('')
  const [libraryFilter,setLibraryFilter]=useState('')
  const [librarySeverity,setLibrarySeverity]=useState('todas')
  const [severityFilter,setSeverityFilter]=useState('todas')
  const refresh=useCallback(async()=>{
    const [d,a,ea,fx,orders,polarities]=await Promise.all([
      supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:null}),
      supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:null}),
      supabase.rpc('hax_list_condition_effects',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_condition_order',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_condition_polarities',{p_campaign_id:campaignId}),
    ])
    if(d.error||a.error||ea.error){setError(d.error?.message||a.error?.message||ea.error?.message||'Erro ao consultar condições.');return}
    setOrderMap(Object.fromEntries(((orders.data||[]) as {kind:string;id:string;position:number}[]).map(item=>[`${item.kind}:${item.id}`,item.position])))
    setDefinitions(((d.data||[]) as Definition[]).map(item=>({...item,effects:((fx.data||[]) as {id:string;effects:ConditionEffect[]}[]).find(row=>row.id===item.id)?.effects||[],polarity:((polarities.data||[]) as {id:string;polarity:string}[]).find(row=>row.id===item.id)?.polarity||'ruim'})))
    setActive((a.data||[]) as Active[])
    setEnemyActive((ea.data||[]) as Active[])
    const roundResult=await supabase.rpc('hax_list_condition_rounds',{p_campaign_id:campaignId})
    if(!roundResult.error) setRounds(Object.fromEntries(((roundResult.data||[]) as {assignment_id:string;rounds_remaining:number}[]).map(row=>[row.assignment_id,row.rounds_remaining])))
    setError('')
  },[campaignId])
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh])
  const effectTypes: {value:ConditionEffect['type'];label:string;hint:string}[] = [
    {value:'modifier',label:'Bônus, penalidade ou limite de ações',hint:'Ajusta testes ou a quantidade de ações de movimento e extras. Use valores negativos para reduzir ações.'},
    {value:'dice',label:'Vantagem ou desvantagem',hint:'Altera a quantidade de dados rolados.'},
    {value:'restriction',label:'Bloquear ação ou reação',hint:'Bloqueia totalmente a ação. Para limitar quantidades, use o efeito de bônus ou penalidade na categoria Quantidade de ações.'},
    {value:'resource',label:'Alterar recurso máximo',hint:'Modifica o limite de PV, PS ou PR; não altera permanentemente a ficha.'},
    {value:'periodic_damage',label:'Dano por rodada',hint:'O mestre rola o dano; a aplicação permanece manual.'},
    {value:'round_counter',label:'Contador de rodadas',hint:'O mestre avança o contador; a condição não é removida sozinha.'},
    {value:'apply_condition',label:'Sugerir aplicação de outra condição',hint:'Vínculo informativo; o mestre decide quando aplicar.'},
    {value:'remove_condition',label:'Sugerir remoção de outra condição',hint:'Vínculo informativo; o mestre decide quando remover.'},
  ]
  const defaultEffect=(type:ConditionEffect['type']):ConditionEffect=>{
    switch(type){
      case 'modifier': case 'dice': return {type,target:'status',key:'strength',value:type==='dice'?-1:-5}
      case 'resource': return {type,target:'resource',key:'pv',value:-5}
      case 'restriction': return {type,key:'dodge'}
      case 'periodic_damage': return {type,key:'pv',dice:'1d6'}
      case 'round_counter': return {type,value:3}
      default: return {type,condition_id:''}
    }
  }
  const validateEffects=(effects:ConditionEffect[],ownId?:string):string|null=>{
    for(let i=0;i<effects.length;i++){
      const effect=effects[i]
      const prefix=`Efeito ${i+1}`
      if(effect.type==='dice'&&!['status','combat_points'].includes(effect.target||''))return `${prefix}: vantagem e desvantagem só podem afetar atributos ou testes de combate.`
      if(['modifier','dice','resource'].includes(effect.type)){
        if(!effect.key?.trim())return `${prefix}: selecione o atributo, perícia, ação ou recurso.`
        if(!Number.isFinite(effect.value)||(effect.unit!=='percent'&&!Number.isInteger(effect.value)))return `${prefix}: informe um número válido.`
        if(effect.type==='dice'&&effect.unit==='percent')return `${prefix}: dados não podem ser percentuais.`
        if(Math.abs(effect.value||0)>999)return `${prefix}: use valores entre -999 e 999.`
      }
      if(effect.type==='round_counter'&&(!Number.isInteger(effect.value)||!effect.value||effect.value<1||effect.value>999))return `${prefix}: escolha entre 1 e 999 rodadas.`
      if(effect.type==='periodic_damage'&&!/^(?:[1-9]|1\d|20)d(?:[2-9]|[1-9]\d|100)$/i.test((effect.dice||'').trim()))return `${prefix}: use dados como 1d6, 2d8 ou 1d20 (até 20 dados de 2 a 100 faces).`
      if(['apply_condition','remove_condition'].includes(effect.type)){
        if(!effect.condition_id)return `${prefix}: escolha uma condição vinculada.`
        if(effect.condition_id===ownId)return `${prefix}: uma condição não pode vincular a si mesma.`
      }
    }
    return null
  }
  const effectEditor=(items:ConditionEffect[],setItems:(value:ConditionEffect[])=>void,ownId?:string)=>{
    const update=(index:number, patch:Partial<ConditionEffect>)=>setItems(items.map((effect,i)=>i===index?{...effect,...patch}:effect))
    const issue=validateEffects(items,ownId)
    return <section className="hb-condition-effect-editor">
      <div className="hb-condition-effect-heading"><div><strong>⚙️ Efeitos configuráveis</strong><small>Combine efeitos para construir a condição. Os identificadores internos continuam compatíveis com os dados salvos.</small></div><span>{items.length} efeito(s)</span></div>
      {items.length===0&&<div className="hb-condition-effect-empty"><strong>Nenhum efeito configurado</strong><small>Adicione um efeito abaixo para que a condição altere testes, recursos ou ações.</small></div>}
      {items.map((effect,index)=>{
        const selected=effectTypes.find(t=>t.value===effect.type)
        const category=effect.type==='resource'?'resource':effect.target||'status'
        const choices=SKILL_CHOICES[category] || CONDITION_KEYS[category]
        const customSkill=['main_skill','extra_skill','archetype_skill'].includes(category)
        const unknownKey=Boolean(choices&&effect.key&&!choices.some(option=>option.value===effect.key))
        return <div key={index} className="hb-condition-effect-row">
          <div className="hb-condition-effect-row-header"><strong><span className="hb-condition-effect-index">{index+1}</span> {selected?.label||'Efeito'}</strong><button type="button" className="secondary-button hb-condition-effect-remove" onClick={()=>setItems(items.filter((_,i)=>i!==index))} aria-label={`Remover efeito ${index+1}`}>✕ Remover</button></div>
          <div className="hb-condition-effect-fields">
            <label>Tipo de efeito<select value={effect.type} onChange={e=>setItems(items.map((item,i)=>i===index?defaultEffect(e.target.value as ConditionEffect['type']):item))}>{effectTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            {(['modifier','dice'].includes(effect.type))&&<label>Onde atua<select value={category} onChange={e=>{
              const target=e.target.value
              update(index,{target,key:CONDITION_KEYS[target]?.[0]?.value||(target==='main_skill'||target==='extra_skill'||target==='archetype_skill'?'*':'')})
            }}><option value="status">Atributos</option>{effect.type!=='dice'&&<><option value="main_skill">Perícias principais</option><option value="extra_skill">Perícias gerais</option><option value="archetype_skill">Perícias de arquétipo</option></>}<option value="combat_points">Testes de combate</option>{effect.type!=='dice'&&<option value="actions">Quantidade de ações</option>}</select></label>}
            {['modifier','dice','resource'].includes(effect.type)&&<>
              <label>{effect.type==='resource'?'Recurso afetado':customSkill?'Perícia afetada':category==='actions'?'Tipo de ação afetada':'Atributo ou ação afetada'}
                {customSkill?<select value={effect.key||'*'} onChange={e=>update(index,{key:e.target.value})}><option value="" disabled>Escolha a perícia...</option>{(choices||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{effect.key&&!choices?.some(option=>option.value===effect.key)&&<option value={effect.key}>{effect.key} (valor anterior)</option>}</select>:<select value={unknownKey?'__custom__':effect.key||''} onChange={e=>update(index,{key:e.target.value==='__custom__'?'':e.target.value})}><option value="">Selecione...</option>{(choices||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{unknownKey&&<option value="__custom__">Identificador antigo (personalizado)</option>}</select>}
                {unknownKey&&<input value={effect.key||''} onChange={e=>update(index,{key:e.target.value})} aria-label="Identificador antigo" placeholder="Identificador personalizado" />}
              </label>
              <label>{effect.type==='dice'?'Dados adicionais (+ vantagem / − desvantagem)':effect.type==='resource'?'Alteração do limite (+/−)':category==='actions'?'Ações adicionadas (+) ou retiradas (−)':'Pontos adicionados ou subtraídos'}<div style={{display:'flex',gap:8,alignItems:'center'}}><input type="number" min="-999" max="999" step={effect.unit==='percent'?'0.1':'1'} value={effect.value??0} onChange={e=>update(index,{value:e.target.value===''?NaN:Number(e.target.value)})}/>{effect.type!=='dice'&&<select aria-label="Unidade do modificador" value={effect.unit||'flat'} onChange={e=>update(index,{unit:e.target.value as 'flat'|'percent'})}><option value="flat">Pontos</option><option value="percent">%</option></select>}</div></label>
            </>}
            {effect.type==='restriction'&&<label>Ação ou reação bloqueada<select value={effect.key||'dodge'} onChange={e=>update(index,{key:e.target.value})}><option value="dodge">Esquiva</option><option value="counterattack">Contra-ataque</option><option value="block">Bloqueio</option><option value="attack">Ataques</option><option value="movement">Movimento</option></select></label>}
            {effect.type==='periodic_damage'&&<><label>Recurso afetado<select value={effect.key||'pv'} onChange={e=>update(index,{key:e.target.value})}><option value="pv">Pontos de Vida (PV)</option><option value="ps">Pontos de Sanidade (PS)</option><option value="pr">Pontos de Recurso (PR)</option></select></label><label>Dados de dano<input value={effect.dice||''} onChange={e=>update(index,{dice:e.target.value})} placeholder="Ex.: 1d6" /></label></>}
            {effect.type==='round_counter'&&<label>Quantidade inicial de rodadas<input type="number" min="1" max="999" step="1" value={effect.value??3} onChange={e=>update(index,{value:e.target.value===''?NaN:Number(e.target.value)})}/></label>}
            {['apply_condition','remove_condition'].includes(effect.type)&&<label>Condição relacionada<select value={effect.condition_id||''} onChange={e=>update(index,{condition_id:e.target.value})}><option value="">Selecione...</option>{definitions.filter(d=>d.id!==ownId).map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label>}
          </div>
          <small className="hb-condition-effect-help">{selected?.hint}</small>
        </div>
      })}
      {issue&&<p className="hb-condition-effect-validation" role="status">⚠️ {issue}</p>}
      <button type="button" className="secondary-button hb-condition-effect-add" onClick={()=>setItems([...items,defaultEffect('modifier')])}>＋ Adicionar efeito</button>
    </section>
  }
  const filteredDefinitions=sortBySavedOrder(definitions,'definition').filter(d=>(librarySeverity==='todas'||d.severity===librarySeverity)&&`${d.name} ${d.description} ${d.severity}`.toLocaleLowerCase().includes(libraryFilter.toLocaleLowerCase()))
  const allActive=[...sortBySavedOrder(active,'character').map(a=>({...a,targetType:'character' as const})),...sortBySavedOrder(enemyActive,'enemy').map(a=>({...a,targetType:'enemy' as const}))]
  const targets=[...characters.map(c=>({...c,targetType:'character' as const})),...enemies.map(e=>({...e,targetType:'enemy' as const}))]
  const targetName=(a:{character_id:string;targetType:'character'|'enemy'})=>targets.find(t=>t.id===a.character_id&&t.targetType===a.targetType)?.name||'Alvo removido'
  const visibleActive=allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
  const rollPeriodic=(assignment:Active)=>{
    const definition=definitions.find(d=>d.id===assignment.definition_id)
    const effects=(definition?.effects||[]).filter(e=>e.type==='periodic_damage')
    const rolls=effects.map(e=>{
      const match=/^(\d{1,2})d(\d{1,3})$/i.exec(e.dice||'')
      if(!match)return `Dado inválido: ${e.dice||'vazio'}`
      const count=Number(match[1]),faces=Number(match[2])
      if(count<1||count>20||faces<2||faces>100)return `Dado fora dos limites: ${e.dice}`
      const results=Array.from({length:count},()=>Math.floor(Math.random()*faces)+1)
      return `${e.key||'pv'}: ${results.join(' + ')} = ${results.reduce((a,b)=>a+b,0)} de dano`
    })
    setRollLog(previous=>({...previous,[assignment.id]:rolls.join(' | ')}))
  }
  const advanceRound=(assignment:Active,kind:'character'|'enemy')=>void execute(async()=>{
    const definition=definitions.find(d=>d.id===assignment.definition_id)
    const initial=(definition?.effects||[]).find(e=>e.type==='round_counter')?.value
    return supabase.rpc('hax_advance_condition_round',{p_campaign_id:campaignId,p_kind:kind,p_assignment_id:assignment.id,p_initial_rounds:Math.max(1,Math.min(999,Math.floor(initial||3)))})
  })
  const execute=async(fn:()=>Promise<{error: {message:string}|null}>)=>{
    setBusy(true);setError('')
    try{const result=await fn();if(result.error)throw new Error(result.error.message);await refresh()}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  return <section className="hb-conditions-panel">
    <header className="hb-conditions-hero"><div className="hb-conditions-hero-copy"><span className="hb-conditions-eyebrow">CENTRAL DE CONDIÇÕES</span><h2><span className="hb-conditions-hero-symbol">✦</span> Condições & efeitos</h2><p>Gerencie condições, organize prioridades e configure os efeitos aplicados nas fichas.</p></div><div className="hb-conditions-hero-actions">{master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('create')}>＋ Nova condição</button>}<button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={busy}>↻ Atualizar</button></div></header>
    {error&&<div className="hb-condition-inline-error" role="alert">Não foi possível concluir a operação: {error}</div>}
    <div className="hb-conditions-stats"><div><span>🩸 Condições ativas</span><strong>{allActive.length}</strong><small>Aplicações na campanha</small></div><div><span>🎯 Alvos afetados</span><strong>{new Set(allActive.map(a=>`${a.targetType}:${a.character_id}`)).size}</strong><small>Personagens e inimigos</small></div><div><span>📚 Na biblioteca</span><strong>{definitions.length}</strong><small>Condições cadastradas</small></div></div>
    
    <nav className="hb-condition-tabs" aria-label="Seções das condições">
      <button type="button" className={workspace==='active'?'is-active':''} onClick={()=>setWorkspace('active')}>🩸 Ativas <span>{allActive.length}</span></button>
      {master&&<button type="button" className={workspace==='apply'?'is-active':''} onClick={()=>setWorkspace('apply')}>🎯 Aplicar</button>}
      {master&&<button type="button" className={workspace==='library'?'is-active':''} onClick={()=>setWorkspace('library')}>📚 Biblioteca <span>{definitions.length}</span></button>}
      {master&&<button type="button" className={workspace==='create'?'is-active':''} onClick={()=>setWorkspace('create')}>✨ Criar</button>}
    </nav>
    {master&&(workspace==='create'||workspace==='apply')&&<div className="hb-conditions-grid hb-conditions-single">
      <form style={{display:workspace==='create'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{const invalid=validateEffects(newEffects);if(invalid)throw new Error(invalid);const r=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:name.trim(),p_emoji:emoji.trim()||'✨',p_description:description.trim(),p_severity:severity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:r.data as string,p_effects:newEffects});if(saved.error)return saved;const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:r.data as string,p_polarity:polarity});if(classified.error)return classified;setName('');setDescription('');setNewEffects([]);setWorkspace('library')}return r})}}>
        <h3>✨ Criar condição</h3><label>Nome<input required maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Envenenado" /></label><label>Emoji<input maxLength={12} value={emoji} onChange={e=>setEmoji(e.target.value)} /></label><label>Natureza<select value={polarity} onChange={event=>setPolarity(event.target.value)}><option value="boa">Boa</option><option value="ruim">Ruim</option></select></label><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Descreva os efeitos..." /></label>{effectEditor(newEffects,setNewEffects)}<button className="primary-button" disabled={busy||!name.trim()}>Criar condição</button>
      </form>
      <form style={{display:workspace==='apply'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{const chosenDuration=rollDuration();const r=targetType==='enemy'?await supabase.rpc('hax_apply_enemy_condition',{p_campaign_id:campaignId,p_enemy_id:characterId,p_definition_id:definitionId,p_duration_label:chosenDuration,p_notes:notes.trim()||null}):await supabase.rpc('hax_apply_condition',{p_campaign_id:campaignId,p_character_id:characterId,p_definition_id:definitionId,p_duration_label:chosenDuration,p_notes:notes.trim()||null});if(!r.error){setDuration('');setNotes('');setWorkspace('active')}return r})}}>
        <h3>🎯 Aplicar condição</h3><label>Tipo de alvo<select value={targetType} onChange={e=>{setTargetType(e.target.value as 'character'|'enemy');setCharacterId('')}}><option value="character">Personagem</option><option value="enemy">Inimigo</option></select></label><label>{targetType==='enemy'?'Inimigo':'Personagem'}<select required value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Selecione...</option>{targets.filter(t=>t.targetType===targetType).map(t=><option key={`${t.targetType}:${t.id}`} value={t.id}>{t.targetType==='enemy'?'👹':'🧑'} {t.emoji||''} {t.name}</option>)}</select></label><label>Condição<select required value={definitionId} onChange={e=>setDefinitionId(e.target.value)}><option value="">Selecione...</option>{definitions.map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label><label>Tipo de duração<select value={durationMode} onChange={event=>setDurationMode(event.target.value as typeof durationMode)}><option value="indeterminada">Indeterminada</option><option value="fixa">Fixa</option><option value="dado">Definida por dado</option></select></label>{durationMode==='fixa'&&<label>Duração fixa<input value={duration} onChange={event=>setDuration(event.target.value)} placeholder="Ex.: 3 rodadas / até o fim da cena" /></label>}{durationMode==='dado'&&<label>Dado de duração<select value={durationDice} onChange={event=>setDurationDice(event.target.value)}>{['1d4','1d6','1d8','1d10','1d12','1d20','2d6'].map(d=><option key={d} value={d}>{d}</option>)}</select></label>}<label>Observação<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" /></label><button className="primary-button" disabled={busy||!characterId||!definitionId}>Aplicar condição</button>
      </form>
    </div>}
    {workspace==='active'&&<div className="hb-condition-card hb-conditions-wide"><div className="hb-conditions-section-head"><div><h3>📋 Condições ativas</h3><small>Consulte e gerencie os efeitos aplicados</small></div><input aria-label="Buscar condição ou personagem" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar personagem ou condição..." /></div><div className="hb-conditions-filter-row"><label>Alvo <select value={characterFilter} onChange={e=>setCharacterFilter(e.target.value)}><option value="todos">Todos os alvos</option>{characters.map(c=><option key={c.id} value={`character:${c.id}`}>{c.emoji||'🧑'} {c.name}</option>)}{enemies.map(e=><option key={e.id} value={`enemy:${e.id}`}>👹 {e.name}</option>)}</select></label><label>Gravidade <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><span>{visibleActive.length} resultado(s)</span>{(filter||characterFilter!=='todos'||severityFilter!=='todas')&&<button type="button" className="secondary-button hb-conditions-clear" onClick={()=>{setFilter('');setCharacterFilter('todos');setSeverityFilter('todas')}}>Limpar filtros</button>}</div>{allActive.length===0?<div className="hb-conditions-empty"><span>✧</span><strong>Nenhuma condição ativa</strong><p>Quando uma condição for aplicada, ela aparecerá aqui.</p>{master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('apply')}>Aplicar condição</button>}</div>:<div className="hb-conditions-active">{visibleActive.length===0&&<div className="hb-conditions-filter-empty">Nenhuma condição corresponde aos filtros. <button type="button" className="secondary-button" onClick={()=>{setFilter('');setCharacterFilter('todos');setSeverityFilter('todas')}}>Limpar filtros</button></div>}{visibleActive.map(a=><article key={a.id} {...dragProps(a.targetType,a.id)} className={`hb-conditions-entry severity-${a.severity} ${dragged===orderKey(a.targetType,a.id)?'hb-condition-dragging':''} ${dragOver===orderKey(a.targetType,a.id)?'hb-condition-drop-target':''}`}><div><strong>{a.emoji} {a.name}</strong><span className={`hb-condition-polarity ${definitions.find(d=>d.id===a.definition_id)?.polarity==='boa'?'good':'bad'}`}>{definitions.find(d=>d.id===a.definition_id)?.polarity==='boa'?'✦ Boa':'◆ Ruim'}</span><span className={`hb-conditions-severity severity-${a.severity}`}>{a.severity==='critica'?'Crítica':a.severity==='grave'?'Grave':'Normal'}</span><small>{targetName(a)} · {a.duration_label||'Sem duração definida'}</small>{a.description&&<p>{a.description}</p>}{a.notes&&<small>{a.notes}</small>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<small>⏳ Rodadas restantes: {rounds[a.id]??'não iniciadas'}</small>}{rollLog[a.id]&&<small role="status">🎲 {rollLog[a.id]} — aplique o dano manualmente</small>}</div>{master&&<div className="hb-condition-actions">{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>advanceRound(a,a.targetType)}>⏳ Avançar rodada</button>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='periodic_damage')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>rollPeriodic(a)}>🎲 Rolar dano</button>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>{const d=definitions.find(d=>d.id===a.definition_id);if(d)startEditDefinition(d)}}>✏️ Editar condição</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEditingAssignment(`${a.targetType}:${a.id}`);setEditDuration(a.duration_label||'');setEditNotes(a.notes||'')}}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void execute(async()=>a.targetType==='enemy'?supabase.rpc('hax_remove_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}):supabase.rpc('hax_remove_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}))}>Remover</button></div>}</article>)}</div>}</div>}
    {master&&workspace==='library'&&<div className="hb-condition-card"><div className="hb-conditions-section-head"><div><h3>📚 Biblioteca de condições</h3><small>Condições disponíveis para aplicar aos personagens</small></div><span className="hb-conditions-count">{definitions.length} cadastradas</span></div><label className="hb-conditions-library-search">Buscar na biblioteca<input aria-label="Buscar condições cadastradas" value={libraryFilter} onChange={e=>setLibraryFilter(e.target.value)} placeholder="Nome, descrição ou gravidade..." /></label><div className="hb-conditions-library-tools"><label>Gravidade<select value={librarySeverity} onChange={e=>setLibrarySeverity(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><span>{filteredDefinitions.length} de {definitions.length} condições</span>{(libraryFilter||librarySeverity!=='todas')&&<button type="button" className="secondary-button" onClick={()=>{setLibraryFilter('');setLibrarySeverity('todas')}}>Limpar filtros</button>}</div><div className="hb-condition-library">{definitions.length>0&&filteredDefinitions.length===0&&<div className="hb-conditions-filter-empty">Nenhuma condição encontrada com esses filtros.</div>}{definitions.length===0&&<p className="hb-conditions-empty">Nenhuma condição cadastrada. Use a aba Criar para adicionar uma.</p>}{filteredDefinitions.map(d=><div key={d.id} {...dragProps('definition',d.id)} className={`hb-condition-library-item severity-${d.severity} ${dragged===orderKey('definition',d.id)?'hb-condition-dragging':''} ${dragOver===orderKey('definition',d.id)?'hb-condition-drop-target':''}`}><strong>{d.emoji} {d.name}</strong><span className={`hb-condition-polarity ${d.polarity==='boa'?'good':'bad'}`}>{d.polarity==='boa'?'✦ Boa':'◆ Ruim'}</span><span className={`hb-conditions-severity severity-${d.severity}`}>{d.severity==='critica'?'Crítica':d.severity==='grave'?'Grave':'Normal'}</span><small>{d.description||'Sem descrição'}</small><small>{(d.effects||[]).length} efeito(s) configurado(s)</small><div className="hb-condition-actions"><button type="button" className="primary-button" disabled={busy||targets.length===0} onClick={()=>{setDefinitionId(d.id);setWorkspace('apply')}}>🎯 Aplicar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>startEditDefinition(d)}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void duplicateCondition(d)}>📋 Copiar</button><button type="button" className="secondary-button" disabled={busy||allActive.some(a=>a.definition_id===d.id)} onClick={()=>void execute(async()=>supabase.rpc('hax_delete_condition',{p_campaign_id:campaignId,p_definition_id:d.id}))}>Excluir</button></div></div>)}</div></div>}
    {master&&editingDefinition&&<div className="hb-condition-modal-backdrop" role="presentation"><form className="hb-condition-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();const id=editingDefinition;void execute(async()=>{const invalid=validateEffects(editEffects,id);if(invalid)throw new Error(invalid);const r=await supabase.rpc('hax_update_condition',{p_campaign_id:campaignId,p_definition_id:id,p_name:editName.trim(),p_emoji:editEmoji.trim()||'✨',p_description:editDescription.trim(),p_severity:editSeverity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:id,p_effects:editEffects});if(saved.error)return saved;const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:id,p_polarity:editPolarity});if(classified.error)return classified;setEditingDefinition(null)}return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição</h3><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>✕</button></div><label>Nome<input required maxLength={70} value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Emoji<input maxLength={12} value={editEmoji} onChange={e=>setEditEmoji(e.target.value)}/></label><label>Natureza<select value={editPolarity} onChange={event=>setEditPolarity(event.target.value)}><option value="boa">Boa</option><option value="ruim">Ruim</option></select></label><label>Gravidade<select value={editSeverity} onChange={e=>setEditSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea rows={4} value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>{effectEditor(editEffects,setEditEffects,editingDefinition)}<div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>Cancelar</button><button className="primary-button" disabled={busy||!editName.trim()}>Salvar alterações</button></div></form></div>}
    {master&&editingAssignment&&<div className="hb-condition-modal-backdrop" role="presentation"><form className="hb-condition-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();const [kind,id]=editingAssignment.split(':');void execute(async()=>{const r=kind==='enemy'?await supabase.rpc('hax_update_active_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null}):await supabase.rpc('hax_update_active_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null});if(!r.error)setEditingAssignment(null);return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição aplicada</h3><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>✕</button></div><label>Duração<input maxLength={120} value={editDuration} onChange={e=>setEditDuration(e.target.value)} placeholder="Ex.: 3 turnos"/></label><label>Observações<textarea rows={3} maxLength={500} value={editNotes} onChange={e=>setEditNotes(e.target.value)}/></label><div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>Cancelar</button><button className="primary-button" disabled={busy}>Salvar alterações</button></div></form></div>}
  </section>
}
export function CharacterConditions({campaignId,characterId}:{campaignId:string;characterId:string}){
 const [active,setActive]=useState<Active[]>([])
 const [definitions,setDefinitions]=useState<Definition[]>([])
 const [displayOrder,setDisplayOrder]=useState<Record<string,number>>({})
 const [error,setError]=useState('')
 useEffect(()=>{let live=true;const load=async()=>{
   const [assignments,defs,effects,orders]=await Promise.all([
     supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:characterId}),
     supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
     supabase.rpc('hax_list_condition_effects',{p_campaign_id:campaignId}),
     supabase.rpc('hax_list_condition_order',{p_campaign_id:campaignId})
   ])
   if(!live)return
   if(assignments.error||defs.error||effects.error||orders.error){setError('Não foi possível consultar os efeitos das condições.');return}
   setError('')
   setDisplayOrder(Object.fromEntries(((orders.data||[]) as {kind:string;id:string;position:number}[]).filter(x=>x.kind==='character').map(x=>[x.id,x.position])))
   setActive((assignments.data||[]) as Active[])
   setDefinitions(((defs.data||[]) as Definition[]).map(d=>({...d,effects:((effects.data||[]) as {id:string;effects:ConditionEffect[]}[]).find(e=>e.id===d.id)?.effects||[]})))
 };void load();const t=setInterval(()=>void load(),15000);return()=>{live=false;clearInterval(t)}},[campaignId,characterId])
 const modifiers=new Map<string,number>()
 for(const assignment of active){
   const def=definitions.find(d=>d.id===assignment.definition_id)
   for(const effect of def?.effects||[]){
     if(effect.type!=='modifier'||!Number.isFinite(effect.value))continue
     const key=`${effect.unit==='percent'?'% ':''}${effect.target||'status'}:${(effect.key||'').trim().toLocaleLowerCase()}`
     modifiers.set(key,(modifiers.get(key)||0)+(effect.value||0))
   }
 }
 const labels:Record<string,string>={status:'Status',main_skill:'Perícia principal',extra_skill:'Perícia extra',archetype_skill:'Perícia de arquétipo',combat_points:'Pontos de combate'}
 return <div className="hb-condition-indicator"><strong>🩸 Condições {active.length>0?`(${active.length})`:''}</strong><div>{active.length===0?<small>Nenhuma condição ativa</small>:[...active].sort((a,b)=>(displayOrder[a.id]??999999)-(displayOrder[b.id]??999999)).map(a=><span key={a.id} className={`hb-condition-tag severity-${a.severity}`} title={[a.description,a.duration_label,a.notes].filter(Boolean).join(' · ')}>{a.emoji} {a.name}{a.duration_label?` · ${a.duration_label}`:''}</span>)}</div>
 {modifiers.size>0&&<div className="hb-condition-modifiers" aria-label="Modificadores cumulativos ativos"><strong>Modificadores ativos</strong>{[...modifiers.entries()].filter(([,value])=>value!==0).map(([key,value])=>{const [rawTarget,...rest]=key.split(':');const isPercent=rawTarget.startsWith('% ');const target=isPercent?rawTarget.slice(2):rawTarget;return <span key={key} className="hb-condition-tag">{labels[target]||target}{rest.join(':')?` · ${labelForConditionKey(rest.join(':'))}`:''}: {value>0?'+':''}{value}{isPercent?'%':''}</span>})}</div>}
 {active.length>0&&<div className="hb-condition-rule-hints"><strong>Regras adicionais configuradas</strong>{active.flatMap(a=>{const d=definitions.find(item=>item.id===a.definition_id);return (d?.effects||[]).filter(e=>['dice','restriction','resource','periodic_damage','round_counter'].includes(e.type)).map((e,i)=><span key={`${a.id}:${i}`} className="hb-condition-rule-hint">{a.emoji} {a.name}: {e.type==='dice'?`${(e.value||0)>0?'+':''}${e.value||0} dado(s) · ${e.target||'status'} / ${e.key||'*'}`:e.type==='restriction'?`Bloqueia ${e.key||'ação'}`:e.type==='resource'?`${(e.value||0)>0?'+':''}${e.value||0}${e.unit==='percent'?'%':' pontos'} em ${e.key||'recurso'} máximo`:e.type==='periodic_damage'?`${e.dice||'dano'} por rodada (${e.key||'pv'}; acionamento manual)`:`${e.value||3} rodadas (controle do mestre)`}</span>)})}</div>}
 {error&&<small role="status">{error}</small>}
 </div>
}

/** Condições ativas de um inimigo, visíveis somente na ficha do mestre. */
export function EnemyConditions({campaignId,enemyId}:{campaignId:string;enemyId:string}){
  const [active,setActive]=useState<Active[]>([])
  useEffect(()=>{
    let live=true
    const load=async()=>{
      const result=await supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:enemyId})
      if(live&&!result.error)setActive((result.data||[]) as Active[])
    }
    void load()
    const timer=window.setInterval(()=>void load(),15000)
    return()=>{live=false;window.clearInterval(timer)}
  },[campaignId,enemyId])
  return <div className="hb-condition-indicator"><strong>🩸 Condições do inimigo ({active.length})</strong><div>{active.length===0?<small>Nenhuma condição ativa</small>:active.map(condition=><span key={condition.id} className={`hb-condition-tag severity-${condition.severity}`} title={condition.description}>{condition.emoji} {condition.name}{condition.duration_label?` · ${condition.duration_label}`:''}</span>)}</div></div>
}
