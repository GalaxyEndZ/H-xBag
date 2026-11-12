import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

type EnemyOption = { id: string; name: string; emoji?: string | null }
type CharacterOption = { id: string; name: string; emoji?: string | null }
type ConditionEffect = {type:'modifier'|'dice'|'restriction'|'resource'|'periodic_damage'|'round_counter'|'apply_condition'|'remove_condition';target?:string;key?:string;value?:number;condition_id?:string;dice?:string;duration?:string}
type Definition = { id: string; name: string; emoji: string; description: string; severity: string; effects?:ConditionEffect[] }
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
  resource: [{value:'pv',label:'Pontos de Vida (PV)'},{value:'ps',label:'Pontos de Sanidade (PS)'},{value:'pr',label:'Pontos de Recurso (PR)'}],
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
  const [characterId,setCharacterId]=useState('')
  const [targetType,setTargetType]=useState<'character'|'enemy'>('character')
  const [definitionId,setDefinitionId]=useState('')
  const [duration,setDuration]=useState('')
  const [notes,setNotes]=useState('')
  const [editingDefinition,setEditingDefinition]=useState<string|null>(null)
  const [editingAssignment,setEditingAssignment]=useState<string|null>(null)
  const [editName,setEditName]=useState('')
  const [editEmoji,setEditEmoji]=useState('✨')
  const [editDescription,setEditDescription]=useState('')
  const [editSeverity,setEditSeverity]=useState('normal')
  const [editDuration,setEditDuration]=useState('')
  const [editNotes,setEditNotes]=useState('')
  const [editEffects,setEditEffects]=useState<ConditionEffect[]>([])
  const [newEffects,setNewEffects]=useState<ConditionEffect[]>([])
  const [orderMap,setOrderMap]=useState<Record<string,number>>({})
  const [dragged,setDragged]=useState<string|null>(null)
  const [rounds,setRounds]=useState<Record<string,number>>({})
  const [rollLog,setRollLog]=useState<Record<string,string>>({})
  const orderKey=(kind:'definition'|'character'|'enemy',id:string)=>`${kind}:${id}`
  const sortBySavedOrder=<T extends {id:string}>(items:T[],kind:'definition'|'character'|'enemy')=>[...items].sort((a,b)=>(orderMap[orderKey(kind,a.id)]??999999)-(orderMap[orderKey(kind,b.id)]??999999))
  const moveCondition=async(kind:'definition'|'character'|'enemy',sourceId:string,destinationId:string)=>{
    if(!master||busy||sourceId===destinationId)return
    const source=kind==='definition'?sortBySavedOrder(definitions,'definition'):kind==='character'?sortBySavedOrder(active,'character'):sortBySavedOrder(enemyActive,'enemy')
    const target=source.find(item=>item.id===destinationId)
    const moving=source.find(item=>item.id===sourceId)
    if(!target||!moving)return
    // Applied conditions are ordered independently for each target.
    const scoped=kind==='definition'?source:source.filter(item=>(item as Active).character_id===(target as Active).character_id)
    if(!scoped.some(item=>item.id===sourceId))return
    const ids=scoped.map(item=>item.id)
    ids.splice(ids.indexOf(sourceId),1)
    ids.splice(ids.indexOf(destinationId),0,sourceId)
    const optimistic={...orderMap}
    ids.forEach((id,index)=>{optimistic[orderKey(kind,id)]=index})
    setOrderMap(optimistic)
    setBusy(true)
    const result=await supabase.rpc('hax_reorder_conditions',{p_campaign_id:campaignId,p_kind:kind,p_ids:ids})
    if(result.error){setOrderMap(orderMap);setError(result.error.message)}
    setBusy(false)
  }
  const dragProps=(kind:'definition'|'character'|'enemy',id:string)=>master?{
    draggable:true,
    onDragStart:(event:import('react').DragEvent<HTMLElement>)=>{setDragged(orderKey(kind,id));event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',orderKey(kind,id))},
    onDragOver:(event:import('react').DragEvent<HTMLElement>)=>{if(dragged?.startsWith(`${kind}:`)){event.preventDefault();event.dataTransfer.dropEffect='move'}},
    onDrop:(event:import('react').DragEvent<HTMLElement>)=>{event.preventDefault();const source=dragged||event.dataTransfer.getData('text/plain');setDragged(null);if(source.startsWith(`${kind}:`))void moveCondition(kind,source.slice(kind.length+1),id)},
    onDragEnd:()=>setDragged(null),
    className:dragged===orderKey(kind,id)?'hb-condition-dragging':'',
    title:'Arraste este cartão para alterar a ordem'
  }:{}
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const startEditDefinition=(d:Definition)=>{setEditingDefinition(d.id);setEditName(d.name);setEditEmoji(d.emoji);setEditDescription(d.description);setEditSeverity(d.severity);setEditEffects(d.effects||[])}
  const [workspace,setWorkspace]=useState<'active'|'apply'|'create'|'library'>('active')
  const [characterFilter,setCharacterFilter]=useState('todos')
  const [filter,setFilter]=useState('')
  const [libraryFilter,setLibraryFilter]=useState('')
  const [severityFilter,setSeverityFilter]=useState('todas')
  const refresh=useCallback(async()=>{
    const [d,a,ea,fx,orders]=await Promise.all([
      supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:null}),
      supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:null}),
      supabase.rpc('hax_list_condition_effects',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_condition_order',{p_campaign_id:campaignId}),
    ])
    if(d.error||a.error||ea.error||fx.error||orders.error){setError(d.error?.message||a.error?.message||ea.error?.message||fx.error?.message||orders.error?.message||'Erro ao consultar condições.');return}
    setOrderMap(Object.fromEntries(((orders.data||[]) as {kind:string;id:string;position:number}[]).map(item=>[`${item.kind}:${item.id}`,item.position])))
    setDefinitions(((d.data||[]) as Definition[]).map(item=>({...item,effects:((fx.data||[]) as {id:string;effects:ConditionEffect[]}[]).find(row=>row.id===item.id)?.effects||[]})))
    setActive((a.data||[]) as Active[])
    setEnemyActive((ea.data||[]) as Active[])
    const roundResult=await supabase.rpc('hax_list_condition_rounds',{p_campaign_id:campaignId})
    if(!roundResult.error) setRounds(Object.fromEntries(((roundResult.data||[]) as {assignment_id:string;rounds_remaining:number}[]).map(row=>[row.assignment_id,row.rounds_remaining])))
    setError('')
  },[campaignId])
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh])
  const effectEditor=(items:ConditionEffect[],setItems:(value:ConditionEffect[])=>void)=>{
    const update=(index:number, patch:Partial<ConditionEffect>)=>setItems(items.map((effect,i)=>i===index?{...effect,...patch}:effect))
    return <section className="hb-condition-effect-editor">
      <div className="hb-condition-effect-heading"><div><strong>⚙️ Efeitos configuráveis</strong><small>O mestre aplica e remove as condições; os efeitos ativos são calculados na ficha.</small></div><span>{items.length} efeito(s)</span></div>
      {items.map((effect,index)=><div key={index} className="hb-condition-effect-row">
        <label>Tipo<select value={effect.type} onChange={e=>setItems(items.map((v,i)=>i===index?{type:e.target.value as ConditionEffect['type']}:v))}>
          <option value="modifier">Bônus / penalidade numérica</option><option value="dice">Vantagem / desvantagem (dados)</option><option value="restriction">Bloqueio de ação ou reação</option><option value="resource">Modificador de recurso máximo</option><option value="periodic_damage">Dano por rodada (registro)</option><option value="round_counter">Contador de rodadas (registro)</option><option value="apply_condition">Vínculo: aplicar condição (manual)</option><option value="remove_condition">Vínculo: remover condição (manual)</option>
        </select></label>
        {(effect.type==='modifier'||effect.type==='dice'||effect.type==='resource')&&<>
          <label>Categoria<select value={effect.type==='resource'?'resource':effect.target||'status'} onChange={e=>update(index,{target:e.target.value})} disabled={effect.type==='resource'}>
            {effect.type==='resource'?<option value="resource">Recurso máximo</option>:<><option value="status">Atributo / status</option><option value="main_skill">Perícia principal</option><option value="extra_skill">Perícia extra</option><option value="archetype_skill">Perícia de arquétipo</option><option value="combat_points">Ataque / bloqueio / esquiva</option></>}
          </select></label>
          <label>{effect.type==='resource'?'Recurso afetado':(effect.target==='main_skill'||effect.target==='extra_skill'||effect.target==='archetype_skill')?'Perícia afetada':'Atributo ou ação afetada'}
            {(() => {
              const category = effect.type==='resource'?'resource':effect.target||'status'
              const choices = CONDITION_KEYS[category]
              if (!choices) return <input value={effect.key||''} onChange={e=>update(index,{key:e.target.value})} placeholder="Nome da perícia ou * para todas" aria-label="Nome da perícia afetada" />
              const current = effect.key||''
              const isCustom = Boolean(current && !choices.some(option=>option.value===current))
              return <><select value={isCustom?'__custom__':current} onChange={e=>update(index,{key:e.target.value==='__custom__'?'':e.target.value})}>
                <option value="">Selecione...</option>
                {choices.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
                <option value="__custom__">Outro identificador...</option>
              </select>
              {isCustom&&<input value={current} onChange={e=>update(index,{key:e.target.value})} aria-label="Identificador personalizado" placeholder="Identificador personalizado" />}</>
            })()}
          </label>
          <label>{effect.type==='dice'?'Dados adicionais (+ vantagem / - desvantagem)':effect.type==='resource'?'Alteração do máximo (+/-)':'Modificador (+/-)'}<input type="number" step="1" value={effect.value??0} onChange={e=>update(index,{value:Number(e.target.value)})}/></label>
        </>}
        {effect.type==='restriction'&&<label>Ação/reação bloqueada<select value={effect.key||'dodge'} onChange={e=>update(index,{key:e.target.value})}><option value="dodge">Esquiva</option><option value="counterattack">Contra-ataque</option><option value="block">Bloqueio</option><option value="attack">Ataques</option><option value="movement">Movimento</option></select></label>}
        {effect.type==='periodic_damage'&&<><label>Recurso<select value={effect.key||'pv'} onChange={e=>update(index,{key:e.target.value})}><option value="pv">PV</option><option value="ps">PS</option><option value="pr">PR</option></select></label><label>Dado por rodada<input value={effect.dice||'1d6'} onChange={e=>update(index,{dice:e.target.value})} placeholder="1d6"/></label><small>O mestre aciona cada rodada; este efeito não desconta recursos sozinho.</small></>}
        {effect.type==='round_counter'&&<><label>Rodadas iniciais<input type="number" min="1" step="1" value={effect.value??3} onChange={e=>update(index,{value:Number(e.target.value)})}/></label><small>Contador descritivo; não remove a condição automaticamente.</small></>}
        {(effect.type==='apply_condition'||effect.type==='remove_condition')&&<><label>Condição vinculada<select value={effect.condition_id||''} onChange={e=>update(index,{condition_id:e.target.value})}><option value="">Selecione</option>{definitions.filter(d=>d.id!==editingDefinition).map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label><small>Vínculo informativo: somente o mestre aplica ou remove a condição.</small></>}
        <button type="button" className="secondary-button hb-condition-effect-remove" onClick={()=>setItems(items.filter((_,i)=>i!==index))}>✕ Remover efeito</button>
      </div>)}
      <button type="button" className="secondary-button hb-condition-effect-add" onClick={()=>setItems([...items,{type:'modifier',target:'status',key:'',value:0}])}>＋ Adicionar outro efeito</button>
    </section>
  }
  const filteredDefinitions=sortBySavedOrder(definitions,'definition').filter(d=>`${d.name} ${d.description} ${d.severity}`.toLocaleLowerCase().includes(libraryFilter.toLocaleLowerCase()))
  const allActive=[...sortBySavedOrder(active,'character').map(a=>({...a,targetType:'character' as const})),...sortBySavedOrder(enemyActive,'enemy').map(a=>({...a,targetType:'enemy' as const}))]
  const targets=[...characters.map(c=>({...c,targetType:'character' as const})),...enemies.map(e=>({...e,targetType:'enemy' as const}))]
  const targetName=(a:{character_id:string;targetType:'character'|'enemy'})=>targets.find(t=>t.id===a.character_id&&t.targetType===a.targetType)?.name||'Alvo removido'
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
    <header className="hb-conditions-hero"><div className="hb-conditions-hero-copy"><span className="hb-conditions-eyebrow">CENTRAL DE CONDIÇÕES</span><h2><span className="hb-conditions-hero-symbol">✦</span> Condições & efeitos</h2><p>Organize condições da campanha, acompanhe alvos afetados e configure modificadores.</p></div><div className="hb-conditions-hero-actions">{master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('create')}>＋ Nova condição</button>}<button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={busy}>↻ Atualizar</button></div></header>
    {error&&<div className="hb-condition-inline-error" role="alert">Não foi possível concluir a operação: {error}</div>}
    <div className="hb-conditions-stats"><div><span>🩸 Condições ativas</span><strong>{allActive.length}</strong><small>Aplicações na campanha</small></div><div><span>🎯 Alvos afetados</span><strong>{new Set(allActive.map(a=>`${a.targetType}:${a.character_id}`)).size}</strong><small>Personagens e inimigos</small></div><div><span>📚 Na biblioteca</span><strong>{definitions.length}</strong><small>Condições cadastradas</small></div></div>
    
    <nav className="hb-condition-tabs" aria-label="Seções das condições">
      <button type="button" className={workspace==='active'?'is-active':''} onClick={()=>setWorkspace('active')}>🩸 Ativas <span>{allActive.length}</span></button>
      {master&&<button type="button" className={workspace==='apply'?'is-active':''} onClick={()=>setWorkspace('apply')}>🎯 Aplicar</button>}
      {master&&<button type="button" className={workspace==='library'?'is-active':''} onClick={()=>setWorkspace('library')}>📚 Biblioteca <span>{definitions.length}</span></button>}
      {master&&<button type="button" className={workspace==='create'?'is-active':''} onClick={()=>setWorkspace('create')}>✨ Criar</button>}
    </nav>
    {master&&(workspace==='create'||workspace==='apply')&&<div className="hb-conditions-grid hb-conditions-single">
      <form style={{display:workspace==='create'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{const r=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:name.trim(),p_emoji:emoji.trim()||'✨',p_description:description.trim(),p_severity:severity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:r.data as string,p_effects:newEffects});if(saved.error)return saved;setName('');setDescription('');setNewEffects([]);setWorkspace('library')}return r})}}>
        <h3>✨ Criar condição</h3><label>Nome<input required maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Envenenado" /></label><label>Emoji<input maxLength={12} value={emoji} onChange={e=>setEmoji(e.target.value)} /></label><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Descreva os efeitos..." /></label>{effectEditor(newEffects,setNewEffects)}<button className="primary-button" disabled={busy||!name.trim()}>Criar condição</button>
      </form>
      <form style={{display:workspace==='apply'?undefined:'none'}} className="hb-condition-card hb-condition-form" onSubmit={e=>{e.preventDefault();void execute(async()=>{const r=targetType==='enemy'?await supabase.rpc('hax_apply_enemy_condition',{p_campaign_id:campaignId,p_enemy_id:characterId,p_definition_id:definitionId,p_duration_label:duration.trim()||null,p_notes:notes.trim()||null}):await supabase.rpc('hax_apply_condition',{p_campaign_id:campaignId,p_character_id:characterId,p_definition_id:definitionId,p_duration_label:duration.trim()||null,p_notes:notes.trim()||null});if(!r.error){setDuration('');setNotes('');setWorkspace('active')}return r})}}>
        <h3>🎯 Aplicar condição</h3><label>Tipo de alvo<select value={targetType} onChange={e=>{setTargetType(e.target.value as 'character'|'enemy');setCharacterId('')}}><option value="character">Personagem</option><option value="enemy">Inimigo</option></select></label><label>{targetType==='enemy'?'Inimigo':'Personagem'}<select required value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Selecione...</option>{targets.filter(t=>t.targetType===targetType).map(t=><option key={`${t.targetType}:${t.id}`} value={t.id}>{t.targetType==='enemy'?'👹':'🧑'} {t.emoji||''} {t.name}</option>)}</select></label><label>Condição<select required value={definitionId} onChange={e=>setDefinitionId(e.target.value)}><option value="">Selecione...</option>{definitions.map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label><label>Duração<input value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Ex.: 3 turnos / até descansar" /></label><label>Observação<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" /></label><button className="primary-button" disabled={busy||!characterId||!definitionId}>Aplicar condição</button>
      </form>
    </div>}
    {workspace==='active'&&<div className="hb-condition-card hb-conditions-wide"><div className="hb-conditions-section-head"><div><h3>📋 Condições ativas</h3><small>Consulte e gerencie os efeitos aplicados</small></div><input aria-label="Buscar condição ou personagem" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar personagem ou condição..." /></div><div className="hb-conditions-filter-row"><label>Alvo <select value={characterFilter} onChange={e=>setCharacterFilter(e.target.value)}><option value="todos">Todos os alvos</option>{characters.map(c=><option key={c.id} value={`character:${c.id}`}>{c.emoji||'🧑'} {c.name}</option>)}{enemies.map(e=><option key={e.id} value={`enemy:${e.id}`}>👹 {e.name}</option>)}</select></label><label>Gravidade <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><span>{allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).length} resultado(s)</span></div>{allActive.length===0?<div className="hb-conditions-empty"><span>✧</span><strong>Nenhuma condição ativa</strong><p>Quando uma condição for aplicada, ela aparecerá aqui.</p>{master&&<button type="button" className="primary-button" onClick={()=>setWorkspace('apply')}>Aplicar condição</button>}</div>:<div className="hb-conditions-active">{allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(a=><article key={a.id} {...dragProps(a.targetType,a.id)} className={`hb-conditions-entry severity-${a.severity} ${dragged===orderKey(a.targetType,a.id)?'hb-condition-dragging':''}`}><div><strong>{a.emoji} {a.name}</strong><span className={`hb-conditions-severity severity-${a.severity}`}>{a.severity==='critica'?'Crítica':a.severity==='grave'?'Grave':'Normal'}</span><small>{targetName(a)} · {a.duration_label||'Sem duração definida'}</small>{a.description&&<p>{a.description}</p>}{a.notes&&<small>{a.notes}</small>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<small>⏳ Rodadas restantes: {rounds[a.id]??'não iniciadas'}</small>}{rollLog[a.id]&&<small role="status">🎲 {rollLog[a.id]} — aplique o dano manualmente</small>}</div>{master&&<div className="hb-condition-actions">{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='round_counter')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>advanceRound(a,a.targetType)}>⏳ Avançar rodada</button>}{definitions.find(d=>d.id===a.definition_id)?.effects?.some(e=>e.type==='periodic_damage')&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>rollPeriodic(a)}>🎲 Rolar dano</button>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>{const d=definitions.find(d=>d.id===a.definition_id);if(d)startEditDefinition(d)}}>✏️ Editar condição</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEditingAssignment(`${a.targetType}:${a.id}`);setEditDuration(a.duration_label||'');setEditNotes(a.notes||'')}}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void execute(async()=>a.targetType==='enemy'?supabase.rpc('hax_remove_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}):supabase.rpc('hax_remove_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}))}>Remover</button></div>}</article>)}</div>}</div>}
    {master&&workspace==='library'&&<div className="hb-condition-card"><div className="hb-conditions-section-head"><div><h3>📚 Biblioteca de condições</h3><small>Condições disponíveis para aplicar aos personagens</small></div><span className="hb-conditions-count">{definitions.length} cadastradas</span></div><label className="hb-conditions-library-search">Buscar na biblioteca<input aria-label="Buscar condições cadastradas" value={libraryFilter} onChange={e=>setLibraryFilter(e.target.value)} placeholder="Nome, descrição ou gravidade..." /></label><div className="hb-condition-library">{definitions.length===0&&<p className="hb-conditions-empty">Nenhuma condição cadastrada. Use a aba Criar para adicionar uma.</p>}{filteredDefinitions.map(d=><div key={d.id} {...dragProps('definition',d.id)} className={`hb-condition-library-item severity-${d.severity} ${dragged===orderKey('definition',d.id)?'hb-condition-dragging':''}`}><strong>{d.emoji} {d.name}</strong><span className={`hb-conditions-severity severity-${d.severity}`}>{d.severity==='critica'?'Crítica':d.severity==='grave'?'Grave':'Normal'}</span><small>{d.description||'Sem descrição'}</small><small>{(d.effects||[]).length} efeito(s) configurado(s)</small><div className="hb-condition-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>startEditDefinition(d)}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy||allActive.some(a=>a.definition_id===d.id)} onClick={()=>void execute(async()=>supabase.rpc('hax_delete_condition',{p_campaign_id:campaignId,p_definition_id:d.id}))}>Excluir</button></div></div>)}</div></div>}
    {master&&editingDefinition&&<div className="hb-condition-modal-backdrop" role="presentation"><form className="hb-condition-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();const id=editingDefinition;void execute(async()=>{const r=await supabase.rpc('hax_update_condition',{p_campaign_id:campaignId,p_definition_id:id,p_name:editName.trim(),p_emoji:editEmoji.trim()||'✨',p_description:editDescription.trim(),p_severity:editSeverity});if(!r.error){const saved=await supabase.rpc('hax_set_condition_effects',{p_campaign_id:campaignId,p_definition_id:id,p_effects:editEffects});if(saved.error)return saved;setEditingDefinition(null)}return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição</h3><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>✕</button></div><label>Nome<input required maxLength={70} value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Emoji<input maxLength={12} value={editEmoji} onChange={e=>setEditEmoji(e.target.value)}/></label><label>Gravidade<select value={editSeverity} onChange={e=>setEditSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea rows={4} value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>{effectEditor(editEffects,setEditEffects)}<div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>Cancelar</button><button className="primary-button" disabled={busy||!editName.trim()}>Salvar alterações</button></div></form></div>}
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
     const key=`${effect.target||'status'}:${(effect.key||'').trim().toLocaleLowerCase()}`
     modifiers.set(key,(modifiers.get(key)||0)+(effect.value||0))
   }
 }
 const labels:Record<string,string>={status:'Status',main_skill:'Perícia principal',extra_skill:'Perícia extra',archetype_skill:'Perícia de arquétipo',combat_points:'Pontos de combate'}
 return <div className="hb-condition-indicator"><strong>🩸 Condições {active.length>0?`(${active.length})`:''}</strong><div>{active.length===0?<small>Nenhuma condição ativa</small>:[...active].sort((a,b)=>(displayOrder[a.id]??999999)-(displayOrder[b.id]??999999)).map(a=><span key={a.id} className={`hb-condition-tag severity-${a.severity}`} title={[a.description,a.duration_label,a.notes].filter(Boolean).join(' · ')}>{a.emoji} {a.name}{a.duration_label?` · ${a.duration_label}`:''}</span>)}</div>
 {modifiers.size>0&&<div className="hb-condition-modifiers" aria-label="Modificadores cumulativos ativos"><strong>Modificadores ativos</strong>{[...modifiers.entries()].filter(([,value])=>value!==0).map(([key,value])=>{const [target,...rest]=key.split(':');return <span key={key} className="hb-condition-tag">{labels[target]||target}{rest.join(':')?` · ${labelForConditionKey(rest.join(':'))}`:''}: {value>0?'+':''}{value}</span>})}</div>}
 {active.length>0&&<div className="hb-condition-rule-hints"><strong>Regras adicionais configuradas</strong>{active.flatMap(a=>{const d=definitions.find(item=>item.id===a.definition_id);return (d?.effects||[]).filter(e=>['dice','restriction','resource','periodic_damage','round_counter'].includes(e.type)).map((e,i)=><span key={`${a.id}:${i}`} className="hb-condition-rule-hint">{a.emoji} {a.name}: {e.type==='dice'?`${(e.value||0)>0?'+':''}${e.value||0} dado(s) · ${e.target||'status'} / ${e.key||'*'}`:e.type==='restriction'?`Bloqueia ${e.key||'ação'}`:e.type==='resource'?`${(e.value||0)>0?'+':''}${e.value||0} ${e.key||'recurso'} máximo`:e.type==='periodic_damage'?`${e.dice||'dano'} por rodada (${e.key||'pv'}; acionamento manual)`:`${e.value||3} rodadas (controle do mestre)`}</span>)})}</div>}
 {error&&<small role="status">{error}</small>}
 </div>
}
