import { KISATSUTAI_SKILL_GROUPS, KISATSUTAI_TRAINING } from './systems/kisatsutai/extendedData'
import './ConditionsEnhancements.css'
import './ConditionsV140.css'
import './ConditionsV144.css'
import './ConditionsV145.css'
import './ConditionsV152.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

type EnemyOption = { id: string; name: string; emoji?: string | null }
type CharacterOption = { id: string; name: string; emoji?: string | null }
type ConditionEffect = {type:'modifier'|'dice'|'restriction'|'resource'|'periodic_damage'|'round_counter'|'apply_condition'|'remove_condition';target?:string;key?:string;value?:number;unit?:'flat'|'percent';condition_id?:string;dice?:string;duration?:string}
type Definition = { id: string; name: string; emoji: string; description: string; severity: string; polarity?:string; effects?:ConditionEffect[]; visible_to_players?:boolean }
type Active = { id: string; character_id: string; definition_id: string; duration_label: string | null; notes: string | null; name: string; emoji: string; description: string; severity: string }

// Rótulos em português; os identificadores internos são mantidos para não quebrar efeitos salvos.
const CONDITION_KEYS: Record<string, {value:string;label:string}[]> = {
  status: [
    {value:'strength',label:'Força (FOR)'}, {value:'agility',label:'Agilidade (AGI)'},
    {value:'defense',label:'Defesa (DEF)'}, {value:'resistance',label:'Respiração (RES)'},
    {value:'intelligence',label:'Intelecto (INT)'}, {value:'*',label:'Todos os atributos'},
  ],
  combat_points: [
    {value:'attack',label:'Ataque'}, {value:'block',label:'Bloqueio'},
    {value:'dodge',label:'Esquiva'}, {value:'counterattack',label:'Contra-ataque'},
    {value:'*',label:'Todos os testes de combate'},
  ],
  combat_stats: [
    {value:'critical',label:'Limite de crítico (menor = crítico mais fácil)'},
    {value:'reactions',label:'Número de reações'},
    {value:'counterattack_dt',label:'DT de contra-ataque'},
    {value:'armor_resistance',label:'Resistência da armadura equipada'},
    {value:'physical_protection',label:'Proteção física'},
    {value:'sanity_protection',label:'Proteção de sanidade'},
    {value:'movement',label:'Deslocamento'},
  ],
  actions: [{value:'movement',label:'Ações de movimento'},{value:'extra',label:'Ações extras'}],
  resource: [{value:'pv',label:'Pontos de Vida (PV)'},{value:'ps',label:'Pontos de Sanidade (PS)'},{value:'pr',label:'Pontos de Recurso (PR)'}],
}
const GENERAL_SKILL_GROUPS = new Set(['Sociais', 'Conhecimentos Gerais', 'Naturais'])
// As seis perícias principais da ficha são independentes das perícias treinadas.
// Usamos os nomes internos originais (skills.*) para preservar os efeitos salvos.
const MAIN_SKILL_CHOICES = [
  {value:'vigor',label:'VIGOR'},
  {value:'mental',label:'MENTAL'},
  {value:'combat',label:'COMBATE'},
  {value:'dexterity',label:'DESTREZA'},
  {value:'resistance',label:'RESISTÊNCIA'},
  {value:'ability',label:'HABILIDADE'},
]
const SKILL_CHOICES: Record<string, {value:string;label:string}[]> = {
  main_skill: [{value:'*',label:'Todas as perícias principais'}, ...MAIN_SKILL_CHOICES],
  extra_skill: [{value:'*',label:'Todas as perícias gerais'}],
  archetype_skill: [{value:'*',label:'Todas as perícias de arquétipo'}],
}
for (const [group, entries] of Object.entries(KISATSUTAI_SKILL_GROUPS)) {
  const target = GENERAL_SKILL_GROUPS.has(group) ? 'extra_skill' : 'archetype_skill'
  for (const entry of entries) {
    const skill = entry.name
    if (!skill) continue
    SKILL_CHOICES[target].push({value:`${group}:${skill}`,label:`${group} · ${skill}`})
  }
}
for (const target of ['extra_skill', 'archetype_skill']) {
  const [all, ...rest] = SKILL_CHOICES[target]
  SKILL_CHOICES[target] = [all, ...rest.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))]
}
const labelForConditionKey = (key:string, target?:string) => (target==='main_skill' ? MAIN_SKILL_CHOICES : CONDITION_KEYS[target||''] || Object.values(CONDITION_KEYS).flat()).find(option=>option.value===key.toLowerCase())?.label || (key==='*'?'Todos':key)

/** Arraste pelo título, solte sobre outro cartão: troca somente as duas posições.
 * Pointer events suportam mouse, caneta e toque sem adicionar botões à ficha.
 * O destino é identificado por hit-test real, mesmo com pointer capture. */
function describeEffectInCard(effect:ConditionEffect, definitions:Definition[]):string {
  if(effect.type==='apply_condition'||effect.type==='remove_condition'){
    const target=definitions.find(item=>item.id===effect.condition_id)?.name||'Condição relacionada não localizada'
    return `${effect.type==='remove_condition'?'Remove / impede':'Sugere aplicação de'}: ${target}`
  }
  return describeConditionRule(effect)||'Efeito configurado'
}

