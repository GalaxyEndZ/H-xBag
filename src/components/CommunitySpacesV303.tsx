import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import PollsV304 from './PollsV304'
import './V303Features.css'

type Space={id:string;group_id:string;name:string;description:string;kind:'discussion'|'announcements'|'resources';sort_order:number}
type Entry={id:string;group_id:string;space_id:string;author_id:string;body:string;created_at:string}
const labels={discussion:'Discussões',announcements:'Avisos',resources:'Recursos'} as const
const symbols={discussion:'💬',announcements:'📣',resources:'📚'} as const
const err=(e:unknown)=>e instanceof Error?e.message:String(e)
export default function CommunitySpacesV303({groupId,groupName,userId,canModerate,nameFor}:{groupId:string;groupName:string;userId:string;canModerate:boolean;nameFor?:(userId:string)=>string}){
 const [spaces,setSpaces]=useState<Space[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [entries,setEntries]=useState<Entry[]>([])
 const [name,setName]=useState('')
 const [description,setDescription]=useState('')
 const [kind,setKind]=useState<Space['kind']>('discussion')
 const [composer,setComposer]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [showCreate,setShowCreate]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const selected=spaces.find(s=>s.id===selectedId)
 const canPost=selected&&(selected.kind!=='announcements'||canModerate)
 const loadSpaces=useCallback(async()=>{
  const {data,error:failure}=await supabase.from('hax_v303_community_spaces').select('*').eq('group_id',groupId).order('sort_order').order('created_at')
  if(failure)throw failure
  const next=(data||[]) as Space[];setSpaces(next);setSelectedId(previous=>next.some(s=>s.id===previous)?previous:next[0]?.id||'')
 },[groupId])
 const loadEntries=useCallback(async(spaceId:string)=>{
  const {data,error:failure}=await supabase.from('hax_v303_space_entries').select('*').eq('space_id',spaceId).order('created_at',{ascending:false}).limit(80)
  if(failure)throw failure;setEntries((data||[]) as Entry[])
 },[])
 useEffect(()=>{let alive=true;setLoading(true);setSpaces([]);setEntries([]);setSelectedId('');void loadSpaces().catch(e=>{if(alive)setError(`Os espaços estão indisponíveis: ${err(e)}. Execute HAXBAG_V303_SERVIDORES_COMUNIDADES_CONQUISTAS.sql.`)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[loadSpaces])
 useEffect(()=>{let alive=true;setEntries([]);if(!selectedId)return;void loadEntries(selectedId).catch(e=>{if(alive)setError(err(e))});return()=>{alive=false}},[selectedId,loadEntries])
 const action=async(fn:()=>Promise<void>,success:string)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();setNotice(success)}catch(e){setError(err(e))}finally{setBusy(false)}}
 const create=(e:FormEvent)=>{e.preventDefault();if(!canModerate||!name.trim())return;void action(async()=>{
  const {data,error:failure}=await supabase.from('hax_v303_community_spaces').insert({group_id:groupId,name:name.trim(),description:description.trim(),kind,sort_order:spaces.length}).select('id').single()
  if(failure)throw failure;await loadSpaces();setSelectedId(data.id);setName('');setDescription('');setKind('discussion');setShowCreate(false)
 },'Espaço criado.')}
 const send=(e:FormEvent)=>{e.preventDefault();if(!canPost||!composer.trim())return;void action(async()=>{
  const {error:failure}=await supabase.from('hax_v303_space_entries').insert({group_id:groupId,space_id:selectedId,author_id:userId,body:composer.trim()})
  if(failure)throw failure;setComposer('');await loadEntries(selectedId)
 },'Publicação enviada.')}
 const remove=(entry:Entry)=>{if(!window.confirm('Excluir esta publicação do espaço?'))return;void action(async()=>{
  const {error:failure}=await supabase.from('hax_v303_space_entries').delete().eq('id',entry.id)
  if(failure)throw failure;await loadEntries(selectedId)
 },'Publicação removida.')}
 const deleteSpace=()=>{if(!canModerate||!selected||!window.confirm(`Excluir o espaço “${selected.name}” e todas as suas publicações?`))return;void action(async()=>{
  const {error:failure}=await supabase.from('hax_v303_community_spaces').delete().eq('id',selected.id).eq('group_id',groupId)
  if(failure)throw failure;await loadSpaces()
 },'Espaço excluído.')}
 return <section className="hb-v303-community" aria-label={`Espaços de ${groupName}`}>
  <header className="hb-v303-community-heading"><div><small>ESPAÇOS DA COMUNIDADE</small><h4>Organização de {groupName}</h4><p>Separe discussões, anúncios e recursos importantes do grupo.</p></div><div className="hb-v303-actions"><button type="button" onClick={()=>void loadSpaces()} disabled={busy}>↻ Atualizar</button>{canModerate&&<button type="button" onClick={()=>setShowCreate(v=>!v)}>{showCreate?'Fechar':'＋ Criar espaço'}</button>}</div></header>
  {error&&<p role="alert" className="hb-v303-error">{error}</p>}{notice&&<p role="status" className="hb-v303-success">{notice}</p>}
  {showCreate&&canModerate&&<form className="hb-v303-create-space hb-v303-form" onSubmit={create}><label>Nome<input value={name} maxLength={50} required minLength={2} onChange={e=>setName(e.target.value)} placeholder="Ex.: Estratégias"/></label><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as Space['kind'])}><option value="discussion">Discussões</option><option value="announcements">Avisos da moderação</option><option value="resources">Biblioteca de recursos</option></select></label><label>Descrição<textarea maxLength={300} value={description} onChange={e=>setDescription(e.target.value)}/></label><button disabled={busy||name.trim().length<2}>Criar espaço</button></form>}
  {loading?<p>Carregando espaços…</p>:spaces.length?<div className="hb-v303-spaces-grid"><nav aria-label="Espaços internos" className="hb-v303-spaces-tabs">{spaces.map(space=><button key={space.id} type="button" className={selectedId===space.id?'is-selected':''} onClick={()=>setSelectedId(space.id)}><span aria-hidden="true">{symbols[space.kind]}</span><span><b>{space.name}</b><small>{labels[space.kind]}</small></span></button>)}</nav>
   <div className="hb-v303-space-content">{selected&&<><header><div><small>{labels[selected.kind]}</small><h4>{selected.name}</h4><p>{selected.description||'Compartilhe conteúdo com os participantes desta comunidade.'}</p></div>{canModerate&&<button type="button" className="is-danger" onClick={deleteSpace} disabled={busy}>Excluir espaço</button>}</header>
    {canPost&&<form className="hb-v303-space-composer" onSubmit={send}><textarea value={composer} maxLength={2500} rows={3} onChange={e=>setComposer(e.target.value)} placeholder={selected.kind==='resources'?'Compartilhe um link ou material útil…':'Escreva uma publicação para este espaço…'} aria-label="Nova publicação"/><div><small>{composer.length}/2500</small><button disabled={busy||!composer.trim()}>Publicar</button></div></form>}
    {!canPost&&<p className="hb-v303-muted">Somente donos e moderadores podem publicar avisos.</p>}
    <details className="hb-v304-wrap hb-v304-compact"><summary>📊 Enquetes da comunidade</summary><PollsV304 contextType="space" contextId={selected.id} userId={userId} allowCreate={Boolean(canPost)}/></details>
    <div className="hb-v303-entry-list">{entries.map(entry=><article key={entry.id}><div className="hb-v303-entry-meta"><span>{entry.author_id===userId?'Você':(nameFor?.(entry.author_id)||'Membro da comunidade')}</span><time>{new Date(entry.created_at).toLocaleString('pt-BR')}</time></div><p>{entry.body}</p>{(entry.author_id===userId||canModerate)&&<button type="button" onClick={()=>remove(entry)} disabled={busy}>Excluir</button>}</article>)}{!entries.length&&<p className="hb-v303-muted">Nenhuma publicação neste espaço ainda.</p>}</div>
   </>}</div>
  </div>:<p className="hb-v303-muted">Ainda não há espaços internos. {canModerate?'Crie o primeiro espaço para organizar esta comunidade.':'O dono ou um moderador poderá criar espaços.'}</p>}
 </section>
}
