import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

type EnemyOption = { id: string; name: string; emoji?: string | null }
type CharacterOption = { id: string; name: string; emoji?: string | null }
type Definition = { id: string; name: string; emoji: string; description: string; severity: string }
type Active = { id: string; character_id: string; definition_id: string; duration_label: string | null; notes: string | null; name: string; emoji: string; description: string; severity: string }
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
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const startEditDefinition=(d:Definition)=>{setEditingDefinition(d.id);setEditName(d.name);setEditEmoji(d.emoji);setEditDescription(d.description);setEditSeverity(d.severity)}
  const [workspace,setWorkspace]=useState<'active'|'apply'|'create'|'library'>('active')
  const [characterFilter,setCharacterFilter]=useState('todos')
  const [filter,setFilter]=useState('')
  const [severityFilter,setSeverityFilter]=useState('todas')
  const refresh=useCallback(async()=>{
    const [d,a,ea]=await Promise.all([
      supabase.rpc('hax_list_condition_definitions',{p_campaign_id:campaignId}),
      supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:null}),
      supabase.rpc('hax_list_enemy_conditions',{p_campaign_id:campaignId,p_enemy_id:null}),
    ])
    if(d.error||a.error||ea.error){setError(d.error?.message||a.error?.message||ea.error?.message||'Erro ao consultar condições.');return}
    setDefinitions((d.data||[]) as Definition[])
    setActive((a.data||[]) as Active[])
    setEnemyActive((ea.data||[]) as Active[])
    setError('')
  },[campaignId])
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh])
  const allActive=[...active.map(a=>({...a,targetType:'character' as const})),...enemyActive.map(a=>({...a,targetType:'enemy' as const}))]
  const targets=[...characters.map(c=>({...c,targetType:'character' as const})),...enemies.map(e=>({...e,targetType:'enemy' as const}))]
  const targetName=(a:{character_id:string;targetType:'character'|'enemy'})=>targets.find(t=>t.id===a.character_id&&t.targetType===a.targetType)?.name||'Alvo removido'
  const execute=async(fn:()=>Promise<{error: {message:string}|null}>)=>{
    setBusy(true);setError('')
    try{const result=await fn();if(result.error)throw new Error(result.error.message);await refresh()}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  return <section className="hb-conditions-panel">
    <header className="hb-conditions-hero"><div><span className="hb-conditions-eyebrow">CONTROLE DE CAMPANHA</span><h2>🩸 Condições</h2><p>Gerencie efeitos, durações e personagens em um só lugar.</p></div><button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={busy}>↻ Atualizar</button></header>
    {error&&<div className="hb-condition-inline-error" role="alert">Não foi possível concluir a operação: {error}</div>}
    <div className="hb-conditions-stats"><div><span>Condições ativas</span><strong>{allActive.length}</strong></div><div><span>Personagens afetados</span><strong>{new Set(allActive.map(a=>`${a.targetType}:${a.character_id}`)).size}</strong></div><div><span>Condições criadas</span><strong>{definitions.length}</strong></div></div>
    
    <nav className="hb-condition-tabs" aria-label="Seções das condições">
      <button type="button" className={workspace==='active'?'is-active':''} onClick={()=>setWorkspace('active')}>🩸 Ativas <span>{allActive.length}</span></button>
      {master&&<button type="button" className={workspace==='apply'?'is-active':''} onClick={()=>setWorkspace('apply')}>🎯 Aplicar</button>}
      {master&&<button type="button" className={workspace==='library'?'is-active':''} onClick={()=>setWorkspace('library')}>📚 Biblioteca <span>{definitions.length}</span></button>}
      {master&&<button type="button" className={workspace==='create'?'is-active':''} onClick={()=>setWorkspace('create')}>✨ Criar</button>}
    </nav>
    {master&&(workspace==='create'||workspace==='apply')&&<div className="hb-conditions-grid hb-conditions-single">
      <form style={{display:workspace==='create'?undefined:'none'}} className="hb-condition-card" onSubmit={e=>{e.preventDefault();void execute(async()=>{const r=await supabase.rpc('hax_create_condition',{p_campaign_id:campaignId,p_name:name.trim(),p_emoji:emoji.trim()||'✨',p_description:description.trim(),p_severity:severity});if(!r.error){setName('');setDescription('');setWorkspace('library')}return r})}}>
        <h3>✨ Criar condição</h3><label>Nome<input required maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Envenenado" /></label><label>Emoji<input maxLength={12} value={emoji} onChange={e=>setEmoji(e.target.value)} /></label><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Descreva os efeitos..." /></label><button className="primary-button" disabled={busy||!name.trim()}>Criar condição</button>
      </form>
      <form style={{display:workspace==='apply'?undefined:'none'}} className="hb-condition-card" onSubmit={e=>{e.preventDefault();void execute(async()=>{const r=targetType==='enemy'?await supabase.rpc('hax_apply_enemy_condition',{p_campaign_id:campaignId,p_enemy_id:characterId,p_definition_id:definitionId,p_duration_label:duration.trim()||null,p_notes:notes.trim()||null}):await supabase.rpc('hax_apply_condition',{p_campaign_id:campaignId,p_character_id:characterId,p_definition_id:definitionId,p_duration_label:duration.trim()||null,p_notes:notes.trim()||null});if(!r.error){setDuration('');setNotes('');setWorkspace('active')}return r})}}>
        <h3>🎯 Aplicar condição</h3><label>Tipo de alvo<select value={targetType} onChange={e=>{setTargetType(e.target.value as 'character'|'enemy');setCharacterId('')}}><option value="character">Personagem</option><option value="enemy">Inimigo</option></select></label><label>{targetType==='enemy'?'Inimigo':'Personagem'}<select required value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Selecione...</option>{targets.filter(t=>t.targetType===targetType).map(t=><option key={`${t.targetType}:${t.id}`} value={t.id}>{t.targetType==='enemy'?'👹':'🧑'} {t.emoji||''} {t.name}</option>)}</select></label><label>Condição<select required value={definitionId} onChange={e=>setDefinitionId(e.target.value)}><option value="">Selecione...</option>{definitions.map(d=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}</select></label><label>Duração<input value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Ex.: 3 turnos / até descansar" /></label><label>Observação<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" /></label><button className="primary-button" disabled={busy||!characterId||!definitionId}>Aplicar condição</button>
      </form>
    </div>}
    {workspace==='active'&&<div className="hb-condition-card hb-conditions-wide"><div className="hb-conditions-section-head"><div><h3>📋 Condições ativas</h3><small>Consulte e gerencie os efeitos aplicados</small></div><input aria-label="Buscar condição ou personagem" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar personagem ou condição..." /></div><div className="hb-conditions-filter-row"><label>Personagem <select value={characterFilter} onChange={e=>setCharacterFilter(e.target.value)}><option value="todos">Todos</option>{characters.map(c=><option key={c.id} value={`character:${c.id}`}>{c.emoji||'🧑'} {c.name}</option>)}</select></label><label>Gravidade <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="todas">Todas</option><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><span>{allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).length} resultado(s)</span></div>{allActive.length===0?<p className="hb-conditions-empty">✨ Nenhuma condição ativa nesta campanha.</p>:<div className="hb-conditions-active">{allActive.filter(a=>(severityFilter==='todas'||a.severity===severityFilter)&&(characterFilter==='todos'||`${a.targetType}:${a.character_id}`===characterFilter)&&`${a.name} ${targetName(a)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(a=><article key={a.id} className={`hb-conditions-entry severity-${a.severity}`}><div><strong>{a.emoji} {a.name}</strong><span className={`hb-conditions-severity severity-${a.severity}`}>{a.severity==='critica'?'Crítica':a.severity==='grave'?'Grave':'Normal'}</span><small>{targetName(a)} · {a.duration_label||'Sem duração definida'}</small>{a.description&&<p>{a.description}</p>}{a.notes&&<small>{a.notes}</small>}</div>{master&&<div className="hb-condition-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{const d=definitions.find(d=>d.id===a.definition_id);if(d)startEditDefinition(d)}}>✏️ Editar condição</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEditingAssignment(`${a.targetType}:${a.id}`);setEditDuration(a.duration_label||'');setEditNotes(a.notes||'')}}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void execute(async()=>a.targetType==='enemy'?supabase.rpc('hax_remove_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}):supabase.rpc('hax_remove_condition',{p_campaign_id:campaignId,p_assignment_id:a.id}))}>Remover</button></div>}</article>)}</div>}</div>}
    {master&&workspace==='library'&&<div className="hb-condition-card"><div className="hb-conditions-section-head"><div><h3>📚 Biblioteca de condições</h3><small>Condições disponíveis para aplicar aos personagens</small></div><span className="hb-conditions-count">{definitions.length} cadastradas</span></div><div className="hb-condition-library">{definitions.length===0&&<p className="hb-conditions-empty">Nenhuma condição cadastrada. Use a aba Criar para adicionar uma.</p>}{definitions.map(d=><div key={d.id}><strong>{d.emoji} {d.name}</strong><small>{d.description||'Sem descrição'} · {d.severity}</small><div className="hb-condition-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>startEditDefinition(d)}>✏️ Editar</button><button type="button" className="secondary-button" disabled={busy||allActive.some(a=>a.definition_id===d.id)} onClick={()=>void execute(async()=>supabase.rpc('hax_delete_condition',{p_campaign_id:campaignId,p_definition_id:d.id}))}>Excluir</button></div></div>)}</div></div>}
    {master&&editingDefinition&&<div className="hb-condition-modal-backdrop"><form className="hb-condition-modal" onSubmit={e=>{e.preventDefault();const id=editingDefinition;void execute(async()=>{const r=await supabase.rpc('hax_update_condition',{p_campaign_id:campaignId,p_definition_id:id,p_name:editName.trim(),p_emoji:editEmoji.trim()||'✨',p_description:editDescription.trim(),p_severity:editSeverity});if(!r.error)setEditingDefinition(null);return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição</h3><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>✕</button></div><label>Nome<input required maxLength={70} value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Emoji<input maxLength={12} value={editEmoji} onChange={e=>setEditEmoji(e.target.value)}/></label><label>Gravidade<select value={editSeverity} onChange={e=>setEditSeverity(e.target.value)}><option value="normal">Normal</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label>Efeito<textarea rows={4} value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label><div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingDefinition(null)}>Cancelar</button><button className="primary-button" disabled={busy||!editName.trim()}>Salvar alterações</button></div></form></div>}
    {master&&editingAssignment&&<div className="hb-condition-modal-backdrop"><form className="hb-condition-modal" onSubmit={e=>{e.preventDefault();const [kind,id]=editingAssignment.split(':');void execute(async()=>{const r=kind==='enemy'?await supabase.rpc('hax_update_active_enemy_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null}):await supabase.rpc('hax_update_active_condition',{p_campaign_id:campaignId,p_assignment_id:id,p_duration_label:editDuration.trim()||null,p_notes:editNotes.trim()||null});if(!r.error)setEditingAssignment(null);return r})}}><div className="hb-conditions-section-head"><h3>✏️ Editar condição aplicada</h3><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>✕</button></div><label>Duração<input maxLength={120} value={editDuration} onChange={e=>setEditDuration(e.target.value)} placeholder="Ex.: 3 turnos"/></label><label>Observações<textarea rows={3} maxLength={500} value={editNotes} onChange={e=>setEditNotes(e.target.value)}/></label><div className="hb-condition-actions"><button type="button" className="secondary-button" onClick={()=>setEditingAssignment(null)}>Cancelar</button><button className="primary-button" disabled={busy}>Salvar alterações</button></div></form></div>}
  </section>
}
export function CharacterConditions({campaignId,characterId}:{campaignId:string;characterId:string}){
 const [active,setActive]=useState<Active[]>([])
 useEffect(()=>{let live=true;const load=async()=>{const r=await supabase.rpc('hax_list_active_conditions',{p_campaign_id:campaignId,p_character_id:characterId});if(live&&!r.error)setActive((r.data||[]) as Active[])};void load();const t=setInterval(()=>void load(),15000);return()=>{live=false;clearInterval(t)}},[campaignId,characterId])
 return <div className="hb-condition-indicator"><strong>🩸 Condições {active.length>0?`(${active.length})`:''}</strong><div>{active.length===0?<small>Nenhuma condição ativa</small>:active.map(a=><span key={a.id} className={`hb-condition-tag severity-${a.severity}`} title={[a.description,a.duration_label,a.notes].filter(Boolean).join(' · ')}>{a.emoji} {a.name}{a.duration_label?` · ${a.duration_label}`:''}</span>)}</div></div>
}