function useConditionCardPointerSwap(onSwap:(from:string,to:string)=>void,enabled=true){
  const swapCallback=useRef(onSwap)
  swapCallback.current=onSwap
  const gesture=useRef<{id:string;pointerId:number;x:number;y:number;scope:HTMLElement;moving:boolean}|null>(null)
  const [draggedId,setDraggedId]=useState<string|null>(null)
  const [overId,setOverId]=useState<string|null>(null)
  const clear=()=>{gesture.current=null;setDraggedId(null);setOverId(null)}
  const targetAt=(event:import('react').PointerEvent<HTMLElement>,scope:HTMLElement)=>{
    const hit=document.elementFromPoint(event.clientX,event.clientY)
    const card=hit?.closest<HTMLElement>('[data-condition-swap-id]')
    return card && card.parentElement===scope ? card.dataset.conditionSwapId||null : null
  }
  const bind=(id:string)=>({
    'data-condition-swap-id':id,
    onPointerDown:(event:import('react').PointerEvent<HTMLElement>)=>{
      if(!enabled || gesture.current || (event.pointerType==='mouse'&&event.button!==0))return
      const start=event.target
      if(!(start instanceof Element) || !start.closest('[data-condition-drag-handle]'))return
      const scope=event.currentTarget.parentElement
      if(!scope)return
      gesture.current={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,scope,moving:false}
      try{event.currentTarget.setPointerCapture(event.pointerId)}catch{/* Sem captura: o gesto ainda pode funcionar. */}
    },
    onPointerMove:(event:import('react').PointerEvent<HTMLElement>)=>{
      const current=gesture.current
      if(!current||current.pointerId!==event.pointerId||current.id!==id)return
      if(!current.moving){
        if(Math.hypot(event.clientX-current.x,event.clientY-current.y)<8)return
        current.moving=true
        setDraggedId(id)
      }
      const target=targetAt(event,current.scope)
      setOverId(previous=>previous===(target!==id?target:null)?previous:(target!==id?target:null))
      if(event.cancelable)event.preventDefault()
    },
    onPointerUp:(event:import('react').PointerEvent<HTMLElement>)=>{
      const current=gesture.current
      if(!current||current.pointerId!==event.pointerId||current.id!==id)return
      const destination=current.moving?targetAt(event,current.scope):null
      clear()
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
      if(current.moving&&destination&&destination!==id){
        event.preventDefault()
        swapCallback.current(id,destination)
      }
    },
    onPointerCancel:(event:import('react').PointerEvent<HTMLElement>)=>{
      if(gesture.current?.pointerId===event.pointerId)clear()
    },
  })
  return {bind,draggedId,overId}
}

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
  const [numericDrafts,setNumericDrafts]=useState<Record<string,string>>({})
  const [orderMap,setOrderMap]=useState<Record<string,number>>({})
  // A ordem das aplicações é global e independente da ordem da biblioteca.
  const [activeOrderMap,setActiveOrderMap]=useState<Record<string,number>>({})
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
  const moveCondition=async(kind:'definition'|'character'|'enemy',sourceId:string,destinationId:string,destinationKind:'definition'|'character'|'enemy'=kind)=>{
    if(!master||busy||(kind===destinationKind&&sourceId===destinationId))return
    if(kind==='definition'||destinationKind==='definition'){
      // A biblioteca possui sua ordenação própria, sem alterar condições aplicadas.
      if(kind!=='definition'||destinationKind!=='definition')return
      const definitionsOrdered=sortBySavedOrder(definitions,'definition')
      const ids=definitionsOrdered.map(item=>item.id)
      const from=ids.indexOf(sourceId),to=ids.indexOf(destinationId)
      if(from<0||to<0)return
      ;[ids[from],ids[to]]=[ids[to],ids[from]]
      const previous={...orderMap}
      setOrderMap(current=>{
        const updated={...current}
        ids.forEach((id,index)=>{updated[orderKey('definition',id)]=index+1})
        return updated
      })
      setBusy(true)
      try{
        const result=await supabase.rpc('hax_reorder_conditions',{p_campaign_id:campaignId,p_kind:'definition',p_ids:ids})
        if(result.error){setOrderMap(previous);setError(`Não foi possível salvar a ordem da biblioteca: ${result.error.message}`)}
        else setNotice('A ordem da biblioteca foi atualizada.')
      }catch(err){setOrderMap(previous);setError(err instanceof Error?err.message:'Erro ao ordenar a biblioteca')}
      finally{setBusy(false)}
      return
    }
    // Troca *somente* os dois cartões escolhidos, inclusive entre diferentes
    // personagens e inimigos. Nenhuma outra condição muda de posição.
    const ordered=[
      ...active.map(item=>({...item,targetType:'character' as const})),
      ...enemyActive.map(item=>({...item,targetType:'enemy' as const})),
    ].sort((a,b)=>(activeOrderMap[orderKey(a.targetType,a.id)]??Number.MAX_SAFE_INTEGER)-(activeOrderMap[orderKey(b.targetType,b.id)]??Number.MAX_SAFE_INTEGER))
    const positions=ordered.map(item=>({kind:item.targetType,id:item.id}))
    const from=positions.findIndex(item=>item.kind===kind&&item.id===sourceId)
    const to=positions.findIndex(item=>item.kind===destinationKind&&item.id===destinationId)
    if(from<0||to<0)return
    ;[positions[from],positions[to]]=[positions[to],positions[from]]
    const previous={...activeOrderMap}
    setActiveOrderMap(current=>{
      const updated={...current}
      positions.forEach((item,index)=>{updated[orderKey(item.kind,item.id)]=index+1})
      return updated
    })
    setBusy(true);setError('')
    try{
      const result=await supabase.rpc('hax_reorder_active_conditions_v142',{p_campaign_id:campaignId,p_items:positions})
      if(result.error){
        setActiveOrderMap(previous)
        setError(`Não foi possível salvar a troca de condições. Execute o SQL V143 (inclui a ordenação que faltou na V142). ${result.error.message}`)
      }else setNotice('As duas condições trocaram de posição.')
    }catch(err){setActiveOrderMap(previous);setError(err instanceof Error?err.message:'Erro ao trocar as condições')}
    finally{setBusy(false)}
  }
  const clearDrag=()=>{dragSource.current=null;setDragged(null);setDragOver(null)}
  const acceptsDrop=(source:string,kind:'definition'|'character'|'enemy',id:string)=>
    source!==orderKey(kind,id) && (kind==='definition'?source.startsWith('definition:'):/^(character|enemy):/.test(source))
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
      if(acceptsDrop(source,kind,id))setDragOver(orderKey(kind,id))
    },
    onDragOver:(event:import('react').DragEvent<HTMLElement>)=>{
      const source=dragSource.current||event.dataTransfer.getData('text/plain')
      if(acceptsDrop(source,kind,id)){
        event.preventDefault()
        event.dataTransfer.dropEffect='move'
        if(dragOver!==orderKey(kind,id))setDragOver(orderKey(kind,id))
      }
    },
    onDrop:(event:import('react').DragEvent<HTMLElement>)=>{
      event.preventDefault();event.stopPropagation()
      const source=dragSource.current||event.dataTransfer.getData('text/plain')
      clearDrag()
      if(!acceptsDrop(source,kind,id))return
      const split=source.indexOf(':')
      const sourceKind=source.slice(0,split) as 'definition'|'character'|'enemy'
      void moveCondition(sourceKind,source.slice(split+1),id,kind)
    },
    onDragEnd:clearDrag,
    title:'Arraste sobre outra condição para trocar as posições',
  }:{}
  const explainPolarityError=(error:{message:string}|null, selected:string)=> error && selected==='neutra'
    ? {message:`Não foi possível salvar a natureza Neutra. O Supabase pode estar limitando as opções a Boa/Ruim. Execute o SQL de correção da V91 no SQL Editor e tente novamente. Detalhe: ${error.message}`}
    : error
  const [busy,setBusy]=useState(false)
  const activeCardGesture=useConditionCardPointerSwap((from,to)=>{
    const [fromKind,fromId]=from.split(':')
    const [toKind,toId]=to.split(':')
    if((fromKind==='character'||fromKind==='enemy')&&(toKind==='character'||toKind==='enemy')){
      void moveCondition(fromKind,fromId,toId,toKind)
    }
  },master&&!busy)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const duplicateCondition=async(d:Definition)=>{
    if(!master||busy)return
    setBusy(true);setError('')
    try{
      const created=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:`${d.name} (cópia)`,p_emoji:d.emoji,p_description:d.description,p_severity:d.severity})
      if(created.error)throw created.error
      const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:created.data as string,p_effects:d.effects||[]})
      if(saved.error)throw saved.error
      const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:created.data as string,p_polarity:d.polarity||'ruim'})
      if(classified.error)throw explainPolarityError(classified.error,d.polarity||'ruim')
      await refresh()
    }catch(error){setError(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  const startEditDefinition=(d:Definition)=>{setNumericDrafts({});setEditingDefinition(d.id);setEditName(d.name);setEditEmoji(d.emoji);setEditDescription(d.description);setEditSeverity(d.severity);setEditPolarity(d.polarity||'ruim');setEditEffects(d.effects||[])}
  const [workspace,setWorkspace]=useState<'active'|'apply'|'create'|'library'>('active')
  const [characterFilter,setCharacterFilter]=useState('todos')
  const [filter,setFilter]=useState('')
  const [libraryFilter,setLibraryFilter]=useState('')
  const [librarySeverity,setLibrarySeverity]=useState('todas')
  const [libraryPolarity,setLibraryPolarity]=useState('todas')
  const [libraryExposure,setLibraryExposure]=useState<'todas'|'publicas'|'ocultas'>('todas')
  const [favoritesOnly,setFavoritesOnly]=useState(false)
  const [favoriteIds,setFavoriteIds]=useState<string[]>([])
  useEffect(()=>{
    try {
      const value:unknown=JSON.parse(window.localStorage.getItem(`haxbag.condition-favorites.v145:${campaignId}`)||'[]')
      setFavoriteIds(Array.isArray(value)?value.filter((id):id is string=>typeof id==='string').slice(0,150):[])
    } catch {setFavoriteIds([])}
    setFavoritesOnly(false)
  },[campaignId])
  const toggleFavorite=(id:string)=>{
    const next=favoriteIds.includes(id)?favoriteIds.filter(item=>item!==id):[...favoriteIds,id].slice(0,150)
    setFavoriteIds(next)
    try{window.localStorage.setItem(`haxbag.condition-favorites.v145:${campaignId}`,JSON.stringify(next))}catch{/* A seleção permanece nesta sessão. */}
  }
  const prepareApplication=(definition:string,target?:{id:string;kind:'character'|'enemy'})=>{
    setDefinitionId(definition)
    if(target){setTargetType(target.kind);setCharacterId(target.id)}
    setWorkspace('apply');setError('');setNotice('')
  }
  const [activePolarity,setActivePolarity]=useState('todas')
  const [severityFilter,setSeverityFilter]=useState('todas')
  const [libraryVisibility,setLibraryVisibility]=useState<Record<string,boolean>>({})
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
    const activePositions=await supabase.rpc('hax_list_active_condition_order_v142',{p_campaign_id:campaignId})
    if(!activePositions.error)setActiveOrderMap(Object.fromEntries(((activePositions.data||[]) as {kind:string;id:string;position:number}[]).map(item=>[`${item.kind}:${item.id}`,item.position])))
    else setActiveOrderMap({})
    setDefinitions(((d.data||[]) as Definition[]).map(item=>({...item,effects:((fx.data||[]) as {id:string;effects:ConditionEffect[]}[]).find(row=>row.id===item.id)?.effects||[],polarity:((polarities.data||[]) as {id:string;polarity:string}[]).find(row=>row.id===item.id)?.polarity||'ruim'})))
    setActive((a.data||[]) as Active[])
    setEnemyActive((ea.data||[]) as Active[])
    const visibilityResult=await supabase.rpc('hax_condition_library_visibility',{p_campaign_id:campaignId})
    if(!visibilityResult.error) setLibraryVisibility(Object.fromEntries(((visibilityResult.data||[]) as {id:string;visible_to_players:boolean}[]).map(row=>[row.id,row.visible_to_players])))
    const roundResult=await supabase.rpc('hax_list_condition_rounds',{p_campaign_id:campaignId})
    if(!roundResult.error) setRounds(Object.fromEntries(((roundResult.data||[]) as {assignment_id:string;rounds_remaining:number}[]).map(row=>[row.assignment_id,row.rounds_remaining])))
    setError(visibilityResult.error?`Não foi possível consultar a visibilidade da biblioteca. Execute o SQL V140. ${visibilityResult.error.message}`:'')
  },[campaignId])
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh])
  const effectTypes: {value:ConditionEffect['type'];label:string;hint:string}[] = [
    {value:'modifier',label:'Bônus, penalidade ou concessão de perícia',hint:'Ajusta perícias, crítico, resistências, proteção, reações e outros indicadores. Um crítico mais baixo é melhor. Perícias específicas positivas podem ser concedidas temporariamente.'},
    {value:'dice',label:'Vantagem ou desvantagem',hint:'Altera a quantidade de dados rolados.'},
    {value:'restriction',label:'Bloquear ação ou reação',hint:'Bloqueia totalmente a ação. Para limitar quantidades, use o efeito de bônus ou penalidade na categoria Quantidade de ações.'},
    {value:'resource',label:'Alterar recurso máximo',hint:'Modifica o limite de PV, PS ou PR; não altera permanentemente a ficha.'},
    {value:'periodic_damage',label:'Dano por rodada',hint:'O mestre rola o dano; a aplicação permanece manual.'},
    {value:'round_counter',label:'Contador de rodadas',hint:'O mestre avança o contador; a condição não é removida sozinha.'},
    {value:'apply_condition',label:'Sugerir aplicação de outra condição',hint:'Vínculo informativo; o mestre decide quando aplicar.'},
    {value:'remove_condition',label:'Remover outra condição (em qualquer ordem)',hint:'A remoção é válida nas duas ordens: ao aplicar esta condição, remove a vinculada; se a vinculada for aplicada depois enquanto esta estiver ativa, ela será anulada. Sempre no mesmo alvo e por aplicação manual do mestre.'},
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
        const untrainedSkillCategory=['extra_skill','archetype_skill'].includes(category)
        const unknownKey=Boolean(choices&&effect.key&&!choices.some(option=>option.value===effect.key))
        return <div key={index} className="hb-condition-effect-row">
          <div className="hb-condition-effect-row-header"><strong><span className="hb-condition-effect-index">{index+1}</span> {selected?.label||'Efeito'}</strong><button type="button" className="secondary-button hb-condition-effect-remove" onClick={()=>setItems(items.filter((_,i)=>i!==index))} aria-label={`Remover efeito ${index+1}`}>✕ Remover</button></div>
          <div className="hb-condition-effect-fields">
            <label>Tipo de efeito<select value={effect.type} onChange={e=>setItems(items.map((item,i)=>i===index?defaultEffect(e.target.value as ConditionEffect['type']):item))}>{effectTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            {(['modifier','dice'].includes(effect.type))&&<label>Onde atua<select value={category} onChange={e=>{
              const target=e.target.value
              update(index,{target,key:CONDITION_KEYS[target]?.[0]?.value||(target==='main_skill'||target==='extra_skill'||target==='archetype_skill'?'*':'')})
            }}><option value="status">Atributos</option>{effect.type!=='dice'&&<><option value="main_skill">Perícias principais</option><option value="extra_skill">Perícias gerais</option><option value="archetype_skill">Perícias de arquétipo</option></>}<option value="combat_points">Testes de combate</option>{effect.type!=='dice'&&<><option value="combat_stats">Indicadores de combate (crítico, defesas, proteção)</option><option value="actions">Quantidade de ações</option></>}</select></label>}
            {['modifier','dice','resource'].includes(effect.type)&&<>
              <label>{effect.type==='resource'?'Recurso afetado':customSkill?'Perícia afetada':category==='actions'?'Tipo de ação afetada':'Atributo ou ação afetada'}
                {customSkill?<select value={effect.key||'*'} onChange={e=>update(index,{key:e.target.value})}><option value="" disabled>Escolha a perícia...</option>{(choices||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{effect.key&&!choices?.some(option=>option.value===effect.key)&&<option value={effect.key}>{effect.key} (valor anterior)</option>}</select>:<select value={unknownKey?'__custom__':effect.key||''} onChange={e=>update(index,{key:e.target.value==='__custom__'?'':e.target.value})}><option value="">Selecione...</option>{(choices||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{unknownKey&&<option value="__custom__">Identificador antigo (personalizado)</option>}</select>}
                {unknownKey&&<input value={effect.key||''} onChange={e=>update(index,{key:e.target.value})} aria-label="Identificador antigo" placeholder="Identificador personalizado" />}
              </label>
              <label>{effect.type==='dice'?'Dados adicionais (+ vantagem / − desvantagem)':effect.type==='resource'?'Alteração do limite (+/−)':category==='actions'?'Ações adicionadas (+) ou retiradas (−)':'Pontos adicionados ou subtraídos'}<div style={{display:'flex',gap:8,alignItems:'center'}}><input type="text" maxLength={16} aria-label="Valor do efeito (aceita negativos)" step={effect.unit==='percent'?'0.1':'1'} inputMode="decimal" value={numericDrafts[`${ownId||'new'}:${index}:value`] ?? (Number.isFinite(effect.value) ? String(effect.value) : '')} onChange={e=>{const raw=e.target.value;setNumericDrafts(old=>({...old,[`${ownId||'new'}:${index}:value`]:raw}));update(index,{value:raw.trim()===''||raw==='-'||raw==='.'||raw==='-.'?NaN:Number(raw.replace(',','.'))})}}/>{effect.type!=='dice'&&<select aria-label="Unidade do modificador" value={effect.unit||'flat'} onChange={e=>update(index,{unit:e.target.value as 'flat'|'percent'})}><option value="flat">Pontos</option><option value="percent">%</option></select>}</div></label>
            </>}
            {effect.type==='restriction'&&<label>Ação ou reação bloqueada<select value={effect.key||'dodge'} onChange={e=>update(index,{key:e.target.value})}><option value="dodge">Esquiva</option><option value="counterattack">Contra-ataque</option><option value="block">Bloqueio</option><option value="attack">Ataques</option><option value="movement">Movimento</option></select></label>}
            {effect.type==='periodic_damage'&&<><label>Recurso afetado<select value={effect.key||'pv'} onChange={e=>update(index,{key:e.target.value})}><option value="pv">Pontos de Vida (PV)</option><option value="ps">Pontos de Sanidade (PS)</option><option value="pr">Pontos de Recurso (PR)</option></select></label><label>Dados de dano<input value={effect.dice||''} onChange={e=>update(index,{dice:e.target.value})} placeholder="Ex.: 1d6" /></label></>}
            {effect.type==='round_counter'&&<label>Quantidade inicial de rodadas<input type="number" min="1" max="999" step="1" value={effect.value??3} onChange={e=>update(index,{value:e.target.value===''?NaN:Number(e.target.value)})}/></label>}
            {['apply_condition','remove_condition'].includes(effect.type)&&<label>Condição relacionada<select value={effect.condition_id||''} onChange={e=>update(index,{condition_id:e.target.value})}><option value="">Selecione...</option>{definitions.filter(d=>d.id!==ownId).map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label>}
          </div>
          <small className="hb-condition-effect-help">{selected?.hint}{effect.type==='modifier'&&untrainedSkillCategory&&effect.key!=='*'&&effect.key?' · Um bônus positivo concede temporariamente esta perícia mesmo se não estiver treinada na ficha. Ela desaparece ao retirar a condição.':''}</small>
        </div>
      })}
      {issue&&<p className="hb-condition-effect-validation" role="status">⚠️ {issue}</p>}
      <button type="button" className="secondary-button hb-condition-effect-add" onClick={()=>setItems([...items,defaultEffect('modifier')])}>＋ Adicionar efeito</button>
    </section>
  }
  const filteredDefinitions=sortBySavedOrder(definitions,'definition').filter(d=>(!favoritesOnly||favoriteIds.includes(d.id))&&(librarySeverity==='todas'||d.severity===librarySeverity)&&(libraryPolarity==='todas'||(d.polarity||'ruim')===libraryPolarity)&&(libraryExposure==='todas'||(libraryExposure==='publicas'?libraryVisibility[d.id]!==false:libraryVisibility[d.id]===false))&&`${d.name} ${d.description} ${d.severity}`.toLocaleLowerCase().includes(libraryFilter.toLocaleLowerCase()))
  const allActive=[...active.map(a=>({...a,targetType:'character' as const})),...enemyActive.map(a=>({...a,targetType:'enemy' as const}))]
    .sort((a,b)=>(activeOrderMap[orderKey(a.targetType,a.id)]??Number.MAX_SAFE_INTEGER)-(activeOrderMap[orderKey(b.targetType,b.id)]??Number.MAX_SAFE_INTEGER))
  const targets=[...characters.map(c=>({...c,targetType:'character' as const})),...enemies.map(e=>({...e,targetType:'enemy' as const}))]
  const targetName=(a:{character_id:string;targetType:'character'|'enemy'})=>targets.find(t=>t.id===a.character_id&&t.targetType===a.targetType)?.name||'Alvo removido'
  const targetSummary=targets.map(target=>{
    const assignments=allActive.filter(item=>item.targetType===target.targetType&&item.character_id===target.id)
    return {...target,count:assignments.length,critical:assignments.filter(item=>item.severity==='critica').length,bad:assignments.filter(item=>definitions.find(def=>def.id===item.definition_id)?.polarity==='ruim').length}
  }).filter(item=>item.count>0).sort((a,b)=>b.critical-a.critical||b.count-a.count||a.name.localeCompare(b.name,'pt-BR'))
  const criticalCount=allActive.filter(item=>item.severity==='critica').length
  const favoriteDefinitions=favoriteIds.map(id=>definitions.find(d=>d.id===id)).filter((value):value is Definition=>Boolean(value))
  const selectedDefinition=definitions.find(d=>d.id===definitionId)
  const activeOnSelectedTarget=allActive.filter(item=>item.targetType===targetType&&item.character_id===characterId)
  const blockingConditions=definitionId?activeOnSelectedTarget.filter(item=>definitions.find(d=>d.id===item.definition_id)?.effects?.some(e=>e.type==='remove_condition'&&e.condition_id===definitionId)):[]
  const removedBySelected=selectedDefinition?.effects?.filter(e=>e.type==='remove_condition').flatMap(e=>activeOnSelectedTarget.filter(item=>item.definition_id===e.condition_id))||[]
  const visibleActive=allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(activePolarity==='todas'||(definitions.find(d=>d.id===a.definition_id)?.polarity||'ruim')===activePolarity)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
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
  // O mestre escolhe quando aplicar; vínculos de remoção são executados no MESMO alvo.
  // Nenhuma condição é removida em segundo plano nem pelo jogador.
  const applyWithRemovals=async()=>{
    const result=await supabase.rpc('hax_apply_condition_with_links',{
      p_campaign_id:campaignId,p_target_type:targetType,p_target_id:characterId,
      p_definition_id:definitionId,p_duration_label:rollDuration(),p_notes:notes.trim()||null,
    })
    if(result.error)return {error:{message:`${result.error.message}. Confira se as migrações V140 e V141 foram executadas.`}}
    const removed=Number(result.data||0)
    const linked=(definitions.find(d=>d.id===definitionId)?.effects||[]).some(e=>e.type==='remove_condition')
    setNotice(removed===-1
      ? 'Aplicação anulada: outra condição já ativa neste alvo remove a condição selecionada. A condição anterior foi preservada.'
      : linked
        ? (removed>0?`Condição aplicada; ${removed} condição(ões) vinculada(s) removida(s).`:'Condição aplicada; o alvo não tinha a condição vinculada para remover.')
        : 'Condição aplicada ao alvo.')
    setDuration('');setNotes('');setWorkspace('active')
    return {error:null}
  }
  const updateLibraryVisibility=async(id:string,next:boolean)=>{
    if(!master||busy)return
    setBusy(true);setError('')
    const previous=libraryVisibility[id]??true
    setLibraryVisibility(state=>({...state,[id]:next}))
    try{
      const result=await supabase.rpc('hax_set_condition_library_visibility',{p_campaign_id:campaignId,p_definition_id:id,p_visible:next})
      if(result.error)throw new Error(result.error.message)
      setNotice(next?'Condição publicada na biblioteca dos jogadores.':'Condição oculta da biblioteca dos jogadores.')
    }catch(e){setLibraryVisibility(state=>({...state,[id]:previous}));setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const execute=async(fn:()=>Promise<{error: {message:string}|null}>)=>{
    setBusy(true);setError('')
    try{const result=await fn();if(result.error)throw new Error(result.error.message);await refresh()}
    catch(e){setError(e instanceof Error?e.message:String(e));await refresh()}
    finally{setBusy(false)}
  }
  return <section className="hb-conditions-panel hb-conditions-v144 hb-conditions-v145">
    <header className="hb-conditions-hero">
      <div className="hb-conditions-hero-copy">
        <span className="hb-conditions-eyebrow">✧ MESA DO MESTRE / SISTEMA DE CONDIÇÕES</span>
        <h2><span className="hb-conditions-hero-symbol">◈</span> Condições <em>&amp; efeitos</em></h2>
        <p>Controle os estados da campanha, consulte a biblioteca e configure os efeitos das fichas em um único lugar.</p>
        <div className="hb-v144-hero-markers"><span>◉ Aplicação manual</span><span>◇ Biblioteca com privacidade</span><span>✦ Efeitos vinculados</span></div>
      </div>
      <div className="hb-conditions-hero-actions">
        {master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('apply')}>◎ Aplicar condição</button>}
        {master&&<button type="button" className="secondary-button" onClick={()=>setWorkspace('create')}>＋ Criar nova</button>}
        <button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={busy}>↻ Atualizar</button>
      </div>
    </header>
    {error&&<div className="hb-condition-inline-error" role="alert">Não foi possível concluir a operação: {error}</div>}
    {notice&&<div className="hb-condition-notice" role="status">✓ {notice}</div>}
    <div className="hb-conditions-stats" aria-label="Resumo das condições da campanha">
      <div className="hb-v144-stat"><span className="hb-v144-stat-icon" aria-hidden="true">◈</span><span>Condições ativas</span><strong>{allActive.length}</strong><small>Aplicações em personagens e inimigos</small></div>
      <div className="hb-v144-stat"><span className="hb-v144-stat-icon" aria-hidden="true">◎</span><span>Alvos afetados</span><strong>{new Set(allActive.map(a=>`${a.targetType}:${a.character_id}`)).size}</strong><small>Personagens e inimigos distintos</small></div>
      <div className="hb-v144-stat"><span className="hb-v144-stat-icon" aria-hidden="true">▤</span><span>Catálogo</span><strong>{definitions.length}</strong><small>{definitions.filter(d=>libraryVisibility[d.id]!==false).length} públicas · {definitions.filter(d=>libraryVisibility[d.id]===false).length} ocultas</small></div>
    </div>
    
    {master&&<section className="hb-v145-situation" aria-label="Atenção e foco por alvo">
      <div className="hb-v145-situation-head"><div><span className="hb-conditions-eyebrow">RADAR DA CAMPANHA</span><h3>O que precisa de atenção</h3><p>Visualize estados críticos e concentre o acompanhamento nos alvos afetados.</p></div><div className={`hb-v145-critical-count ${criticalCount>0?'has-critical':''}`}><strong>{criticalCount}</strong><span>Crítica{criticalCount===1?'':'s'} ativa{criticalCount===1?'':'s'}</span></div></div>
      <div className="hb-v145-targets" aria-label="Alvos com condições">
        {targetSummary.length?targetSummary.slice(0,9).map(target=><button key={`${target.targetType}:${target.id}`} type="button" className={`hb-v145-target ${characterFilter===`${target.targetType}:${target.id}`&&workspace==='active'?'is-selected':''}`} onClick={()=>{setWorkspace('active');setCharacterFilter(`${target.targetType}:${target.id}`);setSeverityFilter('todas');setActivePolarity('todas');setFilter('')}}><span className="hb-v145-target-icon">{target.targetType==='enemy'?'👹':target.emoji||'♙'}</span><span className="hb-v145-target-copy"><strong>{target.name}</strong><small>{target.count} {target.count===1?'condição':'condições'}{target.critical>0?` · ${target.critical} crítica${target.critical===1?'':'s'}`:''}</small></span><span className="hb-v145-target-count">{target.count}</span></button>):<div className="hb-v145-no-targets">✧ Sem alvos afetados. A campanha está livre de condições ativas.</div>}
      </div>
      {criticalCount>0&&<button className="hb-v145-critical-action" type="button" onClick={()=>{setWorkspace('active');setCharacterFilter('todos');setFilter('');setSeverityFilter('critica');setActivePolarity('todas')}}>✹ Examinar as {criticalCount} {criticalCount===1?'condição crítica':'condições críticas'} <span aria-hidden="true">↗</span></button>}
    </section>}
    <div className="hb-conditions-overview" aria-label="Resumo por natureza"><span className="hb-condition-overview-label">Panorama da campanha</span><span className="hb-condition-overview-chip is-beneficial">✦ {allActive.filter(a=>definitions.find(d=>d.id===a.definition_id)?.polarity==='boa').length} benéficas</span><span className="hb-condition-overview-chip is-neutral">◈ {allActive.filter(a=>definitions.find(d=>d.id===a.definition_id)?.polarity==='neutra').length} neutras</span><span className="hb-condition-overview-chip is-harmful">◆ {allActive.filter(a=>definitions.find(d=>d.id===a.definition_id)?.polarity==='ruim').length} prejudiciais</span><span className="hb-condition-overview-chip">◈ {allActive.filter(a=>a.severity==='critica').length} críticas</span><small>Aplicação e remoção sempre controladas pelo mestre</small></div>

    <nav className="hb-condition-tabs" aria-label="Seções das condições">
      <button type="button" aria-current={workspace==='active'?'page':undefined} className={workspace==='active'?'is-active':''} onClick={()=>setWorkspace('active')}><span aria-hidden="true">◉</span> Ativas <span className="hb-v144-tab-count">{allActive.length}</span></button>
      {master&&<button type="button" aria-current={workspace==='apply'?'page':undefined} className={workspace==='apply'?'is-active':''} onClick={()=>setWorkspace('apply')}><span aria-hidden="true">◎</span> Aplicar</button>}
      {master&&<button type="button" aria-current={workspace==='library'?'page':undefined} className={workspace==='library'?'is-active':''} onClick={()=>setWorkspace('library')}><span aria-hidden="true">▤</span> Biblioteca <span className="hb-v144-tab-count">{definitions.length}</span></button>}
      {master&&<button type="button" aria-current={workspace==='create'?'page':undefined} className={workspace==='create'?'is-active':''} onClick={()=>setWorkspace('create')}><span aria-hidden="true">✦</span> Criar</button>}
    </nav>
    <div className="hb-v144-workspace-heading" aria-live="polite"><div><span className="hb-conditions-eyebrow">{workspace==='active'?'01 / MONITORAMENTO':workspace==='apply'?'02 / APLICAÇÃO':workspace==='library'?'03 / ACERVO':'04 / CRIAÇÃO'}</span><h3>{workspace==='active'?'Situação atual da campanha':workspace==='apply'?'Preparar uma aplicação':workspace==='library'?'Catálogo de condições':'Criar uma nova condição'}</h3><p>{workspace==='active'?'Acompanhe os alvos afetados e ajuste manualmente os efeitos em andamento.':workspace==='apply'?'Escolha o alvo e confira os detalhes da condição antes de confirmar.':workspace==='library'?'Encontre, edite e defina o que os jogadores poderão consultar.':'Configure identidade, natureza, gravidade e efeitos vinculados.'}</p></div><span className="hb-v144-workspace-seal" aria-hidden="true">{workspace==='active'?'◈':workspace==='apply'?'◎':workspace==='library'?'▤':'✧'}</span></div>
    {master&&workspace==='apply'&&favoriteDefinitions.length>0&&<div className="hb-v145-quick-apply" aria-label="Condições favoritas para aplicação"><span>★ ACESSO RÁPIDO</span><div>{favoriteDefinitions.map(def=><button type="button" key={def.id} className={definitionId===def.id?'is-selected':''} onClick={()=>setDefinitionId(def.id)}>{def.emoji} {def.name}</button>)}</div></div>}
    {master&&(workspace==='create'||workspace==='apply')&&<div className="hb-conditions-grid hb-conditions-single">
      <form style={{display:workspace==='create'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{const invalid=validateEffects(newEffects);if(invalid)throw new Error(invalid);const r=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:name.trim(),p_emoji:emoji.trim()||'✨',p_description:description.trim(),p_severity:severity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:r.data as string,p_effects:newEffects});if(saved.error)return saved;const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:r.data as string,p_polarity:polarity});if(classified.error)return {error:explainPolarityError(classified.error,polarity)};setName('');setDescription('');setNewEffects([]);setWorkspace('library')}return r})}}>
        <div className="hb-condition-form-intro"><span className="hb-condition-form-icon">✦</span><div><h3>Criar condição</h3><p>Defina a identidade, a gravidade e os efeitos. Você poderá editar tudo depois.</p></div></div><label>Nome<input required maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Envenenado" /></label><label>Emoji<input maxLength={12} value={emoji} onChange={e=>setEmoji(e.target.value)} /></label><label>Natureza<select value={polarity} onChange={event=>setPolarity(event.target.value)}><option value="boa">Boa</option><option value="neutra">Neutra</option><option value="ruim">Ruim</option></select></label><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Descreva os efeitos..." /></label>{effectEditor(newEffects,setNewEffects)}<button className="primary-button" disabled={busy||!name.trim()}>Criar condição</button>
      </form>
      <form style={{display:workspace==='apply'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{return applyWithRemovals()})}}>
        <div className="hb-condition-form-intro"><span className="hb-condition-form-icon">◎</span><div><h3>Aplicar condição</h3><p>Escolha o alvo e a condição. A duração e as observações são opcionais.</p></div></div><label>Tipo de alvo<select value={targetType} onChange={e=>{setTargetType(e.target.value as 'character'|'enemy');setCharacterId('')}}><option value="character">Personagem</option><option value="enemy">Inimigo</option></select></label><label>{targetType==='enemy'?'Inimigo':'Personagem'}<select required value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Selecione...</option>{targets.filter(t=>t.targetType===targetType).map(t=><option key={`${t.targetType}:${t.id}`} value={t.id}>{t.targetType==='enemy'?'👹':'🧑'} {t.emoji||''} {t.name}</option>)}</select></label><label>Condição<select required value={definitionId} onChange={e=>setDefinitionId(e.target.value)}><option value="">Selecione...</option>{favoriteDefinitions.length>0&&<optgroup label="★ Favoritas">{favoriteDefinitions.map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</optgroup>}<optgroup label="Catálogo">{definitions.filter(d=>!favoriteIds.includes(d.id)).map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</optgroup></select></label><label>Tipo de duração<select value={durationMode} onChange={event=>setDurationMode(event.target.value as typeof durationMode)}><option value="indeterminada">Indeterminada</option><option value="fixa">Fixa</option><option value="dado">Definida por dado</option></select></label>{durationMode==='fixa'&&<label>Duração fixa<input value={duration} onChange={event=>setDuration(event.target.value)} placeholder="Ex.: 3 rodadas / até o fim da cena" /></label>}{durationMode==='dado'&&<label>Dado de duração<select value={durationDice} onChange={event=>setDurationDice(event.target.value)}>{['1d4','1d6','1d8','1d10','1d12','1d20','2d6'].map(d=><option key={d} value={d}>{d}</option>)}</select></label>}<label>Observação<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" /></label><button className="primary-button" disabled={busy||!characterId||!definitionId}>Aplicar condição</button>
      </form>
      {workspace==='create'&&<aside className="hb-v144-form-preview" aria-label="Prévia da nova condição">
        <span className="hb-conditions-eyebrow">PRÉVIA EM TEMPO REAL</span>
        <div className="hb-v144-preview-glyph" aria-hidden="true">{emoji.trim()||'✧'}</div>
        <h3>{name.trim()||'Nome da condição'}</h3>
        <div className="hb-v144-preview-labels"><span>{polarity==='boa'?'✦ Boa':polarity==='neutra'?'◈ Neutra':'◆ Ruim'}</span><span>{severity==='critica'?'Crítica':severity==='grave'?'Grave':'Normal'}</span></div>
        <p>{description.trim()||'A descrição da condição será apresentada aos jogadores afetados e na biblioteca, quando publicada.'}</p>
        <div className="hb-v144-preview-divider"/><strong>{newEffects.length} efeito{newEffects.length===1?'':'s'} configurado{newEffects.length===1?'':'s'}</strong>
        <small>Os efeitos passam a valer nas fichas quando o mestre aplicar a condição.</small>
      </aside>}
      {workspace==='apply'&&<aside className="hb-v144-form-preview" aria-label="Resumo da aplicação">
        <span className="hb-conditions-eyebrow">CONFERÊNCIA DA APLICAÇÃO</span>
        <div className="hb-v144-preview-glyph" aria-hidden="true">{definitions.find(d=>d.id===definitionId)?.emoji||'◎'}</div>
        <h3>{definitions.find(d=>d.id===definitionId)?.name||'Selecione uma condição'}</h3>
        <div className="hb-v144-preview-labels"><span>{targetType==='enemy'?'Inimigo':'Personagem'}</span><span>{durationMode==='indeterminada'?'Sem prazo definido':durationMode==='dado'?durationDice:'Duração fixa'}</span></div>
        <p>{definitions.find(d=>d.id===definitionId)?.description||'Selecione uma condição na lista para visualizar sua descrição.'}</p>
        {selectedDefinition&&<div className="hb-v145-effect-preview"><strong>Como esta condição atua</strong>{selectedDefinition.effects?.length?<ul>{selectedDefinition.effects.map((effect,index)=><li key={index}>{describeEffectInCard(effect,definitions)}</li>)}</ul>:<span>Nenhum modificador adicional configurado.</span>}</div>}
        {blockingConditions.length>0&&<div className="hb-v145-conflict is-blocked" role="status"><strong>⛨ Aplicação será anulada</strong><span>{blockingConditions.map(item=>item.name).join(', ')} já {blockingConditions.length===1?'remove':'removem'} esta condição neste alvo.</span></div>}
        {blockingConditions.length===0&&removedBySelected.length>0&&<div className="hb-v145-conflict"><strong>◇ Remoção vinculada</strong><span>Esta aplicação removerá: {removedBySelected.map(item=>item.name).join(', ')}.</span></div>}
        <div className="hb-v144-preview-divider"/><strong>Alvo: {targets.find(t=>t.id===characterId&&t.targetType===targetType)?.name||'Não selecionado'}</strong>
        <small>A aplicação e as remoções vinculadas só ocorrem após a confirmação do mestre.</small>
      </aside>}
    </div>}
    {workspace==='active'&&<div className="hb-condition-card hb-conditions-wide"><div className="hb-conditions-section-head"><div><h3>📋 Condições ativas</h3><small>Arraste pelo nome de uma condição e solte sobre outra para trocar apenas as duas posições. Funciona também por toque.</small></div><input aria-label="Buscar condição ou personagem" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar personagem ou condição..." /></div><div className="hb-conditions-filter-row"><label>Alvo <select value={characterFilter} onChange={e=>setCharacterFilter(e.target.value)}><option value="todos">Todos os alvos</option>{characters.map(c=><option key={c.id} value={`character:${c.id}`}>{c.emoji||'🧑'} {c.name}</option>)}{enemies.map(e=><option key={e.id} value={`enemy:${e.id}`}>👹 {e.name}</option>)}</select></label><label>Gravidade <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Natureza <select value={activePolarity} onChange={e=>setActivePolarity(e.target.value)}><option value="todas">Todas</option><option value="boa">Boas</option><option value="neutra">Neutras</option><option value="ruim">Ruins</option></select></label><span aria-live="polite">{visibleActive.length} resultado(s)</span>{(filter||characterFilter!=='todos'||severityFilter!=='todas'||activePolarity!=='todas')&&<button type="button" className="secondary-button hb-conditions-clear" onClick={()=>{setFilter('');setCharacterFilter('todos');setSeverityFilter('todas');setActivePolarity('todas')}}>Limpar filtros</button>}</div>{allActive.length===0?<div className="hb-conditions-empty"><span>✧</span><strong>Nenhuma condição ativa</strong><p>Quando uma condição for aplicada, ela aparecerá aqui.</p>{master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('apply')}>Aplicar condição</button>}</div>:<div className="hb-conditions-active">{visibleActive.length===0&&<div className="hb-conditions-filter-empty">Nenhuma condição corresponde aos filtros. <button type="button" className="secondary-button" onClick={()=>{setFilter('');setCharacterFilter('todos');setSeverityFilter('todas');setActivePolarity('todas')}}>Limpar filtros</button></div>}{visibleActive.map(a=><article key={a.id} {...activeCardGesture.bind(orderKey(a.targetType,a.id))} className={`hb-conditions-entry severity-${a.severity} ${activeCardGesture.draggedId===orderKey(a.targetType,a.id)?'hb-condition-dragging':''} ${activeCardGesture.overId===orderKey(a.targetType,a.id)?'hb-condition-drop-target':''}`}><div className="hb-v144-active-content"><div className="hb-v144-entry-heading"><span className="hb-v144-active-emoji" aria-hidden="true">{a.emoji||'✧'}</span><strong data-condition-drag-handle="true" className="hb-condition-entry-title">{a.name}</strong></div><div className="hb-v149-condition-tags"><span className="hb-v144-target-tag">{a.targetType==='enemy'?'☠ INIMIGO':'♙ PERSONAGEM'} · {targetName(a)}</span><span className={`hb-condition-polarity ${definitions.find(d=>d.id===a.definition_id)?.polarity==='boa'?'good':definitions.find(d=>d.id===a.definition_id)?.polarity==='neutra'?'neutral':'bad'}`}>{definitions.find(d=>d.id===a.definition_id)?.polarity==='boa'?'✦ Boa':definitions.find(d=>d.id===a.definition_id)?.polarity==='neutra'?'◈ Neutra':'◆ Ruim'}</span><span className={`hb-conditions-severity severity-${a.severity}`}>{a.severity==='critica'?'Crítica':a.severity==='grave'?'Grave':'Normal'}</span></div><small>{targetName(a)} · {a.duration_label||'Sem duração definida'}</small>{(a.description||definitions.find(d=>d.id===a.definition_id)?.description)&&<p className="hb-v144-active-description">{a.description||definitions.find(d=>d.id===a.definition_id)?.description}</p>}{a.notes&&<small className="hb-v145-application-note">✎ {a.notes}</small>}{Boolean(definitions.find(d=>d.id===a.definition_id)?.effects?.length)&&<details className="hb-v145-active-details"><summary>⚙ Entender efeitos · {definitions.find(d=>d.id===a.definition_id)?.effects?.length} <span aria-hidden="true">⌄</span></summary><ul>{definitions.find(d=>d.id===a.definition_id)?.effects?.map((effect,index)=><li key={index}>{describeEffectInCard(effect,definitions)}</li>)}</ul></details>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<small>⏳ Rodadas restantes: {rounds[a.id]??'não iniciadas'}</small>}{rollLog[a.id]&&<small role="status">🎲 {rollLog[a.id]} — aplique o dano manualmente</small>}</div>{master&&<div className="hb-condition-actions">{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>advanceRound(a,a.targetType)}>⏳ Avançar rodada</button>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='periodic_damage')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>rollPeriodic(a)}>🎲 Rolar dano</button>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>prepareApplication('',{kind:a.targetType,id:a.character_id})}>＋ Aplicar neste alvo</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{const d=definitions.find(d=>d.id===a.definition_id);if(d)startEditDefinition(d)}}>✎ Editar modelo</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEditingAssignment(`${a.targetType}:${a.id}`);setEditDuration(a.duration_label||'');setEditNotes(a.notes||'')}}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void execute(async()=>a.targetType==='enemy'?supabase.rpc('hax_remove_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}):supabase.rpc('hax_remove_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}))}>Remover</button></div>}</article>)}</div>}</div>}
    {master&&workspace==='library'&&<div className="hb-condition-card"><div className="hb-conditions-section-head"><div><h3>📚 Biblioteca de condições</h3><small>O mestre decide quais condições aparecem na biblioteca dos jogadores</small></div><span className="hb-conditions-count">{definitions.length} cadastradas</span></div><label className="hb-conditions-library-search">Buscar na biblioteca<input aria-label="Buscar condições cadastradas" value={libraryFilter} onChange={e=>setLibraryFilter(e.target.value)} placeholder="Nome, descrição ou gravidade..." /></label><div className="hb-v144-library-summary"><span><i aria-hidden="true"/> {definitions.filter(d=>libraryVisibility[d.id]!==false).length} publicadas</span><span><i aria-hidden="true"/> {definitions.filter(d=>libraryVisibility[d.id]===false).length} ocultas</span><span>◆ {definitions.filter(d=>d.severity==='critica').length} críticas</span></div><div className="hb-v145-library-view"><button type="button" aria-pressed={!favoritesOnly} className={!favoritesOnly?'is-active':''} onClick={()=>setFavoritesOnly(false)}>Todas as condições <span>{definitions.length}</span></button><button type="button" aria-pressed={favoritesOnly} className={favoritesOnly?'is-active':''} onClick={()=>setFavoritesOnly(true)}>★ Favoritas <span>{favoriteDefinitions.length}</span></button><small>Favoritos são atalhos pessoais neste navegador; não alteram a biblioteca dos jogadores.</small></div><div className="hb-conditions-library-tools"><label>Visibilidade<select value={libraryExposure} onChange={e=>setLibraryExposure(e.target.value as typeof libraryExposure)}><option value="todas">Todas</option><option value="publicas">Publicadas</option><option value="ocultas">Ocultas</option></select></label><label>Gravidade<select value={librarySeverity} onChange={e=>setLibrarySeverity(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Natureza<select value={libraryPolarity} onChange={e=>setLibraryPolarity(e.target.value)}><option value="todas">Todas</option><option value="boa">Boas</option><option value="neutra">Neutras</option><option value="ruim">Ruins</option></select></label><span aria-live="polite">{filteredDefinitions.length} de {definitions.length} condições</span>{(libraryFilter||librarySeverity!=='todas'||libraryPolarity!=='todas'||libraryExposure!=='todas'||favoritesOnly)&&<button type="button" className="secondary-button" onClick={()=>{setLibraryFilter('');setLibrarySeverity('todas');setLibraryPolarity('todas');setLibraryExposure('todas');setFavoritesOnly(false)}}>Limpar filtros</button>}</div><div className="hb-condition-library">{definitions.length>0&&filteredDefinitions.length===0&&<div className="hb-conditions-filter-empty">Nenhuma condição encontrada com esses filtros.</div>}{definitions.length===0&&<p className="hb-conditions-empty">Nenhuma condição cadastrada. Use a aba Criar para adicionar uma.</p>}{filteredDefinitions.map(d=><div key={d.id} {...dragProps('definition',d.id)} className={`hb-condition-library-item severity-${d.severity} ${dragged===orderKey('definition',d.id)?'hb-condition-dragging':''} ${dragOver===orderKey('definition',d.id)?'hb-condition-drop-target':''}`}><div className="hb-v144-definition-head"><span className="hb-v144-definition-icon" aria-hidden="true">{d.emoji||'✦'}</span><div><strong>{d.name}</strong><small>{libraryVisibility[d.id]!==false?'● Publicada para jogadores':'◌ Oculta da biblioteca pública'}</small></div><button type="button" className={`hb-v145-favorite ${favoriteIds.includes(d.id)?'is-favorite':''}`} aria-pressed={favoriteIds.includes(d.id)} aria-label={`${favoriteIds.includes(d.id)?'Remover':'Adicionar'} ${d.name} ${favoriteIds.includes(d.id)?'dos':'aos'} favoritos`} title={favoriteIds.includes(d.id)?'Remover dos favoritos':'Adicionar aos favoritos'} onClick={()=>toggleFavorite(d.id)}>{favoriteIds.includes(d.id)?'★':'☆'}</button></div><span className={`hb-condition-polarity ${d.polarity==='boa'?'good':d.polarity==='neutra'?'neutral':'bad'}`}>{d.polarity==='boa'?'✦ Boa':d.polarity==='neutra'?'◈ Neutra':'◆ Ruim'}</span><span className={`hb-conditions-severity severity-${d.severity}`}>{d.severity==='critica'?'Crítica':d.severity==='grave'?'Grave':'Normal'}</span><small>{d.description||'Sem descrição'}</small><details className="hb-v144-effect-details"><summary>⚙ {(d.effects||[]).length} efeito(s) configurado(s) <span aria-hidden="true">⌄</span></summary><div>{(d.effects||[]).length ? (d.effects||[]).map((effect,index)=><p key={index}>{index+1}. {describeEffectInCard(effect,definitions)}</p>):<p>Nenhum efeito adicional configurado.</p>}</div></details>
    <label className="hb-condition-visibility" title="Ocultar somente desta biblioteca; condições já aplicadas continuam visíveis aos jogadores afetados">
      <input type="checkbox" checked={libraryVisibility[d.id]!==false} disabled={busy} onChange={e=>void updateLibraryVisibility(d.id,e.target.checked)}/>
      <span>{libraryVisibility[d.id]!==false?'Visível aos jogadores':'Oculta dos jogadores'}</span>
    </label>
    <div className="hb-condition-actions"><button type="button" className="primary-button" disabled={busy||targets.length===0} onClick={()=>prepareApplication(d.id)}>◎ Aplicar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>startEditDefinition(d)}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void duplicateCondition(d)}>📋 Copiar</button><button type="button" className="secondary-button" disabled={busy||allActive.some(a=>a.definition_id===d.id)} onClick={()=>void execute(async()=>supabase.rpc('hax_delete_condition',{p_campaign_id:campaignId,p_definition_id:d.id}))}>Excluir</button></div></div>)}</div></div>}
    {master&&editingDefinition&&<div className="hb-condition-modal-backdrop" role="presentation"><form className="hb-condition-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();const id=editingDefinition;void execute(async()=>{const invalid=validateEffects(editEffects,id);if(invalid)throw new Error(invalid);const r=await supabase.rpc('hax_update_condition',{p_campaign_id:campaignId,p_definition_id:id,p_name:editName.trim(),p_emoji:editEmoji.trim()||'✨',p_description:editDescription.trim(),p_severity:editSeverity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:id,p_effects:editEffects});if(saved.error)return saved;const classified=await supabase.rpc('hax_set_condition_polarity',{p_campaign_id:campaignId,p_definition_id:id,p_polarity:editPolarity});if(classified.error)return {error:explainPolarityError(classified.error,editPolarity)};setEditingDefinition(null)}return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição</h3><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>✕</button></div><label>Nome<input required maxLength={70} value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Emoji<input maxLength={12} value={editEmoji} onChange={e=>setEditEmoji(e.target.value)}/></label><label>Natureza<select value={editPolarity} onChange={event=>setEditPolarity(event.target.value)}><option value="boa">Boa</option><option value="neutra">Neutra</option><option value="ruim">Ruim</option></select></label><label>Gravidade<select value={editSeverity} onChange={e=>setEditSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea rows={4} value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>{effectEditor(editEffects,setEditEffects,editingDefinition)}<div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>Cancelar</button><button className="primary-button" disabled={busy||!editName.trim()}>Salvar alterações</button></div></form></div>}
    {master&&editingAssignment&&<div className="hb-condition-modal-backdrop" role="presentation"><form className="hb-condition-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();const [kind,id]=editingAssignment.split(':');void execute(async()=>{const r=kind==='enemy'?await supabase.rpc('hax_update_active_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null}):await supabase.rpc('hax_update_active_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null});if(!r.error)setEditingAssignment(null);return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição aplicada</h3><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>✕</button></div><label>Duração<input maxLength={120} value={editDuration} onChange={e=>setEditDuration(e.target.value)} placeholder="Ex.: 3 turnos"/></label><label>Observações<textarea rows={3} maxLength={500} value={editNotes} onChange={e=>setEditNotes(e.target.value)}/></label><div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>Cancelar</button><button className="primary-button" disabled={busy}>Salvar alterações</button></div></form></div>}
  </section>
}
type ConditionPolarity = 'good' | 'bad' | 'neutral'
const getConditionPolarity = (definition:Definition|undefined):ConditionPolarity => definition?.polarity==='boa'?'good':definition?.polarity==='ruim'?'bad':'neutral'
const conditionPolarityName:Record<ConditionPolarity,string>={good:'Benéfica',bad:'Prejudicial',neutral:'Neutra'}
const conditionPolarityIcon:Record<ConditionPolarity,string>={good:'✦',bad:'◆',neutral:'◈'}
const conditionSeverityName:Record<string,string>={normal:'Normal',grave:'Grave',critica:'Crítica'}
const conditionSeverityIcon:Record<string,string>={normal:'●',grave:'▲',critica:'✹'}
const conditionRuleIcon:Record<string,string>={dice:'⚄',restriction:'⛨',resource:'◉',periodic_damage:'⚔',round_counter:'⌛'}
const conditionTargetLabels:Record<string,string>={status:'Status',main_skill:'Perícia principal',extra_skill:'Perícia geral',archetype_skill:'Perícia de arquétipo',combat_points:'Pontos de combate',resource:'Recurso'}
function formatConditionTargetKey(raw:string,target?:string){
  const value=raw.trim()
  if(!value.includes(':')) return labelForConditionKey(value,target)
  const split=value.split(':')
  const group=split.shift()||''
  const skill=split.join(':')
  const actualGroup=Object.keys(KISATSUTAI_SKILL_GROUPS).find(k=>k.toLocaleLowerCase('pt-BR')===group.toLocaleLowerCase('pt-BR'))
  return `${actualGroup||group.charAt(0).toLocaleUpperCase('pt-BR')+group.slice(1)} · ${skill.charAt(0).toLocaleUpperCase('pt-BR')+skill.slice(1)}`
}

function describeConditionRule(effect:ConditionEffect){
  if(effect.type==='modifier'){
    const amount = `${(effect.value||0)>0?'+':''}${effect.value||0}${effect.unit==='percent'?'%':''}`
    const target = conditionTargetLabels[effect.target||'status']||'Atributo'
    const skillGrant = (effect.target==='extra_skill'||effect.target==='archetype_skill')&&effect.key!=='*'&&(effect.value||0)>0
    return `${amount} em ${target} · ${formatConditionTargetKey(effect.key||'*',effect.target)}${skillGrant?' (concede temporariamente se não treinada)':''}`
  }
  if(effect.type==='dice'){
    const alvo=conditionTargetLabels[effect.target||'status']||effect.target||'Status'
    return `${(effect.value||0)>0?'+':''}${effect.value||0} dado(s) em ${alvo}${effect.key?` · ${formatConditionTargetKey(effect.key,effect.target)}`:''}`
  }
  if(effect.type==='restriction') return `Bloqueia ${formatConditionTargetKey(effect.key||'ação')}`
  if(effect.type==='resource') return `${(effect.value||0)>0?'+':''}${effect.value||0}${effect.unit==='percent'?'%':' pontos'} em ${formatConditionTargetKey(effect.key||'recurso')} máximo`
  if(effect.type==='periodic_damage') return `${effect.dice||'dano'} por rodada em ${String(effect.key||'pv').toUpperCase()} (acionamento manual)`
  if(effect.type==='round_counter') return `${effect.value||3} rodada(s) com controle manual`
  return ''
}

/** Ordem visual da ficha: troca dois cartões sem mover os demais.
 * O layout é salvo por alvo e navegador; os dados das condições não são alterados. */
function useActiveConditionCardSwap(campaignId:string,kind:'character'|'enemy',targetId:string,items:Active[],serverOrder:Record<string,number>={}){
  const storageKey=`haxbag.condition-card-order.v142:${campaignId}:${kind}:${targetId}`
  const [savedIds,setSavedIds]=useState<string[]>([])
  useEffect(()=>{
    try{
      const parsed:unknown=JSON.parse(window.localStorage.getItem(storageKey)||'[]')
      setSavedIds(Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==='string').slice(0,300):[])
    }catch{setSavedIds([])}
  },[storageKey])
  const fallback=[...items].sort((a,b)=>(serverOrder[a.id]??1000000)-(serverOrder[b.id]??1000000))
  const indexes=new Map(savedIds.map((id,index)=>[id,index]))
  const sorted=[...fallback].sort((a,b)=>{
    const ia=indexes.get(a.id),ib=indexes.get(b.id)
    if(ia!==undefined&&ib!==undefined)return ia-ib
    if(ia!==undefined)return -1
    if(ib!==undefined)return 1
    return 0
  })
  const swap=(source:string,destination:string)=>{
    if(source===destination||!sorted.some(item=>item.id===source)||!sorted.some(item=>item.id===destination))return
    const ids=sorted.map(item=>item.id)
    const from=ids.indexOf(source),to=ids.indexOf(destination)
    ;[ids[from],ids[to]]=[ids[to],ids[from]]
    setSavedIds(ids)
    try{window.localStorage.setItem(storageKey,JSON.stringify(ids))}catch{/* Continua nesta sessão. */}
  }
  const gesture=useConditionCardPointerSwap(swap,sorted.length>1)
  return {sorted,...gesture}
}

/** Exibe um saldo por alvo, sem somar percentuais diretamente a pontos.
 * A compensação real é calculada sobre o valor-base com a mesma fórmula da ficha.
 * Registros anulados (ex.: -10 +10) continuam visíveis como saldo zero. */
const normalizedModifierKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR')
type CombinedModifier={id:string;target:string;key:string;flat:number;percent:number;sources:number}
function combineActiveModifiers(active:Active[],definitions:Definition[]):CombinedModifier[]{
  const definitionsById=new Map(definitions.map(d=>[d.id,d]))
  const grouped=new Map<string,CombinedModifier>()
  for(const assignment of active){
    const definition=definitionsById.get(assignment.definition_id)
    for(const effect of definition?.effects||[]){
      if(effect.type!=='modifier'||!effect.target||!Number.isFinite(effect.value))continue
      const target=effect.target
      const originalKey=(effect.key||'*').trim()||'*'
      const id=`${target}:${normalizedModifierKey(originalKey)}`
      let item=grouped.get(id)
      if(!item){item={id,target,key:originalKey,flat:0,percent:0,sources:0};grouped.set(id,item)}
      if(effect.unit==='percent')item.percent+=Number(effect.value)
      else item.flat+=Number(effect.value)
      item.sources++
    }
  }
  return [...grouped.values()]
}
const signedConditionValue=(value:number,unit='')=>`${value>0?'+':''}${Number(value.toFixed(3))}${unit}`
function modifierBaseValue(
  target:string,key:string,trainings:Record<string,string>,mainBases:Record<string,number>,
):number|null{
  const normalized=normalizedModifierKey(key)
  if(normalized==='*')return null
  if(target==='main_skill'){
    const result=Object.entries(mainBases).find(([name])=>normalizedModifierKey(name)===normalized)?.[1]
    return typeof result==='number'&&Number.isFinite(result)?result:null
  }
  if(target!=='extra_skill'&&target!=='archetype_skill')return null
  const full=Object.entries(KISATSUTAI_SKILL_GROUPS).flatMap(([group,skills])=>skills.map(skill=>({group,name:skill.name,key:`${group}:${skill.name}`})))
    .filter(item=>(['Sociais','Conhecimentos Gerais','Naturais'].includes(item.group)?'extra_skill':'archetype_skill')===target)
  const entry=full.find(item=>normalizedModifierKey(item.key)===normalized)
    || (()=>{const matched=full.filter(item=>normalizedModifierKey(item.name)===normalized);return matched.length===1?matched[0]:undefined})()
  if(!entry)return null
  const raw=Object.entries(trainings).find(([name])=>normalizedModifierKey(name)===normalizedModifierKey(entry.key))?.[1]
  return Object.prototype.hasOwnProperty.call(KISATSUTAI_TRAINING,raw||'')
    ? KISATSUTAI_TRAINING[raw as keyof typeof KISATSUTAI_TRAINING]:0
}

export function CharacterConditions({campaignId,characterId,skillTrainings={},mainSkillBases={}}:{campaignId:string;characterId:string;skillTrainings?:Record<string,string>;mainSkillBases?:Record<string,number>}){
 const [active,setActive]=useState<Active[]>([])
 const [definitions,setDefinitions]=useState<Definition[]>([])
 const [displayOrder,setDisplayOrder]=useState<Record<string,number>>({})
 const [error,setError]=useState('')
 const cards=useActiveConditionCardSwap(campaignId,'character',characterId,active,displayOrder)
 useEffect(()=>{let live=true;const load=async()=>{
   const [assignments,defs,effects,orders]=await Promise.all([
     supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:characterId}),
     supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
     supabase.rpc('hax_list_condition_effects',{p_campaign_id:campaignId}),
     supabase.rpc('hax_list_active_condition_order_v142',{p_campaign_id:campaignId})
   ])
   if(!live)return
   if(assignments.error||defs.error||effects.error){setError('Não foi possível consultar os efeitos das condições.');return}
   setError('')
   setDisplayOrder(orders.error?{}:Object.fromEntries(((orders.data||[]) as {kind:string;id:string;position:number}[]).filter(x=>x.kind==='character').map(x=>[x.id,x.position])))
   setActive((assignments.data||[]) as Active[])
   setDefinitions(((defs.data||[]) as Definition[]).map(d=>({...d,effects:((effects.data||[]) as {id:string;effects:ConditionEffect[]}[]).find(e=>e.id===d.id)?.effects||[]})))
 };void load();const t=setInterval(()=>void load(),15000);return()=>{live=false;clearInterval(t)}},[campaignId,characterId])
 const visibleModifiers=combineActiveModifiers(active,definitions)
 const sortedActive=cards.sorted
 const goodCount=sortedActive.filter(a=>getConditionPolarity(definitions.find(d=>d.id===a.definition_id))==='good').length
 const badCount=sortedActive.filter(a=>getConditionPolarity(definitions.find(d=>d.id===a.definition_id))==='bad').length
 const ruleHints=sortedActive.flatMap(a=>{
   const d=definitions.find(item=>item.id===a.definition_id)
   return (d?.effects||[])
     .filter(e=>['dice','restriction','resource','periodic_damage','round_counter'].includes(e.type))
     .map((e,i)=>({id:`${a.id}:${i}`,emoji:a.emoji,name:a.name,text:describeConditionRule(e),type:e.type,polarity:getConditionPolarity(d)}))
 }).filter(entry=>entry.text)
 return <div className="hb-condition-indicator hb-condition-indicator--sheet">
   <div className="hb-condition-header">
     <div>
       <strong>🩸 Condições</strong>
       <small>Efeitos ativos que estão alterando a ficha neste momento.</small>
     </div>
     <div className="hb-condition-summary-badges">
       {goodCount>0&&<span className="hb-condition-summary-positive" title={`${goodCount} condição(ões) benéfica(s)`}>✦ {goodCount} boa{goodCount===1?'':'s'}</span>}
       {badCount>0&&<span className="hb-condition-summary-negative" title={`${badCount} condição(ões) prejudicial(is)`}>◆ {badCount} {badCount===1?'ruim':'ruins'}</span>}
       <span className="hb-condition-count-pill">{active.length} ativa{active.length===1?'':'s'}</span>
     </div>
   </div>
   {sortedActive.length===0
     ? <div className="hb-condition-empty-state"><span aria-hidden="true">✦</span><div><strong>Nenhuma condição ativa</strong><small>Quando houver condições aplicadas, elas aparecerão aqui com seus modificadores e regras extras.</small></div></div>
     : <><p className="hb-condition-swap-hint">↔ Arraste pelo nome de uma condição e solte sobre outra para trocar as duas posições.</p><div className="hb-condition-chip-grid">{sortedActive.map(a=>{
       const polarity=getConditionPolarity(definitions.find(d=>d.id===a.definition_id))
       return <article key={a.id} {...cards.bind(a.id)} className={`hb-condition-chip severity-${a.severity} polarity-${polarity} ${cards.draggedId===a.id?'hb-condition-chip-dragging':''} ${cards.overId===a.id?'hb-condition-chip-drop-target':''}`} title={[a.description,a.duration_label,a.notes].filter(Boolean).join(' · ')}>
         <div className="hb-condition-chip-top" data-condition-drag-handle="true"><span className="hb-condition-chip-name"><span className="hb-condition-chip-avatar" aria-hidden="true">{a.emoji||conditionPolarityIcon[polarity]}</span>{a.name}</span><span className={`hb-condition-chip-severity severity-${a.severity}`}>{conditionSeverityIcon[a.severity]||'●'} {conditionSeverityName[a.severity]||'Normal'}</span></div>
         <div className="hb-condition-chip-meta"><span className={`hb-condition-polarity-label polarity-${polarity}`}>{conditionPolarityIcon[polarity]} {conditionPolarityName[polarity]}</span><small>⌛ {a.duration_label||'Indeterminada'}{a.notes?` · ${a.notes}`:''}</small></div>
         {(a.description||definitions.find(d=>d.id===a.definition_id)?.description)&&<p className="hb-condition-player-description">{a.description||definitions.find(d=>d.id===a.definition_id)?.description}</p>}

       </article>
     })}</div></>}
   {visibleModifiers.length>0&&<div className="hb-condition-subpanel hb-condition-subpanel--mods" aria-label="Saldos dos modificadores ativos">
     <div className="hb-condition-subpanel-head"><strong>Modificadores ativos</strong><small>{visibleModifiers.length} {visibleModifiers.length===1?'alvo ajustado':'alvos ajustados'} · bônus e penalidades se compensam</small></div>
     <p className="hb-v152-mod-explanation">Os ajustes da mesma perícia são combinados. Em perícias treinadas, o percentual incide sobre a base; nas concedidas apenas por condições, também incide sobre os pontos concedidos. Um saldo zero indica compensação.</p>
     <div className="hb-condition-token-grid">{visibleModifiers.map(entry=>{
       // Um efeito geral (*) também modifica a perícia específica: a mesma regra já
       // é usada por conditionModifier() no cálculo efetivo da ficha.
       const general=entry.key==='*'?undefined:visibleModifiers.find(other=>other.target===entry.target&&normalizedModifierKey(other.key)==='*')
       const percent=entry.percent+(general?.percent||0)
       const flat=entry.flat+(general?.flat||0)
       const base=modifierBaseValue(entry.target,entry.key,skillTrainings,mainSkillBases)
       const isConditionGranted=base===0&&(entry.target==='extra_skill'||entry.target==='archetype_skill')
       const delta=base===null?null:(isConditionGranted
         ? Math.round(flat*(1+percent/100))
         : Math.round(base*(1+percent/100)+flat))-base
       const isNeutral=delta===0||(delta===null&&percent===0&&flat===0)
       const isPositive=delta===null?(percent>=0&&flat>=0&&!isNeutral):delta>0
       const isNegative=delta===null?(percent<=0&&flat<=0&&!isNeutral):delta<0
       const parts=[percent!==0?signedConditionValue(percent,'%'):null,flat!==0?signedConditionValue(flat,' pts'):null].filter((x):x is string=>!!x)
       const expression=parts.length?parts.join(' · '):'Compensação completa'
       const summary=delta===null?(entry.sources>1||general?'Ajustes combinados':'Ajuste ativo'):delta===0?'Anulados':signedConditionValue(delta,' pts de saldo')
       return <div key={entry.id} className={`hb-condition-token hb-v152-modifier ${isNeutral?'is-neutral':isPositive?'is-positive':isNegative?'is-negative':'is-mixed'}`} title={base===null?'Ajustes combinados. O resultado final depende do valor-base.':`Base ${base} · Resultado ${base+delta!}`}>
         <span className="hb-condition-token-icon" aria-hidden="true">{isNeutral?'↔':isPositive?'↗':isNegative?'↘':'±'}</span>
         <div className="hb-v152-modifier-content"><em>{conditionTargetLabels[entry.target]||entry.target}{entry.key!=='*'?` · ${formatConditionTargetKey(entry.key,entry.target)}`:' · Todos'}</em><small>{expression}{general?' · inclui efeitos gerais':''}</small></div>
         <strong>{summary}</strong>
       </div>
     })}</div>
   </div>}
   {ruleHints.length>0&&<div className="hb-condition-subpanel hb-condition-subpanel--rules">
     <div className="hb-condition-subpanel-head"><strong>Regras adicionais configuradas</strong><small>Restrições, recursos e efeitos especiais da condição.</small></div>
     <div className="hb-condition-rule-grid">{ruleHints.map(entry=><div key={entry.id} className={`hb-condition-rule-card polarity-${entry.polarity}`}><span className="hb-condition-rule-identity"><span aria-hidden="true">{conditionRuleIcon[entry.type]||'✧'}</span>{entry.emoji} {entry.name}</span><strong>{entry.text}</strong></div>)}</div>
   </div>}
   {error&&<small role="status" className="hb-condition-inline-error">{error}</small>}
 </div>
}

/** Condições ativas de um inimigo, visíveis somente na ficha do mestre. */
export function EnemyConditions({campaignId,enemyId}:{campaignId:string;enemyId:string}){
  const [active,setActive]=useState<Active[]>([])
  const [definitions,setDefinitions]=useState<Definition[]>([])
  const [displayOrder,setDisplayOrder]=useState<Record<string,number>>({})
  const cards=useActiveConditionCardSwap(campaignId,'enemy',enemyId,active,displayOrder)
  useEffect(()=>{
    let live=true
    const load=async()=>{
      const [result,library,orders]=await Promise.all([
        supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:enemyId}),
        supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
        supabase.rpc('hax_list_active_condition_order_v142',{p_campaign_id:campaignId}),
      ])
      if(!live)return
      if(!result.error)setActive((result.data||[]) as Active[])
      if(!library.error)setDefinitions((library.data||[]) as Definition[])
      setDisplayOrder(orders.error?{}:Object.fromEntries(((orders.data||[]) as {kind:string;id:string;position:number}[]).filter(x=>x.kind==='enemy').map(x=>[x.id,x.position])))
    }
    void load()
    const timer=window.setInterval(()=>void load(),15000)
    return()=>{live=false;window.clearInterval(timer)}
  },[campaignId,enemyId])
  return <div className="hb-condition-indicator hb-condition-indicator--sheet hb-condition-indicator--enemy">
    <div className="hb-condition-header"><div><strong>🩸 Condições do inimigo</strong><small>Visão rápida dos estados que estão afetando o alvo.</small></div><span className="hb-condition-count-pill">{active.length} ativa{active.length===1?'':'s'}</span></div>
    {active.length===0
      ? <div className="hb-condition-empty-state"><span aria-hidden="true">✦</span><div><strong>Nenhuma condição ativa</strong><small>O inimigo ainda não possui efeitos aplicados.</small></div></div>
      : <><p className="hb-condition-swap-hint">↔ Arraste pelo nome de uma condição e solte sobre outra para trocar as duas posições.</p><div className="hb-condition-chip-grid">{cards.sorted.map(condition=>{
        const polarity=getConditionPolarity(definitions.find(d=>d.id===condition.definition_id))
        return <article key={condition.id} {...cards.bind(condition.id)} className={`hb-condition-chip severity-${condition.severity} polarity-${polarity} ${cards.draggedId===condition.id?'hb-condition-chip-dragging':''} ${cards.overId===condition.id?'hb-condition-chip-drop-target':''}`} title={condition.description}>
          <div className="hb-condition-chip-top" data-condition-drag-handle="true"><span className="hb-condition-chip-name"><span className="hb-condition-chip-avatar" aria-hidden="true">{condition.emoji||conditionPolarityIcon[polarity]}</span>{condition.name}</span><span className={`hb-condition-chip-severity severity-${condition.severity}`}>{conditionSeverityIcon[condition.severity]||'●'} {conditionSeverityName[condition.severity]||'Normal'}</span></div>
          <div className="hb-condition-chip-meta"><span className={`hb-condition-polarity-label polarity-${polarity}`}>{conditionPolarityIcon[polarity]} {conditionPolarityName[polarity]}</span><small>⌛ {condition.duration_label||'Indeterminada'}</small></div>
          {condition.description&&<p className="hb-condition-player-description">{condition.description}</p>}

        </article>
      })}</div></>}
  </div>
}


/** Biblioteca pública: somente condições liberadas pelo mestre, sem controles de edição. */
export function PlayerConditionsLibrary({campaignId}:{campaignId:string}) {
  const [items,setItems]=useState<Definition[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
  const [nature,setNature]=useState('todas')
  const [severity,setSeverity]=useState('todas')
  const load=useCallback(async()=>{
    const result=await supabase.rpc('hax_public_condition_library',{p_campaign_id:campaignId})
    if(result.error)setError(`Não foi possível carregar a biblioteca: ${result.error.message}. Execute o SQL V140.`)
    else{setItems(Array.isArray(result.data)?result.data as Definition[]:[]);setError('')}
    setLoading(false)
  },[campaignId])
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer)},[load])
  const matching=items.filter(item=>(nature==='todas'||(item.polarity||'ruim')===nature)&&(severity==='todas'||item.severity===severity)&&`${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  return <section className="hb-conditions-panel hb-public-conditions-library hb-conditions-v144 hb-conditions-v145">
    <header className="hb-conditions-hero"><div className="hb-conditions-hero-copy"><span className="hb-conditions-eyebrow">ACERVO DA CAMPANHA</span><h2>📚 Biblioteca de condições</h2><p>Conheça as condições que o mestre decidiu compartilhar. Os efeitos das condições aplicadas ao seu personagem também aparecem na própria ficha.</p></div><div className="hb-conditions-hero-actions"><button type="button" className="secondary-button" onClick={()=>void load()}>↻ Atualizar</button></div></header>
    {error&&<div role="alert" className="hb-condition-inline-error">{error}</div>}
    <div className="hb-v144-public-stats"><span>▤ <strong>{items.length}</strong> condições publicadas</span><span>◆ <strong>{items.filter(item=>item.severity==='critica').length}</strong> críticas</span><span>✦ <strong>{items.filter(item=>item.polarity==='boa').length}</strong> benéficas</span></div>
    <div className="hb-v145-public-nature" role="group" aria-label="Filtrar rapidamente por natureza">
      {([['todas','Todas','◈'],['boa','Boas','✦'],['neutra','Neutras','◇'],['ruim','Ruins','◆']] as const).map(([value,label,icon])=><button key={value} type="button" className={nature===value?'is-selected':''} aria-pressed={nature===value} onClick={()=>setNature(value)}><span aria-hidden="true">{icon}</span>{label}<small>{value==='todas'?items.length:items.filter(item=>(item.polarity||'ruim')===value).length}</small></button>)}
    </div>
    <div className="hb-condition-card"><div className="hb-conditions-section-head"><div><h3>Condições disponíveis</h3><small>A visibilidade é definida individualmente pelo mestre da campanha.</small></div><span className="hb-conditions-count">{matching.length} condição(ões)</span></div>
      <label className="hb-conditions-library-search">Buscar condição<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome ou descrição..." /></label>
      <div className="hb-conditions-library-tools"><label>Natureza<select value={nature} onChange={event=>setNature(event.target.value)}><option value="todas">Todas</option><option value="boa">Boas</option><option value="neutra">Neutras</option><option value="ruim">Ruins</option></select></label><label>Gravidade<select value={severity} onChange={event=>setSeverity(event.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label>{(search||nature!=='todas'||severity!=='todas')&&<button type="button" className="secondary-button" onClick={()=>{setSearch('');setNature('todas');setSeverity('todas')}}>Limpar filtros</button>}</div>
      {loading?<p className="hb-conditions-empty">Carregando biblioteca...</p>:<div className="hb-condition-library">{matching.map(item=><article key={item.id} className={`hb-condition-library-item severity-${item.severity}`}><div className="hb-v144-definition-head"><span className="hb-v144-definition-icon" aria-hidden="true">{item.emoji||'✦'}</span><div><strong>{item.name}</strong><small>Condição da campanha</small></div></div><span className={`hb-condition-polarity ${item.polarity==='boa'?'good':item.polarity==='neutra'?'neutral':'bad'}`}>{item.polarity==='boa'?'✦ Boa':item.polarity==='neutra'?'◈ Neutra':'◆ Ruim'}</span><span className={`hb-conditions-severity severity-${item.severity}`}>{item.severity==='critica'?'Crítica':item.severity==='grave'?'Grave':'Normal'}</span><p className="hb-condition-library-description">{item.description||'O mestre ainda não escreveu uma descrição para esta condição.'}</p></article>)}{!matching.length&&<div className="hb-conditions-empty"><strong>Nenhuma condição disponível</strong><p>{search?'Tente outros filtros ou termos de busca.':'O mestre ainda não publicou condições nesta biblioteca.'}</p></div>}</div>}
    </div>
  </section>
}
